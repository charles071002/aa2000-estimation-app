import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { AA2000_ICON } from '../constants';

interface Props {
  /** The authenticated user's profile information, containing fullName and email. */
  user: User;
  /** Logic callback to reset survey buffers and navigate to the project initiation form. */
  onNewProject: () => void;
  /** Logic callback to navigate to the historical survey report database. */
  onCurrentProjects: () => void;
  /** Logic callback to clear the local session and return to role selection. */
  onLogout: () => void;
}

/**
 * DASHBOARD COMPONENT
 * Purpose: This is the central operational hub for technicians. It provides 
 * high-level navigation to the core features of the site survey system.
 */
const Dashboard: React.FC<Props> = ({ user, onNewProject, onCurrentProjects, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeSection, setActiveSection] = useState<'ONGOING' | 'UPCOMING' | 'HISTORY'>('ONGOING');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Password change states
  const [passwords, setPasswords] = useState({
    original: '',
    new: '',
    confirm: ''
  });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  /**
   * EFFECT: Outside Click Handler
   * Logic: Closes the dropdown menu if a click occurs outside the menu container.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    
    if (!passwords.original || !passwords.new || !passwords.confirm) {
      setPwError('ALL FIELDS ARE REQUIRED');
      return;
    }
    
    if (passwords.new !== passwords.confirm) {
      setPwError('NEW PASSWORDS DO NOT MATCH');
      return;
    }

    if (passwords.new.length < 6) {
      setPwError('PASSWORD MUST BE AT LEAST 6 CHARACTERS');
      return;
    }

    // Logic: Simulate local update in aa2000_technicians
    const techniciansRaw = localStorage.getItem('aa2000_technicians');
    if (techniciansRaw) {
      const technicians = JSON.parse(techniciansRaw);
      const idx = technicians.findIndex((t: any) => t.email === user.email);
      if (idx !== -1) {
        if (technicians[idx].password !== passwords.original) {
          setPwError('INCORRECT ORIGINAL PASSWORD');
          return;
        }
        technicians[idx].password = passwords.new;
        localStorage.setItem('aa2000_technicians', JSON.stringify(technicians));
        setPwSuccess(true);
        setTimeout(() => {
          setShowPasswordModal(false);
          setPwSuccess(false);
          setPasswords({ original: '', new: '', confirm: '' });
        }, 1500);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden scrollbar-hide" role="region" aria-label="Technician Dashboard">
      {/* Header */}
      <header className="h-14 px-4 md:px-8 bg-[#003399] text-white flex items-center justify-between border-b border-[#002d7a] shadow-sm shrink-0 relative">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/15 rounded-full active:scale-95 transition touch-target border border-white/20"
            aria-label="Open dashboard navigation"
          >
            <i className="fas fa-bars text-lg"></i>
          </button>

          <div
            className="w-10 h-10 overflow-hidden rounded-full flex items-center justify-center"
            aria-hidden="true"
          >
            {AA2000_ICON}
          </div>

          <div className="font-black text-base md:text-lg whitespace-nowrap">Welcome, Developer</div>
        </div>

        {/* Settings dropdown */}
        <div className="relative z-[110]" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/15 rounded-full active:scale-95 transition touch-target border border-white/20"
            aria-label="Open settings menu"
            aria-haspopup="true"
            aria-expanded={showMenu}
          >
            <i className={`fas ${showMenu ? 'fa-times' : 'fa-key'} text-lg`}></i>
          </button>

          {showMenu && (
            <div
              className="absolute right-0 mt-3 w-52 bg-[#003399] text-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] border border-white/20 overflow-hidden z-[110] animate-fade-in origin-top-right"
              role="menu"
            >
              <button
                role="menuitem"
                onClick={() => { setShowMenu(false); setShowPasswordModal(true); }}
                className="w-full px-5 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/15 flex items-center gap-3 transition-colors"
              >
                <i className="fas fa-key text-white/80"></i>
                Change Password
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-[900]"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed md:static top-14 md:top-0 left-0 z-[901] h-[calc(100%-56px)] w-72 bg-white border-r border-slate-100 p-4 md:p-5 transition-transform duration-300 ease-in-out overflow-y-auto md:translate-x-0
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-label="Dashboard sidebar navigation"
        >
          <div className="flex flex-col h-full">
            <nav className="flex-1 flex flex-col gap-2 pt-2" aria-label="Dashboard sections">
              <button
                type="button"
                onClick={() => { setActiveSection('ONGOING'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition
                  ${activeSection === 'ONGOING' ? 'bg-blue-900 text-white shadow-sm' : 'text-blue-900 hover:bg-slate-50'}`}
                aria-current={activeSection === 'ONGOING' ? 'page' : undefined}
              >
                <i className={`fas fa-circle ${activeSection === 'ONGOING' ? 'text-blue-300' : 'text-blue-900/70'}`} aria-hidden="true"></i>
                Ongoing
              </button>

              <button
                type="button"
                onClick={() => { setActiveSection('UPCOMING'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition
                  ${activeSection === 'UPCOMING' ? 'bg-blue-900 text-white shadow-sm' : 'text-blue-900 hover:bg-slate-50'}`}
                aria-current={activeSection === 'UPCOMING' ? 'page' : undefined}
              >
                <i className={`fas fa-clock ${activeSection === 'UPCOMING' ? 'text-blue-300' : 'text-blue-900/70'}`} aria-hidden="true"></i>
                Upcoming
              </button>

              <button
                type="button"
                onClick={() => { setActiveSection('HISTORY'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition
                  ${activeSection === 'HISTORY' ? 'bg-blue-900 text-white shadow-sm' : 'text-blue-900 hover:bg-slate-50'}`}
                aria-current={activeSection === 'HISTORY' ? 'page' : undefined}
              >
                <i className={`fas fa-history ${activeSection === 'HISTORY' ? 'text-blue-300' : 'text-blue-900/70'}`} aria-hidden="true"></i>
                History
              </button>
            </nav>

            {/* Logout pinned to bottom */}
            <div className="pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setMobileSidebarOpen(false); onLogout(); }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg py-3 active:scale-[0.98] transition touch-target uppercase tracking-widest text-[10px]"
                aria-label="Log out"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-y-auto px-6 md:px-12 py-6 md:py-10">
          <div className="max-w-4xl mx-auto w-full">
            <div className="space-y-2 pb-4">
              <h1 className="text-2xl md:text-4xl font-black text-blue-900">
                {activeSection === 'ONGOING' ? 'Ongoing' : activeSection === 'UPCOMING' ? 'Upcoming' : 'History'}
              </h1>
            </div>

            <div className={activeSection === 'ONGOING' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6' : 'grid grid-cols-1 gap-4'}>
              {(activeSection === 'ONGOING' || activeSection === 'UPCOMING') && (
                <button
                  onClick={onNewProject}
                  className="group flex flex-col items-center justify-center p-5 md:p-8 bg-blue-900 rounded-2xl md:rounded-[2.5rem] shadow-xl hover:bg-blue-800 transition-all active:scale-95 text-white w-full"
                  aria-label="Start a new site survey project"
                >
                  <div className="w-9 h-9 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center mb-1.5 md:mb-2 group-hover:scale-110 transition" aria-hidden="true">
                    <i className="fas fa-plus text-lg md:text-2xl"></i>
                  </div>
                  <span className="text-sm md:text-base font-black tracking-tight uppercase">Create New Project</span>
                  <span className="text-blue-300 text-[9px] md:text-[10px] mt-0.5 uppercase tracking-wider">Start a fresh site survey</span>
                </button>
              )}

              {(activeSection === 'ONGOING' || activeSection === 'HISTORY') && (
                <button
                  onClick={onCurrentProjects}
                  className="group flex flex-col items-center justify-center p-5 md:p-8 bg-white border-2 border-blue-900 rounded-2xl md:rounded-[2.5rem] shadow-lg hover:bg-blue-50 transition-all active:scale-95 text-blue-900 w-full"
                  aria-label="View previously saved survey reports"
                >
                  <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-900/10 rounded-xl md:rounded-2xl flex items-center justify-center mb-1.5 md:mb-2 group-hover:scale-110 transition" aria-hidden="true">
                    <i className="fas fa-folder-open text-lg md:text-2xl"></i>
                  </div>
                  <span className="text-sm md:text-base font-black tracking-tight uppercase">Current Projects</span>
                  <span className="text-slate-500 text-[9px] md:text-[10px] mt-0.5 uppercase tracking-wider">View finalized survey reports</span>
                </button>
              )}
            </div>

            <footer className="pt-8 md:pt-10 text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest shrink-0">
              AA2000 SURVEY PROFESSIONAL
            </footer>
          </div>
        </main>
      </div>

      {/* 
          CHANGE PASSWORD MODAL
          Purpose: Provides a secure interface for updating technician credentials.
          Behavior: Centers itself on screen, uses dark overlay for focus. Scrollable on small viewports.
      */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-sm max-h-[90vh] min-h-0 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-fade-in scale-up my-auto">
            <header className="p-6 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <i className="fas fa-key text-amber-400"></i>
                <h3 className="font-black uppercase tracking-widest text-xs">Security Settings</h3>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-blue-900 transition touch-target"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </header>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="p-6 pt-0 sm:p-8 sm:pt-4 space-y-5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {pwError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[9px] font-black uppercase text-center tracking-widest animate-shake">
                  {pwError}
                </div>
              )}
              
              {pwSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-[9px] font-black uppercase text-center tracking-widest">
                  PASSWORD UPDATED SUCCESSFULLY
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Original Password</label>
                <input 
                  type="password"
                  required
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-900 transition"
                  value={passwords.original}
                  onChange={(e) => setPasswords({...passwords, original: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <input 
                  type="password"
                  required
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-900 transition"
                  value={passwords.new}
                  onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                <input 
                  type="password"
                  required
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-900 transition"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                />
              </div>
              </div>

              <div className="p-6 pt-0 sm:p-8 sm:pt-0 shrink-0 border-t border-slate-100">
                <button 
                  type="submit"
                  disabled={pwSuccess}
                  className={`w-full py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-[0.2em] text-[10px] ${pwSuccess ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-blue-800'}`}
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default Dashboard;