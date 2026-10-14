import { NotificationsPage, useAuth } from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

export default function Notifications() {
  const { api } = useAuth();
  const { sections, courses } = useReference();
  return <NotificationsPage api={api} description="Send targeted notifications to everyone, a role, a course or specific sections — and track how many have read them." compose={{ mode: "admin", sections, courses }} />;
}
