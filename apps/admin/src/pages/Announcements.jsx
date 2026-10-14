import { useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  AnnouncementItem,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SelectField,
  SkeletonRows,
  TextField,
  TextareaField,
  useApi,
  useAuth,
  useConfirm,
  usePageTitle,
  useToast,
  fieldErrors,
} from "@expressoo/shared";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function AnnouncementModal({ item, onClose, onSaved, api }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: item?.title || "", body: item?.body || "", audience: item?.audience || "ALL", isPinned: item?.isPinned || false, expiresAt: toLocalInput(item?.expiresAt) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = "Add a title";
    if (!form.body.trim()) errs.body = "Write the announcement";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { ...form, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null };
      if (item) await api.put(`/announcements/${item.id}`, body);
      else await api.post("/announcements", body);
      toast.success(item ? "Announcement updated" : "Announcement published");
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't save the announcement");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} busy={saving} size="lg" title={item ? "Edit announcement" : "New announcement"} description="Announcements appear on dashboards and the notice board of the chosen audience." footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="announcement-form" loading={saving}>{item ? "Save changes" : "Publish"}</Button></>}>
      <form id="announcement-form" className="stack" onSubmit={submit} noValidate>
        <TextField label="Title" value={form.title} onChange={set("title")} error={errors.title} required maxLength={150} />
        <TextareaField label="Announcement" value={form.body} onChange={set("body")} error={errors.body} required rows={6} maxLength={10000} />
        <div className="form-grid">
          <SelectField label="Audience" value={form.audience} onChange={set("audience")}>
            <option value="ALL">Everyone</option>
            <option value="STUDENTS">Students</option>
            <option value="STAFF">Staff</option>
          </SelectField>
          <TextField label="Expires" type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} optional hint="Hidden from students and staff after this time" />
        </div>
        <Checkbox label="Pin to the top of the notice board" checked={form.isPinned} onChange={set("isPinned")} />
      </form>
    </Modal>
  );
}

export default function Announcements() {
  usePageTitle("Announcements");
  const { api } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [audience, setAudience] = useState("");
  const [modal, setModal] = useState(null);
  const { data, error, initialLoading, loading, refetch } = useApi(() => api.get("/announcements", { query: { page, pageSize: 10, includeExpired: true, audience: audience || undefined } }), [page, audience]);

  const remove = async (a) => {
    if (!(await confirm({ title: `Delete "${a.title}"?`, message: "It will disappear from every notice board.", confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await api.del(`/announcements/${a.id}`);
      toast.success("Announcement deleted");
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <>
      <PageHeader title="Announcements" description="Institution-wide notices for students, staff or everyone." actions={<Button icon={Plus} onClick={() => setModal({})}>New announcement</Button>} />
      <Card flush refreshing={loading && !initialLoading}>
        <div className="toolbar">
          <Select aria-label="Audience" value={audience} onChange={(e) => { setAudience(e.target.value); setPage(1); }}>
            <option value="">All audiences</option>
            <option value="ALL">Everyone</option>
            <option value="STUDENTS">Students</option>
            <option value="STAFF">Staff</option>
          </Select>
        </div>
        {initialLoading && <div style={{ padding: 24 }}><SkeletonRows rows={3} height={90} /></div>}
        {error && !data && <ErrorState error={error} onRetry={refetch} />}
        {data?.items.length === 0 && <EmptyState icon={Megaphone} title="No announcements" description="Publish a notice to reach students and staff on their dashboards." action={<Button size="sm" icon={Plus} onClick={() => setModal({})}>New announcement</Button>} />}
        {data?.items.length > 0 && (
          <div className="list">
            {data.items.map((a) => (
              <AnnouncementItem
                key={a.id}
                a={a}
                actions={
                  <div className="row-sm">
                    <IconButton icon={Pencil} size="sm" label={`Edit ${a.title}`} onClick={() => setModal({ item: a })} />
                    <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${a.title}`} onClick={() => remove(a)} />
                  </div>
                }
              />
            ))}
          </div>
        )}
        {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="announcements" />}
      </Card>
      {modal && <AnnouncementModal item={modal.item} api={api} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />}
    </>
  );
}
