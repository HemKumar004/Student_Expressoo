import { useState } from "react";
import { BellRing, CheckCheck, Inbox, Send, SquarePen, Trash2, Users, CalendarDays } from "lucide-react";
import { Card } from "../components/Display.jsx";
import { Button } from "../components/Button.jsx";
import { Modal } from "../components/Overlay.jsx";
import { Tabs, SegmentedControl, PageHeader } from "../components/Navigation.jsx";
import { Pagination } from "../components/DataTable.jsx";
import { EmptyState, ErrorState, SkeletonRows, useToast, useConfirm, Callout } from "../components/Feedback.jsx";
import { TextField, SelectField, TextareaField, Select } from "../components/Form.jsx";
import { CategoryIcon, CategoryBadge } from "./notificationMeta.jsx";
import { useApi, usePageTitle, fieldErrors } from "../hooks/index.js";
import { cx, formatDateTime, formatRelative, CATEGORY_LABELS, pluralize } from "../utils/format.js";
import { notifyNotificationsChanged } from "../utils/events.js";

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

/**
 * mode: "admin" (any audience) | "staff" (assigned sections) | "rep" (own section, fixed)
 */
export function ComposeNotificationModal({ open, onClose, onSent, api, mode, sections = [], courses = [], fixedAudienceLabel }) {
  const toast = useToast();
  const empty = { title: "", message: "", category: mode === "rep" ? "GENERAL" : "ACADEMIC", targetType: mode === "admin" ? "STUDENTS" : "SECTION", courseId: "", sectionIds: [], eventAt: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  const categories = mode === "rep" ? ["GENERAL", "ACADEMIC", "EVENT"] : ["GENERAL", "ACADEMIC", "EXAM", "FEE", "EVENT", "URGENT"];
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const toggleSection = (id) => set("sectionIds", form.sectionIds.includes(id) ? form.sectionIds.filter((x) => x !== id) : [...form.sectionIds, id]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = "Add a short title";
    if (!form.message.trim()) next.message = "Write the message";
    if (mode !== "rep" && form.targetType === "SECTION" && form.sectionIds.length === 0) next.sectionIds = "Choose at least one section";
    if (form.targetType === "COURSE" && !form.courseId) next.courseId = "Choose a course";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    try {
      const body = {
        title: form.title,
        message: form.message,
        category: form.category,
        targetType: mode === "rep" ? "SECTION" : form.targetType,
        ...(form.targetType === "COURSE" && { courseId: Number(form.courseId) }),
        ...(form.targetType === "SECTION" && mode !== "rep" && { sectionIds: form.sectionIds }),
        ...(form.eventAt && { eventAt: new Date(form.eventAt).toISOString() }),
      };
      const r = await api.post("/notifications", body);
      toast.success("Notification sent", `Delivered to ${pluralize(r.recipientCount, "recipient")} · ${r.targetLabel}`);
      setForm(empty);
      onSent?.(r);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.fromError(err, "Couldn't send the notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={sending}
      size="lg"
      title={mode === "rep" ? "Message your class" : "Send a notification"}
      description={mode === "rep" ? `Students of ${fixedAudienceLabel} will see this in their notifications.` : "Recipients see it instantly in their portal inbox."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="submit" form="compose-notification" icon={Send} loading={sending}>
            Send notification
          </Button>
        </>
      }
    >
      <form id="compose-notification" className="stack" onSubmit={submit} noValidate>
        {mode === "admin" && (
          <SelectField label="Audience" value={form.targetType} onChange={(e) => set("targetType", e.target.value)} required>
            <option value="ALL">Everyone (students, staff and admins)</option>
            <option value="STUDENTS">All students</option>
            <option value="STAFF">All staff</option>
            <option value="COURSE">Students of a course</option>
            <option value="SECTION">Students of specific sections</option>
          </SelectField>
        )}
        {mode === "admin" && form.targetType === "COURSE" && (
          <SelectField label="Course" value={form.courseId} onChange={(e) => set("courseId", e.target.value)} error={errors.courseId} required>
            <option value="">Select a course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </SelectField>
        )}
        {mode !== "rep" && form.targetType === "SECTION" && (
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ marginBottom: 6 }}>
              Sections <span className="field-required">*</span>
            </legend>
            {sections.length === 0 ? (
              <Callout tone="warning">{mode === "staff" ? "You are not assigned to any sections yet." : "No sections exist yet."}</Callout>
            ) : (
              <div className="row wrap" style={{ gap: 8 }}>
                {sections.map((s) => (
                  <label key={s.id} className={cx("badge", "badge-lg", form.sectionIds.includes(s.id) && "badge-primary")} style={{ cursor: "pointer" }}>
                    <input type="checkbox" className="sr-only" checked={form.sectionIds.includes(s.id)} onChange={() => toggleSection(s.id)} />
                    <Users aria-hidden="true" />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
            {errors.sectionIds && <p className="field-error">{errors.sectionIds}</p>}
          </fieldset>
        )}
        <div className="form-grid">
          <SelectField label="Category" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectField>
          <TextField label="Date & time it refers to" type="datetime-local" value={form.eventAt} onChange={(e) => set("eventAt", e.target.value)} optional hint="e.g. a class, exam or event time" />
        </div>
        <TextField label="Title" value={form.title} onChange={(e) => set("title", e.target.value)} error={errors.title} maxLength={150} required placeholder="e.g. DBMS assignment due Friday" />
        <TextareaField label="Message" value={form.message} onChange={(e) => set("message", e.target.value)} error={errors.message} maxLength={5000} required rows={5} placeholder="Write the details students need to know…" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

function InboxList({ api }) {
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const { data, error, loading, initialLoading, refetch, setData } = useApi(
    () => api.get("/notifications", { query: { page, pageSize: 15, unread: filter === "unread" ? true : undefined, category: category || undefined } }),
    [page, filter, category]
  );

  const markRead = async (item) => {
    if (item.readAt) return;
    try {
      const r = await api.patch(`/notifications/${item.id}/read`);
      setData((d) => ({ ...d, unreadCount: r.unreadCount, items: d.items.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) }));
      notifyNotificationsChanged();
    } catch (err) {
      toast.fromError(err);
    }
  };

  const markAll = async () => {
    try {
      await api.post("/notifications/read-all");
      toast.success("All notifications marked as read");
      notifyNotificationsChanged();
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <Card
      flush
      refreshing={loading && !initialLoading}
      title="Inbox"
      subtitle={data ? (data.unreadCount ? `${data.unreadCount} unread` : "You're all caught up") : " "}
      actions={
        <Button variant="secondary" size="sm" icon={CheckCheck} onClick={markAll} disabled={!data?.unreadCount}>
          Mark all read
        </Button>
      }
    >
      <div className="toolbar" style={{ marginTop: 16 }}>
        <SegmentedControl
          label="Filter"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ]}
        />
        <Select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      {initialLoading && (
        <div style={{ padding: 24 }}>
          <SkeletonRows rows={5} height={56} />
        </div>
      )}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}
      {data && data.items.length === 0 && (
        <EmptyState icon={Inbox} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} description="Messages from your teachers, representatives and the college office will appear here." />
      )}
      {data && data.items.length > 0 && (
        <ul className="list">
          {data.items.map((item) => {
            const isOpen = expanded === item.id;
            return (
              <li
                key={item.id}
                className={cx("list-item is-interactive")}
                style={!item.readAt ? { background: "var(--primary-25)" } : undefined}
                onClick={() => {
                  setExpanded(isOpen ? null : item.id);
                  markRead(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpanded(isOpen ? null : item.id);
                    markRead(item);
                  }
                }}
                tabIndex={0}
                aria-expanded={isOpen}
              >
                <CategoryIcon category={item.category} />
                <div className="grow">
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <p className="list-title" style={{ fontWeight: item.readAt ? 500 : 600 }}>
                      {item.title}
                    </p>
                    <span className="text-xs muted nowrap" title={formatDateTime(item.createdAt)}>
                      {formatRelative(item.createdAt)}
                    </span>
                  </div>
                  <p className="list-meta">
                    {item.sender?.fullName} · {item.targetLabel}
                  </p>
                  <p className={cx("secondary", "mt-2")} style={isOpen ? { whiteSpace: "pre-wrap" } : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {item.message}
                  </p>
                  <div className="row-sm mt-2 wrap">
                    <CategoryBadge category={item.category} />
                    {item.eventAt && (
                      <span className="badge">
                        <CalendarDays aria-hidden="true" />
                        {formatDateTime(item.eventAt)}
                      </span>
                    )}
                  </div>
                </div>
                {!item.readAt && <span className="unread-dot" aria-label="Unread" />}
              </li>
            );
          })}
        </ul>
      )}
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="notifications" />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sent
// ---------------------------------------------------------------------------

function SentList({ api, reloadKey }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const { data, error, initialLoading, loading, refetch } = useApi(() => api.get("/notifications/sent", { query: { page, pageSize: 15 } }), [page, reloadKey]);

  const remove = async (n) => {
    const ok = await confirm({
      title: "Withdraw this notification?",
      message: `"${n.title}" will be removed from ${pluralize(n.recipientCount, "recipient")}'s inbox. This cannot be undone.`,
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.del(`/notifications/${n.id}`);
      toast.success("Notification withdrawn");
      refetch();
    } catch (err) {
      toast.fromError(err);
    }
  };

  return (
    <Card flush title="Sent" subtitle="Delivery and read rates for messages you have sent" refreshing={loading && !initialLoading}>
      <div style={{ height: 16 }} />
      {initialLoading && (
        <div style={{ padding: 24 }}>
          <SkeletonRows rows={4} height={56} />
        </div>
      )}
      {error && !data && <ErrorState error={error} onRetry={refetch} />}
      {data?.items.length === 0 && <EmptyState icon={Send} title="Nothing sent yet" description="Notifications you send will be listed here with their read rate." />}
      {data?.items.length > 0 && (
        <ul className="list">
          {data.items.map((n) => {
            const rate = n.recipientCount ? Math.round((n.readCount / n.recipientCount) * 100) : 0;
            return (
              <li key={n.id} className="list-item">
                <CategoryIcon category={n.category} />
                <div className="grow">
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <p className="list-title">{n.title}</p>
                    <span className="text-xs muted nowrap">{formatRelative(n.createdAt)}</span>
                  </div>
                  <p className="list-meta">
                    To {n.targetLabel}
                    {n.sender && n.sender.fullName ? ` · by ${n.sender.fullName}` : ""}
                  </p>
                  <p className="secondary mt-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {n.message}
                  </p>
                  <div className="row mt-2" style={{ maxWidth: 360 }}>
                    <div className="progress progress-sm grow" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label="Read rate">
                      <div className="progress-bar" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs secondary nowrap num">
                      {n.readCount}/{n.recipientCount} read
                    </span>
                  </div>
                </div>
                {n.canDelete && <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => remove(n)} aria-label={`Withdraw ${n.title}`}><Trash2 aria-hidden="true" /></button>}
              </li>
            );
          })}
        </ul>
      )}
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} label="notifications" />}
    </Card>
  );
}

/**
 * Full notifications page. When `compose` is provided the user can send and see sent items.
 * compose: { mode, sections, courses, fixedAudienceLabel }
 */
export function NotificationsPage({ api, compose, description = "Messages from your teachers, class representatives and the college office." }) {
  usePageTitle("Notifications");
  const [tab, setTab] = useState("inbox");
  const [composeOpen, setComposeOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <>
      <PageHeader
        title="Notifications"
        description={description}
        actions={
          compose && (
            <Button icon={SquarePen} onClick={() => setComposeOpen(true)}>
              {compose.mode === "rep" ? "Message class" : "New notification"}
            </Button>
          )
        }
      />
      {compose && (
        <Tabs
          className="mb-tabs"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "inbox", label: "Inbox", icon: BellRing },
            { id: "sent", label: "Sent", icon: Send },
          ]}
        />
      )}
      <div style={{ marginTop: compose ? 20 : 0 }}>{tab === "inbox" ? <InboxList api={api} /> : <SentList api={api} reloadKey={reloadKey} />}</div>
      {compose && (
        <ComposeNotificationModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setReloadKey((k) => k + 1);
            setTab("sent");
          }}
          api={api}
          {...compose}
        />
      )}
    </>
  );
}
