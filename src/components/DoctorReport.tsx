import React, { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { FileText, Printer, Sparkles, AlertTriangle } from "lucide-react";
import { db } from "../firebase";
import { DoseRecord, UserProfile } from "../types";

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c));

type MedicineReport = { name:string; scheduled:number; taken:number; missed:number; pending:number; late:number; adherence:number };
type Report = {
  days: number; scheduled: number; taken: number; missed: number; late: number; pending:number; adherence: number;
  byMedicine: MedicineReport[]; summary: string; generated: string;
};

export default function DoctorReport({ user }: { user: UserProfile }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generateReport = async () => {
    setBusy(true); setError("");
    try {
      const [ds, medsSnap] = await Promise.all([
        getDocs(collection(db, "users", user.uid, "doses")),
        getDocs(collection(db, "users", user.uid, "medicines"))
      ]);
      const now = Date.now();
      const since = now - days * 86400000;
      const doses = ds.docs.map(d => ({ id:d.id, ...d.data() })) as DoseRecord[];

      // Only include doses belonging to medicines that still exist. If a medicine
      // was removed from "My Medicines & Schedule Management", it must not affect
      // the doctor report's scheduled/taken/missed totals.
      const existingMedicineIds = new Set(medsSnap.docs.map(d => d.id));
      const periodDoses = doses.filter(d => {
        if (d.status === "deleted") return false;
        if (!existingMedicineIds.has(d.medicineId)) return false;
        const t = new Date(d.scheduledTime).getTime();
        return Number.isFinite(t) && t >= since && t <= now;
      });

      const taken = periodDoses.filter(d => d.status === "taken").length;
      const missed = periodDoses.filter(d => d.status === "missed").length;
      const pending = periodDoses.filter(d => d.status === "pending").length;
      const late = periodDoses.filter(d => d.status === "taken" && d.takenTime && new Date(d.takenTime).getTime() - new Date(d.scheduledTime).getTime() > 15 * 60000).length;

      // Build the medicine table directly from dose records. This guarantees that
      // the per-medicine numbers are based on the exact scheduled dose events in
      // the selected report period, rather than on the current medicine list.
      const grouped = new Map<string, MedicineReport>();
      for (const d of periodDoses) {
        const name = String(d.medicineName || "Unknown medicine").trim() || "Unknown medicine";
        const key = `${d.medicineId || ""}::${name.toLowerCase()}`;
        const current = grouped.get(key) || { name, scheduled:0, taken:0, missed:0, pending:0, late:0, adherence:0 };
        current.scheduled += 1;
        if (d.status === "taken") {
          current.taken += 1;
          if (d.takenTime && new Date(d.takenTime).getTime() - new Date(d.scheduledTime).getTime() > 15 * 60000) current.late += 1;
        } else if (d.status === "missed") current.missed += 1;
        else if (d.status === "pending") current.pending += 1;
        grouped.set(key, current);
      }

      const byMedicine = Array.from(grouped.values()).map(x => ({
        ...x,
        // "Scheduled" means doses that were due and have a final outcome.
        // Still-pending doses are shown separately and never inflate Scheduled.
        scheduled: x.taken + x.missed,
        adherence: (x.taken + x.missed) ? Math.round(x.taken / (x.taken + x.missed) * 100) : 0
      })).sort((a,b) => b.scheduled - a.scheduled || a.name.localeCompare(b.name));

      // Overall adherence also excludes still-pending doses.
      const adherence = (taken + missed) ? Math.round(taken / (taken + missed) * 100) : 0;
      const response = await fetch("/api/ai/doctor-report-summary", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ user:{displayName:user.displayName, age:user.age}, periodDays:days, scheduled:taken + missed, taken, missed, pending, late, adherence, byMedicine })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate the report summary.");
      setReport({ days, scheduled:taken + missed, taken, missed, late, pending, adherence, byMedicine, summary:data.summary || "No additional summary was generated.", generated:new Date().toLocaleString() });
    } catch (e:any) {
      console.error("[Doctor Report]", e);
      setError(e?.message || "Could not generate the doctor report.");
    } finally { setBusy(false); }
  };

  const printReport = () => {
    if (!report) return;
    const rows = report.byMedicine.map(x => `<tr><td>${esc(x.name)}</td><td>${x.scheduled}</td><td>${x.taken}</td><td>${x.missed}</td><td>${x.pending}</td><td>${x.late}</td><td>${x.adherence}%</td></tr>`).join("");
    const w = window.open("", "_blank", "width=1000,height=750");
    if (!w) { setError("Please allow pop-ups to export the report as PDF."); return; }
    w.document.write(`<html><head><title>SmartMed Doctor Report</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px;border:1px solid #ddd;text-align:left}th{background:#eef3f5}.grid{display:flex;gap:12px}.box{padding:15px;border:1px solid #ddd;border-radius:10px;flex:1}.v{font-size:24px;font-weight:bold}</style></head><body><h1>SmartMed Doctor Report</h1><p>Patient: ${esc(user.displayName)} | Period: ${report.days} days | Generated: ${esc(report.generated)}</p><div class='grid'><div class='box'>Adherence<div class='v'>${report.adherence}%</div></div><div class='box'>Scheduled<div class='v'>${report.scheduled}</div></div><div class='box'>Taken<div class='v'>${report.taken}</div></div><div class='box'>Missed<div class='v'>${report.missed}</div></div></div><h2>Medication adherence by medicine</h2><table><tr><th>Medicine</th><th>Scheduled</th><th>Taken</th><th>Missed</th><th>Pending</th><th>Late</th><th>Adherence</th></tr>${rows || '<tr><td colspan="7">No dose data</td></tr>'}</table><h2>Summary</h2><p>${esc(report.summary)}</p><p><strong>Disclaimer:</strong> This report summarizes SmartMed records and is not a diagnosis or treatment recommendation.</p><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  };

  return <section className="glass-panel p-7 md:p-8 rounded-3xl shadow-xl space-y-5">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div><div className="text-teal-300 text-xs font-black uppercase tracking-widest flex gap-2 items-center"><Sparkles size={14}/> Doctor Report</div><h2 className="text-xl md:text-2xl font-black text-slate-50 mt-1">Patient medication progress</h2><p className="text-sm text-slate-400 mt-1">Generate a factual adherence report from your recorded medication history.</p></div>
      <FileText className="text-teal-300" size={28}/>
    </div>
    <div className="flex gap-3 flex-wrap">
      <select value={days} onChange={e=>setDays(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>
      <button onClick={generateReport} disabled={busy} className="px-5 py-3 rounded-xl bg-teal-600 text-white font-black btn-3d">{busy ? "Generating..." : "Generate Report"}</button>
      {report && <button onClick={printReport} className="px-5 py-3 rounded-xl bg-slate-800 text-white font-black btn-3d"><Printer size={16} className="inline mr-2"/>Download / Save PDF</button>}
    </div>
    {error && <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-200"><AlertTriangle size={17} className="inline mr-2"/>{error}</div>}
    {report ? <div className="rounded-3xl bg-slate-950/50 border border-slate-700 p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Adherence",report.adherence+"%"],["Scheduled",report.scheduled],["Taken",report.taken],["Missed",report.missed]].map(([a,v])=><div key={String(a)} className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{a}</p><p className="text-2xl font-black mt-1 text-slate-50">{v}</p></div>)}</div>
      <div className="overflow-x-auto mt-5"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="p-2">Medicine</th><th className="p-2">Scheduled</th><th className="p-2">Taken</th><th className="p-2">Missed</th><th className="p-2">Pending</th><th className="p-2">Late</th><th className="p-2">Adherence</th></tr></thead><tbody>{report.byMedicine.map(r=><tr key={r.name} className="border-t border-slate-800"><td className="p-2 font-bold text-slate-200">{r.name}</td><td className="p-2">{r.scheduled}</td><td className="p-2">{r.taken}</td><td className="p-2">{r.missed}</td><td className="p-2">{r.pending}</td><td className="p-2">{r.late}</td><td className="p-2">{r.adherence}%</td></tr>)}</tbody></table></div>
      <div className="mt-5 p-4 rounded-2xl bg-teal-500/5 border border-teal-500/10"><p className="text-xs uppercase tracking-widest text-teal-300 font-black">AI summary</p><p className="text-sm text-slate-300 mt-2">{report.summary}</p></div>
      <p className="text-[11px] text-slate-500 mt-4">This report summarizes SmartMed records and is not a diagnosis or treatment recommendation.</p>
    </div> : <div className="text-center py-10 border border-dashed border-slate-700 rounded-3xl"><FileText className="mx-auto text-slate-500" size={40}/><p className="font-black mt-3 text-slate-300">Generate a doctor-ready report from your real medication history.</p></div>}
  </section>;
}
