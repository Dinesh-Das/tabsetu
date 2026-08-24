import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import { Download, MoreHorizontal, Settings } from "lucide-react";
import { MobileAppShell, MobileIconButton, type MobileNavView } from "@/components/mobile/MobileUI";
import ThemeToggle from "@/components/shared/ThemeToggle";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import RecoveryScreen from "@/components/shared/RecoveryScreen";
import type { ToastMessage, UndoCollapseBuffer } from "@/types";
import { saveUndoBuffer } from "@/lib/storage";
import { openTabItemsDetailed } from "@/lib/sessionBrowser";
import { applyTheme, subscribeToSystemTheme } from "@/lib/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { loadHydratedStorage, useHydrationStore } from "@/store/hydration";
import DashToast from "./components/DashToast";
import ImportExportPanel from "./components/ImportExportPanel";
import MobileFoldersScreen from "./components/MobileFoldersScreen";
import MobileHomeScreen from "./components/MobileHomeScreen";
import MobileNotesScreen from "./components/MobileNotesScreen";
import MobileSchedulesScreen from "./components/MobileSchedulesScreen";
import SettingsPanel from "./components/SettingsPanel";
import SyncOptInBanner from "./components/SyncOptInBanner";
import DesktopLayout from "./layouts/DesktopLayout";
import RemindersPage from "./pages/RemindersPage";
import type { DesktopSidebarView } from "./components/Sidebar";
import { useSyncStore } from "@/store/syncStore";
import { subscribeToPersistenceFailures } from "@/store/persistenceQueue";
import { applyStorageDataToStores, subscribeToStorageBridge } from "@/store/storageBridge";

type DashView = MobileNavView | "settings" | "importexport";
type SavePromptMode = "save" | "collapse";

function getInitialSavePrompt(): { mode: SavePromptMode; sourceTabId: number | null } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("saveMode");
  if (mode !== "save" && mode !== "collapse") {
    return null;
  }

  const sourceTabId = Number(params.get("sourceTabId"));
  return {
    mode,
    sourceTabId: Number.isFinite(sourceTabId) ? sourceTabId : null,
  };
}

function clearSavePromptUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("saveMode");
  url.searchParams.delete("sourceTabId");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function getInitialDashView(): DashView {
  if (typeof window === "undefined") {
    return "home";
  }

  const view = new URLSearchParams(window.location.search).get("view");
  if (
    view === "home" ||
    view === "folders" ||
    view === "schedules" ||
    view === "reminders" ||
    view === "notes" ||
    view === "settings" ||
    view === "importexport"
  ) {
    return view;
  }

  return "home";
}

function isMobileNavView(view: DashView): view is MobileNavView {
  return (
    view === "home" ||
    view === "folders" ||
    view === "schedules" ||
    view === "reminders" ||
    view === "notes"
  );
}

function titleForView(view: DashView): string {
  switch (view) {
    case "folders":
      return "Folders";
    case "schedules":
      return "Schedules";
    case "notes":
      return "Notes";
    case "reminders":
      return "Reminders";
    case "settings":
      return "Settings";
    case "importexport":
      return "Backup";
    case "home":
    default:
      return "TabSetu";
  }
}

