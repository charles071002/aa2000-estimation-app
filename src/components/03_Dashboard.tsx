import React, { useState, useRef, useEffect } from 'react';
import { User, Project, SurveyType } from '../types';
import { AA2000_ICON } from '../constants';

interface Props {
  /** The authenticated user's profile information, containing fullName and email. */
  user: User;
  /** The logged-in role for role-specific dashboard behavior. */
  userRole: 'TECHNICIAN' | 'ADMIN' | null;
  /** Logic callback to navigate Sales/Admin into project setup. */
  onCreateProject: () => void;
  /** Logic callback to open an existing project + selected survey for editing. */
  onEditAuditFromList: (projectRecord: any, index: number, surveyType: SurveyType) => void;
  /** Opens report summary for Sales/Admin review. */
  onOpenSummaryFromList: (projectRecord: any, index: number) => void;
  /** Sales/Admin: open the finalized reports archive (/projects). */
  onOpenFinalizedReports: () => void;
  /** Open account profile and settings. */
  onOpenProfile: () => void;
  /** Logic callback to clear the local session and return to role selection. */
  onLogout: () => void;
}

/**
 * DASHBOARD COMPONENT
 * Purpose: This is the central operational hub for technicians. It provides 
 * high-level navigation to the core features of the site survey system.
 */
