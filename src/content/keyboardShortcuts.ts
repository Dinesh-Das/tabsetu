const SHORTCUT_DEBOUNCE_MS = 500;

let lastShortcutAt = 0;

function isPlainTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

function sendShortcut(type: string): void {
  const now = Date.now();
  if (now - lastShortcutAt < SHORTCUT_DEBOUNCE_MS) {
    return;
  }

  lastShortcutAt = now;
  void chrome.runtime.sendMessage({ type }).catch(() => undefined);
}

window.addEventListener(
  "keydown",
  (event) => {
    if (!event.isTrusted || event.defaultPrevented || event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();
    const usesFindShortcut = event.shiftKey && (event.ctrlKey || event.metaKey) && key === "f";
    const usesSaveShortcut = event.shiftKey && event.altKey && key === "y";
    const usesCollapseShortcut = event.shiftKey && event.altKey && key === "u";

    if (!usesFindShortcut && !usesSaveShortcut && !usesCollapseShortcut) {
      return;
    }

    if ((usesSaveShortcut || usesCollapseShortcut) && isPlainTypingTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (usesFindShortcut) {
      sendShortcut("tabsetu:shortcut-open-search-overlay");
    } else if (usesCollapseShortcut) {
      sendShortcut("tabsetu:shortcut-collapse-window");
    } else {
      sendShortcut("tabsetu:shortcut-save-window");
    }
  },
  true
);
