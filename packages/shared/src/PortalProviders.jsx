import { AuthProvider } from "./auth/AuthContext.jsx";
import { ToastProvider, ConfirmProvider } from "./components/Feedback.jsx";
import { ErrorBoundary } from "./layout/StatusPages.jsx";

/** Everything a portal needs around its router: error boundary, toasts, confirmations, session. */
export function PortalProviders({ api, portal, children }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider api={api} portal={portal}>
            {children}
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
