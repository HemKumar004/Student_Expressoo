import { useEffect, useMemo, useState } from "react";
import { BellRing, CircleCheck, MessageSquare, Phone, PhoneCall, Send, Siren, Clock } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  ComposeNotificationModal,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  SkeletonRows,
  StatusBadge,
  TextareaField,
  UnauthorizedPage,
  useApi,
  useAuth,
  usePageTitle,
  useToast,
  fieldErrors,
  formatDateTime,
  formatRelative,
  REP_LABELS,
} from "@expressoo/shared";

function minutesSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function AlertItem({ alert, escalationMinutes, onResolve, resolving }) {
  const age = minutesSince(alert.createdAt);
  const escalate = alert.status === "OPEN" && age >= escalationMinutes;
  return (
    <li className="list-item" style={escalate ? { background: "var(--danger-50)" } : undefined}>
      <span className="list-icon" style={{ background: alert.status === "OPEN" ? "var(--danger-50)" : alert.status === "ACKNOWLEDGED" ? "var(--warning-50)" : "var(--success-50)", color: alert.status === "OPEN" ? "var(--danger-700)" : alert.status === "ACKNOWLEDGED" ? "var(--warning-700)" : "var(--success-700)" }} aria-hidden="true">
        {alert.status === "RESOLVED" ? <CircleCheck /> : <Siren />}
      </span>
      <div className="grow">
        <div className="row-between wrap" style={{ alignItems: "flex-start" }}>
          <p className="list-title">
            {alert.staff.fullName} · Period {alert.period}
            {alert.subject && <span className="muted"> · {alert.subject.code}</span>}
          </p>
          <StatusBadge status={alert.status} />
        </div>
        <p className="list-meta" title={formatDateTime(alert.createdAt)}>
          Raised {formatRelative(alert.createdAt)} by {alert.raisedBy.fullName}
          {alert.raisedBy.representativeRole && alert.raisedBy.representativeRole !== "NONE" ? ` (${alert.raisedBy.representativeRole})` : ""}
        </p>
        {alert.message && <p className="secondary mt-2">“{alert.message}”</p>}
        {alert.responseNote && (
          <p className="mt-2 row-sm" style={{ alignItems: "flex-start" }}>
            <MessageSquare aria-hidden="true" style={{ width: 15, height: 15, marginTop: 3, color: "var(--warning-700)", flex: "none" }} />
            <span>
              <strong>{alert.staff.fullName}:</strong> {alert.responseNote}
            </span>
          </p>
        )}
        {escalate && (
          <Callout tone="danger" title={`No response for ${age} minute${age === 1 ? "" : "s"}`} className="mt-2">
            The teacher hasn't acknowledged this alert. Call them directly or inform the department office.
          </Callout>
        )}
        {alert.status !== "RESOLVED" && (
          <div className="row-sm mt-2 wrap">
            {alert.staff.mobile && (
              <Button href={`tel:${alert.staff.mobile}`} variant={escalate ? "danger" : "secondary"} size="sm" icon={PhoneCall}>
                Call {alert.staff.fullName.split(" ").slice(-1)[0]}
              </Button>
            )}
            {alert.canResolve && (
              <Button variant="ghost" size="sm" icon={CircleCheck} loading={resolving} onClick={() => onResolve(alert)}>
                Mark resolved
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function Representative() {
  usePageTitle("Representative desk");
  const { api, user } = useAuth();
  const toast = useToast();
  const rep = user.student?.representativeRole;
  const isRep = rep && rep !== "NONE";

  const [form, setForm] = useState({ staffId: "", subjectId: "", period: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [, setTick] = useState(0);

  const contacts = useApi(() => api.get("/teacher-alerts/contacts"), [], { enabled: Boolean(isRep) });
  const alerts = useApi(() => api.get("/teacher-alerts", { query: { page, pageSize: 10, status: status || undefined } }), [page, status], { enabled: Boolean(isRep) });

  // Keep alert states fresh: poll the API and re-render for escalation timing.
  useEffect(() => {
    if (!isRep) return undefined;
    const poll = setInterval(() => alerts.refetch(), 30_000);
    const tick = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRep, alerts.refetch]);

  const selected = useMemo(() => contacts.data?.contacts.find((c) => String(c.staffId) === String(form.staffId)), [contacts.data, form.staffId]);

  if (!isRep) return <UnauthorizedPage inline message="The representative desk is only available to Class Representatives and Ladies Representatives." />;

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === "staffId" && { subjectId: "" }) }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.staffId) errs.staffId = "Choose the teacher";
    if (!form.period) errs.period = "Choose the period";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    try {
      await api.post("/teacher-alerts", {
        staffId: Number(form.staffId),
        subjectId: form.subjectId ? Number(form.subjectId) : undefined,
        period: Number(form.period),
        message: form.message || undefined,
      });
      toast.success("Alert sent", `${selected?.fullName} has been notified in the Staff Portal.`);
      setForm({ staffId: "", subjectId: "", period: "", message: "" });
      setStatus("");
      setPage(1);
      alerts.refetch();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't send the alert");
    } finally {
      setSending(false);
    }
  };

  const resolve = async (a) => {
    setResolving(a.id);
    try {
      await api.patch(`/teacher-alerts/${a.id}/resolve`);
      toast.success("Alert resolved");
      alerts.refetch();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setResolving(null);
    }
  };

  const maxPeriods = contacts.data?.maxPeriods || 8;
  const escalationMinutes = alerts.data?.escalationMinutes || contacts.data?.escalationMinutes || 2;

  return (
    <>
      <PageHeader
        title={`${rep} desk`}
        description={`${REP_LABELS[rep]} tools for ${user.student.section?.label}: alert a teacher who hasn't arrived, call them if there's no response, and message your class.`}
        actions={
          <Button variant="secondary" icon={Send} onClick={() => setComposeOpen(true)}>
            Message class
          </Button>
        }
      />

      <div className="grid grid-aside-main" style={{ alignItems: "start" }}>
        <div className="stack-lg">
          <Card title="Raise a teacher alert" subtitle={`If there's no acknowledgement within ${escalationMinutes} minutes, you'll be prompted to call.`}>
            {contacts.error ? (
              <ErrorState compact error={contacts.error} onRetry={contacts.refetch} />
            ) : (
              <form className="stack" onSubmit={submit} noValidate>
                <SelectField label="Teacher" value={form.staffId} onChange={(e) => set("staffId", e.target.value)} error={errors.staffId} required disabled={contacts.loading}>
                  <option value="">{contacts.loading ? "Loading teachers…" : "Select the teacher"}</option>
                  {contacts.data?.contacts.map((c) => (
                    <option key={c.staffId} value={c.staffId}>
                      {c.fullName} — {c.subjects.map((s) => s.code).join(", ")}
                    </option>
                  ))}
                </SelectField>
                <div className="form-grid">
                  <SelectField label="Subject" value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)} error={errors.subjectId} optional disabled={!selected}>
                    <option value="">{selected ? "Any subject" : "Choose a teacher first"}</option>
                    {selected?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="Period" value={form.period} onChange={(e) => set("period", e.target.value)} error={errors.period} required>
                    <option value="">Select</option>
                    {Array.from({ length: maxPeriods }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <TextareaField label="Message" value={form.message} onChange={(e) => set("message", e.target.value)} optional rows={3} maxLength={500} placeholder="e.g. Class is waiting in room 204" />
                <Button type="submit" icon={BellRing} loading={sending} block>
                  Send alert
                </Button>
              </form>
            )}
          </Card>

          <Card flush title="Teacher contacts" subtitle="For emergencies only — please call only when an alert goes unanswered.">
            <div style={{ height: 8 }} />
            {contacts.initialLoading && (
              <div style={{ padding: 20 }}>
                <SkeletonRows rows={3} />
              </div>
            )}
            {contacts.data?.contacts.length === 0 && <EmptyState compact icon={Phone} title="No teachers assigned yet" />}
            <ul className="list">
              {contacts.data?.contacts.map((c) => (
                <li key={c.staffId} className="list-item" style={{ alignItems: "center" }}>
                  <Avatar name={c.fullName} size="sm" />
                  <div className="grow">
                    <p className="list-title truncate">{c.fullName}</p>
                    <p className="list-meta truncate">{c.subjects.map((s) => s.code).join(" · ")}</p>
                  </div>
                  {c.mobile ? (
                    <Button href={`tel:${c.mobile}`} variant="secondary" size="sm" icon={Phone} aria-label={`Call ${c.fullName}`}>
                      <span className="hide-mobile">Call</span>
                    </Button>
                  ) : (
                    <Badge>No phone</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card
          flush
          title="Alerts for your class"
          subtitle={alerts.data ? (alerts.data.openCount ? `${alerts.data.openCount} awaiting a response · refreshes every 30 seconds` : "No open alerts · refreshes every 30 seconds") : " "}
          refreshing={alerts.loading && !alerts.initialLoading}
        >
          <div className="toolbar" style={{ marginTop: 16 }}>
            <SegmentedControl
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "", label: "All" },
                { value: "OPEN", label: "Open" },
                { value: "ACKNOWLEDGED", label: "Acknowledged" },
                { value: "RESOLVED", label: "Resolved" },
              ]}
            />
            <span className="text-sm muted row-sm">
              <Clock aria-hidden="true" style={{ width: 14, height: 14 }} /> Escalates after {escalationMinutes} min
            </span>
          </div>
          {alerts.initialLoading && (
            <div style={{ padding: 20 }}>
              <SkeletonRows rows={3} height={80} />
            </div>
          )}
          {alerts.error && !alerts.data && <ErrorState error={alerts.error} onRetry={alerts.refetch} />}
          {alerts.data?.items.length === 0 && <EmptyState icon={Siren} title="No alerts" description="Alerts you or your co-representative raise will appear here with the teacher's response." />}
          {alerts.data?.items.length > 0 && (
            <ul className="list">
              {alerts.data.items.map((a) => (
                <AlertItem key={a.id} alert={a} escalationMinutes={escalationMinutes} onResolve={resolve} resolving={resolving === a.id} />
              ))}
            </ul>
          )}
          {alerts.data && <Pagination pagination={alerts.data.pagination} onPageChange={setPage} label="alerts" />}
        </Card>
      </div>

      <ComposeNotificationModal open={composeOpen} onClose={() => setComposeOpen(false)} api={api} mode="rep" fixedAudienceLabel={user.student.section?.label} />
    </>
  );
}
