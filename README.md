# Student Expressoo — Smart College Management System

Student Expressoo connects a college's **students**, **staff** and **administration**: attendance, fees and receipts, study materials, notifications and announcements, and the original **Class Representative (CR) / Ladies Representative (LR)** teacher-alert workflow.

Version 2 is a complete rebuild of the original MongoDB project:

| | |
|---|---|
| **Three independent frontends** | Student Portal · Staff Portal · Admin Console (React 19 + Vite 8), each separately runnable, buildable and deployable |
| **One shared backend** | Node.js + Express 5 REST API (`/api/v1`) |
| **One relational database** | MySQL 8 via Prisma ORM, with version-controlled migrations |
| **One design system** | `@expressoo/shared` — tokens, components, charts, API client and auth used by all three portals |

```
 Student Portal :5173 ─┐
 Staff Portal   :5174 ─┼──► Express API :5000 (/api/v1) ──► MySQL 8 (student_expressoo)
 Admin Console  :5175 ─┘        auth · RBAC · validation · audit log · uploads
```

---

## Quick start (local development)

### Prerequisites
- **Node.js 20.19+** (tested with 22.19) and npm 10+
- **MySQL 8.0+** running locally (tested with 8.0.43)

### 1. Install
```bash
npm install
```
One install at the repository root sets up every workspace (three apps, the shared package and the server).

### 2. Configure the API
```bash
cp server/.env.example server/.env
```
Edit `server/.env`:
- `DATABASE_URL` — e.g. `mysql://USER:PASSWORD@localhost:3306/student_expressoo`
- `TEST_DATABASE_URL` — a **separate** database used only by `npm test` (its name must contain `test`)
- `JWT_SECRET` — at least 32 random characters:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

The portals need no setup: each `apps/<portal>/.env` holds **public** defaults only (`VITE_API_URL=http://localhost:5000/api/v1` and links to the other portals). To change them on your machine, create `apps/<portal>/.env.local`, which is git-ignored and takes precedence.

### 3. Create the database schema
```bash
npm run db:deploy
```
This applies the migrations in `server/prisma/migrations` (it creates the database if your MySQL user is allowed to). During schema development, use `npm run db:migrate` to create new migrations.

### 4. (Optional) Load demo data
```bash
npm run db:seed
```
This loads a realistic **development-only** college: 2 courses, 4 sections, 11 subjects, 6 staff, 38 students, four weeks of attendance, fees and payments, study materials with real PDF files, notices and teacher alerts. The seed refuses to run in production or against a database that already has accounts. The demo sign-in details are listed at the top of [`server/prisma/seed.js`](server/prisma/seed.js).

For a real deployment, skip the seed and create the first administrator instead:
```bash
npm run create-admin
```

### 5. Run everything
```bash
npm run dev
```
| App | URL |
|---|---|
| API | http://localhost:5000/api/v1/health |
| Student Portal | http://localhost:5173 |
| Staff Portal | http://localhost:5174 |
| Admin Console | http://localhost:5175 |

Or run any part on its own: `npm run dev:server`, `npm run dev:student`, `npm run dev:staff`, `npm run dev:admin`.

---

## Scripts (repository root)

| Script | What it does |
|---|---|
| `npm run dev` | API + all three portals with hot reload |
| `npm run dev:server` / `dev:student` / `dev:staff` / `dev:admin` | Run one part |
| `npm run build` | Production build of all three portals (`apps/*/dist`) |
| `npm run build:student` / `build:staff` / `build:admin` | Build one portal |
| `npm start` | Start the API in production mode |
| `npm run db:migrate` | Create and apply a new migration (development) |
| `npm run db:deploy` | Apply pending migrations (production / CI) |
| `npm run db:seed` | Load development demo data (empty database only) |
| `npm run db:reset` | **Drop all data** and re-apply migrations (development only) |
| `npm run db:studio` | Browse the database with Prisma Studio |
| `npm run create-admin` | Create an administrator account |
| `npm run test` | Backend integration tests against `TEST_DATABASE_URL` |
| `npm run lint` | Lint all apps, the shared package and the server |

Importing data from the original MongoDB version is covered in [docs/DATABASE.md](docs/DATABASE.md#importing-data-from-the-original-mongodb-version).

---

## Repository layout

```
apps/
  student/      Student Portal (Vite + React) — dashboard, attendance, fees, materials, notices, CR/LR desk
  staff/        Staff Portal — classes, attendance marking & history, materials, alerts
  admin/        Admin Console — people, academics, attendance, fees, communication, reports, audit
packages/
  shared/       Design system, charts, API client, auth, shared feature screens
server/
  prisma/       schema.prisma, migrations/, seed.js
  scripts/      create-admin.js, import-mongo-export.js
  src/          config · lib · middleware · validators · services · controllers · routes
  tests/        Integration tests (node:test)
docs/           Architecture, database, API, audit, testing, deployment, design system
```

## Documentation

- [Architecture & decisions](docs/ARCHITECTURE.md)
- [Database schema & MongoDB → MySQL migration](docs/DATABASE.md)
- [API reference](docs/API.md)
- [Original project audit & feature mapping](docs/AUDIT.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Testing & verification report](docs/TESTING.md)
- [Deployment guide](docs/DEPLOYMENT.md)

## Security at a glance

- bcrypt password hashing; plaintext passwords are never stored.
- Short-lived JWTs, re-checked against the database on every request, so deactivation and password changes revoke sessions immediately.
- Each portal only accepts its own role. Roles are never taken from client input; administrators are created only by other administrators or the CLI.
- Every route is authorised on the server, including student data isolation and staff class assignments.
- All input is validated with zod. Queries use Prisma or parameterised `$queryRaw` templates.
- Rate limiting on sign-in, registration and the whole API. Helmet security headers and a strict CORS allow-list.
- Uploads are checked for extension, MIME type, size and file signature, stored under random names, and only served through authorised downloads.
- Payments are only ever recorded by the accounts office, inside transactions with optimistic concurrency control. **Online payment is not implemented.**
- A complete audit log covers sign-ins, account changes, attendance corrections, payments, uploads and deletions.
