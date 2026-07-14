import { useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { exportJSON } from "@/lib/exportImport";
import { clearAllData, loadStorage } from "@/lib/storage";

interface Props {
  error: Error;
  compact?: boolean;
}

export default function RecoveryScreen({ error, compact = false }: Props) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const downloadBackup = async () => {
    try {
      exportJSON(await loadStorage({ includeDeleted: true }));
      setRecoveryError(null);
    } catch {
      setRecoveryError("A recovery backup could not be created from the current storage state.");
    }
  };

  const clearAndReload = async () => {
    try {
      await clearAllData();
      window.location.reload();
    } catch {
      setRecoveryError("TabSetu could not clear extension storage. Reload and try again.");
      setShowClearConfirm(false);
    }
  };

  const content = (
    <div className="empty-state" style={{ margin: compact ? 16 : 24 }}>
      <h3>TabSetu could not load your library</h3>
      <p>{error.message}</p>
      {recoveryError ? <p role="alert">{recoveryError}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => void downloadBackup()}>
          Download recovery backup
        </button>
        <button className="btn btn-danger" type="button" onClick={() => setShowClearConfirm(true)}>
          Clear local data…
        </button>
      </div>
      {showClearConfirm ? (
        <ConfirmDialog
          title="Clear all TabSetu data?"
          message="Only continue after trying Reload and downloading a recovery backup. This permanently removes sessions, notes, reminders, schedules, and settings from this browser."
          confirmLabel="Permanently clear data"
          danger
          onClose={() => setShowClearConfirm(false)}
          onConfirm={() => void clearAndReload()}
        />
      ) : null}
    </div>
  );

  return compact ? (
    <div className="mobile-frame mobile-popup-frame">{content}</div>
  ) : (
    <div className="mobile-dashboard-stage">{content}</div>
  );
}
