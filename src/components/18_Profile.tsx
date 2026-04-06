import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from '../types';
import PortalLayout, { PortalNavKey } from './19_PortalLayout';
import { loadNotificationPrefs, persistNotificationPrefs, type NotificationPrefs } from '../utils/notificationPrefs';
import { NOTIFICATIONS_UPDATED_EVENT } from '../utils/inAppNotifications';

export type { NotificationPrefs };

const THEME_KEY = 'aa2000_theme';
const COMPACT_MODE_KEY = 'aa2000_compact_mode';
const TWO_FACTOR_KEY = 'aa2000_two_factor_enabled';
const LOGIN_ACTIVITY_KEY = 'aa2000_login_activity_v1';
const SESSIONS_KEY = 'aa2000_sessions_v1';
const SESSION_ID_KEY = 'aa2000_session_id';

export type ThemeMode = 'light' | 'dark';

export interface LoginActivityRow {
  id: string;
  at: string;
  summary: string;
  ip: string;
  client: string;
}

export interface SessionRow {
  id: string;
  deviceLabel: string;
  browser: string;
  lastActive: string;
}

interface Props {
  user: User;
  userRole: 'TECHNICIAN' | 'ADMIN' | null;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  compactMode: boolean;
  onCompactModeChange: (compact: boolean) => void;
  onUserUpdate: (u: User) => void;
  onPortalNavigate: (key: PortalNavKey) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const phoneDigits = (v: string) => v.replace(/\D/g, '');
const phoneValid = (v: string) => {
  const d = phoneDigits(v);
  return d.length >= 10 && d.length <= 15;
};

function loadTwoFactor(): boolean {
  try {
    return localStorage.getItem(TWO_FACTOR_KEY) === '1';
  } catch {
    return false;
  }
}

function persistTwoFactor(on: boolean) {
  localStorage.setItem(TWO_FACTOR_KEY, on ? '1' : '0');
}

function ensureSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

function seedLoginActivityIfEmpty(): LoginActivityRow[] {
  const raw = localStorage.getItem(LOGIN_ACTIVITY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* fall through */
    }
  }
  const now = Date.now();
  const demo: LoginActivityRow[] = [
    {
      id: 'la-1',
      at: new Date(now - 86400000 * 2).toISOString(),
      summary: 'Successful login',
      ip: '203.0.113.10',
      client: 'Chrome · Windows',
    },
    {
      id: 'la-2',
      at: new Date(now - 86400000).toISOString(),
      summary: 'Successful login',
      ip: '198.51.100.2',
      client: 'Safari · macOS',
    },
    {
      id: 'la-3',
      at: new Date(now - 3600000).toISOString(),
      summary: 'Successful login',
      ip: '203.0.113.44',
      client: 'Edge · Windows',
    },
  ];
  localStorage.setItem(LOGIN_ACTIVITY_KEY, JSON.stringify(demo));
  return demo;
}

