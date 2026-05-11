# Google Configuration

TabSetu uses Google Drive for required cross-device sync. The extension stores synced session data in the signed-in user's Google Drive `appDataFolder`, which is private to the app and hidden from the normal Drive UI. TabSetu does not run a backend server for sync.

## OAuth Client Type

Use a Google OAuth client with application type **Web application**.

Do not use the **Chrome Extension** OAuth client type for the cross-browser build. Chrome Extension clients are tied to one extension item ID, while the Web application client lets you add redirect URLs for Chrome, Edge, Brave, Firefox, and local development builds.

## Build-Time Client ID

TabSetu reads the public OAuth client ID from `.env` at build time:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

`vite.config.ts` injects this value into the generated `manifest.json`. Use the Web application client ID from Google Cloud Console. Do not add a client secret to the extension.

`src/manifest.json` intentionally keeps `__REPLACE_WITH_CLIENT_ID__` as a source placeholder.

The extension CSP must allow Google API calls:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com"
}
```

The `popup.html` and `dashboard.html` entry pages also define a page-level CSP. Their `connect-src` values must allow the same Google API hosts, otherwise the page-level CSP will block requests even when the manifest CSP is correct.

## Create The Web Client

1. Open Google Cloud Console.
2. Select the TabSetu project.
3. Open **APIs & Services > OAuth consent screen**.
4. Add these scopes:

```text
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/userinfo.email
```

5. Open **APIs & Services > Credentials**.
6. Click **Create credentials > OAuth client ID**.
7. Choose **Web application**.
8. Name it `TabSetu Extension Auth`.
9. Add authorized redirect URIs for every browser/build you want to support.

## Redirect URIs

TabSetu calls:

```ts
chrome.identity.getRedirectURL("google");
```

For Chromium browsers, that usually produces:

```text
https://<extension-id>.chromiumapp.org/google
```

Add one redirect URI per installed extension ID:

```text
https://<chrome-dev-extension-id>.chromiumapp.org/google
https://<chrome-web-store-extension-id>.chromiumapp.org/google
https://<edge-extension-id>.chromiumapp.org/google
https://<brave-extension-id>.chromiumapp.org/google
```

For Firefox, use the redirect URL returned by `browser.identity.getRedirectURL("google")` or the Firefox add-on ID equivalent once the Firefox package is loaded.

## Local Testing

1. Build TabSetu:

```bash
npm run build
```

2. Load `dist` from `chrome://extensions`.
3. Copy the extension ID from the TabSetu extension card.
4. Add this redirect URI to the Web application OAuth client:

```text
https://<local-extension-id>.chromiumapp.org/google
```

5. Copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID` to the Web client ID.
6. Rebuild and reload the extension.
7. Open the dashboard. TabSetu should show the Google sign-in screen first.

## Sync Behavior

- Sign-in starts from the dashboard gate before the main app is shown.
- Tokens are requested with `identity.launchWebAuthFlow`.
- `settings` and `aiConfig` are stored in `chrome.storage.sync`.
- Sessions, folders, tags, schedules, standalone notes, and share links stay in `chrome.storage.local`.
- Full library sync uploads `StorageData` to Drive `appDataFolder`.
- Pull sync downloads the remote snapshot and merges it with local data by entity ID.
- If the same entity exists locally and remotely, the copy with the higher `updatedAt` timestamp wins.
- Settings always remain local to the current device during Drive merge.

## Files To Check

- `.env` — local Web OAuth client ID for builds.
- `.env.example` — placeholder env template for new machines.
- `src/manifest.json` — OAuth scopes, source placeholder, and `identity` permission.
- `vite.config.ts` — injects `GOOGLE_CLIENT_ID` into the built manifest.
- `src/lib/googleSync.ts` — `launchWebAuthFlow`, Drive upload, download, and metadata calls.
- `src/lib/syncMerge.ts` — last-write-wins merge strategy.
- `src/store/syncStore.ts` — sign-in, sign-out, push, and pull actions.
- `src/dashboard/components/SyncGate.tsx` — required first-run sign-in screen.
- `src/dashboard/components/SettingsPanel.tsx` — signed-in sync status and manual actions.

## Verification

After changing Google configuration or sync behavior, run:

```bash
npm test
npm run type-check
```

Then load the unpacked extension, sign in from the opening dashboard screen, run **Sync now** from Settings, and confirm that another browser build using an authorized redirect URI can sign in and pull the same sessions.
