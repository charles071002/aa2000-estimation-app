import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '../types';
import type { ThemeMode } from './18_Profile';
import {
  countUnreadVisible,
  getVisibleNotifications,
  markAllVisibleRead,
  NOTIFICATIONS_UPDATED_EVENT,
  type InAppNotification,
} from '../utils/inAppNotifications';

export type PortalNavKey = 'ongoing' | 'upcoming' | 'history' | 'create' | 'finalized';

interface Props {
  user: User;
  userRole: 'TECHNICIAN' | 'ADMIN' | null;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  compactMode: boolean;
  onCompactModeChange: (compact: boolean) => void;
  /** Which primary nav item is active (sidebar). Omit on profile-only views. */
  activeNav?: PortalNavKey | null;
  onNavigate: (key: PortalNavKey) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  /** Header title override (e.g. page name). */
  headerTitle?: string;
  children: React.ReactNode;
}

function formatNotifTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function roleLabel(userRole: 'TECHNICIAN' | 'ADMIN' | null): string {
  if (userRole === 'ADMIN') return 'Admin';
  if (userRole === 'TECHNICIAN') return 'Technician';
  return 'Guest';
}

/**
 * Shared portal chrome: sidebar with blue accents, top header with role, notifications, profile menu.
 */
const PortalLayout: React.FC<Props> = ({
  user,
  userRole,
  theme,
  onThemeChange,
  compactMode,
  onCompactModeChange,
  activeNav,
  onNavigate,
  onOpenProfile,
  onLogout,
  headerTitle,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [notifItems, setNotifItems] = useState<InAppNotification[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [displaySectionOpen, setDisplaySectionOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  const refreshNotifications = useCallback(() => {
    setBadgeCount(countUnreadVisible(user.email, userRole));
    setNotifItems(getVisibleNotifications(user.email, userRole));
  }, [user.email, userRole]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const onUpdated = () => refreshNotifications();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onUpdated);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onUpdated);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) {
        setProfileMenuOpen(false);
        setDisplaySectionOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileMenuOpen(false);
        setDisplaySectionOpen(false);
        setHelpOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const navItems: { key: PortalNavKey; label: string; icon: string; adminOnly?: boolean }[] = [
    { key: 'ongoing', label: 'Ongoing', icon: 'fa-circle' },
    { key: 'upcoming', label: 'Upcoming', icon: 'fa-clock' },
    { key: 'history', label: 'History', icon: 'fa-history' },
    { key: 'create', label: 'Create', icon: 'fa-plus-circle', adminOnly: true },
    { key: 'finalized', label: 'Finalized', icon: 'fa-file-contract', adminOnly: true },
  ];

  const visibleNav = navItems.filter((i) => !i.adminOnly || userRole === 'ADMIN');

  const NavButton: React.FC<{ item: (typeof navItems)[0] }> = ({ item }) => {
    const active = activeNav === item.key;
    const baseBtn = isDark
      ? active
        ? 'border border-blue-500/80 bg-blue-950/50 font-bold text-blue-200 shadow-[inset_3px_0_0_0_#3b82f6]'
        : 'border border-transparent font-semibold text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
      : active
        ? 'border border-blue-500/90 bg-blue-50 font-bold text-blue-900 shadow-[inset_3px_0_0_0_#2563eb]'
        : 'border border-transparent font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900';

    const iconBox = isDark
      ? active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-blue-300'
      : active
        ? 'bg-blue-600 text-white'
        : 'bg-sky-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700';

    return (
      <button
        type="button"
        title={item.label}
        onClick={() => {
          onNavigate(item.key);
          setMobileOpen(false);
        }}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition touch-target md:px-3 ${baseBtn}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:h-9 md:w-9 ${iconBox}`}>
          <i className={`fas ${item.icon} text-sm`} aria-hidden="true"></i>
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-[11px] uppercase tracking-widest md:inline md:text-xs">{item.label}</span>
      </button>
    );
  };

  const helpRoleBody =
    userRole === 'ADMIN'
      ? 'As Sales & Admin, use Create to add projects, review technician work from the dashboard, and open Finalized for archived reports and PDF export.'
      : userRole === 'TECHNICIAN'
        ? 'As a Technician, accept assigned projects, run surveys from Project Details, complete AI clarification, and submit for review when your audit is done.'
        : 'Sign in with a technician or admin account to access workspace tools.';

  const menuSurface = isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white';
  const menuItemHover = isDark ? 'hover:bg-slate-800/90' : 'hover:bg-slate-100';
  const menuMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}
    >
      {/* Top header */}
      <header
        className={`flex h-14 shrink-0 items-center justify-between border-b px-3 md:px-6 ${
          isDark ? 'border-slate-800 bg-[#0a1628]' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <button
            type="button"
            className={`touch-target flex h-11 w-11 items-center justify-center rounded-xl border md:hidden ${
              isDark ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
            }`}
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <i className="fas fa-bars" aria-hidden="true"></i>
          </button>
          <div className="min-w-0">
            <p className={`truncate text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {headerTitle ?? 'AA2000 Portal'}
            </p>
            <p className={`truncate text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <span className="text-blue-500">{roleLabel(userRole)}</span>
              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}> · </span>
              <span className="font-medium">{user.fullName || 'User'}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className={`touch-target relative flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                isDark ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              aria-label={`Notifications${badgeCount ? `, ${badgeCount} unread` : ''}`}
              onClick={() => setNotifOpen((o) => !o)}
            >
              <i className="fas fa-bell" aria-hidden="true"></i>
              {badgeCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div
                className={`absolute right-0 z-[120] mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border py-2 shadow-2xl ${menuSurface}`}
                role="menu"
              >
                <p className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${menuMuted}`}>Notifications</p>
                <div className={`max-h-64 overflow-y-auto px-2 ${notifItems.length ? 'pb-1' : ''}`}>
                  {notifItems.length === 0 ? (
                    <p className={`px-3 py-4 text-center text-[11px] ${menuMuted}`}>No notifications yet.</p>
                  ) : (
                    notifItems.map((n) => (
                      <div
                        key={n.id}
                        className={`mb-1 rounded-xl px-3 py-2.5 text-left ${
                          n.read
                            ? isDark
                              ? 'bg-transparent'
                              : 'bg-transparent'
                            : isDark
                              ? 'bg-blue-950/40 ring-1 ring-blue-500/25'
                              : 'bg-blue-50/90 ring-1 ring-blue-200/60'
                        }`}
                      >
                        <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{n.message}</p>
                        {n.projectName && (
                          <p className={`mt-1 truncate text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{n.projectName}</p>
                        )}
                        <p className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${menuMuted}`}>{formatNotifTime(n.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className={`w-full px-4 py-2.5 text-left text-xs font-bold ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-50'}`}
                  disabled={!notifItems.some((n) => !n.read)}
                  onClick={() => {
                    markAllVisibleRead(user.email, userRole);
                    refreshNotifications();
                    setNotifOpen(false);
                  }}
                >
                  Mark all as read
                </button>
                <p className={`border-t px-4 py-2 text-[10px] ${isDark ? 'border-slate-700' : 'border-slate-100'} ${menuMuted}`}>
                  Types you see depend on your role; turn channels on or off in profile.
                </p>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className={`touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition ${
                isDark ? 'border-blue-500/50 bg-slate-800 text-blue-300 hover:bg-slate-700' : 'border-blue-300 bg-sky-50 text-blue-600 hover:bg-blue-100'
              } ${profileMenuOpen ? 'ring-2 ring-blue-500/50' : ''}`}
              aria-label="Account menu"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <i className="fas fa-user text-sm" aria-hidden="true"></i>
            </button>

            {profileMenuOpen && (
              <div
                className={`absolute right-0 z-[130] mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-2xl ${menuSurface}`}
                role="menu"
              >
                <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${menuMuted}`}>Signed in</p>
                  <p className={`truncate text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{user.fullName || 'User'}</p>
                  <p className={`truncate text-xs ${menuMuted}`}>{user.email}</p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${isDark ? 'text-slate-100' : 'text-slate-800'} ${menuItemHover}`}
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenProfile();
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-500">
                    <i className="fas fa-shield-halved text-sm" aria-hidden="true"></i>
                  </span>
                  Settings &amp; Privacy
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${isDark ? 'text-slate-100' : 'text-slate-800'} ${menuItemHover}`}
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setHelpOpen(true);
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-500">
                    <i className="fas fa-circle-question text-sm" aria-hidden="true"></i>
                  </span>
                  Help &amp; Support
                </button>

                <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold transition ${isDark ? 'text-slate-100' : 'text-slate-800'} ${menuItemHover}`}
                    onClick={() => setDisplaySectionOpen((v) => !v)}
                    aria-expanded={displaySectionOpen}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-500">
                        <i className="fas fa-universal-access text-sm" aria-hidden="true"></i>
                      </span>
                      <span className="min-w-0">Display &amp; Accessibility</span>
                    </span>
                    <i className={`fas fa-chevron-down text-xs text-slate-400 transition ${displaySectionOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
                  </button>

                  {displaySectionOpen && (
                    <div className={`space-y-3 px-4 pb-4 pt-0 ${isDark ? 'bg-slate-950/50' : 'bg-slate-50/90'}`}>
                      <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs">
                        <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Dark mode</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isDark}
                          onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
                          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                            isDark ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              isDark ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs">
                        <div>
                          <p className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Compact mode</p>
                          <p className={`mt-0.5 ${menuMuted}`}>Smaller interface text</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={compactMode}
                          onClick={() => onCompactModeChange(!compactMode)}
                          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                            compactMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              compactMode ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`border-t p-2 ${isDark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:bg-red-500"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <i className="fas fa-right-from-bracket" aria-hidden="true"></i>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-[890] bg-black/50 md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={`fixed bottom-0 left-0 top-14 z-[891] flex flex-col border-r transition-transform duration-300 md:static md:top-0 md:translate-x-0 ${
            isDark ? 'border-slate-800 bg-[#060d18]' : 'border-slate-200 bg-white'
          } w-[4.5rem] md:w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          aria-label="Main navigation"
        >
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 md:p-4">
            <nav className="flex flex-col gap-1" aria-label="Workspace">
              {visibleNav.map((item) => (
                <NavButton key={item.key} item={item} />
              ))}
            </nav>
          </div>
        </aside>

        <main className={`min-h-0 flex-1 overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>{children}</main>
      </div>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[940] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className={`my-auto w-full max-w-md rounded-2xl border p-6 shadow-2xl ${menuSurface}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="help-dialog-title" className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Help &amp; Support
              </h2>
              <button
                type="button"
                className={`rounded-lg p-2 ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                aria-label="Close"
                onClick={() => setHelpOpen(false)}
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div className={`space-y-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <section>
                <h3 className={`mb-1 text-xs font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>About this app</h3>
                <p>
                  AA2000 Site Survey helps teams capture field audits, run AI-assisted clarification, and produce estimates and summaries. Data shown here is stored on this device unless your
                  organization connects a server.
                </p>
              </section>
              <section>
                <h3 className={`mb-1 text-xs font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {userRole === 'ADMIN' ? 'Sales & Admin' : userRole === 'TECHNICIAN' ? 'Technician' : 'Guest'} tips
                </h3>
                <p>{helpRoleBody}</p>
              </section>
            </div>
            <button
              type="button"
              className={`mt-6 w-full rounded-xl py-3 text-sm font-black uppercase tracking-wider ${isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-200 text-slate-900 hover:bg-slate-300'}`}
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalLayout;
