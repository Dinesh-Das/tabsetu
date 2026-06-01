import { useState } from "react";
import { Bot, ClipboardCopy, ExternalLink, Link2 } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";
import {
  copyLinksToClipboard,
  downloadMarkdown,
  generateAIPrompt,
  sessionToMarkdown,
  sessionToPlainText,
} from "@/lib/exportImport";
import { normalizeCustomAIProviderUrl } from "@/lib/aiPromptSharing";
import { createShareSnapshot, encodeShareSnapshot, tryGenerateShareUrl } from "@/lib/shareEncoder";
import { copyTextToClipboard } from "@/lib/sessionBrowser";
import { useShareStore } from "@/store/shareStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { Session, ToastMessage } from "@/types";

interface Props {
  session: Session;
  onClose: () => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
}

const PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", label: "Claude", url: "https://claude.ai/new" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
] as const;

export default function ShareSessionModal({ session, onClose, addToast }: Props) {
  const settings = useSettingsStore((state) => state.settings);
  const createShareLink = useShareStore((state) => state.createShareLink);
  const [includeNotes, setIncludeNotes] = useState(settings.exportIncludeNotes);
  const [shareDisclosureAccepted, setShareDisclosureAccepted] = useState(false);
  const [tooLargeTabCount, setTooLargeTabCount] = useState<number | null>(null);

  const promptConfig = {
    includeTitles: true,
    includeUrls: true,
    includeNotes,
    promptPreamble: "",
  };

  const copy = async (label: string, text: string) => {
    await copyTextToClipboard(text);
    addToast("success", `Copied ${label}.`);
  };

  const openProvider = async (url: string) => {
    const normalizedUrl = normalizeCustomAIProviderUrl(url);
    if (!normalizedUrl) {
      addToast("error", "Enter a valid HTTPS URL for the custom AI provider.");
      return;
    }

    const generatedPrompt = generateAIPrompt(session, promptConfig);
    const prompt = settings.customAIPromptTemplate
      ? settings.customAIPromptTemplate.replace("{{session}}", generatedPrompt)
      : generatedPrompt;
    await copy("AI prompt", prompt);
    await chrome.tabs.create({ url: normalizedUrl, active: true });
  };

  return (
    <ModalShell
      title="Share session"
      description="Export links, copy an AI-ready prompt, or create an encoded local snapshot."
      onClose={onClose}
      maxWidth={540}
      footer={
        <button className="btn btn-secondary" type="button" style={{ flex: 1 }} onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="form-stack">
        <label className="toggle-row">
          <span>
            <strong style={{ display: "block", marginBottom: 4 }}>Include notes</strong>
            <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
              Notes stay local unless you explicitly copy or send this export.
            </span>
          </span>
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
          />
        </label>
        <div className="card-raised" style={{ padding: 14 }}>
          <strong>Encoded share-link privacy</strong>
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
            A share link is an encoded local snapshot, not a hosted cloud link. Share links and
            exports may include tab titles, URLs, notes, folder or tag names, and session metadata,
            depending on the format. Anyone with the link or file can view or import that snapshot.
          </p>
          <label style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={shareDisclosureAccepted}
              onChange={(event) => setShareDisclosureAccepted(event.target.checked)}
            />
            I understand what may be included before creating a share link.
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void copy("plain text", sessionToPlainText(session, { includeNotes }))}
          >
            <ClipboardCopy size={14} />
            Copy text
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void copy("Markdown", sessionToMarkdown(session, { includeNotes }))}
          >
            <Link2 size={14} />
            Copy Markdown
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void copy("URL list", copyLinksToClipboard(session))}
          >
            <ClipboardCopy size={14} />
            Copy URL list
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={!shareDisclosureAccepted}
            onClick={() => {
              const result = tryGenerateShareUrl(session);
              if (!result.ok) {
                setTooLargeTabCount(result.tabCount);
                return;
              }

              try {
                const encoded = encodeShareSnapshot(createShareSnapshot(session));
                createShareLink(session.id, encoded);
                void copy("share link", result.url);
              } catch (error) {
                addToast(
                  "error",
                  error instanceof Error ? error.message : "Could not create share link."
                );
              }
            }}
          >
            <ExternalLink size={14} />
            Copy share link
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              void (async () => {
                const prompt = generateAIPrompt(session, promptConfig);
                await copy("AI prompt", prompt);
              })();
            }}
          >
            <Bot size={14} />
            Copy AI prompt
          </button>
        </div>

        {tooLargeTabCount ? (
          <div className="card-raised share-too-large">
            <p>
              This session is too large for a URL. Export Markdown or JSON instead.
            </p>
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

        <div className="card-raised" style={{ padding: 14 }}>
          <strong>AI prompt sharing</strong>
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0 0" }}>
            Prompt contents may include tab titles, URLs, notes, and selected metadata. TabSetu
            copies the prompt and opens the provider only when you choose one. The selected
            third-party provider's own privacy terms apply after you open or submit there.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                className="btn btn-secondary"
                type="button"
                disabled={!settings.aiEnabled}
                onClick={() => void openProvider(provider.url)}
              >
                {provider.label}
              </button>
            ))}
            {settings.customAIProviderUrl ? (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!settings.aiEnabled}
                onClick={() => void openProvider(settings.customAIProviderUrl)}
              >
                Custom
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
