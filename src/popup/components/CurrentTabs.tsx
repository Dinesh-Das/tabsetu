import { useEffect, useMemo, useState } from "react";
import { ExternalLink, PackagePlus, Save, Trash2 } from "lucide-react";
import type { ToastMessage } from "@/types";
import { getCurrentTabs, isRestrictedUrl } from "@/lib/tabHelpers";

interface Props {
  query: string;
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onSaveSelected: (tabIds: number[]) => void;
  onSaveAll: () => void;
  onCollapseCurrent: () => void;
}

export default function CurrentTabs({
  query,
  selectedIds,
  setSelectedIds,
  addToast,
  onSaveSelected,
  onSaveAll,
  onCollapseCurrent,
}: Props) {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);

  useEffect(() => {
    void getCurrentTabs().then(setTabs);
  }, []);

  const visibleTabs = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return tabs.filter((tab) => {
      if (!tab.url || isRestrictedUrl(tab.url)) {
        return false;
      }

      if (!loweredQuery) {
        return true;
      }

      return (
        tab.title?.toLowerCase().includes(loweredQuery) ||
        tab.url.toLowerCase().includes(loweredQuery)
      );
    });
  }, [query, tabs]);

  const toggleSelect = (tabId: number) => {
    setSelectedIds(
      selectedIds.includes(tabId)
        ? selectedIds.filter((id) => id !== tabId)
        : [...selectedIds, tabId],
    );
  };

  const toggleAll = () => {
    const visibleIds = visibleTabs
      .map((tab) => tab.id)
      .filter((id): id is number => typeof id === "number");

    if (visibleIds.length === 0) {
      addToast("info", "There are no capturable tabs in this window.");
      return;
    }

    setSelectedIds(selectedIds.length === visibleIds.length ? [] : visibleIds);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={toggleAll}>
          {selectedIds.length === visibleTabs.length && visibleTabs.length > 0 ? "Deselect all" : "Select all"}
        </button>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12 }}
          onClick={() => onSaveSelected(selectedIds)}
          disabled={selectedIds.length === 0}
        >
          <PackagePlus size={14} />
          Save selected
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onSaveAll}>
          <Save size={14} />
          Save all
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12, marginLeft: "auto" }} onClick={onCollapseCurrent}>
          <Trash2 size={14} />
          Collapse window
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {visibleTabs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              {query ? "No tabs match your search" : "Nothing to save yet"}
            </div>
            <div style={{ fontSize: 11, marginTop: 6 }}>
              Restricted Chrome pages are skipped automatically.
            </div>
          </div>
        ) : null}

        {visibleTabs.map((tab) => {
          const tabId = tab.id ?? 0;
          const active = selectedIds.includes(tabId);

          return (
            <div
              key={tabId}
              onClick={() => toggleSelect(tabId)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                marginBottom: 6,
                borderRadius: 10,
                cursor: "pointer",
                border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                background: active ? "var(--color-accent-dim)" : "var(--color-surface)",
                transition: "all var(--transition)",
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => undefined}
                style={{ flexShrink: 0, accentColor: "var(--color-accent)" }}
              />
              {tab.favIconUrl ? (
                <img
                  src={tab.favIconUrl}
                  className="favicon"
                  alt=""
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="favicon favicon-fallback" />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tab.title || "Untitled Tab"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tab.url}
                </div>
              </div>
              {tab.pinned ? <span className="badge badge-subtle">Pinned</span> : null}
              <button
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28, flexShrink: 0 }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (typeof tab.id === "number") {
                    void chrome.tabs.update(tab.id, { active: true });
                  }
                }}
                title="Switch to tab"
              >
                <ExternalLink size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
