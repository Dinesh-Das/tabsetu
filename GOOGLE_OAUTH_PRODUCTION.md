# TabSetu Google OAuth Production Runbook

Last checked against official Google and Chrome docs: 2026-05-15.

This runbook explains how to move TabSetu's Google OAuth setup from development/testing into production so Google Drive sync keeps working for real users, avoids test-user expiry, uses the least risky scopes, and has the right verification, privacy, and store-review material ready.

## Production Goal

The production target is:

- A dedicated Google Cloud production project for TabSetu.
- OAuth app audience set to External and In production.
- Verified OAuth branding where required.
- A production OAuth client ID built into every production extension package.
- Exact redirect URIs registered for every browser/store build that will support Google sync.
- Google Drive API enabled.
- Only the scopes TabSetu actually uses:
  - `https://www.googleapis.com/auth/drive.appdata`
  - `https://www.googleapis.com/auth/userinfo.email`
- A public homepage and privacy policy that accurately describe Google Drive sync and Chrome Web Store Limited Use compliance.
- Store listings whose privacy declarations match the code behavior.

## Current TabSetu Implementation

TabSetu already implements the correct broad shape for a browser extension:

- `src/manifest.json` contains the `identity` permission and OAuth scopes.
- `src/manifest.json` intentionally keeps `oauth2.client_id` as `__REPLACE_WITH_CLIENT_ID__`.
- `vite.config.ts` injects `GOOGLE_CLIENT_ID` from the environment into the built manifest.
- `.env.example` documents the public client ID variable.
- `src/lib/googleSync.ts` uses Authorization Code Flow with PKCE, exchanges the code at `https://oauth2.googleapis.com/token`, stores tokens in `chrome.storage.local`, refreshes when possible, and calls Drive APIs directly.
- `src/lib/browserCompat.ts` calls `chrome.identity.getRedirectURL("google")` where the Identity API exists, and has a Safari tab-based fallback.
- `scripts/prepare-browser-builds.mjs` prepares Chrome, Edge, Brave, Opera, Arc, Vivaldi, Firefox, and Safari output folders under `dist-browsers/`.

Important repo-specific notes:

- Do not hard-code the production client ID in `src/manifest.json`. Use `GOOGLE_CLIENT_ID` at build time.
- Do not put a Google client secret in this extension. Extensions are public clients. Google says public clients such as native apps or JavaScript-based apps cannot securely store secrets.
- Current Google Drive docs classify `drive.appdata` as non-sensitive, not sensitive. If an older local deployment note says otherwise, prefer the current Google docs and the Cloud Console's current scope classification.
- The code hardcodes the OAuth redirect path as `google`, so the redirect URI must end with `/google` for Chromium-family builds.

## Official References

Use official sources first when something changes:

