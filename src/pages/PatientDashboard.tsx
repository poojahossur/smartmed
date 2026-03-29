import React, { useState, useEffect } from "react";
import { Pill, CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp, Activity, BellRing, Plus, X, Calendar, MessageSquare, PhoneCall, History } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { collection, onSnapshot, query, where, updateDoc, doc, getDoc, addDoc, serverTimestamp, getDocs, writeBatch, limit } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, DoseRecord, Medicine, CommunicationLog } from "../types";
import { calculateComplianceScore, getComplianceStatus, cn } from "../lib/utils";

export default function PatientDashboard({ user }: { user: UserProfile }) {
  const [dosesState, setDosesState] = useState<DoseRecord[]>([]);
  const dosesRef = React.useRef<DoseRecord[]>([]);
  const sendingRef = React.useRef<Set<string>>(new Set());
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [complianceScore, setComplianceScore] = useState(0);
  const [today, setToday] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [loading, setLoading] = useState(true);
  const [hasCheckedMeds, setHasCheckedMeds] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    dosage: "",
    frequency: "Daily",
    time: "08:00",
    instructions: "",
  });

  useEffect(() => {
    if (!user.uid) return;

    // 1. Fetch Doses (Only for today and onwards)
    const dosesCollectionRef = collection(db, "users", user.uid, "doses");
    const qDoses = query(dosesCollectionRef, where("scheduledTime", ">=", today.toISOString()));

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

    // 2. Fetch Communication Logs (Limit to recent)
    const logsRef = collection(db, "users", user.uid, "logs");
    const qLogs = query(logsRef, limit(10));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as CommunicationLog[];
      logsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(logsData.slice(0, 5));
    });

    // 3. Listen for Medicines to trigger dose generation and update state
    const medsRef = collection(db, "users", user.uid, "medicines");
    const unsubscribeMeds = onSnapshot(medsRef, (snapshot) => {
      const medsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Medicine[];
      setMedicines(medsData);
      
      // If no medicines exist and we haven't checked yet, prompt the user
      if (snapshot.empty && !hasCheckedMeds) {
        setShowAddModal(true);
      }
      setHasCheckedMeds(true);
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
                message
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
      });
    }, 30000);

    return () => {
      unsubscribeDoses();
      unsubscribeLogs();
      unsubscribeMeds();
      clearInterval(reminderInterval);
    };
  }, [user.uid, today, hasCheckedMeds]);

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

  const handleDeleteMedicine = async (medId: string) => {
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
      const doseRef = doc(db, "users", user.uid, "doses", id);
      await updateDoc(doseRef, {
        status,
        takenTime: status === 'taken' ? new Date().toISOString() : null
      });
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

  const triggerTestCall = async () => {
    try {
      const response = await fetch('/api/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CALL',
          phoneNumber: user.phoneNumber,
          message: `Hello ${user.displayName}, this is a test call from your Medicine Reminder system. Your system is working correctly.`
        })
      });
      const result = await response.json();
      await addDoc(collection(db, "users", user.uid, "logs"), {
        timestamp: new Date().toISOString(),
        type: 'CALL',
        recipient: user.phoneNumber,
        message: 'Test Real Call triggered by user',
        status: result.status === 'Sent' ? 'Sent' : 'Failed'
      });
      alert("Test call triggered! You should receive a call shortly.");
    } catch (err) {
      console.error("Test call failed:", err);
      alert("Failed to trigger test call. Check console for details.");
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const medRef = collection(db, "users", user.uid, "medicines");
      const medData: Partial<Medicine> = {
        name: newMed.name,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        times: [newMed.time],
        instructions: newMed.instructions,
        startDate: new Date().toISOString(),
        status: 'active'
      };
      
      await addDoc(medRef, medData);
      
      // Immediately generate doses for this new medicine
      ensureDosesGenerated();

      setShowAddModal(false);
      setNewMed({ name: "", dosage: "", frequency: "Daily", time: "08:00", instructions: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/medicines`);
    }
  };

  const status = getComplianceStatus(complianceScore);

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
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.displayName}</h1>
          <p className="text-slate-500">Here's your medicine schedule for today.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
          >
            <Plus size={20} /> Add Medicine
          </button>
          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", status.bg)}>
              <Activity className={status.color} size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Compliance</p>
              <p className={cn("text-lg font-bold", status.color)}>{complianceScore}%</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Medicine Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Manage Medicines */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Pill className="text-blue-600" size={22} />
              My Medicines & Schedule Management
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {medicines.length > 0 ? medicines.map((med) => (
                <div key={med.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm">
                      <Pill size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{med.name}</p>
                      <p className="text-[10px] text-slate-500">{med.dosage} • {med.frequency}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteMedicine(med.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete Medicine"
                  >
                    <X size={18} />
                  </button>
                </div>
              )) : (
                <div className="col-span-2 text-center py-6 text-slate-400 text-sm">
                  No medicines added yet.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="text-blue-600" size={22} />
                Today's Schedule
              </h2>
              <span className="text-sm text-slate-500 font-medium bg-slate-50 px-4 py-2 rounded-full">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <div className="space-y-4">
              {dosesState.length > 0 ? dosesState.map((dose, index) => (
                <motion.div 
                  key={dose.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all",
                    dose.status === 'taken' ? "bg-green-50 border-green-100" : 
                    dose.status === 'missed' ? "bg-red-50 border-red-100" : "bg-white border-slate-100 hover:border-blue-200"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
                      dose.status === 'taken' ? "bg-green-500 text-white" : 
                      dose.status === 'missed' ? "bg-red-500 text-white" : "bg-blue-100 text-blue-600"
                    )}>
                      <Pill size={28} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{dose.medicineName}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <Clock size={14} /> {new Date(dose.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleDeleteDose(dose.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove from today's schedule"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {dose.status === 'pending' ? (
                      <>
                        <button 
                          onClick={() => handleStatusChange(dose.id, 'taken')}
                          className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-md shadow-green-100"
                        >
                          <CheckCircle2 size={18} /> Take
                        </button>
                        <button 
                          onClick={() => handleStatusChange(dose.id, 'missed')}
                          className="px-6 py-2.5 bg-white text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <XCircle size={18} /> Miss
                        </button>
                      </>
                    ) : (
                      <div className={cn(
                        "px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2",
                        dose.status === 'taken' ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100"
                      )}>
                        {dose.status === 'taken' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        {dose.status === 'taken' ? 'Taken' : 'Missed'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Pill className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 font-medium">No medicines scheduled for today.</p>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 text-blue-600 font-bold hover:underline"
                  >
                    Add your first medicine
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reminder Status */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BellRing className="text-orange-600" size={22} />
                Smart Reminder Settings
              </div>
              <button 
                onClick={triggerTestCall}
                className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors uppercase tracking-wider"
              >
                Test Real Call
              </button>
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  {user.reminderPreference === 'CALL' ? <PhoneCall size={64} /> : <MessageSquare size={64} />}
                </div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Active Preference</p>
                <div className="flex items-center gap-3 mb-2">
                  {user.reminderPreference === 'CALL' ? <PhoneCall className="text-blue-600" size={24} /> : <MessageSquare className="text-blue-600" size={24} />}
                  <p className="text-xl font-bold text-blue-900">{user.reminderPreference || 'SMS'} Reminders</p>
                </div>
                <p className="text-sm text-blue-700">Reminders will be sent to <strong>{user.phoneNumber}</strong></p>
              </div>
              <div className="p-6 rounded-2xl bg-orange-50 border border-orange-100">
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-2">Escalation Policy</p>
                <p className="text-xl font-bold text-orange-900">Multi-Level Alerts</p>
                <p className="text-sm text-orange-700 mt-1">If ignored for 30 mins, we notify <strong>{user.emergencyContact?.name}</strong>.</p>
              </div>
            </div>
          </div>

          {/* Reminder History Log */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <History className="text-slate-600" size={22} />
              Recent Reminder History
            </h2>
            <div className="space-y-4">
              {logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
                      {log.type === 'CALL' ? <PhoneCall size={16} /> : <MessageSquare size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{log.message}</p>
                      <p className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded uppercase tracking-wider">
                    {log.status}
                  </span>
                </div>
              )) : (
                <p className="text-center py-4 text-slate-400 text-sm">No reminders sent yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={22} />
              Weekly Progress
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-red-50 p-8 rounded-[32px] border border-red-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AlertTriangle size={80} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-lg font-bold text-red-900">Emergency Alert</h2>
            </div>
            <p className="text-sm text-red-700 leading-relaxed mb-6">
              If you miss 3 consecutive doses, an emergency alert will be sent to your caregiver and primary physician.
            </p>
            <button className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
              Trigger Manual Alert
            </button>
          </div>
        </div>
      </div>

      {/* Add Medicine Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Add New Medicine</h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleAddMedicine} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Medicine Name</label>
                    <div className="relative">
                      <Pill className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="text" 
                        required
                        value={newMed.name}
                        onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="e.g. Metformin"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Dosage</label>
                      <input 
                        type="text" 
                        required
                        value={newMed.dosage}
                        onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="e.g. 500mg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Time</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                          type="time" 
                          required
                          value={newMed.time}
                          onChange={(e) => setNewMed({...newMed, time: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Frequency</label>
                    <select 
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({...newMed, frequency: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      <option>Daily</option>
                      <option>Twice a day</option>
                      <option>Three times a day</option>
                      <option>Weekly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Instructions</label>
                    <textarea 
                      value={newMed.instructions}
                      onChange={(e) => setNewMed({...newMed, instructions: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all h-24 resize-none"
                      placeholder="e.g. Take after meal"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Schedule Medicine
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
