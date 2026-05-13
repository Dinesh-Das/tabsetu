import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openSavedTab, openSessionTabs } from "@/lib/sessionBrowser";
import { buildSearchIndex, buildSessionListItems } from "@/lib/sessionQuery";
import { chromeTabToTabItem, getPreferredBrowserTab, isRestrictedUrl } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import type { Session, SortOption, TabItem, ToastMessage } from "@/types";
import type { BulkActionBarProps } from "@/popup/components/BulkActionBar";
import type { QuickInfoCardProps, QuickInfoState } from "@/popup/components/QuickInfoCard";
import type { PopupSessionCardProps } from "@/popup/components/SessionCard";

export interface SavedSessionsControllerOptions {
  query: string;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onSaveNew: () => void;
  keyboardActive: boolean;
}

const POPUP_SORT_STORAGE_KEY = "tabsetu.popup.sort";
const DEFAULT_POPUP_SORT: SortOption = "updatedAt";

function isSortOption(value: string | null): value is SortOption {
  return (
    value === "createdAt" ||
    value === "updatedAt" ||
    value === "lastOpenedAt" ||
    value === "name" ||
    value === "tabCount"
  );
}

function readStoredPopupSort(): SortOption {
  try {
    const stored =
      typeof window === "undefined" ? null : window.localStorage.getItem(POPUP_SORT_STORAGE_KEY);
    return isSortOption(stored) ? stored : DEFAULT_POPUP_SORT;
  } catch {
    return DEFAULT_POPUP_SORT;
  }
}

