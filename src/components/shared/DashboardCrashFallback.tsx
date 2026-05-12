import { TabSetuLogo } from "@/components/shared/TabSetuLogo";

export default function DashboardCrashFallback() {
  return (
    <div className="dashboard-crash-fallback">
      <TabSetuLogo size={42} />
      <h1>TabSetu dashboard needs a reload</h1>
      <p>
        The dashboard could not render this view. Your saved data is still in extension storage.
      </p>
      <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
        Reload dashboard
      </button>
    </div>
  );
}
