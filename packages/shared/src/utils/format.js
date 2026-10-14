/** Join class names, skipping falsy values. */
export function cx(...parts) {
  return parts.flat().filter(Boolean).join(" ");
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const numberFmt = new Intl.NumberFormat("en-IN");
const compactFmt = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Money arrives from the API as fixed 2-dp strings; format for display only. */
export function formatCurrency(value, { compact = false, whole = false } = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  if (compact && Math.abs(n) >= 100000) return inrCompact.format(n);
  return whole ? inrWhole.format(n) : inr.format(n);
}

export function formatNumber(value, { compact = false } = {}) {
  if (value === null || value === undefined) return "—";
  return compact && Math.abs(value) >= 10000 ? compactFmt.format(value) : numberFmt.format(value);
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(digits)}%`;
}

/** Parse "YYYY-MM-DD" as a local calendar date (no timezone shift). */
export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" });

export const formatDate = (v) => (parseDateOnly(v) ? dateFmt.format(parseDateOnly(v)) : "—");
export const formatShortDate = (v) => (parseDateOnly(v) ? shortDateFmt.format(parseDateOnly(v)) : "—");
export const formatWeekday = (v) => (parseDateOnly(v) ? weekdayFmt.format(parseDateOnly(v)) : "—");
export const formatLongDate = (v) => (parseDateOnly(v) ? longDateFmt.format(parseDateOnly(v)) : "—");
export const formatDateTime = (v) => (v ? dateTimeFmt.format(new Date(v)) : "—");
export const formatTime = (v) => (v ? timeFmt.format(new Date(v)) : "—");
/** "2026-10" → "Oct 26" */
export const formatMonth = (v) => (v ? monthFmt.format(new Date(`${v}-01T00:00:00`)) : "—");

export function formatRelative(value) {
  if (!value) return "—";
  const date = new Date(value);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 45) return "Just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.round(diff / 86400)} days ago`;
  return dateFmt.format(date);
}

/** Today's local date as "YYYY-MM-DD". */
export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function initials(name = "") {
  const parts = name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name = "") {
  return name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "").trim().split(/\s+/)[0] || name;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export const ROLE_LABELS = { STUDENT: "Student", STAFF: "Staff", ADMIN: "Administrator", SYSTEM: "System" };
export const REP_LABELS = { CR: "Class Representative", LR: "Ladies Representative", NONE: "Student" };
export const METHOD_LABELS = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank transfer", CHEQUE: "Cheque", DEMAND_DRAFT: "Demand draft" };
export const CATEGORY_LABELS = { GENERAL: "General", ACADEMIC: "Academic", EXAM: "Exam", FEE: "Fees", EVENT: "Event", URGENT: "Urgent", ALERT: "Teacher alert" };

/** Build and download a CSV from rows + column definitions (client-side, from API data). */
export function downloadCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escape(typeof c.value === "function" ? c.value(row) : row[c.value])).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Cryptographically random temporary password that satisfies the password policy. */
export function generatePassword(length = 12) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits + "@#$%";
  const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const chars = [pick(letters), pick(digits), ...Array.from({ length: length - 2 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
