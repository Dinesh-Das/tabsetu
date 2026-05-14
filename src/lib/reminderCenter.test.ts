import { describe, expect, it } from "vitest";
import { buildReminderCenter } from "@/lib/reminderCenter";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Schedule, Session, TabItem } from "@/types";

function tab(overrides: Partial<TabItem> = {}): TabItem {
  return {
    id: "tab-1",
    title: "Docs",
    url: "https://example.com/docs",
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 0,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
    ...overrides,
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    name: "Daily docs",
    description: "",
    folderId: null,
    tagIds: [],
    tabs: [tab()],
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt: 1,
    updatedAt: 1,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
    ...overrides,
  };
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "schedule-1",
    sessionId: "session-1",
    type: "daily",
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

describe("buildReminderCenter", () => {
  it("keeps overdue active tab reminders in the active bucket", () => {
    const now = new Date(2026, 4, 14, 10, 0).getTime();
    const dueAt = new Date(2026, 4, 14, 9, 30).getTime();

    const result = buildReminderCenter(
      [session({ tabs: [tab({ reminderAt: dueAt })] })],
      [],
      DEFAULT_SETTINGS,
      now
    );

    expect(result.activeTabReminders).toHaveLength(1);
    expect(result.pastTabReminders).toHaveLength(0);
  });

  it("includes scheduled session jobs with their next run", () => {
    const now = new Date(2026, 4, 14, 8, 0).getTime();

    const result = buildReminderCenter(
      [session()],
      [schedule({ time: "09:00" })],
      DEFAULT_SETTINGS,
      now
    );

    expect(result.scheduleJobs).toHaveLength(1);
    expect(result.scheduleJobs[0]?.status).toBe("active");
    expect(result.scheduleJobs[0]?.nextRunAt).toBe(new Date(2026, 4, 14, 9, 0).getTime());
    expect(result.activeScheduleJobs).toBe(1);
  });

  it("surfaces blocked schedule jobs instead of hiding them", () => {
    const now = new Date(2026, 4, 14, 8, 0).getTime();

    const result = buildReminderCenter([], [schedule()], DEFAULT_SETTINGS, now);

    expect(result.scheduleJobs[0]?.status).toBe("blocked");
    expect(result.scheduleJobs[0]?.statusLabel).toBe("Missing session");
  });
});
