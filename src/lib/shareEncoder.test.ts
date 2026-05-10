import { expect, it } from "vitest";
import { decodeSession, encodeSession } from "./shareEncoder";
import type { ShareSnapshot } from "@/types";

it("round-trips a large session without loss", () => {
  const session: ShareSnapshot = {
    v: 1,
    name: "Big session",
    description: "",
    createdAt: 1,
    tabs: Array.from({ length: 30 }, (_, i) => ({
      url: `https://example.com/page/${i}?q=${"x".repeat(200)}`,
      title: `Tab ${i}`,
    })),
  };

  const encoded = encodeSession(session);
  expect(encoded.length).toBeLessThan(2000);
  const decoded = decodeSession(encoded);
  expect(decoded).toEqual(session);
});
