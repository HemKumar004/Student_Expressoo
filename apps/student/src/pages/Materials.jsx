import { MaterialsLibrary, PageHeader, useApi, useAuth, usePageTitle } from "@expressoo/shared";

export default function Materials() {
  usePageTitle("Study materials");
  const { api, user } = useAuth();
  const subjects = useApi(() => api.get("/academics/subjects", { query: { sectionId: user.student.sectionId } }), [user.student.sectionId]);
  return (
    <>
      <PageHeader title="Study materials" description={`Notes, slides and lab manuals shared with ${user.student.section?.label || "your class"} by your teachers.`} />
      <MaterialsLibrary api={api} mode="student" subjects={subjects.data?.items || []} title="Library" />
    </>
  );
}
