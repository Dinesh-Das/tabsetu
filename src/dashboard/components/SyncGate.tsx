import { CheckCircle2, Cloud, Loader2, ShieldCheck } from "lucide-react";
import { useSyncStore } from "@/store/syncStore";

interface Props {
  compact?: boolean;
  embedded?: boolean;
  buttonLabel?: string;
  busyLabel?: string;
  onContinue?: () => void | Promise<void>;
}

export default function SyncGate({
  compact = false,
  embedded = false,
  buttonLabel = "Connect Google Drive",
  busyLabel = "Connecting...",
  onContinue,
}: Props) {
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const syncError = useSyncStore((state) => state.syncError);
  const signIn = useSyncStore((state) => state.signIn);
  const handleContinue = onContinue ?? signIn;

  return (
    <section
      className={[
        "sync-gate",
        compact ? "sync-gate-compact" : "",
        embedded ? "sync-gate-embedded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={embedded ? "sync-gate-panel" : "sync-gate-panel card"}>
        <div className="sync-gate-mark">
          <Cloud size={30} />
        </div>
        <div className="sync-gate-copy">
          <p className="sync-gate-kicker">Google Drive sync optional</p>
          <h1>Connect Google Drive Sync</h1>
          <p>
            TabSetu can keep your sessions in your own Google Drive app data folder so your browsing
            workspace follows you across browsers and devices.
          </p>
        </div>
        <div className="sync-gate-benefits">
          <span>
            <ShieldCheck size={16} />
            No TabSetu backend
          </span>
          <span>
            <CheckCircle2 size={16} />
            Hidden Drive app data
          </span>
          <span>
            <CheckCircle2 size={16} />
            Sessions stay under your Google account
          </span>
        </div>
        <button
          className="btn btn-primary sync-gate-button"
          type="button"
          disabled={isSyncing}
          onClick={() => void handleContinue()}
        >
          {isSyncing ? <Loader2 className="sync-spinner" size={16} /> : <Cloud size={16} />}
          {isSyncing ? busyLabel : buttonLabel}
        </button>
        {syncError ? <p className="sync-error">{syncError}</p> : null}
      </div>
    </section>
  );
}
