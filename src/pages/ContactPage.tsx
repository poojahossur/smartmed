import React, { useState } from "react";
import { Mail, Phone, MapPin, Send, MessageCircle, Clock } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-12">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Get in Touch</h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Have questions or need support? Our team is here to help you 24/7.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-8">
            <ContactInfoItem 
              icon={<Mail className="text-blue-600" />}
              title="Email Us"
              content="support@smartmed.com"
              description="We'll respond within 24 hours."
            />
            <ContactInfoItem 
              icon={<Phone className="text-green-600" />}
              title="Call Us"
              content="+1 (800) SMART-MED"
              description="Available 24/7 for emergencies."
            />
            <ContactInfoItem 
              icon={<MapPin className="text-red-600" />}
              title="Visit Us"
              content="123 Healthcare Plaza, NY"
              description="Our headquarters in New York."
            />
          </div>

          <div className="p-8 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200 space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle size={24} /> Live Chat
            </h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Need immediate assistance? Chat with our healthcare specialists right now.
            </p>
            <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors">
              Start Chat
            </button>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          {submitted ? (
            <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto">
                <Send size={40} />
              </div>
              <h2 className="text-3xl font-bold text-slate-900">Message Sent!</h2>
              <p className="text-slate-600 max-w-sm mx-auto leading-relaxed">
                Thank you for reaching out. One of our specialists will get back to you shortly.
              </p>
              <button 
                onClick={() => setSubmitted(false)}
                className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Subject</label>
                <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                  <option>General Inquiry</option>
                  <option>Technical Support</option>
                  <option>Billing Question</option>
                  <option>Partnership</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Message</label>
                <textarea 
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all h-40 resize-none"
                  placeholder="How can we help you?"
                />
              </div>

              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                Send Message <Send size={20} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactInfoItem({ icon, title, content, description }: { icon: React.ReactNode, title: string, content: string, description: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-slate-900">{title}</h4>
        <p className="text-blue-600 font-bold">{content}</p>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );
}
