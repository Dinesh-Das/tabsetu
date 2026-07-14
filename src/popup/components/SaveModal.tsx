import { useEffect, useMemo, useState } from "react";
import { Check, FolderOpen, Paintbrush, Plus, Tag } from "lucide-react";
import { BottomSheet } from "@/components/mobile/MobileUI";
import type { ToastMessage, UndoCollapseBuffer } from "@/types";
import { COLLAPSE_UNDO_MS, saveUndoBuffer } from "@/lib/storage";
import { commitCollapseTransaction } from "@/lib/collapseTransaction";
import { defaultSavedSessionTitle } from "@/lib/sessionLabels";
import {
  closeTabs,
  collectTabsForSession,
  chromeTabToTabItemWithFavicon,
  getPreferredBrowserTab,
  sanitizeLabel,
} from "@/lib/tabHelpers";
import { useFolderStore } from "@/store/folderStore";
import { flushSessionPersistence, useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTagStore } from "@/store/tagStore";

interface Props {
  mode: "save" | "collapse";
  selectedTabIds: number[];
  preferredTitleTabId?: number | null | undefined;
  onClose: () => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onCollapseSaved?: ((buffer: UndoCollapseBuffer) => void) | undefined;
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

function titleFromTabs(tabs: chrome.tabs.Tab[], preferredTitleTabId?: number | null): string {
  const preferredTab = preferredTitleTabId
    ? tabs.find((tab) => tab.id === preferredTitleTabId)
    : null;
  const titleTab = preferredTab ?? tabs.find((tab) => tab.active) ?? tabs[0];
  if (!titleTab) {
    return "";
  }

  const title = sanitizeLabel(titleTab.title, "Untitled session", 100);
  const extraTabCount = tabs.length - 1;
  if (extraTabCount <= 0) {
    return title;
  }

  return `${title} + ${extraTabCount} ${extraTabCount === 1 ? "tab" : "tabs"}`;
}

export default function SaveModal({
  mode,
  selectedTabIds,
  preferredTitleTabId,
  onClose,
  addToast,
  onCollapseSaved,
}: Props) {
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
  const [sessionTitle, setSessionTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [includePinned, setIncludePinned] = useState(
    mode === "save" ? true : settings.collapseIncludesPinned
  );
  const [closeAfterSave, setCloseAfterSave] = useState(mode === "collapse");
  const [tabCount, setTabCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    setIncludePinned(mode === "save" ? true : settings.collapseIncludesPinned);
    setCloseAfterSave(mode === "collapse");
  }, [mode, settings.collapseIncludesPinned]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      collectTabsForSession({
        selectedTabIds,
        includePinned: usesSelectedTabs ? true : includePinned,
      }),
      preferredTitleTabId ? Promise.resolve(null) : getPreferredBrowserTab().catch(() => null),
    ]).then(([tabs, preferredTab]) => {
      if (!cancelled) {
        setTabCount(tabs.length);
        if (!titleEdited) {
          setSessionTitle(titleFromTabs(tabs, preferredTitleTabId ?? preferredTab?.id ?? null));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [includePinned, preferredTitleTabId, selectedTabIds, titleEdited, usesSelectedTabs]);

  const sheetTitle = useMemo(() => {
    const count = tabCount || selectedTabIds.length || 1;
    const noun = count === 1 ? "tab" : "tabs";
    return closeAfterSave ? `Save and collapse ${count} ${noun}` : `Save ${count} ${noun}`;
  }, [closeAfterSave, selectedTabIds.length, tabCount]);

  const primaryActionLabel = useMemo(() => {
    const count = tabCount || selectedTabIds.length;
    if (count <= 0) {
      return closeAfterSave ? "Save and collapse tabs" : "Save tabs";
    }

    const noun = count === 1 ? "tab" : "tabs";
    return closeAfterSave ? `Save and collapse ${count} ${noun}` : `Save ${count} ${noun}`;
  }, [closeAfterSave, selectedTabIds.length, tabCount]);

  const selectedFolder = folders.find((folder) => folder.id === folderId) ?? null;

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((existing) => existing !== tagId)
        : [...current, tagId]
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
        tabs.map((tab, index) => chromeTabToTabItemWithFavicon(tab, index))
      );

      const session = createSession(
        sessionTitle.trim() || defaultSavedSessionTitle(closeAfterSave, savedTabs),
        selectedFolder ? `Saved to ${selectedFolder.name}` : "",
        savedTabs,
        folderId || null,
        selectedTagIds
      );

      if (sessionColor) {
        updateSession(session.id, { color: sessionColor });
      }

      if (closeAfterSave) {
        const windowId = tabs[0]?.windowId ?? null;
        const createdAt = Date.now();
        const buffer: UndoCollapseBuffer = {
          sessionId: session.id,
          sessionName: session.name,
          tabs: session.tabs,
          windowId,
          createdAt,
          expiresAt: createdAt + COLLAPSE_UNDO_MS,
        };
        await commitCollapseTransaction({
          buffer,
          flushSession: flushSessionPersistence,
          persistUndoBuffer: saveUndoBuffer,
          closeBrowserTabs: () => closeTabs(tabs),
        });
        window.setTimeout(() => {
          void saveUndoBuffer(null);
        }, COLLAPSE_UNDO_MS);
        onCollapseSaved?.(buffer);
        addToast(
          "success",
          `Saved and collapsed ${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"}.`
        );
      } else {
        await flushSessionPersistence();
        addToast(
          "success",
          `Saved ${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"} to TabSetu.`
        );
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
      subtitle={
        closeAfterSave ? "Review details, then save and collapse." : "Review details before saving."
      }
      onClose={onClose}
      className="save-bottom-sheet"
      footer={
        <button
          className="mobile-primary-button save-sheet-primary"
          type="button"
          disabled={isSaving || tabCount === 0}
          onClick={() => void handleSave()}
        >
          {primaryActionLabel}
        </button>
      }
    >
      <div className="save-sheet-stack">
        <label className="save-sheet-field">
          <span>Title</span>
          <input
            className="mobile-input"
            value={sessionTitle}
            onChange={(event) => {
              setTitleEdited(true);
              setSessionTitle(event.target.value);
            }}
            placeholder="Session title"
          />
        </label>

        <section className="save-sheet-panel">
          <div className="save-sheet-panel-header">
            <span>Folder</span>
            <strong>{selectedFolder?.name ?? "No folder"}</strong>
          </div>
          <div className="save-sheet-choice-row">
            <button
              className="save-sheet-choice"
              type="button"
              data-active={!folderId || undefined}
              onClick={() => setFolderId("")}
            >
              <FolderOpen size={15} />
              No folder
            </button>
            {folders.map((folder) => (
              <button
                className="save-sheet-choice"
                type="button"
                key={folder.id}
                data-active={folderId === folder.id || undefined}
                onClick={() => setFolderId(folder.id)}
              >
                <FolderOpen size={15} color={folder.color} />
                {folder.name}
              </button>
            ))}
          </div>
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
            <button
              className="save-sheet-inline-action"
              type="button"
              onClick={() => setCreatingFolder(true)}
            >
              <Plus size={15} />
              New folder
            </button>
          )}
        </section>

        <section className="save-sheet-panel">
          <div className="save-sheet-panel-header">
            <span>Tags</span>
            <strong>
              {selectedTagIds.length ? `${selectedTagIds.length} selected` : "Optional"}
            </strong>
          </div>
          {tags.length !== 0 ? (
            <div className="save-sheet-choice-row">
              {tags.map((tag) => (
                <button
                  className="save-sheet-choice"
                  type="button"
                  key={tag.id}
                  data-active={selectedTagIds.includes(tag.id) || undefined}
                  onClick={() => toggleTag(tag.id)}
                >
                  <Tag size={14} color={tag.color} />
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
            <button
              className="save-sheet-inline-action"
              type="button"
              onClick={() => setCreatingTag(true)}
            >
              <Plus size={15} />
              New tag
            </button>
          )}
        </section>

        <section className="save-sheet-panel">
          <div className="save-sheet-panel-header">
            <span className="save-sheet-icon-label">
              <Paintbrush size={18} />
              Color label
            </span>
            <strong>Optional</strong>
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

        <section className="save-sheet-panel save-sheet-options">
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
        </section>
      </div>
    </BottomSheet>
  );
}
