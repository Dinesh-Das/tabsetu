import type {
  Schedule,
  Session,
  Settings,
  ShareSnapshot,
  StorageData,
  TabItem,
  UndoCollapseBuffer,
} from "@/types";
import type { OverlaySearchRow } from "@/lib/overlaySearch";
import { nextMatchingDate } from "@/lib/alarmScheduling";
import {
  chromeTabToTabItemWithFavicon,
  clampText,
  generateId,
  isRestrictedUrl,
  isValidUrl,
  sanitizeLabel,
  stripHtml,
} from "@/lib/tabHelpers";
import {
  initializeStorageForInstall,
  loadStorage,
  loadUndoBuffer,
  migrateSettingsToSync,
  saveSchedules,
  saveSessions,
  saveUndoBuffer,
  COLLAPSE_UNDO_MS,
  STORAGE_KEYS,
} from "@/lib/storage";
import { useSettingsStore } from "@/store/settingsStore";
import { useSyncStore } from "@/store/syncStore";

const LAST_BROWSER_TAB_KEY = "tabsetuLastBrowserTab";
const AUTO_ARCHIVE_ALARM_NAME = "tabsetu-auto-archive";
const TIMEZONE_CHECK_ALARM_NAME = "tabsetu-timezone-check";
const TIMEZONE_OFFSET_KEY = "TabSetu_timezone_offset_minutes";
const KEEPALIVE_ALARM = "tabsetu-keepalive";
const REMINDER_WINDOW_MINUTES = 5;
const transientStorage = chrome.storage.session ?? chrome.storage.local;

interface StoredBrowserTab {
  tabId: number;
  updatedAt: number;
}

type TrackableTab = chrome.tabs.Tab & { id: number; url: string };

type OverlayPayload = {
  rows: OverlaySearchRow[];
  searchScopes: Settings["searchScopes"];
  fuzzySearchThreshold: number;
};

type SessionCaptureResult = {
  session: Session;
  tabCount: number;
  mode: "save" | "collapse";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createNotification(
  notificationId: string,
  options: chrome.notifications.NotificationOptions<true>
): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.notifications.create(notificationId, options, (createdId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(createdId);
    });
  });
}

function clearNotification(notificationId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.notifications.clear(notificationId, (wasCleared) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(wasCleared);
    });
  });
}

function alarmName(scheduleId: string): string {
  return `schedule_${scheduleId}`;
}

function reminderAlarmName(tabId: string): string {
  return `reminder_${tabId}`;
}

async function updateBadge(): Promise<void> {
  const { sessions } = await loadRuntimeData();
  const pending = sessions.reduce(
    (count, session) =>
      count +
      session.tabs.filter(
        (tab) => Boolean(tab.reminderAt ?? tab.reminderSnoozedUntil) && !tab.reminderDismissed
      ).length,
    0
  );

  if (pending === 0) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  await chrome.action.setBadgeText({ text: String(pending) });
  await chrome.action.setBadgeBackgroundColor({ color: "#E24B4A" });
  await chrome.action.setBadgeTextColor?.({ color: "#FFFFFF" });
}

async function maybeStartKeepalive(): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  const now = Date.now();
  const hasImminent = alarms.some(
    (alarm) =>
      alarm.name.startsWith("reminder_") &&
      typeof alarm.scheduledTime === "number" &&
      alarm.scheduledTime - now < REMINDER_WINDOW_MINUTES * 60 * 1000
  );

  if (hasImminent) {
    await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 });
  } else {
    await chrome.alarms.clear(KEEPALIVE_ALARM);
  }
}

