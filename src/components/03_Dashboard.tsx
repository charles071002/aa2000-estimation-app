import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, SurveyType } from '../types';
import { AA2000_ICON } from '../constants';

interface Props {
  /** The authenticated user's profile information, containing fullName and email. */
  user: User;
<<<<<<< Updated upstream
  /** Active authenticated role to customize dashboard actions. */
  userRole: 'TECHNICIAN' | 'ADMIN' | null;
  /** Logic callback to reset survey buffers and navigate to project initiation. */
=======
  /** Current authenticated role (Technician vs Sales/Admin). */
  userRole: 'TECHNICIAN' | 'ADMIN';
  /** Logic callback to reset survey buffers and navigate to the project initiation form. */
>>>>>>> Stashed changes
  onNewProject: () => void;
  /** Logic callback to navigate to the historical survey report database. */
  onCurrentProjects: () => void;
  /** Logic callback to clear the local session and return to role selection. */
  onLogout: () => void;
  /** Logic callback to load a selected project and open a survey workflow for editing. */
  onEditProjectFromDashboard: (projectRecord: any, index: number, surveyType: SurveyType) => void;
}

/**
 * DASHBOARD COMPONENT
 * Purpose: This is the central operational hub for technicians. It provides 
 * high-level navigation to the core features of the site survey system.
 */
