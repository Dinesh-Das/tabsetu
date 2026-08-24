import type { Schedule, Session, Settings } from "@/types";
import { nextMatchingDate } from "@/lib/alarmScheduling";
import {
  AUTO_SYNC_UPLOAD_ALARM_NAME,
  ensurePendingAutoSyncUploadAlarm,
  flushPendingAutoSyncUpload,
  loadStorage,
  saveSchedules,
  saveSessions,
  STORAGE_KEYS,
} from "@/lib/storage";
import { useSettingsStore } from "@/store/settingsStore";
import { useSyncStore } from "@/store/syncStore";
import { isValidUrl } from "@/lib/tabHelpers";
import { openSavedTab, openSessionTabsDetailed } from "@/lib/sessionBrowser";
import { reconcileReminderAlarms } from "@/lib/reminderAlarms";
import {
  clearNotification,
  createNotification,
  notifyScheduledSessionOpened,
  updateBadge,
} from "@/background/notifications";

const AUTO_ARCHIVE_ALARM_NAME = "tabsetu-auto-archive";
const TIMEZONE_CHECK_ALARM_NAME = "tabsetu-timezone-check";
const TIMEZONE_OFFSET_KEY = "TabSetu_timezone_offset_minutes";
const KEEPALIVE_ALARM = "tabsetu-keepalive";
const REMINDER_WINDOW_MINUTES = 5;

function alarmName(scheduleId: string): string {
  return `schedule_${scheduleId}`;
}

function reminderAlarmName(tabId: string): string {
  return `reminder_${tabId}`;
}

export async function maybeStartKeepalive(): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  const now = Date.now();
  const hasImminent = alarms.some(
    (alarm) =>
      alarm.name.startsWith("reminder_") &&
      typeof alarm.scheduledTime === "number" &&
      alarm.scheduledTime - now < REMINDER_WINDOW_MINUTES * 60 * 1000
  );

  if (hasImminent) {
    try {
      await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
    } catch {
      // Reminder alarms still fire even when a browser refuses short keepalive alarms.
    }
  } else {
    await chrome.alarms.clear(KEEPALIVE_ALARM);
  }
}

function scheduleMatchesToday(schedule: Schedule, date: Date): boolean {
  if (schedule.type === "weekdays") {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  if (schedule.type === "weekly" || schedule.type === "custom") {
    return schedule.daysOfWeek.includes(date.getDay());
  }

  return true;
}

async function createScheduleAlarm(schedule: Schedule, from = new Date()): Promise<void> {
  const name = alarmName(schedule.id);
  await chrome.alarms.clear(name);

  const next = nextMatchingDate(schedule, from);
  if (!next) {
    return;
  }

  await chrome.alarms.create(name, {
    when: Math.max(next.getTime(), Date.now() + 1000),
  });
}

async function handleScheduleWithoutOpenableTabs(
  schedule: Schedule,
  schedules: Schedule[],
  currentAlarmName: string,
  now = Date.now()
): Promise<void> {
  if (schedule.type !== "once") {
    await createScheduleAlarm(schedule, new Date(now + 1000));
    return;
  }

  const updatedSchedules = schedules.map((item) =>
    item.id === schedule.id ? { ...item, enabled: false, updatedAt: now } : item
  );
  await saveSchedules(updatedSchedules);
  await chrome.alarms.clear(currentAlarmName);
}

async function loadRuntimeData(): Promise<{
  schedules: Schedule[];
  sessions: Session[];
  settings: Settings;
}> {
  const data = await loadStorage();
  return {
    schedules: data.schedules,
    sessions: data.sessions,
    settings: data.settings,
  };
}

export async function hydrateAlarms(): Promise<void> {
  const { schedules, sessions, settings } = await loadRuntimeData();

  await chrome.alarms.clearAll();
  await ensurePendingAutoSyncUploadAlarm();
  await createTimezoneCheckAlarm();
  await rememberTimezoneOffset();

  if (settings.schedulesEnabled) {
    for (const schedule of schedules) {
      if (!schedule.enabled) {
        continue;
      }
      await createScheduleAlarm(schedule);
    }
  }

  await createAutoArchiveAlarm(settings);

  await reconcileReminderAlarms(sessions, settings.remindersEnabled);
  await updateBadge();
  await maybeStartKeepalive();
}

async function createTimezoneCheckAlarm(): Promise<void> {
  await chrome.alarms.create(TIMEZONE_CHECK_ALARM_NAME, {
    delayInMinutes: 60,
    periodInMinutes: 60,
  });
}

async function rememberTimezoneOffset(): Promise<void> {
  await chrome.storage.local.set({ [TIMEZONE_OFFSET_KEY]: new Date().getTimezoneOffset() });
}

async function rehydrateAlarmsAfterTimezoneChange(): Promise<void> {
  const result = await chrome.storage.local.get([TIMEZONE_OFFSET_KEY]);
  const previousOffset =
    typeof result[TIMEZONE_OFFSET_KEY] === "number" ? result[TIMEZONE_OFFSET_KEY] : null;
  const currentOffset = new Date().getTimezoneOffset();

  if (previousOffset === currentOffset) {
    return;
  }

  await rememberTimezoneOffset();
  await hydrateAlarms();
}

async function createAutoArchiveAlarm(settings: Settings): Promise<void> {
  await chrome.alarms.clear(AUTO_ARCHIVE_ALARM_NAME);
  if (!settings.autoArchiveDays) {
    return;
  }

  await chrome.alarms.create(AUTO_ARCHIVE_ALARM_NAME, {
    delayInMinutes: 60,
    periodInMinutes: 24 * 60,
  });
}

async function runAutoArchive(): Promise<number> {
  const { sessions, settings } = await loadRuntimeData();
  if (!settings.autoArchiveDays) {
    return 0;
  }

  const now = Date.now();
  const cutoff = now - settings.autoArchiveDays * 24 * 60 * 60 * 1000;
  let archivedCount = 0;
  const updatedSessions = sessions.map((session) => {
    if (session.isArchived) {
      return session;
    }

    const lastActiveAt = session.lastOpenedAt ?? session.updatedAt ?? session.createdAt;
    if (lastActiveAt > cutoff) {
      return session;
    }

    archivedCount += 1;
    return {
      ...session,
      isArchived: true,
      updatedAt: now,
      version: Math.max(1, session.version) + 1,
    };
  });

  if (archivedCount !== 0) {
    await saveSessions(updatedSessions);
  }

  return archivedCount;
}

async function handleReminderAlarm(tabId: string): Promise<void> {
  const { sessions, settings } = await loadRuntimeData();
  if (!settings.remindersEnabled) {
    return;
  }

  const session = sessions.find((item) => item.tabs.some((tab) => tab.id === tabId));
  const tab = session?.tabs.find((item) => item.id === tabId);
  if (!session || !tab || tab.reminderDismissed) {
    return;
  }

  const dueAt = tab.reminderSnoozedUntil ?? tab.reminderAt;
  if (!dueAt || dueAt > Date.now() + 1000) {
    return;
  }

  await createNotification(`tabsetu-reminder-${tab.id}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: tab.title || "Saved tab reminder",
    message: `From "${session.name}"`,
    priority: 2,
    buttons: [{ title: "Open tab" }, { title: "Snooze 1h" }],
  });
}

async function updateReminderTab(
  tabId: string,
  updater: (tab: Session["tabs"][number]) => Session["tabs"][number]
): Promise<Session["tabs"][number] | null> {
  const { sessions } = await loadRuntimeData();
  let updatedTab: Session["tabs"][number] | null = null;
  const updatedSessions = sessions.map((session) => {
    if (!session.tabs.some((tab) => tab.id === tabId)) {
      return session;
    }

    return {
      ...session,
      tabs: session.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }
        updatedTab = updater(tab);
        return updatedTab;
      }),
      updatedAt: Date.now(),
      version: Math.max(1, session.version) + 1,
    };
  });

  await saveSessions(updatedSessions);
  return updatedTab;
}

async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === KEEPALIVE_ALARM) {
    return;
  }

  if (alarm.name === AUTO_SYNC_UPLOAD_ALARM_NAME) {
    await useSyncStore.getState().refreshStatus();
    await flushPendingAutoSyncUpload();
    return;
  }

  if (alarm.name === TIMEZONE_CHECK_ALARM_NAME) {
    await rehydrateAlarmsAfterTimezoneChange();
    return;
  }

  if (alarm.name === AUTO_ARCHIVE_ALARM_NAME) {
    await runAutoArchive();
    return;
  }

  if (alarm.name.startsWith("reminder_")) {
    await handleReminderAlarm(alarm.name.replace("reminder_", ""));
    await updateBadge();
    await maybeStartKeepalive();
    return;
  }

  if (!alarm.name.startsWith("schedule_")) {
    return;
  }

  const scheduleId = alarm.name.replace("schedule_", "");
  const { schedules, sessions, settings } = await loadRuntimeData();

  if (!settings.schedulesEnabled) {
    return;
  }

  const schedule = schedules.find((item) => item.id === scheduleId);
  if (!schedule || !schedule.enabled) {
    return;
  }

  const session = sessions.find((item) => item.id === schedule.sessionId);
  if (!session || session.tabs.length === 0) {
    await handleScheduleWithoutOpenableTabs(schedule, schedules, alarm.name);
    return;
  }

  const now = new Date();
  if (!scheduleMatchesToday(schedule, now)) {
    await createScheduleAlarm(schedule, now);
    return;
  }

  const urls = session.tabs.map((tab) => tab.url).filter(isValidUrl);
  if (urls.length === 0) {
    await handleScheduleWithoutOpenableTabs(schedule, schedules, alarm.name);
    return;
  }

  let openedCount = 0;
  try {
    const result = await openSessionTabsDetailed(session, true);
    openedCount = result.openedCount;
    if (result.failedTabs.length > 0 || result.warnings.length > 0) {
      throw new Error(
        `${result.failedTabs.length} tabs failed and ${result.warnings.length} restore warnings occurred.`
      );
    }
  } catch (error) {
    const failedAt = Date.now();
    if (schedule.type === "once") {
      if (openedCount === 0) {
        await chrome.alarms.create(alarm.name, { when: failedAt + 5 * 60 * 1000 });
      } else {
        await saveSchedules(
          schedules.map((item) =>
            item.id === schedule.id
              ? { ...item, enabled: false, lastFiredAt: failedAt, updatedAt: failedAt }
              : item
          )
        );
      }
    } else {
      const nextSchedule =
        openedCount === 0 ? schedule : { ...schedule, lastFiredAt: failedAt, updatedAt: failedAt };
      if (openedCount !== 0) {
        await saveSchedules(
          schedules.map((item) => (item.id === schedule.id ? nextSchedule : item))
        );
      }
      await createScheduleAlarm(nextSchedule, new Date(failedAt + 1000));
    }

    try {
      await createNotification(`tabsetu-schedule-error-${schedule.id}-${failedAt}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: `TabSetu could not fully open "${session.name}"`,
        message:
          openedCount === 0
            ? "No tabs were opened. TabSetu will retry or wait for the next occurrence."
            : `${openedCount} of ${urls.length} tabs opened. The schedule was advanced safely.`,
      });
    } catch {
      // The schedule has already been reconciled; notifications are best effort.
    }
    console.error("[TabSetu] Scheduled session open failed:", error);
    return;
  }
  await notifyScheduledSessionOpened(session, openedCount);

  const openedAt = Date.now();
  const updatedSessions = sessions.map((item) =>
    item.id === session.id
      ? {
          ...item,
          openCount: (item.openCount ?? 0) + 1,
          lastOpenedAt: openedAt,
          updatedAt: openedAt,
          tabs: item.tabs.map((tab) => ({
            ...tab,
            openCount: (tab.openCount ?? 0) + 1,
            lastOpenedAt: openedAt,
          })),
          version: Math.max(1, item.version) + 1,
        }
      : item
  );

  if (schedule.type === "once") {
    const updatedSchedules = schedules.map((item) =>
      item.id === schedule.id
        ? { ...item, enabled: false, lastFiredAt: openedAt, updatedAt: openedAt }
        : item
    );
    await saveSessions(updatedSessions);
    await saveSchedules(updatedSchedules);
    await chrome.alarms.clear(alarm.name);
    await updateBadge();
    return;
  }

  const updatedSchedules = schedules.map((item) =>
    item.id === schedule.id ? { ...item, lastFiredAt: openedAt, updatedAt: openedAt } : item
  );
  await saveSessions(updatedSessions);
  await saveSchedules(updatedSchedules);
  await createScheduleAlarm(
    { ...schedule, lastFiredAt: openedAt, updatedAt: openedAt },
    new Date(openedAt + 1000)
  );
  await updateBadge();
}

