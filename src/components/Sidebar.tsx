import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Pill, Search, ShieldCheck, ClipboardList, Info, HelpCircle, Mail } from "lucide-react";
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
      label: 'Medicine Finder', 
      icon: Search, 
      path: '/medicine-finder',
      show: true 
    },
    { 
      label: 'Safe Substitutions', 
      icon: ShieldCheck, 
      path: '/substitution',
      show: true 
    },
    { 
      label: 'System Logs', 
      icon: ClipboardList, 
      path: '/logs',
      show: true 
    },
    { label: 'divider', show: true },
    { label: 'About Us', icon: Info, path: '/about', show: true },
    { label: 'Contact', icon: Mail, path: '/contact', show: true },
    { label: 'FAQ', icon: HelpCircle, path: '/faq', show: true },
  ];

  return (
    <aside className="w-20 md:w-64 bg-white border-r border-slate-200 min-h-[calc(100-4rem)] sticky top-16 hidden sm:block">
      <div className="p-4 space-y-2">
        {menuItems.map((item, index) => {
          if (!item.show) return null;
          if (item.label === 'divider') return <hr key={index} className="my-4 border-slate-100" />;
          
          const Icon = item.icon!;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path!}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all group",
                isActive 
                  ? "bg-blue-50 text-blue-600" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon size={22} className={cn(isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
              <span className="font-medium hidden md:block">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
