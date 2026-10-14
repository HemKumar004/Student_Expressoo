# Testing & verification report

Environment: Windows 11, Node 22.19, npm 10.9, MySQL 8.0.43 (local), Chromium-based in-app browser.
Dates: 2026-10-13 → 2026-10-14. Everything below was **actually executed**. Items not executed are listed at the end.

## 1. Automated backend integration tests — `npm test`
`server/tests/api.test.js` (node:test). It runs against a dedicated `student_expressoo_test` database that is rebuilt from the migrations on every run. The harness refuses any database whose name lacks "test" or that equals `DATABASE_URL`.

**Result: 34 / 34 passed (7 suites, ~12 s).**

| Suite | What is asserted |
|---|---|
| Authentication | Wrong password → 401. Wrong portal → 403 `WRONG_PORTAL`. A client-sent `role: ADMIN` is ignored at registration. Self-registered staff stay PENDING until approved. Only bcrypt hashes are stored. A password change revokes old tokens. A tampered JWT → 401 |
| Role-based access control | Students and staff get 403 on 8 admin endpoints. Students cannot open rosters. Only CR/LR can use teacher alerts. Admins cannot deactivate themselves |
| Attendance | Staff rosters only for assigned classes. A session is saved once and corrected in place (same id, 3 records, audit entry). Another subject in a recorded period → 409. Foreign student → 400, future date → 400, older than the edit window → 403 for staff but allowed for admin. Students see only their own records and correct totals |
| Fees & payments | Bulk billing creates records, and re-billing creates 0. Exact decimals (`1000.50`, `400.25`). Partial → PARTIAL, full → PAID. Overpayment → 422. Void restores PARTIAL. **4 concurrent full-balance payments → exactly 1 succeeds.** Students see only their own fees and get 404 for others' receipts. Amounts lock after billing |
| Study materials | A genuine PDF is accepted and stored under a random name. A disguised file (`.pdf` with an EXE header) → 400, `.exe` → 400. Upload for an unassigned class → 403. Download works only for students who can see the material (others get 404, and it's absent from their list). Delete: non-owner gets 404, uploader succeeds |
| Notifications / announcements / alerts | Staff notification recipient count equals active students in the section. Other sections → 403, ALL → 403. Read state is per user and other inboxes → 404. Audience filtering works. The full CR alert flow works, with duplicate → 409 and wrong staff → 404 |
| Administration | One CR per section (the previous CR is demoted). Deactivation revokes an active token. A SQL-injection string in a search is treated as data. Audit entries exist for 7 sensitive actions. Dashboard numbers match direct database aggregates |

> Running the suite resets the test database. Prisma 6.19 blocks `migrate reset` when it is invoked by an AI agent, so the user explicitly approved it for the test-only database before it ran in this session. When you run `npm test` yourself, no extra step is needed.

## 2. API smoke test on the development database (seeded)
Logins on all three portals, all three dashboards, RBAC denials, student summaries, staff sessions and assignments, CR contacts, attendance overview, fee report, audit log, public registration options, and validation errors. All returned the expected status and data. Example aggregates: 38 active students, 6 staff, 82.9 % attendance (30 days), ₹33,95,000 billed / ₹30,62,500 collected before the live test payment.

## 3. Database & migration checks
| Check | Result |
|---|---|
| `prisma validate` | Schema valid |
| `prisma migrate deploy` on an empty server (`student_expressoo_deploycheck`, dropped afterwards) | Database created, 1 migration applied, **20 tables** (19 + `_prisma_migrations`), all InnoDB, 37 foreign keys |
| `prisma migrate status` (dev DB) | Up to date |
| `prisma migrate diff --from-url <dev DB> --to-schema-datamodel` | Exit code 0 — **no drift** |
| Seed | Loaded 46 users, 576 sessions, 5,472 attendance records, 98 fee records, 100 payments, 8 materials (real PDFs). A second run refused (database not empty) |
| MongoDB data inventory | No `studentexpressoo` database on the local MongoDB server, so there was nothing to migrate |
| Mongo export importer (synthetic export, test DB) | Dry run planned 2 students, 2 staff, 1 skip. Import created them. A re-run imported 0 and skipped 5. Old passwords verify against the new bcrypt hashes. The self-registered Admin was not imported |
| `create-admin` (test DB) | Created; a duplicate was refused; invalid input was rejected with field messages |
| MongoDB removal | `npm ls mongoose mongodb` → empty. No `mongoose` / `mongodb://` in the source or lockfile. The API starts with MySQL only |

## 4. Frontend builds, lint and bundle checks
| Check | Result |
|---|---|
| `npm run build` (all three) and `build:student` / `build:staff` / `build:admin` individually | All succeed. Main chunk ≈ 306–311 kB (≈ 98 kB gzip) per portal, CSS 56.6 kB (11.3 kB gzip), pages lazy-loaded |
| `npm run lint` (oxlint: apps, shared, server, scripts, tests) | 0 warnings, 0 errors |
| Unused-import scan (all JS/JSX) | 0 |
| Secret scan of `apps/*/dist` (DB password, `JWT_SECRET`, `DATABASE_URL`, `mysql://`, `password_hash`) | 0 matches. Only public `VITE_*` URLs are present |
| `vite preview` of the Student Portal build | `/`, deep link `/attendance` and static assets → 200 |
| Each portal started independently (`dev:student`, `dev:staff`, `dev:admin`) | Yes — separate dev servers on 5173 / 5174 / 5175 |

## 5. End-to-end checks in the browser (real API + MySQL)
| Flow | Result |
|---|---|
| Student sign-in (seeded student) → dashboard, attendance (hero %, subject meters, history table), fees (stat tiles, split meter, records, receipts) | Correct data, no console errors |
| Staff sign-in → dashboard → Mark attendance: default "present", `A` key shortcut moved focus, mouse toggle to Late, Save | Toast "Attendance saved", "Saved at …" indicator, button switched to "Update attendance"; the audit log shows the entry |
| Admin sign-in → dashboard charts (bar, line, split meter) with Chart/Table toggles, Students row menu, Fees → Record payment | Client validation (reference required for UPI) shown inline. Payment created RCPT-2026-000101; balance updated live; receipt dialog rendered |
| CR desk → raise alert → staff portal (sidebar badge "1") → acknowledge with quick reply → CR desk | The alert shows "Acknowledged" with the teacher's reply; the staff badge cleared |
| Console / server logs | No console errors in any portal; no API errors logged |

## 6. Responsive checks
* **375 × 812 (phone):** every route of all three portals was swept programmatically: `scrollWidth === clientWidth` (no page-level horizontal overflow). Visual checks covered the admin dashboard and drawer, student profile, and staff Mark attendance. The issues found were fixed and re-verified: card headers wrapping, a full-width save bar, 44 × 40 px touch targets, and menu icon squeeze.
* **768 × 1024 (tablet):** 11 admin routes swept, with no page-level overflow. Wide tables scroll inside their container.
* **1440 × 900 (desktop):** visual review of the main pages of each portal. Two layout issues were found and fixed: an overflowing staff dashboard table and an over-wide admin fee-records table.

## Not executed / known limitations
* **Online payments are not implemented** (none existed originally). Payments are recorded by the accounts office, and the student UI says so.
* **Email/SMS delivery is not implemented.** Notifications are in-app. The CR/LR "call" button is a `tel:` link: it dials on phones, while desktop behaviour depends on the OS handler.
* Real iOS/Safari and Android devices were not tested; the browser checks used Chromium device emulation.
* No automated frontend unit or E2E test suite was added. Frontend verification was the manual and scripted browser checks above.
* No load or performance testing, and no screen-reader testing with assistive technology (semantics and ARIA were reviewed in code).
* Dark mode is not implemented.
