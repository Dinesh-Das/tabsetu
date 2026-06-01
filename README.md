# TabSetu

TabSetu is a free, local-first browser extension for saving, organizing, and restoring tab
sessions.

Unlimited sessions, tabs, folders, tags, notes, reminders, schedules, search, share/export, and
optional Google Drive sync are available free forever. TabSetu has no ads, no premium tier, no
subscription, no TabSetu backend, and no sale of user data.

## Core Features

- Save a tab or window as a session.
- Collapse a window into a saved session with an undo buffer.
- Organize sessions with folders, tags, notes, pinning, archiving, and search.
- Reopen sessions manually or on a schedule.
- Set tab reminders.
- Export and import JSON backups, Markdown, plain text, and URL lists.
- Create encoded local snapshot links for sessions that fit safely in a URL.

## Optional Features

### Google Drive Sync

Google Drive sync is off until the user connects it. When enabled, TabSetu reads and writes its own
sync file in the user's Google Drive `appDataFolder`. Requests go directly from the extension to
Google APIs. TabSetu does not operate a sync backend.

OAuth scopes:

- `https://www.googleapis.com/auth/drive.appdata`
- `https://www.googleapis.com/auth/userinfo.email`

### Browser History Search

Browser history search is off by default. The extension does not request browser history permission
at install time or when the search overlay opens. A user can enable the optional `history`
permission in Settings, use matching browser-history rows inside the local overlay, and revoke the
permission at any time.

### AI Prompt Sharing

AI prompt sharing generates text from a user-selected saved session. TabSetu can copy that prompt
and open ChatGPT, Claude, Gemini, or a user-configured HTTPS provider only after the user chooses an
action. TabSetu does not automatically upload prompts or fetch page text from saved URLs.

### Notifications

Notifications are optional. They improve reminder, schedule, and capture notices. Core session
saving still works when notification permission is off.

## Privacy First

- Sessions, folders, tags, schedules, notes, and encoded share-link records use
  `chrome.storage.local`.
- Lightweight settings use `chrome.storage.sync` where available.
- Browser history access is optional and off by default.
- Google Drive sync is optional and limited to the app data folder.
- Encoded share links are local snapshots, not hosted cloud links.
- TabSetu has no backend, ads, analytics, payment processing, or sale of user data.

Read [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md), [SECURITY.md](SECURITY.md),
[COMPLIANCE.md](COMPLIANCE.md), and [STORE_LISTING.md](STORE_LISTING.md).

## Permissions

Required permissions:

| Permission | Why it is required |
| --- | --- |
| `tabs` | Save, restore, switch, and organize browser tabs and windows. |
| `storage` | Keep the local library and lightweight settings. |
| `alarms` | Run schedules, reminders, and sync housekeeping. |
| `scripting` and `activeTab` | Inject the search overlay only after a direct user command on the active page. |
| `contextMenus` | Offer explicit save actions from the browser context menu. |

Optional permissions:

| Permission | Why it is optional |
| --- | --- |
| `history` | Add matching browser-history rows to the local overlay after explicit opt-in. |
| `notifications` | Show reminder, schedule, and capture notices. |
| `identity` | Start an optional Google Drive OAuth connection where the browser supports it. |

The extension does not request `<all_urls>` host access and does not register an always-on content
script for web pages.

## Development

```bash
npm install
npm run type-check
npm run type-check:strict
npm run lint
npm test
npm run build:all
npm run compliance:check
```

`npm run verify` runs the complete verification sequence.

## Browser Build Outputs

`npm run build:all` prepares packages under:

- `dist-browsers/chrome`
- `dist-browsers/edge`
- `dist-browsers/brave`
- `dist-browsers/opera`
- `dist-browsers/arc`
- `dist-browsers/vivaldi`
- `dist-browsers/firefox`
- `dist-browsers/safari`

These are packaging targets. Complete browser-specific QA and store review before making public
compatibility claims for a target.

## Google OAuth Setup

Copy `.env.example` to `.env` and set the public OAuth client ID:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Do not add a client secret to the extension. See [GOOGLE_CONFIG.md](GOOGLE_CONFIG.md) and
[GOOGLE_OAUTH_PRODUCTION.md](GOOGLE_OAUTH_PRODUCTION.md).

## License

MIT License. See [LICENSE](LICENSE).
