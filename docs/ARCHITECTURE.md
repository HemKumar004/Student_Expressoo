# Architecture & key decisions

## System overview

```
                ┌──────────────────────┐
 Students  ───► │ Student Portal :5173 │──┐
                └──────────────────────┘  │   HTTPS + Bearer JWT
                ┌──────────────────────┐  │   JSON REST /api/v1
 Faculty   ───► │ Staff Portal   :5174 │──┼──────────────────────►  Express API :5000 ──► MySQL 8
                └──────────────────────┘  │                          (one backend)         (one database)
                ┌──────────────────────┐  │                          uploads/materials/
 Office    ───► │ Admin Console  :5175 │──┘
                └──────────────────────┘
        all three built from @expressoo/shared (design system · API client · auth)
```

* **Exactly three frontends, one backend, one database.** There are no per-role backends or databases. Every frontend talks to the same `/api/v1`.
* **npm workspaces monorepo** (`apps/*`, `packages/*`, `server`). One `npm install`, with independent `dev` / `build` / `preview` per app. A portal's `dist/` is a self-contained static site: the shared package is bundled in at build time.

## Frontends

| Decision | Rationale |
|---|---|
| React 19 + Vite 8 + React Router 7 (library mode), plain JavaScript | Kept from the original project; no framework change. |
| `@expressoo/shared` workspace package | One design system, API client, auth provider and shared screens (sign-in, notifications, announcements, account settings, materials library, receipts) without forcing identical page layouts. |
| Route-level code splitting (`React.lazy`) | Each page is its own chunk. The initial bundle is ≈ 98 kB gzipped per portal. |
| No UI framework or chart library | Hand-built components and SVG charts on the project's own CSS tokens. This gives full control of the visual language and keeps dependencies to `lucide-react` (icons) and `@fontsource-variable/inter` (self-hosted font). |
| Portal fixed per app, no role picker | The original login asked users to pick a role, which the server then trusted. Now each portal sends its fixed `portal` value, and the API refuses accounts whose stored role does not match. |
| Frontend route guards are for usability only | `RequireAuth` / `GuestOnly` / representative checks improve UX. The API enforces every permission independently. |

## Backend

```
src/
  config/       env.js (zod-validated environment, fails fast), permissions.js (documented matrix)
  lib/          prisma.js (single PrismaClient + connection pool)
  middleware/   auth (JWT + DB-backed session check, role guards), validate (zod), rateLimit, upload, errorHandler
  validators/   zod schemas per module
  services/     business logic and all database access
  controllers/  thin HTTP mapping
  routes/       wiring: authentication → authorisation → validation → controller
```

### Database access: Prisma 6.19 (MySQL)
* The spec prefers Prisma. Prisma **6.19.x** (released April 2026) was chosen over 7.x because 7 requires driver adapters and an ESM-first client generator, while the existing server is CommonJS. 6.19 is stable and fully supports MySQL. The upgrade path to 7 is mechanical (add `prisma.config.ts` and `@prisma/adapter-mariadb`).
* There is one ORM throughout. Aggregations that Prisma cannot express (per-subject attendance, weekly trends, fee rollups) use **parameterised `$queryRaw` tagged templates**, never string-built SQL.
* Migrations live in `server/prisma/migrations` and are applied with `prisma migrate deploy`.

### Authentication & sessions
* `POST /auth/login { username, password, portal }`. The username may also be the email. Passwords are verified with bcrypt (cost 11) and compared against a dummy hash when the user doesn't exist, which keeps timing uniform.
* The API issues an **HS256 JWT** (`sub`, `role`, `portal`, `ver`, 8 h by default) as a **Bearer token**. Each portal stores it in its own origin's `localStorage`.
  * Why not cookies: the three portals are separate origins and are often deployed on different sites. Third-party-cookie restrictions would make cookie sessions fragile across deployments, and Bearer tokens work everywhere.
  * Mitigations: React escapes all output and the API sets Helmet headers. Most importantly, **every request reloads the user from MySQL** and checks `status === ACTIVE`, the role/portal match and `tokenVersion`. Deactivation, password change and admin password reset bump `tokenVersion`, which revokes existing tokens immediately.
