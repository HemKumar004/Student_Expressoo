import { AnnouncementsPage, useAuth } from "@expressoo/shared";

export default function Announcements() {
  const { api } = useAuth();
  return <AnnouncementsPage api={api} />;
}
