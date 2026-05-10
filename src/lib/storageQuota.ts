const QUOTA_WARNING_THRESHOLD = 0.8;

export interface StorageQuotaStatus {
  used: number;
  total: number;
  percentage: number;
  isWarning: boolean;
}

export async function checkStorageQuota(): Promise<StorageQuotaStatus> {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (used) => {
      const total = chrome.storage.local.QUOTA_BYTES ?? 10_485_760;
      const percentage = used / total;
      resolve({
        used,
        total,
        percentage,
        isWarning: percentage >= QUOTA_WARNING_THRESHOLD,
      });
    });
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
