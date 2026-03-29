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

export interface CommunicationLog {
  id: string;
  timestamp: string;
  type: 'SMS' | 'CALL' | 'APP';
  recipient: string;
  message: string;
  status: string;
}
