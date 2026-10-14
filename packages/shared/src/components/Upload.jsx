import { useId, useRef, useState } from "react";
import { CloudUpload, X, CircleAlert } from "lucide-react";
import { cx, formatFileSize } from "../utils/format.js";
import { FileType } from "./Display.jsx";

/**
 * Drag-and-drop file picker with client-side type/size checks (the server re-validates
 * everything, including the file signature).
 */
export function FileDropzone({ file, onFileChange, accept = [], maxSizeMb = 20, error, disabled, label = "Study material file", hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  const id = useId();
  const shownError = error || localError;

  const pick = (f) => {
    if (!f) return;
    const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
    if (accept.length && !accept.includes(ext)) {
      setLocalError(`"${ext}" files are not supported. Allowed: ${accept.join(", ")}`);
      return;
    }
    if (f.size > maxSizeMb * 1024 * 1024) {
      setLocalError(`This file is ${formatFileSize(f.size)}. The maximum size is ${maxSizeMb} MB.`);
      return;
    }
    if (f.size === 0) {
      setLocalError("This file is empty.");
      return;
    }
    setLocalError(null);
    onFileChange(f);
  };

  if (file) {
    const ext = file.name.split(".").pop();
    return (
      <div className="stack-sm">
        <div className="file-chip">
          <FileType extension={ext} />
          <div className="grow">
            <p className="medium truncate" style={{ color: "var(--text-primary)" }}>
              {file.name}
            </p>
            <p className="text-sm muted">{formatFileSize(file.size)}</p>
          </div>
          {!disabled && (
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => onFileChange(null)} aria-label={`Remove ${file.name}`}>
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack-sm">
      <span className="field-label" id={`${id}-label`}>
        {label}
        <span className="field-required" aria-hidden="true">
          *
        </span>
      </span>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        aria-invalid={shownError ? true : undefined}
        aria-disabled={disabled || undefined}
        className={cx("dropzone", dragging && "is-dragging")}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="dropzone-icon" aria-hidden="true">
          <CloudUpload />
        </span>
        <p className="dropzone-title">
          <span>Click to choose a file</span> or drag and drop
        </p>
        <p className="dropzone-hint" id={`${id}-hint`}>
          {hint || `${accept.map((a) => a.slice(1).toUpperCase()).join(", ")} · up to ${maxSizeMb} MB`}
        </p>
        <input ref={inputRef} type="file" hidden accept={accept.join(",")} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {shownError && (
        <p className="field-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{shownError}</span>
        </p>
      )}
    </div>
  );
}

export function ProgressBar({ value = 0, label, size, showValue = true }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="stack-sm" style={{ gap: 6 }}>
      {(label || showValue) && (
        <div className="row-between text-sm">
          <span className="secondary">{label}</span>
          {showValue && <span className="num medium">{Math.round(v)}%</span>}
        </div>
      )}
      <div className={cx("progress", size === "sm" && "progress-sm")} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="progress-bar" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
