import { useMemo, useState } from "react";
import { Ellipsis, KeyRound, Pencil, Plus, Presentation, Trash2, UserCheck, Users, UserX } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  Menu,
  Modal,
  PageHeader,
  Pagination,
  PersonCell,
  SearchInput,
  Select,
  SelectField,
  SkeletonRows,
  StatusBadge,
  Tabs,
  TextField,
  useApi,
  useAuth,
  useConfirm,
  useDebouncedValue,
  usePageTitle,
  useToast,
  fieldErrors,
  formatRelative,
  generatePassword,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";
import { ResetPasswordModal, TempPasswordField, useStatusChange } from "../components/AccountActions.jsx";

function StaffFormModal({ staff, onClose, onSaved, api }) {
  const toast = useToast();
  const { departments } = useReference();
  const editing = Boolean(staff);
  const [form, setForm] = useState({
    fullName: staff?.fullName || "",
    employeeId: staff?.staff?.employeeId || "",
    departmentId: staff?.staff?.departmentId ? String(staff.staff.departmentId) : "",
    designation: staff?.staff?.designation || "",
    email: staff?.email || "",
    mobile: staff?.mobile || "",
    password: editing ? "" : generatePassword(),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.fullName.trim().length < 2) errs.fullName = "Enter the full name";
    if (!/^[A-Za-z0-9]{8}$/.test(form.employeeId.trim())) errs.employeeId = "Exactly 8 letters or digits";
    if (!form.departmentId) errs.departmentId = "Choose a department";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!/^\+?\d{10,15}$/.test(form.mobile)) errs.mobile = "Enter 10–15 digits";
    if (!editing && !/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(form.password)) errs.password = "At least 8 characters with a letter and a number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { fullName: form.fullName, employeeId: form.employeeId.trim().toUpperCase(), departmentId: Number(form.departmentId), designation: form.designation || null, email: form.email, mobile: form.mobile };
      if (editing) await api.patch(`/staff/${staff.staff.id}`, body);
      else await api.post("/staff", { ...body, password: form.password });
      toast.success(editing ? "Staff member updated" : "Staff account created", form.fullName);
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't save the staff member");
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
      title={editing ? `Edit ${staff.fullName}` : "Add a staff member"}
      description={editing ? undefined : "Accounts created here are active immediately."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={saving}>
            {editing ? "Save changes" : "Create account"}
          </Button>
        </>
      }
    >
      <form id="staff-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Full name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} required className="span-2" />
        <TextField label="Employee ID" value={form.employeeId} onChange={set("employeeId")} error={errors.employeeId} required maxLength={8} />
        <SelectField label="Department" value={form.departmentId} onChange={set("departmentId")} error={errors.departmentId} required>
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Designation" value={form.designation} onChange={set("designation")} optional className="span-2" />
        <TextField label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <TextField label="Mobile" type="tel" value={form.mobile} onChange={set("mobile")} error={errors.mobile} required />
        {!editing && (
          <div className="span-2">
            <TempPasswordField value={form.password} onChange={set("password")} error={errors.password} />
          </div>
        )}
      </form>
    </Modal>
  );
}

