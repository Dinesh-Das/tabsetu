import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/shared/index.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import PopupCrashFallback from "@/components/shared/PopupCrashFallback";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<PopupCrashFallback />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
