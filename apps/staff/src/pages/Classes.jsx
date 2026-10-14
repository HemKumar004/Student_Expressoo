import { ArrowRight, ClipboardCheck, Presentation, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Meter, PageHeader, Skeleton, useApi, useAuth, usePageTitle, formatDate, formatPercent } from "@expressoo/shared";

export default function Classes() {
  usePageTitle("My classes");
  const { api } = useAuth();
  const { data, error, initialLoading, refetch } = useApi(() => api.get("/dashboard/staff"), []);
  const threshold = data?.threshold ?? 75;

  return (
    <>
      <PageHeader title="My classes" description="Every subject and section assigned to you by the administration." />
      {initialLoading && (
        <div className="grid grid-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={220} radius={10} />
          ))}
        </div>
      )}
      {error && !data && (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      )}
      {data?.classes.length === 0 && (
        <Card>
          <EmptyState icon={Presentation} title="No classes assigned yet" description="Once the administration assigns you to a subject and section it will appear here." />
        </Card>
      )}
      {data?.classes.length > 0 && (
        <div className="grid grid-3">
          {data.classes.map((c) => {
            const tone = c.averagePercentage === null ? "good" : c.averagePercentage >= threshold ? "good" : c.averagePercentage >= threshold - 10 ? "warning" : "critical";
            return (
              <Card key={c.assignmentId} className="card-fill">
                <div className="stack" style={{ flex: 1 }}>
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="eyebrow">{c.subject.code}</p>
                      <h2 className="mt-2" style={{ fontSize: "var(--text-md)" }}>
                        {c.subject.name}
                      </h2>
                    </div>
                    <Badge tone="navy">{c.section.label}</Badge>
                  </div>
                  <div className="kv-row">
                    <div className="kv">
                      <span className="kv-label">Students</span>
                      <span className="kv-value num row-sm">
                        <Users aria-hidden="true" style={{ width: 16, height: 16, color: "var(--gray-400)" }} />
                        {c.studentCount}
                      </span>
                    </div>
                    <div className="kv">
                      <span className="kv-label">Classes held</span>
                      <span className="kv-value num">{c.sessions}</span>
                    </div>
                  </div>
                  <Meter label="Average attendance" value={c.averagePercentage} valueLabel={formatPercent(c.averagePercentage)} threshold={threshold} tone={tone} foot={c.lastSessionDate ? `Last class ${formatDate(c.lastSessionDate)}` : "No classes recorded yet"} />
                </div>
                <div className="row-sm" style={{ marginTop: 20 }}>
                  <Button to={`/attendance?assignment=${c.assignmentId}`} icon={ClipboardCheck} size="sm">
                    Mark attendance
                  </Button>
                  <Button to={`/classes/${c.assignmentId}`} variant="ghost" size="sm" iconRight={ArrowRight}>
                    Students
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
