# 🌌 TabSetu

> **Save your tabs. Clear your mind.**

TabSetu is a **free, local-first Chrome extension** that transforms browser tab chaos into organized, searchable sessions. Built with a stunning Glassmorphism UI, it goes beyond session saving — it's a full workspace orchestrator with folders, tags, notes, reminders, scheduled auto-open, fuzzy search, AI prompts, and a shareable session link system.

**No accounts. No cloud. No limits. Free forever.**

---

## ✨ Features

### 🧊 Glassmorphism Design System
- **Frosted glass panels** with luminous borders and animated gradient mesh backgrounds
- **Dark / Light / System** theme with seamless live switching
- **Responsive layout** — popup (mobile-style) and full-page dashboard (split-pane desktop)

### 🗂️ Session Management
- **One-click save** — snapshot your entire window in milliseconds
- **Smart collapse** — save all tabs and close the window with a **10-second undo buffer**
- **Folders & Tags** — organize sessions with nested folders and color-coded tags
- **Bulk actions** — select, archive, move, or delete multiple sessions at once
- **Drag-and-drop** tab reordering within sessions

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
- **Export formats** — JSON backup, Markdown, plain text, or clipboard links
- **Universal import** — parse JSON, HTML bookmarks, and plain text URL lists from any tab manager

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Alt+Shift+Y` | **Save** the current window as a session |
| `Alt+Shift+U` | **Collapse** — save + close the window |
| `Ctrl+Shift+F` | Open the **Global Search Overlay** on any page |
| `Alt+Shift+D` | Open the **TabSetu Dashboard** |
| `Ctrl+K` | Focus the search bar (inside popup) |
| `Escape` | Close modals and overlays |

---

## 🏗️ Tech Stack

| Layer | Technology |
|:---|:---|
| **UI** | React 18, TypeScript, Tailwind CSS |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **State** | Zustand (7 stores: sessions, folders, tags, schedules, notes, shares, settings) |
| **Search** | Fuse.js with custom highlight engine |
| **Build** | Vite + @crxjs/vite-plugin |
| **Testing** | Vitest (43 tests across 12 modules) |
| **Extension** | Chrome Manifest V3, service worker module |
| **Storage** | `chrome.storage.local` — fully offline, no server |

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
│   │   ├── storage.ts       # Normalization, persistence, migration (25 KB)
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
│   ├── store/               # Zustand stores (session, folder, tag, schedule, notes, share, settings)
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
- **Google Chrome** (or any Chromium browser)

### Development

```bash
# Clone the repository
git clone https://github.com/Dinesh-Das/tabsetu.git
cd tabsetu

# Install dependencies
npm install

# Start dev build (watches for changes)
npm run dev

# Load in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select the dist/ folder
```

### Testing

```bash
# Run all tests
npm test

# Type-check without emitting
npm run type-check
```

### Production Build

```bash
npm run build
# Output: dist/ — ready for Chrome Web Store submission
```

---

## 🛡️ Privacy & Philosophy

- **Local-first** — all data stored in `chrome.storage.local`. Nothing leaves your device.
- **No accounts** — no sign-up, no login, no cloud sync.
- **No tracking** — zero analytics, zero telemetry.
- **Manifest V3** — built on Chrome's latest, most secure extension architecture.
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

- **Chrome Web Store** (also covers Brave, Vivaldi, Arc, Opera)
- **Microsoft Edge Add-ons**
- **Firefox Add-ons (AMO)**

Includes permission justifications, privacy policy template, store asset requirements, and a post-submission checklist.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

**TabSetu** — *Save your tabs. Clear your mind.*
