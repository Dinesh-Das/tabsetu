import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface Props {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  onSubmit?: () => void;
}

export default function ModalShell({
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = 440,
  onSubmit,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const content = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h3 id={titleId} style={{ fontSize: 18 }}>
            {title}
          </h3>
          {description ? (
            <p
              id={descriptionId}
              style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}
            >
              {description}
            </p>
          ) : null}
        </div>
        <button
          className="btn btn-ghost btn-icon"
          type="button"
          onClick={onClose}
          title="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ marginTop: 18 }}>{children}</div>

      {footer ? <div style={{ display: "flex", gap: 10, marginTop: 22 }}>{footer}</div> : null}
    </>
  );

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="modal animate-scale-in"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {onSubmit ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
