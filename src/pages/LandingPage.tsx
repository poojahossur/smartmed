import React from "react";
import { Link } from "react-router-dom";
import { Pill, Bell, Shield, Users, Phone, Mic, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950/5 relative overflow-hidden">
      {/* Hero Section */}
      <header className="relative overflow-hidden pt-16 pb-24 lg:pt-28 lg:pb-36">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl glass-panel p-8 md:p-14 rounded-3xl md:rounded-[40px] shadow-2xl relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-300 text-xs font-black uppercase tracking-wider mb-6">
              <span>✦ Intelligent Healthcare Assistant</span>
            </div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black text-slate-50 leading-tight mb-6 tracking-tight"
            >
              Smart Medicine Assistant for <span className="bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">Everyone</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed font-normal"
            >
              A modern healthcare platform that ensures you never miss a dose. 
              Supporting both smartphones and keypad phones with automated calls and SMS.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <Link to="/signup" className="px-8 py-4 bg-gradient-to-r from-teal-600 to-sky-600 text-white rounded-2xl font-black transition-all shadow-xl shadow-teal-500/25 btn-3d flex items-center gap-2">
                Get Started Free <ArrowRight size={20} />
              </Link>
              <Link to="/finder" className="px-8 py-4 glass-card bg-slate-900/85 text-slate-100 border border-slate-700/70/80 rounded-2xl font-black hover:bg-slate-900 transition-all shadow-md">
                Find Pharmacies
              </Link>
            </motion.div>
          </div>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[500px] h-[500px] bg-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-emerald-400/20 rounded-full blur-3xl pointer-events-none"></div>
      </header>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-slate-50 tracking-tight">Comprehensive Care Features</h2>
            <p className="text-slate-600 text-base">Built with empathy for patients and peace of mind for caregivers.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Bell className="text-teal-600" />}
              title="Smart Reminders"
              description="Multi-level escalation from app notifications to automated voice calls."
            />
            <FeatureCard 
              icon={<Users className="text-emerald-600" />}
              title="Caregiver Monitoring"
              description="Real-time tracking of medicine adherence for family and caregivers."
            />
            <FeatureCard 
              icon={<Phone className="text-sky-600" />}
              title="Keypad Phone Support"
              description="Reminders via SMS and automated calls for non-smartphone users."
            />
            <FeatureCard 
              icon={<Shield className="text-rose-600" />}
              title="Safe Substitutions"
              description="Intelligent engine to find safe alternatives based on your health profile."
            />
            <FeatureCard 
              icon={<Mic className="text-amber-600" />}
              title="Voice Interaction"
              description="Control your schedule and check doses using simple voice commands."
            />
            <FeatureCard 
              icon={<Pill className="text-teal-600" />}
              title="Medicine Finder"
              description="Locate nearby pharmacies and check availability in real-time."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-panel border-t border-white/60 text-slate-50 py-12 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
                <Pill size={22} />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-50">SmartMed</span>
            </div>
            <div className="flex gap-8 text-slate-600 font-bold text-sm">
              <Link to="/about" className="hover:text-teal-600 transition-colors">About</Link>
              <Link to="/contact" className="hover:text-teal-600 transition-colors">Contact</Link>
              <Link to="/faq" className="hover:text-teal-600 transition-colors">FAQ</Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-700/70/60 text-center text-slate-500 text-xs font-semibold">
            © 2026 Smart Medicine Assistant System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-card p-8 rounded-3xl shadow-xl glass-card-hover space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-900/85 shadow-md flex items-center justify-center border border-white/80">
        {icon}
      </div>
      <h3 className="text-xl font-black text-slate-50 tracking-tight">{title}</h3>
      <p className="text-slate-600 leading-relaxed text-sm font-medium">{description}</p>
    </div>
  );
}
