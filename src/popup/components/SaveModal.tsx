import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Heart,
  Layers,
  Plus,
  Tag,
} from "lucide-react";
import { BottomSheet } from "@/components/mobile/MobileUI";
import type { Session, ToastMessage } from "@/types";
import { closeTabs, collectTabsForSession, chromeTabToTabItem } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { useGroupStore } from "@/store/groupStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";

interface Props {
  mode: "save" | "collapse";
  selectedTabIds: number[];
  onClose: () => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onCollapseSaved?: (payload: { session: Session; windowId: number | null }) => void;
}

function defaultSessionName(closeAfterSaving: boolean): string {
  const label = closeAfterSaving ? "Collapsed tabs" : "Saved tabs";
  return `${label} ${new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function SaveModal({ mode, selectedTabIds, onClose, addToast, onCollapseSaved }: Props) {
  const createSession = useSessionStore((state) => state.createSession);
  const folders = useFolderStore((state) => state.folders);
  const createFolder = useFolderStore((state) => state.createFolder);
  const tags = useTagStore((state) => state.tags);
  const createTag = useTagStore((state) => state.createTag);
  const groups = useGroupStore((state) => state.groups);
  const createGroup = useGroupStore((state) => state.createGroup);
  const settings = useSettingsStore((state) => state.settings);

  const usesSelectedTabs = selectedTabIds.length > 0;
  const [folderId, setFolderId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [groupId, setGroupId] = useState("");
  const [includePinned, setIncludePinned] = useState(mode === "save" ? true : settings.collapseIncludesPinned);
  const [closeAfterSave, setCloseAfterSave] = useState(mode === "collapse");
  const [tabCount, setTabCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    let cancelled = false;

    void collectTabsForSession({
      selectedTabIds,
      includePinned: usesSelectedTabs ? true : includePinned,
    }).then((tabs) => {
      if (!cancelled) {
        setTabCount(tabs.length);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [includePinned, selectedTabIds, usesSelectedTabs]);

  const sheetTitle = useMemo(() => {
    const count = tabCount || selectedTabIds.length || 1;
    return mode === "collapse" || closeAfterSave
      ? `Save ${count} ${count === 1 ? "tab" : "tabs"}`
      : `Save ${count} ${count === 1 ? "tab" : "tabs"}`;
  }, [closeAfterSave, mode, selectedTabIds.length, tabCount]);

  const selectedFolder = folders.find((folder) => folder.id === folderId) ?? null;

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((existing) => existing !== tagId)
        : [...current, tagId],
    );
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) {
      addToast("info", "Name the folder first.");
      return;
    }

    createFolder(name, "#1677ee", "folder");
    const created = useFolderStore.getState().folders.slice(-1)[0];
    if (created) {
      setFolderId(created.id);
    }
    setNewFolderName("");
    setCreatingFolder(false);
    addToast("success", `Created folder "${name}".`);
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) {
      addToast("info", "Name the tag first.");
      return;
    }

    createTag(name, "#1677ee");
    const created = useTagStore.getState().tags.slice(-1)[0];
    if (created) {
      setSelectedTagIds((current) => [...current, created.id]);
    }
    setNewTagName("");
    setCreatingTag(false);
    addToast("success", `Created tag "${name}".`);
  };

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) {
      addToast("info", "Name the group first.");
      return;
    }

    const created = createGroup(name, "#1677ee");
    setGroupId(created.id);
    setNewGroupName("");
    setCreatingGroup(false);
    setGroupsOpen(true);
    addToast("success", `Created group "${name}".`);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const tabs = await collectTabsForSession({
        selectedTabIds,
        includePinned: usesSelectedTabs ? true : includePinned,
      });

      if (tabs.length === 0) {
        addToast("error", "No valid tabs are available for this action.");
        return;
      }

      const session = createSession(
        defaultSessionName(closeAfterSave),
        selectedFolder ? `Saved to ${selectedFolder.name}` : "",
        tabs.map(chromeTabToTabItem),
        folderId || null,
        selectedTagIds,
        groupId || null,
      );

      if (closeAfterSave) {
        const windowId = tabs[0]?.windowId ?? null;
        await closeTabs(tabs);
        onCollapseSaved?.({ session, windowId });
        addToast("success", `Saved and closed ${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"}.`);
      } else {
        addToast("success", `Saved ${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"} to TabSetu.`);
      }

      onClose();
    } catch {
      addToast("error", "TabSetu could not save that session.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
      title={sheetTitle}
      subtitle="Organize before saving"
      onClose={onClose}
      footer={
        <button
          className="mobile-primary-button save-sheet-primary"
          type="button"
          disabled={isSaving || tabCount === 0}
          onClick={() => void handleSave()}
        >
          {closeAfterSave ? `Save and close ${tabCount || ""} tabs` : `Save ${tabCount || ""} tabs`}
        </button>
      }
    >
      <div className="save-sheet-stack">
        <section className="mobile-accordion">
          <button className="mobile-accordion-header" type="button" onClick={() => setFoldersOpen((open) => !open)}>
            <span>Folders</span>
            {foldersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {foldersOpen ? (
            <>
              <button
                className="mobile-accordion-row"
                type="button"
                data-active={!folderId || undefined}
                onClick={() => setFolderId("")}
              >
                <span>
                  <Heart size={18} />
                  Favourites (0)
                </span>
                {!folderId ? <Check size={17} /> : null}
              </button>
              {folders.map((folder) => (
                <button
                  className="mobile-accordion-row"
                  type="button"
                  key={folder.id}
                  data-active={folderId === folder.id || undefined}
                  onClick={() => setFolderId(folder.id)}
                >
                  <span>
                    <FolderOpen size={18} color={folder.color} />
                    {folder.name}
                  </span>
                  {folderId === folder.id ? <Check size={17} /> : null}
                </button>
              ))}
              {creatingFolder ? (
                <div className="save-sheet-create-row">
                  <input
                    className="mobile-input"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    placeholder="Folder name"
                    autoFocus
                  />
                  <button className="mobile-primary-button" type="button" onClick={handleCreateFolder}>
                    Add
                  </button>
                </div>
              ) : (
                <button className="mobile-accordion-row" type="button" onClick={() => setCreatingFolder(true)}>
                  <span>
                    <Plus size={18} />
                    Create folder
                  </span>
                </button>
              )}
            </>
          ) : null}
        </section>

        <section className="mobile-accordion">
          <button className="mobile-accordion-header" type="button" onClick={() => setTagsOpen((open) => !open)}>
            <span>Tags</span>
            {tagsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {tagsOpen ? (
            <div className="save-sheet-tags">
              {tags.length > 0 ? (
                <div className="mobile-chip-row">
                  {tags.map((tag) => (
                    <button
                      className="mobile-chip"
                      type="button"
                      key={tag.id}
                      data-active={selectedTagIds.includes(tag.id) || undefined}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <Tag size={14} />
                      {tag.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {creatingTag ? (
                <div className="save-sheet-create-row">
                  <input
                    className="mobile-input"
                    value={newTagName}
                    onChange={(event) => setNewTagName(event.target.value)}
                    placeholder="Tag name"
                    autoFocus
                  />
                  <button className="mobile-primary-button" type="button" onClick={handleCreateTag}>
                    Add
                  </button>
                </div>
              ) : (
                <button className="mobile-accordion-row save-sheet-create-button" type="button" onClick={() => setCreatingTag(true)}>
                  <span>
                    <Tag size={18} />
                    Create tag
                  </span>
                </button>
              )}
            </div>
          ) : null}
        </section>

        <section className="mobile-accordion">
          <button className="mobile-accordion-header" type="button" onClick={() => setGroupsOpen((open) => !open)}>
            <span>
              <Layers size={18} />
              Group
            </span>
            {groupsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {groupsOpen ? (
            <>
              <button
                className="mobile-accordion-row"
                type="button"
                data-active={!groupId || undefined}
                onClick={() => setGroupId("")}
              >
                <span>No group</span>
                {!groupId ? <Check size={17} /> : null}
              </button>
              {groups.map((group) => (
                <button
                  className="mobile-accordion-row"
                  type="button"
                  key={group.id}
                  data-active={groupId === group.id || undefined}
                  onClick={() => setGroupId(group.id)}
                >
                  <span>
                    <Layers size={18} color={group.color} />
                    {group.name}
                  </span>
                  {groupId === group.id ? <Check size={17} /> : null}
                </button>
              ))}
              {creatingGroup ? (
                <div className="save-sheet-create-row">
                  <input
                    className="mobile-input"
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder="Group name"
                    autoFocus
                  />
                  <button className="mobile-primary-button" type="button" onClick={handleCreateGroup}>
                    Add
                  </button>
                </div>
              ) : (
                <button className="mobile-accordion-row" type="button" onClick={() => setCreatingGroup(true)}>
                  <span>
                    <Plus size={18} />
                    Create group
                  </span>
                </button>
              )}
            </>
          ) : null}
        </section>

        {!usesSelectedTabs ? (
          <div className="save-sheet-option-row">
            <span>Include pinned tabs</span>
            <button
              className="mobile-switch"
              type="button"
              data-active={includePinned || undefined}
              onClick={() => setIncludePinned((current) => !current)}
            />
          </div>
        ) : null}

        <div className="save-sheet-option-row">
          <span>Close tabs after saving</span>
          <button
            className="mobile-switch"
            type="button"
            data-active={closeAfterSave || undefined}
            onClick={() => setCloseAfterSave((current) => !current)}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
