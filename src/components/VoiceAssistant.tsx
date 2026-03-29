import React, { useState, useEffect, useCallback } from "react";
import { Mic, MicOff, X, MessageSquare, Pill, Clock, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export default function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        processCommand(text);
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage("Microphone access denied. Please enable it in your browser settings or try opening the app in a new tab.");
        } else {
          setErrorMessage(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let reply = "";
    
    if (lowerText.includes("remind me at")) {
      reply = "Okay, I'll set a reminder for you at that time.";
    } else if (lowerText.includes("show my medicines") || lowerText.includes("what are my medicines")) {
      reply = "You have Amlodipine at 8 AM and Metformin at 8 PM today.";
    } else if (lowerText.includes("did i take my medicine") || lowerText.includes("have i taken my medicine")) {
      reply = "You took your Amlodipine at 8:05 AM, but you missed your morning Metformin.";
    } else {
      reply = "I'm sorry, I didn't quite catch that. Try saying 'Show my medicines' or 'Did I take my medicine?'.";
    }
    
    setResponse(reply);
    
    // Speak response
    const utterance = new SpeechSynthesisUtterance(reply);
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      setResponse("");
      setErrorMessage("");
      try {
        recognition?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start recognition:", err);
        setErrorMessage("Could not start microphone. Please try again.");
      }
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-400 flex items-center justify-center hover:scale-110 transition-transform z-50 group"
      >
        <Mic size={28} className="group-hover:animate-pulse" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-28 right-8 w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Mic size={18} />
                </div>
                <h3 className="font-bold">Voice Assistant</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="min-h-[100px] flex flex-col justify-center text-center space-y-4">
                {errorMessage ? (
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-medium border border-red-100">
                    {errorMessage}
                  </div>
                ) : transcript ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400 font-medium italic">"{transcript}"</p>
                    {response && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-blue-50 text-blue-700 rounded-2xl text-sm font-medium leading-relaxed"
                      >
                        {response}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Click the microphone and say something like:<br/>
                    <span className="font-bold text-blue-600">"Show my medicines"</span>
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <button 
                  onClick={toggleListening}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg",
                    isListening ? "bg-red-500 text-white animate-pulse scale-110" : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  )}
                >
                  {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <VoiceHint icon={<Pill size={14} />} label="Meds" />
                <VoiceHint icon={<Clock size={14} />} label="Remind" />
                <VoiceHint icon={<CheckCircle2 size={14} />} label="Status" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function VoiceHint({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-100">
      <div className="text-slate-400">{icon}</div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}
