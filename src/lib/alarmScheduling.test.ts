import { describe, expect, it } from "vitest";
import { nextMatchingDate } from "@/lib/alarmScheduling";
import type { Schedule, ScheduleType } from "@/types";

function schedule(overrides: Partial<Schedule> & { type: ScheduleType }): Schedule {
  return {
    id: "schedule-1",
    sessionId: "session-1",
    time: "09:00",
    daysOfWeek: [],
    date: null,
    enabled: true,
    lastFiredAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function expectLocalDate(
  actual: Date | null,
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number
): void {
  expect(actual).not.toBeNull();
  expect(actual?.getFullYear()).toBe(year);
  expect(actual?.getMonth()).toBe(monthIndex);
  expect(actual?.getDate()).toBe(day);
  expect(actual?.getHours()).toBe(hours);
  expect(actual?.getMinutes()).toBe(minutes);
}

describe("nextMatchingDate", () => {
  it("schedules daily alarms for tomorrow when today's wall-clock time has passed", () => {
    const next = nextMatchingDate(schedule({ type: "daily" }), new Date(2026, 4, 5, 10, 0));

    expectLocalDate(next, 2026, 4, 6, 9, 0);
  });

  it("skips weekends for weekday schedules", () => {
    const next = nextMatchingDate(schedule({ type: "weekdays" }), new Date(2026, 4, 8, 23, 0));

    expectLocalDate(next, 2026, 4, 11, 9, 0);
  });

  it("advances custom schedules to the next selected day", () => {
    const next = nextMatchingDate(
      schedule({ type: "custom", daysOfWeek: [1, 3] }),
      new Date(2026, 4, 7, 10, 0)
    );

    expectLocalDate(next, 2026, 4, 11, 9, 0);
  });

  it("returns null for one-time schedules in the past", () => {
    const next = nextMatchingDate(
      schedule({ type: "once", date: "2026-05-04" }),
      new Date(2026, 4, 5, 10, 0)
    );

    expect(next).toBeNull();
  });

  it("returns null for weekly schedules without selected days", () => {
    const next = nextMatchingDate(
      schedule({ type: "weekly", daysOfWeek: [] }),
      new Date(2026, 4, 5, 10, 0)
    );

    expect(next).toBeNull();
  });
});
