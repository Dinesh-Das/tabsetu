import { normalizeImportedStorageData, normalizeStorageData } from "@/lib/storage";
import type { Session, StorageData } from "@/types";

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

export interface StorageSummary {
  sessions: number;
  tabs: number;
  folders: number;
  tags: number;
  schedules: number;
}

export function exportJSON(data: StorageData): void {
  downloadFile(
    JSON.stringify(data, null, 2),
    `tabnest-backup-${new Date().toISOString().split("T")[0]}.json`,
    "application/json",
  );
}

export function summarizeStorageData(data: StorageData): StorageSummary {
  return {
    sessions: data.sessions.length,
    tabs: data.sessions.reduce((total, session) => total + session.tabs.length, 0),
    folders: data.folders.length,
    tags: data.tags.length,
    schedules: data.schedules.length,
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
    settings: current.settings,
  });
}

export function importJSON(file: File): Promise<StorageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isRecord(parsed)) {
          throw new Error("Invalid backup file.");
        }

        resolve(normalizeImportedStorageData(parsed));
      } catch (error) {
        if (error instanceof Error) {
          reject(error);
          return;
        }

        reject(new Error("Invalid JSON backup file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read backup file."));
    reader.readAsText(file);
  });
}

export function sessionToMarkdown(session: Session): string {
  const lines = [
    `# ${session.name}`,
    session.description ? "" : undefined,
    session.description ? `> ${session.description}` : undefined,
    session.note ? "" : undefined,
    session.note ? `Notes: ${session.note}` : undefined,
    "",
    `Saved: ${new Date(session.createdAt).toLocaleString()}`,
    `Updated: ${new Date(session.updatedAt).toLocaleString()}`,
    `Tabs: ${session.tabs.length}`,
    "",
    "## Links",
    "",
    ...session.tabs.map((tab) => `- [${tab.title}](${tab.url})${tab.note ? ` - ${tab.note}` : ""}`),
  ].filter((line): line is string => typeof line === "string");

  return lines.join("\n");
}

export function sessionToPlainText(session: Session): string {
  const lines = [
    session.name,
    session.description,
    session.note ? `Notes: ${session.note}` : "",
    "",
    ...session.tabs.flatMap((tab) => [
      tab.title,
      tab.url,
      tab.note ? `Note: ${tab.note}` : "",
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

export function generateAIPrompt(session: Session): string {
  const links = session.tabs.map((tab) => `- ${tab.title}: ${tab.url}`).join("\n");

  return [
    `Analyze this browser session called "${session.name}".`,
    "1. Summarize the likely purpose in 2 to 3 sentences.",
    "2. Group the links by topic or task.",
    "3. Suggest 3 to 5 tags.",
    "4. Flag duplicate or low-value tabs.",
    "",
    "Links:",
    links,
  ].join("\n");
}
