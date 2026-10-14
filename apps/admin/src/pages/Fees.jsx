import { useState } from "react";
import { Ban, Banknote, BadgePercent, Ellipsis, IndianRupee, Pencil, Plus, Receipt, Send, Trash2, Wallet, ListChecks } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  DataTable,
  DescriptionList,
  ErrorState,
  IconButton,
  Input,
  KeyValue,
  Menu,
  Modal,
  PageHeader,
  Pagination,
  PersonCell,
  ReceiptModal,
  SearchInput,
  Select,
  SelectField,
  SkeletonRows,
  StatusBadge,
  Tabs,
  TextField,
  TextareaField,
  useApi,
  useAuth,
  useConfirm,
  useDebouncedValue,
  usePageTitle,
  useToast,
  fieldErrors,
  formatCurrency,
  formatDate,
  METHOD_LABELS,
  todayISO,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------
function StructureModal({ structure, onClose, onSaved, api }) {
  const toast = useToast();
  const { courses } = useReference();
  const y = new Date().getFullYear();
  const [form, setForm] = useState({
    name: structure?.name || "",
    academicYear: structure?.academicYear || `${y}-${String((y + 1) % 100).padStart(2, "0")}`,
    courseId: structure?.courseId ? String(structure.courseId) : "",
    yearOfStudy: structure?.yearOfStudy ? String(structure.yearOfStudy) : "",
    amount: structure?.amount || "",
    dueDate: structure?.dueDate || "",
    description: structure?.description || "",
    isActive: structure?.isActive ?? true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const locked = Boolean(structure?.stats?.assigned);
  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!/^\d{4}-\d{2}$/.test(form.academicYear)) errs.academicYear = "Use the format 2026-27";
    if (!MONEY_RE.test(String(form.amount)) || Number(form.amount) <= 0) errs.amount = "Enter a valid amount";
    if (!form.dueDate) errs.dueDate = "Choose a due date";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        academicYear: form.academicYear,
        courseId: form.courseId ? Number(form.courseId) : null,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : null,
        amount: String(form.amount),
        dueDate: form.dueDate,
        description: form.description || null,
        isActive: form.isActive,
      };
      if (structure) await api.patch(`/fees/structures/${structure.id}`, body);
      else await api.post("/fees/structures", body);
      toast.success(structure ? "Fee structure updated" : "Fee structure created");
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't save the fee structure");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} busy={saving} size="lg" title={structure ? "Edit fee structure" : "New fee structure"} description="Define a fee once, then bill every matching student in one step." footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="structure-form" loading={saving}>Save</Button></>}>
      <form id="structure-form" className="form-grid" onSubmit={submit} noValidate>
        {locked && <Callout tone="info" className="span-2">This fee is already billed to {structure.stats.assigned} students, so the amount and audience are locked. Adjust individual students with a concession instead.</Callout>}
        <TextField label="Fee name" value={form.name} onChange={set("name")} error={errors.name} required maxLength={120} className="span-2" placeholder="e.g. Tuition Fee" />
        <TextField label="Academic year" value={form.academicYear} onChange={set("academicYear")} error={errors.academicYear} required placeholder="2026-27" />
        <TextField label="Amount (₹)" inputMode="decimal" value={form.amount} onChange={set("amount")} error={errors.amount} required disabled={locked} />
        <SelectField label="Course" value={form.courseId} onChange={set("courseId")} disabled={locked} hint="Leave empty to apply to every course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </SelectField>
        <SelectField label="Year of study" value={form.yearOfStudy} onChange={set("yearOfStudy")} disabled={locked}>
          <option value="">All years</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Year {n}</option>)}
        </SelectField>
        <TextField label="Due date" type="date" value={form.dueDate} onChange={set("dueDate")} error={errors.dueDate} required />
        <div className="field" style={{ justifyContent: "flex-end", paddingBottom: 8 }}>
          <Checkbox label="Active (can be assigned)" checked={form.isActive} onChange={set("isActive")} />
        </div>
        <TextareaField label="Description" value={form.description} onChange={set("description")} optional rows={2} className="span-2" />
      </form>
    </Modal>
  );
}

