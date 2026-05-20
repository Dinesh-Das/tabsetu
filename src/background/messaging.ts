import type {
  Session,
  Settings,
  ShareSnapshot,
  StorageData,
  TabItem,
  UndoCollapseBuffer,
} from "@/types";
import type { OverlaySearchRow } from "@/lib/overlaySearch";
import {
  chromeTabToTabItemWithFavicon,
  clampText,
  generateId,
  isRestrictedUrl,
  isValidUrl,
  sanitizeLabel,
  stripHtml,
} from "@/lib/tabHelpers";
import { defaultSavedSessionTitle } from "@/lib/sessionLabels";
import {
  COLLAPSE_UNDO_MS,
  loadStorage,
  saveSessions,
  saveUndoBuffer,
  STORAGE_KEYS,
} from "@/lib/storage";
import {
  notifyBackgroundTabsSuspended,
  notifyCommandProblem,
  notifySessionCaptured,
} from "@/background/notifications";
import { resolvePreferredBrowserTab, storeBrowserTab } from "@/background/tabTracking";
import { getTransientStorage } from "@/lib/browserCompat";

const PENDING_SAVE_KEY = "tabsetuPendingSaveMode";
const SEARCH_OVERLAY_STATE_KEY = "tabsetuSearchOverlayState";

type OverlayPayload = {
  rows: OverlaySearchRow[];
  searchScopes: Settings["searchScopes"];
  fuzzySearchThreshold: number;
  theme: Settings["theme"];
};

type SearchOverlayState = {
  open: boolean;
  updatedAt: number;
};

type SessionCaptureResult = {
  session: Session;
  tabCount: number;
  mode: "save" | "collapse";
};

function movePreferredTabFirst<T>(tabs: T[], preferredIndex: number): T[] {
  if (preferredIndex <= 0) {
    return tabs;
  }

  const preferred = tabs[preferredIndex];
  if (!preferred) {
    return tabs;
  }

  return [preferred, ...tabs.slice(0, preferredIndex), ...tabs.slice(preferredIndex + 1)];
}

async function preferredTitleTabIndex(tabs: chrome.tabs.Tab[]): Promise<number> {
  const activeIndex = tabs.findIndex((tab) => tab.active);
  if (activeIndex >= 0) {
    return activeIndex;
  }

  const preferred = await resolvePreferredBrowserTab().catch(() => null);
  if (typeof preferred?.id !== "number") {
    return -1;
  }

  return tabs.findIndex((tab) => tab.id === preferred.id);
}

let historyPermissionKnown = false;
let historyPermissionGranted = false;
let historyPermissionRequestStarted = false;

