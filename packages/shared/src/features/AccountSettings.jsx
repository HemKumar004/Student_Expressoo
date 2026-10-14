import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { Card } from "../components/Display.jsx";
import { Button } from "../components/Button.jsx";
import { TextField, PasswordField } from "../components/Form.jsx";
import { useToast } from "../components/Feedback.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { fieldErrors } from "../hooks/index.js";
import { formatDateTime } from "../utils/format.js";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Contact details + password change, shared by every portal's profile page. */
export function AccountSettings() {
  const { api, user, setSession } = useAuth();
  const toast = useToast();

  const [contact, setContact] = useState({ email: user.email, mobile: user.mobile || "" });
  const [contactErrors, setContactErrors] = useState({});
  const [savingContact, setSavingContact] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const contactDirty = contact.email !== user.email || (contact.mobile || "") !== (user.mobile || "");

  const saveContact = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) errs.email = "Enter a valid email address";
    if (contact.mobile && !/^\+?\d{10,15}$/.test(contact.mobile)) errs.mobile = "Enter 10–15 digits";
    setContactErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingContact(true);
    try {
      const { user: updated } = await api.patch("/auth/me", { email: contact.email, mobile: contact.mobile || null });
      setSession(null, updated);
      toast.success("Contact details updated");
    } catch (err) {
      setContactErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't update your details");
    } finally {
      setSavingContact(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.currentPassword) errs.currentPassword = "Enter your current password";
    if (!PASSWORD_RULE.test(pw.newPassword)) errs.newPassword = "Use at least 8 characters with a letter and a number";
    else if (pw.newPassword === pw.currentPassword) errs.newPassword = "Choose a different password";
    if (pw.confirmPassword !== pw.newPassword) errs.confirmPassword = "Passwords do not match";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingPw(true);
    try {
      const { token, user: updated } = await api.post("/auth/change-password", pw);
      setSession(token, updated);
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed", "Other devices have been signed out.");
    } catch (err) {
      setPwErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't change your password");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card title="Contact details" subtitle="Used for college communication and account recovery.">
        <form className="stack" onSubmit={saveContact} noValidate>
          <TextField label="Email" type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} error={contactErrors.email} required />
          <TextField label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" value={contact.mobile} onChange={(e) => setContact((c) => ({ ...c, mobile: e.target.value }))} error={contactErrors.mobile} optional />
          <p className="text-sm muted">Last sign-in: {formatDateTime(user.lastLoginAt)}</p>
          <div className="form-actions">
            <Button type="submit" icon={Save} loading={savingContact} disabled={!contactDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Change password" subtitle="Use at least 8 characters, including a letter and a number.">
        <form className="stack" onSubmit={changePassword} noValidate>
          <PasswordField label="Current password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} error={pwErrors.currentPassword} required />
          <PasswordField label="New password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} error={pwErrors.newPassword} required />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))} error={pwErrors.confirmPassword} required />
          <div className="form-actions">
            <Button type="submit" icon={KeyRound} loading={savingPw}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
