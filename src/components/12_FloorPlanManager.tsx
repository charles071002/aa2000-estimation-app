import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { BuildingMeasurements, RoomEntry } from '../types';

interface Props {
  initialData?: BuildingMeasurements;
  onChange: (data: BuildingMeasurements) => void;
  onNewUpload?: () => void;
  activeVoiceField: string | null;
  startVoiceInput: (field: string, setter: (val: any) => void, isNumeric?: boolean) => void;
}

const FloorPlanManager: React.FC<Props> = ({ initialData, onChange, onNewUpload, activeVoiceField, startVoiceInput }) => {
  const [method, setMethod] = useState<'PLAN_UPLOAD' | 'MANUAL_ROOMS'>(initialData?.method || 'PLAN_UPLOAD');
  const [planImages, setPlanImages] = useState<string[]>(() => {
    if (initialData?.planImages?.length) return initialData.planImages;
    if (initialData?.planImage) return [initialData.planImage];
    return [];
  });
  const [knownDim, setKnownDim] = useState<number>(initialData?.planScale?.knownDimensionMeters || 0);
  const [rooms, setRooms] = useState<RoomEntry[]>(initialData?.rooms || []);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Partial<RoomEntry>>({ name: '', length: 0, width: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const addMoreInputRef = React.useRef<HTMLInputElement>(null);

  // State for AI-powered scale detection
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [hasDetected, setHasDetected] = useState(false);
  const [roomsDetected, setRoomsDetected] = useState(false);

  useEffect(() => {
    const total = rooms.reduce((acc, r) => acc + (r.area || 0), 0);
    onChange({
      method,
      planImage: planImages[0] || undefined,
      planImages: planImages.length > 0 ? planImages : undefined,
      planScale: method === 'PLAN_UPLOAD' ? { knownDimensionMeters: knownDim } : undefined,
      rooms,
      totalArea: total
    });
  }, [method, planImages, knownDim, rooms]);

  /**
   * AI-Powered Scale Detection
   * Uses Gemini Vision to analyze all uploaded floor plan images.
   */
  useEffect(() => {
    if (planImages.length > 0 && !knownDim && !hasDetected && !isAnalyzing) {
      handleAnalyzeScale();
    }
  }, [planImages.length]);

  const handleAnalyzeScale = async () => {
    if (planImages.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const interval = setInterval(() => {
      setAnalysisProgress(prev => (prev >= 90 ? 90 : prev + 10));
    }, 200);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const promptText = "Examine ALL of the following floor plan image(s). The scale bar or numerical dimensions (e.g. '1:100', '12m', '25ft') may appear on ANY image—e.g. only on the second or third image. You MUST check every image before concluding no scale is present. \n1. Look in every image for: a calibrated ruler/scale bar, or wall segments with numerical dimensions. \n2. If you find dimensions on any image, set hasScale true and set suggestedValue to that number (convert to meters: 1 ft = 0.3048 m). \n3. Identify all rooms/hallways/zones across every image; extract names and dimensions if written. \n4. Combine room lists without duplicates. \nRespond in JSON only.";
      const parts: any[] = [{ text: promptText }];
      const imagePlans = planImages.filter(img => {
        const m = img.split(';')[0].split(':')[1] || '';
        return m.startsWith('image/');
      });
      const toSend = imagePlans.length > 0 ? imagePlans : planImages;
      for (const img of toSend) {
        const base64Data = img.split(',')[1];
        const mimeType = img.split(';')[0].split(':')[1];
        if (!base64Data || !mimeType) continue;
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      if (parts.length <= 1) {
        setHasDetected(false);
        setKnownDim(0);
        setIsAnalyzing(false);
        clearInterval(interval);
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user',
          parts
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasScale: { type: Type.BOOLEAN, description: "True if numerical dimensions or a scale ruler is present in ANY of the images" },
              suggestedValue: { type: Type.NUMBER, description: "The dimension value in meters (e.g. from scale bar or wall label). Required when hasScale is true. 0 only if no scale found in any image." },
              unit: { type: Type.STRING, description: "meters, feet, etc." },
              rooms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    length: { type: Type.NUMBER, description: "Length in meters" },
                    width: { type: Type.NUMBER, description: "Width in meters" }
                  },
                  required: ["name", "length", "width"]
                }
              }
            },
            required: ["hasScale"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      setAnalysisProgress(100);
      clearInterval(interval);

      if (result.hasScale && result.suggestedValue > 0) {
        setHasDetected(true);
        setKnownDim(result.suggestedValue);
      } else {
        setHasDetected(false);
        setKnownDim(0);
      }

      if (result.rooms && result.rooms.length > 0) {
        setRoomsDetected(true);
        const detectedRooms: RoomEntry[] = result.rooms.map((r: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: r.name,
          length: r.length,
          width: r.width,
          area: r.length * r.width
        }));
        setRooms(prev => [...prev, ...detectedRooms]);
      }
    } catch (err) {
      console.error("Scale detection failed", err);
      setHasDetected(false);
      setKnownDim(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processFiles = (files: FileList | File[], append = false) => {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || f.type === 'application/pdf');
    if (list.length === 0) return;
    if (!append) {
      setHasDetected(false);
      setKnownDim(0);
      setRoomsDetected(false);
      setRooms([]);
    }
    const results: string[] = new Array(list.length);
    let loaded = 0;
    list.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        results[index] = reader.result as string;
        loaded++;
        if (loaded === list.length) {
          const newUrls = results.filter(Boolean) as string[];
          if (append) {
            setPlanImages(prev => [...prev, ...newUrls]);
          } else {
            setPlanImages(newUrls);
          }
          if (onNewUpload) onNewUpload();
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, append = false) => {
    const files = e.target.files;
    if (!files?.length) return;
    processFiles(files, append);
    e.target.value = '';
  };

  const handleAddMore = () => {
    addMoreInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    processFiles(files);
  };

  const addRoom = () => {
    if (!currentRoom.name || !currentRoom.length || !currentRoom.width) return;
    const newRoom: RoomEntry = {
      id: Math.random().toString(36).substr(2, 9),
      name: currentRoom.name,
      length: currentRoom.length,
      width: currentRoom.width,
      area: currentRoom.length * currentRoom.width
    };
    setRooms([...rooms, newRoom]);
    setCurrentRoom({ name: '', length: 0, width: 0 });
    setShowRoomModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button 
          onClick={() => setMethod('PLAN_UPLOAD')}
          className={`flex-1 py-3 text-[10px] font-black rounded-xl transition ${method === 'PLAN_UPLOAD' ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400'}`}
        >
          PLAN UPLOAD
        </button>
        <button 
          onClick={() => setMethod('MANUAL_ROOMS')}
          className={`flex-1 py-3 text-[10px] font-black rounded-xl transition ${method === 'MANUAL_ROOMS' ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400'}`}
        >
          ROOM LIST (MANUAL)
        </button>
      </div>

      {method === 'PLAN_UPLOAD' && (
        <div className="space-y-3 animate-fade-in">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Upload Floor Plan (PDF/IMG)</label>
            <div className="relative transition-all duration-300 rounded-xl overflow-hidden">
              {planImages.length > 0 ? (
                <>
                  {/* List layout: icon left, name right, one row per file */}
                  <div className="space-y-2">
                    {planImages.map((dataUrl, index) => {
                      const isPdf = dataUrl.startsWith('data:application/pdf');
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm"
                        >
                          {/* Icon: square with border */}
                          <div className="w-12 h-12 rounded border-2 border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center bg-slate-100">
                            {isPdf ? (
                              <span className="text-[10px] font-black text-slate-500 uppercase">PDF</span>
                            ) : (
                              <img src={dataUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          {/* File name */}
                          <span className="flex-1 text-[10px] font-black text-slate-900 uppercase min-w-0 truncate">
                            Floor Plan {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = planImages.filter((_, i) => i !== index);
                              setPlanImages(next);
                              if (next.length === 0) {
                                setKnownDim(0);
                                setHasDetected(false);
                                setRoomsDetected(false);
                                setRooms([]);
                              }
                            }}
                            className="w-8 h-8 rounded-full border-2 border-slate-300 bg-slate-100 hover:bg-red-50 hover:border-red-400 text-slate-600 hover:text-red-600 flex items-center justify-center transition flex-shrink-0"
                            aria-label="Remove"
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </div>
                      );
                    })}
                    {/* Add More row */}
                    <button
                      type="button"
                      onClick={handleAddMore}
                      className="w-full flex items-center gap-3 p-2.5 bg-white text-slate-900 rounded-lg border-2 border-slate-200 hover:bg-slate-50 active:scale-[0.99] transition"
                    >
                      <div className="w-12 h-12 rounded flex-shrink-0 flex items-center justify-center bg-blue-900 text-white">
                        <i className="fas fa-plus text-lg"></i>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">ADD MORE</span>
                      <input
                        ref={addMoreInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        multiple
                        onChange={e => handleFileUpload(e, true)}
                      />
                    </button>
                  </div>
                  {isAnalyzing && (
                    <div className="mt-2 p-2 bg-blue-900/10 rounded-lg flex items-center gap-2">
                      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden flex-1">
                        <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${analysisProgress}%` }}></div>
                      </div>
                      <span className="text-[9px] font-black text-slate-600 uppercase shrink-0">Analyzing...</span>
                    </div>
                  )}
                  {!isAnalyzing && (hasDetected || roomsDetected) && (
                    <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-green-500 text-white rounded-lg text-[9px] font-black uppercase">
                      <i className="fas fa-check-circle text-[8px]"></i>
                      {hasDetected && roomsDetected ? 'Scale & Rooms Detected' : hasDetected ? 'Scale Detected' : 'Rooms Detected'}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[2rem] overflow-hidden border-2 border-slate-200">
                  <label
                    className={`flex flex-col items-center justify-center w-full aspect-video max-h-[140px] border-2 border-dashed rounded-[2rem] cursor-pointer transition bg-white text-slate-400 group ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <i className="fas fa-file-upload text-4xl mb-3 group-hover:scale-110 transition"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest">TAP TO UPLOAD PLAN</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" multiple onChange={e => handleFileUpload(e, false)} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {method === 'MANUAL_ROOMS' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-6 rounded-2xl border-2 border-slate-100 bg-slate-50 transition-all duration-300 space-y-3 shadow-sm">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <i className="fas fa-ruler-combined text-blue-900"></i>
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-900">Calibration</h4>
                </div>
             </div>
             <p className="text-[10px] font-bold uppercase leading-tight text-slate-500">
               {hasDetected 
                ? "The system identified a scale reference from the plan dimensions. Review and confirm below."
                : "Enter the known length of the longest wall or a specific dimension on the plan for scale detection."}
             </p>
             <div className="relative">
                <input 
                  type="number"
                  className="w-full border-2 border-slate-200 p-4 pr-12 rounded-xl font-black outline-none shadow-sm transition-all duration-300 bg-white text-blue-900 focus:border-blue-900 text-[10px]"
                  value={knownDim || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setKnownDim(val);
                    if (val > 0) setHasDetected(true);
                  }}
                />
                <button 
                  onClick={() => startVoiceInput('knownDim', (val) => {
                    const num = parseFloat(val) || 0;
                    setKnownDim(num);
                    if (num > 0) setHasDetected(true);
                  }, true)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${activeVoiceField === 'knownDim' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                >
                  <i className="fas fa-microphone text-lg"></i>
                </button>
             </div>
          </div>

          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest ml-1">Room-by-Room Inventory</h4>
            <button 
              onClick={() => setShowRoomModal(true)}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition"
            >
              ADD ROOM
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2rem] text-center bg-slate-50">
              <i className="fas fa-door-open text-3xl text-slate-200 mb-3"></i>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No rooms added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(room => (
                <div key={room.id} className="p-5 bg-white border-2 border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                      <p className="font-black text-blue-900 uppercase text-[10px]">{room.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {Math.floor(room.length * 3.28084)}'{Math.round((room.length * 3.28084 % 1) * 12)}" × {Math.floor(room.width * 3.28084)}'{Math.round((room.width * 3.28084 % 1) * 12)}" • {(room.area * 10.7639).toFixed(1)} SQFT / {room.area.toFixed(2)} SQM
                      </p>
                    </div>
                   <button onClick={() => setRooms(rooms.filter(r => r.id !== room.id))} className="text-red-500 w-10 h-10 hover:bg-red-50 rounded-full transition">
                     <i className="fas fa-trash-alt"></i>
                   </button>
                </div>
              ))}
              <div className="p-4 bg-blue-900 text-white rounded-2xl flex justify-between items-center shadow-xl">
                 <span className="text-[10px] font-black uppercase tracking-widest">Aggregated Area</span>
                 <div className="text-right">
                   <div className="text-[10px] font-black">{(rooms.reduce((acc, r) => acc + r.area, 0) * 10.7639).toLocaleString(undefined, {maximumFractionDigits: 1})} SQFT</div>
                   <div className="text-[10px] font-bold opacity-70">{rooms.reduce((acc, r) => acc + r.area, 0).toLocaleString()} SQM</div>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showRoomModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col scale-up">
            <header className="p-6 bg-white text-blue-900 flex justify-between items-center border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-[10px]">Define Room Detail</h3>
              <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-blue-900 transition" aria-label="Close">
                <i className="fas fa-times text-lg"></i>
              </button>
            </header>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Room Name</label>
                <div className="relative mt-1">
                  <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl font-bold text-[10px]"  value={currentRoom.name} onChange={e => setCurrentRoom({...currentRoom, name: e.target.value})} />
                  <button onClick={() => startVoiceInput('rName', (val) => setCurrentRoom({...currentRoom, name: val}))} className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 ${activeVoiceField === 'rName' ? 'text-red-500 animate-pulse' : ''}`}><i className="fas fa-microphone"></i></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Length (m)</label>
                  <div className="relative mt-1">
                    <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold text-center text-[10px]" value={currentRoom.length || ''} onChange={e => setCurrentRoom({...currentRoom, length: parseFloat(e.target.value) || 0})} />
                    <button onClick={() => startVoiceInput('rLen', (val) => setCurrentRoom({...currentRoom, length: parseFloat(val) || 0}), true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><i className="fas fa-microphone text-xs"></i></button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Width (m)</label>
                  <div className="relative mt-1">
                    <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-10 rounded-xl font-bold text-center text-[10px]" value={currentRoom.width || ''} onChange={e => setCurrentRoom({...currentRoom, width: parseFloat(e.target.value) || 0})} />
                    <button onClick={() => startVoiceInput('rWid', (val) => setCurrentRoom({...currentRoom, width: parseFloat(val) || 0}), true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><i className="fas fa-microphone text-xs"></i></button>
                  </div>
                </div>
              </div>
              <button onClick={addRoom} className="w-full py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition text-[10px]">COMMIT ROOM</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default FloorPlanManager;
