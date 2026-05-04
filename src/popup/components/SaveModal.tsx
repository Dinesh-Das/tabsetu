import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Tag, X } from "lucide-react";
import type { Session, ToastMessage } from "@/types";
import { closeTabs, collectTabsForSession, chromeTabToTabItem } from "@/lib/tabHelpers";
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

export default function SaveModal({ mode, selectedTabIds, onClose, addToast, onCollapseSaved }: Props) {
  const createSession = useSessionStore((state) => state.createSession);
  const folders = useFolderStore((state) => state.folders);
  const tags = useTagStore((state) => state.tags);
  const settings = useSettingsStore((state) => state.settings);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [includePinned, setIncludePinned] = useState(mode === "save" ? true : settings.collapseIncludesPinned);
  const [tabCount, setTabCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const usesSelectedTabs = selectedTabIds.length > 0;
  const closeAfterSaving = mode === "collapse";

  useEffect(() => {
    const label = closeAfterSaving ? "Collapse" : "Session";
    setName(
      `${label} ${new Date().toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    );
  }, [closeAfterSaving]);

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

  const summaryText = useMemo(() => {
    if (usesSelectedTabs) {
      return `Saving ${tabCount} selected ${tabCount === 1 ? "tab" : "tabs"}.`;
    }

    if (closeAfterSaving) {
      return `Saving and closing ${tabCount} ${tabCount === 1 ? "tab" : "tabs"} from this window.`;
    }

    return `Saving ${tabCount} ${tabCount === 1 ? "tab" : "tabs"} from this window.`;
  }, [closeAfterSaving, tabCount, usesSelectedTabs]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((existing) => existing !== tagId)
        : [...current, tagId],
    );
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
        setIsSaving(false);
        return;
      }

      const session = createSession(
        name,
        description,
        tabs.map(chromeTabToTabItem),
        folderId || null,
        selectedTagIds,
      );

      if (closeAfterSaving) {
        const windowId = tabs[0]?.windowId ?? null;
        await closeTabs(tabs);
        onCollapseSaved?.({ session, windowId });
        addToast("success", `Collapsed ${tabs.length} tabs into "${session.name}".`);
      } else {
        addToast("success", `Saved "${session.name}" with ${tabs.length} tabs.`);
      }

      onClose();
    } catch {
      addToast("error", "TabNest could not save that session.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal animate-scale-in" style={{ maxWidth: 400 }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: 18 }}>{closeAfterSaving ? "Collapse current window" : "Save session"}</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
                {closeAfterSaving ? "Capture the session, then clear the clutter." : "Turn your current tabs into a reusable workspace."}
              </p>
            </div>
            <button className="btn btn-ghost btn-icon" type="button" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="label">Session name</label>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Untitled Session"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are these tabs for?"
              />
            </div>

            {!usesSelectedTabs ? (
              <label className="toggle-row">
                <span>
                  <strong style={{ display: "block", marginBottom: 2 }}>Include pinned tabs</strong>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    Pinned tabs stay open by default during collapse.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={includePinned}
                  onChange={(event) => setIncludePinned(event.target.checked)}
                />
              </label>
            ) : null}

            {folders.length > 0 ? (
              <div>
                <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FolderOpen size={14} />
                  Folder
                </label>
                <select className="input" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {tags.length > 0 ? (
              <div>
                <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Tag size={14} />
                  Tags
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        className="tag-chip"
                        type="button"
                        data-active={active}
                        style={{
                          borderColor: active ? tag.color : "var(--color-border)",
                          color: active ? tag.color : "var(--color-text-secondary)",
                          background: active ? `${tag.color}22` : "transparent",
                        }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="card-raised" style={{ padding: 12, fontSize: 12, color: "var(--color-text-secondary)" }}>
              {summaryText}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn btn-secondary" type="button" style={{ flex: 1 }} onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" style={{ flex: 1.4 }} disabled={isSaving}>
              {closeAfterSaving ? "Save and close tabs" : "Save session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
