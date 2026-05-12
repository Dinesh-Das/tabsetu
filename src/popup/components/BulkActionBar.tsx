import { Plus } from "lucide-react";
import type { Folder, SortOption, Tag } from "@/types";

const POPUP_SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "updatedAt", label: "Recently updated" },
  { value: "lastOpenedAt", label: "Recently opened" },
  { value: "name", label: "Alphabetical" },
  { value: "tabCount", label: "Tab count" },
  { value: "createdAt", label: "Recently created" },
];

export interface BulkActionBarProps {
  activeFolderId: string;
  activeTagId: string;
  availableTags: Tag[];
  folders: Folder[];
  onSaveNew: () => void;
  onSortChange: (sort: SortOption) => void;
  setActiveFolderId: (folderId: string) => void;
  setActiveTagId: (tagId: string) => void;
  sortBy: SortOption;
  visibleCount: number;
}

function isSortOption(value: string): value is SortOption {
  return POPUP_SORT_OPTIONS.some((option) => option.value === value);
}

export default function BulkActionBar({
  activeFolderId,
  activeTagId,
  availableTags,
  folders,
  onSaveNew,
  onSortChange,
  setActiveFolderId,
  setActiveTagId,
  sortBy,
  visibleCount,
}: BulkActionBarProps) {
  return (
    <>
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
          {visibleCount} saved {visibleCount === 1 ? "session" : "sessions"}
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
                  onSortChange(nextSort);
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
    </>
  );
}
