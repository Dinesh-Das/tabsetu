import type {
  Folder,
  UndoCollapseBuffer,
  Schedule,
  Session,
  Settings,
  StorageData,
  TabItem,
  Tag,
} from "@/types";

const now = Date.now();

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  collapseIncludesPinned: false,
  openInNewWindow: false,
  confirmBeforeDelete: true,
  schedulesEnabled: true,
  dashboardLayout: "split",
  sessionCardStyle: "comfortable",
  searchScopes: {
    sessions: true,
    tabs: true,
    notes: true,
    tags: true,
    folders: true,
  },
  fuzzySearchThreshold: 0.32,
  autoArchiveDays: null,
};

export const DEFAULT_FOLDERS: Folder[] = [
  { id: "folder-work", name: "Work", color: "#3B82F6", icon: "Work", position: 0, createdAt: now, updatedAt: now },
  { id: "folder-learning", name: "Learning", color: "#8B5CF6", icon: "Learn", position: 1, createdAt: now, updatedAt: now },
  { id: "folder-personal", name: "Personal", color: "#10B981", icon: "Life", position: 2, createdAt: now, updatedAt: now },
  { id: "folder-research", name: "Research", color: "#F59E0B", icon: "Lab", position: 3, createdAt: now, updatedAt: now },
];

export const DEFAULT_TAGS: Tag[] = [
  { id: "tag-docs", name: "Docs", color: "#60A5FA", createdAt: now },
  { id: "tag-coding", name: "Coding", color: "#A78BFA", createdAt: now },
  { id: "tag-ai", name: "AI", color: "#34D399", createdAt: now },
  { id: "tag-important", name: "Important", color: "#F87171", createdAt: now },
  { id: "tag-later", name: "Later", color: "#FCD34D", createdAt: now },
];

const DEFAULT_STORAGE: StorageData = {
  sessions: [],
  folders: DEFAULT_FOLDERS,
  tags: DEFAULT_TAGS,
  schedules: [],
  settings: DEFAULT_SETTINGS,
};

const STORAGE_IMPORT_KEYS = ["sessions", "folders", "tags", "schedules", "settings"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeTabItem(raw: unknown): TabItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const url = asString(raw.url).trim();
  if (!url) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const lastOpenedAt = raw.lastOpenedAt == null ? null : asNumber(raw.lastOpenedAt, createdAt);

  return {
    id: asString(raw.id, `tab-${createdAt}`),
    title: asString(raw.title, "Untitled Tab").trim() || "Untitled Tab",
    url,
    favIconUrl: asString(raw.favIconUrl),
    pinned: asBoolean(raw.pinned),
    windowId: typeof raw.windowId === "number" ? raw.windowId : undefined,
    note: asString(raw.note),
    position: asNumber(raw.position, 0),
    createdAt,
    lastOpenedAt,
  };
}

function normalizeSession(raw: unknown): Session | null {
  if (!isRecord(raw)) {
    return null;
  }

  const tabs = Array.isArray(raw.tabs)
    ? raw.tabs.map(normalizeTabItem).filter((item): item is TabItem => Boolean(item))
    : [];

  if (tabs.length === 0) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);

  return {
    id: asString(raw.id, `session-${createdAt}`),
    name: asString(raw.name, "Untitled Session").trim() || "Untitled Session",
    description: asString(raw.description),
    folderId: raw.folderId == null ? null : asString(raw.folderId) || null,
    tagIds: asStringArray(raw.tagIds),
    tabs: tabs
      .map((tab, index) => ({
        ...tab,
        position: typeof tab.position === "number" ? tab.position : index,
      }))
      .sort((left, right) => left.position - right.position)
      .map((tab, index) => ({ ...tab, position: index })),
    note: asString(raw.note),
    color: raw.color == null ? null : asString(raw.color) || null,
    icon: raw.icon == null ? null : asString(raw.icon) || null,
    createdAt,
    updatedAt,
    lastOpenedAt: raw.lastOpenedAt == null ? null : asNumber(raw.lastOpenedAt, updatedAt),
    version: Math.max(1, asNumber(raw.version, 1)),
    isPinned: asBoolean(raw.isPinned),
    isArchived: asBoolean(raw.isArchived),
  };
}

