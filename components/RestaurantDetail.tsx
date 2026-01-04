
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, MenuItem, MenuCategoryDef, Post } from '../types';
import { 
  ArrowRight, MapPin, Phone, Star, 
  Utensils, DollarSign, Car, Sparkles, Share2,
  Clock, ShieldCheck, CookingPot, Soup, Beef, Zap, 
  Pizza, ChefHat, Drumstick, GlassWater, CakeSlice,
  ChevronLeft, ChevronRight, Loader2, Map
} from 'lucide-react';

interface Props {
  restaurantId: string;
  onBack: () => void;
}

const CATEGORY_MAP: Record<string, any> = {
  CookingPot: CookingPot,
  Soup: Soup,
  Beef: Beef,
  Zap: Zap,
  Pizza: Pizza,
  ChefHat: ChefHat,
  Drumstick: Drumstick,
  GlassWater: GlassWater,
  CakeSlice: CakeSlice,
  Utensils: Utensils
};

const CATEGORIES: MenuCategoryDef[] = [
  { key: 'cheloei', title_fa: 'چلویی', icon_name: 'CookingPot' },
  { key: 'khoresht', title_fa: 'خورشت', icon_name: 'Soup' },
  { key: 'khorak', title_fa: 'خوراک', icon_name: 'Beef' },
  { key: 'fastfood', title_fa: 'فست فود', icon_name: 'Zap' },
  { key: 'pizza', title_fa: 'پیتزا', icon_name: 'Pizza' },
  { key: 'burger', title_fa: 'همبرگر', icon_name: 'ChefHat' },
  { key: 'fried', title_fa: 'سوخاری', icon_name: 'Drumstick' },
  { key: 'drink', title_fa: 'نوشیدنی', icon_name: 'GlassWater' },
  { key: 'dessert', title_fa: 'دسر', icon_name: 'CakeSlice' },
  { key: 'other', title_fa: 'سایر', icon_name: 'Utensils' },
];

