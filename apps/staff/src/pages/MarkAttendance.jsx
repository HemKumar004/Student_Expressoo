import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, CheckCheck, CircleCheck, ClipboardCheck, Clock, RotateCcw, Save, UserX, X } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  SearchInput,
  SelectField,
  SkeletonRows,
  TextField,
  useApi,
  useAppConfig,
  useAuth,
  useConfirm,
  usePageTitle,
  useToast,
  formatDateTime,
  formatLongDate,
  formatTime,
  todayISO,
  cx,
} from "@expressoo/shared";
import { useAssignments, assignmentLabel } from "../lib/useAssignments.js";

const STATUSES = [
  { value: "PRESENT", label: "Present", short: "P", icon: Check, cls: "is-present" },
  { value: "LATE", label: "Late", short: "L", icon: Clock, cls: "is-late" },
  { value: "ABSENT", label: "Absent", short: "A", icon: X, cls: "is-absent" },
];
const KEY_TO_STATUS = { p: "PRESENT", l: "LATE", a: "ABSENT" };

function StatusToggle({ value, onChange, disabled, name }) {
  return (
    <div className="status-toggle" role="radiogroup" aria-label={`Attendance for ${name}`}>
      {STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          aria-pressed={value === s.value}
          className={s.cls}
          disabled={disabled}
          tabIndex={-1}
          onClick={() => onChange(s.value)}
          title={`${s.label} (${s.short})`}
        >
          <s.icon aria-hidden="true" />
          <span className="label-text">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function MarkAttendance() {
  usePageTitle("Mark attendance");
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const assignments = useAssignments();

  const assignmentId = params.get("assignment") || "";
  const date = params.get("date") || todayISO();
  const period = params.get("period") || "";
  const assignment = assignments.items.find((a) => String(a.id) === assignmentId);
  const ready = Boolean(assignment && date && period);

  const roster = useApi(
    () => api.get("/attendance/roster", { query: { sectionId: assignment.section.id, subjectId: assignment.subject.id, date, period } }),
    [assignment?.id, date, period],
    { enabled: ready }
  );

  const [marks, setMarks] = useState({});
  const [initial, setInitial] = useState({});
  const [topic, setTopic] = useState("");
  const [initialTopic, setInitialTopic] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const rowRefs = useRef([]);

  // Initialise marks whenever a roster loads. New sessions default to Present (mark the absentees).
  useEffect(() => {
    if (!roster.data) return;
    const next = {};
    for (const s of roster.data.students) next[s.studentId] = s.status || (roster.data.session ? null : "PRESENT");
    setMarks(next);
    setInitial(next);
    const t = roster.data.session?.topic || "";
    setTopic(t);
    setInitialTopic(t);
    setSavedAt(roster.data.session?.updatedAt || null);
  }, [roster.data]);

  const dirty = useMemo(() => topic !== initialTopic || Object.keys(marks).some((k) => marks[k] !== initial[k]), [marks, initial, topic, initialTopic]);

  // Warn before leaving the page with unsaved attendance.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const changeParams = async (patch) => {
    if (dirty && !(await confirm({ title: "Discard unsaved attendance?", message: "You have changes for this period that haven't been saved.", confirmLabel: "Discard changes", tone: "warning" }))) return;
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const editable = roster.data?.editable ?? false;
  const students = useMemo(() => roster.data?.students || [], [roster.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? students.filter((s) => s.fullName.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)) : students;
  }, [students, search]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, LATE: 0, ABSENT: 0, unmarked: 0 };
    for (const s of students) {
      const m = marks[s.studentId];
      if (m) c[m]++;
      else c.unmarked++;
    }
    return c;
  }, [students, marks]);

  const setMark = useCallback((studentId, status) => setMarks((m) => ({ ...m, [studentId]: status })), []);
  const markAll = (status) => setMarks(Object.fromEntries(students.map((s) => [s.studentId, status])));

  const onRowKeyDown = (e, index, studentId) => {
    const status = KEY_TO_STATUS[e.key.toLowerCase()];
    if (status && editable) {
      e.preventDefault();
      setMark(studentId, status);
      rowRefs.current[index + 1]?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      rowRefs.current[index + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      rowRefs.current[index - 1]?.focus();
    }
  };

  const save = async () => {
    if (counts.unmarked) {
      toast.warning("Some students are unmarked", `Mark all ${counts.unmarked} remaining student${counts.unmarked === 1 ? "" : "s"} before saving.`);
      return;
    }
    setSaving(true);
    try {
      const r = await api.put("/attendance/sessions", {
        sectionId: assignment.section.id,
        subjectId: assignment.subject.id,
        date,
        period: Number(period),
        topic: topic || null,
        records: students.map((s) => ({ studentId: s.studentId, status: marks[s.studentId] })),
      });
      setInitial(marks);
      setInitialTopic(topic);
      setSavedAt(r.savedAt);
      toast.success(r.created ? "Attendance saved" : "Attendance updated", `${r.counts.present + r.counts.late} present · ${r.counts.absent} absent · ${assignmentLabel(assignment)} · P${period}`);
      roster.refetch();
    } catch (err) {
      toast.fromError(err, "Attendance was not saved");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMarks(initial);
    setTopic(initialTopic);
  };

  const config = useAppConfig(api);
  const maxPeriods = config?.rules.maxPeriodsPerDay ?? 8;

  return (
    <>
      <PageHeader title="Mark attendance" description="Choose a class and period. Everyone starts as present for a new class — mark absentees, then save. Use P, L and A keys on a focused row for speed." />

      <Card title="Class details" bordered>
        {assignments.error ? (
          <ErrorState compact error={assignments.error} onRetry={assignments.refetch} />
        ) : (
          <div className="grid grid-3" style={{ gap: 16 }}>
            <SelectField label="Class" value={assignmentId} onChange={(e) => changeParams({ assignment: e.target.value })} required disabled={assignments.loading}>
              <option value="">{assignments.loading ? "Loading your classes…" : "Select subject and section"}</option>
              {assignments.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {assignmentLabel(a)} — {a.subject.name}
                </option>
              ))}
            </SelectField>
            <TextField label="Date" type="date" value={date} max={todayISO()} onChange={(e) => changeParams({ date: e.target.value })} required />
            <SelectField label="Period" value={period} onChange={(e) => changeParams({ period: e.target.value })} required>
              <option value="">Select period</option>
              {Array.from({ length: maxPeriods }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  Period {p}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 20 }}>
        {!assignments.loading && assignments.items.length === 0 && !assignments.error && (
          <Card>
            <EmptyState icon={ClipboardCheck} title="No classes assigned" description="You can mark attendance once the administration assigns you to a subject and section." />
          </Card>
        )}
        {assignments.items.length > 0 && !ready && (
          <Card>
            <EmptyState icon={ClipboardCheck} title="Choose a class, date and period" description="The student list loads as soon as all three are selected." />
          </Card>
        )}
        {ready && roster.initialLoading && (
          <Card>
            <SkeletonRows rows={8} height={52} />
          </Card>
        )}
        {ready && roster.error && !roster.data && (
          <Card>
            <ErrorState error={roster.error} onRetry={roster.refetch} />
          </Card>
        )}
        {ready && roster.data && (
          <>
            <div className="stack" style={{ marginBottom: 16 }}>
              {roster.data.conflict && (
                <Callout tone="warning" title="This period is already recorded for another subject">
                  {roster.data.conflict.message} Choose a different period, or ask the administration to correct it.
                </Callout>
              )}
              {!roster.data.conflict && roster.data.session && (
                <Callout tone="info" title="Attendance already recorded — you are editing it">
                  Last saved by {roster.data.session.recordedBy?.fullName} on {formatDateTime(roster.data.session.updatedAt)}. Saving will update the existing record.
                </Callout>
              )}
              {!editable && !roster.data.conflict && roster.data.editableReason && (
                <Callout tone="warning" title="Read-only">
                  {roster.data.editableReason}
                </Callout>
              )}
            </div>

            <Card
              flush
              title={`${roster.data.subject.code} · ${roster.data.section.label}`}
              subtitle={`${roster.data.subject.name} · ${formatLongDate(date)} · Period ${period}`}
              actions={
                editable && (
                  <div className="row-sm wrap">
                    <Button variant="secondary" size="sm" icon={CheckCheck} onClick={() => markAll("PRESENT")}>
                      All present
                    </Button>
                    <Button variant="ghost" size="sm" icon={UserX} onClick={() => markAll("ABSENT")}>
                      All absent
                    </Button>
                  </div>
                )
              }
            >
              <div className="toolbar" style={{ marginTop: 16 }}>
                <SearchInput value={search} onChange={setSearch} placeholder="Find a student by name or roll number" label="Find student" />
                <Input aria-label="Topic covered (optional)" placeholder="Topic covered (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} disabled={!editable} style={{ flex: "1 1 240px", maxWidth: 380 }} />
              </div>
              {students.length === 0 ? (
                <EmptyState icon={UserX} title="No active students in this section" />
              ) : (
                <ul className="list" aria-label="Students">
                  {visible.map((s, i) => (
                    <li
                      key={s.studentId}
                      ref={(el) => (rowRefs.current[i] = el)}
                      tabIndex={0}
                      className="list-item"
                      style={{ alignItems: "center", background: marks[s.studentId] === "ABSENT" ? "var(--danger-50)" : marks[s.studentId] === "LATE" ? "var(--warning-50)" : undefined }}
                      onKeyDown={(e) => onRowKeyDown(e, i, s.studentId)}
                      aria-label={`${s.fullName}, ${s.rollNumber}: ${marks[s.studentId] ? marks[s.studentId].toLowerCase() : "not marked"}`}
                    >
                      <span className="num muted text-sm hide-mobile" style={{ width: 24, textAlign: "right", flex: "none" }}>
                        {students.indexOf(s) + 1}
                      </span>
                      <Avatar name={s.fullName} size="sm" />
                      <div className="grow">
                        <p className="list-title truncate">
                          {s.fullName} {!s.active && <Badge>Inactive</Badge>}
                        </p>
                        <p className="list-meta mono">{s.rollNumber}</p>
                      </div>
                      <StatusToggle value={marks[s.studentId]} onChange={(v) => setMark(s.studentId, v)} disabled={!editable} name={s.fullName} />
                    </li>
                  ))}
                  {visible.length === 0 && <li className="list-item muted">No students match “{search}”.</li>}
                </ul>
              )}
            </Card>

            {students.length > 0 && (
              <div className="action-bar" role="region" aria-label="Save attendance">
                <div className="row wrap" style={{ gap: 12 }}>
                  <span className="row-sm text-sm">
                    <Badge tone="success" dot>{counts.PRESENT} present</Badge>
                    <Badge tone="warning" dot>{counts.LATE} late</Badge>
                    <Badge tone="danger" dot>{counts.ABSENT} absent</Badge>
                    {counts.unmarked > 0 && <Badge dot>{counts.unmarked} unmarked</Badge>}
                  </span>
                  <span className={cx("text-sm", dirty ? "text-warning" : "muted")} aria-live="polite">
                    {saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? (
                      <span className="row-sm">
                        <CircleCheck aria-hidden="true" style={{ width: 14, height: 14, color: "var(--success-600)" }} /> Saved at {formatTime(savedAt)}
                      </span>
                    ) : (
                      "Not saved yet"
                    )}
                  </span>
                </div>
                <div className="row-sm">
                  {dirty && (
                    <Button variant="ghost" icon={RotateCcw} onClick={reset} disabled={saving}>
                      Reset
                    </Button>
                  )}
                  <Button icon={Save} onClick={save} loading={saving} disabled={!editable || (!dirty && Boolean(roster.data.session))}>
                    {roster.data.session ? "Update attendance" : "Save attendance"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
