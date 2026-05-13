import { create } from "zustand";
import type { Schedule } from "@/types";
import { nextMatchingDate } from "@/lib/alarmScheduling";
import { loadStorage, saveSchedules } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { generateId } from "@/lib/tabHelpers";

function alarmName(scheduleId: string): string {
  return `schedule_${scheduleId}`;
}

async function syncScheduleAlarm(schedule: Schedule): Promise<void> {
  const name = alarmName(schedule.id);
  await chrome.alarms.clear(name);

  if (!schedule.enabled) {
    return;
  }

  const next = nextMatchingDate(schedule);
  if (!next) {
    return;
  }

  await chrome.alarms.create(name, {
    when: Math.max(next.getTime(), Date.now() + 1000),
  });
}

async function replaceBrowserAlarms(
  schedules: Schedule[],
  schedulesEnabled: boolean
): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => alarm.name.startsWith("schedule_"))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );

  if (!schedulesEnabled) {
    return;
  }

  await Promise.all(schedules.map(syncScheduleAlarm));
}

interface ScheduleState {
  schedules: Schedule[];
  load: () => Promise<void>;
  createSchedule: (
    schedule: Omit<Schedule, "id" | "createdAt" | "updatedAt" | "lastFiredAt">
  ) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string, enabled: boolean) => void;
  importSchedules: (schedules: Schedule[]) => void;
  syncAlarms: (schedulesEnabled: boolean) => Promise<void>;
}

let writePromise: Promise<void> = Promise.resolve();

function persistSchedules(schedules: Schedule[]): void {
  writePromise = writePromise.then(() => saveSchedules(schedules));
  void writePromise;
}

function activeSchedules(schedules: Schedule[]): Schedule[] {
  return schedules.filter((schedule) => schedule.deletedAt == null);
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],

  load: async () => {
    const data = await loadStorage();
    set({ schedules: activeSchedules(data.schedules) });
    useHydrationStore.getState().markOneHydrated();
  },

  createSchedule: (partial) => {
    const createdAt = Date.now();
    const schedule: Schedule = {
      ...partial,
      id: generateId("schedule"),
      lastFiredAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const schedules = [...get().schedules, schedule];
    set({ schedules });
    persistSchedules(schedules);
    void syncScheduleAlarm(schedule);
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
      void syncScheduleAlarm(updated);
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

    const deletedAt = Date.now();
    const schedules = get().schedules.filter((schedule) => schedule.id !== id);
    set({ schedules });
    persistSchedules([
      ...schedules,
      ...(target ? [{ ...target, deletedAt, updatedAt: deletedAt }] : []),
    ]);
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
      void syncScheduleAlarm(updated);
      return updated;
    });
    set({ schedules });
    persistSchedules(schedules);
  },

  importSchedules: (schedules) => {
    set({ schedules: activeSchedules(schedules) });
  },

  syncAlarms: async (schedulesEnabled) => {
    await replaceBrowserAlarms(activeSchedules(get().schedules), schedulesEnabled);
  },
}));
