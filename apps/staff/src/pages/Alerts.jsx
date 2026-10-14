import { useEffect, useState } from "react";
import { CircleCheck, MessageSquare, Siren } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Pagination,
  SegmentedControl,
  SkeletonRows,
  StatusBadge,
  TextareaField,
  useApi,
  useAuth,
  usePageTitle,
  useToast,
  formatDateTime,
  formatRelative,
} from "@expressoo/shared";
import { notifyAlertsChanged } from "../lib/events.js";

const QUICK_REPLIES = ["On my way — 5 minutes.", "Running about 10 minutes late, please wait.", "Class is cancelled today; I'll share material.", "Please start the lab exercise; I'll join shortly."];

function AcknowledgeModal({ alert, onClose, onDone, api }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/teacher-alerts/${alert.id}/acknowledge`, { responseNote: note || null });
      toast.success("Alert acknowledged", `${alert.raisedBy.fullName} has been notified.`);
      onDone();
    } catch (err) {
      toast.fromError(err, "Couldn't acknowledge the alert");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title="Acknowledge alert"
      description={`${alert.section.label} · period ${alert.period}${alert.subject ? ` · ${alert.subject.code}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="ack-form" icon={CircleCheck} loading={saving}>
            Send acknowledgement
          </Button>
        </>
      }
    >
      <form id="ack-form" className="stack" onSubmit={submit}>
        <div className="row wrap" style={{ gap: 8 }}>
          {QUICK_REPLIES.map((q) => (
            <button key={q} type="button" className={`badge badge-lg ${note === q ? "badge-primary" : ""}`} style={{ cursor: "pointer" }} onClick={() => setNote(q)}>
              {q}
            </button>
          ))}
        </div>
        <TextareaField label="Reply to the class" value={note} onChange={(e) => setNote(e.target.value)} optional rows={3} maxLength={300} placeholder="Let the class know what to expect" />
      </form>
    </Modal>
  );
}

export default function Alerts() {
  usePageTitle("Teacher alerts");
  const { api } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [acknowledging, setAcknowledging] = useState(null);
  const [resolving, setResolving] = useState(null);
  const { data, error, initialLoading, loading, refetch } = useApi(() => api.get("/teacher-alerts", { query: { page, pageSize: 10, status: status || undefined } }), [page, status]);

  useEffect(() => {
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const resolve = async (a) => {
    setResolving(a.id);
    try {
      await api.patch(`/teacher-alerts/${a.id}/resolve`);
      toast.success("Alert resolved");
      notifyAlertsChanged();
      refetch();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      <PageHeader title="Teacher alerts" description="Raised by class and ladies representatives when a class is waiting for you. Acknowledge to let them know you're on the way." />
      <Card flush refreshing={loading && !initialLoading} title="Alerts addressed to you" subtitle={data ? `${data.openCount} open · refreshes every 30 seconds` : " "}>
        <div className="toolbar" style={{ marginTop: 16 }}>
          <SegmentedControl
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "OPEN", label: "Open" },
              { value: "ACKNOWLEDGED", label: "Acknowledged" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "", label: "All" },
            ]}
          />
        </div>
        {initialLoading && (
          <div style={{ padding: 24 }}>
            <SkeletonRows rows={3} height={84} />
          </div>
        )}
        {error && !data && <ErrorState error={error} onRetry={refetch} />}
        {data?.items.length === 0 && <EmptyState icon={Siren} title={status === "OPEN" ? "No classes are waiting for you" : "No alerts"} description="When a representative raises an alert for one of your classes it appears here and in your notifications." />}
        {data?.items.length > 0 && (
          <ul className="list">
            {data.items.map((a) => (
              <li key={a.id} className="list-item" style={a.status === "OPEN" ? { background: "var(--danger-50)" } : undefined}>
                <span className="list-icon" style={{ background: a.status === "OPEN" ? "#fde2e0" : "var(--gray-100)", color: a.status === "OPEN" ? "var(--danger-700)" : "var(--gray-600)" }} aria-hidden="true">
                  <Siren />
                </span>
                <div className="grow">
                  <div className="row-between wrap" style={{ alignItems: "flex-start" }}>
                    <p className="list-title">
                      {a.section.label} · Period {a.period}
                      {a.subject && <span className="muted"> · {a.subject.code} {a.subject.name}</span>}
                    </p>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="list-meta" title={formatDateTime(a.createdAt)}>
                    {a.raisedBy.fullName} {a.raisedBy.representativeRole && <Badge tone="primary">{a.raisedBy.representativeRole}</Badge>} · {formatRelative(a.createdAt)}
                  </p>
                  {a.message && <p className="secondary mt-2">“{a.message}”</p>}
                  {a.responseNote && (
                    <p className="mt-2 row-sm text-sm" style={{ alignItems: "flex-start" }}>
                      <MessageSquare aria-hidden="true" style={{ width: 14, height: 14, marginTop: 3, flex: "none" }} />
                      <span>
                        Your reply: {a.responseNote} {a.acknowledgedAt && <span className="muted">· {formatRelative(a.acknowledgedAt)}</span>}
                      </span>
                    </p>
                  )}
                  <div className="row-sm mt-2 wrap">
                    {a.canAcknowledge && (
                      <Button size="sm" icon={CircleCheck} onClick={() => setAcknowledging(a)}>
                        Acknowledge
                      </Button>
                    )}
                    {a.canResolve && (
                      <Button variant="secondary" size="sm" loading={resolving === a.id} onClick={() => resolve(a)}>
                        Mark resolved
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="alerts" />}
      </Card>
      {acknowledging && (
        <AcknowledgeModal
          alert={acknowledging}
          api={api}
          onClose={() => setAcknowledging(null)}
          onDone={() => {
            setAcknowledging(null);
            notifyAlertsChanged();
            refetch();
          }}
        />
      )}
    </>
  );
}