function registerReminderNotificationButtons(): void {
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (!notificationId.startsWith("tabsetu-reminder-")) {
      return;
    }

    const tabId = notificationId.replace("tabsetu-reminder-", "");
    if (buttonIndex === 0) {
      void updateReminderTab(tabId, (tab) => ({ ...tab, reminderDismissed: true })).then(
        async (tab) => {
          if (tab?.url && isValidUrl(tab.url)) {
            await openSavedTab(tab);
          }
          await clearNotification(notificationId);
          await updateBadge();
          await maybeStartKeepalive();
        }
      );
      return;
    }

    if (buttonIndex === 1) {
      const snoozedUntil = Date.now() + 60 * 60 * 1000;
      void updateReminderTab(tabId, (tab) => ({
        ...tab,
        reminderSnoozedUntil: snoozedUntil,
        reminderDismissed: false,
      })).then(async () => {
        const name = reminderAlarmName(tabId);
        await chrome.alarms.clear(name);
        await chrome.alarms.create(name, { when: snoozedUntil });
        await clearNotification(notificationId);
        await updateBadge();
        await maybeStartKeepalive();
      });
    }
  });
}

export function registerAlarmListeners(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEYS.settings]) {
      const nextSettings: unknown = changes[STORAGE_KEYS.settings].newValue;
      if (nextSettings) {
        useSettingsStore.setState({ settings: nextSettings as Settings });
      }
      void hydrateAlarms();
      return;
    }

    if (areaName !== "local") {
      return;
    }

    if (
      changes[STORAGE_KEYS.sessions] ||
      Object.keys(changes).some((key) => key.startsWith(STORAGE_KEYS.sessionsChunkPrefix))
    ) {
      void updateBadge();
      void maybeStartKeepalive();
    }
  });

  registerReminderNotificationButtons();

  chrome.alarms.onAlarm.addListener((alarm) => {
    void handleAlarm(alarm);
  });
}
