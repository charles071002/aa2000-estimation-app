import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface Props {
  /** Callback to return to the startup/role selection screen. */
  onBack: () => void;
  /** Callback to pass the successfully authenticated user back to the root application. */
  onLogin: (user: User) => void;
}

/**
 * LOGIN COMPONENT
 * Purpose: Provides a secure gateway for registered technicians to access the portal.
 * Logic: Matches input credentials against the 'aa2000_technicians' array stored in localStorage.
 */
const Login: React.FC<Props> = ({ onBack, onLogin }) => {
  // --- UI STATE ---
  const [accountName, setAccountName] = useState(() => {
    try {
      return localStorage.getItem('aa2000_last_email') || '';
    } catch (e) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  /**
   * EFFECT: Suggestion Loader
   * Logic: Populates the datalist with previously registered emails to speed up the login process on mobile.
   */
  useEffect(() => {
    try {
      const techniciansRaw = localStorage.getItem('aa2000_technicians');
      if (techniciansRaw) {
        const technicians: (User & { password?: string })[] = JSON.parse(techniciansRaw);
        const emails = technicians.map(t => t.email);
        setSuggestions(emails);
      }
    } catch (e) {
      console.warn('Could not read technicians from localStorage', e);
    }
  }, []);

  /**
   * FUNCTION: handleLoginAttempt
   * Purpose: Validates the user's entered credentials.
   * Logic: 
   *   1. Normalizes the account name to lowercase for case-insensitive matching.
   *   2. Searches the local technician database for a match.
   *   3. If found, executes onLogin; otherwise, triggers an error animation and message.
   */
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

  /**
   * FUNCTION: handleForgot
   * Purpose: Provides a fallback for users who cannot remember their credentials.
   * Logic: Simulates a password reset request based on the current text in the Account Name field.
   */
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
        {/* 
            BACK NAVIGATION
            Purpose: Allow user to return to the startup screen.
        */}
        <button onClick={onBack} className="absolute top-6 left-6 text-blue-900 text-xl" aria-label="Go back">
          <i className="fas fa-chevron-left"></i>
        </button>

        {/* 
            PORTAL IDENTITY
            UI Label: "TECHNICIAN LOGIN" identifies this specific login instance for field staff.
        */}
        <div className="mb-10 text-center mt-8 md:mt-10">
          <h2 className="text-3xl font-black tracking-tight text-blue-900">TECHNICIAN LOGIN</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">AA2000 Site Survey Portal</p>
        </div>
        
        <div className="space-y-6">
          {/* Dynamic Error Messaging for Failed Auth */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center justify-center gap-3 animate-shake text-center">
              <i className="fas fa-exclamation-circle text-lg"></i>
              {error}
            </div>
          )}

          {/* Dynamic Success Messaging for Reset Simulation */}
          {message && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center">
              {message}
            </div>
          )}

          {/* 
              INPUT: Account Name
              UI Label: "Account Name (Email)" represents the unique identifier for the technician.
          */}
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

          {/* 
              INPUT: Password
              UI Label: "Password" represents the user's secret key for authentication.
          */}
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

          {/* 
              AUTHENTICATE ACTION
              Logic: Triggers the handleLoginAttempt function.
              UI Label: "AUTHENTICATE" signals the start of the verification process.
          */}
          <button 
            onClick={handleLoginAttempt}
            className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white font-black rounded-xl shadow-xl transition active:scale-[0.98]"
          >
            AUTHENTICATE
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

export default Login;