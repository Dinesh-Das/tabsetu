import { useMemo, useState } from "react";
import { Edit3, Filter, Grid2X2, List, NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import MobileConfirmSheet from "@/components/mobile/MobileConfirmSheet";
import { BottomSheet, EmptyState, GlassCard, MobileIconButton } from "@/components/mobile/MobileUI";
import { formatDateTime } from "@/lib/format";
import type { StandaloneNote, ToastMessage } from "@/types";
import { useNotesStore } from "@/store/notesStore";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
}

interface NoteEditorProps {
  note: StandaloneNote | null;
  addToast: Props["addToast"];
  onClose: () => void;
}

function NoteEditor({ note, addToast, onClose }: NoteEditorProps) {
  const createNote = useNotesStore((state) => state.createNote);
  const updateNote = useNotesStore((state) => state.updateNote);
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      addToast("info", "Add a note title or body first.");
      return;
    }

    if (note) {
      updateNote(note.id, { title, content });
      addToast("success", "Note updated.");
    } else {
      createNote(title || "Untitled Note", content);
      addToast("success", "Note created.");
    }

    onClose();
  };

  return (
    <BottomSheet
      title={note ? "Edit note" : "New note"}
      subtitle="Capture the thought before the tab trail disappears."
      onClose={onClose}
      footer={
        <button className="mobile-primary-button save-sheet-primary" type="button" onClick={handleSave}>
          {note ? "Save Note" : "Create Note"}
        </button>
      }
    >
      <div className="mobile-form-stack">
        <div className="mobile-field">
          <label htmlFor="note-title">Title</label>
          <input
            id="note-title"
            className="mobile-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Idea title"
            autoFocus
          />
        </div>
        <div className="mobile-field">
          <label htmlFor="note-content">Note</label>
          <textarea
            id="note-content"
            className="mobile-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write anything worth remembering..."
          />
        </div>
      </div>
    </BottomSheet>
  );
}

export default function MobileNotesScreen({ addToast }: Props) {
  const notes = useNotesStore((state) => state.standaloneNotes);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [editorNote, setEditorNote] = useState<StandaloneNote | null | "new">(null);
  const [pendingDelete, setPendingDelete] = useState<StandaloneNote | null>(null);

  const visibleNotes = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return notes;
    }

    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(trimmed) ||
        note.content.toLowerCase().includes(trimmed),
    );
  }, [notes, query]);

  return (
    <>
      <div className="notes-toolbar-row">
        <button className="mobile-secondary-button notes-filter-button" type="button">
          <Filter size={18} />
          Filter
        </button>
        <div className="notes-layout-toggle">
          <button
            type="button"
            data-active={layout === "list" || undefined}
            onClick={() => setLayout("list")}
            title="List"
          >
            <List size={18} />
          </button>
          <button
            type="button"
            data-active={layout === "grid" || undefined}
            onClick={() => setLayout("grid")}
            title="Grid"
          >
            <Grid2X2 size={17} />
          </button>
        </div>
        <button className="mobile-primary-button notes-new-button" type="button" onClick={() => setEditorNote("new")}>
          <Plus size={18} />
          New Note
        </button>
      </div>

      <label className="mobile-search notes-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes..." />
      </label>

      {visibleNotes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={52} />}
          title={query ? "No notes found" : "No notes yet"}
          description={
            query
              ? "Try a different keyword or clear the search."
              : "Create your first note to capture ideas and information."
          }
          action={
            <button className="mobile-primary-button" type="button" onClick={() => setEditorNote("new")}>
              Create New Note
            </button>
          }
        />
      ) : (
        <div className="notes-grid" data-layout={layout}>
          {visibleNotes.map((note) => (
            <GlassCard className="note-card mobile-card-padded" key={note.id}>
              <div className="note-card-header">
                <div>
                  <strong>{note.title}</strong>
                  <span>{formatDateTime(note.updatedAt)}</span>
                </div>
                <div className="note-card-actions">
                  <MobileIconButton title="Edit note" onClick={() => setEditorNote(note)}>
                    <Edit3 size={17} />
                  </MobileIconButton>
                  <MobileIconButton title="Delete note" danger onClick={() => setPendingDelete(note)}>
                    <Trash2 size={17} />
                  </MobileIconButton>
                </div>
              </div>
              <p>{note.content || "No body yet."}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {editorNote ? (
        <NoteEditor
          note={editorNote === "new" ? null : editorNote}
          addToast={addToast}
          onClose={() => setEditorNote(null)}
        />
      ) : null}

      {pendingDelete ? (
        <MobileConfirmSheet
          title="Delete note?"
          message={`"${pendingDelete.title}" will be removed from TabSetu.`}
          confirmLabel="Delete"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteNote(pendingDelete.id);
            addToast("success", "Note deleted.");
            setPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}
