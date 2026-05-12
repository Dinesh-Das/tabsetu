import { useEffect, useState } from "react";
import { FAVICON_STORAGE_KEY } from "@/lib/favicon";

let cachedFavicons: Map<string, string> | null = null;
const subscribers = new Set<(map: Map<string, string>) => void>();

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

export function seedFavicons(favicons: Record<string, string>): void {
  cachedFavicons = new Map(Object.entries(favicons));
  subscribers.forEach((subscriber) => subscriber(cachedFavicons ?? new Map<string, string>()));
}

export function useFavicons(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => cachedFavicons ?? new Map());

  useEffect(() => {
    subscribers.add(setMap);
    const isPopup = window.location.pathname.includes("/popup/");
    if (!cachedFavicons && !isPopup) {
      chrome.storage.local.get([FAVICON_STORAGE_KEY], (result) => {
        const raw: unknown = result[FAVICON_STORAGE_KEY];
        if (isStringRecord(raw)) {
          cachedFavicons = new Map(Object.entries(raw));
          setMap(cachedFavicons);
        }
      });
    }

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (FAVICON_STORAGE_KEY in changes) {
        const raw: unknown = changes[FAVICON_STORAGE_KEY].newValue;
        cachedFavicons = isStringRecord(raw)
          ? new Map(Object.entries(raw))
          : new Map<string, string>();
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
