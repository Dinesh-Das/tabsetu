import { scoreOverlayRows, type OverlaySearchRow } from "@/lib/overlaySearch";
import type { Settings } from "@/types";

type OverlayPayload = {
  rows: OverlaySearchRow[];
  searchScopes: Settings["searchScopes"];
  fuzzySearchThreshold: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSearchScopes(value: unknown): value is Settings["searchScopes"] {
  return (
    isRecord(value) &&
    typeof value.sessions === "boolean" &&
    typeof value.tabs === "boolean" &&
    typeof value.notes === "boolean" &&
    typeof value.tags === "boolean" &&
    typeof value.folders === "boolean"
  );
}

function isOverlaySearchRow(value: unknown): value is OverlaySearchRow {
  if (!isRecord(value) || !isRecord(value.action)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.action.kind === "string"
  );
}

function isOverlayPayload(value: unknown): value is OverlayPayload {
  return (
    isRecord(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isOverlaySearchRow) &&
    isSearchScopes(value.searchScopes) &&
    typeof value.fuzzySearchThreshold === "number"
  );
}

function openRow(row: OverlaySearchRow): void {
  if (row.action.kind === "url") {
    void chrome.runtime.sendMessage({ type: "tabsetu:open-url", url: row.action.url });
  } else if (row.action.kind === "switch-tab") {
    void chrome.runtime.sendMessage({ type: "tabsetu:switch-to-tab", tabId: row.action.tabId });
  } else {
    void chrome.runtime.sendMessage({ type: "tabsetu:open-dashboard", view: row.action.view });
  }
}

async function fetchHistoryRows(query: string): Promise<OverlaySearchRow[]> {
  const response: unknown = await chrome.runtime.sendMessage({
    type: "tabsetu:search-history",
    query,
  });
  if (!isRecord(response) || response.ok !== true || !Array.isArray(response.rows)) {
    return [];
  }

  return response.rows.filter(isOverlaySearchRow);
}

function mountTabSetuSearchOverlay(payload: OverlayPayload): void {
  const hostId = "tabsetu-search-overlay-host";
  document.getElementById(hostId)?.remove();

  const host = document.createElement("div");
  host.id = hostId;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: start center; padding: 10vh 18px 18px; background: rgba(8, 13, 24, 0.42); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .panel { width: min(720px, calc(100vw - 36px)); max-height: min(680px, 78vh); overflow: hidden; border: 1px solid rgba(149, 166, 196, 0.34); border-radius: 12px; background: #f9fbff; color: #101828; box-shadow: 0 28px 72px rgba(4, 10, 22, 0.28); }
      .search { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #d9e2f0; }
      input { width: 100%; border: 0; outline: 0; background: transparent; color: #101828; font: 600 16px/1.4 inherit; }
      input::placeholder { color: #667085; }
      .results { max-height: min(560px, 63vh); overflow: auto; padding: 8px; }
      .item { display: grid; grid-template-columns: 1fr auto; gap: 10px; width: 100%; border: 1px solid transparent; border-radius: 8px; padding: 11px 12px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
      .item[aria-selected="true"] { background: #e8f7fb; border-color: #84d8ea; }
      .title { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
      .meta { margin-top: 3px; color: #667085; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
      .kind { align-self: start; border-radius: 999px; padding: 4px 8px; background: #eef2f7; color: #475467; font-size: 11px; font-weight: 700; }
      .empty { padding: 28px 18px; color: #667085; text-align: center; font-size: 13px; }
      @media (prefers-color-scheme: dark) {
        .panel { background: #101828; color: #f8fbff; border-color: rgba(149, 166, 196, 0.28); }
        .search { border-color: #243044; }
        input { color: #f8fbff; }
        input::placeholder, .meta, .empty { color: #98a2b3; }
        .item[aria-selected="true"] { background: rgba(20, 184, 166, 0.14); border-color: rgba(20, 184, 166, 0.4); }
        .kind { background: #1d2939; color: #d0d5dd; }
      }
    </style>
    <div class="backdrop" role="presentation">
      <section class="panel" role="dialog" aria-modal="true" aria-label="TabSetu search">
        <div class="search"><input autocomplete="off" placeholder="Search saved sessions, active tabs, notes, folders, or tags" aria-label="Search TabSetu" /></div>
        <div class="results" role="listbox"></div>
      </section>
    </div>
  `;

  const input = shadow.querySelector("input") as HTMLInputElement;
  const resultsNode = shadow.querySelector(".results") as HTMLDivElement;
  const backdrop = shadow.querySelector(".backdrop") as HTMLDivElement;
  let visibleRows = payload.rows;
  let historyRows: OverlaySearchRow[] = [];
  let selectedIndex = 0;
  let historyRequestId = 0;
  const removeOverlay = () => host.remove();

  const render = () => {
    resultsNode.textContent = "";
    if (visibleRows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = input.value.trim()
        ? "No tabs, sessions, or history match that search."
        : "Start typing to search TabSetu.";
      resultsNode.appendChild(empty);
      return;
    }

    visibleRows.slice(0, 12).forEach((row, index) => {
      const item = document.createElement("button");
      item.className = "item";
      item.type = "button";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === selectedIndex));
      item.innerHTML = `<span><span class="title"></span><span class="meta"></span></span><span class="kind"></span>`;
      (item.querySelector(".title") as HTMLSpanElement).textContent = row.title;
      (item.querySelector(".meta") as HTMLSpanElement).textContent = row.subtitle;
      (item.querySelector(".kind") as HTMLSpanElement).textContent =
        row.kind === "session"
          ? "Session"
          : row.kind === "active-tab"
            ? "Active"
            : row.kind === "history"
              ? "History"
              : row.kind === "tab"
                ? "Tab"
                : "Note";
      item.addEventListener("mouseenter", () => {
        selectedIndex = index;
        render();
      });
      item.addEventListener("click", () => {
        openRow(row);
        removeOverlay();
      });
      resultsNode.appendChild(item);
    });
  };

  const updateVisibleRows = () => {
    const allRows = [...payload.rows, ...historyRows];
    visibleRows = scoreOverlayRows(allRows, input.value, {
      searchScopes: payload.searchScopes,
      fuzzySearchThreshold: payload.fuzzySearchThreshold,
    });
    selectedIndex = Math.min(selectedIndex, Math.max(visibleRows.length - 1, 0));
    render();
  };

  const updateHistoryRows = () => {
    const query = input.value.trim();
    const requestId = historyRequestId + 1;
    historyRequestId = requestId;

    if (query.length < 3) {
      historyRows = [];
      updateVisibleRows();
      return;
    }

    void fetchHistoryRows(query).then((rows) => {
      if (historyRequestId !== requestId) {
        return;
      }

      historyRows = rows;
      updateVisibleRows();
    });
  };

  input.addEventListener("input", () => {
    updateVisibleRows();
    updateHistoryRows();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      removeOverlay();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, Math.max(visibleRows.length - 1, 0));
      render();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      render();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = visibleRows[selectedIndex];
      if (row) {
        openRow(row);
        removeOverlay();
      }
    }
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      removeOverlay();
    }
  });
  render();
  input.focus();
}

function showTabSetuOverlayDisabledToast(message: string): void {
  const hostId = "tabsetu-toast-host";
  document.getElementById(hostId)?.remove();
  const host = document.createElement("div");
  host.id = hostId;
  host.style.cssText =
    "position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:min(360px,calc(100vw - 36px));padding:12px 14px;border:1px solid rgba(132,216,234,.5);border-radius:12px;background:#101828;color:#f8fbff;font:600 13px/1.4 ui-sans-serif,system-ui,sans-serif;box-shadow:0 18px 48px rgba(4,10,22,.28)";
  host.textContent = message;
  document.documentElement.appendChild(host);
  window.setTimeout(() => host.remove(), 2200);
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isRecord(message)) {
    return;
  }

  if (message.type === "tabsetu:open-overlay" && isOverlayPayload(message.payload)) {
    mountTabSetuSearchOverlay(message.payload);
  }
  if (message.type === "tabsetu:overlay-disabled") {
    showTabSetuOverlayDisabledToast(
      typeof message.message === "string" ? message.message : "TabSetu search overlay is disabled."
    );
  }
});
