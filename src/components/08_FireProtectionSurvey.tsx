import React, { useState, useEffect, useRef } from 'react';
import { FireProtectionSurveyData, FireProtectionUnit } from '../types';
import { BUILDING_TYPES } from '../constants';
import { processNumeric, processTitleCase } from '../utils/voiceProcessing';
import FloorPlanManager from './12_FloorPlanManager';

interface Props {
  /** Receives current draft so it can be restored when returning. */
  onBack: (draft?: FireProtectionSurveyData) => void;
  onComplete: (data: FireProtectionSurveyData) => void;
  onNewFloorPlan?: () => void;
  initialData?: FireProtectionSurveyData;
}

const FireProtectionSurvey: React.FC<Props> = ({ onBack, onComplete, onNewFloorPlan, initialData }) => {
  const [step, setStep] = useState<'BUILDING' | 'DETAILS' | 'ZONING_SITE'>('BUILDING');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<FireProtectionSurveyData>({
    buildingInfo: { type: '', otherType: '', floors: 0, area: 0, isNew: undefined as any },
    siteImage: undefined,
    protectionArea: '',
    otherProtectionArea: '',
    hazardClassification: '',
    scope: { systems: [], status: '' },
    alarmCore: {
      type: '',
      panelLocation: '',
      powerAvailable: undefined,
      batteryRequired: undefined,
      smokeCount: 0,
      heatCount: 0,
      mcpCount: 0,
      notifCount: 0
    },
    zoning: { zones: 0, highRiskAreas: [] },
    infrastructure: { cableType: '', cableLength: 0, conduitsExist: undefined },
    suppression: { 
      type: '', 
      qty: 0, 
      locationIdentified: undefined,
      coverageType: '',
      cylinderLocAvailable: undefined,
      nozzleCount: 0,
      sealingCondition: ''
    },
    sprinkler: { 
      coverageArea: 0, 
      waterSource: '', 
      otherWaterSource: '',
      pumpRoomAvailable: undefined,
      existingStatus: '',
      headType: '',
      tempRating: '',
      pipeMaterial: '',
      otherPipeMaterial: '',
      pipeRouting: '',
      pipeLength: 0
    },
    integration: { systems: [], bfpCompliance: undefined },
    siteConstraints: { ceilingHeight: 0, ceilingType: '', otherCeilingType: '', isOccupied: undefined },
    controlRoom: {
      name: '',
      floorLevel: '',
      distanceToArea: 0,
      panelInstalled: undefined,
      panelType: undefined,
      releaseMethod: undefined,
      powerSupplyAvailable: undefined,
      upsBackupProvided: undefined
    },
    fireExtinguisher: { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' },
    fireHoseReel: { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' },
    fireBlanket: { quantity: 0, locations: '' },
    emergencyLighting: { present: false, type: '' },
    exitEvacuation: { exitSignsQuantity: 0, evacuationLightingPresent: false },
    protectionUnits: []
  });

  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [isListeningBuilding, setIsListeningBuilding] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

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
    if (step === 'ZONING_SITE') setStep('DETAILS');
    else if (step === 'DETAILS') setStep('BUILDING');
    else onBack(data);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setData(prev => ({ ...prev, siteImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
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

  const toggleScope = (sys: 'Suppression' | 'Sprinkler' | 'Portable') => {
    setData(prev => {
      const current = prev.scope.systems;
      const updated = current.includes(sys as any) ? current.filter(s => s !== sys) : [...current, sys as any];
      return { ...prev, scope: { ...prev.scope, systems: updated } };
    });
  };

  const units = data.protectionUnits ?? [];

  const snapshotCurrentUnit = (): FireProtectionUnit => ({
    id: editingUnitIndex !== null && units[editingUnitIndex] ? units[editingUnitIndex].id : Math.random().toString(36).substr(2, 9),
    protectionArea: data.protectionArea,
    otherProtectionArea: data.otherProtectionArea,
    hazardClassification: data.hazardClassification,
    scope: { ...data.scope },
    alarmCore: { ...data.alarmCore },
    suppression: { ...data.suppression },
    sprinkler: { ...data.sprinkler },
    siteImage: data.siteImage,
    siteConstraints: { ...data.siteConstraints },
    buildingInfoArea: data.buildingInfo.area,
    fireExtinguisher: data.fireExtinguisher ? { ...data.fireExtinguisher } : undefined,
    fireHoseReel: data.fireHoseReel ? { ...data.fireHoseReel } : undefined,
    fireBlanket: data.fireBlanket ? { ...data.fireBlanket } : undefined,
    emergencyLighting: data.emergencyLighting ? { ...data.emergencyLighting } : undefined,
    exitEvacuation: data.exitEvacuation ? { ...data.exitEvacuation } : undefined
  });

  const saveUnit = () => {
    if (data.scope.systems.length === 0) {
      alert('Please select at least one System Required.');
      return;
    }
    const unit = snapshotCurrentUnit();
    setData(prev => {
      const list = prev.protectionUnits ?? [];
      const nextList = editingUnitIndex !== null
        ? list.map((u, i) => i === editingUnitIndex ? unit : u)
        : [...list, unit];
      return {
        ...prev,
        protectionUnits: nextList,
        protectionArea: '',
        otherProtectionArea: '',
        hazardClassification: '',
        scope: { systems: [], status: '' },
        alarmCore: { ...prev.alarmCore, smokeCount: 0, heatCount: 0, mcpCount: 0, notifCount: 0 },
        suppression: { type: '' as any, qty: 0, locationIdentified: undefined, coverageType: '', cylinderLocAvailable: undefined, nozzleCount: 0, sealingCondition: '' },
        sprinkler: { coverageArea: 0, waterSource: '', otherWaterSource: '', pumpRoomAvailable: undefined, existingStatus: '', headType: '', tempRating: '', pipeMaterial: '', otherPipeMaterial: '', pipeRouting: '', pipeLength: 0 },
        siteImage: undefined,
        siteConstraints: { ceilingHeight: 0, ceilingType: '', otherCeilingType: '', isOccupied: undefined },
        fireExtinguisher: { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' },
        fireHoseReel: { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' },
        fireBlanket: { quantity: 0, locations: '' },
        emergencyLighting: { present: false, type: '' },
        exitEvacuation: { exitSignsQuantity: 0, evacuationLightingPresent: false }
      };
    });
    setEditingUnitIndex(null);
  };

  const copyUnit = (unit: FireProtectionUnit) => {
    const copy: FireProtectionUnit = { ...unit, id: Math.random().toString(36).substr(2, 9) };
    setData(prev => ({ ...prev, protectionUnits: [...(prev.protectionUnits ?? []), copy] }));
  };

  const loadUnitIntoForm = (unit: FireProtectionUnit) => {
    setData(prev => ({
      ...prev,
      protectionArea: unit.protectionArea ?? '',
      otherProtectionArea: unit.otherProtectionArea ?? '',
      hazardClassification: unit.hazardClassification ?? '',
      scope: { ...unit.scope },
      alarmCore: { ...unit.alarmCore },
      suppression: { ...unit.suppression },
      sprinkler: { ...unit.sprinkler },
      siteImage: unit.siteImage,
      siteConstraints: { ...unit.siteConstraints },
      buildingInfo: { ...prev.buildingInfo, area: unit.buildingInfoArea },
      fireExtinguisher: unit.fireExtinguisher ? { ...unit.fireExtinguisher } : { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' },
      fireHoseReel: unit.fireHoseReel ? { ...unit.fireHoseReel } : { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' },
      fireBlanket: unit.fireBlanket ? { ...unit.fireBlanket } : { quantity: 0, locations: '' },
      emergencyLighting: unit.emergencyLighting ? { ...unit.emergencyLighting } : { present: false, type: '' },
      exitEvacuation: unit.exitEvacuation ? { ...unit.exitEvacuation } : { exitSignsQuantity: 0, evacuationLightingPresent: false }
    }));
  };

  const editUnit = (unit: FireProtectionUnit, idx: number) => {
    loadUnitIntoForm(unit);
    setEditingUnitIndex(idx);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <header className="p-4 bg-blue-900 flex items-center justify-between shrink-0 text-white shadow-lg z-10">
        <button onClick={handleHeaderBack} className="text-white flex items-center gap-2">
          <i className="fas fa-chevron-left text-lg"></i>
          <span className="font-bold">Fire Protection Survey</span>
        </button>
        <div className="flex space-x-2">
          {['1', '2', '3'].map((_, idx) => {
             const currentIdx = ['BUILDING', 'DETAILS', 'ZONING_SITE'].indexOf(step);
             return (
               <div key={idx} className={`w-3 h-3 rounded-full ${idx === currentIdx ? 'bg-red-500' : 'bg-blue-700'}`}></div>
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
                    setStep('DETAILS');
                  }
                }}
                className={`w-full py-6 font-black rounded-xl uppercase tracking-widest transition text-[10px] ${isStep1Complete ? 'bg-blue-900 text-white shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT
              </button>
              {showErrors && !isStep1Complete && (
                <p className="text-[10px] text-red-500 font-black text-center mt-3 uppercase tracking-widest animate-pulse">
                  Complete building specifications to proceed
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'DETAILS' && (
          <div className="animate-fade-in space-y-6">
            {/* DETAILS FORM CARD */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
               <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Site Reference Photo</label>
                  <div className="mt-2">
                    {data.siteImage ? (
                      <div className="relative group">
                        <img src={data.siteImage} className="w-full aspect-video object-cover rounded-2xl border-2 border-slate-100 shadow-sm max-h-[140px]" alt="Site Reference" />
                        <button 
                          onClick={() => setData(prev => ({ ...prev, siteImage: undefined }))}
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

               <div className="pt-4 border-t border-slate-200 text-left">
                  <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">PROTECTION AREA</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['Electrical Room', 'Kitchen', 'Parking', 'Warehouse', 'Office', 'Other'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, protectionArea: opt }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.protectionArea === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {data.protectionArea === 'Other' && (
                    <div className="relative mt-2 animate-fade-in">
                      <input 
                        placeholder="Specify Area Name"
                        className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                        value={data.otherProtectionArea || ''}
                        onChange={e => setData(prev => ({ ...prev, otherProtectionArea: e.target.value }))}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherProtectionArea', (val) => setData(prev => ({ ...prev, otherProtectionArea: val })))}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherProtectionArea' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  )}
               </div>

               {/* SCOPE STATUS */}
               <div className="pt-4 border-t border-slate-200 text-left">
                  <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Scope Status</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['New Installation', 'Expansion', 'Replacement'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, scope: { ...prev.scope, status: opt as any } }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.scope.status === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
               </div>

               {/* NEW FIRE HAZARD CLASSIFICATION SECTION */}
               <div className="pt-4 border-t border-slate-200 text-left">
                  <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Fire hazard classification</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['Light', 'Ordinary', 'Extra Hazard'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, hazardClassification: opt }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.hazardClassification === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* ADDED AREA SIZE AND CEILING HEIGHT FIELDS */}
                  <div className="mt-4 space-y-2">
                    <div className="text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Area size (sqm)</label>
                      <div className="relative mt-1">
                        <input 
                          type="number"
                          step="any"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.buildingInfo.area === 0 ? '' : data.buildingInfo.area}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, area: isNaN(val) ? 0 : Math.max(0, val)}}));
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('areaSizeFP', (val) => setData(prev => ({...prev, buildingInfo: {...prev.buildingInfo, area: val}})), true)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'areaSizeFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Ceiling type</label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {['Concrete', 'Gypsum', 'Glass', 'Steel', 'Brick', 'Other'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, siteConstraints: { ...prev.siteConstraints, ceilingType: opt as any } }))}
                            className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.siteConstraints.ceilingType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {data.siteConstraints.ceilingType === 'Other' && (
                        <div className="relative mt-2 animate-fade-in">
                          <input
                            placeholder="Specify Ceiling Type"
                            className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.siteConstraints.otherCeilingType ?? ''}
                            onChange={e => setData(prev => ({ ...prev, siteConstraints: { ...prev.siteConstraints, otherCeilingType: e.target.value } }))}
                          />
                          <button
                            type="button"
                            onClick={() => startVoiceInput('otherCeilingTypeFP', (val) => setData(prev => ({ ...prev, siteConstraints: { ...prev.siteConstraints, otherCeilingType: val } })))}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCeilingTypeFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Ceiling height (meters)</label>
                      <div className="relative mt-1">
                        <input 
                          type="number"
                          step="0.1"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.siteConstraints.ceilingHeight === 0 ? '' : data.siteConstraints.ceilingHeight}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setData(prev => ({...prev, siteConstraints: {...prev.siteConstraints, ceilingHeight: isNaN(val) ? 0 : Math.max(0, val)}}));
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('ceilingHeightFP', (val) => setData(prev => ({...prev, siteConstraints: {...prev.siteConstraints, ceilingHeight: val}})), true)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'ceilingHeightFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>
                  </div>
               </div>

               {/* MERGED SYSTEM REQUIRED SECTION */}
               <div className="pt-4 border-t border-slate-200 text-left">
                  <h4 className="text-[10px] font-black text-blue-900 tracking-widest uppercase ml-1 mb-3">System Required</h4>
                  <div className="space-y-2">
                    {(['Suppression', 'Sprinkler', 'Portable'] as const).map(sys => (
                      <button
                        key={sys}
                        onClick={() => toggleScope(sys)}
                        className={`w-full p-2 rounded-xl flex items-center justify-between border-2 transition ${data.scope.systems.includes(sys) ? 'bg-white border-blue-900 text-blue-900 shadow-sm' : 'bg-white border-slate-100 text-slate-300'}`}
                      >
                        <span className="font-black text-xs uppercase">{sys === 'Portable' ? 'Portable & Other Equipment' : sys}</span>
                        <i className={`fas ${data.scope.systems.includes(sys) ? 'fa-check-circle' : 'fa-circle'} text-lg`}></i>
                      </button>
                    ))}
                  </div>
               </div>

               {/* CONDITIONAL SUPPRESSION FIELDS */}
               {data.scope.systems.includes('Suppression') && (
                 <div className="space-y-2 animate-fade-in text-left pt-3 border-t border-slate-200">
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Suppression Coverage Type</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {['Total Flooding', 'Local Application'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, suppression: { ...prev.suppression, coverageType: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.suppression.coverageType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Cylinder Location Available?</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[
                          { label: 'YES', val: true },
                          { label: 'NO', val: false }
                        ].map(opt => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, suppression: { ...prev.suppression, cylinderLocAvailable: opt.val } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.suppression.cylinderLocAvailable === opt.val ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Nozzle / Discharge Point Count</label>
                      <div className="relative mt-1">
                        <input 
                          type="number"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.suppression.nozzleCount === 0 ? '' : data.suppression.nozzleCount}
                          onChange={e => setData(prev => ({ ...prev, suppression: { ...prev.suppression, nozzleCount: parseInt(e.target.value) || 0 } }))}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('nozzleCount', (val) => setData(prev => ({ ...prev, suppression: { ...prev.suppression, nozzleCount: val } })), true)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'nozzleCount' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Sealing Condition</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['Good', 'Fair', 'Poor'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, suppression: { ...prev.suppression, sealingCondition: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.suppression.sealingCondition === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                 </div>
               )}

               {/* CONDITIONAL SPRINKLER FIELDS */}
               {data.scope.systems.includes('Sprinkler') && (
                 <div className="space-y-2 animate-fade-in text-left pt-3 border-t border-slate-200">
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Existing Sprinkler System?</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['New', 'Extension', 'Replacement'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, existingStatus: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.sprinkler.existingStatus === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Sprinkler Type</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['Pendent', 'Upright', 'Sidewall'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, headType: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.sprinkler.headType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Sprinkler Temperature Rating</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['68°C', '79°C', 'High-Temp'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, tempRating: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.sprinkler.tempRating === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* NEW SPRINKLER SYSTEM FIELD */}
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Sprinkler System</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['Tank', 'City Line', 'Other'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, waterSource: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.sprinkler.waterSource === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {data.sprinkler.waterSource === 'Other' && (
                        <div className="relative mt-1 animate-fade-in">
                          <input 
                            placeholder="Specify Sprinkler System"
                            className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.sprinkler.otherWaterSource || ''}
                            onChange={e => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, otherWaterSource: e.target.value } }))}
                          />
                          <button 
                            type="button"
                            onClick={() => startVoiceInput('otherWaterSource', (val) => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, otherWaterSource: val } })))}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherWaterSource' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* NEW PIPE MATERIALS SECTION */}
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Pipe Materials</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {['GI', 'Black Steel', 'CPVC', 'Other'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, pipeMaterial: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.sprinkler.pipeMaterial === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {data.sprinkler.pipeMaterial === 'Other' && (
                        <div className="relative mt-1 animate-fade-in">
                          <input 
                            placeholder="Specify Pipe Material"
                            className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.sprinkler.otherPipeMaterial || ''}
                            onChange={e => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, otherPipeMaterial: e.target.value } }))}
                          />
                          <button 
                            type="button"
                            onClick={() => startVoiceInput('otherPipeMaterial', (val) => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, otherPipeMaterial: val } })))}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherPipeMaterial' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* NEW MAIN PIPE ROUTING SECTION */}
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Main Pipe Routing</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['Ceiling', 'Exposed', 'Underground'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, pipeRouting: opt } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.sprinkler.pipeRouting === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* NEW PIPE LENGTH FIELD */}
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Pipe Length (m)</label>
                      <div className="relative mt-1">
                        <input 
                          type="number"
                          step="any"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.sprinkler.pipeLength === 0 ? '' : data.sprinkler.pipeLength}
                          onChange={e => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, pipeLength: parseFloat(e.target.value) || 0 } }))}
                        />
                        <button 
                          type="button"
                          onClick={() => startVoiceInput('pipeLength', (val) => setData(prev => ({ ...prev, sprinkler: { ...prev.sprinkler, pipeLength: val } })), true)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'pipeLength' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>
                 </div>
               )}

               {/* PORTABLE & OTHER EQUIPMENT - shown when selected in System Required */}
               {data.scope.systems.includes('Portable') && (
               <div className="pt-3 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-blue-900 tracking-widest uppercase ml-1 mb-2">Portable & Other Equipment</h4>

                  {/* Fire Extinguisher */}
                  <div className="space-y-2 mb-3">
                    <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Fire Extinguisher Type</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {['ABC', 'CO2', 'Water', 'Foam', 'K-Class', 'Other'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setData(prev => ({
                            ...prev,
                            fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), type: opt as any }
                          }))}
                          className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.fireExtinguisher?.type === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {data.fireExtinguisher?.type === 'Other' && (
                      <div className="relative mt-1">
                        <input
                          placeholder="Specify Fire Extinguisher Type"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.fireExtinguisher?.otherType ?? ''}
                          onChange={e => setData(prev => ({
                            ...prev,
                            fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), otherType: e.target.value }
                          }))}
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Quantity</label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          min={0}
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.fireExtinguisher?.quantity === 0 ? '' : data.fireExtinguisher?.quantity}
                          onChange={e => setData(prev => ({
                            ...prev,
                            fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), quantity: parseInt(e.target.value, 10) || 0 }
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => startVoiceInput('fireExtQty', (val) => setData(prev => ({ ...prev, fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), quantity: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'fireExtQty' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Capacity</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['2.5 kg', '5 kg', '6 kg', '9 L', '20 L', 'Other'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({
                              ...prev,
                              fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), capacity: opt as any }
                            }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.fireExtinguisher?.capacity === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {data.fireExtinguisher?.capacity === 'Other' && (
                        <input
                          placeholder="Specify Capacity"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs mt-1"
                          value={data.fireExtinguisher?.otherCapacity ?? ''}
                          onChange={e => setData(prev => ({
                            ...prev,
                            fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), otherCapacity: e.target.value }
                          }))}
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Mounting Type</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['Wall-mounted', 'Cabinet', 'Stand'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({
                              ...prev,
                              fireExtinguisher: { ...(prev.fireExtinguisher ?? { type: '', quantity: 0, capacity: '', mountingType: '', otherType: '', otherCapacity: '' }), mountingType: opt as any }
                            }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.fireExtinguisher?.mountingType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fire Hose Reel */}
                  <div className="space-y-2 mb-3">
                    <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Fire Hose Reel – Quantity</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                        value={data.fireHoseReel?.quantity === 0 ? '' : data.fireHoseReel?.quantity}
                        onChange={e => setData(prev => ({
                          ...prev,
                          fireHoseReel: { ...(prev.fireHoseReel ?? { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' }), quantity: parseInt(e.target.value, 10) || 0 }
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => startVoiceInput('fireHoseReelQty', (val) => setData(prev => ({ ...prev, fireHoseReel: { ...(prev.fireHoseReel ?? { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' }), quantity: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'fireHoseReelQty' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Hose Length (m)</label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.fireHoseReel?.hoseLengthM === 0 ? '' : data.fireHoseReel?.hoseLengthM}
                          onChange={e => setData(prev => ({
                            ...prev,
                            fireHoseReel: { ...(prev.fireHoseReel ?? { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' }), hoseLengthM: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => startVoiceInput('hoseLengthFP', (val) => setData(prev => ({ ...prev, fireHoseReel: { ...(prev.fireHoseReel ?? { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' }), hoseLengthM: typeof val === 'number' ? val : parseFloat(String(val)) || 0 } })), true)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'hoseLengthFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Nozzle Type</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {['Jet', 'Spray', 'Jet/Spray', 'Fog', 'Straight stream', 'Other'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({
                              ...prev,
                              fireHoseReel: { ...(prev.fireHoseReel ?? { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' }), nozzleType: opt as any }
                            }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.fireHoseReel?.nozzleType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {data.fireHoseReel?.nozzleType === 'Other' && (
                        <input
                          placeholder="Specify Nozzle Type"
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs mt-1"
                          value={data.fireHoseReel?.otherNozzleType ?? ''}
                          onChange={e => setData(prev => ({
                            ...prev,
                            fireHoseReel: { ...(prev.fireHoseReel ?? { quantity: 0, hoseLengthM: 0, nozzleType: '', otherNozzleType: '' }), otherNozzleType: e.target.value }
                          }))}
                        />
                      )}
                    </div>
                  </div>

                  {/* Fire Blanket */}
                  <div className="space-y-2 mb-3">
                    <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Fire Blanket – Quantity</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                        value={data.fireBlanket?.quantity === 0 ? '' : data.fireBlanket?.quantity}
                        onChange={e => setData(prev => ({
                          ...prev,
                          fireBlanket: { ...(prev.fireBlanket ?? { quantity: 0, locations: '' }), quantity: parseInt(e.target.value, 10) || 0 }
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => startVoiceInput('fireBlanketQty', (val) => setData(prev => ({ ...prev, fireBlanket: { ...(prev.fireBlanket ?? { quantity: 0, locations: '' }), quantity: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'fireBlanketQty' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>

                  {/* Emergency Lighting */}
                  <div className="space-y-2 mb-3">
                    <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Emergency Lighting Present</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {[true, false].map(val => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => setData(prev => ({
                            ...prev,
                            emergencyLighting: { ...(prev.emergencyLighting ?? { present: false, type: '' }), present: val }
                          }))}
                          className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.emergencyLighting?.present === val ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {val ? 'YES' : 'NO'}
                        </button>
                      ))}
                    </div>
                    {data.emergencyLighting?.present && (
                      <div>
                        <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Type</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {['Maintained', 'Non-maintained'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setData(prev => ({
                                ...prev,
                                emergencyLighting: { ...(prev.emergencyLighting ?? { present: false, type: '' }), type: opt as any }
                              }))}
                              className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.emergencyLighting?.type === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exit / Evacuation */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-blue-900 uppercase ml-1 tracking-wider">Exit Signs Quantity</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                        value={data.exitEvacuation?.exitSignsQuantity === 0 ? '' : data.exitEvacuation?.exitSignsQuantity}
                        onChange={e => setData(prev => ({
                          ...prev,
                          exitEvacuation: { ...(prev.exitEvacuation ?? { exitSignsQuantity: 0, evacuationLightingPresent: false }), exitSignsQuantity: parseInt(e.target.value, 10) || 0 }
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => startVoiceInput('exitSignsQty', (val) => setData(prev => ({ ...prev, exitEvacuation: { ...(prev.exitEvacuation ?? { exitSignsQuantity: 0, evacuationLightingPresent: false }), exitSignsQuantity: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'exitSignsQty' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
               </div>
               )}

               {/* ALARM CORE / DETECTORS */}
               <div className="pt-3 border-t border-slate-200 text-left">
                  <h4 className="text-[10px] font-black text-blue-900 tracking-widest uppercase ml-1 mb-2">Alarm core / detectors</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Panel type</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {['Addressable', 'Conventional'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, type: opt as any } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.alarmCore.type === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Panel location</label>
                      <div className="relative mt-1">
                        <input
                          className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                          value={data.alarmCore.panelLocation || ''}
                          onChange={e => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, panelLocation: e.target.value } }))}
                        />
                        <button
                          type="button"
                          onClick={() => startVoiceInput('panelLocationFP', (val) => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, panelLocation: val } })))}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'panelLocationFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Dedicated power available?</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[true, false].map(val => (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, powerAvailable: val } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.alarmCore.powerAvailable === val ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {val ? 'YES' : 'NO'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Backup battery required?</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[true, false].map(val => (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, batteryRequired: val } }))}
                            className={`py-2 rounded-xl font-black border-2 text-[10px] transition ${data.alarmCore.batteryRequired === val ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {val ? 'YES' : 'NO'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Smoke detector quantity</label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.alarmCore.smokeCount === 0 ? '' : data.alarmCore.smokeCount}
                            onChange={e => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, smokeCount: parseInt(e.target.value, 10) || 0 } }))}
                          />
                          <button
                            type="button"
                            onClick={() => startVoiceInput('smokeCountFP', (val) => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, smokeCount: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'smokeCountFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Heat detector quantity</label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.alarmCore.heatCount === 0 ? '' : data.alarmCore.heatCount}
                            onChange={e => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, heatCount: parseInt(e.target.value, 10) || 0 } }))}
                          />
                          <button
                            type="button"
                            onClick={() => startVoiceInput('heatCountFP', (val) => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, heatCount: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'heatCountFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Manual call point (MCP) quantity</label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.alarmCore.mcpCount === 0 ? '' : data.alarmCore.mcpCount}
                            onChange={e => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, mcpCount: parseInt(e.target.value, 10) || 0 } }))}
                          />
                          <button
                            type="button"
                            onClick={() => startVoiceInput('mcpCountFP', (val) => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, mcpCount: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'mcpCountFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Notification appliance quantity</label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                            value={data.alarmCore.notifCount === 0 ? '' : data.alarmCore.notifCount}
                            onChange={e => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, notifCount: parseInt(e.target.value, 10) || 0 } }))}
                          />
                          <button
                            type="button"
                            onClick={() => startVoiceInput('notifCountFP', (val) => setData(prev => ({ ...prev, alarmCore: { ...prev.alarmCore, notifCount: typeof val === 'number' ? val : parseInt(String(val), 10) || 0 } })), true)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'notifCountFP' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={saveUnit}
                  disabled={data.scope.systems.length === 0}
                  className="w-full py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px] disabled:opacity-30 disabled:bg-slate-200 disabled:shadow-none"
                >
                  {editingUnitIndex !== null ? 'UPDATE FIRE PROTECTION ENTRY' : 'SAVE FIRE PROTECTION ENTRY'}
                </button>
              </div>
            </div>

            {/* Fire Protection Units list - same pattern as CCTV */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Fire Protection Units ({units.length})</h3>
              </div>
              {units.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No fire protection units mapped yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {units.map((unit, idx) => (
                    <div key={unit.id} className="bg-slate-50 p-4 rounded-xl border-l-4 border-blue-900 shadow-sm flex justify-between items-center text-left">
                      <div className="flex items-center gap-4">
                        {unit.siteImage && (
                          <img src={unit.siteImage} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Unit" />
                        )}
                        <div>
                          <p className="font-black text-blue-900 uppercase text-[10px]">{unit.protectionArea === 'Other' ? unit.otherProtectionArea || 'Other' : unit.protectionArea || '—'}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{unit.hazardClassification || '—'} • {unit.scope.systems.map(s => s === 'Portable' ? 'Portable & Other Equipment' : s).join(', ') || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => copyUnit(unit)} className="text-blue-600 min-w-[2.5rem] h-10 px-3 hover:bg-blue-50 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Copy unit" title="Copy">
                          Copy
                        </button>
                        <button onClick={() => editUnit(unit, idx)} className="text-slate-600 min-w-[2.5rem] h-10 px-3 hover:bg-slate-100 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Edit unit" title="Edit">
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setData(prev => ({ ...prev, protectionUnits: (prev.protectionUnits ?? []).filter((_, i) => i !== idx) }));
                            if (editingUnitIndex === idx) {
                              setEditingUnitIndex(null);
                            } else if (editingUnitIndex !== null && idx < editingUnitIndex) {
                              setEditingUnitIndex(editingUnitIndex - 1);
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
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 space-y-3 pb-10">
              <button 
                onClick={() => {
                   if (units.length === 0) {
                      alert("Please save at least one Fire Protection entry.");
                      return;
                   }
                   // Sync first unit into top-level data for control room / completion
                   const first = units[0];
                   if (first) {
                     setData(prev => ({
                       ...prev,
                       protectionArea: first.protectionArea,
                       otherProtectionArea: first.otherProtectionArea,
                       hazardClassification: first.hazardClassification,
                       scope: { ...first.scope },
                       alarmCore: { ...first.alarmCore },
                       suppression: { ...first.suppression },
                       sprinkler: { ...first.sprinkler },
                       siteImage: first.siteImage,
                       siteConstraints: { ...first.siteConstraints },
                       buildingInfo: { ...prev.buildingInfo, area: first.buildingInfoArea }
                     }));
                   }
                   setStep('ZONING_SITE');
                }}
                disabled={units.length === 0}
                className={`w-full py-4 font-black rounded-xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px] ${units.length > 0 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                NEXT: CONTROL ROOM
              </button>
              <button onClick={() => setStep('BUILDING')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest text-center">Back to Building Info</button>
            </div>
          </div>
        )}

        {step === 'ZONING_SITE' && (
          <div className="animate-fade-in space-y-6 text-left">
            <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight border-l-4 border-amber-500 pl-3">Control Room</h3>

            <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">Control Room Name</label>
                  <div className="relative mt-1">
                    <input 
                      className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 pr-9 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={data.controlRoom?.name || ''}
                      onChange={e => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, name: e.target.value } }))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('controlRoomName', (val) => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, name: val } })))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'controlRoomName' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Floor Level</label>
                  <div className="relative mt-1">
                    <input 
                      className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={data.controlRoom?.floorLevel || ''}
                      onChange={e => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, floorLevel: e.target.value } }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Distance to Protected Area (meters)</label>
                  <div className="relative mt-1">
                    <input 
                      type="number"
                      className="w-full bg-white border-2 border-slate-200 py-2 px-2.5 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={data.controlRoom?.distanceToArea || ''}
                      onChange={e => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, distanceToArea: parseFloat(e.target.value) || 0 } }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Suppression control panel installed?</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {['Yes', 'No', 'Existing'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, panelInstalled: opt as any } }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlRoom?.panelInstalled === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Panel type</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['Dedicated suppression panel', 'Integrated with FACP'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, panelType: opt as any } }))}
                        className={`py-3 px-2 rounded-xl font-black border-2 text-[9px] transition leading-tight ${data.controlRoom?.panelType === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Release method</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {['Automatic', 'Manual', 'Combined'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, releaseMethod: opt as any } }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlRoom?.releaseMethod === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Dedicated power supply available?</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { label: 'YES', val: true },
                      { label: 'NO', val: false }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, powerSupplyAvailable: opt.val } }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlRoom?.powerSupplyAvailable === opt.val ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">UPS / battery backup provided?</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { label: 'YES', val: true },
                      { label: 'NO', val: false }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, controlRoom: { ...prev.controlRoom!, upsBackupProvided: opt.val } }))}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlRoom?.upsBackupProvided === opt.val ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
            </div>

            <div className="pt-10 space-y-3 pb-10">
              <button 
                onClick={() => onComplete(data)}
                className="w-full py-4 bg-amber-500 text-blue-900 font-black rounded-xl shadow-xl uppercase tracking-widest active:scale-95 transition"
              >
                GENERATE ESTIMATION
              </button>
              <button onClick={() => setStep('DETAILS')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest text-center">Back to Details</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FireProtectionSurvey;