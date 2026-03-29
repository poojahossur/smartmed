import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Phone, MessageSquare, X, Bell, Pill } from "lucide-react";
import { cn } from "../lib/utils";

interface Notification {
  id: string;
  type: 'SMS' | 'CALL' | 'APP';
  message: string;
  timestamp: string;
}

export default function NotificationOverlay() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Listen for custom events from the dashboard
    const handleNotification = (event: any) => {
      const { type, message } = event.detail;

      const newNotif = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        message,
        timestamp: new Date().toISOString(),
      };
      setNotifications(prev => [newNotif, ...prev]);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 10000);

      // Try browser notification
      if (Notification.permission === "granted") {
        new Notification(`Medicine Reminder (${type})`, {
          body: message,
          icon: "/pill-icon.png"
        });
      }
    };

    window.addEventListener('medicine-reminder', handleNotification);
    
    // Request permission on mount
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => window.removeEventListener('medicine-reminder', handleNotification);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className={cn(
              "pointer-events-auto p-4 rounded-2xl shadow-2xl border flex items-start gap-4 backdrop-blur-md",
              notif.type === 'CALL' ? "bg-blue-600/95 border-blue-500 text-white" : 
              notif.type === 'SMS' ? "bg-slate-900/95 border-slate-800 text-white" : "bg-white border-slate-200"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              notif.type === 'CALL' ? "bg-white/20" : 
              notif.type === 'SMS' ? "bg-white/20" : "bg-blue-100 text-blue-600"
            )}>
              {notif.type === 'CALL' ? <Phone className="animate-bounce" size={24} /> : 
               notif.type === 'SMS' ? <MessageSquare size={24} /> : <Bell size={24} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  {notif.type === 'CALL' ? 'Incoming Call' : notif.type === 'SMS' ? 'New Message' : 'App Alert'}
                </p>
                <button onClick={() => removeNotification(notif.id)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>
              <p className="text-sm font-medium leading-relaxed">{notif.message}</p>
              
              {notif.type === 'CALL' && (
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors">
                    Answer
                  </button>
                  <button className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors">
                    Decline
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
