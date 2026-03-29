import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function searchPharmacies(medicineName: string, lat: number, lng: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find real pharmacies near latitude ${lat}, longitude ${lng} that might stock "${medicineName}". 
      Correct any spelling errors in the medicine name if necessary.
      Return a list of pharmacies with their name, address, approximate distance, and a simulated availability status.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    });

    // Extract grounding chunks
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      return chunks.map((chunk: any, index: number) => ({
        id: `real-${index}`,
        name: chunk.maps?.title || "Pharmacy",
        address: chunk.maps?.uri || "Nearby",
        distance: "Nearby",
        availability: Math.random() > 0.3 ? "In Stock" : "Low Stock",
        lat: lat + (Math.random() - 0.5) * 0.01,
        lng: lng + (Math.random() - 0.5) * 0.01,
        mapsUrl: chunk.maps?.uri
      }));
    }
    return [];
  } catch (error) {
    console.error("Error searching pharmacies:", error);
    return [];
  }
}

export async function getMedicineAlternatives(medicineName: string, userProfile: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest safe alternative medicines for "${medicineName}" for a patient with the following profile:
      Age: ${userProfile.age}
      Allergies: ${userProfile.allergies?.join(", ") || "None"}
      Chronic Conditions: ${userProfile.chronicConditions?.join(", ") || "None"}
      
      Provide a risk level (Low/Medium/High) and a safety note for each.
      Include a medical disclaimer.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error getting alternatives:", error);
    return [];
  }
}
