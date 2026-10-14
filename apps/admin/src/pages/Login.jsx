import { ChartColumn, ShieldCheck, Wallet } from "lucide-react";
import { LoginPage } from "@expressoo/shared";
import { PORTAL_LINKS } from "../lib/api.js";

export default function Login() {
  return (
    <LoginPage
      portalName="Admin Console"
      headline="Run the institution with confidence."
      description="Accounts, academic structure, fees, communication and oversight — backed by a complete audit trail."
      features={[
        { icon: ShieldCheck, title: "Role-based access", text: "Every action is authorised on the server and logged." },
        { icon: Wallet, title: "Accurate accounts", text: "Fee structures, payments and receipts with exact totals." },
        { icon: ChartColumn, title: "Live reporting", text: "Attendance and collections straight from the database." },
      ]}
      usernameLabel="Username"
      usernamePlaceholder="Administrator username"
      usernameHint="Administrator accounts are created by an existing administrator."
      otherPortals={PORTAL_LINKS}
    />
  );
}
