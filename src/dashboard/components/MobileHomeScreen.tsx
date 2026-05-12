import { useEffect, useMemo, useRef, useState } from "react";
import {
  Filter,
  FolderOpen,
  Info,
  ListChecks,
  Maximize2,
  PackagePlus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import {
  EmptyState,
  GlassCard,
  MobileIconButton,
  SegmentedControl,
  TabRow,
} from "@/components/mobile/MobileUI";
import { getSessionIcon } from "@/components/shared/sessionIconRegistry";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { buildSearchIndex, buildSessionListItems } from "@/lib/sessionQuery";
import { getDomainLabel, openSavedTab } from "@/lib/sessionBrowser";
import type { Folder, Session, SortOption, TabItem, Tag as TagItem, ToastMessage } from "@/types";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";
import SaveModal from "@/popup/components/SaveModal";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
  onCollapseSaved?: (payload: { session: Session; windowId: number | null }) => void;
  onSelectTabs?: () => void;
  onQuickSave?: () => void;
  onCollapseCurrent?: () => void;
  currentTabCount?: number;
  initialSavePrompt?: { mode: "save" | "collapse"; sourceTabId: number | null } | null;
  onInitialSavePromptHandled?: () => void;
}

type HomeFilter = "folders" | "tags";

interface SavedTab {
  session: Session;
  tab: TabItem;
}

interface FolderBucket {
  id: string | null;
  name: string;
  color: string;
  tabs: SavedTab[];
}

interface TagBucket {
  id: string | null;
  name: string;
  color: string;
  tabs: SavedTab[];
}

