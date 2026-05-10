import { useState } from "react";
import { Bell } from "lucide-react";
import type { Session, ToastMessage } from "@/types";
import { formatReminderDate, oneHourFromNow, tomorrowAtNine } from "@/lib/reminders";

function toDateTimeInputValue(value: number | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

interface ReminderPickerProps {
  tab: Session["tabs"][number];
  onSet: (reminderAt: number) => void;
  onClear: () => void;
}

export function ReminderPicker({ tab, onSet, onClear }: ReminderPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const activeReminderAt = tab.reminderSnoozedUntil ?? tab.reminderAt;

  return (
    <div className="reminder-picker" role="group" aria-label={`Reminder for ${tab.title}`}>
      {!activeReminderAt ? (
        <div className="reminder-chips">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => onSet(oneHourFromNow())}
          >
            In 1 hour
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => onSet(tomorrowAtNine())}
          >
            Tomorrow 9 AM
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setShowPicker(true)}>
            Pick date...
          </button>
        </div>
      ) : (
        <div className="reminder-set">
          <span className="badge badge-subtle">
            <Bell size={12} />
            {formatReminderDate(activeReminderAt)}
          </span>
          <button className="btn btn-secondary" type="button" onClick={onClear}>
            Clear
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setShowPicker(true)}>
            Change
          </button>
        </div>
      )}
      {showPicker ? (
        <input
          className="input"
          type="datetime-local"
          autoFocus
          min={toDateTimeInputValue(Date.now())}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }

            const timestamp = new Date(event.target.value).getTime();
            if (Number.isFinite(timestamp)) {
              onSet(timestamp);
              setShowPicker(false);
            }
          }}
          onBlur={() => setShowPicker(false)}
          aria-label="Pick reminder date and time"
        />
      ) : null}
    </div>
  );
}

interface SessionReminderPanelProps {
  session: Session;
  updateTabReminder: (sessionId: string, tabId: string, reminderAt: number | null) => void;
  remindersEnabled: boolean;
  addToast: (type: ToastMessage["type"], message: string) => void;
}

export default function SessionReminderPanel({
  session,
  updateTabReminder,
  remindersEnabled,
  addToast,
}: SessionReminderPanelProps) {
  const setTabReminderAt = async (tabId: string, reminderAt: number | null) => {
    if (reminderAt !== null && reminderAt <= Date.now()) {
      addToast("error", "Choose a future time for reminders.");
      return;
    }

    updateTabReminder(session.id, tabId, reminderAt);
    await chrome.alarms.clear(`reminder_${tabId}`);

    if (reminderAt === null) {
      addToast("success", "Reminder cleared.");
      return;
    }

    if (!remindersEnabled) {
      addToast("info", "Reminders are disabled in Settings.");
      return;
    }

    await chrome.alarms.create(`reminder_${tabId}`, { when: reminderAt });
    addToast("success", "Reminder scheduled.");
  };

  return (
    <>
      {session.tabs.map((tab) => (
        <ReminderPicker
          key={tab.id}
          tab={tab}
          onSet={(reminderAt) => void setTabReminderAt(tab.id, reminderAt)}
          onClear={() => void setTabReminderAt(tab.id, null)}
        />
      ))}
    </>
  );
}
