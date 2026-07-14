import type { Session } from "@/types";

export async function reconcileReminderAlarms(
  sessions: Session[],
  remindersEnabled: boolean
): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => alarm.name.startsWith("reminder_"))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );

  if (!remindersEnabled) {
    return;
  }

  const reminders = sessions.flatMap((session) =>
    session.tabs.flatMap((tab) => {
      const dueAt = tab.reminderSnoozedUntil ?? tab.reminderAt;
      return dueAt && !tab.reminderDismissed ? [{ tabId: tab.id, dueAt }] : [];
    })
  );

  await Promise.all(
    reminders.map(({ tabId, dueAt }) =>
      chrome.alarms.create(`reminder_${tabId}`, {
        when: Math.max(dueAt, Date.now() + 1000),
      })
    )
  );
}
