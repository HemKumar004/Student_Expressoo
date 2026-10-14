// Student Expressoo shared package — design system, API client, auth and shared features.
export { createApiClient, ApiError } from "./api/client.js";
export { AuthProvider, useAuth, RequireAuth, GuestOnly } from "./auth/AuthContext.jsx";
export { PortalProviders } from "./PortalProviders.jsx";

export { useApi, useDebouncedValue, usePageTitle, setTitleSuffix, useMediaQuery, useDismiss, useListState, fieldErrors, useAppConfig } from "./hooks/index.js";
export * from "./utils/format.js";
export { NOTIFICATIONS_CHANGED, notifyNotificationsChanged } from "./utils/events.js";

export { Button, IconButton, Spinner } from "./components/Button.jsx";
export { Input, Select, Textarea, Field, TextField, SelectField, TextareaField, PasswordField, SearchInput, Checkbox } from "./components/Form.jsx";
export { Card, StatCard, Badge, StatusBadge, Avatar, PersonCell, DescriptionList, KeyValue, FileType } from "./components/Display.jsx";
export { ToastProvider, useToast, ConfirmProvider, useConfirm, Callout, Skeleton, SkeletonRows, EmptyState, ErrorState } from "./components/Feedback.jsx";
export { Modal, Menu } from "./components/Overlay.jsx";
export { PageHeader, Breadcrumbs, Tabs, SegmentedControl } from "./components/Navigation.jsx";
export { DataTable, Pagination } from "./components/DataTable.jsx";
export { FileDropzone, ProgressBar } from "./components/Upload.jsx";
export { BarChart, LineChart, Meter, AttendanceMeter, SplitMeter, ChartCard } from "./charts/Charts.jsx";

export { AppShell } from "./layout/AppShell.jsx";
export { AuthLayout } from "./layout/AuthLayout.jsx";
export { Brand, BrandMark } from "./layout/Brand.jsx";
export { PageLoader, NotFoundPage, UnauthorizedPage, ErrorBoundary } from "./layout/StatusPages.jsx";

export { LoginPage } from "./features/LoginPage.jsx";
export { NotificationsPage, ComposeNotificationModal } from "./features/Notifications.jsx";
export { AnnouncementsPage, AnnouncementItem } from "./features/Announcements.jsx";
export { AccountSettings } from "./features/AccountSettings.jsx";
export { MaterialsLibrary } from "./features/MaterialsLibrary.jsx";
export { CategoryIcon, CategoryBadge } from "./features/notificationMeta.jsx";
export { ReceiptModal } from "./features/Receipt.jsx";
