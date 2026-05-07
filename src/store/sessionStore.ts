import { create } from "zustand";
import type { Session, SortOption, TabItem, ViewFilter } from "@/types";
import { loadStorage, saveSessions } from "@/lib/storage";
import { clampText, cloneTabItem, generateId, sanitizeLabel, stripHtml } from "@/lib/tabHelpers";

interface SessionState {
  sessions: Session[];
  isLoaded: boolean;
  sortBy: SortOption;
  viewFilter: ViewFilter;
  activeFolderId: string | null;
  activeTagId: string | null;
  load: () => Promise<void>;
  createSession: (
    name: string,
    description: string,
    tabs: TabItem[],
    folderId?: string | null,
    tagIds?: string[],
  ) => Session;
  updateSession: (id: string, updates: Partial<Session>) => void;
  updateSessionNote: (id: string, note: string) => void;
  setSessionFolder: (id: string, folderId: string | null) => void;
  setSessionTags: (id: string, tagIds: string[]) => void;
  deleteSession: (id: string) => void;
  duplicateSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  pinSession: (id: string, pinned: boolean) => void;
  archiveSession: (id: string, archived: boolean) => void;
  addTabToSession: (sessionId: string, tab: TabItem) => boolean;
  removeTabFromSession: (sessionId: string, tabId: string) => void;
  updateTabNote: (sessionId: string, tabId: string, note: string) => void;
  updateTabReminder: (sessionId: string, tabId: string, reminderAt: number | null) => void;
  updateTabFolder: (sessionId: string, tabId: string, folderId: string | null) => void;
  updateTabTags: (sessionId: string, tabId: string, tagIds: string[]) => void;
  recordOpened: (id: string) => void;
  recordTabOpened: (sessionId: string, tabId: string) => void;
  unassignFolder: (folderId: string) => void;
  removeTagReferences: (tagId: string) => void;
  applyAutoArchive: (days: 30 | 60 | 90 | null) => void;
  setSortBy: (sort: SortOption) => void;
  setViewFilter: (filter: ViewFilter) => void;
  setActiveFolderId: (id: string | null) => void;
  setActiveTagId: (id: string | null) => void;
  importSessions: (sessions: Session[]) => void;
  clearSessions: () => void;
}

let writePromise: Promise<void> = Promise.resolve();
let folderIndex = new Map<string, Set<string>>();
let tagIndex = new Map<string, Set<string>>();

function persistSessions(sessions: Session[]): void {
  writePromise = writePromise.then(() => saveSessions(sessions));
  void writePromise;
}

function addToIndex(index: Map<string, Set<string>>, key: string | null | undefined, sessionId: string): void {
  if (!key) {
    return;
  }

  const values = index.get(key) ?? new Set<string>();
  values.add(sessionId);
  index.set(key, values);
}

function rebuildIndexes(sessions: Session[]): void {
  folderIndex = new Map();
  tagIndex = new Map();
  for (const session of sessions) {
    addToIndex(folderIndex, session.folderId, session.id);
    for (const tagId of session.tagIds) {
      addToIndex(tagIndex, tagId, session.id);
    }
    for (const tab of session.tabs) {
      addToIndex(folderIndex, tab.folderId, session.id);
      for (const tagId of tab.tagIds) {
        addToIndex(tagIndex, tagId, session.id);
      }
    }
  }
}

function setSessions(set: (partial: Partial<SessionState>) => void, sessions: Session[], persist = true): void {
  rebuildIndexes(sessions);
  set({ sessions });
  if (persist) {
    persistSessions(sessions);
  }
}

function reindexTabs(tabs: TabItem[]): TabItem[] {
  return tabs.map((tab, index) => ({
    ...tab,
    position: index,
  }));
}

function bumpSessionVersion(currentVersion: number | undefined): number {
  return Math.max(1, currentVersion ?? 1) + 1;
}

function touchSession(
  session: Session,
  updates: Partial<Session>,
  options?: { bumpVersion?: boolean; updatedAt?: number },
): Session {
  return {
    ...session,
    ...updates,
    updatedAt: options?.updatedAt ?? Date.now(),
    version: options?.bumpVersion === false ? session.version : bumpSessionVersion(session.version),
  };
}

