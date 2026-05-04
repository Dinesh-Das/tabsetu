import { create } from "zustand";
import type { Schedule } from "@/types";
import { loadStorage, saveSchedules } from "@/lib/storage";
import { generateId } from "@/lib/tabHelpers";

function alarmName(scheduleId: string): string {
  return `tabnest-alarm-${scheduleId}`;
}

function getNextTriggerMinutes(schedule: Schedule): number {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(":").map(Number);

  if (schedule.type === "once" && schedule.date) {
    const target = new Date(`${schedule.date}T${schedule.time}:00`);
    return Math.max((target.getTime() - now.getTime()) / 60000, 1);
  }

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return Math.max((next.getTime() - now.getTime()) / 60000, 1);
}

function registerAlarm(schedule: Schedule): void {
  if (!schedule.enabled) {
    return;
  }

  const recurring = schedule.type !== "once";

  chrome.alarms.create(alarmName(schedule.id), {
    delayInMinutes: getNextTriggerMinutes(schedule),
    ...(recurring ? { periodInMinutes: 24 * 60 } : {}),
  });
}

async function replaceBrowserAlarms(schedules: Schedule[], schedulesEnabled: boolean): Promise<void> {
  await chrome.alarms.clearAll();

  if (!schedulesEnabled) {
    return;
  }

  schedules.filter((schedule) => schedule.enabled).forEach(registerAlarm);
}

interface ScheduleState {
  schedules: Schedule[];
  load: () => Promise<void>;
  createSchedule: (schedule: Omit<Schedule, "id" | "createdAt" | "updatedAt">) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string, enabled: boolean) => void;
  importSchedules: (schedules: Schedule[]) => void;
  syncAlarms: (schedulesEnabled: boolean) => Promise<void>;
}

function persistSchedules(schedules: Schedule[]): void {
  void saveSchedules(schedules);
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],

  load: async () => {
    const data = await loadStorage();
    set({ schedules: data.schedules });
  },

  createSchedule: (partial) => {
    const createdAt = Date.now();
    const schedule: Schedule = {
      ...partial,
      id: generateId("schedule"),
      createdAt,
      updatedAt: createdAt,
    };
    const schedules = [...get().schedules, schedule];
    set({ schedules });
    persistSchedules(schedules);
    registerAlarm(schedule);
  },

  updateSchedule: (id, updates) => {
    const schedules = get().schedules.map((schedule) => {
      if (schedule.id !== id) {
        return schedule;
      }

      const updated = {
        ...schedule,
        ...updates,
        updatedAt: Date.now(),
      };
      void chrome.alarms.clear(alarmName(schedule.id));
      registerAlarm(updated);
      return updated;
    });
    set({ schedules });
    persistSchedules(schedules);
  },

  deleteSchedule: (id) => {
    const target = get().schedules.find((schedule) => schedule.id === id);
    if (target) {
      void chrome.alarms.clear(alarmName(target.id));
    }

    const schedules = get().schedules.filter((schedule) => schedule.id !== id);
    set({ schedules });
    persistSchedules(schedules);
  },

  toggleSchedule: (id, enabled) => {
    const schedules = get().schedules.map((schedule) => {
      if (schedule.id !== id) {
        return schedule;
      }

      const updated = {
        ...schedule,
        enabled,
        updatedAt: Date.now(),
      };
      void chrome.alarms.clear(alarmName(schedule.id));
      if (enabled) {
        registerAlarm(updated);
      }
      return updated;
    });
    set({ schedules });
    persistSchedules(schedules);
  },

  importSchedules: (schedules) => {
    set({ schedules });
    persistSchedules(schedules);
  },

  syncAlarms: async (schedulesEnabled) => {
    await replaceBrowserAlarms(get().schedules, schedulesEnabled);
  },
}));
