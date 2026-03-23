import React, { useState, useEffect, useRef } from 'react';
import { CameraEntry, CCTVSurveyData, BuildingMeasurements } from '../types';
import { BUILDING_TYPES, CAMERA_PURPOSES, CAMERA_TYPES, RESOLUTIONS, LIGHTING_CONDITIONS } from '../constants';
import { processNumeric, processTitleCase } from '../utils/voiceProcessing';
import FloorPlanManager from './12_FloorPlanManager';

interface Props {
  /** Callback to return to the project metadata form. Receives current draft so it can be restored when returning. */
  onBack: (draft?: CCTVSurveyData) => void;
  /** Callback to finalize the technical audit and move to estimation. */
  onComplete: (data: CCTVSurveyData) => void;
  /** Callback when a new floor plan is uploaded. */
  onNewFloorPlan?: () => void;
  /** Optional initial data for editing mode. */
  initialData?: CCTVSurveyData;
}

/**
 * CCTV SURVEY COMPONENT
 * Purpose: This multi-step wizard handles the complete technical audit of a CCTV system.
 * 
 * Logic Flow:
 *  1. BUILDING: Capture structural info (floors, type).
 *  2. CAMERAS: Map individual unit specs (type, location).
 *  3. INFRASTRUCTURE/CONTROL: Log cabling logic and NVR requirements.
 */
