import type { Folder, Tag } from "@/types";

export function getOnboardingFolders(now = Date.now()): Folder[] {
  return [
    { id: "folder-work", name: "Work", color: "#4F46E5", icon: "briefcase", position: 0, createdAt: now, updatedAt: now },
    { id: "folder-learning", name: "Learning", color: "#10B981", icon: "book-open", position: 1, createdAt: now, updatedAt: now },
    { id: "folder-personal", name: "Personal", color: "#F59E0B", icon: "home", position: 2, createdAt: now, updatedAt: now },
    { id: "folder-research", name: "Research", color: "#8B5CF6", icon: "flask-conical", position: 3, createdAt: now, updatedAt: now },
  ];
}

export function getOnboardingTags(now = Date.now()): Tag[] {
  return [
    { id: "tag-docs", name: "Docs", color: "#60A5FA", createdAt: now },
    { id: "tag-coding", name: "Coding", color: "#A78BFA", createdAt: now },
    { id: "tag-ai", name: "AI", color: "#34D399", createdAt: now },
    { id: "tag-important", name: "Important", color: "#F87171", createdAt: now },
    { id: "tag-later", name: "Later", color: "#FCD34D", createdAt: now },
  ];
}
