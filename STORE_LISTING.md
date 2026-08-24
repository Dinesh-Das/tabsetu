# TabSetu Store Listing

## Short Description

Free, local-first tab and session manager with folders, notes, schedules, export, and optional sync.

## Long Description

TabSetu helps you save, organize, search, and reopen browser tab sessions without depending on a
TabSetu backend. Save a tab or window, group sessions with folders and tags, add notes and
reminders, schedule sessions to reopen, export backups, and create encoded local snapshot links.

TabSetu is free forever. There are no ads, no premium tier, and no subscription.

Optional features stay under your control:

- Connect Google Drive sync to store TabSetu's own sync file in your Drive app data folder.
- Enable browser history search to add matching history rows inside the local search overlay.
- Enable notifications for reminder, schedule, and capture notices.
- Generate AI-ready prompts from selected sessions and open a chosen provider only when requested.

## Single Purpose

TabSetu provides local-first browser tab and session management.

## Feature List

- Sessions, tabs, folders, tags, and notes stored within the browser's extension-storage quota.
- Save, collapse, restore, pin, archive, and search sessions.
- Reminders and scheduled reopening.
- JSON backup, Markdown, plain text, and URL-list export.
- Encoded local snapshot links for URL-sized sessions.
- Optional Google Drive app-data sync.
- Optional browser history search.
- Optional AI prompt sharing.
- Tab-group membership restore, with optional group metadata preservation on Chromium.

## Privacy Summary

- Local-first browser storage.
- No TabSetu backend.
- No ads or analytics.
- No sale of user data.
- Browser history access is optional and off by default.
- Incognito/private tabs are never saved.
- Share links are encoded local snapshots, not hosted cloud links.
- AI prompts are generated locally and are not automatically uploaded.

## Permission Justifications

| Permission | Justification |
| --- | --- |
| `tabs` | Save, restore, switch, and organize user-selected tabs and windows. |
| `storage` | Persist the local library and settings. |
| `alarms` | Run schedules, reminders, and sync housekeeping. |
| `scripting`, `activeTab` | Open the overlay on the active page only after a direct user command. |
| `contextMenus` | Provide explicit browser context-menu save actions. |
| Optional `history` | Show matching browser-history rows after explicit opt-in. |
| Optional `notifications` | Show reminder, schedule, and capture notices. |
| Optional `identity` | Start optional Google Drive OAuth where supported. |
| Optional `tabGroups` | Preserve group names, colors, and collapsed state on Chromium. |

## Chrome Web Store Data Disclosure

- Collects or transmits data to a TabSetu backend: No.
- Sells user data: No.
- Uses analytics or ads: No.
- Handles website URLs and titles: Yes, locally for session management and user-triggered exports.
- Handles browser history: Only if the user explicitly enables optional local overlay matching.
- Transfers data to Google APIs: Only when the user enables Google Drive sync.
- Transfers prompts to AI providers: No automatic transfer. The user copies and submits prompts.

## Edge Add-ons Data Disclosure

Use the same answers as the Chrome Web Store disclosure. Confirm the submitted package matches the
generated Edge manifest and the privacy policy URL points to the published copy of `PRIVACY.md`.
