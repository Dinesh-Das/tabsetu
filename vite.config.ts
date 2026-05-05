import { cpSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.resolve(projectRoot, "src/manifest.json"), "utf8"),
);

function copySharePagePlugin() {
  return {
    name: "copy-share-page",
    closeBundle() {
      const source = path.resolve(projectRoot, "share-page");
      if (!existsSync(source)) {
        return;
      }

      cpSync(source, path.resolve(projectRoot, "dist/share-page"), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copySharePagePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
