import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  ClipboardCopy,
  ExternalLink,
  FolderOpen,
  Link2,
  Plus,
  Save,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Schedule, Session, ToastMessage } from "@/types";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  copyLinksToClipboard,
  downloadMarkdown,
  downloadPlainText,
  generateAIPrompt,
} from "@/lib/exportImport";
import { formatDateTime, formatScheduleLabel } from "@/lib/format";
import { copyTextToClipboard, getDomainLabel, openSavedTab, openSessionTabs } from "@/lib/sessionBrowser";
import { chromeTabToTabItem, getPreferredBrowserTab, isRestrictedUrl } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import ShareSessionModal from "./ShareSessionModal";

interface Props {
  session: Session;
  onClose: () => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
}

const DAY_OPTIONS = [
  { label: "S", value: 0 },
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
];

type ScheduleDraft = Omit<Schedule, "id" | "createdAt" | "updatedAt" | "lastFiredAt">;

function defaultScheduleDraft(sessionId: string): ScheduleDraft {
  return {
    sessionId,
    type: "daily" as Schedule["type"],
    time: "09:00",
    daysOfWeek: [1],
    date: null as string | null,
    enabled: true,
  };
}

function scheduleDraftFromSchedule(schedule: Schedule): ScheduleDraft {
  return {
    sessionId: schedule.sessionId,
    type: schedule.type,
    time: schedule.time,
    daysOfWeek: [...schedule.daysOfWeek],
    date: schedule.date,
    enabled: schedule.enabled,
  };
}

