import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <GraduationCap />
    </span>
  );
}

export function Brand({ portalName, to = "/" }) {
  return (
    <Link to={to} className="sidebar-brand" aria-label={`Student Expressoo ${portalName} — home`}>
      <BrandMark />
      <span className="brand-text">
        <span className="brand-name">Student Expressoo</span>
        <span className="brand-portal">{portalName}</span>
      </span>
    </Link>
  );
}
