import { useState } from "react";
import { FileSearch, ScrollText } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  useApi,
  useAuth,
  useDebouncedValue,
  usePageTitle,
  formatDateTime,
  formatRelative,
  ROLE_LABELS,
} from "@expressoo/shared";

function DetailModal({ log, onClose }) {
  return (
    <Modal open onClose={onClose} size="lg" title="Audit entry" description={`#${log.id} · ${formatDateTime(log.createdAt)}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="stack">
        <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.summary}</p>
        <DescriptionList
          items={[
            { label: "Action", value: <span className="mono">{log.action}</span> },
            { label: "Record", value: `${log.entityType}${log.entityId ? ` #${log.entityId}` : ""}` },
            { label: "Performed by", value: log.actor ? `${log.actor.fullName} (${log.actor.username}, ${ROLE_LABELS[log.actor.role]})` : "System" },
            { label: "IP address", value: log.ipAddress || "—" },
          ]}
        />
        {log.metadata && (
          <div>
            <p className="field-label" style={{ marginBottom: 6 }}>Details</p>
            <pre className="mono" style={{ margin: 0, padding: 14, borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--border)", overflowX: "auto", fontSize: 12.5 }}>
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Audit() {
  usePageTitle("Audit log");
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ entityType: "", from: "", to: "", page: 1 });
  const [selected, setSelected] = useState(null);
  const q = useDebouncedValue(search, 300);
  const { data, error, loading, refetch } = useApi(() => api.get("/audit-logs", { query: { ...filters, search: q || undefined, pageSize: 25 } }), [filters, q]);
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of sign-ins, account changes, attendance corrections, payments, uploads and other sensitive actions." />
      <Card flush refreshing={loading && Boolean(data)}>
        <div className="toolbar">
          <SearchInput value={search} onChange={(v) => { setSearch(v); update({}); }} placeholder="Search the activity summary" label="Search audit log" />
          <Select aria-label="Record type" value={filters.entityType} onChange={(e) => update({ entityType: e.target.value })}>
            <option value="">All record types</option>
            {data?.entityTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </Select>
          <div className="row-sm">
            <Input type="date" aria-label="From" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
            <span className="muted text-sm">to</span>
            <Input type="date" aria-label="To" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
          </div>
        </div>
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={refetch}
          onRowClick={setSelected}
          empty={{ icon: ScrollText, title: "No activity matches these filters" }}
          columns={[
            { key: "createdAt", header: "When", render: (l) => <span className="nowrap" title={formatDateTime(l.createdAt)}>{formatRelative(l.createdAt)}</span> },
            { key: "actor", header: "Who", render: (l) => (l.actor ? <div className="cell-stack"><span className="cell-primary">{l.actor.fullName}</span><span className="sub">{ROLE_LABELS[l.actor.role]}</span></div> : <span className="muted">System</span>) },
            { key: "action", header: "Action", hideOnMobile: true, render: (l) => <Badge className="mono">{l.action}</Badge> },
            { key: "summary", header: "Activity", render: (l) => <span style={{ color: "var(--text-primary)" }}>{l.summary}</span> },
            { key: "ip", header: "IP", hideOnMobile: true, render: (l) => <span className="mono text-sm muted">{l.ipAddress || "—"}</span> },
            { key: "detail", header: <span className="sr-only">Details</span>, className: "cell-actions", render: (l) => <button type="button" className="icon-btn icon-btn-sm" aria-label="View details" onClick={(e) => { e.stopPropagation(); setSelected(l); }}><FileSearch aria-hidden="true" /></button> },
          ]}
        />
        {data && <Pagination pagination={data.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} label="entries" />}
      </Card>
      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
