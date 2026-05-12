import { chrome as mockedChrome } from "vitest-chrome/lib/index.esm.js";
import { beforeEach, vi } from "vitest";

globalThis.chrome = mockedChrome;

// Stub chrome.storage.local/sync with in-memory maps
const localStore: Record<string, unknown> = {};
const syncStore: Record<string, unknown> = {};

type Mockable<T> = {
  mockImplementation: (implementation: T) => void;
};

type StorageGetKeys = string | string[] | Record<string, unknown> | null | undefined;
type StorageItems = Record<string, unknown>;

function mockStorageArea(area: chrome.storage.StorageArea, store: Record<string, unknown>): void {
  const mockedArea = area as unknown as {
    get: Mockable<(keys: StorageGetKeys, cb?: (items: StorageItems) => void) => void>;
    set: Mockable<(items: StorageItems, cb?: () => void) => void>;
    remove: Mockable<(keys: string | string[], cb?: () => void) => void>;
    getBytesInUse: Mockable<
      (keys: string | string[] | null, cb?: (bytesInUse: number) => void) => void
    >;
  };

  mockedArea.get.mockImplementation((keys, cb) => {
    if (typeof keys === "string") cb?.({ [keys]: store[keys] });
    else if (Array.isArray(keys)) cb?.(Object.fromEntries(keys.map((k) => [k, store[k]])));
    else cb?.({ ...store });
  });

  mockedArea.set.mockImplementation((items, cb) => {
    Object.assign(store, items);
    cb?.();
  });

  mockedArea.remove.mockImplementation((keys, cb) => {
    (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
    cb?.();
  });

  mockedArea.getBytesInUse.mockImplementation((_keys, cb) => cb?.(0));
}

mockStorageArea(chrome.storage.local, localStore);
mockStorageArea(chrome.storage.sync, syncStore);

// Stub chrome.runtime
vi.mocked(chrome.runtime.sendMessage).mockImplementation(() => Promise.resolve());
vi.mocked(chrome.runtime.getURL).mockImplementation((path) => `chrome-extension://test/${path}`);

// Stub chrome.alarms
vi.mocked(chrome.alarms.create).mockImplementation(() => {});
const mockedAlarms = chrome.alarms as unknown as {
  clear: Mockable<(name?: string, cb?: (wasCleared: boolean) => void) => void>;
  getAll: Mockable<(cb?: (alarms: chrome.alarms.Alarm[]) => void) => void>;
};
mockedAlarms.clear.mockImplementation((_name, cb) => cb?.(true));
mockedAlarms.getAll.mockImplementation((cb) => cb?.([]));

// Stub chrome.tabs
const mockedTabs = chrome.tabs as unknown as {
  query: Mockable<(opts: chrome.tabs.QueryInfo, cb?: (result: chrome.tabs.Tab[]) => void) => void>;
  create: Mockable<(opts: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>>;
};
mockedTabs.query.mockImplementation((_opts, cb) => cb?.([]));
mockedTabs.create.mockImplementation((opts) =>
  Promise.resolve({
    ...opts,
    active: Boolean(opts.active),
    autoDiscardable: true,
    discarded: false,
    groupId: -1,
    highlighted: Boolean(opts.active),
    id: 1,
    incognito: false,
    index: opts.index ?? 0,
    pinned: opts.pinned ?? false,
    selected: opts.selected ?? Boolean(opts.active),
    windowId: opts.windowId ?? 1,
  })
);

// Reset store between tests
beforeEach(() => {
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  Object.keys(syncStore).forEach((k) => delete syncStore[k]);
});
