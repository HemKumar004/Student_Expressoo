/** Cross-component signal: something changed the current user's unread notifications. */
export const NOTIFICATIONS_CHANGED = "se:notifications-changed";
export const notifyNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
