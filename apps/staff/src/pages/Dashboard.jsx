import { ArrowRight, BookOpen, CalendarCheck, ClipboardCheck, Megaphone, Presentation, Siren, Users } from "lucide-react";
import {
  AnnouncementItem,
  Badge,
  Button,
  Callout,
  Card,
  ChartCard,
  DataTable,
  EmptyState,
  ErrorState,
  FileType,
  LineChart,
  PageHeader,
  Skeleton,
  StatCard,
  useApi,
  useAuth,
  usePageTitle,
  firstName,
  formatDate,
  formatPercent,
  formatRelative,
  formatShortDate,
  greeting,
  todayISO,
} from "@expressoo/shared";

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { api, user } = useAuth();
  const { data, error, initialLoading, refetch } = useApi(() => api.get("/dashboard/staff"), []);

  const header = (
    <PageHeader
      title={`${greeting()}, ${firstName(user.fullName)}`}
      description={[user.staff?.designation, user.staff?.department?.name].filter(Boolean).join(" · ")}
      actions={
        <Button to="/attendance" icon={ClipboardCheck}>
          Mark attendance
        </Button>
      }
    />
  );

  if (initialLoading)
    return (
      <>
        {header}
        <div className="grid grid-4">
          {[0, 1, 2, 3].map((i) => (
            <StatCard key={i} label=" " loading sub=" " />
          ))}
        </div>
        <Skeleton height={320} radius={10} style={{ marginTop: 24 }} />
      </>
    );
  if (error && !data)
    return (
      <>
        {header}
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    );

  const { stats, classes, trend, alerts, announcements, materials, today, threshold } = data;
  const trendData = trend.map((d) => ({ key: d.date, label: formatShortDate(d.date), value: d.percentage, detail: `${formatDate(d.date)} · ${d.total} marks` }));

  const classColumns = [
    {
      key: "class",
      header: "Class",
      sortable: true,
      sortValue: (c) => `${c.subject.code}${c.section.label}`,
      render: (c) => (
        <div className="cell-stack">
          <span className="cell-primary">
            {c.subject.code} · {c.section.label}
          </span>
          <span className="sub truncate" style={{ maxWidth: 260 }}>
            {c.subject.name}
          </span>
        </div>
      ),
    },
    { key: "students", header: "Students", align: "right", sortable: true, sortValue: (c) => c.studentCount, render: (c) => <span className="num">{c.studentCount}</span>, hideOnMobile: true },
    {
      key: "avg",
      header: "Avg.",
      align: "right",
      sortable: true,
      sortValue: (c) => c.averagePercentage ?? -1,
      render: (c) => (
        <span className="num semibold" style={{ color: c.averagePercentage !== null && c.averagePercentage < threshold ? "var(--danger-700)" : "var(--text-primary)" }}>
          {formatPercent(c.averagePercentage)}
        </span>
      ),
    },
    { key: "last", header: "Last class", render: (c) => <span className="nowrap">{c.lastSessionDate ? formatShortDate(c.lastSessionDate) : <span className="muted">Not yet</span>}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "cell-actions",
      render: (c) => (
        <div className="row-sm" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" size="sm" to={`/attendance?assignment=${c.assignmentId}`} icon={ClipboardCheck} aria-label={`Mark attendance for ${c.subject.code} ${c.section.label}`} title="Mark attendance" />
          <Button variant="ghost" size="sm" to={`/classes/${c.assignmentId}`} aria-label={`View ${c.subject.code} ${c.section.label}`} iconRight={ArrowRight} />
        </div>
      ),
    },
  ];

  return (
    <>
      {header}
      <div className="stack-lg">
        {alerts.length > 0 && (
          <Callout
            tone="danger"
            icon={Siren}
            title={`${alerts.length} class${alerts.length === 1 ? " is" : "es are"} waiting for you`}
            action={
              <Button variant="danger" size="sm" to="/alerts" iconRight={ArrowRight}>
                Respond
              </Button>
            }
          >
            {alerts
              .slice(0, 2)
              .map((a) => `${a.section.label}, period ${a.period} (raised ${formatRelative(a.createdAt)} by ${a.raisedBy.fullName})`)
              .join(" · ")}
          </Callout>
        )}

        <div className="grid grid-4">
          <StatCard label="My classes" icon={Presentation} value={stats.classes} sub={`${stats.sections} section${stats.sections === 1 ? "" : "s"}`} to="/classes" />
          <StatCard label="Students taught" icon={Users} tone="neutral" value={stats.students} sub="Active students in your sections" />
          <StatCard label="Classes this week" icon={CalendarCheck} tone="success" value={stats.sessionsThisWeek} sub="Attendance recorded in the last 7 days" to="/attendance/history" />
          <StatCard label="Open alerts" icon={Siren} tone={stats.openAlerts ? "danger" : "neutral"} value={stats.openAlerts} sub={stats.openAlerts ? "Awaiting your acknowledgement" : "No classes waiting"} to="/alerts" />
        </div>

        <div className="grid grid-main-aside" style={{ alignItems: "start" }}>
          <div className="stack-lg">
            <Card flush title="My classes" subtitle="Subjects and sections assigned to you" actions={<Button variant="ghost" size="sm" to="/classes" iconRight={ArrowRight}>All classes</Button>}>
              <div style={{ height: 12 }} />
              <DataTable columns={classColumns} rows={classes} rowKey="assignmentId" empty={{ icon: Presentation, title: "No classes assigned yet", description: "Ask the administration to assign your subjects and sections." }} />
            </Card>
            <ChartCard
              title="Attendance trend"
              subtitle="Daily attendance across your classes, last 14 days"
              tableColumns={[
                { key: "label", header: "Date" },
                { key: "value", header: "Attendance", align: "right", render: (r) => formatPercent(r.value) },
              ]}
              tableRows={trendData}
            >
              <LineChart data={trendData} domain={[0, 100]} format={(v) => `${Math.round(v)}%`} threshold={{ value: threshold, label: `${threshold}% required` }} ariaLabel="Daily attendance across your classes" />
            </ChartCard>
          </div>

          <div className="stack-lg">
            <Card flush title="Recorded today" subtitle={formatDate(todayISO())}>
              <div style={{ height: 8 }} />
              {today.length === 0 ? (
                <EmptyState compact icon={ClipboardCheck} title="Nothing recorded yet today" action={<Button size="sm" to="/attendance">Mark attendance</Button>} />
              ) : (
                <ul className="list">
                  {today.map((s) => (
                    <li key={s.id} className="list-item" style={{ alignItems: "center" }}>
                      <Badge tone="primary">P{s.period}</Badge>
                      <div className="grow">
                        <p className="list-title">{s.subject.code} · {s.section.label}</p>
                        <p className="list-meta truncate">{s.subject.name}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card flush title="Announcements" actions={<Button variant="ghost" size="sm" to="/announcements">View all</Button>}>
              <div style={{ height: 8 }} />
              {announcements.length === 0 ? <EmptyState compact icon={Megaphone} title="No announcements" /> : <div className="list">{announcements.map((a) => <AnnouncementItem key={a.id} a={a} compact />)}</div>}
            </Card>

            <Card flush title="My recent uploads" subtitle={`${stats.materials} files · ${stats.downloads} downloads`} actions={<Button variant="ghost" size="sm" to="/materials">Manage</Button>}>
              <div style={{ height: 8 }} />
              {materials.length === 0 ? (
                <EmptyState compact icon={BookOpen} title="No uploads yet" action={<Button size="sm" to="/materials">Upload material</Button>} />
              ) : (
                <ul className="list">
                  {materials.map((m) => (
                    <li key={m.id} className="list-item" style={{ alignItems: "center" }}>
                      <FileType extension={m.extension} />
                      <div className="grow">
                        <p className="list-title truncate">{m.title}</p>
                        <p className="list-meta">{m.subject.code} · {m.audienceLabel} · {m.downloadCount} downloads</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
