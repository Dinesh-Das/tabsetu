import { useEffect, useState } from "react";
import { FAVICON_STORAGE_KEY } from "@/lib/favicon";

let cachedFavicons: Map<string, string> | null = null;
const subscribers = new Set<(map: Map<string, string>) => void>();

export function seedFavicons(favicons: Record<string, string>): void {
  cachedFavicons = new Map(Object.entries(favicons));
  subscribers.forEach((subscriber) => subscriber(cachedFavicons ?? new Map()));
}

export function useFavicons(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => cachedFavicons ?? new Map());

  useEffect(() => {
    subscribers.add(setMap);
    const isPopup = window.location.pathname.includes("/popup/");
    if (!cachedFavicons && !isPopup) {
      chrome.storage.local.get([FAVICON_STORAGE_KEY], (result) => {
        const raw = result[FAVICON_STORAGE_KEY];
        if (raw && typeof raw === "object") {
          cachedFavicons = new Map(Object.entries(raw as Record<string, string>));
          setMap(cachedFavicons);
        }
      });
    }

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (FAVICON_STORAGE_KEY in changes) {
        const raw = changes[FAVICON_STORAGE_KEY].newValue;
        cachedFavicons = raw && typeof raw === "object"
          ? new Map(Object.entries(raw as Record<string, string>))
          : new Map();
        setMap(cachedFavicons);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      subscribers.delete(setMap);
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return map;
}
