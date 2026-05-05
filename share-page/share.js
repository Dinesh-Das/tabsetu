function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function readSnapshot() {
  const encoded = window.location.hash.slice(1);
  if (!encoded) {
    throw new Error("Missing TabSetu share data.");
  }
  const parsed = JSON.parse(fromBase64Url(encoded));
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

try {
  const snapshot = readSnapshot();
  setText("session-name", snapshot.name || "Shared session");
  setText("session-description", snapshot.description || "A local-first TabSetu session shared as an encoded link.");
  setText("tab-count", `${snapshot.tabs.length} ${snapshot.tabs.length === 1 ? "tab" : "tabs"}`);

  const list = document.getElementById("tabs");
  const copyButton = document.getElementById("copy-links");
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
} catch (error) {
  renderError(error instanceof Error ? error.message : "Unknown share error.");
}
