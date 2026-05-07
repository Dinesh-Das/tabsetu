import type {
  AIShareConfig,
  Folder,
  Schedule,
  Session,
  Settings,
  ShareLink,
  StandaloneNote,
  StorageData,
  TabItem,
  Tag,
  UndoCollapseBuffer,
} from "@/types";
import { clampText, generateId, isValidUrl, sanitizeLabel, stripHtml } from "@/lib/tabHelpers";
import { getOnboardingFolders, getOnboardingTags } from "@/lib/onboarding";

const APP_VERSION = "1.0.0";
const SCHEMA_VERSION = 3;
export const COLLAPSE_UNDO_MS = 10_000;

export const STORAGE_KEYS = {
  sessions: "TabSetu_sessions",
  folders: "TabSetu_folders",
  tags: "TabSetu_tags",
  schedules: "TabSetu_schedules",
  standaloneNotes: "TabSetu_standalone_notes",
  shareLinks: "TabSetu_share_links",
  aiConfig: "TabSetu_ai_config",
  settings: "TabSetu_settings",
  undoBuffer: "TabSetu_undo_buffer",
  schemaVersion: "TabSetu_schema_version",
  remindersDismissed: "TabSetu_reminders_dismissed",
} as const;

const LEGACY_KEYS = ["sessions", "folders", "tags", "schedules", "settings", "tabsetuUndoBuffer"] as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  collapseIncludesPinned: false,
  openInNewWindow: false,
  confirmBeforeDelete: true,
  schedulesEnabled: true,
  remindersEnabled: true,
  searchOverlayEnabled: true,
  searchOverlayShortcut: "Ctrl+Shift+F",
  quickInfoEnabled: true,
  quickInfoDelayMs: 400,
  aiEnabled: true,
  defaultAIProvider: "chatgpt",
  customAIProviderUrl: "",
  customAIPromptTemplate: "",
  exportIncludeNotes: true,
  version: APP_VERSION,
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
  hasCompletedOnboarding: false,
};

export const DEFAULT_AI_CONFIG: AIShareConfig = {
  defaultProvider: "chatgpt",
  customProviderUrl: "",
  customPromptTemplate: "",
  includeUrls: true,
  includeTitles: true,
  includeNotes: true,
  promptPreamble: "",
};

const DEFAULT_STORAGE: StorageData = {
  sessions: [],
  folders: [],
  tags: [],
  schedules: [],
  standaloneNotes: [],
  shareLinks: [],
  aiConfig: DEFAULT_AI_CONFIG,
  settings: DEFAULT_SETTINGS,
};

