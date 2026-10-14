const config = require("../config/env");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → Date at UTC midnight (how Prisma represents MySQL DATE columns). */
function parseDateOnly(value) {
  if (!DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

/** Date (from a DATE column) → "YYYY-MM-DD". */
function toDateOnly(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : null;
}

/** Today's calendar date in the institution's timezone, as "YYYY-MM-DD". */
function todayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function today() {
  return parseDateOnly(todayString());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Whole days between two DATE values (b - a). */
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

module.exports = { DATE_RE, parseDateOnly, toDateOnly, todayString, today, addDays, daysBetween };
