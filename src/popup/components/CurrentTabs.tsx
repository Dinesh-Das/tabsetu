import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Save, SquareCheckBig } from "lucide-react";
import { TabRow } from "@/components/mobile/MobileUI";
import { filterCapturableTabs } from "@/lib/popupTabs";
import { getCurrentTabs } from "@/lib/tabHelpers";
import type { ToastMessage } from "@/types";

interface Props {
  query: string;
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  addToast: (type: ToastMessage["type"], message: string) => void;
  onSaveSelected: (tabIds: number[]) => void;
  onSaveAll: () => void;
  onCollapseCurrent: () => void;
  onTabCountChange?: (count: number) => void;
}

function getDomain(url: string | undefined): string {
  if (!url) {
    return "unknown";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function CurrentTabs({
  query,
  selectedIds,
  setSelectedIds,
  addToast,
  onSaveSelected,
  onSaveAll,
  onCollapseCurrent,
  onTabCountChange,
}: Props) {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);

  useEffect(() => {
    void getCurrentTabs().then(setTabs);
  }, []);

  const visibleTabs = useMemo(() => filterCapturableTabs(tabs, query), [query, tabs]);
  const selectedVisibleCount = visibleTabs.filter(
    (tab) => tab.id && selectedIds.includes(tab.id)
  ).length;

  useEffect(() => {
    onTabCountChange?.(visibleTabs.length);
  }, [onTabCountChange, visibleTabs.length]);

  const toggleSelect = (tabId: number) => {
    setSelectedIds(
      selectedIds.includes(tabId)
        ? selectedIds.filter((id) => id !== tabId)
        : [...selectedIds, tabId]
    );
  };

  const toggleAll = () => {
    const visibleIds = visibleTabs
      .map((tab) => tab.id)
      .filter((id): id is number => typeof id === "number");

    if (visibleIds.length === 0) {
      addToast("info", "There are no capturable tabs in this window.");
      return;
    }

    setSelectedIds(selectedVisibleCount === visibleIds.length ? [] : visibleIds);
  };

  const handleSaveSelected = () => {
    if (selectedVisibleCount === 0) {
      addToast("info", "Select at least one tab first.");
      return;
    }

    onSaveSelected(selectedIds);
  };

  return (
    <div className="popup-select-screen">
      <section className="popup-select-header">
        <div>
          <h1>Select Tabs</h1>
          <p>
            {selectedVisibleCount} selected - {visibleTabs.length} total
          </p>
        </div>
        <button
          className="mobile-secondary-button popup-select-all"
          type="button"
          onClick={toggleAll}
        >
          <SquareCheckBig size={16} />
          {selectedVisibleCount === visibleTabs.length && visibleTabs.length !== 0
            ? "Clear"
            : "Select All"}
        </button>
      </section>

      <section className="popup-tab-list">
        {visibleTabs.length === 0 ? (
          <div className="popup-empty-tabs">
            <h2>{query ? "No tabs match" : "No tabs to save"}</h2>
            <p>Restricted browser pages are skipped automatically.</p>
          </div>
        ) : null}

        {visibleTabs.map((tab) => {
          const tabId = tab.id ?? 0;
          const selected = selectedIds.includes(tabId);

          return (
            <TabRow
              key={tabId}
              title={tab.title || "Untitled Tab"}
              subtitle={getDomain(tab.url)}
              favIconUrl={tab.favIconUrl}
              selected={selected}
              onSelect={() => toggleSelect(tabId)}
            />
          );
        })}
      </section>

      <footer className="popup-action-footer">
        <button className="mobile-link-button" type="button" onClick={onCollapseCurrent}>
          <ChevronDown size={16} />
          Collapse all {visibleTabs.length} tabs
        </button>
        <div className="popup-action-row">
          <button className="mobile-secondary-button" type="button" onClick={onSaveAll}>
            <Save size={16} />
            Quick Save
          </button>
          <button className="mobile-primary-button" type="button" onClick={handleSaveSelected}>
            Select Tabs
          </button>
        </div>
      </footer>
    </div>
  );
}
