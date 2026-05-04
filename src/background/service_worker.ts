import type { Schedule, Session, Settings, UndoCollapseBuffer } from "@/types";
import { chromeTabToTabItem, generateId, isRestrictedUrl } from "@/lib/tabHelpers";
import { saveUndoBuffer } from "@/lib/storage";

const LAST_BROWSER_TAB_KEY = "tabnestLastBrowserTab";

interface StoredBrowserTab {
  tabId: number;
  updatedAt: number;
}

type TrackableTab = chrome.tabs.Tab & { id: number; url: string };

function alarmName(scheduleId: string): string {
  return `tabnest-alarm-${scheduleId}`;
}

function sessionStorageGet<T>(keys: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(result as T);
    });
  });
}

function sessionStorageSet(value: object): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve();
    });
  });
}

function isTrackableTab(tab: chrome.tabs.Tab | undefined | null): tab is TrackableTab {
  return Boolean(tab?.id && tab.url && !isRestrictedUrl(tab.url));
}

async function storeBrowserTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!isTrackableTab(tab)) {
    return;
  }

  await sessionStorageSet({
    [LAST_BROWSER_TAB_KEY]: {
      tabId: tab.id,
      updatedAt: Date.now(),
    } satisfies StoredBrowserTab,
  });
}

async function clearStoredBrowserTab(tabId?: number): Promise<void> {
  const result = await sessionStorageGet<Record<string, StoredBrowserTab | undefined>>([LAST_BROWSER_TAB_KEY]);
  const current = result[LAST_BROWSER_TAB_KEY];
  if (!current) {
    return;
  }

  if (typeof tabId === "number" && current.tabId !== tabId) {
    return;
  }

  await sessionStorageSet({ [LAST_BROWSER_TAB_KEY]: null });
}

async function rememberBrowserTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isTrackableTab(tab)) {
      await storeBrowserTab(tab);
      return;
    }
  } catch {
    // Ignore stale tab errors and clear any matching tracked state below.
  }

  await clearStoredBrowserTab(tabId);
}

async function resolveTrackedBrowserTab(): Promise<chrome.tabs.Tab | null> {
  const result = await sessionStorageGet<Record<string, StoredBrowserTab | undefined>>([LAST_BROWSER_TAB_KEY]);
  const tracked = result[LAST_BROWSER_TAB_KEY];

  if (!tracked?.tabId) {
    return null;
  }

  try {
    const tab = await chrome.tabs.get(tracked.tabId);
    if (isTrackableTab(tab)) {
      return tab;
    }
  } catch {
    // Ignore stale tab lookup failures and clear the tracked state below.
  }

  await clearStoredBrowserTab(tracked.tabId);
  return null;
}

async function findFallbackBrowserTab(): Promise<chrome.tabs.Tab | null> {
  const activeTabs = await chrome.tabs.query({ active: true });
  const activeCandidate = activeTabs.find((tab) => isTrackableTab(tab));
  if (activeCandidate) {
    await storeBrowserTab(activeCandidate);
    return activeCandidate;
  }

  const allTabs = await chrome.tabs.query({});
  const fallback = allTabs.find((tab) => isTrackableTab(tab));
  if (fallback) {
    await storeBrowserTab(fallback);
    return fallback;
  }

  return null;
}

async function resolvePreferredBrowserTab(): Promise<chrome.tabs.Tab | null> {
  const tracked = await resolveTrackedBrowserTab();
  if (tracked) {
    return tracked;
  }

  return findFallbackBrowserTab();
}

