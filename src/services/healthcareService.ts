import { HealthcareCategory, HealthcareFacility, GeocodedLocation, HealthcareSearchResponse } from "../types";

/**
 * Calculates Haversine distance in kilometers between two lat/lng points.
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance into meters (<1km) or kilometers (>=1km).
 */
export function formatDistance(distanceKm: number): string {
  if (isNaN(distanceKm)) return "Unknown";
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Geocodes an entered city/locality/address using OpenStreetMap Nominatim.
 */
export async function geocodeLocation(query: string): Promise<GeocodedLocation[]> {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();

  // Try backend proxy first for optimal reliability
  try {
    const res = await fetch(`/api/healthcare/geocode?q=${encodeURIComponent(cleanQuery)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Backend geocode proxy failed, falling back to direct Nominatim:", err);
  }

  // Direct Nominatim fallback
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&addressdetails=1&limit=5`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim error ${res.status}`);
    }

    const data = await res.json();
    return data.map((item: any) => {
      const addr = item.address || {};
      const shortName = addr.city || addr.town || addr.village || addr.suburb || addr.county || item.name || cleanQuery;
      const state = addr.state || addr.region || "";
      const country = addr.country || "";
      const displayParts = [shortName, state, country].filter(Boolean);

      return {
        name: shortName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name || displayParts.join(", "),
      };
    });
  } catch (error) {
    console.error("Geocoding failed:", error);
    return [];
  }
}

/**
 * Reverse geocodes coordinates to a human-readable location name.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`/api/healthcare/reverse?lat=${lat}&lon=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.displayName) return data.displayName;
    }
  } catch (err) {
    console.warn("Backend reverse geocode proxy fallback:", err);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const locality = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village || addr.county;
      const state = addr.state || "";
      if (locality && state) {
        return `${locality}, ${state}`;
      } else if (locality) {
        return locality;
      }
      return data.display_name?.split(",").slice(0, 3).join(",") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  } catch (e) {
    console.error("Reverse geocoding error:", e);
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Accurately determines if a healthcare facility is currently open based on
 * its opening hours string, days available, emergency status, and current time.
 */
export function computeFacilityOpenStatus(
  openingHours?: string,
  daysAvailable?: string,
  emergency?: boolean,
  clientDate?: Date
): boolean | null {
  if (!openingHours || openingHours === "Not available" || openingHours.trim() === "") {
    if (emergency) return true;
    return null;
  }

  const clean = openingHours.trim();
  const lowerHours = clean.toLowerCase();
  const lowerDays = (daysAvailable || "").toLowerCase();

  // 1. 24/7 or 24 Hours Emergency Check
  if (
    lowerHours.includes("24/7") ||
    lowerHours.includes("24 hours") ||
    lowerHours.includes("open 24") ||
    lowerHours.includes("24 hr") ||
    lowerHours.includes("round the clock") ||
    (emergency && lowerHours.includes("emergency"))
  ) {
    return true;
  }

  const now = clientDate || new Date();
  const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 2. Day-of-week Schedule Checks
  const isClosedOnSunday =
    lowerDays.includes("mon - sat") ||
    lowerDays.includes("mo-sa") ||
    lowerHours.includes("mon - sat") ||
    lowerHours.includes("mo-sa") ||
    lowerHours.includes("closed on sun") ||
    lowerDays.includes("closed on sun") ||
    lowerHours.includes("sun closed") ||
    lowerDays.includes("sun closed");

  if (isClosedOnSunday && currentDay === 0) {
    return false;
  }

  const isClosedOnWeekend =
    lowerDays.includes("mon - fri") ||
    lowerDays.includes("mo-fr") ||
    lowerHours.includes("mon - fri") ||
    lowerHours.includes("mo-fr");

  if (isClosedOnWeekend && (currentDay === 0 || currentDay === 6)) {
    return false;
  }

  // 3. Helper to parse time strings like "10:00", "14:30", "9:00 AM", "8:30 PM" into minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number | null => {
    const t = timeStr.trim().toLowerCase();
    const isPM = t.includes("pm");
    const isAM = t.includes("am");
    const numPart = t.replace(/[^\d:]/g, "");
    if (!numPart) return null;

    let h = 0;
    let m = 0;
    if (numPart.includes(":")) {
      const [hStr, mStr] = numPart.split(":");
      h = parseInt(hStr, 10);
      m = parseInt(mStr, 10) || 0;
    } else {
      h = parseInt(numPart, 10);
      m = 0;
    }

    if (isNaN(h)) return null;

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    return h * 60 + m;
  };

  // 4. Extract all shift time intervals from the hours string (e.g. "10:00 - 14:00, 17:30 - 20:30")
  const rangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  const matches = [...clean.matchAll(rangeRegex)];

  if (matches.length === 0) {
    if (emergency) return true;
    return null;
  }

  let isAnyShiftOpen = false;

  for (const match of matches) {
    const startStr = match[1];
    const endStr = match[2];

    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);

    if (startMin === null || endMin === null) continue;

    if (startMin <= endMin) {
      // Normal shift within same day (e.g., 09:00 - 20:00, or 10:00 - 14:00)
      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        isAnyShiftOpen = true;
        break;
      }
    } else {
      // Overnight shift crossing midnight (e.g., 20:00 - 02:00)
      if (currentMinutes >= startMin || currentMinutes <= endMin) {
        isAnyShiftOpen = true;
        break;
      }
    }
  }

  return isAnyShiftOpen;
}

