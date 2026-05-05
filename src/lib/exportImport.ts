import { getDefaultStorageData, normalizeImportedStorageData, normalizeStorageData } from "@/lib/storage";
import { clampText, generateId, isValidUrl, sanitizeLabel, stripHtml } from "@/lib/tabHelpers";
import type { AIShareConfig, Session, StorageData, TabItem } from "@/types";

function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const BACKUP_IMPORT_KEYS = [
  "sessions",
  "folders",
  "tags",
  "schedules",
  "standaloneNotes",
  "shareLinks",
  "aiConfig",
  "settings",
] as const;

interface LegacyTabSeed {
  title: string | null;
  url: string;
}

interface LegacySection {
  name: string | null;
  tabs: LegacyTabSeed[];
}

function hasOwnKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasBackupImportKey(value: unknown): boolean {
  return isRecord(value) && BACKUP_IMPORT_KEYS.some((key) => hasOwnKey(value, key));
}

function looksLikeTabSetuSession(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    Array.isArray(value.tabs) &&
    (typeof value.createdAt === "number" || typeof value.updatedAt === "number" || typeof value.version === "number")
  );
}

function looksLikeTabSetuBackup(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const metadataKeys = ["folders", "tags", "schedules", "standaloneNotes", "shareLinks", "aiConfig", "settings"];
  if (metadataKeys.some((key) => hasOwnKey(value, key))) {
    return true;
  }

  if (!Array.isArray(value.sessions)) {
    return false;
  }

  if (typeof value.sessions[0] === "undefined") {
    return true;
  }

  return value.sessions.every(looksLikeTabSetuSession);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(
    /&#(\d+);|&#x([\da-f]+);|&([a-z]+);/gi,
    (match, decimal: string | undefined, hex: string | undefined, named: string | undefined): string => {
      if (decimal) {
        const codePoint = Number.parseInt(decimal, 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }

      if (hex) {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }

      if (named) {
        return namedEntities[named.toLowerCase()] ?? match;
      }

      return match;
    },
  );
}

function normalizeUrlCandidate(value: string): string | null {
  const trimmed = decodeHtmlEntities(value)
    .trim()
    .replace(/[),.;\]]+$/u, "");

  if (isValidUrl(trimmed)) {
    return trimmed;
  }

  if (/^www\./i.test(trimmed)) {
    const withProtocol = `https://${trimmed}`;
    return isValidUrl(withProtocol) ? withProtocol : null;
  }

  return null;
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "") || "Imported tab";
  } catch {
    return "Imported tab";
  }
}

function parseTextLine(line: string): LegacyTabSeed | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const directUrl = normalizeUrlCandidate(trimmed);
  if (directUrl) {
    return { title: null, url: directUrl };
  }

  const pipeParts = trimmed
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (typeof pipeParts[1] !== "undefined") {
    for (let index = 0; index < pipeParts.length; index += 1) {
      const candidate = normalizeUrlCandidate(pipeParts[index]);
      if (!candidate) {
        continue;
      }

      const title = pipeParts
        .filter((_part, partIndex) => partIndex !== index)
        .join(" | ")
        .trim();

      return {
        title: title || null,
        url: candidate,
      };
    }
  }

  const urlMatch = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/i.exec(trimmed);
  if (!urlMatch) {
    return null;
  }

  const matchedUrl = normalizeUrlCandidate(urlMatch[0]);
  if (!matchedUrl) {
    return null;
  }

  const title = trimmed
    .replace(urlMatch[0], "")
    .replace(/^[\s\-|:]+|[\s\-|:]+$/g, "")
    .trim();

  return {
    title: title || null,
    url: matchedUrl,
  };
}

function parseTextSections(text: string): LegacySection[] {
  return text
    .split(/\r?\n\s*\r?\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index): LegacySection | null => {
      const tabs: LegacyTabSeed[] = [];
      let sectionName: string | null = null;

      for (const line of block.split(/\r?\n/g)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const parsedTab = parseTextLine(trimmed);
        if (parsedTab) {
          tabs.push(parsedTab);
          continue;
        }

        if (!sectionName) {
          sectionName = sanitizeLabel(trimmed, `Imported tabs ${index + 1}`, 100);
        }
      }

      return tabs.length === 0
        ? null
        : {
            name: sectionName,
            tabs,
          };
    })
    .filter((section): section is LegacySection => Boolean(section));
}

function htmlAttribute(attributes: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = pattern.exec(attributes);
  if (!match) {
    return null;
  }

  return decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "").trim() || null;
}

