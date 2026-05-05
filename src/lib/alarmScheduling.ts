import type { Schedule } from "@/types";

interface ParsedScheduleTime {
  hours: number;
  minutes: number;
}

function parseScheduleTime(time: string): ParsedScheduleTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
}

function createLocalDate(date: string, time: ParsedScheduleTime): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const candidate = new Date(year, monthIndex, day, time.hours, time.minutes, 0, 0);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== monthIndex ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return candidate;
}

function allowedScheduleDays(schedule: Schedule): Set<number> | null | undefined {
  if (schedule.type === "weekdays") {
    return new Set([1, 2, 3, 4, 5]);
  }

  if (schedule.type === "weekly" || schedule.type === "custom") {
    const days = schedule.daysOfWeek.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    if (days.length === 0) {
      return null;
    }

    return new Set(days);
  }

  return undefined;
}

export function nextMatchingDate(schedule: Schedule, from = new Date()): Date | null {
  const time = parseScheduleTime(schedule.time);
  if (!time) {
    return null;
  }

  if (schedule.type === "once") {
    if (!schedule.date) {
      return null;
    }

    const candidate = createLocalDate(schedule.date, time);
    return candidate && candidate > from ? candidate : null;
  }

  const candidate = new Date(from);
  candidate.setHours(time.hours, time.minutes, 0, 0);
  if (candidate <= from) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(time.hours, time.minutes, 0, 0);
  }

  const allowedDays = allowedScheduleDays(schedule);
  if (allowedDays === null) {
    return null;
  }

  if (allowedDays === undefined) {
    return candidate;
  }

  for (let daysChecked = 0; daysChecked < 7; daysChecked += 1) {
    if (allowedDays.has(candidate.getDay())) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(time.hours, time.minutes, 0, 0);
  }

  return null;
}
