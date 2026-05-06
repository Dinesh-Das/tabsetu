# 🚀 TabSetu Deployment Guide

Step-by-step guide to publish TabSetu to browser extension stores.

---

## 📦 Pre-Flight Checklist

Before submitting to any store, run the full validation:

```bash
# Type-check
npm run type-check

# Run all tests
npm test

# Production build
npm run build
```

Verify the `dist/` folder contains:
- `manifest.json` (Manifest V3)
- `service-worker-loader.js`
- `src/popup/index.html` — extension popup
- `src/dashboard/index.html` — full-page dashboard (options page)
- `share-page/` — standalone share page
- `icons/` — icon16, icon32, icon48, icon128
- `assets/` — bundled JS/CSS

### Create the Submission ZIP

```bash
cd dist
# Windows (PowerShell)
Compress-Archive -Path * -DestinationPath ../tabsetu-v1.0.0.zip

# macOS / Linux
zip -r ../tabsetu-v1.0.0.zip .
```

> **Important:** ZIP the *contents* of `dist/`, not the `dist/` folder itself. The `manifest.json` must be at the root of the ZIP.

---

## 🔵 Chrome Web Store

Brave, Vivaldi, Opera, and Arc also install from the Chrome Web Store.

1. **Register:** Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   - One-time $5 registration fee.
2. **Upload:** Click **+ New Item** → upload your ZIP.
3. **Listing details:**

   | Field | Value |
   |:---|:---|
   | **Name** | TabSetu |
   | **Summary** | Save, organize, and restore browser sessions. Unlimited tabs, folders, and tags. Free forever. |
   | **Category** | Productivity |
   | **Language** | English |

4. **Permissions justification:**

   | Permission | Justification |
   |:---|:---|
   | `tabs` | Read tab URLs and titles to save sessions |
   | `storage` | Store sessions, folders, tags, and settings locally |
   | `alarms` | Fire scheduled auto-open and reminder alarms |
   | `notifications` | Show reminder notifications |
   | `scripting` | Inject the global search overlay on the active tab |
   | `activeTab` | Access the current tab for search overlay injection |
   | `host_permissions: <all_urls>` | Fetch favicon data URLs and inject search overlay on any page |

5. **Privacy practices:**
   - Single purpose: "Session management — save, organize, and restore browser tabs."
   - Does **not** collect or transmit any user data.
   - Does **not** use remote code.
   - Does **not** use analytics, cookies, or tracking.

6. **Submit for review.** Typical review time: 1–3 business days.

---

## 🟢 Microsoft Edge Add-ons

The same build works on Edge without changes.

1. **Register:** Go to the [Microsoft Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview) (free, Microsoft account required).
2. **Create new extension** → upload the same ZIP.
3. **Listing details:** Same as Chrome (see above).
4. **Review:** Typically 1–3 business days.

---

## 🟠 Firefox Add-ons (AMO)

Firefox supports Manifest V3 but requires a Gecko ID.

1. **Add Gecko ID** — add this to `src/manifest.json` before building:

   ```json
   "browser_specific_settings": {
     "gecko": {
       "id": "tabsetu@dinesh-das.dev",
       "strict_min_version": "109.0"
     }
   }
   ```

2. **Rebuild:** `npm run build`
3. **Submit:** Go to the [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/) → upload your ZIP.
4. **Visibility:** Choose **Listed** to appear in the public directory.
5. **Source code:** AMO may ask for source code for review — upload a ZIP of the full repo (excluding `node_modules/` and `dist/`).

---

## 🖼️ Store Assets

Prepare these assets before submission:

| Asset | Dimensions | Format | Required By |
|:---|:---|:---|:---|
| **Extension icon** | 128×128 | PNG | All stores |
| **Store icon** | 128×128 | PNG | Chrome, Edge |
| **Screenshot** | 1280×800 or 640×400 | PNG/JPEG | All stores |
| **Small tile** | 440×280 | PNG | Chrome |
| **Marquee / promo** | 1400×560 | PNG | Chrome, Edge |

> **Tip:** Take screenshots in both dark and light modes. Show the popup, dashboard, and search overlay.

---

## 🛡️ Privacy Policy

Since TabSetu is fully **local-first** with no network requests, use this privacy policy:

> **TabSetu Privacy Policy**
>
> TabSetu does not collect, store, or transmit any user data to external servers. All session data, notes, tags, folders, schedules, reminders, and settings are stored exclusively on the user's device using the browser's `chrome.storage.local` API.
>
> TabSetu does not use analytics, tracking pixels, cookies, or any form of telemetry. No data is accessible to the developer or any third parties.
>
> TabSetu does not communicate with any remote servers. The share link feature encodes session data directly into a URL fragment — no server-side storage is involved.
>
> **Permissions:** TabSetu requests `tabs`, `storage`, `alarms`, `notifications`, `scripting`, and `activeTab` permissions solely to provide its core session management functionality. The `host_permissions` (`<all_urls>`) permission is used to fetch tab favicons and inject the optional search overlay.
>
> Contact: dinesh@dinesh-das.dev

Host this on a public URL (e.g., a GitHub Gist, your personal site, or a `/privacy` page) and link it in your store listing.

---

## 📋 Post-Submission

After approval:

- [ ] Verify the listing is live and the install flow works
- [ ] Test fresh install on a clean Chrome profile
- [ ] Confirm onboarding flow appears on first launch
- [ ] Test keyboard shortcuts (`Ctrl+Shift+S`, `Ctrl+Shift+C`, `Ctrl+Shift+F`, `Ctrl+Shift+D`)
- [ ] Submit to Edge Add-ons if not done already
- [ ] Update README with store badges/links

---

**TabSetu** — *Modern, Secure, and Ready for the World.*