function parseHtmlSections(html: string): LegacySection[] {
  const sectionTabs = new Map<string, LegacyTabSeed[]>();
  const sectionNames: string[] = [];
  const fallbackName = "Imported HTML links";
  let activeSection = fallbackName;
  const tokenPattern = /<(h[1-6]|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match = tokenPattern.exec(html);

  while (match) {
    const tagName = match[1].toLowerCase();
    const attributes = match[2];
    const innerText = sanitizeLabel(decodeHtmlEntities(stripHtml(match[3])), "", 200);

    if (tagName.startsWith("h")) {
      activeSection = innerText || fallbackName;
    } else {
      const href = htmlAttribute(attributes, "href");
      const url = href ? normalizeUrlCandidate(href) : null;
      if (url) {
        const storedName = activeSection || fallbackName;
        const existingTabs = sectionTabs.get(storedName);
        if (existingTabs) {
          existingTabs.push({ title: innerText || null, url });
        } else {
          sectionTabs.set(storedName, [{ title: innerText || null, url }]);
          sectionNames.push(storedName);
        }
      }
    }

    match = tokenPattern.exec(html);
  }

  return sectionNames.map((name) => ({
    name,
    tabs: sectionTabs.get(name) ?? [],
  }));
}

function tabSeedFromRecord(record: Record<string, unknown>): LegacyTabSeed | null {
  const urlValue = firstString(record, ["url", "href", "link", "uri"]);
  const url = urlValue ? normalizeUrlCandidate(urlValue) : null;
  if (!url) {
    return null;
  }

  return {
    title: firstString(record, ["title", "name", "label", "displayTitle"]),
    url,
  };
}

function containerName(record: Record<string, unknown>): string | null {
  return firstString(record, ["name", "title", "sessionName", "windowName", "label"]);
}

function collectJsonSections(
  value: unknown,
  inheritedName: string | null,
  sections: LegacySection[],
  looseTabs: LegacyTabSeed[],
): void {
  if (Array.isArray(value)) {
    const tabs = value
      .map((item) => (isRecord(item) ? tabSeedFromRecord(item) : null))
      .filter((tab): tab is LegacyTabSeed => Boolean(tab));

    if (tabs.length !== 0) {
      sections.push({ name: inheritedName, tabs });
      return;
    }

    for (const item of value) {
      collectJsonSections(item, inheritedName, sections, looseTabs);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const directTab = tabSeedFromRecord(value);
  if (directTab) {
    looseTabs.push(directTab);
    return;
  }

  const nextName = containerName(value) ?? inheritedName;
  const consumedKeys = new Set<string>();

  for (const [key, child] of Object.entries(value)) {
    if (!Array.isArray(child)) {
      continue;
    }

    const tabs = child
      .map((item) => (isRecord(item) ? tabSeedFromRecord(item) : null))
      .filter((tab): tab is LegacyTabSeed => Boolean(tab));

    if (tabs.length !== 0) {
      sections.push({ name: nextName, tabs });
      consumedKeys.add(key);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (consumedKeys.has(key)) {
      continue;
    }

    collectJsonSections(child, nextName, sections, looseTabs);
  }
}

function parseJsonSections(value: unknown): LegacySection[] {
  const sections: LegacySection[] = [];
  const looseTabs: LegacyTabSeed[] = [];
  collectJsonSections(value, null, sections, looseTabs);

  if (looseTabs.length !== 0) {
    sections.push({ name: "Imported JSON tabs", tabs: looseTabs });
  }

  return sections;
}

function createImportedTab(seed: LegacyTabSeed, position: number, createdAt: number): TabItem | null {
  const url = normalizeUrlCandidate(seed.url);
  if (!url) {
    return null;
  }

  const fallbackTitle = titleFromUrl(url);

  return {
    id: generateId("tab"),
    title: sanitizeLabel(seed.title ?? fallbackTitle, fallbackTitle, 200),
    url,
    favIconUrl: null,
    favIconDataUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position,
    openCount: 0,
    createdAt,
    lastOpenedAt: null,
  };
}

function createImportedSession(
  section: LegacySection,
  index: number,
  createdAt: number,
  sourceLabel: string,
): Session | null {
  const tabs = section.tabs
    .map((tab, tabIndex) => createImportedTab(tab, tabIndex, createdAt))
    .filter((tab): tab is TabItem => Boolean(tab))
    .map((tab, tabIndex) => ({ ...tab, position: tabIndex }));

  if (tabs.length === 0) {
    return null;
  }

  return {
    id: generateId("session"),
    name: sanitizeLabel(section.name ?? undefined, `Imported session ${index + 1}`, 100),
    description: clampText(`Imported from ${sourceLabel}.`, 300),
    folderId: null,
    tagIds: [],
    tabs,
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };
}

function storageFromLegacySections(sections: LegacySection[], sourceLabel: string): StorageData {
  const createdAt = Date.now();
  const sessions = sections
    .map((section, index) => createImportedSession(section, index, createdAt, sourceLabel))
    .filter((session): session is Session => Boolean(session));

  if (sessions.length === 0) {
    throw new Error("No valid tabs were found in that import file.");
  }

  const defaults = getDefaultStorageData();
  return normalizeStorageData({
    sessions,
    folders: [],
    tags: [],
    schedules: [],
    standaloneNotes: [],
    shareLinks: [],
    aiConfig: defaults.aiConfig,
    settings: defaults.settings,
  });
}

function parseJsonImport(text: string): StorageData | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (hasBackupImportKey(parsed) && looksLikeTabSetuBackup(parsed)) {
      return normalizeImportedStorageData(parsed);
    }

    const sections = parseJsonSections(parsed);
    return sections.length === 0 ? null : storageFromLegacySections(sections, "Session Buddy JSON");
  } catch (error) {
    if (/^\s*[\[{]/.test(text)) {
      throw error instanceof Error ? error : new Error("This JSON file could not be parsed.");
    }

    return null;
  }
}

function isLikelyHtml(text: string, file: File): boolean {
  return (
    /<a\b/i.test(text) ||
    /<\/html>|<body\b|<!doctype html/i.test(text) ||
    file.type.toLowerCase().includes("html") ||
    /\.html?$/i.test(file.name)
  );
}

export interface StorageSummary {
  sessions: number;
  tabs: number;
  folders: number;
  tags: number;
  schedules: number;
  notes: number;
  shareLinks: number;
}

export interface SessionExportOptions {
  includeNotes?: boolean;
}

export function exportJSON(data: StorageData): void {
  downloadFile(
    JSON.stringify(data, null, 2),
    `tabsetu-backup-${new Date().toISOString().split("T")[0]}.json`,
    "application/json",
  );
}

export function summarizeStorageData(data: StorageData): StorageSummary {
  const sessionNoteCount = data.sessions.filter((session) => session.note.trim()).length;
  const tabNoteCount = data.sessions.reduce(
    (total, session) => total + session.tabs.filter((tab) => tab.note.trim()).length,
    0,
  );

  return {
    sessions: data.sessions.length,
    tabs: data.sessions.reduce((total, session) => total + session.tabs.length, 0),
    folders: data.folders.length,
    tags: data.tags.length,
    schedules: data.schedules.length,
    notes: data.standaloneNotes.length + sessionNoteCount + tabNoteCount,
    shareLinks: data.shareLinks.length,
  };
}

function entityTimestamp(value: {
  updatedAt?: number | null;
  createdAt?: number | null;
  lastOpenedAt?: number | null;
}): number {
  return value.updatedAt ?? value.lastOpenedAt ?? value.createdAt ?? 0;
}

function mergeById<T extends { id: string }>(
  current: T[],
  imported: T[],
  choose: (currentItem: T, importedItem: T) => T,
): T[] {
  const merged = [...current];
  const indexById = new Map(merged.map((item, index) => [item.id, index]));

  for (const importedItem of imported) {
    const existingIndex = indexById.get(importedItem.id);
    if (existingIndex == null) {
      indexById.set(importedItem.id, merged.length);
      merged.push(importedItem);
      continue;
    }

    merged[existingIndex] = choose(merged[existingIndex], importedItem);
  }

  return merged;
}

function chooseMostRecent<T extends {
  updatedAt?: number | null;
  createdAt?: number | null;
  lastOpenedAt?: number | null;
}>(
  currentItem: T,
  importedItem: T,
): T {
  return entityTimestamp(importedItem) >= entityTimestamp(currentItem) ? importedItem : currentItem;
}

function chooseSessionWinner(currentSession: Session, importedSession: Session): Session {
  if (importedSession.version !== currentSession.version) {
    return importedSession.version > currentSession.version ? importedSession : currentSession;
  }

  return chooseMostRecent(currentSession, importedSession);
}

export function mergeStorageData(current: StorageData, imported: StorageData): StorageData {
  return normalizeStorageData({
    sessions: mergeById(current.sessions, imported.sessions, chooseSessionWinner),
    folders: mergeById(current.folders, imported.folders, chooseMostRecent),
    tags: mergeById(current.tags, imported.tags, chooseMostRecent),
    schedules: mergeById(current.schedules, imported.schedules, chooseMostRecent),
    standaloneNotes: mergeById(current.standaloneNotes, imported.standaloneNotes, chooseMostRecent),
    shareLinks: mergeById(current.shareLinks, imported.shareLinks, chooseMostRecent),
    aiConfig: current.aiConfig,
    settings: current.settings,
  });
}

export async function importFile(file: File): Promise<StorageData> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error("Failed to read import file.");
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Import file is empty.");
  }

  const jsonImport = parseJsonImport(trimmedText);
  if (jsonImport) {
    return jsonImport;
  }

  if (isLikelyHtml(trimmedText, file)) {
    const htmlSections = parseHtmlSections(trimmedText);
    if (htmlSections.length !== 0) {
      return storageFromLegacySections(htmlSections, "HTML export");
    }
  }

  const textSections = parseTextSections(trimmedText);
  if (textSections.length !== 0) {
    return storageFromLegacySections(textSections, "OneTab text");
  }

  throw new Error("No valid tabs were found in that import file.");
}

export function importJSON(file: File): Promise<StorageData> {
  return importFile(file);
}

export function sessionToMarkdown(session: Session, options?: SessionExportOptions): string {
  const includeNotes = options?.includeNotes ?? true;
  const lines = [
    `# ${session.name}`,
    session.description ? "" : undefined,
    session.description ? `> ${session.description}` : undefined,
    includeNotes && session.note ? "" : undefined,
    includeNotes && session.note ? `Notes: ${session.note}` : undefined,
    "",
    `Saved: ${new Date(session.createdAt).toLocaleString()}`,
    `Updated: ${new Date(session.updatedAt).toLocaleString()}`,
    `Tabs: ${session.tabs.length}`,
    "",
    "## Links",
    "",
    ...session.tabs.map((tab) => `- [${tab.title}](${tab.url})${includeNotes && tab.note ? ` - ${tab.note}` : ""}`),
  ].filter((line): line is string => typeof line === "string");

  return lines.join("\n");
}

export function sessionToPlainText(session: Session, options?: SessionExportOptions): string {
  const includeNotes = options?.includeNotes ?? true;
  const lines = [
    session.name,
    session.description,
    includeNotes && session.note ? `Notes: ${session.note}` : "",
    "",
    ...session.tabs.flatMap((tab) => [
      tab.title,
      tab.url,
      includeNotes && tab.note ? `Note: ${tab.note}` : "",
      "",
    ]),
  ].filter(Boolean);

  return lines.join("\n");
}

export function downloadMarkdown(session: Session): void {
  downloadFile(
    sessionToMarkdown(session),
    `${session.name.replace(/\s+/g, "-").toLowerCase() || "session"}.md`,
    "text/markdown",
  );
}

export function downloadPlainText(session: Session): void {
  downloadFile(
    sessionToPlainText(session),
    `${session.name.replace(/\s+/g, "-").toLowerCase() || "session"}.txt`,
    "text/plain",
  );
}

export function copyLinksToClipboard(session: Session): string {
  return session.tabs.map((tab) => `${tab.title}\n${tab.url}`).join("\n\n");
}

export function generateAIPrompt(session: Session, config?: Partial<AIShareConfig>): string {
  const includeTitles = config?.includeTitles ?? true;
  const includeUrls = config?.includeUrls ?? true;
  const includeNotes = config?.includeNotes ?? true;
  const links = session.tabs
    .map((tab) => {
      const pieces = [
        includeTitles ? tab.title : "",
        includeUrls ? tab.url : "",
        includeNotes && tab.note ? `Note: ${tab.note}` : "",
      ].filter(Boolean);
      return `- ${pieces.join(" - ")}`;
    })
    .join("\n");

  return [
    config?.promptPreamble?.trim(),
    `Analyze this browser session called "${session.name}".`,
    includeNotes && session.note ? `Session note: ${session.note}` : "",
    "1. Summarize the likely purpose in 2 to 3 sentences.",
    "2. Cluster the links by topic or task.",
    "3. Suggest 3 to 5 tags.",
    "4. Flag duplicate or low-value tabs.",
    "",
    "Links:",
    links,
  ].filter(Boolean).join("\n");
}

async function fetchTabPageText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      return null;
    }

    return stripHtml(await response.text());
  } catch {
    return null;
  }
}

export async function generateAIPromptWithPageText(
  session: Session,
  config?: Partial<AIShareConfig>,
): Promise<string> {
  const basePrompt = generateAIPrompt(session, config);
  const pageTexts = await Promise.all(
    session.tabs.map(async (tab) => ({
      tab,
      text: await fetchTabPageText(tab.url),
    })),
  );

  const availableTexts = pageTexts.filter((item): item is { tab: Session["tabs"][number]; text: string } =>
    Boolean(item.text),
  );

  if (availableTexts.length === 0) {
    return `${basePrompt}\n\nPage text:\nNo page text could be fetched from the saved URLs. Use the saved titles, URLs, and notes above.`;
  }

  return [
    basePrompt,
    "",
    "Page text:",
    ...availableTexts.flatMap((item) => [
      "",
      `## ${item.tab.title}`,
      item.tab.url,
      item.text,
    ]),
  ].join("\n");
}
