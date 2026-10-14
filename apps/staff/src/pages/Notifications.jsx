import { NotificationsPage, useAuth } from "@expressoo/shared";
import { useAssignments } from "../lib/useAssignments.js";

export default function Notifications() {
  const { api } = useAuth();
  const { sections } = useAssignments();
  return (
    <NotificationsPage
      api={api}
      description="Your inbox, plus notices you send to the sections you teach."
      compose={{ mode: "staff", sections }}
    />
  );
}
