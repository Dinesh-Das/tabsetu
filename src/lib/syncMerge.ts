/**
 * Merges local TabSetu storage with a partial remote Google Drive snapshot.
 */
import type { AIShareConfig, Settings, StorageData } from "@/types";

type MergeableEntity = {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number;
};

function entityTimestamp(entity: MergeableEntity): number {
  return entity.deletedAt ?? entity.updatedAt ?? entity.createdAt ?? 0;
}

function mergeByUpdatedAt<T extends MergeableEntity>(
  localItems: T[],
  remoteItems: T[] | undefined,
  options: { includeDeleted?: boolean } = {}
): T[] {
  const merged = new Map<string, T>();

  for (const item of localItems) {
    merged.set(item.id, item);
  }

  for (const remoteItem of remoteItems ?? []) {
    const localItem = merged.get(remoteItem.id);
    if (!localItem || entityTimestamp(remoteItem) > entityTimestamp(localItem)) {
      merged.set(remoteItem.id, remoteItem);
    }
  }

  const items = Array.from(merged.values());
  return options.includeDeleted ? items : items.filter((item) => item.deletedAt == null);
}

function hasUpdatedAt(value: AIShareConfig): value is AIShareConfig & { updatedAt: number } {
  return "updatedAt" in value && typeof value.updatedAt === "number";
}

function mergeAIConfig(local: AIShareConfig, remote: AIShareConfig | undefined): AIShareConfig {
  if (!remote) {
    return local;
  }

  if (hasUpdatedAt(local) && hasUpdatedAt(remote)) {
    return remote.updatedAt > local.updatedAt ? remote : local;
  }

  return remote;
}

function settingsTimestamp(settings: Settings): number | null {
  const timestamp = Number(settings.updatedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function mergeSettings(local: Settings, remote: Settings | undefined, enabled: boolean): Settings {
  if (!enabled || !remote) {
    return local;
  }

  const localTimestamp = settingsTimestamp(local);
  const remoteTimestamp = settingsTimestamp(remote);
  let chosen: Settings;
  if (localTimestamp !== null && remoteTimestamp !== null) {
    chosen = localTimestamp >= remoteTimestamp ? local : remote;
  } else if (localTimestamp !== null) {
    chosen = local;
  } else if (remoteTimestamp !== null) {
    chosen = remote;
  } else {
    chosen = local;
  }

  return { ...chosen, theme: local.theme };
}

export function mergeStorageData(
  local: StorageData,
  remote: Partial<StorageData>,
  options: { mergeSettings?: boolean; includeDeleted?: boolean } = {}
): StorageData {
  return {
    sessions: mergeByUpdatedAt(local.sessions, remote.sessions, options),
    folders: mergeByUpdatedAt(local.folders, remote.folders, options),
    tags: mergeByUpdatedAt(local.tags, remote.tags, options),
    schedules: mergeByUpdatedAt(local.schedules, remote.schedules, options),
    standaloneNotes: mergeByUpdatedAt(local.standaloneNotes, remote.standaloneNotes, options),
    shareLinks: mergeByUpdatedAt(local.shareLinks, remote.shareLinks, options),
    settings: mergeSettings(local.settings, remote.settings, options.mergeSettings ?? false),
    aiConfig: mergeAIConfig(local.aiConfig, remote.aiConfig),
  };
}
