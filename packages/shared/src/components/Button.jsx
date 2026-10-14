import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cx } from "../utils/format.js";

export function Spinner({ size = "md", className, label = "Loading" }) {
  return <span className={cx("spinner", size === "lg" && "spinner-lg", className)} role="status" aria-label={label} />;
}

/**
 * Button. `to` renders a router Link, `href` an anchor. While `loading`, the button keeps its
 * size, shows a spinner, and is disabled to prevent double submission.
 */
export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", loading = false, disabled, icon: Icon, iconRight: IconRight, block, to, href, className, children, type = "button", ...rest },
  ref
) {
  const classes = cx("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, block && "btn-block", loading && "is-loading", className);
  const content = (
    <>
      {Icon && <Icon aria-hidden="true" />}
      {children !== undefined && children !== null && <span>{children}</span>}
      {IconRight && <IconRight aria-hidden="true" />}
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <span className="spinner" />
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-disabled={disabled || undefined} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, size = "md", variant, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx("icon-btn", size === "sm" && "icon-btn-sm", variant && `icon-btn-${variant}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon aria-hidden="true" />
    </button>
  );
});
