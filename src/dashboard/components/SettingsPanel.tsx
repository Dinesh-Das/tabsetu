import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Cloud, Download, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { Folder, Tag, ToastMessage } from "@/types";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EntityEditorModal from "@/components/shared/EntityEditorModal";
import { exportJSON } from "@/lib/exportImport";
import { formatRelativeTime } from "@/lib/format";
import { clearAllData, ensurePendingAutoSyncUploadAlarm, loadStorage } from "@/lib/storage";
import { checkStorageQuota, formatBytes, type StorageQuotaStatus } from "@/lib/storageQuota";
import {
  hasOptionalPermission,
  removeOptionalPermission,
  requestOptionalPermission,
} from "@/lib/optionalPermissions";
import { normalizeCustomAIProviderUrl } from "@/lib/aiPromptSharing";
import { reconcileReminderAlarms } from "@/lib/reminderAlarms";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useSyncStore } from "@/store/syncStore";
import { useTagStore } from "@/store/tagStore";
import SyncGate from "./SyncGate";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
          {description}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function SettingsPanel({ addToast }: Props) {
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const sessions = useSessionStore((state) => state.sessions);
  const importSessions = useSessionStore((state) => state.importSessions);
  const unassignFolder = useSessionStore((state) => state.unassignFolder);
  const removeTagReferences = useSessionStore((state) => state.removeTagReferences);
  const applyAutoArchive = useSessionStore((state) => state.applyAutoArchive);
  const folders = useFolderStore((state) => state.folders);
  const updateFolder = useFolderStore((state) => state.updateFolder);
  const deleteFolder = useFolderStore((state) => state.deleteFolder);
  const createFolder = useFolderStore((state) => state.createFolder);
  const importFolders = useFolderStore((state) => state.importFolders);
  const tags = useTagStore((state) => state.tags);
  const updateTag = useTagStore((state) => state.updateTag);
  const deleteTag = useTagStore((state) => state.deleteTag);
  const createTag = useTagStore((state) => state.createTag);
  const importTags = useTagStore((state) => state.importTags);
  const schedules = useScheduleStore((state) => state.schedules);
  const importSchedules = useScheduleStore((state) => state.importSchedules);
  const standaloneNotes = useNotesStore((state) => state.standaloneNotes);
  const importNotes = useNotesStore((state) => state.importNotes);
  const shareLinks = useShareStore((state) => state.shareLinks);
  const clearShareLinks = useShareStore((state) => state.clearShareLinks);
  const importShareLinks = useShareStore((state) => state.importShareLinks);
  const syncAlarms = useScheduleStore((state) => state.syncAlarms);
  const syncEnabled = useSyncStore((state) => state.enabled);
  const syncEmail = useSyncStore((state) => state.email);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const syncError = useSyncStore((state) => state.syncError);
  const signOut = useSyncStore((state) => state.signOut);
  const syncNow = useSyncStore((state) => state.syncNow);
  const refreshSyncStatus = useSyncStore((state) => state.refreshStatus);

  const [storageQuota, setStorageQuota] = useState<StorageQuotaStatus | null>(null);
  const [folderModal, setFolderModal] = useState<{
    mode: "create" | "edit";
    folder?: Folder;
  } | null>(null);
  const [tagModal, setTagModal] = useState<{ mode: "create" | "edit"; tag?: Tag } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [historyPermissionGranted, setHistoryPermissionGranted] = useState(false);
  const [notificationsPermissionGranted, setNotificationsPermissionGranted] = useState(false);
  const [identityPermissionGranted, setIdentityPermissionGranted] = useState(false);
  const [tabGroupsPermissionGranted, setTabGroupsPermissionGranted] = useState(false);

  useEffect(() => {
    void checkStorageQuota().then(setStorageQuota);
  }, [
    sessions.length,
    folders.length,
    tags.length,
    schedules.length,
    standaloneNotes.length,
    shareLinks.length,
    settings,
  ]);

  useEffect(() => {
    void refreshSyncStatus();
  }, [refreshSyncStatus]);

  const refreshOptionalPermissions = useCallback(async () => {
    const [history, notifications, identity, tabGroups] = await Promise.all([
      hasOptionalPermission("history"),
      hasOptionalPermission("notifications"),
      hasOptionalPermission("identity"),
      hasOptionalPermission("tabGroups"),
    ]);
    setHistoryPermissionGranted(history);
    setNotificationsPermissionGranted(notifications);
    setIdentityPermissionGranted(identity);
    setTabGroupsPermissionGranted(tabGroups);
    if (!history && settings.browserHistorySearchEnabled) {
      updateSettings({
        browserHistorySearchEnabled: false,
        searchScopes: { ...settings.searchScopes, browserHistory: false },
      });
    }
  }, [settings.browserHistorySearchEnabled, settings.searchScopes, updateSettings]);

  useEffect(() => {
    void refreshOptionalPermissions();
  }, [refreshOptionalPermissions]);

  const enableBrowserHistorySearch = async () => {
    const granted = await requestOptionalPermission("history");
    setHistoryPermissionGranted(granted);
    updateSettings({
      browserHistorySearchEnabled: granted,
      searchScopes: { ...settings.searchScopes, browserHistory: granted },
    });
    addToast(
      granted ? "success" : "info",
      granted
        ? "Browser history search enabled."
        : "Browser history permission was not granted. TabSetu search is unchanged."
    );
  };

  const disableBrowserHistorySearch = async () => {
    await removeOptionalPermission("history");
    setHistoryPermissionGranted(false);
    updateSettings({
      browserHistorySearchEnabled: false,
      searchScopes: { ...settings.searchScopes, browserHistory: false },
    });
    addToast("success", "Browser history search disabled.");
  };

  const enableNotifications = async () => {
    const granted = await requestOptionalPermission("notifications");
    setNotificationsPermissionGranted(granted);
    addToast(
      granted ? "success" : "info",
      granted
        ? "Notification permission enabled."
        : "Notification permission was not granted. Core tab saving still works."
    );
  };

  const disableNotifications = async () => {
    await removeOptionalPermission("notifications");
    setNotificationsPermissionGranted(false);
    addToast("success", "Notification permission revoked.");
  };

  const toggleTabGroupMetadata = async () => {
    const enabled = tabGroupsPermissionGranted;
    const changed = enabled
      ? await removeOptionalPermission("tabGroups")
      : await requestOptionalPermission("tabGroups");
    const granted = enabled ? !changed : changed;
    setTabGroupsPermissionGranted(granted);
    addToast(
      granted ? "success" : "info",
      granted
        ? "Tab group names and colors will be preserved when the browser supports them."
        : enabled
          ? "Tab group metadata permission revoked."
          : "Tab group metadata permission was not granted. Group membership is still preserved."
    );
  };

  const disconnectGoogleDrive = async () => {
    await signOut();
    setIdentityPermissionGranted(false);
    addToast("success", "Google Drive sync disconnected.");
  };

  const handleExport = async () => {
    const data = await loadStorage();
    exportJSON(data);
    addToast("success", "Downloaded a full TabSetu backup.");
  };

  const handleReset = async () => {
    await clearAllData();
    await chrome.alarms.clearAll();
    await ensurePendingAutoSyncUploadAlarm();
    const data = await loadStorage();

    importSessions(data.sessions);
    importFolders(data.folders);
    importTags(data.tags);
    importSchedules(data.schedules);
    importNotes(data.standaloneNotes);
    importShareLinks(data.shareLinks);
    updateSettings(data.settings);
    addToast("success", "TabSetu has been reset to a clean state.");
  };

  const syncReminderAlarms = async (enabled: boolean) => {
    await reconcileReminderAlarms(sessions, enabled);
  };

  const storageUsagePercent = Math.min(100, (storageQuota?.percentage ?? 0) * 100);
  const storageUsageColor =
    storageUsagePercent >= 95
      ? "var(--color-danger)"
      : storageUsagePercent >= 80
        ? "var(--color-warning)"
        : "var(--color-success)";

  return (
    <section style={{ flex: 1, overflowY: "auto", padding: 28 }}>
      <div className="panel-shell">
        <div className="panel-header">
          <div>
            <h1>Settings</h1>
            <p>Shape how TabSetu saves, opens, searches, and manages your browsing workflows.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => void handleExport()}>
            <Download size={16} />
            Export backup
          </button>
        </div>

        <div className="settings-grid">
          <div className="card settings-card">
            <h3>Preferences</h3>
            <div className="form-stack" style={{ marginTop: 18 }}>
              <div>
                <label className="label">Theme</label>
                <select
                  className="input"
                  value={settings.theme}
                  onChange={(event) =>
                    updateSettings({
                      theme: event.target.value as typeof settings.theme,
                    })
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="label">Dashboard layout</label>
                <select
                  className="input"
                  value={settings.dashboardLayout}
                  onChange={(event) =>
                    updateSettings({
                      dashboardLayout: event.target.value as typeof settings.dashboardLayout,
                    })
                  }
                >
                  <option value="split">Sidebar - Main - Detail</option>
                  <option value="focus">Sidebar - Main</option>
                </select>
              </div>

              <div>
                <label className="label">Session card style</label>
                <select
                  className="input"
                  value={settings.sessionCardStyle}
                  onChange={(event) =>
                    updateSettings({
                      sessionCardStyle: event.target.value as typeof settings.sessionCardStyle,
                    })
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="grid">Grid</option>
                </select>
              </div>

              <ToggleRow
                label="Include pinned tabs when collapsing"
                description="Leave this off to preserve pinned anchors when you clear a window."
                checked={settings.collapseIncludesPinned}
                onChange={(checked) => updateSettings({ collapseIncludesPinned: checked })}
              />
              <ToggleRow
                label="Open sessions in new windows"
                description="Turn this on when you want each workflow reopened in its own browser window."
                checked={settings.openInNewWindow}
                onChange={(checked) => updateSettings({ openInNewWindow: checked })}
              />
              <ToggleRow
                label="Confirm before deleting"
                description="Prevents accidental removal of sessions, folders, and tags."
                checked={settings.confirmBeforeDelete}
                onChange={(checked) => updateSettings({ confirmBeforeDelete: checked })}
              />
              <ToggleRow
                label="Enable schedules"
                description="Allow saved sessions to reopen on their configured schedule."
                checked={settings.schedulesEnabled}
                onChange={(checked) => {
                  updateSettings({ schedulesEnabled: checked });
                  void syncAlarms(checked);
                }}
              />
              <ToggleRow
                label="Enable tab reminders"
                description="Use Chrome alarms and notifications for per-tab follow-ups."
                checked={settings.remindersEnabled}
                onChange={(checked) => {
                  updateSettings({ remindersEnabled: checked });
                  void syncReminderAlarms(checked);
                }}
              />
              <ToggleRow
                label="Enable global search overlay"
                description="Use the extension shortcut to search TabSetu from regular web pages."
                checked={settings.searchOverlayEnabled}
                onChange={(checked) => updateSettings({ searchOverlayEnabled: checked })}
              />
              <ToggleRow
                label="Enable quick info cards"
                description="Show rich context when hovering saved tab chips."
                checked={settings.quickInfoEnabled}
                onChange={(checked) => updateSettings({ quickInfoEnabled: checked })}
              />
              <ToggleRow
                label="Enable AI prompt sharing"
                description="Generate and copy prompts from selected saved sessions. Providers open only when you request it."
                checked={settings.aiEnabled}
                onChange={(checked) => updateSettings({ aiEnabled: checked })}
              />
              <ToggleRow
                label="Include notes in exports"
                description="Applies to AI prompts and share flows by default."
                checked={settings.exportIncludeNotes}
                onChange={(checked) => updateSettings({ exportIncludeNotes: checked })}
              />
            </div>
          </div>

          <div className="card settings-card">
            <h3>Search and automation</h3>
            <div className="form-stack" style={{ marginTop: 18 }}>
              <div>
                <label className="label">Search scope</label>
                <div className="form-stack">
                  <ToggleRow
                    label="Search sessions"
                    description="Include session names and descriptions."
                    checked={settings.searchScopes.sessions}
                    onChange={(checked) =>
                      updateSettings({
                        searchScopes: { ...settings.searchScopes, sessions: checked },
                      })
                    }
                  />
                  <ToggleRow
                    label="Search tabs"
                    description="Match saved tab titles and URLs."
                    checked={settings.searchScopes.tabs}
                    onChange={(checked) =>
                      updateSettings({
                        searchScopes: { ...settings.searchScopes, tabs: checked },
                      })
                    }
                  />
                  <ToggleRow
                    label="Search notes"
                    description="Include session notes and tab notes."
                    checked={settings.searchScopes.notes}
                    onChange={(checked) =>
                      updateSettings({
                        searchScopes: { ...settings.searchScopes, notes: checked },
                      })
                    }
                  />
                  <ToggleRow
                    label="Search tags"
                    description="Match tag names attached to sessions."
                    checked={settings.searchScopes.tags}
                    onChange={(checked) =>
                      updateSettings({
                        searchScopes: { ...settings.searchScopes, tags: checked },
                      })
                    }
                  />
                  <ToggleRow
                    label="Search folders"
                    description="Match folder names linked to sessions."
                    checked={settings.searchScopes.folders}
                    onChange={(checked) =>
                      updateSettings({
                        searchScopes: { ...settings.searchScopes, folders: checked },
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  Fuzzy search sensitivity ({settings.fuzzySearchThreshold.toFixed(2)})
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.02"
                  value={settings.fuzzySearchThreshold}
                  onChange={(event) =>
                    updateSettings({
                      fuzzySearchThreshold: Number(event.target.value),
                    })
                  }
                  style={{ width: "100%" }}
                />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
                  Lower values are stricter. Higher values are more forgiving.
                </div>
              </div>

              <div>
                <label className="label">Quick info delay</label>
                <select
                  className="input"
                  value={settings.quickInfoDelayMs}
                  onChange={(event) =>
                    updateSettings({
                      quickInfoDelayMs: Number(
                        event.target.value
                      ) as typeof settings.quickInfoDelayMs,
                    })
                  }
                >
                  <option value="200">Fast - 200ms</option>
                  <option value="400">Balanced - 400ms</option>
                  <option value="700">Relaxed - 700ms</option>
                </select>
              </div>

              <div>
                <label className="label">Custom AI provider URL</label>
                <input
                  className="input"
                  value={settings.customAIProviderUrl}
                  maxLength={2048}
                  onChange={(event) => updateSettings({ customAIProviderUrl: event.target.value })}
                  placeholder="https://example.com/new"
                />
                {settings.customAIProviderUrl &&
                !normalizeCustomAIProviderUrl(settings.customAIProviderUrl) ? (
                  <div style={{ fontSize: 12, color: "var(--color-warning)", marginTop: 6 }}>
                    Use a valid HTTPS URL. TabSetu will not open an invalid custom provider.
                  </div>
                ) : null}
              </div>

              <div>
                <label className="label">Custom AI prompt template</label>
                <textarea
                  className="input"
                  value={settings.customAIPromptTemplate}
                  maxLength={4000}
                  onChange={(event) =>
                    updateSettings({ customAIPromptTemplate: event.target.value })
                  }
                  placeholder={"Use {{session}} to insert TabSetu's generated session prompt."}
                />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
                  Leave this blank to use the default TabSetu prompt. If you add text here, include{" "}
                  <code>{"{{session}}"}</code> where the session context should appear.
                </div>
              </div>

              <div>
                <label className="label">Auto-archive inactive sessions</label>
                <select
                  className="input"
                  value={settings.autoArchiveDays ?? ""}
                  onChange={(event) => {
                    const value = event.target.value
                      ? (Number(event.target.value) as 30 | 60 | 90)
                      : null;
                    updateSettings({ autoArchiveDays: value });
                    applyAutoArchive(value);
                  }}
                >
                  <option value="">Off</option>
                  <option value="30">After 30 days</option>
                  <option value="60">After 60 days</option>
                  <option value="90">After 90 days</option>
                </select>
              </div>

              <div>
                <label className="label">Storage usage</label>
                <div className="card-raised" style={{ padding: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <strong>{formatBytes(storageQuota?.used ?? 0)} used</strong>
                    <span
                      style={{
                        color:
                          storageUsagePercent >= 60 ? storageUsageColor : "var(--color-text-muted)",
                      }}
                    >
                      of {formatBytes(storageQuota?.total ?? 10_485_760)}
                    </span>
                  </div>
                  <div className="storage-bar">
                    <div
                      className="storage-bar-fill"
                      style={{ width: `${storageUsagePercent}%`, background: storageUsageColor }}
                    />
                  </div>
                  {storageUsagePercent >= 80 ? (
                    <p style={{ color: storageUsageColor, fontSize: 12, margin: "10px 0 0" }}>
                      Approaching storage limit. Consider exporting and clearing old sessions.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card settings-card" style={{ marginTop: 22 }}>
          <h3>Privacy &amp; permissions</h3>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>
            Core tab saving works without optional browser history, notifications, Google Drive, or
            AI prompt sharing.
          </p>
          <div className="form-stack" style={{ marginTop: 18 }}>
            <div className="card-raised" style={{ padding: 14 }}>
              <strong>Core permissions currently used</strong>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
                Tabs and storage save your library. Alarms support schedules and reminders.
                Scripting with active-tab access opens the search overlay only after your command.
                Context menus add explicit save actions.
              </p>
            </div>

            <div className="card-raised" style={{ padding: 14 }}>
              <strong>Optional browser history search</strong>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
                Off by default. TabSetu does not read browser history unless you enable this
                feature. When enabled, TabSetu uses browser history only to show matching results in
                the local search overlay. TabSetu does not upload browser history to a TabSetu
                server. You can revoke the permission and disable the feature any time.
              </p>
              <p style={{ fontSize: 12, margin: "10px 0 0" }}>
                Status:{" "}
                <strong>
                  {settings.browserHistorySearchEnabled && historyPermissionGranted
                    ? "Enabled"
                    : "Off"}
                </strong>
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {settings.browserHistorySearchEnabled && historyPermissionGranted ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => void disableBrowserHistorySearch()}
                  >
                    Disable browser history search
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => void enableBrowserHistorySearch()}
                  >
                    Enable browser history search
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void refreshOptionalPermissions()}
                >
                  Check permission
                </button>
              </div>
            </div>

            <div className="card-raised" style={{ padding: 14 }}>
              <strong>Optional tab group metadata</strong>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
                Group membership is saved automatically. On Chromium browsers, this optional
                permission also preserves group names, colors, and collapsed state.
              </p>
              <p style={{ fontSize: 12, margin: "10px 0 0" }}>
                Status: <strong>{tabGroupsPermissionGranted ? "Enabled" : "Off"}</strong>
              </p>
              <button
                className="btn btn-secondary"
                type="button"
                style={{ marginTop: 12 }}
                onClick={() => void toggleTabGroupMetadata()}
              >
                {tabGroupsPermissionGranted
                  ? "Revoke tab group metadata"
                  : "Preserve group metadata"}
              </button>
            </div>

            <div className="card-raised" style={{ padding: 14 }}>
              <strong>Optional notifications</strong>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
                Notifications show reminder, schedule, and capture notices. Saving sessions still
                works when notifications are off.
              </p>
              <p style={{ fontSize: 12, margin: "10px 0 0" }}>
                Status: <strong>{notificationsPermissionGranted ? "Enabled" : "Off"}</strong>
              </p>
              <button
                className="btn btn-secondary"
                type="button"
                style={{ marginTop: 12 }}
                onClick={() =>
                  void (notificationsPermissionGranted
                    ? disableNotifications()
                    : enableNotifications())
                }
              >
                {notificationsPermissionGranted ? "Revoke notifications" : "Enable notifications"}
              </button>
            </div>

            <div className="card-raised" style={{ padding: 14 }}>
              <strong>Optional Google Drive sync</strong>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
                Google Drive sync is off until you connect it. It uses your Drive app data folder
                and does not depend on a TabSetu backend.
              </p>
              <p style={{ fontSize: 12, margin: "10px 0 0" }}>
                Status:{" "}
                <strong>
                  {syncEnabled
                    ? `Connected${syncEmail ? ` as ${syncEmail}` : ""}`
                    : identityPermissionGranted
                      ? "Permission granted, not connected"
                      : "Off"}
                </strong>
              </p>
              {syncEnabled || identityPermissionGranted ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => void disconnectGoogleDrive()}
                >
                  Disconnect Google Drive
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card settings-card" style={{ marginTop: 22 }}>
          <h3>Library management</h3>
          <div className="management-list" style={{ marginTop: 18 }}>
            <div>
              <div className="management-header">
                <strong>Folders</strong>
                <button
                  className="btn btn-secondary"
                  onClick={() => setFolderModal({ mode: "create" })}
                >
                  Add folder
                </button>
              </div>
              <div className="management-items">
                {folders.map((folder) => (
                  <div key={folder.id} className="management-item">
                    <div>
                      <strong>{folder.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                        {
                          sessions.filter(
                            (session) => session.folderId === folder.id && !session.isArchived
                          ).length
                        }{" "}
                        active sessions
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setFolderModal({ mode: "edit", folder })}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ color: "var(--color-danger)" }}
                        onClick={() => setFolderToDelete(folder)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <div className="management-header">
                <strong>Tags</strong>
                <button
                  className="btn btn-secondary"
                  onClick={() => setTagModal({ mode: "create" })}
                >
                  Add tag
                </button>
              </div>
              <div className="management-items">
                {tags.map((tag) => (
                  <div key={tag.id} className="management-item">
                    <div>
                      <strong>{tag.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                        {
                          sessions.filter(
                            (session) => session.tagIds.includes(tag.id) && !session.isArchived
                          ).length
                        }{" "}
                        active sessions
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setTagModal({ mode: "edit", tag })}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ color: "var(--color-danger)" }}
                        onClick={() => setTagToDelete(tag)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card settings-card sync-settings-card">
          {syncEnabled ? (
            <>
              <div className="sync-card-header">
                <span className="sync-icon sync-icon-success">
                  <CheckCircle2 size={20} />
                </span>
                <div className="sync-copy">
                  <h3>Synced as {syncEmail ?? "Google account"}</h3>
                  <p>Last synced: {formatRelativeTime(lastSyncedAt)}</p>
                  <p className="sync-helper">
                    Session data, folders, tags, and notes sync via Google Drive. Browser theme is
                    kept per device.
                  </p>
                </div>
              </div>
              <div className="sync-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void syncNow()}
                >
                  {isSyncing ? <Loader2 className="sync-spinner" size={15} /> : <Cloud size={15} />}
                  {isSyncing ? "Syncing..." : "Sync now"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void disconnectGoogleDrive()}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <SyncGate compact embedded />
          )}
          {syncEnabled && syncError ? <p className="sync-error">{syncError}</p> : null}
        </div>

        <div className="card settings-card" style={{ marginTop: 22 }}>
          <h3>Danger zone</h3>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>
            Use this only when you want to start from scratch or recover from a messy state.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn-secondary" onClick={() => void handleExport()}>
              <RotateCcw size={15} />
              Export first
            </button>
            <button className="btn btn-danger" onClick={() => setShowResetConfirm(true)}>
              <Trash2 size={15} />
              Clear everything
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 14 }}>
            Current footprint: {sessions.length} sessions, {folders.length} folders, {tags.length}{" "}
            tags, {schedules.length} schedules, {standaloneNotes.length} notes, {shareLinks.length}{" "}
            share links.
          </div>
          {shareLinks.length > 0 ? (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => {
                clearShareLinks();
                addToast("success", "Cleared local share-link records.");
              }}
            >
              Clear share-link records
            </button>
          ) : null}
        </div>
      </div>

      {folderModal ? (
        <EntityEditorModal
          mode="folder"
          title={folderModal.mode === "create" ? "Create folder" : "Edit folder"}
          submitLabel={folderModal.mode === "create" ? "Create folder" : "Save folder"}
          initialValue={folderModal.folder}
          onClose={() => setFolderModal(null)}
          onSubmit={({ name, color, icon }) => {
            if (folderModal.mode === "create") {
              createFolder(name, color, icon);
              addToast("success", `Created folder "${name}".`);
            } else if (folderModal.folder) {
              updateFolder(folderModal.folder.id, { name, color, icon });
              addToast("success", `Updated folder "${name}".`);
            }
            setFolderModal(null);
          }}
        />
      ) : null}

      {tagModal ? (
        <EntityEditorModal
          mode="tag"
          title={tagModal.mode === "create" ? "Create tag" : "Edit tag"}
          submitLabel={tagModal.mode === "create" ? "Create tag" : "Save tag"}
          initialValue={tagModal.tag}
          onClose={() => setTagModal(null)}
          onSubmit={({ name, color }) => {
            if (tagModal.mode === "create") {
              createTag(name, color);
              addToast("success", `Created tag "${name}".`);
            } else if (tagModal.tag) {
              updateTag(tagModal.tag.id, { name, color });
              addToast("success", `Updated tag "${name}".`);
            }
            setTagModal(null);
          }}
        />
      ) : null}

      {folderToDelete ? (
        <ConfirmDialog
          title="Delete folder?"
          message={`Sessions in "${folderToDelete.name}" will keep their tabs, but the folder assignment will be removed.`}
          confirmLabel="Delete folder"
          danger
          onClose={() => setFolderToDelete(null)}
          onConfirm={() => {
            unassignFolder(folderToDelete.id);
            deleteFolder(folderToDelete.id);
            addToast("success", `Deleted folder "${folderToDelete.name}".`);
            setFolderToDelete(null);
          }}
        />
      ) : null}

      {tagToDelete ? (
        <ConfirmDialog
          title="Delete tag?"
          message={`"${tagToDelete.name}" will be removed from all tagged sessions.`}
          confirmLabel="Delete tag"
          danger
          onClose={() => setTagToDelete(null)}
          onConfirm={() => {
            removeTagReferences(tagToDelete.id);
            deleteTag(tagToDelete.id);
            addToast("success", `Deleted tag "${tagToDelete.name}".`);
            setTagToDelete(null);
          }}
        />
      ) : null}

      {showResetConfirm ? (
        <ConfirmDialog
          title="Clear all data?"
          message="This resets sessions, folders, tags, schedules, and settings back to defaults."
          confirmLabel="Clear everything"
          danger
          onClose={() => setShowResetConfirm(false)}
          onConfirm={() => {
            void handleReset();
            setShowResetConfirm(false);
          }}
        />
      ) : null}
    </section>
  );
}
