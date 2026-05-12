import ConfirmDialog from "@/components/shared/ConfirmDialog";
import BulkActionBar from "@/popup/components/BulkActionBar";
import QuickInfoCard from "@/popup/components/QuickInfoCard";
import SessionCard from "@/popup/components/SessionCard";
import {
  type SavedSessionsControllerOptions,
  useSavedSessionsController,
} from "@/popup/components/useSavedSessionsController";

type Props = SavedSessionsControllerOptions;

export default function SavedSessions(props: Props) {
  const controller = useSavedSessionsController(props);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <BulkActionBar {...controller.bulkActionBarProps} />

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {controller.visibleItems.length === 0 ? <EmptySessions query={props.query} /> : null}
        {controller.visibleItems.map((item, index) => (
          <SessionCard key={item.session.id} {...controller.getCardProps(item, index)} />
        ))}
      </div>

      {controller.quickInfoProps ? <QuickInfoCard {...controller.quickInfoProps} /> : null}

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
    </div>
  );
}

function EmptySessions({ query }: { query: string }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 18px", color: "var(--color-text-muted)" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-secondary)" }}>
        {query ? "No sessions match that search" : "No saved sessions yet"}
      </div>
      <div style={{ fontSize: 12, marginTop: 6 }}>
        {query
          ? "Try a different keyword, folder, or tag."
          : "Save your current tabs and TabSetu will keep the workflow ready."}
      </div>
    </div>
  );
}
