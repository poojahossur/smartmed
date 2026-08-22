import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { HealthcareFacility } from "../types";
import { Maximize2, LocateFixed, Layers, Navigation, Phone, ExternalLink, RefreshCw, Compass } from "lucide-react";

interface HealthcareMapProps {
  centerLat: number;
  centerLng: number;
  locationName: string;
  radiusKm: number;
  facilities: HealthcareFacility[];
  selectedFacilityId: string | null;
  onSelectFacility: (facility: HealthcareFacility) => void;
  onSearchArea?: (lat: number, lng: number) => void;
}

// Icon helper functions
const getCategoryColor = (category: string) => {
  switch (category) {
    case "pharmacy":
      return { bg: "#10b981", border: "#047857", text: "#ffffff", ring: "rgba(16, 185, 129, 0.4)", label: "Pharmacy" }; // Emerald
    case "hospital":
      return { bg: "#ef4444", border: "#b91c1c", text: "#ffffff", ring: "rgba(239, 68, 68, 0.4)", label: "Hospital" }; // Rose/Red
    case "clinic":
      return { bg: "#0d9488", border: "#0f766e", text: "#ffffff", ring: "rgba(13, 148, 136, 0.4)", label: "Clinic" }; // Teal
    case "doctor":
      return { bg: "#7c3aed", border: "#5b21b6", text: "#ffffff", ring: "rgba(124, 58, 237, 0.4)", label: "Doctor" }; // Violet
    case "dental":
      return { bg: "#06b6d4", border: "#0e7490", text: "#ffffff", ring: "rgba(6, 182, 212, 0.4)", label: "Dental" }; // Cyan
    case "eye":
      return { bg: "#f59e0b", border: "#b45309", text: "#ffffff", ring: "rgba(245, 158, 11, 0.4)", label: "Eye Care" }; // Amber
    case "heart":
      return { bg: "#e11d48", border: "#9f1239", text: "#ffffff", ring: "rgba(225, 29, 72, 0.4)", label: "Cardiac" }; // Rose
    case "skin":
      return { bg: "#8b5cf6", border: "#6d28d9", text: "#ffffff", ring: "rgba(139, 92, 246, 0.4)", label: "Skin Care" }; // Purple
    case "ent":
      return { bg: "#ec4899", border: "#be185d", text: "#ffffff", ring: "rgba(236, 72, 153, 0.4)", label: "ENT" }; // Pink
    default:
      return { bg: "#0284c7", border: "#0369a1", text: "#ffffff", ring: "rgba(2, 132, 199, 0.4)", label: "Healthcare" };
  }
};

const getCategoryGlyph = (category: string) => {
  switch (category) {
    case "pharmacy":
      return "💊";
    case "hospital":
      return "🏥";
    case "dental":
      return "🦷";
    case "eye":
      return "👁️";
    case "heart":
      return "❤️";
    case "skin":
      return "✨";
    case "ent":
      return "👂";
    case "doctor":
      return "🩺";
    case "clinic":
    default:
      return "⚕️";
  }
};

