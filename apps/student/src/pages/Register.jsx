import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CalendarCheck, UserPlus, Wallet } from "lucide-react";
import { AuthLayout, Button, Callout, PasswordField, SelectField, TextField, useApi, usePageTitle, useToast, fieldErrors } from "@expressoo/shared";
import { api } from "../lib/api.js";

const EMPTY = { fullName: "", rollNumber: "", email: "", mobile: "", sectionId: "", password: "", confirmPassword: "" };

function validate(f) {
  const e = {};
  if (f.fullName.trim().length < 2) e.fullName = "Enter your full name";
  if (!/^[A-Za-z0-9]{10}$/.test(f.rollNumber.trim())) e.rollNumber = "Roll number must be exactly 10 letters or digits";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!/^\+?\d{10,15}$/.test(f.mobile.trim())) e.mobile = "Enter a valid mobile number (10–15 digits)";
  if (!f.sectionId) e.sectionId = "Choose your class";
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(f.password)) e.password = "Use at least 8 characters with a letter and a number";
  if (f.confirmPassword !== f.password) e.confirmPassword = "Passwords do not match";
  return e;
}

export default function Register() {
  usePageTitle("Create account");
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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
      await api.post("/auth/register/student", { ...form, rollNumber: form.rollNumber.trim().toUpperCase(), sectionId: Number(form.sectionId) });
      toast.success("Account created", "Sign in with your roll number and password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setSubmitError(err);
      setSubmitting(false);
    }
  };

  const sections = options.data?.sections || [];
  const byCourse = sections.reduce((acc, s) => {
    (acc[s.courseName] = acc[s.courseName] || []).push(s);
    return acc;
  }, {});

  return (
    <AuthLayout
      wide
      portalName="Student Portal"
      headline="Join your class on Student Expressoo."
      description="Register once with your roll number. Your attendance, fees and study materials follow you automatically."
      features={[
        { icon: CalendarCheck, title: "Live attendance", text: "Updated the moment your teacher marks a class." },
        { icon: BookOpen, title: "Every handout", text: "Materials for your section, searchable and downloadable." },
        { icon: Wallet, title: "Transparent fees", text: "Bills and receipts recorded by the accounts office." },
      ]}
    >
      <h1 className="auth-heading">Create your student account</h1>
      <p className="auth-subheading">Use the roll number printed on your college ID card.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {submitError && !Object.keys(fieldErrors(submitError)).length && (
          <Callout tone="danger" title="Registration failed">
            {submitError.message}
          </Callout>
        )}
        {options.error && (
          <Callout tone="warning" title="Couldn't load classes">
            {options.error.message}
          </Callout>
        )}
        <div className="form-grid">
          <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} required className="span-2" />
          <TextField label="Roll number" value={form.rollNumber} onChange={set("rollNumber")} error={errors.rollNumber} required placeholder="23A91A0501" maxLength={10} autoCapitalize="characters" spellCheck={false} />
          <SelectField label="Class" value={form.sectionId} onChange={set("sectionId")} error={errors.sectionId} required disabled={options.loading}>
            <option value="">{options.loading ? "Loading classes…" : "Select your class"}</option>
            {Object.entries(byCourse).map(([course, list]) => (
              <optgroup key={course} label={course}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · Year {s.yearOfStudy}, Section {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
          <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={form.mobile} onChange={set("mobile")} error={errors.mobile} required />
          <PasswordField label="Password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters with a letter and a number" required />
          <PasswordField label="Confirm password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} required />
        </div>
        <Button type="submit" size="lg" block loading={submitting} icon={UserPlus}>
          Create account
        </Button>
      </form>
      <p className="auth-alt">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
