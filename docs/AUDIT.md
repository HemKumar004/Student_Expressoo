# Original project audit (Phase 1) and feature mapping

Audit date: 2026-10-13. The original code is preserved unchanged in `../_backup/StudentExpressoo-original-mongodb-2026-10-13.tar.gz`.

## What the original project contained

* `client/`: one React 19 + Vite 8 app (plain CSS, react-router-dom 7). Only **11 routes** were registered in `App.jsx`. Six more page files existed but were never routed (`AdminDashboard`, `DownloadMaterial`, `Profile`, `TeacherAlert`, `UploadMaterial`, plus a duplicate `components/Landing`). `components/Login.jsx` and `components/Signup.jsx` were empty files.
* `server/`: Express 5 with Mongoose 9, connected to a **hard-coded** `mongodb://127.0.0.1:27017/studentexpressoo`, on a hard-coded port 5000. `models/Attendance.js`, `Fees.js` and `Notification.js` were empty.
* `/api/materials` and `/api/notifications` were mounted **before** `express.json()`, so their request bodies were never parsed.
* Every URL in the client was hard-coded as `http://localhost:5000`. There was no `.env` usage (the root `.env` was empty).

## Feature inventory and classification

| # | Feature (original) | Status found | Notes | New implementation |
|---|---|---|---|---|
| 1 | Landing page | Working (static) | — | Replaced by each portal's branded sign-in screen |
| 2 | Sign-up with role picker (Student/Teacher/CR/LR/Admin) | Broken + **insecure** | Anyone could register as Admin. Role, course and section were free text. Passwords stored **in plaintext** | Student self-registration (section picked from real data, role forced to STUDENT). Staff registration lands as PENDING for approval. Admins via admin/CLI only |
| 3 | Login | Insecure | Plaintext password match. No session or token: only `localStorage.username` was kept. Teacher/Admin routing had no backend support | `POST /auth/login` with bcrypt and JWT. Each portal accepts only its own role |
| 4 | Student dashboard | Mock / disconnected | Showed **everyone's** first attendance record and the total count of all fees and notifications | Personal dashboard: own attendance, fees, notices, materials |
| 5 | Student profile | Working but insecure | `GET /profile/:username` was unauthenticated, so any profile could be read. The page rendered the profile twice | Profile page (own data) plus contact edit and password change |
| 6 | Attendance entry (`/attendance` page) | Disconnected | In-memory array (lost on restart). Anyone could post any roll number. Only total/attended counts, no per-class data | Session-based marking by assigned staff, corrections within a window, admin corrections, audit trail |
| 7 | Student attendance view | Broken | Listed every student's records | Own subject-wise percentages, "classes needed / can miss", history with filters |
| 8 | Fees (`/fees` page) | Mock | The form showed a success alert without calling the API. "Student view" used hard-coded numbers. `/api/fees` stored any JSON in memory | Fee structures, bulk billing, concessions, transactional payments with receipts, voids, student fee page |
| 9 | Study materials list (`/materials`) | Mock | Three hard-coded rows; Download buttons did nothing | Real library with search and subject filter; authorised downloads |
| 10 | Material upload | Broken | `UploadMaterial` page not routed and only showed an alert. The API stored a file-name string; the body was not parsed (route mounted before `express.json`). Multer config was unused | Multipart upload with validation, progress, magic-byte checks, edit/delete, student notification |
| 11 | Notifications (send) | Mock | Form showed an alert only. The API stored in memory without body parsing | Targeted notifications (sections/course/role/all) with per-user read state and read rates |
| 12 | Teacher dashboard | Mock | Every input inert; hard-coded profile; logout did nothing | Staff Portal: dashboard, classes, marking, history, materials, alerts, notices, profile |
| 13 | CR dashboard (teacher alert + emergency call) | Mock | "Send Alert" and "Emergency Call" only showed `alert()` popups. The backend alert route was never called | **CR/LR desk**: real alerts to the assigned teacher, a staff notification, acknowledgement with reply, escalation prompt after N minutes, `tel:` call buttons, class messaging |
| 14 | LR dashboard (alert + student message) | Mock | Same as CR; "message students" was an alert only | Same CR/LR desk, available to LR |
| 15 | Teacher alert page with 2-minute "calling teacher" timer | Not routed | `setTimeout` alert only | Escalation is preserved: after `ALERT_ESCALATION_MINUTES` (default **2**) an unanswered alert prompts the representative to call |
| 16 | Admin dashboard | Not routed / mock | No backend; every form inert | Full Admin Console (people, academics, attendance, fees, materials, communication, alerts, roles, reports, audit) |
| 17 | `Teacher` model | Unused | No route used it | `staff` table + profiles |
| 18 | Logout | Partial | Student only (removed the username) | Shared account menu; server audit entry; tokens revoked on password change or deactivation |

**Summary of the 18 items:** 2 working (one of them insecure), 7 mock UIs (alerts or hard-coded data, no API), 4 broken or disconnected, 2 not routed (one also mock), 1 unused model, 1 partial (logout), and login was insecure. Sign-up, login and profile all had security defects. Every user-facing feature from the original concept is preserved and now backed by MySQL, including the Class Representative and Ladies Representative workflows.

## Security issues found in the original (all resolved)
1. Plaintext password storage and comparison.
2. Public self-registration as Admin or Teacher; the role came from the client.
3. No authentication on any API route; every record was readable and writable by anyone.
4. Profile enumeration via `/api/students/profile/:username`.
5. Unparsed or unvalidated request bodies, and arbitrary JSON stored by `/api/fees/save`.
6. Upload configuration kept original file names (`Date.now()-originalname`) and checked only the extension (it was unused anyway).
7. CORS open to all origins; no rate limiting; error messages leaked internals (`error.message` from Mongoose).
