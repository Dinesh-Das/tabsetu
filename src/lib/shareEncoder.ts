import type { Session, ShareSnapshot } from "@/types";
import LZString from "lz-string";

const SHARE_BASE_URL = "https://tabsetu.app/s";

export function createShareSnapshot(session: Session): ShareSnapshot {
  return {
    v: 1,
    name: session.name,
    description: session.description,
    tabs: session.tabs.map((tab) => ({ title: tab.title, url: tab.url })),
    createdAt: Date.now(),
  };
}

export function encodeShareSnapshot(snapshot: ShareSnapshot): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(snapshot));
}

export function decodeShareSnapshot(encoded: string): ShareSnapshot {
  const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
  if (!decompressed) {
    throw new Error("This TabSetu share link is invalid.");
  }

  const parsed = JSON.parse(decompressed);
  if (!parsed || parsed.v !== 1 || typeof parsed.name !== "string" || !Array.isArray(parsed.tabs)) {
    throw new Error("This TabSetu share link is invalid.");
  }
  return parsed as ShareSnapshot;
}

export const encodeSession = encodeShareSnapshot;

export function decodeSession(encoded: string): ShareSnapshot | null {
  try {
    return decodeShareSnapshot(encoded);
  } catch {
    return null;
  }
}

export function generateShareUrl(session: Session): string {
  return generateShareUrlFromEncoded(encodeShareSnapshot(createShareSnapshot(session)));
}

export function generateShareUrlFromEncoded(encoded: string): string {
  const url = `${SHARE_BASE_URL}#${encoded}`;
  if (url.length > 4000) {
    throw new Error("This session is too large to share via URL. Use Export instead.");
  }
  return url;
}
