import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, FolderOpen, Pin, Plus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import HighlightedText from "@/components/shared/HighlightedText";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { TabSetuLogo } from "@/components/shared/TabSetuLogo";
import { useFavicons } from "@/hooks/useFavicons";
import { formatDateTime } from "@/lib/format";
import { toLucideExportName } from "@/lib/sessionLabels";
import { buildSearchIndex, buildSessionListItems } from "@/lib/sessionQuery";
import { getDomainLabel, openSavedTab, openSessionTabs } from "@/lib/sessionBrowser";
import { chromeTabToTabItem, getPreferredBrowserTab, isRestrictedUrl } from "@/lib/tabHelpers";
import type { Session, SortOption, TabItem, ToastMessage } from "@/types";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";

interface Props {
  query: string;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onSaveNew: () => void;
  keyboardActive: boolean;
}

const POPUP_SORT_STORAGE_KEY = "tabsetu.popup.sort";
const DEFAULT_POPUP_SORT: SortOption = "updatedAt";
const POPUP_SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "updatedAt", label: "Recently updated" },
  { value: "lastOpenedAt", label: "Recently opened" },
  { value: "name", label: "Alphabetical" },
  { value: "tabCount", label: "Tab count" },
  { value: "createdAt", label: "Recently created" },
];

function getSessionIcon(
  icon: string | null
): ComponentType<{ size?: number; "aria-hidden"?: boolean }> | null {
  if (!icon) {
    return null;
  }

  const iconName = toLucideExportName(icon);
  const lucideIcons = LucideIcons as unknown as Record<
    string,
    ComponentType<{ size?: number; "aria-hidden"?: boolean }>
  >;
  return iconName in LucideIcons ? (lucideIcons[iconName] ?? null) : null;
}

function isSortOption(value: string | null): value is SortOption {
  switch (value) {
    case "createdAt":
    case "updatedAt":
    case "lastOpenedAt":
    case "name":
    case "tabCount":
      return true;
    default:
      return false;
  }
}

function readStoredPopupSort(): SortOption {
  if (typeof window === "undefined") {
    return DEFAULT_POPUP_SORT;
  }

  try {
    const stored = window.localStorage.getItem(POPUP_SORT_STORAGE_KEY);
    return isSortOption(stored) ? stored : DEFAULT_POPUP_SORT;
  } catch {
    return DEFAULT_POPUP_SORT;
  }
}

export default function SavedSessions({ query, addToast, onSaveNew, keyboardActive }: Props) {
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
  const [quickInfo, setQuickInfo] = useState<{
    sessionId: string;
    tab: TabItem;
    x: number;
    y: number;
  } | null>(null);
  const [quickInfoDraftNote, setQuickInfoDraftNote] = useState("");
  const [quickInfoEditing, setQuickInfoEditing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(readStoredPopupSort);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const quickInfoShowTimer = useRef<number | null>(null);
  const quickInfoHideTimer = useRef<number | null>(null);
  const favicons = useFavicons();
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

  useEffect(() => {
    return () => {
      if (quickInfoShowTimer.current) {
        window.clearTimeout(quickInfoShowTimer.current);
      }
      if (quickInfoHideTimer.current) {
        window.clearTimeout(quickInfoHideTimer.current);
      }
    };
  }, []);

  const listKeyboardActive = keyboardActive && pendingDelete === null;

  useEffect(() => {
    setKeyboardIndex(0);
  }, [activeFolderId, activeTagId, query, sortBy]);

  useEffect(() => {
    if (visibleItems.length === 0) {
      setKeyboardIndex(0);
      return;
    }

    setKeyboardIndex((current) => Math.min(current, visibleItems.length - 1));
  }, [visibleItems.length]);

  const handleOpenSession = async (
    session: Session,
    openInNewWindow = settings.openInNewWindow
  ) => {
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
  };

  const handleOpenTab = async (session: Session, tabId: string) => {
    const tab = session.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }

    const opened = await openSavedTab(tab);
    if (!opened) {
      addToast("error", "That saved tab could not be opened.");
      return;
    }

    recordTabOpened(session.id, tabId);
    addToast("success", `Opened ${tab.title}.`);
  };

  const handleDelete = (session: Session) => {
    if (settings.confirmBeforeDelete) {
      setPendingDelete(session);
      return;
    }

    deleteSession(session.id);
    addToast("success", `Deleted "${session.name}".`);
  };

  const handleAddCurrentTab = async (session: Session) => {
    const activeTab = await getPreferredBrowserTab();
    if (!activeTab?.url || isRestrictedUrl(activeTab.url)) {
      addToast("error", "The active tab cannot be saved into this session.");
      return;
    }

    const added = addTabToSession(session.id, chromeTabToTabItem(activeTab));
    if (!added) {
      addToast("info", "That tab is already in this session.");
      return;
    }

    addToast("success", `Added ${activeTab.title ?? "the current tab"} to "${session.name}".`);
  };

  const showQuickInfo = (sessionId: string, tab: TabItem, x: number, y: number) => {
    if (!settings.quickInfoEnabled) {
      return;
    }

    if (quickInfoShowTimer.current) {
      window.clearTimeout(quickInfoShowTimer.current);
    }
    if (quickInfoHideTimer.current) {
      window.clearTimeout(quickInfoHideTimer.current);
    }

    const delay = settings.quickInfoDelayMs ?? 400;
    quickInfoShowTimer.current = window.setTimeout(() => {
      setQuickInfo({
        sessionId,
        tab,
        x: Math.min(x + 14, window.innerWidth - 338),
        y: Math.min(y + 14, window.innerHeight - 276),
      });
      setQuickInfoDraftNote(tab.note);
      setQuickInfoEditing(false);
    }, delay);
  };

  const hideQuickInfo = () => {
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
  };

  const handleQuickInfoSave = () => {
    if (!quickInfo) {
      return;
    }

    updateTabNote(quickInfo.sessionId, quickInfo.tab.id, quickInfoDraftNote);
    setQuickInfo((current) =>
      current
        ? {
            ...current,
            tab: {
              ...current.tab,
              note: quickInfoDraftNote,
            },
          }
        : null
    );
    setQuickInfoEditing(false);
    addToast("success", "Saved tab note.");
  };

  useEffect(() => {
    if (!listKeyboardActive || visibleItems.length === 0) {
      return;
    }

    const activeSession = visibleItems[keyboardIndex]?.session;
    if (!activeSession) {
      return;
    }

    itemRefs.current[activeSession.id]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardIndex, listKeyboardActive, visibleItems]);

  useEffect(() => {
    if (!quickInfo) {
      return;
    }

    const latestSession = sessions.find((session) => session.id === quickInfo.sessionId);
    const latestTab = latestSession?.tabs.find((tab) => tab.id === quickInfo.tab.id);
    if (!latestTab) {
      setQuickInfo(null);
      setQuickInfoEditing(false);
      return;
    }

    if (quickInfo.tab === latestTab) {
      if (!quickInfoEditing && quickInfoDraftNote !== latestTab.note) {
        setQuickInfoDraftNote(latestTab.note);
      }
      return;
    }

    setQuickInfo((current) =>
      current
        ? {
            ...current,
            tab: latestTab,
          }
        : null
    );

    if (!quickInfoEditing) {
      setQuickInfoDraftNote(latestTab.note);
    }
  }, [quickInfo, quickInfoDraftNote, quickInfoEditing, sessions]);

  useEffect(() => {
    if (!listKeyboardActive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (visibleItems.length === 0) {
        return;
      }

      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName ?? "";
      const isSearchInput =
        activeElement instanceof HTMLInputElement && activeElement.id === "tabsetu-popup-search";
      const blocksKeyboardListControl =
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        tagName === "BUTTON" ||
        (tagName === "INPUT" && !isSearchInput);

      if (blocksKeyboardListControl) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setKeyboardIndex((current) => Math.min(current + 1, visibleItems.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setKeyboardIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setKeyboardIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setKeyboardIndex(visibleItems.length - 1);
        return;
      }

      if (event.key === "Enter") {
        const activeItem = visibleItems[keyboardIndex];
        if (!activeItem) {
          return;
        }

        event.preventDefault();
        void handleOpenSession(activeItem.session);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardIndex, listKeyboardActive, visibleItems]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {visibleItems.length} saved {visibleItems.length === 1 ? "session" : "sessions"}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <label
            htmlFor="tabsetu-popup-sort"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <span style={{ color: "var(--color-text-muted)" }}>Sort</span>
            <select
              id="tabsetu-popup-sort"
              className="input"
              value={sortBy}
              aria-label="Sort saved sessions"
              style={{ height: 32, minHeight: 32, padding: "0 28px 0 10px", fontSize: 12 }}
              onChange={(event) => {
                const nextSort = event.currentTarget.value;
                if (isSortOption(nextSort)) {
                  setSortBy(nextSort);
                }
              }}
            >
              {POPUP_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            type="button"
            style={{ fontSize: 12 }}
            onClick={onSaveNew}
          >
            <Plus size={14} />
            Save current tabs
          </button>
        </div>
      </div>

      {folders.length !== 0 || availableTags.length !== 0 ? (
        <div className="popup-filter-chips">
          {folders.length !== 0 ? (
            <div className="popup-filter-strip" aria-label="Folder filters">
              <button
                className="tag-chip"
                type="button"
                data-active={!activeFolderId}
                onClick={() => setActiveFolderId("")}
              >
                All folders
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className="tag-chip"
                  type="button"
                  data-active={activeFolderId === folder.id}
                  onClick={() => setActiveFolderId(activeFolderId === folder.id ? "" : folder.id)}
                  style={{
                    borderColor: activeFolderId === folder.id ? folder.color : undefined,
                    color: activeFolderId === folder.id ? folder.color : undefined,
                    background: activeFolderId === folder.id ? `${folder.color}18` : undefined,
                  }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          ) : null}
          {availableTags.length !== 0 ? (
            <div className="popup-filter-strip" role="listbox" aria-label="Filter by tag">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  role="option"
                  aria-selected={activeTagId === tag.id}
                  className="tag-chip"
                  type="button"
                  data-active={activeTagId === tag.id}
                  onClick={() => setActiveTagId(activeTagId === tag.id ? "" : tag.id)}
                  style={{
                    borderColor: activeTagId === tag.id ? tag.color : undefined,
                    color: activeTagId === tag.id ? tag.color : undefined,
                    background: activeTagId === tag.id ? `${tag.color}18` : undefined,
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {visibleItems.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "44px 18px", color: "var(--color-text-muted)" }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              {query ? "No sessions match that search" : "No saved sessions yet"}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {query
                ? "Try a different keyword, folder, or tag."
                : "Save your current tabs and TabSetu will keep the workflow ready."}
            </div>
          </div>
        ) : null}

        {visibleItems.map((item, index) => {
          const { session, folder, tags: sessionTags, searchResult } = item;
          const SessionIcon = getSessionIcon(session.icon);
          const secondaryText = searchResult?.highlights.sessionNote.length
            ? session.note
            : session.description || session.note || "";
          const secondaryRanges = searchResult?.highlights.sessionNote.length
            ? searchResult.highlights.sessionNote
            : (searchResult?.highlights.sessionDescription ?? []);
          const isKeyboardSelected = listKeyboardActive && keyboardIndex === index;

          return (
            <div
              key={session.id}
              ref={(node) => {
                itemRefs.current[session.id] = node;
              }}
              className="card"
              onMouseEnter={() => setKeyboardIndex(index)}
              aria-selected={isKeyboardSelected}
              style={{
                padding: 12,
                marginBottom: 10,
                boxShadow: isKeyboardSelected
                  ? "0 20px 48px rgba(15, 185, 216, 0.18)"
                  : "var(--shadow-card)",
                borderColor: isKeyboardSelected ? "var(--color-accent)" : "var(--color-border)",
                background: isKeyboardSelected
                  ? "color-mix(in srgb, var(--color-accent-dim) 35%, var(--color-surface) 65%)"
                  : undefined,
                transition:
                  "border-color var(--transition), box-shadow var(--transition), background var(--transition)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {session.color ? (
                      <span
                        className="session-color-dot"
                        style={{ background: session.color }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {SessionIcon ? <SessionIcon size={14} aria-hidden={true} /> : null}
                    {session.isPinned ? <Pin size={12} color="var(--color-accent)" /> : null}
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--color-text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <HighlightedText
                        text={session.name}
                        ranges={searchResult?.highlights.sessionName}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {session.tabs.length} tabs - Opened {formatDateTime(session.lastOpenedAt)}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  style={{ width: 28, height: 28 }}
                  onClick={() => pinSession(session.id, !session.isPinned)}
                  title={session.isPinned ? "Unpin session" : "Pin session"}
                >
                  <Pin size={14} color={session.isPinned ? "var(--color-accent)" : undefined} />
                </button>
              </div>

              {secondaryText ? (
                <p
                  style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}
                >
                  <HighlightedText text={secondaryText} ranges={secondaryRanges} />
                </p>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {folder ? (
                  <span className="badge badge-subtle">
                    <FolderOpen size={11} />
                    <HighlightedText
                      text={folder.name}
                      ranges={searchResult?.highlights.folderName}
                    />
                  </span>
                ) : null}
                {sessionTags.slice(0, 3).map((tag) => (
                  <span key={tag.id} className="badge badge-subtle">
                    <HighlightedText
                      text={tag.name}
                      ranges={searchResult?.highlights.tagNames[tag.id]}
                    />
                  </span>
                ))}
              </div>

              {searchResult?.snippets.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  {searchResult.snippets.slice(0, 2).map((snippet) => (
                    <div
                      key={snippet.id}
                      className="badge badge-subtle"
                      style={{
                        display: "block",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <strong style={{ marginRight: 6 }}>
                        {snippet.kind === "tabTitle"
                          ? "Title"
                          : snippet.kind === "tabUrl"
                            ? "URL"
                            : "Note"}
                        :
                      </strong>
                      <HighlightedText text={snippet.text} ranges={snippet.ranges} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {session.tabs.slice(0, 3).map((tab) => (
                    <button
                      key={tab.id}
                      className="chip-link"
                      type="button"
                      onClick={() => void handleOpenTab(session, tab.id)}
                      onMouseEnter={(event) =>
                        showQuickInfo(session.id, tab, event.clientX, event.clientY)
                      }
                      onMouseLeave={hideQuickInfo}
                      onFocus={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        showQuickInfo(session.id, tab, rect.left, rect.bottom);
                      }}
                      onBlur={hideQuickInfo}
                      title={tab.url}
                    >
                      {getDomainLabel(tab.url)}
                    </button>
                  ))}
                  {typeof session.tabs[3] !== "undefined" ? (
                    <span className="badge badge-subtle">+{session.tabs.length - 3} more</span>
                  ) : null}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => void handleOpenSession(session)}
                >
                  <ExternalLink size={14} />
                  Open all
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ fontSize: 12, flex: "1 1 118px" }}
                  onClick={() => void handleOpenSession(session, true)}
                >
                  New window
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ fontSize: 12, flex: "1 1 132px" }}
                  onClick={() => void handleAddCurrentTab(session)}
                >
                  Add current tab
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  style={{ width: 30, height: 30 }}
                  onClick={() => {
                    duplicateSession(session.id);
                    addToast("success", `Duplicated "${session.name}".`);
                  }}
                  title="Duplicate session"
                >
                  <Copy size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  style={{ width: 30, height: 30, color: "var(--color-danger)" }}
                  onClick={() => handleDelete(session)}
                  title="Delete session"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {quickInfo ? (
        <div
          className="card-raised animate-scale-in"
          style={{
            position: "fixed",
            left: quickInfo.x,
            top: quickInfo.y,
            zIndex: 20,
            width: 320,
            padding: 12,
            boxShadow: "0 18px 48px rgba(3, 10, 22, 0.28)",
          }}
          onMouseEnter={() => {
            if (quickInfoShowTimer.current) {
              window.clearTimeout(quickInfoShowTimer.current);
            }
            if (quickInfoHideTimer.current) {
              window.clearTimeout(quickInfoHideTimer.current);
            }
          }}
          onMouseLeave={hideQuickInfo}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {(favicons.get(quickInfo.tab.id) ?? quickInfo.tab.favIconUrl) ? (
              <img
                src={favicons.get(quickInfo.tab.id) ?? quickInfo.tab.favIconUrl ?? ""}
                className="favicon"
                alt=""
              />
            ) : (
              <span className="favicon favicon-fallback">
                <TabSetuLogo decorative />
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {quickInfo.tab.title}
              </strong>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  marginTop: 4,
                  overflowWrap: "anywhere",
                }}
              >
                {quickInfo.tab.url}
              </div>
            </div>
          </div>
          {quickInfoEditing ? (
            <div style={{ marginTop: 10 }}>
              <label className="label">Tab note</label>
              <textarea
                className="input"
                autoFocus
                value={quickInfoDraftNote}
                onChange={(event) => setQuickInfoDraftNote(event.target.value)}
                placeholder="Add context for this link"
              />
            </div>
          ) : quickInfo.tab.note ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-secondary)" }}>
              {quickInfo.tab.note.slice(0, 180)}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-muted)" }}>
              No note yet for this tab.
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="badge badge-subtle">
              Opened {formatDateTime(quickInfo.tab.lastOpenedAt)}
            </span>
            <span className="badge badge-subtle">{quickInfo.tab.openCount} opens</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-secondary"
              type="button"
              style={{ flex: 1 }}
              onClick={() => {
                const session = sessions.find((item) => item.id === quickInfo.sessionId);
                if (!session) {
                  return;
                }

                void handleOpenTab(session, quickInfo.tab.id);
              }}
            >
              Open tab
            </button>
            {quickInfoEditing ? (
              <>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setQuickInfoDraftNote(quickInfo.tab.note);
                    setQuickInfoEditing(false);
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="button" onClick={handleQuickInfoSave}>
                  Save note
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setQuickInfoEditing(true)}
              >
                {quickInfo.tab.note ? "Edit note" : "Add note"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete session?"
          message={`"${pendingDelete.name}" will be removed from TabSetu.`}
          confirmLabel="Delete session"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteSession(pendingDelete.id);
            addToast("success", `Deleted "${pendingDelete.name}".`);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