<<<<<<< Updated upstream
const Dashboard: React.FC<Props> = ({ user, userRole, onNewProject, onCurrentProjects, onLogout, onEditProjectFromDashboard }) => {
=======
const Dashboard: React.FC<Props> = ({ user, userRole, onNewProject, onCurrentProjects, onLogout }) => {
>>>>>>> Stashed changes
  const [showMenu, setShowMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeSection, setActiveSection] = useState<'ONGOING' | 'UPCOMING' | 'HISTORY'>('ONGOING');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [projectDetails, setProjectDetails] = useState({
    name: '',
    clientName: '',
    clientEmail: '',
    clientContact: '',
    location: '',
    locationName: '',
    startDate: '',
    endDate: '',
    requiredTechnicians: '',
  });
  const [assignmentMessage, setAssignmentMessage] = useState('');
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

  useEffect(() => {
    const loadProjects = () => {
      const saved = localStorage.getItem('aa2000_saved_projects');
      if (!saved) {
        setSavedProjects([]);
        return;
      }
      const parsed = JSON.parse(saved);
      setSavedProjects(Array.isArray(parsed) ? [...parsed].reverse() : []);
    };
    loadProjects();
    window.addEventListener('focus', loadProjects);
    return () => window.removeEventListener('focus', loadProjects);
  }, []);

  const resolveCategory = (item: any): 'ONGOING' | 'UPCOMING' | 'HISTORY' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = item?.project?.startDate ? new Date(item.project.startDate) : null;
    const status = String(item?.project?.status || '').toLowerCase();
    if (status === 'completed') return 'HISTORY';
    if (start && !Number.isNaN(start.getTime()) && start.getTime() > today.getTime()) {
      return 'UPCOMING';
    }
    return 'ONGOING';
  };

  const sectionProjects = useMemo(
    () => savedProjects.filter((item) => resolveCategory(item) === activeSection),
    [savedProjects, activeSection]
  );

  const openProjectModal = (item: any) => {
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    const actualIndex = parsed.findIndex((p: any) => p.timestamp === item.timestamp);
    if (actualIndex < 0) return;
    const project = item.project || {};
    setSelectedProject(item);
    setSelectedProjectIndex(actualIndex);
    setProjectDetails({
      name: project.name || '',
      clientName: project.clientName || '',
      clientEmail: project.clientEmail || '',
      clientContact: project.clientContact || '',
      location: project.location || '',
      locationName: project.locationName || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      requiredTechnicians: project.requiredTechnicians ? String(project.requiredTechnicians) : '',
    });
    setAssignmentMessage('');
    setShowProjectModal(true);
  };

  const handleSelectSurveyForProject = (type: SurveyType) => {
    if (!selectedProject || selectedProjectIndex === null) return;
    setShowSurveyModal(false);
    setShowProjectModal(false);
    onEditProjectFromDashboard(selectedProject, selectedProjectIndex, type);
  };

  const handleTechnicianResponse = (response: 'ACCEPTED' | 'DECLINED') => {
    if (!selectedProject || selectedProjectIndex === null) return;
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    const current = parsed[selectedProjectIndex];
    if (!current) return;
    const nextProject = {
      ...current.project,
      technicianResponses: {
        ...(current.project?.technicianResponses || {}),
        [user.email]: response,
      },
    };
    parsed[selectedProjectIndex] = { ...current, project: nextProject };
    localStorage.setItem('aa2000_saved_projects', JSON.stringify(parsed));
    setSelectedProject(parsed[selectedProjectIndex]);
    setSavedProjects([...parsed].reverse());
    setAssignmentMessage(response === 'ACCEPTED' ? 'Project accepted.' : 'Project declined.');
  };

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

          <div className="font-black text-base md:text-lg whitespace-nowrap">
            {userRole === 'ADMIN' ? 'SALE & ADMIN' : `Welcome, ${user.fullName || 'Technician'}`}
          </div>
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
              {userRole === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => { setMobileSidebarOpen(false); onNewProject(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition text-blue-900 hover:bg-slate-50 border border-blue-900/15"
                >
                  <i className="fas fa-plus text-blue-900/70" aria-hidden="true"></i>
                  Create Project
                </button>
              )}

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

            <div className="space-y-3">
              {sectionProjects.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <i className="fas fa-folder-open text-3xl text-slate-300 mb-3" aria-hidden="true"></i>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    No projects in this category
                  </p>
                </div>
              ) : (
                sectionProjects.map((item) => (
                  <button
                    key={item.timestamp}
                    type="button"
                    onClick={() => { if (userRole === 'TECHNICIAN') openProjectModal(item); }}
                    className={`w-full text-left rounded-2xl border border-blue-900/15 bg-white transition shadow-sm px-4 py-4 ${userRole === 'TECHNICIAN' ? 'hover:border-blue-900 hover:bg-blue-50/40' : ''}`}
                    aria-label={userRole === 'TECHNICIAN' ? `Open project ${item.project?.name || 'project'}` : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base md:text-lg font-black text-blue-900 uppercase truncate">
                          {item.project?.name || 'Untitled Project'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate mt-1">
                          {item.project?.locationName || item.project?.location || 'No location'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate mt-1">
                          Client: {item.project?.clientName || 'No client'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate mt-1">
                          Date: {item.project?.startDate || item.project?.date || 'N/A'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate mt-1">
                          Assigned Technicians: {(item.project?.assignedTechnicians || []).map((t: any) => t.fullName).join(', ') || 'Unassigned'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] px-2.5 py-1 rounded-full bg-blue-900 text-white font-black uppercase tracking-wider">
                        {resolveCategory(item)}
                      </span>
                    </div>
                    {userRole === 'ADMIN' && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-blue-900/80 font-bold">
                          Accepted: {Object.values(item.project?.technicianResponses || {}).filter((v: any) => v === 'ACCEPTED').length} • Declined: {Object.values(item.project?.technicianResponses || {}).filter((v: any) => v === 'DECLINED').length}
                        </p>
                        {(item.project?.assignedTechnicians || []).map((tech: any) => {
                          const resp = item.project?.technicianResponses?.[tech.email] || 'PENDING';
                          return (
                            <p key={tech.email} className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                              {tech.fullName}: {resp}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </button>
                ))
              )}
              <button
                onClick={onCurrentProjects}
                className="w-full mt-3 group flex items-center justify-center gap-2 p-4 bg-white border-2 border-blue-900 rounded-2xl shadow-lg hover:bg-blue-50 transition-all active:scale-95 text-blue-900"
                aria-label="View finalized survey reports"
              >
                <i className="fas fa-folder-open text-lg" aria-hidden="true"></i>
                <span className="text-xs md:text-sm font-black tracking-tight uppercase">Open Full Project Library</span>
              </button>
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

      {showProjectModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto" onClick={() => { setShowProjectModal(false); setShowSurveyModal(false); }}>
          <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-fade-in scale-up my-auto" onClick={(e) => e.stopPropagation()}>
            <header className="p-6 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs">Project Details</h3>
              <button
                onClick={() => { setShowProjectModal(false); setShowSurveyModal(false); }}
                className="text-slate-400 hover:text-blue-900 transition touch-target"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </header>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Project Name</label>
                  <input
                    disabled
                    className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs"
                    value={projectDetails.name}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Client Name</label>
                  <input
                    disabled
                    className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs"
                    value={projectDetails.clientName}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Project Start Date</label>
                  <input
                    type="date"
                    disabled
                    className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs"
                    value={projectDetails.startDate}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Project Location Name</label>
                <input
                  disabled
                  className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs"
                  value={projectDetails.locationName}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Required Manpower (Technicians)</label>
                <input
                  disabled
                  className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs"
                  value={projectDetails.requiredTechnicians}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Assigned Technicians</label>
                <p className="text-xs font-bold text-slate-700">{(selectedProject?.project?.assignedTechnicians || []).map((t: any) => t.fullName).join(', ') || 'Unassigned'}</p>
              </div>
              {assignmentMessage && <p className="text-[10px] font-black text-blue-900 uppercase tracking-wider">{assignmentMessage}</p>}
            </div>

            <div className="p-6 pt-0 sm:p-8 sm:pt-0 shrink-0 border-t border-slate-100">
              {(() => {
                const currentResponse = selectedProject?.project?.technicianResponses?.[user.email] || 'PENDING';
                const isAssigned = (selectedProject?.project?.assignedTechnicians || []).some((t: any) => t.email === user.email);
                const canBeginAudit = isAssigned && currentResponse === 'ACCEPTED';
                return (
                  <>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">
                      Status: {currentResponse}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleTechnicianResponse('ACCEPTED')}
                        disabled={!isAssigned}
                        className="py-3 rounded-xl bg-green-600 text-white font-black text-[10px] uppercase disabled:opacity-40"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTechnicianResponse('DECLINED')}
                        disabled={!isAssigned}
                        className="py-3 rounded-xl bg-red-600 text-white font-black text-[10px] uppercase disabled:opacity-40"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSurveyModal(true)}
                        disabled={!canBeginAudit}
                        className="py-3 rounded-xl bg-blue-900 text-white font-black text-[10px] uppercase disabled:opacity-40"
                      >
                        Begin Audit
                      </button>
                    </div>
                    {!canBeginAudit && (
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mt-3">
                        Accept project first before starting audit.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showSurveyModal && (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 md:p-8 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title">
          <div className="bg-white w-full max-w-sm md:max-w-4xl md:max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 md:p-8 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 id="dashboard-modal-title" className="font-black uppercase tracking-widest text-xs md:text-sm">Choose System to Audit</h3>
              <button onClick={() => setShowSurveyModal(false)} className="text-slate-400 hover:text-blue-900 transition touch-target" aria-label="Close modal">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-2 gap-3 md:gap-4 overflow-y-auto max-h-[70vh] md:max-h-[65vh]">
              {[
                { type: SurveyType.CCTV, label: 'CCTV System', desc: 'Video Surveillance Audit', icon: 'fa-camera' },
                { type: SurveyType.FIRE_ALARM, label: 'Fire Alarm', desc: 'Safety & Detection Audit', icon: 'fa-fire-extinguisher' },
                { type: SurveyType.FIRE_PROTECTION, label: 'Fire Protection', desc: 'Suppression & Sprinkler Audit', icon: 'fa-shield-heart' },
                { type: SurveyType.ACCESS_CONTROL, label: 'Access Control', desc: 'Entry & Door Security Audit', icon: 'fa-id-card-clip' },
                { type: SurveyType.BURGLAR_ALARM, label: 'Burglar Alarm', desc: 'Intrusion Detection Audit', icon: 'fa-shield-halved' },
                { type: SurveyType.OTHER, label: 'Other', desc: 'Custom Technological Service', icon: 'fa-ellipsis-h' },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleSelectSurveyForProject(item.type)}
                  className="w-full p-5 md:p-6 rounded-2xl flex items-center justify-between border-2 border-blue-900/10 hover:border-blue-900 hover:bg-blue-50 text-blue-900 transition-all active:scale-95 group shadow-sm bg-white"
                >
                  <div className="text-left">
                    <p className="font-black text-lg md:text-xl uppercase leading-none">{item.label}</p>
                    <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-1">{item.desc}</p>
                  </div>
                  <i className={`fas ${item.icon} text-2xl md:text-3xl opacity-10 group-hover:opacity-30 transition-opacity`} aria-hidden="true"></i>
                </button>
              ))}
            </div>
            <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 text-center shrink-0">
              <button
                onClick={() => setShowSurveyModal(false)}
                className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-900 transition py-2 px-4"
              >
                Cancel Selection
              </button>
            </div>
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