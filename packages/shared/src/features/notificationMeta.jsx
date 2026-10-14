import { Bell, BookOpen, CalendarDays, ClipboardCheck, IndianRupee, Siren, TriangleAlert } from "lucide-react";
import { Badge } from "../components/Display.jsx";
import { CATEGORY_LABELS } from "../utils/format.js";

const META = {
  GENERAL: { icon: Bell, tone: "neutral", bg: "var(--gray-100)", fg: "var(--gray-600)" },
  ACADEMIC: { icon: BookOpen, tone: "primary", bg: "var(--primary-50)", fg: "var(--primary-700)" },
  EXAM: { icon: ClipboardCheck, tone: "info", bg: "var(--info-50)", fg: "var(--info-700)" },
  FEE: { icon: IndianRupee, tone: "success", bg: "var(--success-50)", fg: "var(--success-700)" },
  EVENT: { icon: CalendarDays, tone: "info", bg: "var(--info-50)", fg: "var(--info-700)" },
  URGENT: { icon: TriangleAlert, tone: "danger", bg: "var(--danger-50)", fg: "var(--danger-700)" },
  ALERT: { icon: Siren, tone: "warning", bg: "var(--warning-50)", fg: "var(--warning-700)" },
};

export function CategoryIcon({ category }) {
  const m = META[category] || META.GENERAL;
  const Icon = m.icon;
  return (
    <span className="list-icon" style={{ background: m.bg, color: m.fg }} aria-hidden="true">
      <Icon />
    </span>
  );
}

export function CategoryBadge({ category }) {
  const m = META[category] || META.GENERAL;
  return <Badge tone={m.tone}>{CATEGORY_LABELS[category] || category}</Badge>;
}
