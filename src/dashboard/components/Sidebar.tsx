import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Archive, Layers, Pin, Settings, Upload } from "lucide-react";
import EntityEditorModal from "@/components/shared/EntityEditorModal";
import { useFolderStore } from "@/store/folderStore";
import { useSessionStore } from "@/store/sessionStore";
import { useTagStore } from "@/store/tagStore";

type DashView = "sessions" | "settings" | "importexport";

interface Props {
  view: DashView;
  setView: (view: DashView) => void;
}

const FOLDER_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

function NavItem({
  label,
  active,
  onClick,
  Icon,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: active ? "var(--color-accent-dim)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
        cursor: "pointer",
        transition: "all var(--transition)",
        fontSize: 13,
      }}
    >
      <Icon size={15} />
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      {typeof count === "number" ? <span className="badge badge-subtle">{count}</span> : null}
    </button>
  );
}

export default function Sidebar({ view, setView }: Props) {
  const sessions = useSessionStore((state) => state.sessions);
  const viewFilter = useSessionStore((state) => state.viewFilter);
  const activeFolderId = useSessionStore((state) => state.activeFolderId);
  const activeTagId = useSessionStore((state) => state.activeTagId);
  const setViewFilter = useSessionStore((state) => state.setViewFilter);
  const setActiveFolderId = useSessionStore((state) => state.setActiveFolderId);
  const setActiveTagId = useSessionStore((state) => state.setActiveTagId);

  const folders = useFolderStore((state) => state.folders);
  const createFolder = useFolderStore((state) => state.createFolder);
  const tags = useTagStore((state) => state.tags);
  const createTag = useTagStore((state) => state.createTag);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  const activeSessions = sessions.filter((session) => !session.isArchived);
  const pinnedSessions = sessions.filter((session) => session.isPinned && !session.isArchived);
  const archivedSessions = sessions.filter((session) => session.isArchived);

  return (
    <aside
      style={{
        width: 260,
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "24px 18px 18px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="brand-mark">
            <Layers size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700 }}>
              TabNest
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              Built to outlast tab chaos.
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)" }}>
        <NavItem
          label="All sessions"
          active={view === "sessions" && viewFilter === "all" && !activeFolderId && !activeTagId}
          onClick={() => {
            setView("sessions");
            setViewFilter("all");
            setActiveFolderId(null);
            setActiveTagId(null);
          }}
          Icon={Layers}
          count={activeSessions.length}
        />
        <NavItem
          label="Pinned"
          active={view === "sessions" && viewFilter === "pinned"}
          onClick={() => {
            setView("sessions");
            setViewFilter("pinned");
            setActiveFolderId(null);
            setActiveTagId(null);
          }}
          Icon={Pin}
          count={pinnedSessions.length}
        />
        <NavItem
          label="Archived"
          active={view === "sessions" && viewFilter === "archived"}
          onClick={() => {
            setView("sessions");
            setViewFilter("archived");
            setActiveFolderId(null);
            setActiveTagId(null);
          }}
          Icon={Archive}
          count={archivedSessions.length}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Folders</span>
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => setShowFolderModal(true)}
            >
              Add
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {folders.map((folder) => {
              const active = activeFolderId === folder.id && view === "sessions";
              const count = sessions.filter(
                (session) => session.folderId === folder.id && !session.isArchived,
              ).length;

              return (
                <button
                  key={folder.id}
                  onClick={() => {
                    setView("sessions");
                    setActiveFolderId(activeFolderId === folder.id ? null : folder.id);
                    setViewFilter("all");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${active ? folder.color : "var(--color-border)"}`,
                    background: active ? `${folder.color}18` : "var(--color-surface-raised)",
                    color: active ? folder.color : "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: folder.color,
                      boxShadow: `0 0 0 4px ${folder.color}22`,
                    }}
                  />
                  <span style={{ flex: 1, textAlign: "left" }}>{folder.name}</span>
                  <span className="badge badge-subtle">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 18 }}>
          <div className="sidebar-section-header">
            <span>Tags</span>
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => setShowTagModal(true)}
            >
              Add
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tags.map((tag) => {
              const active = activeTagId === tag.id && view === "sessions";
              const count = sessions.filter(
                (session) => session.tagIds.includes(tag.id) && !session.isArchived,
              ).length;

              return (
                <button
                  key={tag.id}
                  className="tag-chip"
                  data-active={active}
                  onClick={() => {
                    setView("sessions");
                    setActiveTagId(activeTagId === tag.id ? null : tag.id);
                    setViewFilter("all");
                  }}
                  style={{
                    borderColor: active ? tag.color : "var(--color-border)",
                    color: active ? tag.color : "var(--color-text-secondary)",
                    background: active ? `${tag.color}22` : "transparent",
                  }}
                >
                  {tag.name}
                  <span style={{ opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--color-border)" }}>
        <NavItem
          label="Import and export"
          active={view === "importexport"}
          onClick={() => setView("importexport")}
          Icon={Upload}
        />
        <NavItem
          label="Settings"
          active={view === "settings"}
          onClick={() => setView("settings")}
          Icon={Settings}
        />
      </div>

      {showFolderModal ? (
        <EntityEditorModal
          mode="folder"
          title="Create folder"
          submitLabel="Create folder"
          initialValue={{ color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length], icon: "briefcase" }}
          onClose={() => setShowFolderModal(false)}
          onSubmit={({ name, color, icon }) => {
            createFolder(name, color, icon);
            setShowFolderModal(false);
            setView("sessions");
          }}
        />
      ) : null}

      {showTagModal ? (
        <EntityEditorModal
          mode="tag"
          title="Create tag"
          submitLabel="Create tag"
          initialValue={{ color: FOLDER_COLORS[tags.length % FOLDER_COLORS.length] }}
          onClose={() => setShowTagModal(false)}
          onSubmit={({ name, color }) => {
            createTag(name, color);
            setShowTagModal(false);
            setView("sessions");
          }}
        />
      ) : null}
    </aside>
  );
}
