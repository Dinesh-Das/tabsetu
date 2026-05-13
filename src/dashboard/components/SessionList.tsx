import ConfirmDialog from "@/components/shared/ConfirmDialog";
import SessionCard from "@/dashboard/components/SessionCard";
import SessionListToolbar from "@/dashboard/components/SessionListToolbar";
import {
  type SessionListControllerOptions,
  useSessionListController,
} from "@/dashboard/components/useSessionListController";
import SaveModal from "@/popup/components/SaveModal";
import type { ReactNode } from "react";

type Props = SessionListControllerOptions & {
  syncBanner?: ReactNode;
};

export default function SessionList(props: Props) {
  const controller = useSessionListController(props);

  return (
    <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SessionListToolbar {...controller.toolbarProps} />
      {props.syncBanner}

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {controller.filteredItems.length === 0 ? (
          <div className="empty-state">
            <h3>No sessions found</h3>
            <p>
              Save your current window or widen the search. TabSetu will keep the structure ready.
            </p>
          </div>
        ) : null}
        <div
          className="session-grid"
          data-card-style={controller.sessionCardStyle}
          style={{ gridTemplateColumns: controller.gridTemplateColumns }}
        >
          {controller.filteredItems.map((item) => (
            <SessionCard key={item.session.id} {...controller.getCardProps(item)} />
          ))}
        </div>
      </div>

      {controller.saveModalPrompt ? (
        <SaveModal
          mode={controller.saveModalPrompt.mode}
          selectedTabIds={[]}
          preferredTitleTabId={controller.saveModalPrompt.sourceTabId}
          onClose={controller.closeSaveModal}
          addToast={props.addToast}
        />
      ) : null}

      {controller.pendingDelete ? (
        <ConfirmDialog
          title="Delete session?"
          message={`"${controller.pendingDelete.name}" will be removed from TabSetu.`}
          confirmLabel="Delete session"
          danger
          onClose={controller.closePendingDelete}
          onConfirm={controller.confirmPendingDelete}
        />
      ) : null}

      {controller.pendingBulkDelete ? (
        <ConfirmDialog
          title="Delete selected sessions?"
          message={`${controller.selectedIds.length} ${
            controller.selectedIds.length === 1 ? "session" : "sessions"
          } will be removed from TabSetu.`}
          confirmLabel="Delete selected"
          danger
          onClose={controller.closePendingBulkDelete}
          onConfirm={controller.confirmBulkDelete}
        />
      ) : null}
    </section>
  );
}