const Dashboard: React.FC<Props> = ({ user, userRole, onCreateProject, onEditAuditFromList, onOpenSummaryFromList, onOpenFinalizedReports, onOpenProfile, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<'ONGOING' | 'UPCOMING' | 'HISTORY'>('ONGOING');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Array<{ record: any; index: number }>>([]);
  const [selectedRecord, setSelectedRecord] = useState<{ record: any; index: number } | null>(null);
  const [editableProject, setEditableProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSystemModal, setShowSystemModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const savedRaw = localStorage.getItem('aa2000_saved_projects');
    const parsed = savedRaw ? JSON.parse(savedRaw) : [];
    const visible = (userRole === 'ADMIN' ? parsed : parsed
      .map((record: any, index: number) => ({ record, index }))
      .filter((item: { record: any; index: number }) => {
        const project = item.record?.project;
        if (!project) return false;
        const assigned = Array.isArray(project.assignedTechnicians) ? project.assignedTechnicians : [];
        if (!assigned.length) return project.technicianName === user.fullName;
        return assigned.some((t: any) => t.email === user.email || t.fullName === user.fullName);
      }))
      .map((record: any, index: number) => record.record ? record : { record, index });
    setSavedProjects(visible);
  }, [user.email, user.fullName, userRole]);

  const resolveCategory = (project: Project): 'ONGOING' | 'UPCOMING' | 'HISTORY' => {
    if (project.status === 'Finalized') return 'HISTORY';
    if (!project.startDate) return 'ONGOING';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(project.startDate);
    start.setHours(0, 0, 0, 0);
    if (start.getTime() > today.getTime()) return 'UPCOMING';
    return 'ONGOING';
  };

  const filteredProjects = savedProjects.filter(({ record }) => resolveCategory(record.project) === activeSection);

  const getTechnicianResponse = (project: Project): 'ACCEPTED' | 'DECLINED' | null => {
    if (!project.technicianResponses) return null;
    return project.technicianResponses[user.email] || null;
  };

  const openProjectModal = (record: any, index: number) => {
    setSelectedRecord({ record, index });
    setEditableProject({ ...record.project });
    setShowProjectModal(true);
  };

  const handleTechnicianResponse = (index: number, response: 'ACCEPTED' | 'DECLINED') => {
    const raw = localStorage.getItem('aa2000_saved_projects');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!parsed[index]?.project) return;
    const project = parsed[index].project;
    if (project.technicianResponses?.[user.email]) return;
    const nextResponses = { ...(project.technicianResponses || {}), [user.email]: response };
    parsed[index] = {
      ...parsed[index],
      project: { ...project, technicianResponses: nextResponses },
    };
    localStorage.setItem('aa2000_saved_projects', JSON.stringify(parsed));
    setSavedProjects((prev) => prev.map((item) => item.index === index
      ? { ...item, record: { ...item.record, project: { ...item.record.project, technicianResponses: nextResponses } } }
      : item
    ));
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setShowSystemModal(false);
    setSelectedRecord(null);
    setEditableProject(null);
  };

  const updateProjectStatus = (index: number, status: Project['status']) => {
    const raw = localStorage.getItem('aa2000_saved_projects');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!parsed[index]?.project) return;
    parsed[index] = {
      ...parsed[index],
      project: { ...parsed[index].project, status },
    };
    localStorage.setItem('aa2000_saved_projects', JSON.stringify(parsed));
    setSavedProjects((prev) =>
      prev.map((item) =>
        item.index === index
          ? { ...item, record: { ...item.record, project: { ...item.record.project, status } } }
          : item
      )
    );
  };

  const proceedToSurvey = (type: SurveyType) => {
    if (!selectedRecord || !editableProject) return;
    onEditAuditFromList(selectedRecord.record, selectedRecord.index, type);
    closeProjectModal();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden scrollbar-hide" role="region" aria-label="Technician Dashboard">
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
            Welcome, {userRole === 'ADMIN' ? 'SALE & ADMIN' : 'Developer'}
          </div>
        </div>

        {/* Settings dropdown */}
        <div className="relative z-[110]" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/15 rounded-full active:scale-95 transition touch-target border border-white/20"
            aria-label="Open account menu"
            aria-haspopup="true"
            aria-expanded={showMenu}
          >
            <i className={`fas ${showMenu ? 'fa-times' : 'fa-user-cog'} text-lg`}></i>
          </button>

          {showMenu && (
            <div
              className="absolute right-0 mt-3 w-56 bg-[#003399] text-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] border border-white/20 overflow-hidden z-[110] animate-fade-in origin-top-right"
              role="menu"
            >
              <button
                role="menuitem"
                type="button"
                title="Manage account settings, appearance, security, and notifications"
                onClick={() => { setShowMenu(false); onOpenProfile(); }}
                className="w-full px-5 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/15 flex items-center gap-3 transition-colors"
              >
                <i className="fas fa-id-card text-white/80" aria-hidden="true"></i>
                Profile &amp; settings
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
          className={`fixed md:static top-14 md:top-0 left-0 z-[901] h-[calc(100%-56px)] w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-4 md:p-5 transition-transform duration-300 ease-in-out overflow-y-auto md:translate-x-0
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-label="Dashboard sidebar navigation"
        >
          <div className="flex flex-col h-full">
            <nav className="flex-1 flex flex-col gap-2 pt-2" aria-label="Dashboard sections">
              <button
                type="button"
                onClick={() => { onOpenProfile(); setMobileSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition text-blue-900 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <i className="fas fa-user-cog text-blue-900/70 dark:text-blue-400/80" aria-hidden="true"></i>
                Profile &amp; settings
              </button>
              {userRole === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => { onCreateProject(); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition text-blue-900 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <i className="fas fa-plus-circle text-blue-900/70 dark:text-blue-400/80" aria-hidden="true"></i>
                  Create Project
                </button>
              )}

              {userRole === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => { onOpenFinalizedReports(); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition text-blue-900 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <i className="fas fa-file-contract text-blue-900/70 dark:text-blue-400/80" aria-hidden="true"></i>
                  Finalized Reports
                </button>
              )}

              <button
                type="button"
                onClick={() => { setActiveSection('ONGOING'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition
                  ${activeSection === 'ONGOING' ? 'bg-blue-900 text-white shadow-sm' : 'text-blue-900 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                aria-current={activeSection === 'ONGOING' ? 'page' : undefined}
              >
                <i className={`fas fa-circle ${activeSection === 'ONGOING' ? 'text-blue-300' : 'text-blue-900/70 dark:text-blue-400/70'}`} aria-hidden="true"></i>
                Ongoing
              </button>

              <button
                type="button"
                onClick={() => { setActiveSection('UPCOMING'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition
                  ${activeSection === 'UPCOMING' ? 'bg-blue-900 text-white shadow-sm' : 'text-blue-900 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                aria-current={activeSection === 'UPCOMING' ? 'page' : undefined}
              >
                <i className={`fas fa-clock ${activeSection === 'UPCOMING' ? 'text-blue-300' : 'text-blue-900/70 dark:text-blue-400/70'}`} aria-hidden="true"></i>
                Upcoming
              </button>

              <button
                type="button"
                onClick={() => { setActiveSection('HISTORY'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-black uppercase tracking-widest transition
                  ${activeSection === 'HISTORY' ? 'bg-blue-900 text-white shadow-sm' : 'text-blue-900 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                aria-current={activeSection === 'HISTORY' ? 'page' : undefined}
              >
                <i className={`fas fa-history ${activeSection === 'HISTORY' ? 'text-blue-300' : 'text-blue-900/70 dark:text-blue-400/70'}`} aria-hidden="true"></i>
                History
              </button>
            </nav>

            {/* Logout pinned to bottom */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
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
        <main className="flex-1 min-h-0 overflow-y-auto px-6 md:px-12 py-6 md:py-10 dark:bg-slate-950">
          <div className="max-w-4xl mx-auto w-full">
            <div className="space-y-2 pb-4">
              <h1 className="text-2xl md:text-4xl font-black text-blue-900 dark:text-blue-400">
                {activeSection === 'ONGOING' ? 'Ongoing' : activeSection === 'UPCOMING' ? 'Upcoming' : 'History'}
              </h1>
            </div>

            <div className="space-y-3">
              {filteredProjects.length === 0 && (
                <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">No projects in this category</p>
                </div>
              )}
              {filteredProjects.map(({ record, index }) => {
                const project = record.project as Project;
                const assignedCount = project.assignedTechnicians?.length || project.requiredTechnicians || 0;
                const myResponse = getTechnicianResponse(project);
                const isTechnicianHistory = userRole === 'TECHNICIAN' && activeSection === 'HISTORY';
                return (
                  <div
                    key={`${project.id}-${index}`}
                    className={`w-full p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-left ${isTechnicianHistory ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors' : ''}`}
                    role={isTechnicianHistory ? 'button' : undefined}
                    tabIndex={isTechnicianHistory ? 0 : undefined}
                    onClick={isTechnicianHistory ? () => onOpenSummaryFromList(record, index) : undefined}
                    onKeyDown={isTechnicianHistory ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenSummaryFromList(record, index);
                      }
                    } : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black text-blue-900 dark:text-blue-400 uppercase">{project.name || 'Untitled Project'}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{project.clientName || 'No client'} · {project.locationName || project.location || 'No location'}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300">
                        {activeSection}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-2">
                        <p className="text-slate-400 font-black uppercase">Date</p>
                        <p className="text-slate-700 dark:text-slate-200 font-bold mt-0.5">{project.startDate || '—'}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-2 col-span-2 md:col-span-1">
                        <p className="text-slate-400 font-black uppercase">Technicians</p>
                        <p className="text-slate-700 dark:text-slate-200 font-bold mt-0.5">{assignedCount}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-2 col-span-2 md:col-span-1">
                        <p className="text-slate-400 font-black uppercase">Status</p>
                        <p className="text-slate-700 dark:text-slate-200 font-bold mt-0.5">{project.status || 'In Progress'}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-2 col-span-2 md:col-span-1">
                        <p className="text-slate-400 font-black uppercase">Assigned</p>
                        <p className="text-slate-700 dark:text-slate-200 font-bold mt-0.5">{(project.assignedTechnicians || []).map((t) => t.fullName).join(', ') || '—'}</p>
                      </div>
                    </div>

                    {userRole === 'TECHNICIAN' && activeSection !== 'HISTORY' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={myResponse != null}
                          onClick={() => handleTechnicianResponse(index, 'ACCEPTED')}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${myResponse === 'ACCEPTED' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'} ${myResponse != null ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={myResponse != null}
                          onClick={() => handleTechnicianResponse(index, 'DECLINED')}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${myResponse === 'DECLINED' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'} ${myResponse != null ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={myResponse !== 'ACCEPTED'}
                          onClick={() => openProjectModal(record, index)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${myResponse === 'ACCEPTED' ? 'bg-blue-900 text-white hover:bg-blue-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                        >
                          Start Audit
                        </button>
                      </div>
                    )}

                    {userRole === 'ADMIN' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(project.assignedTechnicians || []).map((tech) => {
                          const res = project.technicianResponses?.[tech.email];
                          return (
                            <span
                              key={tech.email}
                              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${res === 'ACCEPTED' ? 'bg-green-50 text-green-700' : res === 'DECLINED' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}`}
                            >
                              {tech.fullName}: {res || 'Pending'}
                            </span>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => onOpenSummaryFromList(record, index)}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition bg-blue-900 text-white hover:bg-blue-800"
                        >
                          Review Summary
                        </button>
                        {project.status === 'Pending Review' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateProjectStatus(index, 'Finalized')}
                              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition bg-green-600 text-white hover:bg-green-500"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateProjectStatus(index, 'Rejected')}
                              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition bg-red-600 text-white hover:bg-red-500"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <footer className="pt-8 md:pt-10 text-center text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest shrink-0">
              AA2000 SURVEY PROFESSIONAL
            </footer>
          </div>
        </main>
      </div>

      {userRole === 'TECHNICIAN' && showProjectModal && editableProject && (
        <div className="fixed inset-0 md:inset-y-0 md:left-72 md:right-0 z-[300] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="bg-white w-full max-w-sm md:max-w-4xl md:max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 md:p-8 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs md:text-sm">Project Details</h3>
              <button onClick={closeProjectModal} className="text-slate-400 hover:text-blue-900 transition touch-target" aria-label="Close modal">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto max-h-[70vh] md:max-h-[65vh]">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Project Name</label>
                <div className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs">{editableProject.name || '—'}</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Client Name</label>
                <div className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs">{editableProject.clientName || '—'}</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Project Location</label>
                <div className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs">{editableProject.locationName || editableProject.location || '—'}</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Date</label>
                <div className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs">{editableProject.startDate || '—'}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Assigned Technicians</label>
                <div className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl text-slate-900 font-bold text-xs">{(editableProject.assignedTechnicians || []).map((t) => t.fullName).join(', ') || '—'}</div>
              </div>
            </div>

            <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex flex-col md:flex-row gap-2">
              <button onClick={() => setShowSystemModal(true)} className="w-full md:flex-1 py-3 rounded-xl bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition">
                Select Survey System
              </button>
            </div>
          </div>
        </div>
      )}

      {userRole === 'TECHNICIAN' && showProjectModal && showSystemModal && (
        <div className="fixed inset-0 md:inset-y-0 md:left-72 md:right-0 z-[400] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 md:p-8 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-white w-full max-w-sm md:max-w-4xl md:max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 md:p-8 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 id="modal-title" className="font-black uppercase tracking-widest text-xs md:text-sm">Choose System to Audit</h3>
              <button onClick={() => setShowSystemModal(false)} className="text-slate-400 hover:text-blue-900 transition touch-target" aria-label="Close modal">
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
                { type: SurveyType.OTHER, label: 'Other', desc: 'Custom Technological Service', icon: 'fa-ellipsis-h' }
              ].map(item => (
                <button
                  key={item.type}
                  onClick={() => proceedToSurvey(item.type)}
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
                onClick={() => setShowSystemModal(false)}
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