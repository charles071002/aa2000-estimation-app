import React, { useState, useEffect, useRef } from 'react';
import { User, Project, SurveyType, EstimationDetail, CCTVSurveyData, FireAlarmSurveyData, AccessControlSurveyData, BurglarAlarmSurveyData, FireProtectionSurveyData, OtherSurveyData, ChatMessage } from '../types';
import Login from './01_Login';
import AdminLogin from './12_AdminLogin';
import Signup from './02_Signup';
import Dashboard from './03_Dashboard';
import CurrentProjects from './04_CurrentProjects';
import ProjectDetails from './05_ProjectDetails';
import CCTVSurvey from './06_CCTVSurvey';
import FireAlarmSurvey from './07_FireAlarmSurvey';
import FireProtectionSurvey from './08_FireProtectionSurvey';
import AccessControlSurvey from './09_AccessControlSurvey';
import BurglarAlarmSurvey from './10_BurglarAlarmSurvey';
import OtherSurvey from './11_OtherSurvey';
import AIClarification from './13_AIClarification';
import EstimationScreen from './14_EstimationScreen';
import SurveySummary from './15_SurveySummary';
import { AA2000_LOGO } from '../constants';

/**
 * APPLICATION WORKFLOW SCREENS
 * Defines the logical UI states the user can traverse.
 * ROLE_SELECTION -> LOGIN/SIGNUP -> DASHBOARD -> (Workflow Loop below)
 * PROJECT_DETAILS -> SYSTEM_SURVEY -> ESTIMATION -> SUMMARY
 */
type Screen =
  | 'ROLE_SELECTION'
  | 'START'
  | 'LOGIN'
  | 'ADMIN_LOGIN'
  | 'SIGNUP'
  | 'DASHBOARD'
  | 'CURRENT_PROJECTS'
  | 'PROJECT_DETAILS'
  | 'CCTV_SURVEY'
  | 'FA_SURVEY'
  | 'FP_SURVEY'
  | 'AC_SURVEY'
  | 'BA_SURVEY'
  | 'OTHER_SURVEY'
  | 'AI_CLARIFICATION'
  | 'ESTIMATION'
  | 'SUMMARY';

/** URL path for each screen (used for address bar and back/forward). */
const SCREEN_TO_PATH: Record<Screen, string> = {
  ROLE_SELECTION: '/',
  START: '/start',
  LOGIN: '/login',
  ADMIN_LOGIN: '/admin-login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  CURRENT_PROJECTS: '/projects',
  PROJECT_DETAILS: '/project-details',
  CCTV_SURVEY: '/survey/cctv',
  FA_SURVEY: '/survey/fire-alarm',
  FP_SURVEY: '/survey/fire-protection',
  AC_SURVEY: '/survey/access-control',
  BA_SURVEY: '/survey/burglar-alarm',
  OTHER_SURVEY: '/survey/other',
  AI_CLARIFICATION: '/survey/clarification',
  ESTIMATION: '/survey/estimation',
  SUMMARY: '/summary',
};

const PATH_TO_SCREEN: Record<string, Screen> = Object.fromEntries(
  (Object.entries(SCREEN_TO_PATH) as [Screen, string][]).map(([s, p]) => [p, s])
);

function pathnameToScreen(pathname: string): Screen {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return PATH_TO_SCREEN[normalized] ?? 'ROLE_SELECTION';
}

/** Screens that require an authenticated user; direct URL access without login shows auth notice. */
const PROTECTED_SCREENS: Screen[] = [
  'DASHBOARD', 'CURRENT_PROJECTS', 'PROJECT_DETAILS',
  'CCTV_SURVEY', 'FA_SURVEY', 'FP_SURVEY', 'AC_SURVEY', 'BA_SURVEY', 'OTHER_SURVEY',
  'AI_CLARIFICATION', 'ESTIMATION', 'SUMMARY',
];

/**
 * ROOT APPLICATION COMPONENT
 * Purpose: Manages global survey state, user authentication session, 
 * and handles top-level routing based on the 'screen' state.
 */
