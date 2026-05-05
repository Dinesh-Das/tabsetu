import { useMemo, useState } from "react";
import {
  ChevronLeft,
  Edit3,
  FolderOpen,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import MobileConfirmSheet from "@/components/mobile/MobileConfirmSheet";
import { BottomSheet, EmptyState, GlassCard, MobileIconButton, TabRow } from "@/components/mobile/MobileUI";
import { getDomainLabel, openSavedTab } from "@/lib/sessionBrowser";
import type { Folder, Session, TabItem, Tag, ToastMessage } from "@/types";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useTagStore } from "@/store/tagStore";

interface Props {
  addToast: (type: ToastMessage["type"], message: string) => void;
}

const FOLDER_COLORS = ["#1677ee", "#4f46e5", "#0f9f87", "#f59e0b", "#ef4444"];

type OrganizerEditorState =
  | { type: "folder"; item: Folder | null }
  | { type: "tag"; item: Tag | null }
  | null;

type DeleteState =
  | { type: "folder"; item: Folder }
  | { type: "tag"; item: Tag }
  | null;

type ActiveCollection =
  | { type: "folder"; id: string; name: string; color: string }
  | { type: "tag"; id: string; name: string; color: string }
  | null;

interface FolderEditorProps {
  folder: Folder | null;
  onClose: () => void;
  addToast: Props["addToast"];
}

interface TagEditorProps {
  tag: Tag | null;
  onClose: () => void;
  addToast: Props["addToast"];
}

