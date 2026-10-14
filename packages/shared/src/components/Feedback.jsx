import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X, RefreshCw, CircleAlert } from "lucide-react";
import { cx } from "../utils/format.js";
import { Button } from "./Button.jsx";
import { Modal } from "./Overlay.jsx";

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
const ToastContext = createContext(null);
const TOAST_ICONS = { success: CircleCheck, error: CircleX, warning: TriangleAlert, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, title, message, { duration = type === "error" ? 7000 : 4500 } = {}) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, title, message }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (title, message, opts) => push("success", title, message, opts),
      error: (title, message, opts) => push("error", title, message, opts),
      warning: (title, message, opts) => push("warning", title, message, opts),
      info: (title, message, opts) => push("info", title, message, opts),
      /** Show an API/unknown error with a sensible title. */
      fromError: (err, title = "Something went wrong") => push("error", title, err?.message || "Please try again."),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.type];
          return (
            <div key={t.id} className={cx("toast", `toast-${t.type}`)} role={t.type === "error" ? "alert" : "status"}>
              <span className="toast-icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="toast-content">
                <p className="toast-title">{t.title}</p>
                {t.message && <p className="toast-message">{t.message}</p>}
              </div>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Promise-based confirmation dialog: `if (await confirm({...})) { ... }`
// ---------------------------------------------------------------------------
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setDialog({ confirmLabel: "Confirm", cancelLabel: "Cancel", tone: "primary", ...options });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  const Icon = dialog?.tone === "danger" ? TriangleAlert : dialog?.tone === "warning" ? CircleAlert : Info;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(dialog)}
        onClose={() => close(false)}
        size="sm"
        icon={<span className={cx("modal-icon", `tone-${dialog?.tone === "danger" ? "danger" : dialog?.tone === "warning" ? "warning" : "primary"}`)}><Icon aria-hidden="true" /></span>}
        title={dialog?.title}
        description={dialog?.message}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {dialog?.cancelLabel}
            </Button>
            <Button variant={dialog?.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {dialog?.confirmLabel}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Static feedback
// ---------------------------------------------------------------------------
const CALLOUT_ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

export function Callout({ tone = "info", title, icon, children, className, action }) {
  const Icon = icon || CALLOUT_ICONS[tone];
  return (
    <div className={cx("callout", `callout-${tone}`, className)} role={tone === "danger" ? "alert" : undefined}>
      <Icon aria-hidden="true" />
      <div className="grow">
        {title && <p className="callout-title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, radius, className, style }) {
  return <span className={cx("skeleton", className)} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 4, height = 44 }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={8} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, description, action, compact, className }) {
  return (
    <div className={cx("empty", compact && "empty-compact", className)}>
      <span className="empty-icon" aria-hidden="true">
        <Icon />
      </span>
      <p className="empty-title">{title}</p>
      {description && <p className="empty-text">{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "We couldn't load this", compact }) {
  return (
    <div className={cx("empty", "is-error", compact && "empty-compact")} role="alert">
      <span className="empty-icon" aria-hidden="true">
        <CircleAlert />
      </span>
      <p className="empty-title">{title}</p>
      <p className="empty-text">{error?.message || "An unexpected error occurred."}</p>
      {onRetry && (
        <div className="empty-action">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
