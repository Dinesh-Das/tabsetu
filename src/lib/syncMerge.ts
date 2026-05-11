/**
 * Merges local TabSetu storage with a partial remote Google Drive snapshot.
 */
import type { AIShareConfig, StorageData } from "@/types";

type MergeableEntity = {
  id: string;
  createdAt?: number;
  updatedAt?: number;
};

function entityTimestamp(entity: MergeableEntity): number {
  return entity.updatedAt ?? entity.createdAt ?? 0;
}

function mergeByUpdatedAt<T extends MergeableEntity>(
  localItems: T[],
  remoteItems: T[] | undefined
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

  return Array.from(merged.values());
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

export function mergeStorageData(local: StorageData, remote: Partial<StorageData>): StorageData {
  return {
    sessions: mergeByUpdatedAt(local.sessions, remote.sessions),
    folders: mergeByUpdatedAt(local.folders, remote.folders),
    tags: mergeByUpdatedAt(local.tags, remote.tags),
    schedules: mergeByUpdatedAt(local.schedules, remote.schedules),
    standaloneNotes: mergeByUpdatedAt(local.standaloneNotes, remote.standaloneNotes),
    shareLinks: mergeByUpdatedAt(local.shareLinks, remote.shareLinks),
    settings: local.settings,
    aiConfig: mergeAIConfig(local.aiConfig, remote.aiConfig),
  };
}