function tabPreview(tab: TabItem) {
  return (
    <div className="session-tab-preview">
      {tab.favIconUrl ? (
        <img src={tab.favIconUrl} alt="" />
      ) : (
        <span>{getDomainLabel(tab.url).slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function getFolderName(folderId: string | null, folderMap: Map<string, Folder>): string {
  if (!folderId) {
    return "No folder";
  }

  return folderMap.get(folderId)?.name ?? "Missing folder";
}

function getFolderColor(folderId: string | null, folderMap: Map<string, Folder>): string {
  if (!folderId) {
    return "#8b94a3";
  }

  return folderMap.get(folderId)?.color ?? "#8b94a3";
}

function getTagName(tagId: string | null, tagMap: Map<string, TagItem>): string {
  if (!tagId) {
    return "Untagged";
  }

  return tagMap.get(tagId)?.name ?? "Missing tag";
}

function getTagColor(tagId: string | null, tagMap: Map<string, TagItem>): string {
  if (!tagId) {
    return "#8b94a3";
  }

  return tagMap.get(tagId)?.color ?? "#1677ee";
}

export default function MobileHomeScreen({
  addToast,
  onCollapseSaved,
  onSelectTabs,
  onQuickSave,
  onCollapseCurrent,
  currentTabCount,
  initialSavePrompt,
  onInitialSavePromptHandled,
}: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const sortBy = useSessionStore((state) => state.sortBy);
  const setSortBy = useSessionStore((state) => state.setSortBy);
  const viewFilter = useSessionStore((state) => state.viewFilter);
  const activeFolderId = useSessionStore((state) => state.activeFolderId);
  const activeTagId = useSessionStore((state) => state.activeTagId);
  const removeTabFromSession = useSessionStore((state) => state.removeTabFromSession);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const settings = useSettingsStore((state) => state.settings);

  const [query, setQuery] = useState("");
  const [homeFilter, setHomeFilter] = useState<HomeFilter>("folders");
  const [saveModalPrompt, setSaveModalPrompt] = useState<{
    mode: "save" | "collapse";
    sourceTabId: number | null;
  } | null>(null);
  const deferredQuery = useDebouncedValue(query, 140);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchIndex = useMemo(
    () => buildSearchIndex(sessions, folders, tags, settings),
    [folders, sessions, settings, tags]
  );

  useEffect(() => {
    const focusSearch = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("tabsetu:focus-home-search", focusSearch);
    return () => window.removeEventListener("tabsetu:focus-home-search", focusSearch);
  }, []);

  useEffect(() => {
    if (!initialSavePrompt) {
      return;
    }

    setSaveModalPrompt(initialSavePrompt);
    onInitialSavePromptHandled?.();
  }, [initialSavePrompt, onInitialSavePromptHandled]);

  const items = useMemo(
    () =>
      buildSessionListItems({
        sessions,
        folders,
        tags,
        settings,
        query: deferredQuery,
        sortBy,
        viewFilter,
        folderId: activeFolderId,
        tagId: activeTagId,
        searchIndex,
      }),
    [
      activeFolderId,
      activeTagId,
      deferredQuery,
      folders,
      searchIndex,
      sessions,
      settings,
      sortBy,
      tags,
      viewFilter,
    ]
  );

  const visibleSessions = useMemo(() => items.map((item) => item.session), [items]);
  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const savedTabCount = useMemo(
    () => sessions.reduce((total, session) => total + session.tabs.length, 0),
    [sessions]
  );

  const savedTabs = useMemo<SavedTab[]>(
    () =>
      visibleSessions.flatMap((session) =>
        session.tabs.map((tab) => ({
          session,
          tab,
        }))
      ),
    [visibleSessions]
  );

  const tagBuckets = useMemo<TagBucket[]>(() => {
    const tabsByTagId = new Map<string | null, SavedTab[]>();

    for (const savedTab of savedTabs) {
      const tagIds = [...new Set([...savedTab.session.tagIds, ...savedTab.tab.tagIds])];
      if (tagIds.length === 0) {
        tabsByTagId.set(null, [...(tabsByTagId.get(null) ?? []), savedTab]);
        continue;
      }

      for (const tagId of tagIds) {
        tabsByTagId.set(tagId, [...(tabsByTagId.get(tagId) ?? []), savedTab]);
      }
    }

    return [...tabsByTagId.entries()].map(([tagId, tabs]) => ({
      id: tagId,
      name: getTagName(tagId, tagMap),
      color: getTagColor(tagId, tagMap),
      tabs,
    }));
  }, [savedTabs, tagMap]);

  const folderBuckets = useMemo<FolderBucket[]>(() => {
    const foldersById = new Map<string | null, SavedTab[]>();
    for (const savedTab of savedTabs) {
      const folderId = savedTab.tab.folderId ?? savedTab.session.folderId ?? null;
      foldersById.set(folderId, [...(foldersById.get(folderId) ?? []), savedTab]);
    }

    return [...foldersById.entries()].map(([folderId, tabs]) => ({
      id: folderId,
      name: getFolderName(folderId, folderMap),
      color: getFolderColor(folderId, folderMap),
      tabs,
    }));
  }, [folderMap, savedTabs]);

  const openQuickSave = () => {
    if (onQuickSave) {
      onQuickSave();
      return;
    }

    setSaveModalPrompt({ mode: "save", sourceTabId: null });
  };

  const openCollapse = () => {
    if (onCollapseCurrent) {
      onCollapseCurrent();
      return;
    }

    setSaveModalPrompt({ mode: "collapse", sourceTabId: null });
  };

  const handleOpenTab = async (session: Session, tab: TabItem) => {
    const opened = await openSavedTab(tab, false);
    if (!opened) {
      addToast("error", "That tab cannot be opened.");
      return;
    }

    recordTabOpened(session.id, tab.id);
  };

  const renderSavedTab = ({ session, tab }: SavedTab) => {
    const SessionIcon = getSessionIcon(session.icon);
    return (
      <TabRow
        key={`${session.id}-${tab.id}`}
        title={tab.title}
        subtitle={`${getDomainLabel(tab.url)} - ${session.name}`}
        favIconUrl={tab.favIconUrl}
        preview={
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {session.color ? (
              <span
                className="session-color-dot"
                style={{ background: session.color }}
                aria-hidden="true"
              />
            ) : null}
            {SessionIcon ? <SessionIcon size={14} aria-hidden={true} /> : null}
            {tabPreview(tab)}
          </div>
        }
        showCheckbox={false}
        onSelect={() => void handleOpenTab(session, tab)}
        actions={
          <>
            <button
              className="mobile-row-action"
              type="button"
              title="Info"
              onClick={(event) => {
                event.stopPropagation();
                addToast("info", tab.url);
              }}
            >
              <Info size={17} />
            </button>
            <button
              className="mobile-row-action"
              type="button"
              title="Delete tab"
              onClick={(event) => {
                event.stopPropagation();
                removeTabFromSession(session.id, tab.id);
                addToast("success", "Removed tab from session.");
              }}
            >
              <Trash2 size={17} />
            </button>
          </>
        }
      />
    );
  };

  return (
    <>
      <div className="mobile-toolbar home-toolbar">
        <label className="mobile-search">
          <Search size={18} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions and tabs... Ctrl+K"
          />
        </label>
        <MobileIconButton title="Filter">
          <Filter size={18} />
        </MobileIconButton>
        <MobileIconButton title="Focus">
          <Maximize2 size={18} />
        </MobileIconButton>
      </div>

      <select
        className="mobile-select home-sort-select"
        value={sortBy}
        onChange={(event) => setSortBy(event.target.value as SortOption)}
        aria-label="Sort saved sessions"
      >
        <option value="updatedAt">Recently updated</option>
        <option value="createdAt">Recently created</option>
        <option value="lastOpenedAt">Recently opened</option>
        <option value="name">Name</option>
        <option value="tabCount">Tab count</option>
      </select>

      <GlassCard className="mobile-card-padded home-summary-card">
        <div>
          <strong>
            {sessions.length ? `${savedTabCount} tabs organized` : "Your web, held together"}
          </strong>
          <span>
            {sessions.length
              ? `${sessions.length} saved sessions in TabSetu`
              : "Save a set of tabs to begin."}
          </span>
        </div>
        <button className="mobile-primary-button" type="button" onClick={openQuickSave}>
          Quick Save
        </button>
      </GlassCard>

      <GlassCard className="mobile-card-padded home-capture-card">
        <div>
          <strong>Current active tabs</strong>
          <span>
            {typeof currentTabCount === "number"
              ? `${currentTabCount} capturable tabs`
              : "Save or collapse this window."}
          </span>
        </div>
        <div className="home-capture-actions">
          <button
            className="mobile-secondary-button"
            type="button"
            onClick={onSelectTabs ?? openQuickSave}
          >
            <ListChecks size={17} />
            Select Tabs
          </button>
          <button
            className="mobile-secondary-button"
            type="button"
            data-onboarding-target="save-session"
            onClick={openQuickSave}
          >
            <PackagePlus size={17} />
            Quick Save
          </button>
          <button
            className="mobile-link-button"
            type="button"
            data-onboarding-target="collapse-tabs"
            onClick={openCollapse}
          >
            Collapse current tabs
          </button>
        </div>
      </GlassCard>

      <div className="home-filter-bar">
        <SegmentedControl<HomeFilter>
          value={homeFilter}
          onChange={setHomeFilter}
          options={[
            { value: "folders", label: "Folders" },
            { value: "tags", label: "Tags" },
          ]}
        />
      </div>

      <div data-onboarding-target="session-list">
        {savedTabs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={44} />}
            title={query ? "No saved tabs found" : "No tabs saved yet"}
            description={
              query
                ? "Try a different search or clear filters."
                : "Save your current window to make TabSetu useful immediately."
            }
            action={
              <button className="mobile-primary-button" type="button" onClick={openQuickSave}>
                Quick Save Tabs
              </button>
            }
          />
        ) : null}

        {homeFilter === "folders" && savedTabs.length !== 0 ? (
          <div className="home-hierarchy-list">
            {folderBuckets.map((folder) => (
              <GlassCard className="home-bucket-card" key={folder.id ?? "nofolder"}>
                <div className="home-bucket-header">
                  <div
                    className="home-bucket-icon"
                    style={{ background: `${folder.color}18`, color: folder.color }}
                  >
                    <FolderOpen size={22} />
                  </div>
                  <div>
                    <strong>{folder.name}</strong>
                    <span>{folder.tabs.length} tabs</span>
                  </div>
                </div>
                <div className="mobile-list mobile-session-tabs home-compact-tabs">
                  {folder.tabs.map(renderSavedTab)}
                </div>
              </GlassCard>
            ))}
          </div>
        ) : null}

        {homeFilter === "tags" && savedTabs.length !== 0 ? (
          <div className="home-hierarchy-list">
            {tagBuckets.map((tagBucket) => (
              <GlassCard className="home-bucket-card" key={tagBucket.id ?? "untagged"}>
                <div className="home-bucket-header">
                  <div
                    className="home-bucket-icon"
                    style={{ background: `${tagBucket.color}18`, color: tagBucket.color }}
                  >
                    <Tag size={22} />
                  </div>
                  <div>
                    <strong>{tagBucket.name}</strong>
                    <span>{tagBucket.tabs.length} tabs</span>
                  </div>
                </div>
                <div className="mobile-list mobile-session-tabs home-compact-tabs">
                  {tagBucket.tabs.map(renderSavedTab)}
                </div>
              </GlassCard>
            ))}
          </div>
        ) : null}
      </div>

      {saveModalPrompt ? (
        <SaveModal
          mode={saveModalPrompt.mode}
          selectedTabIds={[]}
          preferredTitleTabId={saveModalPrompt.sourceTabId}
          onClose={() => setSaveModalPrompt(null)}
          addToast={addToast}
          onCollapseSaved={onCollapseSaved}
        />
      ) : null}
    </>
  );
}
