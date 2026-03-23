import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { AA2000_LOGO } from '../constants';

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
    <div className="flex flex-col h-full bg-white overflow-y-auto scrollbar-hide" role="region" aria-label="Technician Dashboard">
      {/* 
          DASHBOARD HEADER 
          Purpose: Display brand identity and session management menu.
      */}
      <header className="pt-4 pb-2 px-4 md:pt-8 md:pb-4 md:px-8 bg-white flex flex-col items-center border-b border-slate-100 relative">
        {/* 
            SETTINGS MENU
            Logic: Toggles a dropdown menu with Logout and Change Password options.
            Z-Index: Set to 100 to ensure it is above all page content.
        */}
        <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-[100]" ref={menuRef}>
          <button 
            onClick={() => setShowMenu(!showMenu)} 
            className="w-10 h-10 flex items-center justify-center text-blue-900 bg-slate-100 rounded-full active:scale-95 transition touch-target"
            aria-label="Open settings menu"
            aria-haspopup="true"
            aria-expanded={showMenu}
          >
            <i className={`fas ${showMenu ? 'fa-times' : 'fa-bars'} text-lg`}></i>
          </button>
          
          {showMenu && (
            <div 
              className="absolute right-0 mt-3 w-52 bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-2 border-blue-900 overflow-hidden z-[110] animate-fade-in origin-top-right"
              role="menu"
            >
              <button 
                role="menuitem"
                onClick={() => { setShowMenu(false); setShowPasswordModal(true); }}
                className="w-full px-5 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 flex items-center gap-3 transition-colors"
              >
                <i className="fas fa-key text-blue-900/30"></i>
                Change Password
              </button>
              <div className="border-t border-slate-50"></div>
              <button 
                role="menuitem"
                onClick={() => { setShowMenu(false); onLogout(); }}
                className="w-full px-5 py-4 text-left text-[10px] font-black text-red-600 uppercase tracking-widest hover:bg-red-50 flex items-center gap-3 transition-colors"
              >
                <i className="fas fa-sign-out-alt"></i>
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="scale-150 origin-center" aria-hidden="true">
          {AA2000_LOGO}
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-between pt-2 pb-6 px-6 md:pt-4 md:pb-12 md:px-12">
        <div className="space-y-0.5 text-center pt-4 md:pt-8">
          <h2 className="text-2xl md:text-4xl font-black text-blue-900">Welcome,</h2>
          <p className="text-slate-500 font-bold uppercase tracking-tight break-words text-xs md:text-sm" aria-label={`Logged in as ${user.fullName}`}>{user.fullName}</p>
        </div>

        <nav className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-6 flex-1 items-center py-3 md:py-4" aria-label="Main Navigation">
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
        </nav>

        <footer className="pt-4 pb-6 md:pb-8 text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest shrink-0">
          AA2000 SURVEY PROFESSIONAL
        </footer>
      </main>

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