import { AlertTriangle } from "lucide-react";
import { BottomSheet } from "@/components/mobile/MobileUI";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function MobileConfirmSheet({
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: Props) {
  return (
    <BottomSheet
      title={title}
      subtitle={message}
      onClose={onClose}
      footer={
        <div className="mobile-confirm-actions">
          <button className="mobile-secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={danger ? "mobile-danger-button" : "mobile-primary-button"}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="mobile-confirm-icon">
        <AlertTriangle size={30} />
      </div>
    </BottomSheet>
  );
}
