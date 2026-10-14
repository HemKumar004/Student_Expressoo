import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PortalProviders, RequireAuth, GuestOnly, PageLoader, NotFoundPage } from "@expressoo/shared";
import { api } from "./lib/api.js";
import PortalLayout from "./layouts/PortalLayout.jsx";

const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Classes = lazy(() => import("./pages/Classes.jsx"));
const ClassDetail = lazy(() => import("./pages/ClassDetail.jsx"));
const MarkAttendance = lazy(() => import("./pages/MarkAttendance.jsx"));
const AttendanceHistory = lazy(() => import("./pages/AttendanceHistory.jsx"));
const Materials = lazy(() => import("./pages/Materials.jsx"));
const Alerts = lazy(() => import("./pages/Alerts.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const Announcements = lazy(() => import("./pages/Announcements.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

export default function App() {
  return (
    <BrowserRouter>
      <PortalProviders api={api} portal="staff">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<PortalLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="classes" element={<Classes />} />
                <Route path="classes/:assignmentId" element={<ClassDetail />} />
                <Route path="attendance" element={<MarkAttendance />} />
                <Route path="attendance/history" element={<AttendanceHistory />} />
                <Route path="materials" element={<Materials />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="announcements" element={<Announcements />} />
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
