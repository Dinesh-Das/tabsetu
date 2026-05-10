import { useMemo, useState } from "react";
import { CalendarDays, Clock3, Edit3, Power, Trash2 } from "lucide-react";
import MobileConfirmSheet from "@/components/mobile/MobileConfirmSheet";
import {
  BottomSheet,
  EmptyState,
  GlassCard,
  MobileIconButton,
  SegmentedControl,
} from "@/components/mobile/MobileUI";
import { formatDateTime, formatScheduleLabel } from "@/lib/format";
import { normalizeScheduleDraft, type ScheduleDraft } from "@/lib/scheduleDraft";
import { generateId, sanitizeLabel } from "@/lib/tabHelpers";
import type { Schedule, ScheduleType, TabItem, ToastMessage } from "@/types";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
}

type MobileScheduleType = Extract<ScheduleType, "once" | "daily" | "weekly" | "weekdays">;

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeInputValue(): string {
  return new Date().toTimeString().slice(0, 5);
}

function createTabFromUrl(url: string): TabItem {
  const now = Date.now();
  const parsed = new URL(url);

  return {
    id: generateId("tab"),
    title: sanitizeLabel(parsed.hostname.replace(/^www\./, ""), "Scheduled URL", 100),
    url,
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 0,
    openCount: 0,
    createdAt: now,
    lastOpenedAt: null,
  };
}

function previewSchedule(draft: ScheduleDraft): string {
  const label = formatScheduleLabel(draft.type);
  if (draft.type === "once") {
    return `Next run: ${draft.date || "Select date"} at ${draft.time}`;
  }

  if (draft.type === "weekly") {
    const days = draft.daysOfWeek.length ? draft.daysOfWeek.length : 1;
    return `Next run: ${label}, ${days} selected day${days === 1 ? "" : "s"} at ${draft.time}`;
  }

  return `Next run: ${label} at ${draft.time}`;
}

interface ScheduleEditorProps {
  schedule: Schedule | null;
  addToast: Props["addToast"];
  onClose: () => void;
  variant?: "sheet" | "inline";
}