const MIGRATIONS: Record<number, (data: StorageData) => StorageData> = {
  2: (d) => d,
  3: (d) => ({
    ...d,
    shareLinks: d.shareLinks.map((link) => {
      const legacyLink = link as Omit<ShareLink, "type"> & { type: string };
      return {
      id: legacyLink.id,
      sessionId: legacyLink.sessionId,
      type: legacyLink.type === "hosted" ? "encoded-url" : (legacyLink.type as ShareLink["type"]),
      encodedData: link.encodedData,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
    }),
  }),
};

const STORAGE_IMPORT_KEYS = [
  "sessions",
  "folders",
  "tags",
  "schedules",
  "standaloneNotes",
  "shareLinks",
  "aiConfig",
  "settings",
] as const;

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

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function sourceValue<T>(
  source: Record<string, unknown>,
  prefixedKey: string,
  legacyKey: string,
  fallback: T,
): unknown | T {
  if (hasOwnKey(source, prefixedKey)) {
    return source[prefixedKey];
  }

  if (hasOwnKey(source, legacyKey)) {
    return source[legacyKey];
  }

  return fallback;
}

function normalizeTabItem(raw: unknown): TabItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const url = asString(raw.url).trim();
  if (!url || !isValidUrl(url)) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const lastOpenedAt = raw.lastOpenedAt == null ? null : asNumber(raw.lastOpenedAt, createdAt);

  return {
    id: asString(raw.id, generateId("tab")),
    title: sanitizeLabel(asString(raw.title), "Untitled Tab", 200),
    url,
    favIconUrl: asNullableString(raw.favIconUrl),
    folderId: raw.folderId == null ? null : asString(raw.folderId) || null,
    tagIds: asStringArray(raw.tagIds),
    pinned: asBoolean(raw.pinned),
    windowId: typeof raw.windowId === "number" ? raw.windowId : null,
    note: clampText(stripHtml(asString(raw.note)), 2000),
    reminderAt: asNullableNumber(raw.reminderAt),
    reminderSnoozedUntil: asNullableNumber(raw.reminderSnoozedUntil),
    reminderDismissed: asBoolean(raw.reminderDismissed),
    position: asNumber(raw.position, 0),
    openCount: Math.max(0, asNumber(raw.openCount, 0)),
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

  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);

  return {
    id: asString(raw.id, generateId("session")),
    name: sanitizeLabel(asString(raw.name), "Untitled Session", 100),
    description: clampText(stripHtml(asString(raw.description)), 300),
    folderId: raw.folderId == null ? null : asString(raw.folderId) || null,
    tagIds: asStringArray(raw.tagIds),
    tabs: tabs
      .map((tab, index) => ({
        ...tab,
        position: typeof tab.position === "number" ? tab.position : index,
      }))
      .sort((left, right) => left.position - right.position)
      .map((tab, index) => ({ ...tab, position: index })),
    note: clampText(stripHtml(asString(raw.note)), 5000),
    color: raw.color == null ? null : asString(raw.color) || null,
    icon: raw.icon == null ? null : asString(raw.icon) || null,
    openCount: Math.max(0, asNumber(raw.openCount, 0)),
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
    id: asString(raw.id, generateId("folder")),
    name: clampText(stripHtml(name), 50),
    color: asString(raw.color, "#3B82F6"),
    icon: asString(raw.icon, "folder"),
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
    id: asString(raw.id, generateId("tag")),
    name: clampText(stripHtml(name).replace(/[^a-zA-Z0-9\- ]/g, ""), 30) || "Tag",
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
    id: asString(raw.id, generateId("schedule")),
    sessionId: asString(raw.sessionId),
    type: type as Schedule["type"],
    time: /^\d{2}:\d{2}$/.test(time) ? time : "09:00",
    daysOfWeek: Array.isArray(raw.daysOfWeek)
      ? raw.daysOfWeek.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6)
      : [],
    date: raw.date == null ? null : asString(raw.date) || null,
    enabled: asBoolean(raw.enabled, true),
    lastFiredAt: raw.lastFiredAt == null ? null : asNumber(raw.lastFiredAt, updatedAt),
    createdAt,
    updatedAt,
  };
}

function normalizeStandaloneNote(raw: unknown): StandaloneNote | null {
  if (!isRecord(raw)) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);
  const title = sanitizeLabel(asString(raw.title), "Untitled Note", 100);
  const content = clampText(stripHtml(asString(raw.content)), 10000);

  if (!title && !content) {
    return null;
  }

  return {
    id: asString(raw.id, generateId("note")),
    title,
    content,
    isPinned: asBoolean(raw.isPinned),
    color: raw.color == null ? null : asString(raw.color) || null,
    tagIds: asStringArray(raw.tagIds),
    createdAt,
    updatedAt,
  };
}

function normalizeShareLink(raw: unknown): ShareLink | null {
  if (!isRecord(raw)) {
    return null;
  }

  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);
  const type = asString(raw.type, "encoded-url");

  if (!["text", "markdown", "encoded-url", "hosted"].includes(type)) {
    return null;
  }

  return {
    id: asString(raw.id, generateId("share")),
    sessionId: asString(raw.sessionId),
    type: (type === "hosted" ? "encoded-url" : type) as ShareLink["type"],
    encodedData: raw.encodedData == null ? null : asString(raw.encodedData) || null,
    expiresAt: raw.expiresAt == null ? null : asNumber(raw.expiresAt, createdAt),
    createdAt,
    updatedAt,
  };
}

