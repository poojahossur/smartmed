import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  MapPin,
  Navigation,
  Phone,
  Clock,
  ExternalLink,
  Loader2,
  Compass,
  Building2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Filter,
  CheckCircle2,
  Share2,
  Pill,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { HealthcareCategory, HealthcareFacility, GeocodedLocation } from "../types";
import {
  searchNearbyHealthcare,
  geocodeLocation,
  reverseGeocode,
  computeFacilityOpenStatus,
} from "../services/healthcareService";
import HealthcareMap from "../components/HealthcareMap";
import { cn } from "../lib/utils";

// Category options with glyphs and badges
interface CategoryOption {
  id: HealthcareCategory;
  label: string;
  glyph: string;
  description: string;
  badgeColor: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: "pharmacy", label: "Pharmacies & Chemists", glyph: "💊", description: "24/7 Medical Stores, Apollo, MedPlus, Jan Aushadhi", badgeColor: "bg-emerald-900/45 text-emerald-300 border-emerald-700/60" },
  { id: "hospital", label: "Hospitals & Trauma Care", glyph: "🏥", description: "General & Multispeciality Hospitals", badgeColor: "bg-rose-900/45 text-rose-300 border-rose-700/60" },
  { id: "clinic", label: "General Clinics", glyph: "⚕️", description: "Polyclinics & Primary Health Centers", badgeColor: "bg-teal-900/45 text-teal-300 border-teal-700/60" },
  { id: "doctor", label: "Doctors & Physicians", glyph: "🩺", description: "Specialist & Family Physicians", badgeColor: "bg-sky-900/45 text-sky-300 border-sky-700/60" },
  { id: "dental", label: "Dental Clinics", glyph: "🦷", description: "Dentists & Dental Care", badgeColor: "bg-cyan-900/45 text-cyan-300 border-cyan-700/60" },
  { id: "eye", label: "Eye Care / Netralaya", glyph: "👁️", description: "Ophthalmologists & Eye Hospitals", badgeColor: "bg-amber-900/45 text-amber-300 border-amber-700/60" },
  { id: "heart", label: "Cardiac / Heart Centers", glyph: "❤️", description: "Cardiology Hospitals & Clinics", badgeColor: "bg-red-900/45 text-red-300 border-red-700/60" },
  { id: "skin", label: "Skin & Dermatology", glyph: "✨", description: "Skin Specialists & Clinics", badgeColor: "bg-purple-900/45 text-purple-300 border-purple-700/60" },
  { id: "ent", label: "ENT Clinics", glyph: "👂", description: "Ear, Nose & Throat Centers", badgeColor: "bg-pink-900/45 text-pink-300 border-pink-700/60" },
  { id: "all", label: "All Healthcare", glyph: "🌐", description: "All Nearby Healthcare Providers", badgeColor: "bg-slate-800 text-slate-100 border-slate-700/70" },
];

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];


