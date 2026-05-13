const runtimeFallback =
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("icons/icon16.png")
    : "";

const faviconMemoryCache = new Map<string, string>();

function originFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function rememberFaviconForOrigin(
  pageUrl: string | null | undefined,
  favIconUrl: string | null | undefined
): void {
  const origin = originFromUrl(pageUrl);
  if (origin && favIconUrl) {
    faviconMemoryCache.set(origin, favIconUrl);
  }
}

export function getRememberedFaviconForOrigin(pageUrl: string | null | undefined): string | null {
  const origin = originFromUrl(pageUrl);
  return origin ? (faviconMemoryCache.get(origin) ?? null) : null;
}

export function clearRememberedFavicons(): void {
  faviconMemoryCache.clear();
}

export function getFaviconFallbackUrl(): string {
  return runtimeFallback;
}
