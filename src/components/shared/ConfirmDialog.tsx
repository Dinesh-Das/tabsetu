import ModalShell from "@/components/shared/ModalShell";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      onSubmit={onConfirm}
      footer={
        <>
          <button className="btn btn-secondary" type="button" style={{ flex: 1 }} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            type="submit"
            style={{ flex: 1.2 }}
            autoFocus
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)" }}>{message}</p>
    </ModalShell>
  );
}
