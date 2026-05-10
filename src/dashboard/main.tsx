import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/shared/index.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
