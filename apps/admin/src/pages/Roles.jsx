import { Fragment, useState } from "react";
import { Check, Minus, Plus, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  Modal,
  PageHeader,
  PersonCell,
  SkeletonRows,
  StatusBadge,
  TextField,
  useApi,
  useAuth,
  usePageTitle,
  useToast,
  fieldErrors,
  formatRelative,
  generatePassword,
} from "@expressoo/shared";
import { TempPasswordField, useStatusChange } from "../components/AccountActions.jsx";

const SCOPE_LABEL = { all: "All", own: "Own", assigned: "Assigned", section: "Own section" };

function PermissionMatrix() {
  const { api } = useAuth();
  const { data, error, initialLoading, refetch } = useApi(() => api.get("/meta/permissions"), []);
  if (initialLoading) return <Card title="Permission matrix"><SkeletonRows rows={6} /></Card>;
  if (error) return <Card title="Permission matrix"><ErrorState error={error} onRetry={refetch} /></Card>;
  const groups = [...new Set(data.capabilities.map((c) => c.group))];
  return (
    <Card flush title="Permission matrix" subtitle="Enforced by the API on every request. “Assigned” = classes the staff member teaches; “Own section” = the representative's class.">
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table table-compact">
          <thead>
            <tr>
              <th scope="col">Capability</th>
              {data.roles.map((r) => (
                <th key={r.key} scope="col" className="align-center" title={r.description}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr>
                  <td colSpan={data.roles.length + 1} className="eyebrow" style={{ background: "var(--surface-subtle)", paddingTop: 10, paddingBottom: 6 }}>
                    {g}
                  </td>
                </tr>
                {data.capabilities
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <tr key={c.key}>
                      <td className="cell-primary" style={{ fontWeight: 500 }}>
                        {c.label}
                      </td>
                      {data.roles.map((r) => (
                        <td key={r.key} className="align-center">
                          {c[r.key] ? (
                            <span className="badge badge-success" title={SCOPE_LABEL[c[r.key]]}>
                              <Check aria-hidden="true" />
                              {SCOPE_LABEL[c[r.key]]}
                            </span>
                          ) : (
                            <Minus aria-label="Not allowed" style={{ width: 16, height: 16, color: "var(--gray-300)", margin: "0 auto" }} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CreateAdminModal({ onClose, onSaved, api }) {
  const toast = useToast();
  const [form, setForm] = useState({ fullName: "", username: "", email: "", mobile: "", password: generatePassword() });
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
    if (!/^[a-z0-9._-]{4,50}$/i.test(form.username)) errs.username = "4–50 letters, digits, dot, dash or underscore";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(form.password)) errs.password = "At least 8 characters with a letter and a number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api.post("/users/admins", { ...form, username: form.username.toLowerCase(), mobile: form.mobile || null });
      toast.success("Administrator added", `${form.fullName} can now sign in to the Admin Console.`);
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't add the administrator");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} busy={saving} size="lg" icon={<span className="modal-icon tone-warning"><ShieldCheck aria-hidden="true" /></span>} title="Grant administrator access" description="Administrators have full control over accounts, fees and records. Grant this only to trusted office staff." footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="admin-form" loading={saving}>Create administrator</Button></>}>
      <form id="admin-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Full name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} required className="span-2" />
        <TextField label="Username" value={form.username} onChange={set("username")} error={errors.username} required autoCapitalize="none" />
        <TextField label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <TextField label="Mobile" type="tel" value={form.mobile} onChange={set("mobile")} optional />
        <div className="span-2">
          <TempPasswordField value={form.password} onChange={set("password")} error={errors.password} />
        </div>
      </form>
    </Modal>
  );
}

function Administrators() {
  const { api, user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, error, loading, refetch } = useApi(() => api.get("/users/admins"), []);
  const changeStatus = useStatusChange(api, refetch);
  return (
    <Card flush title="Administrators" subtitle="At least one active administrator is always required" actions={<Button size="sm" icon={Plus} onClick={() => setOpen(true)}>Add administrator</Button>}>
      <div style={{ height: 12 }} />
      <DataTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        empty={{ icon: ShieldCheck, title: "No administrators" }}
        columns={[
          { key: "name", header: "Administrator", render: (u) => <div className="row-sm"><PersonCell name={u.fullName} sub={u.email} />{u.id === user.id && <Badge tone="primary">You</Badge>}</div> },
          { key: "username", header: "Username", render: (u) => <span className="mono">{u.username}</span> },
          { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
          { key: "lastLogin", header: "Last sign-in", hideOnMobile: true, render: (u) => (u.lastLoginAt ? formatRelative(u.lastLoginAt) : <span className="muted">Never</span>) },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "cell-actions",
            render: (u) =>
              u.id === user.id ? null : u.status === "ACTIVE" ? (
                <Button size="sm" variant="danger-ghost" icon={UserX} onClick={() => changeStatus(u, "INACTIVE")}>Revoke</Button>
              ) : (
                <Button size="sm" variant="secondary" icon={UserCheck} onClick={() => changeStatus(u, "ACTIVE")}>Restore</Button>
              ),
          },
        ]}
      />
      {open && <CreateAdminModal api={api} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refetch(); }} />}
    </Card>
  );
}

function Representatives() {
  const { api } = useAuth();
  const cr = useApi(() => api.get("/students", { query: { representativeRole: "CR", pageSize: 100 } }), []);
  const lr = useApi(() => api.get("/students", { query: { representativeRole: "LR", pageSize: 100 } }), []);
  const rows = [...(cr.data?.items || []), ...(lr.data?.items || [])].sort((a, b) => (a.student.section?.label || "").localeCompare(b.student.section?.label || "") || a.student.representativeRole.localeCompare(b.student.representativeRole));
  return (
    <Card flush title="Class & Ladies Representatives" subtitle="One CR and one LR per section. Change them from the Students page." actions={<Button size="sm" variant="secondary" to="/students">Students</Button>}>
      <div style={{ height: 12 }} />
      <DataTable
        rows={cr.loading || lr.loading ? undefined : rows}
        loading={cr.loading || lr.loading}
        rowKey={(u) => u.id}
        empty={{ icon: Users, title: "No representatives assigned", description: "Assign CR/LR roles from the actions menu on the Students page." }}
        columns={[
          { key: "section", header: "Section", render: (u) => <span className="cell-primary">{u.student.section?.label}</span> },
          { key: "role", header: "Role", render: (u) => <Badge tone="primary">{u.student.representativeRole}</Badge> },
          { key: "student", header: "Student", render: (u) => <PersonCell name={u.fullName} sub={u.student.rollNumber} /> },
          { key: "mobile", header: "Mobile", hideOnMobile: true, render: (u) => u.mobile || "—" },
        ]}
      />
    </Card>
  );
}

export default function Roles() {
  usePageTitle("Roles & access");
  return (
    <>
      <PageHeader title="Roles & access" description="Who can do what. Roles are always decided on the server — never by what a browser sends." />
      <div className="stack-lg">
        <PermissionMatrix />
        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <Administrators />
          <Representatives />
        </div>
      </div>
    </>
  );
}