function normalizeFolder(raw: unknown): Folder | null {
  if (!isRecord(raw)) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);
  const name = asString(raw.name, "Folder").trim();

  if (!name) {
    return null;
  }

  return {
    id: asString(raw.id, `folder-${createdAt}`),
    name,
    color: asString(raw.color, "#3B82F6"),
    icon: asString(raw.icon, "Folder"),
    position: asNumber(raw.position, 0),
    createdAt,
    updatedAt,
  };
}

function normalizeTag(raw: unknown): Tag | null {
  if (!isRecord(raw)) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const name = asString(raw.name, "Tag").trim();

  if (!name) {
    return null;
  }

  return {
    id: asString(raw.id, `tag-${createdAt}`),
    name,
    color: asString(raw.color, "#60A5FA"),
    createdAt,
  };
}

function normalizeSchedule(raw: unknown): Schedule | null {
  if (!isRecord(raw)) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);
  const time = asString(raw.time, "09:00");
  const type = asString(raw.type, "daily");

  if (!["once", "daily", "weekly", "weekdays", "custom"].includes(type)) {
    return null;
  }

  return {
    id: asString(raw.id, `schedule-${createdAt}`),
    sessionId: asString(raw.sessionId),
    type: type as Schedule["type"],
    time: /^\d{2}:\d{2}$/.test(time) ? time : "09:00",
    daysOfWeek: Array.isArray(raw.daysOfWeek)
      ? raw.daysOfWeek.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6)
      : [],
    date: raw.date == null ? null : asString(raw.date) || null,
    enabled: asBoolean(raw.enabled, true),
    createdAt,
    updatedAt,
  };
}

function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) {
    return DEFAULT_SETTINGS;
  }

  const theme = asString(raw.theme, DEFAULT_SETTINGS.theme);
  const cardStyle = asString(raw.sessionCardStyle, DEFAULT_SETTINGS.sessionCardStyle);
  const layout = asString(raw.dashboardLayout, DEFAULT_SETTINGS.dashboardLayout);
  const rawScopes = isRecord(raw.searchScopes) ? raw.searchScopes : {};
  const fuzzySearchThreshold = Math.min(
    0.6,
    Math.max(0.1, asNumber(raw.fuzzySearchThreshold, DEFAULT_SETTINGS.fuzzySearchThreshold)),
  );
  const autoArchiveDays =
    raw.autoArchiveDays === 30 || raw.autoArchiveDays === 60 || raw.autoArchiveDays === 90
      ? raw.autoArchiveDays
      : null;

  return {
    theme: theme === "light" || theme === "dark" || theme === "system" ? theme : DEFAULT_SETTINGS.theme,
    collapseIncludesPinned: asBoolean(raw.collapseIncludesPinned, DEFAULT_SETTINGS.collapseIncludesPinned),
    openInNewWindow: asBoolean(raw.openInNewWindow, DEFAULT_SETTINGS.openInNewWindow),
    confirmBeforeDelete: asBoolean(raw.confirmBeforeDelete, DEFAULT_SETTINGS.confirmBeforeDelete),
    schedulesEnabled: asBoolean(raw.schedulesEnabled, DEFAULT_SETTINGS.schedulesEnabled),
    dashboardLayout: layout === "focus" || layout === "split" ? layout : DEFAULT_SETTINGS.dashboardLayout,
    sessionCardStyle:
      cardStyle === "compact" || cardStyle === "comfortable" || cardStyle === "grid"
        ? cardStyle
        : DEFAULT_SETTINGS.sessionCardStyle,
    searchScopes: {
      sessions: asBoolean(rawScopes.sessions, DEFAULT_SETTINGS.searchScopes.sessions),
      tabs: asBoolean(rawScopes.tabs, DEFAULT_SETTINGS.searchScopes.tabs),
      notes: asBoolean(rawScopes.notes, DEFAULT_SETTINGS.searchScopes.notes),
      tags: asBoolean(rawScopes.tags, DEFAULT_SETTINGS.searchScopes.tags),
      folders: asBoolean(rawScopes.folders, DEFAULT_SETTINGS.searchScopes.folders),
    },
    fuzzySearchThreshold,
    autoArchiveDays,
  };
}

function hasOwnKey(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function storageGet<T>(keys: string[] | null): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(result as T);
    });
  });
}

function storageSet(value: object): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve();
    });
  });
}

