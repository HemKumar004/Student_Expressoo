import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Bell, BookOpen, CalendarCheck, LayoutDashboard, Megaphone, Siren, UserRound, Wallet } from "lucide-react";
import { AppShell, PageLoader, useAuth } from "@expressoo/shared";

export default function PortalLayout() {
  const { user, logout, api } = useAuth();
  const isRep = user.student?.representativeRole && user.student.representativeRole !== "NONE";

  const navigation = [
    { section: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    {
      section: "Academics",
      items: [
        { to: "/attendance", label: "Attendance", icon: CalendarCheck },
        { to: "/materials", label: "Study materials", icon: BookOpen },
        { to: "/fees", label: "Fees & payments", icon: Wallet },
      ],
    },
    {
      section: "Communication",
      items: [
        { to: "/notifications", label: "Notifications", icon: Bell },
        { to: "/announcements", label: "Announcements", icon: Megaphone },
        ...(isRep ? [{ to: "/representative", label: `${user.student.representativeRole} desk`, icon: Siren }] : []),
      ],
    },
    { section: "Account", items: [{ to: "/profile", label: "Profile", icon: UserRound }] },
  ];

  return (
    <AppShell portalName="Student Portal" navigation={navigation} user={user} onLogout={logout} api={api}>
      <Suspense fallback={<PageLoader inline />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
