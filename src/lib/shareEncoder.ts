import type { Session, ShareSnapshot } from "@/types";

const SHARE_BASE_URL = "https://tabsetu.app/s";

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

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
  return toBase64Url(JSON.stringify(snapshot));
}

export function decodeShareSnapshot(encoded: string): ShareSnapshot {
  const parsed = JSON.parse(fromBase64Url(encoded));
  if (!parsed || parsed.v !== 1 || typeof parsed.name !== "string" || !Array.isArray(parsed.tabs)) {
    throw new Error("This TabSetu share link is invalid.");
  }
  return parsed as ShareSnapshot;
}

export function generateShareUrl(session: Session): string {
  return generateShareUrlFromEncoded(encodeShareSnapshot(createShareSnapshot(session)));
}

export function generateShareUrlFromEncoded(encoded: string): string {
  return `${SHARE_BASE_URL}#${encoded}`;
}
