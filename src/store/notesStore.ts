import { create } from "zustand";
import type { StandaloneNote } from "@/types";
import { loadStorage, saveStandaloneNotes } from "@/lib/storage";
import { clampText, generateId, sanitizeLabel, stripHtml } from "@/lib/tabHelpers";

interface NotesState {
  standaloneNotes: StandaloneNote[];
  load: () => Promise<void>;
  createNote: (title: string, content: string, tagIds?: string[], color?: string | null) => StandaloneNote;
  updateNote: (id: string, updates: Partial<StandaloneNote>) => void;
  deleteNote: (id: string) => void;
  importNotes: (notes: StandaloneNote[]) => void;
}

function persistNotes(notes: StandaloneNote[]): void {
  void saveStandaloneNotes(notes);
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
    set({ standaloneNotes: data.standaloneNotes });
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
      note.id === id ? { ...note, ...sanitizeNoteUpdates(updates), updatedAt: Date.now() } : note,
    );
    set({ standaloneNotes: notes });
    persistNotes(notes);
  },

  deleteNote: (id) => {
    const notes = get().standaloneNotes.filter((note) => note.id !== id);
    set({ standaloneNotes: notes });
    persistNotes(notes);
  },

  importNotes: (notes) => {
    set({ standaloneNotes: notes });
    persistNotes(notes);
  },
}));
