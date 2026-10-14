import { useState } from "react";
import { CalendarCheck, CircleCheck, CircleAlert, TriangleAlert } from "lucide-react";
import {
  AttendanceMeter,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Meter,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
  StatusBadge,
  useApi,
  useAuth,
  usePageTitle,
  formatPercent,
  formatWeekday,
} from "@expressoo/shared";

function OverallCard({ summary }) {
  const o = summary.overall;
  const t = summary.threshold;
  const tone = o.standing === "none" ? "good" : o.standing;
  const Icon = tone === "good" ? CircleCheck : tone === "warning" ? TriangleAlert : CircleAlert;
  const message =
    o.total === 0
      ? "Attendance will appear here once your teachers start marking classes."
      : o.standing === "good"
        ? `You can miss up to ${o.canMiss} more class${o.canMiss === 1 ? "" : "es"} and stay above ${t}%.`
        : `Attend the next ${o.needed} class${o.needed === 1 ? "" : "es"} in a row to get back to ${t}%.`;
  return (
    <Card title="Overall attendance" subtitle={`Across all subjects · minimum required ${t}%`}>
      <div className="stack">
        <div className="row wrap" style={{ alignItems: "flex-end", gap: 24 }}>
          <div className="hero-figure">
            {o.percentage === null ? "—" : o.percentage}
            {o.percentage !== null && <small>%</small>}
          </div>
          <div className="kv-row" style={{ paddingBottom: 6 }}>
            <div className="kv">
              <span className="kv-label">Attended</span>
              <span className="kv-value num">{o.attended}</span>
            </div>
            <div className="kv">
              <span className="kv-label">Missed</span>
              <span className="kv-value num">{o.absent}</span>
            </div>
            <div className="kv">
              <span className="kv-label">Total</span>
              <span className="kv-value num">{o.total}</span>
            </div>
          </div>
        </div>
        <Meter value={o.percentage} threshold={t} tone={tone} size="lg" />
        <p className="row-sm secondary" style={{ alignItems: "flex-start" }}>
          <Icon aria-hidden="true" style={{ width: 16, height: 16, marginTop: 2, flex: "none", color: tone === "good" ? "var(--success-600)" : tone === "warning" ? "var(--warning-700)" : "var(--danger-600)" }} />
          <span>{message}</span>
        </p>
      </div>
    </Card>
  );
}

export default function Attendance() {
  usePageTitle("Attendance");
  const { api } = useAuth();
  const summary = useApi(() => api.get("/attendance/me/summary"), []);
  const [filters, setFilters] = useState({ subjectId: "", status: "", from: "", to: "", page: 1 });
  const history = useApi(
    () => api.get("/attendance/me/history", { query: { ...filters, pageSize: 15 } }),
    [filters.subjectId, filters.status, filters.from, filters.to, filters.page]
  );
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  const columns = [
    { key: "date", header: "Date", render: (r) => <span className="cell-primary nowrap">{formatWeekday(r.date)}</span> },
    { key: "period", header: "Period", render: (r) => <span className="num">P{r.period}</span> },
    {
      key: "subject",
      header: "Subject",
      render: (r) => (
        <div className="cell-stack">
          <span className="medium" style={{ color: "var(--text-primary)" }}>
            {r.subject.code}
          </span>
          <span className="sub">{r.subject.name}</span>
        </div>
      ),
    },
    { key: "topic", header: "Topic", render: (r) => r.topic || <span className="muted">—</span>, hideOnMobile: true },
    { key: "teacher", header: "Teacher", render: (r) => r.conductedBy?.fullName || "—", hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Attendance" description="Your attendance is updated as soon as a teacher records a class. Late arrivals count as present." />

      {summary.initialLoading && (
        <div className="grid grid-aside-main" style={{ marginBottom: 20 }}>
          <Skeleton height={260} radius={10} />
          <Skeleton height={260} radius={10} />
        </div>
      )}
      {summary.error && !summary.data && (
        <Card>
          <ErrorState error={summary.error} onRetry={summary.refetch} />
        </Card>
      )}
      {summary.data && (
        <div className="grid grid-aside-main" style={{ alignItems: "start", marginBottom: 20 }}>
          <OverallCard summary={summary.data} />
          <Card title="By subject" subtitle="The dark tick on each bar marks the required percentage">
            {summary.data.subjects.length === 0 ? (
              <EmptyState compact icon={CalendarCheck} title="No subjects yet" />
            ) : (
              <div className="grid grid-2" style={{ gap: "20px 28px" }}>
                {summary.data.subjects.map((s) => (
                  <div key={s.subject.id} className="stack-sm">
                    <AttendanceMeter label={`${s.subject.code} · ${s.subject.name}`} stats={s} threshold={summary.data.threshold} />
                    {s.staff.length > 0 && <span className="text-xs muted">{s.staff.join(", ")}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Card flush title="Attendance history" subtitle="Every class recorded for you, newest first" refreshing={history.loading && !history.initialLoading}>
        <div className="toolbar" style={{ marginTop: 16 }}>
          <Select aria-label="Subject" value={filters.subjectId} onChange={(e) => update({ subjectId: e.target.value })}>
            <option value="">All subjects</option>
            {summary.data?.subjects.map((s) => (
              <option key={s.subject.id} value={s.subject.id}>
                {s.subject.code} — {s.subject.name}
              </option>
            ))}
          </Select>
          <SegmentedControl
            label="Status"
            value={filters.status}
            onChange={(v) => update({ status: v })}
            options={[
              { value: "", label: "All" },
              { value: "PRESENT", label: "Present" },
              { value: "LATE", label: "Late" },
              { value: "ABSENT", label: "Absent" },
            ]}
          />
          <div className="row-sm">
            <Input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
            <span className="muted text-sm">to</span>
            <Input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={history.data?.items}
          loading={history.loading}
          error={history.error}
          onRetry={history.refetch}
          empty={{ icon: CalendarCheck, title: "No classes match these filters", description: "Try a different subject, status or date range." }}
        />
        {history.data && <Pagination pagination={history.data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="classes" />}
      </Card>
      {summary.data && summary.data.overall.total > 0 && (
        <p className="text-sm muted mt-4">
          Overall {formatPercent(summary.data.overall.percentage)} · {summary.data.overall.attended} attended of {summary.data.overall.total} recorded classes.
        </p>
      )}
    </>
  );
}
