import React, { useState, useEffect, useRef } from 'react';
import { FireAlarmSurveyData, DetectionArea, DetectionDevice } from '../types';
import { BUILDING_TYPES } from '../constants';
import { processNumeric, processTitleCase } from '../utils/voiceProcessing';
import FloorPlanManager from './12_FloorPlanManager';

interface Props {
  /** Receives current draft so it can be restored when returning. */
  onBack: (draft?: FireAlarmSurveyData) => void;
  onComplete: (data: FireAlarmSurveyData) => void;
  onNewFloorPlan?: () => void;
  initialData?: FireAlarmSurveyData;
}

const FireAlarmSurvey: React.FC<Props> = ({ onBack, onComplete, onNewFloorPlan, initialData }) => {
  const [step, setStep] = useState<'BUILDING' | 'DETECTION' | 'PANEL'>('BUILDING');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<FireAlarmSurveyData>({
    buildingInfo: { type: '', floors: 0, isNew: undefined as any },
    systemType: '',
    integrations: [],
    detectionAreas: [],
    notification: { mcpRequired: undefined as any, mcpCount: 0, devices: [], deviceCount: 0 },
    infrastructure: { cableType: '', otherCableType: '', cableLength: '' as any, routing: '', otherRouting: '', wallType: '', coreDrilling: undefined as any },
    controlPanel: { location: '', rackAvailable: undefined, powerAvailable: undefined, upsRequired: undefined, networkRequired: undefined }
  });

  const [selectedAreaType, setSelectedAreaType] = useState<string>('');
  const [otherAreaName, setOtherAreaName] = useState('');
  const [selectedCeilingType, setSelectedCeilingType] = useState<string>('');
  const [otherCeilingType, setOtherCeilingType] = useState('');
  const [ceilingHeight, setCeilingHeight] = useState<number | string>('');
  const [existingSystemStatus, setExistingSystemStatus] = useState<string>('');
  
  // New notification fields
  const [selectedNotifAppliance, setSelectedNotifAppliance] = useState<string>('');
  const [otherNotifAppliance, setOtherNotifAppliance] = useState('');
  const [selectedAudibility, setSelectedAudibility] = useState<string>('');
  const [otherAudibility, setOtherAudibility] = useState('');
  const [notificationQty, setNotificationQty] = useState<number | string>('');

  const [stagedImage, setStagedImage] = useState<string | null>(null);
  
  // Revised Staging Logic (No ADD button needed)
  type DetectorType = 'Smoke' | 'Heat' | 'Flame' | 'Gas' | 'Multi-sensor' | 'Other';
  const [deviceType, setDeviceType] = useState<DetectorType | null>(null);
  const [stagedSmokeCount, setStagedSmokeCount] = useState<string>('');
  const [stagedHeatCount, setStagedHeatCount] = useState<string>('');
  const [stagedFlameCount, setStagedFlameCount] = useState<string>('');
  const [stagedGasCount, setStagedGasCount] = useState<string>('');
  const [stagedMultiSensorCount, setStagedMultiSensorCount] = useState<string>('');
  const [stagedOtherCount, setStagedOtherCount] = useState<string>('');
  const [otherDetectorType, setOtherDetectorType] = useState<string>('');

  const [isListeningBuilding, setIsListeningBuilding] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  /** When non-null, Save will update this detection area index instead of appending. */
  const [editingDetectionAreaIndex, setEditingDetectionAreaIndex] = useState<number | null>(null);

  const AREA_NAME_OPTIONS = ['Office', 'Electrical', 'Kitchen', 'Storage', 'Server Room', 'Other'];

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  /**
   * SCROLL RESET EFFECT
   * Ensures that whenever the technician advances or goes back a step, 
   * the view resets to the top for a consistent experience.
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [step]);

  /**
   * COMPUTED: isStep1Complete
   * Logic: Validates that a building type is selected, and if 'Other' is chosen, 
   * ensures the manual specification text field is not empty.
   */
  const isStep1Complete = !!data.buildingInfo.type && (data.buildingInfo.type !== 'Other' || !!data.buildingInfo.otherType?.trim());

  const handleHeaderBack = () => {
    if (step === 'PANEL') {
      setStep('DETECTION');
    } else if (step === 'DETECTION') {
      setStep('BUILDING');
    } else {
      onBack(data);
    }
  };

  const startVoiceInput = (field: string, setter: (val: any) => void, isNumeric = false) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setActiveVoiceField(field);
    recognition.onend = () => setActiveVoiceField(null);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (isNumeric) {
        const num = processNumeric(transcript);
        if (num !== null) setter(num);
      } else {
        setter(processTitleCase(transcript));
      }
    };
    recognition.start();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStagedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const finalizeZone = () => {
    const finalName = selectedAreaType === 'Other' ? otherAreaName : selectedAreaType;
    const finalCeilingType = selectedCeilingType === 'Other' ? otherCeilingType : selectedCeilingType;
    const finalNotifAppliance = selectedNotifAppliance === 'Other' ? otherNotifAppliance : selectedNotifAppliance;
    const finalAudibility = selectedAudibility === 'Other' ? otherAudibility : selectedAudibility;
    
    const parseCount = (s: string) => Math.max(0, parseInt(s, 10) || 0);
    const devices: DetectionDevice[] = [];
    if (parseCount(stagedSmokeCount) > 0) devices.push({ type: 'Smoke', count: parseCount(stagedSmokeCount) });
    if (parseCount(stagedHeatCount) > 0) devices.push({ type: 'Heat', count: parseCount(stagedHeatCount) });
    if (parseCount(stagedFlameCount) > 0) devices.push({ type: 'Flame', count: parseCount(stagedFlameCount) });
    if (parseCount(stagedGasCount) > 0) devices.push({ type: 'Gas', count: parseCount(stagedGasCount) });
    if (parseCount(stagedMultiSensorCount) > 0) devices.push({ type: 'Multi-sensor', count: parseCount(stagedMultiSensorCount) });
    if (parseCount(stagedOtherCount) > 0) {
      if (!otherDetectorType?.trim()) {
        alert("Please specify the detector type for 'Other'.");
        return;
      }
      devices.push({ type: 'Other', otherType: otherDetectorType.trim(), count: parseCount(stagedOtherCount) });
    }

    if (!finalName || devices.length === 0 || !data.systemType) {
      if (!data.systemType) alert("Please select a Detection System Logic.");
      return;
    }
    
    const area: DetectionArea = {
      id: editingDetectionAreaIndex !== null ? data.detectionAreas[editingDetectionAreaIndex].id : Math.random().toString(36).substr(2, 9),
      name: finalName,
      devices: devices,
      image: stagedImage || undefined,
      ceilingType: finalCeilingType || undefined,
      ceilingHeight: ceilingHeight !== '' ? parseFloat(ceilingHeight as string) : undefined,
      notificationAppliance: finalNotifAppliance || undefined,
      audibilityRequirement: finalAudibility || undefined,
      notificationQty: notificationQty !== '' ? parseFloat(notificationQty as string) : undefined,
      existingSystemStatus: existingSystemStatus || undefined
    };

    if (editingDetectionAreaIndex !== null) {
      setData(prev => {
        const next = [...prev.detectionAreas];
        next[editingDetectionAreaIndex] = area;
        return { ...prev, detectionAreas: next };
      });
      setEditingDetectionAreaIndex(null);
    } else {
      setData(prev => ({ ...prev, detectionAreas: [...prev.detectionAreas, area] }));
    }
    
    // Reset staged data
    setSelectedAreaType('');
    setOtherAreaName('');
    setSelectedCeilingType('');
    setOtherCeilingType('');
    setCeilingHeight('');
    setExistingSystemStatus('');
    setSelectedNotifAppliance('');
    setOtherNotifAppliance('');
    setSelectedAudibility('');
    setOtherAudibility('');
    setNotificationQty('');
    setStagedSmokeCount('');
    setStagedHeatCount('');
    setStagedFlameCount('');
    setStagedGasCount('');
    setStagedMultiSensorCount('');
    setStagedOtherCount('');
    setOtherDetectorType('');
    setStagedImage(null);
    setDeviceType(null);
  };

  /** Duplicate a saved detection area with a new id and add to the list. */
  const copyDetectionArea = (area: DetectionArea) => {
    setData(prev => ({ ...prev, detectionAreas: [...prev.detectionAreas, { ...area, id: Math.random().toString(36).substr(2, 9) }] }));
  };

  /** Load a saved area into the form for editing; Save will replace this entry. */
  const editDetectionArea = (area: DetectionArea, idx: number) => {
    const inList = AREA_NAME_OPTIONS.includes(area.name);
    setSelectedAreaType(inList ? area.name : 'Other');
    setOtherAreaName(inList ? '' : area.name);
    setSelectedCeilingType(area.ceilingType && ['Flat', 'Sloped', 'Open Ceiling', 'Other'].includes(area.ceilingType) ? area.ceilingType : '');
    setOtherCeilingType(area.ceilingType && !['Flat', 'Sloped', 'Open Ceiling', 'Other'].includes(area.ceilingType) ? area.ceilingType : '');
    setCeilingHeight(area.ceilingHeight !== undefined ? String(area.ceilingHeight) : '');
    setExistingSystemStatus(area.existingSystemStatus || '');
    setSelectedNotifAppliance(area.notificationAppliance && ['Horn', 'Strobe', 'Horn-Strobe', 'Other'].includes(area.notificationAppliance) ? area.notificationAppliance : '');
    setOtherNotifAppliance(area.notificationAppliance && !['Horn', 'Strobe', 'Horn-Strobe', 'Other'].includes(area.notificationAppliance) ? area.notificationAppliance : '');
    setSelectedAudibility(area.audibilityRequirement && ['Standard', 'High Noise Area', 'Other'].includes(area.audibilityRequirement) ? area.audibilityRequirement : '');
    setOtherAudibility(area.audibilityRequirement && !['Standard', 'High Noise Area', 'Other'].includes(area.audibilityRequirement) ? area.audibilityRequirement : '');
    setNotificationQty(area.notificationQty !== undefined ? area.notificationQty : '');
    const smokeDev = area.devices.find(d => d.type === 'Smoke');
    const heatDev = area.devices.find(d => d.type === 'Heat');
    const flameDev = area.devices.find(d => d.type === 'Flame');
    const gasDev = area.devices.find(d => d.type === 'Gas');
    const multiDev = area.devices.find(d => d.type === 'Multi-sensor');
    const otherDev = area.devices.find(d => d.type === 'Other');
    setStagedSmokeCount(smokeDev ? String(smokeDev.count) : '');
    setStagedHeatCount(heatDev ? String(heatDev.count) : '');
    setStagedFlameCount(flameDev ? String(flameDev.count) : '');
    setStagedGasCount(gasDev ? String(gasDev.count) : '');
    setStagedMultiSensorCount(multiDev ? String(multiDev.count) : '');
    setStagedOtherCount(otherDev ? String(otherDev.count) : '');
    setOtherDetectorType(otherDev?.otherType ?? '');
    setStagedImage(area.image || null);
    setDeviceType(null);
    setEditingDetectionAreaIndex(idx);
  };

  const startVoiceBuilding = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListeningBuilding(true);
    recognition.onend = () => setIsListeningBuilding(false);
    recognition.onerror = () => setIsListeningBuilding(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      const match = BUILDING_TYPES.find(t => transcript.includes(t.toLowerCase()));
      if (match) {
        setData(prev => ({ ...prev, buildingInfo: { ...prev.buildingInfo, type: match } }));
      }
    };
    recognition.start();
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <header className="p-4 bg-blue-900 flex items-center justify-between shrink-0 text-white shadow-lg z-10">
        <button onClick={handleHeaderBack} className="text-white flex items-center gap-2">
          <i className="fas fa-chevron-left text-lg"></i>
          <span className="font-bold">Fire Alarm Survey</span>
        </button>
        <div className="flex space-x-2">
          {['B', 'D', 'P'].map((s, idx) => {
             const currentIdx = ['BUILDING', 'DETECTION', 'PANEL'].indexOf(step);
             return (
               <div key={s} className={`w-3 h-3 rounded-full ${idx === currentIdx ? 'bg-red-500' : 'bg-blue-700'}`}></div>
             );
          })}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-32 text-slate-900">
        {step === 'BUILDING' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6 mb-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900">Building Information</h3>
                <button 
                  onClick={startVoiceBuilding}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isListeningBuilding ? 'text-red-500 animate-pulse bg-red-50 shadow-inner' : 'text-blue-900 bg-slate-50'}`}
                  aria-label="Voice input building info"
                >
                  <i className="fas fa-microphone text-lg"></i>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {BUILDING_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, type}}))}
                    className={`py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border-2 ${
                      data.buildingInfo.type === type 
                        ? 'bg-blue-900 text-white border-blue-900 shadow-md' 
                        : 'bg-slate-50 border-slate-50 text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {data.buildingInfo.type === 'Other' && (
                <div className="animate-fade-in pt-2 text-left">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Building Type</label>
                  <div className="relative">
                    <input 
                      className={`w-full bg-slate-50 border-2 p-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-[10px] ${showErrors && data.buildingInfo.type === 'Other' && !data.buildingInfo.otherType?.trim() ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
                      value={data.buildingInfo.otherType || ''}
                      autoComplete="off"
                      onChange={(e) => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, otherType: e.target.value}}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherBuildingType', (val) => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, otherType: val}})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherBuildingType' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-100 text-left grid grid-cols-1 md:grid-cols-2 md:gap-6 md:space-y-0">
                <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-4 md:col-span-2">Site Specifications</h4>
               <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 ml-1">Status</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={() => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, isNew: true}}))}
                     className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${data.buildingInfo.isNew === true ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                   >
                     NEW BUILD
                   </button>
                   <button
                     onClick={() => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, isNew: false}}))}
                     className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${data.buildingInfo.isNew === false ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                   >
                     RETROFIT
                   </button>
                 </div>
               </div>

               <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 ml-1">Floors</label>
                 <div className="relative">
                   <input 
                     type="number" step="any" min="0"
                     className="w-full py-3 bg-slate-50 border-2 border-slate-100 px-4 pr-10 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900 text-[10px]"
                     value={data.buildingInfo.floors === 0 ? '' : data.buildingInfo.floors}
                     onChange={e => {
                       const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                       setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, floors: isNaN(val) ? 0 : Math.max(0, val)}}));
                     }}
                   />
                   <button 
                     type="button"
                     onClick={() => startVoiceInput('floors', (val) => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, floors: val}})), true)}
                     className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'floors' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                   >
                     <i className="fas fa-microphone"></i>
                   </button>
                 </div>
               </div>
            </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-4 text-left">4.3 Floor Plan & Measurements</h4>
                <FloorPlanManager 
                  initialData={data.measurements}
                  onChange={(m) => setData(prev => ({...prev, measurements: m}))}
                  onNewUpload={onNewFloorPlan}
                  activeVoiceField={activeVoiceField}
                  startVoiceInput={startVoiceInput}
                />
              </div>
            </div>
            
            <div className="pb-10">
              <button 
                onClick={() => {
                  if (!isStep1Complete) {
                    setShowErrors(true);
                  } else {
                    setStep('DETECTION');
                  }
                }}
                className={`w-full py-6 font-black rounded-xl uppercase tracking-widest transition text-[10px] ${isStep1Complete ? 'bg-blue-900 text-white shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT: DETECTION DETAILS
              </button>
              {showErrors && !isStep1Complete && (
                <p className="text-[10px] text-red-500 font-black text-center mt-3 uppercase tracking-widest animate-pulse">
                  Complete building specifications to proceed
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'DETECTION' && (
           <div className="animate-fade-in space-y-6">
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Site Reference Photo</label>
                    <div className="mt-2">
                      {stagedImage ? (
                        <div className="relative group">
                          <img src={stagedImage} className="w-full aspect-video object-cover rounded-2xl border-2 border-slate-100 shadow-sm max-h-[140px]" alt="Zone Reference" />
                          <button 
                            onClick={() => setStagedImage(null)}
                            className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full aspect-video max-h-[140px] border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition bg-white text-slate-400 shadow-inner">
                          <i className="fas fa-camera text-3xl mb-2"></i>
                          <span className="text-[10px] font-black uppercase tracking-tight">Capture / Upload Photo</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                 </div>

                 <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">SELECT AREA NAME</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['Office', 'Electrical', 'Kitchen', 'Storage', 'Server Room', 'Other'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSelectedAreaType(opt)}
                          className={`py-4 rounded-xl font-black border-2 text-[10px] transition ${selectedAreaType === opt ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {opt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {selectedAreaType === 'Other' && (
                      <div className="relative mt-2 animate-fade-in">
                        <input 
                          placeholder="Specify Area Name"
                          className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                          value={otherAreaName}
                          onChange={e => setOtherAreaName(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('otherAreaName', setOtherAreaName)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherAreaName' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    )}
                 </div>

                 <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">SCOPE STATUS</label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {['New System', 'Expansion', 'Replacement'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setExistingSystemStatus(opt)}
                          className={`py-4 rounded-xl font-black border-2 text-[10px] transition ${existingSystemStatus === opt ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {opt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                 </div>

                 <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">CEILING TYPE</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['Flat', 'Sloped', 'Open Ceiling', 'Other'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSelectedCeilingType(opt)}
                          className={`py-4 rounded-xl font-black border-2 text-[10px] transition ${selectedCeilingType === opt ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {opt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {selectedCeilingType === 'Other' && (
                      <div className="relative mt-2 animate-fade-in">
                        <input 
                          placeholder="Specify Ceiling Type"
                          className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                          value={otherCeilingType}
                          onChange={e => setOtherCeilingType(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('otherCeilingType', setOtherCeilingType)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCeilingType' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    )}
                 </div>

                 <div className="pt-2 border-t border-slate-200 text-left">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">CEILING HEIGHT (M)</label>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        step="0.1"
                        className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                        value={ceilingHeight}
                        onChange={e => setCeilingHeight(e.target.value === '' ? '' : e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('ceilingHeight', setCeilingHeight, true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'ceilingHeight' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                 </div>

                 <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">ADD DETECTOR TYPE</label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(['Smoke', 'Heat', 'Flame', 'Gas', 'Multi-sensor', 'Other'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setDeviceType(type)}
                          className={`py-4 rounded-xl font-black border-2 text-[10px] transition shadow-sm ${deviceType === type ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {type === 'Multi-sensor' ? 'MULTI-SENSOR' : type.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {deviceType === 'Other' && (
                      <div className="mt-2 animate-fade-in">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Specify detector type</label>
                        <div className="relative">
                          <input 
                            placeholder="Specify Detector Type"
                            className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                            value={otherDetectorType}
                            onChange={e => setOtherDetectorType(e.target.value)}
                            autoComplete="off"
                          />
                          <button 
                            type="button"
                            onClick={() => startVoiceInput('otherDetectorType', setOtherDetectorType)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherDetectorType' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      </div>
                    )}
                 </div>

                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                    <h4 className="text-[10px] font-black text-red-600 tracking-widest uppercase">Detection System Logic</h4>
                    <div className="flex gap-2">
                      {['Conventional', 'Addressable', 'Wireless'].map(t => (
                        <button 
                         key={t}
                         onClick={() => setData(prev => ({...prev, systemType: t as any}))}
                         className={`flex-1 py-4 text-[10px] font-black rounded-xl transition border-2 ${data.systemType === t ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}
                        >{t.toUpperCase()}</button>
                      ))}
                    </div>
                 </div>

                 {/* Detector Quantity */}
                 <div className="pt-2 border-t border-slate-200 text-left">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">DETECTOR QUANTITY ({deviceType ? (deviceType === 'Multi-sensor' ? 'MULTI-SENSOR' : deviceType.toUpperCase()) : 'SELECT TYPE'})</label>
                    <div className="relative mt-1">
                      <input 
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px] shadow-inner"
                        value={(deviceType === 'Smoke' ? stagedSmokeCount : deviceType === 'Heat' ? stagedHeatCount : deviceType === 'Flame' ? stagedFlameCount : deviceType === 'Gas' ? stagedGasCount : deviceType === 'Multi-sensor' ? stagedMultiSensorCount : deviceType === 'Other' ? stagedOtherCount : '') ?? ''}
                        onChange={e => {
                          if (!deviceType) return;
                          const rawVal = e.target.value;
                          const digitsOnly = rawVal.replace(/\D/g, '');
                          if (deviceType === 'Smoke') setStagedSmokeCount(digitsOnly);
                          else if (deviceType === 'Heat') setStagedHeatCount(digitsOnly);
                          else if (deviceType === 'Flame') setStagedFlameCount(digitsOnly);
                          else if (deviceType === 'Gas') setStagedGasCount(digitsOnly);
                          else if (deviceType === 'Multi-sensor') setStagedMultiSensorCount(digitsOnly);
                          else if (deviceType === 'Other') setStagedOtherCount(digitsOnly);
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (!deviceType) return;
                          startVoiceInput('stagedDetectorCount', (val) => {
                            const intVal = Math.max(0, Math.floor(val));
                            const str = intVal > 0 ? String(intVal) : '';
                            if (deviceType === 'Smoke') setStagedSmokeCount(str);
                            else if (deviceType === 'Heat') setStagedHeatCount(str);
                            else if (deviceType === 'Flame') setStagedFlameCount(str);
                            else if (deviceType === 'Gas') setStagedGasCount(str);
                            else if (deviceType === 'Multi-sensor') setStagedMultiSensorCount(str);
                            else if (deviceType === 'Other') setStagedOtherCount(str);
                          }, true);
                        }}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'stagedDetectorCount' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                 </div>

                 <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">NOTIFICATION APPLIANCE</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['Horn', 'Strobe', 'Horn-Strobe', 'Other'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSelectedNotifAppliance(opt)}
                          className={`py-4 rounded-xl font-black border-2 text-[10px] transition ${selectedNotifAppliance === opt ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {opt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {selectedNotifAppliance === 'Other' && (
                      <div className="relative mt-2 animate-fade-in">
                        <input 
                          placeholder="Specify Appliance Type"
                          className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                          value={otherNotifAppliance}
                          onChange={e => setOtherNotifAppliance(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('otherNotifAppliance', setOtherNotifAppliance)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherNotifAppliance' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    )}
                 </div>

                 <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">AUDIBILITY REQUIREMENT</label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {['Standard', 'High Noise Area', 'Other'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSelectedAudibility(opt)}
                          className={`py-4 rounded-xl font-black border-2 text-[10px] transition ${selectedAudibility === opt ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {opt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {selectedAudibility === 'Other' && (
                      <div className="relative mt-2 animate-fade-in">
                        <input 
                          placeholder="Specify Audibility Requirement"
                          className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                          value={otherAudibility}
                          onChange={e => setOtherAudibility(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('otherAudibility', setOtherAudibility)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherAudibility' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    )}
                 </div>

                 <div className="pt-2 border-t border-slate-200 text-left">
                    <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">NOTIFICATION QUANTITY</label>
                    <div className="relative mt-1">
                      <input 
                        type="number"
                        step="1"
                        min="0"
                        className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                        value={notificationQty}
                        onChange={e => {
                          const rawVal = e.target.value;
                          if (rawVal === '') {
                            setNotificationQty('');
                            return;
                          }
                          const val = parseInt(rawVal, 10);
                          const num = isNaN(val) ? 0 : Math.max(0, val);
                          setNotificationQty(num);
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('notificationQty', (val) => setNotificationQty(Math.floor(val)), true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'notificationQty' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-100">
                   <button 
                     onClick={finalizeZone}
                     disabled={!(selectedAreaType === 'Other' ? otherAreaName : selectedAreaType) || !data.systemType || ([stagedSmokeCount, stagedHeatCount, stagedFlameCount, stagedGasCount, stagedMultiSensorCount, stagedOtherCount].every(s => (parseInt(s, 10) || 0) === 0))}
                     className={`w-full py-4 font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px] ${(selectedAreaType === 'Other' ? otherAreaName : selectedAreaType) && data.systemType && ([stagedSmokeCount, stagedHeatCount, stagedFlameCount, stagedGasCount, stagedMultiSensorCount, stagedOtherCount].some(s => (parseInt(s, 10) || 0) > 0)) ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                   >
                     {editingDetectionAreaIndex !== null ? 'UPDATE FIRE ALARM ENTRY' : 'SAVE FIRE ALARM ENTRY'}
                   </button>
                 </div>
              </div>

              {/* Fire Alarm Units list - same pattern as CCTV Units */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Fire Alarm Units ({data.detectionAreas.length})</h3>
                </div>

                {data.detectionAreas.length === 0 ? (
                  <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    No fire alarm units mapped yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.detectionAreas.map((area, idx) => {
                      const deviceLabels = area.devices.map(d => d.type === 'Other' && d.otherType ? `${d.count} ${d.otherType}` : `${d.count} ${d.type}`);
                      return (
                        <div key={area.id} className="bg-slate-50 p-4 rounded-xl border-l-4 border-blue-900 shadow-sm flex justify-between items-center text-left">
                          <div className="flex items-center gap-4">
                            {area.image && (
                              <img src={area.image} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Zone" />
                            )}
                            <div>
                              <p className="font-black text-blue-900 uppercase text-[10px]">{area.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">
                                {deviceLabels.length > 0 ? deviceLabels.join(' • ') : 'No devices'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => copyDetectionArea(area)} className="text-blue-600 min-w-[2.5rem] h-10 px-3 hover:bg-blue-50 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Copy unit" title="Copy">
                              Copy
                            </button>
                            <button onClick={() => editDetectionArea(area, idx)} className="text-slate-600 min-w-[2.5rem] h-10 px-3 hover:bg-slate-100 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Edit unit" title="Edit">
                              Edit
                            </button>
                            <button 
                              onClick={() => {
                                setData(prev => ({...prev, detectionAreas: prev.detectionAreas.filter(a => a.id !== area.id)}));
                                if (editingDetectionAreaIndex === idx) {
                                  setEditingDetectionAreaIndex(null);
                                  setSelectedAreaType(''); setOtherAreaName(''); setSelectedCeilingType(''); setOtherCeilingType(''); setCeilingHeight('');
                                  setExistingSystemStatus(''); setSelectedNotifAppliance(''); setOtherNotifAppliance(''); setSelectedAudibility(''); setOtherAudibility('');
                                  setNotificationQty(''); setStagedSmokeCount(''); setStagedHeatCount(''); setStagedFlameCount(''); setStagedGasCount(''); setStagedMultiSensorCount(''); setStagedOtherCount(''); setOtherDetectorType('');
                                  setStagedImage(null); setDeviceType(null);
                                } else if (editingDetectionAreaIndex !== null && idx < editingDetectionAreaIndex) {
                                  setEditingDetectionAreaIndex(editingDetectionAreaIndex - 1);
                                }
                              }}
                              className="text-red-500 w-10 h-10 hover:bg-red-50 rounded-full transition flex items-center justify-center"
                              aria-label="Delete unit"
                              title="Delete"
                            >
                              <i className="fas fa-trash text-sm"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3 pb-10">
                <button 
                  disabled={data.detectionAreas.length === 0}
                  onClick={() => setStep('PANEL')}
                  className={`w-full py-6 font-black rounded-xl shadow-lg transition active:scale-95 uppercase tracking-widest text-[10px] ${data.detectionAreas.length > 0 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  NEXT: CONTROL PANEL
                </button>
                <button onClick={() => setStep('BUILDING')} className="w-full text-blue-600 font-black uppercase text-[10px] tracking-widest py-4 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition">Back to Building</button>
              </div>
           </div>
        )}

        {step === 'PANEL' && (
          <div className="animate-fade-in space-y-6 pb-12">
            <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-tight text-left">FACP & INFRASTRUCTURE</h3>
            
            <div className="space-y-4 text-left">
              {/* NEW CABLE TYPE FIELD */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-2">Cable Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['FR Cable', 'FPL', 'Shielded', 'Other'].map(type => (
                    <button
                      key={type}
                      onClick={() => setData(prev => ({
                        ...prev, 
                        infrastructure: { ...prev.infrastructure, cableType: type }
                      }))}
                      className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${data.infrastructure.cableType === type ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONDITIONAL OTHER CABLE TYPE INPUT */}
              {data.infrastructure.cableType === 'Other' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Cable Type</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none transition text-[10px]"
                      value={data.infrastructure.otherCableType || ''}
                      placeholder="Specify Cable Type"
                      onChange={(e) => setData(prev => ({
                        ...prev, 
                        infrastructure: { ...prev.infrastructure, otherCableType: e.target.value }
                      }))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherCableType', (val) => setData(prev => ({
                        ...prev, 
                        infrastructure: { ...prev.infrastructure, otherCableType: val }
                      })))}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCableType' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone text-lg"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* NEW ROUTING METHOD FIELD */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-2">Routing Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Ceiling', 'Conduit', 'Trunking', 'Other'].map(method => (
                    <button
                      key={method}
                      onClick={() => setData(prev => ({
                        ...prev, 
                        infrastructure: { ...prev.infrastructure, routing: method }
                      }))}
                      className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${data.infrastructure.routing === method ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                    >
                      {method.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONDITIONAL OTHER ROUTING INPUT */}
              {data.infrastructure.routing === 'Other' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Routing Method</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none transition text-[10px]"
                      value={data.infrastructure.otherRouting || ''}
                      placeholder="Specify Routing Method"
                      onChange={(e) => setData(prev => ({
                        ...prev, 
                        infrastructure: { ...prev.infrastructure, otherRouting: e.target.value }
                      }))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherRouting', (val) => setData(prev => ({
                        ...prev, 
                        infrastructure: { ...prev.infrastructure, otherRouting: val }
                      })))}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherRouting' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone text-lg"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* NEW ESTIMATED CABLE LENGTH FIELD */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Estimated Cable Length (meters)</label>
                <div className="relative mt-1">
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                    value={data.infrastructure.cableLength}
                    onChange={e => {
                      const val = e.target.value;
                      setData(prev => ({...prev, infrastructure: {...prev.infrastructure, cableLength: val as any}}));
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('cableLength', (val) => setData(prev => ({...prev, infrastructure: {...prev.infrastructure, cableLength: val}})), true)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'cableLength' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">FACP Final Location</label>
                <div className="relative mt-1">
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-[10px]"
                    value={data.controlPanel.location}
                    onChange={e => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, location: e.target.value}}))}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('facpLocation', (val) => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, location: val}})))}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'facpLocation' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                  >
                    <i className="fas fa-microphone text-lg"></i>
                  </button>
                </div>
              </div>

              {[
                { label: 'Equipment Rack Available?', key: 'rackAvailable' },
                { label: 'Dedicated Power Socket?', key: 'powerAvailable' },
                { label: 'Ups/Backup Requireds?', key: 'upsRequired' },
                { label: 'Network Connection?', key: 'networkRequired' },
              ].map(item => (
                <div key={item.key} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-700">{item.label}</span>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, [item.key]: true}}))}
                      className={`px-5 py-2 rounded-lg text-[10px] font-black transition ${data.controlPanel[item.key as keyof typeof data.controlPanel] === true ? 'bg-blue-900 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400'}`}
                    >
                      YES
                    </button>
                    <button 
                      onClick={() => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, [item.key]: false}}))}
                      className={`px-5 py-2 rounded-lg text-[10px] font-black transition ${data.controlPanel[item.key as keyof typeof data.controlPanel] === false ? 'bg-red-600 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400'}`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-10 space-y-3 pb-10">
              <button 
                onClick={() => {
                   if (data.controlPanel.rackAvailable === undefined || data.controlPanel.powerAvailable === undefined) {
                     alert("Please answer all Infrastructure requirements.");
                     return;
                   }
                   if (!data.infrastructure.cableType) {
                     alert("Please select a Cable Type.");
                     return;
                   }
                   if (!data.infrastructure.routing) {
                     alert("Please select a Routing Method.");
                     return;
                   }
                   onComplete(data);
                }}
                className="w-full py-4 bg-amber-500 text-blue-900 font-black rounded-xl shadow-xl uppercase tracking-widest text-[10px] active:scale-95 transition"
              >
                GENERATE ESTIMATION
              </button>
              <button onClick={() => setStep('DETECTION')} className="w-full text-blue-600 font-bold py-2 uppercase text-[10px] tracking-widest">Back to Zones</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FireAlarmSurvey;