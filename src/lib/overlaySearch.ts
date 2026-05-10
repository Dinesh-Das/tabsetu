import Fuse from "fuse.js";
import type { Settings } from "@/types";

export interface OverlaySearchRow {
  id: string;
  kind: "session" | "tab" | "active-tab" | "history" | "note";
  title: string;
  subtitle: string;
  action:
    | { kind: "url"; url: string }
    | { kind: "switch-tab"; tabId: number }
    | { kind: "dashboard"; view: "notes" };
  sessionName?: string;
  sessionDescription?: string;
  sessionNote?: string;
  folderName?: string;
  tagNames?: string;
  tabTitle?: string;
  tabUrl?: string;
  tabNote?: string;
  historyTitle?: string;
  historyUrl?: string;
  noteTitle?: string;
  noteContent?: string;
}

export function scoreOverlayRows(
  rows: OverlaySearchRow[],
  query: string,
  settings?: Pick<Settings, "searchScopes" | "fuzzySearchThreshold">
): OverlaySearchRow[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return rows;
  }

  const scopes = settings?.searchScopes ?? {
    sessions: true,
    tabs: true,
    notes: true,
    tags: true,
    folders: true,
  };

  const keys: Array<{ name: keyof OverlaySearchRow; weight: number }> = [];
  const useSessions = scopes.sessions ?? true;
  const useTabs = scopes.tabs ?? true;
  const useNotes = scopes.notes ?? true;
  const useTags = scopes.tags ?? true;
  const useFolders = scopes.folders ?? true;

  if (useSessions) {
    keys.push({ name: "sessionName", weight: 0.3 }, { name: "sessionDescription", weight: 0.12 });
  }
  if (useNotes) {
    keys.push(
      { name: "sessionNote", weight: 0.14 },
      { name: "tabNote", weight: 0.04 },
      { name: "noteTitle", weight: 0.3 },
      { name: "noteContent", weight: 0.14 }
    );
  }
  if (useFolders) {
    keys.push({ name: "folderName", weight: 0.08 });
  }
  if (useTags) {
    keys.push({ name: "tagNames", weight: 0.08 });
  }
  if (useTabs) {
    keys.push(
      { name: "tabTitle", weight: 0.14 },
      { name: "tabUrl", weight: 0.1 },
      { name: "historyTitle", weight: 0.14 },
      { name: "historyUrl", weight: 0.1 }
    );
  }

  if (keys.length === 0) {
    return [];
  }

  return new Fuse(rows, {
    threshold: settings?.fuzzySearchThreshold ?? 0.32,
    ignoreLocation: true,
    findAllMatches: true,
    keys,
  })
    .search(trimmedQuery)
    .map((result) => result.item);
}
