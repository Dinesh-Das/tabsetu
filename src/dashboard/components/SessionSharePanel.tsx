import { useEffect, useState } from "react";
import { ClipboardCopy, Link2, Sparkles } from "lucide-react";
import type { Session, ToastMessage } from "@/types";
import {
  copyLinksToClipboard,
  downloadMarkdown,
  downloadPlainText,
  generateAIPrompt,
} from "@/lib/exportImport";
import { tryGenerateShareUrl } from "@/lib/shareEncoder";
import { copyTextToClipboard } from "@/lib/sessionBrowser";
import ShareSessionModal from "./ShareSessionModal";

interface Props {
  session: Session;
  addToast: (type: ToastMessage["type"], message: string) => void;
  aiEnabled: boolean;
  defaultAIProvider: string;
}

export default function SessionSharePanel({
  session,
  addToast,
  aiEnabled,
  defaultAIProvider,
}: Props) {
  const [showShareModal, setShowShareModal] = useState(false);
  const shareResult = tryGenerateShareUrl(session);
  void aiEnabled;
  void defaultAIProvider;

  useEffect(() => {
    const open = () => setShowShareModal(true);
    window.addEventListener("tabsetu:open-share-panel", open);
    return () => window.removeEventListener("tabsetu:open-share-panel", open);
  }, []);

  return (
    <>
      <section className="detail-section">
        <div className="detail-section-header">
          <h3>Export and share</h3>
          <span className="badge badge-subtle">Encoded local snapshots</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => downloadMarkdown(session)}>
            <Link2 size={14} />
            Markdown
          </button>
          <button className="btn btn-secondary" onClick={() => downloadPlainText(session)}>
            <ClipboardCopy size={14} />
            Plain text
          </button>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              await copyTextToClipboard(copyLinksToClipboard(session));
              addToast("success", "Copied all session links.");
            }}
          >
            <ClipboardCopy size={14} />
            Copy links
          </button>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              await copyTextToClipboard(generateAIPrompt(session));
              addToast("success", "Copied the AI-ready prompt.");
            }}
          >
            <Sparkles size={14} />
            AI prompt
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setShowShareModal(true)}
          >
            Share modal
          </button>
        </div>
        {!shareResult.ok ? (
          <div className="card-raised share-too-large">
            <p>This session is too large for a URL. Export Markdown or JSON instead.</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => downloadMarkdown(session)}
            >
              <Link2 size={14} />
              Export Markdown
            </button>
          </div>
        ) : null}
      </section>

      {showShareModal ? (
        <ShareSessionModal
          session={session}
          onClose={() => setShowShareModal(false)}
          addToast={addToast}
        />
      ) : null}
    </>
  );
}
