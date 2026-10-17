import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import i18n from "../i18n";

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
    const t = i18n.t.bind(i18n);
    return (
      <div className="center-pad" role="alert">
        <div className="card card-body empty" style={{ maxWidth: 460 }}>
          <AlertTriangle size={36} />
          <h3>{isChunk ? t("errors.update_title") : t("errors.page_title")}</h3>
          <p>{isChunk ? t("errors.update_body") : t("errors.page_body")}</p>
          <div className="actions" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              {t("errors.reload")}
            </button>
            <a className="btn" href="/">
              {t("common.go_home")}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
