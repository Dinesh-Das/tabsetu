import { describe, expect, it } from "vitest";
import { normalizeCustomAIProviderUrl } from "@/lib/aiPromptSharing";

describe("normalizeCustomAIProviderUrl", () => {
  it("accepts HTTPS custom providers", () => {
    expect(normalizeCustomAIProviderUrl("https://ai.example.com/new")).toBe(
      "https://ai.example.com/new"
    );
  });

  it("rejects invalid or insecure custom providers", () => {
    expect(normalizeCustomAIProviderUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCustomAIProviderUrl("http://ai.example.com/new")).toBeNull();
    expect(normalizeCustomAIProviderUrl("not a url")).toBeNull();
  });
});
