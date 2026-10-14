import { Link } from "react-router-dom";
import { ArrowRight, Bell, BookOpen, CalendarCheck, Download, Megaphone, Siren, Wallet } from "lucide-react";
import {
  AttendanceMeter,
  AnnouncementItem,
  Badge,
  Button,
  Callout,
  Card,
  CategoryIcon,
  ChartCard,
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
  useToast,
  firstName,
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelative,
  formatShortDate,
  greeting,
  REP_LABELS,
} from "@expressoo/shared";

function DashboardSkeleton() {
  return (
    <div className="stack-lg">
      <div className="grid grid-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCard key={i} label=" " value="" loading sub=" " />
        ))}
      </div>
      <div className="grid grid-main-aside">
        <Skeleton height={360} radius={10} />
        <Skeleton height={360} radius={10} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { api, user } = useAuth();
  const toast = useToast();
  const { data, error, initialLoading, refetch } = useApi(() => api.get("/dashboard/student"), []);
  const student = user.student;
  const rep = student?.representativeRole !== "NONE" ? student.representativeRole : null;

  const download = async (m) => {
    try {
      await api.download(`/materials/${m.id}/download`, m.fileName);
    } catch (err) {
      toast.fromError(err, "Download failed");
    }
  };

  const header = (
    <PageHeader
      title={`${greeting()}, ${firstName(user.fullName)}`}
      description={
        <span className="row-sm wrap">
          <span>{student?.section?.label}</span>
          <span aria-hidden="true">·</span>
          <span className="mono">{student?.rollNumber}</span>
          {rep && (
            <Badge tone="primary" style={{ marginLeft: 4 }}>
              {REP_LABELS[rep]}
            </Badge>
          )}
        </span>
      }
    />
  );

  if (initialLoading) return (<>{header}<DashboardSkeleton /></>);
  if (error && !data) return (<>{header}<Card><ErrorState error={error} onRetry={refetch} /></Card></>);

  const { attendance, fees, notifications, announcements, materials, alerts } = data;
  const overall = attendance.overall;
  const weekly = attendance.weekly.map((w) => ({ key: w.weekStart, label: formatShortDate(w.weekStart), value: w.percentage, detail: `Week of ${formatDate(w.weekStart)} · ${w.attended}/${w.total} classes` }));
  const atRisk = attendance.subjects.filter((s) => s.standing === "critical" || s.standing === "warning");
  const balance = Number(fees.balance);
  const overdue = Number(fees.overdue);

  return (
    <>
      {header}
      <div className="stack-lg">
        {rep && alerts && (
          <Callout
            tone={alerts.openCount ? "warning" : "info"}
            icon={Siren}
            title={alerts.openCount ? `${alerts.openCount} teacher alert${alerts.openCount === 1 ? "" : "s"} awaiting a response` : `${REP_LABELS[rep]} tools`}
            action={
              <Button variant="secondary" size="sm" to="/representative" iconRight={ArrowRight}>
                Open {rep} desk
              </Button>
            }
          >
            Alert a teacher who hasn't arrived for a period, or message everyone in {student.section?.label}.
          </Callout>
        )}

        <div className="grid grid-4">
          <StatCard
            label="Overall attendance"
            icon={CalendarCheck}
            tone={overall.standing === "critical" ? "danger" : overall.standing === "warning" ? "warning" : "primary"}
            value={formatPercent(overall.percentage)}
            sub={overall.total ? `${overall.attended} of ${overall.total} classes · required ${attendance.threshold}%` : "No classes recorded yet"}
            to="/attendance"
          />
          <StatCard
            label="Fee balance"
            icon={Wallet}
            tone={overdue > 0 ? "danger" : balance > 0 ? "warning" : "success"}
            value={formatCurrency(fees.balance, { whole: true })}
            sub={overdue > 0 ? `${formatCurrency(fees.overdue, { whole: true })} overdue` : fees.nextDue ? `Next due ${formatDate(fees.nextDue.dueDate)}` : balance > 0 ? "Outstanding" : "All fees cleared"}
            to="/fees"
          />
          <StatCard label="Unread notifications" icon={Bell} tone="neutral" value={notifications.unreadCount} sub={notifications.items[0] ? `Latest ${formatRelative(notifications.items[0].createdAt)}` : "Nothing new"} to="/notifications" />
          <StatCard label="Study materials" icon={BookOpen} tone="neutral" value={materials.total} sub={materials.items[0] ? `Newest: ${materials.items[0].subject.code}` : "None shared yet"} to="/materials" />
        </div>

        <div className="grid grid-main-aside" style={{ alignItems: "start" }}>
          <div className="stack-lg">
            <Card
              title="Attendance by subject"
              subtitle={atRisk.length ? `${atRisk.length} subject${atRisk.length === 1 ? "" : "s"} need attention` : `All subjects at or above ${attendance.threshold}%`}
              actions={
                <Button variant="ghost" size="sm" to="/attendance" iconRight={ArrowRight}>
                  Details
                </Button>
              }
            >
              {attendance.subjects.length === 0 ? (
                <EmptyState compact icon={CalendarCheck} title="No subjects yet" description="Subjects appear once teachers are assigned to your class." />
              ) : (
                <div className="grid grid-2" style={{ gap: "20px 28px" }}>
                  {attendance.subjects.map((s) => (
                    <AttendanceMeter key={s.subject.id} label={`${s.subject.code} · ${s.subject.name}`} stats={s} threshold={attendance.threshold} />
                  ))}
                </div>
              )}
            </Card>

            <ChartCard
              title="Weekly attendance"
              subtitle="Share of classes attended each week (last 10 weeks)"
              tableColumns={[
                { key: "label", header: "Week of" },
                { key: "value", header: "Attendance", align: "right", render: (r) => formatPercent(r.value) },
                { key: "detail", header: "Classes", render: (r) => r.detail.split(" · ")[1] },
              ]}
              tableRows={weekly}
            >
              <LineChart data={weekly} height={220} domain={[0, 100]} format={(v) => `${Math.round(v)}%`} threshold={{ value: attendance.threshold, label: `${attendance.threshold}% required` }} ariaLabel="Weekly attendance percentage" />
            </ChartCard>

            <Card
              flush
              title="Latest materials"
              actions={
                <Button variant="ghost" size="sm" to="/materials">
                  Library
                </Button>
              }
            >
              <div style={{ height: 8 }} />
              {materials.items.length === 0 ? (
                <EmptyState compact icon={BookOpen} title="No materials yet" />
              ) : (
                <ul className="list">
                  {materials.items.map((m) => (
                    <li key={m.id} className="list-item" style={{ alignItems: "center" }}>
                      <FileType extension={m.extension} />
                      <div className="grow">
                        <p className="list-title truncate">{m.title}</p>
                        <p className="list-meta">
                          {m.subject.code} · {formatRelative(m.createdAt)}
                        </p>
                      </div>
                      <button type="button" className="icon-btn icon-btn-sm" onClick={() => download(m)} aria-label={`Download ${m.title}`}>
                        <Download aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="stack-lg">
            <Card
              flush
              title="Announcements"
              actions={
                <Button variant="ghost" size="sm" to="/announcements">
                  View all
                </Button>
              }
            >
              <div style={{ height: 8 }} />
              {announcements.length === 0 ? (
                <EmptyState compact icon={Megaphone} title="No announcements" />
              ) : (
                <div className="list">
                  {announcements.map((a) => (
                    <AnnouncementItem key={a.id} a={a} compact />
                  ))}
                </div>
              )}
            </Card>

            <Card
              flush
              title="Recent notifications"
              actions={
                <Button variant="ghost" size="sm" to="/notifications">
                  View all
                </Button>
              }
            >
              <div style={{ height: 8 }} />
              {notifications.items.length === 0 ? (
                <EmptyState compact icon={Bell} title="You're all caught up" />
              ) : (
                <ul className="list">
                  {notifications.items.map((n) => (
                    <li key={n.id} className="list-item">
                      <CategoryIcon category={n.category} />
                      <div className="grow">
                        <Link to="/notifications" className="list-title" style={{ color: "var(--text-primary)", fontWeight: n.readAt ? 500 : 600 }}>
                          {n.title}
                        </Link>
                        <p className="list-meta">
                          {n.sender?.fullName} · {formatRelative(n.createdAt)}
                        </p>
                      </div>
                      {!n.readAt && <span className="unread-dot" aria-label="Unread" />}
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
