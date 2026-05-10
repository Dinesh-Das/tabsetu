import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session, StorageData, TabItem } from "@/types";
import {
  generateAIPrompt,
  generateAIPromptWithPageText,
  importFile,
  sessionToMarkdown,
  sessionToPlainText,
  summarizeStorageData,
} from "@/lib/exportImport";

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeTab(overrides?: Partial<TabItem>): TabItem {
  return {
    id: "tab-1",
    title: "Docs",
    url: "https://example.com/docs",
    favIconUrl: null,
    folderId: null,
    tagIds: [],
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

function makeImportFile(name: string, content: string, type: string): File {
  return new File([content], name, { type });
}

describe("exportImport", () => {
  it("omits notes from exported text and markdown when disabled", () => {
    const session = makeSession();

    expect(sessionToPlainText(session, { includeNotes: false })).not.toContain(
      "Prepare talking points"
    );
    expect(sessionToPlainText(session, { includeNotes: false })).not.toContain(
      "Read before standup"
    );
    expect(sessionToMarkdown(session, { includeNotes: false })).not.toContain(
      "Prepare talking points"
    );
    expect(sessionToMarkdown(session, { includeNotes: false })).not.toContain(
      "Read before standup"
    );
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
        hasCompletedOnboarding: true,
      },
    };

    expect(summarizeStorageData(data).notes).toBe(4);
  });

  it("keeps notes in AI prompts unless explicitly disabled", () => {
    const session = makeSession();

    expect(generateAIPrompt(session)).toContain("Prepare talking points");
    expect(generateAIPrompt(session, { includeNotes: false })).not.toContain(
      "Prepare talking points"
    );
  });

  it("adds fetched page text to AI prompts when requested", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(() =>
        Promise.resolve(
          new Response(
            "<html><body><h1>Fetched insight</h1><script>ignored()</script></body></html>",
            {
              status: 200,
              headers: { "content-type": "text/html" },
            }
          )
        )
      )
    );

    await expect(generateAIPromptWithPageText(makeSession())).resolves.toContain("Fetched insight");
  });

  it("continues to import existing TabSetu JSON backups", async () => {
    const data = await importFile(
      makeImportFile(
        "tabsetu-backup.json",
        JSON.stringify({
          sessions: [makeSession({ id: "imported-session", name: "Imported backup" })],
        }),
        "application/json"
      )
    );

    expect(data.sessions.map((session) => session.name)).toEqual(["Imported backup"]);
    expect(data.sessions[0].tabs[0].note).toBe("Read before standup");
  });

  it("imports OneTab text with raw URLs, pipe titles, and blank-line sections", async () => {
    const data = await importFile(
      makeImportFile(
        "onetab.txt",
        [
          "Research",
          "Example Docs | https://example.com/docs",
          "https://openai.com",
          "",
          "Reading",
          "https://developer.mozilla.org | MDN Web Docs",
        ].join("\n"),
        "text/plain"
      )
    );

    expect(data.sessions.map((session) => session.name)).toEqual(["Research", "Reading"]);
    expect(data.sessions[0].tabs.map((tab) => `${tab.position}:${tab.title}:${tab.url}`)).toEqual([
      "0:Example Docs:https://example.com/docs",
      "1:openai.com:https://openai.com",
    ]);
    expect(data.sessions[1].tabs[0].title).toBe("MDN Web Docs");
  });

  it("imports HTML anchors and uses nearby headings as session names", async () => {
    const data = await importFile(
      makeImportFile(
        "links.html",
        [
          "<!doctype html>",
          "<html><body>",
          "<h2>Project Alpha</h2>",
          '<a href="https://alpha.example.com/docs">Alpha docs</a>',
          "<h2>Project Beta</h2>",
          '<section><a href="https://beta.example.com/report">Beta report</a></section>',
          "</body></html>",
        ].join(""),
        "text/html"
      )
    );

    expect(data.sessions.map((session) => session.name)).toEqual(["Project Alpha", "Project Beta"]);
    expect(data.sessions[0].tabs[0].title).toBe("Alpha docs");
    expect(data.sessions[1].tabs[0].url).toBe("https://beta.example.com/report");
  });

  it("imports nested Session Buddy JSON sessions, windows, and tabs", async () => {
    const data = await importFile(
      makeImportFile(
        "session-buddy.json",
        JSON.stringify({
          sessions: [
            {
              name: "Morning setup",
              windows: [
                {
                  tabs: [
                    { title: "Dashboard", url: "https://dash.example.com" },
                    { title: "Mail", url: "https://mail.example.com" },
                  ],
                },
              ],
            },
            {
              title: "Research",
              tabs: [{ name: "Paper", url: "https://paper.example.com" }],
            },
          ],
        }),
        "application/json"
      )
    );

    expect(data.sessions.map((session) => session.name)).toEqual(["Morning setup", "Research"]);
    expect(data.sessions[0].tabs.map((tab) => tab.position)).toEqual([0, 1]);
    expect(data.sessions[0].tabs.map((tab) => tab.title)).toEqual(["Dashboard", "Mail"]);
    expect(data.sessions[1].tabs[0].title).toBe("Paper");
  });

  it("does not mistake foreign JSON with settings for a TabSetu backup", async () => {
    const data = await importFile(
      makeImportFile(
        "foreign-session-export.json",
        JSON.stringify({
          settings: { theme: "dark" },
          sessions: [
            {
              name: "Foreign workspace",
              windows: [
                {
                  tabs: [{ title: "Console", url: "https://console.example.com" }],
                },
              ],
            },
          ],
        }),
        "application/json"
      )
    );

    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].name).toBe("Foreign workspace");
    expect(data.sessions[0].tabs[0].url).toBe("https://console.example.com");
  });

  it("rejects imports when no valid tabs are found", async () => {
    await expect(
      importFile(makeImportFile("empty.txt", "not a saved tab export", "text/plain"))
    ).rejects.toThrow("No valid tabs were found");
  });
});