function sessionStorageGet<T>(keys: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    transientStorage.get(keys, (result) => {
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
    transientStorage.set(value, () => {
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
  const result = await sessionStorageGet<Record<string, StoredBrowserTab | undefined>>([
    LAST_BROWSER_TAB_KEY,
  ]);
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
  const result = await sessionStorageGet<Record<string, StoredBrowserTab | undefined>>([
    LAST_BROWSER_TAB_KEY,
  ]);
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
    await createNotification(`tabsetu-schedule-${session.id}-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: `TabSetu opened "${session.name}"`,
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

async function hydrateAlarms(): Promise<void> {
  const { schedules, sessions, settings } = await loadRuntimeData();

  await chrome.alarms.clearAll();
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

  if (!settings.remindersEnabled) {
    return;
  }

  for (const session of sessions) {
    for (const tab of session.tabs) {
      const dueAt = tab.reminderSnoozedUntil ?? tab.reminderAt;
      if (!dueAt || tab.reminderDismissed) {
        continue;
      }

      const name = reminderAlarmName(tab.id);
      await chrome.alarms.clear(name);
      await chrome.alarms.create(name, {
        when: Math.max(dueAt, Date.now() + 1000),
      });
    }
  }

  await updateBadge();
  await maybeStartKeepalive();
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

  if (changes[STORAGE_KEYS.sessions]) {
    void updateBadge();
    void maybeStartKeepalive();
  }
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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRecord(message)) {
    return undefined;
  }

  if (message.type === "tabsetu:get-preferred-browser-tab") {
    void resolvePreferredBrowserTab()
      .then((tab) => sendResponse(tab))
      .catch(() => sendResponse(null));

    return true;
  }

  if (message.type === "tabsetu:open-url" && typeof message.url === "string") {
    const url = message.url;
    void chrome.tabs
      .create({ url })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));

    return true;
  }

  if (message.type === "tabsetu:switch-to-tab" && typeof message.tabId === "number") {
    const tabId = message.tabId;
    void chrome.tabs
      .get(tabId)
      .then(async (tab) => {
        if (typeof tab.windowId === "number") {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        await chrome.tabs.update(tabId, { active: true });
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));

    return true;
  }

  if (message.type === "tabsetu:suspend-background-tabs") {
    void suspendBackgroundTabs()
      .then((count) => sendResponse({ ok: true, count }))
      .catch(() => sendResponse({ ok: false, count: 0 }));

    return true;
  }

  if (message.type === "tabsetu:search-history" && typeof message.query === "string") {
    const query = message.query;
    void searchBrowserHistory(query)
      .then((rows) => sendResponse({ ok: true, rows }))
      .catch(() => sendResponse({ ok: false, rows: [] }));

    return true;
  }

  if (message.type === "tabsetu:open-dashboard") {
    const view =
      typeof message.view === "string" && message.view.trim()
        ? `?view=${encodeURIComponent(message.view)}`
        : "";
    void chrome.tabs
      .create({ url: chrome.runtime.getURL(`dashboard.html${view}`) })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));

    return true;
  }

  if (message.type === "IMPORT_SHARED_SESSION") {
    const snapshot = message.snapshot;

    if (!isShareSnapshot(snapshot)) {
      sendResponse({ ok: false });
      return undefined;
    }

    void importSharedSession(snapshot)
      .then((session) => sendResponse({ ok: true, sessionId: session.id }))
      .catch(() => sendResponse({ ok: false }));

    return true;
  }

  return undefined;
});

async function createSessionFromWindow(
  mode: "save" | "collapse"
): Promise<SessionCaptureResult | null> {
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
    return null;
  }

  const createdAt = Date.now();
  const sessionName = `${mode === "collapse" ? "Collapse" : "Session"} ${new Date(
    createdAt
  ).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const savedTabs = await Promise.all(
    eligibleTabs.map((tab, index) => chromeTabToTabItemWithFavicon(tab, index))
  );

  const session: Session = {
    id: generateId("session"),
    name: sessionName,
    description: "",
    folderId: null,
    tagIds: [],
    tabs: savedTabs,
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };

  await saveSessions([session, ...sessions]);

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
      expiresAt: createdAt + COLLAPSE_UNDO_MS,
    };
    await saveUndoBuffer(buffer);
    if (tabIds.length !== 0) {
      await chrome.tabs.remove(tabIds);
    }
  }

  return { session, tabCount: savedTabs.length, mode };
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

function isShareSnapshot(value: unknown): value is ShareSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.v === 1 &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.createdAt === "number" &&
    Array.isArray(value.tabs) &&
    value.tabs.every(
      (tab) => isRecord(tab) && typeof tab.title === "string" && typeof tab.url === "string"
    )
  );
}

function snapshotTabToTabItem(
  tab: ShareSnapshot["tabs"][number],
  position: number
): TabItem | null {
  const url = tab.url.trim();
  if (!isValidUrl(url)) {
    return null;
  }

  const createdAt = Date.now();
  return {
    id: generateId("tab"),
    title: sanitizeLabel(tab.title, "Untitled Tab", 200),
    url,
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position,
    openCount: 0,
    createdAt,
    lastOpenedAt: null,
  };
}

async function importSharedSession(snapshot: ShareSnapshot): Promise<Session> {
  const { sessions } = await loadRuntimeData();
  const createdAt = Date.now();
  const tabs = snapshot.tabs
    .map((tab, index) => snapshotTabToTabItem(tab, index))
    .filter((tab): tab is TabItem => Boolean(tab))
    .map((tab, index) => ({ ...tab, position: index }));

  if (tabs.length === 0) {
    throw new Error("Shared session has no openable tabs.");
  }

  const session: Session = {
    id: generateId("session"),
    name: sanitizeLabel(snapshot.name, "Shared session", 100),
    description: clampText(stripHtml(snapshot.description), 300),
    folderId: null,
    tagIds: [],
    tabs,
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };

  await saveSessions([session, ...sessions]);
  return session;
}

async function restoreLastCollapse(): Promise<boolean> {
  const buffer = await loadUndoBuffer();
  if (!buffer) {
    return false;
  }

  const urls = buffer.tabs.map((tab) => tab.url).filter(Boolean);
  if (urls.length === 0) {
    await saveUndoBuffer(null);
    return false;
  }

  await chrome.windows.create({ url: urls });
  await saveUndoBuffer(null);
  return true;
}

async function suspendBackgroundTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({});
  let discardedCount = 0;

  for (const tab of tabs) {
    if (
      !tab.id ||
      tab.active ||
      tab.discarded ||
      tab.pinned ||
      !tab.url ||
      isRestrictedUrl(tab.url)
    ) {
      continue;
    }

    try {
      await chrome.tabs.discard(tab.id);
      discardedCount += 1;
    } catch {
      // Some tabs cannot be discarded by Chrome; keep going for the rest.
    }
  }

  if (discardedCount !== 0) {
    await createNotification(`tabsetu-suspend-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "TabSetu suspended background tabs",
      message: `${discardedCount} ${discardedCount === 1 ? "tab is" : "tabs are"} now unloaded until selected.`,
      priority: 1,
    });
  }

  return discardedCount;
}

async function searchBrowserHistory(query: string): Promise<OverlaySearchRow[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const results = await chrome.history.search({
    text: trimmed,
    maxResults: 20,
    startTime: Date.now() - 1000 * 60 * 60 * 24 * 90,
  });

  return results
    .filter((item) => item.url && isValidUrl(item.url) && !isRestrictedUrl(item.url))
    .map((item) => ({
      id: `history-${item.id ?? item.url}`,
      kind: "history" as const,
      title: item.title || item.url || "Visited page",
      subtitle: item.url || "",
      action: { kind: "url" as const, url: item.url || "" },
      historyTitle: item.title || item.url || "Visited page",
      historyUrl: item.url || "",
    }));
}

async function buildOverlayPayload(data: StorageData): Promise<OverlayPayload> {
  const { settings } = data;
  const folderMap = new Map(data.folders.map((folder) => [folder.id, folder.name]));
  const tagMap = new Map(data.tags.map((tag) => [tag.id, tag.name]));
  const rows: OverlaySearchRow[] = data.sessions.flatMap((session) => {
    const folderName = session.folderId ? (folderMap.get(session.folderId) ?? "") : "";
    const tagNames = session.tagIds
      .map((id) => tagMap.get(id) ?? "")
      .filter(Boolean)
      .join(" ");
    const sessionRows: OverlaySearchRow[] = session.tabs[0]?.url
      ? [
          {
            id: session.id,
            kind: "session",
            title: session.name || "Untitled Session",
            subtitle: `${session.tabs.length} tabs${folderName ? ` in ${folderName}` : ""}`.trim(),
            action: { kind: "url", url: session.tabs[0].url },
            sessionName: session.name,
            sessionDescription: session.description,
            sessionNote: session.note,
            folderName,
            tagNames,
          },
        ]
      : [];
    const tabRows: OverlaySearchRow[] = session.tabs
      .map((tab) => ({
        id: `${session.id}-${tab.id}`,
        kind: "tab" as const,
        title: tab.title || "Untitled Tab",
        subtitle: [session.name || "Session", tab.url || ""].filter(Boolean).join(" - "),
        action: { kind: "url" as const, url: tab.url },
        sessionName: session.name,
        sessionDescription: session.description,
        sessionNote: session.note,
        folderName,
        tagNames,
        tabTitle: tab.title,
        tabUrl: tab.url,
        tabNote: tab.note,
      }))
      .filter((row) => row.action.url);
    return [...sessionRows, ...tabRows];
  });
  rows.push(
    ...(await chrome.tabs.query({})).filter(isTrackableTab).map((tab) => ({
      id: `active-tab-${tab.id}`,
      kind: "active-tab" as const,
      title: tab.title || "Untitled Tab",
      subtitle: tab.url,
      action: { kind: "switch-tab" as const, tabId: tab.id },
      tabTitle: tab.title || "Untitled Tab",
      tabUrl: tab.url,
    })),
    ...data.standaloneNotes.map((note) => ({
      id: `note-${note.id}`,
      kind: "note" as const,
      title: note.title || "Untitled Note",
      subtitle: note.content.trim()
        ? note.content.trim().slice(0, 120)
        : "Open the Notes view in TabSetu.",
      action: { kind: "dashboard" as const, view: "notes" as const },
      noteTitle: note.title,
      noteContent: note.content,
    }))
  );

  return {
    rows,
    searchScopes: settings.searchScopes,
    fuzzySearchThreshold: settings.fuzzySearchThreshold,
  };
}

async function openSearchOverlay(): Promise<void> {
  const data = await loadStorage();
  const { settings } = data;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !activeTab.url || isRestrictedUrl(activeTab.url)) {
    return;
  }

  if (!settings.searchOverlayEnabled) {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (msg: string) => {
        const existing = document.getElementById("tabsetu-toast-host");
        existing?.remove();
        const host = document.createElement("div");
        host.id = "tabsetu-toast-host";
        document.documentElement.appendChild(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `<style>:host{all:initial}.t{position:fixed;right:18px;bottom:18px;z-index:2147483647;padding:12px 14px;border-radius:12px;background:#101828;color:#f8fbff;font:600 13px/1.4 ui-sans-serif,system-ui,sans-serif;box-shadow:0 18px 48px rgba(4,10,22,.28)}</style><div class="t"></div>`;
        (shadow.querySelector(".t") as HTMLElement).textContent = msg;
        setTimeout(() => host.remove(), 2200);
      },
      args: ["TabSetu search overlay is disabled. Enable it in Settings > Search."],
    });
    return;
  }

  const alreadyGranted = await chrome.permissions.contains({ origins: ["*://*/*"] });
  if (!alreadyGranted) {
    const granted = await chrome.permissions.request({ origins: ["*://*/*"] });
    if (!granted) {
      return;
    }
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: "tabsetu-search-overlay",
        matches: ["*://*/*"],
        js: ["src/content/searchOverlay.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("already registered") && !message.includes("Duplicate script")) {
      console.error("[TabSetu] Failed to register search overlay script:", err);
    }
  }

  const payload = await buildOverlayPayload(data);
  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "tabsetu:open-overlay", payload });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["src/content/searchOverlay.js"],
    });
    await chrome.tabs.sendMessage(activeTab.id, { type: "tabsetu:open-overlay", payload });
  }
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

