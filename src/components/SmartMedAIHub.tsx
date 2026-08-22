import React, { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Pill, RefreshCw, ScanLine, Sparkles, X } from "lucide-react";

type RxItem = {
  medicineName: string;
  strength: string;
  dose: string;
  frequency: string;
  times: string[];
  foodInstruction: string;
  durationDays: number | null;
  instructions: string;
  confidence: number;
  uncertainFields?: string[];
};

type Frequency = "Once a day" | "Twice a day" | "Three times a day";

const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const timesForFrequency = (frequency: string): string[] => {
  const f = frequency.toLowerCase();
  if (f.includes("three") || /\b3\b/.test(f)) return ["08:00", "14:00", "20:00"];
  if (f.includes("twice") || f.includes("two") || /\b2\b/.test(f)) return ["08:00", "20:00"];
  return ["08:00"];
};

const normalizeTimes = (times: string[] | undefined, frequency: string) => {
  const valid = (times || []).filter(t => /^\d{2}:\d{2}$/.test(t));
  const expected = timesForFrequency(frequency).length;
  return valid.length === expected ? valid : timesForFrequency(frequency);
};

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.includes("application/json")) {
    throw new Error(
      response.status === 404
        ? "AI service route was not found. Restart the SmartMed server and try again."
        : `AI service returned an unexpected response (${response.status}). Please restart the server and try again.`
    );
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The AI service returned invalid data. Please try again.");
  }
  if (!response.ok) throw new Error(data?.error || "AI request failed.");
  return data;
}

