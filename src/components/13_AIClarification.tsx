import React, { useState, useEffect, useRef } from 'react';
import { Project, SurveyType, CCTVSurveyData, FireAlarmSurveyData, AccessControlSurveyData, BurglarAlarmSurveyData, FireProtectionSurveyData, OtherSurveyData, ChatMessage, EstimationDetail, EstimationManpowerEntry, EstimationConsumableEntry } from '../types';
import { processTitleCase } from '../utils/voiceProcessing';

type StructuredManpowerEntry = { role: string; headcount: number; hours: number };
type OfflineNexaJson = {
  roomAnalysis: string;
  totalDuration: string;
  manpowerRecommendation: string;
  hoursBreakdown: string;
  projectTimeline: string;
  consumables: string;
  structuredManpower: StructuredManpowerEntry[];
  suggestedEstimation: EstimationDetail;
};

interface Props {
  project: Project;
  type: SurveyType;
  cctvData: CCTVSurveyData | null;
  faData: FireAlarmSurveyData | null;
  fpData: FireProtectionSurveyData | null;
  acData: AccessControlSurveyData | null;
  baData: BurglarAlarmSurveyData | null;
  otherData: OtherSurveyData | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  pendingClarifications: string[];
  setPendingClarifications: React.Dispatch<React.SetStateAction<string[]>>;
  initialized: boolean;
  setInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  narrative: string;
  setNarrative: React.Dispatch<React.SetStateAction<string>>;
  onComplete: (payload: { narrative: string; suggestedEstimation?: EstimationDetail }) => void;
  onBack: () => void;
}

/**
 * NEXA LOGO ICON COMPONENT
 * Updated with background: black to match brand requirements.
 */
const NexaLogoIcon = () => (
  <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center p-1 border border-cyan-500/20 shadow-[0_0_12px_rgba(34,211,238,0.3)] shrink-0 overflow-hidden">
    <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nexaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="60%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="pathGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path 
        d="M28 75 V28 L72 72 V25" 
        fill="none" 
        stroke="url(#nexaGradient)" 
        strokeWidth="14" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#pathGlow)"
      />
      <path d="M15 15 L32 30" stroke="#22D3EE" strokeWidth="3" opacity="0.6" />
      <path d="M22 10 L38 25" stroke="#22D3EE" strokeWidth="2" opacity="0.4" />
      <circle cx="15" cy="15" r="4" fill="#22D3EE" filter="url(#nodeGlow)" />
      <circle cx="22" cy="10" r="3" fill="#22D3EE" />
      <path d="M68 70 L85 90" stroke="#3B82F6" strokeWidth="3" opacity="0.6" />
      <path d="M75 78 L90 95" stroke="#3B82F6" strokeWidth="2" opacity="0.4" />
      <circle cx="85" cy="90" r="4" fill="#3B82F6" />
      <circle cx="90" cy="95" r="3" fill="#3B82F6" />
      <circle cx="28" cy="75" r="6" fill="#22D3EE" filter="url(#nodeGlow)" />
      <circle cx="72" cy="25" r="8" fill="white" filter="url(#nodeGlow)" />
      <circle cx="72" cy="25" r="4" fill="white" />
    </svg>
  </div>
);

