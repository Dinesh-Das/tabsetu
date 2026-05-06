import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  CheckSquare,
  Copy,
  FolderInput,
  FolderOpen,
  PackagePlus,
  Pin,
  Square,
  Trash2,
  X,
} from "lucide-react";
import HighlightedText from "@/components/shared/HighlightedText";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime, formatScheduleLabel } from "@/lib/format";
import { buildSessionListItems } from "@/lib/sessionQuery";
import { getDomainLabel, openSessionTabs } from "@/lib/sessionBrowser";
import type { Session, SortOption, ToastMessage } from "@/types";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import { useScheduleStore } from "@/store/scheduleStore";
import SaveModal from "@/popup/components/SaveModal";
import SearchBar from "@/popup/components/SearchBar";

interface Props {
  selectedSessionId: string | null;
  onSelect: (sessionId: string | null) => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
}

export default function SessionList({ selectedSessionId, onSelect, addToast }: Props) {
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
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const schedules = useScheduleStore((state) => state.schedules);
  const settings = useSettingsStore((state) => state.settings);

  const [query, setQuery] = useState("");
  const [saveModalMode, setSaveModalMode] = useState<"save" | "collapse" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState("");
  const deferredQuery = useDebouncedValue(query, 150);
  const searchRef = useRef<HTMLInputElement>(null);

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
      }),
    [activeFolderId, activeTagId, deferredQuery, folders, sessions, settings, sortBy, tags, viewFilter],
  );

  const sessionCounts = useMemo(
    () => ({
      total: sessions.filter((session) => !session.isArchived).length,
      pinned: sessions.filter((session) => session.isPinned && !session.isArchived).length,
      archived: sessions.filter((session) => session.isArchived).length,
      tabs: sessions.reduce((total, session) => total + session.tabs.length, 0),
    }),
    [sessions],
  );

  const visibleSessionIds = useMemo(
    () => filteredItems.map((item) => item.session.id),
    [filteredItems],
  );

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedIds.includes(session.id)),
    [selectedIds, sessions],
  );

  const schedulesBySessionId = useMemo(() => {
    const map = new Map<string, typeof schedules>();
    for (const schedule of schedules.filter((item) => item.enabled)) {
      map.set(schedule.sessionId, [...(map.get(schedule.sessionId) ?? []), schedule]);
    }
    return map;
  }, [schedules]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => sessions.some((session) => session.id === id)));
  }, [sessions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const usesSessionShortcutModifier = event.shiftKey && ((event.ctrlKey || event.metaKey) || event.altKey);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }

      if (usesSessionShortcutModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSaveModalMode("save");
      }

      if (usesSessionShortcutModifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setSaveModalMode("collapse");
      }

      if (event.key === "Escape" && query) {
        setQuery("");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [query]);

  const handleOpen = async (session: Session, openInNewWindow = settings.openInNewWindow) => {
    const opened = await openSessionTabs(session, openInNewWindow);
    if (opened === 0) {
      addToast("error", "That session has no openable tabs.");
      return;
    }

    recordOpened(session.id);
    addToast("success", `Opened "${session.name}".`);
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

  const toggleSelectMode = () => {
    setSelectMode((current) => !current);
    setSelectedIds([]);
    setBulkFolderId("");
  };

  const toggleSelected = (sessionId: string) => {
    setSelectedIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId],
    );
  };

  const selectAllVisible = () => {
    setSelectedIds((current) => {
      const visible = new Set(visibleSessionIds);
      const allVisibleSelected = visibleSessionIds.length !== 0 && visibleSessionIds.every((id) => current.includes(id));
      if (allVisibleSelected) {
        return current.filter((id) => !visible.has(id));
      }

      return [...new Set([...current, ...visibleSessionIds])];
    });
  };

  const clearBulkSelection = () => {
    setSelectedIds([]);
    setBulkFolderId("");
  };

  const handleBulkMove = () => {
    selectedIds.forEach((id) => setSessionFolder(id, bulkFolderId || null));
    addToast("success", `Moved ${selectedIds.length} ${selectedIds.length === 1 ? "session" : "sessions"}.`);
    clearBulkSelection();
  };

  const handleBulkArchive = () => {
    const shouldUnarchive = selectedSessions.length !== 0 && selectedSessions.every((session) => session.isArchived);
    selectedIds.forEach((id) => archiveSession(id, !shouldUnarchive));
    addToast("success", shouldUnarchive ? "Restored selected sessions." : "Archived selected sessions.");
    clearBulkSelection();
  };

  const deleteSelectedSessions = () => {
    selectedIds.forEach(deleteSession);
    addToast("success", `Deleted ${selectedIds.length} ${selectedIds.length === 1 ? "session" : "sessions"}.`);
    if (selectedSessionId && selectedIds.includes(selectedSessionId)) {
      onSelect(null);
    }
    clearBulkSelection();
    setPendingBulkDelete(false);
  };

  const handleBulkDelete = () => {
    if (settings.confirmBeforeDelete) {
      setPendingBulkDelete(true);
      return;
    }

    deleteSelectedSessions();
  };

  return (
    <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "24px 24px 18px",
          borderBottom: "1px solid var(--color-border)",
          background:
            "linear-gradient(180deg, rgba(0,179,216,0.08) 0%, rgba(0,179,216,0) 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 28 }}>Sessions</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--color-text-secondary)" }}>
              Save, search, reopen, and refine every browsing workflow from one place.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" type="button" onClick={toggleSelectMode}>
              {selectMode ? <X size={15} /> : <CheckSquare size={15} />}
              {selectMode ? "Cancel select" : "Select"}
            </button>
            <button className="btn btn-primary" onClick={() => setSaveModalMode("save")}>
              <PackagePlus size={16} />
              Save current window
            </button>
          </div>
        </div>

        <div className="stats-grid" style={{ marginTop: 18 }}>
          <div className="hero-stat">
            <span className="hero-stat-label">Active sessions</span>
            <strong>{sessionCounts.total}</strong>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Pinned</span>
            <strong>{sessionCounts.pinned}</strong>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Archived</span>
            <strong>{sessionCounts.archived}</strong>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Saved tabs</span>
            <strong>{sessionCounts.tabs}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 18, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search sessions, links, notes, folders, or tags..."
              inputRef={searchRef}
              inputId="tabsetu-dashboard-search"
            />
          </div>
          <select
            className="input"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            style={{ width: 190 }}
          >
            <option value="updatedAt">Sort by recently updated</option>
            <option value="createdAt">Sort by recently created</option>
            <option value="lastOpenedAt">Sort by recently opened</option>
            <option value="name">Sort by name</option>
            <option value="tabCount">Sort by tab count</option>
          </select>
        </div>

        {selectMode ? (
          <div className="bulk-action-bar">
            <button className="btn btn-secondary" type="button" onClick={selectAllVisible}>
              {visibleSessionIds.length !== 0 && visibleSessionIds.every((id) => selectedIds.includes(id))
                ? <CheckSquare size={14} />
                : <Square size={14} />}
              {visibleSessionIds.length !== 0 && visibleSessionIds.every((id) => selectedIds.includes(id))
                ? "Unselect visible"
                : "Select visible"}
            </button>
            <span className="badge badge-subtle">{selectedIds.length} selected</span>
            <select
              className="input"
              value={bulkFolderId}
              onChange={(event) => setBulkFolderId(event.target.value)}
              style={{ width: 190 }}
              disabled={selectedIds.length === 0}
            >
              <option value="">Move to no folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  Move to {folder.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleBulkMove}
            >
              <FolderInput size={14} />
              Move
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleBulkArchive}
            >
              <Archive size={14} />
              {selectedSessions.length !== 0 && selectedSessions.every((session) => session.isArchived)
                ? "Restore"
                : "Archive"}
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleBulkDelete}
            >
              <Trash2 size={14} />
              Delete
            </button>
            <button className="btn btn-ghost" type="button" onClick={clearBulkSelection}>
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <h3>No sessions found</h3>
            <p>
              Save your current window or widen the search. TabSetu will keep the structure ready.
            </p>
          </div>
        ) : null}

        <div
          className="session-grid"
          data-card-style={settings.sessionCardStyle}
          style={{
            gridTemplateColumns:
              settings.sessionCardStyle === "compact"
                ? "1fr"
                : settings.sessionCardStyle === "grid"
                  ? "repeat(auto-fill, minmax(220px, 1fr))"
                  : "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {filteredItems.map((item) => {
            const { session, folder, tags: sessionTags, searchResult } = item;
            const active = selectedSessionId === session.id;
            const secondaryText = searchResult?.highlights.sessionNote.length
              ? session.note
              : session.description || session.note || "No description yet.";
            const secondaryRanges = searchResult?.highlights.sessionNote.length
              ? searchResult.highlights.sessionNote
              : searchResult?.highlights.sessionDescription ?? [];

            return (
              <article
                key={session.id}
                className="session-card"
                data-active={active}
                data-selected={selectedIds.includes(session.id) || undefined}
                data-card-style={settings.sessionCardStyle}
                onClick={() => {
                  if (selectMode) {
                    toggleSelected(session.id);
                    return;
                  }

                  onSelect(session.id);
                }}
                style={{
                  padding:
                    settings.sessionCardStyle === "compact"
                      ? 14
                      : settings.sessionCardStyle === "grid"
                        ? 16
                        : 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {selectMode ? (
                    <button
                      className="btn btn-ghost btn-icon bulk-card-check"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelected(session.id);
                      }}
                      title={selectedIds.includes(session.id) ? "Unselect session" : "Select session"}
                    >
                      {selectedIds.includes(session.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {session.color ? (
                        <span
                          aria-hidden
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: session.color,
                            boxShadow: `0 0 0 4px ${session.color}22`,
                          }}
                        />
                      ) : null}
                      {session.isPinned ? <Pin size={14} color="var(--color-accent)" /> : null}
                      <h3
                        style={{
                          fontSize: 18,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <HighlightedText
                          text={session.name}
                          ranges={searchResult?.highlights.sessionName}
                        />
                      </h3>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
                      <HighlightedText text={secondaryText} ranges={secondaryRanges} />
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      pinSession(session.id, !session.isPinned);
                    }}
                    title={session.isPinned ? "Unpin session" : "Pin session"}
                  >
                    <Pin size={14} color={session.isPinned ? "var(--color-accent)" : undefined} />
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {folder ? (
                    <span className="badge badge-subtle">
                      <FolderOpen size={12} />
                      <HighlightedText
                        text={folder.name}
                        ranges={searchResult?.highlights.folderName}
                      />
                    </span>
                  ) : null}
                  {sessionTags.slice(0, 3).map((tag) => (
                    <span key={tag.id} className="badge badge-subtle" style={{ color: tag.color }}>
                      <HighlightedText
                        text={tag.name}
                        ranges={searchResult?.highlights.tagNames[tag.id]}
                      />
                    </span>
                  ))}
                  {session.note ? <span className="badge badge-subtle">Has notes</span> : null}
                  {schedulesBySessionId.get(session.id)?.[0] ? (
                    <span className="badge badge-subtle">
                      Next: {formatScheduleLabel(schedulesBySessionId.get(session.id)![0].type)} at{" "}
                      {schedulesBySessionId.get(session.id)![0].time}
                    </span>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
                  <span className="metric-pill">{session.tabs.length} tabs</span>
                  <span className="metric-pill">{session.openCount} opens</span>
                  <span className="metric-pill">Updated {formatDateTime(session.updatedAt)}</span>
                </div>

                {searchResult?.snippets.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {session.tabs.slice(0, 4).map((tab) => (
                      <span key={tab.id} className="chip-link chip-link-static">
                        {getDomainLabel(tab.url)}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleOpen(session);
                    }}
                  >
                    <ArrowUpRight size={15} />
                    Open
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: "1 1 118px" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleOpen(session, true);
                    }}
                  >
                    New window
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      duplicateSession(session.id);
                      addToast("success", `Duplicated "${session.name}".`);
                    }}
                    title="Duplicate session"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      archiveSession(session.id, !session.isArchived);
                    }}
                    title={session.isArchived ? "Restore session" : "Archive session"}
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ color: "var(--color-danger)" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(session);
                    }}
                    title="Delete session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {saveModalMode ? (
        <SaveModal
          mode={saveModalMode}
          selectedTabIds={[]}
          onClose={() => setSaveModalMode(null)}
          addToast={addToast}
        />
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
            if (selectedSessionId === pendingDelete.id) {
              onSelect(null);
            }
            addToast("success", `Deleted "${pendingDelete.name}".`);
            setPendingDelete(null);
          }}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDialog
          title="Delete selected sessions?"
          message={`${selectedIds.length} ${selectedIds.length === 1 ? "session" : "sessions"} will be removed from TabSetu.`}
          confirmLabel="Delete selected"
          danger
          onClose={() => setPendingBulkDelete(false)}
          onConfirm={deleteSelectedSessions}
        />
      ) : null}
    </section>
  );
}
