import React, { type ReactNode, useEffect, useState } from "react";
import { Download, MoreHorizontal, Settings } from "lucide-react";
import { MobileAppShell, MobileIconButton, type MobileNavView } from "@/components/mobile/MobileUI";
import ThemeToggle from "@/components/shared/ThemeToggle";
import type { ToastMessage } from "@/types";
import { clearAllData, loadStorage } from "@/lib/storage";
import { applyTheme, subscribeToSystemTheme } from "@/lib/theme";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";
import DashToast from "./components/DashToast";
import ImportExportPanel from "./components/ImportExportPanel";
import MobileFoldersScreen from "./components/MobileFoldersScreen";
import MobileHomeScreen from "./components/MobileHomeScreen";
import MobileNotesScreen from "./components/MobileNotesScreen";
import MobileSchedulesScreen from "./components/MobileSchedulesScreen";
import SettingsPanel from "./components/SettingsPanel";
import DesktopLayout from "./layouts/DesktopLayout";
import RemindersPage from "./pages/RemindersPage";
import type { DesktopSidebarView } from "./components/Sidebar";

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
  return view === "home" || view === "folders" || view === "schedules" || view === "reminders" || view === "notes";
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
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
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

function ErrorScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="mobile-dashboard-stage">
      <div className="empty-state" style={{ margin: 24 }}>
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
    </div>
  );
}

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <ErrorScreen error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function DashboardAppContent() {
  const settings = useSettingsStore((state) => state.settings);

  const [view, setView] = useState<DashView>(getInitialDashView);
  const [savePrompt, setSavePrompt] = useState(getInitialSavePrompt);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const isDesktop = useMediaQuery("(min-width: 900px)");

  useEffect(() => {
    void loadStorage().then((data) => {
      useSessionStore.getState().importSessions(data.sessions);
      useFolderStore.getState().importFolders(data.folders);
      useTagStore.getState().importTags(data.tags);
      useScheduleStore.getState().importSchedules(data.schedules);
      useNotesStore.getState().importNotes(data.standaloneNotes);
      useShareStore.getState().importShareLinks(data.shareLinks);
      useSettingsStore.setState({ settings: data.settings });
    });
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    return subscribeToSystemTheme(settings.theme, () => applyTheme("system"));
  }, [settings.theme]);

  const addToast = (type: ToastMessage["type"], message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  };

  const handleInitialSavePromptHandled = () => {
    setSavePrompt(null);
    clearSavePromptUrl();
  };

  const activeNavView = isMobileNavView(view) ? view : "home";

  if (isDesktop) {
    return (
      <div className="desktop-dashboard-stage">
        <DesktopLayout
          addToast={addToast}
          initialView={desktopViewFromDashView(view)}
          initialSavePrompt={savePrompt}
          onInitialSavePromptHandled={handleInitialSavePromptHandled}
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
                <button type="button" onClick={() => { setView("settings"); setMenuOpen(false); }}>
                  <Settings size={16} />
                  Settings
                </button>
                <button type="button" onClick={() => { setView("importexport"); setMenuOpen(false); }}>
                  <Download size={16} />
                  Import / Export
                </button>
              </div>
            ) : null}
          </div>
        }
      >
        {view === "home" ? (
          <MobileHomeScreen
            addToast={addToast}
            initialSavePrompt={savePrompt}
            onInitialSavePromptHandled={handleInitialSavePromptHandled}
          />
        ) : null}
        {view === "folders" ? <MobileFoldersScreen addToast={addToast} /> : null}
        {view === "schedules" ? <MobileSchedulesScreen addToast={addToast} /> : null}
        {view === "reminders" ? <RemindersPage addToast={addToast} /> : null}
        {view === "notes" ? <MobileNotesScreen addToast={addToast} /> : null}
        {view === "settings" ? <SettingsPanel addToast={addToast} /> : null}
        {view === "importexport" ? <ImportExportPanel addToast={addToast} /> : null}
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
