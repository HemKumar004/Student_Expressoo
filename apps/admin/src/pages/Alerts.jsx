import { useState } from "react";
import { CircleCheck, PhoneCall, Siren } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  useApi,
  useAuth,
  usePageTitle,
  useToast,
  formatDateTime,
  formatRelative,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

export default function Alerts() {
  usePageTitle("Teacher alerts");
  const { api } = useAuth();
  const toast = useToast();
  const { sections } = useReference();
  const [filters, setFilters] = useState({ status: "", sectionId: "", page: 1 });
  const { data, error, loading, refetch } = useApi(() => api.get("/teacher-alerts", { query: { ...filters, pageSize: 20 } }), [filters]);
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  const act = async (a, action) => {
    try {
      await api.patch(`/teacher-alerts/${a.id}/${action}`, action === "acknowledge" ? { responseNote: "Acknowledged by the administration." } : undefined);
      toast.success(action === "acknowledge" ? "Alert acknowledged" : "Alert resolved");
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <>
      <PageHeader title="Teacher alerts" description="Alerts raised by class and ladies representatives when a teacher hasn't arrived. Use this to follow up on repeated or unanswered alerts." />
      <Card flush refreshing={loading && Boolean(data)} subtitle={data ? `${data.openCount} open` : undefined} title="All alerts">
        <div className="toolbar" style={{ marginTop: 16 }}>
          <Select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Any status</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          <Select aria-label="Section" value={filters.sectionId} onChange={(e) => update({ sectionId: e.target.value })}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </div>
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={refetch}
          empty={{ icon: Siren, title: "No alerts", description: "Alerts raised from the Student Portal's representative desk appear here." }}
          columns={[
            { key: "when", header: "Raised", render: (a) => <div className="cell-stack"><span className="cell-primary nowrap" title={formatDateTime(a.createdAt)}>{formatRelative(a.createdAt)}</span><span className="sub">Period {a.period}</span></div> },
            { key: "section", header: "Class", render: (a) => <div className="cell-stack"><span className="medium" style={{ color: "var(--text-primary)" }}>{a.section.label}</span>{a.subject && <span className="sub">{a.subject.code}</span>}</div> },
            { key: "teacher", header: "Teacher", render: (a) => <div className="cell-stack"><span>{a.staff.fullName}</span><span className="sub mono">{a.staff.employeeId}</span></div> },
            { key: "raisedBy", header: "Raised by", hideOnMobile: true, render: (a) => <span className="row-sm">{a.raisedBy.fullName}{a.raisedBy.representativeRole && <Badge tone="primary">{a.raisedBy.representativeRole}</Badge>}</span> },
            { key: "response", header: "Response", hideOnMobile: true, render: (a) => a.responseNote ? <span className="secondary">{a.responseNote}</span> : <span className="muted">—</span> },
            { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "cell-actions",
              render: (a) => (
                <div className="row-sm" style={{ justifyContent: "flex-end" }}>
                  {a.status === "OPEN" && a.staff.mobile && <Button href={`tel:${a.staff.mobile}`} size="sm" variant="secondary" icon={PhoneCall} aria-label={`Call ${a.staff.fullName}`} />}
                  {a.canAcknowledge && <Button size="sm" variant="secondary" onClick={() => act(a, "acknowledge")}>Acknowledge</Button>}
                  {a.canResolve && <Button size="sm" variant="ghost" icon={CircleCheck} onClick={() => act(a, "resolve")}>Resolve</Button>}
                </div>
              ),
            },
          ]}
        />
        {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="alerts" />}
      </Card>
    </>
  );
}
