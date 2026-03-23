import React, { useState, useEffect, useRef } from 'react';
import { AccessControlSurveyData, AccessControlDoor } from '../types';
import { BUILDING_TYPES } from '../constants';
import { processNumeric, processTitleCase } from '../utils/voiceProcessing';
import FloorPlanManager from './12_FloorPlanManager';

interface Props {
  /** Receives current draft so it can be restored when returning. */
  onBack: (draft?: AccessControlSurveyData) => void;
  onComplete: (data: AccessControlSurveyData) => void;
  onNewFloorPlan?: () => void;
  initialData?: AccessControlSurveyData;
}

const AccessControlSurvey: React.FC<Props> = ({ onBack, onComplete, onNewFloorPlan, initialData }) => {
  const [step, setStep] = useState<'BUILDING' | 'DOORS' | 'INFRA'>('BUILDING');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<AccessControlSurveyData>({
    buildingInfo: { type: '', otherType: '', floors: 0, isNew: undefined as any },
    doors: [],
    infrastructure: { cableType: '', cablePath: '', powerPath: '' },
    controller: { 
      location: '', 
      estimatedCableLength: undefined,
      poeAvailable: undefined,
      redundantControllers: undefined,
      additionalHardware: '', 
      wiringNotes: '', 
      powerAvailable: undefined, 
      upsRequired: undefined, 
      networkRequired: undefined,
      fireRatedDoor: undefined
    }
  });

  const [currentDoor, setCurrentDoor] = useState<Partial<AccessControlDoor>>({
    name: '',
    location: '',
    doorType: undefined,
    operation: undefined,
    doorAutomation: undefined,
    accessMethod: [],
    accessMethodCapacity: '',
    mountingSurface: '',
    otherMountingSurface: '',
    lockType: undefined,
    lockPowerType: '',
    wireType: undefined as any,
    doorMaterial: undefined,
    environment: undefined,
    wallType: undefined,
    otherWallType: '',
    image: undefined
  });

  const [otherAccessMethod, setOtherAccessMethod] = useState('');
  const [otherLockType, setOtherLockType] = useState('');
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [isListeningBuilding, setIsListeningBuilding] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [editingDoorIndex, setEditingDoorIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) setData(initialData);
  }, [initialData]);

  /**
   * SCROLL RESET EFFECT
   * Ensures that whenever the technician advances or goes back a step, 
   * the view resets to the top.
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [step]);

  /**
   * COMPUTED: isStep1Complete
   */
  const isStep1Complete = !!data.buildingInfo.type && (data.buildingInfo.type !== 'Other' || !!data.buildingInfo.otherType?.trim());

  const handleHeaderBack = () => {
    if (step === 'INFRA') {
      setStep('DOORS');
    } else if (step === 'DOORS') {
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
        setCurrentDoor(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
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

  const toggleAccessMethod = (method: string) => {
    setCurrentDoor(prev => {
      const current = prev.accessMethod || [];
      const isSelecting = !current.includes(method);
      if (method === 'Other' && !isSelecting) {
        setOtherAccessMethod('');
      }
      const updated = isSelecting
        ? [...current, method]
        : current.filter(m => m !== method);
      return { ...prev, accessMethod: updated };
    });
  };

  const addDoor = () => {
    if (!currentDoor.location || !currentDoor.doorType || !currentDoor.lockType || (currentDoor.accessMethod?.length === 0)) {
       alert("Please complete Door Location, Type, Lock, and Access Methods.");
       return;
    }
    
    // Process Access Methods to include Other text if specified
    const finalAccessMethods = (currentDoor.accessMethod || []).map(m => 
      m === 'Other' && otherAccessMethod.trim() ? `Other: ${otherAccessMethod.trim()}` : m
    );

    // Process Lock Type to include Other text if specified
    const finalLockType = currentDoor.lockType === 'Other' && otherLockType.trim()
      ? `Other: ${otherLockType.trim()}`
      : currentDoor.lockType;

    const door: AccessControlDoor = {
      id: editingDoorIndex !== null ? data.doors[editingDoorIndex].id : Math.random().toString(36).substr(2, 9),
      ...(currentDoor as AccessControlDoor),
      accessMethod: finalAccessMethods,
      lockType: finalLockType as any,
      name: currentDoor.location
    };
    if (editingDoorIndex !== null) {
      setData(prev => ({
        ...prev,
        doors: prev.doors.map((d, i) => (i === editingDoorIndex ? door : d))
      }));
      setEditingDoorIndex(null);
    } else {
      setData(prev => ({ ...prev, doors: [...prev.doors, door] }));
    }
    setCurrentDoor({
      name: '',
      location: '',
      doorType: undefined,
      operation: undefined,
      doorAutomation: undefined,
      accessMethod: [],
      accessMethodCapacity: '',
      mountingSurface: '',
      otherMountingSurface: '',
      lockType: undefined,
      lockPowerType: '',
      wireType: 'Low Voltage Power' as any,
      doorMaterial: undefined,
      environment: undefined,
      wallType: undefined,
      otherWallType: '',
      image: undefined
    });
    setOtherAccessMethod('');
    setOtherLockType('');
  };

  const copyDoorEntry = (door: AccessControlDoor) => {
    setData(prev => ({
      ...prev,
      doors: [...prev.doors, { ...door, id: Math.random().toString(36).substr(2, 9) }]
    }));
  };

  const editDoorEntry = (door: AccessControlDoor, idx: number) => {
    const otherM = door.accessMethod.find(m => m.startsWith('Other:'));
    const otherL = door.lockType?.startsWith('Other:');
    setCurrentDoor({
      ...door,
      accessMethod: door.accessMethod.map(m => (m.startsWith('Other:') ? 'Other' : m)),
      lockType: otherL ? 'Other' : door.lockType
    });
    setOtherAccessMethod(otherM ? otherM.replace(/^Other:\s*/, '') : '');
    setOtherLockType(otherL ? (door.lockType || '').replace(/^Other:\s*/, '') : '');
    setEditingDoorIndex(idx);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <header className="p-4 bg-blue-900 flex items-center justify-between shrink-0 text-white shadow-lg z-10">
        <button onClick={handleHeaderBack} className="text-white flex items-center gap-2 text-left">
          <i className="fas fa-chevron-left text-lg"></i>
          <span className="font-black uppercase tracking-tight text-xs">ACCESS CONTROL SURVEY</span>
        </button>
        <div className="flex space-x-2">
          {['B', 'D', 'I'].map((s, idx) => {
             const currentIdx = ['BUILDING', 'DOORS', 'INFRA'].indexOf(step);
             return (
               <div key={s} className={`w-3 h-3 rounded-full ${idx === currentIdx ? 'bg-amber-400' : 'bg-blue-700'}`}></div>
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
                     className="w-full py-3 bg-slate-50 border-2 border-slate-100 px-4 pr-10 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900"
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
                    setStep('DOORS');
                  }
                }}
                className={`w-full py-6 font-black rounded-xl uppercase tracking-widest transition text-[10px] ${isStep1Complete ? 'bg-blue-900 text-white shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT: DOOR MAPPING
              </button>
              {showErrors && !isStep1Complete && (
                <p className="text-[10px] text-red-500 font-black text-center mt-3 uppercase tracking-widest animate-pulse">
                  Complete building specifications to proceed
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'DOORS' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Site Reference Photo</label>
                <div className="mt-2">
                  {currentDoor.image ? (
                    <div className="relative group">
                      <img src={currentDoor.image} className="w-full aspect-video object-cover rounded-2xl border-2 border-slate-100 shadow-sm max-h-[140px]" alt="Door Reference" />
                      <button 
                        onClick={() => setCurrentDoor(prev => ({ ...prev, image: undefined }))}
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

              <div className="grid grid-cols-1 gap-4">
                <div className="text-left">
                  <label className="text-[10px] font-black text-blue-900 uppercase ml-1">Door Location Name</label>
                  <div className="relative mt-1">
                    <input 
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none"
                      value={currentDoor.location}
                      onChange={e => setCurrentDoor(prev => ({...prev, location: e.target.value}))}
                    />
                    <button 
                      onClick={() => startVoiceInput('doorLocation', (val) => setCurrentDoor(prev => ({...prev, location: val})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'doorLocation' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Door Location</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Indoor', 'Outdoor'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCurrentDoor(prev => ({...prev, environment: opt as any}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentDoor.environment === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Door Type</label>
                  <div className="flex bg-white p-1 rounded-xl mt-1 border border-slate-200 shadow-inner">
                    {(['Single', 'Double'] as const).map(t => (
                      <button 
                        key={t}
                        onClick={() => setCurrentDoor(prev => ({...prev, doorType: t}))}
                        className={`flex-1 py-3 text-[10px] font-black rounded-lg transition ${currentDoor.doorType === t ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400'}`}
                      >{t.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Automation</label>
                  <div className="flex bg-white p-1 rounded-xl mt-1 border border-slate-200 shadow-inner">
                    {(['Manual', 'Automated'] as const).map(a => (
                      <button 
                        key={a}
                        onClick={() => setCurrentDoor(prev => ({...prev, doorAutomation: a}))}
                        className={`flex-1 py-3 text-[10px] font-black rounded-lg transition ${currentDoor.doorAutomation === a ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400'}`}
                      >{a.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Door Operation</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Swinging', 'Sliding', 'Revolving', 'Rolling'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCurrentDoor(prev => ({...prev, operation: opt as any}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentDoor.operation === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Door Material</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['Wood', 'Metal', 'Glass'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCurrentDoor(prev => ({...prev, doorMaterial: opt as any}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentDoor.doorMaterial === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lock Type</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['Electric strike', 'Magnetic lock', 'Mechanical lock', 'Other'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => {
                          setCurrentDoor(prev => ({...prev, lockType: opt as any}));
                          if (opt !== 'Other') setOtherLockType('');
                        }}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentDoor.lockType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {currentDoor.lockType === 'Other' && (
                    <div className="relative mt-2 animate-fade-in">
                      <input 
                        placeholder="Specify Lock Type"
                        className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                        value={otherLockType}
                        onChange={e => setOtherLockType(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherLockType', setOtherLockType)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherLockType' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Power Type for Locks</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['12V', '24V', 'PoE'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCurrentDoor(prev => ({...prev, lockPowerType: opt as any}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentDoor.lockPowerType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Access Methods (Select Multiple)</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['RFID', 'Fingerprint', 'Pin code', 'Other'].map(method => (
                      <button
                        key={method}
                        onClick={() => toggleAccessMethod(method)}
                        className={`py-3 rounded-xl text-[10px] font-black transition border-2 ${currentDoor.accessMethod?.includes(method) ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                        {method.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {currentDoor.accessMethod?.includes('Other') && (
                    <div className="relative mt-2 animate-fade-in">
                      <input 
                        placeholder="Specify Access Method"
                        className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                        value={otherAccessMethod}
                        onChange={e => setOtherAccessMethod(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherAccessMethod', setOtherAccessMethod)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherAccessMethod' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Access Method Capacity</label>
                  <div className="relative mt-1">
                    <input 
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={currentDoor.accessMethodCapacity}
                      onChange={e => setCurrentDoor(prev => ({...prev, accessMethodCapacity: e.target.value}))}
                    />
                    <button 
                      onClick={() => startVoiceInput('accessMethodCapacity', (val) => setCurrentDoor(prev => ({...prev, accessMethodCapacity: val})), true)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'accessMethodCapacity' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Wall Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(['Concrete', 'Gypsum', 'Glass', 'Steel', 'Brick', 'Other'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setCurrentDoor((prev) => ({
                          ...prev,
                          wallType: opt,
                          otherWallType: opt === 'Other' ? (prev.otherWallType || '') : '',
                        }))
                      }
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${
                        currentDoor.wallType === opt
                          ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {currentDoor.wallType === 'Other' && (
                  <div className="relative mt-2 animate-fade-in">
                    <input
                      placeholder="Specify Wall Type"
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl font-bold text-xs focus:border-blue-900 outline-none"
                      value={currentDoor.otherWallType || ''}
                      onChange={(e) => setCurrentDoor((prev) => ({ ...prev, otherWallType: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        startVoiceInput('otherWallTypeDoor', (val) =>
                          setCurrentDoor((prev) => ({ ...prev, otherWallType: val }))
                        )
                      }
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${
                        activeVoiceField === 'otherWallTypeDoor' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'
                      }`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mounting Surface</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['Flat', 'Curved', 'Reinforced', 'Concrete', 'Glass', 'Other'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCurrentDoor(prev => ({...prev, mountingSurface: opt}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentDoor.mountingSurface === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {currentDoor.mountingSurface === 'Other' && (
                  <div className="relative mt-2 animate-fade-in">
                    <input 
                      placeholder="Specify Mounting Surface"
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl font-bold text-xs focus:border-blue-900 outline-none"
                      value={currentDoor.otherMountingSurface || ''}
                      onChange={e => setCurrentDoor(prev => ({...prev, otherMountingSurface: e.target.value}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherMountingSurfaceDoor', (val) => setCurrentDoor(prev => ({...prev, otherMountingSurface: val})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherMountingSurfaceDoor' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={addDoor}
                  disabled={!currentDoor.location || !currentDoor.doorType || !currentDoor.lockType || (currentDoor.accessMethod?.length === 0)}
                  className="w-full py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px] disabled:opacity-30 disabled:bg-slate-200 disabled:shadow-none"
                >
                  {editingDoorIndex !== null ? 'UPDATE ACCESS CONTROL ENTRY' : 'SAVE ACCESS CONTROL ENTRY'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Access Control Units ({data.doors.length})</h3>
              </div>
              {data.doors.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No access control units mapped yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.doors.map((door, idx) => (
                    <div key={door.id} className="bg-slate-50 p-4 rounded-xl border-l-4 border-blue-900 shadow-sm flex justify-between items-center text-left">
                      <div className="flex items-center gap-4">
                        {door.image && (
                          <img src={door.image} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Door" />
                        )}
                        <div>
                          <p className="font-black text-blue-900 uppercase text-[10px]">{door.location}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{door.lockType}</p>
                          <p className="text-[7px] font-black text-slate-400 uppercase mt-0.5">{door.doorType} {door.operation} • {door.accessMethod?.join(', ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => copyDoorEntry(door)} className="text-blue-600 min-w-[2.5rem] h-10 px-3 hover:bg-blue-50 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Copy door" title="Copy">
                          Copy
                        </button>
                        <button onClick={() => editDoorEntry(door, idx)} className="text-slate-600 min-w-[2.5rem] h-10 px-3 hover:bg-slate-100 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Edit door" title="Edit">
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setData(prev => ({ ...prev, doors: prev.doors.filter((_, i) => i !== idx) }));
                            if (editingDoorIndex === idx) {
                              setEditingDoorIndex(null);
                              setCurrentDoor({ name: '', location: '', doorType: undefined, operation: undefined, doorAutomation: undefined, accessMethod: [], accessMethodCapacity: '', mountingSurface: '', otherMountingSurface: '', lockType: undefined, lockPowerType: '', wireType: 'Low Voltage Power' as any, doorMaterial: undefined, environment: undefined, wallType: undefined, otherWallType: '', image: undefined });
                              setOtherAccessMethod('');
                              setOtherLockType('');
                            } else if (editingDoorIndex !== null && idx < editingDoorIndex) {
                              setEditingDoorIndex(editingDoorIndex - 1);
                            }
                          }}
                          className="text-red-500 w-10 h-10 hover:bg-red-50 rounded-full transition flex items-center justify-center"
                          aria-label="Delete door"
                          title="Delete"
                        >
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-10 space-y-3 pb-10">
              <button 
                disabled={data.doors.length === 0}
                onClick={() => setStep('INFRA')}
                className={`w-full py-4 font-black rounded-xl shadow-xl uppercase tracking-widest transition ${data.doors.length > 0 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT: INFRASTRUCTURE
              </button>
              <button onClick={() => setStep('BUILDING')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest">Back</button>
            </div>
          </div>
        )}

        {step === 'INFRA' && (
          <div className="animate-fade-in space-y-6 pb-12">
            <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight text-left">Controller & Cables</h3>
            
            <div className="space-y-4">
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Controller Location</label>
                <div className="relative mt-1">
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold"
                    value={data.controller.location}
                    onChange={e => setData(prev => ({...prev, controller: {...prev.controller, location: e.target.value}}))}
                  />
                  <button 
                    onClick={() => startVoiceInput('ctrlLoc', (val) => setData(prev => ({...prev, controller: {...prev.controller, location: val}})))}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'ctrlLoc' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estimated Cable Length (meters)</label>
                <div className="relative mt-1">
                  <input 
                    type="number"
                    step="1"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold focus:outline-none focus:border-blue-900 transition"
                    value={data.controller.estimatedCableLength ?? ''}
                    onChange={e => {
                      const rawVal = e.target.value;
                      const val = rawVal === '' ? undefined : parseInt(rawVal, 10);
                      setData(prev => ({...prev, controller: {...prev.controller, estimatedCableLength: isNaN(val as any) ? undefined : Math.max(0, val!)}}));
                    }}
                  />
                  <button 
                    onClick={() => startVoiceInput('estCableLen', (val) => {
                      const num = Math.floor(val);
                      setData(prev => ({...prev, controller: {...prev.controller, estimatedCableLength: isNaN(num) ? undefined : Math.max(0, num)}}));
                    }, true)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'estCableLen' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Redundant Controllers Required?</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setData(prev => ({...prev, controller: {...prev.controller, redundantControllers: true}}))}
                    className={`px-5 py-3 rounded-lg text-[10px] font-black transition ${data.controller.redundantControllers === true ? 'bg-blue-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}
                  >YES</button>
                  <button 
                    onClick={() => setData(prev => ({...prev, controller: {...prev.controller, redundantControllers: false}}))}
                    className={`px-5 py-3 rounded-lg text-[10px] font-black transition ${data.controller.redundantControllers === false ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}
                  >NO</button>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Fire-Rated Door</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setData(prev => ({...prev, controller: {...prev.controller, fireRatedDoor: true}}))}
                    className={`px-5 py-3 rounded-lg text-[10px] font-black transition ${data.controller.fireRatedDoor === true ? 'bg-blue-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}
                  >YES</button>
                  <button 
                    onClick={() => setData(prev => ({...prev, controller: {...prev.controller, fireRatedDoor: false}}))}
                    className={`px-5 py-3 rounded-lg text-[10px] font-black transition ${data.controller.fireRatedDoor === false ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}
                  >NO</button>
                </div>
              </div>

              {[
                { label: 'Network Port Ready', key: 'networkRequired' },
                { label: 'PoE Available?', key: 'poeAvailable' },
                { label: 'UPS Backup Needed', key: 'upsRequired' }
              ].map(item => (
                <div key={item.key} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  <div className="flex gap-2">
                     <button 
                      onClick={() => setData(prev => ({...prev, controller: {...prev.controller, [item.key as keyof typeof data.controller] : true}}))}
                      className={`px-5 py-3 rounded-lg text-[10px] font-black transition ${data.controller[item.key as keyof typeof data.controller] === true ? 'bg-blue-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}
                     >YES</button>
                     <button 
                      onClick={() => setData(prev => ({...prev, controller: {...prev.controller, [item.key as keyof typeof data.controller] : false}}))}
                      className={`px-5 py-3 rounded-lg text-[10px] font-black transition ${data.controller[item.key as keyof typeof data.controller] === false ? (item.key === 'poeAvailable' ? 'bg-red-600 text-white shadow-md' : 'bg-red-600 text-white shadow-md') : 'bg-white border border-slate-200 text-slate-400'}`}
                     >NO</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-10 space-y-3 pb-10">
              <button 
                onClick={() => {
                   if (data.controller.networkRequired === undefined || data.controller.upsRequired === undefined) {
                      alert("Please complete Infrastructure requirements.");
                      return;
                   }
                   onComplete(data);
                }}
                className="w-full py-4 bg-amber-500 text-blue-900 font-black rounded-xl shadow-xl uppercase tracking-widest active:scale-95 transition"
              >
                GENERATE ESTIMATION
              </button>
              <button onClick={() => setStep('DOORS')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest">Back to Mapping</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessControlSurvey;