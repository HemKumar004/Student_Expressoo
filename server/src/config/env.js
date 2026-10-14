const path = require("path");
const { z } = require("zod");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });

const intFrom = (fallback, { min, max } = {}) =>
  z.coerce
    .number()
    .int()
    .min(min ?? Number.MIN_SAFE_INTEGER)
    .max(max ?? Number.MAX_SAFE_INTEGER)
    .default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: intFrom(5000, { min: 0, max: 65535 }),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .startsWith("mysql://", { error: "DATABASE_URL must be a mysql:// connection string" }),
  JWT_SECRET: z
    .string({ error: "JWT_SECRET is required" })
    .min(32, { error: "JWT_SECRET must be at least 32 characters long" }),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174,http://localhost:5175"),
  TRUST_PROXY: intFrom(0, { min: 0 }),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: intFrom(20, { min: 1, max: 200 }),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  ATTENDANCE_THRESHOLD: intFrom(75, { min: 1, max: 100 }),
  ATTENDANCE_EDIT_WINDOW_DAYS: intFrom(7, { min: 0, max: 365 }),
  MAX_PERIODS_PER_DAY: intFrom(8, { min: 1, max: 12 }),
  ALERT_ESCALATION_MINUTES: intFrom(2, { min: 1, max: 120 }),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  // Fail fast with a readable message; never print the values themselves.
  console.error(`\nInvalid server configuration (check server/.env):\n${problems}\n`);
  process.exit(1);
}

const env = parsed.data;

const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
  corsOrigins: env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  trustProxy: env.TRUST_PROXY,
  uploadDir: path.resolve(__dirname, "..", "..", env.UPLOAD_DIR),
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  timezone: env.APP_TIMEZONE,
  rules: {
    attendanceThreshold: env.ATTENDANCE_THRESHOLD,
    attendanceEditWindowDays: env.ATTENDANCE_EDIT_WINDOW_DAYS,
    maxPeriodsPerDay: env.MAX_PERIODS_PER_DAY,
    alertEscalationMinutes: env.ALERT_ESCALATION_MINUTES,
    // Preserved from the original Student Expressoo login rules.
    rollNumberLength: 10,
    employeeIdLength: 8,
    passwordMinLength: 8,
  },
};

module.exports = config;
