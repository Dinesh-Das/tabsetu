import type { Session, TabItem } from "@/types";
import { isRestrictedUrl, isValidUrl } from "@/lib/tabHelpers";

export interface TabOpenFailure {
  tabId: string;
  title: string;
  url: string;
  error: string;
}

export interface OpenSessionResult {
  requestedCount: number;
  openedCount: number;
  failedTabs: TabOpenFailure[];
  warnings: string[];
}

type CreatedTab = { saved: TabItem; browser: chrome.tabs.Tab };

export function getOpenableTabs(tabs: TabItem[]): TabItem[] {
  return tabs
    .filter((tab) => tab.url && isValidUrl(tab.url) && !isRestrictedUrl(tab.url))
    .sort((left, right) => left.position - right.position);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The browser rejected this tab.";
}

async function applyTabState(tab: chrome.tabs.Tab, saved: TabItem): Promise<void> {
  if (typeof tab.id !== "number") return;
  const updates: chrome.tabs.UpdateProperties = {};
  if (saved.pinned) updates.pinned = true;
  if (saved.muted) updates.muted = true;
  if (Object.keys(updates).length > 0) {
    await chrome.tabs.update(tab.id, updates);
  }
}

async function createdWindowTab(window: chrome.windows.Window): Promise<chrome.tabs.Tab | null> {
  const included = window.tabs?.find((tab) => typeof tab.id === "number");
  if (included) return included;
  if (typeof window.id !== "number") return null;
  const tabs = await chrome.tabs.query({ windowId: window.id });
  return tabs[0] ?? null;
}

async function restoreGroups(createdTabs: CreatedTab[]): Promise<string[]> {
  const warnings: string[] = [];
  if (typeof chrome.tabs.group !== "function") return warnings;

  const groups = new Map<string, CreatedTab[]>();
  for (const created of createdTabs) {
    if (!created.saved.groupKey || typeof created.browser.windowId !== "number") continue;
    const key = `${created.browser.windowId}:${created.saved.groupKey}`;
    groups.set(key, [...(groups.get(key) ?? []), created]);
  }

  for (const groupTabs of groups.values()) {
    const tabIds = groupTabs
      .map(({ browser }) => browser.id)
      .filter((tabId): tabId is number => typeof tabId === "number");
    if (tabIds.length === 0) continue;

    try {
      const groupId = await chrome.tabs.group({ tabIds });
      const metadata = groupTabs[0]?.saved;
      if (metadata && typeof chrome.tabGroups?.update === "function") {
        const updates: chrome.tabGroups.UpdateProperties = {
          collapsed: metadata.groupCollapsed ?? false,
        };
        if (metadata.groupTitle) updates.title = metadata.groupTitle;
        if (metadata.groupColor) updates.color = metadata.groupColor;
        await chrome.tabGroups.update(groupId, updates).catch(() => undefined);
      }
    } catch (error) {
      warnings.push(`A saved tab group could not be restored: ${errorMessage(error)}`);
    }
  }

  return warnings;
}

export async function openSavedTab(tab: TabItem, openInNewWindow = false): Promise<boolean> {
  if (!tab.url || !isValidUrl(tab.url) || isRestrictedUrl(tab.url)) {
    return false;
  }

  const opened = openInNewWindow
    ? await createdWindowTab(await chrome.windows.create({ url: tab.url, focused: true }))
    : await chrome.tabs.create({ url: tab.url });
  if (!opened) return false;
  await applyTabState(opened, tab).catch(() => undefined);
  return true;
}

/** Restores saved tab items while preserving order, pinned/muted state, and groups. */
export async function openTabItemsDetailed(
  tabs: TabItem[],
  openInNewWindow: boolean,
  options: { targetWindowId?: number | null } = {}
): Promise<OpenSessionResult> {
  const openableTabs = getOpenableTabs(tabs);
  const createdTabs: CreatedTab[] = [];
  const failedTabs: TabOpenFailure[] = [];
  const warnings: string[] = [];
  const savedWindows = new Map<string, TabItem[]>();

  for (const tab of openableTabs) {
    const windowKey = String(tab.windowId ?? "default");
    savedWindows.set(windowKey, [...(savedWindows.get(windowKey) ?? []), tab]);
  }

  const groupsToOpen = openInNewWindow ? [...savedWindows.values()] : [openableTabs];
  for (const windowTabs of groupsToOpen) {
    let targetWindowId = openInNewWindow ? undefined : (options.targetWindowId ?? undefined);
    for (const saved of windowTabs) {
      try {
        let browserTab: chrome.tabs.Tab | null;
        if (openInNewWindow && targetWindowId == null) {
          const createdWindow = await chrome.windows.create({ url: saved.url, focused: true });
          targetWindowId = createdWindow.id;
          browserTab = await createdWindowTab(createdWindow);
        } else {
          browserTab = await chrome.tabs.create({
            ...(targetWindowId == null ? {} : { windowId: targetWindowId }),
            url: saved.url,
            active: false,
          });
        }

        if (!browserTab) {
          throw new Error("The browser did not return the created tab.");
        }
        createdTabs.push({ saved, browser: browserTab });
        await applyTabState(browserTab, saved).catch((error: unknown) => {
          warnings.push(
            `State for "${saved.title}" could not be fully restored: ${errorMessage(error)}`
          );
        });
      } catch (error) {
        failedTabs.push({
          tabId: saved.id,
          title: saved.title,
          url: saved.url,
          error: errorMessage(error),
        });
      }
    }
  }

  warnings.push(...(await restoreGroups(createdTabs)));
  return {
    requestedCount: openableTabs.length,
    openedCount: createdTabs.length,
    failedTabs,
    warnings,
  };
}

/** Restores a session while preserving saved windows, order, pinned/muted state, and groups. */
export async function openSessionTabsDetailed(
  session: Session,
  openInNewWindow: boolean
): Promise<OpenSessionResult> {
  return openTabItemsDetailed(session.tabs, openInNewWindow);
}

/** Backward-compatible count-only wrapper for callers that do not need diagnostics. */
export async function openSessionTabs(session: Session, openInNewWindow: boolean): Promise<number> {
  return (await openSessionTabsDetailed(session, openInNewWindow)).openedCount;
}

export function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
