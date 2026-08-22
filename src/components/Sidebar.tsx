import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Pill, Search, Info, HelpCircle, Mail, ShieldCheck } from "lucide-react";
import { UserProfile } from "../types";
import { cn } from "../lib/utils";

export default function Sidebar({ user }: { user: UserProfile }) {
  const location = useLocation();
  
  const menuItems = [
    { 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/dashboard',
      show: true 
    },
    { 
      label: 'Healthcare Finder', 
      icon: Search, 
      path: '/medicine-finder',
      show: true 
    },
    { 
      label: 'Medication Center', 
      icon: Pill, 
      path: '/medication-center',
      show: true 
    },
    { 
      label: 'Safer Substitution', 
      icon: ShieldCheck, 
      path: '/substitution',
      show: true 
    },
    { label: 'divider', show: true },
    { label: 'About Us', icon: Info, path: '/about', show: true },
    { label: 'Contact', icon: Mail, path: '/contact', show: true },
    { label: 'FAQ', icon: HelpCircle, path: '/faq', show: true },
  ];

  return (
    <aside className="w-20 md:w-64 bg-slate-900/70 backdrop-blur-xl border-r border-white/80 shadow-[4px_0_24px_-4px_rgba(15,23,42,0.04)] min-h-[calc(100vh-4rem)] sticky top-16 hidden sm:block z-40">
      <div className="p-4 space-y-1.5">
        {menuItems.map((item, index) => {
          if (!item.show) return null;
          if (item.label === 'divider') return <hr key={index} className="my-3 border-slate-700/70/60" />;
          
          const Icon = item.icon!;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path!}
              className={cn(
                "flex items-center gap-3.5 p-3 rounded-2xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-teal-600 to-sky-600 text-white font-bold shadow-lg shadow-teal-500/25 ring-1 ring-white/30" 
                  : "text-slate-600 hover:bg-slate-900/80 hover:text-slate-50 hover:shadow-sm"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                isActive ? "bg-slate-800/40 text-white shadow-inner" : "text-slate-500 group-hover:text-teal-600 group-hover:scale-110"
              )}>
                <Icon size={19} />
              </div>
              <span className="font-bold text-sm hidden md:block tracking-tight">{item.label}</span>
              {isActive && (
                <div className="absolute right-2.5 w-1.5 h-1.5 bg-slate-900 rounded-full hidden md:block shadow-sm"></div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

