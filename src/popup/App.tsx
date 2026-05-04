import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Layers } from "lucide-react";
import type { ToastMessage, UndoCollapseBuffer } from "@/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { loadUndoBuffer, saveUndoBuffer } from "@/lib/storage";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import CurrentTabs from "./components/CurrentTabs";
import SaveModal from "./components/SaveModal";
import SavedSessions from "./components/SavedSessions";
import SearchBar from "./components/SearchBar";
import Toast from "./components/Toast";

type PopupView = "sessions" | "current";
type SaveMode = "save" | "collapse";

interface SaveModalState {
  mode: SaveMode;
  selectedTabIds: number[];
}

export default function PopupApp() {
  const loadSessions = useSessionStore((state) => state.load);
  const loadFolders = useFolderStore((state) => state.load);
  const loadTags = useTagStore((state) => state.load);
  const loadSettings = useSettingsStore((state) => state.load);
  const settings = useSettingsStore((state) => state.settings);

  const [view, setView] = useState<PopupView>("sessions");
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
  const [saveModalState, setSaveModalState] = useState<SaveModalState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 150);

  useEffect(() => {
    void Promise.all([loadSessions(), loadFolders(), loadTags(), loadSettings()]);
  }, [loadFolders, loadSessions, loadSettings, loadTags]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") {
      root.className = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      return;
    }

    root.className = settings.theme;
  }, [settings.theme]);

  const addToast = (
    type: ToastMessage["type"],
    message: string,
    options?: Partial<ToastMessage>,
  ) => {
    const id = options?.id ?? `toast-${Date.now()}`;
    const toast: ToastMessage = { id, type, message, ...options };
    setToasts((current) => [...current, toast]);
    if (!toast.persistent) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, toast.durationMs ?? 3200);
    }
  };

  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  const openSaveModal = (mode: SaveMode, ids: number[] = []) => {
    setSaveModalState({ mode, selectedTabIds: ids });
  };

  const clearToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const restoreUndoBuffer = async (buffer: UndoCollapseBuffer, toastId?: string) => {
    try {
      let targetWindowId = buffer.windowId;
      for (const tab of buffer.tabs) {
        if (targetWindowId) {
          try {
            await chrome.tabs.create({ windowId: targetWindowId, url: tab.url });
            continue;
          } catch {
            targetWindowId = null;
          }
        }

        await chrome.tabs.create({ url: tab.url });
      }

      await saveUndoBuffer(null);
      if (toastId) {
        clearToast(toastId);
      }
      addToast("success", `Restored ${buffer.tabs.length} tabs from "${buffer.sessionName}".`);
    } catch {
      addToast("error", "TabNest could not restore the collapsed tabs.");
    }
  };

  const showUndoToast = (buffer: UndoCollapseBuffer) => {
    const toastId = `toast-undo-${buffer.createdAt}`;
    addToast(
      "info",
      `Collapsed "${buffer.sessionName}". You can undo for 10 seconds.`,
      {
        id: toastId,
        actionLabel: "Undo",
        onAction: () => {
          void restoreUndoBuffer(buffer, toastId);
        },
        durationMs: Math.max(buffer.expiresAt - Date.now(), 1000),
      },
    );
  };

  useEffect(() => {
    void loadUndoBuffer().then((buffer) => {
      if (buffer) {
        showUndoToast(buffer);
      }
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        openSaveModal("collapse");
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        openSaveModal("save", selectedTabIds);
      }

      if (event.key === "Escape") {
        if (saveModalState) {
          setSaveModalState(null);
        } else if (query) {
          setQuery("");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [query, saveModalState, selectedTabIds]);

  return (
    <div
      style={{
        width: 420,
        minHeight: 580,
        maxHeight: 640,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--color-accent), #33d5f5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 24px rgba(0, 179, 216, 0.2)",
            }}
          >
            <Layers size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16 }}>
              TabNest
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              Save your tabs. Clear your mind.
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={openDashboard} title="Open dashboard">
          <LayoutDashboard size={16} />
        </button>
      </div>

      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <SearchBar value={query} onChange={setQuery} inputRef={searchRef} inputId="tabnest-popup-search" />
      </div>

      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", flexShrink: 0 }}>
        {(["sessions", "current"] as PopupView[]).map((item) => {
          const active = view === item;
          return (
            <button
              key={item}
              onClick={() => setView(item)}
              className={active ? "btn btn-primary" : "btn btn-secondary"}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {item === "sessions" ? "Saved sessions" : "Current tabs"}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {view === "sessions" ? (
          <SavedSessions
            query={debouncedQuery}
            addToast={addToast}
            onSaveNew={() => openSaveModal("save")}
            keyboardActive={saveModalState === null}
          />
        ) : (
          <CurrentTabs
            query={debouncedQuery}
            selectedIds={selectedTabIds}
            setSelectedIds={setSelectedTabIds}
            addToast={addToast}
            onSaveSelected={(ids) => openSaveModal("save", ids)}
            onSaveAll={() => openSaveModal("save")}
            onCollapseCurrent={() => openSaveModal("collapse")}
          />
        )}
      </div>

      {saveModalState ? (
        <SaveModal
          mode={saveModalState.mode}
          selectedTabIds={saveModalState.selectedTabIds}
          onClose={() => setSaveModalState(null)}
          addToast={addToast}
          onCollapseSaved={({ session, windowId }) => {
            const createdAt = Date.now();
            const buffer: UndoCollapseBuffer = {
              sessionId: session.id,
              sessionName: session.name,
              tabs: session.tabs,
              windowId,
              createdAt,
              expiresAt: createdAt + 10000,
            };
            void saveUndoBuffer(buffer);
            window.setTimeout(() => {
              void saveUndoBuffer(null);
            }, 10000);
            showUndoToast(buffer);
          }}
        />
      ) : null}

      <Toast toasts={toasts} />
    </div>
  );
}
