# TabSetu Deployment Runbook

Use this runbook for each store package. Browser output folders are packaging targets and require
target-specific QA before public compatibility claims are added.

## Build And Verify

```bash
npm install
npm run type-check
npm run type-check:strict
npm run lint
npm test
npm run build:all
npm run compliance:check
```

Generated packages are placed under `dist-browsers/`.

## Permission Baseline

Required permissions:

| Permission | Purpose |
| --- | --- |
| `tabs` | Save, restore, switch, and organize tabs and windows. |
| `storage` | Keep local library data and lightweight settings. |
| `alarms` | Run schedules, reminders, and sync housekeeping. |
| `scripting`, `activeTab` | Inject overlay UI only after a user command on the active page. |
| `contextMenus` | Offer explicit save actions in browser context menus. |

Optional permissions:

| Permission | Purpose |
| --- | --- |
| `history` | Add local overlay matches only after explicit opt-in in Settings. |
| `notifications` | Show reminder, schedule, and capture notices. |
| `identity` | Start optional Google Drive OAuth where supported. |

Do not submit a package with `<all_urls>` host access, an always-on web-page content script, or
install-time `history` access.

## OAuth Baseline

OAuth scopes must remain:

```text
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/userinfo.email
```

Do not request broader Drive scopes. Replace `__REPLACE_WITH_CLIENT_ID__` in every production
manifest. See [GOOGLE_OAUTH_PRODUCTION.md](GOOGLE_OAUTH_PRODUCTION.md).

## Store Copy

Use [STORE_LISTING.md](STORE_LISTING.md) and publish [PRIVACY.md](PRIVACY.md). Keep declarations
aligned with the package:

- Free forever, no ads, no premium tier, no subscription.
- Local-first storage and no TabSetu backend.
- Optional browser-history search is off by default.
- Share links are encoded local snapshots.
- AI prompt sharing is user-triggered and does not automatically upload prompts.

## Browser QA

For each submitted target:

- Load the generated package.
- Save, collapse, restore, search, export, and import a session.
- Confirm the install prompt does not mention browser history.
- Enable and revoke optional browser-history search from Settings.
- Enable and revoke notifications.
- Test Google Drive only where OAuth has been configured and verified.
- Confirm the generated manifest passes `npm run compliance:check`.

Safari requires conversion to an Xcode project and signed-build QA. Do not advertise Safari Google
Drive sync until OAuth completes end to end in that signed build.
