import { Link } from "react-router-dom";
import { cx, initials } from "../utils/format.js";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ title, subtitle, actions, children, footer, className, bodyClassName, flush, bordered, refreshing, as: Tag = "section", ...rest }) {
  const hasHeader = title || actions;
  return (
    <Tag className={cx("card", refreshing && "is-refreshing", className)} {...rest}>
      {hasHeader && (
        <div className={cx("card-header", bordered && "bordered")}>
          <div className="grow">
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={cx("card-body", flush && "flush", hasHeader && !bordered && !flush && "tight", bodyClassName)}>{children}</div>}
      {footer && <div className="card-footer">{footer}</div>}
    </Tag>
  );
}

/** Metric tile: label, value, optional context line and icon. */
export function StatCard({ label, value, sub, icon: Icon, tone = "primary", to, loading, footer }) {
  const body = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className={cx("stat-icon", tone !== "primary" && `tone-${tone}`)} aria-hidden="true">
            <Icon />
          </span>
        )}
      </div>
      {loading ? <span className="skeleton" style={{ height: 32, width: "55%" }} /> : <div className="stat-value">{value}</div>}
      {sub && <div className="stat-sub">{loading ? <span className="skeleton" style={{ height: 14, width: "70%" }} /> : sub}</div>}
      {footer}
    </>
  );
  return to ? (
    <Link to={to} className="stat">
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export function Badge({ tone = "neutral", dot, icon: Icon, size, children, className, ...rest }) {
  return (
    <span className={cx("badge", tone !== "neutral" && `badge-${tone}`, dot && "badge-dot", size === "lg" && "badge-lg", className)} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_MAP = {
  ACTIVE: ["success", "Active"],
  PENDING: ["warning", "Pending approval"],
  INACTIVE: ["neutral", "Inactive"],
  PAID: ["success", "Paid"],
  PARTIAL: ["warning", "Partially paid"],
  UNPAID: ["danger", "Unpaid"],
  WAIVED: ["info", "Waived"],
  RECORDED: ["success", "Recorded"],
  VOIDED: ["neutral", "Voided"],
  OPEN: ["danger", "Open"],
  ACKNOWLEDGED: ["warning", "Acknowledged"],
  RESOLVED: ["success", "Resolved"],
  PRESENT: ["success", "Present"],
  ABSENT: ["danger", "Absent"],
  LATE: ["warning", "Late"],
  good: ["success", "On track"],
  warning: ["warning", "At risk"],
  critical: ["danger", "Below threshold"],
  none: ["neutral", "No classes yet"],
  CR: ["primary", "CR"],
  LR: ["primary", "LR"],
  OVERDUE: ["danger", "Overdue"],
};

/** Consistent label + colour for every status value used in the system. */
export function StatusBadge({ status, label, dot = true, ...rest }) {
  const [tone, text] = STATUS_MAP[status] || ["neutral", status];
  return (
    <Badge tone={tone} dot={dot} {...rest}>
      {label || text}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Avatar (initials with a stable, subtle tint per person)
// ---------------------------------------------------------------------------
const TINTS = [
  ["#dbe9fb", "#184f95"],
  ["#d1f2e4", "#0b6b45"],
  ["#fde7d4", "#9a3f07"],
  ["#ece4fb", "#4a2d93"],
  ["#fbe1ea", "#99244f"],
  ["#dff3f6", "#155e6b"],
  ["#f2ecd9", "#6b5410"],
];

export function Avatar({ name = "", size = "md", className }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [bg, fg] = TINTS[hash % TINTS.length];
  return (
    <span className={cx("avatar", size !== "md" && `avatar-${size}`, className)} style={{ "--av-bg": bg, "--av-fg": fg }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Name + secondary line with avatar — the standard "person" cell. */
export function PersonCell({ name, sub, size = "sm" }) {
  return (
    <div className="cell-person">
      <Avatar name={name} size={size} />
      <div className="cell-stack">
        <span className="cell-primary truncate">{name}</span>
        {sub && <span className="sub truncate">{sub}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Description list & key-values
// ---------------------------------------------------------------------------
export function DescriptionList({ items, columns = 2 }) {
  return (
    <dl className="dl" style={{ "--dl-cols": columns }}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KeyValue({ label, value }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value}</span>
    </div>
  );
}

export function FileType({ extension }) {
  const ext = (extension || "file").toLowerCase();
  return (
    <span className={cx("file-type", `type-${ext}`)} aria-hidden="true">
      {ext.slice(0, 4)}
    </span>
  );
}
