import { useEffect, useState } from "react";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import type { Folder, Tag, ToastMessage } from "@/types";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EntityEditorModal from "@/components/shared/EntityEditorModal";
import { exportJSON } from "@/lib/exportImport";
import { clearAllData, loadStorage } from "@/lib/storage";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";

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
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{description}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;

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
  const importShareLinks = useShareStore((state) => state.importShareLinks);
  const syncAlarms = useScheduleStore((state) => state.syncAlarms);

  const [storageBytes, setStorageBytes] = useState(0);
  const [folderModal, setFolderModal] = useState<{ mode: "create" | "edit"; folder?: Folder } | null>(null);
  const [tagModal, setTagModal] = useState<{ mode: "create" | "edit"; tag?: Tag } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      setStorageBytes(bytes);
    });
  }, [sessions.length, folders.length, tags.length, schedules.length, standaloneNotes.length, shareLinks.length, settings]);

  const handleExport = async () => {
    const data = await loadStorage();
    exportJSON(data);
    addToast("success", "Downloaded a full TabSetu backup.");
  };

  const handleReset = async () => {
    await clearAllData();
    await chrome.alarms.clearAll();
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
    const alarms = await chrome.alarms.getAll();
    await Promise.all(
      alarms
        .filter((alarm) => alarm.name.startsWith("reminder_"))
        .map((alarm) => chrome.alarms.clear(alarm.name)),
    );

    if (!enabled) {
      return;
    }

    sessions.forEach((session) => {
      session.tabs.forEach((tab) => {
        const dueAt = tab.reminderSnoozedUntil ?? tab.reminderAt;
        if (!dueAt || tab.reminderDismissed) {
          return;
        }

        chrome.alarms.create(`reminder_${tab.id}`, {
          when: Math.max(dueAt, Date.now() + 1000),
        });
      });
    });
  };

  const storageUsageMb = storageBytes / (1024 * 1024);
  const storageUsagePercent = Math.min(100, (storageBytes / STORAGE_LIMIT_BYTES) * 100);

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
                label="Enable AI sharing"
                description="Copy prompts and open the AI provider only when you request it."
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
                      quickInfoDelayMs: Number(event.target.value) as typeof settings.quickInfoDelayMs,
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
                  onChange={(event) => updateSettings({ customAIProviderUrl: event.target.value })}
                  placeholder="https://example.com/new"
                />
              </div>

              <div>
                <label className="label">Custom AI prompt template</label>
                <textarea
                  className="input"
                  value={settings.customAIPromptTemplate}
                  onChange={(event) => updateSettings({ customAIPromptTemplate: event.target.value })}
                  placeholder={"Use {{session}} to insert TabSetu's generated session prompt."}
                />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
                  Leave this blank to use the default TabSetu prompt. If you add text here, include
                  {" "}
                  <code>{"{{session}}"}</code>
                  {" "}
                  where the session context should appear.
                </div>
              </div>

              <div>
                <label className="label">Auto-archive inactive sessions</label>
                <select
                  className="input"
                  value={settings.autoArchiveDays ?? ""}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) as 30 | 60 | 90 : null;
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <strong>{storageUsageMb.toFixed(2)} MB used</strong>
                    <span style={{ color: storageUsagePercent >= 80 ? "var(--color-warning)" : "var(--color-text-muted)" }}>
                      of 10 MB
                    </span>
                  </div>
                  <div className="storage-bar">
                    <div className="storage-bar-fill" style={{ width: `${storageUsagePercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card settings-card" style={{ marginTop: 22 }}>
          <h3>Library management</h3>
          <div className="management-list" style={{ marginTop: 18 }}>
            <div>
              <div className="management-header">
                <strong>Folders</strong>
                <button className="btn btn-secondary" onClick={() => setFolderModal({ mode: "create" })}>
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
                            (session) => session.folderId === folder.id && !session.isArchived,
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
                <button className="btn btn-secondary" onClick={() => setTagModal({ mode: "create" })}>
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
                            (session) => session.tagIds.includes(tag.id) && !session.isArchived,
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
            Current footprint: {sessions.length} sessions, {folders.length} folders, {tags.length} tags,{" "}
            {schedules.length} schedules, {standaloneNotes.length} notes, {shareLinks.length} share links.
          </div>
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
