
import React, { useEffect, useState } from 'react';
import SurveySummary from './15_SurveySummary';
import { User, SurveyType } from '../types';
import { downloadBoqPdf } from './17_BOQ';

interface Props {
  user: User | null;
  userRole: 'TECHNICIAN' | 'ADMIN' | null;
  onBack: () => void;
  onViewProject: (project: any) => void;
  onEditProject: (project: any, index: number) => void;
  onEditAuditFromList?: (projectRecord: any, index: number, surveyType: SurveyType) => void;
}

/**
 * CURRENT PROJECTS COMPONENT
 * Purpose: A searchable archive of all finalized survey reports stored on the device.
 * Logic: Fetches data from localStorage and implements a manual coordinate-based PDF export.
 */
const CurrentProjects: React.FC<Props> = ({ user, userRole, onBack, onEditAuditFromList }) => {
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
    setSending(true);

    try {
      await downloadBoqPdf(selectedProject);
    } catch (error) {
      console.error("DOCX generation failed:", error);
      alert("A critical error occurred while generating the Word document. Please check data quality.");
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
   * filteredProjects: Only finalized reports (status === 'Finalized'), then search.
   */
  const filteredProjects = projects.filter((item) => item.project?.status === 'Finalized').filter((item) => {
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
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-fade-in overflow-hidden">
        <header className="p-4 bg-blue-900 text-white flex items-center justify-between shadow-lg shrink-0 z-30">
          <button onClick={() => { setShowDeleteProjectConfirm(false); setSelectedProject(null); }} className="flex items-center gap-2">
            <i className="fas fa-arrow-left"></i>
            <span className="font-black text-sm uppercase tracking-tight">List</span>
          </button>
          <div className="flex gap-2">
            {canDelete && (
              <button
                onClick={() => setShowDeleteProjectConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-black text-[10px] uppercase shadow-md active:scale-95 transition"
              >
                <i className="fas fa-trash mr-1"></i> Delete
              </button>
            )}
            <button onClick={handleDownloadPDF} disabled={sending} className={`bg-amber-500 text-blue-900 px-3 py-2 rounded-lg font-black text-[10px] uppercase shadow-md active:scale-95 transition flex items-center gap-1.5 ${sending ? 'opacity-75' : ''}`}>
              {sending ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-file-word"></i>}
              {sending ? 'Generating...' : 'Download (.docx)'}
            </button>
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
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden">
      <header className="p-4 bg-[#003399] text-white flex items-center shadow-lg shrink-0 z-20">
        <button onClick={onBack} className="mr-4"><i className="fas fa-arrow-left text-lg"></i></button>
        <h2 className="text-lg font-black uppercase tracking-tight">FINALIZED REPORTS</h2>
      </header>
      
      {/* Search Interaction Layer */}
      <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 z-10">
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input type="text"  className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003399] transition shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button type="button" onClick={() => startVoiceInput('search', setSearchQuery)} className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'search' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-[#003399]'}`}><i className="fas fa-microphone"></i></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/30 dark:bg-slate-950 [grid-auto-rows:minmax(140px,1fr)]">
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
  );
};

export default CurrentProjects;
