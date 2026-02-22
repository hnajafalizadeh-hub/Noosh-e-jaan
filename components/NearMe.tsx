
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types';
import { MapPin, Navigation, Star, Search, RefreshCw, Phone, ShieldCheck, Map, AlertCircle, Loader2, Crosshair } from 'lucide-react';

interface Props {
  onRestaurantClick?: (id: string) => void;
}

const NearMe: React.FC<Props> = ({ onRestaurantClick }) => {
  const [restaurants, setRestaurants] = useState<(Restaurant & { distance?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("مرورگر شما از قابلیت مکان‌یابی پشتیبانی نمی‌کند.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        fetchNearby(loc);
      },
      (err) => {
        let msg = "دسترسی به لوکیشن داده نشد. لطفاً GPS گوشی خود را روشن کنید.";
        if (err.code === 1) msg = "لطفاً اجازه دسترسی به لوکیشن را در مرورگر خود تایید کنید.";
        setError(msg);
        fetchNearby(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  const fetchNearby = async (loc: { lat: number, lng: number } | null) => {
    try {
      const { data } = await supabase.from('restaurants').select('*').eq('is_active', true);
      let list = (data || []) as (Restaurant & { distance?: number })[];
      if (loc) {
        list = list.map(r => ({
          ...r,
          distance: (r.lat && r.lng) ? calculateDistance(loc.lat, loc.lng, r.lat, r.lng) : undefined
        })).sort((a, b) => {
          if (a.distance === undefined) return 1;
          if (b.distance === undefined) return -1;
          return a.distance - b.distance;
        });
      }
      setRestaurants(list);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-in fade-in">
      <div className="relative">
         <Loader2 className="animate-spin text-orange-500" size={56} />
         <Crosshair className="absolute inset-0 m-auto text-orange-200" size={24} />
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-black text-gray-900">در حال دریافت لوکیشن...</p>
        <p className="text-[10px] font-bold text-gray-400">لطفاً اگر پیامی روی صفحه ظاهر شد، روی Allow کلیک کنید.</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4 pb-24" dir="rtl">
      <div className="flex justify-between items-center mb-2 px-2">
        <div>
          <h2 className="text-2xl font-black text-gray-900">اطراف من</h2>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">بر اساس نزدیک‌ترین فاصله به شما</p>
        </div>
        <button onClick={getLocation} className="p-3 bg-white text-orange-500 rounded-2xl shadow-sm border border-gray-100 active:scale-90 transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-orange-50 p-5 rounded-[2rem] border border-orange-100 flex items-start gap-3 animate-in shake duration-500">
           <AlertCircle size={20} className="text-orange-500 shrink-0 mt-0.5" />
           <div className="space-y-2">
              <p className="text-[11px] font-bold text-orange-800 leading-relaxed">{error}</p>
              <button onClick={getLocation} className="text-[10px] font-black text-orange-600 bg-white px-4 py-1.5 rounded-full border border-orange-100">تلاش مجدد</button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {restaurants.map((res) => (
          <div 
            key={res.id} 
            onClick={() => onRestaurantClick?.(res.id)} 
            className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 flex gap-4 items-center active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-black text-2xl overflow-hidden shrink-0 shadow-inner">
              {res.cover_image ? <img src={res.cover_image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : res.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-black text-sm text-gray-900 truncate">{res.name}</h3>
                <ShieldCheck size={14} className="text-blue-500 shrink-0" />
              </div>
              
              <div className="flex items-start gap-1 text-[10px] text-gray-400 font-bold mb-2">
                <MapPin size={10} className="text-orange-400 mt-0.5 shrink-0" />
                <span className="truncate">{res.city} {res.full_address ? `، ${res.full_address}` : ''}</span>
              </div>

              <div className="flex items-center gap-2">
                {res.distance !== undefined ? (
                  <div className="flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-full text-[9px] font-black text-orange-600 border border-orange-100">
                    <Navigation size={10} />
                    <span>{res.distance < 1 ? `${(res.distance * 1000).toFixed(0)} متر` : `${res.distance.toFixed(1)} کیلومتر`}</span>
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-gray-300 italic">فاصله نامشخص</div>
                )}
                
                {res.lat && res.lng && (
                   <div className="flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full text-[9px] font-black text-blue-600 border border-blue-100">
                      <Map size={10} />
                      <span>روی نقشه</span>
                   </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {restaurants.length === 0 && !loading && (
          <div className="text-center py-20 opacity-30">
            <MapPin size={48} className="mx-auto mb-2" />
            <p className="text-xs font-bold italic">رستورانی در نزدیکی شما یافت نشد.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NearMe;
