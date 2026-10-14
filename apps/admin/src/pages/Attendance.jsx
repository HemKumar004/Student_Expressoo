import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, Clock, History, Pencil, Trash2, TriangleAlert, Users, X } from "lucide-react";
import {
  Button,
  Card,
  ChartCard,
  DataTable,
  ErrorState,
  IconButton,
  Input,
  LineChart,
  Meter,
  Modal,
  PageHeader,
  Pagination,
  PersonCell,
  Select,
  SkeletonRows,
  StatCard,
  StatusBadge,
  Tabs,
  useApi,
  useAuth,
  useConfirm,
  usePageTitle,
  useToast,
  formatDate,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatWeekday,
  todayISO,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

const STATUS_BUTTONS = [
  { value: "PRESENT", label: "Present", icon: Check, cls: "is-present" },
  { value: "LATE", label: "Late", icon: Clock, cls: "is-late" },
  { value: "ABSENT", label: "Absent", icon: X, cls: "is-absent" },
];

/** Administrators can correct any recorded class, including those outside the staff edit window. */
function CorrectionModal({ session, onClose, onSaved, api }) {
  const toast = useToast();
  const roster = useApi(() => api.get("/attendance/roster", { query: { sectionId: session.section.id, subjectId: session.subject.id, date: session.date, period: session.period } }), [session.id]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (roster.data) setMarks(Object.fromEntries(roster.data.students.map((s) => [s.studentId, s.status || "PRESENT"])));
  }, [roster.data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/attendance/sessions", {
        sectionId: session.section.id,
        subjectId: session.subject.id,
        date: session.date,
        period: session.period,
        topic: roster.data.session?.topic || null,
        records: roster.data.students.map((s) => ({ studentId: s.studentId, status: marks[s.studentId] })),
      });
      toast.success("Attendance corrected", `${session.subject.code} · ${session.section.label} · ${formatDate(session.date)} P${session.period}`);
      onSaved();
    } catch (err) {
      toast.fromError(err, "Correction failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      size="lg"
      title={`Correct attendance · ${session.subject.code} · ${session.section.label}`}
      description={`${formatWeekday(session.date)} · Period ${session.period} · recorded by ${session.recordedBy?.fullName}. Corrections are written to the audit log.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!roster.data}>
            Save correction
          </Button>
        </>
      }
    >
      {roster.initialLoading && <SkeletonRows rows={6} />}
      {roster.error && <ErrorState error={roster.error} onRetry={roster.refetch} compact />}
      {roster.data && (
        <ul className="list" style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
          {roster.data.students.map((s) => (
            <li key={s.studentId} className="list-item" style={{ alignItems: "center", padding: "8px 14px" }}>
              <div className="grow">
                <p className="list-title truncate">{s.fullName}</p>
                <p className="list-meta mono">{s.rollNumber}</p>
              </div>
              <div className="status-toggle" role="radiogroup" aria-label={`Attendance for ${s.fullName}`}>
                {STATUS_BUTTONS.map((b) => (
                  <button key={b.value} type="button" role="radio" aria-checked={marks[s.studentId] === b.value} aria-pressed={marks[s.studentId] === b.value} className={b.cls} onClick={() => setMarks((m) => ({ ...m, [s.studentId]: b.value }))}>
                    <b.icon aria-hidden="true" />
                    <span className="label-text">{b.label}</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Overview({ filters }) {
  const { api } = useAuth();
  const { data, error, loading, initialLoading, refetch } = useApi(() => api.get("/attendance/overview", { query: filters }), [filters.from, filters.to, filters.courseId, filters.sectionId]);
  if (error && !data) return <Card><ErrorState error={error} onRetry={refetch} /></Card>;
  const daily = (data?.daily || []).map((d) => ({ key: d.date, label: formatShortDate(d.date), value: d.percentage, detail: `${formatDate(d.date)} · ${formatNumber(d.total)} marks` }));
  const t = data?.threshold ?? 75;
  return (
    <div className="stack-lg" style={{ opacity: loading && !initialLoading ? 0.6 : 1, transition: "opacity 180ms" }}>
      <div className="grid grid-4">
        <StatCard label="Overall attendance" icon={CalendarCheck} loading={!data} value={formatPercent(data?.overall.percentage)} sub={data && `${formatNumber(data.overall.attended)} of ${formatNumber(data.overall.total)} marks`} />
        <StatCard label="Classes recorded" icon={History} tone="neutral" loading={!data} value={data && formatNumber(data.sections.reduce((s, x) => s + x.sessions, 0))} sub={data && `${formatDate(data.range.from)} – ${formatDate(data.range.to)}`} />
        <StatCard label="Sections reporting" icon={Users} tone="neutral" loading={!data} value={data?.sections.length} sub="With at least one class recorded" />
        <StatCard label={`Below ${t}%`} icon={TriangleAlert} tone={data?.lowAttendance.length ? "danger" : "neutral"} loading={!data} value={data?.lowAttendance.length} sub="Students under the requirement" />
      </div>
      <ChartCard
        title="Daily attendance"
        subtitle="Across the selected scope"
        tableColumns={[{ key: "label", header: "Date" }, { key: "value", header: "Attendance", align: "right", render: (r) => formatPercent(r.value) }, { key: "detail", header: "Detail" }]}
        tableRows={daily}
      >
        <LineChart data={daily} domain={[0, 100]} format={(v) => `${Math.round(v)}%`} threshold={{ value: t, label: `${t}% required` }} ariaLabel="Daily attendance" refreshing={loading && !initialLoading} />
      </ChartCard>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card flush title="By section">
          <div style={{ height: 12 }} />
          <DataTable
            rows={data?.sections}
            loading={initialLoading}
            rowKey={(r) => r.section?.id}
            defaultSort={{ key: "percentage", dir: "asc" }}
            empty={{ icon: CalendarCheck, title: "No attendance in this range" }}
            columns={[
              { key: "section", header: "Section", sortable: true, sortValue: (r) => r.section?.label, render: (r) => <span className="cell-primary">{r.section?.label}</span> },
              { key: "sessions", header: "Classes", align: "right", sortable: true, render: (r) => <span className="num">{r.sessions}</span> },
              { key: "percentage", header: "Attendance", sortable: true, render: (r) => <div style={{ minWidth: 150 }}><Meter value={r.percentage} valueLabel={formatPercent(r.percentage)} threshold={t} tone={r.standing === "none" ? "good" : r.standing} /></div> },
            ]}
          />
        </Card>
        <Card flush title="Students below the requirement" subtitle="Lowest attendance first">
          <div style={{ height: 12 }} />
          <DataTable
            rows={data?.lowAttendance}
            loading={initialLoading}
            rowKey="studentId"
            empty={{ icon: CalendarCheck, title: "Everyone is above the requirement" }}
            columns={[
              { key: "student", header: "Student", render: (r) => <PersonCell name={r.fullName} sub={`${r.rollNumber} · ${r.section?.label}`} /> },
              { key: "percentage", header: "Attendance", align: "right", render: (r) => <span className="num semibold text-danger">{formatPercent(r.percentage)}</span> },
              { key: "needed", header: "Needs", align: "right", hideOnMobile: true, render: (r) => <span className="num">{r.needed} classes</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function Sessions({ filters }) {
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  useEffect(() => setPage(1), [filters]);
  const { data, error, loading, refetch } = useApi(() => api.get("/attendance/sessions", { query: { ...filters, courseId: undefined, page, pageSize: 20 } }), [filters.from, filters.to, filters.sectionId, page]);

  const remove = async (s) => {
    if (!(await confirm({ title: "Delete this attendance record?", message: `${s.subject.code} · ${s.section.label} · ${formatDate(s.date)} P${s.period}. All ${s.counts.total} marks will be removed.`, confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await api.del(`/attendance/sessions/${s.id}`);
      toast.success("Attendance record deleted");
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <Card flush refreshing={loading && Boolean(data)} title="Recorded classes" subtitle="Administrators can correct any record; changes are audited">
      <div style={{ height: 12 }} />
      <DataTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        empty={{ icon: History, title: "No classes recorded in this range" }}
        columns={[
          { key: "date", header: "Date", render: (s) => <span className="cell-primary nowrap">{formatWeekday(s.date)}</span> },
          { key: "period", header: "Period", render: (s) => `P${s.period}` },
          { key: "class", header: "Class", render: (s) => <div className="cell-stack"><span className="medium" style={{ color: "var(--text-primary)" }}>{s.subject.code} · {s.section.label}</span><span className="sub">{s.conductedBy?.fullName || "—"}</span></div> },
          { key: "counts", header: "P / L / A", hideOnMobile: true, render: (s) => <span className="num"><span className="text-success">{s.counts.present}</span> / <span className="text-warning">{s.counts.late}</span> / <span className="text-danger">{s.counts.absent}</span></span> },
          { key: "percentage", header: "Attendance", align: "right", render: (s) => <span className="num semibold">{formatPercent(s.percentage)}</span> },
          { key: "recordedBy", header: "Recorded by", hideOnMobile: true, render: (s) => s.recordedBy?.fullName },
          { key: "actions", header: <span className="sr-only">Actions</span>, className: "cell-actions", render: (s) => <div className="row-sm" style={{ justifyContent: "flex-end" }}><IconButton icon={Pencil} size="sm" label="Correct attendance" onClick={() => setEditing(s)} /><IconButton icon={Trash2} size="sm" variant="danger" label="Delete record" onClick={() => remove(s)} /></div> },
        ]}
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="classes" />}
      {editing && <CorrectionModal session={editing} api={api} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </Card>
  );
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

export default function Attendance() {
  usePageTitle("Attendance");
  const ref = useReference();
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("30");
  const [custom, setCustom] = useState({ from: todayISO(-29), to: todayISO() });
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const filters = useMemo(() => {
    const from = range === "custom" ? custom.from : todayISO(-(Number(range) - 1));
    const to = range === "custom" ? custom.to : todayISO();
    return { from, to, courseId: courseId || undefined, sectionId: sectionId || undefined };
  }, [range, custom, courseId, sectionId]);

  const sections = courseId ? ref.sections.filter((s) => String(s.courseId) === courseId) : ref.sections;

  return (
    <>
      <PageHeader title="Attendance" description="Institution-wide attendance, the students who need attention, and corrections to recorded classes." />
      <div className="toolbar" style={{ padding: 0, border: 0, marginBottom: 16 }}>
        <Select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {range === "custom" && (
          <div className="row-sm">
            <Input type="date" aria-label="From" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span className="muted text-sm">to</span>
            <Input type="date" aria-label="To" value={custom.to} min={custom.from} max={todayISO()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
        <Select aria-label="Course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setSectionId(""); }}>
          <option value="">All courses</option>
          {ref.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
        <Select aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">All sections</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "sessions", label: "Recorded classes" }]} />
      <div style={{ marginTop: 20 }}>{tab === "overview" ? <Overview filters={filters} /> : <Sessions filters={filters} />}</div>
      <p className="text-sm muted mt-4"><StatusBadge status="LATE" /> counts as present in every percentage.</p>
    </>
  );
}