async function notifySessionCaptured(result: SessionCaptureResult): Promise<void> {
  try {
    await createNotification(`tabsetu-${result.mode}-${result.session.id}-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title:
        result.mode === "collapse" ? "TabSetu collapsed this window" : "TabSetu saved this window",
      message: `"${result.session.name}" - ${result.tabCount} ${result.tabCount === 1 ? "tab" : "tabs"}.`,
      priority: 2,
      ...(result.mode === "collapse" ? { buttons: [{ title: "Undo collapse" }] } : {}),
    });
  } catch {
    // Notification permission/platform quirks should not block the save.
  }
}

const EXPECTED_COMMAND_SHORTCUTS: Record<string, string> = {
  "open-search-overlay": "Ctrl+Shift+F",
  "save-current-window": "Alt+Shift+Y",
  "collapse-current-window": "Alt+Shift+U",
  "open-dashboard": "Alt+Shift+D",
};

function getRegisteredCommands(): Promise<chrome.commands.Command[]> {
  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => resolve(commands));
  });
}

async function notifyUnassignedCommandShortcuts(): Promise<void> {
  try {
    const commands = await getRegisteredCommands();
    const unassigned = commands
      .filter(
        (command) => command.name && command.name in EXPECTED_COMMAND_SHORTCUTS && !command.shortcut
      )
      .map(
        (command) =>
          EXPECTED_COMMAND_SHORTCUTS[command.name as keyof typeof EXPECTED_COMMAND_SHORTCUTS]
      );

    if (unassigned.length === 0) {
      return;
    }

    await createNotification(`tabsetu-shortcuts-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "TabSetu shortcuts need assigning",
      message: `Open chrome://extensions/shortcuts and set: ${unassigned.join(", ")}.`,
      priority: 1,
    });
  } catch {
    // Shortcut diagnostics are best-effort only.
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-search-overlay") {
    void openSearchOverlay();
  }

  if (command === "save-current-window") {
    void createSessionFromWindow("save").then((result) => {
      if (result) {
        void notifySessionCaptured(result);
      }
    });
  }

  if (command === "collapse-current-window") {
    void createSessionFromWindow("collapse").then((result) => {
      if (result) {
        void notifySessionCaptured(result);
        void chrome.action.openPopup?.().catch(() => undefined);
      }
    });
  }

  if (command === "open-dashboard") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  }
});

function registerContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "tabsetu-save-tab",
      title: "Save tab to TabSetu",
      contexts: ["page", "link"],
    });
    chrome.contextMenus.create({
      id: "tabsetu-save-window",
      title: "Save window as TabSetu session",
      contexts: ["page"],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "tabsetu-save-tab" && tab) {
    void storeBrowserTab(tab);
  }

  if (info.menuItemId === "tabsetu-save-window") {
    void createSessionFromWindow("save").then((result) => {
      if (result) {
        void notifySessionCaptured(result);
      }
    });
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (!notificationId.startsWith("tabsetu-collapse-") || buttonIndex !== 0) {
    return;
  }

  void restoreLastCollapse();
});

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

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (!notificationId.startsWith("tabsetu-reminder-")) {
    return;
  }

  const tabId = notificationId.replace("tabsetu-reminder-", "");
  if (buttonIndex === 0) {
    void updateReminderTab(tabId, (tab) => ({ ...tab, reminderDismissed: true })).then(
      async (tab) => {
        if (tab?.url) {
          await chrome.tabs.create({ url: tab.url });
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

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("tabsetu-schedule-")) {
    void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  }
});

async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === KEEPALIVE_ALARM) {
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
    return;
  }

  const now = new Date();
  if (!scheduleMatchesToday(schedule, now)) {
    await createScheduleAlarm(schedule, now);
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

chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm);
});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === "install") {
      await initializeStorageForInstall();
    } else {
      await migrateSettingsToSync();
      await loadStorage();
    }

    registerContextMenus();
    await hydrateAlarms();
    await useSyncStore.getState().refreshStatus();
    if (useSyncStore.getState().enabled) {
      await useSyncStore.getState().pullNow();
    }
    await updateBadge();
    await findFallbackBrowserTab();
    await notifyUnassignedCommandShortcuts();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await hydrateAlarms();
    await useSyncStore.getState().refreshStatus();
    if (useSyncStore.getState().enabled) {
      await useSyncStore.getState().pullNow();
    }
    await updateBadge();
    await findFallbackBrowserTab();
    await notifyUnassignedCommandShortcuts();
  })();
});

void maybeStartKeepalive();
