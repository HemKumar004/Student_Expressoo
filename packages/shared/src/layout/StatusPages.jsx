import { Component } from "react";
import { ArrowLeft, House, RefreshCw } from "lucide-react";
import { Button } from "../components/Button.jsx";
import { BrandMark } from "./Brand.jsx";
import { cx } from "../utils/format.js";

export function PageLoader({ label = "Loading…", inline }) {
  return (
    <div className={cx("page-loader", inline && "inline")} role="status" aria-live="polite">
      <div className="page-loader-inner">
        <BrandMark />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function NotFoundPage({ inline, homeTo = "/" }) {
  return (
    <div className={cx("status-page", inline && "inline")}>
      <div className="status-card">
        <p className="status-code">404 · Page not found</p>
        <h1 className="status-title">We can't find that page</h1>
        <p className="status-text">The link may be broken, or the page may have moved. Check the address or head back to your dashboard.</p>
        <div className="status-actions">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => window.history.back()}>
            Go back
          </Button>
          <Button to={homeTo} icon={House}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UnauthorizedPage({ inline, message, homeTo = "/" }) {
  return (
    <div className={cx("status-page", inline && "inline")}>
      <div className="status-card">
        <p className="status-code">403 · Access restricted</p>
        <h1 className="status-title">You don't have access to this page</h1>
        <p className="status-text">{message || "This area is only available to certain roles. If you think this is a mistake, contact your administrator."}</p>
        <div className="status-actions">
          <Button to={homeTo} icon={House}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Catches render errors so one broken widget never blanks the whole portal. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={cx("status-page", this.props.inline && "inline")}>
        <div className="status-card">
          <p className="status-code">Unexpected error</p>
          <h1 className="status-title">Something went wrong</h1>
          <p className="status-text">This part of the page failed to load. Reloading usually fixes it.</p>
          <div className="status-actions">
            <Button icon={RefreshCw} onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
