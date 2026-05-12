import type { RefObject } from "react";
import {
  Archive,
  CheckSquare,
  Copy,
  FolderInput,
  PackagePlus,
  Pause,
  Square,
  Trash2,
  X,
} from "lucide-react";
import SearchBar from "@/popup/components/SearchBar";
import type { Folder, Session, SortOption } from "@/types";

export interface DuplicateGroup {
  url: string;
  appearances: Array<{
    sessionId: string;
    sessionName: string;
    tabId: string;
    tabTitle: string;
  }>;
}

export interface SessionListToolbarProps {
  query: string;
  sortBy: SortOption;
  selectMode: boolean;
  showDuplicates: boolean;
  selectedIds: string[];
  visibleSessionIds: string[];
  selectedSessions: Session[];
  folders: Folder[];
  bulkFolderId: string;
  duplicateGroups: DuplicateGroup[];
  sessionCounts: {
    total: number;
    pinned: number;
    archived: number;
    tabs: number;
  };
  searchRef: RefObject<HTMLInputElement>;
  onQueryChange: (query: string) => void;
  onSortChange: (sortBy: SortOption) => void;
  onToggleSelectMode: () => void;
  onToggleDuplicates: () => void;
  onSuspendBackgroundTabs: () => void;
  onSaveCurrentWindow: () => void;
  onSelectAllVisible: () => void;
  onBulkFolderChange: (folderId: string) => void;
  onBulkMove: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onClearBulkSelection: () => void;
  onSelectSession: (sessionId: string) => void;
}

export default function SessionListToolbar({
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
  onQueryChange,
  onSortChange,
  onToggleSelectMode,
  onToggleDuplicates,
  onSuspendBackgroundTabs,
  onSaveCurrentWindow,
  onSelectAllVisible,
  onBulkFolderChange,
  onBulkMove,
  onBulkArchive,
  onBulkDelete,
  onClearBulkSelection,
  onSelectSession,
}: SessionListToolbarProps) {
  const allVisibleSelected =
    visibleSessionIds.length !== 0 && visibleSessionIds.every((id) => selectedIds.includes(id));
  const selectedAreArchived =
    selectedSessions.length !== 0 && selectedSessions.every((session) => session.isArchived);

  return (
    <div
      style={{
        padding: "24px 24px 18px",
        borderBottom: "1px solid var(--color-border)",
        background: "linear-gradient(180deg, rgba(0,179,216,0.08) 0%, rgba(0,179,216,0) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28 }}>Sessions</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--color-text-secondary)" }}>
            Save, search, reopen, and refine every browsing workflow from one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" type="button" onClick={onToggleSelectMode}>
            {selectMode ? <X size={15} /> : <CheckSquare size={15} />}
            {selectMode ? "Cancel select" : "Select"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onToggleDuplicates}>
            <Copy size={15} />
            Duplicates
          </button>
          <button className="btn btn-secondary" type="button" onClick={onSuspendBackgroundTabs}>
            <Pause size={15} />
            Suspend tabs
          </button>
          <button className="btn btn-primary" type="button" onClick={onSaveCurrentWindow}>
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
            onChange={onQueryChange}
            placeholder="Search sessions, links, notes, folders, or tags..."
            inputRef={searchRef}
            inputId="tabsetu-dashboard-search"
          />
        </div>
        <select
          className="input"
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value as SortOption)}
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
          <button className="btn btn-secondary" type="button" onClick={onSelectAllVisible}>
            {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {allVisibleSelected ? "Unselect visible" : "Select visible"}
          </button>
          <span className="badge badge-subtle">{selectedIds.length} selected</span>
          <select
            className="input"
            value={bulkFolderId}
            onChange={(event) => onBulkFolderChange(event.target.value)}
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
            onClick={onBulkMove}
          >
            <FolderInput size={14} />
            Move
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={onBulkArchive}
          >
            <Archive size={14} />
            {selectedAreArchived ? "Restore" : "Archive"}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={onBulkDelete}
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClearBulkSelection}>
            Clear
          </button>
        </div>
      ) : null}

      {showDuplicates ? (
        <div className="card-raised" style={{ marginTop: 14, padding: 14 }}>
          <div className="detail-section-header">
            <h3>Duplicate tabs</h3>
            <span className="badge badge-subtle">{duplicateGroups.length} URLs</span>
          </div>
          {duplicateGroups.length === 0 ? (
            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 13 }}>
              No cross-session duplicate tabs found.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxHeight: 220, overflow: "auto" }}>
              {duplicateGroups.slice(0, 12).map((group) => (
                <div
                  key={group.url}
                  style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, wordBreak: "break-all" }}>
                    {group.url}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {group.appearances.map((appearance) => (
                      <button
                        key={`${group.url}-${appearance.sessionId}-${appearance.tabId}`}
                        className="badge badge-subtle"
                        type="button"
                        onClick={() => onSelectSession(appearance.sessionId)}
                        title={appearance.tabTitle}
                      >
                        {appearance.sessionName}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
