# TabSetu

TabSetu is a free, local-first browser extension for saving, organizing, searching, and restoring
browser tab sessions. The current extension version is `1.0.2` and uses Manifest V3.

The core library lives in browser extension storage. TabSetu has no ads, subscription, analytics,
payment processing, TabSetu backend, or sale of user data. Optional Google Drive sync connects
directly to Google APIs only after the user enables it.

## Features

### Capture and restore

- Save the active tab, selected tabs, every capturable tab in the current window, or a page/link
  from the browser context menu.
- Collapse a window into a session and close its captured tabs only after the session and a
  10-second undo buffer have been stored successfully.
- Choose whether pinned tabs are included when collapsing.
- Reopen an entire session in the current window or a new window, or open individual saved tabs.
- Add the active tab or all currently open tabs to an existing session.
- Automatically skip restricted browser pages and accept only HTTP and HTTPS tab URLs.

### Organize the library

- Rename, describe, duplicate, pin, archive, restore, and delete sessions.
- Assign session colors, folders, and tags, and customize folder colors and icons.
- Add notes to sessions and tabs, plus create searchable standalone notes.
- Add, remove, reorder, categorize, tag, and annotate individual saved tabs.
- Browse pinned, archived, folder, tag, and favourite collections.
- Sort sessions by creation time, update time, last-opened time, name, or tab count.
- Bulk-select sessions to move, archive, restore, or delete them.
- Find URLs duplicated across sessions and discard inactive background browser tabs.

### Search and automation

- Fuzzy-search sessions, tab titles and URLs, notes, folders, and tags with configurable scopes and
  sensitivity.
- Open a local search overlay from regular web pages without an always-on content script.
- Optionally include browser-history matches in that overlay after granting the `history`
  permission.
- Create one-time, daily, weekly, weekday, or custom-day session schedules.
- Set, snooze, dismiss, and review per-tab reminders.
- Auto-archive inactive sessions after 30, 60, or 90 days.
- Configure light, dark, or system theme; split or focus dashboard layout; compact, comfortable, or
  grid session cards; and optional quick-info hover cards.

### Export, import, and share

- Export the complete library as a TabSetu JSON backup.
- Export an individual session as Markdown or plain text, or copy its titled link list.
- Import TabSetu backups, Session Buddy-style JSON, HTML link exports, OneTab text, and plain
  title/URL lists.
- Preview an import and either merge it with the current library or replace the library.
- Generate a local, compressed snapshot URL for sessions small enough to fit safely in a URL.
- Generate an AI-ready prompt and optionally open ChatGPT, Claude, Gemini, or a custom HTTPS
  provider. TabSetu does not fetch page contents or automatically upload prompts.
- Control whether notes are included in Markdown, plain-text, share, and AI-prompt flows.

## Quick Start for Local Development

### Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A Chromium browser for the simplest unpacked-extension workflow

Install dependencies and create a Chrome package:

```bash
npm ci
npm run build:chrome
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
dist-browsers/chrome
```