const HISTORY_PERMISSION = { permissions: ["history"] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSaveMode(value: unknown): value is "save" | "collapse" {
  return value === "save" || value === "collapse";
}

async function hasHistoryPermission(): Promise<boolean> {
  if (historyPermissionKnown) {
    return historyPermissionGranted;
  }

  if (typeof chrome.history?.search !== "function") {
    historyPermissionKnown = true;
    historyPermissionGranted = false;
    return historyPermissionGranted;
  }

  if (typeof chrome.permissions?.contains !== "function") {
    historyPermissionKnown = true;
    historyPermissionGranted = true;
    return historyPermissionGranted;
  }

  try {
    historyPermissionGranted = await chrome.permissions.contains(HISTORY_PERMISSION);
  } catch {
    historyPermissionGranted = false;
  }
  historyPermissionKnown = true;
  return historyPermissionGranted;
}

function requestHistoryPermissionFromCommand(): void {
  if (historyPermissionGranted || historyPermissionRequestStarted) {
    return;
  }

  historyPermissionRequestStarted = true;
  void (async () => {
    if (await hasHistoryPermission()) {
      historyPermissionRequestStarted = false;
      return;
    }

    if (typeof chrome.permissions?.request !== "function") {
      historyPermissionRequestStarted = false;
      return;
    }

    try {
      chrome.permissions.request(HISTORY_PERMISSION, (granted) => {
        historyPermissionKnown = true;
        historyPermissionGranted = Boolean(granted) && !chrome.runtime.lastError;
        historyPermissionRequestStarted = false;
      });
    } catch {
      historyPermissionKnown = true;
      historyPermissionGranted = false;
      historyPermissionRequestStarted = false;
    }
  })();
}

export async function createSessionFromWindow(
  mode: "save" | "collapse"
): Promise<SessionCaptureResult | null> {
  const { sessions, settings } = await loadStorage();
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
  const titleTabIndex = await preferredTitleTabIndex(eligibleTabs);
  const savedTabs = await Promise.all(
    eligibleTabs.map((tab, index) => chromeTabToTabItemWithFavicon(tab, index))
  );
  const sessionName = defaultSavedSessionTitle(
    mode === "collapse",
    movePreferredTabFirst(savedTabs, titleTabIndex)
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
  const { sessions } = await loadStorage();
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
    await notifyBackgroundTabsSuspended(discardedCount);
  }

  return discardedCount;
}

async function searchBrowserHistory(query: string): Promise<OverlaySearchRow[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  if (!(await hasHistoryPermission())) {
    return [];
  }

  if (typeof chrome.history?.search !== "function") {
    return [];
  }

  const results = await chrome.history.search({
    text: trimmed,
    maxResults: 20,
    startTime: 0,
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
    ...(await chrome.tabs.query({}))
      .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
        Boolean(tab.id && tab.url && !isRestrictedUrl(tab.url))
      )
      .map((tab) => ({
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
    theme: settings.theme,
  };
}

function isSearchOverlayState(value: unknown): value is SearchOverlayState {
  return isRecord(value) && typeof value.open === "boolean" && typeof value.updatedAt === "number";
}

function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) {
    return false;
  }

  const theme = value.theme;
  return (
    (theme === "light" || theme === "dark" || theme === "system") &&
    typeof value.searchOverlayEnabled === "boolean"
  );
}

function transientGet<T>(keys: string[]): Promise<T> {
  const transient = getTransientStorage();
  return new Promise((resolve, reject) => {
    transient.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(result as T);
    });
  });
}

function transientSet(value: object): Promise<void> {
  const transient = getTransientStorage();
  return new Promise((resolve, reject) => {
    transient.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve();
    });
  });
}

async function getSearchOverlayState(): Promise<SearchOverlayState> {
  const result = await transientGet<Record<string, unknown>>([SEARCH_OVERLAY_STATE_KEY]);
  const state = result[SEARCH_OVERLAY_STATE_KEY];
  return isSearchOverlayState(state) ? state : { open: false, updatedAt: 0 };
}

async function setSearchOverlayOpen(open: boolean): Promise<void> {
  await transientSet({
    [SEARCH_OVERLAY_STATE_KEY]: {
      open,
      updatedAt: Date.now(),
    } satisfies SearchOverlayState,
  });
}

function isWebStoreUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      host === "chromewebstore.google.com" ||
      (host === "chrome.google.com" && path.startsWith("/webstore")) ||
      (host === "microsoftedge.microsoft.com" && path.startsWith("/addons")) ||
      host === "addons.mozilla.org"
    );
  } catch {
    return true;
  }
}

function isSearchOverlaySupportedUrl(url: string): boolean {
  if (isRestrictedUrl(url) || isWebStoreUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSearchOverlaySupportedTab(
  tab: chrome.tabs.Tab | undefined | null
): tab is chrome.tabs.Tab & { id: number; url: string } {
  return Boolean(tab?.id && tab.url && isSearchOverlaySupportedUrl(tab.url));
}

async function injectSearchOverlayScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/searchOverlay.js"],
    });
    return true;
  } catch {
    return false;
  }
}

async function sendSearchOverlayMessage(tabId: number, payload: OverlayPayload): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "tabsetu:open-overlay", payload });
    return true;
  } catch {
    if (!(await injectSearchOverlayScript(tabId))) {
      return false;
    }
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "tabsetu:open-overlay", payload });
    return true;
  } catch {
    return false;
  }
}

