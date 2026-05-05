import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Paintbrush,
  Plus,
  Tag,
} from "lucide-react";
import { BottomSheet } from "@/components/mobile/MobileUI";
import type { Session, ToastMessage } from "@/types";
import { defaultSavedSessionTitle } from "@/lib/sessionLabels";
import { closeTabs, collectTabsForSession, chromeTabToTabItemWithFavicon } from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
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

const COLOR_LABELS: Array<{ value: string | null; label: string }> = [
  { value: null, label: "None" },
  { value: "#EF4444", label: "Red" },
  { value: "#F97316", label: "Orange" },
  { value: "#EAB308", label: "Yellow" },
  { value: "#22C55E", label: "Green" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6B7280", label: "Gray" },
];

export default function SaveModal({ mode, selectedTabIds, onClose, addToast, onCollapseSaved }: Props) {
  const createSession = useSessionStore((state) => state.createSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  const folders = useFolderStore((state) => state.folders);
  const createFolder = useFolderStore((state) => state.createFolder);
  const tags = useTagStore((state) => state.tags);
  const createTag = useTagStore((state) => state.createTag);
  const settings = useSettingsStore((state) => state.settings);

  const usesSelectedTabs = selectedTabIds.length !== 0;
  const [folderId, setFolderId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [sessionColor, setSessionColor] = useState<string | null>(null);
  const [includePinned, setIncludePinned] = useState(mode === "save" ? true : settings.collapseIncludesPinned);
  const [closeAfterSave, setCloseAfterSave] = useState(mode === "collapse");
  const [tabCount, setTabCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newTagName, setNewTagName] = useState("");

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

      const savedTabs = await Promise.all(
        tabs.map((tab, index) => chromeTabToTabItemWithFavicon(tab, index)),
      );

      const session = createSession(
        defaultSavedSessionTitle(closeAfterSave, savedTabs),
        selectedFolder ? `Saved to ${selectedFolder.name}` : "",
        savedTabs,
        folderId || null,
        selectedTagIds,
      );

      if (sessionColor) {
        updateSession(session.id, { color: sessionColor });
      }

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
                  <FolderOpen size={18} />
                  No folder
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
              {tags.length !== 0 ? (
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

        <section className="mobile-accordion save-sheet-tags">
          <div className="mobile-accordion-header">
            <span>
              <Paintbrush size={18} />
              Color label
            </span>
            <span style={{ fontSize: 12, color: "var(--mobile-muted)", textTransform: "none" }}>Optional</span>
          </div>
          <div className="mobile-color-row">
            {COLOR_LABELS.map((colorLabel) => (
              <button
                key={colorLabel.value ?? "none"}
                className="mobile-color-dot"
                type="button"
                data-active={sessionColor === colorLabel.value || undefined}
                onClick={() => setSessionColor(colorLabel.value)}
                title={colorLabel.label}
                aria-label={`Set color label to ${colorLabel.label}`}
                style={{
                  background: colorLabel.value ?? "#e6e9ef",
                  color: colorLabel.value ? "#fff" : "var(--mobile-text)",
                }}
              >
                {sessionColor === colorLabel.value ? <Check size={16} /> : null}
              </button>
            ))}
          </div>
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
