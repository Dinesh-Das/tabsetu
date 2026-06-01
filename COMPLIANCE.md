# TabSetu Release Compliance Checklist

Run this checklist before each store package is uploaded.

## Automated Verification

- [ ] Run `npm install`.
- [ ] Run `npm run type-check`.
- [ ] Run `npm run type-check:strict`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build:all`.
- [ ] Run `npm run compliance:check`.

## Manifest And Permissions

- [ ] Inspect `src/manifest.json`, `dist/manifest.json`, and every `dist-browsers/*/manifest.json`.
- [ ] Confirm `history` appears only in `optional_permissions`, never required `permissions`.
- [ ] Confirm `notifications` and `identity` are optional where supported.
- [ ] Confirm no manifest requests `<all_urls>` host access.
- [ ] Confirm no always-on web-page content script is registered.
- [ ] Confirm production manifests do not contain `__REPLACE_WITH_CLIENT_ID__`.
- [ ] Confirm scripts are packaged locally and script CSP does not allow remote code or unsafe script
      execution.

## Product Accuracy

- [ ] Verify browser-history search is off by default and permission is requested only from its
      Settings button.
- [ ] Verify opening the overlay does not request history permission.
- [ ] Verify share-link disclosures describe encoded local snapshots and the large-session fallback.
- [ ] Verify AI prompt-sharing disclosures are visible before opening a provider.
- [ ] Verify no paid gates, ads, payment SDKs, affiliate SDKs, analytics SDKs, remote config gates, or
      artificial limits exist.
- [ ] Verify `PRIVACY.md`, `TERMS.md`, and store declarations match the release package.

## Google OAuth

- [ ] Confirm OAuth scopes are exactly `drive.appdata` and `userinfo.email`.
- [ ] Confirm the Google consent screen and published privacy policy match those scopes.
- [ ] Do not request broader Drive scopes.
- [ ] Confirm the public homepage or privacy policy includes the Chrome Web Store Limited Use
      disclosure.
- [ ] Validate the actual redirect URI for each submitted browser package.

## Browser Claims

- [ ] Test each browser package before advertising that browser publicly.
- [ ] Do not claim Safari Google Drive sync is production-ready until signed-build OAuth QA passes.
- [ ] Record store-dashboard privacy answers and reviewer notes for the submitted package.
