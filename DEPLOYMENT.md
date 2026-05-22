# TabSetu Deployment Guide

Last updated: 2026-05-22

This guide is the release runbook for publishing TabSetu browser builds. Microsoft Edge is already completed; the remaining detailed launch work in this document focuses on Brave and Safari.

## Release Status

| Browser | Store / channel | Status | Notes |
| --- | --- | --- | --- |
| Edge | Microsoft Edge Add-ons | Completed | Keep the published package and listing as the baseline for copy, screenshots, privacy answers, and permission justifications. |
| Brave | Chrome Web Store | Pending | Brave supports Chromium-compatible extensions and users install them from the Chrome Web Store. Ship through the Chrome Web Store listing, then verify in Brave. |
| Safari | Apple App Store | Pending | Requires Safari Web Extension packaging, Apple Developer account, App Store Connect metadata, and signed-build OAuth validation. |

## Sources To Check Before Submission

Store rules change over time. Re-check these official pages on the day of submission:

- Brave Help Center: [How can I add extensions to Brave?](https://support.brave.app/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave)
- Chrome Extensions documentation: [Distribute your extension](https://developer.chrome.com/docs/extensions/how-to/distribute)
- Apple Developer: [Safari extensions](https://developer.apple.com/safari/extensions/)
- Apple Developer Documentation: [Safari web extensions](https://developer.apple.com/documentation/SafariServices/safari-web-extensions)

## Preflight

Run this before creating any store package.

```powershell
npm install
npm run type-check
npm test
npm run build:all
```

Confirm the production Google OAuth client ID was injected:

```powershell
Select-String -Path dist-browsers\*\manifest.json -Pattern "__REPLACE_WITH_CLIENT_ID__"
```

Expected result: no matches for any production build that supports Google Drive sync.

Confirm generated build folders:

```powershell
Get-ChildItem dist-browsers
```

Expected folders:

- `chrome`
- `edge`
- `brave`
- `opera`
- `arc`
- `vivaldi`
- `firefox`
- `safari`

## Store Assets

Reuse the completed Edge assets as the source of truth unless the target store requires different dimensions.

Available assets:

- `tabsetu_edge_store_assets/tabsetu_store_logo_300x300.png`
- `tabsetu_edge_store_assets/tabsetu_small_promotional_tile_440x280.png`
- `tabsetu_edge_store_assets/tabsetu_large_promotional_tile_1400x560.png`
- `tabsetu_edge_store_assets/01_dashboard_dark_1280x800.png`
- `tabsetu_edge_store_assets/02_dashboard_light_1280x800.png`
- `tabsetu_edge_store_assets/03_session_details_light_1280x800.png`
- `tabsetu_edge_store_assets/04_settings_light_1280x800.png`
- `tabsetu_edge_store_assets/05_extension_panel_montage_1280x800.png`
- `tabsetu_edge_store_assets/06_extension_panel_dark_montage_1280x800.png`

Recommended screenshot order:

1. Dashboard dark mode
2. Dashboard light mode
3. Session details
4. Settings and Google Drive sync
5. Extension popup
6. Extension popup dark mode

## Shared Listing Copy

Use consistent product positioning across stores.

Short description:

```text
Save, organize, search, and restore browser sessions with folders, tags, notes, reminders, scheduled reopen, and optional Google Drive sync.
```

Long description:

```text
TabSetu helps you turn tab overload into organized, searchable workspaces.

Save the current window, restore sessions later, organize tabs with folders and tags, add notes, set reminders, schedule sessions to reopen, and search across your saved browser history. TabSetu is local-first: your session library starts in your browser storage, and optional Google Drive sync stores data in your own Google Drive app data folder. TabSetu does not run a backend sync server.

Highlights:
- Save one tab, selected tabs, or an entire window.
- Organize sessions with folders, tags, notes, and search.
- Restore saved sessions when you need them.
- Schedule sessions and reminders for planned work.
- Use keyboard shortcuts and context menus for fast capture.
- Sync across your own devices with optional Google Drive app data sync.
- Export and import your data when needed.

Privacy:
TabSetu is local-first. Saved sessions are stored in your browser unless you choose to connect Google Drive sync. When Google Drive sync is connected, TabSetu stores its own sync file in your Google Drive app data folder and does not read or modify files in your normal Drive.
```

## Permission Justifications

Use these answers for Brave / Chrome Web Store and adapt the same language for Safari review notes where relevant.

| Permission | Justification |
| --- | --- |
| `tabs` | Reads current tab titles, URLs, favicons, and window state so the user can save and restore sessions. |
| `storage` | Stores saved sessions, folders, tags, notes, schedules, preferences, and sync state locally in the browser. |
| `alarms` | Schedules reminders and planned session reopen events. |
| `notifications` | Shows reminder notifications requested by the user. |
| `scripting` | Injects the search overlay only when the user invokes the feature. |
| `activeTab` | Allows user-triggered actions against the active tab without broad active-page access. |
| `contextMenus` | Adds right-click actions for saving a tab or window. |
| `identity` | Starts the Google OAuth flow for optional Google Drive sync where the browser supports the Identity API. |
| `history` | Supports session search and browser-session helper flows that depend on tab history metadata. |
| `<all_urls>` host permission | Allows capture and restore behavior across normal websites and lets the search overlay work on pages where the user invokes it. |

OAuth scopes:

| Scope | Justification |
| --- | --- |
| `https://www.googleapis.com/auth/drive.appdata` | Stores and reads TabSetu's own sync data file in the user's hidden Google Drive app data folder. |
| `https://www.googleapis.com/auth/userinfo.email` | Shows the connected Google account email in TabSetu settings so users know which account is syncing. |

## Brave Deployment

Brave does not need a separate extension build pipeline from Chromium. TabSetu already generates `dist-browsers/brave`, but public distribution should use the Chrome Web Store because Brave users install Chromium-compatible extensions from there.

### 1. Build The Brave Package

```powershell
npm run build:all
Compress-Archive -Path dist-browsers\brave\* -DestinationPath tabsetu-brave-v1.0.1.zip -Force
```

Keep this ZIP for QA and reviewer/debug reference. For the public listing, upload the Chromium package expected by the Chrome Web Store. If the Chrome listing already uses `dist-browsers/chrome`, make Brave part of the same listing and test Brave against that published item.

### 2. Verify The Manifest

```powershell
Get-Content dist-browsers\brave\manifest.json
```

Check:

- `manifest_version` is `3`.
- `oauth2.client_id` is the production client ID, not `__REPLACE_WITH_CLIENT_ID__`.
- `background.service_worker` is present.
- `permissions` includes `identity` for Google Drive sync.
- `content_security_policy.extension_pages` allows `https://www.googleapis.com` and `https://oauth2.googleapis.com`.

### 3. Local QA In Brave

1. Open Brave.
2. Go to `brave://extensions`.
3. Enable developer mode.
4. Click `Load unpacked`.
5. Select `dist-browsers/brave`.
6. Pin TabSetu to the toolbar.
7. Run the QA checklist below.

Brave QA checklist:

- Extension popup opens.
- Dashboard opens from the popup.
- Save current window.
- Save a single tab from the context menu.
- Restore a saved session.
- Search overlay opens on a normal HTTPS page.
- Reminder notification appears after a short test reminder.
- Google Drive sign-in starts and returns to TabSetu without `redirect_uri_mismatch`.
- Sync push and pull work after sign-in.
- Export and import still work.

### 4. Chrome Web Store Submission For Brave Users

Use the existing Chrome Web Store item, or create one if Chrome is not published yet:

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Upload the Chrome/Chromium production ZIP.
3. Fill in listing copy from this document.
4. Upload screenshots and promotional images.
5. Complete privacy disclosures with the local-first and Google Drive sync wording.
6. Add permission justifications from this document.
7. Submit for review.

Brave-specific listing note:

```text
TabSetu is compatible with Brave through the Chrome Web Store. Brave users can install the extension directly from the Chrome Web Store and manage it at brave://extensions.
```

### 5. Production QA After Approval

After the Chrome Web Store listing is approved:

1. Open the listing in Brave.
2. Confirm the install button says `Add to Brave`.
3. Install the store version.
4. Confirm the installed extension ID.
5. Add the exact Brave redirect URI to the Google Cloud OAuth client if it differs from the Chrome ID:

```text
https://<BRAVE_OR_STORE_EXTENSION_ID>.chromiumapp.org/google
```

6. Re-test Google Drive sign-in and sync from the store-installed Brave build.
7. Save the final extension ID, listing URL, version, and approval date in release notes.

## Safari Deployment

Safari is not just another ZIP upload. Apple distributes Safari web extensions through an app wrapper, normally built in Xcode and submitted through App Store Connect. Apple also supports packaging Safari web extensions through App Store Connect, but the Xcode path is still the safest path when you need signed-build QA.

Important Safari OAuth caveat:

Do not advertise or submit Google Drive sync as production-ready on Safari until a signed Safari build completes the Google OAuth flow end to end. The current Safari build removes `chrome.identity` and uses the bundled `oauth-callback.html` fallback. If Google Cloud rejects the Safari callback URL for the OAuth client type, choose one of these before submission:

- Add a hosted HTTPS callback under `tabsetu.app` and hand the result back to the Safari extension.
- Use a Safari-appropriate OAuth client and adjust the redirect flow.
- Disable Google Drive sync in the Safari production build and listing until the redirect flow is redesigned.

### 1. Prerequisites

- macOS with current Xcode installed.
- Apple Developer Program membership.
- App Store Connect access for the TabSetu developer account.
- Production Google Cloud OAuth project.
- Public homepage and privacy policy URLs.
- Final app name, subtitle, category, support URL, and marketing URL.

### 2. Build The Safari Extension Folder

```powershell
npm run build:safari
```

On macOS, or after copying the repository to macOS, confirm:

```bash
ls dist-browsers/safari
cat dist-browsers/safari/manifest.json
```

Check:

- `oauth2` is removed from the Safari manifest.
- `identity` is removed from `permissions`.
- `oauth-callback.html` exists in `dist-browsers/safari`.
- `oauth-callback.html` is included in `web_accessible_resources`.
- `BROWSER_BUILD.md` exists and explains the Safari conversion flow.

### 3. Convert To An Xcode Project

Run from the repository root on macOS:

```bash
xcrun safari-web-extension-converter dist-browsers/safari --project-location ./safari-xcode --app-name TabSetu
```

If the converter reports options that are required for current Xcode, follow the converter prompts and keep the bundle identifiers stable. Recommended identifiers:

```text
macOS app bundle ID: app.tabsetu.TabSetu
Safari extension bundle ID: app.tabsetu.TabSetu.Extension
```

Commit source changes only if the generated Xcode project is intentionally tracked. Otherwise keep `safari-xcode/` as a local release artifact.

### 4. Configure Xcode

1. Open the generated project in Xcode.
2. Select the app target.
3. Set `Display Name` to `TabSetu`.
4. Set the bundle identifier.
5. Select the Safari extension target.
6. Set the extension bundle identifier.
7. Configure `Signing & Capabilities` for both targets.
8. Use the TabSetu icon assets for the app and extension.
9. Set deployment targets for the Apple platforms you plan to support.
10. Build locally.

Local Safari QA:

1. Run the app from Xcode.
2. Open Safari.
3. Go to `Safari > Settings > Extensions`.
4. Enable TabSetu.
5. Confirm the toolbar item appears.
6. Open the popup and dashboard.
7. Run the Safari QA checklist below.

Safari QA checklist:

- Popup opens without console errors.
- Dashboard opens.
- Save current tabs.
- Restore a saved session.
- Folders, tags, notes, and search work.
- Reminder notifications work, or any Safari limitation is documented in review notes.
- Scheduled reopen works.
- Export and import work.
- Google Drive sync is either fully verified or clearly disabled/omitted from Safari listing copy.

### 5. Validate Safari OAuth

If Safari sync is enabled:

1. Install the signed development or TestFlight build.
2. Open TabSetu settings.
3. Start Google Drive sign-in.
4. Confirm the Google consent screen shows only:
   - Google Drive app data access
   - primary email address access
5. Complete consent.
6. Confirm TabSetu receives the callback.
7. Confirm the connected email appears in settings.
8. Push a sync snapshot.
9. Reinstall or use a second device/build.
10. Pull sync and confirm the saved session appears.

If any step fails, do not submit Safari with Google Drive sync enabled in the product copy.

### 6. App Store Connect Setup

1. Open [App Store Connect](https://appstoreconnect.apple.com/).
2. Create a new app record for `TabSetu`.
3. Select the correct platform: macOS, iOS/iPadOS, or universal if the generated project supports it.
4. Enter the bundle ID created in Certificates, Identifiers & Profiles.
5. Set category to `Productivity`.
6. Add support URL, marketing URL, and privacy policy URL.
7. Add screenshots and app preview assets if required.
8. Complete app privacy details.
9. Add review notes.

Recommended Safari review notes:

```text
TabSetu is a local-first Safari web extension for saving, organizing, searching, and restoring browser sessions. User data is stored locally by default. Optional Google Drive sync, when enabled in this build, stores TabSetu's own sync data in the user's Google Drive app data folder and does not access normal Drive files.

Testing path:
1. Launch the TabSetu app.
2. Enable the extension in Safari Settings > Extensions.
3. Open the TabSetu toolbar popup.
4. Save the current window.
5. Open the dashboard to view, search, and restore the saved session.
```

If Safari Google sync is disabled for the first release, add:

```text
Google Drive sync is not enabled in this Safari release. Session saving, organization, search, reminders, scheduled reopen, export, and import are available locally.
```

### 7. Archive And Submit

1. In Xcode, select a release destination.
2. Choose `Product > Archive`.
3. Validate the archive.
4. Upload to App Store Connect.
5. In App Store Connect, attach the uploaded build to the release.
6. Answer export compliance, content rights, age rating, and privacy questions.
7. Submit for App Review.

### 8. TestFlight

Use TestFlight before public release.

TestFlight checklist:

- Install on a clean Apple account/device.
- Enable extension from Safari settings.
- Test popup and dashboard.
- Save and restore sessions.
- Test reminders.
- Test import/export.
- Test Google Drive sync only if Safari OAuth passed signed-build validation.
- Confirm privacy copy matches actual Safari behavior.

## Completed Edge Baseline

Use the completed Edge submission as the baseline for future store submissions.

Record these values in release notes:

- Edge listing URL
- Edge product ID
- Published version
- Approval date
- Exact ZIP filename submitted
- Store screenshots used
- Privacy answers used
- Permission justification answers used

Do not change the production OAuth client, extension permissions, or listing privacy claims without re-testing Edge. Existing users depend on the published OAuth client and extension ID.

## Final Release Checklist

- [ ] Version in `package.json` and `src/manifest.json` matches the intended release.
- [ ] `npm run type-check` passes.
- [ ] `npm test` passes.
- [ ] `npm run build:all` completes.
- [ ] No production manifest contains `__REPLACE_WITH_CLIENT_ID__`.
- [ ] Brave local unpacked QA passes.
- [ ] Brave store-installed QA passes after Chrome Web Store approval.
- [ ] Safari Xcode build succeeds.
- [ ] Safari signed-build QA passes.
- [ ] Safari OAuth is either verified end to end or removed from Safari listing/build.
- [ ] Store privacy declarations match actual behavior.
- [ ] Homepage and privacy policy are public.
- [ ] Google Cloud OAuth redirect URIs are registered for every published build that supports sync.
- [ ] Release notes include store URLs, build ZIP names, extension IDs, and approval dates.

## Rollback Notes

If a published release breaks:

1. Pause staged rollout if the store supports it.
2. Prepare a hotfix using the last known good version plus the minimal fix.
3. Do not delete the production OAuth client.
4. Do not remove redirect URIs used by already published extension IDs.
5. Submit the hotfix and include concise reviewer notes explaining the fix.

## Privacy Summary

TabSetu is local-first.

- Session data stays in browser storage by default.
- Optional Google Drive sync stores TabSetu data in the user's Google Drive app data folder.
- TabSetu does not operate a backend sync server.
- TabSetu does not sell user data.
- TabSetu does not use Google user data for advertising.
- Users can disconnect sync and remove extension data by signing out, clearing extension storage, or uninstalling the extension.
