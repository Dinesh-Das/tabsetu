import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceManifestPath = path.join(projectRoot, "src", "manifest.json");
const productionManifestPaths = [
  path.join(projectRoot, "dist", "manifest.json"),
  ...(await listBrowserManifestPaths()),
];
const requiredDocs = [
  "LICENSE",
  "PRIVACY.md",
  "TERMS.md",
  "SECURITY.md",
  "STORE_LISTING.md",
  "COMPLIANCE.md",
  "CHANGELOG.md",
];
const allowedRequiredPermissions = new Set([
  "tabs",
  "storage",
  "alarms",
  "scripting",
  "activeTab",
  "contextMenus",
]);
const expectedScopes = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.email",
];
const forbiddenMonetizationTerms =
  /\b(premium|pro|upgrade|payment|payments|checkout|subscription|trial|monetization)\b/i;
const forbiddenDomains =
  /(stripe\.com|paypal\.com|paddle\.com|google-analytics\.com|googletagmanager\.com|doubleclick\.net|segment\.com|mixpanel\.com|amplitude\.com)/i;
const scannableExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".css"]);
const failures = [];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listBrowserManifestPaths() {
  const browserRoot = path.join(projectRoot, "dist-browsers");
  if (!(await exists(browserRoot))) {
    return [];
  }

  const entries = await readdir(browserRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(browserRoot, entry.name, "manifest.json"));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

function fail(message) {
  failures.push(message);
}

function assertManifest(manifest, filePath, { production }) {
  const label = relative(filePath);
  const required = manifest.permissions ?? [];
  const optional = manifest.optional_permissions ?? [];
  const hosts = manifest.host_permissions ?? [];

  if (required.includes("history")) {
    fail(`${label}: move "history" from permissions to optional_permissions.`);
  }
  if (!optional.includes("history")) {
    fail(`${label}: declare "history" in optional_permissions.`);
  }
  if (!optional.includes("notifications")) {
    fail(`${label}: declare "notifications" in optional_permissions.`);
  }
  if (manifest.oauth2 && !optional.includes("identity")) {
    fail(`${label}: declare "identity" in optional_permissions when OAuth is present.`);
  }
  if (hosts.includes("<all_urls>")) {
    fail(`${label}: remove the <all_urls> host permission.`);
  }
  if ((manifest.content_scripts ?? []).length !== 0) {
    fail(`${label}: remove always-on content scripts; use activeTab injection after a user action.`);
  }
  for (const permission of required) {
    if (!allowedRequiredPermissions.has(permission)) {
      fail(`${label}: required permission "${permission}" is not in the approved core set.`);
    }
  }
  const csp = manifest.content_security_policy?.extension_pages ?? "";
  if (/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval'|https?:)/i.test(csp)) {
    fail(`${label}: extension page script CSP must allow only local scripts.`);
  }
  if (production && JSON.stringify(manifest).includes("__REPLACE_WITH_CLIENT_ID__")) {
    fail(`${label}: replace __REPLACE_WITH_CLIENT_ID__ before a production build.`);
  }
}

async function walkFiles(directory) {
  if (!(await exists(directory))) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(filePath)));
    } else if (scannableExtensions.has(path.extname(entry.name))) {
      files.push(filePath);
    }
  }
  return files;
}

async function scanFiles() {
  const files = [
    ...(await walkFiles(path.join(projectRoot, "src"))),
    ...(await walkFiles(path.join(projectRoot, "share-page"))),
    ...(await walkFiles(path.join(projectRoot, "dist"))),
    ...(await walkFiles(path.join(projectRoot, "dist-browsers"))),
    path.join(projectRoot, "oauth-callback.html"),
    path.join(projectRoot, "oauth-callback.css"),
    path.join(projectRoot, "oauth-callback.js"),
  ];

  for (const filePath of files) {
    if (!(await exists(filePath))) {
      continue;
    }
    const contents = await readFile(filePath, "utf8");
    const label = relative(filePath);
    if (forbiddenDomains.test(contents)) {
      fail(`${label}: remove payment, ad, or analytics domains.`);
    }
    if (forbiddenMonetizationTerms.test(contents)) {
      fail(`${label}: remove monetization language or code paths from shipped source/build files.`);
    }
    if (path.extname(filePath) === ".html") {
      if (/<script\b[^>]*\bsrc\s*=\s*["']https?:/i.test(contents)) {
        fail(`${label}: remote scripts are not allowed.`);
      }
      if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(contents)) {
        fail(`${label}: inline scripts are not allowed.`);
      }
    }
  }
}

const sourceManifest = await readJson(sourceManifestPath);
assertManifest(sourceManifest, sourceManifestPath, { production: false });

const scopes = sourceManifest.oauth2?.scopes ?? [];
if (JSON.stringify(scopes) !== JSON.stringify(expectedScopes)) {
  fail("src/manifest.json: OAuth scopes must be exactly drive.appdata and userinfo.email.");
}

for (const filePath of productionManifestPaths) {
  if (await exists(filePath)) {
    assertManifest(await readJson(filePath), filePath, { production: true });
  }
}

for (const doc of requiredDocs) {
  if (!(await exists(path.join(projectRoot, doc)))) {
    fail(`${doc}: required compliance document is missing.`);
  }
}

if (await exists(path.join(projectRoot, "PRIVACY.md"))) {
  const privacy = await readFile(path.join(projectRoot, "PRIVACY.md"), "utf8");
  if (
    !/The use of information received from Google APIs will adhere to the Chrome Web Store User Data\s+Policy, including the Limited Use requirements\./.test(
      privacy
    )
  ) {
    fail("PRIVACY.md: add the Chrome Web Store Limited Use disclosure.");
  }
}

const messaging = await readFile(path.join(projectRoot, "src", "background", "messaging.ts"), "utf8");
if (/permissions\s*\.\s*request/.test(messaging)) {
  fail("src/background/messaging.ts: overlay commands must never request optional permissions.");
}

const exportsSource = await readFile(path.join(projectRoot, "src", "lib", "exportImport.ts"), "utf8");
if (/generateAIPromptWithPageText|fetchTabPageText/.test(exportsSource)) {
  fail("src/lib/exportImport.ts: automatic saved-URL page fetching must stay removed.");
}

await scanFiles();

if (failures.length !== 0) {
  console.error("TabSetu compliance check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("TabSetu compliance check passed.");
console.log(`Checked src/manifest.json and ${productionManifestPaths.length} generated manifest(s).`);