export default function SmartMedAIHub({ user }: { user: UserProfile }) {
  const [active, setActive] = useState<"manual" | "prescription" | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [rx, setRx] = useState<RxItem[]>([]);
  const [camera, setCamera] = useState(false);
  const [autoScheduled, setAutoScheduled] = useState(false);
  const [manual, setManual] = useState({ name: "", dosage: "", frequency: "Once a day" as Frequency, times: ["08:00"], instructions: "", durationDays: 30 });
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => stream.current?.getTracks().forEach(t => t.stop()), []);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => undefined);
    }
  }, [camera]);

  const reset = () => {
    setImage(null);
    setRx([]);
    setMsg("");
    setAutoScheduled(false);
  };

  const takePhoto = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      setCamera(true);
    } catch {
      setMsg("Camera permission was denied or unavailable. You can upload a photo instead.");
    }
  };

  const capture = () => {
    const videoEl = video.current;
    if (!videoEl || !videoEl.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext("2d")?.drawImage(videoEl, 0, 0);
    setImage(canvas.toDataURL("image/jpeg", 0.82));
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    setCamera(false);
  };

  const upload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Please select an image file.");
      return;
    }
    toDataUrl(file).then(setImage).catch(() => setMsg("Could not read the image."));
  };

  const editRx = (index: number, key: keyof RxItem, value: any) => {
    setRx(items => items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const createDosesForMedicine = async (medicineId: string, name: string, times: string[], frequency: string, durationDays: number | null) => {
    const normalized = normalizeTimes(times, frequency);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.min(durationDays ?? 1, 365));
    const dosesRef = collection(db, "users", user.uid, "doses");
    const existing = await getDocs(query(dosesRef, where("medicineId", "==", medicineId)));
    const existingKeys = new Set(existing.docs.map(d => d.data().scheduledTime));
    let batch = writeBatch(db);
    let writes = 0;

    const commit = async () => {
      if (!writes) return;
      await batch.commit();
      batch = writeBatch(db);
      writes = 0;
    };

    for (let day = 0; day < days; day++) {
      for (const time of normalized) {
        const [hours, minutes] = time.split(":").map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) continue;
        const scheduled = new Date(start);
        scheduled.setDate(start.getDate() + day);
        scheduled.setHours(hours, minutes, 0, 0);
        const iso = scheduled.toISOString();
        if (existingKeys.has(iso)) continue;
        batch.set(doc(dosesRef), {
          medicineId,
          medicineName: name,
          scheduledTime: iso,
          status: "pending",
          escalationLevel: 1,
          reminderSent: false
        });
        existingKeys.add(iso);
        writes++;
        if (writes >= 450) await commit();
      }
    }
    await commit();
  };

  const scheduleItems = async (items: RxItem[]) => {
    for (const item of items) {
      const times = normalizeTimes(item.times, item.frequency);
      const medicineRef = await addDoc(collection(db, "users", user.uid, "medicines"), {
        name: item.medicineName.trim(),
        dosage: [item.strength, item.dose].filter(Boolean).join(" • "),
        frequency: item.frequency,
        times,
        instructions: [item.foodInstruction, item.instructions].filter(Boolean).join(" • "),
        startDate: new Date().toISOString(),
        endDate: item.durationDays ? new Date(Date.now() + item.durationDays * 86400000).toISOString() : undefined,
        status: "active"
      });
      await createDosesForMedicine(medicineRef.id, item.medicineName.trim(), times, item.frequency, item.durationDays);
    }
  };

  const analyzeRx = async () => {
    if (!image) return;
    setBusy(true);
    setMsg("Reading and verifying the prescription...");
    try {
      const response = await fetch("/api/ai/analyze-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: image })
      });
      const data = await readJsonResponse(response);
      const medicines = Array.isArray(data.medicines) ? data.medicines : [];
      const normalized = medicines.map((item: any) => ({
        medicineName: String(item.medicineName || ""),
        strength: String(item.strength || ""),
        dose: String(item.dose || ""),
        frequency: String(item.frequency || "Once a day"),
        times: normalizeTimes(Array.isArray(item.times) ? item.times : [], String(item.frequency || "Once a day")),
        foodInstruction: String(item.foodInstruction || ""),
        durationDays: typeof item.durationDays === "number" ? item.durationDays : null,
        instructions: String(item.instructions || ""),
        confidence: typeof item.confidence === "number" ? item.confidence : 0,
        uncertainFields: Array.isArray(item.uncertainFields) ? item.uncertainFields : []
      })) as RxItem[];

      setRx(normalized);
      const uncertain = normalized.some(item => !item.medicineName || !item.dose || !item.frequency || item.confidence < 0.75 || (item.uncertainFields?.length ?? 0) > 0);

      if (!normalized.length) {
        setMsg("No medicine could be verified from this prescription. Please capture a clearer image.");
        return;
      }

      if (uncertain) {
        setMsg("The prescription was read, but some details need your verification. Correct the highlighted fields, then confirm.");
        return;
      }

      // AI verification passed: automatically create the schedule.
      setMsg("Prescription verified. Creating your medication schedule...");
      setAutoScheduled(true);
      await scheduleItems(normalized);
      setMsg("Prescription verified and the medication schedule was created successfully.");
      setRx([]);
      setImage(null);
    } catch (error: any) {
      console.error("[Prescription Analysis]", error);
      setMsg(error?.message || "Prescription analysis failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRx = async () => {
    const items = rx.filter(item => item.medicineName.trim());
    const invalid = items.find(item => !item.dose.trim() || !item.frequency.trim());
    if (!items.length) return setMsg("No verified medicines are ready to schedule.");
    if (invalid) return setMsg("Please verify medicine name, dose and frequency for every medicine.");
    setBusy(true);
    setMsg("Creating medication schedule...");
    try {
      await scheduleItems(items);
      setRx([]);
      setImage(null);
      setMsg("Verified medicines were added and scheduled successfully.");
    } catch (error: any) {
      console.error("[Prescription Schedule]", error);
      setMsg(error?.message || "Could not create the medication schedule. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const scheduleManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manual.name.trim() || !manual.dosage.trim()) {
      setMsg("Enter the medicine name and dosage.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const times = normalizeTimes(manual.times, manual.frequency);
      const medicineRef = await addDoc(collection(db, "users", user.uid, "medicines"), {
        name: manual.name.trim(),
        dosage: manual.dosage.trim(),
        frequency: manual.frequency,
        times,
        instructions: manual.instructions,
        startDate: new Date().toISOString(),
        endDate: manual.durationDays ? new Date(Date.now() + manual.durationDays * 86400000).toISOString() : undefined,
        status: "active"
      });
      await createDosesForMedicine(medicineRef.id, manual.name.trim(), times, manual.frequency, manual.durationDays);
      setManual({ name: "", dosage: "", frequency: "Once a day", times: ["08:00"], instructions: "", durationDays: 30 });
      setMsg("Medicine scheduled successfully and added to your dashboard.");
    } catch (error: any) {
      console.error("[Manual Schedule]", error);
      setMsg(error?.message || "Could not schedule medicine.");
    } finally {
      setBusy(false);
    }
  };

  const changeManualFrequency = (frequency: Frequency) => {
    setManual(current => ({ ...current, frequency, times: timesForFrequency(frequency) }));
  };

  return (
    <section className="space-y-5">
      <div>
        <div className="text-teal-300 text-xs font-black uppercase tracking-widest flex gap-2 items-center"><Sparkles size={14} /> Medication Center</div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-50 mt-1">Manage your medicines</h2>
        <p className="text-sm text-slate-400">Schedule medicines manually or let SmartMed read a prescription and build the schedule.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <button type="button" onClick={() => { reset(); setActive("manual"); }} className="text-left glass-panel rounded-3xl p-6 shadow-xl btn-3d">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center"><Pill size={24} /></div>
          <h3 className="font-black text-slate-50 mt-4">Manual Medicine Schedule</h3>
          <p className="text-sm text-slate-400 mt-2">Enter a medicine and choose its daily schedule.</p>
        </button>
        <button type="button" onClick={() => { reset(); setActive("prescription"); }} className="text-left glass-panel rounded-3xl p-6 shadow-xl btn-3d">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center"><ScanLine size={24} /></div>
          <h3 className="font-black text-slate-50 mt-4">Prescription Scanner</h3>
          <p className="text-sm text-slate-400 mt-2">Take or upload a prescription. SmartMed verifies it and creates the schedule.</p>
        </button>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-teal-500/15">
            <div className="flex justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-slate-50">{active === "manual" ? "Manual Medicine Schedule" : "Prescription Scanner"}</h3>
                <p className="text-xs text-slate-400">{active === "manual" ? "Choose the frequency and the exact times." : "The prescription is analyzed and verified before scheduling."}</p>
              </div>
              <button type="button" onClick={() => setActive(null)} className="p-2 text-slate-400" aria-label="Close"><X /></button>
            </div>

            {active === "manual" && (
              <form onSubmit={scheduleManual} className="grid md:grid-cols-2 gap-4 max-w-3xl">
                <input required value={manual.name} onChange={e => setManual({ ...manual, name: e.target.value })} placeholder="Medicine name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3" />
                <input required value={manual.dosage} onChange={e => setManual({ ...manual, dosage: e.target.value })} placeholder="Dosage e.g. 500 mg" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3" />
                <select value={manual.frequency} onChange={e => changeManualFrequency(e.target.value as Frequency)} className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                  <option>Once a day</option>
                  <option>Twice a day</option>
                  <option>Three times a day</option>
                </select>
                <input type="number" min="1" max="365" value={manual.durationDays} onChange={e => setManual({ ...manual, durationDays: Number(e.target.value) })} className="bg-slate-900 border border-slate-700 rounded-xl p-3" placeholder="Duration in days" />
                <div className="md:col-span-2">
                  <p className="text-xs font-black text-slate-400 mb-2">Dose times</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {manual.times.map((time, index) => (
                      <label key={index} className="text-xs text-slate-400">
                        Dose {index + 1}
                        <input type="time" value={time} onChange={e => setManual(current => ({ ...current, times: current.times.map((t, i) => i === index ? e.target.value : t) }))} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50" />
                      </label>
                    ))}
                  </div>
                </div>
                <textarea value={manual.instructions} onChange={e => setManual({ ...manual, instructions: e.target.value })} placeholder="Instructions e.g. after food" className="md:col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-3 min-h-24" />
                <button type="submit" disabled={busy} className="md:col-span-2 px-5 py-3 rounded-xl bg-teal-600 font-black btn-3d">{busy ? "Scheduling..." : "Schedule Medicine"}</button>
              </form>
            )}

            {active === "prescription" && (
              <>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="rounded-3xl border border-slate-700 bg-slate-950/50 p-5 flex flex-col items-center justify-center min-h-[280px]">
                    {image ? <img src={image} alt="Prescription preview" className="max-h-64 max-w-full rounded-2xl object-contain" /> : <><ImagePlus size={42} className="text-slate-500" /><p className="font-black mt-3">Take or upload a prescription photo</p></>}
                    <div className="flex gap-3 mt-5 flex-wrap justify-center">
                      <button type="button" onClick={takePhoto} className="px-4 py-2.5 rounded-xl bg-teal-600 text-white font-black btn-3d"><Camera size={16} className="inline mr-2" />Take Photo</button>
                      <button type="button" onClick={() => input.current?.click()} className="px-4 py-2.5 rounded-xl bg-slate-800 font-black"><ImagePlus size={16} className="inline mr-2" />Upload</button>
                      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => upload(e.target.files?.[0])} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {rx.length ? <div className="space-y-3 max-h-[440px] overflow-y-auto">
                      {rx.map((item, index) => (
                        <div key={index} className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4 space-y-2">
                          <div className="flex justify-between text-xs"><b>Medicine {index + 1}</b><span className="text-amber-300">{Math.round(item.confidence * 100)}% confidence</span></div>
                          <input value={item.medicineName} onChange={e => editRx(index, "medicineName", e.target.value)} placeholder="Medicine name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-bold" />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={item.dose} onChange={e => editRx(index, "dose", e.target.value)} placeholder="Dose" className="bg-slate-900 border border-slate-700 rounded-xl p-2.5" />
                            <input value={item.frequency} onChange={e => editRx(index, "frequency", e.target.value)} placeholder="Frequency" className="bg-slate-900 border border-slate-700 rounded-xl p-2.5" />
                            <input value={item.durationDays ?? ""} onChange={e => editRx(index, "durationDays", e.target.value ? Number(e.target.value) : null)} placeholder="Days" type="number" className="bg-slate-900 border border-slate-700 rounded-xl p-2.5" />
                          </div>
                          <input value={item.times.join(", ")} onChange={e => editRx(index, "times", e.target.value.split(",").map(v => v.trim()).filter(Boolean))} placeholder="Times e.g. 08:00, 20:00" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5" />
                          <input value={item.foodInstruction} onChange={e => editRx(index, "foodInstruction", e.target.value)} placeholder="Before/after food" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5" />
                          {item.uncertainFields?.length ? <div className="text-xs text-amber-300"><AlertTriangle size={14} className="inline mr-1" />Please verify: {item.uncertainFields.join(", ")}</div> : null}
                        </div>
                      ))}
                    </div> : <div className="flex items-center justify-center min-h-[260px] text-slate-500">Take or upload a prescription, then analyze it.</div>}
                  </div>
                </div>

                <div className="flex gap-3 mt-5 flex-wrap">
                  <button type="button" disabled={!image || busy} onClick={analyzeRx} className="px-5 py-3 rounded-xl bg-teal-600 font-black btn-3d">{busy ? "Analyzing..." : "Analyze & Verify"}</button>
                  {rx.length > 0 && !autoScheduled && <button type="button" disabled={busy} onClick={confirmRx} className="px-5 py-3 rounded-xl bg-emerald-600 font-black btn-3d"><CheckCircle2 size={17} className="inline mr-2" />Confirm & Create Schedule</button>}
                  <button type="button" onClick={reset} className="px-5 py-3 rounded-xl bg-slate-800 font-black"><RefreshCw size={17} className="inline mr-2" />Reset</button>
                </div>
                {msg && <div className="mt-5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-200"><AlertTriangle size={17} className="inline mr-2" />{msg}</div>}
              </>
            )}
          </motion.div>
        )}

        {camera && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 p-4 rounded-3xl max-w-2xl w-full">
              <video ref={video} autoPlay playsInline className="w-full rounded-2xl max-h-[70vh] object-contain bg-black" />
              <div className="flex justify-center gap-3 mt-4">
                <button type="button" onClick={capture} className="px-6 py-3 rounded-xl bg-teal-600 font-black">Capture</button>
                <button type="button" onClick={() => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false); }} className="px-6 py-3 rounded-xl bg-slate-800 font-black">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
