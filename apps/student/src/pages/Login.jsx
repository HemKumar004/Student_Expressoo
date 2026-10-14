import { BookOpen, CalendarCheck, Wallet } from "lucide-react";
import { LoginPage } from "@expressoo/shared";
import { PORTAL_LINKS } from "../lib/api.js";

export default function Login() {
  return (
    <LoginPage
      portalName="Student Portal"
      headline="Your college day, in one place."
      description="Track attendance, check fees, download notes and stay on top of every notice from your teachers and class representatives."
      features={[
        { icon: CalendarCheck, title: "Attendance that explains itself", text: "See exactly how many classes you need to stay above the requirement." },
        { icon: BookOpen, title: "Study materials", text: "Notes, slides and lab manuals shared by your teachers." },
        { icon: Wallet, title: "Fees & receipts", text: "Balances, due dates and every payment receipt." },
      ]}
      usernameLabel="Roll number"
      usernamePlaceholder="e.g. 23A91A0501"
      usernameHint="Your 10-character roll number (or registered email)"
      validateUsername={(v) => (v.includes("@") || /^[A-Za-z0-9]{10}$/.test(v) ? null : "Roll number must be exactly 10 letters or digits")}
      registerLink={{ prompt: "New to Student Expressoo?", label: "Create a student account", to: "/register" }}
      otherPortals={PORTAL_LINKS}
    />
  );
}
