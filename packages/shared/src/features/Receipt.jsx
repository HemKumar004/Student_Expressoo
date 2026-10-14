import { Printer } from "lucide-react";
import { Modal } from "../components/Overlay.jsx";
import { Button } from "../components/Button.jsx";
import { StatusBadge, DescriptionList } from "../components/Display.jsx";
import { Callout } from "../components/Feedback.jsx";
import { BrandMark } from "../layout/Brand.jsx";
import { formatCurrency, formatDate, formatDateTime, METHOD_LABELS } from "../utils/format.js";

/** Printable payment receipt. Works with both student (/fees/me) and admin (/payments) payloads. */
export function ReceiptModal({ payment, student, onClose }) {
  if (!payment) return null;
  const st = payment.feeRecord?.student || student;
  const feeName = payment.feeName || payment.feeRecord?.feeStructure?.name;
  const year = payment.academicYear || payment.feeRecord?.feeStructure?.academicYear;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Payment receipt"
      description={payment.receiptNo}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button icon={Printer} onClick={() => window.print()}>
            Print receipt
          </Button>
        </>
      }
    >
      <div className="receipt">
        <div className="receipt-head">
          <div className="row">
            <BrandMark />
            <div>
              <p className="semibold" style={{ color: "var(--text-primary)" }}>
                Student Expressoo
              </p>
              <p className="text-sm muted">Accounts office receipt</p>
            </div>
          </div>
          <StatusBadge status={payment.status} />
        </div>
        {payment.status === "VOIDED" && (
          <Callout tone="warning" title="This payment was voided" className="mt-2">
            {payment.voidReason} {payment.voidedAt && `· ${formatDateTime(payment.voidedAt)}`}
          </Callout>
        )}
        <p className="eyebrow mt-4">Amount received</p>
        <p className="receipt-amount">{formatCurrency(payment.amount)}</p>
        <hr />
        <DescriptionList
          items={[
            { label: "Receipt number", value: <span className="mono">{payment.receiptNo}</span> },
            { label: "Payment date", value: formatDate(payment.paidOn) },
            st && { label: "Student", value: `${st.fullName} (${st.rollNumber})` },
            st?.section && { label: "Class", value: st.section.label },
            { label: "Fee", value: `${feeName}${year ? ` · ${year}` : ""}` },
            { label: "Method", value: payment.methodLabel || METHOD_LABELS[payment.method] },
            { label: "Reference", value: payment.referenceNo || "—" },
            { label: "Recorded by", value: payment.recordedBy?.fullName || "Accounts office" },
          ]}
        />
      </div>
    </Modal>
  );
}
