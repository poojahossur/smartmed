import React, { useState, useEffect } from "react";
import { Search, MapPin, Pill, Navigation, Phone, Clock, ShoppingBag, Loader2, Target, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { searchPharmacies } from "../services/medicineService";
import { cn } from "../lib/utils";

export default function MedicineFinder() {
  const [search, setSearch] = useState("");
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("Detecting location...");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationName("Location access denied");
        }
      );
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim() || !location) return;
    
    setLoading(true);
    try {
      const results = await searchPharmacies(search, location.lat, location.lng);
      setPharmacies(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = () => {
    setLocationName("Detecting...");
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationName(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Medicine Availability Finder</h1>
          <p className="text-slate-500">Find nearby pharmacies and check medicine stock in real-time.</p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Target size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Location</p>
            <p className="text-sm font-bold text-slate-700">{locationName}</p>
          </div>
          <button 
            onClick={detectLocation}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-blue-600"
          >
            <Navigation size={18} />
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Search and List */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
              placeholder="Search medicine name (e.g. Paracetamol)..."
            />
            {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />}
          </form>

          <div className="space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto pr-2 custom-scrollbar">
            {pharmacies.length > 0 ? (
              pharmacies.map((pharmacy, index) => (
                <motion.div 
                  key={pharmacy.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{pharmacy.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {pharmacy.address}
                      </p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      pharmacy.availability === 'In Stock' ? "bg-green-100 text-green-700" : 
                      pharmacy.availability === 'Low Stock' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                    )}>
                      {pharmacy.availability}
                    </div>
                  </div>
                  
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                        <Navigation size={14} className="text-blue-500" /> {pharmacy.distance}
                      </span>
                      <div className="flex gap-2">
                        {pharmacy.mapsUrl && (
                          <a 
                            href={pharmacy.mapsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <p className="text-slate-400">No pharmacies found for this medicine.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map View */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden relative min-h-[500px]">
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4 animate-pulse">
                <MapPin size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Interactive Map View</h3>
              <p className="text-slate-500 max-w-xs mx-auto mb-6">Visualizing nearby pharmacies with real-time stock indicators.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div> In Stock
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div> Low Stock
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div> Out of Stock
                </div>
              </div>
            </div>
          </div>
          
          {/* Simulated Map Markers */}
          {pharmacies.map((p, i) => (
            <motion.div 
              key={p.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.2 }}
              className={cn(
                "absolute w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 cursor-pointer hover:scale-110 transition-transform",
                p.availability === 'In Stock' ? "border-green-500" : p.availability === 'Low Stock' ? "border-orange-500" : "border-red-500"
              )}
              style={{ 
                top: `${20 + (i * 15)}%`, 
                left: `${30 + (i * 20)}%` 
              }}
            >
              <Pill size={20} className={cn(
                p.availability === 'In Stock' ? "text-green-600" : p.availability === 'Low Stock' ? "text-orange-600" : "text-red-600"
              )} />
            </motion.div>
          ))}
          
          <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                <Navigation size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Your Location</p>
                <p className="text-sm font-bold text-slate-900">{locationName}</p>
              </div>
            </div>
            <button 
              onClick={detectLocation}
              className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Clock size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