export function useSavedSessionsController({
  query,
  addToast,
  onSaveNew,
  keyboardActive,
}: SavedSessionsControllerOptions) {
  const sessions = useSessionStore((state) => state.sessions);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const duplicateSession = useSessionStore((state) => state.duplicateSession);
  const pinSession = useSessionStore((state) => state.pinSession);
  const addTabToSession = useSessionStore((state) => state.addTabToSession);
  const updateTabNote = useSessionStore((state) => state.updateTabNote);
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const settings = useSettingsStore((state) => state.settings);

  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [activeTagId, setActiveTagId] = useState("");
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const [quickInfo, setQuickInfo] = useState<QuickInfoState | null>(null);
  const [quickInfoDraftNote, setQuickInfoDraftNote] = useState("");
  const [quickInfoEditing, setQuickInfoEditing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(readStoredPopupSort);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const quickInfoShowTimer = useRef<number | null>(null);
  const quickInfoHideTimer = useRef<number | null>(null);

  const searchIndex = useMemo(
    () => buildSearchIndex(sessions, folders, tags, settings),
    [folders, sessions, settings, tags]
  );
  const itemsForTagFilters = useMemo(
    () =>
      buildSessionListItems({
        sessions,
        folders,
        tags,
        settings,
        query,
        sortBy,
        folderId: activeFolderId || null,
        tagId: null,
        searchIndex,
      }),
    [activeFolderId, folders, query, searchIndex, sessions, settings, sortBy, tags]
  );
  const availableTags = useMemo(() => {
    const visibleTagIds = new Set(
      itemsForTagFilters.flatMap((item) => [
        ...item.session.tagIds,
        ...item.session.tabs.flatMap((tab) => tab.tagIds),
      ])
    );
    return tags.filter((tag) => visibleTagIds.has(tag.id));
  }, [itemsForTagFilters, tags]);
  const visibleItems = useMemo(
    () =>
      buildSessionListItems({
        sessions,
        folders,
        tags,
        settings,
        query,
        sortBy,
        folderId: activeFolderId || null,
        tagId: activeTagId || null,
        searchIndex,
      }),
    [activeFolderId, activeTagId, folders, query, searchIndex, sessions, settings, sortBy, tags]
  );
  const listKeyboardActive = keyboardActive && pendingDelete === null;

  const handleOpenSession = useCallback(
    async (session: Session, openInNewWindow = settings.openInNewWindow) => {
      const openedCount = await openSessionTabs(session, openInNewWindow);
      if (openedCount === 0) {
        addToast("error", "This session does not have any openable tabs.");
        return;
      }
      recordOpened(session.id);
      addToast(
        "success",
        `Opened "${session.name}" with ${openedCount} ${openedCount === 1 ? "tab" : "tabs"}.`
      );
    },
    [addToast, recordOpened, settings.openInNewWindow]
  );
  const handleOpenTab = useCallback(
    async (session: Session, tabId: string) => {
      const tab = session.tabs.find((item) => item.id === tabId);
      if (!tab || !(await openSavedTab(tab))) {
        addToast("error", "That saved tab could not be opened.");
        return;
      }
      recordTabOpened(session.id, tabId);
      addToast("success", `Opened ${tab.title}.`);
    },
    [addToast, recordTabOpened]
  );
  const handleDelete = useCallback(
    (session: Session) => {
      if (settings.confirmBeforeDelete) {
        setPendingDelete(session);
        return;
      }
      deleteSession(session.id);
      addToast("success", `Deleted "${session.name}".`);
    },
    [addToast, deleteSession, settings.confirmBeforeDelete]
  );
  const handleAddCurrentTab = useCallback(
    async (session: Session) => {
      const activeTab = await getPreferredBrowserTab();
      if (!activeTab?.url || isRestrictedUrl(activeTab.url)) {
        addToast("error", "The active tab cannot be saved into this session.");
        return;
      }
      const added = addTabToSession(session.id, chromeTabToTabItem(activeTab));
      addToast(
        added ? "success" : "info",
        added
          ? `Added ${activeTab.title ?? "the current tab"} to "${session.name}".`
          : "That tab is already in this session."
      );
    },
    [addTabToSession, addToast]
  );
  const showQuickInfo = useCallback(
    (sessionId: string, tab: TabItem, x: number, y: number) => {
      if (!settings.quickInfoEnabled) {
        return;
      }
      if (quickInfoShowTimer.current) {
        window.clearTimeout(quickInfoShowTimer.current);
      }
      if (quickInfoHideTimer.current) {
        window.clearTimeout(quickInfoHideTimer.current);
      }
      quickInfoShowTimer.current = window.setTimeout(() => {
        setQuickInfo({
          sessionId,
          tab,
          x: Math.min(x + 14, window.innerWidth - 338),
          y: Math.min(y + 14, window.innerHeight - 276),
        });
        setQuickInfoDraftNote(tab.note);
        setQuickInfoEditing(false);
      }, settings.quickInfoDelayMs ?? 400);
    },
    [settings.quickInfoDelayMs, settings.quickInfoEnabled]
  );
  const hideQuickInfo = useCallback(() => {
    if (quickInfoShowTimer.current) {
      window.clearTimeout(quickInfoShowTimer.current);
    }
    if (quickInfoHideTimer.current) {
      window.clearTimeout(quickInfoHideTimer.current);
    }
    quickInfoHideTimer.current = window.setTimeout(() => {
      setQuickInfo(null);
      setQuickInfoEditing(false);
    }, 160);
  }, []);
  const handleQuickInfoSave = useCallback(() => {
    if (!quickInfo) {
      return;
    }
    updateTabNote(quickInfo.sessionId, quickInfo.tab.id, quickInfoDraftNote);
    setQuickInfo((current) =>
      current ? { ...current, tab: { ...current.tab, note: quickInfoDraftNote } } : null
    );
    setQuickInfoEditing(false);
    addToast("success", "Saved tab note.");
  }, [addToast, quickInfo, quickInfoDraftNote, updateTabNote]);

  useEffect(() => {
    try {
      window.localStorage.setItem(POPUP_SORT_STORAGE_KEY, sortBy);
    } catch {
      return;
    }
  }, [sortBy]);
  useEffect(() => {
    if (activeFolderId && !folders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId("");
    }
  }, [activeFolderId, folders]);
  useEffect(() => {
    if (activeTagId && !availableTags.some((tag) => tag.id === activeTagId)) {
      setActiveTagId("");
    }
  }, [activeTagId, availableTags]);
  useEffect(
    () => () => {
      if (quickInfoShowTimer.current) {
        window.clearTimeout(quickInfoShowTimer.current);
      }
      if (quickInfoHideTimer.current) {
        window.clearTimeout(quickInfoHideTimer.current);
      }
    },
    []
  );
  useEffect(() => setKeyboardIndex(0), [activeFolderId, activeTagId, query, sortBy]);
  useEffect(
    () => setKeyboardIndex((current) => Math.min(current, Math.max(visibleItems.length - 1, 0))),
    [visibleItems.length]
  );
  useEffect(() => {
    if (!listKeyboardActive) {
      return;
    }
    const activeSession = visibleItems[keyboardIndex]?.session;
    if (activeSession) {
      itemRefs.current[activeSession.id]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [keyboardIndex, listKeyboardActive, visibleItems]);
  useEffect(() => {
    if (!quickInfo) {
      return;
    }
    const latestTab = sessions
      .find((session) => session.id === quickInfo.sessionId)
      ?.tabs.find((tab) => tab.id === quickInfo.tab.id);
    if (!latestTab) {
      setQuickInfo(null);
      setQuickInfoEditing(false);
    } else if (quickInfo.tab !== latestTab) {
      setQuickInfo((current) => (current ? { ...current, tab: latestTab } : null));
      if (!quickInfoEditing) {
        setQuickInfoDraftNote(latestTab.note);
      }
    } else if (!quickInfoEditing && quickInfoDraftNote !== latestTab.note) {
      setQuickInfoDraftNote(latestTab.note);
    }
  }, [quickInfo, quickInfoDraftNote, quickInfoEditing, sessions]);
  useEffect(() => {
    if (!listKeyboardActive) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const tagName = document.activeElement?.tagName ?? "";
      const isSearchInput =
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.id === "tabsetu-popup-search";
      if (
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        tagName === "BUTTON" ||
        (tagName === "INPUT" && !isSearchInput)
      ) {
        return;
      }
      if (event.key === "ArrowDown") {
        setKeyboardIndex((current) => Math.min(current + 1, visibleItems.length - 1));
      } else if (event.key === "ArrowUp") {
        setKeyboardIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Home") {
        setKeyboardIndex(0);
      } else if (event.key === "End") {
        setKeyboardIndex(visibleItems.length - 1);
      } else if (event.key === "Enter" && visibleItems[keyboardIndex]) {
        void handleOpenSession(visibleItems[keyboardIndex].session);
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleOpenSession, keyboardIndex, listKeyboardActive, visibleItems]);

  const bulkActionBarProps: BulkActionBarProps = {
    activeFolderId,
    activeTagId,
    availableTags,
    folders,
    onSaveNew,
    onSortChange: setSortBy,
    setActiveFolderId,
    setActiveTagId,
    sortBy,
    visibleCount: visibleItems.length,
  };

  const quickInfoProps: QuickInfoCardProps | null = quickInfo
    ? {
        draftNote: quickInfoDraftNote,
        editing: quickInfoEditing,
        onCancelEdit: () => {
          setQuickInfoDraftNote(quickInfo.tab.note);
          setQuickInfoEditing(false);
        },
        onDraftNoteChange: setQuickInfoDraftNote,
        onEdit: () => setQuickInfoEditing(true),
        onMouseEnter: () => {
          if (quickInfoShowTimer.current) {
            window.clearTimeout(quickInfoShowTimer.current);
          }
          if (quickInfoHideTimer.current) {
            window.clearTimeout(quickInfoHideTimer.current);
          }
        },
        onMouseLeave: hideQuickInfo,
        onOpenTab: (session, tabId) => void handleOpenTab(session, tabId),
        onSave: handleQuickInfoSave,
        quickInfo,
        sessions,
      }
    : null;

  const getCardProps = (
    item: (typeof visibleItems)[number],
    index: number
  ): PopupSessionCardProps => ({
    item,
    isKeyboardSelected: listKeyboardActive && keyboardIndex === index,
    onAddCurrentTab: (session) => void handleAddCurrentTab(session),
    onDelete: handleDelete,
    onDuplicate: (session) => {
      duplicateSession(session.id);
      addToast("success", `Duplicated "${session.name}".`);
    },
    onMouseEnter: () => setKeyboardIndex(index),
    onOpenSession: (session, openInNewWindow) => void handleOpenSession(session, openInNewWindow),
    onOpenTab: (session, tabId) => void handleOpenTab(session, tabId),
    onPin: (session) => pinSession(session.id, !session.isPinned),
    onRef: (node) => {
      itemRefs.current[item.session.id] = node;
    },
    showQuickInfo,
    hideQuickInfo,
  });

  return {
    visibleItems,
    bulkActionBarProps,
    quickInfoProps,
    pendingDelete,
    getCardProps,
    closePendingDelete: () => setPendingDelete(null),
    confirmPendingDelete: () => {
      if (!pendingDelete) {
        return;
      }
      deleteSession(pendingDelete.id);
      addToast("success", `Deleted "${pendingDelete.name}".`);
      setPendingDelete(null);
    },
  };
}
