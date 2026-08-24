import { useMemo, useState } from "react";
import { Download, FileUp, Link2, Sparkles } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";
import type { StorageData, ToastMessage } from "@/types";
import {
  copyLinksToClipboard,
  downloadMarkdown,
  downloadPlainText,
  exportJSON,
  generateAIPrompt,
  importFile,
  mergeStorageData,
  summarizeStorageData,
} from "@/lib/exportImport";
import { copyTextToClipboard } from "@/lib/sessionBrowser";
import {
  hideDeletedStorageData,
  loadStorage,
  prepareStorageReplacement,
  saveStorageData,
} from "@/lib/storage";
import { reconcileReminderAlarms } from "@/lib/reminderAlarms";
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

interface PendingImport {
  fileName: string;
  data: StorageData;
  mode: "merge" | "replace";
}

export default function ImportExportPanel({ addToast }: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const importSessions = useSessionStore((state) => state.importSessions);
  const folders = useFolderStore((state) => state.folders);
  const importFolders = useFolderStore((state) => state.importFolders);
  const tags = useTagStore((state) => state.tags);
  const importTags = useTagStore((state) => state.importTags);
  const schedules = useScheduleStore((state) => state.schedules);
  const importSchedules = useScheduleStore((state) => state.importSchedules);
  const standaloneNotes = useNotesStore((state) => state.standaloneNotes);
  const importNotes = useNotesStore((state) => state.importNotes);
  const shareLinks = useShareStore((state) => state.shareLinks);
  const importShareLinks = useShareStore((state) => state.importShareLinks);
  const syncAlarms = useScheduleStore((state) => state.syncAlarms);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  const currentData = useMemo<StorageData>(
    () => ({
      sessions,
      folders,
      tags,
      schedules,
      standaloneNotes,
      shareLinks,
      aiConfig: {
        updatedAt: settings.updatedAt,
        defaultProvider: settings.defaultAIProvider,
        customProviderUrl: settings.customAIProviderUrl,
        customPromptTemplate: settings.customAIPromptTemplate,
        includeUrls: true,
        includeTitles: true,
        includeNotes: settings.exportIncludeNotes,
        promptPreamble: "",
      },
      settings,
    }),
    [folders, schedules, sessions, settings, shareLinks, standaloneNotes, tags]
  );

  const currentSummary = useMemo(() => summarizeStorageData(currentData), [currentData]);
  const incomingSummary = useMemo(
    () => (pendingImport ? summarizeStorageData(pendingImport.data) : null),
    [pendingImport]
  );
  const resultData = useMemo(() => {
    if (!pendingImport) {
      return null;
    }

    return pendingImport.mode === "replace"
      ? pendingImport.data
      : mergeStorageData(currentData, pendingImport.data);
  }, [currentData, pendingImport]);
  const resultSummary = useMemo(
    () => (resultData ? summarizeStorageData(resultData) : null),
    [resultData]
  );

  const handleExportAll = async () => {
    const data = await loadStorage();
    exportJSON(data);
    addToast("success", "Exported your full TabSetu library.");
  };

  const handleImport = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imported = await importFile(file);
      setPendingImport({
        fileName: file.name,
        data: imported,
        mode: "merge",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      addToast("error", message);
    }
  };

  const applyImport = async () => {
    if (!pendingImport || !resultData) {
      return;
    }

    setIsApplyingImport(true);

    try {
      const latestData = await loadStorage({ includeDeleted: true });
      const dataToSave =
        pendingImport.mode === "replace"
          ? prepareStorageReplacement(latestData, pendingImport.data)
          : mergeStorageData(latestData, pendingImport.data);
      const visibleData = hideDeletedStorageData(dataToSave);

      await saveStorageData(dataToSave);
      importSessions(visibleData.sessions);
      importFolders(visibleData.folders);
      importTags(visibleData.tags);
      importSchedules(visibleData.schedules);
      importNotes(visibleData.standaloneNotes);
      importShareLinks(visibleData.shareLinks);
      updateSettings(visibleData.settings);
      await syncAlarms(visibleData.settings.schedulesEnabled);
      await reconcileReminderAlarms(visibleData.sessions, visibleData.settings.remindersEnabled);
      addToast(
        "success",
        pendingImport.mode === "replace"
          ? "Replaced your TabSetu library from the backup."
          : "Merged the backup into your TabSetu library."
      );
      setPendingImport(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      addToast("error", message);
    } finally {
      setIsApplyingImport(false);
    }
  };

  return (
    <section style={{ flex: 1, overflowY: "auto", padding: 28 }}>
      <div className="panel-shell">
        <div className="panel-header">
          <div>
            <h1>Import and export</h1>
            <p>
              Back up the full library, move it between machines, or export individual sessions for
              sharing.
            </p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="card settings-card">
            <h3>Full backup</h3>
            <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>
              JSON exports include sessions, folders, tags, notes, schedules, and settings. Imports
              also accept OneTab text, OneTab HTML, and Session Buddy exports.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => void handleExportAll()}>
                <Download size={16} />
                Export JSON
              </button>
              <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                <FileUp size={16} />
                Import file
                <input
                  type="file"
                  accept=".json,.txt,.html,.htm,application/json,text/plain,text/html"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleImport(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="card settings-card">
            <h3>What gets restored</h3>
            <ul className="plain-list" style={{ marginTop: 14 }}>
              <li>Saved sessions, descriptions, and notes</li>
              <li>Folders, tags, and session assignments</li>
              <li>Schedules and their enabled state</li>
              <li>Theme and behavioral preferences</li>
            </ul>
          </div>
        </div>

        <div className="card settings-card" style={{ marginTop: 22 }}>
          <div className="panel-header" style={{ marginBottom: 18 }}>
            <div>
              <h3>Session exports</h3>
              <p style={{ margin: "8px 0 0", color: "var(--color-text-secondary)" }}>
                Share a clean list of links, ship a markdown handoff, or prep an AI summary prompt.
              </p>
            </div>
          </div>

          <div className="management-items">
            {sessions.map((session) => (
              <div key={session.id} className="management-item">
                <div>
                  <strong>{session.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                    {session.tabs.length} tabs
                  </div>
                </div>
                <div
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}
                >
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      downloadMarkdown(session, { includeNotes: settings.exportIncludeNotes })
                    }
                  >
                    <Link2 size={14} />
                    Markdown
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      downloadPlainText(session, { includeNotes: settings.exportIncludeNotes })
                    }
                  >
                    Text
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      await copyTextToClipboard(copyLinksToClipboard(session));
                      addToast("success", `Copied links from "${session.name}".`);
                    }}
                  >
                    Copy links
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={!settings.aiEnabled}
                    onClick={async () => {
                      await copyTextToClipboard(
                        generateAIPrompt(session, { includeNotes: settings.exportIncludeNotes })
                      );
                      addToast("success", `Copied the AI prompt for "${session.name}".`);
                    }}
                  >
                    <Sparkles size={14} />
                    AI prompt
                  </button>
                </div>
              </div>
            ))}
            {sessions.length === 0 ? (
              <div className="detail-empty">There are no sessions to export yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      {pendingImport && incomingSummary && resultSummary ? (
        <ModalShell
          title="Review import"
          description={`"${pendingImport.fileName}" was parsed successfully. Choose how TabSetu should apply it.`}
          onClose={() => {
            if (!isApplyingImport) {
              setPendingImport(null);
            }
          }}
          maxWidth={560}
          footer={
            <>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setPendingImport(null)}
                disabled={isApplyingImport}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1.25 }}
                onClick={() => void applyImport()}
                disabled={isApplyingImport}
              >
                {pendingImport.mode === "replace" ? "Replace library" : "Merge backup"}
              </button>
            </>
          }
        >
          <div className="form-stack">
            <div className="card-raised" style={{ padding: 16 }}>
              <strong>Backup contents</strong>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.sessions}</strong>
                  <div>Sessions</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.tabs}</strong>
                  <div>Tabs</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.folders}</strong>
                  <div>Folders</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.tags}</strong>
                  <div>Tags</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.schedules}</strong>
                  <div>Schedules</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.notes}</strong>
                  <div>Notes</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{incomingSummary.shareLinks}</strong>
                  <div>Links</div>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Import mode</label>
              <div className="form-stack">
                <label className="toggle-row" style={{ alignItems: "flex-start", gap: 14 }}>
                  <span>
                    <strong style={{ display: "block", marginBottom: 4 }}>
                      Merge with current library
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      Sessions, folders, tags, and schedules are merged by ID, with the newer record
                      winning when duplicates exist. Current settings stay as they are.
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={pendingImport.mode === "merge"}
                    onChange={() =>
                      setPendingImport((current) =>
                        current ? { ...current, mode: "merge" } : current
                      )
                    }
                  />
                </label>
                <label className="toggle-row" style={{ alignItems: "flex-start", gap: 14 }}>
                  <span>
                    <strong style={{ display: "block", marginBottom: 4 }}>
                      Replace everything
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      Overwrites sessions, folders, tags, schedules, and settings with the backup
                      exactly as imported.
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={pendingImport.mode === "replace"}
                    onChange={() =>
                      setPendingImport((current) =>
                        current ? { ...current, mode: "replace" } : current
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="card-raised" style={{ padding: 16 }}>
              <strong>Library after import</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
                Current library: {currentSummary.sessions} sessions, {currentSummary.tabs} tabs,{" "}
                {currentSummary.folders} folders, {currentSummary.tags} tags,{" "}
                {currentSummary.schedules} schedules, {currentSummary.notes} notes.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.sessions}</strong>
                  <div>Sessions</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.tabs}</strong>
                  <div>Tabs</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.folders}</strong>
                  <div>Folders</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.tags}</strong>
                  <div>Tags</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.schedules}</strong>
                  <div>Schedules</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.notes}</strong>
                  <div>Notes</div>
                </div>
                <div className="detail-empty" style={{ padding: 10 }}>
                  <strong>{resultSummary.shareLinks}</strong>
                  <div>Links</div>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
}
