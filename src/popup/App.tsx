import React, { type ReactNode, useCallback, useEffect, useState } from "react";
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
import RecoveryScreen from "@/components/shared/RecoveryScreen";
import type { ToastMessage, UndoCollapseBuffer } from "@/types";
import { loadStorageWithUndoBuffer, saveUndoBuffer } from "@/lib/storage";
import { filterCapturableTabs } from "@/lib/popupTabs";
import { applyTheme, subscribeToSystemTheme } from "@/lib/theme";
import { getCurrentTabs, isValidUrl } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";
import { TOTAL_STORES, useHydrationStore } from "@/store/hydration";
import MobileFoldersScreen from "@/dashboard/components/MobileFoldersScreen";
import MobileHomeScreen from "@/dashboard/components/MobileHomeScreen";
import MobileNotesScreen from "@/dashboard/components/MobileNotesScreen";
import MobileSchedulesScreen from "@/dashboard/components/MobileSchedulesScreen";
import RemindersPage from "@/dashboard/pages/RemindersPage";
import CurrentTabs from "./components/CurrentTabs";
import Onboarding from "./components/Onboarding";
import SaveModal from "./components/SaveModal";
import Toast from "./components/Toast";
import { useSyncStore } from "@/store/syncStore";
import { subscribeToPersistenceFailures } from "@/store/persistenceQueue";

type SaveMode = "save" | "collapse";
// "capture" is the popup-only tab selection workflow used before opening SaveModal.
type PopupView = MobileNavView | "capture";

interface SaveModalState {
  mode: SaveMode;
  selectedTabIds: number[];
}

function saveModalInstanceKey(state: SaveModalState): string {
  return `${state.mode}:${state.selectedTabIds.join(",")}`;
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

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <RecoveryScreen error={this.state.error} compact />;
    }
    return this.props.children;
  }
}

function PopupAppContent() {
  const sessions = useSessionStore((state) => state.sessions);
  const settings = useSettingsStore((state) => state.settings);
  const isReady = useHydrationStore((state) => state.isReady);
  const refreshSyncStatus = useSyncStore((state) => state.refreshStatus);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [view, setView] = useState<PopupView>("home");
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
  const [saveModalState, setSaveModalState] = useState<SaveModalState | null>(null);
  const [currentTabCount, setCurrentTabCount] = useState(0);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);

  useEffect(() => {
    document.body.classList.add("is-popup-root");
    return () => document.body.classList.remove("is-popup-root");
  }, []);

  // Bootstraps persisted state once; showUndoToast is stable enough for the initial undo toast.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let mounted = true;
    void loadStorageWithUndoBuffer()
      .then(({ data, undoBuffer }) => {
        useSessionStore.getState().importSessions(data.sessions);
        useFolderStore.getState().importFolders(data.folders);
        useTagStore.getState().importTags(data.tags);
        useScheduleStore.getState().importSchedules(data.schedules);
        useNotesStore.getState().importNotes(data.standaloneNotes);
        useShareStore.getState().importShareLinks(data.shareLinks);
        useSettingsStore.setState({ settings: data.settings });
        Array.from({ length: TOTAL_STORES }).forEach(() =>
          useHydrationStore.getState().markOneHydrated()
        );
        if (undoBuffer) {
          showUndoToast(undoBuffer);
        }
      })
      .then(() => {
        // Check if the popup was opened by a save/collapse keyboard shortcut.
        return chrome.runtime
          .sendMessage({ type: "tabsetu:get-pending-save-mode" })
          .catch(() => null);
      })
      .then((response: unknown) => {
        if (
          mounted &&
          response &&
          typeof response === "object" &&
          (response as Record<string, unknown>).mode
        ) {
          const record = response as Record<string, unknown>;
          const mode = record.mode;
          const responseTabIds = record.selectedTabIds;
          const pendingSelectedTabIds = Array.isArray(responseTabIds)
            ? responseTabIds.filter(
                (tabId): tabId is number =>
                  Number.isInteger(tabId) && tabId > 0 && Number.isSafeInteger(tabId)
              )
            : [];

          if (mode === "save" || mode === "collapse") {
            setSaveModalState({ mode, selectedTabIds: pendingSelectedTabIds });
          }
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setBootstrapError(
            error instanceof Error ? error : new Error("Storage hydration failed.")
          );
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
    void refreshSyncStatus();
  }, [refreshSyncStatus]);

  useEffect(() => {
    void getCurrentTabs().then((tabs) => setCurrentTabCount(filterCapturableTabs(tabs).length));
  }, []);

  const addToast = useCallback(
    (type: ToastMessage["type"], message: string, options?: Partial<ToastMessage>) => {
      const id = options?.id ?? `toast-${Date.now()}`;
      const toast: ToastMessage = { id, type, message, ...options };
      setToasts((current) => [...current, toast]);
      if (!toast.persistent) {
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, toast.durationMs ?? 3200);
      }
    },
    []
  );

  useEffect(
    () =>
      subscribeToPersistenceFailures(({ store }) => {
        addToast("error", `Changes to ${store} could not be saved. Your next edit will retry.`);
      }),
    [addToast]
  );

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
        if (!isValidUrl(tab.url)) {
          continue;
        }
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

  const handleCollapseSaved = (buffer: UndoCollapseBuffer) => {
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

  if (bootstrapError) {
    return <RecoveryScreen error={bootstrapError} compact />;
  }

  if (!isReady || !isBootstrapped) {
    return (
      <MobileFrame className="mobile-popup-frame">
        <LoadingSkeleton />
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
            key={saveModalInstanceKey(saveModalState)}
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
          key={saveModalInstanceKey(saveModalState)}
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
