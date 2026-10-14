import { useState } from "react";
import { Building2, Layers, Pencil, Plus, Presentation, Trash2, Users, BookMarked } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  IconButton,
  Modal,
  PageHeader,
  Select,
  SelectField,
  Tabs,
  TextField,
  useApi,
  useAuth,
  useConfirm,
  usePageTitle,
  useToast,
  fieldErrors,
} from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

/** Generic create/edit form for simple academic entities. */
function EntityModal({ title, fields, initial, onClose, onSubmit }) {
  const toast = useToast();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? f.default ?? ""])));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    for (const f of fields) if (f.required && String(values[f.name] ?? "").trim() === "") errs[f.name] = `${f.label} is required`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = {};
      for (const f of fields) {
        const v = values[f.name];
        body[f.name] = f.type === "number" || f.type === "select" ? (v === "" || v === null ? null : Number(v)) : String(v).trim();
        if (f.optional && body[f.name] === null) delete body[f.name];
      }
      await onSubmit(body);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="entity-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="entity-form" className="form-grid" onSubmit={submit} noValidate>
        {fields.map((f) =>
          f.type === "select" ? (
            <SelectField key={f.name} label={f.label} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} error={errors[f.name]} required={f.required} optional={f.optional} className={f.wide ? "span-2" : undefined}>
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField
              key={f.name}
              label={f.label}
              type={f.type === "number" ? "number" : "text"}
              min={f.min}
              max={f.max}
              maxLength={f.maxLength}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              error={errors[f.name]}
              required={f.required}
              optional={f.optional}
              hint={f.hint}
              className={f.wide ? "span-2" : undefined}
            />
          )
        )}
      </form>
    </Modal>
  );
}

function useCrud(path, label, reload) {
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  return {
    create: async (body) => {
      await api.post(path, body);
      toast.success(`${label} created`);
      reload();
    },
    update: async (id, body) => {
      await api.patch(`${path}/${id}`, body);
      toast.success(`${label} updated`);
      reload();
    },
    remove: async (id, name) => {
      if (!(await confirm({ title: `Delete ${name}?`, message: `This ${label.toLowerCase()} will be permanently removed. Items that are still in use cannot be deleted.`, confirmLabel: "Delete", tone: "danger" }))) return;
      try {
        await api.del(`${path}/${id}`);
        toast.success(`${label} deleted`);
        reload();
      } catch (err) {
        toast.fromError(err, `Couldn't delete the ${label.toLowerCase()}`);
      }
    },
  };
}

