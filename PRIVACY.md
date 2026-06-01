# TabSetu Privacy Policy

Effective date: June 1, 2026

TabSetu is a free, local-first tab and session manager. This policy describes the behavior of the
extension in this repository. TabSetu does not operate a backend server.

## Local Storage

TabSetu stores sessions, tabs, folders, tags, notes, schedules, reminder data, and encoded
share-link records in browser extension local storage. Lightweight settings and AI prompt-sharing
preferences may use `chrome.storage.sync` where the browser supports it.

Users can export a JSON backup from the dashboard and can delete local data from Settings or by
removing the extension.

## Optional Google Drive Sync

Google Drive sync is off until the user chooses to connect it. When enabled, the extension talks
directly to Google APIs and stores a TabSetu sync file in the user's Google Drive
`appDataFolder`. This hidden app-specific folder does not give TabSetu access to normal Drive files.

TabSetu requests only:

- `https://www.googleapis.com/auth/drive.appdata`
- `https://www.googleapis.com/auth/userinfo.email`

The email scope is used to display which Google account is connected. Users can disconnect Google
Drive sync in Settings and can revoke access from their Google account.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data
Policy, including the Limited Use requirements.

## Browser Permissions

Required permissions:

- `tabs`: save, restore, switch, and organize tabs and windows.
- `storage`: store the local library and settings.
- `alarms`: run schedules, reminders, and sync housekeeping.
- `scripting` and `activeTab`: inject the search overlay only after a direct user command on the
  active page.
- `contextMenus`: provide explicit browser context-menu save actions.

Optional permissions:

- `history`: off by default. When the user enables browser history search, TabSetu reads browser
  history only to show matching rows inside the local search overlay. Browser history is not
  uploaded to a TabSetu server. Users can disable the feature and revoke the permission in Settings.
- `notifications`: show reminder, schedule, and capture notices. Core saving works without it.
- `identity`: start optional Google Drive OAuth connection where supported.

TabSetu does not request `<all_urls>` host access.

## Share Links And Exports

Encoded share links are local snapshots stored in the URL, not hosted cloud links. Share links and
exports may contain user-selected tab titles, URLs, notes, folder or tag names, and session
metadata, depending on format. Anyone with a shared link or file can view or import its snapshot.

## AI Prompt Sharing

AI prompt sharing is user-triggered. TabSetu generates and copies prompt text from a user-selected
saved session. A prompt may include tab titles, URLs, notes, and selected metadata. TabSetu opens a
chosen AI provider only after the user selects it and does not automatically submit a prompt.
Third-party provider privacy terms apply after the user opens or submits content there. Custom
provider URLs are user-configured and must use HTTPS.

## Business And Measurement

TabSetu has no ads, no analytics SDK, no telemetry SDK, no payment processing, no subscription, and
no sale of user data.

## Contact

For security reports, see [SECURITY.md](SECURITY.md).
