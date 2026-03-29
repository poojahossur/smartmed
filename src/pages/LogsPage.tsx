import { useState, useEffect } from "react";
import { ClipboardList, PhoneCall, MessageSquare, Bell, CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { CommunicationLog } from "../types";
import { cn } from "../lib/utils";

export default function LogsPage() {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/simulate/logs");
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      // Fallback dummy logs
      setLogs([
        { id: "1", timestamp: new Date().toISOString(), type: "APP", recipient: "Self", message: "Level 1: App Notification sent for Metformin", status: "Sent" },
        { id: "2", timestamp: new Date(Date.now() - 3600000).toISOString(), type: "SMS", recipient: "+1234567890", message: "Reminder: Take your Amlodipine 5mg", status: "Sent" },
        { id: "3", timestamp: new Date(Date.now() - 7200000).toISOString(), type: "CALL", recipient: "+1234567890", message: "Automated call: Medicine reminder for Metformin", status: "Completed" },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Communication Logs</h1>
          <p className="text-slate-500">Tracking all reminders, SMS, and automated calls.</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="px-6 py-3 bg-white text-blue-600 border border-blue-200 rounded-2xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-sm"
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} /> Refresh Logs
        </button>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Message</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log, index) => (
                <motion.tr 
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                    {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={cn(
                      "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
                      log.type === 'SMS' ? "text-purple-600" : 
                      log.type === 'CALL' ? "text-orange-600" : "text-blue-600"
                    )}>
                      {log.type === 'SMS' ? <MessageSquare size={14} /> : 
                       log.type === 'CALL' ? <PhoneCall size={14} /> : <Bell size={14} />}
                      {log.type}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-bold">
                    {log.recipient}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-md truncate">
                    {log.message}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1",
                      log.status === 'Sent' || log.status === 'Completed' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {log.status === 'Sent' || log.status === 'Completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {log.status}
                    </div>
                  </td>
                </motion.tr>
              ))}
              
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ClipboardList size={32} />
                    </div>
                    No communication logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="text-purple-600" size={20} /> SMS Reminders
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Reminders are sent via SMS if the app notification is ignored for more than 15 minutes.
          </p>
        </div>
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PhoneCall className="text-orange-600" size={20} /> Automated Calls
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Voice calls are triggered if both app and SMS reminders are ignored for 30 minutes.
          </p>
        </div>
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={20} /> Caregiver Alerts
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Caregivers are notified via call and SMS if a dose is missed for more than 1 hour.
          </p>
        </div>
      </div>
    </div>
  );
}
