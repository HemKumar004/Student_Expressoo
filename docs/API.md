# API reference (`/api/v1`)

All endpoints return JSON. Authenticated endpoints need `Authorization: Bearer <token>`.

**Errors** use one shape: `{ "error": { "message": "...", "code": "...", "details": { "field": "problem" } } }`.
Status codes: `400` validation · `401` not signed in or session ended · `403` not allowed · `404` not found (also returned for records the caller may not see) · `409` conflict or duplicate · `413` too large · `422` business rule (e.g. overpayment) · `429` rate limited.

**List endpoints** accept `page` and `pageSize` (≤ 100) and return `{ items, pagination: { page, pageSize, total, totalPages } }`.

Roles: **S** student · **R** student who is CR/LR · **T** staff · **A** admin · **P** public.

## Auth
| Method & path | Who | Notes |
|---|---|---|
| `POST /auth/login` | P | `{ username, password, portal: "student"|"staff"|"admin" }` → `{ token, user }`. The username may be an email. Rate limited. |
| `POST /auth/register/student` | P | `{ fullName, email, mobile, rollNumber(10), sectionId, password, confirmPassword }`. Always creates an ACTIVE `STUDENT`; any role sent by the client is ignored. |
| `POST /auth/register/staff` | P | `{ fullName, email, mobile, employeeId(8), departmentId, designation?, password, confirmPassword }`. Creates a PENDING `STAFF` account and notifies admins. |
| `GET /auth/me` | S T A | Current account with student/staff profile |
| `PATCH /auth/me` | S T A | `{ email?, mobile? }` |
| `POST /auth/change-password` | S T A | `{ currentPassword, newPassword, confirmPassword }` → new token; other sessions are revoked |
| `POST /auth/logout` | S T A | Audit entry (the client discards its token) |

## Metadata & dashboards
| Method & path | Who | Notes |
|---|---|---|
| `GET /health` | P | Database connectivity |
| `GET /meta/config` | P | Public rules: attendance threshold, periods per day, upload limits, ID lengths |
| `GET /meta/registration-options` | P | Sections and departments for the sign-up forms |
| `GET /meta/permissions` | A | Role/capability matrix |
| `GET /dashboard/student` · `/staff` · `/admin` | S · T · A | Aggregated, role-specific dashboard data |

## People (administrators)
| Method & path | Notes |
|---|---|
| `GET /students` | Filters: `search`, `courseId`, `sectionId`, `yearOfStudy`, `status`, `representativeRole`; `sort=rollNumber|name|createdAt`, `order` |
| `POST /students` · `GET /students/:id` · `PATCH /students/:id` | Moving a student to another section clears their CR/LR designation |
| `PATCH /students/:id/representative` | `{ representativeRole: "NONE"|"CR"|"LR" }`. Keeps one CR/LR per section and returns `replaced` |
| `GET /staff` · `POST /staff` · `GET /staff/:id` · `PATCH /staff/:id` | `GET /staff/:id` includes teaching assignments |
| `GET /users/admins` · `POST /users/admins` | Grant administrator access |
| `PATCH /users/:id/status` | `{ status: ACTIVE|INACTIVE, reason? }`. Approves PENDING accounts. Cannot target yourself; at least one admin must remain |
| `POST /users/:id/reset-password` | `{ password }`. Revokes the user's sessions |

## Academics
| Method & path | Who | Notes |
|---|---|---|
| `GET /academics/departments` · `courses` · `sections` · `subjects` | S T A | Reference data. Filters: `departmentId`, `courseId`, `yearOfStudy`, `sectionId` |
| `POST`/`PATCH`/`DELETE` on the above (`/:id`) | A | Deletion is refused (409) while records still reference the item |
| `GET /academics/assignments/mine` | T | The caller's (subject, section) pairs |
| `GET /academics/assignments` · `POST` · `DELETE /:id` | A | A subject must match the section's course and year |

## Attendance
| Method & path | Who | Notes |
|---|---|---|
| `GET /attendance/roster?sectionId&subjectId&date&period` | T(assigned) A | Students plus any existing marks, edit permission and conflict info |
| `PUT /attendance/sessions` | T(assigned) A | `{ sectionId, subjectId, date, period, topic?, records:[{studentId, status}] }`. Creates or corrects a session in a transaction (201 on create, 200 on update). Refuses future dates. Staff are limited to the edit window |
| `GET /attendance/sessions` | T A | Filters: `sectionId`, `subjectId`, `staffId`(A), `from`, `to`. Staff see only their classes |
| `DELETE /attendance/sessions/:id` | T(assigned, within window) A | |
| `GET /attendance/class-stats?sectionId&subjectId` | T(assigned) A | Per-student percentages for one class |
| `GET /attendance/overview` | A | `from`, `to`, `courseId`, `sectionId` → by section, daily trend, students below the threshold |
| `GET /attendance/me/summary` | S | Overall and per-subject percentage, classes needed or missable, weekly trend |
| `GET /attendance/me/history` | S | Filters: `subjectId`, `status`, `from`, `to` |