/** View and edit the subjects/sections a staff member teaches. */
function AssignmentsModal({ staffId, onClose, api, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { sections, subjects } = useReference();
  const detail = useApi(() => api.get(`/staff/${staffId}`), [staffId]);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [adding, setAdding] = useState(false);
  const section = sections.find((s) => String(s.id) === sectionId);
  const subjectOptions = useMemo(() => (section ? subjects.filter((s) => s.courseId === section.courseId && s.yearOfStudy === section.yearOfStudy) : []), [section, subjects]);

  const add = async (e) => {
    e.preventDefault();
    if (!sectionId || !subjectId) return;
    setAdding(true);
    try {
      await api.post("/academics/assignments", { staffId: detail.data.staff.id, sectionId: Number(sectionId), subjectId: Number(subjectId) });
      toast.success("Class assigned");
      setSubjectId("");
      detail.refetch();
      onChanged();
    } catch (err) {
      toast.fromError(err, "Couldn't assign the class");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (a) => {
    const ok = await confirm({ title: `Remove ${a.subject.code} · ${a.section.label}?`, message: "Existing attendance stays, but this teacher will no longer be able to mark attendance or share material for the class.", confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      await api.del(`/academics/assignments/${a.id}`);
      toast.success("Assignment removed");
      detail.refetch();
      onChanged();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={detail.data ? `Classes for ${detail.data.fullName}` : "Classes"} description="Assignments decide which attendance and materials a teacher can manage." footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="stack">
        {detail.initialLoading ? (
          <SkeletonRows rows={3} />
        ) : detail.data?.assignments.length === 0 ? (
          <EmptyState compact icon={Presentation} title="No classes assigned yet" />
        ) : (
          <ul className="list" style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
            {detail.data?.assignments.map((a) => (
              <li key={a.id} className="list-item" style={{ alignItems: "center", padding: "10px 16px" }}>
                <div className="grow">
                  <p className="list-title">
                    {a.subject.code} · {a.section.label}
                  </p>
                  <p className="list-meta">{a.subject.name}</p>
                </div>
                <IconButton icon={Trash2} size="sm" variant="danger" label={`Remove ${a.subject.code} ${a.section.label}`} onClick={() => remove(a)} />
              </li>
            ))}
          </ul>
        )}
        {detail.data && (
          <form className="stack-sm" onSubmit={add} style={{ paddingTop: 8 }}>
            <p className="section-title" style={{ margin: 0 }}>
              Assign a class
            </p>
            <div className="form-grid">
              <SelectField label="Section" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setSubjectId(""); }}>
                <option value="">Select section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.course?.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!section} hint={section && subjectOptions.length === 0 ? "No subjects exist for this course and year yet." : undefined}>
                <option value="">{section ? "Select subject" : "Choose a section first"}</option>
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="form-actions">
              <Button type="submit" icon={Plus} loading={adding} disabled={!sectionId || !subjectId}>
                Assign class
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default function Staff() {
  usePageTitle("Staff");
  const { api } = useAuth();
  const { departments } = useReference();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ departmentId: "", status: "", page: 1, sort: "name", order: "asc" });
  const [modal, setModal] = useState(null);
  const q = useDebouncedValue(search, 300);
  const status = tab === "pending" ? "PENDING" : filters.status;
  const { data, error, loading, refetch } = useApi(() => api.get("/staff", { query: { ...filters, status: status || undefined, search: q || undefined, pageSize: 20 } }), [filters, q, status]);
  const pendingCount = useApi(() => api.get("/staff", { query: { status: "PENDING", pageSize: 1 } }), [data]);
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const changeStatus = useStatusChange(api, refetch);

  const columns = [
    { key: "name", header: "Staff member", sortable: true, render: (u) => <PersonCell name={u.fullName} sub={u.email} /> },
    { key: "employeeId", header: "Employee ID", sortable: true, render: (u) => <span className="mono">{u.staff.employeeId}</span> },
    { key: "department", header: "Department", render: (u) => u.staff.department?.code, hideOnMobile: true },
    { key: "designation", header: "Designation", render: (u) => u.staff.designation || <span className="muted">—</span>, hideOnMobile: true },
    { key: "classes", header: "Classes", align: "right", render: (u) => <span className="num">{u.assignmentCount}</span>, hideOnMobile: true },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
    { key: "lastLogin", header: "Last sign-in", render: (u) => (u.lastLoginAt ? formatRelative(u.lastLoginAt) : <span className="muted">Never</span>), hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "cell-actions",
      render: (u) => (
        <div className="row-sm" style={{ justifyContent: "flex-end" }}>
          {u.status === "PENDING" && (
            <Button size="sm" icon={UserCheck} onClick={() => changeStatus(u, "ACTIVE")}>
              Approve
            </Button>
          )}
          <Menu
            label={`Actions for ${u.fullName}`}
            items={[
              { label: "Edit details", icon: Pencil, onClick: () => setModal({ type: "edit", user: u }) },
              { label: "Manage classes", icon: Presentation, onClick: () => setModal({ type: "assignments", user: u }) },
              { label: "Reset password", icon: KeyRound, onClick: () => setModal({ type: "password", user: u }) },
              { separator: true },
              u.status === "ACTIVE"
                ? { label: "Deactivate account", icon: UserX, danger: true, onClick: () => changeStatus(u, "INACTIVE") }
                : u.status === "PENDING"
                  ? { label: "Reject (deactivate)", icon: UserX, danger: true, onClick: () => changeStatus(u, "INACTIVE") }
                  : { label: "Activate account", icon: UserCheck, onClick: () => changeStatus(u, "ACTIVE") },
            ]}
            trigger={(props) => (
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Actions for ${u.fullName}`} {...props}>
                <Ellipsis aria-hidden="true" />
              </button>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Staff" description="Faculty accounts, approvals and teaching assignments." actions={<Button icon={Plus} onClick={() => setModal({ type: "create" })}>Add staff member</Button>} />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          update({});
        }}
        tabs={[
          { id: "all", label: "All staff" },
          { id: "pending", label: "Pending approval", count: pendingCount.data?.pagination.total ?? undefined },
        ]}
      />
      <Card flush refreshing={loading && Boolean(data)} className="mt-6" style={{ marginTop: 20 }}>
        <div className="toolbar">
          <SearchInput value={search} onChange={(v) => { setSearch(v); update({}); }} placeholder="Search name, email or employee ID" label="Search staff" />
          <Select aria-label="Department" value={filters.departmentId} onChange={(e) => update({ departmentId: e.target.value })}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {tab === "all" && (
            <Select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending approval</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={refetch}
          sort={{ key: filters.sort, dir: filters.order }}
          onSortChange={(s) => update({ sort: s.key, order: s.dir })}
          empty={{ icon: Users, title: tab === "pending" ? "No registrations waiting" : "No staff found", description: tab === "pending" ? "Staff who request an account from the Staff Portal appear here." : undefined }}
        />
        {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="staff" />}
      </Card>
      {(modal?.type === "create" || modal?.type === "edit") && (
        <StaffFormModal staff={modal.user} api={api} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />
      )}
      {modal?.type === "assignments" && <AssignmentsModal staffId={modal.user.staff.id} api={api} onClose={() => setModal(null)} onChanged={refetch} />}
      {modal?.type === "password" && <ResetPasswordModal user={modal.user} api={api} onClose={() => setModal(null)} />}
      {tab === "pending" && data?.items.length > 0 && <p className="text-sm muted mt-4"><Badge tone="warning" dot>Pending</Badge> accounts cannot sign in until approved.</p>}
    </>
  );
}
