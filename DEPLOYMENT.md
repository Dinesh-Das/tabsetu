# 🚀 TabSetu Deployment Guide

This document provides step-by-step instructions for deploying TabSetu to production across all supported browser stores and configuring the Google Cloud Platform (GCP) for secure Google Drive synchronization.

---

## 🛠️ Build Pipeline

Before any deployment, ensure you are building from a clean state and that all tests pass.

```bash
# 1. Install dependencies
npm install

# 2. Run quality checks
npm run type-check
npm test

# 3. Generate all 8 browser packages
npm run build:all
```

The `npm run build:all` command executes `scripts/prepare-browser-builds.mjs`, which generates optimized, platform-specific bundles in the `dist-browsers/` directory:

- `chrome/`, `edge/`, `brave/`, `opera/`, `arc/`, `vivaldi/` (Chromium MV3)
- `firefox/` (Firefox MV3 with Gecko compatibility)
- `safari/` (Safari web extension package)

---

## ☁️ Google Cloud Platform (GCP) Setup

TabSetu uses the Google Drive `appDataFolder` to sync sessions cross-browser. This requires a production-ready GCP project.

### 1. Create a Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **TabSetu Production**.

### 2. Enable APIs
1. Navigate to **APIs & Services > Library**.
2. Search for and enable the **Google Drive API**.

### 3. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** user type.
3. **App Information:**
   - App name: `TabSetu`
   - User support email: `your-email@example.com`
   - App logo: (Upload `src/icons/icon128.png`)
4. **Developer contact info:** `your-email@example.com`
5. **Scopes:** Click **Add or Remove Scopes** and add:
   - `.../auth/drive.appdata` (Allows TabSetu to store data in its own hidden folder)
   - `.../auth/userinfo.email` (Used to show the signed-in account in settings)
6. **Verification:** Since `drive.appdata` is a sensitive scope, you may need to submit for verification before moving to "Production" status. However, it can stay in "Testing" during initial rollout (limited to 100 test users).

### 4. Create OAuth Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials > OAuth client ID**.
3. Select **Web application** (Required for extensions).
4. **Authorized Redirect URIs:**
   Add the following based on your extension's IDs:
   - **Chrome:** `https://<YOUR_CHROME_EXTENSION_ID>.chromiumapp.org/google`
   - **Firefox:** `https://<YOUR_FIREFOX_EXTENSION_ID>.extensions.allizom.org/google`
   - **Safari:** `safari-web-extension://<YOUR_BUNDLE_ID>/oauth-callback.html`
   - **General Fallback:** `https://tabsetu.app/oauth-callback` (If using a custom domain)

### 5. Update the Codebase
Once you have the `Client ID`, update `src/manifest.json`:
```json
"oauth2": {
  "client_id": "PASTE_YOUR_GCP_CLIENT_ID_HERE.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

---

## 🏪 Browser Store Submissions

### 🔵 Chrome Web Store (Chrome, Brave, Vivaldi, Arc)
1. **Prepare ZIP:** Zip the *contents* of `dist-browsers/chrome/`.
2. **Dashboard:** Go to [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
3. **Upload:** Click **+ New Item** and upload your ZIP.
4. **Permissions Justification:**
   - `tabs`: To read current tab data to save sessions.
   - `storage`: To store session data locally.
   - `scripting`: To inject the search overlay.
   - `host_permissions (<all_urls>)`: Required to fetch favicons and inject search.

### 🟢 Microsoft Edge Add-ons
1. **Prepare ZIP:** Zip the *contents* of `dist-browsers/edge/`.
2. **Dashboard:** Go to [Microsoft Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview).
3. **Submit:** Upload ZIP and follow the listing instructions (identical to Chrome).

### 🟠 Firefox Add-ons (AMO)
1. **Prepare ZIP:** Zip the *contents* of `dist-browsers/firefox/`.
2. **Dashboard:** Go to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/).
3. **Submit:** Select **On Your Own** (for self-hosting) or **On this site** (recommended for public listing).
4. **Source Code:** Firefox often requires the full source code (ZIP of the Git repo excluding `node_modules`).

### 🍎 Safari (macOS/iOS)
1. **Prerequisites:** macOS + Xcode + Apple Developer Membership ($99/yr).
2. **Convert:**
   ```bash
   xcrun safari-web-extension-converter dist-browsers/safari/ --project-location ./safari-xcode --app-name TabSetu
   ```
3. **Xcode:** Open the generated project, configure **Signing & Capabilities**, and build.
4. **Archive:** Use Xcode's `Product > Archive` to upload to App Store Connect.

---

## 🔒 Privacy & Safety

TabSetu is **Local-First**. Ensure your store privacy declarations reflect this:
- **No data collection:** We do not collect or transmit user data.
- **Direct Sync:** Google Drive sync happens directly between the user's browser and Google API. No TabSetu servers are involved.
- **Open Source:** Point reviewers to the GitHub repository for transparency if requested.

---

## 📋 Post-Deployment Checklist
- [ ] Install production version from store.
- [ ] Verify Google Drive Sync signs in correctly.
- [ ] Confirm keyboard shortcuts (`Alt+Shift+Y`, etc.) trigger correctly.
- [ ] Check notification reliability for reminders.

**TabSetu** — _Modern, Secure, and Built for Productivity._
