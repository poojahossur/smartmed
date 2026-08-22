import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Search, Pill, Bell, Users, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

const FAQS = [
  {
    question: "How does the multi-level reminder system work?",
    answer: "Our system starts with a standard app notification. If not acknowledged within 15 minutes, it sends an SMS. After 30 minutes, it triggers an automated voice call. Finally, if the dose is still missed after 1 hour, your designated caregiver is notified.",
    category: "Reminders"
  },
  {
    question: "Can I use SmartMed without a smartphone?",
    answer: "Yes! While the dashboard is best experienced on a smartphone or computer, you can receive all reminders via SMS and automated voice calls on any standard keypad phone.",
    category: "Accessibility"
  },
  {
    question: "How do I add a caregiver to my account?",
    answer: "Go to your Profile settings and select 'Add Caregiver'. You'll need to provide their name and phone number. They will receive an invitation to create a caregiver account linked to yours.",
    category: "Caregivers"
  },
  {
    question: "Is my medical data secure?",
    answer: "Absolutely. We use industry-standard encryption and secure cloud storage to protect your personal and medical information. We never share your data with third parties without your explicit consent.",
    category: "Security"
  },
  {
    question: "How is the Health Compliance Score calculated?",
    answer: "The score is a percentage of doses taken versus doses scheduled over the last 7 days. A score above 85% is considered 'Good', while below 60% is 'Risky'.",
    category: "Health"
  }
];

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQS.filter(f => 
    f.question.toLowerCase().includes(search.toLowerCase()) || 
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-12">
      <header className="text-center space-y-6">
        <div className="w-16 h-16 bg-teal-900/45 rounded-full flex items-center justify-center text-teal-600 mx-auto mb-4">
          <HelpCircle size={32} />
        </div>
        <h1 className="text-4xl font-bold text-slate-50 tracking-tight">Frequently Asked Questions</h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Everything you need to know about managing your health with SmartMed.
        </p>
        
        <div className="relative max-w-xl mx-auto mt-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-slate-900 border border-slate-700/70 rounded-[30px] shadow-lg shadow-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-lg"
            placeholder="Search for answers..."
          />
        </div>
      </header>

      <div className="space-y-4">
        {filteredFaqs.map((faq, index) => (
          <div 
            key={index}
            className={cn(
              "bg-slate-900 rounded-3xl border transition-all overflow-hidden",
              openIndex === index ? "border-teal-700/60 shadow-xl shadow-teal-50" : "border-slate-800 hover:border-slate-700/70"
            )}
          >
            <button 
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-8 py-6 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-teal-600 bg-teal-950/40 px-3 py-1 rounded-full uppercase tracking-widest">
                  {faq.category}
                </span>
                <h3 className="text-lg font-bold text-slate-50">{faq.question}</h3>
              </div>
              {openIndex === index ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
            </button>
            
            <AnimatePresence>
              {openIndex === index && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-8 pb-8"
                >
                  <div className="pt-4 border-t border-slate-900 text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 text-center space-y-6">
        <h3 className="text-2xl font-bold text-slate-50">Still have questions?</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          If you couldn't find the answer you're looking for, please contact our support team.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="px-8 py-3 bg-teal-600 text-white rounded-full font-bold hover:bg-teal-700 transition-all">
            Contact Support
          </button>
          <button className="px-8 py-3 bg-slate-900 text-slate-200 border border-slate-700/70 rounded-full font-bold hover:bg-slate-900 transition-all">
            View Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
