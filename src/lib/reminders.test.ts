import { describe, expect, it } from "vitest";
import {
  formatReminderDate,
  isReminderInPastWindow,
  oneHourFromNow,
  tomorrowAtNine,
} from "@/lib/reminders";

describe("reminder helpers", () => {
  it("formats reminders scheduled for today and tomorrow", () => {
    const now = new Date(2026, 4, 5, 8, 30).getTime();
    const today = new Date(2026, 4, 5, 15, 0).getTime();
    const tomorrow = new Date(2026, 4, 6, 9, 0).getTime();

    expect(formatReminderDate(today, now)).toContain("Today");
    expect(formatReminderDate(tomorrow, now)).toContain("Tomorrow");
  });

  it("calculates quick-set reminder times from the provided clock", () => {
    const now = new Date(2026, 4, 5, 8, 30).getTime();
    const tomorrow = tomorrowAtNine(now);

    expect(oneHourFromNow(now)).toBe(new Date(2026, 4, 5, 9, 30).getTime());
    expect(new Date(tomorrow).getDate()).toBe(6);
    expect(new Date(tomorrow).getHours()).toBe(9);
    expect(new Date(tomorrow).getMinutes()).toBe(0);
  });

  it("keeps past reminders only inside the thirty day window", () => {
    const now = new Date(2026, 4, 31, 12, 0).getTime();
    const recentPast = new Date(2026, 4, 2, 12, 0).getTime();
    const stalePast = new Date(2026, 3, 29, 12, 0).getTime();

    expect(isReminderInPastWindow(recentPast, now)).toBe(true);
    expect(isReminderInPastWindow(stalePast, now)).toBe(false);
  });
});
