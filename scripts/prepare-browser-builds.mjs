import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = path.join(projectRoot, "dist");
const outputRoot = path.join(projectRoot, "dist-browsers");

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
    id: "firefox",
    displayName: "Firefox",
    family: "firefox",
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

async function writeManifest(targetDir, target) {
  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const nextManifest = target.family === "firefox" ? toFirefoxManifest(manifest) : manifest;
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
}

async function writeTargetReadme(targetDir, target) {
  const text = [
    `# TabSetu for ${target.displayName}`,
    "",
    target.family === "firefox"
      ? "This package uses the Firefox MV3 background script shape (`background.scripts`) while keeping the same bundled application code."
      : "This package uses the Chromium MV3 service worker shape and can be loaded in Chrome-compatible browsers.",
    "",
    "Load this folder as an unpacked extension for local testing, or zip the folder contents for store submission.",
    "",
  ].join("\n");
  await writeFile(path.join(targetDir, "BROWSER_BUILD.md"), text);
}

async function buildTarget(target) {
  const targetDir = path.join(outputRoot, target.id);
  await cp(distDir, targetDir, { recursive: true });
  await writeManifest(targetDir, target);
  await writeTargetReadme(targetDir, target);
  return targetDir;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const built = [];
for (const target of targets) {
  built.push(await buildTarget(target));
}

console.log("Prepared browser builds:");
for (const targetDir of built) {
  console.log(`- ${path.relative(projectRoot, targetDir)}`);
}
