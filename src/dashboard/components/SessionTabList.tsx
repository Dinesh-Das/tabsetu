import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bell, GripVertical, Trash2 } from "lucide-react";
import type { Folder, Session, TabItem, Tag, ToastMessage } from "@/types";
import { TabSetuLogo } from "@/components/shared/TabSetuLogo";
import { getFaviconFallbackUrl, getRememberedFaviconForOrigin } from "@/lib/favicon";
import { formatDateTime } from "@/lib/format";
import { tomorrowAtNine } from "@/lib/reminders";
import { getDomainLabel, openSavedTab } from "@/lib/sessionBrowser";
import { reorderTabsByIndex } from "@/lib/tabOrdering";
import {
  chromeTabToTabItemWithFavicon,
  cloneTabItem,
  getPreferredBrowserTab,
  isRestrictedUrl,
} from "@/lib/tabHelpers";
import { ReminderPicker } from "./SessionReminderPanel";

function toLocalDateInputValue(value: number): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface Props {
  session: Session;
  folders: Folder[];
  tags: Tag[];
  remindersEnabled: boolean;
  addToast: (type: ToastMessage["type"], message: string) => void;
  createSession: (
    name: string,
    description: string,
    tabs: TabItem[],
    folderId?: string | null,
    tagIds?: string[]
  ) => Session;
  createSchedule: (schedule: {
    sessionId: string;
    type: "once";
    time: string;
    daysOfWeek: number[];
    date: string | null;
    enabled: boolean;
  }) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  addTabToSession: (sessionId: string, tab: TabItem) => boolean;
  removeTabFromSession: (sessionId: string, tabId: string) => void;
  updateTabNote: (sessionId: string, tabId: string, note: string) => void;
  updateTabReminder: (sessionId: string, tabId: string, reminderAt: number | null) => void;
  updateTabFolder: (sessionId: string, tabId: string, folderId: string | null) => void;
  updateTabTags: (sessionId: string, tabId: string, tagIds: string[]) => void;
  recordTabOpened: (sessionId: string, tabId: string) => void;
}

