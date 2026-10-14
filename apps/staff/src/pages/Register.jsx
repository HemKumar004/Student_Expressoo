import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CircleCheck, ClipboardCheck, ShieldCheck, UserPlus } from "lucide-react";
import { AuthLayout, Button, Callout, PasswordField, SelectField, TextField, useApi, usePageTitle, fieldErrors } from "@expressoo/shared";
import { api } from "../lib/api.js";

const EMPTY = { fullName: "", employeeId: "", departmentId: "", designation: "", email: "", mobile: "", password: "", confirmPassword: "" };

function validate(f) {
  const e = {};
  if (f.fullName.trim().length < 2) e.fullName = "Enter your full name";
  if (!/^[A-Za-z0-9]{8}$/.test(f.employeeId.trim())) e.employeeId = "Employee ID must be exactly 8 letters or digits";
  if (!f.departmentId) e.departmentId = "Choose your department";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!/^\+?\d{10,15}$/.test(f.mobile.trim())) e.mobile = "Enter a valid mobile number (10–15 digits)";
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(f.password)) e.password = "Use at least 8 characters with a letter and a number";
  if (f.confirmPassword !== f.password) e.confirmPassword = "Passwords do not match";
  return e;
}

export default function Register() {
  usePageTitle("Request account");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const options = useApi(() => api.get("/meta/registration-options"), []);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post("/auth/register/staff", { ...form, employeeId: form.employeeId.trim().toUpperCase(), departmentId: Number(form.departmentId), designation: form.designation || null });
      setDone(true);
    } catch (err) {
      setErrors(fieldErrors(err));
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const layout = {
    portalName: "Staff Portal",
    headline: "Request access to the Staff Portal.",
    description: "Staff accounts are reviewed by the administration before they can sign in. You'll be notified once approved.",
    features: [
      { icon: ShieldCheck, title: "Verified access", text: "Only approved faculty can mark attendance or share material." },
      { icon: ClipboardCheck, title: "Your classes", text: "Subjects and sections are assigned by the administration." },
      { icon: BookOpen, title: "One workspace", text: "Attendance, materials, notices and alerts together." },
    ],
  };

  if (done) {
    return (
      <AuthLayout {...layout}>
        <div className="stack" style={{ alignItems: "flex-start" }}>
          <span className="modal-icon tone-primary" aria-hidden="true">
            <CircleCheck />
          </span>
          <h1 className="auth-heading">Request submitted</h1>
          <p className="auth-subheading">
            Thanks, {form.fullName.split(" ")[0]}. An administrator will review your account for <strong>{form.employeeId.toUpperCase()}</strong>. You can sign in once it has been approved.
          </p>
          <Button to="/login" size="lg">
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...layout} wide>
      <h1 className="auth-heading">Request a staff account</h1>
      <p className="auth-subheading">Use your official employee ID and college email address.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {submitError && !Object.keys(fieldErrors(submitError)).length && (
          <Callout tone="danger" title="Request failed">
            {submitError.message}
          </Callout>
        )}
        <div className="form-grid">
          <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} required className="span-2" />
          <TextField label="Employee ID" value={form.employeeId} onChange={set("employeeId")} error={errors.employeeId} required placeholder="STF10001" maxLength={8} autoCapitalize="characters" spellCheck={false} />
          <SelectField label="Department" value={form.departmentId} onChange={set("departmentId")} error={errors.departmentId} required disabled={options.loading}>
            <option value="">{options.loading ? "Loading…" : "Select department"}</option>
            {options.data?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
          <TextField label="Designation" value={form.designation} onChange={set("designation")} optional placeholder="e.g. Assistant Professor" className="span-2" />
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
          <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={form.mobile} onChange={set("mobile")} error={errors.mobile} required hint="Shared only with your classes' representatives for alerts" />
          <PasswordField label="Password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters with a letter and a number" required />
          <PasswordField label="Confirm password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} required />
        </div>
        <Button type="submit" size="lg" block loading={submitting} icon={UserPlus}>
          Submit request
        </Button>
      </form>
      <p className="auth-alt">
        Already approved? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