function Structures() {
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, refetch } = useApi(() => api.get("/fees/structures"), []);
  const [modal, setModal] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const assign = async (s) => {
    const audience = s.course ? `${s.course.code}${s.yearOfStudy ? ` year ${s.yearOfStudy}` : ""} students` : "all students";
    if (!(await confirm({ title: `Bill "${s.name}" to ${audience}?`, message: `Each active matching student who hasn't been billed yet receives ${formatCurrency(s.amount)} due ${formatDate(s.dueDate)} and a notification. Students already billed are skipped.`, confirmLabel: "Bill students" }))) return;
    setAssigning(s.id);
    try {
      const r = await api.post(`/fees/structures/${s.id}/assign`);
      toast.success(r.created ? `Billed ${r.created} student${r.created === 1 ? "" : "s"}` : "No new students to bill", r.skipped ? `${r.skipped} already billed` : undefined);
      refetch();
    } catch (err) {
      toast.fromError(err, "Couldn't assign the fee");
    } finally {
      setAssigning(null);
    }
  };

  const remove = async (s) => {
    if (!(await confirm({ title: `Delete "${s.name}"?`, message: "Only fee structures that have never been billed can be deleted.", confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await api.del(`/fees/structures/${s.id}`);
      toast.success("Fee structure deleted");
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <Card flush title="Fee structures" subtitle="Billing templates by academic year, course and year of study" actions={<Button size="sm" icon={Plus} onClick={() => setModal({})}>New fee</Button>} refreshing={loading && Boolean(data)}>
      <div style={{ height: 12 }} />
      {error && !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable
          rows={data?.items}
          loading={loading}
          empty={{ icon: Wallet, title: "No fee structures yet", description: "Create a fee such as tuition or exam fees, then bill it to students." }}
          columns={[
            { key: "name", header: "Fee", render: (s) => <div className="cell-stack"><span className="cell-primary">{s.name}</span><span className="sub">{s.academicYear}</span></div> },
            { key: "audience", header: "Applies to", render: (s) => (s.course ? `${s.course.code}${s.yearOfStudy ? ` · Year ${s.yearOfStudy}` : " · All years"}` : "All courses"), hideOnMobile: true },
            { key: "amount", header: "Amount", align: "right", render: (s) => <span className="num semibold" style={{ color: "var(--text-primary)" }}>{formatCurrency(s.amount)}</span> },
            { key: "dueDate", header: "Due", render: (s) => <span className="nowrap">{formatDate(s.dueDate)}</span>, hideOnMobile: true },
            { key: "assigned", header: "Billed", align: "right", render: (s) => <span className="num">{s.stats.assigned}</span> },
            { key: "collected", header: "Collected", align: "right", hideOnMobile: true, render: (s) => <div className="cell-stack" style={{ alignItems: "flex-end" }}><span className="num">{formatCurrency(s.stats.collected, { whole: true })}</span><span className="sub num">of {formatCurrency(s.stats.billed, { whole: true })}</span></div> },
            { key: "isActive", header: "Status", render: (s) => (s.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Inactive</Badge>) },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "cell-actions",
              render: (s) => (
                <div className="row-sm" style={{ justifyContent: "flex-end" }}>
                  <Button variant="secondary" size="sm" icon={Send} loading={assigning === s.id} disabled={!s.isActive} onClick={() => assign(s)}>
                    <span className="hide-mobile">Bill students</span>
                  </Button>
                  <IconButton icon={Pencil} size="sm" label={`Edit ${s.name}`} onClick={() => setModal({ item: s })} />
                  <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${s.name}`} onClick={() => remove(s)} />
                </div>
              ),
            },
          ]}
        />
      )}
      {modal && <StructureModal structure={modal.item} api={api} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fee records
// ---------------------------------------------------------------------------
function RecordPaymentModal({ record, onClose, onSaved, api }) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: record.balance, method: "UPI", paidOn: todayISO(), referenceNo: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!MONEY_RE.test(String(form.amount)) || Number(form.amount) <= 0) errs.amount = "Enter a valid amount";
    else if (Number(form.amount) > Number(record.balance)) errs.amount = `Maximum is ${formatCurrency(record.balance)}`;
    if (!form.paidOn) errs.paidOn = "Choose the payment date";
    if (form.method !== "CASH" && !form.referenceNo.trim()) errs.referenceNo = "Enter the transaction / cheque / DD reference";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const p = await api.post("/payments", { feeRecordId: record.id, amount: String(form.amount), method: form.method, paidOn: form.paidOn, referenceNo: form.referenceNo || null, notes: form.notes || null });
      toast.success("Payment recorded", `Receipt ${p.receiptNo} · ${formatCurrency(p.amount)}`);
      onSaved(p);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Payment was not recorded");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      icon={<span className="modal-icon tone-primary"><IndianRupee aria-hidden="true" /></span>}
      title="Record a payment"
      description={`${record.student.fullName} (${record.student.rollNumber}) · ${record.feeStructure.name} ${record.feeStructure.academicYear}`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="payment-form" loading={saving} icon={Banknote}>Record payment</Button></>}
    >
      <form id="payment-form" className="stack" onSubmit={submit} noValidate>
        <div className="kv-row" style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-subtle)" }}>
          <KeyValue label="Payable" value={formatCurrency(record.netAmount)} />
          <KeyValue label="Paid" value={formatCurrency(record.amountPaid)} />
          <KeyValue label="Balance" value={formatCurrency(record.balance)} />
        </div>
        <div className="form-grid">
          <TextField label="Amount received (₹)" inputMode="decimal" value={form.amount} onChange={set("amount")} error={errors.amount} required />
          <SelectField label="Method" value={form.method} onChange={set("method")} required>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </SelectField>
          <TextField label="Payment date" type="date" max={todayISO()} value={form.paidOn} onChange={set("paidOn")} error={errors.paidOn} required />
          <TextField label="Reference no." value={form.referenceNo} onChange={set("referenceNo")} error={errors.referenceNo} optional={form.method === "CASH"} placeholder={form.method === "CASH" ? "" : "UTR / cheque / DD number"} />
        </div>
        <TextareaField label="Notes" value={form.notes} onChange={set("notes")} optional rows={2} maxLength={255} />
        <Callout tone="info">The student is notified and a numbered receipt is generated. Mistakes can be voided from the payments ledger, never edited.</Callout>
      </form>
    </Modal>
  );
}

function ConcessionModal({ record, onClose, onSaved, api }) {
  const toast = useToast();
  const [discount, setDiscount] = useState(record.discount);
  const [remarks, setRemarks] = useState(record.remarks || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!MONEY_RE.test(String(discount))) return setError("Enter a valid amount");
    setSaving(true);
    try {
      await api.patch(`/fees/records/${record.id}`, { discount: String(discount), remarks: remarks || null });
      toast.success("Concession updated");
      onSaved();
    } catch (err) {
      setError(fieldErrors(err).discount || err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} busy={saving} title="Concession / scholarship" description={`${record.student.fullName} · ${record.feeStructure.name} (${formatCurrency(record.amount)})`} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="concession-form" loading={saving}>Save</Button></>}>
      <form id="concession-form" className="stack" onSubmit={submit} noValidate>
        <TextField label="Concession amount (₹)" inputMode="decimal" value={discount} onChange={(e) => { setDiscount(e.target.value); setError(null); }} error={error} hint={`A full concession of ${formatCurrency(record.amount)} marks the fee as waived.`} />
        <TextareaField label="Reason" value={remarks} onChange={(e) => setRemarks(e.target.value)} optional rows={2} maxLength={255} placeholder="e.g. Merit scholarship 2026" />
      </form>
    </Modal>
  );
}

function RecordDetailModal({ recordId, onClose, api, onChanged }) {
  const detail = useApi(() => api.get(`/fees/records/${recordId}`), [recordId]);
  const [receipt, setReceipt] = useState(null);
  const r = detail.data;
  return (
    <>
      <Modal open={!receipt} onClose={onClose} size="lg" title={r ? `${r.feeStructure.name} · ${r.feeStructure.academicYear}` : "Fee record"} description={r && `${r.student.fullName} (${r.student.rollNumber}) · ${r.student.section?.label}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        {detail.initialLoading && <SkeletonRows rows={4} />}
        {detail.error && <ErrorState compact error={detail.error} onRetry={detail.refetch} />}
        {r && (
          <div className="stack">
            <DescriptionList columns={3} items={[
              { label: "Fee amount", value: formatCurrency(r.amount) },
              { label: "Concession", value: formatCurrency(r.discount) },
              { label: "Payable", value: formatCurrency(r.netAmount) },
              { label: "Paid", value: formatCurrency(r.amountPaid) },
              { label: "Balance", value: formatCurrency(r.balance) },
              { label: "Status", value: <StatusBadge status={r.status} /> },
            ]} />
            <p className="section-title" style={{ marginTop: 8, marginBottom: 0 }}>Payments</p>
            <DataTable
              rows={r.payments}
              compact
              empty={{ icon: Receipt, title: "No payments recorded" }}
              columns={[
                { key: "receiptNo", header: "Receipt", render: (p) => <span className="mono">{p.receiptNo}</span> },
                { key: "paidOn", header: "Date", render: (p) => formatDate(p.paidOn) },
                { key: "method", header: "Method", render: (p) => p.methodLabel },
                { key: "amount", header: "Amount", align: "right", render: (p) => <span className="num">{formatCurrency(p.amount)}</span> },
                { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
                { key: "a", header: <span className="sr-only">Receipt</span>, className: "cell-actions", render: (p) => <IconButton icon={Receipt} size="sm" label="View receipt" onClick={() => setReceipt({ ...p, feeRecord: { student: r.student, feeStructure: r.feeStructure } })} /> },
              ]}
            />
          </div>
        )}
      </Modal>
      {receipt && <ReceiptModal payment={receipt} onClose={() => { setReceipt(null); onChanged?.(); }} />}
    </>
  );
}

function Records() {
  const { api } = useAuth();
  const { courses, sections } = useReference();
  const structures = useApi(() => api.get("/fees/structures"), []);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ courseId: "", sectionId: "", feeStructureId: "", status: "", overdue: false, page: 1 });
  const [modal, setModal] = useState(null);
  const q = useDebouncedValue(search, 300);
  const { data, error, loading, refetch } = useApi(() => api.get("/fees/records", { query: { ...filters, overdue: filters.overdue || undefined, search: q || undefined, pageSize: 20 } }), [filters, q]);
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const sectionOptions = filters.courseId ? sections.filter((s) => String(s.courseId) === filters.courseId) : sections;

  return (
    <Card flush refreshing={loading && Boolean(data)} title="Student fee records" subtitle={data ? `Billed ${formatCurrency(data.totals.billed, { whole: true })} · collected ${formatCurrency(data.totals.collected, { whole: true })} · outstanding ${formatCurrency(data.totals.outstanding, { whole: true })} (current filter)` : " "}>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); update({}); }} placeholder="Search student name or roll number" label="Search fee records" />
        <Select aria-label="Fee" value={filters.feeStructureId} onChange={(e) => update({ feeStructureId: e.target.value })}>
          <option value="">All fees</option>
          {structures.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.academicYear}{s.course ? ` · ${s.course.code}` : ""}</option>)}
        </Select>
        <Select aria-label="Course" value={filters.courseId} onChange={(e) => update({ courseId: e.target.value, sectionId: "" })}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
        <Select aria-label="Section" value={filters.sectionId} onChange={(e) => update({ sectionId: e.target.value })}>
          <option value="">All sections</option>
          {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })} disabled={filters.overdue}>
          <option value="">Any status</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="WAIVED">Waived</option>
        </Select>
        <Checkbox label="Overdue only" checked={filters.overdue} onChange={(e) => update({ overdue: e.target.checked })} />
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        empty={{ icon: ListChecks, title: "No fee records match", description: "Bill a fee structure to students to create records." }}
        columns={[
          { key: "student", header: "Student", render: (r) => <PersonCell name={r.student.fullName} sub={`${r.student.rollNumber} · ${r.student.section?.label}`} /> },
          { key: "fee", header: "Fee", hideOnMobile: true, render: (r) => <div className="cell-stack"><span className="nowrap">{r.feeStructure.name}</span><span className="sub nowrap">{r.feeStructure.academicYear}</span></div> },
          { key: "dueDate", header: "Due", hideOnMobile: true, render: (r) => <div className="cell-stack"><span className="nowrap">{formatDate(r.dueDate)}</span>{r.overdue && <span><Badge tone="danger">Overdue</Badge></span>}</div> },
          { key: "amountPaid", header: "Paid", align: "right", hideOnMobile: true, render: (r) => <div className="cell-stack" style={{ alignItems: "flex-end" }}><span className="num nowrap">{formatCurrency(r.amountPaid, { whole: true })}</span><span className="sub num nowrap">of {formatCurrency(r.netAmount, { whole: true })}</span></div> },
          { key: "balance", header: "Balance", align: "right", render: (r) => <span className="num semibold" style={{ color: Number(r.balance) ? "var(--text-primary)" : "var(--text-muted)" }}>{formatCurrency(r.balance)}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "cell-actions",
            render: (r) => (
              <div className="row-sm" style={{ justifyContent: "flex-end" }}>
                {Number(r.balance) > 0 && <Button size="sm" variant="secondary" icon={IndianRupee} onClick={() => setModal({ type: "pay", record: r })}><span className="hide-mobile">Record</span></Button>}
                <Menu
                  label="More actions"
                  items={[
                    { label: "View payments", icon: Receipt, onClick: () => setModal({ type: "detail", record: r }) },
                    { label: "Concession / scholarship", icon: BadgePercent, onClick: () => setModal({ type: "concession", record: r }) },
                  ]}
                  trigger={(props) => <button type="button" className="icon-btn icon-btn-sm" aria-label="More actions" {...props}><Ellipsis aria-hidden="true" /></button>}
                />
              </div>
            ),
          },
        ]}
      />
      {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="records" />}
      {modal?.type === "pay" && <RecordPaymentModal record={modal.record} api={api} onClose={() => setModal(null)} onSaved={(p) => { setModal({ type: "receipt", payment: p }); refetch(); }} />}
      {modal?.type === "receipt" && <ReceiptModal payment={modal.payment} onClose={() => setModal(null)} />}
      {modal?.type === "concession" && <ConcessionModal record={modal.record} api={api} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />}
      {modal?.type === "detail" && <RecordDetailModal recordId={modal.record.id} api={api} onClose={() => setModal(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Payments ledger
// ---------------------------------------------------------------------------
function VoidModal({ payment, onClose, onSaved, api }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return setError("Explain why this payment is being voided");
    setSaving(true);
    try {
      await api.post(`/payments/${payment.id}/void`, { reason: reason.trim() });
      toast.success("Payment voided", `${payment.receiptNo} no longer counts towards the fee.`);
      onSaved();
    } catch (err) {
      toast.fromError(err, "Couldn't void the payment");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} busy={saving} icon={<span className="modal-icon tone-danger"><Ban aria-hidden="true" /></span>} title={`Void ${payment.receiptNo}?`} description={`${formatCurrency(payment.amount)} from ${payment.feeRecord?.student?.fullName}. The fee balance is restored; the receipt stays on record marked as voided.`} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="danger" type="submit" form="void-form" loading={saving}>Void payment</Button></>}>
      <form id="void-form" onSubmit={submit} noValidate>
        <TextareaField label="Reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} error={error} required rows={3} maxLength={255} placeholder="e.g. Cheque bounced / entered twice" />
      </form>
    </Modal>
  );
}

function Payments() {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ method: "", status: "", from: "", to: "", page: 1 });
  const [modal, setModal] = useState(null);
  const q = useDebouncedValue(search, 300);
  const { data, error, loading, refetch } = useApi(() => api.get("/payments", { query: { ...filters, search: q || undefined, pageSize: 20 } }), [filters, q]);
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  return (
    <Card flush refreshing={loading && Boolean(data)} title="Payments ledger" subtitle={data ? `${formatCurrency(data.totals.collected)} collected in this view (voided payments excluded)` : " "}>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); update({}); }} placeholder="Student, roll number or receipt (RCPT-…)" label="Search payments" />
        <Select aria-label="Method" value={filters.method} onChange={(e) => update({ method: e.target.value })}>
          <option value="">All methods</option>
          {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Recorded & voided</option>
          <option value="RECORDED">Recorded</option>
          <option value="VOIDED">Voided</option>
        </Select>
        <div className="row-sm">
          <Input type="date" aria-label="From" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
          <span className="muted text-sm">to</span>
          <Input type="date" aria-label="To" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
        </div>
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        empty={{ icon: Receipt, title: "No payments found" }}
        columns={[
          { key: "receiptNo", header: "Receipt", render: (p) => <span className="mono cell-primary">{p.receiptNo}</span> },
          { key: "paidOn", header: "Date", render: (p) => <span className="nowrap">{formatDate(p.paidOn)}</span> },
          { key: "student", header: "Student", render: (p) => <div className="cell-stack"><span>{p.feeRecord?.student?.fullName}</span><span className="sub mono">{p.feeRecord?.student?.rollNumber}</span></div> },
          { key: "fee", header: "Fee", hideOnMobile: true, render: (p) => p.feeRecord?.feeStructure?.name },
          { key: "method", header: "Method", hideOnMobile: true, render: (p) => p.methodLabel },
          { key: "amount", header: "Amount", align: "right", render: (p) => <span className="num semibold" style={{ color: "var(--text-primary)", textDecoration: p.status === "VOIDED" ? "line-through" : undefined }}>{formatCurrency(p.amount)}</span> },
          { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "cell-actions",
            render: (p) => (
              <div className="row-sm" style={{ justifyContent: "flex-end" }}>
                <IconButton icon={Receipt} size="sm" label={`View receipt ${p.receiptNo}`} onClick={() => setModal({ type: "receipt", payment: p })} />
                {p.status === "RECORDED" && <IconButton icon={Ban} size="sm" variant="danger" label={`Void ${p.receiptNo}`} onClick={() => setModal({ type: "void", payment: p })} />}
              </div>
            ),
          },
        ]}
      />
      {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="payments" />}
      {modal?.type === "receipt" && <ReceiptModal payment={modal.payment} onClose={() => setModal(null)} />}
      {modal?.type === "void" && <VoidModal payment={modal.payment} api={api} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />}
    </Card>
  );
}

export default function Fees() {
  usePageTitle("Fees & payments");
  const [tab, setTab] = useState("records");
  return (
    <>
      <PageHeader title="Fees & payments" description="Fee structures, student balances and the payments ledger. Payments are recorded by the accounts office; online payment is not enabled." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "records", label: "Student fees" }, { id: "payments", label: "Payments ledger" }, { id: "structures", label: "Fee structures" }]} />
      <div style={{ marginTop: 20 }}>
        {tab === "structures" && <Structures />}
        {tab === "records" && <Records />}
        {tab === "payments" && <Payments />}
      </div>
    </>
  );
}
