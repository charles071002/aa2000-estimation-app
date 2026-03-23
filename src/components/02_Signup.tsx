import React, { useState } from 'react';

interface Props {
  /** Callback to return to the startup screen. */
  onBack: () => void;
  /** Callback to transition the user to the login screen after successful registration. */
  onSignupComplete: () => void;
}

/**
 * SIGNUP COMPONENT
 * Purpose: Allows new technicians to create an account within the local system.
 * Logic: Validates profile requirements and persists new user objects to localStorage.
 */
const Signup: React.FC<Props> = ({ onBack, onSignupComplete }) => {
  // --- FORM DATA STATE ---
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    rePassword: ''
  });
  const [isSuccess, setIsSuccess] = useState(false);

  // --- VALIDATION LOGIC ---
  /** logic: Checks for @gmail.com domain to align with company communication standards. */
  const isEmailValid = formData.email.toLowerCase().endsWith('@gmail.com');
  /** logic: Composite rule for form submission readiness. 
   *  Requirements: Valid Name length, Gmail domain, Min 6-char password, and matching verification.
   */
  const isFormValid = 
    formData.fullName.length > 2 &&
    isEmailValid &&
    formData.password.length >= 6 &&
    formData.password === formData.rePassword;

  /**
   * FUNCTION: handleSubmit
   * Purpose: Finalizes the registration and saves the technician profile.
   * Logic: 
   *   1. Checks for existing accounts to prevent duplicate registration.
   *   2. Appends the new user to the local array.
   *   3. Triggers a success state and automatic redirection.
   */
  const handleSubmit = () => {
    if (isFormValid) {
      const newUser = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password
      };

      let technicians: any[] = [];
      try {
        const techniciansRaw = localStorage.getItem('aa2000_technicians');
        technicians = techniciansRaw ? JSON.parse(techniciansRaw) : [];
      } catch (e) {
        console.warn('Could not read from localStorage', e);
      }
      
      if (technicians.some(t => t.email.toLowerCase() === formData.email.toLowerCase())) {
        alert('An account with this email already exists.');
        return;
      }

      technicians.push(newUser);
      try {
        localStorage.setItem('aa2000_technicians', JSON.stringify(technicians));
        localStorage.setItem('aa2000_last_email', formData.email);
      } catch (e) {
        console.warn('Could not save to localStorage', e);
      }
      
      setIsSuccess(true);
      setTimeout(() => {
        onSignupComplete();
      }, 2000);
    }
  };

  // --- SUCCESS VIEW ---
  if (isSuccess) {
    return (
      <div className="p-8 h-screen flex flex-col items-center justify-center bg-white animate-fade-in text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-6 shadow-lg">
          <i className="fas fa-check text-4xl"></i>
        </div>
        <h2 className="text-2xl font-black text-blue-900 uppercase">Registration Successful</h2>
        <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-xs">Redirecting to login portal...</p>
      </div>
    );
  }

  // --- FORM VIEW ---
  return (
    <div className="p-8 min-h-full h-screen flex flex-col bg-white overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-md mx-auto shrink-0 py-8 md:py-12">
        <button onClick={onBack} className="absolute top-6 left-6 text-blue-900 text-xl" aria-label="Go back">
          <i className="fas fa-chevron-left"></i>
        </button>

        <div className="mb-8">
          <h2 className="text-3xl font-black text-blue-900">TECHNICIAN REGISTRATION</h2>
          <p className="text-slate-500 text-sm">Join the AA2000 Survey Team</p>
        </div>
        
        <div className="space-y-4">
          {/* 
              INPUT: Full Name
              UI Label: "Full Name" represents the technician's identity for report signing.
          */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Full Name</label>
            <input 
              type="text"
              className="w-full bg-slate-50 border-b-2 border-blue-900 p-4 text-slate-900 focus:outline-none focus:bg-white transition font-bold"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            />
          </div>

          {/* 
              INPUT: Gmail Account
              UI Label: "Gmail Account" - company policy restricts logins to Google domains.
              UI Note: "Strictly Gmail accounts only" appears if the domain check fails.
          */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Gmail Account</label>
            <input 
              type="email"
              className={`w-full bg-slate-50 border-b-2 ${formData.email && !isEmailValid ? 'border-red-500' : 'border-blue-900'} p-4 text-slate-900 focus:outline-none focus:bg-white transition font-bold`}
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            {formData.email && !isEmailValid && (
              <p className="text-[10px] text-red-500 mt-1 uppercase font-bold">Strictly Gmail accounts only</p>
            )}
          </div>

          {/* 
              INPUT: Password
              UI Label: "Password" - used to secure the technician's audit history.
          */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
            <input 
              type="password"
              className="w-full bg-slate-50 border-b-2 border-blue-900 p-4 text-slate-900 focus:outline-none focus:bg-white transition font-bold"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {/* 
              INPUT: Re-enter Password
              Purpose: Verification to prevent accidental lockouts due to typos.
          */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Re-enter Password</label>
            <input 
              type="password"
              className={`w-full bg-slate-50 border-b-2 ${formData.rePassword && formData.password !== formData.rePassword ? 'border-red-500' : 'border-blue-900'} p-4 text-slate-900 focus:outline-none focus:bg-white transition font-bold`}
              value={formData.rePassword}
              onChange={(e) => setFormData({...formData, rePassword: e.target.value})}
            />
          </div>

          {/* 
              REGISTER ACTION
              Logic: Executes the handleSubmit function.
              UI Label: "VALIDATE & REGISTER" signals data verification and account creation.
          */}
          <button 
            disabled={!isFormValid}
            onClick={handleSubmit}
            className={`w-full py-4 mt-6 font-black rounded-2xl shadow-xl transition active:scale-95 ${isFormValid ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            VALIDATE & REGISTER
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;