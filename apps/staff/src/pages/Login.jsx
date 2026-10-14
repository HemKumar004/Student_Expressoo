import { BookOpen, ClipboardCheck, Siren } from "lucide-react";
import { LoginPage } from "@expressoo/shared";
import { PORTAL_LINKS } from "../lib/api.js";

export default function Login() {
  return (
    <LoginPage
      portalName="Staff Portal"
      headline="Run your classes without the paperwork."
      description="Mark attendance in seconds, share study material with your sections, and respond to class alerts from one workspace."
      features={[
        { icon: ClipboardCheck, title: "Fast attendance", text: "Everyone starts present — tap the absentees and save." },
        { icon: BookOpen, title: "Share materials", text: "Upload notes and slides to the sections you teach." },
        { icon: Siren, title: "Class alerts", text: "Know instantly when a class is waiting for you." },
      ]}
      usernameLabel="Employee ID"
      usernamePlaceholder="e.g. STF10001"
      usernameHint="Your 8-character employee ID (or registered email)"
      validateUsername={(v) => (v.includes("@") || /^[A-Za-z0-9]{8}$/.test(v) ? null : "Employee ID must be exactly 8 letters or digits")}
      registerLink={{ prompt: "Joining the faculty?", label: "Request a staff account", to: "/register" }}
      otherPortals={PORTAL_LINKS}
    />
  );
}
