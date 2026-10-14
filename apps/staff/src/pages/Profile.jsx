import { AccountSettings, Avatar, Badge, Card, DescriptionList, PageHeader, StatusBadge, useAuth, usePageTitle, formatDate } from "@expressoo/shared";
import { useAssignments } from "../lib/useAssignments.js";

export default function Profile() {
  usePageTitle("Profile");
  const { user } = useAuth();
  const { items, loading } = useAssignments();
  const st = user.staff;
  return (
    <>
      <PageHeader title="Profile" description="Your staff record, teaching assignments and account settings." />
      <div className="stack-lg">
        <Card>
          <div className="row wrap" style={{ gap: 20 }}>
            <Avatar name={user.fullName} size="xl" />
            <div className="grow">
              <h2 style={{ fontSize: "var(--text-xl)" }}>{user.fullName}</h2>
              <p className="secondary mt-2">{[st.designation, st.department?.name].filter(Boolean).join(" · ")}</p>
              <div className="row-sm mt-2">
                <StatusBadge status={user.status} />
                <Badge>Staff</Badge>
              </div>
            </div>
          </div>
          <hr />
          <DescriptionList
            columns={3}
            items={[
              { label: "Employee ID", value: <span className="mono">{st.employeeId}</span> },
              { label: "Department", value: st.department?.name },
              { label: "Designation", value: st.designation || "—" },
              { label: "Email", value: user.email },
              { label: "Mobile", value: user.mobile || "—" },
              { label: "Member since", value: formatDate(user.createdAt) },
            ]}
          />
          <hr />
          <p className="section-title">Teaching assignments</p>
          {loading ? (
            <p className="muted text-sm">Loading…</p>
          ) : items.length === 0 ? (
            <p className="muted text-sm">No subjects assigned yet.</p>
          ) : (
            <div className="row wrap" style={{ gap: 8 }}>
              {items.map((a) => (
                <Badge key={a.id} size="lg" tone="primary">
                  {a.subject.code} · {a.section.label}
                </Badge>
              ))}
            </div>
          )}
        </Card>
        <AccountSettings />
      </div>
    </>
  );
}