* A 401 response carries a machine-readable `code` (`SESSION_EXPIRED`, `SESSION_REVOKED`, `ACCOUNT_INACTIVE` …). The shared API client then clears the session and the sign-in screen explains why.

### Authorisation model
| Role | Notes |
|---|---|
| `STUDENT` | Reads only their own attendance, fees and payments (identity always comes from the token, never from URL parameters). Sees materials for their section. |
| `STUDENT` + `CR`/`LR` | A **representative designation** on the student record, not a separate role. It unlocks teacher alerts and class messages for their own section only. Each section has at most one CR and one LR (assigning a new one demotes the previous holder in the same transaction). |
| `STAFF` | Acts only on `(subject, section)` pairs in `staff_assignments`: rosters, attendance, materials, notifications, class statistics. Staff-entered attendance can be corrected within `ATTENDANCE_EDIT_WINDOW_DAYS` (default 7). |
| `ADMIN` | Full management. Cannot deactivate themselves, and at least one active admin must always remain. Created only by another admin or the `create-admin` CLI. |

`src/config/permissions.js` documents the matrix and is shown read-only on the Admin Console's *Roles & access* page.

### Data integrity rules
* **Money:** `DECIMAL(10,2)` columns. API values are fixed 2-dp strings, and all arithmetic uses Prisma's Decimal (`utils/money.js`). `feeStatusFor()` is the single source of truth for UNPAID / PARTIAL / PAID / WAIVED.
* **Payments** are written in an interactive transaction that re-reads the fee record, validates the balance, and updates `amount_paid` with an **optimistic concurrency guard** (`WHERE amount_paid = <value read>`). The payment and its receipt number are created in the same transaction. Payments are never edited; they are **voided** (also transactional), which reverses their effect. The integration test fires four concurrent full-balance payments and verifies exactly one succeeds.
* **Attendance** is session based: one `class_sessions` row per section/date/period (unique), with one `attendance_records` row per student (unique per session). Saving replaces the records in a transaction, and corrections are audited.
* **Dates:** `DATE` columns are calendar dates in the institution's timezone (`APP_TIMEZONE`, default Asia/Kolkata). Instants are stored as UTC `DATETIME(3)`.
* **Deletion policy:** accounts are deactivated, never deleted. Academic entities can only be deleted when nothing references them (FK `RESTRICT` plus friendly 409 messages).

### File uploads
* Multer stores files to `server/uploads/materials/` under a **random UUID name** with the vetted extension. The client file name is kept only as metadata.
* Checks: extension allow-list, MIME/extension agreement, size limit (`MAX_UPLOAD_MB`), and a **magic-byte check** (PDF, ZIP-based Office, OLE Office, PNG, JPEG). Rejected files are deleted immediately.
* Files are never served statically. `GET /materials/:id/download` checks visibility first, then streams the file with `Content-Disposition: attachment`, `nosniff` and `no-store`.

### Notifications
* Fan-out on write: a `notifications` row plus one `notification_recipients` row per user. This gives true per-user read state, unread counts and read-rate statistics for senders.
* System notifications are generated in the same transaction as their cause: payment received, fee billed, material shared, teacher alert raised or acknowledged, account approved, representative appointed.

### Observability & safety
* `GET /api/v1/health` checks database connectivity.
* An `audit_logs` row is written for every sensitive action (inside the same transaction where applicable).
* Centralised error handling returns safe messages with stable codes. Stack traces stay in the server log.
* Graceful shutdown closes the HTTP server and the Prisma pool on SIGINT/SIGTERM.

## Design system

See [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). In short: navy navigation, white surfaces on a neutral page, one restrained blue accent that is shared with the charts, Inter typography, an 8 px radius scale, hairline borders, subtle elevation, and status colours that always appear alongside an icon or label.
