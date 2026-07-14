import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = path.join(projectRoot, "dist");
const outputRoot = path.join(projectRoot, "dist-browsers");
const oauthCallbackSource = path.join(projectRoot, "oauth-callback.html");

const targets = [
  {
    id: "chrome",
    displayName: "Chrome",
    family: "chromium",
  },
  {
    id: "edge",
    displayName: "Microsoft Edge",
    family: "chromium",
  },
  {
    id: "brave",
    displayName: "Brave",
    family: "chromium",
  },
  {
    id: "opera",
    displayName: "Opera",
    family: "chromium",
  },
  {
    id: "arc",
    displayName: "Arc",
    family: "chromium",
  },
  {
    id: "vivaldi",
    displayName: "Vivaldi",
    family: "chromium",
  },
  {
    id: "firefox",
    displayName: "Firefox",
    family: "firefox",
  },
  {
    id: "safari",
    displayName: "Safari",
    family: "safari",
  },
];

function toFirefoxManifest(manifest) {
  return {
    ...manifest,
    background: {
      scripts: [manifest.background.service_worker],
      type: "module",
    },
    web_accessible_resources: manifest.web_accessible_resources?.map((entry) => {
      const { use_dynamic_url: _useDynamicUrl, ...rest } = entry;
      return rest;
    }),
    browser_specific_settings: {
      gecko: {
        id: "tabsetu@tabsetu.app",
        strict_min_version: "128.0",
      },
    },
  };
}

function toSafariManifest(manifest) {
  // Safari does not support the `identity` permission or the `oauth2` key.
  // Remove them while retaining the packaged tab-based OAuth callback fallback.
  const { oauth2: _oauth2, ...rest } = manifest;

  const permissions = (rest.permissions ?? []).filter(
    (perm) => perm !== "identity"
  );
  const optionalPermissions = (rest.optional_permissions ?? []).filter(
    (perm) => perm !== "identity"
  );

  const webAccessibleResources = (rest.web_accessible_resources ?? []).map((entry) => {
    const { use_dynamic_url: _useDynamicUrl, ...entryRest } = entry;
    return entryRest;
  });

  return {
    ...rest,
    permissions,
    optional_permissions: optionalPermissions,
    web_accessible_resources: webAccessibleResources,
  };
}

async function writeManifest(targetDir, target) {
  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  let nextManifest;
  if (target.family === "firefox") {
    nextManifest = toFirefoxManifest(manifest);
  } else if (target.family === "safari") {
    nextManifest = toSafariManifest(manifest);
  } else {
    nextManifest = manifest;
  }

  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
}

async function writeTargetReadme(targetDir, target) {
  const lines = [`# TabSetu for ${target.displayName}`, ""];

  if (target.family === "firefox") {
    lines.push(
      "This package uses the Firefox MV3 background script shape (`background.scripts`) while keeping the same bundled application code."
    );
  } else if (target.family === "safari") {
    lines.push(
      "This package is prepared for Safari. To load it in Safari, convert it to an Xcode project:",
      "",
      "```bash",
      `xcrun safari-web-extension-converter ${targetDir} --project-location ./safari-xcode --app-name TabSetu`,
      "```",
      "",
      "Then open the Xcode project, build, and enable the extension in Safari > Settings > Extensions.",
      "",
      "Note: Google Drive sync uses a tab-based OAuth flow on Safari because `chrome.identity` is not available."
    );
  } else {
    lines.push(
      "This package uses the Chromium MV3 service worker shape and can be loaded in Chrome-compatible browsers."
    );
  }

  lines.push(
    "",
    "Load this folder as an unpacked extension for local testing, or zip the folder contents for store submission.",
    ""
  );

  await writeFile(path.join(targetDir, "BROWSER_BUILD.md"), lines.join("\n"));
}

async function copyOAuthCallback(targetDir, target) {
  // Safari needs the oauth-callback.html page bundled
  if (target.family === "safari") {
    try {
      await cp(oauthCallbackSource, path.join(targetDir, "oauth-callback.html"));
    } catch {
      // Non-critical — only needed for Safari Google sync
    }
  }
}

async function buildTarget(target) {
  const targetDir = path.join(outputRoot, target.id);
  await cp(distDir, targetDir, { recursive: true });
  await rm(path.join(targetDir, ".vite"), { recursive: true, force: true });
  await writeManifest(targetDir, target);
  await copyOAuthCallback(targetDir, target);
  await writeTargetReadme(targetDir, target);
  return targetDir;
}

// Support --target filter for single-browser builds
const targetFilter = process.argv
  .find((arg) => arg.startsWith("--target"))
  ?.split("=")[1]
  ?.trim()
  ?.toLowerCase();

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const filteredTargets = targetFilter
  ? targets.filter((t) => t.id === targetFilter)
  : targets;

if (filteredTargets.length === 0) {
  console.error(`Unknown target: ${targetFilter}`);
  console.error(`Available: ${targets.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

const built = [];
for (const target of filteredTargets) {
  built.push(await buildTarget(target));
}

console.log("Prepared browser builds:");
for (const targetDir of built) {
  console.log(`- ${path.relative(projectRoot, targetDir)}`);
}
