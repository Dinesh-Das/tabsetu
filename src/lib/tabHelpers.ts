import type { TabItem } from "@/types";

const RESTRICTED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
  "file://",
  "data:",
  "javascript:",
];

export function generateId(prefix = "id"): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${uuid}`;
}

export function isRestrictedUrl(url: string): boolean {
  const normalizedUrl = url.trim().toLowerCase();
  return RESTRICTED_PREFIXES.some((prefix) => normalizedUrl.startsWith(prefix));
}

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}

export function sanitizeLabel(value: string | undefined, fallback: string, maxLength = 200): string {
  const sanitized = clampText(stripHtml(value ?? ""), maxLength);
  return sanitized || fallback;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.protocol && parsed.hostname) && !isRestrictedUrl(url);
  } catch {
    return false;
  }
}

export function chromeTabToTabItem(tab: chrome.tabs.Tab, position = 0): TabItem {
  const createdAt = Date.now();

  return {
    id: generateId("tab"),
    title: sanitizeLabel(tab.title, "Untitled Tab"),
    url: tab.url ?? "",
    favIconUrl: tab.favIconUrl ?? null,
    favIconDataUrl: null,
    pinned: tab.pinned ?? false,
    windowId: tab.windowId ?? null,
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(""));
}

export async function fetchFavIconDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) {
    return null;
  }

  if (url.startsWith("data:image/")) {
    return url;
  }

  if (isRestrictedUrl(url)) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
  } catch {
    return null;
  }
}

export async function chromeTabToTabItemWithFavicon(tab: chrome.tabs.Tab, position = 0): Promise<TabItem> {
  const base = chromeTabToTabItem(tab, position);
  return {
    ...base,
    favIconDataUrl: await fetchFavIconDataUrl(tab.favIconUrl),
  };
}

export async function getCurrentTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true });
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function requestPreferredBrowserTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "tabsetu:get-preferred-browser-tab",
    });

    if (!response || typeof response !== "object") {
      return null;
    }

    const tab = response as chrome.tabs.Tab;
    if (!tab.url || isRestrictedUrl(tab.url)) {
      return null;
    }

    return tab;
  } catch {
    return null;
  }
}

export async function getPreferredBrowserTab(): Promise<chrome.tabs.Tab | null> {
  const preferred = await requestPreferredBrowserTab();
  if (preferred) {
    return preferred;
  }

  const active = await getActiveTab();
  if (active?.url && !isRestrictedUrl(active.url)) {
    return active;
  }

  const activeTabs = await chrome.tabs.query({ active: true });
  const fallback = activeTabs.find((tab) => tab.url && !isRestrictedUrl(tab.url));
  return fallback ?? null;
}

export async function collectTabsForSession(options?: {
  selectedTabIds?: number[];
  includePinned?: boolean;
}): Promise<chrome.tabs.Tab[]> {
  const includePinned = options?.includePinned ?? true;
  const selectedIds = new Set(options?.selectedTabIds ?? []);
  const tabs = await getCurrentTabs();

  return tabs.filter((tab) => {
    if (!tab.url || isRestrictedUrl(tab.url)) {
      return false;
    }

    if (!isValidUrl(tab.url)) {
      return false;
    }

    if (selectedIds.size > 0 && (!tab.id || !selectedIds.has(tab.id))) {
      return false;
    }

    if (!includePinned && tab.pinned) {
      return false;
    }

    return true;
  });
}

export async function closeTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
  const ids = tabs.map((tab) => tab.id).filter((id): id is number => typeof id === "number");
  if (ids.length === 0) {
    return;
  }

  await chrome.tabs.remove(ids);
}

export function cloneTabItem(tab: TabItem): TabItem {
  return {
    ...tab,
    id: generateId("tab"),
    createdAt: Date.now(),
    openCount: 0,
    lastOpenedAt: null,
  };
}
