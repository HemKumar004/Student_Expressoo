import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PortalProviders, RequireAuth, GuestOnly, PageLoader, NotFoundPage } from "@expressoo/shared";
import { api } from "./lib/api.js";
import PortalLayout from "./layouts/PortalLayout.jsx";

const Login = lazy(() => import("./pages/Login.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Students = lazy(() => import("./pages/Students.jsx"));
const Staff = lazy(() => import("./pages/Staff.jsx"));
const Academics = lazy(() => import("./pages/Academics.jsx"));
const Attendance = lazy(() => import("./pages/Attendance.jsx"));
const Fees = lazy(() => import("./pages/Fees.jsx"));
const Materials = lazy(() => import("./pages/Materials.jsx"));
const Announcements = lazy(() => import("./pages/Announcements.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const Alerts = lazy(() => import("./pages/Alerts.jsx"));
const Roles = lazy(() => import("./pages/Roles.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Audit = lazy(() => import("./pages/Audit.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

export default function App() {
  return (
    <BrowserRouter>
      <PortalProviders api={api} portal="admin">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<Login />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<PortalLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="staff" element={<Staff />} />
                <Route path="academics" element={<Academics />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="fees" element={<Fees />} />
                <Route path="materials" element={<Materials />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="roles" element={<Roles />} />
                <Route path="reports" element={<Reports />} />
                <Route path="audit" element={<Audit />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<NotFoundPage inline />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </PortalProviders>
    </BrowserRouter>
  );
}