## Fees & payments
| Method & path | Who | Notes |
|---|---|---|
| `GET /fees/me` | S | Records, payments and summary (billed, paid, balance, overdue, next due). `onlinePaymentsEnabled: false` |
| `GET /fees/structures` · `POST` · `PATCH /:id` · `DELETE /:id` | A | Amount and audience lock once the fee has been billed |
| `POST /fees/structures/:id/assign` | A | Bills all matching active students and skips those already billed → `{ created, skipped, matched }` |
| `GET /fees/records` | A | Filters: `search`, `courseId`, `sectionId`, `feeStructureId`, `status`, `overdue`. Includes `totals` |
| `GET /fees/records/:id` · `PATCH /fees/records/:id` | A | `PATCH { discount?, remarks? }` recomputes the status |
| `POST /payments` | A | `{ feeRecordId, amount, method, paidOn, referenceNo?, notes? }`. Transactional, refuses overpayment (422), notifies the student, returns a `receiptNo` |
| `POST /payments/:id/void` | A | `{ reason }`. Reverses the payment's effect; the payment stays on record as VOIDED |
| `GET /payments` | A | Filters: `search` (student or `RCPT-…`), `method`, `status`, `studentId`, `from`, `to`. Includes `totals.collected` |
| `GET /payments/me` · `GET /payments/:id` | S (own) A | Students get 404 for other students' receipts |

## Study materials
| Method & path | Who | Notes |
|---|---|---|
| `GET /materials` | S T A | Scoped automatically (students: their section; staff: their classes and uploads). Filters: `search`, `subjectId`, `sectionId`, `courseId`, `mine` |
| `POST /materials` (multipart) | T(assigned) A | Fields: `title`, `subjectId`, `sectionId` (empty = all the subject's sections), `unit?`, `description?`, `file` |
| `GET /materials/:id` · `GET /materials/:id/download` | S T A (if visible) | The download streams the file as an attachment |
| `PATCH /materials/:id` · `DELETE /materials/:id` | uploader or A | Deleting also removes the file |

## Communication
| Method & path | Who | Notes |
|---|---|---|
| `GET /notifications` | S T A | Inbox with `unreadCount`. Filters: `unread`, `category` |
| `GET /notifications/unread-count` · `POST /notifications/read-all` · `PATCH /notifications/:id/read` | S T A | `:id` is the inbox item id; ownership is enforced |
| `POST /notifications` | R(own section) T(assigned sections) A(any) | `{ title, message, category, targetType: ALL|STUDENTS|STAFF|COURSE|SECTION, courseId?, sectionIds?, eventAt? }` |
| `GET /notifications/sent` · `DELETE /notifications/:id` | R T A | Sent items with read counts; withdraw |
| `GET /announcements` | S T A | Filtered by audience and expiry (admins can include expired) |
| `POST /announcements` · `PUT /:id` · `DELETE /:id` | A | |
| `GET /teacher-alerts/contacts` | R | Teachers of the representative's section, with phone numbers |
| `POST /teacher-alerts` | R | `{ staffId, subjectId?, period, message? }`. Duplicate open alerts are refused; the teacher is notified |
| `GET /teacher-alerts` | R T A | Representatives: their section · staff: addressed to them · admin: all |
| `PATCH /teacher-alerts/:id/acknowledge` | T(target) A | `{ responseNote? }`. The representative is notified |
| `PATCH /teacher-alerts/:id/resolve` | R T(target) A | |

## Reports & audit (administrators)
| Method & path | Notes |
|---|---|
| `GET /reports/attendance?sectionId&subjectId&from&to` | Per-student report for a section (default range: 90 days) |
| `GET /reports/fees?courseId&academicYear` | Collection by section plus overdue accounts |
| `GET /audit-logs` | Filters: `search`, `entityType`, `action`, `actorId`, `from`, `to` |

## Changes from the original API

The original endpoints were unauthenticated and are **not** kept, because they exposed every record to anyone. Every consumer (the three new portals) uses the new API.

| Original | Replacement |
|---|---|
| `POST /api/students/signup` (client chose the role) | `POST /api/v1/auth/register/student` (always STUDENT) · `/register/staff` (PENDING) |
| `POST /api/students/login` (plaintext comparison, returned only a role) | `POST /api/v1/auth/login` (bcrypt, JWT, portal check) |
| `GET /api/students/profile/:username` (anyone could read any profile) | `GET /api/v1/auth/me` (own profile) · `GET /api/v1/students/:id` (admin) |
| `POST /api/attendance/save` · `GET /api/attendance[/:rollNumber]` (in-memory, aggregate totals) | `PUT /api/v1/attendance/sessions` · `GET /api/v1/attendance/me/summary` · `/me/history` · `/sessions` · `/class-stats` |
| `POST /api/fees/save` · `GET /api/fees` (in-memory, any body) | `/api/v1/fees/*` and `/api/v1/payments/*` |
| `POST /api/materials/upload` (stored only a file name) · `GET /api/materials` | `POST /api/v1/materials` (multipart, real file) · `GET /api/v1/materials` · `/:id/download` |
| `POST /api/notifications/send` · `GET /api/notifications` (in-memory) | `/api/v1/notifications` (targeted, per-user read state) |
| `POST /api/teacher-alert/send` · `GET /api/teacher-alert` (in-memory) | `/api/v1/teacher-alerts` (persisted, acknowledgement workflow) |