function normalizeAIConfig(raw: unknown): AIShareConfig {
  if (!isRecord(raw)) {
    return DEFAULT_AI_CONFIG;
  }

  const defaultProvider = asString(raw.defaultProvider, DEFAULT_AI_CONFIG.defaultProvider);

  return {
    defaultProvider:
      defaultProvider === "chatgpt" ||
      defaultProvider === "claude" ||
      defaultProvider === "gemini" ||
      defaultProvider === "custom"
        ? defaultProvider
        : DEFAULT_AI_CONFIG.defaultProvider,
    customProviderUrl: asString(raw.customProviderUrl, DEFAULT_AI_CONFIG.customProviderUrl),
    customPromptTemplate: asString(raw.customPromptTemplate, DEFAULT_AI_CONFIG.customPromptTemplate),
    includeUrls: asBoolean(raw.includeUrls, DEFAULT_AI_CONFIG.includeUrls),
    includeTitles: asBoolean(raw.includeTitles, DEFAULT_AI_CONFIG.includeTitles),
    includeNotes: asBoolean(raw.includeNotes, DEFAULT_AI_CONFIG.includeNotes),
    promptPreamble: asString(raw.promptPreamble, DEFAULT_AI_CONFIG.promptPreamble),
  };
}

function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) {
    return DEFAULT_SETTINGS;
  }

  const theme = asString(raw.theme, DEFAULT_SETTINGS.theme);
  const cardStyle = asString(raw.sessionCardStyle, DEFAULT_SETTINGS.sessionCardStyle);
  const layout = asString(raw.dashboardLayout, DEFAULT_SETTINGS.dashboardLayout);
  const quickInfoDelayMs = asNumber(raw.quickInfoDelayMs, DEFAULT_SETTINGS.quickInfoDelayMs);
  const defaultAIProvider = asString(raw.defaultAIProvider, DEFAULT_SETTINGS.defaultAIProvider);
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
    remindersEnabled: asBoolean(raw.remindersEnabled, DEFAULT_SETTINGS.remindersEnabled),
    searchOverlayEnabled: asBoolean(raw.searchOverlayEnabled, DEFAULT_SETTINGS.searchOverlayEnabled),
    searchOverlayShortcut: asString(raw.searchOverlayShortcut, DEFAULT_SETTINGS.searchOverlayShortcut),
    quickInfoEnabled: asBoolean(raw.quickInfoEnabled, DEFAULT_SETTINGS.quickInfoEnabled),
    quickInfoDelayMs:
      quickInfoDelayMs === 200 || quickInfoDelayMs === 400 || quickInfoDelayMs === 700
        ? quickInfoDelayMs
        : DEFAULT_SETTINGS.quickInfoDelayMs,
    aiEnabled: asBoolean(raw.aiEnabled, DEFAULT_SETTINGS.aiEnabled),
    defaultAIProvider:
      defaultAIProvider === "chatgpt" ||
      defaultAIProvider === "claude" ||
      defaultAIProvider === "gemini" ||
      defaultAIProvider === "custom"
        ? defaultAIProvider
        : DEFAULT_SETTINGS.defaultAIProvider,
    customAIProviderUrl: asString(raw.customAIProviderUrl, DEFAULT_SETTINGS.customAIProviderUrl),
    customAIPromptTemplate: asString(raw.customAIPromptTemplate, DEFAULT_SETTINGS.customAIPromptTemplate),
    exportIncludeNotes: asBoolean(raw.exportIncludeNotes, DEFAULT_SETTINGS.exportIncludeNotes),
    version: asString(raw.version, APP_VERSION),
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
    hasCompletedOnboarding: asBoolean(
      raw.hasCompletedOnboarding,
      typeof raw.version === "string" ? true : DEFAULT_SETTINGS.hasCompletedOnboarding,
    ),
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

function storageRemove(keys: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([...keys], () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve();
    });
  });
}