export default function HealthcareMap({
  centerLat,
  centerLng,
  locationName,
  radiusKm,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  onSearchArea,
}: HealthcareMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  const [mapStyle, setMapStyle] = useState<"standard" | "light">("standard");
  const [mapCenterPos, setMapCenterPos] = useState<{ lat: number; lng: number }>({ lat: centerLat, lng: centerLng });
  const [showSearchThisArea, setShowSearchThisArea] = useState<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: radiusKm > 30 ? 11 : radiusKm > 15 ? 13 : 14,
        zoomControl: false,
        attributionControl: true,
      });

      const standardLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = standardLayer;

      // Add clean zoom control top right
      L.control.zoom({ position: "topright" }).addTo(map);

      // Track drag events for "Search this area"
      map.on("moveend", () => {
        const center = map.getCenter();
        setMapCenterPos({ lat: center.lat, lng: center.lng });
        const dLat = Math.abs(center.lat - centerLat);
        const dLng = Math.abs(center.lng - centerLng);
        // If user moved significantly (> 1.5 km), show "Search this area" button
        if (dLat > 0.015 || dLng > 0.015) {
          setShowSearchThisArea(true);
        } else {
          setShowSearchThisArea(false);
        }
      });

      mapInstanceRef.current = map;

      // Ensure proper tile sizing after mount
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    // Set up ResizeObserver to handle layout/window size changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Change Map Style (Standard vs Light)
  const toggleMapStyle = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapStyle === "standard") {
      const lightLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & CartoDB',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = lightLayer;
      setMapStyle("light");
    } else {
      const standardLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = standardLayer;
      setMapStyle("standard");
    }
  };

  // Update Center Marker & Radius Circle when location/radius changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setShowSearchThisArea(false);

    // Update or create center user location marker
    const userCenterIcon = L.divIcon({
      className: "custom-user-center-marker",
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-3 rounded-full bg-teal-500/20 animate-ping"></div>
          <div class="absolute -inset-2 rounded-full bg-teal-500/30"></div>
          <div class="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs transform hover:scale-110 transition-transform">
            📍
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([centerLat, centerLng]);
    } else {
      const marker = L.marker([centerLat, centerLng], { icon: userCenterIcon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(`
        <div class="p-3 text-center min-w-[160px] font-sans">
          <div class="text-[10px] font-extrabold tracking-wider text-teal-600 uppercase mb-1">Search Center</div>
          <div class="font-bold text-slate-50 text-sm">${locationName || "Selected Location"}</div>
          <div class="text-xs text-slate-500 mt-1">${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}</div>
        </div>
      `);
      centerMarkerRef.current = marker;
    }

    // Update or create radius circle
    const radiusMeters = radiusKm * 1000;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng([centerLat, centerLng]);
      radiusCircleRef.current.setRadius(radiusMeters);
    } else {
      radiusCircleRef.current = L.circle([centerLat, centerLng], {
        radius: radiusMeters,
        color: "#0d9488",
        weight: 2,
        opacity: 0.7,
        fillColor: "#14b8a6",
        fillOpacity: 0.07,
        dashArray: "6, 8",
      }).addTo(map);
    }

    // Pan smoothly to center
    map.setView([centerLat, centerLng], radiusKm > 30 ? 11 : radiusKm > 15 ? 13 : 14, {
      animate: true,
    });
  }, [centerLat, centerLng, radiusKm, locationName]);

  // Update Facility Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Create new markers
    facilities.forEach((facility) => {
      const isSelected = facility.id === selectedFacilityId;
      const theme = getCategoryColor(facility.category);
      const glyph = getCategoryGlyph(facility.category);

      const customIcon = L.divIcon({
        className: "custom-facility-marker",
        html: `
          <div class="relative group cursor-pointer transition-all duration-300 transform ${
            isSelected ? "scale-125 z-50" : "hover:scale-115"
          }">
            ${
              isSelected
                ? `<div class="absolute -inset-2.5 rounded-full animate-ping" style="background-color: ${theme.ring};"></div>`
                : ""
            }
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white transition-all text-base font-semibold"
                 style="background: linear-gradient(135deg, ${theme.bg}, ${theme.border}); color: ${theme.text}; box-shadow: 0 8px 20px ${theme.ring};">
              <span>${glyph}</span>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 border-r border-b border-white"
                 style="background-color: ${theme.border};"></div>
          </div>
        `,
        iconSize: [40, 46],
        iconAnchor: [20, 46],
        popupAnchor: [0, -42],
      });

      const marker = L.marker([facility.lat, facility.lng], { icon: customIcon }).addTo(map);

      // Build rich popup HTML
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`;
      const statusBadge =
        facility.isOpenNow === true
          ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-900/45 text-emerald-300 border border-emerald-700/60">🟢 Open Now</span>`
          : facility.isOpenNow === false
          ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-900/45 text-rose-300 border border-rose-700/60">🔴 Closed</span>`
          : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-200">⚪ Hours: ${
              facility.openingHours !== "Not available" ? facility.openingHours : "Open Daily"
            }</span>`;

      const popupContent = `
        <div class="p-4 max-w-[290px] font-sans">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md" style="background-color: ${theme.ring}; color: ${theme.border};">
              ${facility.categoryLabel}
            </span>
            <span class="text-xs font-extrabold text-teal-600 bg-teal-950/40 px-2 py-0.5 rounded-full">${facility.distanceFormatted}</span>
          </div>

          <h4 class="font-extrabold text-slate-50 text-base leading-snug mb-1.5">${facility.name}</h4>
          
          <p class="text-xs text-slate-600 mb-2.5 leading-relaxed flex items-start gap-1">
            <span class="text-slate-500">📍</span> 
            <span>${facility.address}</span>
          </p>

          ${
            facility.speciality
              ? `<p class="text-[11px] font-semibold text-sky-300 mb-2 bg-sky-950/40 px-2 py-1 rounded-lg">
                  ✨ ${facility.speciality}
                </p>`
              : ""
          }

          <div class="mb-3">
            ${statusBadge}
          </div>

          ${
            facility.phone && facility.phone !== "Not available"
              ? `<div class="text-xs text-slate-100 font-semibold mb-3 flex items-center gap-1.5 bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span>📞</span> 
                  <a href="tel:${facility.phone}" class="text-teal-600 hover:underline font-bold">${facility.phone}</a>
                </div>`
              : ""
          }

          <div class="flex items-center gap-2 pt-2 border-t border-slate-800">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" 
               class="flex-1 text-center py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-200 transition-all flex items-center justify-center gap-1.5">
              🧭 Directions
            </a>
            ${
              facility.website && facility.website !== "Not available"
                ? `<a href="${facility.website}" target="_blank" rel="noopener noreferrer"
                      class="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center">
                    🌐 Web
                  </a>`
                : ""
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onSelectFacility(facility);
      });

      markersRef.current.set(facility.id, marker);
    });
  }, [facilities, selectedFacilityId]);

  // Focus and open popup when selectedFacilityId changes
  useEffect(() => {
    if (!selectedFacilityId || !mapInstanceRef.current) return;
    const marker = markersRef.current.get(selectedFacilityId);
    if (marker) {
      const latLng = marker.getLatLng();
      mapInstanceRef.current.setView(latLng, Math.max(mapInstanceRef.current.getZoom(), 15), {
        animate: true,
      });
      marker.openPopup();
    }
  }, [selectedFacilityId]);

  // Handler to recenter to current search
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([centerLat, centerLng], radiusKm > 30 ? 11 : radiusKm > 15 ? 13 : 14, {
      animate: true,
    });
    if (centerMarkerRef.current) {
      centerMarkerRef.current.openPopup();
    }
    setShowSearchThisArea(false);
  };

  // Handler to fit all facilities
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    if (facilities.length === 0) {
      handleRecenter();
      return;
    }
    const group = L.featureGroup([
      L.marker([centerLat, centerLng]),
      ...facilities.map((f) => L.marker([f.lat, f.lng])),
    ]);
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.15), { animate: true });
    setShowSearchThisArea(false);
  };

  // Trigger search at current map center
  const handleSearchThisAreaClick = () => {
    if (onSearchArea) {
      onSearchArea(mapCenterPos.lat, mapCenterPos.lng);
      setShowSearchThisArea(false);
    }
  };

  // Count by category for the map legend
  const pharmacyCount = facilities.filter((f) => f.category === "pharmacy").length;
  const hospitalCount = facilities.filter((f) => f.category === "hospital").length;
  const clinicCount = facilities.filter((f) => f.category === "clinic" || f.category === "doctor").length;

  return (
    <div className="relative w-full h-full min-h-[480px] lg:min-h-[660px] rounded-3xl overflow-hidden shadow-2xl border border-white/60 bg-slate-900/5 backdrop-blur-xl">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" style={{ minHeight: "inherit" }} />

      {/* Floating "Search this area" Button when map is panned */}
      {showSearchThisArea && onSearchArea && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] animate-bounce">
          <button
            onClick={handleSearchThisAreaClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white rounded-full shadow-2xl border border-white/40 text-xs font-black transition-all btn-3d"
          >
            <RefreshCw size={14} className="animate-spin" />
            <span>Search This Map Area</span>
          </button>
        </div>
      )}

      {/* Floating Map Controls Top-Left */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2.5">
        <button
          onClick={handleRecenter}
          className="flex items-center gap-2 px-3.5 py-2.5 glass-card bg-slate-900/85 hover:bg-slate-900 text-slate-100 hover:text-teal-600 rounded-2xl shadow-xl text-xs font-black transition-all btn-3d"
          title="Center on search location"
        >
          <LocateFixed size={16} className="text-teal-600" />
          <span>Center</span>
        </button>

        {facilities.length > 0 && (
          <button
            onClick={handleFitAll}
            className="flex items-center gap-2 px-3.5 py-2.5 glass-card bg-slate-900/85 hover:bg-slate-900 text-slate-100 hover:text-emerald-600 rounded-2xl shadow-xl text-xs font-black transition-all btn-3d"
            title="Fit all markers in view"
          >
            <Maximize2 size={16} className="text-emerald-600" />
            <span>Fit All ({facilities.length})</span>
          </button>
        )}

        <button
          onClick={toggleMapStyle}
          className="flex items-center gap-2 px-3.5 py-2 glass-card bg-slate-900/85 hover:bg-slate-900 text-slate-100 hover:text-sky-600 rounded-2xl shadow-xl text-xs font-black transition-all btn-3d"
          title="Toggle map style"
        >
          <Layers size={15} className="text-sky-600" />
          <span>{mapStyle === "standard" ? "Clean View" : "Street View"}</span>
        </button>
      </div>

      {/* Map Legend Chips at Top-Right */}
      <div className="absolute top-16 right-4 z-[400] hidden sm:flex flex-col gap-2 items-end pointer-events-none">
        <div className="flex items-center gap-2 glass-card bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/60 text-[11px] font-black shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400"></span>
          <span>💊 Pharmacies: {pharmacyCount}</span>
        </div>
        <div className="flex items-center gap-2 glass-card bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/60 text-[11px] font-black shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-400"></span>
          <span>🏥 Hospitals: {hospitalCount}</span>
        </div>
        {clinicCount > 0 && (
          <div className="flex items-center gap-2 glass-card bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/60 text-[11px] font-black shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-sm shadow-teal-400"></span>
            <span>⚕️ Clinics: {clinicCount}</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Status Pill */}
      <div className="absolute bottom-4 left-4 right-4 z-[400] pointer-events-none">
        <div className="max-w-max glass-panel bg-slate-900/85 backdrop-blur-xl rounded-2xl p-2.5 px-4 shadow-2xl border border-white/80 text-xs text-slate-200 flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-2 font-black text-slate-50">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse"></span>
            <span>{locationName || "Location"}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="font-bold text-slate-500">Radius: {radiusKm} km</span>
          <span className="text-slate-600">|</span>
          <span className="font-black text-emerald-600">{facilities.length} healthcare points</span>
        </div>
      </div>
    </div>
  );
}
