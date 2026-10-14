import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck, ClipboardCheck, FileDown, TriangleAlert, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  Meter,
  NotFoundPage,
  PageHeader,
  PersonCell,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatCard,
  StatusBadge,
  useApi,
  useAuth,
  usePageTitle,
  downloadCsv,
  formatDate,
  formatPercent,
} from "@expressoo/shared";
import { useAssignments } from "../lib/useAssignments.js";

export default function ClassDetail() {
  const { assignmentId } = useParams();
  const { api } = useAuth();
  const assignments = useAssignments();
  const assignment = assignments.items.find((a) => String(a.id) === assignmentId);
  usePageTitle(assignment ? `${assignment.subject.code} · ${assignment.section.label}` : "Class");
  const stats = useApi(() => api.get("/attendance/class-stats", { query: { sectionId: assignment.section.id, subjectId: assignment.subject.id } }), [assignment?.id], {
    enabled: Boolean(assignment),
  });
  const [search, setSearch] = useState("");
  const [standing, setStanding] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stats.data?.students || []).filter(
      (s) => (!q || s.fullName.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)) && (!standing || (standing === "below" ? s.standing === "critical" || s.standing === "warning" : s.standing === standing))
    );
  }, [stats.data, search, standing]);

  if (!assignments.loading && !assignment) return <NotFoundPage inline homeTo="/classes" />;

  const d = stats.data;
  const threshold = d?.threshold ?? 75;
  const columns = [
    { key: "rollNumber", header: "Roll no.", sortable: true, render: (s) => <span className="mono">{s.rollNumber}</span> },
    {
      key: "fullName",
      header: "Student",
      sortable: true,
      render: (s) => (
        <div className="row-sm">
          <PersonCell name={s.fullName} sub={s.email} />
          {s.representativeRole !== "NONE" && <Badge tone="primary">{s.representativeRole}</Badge>}
        </div>
      ),
    },
    { key: "attended", header: "Attended", align: "right", sortable: true, render: (s) => <span className="num">{s.total ? `${s.attended}/${s.total}` : "—"}</span>, hideOnMobile: true },
    {
      key: "percentage",
      header: "Attendance",
      sortable: true,
      sortValue: (s) => s.percentage ?? -1,
      render: (s) => (
        <div style={{ minWidth: 160 }}>
          <Meter value={s.percentage} valueLabel={formatPercent(s.percentage)} threshold={threshold} tone={s.standing === "none" ? "good" : s.standing} />
        </div>
      ),
    },
    { key: "standing", header: "Standing", render: (s) => <StatusBadge status={s.standing} />, hideOnMobile: true },
  ];

  const exportCsv = () =>
    downloadCsv(`${assignment.subject.code}_${assignment.section.label.replace(/\s+/g, "")}_attendance.csv`, [
      { header: "Roll number", value: "rollNumber" },
      { header: "Name", value: "fullName" },
      { header: "Classes attended", value: "attended" },
      { header: "Classes held", value: "total" },
      { header: "Attendance %", value: (s) => s.percentage ?? "" },
      { header: "Classes needed to reach threshold", value: "needed" },
    ], d.students);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "My classes", to: "/classes" }, { label: assignment ? `${assignment.subject.code} · ${assignment.section.label}` : "…" }]}
        title={assignment ? `${assignment.subject.name}` : "Loading…"}
        description={assignment && `${assignment.subject.code} · ${assignment.section.label} · ${assignment.section.course?.name || ""}`}
        actions={
          assignment && (
            <>
              <Button variant="secondary" icon={FileDown} onClick={exportCsv} disabled={!d}>
                Export CSV
              </Button>
              <Button icon={ClipboardCheck} to={`/attendance?assignment=${assignment.id}`}>
                Mark attendance
              </Button>
            </>
          )
        }
      />
      {stats.error && !d && (
        <Card>
          <ErrorState error={stats.error} onRetry={stats.refetch} />
        </Card>
      )}
      <div className="stack-lg">
        <div className="grid grid-4">
          <StatCard label="Students" icon={Users} loading={!d} value={d?.students.length} sub="Active in this section" />
          <StatCard label="Classes held" icon={CalendarCheck} tone="neutral" loading={!d} value={d?.sessionCount} sub={d?.lastSessionDate ? `Last on ${formatDate(d.lastSessionDate)}` : "None yet"} />
          <StatCard label="Average attendance" icon={CalendarCheck} tone="success" loading={!d} value={formatPercent(d?.averagePercentage)} sub={`Required ${threshold}%`} />
          <StatCard label="Below requirement" icon={TriangleAlert} tone={d?.belowThreshold ? "danger" : "neutral"} loading={!d} value={d?.belowThreshold} sub="Students under the threshold" />
        </div>
        <Card flush title="Students" subtitle="Attendance in this subject only">
          <div className="toolbar" style={{ marginTop: 16 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or roll number" label="Search students" />
            <SegmentedControl
              label="Standing"
              value={standing}
              onChange={setStanding}
              options={[
                { value: "", label: "All" },
                { value: "below", label: "Below requirement" },
                { value: "good", label: "On track" },
              ]}
            />
          </div>
          {!d && !stats.error ? (
            <div style={{ padding: 24 }}>
              <SkeletonRows rows={6} />
            </div>
          ) : (
            <DataTable columns={columns} rows={rows} rowKey="studentId" defaultSort={{ key: "rollNumber", dir: "asc" }} empty={{ icon: Users, title: "No students match these filters" }} />
          )}
        </Card>
      </div>
    </>
  );
}
