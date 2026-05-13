import Fuse, { type FuseResult, type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type { Folder, Session, Settings, Tag } from "@/types";

export interface HighlightRange {
  start: number;
  end: number;
}

export interface SessionSearchHighlights {
  sessionName: HighlightRange[];
  sessionDescription: HighlightRange[];
  sessionNote: HighlightRange[];
  folderName: HighlightRange[];
  tagNames: Record<string, HighlightRange[]>;
  tabTitles: Record<string, HighlightRange[]>;
  tabUrls: Record<string, HighlightRange[]>;
  tabNotes: Record<string, HighlightRange[]>;
}

export interface SessionSearchSnippet {
  id: string;
  kind: "tabTitle" | "tabUrl" | "tabNote";
  text: string;
  ranges: HighlightRange[];
}

export interface SessionSearchResult {
  session: Session;
  highlights: SessionSearchHighlights;
  snippets: SessionSearchSnippet[];
}

export interface SearchableSession {
  session: Session;
  folderName: string;
  tagIds: string[];
  tagNames: string[];
  tabFolderNames: string[];
  tabTagNames: string[];
  tabTitles: string[];
  tabUrls: string[];
  tabNotes: string[];
}

function createEmptyHighlights(): SessionSearchHighlights {
  return {
    sessionName: [],
    sessionDescription: [],
    sessionNote: [],
    folderName: [],
    tagNames: {},
    tabTitles: {},
    tabUrls: {},
    tabNotes: {},
  };
}

function normalizeRanges(indices: ReadonlyArray<readonly [number, number]>): HighlightRange[] {
  const sorted = indices
    .map(([start, end]) => ({ start, end }))
    .sort((left, right) => left.start - right.start);

  if (sorted.length === 0) {
    return [];
  }

  const merged: HighlightRange[] = [sorted[0]];
  for (const range of sorted.slice(1)) {
    const previous = merged[merged.length - 1];
    if (range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
      continue;
    }

    merged.push(range);
  }

  return merged;
}

function setMappedRanges(
  target: Record<string, HighlightRange[]>,
  key: string,
  indices: ReadonlyArray<readonly [number, number]>
): void {
  target[key] = normalizeRanges([
    ...(target[key] ?? []).map((range) => [range.start, range.end] as const),
    ...indices,
  ]);
}

function buildFuseOptions(
  settings?: Pick<Settings, "searchScopes" | "fuzzySearchThreshold">
): IFuseOptions<SearchableSession> {
  const scopes = settings?.searchScopes ?? {
    sessions: true,
    tabs: true,
    notes: true,
    tags: true,
    folders: true,
  };
  const keys: NonNullable<IFuseOptions<SearchableSession>["keys"]> = [];

  if (scopes.sessions) {
    keys.push({ name: "session.name", weight: 0.3 });
    keys.push({ name: "session.description", weight: 0.12 });
  }

  if (scopes.notes) {
    keys.push({ name: "session.note", weight: 0.14 });
    keys.push({ name: "tabNotes", weight: 0.04 });
  }

  if (scopes.folders) {
    keys.push({ name: "folderName", weight: 0.08 });
    keys.push({ name: "tabFolderNames", weight: 0.04 });
  }

  if (scopes.tags) {
    keys.push({ name: "tagNames", weight: 0.08 });
    keys.push({ name: "tabTagNames", weight: 0.04 });
  }

  if (scopes.tabs) {
    keys.push({ name: "tabTitles", weight: 0.14 });
    keys.push({ name: "tabUrls", weight: 0.1 });
  }

  return {
    threshold: settings?.fuzzySearchThreshold ?? 0.32,
    ignoreLocation: true,
    includeMatches: true,
    findAllMatches: true,
    keys,
  };
}

function toSearchableSessions(
  sessions: Session[],
  folders: Folder[],
  tags: Tag[]
): SearchableSession[] {
  const folderMap = new Map(
    folders.filter((folder) => folder.deletedAt == null).map((folder) => [folder.id, folder.name])
  );
  const tagMap = new Map(
    tags.filter((tag) => tag.deletedAt == null).map((tag) => [tag.id, tag.name])
  );

  return sessions
    .filter((session) => session.deletedAt == null)
    .map((session) => ({
      session,
      folderName: session.folderId ? (folderMap.get(session.folderId) ?? "") : "",
      tagIds: session.tagIds,
      tagNames: session.tagIds.map((tagId) => tagMap.get(tagId) ?? "").filter(Boolean),
      tabFolderNames: session.tabs.map((tab) =>
        tab.folderId ? (folderMap.get(tab.folderId) ?? "") : ""
      ),
      tabTagNames: session.tabs.map((tab) =>
        tab.tagIds
          .map((tagId) => tagMap.get(tagId) ?? "")
          .filter(Boolean)
          .join(" ")
      ),
      tabTitles: session.tabs.map((tab) => tab.title),
      tabUrls: session.tabs.map((tab) => tab.url),
      tabNotes: session.tabs.map((tab) => tab.note),
    }));
}

function applyMatch(
  highlights: SessionSearchHighlights,
  searchable: SearchableSession,
  match: FuseResultMatch
): void {
  const indices = normalizeRanges(match.indices);
  if (indices.length === 0) {
    return;
  }

  switch (match.key) {
    case "session.name":
      highlights.sessionName = indices;
      return;
    case "session.description":
      highlights.sessionDescription = indices;
      return;
    case "session.note":
      highlights.sessionNote = indices;
      return;
    case "folderName":
      highlights.folderName = indices;
      return;
    case "tagNames": {
      if (typeof match.refIndex !== "number") {
        return;
      }

      const tagId = searchable.tagIds[match.refIndex];
      if (!tagId) {
        return;
      }

      setMappedRanges(highlights.tagNames, tagId, match.indices);
      return;
    }
    case "tabTitles": {
      if (typeof match.refIndex !== "number") {
        return;
      }

      const tab = searchable.session.tabs[match.refIndex];
      if (!tab) {
        return;
      }

      setMappedRanges(highlights.tabTitles, tab.id, match.indices);
      return;
    }
    case "tabUrls": {
      if (typeof match.refIndex !== "number") {
        return;
      }

      const tab = searchable.session.tabs[match.refIndex];
      if (!tab) {
        return;
      }

      setMappedRanges(highlights.tabUrls, tab.id, match.indices);
      return;
    }
    case "tabNotes": {
      if (typeof match.refIndex !== "number") {
        return;
      }

      const tab = searchable.session.tabs[match.refIndex];
      if (!tab) {
        return;
      }

      setMappedRanges(highlights.tabNotes, tab.id, match.indices);
      return;
    }
    default:
      return;
  }
}

function buildSnippets(
  result: FuseResult<SearchableSession>,
  highlights: SessionSearchHighlights
): SessionSearchSnippet[] {
  const snippets: SessionSearchSnippet[] = [];

  for (const tab of result.item.session.tabs) {
    const titleRanges = highlights.tabTitles[tab.id];
    if (titleRanges?.length) {
      snippets.push({
        id: `${tab.id}-title`,
        kind: "tabTitle",
        text: tab.title,
        ranges: titleRanges,
      });
    }

    const urlRanges = highlights.tabUrls[tab.id];
    if (urlRanges?.length) {
      snippets.push({
        id: `${tab.id}-url`,
        kind: "tabUrl",
        text: tab.url,
        ranges: urlRanges,
      });
    }

    const noteRanges = highlights.tabNotes[tab.id];
    if (noteRanges?.length) {
      snippets.push({
        id: `${tab.id}-note`,
        kind: "tabNote",
        text: tab.note,
        ranges: noteRanges,
      });
    }
  }

  return snippets;
}

export function buildSearchIndex(
  sessions: Session[],
  folders: Folder[],
  tags: Tag[],
  settings?: Pick<Settings, "searchScopes" | "fuzzySearchThreshold">
): Fuse<SearchableSession> {
  return new Fuse(toSearchableSessions(sessions, folders, tags), buildFuseOptions(settings));
}

export function searchSessions(
  fuse: Fuse<SearchableSession>,
  query: string
): SessionSearchResult[] {
  if (!query.trim()) {
    return [];
  }

  return fuse.search(query).map((result) => {
    const highlights = createEmptyHighlights();
    for (const match of result.matches ?? []) {
      applyMatch(highlights, result.item, match);
    }

    return {
      session: result.item.session,
      highlights,
      snippets: buildSnippets(result, highlights),
    };
  });
}
