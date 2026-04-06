import React, { useEffect, useState } from 'react';
import SurveySummary from './15_SurveySummary';
import { User, SurveyType } from '../types';
import type { ThemeMode } from './18_Profile';
import PortalLayout, { PortalNavKey } from './19_PortalLayout';
import { downloadFinalizedReportPdf } from '../utils/finalizedReportPdf';

interface Props {
  user: User | null;
  userRole: 'TECHNICIAN' | 'ADMIN' | null;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  compactMode: boolean;
  onCompactModeChange: (compact: boolean) => void;
  onPortalNavigate: (key: PortalNavKey) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onBack: () => void;
  onViewProject: (project: any) => void;
  onEditProject: (project: any, index: number) => void;
  onEditAuditFromList?: (projectRecord: any, index: number, surveyType: SurveyType) => void;
  onGoToDashboardSection?: (section: 'ONGOING' | 'UPCOMING' | 'HISTORY') => void;
}

/**
 * CURRENT PROJECTS COMPONENT
 * Purpose: A searchable archive of all finalized survey reports stored on the device.
 * Logic: Fetches data from localStorage and implements a manual coordinate-based PDF export.
 */
const CurrentProjects: React.FC<Props> = ({
  user,
  userRole,
  theme,
  onThemeChange,
  compactMode,
  onCompactModeChange,
  onPortalNavigate,
  onOpenProfile,
  onLogout,
  onBack,
  onEditAuditFromList,
}) => {
  // --- COMPONENT STATE ---
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sending, setSending] = useState(false); // Controls PDF generation loading state
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  /**
   * startVoiceInput: Standardized voice-to-text input handler for search filters.
   */
  // Added missing startVoiceInput function to handle speech recognition in the search field
  const startVoiceInput = (field: string, setter: (val: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setActiveVoiceField(field);
    };

    recognition.onend = () => {
      setActiveVoiceField(null);
    };

    recognition.onerror = () => {
      setActiveVoiceField(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setter(transcript);
    };

    recognition.start();
  };

  /**
   * loadProjects: Retrieves raw project data from localStorage.
   * Logic: Reverses the list to ensure the newest audits appear at the top.
   */
  const loadProjects = () => {
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      setProjects([...parsed].reverse());
    } else {
      setProjects([]);
    }
  };

  /**
   * handleToggleStatus: Switches the project's 'status' field (Completed vs In Progress).
   * Input: Unique timestamp ID.
   * Logic: Modifies the relevant record in the persistent storage array.
   */
  const handleToggleStatus = (e: React.MouseEvent, itemTimestamp: string) => {
    e.stopPropagation(); // Prevent opening the report when just toggling status
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      const actualIndexInParsed = parsed.findIndex((p: any) => p.timestamp === itemTimestamp);
      if (actualIndexInParsed !== -1) {
        const currentStatus = parsed[actualIndexInParsed].project.status || 'Completed';
        parsed[actualIndexInParsed].project.status = currentStatus === 'Completed' ? 'In Progress' : 'Completed';
        localStorage.setItem('aa2000_saved_projects', JSON.stringify(parsed));
        loadProjects();
      }
    }
  };

  /**
   * handleDownloadPDF: The jsPDF coordinate-based drawing engine.
   * Purpose: Converts technical audit JSON data into a human-readable professional document.
   * Logic: Manually tracks the 'currentY' vertical cursor to handle page breaks and table layouts.
   */
  const handleDownloadPDF = async () => {
    if (!selectedProject || sending) return;
    if (selectedProject.project?.status !== 'Finalized - Approved' && selectedProject.project?.status !== 'Finalized') return;
    setSending(true);

    try {
      downloadFinalizedReportPdf(selectedProject);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const surveyTypeToKey: Record<SurveyType, string> = {
    [SurveyType.CCTV]: 'cctvData',
    [SurveyType.FIRE_ALARM]: 'faData',
    [SurveyType.FIRE_PROTECTION]: 'fpData',
    [SurveyType.ACCESS_CONTROL]: 'acData',
    [SurveyType.BURGLAR_ALARM]: 'baData',
    [SurveyType.OTHER]: 'otherData',
  };

  /**
   * handleDeleteSurvey: Removes a survey type from the currently viewed project and persists to localStorage.
   */
  const handleDeleteSurvey = (surveyType: SurveyType) => {
    if (!selectedProject) return;
    const key = surveyTypeToKey[surveyType];
    const updated = { ...selectedProject, [key]: null };
    const estimations = { ...(selectedProject.estimations || {}) };
    delete estimations[surveyType];
    updated.estimations = Object.keys(estimations).length ? estimations : undefined;
    setSelectedProject(updated);
    // Also update the in-memory projects list so the badges/audit types
    // disappear immediately when returning to the list view.
    setProjects(prev =>
      prev.map(p => (p.timestamp === selectedProject.timestamp ? updated : p))
    );
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      const idx = parsed.findIndex((p: any) => p.timestamp === selectedProject.timestamp);
      if (idx !== -1) {
        parsed[idx] = updated;
        localStorage.setItem('aa2000_saved_projects', JSON.stringify(parsed));
      }
    }
  };

  /**
   * handleDeleteProject: Permanently removes the currently viewed final report
   * from localStorage and from the in-memory projects list.
   */
  const handleDeleteProject = () => {
    if (!selectedProject) return;
    const ts = selectedProject.timestamp;

    // Update in-memory list so the card disappears immediately when returning.
    setProjects(prev => prev.filter(p => p.timestamp !== ts));

    // Persist removal in localStorage.
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      const next = parsed.filter((p: any) => p.timestamp !== ts);
      localStorage.setItem('aa2000_saved_projects', JSON.stringify(next));
    }

    // Close detail view and confirmation modal.
    setShowDeleteProjectConfirm(false);
    setSelectedProject(null);
    setSelectedIndex(null);
  };

  /**
   * openProject: Selects a project record to view in the SurveySummary component.
   */
  const openProject = (proj: any) => {
    const saved = localStorage.getItem('aa2000_saved_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      const actualIndex = parsed.findIndex((p: any) => p.timestamp === proj.timestamp);
      setSelectedProject(proj);
      setSelectedIndex(actualIndex);
    }
  };

  /**
   * filteredProjects: Only finalized reports (approved/rejected), then search.
   */
  const filteredProjects = projects.filter((item) => {
    const status = item.project?.status;
    return status === 'Finalized' || status === 'Finalized - Approved' || status === 'Finalized - Rejected';
  }).filter((item) => {
    const query = searchQuery.toLowerCase();
    const p = item.project;
    const types = [item.cctvData?'cctv':'', item.faData?'fire':'', item.fpData?'fire protection':'', item.acData?'access':'', item.baData?'burglar':'', item.otherData?'other':''].join(' ');
    const dateFormatted = new Date(item.timestamp).toLocaleDateString().toLowerCase();
    return (p.name+p.clientName+p.location+p.technicianName+types+dateFormatted).toLowerCase().includes(query);
  });

  // UI RENDERING - Report Details Overlay
  if (selectedProject) {
    const isOwner = userRole === 'TECHNICIAN' && user?.fullName === selectedProject.project.technicianName;
    // Sales/Admin should not be able to delete final reports from the list view.
    const canDelete = isOwner;
    const isFinalizedApproved = selectedProject.project?.status === 'Finalized - Approved' || selectedProject.project?.status === 'Finalized';
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-fade-in overflow-hidden">
        <header className="relative z-30 flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 bg-[#0a1628] p-4 text-white shadow-lg">
          <button
            type="button"
            onClick={() => { setShowDeleteProjectConfirm(false); setSelectedProject(null); }}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-tight hover:bg-white/10"
          >
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            List
          </button>
          <div className="min-w-0 flex-1 pt-0.5 text-right">
            <h2 className="truncate text-[10px] font-black uppercase tracking-widest text-blue-200/90">Finalized report</h2>
            <p className="truncate text-sm font-bold text-white">{selectedProject.project?.name || 'Project'}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            {canDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteProjectConfirm(true)}
                className="rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black uppercase shadow-md transition hover:bg-red-500 active:scale-95"
              >
                <i className="fas fa-trash mr-1" aria-hidden="true"></i> Delete
              </button>
            )}
            {isFinalizedApproved && userRole === 'ADMIN' && (
              <button
                type="button"
                title="Download finalized project report (PDF)."
                onClick={handleDownloadPDF}
                disabled={sending}
                className={`inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-70 ${sending ? 'cursor-wait' : ''}`}
              >
                {sending ? <i className="fas fa-circle-notch animate-spin" aria-hidden="true"></i> : <i className="fas fa-file-pdf" aria-hidden="true"></i>}
                {sending ? 'Generating…' : 'Download PDF'}
              </button>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <SurveySummary 
            userRole={userRole} 
            project={selectedProject.project} 
            cctvData={selectedProject.cctvData} 
            faData={selectedProject.faData} 
            fpData={selectedProject.fpData}
            acData={selectedProject.acData} 
            baData={selectedProject.baData}
            otherData={selectedProject.otherData} 
            estimations={selectedProject.estimations}
            onDone={() => setSelectedProject(null)} 
            hideDoneButton={true}
            onDeleteSurvey={handleDeleteSurvey}
            onEditAudit={onEditAuditFromList && selectedIndex != null && selectedIndex >= 0 ? (surveyType) => onEditAuditFromList(selectedProject, selectedIndex, surveyType) : undefined}
          />
          {showDeleteProjectConfirm && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowDeleteProjectConfirm(false)}>
              <div
                className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-bold text-slate-800 text-center">
                  Are you sure you want to permanently delete this final report?
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDeleteProject}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteProjectConfirm(false)}
                    className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl text-[10px] uppercase tracking-wider"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // UI RENDERING - Project List Home
  return (
    <PortalLayout
      user={user!}
      userRole={userRole}
      theme={theme}
      onThemeChange={onThemeChange}
      compactMode={compactMode}
      onCompactModeChange={onCompactModeChange}
      activeNav="finalized"
      onNavigate={onPortalNavigate}
      onOpenProfile={onOpenProfile}
      onLogout={onLogout}
      headerTitle="Finalized reports"
    >
      <div className="flex min-h-full flex-col overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
        <button
          type="button"
          onClick={onBack}
          className="touch-target flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Back to dashboard"
        >
          <i className="fas fa-arrow-left text-lg" aria-hidden="true"></i>
        </button>
        <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 md:text-base">Finalized reports</h2>
      </div>

      {/* Search Interaction Layer */}
      <div className="z-10 shrink-0 border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 md:px-6">
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input type="text"  className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003399] transition shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button type="button" onClick={() => startVoiceInput('search', setSearchQuery)} className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'search' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-[#003399]'}`}><i className="fas fa-microphone"></i></button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto bg-slate-50/30 p-4 [grid-auto-rows:minmax(140px,1fr)] dark:bg-slate-950 md:grid-cols-2 md:p-8 lg:grid-cols-3">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-300 space-y-4 pt-10">
            <i className="fas fa-search text-5xl opacity-20"></i>
            <p className="font-bold uppercase tracking-widest text-[10px]">No reports yet</p>
          </div>
        ) : (
          filteredProjects.map((item) => {
            const isCompleted = item.project.status === 'Completed';
            const isOwner = userRole === 'TECHNICIAN' && user?.fullName === item.project.technicianName;
            const surveyTags = [
              item.cctvData && { label: 'CCTV', className: 'text-[10px] bg-[#003399] text-white px-3.5 py-2 rounded-full font-black uppercase' },
              item.faData && { label: 'FIRE', className: 'text-[10px] bg-[#ED3237] text-white px-3.5 py-2 rounded-full font-black uppercase' },
              item.fpData && { label: 'FIRE PRO', className: 'text-[10px] bg-red-800 text-white px-3.5 py-2 rounded-full font-black uppercase' },
              item.acData && { label: 'ACCESS', className: 'text-[10px] bg-amber-500 text-blue-900 px-3.5 py-2 rounded-full font-black uppercase' },
              item.baData && { label: 'BURGLAR', className: 'text-[10px] bg-blue-700 text-white px-3.5 py-2 rounded-full font-black uppercase' },
              item.otherData && { label: 'OTHER', className: 'text-[10px] bg-slate-500 text-white px-3.5 py-2 rounded-full font-black uppercase' },
            ].filter(Boolean) as { label: string; className: string }[];
            const count = surveyTags.length;
            const gridCols = count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 2;
            return (
              <div key={item.timestamp} className="relative animate-fade-in h-full min-h-[140px]">
                <div 
                  onClick={() => openProject(item)} 
                  className={`h-full min-h-[140px] w-full text-left p-3 border-[1.5px] rounded-3xl hover:border-[#003399] transition shadow-[0_5px_15px_-5px_rgba(0,51,153,0.08)] group active:scale-[0.98] cursor-pointer flex flex-col ${isCompleted ? 'bg-[#E2FBEB] dark:bg-emerald-950/40 border-[#1E834F]/30' : 'bg-white dark:bg-slate-900 border-[#003399]/20 dark:border-slate-600'}`}
                >
                  <div className="flex justify-between items-start mb-1.5 mt-1.5 shrink-0">
                    <h3 className="text-lg font-bold text-[#003399] uppercase leading-none tracking-tighter truncate ml-1">{item.project.name}</h3>
                    <button 
                      onClick={(e) => { if (!isOwner) return; handleToggleStatus(e, item.timestamp); }} 
                      className={`text-[10px] px-3.5 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-sm transition-all shrink-0 ${isCompleted ? 'bg-[#E2FBEB] text-[#1E834F]' : 'bg-[#FFF9F2] text-[#9A3412]'}`}
                    >
                      {isCompleted ? 'COMPLETED' : 'ONGOING'}
                    </button>
                  </div>
                  <div className="space-y-1.5 mb-1.5 shrink-0 ml-3 mt-1">
                    <div className="flex items-center text-slate-500">
                      <i className="fas fa-user text-[#4CA9FF] text-[10px] w-4"></i>
                      <p className="text-[11px] font-medium uppercase tracking-widest ml-2 truncate">{item.project.clientName}</p>
                    </div>
                    <div className="flex items-center text-slate-500">
                      <i className="fas fa-map-marker-alt text-[#4CA9FF] text-[10px] w-4"></i>
                      <p className="text-[11px] font-medium uppercase tracking-widest ml-2 truncate">{item.project.locationName || item.project.location || '—'}</p>
                    </div>
                    <div className="flex items-center text-slate-400">
                      <i className="fas fa-calendar text-[#4CA9FF] text-[10px] w-4"></i>
                      <p className="text-[11px] font-medium ml-2">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center text-slate-500">
                      <i className="fas fa-user-cog text-[#4CA9FF] text-[10px] w-4"></i>
                      <p className="text-[11px] font-medium uppercase tracking-widest ml-2 truncate">{item.project.technicianName || '—'}</p>
                    </div>
                  </div>
                  <div
                    className={`mt-auto w-full grid gap-1.5 ${gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                  >
                    {surveyTags.map((tag) => (
                      <span key={tag.label} className={`min-w-0 text-center ${tag.className}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </PortalLayout>
  );
};

export default CurrentProjects;