async function openSearchOverlayOnTab(tab: chrome.tabs.Tab, data?: StorageData): Promise<boolean> {
  const overlayData = data ?? (await loadStorage());
  if (!isSearchOverlaySupportedTab(tab) || !overlayData.settings.searchOverlayEnabled) {
    return false;
  }

  const payload = await buildOverlayPayload(overlayData);
  return sendSearchOverlayMessage(tab.id, payload);
}

async function showOverlayDisabledToast(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
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
}

async function broadcastOverlayMessage(message: Record<string, unknown>): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter(isSearchOverlaySupportedTab)
      .map((tab) => chrome.tabs.sendMessage(tab.id, message).catch(() => undefined))
  );
}

async function closeSearchOverlayEverywhere(): Promise<void> {
  await broadcastOverlayMessage({ type: "tabsetu:close-overlay" });
}

async function syncSearchOverlayForTab(tabId: number, knownTab?: chrome.tabs.Tab): Promise<void> {
  const state = await getSearchOverlayState();
  if (!state.open) {
    return;
  }

  const data = await loadStorage();
  if (!data.settings.searchOverlayEnabled) {
    await setSearchOverlayOpen(false);
    await closeSearchOverlayEverywhere();
    return;
  }

  const tab = knownTab?.id === tabId ? knownTab : await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.active) {
    return;
  }

  await openSearchOverlayOnTab(tab, data);
}

async function handleSearchOverlayClosed(): Promise<void> {
  await setSearchOverlayOpen(false);
  await closeSearchOverlayEverywhere();
}

function registerSearchOverlayLifecycleListeners(): void {
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void syncSearchOverlayForTab(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.active || (!changeInfo.url && changeInfo.status !== "complete")) {
      return;
    }

    void syncSearchOverlayForTab(tabId, tab);
  });

  chrome.tabs.onCreated.addListener((tab) => {
    if (!tab.active || typeof tab.id !== "number") {
      return;
    }

    void syncSearchOverlayForTab(tab.id, tab);
  });

  chrome.storage.onChanged.addListener((changes) => {
    const settingsChange = changes[STORAGE_KEYS.settings];
    const nextSettings: unknown = settingsChange?.newValue;
    if (!isSettings(nextSettings)) {
      return;
    }

    if (!nextSettings.searchOverlayEnabled) {
      void setSearchOverlayOpen(false).then(() => closeSearchOverlayEverywhere());
      return;
    }

    void broadcastOverlayMessage({
      type: "tabsetu:overlay-theme-changed",
      theme: nextSettings.theme,
    });
  });
}

async function openSearchOverlay(): Promise<void> {
  const data = await loadStorage();
  const { settings } = data;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!isSearchOverlaySupportedTab(activeTab)) {
    await notifyCommandProblem(
      "TabSetu search cannot open here",
      "Browser pages and extension pages do not allow the search overlay."
    );
    return;
  }

  if (!settings.searchOverlayEnabled) {
    await setSearchOverlayOpen(false);
    await showOverlayDisabledToast(activeTab.id);
    return;
  }

  const opened = await openSearchOverlayOnTab(activeTab, data);
  if (opened) {
    await setSearchOverlayOpen(true);
    return;
  }

  await notifyCommandProblem(
    "TabSetu search could not open",
    "Try the shortcut on a regular http or https page."
  );
}

const SHORTCUT_ACTION_DEBOUNCE_MS = 700;
const lastShortcutActionAt = new Map<string, number>();

function shouldIgnoreShortcutAction(action: string): boolean {
  const now = Date.now();
  const previous = lastShortcutActionAt.get(action) ?? 0;
  lastShortcutActionAt.set(action, now);
  return now - previous < SHORTCUT_ACTION_DEBOUNCE_MS;
}

function handleOpenSearchShortcut(options: { requestHistoryPermission: boolean }): void {
  if (shouldIgnoreShortcutAction("open-search-overlay")) {
    return;
  }

  if (options.requestHistoryPermission) {
    requestHistoryPermissionFromCommand();
  }

  void openSearchOverlay().catch(() =>
    notifyCommandProblem("TabSetu search could not open", "Try again on a regular webpage.")
  );
}

