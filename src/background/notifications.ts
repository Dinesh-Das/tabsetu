import type { Session } from "@/types";
import { loadStorage, loadUndoBuffer, saveUndoBuffer } from "@/lib/storage";
import {
  safeCreateNotification,
  safeClearNotification,
  safeSetBadgeTextColor,
  detectBrowser,
} from "@/lib/browserCompat";

type SessionCaptureResult = {
  session: Session;
  tabCount: number;
  mode: "save" | "collapse";
};

const EXPECTED_COMMAND_SHORTCUTS: Record<string, string> = {
  "open-search-overlay": "Ctrl+Shift+F",
  "save-current-window": "Alt+Shift+Y",
  "collapse-current-window": "Alt+Shift+U",
  "open-dashboard": "Alt+Shift+D",
};

export function createNotification(
  notificationId: string,
  options: chrome.notifications.NotificationOptions<true>
): Promise<string> {
  return safeCreateNotification(notificationId, options);
}

export function clearNotification(notificationId: string): Promise<boolean> {
  return safeClearNotification(notificationId);
}

export async function updateBadge(): Promise<void> {
  const { sessions } = await loadStorage();
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
  await safeSetBadgeTextColor({ color: "#FFFFFF" });
}

export async function notifyScheduledSessionOpened(
  session: Session,
  tabCount: number
): Promise<void> {
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

export async function notifySessionCaptured(result: SessionCaptureResult): Promise<void> {
  try {
    await createNotification(`tabsetu-${result.mode}-${result.session.id}-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title:
        result.mode === "collapse"
          ? "TabSetu saved and collapsed this window"
          : result.tabCount === 1
            ? "TabSetu saved this tab"
            : "TabSetu saved this window",
      message: `"${result.session.name}" - ${result.tabCount} ${
        result.tabCount === 1 ? "tab" : "tabs"
      }.`,
      priority: 2,
      ...(result.mode === "collapse" ? { buttons: [{ title: "Undo collapse" }] } : {}),
    });
  } catch {
    // Notification permission/platform quirks should not block the save.
  }
}

export async function notifyBackgroundTabsSuspended(discardedCount: number): Promise<void> {
  if (discardedCount === 0) {
    return;
  }

  await createNotification(`tabsetu-suspend-${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "TabSetu suspended background tabs",
    message: `${discardedCount} ${
      discardedCount === 1 ? "tab is" : "tabs are"
    } now unloaded until selected.`,
    priority: 1,
  });
}

export async function notifyCommandProblem(title: string, message: string): Promise<void> {
  try {
    await createNotification(`tabsetu-command-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title,
      message,
      priority: 1,
    });
  } catch {
    // Command diagnostics should never make the command handler fail harder.
  }
}

function getRegisteredCommands(): Promise<chrome.commands.Command[]> {
  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => resolve(commands));
  });
}

export async function notifyUnassignedCommandShortcuts(): Promise<void> {
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

    const browser = detectBrowser();
    const shortcutHint =
      browser === "firefox"
        ? "Open about:addons, then Manage Extension Shortcuts to set them."
        : browser === "edge"
          ? "Open edge://extensions/shortcuts and set them."
          : "Open your browser's extension shortcuts settings and set: " +
            unassigned.join(", ") +
            ".";

    await createNotification(`tabsetu-shortcuts-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "TabSetu shortcuts need assigning",
      message: shortcutHint,
      priority: 1,
    });
  } catch {
    // Shortcut diagnostics are best-effort only.
  }
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

export function registerNotificationListeners(): void {
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (!notificationId.startsWith("tabsetu-collapse-") || buttonIndex !== 0) {
      return;
    }

    void restoreLastCollapse();
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith("tabsetu-schedule-")) {
      void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    }
  });
}