function seedSessionsIfNeeded(currentId: string): SessionRow[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SessionRow[];
      if (Array.isArray(parsed) && parsed.length) {
        const hasCurrent = parsed.some((s) => s.id === currentId);
        if (!hasCurrent) {
          const next: SessionRow[] = [
            {
              id: currentId,
              deviceLabel: 'This device',
              browser: typeof navigator !== 'undefined' ? `${browserName()} · ${osHint()}` : 'Current session',
              lastActive: new Date().toISOString(),
            },
            ...parsed,
          ];
          localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
          return next;
        }
        const bumped = parsed.map((s) =>
          s.id === currentId ? { ...s, lastActive: new Date().toISOString() } : s
        );
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(bumped));
        return bumped;
      }
    } catch {
      /* fall through */
    }
  }
  const list: SessionRow[] = [
    {
      id: currentId,
      deviceLabel: 'This device',
      browser: typeof navigator !== 'undefined' ? `${browserName()} · ${osHint()}` : 'Current session',
      lastActive: new Date().toISOString(),
    },
    {
      id: 'sess-other-1',
      deviceLabel: 'Mobile · iPhone',
      browser: 'Safari · iOS',
      lastActive: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  return list;
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Browser';
}

function osHint(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Desktop';
}

const sectionCardDark =
  'rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-lg backdrop-blur-sm';
const sectionCardLight =
  'rounded-2xl border border-slate-200 bg-white shadow-lg';

const labelClassDark = 'block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-0.5';
const labelClassLight = 'block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-0.5';
const inputClassDark =
  'w-full rounded-xl border-2 border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-bold text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none transition';
const inputClassLight =
  'w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none transition';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-600 bg-slate-800/50 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 transition hover:border-blue-500 hover:text-white active:scale-[0.98]';

/**
 * Profile & settings: appearance, personal info, security, notifications.
 */
function formatSessionStatus(lastActiveIso: string): string {
  try {
    const t = new Date(lastActiveIso).getTime();
    const diff = Date.now() - t;
    if (diff < 120000) return 'Unknown · Just now';
    if (diff < 3600000) return `Unknown · ${Math.floor(diff / 60000)}m ago`;
    return `Unknown · ${new Date(lastActiveIso).toLocaleString()}`;
  } catch {
    return 'Unknown · Just now';
  }
}

const Profile: React.FC<Props> = ({ user, userRole, theme, onThemeChange, compactMode, onCompactModeChange, onUserUpdate, onPortalNavigate, onOpenProfile, onLogout }) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState(user.role ?? (userRole === 'ADMIN' ? 'Sales & Admin' : 'Technician'));
  const [department, setDepartment] = useState(user.department ?? '');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [saveMsg, setSaveMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  const [notif, setNotif] = useState(loadNotificationPrefs);
  const [twoFactor, setTwoFactor] = useState(loadTwoFactor);
  const [loginActivity, setLoginActivity] = useState<LoginActivityRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const currentSessionId = useMemo(() => ensureSessionId(), []);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ original: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    setLoginActivity(seedLoginActivityIfEmpty());
    setSessions(seedSessionsIfNeeded(currentSessionId));
  }, [currentSessionId]);

  useEffect(() => {
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone ?? '');
    setRole(user.role ?? (userRole === 'ADMIN' ? 'Sales & Admin' : 'Technician'));
    setDepartment(user.department ?? '');
  }, [user, userRole]);

  const persistTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(THEME_KEY, mode);
    onThemeChange(mode);
  }, [onThemeChange]);

  const handleNotifToggle = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...notif, [key]: value };
    setNotif(next);
    persistNotificationPrefs(next);
    try {
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
    } catch {
      /* ignore */
    }
  };

  const handleTwoFactor = (on: boolean) => {
    setTwoFactor(on);
    persistTwoFactor(on);
  };

  const isDark = theme === 'dark';
  const sectionCard = isDark ? sectionCardDark : sectionCardLight;
  const labelClass = isDark ? labelClassDark : labelClassLight;
  const inputClass = isDark ? inputClassDark : inputClassLight;
  const sectionBorder = isDark ? 'border-slate-700/80' : 'border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';
  const subheading = isDark ? 'text-blue-400' : 'text-blue-600';
  const appearanceRail = isDark ? 'border-slate-600 bg-slate-800/50' : 'border-slate-200 bg-slate-100';
  const appearanceInactive = isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900';
  const strongText = isDark ? 'text-slate-100' : 'text-slate-900';
  const tableWrap = isDark ? 'border-slate-700' : 'border-slate-200';
  const tableHead = isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500';
  const tableBody = isDark ? 'divide-y divide-slate-700 bg-slate-900/50' : 'divide-y divide-slate-200 bg-white';
  const tableCellMuted = isDark ? 'text-slate-300' : 'text-slate-600';
  const tableRowText = isDark ? 'text-slate-200' : 'text-slate-800';
  const sessionOther = isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50';
  const sessionCurrentBg = isDark ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50' : 'border-blue-600 bg-blue-50 ring-1 ring-blue-200';
  const footerMuted = isDark ? 'text-slate-600' : 'text-slate-400';

  const savePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg('idle');
    const err: { email?: string; phone?: string } = {};
    if (!emailValid(email)) err.email = 'Enter a valid email address.';
    if (phone.trim() && !phoneValid(phone)) err.phone = 'Use 10–15 digits (spaces and + allowed).';
    setFieldErrors(err);
    if (Object.keys(err).length) {
      setSaveMsg('err');
      return;
    }

    const prevEmail = user.email;
    const updated: User = {
      ...user,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role: role.trim() || undefined,
      department: department.trim() || undefined,
    };

    localStorage.setItem('aa2000_user', JSON.stringify(updated));
    const techRaw = localStorage.getItem('aa2000_technicians');
    if (techRaw) {
      try {
        const technicians = JSON.parse(techRaw) as Array<{ fullName: string; email: string; password?: string }>;
        const idx = technicians.findIndex((t) => t.email.toLowerCase() === prevEmail.toLowerCase());
        if (idx !== -1) {
          technicians[idx] = {
            ...technicians[idx],
            fullName: updated.fullName,
            email: updated.email,
          };
          localStorage.setItem('aa2000_technicians', JSON.stringify(technicians));
        }
      } catch {
        /* ignore */
      }
    }

    onUserUpdate(updated);
    setSaveMsg('ok');
    window.setTimeout(() => setSaveMsg('idle'), 2500);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!passwords.original || !passwords.new || !passwords.confirm) {
      setPwError('All fields are required.');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    if (passwords.new.length < 6) {
      setPwError('Password must be at least 6 characters.');
      return;
    }

    const techniciansRaw = localStorage.getItem('aa2000_technicians');
    if (!techniciansRaw) {
      setPwError('Password is managed by your administrator.');
      return;
    }
    const technicians = JSON.parse(techniciansRaw) as Array<{ email: string; password?: string }>;
    const idx = technicians.findIndex((t) => t.email.toLowerCase() === user.email.toLowerCase());
    if (idx === -1) {
      setPwError('Account not found in local directory. Use admin tools if applicable.');
      return;
    }
    if (technicians[idx].password !== passwords.original) {
      setPwError('Current password is incorrect.');
      return;
    }
    technicians[idx].password = passwords.new;
    localStorage.setItem('aa2000_technicians', JSON.stringify(technicians));
    setPwSuccess(true);
    window.setTimeout(() => {
      setShowPasswordModal(false);
      setPwSuccess(false);
      setPasswords({ original: '', new: '', confirm: '' });
    }, 1200);
  };

  const ToggleRow: React.FC<{
    id: string;
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    tooltip?: string;
    isDark: boolean;
  }> = ({ id, title, description, checked, onChange, tooltip, isDark: rowDark }) => (
    <div
      className={`flex items-start justify-between gap-4 py-3 border-b last:border-0 ${
        rowDark ? 'border-slate-700/80' : 'border-slate-200'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-bold ${rowDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</p>
          {tooltip && (
            <span className={rowDark ? 'text-slate-500' : 'text-slate-400'} title={tooltip}>
              <i className="fas fa-circle-info text-xs" aria-hidden="true"></i>
              <span className="sr-only">{tooltip}</span>
            </span>
          )}
        </div>
        <p className={`mt-0.5 text-xs ${rowDark ? 'text-slate-400' : 'text-slate-600'}`}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
          checked ? 'bg-blue-600' : rowDark ? 'bg-slate-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );

  return (
    <PortalLayout
      user={user}
      userRole={userRole}
      theme={theme}
      onThemeChange={onThemeChange}
      compactMode={compactMode}
      onCompactModeChange={onCompactModeChange}
      onNavigate={onPortalNavigate}
      onOpenProfile={onOpenProfile}
      onLogout={onLogout}
      headerTitle="Profile & settings"
    >
      <div
        className={`mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}
        role="region"
        aria-label="Account profile and settings"
      >
      <main className="w-full">
        <div className="space-y-6">
          {/* Appearance */}
          <section className={sectionCard} aria-labelledby="appearance-heading">
            <div className={`border-b px-5 py-4 ${sectionBorder}`}>
              <h2 id="appearance-heading" className={`text-xs font-black uppercase tracking-[0.2em] ${subheading}`}>
                Appearance
              </h2>
              <p className={`mt-1 text-xs ${mutedText}`}>
                Theme applies across the entire portal for your account on this device.
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-bold ${strongText}`}>Color mode</p>
                  <p className={`text-xs ${mutedText}`}>Switch between light and dark interface.</p>
                </div>
                <div className={`flex rounded-xl border p-1 ${appearanceRail}`}>
                  <button
                    type="button"
                    onClick={() => persistTheme('light')}
                    className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                      theme === 'light' ? 'bg-blue-600 text-white shadow' : appearanceInactive
                    }`}
                  >
                    <i className="fas fa-sun mr-2" aria-hidden="true"></i>
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => persistTheme('dark')}
                    className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                      theme === 'dark' ? 'bg-blue-600 text-white shadow' : appearanceInactive
                    }`}
                  >
                    <i className="fas fa-moon mr-2" aria-hidden="true"></i>
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Personal information */}
          <section className={sectionCard} aria-labelledby="personal-heading">
            <div className={`border-b px-5 py-4 ${sectionBorder}`}>
              <h2 id="personal-heading" className={`text-xs font-black uppercase tracking-[0.2em] ${subheading}`}>
                Personal information
              </h2>
              <p className={`mt-1 text-xs ${mutedText}`}>Update your directory details. Email must be valid; phone uses 10–15 digits.</p>
            </div>
            <form onSubmit={savePersonal} className="space-y-4 px-5 py-5">
              <div>
                <label className={labelClass} htmlFor="profile-fullname">
                  Full name
                </label>
                <input
                  id="profile-fullname"
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="profile-email">
                  Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  className={`${inputClass} ${fieldErrors.email ? 'border-red-500' : ''}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {fieldErrors.email && <p className="mt-1 text-xs font-bold text-red-400">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor="profile-phone">
                  Phone
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  className={`${inputClass} ${fieldErrors.phone ? 'border-red-500' : ''}`}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((f) => ({ ...f, phone: undefined }));
                  }}
                  placeholder="+63 9XX XXX XXXX"
                  autoComplete="tel"
                />
                {fieldErrors.phone && <p className="mt-1 text-xs font-bold text-red-400">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor="profile-role">
                  Role
                </label>
                <input id="profile-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="profile-dept">
                  Department
                </label>
                <input
                  id="profile-dept"
                  className={inputClass}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Field Operations"
                />
              </div>
              {saveMsg === 'ok' && (
                <p className={`text-center text-xs font-black uppercase tracking-widest ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  Changes saved
                </p>
              )}
              {saveMsg === 'err' && fieldErrors.email && (
                <p className="text-center text-xs font-black uppercase tracking-widest text-red-400">Fix errors to save</p>
              )}
              <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
                <i className="fas fa-floppy-disk" aria-hidden="true"></i>
                Save changes
              </button>
            </form>
          </section>

          {/* Account & security */}
          <section className={sectionCard} aria-labelledby="security-heading">
            <div className={`border-b px-5 py-4 ${sectionBorder}`}>
              <h2 id="security-heading" className={`text-xs font-black uppercase tracking-[0.2em] ${subheading}`}>
                Account &amp; security
              </h2>
              <p className={`mt-1 text-xs ${mutedText}`}>
                Password changes are processed securely. Two-factor and sessions are shown for your review.
              </p>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-bold ${strongText}`}>Password</p>
                  <p className={`text-xs ${mutedText}`}>Managed by the authentication service. Request a change when needed.</p>
                </div>
                <button type="button" className={btnPrimary} onClick={() => setShowPasswordModal(true)}>
                  <i className="fas fa-key" aria-hidden="true"></i>
                  Change password
                </button>
              </div>

              <ToggleRow
                id="toggle-2fa"
                title="Two-factor authentication"
                description="Require a second step at sign-in when your organization enforces it."
                checked={twoFactor}
                onChange={handleTwoFactor}
                tooltip="When enabled, your account will expect a second factor at login once the backend supports it."
                isDark={isDark}
              />

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${mutedText}`}>Login activity</h3>
                  <span title="Recent sign-ins as reported by the server (read-only)." className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                    <i className="fas fa-circle-info text-xs"></i>
                  </span>
                </div>
                <div className={`overflow-x-auto rounded-xl border ${tableWrap}`}>
                  <table className="w-full min-w-[280px] text-left text-xs">
                    <thead className={`text-[9px] font-black uppercase tracking-widest ${tableHead}`}>
                      <tr>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Event</th>
                        <th className="hidden sm:table-cell px-3 py-2">IP</th>
                        <th className="hidden md:table-cell px-3 py-2">Client</th>
                      </tr>
                    </thead>
                    <tbody className={tableBody}>
                      {loginActivity.map((row) => (
                        <tr key={row.id} className={tableRowText}>
                          <td className={`whitespace-nowrap px-3 py-2 font-mono text-[10px] ${tableCellMuted}`}>
                            {new Date(row.at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-bold">{row.summary}</td>
                          <td className={`hidden sm:table-cell px-3 py-2 font-mono ${mutedText}`}>{row.ip}</td>
                          <td className={`hidden md:table-cell px-3 py-2 ${mutedText}`}>{row.client}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${mutedText}`}>Active sessions</h3>
                  <span
                    title="Devices currently signed in. End sessions you do not recognize from the admin console."
                    className={isDark ? 'text-slate-500' : 'text-slate-400'}
                  >
                    <i className="fas fa-circle-info text-xs"></i>
                  </span>
                </div>
                <ul className="space-y-2">
                  {sessions.map((s) => {
                    const isCurrent = s.id === currentSessionId;
                    return (
                      <li
                        key={s.id}
                        className={`flex flex-col gap-1 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                          isCurrent ? sessionCurrentBg : sessionOther
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${strongText}`}>
                            {s.deviceLabel}
                            {isCurrent && (
                              <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                This device
                              </span>
                            )}
                          </p>
                          <p className={`text-xs ${mutedText}`}>{s.browser}</p>
                        </div>
                        <p className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {formatSessionStatus(s.lastActive)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className={sectionCard} aria-labelledby="notif-heading">
            <div className={`border-b px-5 py-4 ${sectionBorder}`}>
              <h2 id="notif-heading" className={`text-xs font-black uppercase tracking-[0.2em] ${subheading}`}>
                Notification preferences
              </h2>
              <p className={`mt-1 text-xs font-medium ${mutedText}`}>Choose which notifications you receive.</p>
              <p className={`mt-1 text-xs ${mutedText}`}>
                Toggles save immediately. Defaults are on for all channels.
              </p>
            </div>
            <div className="px-5 py-2">
              <ToggleRow
                id="notif-email"
                title="Email notifications"
                description="Receive updates and alerts via email."
                checked={notif.email}
                onChange={(v) => handleNotifToggle('email', v)}
                tooltip="Includes project updates and operational alerts."
                isDark={isDark}
              />
              {userRole === 'TECHNICIAN' && (
                <>
                  <ToggleRow
                    id="notif-new-projects"
                    title="New Projects"
                    description="Get notified when new projects are assigned to you."
                    checked={notif.newProjects}
                    onChange={(v) => handleNotifToggle('newProjects', v)}
                    tooltip="Assignment alerts for projects you are added to."
                    isDark={isDark}
                  />
                  <ToggleRow
                    id="notif-finalization-updates"
                    title="Finalization Updates"
                    description="Get notified when Sales or Admin approves or rejects your submitted project."
                    checked={notif.finalizationUpdates}
                    onChange={(v) => handleNotifToggle('finalizationUpdates', v)}
                    tooltip="Final outcome alerts for projects you work on."
                    isDark={isDark}
                  />
                </>
              )}
              {userRole === 'ADMIN' && (
                <>
                  <ToggleRow
                    id="notif-finalization-requests"
                    title="Finalization Requests"
                    description="Receive alerts when a project is ready for finalizing."
                    checked={notif.approvalRequests}
                    onChange={(v) => handleNotifToggle('approvalRequests', v)}
                    tooltip="When technicians submit work for review (Pending Review)."
                    isDark={isDark}
                  />
                  <ToggleRow
                    id="notif-technician-responses"
                    title="Technician Responses"
                    description="Receive alerts when a technician accepts or rejects an assigned project."
                    checked={notif.technicianResponses}
                    onChange={(v) => handleNotifToggle('technicianResponses', v)}
                    tooltip="Accept/decline activity on project assignments."
                    isDark={isDark}
                  />
                </>
              )}
              <ToggleRow
                id="notif-security"
                title="Security alerts"
                description="Important security and login notifications."
                checked={notif.security}
                onChange={(v) => handleNotifToggle('security', v)}
                isDark={isDark}
              />
            </div>
          </section>

          <p className={`pb-8 text-center text-[9px] font-bold uppercase tracking-widest ${footerMuted}`}>
            AA2000 Security &amp; Technology Solutions
          </p>
        </div>
      </main>

      {showPasswordModal && (
        <div className="fixed inset-0 z-[960] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div
            className="my-auto w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-modal-title"
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <h3 id="pw-modal-title" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-100">
                <i className="fas fa-key text-amber-400" aria-hidden="true"></i>
                Change password
              </h3>
              <button
                type="button"
                onClick={() => { setShowPasswordModal(false); setPwError(''); }}
                className="text-slate-400 transition hover:text-white"
                aria-label="Close"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 px-5 py-5">
              {pwError && (
                <div className="rounded-xl border border-red-500/50 bg-red-950/40 px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-red-300">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="rounded-xl border border-green-500/50 bg-green-950/40 px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-green-300">
                  Password updated
                </div>
              )}
              <div>
                <label className={labelClass}>Current password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={passwords.original}
                  onChange={(e) => setPasswords({ ...passwords, original: e.target.value })}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className={labelClass}>New password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={labelClass}>Confirm new password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className={`${btnSecondary} flex-1`} onClick={() => { setShowPasswordModal(false); setPwError(''); }}>
                  Cancel
                </button>
                <button type="submit" disabled={pwSuccess} className={`${btnPrimary} flex-1`}>
                  Update password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PortalLayout>
  );
};

export default Profile;
export { THEME_KEY, COMPACT_MODE_KEY };
