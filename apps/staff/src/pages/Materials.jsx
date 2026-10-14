import { useRef, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  FileDropzone,
  MaterialsLibrary,
  PageHeader,
  ProgressBar,
  SelectField,
  TextField,
  TextareaField,
  useAppConfig,
  useAuth,
  usePageTitle,
  useToast,
  fieldErrors,
} from "@expressoo/shared";
import { useAssignments } from "../lib/useAssignments.js";

const EMPTY = { target: "", title: "", unit: "", description: "" };

export default function Materials() {
  usePageTitle("Study materials");
  const { api } = useAuth();
  const toast = useToast();
  const config = useAppConfig(api);
  const assignments = useAssignments();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef(null);

  const accept = config?.rules.allowedUploadExtensions || [".pdf", ".doc", ".docx", ".ppt", ".pptx"];
  const maxMb = config?.rules.maxUploadMb || 20;

  // Targets: one per assignment, plus "all my sections" per subject taught to several sections.
  const targets = [
    ...assignments.items.map((a) => ({ value: `${a.subject.id}:${a.section.id}`, label: `${a.subject.code} · ${a.section.label} — ${a.subject.name}` })),
    ...assignments.subjects
      .filter((s) => assignments.items.filter((a) => a.subject.id === s.id).length > 1)
      .map((s) => ({ value: `${s.id}:all`, label: `${s.code} · All my sections — ${s.name}` })),
  ];

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.target) errs.target = "Choose the subject and section";
    if (!form.title.trim()) errs.title = "Give the material a title";
    if (!file) errs.file = "Choose a file to upload";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const [subjectId, sectionId] = form.target.split(":");
    const data = new FormData();
    data.append("title", form.title.trim());
    data.append("subjectId", subjectId);
    data.append("sectionId", sectionId === "all" ? "" : sectionId);
    if (form.unit.trim()) data.append("unit", form.unit.trim());
    if (form.description.trim()) data.append("description", form.description.trim());
    data.append("file", file);

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      const m = await api.upload("/materials", data, { onProgress: setProgress, signal: controller.signal });
      toast.success("Material shared", `"${m.title}" is now available to ${m.audienceLabel}. Students have been notified.`);
      setForm(EMPTY);
      setFile(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err?.name === "AbortError") toast.info("Upload cancelled");
      else {
        setErrors(fieldErrors(err));
        toast.fromError(err, "Upload failed");
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const uploading = progress !== null;

  return (
    <>
      <PageHeader title="Study materials" description="Share notes, slides and lab manuals with the sections you teach. Students are notified when you upload." />
      <div className="grid grid-aside-main" style={{ alignItems: "start" }}>
        <Card title="Upload material" subtitle="Files are checked for type and size before they're stored.">
          {assignments.items.length === 0 && !assignments.loading ? (
            <Callout tone="warning" title="No classes assigned">
              You can upload once the administration assigns you to a subject and section.
            </Callout>
          ) : (
            <form className="stack" onSubmit={submit} noValidate>
              <SelectField label="Share with" value={form.target} onChange={(e) => set("target", e.target.value)} error={errors.target} required disabled={uploading || assignments.loading}>
                <option value="">{assignments.loading ? "Loading your classes…" : "Select subject and section"}</option>
                {targets.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectField>
              <TextField label="Title" value={form.title} onChange={(e) => set("title", e.target.value)} error={errors.title} required maxLength={200} placeholder="e.g. Normalization — 1NF to BCNF" disabled={uploading} />
              <TextField label="Unit / chapter" value={form.unit} onChange={(e) => set("unit", e.target.value)} optional maxLength={40} placeholder="e.g. Unit-3" disabled={uploading} />
              <TextareaField label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} optional rows={3} maxLength={2000} disabled={uploading} />
              <FileDropzone
                file={file}
                onFileChange={(f) => {
                  setFile(f);
                  setErrors((x) => ({ ...x, file: undefined }));
                }}
                accept={accept}
                maxSizeMb={maxMb}
                error={errors.file}
                disabled={uploading}
              />
              {uploading && <ProgressBar value={progress} label={progress < 100 ? "Uploading…" : "Processing on the server…"} />}
              <div className="row-sm">
                <Button type="submit" icon={CloudUpload} loading={uploading} block>
                  Upload and share
                </Button>
                {uploading && (
                  <Button variant="secondary" icon={X} onClick={() => abortRef.current?.abort()}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </Card>
        <MaterialsLibrary api={api} mode="staff" subjects={assignments.subjects} reloadKey={reloadKey} title="Materials for your classes" />
      </div>
    </>
  );
}
