import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { cx } from "../utils/format.js";
import { useDismiss } from "../hooks/index.js";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus moves inside on open, Tab is trapped, Escape and the backdrop
 * close it (unless `busy`), and focus returns to the trigger afterwards.
 */
export function Modal({ open, onClose, title, description, icon, size = "md", footer, children, busy = false, className }) {
  const dialogRef = useRef(null);
  const lastFocused = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    lastFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const node = dialogRef.current;
    const focusFirst = () => {
      const auto = node?.querySelector("[autofocus], [data-autofocus]");
      const first = auto || node?.querySelector(`.modal-body ${FOCUSABLE}`) || node?.querySelector(FOCUSABLE);
      (first || node)?.focus();
    };
    const t = setTimeout(focusFirst, 10);

    const onKey = (e) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === "Tab" && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}>
      <div
        ref={dialogRef}
        className={cx("modal", size !== "md" && `modal-${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {(title || icon) && (
          <div className="modal-header">
            {icon}
            <div className="grow">
              {title && (
                <h2 className="modal-title" id={titleId}>
                  {title}
                </h2>
              )}
              {description && (
                <p className="modal-description" id={descId}>
                  {description}
                </p>
              )}
            </div>
            <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} disabled={busy} aria-label="Close dialog">
              <X aria-hidden="true" />
            </button>
          </div>
        )}
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Dropdown menu. `trigger` receives props to spread on the trigger button.
 * Items: { label, icon, onClick, to, danger } | { separator: true } | { header: node }.
 */
export function Menu({ trigger, items, align = "right", dropUp = false, className, label = "Menu" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const onKeyDown = (e) => {
    if (!open) return;
    const items = [...(ref.current?.querySelectorAll('[role="menuitem"]') || [])];
    const idx = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  };

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.querySelector('[role="menuitem"]')?.focus(), 0);
  }, [open]);

  return (
    <div className={cx("menu-anchor", className)} ref={ref} onKeyDown={onKeyDown}>
      {trigger({ onClick: () => setOpen((o) => !o), "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": open ? menuId : undefined })}
      {open && (
        <div className={cx("menu", align === "left" && "align-left", dropUp && "drop-up")} role="menu" id={menuId} aria-label={label}>
          {items.filter(Boolean).map((item, i) => {
            if (item.separator) return <div key={i} className="menu-separator" role="separator" />;
            if (item.header) return <div key={i} className="menu-header">{item.header}</div>;
            const Icon = item.icon;
            const content = (
              <>
                {Icon && <Icon aria-hidden="true" />}
                <span>{item.label}</span>
              </>
            );
            const cls = cx("menu-item", item.danger && "is-danger");
            return item.to ? (
              <Link key={i} to={item.to} className={cls} role="menuitem" onClick={close}>
                {content}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                className={cls}
                role="menuitem"
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