function toDateTimeInputValue(value: number | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

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
  const duplicateSession = useSessionStore((state) => state.duplicateSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const addTabToSession = useSessionStore((state) => state.addTabToSession);
  const removeTabFromSession = useSessionStore((state) => state.removeTabFromSession);
  const updateTabNote = useSessionStore((state) => state.updateTabNote);
  const updateTabReminder = useSessionStore((state) => state.updateTabReminder);
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);

  const [name, setName] = useState(session.name);
  const [description, setDescription] = useState(session.description);
  const [note, setNote] = useState(session.note);
  const [folderId, setFolderId] = useState(session.folderId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(session.tagIds);
  const [tabDraftNotes, setTabDraftNotes] = useState<Record<string, string>>({});
  const [scheduleDraft, setScheduleDraft] = useState(defaultScheduleDraft(session.id));
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    setName(session.name);
    setDescription(session.description);
    setNote(session.note);
    setFolderId(session.folderId ?? "");
    setTagIds(session.tagIds);
    setTabDraftNotes(
      Object.fromEntries(session.tabs.map((tab) => [tab.id, tab.note])),
    );
    setScheduleDraft(defaultScheduleDraft(session.id));
    setEditingScheduleId(null);
  }, [session]);

  const sessionSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.sessionId === session.id),
    [schedules, session.id],
  );

  const handleSaveDetails = () => {
    updateSession(session.id, {
      name,
      description,
      note,
      folderId: folderId || null,
      tagIds,
    });
    addToast("success", `Updated "${name}".`);
  };

  const toggleTag = (tagId: string) => {
    setTagIds((current) =>
      current.includes(tagId)
        ? current.filter((existing) => existing !== tagId)
        : [...current, tagId],
    );
  };

  const handleOpenSession = async (openInNewWindow = settings.openInNewWindow) => {
    const opened = await openSessionTabs(session, openInNewWindow);
    if (opened === 0) {
      addToast("error", "This session has no openable tabs.");
      return;
    }

    recordOpened(session.id);
    addToast("success", `Opened "${session.name}".`);
  };

  const handleOpenTab = async (tabId: string) => {
    const tab = session.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }

    const opened = await openSavedTab(tab);
    if (!opened) {
      addToast("error", "That tab could not be opened.");
      return;
    }

    recordTabOpened(session.id, tabId);
    addToast("success", `Opened ${tab.title}.`);
  };

  const handleTabReminder = async (tabId: string, value: string) => {
    const reminderAt = value ? new Date(value).getTime() : null;
    updateTabReminder(session.id, tabId, reminderAt);

    if (!settings.remindersEnabled) {
      addToast("info", "Reminders are disabled in Settings.");
      return;
    }

    await chrome.alarms.clear(`reminder_${tabId}`);
    if (reminderAt && reminderAt > Date.now()) {
      chrome.alarms.create(`reminder_${tabId}`, { when: reminderAt });
      addToast("success", "Reminder scheduled.");
    } else {
      addToast("success", "Reminder cleared.");
    }
  };

  const handleAddActiveTab = async () => {
    const activeTab = await getPreferredBrowserTab();
    if (!activeTab?.url || isRestrictedUrl(activeTab.url)) {
      addToast("error", "The current active tab cannot be added.");
      return;
    }

    const added = addTabToSession(session.id, chromeTabToTabItem(activeTab));
    if (!added) {
      addToast("info", "That tab is already part of this session.");
      return;
    }

    addToast("success", `Added ${activeTab.title ?? "active tab"} to the session.`);
  };

  const resetScheduleEditor = () => {
    setEditingScheduleId(null);
    setScheduleDraft(defaultScheduleDraft(session.id));
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingScheduleId(schedule.id);
    setScheduleDraft(scheduleDraftFromSchedule(schedule));
  };

  const handleSaveSchedule = async () => {
    if (scheduleDraft.type === "once" && !scheduleDraft.date) {
      addToast("error", "Choose a date for one-time schedules.");
      return;
    }

    if (
      (scheduleDraft.type === "weekly" || scheduleDraft.type === "custom") &&
      scheduleDraft.daysOfWeek.length === 0
    ) {
      addToast("error", "Choose at least one day.");
      return;
    }

    if (editingScheduleId) {
      updateSchedule(editingScheduleId, scheduleDraft);
    } else {
      createSchedule(scheduleDraft);
    }

    await syncAlarms(settings.schedulesEnabled);
    addToast("success", editingScheduleId ? "Schedule updated." : "Schedule created.");
    resetScheduleEditor();
  };

  const handleDeleteSession = () => {
    if (settings.confirmBeforeDelete) {
      setShowDeleteConfirm(true);
      return;
    }

    deleteSession(session.id);
    onClose();
    addToast("success", `Deleted "${session.name}".`);
  };

  const nextSchedulePreview = useMemo(() => {
    if (scheduleDraft.type === "once" && scheduleDraft.date) {
      return `Next run: ${scheduleDraft.date} at ${scheduleDraft.time}`;
    }

    if (scheduleDraft.type === "weekdays") {
      return `Next run: weekdays at ${scheduleDraft.time}`;
    }

    if (scheduleDraft.type === "weekly" || scheduleDraft.type === "custom") {
      if (scheduleDraft.daysOfWeek.length === 0) {
        return "Choose one or more days to preview the run.";
      }

      const labels = scheduleDraft.daysOfWeek
        .map((day) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day])
        .join(", ");
      return `Next run: ${labels} at ${scheduleDraft.time}`;
    }

    return `Next run: every day at ${scheduleDraft.time}`;
  }, [scheduleDraft]);

  return (
    <aside
      style={{
        width: 430,
        borderLeft: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "22px 22px 16px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 24, lineHeight: 1.1 }}>{session.name}</h2>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              Created {formatDateTime(session.createdAt)} - Opened {formatDateTime(session.lastOpenedAt)}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close detail panel">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => void handleOpenSession()}>
            <ExternalLink size={15} />
            Open all
          </button>
          <button className="btn btn-secondary" onClick={() => void handleOpenSession(true)}>
            New window
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              duplicateSession(session.id);
              addToast("success", `Duplicated "${session.name}".`);
            }}
          >
            Duplicate
          </button>
          <button className="btn btn-secondary" onClick={() => setShowShareModal(true)}>
            <Share2 size={15} />
            Share
          </button>
          <button className="btn btn-secondary" onClick={() => void handleAddActiveTab()}>
            <Plus size={15} />
            Add active tab
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
        <section className="detail-section">
          <div className="detail-section-header">
            <h3>Session details</h3>
            <button className="btn btn-secondary" onClick={handleSaveDetails}>
              <Save size={14} />
              Save changes
            </button>
          </div>

          <div className="form-stack">
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div>
              <label className="label">Session notes</label>
              <textarea className="input" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div>
              <label className="label">Folder</label>
              <select className="input" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FolderOpen size={14} />
                Tags
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {tags.map((tag) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      className="tag-chip"
                      type="button"
                      data-active={active}
                      onClick={() => toggleTag(tag.id)}
                      style={{
                        borderColor: active ? tag.color : "var(--color-border)",
                        color: active ? tag.color : "var(--color-text-secondary)",
                        background: active ? `${tag.color}22` : "transparent",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-header">
            <div>
              <h3>Schedules</h3>
              {editingScheduleId ? (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
                  Editing an existing schedule.
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {editingScheduleId ? (
                <button className="btn btn-secondary" type="button" onClick={resetScheduleEditor}>
                  Cancel edit
                </button>
              ) : null}
              <span className="badge badge-subtle">
                <CalendarClock size={12} />
                {settings.schedulesEnabled ? "Enabled" : "Disabled globally"}
              </span>
            </div>
          </div>

          <div className="card-raised detail-card">
            <div className="form-stack">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label">Type</label>
                  <select
                    className="input"
                    value={scheduleDraft.type}
                    onChange={(event) =>
                      setScheduleDraft((current) => ({
                        ...current,
                        type: event.target.value as Schedule["type"],
                        daysOfWeek:
                          event.target.value === "weekdays"
                            ? [1, 2, 3, 4, 5]
                            : current.daysOfWeek,
                      }))
                    }
                  >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="custom">Custom days</option>
                  </select>
                </div>
                <div>
                  <label className="label">Time</label>
                  <input
                    className="input"
                    type="time"
                    value={scheduleDraft.time}
                    onChange={(event) => setScheduleDraft((current) => ({ ...current, time: event.target.value }))}
                  />
                </div>
              </div>

              {scheduleDraft.type === "once" ? (
                <div>
                  <label className="label">Date</label>
                  <input
                    className="input"
                    type="date"
                    value={scheduleDraft.date ?? ""}
                    onChange={(event) =>
                      setScheduleDraft((current) => ({ ...current, date: event.target.value || null }))
                    }
                  />
                </div>
              ) : null}

              {scheduleDraft.type === "weekly" || scheduleDraft.type === "custom" ? (
                <div>
                  <label className="label">Days</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {DAY_OPTIONS.map((day) => {
                      const active = scheduleDraft.daysOfWeek.includes(day.value);
                      return (
                        <button
                          key={`${scheduleDraft.type}-${day.value}`}
                          className="day-pill"
                          type="button"
                          data-active={active}
                          onClick={() =>
                            setScheduleDraft((current) => ({
                              ...current,
                              daysOfWeek: active
                                ? current.daysOfWeek.filter((value) => value !== day.value)
                                : [...current.daysOfWeek, day.value].sort(),
                            }))
                          }
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => void handleSaveSchedule()}
                  disabled={!settings.schedulesEnabled}
                >
                  <CalendarClock size={14} />
                  {editingScheduleId ? "Save schedule changes" : "Add schedule"}
                </button>
                {editingScheduleId ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={resetScheduleEditor}
                  >
                    Keep original
                  </button>
                ) : null}
              </div>

              <div className="detail-empty" style={{ padding: 12 }}>
                {nextSchedulePreview}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {sessionSchedules.length === 0 ? (
              <div className="detail-empty">No schedules yet for this session.</div>
            ) : null}
            {sessionSchedules.map((schedule) => (
              <div key={schedule.id} className="card-raised detail-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {formatScheduleLabel(schedule.type)} at {schedule.time}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      {schedule.type === "once" && schedule.date
                        ? `Runs on ${schedule.date}`
                        : "Runs in the browser with Chrome alarms."}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => handleEditSchedule(schedule)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => void toggleSchedule(schedule.id, !schedule.enabled)}
                    >
                      {schedule.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      type="button"
                      style={{ color: "var(--color-danger)" }}
                      onClick={() => {
                        deleteSchedule(schedule.id);
                        if (editingScheduleId === schedule.id) {
                          resetScheduleEditor();
                        }
                        addToast("success", "Schedule deleted.");
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-header">
            <h3>Export and share</h3>
            <span className="badge badge-subtle">No backend required</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => downloadMarkdown(session)}>
              <Link2 size={14} />
              Markdown
            </button>
            <button className="btn btn-secondary" onClick={() => downloadPlainText(session)}>
              <ClipboardCopy size={14} />
              Plain text
            </button>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                await copyTextToClipboard(copyLinksToClipboard(session));
                addToast("success", "Copied all session links.");
              }}
            >
              <ClipboardCopy size={14} />
              Copy links
            </button>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                await copyTextToClipboard(generateAIPrompt(session));
                addToast("success", "Copied the AI-ready prompt.");
              }}
            >
              <Sparkles size={14} />
              AI prompt
            </button>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-header">
            <h3>Saved tabs</h3>
            <span className="badge badge-subtle">{session.tabs.length} total</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {session.tabs.map((tab) => (
              <div key={tab.id} className="card-raised detail-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      className="favicon"
                      alt=""
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="favicon favicon-fallback" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{tab.title}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      {getDomainLabel(tab.url)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                      Opened {formatDateTime(tab.lastOpenedAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary" onClick={() => void handleOpenTab(tab.id)}>
                      Open
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ color: "var(--color-danger)" }}
                      onClick={() => removeTabFromSession(session.id, tab.id)}
                      title="Remove tab from session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="label">Tab note</label>
                  <textarea
                    className="input"
                    value={tabDraftNotes[tab.id] ?? ""}
                    onChange={(event) =>
                      setTabDraftNotes((current) => ({ ...current, [tab.id]: event.target.value }))
                    }
                    onBlur={() => updateTabNote(session.id, tab.id, tabDraftNotes[tab.id] ?? "")}
                    placeholder="Add context for this link"
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Bell size={14} />
                    Reminder
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      type="datetime-local"
                      value={toDateTimeInputValue(tab.reminderAt)}
                      onChange={(event) => void handleTabReminder(tab.id, event.target.value)}
                    />
                    {tab.reminderAt ? (
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => void handleTabReminder(tab.id, "")}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-header">
            <h3>Danger zone</h3>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                updateSession(session.id, { isArchived: !session.isArchived });
                addToast("success", session.isArchived ? "Session restored." : "Session archived.");
              }}
            >
              {session.isArchived ? "Restore session" : "Archive session"}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteSession}>
              <Trash2 size={14} />
              Delete session
            </button>
          </div>
        </section>
      </div>

      {showDeleteConfirm ? (
        <ConfirmDialog
          title="Delete session?"
          message={`"${session.name}" will be removed from TabSetu.`}
          confirmLabel="Delete session"
          danger
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            deleteSession(session.id);
            setShowDeleteConfirm(false);
            onClose();
            addToast("success", `Deleted "${session.name}".`);
          }}
        />
      ) : null}

      {showShareModal ? (
        <ShareSessionModal
          session={session}
          onClose={() => setShowShareModal(false)}
          addToast={addToast}
        />
      ) : null}
    </aside>
  );
}
