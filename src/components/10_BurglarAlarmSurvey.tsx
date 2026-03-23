import React, { useState, useEffect, useRef } from 'react';
import { BurglarAlarmSurveyData, BurglarAlarmSensor } from '../types';
import { BUILDING_TYPES } from '../constants';
import { processNumeric, processTitleCase } from '../utils/voiceProcessing';
import FloorPlanManager from './12_FloorPlanManager';

interface Props {
  /** Receives current draft so it can be restored when returning. */
  onBack: (draft?: BurglarAlarmSurveyData) => void;
  onComplete: (data: BurglarAlarmSurveyData) => void;
  onNewFloorPlan?: () => void;
  initialData?: BurglarAlarmSurveyData;
}

const BurglarAlarmSurvey: React.FC<Props> = ({ onBack, onComplete, onNewFloorPlan, initialData }) => {
  const [step, setStep] = useState<'BUILDING' | 'SENSORS' | 'PANEL'>('BUILDING');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<BurglarAlarmSurveyData>({
    buildingInfo: { type: '', otherType: '', floors: 0, isNew: undefined as any },
    sensors: [],
    notification: { sirenIndoor: 0, sirenOutdoor: 0, strobeLight: undefined },
    controlPanel: { 
      location: '', 
      systemType: '', 
      keypads: 0, 
      simCardRequired: undefined, 
      internetRequired: undefined,
      sirenLocation: '',
      sirenTypeRequired: '',
      monitoringType: '',
      notificationMethod: [],
      petsPresent: undefined,
      powerSourceAvailable: undefined,
      cableRoutingPath: '',
      otherCableRoutingPath: '',
      estimatedCableLength: undefined
    }
  });

  const [currentSensor, setCurrentSensor] = useState<Partial<BurglarAlarmSensor> & { otherIntrusionConcern?: string; otherSensorType?: string; otherObstructions?: string }>({
    location: '',
    riskLevel: undefined,
    intrusionConcern: [],
    otherIntrusionConcern: '',
    environment: undefined,
    type: undefined,
    otherSensorType: '',
    obstructions: [],
    otherObstructions: '',
    count: 0,
    connection: undefined,
    wallType: '',
    otherWallType: '',
    image: undefined
  });

  const [editingSensorIndex, setEditingSensorIndex] = useState<number | null>(null);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [isListeningBuilding, setIsListeningBuilding] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (initialData) setData(initialData);
  }, [initialData]);

  /**
   * SCROLL RESET EFFECT
   * Logic: Resets the container scroll position whenever the step changes.
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
    if (step === 'PANEL') {
      setStep('SENSORS');
    } else if (step === 'SENSORS') {
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
        setCurrentSensor(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const resetSensorForm = () => {
    setCurrentSensor({
      location: '',
      riskLevel: undefined,
      intrusionConcern: [],
      otherIntrusionConcern: '',
      environment: undefined,
      type: undefined,
      otherSensorType: '',
      obstructions: [],
      otherObstructions: '',
      count: 1,
      connection: undefined,
      wallType: '',
      otherWallType: '',
      image: undefined
    });
    setEditingSensorIndex(null);
  };

  const addSensor = () => {
    if (!currentSensor.location || !currentSensor.type || !currentSensor.connection || !currentSensor.riskLevel || !currentSensor.intrusionConcern?.length || !currentSensor.environment || !currentSensor.obstructions?.length || !currentSensor.wallType) {
       alert("Please complete all sensor fields: Location Name, Environment, Sensor Type, Connection Type, Wall Type, Risk Level, Concern, Obstructions, and Connection.");
       return;
    }

    const finalConcern = (currentSensor.intrusionConcern || []).map(c => 
      c === 'Other' ? `Other: ${currentSensor.otherIntrusionConcern || 'Not Specified'}` : c
    );

    const finalType = currentSensor.type === 'Other'
      ? `Other: ${currentSensor.otherSensorType || 'Not Specified'}`
      : currentSensor.type;

    const finalObstructions = (currentSensor.obstructions || []).map(o => 
      o === 'Other' ? `Other: ${currentSensor.otherObstructions || 'Not Specified'}` : o
    );

    const sensor: BurglarAlarmSensor = {
      id: editingSensorIndex !== null ? data.sensors[editingSensorIndex].id : Math.random().toString(36).substr(2, 9),
      location: currentSensor.location!,
      riskLevel: currentSensor.riskLevel,
      intrusionConcern: finalConcern,
      environment: currentSensor.environment,
      type: finalType,
      obstructions: finalObstructions,
      count: currentSensor.count || 1,
      connection: currentSensor.connection,
      wallType: currentSensor.wallType,
      otherWallType: currentSensor.otherWallType,
      image: currentSensor.image
    };

    if (editingSensorIndex !== null) {
      setData(prev => {
        const next = [...prev.sensors];
        next[editingSensorIndex] = sensor;
        return { ...prev, sensors: next };
      });
      resetSensorForm();
      return;
    }

    setData(prev => ({ ...prev, sensors: [...prev.sensors, sensor] }));
    resetSensorForm();
  };

  const copySensor = (sensor: BurglarAlarmSensor) => {
    const copy: BurglarAlarmSensor = { ...sensor, id: Math.random().toString(36).substr(2, 9) };
    setData(prev => ({ ...prev, sensors: [...prev.sensors, copy] }));
  };

  const editSensor = (sensor: BurglarAlarmSensor, idx: number) => {
    const parseOther = (val: string | undefined) => (val?.startsWith('Other: ') ? val.slice(7) : '') || '';
    const concernRaw = sensor.intrusionConcern || [];
    const concernHasOther = concernRaw.some(c => c.startsWith('Other:'));
    const concernList = concernRaw.map(c => (c.startsWith('Other:') ? 'Other' : c));
    if (concernHasOther && !concernList.includes('Other')) concernList.push('Other');
    const obstructionRaw = sensor.obstructions || [];
    const obstHasOther = obstructionRaw.some(o => o.startsWith('Other:'));
    const obstList = obstructionRaw.map(o => (o.startsWith('Other:') ? 'Other' : o));
    if (obstHasOther && !obstList.includes('Other')) obstList.push('Other');
    const typeBase = sensor.type?.startsWith('Other:') ? 'Other' : sensor.type;
    setCurrentSensor({
      location: sensor.location,
      riskLevel: sensor.riskLevel,
      intrusionConcern: concernList.length ? concernList : (concernHasOther ? ['Other'] : []),
      otherIntrusionConcern: parseOther(concernRaw.find(c => c.startsWith('Other:'))),
      environment: sensor.environment,
      type: typeBase,
      otherSensorType: sensor.type?.startsWith('Other:') ? parseOther(sensor.type) : '',
      obstructions: obstList.length ? obstList : (obstHasOther ? ['Other'] : []),
      otherObstructions: parseOther(obstructionRaw.find(o => o.startsWith('Other:'))),
      count: sensor.count || 1,
      connection: sensor.connection,
      wallType: sensor.wallType,
      otherWallType: sensor.otherWallType,
      image: sensor.image
    });
    setEditingSensorIndex(idx);
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

  const toggleNotificationMethod = (method: string) => {
    setData(prev => {
      const current = prev.controlPanel.notificationMethod || [];
      const updated = current.includes(method)
        ? current.filter(m => m !== method)
        : [...current, method];
      return {
        ...prev,
        controlPanel: {
          ...prev.controlPanel,
          notificationMethod: updated
        }
      };
    });
  };

  const toggleIntrusionConcern = (concern: string) => {
    setCurrentSensor(prev => {
      const current = prev.intrusionConcern || [];
      const updated = current.includes(concern)
        ? current.filter(c => c !== concern)
        : [...current, concern];
      return { ...prev, intrusionConcern: updated };
    });
  };

  const toggleObstructions = (obstruction: string) => {
    setCurrentSensor(prev => {
      const current = prev.obstructions || [];
      const updated = current.includes(obstruction)
        ? current.filter(o => o !== obstruction)
        : [...current, obstruction];
      return { ...prev, obstructions: updated };
    });
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <header className="p-4 bg-blue-900 flex items-center justify-between shrink-0 text-white shadow-lg z-10">
        <button onClick={handleHeaderBack} className="text-white flex items-center gap-2">
          <i className="fas fa-chevron-left text-lg"></i>
          <span className="font-bold">Burglar Alarm Survey</span>
        </button>
        <div className="flex space-x-2">
          {['B', 'S', 'P'].map((s, idx) => {
             const currentIdx = ['BUILDING', 'SENSORS', 'PANEL'].indexOf(step);
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
                    setStep('SENSORS');
                  }
                }}
                className={`w-full py-6 font-black rounded-xl uppercase tracking-widest transition text-[10px] ${isStep1Complete ? 'bg-blue-900 text-white shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT: SENSOR MAPPING
              </button>
              {showErrors && !isStep1Complete && (
                <p className="text-[10px] text-red-500 font-black text-center mt-3 uppercase tracking-widest animate-pulse">
                  Complete building specifications to proceed
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'SENSORS' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Site Reference Photo</label>
                <div className="mt-2">
                  {currentSensor.image ? (
                    <div className="relative group">
                      <img src={currentSensor.image} className="w-full aspect-video object-cover rounded-2xl border-2 border-slate-100 shadow-sm max-h-[140px]" alt="Sensor Reference" />
                      <button 
                        onClick={() => setCurrentSensor(prev => ({ ...prev, image: undefined }))}
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

              <div className="text-left">
                <label className="text-[10px] font-black text-blue-900 uppercase ml-1">Sensor Location Name</label>
                <div className="relative mt-1">
                  <input 
                    className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none"
                    value={currentSensor.location}
                    onChange={e => setCurrentSensor(prev => ({...prev, location: e.target.value}))}
                  />
                  <button 
                    onClick={() => startVoiceInput('sensorLocation', (val) => setCurrentSensor(prev => ({...prev, location: val})))}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'doorLocation' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Sensor Location</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Indoor', 'Outdoor'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCurrentSensor(prev => ({...prev, environment: opt as any}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.environment === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Sensor Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['PIR', 'Door Contact', 'Glass Break', 'Vibration', 'Panic Button', 'Other'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        setCurrentSensor(prev => ({...prev, type: opt}));
                        if (opt !== 'Other') setCurrentSensor(prev => ({...prev, otherSensorType: ''}));
                      }}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.type === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {currentSensor.type === 'Other' && (
                  <div className="relative mt-2 animate-fade-in">
                    <input 
                      placeholder="Specify Sensor Type"
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={currentSensor.otherSensorType || ''}
                      onChange={e => setCurrentSensor(prev => ({...prev, otherSensorType: e.target.value}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherSensorType', (val) => setCurrentSensor(prev => ({...prev, otherSensorType: val})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherSensorType' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Connection Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['Wired', 'Wireless'] as const).map(c => (
                    <button 
                      key={c}
                      onClick={() => setCurrentSensor(prev => ({...prev, connection: c}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.connection === c ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >{c.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Wall type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Concrete', 'Gypsum', 'Wood', 'Other'].map(wt => (
                    <button 
                      key={wt}
                      onClick={() => {
                        setCurrentSensor(prev => ({...prev, wallType: wt}));
                        if (wt !== 'Other') {
                          setCurrentSensor(prev => ({...prev, otherWallType: ''}));
                        }
                      }}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.wallType === wt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {wt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {currentSensor.wallType === 'Other' && (
                  <div className="relative mt-2 animate-fade-in">
                    <input 
                      placeholder="Specify Wall Type"
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={currentSensor.otherWallType || ''}
                      onChange={e => setCurrentSensor(prev => ({...prev, otherWallType: e.target.value}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherWallTypeSensor', (val) => setCurrentSensor(prev => ({...prev, otherWallType: val})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherWallTypeSensor' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Risk Level</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(['Low', 'Medium', 'High'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setCurrentSensor(prev => ({...prev, riskLevel: level}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.riskLevel === level ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {level.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Primary Intrusion Concern (Select Multiple)</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['Door', 'Window', 'Motion', 'Glass', 'Panic', 'Other'].map(concern => (
                    <button
                      key={concern}
                      onClick={() => {
                        toggleIntrusionConcern(concern);
                        if (concern === 'Other' && currentSensor.intrusionConcern?.includes('Other')) {
                          setCurrentSensor(prev => ({...prev, otherIntrusionConcern: ''}));
                        }
                      }}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.intrusionConcern?.includes(concern) ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {concern.toUpperCase()}
                    </button>
                  ))}
                </div>
                {currentSensor.intrusionConcern?.includes('Other') && (
                  <div className="relative mt-2 animate-fade-in">
                    <input 
                      placeholder="Specify Concern"
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={currentSensor.otherIntrusionConcern || ''}
                      onChange={e => setCurrentSensor(prev => ({...prev, otherIntrusionConcern: e.target.value}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherIntrusionConcern', (val) => setCurrentSensor(prev => ({...prev, otherIntrusionConcern: val})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherIntrusionConcern' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Obstructions (Select Multiple)</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['Curtains', 'Shelves', 'Glass', 'Partitions', 'Furniture', 'Other'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        toggleObstructions(opt);
                        if (opt === 'Other' && currentSensor.obstructions?.includes('Other')) {
                          setCurrentSensor(prev => ({...prev, otherObstructions: ''}));
                        }
                      }}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentSensor.obstructions?.includes(opt) ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {currentSensor.obstructions?.includes('Other') && (
                  <div className="relative mt-2 animate-fade-in">
                    <input 
                      placeholder="Specify Obstructions"
                      className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={currentSensor.otherObstructions || ''}
                      onChange={e => setCurrentSensor(prev => ({...prev, otherObstructions: e.target.value}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherObstructions', (val) => setCurrentSensor(prev => ({...prev, otherObstructions: val})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherObstructions' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Quantity</label>
                <div className="relative mt-1">
                  <input 
                    type="number"
                    min="0"
                    className="w-full bg-white border-2 border-slate-200 p-4 pr-10 rounded-xl font-bold text-xs outline-none"
                    value={currentSensor.count === 0 ? '' : currentSensor.count}
                    onChange={e => setCurrentSensor(prev => ({...prev, count: Math.max(0, parseInt(e.target.value) || 0)}))}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('sensorCount', (val) => setCurrentSensor(prev => ({...prev, count: val})), true)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'sensorCount' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={addSensor}
                  disabled={!currentSensor.location || !currentSensor.type || !currentSensor.connection || !currentSensor.riskLevel || !currentSensor.intrusionConcern?.length || !currentSensor.environment || !currentSensor.obstructions?.length || !currentSensor.wallType}
                  className="w-full py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px] disabled:opacity-30 disabled:bg-slate-200 disabled:shadow-none"
                >
                  {editingSensorIndex !== null ? 'UPDATE BURGLAR ALARM ENTRY' : 'SAVE BURGLAR ALARM ENTRY'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Burglar Alarm Units ({data.sensors.length})</h3>
              </div>
              {data.sensors.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No burglar alarm units mapped yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.sensors.map((sensor, idx) => (
                    <div key={sensor.id} className="bg-slate-50 p-4 rounded-xl border-l-4 border-blue-900 shadow-sm flex justify-between items-center text-left">
                      <div className="flex items-center gap-4">
                        {sensor.image && (
                          <img src={sensor.image} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Sensor" />
                        )}
                        <div>
                          <p className="font-black text-blue-900 uppercase text-[10px]">{sensor.location}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{sensor.type} x{sensor.count} • {sensor.connection} • {sensor.riskLevel} Risk • {sensor.environment}</p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {sensor.wallType && <p className="text-[7px] font-black text-blue-900 uppercase leading-none">Wall: {sensor.wallType === 'Other' ? sensor.otherWallType : sensor.wallType}</p>}
                            {sensor.intrusionConcern && sensor.intrusionConcern.length > 0 && <p className="text-[7px] font-black text-slate-400 uppercase leading-none">Concern: {sensor.intrusionConcern.join(', ')}</p>}
                            {sensor.obstructions && sensor.obstructions.length > 0 && <p className="text-[7px] font-black text-slate-400 uppercase leading-none">Obstruction: {sensor.obstructions.join(', ')}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => copySensor(sensor)} className="text-blue-600 min-w-[2.5rem] h-10 px-3 hover:bg-blue-50 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Copy unit" title="Copy">
                          Copy
                        </button>
                        <button onClick={() => editSensor(sensor, idx)} className="text-slate-600 min-w-[2.5rem] h-10 px-3 hover:bg-slate-100 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Edit unit" title="Edit">
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setData(prev => ({ ...prev, sensors: prev.sensors.filter((_, i) => i !== idx) }));
                            if (editingSensorIndex === idx) {
                              setEditingSensorIndex(null);
                              resetSensorForm();
                            } else if (editingSensorIndex !== null && idx < editingSensorIndex) {
                              setEditingSensorIndex(editingSensorIndex - 1);
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

            <div className="pt-10 space-y-3 pb-10">
              <button 
                disabled={data.sensors.length === 0}
                onClick={() => setStep('PANEL')}
                className={`w-full py-4 font-black rounded-xl shadow-xl uppercase tracking-widest transition ${data.sensors.length > 0 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT: CONTROL PANEL
              </button>
              <button onClick={() => setStep('BUILDING')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest text-center">Back</button>
            </div>
          </div>
        )}

        {step === 'PANEL' && (
          <div className="animate-fade-in space-y-6 pb-12">
            <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight text-left">Panel Configuration</h3>
            
            <div className="space-y-4">
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Panel Location</label>
                <div className="relative mt-1">
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold"
                    value={data.controlPanel.location}
                    onChange={e => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, location: e.target.value}}))}
                  />
                  <button 
                    onClick={() => startVoiceInput('panelLoc', (val) => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, location: val}})))}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'panelLoc' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Cable Routing Path</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Ceiling', 'Conduit', 'Trunking', 'Other'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => {
                        setData(prev => ({...prev, controlPanel: {...prev.controlPanel, cableRoutingPath: opt}}));
                        if (opt !== 'Other') {
                          setData(prev => ({...prev, controlPanel: {...prev.controlPanel, otherCableRoutingPath: ''}}));
                        }
                      }}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlPanel.cableRoutingPath === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {data.controlPanel.cableRoutingPath === 'Other' && (
                  <div className="relative mt-2 animate-fade-in">
                    <input 
                      placeholder="Specify Routing Path"
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs"
                      value={data.controlPanel.otherCableRoutingPath || ''}
                      onChange={e => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, otherCableRoutingPath: e.target.value}}))}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherRoutingPath', (val) => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, otherCableRoutingPath: val}})))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherRoutingPath' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estimated Cable Length (meters)</label>
                <div className="relative mt-1">
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold focus:outline-none focus:border-blue-900 transition"
                    value={data.controlPanel.estimatedCableLength ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      setData(prev => ({...prev, controlPanel: {...prev.controlPanel, estimatedCableLength: isNaN(val as any) ? undefined : Math.max(0, val!)}}));
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('estCableLenBA', (val) => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, estimatedCableLength: val}})), true)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'estCableLenBA' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Siren Location</label>
                <div className="relative mt-1">
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold"
                    value={data.controlPanel.sirenLocation || ''}
                    onChange={e => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, sirenLocation: e.target.value}}))}
                  />
                  <button 
                    onClick={() => startVoiceInput('sirenLoc', (val) => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, sirenLocation: val}})))}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'sirenLoc' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Siren Type Required</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['Internal', 'External'] as const).map(st => (
                    <button 
                      key={st}
                      onClick={() => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, sirenTypeRequired: st}}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlPanel.sirenTypeRequired === st ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {st.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Monitoring Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['Self-Monitoring', 'Central Monitoring'] as const).map(mt => (
                    <button 
                      key={mt}
                      onClick={() => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, monitoringType: mt}}))}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlPanel.monitoringType === mt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {mt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Alarm Notification Method (Select Multiple)</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['SMS', 'App', 'Call'].map(nm => (
                    <button 
                      key={nm}
                      onClick={() => toggleNotificationMethod(nm)}
                      className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${data.controlPanel.notificationMethod?.includes(nm) ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >{nm.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              {[
                { label: 'Pets Present?', key: 'petsPresent' },
                { label: 'SIM Card for GSM Needed?', key: 'simCardRequired' },
                { label: 'Internet Monitoring App?', key: 'internetRequired' },
                { label: 'Power source available?', key: 'powerSourceAvailable' }
              ].map(item => (
                <div key={item.key} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  <div className="flex gap-2">
                     <button 
                      onClick={() => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, [item.key]: true}}))}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition ${data.controlPanel[item.key as keyof typeof data.controlPanel] === true ? 'bg-blue-900 text-white' : 'bg-white text-slate-400'}`}
                     >YES</button>
                     <button 
                      onClick={() => setData(prev => ({...prev, controlPanel: {...prev.controlPanel, [item.key]: false}}))}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition ${data.controlPanel[item.key as keyof typeof data.controlPanel] === false ? 'bg-red-600 text-white' : 'bg-white text-slate-400'}`}
                     >NO</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-10 space-y-3 pb-10">
              <button 
                onClick={() => {
                   if (data.controlPanel.simCardRequired === undefined) {
                      alert("Please complete Panel configuration.");
                      return;
                   }
                   onComplete(data);
                }}
                className="w-full py-4 bg-amber-500 text-blue-900 font-black rounded-xl shadow-xl uppercase tracking-widest active:scale-95 transition"
              >
                GENERATE ESTIMATION
              </button>
              <button onClick={() => setStep('SENSORS')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest text-center">Back to Sensors</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BurglarAlarmSurvey;