async function openPopupWithSaveMode(mode: "save" | "collapse"): Promise<boolean> {
  try {
    const transient = getTransientStorage();
    await new Promise<void>((resolve) => {
      transient.set({ [PENDING_SAVE_KEY]: mode }, () => resolve());
    });

    if (typeof chrome.action.openPopup === "function") {
      await chrome.action.openPopup();
      return true;
    }
  } catch {
    // openPopup may throw if not supported or no user gesture.
  }

  return false;
}

function handleSaveWindowShortcut(): void {
  if (shouldIgnoreShortcutAction("save-current-window")) {
    return;
  }

  void openPopupWithSaveMode("save").then((opened) => {
    if (opened) {
      return;
    }

    // Fallback: popup couldn't open, save immediately as before.
    void createSessionFromWindow("save")
      .then((result) => {
        if (result) {
          void notifySessionCaptured(result);
          return;
        }
        void notifyCommandProblem(
          "No tabs saved",
          "TabSetu did not find any regular pages in the current window."
        );
      })
      .catch(() => notifyCommandProblem("TabSetu could not save this window", "Please try again."));
  });
}

function handleCollapseWindowShortcut(): void {
  if (shouldIgnoreShortcutAction("collapse-current-window")) {
    return;
  }

  void openPopupWithSaveMode("collapse").then((opened) => {
    if (opened) {
      return;
    }

    // Fallback: popup couldn't open, collapse immediately as before.
    void createSessionFromWindow("collapse")
      .then((result) => {
        if (result) {
          void notifySessionCaptured(result);
          void chrome.action.openPopup?.().catch(() => undefined);
          return;
        }
        void notifyCommandProblem(
          "No tabs collapsed",
          "TabSetu did not find any regular pages in the current window."
        );
      })
      .catch(() =>
        notifyCommandProblem("TabSetu could not collapse this window", "Please try again.")
      );
  });
}

function registerRuntimeMessages(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isRecord(message)) {
      return undefined;
    }

    if (message.type === "tabsetu:shortcut-open-search-overlay") {
      handleOpenSearchShortcut({ requestHistoryPermission: false });
      sendResponse({ ok: true });
      return undefined;
    }

    if (message.type === "tabsetu:overlay-closed") {
      void handleSearchOverlayClosed()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "tabsetu:shortcut-save-window") {
      handleSaveWindowShortcut();
      sendResponse({ ok: true });
      return undefined;
    }

    if (message.type === "tabsetu:shortcut-collapse-window") {
      handleCollapseWindowShortcut();
      sendResponse({ ok: true });
      return undefined;
    }

    if (message.type === "tabsetu:get-pending-save-mode") {
      const transient = getTransientStorage();
      transient.get([PENDING_SAVE_KEY], (result) => {
        const rawMode: unknown = result[PENDING_SAVE_KEY];
        const mode = isSaveMode(rawMode) ? rawMode : null;
        // Clear the pending flag after reading it.
        transient.remove(PENDING_SAVE_KEY, () => undefined);
        sendResponse({ ok: true, mode });
      });
      return true;
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

    if (message.type === "tabsetu:has-history-permission") {
      void hasHistoryPermission()
        .then((granted) => sendResponse({ ok: true, granted }))
        .catch(() => sendResponse({ ok: false, granted: false }));
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
}

function registerCommands(): void {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "open-search-overlay") {
      handleOpenSearchShortcut({ requestHistoryPermission: true });
    }

    if (command === "save-current-window") {
      handleSaveWindowShortcut();
    }

    if (command === "collapse-current-window") {
      handleCollapseWindowShortcut();
    }

    if (command === "open-dashboard") {
      void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    }
  });
}

export function registerMessagingListeners(): void {
  registerRuntimeMessages();
  registerCommands();
  registerSearchOverlayLifecycleListeners();
}

export { storeBrowserTab };
