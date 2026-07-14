import { useMemo, useState } from "react";
import { FileText, Pin, Plus, Search, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ModalShell from "@/components/shared/ModalShell";
import { formatDateTime } from "@/lib/format";
import { useNotesStore } from "@/store/notesStore";
import { useSessionStore } from "@/store/sessionStore";
import { useTagStore } from "@/store/tagStore";
import type { StandaloneNote, ToastMessage } from "@/types";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
  onOpenSession?: (sessionId: string) => void;
}

type NoteRow =
  | {
      id: string;
      kind: "standalone";
      title: string;
      content: string;
      updatedAt: number;
      note: StandaloneNote;
    }
  | {
      id: string;
      kind: "session";
      title: string;
      content: string;
      updatedAt: number;
      sessionId: string;
    }
  | {
      id: string;
      kind: "tab";
      title: string;
      content: string;
      updatedAt: number;
      sessionId: string;
      tabId: string;
    };

export default function NotesPanel({ addToast, onOpenSession }: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const updateSessionNote = useSessionStore((state) => state.updateSessionNote);
  const updateTabNote = useSessionStore((state) => state.updateTabNote);
  const standaloneNotes = useNotesStore((state) => state.standaloneNotes);
  const createNote = useNotesStore((state) => state.createNote);
  const updateNote = useNotesStore((state) => state.updateNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const tags = useTagStore((state) => state.tags);

  const [query, setQuery] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [editing, setEditing] = useState<NoteRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StandaloneNote | null>(null);

  const rows = useMemo<NoteRow[]>(() => {
    const sessionNotes: NoteRow[] = sessions
      .filter((session) => session.note.trim())
      .map((session) => ({
        id: `session-${session.id}`,
        kind: "session",
        title: session.name,
        content: session.note,
        updatedAt: session.updatedAt,
        sessionId: session.id,
      }));
    const tabNotes: NoteRow[] = sessions.flatMap((session) =>
      session.tabs
        .filter((tab) => tab.note.trim())
        .map((tab) => ({
          id: `tab-${tab.id}`,
          kind: "tab" as const,
          title: tab.title,
          content: tab.note,
          updatedAt: session.updatedAt,
          sessionId: session.id,
          tabId: tab.id,
        }))
    );
    const notes: NoteRow[] = standaloneNotes.map((note) => ({
      id: note.id,
      kind: "standalone",
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt,
      note,
    }));

    return [...notes, ...sessionNotes, ...tabNotes].sort(
      (left, right) => right.updatedAt - left.updatedAt
    );
  }, [sessions, standaloneNotes]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return rows;
    }
    return rows.filter((row) => `${row.title} ${row.content}`.toLowerCase().includes(normalized));
  }, [query, rows]);

  const saveDraft = () => {
    if (!draftTitle.trim() && !draftContent.trim()) {
      return;
    }

    createNote(draftTitle || "Untitled Note", draftContent);
    setDraftTitle("");
    setDraftContent("");
    addToast("success", "Created note.");
  };

  const saveEditing = () => {
    if (!editing) {
      return;
    }

    if (editing.kind === "standalone") {
      updateNote(editing.note.id, { title: editing.title, content: editing.content });
    } else if (editing.kind === "session") {
      updateSessionNote(editing.sessionId, editing.content);
    } else {
      updateTabNote(editing.sessionId, editing.tabId, editing.content);
    }
    addToast("success", "Saved note.");
    setEditing(null);
  };

  return (
    <section style={{ flex: 1, overflowY: "auto", padding: 28 }}>
      <div className="panel-shell">
        <div className="panel-header">
          <div>
            <h1>Notes</h1>
            <p>Session notes, tab notes, and standalone notes live together here.</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="card settings-card">
            <h3>New note</h3>
            <div className="form-stack" style={{ marginTop: 18 }}>
              <input
                className="input"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Note title"
              />
              <textarea
                className="input"
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                placeholder="Capture the thought"
              />
              <button className="btn btn-primary" type="button" onClick={saveDraft}>
                <Plus size={15} />
                Create note
              </button>
            </div>
          </div>

          <div className="card settings-card">
            <h3>Note search</h3>
            <div style={{ position: "relative", marginTop: 18 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 13,
                  color: "var(--color-text-muted)",
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: 34 }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search notes"
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <span className="badge badge-subtle">{standaloneNotes.length} standalone</span>
              <span className="badge badge-subtle">
                {sessions.filter((session) => session.note.trim()).length} session notes
              </span>
              <span className="badge badge-subtle">{tags.length} reusable tags</span>
            </div>
          </div>
        </div>

        <div className="card settings-card" style={{ marginTop: 22 }}>
          <div className="management-items">
            {visibleRows.map((row) => (
              <div key={row.id} className="management-item">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {row.kind === "standalone" && row.note.isPinned ? (
                      <Pin size={14} color="var(--color-accent)" />
                    ) : null}
                    <strong>{row.title}</strong>
                    <span className="badge badge-subtle">{row.kind}</span>
                  </div>
                  <div style={{ color: "var(--color-text-secondary)", marginTop: 6 }}>
                    {row.content.slice(0, 180)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
                    Updated {formatDateTime(row.updatedAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {row.kind !== "standalone" && onOpenSession ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => onOpenSession(row.sessionId)}
                    >
                      Jump to session
                    </button>
                  ) : null}
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setEditing(row)}
                  >
                    Edit
                  </button>
                  {row.kind === "standalone" ? (
                    <>
                      <button
                        className="btn btn-ghost btn-icon"
                        type="button"
                        onClick={() => updateNote(row.note.id, { isPinned: !row.note.isPinned })}
                        title={row.note.isPinned ? "Unpin note" : "Pin note"}
                      >
                        <Pin
                          size={14}
                          color={row.note.isPinned ? "var(--color-accent)" : undefined}
                        />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        type="button"
                        style={{ color: "var(--color-danger)" }}
                        onClick={() => setPendingDelete(row.note)}
                        title="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {visibleRows.length === 0 ? (
              <div className="detail-empty">
                <FileText size={18} />
                <div style={{ marginTop: 8 }}>No notes match this view.</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editing ? (
        <ModalShell
          title="Edit note"
          onClose={() => setEditing(null)}
          onSubmit={saveEditing}
          maxWidth={520}
          footer={
            <>
              <button
                className="btn btn-secondary"
                type="button"
                style={{ flex: 1 }}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                Save note
              </button>
            </>
          }
        >
          <div className="form-stack">
            <input
              className="input"
              value={editing.title}
              disabled={editing.kind !== "standalone"}
              onChange={(event) => setEditing({ ...editing, title: event.target.value })}
            />
            <textarea
              className="input"
              value={editing.content}
              onChange={(event) => setEditing({ ...editing, content: event.target.value })}
            />
          </div>
        </ModalShell>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete note?"
          message={`"${pendingDelete.title}" will be removed from TabSetu.`}
          confirmLabel="Delete note"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteNote(pendingDelete.id);
            addToast("success", "Deleted note.");
            setPendingDelete(null);
          }}
        />
      ) : null}
    </section>
  );
}
