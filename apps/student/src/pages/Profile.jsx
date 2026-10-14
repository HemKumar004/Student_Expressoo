import { AccountSettings, Avatar, Badge, Card, DescriptionList, PageHeader, StatusBadge, useAuth, usePageTitle, formatDate, REP_LABELS } from "@expressoo/shared";

export default function Profile() {
  usePageTitle("Profile");
  const { user } = useAuth();
  const s = user.student;
  return (
    <>
      <PageHeader title="Profile" description="Your academic record and account settings." />
      <div className="stack-lg">
        <Card>
          <div className="row wrap" style={{ gap: 20 }}>
            <Avatar name={user.fullName} size="xl" />
            <div className="grow">
              <h2 style={{ fontSize: "var(--text-xl)" }}>{user.fullName}</h2>
              <p className="secondary mt-2 row-sm wrap">
                <span className="mono">{s.rollNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{s.section?.course?.name}</span>
              </p>
              <div className="row-sm mt-2 wrap">
                <StatusBadge status={user.status} />
                {s.representativeRole !== "NONE" && <Badge tone="primary">{REP_LABELS[s.representativeRole]}</Badge>}
              </div>
            </div>
          </div>
          <hr />
          <DescriptionList
            columns={3}
            items={[
              { label: "Roll number", value: <span className="mono">{s.rollNumber}</span> },
              { label: "Class", value: s.section?.label },
              { label: "Course", value: s.section?.course?.name },
              { label: "Year of study", value: s.section ? `Year ${s.section.yearOfStudy}` : "—" },
              { label: "Section", value: s.section?.name },
              { label: "Admission year", value: s.admissionYear || "—" },
              { label: "Role", value: REP_LABELS[s.representativeRole] },
              { label: "Username", value: user.username },
              { label: "Member since", value: formatDate(user.createdAt) },
            ]}
          />
        </Card>
        <AccountSettings />
      </div>
    </>
  );
}
