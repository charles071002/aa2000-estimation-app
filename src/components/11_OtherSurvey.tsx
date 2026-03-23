import React, { useState, useEffect, useRef } from 'react';
import { OtherSurveyData } from '../types';
import { BUILDING_TYPES } from '../constants';
import { processNumeric, processTitleCase } from '../utils/voiceProcessing';
import FloorPlanManager from './12_FloorPlanManager';

interface Props {
  /** Receives current draft so it can be restored when returning. */
  onBack: (draft?: OtherSurveyData) => void;
  onComplete: (data: OtherSurveyData) => void;
  onNewFloorPlan?: () => void;
  initialData?: OtherSurveyData;
}

/**
 * OTHER SURVEY COMPONENT
 * Handles generic or custom technological audits.
 */
const OtherSurvey: React.FC<Props> = ({ onBack, onComplete, onNewFloorPlan, initialData }) => {
  const [step, setStep] = useState<'BUILDING' | 'DETAILS'>('BUILDING');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<OtherSurveyData>({
    buildingInfo: { type: '', otherType: '', floors: 0, isNew: undefined as any },
    siteImage: undefined,
    systemCategory: '',
    otherSystemCategory: '',
    scopeOfWork: '',
    otherScopeOfWork: '',
    coverageArea: '',
    otherCoverageArea: '',
    serviceDetails: '',
    estimatedCost: 0,
    ceilingType: '',
    otherCeilingType: '',
    materialsCost: 0,
    cablesCost: 0
  });

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
    if (step === 'DETAILS') setStep('BUILDING');
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

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* HEADER SECTION */}
      <header className="p-4 bg-blue-900 flex items-center justify-between shrink-0 text-white shadow-lg z-10">
        <button onClick={handleHeaderBack} className="text-white flex items-center gap-2">
          <i className="fas fa-chevron-left text-lg"></i>
          <span className="font-bold">Other Survey</span>
        </button>
        <div className="flex space-x-2">
          {['B', 'D'].map((s, idx) => (
            <div key={s} className={`w-3 h-3 rounded-full ${idx === (step === 'BUILDING' ? 0 : 1) ? 'bg-amber-400' : 'bg-blue-700'}`}></div>
          ))}
        </div>
      </header>

      {/* SCROLLABLE FORM BODY */}
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
                NEXT: SERVICE DETAILS
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
          <div className="animate-fade-in space-y-6 pb-12">
            <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight border-l-4 border-amber-500 pl-3 text-left">Service Details</h3>
            
            <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[2.5rem] space-y-6 shadow-sm">
              {/* SITE REFERENCE PHOTO SECTION */}
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

              {/* SYSTEM CATEGORY SECTION */}
              <div className="text-left space-y-3 pt-4 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block tracking-widest">System Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Intercom', 'Turnstile', 'Boom Barrier', 'Others (Specify)'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setData(prev => ({...prev, systemCategory: cat}))}
                      className={`h-[52px] px-2 rounded-xl font-black border-2 transition uppercase tracking-tight flex items-center justify-center text-center leading-tight text-[8.5px] ${data.systemCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {data.systemCategory === 'Others (Specify)' && (
                  <div className="animate-fade-in pt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify System Category</label>
                    <div className="relative">
                      <input 
                        className={`w-full bg-white border-2 p-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && data.systemCategory === 'Others (Specify)' && !data.otherSystemCategory?.trim() ? 'border-red-500' : 'border-slate-200 focus:border-blue-900'}`}
                        value={data.otherSystemCategory || ''}
                        placeholder="Specify System Category"
                        onChange={(e) => setData(prev => ({...prev, otherSystemCategory: e.target.value}))}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherSystemCategory', (val) => setData(prev => ({...prev, otherSystemCategory: val})))}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherSystemCategory' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SCOPE OF WORK SECTION */}
              <div className="text-left space-y-3 pt-4 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block tracking-widest">Scope of Work</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Supply & Install', 'Maintenance', 'Upgrade / Expansion', 'Others (Specify)'].map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setData(prev => ({...prev, scopeOfWork: scope}))}
                      className={`h-[52px] px-2 rounded-xl font-black border-2 transition uppercase tracking-tight flex items-center justify-center text-center leading-tight text-[8.5px] ${data.scopeOfWork === scope ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>

                {data.scopeOfWork === 'Others (Specify)' && (
                  <div className="animate-fade-in pt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Scope of Work</label>
                    <div className="relative">
                      <input 
                        className={`w-full bg-white border-2 p-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && data.scopeOfWork === 'Others (Specify)' && !data.otherScopeOfWork?.trim() ? 'border-red-500' : 'border-slate-200 focus:border-blue-900'}`}
                        value={data.otherScopeOfWork || ''}
                        placeholder="Specify Scope of Work"
                        onChange={(e) => setData(prev => ({...prev, otherScopeOfWork: e.target.value}))}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherScopeOfWork', (val) => setData(prev => ({...prev, otherScopeOfWork: val})))}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherScopeOfWork' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* COVERAGE AREA SECTION */}
              <div className="text-left space-y-3 pt-4 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block tracking-widest">Coverage Area</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Single Room', 'Multiple Room', 'Entire Floor', 'Entire Building', 'Outdoor', 'Other'].map(area => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setData(prev => ({...prev, coverageArea: area}))}
                      className={`h-[52px] px-1 rounded-xl font-black border-2 transition uppercase tracking-tight flex items-center justify-center text-center leading-tight text-[8.5px] ${data.coverageArea === area ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {area}
                    </button>
                  ))}
                </div>

                {data.coverageArea === 'Other' && (
                  <div className="animate-fade-in pt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Coverage Area</label>
                    <div className="relative">
                      <input 
                        className={`w-full bg-white border-2 p-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && data.coverageArea === 'Other' && !data.otherCoverageArea?.trim() ? 'border-red-500' : 'border-slate-200 focus:border-blue-900'}`}
                        value={data.otherCoverageArea || ''}
                        placeholder="Specify Coverage Area"
                        onChange={(e) => setData(prev => ({...prev, otherCoverageArea: e.target.value}))}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherCoverageArea', (val) => setData(prev => ({...prev, otherCoverageArea: val})))}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCoverageArea' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-left pt-3 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1.5 tracking-widest">Description of the Device Required</label>
                <div className="relative">
                  <textarea 
                    className="w-full bg-white border-2 border-slate-200 p-4 pr-12 rounded-2xl text-slate-900 font-bold focus:border-blue-900 outline-none min-h-[160px] resize-none"
                    value={data.serviceDetails}
                    onChange={e => setData(prev => ({...prev, serviceDetails: e.target.value}))}
                  />
                  <button 
                    onClick={() => startVoiceInput('serviceDetails', (val) => setData(prev => ({...prev, serviceDetails: val})))}
                    className={`absolute right-4 top-4 transition ${activeVoiceField === 'serviceDetails' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone text-xl"></i>
                  </button>
                </div>
              </div>

              <div className="text-left !mt-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1.5 tracking-widest">Estimated Cost of the Devices</label>
                <div className="relative">
                  <input 
                    type="number" step="any" min="0"
                    className="w-full bg-white border-2 border-slate-200 p-4 pr-12 rounded-2xl text-slate-900 font-bold focus:border-blue-900 outline-none"
                    value={data.estimatedCost === 0 ? '' : data.estimatedCost}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setData(prev => ({...prev, estimatedCost: isNaN(val) ? 0 : Math.max(0, val)}));
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('estimatedCost', (val) => setData(prev => ({...prev, estimatedCost: val})), true)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'estimatedCost' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone text-xl"></i>
                  </button>
                </div>
              </div>

              <div className="text-left pt-3 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1.5 tracking-widest">Cabling Type Required</label>
                <div className="grid grid-cols-2 gap-2">
                  {['CEILING', 'TRUNKING', 'OPEN CABLE', 'OTHER'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setData(prev => ({...prev, ceilingType: type}))}
                      className={`h-[52px] px-1 rounded-xl font-black border-2 transition uppercase tracking-tight flex items-center justify-center text-center leading-tight text-[8.5px] ${data.ceilingType === type ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {data.ceilingType === 'OTHER' && (
                  <div className="animate-fade-in pt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specify Cabling Type</label>
                    <div className="relative">
                      <input 
                        className={`w-full bg-white border-2 p-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && data.ceilingType === 'OTHER' && !data.otherCeilingType?.trim() ? 'border-red-500' : 'border-slate-200 focus:border-blue-900'}`}
                        value={data.otherCeilingType || ''}
                        placeholder="Specify Ceiling Type"
                        onChange={(e) => setData(prev => ({...prev, otherCeilingType: e.target.value}))}
                      />
                      <button 
                        type="button"
                        onClick={() => startVoiceInput('otherCeilingType', (val) => setData(prev => ({...prev, otherCeilingType: val})))}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'otherCeilingType' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-left !mt-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1.5 tracking-widest">Estimated Cost of the Cabling</label>
                <div className="relative">
                  <input 
                    type="number" step="any" min="0"
                    className="w-full bg-white border-2 border-slate-200 p-4 pr-12 rounded-2xl text-slate-900 font-bold focus:border-blue-900 outline-none"
                    value={data.cablesCost === 0 ? '' : data.cablesCost}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setData(prev => ({...prev, cablesCost: isNaN(val) ? 0 : Math.max(0, val)}));
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => startVoiceInput('cablesCost', (val) => setData(prev => ({...prev, cablesCost: val})), true)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'cablesCost' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-microphone text-xl"></i>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-10 space-y-3 pb-10">
              <button 
                disabled={!data.serviceDetails.trim()}
                onClick={() => onComplete(data)}
                className={`w-full py-4 font-black rounded-xl shadow-xl uppercase tracking-widest active:scale-95 transition ${data.serviceDetails.trim() ? 'bg-amber-500 text-blue-900' : 'bg-slate-200 text-slate-400'}`}
              >
                GENERATE ESTIMATION
              </button>
              <button onClick={() => setStep('BUILDING')} className="w-full text-blue-600 font-bold py-2 uppercase text-xs tracking-widest text-center">Back to Building Info</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OtherSurvey;