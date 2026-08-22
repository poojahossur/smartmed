import React, { useState, useEffect } from "react";
import { Pill, CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp, Activity, BellRing, Plus, X, Calendar, MessageSquare, PhoneCall, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { collection, onSnapshot, query, where, updateDoc, doc, getDoc, addDoc, getDocs, writeBatch } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, DoseRecord, Medicine } from "../types";
import { calculateComplianceScore, getComplianceStatus, cn } from "../lib/utils";
import GeminiAssistant from "../components/GeminiAssistant";
import DoctorReport from "../components/DoctorReport";
import { Link } from "react-router-dom";

export default function PatientDashboard({ user }: { user: UserProfile }) {
  const [dosesState, setDosesState] = useState<DoseRecord[]>([]);
  const dosesRef = React.useRef<DoseRecord[]>([]);
  const sendingRef = React.useRef<Set<string>>(new Set());
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [complianceScore, setComplianceScore] = useState(0);
  const [today, setToday] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [loading, setLoading] = useState(true);
    const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [medicineToRemove, setMedicineToRemove] = useState<Medicine | null>(null);

  useEffect(() => {
    if (!user.uid) return;

    // 1. Fetch Doses (Only for today and onwards)
    const dosesCollectionRef = collection(db, "users", user.uid, "doses");
    const tomorrowForQuery = new Date(today);
    tomorrowForQuery.setDate(tomorrowForQuery.getDate() + 1);
    const qDoses = query(dosesCollectionRef, where("scheduledTime", ">=", today.toISOString()), where("scheduledTime", "<", tomorrowForQuery.toISOString()));

    const unsubscribeDoses = onSnapshot(qDoses, (snapshot) => {
      const dosesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DoseRecord[];
      
      // Sort by scheduled time
      dosesData.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
      
      // Filter out duplicates and deleted doses in UI
      const seen = new Set();
      const uniqueDoses = dosesData.filter(dose => {
        if (dose.status === 'deleted') return false;
        const key = `${dose.medicineId}-${dose.scheduledTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      dosesRef.current = uniqueDoses;
      setDosesState(uniqueDoses);
      setComplianceScore(calculateComplianceScore(uniqueDoses));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/doses`);
    });

    // 2. Listen for Medicines to trigger dose generation and update state
    const medsRef = collection(db, "users", user.uid, "medicines");
    const unsubscribeMeds = onSnapshot(medsRef, (snapshot) => {
      const medsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Medicine[];
      setMedicines(medsData);
      
      // If no medicines exist and we haven't checked yet, prompt the user
      ensureDosesGenerated();
    });

    // 4. Reminder Engine: Check every 30 seconds for doses that are due and day change
    const reminderInterval = setInterval(() => {
      const now = new Date();
      
      // Check if day has changed to refresh dashboard
      const currentDay = new Date(now);
      currentDay.setHours(0, 0, 0, 0);
      if (currentDay.getTime() !== today.getTime()) {
        setToday(currentDay);
        ensureDosesGenerated();
      }

      dosesRef.current.forEach(async (dose) => {
        const scheduled = new Date(dose.scheduledTime);
        
        // If dose is pending, not sent yet, and scheduled time is now or in the past (within last 2 hours)
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        
        if (dose.status === 'pending' && !dose.reminderSent && scheduled <= now && scheduled > twoHoursAgo && !sendingRef.current.has(dose.id)) {
          const message = `Reminder: Time to take your ${dose.medicineName}.`;
          const type = user.reminderPreference || 'SMS';
          
          console.log(`Triggering real ${type} reminder for ${dose.medicineName} at ${dose.scheduledTime}`);
          
          try {
            sendingRef.current.add(dose.id);
            // 1. Mark as sent in Firestore first to prevent double-triggering
            const doseDocRef = doc(db, "users", user.uid, "doses", dose.id);
            await updateDoc(doseDocRef, { reminderSent: true });

            // 2. Trigger Twilio API
            const response = await fetch('/api/reminders/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type,
                recipient: user.phoneNumber,
                message,
                userId: user.uid,
                doseId: dose.id,
                medicineName: dose.medicineName
              })
            });
            
            const result = await response.json();
            console.log("Reminder API result:", result);

            // 3. Log the communication
            await addDoc(collection(db, "users", user.uid, "logs"), {
              timestamp: new Date().toISOString(),
              type,
              recipient: user.phoneNumber,
              message,
              status: result.status === 'Sent' ? 'Sent' : 'Failed'
            });

            // 4. Trigger local UI notification
            window.dispatchEvent(new CustomEvent('medicine-reminder', {
              detail: { type, message }
            }));
          } catch (err) {
            console.error("Reminder engine error:", err);
          }
        }

        // Escalation Logic: If 30 mins have passed since scheduled time and still pending
        const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
        if (dose.status === 'pending' && dose.reminderSent && scheduled <= thirtyMinsAgo && !sendingRef.current.has(`${dose.id}_escalated`)) {
          console.log(`[Escalation] Dose ${dose.id} (${dose.medicineName}) overdue by 30 mins. Notifying caregiver.`);
          sendingRef.current.add(`${dose.id}_escalated`);
          
          // Mark as missed - this also triggers the caregiver alert via handleStatusChange
          handleStatusChange(dose.id, 'missed');
        }
      });
    }, 30000);

    return () => {
      unsubscribeDoses();
      unsubscribeMeds();
      clearInterval(reminderInterval);
    };
  }, [user.uid, today]);

  const ensureDosesGenerated = async () => {
    try {
      const medsRef = collection(db, "users", user.uid, "medicines");
      const medsSnap = await getDocs(medsRef);
      const medicines = medsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Medicine[];
      
      const dosesCollectionRef = collection(db, "users", user.uid, "doses");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch all today's doses in one query
      const q = query(dosesCollectionRef, where("scheduledTime", ">=", today.toISOString()), where("scheduledTime", "<", tomorrow.toISOString()));
      const existingDosesSnap = await getDocs(q);
      const existingDoses = existingDosesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as DoseRecord[];
      
      const batch = writeBatch(db);
      let added = false;

      for (const med of medicines) {
        if (med.status !== 'active') continue;

        for (const time of med.times) {
          const scheduledTime = new Date(today);
          const [hours, minutes] = time.split(':');
          scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          const scheduledIso = scheduledTime.toISOString();
          
          // Check if a dose for this medicine at this time already exists
          const alreadyExists = existingDoses.some(d => d.medicineId === med.id && d.scheduledTime === scheduledIso);
          
          if (!alreadyExists) {
            // Use a deterministic ID to prevent duplicates: medId_YYYY-MM-DD_HH-mm
            const dateStr = scheduledIso.split('T')[0];
            const timeStr = time.replace(':', '-');
            const deterministicId = `${med.id}_${dateStr}_${timeStr}`;
            
            const doseDocRef = doc(db, "users", user.uid, "doses", deterministicId);
            batch.set(doseDocRef, {
              medicineId: med.id,
              medicineName: med.name,
              scheduledTime: scheduledIso,
              status: 'pending',
              escalationLevel: 1,
              reminderSent: false
            });
            added = true;
          }
        }
      }

      if (added) await batch.commit();
    } catch (error) {
      console.error("Error generating doses:", error);
    }
  };

  const requestDeleteMedicine = (medId: string) => {
    const medicine = medicines.find(m => m.id === medId);
    if (!medicine) return;
    setMedicineToRemove(medicine);
  };

  const handleDeleteMedicine = async (medId: string) => {
    const medicine = medicines.find(m => m.id === medId);
    if (!medicine) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Delete the medicine document
      const medDocRef = doc(db, "users", user.uid, "medicines", medId);
      batch.delete(medDocRef);

      // 2. Mark all doses for this medicine from today onwards as deleted
      const dosesRef = collection(db, "users", user.uid, "doses");
      const q = query(dosesRef, where("medicineId", "==", medId));
      const dosesSnap = await getDocs(q);
      
      const todayIso = today.toISOString();
      dosesSnap.docs.forEach(d => {
        const data = d.data();
        if (data.scheduledTime >= todayIso) {
          batch.update(d.ref, { status: 'deleted' });
        }
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/medicines/${medId}`);
    }
  };

  const handleStatusChange = async (id: string, status: 'taken' | 'missed') => {
    try {
      const dose = dosesRef.current.find(d => d.id === id);
      const doseRef = doc(db, "users", user.uid, "doses", id);
      await updateDoc(doseRef, {
        status,
        takenTime: status === 'taken' ? new Date().toISOString() : null
      });

      if (status === 'missed' && dose) {
        console.log(`[Dashboard] Notifying caregiver for missed dose: ${dose.medicineName}`);
        fetch('/api/notify-caregiver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            medicineName: dose.medicineName
          })
        }).catch(err => console.error("Failed to notify caregiver:", err));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/doses/${id}`);
    }
  };

  const handleDeleteDose = async (id: string) => {
    try {
      const doseRef = doc(db, "users", user.uid, "doses", id);
      await updateDoc(doseRef, { status: 'deleted' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/doses/${id}`);
    }
  };

  const handleManualAlert = async () => {
    try {
      setIsSendingAlert(true);
      console.log(`[Dashboard] Manually notifying caregiver`);
      const response = await fetch('/api/notify-caregiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          medicineName: "Emergency Assistance Needed"
        })
      });
      const result = await response.json();
      if (result.success) {
        alert("Emergency alert sent to your caregiver!");
      } else {
        alert("Failed to send alert. Please try again.");
      }
    } catch (err) {
      console.error("Failed to notify caregiver:", err);
      alert("Error sending alert. Check your network.");
    } finally {
      setIsSendingAlert(false);
    }
  };

  const downloadTodayReport = () => {
    const rows = dosesState.map(d => `<tr><td>${d.medicineName}</td><td>${new Date(d.scheduledTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td><td>${d.status}</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=800,height=700');
    if (!w) return;
    w.document.write(`<html><head><title>SmartMed Today's Medication Report</title><style>body{font-family:Arial;padding:32px;color:#172033}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ddd;text-align:left}th{background:#eef3f5}.score{font-size:32px;font-weight:800}</style></head><body><h1>SmartMed — Today's Medication Report</h1><p>Patient: ${user.displayName}</p><p class="score">Adherence: ${complianceScore}%</p><p>Scheduled: ${dosesState.length} &nbsp; Taken: ${dosesState.filter(d=>d.status==='taken').length} &nbsp; Missed: ${dosesState.filter(d=>d.status==='missed').length} &nbsp; Pending: ${dosesState.filter(d=>d.status==='pending').length}</p><table><tr><th>Medicine</th><th>Time</th><th>Status</th></tr>${rows}</table><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const status = getComplianceStatus(complianceScore);
  const activeReminders = dosesState.filter(d => d.status === 'pending' && d.reminderSent);

  const chartData = [
    { name: 'Mon', score: 85 },
    { name: 'Tue', score: 90 },
    { name: 'Wed', score: 75 },
    { name: 'Thu', score: 88 },
    { name: 'Fri', score: 92 },
    { name: 'Sat', score: 80 },
    { name: 'Sun', score: complianceScore },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <header className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-1">
          <h1 className="text-3xl font-black text-slate-50 tracking-tight">Welcome back, {user.displayName}</h1>
          <p className="text-slate-600 text-sm">Here's your medicine schedule and compliance overview for today.</p>
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <Link to="/medication-center" className="px-6 py-3.5 bg-gradient-to-r from-teal-600 to-sky-600 text-white rounded-2xl font-black shadow-lg shadow-teal-500/25 transition-all btn-3d flex items-center gap-2">
            <Plus size={20} /> Manage Medicines
          </Link>
          <div className="flex items-center gap-3 p-3 glass-card bg-slate-900/85 rounded-2xl shadow-md border border-white/60">
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-inner", status.bg)}>
              <Activity className={status.color} size={22} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Compliance</p>
              <p className={cn("text-xl font-black", status.color)}>{complianceScore}%</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[['Today',dosesState.length,'text-sky-300'],['Taken',dosesState.filter(d=>d.status==='taken').length,'text-emerald-300'],['Missed',dosesState.filter(d=>d.status==='missed').length,'text-rose-300'],['Pending',dosesState.filter(d=>d.status==='pending').length,'text-amber-300']].map(([label,value,color])=><div key={String(label)} className="glass-card rounded-2xl p-5 border border-white/10"><p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p><p className={`text-3xl font-black mt-1 ${color}`}>{value}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/medication-center" className="px-4 py-3 rounded-2xl bg-teal-600 text-white font-black btn-3d"><Plus size={17} className="inline mr-2"/>Add / Schedule Medicine</Link>
        <button onClick={downloadTodayReport} className="px-4 py-3 rounded-2xl bg-slate-800 text-white font-black btn-3d"><FileText size={17} className="inline mr-2"/>Download Today PDF</button>
        <button onClick={handleManualAlert} disabled={isSendingAlert} className="px-4 py-3 rounded-2xl bg-rose-600 text-white font-black btn-3d"><AlertTriangle size={17} className="inline mr-2"/>{isSendingAlert?'Sending SOS...':'SOS / Caregiver Alert'}</button>
      </div>

      <AnimatePresence>
        {activeReminders.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-5 glass-card bg-orange-950/40 border-orange-700/60 rounded-3xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30 animate-pulse">
                <PhoneCall size={22} />
              </div>
              <div>
                <p className="text-sm font-black text-orange-100">Active Reminder Session</p>
                <p className="text-xs text-orange-300">We are currently reminding you about: {activeReminders.map(r => r.medicineName).join(', ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest animate-pulse bg-slate-900/80 px-3 py-1.5 rounded-full border border-orange-700/60">Call In Progress / Scheduled Repeat</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Medicine Timeline */}
        <div className="lg:col-span-2 space-y-7">
          {/* Manage Medicines */}
          <div className="glass-panel p-7 md:p-8 rounded-3xl shadow-xl space-y-6">
            <h2 className="text-xl font-black text-slate-50 flex items-center gap-2.5">
              <Pill className="text-teal-600" size={24} />
              My Medicines & Schedule Management
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {medicines.length > 0 ? medicines.map((med) => (
                <div key={med.id} className="p-4 glass-card bg-slate-900/80 rounded-2xl flex items-center justify-between group glass-card-hover">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-950/40 text-teal-600 flex items-center justify-center shadow-inner">
                      <Pill size={22} />
                    </div>
                    <div>
                      <p className="font-black text-slate-50 text-sm">{med.name}</p>
                      <p className="text-[11px] text-slate-500 font-semibold">{med.dosage} • {med.frequency}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => requestDeleteMedicine(med.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-950/40 rounded-xl transition-all"
                    title="Delete Medicine"
                  >
                    <X size={18} />
                  </button>
                </div>
              )) : (
                <div className="col-span-2 text-center py-6 text-slate-500 text-sm font-medium">
                  No medicines added yet.
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-7 md:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-slate-50 flex items-center gap-2.5">
                <Clock className="text-teal-600" size={24} />
                Today's Schedule
              </h2>
              <span className="text-xs text-slate-600 font-black bg-slate-900/85 px-4 py-2 rounded-full border border-slate-700/70/80 shadow-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <div className="space-y-4">
              {dosesState.length > 0 ? dosesState.map((dose, index) => (
                <motion.div 
                  key={dose.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={cn(
                    "p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all glass-card glass-card-hover",
                    dose.status === 'taken' ? "bg-emerald-950/40 border-emerald-700/60" : 
                    dose.status === 'missed' ? "bg-rose-950/40 border-rose-700/60" : "bg-slate-900/80 border-white/80"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-13 h-13 rounded-2xl flex items-center justify-center shadow-md",
                      dose.status === 'taken' ? "bg-emerald-500 text-white shadow-emerald-500/25" : 
                      dose.status === 'missed' ? "bg-rose-500 text-white shadow-rose-500/25" : "bg-teal-600 text-white shadow-teal-500/25"
                    )}>
                      <Pill size={26} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-black text-base text-slate-50">{dose.medicineName}</h3>
            <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <Clock size={13} /> {new Date(dose.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button 
            onClick={() => handleDeleteDose(dose.id)}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-950/40 rounded-xl transition-all"
            title="Remove from today's schedule"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {dose.status === 'pending' ? (
          <>
            <button 
              onClick={() => handleStatusChange(dose.id, 'taken')}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-500/25 btn-3d"
            >
              <CheckCircle2 size={16} /> Take
            </button>
            <button 
              onClick={() => handleStatusChange(dose.id, 'missed')}
              className="px-5 py-2.5 bg-slate-900 text-rose-600 border border-rose-700/60 rounded-xl text-xs font-black hover:bg-rose-950/40 transition-all flex items-center gap-2 shadow-sm"
            >
              <XCircle size={16} /> Miss
            </button>
          </>
        ) : (
          <div className={cn(
            "px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm",
            dose.status === 'taken' ? "text-emerald-300 bg-emerald-900/45 border border-emerald-700/60" : "text-rose-300 bg-rose-900/45 border border-rose-700/60"
          )}>
            {dose.status === 'taken' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {dose.status === 'taken' ? 'Taken' : 'Missed'}
          </div>
        )}
      </div>
    </motion.div>
  )) : (
    <div className="text-center py-12 glass-card bg-slate-900/50 rounded-2xl border border-dashed border-slate-600">
      <Pill className="mx-auto text-slate-600 mb-3" size={44} />
      <p className="text-slate-600 font-bold text-sm">No medicines scheduled for today.</p>
      <Link to="/medication-center" className="mt-3 inline-block text-teal-300 text-xs font-black hover:underline">+ Add your first medicine</Link>
    </div>
  )}
</div>
</div>

{/* Reminder Status */}
<div className="glass-panel p-7 md:p-8 rounded-3xl shadow-xl space-y-6">
 <h2 className="text-xl font-black text-slate-50 flex items-center justify-between gap-2">
   <div className="flex items-center gap-2.5">
     <BellRing className="text-amber-500" size={24} />
     Smart Reminder Settings
   </div>
 </h2>
 <div className="grid sm:grid-cols-2 gap-5">
   <div className="p-6 rounded-2xl glass-card bg-teal-950/40 border-teal-700/60 relative overflow-hidden shadow-sm">
     <div className="absolute top-0 right-0 p-4 opacity-10">
       {user.reminderPreference === 'CALL' ? <PhoneCall size={64} /> : <MessageSquare size={64} />}
     </div>
     <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2">Active Preference</p>
     <div className="flex items-center gap-3 mb-2">
       {user.reminderPreference === 'CALL' ? <PhoneCall className="text-teal-600" size={24} /> : <MessageSquare className="text-teal-600" size={24} />}
       <p className="text-xl font-black text-teal-200">{user.reminderPreference || 'SMS'} Reminders</p>
     </div>
     <p className="text-xs text-teal-300 font-medium">Reminders will be sent to <strong>{user.phoneNumber}</strong></p>
   </div>
   <div className="p-6 rounded-2xl glass-card bg-amber-950/40 border-amber-700/60 shadow-sm">
     <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Escalation Policy</p>
     <p className="text-xl font-black text-amber-100">Multi-Level Alerts</p>
     <p className="text-xs text-amber-300 font-medium mt-1">If ignored for 30 mins, we notify <strong>{user.emergencyContact?.name}</strong>.</p>
   </div>
 </div>
</div>

        </div>

        {/* Sidebar Stats */}
        <div className="space-y-7">
          <div className="glass-panel p-7 md:p-8 rounded-3xl shadow-xl space-y-6">
            <h2 className="text-xl font-black text-slate-50 flex items-center gap-2.5">
              <TrendingUp className="text-teal-600" size={24} />
              Weekly Progress
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)', color: '#e2e8f0' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card bg-gradient-to-br from-rose-950/40 to-red-950/30 p-7 md:p-8 rounded-3xl border-rose-700/60 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AlertTriangle size={80} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/30">
                <AlertTriangle size={22} />
              </div>
              <h2 className="text-lg font-black text-rose-100">Emergency Alert</h2>
            </div>
            <p className="text-xs text-rose-300 leading-relaxed mb-6 font-medium">
              If you miss 3 consecutive doses, an emergency alert will be sent to your caregiver and primary physician.
            </p>
            <button 
              onClick={handleManualAlert}
              disabled={isSendingAlert}
              className={cn(
                "w-full py-3.5 text-white rounded-2xl text-xs font-black transition-all shadow-lg btn-3d",
                isSendingAlert ? "bg-slate-500 cursor-not-allowed" : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25"
              )}
            >
              {isSendingAlert ? "Sending SOS..." : "Send SOS to Caregiver"}
            </button>
          </div>
        </div>
      </div>

      <DoctorReport user={user} />

      <AnimatePresence>
        {medicineToRemove && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="remove-medicine-title">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-red-500/10 p-3"><AlertTriangle className="text-red-300" size={22}/></div>
                <div><h3 id="remove-medicine-title" className="text-lg font-black text-white">Remove medicine?</h3><p className="mt-1 text-sm text-slate-400">Please verify before removing <span className="font-bold text-slate-200">{medicineToRemove.name}</span> and its remaining schedule.</p></div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setMedicineToRemove(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 font-bold text-slate-300 hover:bg-slate-800">Cancel</button>
                <button type="button" onClick={async () => { const id = medicineToRemove.id; setMedicineToRemove(null); await handleDeleteMedicine(id); }} className="rounded-xl bg-red-600 px-4 py-2.5 font-black text-white hover:bg-red-500">Remove Medicine</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GeminiAssistant />
    </div>
  );
}
