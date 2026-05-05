import { useEffect, useMemo, useState } from "react";
import ImportExportPanel from "@/dashboard/components/ImportExportPanel";
import NotesPanel from "@/dashboard/components/NotesPanel";
import SessionDetail from "@/dashboard/components/SessionDetail";
import SessionList from "@/dashboard/components/SessionList";
import SettingsPanel from "@/dashboard/components/SettingsPanel";
import Sidebar, { type DesktopSidebarView } from "@/dashboard/components/Sidebar";
import RemindersPage from "@/dashboard/pages/RemindersPage";
import type { ToastMessage } from "@/types";
import { useSessionStore } from "@/store/sessionStore";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
  initialView?: DesktopSidebarView;
}

function normalizeDesktopView(view: DesktopSidebarView | undefined): DesktopSidebarView {
  if (view === "notes" || view === "settings" || view === "importexport" || view === "reminders") {
    return view;
  }

  return "sessions";
}

export default function DesktopLayout({ addToast, initialView }: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const [view, setView] = useState<DesktopSidebarView>(() => normalizeDesktopView(initialView));
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  useEffect(() => {
    if (selectedSessionId && !selectedSession) {
      setSelectedSessionId(null);
    }
  }, [selectedSession, selectedSessionId]);

  const openSessionDetail = (sessionId: string) => {
    setView("sessions");
    setSelectedSessionId(sessionId);
  };

  return (
    <div className="desktop-dashboard-layout">
      <Sidebar view={view} setView={setView} />
      <main className="desktop-dashboard-main">
        {view === "sessions" ? (
          <SessionList
            selectedSessionId={selectedSessionId}
            onSelect={setSelectedSessionId}
            addToast={addToast}
          />
        ) : null}
        {view === "notes" ? <NotesPanel addToast={addToast} onOpenSession={openSessionDetail} /> : null}
        {view === "reminders" ? (
          <RemindersPage addToast={addToast} onOpenSession={openSessionDetail} />
        ) : null}
        {view === "settings" ? <SettingsPanel addToast={addToast} /> : null}
        {view === "importexport" ? <ImportExportPanel addToast={addToast} /> : null}
      </main>
      {view === "sessions" && selectedSession ? (
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelectedSessionId(null)}
          addToast={addToast}
        />
      ) : null}
    </div>
  );
}
