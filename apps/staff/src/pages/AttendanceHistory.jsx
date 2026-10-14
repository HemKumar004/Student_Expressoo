import { useState } from "react";
import { History, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  Select,
  useApi,
  useAuth,
  useConfirm,
  usePageTitle,
  useToast,
  formatPercent,
  formatWeekday,
} from "@expressoo/shared";
import { useAssignments, assignmentLabel } from "../lib/useAssignments.js";

export default function AttendanceHistory() {
  usePageTitle("Attendance history");
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const assignments = useAssignments();
  const [filters, setFilters] = useState({ assignmentId: "", from: "", to: "", page: 1 });
  const selected = assignments.items.find((a) => String(a.id) === filters.assignmentId);
  const { data, error, loading, refetch } = useApi(
    () =>
      api.get("/attendance/sessions", {
        query: { page: filters.page, pageSize: 20, sectionId: selected?.section.id, subjectId: selected?.subject.id, from: filters.from || undefined, to: filters.to || undefined },
      }),
    [filters.page, selected?.id, filters.from, filters.to]
  );
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const assignmentFor = (s) => assignments.items.find((a) => a.section.id === s.section.id && a.subject.id === s.subject.id);

  const remove = async (s) => {
    const ok = await confirm({
      title: "Delete this attendance record?",
      message: `${s.subject.code} · ${s.section.label} on ${formatWeekday(s.date)}, period ${s.period}. All ${s.counts.total} student marks for this class will be removed.`,
      confirmLabel: "Delete record",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.del(`/attendance/sessions/${s.id}`);
      toast.success("Attendance record deleted");
      refetch();
    } catch (err) {
      toast.fromError(err, "Couldn't delete the record");
    }
  };

  const columns = [
    { key: "date", header: "Date", render: (s) => <span className="cell-primary nowrap">{formatWeekday(s.date)}</span> },
    { key: "period", header: "Period", render: (s) => <span className="num">P{s.period}</span> },
    {
      key: "class",
      header: "Class",
      render: (s) => (
        <div className="cell-stack">
          <span className="medium" style={{ color: "var(--text-primary)" }}>
            {s.subject.code} · {s.section.label}
          </span>
          {s.topic && <span className="sub truncate" style={{ maxWidth: 260 }}>{s.topic}</span>}
        </div>
      ),
    },
    {
      key: "counts",
      header: "Present / Late / Absent",
      render: (s) => (
        <span className="num nowrap">
          <span className="text-success semibold">{s.counts.present}</span> / <span className="text-warning semibold">{s.counts.late}</span> / <span className="text-danger semibold">{s.counts.absent}</span>
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "percentage", header: "Attendance", align: "right", render: (s) => <span className="num semibold">{formatPercent(s.percentage)}</span> },
    { key: "recordedBy", header: "Recorded by", render: (s) => s.recordedBy?.fullName, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "cell-actions",
      render: (s) => {
        const a = assignmentFor(s);
        return s.editable && a ? (
          <div className="row-sm" style={{ justifyContent: "flex-end" }}>
            <Button variant="secondary" size="sm" icon={Pencil} to={`/attendance?assignment=${a.id}&date=${s.date}&period=${s.period}`}>
              <span className="hide-mobile">Edit</span>
            </Button>
            <IconButton icon={Trash2} label="Delete record" size="sm" variant="danger" onClick={() => remove(s)} />
          </div>
        ) : (
          <span className="text-xs muted">Locked</span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Attendance history" description="Classes you've recorded. Records can be corrected within the edit window; older records are locked and can only be changed by an administrator." actions={<Button to="/attendance">Mark attendance</Button>} />
      <Card flush refreshing={loading && Boolean(data)}>
        <div className="toolbar">
          <Select aria-label="Class" value={filters.assignmentId} onChange={(e) => update({ assignmentId: e.target.value })}>
            <option value="">All my classes</option>
            {assignments.items.map((a) => (
              <option key={a.id} value={a.id}>
                {assignmentLabel(a)}
              </option>
            ))}
          </Select>
          <div className="row-sm">
            <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
            <span className="muted text-sm">to</span>
            <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
          </div>
        </div>
        <DataTable columns={columns} rows={data?.items} loading={loading} error={error} onRetry={refetch} empty={{ icon: History, title: "No attendance recorded", description: "Classes you mark will be listed here." }} />
        {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="classes" />}
      </Card>
    </>
  );
}
