/**
 * Persisted notification channel preferences (localStorage).
 */

export const NOTIFICATION_PREFS_KEY = 'aa2000_notification_prefs';

export interface NotificationPrefs {
  email: boolean;
  /** Technician: assignments to new projects */
  newProjects: boolean;
  /** Technician: project approved/rejected by Sales/Admin */
  finalizationUpdates: boolean;
  /** Sales/Admin: projects ready for finalization */
  approvalRequests: boolean;
  /** Sales/Admin: technician accept/decline on assignments */
  technicianResponses: boolean;
  security: boolean;
}

export function loadNotificationPrefs(): NotificationPrefs {
  const defaults: NotificationPrefs = {
    email: true,
    newProjects: true,
    finalizationUpdates: true,
    approvalRequests: true,
    technicianResponses: true,
    security: true,
  };
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const legacyApproval = p.approval !== false;
    return {
      email: p.email !== false,
      newProjects: typeof p.newProjects === 'boolean' ? p.newProjects : legacyApproval,
      finalizationUpdates: typeof p.finalizationUpdates === 'boolean' ? p.finalizationUpdates : true,
      approvalRequests: typeof p.approvalRequests === 'boolean' ? p.approvalRequests : legacyApproval,
      technicianResponses: typeof p.technicianResponses === 'boolean' ? p.technicianResponses : true,
      security: p.security !== false,
    };
  } catch {
    return defaults;
  }
}

export function persistNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}
