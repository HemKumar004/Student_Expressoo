import { useState } from "react";
import { Ellipsis, GraduationCap, KeyRound, Pencil, Plus, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Menu,
  Modal,
  PageHeader,
  Pagination,
  PersonCell,
  SearchInput,
  Select,
  SelectField,
  StatusBadge,
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
  REP_LABELS,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";
import { ResetPasswordModal, TempPasswordField, useStatusChange } from "../components/AccountActions.jsx";

function StudentFormModal({ student, onClose, onSaved, api }) {
  const toast = useToast();
  const { sections } = useReference();
  const editing = Boolean(student);
  const [form, setForm] = useState({
    fullName: student?.fullName || "",
    rollNumber: student?.student?.rollNumber || "",
    email: student?.email || "",
    mobile: student?.mobile || "",
    sectionId: student?.student?.sectionId ? String(student.student.sectionId) : "",
    admissionYear: student?.student?.admissionYear ? String(student.student.admissionYear) : "",
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
    if (!/^[A-Za-z0-9]{10}$/.test(form.rollNumber.trim())) errs.rollNumber = "Exactly 10 letters or digits";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!/^\+?\d{10,15}$/.test(form.mobile)) errs.mobile = "Enter 10–15 digits";
    if (!form.sectionId) errs.sectionId = "Choose a class";
    if (!editing && !/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(form.password)) errs.password = "At least 8 characters with a letter and a number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = {
        fullName: form.fullName,
        rollNumber: form.rollNumber.trim().toUpperCase(),
        email: form.email,
        mobile: form.mobile,
        sectionId: Number(form.sectionId),
        admissionYear: form.admissionYear ? Number(form.admissionYear) : null,
      };
      if (editing) await api.patch(`/students/${student.student.id}`, body);
      else await api.post("/students", { ...body, password: form.password });
      toast.success(editing ? "Student updated" : "Student created", editing ? form.fullName : `${form.fullName} can sign in with roll number ${body.rollNumber}.`);
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, editing ? "Couldn't update the student" : "Couldn't create the student");
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
      title={editing ? `Edit ${student.fullName}` : "Add a student"}
      description={editing ? "Moving a student to another class removes any CR/LR designation." : "The student signs in with their roll number."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" loading={saving}>
            {editing ? "Save changes" : "Create student"}
          </Button>
        </>
      }
    >
      <form id="student-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Full name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} required className="span-2" />
        <TextField label="Roll number" value={form.rollNumber} onChange={set("rollNumber")} error={errors.rollNumber} required maxLength={10} className="mono" />
        <SelectField label="Class" value={form.sectionId} onChange={set("sectionId")} error={errors.sectionId} required>
          <option value="">Select class</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} — {s.course?.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <TextField label="Mobile" type="tel" value={form.mobile} onChange={set("mobile")} error={errors.mobile} required />
        <TextField label="Admission year" type="number" min={1990} max={2100} value={form.admissionYear} onChange={set("admissionYear")} error={errors.admissionYear} optional />
        {!editing && (
          <div className="span-2">
            <TempPasswordField value={form.password} onChange={set("password")} error={errors.password} />
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function Students() {
  usePageTitle("Students");
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { courses, sections } = useReference();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ courseId: "", sectionId: "", status: "", representativeRole: "", page: 1, sort: "rollNumber", order: "asc" });
  const [modal, setModal] = useState(null);
  const q = useDebouncedValue(search, 300);
  const { data, error, loading, refetch } = useApi(() => api.get("/students", { query: { ...filters, search: q || undefined, pageSize: 20 } }), [filters, q]);
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const changeStatus = useStatusChange(api, refetch);

  const setRep = async (u, role) => {
    const label = REP_LABELS[role];
    const ok = await confirm({
      title: role === "NONE" ? `Remove ${u.fullName}'s representative role?` : `Make ${u.fullName} the ${label}?`,
      message: role === "NONE" ? "They will lose access to the representative desk." : `Each class has one ${role}. If ${u.student.section?.label} already has one, they'll return to a regular student.`,
      confirmLabel: role === "NONE" ? "Remove role" : `Assign ${role}`,
      tone: role === "NONE" ? "warning" : "primary",
    });
    if (!ok) return;
    try {
      const r = await api.patch(`/students/${u.student.id}/representative`, { representativeRole: role });
      toast.success(role === "NONE" ? "Representative role removed" : `${u.fullName} is now ${role}`, r.replaced ? `${r.replaced.fullName} is no longer ${role}.` : undefined);
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  const sectionOptions = filters.courseId ? sections.filter((s) => String(s.courseId) === filters.courseId) : sections;

  const columns = [
    { key: "name", header: "Student", sortable: true, render: (u) => <PersonCell name={u.fullName} sub={u.email} /> },
    { key: "rollNumber", header: "Roll no.", sortable: true, render: (u) => <span className="mono">{u.student.rollNumber}</span> },
    { key: "section", header: "Class", render: (u) => u.student.section?.label },
    { key: "rep", header: "Role", render: (u) => (u.student.representativeRole !== "NONE" ? <Badge tone="primary">{u.student.representativeRole}</Badge> : <span className="muted">Student</span>), hideOnMobile: true },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
    { key: "lastLogin", header: "Last sign-in", render: (u) => (u.lastLoginAt ? formatRelative(u.lastLoginAt) : <span className="muted">Never</span>), hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "cell-actions",
      render: (u) => (
        <Menu
          label={`Actions for ${u.fullName}`}
          items={[
            { label: "Edit details", icon: Pencil, onClick: () => setModal({ type: "edit", user: u }) },
            u.status === "ACTIVE" && u.student.representativeRole !== "CR" && { label: "Make Class Representative", icon: ShieldCheck, onClick: () => setRep(u, "CR") },
            u.status === "ACTIVE" && u.student.representativeRole !== "LR" && { label: "Make Ladies Representative", icon: ShieldCheck, onClick: () => setRep(u, "LR") },
            u.student.representativeRole !== "NONE" && { label: "Remove representative role", icon: ShieldOff, onClick: () => setRep(u, "NONE") },
            { label: "Reset password", icon: KeyRound, onClick: () => setModal({ type: "password", user: u }) },
            { separator: true },
            u.status === "ACTIVE"
              ? { label: "Deactivate account", icon: UserX, danger: true, onClick: () => changeStatus(u, "INACTIVE") }
              : { label: "Activate account", icon: UserCheck, onClick: () => changeStatus(u, "ACTIVE") },
          ]}
          trigger={(props) => (
            <button type="button" className="icon-btn icon-btn-sm" aria-label={`Actions for ${u.fullName}`} {...props}>
              <Ellipsis aria-hidden="true" />
            </button>
          )}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Students" description="Create and manage student accounts, classes and representative roles." actions={<Button icon={Plus} onClick={() => setModal({ type: "create" })}>Add student</Button>} />
      <Card flush refreshing={loading && Boolean(data)}>
        <div className="toolbar">
          <SearchInput value={search} onChange={(v) => { setSearch(v); update({}); }} placeholder="Search name, email or roll number" label="Search students" />
          <Select aria-label="Course" value={filters.courseId} onChange={(e) => update({ courseId: e.target.value, sectionId: "" })}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </Select>
          <Select aria-label="Class" value={filters.sectionId} onChange={(e) => update({ sectionId: e.target.value })}>
            <option value="">All classes</option>
            {sectionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <Select aria-label="Role" value={filters.representativeRole} onChange={(e) => update({ representativeRole: e.target.value })}>
            <option value="">Any role</option>
            <option value="CR">Class Representatives</option>
            <option value="LR">Ladies Representatives</option>
            <option value="NONE">Students</option>
          </Select>
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={refetch}
          sort={{ key: filters.sort, dir: filters.order }}
          onSortChange={(s) => update({ sort: s.key, order: s.dir })}
          empty={{ icon: GraduationCap, title: q ? "No students match your search" : "No students yet", description: q ? "Try a different name or roll number." : "Add students here, or let them self-register from the Student Portal." }}
        />
        {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="students" />}
      </Card>
      {(modal?.type === "create" || modal?.type === "edit") && (
        <StudentFormModal
          student={modal.user}
          api={api}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refetch();
          }}
        />
      )}
      {modal?.type === "password" && <ResetPasswordModal user={modal.user} api={api} onClose={() => setModal(null)} />}
    </>
  );
}