const App: React.FC = () => {
  // --- SESSION & USER STATE --- (initial screen from URL so direct /login etc. works)
  const [screen, setScreen] = useState<Screen>(() =>
    typeof window !== 'undefined' ? pathnameToScreen(window.location.pathname || '/') : 'ROLE_SELECTION'
  );
  const [userRole, setUserRole] = useState<'TECHNICIAN' | 'ADMIN' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // --- PROJECT BUFFERS ---
  // These states act as temporary containers for a survey currently "in-flight".
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [surveyType, setSurveyType] = useState<SurveyType | null>(null);
  
  // SYSTEM-SPECIFIC AUDIT BUFFERS
  const [cctvData, setCctvData] = useState<CCTVSurveyData | null>(null);
  const [faData, setFaData] = useState<FireAlarmSurveyData | null>(null);
  const [fpData, setFpData] = useState<FireProtectionSurveyData | null>(null);
  const [acData, setAcData] = useState<AccessControlSurveyData | null>(null);
  const [baData, setBaData] = useState<BurglarAlarmSurveyData | null>(null);
  const [otherData, setOtherData] = useState<OtherSurveyData | null>(null);
  
  // AI CHAT STATE
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingClarifications, setPendingClarifications] = useState<string[]>([]);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [auditNarrative, setAuditNarrative] = useState('');

  // --- OFFLINE NEXA CALIBRATION (trainable heuristics) ---
  const NEXA_CALIBRATION_KEY = 'aa2000_nexa_calibration_v1';
  type NexaCalibrationEntry = {
    ts: string;
    surveyType: SurveyType;
    unitCount: number;
    days: number;
    techs: number;
  };

  const getUnitCountForSurvey = (t: SurveyType): number => {
    try {
      switch (t) {
        case SurveyType.CCTV:
          return cctvData?.cameras?.length ?? 0;
        case SurveyType.FIRE_ALARM: {
          const detectors = (faData?.detectionAreas ?? []).reduce((sum, area) => {
            return sum + (area.devices ?? []).reduce((s, d) => s + (Number(d.count) || 0), 0);
          }, 0);
          const notif = Number(faData?.notification?.deviceCount) || 0;
          const mcp = Number(faData?.notification?.mcpCount) || 0;
          return detectors + notif + mcp;
        }
        case SurveyType.ACCESS_CONTROL:
          return acData?.doors?.length ?? 0;
        case SurveyType.BURGLAR_ALARM: {
          const sensors = (baData?.sensors ?? []).reduce((sum, s) => sum + (Number(s.count) || 0), 0);
          const sirens = (Number(baData?.notification?.sirenIndoor) || 0) + (Number(baData?.notification?.sirenOutdoor) || 0);
          const keypads = Number(baData?.controlPanel?.keypads) || 0;
          return sensors + sirens + keypads;
        }
        case SurveyType.FIRE_PROTECTION: {
          const alarmCore =
            (Number(fpData?.alarmCore?.smokeCount) || 0) +
            (Number(fpData?.alarmCore?.heatCount) || 0) +
            (Number(fpData?.alarmCore?.mcpCount) || 0) +
            (Number(fpData?.alarmCore?.notifCount) || 0);
          const suppression = Number((fpData as any)?.suppression?.qty) || 0;
          const sprinkler = Number((fpData as any)?.sprinkler?.qty) || 0;
          const portable = Number((fpData as any)?.portable?.qty) || 0;
          return alarmCore + suppression + sprinkler + portable;
        }
        case SurveyType.OTHER:
        default:
          return Number((otherData as any)?.unitCount) || 0;
      }
    } catch {
      return 0;
    }
  };

  const saveNexaCalibration = (t: SurveyType, unitCount: number, est: EstimationDetail) => {
    if (!unitCount || unitCount <= 0) return;
    const days = Number(est.days) || 0;
    const techs = Number(est.techs) || 0;
    if (days <= 0 || techs <= 0) return;
    try {
      const raw = localStorage.getItem(NEXA_CALIBRATION_KEY);
      const parsed: NexaCalibrationEntry[] = raw ? JSON.parse(raw) : [];
      const next: NexaCalibrationEntry[] = [
        ...parsed,
        { ts: new Date().toISOString(), surveyType: t, unitCount, days, techs },
      ].slice(-50); // keep last 50 calibrations
      localStorage.setItem(NEXA_CALIBRATION_KEY, JSON.stringify(next));
    } catch {
      // ignore calibration write errors
    }
  };
  
  // ESTIMATION ACCUMULATOR
  // Logic: Stores estimations per survey type to allow projects with multiple systems (e.g. CCTV + Fire).
  const [estimations, setEstimations] = useState<Record<string, EstimationDetail>>({});
  
  // EDITING CONTEXT
  const [selectedHistoricalProject, setSelectedHistoricalProject] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const fromPopStateRef = useRef(false);
  const replaceStateRef = useRef(false);

  /**
   * INIT + URL: Ensure dev technician exists; if user has session and is on /, redirect to /dashboard.
   */
  useEffect(() => {
    const pathname = window.location.pathname || '/';

    const techniciansRaw = localStorage.getItem('aa2000_technicians');
    const technicians: any[] = techniciansRaw ? JSON.parse(techniciansRaw) : [];
    const devEmail = '17charlesnicomedes@gmail.com';
    const devExists = technicians.some((t: any) => t.email.toLowerCase() === devEmail.toLowerCase());
    if (!devExists) {
      technicians.push({ fullName: 'Developer', email: devEmail, password: '123123' });
      localStorage.setItem('aa2000_technicians', JSON.stringify(technicians));
    }

    const savedUser = localStorage.getItem('aa2000_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      const savedRole = localStorage.getItem('aa2000_userRole');
      const normalizedRole = savedRole === 'ADMIN' ? 'ADMIN' : 'TECHNICIAN';

      setUser(parsedUser);
      setUserRole(normalizedRole);

      if (pathname === '/' || pathname === '') {
        replaceStateRef.current = true;
        setScreen('DASHBOARD');
      }
    }
  }, []);

  /**
   * BROWSER BACK/FORWARD: When user clicks back/forward, update screen from URL.
   */
  useEffect(() => {
    const onPopState = () => {
      fromPopStateRef.current = true;
      setScreen(pathnameToScreen(window.location.pathname || '/'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /**
   * SCREEN → URL: When screen changes (user navigation), update the address bar.
   */
  useEffect(() => {
    if (fromPopStateRef.current) {
      fromPopStateRef.current = false;
      return;
    }
    const path = SCREEN_TO_PATH[screen];
    const current = (window.location.pathname || '/').replace(/\/$/, '') || '/';
    if (current === path) return;
    if (replaceStateRef.current) {
      replaceStateRef.current = false;
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
  }, [screen]);

  /**
   * NAVIGATION EFFECT
   * Logic: Resets the window scroll position whenever the active screen changes
   * to ensure new views always start from the top.
   */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  /**
   * AUTHENTICATION HANDLERS
   * Purpose: Transitions the app from guest to authenticated state.
   * Input: Valid user object from the Login component.
   */
  const handleLogin = (u: User) => {
    setUser(u);
    setUserRole('TECHNICIAN');
    localStorage.setItem('aa2000_user', JSON.stringify(u));
    localStorage.setItem('aa2000_userRole', 'TECHNICIAN');
    setScreen('DASHBOARD');
  };

  const handleAdminLogin = (u: User) => {
    setUser(u);
    setUserRole('ADMIN');
    localStorage.setItem('aa2000_user', JSON.stringify(u));
    localStorage.setItem('aa2000_userRole', 'ADMIN');
    // Admin should be able to create new projects from the same dashboard UI.
    setScreen('DASHBOARD');
  };

  const handleLogout = () => {
    setUser(null);
    setUserRole(null);
    localStorage.removeItem('aa2000_user');
    localStorage.removeItem('aa2000_userRole');
    setScreen('ROLE_SELECTION');
  };

  /**
   * PROJECT INITIALIZATION
   * Purpose: Sets the context for a new survey project (client name, location, etc.).
   */
  const startProject = (p: Project) => {
    setActiveProject(p);
  };

  /**
   * SURVEY ROUTING
   * Logic: Redirects the user to the specific technical audit form based on their selection.
   * Input: enum SurveyType.
   */
  const handleSurveySelection = (type: SurveyType) => {
    setSurveyType(type);
    if (type === SurveyType.CCTV) setScreen('CCTV_SURVEY');
    else if (type === SurveyType.FIRE_ALARM) setScreen('FA_SURVEY');
    else if (type === SurveyType.FIRE_PROTECTION) setScreen('FP_SURVEY');
    else if (type === SurveyType.ACCESS_CONTROL) setScreen('AC_SURVEY');
    else if (type === SurveyType.BURGLAR_ALARM) setScreen('BA_SURVEY');
    else setScreen('OTHER_SURVEY');
  };

  /** Load a project from the list into state and open the given survey for editing. */
  const handleEditAuditFromList = (projectRecord: any, index: number, surveyType: SurveyType) => {
    handleEditProject(projectRecord, index);
    setSurveyType(surveyType);
    const screenMap: Record<SurveyType, Screen> = {
      [SurveyType.CCTV]: 'CCTV_SURVEY',
      [SurveyType.FIRE_ALARM]: 'FA_SURVEY',
      [SurveyType.FIRE_PROTECTION]: 'FP_SURVEY',
      [SurveyType.ACCESS_CONTROL]: 'AC_SURVEY',
      [SurveyType.BURGLAR_ALARM]: 'BA_SURVEY',
      [SurveyType.OTHER]: 'OTHER_SURVEY',
    };
    setScreen(screenMap[surveyType]);
  };

  /**
   * FLOOR PLAN RESET LOGIC
   * Purpose: Clears all previous AI analysis, chat memory, and extracted data
   * when a new floor plan is uploaded.
   */
  const handleNewFloorPlan = () => {
    setChatMessages([
      {
        id: 'reset-msg-' + Date.now(),
        role: 'assistant',
        content: 'Previous floor plan data cleared. New floor plan detected. Starting fresh analysis...',
        timestamp: new Date()
      }
    ]);
    setPendingClarifications([]);
    setChatInitialized(false);
    setAuditNarrative('');
  };

  /**
   * PROJECT EDITING LOGIC
   * Logic: Populates all project and audit buffers from a historical record 
   * to allow modifications to an existing report.
   * @param item - The serialized project record from history.
   * @param index - Array index for updating in localStorage later.
   */
  const handleEditProject = (item: any, index: number) => {
    setActiveProject(item.project);
    setCctvData(item.cctvData);
    setFaData(item.faData);
    setFpData(item.fpData);
    setAcData(item.acData);
    setBaData(item.baData);
    setOtherData(item.otherData);
    
    // Legacy support for older project formats
    if (item.estimations) {
      setEstimations(item.estimations);
    } else if (item.estimationData) {
      const typeKey = item.cctvData ? SurveyType.CCTV : (item.faData ? SurveyType.FIRE_ALARM : SurveyType.OTHER);
      setEstimations({ [typeKey]: item.estimationData });
    } else {
      setEstimations({});
    }
    
    if (item.cctvData) setSurveyType(SurveyType.CCTV);
    else if (item.faData) setSurveyType(SurveyType.FIRE_ALARM);
    else if (item.fpData) setSurveyType(SurveyType.FIRE_PROTECTION);
    else if (item.acData) setSurveyType(SurveyType.ACCESS_CONTROL);
    else if (item.baData) setSurveyType(SurveyType.BURGLAR_ALARM);
    else setSurveyType(SurveyType.OTHER);
    
    setEditingIndex(index);
    setScreen('PROJECT_DETAILS');
  };

  /**
   * FINALIZATION HANDLER
   * Logic: Compiles the active buffers into a single "Project Record" and persists to localStorage.
   * Output: Navigates to the Summary report view.
   */
  const handleFinalize = (est: EstimationDetail) => {
    if (surveyType) {
      const units = getUnitCountForSurvey(surveyType);
      saveNexaCalibration(surveyType, units, est);
    }
    const finalEstimations = { ...estimations, [surveyType!]: est };
    const savedProjectsRaw = localStorage.getItem('aa2000_saved_projects');
    const savedProjects = savedProjectsRaw ? JSON.parse(savedProjectsRaw) : [];
    
    const newRecord = {
      project: activeProject,
      cctvData: finalEstimations[SurveyType.CCTV] ? cctvData : null,
      faData: finalEstimations[SurveyType.FIRE_ALARM] ? faData : null,
      fpData: finalEstimations[SurveyType.FIRE_PROTECTION] ? fpData : null,
      acData: finalEstimations[SurveyType.ACCESS_CONTROL] ? acData : null,
      baData: finalEstimations[SurveyType.BURGLAR_ALARM] ? baData : null,
      otherData: finalEstimations[SurveyType.OTHER] ? otherData : null,
      estimations: finalEstimations,
      timestamp: new Date().toISOString()
    };
    
    if (editingIndex !== null) {
      savedProjects[editingIndex] = newRecord;
    } else {
      savedProjects.push(newRecord);
    }
    
    localStorage.setItem('aa2000_saved_projects', JSON.stringify(savedProjects));
    setEstimations(finalEstimations);
    setScreen('SUMMARY');
  };

  /**
   * DYNAMIC RENDERER
   * Logic: Switches the visible component based on 'screen' state. 
   * This implements a basic "state machine" router without external libraries.
   */
  const renderScreen = () => {
    // Auth gate: block protected pages when user is not logged in (e.g. direct URL access).
    if (PROTECTED_SCREENS.includes(screen) && !user) {
      return (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in" aria-modal="true" role="dialog" aria-labelledby="auth-required-title">
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="scale-110 origin-center">{AA2000_LOGO}</div>
            <div className="space-y-2">
              <h2 id="auth-required-title" className="text-xl font-bold text-slate-800">Authentication required</h2>
              <p className="text-slate-600 text-sm">
                You must log in or sign up first before you can access this page.
              </p>
            </div>
            <button
              onClick={() => setScreen('ROLE_SELECTION')}
              className="w-full py-3 bg-blue-900 text-white font-bold rounded-xl hover:bg-blue-800 transition"
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    switch (screen) {
      case 'ROLE_SELECTION':
        return (
          <div className="flex flex-col items-center min-h-full h-full px-8 pt-20 pb-10 md:pt-28 md:pb-16 bg-white animate-fade-in overflow-y-auto overflow-x-hidden">
            <div className="text-center space-y-5 shrink-0">
              <div className="-mt-4 mb-4">
                <div className="scale-150 origin-center">
                  {AA2000_LOGO}
                </div>
              </div>
              <h3 className="text-blue-900 font-black uppercase tracking-tighter text-base md:text-lg mt-20 mb-16">Select Portal Role</h3>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-center max-w-2xl shrink-0 mt-4 mb-4">
              <button 
                onClick={() => {
                  setUserRole('TECHNICIAN');
                  setScreen('START');
                }}
                className="w-full group p-6 bg-blue-900 rounded-[2rem] shadow-xl hover:bg-blue-800 transition-all active:scale-95 text-white flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-1">
                  <i className="fas fa-tools text-2xl"></i>
                </div>
                <span className="text-lg font-black tracking-tight uppercase">TECHNICIAN</span>
                <span className="text-blue-300 text-[10px] font-bold uppercase tracking-widest">Surveys &amp; Audits</span>
              </button>

              <button 
                onClick={() => {
                  setUserRole('ADMIN');
                  setUser(null); 
                  setScreen('ADMIN_LOGIN');
                }}
                className="w-full group p-6 bg-white border-2 border-blue-900 rounded-[2rem] shadow-lg hover:bg-blue-50 transition-all active:scale-95 text-blue-900 flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 bg-blue-900/10 rounded-2xl flex items-center justify-center mb-1">
                  <i className="fas fa-briefcase text-xl"></i>
                </div>
                <span className="text-lg font-black tracking-tight uppercase text-center">Sales &amp; Admin</span>
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Reports &amp; Remarks</span>
              </button>
            </div>

            <p className="text-slate-400 text-[10px] text-center font-bold uppercase tracking-widest pb-2 mt-10 shrink-0">
              AA2000 Security &amp; Technology Solutions
            </p>
          </div>
        );

      case 'START':
        return (
          <div className="flex flex-col items-center min-h-full h-full px-8 pt-20 pb-10 md:pt-28 md:pb-16 bg-white overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col items-center space-y-12 w-full max-w-xs shrink-0">
              <div className="-mt-4 mb-4">
                <div className="scale-150 origin-center">
                  {AA2000_LOGO}
                </div>
              </div>
              <div className="w-full space-y-4">
                <button onClick={() => setScreen('LOGIN')} className="w-full py-4 bg-blue-900 text-white font-bold rounded-xl shadow-lg hover:bg-blue-800 transition">LOGIN</button>
                <button onClick={() => setScreen('SIGNUP')} className="w-full py-4 border-2 border-blue-900 text-blue-900 font-bold rounded-xl hover:bg-blue-50 transition">SIGN UP</button>
              </div>
              <button onClick={() => setScreen('ROLE_SELECTION')} className="text-slate-400 text-xs text-center font-black uppercase tracking-widest active:scale-95">
                <i className="fas fa-arrow-left mr-2"></i>Back to Role Selection
              </button>
            </div>
          </div>
        );

      case 'LOGIN':
        return <Login onBack={() => setScreen('START')} onLogin={handleLogin} />;
      
      case 'ADMIN_LOGIN':
        return <AdminLogin onBack={() => setScreen('ROLE_SELECTION')} onLogin={handleAdminLogin} />;

      case 'SIGNUP':
        return <Signup onBack={() => setScreen('START')} onSignupComplete={() => setScreen('LOGIN')} />;

      case 'DASHBOARD':
        return (
          <Dashboard 
            user={user!}
            onNewProject={() => {
              setActiveProject(null);
              setCctvData(null);
              setFaData(null);
              setFpData(null);
              setAcData(null);
              setBaData(null);
              setOtherData(null);
              setChatMessages([]);
              setPendingClarifications([]);
              setChatInitialized(false);
              setAuditNarrative('');
              setEstimations({});
              setEditingIndex(null);
              setScreen('PROJECT_DETAILS');
            }}
            onCurrentProjects={() => setScreen('CURRENT_PROJECTS')}
            onLogout={handleLogout}
          />
        );

      case 'CURRENT_PROJECTS':
        return (
          <CurrentProjects 
            user={user}
            userRole={userRole}
            onBack={() => setScreen('DASHBOARD')}
            onViewProject={(proj) => {
              setSelectedHistoricalProject(proj);
              setScreen('SUMMARY');
            }}
            onEditProject={handleEditProject}
            onEditAuditFromList={handleEditAuditFromList}
          />
        );

      case 'PROJECT_DETAILS':
        return (
          <ProjectDetails 
            user={user!}
            onBack={() => setScreen(editingIndex !== null ? 'CURRENT_PROJECTS' : 'DASHBOARD')}
            onStart={startProject}
            onSelectSurvey={handleSurveySelection}
            initialData={activeProject || undefined}
          />
        );

      case 'CCTV_SURVEY':
        return (
          <CCTVSurvey 
            onBack={(draft) => { if (draft != null) setCctvData(draft); setScreen('PROJECT_DETAILS'); }}
            onComplete={(data) => { setCctvData(data); setScreen('AI_CLARIFICATION'); }}
            onNewFloorPlan={handleNewFloorPlan}
            initialData={cctvData || undefined}
          />
        );

      case 'FA_SURVEY':
        return (
          <FireAlarmSurvey 
            onBack={(draft) => { if (draft != null) setFaData(draft); setScreen('PROJECT_DETAILS'); }}
            onComplete={(data) => { setFaData(data); setScreen('AI_CLARIFICATION'); }}
            onNewFloorPlan={handleNewFloorPlan}
            initialData={faData || undefined}
          />
        );

      case 'FP_SURVEY':
        return (
          <FireProtectionSurvey 
            onBack={(draft) => { if (draft != null) setFpData(draft); setScreen('PROJECT_DETAILS'); }}
            onComplete={(data) => { setFpData(data); setScreen('AI_CLARIFICATION'); }}
            onNewFloorPlan={handleNewFloorPlan}
            initialData={fpData || undefined}
          />
        );

      case 'AC_SURVEY':
        return (
          <AccessControlSurvey 
            onBack={(draft) => { if (draft != null) setAcData(draft); setScreen('PROJECT_DETAILS'); }}
            onComplete={(data) => { setAcData(data); setScreen('AI_CLARIFICATION'); }}
            onNewFloorPlan={handleNewFloorPlan}
            initialData={acData || undefined}
          />
        );

      case 'BA_SURVEY':
        return (
          <BurglarAlarmSurvey 
            onBack={(draft) => { if (draft != null) setBaData(draft); setScreen('PROJECT_DETAILS'); }}
            onComplete={(data) => { setBaData(data); setScreen('AI_CLARIFICATION'); }}
            onNewFloorPlan={handleNewFloorPlan}
            initialData={baData || undefined}
          />
        );

      case 'OTHER_SURVEY':
        return (
          <OtherSurvey 
            onBack={(draft) => { if (draft != null) setOtherData(draft); setScreen('PROJECT_DETAILS'); }}
            onComplete={(data) => { setOtherData(data); setScreen('AI_CLARIFICATION'); }}
            onNewFloorPlan={handleNewFloorPlan}
            initialData={otherData || undefined}
          />
        );

      case 'AI_CLARIFICATION':
        return (
          <AIClarification 
            project={activeProject!}
            type={surveyType!}
            cctvData={cctvData}
            faData={faData}
            fpData={fpData}
            acData={acData}
            baData={baData}
            otherData={otherData}
            messages={chatMessages}
            setMessages={setChatMessages}
            pendingClarifications={pendingClarifications}
            setPendingClarifications={setPendingClarifications}
            initialized={chatInitialized}
            setInitialized={setChatInitialized}
            narrative={auditNarrative}
            setNarrative={setAuditNarrative}
            onComplete={({ narrative, suggestedEstimation }) => {
              setAuditNarrative(narrative);
              if (suggestedEstimation && surveyType) {
                setEstimations(prev => ({ ...prev, [surveyType]: suggestedEstimation }));
              }
              setScreen('ESTIMATION');
            }}
            onBack={() => {
              const prevMap: Record<string, Screen> = {
                [SurveyType.CCTV]: 'CCTV_SURVEY', [SurveyType.FIRE_ALARM]: 'FA_SURVEY', [SurveyType.FIRE_PROTECTION]: 'FP_SURVEY',
                [SurveyType.ACCESS_CONTROL]: 'AC_SURVEY', [SurveyType.BURGLAR_ALARM]: 'BA_SURVEY', [SurveyType.OTHER]: 'OTHER_SURVEY'
              };
              setScreen(prevMap[surveyType!] || 'PROJECT_DETAILS');
            }}
          />
        );

      case 'ESTIMATION':
        return (
          <EstimationScreen 
            project={activeProject!}
            type={surveyType!}
            cctvData={cctvData}
            faData={faData}
            fpData={fpData}
            acData={acData}
            baData={baData}
            otherData={otherData}
            initialEstimation={estimations[surveyType!] || undefined}
            onComplete={handleFinalize}
            onContinueFA={(curEst) => { saveNexaCalibration(surveyType!, getUnitCountForSurvey(surveyType!), curEst); setEstimations(prev => ({ ...prev, [surveyType!]: curEst })); setSurveyType(SurveyType.FIRE_ALARM); setScreen('FA_SURVEY'); }}
            onContinueFP={(curEst) => { saveNexaCalibration(surveyType!, getUnitCountForSurvey(surveyType!), curEst); setEstimations(prev => ({ ...prev, [surveyType!]: curEst })); setSurveyType(SurveyType.FIRE_PROTECTION); setScreen('FP_SURVEY'); }}
            onContinueCCTV={(curEst) => { saveNexaCalibration(surveyType!, getUnitCountForSurvey(surveyType!), curEst); setEstimations(prev => ({ ...prev, [surveyType!]: curEst })); setSurveyType(SurveyType.CCTV); setScreen('CCTV_SURVEY'); }}
            onContinueAC={(curEst) => { saveNexaCalibration(surveyType!, getUnitCountForSurvey(surveyType!), curEst); setEstimations(prev => ({ ...prev, [surveyType!]: curEst })); setSurveyType(SurveyType.ACCESS_CONTROL); setScreen('AC_SURVEY'); }}
            onContinueBA={(curEst) => { saveNexaCalibration(surveyType!, getUnitCountForSurvey(surveyType!), curEst); setEstimations(prev => ({ ...prev, [surveyType!]: curEst })); setSurveyType(SurveyType.BURGLAR_ALARM); setScreen('BA_SURVEY'); }}
            onContinueOther={(curEst) => { saveNexaCalibration(surveyType!, getUnitCountForSurvey(surveyType!), curEst); setEstimations(prev => ({ ...prev, [surveyType!]: curEst })); setSurveyType(SurveyType.OTHER); setScreen('OTHER_SURVEY'); }}
            onBack={() => setScreen('AI_CLARIFICATION')}
          />
        );

      case 'SUMMARY':
        const dP = selectedHistoricalProject?.project || activeProject;
        const dC = selectedHistoricalProject?.cctvData || cctvData;
        const dF = selectedHistoricalProject?.faData || faData;
        const dFP = selectedHistoricalProject?.fpData || fpData;
        const dAC = selectedHistoricalProject?.acData || acData;
        const dBA = selectedHistoricalProject?.baData || baData;
        const dO = selectedHistoricalProject?.otherData || otherData;
        const dE = selectedHistoricalProject?.estimations || estimations;

if (!dP) {
          return (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6 bg-white">
              <p className="text-slate-600 text-sm font-medium">No project selected.</p>
              <button
                onClick={() => setScreen(userRole === 'ADMIN' ? 'CURRENT_PROJECTS' : 'DASHBOARD')}
                className="px-4 py-2 bg-blue-900 text-white text-xs font-bold rounded-xl"
              >
                Go back
              </button>
            </div>
          );
        }

        const surveyTypeToKey: Record<SurveyType, string> = {
          [SurveyType.CCTV]: 'cctvData',
          [SurveyType.FIRE_ALARM]: 'faData',
          [SurveyType.FIRE_PROTECTION]: 'fpData',
          [SurveyType.ACCESS_CONTROL]: 'acData',
          [SurveyType.BURGLAR_ALARM]: 'baData',
          [SurveyType.OTHER]: 'otherData',
        };

        const handleDeleteSurvey = (type: SurveyType) => {
          if (type === SurveyType.CCTV) setCctvData(null);
          else if (type === SurveyType.FIRE_ALARM) setFaData(null);
          else if (type === SurveyType.FIRE_PROTECTION) setFpData(null);
          else if (type === SurveyType.ACCESS_CONTROL) setAcData(null);
          else if (type === SurveyType.BURGLAR_ALARM) setBaData(null);
          else if (type === SurveyType.OTHER) setOtherData(null);
          setEstimations((prev) => {
            const next = { ...prev };
            delete next[type];
            return next;
          });
          if (selectedHistoricalProject) {
            const key = surveyTypeToKey[type];
            const updated = { ...selectedHistoricalProject, [key]: null };
            const est = { ...(selectedHistoricalProject.estimations || {}) };
            delete est[type];
            updated.estimations = Object.keys(est).length ? est : undefined;
            setSelectedHistoricalProject(updated);
            const raw = localStorage.getItem('aa2000_saved_projects');
            if (raw) {
              const parsed = JSON.parse(raw);
              const idx = parsed.findIndex((p: any) => p.timestamp === selectedHistoricalProject.timestamp);
              if (idx !== -1) {
                parsed[idx] = updated;
                localStorage.setItem('aa2000_saved_projects', JSON.stringify(parsed));
              }
            }
          }
        };

        const surveyTypeToScreen: Record<SurveyType, Screen> = {
          [SurveyType.CCTV]: 'CCTV_SURVEY',
          [SurveyType.FIRE_ALARM]: 'FA_SURVEY',
          [SurveyType.FIRE_PROTECTION]: 'FP_SURVEY',
          [SurveyType.ACCESS_CONTROL]: 'AC_SURVEY',
          [SurveyType.BURGLAR_ALARM]: 'BA_SURVEY',
          [SurveyType.OTHER]: 'OTHER_SURVEY',
        };

        const handleEditAudit = (surveyType: SurveyType) => {
          if (selectedHistoricalProject) {
            const raw = localStorage.getItem('aa2000_saved_projects');
            const parsed = raw ? JSON.parse(raw) : [];
            const idx = parsed.findIndex((p: any) => p.project?.id === selectedHistoricalProject.project?.id && p.timestamp === selectedHistoricalProject.timestamp);
            if (idx !== -1) handleEditProject(selectedHistoricalProject, idx);
          }
          setSurveyType(surveyType);
          setScreen(surveyTypeToScreen[surveyType]);
        };

        return (
          <SurveySummary
            userRole={userRole}
            project={dP}
            cctvData={dC}
            faData={dF}
            fpData={dFP}
            acData={dAC}
            baData={dBA}
            otherData={dO}
            estimations={dE}
            onDone={() => {
              setScreen(userRole === 'ADMIN' ? 'CURRENT_PROJECTS' : 'DASHBOARD');
              setActiveProject(null); setCctvData(null); setFaData(null); setFpData(null);
              setAcData(null); setBaData(null); setOtherData(null); setEstimations({});
              setSelectedHistoricalProject(null); setEditingIndex(null);
            }}
            onDeleteSurvey={handleDeleteSurvey}
            onEditAudit={handleEditAudit}
          />
        );

      default:
        return <div className="h-full flex items-center justify-center">Screen not implemented</div>;
    }
  };

  return (
    <div className="w-full min-h-[100dvh] h-[100dvh] bg-white relative overflow-hidden text-slate-900 font-sans flex flex-col transition-all duration-500">
      {renderScreen()}
    </div>
  );
};

export default App;
