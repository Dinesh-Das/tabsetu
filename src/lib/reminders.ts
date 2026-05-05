const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PAST_REMINDER_WINDOW_DAYS = 30;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function oneHourFromNow(now = Date.now()): number {
  return now + 60 * 60 * 1000;
}

export function tomorrowAtNine(now = Date.now()): number {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

export function formatReminderDate(timestamp: number, now = Date.now()): string {
  const todayStart = startOfDay(now);
  const reminderStart = startOfDay(timestamp);
  const dayDelta = Math.round((reminderStart - todayStart) / ONE_DAY_MS);

  if (dayDelta === 0) {
    return `Today ${formatClock(timestamp)}`;
  }

  if (dayDelta === 1) {
    return `Tomorrow ${formatClock(timestamp)}`;
  }

  if (dayDelta > 1 && dayDelta < 7) {
    const weekday = new Date(timestamp).toLocaleDateString([], { weekday: "short" });
    return `${weekday} ${formatClock(timestamp)}`;
  }

  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isReminderPast(timestamp: number, now = Date.now()): boolean {
  return timestamp < now;
}

export function isReminderInPastWindow(timestamp: number, now = Date.now()): boolean {
  return timestamp >= now - PAST_REMINDER_WINDOW_DAYS * ONE_DAY_MS;
}
