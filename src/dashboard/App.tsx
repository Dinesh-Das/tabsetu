import { useEffect, useState } from "react";
import { Download, MoreHorizontal, Settings } from "lucide-react";
import { MobileAppShell, MobileIconButton, type MobileNavView } from "@/components/mobile/MobileUI";
import type { ToastMessage } from "@/types";
import { applyTheme, subscribeToSystemTheme } from "@/lib/theme";
import { useFolderStore } from "@/store/folderStore";
import { useGroupStore } from "@/store/groupStore";
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
  if (view === "notes" || view === "reminders" || view === "settings" || view === "importexport") {
    return view;
  }

  return "sessions";
}

export default function DashboardApp() {
  const loadSessions = useSessionStore((state) => state.load);
  const loadFolders = useFolderStore((state) => state.load);
  const loadGroups = useGroupStore((state) => state.load);
  const loadTags = useTagStore((state) => state.load);
  const loadSchedules = useScheduleStore((state) => state.load);
  const loadNotes = useNotesStore((state) => state.load);
  const loadShareLinks = useShareStore((state) => state.load);
  const loadSettings = useSettingsStore((state) => state.load);
  const settings = useSettingsStore((state) => state.settings);

  const [view, setView] = useState<DashView>(getInitialDashView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(min-width: 900px)").matches,
  );

  useEffect(() => {
    void Promise.all([
      loadSessions(),
      loadFolders(),
      loadGroups(),
      loadTags(),
      loadSchedules(),
      loadNotes(),
      loadShareLinks(),
      loadSettings(),
    ]);
  }, [loadFolders, loadGroups, loadNotes, loadSchedules, loadSessions, loadSettings, loadShareLinks, loadTags]);

  useEffect(() => {
    applyTheme(settings.theme);
    return subscribeToSystemTheme(settings.theme, () => applyTheme("system"));
  }, [settings.theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 900px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const addToast = (type: ToastMessage["type"], message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  };

  const activeNavView = isMobileNavView(view) ? view : "home";

  if (isDesktop) {
    return (
      <div className="desktop-dashboard-stage">
        <DesktopLayout addToast={addToast} initialView={desktopViewFromDashView(view)} />
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
        {view === "home" ? <MobileHomeScreen addToast={addToast} /> : null}
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
