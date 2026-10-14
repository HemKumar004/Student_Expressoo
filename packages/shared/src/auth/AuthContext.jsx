import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "../layout/StatusPages.jsx";

const AuthContext = createContext(null);

/**
 * Session state for one portal. The role is always taken from the server response;
 * route guards here are for usability only — the API enforces authorisation itself.
 */
export function AuthProvider({ api, portal, children }) {
  const [state, setState] = useState(() => ({ status: api.getToken() ? "loading" : "anonymous", user: null, notice: null }));

  useEffect(() => {
    let cancelled = false;
    if (api.getToken()) {
      api
        .get("/auth/me")
        .then(({ user }) => !cancelled && setState({ status: "authenticated", user, notice: null }))
        // Keep any "session expired" notice set by the 401 handler so the sign-in page can explain it.
        .catch(() => !cancelled && setState((s) => ({ status: "anonymous", user: null, notice: s.notice })));
    }
    const off = api.onSessionExpired((err) => {
      setState({ status: "anonymous", user: null, notice: err?.message || "Your session has ended. Please sign in again." });
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [api]);

  const login = useCallback(
    async (username, password) => {
      const { token, user } = await api.post("/auth/login", { username, password, portal });
      api.setToken(token);
      setState({ status: "authenticated", user, notice: null });
      return user;
    },
    [api, portal]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* session may already be gone — sign out locally regardless */
    }
    api.clearToken();
    setState({ status: "anonymous", user: null, notice: null });
  }, [api]);

  const refreshUser = useCallback(async () => {
    const { user } = await api.get("/auth/me");
    setState((s) => ({ ...s, user }));
    return user;
  }, [api]);

  const setSession = useCallback(
    (token, user) => {
      if (token) api.setToken(token);
      setState({ status: "authenticated", user, notice: null });
    },
    [api]
  );

  const clearNotice = useCallback(() => setState((s) => ({ ...s, notice: null })), []);

  const value = useMemo(
    () => ({ ...state, api, portal, login, logout, refreshUser, setSession, clearNotice }),
    [state, api, portal, login, logout, refreshUser, setSession, clearNotice]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Route element: renders children/outlet for signed-in users, otherwise redirects to /login. */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader label="Restoring your session…" />;
  if (status !== "authenticated") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children ?? <Outlet />;
}

/** Route element for /login and /register: signed-in users go straight to the app. */
export function GuestOnly({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader label="Restoring your session…" />;
  if (status === "authenticated") return <Navigate to={location.state?.from || "/"} replace />;
  return children ?? <Outlet />;
}
