import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("extension compliance contract", () => {
  it("keeps browser history out of install-time permissions", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(projectRoot, "src", "manifest.json"), "utf8")
    ) as {
      permissions?: string[];
      optional_permissions?: string[];
      host_permissions?: string[];
      content_scripts?: unknown[];
    };

    expect(manifest.permissions).not.toContain("history");
    expect(manifest.optional_permissions).toContain("history");
    expect(manifest.host_permissions ?? []).not.toContain("<all_urls>");
    expect(manifest.content_scripts ?? []).toHaveLength(0);
  });

  it("does not request history permission from an overlay command", () => {
    const messaging = readFileSync(
      path.join(projectRoot, "src", "background", "messaging.ts"),
      "utf8"
    );

    expect(messaging).not.toMatch(/permissions\s*\.\s*request/);
    expect(messaging).not.toContain('requestOptionalPermission("history")');
  });
});
