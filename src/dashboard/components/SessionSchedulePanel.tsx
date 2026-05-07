import { useMemo, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import type { Schedule, ToastMessage } from "@/types";
import { formatScheduleLabel } from "@/lib/format";

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
    type: "daily",
    time: "09:00",
    daysOfWeek: [1],
    date: null,
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

interface Props {
  sessionId: string;
  schedules: Schedule[];
  schedulesEnabled: boolean;
  createSchedule: (schedule: ScheduleDraft) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string, enabled: boolean) => void;
  syncAlarms: (schedulesEnabled: boolean) => Promise<void>;
  addToast: (type: ToastMessage["type"], message: string) => void;
}

export default function SessionSchedulePanel({
  sessionId,
  schedules,
  schedulesEnabled,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  syncAlarms,
  addToast,
}: Props) {
  const [scheduleDraft, setScheduleDraft] = useState(defaultScheduleDraft(sessionId));
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const sessionSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.sessionId === sessionId),
    [schedules, sessionId],
  );

  const resetScheduleEditor = () => {
    setEditingScheduleId(null);
    setScheduleDraft(defaultScheduleDraft(sessionId));
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

    if ((scheduleDraft.type === "weekly" || scheduleDraft.type === "custom") && scheduleDraft.daysOfWeek.length === 0) {
      addToast("error", "Choose at least one day.");
      return;
    }

    if (editingScheduleId) {
      updateSchedule(editingScheduleId, scheduleDraft);
    } else {
      createSchedule(scheduleDraft);
    }

    await syncAlarms(schedulesEnabled);
    addToast("success", editingScheduleId ? "Schedule updated." : "Schedule created.");
    resetScheduleEditor();
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
            {schedulesEnabled ? "Enabled" : "Disabled globally"}
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
                    daysOfWeek: event.target.value === "weekdays" ? [1, 2, 3, 4, 5] : current.daysOfWeek,
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
                onChange={(event) => setScheduleDraft((current) => ({ ...current, date: event.target.value || null }))}
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
            <button className="btn btn-primary" type="button" onClick={() => void handleSaveSchedule()} disabled={!schedulesEnabled}>
              <CalendarClock size={14} />
              {editingScheduleId ? "Save schedule changes" : "Add schedule"}
            </button>
            {editingScheduleId ? (
              <button className="btn btn-secondary" type="button" onClick={resetScheduleEditor}>
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
        {sessionSchedules.length === 0 ? <div className="detail-empty">No schedules yet for this session.</div> : null}
        {sessionSchedules.map((schedule) => (
          <div key={schedule.id} className="card-raised detail-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {formatScheduleLabel(schedule.type)} at {schedule.time}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  {schedule.type === "once" && schedule.date ? `Runs on ${schedule.date}` : "Runs in the browser with Chrome alarms."}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" type="button" onClick={() => handleEditSchedule(schedule)}>
                  Edit
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => void toggleSchedule(schedule.id, !schedule.enabled)}>
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
  );
}
