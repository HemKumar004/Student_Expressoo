import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Bell, BookOpen, ClipboardCheck, History, LayoutDashboard, Megaphone, Presentation, Siren, UserRound } from "lucide-react";
import { AppShell, PageLoader, useAuth } from "@expressoo/shared";

import { ALERTS_CHANGED } from "../lib/events.js";

export default function PortalLayout() {
  const { user, logout, api } = useAuth();
  const location = useLocation();
  const [openAlerts, setOpenAlerts] = useState(0);

  // Live badge for unanswered teacher alerts.
  useEffect(() => {
    const load = () =>
      api
        .get("/teacher-alerts", { query: { status: "OPEN", pageSize: 1 } })
        .then((r) => setOpenAlerts(r.openCount))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    window.addEventListener(ALERTS_CHANGED, load);
    return () => {
      clearInterval(id);
      window.removeEventListener(ALERTS_CHANGED, load);
    };
  }, [api, location.pathname]);

  const navigation = [
    { section: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    {
      section: "Teaching",
      items: [
        { to: "/classes", label: "My classes", icon: Presentation },
        { to: "/attendance", label: "Mark attendance", icon: ClipboardCheck, end: true },
        { to: "/attendance/history", label: "Attendance history", icon: History },
        { to: "/materials", label: "Study materials", icon: BookOpen },
      ],
    },
    {
      section: "Communication",
      items: [
        { to: "/alerts", label: "Teacher alerts", icon: Siren, badge: openAlerts || null, badgeTone: "danger" },
        { to: "/notifications", label: "Notifications", icon: Bell },
        { to: "/announcements", label: "Announcements", icon: Megaphone },
      ],
    },
    { section: "Account", items: [{ to: "/profile", label: "Profile", icon: UserRound }] },
  ];

  return (
    <AppShell portalName="Staff Portal" navigation={navigation} user={user} onLogout={logout} api={api}>
      <Suspense fallback={<PageLoader inline />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
