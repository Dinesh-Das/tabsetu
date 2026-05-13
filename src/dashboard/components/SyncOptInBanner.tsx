import { useEffect, useState } from "react";
import { Cloud, Settings, X } from "lucide-react";
import { useSyncStore } from "@/store/syncStore";

const DISMISSED_KEY = "tabsetu.syncOptInBanner.dismissed";
const EVER_CONNECTED_KEY = "tabsetu.syncOptInBanner.everConnected";

interface Props {
  onOpenSettings: () => void;
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export default function SyncOptInBanner({ onOpenSettings }: Props) {
  const syncEnabled = useSyncStore((state) => state.enabled);
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISSED_KEY));
  const [everConnected, setEverConnected] = useState(() => readFlag(EVER_CONNECTED_KEY));

  useEffect(() => {
    if (syncEnabled) {
      setEverConnected(true);
      try {
        window.localStorage.setItem(EVER_CONNECTED_KEY, "true");
      } catch {
        // This hint is only used to avoid repeat nudges.
      }
    }
  }, [syncEnabled]);

  if (syncEnabled || dismissed || everConnected) {
    return null;
  }

  return (
    <div className="sync-opt-in-banner" role="status">
      <Cloud size={16} />
      <span>Sync across devices — connect Google Drive in Settings.</span>
      <button className="btn btn-secondary" type="button" onClick={onOpenSettings}>
        <Settings size={14} />
        Settings
      </button>
      <button
        className="btn btn-ghost btn-icon"
        type="button"
        title="Dismiss sync reminder"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(DISMISSED_KEY, "true");
          } catch {
            // Dismissal is best effort when localStorage is unavailable.
          }
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