- [Chrome `identity` API](https://developer.chrome.com/docs/extensions/reference/api/identity): `getRedirectURL()` returns URLs matching `https://<app-id>.chromiumapp.org/*`, and `launchWebAuthFlow()` closes when the provider redirects there.
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth): choose the narrowest scope; `drive.appdata` is listed under non-sensitive Drive scopes.
- [Drive appDataFolder guide](https://developers.google.com/workspace/drive/api/guides/appdata): app data folder is hidden, app-specific, and requires `drive.appdata`.
- [Google OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance): use separate test and production projects, keep contacts current, request only needed scopes, host a public homepage, use secure redirect URIs.
- [Google OAuth brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification): verifies app identity, support email, policy links, and authorized domains.
- [Google Cloud app audience](https://support.google.com/cloud/answer/15549945): Testing mode has a 100 test-user limit and refresh tokens expire after 7 days when non-basic scopes are requested.
- [Google Cloud OAuth client management](https://support.google.com/cloud/answer/15549257): public clients cannot securely store secrets; redirect URI changes can take minutes to hours; deleted clients break OAuth.
- [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): extensions handling personal or sensitive user data need a Limited Use disclosure near the homepage or privacy policy.

## Inputs You Need Before Production

Fill this table before touching production settings.

| Input | Example | Where it is used | Notes |
| --- | --- | --- | --- |
| Production Google account or Workspace | `admin@tabsetu.app` | Owns Google Cloud project and Search Console domain | Use an account you will keep long-term. |
| Backup project owner/editor | `support@tabsetu.app` | Google Cloud IAM | Prevent losing access if one account is unavailable. |
| Production Google Cloud project name | `TabSetu Production` | Google Cloud | Keep separate from dev/test/staging. |
| Production Google Cloud project ID | `tabsetu-prod` | Verification Center, support emails | Record exact ID. |
| App name | `TabSetu` | OAuth branding and consent screen | Must match store listing and homepage. |
| Support email | `support@tabsetu.app` | OAuth consent screen | Users and Google reviewers can contact this inbox. |
| Developer contact emails | `owner@...`, `support@...` | Google Cloud notifications | Keep monitored. Missing emails can lead to lost API access. |
| Homepage URL | `https://tabsetu.app/` | OAuth branding, verification, store listings | Must be public and describe TabSetu. A store listing alone is not enough. |
| Privacy policy URL | `https://tabsetu.app/privacy` | OAuth branding, store listings | Must disclose Google data access, use, storage, sharing, retention, and deletion. |
| Terms URL | `https://tabsetu.app/terms` | Optional but useful | Recommended for trust and review clarity. |
| Authorized domain | `tabsetu.app` | OAuth branding | Must be verified in Google Search Console using a project owner/editor account. |
| App logo | `public/icons/icon128.png` or store logo | OAuth branding and store listing | Use the same brand identity everywhere. |
| Chrome Web Store item ID | `abcdefghijklmnop...` | Redirect URI | Assigned after draft upload or existing item creation. |
| Edge Add-ons item ID | Browser-specific value | Redirect URI | Do not guess; read from installed build or store dashboard. |
| Firefox add-on ID | `tabsetu@tabsetu.app` from manifest | Redirect URI | Use the actual value returned by `browser.identity.getRedirectURL("google")`. |
| Safari bundle ID | Example: `app.tabsetu.extension` | Safari OAuth decision | Safari needs extra validation because web OAuth redirects generally require HTTPS. |
| Production OAuth client ID | `...apps.googleusercontent.com` | `GOOGLE_CLIENT_ID` at build time | Public identifier, but still avoid casual exposure in logs/screenshots. |
| Production scopes | `drive.appdata`, `userinfo.email` | OAuth data access | Must exactly match code and consent screen. |
| Demo video URL | Private YouTube/unlisted URL | Verification, if requested | Show every requested scope in use. |
| Reviewer test account | `reviewer-test@...` if needed | Store/OAuth review | Only if Google asks for an account or instructions. |

## Recommended Architecture

Use one production Google Cloud project and one Web application OAuth client for the cross-browser extension release, unless you intentionally split clients per platform.

Why this repo uses a Web application client:

- TabSetu builds for multiple browsers.
- `launchWebAuthFlow()` works with explicit redirect URIs.
- A Web application OAuth client lets you register many redirect URIs.
- TabSetu uses PKCE and does not need a client secret in the extension.

Do not switch to a Chrome Extension OAuth client unless you are making a Chrome-only flow or refactoring the build to use different clients per platform. Google's client type for Chrome extensions is useful for Chrome-specific OAuth setups, but the current TabSetu implementation is built around cross-browser redirect URIs.

## Production Setup Sequence

### 1. Create or Select the Production Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named `TabSetu Production`, or select the production project if it already exists.
3. Add at least two trusted owners/editors under IAM.
4. Make sure the support email and developer contact emails are monitored.
5. Do not reuse the development/testing project for production.

Why separate projects matter:

- Google OAuth production policy recommends separate projects for testing and production.
- Production OAuth clients should not contain local-only test redirect URIs.
- Testing mode refresh tokens can expire after 7 days for flows like TabSetu's Drive sync.
- Keeping dev and prod separate makes verification and future scope reviews cleaner.

### 2. Enable Required APIs

In the production project:

1. Open `APIs & Services > Library`.
2. Enable `Google Drive API`.
3. No backend API key is needed for TabSetu's current Drive sync.
4. Do not enable extra APIs unless the code actually calls them.

### 3. Prepare the Public Website

Before OAuth verification, publish:

- Homepage: `https://tabsetu.app/`
- Privacy policy: `https://tabsetu.app/privacy`
- Optional terms: `https://tabsetu.app/terms`
- Optional support/contact page: `https://tabsetu.app/support`

Homepage requirements:

- Publicly accessible without login.
- Clearly about TabSetu, not a generic placeholder.
- Describes that TabSetu is a browser extension for saving and restoring sessions.
- Links to the privacy policy.
- Uses the same app name and logo as the OAuth consent screen and store listing.

Privacy policy requirements:

- Explain that Google Drive sync is optional or user-initiated if that is how the UI behaves.
- Explain that TabSetu requests `drive.appdata` to create, read, and update a TabSetu sync JSON file in the user's Google Drive app data folder.
- Explain that TabSetu requests `userinfo.email` to show the connected Google account in settings.
- State that TabSetu does not read, modify, or list the user's normal Drive files.
- State that TabSetu does not run a backend server for sync if that remains true.
- State that OAuth tokens are stored locally in the browser extension storage.
- State how users can disconnect Google Drive sync and delete local extension data.
- Include a Limited Use disclosure for Chrome Web Store policy compliance.

Suggested privacy policy wording to adapt:

```text
When you connect Google Drive sync, TabSetu requests permission to use your Google Drive app data folder. TabSetu stores a TabSetu sync file in that hidden app-specific folder so your saved sessions, folders, tags, notes, schedules, and related TabSetu data can sync across your own devices. TabSetu does not read or modify files in your regular Google Drive.

TabSetu also requests access to your primary Google Account email address so the extension can show which account is connected. This email address is used only inside the extension interface and is not sold, used for advertising, or shared with third parties.

TabSetu does not operate a backend sync server. Sync requests go directly from your browser extension to Google APIs. OAuth tokens are stored locally by the extension and can be removed by disconnecting Google Drive sync or removing the extension.

TabSetu's use and transfer of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements, and to the Google API Services User Data Policy, including Limited Use requirements.
```

### 4. Verify the Domain

1. Sign in to [Google Search Console](https://search.google.com/search-console) with a Google Cloud project owner/editor account.
2. Add a Domain property for the root domain, for example `tabsetu.app`.
3. Add the TXT record at your DNS provider.
4. Click Verify in Search Console.
5. Use the same Google account as an owner/editor in the Google Cloud project.

Google requires authorized domains to be verified for OAuth branding and verification. Use a DNS-level Domain property, not only a URL-prefix property.

### 5. Configure OAuth Branding

In the production project, open `Google Auth Platform > Branding` or `APIs & Services > OAuth consent screen`, depending on the current Console UI.

Enter:

- App name: `TabSetu`
- User support email: monitored support address
- App logo: TabSetu logo
- Homepage URL
- Privacy policy URL
- Terms URL, if available
- Authorized domain: `tabsetu.app`
- Developer contact emails

Then:

1. Save the branding draft.
2. If the Console shows `Verify Branding`, start it.
3. Fix any issues shown in `View issues`.
4. When status becomes `Ready to publish`, click `Publish branding` within the allowed window.

If you change the app name, logo, homepage, privacy policy URL, terms URL, or authorized domains later, expect to re-verify and publish the new branding version.

### 6. Configure App Audience

Open `Google Auth Platform > Audience`.

Use:

- User type: `External`
- Publishing status: `In production` when ready for public release

Testing mode is only for dev/staging:

- Limited to up to 100 test users.
- Shows a tester warning.
- Refresh tokens expire after 7 days for requests beyond basic profile/email/openid scopes.
- This is not acceptable for "works all the time" production sync.

### 7. Configure Data Access and Scopes

Open `Google Auth Platform > Data Access` or the OAuth consent screen Scopes step.

Add only these scopes:

```text
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/userinfo.email
```

Justification:

- `drive.appdata`: TabSetu stores and retrieves its own sync file in the user's Google Drive app data folder. The app data folder is hidden from the normal Drive UI and only accessible by the app that created it.
- `userinfo.email`: TabSetu displays the currently connected Google account in settings so the user can confirm which account is syncing.

Avoid these unless the product genuinely changes:

- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.metadata`
- `https://www.googleapis.com/auth/drive.metadata.readonly`
- Gmail, Calendar, Contacts, or broader People API scopes

Adding broad Drive or Gmail scopes can move the app into sensitive or restricted verification, and restricted scopes can require much heavier review or security assessment.

### 8. Create the Production OAuth Client

Open `Google Auth Platform > Clients` or `APIs & Services > Credentials`.

1. Click `Create client`.
2. Choose `Web application`.
3. Name it `TabSetu Extension Production`.
4. Leave Authorized JavaScript origins empty unless you add a real hosted web OAuth flow.
5. Add Authorized redirect URIs for production browser builds.
6. Save the client.
7. Copy the Client ID.
8. Do not copy or use the client secret in the extension.

Redirect URI changes can take from a few minutes to a few hours to take effect, so do not test immediately and assume the configuration is wrong.

## Redirect URI Playbook

The golden rule: do not guess redirect URIs. Install or load the exact build and run the browser identity API to get the exact value.

TabSetu uses the path `google`, so every working redirect URI must include that path.

### Chromium-family Builds

Applies to Chrome, Edge, Brave, Opera, Arc, Vivaldi, and most Chromium-compatible browsers that expose `chrome.identity`.

Expected pattern:

```text
https://<extension-id>.chromiumapp.org/google
```

How to discover the exact redirect:

1. Load the exact extension build.
2. Open the extension service worker or extension page DevTools.
3. Run:

```js
chrome.identity.getRedirectURL("google")
```

4. Copy the returned URL exactly.
5. Add it to the production Web application OAuth client's Authorized redirect URIs.

Production store ID workflow:

1. Upload the first Chrome Web Store draft to get the item ID.
2. Add `https://<chrome-web-store-item-id>.chromiumapp.org/google` to the production OAuth client.
3. If the client ID in the build is already correct, you do not need a new build just because you added the redirect URI.
4. Wait for propagation.
5. Submit the store item only after the redirect is registered.

Local development workflow:

- Use the development Google Cloud project.
- Add local unpacked extension redirect URIs only to the development OAuth client.
- Do not add local-only extension IDs to the production OAuth client unless Google support explicitly asks for a temporary verification/testing setup.

### Firefox

Firefox has its own WebExtension identity behavior. The prepared manifest sets:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "tabsetu@tabsetu.app",
    "strict_min_version": "128.0"
  }
}
```

How to discover the exact redirect:

```js
browser.identity.getRedirectURL("google")
```

or, depending on the compatibility layer available in the extension context:

```js
chrome.identity.getRedirectURL("google")
```

Add the exact returned URL to the production Web application OAuth client.

Do not assume the Firefox redirect is the same as Chrome. Record the actual value returned by Firefox Developer Edition or the signed AMO build.

### Safari

Safari is the one production caveat in the current implementation.

The current code path does this when `chrome.identity` is unavailable:

- `getOAuthRedirectUrl("google")` returns `chrome.runtime.getURL("oauth-callback.html")`.
- `launchOAuthFlow()` opens the Google auth URL in a tab.
- `oauth-callback.html` sends the final redirect URL back to the extension via `chrome.runtime.sendMessage`.

Before claiming Safari Google sync is production-ready, validate whether Google Cloud accepts the exact Safari extension callback URL as an OAuth redirect URI for the client type you are using.

Likely outcomes:

- If Google accepts the exact Safari extension callback URL, add it and test the signed Safari build.
- If Google rejects the Safari extension URL because the Web application client requires HTTPS redirect URIs, Safari needs a small design change before production sync. The usual options are:
  - Use a hosted HTTPS callback under `tabsetu.app` and add extension messaging or a deep-link handoff that Safari can receive.
  - Use a Safari/iOS-appropriate OAuth client type and adjust the redirect flow accordingly.
  - Disable Google Drive sync in the Safari production build until the redirect is redesigned and verified.

Do not silently ship Safari sync without a successful end-to-end sign-in test from the signed Safari build.

## Build-Time Configuration

Use `GOOGLE_CLIENT_ID` for production builds.

PowerShell example:

```powershell
$env:GOOGLE_CLIENT_ID="YOUR_PRODUCTION_WEB_CLIENT_ID.apps.googleusercontent.com"
npm ci
npm run type-check
npm test
npm run lint
npm run build:all
```

Or create a local `.env.production` file for local production builds:

```env
GOOGLE_CLIENT_ID=YOUR_PRODUCTION_WEB_CLIENT_ID.apps.googleusercontent.com
```

Do not commit `.env` or `.env.production` if they are local machine files. The client ID is public, but keeping env files uncommitted prevents accidental future secret leakage if more variables are added.

After building, inspect the generated manifests:

```powershell
Select-String -Path "dist-browsers\chrome\manifest.json" -Pattern "__REPLACE_WITH_CLIENT_ID__|client_id"
Select-String -Path "dist-browsers\edge\manifest.json" -Pattern "__REPLACE_WITH_CLIENT_ID__|client_id"
Select-String -Path "dist-browsers\firefox\manifest.json" -Pattern "__REPLACE_WITH_CLIENT_ID__|client_id"
```

The build is invalid if `__REPLACE_WITH_CLIENT_ID__` appears in any production manifest that is expected to support Google sync.

## Packaging and Store Release Order

Recommended release order:

1. Finish Google Cloud production branding, audience, scopes, and client creation.
2. Build with the production OAuth client ID.
3. Upload a draft to each store that assigns a stable item ID.
4. Copy each assigned item ID.
5. Install or load the exact draft/signed build and run `getRedirectURL("google")`.
6. Add each exact production redirect URI to the production OAuth client.
7. Wait for redirect propagation.
8. Re-test sign-in and sync.
9. Complete store privacy and permission disclosures.
10. Submit for store review.
11. If Google OAuth verification is requested, submit that review with the same production build and demo video.

Chrome Web Store:

- Package `dist-browsers/chrome`.
- Zip the contents of the folder, not the folder wrapper.
- Ensure the Privacy tab matches the privacy policy.
- Mention Google Drive sync under user data handling if the dashboard asks.
- Reviewers must be able to click Connect Google Drive without hitting `redirect_uri_mismatch` or an unverified-app warning caused by wrong scopes.

Edge Add-ons:

- Package `dist-browsers/edge`.
- Add the Edge-specific redirect URI to the same production OAuth client after the Edge item ID is known.

Firefox AMO:

- Package `dist-browsers/firefox`.
- Make sure the Firefox redirect URI is registered.
- AMO may request source code for review; provide a source archive that excludes `node_modules`, secrets, and generated artifacts unless requested.

Safari:

- Package `dist-browsers/safari`, convert with Xcode, sign, and test.
- Treat Google sync as blocked until the Safari redirect test passes against production Google OAuth.

## Verification Path

With the current scopes, Google Cloud may only require brand/basic verification. The Cloud Console is the source of truth because it classifies scopes when you add them.

If the Console says verification is not required:

- Still publish production branding.
- Still move audience to In production.
- Still ensure scopes in code match scopes in Data Access.
- Still test with a non-owner Google account.

If Google requires OAuth verification:

1. Publish the app to production in the OAuth audience page.
2. Open Verification Center or `Prepare for Verification`.
3. Confirm all branding details are correct.
4. Confirm all scopes requested by the app are declared.
5. Provide scope justifications.
6. Provide a demo video if requested.
7. Submit.
8. Monitor project owner/editor and support email inboxes.
9. Reply quickly to reviewer questions.

Suggested scope justifications:

```text
https://www.googleapis.com/auth/drive.appdata
TabSetu uses this scope to create, read, and update one TabSetu sync JSON file inside the user's Google Drive app data folder. This lets the user's own browser extension installations sync saved sessions, folders, tags, notes, schedules, and related TabSetu data across their devices. TabSetu does not request access to normal Drive files and does not read files outside the app data folder.

https://www.googleapis.com/auth/userinfo.email
TabSetu uses this scope only to display the signed-in Google account email inside the extension settings, so users can confirm which account is connected for sync.
```

Suggested verification/demo video outline:

1. Show the public TabSetu homepage and privacy policy.
2. Show the extension listing or signed production build.
3. Open TabSetu dashboard.
4. Click Connect Google Drive.
5. Show the Google consent screen and requested scopes.
6. Complete consent.
7. Show TabSetu settings displaying the connected email.
8. Save a browser session.
9. Click Sync now.
10. Install/sign in from a second browser profile or supported browser.
11. Pull sync and show the saved session appears.
12. Show disconnect/sign-out removes the local token.

Keep passwords, recovery emails, and private browser data out of the video.

## Safety Checklist

Use this before each production release.

- [ ] Production Google Cloud project is separate from dev/test.
- [ ] At least two project owners/editors are current.
- [ ] Support email and developer contacts are monitored.
- [ ] Google Drive API is enabled.
- [ ] OAuth audience is External and In production.
- [ ] Branding is verified/published if required.
- [ ] Homepage is public and describes TabSetu.
- [ ] Privacy policy is public, same primary domain, and linked from homepage.
- [ ] Privacy policy discloses Google data access and Limited Use compliance.
- [ ] Data Access includes only `drive.appdata` and `userinfo.email`.
- [ ] Production OAuth client is Web application for the current cross-browser flow.
- [ ] No client secret is present in source, env files, manifests, logs, or store submissions.
- [ ] Every production browser/store redirect URI is registered exactly.
- [ ] No local unpacked dev redirect URI is left in the production OAuth client.
- [ ] Build manifests contain the production `GOOGLE_CLIENT_ID`.
- [ ] `__REPLACE_WITH_CLIENT_ID__` is absent from production manifests.
- [ ] `npm run type-check`, `npm test`, and `npm run lint` pass.
- [ ] Google sign-in works from the store/signed build, not only unpacked dev.
- [ ] Sync upload and pull both work.
- [ ] Sign-out/reconnect works.
- [ ] Store privacy declarations match the privacy policy and code behavior.

## Troubleshooting Matrix

| Symptom | Most likely cause | Fix |
| --- | --- | --- |
| `Google sign-in could not be completed. Check the OAuth client setup.` | Built manifest still has placeholder client ID | Rebuild with `GOOGLE_CLIENT_ID`, inspect generated manifest. |
| `redirect_uri_mismatch` | Exact redirect URI not registered, wrong extension ID, wrong path, or Google settings have not propagated | Run `chrome.identity.getRedirectURL("google")`, copy exact URL, add it to the OAuth client, wait. |
| Works unpacked but fails from store | Local extension ID redirect was registered, store item ID redirect was not | Add store build redirect URI. |
| Works in Chrome but fails in Edge/Brave/Firefox | Each browser/build has a different redirect URI | Discover and register each browser's exact returned URI. |
| Google shows "This app is blocked" or `org_internal` | Audience is Internal or Workspace/admin restrictions apply | Set app audience to External for public users; advise Workspace users to contact admins if third-party apps are blocked. |
| Google shows "unverified app" | App is in Testing, brand not verified/published, scopes mismatch, or a sensitive/restricted scope is requested before approval | Match declared scopes to code, publish production audience, complete verification. |
| New users stop authorizing near 100 users | App is hitting unverified/test user cap | Move production app to In production and complete required verification. |
| Users need to reconnect every week | App still in Testing and refresh tokens expire after 7 days for this flow | Use In production for public releases. |
| `invalid_client` | Client ID typo, deleted OAuth client, or wrong project | Verify generated manifest client ID against production Google Cloud client. |
| `deleted_client` | OAuth client was deleted or auto-deleted after inactivity | Restore if within Google's restore window or create a new client and ship a new build. Avoid deleting active clients. |
| `invalid_grant` during refresh | User revoked access, refresh token expired, old client deleted, or token tied to previous client | Clear local token and reconnect. If widespread, check client deletion/rotation. |
| Request blocked by CSP | Manifest or page-level CSP missing Google API hosts | Ensure `connect-src` includes `https://www.googleapis.com` and `https://oauth2.googleapis.com`. |
| Google review asks for more evidence | Demo video does not show each scope in use or policy pages are unclear | Provide a tighter video and exact scope explanations. |
| Safari OAuth fails before consent | Redirect URI scheme not accepted or Safari callback flow cannot receive final URL | Validate Safari separately; use hosted HTTPS callback or disable Safari sync until fixed. |

## Maintenance Rules

Do not delete the production OAuth client while any released extension version uses it. Existing refresh tokens are tied to the client. Deleting the client can break sync for installed users.

Do not rotate to a new client ID casually. If you must:

1. Create the new client.
2. Add all production redirect URIs.
3. Build and release an extension version with the new client ID.
4. Keep the old client active until most users have upgraded and old tokens are no longer needed.
5. Monitor errors.
6. Only then retire the old client if you are certain it is unused.

Expect re-verification or review if you change:

- App name.
- Logo.
- Homepage URL.
- Privacy policy URL.
- Terms URL.
- Authorized domains.
- OAuth scopes.
- OAuth redirect URIs or JavaScript origins.
- The way Google user data is stored, shared, or processed.
- Any backend/server behavior involving Google user data.

Keep the production project alive:

- Monitor Google Cloud emails.
- Keep owner/editor accounts active.
- Keep the OAuth client used by real traffic.
- Do not ignore inactivity/deletion warnings.

## Production QA Script

Run this after every OAuth, build, or store release change.

### Clean Profile Sign-In

1. Create a fresh browser profile.
2. Install the production extension from the store or signed package.
3. Open TabSetu dashboard.
4. Click Connect Google Drive.
5. Confirm the consent screen says TabSetu and shows expected scopes only.
6. Complete sign-in.
7. Confirm Settings shows the connected email.

### Sync Upload

1. Save a test session with at least two tabs.
2. Add a folder, tag, note, and schedule if possible.
3. Click Sync now.
4. Confirm no error toast appears.
5. Reload the extension and confirm signed-in state remains.

### Sync Pull

1. Install production extension in a second browser profile or second supported browser.
2. Connect the same Google account.
3. Pull sync or let initial sync run.
4. Confirm test session, folder, tag, note, and schedule appear.

### Revocation and Recovery

1. Disconnect/sign out from TabSetu.
2. Confirm Settings no longer shows the connected email.
3. Reconnect.
4. Confirm sync works again.

### Negative Cases

1. Remove the redirect URI temporarily in a dev project only and confirm the app surfaces a friendly failure.
2. Build with placeholder client ID in a dev build only and confirm the error path is visible.
3. Use an account outside your Workspace if testing public External release.

## Store Privacy and Permission Notes

TabSetu's store listing should be consistent with this product behavior:

- Local-first browser extension.
- Saved tab/session data is stored locally.
- If Google Drive sync is connected, data syncs directly between the extension and the user's own Google Drive app data folder.
- TabSetu does not run a backend sync server.
- Google account email is used only to show the connected account.
- No sale of user data.
- No advertising use of Google user data.
- No human reads user data except if the user explicitly provides data for support.

Chrome extension permissions should be justified separately from OAuth scopes. OAuth reviewers care about Google API scopes; Chrome Web Store reviewers also care about extension permissions such as `tabs`, `storage`, `identity`, `alarms`, `notifications`, `scripting`, `activeTab`, `contextMenus`, `history`, and host permissions.

## Source Files to Check Before Release

- `src/manifest.json`: permissions, OAuth scopes, placeholder client ID, CSP.
- `vite.config.ts`: env injection of `GOOGLE_CLIENT_ID`.
- `.env.example`: documents client ID variable only.
- `popup.html` and `dashboard.html`: page-level CSP includes Google API hosts.
- `src/lib/googleSync.ts`: scopes, PKCE flow, token refresh, Drive API calls.
- `src/lib/browserCompat.ts`: redirect URI generation and browser-specific OAuth launch.
- `scripts/prepare-browser-builds.mjs`: browser output manifests and Safari OAuth callback bundling.
- `dist-browsers/*/manifest.json`: generated production manifests after build.

## Final Go/No-Go

Go only when:

- Production OAuth app is In production.
- The production client ID is in the generated extension manifests.
- The exact production redirect URI for the target browser is registered.
- Consent screen shows only the expected TabSetu scopes.
- A new non-owner user can connect without test-user warnings.
- A user can reconnect after browser restart.
- Sync upload and pull are verified from production/signed builds.

No-go when:

- Any production manifest has `__REPLACE_WITH_CLIENT_ID__`.
- Any production browser returns `redirect_uri_mismatch`.
- OAuth app is still in Testing for public users.
- Store listing, homepage, privacy policy, and consent screen disagree.
- Safari sync has not passed an end-to-end signed-build OAuth test.