function tabPreview(tab: TabItem) {
  return (
    <div className="session-tab-preview">
      {tab.favIconDataUrl ?? tab.favIconUrl ? (
        <img src={tab.favIconDataUrl ?? tab.favIconUrl ?? ""} alt="" />
      ) : (
        <span>{getDomainLabel(tab.url).slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function TagEditor({ tag, onClose, addToast }: TagEditorProps) {
  const createTag = useTagStore((state) => state.createTag);
  const updateTag = useTagStore((state) => state.updateTag);
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? FOLDER_COLORS[0]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast("info", "Tag name is required.");
      return;
    }

    if (tag) {
      updateTag(tag.id, { name: trimmed, color });
    } else {
      createTag(trimmed, color);
    }

    addToast("success", `Tag ${tag ? "updated" : "created"}.`);
    onClose();
  };

  return (
    <BottomSheet
      title={tag ? "Edit tag" : "Create tag"}
      subtitle="Make saved sessions easier to scan."
      onClose={onClose}
      footer={
        <button className="mobile-primary-button save-sheet-primary" type="button" onClick={handleSubmit}>
          {tag ? "Save" : "Create"}
        </button>
      }
    >
      <div className="mobile-form-stack">
        <div className="mobile-field">
          <label htmlFor="tag-name">Name</label>
          <input
            id="tag-name"
            className="mobile-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Important"
            autoFocus
          />
        </div>
        <div className="mobile-field">
          <label>Color</label>
          <div className="mobile-color-row">
            {FOLDER_COLORS.map((candidate) => (
              <button
                key={candidate}
                className="mobile-color-dot"
                type="button"
                data-active={candidate === color || undefined}
                style={{ background: candidate }}
                onClick={() => setColor(candidate)}
                title={candidate}
              />
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function FolderEditor({ folder, onClose, addToast }: FolderEditorProps) {
  const createFolder = useFolderStore((state) => state.createFolder);
  const updateFolder = useFolderStore((state) => state.updateFolder);
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState(folder?.color ?? FOLDER_COLORS[0]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast("info", "Folder name is required.");
      return;
    }

    if (folder) {
      updateFolder(folder.id, { name: trimmed, color, icon: "folder" });
      addToast("success", "Folder updated.");
    } else {
      createFolder(trimmed, color, "folder");
      addToast("success", "Folder created.");
    }

    onClose();
  };

  return (
    <BottomSheet
      title={folder ? "Edit folder" : "Create folder"}
      subtitle="Keep related tab sets easy to find."
      onClose={onClose}
      footer={
        <button className="mobile-primary-button save-sheet-primary" type="button" onClick={handleSubmit}>
          {folder ? "Save Folder" : "Create Folder"}
        </button>
      }
    >
      <div className="mobile-form-stack">
        <div className="mobile-field">
          <label htmlFor="folder-name">Name</label>
          <input
            id="folder-name"
            className="mobile-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Research"
            autoFocus
          />
        </div>
        <div className="mobile-field">
          <label>Color</label>
          <div className="mobile-color-row">
            {FOLDER_COLORS.map((candidate) => (
              <button
                key={candidate}
                className="mobile-color-dot"
                type="button"
                data-active={candidate === color || undefined}
                style={{ background: candidate }}
                onClick={() => setColor(candidate)}
                title={candidate}
              />
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

export default function MobileFoldersScreen({ addToast }: Props) {
  const folders = useFolderStore((state) => state.folders);
  const deleteFolder = useFolderStore((state) => state.deleteFolder);
  const tags = useTagStore((state) => state.tags);
  const deleteTag = useTagStore((state) => state.deleteTag);
  const sessions = useSessionStore((state) => state.sessions);
  const unassignFolder = useSessionStore((state) => state.unassignFolder);
  const removeTagReferences = useSessionStore((state) => state.removeTagReferences);
  const recordTabOpened = useSessionStore((state) => state.recordTabOpened);

  const [editor, setEditor] = useState<OrganizerEditorState>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteState>(null);
  const [activeCollection, setActiveCollection] = useState<ActiveCollection>(null);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      if (session.folderId) {
        counts.set(session.folderId, (counts.get(session.folderId) ?? 0) + session.tabs.length);
      }
    }
    return counts;
  }, [sessions]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      for (const tagId of session.tagIds) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + session.tabs.length);
      }
    }
    return counts;
  }, [sessions]);

  const pinnedTabs = useMemo(
    () => sessions.filter((session) => session.isPinned).reduce((total, session) => total + session.tabs.length, 0),
    [sessions],
  );

  const visibleFolders = folders.filter((folder) => folder.name.toLowerCase().includes(normalizedQuery));
  const visibleTags = tags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery));

  const activeSessions = useMemo(() => {
    if (!activeCollection) {
      return [];
    }

    if (activeCollection.type === "folder") {
      return sessions.filter((session) => session.folderId === activeCollection.id);
    }

    return sessions.filter((session) => session.tagIds.includes(activeCollection.id));
  }, [activeCollection, sessions]);

  const activeTabCount = activeSessions.reduce((total, session) => total + session.tabs.length, 0);

  const handleOpenTab = async (session: Session, tab: TabItem) => {
    const opened = await openSavedTab(tab, false);
    if (!opened) {
      addToast("error", "That tab cannot be opened.");
      return;
    }

    recordTabOpened(session.id, tab.id);
  };

  if (activeCollection) {
    return (
      <>
        <div className="collection-detail-header">
          <button className="mobile-icon-button" type="button" onClick={() => setActiveCollection(null)} title="Back">
            <ChevronLeft size={21} />
          </button>
          <div className="collection-detail-title">
            <strong>{activeCollection.name}</strong>
            <span>{activeTabCount} tabs</span>
          </div>
        </div>

        {activeSessions.length === 0 ? (
          <EmptyState
            compact
            icon={activeCollection.type === "folder" ? <FolderOpen size={42} /> : <TagIcon size={42} />}
            title="No tabs here yet"
            description={`Save tabs into this ${activeCollection.type} and they will appear here.`}
          />
        ) : (
          <div className="collection-detail-list">
            {activeSessions.map((session) => (
              <GlassCard className="collection-session-card" key={session.id}>
                <div className="collection-session-heading">
                  <strong>{session.name}</strong>
                  <span>{session.tabs.length} tabs</span>
                </div>
                <div className="mobile-list mobile-session-tabs home-compact-tabs">
                  {session.tabs.map((tab) => (
                    <TabRow
                      key={tab.id}
                      title={tab.title}
                      subtitle={getDomainLabel(tab.url)}
                      favIconUrl={tab.favIconDataUrl ?? tab.favIconUrl}
                      preview={tabPreview(tab)}
                      showCheckbox={false}
                      onSelect={() => void handleOpenTab(session, tab)}
                    />
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mobile-toolbar">
        <label className="mobile-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search folders and tags" />
        </label>
        <MobileIconButton title="Create folder" onClick={() => setEditor({ type: "folder", item: null })}>
          <Plus size={18} />
        </MobileIconButton>
      </div>

      <div className="mobile-list">
        <GlassCard className="folder-row-card">
          <div className="folder-row-icon folder-row-icon-soft">
            <Heart size={23} />
          </div>
          <div className="folder-row-copy">
            <strong>Favourites</strong>
            <span>{pinnedTabs} tabs</span>
          </div>
          <MobileIconButton title="Pinned sessions">
            <MoreHorizontal size={18} />
          </MobileIconButton>
        </GlassCard>

        {visibleFolders.map((folder) => (
          <GlassCard className="folder-row-card" key={folder.id}>
            <button
              className="folder-row-main-button"
              type="button"
              onClick={() => setActiveCollection({ type: "folder", id: folder.id, name: folder.name, color: folder.color })}
            >
              <div className="folder-row-icon" style={{ background: `${folder.color}18`, color: folder.color }}>
                <FolderOpen size={23} />
              </div>
              <div className="folder-row-copy">
                <strong>{folder.name}</strong>
                <span>{folderCounts.get(folder.id) ?? 0} tabs</span>
              </div>
            </button>
            <MobileIconButton title="Edit folder" onClick={() => setEditor({ type: "folder", item: folder })}>
              <Edit3 size={17} />
            </MobileIconButton>
            <MobileIconButton title="Delete folder" danger onClick={() => setPendingDelete({ type: "folder", item: folder })}>
              <Trash2 size={17} />
            </MobileIconButton>
          </GlassCard>
        ))}

        <div className="organizer-section-heading">
          <h2>Tags</h2>
          <button type="button" onClick={() => setEditor({ type: "tag", item: null })}>
            <Plus size={16} />
            New tag
          </button>
        </div>

        {visibleTags.map((tag) => (
          <GlassCard className="folder-row-card" key={tag.id}>
            <button
              className="folder-row-main-button"
              type="button"
              onClick={() => setActiveCollection({ type: "tag", id: tag.id, name: tag.name, color: tag.color })}
            >
              <div className="folder-row-icon" style={{ background: `${tag.color}18`, color: tag.color }}>
                <TagIcon size={23} />
              </div>
              <div className="folder-row-copy">
                <strong>{tag.name}</strong>
                <span>{tagCounts.get(tag.id) ?? 0} tabs</span>
              </div>
            </button>
            <MobileIconButton title="Edit tag" onClick={() => setEditor({ type: "tag", item: tag })}>
              <Edit3 size={17} />
            </MobileIconButton>
            <MobileIconButton title="Delete tag" danger onClick={() => setPendingDelete({ type: "tag", item: tag })}>
              <Trash2 size={17} />
            </MobileIconButton>
          </GlassCard>
        ))}

        {visibleFolders.length === 0 && visibleTags.length === 0 ? (
          <GlassCard className="folder-empty-card">
            <EmptyState
              icon={<FolderOpen size={48} />}
              title={query ? "Nothing found" : "Create your first folder"}
              description={
                query
                  ? "No folder or tag matches that search."
                  : "Create folders and tags to keep saved tab sets tidy."
              }
              action={
                <button className="mobile-primary-button" type="button" onClick={() => setEditor({ type: "folder", item: null })}>
                  Create Folder
                </button>
              }
            />
          </GlassCard>
        ) : null}
      </div>

      {editor?.type === "folder" ? (
        <FolderEditor folder={editor.item} addToast={addToast} onClose={() => setEditor(null)} />
      ) : null}

      {editor?.type === "tag" ? (
        <TagEditor tag={editor.item} addToast={addToast} onClose={() => setEditor(null)} />
      ) : null}

      {pendingDelete ? (
        <MobileConfirmSheet
          title={`Delete ${pendingDelete.type}?`}
          message={`"${pendingDelete.item.name}" will be removed. Saved sessions will stay intact.`}
          confirmLabel="Delete"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete.type === "folder") {
              unassignFolder(pendingDelete.item.id);
              deleteFolder(pendingDelete.item.id);
            } else {
              removeTagReferences(pendingDelete.item.id);
              deleteTag(pendingDelete.item.id);
            }
            addToast("success", `${pendingDelete.type[0].toUpperCase()}${pendingDelete.type.slice(1)} deleted.`);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}