function desktopViewFromDashView(view: DashView): DesktopSidebarView {
  if (
    view === "notes" ||
    view === "reminders" ||
    view === "schedules" ||
    view === "settings" ||
    view === "importexport"
  ) {
    return view;
  }

  return "sessions";
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <RecoveryScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

function DashboardAppContent() {
  const settings = useSettingsStore((state) => state.settings);
  const isReady = useHydrationStore((state) => state.isReady);
  const refreshSyncStatus = useSyncStore((state) => state.refreshStatus);

  const [view, setView] = useState<DashView>(getInitialDashView);
  const [savePrompt, setSavePrompt] = useState(getInitialSavePrompt);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrationError, setHydrationError] = useState<Error | null>(null);
  const isDesktop = useMediaQuery("(min-width: 900px)");

  useEffect(() => {
    void loadHydratedStorage()
      .then((data) => {
        applyStorageDataToStores(data);
        Array.from({ length: 7 }).forEach(() => useHydrationStore.getState().markOneHydrated());
      })
      .catch((error: unknown) => {
        setHydrationError(error instanceof Error ? error : new Error("Storage hydration failed."));
      });
  }, []);

  useEffect(() => {
    void refreshSyncStatus();
  }, [refreshSyncStatus]);

  useEffect(() => {
    applyTheme(settings.theme);
    return subscribeToSystemTheme(settings.theme, () => applyTheme("system"));
  }, [settings.theme]);

  const addToast = useCallback(
    (type: ToastMessage["type"], message: string, options?: Partial<ToastMessage>) => {
      const id = options?.id ?? `toast-${Date.now()}`;
      const toast: ToastMessage = { id, type, message, ...options };
      setToasts((current) => [...current, toast]);
      if (!toast.persistent) {
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, toast.durationMs ?? 3400);
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

  useEffect(
    () =>
      subscribeToStorageBridge(() => {
        addToast("error", "TabSetu could not refresh changes made in another window.");
      }),
    [addToast]
  );

  const handleInitialSavePromptHandled = () => {
    setSavePrompt(null);
    clearSavePromptUrl();
  };

  const handleCollapseSaved = (buffer: UndoCollapseBuffer) => {
    const toastId = `toast-undo-${buffer.createdAt}`;
    addToast("info", `Collapsed "${buffer.sessionName}". You can undo for 10 seconds.`, {
      id: toastId,
      actionLabel: "Undo",
      durationMs: Math.max(buffer.expiresAt - Date.now(), 1000),
      onAction: () => {
        void (async () => {
          try {
            let result = await openTabItemsDetailed(buffer.tabs, false, {
              targetWindowId: buffer.windowId,
            });
            if (result.openedCount === 0 && buffer.windowId != null) {
              result = await openTabItemsDetailed(buffer.tabs, false);
            }
            await saveUndoBuffer(null);
            setToasts((current) => current.filter((toast) => toast.id !== toastId));
            addToast(
              result.failedTabs.length > 0 || result.warnings.length > 0 ? "error" : "success",
              result.failedTabs.length > 0 || result.warnings.length > 0
                ? `Restored ${result.openedCount} tabs; some tabs or groups could not be restored.`
                : `Restored tabs from "${buffer.sessionName}".`
            );
          } catch {
            addToast("error", "TabSetu could not restore the collapsed tabs.");
          }
        })();
      },
    });
  };

  const activeNavView = isMobileNavView(view) ? view : "home";

  if (hydrationError) {
    return <RecoveryScreen error={hydrationError} />;
  }

  if (!isReady) {
    return <LoadingSkeleton />;
  }

  if (isDesktop) {
    return (
      <div className="desktop-dashboard-stage">
        <DesktopLayout
          addToast={addToast}
          initialView={desktopViewFromDashView(view)}
          initialSavePrompt={savePrompt}
          onInitialSavePromptHandled={handleInitialSavePromptHandled}
          onCollapseSaved={handleCollapseSaved}
        />
        <DashToast toasts={toasts} />
      </div>
    );
  }

  return (
    <div className="mobile-dashboard-stage">
      <MobileAppShell
        activeView={activeNavView}
        onViewChange={(nextView) => {
          setView(nextView);
          setMenuOpen(false);
        }}
        title={titleForView(view)}
        trailing={
          <div className="dashboard-top-actions">
            <ThemeToggle compact />
            <MobileIconButton title="More" onClick={() => setMenuOpen((open) => !open)}>
              <MoreHorizontal size={18} />
            </MobileIconButton>
            {menuOpen ? (
              <div className="dashboard-overflow-menu">
                <button
                  type="button"
                  onClick={() => {
                    setView("settings");
                    setMenuOpen(false);
                  }}
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("importexport");
                    setMenuOpen(false);
                  }}
                >
                  <Download size={16} />
                  Import / Export
                </button>
              </div>
            ) : null}
          </div>
        }
      >
        <SyncOptInBanner onOpenSettings={() => setView("settings")} />
        {view === "home" ? (
          <ErrorBoundary>
            <MobileHomeScreen
              addToast={addToast}
              onCollapseSaved={handleCollapseSaved}
              initialSavePrompt={savePrompt}
              onInitialSavePromptHandled={handleInitialSavePromptHandled}
            />
          </ErrorBoundary>
        ) : null}
        {view === "folders" ? <MobileFoldersScreen addToast={addToast} /> : null}
        {view === "schedules" ? (
          <ErrorBoundary>
            <MobileSchedulesScreen addToast={addToast} />
          </ErrorBoundary>
        ) : null}
        {view === "reminders" ? (
          <ErrorBoundary>
            <RemindersPage addToast={addToast} />
          </ErrorBoundary>
        ) : null}
        {view === "notes" ? (
          <ErrorBoundary>
            <MobileNotesScreen addToast={addToast} />
          </ErrorBoundary>
        ) : null}
        {view === "settings" ? <SettingsPanel addToast={addToast} /> : null}
        {view === "importexport" ? (
          <ErrorBoundary>
            <ImportExportPanel addToast={addToast} />
          </ErrorBoundary>
        ) : null}
      </MobileAppShell>

      <DashToast toasts={toasts} />
    </div>
  );
}

export default function DashboardApp() {
  return (
    <AppErrorBoundary>
      <DashboardAppContent />
    </AppErrorBoundary>
  );
}
