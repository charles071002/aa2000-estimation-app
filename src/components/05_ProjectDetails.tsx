import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { Project, SurveyType, User } from '../types';

const defaultMarkerIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
import { reverseGeocode, searchPlaces, type PlaceResult } from '../services/geoService';
import { processDigitsOnly, processEmail, processPersonName, processTitleCase } from '../utils/voiceProcessing';

type LatLon = { lat: number; lon: number };
const DEFAULT_LOCATION: LatLon = { lat: 14.5995, lon: 120.9842 };

function LocationPicker({ location, onChange }: { location: LatLon; onChange: (loc: LatLon) => void }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current).setView([location.lat, location.lon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const marker = L.marker([location.lat, location.lon], { draggable: true, icon: defaultMarkerIcon }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange({ lat: pos.lat, lon: pos.lng });
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange({ lat: e.latlng.lat, lon: e.latlng.lng });
    });
    const onMapResize = () => map.invalidateSize();
    map.whenReady(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });
    map.on('zoomend', onMapResize);
    map.on('moveend', onMapResize);
    mapInstanceRef.current = map;
    markerRef.current = marker;
    return () => {
      map.off('zoomend', onMapResize);
      map.off('moveend', onMapResize);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const latLng = L.latLng(location.lat, location.lon);
    marker.setLatLng(latLng);
    map.panTo(latLng);
  }, [location.lat, location.lon]);

  return (
    <div className="w-full h-56 rounded-xl overflow-hidden border-2 border-slate-100 bg-slate-50">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

interface Props {
  /** The current authenticated technician profile */
  user: User;
  /** Callback to return to the previous dashboard/list screen */
  onBack: () => void;
  /** Callback to initialize the project context in global state */
  onStart: (p: Project) => void;
  /** Callback to transition the user to a specific technical audit workflow */
  onSelectSurvey: (type: SurveyType) => void;
  /** Optional project data if we are editing an existing record */
  initialData?: Project;
}

/**
 * PROJECT DETAILS COMPONENT
 * Purpose: This screen captures the foundational metadata for a site survey project.
 * It ensures all project-wide information (Client name, contact, location) is collected
 * before allowing the technician to proceed to a specific technical audit (CCTV, Fire, etc.).
 * 
 * Behavior: Validates input integrity (especially the 11-digit phone number) and 
 * provides voice-to-text dictation for efficient field entry.
 */
const ProjectDetails: React.FC<Props> = ({ user, onBack, onStart, onSelectSurvey, initialData }) => {
  /**
   * STATE: details
   * Purpose: Stores the text values for the project identification fields.
   * Logic: Managed as a single object to simplify form updates and validation.
   */
  const [details, setDetails] = useState({
    name: '',           // Internal nickname/reference for the project (e.g., "Main Warehouse Audit")
    clientName: '',     // Official customer or business entity name
    clientEmail: '',    // Client email address
    clientContact: '',   // Required 11-digit mobile/landline number
    location: '',       // Physical address or specific site location
    locationName: ''    // Name of the project location (e.g. "Main Office", "Site A")
  });

  /**
   * EFFECT: Sync form from initialData when returning to Project Details (e.g. back from survey).
   * Ensures Project Name, Client Name, Client Email, and Client Contact Number are retained.
   */
  useEffect(() => {
    if (initialData) {
      setDetails({
        name: initialData.name ?? '',
        clientName: initialData.clientName ?? '',
        clientEmail: initialData.clientEmail ?? '',
        clientContact: initialData.clientContact ?? '',
        location: initialData.location ?? '',
        locationName: initialData.locationName ?? ''
      });
    }
  }, [initialData]);

  /**
   * STATE: activeVoiceField
   * Purpose: Tracks which specific input field is currently receiving voice-to-text data.
   * Visual logic: Used to show a pulsing red microphone icon on the active field.
   */
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);

  /**
   * STATE: showSurveyModal
   * Purpose: Controls the visibility of the "Choose System" selection popup.
   * Logic: Opens only when "SELECT SURVEY SYSTEM" is clicked and form fields are complete.
   */
  const [showSurveyModal, setShowSurveyModal] = useState(false);

  /**
   * STATE: showErrors
   * Purpose: Controls whether validation highlights (red borders) are visible.
   * Logic: Starts false and is triggered only when the user clicks the selection button.
   */
  const [showErrors, setShowErrors] = useState(false);

  /** Map / pin project location (optional). Updates details.location when place is chosen. */
  const [location, setLocation] = useState<LatLon | null>(null);
  const [showLocationScreen, setShowLocationScreen] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<PlaceResult[]>([]);
  const [activeSearchVoice, setActiveSearchVoice] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);

  /**
   * COMPUTED: isFormComplete
   * Purpose: Determines if the technician is allowed to proceed to the audit selection.
   * Logic: Returns true if all required fields are non-empty (contact number length not enforced).
   */
  const isFormComplete = 
    details.name.trim() !== '' &&
    details.clientName.trim() !== '' &&
    details.clientContact.trim() !== '' &&
    details.clientEmail.trim() !== '' &&
    details.locationName.trim() !== '';

  /**
   * FUNCTION: handleSelect
   * Purpose: Finalizes project metadata and triggers navigation to the audit system.
   * Logic: 
   *  1. Creates a Project object, generating a new random ID if none exists.
   *  2. Updates parent state via onStart and onSelectSurvey.
   * Input: SurveyType (Enum identifying which technical audit tool to load).
   */
  const handleSelect = (type: SurveyType) => {
    onStart({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      ...details,
      status: initialData?.status || 'In Progress',
      technicianName: initialData?.technicianName || user.fullName,
      date: initialData?.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    });
    onSelectSurvey(type);
    setShowSurveyModal(false);
  };

  /**
   * FUNCTION: handleContactChange
   * Purpose: Sanitizes the phone number input field.
   * Logic: Removes all non-numeric characters and limits length to 11 digits (PH standard).
   * Input: Standard React input ChangeEvent.
   */
  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
    setDetails(prev => ({...prev, clientContact: val}));
  };

  const applyReverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const addr = await reverseGeocode(lat, lon);
      const street = addr.street ?? '';
      const municipality = addr.city ?? '';
      const province = addr.province ?? '';
      const postal = addr.postcode ?? '';
      const pieces = [street, municipality, province, postal].filter(Boolean);
      const addressStr = pieces.length ? pieces.join(', ') : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setDetails((prev) => ({ ...prev, location: addressStr }));
      return addressStr;
    } catch {
      /* ignore */
    }
    const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    setDetails((prev) => ({ ...prev, location: fallback }));
    return fallback;
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocError('Location not supported in this browser.');
      return;
    }
    setLocError(null);
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon });
        await applyReverseGeocode(lat, lon);
        setLocLoading(false);
      },
      (err) => {
        setLocError(err.message || 'Failed to get current location.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRecenter = () => {
    setLocation((prev) => (prev ? { ...prev } : DEFAULT_LOCATION));
  };

  /** Debounced address suggestions as user types (min 2 chars). */
  useEffect(() => {
    const q = locQuery.trim();
    if (q.length < 2) {
      setLocResults([]);
      return;
    }
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(async () => {
      searchDebounceRef.current = null;
      setLocError(null);
      setLocLoading(true);
      try {
        const mapped = await searchPlaces(q);
        setLocResults(mapped);
      } catch {
        setLocResults([]);
      } finally {
        setLocLoading(false);
      }
    }, 400);
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
  }, [locQuery]);

  const handleSearchPlace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = locQuery.trim();
    if (!q) return;
    setLocError(null);
    setLocLoading(true);
    try {
      const mapped = await searchPlaces(q);
      setLocResults(mapped);
      if (!mapped.length) {
        setLocError('No places found. Try a more specific search.');
      } else {
        const first = mapped[0];
        setLocation({ lat: first.lat, lon: first.lon });
        setLocQuery(first.displayName);
        setLocResults([]);
        await applyReverseGeocode(first.lat, first.lon);
      }
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Failed to search for that place.');
      setLocResults([]);
    } finally {
      setLocLoading(false);
    }
  };

  const startVoiceInputSearchLocation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setActiveSearchVoice(true);
    recognition.onend = () => setActiveSearchVoice(false);
    recognition.onerror = () => setActiveSearchVoice(false);
    recognition.onresult = (event: any) => {
      setLocQuery(event.results[0][0].transcript);
    };
    recognition.start();
  };

  /**
   * FUNCTION: startVoiceInput
   * Purpose: Enables hands-free text entry via the browser Speech Recognition API.
   * Logic: 
   *  1. Checks for browser compatibility.
   *  2. Starts recognition and tracks the active field.
   *  3. For 'clientContact', it performs word-to-digit conversion (e.g., "one" -> "1").
   *  4. Updates the local 'details' state with the processed transcript.
   * Input: The key of the field to be updated (name, clientName, etc.).
   */
  const startVoiceInput = (field: keyof typeof details) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setActiveVoiceField(field);
    recognition.onend = () => setActiveVoiceField(null);
    recognition.onerror = () => setActiveVoiceField(null);

    recognition.onresult = (event: any) => {
      const rawTranscript = event.results[0][0].transcript;
      const transcript = rawTranscript.toLowerCase();
      if (field === 'clientContact') {
        setDetails(prev => ({ ...prev, [field]: processDigitsOnly(transcript, 11) }));
      } else if (field === 'clientEmail') {
        setDetails(prev => ({ ...prev, [field]: processEmail(transcript) }));
      } else if (field === 'clientName') {
        setDetails(prev => ({ ...prev, [field]: processPersonName(rawTranscript) }));
      } else {
        setDetails(prev => ({ ...prev, [field]: processTitleCase(rawTranscript) }));
      }
    };

    recognition.start();
  };

  /**
   * FUNCTION: handleProceedAttempt
   * Purpose: Checks completion and toggles error visibility or survey selection modal.
   */
  const handleProceedAttempt = () => {
    if (!isFormComplete) {
      setShowErrors(true);
    } else {
      setShowSurveyModal(true);
    }
  };

  const openLocationScreen = () => {
    if (!location) setLocation(DEFAULT_LOCATION);
    setShowLocationScreen(true);
  };

  return (
    <div className="p-6 h-screen overflow-y-auto bg-white flex flex-col relative">
      {/* Pin project location pop-up modal */}
      {showLocationScreen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in" aria-modal="true" role="dialog" aria-labelledby="pin-location-title" onClick={() => setShowLocationScreen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLocationScreen(false)}
                  className="text-blue-900 touch-target p-1"
                  aria-label="Close"
                >
                  <i className="fas fa-chevron-left text-xl"></i>
                </button>
                <h2 id="pin-location-title" className="text-xl font-black text-blue-900">PIN PROJECT LOCATION</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationScreen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full transition"
                aria-label="Close"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locLoading}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
                >
                  <i className="fas fa-crosshairs"></i>
                  {locLoading ? 'Locating…' : 'Use current location'}
                </button>
                <button
                  type="button"
                  onClick={handleRecenter}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Recenter map
                </button>
              </div>
              <form onSubmit={handleSearchPlace} role="search" className="flex flex-wrap gap-2 items-stretch">
                <div className="flex-1 min-w-0 relative min-w-[200px] flex">
                  <input
                    type="text"
                    value={locQuery}
                    onChange={(e) => setLocQuery(e.target.value)}
                    onBlur={() => setTimeout(() => setLocResults([]), 200)}
                    placeholder="Search place, street, city..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 pr-10 text-[10px] font-normal text-slate-900 focus:outline-none focus:border-blue-900"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={locResults.length > 0 || locLoading}
                  />
                  <button
                    type="button"
                    onClick={startVoiceInputSearchLocation}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 touch-target transition ${activeSearchVoice ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                    aria-label="Use voice for search location"
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                  {(locResults.length > 0 || locLoading) && (
                    <div className="absolute left-0 right-0 top-full mt-0.5 z-[500] max-h-48 overflow-y-auto rounded-b-xl border-2 border-t-0 border-slate-200 bg-white shadow-lg">
                      {locLoading && locResults.length === 0 ? (
                        <p className="px-3 py-2 text-[10px] text-slate-500 font-bold">Searching…</p>
                      ) : (
                        <ul className="py-1 text-[10px]" role="listbox">
                          {locResults.map((r, idx) => (
                            <li key={`${r.lat}-${r.lon}-${idx}`} role="option">
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={async () => {
                                  setLocation({ lat: r.lat, lon: r.lon });
                                  setLocQuery(r.displayName);
                                  setLocResults([]);
                                  await applyReverseGeocode(r.lat, r.lon);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-slate-100 font-bold text-slate-700 transition"
                              >
                                {r.displayName}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={locLoading}
                  className="px-3 rounded-xl bg-blue-900 text-white text-[10px] font-black uppercase disabled:opacity-60 transition inline-flex items-center justify-center self-stretch min-h-[2.125rem]"
                >
                  {locLoading ? 'Searching…' : 'Search'}
                </button>
              </form>
              {location && (
                <div className="space-y-2 min-h-[280px]">
                  <LocationPicker
                    location={location}
                    onChange={async (loc) => {
                      setLocation(loc);
                      const addressStr = await applyReverseGeocode(loc.lat, loc.lon);
                      setLocQuery(addressStr);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLocationScreen(false)}
                    className="w-full mt-3 py-3 rounded-xl bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest transition hover:bg-blue-800 active:scale-[0.98]"
                  >
                    SAVE PIN LOCATION
                  </button>
                </div>
              )}
              {locError && <p className="text-[10px] text-red-600 font-bold">{locError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 
          FORM HEADER
          Purpose: Logical title and exit action for the technician.
      */}
      <div className="flex items-center mb-6 gap-4 shrink-0">
        <button onClick={onBack} className="text-blue-900 touch-target" aria-label="Go back to Dashboard">
          <i className="fas fa-chevron-left text-xl"></i>
        </button>
        <h2 className="text-2xl font-black text-blue-900">Project Details</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mb-5 shrink-0">
        {/* 
            INPUT: Project Name
            UI Label: "Project Name" represents the technician's internal identifier for the survey.
        */}
        <div>
          <label htmlFor="proj-name" className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Project Name</label>
          <div className="relative">
            <input 
              id="proj-name"
              autoComplete="off"
              className={`w-full bg-slate-50 border-2 px-4 py-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && details.name.trim() === '' ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
              value={details.name}
              onChange={(e) => setDetails(prev => ({...prev, name: e.target.value}))}
            />
            {/* VOICE CTA: Triggers startVoiceInput for the Name field */}
            <button 
              type="button"
              onClick={() => startVoiceInput('name')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 touch-target transition ${activeVoiceField === 'name' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
              aria-label="Use voice for Project Name"
            >
              <i className="fas fa-microphone"></i>
            </button>
          </div>
        </div>

        {/* 
            INPUT: Client Name
            UI Label: "Client Name" is the legal name of the entity or individual requesting the audit.
        */}
        <div>
          <label htmlFor="client-name" className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Client Name</label>
          <div className="relative">
            <input 
              id="client-name"
              autoComplete="off"
              className={`w-full bg-slate-50 border-2 px-4 py-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && details.clientName.trim() === '' ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
              value={details.clientName}
              onChange={(e) => setDetails(prev => ({...prev, clientName: e.target.value}))}
            />
            <button 
              type="button"
              onClick={() => startVoiceInput('clientName')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 touch-target transition ${activeVoiceField === 'clientName' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
              aria-label="Use voice for Client Name"
            >
              <i className="fas fa-microphone"></i>
            </button>
          </div>
        </div>

        {/* 
            INPUT: Client Contact
            UI Label: "Client Contact Number" ensures the Sales team can coordinate with the customer.
            Usage: Critical for logistic follow-ups and report delivery verification.
        */}
        <div>
          <div className="flex justify-between items-center mb-1 ml-1">
            <label htmlFor="client-contact" className="block text-[10px] uppercase font-bold text-slate-400">Client Contact Number</label>
            {/* VALIDATION LABEL: Shows current digit count vs required 11 digits. Changes to red if not valid. */}
            <span className={`text-[9px] font-black ${details.clientContact.length === 11 ? 'text-green-600' : 'text-red-600'}`} aria-live="polite">
              {details.clientContact.length}/11
            </span>
          </div>
          <div className="relative">
            <input 
              id="client-contact"
              type="tel"
              autoComplete="off"
              className={`w-full bg-slate-50 border-2 px-4 py-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && details.clientContact.trim() === '' ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
              value={details.clientContact}
              onChange={handleContactChange}
              maxLength={11}
            />
            <button 
              type="button"
              onClick={() => startVoiceInput('clientContact')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 touch-target transition ${activeVoiceField === 'clientContact' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
              aria-label="Use voice for Contact Number"
            >
              <i className="fas fa-microphone"></i>
            </button>
          </div>
        </div>

        {/* 
            INPUT: Client Email
            UI Label: "Client Email" for the client's email address. Placed below Client Name (first column).
        */}
        <div>
          <label htmlFor="client-email" className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Client Email</label>
          <div className="relative">
            <input 
              id="client-email"
              type="email"
              autoComplete="email"
              className={`w-full bg-slate-50 border-2 px-4 py-3 pr-10 rounded-xl text-slate-900 focus:outline-none transition font-bold text-xs ${showErrors && details.clientEmail.trim() === '' ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
              value={details.clientEmail}
              onChange={(e) => setDetails(prev => ({...prev, clientEmail: e.target.value}))}
            />
            <button 
              type="button"
              onClick={() => startVoiceInput('clientEmail')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 touch-target transition ${activeVoiceField === 'clientEmail' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
              aria-label="Use voice for Client Email"
            >
              <i className="fas fa-microphone"></i>
            </button>
          </div>
        </div>

        {/* 
            PIN PROJECT LOCATION (optional): Address + Map
            Use current location, search place, or drag pin to set location; reverse geocode updates Project Location.
        */}
        <div className="md:col-span-2">
          <div className="flex items-end gap-3">
            <div className="w-3/4 min-w-0">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Project Location Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={details.locationName}
                  onChange={(e) => setDetails((prev) => ({ ...prev, locationName: e.target.value }))}
                  className={`w-full bg-slate-50 border-2 rounded-xl px-3 py-3 pr-10 text-xs font-bold text-slate-900 focus:outline-none ${showErrors && details.locationName.trim() === '' ? 'border-red-500' : 'border-slate-100 focus:border-blue-900'}`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => startVoiceInput('locationName')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 touch-target transition ${activeVoiceField === 'locationName' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-900'}`}
                  aria-label="Use voice for Project Location Name"
                >
                  <i className="fas fa-microphone"></i>
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={openLocationScreen}
              className="w-1/4 shrink-0 h-[3.125rem] inline-flex items-center justify-center gap-1.5 px-2 rounded-xl border-2 border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <i className="fas fa-map-marker-alt text-blue-900 shrink-0"></i>
              <span className="truncate">PIN LOCATION</span>
            </button>
          </div>
        </div>
      </div>

      {/* 
          PRIMARY CTA: Select Survey System
          Purpose: Validates the form and reveals the domain selection modal.
          Usage: The gateway from "Administrative data" to "Technical audit data".
          Behavior: Visually disabled if 'isFormComplete' is false, but functionally triggers validation error display.
      */}
      <div className="pt-4 shrink-0">
        <button 
          onClick={handleProceedAttempt}
          className={`w-full p-10 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${isFormComplete ? 'bg-blue-900 text-white border-2 border-blue-900 shadow-blue-900/20' : 'bg-slate-200 text-slate-400 border-2 border-slate-200 shadow-none'}`}
          aria-haspopup="dialog"
        >
          <i className="fas fa-plus-circle text-2xl" aria-hidden="true"></i>
          <span className="font-black text-lg uppercase tracking-tight">SELECT SURVEY SYSTEM</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Begin Site Audit</span>
        </button>
        {showErrors && !isFormComplete && (
          <p className="text-[9px] text-red-500 font-black text-center mt-3 uppercase tracking-widest animate-pulse">
            Complete highlighted fields to proceed
          </p>
        )}
      </div>

      {/* 
          MODAL: SYSTEM CHOICE
          Purpose: Forces the technician to explicitly choose which technology system they are auditing first.
      */}
      {showSurveyModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 md:p-8 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-white w-full max-w-sm md:max-w-4xl md:max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 md:p-8 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 id="modal-title" className="font-black uppercase tracking-widest text-xs md:text-sm">Choose System to Audit</h3>
              <button onClick={() => setShowSurveyModal(false)} className="text-slate-400 hover:text-blue-900 transition touch-target" aria-label="Close modal">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            
            {/* 
                SCROLLABLE LIST: System Options
                Logic: Maps over predefined system categories. Clicking a button triggers the handleSelect logic.
            */}
            <div className="p-6 md:p-8 grid grid-cols-2 gap-3 md:gap-4 overflow-y-auto max-h-[70vh] md:max-h-[65vh]">
              {[
                { type: SurveyType.CCTV, label: 'CCTV System', desc: 'Video Surveillance Audit', icon: 'fa-camera' },
                { type: SurveyType.FIRE_ALARM, label: 'Fire Alarm', desc: 'Safety & Detection Audit', icon: 'fa-fire-extinguisher' },
                { type: SurveyType.FIRE_PROTECTION, label: 'Fire Protection', desc: 'Suppression & Sprinkler Audit', icon: 'fa-shield-heart' },
                { type: SurveyType.ACCESS_CONTROL, label: 'Access Control', desc: 'Entry & Door Security Audit', icon: 'fa-id-card-clip' },
                { type: SurveyType.BURGLAR_ALARM, label: 'Burglar Alarm', desc: 'Intrusion Detection Audit', icon: 'fa-shield-halved' },
                { type: SurveyType.OTHER, label: 'Other', desc: 'Custom Technological Service', icon: 'fa-ellipsis-h' }
              ].map(item => (
                <button 
                  key={item.type}
                  onClick={() => handleSelect(item.type)}
                  className="w-full p-5 md:p-6 rounded-2xl flex items-center justify-between border-2 border-blue-900/10 hover:border-blue-900 hover:bg-blue-50 text-blue-900 transition-all active:scale-95 group shadow-sm bg-white"
                >
                  <div className="text-left">
                    {/* UI LABEL: Primary name of the technical domain */}
                    <p className="font-black text-lg md:text-xl uppercase leading-none">{item.label}</p>
                    {/* UI NOTE: Describes the specific scope of the chosen audit path */}
                    <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-1">{item.desc}</p>
                  </div>
                  <i className={`fas ${item.icon} text-2xl md:text-3xl opacity-10 group-hover:opacity-30 transition-opacity`} aria-hidden="true"></i>
                </button>
              ))}
            </div>
            
            {/* DISMISS ACTION: Close modal and return to metadata form */}
            <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 text-center shrink-0">
               <button 
                onClick={() => setShowSurveyModal(false)}
                className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-900 transition py-2 px-4"
               >
                 Cancel Selection
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;