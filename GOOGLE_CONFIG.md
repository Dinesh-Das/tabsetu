# Google Drive Sync Configuration

Google Drive sync is optional. TabSetu works locally without a Google account and does not operate a
sync backend.

## OAuth Scopes

Configure exactly these scopes:

```text
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/userinfo.email
```

- `drive.appdata` lets TabSetu read and write its own sync file in the user's hidden Google Drive
  app data folder.
- `userinfo.email` lets Settings show which Google account is connected.

Do not request broader Drive scopes.

## Local Build Setup

Create `.env` from `.env.example` and set the public Web application OAuth client ID:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Do not add an OAuth client secret to the extension.

`src/manifest.json` intentionally contains `__REPLACE_WITH_CLIENT_ID__` as a source placeholder.
`vite.config.ts` replaces it during builds when `GOOGLE_CLIENT_ID` is configured.

## Production Checks

Run:

```bash
npm run build:all
npm run compliance:check
```

The release is invalid if a generated production manifest still contains
`__REPLACE_WITH_CLIENT_ID__`.

Register the exact OAuth redirect URI returned by each browser package. Do not guess browser IDs or
redirect URIs.

## Published Privacy Copy

The public homepage or privacy policy must describe optional Drive app-data sync and include:

> The use of information received from Google APIs will adhere to the Chrome Web Store User Data
> Policy, including the Limited Use requirements.

See [PRIVACY.md](PRIVACY.md) and [GOOGLE_OAUTH_PRODUCTION.md](GOOGLE_OAUTH_PRODUCTION.md).
