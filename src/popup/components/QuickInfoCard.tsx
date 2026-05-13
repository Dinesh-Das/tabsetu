import { TabSetuLogo } from "@/components/shared/TabSetuLogo";
import { getFaviconFallbackUrl, getRememberedFaviconForOrigin } from "@/lib/favicon";
import { formatDateTime } from "@/lib/format";
import type { Session, TabItem } from "@/types";

export interface QuickInfoState {
  sessionId: string;
  tab: TabItem;
  x: number;
  y: number;
}

export interface QuickInfoCardProps {
  draftNote: string;
  editing: boolean;
  onCancelEdit: () => void;
  onDraftNoteChange: (value: string) => void;
  onEdit: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenTab: (session: Session, tabId: string) => void;
  onSave: () => void;
  quickInfo: QuickInfoState;
  sessions: Session[];
}

export default function QuickInfoCard({
  draftNote,
  editing,
  onCancelEdit,
  onDraftNoteChange,
  onEdit,
  onMouseEnter,
  onMouseLeave,
  onOpenTab,
  onSave,
  quickInfo,
  sessions,
}: QuickInfoCardProps) {
  const favicon = quickInfo.tab.favIconUrl ?? getRememberedFaviconForOrigin(quickInfo.tab.url);

  return (
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {favicon ? (
          <img
            src={favicon}
            className="favicon"
            alt=""
            onError={(event) => {
              const fallback = getFaviconFallbackUrl();
              if (fallback && event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              } else {
                event.currentTarget.style.display = "none";
              }
            }}
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
      {editing ? (
        <div style={{ marginTop: 10 }}>
          <label className="label">Tab note</label>
          <textarea
            className="input"
            autoFocus
            value={draftNote}
            onChange={(event) => onDraftNoteChange(event.target.value)}
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

            onOpenTab(session, quickInfo.tab.id);
          }}
        >
          Open tab
        </button>
        {editing ? (
          <>
            <button className="btn btn-secondary" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={onSave}>
              Save note
            </button>
          </>
        ) : (
          <button className="btn btn-primary" type="button" onClick={onEdit}>
            {quickInfo.tab.note ? "Edit note" : "Add note"}
          </button>
        )}
      </div>
    </div>
  );
}
