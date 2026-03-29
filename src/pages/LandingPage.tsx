import React from "react";
import { Link } from "react-router-dom";
import { Pill, Bell, Shield, Users, Phone, Mic, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-blue-50 pt-16 pb-24 lg:pt-32 lg:pb-40">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6"
            >
              Smart Medicine Assistant for <span className="text-blue-600">Everyone</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-slate-600 mb-10 leading-relaxed"
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
              <Link to="/signup" className="px-8 py-4 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2">
                Get Started Free <ArrowRight size={20} />
              </Link>
              <Link to="/about" className="px-8 py-4 bg-white text-blue-600 border border-blue-200 rounded-full font-semibold hover:bg-blue-50 transition-colors">
                Learn More
              </Link>
            </motion.div>
          </div>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-50"></div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Comprehensive Care Features</h2>
            <p className="text-slate-600">Built with empathy for patients and peace of mind for caregivers.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Bell className="text-blue-600" />}
              title="Smart Reminders"
              description="Multi-level escalation from app notifications to automated voice calls."
            />
            <FeatureCard 
              icon={<Users className="text-green-600" />}
              title="Caregiver Monitoring"
              description="Real-time tracking of medicine adherence for family and caregivers."
            />
            <FeatureCard 
              icon={<Phone className="text-purple-600" />}
              title="Keypad Phone Support"
              description="Reminders via SMS and automated calls for non-smartphone users."
            />
            <FeatureCard 
              icon={<Shield className="text-red-600" />}
              title="Safe Substitutions"
              description="Intelligent engine to find safe alternatives based on your health profile."
            />
            <FeatureCard 
              icon={<Mic className="text-orange-600" />}
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
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Pill className="text-blue-400" size={32} />
              <span className="text-2xl font-bold tracking-tight">SmartMed</span>
            </div>
            <div className="flex gap-8 text-slate-400">
              <Link to="/about" className="hover:text-white transition-colors">About</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
            © 2026 Smart Medicine Assistant System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200 transition-all group">
      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