export function getDefaultStorageData(): StorageData {
  return {
    sessions: [],
    folders: DEFAULT_FOLDERS.map((folder) => ({ ...folder })),
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag })),
    schedules: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function normalizeStorageData(raw: unknown): StorageData {
  const source = isRecord(raw) ? raw : {};
  const defaultData = getDefaultStorageData();

  const folders = Array.isArray(source.folders)
    ? source.folders.map(normalizeFolder).filter((item): item is Folder => Boolean(item))
    : [];
  const tags = Array.isArray(source.tags)
    ? source.tags.map(normalizeTag).filter((item): item is Tag => Boolean(item))
    : [];

  const safeFolders = (folders.length > 0 ? folders : defaultData.folders)
    .sort((left, right) => left.position - right.position)
    .map((folder, index) => ({ ...folder, position: index }));
  const safeTags = tags.length > 0 ? tags : defaultData.tags;
  const folderIds = new Set(safeFolders.map((folder) => folder.id));
  const tagIds = new Set(safeTags.map((tag) => tag.id));

  const sessions = Array.isArray(source.sessions)
    ? source.sessions
        .map(normalizeSession)
        .filter((item): item is Session => Boolean(item))
        .map((session) => ({
          ...session,
          folderId: session.folderId && folderIds.has(session.folderId) ? session.folderId : null,
          tagIds: session.tagIds.filter((tagId) => tagIds.has(tagId)),
        }))
    : [];

  const sessionIds = new Set(sessions.map((session) => session.id));
  const schedules = Array.isArray(source.schedules)
    ? source.schedules
        .map(normalizeSchedule)
        .filter((item): item is Schedule => Boolean(item))
        .filter((schedule) => sessionIds.has(schedule.sessionId))
    : [];

  return {
    sessions,
    folders: safeFolders,
    tags: safeTags,
    schedules,
    settings: normalizeSettings(source.settings),
  };
}

export function validateImportPayload(raw: unknown): void {
  if (!isRecord(raw)) {
    throw new Error("This file is not a valid TabNest backup.");
  }

  const hasKnownKey = STORAGE_IMPORT_KEYS.some((key) => hasOwnKey(raw, key));
  if (!hasKnownKey) {
    throw new Error("This file is not a TabNest backup.");
  }

  if (hasOwnKey(raw, "sessions") && !Array.isArray(raw.sessions)) {
    throw new Error("The backup file has an invalid sessions section.");
  }

  if (hasOwnKey(raw, "folders") && !Array.isArray(raw.folders)) {
    throw new Error("The backup file has an invalid folders section.");
  }

  if (hasOwnKey(raw, "tags") && !Array.isArray(raw.tags)) {
    throw new Error("The backup file has an invalid tags section.");
  }

  if (hasOwnKey(raw, "schedules") && !Array.isArray(raw.schedules)) {
    throw new Error("The backup file has an invalid schedules section.");
  }

  if (hasOwnKey(raw, "settings") && !isRecord(raw.settings)) {
    throw new Error("The backup file has an invalid settings section.");
  }
}

export function normalizeImportedStorageData(raw: unknown): StorageData {
  validateImportPayload(raw);
  return normalizeStorageData(raw);
}

export async function loadStorage(): Promise<StorageData> {
  const raw = await storageGet<Partial<StorageData>>(null);
  return normalizeStorageData(raw);
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  await storageSet({ sessions });
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  await storageSet({ folders });
}

export async function saveTags(tags: Tag[]): Promise<void> {
  await storageSet({ tags });
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  await storageSet({ schedules });
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageSet({ settings });
}

export async function saveStorageData(data: StorageData): Promise<void> {
  await storageSet(data);
}

export async function clearAllData(): Promise<void> {
  await storageSet(DEFAULT_STORAGE);
}

const UNDO_BUFFER_KEY = "tabnestUndoBuffer";

export async function saveUndoBuffer(buffer: UndoCollapseBuffer | null): Promise<void> {
  await storageSet({ [UNDO_BUFFER_KEY]: buffer });
}

export async function loadUndoBuffer(): Promise<UndoCollapseBuffer | null> {
  const result = await storageGet<Record<string, UndoCollapseBuffer | null>>([UNDO_BUFFER_KEY]);
  const buffer = result[UNDO_BUFFER_KEY];

  if (!buffer || typeof buffer !== "object") {
    return null;
  }

  if (buffer.expiresAt <= Date.now()) {
    await saveUndoBuffer(null);
    return null;
  }

  return buffer;
}
