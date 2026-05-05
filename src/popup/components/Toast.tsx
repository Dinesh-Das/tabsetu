import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Info, XCircle } from "lucide-react";
import type { ToastMessage } from "@/types";

interface Props {
  toasts: ToastMessage[];
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: "var(--color-success)",
  error: "var(--color-danger)",
  info: "var(--color-accent)",
};

export default function Toast({ toasts }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9999,
        minWidth: 280,
        maxWidth: 420,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: "rgba(15, 23, 42, 0.5)",
                backdropFilter: "blur(22px) saturate(1.4)",
                WebkitBackdropFilter: "blur(22px) saturate(1.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderLeft: `3px solid ${colors[toast.type]}`,
                borderRadius: 16,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.15), 0 0 20px ${colors[toast.type]}33`,
                pointerEvents: "all" as const,
              }}
            >
              <Icon size={16} color={colors[toast.type]} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>
                {toast.message}
              </span>
              {toast.actionLabel && toast.onAction ? (
                <button
                  className="btn btn-ghost"
                  style={{ padding: "4px 8px", height: 28 }}
                  onClick={toast.onAction}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
