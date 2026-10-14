import { Brand } from "./Brand.jsx";
import { cx } from "../utils/format.js";

/**
 * Split-screen authentication layout: brand panel (desktop) + form column.
 * features: [{ icon, title, text }]
 */
export function AuthLayout({ portalName, headline, description, features = [], children, wide }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Brand portalName={portalName} to="/login" />
        <div className="auth-aside-copy">
          <h2 className="auth-aside-title">{headline}</h2>
          {description && <p className="auth-aside-text">{description}</p>}
          {features.length > 0 && (
            <ul className="auth-features">
              {features.map((f) => (
                <li key={f.title}>
                  <span className="feature-icon" aria-hidden="true">
                    <f.icon />
                  </span>
                  <div>
                    <strong>{f.title}</strong>
                    <span>{f.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="auth-aside-foot">© {new Date().getFullYear()} Student Expressoo · Smart College Management</p>
      </aside>
      <main className="auth-main" id="main">
        <div className={cx("auth-card", wide && "wide")}>
          <div className="auth-mobile-brand">
            <Brand portalName={portalName} to="/login" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
