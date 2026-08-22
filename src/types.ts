export type UserRole = 'patient';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  role: UserRole;
  allergies: string[];
  age: number;
  currentMedications: string[];
  isOnboarded?: boolean;
  reminderPreference?: 'SMS' | 'CALL' | 'BOTH';
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string; // e.g., 'Daily', 'Twice a day'
  times: string[]; // e.g., ['08:00', '20:00']
  instructions: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'discontinued';
}

export interface DoseRecord {
  id: string;
  medicineId: string;
  medicineName: string;
  scheduledTime: string;
  takenTime?: string;
  status: 'taken' | 'missed' | 'pending' | 'deleted';
  escalationLevel: number; // 1-5
  reminderSent?: boolean;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distance: string;
  availability: 'In Stock' | 'Low Stock' | 'Out of Stock';
  lat: number;
  lng: number;
}

export type HealthcareCategory = 
  | 'pharmacy'
  | 'hospital'
  | 'clinic'
  | 'doctor'
  | 'dental'
  | 'eye'
  | 'heart'
  | 'skin'
  | 'ent'
  | 'all';

export interface HealthcareFacility {
  id: string;
  name: string;
  category: HealthcareCategory;
  categoryLabel: string;
  address: string;
  distanceKm: number;
  distanceFormatted: string;
  lat: number;
  lng: number;
  phone: string; // "Not available" if missing
  website: string; // "Not available" if missing
  openingHours: string; // "Not available" if missing
  closingHours?: string;
  daysAvailable?: string;
  isOpenNow: boolean | null; // true if open, false if closed, null if unknown
  speciality?: string;
  operator?: string;
  emergency?: boolean;
  wheelchair?: string;
  tags?: Record<string, string>;
}

export interface HealthcareSearchResponse {
  results: HealthcareFacility[];
  total: number;
  effectiveRadiusKm: number;
  autoExpanded: boolean;
  originalRadiusKm: number;
}

export interface GeocodedLocation {
  name: string;
  lat: number;
  lng: number;
  displayName: string;
}


export interface CommunicationLog {
  id: string;
  timestamp: string;
  type: 'SMS' | 'CALL' | 'APP';
  recipient: string;
  message: string;
  status: string;
}
