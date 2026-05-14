import { createElement } from "react";
import { Copy, ExternalLink, FolderOpen, Pin, Trash2 } from "lucide-react";
import HighlightedText from "@/components/shared/HighlightedText";
import { getSessionIcon } from "@/components/shared/sessionIconRegistry";
import { formatDateTime } from "@/lib/format";
import { buildSessionListItems } from "@/lib/sessionQuery";
import { getDomainLabel } from "@/lib/sessionBrowser";
import type { Session, TabItem } from "@/types";

type PopupSessionListItem = ReturnType<typeof buildSessionListItems>[number];

export interface PopupSessionCardProps {
  item: PopupSessionListItem;
  isKeyboardSelected: boolean;
  onAddCurrentTab: (session: Session) => void;
  onDelete: (session: Session) => void;
  onDuplicate: (session: Session) => void;
  onMouseEnter: () => void;
  onOpenSession: (session: Session, openInNewWindow?: boolean) => void;
  onOpenTab: (session: Session, tabId: string) => void;
  onPin: (session: Session) => void;
  onRef: (node: HTMLDivElement | null) => void;
  showQuickInfo: (sessionId: string, tab: TabItem, x: number, y: number) => void;
  hideQuickInfo: () => void;
}

export default function SessionCard({
  item,
  isKeyboardSelected,
  onAddCurrentTab,
  onDelete,
  onDuplicate,
  onMouseEnter,
  onOpenSession,
  onOpenTab,
  onPin,
  onRef,
  showQuickInfo,
  hideQuickInfo,
}: PopupSessionCardProps) {
  const { session, folder, tags: sessionTags, searchResult } = item;
  const sessionIcon = getSessionIcon(session.icon);
  const secondaryText = searchResult?.highlights.sessionNote.length
    ? session.note
    : session.description || session.note || "";
  const secondaryRanges = searchResult?.highlights.sessionNote.length
    ? searchResult.highlights.sessionNote
    : (searchResult?.highlights.sessionDescription ?? []);

  return (
    <div
      ref={onRef}
      className="card"
      onMouseEnter={onMouseEnter}
      aria-selected={isKeyboardSelected}
      style={{
        padding: 12,
        marginBottom: 10,
        boxShadow: isKeyboardSelected ? "0 2px 8px rgba(0, 0, 0, 0.1)" : undefined,
        borderColor: isKeyboardSelected ? "var(--color-accent)" : undefined,
        background: isKeyboardSelected ? "var(--color-accent-dim)" : undefined,
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
            {sessionIcon ? createElement(sessionIcon, { size: 14, "aria-hidden": true }) : null}
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
              <HighlightedText text={session.name} ranges={searchResult?.highlights.sessionName} />
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
          onClick={() => onPin(session)}
          title={session.isPinned ? "Unpin session" : "Pin session"}
        >
          <Pin size={14} color={session.isPinned ? "var(--color-accent)" : undefined} />
        </button>
      </div>

      {secondaryText ? (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
          <HighlightedText text={secondaryText} ranges={secondaryRanges} />
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {folder ? (
          <span className="badge badge-subtle">
            <FolderOpen size={11} />
            <HighlightedText text={folder.name} ranges={searchResult?.highlights.folderName} />
          </span>
        ) : null}
        {sessionTags.slice(0, 3).map((tag) => (
          <span key={tag.id} className="badge badge-subtle">
            <HighlightedText text={tag.name} ranges={searchResult?.highlights.tagNames[tag.id]} />
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
                {snippet.kind === "tabTitle" ? "Title" : snippet.kind === "tabUrl" ? "URL" : "Note"}
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
              onClick={() => onOpenTab(session, tab.id)}
              onMouseEnter={(event) => showQuickInfo(session.id, tab, event.clientX, event.clientY)}
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
          onClick={() => onOpenSession(session)}
        >
          <ExternalLink size={14} />
          Open all
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          style={{ fontSize: 12, flex: "1 1 118px" }}
          onClick={() => onOpenSession(session, true)}
        >
          New window
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          style={{ fontSize: 12, flex: "1 1 132px" }}
          onClick={() => onAddCurrentTab(session)}
        >
          Add current tab
        </button>
        <button
          className="btn btn-ghost btn-icon"
          type="button"
          style={{ width: 30, height: 30 }}
          onClick={() => onDuplicate(session)}
          title="Duplicate session"
        >
          <Copy size={14} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          type="button"
          style={{ width: 30, height: 30, color: "var(--color-danger)" }}
          onClick={() => onDelete(session)}
          title="Delete session"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
