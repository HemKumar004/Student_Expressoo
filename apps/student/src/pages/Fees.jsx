import { useState } from "react";
import { Banknote, CircleAlert, Receipt, Wallet, CalendarClock, CircleCheck } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  ErrorState,
  PageHeader,
  ReceiptModal,
  StatCard,
  StatusBadge,
  SplitMeter,
  useApi,
  useAuth,
  usePageTitle,
  formatCurrency,
  formatDate,
} from "@expressoo/shared";

export default function Fees() {
  usePageTitle("Fees & payments");
  const { api, user } = useAuth();
  const { data, error, initialLoading, refetch } = useApi(() => api.get("/fees/me"), []);
  const [receipt, setReceipt] = useState(null);

  const recordColumns = [
    {
      key: "fee",
      header: "Fee",
      render: (r) => (
        <div className="cell-stack">
          <span className="cell-primary">{r.feeStructure.name}</span>
          <span className="sub">{r.feeStructure.academicYear}</span>
        </div>
      ),
    },
    {
      key: "dueDate",
      header: "Due",
      sortable: true,
      render: (r) => (
        <div className="cell-stack">
          <span className="nowrap">{formatDate(r.dueDate)}</span>
          {r.overdue && (
            <span>
              <Badge tone="danger">Overdue</Badge>
            </span>
          )}
        </div>
      ),
    },
    { key: "netAmount", header: "Payable", align: "right", render: (r) => <span className="num">{formatCurrency(r.netAmount)}</span> },
    { key: "discount", header: "Concession", align: "right", hideOnMobile: true, render: (r) => <span className="num muted">{Number(r.discount) ? `− ${formatCurrency(r.discount)}` : "—"}</span> },
    { key: "amountPaid", header: "Paid", align: "right", render: (r) => <span className="num">{formatCurrency(r.amountPaid)}</span> },
    { key: "balance", header: "Balance", align: "right", render: (r) => <span className="num semibold" style={{ color: Number(r.balance) ? "var(--text-primary)" : "var(--text-muted)" }}>{formatCurrency(r.balance)}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const paymentColumns = [
    { key: "receiptNo", header: "Receipt", render: (p) => <span className="mono cell-primary">{p.receiptNo}</span> },
    { key: "paidOn", header: "Date", render: (p) => <span className="nowrap">{formatDate(p.paidOn)}</span> },
    { key: "fee", header: "Fee", render: (p) => p.feeName, hideOnMobile: true },
    { key: "method", header: "Method", render: (p) => p.methodLabel, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", render: (p) => <span className="num semibold" style={{ color: "var(--text-primary)", textDecoration: p.status === "VOIDED" ? "line-through" : undefined }}>{formatCurrency(p.amount)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "cell-actions",
      render: (p) => (
        <Button variant="ghost" size="sm" icon={Receipt} onClick={() => setReceipt(p)}>
          <span className="hide-mobile">Receipt</span>
        </Button>
      ),
    },
  ];

  const s = data?.summary;
  return (
    <>
      <PageHeader title="Fees & payments" description="Your fee bills, concessions and every payment recorded by the accounts office." />
      {error && !data ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : (
        <div className="stack-lg">
          <div className="grid grid-4">
            <StatCard label="Total payable" icon={Wallet} tone="neutral" loading={initialLoading} value={s && formatCurrency(s.billed, { whole: true })} sub={data && `${data.records.length} fee item${data.records.length === 1 ? "" : "s"}`} />
            <StatCard label="Paid so far" icon={CircleCheck} tone="success" loading={initialLoading} value={s && formatCurrency(s.paid, { whole: true })} sub={data && `${data.payments.filter((p) => p.status === "RECORDED").length} payment(s)`} />
            <StatCard
              label="Balance"
              icon={Banknote}
              tone={s && Number(s.balance) > 0 ? "warning" : "success"}
              loading={initialLoading}
              value={s && formatCurrency(s.balance, { whole: true })}
              sub={s && (s.nextDue ? `Next: ${s.nextDue.feeName} by ${formatDate(s.nextDue.dueDate)}` : Number(s.balance) > 0 ? "Outstanding" : "Nothing due")}
            />
            <StatCard label="Overdue" icon={s && Number(s.overdue) > 0 ? CircleAlert : CalendarClock} tone={s && Number(s.overdue) > 0 ? "danger" : "neutral"} loading={initialLoading} value={s && formatCurrency(s.overdue, { whole: true })} sub={s && (Number(s.overdue) > 0 ? "Past the due date" : "No overdue fees")} />
          </div>

          {data && Number(s.billed) > 0 && (
            <Card title="Payment progress">
              <SplitMeter
                ariaLabel={`Paid ${formatCurrency(s.paid)} of ${formatCurrency(s.billed)}`}
                format={(v) => formatCurrency(v, { whole: true })}
                segments={[
                  { label: "Paid", value: Number(s.paid), color: "var(--chart-series-1)" },
                  { label: "Balance", value: Math.max(0, Number(s.balance)), color: "var(--gray-300)" },
                ]}
              />
            </Card>
          )}

          {data && !data.onlinePaymentsEnabled && (
            <Callout tone="info" title="How to pay">
              Online payment is not available yet. Pay at the college accounts office by cash, UPI, card, bank transfer, cheque or demand draft — your payment and receipt appear here as soon as the office records it.
            </Callout>
          )}

          <Card flush title="Fee items" subtitle={`Billed to ${user.fullName} (${user.student?.rollNumber})`}>
            <div style={{ height: 12 }} />
            <DataTable columns={recordColumns} rows={data?.records} loading={initialLoading} empty={{ icon: Wallet, title: "No fees billed yet", description: "Fees assigned by the accounts office will appear here." }} />
          </Card>

          <Card flush title="Payment history" subtitle="Receipts can be viewed and printed at any time">
            <div style={{ height: 12 }} />
            <DataTable columns={paymentColumns} rows={data?.payments} loading={initialLoading} empty={{ icon: Receipt, title: "No payments recorded yet" }} />
          </Card>
        </div>
      )}
      {receipt && <ReceiptModal payment={receipt} student={{ fullName: user.fullName, rollNumber: user.student?.rollNumber, section: user.student?.section }} onClose={() => setReceipt(null)} />}
    </>
  );
}
