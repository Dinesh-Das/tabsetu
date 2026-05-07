import Fuse from "fuse.js";
import { buildSearchIndex, searchSessions, type SearchableSession, type SessionSearchResult } from "@/lib/fuzzySearch";
import type {
  Folder,
  Session,
  Settings,
  SortOption,
  Tag,
  ViewFilter,
} from "@/types";

export interface SessionListItem {
  session: Session;
  folder: Folder | null;
  tags: Tag[];
  searchResult: SessionSearchResult | null;
}

interface QueryOptions {
  sessions: Session[];
  folders: Folder[];
  tags: Tag[];
  settings: Pick<Settings, "searchScopes" | "fuzzySearchThreshold">;
  query: string;
  sortBy: SortOption;
  viewFilter?: ViewFilter;
  folderId?: string | null;
  tagId?: string | null;
  searchIndex?: Fuse<SearchableSession>;
}

export { buildSearchIndex } from "@/lib/fuzzySearch";

export function sortSessions(sessions: Session[], sortBy: SortOption): Session[] {
  const copy = [...sessions];

  copy.sort((left, right) => {
    switch (sortBy) {
      case "name":
        return left.name.localeCompare(right.name);
      case "tabCount":
        return right.tabs.length - left.tabs.length;
      case "createdAt":
        return right.createdAt - left.createdAt;
      case "lastOpenedAt":
        return (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0);
      case "updatedAt":
      default:
        return right.updatedAt - left.updatedAt;
    }
  });

  return copy;
}

function filterSessions(
  sessions: Session[],
  viewFilter: ViewFilter,
  folderId: string | null,
  tagId: string | null,
): Session[] {
  let visible = sessions;

  if (viewFilter === "pinned") {
    visible = visible.filter((session) => session.isPinned && !session.isArchived);
  } else if (viewFilter === "archived") {
    visible = visible.filter((session) => session.isArchived);
  } else {
    visible = visible.filter((session) => !session.isArchived);
  }

  if (folderId) {
    visible = visible.filter(
      (session) =>
        session.folderId === folderId ||
        session.tabs.some((tab) => tab.folderId === folderId),
    );
  }

  if (tagId) {
    visible = visible.filter(
      (session) =>
        session.tagIds.includes(tagId) ||
        session.tabs.some((tab) => tab.tagIds.includes(tagId)),
    );
  }

  return visible;
}

export function buildSessionListItems({
  sessions,
  folders,
  tags,
  settings,
  query,
  sortBy,
  viewFilter = "all",
  folderId = null,
  tagId = null,
  searchIndex,
}: QueryOptions): SessionListItem[] {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));

  let visible = filterSessions(sessions, viewFilter, folderId, tagId);
  const trimmedQuery = query.trim();
  const searchResultsById = new Map<string, SessionSearchResult>();

  if (trimmedQuery) {
    if (!Object.values(settings.searchScopes).some(Boolean)) {
      return [];
    }

    const searchResults = searchSessions(searchIndex ?? buildSearchIndex(visible, folders, tags, settings), trimmedQuery);

    visible = searchResults.map((result) => result.session);
    for (const result of searchResults) {
      searchResultsById.set(result.session.id, result);
    }
  }

  return sortSessions(visible, sortBy).map((session) => ({
    session,
    folder: session.folderId ? folderMap.get(session.folderId) ?? null : null,
    tags: session.tagIds
      .map((tagId) => tagMap.get(tagId) ?? null)
      .filter((tag): tag is Tag => Boolean(tag)),
    searchResult: searchResultsById.get(session.id) ?? null,
  }));
}
