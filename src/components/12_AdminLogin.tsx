import React, { useEffect, useState } from 'react';
import { User } from '../types';

interface Props {
  /** Callback to return to the startup/role selection screen. */
  onBack: () => void;
  /** Callback to pass the successfully authenticated user back to the root application. */
  onLogin: (user: User) => void;
}

/**
 * ADMIN LOGIN COMPONENT
 * Purpose: Provides a secure gateway for Sales & Admin users to access the reports portal.
 * Logic: Matches input credentials against the 'aa2000_technicians' array stored in localStorage.
 */
const AdminLogin: React.FC<Props> = ({ onBack, onLogin }) => {
  // --- UI STATE ---
  const [accountName, setAccountName] = useState(() => {
    try {
      return localStorage.getItem('aa2000_last_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    try {
      const techniciansRaw = localStorage.getItem('aa2000_technicians');
      if (techniciansRaw) {
        const technicians: (User & { password?: string })[] = JSON.parse(techniciansRaw);
        setSuggestions(technicians.map((t) => t.email));
      }
    } catch (e) {
      console.warn('Could not read technicians from localStorage', e);
    }
  }, []);

  const handleLoginAttempt = () => {
    setError('');
    let technicians: (User & { password?: string })[] = [];
    try {
      const techniciansRaw = localStorage.getItem('aa2000_technicians');
      technicians = techniciansRaw ? JSON.parse(techniciansRaw) : [];
    } catch (e) {
      console.warn('Could not read technicians from localStorage', e);
    }

    const foundUser = technicians.find(
      (u) => u.email.toLowerCase() === accountName.toLowerCase() && u.password === password
    );

    if (foundUser) {
      try {
        localStorage.setItem('aa2000_last_email', foundUser.email);
      } catch (e) {
        console.warn('Could not save email to localStorage', e);
      }
      onLogin({ fullName: foundUser.fullName, email: foundUser.email });
    } else {
      setError('Invalid account name or password. Please try again.');
    }
  };

  const handleForgot = () => {
    if (!accountName) {
      setError('Please enter your Account Name first');
      return;
    }
    setMessage(`Temporary password generated for ${accountName}. Check your mail.`);
    setError('');
  };

  return (
    <div className="p-8 min-h-full h-screen flex flex-col animate-fade-in relative bg-white overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-md mx-auto shrink-0 py-8 md:py-12">
        <button onClick={onBack} className="absolute top-6 left-6 text-blue-900 text-xl" aria-label="Go back">
          <i className="fas fa-chevron-left"></i>
        </button>

        <div className="mb-10 text-center mt-8 md:mt-10">
          <h2 className="text-3xl font-black tracking-tight text-blue-900">SALES &amp; ADMIN LOGIN</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">AA2000 Reports Portal</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center justify-center gap-3 animate-shake text-center">
              <i className="fas fa-exclamation-circle text-lg"></i>
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center">
              {message}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Account Name (Email)</label>
            <input
              type="text"
              list="email-suggestions"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 p-4 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 transition font-bold text-left"
              autoComplete="email"
            />
            <datalist id="email-suggestions">
              {suggestions.map((email) => (
                <option key={email} value={email} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 p-4 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 transition font-bold text-left"
              autoComplete="current-password"
            />
          </div>

          <button
            onClick={handleLoginAttempt}
            className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white font-black rounded-xl shadow-xl transition active:scale-[0.98]"
          >
            Log In
          </button>

          <button
            onClick={handleForgot}
            className="w-full text-center text-blue-600 text-sm font-bold hover:text-blue-800 underline underline-offset-4"
          >
            Forgot Password?
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default AdminLogin;

