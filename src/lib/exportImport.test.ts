import { describe, expect, it } from "vitest";
import type { Session, StorageData, TabItem } from "@/types";
import { generateAIPrompt, sessionToMarkdown, sessionToPlainText, summarizeStorageData } from "@/lib/exportImport";

function makeTab(overrides?: Partial<TabItem>): TabItem {
  return {
    id: "tab-1",
    title: "Docs",
    url: "https://example.com/docs",
    favIconUrl: null,
    favIconDataUrl: null,
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 0,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
    ...overrides,
  };
}

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-1",
    name: "Launch plan",
    description: "Research links",
    folderId: null,
    groupId: null,
    tagIds: [],
    tabs: [makeTab({ note: "Read before standup" })],
    note: "Prepare talking points",
    color: null,
    icon: null,
    openCount: 0,
    createdAt: 1,
    updatedAt: 2,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
    ...overrides,
  };
}

describe("exportImport", () => {
  it("omits notes from exported text and markdown when disabled", () => {
    const session = makeSession();

    expect(sessionToPlainText(session, { includeNotes: false })).not.toContain("Prepare talking points");
    expect(sessionToPlainText(session, { includeNotes: false })).not.toContain("Read before standup");
    expect(sessionToMarkdown(session, { includeNotes: false })).not.toContain("Prepare talking points");
    expect(sessionToMarkdown(session, { includeNotes: false })).not.toContain("Read before standup");
  });

  it("counts standalone, session, and tab notes in storage summaries", () => {
    const data: StorageData = {
      sessions: [
        makeSession(),
        makeSession({
          id: "session-2",
          note: "",
          tabs: [makeTab({ id: "tab-2", note: "Follow up later" })],
        }),
      ],
      folders: [],
      tags: [],
      groups: [],
      schedules: [],
      standaloneNotes: [
        {
          id: "note-1",
          title: "Ideas",
          content: "Capture this",
          isPinned: false,
          color: null,
          tagIds: [],
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      shareLinks: [],
      aiConfig: {
        defaultProvider: "chatgpt",
        customProviderUrl: "",
        customPromptTemplate: "",
        includeUrls: true,
        includeTitles: true,
        includeNotes: true,
        promptPreamble: "",
      },
      settings: {
        theme: "system",
        collapseIncludesPinned: false,
        openInNewWindow: false,
        confirmBeforeDelete: true,
        schedulesEnabled: true,
        remindersEnabled: true,
        searchOverlayEnabled: true,
        searchOverlayShortcut: "Ctrl+Shift+F",
        quickInfoEnabled: true,
        quickInfoDelayMs: 400,
        aiEnabled: true,
        defaultAIProvider: "chatgpt",
        customAIProviderUrl: "",
        customAIPromptTemplate: "",
        exportIncludeNotes: true,
        version: "1.0.0",
        dashboardLayout: "split",
        sessionCardStyle: "comfortable",
        searchScopes: {
          sessions: true,
          tabs: true,
          notes: true,
          tags: true,
          folders: true,
        },
        fuzzySearchThreshold: 0.32,
        autoArchiveDays: null,
      },
    };

    expect(summarizeStorageData(data).notes).toBe(4);
  });

  it("keeps notes in AI prompts unless explicitly disabled", () => {
    const session = makeSession();

    expect(generateAIPrompt(session)).toContain("Prepare talking points");
    expect(generateAIPrompt(session, { includeNotes: false })).not.toContain("Prepare talking points");
  });
});