const AIClarification: React.FC<Props> = ({ 
  project, type, cctvData, faData, fpData, acData, baData, otherData, 
  messages, setMessages, pendingClarifications,
  initialized, setInitialized, narrative, setNarrative,
  onComplete, onBack 
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const BOLD_SECTION_HEADERS = new Set([
    'ARCHITECTURAL ROOM ANALYSIS:',
    'TOTAL PROJECT DURATION:',
    'MANPOWER RECOMMENDATIONS:',
    'HOURS BREAKDOWN:',
    'PROJECT TIMELINE:',
    'CONSUMABLES:',
  ]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!initialized) {
      initializeAI();
    } else {
      const lastModelMsg = [...messages].reverse().find(m => m.role === 'model');
      const isComplete = lastModelMsg && (
        lastModelMsg.text.includes("No immediate clarifications required") ||
        lastModelMsg.text.includes("clarifications for the audit are now resolved") ||
        lastModelMsg.text.includes("Offline technical review active") ||
        lastModelMsg.text.includes("all technical clarifications for the audit are now resolved")
      );

      if (isComplete) {
        setCanProceed(true);
      } else if (pendingClarifications.length === 0 && messages.length > 0) {
        setCanProceed(true);
      }
    }
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatHours = (h: number) => `${Math.round(h)} Hours`;
  const ceilHalfDay = (days: number) => Math.ceil(days * 2) / 2;

  const getMeasurements = () =>
    cctvData?.measurements ||
    (cctvData as any)?.buildingInfo?.measurements ||
    (faData as any)?.buildingInfo?.measurements ||
    (acData as any)?.buildingInfo?.measurements ||
    (baData as any)?.buildingInfo?.measurements ||
    (fpData as any)?.buildingInfo?.measurements ||
    (otherData as any)?.buildingInfo?.measurements;

  const computeUnitCount = () => {
    try {
      switch (type) {
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

  const buildRoomAnalysis = (): string => {
    const m = getMeasurements();
    const rooms = (m?.rooms || []) as Array<{ name?: string; length?: number; width?: number; area?: number }>;
    if (!rooms.length) return "1. No floor plan rooms available – No dimensions available";
    return rooms
      .map((r, i) => {
        const name = (r.name || "Unnamed Room").trim();
        const hasLw = (Number(r.length) || 0) > 0 && (Number(r.width) || 0) > 0;
        const hasArea = (Number(r.area) || 0) > 0;
        const dim = hasLw
          ? `${Number(r.length).toFixed(2)}m × ${Number(r.width).toFixed(2)}m`
          : hasArea
            ? `${Number(r.area).toFixed(2)} sqm`
            : "No dimensions available";
        return `${i + 1}. ${name} – ${dim}`;
      })
      .join("\n");
  };

  const buildOfflineNexa = (): OfflineNexaJson => {
    const units = computeUnitCount();

    const defaultHoursPerUnit =
      type === SurveyType.CCTV ? 3.0 :
      type === SurveyType.FIRE_ALARM ? 1.5 :
      type === SurveyType.ACCESS_CONTROL ? 5.0 :
      type === SurveyType.BURGLAR_ALARM ? 1.5 :
      type === SurveyType.FIRE_PROTECTION ? 2.0 :
      2.0;

    const calibratedHoursPerUnit = (() => {
      try {
        const raw = localStorage.getItem('aa2000_nexa_calibration_v1');
        const parsed = raw ? JSON.parse(raw) : [];
        const rows = (Array.isArray(parsed) ? parsed : []).filter((e: any) => e?.surveyType === type && Number(e.unitCount) > 0 && Number(e.days) > 0 && Number(e.techs) > 0);
        if (!rows.length) return null;
        // average implied hours per unit = (days * techs * 8) / units
        const vals = rows.map((e: any) => (Number(e.days) * Number(e.techs) * 8) / Number(e.unitCount)).filter((v: any) => Number.isFinite(v) && v > 0);
        if (!vals.length) return null;
        const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        // clamp to avoid crazy values
        return Math.min(12, Math.max(0.5, avg));
      } catch {
        return null;
      }
    })();

    const hoursPerUnit = calibratedHoursPerUnit ?? defaultHoursPerUnit;

    const baseHours = Math.max(2, units * hoursPerUnit);

    // crew sizing from units (small -> 1-2, medium -> 3-4, large -> 5+)
    const installers = Math.max(1, Math.ceil(units / 10));
    const lead = 1;
    const helper = units >= 8 ? Math.max(1, Math.ceil(installers / 2)) : 0;
    const programmer = (type === SurveyType.ACCESS_CONTROL || type === SurveyType.FIRE_ALARM) && units >= 12 ? 1 : 0;
    const pipeFitter = (type === SurveyType.FIRE_PROTECTION) && units >= 8 ? 1 : 0;

    const crewSize = lead + installers + helper + programmer + pipeFitter;
    const totalDays = ceilHalfDay(baseHours / (Math.max(1, crewSize) * 8));

    const roleHours: StructuredManpowerEntry[] = [];
    // allocate hours by phase weights; lead/programmer split commission/QA
    const totalHoursAllPeople = totalDays * crewSize * 8;
    const leadHours = Math.min(totalHoursAllPeople, totalDays * 8);
    roleHours.push({ role: "Lead Technician / Senior Installer", headcount: lead, hours: leadHours });
    roleHours.push({ role: "LV Installer", headcount: installers, hours: totalDays * installers * 8 });
    if (helper > 0) roleHours.push({ role: "General Helper / Laborer", headcount: helper, hours: totalDays * helper * 8 });
    if (programmer > 0) roleHours.push({ role: "Programmer/Commissioning Tech", headcount: programmer, hours: Math.max(4, totalDays * 6) });
    if (pipeFitter > 0) roleHours.push({ role: "Pipe Fitter / Electrician", headcount: pipeFitter, hours: totalDays * pipeFitter * 8 });

    const manpowerBreakdown: EstimationManpowerEntry[] = roleHours.map((r, idx) => ({
      id: String(idx + 1),
      role: r.role,
      count: r.headcount,
      hours: Math.round(r.hours),
    }));

    const parseConsumablesToList = (text: string): EstimationConsumableEntry[] => {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const out: EstimationConsumableEntry[] = [];
      let i = 1;
      for (const line of lines) {
        const m = line.match(/^-?\s*([^:]+):\s*([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
        if (!m) continue;
        const name = m[1].trim();
        const qty = Number(m[2]) || 0;
        if (!name || qty <= 0) continue;
        out.push({ id: String(i++), name, category: 'Suggested', qty });
      }
      return out;
    };

    const suggestedEstimation: EstimationDetail = {
      days: Math.max(0.5, totalDays),
      techs: Math.max(1, crewSize),
      manpowerBreakdown,
      consumablesList: [], // filled after consumables string built
      additionalFees: [],
    };

    const manpowerRecommendation = [
      `- Total Project Duration: ${totalDays} Days — Based on ${units} unit(s) × ~${hoursPerUnit} hrs/unit with a ${crewSize}-person crew.`,
      `- Recommended Manpower:`,
      ...roleHours.map(r => `- ${r.role}: ${r.headcount}`),
    ].join("\n");

    const hoursBreakdown = roleHours
      .map(r => `- ${r.role}: ${formatHours(r.hours)}`)
      .join("\n");

    const projectTimeline = [
      `- ${Math.round(totalHoursAllPeople * 0.4)} hrs – Rough-in (cable pulling / pathways)`,
      `- ${Math.round(totalHoursAllPeople * 0.3)} hrs – Mounting / device installation`,
      `- ${Math.round(totalHoursAllPeople * 0.2)} hrs – Termination / testing`,
      `- ${Math.round(totalHoursAllPeople * 0.1)} hrs – Commissioning / turnover`,
    ].join("\n");

    const consumablesByType: Record<string, Array<{ name: string; unit: string }>> = {
      [SurveyType.CCTV]: [
        { name: "Self-tapping screws", unit: "box" },
        { name: "Wall plugs / Rawl plugs", unit: "box" },
        { name: "Electrical tape", unit: "rolls" },
        { name: "Cable markers / labels", unit: "pack" },
        { name: "Silicone sealant (weatherproof)", unit: "tubes" },
      ],
      [SurveyType.FIRE_ALARM]: [
        { name: "Mounting screws", unit: "box" },
        { name: "Wall anchors", unit: "box" },
        { name: "Electrical tape", unit: "rolls" },
        { name: "Wire connectors", unit: "box" },
        { name: "Zone labels", unit: "pack" },
      ],
      [SurveyType.ACCESS_CONTROL]: [
        { name: "Mounting screws", unit: "box" },
        { name: "Concrete anchors", unit: "box" },
        { name: "Electrical tape", unit: "rolls" },
        { name: "Wire ferrules", unit: "box" },
        { name: "Silicone sealant (weatherproof)", unit: "tubes" },
      ],
      [SurveyType.BURGLAR_ALARM]: [
        { name: "Small mounting screws", unit: "box" },
        { name: "Electrical tape", unit: "rolls" },
        { name: "Double-sided industrial tape", unit: "roll" },
        { name: "Cable markers / labels", unit: "pack" },
      ],
      [SurveyType.FIRE_PROTECTION]: [
        { name: "Teflon tape", unit: "rolls" },
        { name: "Pipe joint compound", unit: "cans" },
        { name: "Anchor bolts", unit: "pcs" },
        { name: "Welding rods", unit: "kg" },
        { name: "Anti-rust coating", unit: "cans" },
      ],
      [SurveyType.OTHER]: [
        { name: "Assorted screws", unit: "box" },
        { name: "Electrical tape", unit: "rolls" },
        { name: "Heat shrink tubing", unit: "pack" },
        { name: "Labels / asset tags", unit: "pack" },
      ],
    };

    const baseConsumables = consumablesByType[type] ?? consumablesByType[SurveyType.OTHER];
    const scale = Math.max(1, Math.ceil(units / 5));
    const consumables = baseConsumables
      .map((m) => `- ${m.name}: ${m.unit === "pcs" ? scale * 10 : scale} ${m.unit}`)
      .join("\n");

    return {
      roomAnalysis: buildRoomAnalysis(),
      totalDuration: `${totalDays} Days`,
      manpowerRecommendation,
      hoursBreakdown,
      projectTimeline,
      consumables,
      structuredManpower: roleHours,
      suggestedEstimation: {
        ...suggestedEstimation,
        consumablesList: parseConsumablesToList(consumables),
      },
    };
  };

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const initializeAI = async () => {
    setIsTyping(true);
    const data = buildOfflineNexa();
      const initialMessages: ChatMessage[] = [];
        initialMessages.push({ role: 'model', text: `ARCHITECTURAL ROOM ANALYSIS:\n${data.roomAnalysis}` });
    initialMessages.push({ role: 'model', text: `TOTAL PROJECT DURATION:\n${data.totalDuration}` });
        initialMessages.push({ role: 'model', text: `MANPOWER RECOMMENDATIONS:\n${data.manpowerRecommendation}` });
    initialMessages.push({ role: 'model', text: `HOURS BREAKDOWN:\n${data.hoursBreakdown}` });
    initialMessages.push({ role: 'model', text: `PROJECT TIMELINE:\n${data.projectTimeline}` });
    initialMessages.push({ role: 'model', text: `CONSUMABLES:\n${data.consumables}` });
    initialMessages.push({ role: 'model', text: "Offline technical review complete. You may ask me any questions about this audit or proceed to estimation." });
      setCanProceed(true);
      setMessages(initialMessages);
    setNarrative(
      `ARCHITECTURAL ROOM ANALYSIS:\n${data.roomAnalysis}\n\nTOTAL PROJECT DURATION:\n${data.totalDuration}\n\nMANPOWER RECOMMENDATIONS:\n${data.manpowerRecommendation}\n\nHOURS BREAKDOWN:\n${data.hoursBreakdown}\n\nPROJECT TIMELINE:\n${data.projectTimeline}\n\nCONSUMABLES:\n${data.consumables}`
    );
      setInitialized(true);
      setIsTyping(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);
    try {
      const snapshot = buildOfflineNexa();
      const q = input.toLowerCase();
      let aiText = "Noted. Ask about duration, manpower, hours, timeline, or consumables.";
      if (q.includes("duration") || q.includes("days")) aiText = `Based on current scope: ${snapshot.totalDuration}.`;
      else if (q.includes("manpower") || q.includes("technician") || q.includes("crew")) aiText = snapshot.manpowerRecommendation;
      else if (q.includes("hours")) aiText = snapshot.hoursBreakdown;
      else if (q.includes("timeline") || q.includes("phase")) aiText = snapshot.projectTimeline;
      else if (q.includes("consumable")) aiText = snapshot.consumables;
      else if (q.includes("room")) aiText = snapshot.roomAnalysis;
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
      
      setNarrative(prev => prev + `\n\nTechnician: ${input}\nAI: ${aiText}`);
    } catch (err: any) {
      console.error("Offline reply failed", err);
      setMessages(prev => [...prev, { role: 'model', text: `Offline reply failed. Your data is still saved.` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      setInput(processTitleCase(event.results[0][0].transcript));
    };
    recognition.start();
  };

  const getBackLabel = () => {
    switch(type) {
      case SurveyType.CCTV: return 'Back to Units';
      case SurveyType.FIRE_ALARM: return 'Back to Zones';
      case SurveyType.ACCESS_CONTROL: return 'Back to Mapping';
      case SurveyType.BURGLAR_ALARM: return 'Back to Sensors';
      default: return 'Back to Audit';
    }
  };

  const renderTopAuditCards = () => {
    const measurements =
      (cctvData as any)?.measurements ||
      (cctvData as any)?.buildingInfo?.measurements ||
      (faData as any)?.buildingInfo?.measurements ||
      (acData as any)?.buildingInfo?.measurements ||
      (baData as any)?.buildingInfo?.measurements ||
      (fpData as any)?.buildingInfo?.measurements ||
      (otherData as any)?.buildingInfo?.measurements;

    const planUploaded = measurements?.method === 'PLAN_UPLOAD' && ((measurements?.planImages?.length ?? 0) > 0 || !!measurements?.planImage);

    const buildingInfo =
      (cctvData as any)?.buildingInfo ||
      (faData as any)?.buildingInfo ||
      (acData as any)?.buildingInfo ||
      (baData as any)?.buildingInfo ||
      (fpData as any)?.buildingInfo ||
      (otherData as any)?.buildingInfo;

    const infra = (cctvData as any)?.infrastructure;

    const camList = (cctvData as any)?.cameras ?? [];
    const camCount = camList.length;
    const totalCable = camList.reduce((s: number, c: any) => s + (Number(c.cableLength) || 0), 0);
    const avgCable = camCount > 0 ? Math.round(totalCable / camCount) : 0;
    const storageTB = (cctvData as any)?.controlRoom?.storageRequirementTB;

    const card = (title: string, body: React.ReactNode) => (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1 opacity-60">
            <NexaLogoIcon />
            <span className="text-[8px] font-black uppercase tracking-widest">Nexa</span>
          </div>
          <p className="text-sm font-black text-slate-900">{title}</p>
        </div>
        <div className="px-4 pb-4">{body}</div>
      </div>
    );

    const infoRows: Array<{ label: string; value: string }> = [
      { label: 'Project', value: project.id || project.name || 'N/A' },
      {
        label: 'Building',
        value: buildingInfo
          ? `${buildingInfo.type || 'N/A'}, ${buildingInfo.floors ?? 'N/A'} floor(s), ${buildingInfo.isNew ? 'New' : 'Existing'}`
          : 'N/A',
      },
      {
        label: 'Site (Infrastructure)',
        value: infra
          ? `Cable path: ${infra.cablePath || infra.cableRoutingPath || 'N/A'} • Wall type: ${infra.wallType || 'N/A'} • Core drilling: ${(infra.coreDrilling ?? false) ? 'Yes' : 'No'}`
          : 'N/A',
      },
      { label: 'Plan', value: planUploaded ? 'Uploaded' : 'Not uploaded' },
    ];

    const cctvScope = card(
      'CCTV Scope Summary',
      <div className="space-y-2 text-sm text-slate-700">
        <div className="font-normal">Cameras = {camCount} unit(s)</div>
        <div className="font-normal">Average cable per camera = {avgCable}m</div>
        <div className="font-normal">Total cable = {Math.round(totalCable)}m</div>

        <div className="pt-3">
          <div className="text-xs font-black uppercase tracking-widest text-slate-900">Materials</div>
          <div className="mt-2 space-y-1 text-sm font-normal text-slate-700">
            <div>CCTV Cameras — {camCount || 0} unit(s)</div>
            <div>NVR — 1 unit (4-channel NVR)</div>
            <div>Hard Drive (HDD) — 2 × {(typeof storageTB === 'number' && storageTB > 0) ? `${storageTB}TB` : '8TB'}</div>
            <div>PoE Switch — 1 × {camCount > 8 ? '16-port' : '8-port'}</div>
            <div>UTP Cable — {Math.round(totalCable)} m</div>
            <div>Cable Box — 1 box CAT6</div>
            <div>PVC Conduit — ~ 20 pcs (3 m each)</div>
            <div>Junction Boxes — 1–3 pcs</div>
            <div>RJ45 Connectors — 3 pcs</div>
            <div>Rack Cabinet — 1 unit (9U–12U)</div>
            <div>Monitor — 1 unit (22–24 inch)</div>
          </div>
        </div>

        <div className="pt-3">
          <div className="text-xs font-black uppercase tracking-widest text-slate-900">Labor</div>
          <div className="mt-2 space-y-1 text-sm font-normal text-slate-700">
            <div>Installation</div>
            <div>Cable pulling</div>
            <div>Termination</div>
            <div>System configuration</div>
            <div>Testing &amp; commissioning</div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-3">
        {card(
          'Audit Snapshot',
          <div className="space-y-3">
            {infoRows.map((r) => (
              <div key={r.label} className="flex gap-2 text-sm">
                <span className="font-black text-slate-800 shrink-0">{r.label}:</span>
                <span className="font-normal text-slate-700">{r.value}</span>
              </div>
            ))}
          </div>
        )}
        {type === SurveyType.CCTV ? cctvScope : null}
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-50 overflow-y-auto md:overflow-hidden animate-fade-in">
      <header className="p-4 bg-blue-900 text-white flex items-center justify-between shadow-lg shrink-0">
        <button onClick={onBack} className="text-white flex items-center gap-2">
          <i className="fas fa-chevron-left"></i>
          <span className="font-bold text-xs uppercase">Audit Review</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">AI Review Live</span>
        </div>
      </header>

      <div className="flex-none min-h-0 md:flex-1 md:min-h-0 overflow-y-auto p-4 space-y-4">
        {renderTopAuditCards()}
        {messages.map((m, idx) => {
          const isModel = m.role === 'model';
          const isExpanded = expandedIndices.has(idx);
          const needsClamp = isModel && m.text.length > 250;

          return (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm ${
                m.role === 'user' 
                  ? 'bg-blue-900 text-white rounded-tr-none' 
                  : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
              }`}>
                <div className="flex items-center gap-2 mb-1 opacity-60">
                  {m.role === 'user' ? (
                    <i className="fas fa-user-circle text-[10px]"></i>
                  ) : (
                    <NexaLogoIcon />
                  )}
                  <span className="text-[8px] font-black uppercase tracking-widest">{m.role === 'user' ? 'Technician' : 'Nexa'}</span>
                </div>
                <div className="relative">
                  <p className={`whitespace-pre-wrap leading-relaxed ${needsClamp && !isExpanded ? 'line-clamp-6' : ''}`}>
                    {(() => {
                      const lines = m.text.split('\n');
                      return lines.map((line, i) => {
                      const trimmed = line.trim();
                      const isHeader = isModel && BOLD_SECTION_HEADERS.has(trimmed);
                      return (
                        <React.Fragment key={i}>
                          {isHeader ? (
                            <span className="font-black text-slate-900">{line}</span>
                          ) : (
                            <span>{line}</span>
                          )}
                          {i < lines.length - 1 ? <br /> : null}
                        </React.Fragment>
                      );
                      });
                    })()}
                  </p>
                  {needsClamp && (
                    <button 
                      onClick={() => toggleExpand(idx)}
                      className="mt-2 text-[10px] font-black text-blue-900 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px]`}></i>
                      {isExpanded ? 'See Less' : 'See More'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 flex gap-1">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="shrink-0 p-4 bg-white border-t border-slate-100 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-sm font-bold focus:border-blue-900 outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={startVoiceInput}
              className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
            >
              <i className="fas fa-microphone"></i>
            </button>
          </div>
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-12 h-12 bg-blue-900 text-white rounded-xl flex items-center justify-center active:scale-95 transition disabled:opacity-30"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => {
              if (!canProceed) return;
              const snapshot = buildOfflineNexa();
              onComplete({ narrative, suggestedEstimation: snapshot.suggestedEstimation });
            }}
            disabled={!canProceed || isTyping}
            className={`w-full py-4 font-black rounded-xl shadow-lg uppercase tracking-widest active:scale-95 transition flex items-center justify-center gap-2 ${canProceed && !isTyping ? 'bg-amber-500 text-blue-900' : 'bg-slate-200 text-slate-400 grayscale opacity-70 cursor-not-allowed'}`}
          >
            {canProceed ? 'Proceed to Estimation' : 'Awaiting Technical Review'}
            <i className={`fas ${canProceed ? 'fa-arrow-right' : 'fa-lock'} text-xs`}></i>
          </button>
          <button 
            onClick={onBack}
            className="w-full text-blue-600 font-bold py-4 uppercase text-xs tracking-widest text-center border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition"
          >
            {getBackLabel()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIClarification;
