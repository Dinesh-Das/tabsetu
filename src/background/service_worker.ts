import type { Schedule, Session, Settings, UndoCollapseBuffer } from "@/types";
import { chromeTabToTabItem, generateId, isRestrictedUrl } from "@/lib/tabHelpers";
import {
  initializeStorageForInstall,
  loadStorage,
  saveSchedules,
  saveSessions,
  saveUndoBuffer,
} from "@/lib/storage";

const LAST_BROWSER_TAB_KEY = "tabsetuLastBrowserTab";

interface StoredBrowserTab {
  tabId: number;
  updatedAt: number;
}

type TrackableTab = chrome.tabs.Tab & { id: number; url: string };

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

  if (!settings.remindersEnabled) {
    return;
  }

  for (const session of sessions) {
    for (const tab of session.tabs) {
      const dueAt = tab.reminderSnoozedUntil ?? tab.reminderAt;
      if (!dueAt || tab.reminderDismissed) {
        continue;
      }

      chrome.alarms.create(reminderAlarmName(tab.id), {
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
  const session: Session = {
    id: generateId("session"),
    name: sessionName,
    description: "",
    folderId: null,
    groupId: null,
    tagIds: [],
    tabs: eligibleTabs.map((tab, index) => chromeTabToTabItem(tab, index)),
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
      expiresAt: createdAt + 10000,
    };
    await saveUndoBuffer(buffer);
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
  }
}

function mountTabSetuSearchOverlay(): void {
  const hostId = "tabsetu-search-overlay-host";
  const existing = document.getElementById(hostId);
  if (existing?.shadowRoot) {
    const input = existing.shadowRoot.querySelector("input");
    input?.focus();
    return;
  }

  const host = document.createElement("div");
  host.id = hostId;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: start center;
        padding: 10vh 18px 18px;
        background: rgba(8, 13, 24, 0.42);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel {
        width: min(720px, calc(100vw - 36px));
        max-height: min(680px, 78vh);
        overflow: hidden;
        border: 1px solid rgba(149, 166, 196, 0.34);
        border-radius: 12px;
        background: #f9fbff;
        color: #101828;
        box-shadow: 0 28px 72px rgba(4, 10, 22, 0.28);
      }
      .search { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #d9e2f0; }
      input {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: #101828;
        font: 600 16px/1.4 inherit;
      }
      input::placeholder { color: #667085; }
      .results { max-height: min(560px, 63vh); overflow: auto; padding: 8px; }
      .item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        width: 100%;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 11px 12px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .item[aria-selected="true"] { background: #e8f7fb; border-color: #84d8ea; }
      .title { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .meta { margin-top: 3px; color: #667085; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .kind { align-self: start; border-radius: 999px; padding: 4px 8px; background: #eef2f7; color: #475467; font-size: 11px; font-weight: 700; }
      .empty { padding: 28px 18px; color: #667085; text-align: center; font-size: 13px; }
      @media (prefers-color-scheme: dark) {
        .panel { background: #101828; color: #f8fbff; border-color: rgba(149, 166, 196, 0.28); }
        .search { border-color: #243044; }
        input { color: #f8fbff; }
        input::placeholder, .meta, .empty { color: #98a2b3; }
        .item[aria-selected="true"] { background: rgba(20, 184, 166, 0.14); border-color: rgba(20, 184, 166, 0.4); }
        .kind { background: #1d2939; color: #d0d5dd; }
      }
    </style>
    <div class="backdrop" role="presentation">
      <section class="panel" role="dialog" aria-modal="true" aria-label="TabSetu search">
        <div class="search">
          <input autocomplete="off" placeholder="Search saved sessions, tabs, notes, folders, or tags" aria-label="Search TabSetu" />
        </div>
        <div class="results" role="listbox"></div>
      </section>
    </div>
  `;

  type OverlayRow = {
    id: string;
    kind: "session" | "tab";
    title: string;
    subtitle: string;
    url: string | null;
    haystack: string;
  };
  type StoredFolder = { id: string; name: string };
  type StoredTag = { id: string; name: string };
  type StoredTab = { id: string; title?: string; url?: string; note?: string };
  type StoredSession = {
    id: string;
    name?: string;
    description?: string;
    note?: string;
    folderId?: string | null;
    tagIds?: string[];
    tabs?: StoredTab[];
  };

  const input = shadow.querySelector("input") as HTMLInputElement;
  const resultsNode = shadow.querySelector(".results") as HTMLDivElement;
  const backdrop = shadow.querySelector(".backdrop") as HTMLDivElement;
  let rows: OverlayRow[] = [];
  let visibleRows: OverlayRow[] = [];
  let selectedIndex = 0;

  const removeOverlay = () => host.remove();
  const normalize = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");
  const scoreRow = (row: OverlayRow, query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return 1;
    }

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const haystack = row.haystack.toLowerCase();
    if (tokens.every((token) => haystack.includes(token))) {
      return tokens.reduce((score, token) => score + Math.max(1, 40 - haystack.indexOf(token)), 0);
    }

    let cursor = 0;
    let fuzzyScore = 0;
    for (const char of normalizedQuery) {
      const next = haystack.indexOf(char, cursor);
      if (next === -1) {
        return 0;
      }
      fuzzyScore += Math.max(1, 16 - (next - cursor));
      cursor = next + 1;
    }
    return fuzzyScore;
  };

  const render = () => {
    resultsNode.textContent = "";
    if (visibleRows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = input.value.trim() ? "No saved tabs match that search." : "Start typing to search TabSetu.";
      resultsNode.appendChild(empty);
      return;
    }

    visibleRows.slice(0, 12).forEach((row, index) => {
      const item = document.createElement("button");
      item.className = "item";
      item.type = "button";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === selectedIndex));
      item.innerHTML = `
        <span>
          <span class="title"></span>
          <span class="meta"></span>
        </span>
        <span class="kind">${row.kind === "session" ? "Session" : "Tab"}</span>
      `;
      (item.querySelector(".title") as HTMLSpanElement).textContent = row.title;
      (item.querySelector(".meta") as HTMLSpanElement).textContent = row.subtitle;
      item.addEventListener("mouseenter", () => {
        selectedIndex = index;
        render();
      });
      item.addEventListener("click", () => {
        void openSelected(row);
      });
      resultsNode.appendChild(item);
    });
  };

  const updateVisibleRows = () => {
    const query = input.value.trim();
    visibleRows = rows
      .map((row) => ({ row, score: scoreRow(row, query) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.row);
    selectedIndex = Math.min(selectedIndex, Math.max(visibleRows.length - 1, 0));
    render();
  };

  const openSelected = async (row: OverlayRow | undefined) => {
    if (!row?.url) {
      return;
    }
    await chrome.runtime.sendMessage({ type: "tabsetu:open-url", url: row.url });
    removeOverlay();
  };

  chrome.storage.local.get(
    ["TabSetu_sessions", "TabSetu_folders", "TabSetu_tags", "sessions", "folders", "tags"],
    (data) => {
      const sessions = Array.isArray(data.TabSetu_sessions) ? data.TabSetu_sessions : data.sessions;
      const folders = Array.isArray(data.TabSetu_folders) ? data.TabSetu_folders : data.folders;
      const tags = Array.isArray(data.TabSetu_tags) ? data.TabSetu_tags : data.tags;
      const folderList = (Array.isArray(folders) ? folders : []) as StoredFolder[];
      const tagList = (Array.isArray(tags) ? tags : []) as StoredTag[];
      const sessionList = (Array.isArray(sessions) ? sessions : []) as StoredSession[];
      const folderMap = new Map(folderList.map((folder) => [folder.id, folder.name]));
      const tagMap = new Map(tagList.map((tag) => [tag.id, tag.name]));

      rows = sessionList.flatMap((session) => {
        const folderName = session.folderId ? folderMap.get(session.folderId) ?? "" : "";
        const tagNames = Array.isArray(session.tagIds)
          ? session.tagIds.map((id: string) => tagMap.get(id) ?? "").join(" ")
          : "";
        const sessionRow: OverlayRow = {
          id: session.id,
          kind: "session",
          title: session.name || "Untitled Session",
          subtitle: `${Array.isArray(session.tabs) ? session.tabs.length : 0} tabs ${folderName ? `in ${folderName}` : ""}`.trim(),
          url: Array.isArray(session.tabs) && session.tabs[0]?.url ? session.tabs[0].url : null,
          haystack: [
            normalize(session.name),
            normalize(session.description),
            normalize(session.note),
            normalize(folderName),
            normalize(tagNames),
          ].join(" "),
        };
        const tabRows: OverlayRow[] = (Array.isArray(session.tabs) ? session.tabs : []).map((tab) => ({
          id: `${session.id}-${tab.id}`,
          kind: "tab",
          title: tab.title || "Untitled Tab",
          subtitle: [session.name || "Session", tab.url || ""].filter(Boolean).join(" - "),
          url: tab.url || null,
          haystack: [
            normalize(tab.title),
            normalize(tab.url),
            normalize(tab.note),
            normalize(session.name),
            normalize(session.description),
            normalize(session.note),
            normalize(folderName),
            normalize(tagNames),
          ].join(" "),
        }));
        return [sessionRow, ...tabRows];
      });
      updateVisibleRows();
    },
  );

  input.addEventListener("input", updateVisibleRows);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      removeOverlay();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, Math.max(visibleRows.length - 1, 0));
      render();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      render();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void openSelected(visibleRows[selectedIndex]);
    }
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      removeOverlay();
    }
  });
  input.focus();
}

async function openSearchOverlay(): Promise<void> {
  const { settings } = await loadRuntimeData();
  if (!settings.searchOverlayEnabled) {
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !activeTab.url || isRestrictedUrl(activeTab.url)) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: mountTabSetuSearchOverlay,
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-search-overlay") {
    void openSearchOverlay();
  }

  if (command === "save-current-window") {
    void createSessionFromWindow("save");
  }

  if (command === "collapse-current-window") {
    void createSessionFromWindow("collapse");
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
    })).then(() => {
      chrome.alarms.create(reminderAlarmName(tabId), { when: snoozedUntil });
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
