import { chrome as mockedChrome } from "vitest-chrome/lib/index.esm.js";
import { beforeEach, vi } from "vitest";

globalThis.chrome = mockedChrome;

// Stub chrome.storage.local/sync with in-memory maps
const localStore: Record<string, unknown> = {};
const syncStore: Record<string, unknown> = {};

type Mockable<T> = {
  mockImplementation: (implementation: T) => void;
};

function mockImplementation<T>(target: unknown, implementation: T): void {
  (target as Mockable<T>).mockImplementation(implementation);
}

function mockStorageArea(area: chrome.storage.StorageArea, store: Record<string, unknown>): void {
  vi.mocked(area.get).mockImplementation((keys, cb) => {
    if (typeof keys === "string") cb?.({ [keys]: store[keys] });
    else if (Array.isArray(keys)) cb?.(Object.fromEntries(keys.map((k) => [k, store[k]])));
    else cb?.({ ...store });
  });

  vi.mocked(area.set).mockImplementation((items, cb) => {
    Object.assign(store, items);
    cb?.();
  });

  vi.mocked(area.remove).mockImplementation((keys, cb) => {
    (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
    cb?.();
  });

  vi.mocked(area.getBytesInUse).mockImplementation((_keys, cb) => cb?.(0));
}

mockStorageArea(chrome.storage.local, localStore);
mockStorageArea(chrome.storage.sync, syncStore);

// Stub chrome.runtime
vi.mocked(chrome.runtime.sendMessage).mockImplementation(() => Promise.resolve());
vi.mocked(chrome.runtime.getURL).mockImplementation((path) => `chrome-extension://test/${path}`);

// Stub chrome.alarms
vi.mocked(chrome.alarms.create).mockImplementation(() => {});
mockImplementation(
  chrome.alarms.clear,
  (_name: string | undefined, cb: ((wasCleared: boolean) => void) | undefined) => cb?.(true)
);
mockImplementation(
  chrome.alarms.getAll,
  (cb: ((alarms: chrome.alarms.Alarm[]) => void) | undefined) => cb?.([])
);

// Stub chrome.tabs
mockImplementation(
  chrome.tabs.query,
  (_opts: chrome.tabs.QueryInfo, cb: ((result: chrome.tabs.Tab[]) => void) | undefined) => cb?.([])
);
vi.mocked(chrome.tabs.create).mockImplementation((opts) => Promise.resolve({ id: 1, ...opts }));

// Reset store between tests
beforeEach(() => {
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  Object.keys(syncStore).forEach((k) => delete syncStore[k]);
});
