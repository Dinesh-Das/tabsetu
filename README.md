# 🌌 TabSetu

> **Save your tabs. Clear your mind.**

TabSetu is a **free, local-first browser extension** for **Chrome, Edge, Brave, Firefox, Safari, Opera, Arc, Vivaldi**, and other compatible browsers that transforms tab chaos into organized, searchable sessions. Built with a stunning Glassmorphism UI, it goes beyond session saving — it's a full workspace orchestrator with folders, tags, notes, reminders, scheduled auto-open, fuzzy search, Google Drive sync, AI prompts, and a shareable session link system.

**Local-first storage. User-owned Google Drive sync. No backend. No limits. Free forever.**

---

## ✨ Features

### 🧊 Glassmorphism Design System

- **Frosted glass panels** with luminous borders and animated gradient mesh backgrounds
- **Dark / Light / System** theme with seamless live switching
- **Responsive layout** — popup (mobile-style) and full-page dashboard (split-pane desktop)

### 🗂️ Session Management

- **One-click save** — snapshot your entire window in milliseconds
- **Context menu capture** — save a tab or whole window from Chrome's right-click menu
- **Smart collapse** — save all tabs and close the window with a **10-second undo buffer**
- **Folders & Tags** — organize sessions with nested folders and color-coded tags
- **Bulk actions** — select, archive, move, or delete multiple sessions at once
- **Drag-and-drop** tab reordering within sessions

### 🔄 Sync

- **Google Drive app data sync** — cross-device session sync using the user's own hidden `appDataFolder`
- **No TabSetu backend** — sync talks directly to Google Drive with the `drive.appdata` scope
- **Synced preferences** — lightweight settings and AI configuration live in `chrome.storage.sync`
- **Local library storage** — sessions, folders, tags, schedules, notes, and share links stay in `chrome.storage.local`
- **Last-write-wins merge** — remote and local libraries are unioned by entity ID using `updatedAt`

### 📝 Notes

- **Tab notes** — attach notes to individual tabs
- **Session notes** — add rich notes to entire sessions
- **Standalone notes** — keep research logs independent of any session

### ⏰ Reminders & Schedules

- **Tab reminders** — "Remind me in 1 hour" or "Tomorrow at 9 AM" for any tab
- **Snooze / Dismiss / Reopen** — full reminder lifecycle management
- **Recurring schedules** — auto-open tab sets daily, on weekdays, or custom days
- **One-time schedules** — fire once at a specific date and time

### 🔍 Search

- **Global search overlay** — press `Ctrl+Shift+F` on any webpage to search your entire TabSetu history without leaving the page
- **Fuzzy matching** — powered by Fuse.js, finds results even with partial or misspelled queries
- **Highlighted snippets** — matching text highlighted inline in search results

### 🤖 AI Integration

- **AI-ready prompts** — generate context-rich prompts for ChatGPT, Claude, or Gemini from saved tabs
- **Page text extraction** — optionally include page content in prompts for deeper context
- **Custom providers** — configure your own AI endpoint and prompt template

### 🔗 Sharing

- **Session share links** — generate a URL-encoded snapshot anyone can import
- **Large-session fallback** — oversized URL shares point users to Markdown export instead of failing silently
- **Export formats** — JSON backup, Markdown, plain text, or clipboard links
- **Universal import** — parse JSON, HTML bookmarks, and plain text URL lists from any tab manager

---

## ⌨️ Keyboard Shortcuts

| Shortcut       | Action                                         |
| :------------- | :--------------------------------------------- |
| `Alt+Shift+Y`  | **Save** the current window as a session       |
| `Alt+Shift+U`  | **Collapse** — save + close the window         |
| `Ctrl+Shift+F` | Open the **Global Search Overlay** on any page |
| `Alt+Shift+D`  | Open the **TabSetu Dashboard**                 |
| `Ctrl+K`       | Focus the search bar (inside popup)            |
| `Escape`       | Close modals and overlays                      |

---

