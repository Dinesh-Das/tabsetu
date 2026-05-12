import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/shared/index.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import DashboardCrashFallback from "@/components/shared/DashboardCrashFallback";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<DashboardCrashFallback />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
