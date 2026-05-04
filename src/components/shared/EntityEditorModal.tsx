import { useState } from "react";
import type { Folder, Tag } from "@/types";
import ModalShell from "@/components/shared/ModalShell";

const COLOR_OPTIONS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#F43F5E",
  "#8B5CF6",
  "#0EA5E9",
  "#14B8A6",
  "#84CC16",
];

const ICON_OPTIONS = [
  "briefcase",
  "book-open",
  "home",
  "flask-conical",
  "sparkles",
  "folder",
];

interface Props {
  mode: "folder" | "tag";
  title: string;
  submitLabel: string;
  initialValue?: Partial<Folder & Tag>;
  onSubmit: (value: { name: string; color: string; icon: string }) => void;
  onClose: () => void;
}

export default function EntityEditorModal({
  mode,
  title,
  submitLabel,
  initialValue,
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [color, setColor] = useState(initialValue?.color ?? COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState(initialValue?.icon ?? ICON_OPTIONS[0]);

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      color,
      icon,
    });
  };

  return (
    <ModalShell
      title={title}
      description={mode === "folder" ? "Give this folder a clear visual identity." : "Create a reusable label for filtering sessions."}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button className="btn btn-secondary" type="button" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" style={{ flex: 1.2 }}>
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="form-stack">
        <div>
          <label className="label">{mode === "folder" ? "Folder name" : "Tag name"}</label>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={mode === "folder" ? "Workstreams" : "Urgent"}
            autoFocus
          />
        </div>

        <div>
          <label className="label">Color</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {COLOR_OPTIONS.map((option) => (
              <button
                key={option}
                className="color-swatch"
                type="button"
                data-active={color === option}
                style={{ background: option }}
                onClick={() => setColor(option)}
                title={option}
              />
            ))}
          </div>
        </div>

        {mode === "folder" ? (
          <div>
            <label className="label">Icon</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ICON_OPTIONS.map((option) => (
                <button
                  key={option}
                  className="tag-chip"
                  type="button"
                  data-active={icon === option}
                  onClick={() => setIcon(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
