export interface TabItem {
  id: string;
  title: string;
  url: string;
  favIconUrl: string;
  pinned: boolean;
  windowId?: number;
  note: string;
  position: number;
  createdAt: number;
  lastOpenedAt: number | null;
}

export interface Session {
  id: string;
  name: string;
  description: string;
  folderId: string | null;
  tagIds: string[];
  tabs: TabItem[];
  note: string;
  color: string | null;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  version: number;
  isPinned: boolean;
  isArchived: boolean;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type ScheduleType = "once" | "daily" | "weekly" | "weekdays" | "custom";

export interface Schedule {
  id: string;
  sessionId: string;
  type: ScheduleType;
  time: string;
  daysOfWeek: number[];
  date: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  collapseIncludesPinned: boolean;
  openInNewWindow: boolean;
  confirmBeforeDelete: boolean;
  schedulesEnabled: boolean;
  dashboardLayout: "split" | "focus";
  sessionCardStyle: "compact" | "comfortable" | "grid";
  searchScopes: {
    sessions: boolean;
    tabs: boolean;
    notes: boolean;
    tags: boolean;
    folders: boolean;
  };
  fuzzySearchThreshold: number;
  autoArchiveDays: 30 | 60 | 90 | null;
}

export interface StorageData {
  sessions: Session[];
  folders: Folder[];
  tags: Tag[];
  schedules: Schedule[];
  settings: Settings;
}

export type SortOption = "createdAt" | "updatedAt" | "lastOpenedAt" | "name" | "tabCount";
export type ViewFilter = "all" | "pinned" | "archived";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  persistent?: boolean;
}

export interface UndoCollapseBuffer {
  sessionId: string;
  sessionName: string;
  tabs: TabItem[];
  windowId: number | null;
  createdAt: number;
  expiresAt: number;
}
