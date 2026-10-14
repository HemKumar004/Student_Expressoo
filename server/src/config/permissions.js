/**
 * Human-readable description of what each role can do. This mirrors the route guards in
 * src/routes — keep both in sync when changing access rules. Served read-only to the Admin
 * Console's Roles & permissions page.
 *
 * Values: "all" | "own" (records belonging to the user) | "assigned" (classes the staff member
 * is assigned to) | "section" (the representative's own section) | false.
 */
const ROLES = [
  { key: "STUDENT", label: "Student", description: "Views their own attendance, fees, materials and notices." },
  { key: "CR", label: "Class Representative", description: "A student who can raise teacher alerts and message their section." },
  { key: "LR", label: "Ladies Representative", description: "A student with the same representative tools as the CR." },
  { key: "STAFF", label: "Staff", description: "Marks attendance and shares material for assigned classes." },
  { key: "ADMIN", label: "Administrator", description: "Manages the institution, accounts, fees and oversight." },
];

const CAPABILITIES = [
  { group: "Accounts", key: "accounts.manage", label: "Create, edit and deactivate accounts", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Accounts", key: "accounts.approve", label: "Approve staff registrations", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Accounts", key: "roles.assign", label: "Assign CR / LR and administrator access", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Academics", key: "academics.manage", label: "Manage departments, courses, sections and subjects", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Academics", key: "assignments.manage", label: "Assign staff to subjects and sections", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Academics", key: "students.view", label: "View student lists", STUDENT: false, CR: false, LR: false, STAFF: "assigned", ADMIN: "all" },
  { group: "Attendance", key: "attendance.mark", label: "Mark and correct attendance", STUDENT: false, CR: false, LR: false, STAFF: "assigned", ADMIN: "all" },
  { group: "Attendance", key: "attendance.view", label: "View attendance", STUDENT: "own", CR: "own", LR: "own", STAFF: "assigned", ADMIN: "all" },
  { group: "Fees", key: "fees.view", label: "View fees and payment history", STUDENT: "own", CR: "own", LR: "own", STAFF: false, ADMIN: "all" },
  { group: "Fees", key: "fees.manage", label: "Manage fee structures and record payments", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Materials", key: "materials.view", label: "View and download study material", STUDENT: "section", CR: "section", LR: "section", STAFF: "assigned", ADMIN: "all" },
  { group: "Materials", key: "materials.upload", label: "Upload and manage study material", STUDENT: false, CR: false, LR: false, STAFF: "assigned", ADMIN: "all" },
  { group: "Communication", key: "notifications.send", label: "Send notifications", STUDENT: false, CR: "section", LR: "section", STAFF: "assigned", ADMIN: "all" },
  { group: "Communication", key: "announcements.manage", label: "Publish announcements", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Communication", key: "alerts.raise", label: "Raise teacher alerts", STUDENT: false, CR: "section", LR: "section", STAFF: false, ADMIN: false },
  { group: "Communication", key: "alerts.respond", label: "Acknowledge teacher alerts", STUDENT: false, CR: false, LR: false, STAFF: "own", ADMIN: "all" },
  { group: "Oversight", key: "reports.view", label: "Attendance and fee reports", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
  { group: "Oversight", key: "audit.view", label: "Audit log", STUDENT: false, CR: false, LR: false, STAFF: false, ADMIN: "all" },
];

module.exports = { PERMISSIONS: { roles: ROLES, capabilities: CAPABILITIES } };
