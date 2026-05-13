import { create } from "zustand";
import type { StandaloneNote } from "@/types";
import { loadStorage, saveStandaloneNotes } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { clampText, generateId, sanitizeLabel, stripHtml } from "@/lib/tabHelpers";

interface NotesState {
  standaloneNotes: StandaloneNote[];
  load: () => Promise<void>;
  createNote: (
    title: string,
    content: string,
    tagIds?: string[],
    color?: string | null
  ) => StandaloneNote;
  updateNote: (id: string, updates: Partial<StandaloneNote>) => void;
  deleteNote: (id: string) => void;
  importNotes: (notes: StandaloneNote[]) => void;
}

let writePromise: Promise<void> = Promise.resolve();

function persistNotes(notes: StandaloneNote[]): void {
  writePromise = writePromise.then(() => saveStandaloneNotes(notes));
  void writePromise;
}

function activeNotes(notes: StandaloneNote[]): StandaloneNote[] {
  return notes.filter((note) => note.deletedAt == null);
}

function sanitizeNoteUpdates(updates: Partial<StandaloneNote>): Partial<StandaloneNote> {
  return {
    ...updates,
    ...(typeof updates.title === "string"
      ? { title: sanitizeLabel(updates.title, "Untitled Note", 100) }
      : {}),
    ...(typeof updates.content === "string"
      ? { content: clampText(stripHtml(updates.content), 10000) }
      : {}),
  };
}

export const useNotesStore = create<NotesState>((set, get) => ({
  standaloneNotes: [],

  load: async () => {
    const data = await loadStorage();
    set({ standaloneNotes: activeNotes(data.standaloneNotes) });
    useHydrationStore.getState().markOneHydrated();
  },

  createNote: (title, content, tagIds = [], color = null) => {
    const createdAt = Date.now();
    const note: StandaloneNote = {
      id: generateId("note"),
      title: sanitizeLabel(title, "Untitled Note", 100),
      content: clampText(stripHtml(content), 10000),
      isPinned: false,
      color,
      tagIds,
      createdAt,
      updatedAt: createdAt,
    };
    const notes = [note, ...get().standaloneNotes];
    set({ standaloneNotes: notes });
    persistNotes(notes);
    return note;
  },

  updateNote: (id, updates) => {
    const notes = get().standaloneNotes.map((note) =>
      note.id === id ? { ...note, ...sanitizeNoteUpdates(updates), updatedAt: Date.now() } : note
    );
    set({ standaloneNotes: notes });
    persistNotes(notes);
  },

  deleteNote: (id) => {
    const deletedAt = Date.now();
    const target = get().standaloneNotes.find((note) => note.id === id);
    if (!target) {
      return;
    }

    const notes = get().standaloneNotes.filter((note) => note.id !== id);
    set({ standaloneNotes: notes });
    persistNotes([...notes, { ...target, deletedAt, updatedAt: deletedAt }]);
  },

  importNotes: (notes) => {
    set({ standaloneNotes: activeNotes(notes) });
  },
}));
