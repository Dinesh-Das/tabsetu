import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import {
  MobileAppShell,
  MobileFrame,
  MobileIconButton,
  MobileTopBar,
  type MobileNavView,
} from "@/components/mobile/MobileUI";
import ThemeToggle from "@/components/shared/ThemeToggle";
import type { Session, ToastMessage, UndoCollapseBuffer } from "@/types";
import { loadUndoBuffer, saveUndoBuffer } from "@/lib/storage";
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
import MobileFoldersScreen from "@/dashboard/components/MobileFoldersScreen";
import MobileHomeScreen from "@/dashboard/components/MobileHomeScreen";
import MobileNotesScreen from "@/dashboard/components/MobileNotesScreen";
import MobileSchedulesScreen from "@/dashboard/components/MobileSchedulesScreen";
import RemindersPage from "@/dashboard/pages/RemindersPage";
import CurrentTabs from "./components/CurrentTabs";
import Onboarding from "./components/Onboarding";
import SaveModal from "./components/SaveModal";
import Toast from "./components/Toast";

type SaveMode = "save" | "collapse";
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

export default function PopupApp() {
  const loadSessions = useSessionStore((state) => state.load);
  const sessions = useSessionStore((state) => state.sessions);
  const loadFolders = useFolderStore((state) => state.load);
  const loadTags = useTagStore((state) => state.load);
  const loadSchedules = useScheduleStore((state) => state.load);
  const loadNotes = useNotesStore((state) => state.load);
  const loadShareLinks = useShareStore((state) => state.load);
  const loadSettings = useSettingsStore((state) => state.load);
  const settings = useSettingsStore((state) => state.settings);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [view, setView] = useState<PopupView>("home");
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
  const [saveModalState, setSaveModalState] = useState<SaveModalState | null>(null);
  const [currentTabCount, setCurrentTabCount] = useState(0);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    document.body.classList.add("is-popup-root");
    return () => document.body.classList.remove("is-popup-root");
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      loadSessions(),
      loadFolders(),
      loadTags(),
      loadSchedules(),
      loadNotes(),
      loadShareLinks(),
      loadSettings(),
    ]).finally(() => {
      if (mounted) {
        setIsBootstrapped(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadFolders, loadNotes, loadSchedules, loadSessions, loadSettings, loadShareLinks, loadTags]);

  useEffect(() => {
    applyTheme(settings.theme);
    return subscribeToSystemTheme(settings.theme, () => applyTheme("system"));
  }, [settings.theme]);

  useEffect(() => {
    void getCurrentTabs().then((tabs) => setCurrentTabCount(filterCapturableTabs(tabs).length));
  }, []);

  const addToast = (
    type: ToastMessage["type"],
    message: string,
    options?: Partial<ToastMessage>,
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
    addToast(
      "info",
      `Collapsed "${buffer.sessionName}". You can undo for 10 seconds.`,
      {
        id: toastId,
        actionLabel: "Undo",
        onAction: () => {
          void restoreUndoBuffer(buffer, toastId);
        },
        durationMs: Math.max(buffer.expiresAt - Date.now(), 1000),
      },
    );
  };

  const handleCollapseSaved = ({ session, windowId }: { session: Session; windowId: number | null }) => {
    const createdAt = Date.now();
    const buffer: UndoCollapseBuffer = {
      sessionId: session.id,
      sessionName: session.name,
      tabs: session.tabs,
      windowId,
      createdAt,
      expiresAt: createdAt + 10000,
    };
    void saveUndoBuffer(buffer);
    window.setTimeout(() => {
      void saveUndoBuffer(null);
    }, 10000);
    showUndoToast(buffer);
  };

  useEffect(() => {
    void loadUndoBuffer().then((buffer) => {
      if (buffer) {
        showUndoToast(buffer);
      }
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setView("capture");
        openSaveModal("collapse");
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
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
        <MobileHomeScreen
          addToast={addToast}
          onCollapseSaved={handleCollapseSaved}
          onSelectTabs={() => setView("capture")}
          onQuickSave={() => openSaveModal("save")}
          onCollapseCurrent={() => openSaveModal("collapse")}
          currentTabCount={currentTabCount}
        />
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
