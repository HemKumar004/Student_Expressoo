import { useMemo, useState } from "react";
import { CalendarCheck, FileDown, TriangleAlert, Users, Wallet } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Meter,
  PageHeader,
  PersonCell,
  Select,
  SplitMeter,
  StatCard,
  StatusBadge,
  Tabs,
  useApi,
  useAuth,
  usePageTitle,
  downloadCsv,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  todayISO,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

function AttendanceReport() {
  const { api } = useAuth();
  const { sections, subjects } = useReference();
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [from, setFrom] = useState(todayISO(-89));
  const [to, setTo] = useState(todayISO());
  const section = sections.find((s) => String(s.id) === sectionId);
  const subjectOptions = useMemo(() => (section ? subjects.filter((s) => s.courseId === section.courseId && s.yearOfStudy === section.yearOfStudy) : []), [section, subjects]);
  const report = useApi(() => api.get("/reports/attendance", { query: { sectionId, subjectId: subjectId || undefined, from, to } }), [sectionId, subjectId, from, to], { enabled: Boolean(sectionId) });
  const d = report.data;

  const exportCsv = () =>
    downloadCsv(
      `attendance_${d.section.label.replace(/\s+/g, "")}${d.subject ? `_${d.subject.code}` : ""}_${d.range.from}_${d.range.to}.csv`,
      [
        { header: "Roll number", value: "rollNumber" },
        { header: "Name", value: "fullName" },
        { header: "Account status", value: "status" },
        { header: "Classes attended (incl. late)", value: "attended" },
        { header: "Late", value: "late" },
        { header: "Classes held", value: "total" },
        { header: "Attendance %", value: (r) => r.percentage ?? "" },
        { header: "Classes needed to reach threshold", value: "needed" },
      ],
      d.rows
    );

  return (
    <div className="stack-lg">
      <Card title="Attendance report" subtitle="Per-student attendance for a section, optionally for one subject">
        <div className="toolbar" style={{ padding: 0, border: 0 }}>
          <Select aria-label="Section" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setSubjectId(""); }}>
            <option value="">Choose a section…</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.course?.name}</option>)}
          </Select>
          <Select aria-label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!section}>
            <option value="">All subjects</option>
            {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </Select>
          <div className="row-sm">
            <Input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span className="muted text-sm">to</span>
            <Input type="date" aria-label="To" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="secondary" icon={FileDown} onClick={exportCsv} disabled={!d}>Export CSV</Button>
        </div>
      </Card>
      {!sectionId && <Card><EmptyState icon={CalendarCheck} title="Choose a section to generate the report" /></Card>}
      {sectionId && report.error && <Card><ErrorState error={report.error} onRetry={report.refetch} /></Card>}
      {sectionId && !report.error && (
        <>
          <div className="grid grid-4">
            <StatCard label="Students" icon={Users} loading={!d} value={d?.summary.students} sub={d && d.section.label} />
            <StatCard label="Classes held" icon={CalendarCheck} tone="neutral" loading={!d} value={d?.sessions} sub={d && `${formatDate(d.range.from)} – ${formatDate(d.range.to)}`} />
            <StatCard label="Average attendance" icon={CalendarCheck} tone="success" loading={!d} value={formatPercent(d?.summary.average)} sub={d && (d.subject ? d.subject.code : "All subjects")} />
            <StatCard label={`Below ${d?.threshold ?? 75}%`} icon={TriangleAlert} tone={d?.summary.belowThreshold ? "danger" : "neutral"} loading={!d} value={d?.summary.belowThreshold} sub="Students needing attention" />
          </div>
          <Card flush title="Students" refreshing={report.loading && Boolean(d)}>
            <div style={{ height: 12 }} />
            <DataTable
              rows={d?.rows}
              loading={report.loading && !d}
              rowKey="studentId"
              defaultSort={{ key: "rollNumber", dir: "asc" }}
              empty={{ icon: Users, title: "No students in this section" }}
              columns={[
                { key: "rollNumber", header: "Roll no.", sortable: true, render: (r) => <span className="mono">{r.rollNumber}</span> },
                { key: "fullName", header: "Student", sortable: true, render: (r) => <div className="row-sm"><PersonCell name={r.fullName} />{r.status !== "ACTIVE" && <StatusBadge status={r.status} />}</div> },
                { key: "attended", header: "Attended", align: "right", sortable: true, render: (r) => <span className="num">{r.total ? `${r.attended}/${r.total}` : "—"}</span> },
                { key: "percentage", header: "Attendance", sortable: true, sortValue: (r) => r.percentage ?? -1, render: (r) => <div style={{ minWidth: 160 }}><Meter value={r.percentage} valueLabel={formatPercent(r.percentage)} threshold={d.threshold} tone={r.standing === "none" ? "good" : r.standing} /></div> },
                { key: "needed", header: "Needs", align: "right", sortable: true, hideOnMobile: true, render: (r) => (r.needed ? <span className="num text-danger semibold">{r.needed} classes</span> : <span className="muted">—</span>) },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function FeeReport() {
  const { api } = useAuth();
  const { courses } = useReference();
  const [courseId, setCourseId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const structures = useApi(() => api.get("/fees/structures"), []);
  const years = [...new Set((structures.data?.items || []).map((s) => s.academicYear))];
  const report = useApi(() => api.get("/reports/fees", { query: { courseId: courseId || undefined, academicYear: academicYear || undefined } }), [courseId, academicYear]);
  const d = report.data;

  const exportSections = () =>
    downloadCsv("fee_collection_by_section.csv", [
      { header: "Section", value: (r) => r.section?.label },
      { header: "Students billed", value: "students" },
      { header: "Billed (INR)", value: "billed" },
      { header: "Collected (INR)", value: "collected" },
      { header: "Outstanding (INR)", value: "outstanding" },
      { header: "Collection rate %", value: (r) => r.collectionRate ?? "" },
      { header: "Overdue items", value: "overdueRecords" },
    ], d.sections);
  const exportDefaulters = () =>
    downloadCsv("fee_defaulters.csv", [
      { header: "Roll number", value: "rollNumber" },
      { header: "Name", value: "fullName" },
      { header: "Section", value: (r) => r.section?.label },
      { header: "Mobile", value: "mobile" },
      { header: "Overdue balance (INR)", value: "balance" },
      { header: "Oldest due date", value: "oldestDue" },
    ], d.defaulters);

  return (
    <div className="stack-lg">
      <Card title="Fee collection report" subtitle="Billing and collection by section, with overdue accounts">
        <div className="toolbar" style={{ padding: 0, border: 0 }}>
          <Select aria-label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </Select>
          <Select aria-label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            <option value="">All academic years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </Card>
      {report.error && !d ? (
        <Card><ErrorState error={report.error} onRetry={report.refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-4">
            <StatCard label="Billed" icon={Wallet} tone="neutral" loading={!d} value={d && formatCurrency(d.summary.billed, { whole: true })} sub="After concessions" />
            <StatCard label="Collected" icon={Wallet} tone="success" loading={!d} value={d && formatCurrency(d.summary.collected, { whole: true })} sub={d && `${formatPercent(d.summary.collectionRate)} collection rate`} />
            <StatCard label="Outstanding" icon={Wallet} tone="warning" loading={!d} value={d && formatCurrency(d.summary.outstanding, { whole: true })} sub="Not yet paid" />
            <StatCard label="Students overdue" icon={TriangleAlert} tone={d?.summary.defaulters ? "danger" : "neutral"} loading={!d} value={d?.summary.defaulters} sub="With a balance past its due date" />
          </div>
          {d && Number(d.summary.billed) > 0 && (
            <Card title="Collection progress">
              <SplitMeter ariaLabel="Collected versus outstanding" format={(v) => formatCurrency(v, { compact: true, whole: true })} segments={[{ label: "Collected", value: Number(d.summary.collected), color: "var(--chart-series-1)" }, { label: "Outstanding", value: Math.max(0, Number(d.summary.outstanding)), color: "var(--gray-300)" }]} />
            </Card>
          )}
          <Card flush title="By section" actions={<Button size="sm" variant="secondary" icon={FileDown} onClick={exportSections} disabled={!d?.sections.length}>CSV</Button>} refreshing={report.loading && Boolean(d)}>
            <div style={{ height: 12 }} />
            <DataTable
              rows={d?.sections}
              loading={!d}
              rowKey={(r) => r.section?.id}
              defaultSort={{ key: "rate", dir: "asc" }}
              empty={{ icon: Wallet, title: "No fees billed for this selection" }}
              columns={[
                { key: "section", header: "Section", sortable: true, sortValue: (r) => r.section?.label, render: (r) => <span className="cell-primary">{r.section?.label}</span> },
                { key: "students", header: "Students", align: "right", hideOnMobile: true },
                { key: "billed", header: "Billed", align: "right", sortable: true, sortValue: (r) => Number(r.billed), render: (r) => <span className="num">{formatCurrency(r.billed, { whole: true })}</span>, hideOnMobile: true },
                { key: "collected", header: "Collected", align: "right", sortable: true, sortValue: (r) => Number(r.collected), render: (r) => <span className="num">{formatCurrency(r.collected, { whole: true })}</span> },
                { key: "outstanding", header: "Outstanding", align: "right", sortable: true, sortValue: (r) => Number(r.outstanding), render: (r) => <span className="num semibold">{formatCurrency(r.outstanding, { whole: true })}</span> },
                { key: "rate", header: "Rate", sortable: true, sortValue: (r) => r.collectionRate ?? -1, render: (r) => <div style={{ minWidth: 120 }}><Meter value={r.collectionRate} valueLabel={formatPercent(r.collectionRate)} tone={r.collectionRate >= 75 ? "good" : r.collectionRate >= 50 ? "warning" : "critical"} /></div> },
                { key: "overdueRecords", header: "Overdue", align: "right", hideOnMobile: true, render: (r) => <span className={r.overdueRecords ? "num text-danger semibold" : "num muted"}>{r.overdueRecords}</span> },
              ]}
            />
          </Card>
          <Card flush title="Overdue accounts" subtitle="Highest overdue balance first" actions={<Button size="sm" variant="secondary" icon={FileDown} onClick={exportDefaulters} disabled={!d?.defaulters.length}>CSV</Button>}>
            <div style={{ height: 12 }} />
            <DataTable
              rows={d?.defaulters}
              loading={!d}
              rowKey="studentId"
              empty={{ icon: Wallet, title: "No overdue balances" }}
              columns={[
                { key: "student", header: "Student", render: (r) => <PersonCell name={r.fullName} sub={`${r.rollNumber} · ${r.section?.label}`} /> },
                { key: "mobile", header: "Mobile", hideOnMobile: true, render: (r) => r.mobile || "—" },
                { key: "oldestDue", header: "Oldest due", render: (r) => formatDate(r.oldestDue), hideOnMobile: true },
                { key: "records", header: "Items", align: "right", hideOnMobile: true, render: (r) => formatNumber(r.records) },
                { key: "balance", header: "Overdue balance", align: "right", render: (r) => <span className="num semibold text-danger">{formatCurrency(r.balance)}</span> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  usePageTitle("Reports");
  const [tab, setTab] = useState("attendance");
  return (
    <>
      <PageHeader title="Reports" description="Attendance and fee reports generated live from the database, exportable as CSV." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "attendance", label: "Attendance" }, { id: "fees", label: "Fee collection" }]} />
      <div style={{ marginTop: 20 }}>{tab === "attendance" ? <AttendanceReport /> : <FeeReport />}</div>
    </>
  );
}
