/** Fired after the staff member acknowledges/resolves an alert so the sidebar badge refreshes. */
export const ALERTS_CHANGED = "se:alerts-changed";
export const notifyAlertsChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED));
