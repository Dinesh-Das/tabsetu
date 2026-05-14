/**
 * Cross-browser compatibility shim for TabSetu.
 *
 * Centralizes browser detection, API availability checks, and safe wrappers
 * for APIs that differ across Chrome, Firefox, Safari, Edge, Brave, Opera, Arc, and Vivaldi.
 */

type BrowserId =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "brave"
  | "opera"
  | "arc"
  | "vivaldi"
  | "unknown";

type BrowserFamily = "chromium" | "firefox" | "safari" | "unknown";

let cachedBrowserId: BrowserId | null = null;

/**
 * Detect the current browser from the user agent and runtime APIs.
 * Result is cached after the first call.
 */
export function detectBrowser(): BrowserId {
  if (cachedBrowserId) {
    return cachedBrowserId;
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  if (ua.includes("Firefox/") || ua.includes("Gecko/")) {
    cachedBrowserId = "firefox";
  } else if (
    typeof (globalThis as Record<string, unknown>).safari !== "undefined" ||
    (/AppleWebKit\//.test(ua) && !/Chrom(e|ium)\//.test(ua))
  ) {
    cachedBrowserId = "safari";
  } else if (ua.includes("OPR/") || ua.includes("Opera/")) {
    cachedBrowserId = "opera";
  } else if (ua.includes("Vivaldi/")) {
    cachedBrowserId = "vivaldi";
  } else if (ua.includes("Brave/") || (navigator as { brave?: unknown }).brave) {
    cachedBrowserId = "brave";
  } else if (ua.includes("Edg/")) {
    cachedBrowserId = "edge";
  } else if (ua.includes("Arc/")) {
    cachedBrowserId = "arc";
  } else if (ua.includes("Chrome/")) {
    cachedBrowserId = "chrome";
  } else {
    cachedBrowserId = "unknown";
  }

  return cachedBrowserId;
}

/** Returns the browser family for broad compatibility checks. */
export function getBrowserFamily(): BrowserFamily {
  const id = detectBrowser();
  if (id === "firefox") return "firefox";
  if (id === "safari") return "safari";
  if (["chrome", "edge", "brave", "opera", "arc", "vivaldi"].includes(id)) return "chromium";
  return "unknown";
}

export function isFirefox(): boolean {
  return detectBrowser() === "firefox";
}

export function isSafari(): boolean {
  return detectBrowser() === "safari";
}

export function isChromium(): boolean {
  return getBrowserFamily() === "chromium";
}

// ---------------------------------------------------------------------------
// API Compatibility Helpers
// ---------------------------------------------------------------------------

/** Whether `chrome.identity` is available (not available on Safari). */
export function hasIdentityApi(): boolean {
  try {
    return (
      typeof chrome !== "undefined" && typeof chrome.identity?.launchWebAuthFlow === "function"
    );
  } catch {
    return false;
  }
}

/** Whether `chrome.storage.session` is available. */
export function hasSessionStorage(): boolean {
  try {
    return typeof chrome !== "undefined" && typeof chrome.storage?.session !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Returns the transient storage area — `chrome.storage.session` when available,
 * falling back to `chrome.storage.local` on browsers that lack it.
 */
export function getTransientStorage(): chrome.storage.StorageArea {
  if (hasSessionStorage()) {
    return chrome.storage.session;
  }
  return chrome.storage.local;
}

/**
 * Returns the sync-capable storage area. On Safari, `chrome.storage.sync`
 * exists but does NOT actually sync cross-device. We still use it so settings
 * behave identically to Chromium — the data just stays device-local on Safari.
 *
 * Falls back to `chrome.storage.local` if `storage.sync` throws (edge-case
 * Safari contexts).
 */
export function getSyncStorage(): chrome.storage.StorageArea {
  try {
    if (chrome.storage?.sync) {
      return chrome.storage.sync;
    }
  } catch {
    // Safari may throw in web-worker or restricted contexts.
  }
  return chrome.storage.local;
}

/**
 * Safely set badge text color. Some browsers (older Safari/Firefox versions)
 * don't support `chrome.action.setBadgeTextColor`.
 */
export async function safeSetBadgeTextColor(
  details: chrome.action.BadgeColorDetails
): Promise<void> {
  try {
    await chrome.action.setBadgeTextColor?.(details);
  } catch {
    // Silently ignore — badge text color is a cosmetic enhancement.
  }
}

/**
 * Create a notification with graceful degradation. Safari's notification API
 * is inconsistent — we swallow failures so they never block critical flows.
 */
export function safeCreateNotification(
  notificationId: string,
  options: chrome.notifications.NotificationOptions<true>
): Promise<string> {
  return new Promise((resolve) => {
    try {
      chrome.notifications.create(notificationId, options, (createdId) => {
        if (chrome.runtime.lastError) {
          resolve(notificationId);
          return;
        }
        resolve(createdId);
      });
    } catch {
      // Notification API unavailable or blocked — not critical.
      resolve(notificationId);
    }
  });
}

/**
 * Clear a notification safely (no-op if the API throws).
 */
export function safeClearNotification(notificationId: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.notifications.clear(notificationId, (wasCleared) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(wasCleared);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Returns a redirect URL for OAuth flows. On Chromium, uses the built-in
 * `chrome.identity.getRedirectURL`. On Safari (where the identity API is
 * missing), returns the extension's own OAuth callback page URL.
 */
export function getOAuthRedirectUrl(path = "google"): string | null {
  if (hasIdentityApi()) {
    try {
      return chrome.identity.getRedirectURL(path);
    } catch {
      return null;
    }
  }

  // Safari fallback: use a bundled callback page.
  try {
    return chrome.runtime.getURL("oauth-callback.html");
  } catch {
    return null;
  }
}

/**
 * Launch an OAuth flow. On Chromium, delegates to `chrome.identity.launchWebAuthFlow`.
 * On Safari, opens the auth URL in a new tab and waits for the callback page to
 * relay the redirect URL back via `chrome.runtime.sendMessage`.
 */
export function launchOAuthFlow(url: string, interactive: boolean): Promise<string | null> {
  if (hasIdentityApi()) {
    return new Promise((resolve) => {
      try {
        chrome.identity.launchWebAuthFlow({ url, interactive }, (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            resolve(null);
            return;
          }
          resolve(redirectUrl);
        });
      } catch {
        resolve(null);
      }
    });
  }

  // Safari/fallback: open in a new tab and wait for a message from the callback page.
  return new Promise((resolve) => {
    let resolved = false;
    const TIMEOUT_MS = 120_000;

    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as Record<string, unknown>).type === "tabsetu:oauth-callback"
      ) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(listener);
        const redirectUrl = (message as Record<string, unknown>).redirectUrl;
        sendResponse({ ok: true });
        resolve(typeof redirectUrl === "string" ? redirectUrl : null);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    void chrome.tabs.create({ url }).catch(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve(null);
    });

    setTimeout(() => {
      if (!resolved) {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(null);
      }
    }, TIMEOUT_MS);
  });
}
