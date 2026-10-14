import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { AuthLayout } from "../layout/AuthLayout.jsx";
import { Button } from "../components/Button.jsx";
import { TextField, PasswordField } from "../components/Form.jsx";
import { Callout } from "../components/Feedback.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { usePageTitle } from "../hooks/index.js";

/**
 * Shared sign-in screen. The portal (student / staff / admin) is fixed by the app, so there
 * is no role picker: the server decides whether this account may use this portal.
 */
export function LoginPage({ portalName, headline, description, features, usernameLabel = "Username", usernameHint, usernamePlaceholder, validateUsername, registerLink, otherPortals = [] }) {
  usePageTitle("Sign in");
  const { login, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    clearNotice();
    const next = {};
    const username = form.username.trim();
    if (!username) next.username = `${usernameLabel} is required`;
    else if (validateUsername) {
      const msg = validateUsername(username);
      if (msg) next.username = msg;
    }
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login(username, form.password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setFormError(err);
      setSubmitting(false);
    }
  };

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  return (
    <AuthLayout portalName={portalName} headline={headline} description={description} features={features}>
      <h1 className="auth-heading">Sign in</h1>
      <p className="auth-subheading">Welcome back. Enter your details to continue to the {portalName}.</p>

      <form className="auth-form" onSubmit={submit} noValidate>
        {notice && (
          <Callout tone="warning" title="Signed out">
            {notice}
          </Callout>
        )}
        {formError && (
          <Callout tone="danger" title={formError.code === "WRONG_PORTAL" ? "Wrong portal" : formError.code === "ACCOUNT_PENDING" ? "Awaiting approval" : "Couldn't sign you in"}>
            {formError.message}
          </Callout>
        )}
        <TextField
          label={usernameLabel}
          name="username"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={usernamePlaceholder}
          hint={usernameHint}
          value={form.username}
          onChange={set("username")}
          error={errors.username}
          required
          autoFocus
        />
        <PasswordField name="password" autoComplete="current-password" value={form.password} onChange={set("password")} error={errors.password} required placeholder="Enter your password" />
        <Button type="submit" size="lg" block loading={submitting} icon={LogIn}>
          Sign in
        </Button>
      </form>

      {registerLink && (
        <p className="auth-alt">
          {registerLink.prompt} <Link to={registerLink.to}>{registerLink.label}</Link>
        </p>
      )}
      {otherPortals.length > 0 && (
        <div className="auth-portal-switch">
          {otherPortals.map((p) => (
            <a key={p.label} href={p.href}>
              {p.label}
            </a>
          ))}
        </div>
      )}
    </AuthLayout>
  );
}