export default function MedicineFinder() {
  // State for coordinates and location
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 15.1394, lng: 76.9214 }); // Default: Ballari
  const [locationName, setLocationName] = useState<string>("Ballari, Karnataka");
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [locationPermissionError, setLocationPermissionError] = useState<string | null>(null);

  // Search parameters
  const [selectedCategory, setSelectedCategory] = useState<HealthcareCategory>("pharmacy");
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [effectiveRadiusKm, setEffectiveRadiusKm] = useState<number>(50);
  const [autoExpanded, setAutoExpanded] = useState<boolean>(false);

  // Unified Omnibar Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodedLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Results state
  const [facilities, setFacilities] = useState<HealthcareFacility[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [activeMobileView, setActiveMobileView] = useState<"both" | "map" | "list">("both");

  // Filters
  const [filterOpenNow, setFilterOpenNow] = useState<boolean>(false);
  const [filterEmergencyOnly, setFilterEmergencyOnly] = useState<boolean>(false);

  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // On mount: Try to detect user's current GPS location
  useEffect(() => {
    handleUseCurrentLocation(true);
  }, []);

  // Whenever coords, radiusKm, or selectedCategory changes, execute search
  useEffect(() => {
    fetchHealthcareFacilities();
  }, [coords, radiusKm, selectedCategory]);

  // Core search function
  const fetchHealthcareFacilities = async (explicitSearchTerm?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedFacilityId(null);
    setAutoExpanded(false);

    const termToUse = explicitSearchTerm !== undefined ? explicitSearchTerm : searchQuery;

    try {
      const response = await searchNearbyHealthcare({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm,
        category: selectedCategory,
        searchTerm: termToUse,
      });

      const enriched = (response.results || []).map((f) => {
        const dynamicStatus = computeFacilityOpenStatus(f.openingHours, f.daysAvailable, f.emergency);
        return {
          ...f,
          isOpenNow: dynamicStatus !== null ? dynamicStatus : f.isOpenNow,
        };
      });

      setFacilities(enriched);
      setEffectiveRadiusKm(response.effectiveRadiusKm);
      setAutoExpanded(response.autoExpanded);

      if (response.results.length === 0) {
        setErrorMessage(
          `No ${selectedCategory === "all" ? "healthcare facilities" : selectedCategory + " facilities"} found near ${locationName}. Try selecting a wider radius or searching all healthcare categories.`
        );
      }
    } catch (error: any) {
      console.error("Healthcare search failed:", error);
      setErrorMessage("Unable to fetch healthcare facilities. Retrying with local verified providers...");
    } finally {
      setIsLoading(false);
    }
  };

  // Action: "Use My Current Location"
  const handleUseCurrentLocation = (isInitial = false) => {
    if (!navigator.geolocation) {
      if (!isInitial) setLocationPermissionError("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingLocation(true);
    setLocationPermissionError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        try {
          const resolvedName = await reverseGeocode(lat, lng);
          setLocationName(resolvedName);
        } catch (e) {
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.warn("Geolocation access notice:", error.message);
        setIsDetectingLocation(false);
        if (!isInitial) {
          setLocationPermissionError("GPS location access was not granted. Showing facilities in default region. You can type any city name below!");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Unified Search Handler (handles typing cities, facility names, or health categories)
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setShowSuggestions(false);
    setLocationPermissionError(null);

    const qLower = query.toLowerCase();

    // 1. Check if user typed a category keyword (e.g. "pharmacy", "hospital", "dentist", "eye clinic")
    if (qLower.includes("pharmacy") || qLower.includes("chemist") || qLower.includes("medical store")) {
      setSelectedCategory("pharmacy");
      fetchHealthcareFacilities(query);
      return;
    }
    if (qLower.includes("hospital") || qLower.includes("trauma") || qLower.includes("emergency")) {
      setSelectedCategory("hospital");
      fetchHealthcareFacilities(query);
      return;
    }
    if (qLower.includes("dental") || qLower.includes("dentist")) {
      setSelectedCategory("dental");
      fetchHealthcareFacilities(query);
      return;
    }
    if (qLower.includes("eye") || qLower.includes("netralaya") || qLower.includes("optician")) {
      setSelectedCategory("eye");
      fetchHealthcareFacilities(query);
      return;
    }
    if (qLower.includes("heart") || qLower.includes("cardio")) {
      setSelectedCategory("heart");
      fetchHealthcareFacilities(query);
      return;
    }
    if (qLower.includes("skin") || qLower.includes("derma")) {
      setSelectedCategory("skin");
      fetchHealthcareFacilities(query);
      return;
    }
    if (qLower.includes("clinic") || qLower.includes("doctor")) {
      setSelectedCategory("clinic");
      fetchHealthcareFacilities(query);
      return;
    }

    // 2. Try geocoding if query looks like a city/place/locality
    setIsGeocoding(true);
    try {
      const results = await geocodeLocation(query);
      if (results.length > 0) {
        const top = results[0];
        setCoords({ lat: top.lat, lng: top.lng });
        setLocationName(top.displayName || top.name);
      } else {
        // Not a geocoded city, treat as facility name filter
        fetchHealthcareFacilities(query);
      }
    } catch (err) {
      console.warn("Geocode attempt fallback:", err);
      fetchHealthcareFacilities(query);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Select location suggestion
  const handleSelectSuggestion = (loc: GeocodedLocation) => {
    setCoords({ lat: loc.lat, lng: loc.lng });
    setLocationName(loc.displayName || loc.name);
    setSearchQuery("");
    setShowSuggestions(false);
  };

  // Select facility from map or list
  const handleSelectFacility = (facility: HealthcareFacility) => {
    setSelectedFacilityId(facility.id);
    const cardEl = cardRefs.current.get(facility.id);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Search in map area when dragged
  const handleSearchMapArea = async (newLat: number, newLng: number) => {
    setCoords({ lat: newLat, lng: newLng });
    try {
      const name = await reverseGeocode(newLat, newLng);
      setLocationName(name);
    } catch (e) {
      setLocationName(`${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
    }
  };

  // Filtered facilities based on search query & toggles
  const displayedFacilities = facilities.filter((f) => {
    if (filterOpenNow && f.isOpenNow === false) return false;
    if (filterEmergencyOnly && !f.emergency) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = f.name.toLowerCase().includes(q);
      const matchAddr = f.address.toLowerCase().includes(q);
      const matchSpec = f.speciality?.toLowerCase().includes(q);
      const matchCat = f.categoryLabel.toLowerCase().includes(q);
      const matchCatId = f.category.toLowerCase().includes(q);
      // If user typed city name or general search, don't filter out unless there's a strong name mismatch
      if (matchName || matchAddr || matchSpec || matchCat || matchCatId) return true;
    }
    return true;
  });

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Top Banner Card with 3D Glassmorphic Lighting */}
      <header className="relative glass-panel rounded-3xl p-6 md:p-8 overflow-hidden shadow-2xl transition-all">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-500/20 via-sky-500/15 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-sm">
              <Sparkles size={14} className="text-teal-600 animate-pulse" />
              <span>Interactive 3D Leaflet Map & Verified Locator</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-50 tracking-tight">
              Nearby Pharmacies & Hospitals
            </h1>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              Find verified open pharmacies, emergency hospitals, clinics, and doctors near your location with live GPS routing, direct calling, and real-time open status.
            </p>
          </div>

          {/* Active Search Center Pill & 3D GPS Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 glass-card p-3 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 to-sky-700 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 ring-1 ring-white/40">
                <MapPin size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Search Center</p>
                <p className="text-sm font-black text-slate-50 line-clamp-1 max-w-[220px]" title={locationName}>
                  {locationName}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleUseCurrentLocation(false)}
              disabled={isDetectingLocation}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-500/25 transition-all btn-3d disabled:opacity-50"
              title="Detect your exact GPS location"
            >
              {isDetectingLocation ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <Navigation size={16} className="text-white" />
              )}
              <span>{isDetectingLocation ? "Detecting GPS..." : "Use My Location"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Location Notice Banner */}
      {locationPermissionError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 glass-card bg-amber-950/40 border-amber-700/60 rounded-2xl flex items-start justify-between gap-3 text-amber-200 text-sm shadow-md"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Location Status</p>
              <p className="text-amber-300 text-xs mt-0.5">{locationPermissionError}</p>
            </div>
          </div>
          <button
            onClick={() => setLocationPermissionError(null)}
            className="text-xs font-black text-amber-300 hover:text-amber-200 underline px-2 py-1"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Auto-Expanded Radius Notice Banner */}
      {autoExpanded && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="p-4 glass-card bg-gradient-to-r from-teal-950/40 to-sky-950/30 border-teal-700/60 rounded-2xl flex items-center justify-between gap-3 text-teal-200 text-sm shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md">
              <Compass size={18} />
            </div>
            <div>
              <p className="font-bold text-xs text-teal-100">Radius Automatically Adjusted</p>
              <p className="text-teal-300 text-xs mt-0.5">
                Expanded search to <strong>{effectiveRadiusKm} km</strong> to locate the nearest verified healthcare providers.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutoExpanded(false)}
            className="text-xs font-bold text-teal-300 hover:text-teal-200 bg-slate-900/85 px-3 py-1.5 rounded-xl border border-teal-700/60 transition-all shadow-sm shrink-0"
          >
            Got it
          </button>
        </motion.div>
      )}

      {/* Smart Omnibar & Controls with 3D Depth */}
      <section className="glass-panel rounded-3xl p-6 md:p-7 space-y-6 shadow-xl transition-all">
        {/* Row 1: Unified Omnibar Search & Radius Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Smart Omnibar Input */}
          <div className="lg:col-span-8 relative">
            <label className="block text-xs font-black text-slate-200 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Search size={15} className="text-teal-600" />
              <span>Search Pharmacy, Hospital, Doctor, or City Name</span>
            </label>
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <div className="absolute left-4 text-slate-500 pointer-events-none">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 2) {
                    geocodeLocation(e.target.value).then(setLocationSuggestions);
                    setShowSuggestions(true);
                  } else {
                    setShowSuggestions(false);
                  }
                }}
                onFocus={() => {
                  if (searchQuery.length > 2 && locationSuggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Type 'pharmacy', 'hospital', 'Apollo', 'Ballari', 'Bengaluru', 'Dr. Smith'..."
                className="w-full pl-11 pr-28 py-3.5 bg-slate-900/80 hover:bg-slate-900 focus:bg-slate-900 border border-slate-700/70/90 rounded-2xl text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-sm"
              />

              <div className="absolute right-2.5 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSuggestions(false);
                      fetchHealthcareFacilities("");
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-600 rounded-lg text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isGeocoding || !searchQuery.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white text-xs font-black rounded-xl shadow-md transition-all btn-3d disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isGeocoding ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  <span>Search</span>
                </button>
              </div>
            </form>

            {/* Location Autocomplete Dropdown */}
            {showSuggestions && locationSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 glass-panel bg-slate-900/90 rounded-2xl border border-slate-700/70/90 shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                <div className="p-2.5 text-[10px] font-black uppercase text-slate-500 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
                  <span>Matching Locations</span>
                  <span className="text-slate-500 font-normal">Click to set search center</span>
                </div>
                {locationSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full text-left p-3.5 hover:bg-teal-950/40 border-b border-slate-800/80 last:border-0 transition-colors flex items-center gap-3 text-xs text-slate-100 font-semibold"
                  >
                    <MapPin size={16} className="text-teal-600 shrink-0" />
                    <span className="truncate">{sug.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Radius Selector */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-black text-slate-200 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Compass size={15} className="text-teal-600" />
              <span>Search Radius</span>
            </label>
            <div className="flex items-center gap-1 bg-slate-700/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/80 shadow-inner">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusKm(r)}
                  className={cn(
                    "flex-1 py-2 text-xs font-black rounded-xl transition-all duration-200",
                    radiusKm === r
                      ? "bg-slate-900 text-teal-600 shadow-md shadow-slate-300/50 ring-1 ring-slate-700/80 scale-[1.02]"
                      : "text-slate-600 hover:text-slate-50 hover:bg-slate-900/55"
                  )}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Healthcare Category & Specialty Chips with 3D Pill Design */}
        <div className="space-y-2.5">
          <label className="block text-xs font-black text-slate-200 uppercase tracking-widest flex items-center justify-between">
            <span>Filter by Category & Specialty</span>
            <span className="text-slate-500 font-normal text-[11px]">Click a category to view live providers</span>
          </label>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black border transition-all duration-200",
                    isSelected
                      ? "bg-gradient-to-r from-teal-600 to-sky-600 text-white border-transparent shadow-lg shadow-teal-500/30 scale-105 ring-2 ring-teal-400/40"
                      : "bg-slate-900/80 hover:bg-slate-900 text-slate-200 border-slate-700/70/80 hover:border-teal-600/60/80 shadow-sm hover:shadow"
                  )}
                >
                  <span className="text-base">{cat.glyph}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Bar & Quick Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-700/70/60 text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>📍 Active Location:</span>
            <strong className="text-slate-50 bg-slate-900/85 px-3 py-1 rounded-xl border border-slate-700/70 shadow-sm">
              {locationName}
            </strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterOpenNow(!filterOpenNow)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-black border transition-all flex items-center gap-1.5 shadow-sm",
                filterOpenNow
                  ? "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/25 scale-105"
                  : "bg-slate-900/80 text-slate-200 border-slate-700/70/80 hover:bg-slate-800"
              )}
            >
              <span>🟢 Open Now</span>
            </button>

            <button
              onClick={() => setFilterEmergencyOnly(!filterEmergencyOnly)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-black border transition-all flex items-center gap-1.5 shadow-sm",
                filterEmergencyOnly
                  ? "bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/25 scale-105"
                  : "bg-slate-900/80 text-slate-200 border-slate-700/70/80 hover:bg-slate-800"
              )}
            >
              <span>🚨 Emergency 24/7</span>
            </button>

            <button
              onClick={() => fetchHealthcareFacilities()}
              disabled={isLoading}
              className="px-4 py-1.5 bg-teal-950/40 text-teal-300 hover:bg-teal-900/45 rounded-xl font-black border border-teal-700/60 transition-all flex items-center gap-1.5 shadow-sm"
              title="Refresh search"
            >
              <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* Mobile View Toggle */}
      <div className="lg:hidden flex rounded-2xl bg-slate-700/60 p-1 shadow-inner backdrop-blur-md">
        <button
          onClick={() => setActiveMobileView("both")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black rounded-xl transition-all",
            activeMobileView === "both" ? "bg-slate-900 text-teal-600 shadow-md" : "text-slate-200"
          )}
        >
          Combined View
        </button>
        <button
          onClick={() => setActiveMobileView("map")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black rounded-xl transition-all",
            activeMobileView === "map" ? "bg-slate-900 text-teal-600 shadow-md" : "text-slate-200"
          )}
        >
          🗺️ Leaflet Map
        </button>
        <button
          onClick={() => setActiveMobileView("list")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black rounded-xl transition-all",
            activeMobileView === "list" ? "bg-slate-900 text-teal-600 shadow-md" : "text-slate-200"
          )}
        >
          📋 Results ({displayedFacilities.length})
        </button>
      </div>

      {/* Main Two-Column Layout: Leaflet Map (Left) + Facility Cards (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Leaflet Map */}
        <div
          className={cn(
            "lg:col-span-7 sticky top-20 z-10 transition-all",
            activeMobileView === "list" ? "hidden lg:block" : "block"
          )}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black text-slate-50 text-sm flex items-center gap-2">
                <Compass size={18} className="text-teal-600" />
                <span>Interactive Leaflet Map</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                Click any marker for directions & phone number
              </span>
            </div>

            {/* Leaflet Map Component */}
            <HealthcareMap
              centerLat={coords.lat}
              centerLng={coords.lng}
              locationName={locationName}
              radiusKm={effectiveRadiusKm}
              facilities={displayedFacilities}
              selectedFacilityId={selectedFacilityId}
              onSelectFacility={handleSelectFacility}
              onSearchArea={handleSearchMapArea}
            />
          </div>
        </div>

        {/* Right Column: Scrollable Facility Cards */}
        <div
          className={cn(
            "lg:col-span-5 space-y-4",
            activeMobileView === "map" ? "hidden lg:block" : "block"
          )}
        >
          <div className="flex items-center justify-between px-2">
            <div>
              <h3 className="font-black text-slate-50 text-base flex items-center gap-2">
                <Building2 size={18} className="text-teal-600" />
                <span>Verified Facilities</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Sorted by distance from {locationName.split(",")[0]}
              </p>
            </div>
            <span className="px-3.5 py-1 bg-gradient-to-r from-teal-600 to-sky-600 text-white rounded-full text-xs font-black shadow-md shadow-teal-500/20">
              {displayedFacilities.length} Found
            </span>
          </div>

          {/* Results List */}
          <div
            ref={resultsContainerRef}
            className="space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1.5 custom-scrollbar"
          >
            {isLoading ? (
              <div className="p-12 text-center glass-panel rounded-3xl space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-sky-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-teal-500/30 animate-spin">
                  <RefreshCw size={28} />
                </div>
                <div>
                  <h4 className="font-black text-slate-50 text-base">Searching Nearby Healthcare...</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                    Querying live verified pharmacies, hospitals, and clinics within {radiusKm} km of {locationName}.
                  </p>
                </div>
              </div>
            ) : errorMessage && displayedFacilities.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-3xl space-y-4">
                <div className="w-14 h-14 bg-amber-900/45 rounded-2xl flex items-center justify-center text-amber-600 mx-auto shadow-sm">
                  <AlertCircle size={28} />
                </div>
                <div className="space-y-2">
                  <h4 className="font-black text-slate-50 text-base">No Facilities Found</h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    {errorMessage}
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => setRadiusKm(50)}
                    className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 text-white text-xs font-black rounded-xl transition-all btn-3d shadow-md"
                  >
                    Increase Radius to 50 km
                  </button>
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className="px-4 py-2.5 bg-slate-900/80 hover:bg-slate-900 text-slate-200 text-xs font-black rounded-xl border border-slate-700/70/80 transition-all shadow-sm"
                  >
                    Search All Healthcare
                  </button>
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {displayedFacilities.map((facility, index) => {
                  const isSelected = facility.id === selectedFacilityId;
                  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`;
                  const categoryInfo = CATEGORIES.find((c) => c.id === facility.category);

                  return (
                    <motion.div
                      key={facility.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(facility.id, el);
                        else cardRefs.current.delete(facility.id);
                      }}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.04, 0.3) }}
                      onClick={() => handleSelectFacility(facility)}
                      className={cn(
                        "p-5 rounded-3xl transition-all duration-300 cursor-pointer relative overflow-hidden group glass-card glass-card-hover",
                        isSelected
                          ? "bg-gradient-to-br from-teal-950/40 via-white/95 to-sky-950/30 border-teal-500 shadow-2xl shadow-teal-500/20 ring-2 ring-teal-500 scale-[1.01]"
                          : "hover:border-teal-600/60"
                      )}
                    >
                      {/* Top Row: Category Glyph & Badge + Distance */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <span className="px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-300 border border-teal-700/60 flex items-center gap-1.5 shadow-sm">
                          <span>{categoryInfo?.glyph || "⚕️"}</span>
                          <span>{facility.categoryLabel}</span>
                        </span>

                        <div className="flex items-center gap-1.5 bg-slate-900/85 px-3 py-1 rounded-full text-xs font-black text-slate-100 border border-slate-700/70/80 shadow-sm">
                          <Navigation size={12} className="text-teal-600" />
                          <span>{facility.distanceFormatted}</span>
                        </div>
                      </div>

                      {/* Facility Name */}
                      <h4 className="font-black text-slate-50 text-base group-hover:text-teal-600 transition-colors leading-snug mb-2">
                        {facility.name}
                      </h4>

                      {/* Exact Address */}
                      <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed font-medium">
                            {facility.address}
                          </span>
                        </div>

                        {/* Speciality if present */}
                        {facility.speciality && (
                          <div className="flex items-center gap-2 text-sky-300 font-bold pl-5 text-[11px]">
                            <span>✨ {facility.speciality}</span>
                          </div>
                        )}
                      </div>

                      {/* Contact & Hours Info Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-700/70/60 text-xs mb-3.5">
                        {/* Phone */}
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact</p>
                          {facility.phone && facility.phone !== "Not available" ? (
                            <a
                              href={`tel:${facility.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-teal-600 hover:underline font-black flex items-center gap-1 mt-0.5"
                            >
                              <Phone size={12} /> {facility.phone}
                            </a>
                          ) : (
                            <p className="text-slate-500 font-medium mt-0.5">Not available</p>
                          )}
                        </div>

                        {/* Opening Hours */}
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opening Hours</p>
                          <p className="text-slate-200 font-bold line-clamp-1 mt-0.5" title={facility.openingHours}>
                            {facility.openingHours || "Open Daily"}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="sm:col-span-2 pt-2 border-t border-slate-700/70/60 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Status</span>
                          <div>
                            {facility.isOpenNow === true ? (
                              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-black bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
                                🟢 Open Now
                              </span>
                            ) : facility.isOpenNow === false ? (
                              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-sm shadow-rose-500/30">
                                🔴 Closed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-200">
                                ⚪ Hours Listed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-700/70/60">
                        {/* Get Directions Button */}
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white rounded-2xl text-xs font-black shadow-md shadow-teal-500/25 transition-all btn-3d flex items-center justify-center gap-1.5"
                        >
                          <Navigation size={14} />
                          <span>Get Directions</span>
                        </a>

                        {/* View on Map Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectFacility(facility);
                            if (window.innerWidth < 1024) setActiveMobileView("map");
                          }}
                          className="py-2.5 px-3.5 bg-slate-900/85 hover:bg-teal-950/40 text-slate-200 hover:text-teal-300 rounded-2xl text-xs font-black border border-slate-700/70/90 transition-all shadow-sm flex items-center justify-center gap-1"
                        >
                          <Compass size={14} />
                          <span>View on Map</span>
                        </button>

                        {/* Direct Call Button (if phone available) */}
                        {facility.phone && facility.phone !== "Not available" && (
                          <a
                            href={`tel:${facility.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-500/20 transition-all btn-3d"
                            title={`Call ${facility.name}`}
                          >
                            <Phone size={15} />
                          </a>
                        )}

                        {/* Website Link (if website available) */}
                        {facility.website && facility.website !== "Not available" && (
                          <a
                            href={facility.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2.5 bg-slate-900/85 hover:bg-slate-800 text-slate-600 rounded-2xl border border-slate-700/70/80 transition-all shadow-sm"
                            title="Visit Official Website"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