## 🏗️ Tech Stack

| Layer          | Technology                                                                            |
| :------------- | :------------------------------------------------------------------------------------ |
| **UI**         | React 18, TypeScript, Tailwind CSS                                                    |
| **Animations** | Framer Motion                                                                         |
| **Icons**      | Lucide React                                                                          |
| **State**      | Zustand (8 stores: sessions, folders, tags, schedules, notes, shares, settings, sync) |
| **Search**     | Fuse.js with custom highlight engine                                                  |
| **Build**      | Vite + @crxjs/vite-plugin                                                             |
| **Testing**    | Vitest (51 tests across 15 modules)                                                   |
| **Extension**  | Cross-browser Manifest V3 packages for Chromium, Firefox, and Safari         |
| **Storage**    | `chrome.storage.local`, `chrome.storage.sync`, optional Google Drive `appDataFolder`  |
| **Compat**     | Browser abstraction layer for Safari OAuth, notification, and storage API differences |

---

## Browser Builds

Run `npm run build:all` to create browser-specific packages:

- `dist-browsers/chrome`
- `dist-browsers/edge`
- `dist-browsers/brave`
- `dist-browsers/opera`
- `dist-browsers/arc`
- `dist-browsers/vivaldi`
- `dist-browsers/firefox`
- `dist-browsers/safari`

Chrome, Edge, Brave, Opera, Arc, and Vivaldi use the Chromium MV3 service worker package. Firefox gets a Firefox-specific MV3 manifest with `background.scripts` and `browser_specific_settings.gecko`. Safari gets a modified manifest without `chrome.identity` (uses a tab-based OAuth flow instead).

Single-browser builds are also available:

```bash
npm run build:chrome
npm run build:firefox
npm run build:safari
npm run build:opera
```

---

## 📁 Project Structure

```
tabsetu/
├── src/
│   ├── background/          # Service worker — alarms, tab tracking, message handling
│   │   └── service_worker.ts
│   ├── components/
│   │   ├── mobile/          # MobileUI shell, MobileConfirmSheet
│   │   └── shared/          # ConfirmDialog, EntityEditor, HighlightedText, Logo, ThemeToggle
│   ├── dashboard/           # Full-page dashboard (options page)
│   │   ├── components/      # SessionList, SessionDetail, ImportExport, Notes, Schedules, Settings
│   │   ├── layouts/         # DesktopLayout (split-pane)
│   │   └── pages/           # RemindersPage
│   ├── hooks/               # useDebouncedValue
│   ├── lib/                 # Pure logic — no React, fully testable
│   │   ├── storage.ts       # Normalization, persistence, migration
│   │   ├── googleSync.ts    # Google Drive appDataFolder sync helpers
│   │   ├── syncMerge.ts     # Last-write-wins storage merge
│   │   ├── exportImport.ts  # Multi-format import/export engine (21 KB)
│   │   ├── fuzzySearch.ts   # Fuse.js integration + highlight builder
│   │   ├── tabHelpers.ts    # ID generation, URL validation, favicon caching
│   │   ├── sessionBrowser.ts # Tab opening, clipboard
│   │   ├── alarmScheduling.ts # Schedule date math
│   │   ├── reminders.ts     # Reminder date utilities
│   │   ├── shareEncoder.ts  # Base64 URL encoding for share links
│   │   ├── sessionQuery.ts  # Sort / filter / group sessions
│   │   ├── sessionLabels.ts # Smart title generation
│   │   ├── scheduleDraft.ts # Draft normalization
│   │   ├── tabOrdering.ts   # Index-based reorder
│   │   ├── format.ts        # Date and count formatting
│   │   ├── theme.ts         # Theme resolution + system listener
│   │   └── popupTabs.ts     # Capturable tab filtering
│   ├── popup/               # Extension popup (browser action)
│   │   └── components/      # CurrentTabs, SaveModal, SavedSessions, SearchBar, Onboarding, Toast
│   ├── store/               # Zustand stores (session, folder, tag, schedule, notes, share, settings, sync)
│   ├── types/               # TypeScript interfaces (TabItem, Session, Folder, Tag, Schedule, etc.)
│   └── manifest.json        # Chrome MV3 manifest
├── share-page/              # Standalone HTML page for opening shared session links
├── public/icons/            # Extension icons (16, 32, 48, 128)
├── graphify-out/            # Knowledge graph outputs (graph.html, graph.json, GRAPH_REPORT.md)
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- A modern browser: **Chrome**, **Edge**, **Brave**, **Firefox**, **Safari**, **Opera**, **Arc**, or **Vivaldi**

### Development

```bash
# Clone the repository
git clone https://github.com/Dinesh-Das/tabsetu.git
cd tabsetu

