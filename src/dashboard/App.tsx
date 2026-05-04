import { useEffect, useMemo, useState } from "react";
import type { ToastMessage } from "@/types";
import { useFolderStore } from "@/store/folderStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import DashToast from "./components/DashToast";
import ImportExportPanel from "./components/ImportExportPanel";
import SessionDetail from "./components/SessionDetail";
import SessionList from "./components/SessionList";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";

type DashView = "sessions" | "settings" | "importexport";

export default function DashboardApp() {
  const loadSessions = useSessionStore((state) => state.load);
  const sessions = useSessionStore((state) => state.sessions);
  const loadFolders = useFolderStore((state) => state.load);
  const loadTags = useTagStore((state) => state.load);
  const loadSchedules = useScheduleStore((state) => state.load);
  const loadSettings = useSettingsStore((state) => state.load);
  const settings = useSettingsStore((state) => state.settings);

  const [view, setView] = useState<DashView>("sessions");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    void Promise.all([loadSessions(), loadFolders(), loadTags(), loadSchedules(), loadSettings()]);
  }, [loadFolders, loadSchedules, loadSessions, loadSettings, loadTags]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") {
      root.className = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      return;
    }

    root.className = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (selectedSessionId && !sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(null);
    }
  }, [selectedSessionId, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  const addToast = (type: ToastMessage["type"], message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <Sidebar view={view} setView={setView} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {view === "sessions" ? (
          <>
            <SessionList
              selectedSessionId={selectedSessionId}
              onSelect={setSelectedSessionId}
              addToast={addToast}
            />
            {selectedSession && settings.dashboardLayout === "split" ? (
              <SessionDetail
                session={selectedSession}
                onClose={() => setSelectedSessionId(null)}
                addToast={addToast}
              />
            ) : null}
            {selectedSession && settings.dashboardLayout === "focus" ? (
              <div className="detail-overlay">
                <SessionDetail
                  session={selectedSession}
                  onClose={() => setSelectedSessionId(null)}
                  addToast={addToast}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {view === "settings" ? <SettingsPanel addToast={addToast} /> : null}
        {view === "importexport" ? <ImportExportPanel addToast={addToast} /> : null}
      </div>

      <DashToast toasts={toasts} />
    </div>
  );
}
