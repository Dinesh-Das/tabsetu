import type { ScheduleType } from "@/types";
import { isValidUrl } from "@/lib/tabHelpers";

export interface ScheduleDraft {
  sessionId: string;
  url: string;
  type: Extract<ScheduleType, "once" | "daily" | "weekly" | "weekdays">;
  date: string;
  time: string;
  daysOfWeek: number[];
}

export interface NormalizedScheduleDraft {
  sessionId: string;
  url: string;
  type: ScheduleDraft["type"];
  date: string | null;
  time: string;
  daysOfWeek: number[];
}

export function normalizeScheduleUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function normalizeScheduleDraft(
  draft: ScheduleDraft,
): { ok: true; value: NormalizedScheduleDraft } | { ok: false; error: string } {
  const normalizedUrl = normalizeScheduleUrl(draft.url);

  if (!draft.sessionId && !normalizedUrl) {
    return { ok: false, error: "Choose a saved session or enter a URL." };
  }

  if (normalizedUrl && !isValidUrl(normalizedUrl)) {
    return { ok: false, error: "Enter a valid http or https URL." };
  }

  if (!/^\d{2}:\d{2}$/.test(draft.time)) {
    return { ok: false, error: "Choose a valid time." };
  }

  if (draft.type === "once" && !draft.date) {
    return { ok: false, error: "Choose a date for a one-time schedule." };
  }

  const today = new Date().getDay();
  const daysOfWeek =
    draft.type === "weekly" || draft.type === "weekdays"
      ? Array.from(new Set(draft.daysOfWeek.length ? draft.daysOfWeek : [today])).sort()
      : [];

  return {
    ok: true,
    value: {
      sessionId: draft.sessionId,
      url: normalizedUrl,
      type: draft.type,
      date: draft.type === "once" ? draft.date : null,
      time: draft.time,
      daysOfWeek,
    },
  };
}
