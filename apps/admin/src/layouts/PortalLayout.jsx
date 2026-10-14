import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  ChartColumn,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell, PageLoader, useAuth } from "@expressoo/shared";
import { ReferenceProvider } from "../lib/reference.jsx";

export default function PortalLayout() {
  const { user, logout, api } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(0);

  // Live badge for staff registrations awaiting approval.
  useEffect(() => {
    api
      .get("/staff", { query: { status: "PENDING", pageSize: 1 } })
      .then((r) => setPending(r.pagination.total))
      .catch(() => {});
  }, [api, location.pathname]);

  const navigation = [
    { section: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    {
      section: "People",
      items: [
        { to: "/students", label: "Students", icon: GraduationCap },
        { to: "/staff", label: "Staff", icon: Users, badge: pending || null, badgeTone: "danger" },
        { to: "/roles", label: "Roles & access", icon: ShieldCheck },
      ],
    },
    {
      section: "Academics",
      items: [
        { to: "/academics", label: "Academic structure", icon: Building2 },
        { to: "/attendance", label: "Attendance", icon: CalendarCheck },
        { to: "/materials", label: "Study materials", icon: BookOpen },
      ],
    },
    { section: "Finance", items: [{ to: "/fees", label: "Fees & payments", icon: Wallet }] },
    {
      section: "Communication",
      items: [
        { to: "/announcements", label: "Announcements", icon: Megaphone },
        { to: "/notifications", label: "Notifications", icon: Bell },
        { to: "/alerts", label: "Teacher alerts", icon: Siren },
      ],
    },
    {
      section: "Oversight",
      items: [
        { to: "/reports", label: "Reports", icon: ChartColumn },
        { to: "/audit", label: "Audit log", icon: ScrollText },
      ],
    },
    { section: "Account", items: [{ to: "/profile", label: "Profile", icon: UserRound }] },
  ];

  return (
    <ReferenceProvider>
      <AppShell portalName="Admin Console" navigation={navigation} user={user} onLogout={logout} api={api}>
        <Suspense fallback={<PageLoader inline />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </ReferenceProvider>
  );
}
