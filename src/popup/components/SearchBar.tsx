import type { RefObject } from "react";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement>;
  inputId?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search sessions, tabs, URLs, folders, and tags...",
  inputRef,
  inputId,
}: Props) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <Search
        size={14}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--color-text-muted)",
          pointerEvents: "none",
        }}
      />
      <input
        id={inputId}
        ref={inputRef}
        className="input"
        style={{ paddingLeft: 34, paddingRight: value ? 34 : 12 }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {value ? (
        <button className="icon-reset" onClick={() => onChange("")} aria-label="Clear search">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
