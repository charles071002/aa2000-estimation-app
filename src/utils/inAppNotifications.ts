import type { Project } from '../types';
import { loadNotificationPrefs, type NotificationPrefs } from './notificationPrefs';

const STORAGE_KEY = 'aa2000_in_app_notifications_v1';

export const NOTIFICATIONS_UPDATED_EVENT = 'aa2000-notifications-updated';

export type InAppNotificationKind =
  | 'TECH_ASSIGNMENT'
  | 'TECH_FINALIZATION'
  | 'ADMIN_FINALIZATION_REQUEST'
  | 'ADMIN_TECH_RESPONSE';

export interface InAppNotification {
  id: string;
  createdAt: string;
  kind: InAppNotificationKind;
  message: string;
  projectId: string;
  projectName?: string;
  /** Target technician email; null only for Sales/Admin broadcast rows */
  recipientEmail: string | null;
  recipientRole: 'TECHNICIAN' | 'ADMIN';
  read: boolean;
}

function readAll(): InAppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InAppNotification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: InAppNotification[]): void {
  const capped = items.slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
}

export function dispatchNotificationsUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

function push(n: Omit<InAppNotification, 'id' | 'createdAt' | 'read'> & { read?: boolean }): void {
  const row: InAppNotification = {
    ...n,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    read: n.read ?? false,
  };
  writeAll([row, ...readAll()]);
  dispatchNotificationsUpdated();
}

/** Resolve technician emails for finalization alerts (assigned list, else name lookup). */
export function resolveTechnicianEmails(project: Project): string[] {
  const fromAssigned = (project.assignedTechnicians ?? []).map((t) => t.email.trim().toLowerCase()).filter(Boolean);
  if (fromAssigned.length) return [...new Set(fromAssigned)];
  try {
    const raw = localStorage.getItem('aa2000_technicians');
    if (!raw) return [];
    const techs = JSON.parse(raw) as Array<{ fullName: string; email: string }>;
    const match = techs.find((t) => t.fullName === project.technicianName);
    return match?.email ? [match.email.trim().toLowerCase()] : [];
  } catch {
    return [];
  }
}

function outcomeLabel(status: 'Finalized' | 'Rejected'): 'Approved' | 'Rejected' {
  return status === 'Finalized' ? 'Approved' : 'Rejected';
}

export function notifyTechniciansAssigned(project: Project): void {
  const techs = project.assignedTechnicians ?? [];
  const list = techs.length ? techs : [];
  for (const t of list) {
    const email = t.email.trim().toLowerCase();
    if (!email) continue;
    push({
      kind: 'TECH_ASSIGNMENT',
      message: "You've been assigned to a new project.",
      projectId: project.id,
      projectName: project.name,
      recipientEmail: email,
      recipientRole: 'TECHNICIAN',
    });
  }
}

export function notifyAdminsProjectReadyForFinalization(project: Project): void {
  push({
    kind: 'ADMIN_FINALIZATION_REQUEST',
    message: 'A project is ready for finalization.',
    projectId: project.id,
    projectName: project.name,
    recipientEmail: null,
    recipientRole: 'ADMIN',
  });
}

export function notifyTechniciansProjectFinalized(project: Project, status: 'Finalized' | 'Rejected'): void {
  const label = outcomeLabel(status);
  const msg = `Your project has been finalized: ${label}.`;
  for (const email of resolveTechnicianEmails(project)) {
    push({
      kind: 'TECH_FINALIZATION',
      message: msg,
      projectId: project.id,
      projectName: project.name,
      recipientEmail: email,
      recipientRole: 'TECHNICIAN',
    });
  }
}

export function notifyAdminsTechnicianResponse(
  project: Project,
  technicianName: string,
  response: 'ACCEPTED' | 'DECLINED'
): void {
  const action = response === 'ACCEPTED' ? 'Accepted' : 'Rejected';
  push({
    kind: 'ADMIN_TECH_RESPONSE',
    message: `Technician ${technicianName} has ${action} the project.`,
    projectId: project.id,
    projectName: project.name,
    recipientEmail: null,
    recipientRole: 'ADMIN',
  });
}

function isVisible(n: InAppNotification, userEmail: string, userRole: 'TECHNICIAN' | 'ADMIN' | null, prefs: NotificationPrefs): boolean {
  if (userRole === 'TECHNICIAN') {
    if (n.recipientRole !== 'TECHNICIAN' || !n.recipientEmail) return false;
    if (n.recipientEmail.toLowerCase() !== userEmail.toLowerCase()) return false;
    if (n.kind === 'TECH_ASSIGNMENT' && !prefs.newProjects) return false;
    if (n.kind === 'TECH_FINALIZATION' && !prefs.finalizationUpdates) return false;
    return n.kind === 'TECH_ASSIGNMENT' || n.kind === 'TECH_FINALIZATION';
  }
  if (userRole === 'ADMIN') {
    if (n.recipientRole !== 'ADMIN') return false;
    if (n.kind === 'ADMIN_FINALIZATION_REQUEST' && !prefs.approvalRequests) return false;
    if (n.kind === 'ADMIN_TECH_RESPONSE' && !prefs.technicianResponses) return false;
    return n.kind === 'ADMIN_FINALIZATION_REQUEST' || n.kind === 'ADMIN_TECH_RESPONSE';
  }
  return false;
}

export function getVisibleNotifications(userEmail: string, userRole: 'TECHNICIAN' | 'ADMIN' | null): InAppNotification[] {
  const prefs = loadNotificationPrefs();
  return readAll()
    .filter((n) => isVisible(n, userEmail, userRole, prefs))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function countUnreadVisible(userEmail: string, userRole: 'TECHNICIAN' | 'ADMIN' | null): number {
  return getVisibleNotifications(userEmail, userRole).filter((n) => !n.read).length;
}

export function markAllVisibleRead(userEmail: string, userRole: 'TECHNICIAN' | 'ADMIN' | null): void {
  const prefs = loadNotificationPrefs();
  const all = readAll();
  const visibleIds = new Set(
    all.filter((n) => isVisible(n, userEmail, userRole, prefs)).map((n) => n.id)
  );
  if (!visibleIds.size) return;
  const next = all.map((n) => (visibleIds.has(n.id) ? { ...n, read: true } : n));
  writeAll(next);
  dispatchNotificationsUpdated();
}
