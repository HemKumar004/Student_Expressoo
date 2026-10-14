import { useState } from "react";
import { BookOpen, Download, Pencil, Trash2 } from "lucide-react";
import { Card, FileType } from "../components/Display.jsx";
import { Button, IconButton } from "../components/Button.jsx";
import { DataTable, Pagination } from "../components/DataTable.jsx";
import { SearchInput, Select, TextField, TextareaField, Checkbox } from "../components/Form.jsx";
import { Modal } from "../components/Overlay.jsx";
import { useToast, useConfirm } from "../components/Feedback.jsx";
import { useApi, useDebouncedValue, fieldErrors } from "../hooks/index.js";
import { formatDate, formatFileSize, formatNumber } from "../utils/format.js";

function EditMaterialModal({ material, onClose, onSaved, api }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: material.title, unit: material.unit || "", description: material.description || "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setErrors({ title: "Title is required" });
    setSaving(true);
    try {
      const updated = await api.patch(`/materials/${material.id}`, { title: form.title, unit: form.unit || null, description: form.description || null });
      toast.success("Material updated");
      onSaved(updated);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't update the material");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title="Edit study material"
      description={material.fileName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-material" loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-material" className="stack" onSubmit={save} noValidate>
        <TextField label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} required maxLength={200} />
        <TextField label="Unit / chapter" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} error={errors.unit} optional maxLength={40} />
        <TextareaField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} optional rows={3} />
      </form>
    </Modal>
  );
}

/**
 * Searchable study-material table used by all three portals.
 * mode: "student" (download), "staff" (download + manage own), "admin" (oversight).
 */
export function MaterialsLibrary({ api, mode = "student", subjects = [], reloadKey = 0, title = "Study materials", subtitle }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(null);
  const [editing, setEditing] = useState(null);
  const q = useDebouncedValue(search, 300);

  const { data, error, loading, refetch } = useApi(
    () => api.get("/materials", { query: { page, pageSize: 15, search: q || undefined, subjectId: subjectId || undefined, mine: mine || undefined } }),
    [page, q, subjectId, mine, reloadKey]
  );

  const download = async (m) => {
    setDownloading(m.id);
    try {
      await api.download(`/materials/${m.id}/download`, m.fileName);
    } catch (err) {
      toast.fromError(err, "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const remove = async (m) => {
    const ok = await confirm({
      title: "Delete this material?",
      message: `"${m.title}" and its file will be permanently removed for all students.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.del(`/materials/${m.id}`);
      toast.success("Material deleted");
      refetch();
    } catch (err) {
      toast.fromError(err, "Couldn't delete the material");
    }
  };

  const columns = [
    {
      key: "title",
      header: "Material",
      render: (m) => (
        <div className="cell-person" style={{ minWidth: 220 }}>
          <FileType extension={m.extension} />
          <div className="cell-stack">
            <span className="cell-primary">{m.title}</span>
            <span className="sub truncate" style={{ maxWidth: 320 }}>
              {m.unit ? `${m.unit} · ` : ""}
              {formatFileSize(m.sizeBytes)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      render: (m) => (
        <div className="cell-stack">
          <span className="medium" style={{ color: "var(--text-primary)" }}>
            {m.subject.code}
          </span>
          <span className="sub truncate" style={{ maxWidth: 220 }}>
            {m.subject.name}
          </span>
        </div>
      ),
    },
    mode !== "student" && { key: "audience", header: "Shared with", render: (m) => <span className="badge">{m.audienceLabel}</span>, hideOnMobile: true },
    mode !== "staff" && { key: "uploadedBy", header: "Shared by", render: (m) => m.uploadedBy?.fullName, hideOnMobile: true },
    { key: "createdAt", header: "Added", render: (m) => <span className="nowrap">{formatDate(m.createdAt)}</span>, hideOnMobile: true },
    mode !== "student" && { key: "downloads", header: "Downloads", align: "right", render: (m) => <span className="num">{formatNumber(m.downloadCount)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "cell-actions",
      render: (m) => (
        <div className="row-sm" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" size="sm" icon={Download} loading={downloading === m.id} onClick={() => download(m)} aria-label={`Download ${m.title}`}>
            <span className="hide-mobile">Download</span>
          </Button>
          {m.canManage && mode !== "student" && (
            <>
              <IconButton icon={Pencil} label={`Edit ${m.title}`} size="sm" onClick={() => setEditing(m)} />
              <IconButton icon={Trash2} label={`Delete ${m.title}`} size="sm" variant="danger" onClick={() => remove(m)} />
            </>
          )}
        </div>
      ),
    },
  ].filter(Boolean);

  return (
    <Card flush title={title} subtitle={subtitle ?? (data ? `${formatNumber(data.pagination.total)} file${data.pagination.total === 1 ? "" : "s"} available` : " ")}>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by title, unit or subject…"
          label="Search study materials"
        />
        {subjects.length > 0 && (
          <Select
            aria-label="Filter by subject"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </Select>
        )}
        {mode === "staff" && (
          <Checkbox
            label="Only my uploads"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked);
              setPage(1);
            }}
          />
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        empty={{
          icon: BookOpen,
          title: q || subjectId ? "No materials match your filters" : "No study materials yet",
          description: q || subjectId ? "Try a different search or subject." : mode === "student" ? "Notes and slides shared by your teachers will appear here." : "Upload notes, slides or lab manuals to share them with your classes.",
        }}
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="materials" />}
      {editing && (
        <EditMaterialModal
          material={editing}
          api={api}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </Card>
  );
}
