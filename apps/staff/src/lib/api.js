import { createApiClient } from "@expressoo/shared";

/** One API client for the Staff Portal; talks to the shared Student Expressoo backend. */
export const API_URL = import.meta.env.VITE_API_URL;
export const api = API_URL ? createApiClient({ baseUrl: API_URL, portal: "staff" }) : null;

export const PORTAL_LINKS = [
  { key: "student", label: "Student Portal", href: import.meta.env.VITE_STUDENT_URL },
  { key: "staff", label: "Staff Portal", href: import.meta.env.VITE_STAFF_URL },
  { key: "admin", label: "Admin Console", href: import.meta.env.VITE_ADMIN_URL },
].filter((p) => p.key !== "staff" && p.href);
