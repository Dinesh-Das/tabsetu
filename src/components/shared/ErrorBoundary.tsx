import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TabSetu] Render error:", error, info);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 16, fontSize: 13 }}>
            <p style={{ fontWeight: 500, marginBottom: 8 }}>Something went wrong</p>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: 12 }}>
              {this.state.error?.message}
            </p>
            <button type="button" onClick={this.reset}>
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
