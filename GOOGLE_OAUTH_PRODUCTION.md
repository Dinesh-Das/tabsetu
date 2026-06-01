# Google OAuth Production Runbook

Last reviewed: June 1, 2026

TabSetu offers optional Google Drive sync. Local session management must remain usable when Google
Drive is disconnected or unavailable.

## Scope Contract

Use only:

```text
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/userinfo.email
```

`drive.appdata` limits access to TabSetu's own hidden app-data file. `userinfo.email` displays the
connected account in Settings. Do not request broader Drive scopes.

## Build Contract

1. Configure the public Web application OAuth client ID in `.env`.
2. Run `npm run build:all`.
3. Run `npm run compliance:check`.
4. Confirm every submitted production manifest has a real client ID and does not contain
   `__REPLACE_WITH_CLIENT_ID__`.
5. Confirm OAuth scopes in the manifest, Google consent screen, homepage, and privacy policy match.

Never put an OAuth client secret in an extension package.

## Redirect URIs

Chromium browsers use `chrome.identity.getRedirectURL("google")` when supported. Register the exact
redirect URI emitted by the store-installed package. Firefox must be checked separately. Do not
assume IDs or redirect URIs are shared between stores or local unpacked builds.

Safari is a separate production caveat. The prepared Safari package removes `identity` and uses a
tab-based callback fallback. Do not advertise Safari Google Drive sync as production-ready until a
signed Safari build completes OAuth end to end. Disable that claim if the selected Google client
type rejects the Safari callback URI.

## Consent Screen And Published Policy

The public homepage and privacy policy must explain:

- Google Drive sync is optional.
- TabSetu stores only its own sync file in the Drive app data folder.
- TabSetu does not access normal Drive files.
- TabSetu uses email only to display the connected account.
- Users can disconnect sync and revoke Google access.
- TabSetu does not operate a sync backend.

Include this exact disclosure:

> The use of information received from Google APIs will adhere to the Chrome Web Store User Data
> Policy, including the Limited Use requirements.

## Manual QA

- Connect Google Drive from Settings and confirm the optional identity prompt is user-triggered.
- Verify the connected email is displayed.
- Create or update a session and run sync.
- Reload the extension and confirm local behavior still works.
- Disconnect Google Drive and confirm the token is removed locally.
- Confirm core saving, export, and search remain available while disconnected.

## Release Gate

Do not submit a build when:

- Any production manifest contains `__REPLACE_WITH_CLIENT_ID__`.
- OAuth scopes exceed `drive.appdata` and `userinfo.email`.
- Store disclosures or the public privacy policy do not match the package.
- Safari sync is claimed without signed-build OAuth validation.
