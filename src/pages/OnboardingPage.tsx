import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile } from "../types";
import { motion } from "motion/react";
import { Pill, Phone, User, Heart, AlertCircle, ArrowRight, MessageSquare, PhoneCall } from "lucide-react";

interface OnboardingPageProps {
  user: UserProfile;
  onComplete: (updatedUser: UserProfile) => void;
}

export default function OnboardingPage({ user, onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(1);
  const [age, setAge] = useState(user.age || 30);
  const [phone, setPhone] = useState(user.phoneNumber || "");
  const [reminderPref, setReminderPref] = useState<'SMS' | 'CALL' | 'BOTH'>(user.reminderPreference || 'SMS');
  const [allergies, setAllergies] = useState(user.allergies.join(", "));
  const [chronicConditions, setChronicConditions] = useState(user.chronicConditions?.join(", ") || "");
  const [emergencyName, setEmergencyName] = useState(user.emergencyContact?.name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(user.emergencyContact?.phone || "");
  const [emergencyRel, setEmergencyRel] = useState(user.emergencyContact?.relationship || "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleComplete = async () => {
    setLoading(true);
    try {
      const updatedData: Partial<UserProfile> = {
        age: Number(age),
        phoneNumber: phone,
        reminderPreference: reminderPref,
        allergies: allergies.split(",").map(s => s.trim()).filter(s => s !== ""),
        chronicConditions: chronicConditions.split(",").map(s => s.trim()).filter(s => s !== ""),
        emergencyContact: {
          name: emergencyName,
          phone: emergencyPhone,
          relationship: emergencyRel,
        },
        isOnboarded: true,
      };

      await updateDoc(doc(db, "users", user.uid), updatedData);
      onComplete({ ...user, ...updatedData });
      navigate("/dashboard");
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[32px] shadow-2xl shadow-slate-200 overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Pill className="text-blue-600" size={24} />
              <span className="text-xl font-bold tracking-tight">SmartMed</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={`h-1.5 w-8 rounded-full transition-all ${i <= step ? 'bg-blue-600' : 'bg-slate-100'}`}
                />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Personal Details</h2>
                <p className="text-slate-500">Let's start with some basic information to personalize your care.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Your Age</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="number" 
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (for reminders)</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">How would you like to be reminded?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setReminderPref('SMS')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${reminderPref === 'SMS' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                    >
                      <MessageSquare size={24} />
                      <span className="text-xs font-bold uppercase tracking-wider">SMS</span>
                    </button>
                    <button 
                      onClick={() => setReminderPref('CALL')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${reminderPref === 'CALL' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                    >
                      <PhoneCall size={24} />
                      <span className="text-xs font-bold uppercase tracking-wider">Call</span>
                    </button>
                    <button 
                      onClick={() => setReminderPref('BOTH')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${reminderPref === 'BOTH' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                    >
                      <div className="flex gap-1">
                        <MessageSquare size={16} />
                        <PhoneCall size={16} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Both</span>
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={nextStep}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={20} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Medical History</h2>
                <p className="text-slate-500">This helps us provide safer medicine recommendations.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Allergies (comma separated)</label>
                  <div className="relative">
                    <AlertCircle className="absolute left-4 top-4 text-slate-400" size={20} />
                    <textarea 
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Peanuts, Latex"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chronic Conditions (comma separated)</label>
                  <div className="relative">
                    <Heart className="absolute left-4 top-4 text-slate-400" size={20} />
                    <textarea 
                      value={chronicConditions}
                      onChange={(e) => setChronicConditions(e.target.value)}
                      placeholder="e.g. Diabetes, Hypertension, Asthma"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={prevStep}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={nextStep}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Emergency Contact</h2>
                <p className="text-slate-500">Who should we contact if you miss multiple doses?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                  <input 
                    type="text" 
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
                  <input 
                    type="tel" 
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
                  <input 
                    type="text" 
                    value={emergencyRel}
                    onChange={(e) => setEmergencyRel(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Spouse, Child, Friend"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={prevStep}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Complete Setup"} <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