const CCTVSurvey: React.FC<Props> = ({ onBack, onComplete, onNewFloorPlan, initialData }) => {
  // --- WORKFLOW STATE ---
  const [step, setStep] = useState<'BUILDING' | 'CAMERAS' | 'EQUIPMENT'>('BUILDING');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // --- AUDIT DATA BUFFERS ---
  const [buildingInfo, setBuildingInfo] = useState<CCTVSurveyData['buildingInfo']>({
    type: '', // NEUTRAL START
    otherType: '',
    floors: undefined as any,
    isNew: undefined as any
  });
  const [cameras, setCameras] = useState<CameraEntry[]>([]);
  const [infrastructure, setInfrastructure] = useState<CCTVSurveyData['infrastructure']>({
    cablePath: '', // NEUTRAL START
    otherCablePath: '',
    wallType: '', // NEUTRAL START
    otherWallType: '',
    coreDrilling: false
  });
  const [controlRoom, setControlRoom] = useState<CCTVSurveyData['controlRoom']>({
    nvrLocation: '',
    rackAvailable: undefined, // NEUTRAL START
    powerSocketAvailable: undefined, // NEUTRAL START
    upsRequired: undefined, // NEUTRAL START
    networkSwitchAvailable: undefined, // NEUTRAL START
    internetAvailable: undefined // NEUTRAL START
  });
  const [measurements, setMeasurements] = useState<BuildingMeasurements | undefined>(initialData?.measurements);

  const [currentCamera, setCurrentCamera] = useState<Partial<CameraEntry>>({
    locationName: '',
    purposes: [],
    type: undefined,
    resolution: undefined,
    lightingCondition: undefined,
    environment: undefined,
    mountingHeight: undefined,
    coverageDistanceMeters: undefined,
    scopeStatus: '',
    cableType: undefined as any,
    otherCableType: '',
    cableLength: undefined
  });
  const [cableLengthInput, setCableLengthInput] = useState<string>('');
  const [cameraImage, setCameraImage] = useState<string | null>(null);

  const [isListeningBuilding, setIsListeningBuilding] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  /** When non-null, Save will update this index instead of appending a new entry. */
  const [editingCameraIndex, setEditingCameraIndex] = useState<number | null>(null);

  /**
   * INITIALIZATION
   * Logic: Populates buffers if editing an existing survey.
   */
  useEffect(() => {
    if (initialData) {
      setBuildingInfo(initialData.buildingInfo);
      setMeasurements(initialData.measurements);
      setCameras(initialData.cameras);
      setInfrastructure(initialData.infrastructure);
      setControlRoom(initialData.controlRoom);
    }
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
   * Logic: Validates that a building type is selected, and if 'Other' is chosen, 
   * ensures the manual specification text field is not empty.
   */
  const isStep1Complete = !!buildingInfo.type && (buildingInfo.type !== 'Other' || !!buildingInfo.otherType?.trim()) && buildingInfo.floors !== undefined && buildingInfo.isNew !== undefined;

  /**
   * FUNCTION: handleHeaderBack
   * Logic: Implements nested back navigation within the 3-step wizard.
   */
  const handleHeaderBack = () => {
    if (step === 'EQUIPMENT') {
      setStep('CAMERAS');
    } else if (step === 'CAMERAS') {
      setStep('BUILDING');
    } else {
      onBack({ buildingInfo, measurements, cameras, infrastructure, controlRoom });
    }
  };

  const handleCameraImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCameraImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleCameraPurpose = (p: string) => {
    const current = currentCamera.purposes || [];
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
    setCurrentCamera({ ...currentCamera, purposes: next });
  };

  const saveCameraEntry = () => {
    if (!currentCamera.locationName?.trim()) {
      alert("Please enter a Location Name.");
      return;
    }
    if (currentCamera.mountingHeight === undefined || isNaN(currentCamera.mountingHeight)) {
      alert("Please specify the Mounting Height.");
      return;
    }
    if (!currentCamera.environment) {
      alert("Please select an Environment (Indoor/Outdoor).");
      return;
    }
    if (!currentCamera.type) {
      alert("Please select a Camera Type.");
      return;
    }
    if (!currentCamera.resolution) {
      alert("Please select a Resolution.");
      return;
    }
    if (!currentCamera.lightingCondition) {
      alert("Please specify the Lighting Condition.");
      return;
    }
    if (!currentCamera.scopeStatus || !['New Installation', 'Expansion', 'Replacement'].includes(currentCamera.scopeStatus)) {
      alert("Please select a Scope Status.");
      return;
    }
    if (!currentCamera.cableType) {
      alert("Please select a Cable Type.");
      return;
    }
    if (currentCamera.cableType === 'Other' && !currentCamera.otherCableType?.trim()) {
      alert("Please specify the Cable Type.");
      return;
    }
    if (!cableLengthInput || isNaN(parseFloat(cableLengthInput))) {
      alert("Please enter the Estimated Cable Length.");
      return;
    }

    const newCamera: CameraEntry = {
      ...currentCamera,
      id: Math.random().toString(36).substr(2, 9),
      cableLength: parseFloat(cableLengthInput) || 0,
      image: cameraImage || undefined
    } as CameraEntry;

    if (editingCameraIndex !== null) {
      const next = [...cameras];
      next[editingCameraIndex] = newCamera;
      setCameras(next);
      setEditingCameraIndex(null);
    } else {
      setCameras([...cameras, newCamera]);
    }

    // Reset form
    setCurrentCamera({
      locationName: '',
      purposes: [],
      type: undefined,
      resolution: undefined,
      lightingCondition: undefined,
      environment: undefined,
      mountingHeight: undefined,
      coverageDistanceMeters: undefined,
      scopeStatus: '',
      cableType: undefined as any,
      otherCableType: '',
      cableLength: undefined
    });
    setCableLengthInput('');
    setCameraImage(null);
  };

  /** Duplicate a saved camera entry with a new id and add to the list. */
  const copyCameraEntry = (cam: CameraEntry) => {
    setCameras([...cameras, { ...cam, id: Math.random().toString(36).substr(2, 9) }]);
  };

  /** Load a saved entry into the form for editing; Save will replace this entry. */
  const editCameraEntry = (cam: CameraEntry, idx: number) => {
    setCurrentCamera({
      locationName: cam.locationName,
      purposes: cam.purposes ?? [],
      type: cam.type,
      resolution: cam.resolution,
      lightingCondition: cam.lightingCondition,
      environment: cam.environment,
      mountingHeight: cam.mountingHeight,
      coverageDistanceMeters: cam.coverageDistanceMeters,
      scopeStatus: (cam as any).scopeStatus ?? ((cam as any).existing === true ? 'Replacement' : (cam as any).existing === false ? 'New Installation' : ''),
      cableType: cam.cableType,
      otherCableType: (cam as any).otherCableType ?? '',
      cableLength: cam.cableLength
    });
    setCableLengthInput(String(cam.cableLength ?? ''));
    setCameraImage((cam as any).image ?? null);
    setEditingCameraIndex(idx);
  };

  /**
   * FUNCTION: handleComplete
   * Purpose: Consolidates all audit buffers into a single CCTVSurveyData object.
   * Output: Calls the onComplete prop to move the user to the next phase (Estimation).
   */
  const handleComplete = () => {
    // FINAL VALIDATION FOR STEP 3
    if (!infrastructure.cablePath) {
      alert("Please select a Primary Cable Path.");
      return;
    }
    if (!infrastructure.wallType) {
      alert("Please select a Wall / Surface Type.");
      return;
    }
    if (
      controlRoom.rackAvailable === undefined ||
      controlRoom.powerSocketAvailable === undefined ||
      controlRoom.upsRequired === undefined ||
      controlRoom.networkSwitchAvailable === undefined ||
      controlRoom.internetAvailable === undefined
    ) {
      alert("Please complete all Equipment requirements (YES/NO).");
      return;
    }

    onComplete({
      buildingInfo,
      measurements,
      cameras,
      infrastructure,
      controlRoom
    });
  };

  /**
   * FUNCTION: startVoiceInput
   * Purpose: Direct field dictation helper.
   * Inputs: fieldName, state setter, and isNumeric flag for data processing.
   */
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

  /**
   * FUNCTION: startVoiceBuilding
   * Purpose: Structural dictation. Automatically matches spoken building types to the constants list.
   */
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
        setBuildingInfo(prev => ({ ...prev, type: match }));
      }
    };
    recognition.start();
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* 
          PROGRESSIVE HEADER 
          UI Note: Circles (B, C, E) represent progress through Building, Cameras, and Equipment phases.
      */}
      <header className="p-4 bg-blue-900 flex items-center justify-between sticky top-0 z-10 shadow-lg text-white">
        <button onClick={handleHeaderBack} className="text-white flex items-center">
          <i className="fas fa-chevron-left mr-2"></i>
          <span className="font-bold">CCTV Survey</span>
        </button>
        <div className="flex space-x-2">
          {['B', 'C', 'E'].map((s, idx) => {
            const currentIdx = ['BUILDING', 'CAMERAS', 'EQUIPMENT'].indexOf(step);
            return (
              <div key={s} className={`w-3 h-3 rounded-full ${idx === currentIdx ? 'bg-amber-400' : 'bg-blue-700'}`}></div>
            );
          })}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-32 text-slate-900">
        
        {/* STEP 1: BUILDING CONTEXT */}
        {step === 'BUILDING' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-5 mb-5">
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
                  onClick={() => setBuildingInfo(prev => ({...prev, type}))}
                  className={`py-4 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border-2 ${
                    buildingInfo.type === type 
                      ? 'bg-blue-900 text-white border-blue-900 shadow-md' 
                      : 'bg-slate-50 border-slate-50 text-slate-700 hover:border-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            
            {buildingInfo.type === 'Other' && (
              <div className="animate-fade-in pt-2 text-left">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Building Type</label>
                <div className="relative">
                  <input 
                    className={`w-full bg-slate-50 border-2 p-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-[10px] ${showErrors && buildingInfo.type === 'Other' && !buildingInfo.otherType?.trim() ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
                    value={buildingInfo.otherType || ''}
                    placeholder="Specify Building Type"
                    autoComplete="off"
                    onChange={(e) => setBuildingInfo(prev => ({...prev, otherType: e.target.value}))}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('otherBuilding', (val) => setBuildingInfo(prev => ({...prev, otherType: val})))}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherBuilding' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-slate-100 text-left grid grid-cols-1 md:grid-cols-2 md:gap-5 md:space-y-0">
               <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 md:col-span-2">Site Specifications</h4>
               <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 ml-1">Status</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={() => setBuildingInfo(prev => ({...prev, isNew: true}))}
                     className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${buildingInfo.isNew === true ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                   >
                     NEW BUILD
                   </button>
                   <button
                     onClick={() => setBuildingInfo(prev => ({...prev, isNew: false}))}
                     className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${buildingInfo.isNew === false ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
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
                     value={buildingInfo.floors === undefined ? '' : buildingInfo.floors}
                     autoComplete="off"
                     onChange={e => {
                       const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                       setBuildingInfo(prev => ({...prev, floors: (val === undefined || isNaN(val)) ? undefined as any : Math.max(0, val)}));
                     }}
                   />
                   <button 
                     type="button"
                     onClick={() => startVoiceInput('floors', (val) => setBuildingInfo(prev => ({...prev, floors: val})), true)}
                     className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'floors' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                   >
                     <i className="fas fa-microphone"></i>
                   </button>
                 </div>
               </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100">
               <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-3 text-left">4.3 Floor Plan & Measurements</h4>
               <FloorPlanManager 
                 initialData={measurements}
                 onChange={setMeasurements}
                 onNewUpload={onNewFloorPlan}
                 activeVoiceField={activeVoiceField}
                 startVoiceInput={startVoiceInput}
               />
            </div>
            </div>
            
            <div className="pb-8">
              <button 
                onClick={() => {
                  if (!isStep1Complete) {
                    setShowErrors(true);
                  } else {
                    setStep('CAMERAS');
                  }
                }}
                className={`w-full py-6 font-black rounded-xl uppercase tracking-widest transition text-[10px] ${isStep1Complete ? 'bg-blue-900 text-white shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400 shadow-none'}`}
              >
                NEXT: CCTV DETAILS
              </button>
              {showErrors && !isStep1Complete && (
                <p className="text-[10px] text-red-500 font-black text-center mt-3 uppercase tracking-widest animate-pulse">
                  Complete building specifications to proceed
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CAMERA INVENTORY */}
        {step === 'CAMERAS' && (
          <div className="animate-fade-in space-y-5">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Add CCTV Entry</h3>
              </div>

              {/* Site Reference Photo */}
              <section className="space-y-3 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Site Reference Photo</label>
                <div className="relative group">
                  {cameraImage ? (
                    <div className="relative animate-fade-in">
                      <img src={cameraImage} className="w-full aspect-video object-cover rounded-[2rem] border-2 border-slate-100 shadow-xl max-h-[140px]" alt="Camera Site" />
                      <button 
                        onClick={() => setCameraImage(null)}
                        className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full aspect-video max-h-[140px] border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-50 transition bg-white text-slate-400 group-hover:border-blue-300">
                      <i className="fas fa-camera text-4xl mb-3"></i>
                      <span className="text-[10px] font-black uppercase tracking-widest">TAP TO CAPTURE SITE</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraImageUpload} />
                    </label>
                  )}
                </div>
              </section>

              {/* Core Specs */}
              <section className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">Scope Status</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['New Installation', 'Expansion', 'Replacement'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCurrentCamera({ ...currentCamera, scopeStatus: opt })}
                        className={`py-3 rounded-xl font-black border-2 text-[10px] transition ${currentCamera.scopeStatus === opt ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-blue-900 uppercase ml-1 tracking-wider">CCTV Location Name</label>
                  <div className="relative mt-1">
                    <input 
                      className="w-full h-[58px] bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900 text-[10px]"
                      value={currentCamera.locationName}
                      autoComplete="off"
                      onChange={e => setCurrentCamera({...currentCamera, locationName: e.target.value})}
                    />
                    <button 
                      onClick={() => startVoiceInput('locName', (val) => setCurrentCamera({...currentCamera, locationName: val}))}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'locName' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mounting Height (m)</label>
                    <div className="relative mt-1">
                      <input 
                        type="number" step="0.5"
                        className="w-full h-[58px] bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold focus:outline-none focus:border-blue-900 text-[10px]"
                        value={currentCamera.mountingHeight === undefined ? '' : currentCamera.mountingHeight}
                        autoComplete="off"
                        onChange={e => setCurrentCamera({...currentCamera, mountingHeight: e.target.value === '' ? undefined : parseFloat(e.target.value)})}
                      />
                      <button onClick={() => startVoiceInput('height', (val) => setCurrentCamera({...currentCamera, mountingHeight: parseFloat(val) || 0}), true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Environment</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl mt-1">
                    {['Indoor', 'Outdoor'].map(env => (
                      <button 
                        key={env}
                        onClick={() => setCurrentCamera({...currentCamera, environment: env as any})}
                        className={`flex-1 py-4 rounded-lg text-[10px] font-black transition ${currentCamera.environment === env ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400'}`}
                      >{env.toUpperCase()}</button>
                    ))}
                  </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2">Camera Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CAMERA_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setCurrentCamera({...currentCamera, type: type as any})}
                        className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${currentCamera.type === type ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2">Resolution</label>
                  <div className="grid grid-cols-4 gap-2">
                    {RESOLUTIONS.map(res => (
                      <button
                        key={res}
                        onClick={() => setCurrentCamera({...currentCamera, resolution: res as any})}
                        className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${currentCamera.resolution === res ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Coverage / Viewing Distance (m)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="w-full h-[58px] bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold focus:outline-none focus:border-blue-900 text-[10px]"
                      value={currentCamera.coverageDistanceMeters === undefined ? '' : currentCamera.coverageDistanceMeters}
                      autoComplete="off"
                      onChange={e => setCurrentCamera({ ...currentCamera, coverageDistanceMeters: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                    />
                    <button
                      type="button"
                      onClick={() => startVoiceInput('coverageDist', (val) => setCurrentCamera({ ...currentCamera, coverageDistanceMeters: parseFloat(val) || undefined }), true)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'coverageDist' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2">Lighting Condition</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LIGHTING_CONDITIONS.map(cond => (
                      <button
                        key={cond}
                        onClick={() => setCurrentCamera({...currentCamera, lightingCondition: cond as any})}
                        className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${currentCamera.lightingCondition === cond ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                        {cond.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2">CCTV Purposes (Select Multiple)</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {CAMERA_PURPOSES.map(p => (
                      <button
                        key={p}
                        onClick={() => toggleCameraPurpose(p)}
                        className={`py-4 rounded-xl text-[10px] font-black transition border-2 ${currentCamera.purposes?.includes(p) ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2">Cable Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Cat5e', 'Cat6', 'Cat6a', 'Fiber', 'Coaxial', 'Other'] as const).map(cable => (
                      <button
                        key={cable}
                        type="button"
                        onClick={() => setCurrentCamera({ ...currentCamera, cableType: cable, otherCableType: cable === 'Other' ? currentCamera.otherCableType : '' })}
                        className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${currentCamera.cableType === cable ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                        {cable.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {currentCamera.cableType === 'Other' && (
                    <div className="animate-fade-in pt-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Cable Type</label>
                      <div className="relative">
                        <input
                          className="w-full h-[58px] bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900 text-[10px]"
                          value={currentCamera.otherCableType || ''}
                          autoComplete="off"
                          onChange={(e) => setCurrentCamera({ ...currentCamera, otherCableType: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => startVoiceInput('otherCamCableType', (val) => setCurrentCamera({ ...currentCamera, otherCableType: val }))}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCamCableType' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        >
                          <i className="fas fa-microphone"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estimated Cable Length (meters)</label>
                  <div className="relative mt-1">
                    <input 
                      type="number"
                      className="w-full h-[58px] bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold focus:outline-none focus:border-blue-900 text-[10px]"
                      value={cableLengthInput}
                      autoComplete="off"
                      onChange={e => setCableLengthInput(e.target.value)}
                    />
                    <button 
                      onClick={() => startVoiceInput('cableLength', setCableLengthInput, true)} 
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'cableLength' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>
              </section>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={saveCameraEntry}
                  className="w-full py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px]"
                >
                  {editingCameraIndex !== null ? 'UPDATE CCTV ENTRY' : 'SAVE CCTV ENTRY'}
                </button>
              </div>
            </div>

            {/* CCTV Units List */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">CCTV Units ({cameras.length})</h3>
              </div>

              {cameras.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No CCTV units mapped yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {cameras.map((cam, idx) => (
                    <div key={cam.id} className="bg-slate-50 p-4 rounded-xl border-l-4 border-blue-900 shadow-sm flex justify-between items-center text-left">
                      <div className="flex items-center gap-4">
                        {(cam as any).image && (
                          <img src={(cam as any).image} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Camera" />
                        )}
                        <div>
                          <p className="font-black text-blue-900 uppercase text-[10px]">{cam.locationName}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{cam.type} • {cam.resolution} • {cam.environment}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => copyCameraEntry(cam)} className="text-blue-600 min-w-[2.5rem] h-10 px-3 hover:bg-blue-50 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Copy camera" title="Copy">
                          Copy
                        </button>
                        <button onClick={() => editCameraEntry(cam, idx)} className="text-slate-600 min-w-[2.5rem] h-10 px-3 hover:bg-slate-100 rounded-full transition flex items-center justify-center text-[10px] font-bold uppercase" aria-label="Edit camera" title="Edit">
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setCameras(cameras.filter((_, i) => i !== idx));
                            if (editingCameraIndex === idx) {
                              setEditingCameraIndex(null);
                              setCurrentCamera({ locationName: '', purposes: [], type: undefined, resolution: undefined, lightingCondition: undefined, environment: undefined, mountingHeight: undefined, coverageDistanceMeters: undefined, scopeStatus: '', cableType: undefined as any, otherCableType: '', cableLength: undefined });
                              setCableLengthInput('');
                              setCameraImage(null);
                            } else if (editingCameraIndex !== null && idx < editingCameraIndex) {
                              setEditingCameraIndex(editingCameraIndex - 1);
                            }
                          }}
                          className="text-red-500 w-10 h-10 hover:bg-red-50 rounded-full transition flex items-center justify-center"
                          aria-label="Delete camera"
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

            <div className="space-y-2 pb-8">
              <button 
                disabled={cameras.length === 0}
                onClick={() => setStep('EQUIPMENT')}
                className={`w-full py-6 font-black rounded-xl shadow-lg transition active:scale-95 uppercase tracking-widest text-[10px] ${cameras.length > 0 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                NEXT: INFRASTRUCTURE
              </button>
              <button onClick={() => setStep('BUILDING')} className="w-full text-blue-600 font-black uppercase text-[10px] tracking-widest py-4 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition">Back to Building</button>
            </div>
          </div>
        )}

        {/* STEP 3: INFRASTRUCTURE & CONTROL */}
        {step === 'EQUIPMENT' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6 mb-6">
              <section className="space-y-4 text-left">
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-project-diagram"></i>
                Cabling Infrastructure
              </h3>
              
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block ml-1 tracking-widest">Primary Cable Path</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Ceiling', 'Trunking', 'Open Cable', 'Other'].map(path => (
                    <button
                      key={path}
                      onClick={() => setInfrastructure({...infrastructure, cablePath: path as any})}
                      className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${infrastructure.cablePath === path ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                    >
                      {path.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {infrastructure.cablePath === 'Other' && (
                <div className="animate-fade-in pt-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Primary Cable Path</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 focus:outline-none focus:border-blue-900 transition font-bold text-[10px]"
                      value={infrastructure.otherCablePath || ''}
                      placeholder="Specify Primary Cable Path"
                      autoComplete="off"
                      onChange={(e) => setInfrastructure({...infrastructure, otherCablePath: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherCable', (val) => setInfrastructure({...infrastructure, otherCablePath: val}))}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCable' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block ml-1 tracking-widest">Wall / Surface Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Concrete', 'Gypsum', 'Glass', 'Steel', 'Brick', 'Other'].map(wall => (
                    <button
                      key={wall}
                      onClick={() => setInfrastructure({...infrastructure, wallType: wall as any})}
                      className={`py-4 rounded-xl text-[10px] font-black border-2 transition ${infrastructure.wallType === wall ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                    >
                      {wall.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {infrastructure.wallType === 'Other' && (
                <div className="animate-fade-in pt-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Wall / Surface Type</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 focus:outline-none focus:border-blue-900 transition font-bold text-[10px]"
                      value={infrastructure.otherWallType || ''}
                      placeholder="Specify Wall / Surface Type"
                      autoComplete="off"
                      onChange={(e) => setInfrastructure({...infrastructure, otherWallType: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('otherWall', (val) => setInfrastructure({...infrastructure, otherWallType: val}))}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherWall' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <i className="fas fa-hammer text-blue-900"></i>
                  <span className="text-[10px] font-bold text-blue-900">Core Drilling Required?</span>
                </div>
                <input 
                  type="checkbox"
                  className="w-6 h-6 rounded accent-blue-900"
                  checked={infrastructure.coreDrilling}
                  onChange={(e) => setInfrastructure({...infrastructure, coreDrilling: e.target.checked})}
                />
              </div>
            </section>

            <section className="space-y-4 text-left">
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-server"></i>
                Control Room (NVR)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1 tracking-widest">VMS/NVR Final Location</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900 transition text-[10px]"
                      value={controlRoom.nvrLocation}
                      autoComplete="off"
                      onChange={(e) => setControlRoom({...controlRoom, nvrLocation: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => startVoiceInput('nvrLocation', (val) => setControlRoom({...controlRoom, nvrLocation: val}))}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'nvrLocation' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    >
                      <i className="fas fa-microphone"></i>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1 tracking-widest block">Storage Requirement (TB)</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900 transition text-[10px]"
                        value={controlRoom.storageRequirementTB === undefined ? '' : controlRoom.storageRequirementTB}
                        onChange={(e) => setControlRoom({ ...controlRoom, storageRequirementTB: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                      />
                      <button
                        type="button"
                        onClick={() => startVoiceInput('storageTB', (val) => setControlRoom({ ...controlRoom, storageRequirementTB: parseFloat(val) || undefined }), true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'storageTB' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1 tracking-widest block">Retention (days)</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        min="1"
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-900 transition text-[10px]"
                        value={controlRoom.retentionDays === undefined ? '' : controlRoom.retentionDays}
                        onChange={(e) => setControlRoom({ ...controlRoom, retentionDays: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                      />
                      <button
                        type="button"
                        onClick={() => startVoiceInput('retentionDays', (val) => setControlRoom({ ...controlRoom, retentionDays: parseInt(val, 10) || undefined }), true)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'retentionDays' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {[
                  { label: 'Equipment Rack Available?', key: 'rackAvailable' },
                  { label: 'Dedicated Power Socket?', key: 'powerSocketAvailable' },
                  { label: 'UPS/Backup Required?', key: 'upsRequired' },
                  { label: 'Network Switch Port?', key: 'networkSwitchAvailable' },
                  { label: 'Internet Access?', key: 'internetAvailable' },
                ].map(item => (
                  <div key={item.key} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{item.label}</span>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setControlRoom({...controlRoom, [item.key]: true})}
                        className={`px-5 py-2 rounded-lg text-[10px] font-black transition ${controlRoom[item.key as keyof typeof controlRoom] === true ? 'bg-blue-900 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400'}`}
                      >
                        YES
                      </button>
                      <button 
                        onClick={() => setControlRoom({...controlRoom, [item.key]: false})}
                        className={`px-5 py-2 rounded-lg text-[10px] font-black transition ${controlRoom[item.key as keyof typeof controlRoom] === false ? 'bg-red-600 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400'}`}
                      >
                        NO
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            </div>

            <div className="space-y-2 pb-8">
              <button 
                onClick={handleComplete}
                className="w-full py-4 bg-amber-500 text-blue-900 font-black rounded-xl shadow-lg uppercase tracking-widest active:scale-95 transition text-[10px]"
              >
                PROCEED TO ESTIMATION
              </button>
              <button onClick={() => setStep('CAMERAS')} className="w-full text-blue-600 font-black uppercase text-[10px] tracking-widest py-4 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition">Back to Units</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CCTVSurvey;