async function notifyScheduledSessionOpened(session: Session, tabCount: number): Promise<void> {
  try {
    await chrome.notifications.create(`tabnest-schedule-${session.id}-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: `TabNest opened "${session.name}"`,
      message: `${tabCount} ${tabCount === 1 ? "tab is" : "tabs are"} ready in a new window.`,
      priority: 2,
    });
  } catch {
    // Ignore notification failures so the scheduled open still succeeds.
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

async function loadRuntimeData(): Promise<{
  schedules: Schedule[];
  sessions: Session[];
  settings: Settings;
}> {
  const data = await chrome.storage.local.get(["schedules", "sessions", "settings"]);
  return {
    schedules: Array.isArray(data.schedules) ? (data.schedules as Schedule[]) : [],
    sessions: Array.isArray(data.sessions) ? (data.sessions as Session[]) : [],
    settings: (data.settings ?? {}) as Settings,
  };
}

async function hydrateAlarms(): Promise<void> {
  const { schedules, settings } = await loadRuntimeData();

  if (!settings.schedulesEnabled) {
    await chrome.alarms.clearAll();
    return;
  }

  await chrome.alarms.clearAll();

  for (const schedule of schedules) {
    if (!schedule.enabled) {
      continue;
    }

    const [hours, minutes] = schedule.time.split(":").map(Number);
    const next = new Date();

    if (schedule.type === "once" && schedule.date) {
      const target = new Date(`${schedule.date}T${schedule.time}:00`);
      if (target > new Date()) {
        chrome.alarms.create(alarmName(schedule.id), {
          delayInMinutes: Math.max((target.getTime() - Date.now()) / 60000, 1),
        });
      }
      continue;
    }

    next.setHours(hours, minutes, 0, 0);
    if (next <= new Date()) {
      next.setDate(next.getDate() + 1);
    }

    chrome.alarms.create(alarmName(schedule.id), {
      delayInMinutes: Math.max((next.getTime() - Date.now()) / 60000, 1),
      periodInMinutes: 24 * 60,
    });
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void rememberBrowserTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) {
    return;
  }

  if (changeInfo.url || changeInfo.status === "complete") {
    void rememberBrowserTab(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearStoredBrowserTab(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  void chrome.tabs
    .query({ windowId, active: true })
    .then((tabs) => {
      const [activeTab] = tabs;
      if (activeTab?.id) {
        return rememberBrowserTab(activeTab.id);
      }

      return Promise.resolve();
    })
    .catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "tabnest:get-preferred-browser-tab") {
    return undefined;
  }

  void resolvePreferredBrowserTab()
    .then((tab) => sendResponse(tab))
    .catch(() => sendResponse(null));

  return true;
});

async function createSessionFromWindow(mode: "save" | "collapse"): Promise<void> {
  const { sessions, settings } = await loadRuntimeData();
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const eligibleTabs = tabs.filter((tab) => {
    if (!tab.url || isRestrictedUrl(tab.url)) {
      return false;
    }

    if (mode === "collapse" && !settings.collapseIncludesPinned && tab.pinned) {
      return false;
    }

    return true;
  });

  if (eligibleTabs.length === 0) {
    return;
  }

  const createdAt = Date.now();
  const sessionName = `${mode === "collapse" ? "Collapse" : "Session"} ${new Date(createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const session: Session = {
    id: generateId("session"),
    name: sessionName,
    description: "",
    folderId: null,
    tagIds: [],
    tabs: eligibleTabs.map(chromeTabToTabItem),
    note: "",
    color: null,
    icon: null,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };

  await chrome.storage.local.set({ sessions: [session, ...sessions] });

  if (mode === "collapse") {
    const tabIds = eligibleTabs
      .map((tab) => tab.id)
      .filter((tabId): tabId is number => typeof tabId === "number");
    const buffer: UndoCollapseBuffer = {
      sessionId: session.id,
      sessionName: session.name,
      tabs: session.tabs,
      windowId: eligibleTabs[0]?.windowId ?? null,
      createdAt,
      expiresAt: createdAt + 10000,
    };
    await saveUndoBuffer(buffer);
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "save-current-window") {
    void createSessionFromWindow("save");
  }

  if (command === "collapse-current-window") {
    void createSessionFromWindow("collapse");
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("tabnest-alarm-")) {
    return;
  }

  const scheduleId = alarm.name.replace("tabnest-alarm-", "");
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
    return;
  }

  const now = new Date();
  if (!scheduleMatchesToday(schedule, now)) {
    return;
  }

  const urls = session.tabs.map((tab) => tab.url).filter(Boolean);
  if (urls.length === 0) {
    return;
  }

  const windowRef = await chrome.windows.create({ url: urls[0], focused: true });
  for (const url of urls.slice(1)) {
    await chrome.tabs.create({ windowId: windowRef.id, url });
  }
  await notifyScheduledSessionOpened(session, urls.length);

  const openedAt = Date.now();
  const updatedSessions = sessions.map((item) =>
    item.id === session.id
      ? {
          ...item,
          lastOpenedAt: openedAt,
          updatedAt: openedAt,
          tabs: item.tabs.map((tab) => ({ ...tab, lastOpenedAt: openedAt })),
          version: Math.max(1, item.version) + 1,
        }
      : item,
  );

  if (schedule.type === "once") {
    const updatedSchedules = schedules.map((item) =>
      item.id === schedule.id ? { ...item, enabled: false, updatedAt: openedAt } : item,
    );
    await chrome.storage.local.set({
      sessions: updatedSessions,
      schedules: updatedSchedules,
    });
    await chrome.alarms.clear(alarm.name);
    return;
  }

  await chrome.storage.local.set({ sessions: updatedSessions });
});

chrome.runtime.onInstalled.addListener(() => {
  void hydrateAlarms();
  void findFallbackBrowserTab();
});

chrome.runtime.onStartup.addListener(() => {
  void hydrateAlarms();
  void findFallbackBrowserTab();
});
