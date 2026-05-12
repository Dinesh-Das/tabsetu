if (typeof window.LZString === "undefined") {
  document.getElementById("session-name").textContent = "Could not open share link";
  document.getElementById("session-description").textContent =
    "LZString failed to load — try disabling your ad blocker or opening in incognito.";
  throw new Error("LZString not loaded");
}

function readSnapshot() {
  const encoded = window.location.hash.slice(1);
  if (!encoded) {
    throw new Error("Missing TabSetu share data.");
  }
  const decompressed = window.LZString?.decompressFromEncodedURIComponent(encoded);
  if (!decompressed) {
    throw new Error("Invalid TabSetu share data.");
  }
  const parsed = JSON.parse(decompressed);
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.tabs)) {
    throw new Error("Invalid TabSetu share data.");
  }
  return parsed;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function renderError(message) {
  setText("session-name", "This share link could not be opened");
  setText("session-description", message);
  setText("tab-count", "No tabs");
}

function openSnapshotTabs(snapshot) {
  snapshot.tabs.forEach((tab, index) => {
    window.open(tab.url, index === 0 ? "_blank" : `tabsetu-share-${index}`, "noopener,noreferrer");
  });
}

async function importSnapshotIntoTabSetu(snapshot) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return false;
  }

  const response = await chrome.runtime.sendMessage({
    type: "IMPORT_SHARED_SESSION",
    snapshot,
  });

  if (!response?.ok) {
    return false;
  }

  if (chrome.runtime.getURL) {
    window.open(chrome.runtime.getURL("src/dashboard/index.html?view=home"), "_blank", "noopener,noreferrer");
  }

  return true;
}

try {
  const snapshot = readSnapshot();
  setText("session-name", snapshot.name || "Shared session");
  setText("session-description", snapshot.description || "A local-first TabSetu session shared as an encoded link.");
  setText("tab-count", `${snapshot.tabs.length} ${snapshot.tabs.length === 1 ? "tab" : "tabs"}`);

  const list = document.getElementById("tabs");
  const copyButton = document.getElementById("copy-links");
  const openAllButton = document.getElementById("open-all");
  if (list) {
    snapshot.tabs.forEach((tab) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const url = document.createElement("small");
      link.href = tab.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = tab.title || tab.url;
      url.textContent = tab.url;
      item.append(link, url);
      list.appendChild(item);
    });
  }

  copyButton?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(snapshot.tabs.map((tab) => tab.url).join("\n"));
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy links";
    }, 1400);
  });

  openAllButton?.addEventListener("click", async () => {
    try {
      const imported = await importSnapshotIntoTabSetu(snapshot);
      if (imported) {
        openAllButton.textContent = "Imported into TabSetu";
        return;
      }
    } catch {
      // Fall through to plain browser tabs when extension messaging is unavailable.
    }

    openSnapshotTabs(snapshot);
  });
} catch (error) {
  renderError(error instanceof Error ? error.message : "Unknown share error.");
}