function autoArchiveSessions(sessions: Session[], days: 30 | 60 | 90 | null): Session[] {
  if (!days) {
    return sessions;
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return sessions.map((session) => {
    if (session.isArchived) {
      return session;
    }

    const lastActiveAt = session.lastOpenedAt ?? session.updatedAt ?? session.createdAt;
    if (lastActiveAt > cutoff) {
      return session;
    }

    return {
      ...session,
      isArchived: true,
      updatedAt: Date.now(),
      version: bumpSessionVersion(session.version),
    };
  });
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  isLoaded: false,
  sortBy: "updatedAt",
  viewFilter: "all",
  activeFolderId: null,
  activeTagId: null,

  load: async () => {
    const data = await loadStorage();
    const sessions = autoArchiveSessions(data.sessions, data.settings.autoArchiveDays);
    rebuildIndexes(sessions);
    set({ sessions, isLoaded: true });
    if (sessions !== data.sessions) {
      persistSessions(sessions);
    }
  },

  createSession: (name, description, tabs, folderId = null, tagIds = []) => {
    const createdAt = Date.now();
    const normalizedTabs = reindexTabs(tabs);
    const session: Session = {
      id: generateId("session"),
      name: sanitizeLabel(name, "Untitled Session", 100),
      description: clampText(stripHtml(description), 300),
      folderId,
      tagIds,
      tabs: normalizedTabs,
      note: "",
      color: null,
      icon: null,
      openCount: 0,
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: null,
      version: 1,
      isPinned: false,
      isArchived: false,
    };
    const sessions = [session, ...get().sessions];
    setSessions(set, sessions);
    return session;
  },

  updateSession: (id, updates) => {
    const sanitizedUpdates: Partial<Session> = {
      ...updates,
      ...(typeof updates.name === "string"
        ? { name: sanitizeLabel(updates.name, "Untitled Session", 100) }
        : {}),
      ...(typeof updates.description === "string"
        ? { description: clampText(stripHtml(updates.description), 300) }
        : {}),
      ...(typeof updates.note === "string" ? { note: clampText(stripHtml(updates.note), 5000) } : {}),
    };
    const sessions = get().sessions.map((session) =>
      session.id === id
        ? touchSession(session, {
            ...sanitizedUpdates,
            tabs: updates.tabs ? reindexTabs(updates.tabs) : session.tabs,
          })
        : session,
    );
    setSessions(set, sessions);
  },

  updateSessionNote: (id, note) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { note: clampText(stripHtml(note), 5000) }) : session,
    );
    setSessions(set, sessions);
  },

  setSessionFolder: (id, folderId) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { folderId }) : session,
    );
    setSessions(set, sessions);
  },

  setSessionTags: (id, tagIds) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { tagIds }) : session,
    );
    setSessions(set, sessions);
  },

  deleteSession: (id) => {
    const sessions = get().sessions.filter((session) => session.id !== id);
    setSessions(set, sessions);
  },

  duplicateSession: (id) => {
    const original = get().sessions.find((session) => session.id === id);
    if (!original) {
      return;
    }

    const createdAt = Date.now();
    const copy: Session = {
      ...original,
      id: generateId("session"),
      name: sanitizeLabel(`${original.name} Copy`, "Session Copy", 100),
      tabs: reindexTabs(original.tabs.map(cloneTabItem)),
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: null,
      openCount: 0,
      version: 1,
    };
    const sessions = [copy, ...get().sessions];
    setSessions(set, sessions);
  },

  renameSession: (id, name) => {
    const trimmedName = sanitizeLabel(name, "", 100);
    if (!trimmedName) {
      return;
    }

    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { name: trimmedName }) : session,
    );
    setSessions(set, sessions);
  },

  pinSession: (id, pinned) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { isPinned: pinned }) : session,
    );
    setSessions(set, sessions);
  },

  archiveSession: (id, archived) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { isArchived: archived }) : session,
    );
    setSessions(set, sessions);
  },

  addTabToSession: (sessionId, tab) => {
    let added = false;
    const sessions = get().sessions.map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      const duplicate = session.tabs.some((existing) => existing.url === tab.url);
      if (duplicate) {
        return session;
      }

      added = true;
      return touchSession(session, {
        tabs: reindexTabs([...session.tabs, { ...tab, position: session.tabs.length }]),
      });
    });
    setSessions(set, sessions);
    return added;
  },

  removeTabFromSession: (sessionId, tabId) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? touchSession(session, {
            tabs: reindexTabs(session.tabs.filter((tab) => tab.id !== tabId)),
          })
        : session,
    );
    setSessions(set, sessions);
  },

  updateTabNote: (sessionId, tabId, note) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? touchSession(session, {
            tabs: session.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, note: clampText(stripHtml(note), 2000) } : tab,
            ),
          })
        : session,
    );
    setSessions(set, sessions);
  },

  updateTabReminder: (sessionId, tabId, reminderAt) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? touchSession(session, {
            tabs: session.tabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    reminderAt,
                    reminderSnoozedUntil: null,
                    reminderDismissed: false,
                  }
                : tab,
            ),
          })
        : session,
    );
    setSessions(set, sessions);
  },

  updateTabFolder: (sessionId, tabId, folderId) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? touchSession(session, {
            tabs: session.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, folderId } : tab,
            ),
          })
        : session,
    );
    setSessions(set, sessions);
  },

  updateTabTags: (sessionId, tabId, tagIds) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? touchSession(session, {
            tabs: session.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, tagIds } : tab,
            ),
          })
        : session,
    );
    setSessions(set, sessions);
  },

  recordOpened: (id) => {
    const openedAt = Date.now();
    const sessions = get().sessions.map((session) =>
      session.id === id
        ? {
            ...session,
            openCount: (session.openCount ?? 0) + 1,
            lastOpenedAt: openedAt,
            updatedAt: openedAt,
            tabs: session.tabs.map((tab) => ({
              ...tab,
              openCount: (tab.openCount ?? 0) + 1,
              lastOpenedAt: openedAt,
            })),
            version: bumpSessionVersion(session.version),
          }
        : session,
    );
    setSessions(set, sessions);
  },

  recordTabOpened: (sessionId, tabId) => {
    const openedAt = Date.now();
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            lastOpenedAt: openedAt,
            updatedAt: openedAt,
            tabs: session.tabs.map((tab) =>
              tab.id === tabId
                ? { ...tab, openCount: (tab.openCount ?? 0) + 1, lastOpenedAt: openedAt }
                : tab,
            ),
            version: bumpSessionVersion(session.version),
          }
        : session,
    );
    setSessions(set, sessions);
  },

  unassignFolder: (folderId) => {
    const affected = folderIndex.get(folderId) ?? new Set<string>();
    const sessions = get().sessions.map((session) =>
      affected.has(session.id)
        ? touchSession(session, {
            folderId: session.folderId === folderId ? null : session.folderId,
            tabs: session.tabs.map((tab) => ({
              ...tab,
              folderId: tab.folderId === folderId ? null : tab.folderId,
            })),
          })
        : session,
    );
    setSessions(set, sessions);
  },

  removeTagReferences: (tagId) => {
    const affected = tagIndex.get(tagId) ?? new Set<string>();
    const sessions = get().sessions.map((session) =>
      affected.has(session.id)
        ? {
            ...touchSession(session, {
              tagIds: session.tagIds.filter((existing) => existing !== tagId),
              tabs: session.tabs.map((tab) => ({
                ...tab,
                tagIds: tab.tagIds.filter((existing) => existing !== tagId),
              })),
            }),
          }
        : session,
    );
    setSessions(set, sessions);
  },

  applyAutoArchive: (days) => {
    const sessions = autoArchiveSessions(get().sessions, days);
    setSessions(set, sessions);
  },

  setSortBy: (sortBy) => set({ sortBy }),
  setViewFilter: (viewFilter) => set({ viewFilter }),
  setActiveFolderId: (activeFolderId) => set({ activeFolderId }),
  setActiveTagId: (activeTagId) => set({ activeTagId }),

  importSessions: (sessions) => {
    setSessions(set, sessions, false);
  },

  clearSessions: () => {
    setSessions(set, []);
  },
}));
