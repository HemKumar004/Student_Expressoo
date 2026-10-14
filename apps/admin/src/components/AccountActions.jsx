import { useState } from "react";
import { Copy, KeyRound, Sparkles } from "lucide-react";
import { Button, Callout, Field, Input, Modal, useConfirm, useToast, fieldErrors, generatePassword } from "@expressoo/shared";

/** Password input with a "generate" button for issuing temporary passwords. */
export function TempPasswordField({ value, onChange, error, label = "Temporary password" }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy", "Select the password and copy it manually.");
    }
  };
  return (
    <Field label={label} error={error} hint="Share it with the person securely; they can change it from their profile." required>
      {(p) => (
        <div className="row-sm">
          <Input {...p} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" spellCheck={false} className="mono" />
          <Button variant="secondary" icon={Sparkles} onClick={() => onChange(generatePassword())} aria-label="Generate a password" title="Generate" />
          <Button variant="secondary" icon={Copy} onClick={copy} disabled={!value} aria-label="Copy password" title="Copy" />
        </div>
      )}
    </Field>
  );
}

export function ResetPasswordModal({ user, onClose, api }) {
  const toast = useToast();
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(password)) return setError("Use at least 8 characters with a letter and a number");
    setSaving(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { password });
      toast.success("Password reset", `${user.fullName} has been signed out of all devices.`);
      onClose();
    } catch (err) {
      setError(fieldErrors(err).password || err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      icon={<span className="modal-icon tone-warning"><KeyRound aria-hidden="true" /></span>}
      title={`Reset password for ${user.fullName}`}
      description={`${user.username} · existing sessions will be signed out immediately.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="reset-password" loading={saving}>
            Reset password
          </Button>
        </>
      }
    >
      <form id="reset-password" className="stack" onSubmit={submit} noValidate>
        <TempPasswordField value={password} onChange={(v) => { setPassword(v); setError(null); }} error={error} label="New password" />
        <Callout tone="info">Copy the password before resetting — it won't be shown again.</Callout>
      </form>
    </Modal>
  );
}

/** Confirm + perform an account status change; returns a function (user, status) => Promise<boolean>. */
export function useStatusChange(api, onDone) {
  const confirm = useConfirm();
  const toast = useToast();
  return async (user, status) => {
    const copy = {
      ACTIVE: user.status === "PENDING"
        ? { title: `Approve ${user.fullName}?`, message: "They will be able to sign in immediately and will be notified.", confirmLabel: "Approve", tone: "primary" }
        : { title: `Reactivate ${user.fullName}?`, message: "They will be able to sign in again.", confirmLabel: "Reactivate", tone: "primary" },
      INACTIVE: { title: `Deactivate ${user.fullName}?`, message: "They will be signed out everywhere and can no longer sign in. Their records are kept and you can reactivate them later.", confirmLabel: "Deactivate", tone: "danger" },
    }[status];
    if (!(await confirm(copy))) return false;
    try {
      await api.patch(`/users/${user.id}/status`, { status });
      toast.success(status === "ACTIVE" ? (user.status === "PENDING" ? "Account approved" : "Account reactivated") : "Account deactivated", user.fullName);
      onDone?.();
      return true;
    } catch (err) {
      toast.fromError(err, "Couldn't change the account status");
      return false;
    }
  };
}
