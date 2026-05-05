# 🚀 TabSetu Deployment Guide

Follow these steps to publish TabSetu to the Chrome Web Store, Microsoft Edge Add-ons, and Firefox Add-ons.

---

## 📦 1. Production Build

Before submitting, generate the optimized production bundle:

```bash
npm run build
```

This creates a `dist` folder. **This folder contains the files you will upload to the stores.**

---

## 🔵 Chrome Web Store & Brave

Brave uses the Chrome Web Store.

1.  **Dashboard:** Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2.  **Fee:** Pay the one-time $5 developer registration fee.
3.  **Upload:**
    *   Create a ZIP of the contents of the `dist` folder.
    *   Click **+ New Item** and upload your ZIP.
4.  **Listing Details:**
    *   **Category:** Productivity.
    *   **Privacy:** State that the extension is **local-first** and requires `tabs` and `storage` permissions to save sessions locally.
5.  **Submit:** Click **Submit for Review**.

---

## 🟢 Microsoft Edge Add-ons

Edge is Chromium-based and compatible with the same build.

1.  **Partner Center:** Go to the [Microsoft Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview).
2.  **Registration:** Sign in with a Microsoft account (free).
3.  **Submission:**
    *   Click **Create new submission**.
    *   Upload the same ZIP file used for Chrome.
4.  **Review:** Microsoft typically reviews within 1–3 business days.

---

## 🟠 Firefox Add-ons (AMO)

Firefox supports Manifest V3, but requires a small addition for unique identification.

1.  **Gecko ID:** Open `src/manifest.json` and ensure it contains:
    ```json
    "browser_specific_settings": {
      "gecko": {
        "id": "tabsetu@yourdomain.com",
        "strict_min_version": "109.0"
      }
    }
    ```
2.  **Submit:** Visit the [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/).
3.  **Package:** Upload the ZIP of your `dist` folder.
4.  **Status:** Choose **On this site** to be listed in the public directory.

---

## 🖼️ Store Asset Requirements

| Asset | Size | Store |
| :--- | :--- | :--- |
| **Icon** | 128x128 PNG | All |
| **Screenshot** | 1280x800 or 640x400 | All |
| **Small Tile** | 440x280 | Chrome |
| **Marquee** | 1400x560 | Chrome/Edge |

---

## 🛡️ Privacy Policy Template

Since TabSetu is **local-first**, your privacy policy is simple:
> "TabSetu does not collect, store, or transmit any user data. All session data, notes, and settings are stored locally on the user's device via `chrome.storage.local` and are never accessible to the developer or any third parties."

---

**TabSetu** — *Modern, Secure, and Ready for the World.*
