import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateComplianceScore(doses: { status: string }[]) {
  if (doses.length === 0) return 100;
  const taken = doses.filter(d => d.status === 'taken').length;
  return Math.round((taken / doses.length) * 100);
}

export function getComplianceStatus(score: number) {
  if (score >= 85) return { label: 'Good', color: 'text-green-600', bg: 'bg-green-100' };
  if (score >= 60) return { label: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  return { label: 'Risky', color: 'text-red-600', bg: 'bg-red-100' };
}
