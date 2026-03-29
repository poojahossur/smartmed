import { Pill, LogOut, User, Bell } from "lucide-react";
import { UserProfile } from "../types";
import { Link } from "react-router-dom";

export default function Navbar({ user, onLogout }: { user: UserProfile, onLogout: () => void }) {
  return (
    <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2">
        <Pill className="text-blue-600" size={28} />
        <span className="text-xl font-bold tracking-tight text-slate-900 hidden md:block">SmartMed</span>
      </Link>
      
      <div className="flex items-center gap-4 md:gap-6">
        <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {user.displayName[0]}
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
