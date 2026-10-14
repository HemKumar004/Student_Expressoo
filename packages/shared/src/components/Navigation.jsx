import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cx } from "../utils/format.js";

export function PageHeader({ title, description, breadcrumbs, actions, children }) {
  return (
    <>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <header className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
          {children}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
    </>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumbs" style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && (
              <li aria-hidden="true">
                <ChevronRight />
              </li>
            )}
            <li>{item.to && i < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** Tab list; the parent renders the active panel. */
export function Tabs({ tabs, value, onChange, label = "Sections", className }) {
  const onKeyDown = (e) => {
    const idx = tabs.findIndex((t) => t.id === value);
    if (e.key === "ArrowRight") onChange(tabs[(idx + 1) % tabs.length].id);
    if (e.key === "ArrowLeft") onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id);
  };
  return (
    <div className={cx("tabs", className)} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className="tab"
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <t.icon aria-hidden="true" style={{ width: 16, height: 16 }} />}
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, size, label, className }) {
  return (
    <div className={cx("segmented", size === "sm" && "segmented-sm", className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