/**
 * Parses and determines opening status and formatted hours from OSM tags.
 */
export function parseOpeningHours(raw?: string, emergency?: boolean): {
  formatted: string;
  days?: string;
  hours?: string;
  isOpenNow: boolean | null;
} {
  if (!raw || raw.trim() === "") {
    return {
      formatted: emergency ? "Open 24/7 (Emergency)" : "Not available",
      days: emergency ? "Mon - Sun (Daily)" : undefined,
      hours: emergency ? "24 Hours" : undefined,
      isOpenNow: emergency ? true : null,
    };
  }

  const clean = raw.trim();
  const isOpenNow = computeFacilityOpenStatus(clean, undefined, emergency);

  return {
    formatted: clean,
    days: clean.includes("Mo-") ? "Mon - Sat (or listed schedule)" : undefined,
    hours: clean,
    isOpenNow,
  };
}

/**
 * Builds standard OSM Overpass QL query string based on category, radius and coordinates.
 */
function buildOverpassQuery(lat: number, lng: number, radiusMeters: number, category: HealthcareCategory): string {
  const r = radiusMeters;
  let filters = "";

  switch (category) {
    case "pharmacy":
      filters = `
        nwr["amenity"="pharmacy"](around:${r},${lat},${lng});
        nwr["healthcare"="pharmacy"](around:${r},${lat},${lng});
        nwr["shop"="chemist"](around:${r},${lat},${lng});
        nwr["shop"="pharmacy"](around:${r},${lat},${lng});
        nwr["shop"="drugstore"](around:${r},${lat},${lng});
        nwr["shop"="medical"](around:${r},${lat},${lng});
        nwr["dispensing"="yes"](around:${r},${lat},${lng});
        nwr["healthcare"="dispensary"](around:${r},${lat},${lng});
        nwr["amenity"="dispensary"](around:${r},${lat},${lng});
        nwr["name"~"Pharmacy|Chemist|Medical|Medicals|Drug|Pharma|Aushadhi|Dawakhana|Dawa|Dava|Druggist|Aushadhalaya|Apollo|MedPlus",i](around:${r},${lat},${lng});
      `;
      break;

    case "hospital":
      filters = `
        nwr["amenity"="hospital"](around:${r},${lat},${lng});
        nwr["healthcare"="hospital"](around:${r},${lat},${lng});
        nwr["building"="hospital"](around:${r},${lat},${lng});
        nwr["emergency"="yes"](around:${r},${lat},${lng});
        nwr["name"~"Hospital|Nursing Home|Health Center|Health Centre|Arogya|Chikitsalaya|Kendra|Medical Center|Medical Centre|Multi Speciality|Multispeciality|Institute of Medical Sciences|Medical College",i](around:${r},${lat},${lng});
      `;
      break;

    case "clinic":
      filters = `
        nwr["amenity"="clinic"](around:${r},${lat},${lng});
        nwr["healthcare"="clinic"](around:${r},${lat},${lng});
        nwr["amenity"="doctors"](around:${r},${lat},${lng});
        nwr["healthcare"="doctor"](around:${r},${lat},${lng});
        nwr["healthcare"="centre"](around:${r},${lat},${lng});
        nwr["healthcare"="physician"](around:${r},${lat},${lng});
        nwr["healthcare"="health_post"](around:${r},${lat},${lng});
        nwr["healthcare"="nursing_home"](around:${r},${lat},${lng});
        nwr["name"~"Clinic|Dispensary|Polyclinic|Consulting|Matru|Arogya|Health Post|Diagnostic|Health Care|Healthcare|Lab",i](around:${r},${lat},${lng});
      `;
      break;

    case "doctor":
      filters = `
        nwr["amenity"="doctors"](around:${r},${lat},${lng});
        nwr["healthcare"="doctor"](around:${r},${lat},${lng});
        nwr["healthcare"="physician"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"](around:${r},${lat},${lng});
        nwr["name"~"Dr\\.|Doctor|Physician|Specialist|Consultant|MBBS|MD|MS|Surgeon|Practitioner|Ayurved|Homeo",i](around:${r},${lat},${lng});
      `;
      break;

    case "dental":
      filters = `
        nwr["amenity"="dentist"](around:${r},${lat},${lng});
        nwr["healthcare"="dentist"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="dentistry"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="dental"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="orthodontics"](around:${r},${lat},${lng});
        nwr["healthcare"="dental"](around:${r},${lat},${lng});
        nwr["name"~"Dental|Dentist|Dento|Teeth|Tooth|Orthodont|Oral|Danta|Dentistry|Smile|Root Canal",i](around:${r},${lat},${lng});
      `;
      break;

    case "eye":
      filters = `
        nwr["healthcare:speciality"="ophthalmology"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="optometry"](around:${r},${lat},${lng});
        nwr["shop"="optician"](around:${r},${lat},${lng});
        nwr["shop"="optics"](around:${r},${lat},${lng});
        nwr["healthcare"="optometrist"](around:${r},${lat},${lng});
        nwr["healthcare"="ophthalmologist"](around:${r},${lat},${lng});
        nwr["healthcare"="eye_clinic"](around:${r},${lat},${lng});
        nwr["healthcare"="optician"](around:${r},${lat},${lng});
        nwr["amenity"~"hospital|clinic|doctors"]["name"~"Eye|Ophthal|Netra|Drishti|Vision|Optic|Sight|Nayanam|Retina|Cataract",i](around:${r},${lat},${lng});
        nwr["name"~"Eye Hospital|Eye Care|Eye Clinic|Netralaya|Drishti|Vision Care|Optical|Opticals|Optician|Lenskart|Titan Eye",i](around:${r},${lat},${lng});
      `;
      break;

    case "heart":
      filters = `
        nwr["healthcare:speciality"="cardiology"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="cardiac"](around:${r},${lat},${lng});
        nwr["healthcare"="cardiology"](around:${r},${lat},${lng});
        nwr["healthcare"="cardiologist"](around:${r},${lat},${lng});
        nwr["amenity"~"hospital|clinic|doctors"]["name"~"Heart|Cardio|Cardiac|Hriday|Coronary|Cardiologist",i](around:${r},${lat},${lng});
        nwr["name"~"Heart|Cardio|Cardiac|Hriday|Heart Care|Heart Institute|Vascular",i](around:${r},${lat},${lng});
      `;
      break;

    case "skin":
      filters = `
        nwr["healthcare:speciality"="dermatology"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="skin"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="cosmetology"](around:${r},${lat},${lng});
        nwr["healthcare"="dermatologist"](around:${r},${lat},${lng});
        nwr["amenity"~"hospital|clinic|doctors"]["name"~"Skin|Derma|Cosmetic|Twacha|Laser|Dermatolog|Aesthetics",i](around:${r},${lat},${lng});
        nwr["name"~"Skin Care|Derma|Skin Clinic|Skin Hospital|Dermatolog|Cosmetolog|Trichology",i](around:${r},${lat},${lng});
      `;
      break;

    case "ent":
      filters = `
        nwr["healthcare:speciality"="ent"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="otolaryngology"](around:${r},${lat},${lng});
        nwr["healthcare:speciality"="otorhinolaryngology"](around:${r},${lat},${lng});
        nwr["healthcare"="ent"](around:${r},${lat},${lng});
        nwr["amenity"~"hospital|clinic|doctors"]["name"~"ENT|Ear|Nose|Throat|Kan|Mook|Gala|Oto|Larynx",i](around:${r},${lat},${lng});
        nwr["name"~"ENT Hospital|ENT Clinic|Ear Nose Throat|ENT Care|ENT Centre|Audiology|Hearing",i](around:${r},${lat},${lng});
      `;
      break;

    case "all":
    default:
      filters = `
        nwr["amenity"~"pharmacy|hospital|clinic|doctors|dentist"](around:${r},${lat},${lng});
        nwr["healthcare"](around:${r},${lat},${lng});
        nwr["shop"~"chemist|pharmacy|drugstore|optician|medical"](around:${r},${lat},${lng});
      `;
      break;
  }

  return `
    [out:json][timeout:30];
    (
      ${filters}
    );
    out center tags;
  `;
}

