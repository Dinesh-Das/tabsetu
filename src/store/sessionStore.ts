import { create } from "zustand";
import type { Session, SortOption, TabItem, ViewFilter } from "@/types";
import { loadStorage, saveSessions } from "@/lib/storage";
import { cloneTabItem, generateId } from "@/lib/tabHelpers";

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

function persistSessions(sessions: Session[]): void {
  void saveSessions(sessions);
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
      name: name.trim() || "Untitled Session",
      description: description.trim(),
      folderId,
      tagIds,
      tabs: normalizedTabs,
      note: "",
      color: null,
      icon: null,
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: null,
      version: 1,
      isPinned: false,
      isArchived: false,
    };
    const sessions = [session, ...get().sessions];
    set({ sessions });
    persistSessions(sessions);
    return session;
  },

  updateSession: (id, updates) => {
    const sessions = get().sessions.map((session) =>
      session.id === id
        ? touchSession(session, {
            ...updates,
            tabs: updates.tabs ? reindexTabs(updates.tabs) : session.tabs,
          })
        : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  updateSessionNote: (id, note) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { note }) : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  setSessionFolder: (id, folderId) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { folderId }) : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  setSessionTags: (id, tagIds) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { tagIds }) : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  deleteSession: (id) => {
    const sessions = get().sessions.filter((session) => session.id !== id);
    set({ sessions });
    persistSessions(sessions);
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
      name: `${original.name} Copy`,
      tabs: reindexTabs(original.tabs.map(cloneTabItem)),
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: null,
      version: 1,
    };
    const sessions = [copy, ...get().sessions];
    set({ sessions });
    persistSessions(sessions);
  },

  renameSession: (id, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { name: trimmedName }) : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  pinSession: (id, pinned) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { isPinned: pinned }) : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  archiveSession: (id, archived) => {
    const sessions = get().sessions.map((session) =>
      session.id === id ? touchSession(session, { isArchived: archived }) : session,
    );
    set({ sessions });
    persistSessions(sessions);
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
    set({ sessions });
    persistSessions(sessions);
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
    set({ sessions });
    persistSessions(sessions);
  },

  updateTabNote: (sessionId, tabId, note) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId
        ? touchSession(session, {
            tabs: session.tabs.map((tab) => (tab.id === tabId ? { ...tab, note } : tab)),
          })
        : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  recordOpened: (id) => {
    const openedAt = Date.now();
    const sessions = get().sessions.map((session) =>
      session.id === id
        ? {
            ...session,
            lastOpenedAt: openedAt,
            updatedAt: openedAt,
            tabs: session.tabs.map((tab) => ({ ...tab, lastOpenedAt: openedAt })),
            version: bumpSessionVersion(session.version),
          }
        : session,
    );
    set({ sessions });
    persistSessions(sessions);
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
              tab.id === tabId ? { ...tab, lastOpenedAt: openedAt } : tab,
            ),
            version: bumpSessionVersion(session.version),
          }
        : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  unassignFolder: (folderId) => {
    const sessions = get().sessions.map((session) =>
      session.folderId === folderId
        ? touchSession(session, { folderId: null })
        : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  removeTagReferences: (tagId) => {
    const sessions = get().sessions.map((session) =>
      session.tagIds.includes(tagId)
        ? {
            ...touchSession(session, {
              tagIds: session.tagIds.filter((existing) => existing !== tagId),
            }),
          }
        : session,
    );
    set({ sessions });
    persistSessions(sessions);
  },

  applyAutoArchive: (days) => {
    const sessions = autoArchiveSessions(get().sessions, days);
    set({ sessions });
    persistSessions(sessions);
  },

  setSortBy: (sortBy) => set({ sortBy }),
  setViewFilter: (viewFilter) => set({ viewFilter }),
  setActiveFolderId: (activeFolderId) => set({ activeFolderId }),
  setActiveTagId: (activeTagId) => set({ activeTagId }),

  importSessions: (sessions) => {
    set({ sessions });
    persistSessions(sessions);
  },

  clearSessions: () => {
    set({ sessions: [] });
    persistSessions([]);
  },
}));