The core extension works without Google OAuth configuration. See
[Google OAuth Setup](#google-oauth-setup) to test optional Drive sync.

## Using TabSetu

The popup provides quick save, selected-tab capture, collapse, recent sessions, folders, schedules,
reminders, and notes. Open the dashboard for the full session editor, library search, bulk actions,
import/export, duplicate detection, settings, and Google Drive sync.

The browser context menu adds:

- **Save tab to TabSetu** for the current page or a clicked link.
- **Save window as TabSetu session** for the current window.

### Keyboard shortcuts

| Action                          | Windows/Linux  | macOS             |
| ------------------------------- | -------------- | ----------------- |
| Open the TabSetu search overlay | `Ctrl+Shift+F` | `Command+Shift+F` |
| Save the current tab            | `Alt+Shift+Y`  | `Alt+Shift+Y`     |
| Collapse the current window     | `Alt+Shift+U`  | `Alt+Shift+U`     |
| Open the dashboard              | `Alt+Shift+D`  | `Alt+Shift+D`     |

Browsers may reserve or decline a suggested shortcut. Use the browser's extension-shortcut page to
review or reassign them.

## Optional Features

### Google Drive sync

Drive sync is disabled until the user connects an account. When enabled, TabSetu reads and writes
`tabsetu-sync.json` in the user's Google Drive `appDataFolder`; requests go directly from the
extension to Google APIs. Changes are merged using entity versions and timestamps, including
deletion records, before the merged library is saved locally and uploaded.
Uploads are conditional on the Drive version that was downloaded, so simultaneous clients re-merge
instead of silently overwriting one another.

OAuth scopes:

- `https://www.googleapis.com/auth/drive.appdata`
- `https://www.googleapis.com/auth/userinfo.email`

### Browser-history search

Browser-history search is off by default. TabSetu requests the optional `history` permission only
after explicit opt-in in Settings. When enabled, matching history rows appear in the local search
overlay. The permission can be revoked from Settings at any time.

### AI prompt sharing

AI prompt sharing is off by default. Prompts are assembled locally from a user-selected saved
session. TabSetu copies or opens a provider only after a user action, supports custom prompt
templates, and accepts only HTTPS custom-provider URLs. It does not retrieve the contents of saved
pages.

### Notifications

The optional `notifications` permission enables reminder, schedule, capture, and command-status
notices. Core session saving remains available without it.

### Tab group metadata

TabSetu preserves tab-group membership during capture and restore. Chromium users can optionally
grant `tabGroups` in Settings to also preserve group names, colors, and collapsed state.

## Storage, Privacy, and Data Safety

- Sessions, folders, tags, schedules, standalone notes, share-link records, OAuth state, and the
  collapse undo buffer use `chrome.storage.local`.
- Lightweight settings and AI-sharing configuration use `chrome.storage.sync` when the browser
  provides it, with a local-storage fallback.
- Large session libraries are split into local storage chunks.
- Persistence queues continue processing after a failed write and surface errors in the popup or
  dashboard.
- Incognito/private tabs are never captured or written to the TabSetu library.
- Collapse waits for both the session write and undo-buffer write before closing tabs.
- Full-library updates write local metadata and session chunks together. Cross-area updates attempt
  to restore the previous complete snapshot if either storage area rejects the update.
- Hydration failures show a recovery screen with reload, recovery-backup, and separately confirmed
  reset options.
- Encoded share links contain a local compressed snapshot, not a hosted cloud record. Only the
  newest active share-link record per session is retained, and all records can be cleared in
  Settings.
- TabSetu warns when local extension storage reaches 80% of the quota reported by the browser.
- TabSetu does not request `<all_urls>` host access and does not register an always-on content
  script.

### Import limits

Imports are validated before they are applied:

| Limit                                             |               Maximum |
| ------------------------------------------------- | --------------------: |
| File size                                         |                 25 MB |
| Sessions                                          |                 5,000 |
| Tabs                                              |                50,000 |
| Folders, tags, schedules, notes, or share records | 10,000 per collection |
| JSON nesting depth                                |                    50 |
| JSON nodes inspected                              |               100,000 |

Invalid and non-HTTP(S) tab URLs are discarded. After a successful import, schedule and reminder
alarms are reconciled with the imported data.

For the complete policies, read [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md),
[SECURITY.md](SECURITY.md), and [COMPLIANCE.md](COMPLIANCE.md).

## Permissions

Required permissions:

| Permission     | Purpose                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `tabs`         | Capture, restore, switch, group, and manage browser tabs and windows.        |
| `storage`      | Store the local library, settings, recovery state, and optional OAuth token. |
| `alarms`       | Run schedules, reminders, and deferred sync work.                            |
| `scripting`    | Inject the search overlay after a direct user command.                       |
| `activeTab`    | Limit overlay injection to the actively authorized page.                     |
| `contextMenus` | Provide explicit page, link, and window save actions.                        |

Optional permissions:

| Permission      | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `history`       | Add local browser-history matches to search after explicit opt-in. |
| `notifications` | Show reminder, schedule, capture, and command notices.             |
| `identity`      | Start optional Google OAuth where the browser supports this API.   |
| `tabGroups`     | Preserve group names, colors, and collapsed state on Chromium.     |

Firefox and Safari packages omit `tabGroups`; Safari also omits `identity` and the manifest `oauth2`
key and uses the packaged tab-based OAuth callback fallback.

## Development Commands

| Command                     | Purpose                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`               | Rebuild with Vite in watch mode.                                         |
| `npm run build`             | Create the base extension build in `dist`.                               |
| `npm run build:all`         | Build and prepare every browser target.                                  |
| `npm run build:chrome`      | Build only the Chrome target.                                            |
| `npm run build:firefox`     | Build only the Firefox target.                                           |
| `npm run build:safari`      | Build only the Safari target.                                            |
| `npm run build:opera`       | Build only the Opera target.                                             |
| `npm run package:browsers`  | Repackage an existing `dist` build for browser targets.                  |
| `npm run type-check`        | Run the standard TypeScript check.                                       |
| `npm run type-check:strict` | Run the exact-optional and stricter TypeScript configuration.            |
| `npm run lint`              | Run ESLint with zero warnings allowed.                                   |
| `npm run lint:fix`          | Apply safe ESLint fixes.                                                 |
| `npm run format`            | Format `src` with Prettier.                                              |
| `npm run format:check`      | Check source formatting without changing files.                          |
| `npm test`                  | Run the Vitest suite once.                                               |
| `npm run test:coverage`     | Run tests with V8 coverage.                                              |
| `npm run compliance:check`  | Validate source and generated extension manifests.                       |
| `npm run verify`            | Run type checks, lint, tests, all browser builds, and compliance checks. |

For the same final checks used by this repository:

```bash
npm run format:check
npm run verify
npm run test:coverage
npm audit
```

## Project Structure

```text
src/
  background/   Service worker, commands, context menus, notifications, and alarms
  components/   Shared and mobile React components
  content/      On-demand search overlay code
  dashboard/    Full library and settings application
  hooks/        Shared React hooks
  lib/          Storage, sync, import/export, search, scheduling, and browser helpers
  popup/        Extension popup application
  store/        Zustand stores and persistence queues
  types/        Shared TypeScript data types
scripts/        Browser packaging and compliance scripts
share-page/     Local encoded-snapshot viewer
```

The UI is built with React 18 and TypeScript. Zustand manages application state, Fuse.js powers
fuzzy search, Framer Motion handles UI transitions, and Vite with CRXJS produces the Manifest V3
extension bundles. Vitest, ESLint, and Prettier provide verification and code-quality checks.

## Browser Build Outputs

`npm run build:all` creates:

- `dist-browsers/chrome`
- `dist-browsers/edge`
- `dist-browsers/brave`
- `dist-browsers/opera`
- `dist-browsers/arc`
- `dist-browsers/vivaldi`
- `dist-browsers/firefox`
- `dist-browsers/safari`

Chromium packages retain the service-worker manifest shape. Firefox packages use
`background.scripts`, declare extension ID `tabsetu@tabsetu.app`, and require Firefox 128 or later.
Safari output is a prepared web-extension package that must be converted to an Xcode project with
`xcrun safari-web-extension-converter` before it can be loaded in Safari.

These directories are packaging targets, not claims of completed store review or browser-specific
QA. See [DEPLOYMENT.md](DEPLOYMENT.md) for release guidance.

## Google OAuth Setup

Copy `.env.example` to `.env` and set a public OAuth web-client ID:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

`VITE_GOOGLE_CLIENT_ID` is also accepted for CI builds. Never add a client secret to the extension.
For provider configuration and production rollout, read [GOOGLE_CONFIG.md](GOOGLE_CONFIG.md) and
[GOOGLE_OAUTH_PRODUCTION.md](GOOGLE_OAUTH_PRODUCTION.md).

## Additional Documentation

- [CHANGELOG.md](CHANGELOG.md) — release history
- [DEPLOYMENT.md](DEPLOYMENT.md) — packaging and deployment checklist
- [STORE_LISTING.md](STORE_LISTING.md) — extension-store listing copy
- [PRIVACY.md](PRIVACY.md) — privacy policy
- [SECURITY.md](SECURITY.md) — security policy and reporting
- [TERMS.md](TERMS.md) — terms of use
- [COMPLIANCE.md](COMPLIANCE.md) — compliance notes

## License

MIT License. See [LICENSE](LICENSE).
