import { forwardRef, useId, useState } from "react";
import { CircleAlert, Eye, EyeOff, Search, X } from "lucide-react";
import { cx } from "../utils/format.js";

export const Input = forwardRef(function Input({ className, invalid, size, ...rest }, ref) {
  return <input ref={ref} className={cx("input", size === "sm" && "input-sm", className)} aria-invalid={invalid || undefined} {...rest} />;
});

export const Select = forwardRef(function Select({ className, invalid, size, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx("select", size === "sm" && "select-sm", className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={cx("textarea", className)} aria-invalid={invalid || undefined} {...rest} />;
});

/** Label + control + hint/error, with ids wired for screen readers. */
export function Field({ label, hint, error, required, optional, className, children, id: idProp }) {
  const autoId = useId();
  const id = idProp || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("field", className)}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              *
            </span>
          )}
          {optional && <span className="field-optional">(optional)</span>}
        </label>
      )}
      {children({ id, "aria-describedby": describedBy, invalid: Boolean(error), required })}
      {error ? (
        <p className="field-error" id={errorId}>
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={hintId}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export const TextField = forwardRef(function TextField({ label, hint, error, required, optional, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} className={className}>
      {(p) => <Input ref={ref} {...p} {...rest} />}
    </Field>
  );
});

export const SelectField = forwardRef(function SelectField({ label, hint, error, required, optional, className, children, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} className={className}>
      {(p) => (
        <Select ref={ref} {...p} {...rest}>
          {children}
        </Select>
      )}
    </Field>
  );
});

export const TextareaField = forwardRef(function TextareaField({ label, hint, error, required, optional, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} className={className}>
      {(p) => <Textarea ref={ref} {...p} {...rest} />}
    </Field>
  );
});

export const PasswordField = forwardRef(function PasswordField({ label = "Password", hint, error, required, className, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <div className="input-group has-action">
          <Input ref={ref} type={visible ? "text" : "password"} {...p} {...rest} style={{ paddingLeft: 12 }} />
          <button
            type="button"
            className="icon-btn icon-btn-sm password-toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
});

export function SearchInput({ value, onChange, placeholder = "Search…", label = "Search", className, size, ...rest }) {
  return (
    <div className={cx("input-group", value && "has-action", className)}>
      <Search className="input-icon" aria-hidden="true" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} size={size} {...rest} />
      {value && (
        <button type="button" className="icon-btn icon-btn-sm input-action" onClick={() => onChange("")} aria-label="Clear search">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={cx("checkbox", className)}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}
