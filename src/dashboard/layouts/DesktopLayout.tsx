import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ImportExportPanel from "@/dashboard/components/ImportExportPanel";
import NotesPanel from "@/dashboard/components/NotesPanel";
import SessionDetail from "@/dashboard/components/SessionDetail";
import SessionList from "@/dashboard/components/SessionList";
import SettingsPanel from "@/dashboard/components/SettingsPanel";
import Sidebar, { type DesktopSidebarView } from "@/dashboard/components/Sidebar";
import MobileSchedulesScreen from "@/dashboard/components/MobileSchedulesScreen";
import RemindersPage from "@/dashboard/pages/RemindersPage";
import type { ToastMessage } from "@/types";
import { useSessionStore } from "@/store/sessionStore";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
  initialView?: DesktopSidebarView;
}

function normalizeDesktopView(view: DesktopSidebarView | undefined): DesktopSidebarView {
  if (
    view === "notes" ||
    view === "settings" ||
    view === "importexport" ||
    view === "reminders" ||
    view === "schedules"
  ) {
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

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setSelectedSessionId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSessionId]);

  const openSessionDetail = (sessionId: string) => {
    setView("sessions");
    setSelectedSessionId(sessionId);
  };

  return (
    <div className="desktop-dashboard-layout" data-detail-open={view === "sessions" && Boolean(selectedSession)}>
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
        {view === "schedules" ? <MobileSchedulesScreen addToast={addToast} /> : null}
        {view === "settings" ? <SettingsPanel addToast={addToast} /> : null}
        {view === "importexport" ? <ImportExportPanel addToast={addToast} /> : null}
      </main>
      <AnimatePresence initial={false}>
        {view === "sessions" && selectedSession ? (
          <motion.div
            key={selectedSession.id}
            className="desktop-detail-motion"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <SessionDetail
              session={selectedSession}
              onClose={() => setSelectedSessionId(null)}
              addToast={addToast}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