# Install dependencies
npm install

# Start dev build (watches for changes)
npm run dev

# Load in a Chromium browser:
# 1. Open chrome://extensions, edge://extensions, or brave://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select the matching dist-browsers/<browser>/ folder

# Load in Firefox:
# 1. Open about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on"
# 3. Select the manifest.json in dist-browsers/firefox/

# Load in Safari:
# 1. Run: xcrun safari-web-extension-converter dist-browsers/safari/ --project-location ./safari-xcode --app-name TabSetu
# 2. Open the Xcode project and build
# 3. Enable the extension in Safari > Settings > Extensions
```

### Testing

```bash
# Run all tests
npm test

# Type-check without emitting
npm run type-check
```

### Google Drive Sync Setup

The extension uses `identity.launchWebAuthFlow`, so Google Cloud should use a **Web application** OAuth client with one authorized redirect URI per browser/build.

Create a local env file from the example and set your public Web OAuth client ID:

```bash
cp .env.example .env
```

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

`vite.config.ts` injects `GOOGLE_CLIENT_ID` into the built extension manifest. Do not add a Google client secret to the extension.

For Chromium builds, add redirect URIs like `https://<extension-id>.chromiumapp.org/google` to that Web client. Add each browser or local development extension ID you want to support.

See [GOOGLE_CONFIG.md](GOOGLE_CONFIG.md) for the full Google Cloud and OAuth setup checklist.

### Production Build

```bash
npm run build
# Output: dist/ — ready for Chrome Web Store submission
```

---

## 🛡️ Privacy & Philosophy

- **Local-first** — sessions, folders, tags, schedules, notes, and share links stay in `chrome.storage.local`.
- **Google sign-in at startup** — the dashboard starts with login so sync is connected before session work begins.
- **User-owned sync** — synced session data is stored in the user's Google Drive `appDataFolder`, hidden from normal Drive UI and not hosted by TabSetu.
- **Synced preferences** — settings and AI config use `chrome.storage.sync` for lightweight browser preference sync.
- **No tracking** — zero analytics, zero telemetry.
- **Manifest V3** — built on the latest, most secure extension architecture across all supported browsers.
- **Free forever** — no premium tiers, no limits on tabs, folders, or sessions.

---

## 📊 Codebase Knowledge Graph

TabSetu's architecture is indexed with [Graphify](https://github.com/safishamsi/graphify), producing an interactive knowledge graph for navigating the codebase:

```bash
# Rebuild the graph after code changes (no API cost)
python -m graphify update . --force

# Query the graph
python -m graphify query "How does session saving work?"

# Explain any function
python -m graphify explain "normalizeStorageData()"

# Find shortest path between modules
python -m graphify path "service_worker.ts" "storage.ts"
```

Open `graphify-out/graph.html` for the interactive visualization.

---

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide to publishing on:

- **Chrome Web Store** (also covers Brave, Vivaldi, Arc)
- **Microsoft Edge Add-ons**
- **Firefox Add-ons (AMO)**
- **Safari App Store** (requires Xcode project)
- **Opera Add-ons**

Includes permission justifications, privacy policy template, store asset requirements, and a post-submission checklist.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

**TabSetu** — _Save your tabs. Clear your mind._