const RestaurantDetail: React.FC<Props> = ({ restaurantId, onBack }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [stats, setStats] = useState({ avg: 0, count: 0 });

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      const [restRes, menuRes, postsRes] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
        supabase.from('posts').select('rating').eq('restaurant_id', restaurantId)
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (menuRes.data) {
        setMenuItems(menuRes.data);
        const firstCat = CATEGORIES.find(c => menuRes.data.some((i: any) => i.category_key === c.key));
        if (firstCat) setSelectedCategory(firstCat.key);
      }
      if (postsRes.data && postsRes.data.length > 0) {
        const sum = postsRes.data.reduce((acc, p) => acc + (p.rating || 0), 0);
        setStats({ avg: sum / postsRes.data.length, count: postsRes.data.length });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const isCurrentlyOpen = () => {
    if (!restaurant?.working_hours) return true; // اگر تنظیم نشده بود، فرض بر باز بودن
    try {
      const [start, end] = restaurant.working_hours.split('-');
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      
      const startTime = sH * 60 + sM;
      const endTime = eH * 60 + eM;
      
      // مدیریت ساعت‌های بعد از نیمه‌شب
      if (endTime < startTime) {
        return current >= startTime || current <= endTime;
      }
      return current >= startTime && current <= endTime;
    } catch (e) { return true; }
  };

  const isOpen = isCurrentlyOpen();
  const filteredItems = menuItems.filter(i => i.category_key === selectedCategory);

  if (loading) return <div className="p-20 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

  return (
    <div className="bg-white min-h-screen pb-24" dir="rtl">
      {/* Header */}
      <div className="h-72 relative">
        {restaurant?.cover_image ? (
          <img src={restaurant.cover_image} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-300"><Utensils size={64}/></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
        <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white backdrop-blur-sm"><ArrowRight size={24}/></button>
        
        {/* Status Badge */}
        <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-xl text-[10px] font-black border backdrop-blur-md shadow-lg flex items-center gap-1.5 ${isOpen ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
           <Clock size={12} /> {isOpen ? 'باز است' : 'اتمام ساعت کار'}
        </div>

        <div className="absolute bottom-6 right-6 left-6 text-white flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black mb-2">{restaurant?.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold opacity-90">
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><MapPin size={14} className="text-orange-400" /> {restaurant?.city}</span>
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><Star size={14} className="text-yellow-400 fill-current" /> {stats.avg.toFixed(1)} ({stats.count} تجربه)</span>
              {restaurant?.working_hours && <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><Clock size={14} className="text-blue-400" /> {restaurant.working_hours}</span>}
            </div>
          </div>
          {restaurant?.logo_url && (
            <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-2xl border-2 border-white/20">
               <img src={restaurant.logo_url} className="w-full h-full object-cover rounded-xl" />
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="px-6 -mt-4 relative z-10">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-50 grid grid-cols-2 gap-4">
           {restaurant?.phone && (
             <a href={`tel:${restaurant.phone}`} className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 group transition-all">
                <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm group-active:scale-90 transition-transform"><Phone size={18}/></div>
                <div><p className="text-[8px] font-black text-blue-400 uppercase">تماس</p><p className="text-[10px] font-black text-blue-900" dir="ltr">{restaurant.phone}</p></div>
             </a>
           )}
           {restaurant?.lat && restaurant?.lng && (
             <a href={`https://www.google.com/maps?q=${restaurant.lat},${restaurant.lng}`} target="_blank" className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100 group transition-all">
                <div className="p-2 bg-white rounded-xl text-orange-600 shadow-sm group-active:scale-90 transition-transform"><Map size={18}/></div>
                <div><p className="text-[8px] font-black text-orange-400 uppercase">مسیریابی</p><p className="text-[10px] font-black text-orange-900">روی نقشه</p></div>
             </a>
           )}
           {restaurant?.full_address && (
             <div className="col-span-2 flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <MapPin size={16} className="text-gray-400 shrink-0 mt-1" />
                <p className="text-[10px] font-bold text-gray-500 leading-relaxed">{restaurant.full_address}</p>
             </div>
           )}
        </div>
      </div>

      {/* Category Bar */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 py-6 mt-4 border-b border-gray-100">
        <div className="overflow-x-auto flex gap-6 px-6 no-scrollbar">
          {CATEGORIES.map(cat => {
            const Icon = CATEGORY_MAP[cat.icon_name];
            const hasItems = menuItems.some(i => i.category_key === cat.key);
            if (!hasItems) return null;
            return (
              <button key={cat.key} onClick={() => setSelectedCategory(cat.key)} className={`flex flex-col items-center gap-2 min-w-[60px] transition-all duration-300 ${selectedCategory === cat.key ? 'scale-110' : 'opacity-40 grayscale'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${selectedCategory === cat.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={24} /></div>
                <span className={`text-[10px] font-black ${selectedCategory === cat.key ? 'text-orange-600' : 'text-gray-400'}`}>{cat.title_fa}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-black text-gray-900">{CATEGORIES.find(c => c.key === selectedCategory)?.title_fa || 'لیست غذاها'}</h3>
           <span className="text-[10px] font-black text-gray-400">{filteredItems.length} غذا</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar">
          {filteredItems.map(item => (
            <div key={item.id} className="min-w-[240px] max-w-[240px] bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col active:scale-95 transition-transform duration-200">
              <div className="h-32 bg-gray-50 flex items-center justify-center text-gray-200 relative">
                {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <Utensils size={32} />}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-gray-100"><span className="text-[10px] font-black text-orange-600">{item.price.toLocaleString()} تومان</span></div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h4 className="font-black text-sm text-gray-900 mb-1">{item.name}</h4>
                <p className="text-[10px] font-bold text-gray-400 line-clamp-2 leading-relaxed mb-4 flex-1">{item.description || "توضیحی برای این غذا ثبت نشده است."}</p>
                <button className="w-full py-2.5 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black hover:bg-orange-500 hover:text-white transition-colors">افزودن به سبد</button>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && <div className="w-full py-10 text-center text-gray-400 italic text-xs font-bold">در این دسته غذایی یافت نشد.</div>}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
