import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, FolderOpen, Pin, Plus, Trash2 } from "lucide-react";
import HighlightedText from "@/components/shared/HighlightedText";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { buildSessionListItems } from "@/lib/sessionQuery";
import { getDomainLabel, openSavedTab, openSessionTabs } from "@/lib/sessionBrowser";
import { chromeTabToTabItem, getPreferredBrowserTab, isRestrictedUrl } from "@/lib/tabHelpers";
import type { Session, ToastMessage } from "@/types";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";

interface Props {
  query: string;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onSaveNew: () => void;
  keyboardActive: boolean;
}

export default function SavedSessions({ query, addToast, onSaveNew, keyboardActive }: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const duplicateSession = useSessionStore((state) => state.duplicateSession);
  const pinSession = useSessionStore((state) => state.pinSession);
  const addTabToSession = useSessionStore((state) => state.addTabToSession);
  const recordOpened = useSessionStore((state) => state.recordOpened);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const settings = useSettingsStore((state) => state.settings);

  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [activeTagId, setActiveTagId] = useState("");
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeFolderId && !folders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId("");
    }
  }, [activeFolderId, folders]);

  useEffect(() => {
    if (activeTagId && !tags.some((tag) => tag.id === activeTagId)) {
      setActiveTagId("");
    }
  }, [activeTagId, tags]);

  const visibleItems = useMemo(
    () =>
      buildSessionListItems({
        sessions,
        folders,
        tags,
        settings,
        query,
        sortBy: "lastOpenedAt",
        folderId: activeFolderId || null,
        tagId: activeTagId || null,
      }),
    [activeFolderId, activeTagId, folders, query, sessions, settings, tags],
  );

  const listKeyboardActive = keyboardActive && pendingDelete === null;

  useEffect(() => {
    setKeyboardIndex(0);
  }, [activeFolderId, activeTagId, query]);

  useEffect(() => {
    if (visibleItems.length === 0) {
      setKeyboardIndex(0);
      return;
    }

    setKeyboardIndex((current) => Math.min(current, visibleItems.length - 1));
  }, [visibleItems.length]);

  const handleOpenSession = async (session: Session, openInNewWindow = settings.openInNewWindow) => {
    const openedCount = await openSessionTabs(session, openInNewWindow);
    if (openedCount === 0) {
      addToast("error", "This session does not have any openable tabs.");
      return;
    }

    recordOpened(session.id);
    addToast(
      "success",
      `Opened "${session.name}" with ${openedCount} ${openedCount === 1 ? "tab" : "tabs"}.`,
    );
  };

  const handleOpenTab = async (session: Session, tabId: string) => {
    const tab = session.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }

    const opened = await openSavedTab(tab);
    if (!opened) {
      addToast("error", "That saved tab could not be opened.");
      return;
    }

    recordTabOpened(session.id, tabId);
    addToast("success", `Opened ${tab.title}.`);
  };

  const handleDelete = (session: Session) => {
    if (settings.confirmBeforeDelete) {
      setPendingDelete(session);
      return;
    }

    deleteSession(session.id);
    addToast("success", `Deleted "${session.name}".`);
  };

  const handleAddCurrentTab = async (session: Session) => {
    const activeTab = await getPreferredBrowserTab();
    if (!activeTab?.url || isRestrictedUrl(activeTab.url)) {
      addToast("error", "The active tab cannot be saved into this session.");
      return;
    }

    const added = addTabToSession(session.id, chromeTabToTabItem(activeTab));
    if (!added) {
      addToast("info", "That tab is already in this session.");
      return;
    }

    addToast("success", `Added ${activeTab.title ?? "the current tab"} to "${session.name}".`);
  };

  useEffect(() => {
    if (!listKeyboardActive || visibleItems.length === 0) {
      return;
    }

    const activeSession = visibleItems[keyboardIndex]?.session;
    if (!activeSession) {
      return;
    }

    itemRefs.current[activeSession.id]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [keyboardIndex, listKeyboardActive, visibleItems]);

  useEffect(() => {
    if (!listKeyboardActive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (visibleItems.length === 0) {
        return;
      }

      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName ?? "";
      const isSearchInput =
        activeElement instanceof HTMLInputElement &&
        activeElement.id === "tabnest-popup-search";
      const blocksKeyboardListControl =
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        tagName === "BUTTON" ||
        (tagName === "INPUT" && !isSearchInput);

      if (blocksKeyboardListControl) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setKeyboardIndex((current) => Math.min(current + 1, visibleItems.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setKeyboardIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setKeyboardIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setKeyboardIndex(visibleItems.length - 1);
        return;
      }

      if (event.key === "Enter") {
        const activeItem = visibleItems[keyboardIndex];
        if (!activeItem) {
          return;
        }

        event.preventDefault();
        void handleOpenSession(activeItem.session);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboardIndex, listKeyboardActive, visibleItems]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {visibleItems.length} saved {visibleItems.length === 1 ? "session" : "sessions"}
        </span>
        <button className="btn btn-primary" type="button" style={{ fontSize: 12 }} onClick={onSaveNew}>
          <Plus size={14} />
          Save current tabs
        </button>
      </div>

      {folders.length > 0 || tags.length > 0 ? (
        <div style={{ display: "flex", gap: 8, padding: "0 16px 10px", flexShrink: 0 }}>
          <select
            className="input"
            value={activeFolderId}
            onChange={(event) => setActiveFolderId(event.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          >
            <option value="">All folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={activeTagId}
            onChange={(event) => setActiveTagId(event.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          {activeFolderId || activeTagId ? (
            <button
              className="btn btn-secondary"
              type="button"
              style={{ fontSize: 12 }}
              onClick={() => {
                setActiveFolderId("");
                setActiveTagId("");
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {visibleItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "44px 18px", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              {query ? "No sessions match that search" : "Your nest is empty"}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {query
                ? "Try a different keyword, folder, or tag."
                : "Save your current tabs and TabNest will keep the workflow ready."}
            </div>
          </div>
        ) : null}

        {visibleItems.map((item, index) => {
          const { session, folder, tags: sessionTags, searchResult } = item;
          const secondaryText = searchResult?.highlights.sessionNote.length
            ? session.note
            : session.description || session.note || "";
          const secondaryRanges = searchResult?.highlights.sessionNote.length
            ? searchResult.highlights.sessionNote
            : searchResult?.highlights.sessionDescription ?? [];
          const isKeyboardSelected = listKeyboardActive && keyboardIndex === index;

          return (
            <div
              key={session.id}
              ref={(node) => {
                itemRefs.current[session.id] = node;
              }}
              className="card"
              onMouseEnter={() => setKeyboardIndex(index)}
              aria-selected={isKeyboardSelected}
              style={{
                padding: 12,
                marginBottom: 10,
                boxShadow: isKeyboardSelected
                  ? "0 20px 48px rgba(15, 185, 216, 0.18)"
                  : "var(--shadow-card)",
                borderColor: isKeyboardSelected ? "var(--color-accent)" : "var(--color-border)",
                background: isKeyboardSelected
                  ? "color-mix(in srgb, var(--color-accent-dim) 35%, var(--color-surface) 65%)"
                  : undefined,
                transition:
                  "border-color var(--transition), box-shadow var(--transition), background var(--transition)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {session.isPinned ? <Pin size={12} color="var(--color-accent)" /> : null}
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--color-text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <HighlightedText text={session.name} ranges={searchResult?.highlights.sessionName} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {session.tabs.length} tabs - Opened {formatDateTime(session.lastOpenedAt)}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  style={{ width: 28, height: 28 }}
                  onClick={() => pinSession(session.id, !session.isPinned)}
                  title={session.isPinned ? "Unpin session" : "Pin session"}
                >
                  <Pin size={14} color={session.isPinned ? "var(--color-accent)" : undefined} />
                </button>
              </div>

              {secondaryText ? (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  <HighlightedText text={secondaryText} ranges={secondaryRanges} />
                </p>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {folder ? (
                  <span className="badge badge-subtle">
                    <FolderOpen size={11} />
                    <HighlightedText text={folder.name} ranges={searchResult?.highlights.folderName} />
                  </span>
                ) : null}
                {sessionTags.slice(0, 3).map((tag) => (
                  <span key={tag.id} className="badge badge-subtle">
                    <HighlightedText text={tag.name} ranges={searchResult?.highlights.tagNames[tag.id]} />
                  </span>
                ))}
              </div>

              {searchResult?.snippets.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  {searchResult.snippets.slice(0, 2).map((snippet) => (
                    <div
                      key={snippet.id}
                      className="badge badge-subtle"
                      style={{
                        display: "block",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <strong style={{ marginRight: 6 }}>
                        {snippet.kind === "tabTitle"
                          ? "Title"
                          : snippet.kind === "tabUrl"
                            ? "URL"
                            : "Note"}
                        :
                      </strong>
                      <HighlightedText text={snippet.text} ranges={snippet.ranges} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {session.tabs.slice(0, 3).map((tab) => (
                    <button
                      key={tab.id}
                      className="chip-link"
                      type="button"
                      onClick={() => void handleOpenTab(session, tab.id)}
                      title={tab.url}
                    >
                      {getDomainLabel(tab.url)}
                    </button>
                  ))}
                  {session.tabs.length > 3 ? (
                    <span className="badge badge-subtle">+{session.tabs.length - 3} more</span>
                  ) : null}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => void handleOpenSession(session)}
                >
                  <ExternalLink size={14} />
                  Open all
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ fontSize: 12 }}
                  onClick={() => void handleOpenSession(session, true)}
                >
                  New window
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ fontSize: 12 }}
                  onClick={() => void handleAddCurrentTab(session)}
                >
                  Add current tab
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  style={{ width: 30, height: 30 }}
                  onClick={() => {
                    duplicateSession(session.id);
                    addToast("success", `Duplicated "${session.name}".`);
                  }}
                  title="Duplicate session"
                >
                  <Copy size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  type="button"
                  style={{ width: 30, height: 30, color: "var(--color-danger)" }}
                  onClick={() => handleDelete(session)}
                  title="Delete session"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete session?"
          message={`"${pendingDelete.name}" will be removed from TabNest.`}
          confirmLabel="Delete session"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteSession(pendingDelete.id);
            addToast("success", `Deleted "${pendingDelete.name}".`);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
