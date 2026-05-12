import { createElement } from "react";
import {
  Archive,
  ArrowUpRight,
  Check,
  CheckSquare,
  Copy,
  FolderOpen,
  Pin,
  Square,
  Trash2,
} from "lucide-react";
import HighlightedText from "@/components/shared/HighlightedText";
import { getSessionIcon } from "@/components/shared/sessionIconRegistry";
import { formatDateTime, formatScheduleLabel } from "@/lib/format";
import { getDomainLabel } from "@/lib/sessionBrowser";
import type { SessionListItem } from "@/lib/sessionQuery";
import type { Schedule, Session, Settings } from "@/types";

export interface DashboardSessionCardProps {
  item: SessionListItem;
  active: boolean;
  selected: boolean;
  selectMode: boolean;
  cardStyle: Settings["sessionCardStyle"];
  nextSchedule: Schedule | null;
  editingSessionId: string | null;
  editingSessionName: string;
  onSelect: (sessionId: string) => void;
  onToggleSelected: (sessionId: string) => void;
  onPin: (session: Session) => void;
  onStartRename: (session: Session) => void;
  onRenameNameChange: (name: string) => void;
  onCommitRename: (session: Session) => void;
  onCancelRename: () => void;
  onOpen: (session: Session, openInNewWindow?: boolean) => void;
  onDuplicate: (session: Session) => void;
  onArchive: (session: Session) => void;
  onDelete: (session: Session) => void;
}

export default function SessionCard({
  item,
  active,
  selected,
  selectMode,
  cardStyle,
  nextSchedule,
  editingSessionId,
  editingSessionName,
  onSelect,
  onToggleSelected,
  onPin,
  onStartRename,
  onRenameNameChange,
  onCommitRename,
  onCancelRename,
  onOpen,
  onDuplicate,
  onArchive,
  onDelete,
}: DashboardSessionCardProps) {
  const { session, folder, tags: sessionTags, searchResult } = item;
  const sessionIcon = getSessionIcon(session.icon);
  const secondaryText = searchResult?.highlights.sessionNote.length
    ? session.note
    : session.description || session.note || "No description yet.";
  const secondaryRanges = searchResult?.highlights.sessionNote.length
    ? searchResult.highlights.sessionNote
    : (searchResult?.highlights.sessionDescription ?? []);

  return (
    <article
      className="session-card"
      data-active={active}
      data-selected={selected || undefined}
      data-card-style={cardStyle}
      onClick={() => {
        if (selectMode) {
          onToggleSelected(session.id);
          return;
        }

        onSelect(session.id);
      }}
      style={{
        padding: cardStyle === "compact" ? 14 : cardStyle === "grid" ? 16 : 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {selectMode ? (
          <button
            className="btn btn-ghost btn-icon bulk-card-check"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected(session.id);
            }}
            title={selected ? "Unselect session" : "Select session"}
          >
            {selected ? <CheckSquare size={16} /> : <Square size={16} />}
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
            {sessionIcon ? createElement(sessionIcon, { size: 14 }) : null}
            {session.isPinned ? <Pin size={14} color="var(--color-accent)" /> : null}
            {editingSessionId === session.id ? (
              <form
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  onCommitRename(session);
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  className="input"
                  value={editingSessionName}
                  autoFocus
                  onChange={(event) => onRenameNameChange(event.target.value)}
                  onBlur={() => onCommitRename(session)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelRename();
                    }
                  }}
                  style={{ minWidth: 0, height: 32, fontWeight: 700 }}
                />
                <button className="btn btn-ghost btn-icon" type="submit" title="Save title">
                  <Check size={14} />
                </button>
              </form>
            ) : (
              <h3
                title="Double-click to rename"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onStartRename(session);
                }}
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
            )}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            <HighlightedText text={secondaryText} ranges={secondaryRanges} />
          </p>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={(event) => {
            event.stopPropagation();
            onPin(session);
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
            <HighlightedText text={folder.name} ranges={searchResult?.highlights.folderName} />
          </span>
        ) : null}
        {sessionTags.slice(0, 3).map((tag) => (
          <span key={tag.id} className="badge badge-subtle" style={{ color: tag.color }}>
            <HighlightedText text={tag.name} ranges={searchResult?.highlights.tagNames[tag.id]} />
          </span>
        ))}
        {session.note ? <span className="badge badge-subtle">Has notes</span> : null}
        {nextSchedule ? (
          <span className="badge badge-subtle">
            Next: {formatScheduleLabel(nextSchedule.type)} at {nextSchedule.time}
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
                {snippet.kind === "tabTitle" ? "Title" : snippet.kind === "tabUrl" ? "URL" : "Note"}
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
            onOpen(session);
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
            onOpen(session, true);
          }}
        >
          New window
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate(session);
          }}
          title="Duplicate session"
        >
          <Copy size={14} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={(event) => {
            event.stopPropagation();
            onArchive(session);
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
            onDelete(session);
          }}
          title="Delete session"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}
