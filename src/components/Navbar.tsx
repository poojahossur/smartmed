import { Pill, LogOut, User, Bell, Sparkles } from "lucide-react";
import { UserProfile } from "../types";
import { Link } from "react-router-dom";

export default function Navbar({ user, onLogout }: { user: UserProfile, onLogout: () => void }) {
  return (
    <nav className="h-16 bg-slate-900/75 backdrop-blur-xl border-b border-white/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)] flex items-center justify-between px-4 md:px-8 sticky top-0 z-50 transition-all">
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 via-sky-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 group-hover:scale-105 group-hover:shadow-sky-500/40 transition-all duration-300 ring-1 ring-white/40">
          <Pill size={22} className="rotate-45" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-slate-50 via-slate-200 to-teal-300 bg-clip-text text-transparent">
            SmartMed
          </span>
          <span className="text-[10px] font-bold tracking-widest text-teal-600 uppercase -mt-1 hidden sm:block">
            Healthcare Suite
          </span>
        </div>
      </Link>
      
      <div className="flex items-center gap-3 md:gap-5">
        <button className="w-9 h-9 flex items-center justify-center text-slate-600 hover:text-teal-600 bg-slate-900/80 hover:bg-teal-950/40 rounded-xl border border-slate-700/70/80 shadow-sm hover:shadow transition-all relative group">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-700/70/80">
          <div className="flex items-center gap-2.5 bg-slate-900/85 px-3 py-1.5 rounded-2xl border border-slate-700/70/80 shadow-sm">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
              {user.displayName ? user.displayName[0].toUpperCase() : "U"}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-black text-slate-100 leading-tight">{user.displayName || "Patient"}</p>
              <p className="text-[10px] font-bold text-teal-600 capitalize leading-none">{user.role || "Member"}</p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-rose-600 bg-slate-900/65 hover:bg-rose-950/40 rounded-xl border border-slate-700/70/60 shadow-sm hover:shadow transition-all group"
            title="Logout"
          >
            <LogOut size={17} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </nav>
  );
}

