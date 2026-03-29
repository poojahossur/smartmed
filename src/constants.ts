import { Medicine, Pharmacy, DoseRecord } from "./types";

export const DUMMY_MEDICINES: Medicine[] = [
  {
    id: "med1",
    name: "Amlodipine",
    dosage: "5mg",
    frequency: "Daily",
    times: ["08:00"],
    instructions: "Take with water before breakfast",
    startDate: "2026-03-01",
    status: "active",
  },
  {
    id: "med2",
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice a day",
    times: ["08:00", "20:00"],
    instructions: "Take with meals",
    startDate: "2026-03-01",
    status: "active",
  },
];

export const DUMMY_PHARMACIES: Pharmacy[] = [
  {
    id: "ph1",
    name: "City Health Pharmacy",
    address: "123 Main St, Downtown",
    distance: "0.8 km",
    availability: "In Stock",
    lat: 40.7128,
    lng: -74.0060,
  },
  {
    id: "ph2",
    name: "Wellness Drugstore",
    address: "456 Oak Ave, Westside",
    distance: "1.5 km",
    availability: "Low Stock",
    lat: 40.7200,
    lng: -74.0100,
  },
];

export const DUMMY_DOSES: DoseRecord[] = [
  {
    id: "d1",
    medicineId: "med1",
    medicineName: "Amlodipine",
    scheduledTime: "2026-03-26T08:00:00Z",
    takenTime: "2026-03-26T08:05:00Z",
    status: "taken",
    escalationLevel: 1,
  },
  {
    id: "d2",
    medicineId: "med2",
    medicineName: "Metformin",
    scheduledTime: "2026-03-26T08:00:00Z",
    status: "missed",
    escalationLevel: 4,
  },
  {
    id: "d3",
    medicineId: "med2",
    medicineName: "Metformin",
    scheduledTime: "2026-03-26T20:00:00Z",
    status: "pending",
    escalationLevel: 1,
  },
];

export const SUBSTITUTION_RULES = [
  {
    original: "Aspirin",
    alternatives: ["Acetaminophen (Tylenol)", "Ibuprofen (Advil)"],
    conditions: "Avoid if allergic to NSAIDs",
  },
  {
    original: "Lisinopril",
    alternatives: ["Losartan", "Valsartan"],
    conditions: "Safe for most patients with ACE inhibitor cough",
  },
];