function toStorageRecord(data: StorageData): Record<string, unknown> {
  return {
    [STORAGE_KEYS.sessions]: data.sessions,
    [STORAGE_KEYS.folders]: data.folders,
    [STORAGE_KEYS.tags]: data.tags,
    [STORAGE_KEYS.schedules]: data.schedules,
    [STORAGE_KEYS.standaloneNotes]: data.standaloneNotes,
    [STORAGE_KEYS.shareLinks]: data.shareLinks,
    [STORAGE_KEYS.aiConfig]: data.aiConfig,
    [STORAGE_KEYS.settings]: data.settings,
    [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION,
  };
}

function hasLegacyStorage(raw: Record<string, unknown>): boolean {
  return LEGACY_KEYS.some((key) => hasOwnKey(raw, key));
}

async function migrateLegacyStorage(raw: Record<string, unknown>, data: StorageData): Promise<void> {
  const fromVersion = asNumber(raw[STORAGE_KEYS.schemaVersion], 1);
  let migrated = data;
  for (let version = Math.max(2, fromVersion + 1); version <= SCHEMA_VERSION; version += 1) {
    migrated = (MIGRATIONS[version] ?? ((d: StorageData) => d))(migrated);
  }

  if (!hasLegacyStorage(raw) && fromVersion === SCHEMA_VERSION) {
    return;
  }

  await storageSet(toStorageRecord(migrated));
  await storageRemove(LEGACY_KEYS);
}

export function getDefaultStorageData(): StorageData {
  return {
    sessions: [],
    folders: [],
    tags: [],
    schedules: [],
    standaloneNotes: [],
    shareLinks: [],
    aiConfig: { ...DEFAULT_AI_CONFIG },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function normalizeStorageData(raw: unknown): StorageData {
  const source = isRecord(raw) ? raw : {};
  const defaultData = getDefaultStorageData();
  const rawFolders = sourceValue(source, STORAGE_KEYS.folders, "folders", []);
  const rawTags = sourceValue(source, STORAGE_KEYS.tags, "tags", []);
  const rawSessions = sourceValue(source, STORAGE_KEYS.sessions, "sessions", []);
  const rawSchedules = sourceValue(source, STORAGE_KEYS.schedules, "schedules", []);
  const rawStandaloneNotes = sourceValue(source, STORAGE_KEYS.standaloneNotes, "standaloneNotes", []);
  const rawShareLinks = sourceValue(source, STORAGE_KEYS.shareLinks, "shareLinks", []);
  const rawSettings = sourceValue(source, STORAGE_KEYS.settings, "settings", DEFAULT_SETTINGS);
  const rawAIConfig = sourceValue(source, STORAGE_KEYS.aiConfig, "aiConfig", DEFAULT_AI_CONFIG);

  const hasFolderData = Array.isArray(rawFolders);
  const hasTagData = Array.isArray(rawTags);
  const folders = hasFolderData
    ? rawFolders.map(normalizeFolder).filter((item): item is Folder => Boolean(item))
    : [];
  const tags = hasTagData
    ? rawTags.map(normalizeTag).filter((item): item is Tag => Boolean(item))
    : [];

  const safeFolders = (hasFolderData ? folders : defaultData.folders)
    .sort((left, right) => left.position - right.position)
    .map((folder, index) => ({ ...folder, position: index }));
  const safeTags = hasTagData ? tags : defaultData.tags;
  const folderIds = new Set(safeFolders.map((folder) => folder.id));
  const tagIds = new Set(safeTags.map((tag) => tag.id));

  const sessions = Array.isArray(rawSessions)
    ? rawSessions
        .map(normalizeSession)
        .filter((item): item is Session => Boolean(item))
        .map((session) => ({
          ...session,
          folderId: session.folderId && folderIds.has(session.folderId) ? session.folderId : null,
          tagIds: session.tagIds.filter((tagId) => tagIds.has(tagId)),
          tabs: session.tabs.map((tab) => ({
            ...tab,
            folderId: tab.folderId && folderIds.has(tab.folderId) ? tab.folderId : null,
            tagIds: tab.tagIds.filter((tagId) => tagIds.has(tagId)),
          })),
        }))
    : [];

  const sessionIds = new Set(sessions.map((session) => session.id));
  const schedules = Array.isArray(rawSchedules)
    ? rawSchedules
        .map(normalizeSchedule)
        .filter((item): item is Schedule => Boolean(item))
        .filter((schedule) => sessionIds.has(schedule.sessionId))
    : [];
  const standaloneNotes = Array.isArray(rawStandaloneNotes)
    ? rawStandaloneNotes
        .map(normalizeStandaloneNote)
        .filter((item): item is StandaloneNote => Boolean(item))
        .map((note) => ({
          ...note,
          tagIds: note.tagIds.filter((tagId) => tagIds.has(tagId)),
        }))
    : [];
  const shareLinks = Array.isArray(rawShareLinks)
    ? rawShareLinks
        .map(normalizeShareLink)
        .filter((item): item is ShareLink => Boolean(item))
        .filter((shareLink) => sessionIds.has(shareLink.sessionId))
    : [];

  return {
    sessions,
    folders: safeFolders,
    tags: safeTags,
    schedules,
    standaloneNotes,
    shareLinks,
    aiConfig: normalizeAIConfig(rawAIConfig),
    settings: normalizeSettings(rawSettings),
  };
}

export function validateImportPayload(raw: unknown): void {
  if (!isRecord(raw)) {
    throw new Error("This file is not a valid TabSetu backup.");
  }

  const hasKnownKey = STORAGE_IMPORT_KEYS.some((key) => hasOwnKey(raw, key));
  if (!hasKnownKey) {
    throw new Error("This file is not a TabSetu backup.");
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

  if (hasOwnKey(raw, "standaloneNotes") && !Array.isArray(raw.standaloneNotes)) {
    throw new Error("The backup file has an invalid notes section.");
  }

  if (hasOwnKey(raw, "shareLinks") && !Array.isArray(raw.shareLinks)) {
    throw new Error("The backup file has an invalid share links section.");
  }

  if (hasOwnKey(raw, "aiConfig") && !isRecord(raw.aiConfig)) {
    throw new Error("The backup file has an invalid AI settings section.");
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
  const raw = await storageGet<Record<string, unknown>>(null);
  const data = normalizeStorageData(raw);
  await migrateLegacyStorage(raw, data);
  return data;
}

function normalizeUndoBuffer(raw: unknown): UndoCollapseBuffer | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const buffer = raw as UndoCollapseBuffer;
  return buffer.expiresAt > Date.now() ? buffer : null;
}

export async function loadStorageWithUndoBuffer(): Promise<{
  data: StorageData;
  undoBuffer: UndoCollapseBuffer | null;
}> {
  const raw = await storageGet<Record<string, unknown>>(null);
  const data = normalizeStorageData(raw);
  await migrateLegacyStorage(raw, data);
  const undoBuffer = normalizeUndoBuffer(raw[STORAGE_KEYS.undoBuffer] ?? raw.tabsetuUndoBuffer);
  if (!undoBuffer && raw[STORAGE_KEYS.undoBuffer]) {
    await saveUndoBuffer(null);
  }
  return { data, undoBuffer };
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  await storageSet({ [STORAGE_KEYS.sessions]: sessions, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  await storageSet({ [STORAGE_KEYS.folders]: folders, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveTags(tags: Tag[]): Promise<void> {
  await storageSet({ [STORAGE_KEYS.tags]: tags, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  await storageSet({ [STORAGE_KEYS.schedules]: schedules, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageSet({ [STORAGE_KEYS.settings]: settings, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveStandaloneNotes(standaloneNotes: StandaloneNote[]): Promise<void> {
  await storageSet({ [STORAGE_KEYS.standaloneNotes]: standaloneNotes, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveShareLinks(shareLinks: ShareLink[]): Promise<void> {
  await storageSet({ [STORAGE_KEYS.shareLinks]: shareLinks, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveAIConfig(aiConfig: AIShareConfig): Promise<void> {
  await storageSet({ [STORAGE_KEYS.aiConfig]: aiConfig, [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function saveStorageData(data: StorageData): Promise<void> {
  await storageSet(toStorageRecord(normalizeStorageData(data)));
  await storageRemove(LEGACY_KEYS);
}

export async function clearAllData(): Promise<void> {
  await saveStorageData(getDefaultStorageData());
}

export async function saveUndoBuffer(buffer: UndoCollapseBuffer | null): Promise<void> {
  await storageSet({ [STORAGE_KEYS.undoBuffer]: buffer });
}

export async function loadUndoBuffer(): Promise<UndoCollapseBuffer | null> {
  const result = await storageGet<Record<string, UndoCollapseBuffer | null>>([
    STORAGE_KEYS.undoBuffer,
    "tabsetuUndoBuffer",
  ]);
  const buffer = result[STORAGE_KEYS.undoBuffer] ?? result.tabsetuUndoBuffer;

  const normalized = normalizeUndoBuffer(buffer);
  if (!normalized) {
    await saveUndoBuffer(null);
    return null;
  }

  return normalized;
}

export async function initializeStorageForInstall(): Promise<void> {
  await saveStorageData({
    ...getDefaultStorageData(),
    folders: getOnboardingFolders(),
    tags: getOnboardingTags(),
  });
}
