import { useState } from "react";
import { Megaphone, Pin, CalendarClock } from "lucide-react";
import { Card, Badge } from "../components/Display.jsx";
import { PageHeader } from "../components/Navigation.jsx";
import { Pagination } from "../components/DataTable.jsx";
import { EmptyState, ErrorState, SkeletonRows } from "../components/Feedback.jsx";
import { useApi, usePageTitle } from "../hooks/index.js";
import { formatDate, formatRelative } from "../utils/format.js";

const AUDIENCE = { ALL: "Everyone", STUDENTS: "Students", STAFF: "Staff" };

export function AnnouncementItem({ a, actions, compact }) {
  return (
    <article className="list-item" style={{ display: "block" }}>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div className="row-sm wrap">
          {a.isPinned && (
            <Badge tone="primary" icon={Pin}>
              Pinned
            </Badge>
          )}
          <Badge>{AUDIENCE[a.audience]}</Badge>
          {a.expired && <Badge tone="warning">Expired</Badge>}
        </div>
        {actions}
      </div>
      <h3 className="mt-2" style={{ fontSize: compact ? "var(--text-base)" : "var(--text-md)" }}>
        {a.title}
      </h3>
      <p className="secondary mt-2" style={compact ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : { whiteSpace: "pre-wrap" }}>
        {a.body}
      </p>
      <p className="text-sm muted mt-2 row-sm wrap">
        <span>{a.author?.fullName || "College office"}</span>
        <span aria-hidden="true">·</span>
        <span title={formatDate(a.publishedAt)}>{formatRelative(a.publishedAt)}</span>
        {a.expiresAt && (
          <>
            <span aria-hidden="true">·</span>
            <span className="row-sm">
              <CalendarClock aria-hidden="true" style={{ width: 14, height: 14 }} /> Until {formatDate(a.expiresAt)}
            </span>
          </>
        )}
      </p>
    </article>
  );
}

export function AnnouncementsPage({ api }) {
  usePageTitle("Announcements");
  const [page, setPage] = useState(1);
  const { data, error, initialLoading, loading, refetch } = useApi(() => api.get("/announcements", { query: { page, pageSize: 10 } }), [page]);
  return (
    <>
      <PageHeader title="Announcements" description="Official notices from the college administration." />
      <Card flush refreshing={loading && !initialLoading}>
        {initialLoading && (
          <div style={{ padding: 24 }}>
            <SkeletonRows rows={3} height={96} />
          </div>
        )}
        {error && !data && <ErrorState error={error} onRetry={refetch} />}
        {data?.items.length === 0 && <EmptyState icon={Megaphone} title="No announcements" description="Notices published by the administration will appear here." />}
        {data?.items.length > 0 && (
          <div className="list">
            {data.items.map((a) => (
              <AnnouncementItem key={a.id} a={a} />
            ))}
          </div>
        )}
        {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="announcements" />}
      </Card>
    </>
  );
}
