export interface TabItem {
  id: string;
  title: string;
  url: string;
  favIconUrl: string | null;
  folderId: string | null;
  tagIds: string[];
  pinned: boolean;
  windowId: number | null;
  note: string;
  reminderAt: number | null;
  reminderSnoozedUntil: number | null;
  reminderDismissed: boolean;
  position: number;
  openCount: number;
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
  openCount: number;
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
  lastFiredAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface StandaloneNote {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  color: string | null;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ShareLink {
  id: string;
  sessionId: string;
  type: "encoded-url";
  encodedData: string | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AIShareConfig {
  defaultProvider: "chatgpt" | "claude" | "gemini" | "custom";
  customProviderUrl: string;
  customPromptTemplate: string;
  includeUrls: boolean;
  includeTitles: boolean;
  includeNotes: boolean;
  promptPreamble: string;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  collapseIncludesPinned: boolean;
  openInNewWindow: boolean;
  confirmBeforeDelete: boolean;
  schedulesEnabled: boolean;
  remindersEnabled: boolean;
  searchOverlayEnabled: boolean;
  searchOverlayShortcut: string;
  quickInfoEnabled: boolean;
  quickInfoDelayMs: 200 | 400 | 700;
  aiEnabled: boolean;
  defaultAIProvider: "chatgpt" | "claude" | "gemini" | "custom";
  customAIProviderUrl: string;
  customAIPromptTemplate: string;
  exportIncludeNotes: boolean;
  version: string;
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
  hasCompletedOnboarding: boolean;
}

export interface StorageData {
  sessions: Session[];
  folders: Folder[];
  tags: Tag[];
  schedules: Schedule[];
  standaloneNotes: StandaloneNote[];
  shareLinks: ShareLink[];
  aiConfig: AIShareConfig;
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

export interface ShareSnapshot {
  v: 1;
  name: string;
  description: string;
  tabs: Array<{ title: string; url: string }>;
  createdAt: number;
}
