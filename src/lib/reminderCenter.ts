import type { Schedule, Session, Settings, TabItem } from "@/types";
import { nextMatchingDate } from "@/lib/alarmScheduling";
import { isReminderInPastWindow } from "@/lib/reminders";

export interface TabReminderRow {
  id: string;
  session: Session;
  tab: TabItem;
  dueAt: number;
  dismissed: boolean;
}

export type ScheduleJobStatus = "active" | "paused" | "blocked" | "expired";

export interface ScheduleJobRow {
  id: string;
  schedule: Schedule;
  session: Session | null;
  nextRunAt: number | null;
  lastFiredAt: number | null;
  status: ScheduleJobStatus;
  statusLabel: string;
}

export interface ReminderCenterData {
  activeTabReminders: TabReminderRow[];
  pastTabReminders: TabReminderRow[];
  scheduleJobs: ScheduleJobRow[];
  activeScheduleJobs: number;
}

function buildTabReminderRows(sessions: Session[]): TabReminderRow[] {
  return sessions.flatMap((session) =>
    session.tabs
      .filter((tab) => tab.reminderAt || tab.reminderSnoozedUntil || tab.reminderDismissed)
      .map((tab) => ({
        id: `${session.id}-${tab.id}`,
        session,
        tab,
        dueAt: tab.reminderSnoozedUntil ?? tab.reminderAt ?? session.updatedAt,
        dismissed: tab.reminderDismissed,
      }))
  );
}

function scheduleStatus(
  schedule: Schedule,
  session: Session | null,
  settings: Settings,
  nextRunAt: number | null
): Pick<ScheduleJobRow, "status" | "statusLabel"> {
  if (!session) {
    return { status: "blocked", statusLabel: "Missing session" };
  }

  if (!settings.schedulesEnabled) {
    return { status: "paused", statusLabel: "Disabled globally" };
  }

  if (!schedule.enabled) {
    return { status: "paused", statusLabel: "Paused" };
  }

  if (!nextRunAt) {
    return { status: "expired", statusLabel: "No future run" };
  }

  return { status: "active", statusLabel: "Scheduled" };
}

function buildScheduleJobRows(
  schedules: Schedule[],
  sessions: Session[],
  settings: Settings,
  now: number
): ScheduleJobRow[] {
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));

  return schedules
    .filter((schedule) => schedule.deletedAt == null)
    .map((schedule) => {
      const session = sessionMap.get(schedule.sessionId) ?? null;
      const nextRunAt = nextMatchingDate(schedule, new Date(now))?.getTime() ?? null;
      const status = scheduleStatus(schedule, session, settings, nextRunAt);

      return {
        id: schedule.id,
        schedule,
        session,
        nextRunAt,
        lastFiredAt: schedule.lastFiredAt,
        ...status,
      };
    })
    .sort((left, right) => {
      const statusRank: Record<ScheduleJobStatus, number> = {
        active: 0,
        paused: 1,
        blocked: 2,
        expired: 3,
      };
      const rankDelta = statusRank[left.status] - statusRank[right.status];
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return (
        (left.nextRunAt ?? Number.MAX_SAFE_INTEGER) - (right.nextRunAt ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

export function buildReminderCenter(
  sessions: Session[],
  schedules: Schedule[],
  settings: Settings,
  now = Date.now()
): ReminderCenterData {
  const tabRows = buildTabReminderRows(sessions);
  const scheduleJobs = buildScheduleJobRows(schedules, sessions, settings, now);

  return {
    activeTabReminders: tabRows
      .filter((row) => !row.dismissed)
      .sort((left, right) => left.dueAt - right.dueAt),
    pastTabReminders: tabRows
      .filter((row) => row.dismissed && isReminderInPastWindow(row.dueAt, now))
      .sort((left, right) => right.dueAt - left.dueAt),
    scheduleJobs,
    activeScheduleJobs: scheduleJobs.filter((job) => job.status === "active").length,
  };
}
