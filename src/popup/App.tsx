import React, { type ReactNode, useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import {
  MobileAppShell,
  MobileFrame,
  MobileIconButton,
  MobileTopBar,
  type MobileNavView,
} from "@/components/mobile/MobileUI";
import ThemeToggle from "@/components/shared/ThemeToggle";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { Session, ToastMessage, UndoCollapseBuffer } from "@/types";
import {
  clearAllData,
  COLLAPSE_UNDO_MS,
  loadStorageWithUndoBuffer,
  saveUndoBuffer,
} from "@/lib/storage";
import { seedFavicons } from "@/hooks/useFavicons";
import { filterCapturableTabs } from "@/lib/popupTabs";
import { applyTheme, subscribeToSystemTheme } from "@/lib/theme";
import { getCurrentTabs } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";
import { useHydrationStore } from "@/store/hydration";
import MobileFoldersScreen from "@/dashboard/components/MobileFoldersScreen";
import MobileHomeScreen from "@/dashboard/components/MobileHomeScreen";
import MobileNotesScreen from "@/dashboard/components/MobileNotesScreen";
import MobileSchedulesScreen from "@/dashboard/components/MobileSchedulesScreen";
import SyncGate from "@/dashboard/components/SyncGate";
import RemindersPage from "@/dashboard/pages/RemindersPage";
import CurrentTabs from "./components/CurrentTabs";
import Onboarding from "./components/Onboarding";
import SaveModal from "./components/SaveModal";
import Toast from "./components/Toast";
import { useSyncStore } from "@/store/syncStore";

type SaveMode = "save" | "collapse";
// "capture" is the popup-only tab selection workflow used before opening SaveModal.
type PopupView = MobileNavView | "capture";

interface SaveModalState {
  mode: SaveMode;
  selectedTabIds: number[];
}

function titleForView(view: PopupView): string {
  switch (view) {
    case "folders":
      return "Folders";
    case "schedules":
      return "Schedules";
    case "reminders":
      return "Reminders";
    case "notes":
      return "Notes";
    case "capture":
      return "Select Tabs";
    case "home":
    default:
      return "TabSetu";
  }
}

function ErrorScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <MobileFrame className="mobile-popup-frame">
      <div className="empty-state" style={{ margin: 16 }}>
        <h3>TabSetu hit a problem</h3>
        <p>{error.message}</p>
        <button
          className="btn btn-danger"
          type="button"
          onClick={() => {
            void clearAllData().then(() => {
              onReset();
              window.location.reload();
            });
          }}
        >
          Clear all data and reload
        </button>
      </div>
    </MobileFrame>
  );
}

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <ErrorScreen error={this.state.error} onReset={() => this.setState({ error: null })} />
      );
    }
    return this.props.children;
  }
}