function ScheduleEditor({ schedule, addToast, onClose, variant = "sheet" }: ScheduleEditorProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const createSession = useSessionStore((state) => state.createSession);
  const createSchedule = useScheduleStore((state) => state.createSchedule);
  const updateSchedule = useScheduleStore((state) => state.updateSchedule);

  const [draft, setDraft] = useState<ScheduleDraft>({
    sessionId: schedule?.sessionId ?? "",
    url: "",
    type: schedule?.type === "custom" ? "weekly" : (schedule?.type ?? "once"),
    date: schedule?.date ?? todayInputValue(),
    time: schedule?.time ?? currentTimeInputValue(),
    daysOfWeek: schedule?.daysOfWeek.length ? schedule.daysOfWeek : [new Date().getDay()],
  });

  const updateDraft = (updates: Partial<ScheduleDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const handleSubmit = () => {
    const normalized = normalizeScheduleDraft(draft);
    if (!normalized.ok) {
      addToast("error", normalized.error);
      return;
    }

    let sessionId = normalized.value.sessionId;
    if (!sessionId && normalized.value.url) {
      const tab = createTabFromUrl(normalized.value.url);
      const session = createSession(tab.title, "Created from schedule URL.", [tab], null, []);
      sessionId = session.id;
    }

    if (schedule) {
      updateSchedule(schedule.id, {
        sessionId,
        type: normalized.value.type,
        date: normalized.value.date,
        time: normalized.value.time,
        daysOfWeek: normalized.value.daysOfWeek,
      });
      addToast("success", "Schedule updated.");
    } else {
      createSchedule({
        sessionId,
        type: normalized.value.type,
        date: normalized.value.date,
        time: normalized.value.time,
        daysOfWeek: normalized.value.daysOfWeek,
        enabled: true,
      });
      addToast("success", "Schedule created.");
    }

    onClose();
  };

  const form = (
    <div className="mobile-form-stack">
      <div className="mobile-field">
        <label htmlFor="schedule-url">URL</label>
        <input
          id="schedule-url"
          className="mobile-input"
          value={draft.url}
          onChange={(event) => updateDraft({ url: event.target.value, sessionId: "" })}
          placeholder="https://example.com"
        />
      </div>

      <div className="mobile-field">
        <label htmlFor="schedule-session">Or saved session</label>
        <select
          id="schedule-session"
          className="mobile-select"
          value={draft.sessionId}
          onChange={(event) => updateDraft({ sessionId: event.target.value, url: "" })}
        >
          <option value="">Select session</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mobile-field">
        <label>Type</label>
        <SegmentedControl<MobileScheduleType>
          value={draft.type}
          onChange={(type) =>
            updateDraft({
              type,
              daysOfWeek: type === "weekdays" ? [1, 2, 3, 4, 5] : draft.daysOfWeek,
            })
          }
          options={[
            { value: "once", label: "Once" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "weekdays", label: "Weekdays" },
          ]}
        />
      </div>

      <div className="schedule-date-grid">
        <div className="mobile-field">
          <label htmlFor="schedule-date">Date</label>
          <input
            id="schedule-date"
            className="mobile-input"
            type="date"
            value={draft.date}
            disabled={draft.type !== "once"}
            onChange={(event) => updateDraft({ date: event.target.value })}
          />
        </div>
        <div className="mobile-field">
          <label htmlFor="schedule-time">Time</label>
          <input
            id="schedule-time"
            className="mobile-input"
            type="time"
            value={draft.time}
            onChange={(event) => updateDraft({ time: event.target.value })}
          />
        </div>
      </div>

      {draft.type === "weekly" || draft.type === "weekdays" ? (
        <div className="schedule-days">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
            <button
              key={day}
              type="button"
              data-active={draft.daysOfWeek.includes(index) || undefined}
              onClick={() => {
                const nextDays = draft.daysOfWeek.includes(index)
                  ? draft.daysOfWeek.filter((dayIndex) => dayIndex !== index)
                  : [...draft.daysOfWeek, index];
                updateDraft({ daysOfWeek: nextDays });
              }}
            >
              {day}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const submitButton = (
    <button
      className="mobile-primary-button save-sheet-primary"
      type="button"
      onClick={handleSubmit}
    >
      {schedule ? "Save Schedule" : "Create Schedule"}
    </button>
  );

  if (variant === "inline") {
    return (
      <GlassCard className="mobile-card-padded schedule-create-card">
        <h2>Create Schedule</h2>
        <p>{previewSchedule(draft)}</p>
        {form}
        {submitButton}
      </GlassCard>
    );
  }

  return (
    <BottomSheet
      title={schedule ? "Edit schedule" : "Create schedule"}
      subtitle={previewSchedule(draft)}
      onClose={onClose}
      footer={submitButton}
    >
      {form}
    </BottomSheet>
  );
}

export default function MobileSchedulesScreen({ addToast }: Props) {
  const schedules = useScheduleStore((state) => state.schedules);
  const deleteSchedule = useScheduleStore((state) => state.deleteSchedule);
  const toggleSchedule = useScheduleStore((state) => state.toggleSchedule);
  const sessions = useSessionStore((state) => state.sessions);
  const [editorSchedule, setEditorSchedule] = useState<Schedule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Schedule | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);

  const sessionMap = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions]
  );

  return (
    <>
      <ScheduleEditor
        key={createFormKey}
        schedule={null}
        addToast={addToast}
        variant="inline"
        onClose={() => setCreateFormKey((key) => key + 1)}
      />

      <div className="mobile-list schedule-list">
        {schedules.length === 0 ? (
          <EmptyState
            icon={<Clock3 size={52} />}
            title="No Schedules Yet"
            description="Create your first schedule to automate your tabs."
            compact
          />
        ) : null}

        {schedules.map((schedule) => {
          const session = sessionMap.get(schedule.sessionId);
          return (
            <GlassCard className="schedule-row-card mobile-card-padded" key={schedule.id}>
              <div className="schedule-row-main">
                <div className="schedule-row-icon">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <strong>{session?.name ?? "Missing session"}</strong>
                  <span>
                    {formatScheduleLabel(schedule.type)} at {schedule.time}
                    {schedule.date ? ` - ${schedule.date}` : ""}
                  </span>
                  <small>Last run: {formatDateTime(schedule.lastFiredAt)}</small>
                </div>
              </div>
              <div className="schedule-row-actions">
                <MobileIconButton
                  title={schedule.enabled ? "Disable schedule" : "Enable schedule"}
                  active={schedule.enabled}
                  onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                >
                  <Power size={17} />
                </MobileIconButton>
                <MobileIconButton title="Edit schedule" onClick={() => setEditorSchedule(schedule)}>
                  <Edit3 size={17} />
                </MobileIconButton>
                <MobileIconButton
                  title="Delete schedule"
                  danger
                  onClick={() => setPendingDelete(schedule)}
                >
                  <Trash2 size={17} />
                </MobileIconButton>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {editorSchedule ? (
        <ScheduleEditor
          schedule={editorSchedule}
          addToast={addToast}
          onClose={() => setEditorSchedule(null)}
        />
      ) : null}

      {pendingDelete ? (
        <MobileConfirmSheet
          title="Delete schedule?"
          message="This automation will stop, but the saved session remains."
          confirmLabel="Delete"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteSchedule(pendingDelete.id);
            addToast("success", "Schedule deleted.");
            setPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}
