import { searchNearbyHealthcare } from "./healthcareService";

/**
 * Searches real healthcare facilities and pharmacies near coordinates.
 * This service is browser-safe: Gemini is called through the server.
 */
export async function searchPharmacies(searchTerm: string, lat: number, lng: number) {
  try {
    return await searchNearbyHealthcare({
      lat,
      lng,
      radiusKm: 25,
      category: "pharmacy",
      searchTerm,
    });
  } catch (error) {
    console.error("Error searching pharmacies:", error);
    return [];
  }
}

/**
 * Requests conservative medicine-substitution information from the server.
 * The Gemini API key never reaches the browser.
 */
export async function getMedicineAlternatives(medicineName: string, userProfile: any) {
  try {
    const response = await fetch("/api/ai/safer-substitution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicineName, user: userProfile }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Substitution analysis failed");
    return data.result;
  } catch (error) {
    console.error("Error getting alternatives:", error);
    return {
      alternatives: [],
      safetyNote: "Unable to complete the safety review. Please consult a pharmacist or doctor.",
      riskLevel: "High",
    };
  }
}