function PopupAppContent() {
  const sessions = useSessionStore((state) => state.sessions);
  const settings = useSettingsStore((state) => state.settings);
  const isReady = useHydrationStore((state) => state.isReady);
  const syncEnabled = useSyncStore((state) => state.enabled);
  const refreshSyncStatus = useSyncStore((state) => state.refreshStatus);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [view, setView] = useState<PopupView>("home");
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
  const [saveModalState, setSaveModalState] = useState<SaveModalState | null>(null);
  const [currentTabCount, setCurrentTabCount] = useState(0);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [syncStatusReady, setSyncStatusReady] = useState(false);

  useEffect(() => {
    document.body.classList.add("is-popup-root");
    return () => document.body.classList.remove("is-popup-root");
  }, []);

  // Bootstraps persisted state once; showUndoToast is stable enough for the initial undo toast.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let mounted = true;
    void loadStorageWithUndoBuffer()
      .then(({ data, undoBuffer, favicons }) => {
        seedFavicons(favicons);
        useSessionStore.getState().importSessions(data.sessions);
        useFolderStore.getState().importFolders(data.folders);
        useTagStore.getState().importTags(data.tags);
        useScheduleStore.getState().importSchedules(data.schedules);
        useNotesStore.getState().importNotes(data.standaloneNotes);
        useShareStore.getState().importShareLinks(data.shareLinks);
        useSettingsStore.setState({ settings: data.settings });
        Array.from({ length: 7 }).forEach(() => useHydrationStore.getState().markOneHydrated());
        if (undoBuffer) {
          showUndoToast(undoBuffer);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsBootstrapped(true);
        }
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    return subscribeToSystemTheme(settings.theme, () => applyTheme("system"));
  }, [settings.theme]);

  useEffect(() => {
    let cancelled = false;
    void refreshSyncStatus().finally(() => {
      if (!cancelled) {
        setSyncStatusReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshSyncStatus]);

  useEffect(() => {
    void getCurrentTabs().then((tabs) => setCurrentTabCount(filterCapturableTabs(tabs).length));
  }, []);

  const addToast = (
    type: ToastMessage["type"],
    message: string,
    options?: Partial<ToastMessage>
  ) => {
    const id = options?.id ?? `toast-${Date.now()}`;
    const toast: ToastMessage = { id, type, message, ...options };
    setToasts((current) => [...current, toast]);
    if (!toast.persistent) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, toast.durationMs ?? 3200);
    }
  };

  const openSaveModal = (mode: SaveMode, ids: number[] = []) => {
    setSaveModalState({ mode, selectedTabIds: ids });
  };

  const clearToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const restoreUndoBuffer = async (buffer: UndoCollapseBuffer, toastId?: string) => {
    try {
      let targetWindowId = buffer.windowId;
      for (const tab of buffer.tabs) {
        if (targetWindowId) {
          try {
            await chrome.tabs.create({ windowId: targetWindowId, url: tab.url });
            continue;
          } catch {
            targetWindowId = null;
          }
        }

        await chrome.tabs.create({ url: tab.url });
      }

      await saveUndoBuffer(null);
      if (toastId) {
        clearToast(toastId);
      }
      addToast("success", `Restored ${buffer.tabs.length} tabs from "${buffer.sessionName}".`);
    } catch {
      addToast("error", "TabSetu could not restore the collapsed tabs.");
    }
  };

  const showUndoToast = (buffer: UndoCollapseBuffer) => {
    const toastId = `toast-undo-${buffer.createdAt}`;
    addToast("info", `Collapsed "${buffer.sessionName}". You can undo for 10 seconds.`, {
      id: toastId,
      actionLabel: "Undo",
      onAction: () => {
        void restoreUndoBuffer(buffer, toastId);
      },
      durationMs: Math.max(buffer.expiresAt - Date.now(), 1000),
    });
  };

  const handleCollapseSaved = ({
    session,
    windowId,
  }: {
    session: Session;
    windowId: number | null;
  }) => {
    const createdAt = Date.now();
    const buffer: UndoCollapseBuffer = {
      sessionId: session.id,
      sessionName: session.name,
      tabs: session.tabs,
      windowId,
      createdAt,
      expiresAt: createdAt + COLLAPSE_UNDO_MS,
    };
    void saveUndoBuffer(buffer);
    window.setTimeout(() => {
      void saveUndoBuffer(null);
    }, COLLAPSE_UNDO_MS);
    showUndoToast(buffer);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const usesCommandShortcutModifier = event.shiftKey && (event.ctrlKey || event.metaKey);
      const usesAltShortcutModifier = event.shiftKey && event.altKey;
      const usesLegacySessionShortcutModifier =
        event.shiftKey && (event.ctrlKey || event.metaKey || event.altKey);

      if (
        (usesAltShortcutModifier && event.key.toLowerCase() === "u") ||
        (usesCommandShortcutModifier && event.key.toLowerCase() === "u") ||
        (usesLegacySessionShortcutModifier && event.key.toLowerCase() === "c")
      ) {
        event.preventDefault();
        setView("capture");
        openSaveModal("collapse");
      }

      if (
        (usesAltShortcutModifier && event.key.toLowerCase() === "y") ||
        (usesCommandShortcutModifier && event.key.toLowerCase() === "y") ||
        (usesLegacySessionShortcutModifier && event.key.toLowerCase() === "s")
      ) {
        event.preventDefault();
        setView("capture");
        openSaveModal("save", selectedTabIds);
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("home");
        window.setTimeout(() => {
          window.dispatchEvent(new Event("tabsetu:focus-home-search"));
        }, 0);
      }

      if (event.key === "Escape" && saveModalState) {
        setSaveModalState(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveModalState, selectedTabIds]);

  const appTrailing = (
    <div className="popup-top-actions">
      <ThemeToggle compact />
      <MobileIconButton title="Select current tabs" onClick={() => setView("capture")}>
        <ListChecks size={18} />
      </MobileIconButton>
    </div>
  );

  if (!isReady || !isBootstrapped || !syncStatusReady) {
    return (
      <MobileFrame className="mobile-popup-frame">
        <LoadingSkeleton />
      </MobileFrame>
    );
  }

  if (!syncEnabled) {
    const openDashboardSignIn = async (): Promise<void> => {
      await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html"), active: true });
      window.close();
    };

    return (
      <MobileFrame className="mobile-popup-frame">
        <SyncGate
          compact
          buttonLabel="Open Google sign-in"
          onContinue={() => void openDashboardSignIn()}
        />
        <Toast toasts={toasts} />
      </MobileFrame>
    );
  }

  if (view === "capture") {
    return (
      <MobileFrame className="mobile-popup-frame">
        <MobileTopBar
          title={titleForView(view)}
          subtitle={`${currentTabCount} current tabs`}
          showBack
          onBack={() => setView("home")}
          trailing={<span />}
        />

        <CurrentTabs
          query=""
          selectedIds={selectedTabIds}
          setSelectedIds={setSelectedTabIds}
          addToast={addToast}
          onSaveSelected={(ids) => openSaveModal("save", ids)}
          onSaveAll={() => openSaveModal("save")}
          onCollapseCurrent={() => openSaveModal("collapse")}
          onTabCountChange={setCurrentTabCount}
        />

        {saveModalState ? (
          <SaveModal
            mode={saveModalState.mode}
            selectedTabIds={saveModalState.selectedTabIds}
            onClose={() => setSaveModalState(null)}
            addToast={addToast}
            onCollapseSaved={handleCollapseSaved}
          />
        ) : null}

        <Toast toasts={toasts} />
      </MobileFrame>
    );
  }

  return (
    <MobileAppShell
      className="mobile-popup-frame"
      activeView={view}
      onViewChange={setView}
      title={titleForView(view)}
      subtitle={view === "home" ? `${sessions.length} saved sessions` : undefined}
      trailing={appTrailing}
    >
      {view === "home" ? (
        <ErrorBoundary>
          <MobileHomeScreen
            addToast={addToast}
            onCollapseSaved={handleCollapseSaved}
            onSelectTabs={() => setView("capture")}
            onQuickSave={() => openSaveModal("save")}
            onCollapseCurrent={() => openSaveModal("collapse")}
            currentTabCount={currentTabCount}
          />
        </ErrorBoundary>
      ) : null}
      {view === "folders" ? <MobileFoldersScreen addToast={addToast} /> : null}
      {view === "schedules" ? <MobileSchedulesScreen addToast={addToast} /> : null}
      {view === "reminders" ? <RemindersPage addToast={addToast} /> : null}
      {view === "notes" ? <MobileNotesScreen addToast={addToast} /> : null}

      <Toast toasts={toasts} />

      {isBootstrapped && !settings.hasCompletedOnboarding ? <Onboarding /> : null}

      {saveModalState ? (
        <SaveModal
          mode={saveModalState.mode}
          selectedTabIds={saveModalState.selectedTabIds}
          onClose={() => setSaveModalState(null)}
          addToast={addToast}
          onCollapseSaved={handleCollapseSaved}
        />
      ) : null}
    </MobileAppShell>
  );
}

export default function PopupApp() {
  return (
    <AppErrorBoundary>
      <PopupAppContent />
    </AppErrorBoundary>
  );
}
