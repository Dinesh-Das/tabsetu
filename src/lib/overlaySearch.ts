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

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function scoreText(value: string | undefined, query: string): number {
  if (!value) {
    return 0;
  }

  const text = normalizeText(value);
  if (!text) {
    return 0;
  }

  if (text === query) {
    return 1;
  }

  const index = text.indexOf(query);
  if (index >= 0) {
    return index === 0 ? 0.92 : 0.78;
  }

  const words = text.split(/[\s/._-]+/).filter(Boolean);
  if (words.some((word) => word.startsWith(query))) {
    return 0.68;
  }

  let queryIndex = 0;
  for (const char of text) {
    if (char === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) {
        return 0.36;
      }
    }
  }

  return 0;
}

export function scoreOverlayRows(
  rows: OverlaySearchRow[],
  query: string,
  settings?: Pick<Settings, "searchScopes" | "fuzzySearchThreshold">
): OverlaySearchRow[] {
  const trimmedQuery = normalizeText(query);
  if (!trimmedQuery) {
    return rows;
  }

  const scopes = settings?.searchScopes ?? {
    sessions: true,
    tabs: true,
    notes: true,
    tags: true,
    folders: true,
    browserHistory: false,
  };

  const keys: Array<{ name: keyof OverlaySearchRow; weight: number }> = [];
  const useSessions = scopes.sessions ?? true;
  const useTabs = scopes.tabs ?? true;
  const useNotes = scopes.notes ?? true;
  const useTags = scopes.tags ?? true;
  const useFolders = scopes.folders ?? true;
  const useBrowserHistory = scopes.browserHistory ?? false;

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
    keys.push({ name: "tabTitle", weight: 0.14 }, { name: "tabUrl", weight: 0.1 });
  }
  if (useBrowserHistory) {
    keys.push({ name: "historyTitle", weight: 0.14 }, { name: "historyUrl", weight: 0.1 });
  }

  if (keys.length === 0) {
    return [];
  }

  const threshold = Math.max(0.1, Math.min(0.6, settings?.fuzzySearchThreshold ?? 0.32));

  return rows
    .map((row, index) => {
      const score = keys.reduce(
        (total, key) =>
          total + scoreText(row[key.name] as string | undefined, trimmedQuery) * key.weight,
        0
      );
      return { row, score, index };
    })
    .filter((result) => result.score >= threshold * 0.1)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.row);
}
