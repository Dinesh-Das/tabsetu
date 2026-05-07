import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, Plus, Save, Share2, Trash2, X } from "lucide-react";
import type { Session, ToastMessage } from "@/types";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { openSessionTabs } from "@/lib/sessionBrowser";
import { chromeTabToTabItem, isRestrictedUrl } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import SessionSchedulePanel from "./SessionSchedulePanel";
import SessionSharePanel from "./SessionSharePanel";
import SessionTabList from "./SessionTabList";

interface Props { session: Session; onClose: () => void; addToast: (type: ToastMessage["type"], message: string) => void; }

export default function SessionDetail({ session, onClose, addToast }: Props) {
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const settings = useSettingsStore((state) => state.settings);
  const schedules = useScheduleStore((state) => state.schedules);
  const createSchedule = useScheduleStore((state) => state.createSchedule);
  const updateSchedule = useScheduleStore((state) => state.updateSchedule);
  const deleteSchedule = useScheduleStore((state) => state.deleteSchedule);
  const toggleSchedule = useScheduleStore((state) => state.toggleSchedule);
  const syncAlarms = useScheduleStore((state) => state.syncAlarms);
  const updateSession = useSessionStore((state) => state.updateSession);
  const createSession = useSessionStore((state) => state.createSession);
  const duplicateSession = useSessionStore((state) => state.duplicateSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const addTabToSession = useSessionStore((state) => state.addTabToSession);
  const addTabsToSession = useSessionStore((state) => state.addTabsToSession);
  const removeTabFromSession = useSessionStore((state) => state.removeTabFromSession);
  const updateTabNote = useSessionStore((state) => state.updateTabNote);
  const updateTabReminder = useSessionStore((state) => state.updateTabReminder);
  const updateTabFolder = useSessionStore((state) => state.updateTabFolder);
  const updateTabTags = useSessionStore((state) => state.updateTabTags);
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);
  const [name, setName] = useState(session.name), [description, setDescription] = useState(session.description);
  const [note, setNote] = useState(session.note), [folderId, setFolderId] = useState(session.folderId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(session.tagIds);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(session.name); setDescription(session.description); setNote(session.note); setFolderId(session.folderId ?? ""); setTagIds(session.tagIds);
  }, [session]);

  const handleSaveDetails = () => {
    updateSession(session.id, { name, description, note, folderId: folderId || null, tagIds });
    addToast("success", `Updated "${name}".`);
  };

  const handleOpenSession = async (openInNewWindow = settings.openInNewWindow) => {
    const opened = await openSessionTabs(session, openInNewWindow);
    if (opened === 0) { addToast("error", "This session has no openable tabs."); return; }
    recordOpened(session.id); addToast("success", `Opened "${session.name}".`);
  };

  const handleDeleteSession = () => {
    if (settings.confirmBeforeDelete) { setShowDeleteConfirm(true); return; }
    deleteSession(session.id); onClose(); addToast("success", `Deleted "${session.name}".`);
  };

  const handleAddCurrentTabs = async () => {
    const browserTabs = await chrome.tabs.query({});
    const tabs = browserTabs
      .filter((tab) => tab.url && !isRestrictedUrl(tab.url))
      .map(chromeTabToTabItem);
    const addedCount = addTabsToSession(session.id, tabs);

    if (addedCount === 0) {
      addToast("info", "All open tabs are already in this session.");
      return;
    }

    addToast("success", `Added ${addedCount} ${addedCount === 1 ? "open tab" : "open tabs"} to "${session.name}".`);
  };

  return (
    <aside className="session-detail-shell">
      <div className="session-detail-hero">
        <div className="session-detail-title-row">
          <div><h2>{session.name}</h2><p>Created {formatDateTime(session.createdAt)} - Opened {formatDateTime(session.lastOpenedAt)}</p></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close detail panel"><X size={16} /></button>
        </div>
        <div className="session-detail-actions">
          <button className="btn btn-primary" onClick={() => void handleOpenSession()}><ExternalLink size={15} />Open all</button>
          <button className="btn btn-secondary" onClick={() => void handleOpenSession(true)}>New window</button>
          <button className="btn btn-secondary" onClick={() => { duplicateSession(session.id); addToast("success", `Duplicated "${session.name}".`); }}>Duplicate</button>
          <button className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event("tabsetu:open-share-panel"))}><Share2 size={15} />Share</button>
          <button className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event("tabsetu:add-active-tab"))}><Plus size={15} />Add active tab</button>
          <button className="btn btn-secondary" onClick={() => void handleAddCurrentTabs()}><Plus size={15} />Add open tabs</button>
        </div>
      </div>
      <div className="session-detail-scroll">
        <section className="detail-section session-detail-edit-section">
          <div className="detail-section-header"><h3>Session details</h3><button className="btn btn-secondary" onClick={handleSaveDetails}><Save size={14} />Save changes</button></div>
          <div className="form-stack session-detail-form-grid">
            <div><label className="label">Name</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div><label className="label">Folder</label><select className="input" value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
            <div className="session-detail-wide-field"><label className="label">Description</label><textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div className="session-detail-wide-field"><label className="label">Session notes</label><textarea className="input" value={note} onChange={(event) => setNote(event.target.value)} /></div>
            <div className="session-detail-wide-field">
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}><FolderOpen size={14} />Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{tags.map((tag) => { const active = tagIds.includes(tag.id); return <button key={tag.id} className="tag-chip" type="button" data-active={active} onClick={() => setTagIds((current) => active ? current.filter((existing) => existing !== tag.id) : [...current, tag.id])} style={{ borderColor: active ? tag.color : "var(--color-border)", color: active ? tag.color : "var(--color-text-secondary)", background: active ? `${tag.color}22` : "transparent" }}>{tag.name}</button>; })}</div>
            </div>
          </div>
        </section>
        <SessionSchedulePanel sessionId={session.id} schedules={schedules} schedulesEnabled={settings.schedulesEnabled} createSchedule={createSchedule} updateSchedule={updateSchedule} deleteSchedule={deleteSchedule} toggleSchedule={toggleSchedule} syncAlarms={syncAlarms} addToast={addToast} />
        <SessionSharePanel session={session} addToast={addToast} aiEnabled={settings.aiEnabled} defaultAIProvider={settings.defaultAIProvider} />
        <SessionTabList session={session} folders={folders} tags={tags} remindersEnabled={settings.remindersEnabled} addToast={addToast} createSession={createSession} createSchedule={createSchedule} updateSession={updateSession} addTabToSession={addTabToSession} removeTabFromSession={removeTabFromSession} updateTabNote={updateTabNote} updateTabReminder={updateTabReminder} updateTabFolder={updateTabFolder} updateTabTags={updateTabTags} recordTabOpened={recordTabOpened} />
        <section className="detail-section">
          <div className="detail-section-header"><h3>Danger zone</h3></div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { updateSession(session.id, { isArchived: !session.isArchived }); addToast("success", session.isArchived ? "Session restored." : "Session archived."); }}>{session.isArchived ? "Restore session" : "Archive session"}</button>
            <button className="btn btn-danger" onClick={handleDeleteSession}><Trash2 size={14} />Delete session</button>
          </div>
        </section>
      </div>
      {showDeleteConfirm ? (
        <ConfirmDialog title="Delete session?" message={`"${session.name}" will be removed from TabSetu.`} confirmLabel="Delete session" danger onClose={() => setShowDeleteConfirm(false)} onConfirm={() => { deleteSession(session.id); setShowDeleteConfirm(false); onClose(); addToast("success", `Deleted "${session.name}".`); }} />
      ) : null}
    </aside>
  );
}