export default function SessionTabList({
  session,
  folders,
  tags,
  remindersEnabled,
  addToast,
  createSession,
  createSchedule,
  updateSession,
  addTabToSession,
  removeTabFromSession,
  updateTabNote,
  updateTabReminder,
  updateTabFolder,
  updateTabTags,
  recordTabOpened,
}: Props) {
  const [tabDraftNotes, setTabDraftNotes] = useState<Record<string, string>>(
    Object.fromEntries(session.tabs.map((tab) => [tab.id, tab.note]))
  );
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const toggleTabTag = (tabId: string, tagId: string) => {
    const tab = session.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }
    const nextTagIds = tab.tagIds.includes(tagId)
      ? tab.tagIds.filter((existing) => existing !== tagId)
      : [...tab.tagIds, tagId];
    updateTabTags(session.id, tabId, nextTagIds);
  };

  const handleOpenTab = async (tabId: string) => {
    const tab = session.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }
    const opened = await openSavedTab(tab);
    if (!opened) {
      addToast("error", "That tab could not be opened.");
      return;
    }
    recordTabOpened(session.id, tabId);
    addToast("success", `Opened ${tab.title}.`);
  };

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

  const createOneTimeScheduleForTab = (tab: Session["tabs"][number]) => {
    const scheduledAt = tomorrowAtNine();
    const date = new Date(scheduledAt);
    const scheduleSession = createSession(
      `Scheduled: ${tab.title}`,
      `Auto-open schedule for ${tab.url}`,
      [cloneTabItem(tab)],
      tab.folderId ?? session.folderId,
      [...new Set([...session.tagIds, ...tab.tagIds])]
    );

    createSchedule({
      sessionId: scheduleSession.id,
      type: "once",
      time: date.toTimeString().slice(0, 5),
      daysOfWeek: [],
      date: toLocalDateInputValue(scheduledAt),
      enabled: true,
    });
    addToast("success", `Scheduled "${tab.title}" for tomorrow at 9 AM.`);
  };

  const handleAddActiveTab = async () => {
    const activeTab = await getPreferredBrowserTab();
    if (!activeTab?.url || isRestrictedUrl(activeTab.url)) {
      addToast("error", "The current active tab cannot be added.");
      return;
    }

    const added = addTabToSession(session.id, await chromeTabToTabItemWithFavicon(activeTab));
    if (!added) {
      addToast("info", "That tab is already part of this session.");
      return;
    }
    addToast("success", `Added ${activeTab.title ?? "active tab"} to the session.`);
  };

  useEffect(() => {
    const addActive = () => {
      void handleAddActiveTab();
    };
    window.addEventListener("tabsetu:add-active-tab", addActive);
    return () => window.removeEventListener("tabsetu:add-active-tab", addActive);
  });

  const reorderTabs = (fromIndex: number, toIndex: number): boolean => {
    const reorderedTabs = reorderTabsByIndex(session.tabs, fromIndex, toIndex);
    if (!reorderedTabs) {
      return false;
    }
    updateSession(session.id, { tabs: reorderedTabs });
    return true;
  };

  const handleTabDrop = (targetTabId: string) => {
    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      return;
    }
    const orderedTabs = [...session.tabs].sort((left, right) => left.position - right.position);
    const fromIndex = orderedTabs.findIndex((tab) => tab.id === draggedTabId);
    const toIndex = orderedTabs.findIndex((tab) => tab.id === targetTabId);
    const reordered = reorderTabs(fromIndex, toIndex);
    setDraggedTabId(null);
    if (reordered) {
      addToast("success", "Tabs reordered.");
    }
  };

  const moveTabByOffset = (tabId: string, offset: -1 | 1) => {
    const orderedTabs = [...session.tabs].sort((left, right) => left.position - right.position);
    const fromIndex = orderedTabs.findIndex((tab) => tab.id === tabId);
    const toIndex = fromIndex + offset;
    if (reorderTabs(fromIndex, toIndex)) {
      addToast("success", "Tabs reordered.");
    }
  };

  return (
    <section className="detail-section">
      <div className="detail-section-header">
        <h3>Saved tabs</h3>
        <span className="badge badge-subtle">{session.tabs.length} total</span>
      </div>
      <button
        className="btn btn-secondary"
        onClick={() => void handleAddActiveTab()}
        style={{ marginBottom: 12 }}
      >
        Add active tab
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {session.tabs.map((tab, index) => {
          const favicon = tab.favIconUrl ?? getRememberedFaviconForOrigin(tab.url);
          return (
            <div
              key={tab.id}
              className="card-raised detail-card"
              data-dragging={draggedTabId === tab.id || undefined}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleTabDrop(tab.id)}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <button
                  className="btn btn-ghost btn-icon tab-drag-handle"
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDraggedTabId(tab.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", tab.id);
                  }}
                  onDragEnd={() => setDraggedTabId(null)}
                  title="Drag to reorder"
                  aria-label={`Drag ${tab.title} to reorder`}
                >
                  <GripVertical size={15} />
                </button>
                <div className="tab-reorder-buttons" aria-label={`Move ${tab.title}`} role="group">
                  <button
                    className="btn btn-ghost btn-icon"
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveTabByOffset(tab.id, -1)}
                    title="Move tab up"
                    aria-label={`Move ${tab.title} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    type="button"
                    disabled={index === session.tabs.length - 1}
                    onClick={() => moveTabByOffset(tab.id, 1)}
                    title="Move tab down"
                    aria-label={`Move ${tab.title} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                {favicon ? (
                  <img
                    src={favicon}
                    className="favicon"
                    alt=""
                    onError={(event) => {
                      const fallback = getFaviconFallbackUrl();
                      if (fallback && event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      } else {
                        event.currentTarget.style.display = "none";
                      }
                    }}
                  />
                ) : (
                  <span className="favicon favicon-fallback">
                    <TabSetuLogo decorative />
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{tab.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                    {getDomainLabel(tab.url)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                    Opened {formatDateTime(tab.lastOpenedAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-secondary" onClick={() => void handleOpenTab(tab.id)}>
                    Open
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => createOneTimeScheduleForTab(tab)}
                  >
                    Schedule
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ color: "var(--color-danger)" }}
                    onClick={() => removeTabFromSession(session.id, tab.id)}
                    title="Remove tab from session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label className="label">Tab note</label>
                <textarea
                  className="input"
                  value={tabDraftNotes[tab.id] ?? ""}
                  onChange={(event) =>
                    setTabDraftNotes((current) => ({ ...current, [tab.id]: event.target.value }))
                  }
                  onBlur={() => updateTabNote(session.id, tab.id, tabDraftNotes[tab.id] ?? "")}
                  placeholder="Add context for this link"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <label className="label">Tab organization</label>
                <div className="tab-organization-controls">
                  <select
                    className="input"
                    value={tab.folderId ?? ""}
                    onChange={(event) =>
                      updateTabFolder(session.id, tab.id, event.target.value || null)
                    }
                    aria-label={`Folder for ${tab.title}`}
                  >
                    <option value="">Use session folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <div className="tab-tag-chip-row" aria-label={`Tags for ${tab.title}`}>
                    {tags.map((tag) => {
                      const active = tab.tagIds.includes(tag.id);
                      const inherited = !active && session.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          className="tag-chip"
                          type="button"
                          data-active={active || undefined}
                          data-inherited={inherited || undefined}
                          onClick={() => toggleTabTag(tab.id, tag.id)}
                          style={{
                            borderColor: active ? tag.color : undefined,
                            color: active ? tag.color : undefined,
                            background: active ? `${tag.color}22` : undefined,
                          }}
                          title={inherited ? "Inherited from session" : `Toggle ${tag.name}`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Bell size={14} />
                  Reminder
                </label>
                <ReminderPicker
                  tab={tab}
                  onSet={(reminderAt) => void setTabReminderAt(tab.id, reminderAt)}
                  onClear={() => void setTabReminderAt(tab.id, null)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
