import React from "react";
import { Pill, Shield, Users, Heart, Globe, Award } from "lucide-react";
import { motion } from "motion/react";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-16 py-8">
      <section className="text-center space-y-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-8 shadow-lg shadow-blue-100"
        >
          <Pill size={40} />
        </motion.div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">About SmartMed</h1>
        <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
          We are dedicated to improving healthcare accessibility and adherence through intelligent technology.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Our Mission</h2>
          <p className="text-slate-600 leading-relaxed">
            Our mission is to ensure that every patient, regardless of their technology access, receives the reminders and support they need to manage their medications safely and effectively.
          </p>
          <p className="text-slate-600 leading-relaxed">
            By bridging the gap between modern smartphones and traditional keypad phones, we provide a universal safety net for patients and peace of mind for their families.
          </p>
        </div>
        <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-5xl font-black text-blue-600">1M+</div>
            <p className="text-blue-900 font-bold uppercase tracking-widest text-sm">Doses Tracked</p>
            <p className="text-blue-700 text-sm">Helping patients stay healthy every day.</p>
          </div>
        </div>
      </div>

      <section className="space-y-12">
        <h2 className="text-2xl font-bold text-slate-900 text-center">Our Core Values</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          <ValueCard 
            icon={<Shield className="text-blue-600" />}
            title="Safety First"
            description="Every feature is built with patient safety as the top priority."
          />
          <ValueCard 
            icon={<Globe className="text-green-600" />}
            title="Inclusivity"
            description="Supporting all users, from tech-savvy to non-smartphone users."
          />
          <ValueCard 
            icon={<Heart className="text-red-600" />}
            title="Empathy"
            description="Designed with a deep understanding of patient and caregiver needs."
          />
        </div>
      </section>

      <section className="bg-slate-900 p-12 rounded-[40px] text-white text-center space-y-8">
        <h2 className="text-3xl font-bold">Join the Healthcare Revolution</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Experience the future of medicine management today. Start your journey towards better health adherence.
        </p>
        <button className="px-8 py-4 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/50">
          Get Started Now
        </button>
      </section>
    </div>
  );
}

function ValueCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm text-center space-y-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
