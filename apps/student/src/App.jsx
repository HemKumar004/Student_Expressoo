import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PortalProviders, RequireAuth, GuestOnly, PageLoader, NotFoundPage } from "@expressoo/shared";
import { api } from "./lib/api.js";
import PortalLayout from "./layouts/PortalLayout.jsx";

const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Attendance = lazy(() => import("./pages/Attendance.jsx"));
const Fees = lazy(() => import("./pages/Fees.jsx"));
const Materials = lazy(() => import("./pages/Materials.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const Announcements = lazy(() => import("./pages/Announcements.jsx"));
const Representative = lazy(() => import("./pages/Representative.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

export default function App() {
  return (
    <BrowserRouter>
      <PortalProviders api={api} portal="student">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<PortalLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="fees" element={<Fees />} />
                <Route path="materials" element={<Materials />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="representative" element={<Representative />} />
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
