import { useState } from "react";
import { Bot, ClipboardCopy, ExternalLink, Link2 } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";
import {
  generateAIPrompt,
  sessionToMarkdown,
  sessionToPlainText,
} from "@/lib/exportImport";
import { createShareSnapshot, encodeShareSnapshot, generateShareUrlFromEncoded } from "@/lib/shareEncoder";
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
    const prompt = settings.customAIPromptTemplate
      ? settings.customAIPromptTemplate.replace("{{session}}", generateAIPrompt(session, promptConfig))
      : generateAIPrompt(session, promptConfig);
    await copy("AI prompt", prompt);
    await chrome.tabs.create({ url, active: true });
  };

  return (
    <ModalShell
      title="Share session"
      description="Export links, copy an AI prompt, or create a private encoded link."
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
            onClick={() => {
              const encoded = encodeShareSnapshot(createShareSnapshot(session));
              createShareLink(session.id, encoded);
              void copy("share link", generateShareUrlFromEncoded(encoded));
            }}
          >
            <ExternalLink size={14} />
            Copy share link
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void copy("AI prompt", generateAIPrompt(session, promptConfig))}
          >
            <Bot size={14} />
            Copy AI prompt
          </button>
        </div>

        <div className="card-raised" style={{ padding: 14 }}>
          <strong>Open with AI</strong>
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
