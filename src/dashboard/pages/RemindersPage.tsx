import { useMemo } from "react";
import { Bell, CalendarDays, Clock3, ExternalLink, Moon, Play, Power, Trash2 } from "lucide-react";
import { TabSetuLogo } from "@/components/shared/TabSetuLogo";
import { getFaviconFallbackUrl } from "@/lib/favicon";
import { formatDateTime, formatScheduleLabel } from "@/lib/format";
import {
  buildReminderCenter,
  type ScheduleJobRow,
  type TabReminderRow,
} from "@/lib/reminderCenter";
import { formatReminderDate } from "@/lib/reminders";
import { getDomainLabel, openSavedTab, openSessionTabsDetailed } from "@/lib/sessionBrowser";
import type { Session, TabItem, ToastMessage } from "@/types";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
  onOpenSession?: (sessionId: string) => void;
}

function reminderAlarmName(tabId: string): string {
  return `reminder_${tabId}`;
}

function tomorrowMorning(): number {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

function updateReminderInSession(
  session: Session,
  tabId: string,
  updates: Partial<Pick<TabItem, "reminderAt" | "reminderSnoozedUntil" | "reminderDismissed">>
): TabItem[] {
  return session.tabs.map((tab) =>
    tab.id === tabId
      ? {
          ...tab,
          ...updates,
        }
      : tab
  );
}

async function scheduleReminderAlarm(tabId: string, dueAt: number | null): Promise<void> {
  await chrome.alarms.clear(reminderAlarmName(tabId));
  if (dueAt && dueAt > Date.now()) {
    await chrome.alarms.create(reminderAlarmName(tabId), { when: dueAt });
  }
}

function ReminderList({
  rows,
  emptyTitle,
  mode,
  addToast,
  onOpenSession,
}: {
  rows: TabReminderRow[];
  emptyTitle: string;
  mode: "upcoming" | "past";
  addToast: Props["addToast"];
  onOpenSession?: Props["onOpenSession"];
}) {
  const updateSession = useSessionStore((state) => state.updateSession);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);
  const settings = useSettingsStore((state) => state.settings);

  const snoozeReminder = async (row: TabReminderRow, dueAt: number, label: string) => {
    updateSession(row.session.id, {
      tabs: updateReminderInSession(row.session, row.tab.id, {
        reminderSnoozedUntil: dueAt,
        reminderDismissed: false,
      }),
    });
    await scheduleReminderAlarm(row.tab.id, settings.remindersEnabled ? dueAt : null);
    addToast("success", `Reminder snoozed ${label}.`);
  };

  const dismissReminder = async (row: TabReminderRow) => {
    updateSession(row.session.id, {
      tabs: updateReminderInSession(row.session, row.tab.id, {
        reminderSnoozedUntil: null,
        reminderDismissed: true,
      }),
    });
    await scheduleReminderAlarm(row.tab.id, null);
    addToast("success", "Reminder dismissed.");
  };

  const clearReminder = async (row: TabReminderRow) => {
    updateSession(row.session.id, {
      tabs: updateReminderInSession(row.session, row.tab.id, {
        reminderAt: null,
        reminderSnoozedUntil: null,
        reminderDismissed: false,
      }),
    });
    await scheduleReminderAlarm(row.tab.id, null);
    addToast("success", "Reminder cleared.");
  };

  const reopenReminder = async (row: TabReminderRow) => {
    const opened = await openSavedTab(row.tab, false);
    if (!opened) {
      addToast("error", "That tab could not be opened.");
      return;
    }

    recordTabOpened(row.session.id, row.tab.id);
    addToast("success", `Opened ${row.tab.title}.`);
  };

  if (rows.length === 0) {
    return (
      <div className="detail-empty reminders-empty">
        <Bell size={18} />
        <span>{emptyTitle}</span>
      </div>
    );
  }

  return (
    <div className="reminders-list">
      {rows.map((row) => {
        const favicon = row.tab.favIconUrl;
        const overdue = !row.dismissed && row.dueAt < Date.now();

        return (
          <article className="card-raised reminder-card" key={row.id}>
            <div className="reminder-card-main">
              <div className="reminder-favicon">
                {favicon ? (
                  <img
                    src={favicon}
                    alt=""
                    onError={(event) => {
                      const fallback = getFaviconFallbackUrl();
                      if (fallback && event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      } else {
                        event.currentTarget.style.display = "none";
                      }
                    }}
                  />
                ) : (
                  <TabSetuLogo decorative />
                )}
              </div>
              <div className="reminder-copy">
                <div className="reminder-title-row">
                  <strong>{row.tab.title}</strong>
                  <span className="badge badge-subtle">
                    {row.dismissed ? "Dismissed" : overdue ? "Overdue" : "Upcoming"}
                  </span>
                </div>
                <span>
                  {getDomainLabel(row.tab.url)} in {row.session.name}
                </span>
                <small>
                  <Clock3 size={12} />
                  {formatReminderDate(row.dueAt)}
                </small>
                {row.tab.note ? <p>{row.tab.note.slice(0, 180)}</p> : null}
                {!settings.remindersEnabled ? (
                  <small className="reminder-warning">
                    Reminders are disabled globally in Settings.
                  </small>
                ) : null}
              </div>
            </div>
            <div className="reminder-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void reopenReminder(row)}
              >
                <ExternalLink size={14} />
                Open tab
              </button>
              {mode === "upcoming" ? (
                <>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => void snoozeReminder(row, Date.now() + 60 * 60 * 1000, "1 hour")}
                  >
                    <Clock3 size={14} />
                    Snooze 1h
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() =>
                      void snoozeReminder(row, tomorrowMorning(), "until tomorrow at 9 AM")
                    }
                  >
                    <Moon size={14} />
                    Tomorrow
                  </button>
                </>
              ) : null}
              {onOpenSession ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => onOpenSession(row.session.id)}
                >
                  Session
                </button>
              ) : null}
              {mode === "upcoming" && !row.dismissed ? (
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  title="Dismiss reminder"
                  onClick={() => void dismissReminder(row)}
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
              {mode === "past" ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => void clearReminder(row)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ScheduleJobList({
  rows,
  emptyTitle,
  addToast,
  onOpenSession,
}: {
  rows: ScheduleJobRow[];
  emptyTitle: string;
  addToast: Props["addToast"];
  onOpenSession?: Props["onOpenSession"];
}) {
  const toggleSchedule = useScheduleStore((state) => state.toggleSchedule);
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const settings = useSettingsStore((state) => state.settings);

  const openScheduleJob = async (row: ScheduleJobRow) => {
    if (!row.session) {
      addToast("error", "That schedule no longer points to a saved session.");
      return;
    }

    const result = await openSessionTabsDetailed(row.session, settings.openInNewWindow);
    if (result.openedCount === 0) {
      addToast(
        "error",
        result.failedTabs.length > 0
          ? `TabSetu could not open ${result.failedTabs.length} scheduled tabs.`
          : "That scheduled session has no openable tabs."
      );
      return;
    }

    recordOpened(row.session.id);
    addToast(
      result.failedTabs.length > 0 || result.warnings.length > 0 ? "error" : "success",
      result.failedTabs.length > 0 || result.warnings.length > 0
        ? `Opened ${result.openedCount} tabs; some tabs or groups could not be restored.`
        : `Opened "${row.session.name}".`
    );
  };

  if (rows.length === 0) {
    return (
      <div className="detail-empty reminders-empty">
        <CalendarDays size={18} />
        <span>{emptyTitle}</span>
      </div>
    );
  }

  return (
    <div className="reminders-list">
      {rows.map((row) => {
        const schedule = row.schedule;
        const session = row.session;
        const sessionName = session?.name ?? "Missing session";
        const nextRunLabel = row.nextRunAt ? formatReminderDate(row.nextRunAt) : "No future run";

        return (
          <article className="card-raised reminder-card schedule-job-card" key={row.id}>
            <div className="reminder-card-main">
              <div className="reminder-favicon schedule-job-icon">
                <CalendarDays size={19} />
              </div>
              <div className="reminder-copy">
                <div className="reminder-title-row">
                  <strong>{sessionName}</strong>
                  <span className="badge badge-subtle">{row.statusLabel}</span>
                </div>
                <span>
                  {formatScheduleLabel(schedule.type)} at {schedule.time}
                  {schedule.date ? ` - ${schedule.date}` : ""}
                </span>
                <small>
                  <Clock3 size={12} />
                  Next run: {nextRunLabel}
                </small>
                <small>Last run: {formatDateTime(row.lastFiredAt)}</small>
                {row.status !== "active" ? (
                  <small className="reminder-warning">
                    {row.status === "blocked"
                      ? "Reconnect this job to a saved session from Schedules."
                      : "This job will not run until it is active."}
                  </small>
                ) : null}
              </div>
            </div>
            <div className="reminder-actions">
              {session ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => void openScheduleJob(row)}
                >
                  <Play size={14} />
                  Open now
                </button>
              ) : null}
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
              >
                <Power size={14} />
                {schedule.enabled ? "Disable" : "Enable"}
              </button>
              {onOpenSession && session ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => onOpenSession(session.id)}
                >
                  Session
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function RemindersPage({ addToast, onOpenSession }: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const schedules = useScheduleStore((state) => state.schedules);
  const settings = useSettingsStore((state) => state.settings);

  const reminderCenter = useMemo(
    () => buildReminderCenter(sessions, schedules, settings),
    [schedules, sessions, settings]
  );
  const activeCount = reminderCenter.activeTabReminders.length + reminderCenter.activeScheduleJobs;

  return (
    <section className="reminders-page">
      <div className="panel-shell reminders-shell">
        <div className="panel-header reminders-header">
          <div>
            <h1>Reminders</h1>
            <p>
              Upcoming saved-tab nudges, overdue reminders, and recently dismissed items in one
              place.
            </p>
          </div>
          <span className="badge badge-subtle">
            <Bell size={13} />
            {activeCount} active
          </span>
        </div>

        <section className="reminders-section">
          <div className="detail-section-header">
            <h3>Upcoming and overdue</h3>
            <span className="badge badge-subtle">
              {reminderCenter.activeTabReminders.length} reminders
            </span>
          </div>
          <ReminderList
            rows={reminderCenter.activeTabReminders}
            emptyTitle="No upcoming tab reminders yet."
            mode="upcoming"
            addToast={addToast}
            onOpenSession={onOpenSession}
          />
        </section>

        <section className="reminders-section">
          <div className="detail-section-header">
            <h3>Scheduled jobs</h3>
            <span className="badge badge-subtle">
              {reminderCenter.activeScheduleJobs} active / {reminderCenter.scheduleJobs.length}{" "}
              total
            </span>
          </div>
          <ScheduleJobList
            rows={reminderCenter.scheduleJobs}
            emptyTitle="No scheduled session jobs yet."
            addToast={addToast}
            onOpenSession={onOpenSession}
          />
        </section>

        <section className="reminders-section">
          <div className="detail-section-header">
            <h3>Past and dismissed</h3>
            <span className="badge badge-subtle">
              {reminderCenter.pastTabReminders.length} shown
            </span>
          </div>
          <ReminderList
            rows={reminderCenter.pastTabReminders}
            emptyTitle="No past reminders from the last 30 days."
            mode="past"
            addToast={addToast}
            onOpenSession={onOpenSession}
          />
        </section>
      </div>
    </section>
  );
}