function rowActions(onEdit, onDelete, name) {
  return (
    <div className="row-sm" style={{ justifyContent: "flex-end" }}>
      <IconButton icon={Pencil} size="sm" label={`Edit ${name}`} onClick={onEdit} />
      <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${name}`} onClick={onDelete} />
    </div>
  );
}

function Departments() {
  const ref = useReference();
  const crud = useCrud("/academics/departments", "Department", ref.reload);
  const [modal, setModal] = useState(null);
  const fields = [
    { name: "code", label: "Code", required: true, maxLength: 16, hint: "Short code, e.g. CSE" },
    { name: "name", label: "Name", required: true, maxLength: 120 },
  ];
  return (
    <Card flush title="Departments" actions={<Button size="sm" icon={Plus} onClick={() => setModal({})}>Add department</Button>}>
      <div style={{ height: 12 }} />
      <DataTable
        rows={ref.loading ? undefined : ref.departments}
        loading={ref.loading}
        defaultSort={{ key: "code", dir: "asc" }}
        empty={{ icon: Building2, title: "No departments yet" }}
        columns={[
          { key: "code", header: "Code", sortable: true, render: (d) => <span className="cell-primary">{d.code}</span> },
          { key: "name", header: "Name", sortable: true },
          { key: "courseCount", header: "Courses", align: "right", sortable: true },
          { key: "staffCount", header: "Staff", align: "right", sortable: true },
          { key: "actions", header: <span className="sr-only">Actions</span>, className: "cell-actions", render: (d) => rowActions(() => setModal({ item: d }), () => crud.remove(d.id, d.name), d.name) },
        ]}
      />
      {modal && <EntityModal title={modal.item ? "Edit department" : "Add department"} fields={fields} initial={modal.item} onClose={() => setModal(null)} onSubmit={(b) => (modal.item ? crud.update(modal.item.id, b) : crud.create(b))} />}
    </Card>
  );
}

function Courses() {
  const ref = useReference();
  const crud = useCrud("/academics/courses", "Course", ref.reload);
  const [modal, setModal] = useState(null);
  const fields = [
    { name: "code", label: "Code", required: true, maxLength: 20, hint: "e.g. CSE" },
    { name: "durationYears", label: "Duration (years)", type: "number", min: 1, max: 6, required: true, default: 4 },
    { name: "name", label: "Name", required: true, maxLength: 150, wide: true },
    { name: "departmentId", label: "Department", type: "select", required: true, wide: true, options: ref.departments.map((d) => ({ value: d.id, label: d.name })) },
  ];
  return (
    <Card flush title="Courses" subtitle="Programmes of study offered by each department" actions={<Button size="sm" icon={Plus} onClick={() => setModal({})}>Add course</Button>}>
      <div style={{ height: 12 }} />
      <DataTable
        rows={ref.loading ? undefined : ref.courses}
        loading={ref.loading}
        defaultSort={{ key: "code", dir: "asc" }}
        empty={{ icon: BookMarked, title: "No courses yet" }}
        columns={[
          { key: "code", header: "Code", sortable: true, render: (c) => <span className="cell-primary">{c.code}</span> },
          { key: "name", header: "Name", sortable: true },
          { key: "department", header: "Department", render: (c) => c.department?.code, hideOnMobile: true },
          { key: "durationYears", header: "Years", align: "right", hideOnMobile: true },
          { key: "sectionCount", header: "Sections", align: "right", sortable: true },
          { key: "subjectCount", header: "Subjects", align: "right", sortable: true, hideOnMobile: true },
          { key: "actions", header: <span className="sr-only">Actions</span>, className: "cell-actions", render: (c) => rowActions(() => setModal({ item: { ...c } }), () => crud.remove(c.id, c.code), c.code) },
        ]}
      />
      {modal && <EntityModal title={modal.item ? "Edit course" : "Add course"} fields={fields} initial={modal.item} onClose={() => setModal(null)} onSubmit={(b) => (modal.item ? crud.update(modal.item.id, b) : crud.create(b))} />}
    </Card>
  );
}

function Sections() {
  const ref = useReference();
  const crud = useCrud("/academics/sections", "Section", ref.reload);
  const [modal, setModal] = useState(null);
  const [courseId, setCourseId] = useState("");
  const fields = [
    { name: "courseId", label: "Course", type: "select", required: true, wide: true, options: ref.courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })) },
    { name: "yearOfStudy", label: "Year of study", type: "number", min: 1, max: 6, required: true },
    { name: "name", label: "Section name", required: true, maxLength: 10, hint: "e.g. A" },
  ];
  const rows = ref.sections.filter((s) => !courseId || String(s.courseId) === courseId);
  return (
    <Card flush title="Sections" subtitle="Class groups — students belong to exactly one section" actions={<Button size="sm" icon={Plus} onClick={() => setModal({})}>Add section</Button>}>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <Select aria-label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">All courses</option>
          {ref.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        rows={ref.loading ? undefined : rows}
        loading={ref.loading}
        defaultSort={{ key: "label", dir: "asc" }}
        empty={{ icon: Users, title: "No sections yet" }}
        columns={[
          { key: "label", header: "Section", sortable: true, render: (s) => <span className="cell-primary">{s.label}</span> },
          { key: "course", header: "Course", render: (s) => s.course?.name, hideOnMobile: true },
          { key: "yearOfStudy", header: "Year", align: "right", sortable: true },
          { key: "studentCount", header: "Students", align: "right", sortable: true },
          { key: "assignmentCount", header: "Teaching assignments", align: "right", hideOnMobile: true },
          { key: "actions", header: <span className="sr-only">Actions</span>, className: "cell-actions", render: (s) => rowActions(() => setModal({ item: s }), () => crud.remove(s.id, s.label), s.label) },
        ]}
      />
      {modal && <EntityModal title={modal.item ? "Edit section" : "Add section"} fields={fields} initial={modal.item} onClose={() => setModal(null)} onSubmit={(b) => (modal.item ? crud.update(modal.item.id, b) : crud.create(b))} />}
    </Card>
  );
}

function Subjects() {
  const ref = useReference();
  const crud = useCrud("/academics/subjects", "Subject", ref.reload);
  const [modal, setModal] = useState(null);
  const [courseId, setCourseId] = useState("");
  const fields = [
    { name: "code", label: "Code", required: true, maxLength: 20, hint: "e.g. CS301" },
    { name: "courseId", label: "Course", type: "select", required: true, options: ref.courses.map((c) => ({ value: c.id, label: c.code })) },
    { name: "name", label: "Name", required: true, maxLength: 150, wide: true },
    { name: "yearOfStudy", label: "Year of study", type: "number", min: 1, max: 6, required: true },
    { name: "semester", label: "Semester", type: "number", min: 1, max: 12, optional: true },
    { name: "credits", label: "Credits", type: "number", min: 0, max: 20, optional: true },
  ];
  const rows = ref.subjects.filter((s) => !courseId || String(s.courseId) === courseId);
  return (
    <Card flush title="Subjects" subtitle="Taught to sections of the same course and year" actions={<Button size="sm" icon={Plus} onClick={() => setModal({})}>Add subject</Button>}>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <Select aria-label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">All courses</option>
          {ref.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        rows={ref.loading ? undefined : rows}
        loading={ref.loading}
        defaultSort={{ key: "code", dir: "asc" }}
        empty={{ icon: Layers, title: "No subjects yet" }}
        columns={[
          { key: "code", header: "Code", sortable: true, render: (s) => <span className="cell-primary">{s.code}</span> },
          { key: "name", header: "Name", sortable: true },
          { key: "course", header: "Course", render: (s) => s.course?.code, hideOnMobile: true },
          { key: "yearOfStudy", header: "Year", align: "right", sortable: true },
          { key: "semester", header: "Sem.", align: "right", hideOnMobile: true, render: (s) => s.semester ?? "—" },
          { key: "credits", header: "Credits", align: "right", hideOnMobile: true, render: (s) => s.credits ?? "—" },
          { key: "assignmentCount", header: "Taught to", align: "right", render: (s) => <span className="num">{s.assignmentCount}</span> },
          { key: "actions", header: <span className="sr-only">Actions</span>, className: "cell-actions", render: (s) => rowActions(() => setModal({ item: s }), () => crud.remove(s.id, s.code), s.code) },
        ]}
      />
      {modal && <EntityModal title={modal.item ? "Edit subject" : "Add subject"} fields={fields} initial={modal.item} onClose={() => setModal(null)} onSubmit={(b) => (modal.item ? crud.update(modal.item.id, b) : crud.create(b))} />}
    </Card>
  );
}

function Assignments() {
  const { api } = useAuth();
  const ref = useReference();
  const [sectionId, setSectionId] = useState("");
  const [modal, setModal] = useState(false);
  const list = useApi(() => api.get("/academics/assignments", { query: { sectionId: sectionId || undefined } }), [sectionId]);
  const staff = useApi(() => api.get("/staff", { query: { status: "ACTIVE", pageSize: 100, sort: "name" } }), [], { enabled: modal });
  const crud = useCrud("/academics/assignments", "Assignment", () => {
    list.refetch();
    ref.reload();
  });
  const section = ref.sections.find((s) => String(s.id) === sectionId);

  const fields = [
    { name: "staffId", label: "Staff member", type: "select", required: true, wide: true, options: (staff.data?.items || []).map((u) => ({ value: u.staff.id, label: `${u.fullName} (${u.staff.employeeId})` })) },
    { name: "sectionId", label: "Section", type: "select", required: true, options: ref.sections.map((s) => ({ value: s.id, label: s.label })) },
    { name: "subjectId", label: "Subject", type: "select", required: true, options: ref.subjects.map((s) => ({ value: s.id, label: `${s.code} · ${s.course?.code} Y${s.yearOfStudy}` })) },
  ];

  return (
    <Card flush title="Teaching assignments" subtitle="Who teaches which subject to which section — this controls staff permissions" actions={<Button size="sm" icon={Plus} onClick={() => setModal(true)}>Assign</Button>}>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <Select aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">All sections</option>
          {ref.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        {section && <Badge>{section.studentCount} students</Badge>}
      </div>
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (
        <DataTable
          rows={list.data?.items}
          loading={list.loading}
          empty={{ icon: Presentation, title: "No assignments", description: "Assign staff to subjects and sections so they can mark attendance and share material." }}
          columns={[
            { key: "section", header: "Section", sortable: true, sortValue: (a) => a.section.label, render: (a) => <span className="cell-primary">{a.section.label}</span> },
            { key: "subject", header: "Subject", sortable: true, sortValue: (a) => a.subject.code, render: (a) => <div className="cell-stack"><span className="medium" style={{ color: "var(--text-primary)" }}>{a.subject.code}</span><span className="sub">{a.subject.name}</span></div> },
            { key: "staff", header: "Staff member", sortable: true, sortValue: (a) => a.staff?.fullName, render: (a) => <div className="cell-stack"><span>{a.staff?.fullName}</span><span className="sub mono">{a.staff?.employeeId}</span></div> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "cell-actions", render: (a) => <IconButton icon={Trash2} size="sm" variant="danger" label="Remove assignment" onClick={() => crud.remove(a.id, `${a.staff?.fullName} — ${a.subject.code} · ${a.section.label}`)} /> },
          ]}
        />
      )}
      {modal && <EntityModal title="Assign a class" fields={fields} initial={{ sectionId }} onClose={() => setModal(false)} onSubmit={(b) => crud.create(b)} />}
    </Card>
  );
}

const TABS = [
  { id: "departments", label: "Departments", Component: Departments },
  { id: "courses", label: "Courses", Component: Courses },
  { id: "sections", label: "Sections", Component: Sections },
  { id: "subjects", label: "Subjects", Component: Subjects },
  { id: "assignments", label: "Teaching assignments", Component: Assignments },
];

export default function Academics() {
  usePageTitle("Academic structure");
  const ref = useReference();
  const [tab, setTab] = useState("sections");
  const Active = TABS.find((t) => t.id === tab).Component;
  const counts = { departments: ref.departments.length, courses: ref.courses.length, sections: ref.sections.length, subjects: ref.subjects.length };
  return (
    <>
      <PageHeader title="Academic structure" description="Departments, courses, sections and subjects — and the teaching assignments that connect staff to classes." />
      <Tabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: ref.loading ? undefined : counts[t.id] }))} />
      <div style={{ marginTop: 20 }}>{ref.error ? <Card><ErrorState error={ref.error} onRetry={ref.reload} /></Card> : <Active />}</div>
    </>
  );
}
