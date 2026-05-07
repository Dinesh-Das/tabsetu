import type { Schedule, Session, Settings, ShareSnapshot, StorageData, TabItem, UndoCollapseBuffer } from "@/types";
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
  saveSchedules,
  saveSessions,
  saveUndoBuffer,
  COLLAPSE_UNDO_MS,
} from "@/lib/storage";

const LAST_BROWSER_TAB_KEY = "tabsetuLastBrowserTab";

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

function alarmName(scheduleId: string): string {
  return `schedule_${scheduleId}`;
}

function reminderAlarmName(tabId: string): string {
  return `reminder_${tabId}`;
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
    await chrome.notifications.create(`tabsetu-schedule-${session.id}-${Date.now()}`, {
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

  if (settings.schedulesEnabled) {
    for (const schedule of schedules) {
      if (!schedule.enabled) {
        continue;
      }
      await createScheduleAlarm(schedule);
    }
  }

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
  if (message?.type === "tabsetu:get-preferred-browser-tab") {
    void resolvePreferredBrowserTab()
      .then((tab) => sendResponse(tab))
      .catch(() => sendResponse(null));

    return true;
  }

  if (message?.type === "tabsetu:open-url" && typeof message.url === "string") {
    void chrome.tabs
      .create({ url: message.url })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));

    return true;
  }

  if (message?.type === "tabsetu:open-dashboard") {
    const view = typeof message.view === "string" && message.view.trim() ? `?view=${encodeURIComponent(message.view)}` : "";
    void chrome.tabs
      .create({ url: chrome.runtime.getURL(`src/dashboard/index.html${view}`) })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));

    return true;
  }

  if (message?.type === "IMPORT_SHARED_SESSION") {
    const snapshot = typeof message === "object" && message !== null && "snapshot" in message
      ? (message as { snapshot?: unknown }).snapshot
      : null;

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
  const savedTabs = await Promise.all(
    eligibleTabs.map((tab, index) => chromeTabToTabItemWithFavicon(tab, index)),
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
}

async function openSavePrompt(mode: "save" | "collapse"): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const params = new URLSearchParams({
    view: "home",
    saveMode: mode,
  });

  if (typeof activeTab?.id === "number") {
    params.set("sourceTabId", String(activeTab.id));
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/dashboard/index.html?${params.toString()}`) });
}

function isShareSnapshot(value: unknown): value is ShareSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<ShareSnapshot>;
  return (
    snapshot.v === 1 &&
    typeof snapshot.name === "string" &&
    typeof snapshot.description === "string" &&
    typeof snapshot.createdAt === "number" &&
    Array.isArray(snapshot.tabs) &&
    snapshot.tabs.every(
      (tab) =>
        typeof tab === "object" &&
        tab !== null &&
        typeof tab.title === "string" &&
        typeof tab.url === "string",
    )
  );
}

function snapshotTabToTabItem(tab: ShareSnapshot["tabs"][number], position: number): TabItem | null {
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

function buildOverlayPayload(data: StorageData): OverlayPayload {
  const { settings } = data;
  const folderMap = new Map(data.folders.map((folder) => [folder.id, folder.name]));
  const tagMap = new Map(data.tags.map((tag) => [tag.id, tag.name]));
  const rows: OverlaySearchRow[] = data.sessions.flatMap((session) => {
    const folderName = session.folderId ? folderMap.get(session.folderId) ?? "" : "";
    const tagNames = session.tagIds.map((id) => tagMap.get(id) ?? "").filter(Boolean).join(" ");
    const sessionRows: OverlaySearchRow[] = session.tabs[0]?.url
      ? [{
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
        }]
      : [];
    const tabRows: OverlaySearchRow[] = session.tabs.map((tab) => ({
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
    })).filter((row) => row.action.url);
    return [...sessionRows, ...tabRows];
  });
  rows.push(
    ...data.standaloneNotes.map((note) => ({
      id: `note-${note.id}`,
      kind: "note" as const,
      title: note.title || "Untitled Note",
      subtitle: note.content.trim() ? note.content.trim().slice(0, 120) : "Open the Notes view in TabSetu.",
      action: { kind: "dashboard" as const, view: "notes" as const },
      noteTitle: note.title,
      noteContent: note.content,
    })),
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

  const granted = await chrome.permissions.request({ origins: ["*://*/*"] });
  if (!granted) {
    return;
  }

  try {
    await chrome.scripting.registerContentScripts([{
      id: "tabsetu-search-overlay",
      matches: ["*://*/*"],
      js: ["src/content/searchOverlay.js"],
      runAt: "document_idle",
      persistAcrossSessions: true,
    }]);
  } catch {
    // Already registered.
  }

  const payload = buildOverlayPayload(data);
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
      .filter((command) => command.name && command.name in EXPECTED_COMMAND_SHORTCUTS && !command.shortcut)
      .map((command) => EXPECTED_COMMAND_SHORTCUTS[command.name as keyof typeof EXPECTED_COMMAND_SHORTCUTS]);

    if (unassigned.length === 0) {
      return;
    }

    await chrome.notifications.create(`tabsetu-shortcuts-${Date.now()}`, {
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

chrome.runtime.onInstalled.addListener(() => {
  void notifyUnassignedCommandShortcuts();
});

chrome.runtime.onStartup.addListener(() => {
  void notifyUnassignedCommandShortcuts();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-search-overlay") {
    void openSearchOverlay();
  }

  if (command === "save-current-window") {
    void openSavePrompt("save");
  }

  if (command === "collapse-current-window") {
    void openSavePrompt("collapse");
  }

  if (command === "open-dashboard") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") });
  }
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

  await chrome.notifications.create(`tabsetu-reminder-${tab.id}`, {
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
  updater: (tab: Session["tabs"][number]) => Session["tabs"][number],
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
    void updateReminderTab(tabId, (tab) => ({ ...tab, reminderDismissed: true })).then((tab) => {
      if (tab?.url) {
        void chrome.tabs.create({ url: tab.url });
      }
      void chrome.notifications.clear(notificationId);
    });
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
      void chrome.notifications.clear(notificationId);
    });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("tabsetu-schedule-")) {
    void chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("reminder_")) {
    await handleReminderAlarm(alarm.name.replace("reminder_", ""));
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
      : item,
  );

  if (schedule.type === "once") {
    const updatedSchedules = schedules.map((item) =>
      item.id === schedule.id ? { ...item, enabled: false, lastFiredAt: openedAt, updatedAt: openedAt } : item,
    );
    await saveSessions(updatedSessions);
    await saveSchedules(updatedSchedules);
    await chrome.alarms.clear(alarm.name);
    return;
  }

  const updatedSchedules = schedules.map((item) =>
    item.id === schedule.id ? { ...item, lastFiredAt: openedAt, updatedAt: openedAt } : item,
  );
  await saveSessions(updatedSessions);
  await saveSchedules(updatedSchedules);
  await createScheduleAlarm({ ...schedule, lastFiredAt: openedAt, updatedAt: openedAt }, new Date(openedAt + 1000));
});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === "install") {
      await initializeStorageForInstall();
    } else {
      await loadStorage();
    }

    await hydrateAlarms();
    await findFallbackBrowserTab();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void hydrateAlarms();
  void findFallbackBrowserTab();
});