/**
 * Determines category from OSM tags.
 */
function resolveCategory(tags: Record<string, string>, requestedCategory: HealthcareCategory): { category: HealthcareCategory; label: string } {
  const name = (tags.name || "").toLowerCase();
  const spec = (tags["healthcare:speciality"] || "").toLowerCase();
  const amenity = (tags.amenity || "").toLowerCase();
  const healthcare = (tags.healthcare || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();

  if (requestedCategory !== "all") {
    const labels: Record<HealthcareCategory, string> = {
      pharmacy: "Pharmacy / Medical Store",
      hospital: "Hospital",
      clinic: "General Clinic",
      doctor: "Doctor / Physician",
      dental: "Dental Clinic",
      eye: "Eye Care / Ophthalmology",
      heart: "Cardiology / Heart Center",
      skin: "Dermatology / Skin Care",
      ent: "ENT Clinic",
      all: "Healthcare Facility",
    };
    return { category: requestedCategory, label: labels[requestedCategory] };
  }

  if (amenity === "pharmacy" || healthcare === "pharmacy" || shop === "chemist" || shop === "pharmacy" || shop === "drugstore" || name.includes("pharmacy") || name.includes("medicals") || name.includes("chemist")) {
    return { category: "pharmacy", label: "Pharmacy / Medical Store" };
  }
  if (amenity === "dentist" || healthcare === "dentist" || spec.includes("dent") || name.includes("dental") || name.includes("dentist")) {
    return { category: "dental", label: "Dental Clinic" };
  }
  if (spec.includes("ophthal") || spec.includes("optom") || shop === "optician" || name.includes("eye") || name.includes("netra") || name.includes("vision")) {
    return { category: "eye", label: "Eye Care / Ophthalmology" };
  }
  if (spec.includes("cardio") || spec.includes("cardiac") || name.includes("heart") || name.includes("cardio")) {
    return { category: "heart", label: "Cardiology / Heart Center" };
  }
  if (spec.includes("derma") || spec.includes("skin") || name.includes("skin") || name.includes("derma")) {
    return { category: "skin", label: "Dermatology / Skin Care" };
  }
  if (spec.includes("ent") || spec.includes("otolaryngology") || name.includes("ent") || name.includes("ear")) {
    return { category: "ent", label: "ENT Clinic" };
  }
  if (amenity === "hospital" || healthcare === "hospital" || name.includes("hospital")) {
    return { category: "hospital", label: "Hospital" };
  }
  if (amenity === "clinic" || healthcare === "clinic" || name.includes("clinic")) {
    return { category: "clinic", label: "General Clinic" };
  }
  if (amenity === "doctors" || healthcare === "doctor" || healthcare === "physician" || name.includes("dr.") || name.includes("doctor")) {
    return { category: "doctor", label: "Doctor / Physician" };
  }

  return { category: "clinic", label: "Healthcare Facility" };
}

/**
 * Formats a clean street address from OSM tags.
 */
function formatOSMAddress(tags: Record<string, string>): string {
  const parts: string[] = [];

  const houseNumber = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const fullAddr = tags["addr:full"];

  if (fullAddr) {
    return fullAddr;
  }

  if (houseNumber && street) {
    parts.push(`${houseNumber} ${street}`);
  } else if (street) {
    parts.push(street);
  }

  const locality = tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:district"] || tags["addr:quarter"];
  if (locality) parts.push(locality);

  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"];
  if (city) parts.push(city);

  const state = tags["addr:state"];
  if (state) parts.push(state);

  const postcode = tags["addr:postcode"];
  if (postcode) parts.push(postcode);

  if (parts.length === 0) {
    return "Not available";
  }

  return parts.join(", ");
}

/**
 * Searches real healthcare facilities nearby using OpenStreetMap / Overpass API.
 */
export async function searchNearbyHealthcare(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  category: HealthcareCategory;
  searchTerm?: string;
}): Promise<HealthcareSearchResponse> {
  const { lat, lng, radiusKm, category, searchTerm } = params;
  const initialRadius = radiusKm || 50;

  // 1. Try server-side endpoint first
  try {
    const res = await fetch("/api/healthcare/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat,
        lng,
        radiusKm: initialRadius,
        category,
        searchTerm,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.results)) {
        return {
          results: data.results,
          total: data.total ?? data.results.length,
          effectiveRadiusKm: data.effectiveRadiusKm ?? initialRadius,
          autoExpanded: Boolean(data.autoExpanded),
          originalRadiusKm: initialRadius,
        };
      }
    }
  } catch (err) {
    console.warn("Backend healthcare search proxy failed, falling back to direct Overpass endpoints:", err);
  }

  // 2. Direct fallback using Nominatim & Photon & fast Overpass
  const dLat = (initialRadius) / 111;
  const dLng = (initialRadius) / (111 * Math.cos((lat * Math.PI) / 180));
  const south = Math.max(-90, lat - dLat).toFixed(4);
  const north = Math.min(90, lat + dLat).toFixed(4);
  const west = Math.max(-180, lng - dLng).toFixed(4);
  const east = Math.min(180, lng + dLng).toFixed(4);
  const bbox = `${south},${west},${north},${east}`;
  const viewboxNom = `${west},${north},${east},${south}`;

  // Fetch Nominatim
  const keywordsMap: Record<string, string[]> = {
    pharmacy: ["pharmacy", "medical store", "chemist", "dispensary"],
    hospital: ["hospital", "nursing home", "health centre"],
    clinic: ["clinic", "polyclinic", "diagnostic centre"],
    doctor: ["doctor", "physician"],
    dental: ["dental clinic", "dentist"],
    eye: ["eye hospital", "eye clinic", "optician"],
    heart: ["cardiology", "heart hospital"],
    skin: ["skin clinic", "dermatologist"],
    ent: ["ent clinic", "ear nose throat"],
    all: ["hospital", "clinic", "pharmacy"]
  };
  const kws = keywordsMap[category] || ["healthcare"];

  const nomPromises = kws.map(async (kw) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(kw)}&viewbox=${viewboxNom}&bounded=1&format=json&addressdetails=1&limit=25`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "SmartMedHealthcareAssistant/1.0" },
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json)) return json;
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  // Fetch Photon
  const photonPromises = kws.map(async (kw) => {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(kw)}&lat=${lat}&lon=${lng}&limit=30`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const json: any = await resp.json();
        if (json && Array.isArray(json.features)) return json.features;
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [allNomLists, allPLists] = await Promise.all([
    Promise.all(nomPromises),
    Promise.all(photonPromises)
  ]);

  const rawElements: any[] = [];
  const facilities: HealthcareFacility[] = [];
  const seenIds = new Set<string>();

  // Ingest Nominatim
  for (const item of allNomLists.flat()) {
    const iLat = parseFloat(item.lat);
    const iLng = parseFloat(item.lon);
    if (isNaN(iLat) || isNaN(iLng)) continue;

    const distKm = calculateHaversineDistance(lat, lng, iLat, iLng);
    if (distKm > initialRadius * 1.05) continue;

    const { category: cat, label } = resolveCategory(item.tags || {}, category);
    const name = item.name || item.display_name?.split(",")[0] || label;
    const normKey = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.round(distKm * 8)}`;
    if (seenIds.has(normKey)) continue;
    seenIds.add(normKey);

    facilities.push({
      id: `nom-${item.osm_type || "N"}-${item.osm_id || Math.random().toString(36).slice(2, 8)}`,
      name,
      category: cat,
      categoryLabel: label,
      address: item.display_name || "Address in vicinity",
      distanceKm: distKm,
      distanceFormatted: formatDistance(distKm),
      lat: iLat,
      lng: iLng,
      phone: "Not available",
      website: "Not available",
      openingHours: "Not available",
      isOpenNow: null,
      emergency: item.type === "hospital" || category === "hospital",
      tags: item
    });
  }

  // Ingest Photon
  for (const feat of allPLists.flat()) {
    const coords = feat.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const fLng = coords[0];
    const fLat = coords[1];
    const p = feat.properties || {};

    const distKm = calculateHaversineDistance(lat, lng, fLat, fLng);
    if (distKm > initialRadius * 1.05) continue;

    const name = p.name || "Healthcare Facility";
    if (p.osm_value === "station" || p.osm_value === "stop" || p.osm_value === "locality" || p.osm_value === "street") {
      const lName = name.toLowerCase();
      if (!lName.includes("hospital") && !lName.includes("pharma") && !lName.includes("medic") && !lName.includes("clinic") && !lName.includes("dental") && !lName.includes("eye") && !lName.includes("doctor") && !lName.includes("care")) {
        continue;
      }
    }

    const normKey = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.round(distKm * 8)}`;
    if (seenIds.has(normKey)) continue;
    seenIds.add(normKey);

    const addrParts: string[] = [];
    if (p.housenumber && p.street) addrParts.push(`${p.housenumber} ${p.street}`);
    else if (p.street) addrParts.push(p.street);
    if (p.district || p.locality) addrParts.push(p.district || p.locality);
    if (p.city) addrParts.push(p.city);
    if (p.state) addrParts.push(p.state);
    if (p.postcode) addrParts.push(p.postcode);
    if (p.country) addrParts.push(p.country);

    const { category: cat, label } = resolveCategory(p, category);

    facilities.push({
      id: `photon-${p.osm_type || "N"}-${p.osm_id || Math.random().toString(36).slice(2, 8)}`,
      name,
      category: cat,
      categoryLabel: label,
      address: addrParts.length > 0 ? addrParts.join(", ") : "Address in vicinity",
      distanceKm: distKm,
      distanceFormatted: formatDistance(distKm),
      lat: fLat,
      lng: fLng,
      phone: "Not available",
      website: "Not available",
      openingHours: "Not available",
      isOpenNow: null,
      emergency: p.osm_value === "hospital" || category === "hospital",
      tags: p
    });
  }

  // Spatial deduplication
  const deduplicated: HealthcareFacility[] = [];
  for (const item of facilities) {
    const isDup = deduplicated.some((existing) => {
      const dist = calculateHaversineDistance(item.lat, item.lng, existing.lat, existing.lng);
      if (dist < 0.03) {
        const normA = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normB = existing.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return normA === normB || normA.includes(normB) || normB.includes(normA);
      }
      return false;
    });
    if (!isDup) {
      deduplicated.push(item);
    }
  }

  // Filter by search keyword if provided
  let filtered = deduplicated;
  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.toLowerCase().trim();
    filtered = deduplicated.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.address.toLowerCase().includes(q) ||
        (f.speciality && f.speciality.toLowerCase().includes(q)) ||
        f.categoryLabel.toLowerCase().includes(q)
    );
  }

  // Sort by distance ascending
  filtered.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    results: filtered,
    total: filtered.length,
    effectiveRadiusKm: initialRadius,
    autoExpanded: false,
    originalRadiusKm: initialRadius,
  };
}
