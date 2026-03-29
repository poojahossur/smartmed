import React, { useState } from "react";
import { ShieldCheck, Search, Pill, AlertTriangle, Info, CheckCircle2, XCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { UserProfile } from "../types";
import { cn } from "../lib/utils";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function SubstitutionEngine({ user }: { user: UserProfile }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    alternatives: string[];
    safetyNote: string;
    riskLevel: 'Low' | 'Medium' | 'High';
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    setLoading(true);
    try {
      const prompt = `As a medical assistant, suggest safe alternatives for the medicine: "${search}".
      Consider the patient's profile:
      - Age: ${user.age}
      - Allergies: ${user.allergies.join(", ") || "None"}
      - Chronic Conditions: ${user.chronicConditions?.join(", ") || "None"}
      
      Provide the response in JSON format with:
      - alternatives: string[]
      - safetyNote: string (explaining why these are safe or what to watch out for)
      - riskLevel: "Low" | "Medium" | "High" (based on patient's profile)`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const data = JSON.parse(response.text);
      setRecommendation(data);
    } catch (error) {
      console.error("Error getting recommendation:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Personalized Safe Substitution Engine</h1>
        <p className="text-slate-500">Find safe alternative medicines based on your unique health profile.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile and Search */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Info className="text-blue-600" size={20} />
              Your Health Profile
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age</p>
                <p className="font-bold text-slate-700">{user.age} years old</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Allergies</p>
                <p className="font-bold text-slate-700">{user.allergies.join(", ") || "None reported"}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chronic Conditions</p>
                <p className="font-bold text-slate-700">{user.chronicConditions?.join(", ") || "None reported"}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
              placeholder="Enter medicine name..."
            />
            {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />}
          </form>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {recommendation ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                    <XCircle size={32} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Original Medicine</p>
                    <h3 className="text-2xl font-bold text-slate-900">{search}</h3>
                  </div>
                </div>
                
                <div className="hidden md:block">
                  <ArrowRight size={32} className="text-slate-300" />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">AI Recommended Alternatives</p>
                    <h3 className="text-2xl font-bold text-slate-900">{recommendation.alternatives.join(", ")}</h3>
                  </div>
                </div>
              </div>
              
              <div className={cn(
                "mt-8 p-6 rounded-2xl border flex items-start gap-4 relative z-10",
                recommendation.riskLevel === 'Low' ? "bg-green-50 border-green-100" : 
                recommendation.riskLevel === 'Medium' ? "bg-orange-50 border-orange-100" : "bg-red-50 border-red-100"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  recommendation.riskLevel === 'Low' ? "bg-green-100 text-green-600" : 
                  recommendation.riskLevel === 'Medium' ? "bg-orange-100 text-orange-600" : "bg-red-100 text-red-600"
                )}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-900">Safety Analysis</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      recommendation.riskLevel === 'Low' ? "bg-green-200 text-green-800" : 
                      recommendation.riskLevel === 'Medium' ? "bg-orange-200 text-orange-800" : "bg-red-200 text-red-800"
                    )}>
                      {recommendation.riskLevel} Risk
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{recommendation.safetyNote}</p>
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Sparkles size={14} className="text-blue-500" /> Powered by SmartMed AI Engine
              </div>
            </motion.div>
          ) : (
            <div className="bg-white p-12 rounded-[32px] border border-slate-100 shadow-sm text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-6">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Analyze</h3>
              <p className="text-slate-500 max-w-xs mx-auto">Enter a medicine name to find safe, personalized alternatives based on your health profile.</p>
            </div>
          )}
          
          <div className="p-8 bg-blue-600 rounded-[32px] text-white shadow-xl shadow-blue-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <AlertTriangle size={24} className="text-orange-400" /> Medical Disclaimer
            </h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-4">
              The SmartMed AI Engine provides suggestions based on general medical data and your provided profile. 
              <strong> This is NOT a substitute for professional medical advice.</strong>
            </p>
            <div className="p-4 bg-blue-700/50 rounded-2xl border border-blue-500/30">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Info size={18} /> Recommendation:
              </p>
              <p className="text-sm text-blue-100 mt-1 italic">
                "Always consult with your primary healthcare provider, doctor, or pharmacist before changing your medication or starting a new treatment."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
