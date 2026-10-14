import { useState } from "react";
import { ArrowRight, BookOpen, Building2, CalendarCheck, ChartColumn, CircleCheck, GraduationCap, Layers, ScrollText, Siren, TriangleAlert, Users, Wallet } from "lucide-react";
import {
  BarChart,
  Button,
  Card,
  ChartCard,
  EmptyState,
  ErrorState,
  LineChart,
  PageHeader,
  PersonCell,
  Skeleton,
  SplitMeter,
  StatCard,
  useApi,
  useAuth,
  usePageTitle,
  useToast,
  formatCurrency,
  formatDate,
  formatLongDate,
  formatMonth,
  formatNumber,
  formatPercent,
  formatRelative,
  formatShortDate,
  todayISO,
} from "@expressoo/shared";

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { api } = useAuth();
  const toast = useToast();
  const { data, error, initialLoading, refetch } = useApi(() => api.get("/dashboard/admin"), []);
  const [approving, setApproving] = useState(null);

  const approve = async (u) => {
    setApproving(u.id);
    try {
      await api.patch(`/users/${u.id}/status`, { status: "ACTIVE" });
      toast.success("Staff account approved", `${u.fullName} can now sign in to the Staff Portal.`);
      refetch();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setApproving(null);
    }
  };

  const header = (
    <PageHeader
      title="Institution overview"
      description={formatLongDate(todayISO())}
      actions={
        <Button variant="secondary" to="/reports" icon={ChartColumn}>
          Reports
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
        <div className="grid grid-2" style={{ marginTop: 20 }}>
          <Skeleton height={300} radius={10} />
          <Skeleton height={300} radius={10} />
        </div>
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

  const { counts, attendance, fees, recentActivity, pendingApprovals } = data;
  const byCourse = attendance.byCourse.map((c) => ({ key: c.code, label: c.code, value: c.percentage ?? 0, detail: `${c.name} · ${formatNumber(c.total)} marks` }));
  const daily = attendance.daily.map((d) => ({ key: d.date, label: formatShortDate(d.date), value: d.percentage, detail: `${formatDate(d.date)} · ${formatNumber(d.total)} marks` }));
  const monthly = fees.monthly.map((m) => ({ key: m.month, label: formatMonth(m.month), value: Number(m.amount), detail: `${formatMonth(m.month)} · ${m.count} payment${m.count === 1 ? "" : "s"}` }));
  const money = (v, axis) => (axis ? formatCurrency(v, { compact: true, whole: true }) : formatCurrency(v, { whole: true }));

  return (
    <>
      {header}
      <div className="stack-lg">
        <div className="grid grid-4">
          <StatCard label="Active students" icon={GraduationCap} value={formatNumber(counts.students)} sub={`${counts.sections} sections · ${counts.courses} courses`} to="/students" />
          <StatCard
            label="Active staff"
            icon={Users}
            tone={counts.pendingApprovals ? "warning" : "neutral"}
            value={formatNumber(counts.staff)}
            sub={counts.pendingApprovals ? `${counts.pendingApprovals} awaiting approval` : "No pending registrations"}
            to="/staff"
          />
          <StatCard
            label="Attendance · last 30 days"
            icon={CalendarCheck}
            tone={attendance.overall.standing === "critical" ? "danger" : attendance.overall.standing === "warning" ? "warning" : "success"}
            value={formatPercent(attendance.overall.percentage)}
            sub={`${attendance.lowAttendanceCount} student${attendance.lowAttendanceCount === 1 ? "" : "s"} below ${attendance.threshold}%`}
            to="/attendance"
          />
          <StatCard label="Fee collection rate" icon={Wallet} tone="primary" value={formatPercent(fees.collectionRate)} sub={`${formatCurrency(fees.collected, { compact: true })} of ${formatCurrency(fees.billed, { compact: true })} billed`} to="/fees" />
        </div>

        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <ChartCard
            title="Attendance by course"
            subtitle={`${formatShortDate(attendance.range.from)} – ${formatShortDate(attendance.range.to)}`}
            tableColumns={[
              { key: "label", header: "Course" },
              { key: "value", header: "Attendance", align: "right", render: (r) => formatPercent(r.value) },
              { key: "detail", header: "Detail", render: (r) => r.detail },
            ]}
            tableRows={byCourse}
          >
            <BarChart data={byCourse} max={100} format={(v) => `${Math.round(v)}%`} threshold={{ value: attendance.threshold, label: `${attendance.threshold}% required` }} ariaLabel="Attendance percentage by course over the last 30 days" />
          </ChartCard>
          <ChartCard
            title="Daily attendance"
            subtitle="Share of marks recorded as present or late"
            tableColumns={[
              { key: "label", header: "Date" },
              { key: "value", header: "Attendance", align: "right", render: (r) => formatPercent(r.value) },
            ]}
            tableRows={daily}
          >
            <LineChart data={daily} domain={[0, 100]} format={(v) => `${Math.round(v)}%`} threshold={{ value: attendance.threshold, label: `${attendance.threshold}%` }} ariaLabel="Daily attendance over the last 30 days" />
          </ChartCard>
        </div>

        <div className="grid grid-main-aside" style={{ alignItems: "start" }}>
          <ChartCard
            title="Collections by month"
            subtitle="Payments recorded by the accounts office (last 6 months)"
            tableColumns={[
              { key: "label", header: "Month" },
              { key: "value", header: "Collected", align: "right", render: (r) => formatCurrency(r.value) },
              { key: "detail", header: "Payments", render: (r) => r.detail.split(" · ")[1] },
            ]}
            tableRows={monthly}
          >
            <BarChart data={monthly} format={money} ariaLabel="Fee collections by month" />
          </ChartCard>
          <Card title="Fee position" subtitle="All active fee structures" actions={<Button variant="ghost" size="sm" to="/fees" iconRight={ArrowRight}>Fees</Button>}>
            <div className="stack">
              <div>
                <p className="eyebrow">Collected</p>
                <p className="hero-figure" style={{ fontSize: "2.25rem", marginTop: 6 }}>
                  {formatCurrency(fees.collected, { whole: true })}
                </p>
              </div>
              <SplitMeter
                ariaLabel="Collected versus outstanding fees"
                format={(v) => formatCurrency(v, { compact: true, whole: true })}
                segments={[
                  { label: "Collected", value: Number(fees.collected), color: "var(--chart-series-1)" },
                  { label: "Outstanding", value: Math.max(0, Number(fees.outstanding)), color: "var(--gray-300)" },
                ]}
              />
              <div className="row-between text-sm" style={{ paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                <span className="row-sm secondary">
                  <TriangleAlert aria-hidden="true" style={{ width: 15, height: 15, color: fees.overdueRecords ? "var(--danger-600)" : "var(--gray-400)" }} />
                  Overdue fee items
                </span>
                <span className="semibold num">{fees.overdueRecords}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-3" style={{ alignItems: "start" }}>
          <Card flush title="Pending approvals" subtitle="Staff self-registrations" actions={<Button variant="ghost" size="sm" to="/staff">Staff</Button>}>
            <div style={{ height: 8 }} />
            {pendingApprovals.length === 0 ? (
              <EmptyState compact icon={CircleCheck} title="Nothing to review" description="New staff registrations appear here." />
            ) : (
              <ul className="list">
                {pendingApprovals.map((u) => (
                  <li key={u.id} className="list-item" style={{ alignItems: "center" }}>
                    <div className="grow">
                      <PersonCell name={u.fullName} sub={`${u.staff?.employeeId} · ${u.staff?.department?.code}`} />
                    </div>
                    <Button size="sm" loading={approving === u.id} onClick={() => approve(u)}>
                      Approve
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card flush title="Recent activity" subtitle="From the audit log" actions={<Button variant="ghost" size="sm" to="/audit">Audit log</Button>} className="span-2">
            <div style={{ height: 8 }} />
            {recentActivity.length === 0 ? (
              <EmptyState compact icon={ScrollText} title="No activity yet" />
            ) : (
              <ul className="list">
                {recentActivity.map((a) => (
                  <li key={a.id} className="list-item" style={{ alignItems: "center" }}>
                    <span className="list-icon" aria-hidden="true">
                      <ScrollText />
                    </span>
                    <div className="grow">
                      <p className="list-title" style={{ fontWeight: 500 }}>
                        {a.summary}
                      </p>
                      <p className="list-meta">
                        {a.actor?.fullName || "System"} · {formatRelative(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid grid-4">
          <StatCard label="Subjects" icon={Layers} tone="neutral" value={counts.subjects} sub={`${counts.courses} courses`} to="/academics" />
          <StatCard label="Study materials" icon={BookOpen} tone="neutral" value={counts.materials} sub={`${formatNumber(counts.downloads)} downloads`} to="/materials" />
          <StatCard label="Open teacher alerts" icon={Siren} tone={counts.openAlerts ? "danger" : "neutral"} value={counts.openAlerts} sub="Classes waiting for a teacher" to="/alerts" />
          <StatCard label="Inactive accounts" icon={Building2} tone="neutral" value={counts.inactiveAccounts} sub={`${counts.admins} administrator${counts.admins === 1 ? "" : "s"}`} to="/roles" />
        </div>
      </div>
    </>
  );
}
