# Deployment guide

Student Expressoo deploys as **one API service**, **one MySQL database** and **three static sites**. A typical layout:

| Component | Example host | Example URL |
|---|---|---|
| API (Node 20+) | VM, container, Render, Railway… | `https://api.college.edu` |
| MySQL 8 | Managed MySQL or a self-hosted server | private network |
| Student Portal | Any static host or CDN (Netlify, Vercel, S3 + CloudFront, nginx) | `https://students.college.edu` |
| Staff Portal | same | `https://staff.college.edu` |
| Admin Console | same (consider restricting by IP or VPN) | `https://admin.college.edu` |

## 1. Database
1. Create a database and a **dedicated least-privilege user**. Don't use `root` in production:
   ```sql
   CREATE DATABASE student_expressoo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'expressoo_app'@'%' IDENTIFIED BY '<strong password>';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON student_expressoo.* TO 'expressoo_app'@'%';
   ```
   (`CREATE/ALTER/INDEX/REFERENCES/DROP` are needed by `prisma migrate deploy`. If your release pipeline runs migrations with a separate account, the runtime user only needs `SELECT, INSERT, UPDATE, DELETE`.)
2. Apply the schema: `npm run db:deploy` (with `DATABASE_URL` set). **Do not run `db:seed` or `db:reset` in production.**
3. Create the first administrator: `npm run create-admin`.

## 2. API
Environment variables (see `server/.env.example`):

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | e.g. `5000` |
| `DATABASE_URL` | `mysql://expressoo_app:…@db-host:3306/student_expressoo?connection_limit=10` |
| `JWT_SECRET` | 48+ random bytes, unique per environment |
| `JWT_EXPIRES_IN` | `8h` (shorter is safer) |
| `CORS_ORIGINS` | `https://students.college.edu,https://staff.college.edu,https://admin.college.edu` |
| `TRUST_PROXY` | `1` behind a load balancer or reverse proxy (needed for correct rate limiting and audit IPs) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | A **persistent volume** path for uploaded materials |
| `APP_TIMEZONE`, `ATTENDANCE_*`, `MAX_PERIODS_PER_DAY`, `ALERT_ESCALATION_MINUTES` | Institution rules |

Run:
```bash
npm ci
npm run db:deploy
npm start          # node server/src/server.js
```
The server checks its configuration at startup and refuses to start with missing or weak settings. It connects to MySQL before listening and shuts down gracefully on SIGTERM. Use `GET /api/v1/health` for load-balancer health checks. Terminate TLS at your proxy.

## 3. Frontends
Each portal is built independently. Only **public** values go into `VITE_` variables; they end up in the browser bundle.
```bash
# apps/student/.env.production (or host build environment variables)
VITE_API_URL=https://api.college.edu/api/v1
VITE_STUDENT_URL=https://students.college.edu
VITE_STAFF_URL=https://staff.college.edu
VITE_ADMIN_URL=https://admin.college.edu

npm ci
npm run build:student   # → apps/student/dist
npm run build:staff     # → apps/staff/dist
npm run build:admin     # → apps/admin/dist
```
Each `dist/` folder is a single-page app, so configure the host to **rewrite unknown paths to `/index.html`**:
* Netlify: `_redirects` → `/*  /index.html  200`
* Vercel: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`
* nginx: `try_files $uri /index.html;`

## 4. Operations checklist
- [ ] HTTPS everywhere; `CORS_ORIGINS` lists only the three portal origins
- [ ] Least-privilege MySQL user; database not reachable from the internet
- [ ] Daily `mysqldump --single-transaction` (or provider snapshots) **plus** a backup of the uploads volume
- [ ] Remove or deactivate any demo accounts if the seed was ever run
- [ ] Review the audit log (Admin Console → Audit log) regularly
- [ ] Online fee payment is **not** implemented. Payments are recorded by the accounts office. Integrating a gateway requires server-side verification of the gateway's signed callbacks before any fee is marked paid.
