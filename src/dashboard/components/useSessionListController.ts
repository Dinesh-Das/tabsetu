import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { openSessionTabsDetailed } from "@/lib/sessionBrowser";
import { buildSearchIndex, buildSessionListItems, type SessionListItem } from "@/lib/sessionQuery";
import { useFolderStore } from "@/store/folderStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import type { Session, ToastMessage } from "@/types";
import type { DashboardSessionCardProps } from "@/dashboard/components/SessionCard";
import type {
  DuplicateGroup,
  SessionListToolbarProps,
} from "@/dashboard/components/SessionListToolbar";

export interface SessionListControllerOptions {
  selectedSessionId: string | null;
  onSelect: (sessionId: string | null) => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
  initialSavePrompt?: { mode: "save" | "collapse"; sourceTabId: number | null } | null | undefined;
  onInitialSavePromptHandled?: (() => void) | undefined;
}

function isSuspendResponse(value: unknown): value is { ok: boolean; count?: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}

export function useSessionListController({
  selectedSessionId,
  onSelect,
  addToast,
  initialSavePrompt,
  onInitialSavePromptHandled,
}: SessionListControllerOptions) {
  const sessions = useSessionStore((state) => state.sessions);
  const sortBy = useSessionStore((state) => state.sortBy);
  const viewFilter = useSessionStore((state) => state.viewFilter);
  const activeFolderId = useSessionStore((state) => state.activeFolderId);
  const activeTagId = useSessionStore((state) => state.activeTagId);
  const setSortBy = useSessionStore((state) => state.setSortBy);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const duplicateSession = useSessionStore((state) => state.duplicateSession);
  const pinSession = useSessionStore((state) => state.pinSession);
  const archiveSession = useSessionStore((state) => state.archiveSession);
  const setSessionFolder = useSessionStore((state) => state.setSessionFolder);
  const renameSession = useSessionStore((state) => state.renameSession);
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const schedules = useScheduleStore((state) => state.schedules);
  const settings = useSettingsStore((state) => state.settings);

  const [query, setQuery] = useState("");
  const [saveModalPrompt, setSaveModalPrompt] = useState<{
    mode: "save" | "collapse";
    sourceTabId: number | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState("");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const deferredQuery = useDebouncedValue(query, 150);
  const searchRef = useRef<HTMLInputElement>(null);

  const searchIndex = useMemo(
    () => buildSearchIndex(sessions, folders, tags, settings),
    [folders, sessions, settings, tags]
  );
  const filteredItems = useMemo(
    () =>
      buildSessionListItems({
        sessions,
        folders,
        tags,
        settings,
        query: deferredQuery,
        sortBy,
        viewFilter,
        folderId: activeFolderId,
        tagId: activeTagId,
        searchIndex,
      }),
    [
      activeFolderId,
      activeTagId,
      deferredQuery,
      folders,
      searchIndex,
      sessions,
      settings,
      sortBy,
      tags,
      viewFilter,
    ]
  );
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedIds.includes(session.id)),
    [selectedIds, sessions]
  );
  const visibleSessionIds = useMemo(
    () => filteredItems.map((item) => item.session.id),
    [filteredItems]
  );
  const sessionCounts = useMemo(
    () => ({
      total: sessions.filter((session) => !session.isArchived).length,
      pinned: sessions.filter((session) => session.isPinned && !session.isArchived).length,
      archived: sessions.filter((session) => session.isArchived).length,
      tabs: sessions.reduce((total, session) => total + session.tabs.length, 0),
    }),
    [sessions]
  );
  const schedulesBySessionId = useMemo(() => {
    const map = new Map<string, typeof schedules>();
    for (const schedule of schedules.filter((item) => item.enabled)) {
      map.set(schedule.sessionId, [...(map.get(schedule.sessionId) ?? []), schedule]);
    }
    return map;
  }, [schedules]);
  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const groups = new Map<string, DuplicateGroup["appearances"]>();
    for (const session of sessions) {
      for (const tab of session.tabs) {
        const normalizedUrl = tab.url.trim().toLowerCase();
        if (!normalizedUrl) {
          continue;
        }
        groups.set(normalizedUrl, [
          ...(groups.get(normalizedUrl) ?? []),
          {
            sessionId: session.id,
            sessionName: session.name,
            tabId: tab.id,
            tabTitle: tab.title || tab.url,
          },
        ]);
      }
    }
    return [...groups.entries()]
      .map(([url, appearances]) => ({ url, appearances }))
      .filter((group) => new Set(group.appearances.map((item) => item.sessionId)).size > 1)
      .sort((left, right) => right.appearances.length - left.appearances.length);
  }, [sessions]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => sessions.some((session) => session.id === id))
    );
  }, [sessions]);

  useEffect(() => {
    if (!initialSavePrompt) {
      return;
    }
    setSaveModalPrompt(initialSavePrompt);
    onInitialSavePromptHandled?.();
  }, [initialSavePrompt, onInitialSavePromptHandled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.shiftKey && (event.ctrlKey || event.metaKey);
      const alt = event.shiftKey && event.altKey;
      const legacy = event.shiftKey && (event.ctrlKey || event.metaKey || event.altKey);
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if ((alt && key === "y") || (command && key === "y") || (legacy && key === "s")) {
        event.preventDefault();
        setSaveModalPrompt({ mode: "save", sourceTabId: null });
      }
      if ((alt && key === "u") || (command && key === "u") || (legacy && key === "c")) {
        event.preventDefault();
        setSaveModalPrompt({ mode: "collapse", sourceTabId: null });
      }
      if (event.key === "Escape" && query) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [query]);

  const clearBulkSelection = () => {
    setSelectedIds([]);
    setBulkFolderId("");
  };
  const toggleSelected = (sessionId: string) => {
    setSelectedIds((current) =>
      current.includes(sessionId)
        ? current.filter((selectedId) => selectedId !== sessionId)
        : [...current, sessionId]
    );
  };
  const deleteSelectedSessions = () => {
    selectedIds.forEach(deleteSession);
    addToast(
      "success",
      `Deleted ${selectedIds.length} ${selectedIds.length === 1 ? "session" : "sessions"}.`
    );
    if (selectedSessionId && selectedIds.includes(selectedSessionId)) {
      onSelect(null);
    }
    clearBulkSelection();
    setPendingBulkDelete(false);
  };
  const handleOpen = async (session: Session, openInNewWindow = settings.openInNewWindow) => {
    const result = await openSessionTabsDetailed(session, openInNewWindow);
    if (result.openedCount === 0) {
      addToast(
        "error",
        result.failedTabs.length > 0
          ? `TabSetu could not open ${result.failedTabs.length} saved tabs.`
          : "That session has no openable tabs."
      );
      return;
    }
    recordOpened(session.id);
    addToast(
      result.failedTabs.length > 0 || result.warnings.length > 0 ? "error" : "success",
      result.failedTabs.length > 0 || result.warnings.length > 0
        ? `Opened ${result.openedCount} tabs; some tabs or groups could not be restored.`
        : `Opened "${session.name}".`
    );
  };
  const handleDelete = (session: Session) => {
    if (settings.confirmBeforeDelete) {
      setPendingDelete(session);
      return;
    }
    deleteSession(session.id);
    if (selectedSessionId === session.id) {
      onSelect(null);
    }
    addToast("success", `Deleted "${session.name}".`);
  };
  const commitInlineRename = (session: Session) => {
    const trimmed = editingSessionName.trim();
    if (trimmed && trimmed !== session.name) {
      renameSession(session.id, trimmed);
      addToast("success", `Renamed session to "${trimmed}".`);
    }
    setEditingSessionId(null);
    setEditingSessionName("");
  };
  const handleSuspendBackgroundTabs = async () => {
    const response: unknown = await chrome.runtime.sendMessage({
      type: "tabsetu:suspend-background-tabs",
    });
    if (!isSuspendResponse(response) || !response.ok) {
      addToast("error", "TabSetu could not suspend background tabs.");
      return;
    }
    const count = response.count ?? 0;
    addToast(
      count === 0 ? "info" : "success",
      count === 0
        ? "No background tabs were available to suspend."
        : `Suspended ${count} ${count === 1 ? "background tab" : "background tabs"}.`
    );
  };

  const toolbarProps: SessionListToolbarProps = {
    query,
    sortBy,
    selectMode,
    showDuplicates,
    selectedIds,
    visibleSessionIds,
    selectedSessions,
    folders,
    bulkFolderId,
    duplicateGroups,
    sessionCounts,
    searchRef,
    onQueryChange: setQuery,
    onSortChange: setSortBy,
    onToggleSelectMode: () => {
      setSelectMode((current) => !current);
      clearBulkSelection();
    },
    onToggleDuplicates: () => setShowDuplicates((current) => !current),
    onSuspendBackgroundTabs: () => void handleSuspendBackgroundTabs(),
    onSaveCurrentWindow: () => setSaveModalPrompt({ mode: "save", sourceTabId: null }),
    onSelectAllVisible: () => {
      setSelectedIds((current) => {
        const visible = new Set(visibleSessionIds);
        return visibleSessionIds.length !== 0 &&
          visibleSessionIds.every((id) => current.includes(id))
          ? current.filter((id) => !visible.has(id))
          : [...new Set([...current, ...visibleSessionIds])];
      });
    },
    onBulkFolderChange: setBulkFolderId,
    onBulkMove: () => {
      selectedIds.forEach((id) => setSessionFolder(id, bulkFolderId || null));
      addToast(
        "success",
        `Moved ${selectedIds.length} ${selectedIds.length === 1 ? "session" : "sessions"}.`
      );
      clearBulkSelection();
    },
    onBulkArchive: () => {
      const unarchive =
        selectedSessions.length !== 0 && selectedSessions.every((session) => session.isArchived);
      selectedIds.forEach((id) => archiveSession(id, !unarchive));
      addToast(
        "success",
        unarchive ? "Restored selected sessions." : "Archived selected sessions."
      );
      clearBulkSelection();
    },
    onBulkDelete: () =>
      settings.confirmBeforeDelete ? setPendingBulkDelete(true) : deleteSelectedSessions(),
    onClearBulkSelection: clearBulkSelection,
    onSelectSession: onSelect,
  };

  const getCardProps = (item: SessionListItem): DashboardSessionCardProps => ({
    item,
    active: selectedSessionId === item.session.id,
    selected: selectedIds.includes(item.session.id),
    selectMode,
    cardStyle: settings.sessionCardStyle,
    nextSchedule: schedulesBySessionId.get(item.session.id)?.[0] ?? null,
    editingSessionId,
    editingSessionName,
    onSelect,
    onToggleSelected: toggleSelected,
    onPin: (session) => pinSession(session.id, !session.isPinned),
    onStartRename: (session) => {
      setEditingSessionId(session.id);
      setEditingSessionName(session.name);
    },
    onRenameNameChange: setEditingSessionName,
    onCommitRename: commitInlineRename,
    onCancelRename: () => {
      setEditingSessionId(null);
      setEditingSessionName("");
    },
    onOpen: (session, newWindow) => void handleOpen(session, newWindow),
    onDuplicate: (session) => {
      duplicateSession(session.id);
      addToast("success", `Duplicated "${session.name}".`);
    },
    onArchive: (session) => archiveSession(session.id, !session.isArchived),
    onDelete: handleDelete,
  });

  return {
    filteredItems,
    toolbarProps,
    getCardProps,
    saveModalPrompt,
    pendingDelete,
    pendingBulkDelete,
    selectedIds,
    gridTemplateColumns:
      settings.sessionCardStyle === "compact"
        ? "1fr"
        : settings.sessionCardStyle === "grid"
          ? "repeat(auto-fill, minmax(220px, 1fr))"
          : "repeat(auto-fill, minmax(280px, 1fr))",
    sessionCardStyle: settings.sessionCardStyle,
    closeSaveModal: () => setSaveModalPrompt(null),
    closePendingDelete: () => setPendingDelete(null),
    confirmPendingDelete: () => {
      if (!pendingDelete) {
        return;
      }
      deleteSession(pendingDelete.id);
      if (selectedSessionId === pendingDelete.id) {
        onSelect(null);
      }
      addToast("success", `Deleted "${pendingDelete.name}".`);
      setPendingDelete(null);
    },
    closePendingBulkDelete: () => setPendingBulkDelete(false),
    confirmBulkDelete: deleteSelectedSessions,
  };
}
