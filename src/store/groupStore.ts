import { create } from "zustand";
import type { Group } from "@/types";
import { loadStorage, saveGroups } from "@/lib/storage";
import { generateId, sanitizeLabel } from "@/lib/tabHelpers";

interface GroupState {
  groups: Group[];
  load: () => Promise<void>;
  createGroup: (name: string, color: string) => Group;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  importGroups: (groups: Group[]) => void;
}

function persistGroups(groups: Group[]): void {
  void saveGroups(groups);
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],

  load: async () => {
    const data = await loadStorage();
    set({ groups: data.groups });
  },

  createGroup: (name, color) => {
    const createdAt = Date.now();
    const group: Group = {
      id: generateId("group"),
      name: sanitizeLabel(name, "New Group", 40),
      color,
      createdAt,
      updatedAt: createdAt,
    };
    const groups = [...get().groups, group];
    set({ groups });
    persistGroups(groups);
    return group;
  },

  updateGroup: (id, updates) => {
    const sanitizedUpdates = {
      ...updates,
      ...(typeof updates.name === "string" ? { name: sanitizeLabel(updates.name, "Group", 40) } : {}),
    };
    const groups = get().groups.map((group) =>
      group.id === id ? { ...group, ...sanitizedUpdates, updatedAt: Date.now() } : group,
    );
    set({ groups });
    persistGroups(groups);
  },

  deleteGroup: (id) => {
    const groups = get().groups.filter((group) => group.id !== id);
    set({ groups });
    persistGroups(groups);
  },

  importGroups: (groups) => {
    set({ groups });
    persistGroups(groups);
  },
}));
