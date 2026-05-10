import { TabSetuLogo } from "@/components/shared/TabSetuLogo";

export default function PopupCrashFallback() {
  return (
    <div className="popup-crash-fallback">
      <TabSetuLogo size={34} />
      <h1>TabSetu needs a moment</h1>
      <p>
        The popup could not render this view. The dashboard may still be able to recover your data.
      </p>
      <a
        className="btn btn-primary"
        href={chrome.runtime.getURL("dashboard.html")}
        target="_blank"
        rel="noreferrer"
      >
        Open Dashboard
      </a>
    </div>
  );
}
