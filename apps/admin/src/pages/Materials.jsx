import { MaterialsLibrary, PageHeader, useAuth, usePageTitle } from "@expressoo/shared";
import { useReference } from "../lib/reference.jsx";

export default function Materials() {
  usePageTitle("Study materials");
  const { api } = useAuth();
  const { subjects } = useReference();
  return (
    <>
      <PageHeader title="Study materials" description="Every file shared by staff. Administrators can edit details or remove inappropriate or outdated material." />
      <MaterialsLibrary api={api} mode="admin" subjects={subjects} title="All materials" />
    </>
  );
}
