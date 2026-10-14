import { AccountSettings, Avatar, Badge, Card, DescriptionList, PageHeader, StatusBadge, useAuth, usePageTitle, formatDate } from "@expressoo/shared";

export default function Profile() {
  usePageTitle("Profile");
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Profile" description="Your administrator account and security settings." />
      <div className="stack-lg">
        <Card>
          <div className="row wrap" style={{ gap: 20 }}>
            <Avatar name={user.fullName} size="xl" />
            <div className="grow">
              <h2 style={{ fontSize: "var(--text-xl)" }}>{user.fullName}</h2>
              <p className="secondary mt-2 mono">{user.username}</p>
              <div className="row-sm mt-2">
                <StatusBadge status={user.status} />
                <Badge tone="navy">Administrator</Badge>
              </div>
            </div>
          </div>
          <hr />
          <DescriptionList columns={3} items={[{ label: "Email", value: user.email }, { label: "Mobile", value: user.mobile || "—" }, { label: "Administrator since", value: formatDate(user.createdAt) }]} />
        </Card>
        <AccountSettings />
      </div>
    </>
  );
}
