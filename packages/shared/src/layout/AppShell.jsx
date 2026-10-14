import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronsUpDown, ChevronDown, LogOut, Menu as MenuIcon, UserRound, CheckCheck, X } from "lucide-react";
import { Brand } from "./Brand.jsx";
import { ErrorBoundary } from "./StatusPages.jsx";
import { Avatar } from "../components/Display.jsx";
import { Menu } from "../components/Overlay.jsx";
import { cx, formatRelative, ROLE_LABELS, REP_LABELS } from "../utils/format.js";
import { useDismiss } from "../hooks/index.js";
import { CategoryIcon } from "../features/notificationMeta.jsx";

import { NOTIFICATIONS_CHANGED, notifyNotificationsChanged } from "../utils/events.js";

function roleLine(user) {
  if (!user) return "";
  if (user.student) return user.student.representativeRole !== "NONE" ? REP_LABELS[user.student.representativeRole] : `Student · ${user.student.rollNumber}`;
  if (user.staff) return user.staff.designation || `Staff · ${user.staff.employeeId}`;
  return ROLE_LABELS[user.role];
}

/** Topbar bell: live unread count from the API plus a quick-look panel. */
function NotificationBell({ api, notificationsPath }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const refreshCount = useCallback(() => {
    api
      .get("/notifications/unread-count")
      .then((r) => setCount(r.unreadCount))
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 60_000);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    api
      .get("/notifications", { query: { pageSize: 6 } })
      .then((r) => {
        setItems(r.items);
        setCount(r.unreadCount);
      })
      .catch(() => setItems([]));
  }, [open, api]);

  const openItem = async (item) => {
    setOpen(false);
    if (!item.readAt) {
      try {
        const r = await api.patch(`/notifications/${item.id}/read`);
        setCount(r.unreadCount);
        notifyNotificationsChanged();
      } catch {
        /* still navigate */
      }
    }
    navigate(notificationsPath);
  };

  const markAll = async () => {
    try {
      await api.post("/notifications/read-all");
      setCount(0);
      setItems((list) => list?.map((i) => ({ ...i, readAt: i.readAt || new Date().toISOString() })));
      notifyNotificationsChanged();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className="icon-btn bell-btn"
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden="true" />
        {count > 0 && <span className="bell-count">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="menu notif-panel" role="dialog" aria-label="Recent notifications">
          <div className="notif-panel-head">
            <span className="semibold">Notifications</span>
            {count > 0 ? (
              <button type="button" className="btn btn-link btn-sm" onClick={markAll}>
                <CheckCheck aria-hidden="true" style={{ width: 14, height: 14 }} />
                <span>Mark all read</span>
              </button>
            ) : (
              <button type="button" className="icon-btn icon-btn-sm" onClick={close} aria-label="Close">
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="notif-panel-list">
            {items === null && (
              <div className="stack-sm" style={{ padding: 16 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="skeleton" style={{ height: 44 }} />
                ))}
              </div>
            )}
            {items?.length === 0 && <p className="muted text-sm" style={{ padding: "28px 16px", textAlign: "center" }}>You're all caught up.</p>}
            {items?.map((item) => (
              <button key={item.id} type="button" className={cx("notif-panel-item", !item.readAt && "is-unread")} onClick={() => openItem(item)}>
                <CategoryIcon category={item.category} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="list-title truncate" style={{ display: "block" }}>
                    {item.title}
                  </span>
                  <span className="list-meta" style={{ display: "block" }}>
                    {item.sender?.fullName} · {formatRelative(item.createdAt)}
                  </span>
                </span>
                {!item.readAt && <span className="unread-dot" aria-label="Unread" />}
              </button>
            ))}
          </div>
          <NavLinkFoot to={notificationsPath} onClick={close} />
        </div>
      )}
    </div>
  );
}

function NavLinkFoot({ to, onClick }) {
  return (
    <NavLink to={to} className="notif-panel-foot" onClick={onClick}>
      View all notifications
    </NavLink>
  );
}

/**
 * Application shell: navy sidebar (drawer below 1024px), sticky topbar with notifications
 * and account menu, and the routed page content.
 * navigation: [{ section, items: [{ to, label, icon, end?, badge? }] }]
 */
export function AppShell({ portalName, navigation, user, onLogout, api, profilePath = "/profile", notificationsPath = "/notifications", children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const allItems = navigation.flatMap((s) => s.items);
  const current = allItems
    .filter((i) => (i.end ? location.pathname === i.to : location.pathname === i.to || location.pathname.startsWith(i.to === "/" ? "/__none__" : `${i.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];

  const accountItems = [
    { header: (
      <div>
        <p className="semibold" style={{ color: "var(--text-primary)" }}>{user?.fullName}</p>
        <p className="text-sm muted truncate">{user?.email}</p>
      </div>
    ) },
    { label: "Profile & settings", icon: UserRound, onClick: () => navigate(profilePath) },
    { separator: true },
    { label: "Sign out", icon: LogOut, danger: true, onClick: onLogout },
  ];

  return (
    <div className={cx("app-shell", drawerOpen && "drawer-open")}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar" aria-label="Main navigation">
        <Brand portalName={portalName} />
        <nav className="sidebar-nav">
          {navigation.map((section) => (
            <div className="nav-section" key={section.section}>
              <p className="nav-section-label">{section.section}</p>
              <ul className="nav-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} className={({ isActive }) => cx("nav-link", isActive && "active")}>
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.badge ? <span className={cx("nav-badge", item.badgeTone && `tone-${item.badgeTone}`)}>{item.badge}</span> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Menu
            dropUp
            align="left"
            label="Account"
            items={accountItems.slice(1)}
            trigger={(props) => (
              <button type="button" className="sidebar-user" {...props}>
                <Avatar name={user?.fullName} size="sm" />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="sidebar-user-name truncate" style={{ display: "block" }}>
                    {user?.fullName}
                  </span>
                  <span className="sidebar-user-role truncate" style={{ display: "block" }}>
                    {roleLine(user)}
                  </span>
                </span>
                <ChevronsUpDown aria-hidden="true" />
              </button>
            )}
          />
        </div>
      </aside>
      <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <div className="app-main">
        <header className="app-topbar">
          <button type="button" className="icon-btn topbar-menu" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-expanded={drawerOpen}>
            <MenuIcon aria-hidden="true" />
          </button>
          <p className="topbar-title truncate">
            <span className="hide-mobile">{portalName} / </span>
            <strong>{current?.label || "Student Expressoo"}</strong>
          </p>
          <div className="topbar-actions">
            <NotificationBell api={api} notificationsPath={notificationsPath} />
            <Menu
              label="Account"
              items={accountItems}
              trigger={(props) => (
                <button type="button" className="topbar-user" aria-label="Account menu" {...props}>
                  <Avatar name={user?.fullName} size="sm" />
                  <span className="name">{user?.fullName?.split(" ").slice(0, 2).join(" ")}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
              )}
            />
          </div>
        </header>
        <main id="main" className="app-content" tabIndex={-1}>
          <ErrorBoundary key={location.pathname} inline>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
