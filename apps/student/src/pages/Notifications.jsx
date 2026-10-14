import { NotificationsPage, useAuth } from "@expressoo/shared";

export default function Notifications() {
  const { api, user } = useAuth();
  const isRep = user.student?.representativeRole && user.student.representativeRole !== "NONE";
  return (
    <NotificationsPage
      api={api}
      compose={isRep ? { mode: "rep", fixedAudienceLabel: user.student.section?.label } : undefined}
      description={isRep ? "Your inbox, plus messages you have sent to your class as representative." : undefined}
    />
  );
}
