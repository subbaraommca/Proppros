import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/** Catches render errors so a bug shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isChunk = /Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(this.state.error.message);
    return (
      <div className="center-pad" role="alert">
        <div className="card card-body empty" style={{ maxWidth: 460 }}>
          <AlertTriangle size={36} />
          <h3>{isChunk ? "A new version of Proppros is available" : "Something went wrong on this page"}</h3>
          <p>{isChunk ? "Reload to get the latest version." : "Your data is safe. Reload the page, or go back to the dashboard."}</p>
          <div className="actions" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn" href="/">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
