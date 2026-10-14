# Design system (`@expressoo/shared`)

All three portals import `@expressoo/shared/styles.css` and the components exported from `@expressoo/shared`. The goal is one recognisable product while each portal keeps its own information architecture.

## Visual language

| Token group | Values (see `packages/shared/src/styles/tokens.css`) |
|---|---|
| Navigation | Navy `--navy-900 #0f1a30` sidebar. Active item: `--navy-700` with a 3 px blue indicator |
| Surfaces | Page `#f5f6f8`, cards `#ffffff`, hairline borders `#dfe3ea` |
| Accent | One blue ramp. Buttons use `--primary-600 #256abf` (5.4:1 with white text); charts use `--chart-series-1 #2a78d6` |
| Text | Primary `#101828` (17.8:1), secondary `#475467` (7.7:1), muted `#667085` (4.97:1). All pass WCAG AA on white |
| Status | Success / warning / danger / info as tinted pills (text ≥ 5.2:1 on tint). Meters use the fixed status hues, **always with an icon and a label** |
| Type | Inter Variable (self-hosted). 14 px UI base; page titles 24/600; stat values 30/600; one 48 px hero figure per view |
| Shape | 8 px controls, 10 px cards, 14 px dialogs, pill badges |
| Elevation | `xs` on cards, `lg` on menus and toasts, `xl` on dialogs. No heavy shadows or gradients |
| Motion | 120–260 ms, `cubic-bezier(.2,0,0,1)`. Fully disabled under `prefers-reduced-motion` |

## Components

| Area | Components |
|---|---|
| Actions | `Button` (primary · secondary · ghost · danger · danger-ghost · link; sm/md/lg; loading state), `IconButton` |
| Forms | `TextField`, `SelectField`, `TextareaField`, `PasswordField` (show/hide), `SearchInput` (clearable), `Checkbox`, `Field` render-prop for custom controls. Inline errors with `aria-invalid` / `aria-describedby` |
| Data | `DataTable` (sortable client/server, skeleton rows, empty and error states, horizontal scroll on small screens), `Pagination`, `DescriptionList`, `KeyValue`, `PersonCell`, `Avatar`, `Badge`, `StatusBadge` (one mapping for every status in the system), `FileType` |
| Layout | `AppShell` (sidebar → drawer under 1024 px, topbar with notification bell and account menu), `AuthLayout` (split screen), `PageHeader`, `Breadcrumbs`, `Card`, `StatCard`, `Tabs`, `SegmentedControl` |
| Feedback | `ToastProvider`/`useToast`, `ConfirmProvider`/`useConfirm` (promise-based dialog), `Modal` (focus trap, Escape, focus return), `Callout`, `Skeleton`, `EmptyState`, `ErrorState`, `PageLoader`, `ErrorBoundary`, `NotFoundPage`, `UnauthorizedPage` |
| Upload | `FileDropzone` (drag & drop, client-side type/size checks), `ProgressBar` |
| Charts | `BarChart`, `LineChart`, `Meter`, `AttendanceMeter`, `SplitMeter`, `ChartCard` (Chart / Table toggle) |
| Features | `LoginPage`, `NotificationsPage` + `ComposeNotificationModal`, `AnnouncementsPage`, `AccountSettings`, `MaterialsLibrary`, `ReceiptModal`, `CategoryIcon`/`CategoryBadge` |
| Infrastructure | `createApiClient` (fetch + XHR upload progress + blob downloads + session-expiry events), `AuthProvider`/`useAuth`/`RequireAuth`/`GuestOnly`, `useApi` (keeps the previous data while refetching), `useAppConfig`, formatting helpers (INR currency, Indian dates, relative time, CSV export, secure temporary passwords) |

## Chart rules
Charts follow a documented data-visualisation method:
* **Single series in one accent hue.** The hue was validated with a colour-palette checker against the white surface.
* Bars are ≤ 24 px wide with 4 px rounded data ends anchored to the baseline. Lines are 2 px with a 10 % area wash. Gridlines are solid hairlines. There are no dual axes.
* Labels are selective: the maximum and latest values only. Thresholds (e.g. 75 % attendance) are a labelled rule.
* Every chart has a hover and keyboard tooltip, and a **table view** via `ChartCard`.
* Part-to-whole uses a `SplitMeter` with a 2 px surface gap and a legend, never a two-slice donut.

## Accessibility
* Skip link and landmark regions. Visible `:focus-visible` rings on every control. Logical tab order.
* Dialogs trap focus and restore it on close. Menus support arrow keys and Escape.
* Attendance marking supports keyboard shortcuts (P / L / A, ↑ / ↓) and gives screen readers row labels with the current status.
* Status is never shown by colour alone. Touch targets are at least 40 px on mobile.

## Responsive behaviour
Breakpoints are 1200 / 1024 / 900 / 640 / 480 px. Content uses a 1400 px max width on desktop (pages are not phone-width columns). Grids collapse progressively, tables scroll horizontally and hide secondary columns under 640 px, dialogs become bottom sheets on phones, and sticky action bars span the full width. Every route of all three portals was verified at 375 px with no page-level horizontal overflow.
