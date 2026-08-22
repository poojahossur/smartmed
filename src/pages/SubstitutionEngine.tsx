import React, { useState } from "react";
import { ShieldCheck, Search, Pill, AlertTriangle, Info, CheckCircle2, XCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile } from "../types";
import { cn } from "../lib/utils";

export default function SubstitutionEngine({ user }: { user: UserProfile }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    alternatives: Array<{name:string;reason?:string;sameActiveIngredient?:boolean;sameStrength?:boolean}>;
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

      const response = await fetch('/api/ai/safer-substitution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medicineName: search, user }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not get recommendations');
      const data = payload.result;
      setRecommendation(data);
    } catch (error) {
      console.error("Error getting recommendation:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <header className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles size={14} className="text-teal-600 animate-pulse" />
            <span>AI Safety Verification</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-50 tracking-tight">Personalized Safe Substitution Engine</h1>
          <p className="text-slate-600 text-sm md:text-base">Find safe alternative medicines based on your unique health profile, allergies, and chronic conditions.</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile and Search */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 md:p-7 rounded-3xl shadow-xl space-y-5">
            <h2 className="text-lg font-black text-slate-50 flex items-center gap-2.5">
              <Info className="text-teal-600" size={20} />
              Your Health Profile
            </h2>
            <div className="space-y-3">
              <div className="p-4 glass-card bg-slate-900/80 rounded-2xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Age</p>
                <p className="font-black text-slate-100 text-sm">{user.age} years old</p>
              </div>
              <div className="p-4 glass-card bg-slate-900/80 rounded-2xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Allergies</p>
                <p className="font-black text-slate-100 text-sm">{user.allergies.join(", ") || "None reported"}</p>
              </div>
              <div className="p-4 glass-card bg-slate-900/80 rounded-2xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Chronic Conditions</p>
                <p className="font-black text-slate-100 text-sm">{user.chronicConditions?.join(", ") || "None reported"}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 glass-card bg-slate-900/85 border border-slate-700/70/90 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold transition-all shadow-md"
              placeholder="Enter medicine name..."
            />
            {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-teal-600 animate-spin" size={20} />}
          </form>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {recommendation ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-8 rounded-3xl shadow-xl overflow-hidden relative space-y-6"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-700/60 flex items-center justify-center text-rose-600 shadow-md">
                    <XCircle size={30} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Original Medicine</p>
                    <h3 className="text-2xl font-black text-slate-50">{search}</h3>
                  </div>
                </div>
                
                <div className="hidden md:block">
                  <ArrowRight size={28} className="text-slate-600" />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 flex items-center justify-center text-emerald-600 shadow-md">
                    <CheckCircle2 size={30} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Recommended Substitutes</p>
                    <h3 className="text-2xl font-black text-slate-50">{recommendation.alternatives.length ? recommendation.alternatives.map((a:any)=>a.name).join(", ") : "No verified equivalent identified"}</h3>
                  </div>
                </div>
              </div>
              
              <div className={cn(
                "p-6 rounded-2xl border flex items-start gap-4 relative z-10 glass-card shadow-sm",
                recommendation.riskLevel === 'Low' ? "bg-emerald-950/40 border-emerald-700/60" : 
                recommendation.riskLevel === 'Medium' ? "bg-amber-950/40 border-amber-700/60" : "bg-rose-950/40 border-rose-700/60"
              )}>
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                  recommendation.riskLevel === 'Low' ? "bg-emerald-500 text-white" : 
                  recommendation.riskLevel === 'Medium' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                )}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-black text-slate-50">Safety Analysis</p>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                      recommendation.riskLevel === 'Low' ? "bg-emerald-800/60 text-emerald-200" : 
                      recommendation.riskLevel === 'Medium' ? "bg-amber-800/60 text-amber-200" : "bg-rose-800/60 text-rose-200"
                    )}>
                      {recommendation.riskLevel} Risk
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{recommendation.safetyNote}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold pt-2 border-t border-slate-800">
                <Sparkles size={14} className="text-teal-500" /> Powered by SmartMed AI Engine
              </div>
            </motion.div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl shadow-xl text-center space-y-4">
              <div className="w-20 h-20 bg-teal-950/40 rounded-2xl flex items-center justify-center text-teal-600 mx-auto shadow-inner">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-50">Ready to Analyze</h3>
              <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">Enter any medicine name to find safe, personalized alternatives verified against your health profile.</p>
            </div>
          )}
          
          <div className="p-7 md:p-8 bg-gradient-to-br from-teal-600 via-teal-700 to-sky-800 rounded-3xl text-white shadow-2xl shadow-teal-500/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800/30 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <h3 className="text-xl font-black mb-2.5 flex items-center gap-2">
              <AlertTriangle size={22} className="text-amber-300" /> Medical Disclaimer
            </h3>
            <p className="text-teal-100 text-xs leading-relaxed mb-4">
              The SmartMed AI Engine provides suggestions based on general medical data and your provided profile. 
              <strong> This is NOT a substitute for professional medical advice.</strong>
            </p>
            <div className="p-4 bg-slate-800/30 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-xs font-black text-white flex items-center gap-2">
                <Info size={16} /> Recommendation:
              </p>
              <p className="text-xs text-teal-100 mt-1 italic leading-relaxed">
                "Always consult with your primary healthcare provider, doctor, or pharmacist before changing your medication or starting a new treatment."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
