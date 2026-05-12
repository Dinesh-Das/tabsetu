import { describe, expect, it } from "vitest";
import { normalizeScheduleDraft, normalizeScheduleUrl } from "@/lib/scheduleDraft";

describe("schedule draft normalization", () => {
  it("normalizes bare domains into https URLs", () => {
    expect(normalizeScheduleUrl("example.com/path")).toBe("https://example.com/path");
  });

  it("requires either a saved session target or a URL", () => {
    const result = normalizeScheduleDraft({
      sessionId: "",
      url: "",
      type: "daily",
      date: "",
      time: "09:00",
      daysOfWeek: [],
    });

    expect(result).toEqual({ ok: false, error: "Choose a saved session or enter a URL." });
  });

  it("keeps once schedules dated and clears recurring dates", () => {
    const once = normalizeScheduleDraft({
      sessionId: "session-1",
      url: "",
      type: "once",
      date: "2026-05-10",
      time: "09:00",
      daysOfWeek: [],
    });
    const daily = normalizeScheduleDraft({
      sessionId: "session-1",
      url: "",
      type: "daily",
      date: "2026-05-10",
      time: "09:00",
      daysOfWeek: [1],
    });

    expect(once.ok).toBe(true);
    if (once.ok) {
      expect(once.value.date).toBe("2026-05-10");
    }
    expect(daily.ok).toBe(true);
    if (daily.ok) {
      expect(daily.value.date).toBeNull();
      expect(daily.value.daysOfWeek).toEqual([]);
    }
  });
});
