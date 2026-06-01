import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

type ManifestWithOAuth = Parameters<typeof crx>[0]["manifest"] & {
  oauth2?: {
    client_id: string;
    scopes?: string[];
  };
};

function loadExtensionManifest(mode: string): ManifestWithOAuth {
  const manifest = JSON.parse(
    readFileSync(path.resolve(projectRoot, "src/manifest.json"), "utf8")
  ) as ManifestWithOAuth;
  const env = loadEnv(mode, projectRoot, "");
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const requiresGoogleClientId = env.REQUIRE_GOOGLE_CLIENT_ID === "true";

  if (googleClientId && manifest.oauth2) {
    manifest.oauth2.client_id = googleClientId;
  } else if (requiresGoogleClientId && manifest.oauth2) {
    throw new Error("GOOGLE_CLIENT_ID is required for this extension build.");
  }

  return manifest;
}

export default defineConfig(({ mode }) => {
  const manifest = loadExtensionManifest(mode);
  const env = loadEnv(mode, projectRoot, "");
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";

  return {
    define: {
      __TABSETU_GOOGLE_CLIENT_ID__: JSON.stringify(googleClientId),
      __TABSETU_GOOGLE_SCOPES__: JSON.stringify(manifest.oauth2?.scopes ?? []),
    },
    plugins: [
      react(),
      crx({ manifest }),
      viteStaticCopy({
        targets: [
          { src: "share-page/*", dest: "share-page" },
          { src: "node_modules/lz-string/libs/lz-string.min.js", dest: "share-page/vendor" },
          { src: "oauth-callback.*", dest: "." },
        ],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "./src"),
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: "hidden",
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        input: {
          searchOverlay: path.resolve(projectRoot, "src/content/searchOverlay.ts"),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === "searchOverlay"
              ? "src/content/searchOverlay.js"
              : "assets/[name]-[hash].js",
          manualChunks: (id) => {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("fuse.js")) {
              return "vendor-search";
            }
            if (id.includes("lz-string")) {
              return "vendor-compression";
            }
            if (id.includes("react")) {
              return "vendor-react";
            }

            return undefined;
          },
        },
      },
    },
  };
});
