
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, MenuItem, MenuCategoryDef, Post, Profile } from '../types';
import { 
  ArrowRight, MapPin, Phone, Star, 
  Utensils, DollarSign, Car, Sparkles, Share2,
  Clock, ShieldCheck, CookingPot, Soup, Beef, Zap, 
  Pizza, ChefHat, Drumstick, GlassWater, CakeSlice,
  ChevronLeft, ChevronRight, Loader2, Map, Tag,
  MessageCircle, User, Heart, ChevronDown, Send, CheckCircle2, AlertCircle, X, Trash2, Edit3
} from 'lucide-react';

interface Props {
  restaurantId: string;
  onBack: () => void;
  onPostClick?: (id: string) => void;
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
  { key: 'dessert', title_fa: 'پیش غذا', icon_name: 'CakeSlice' },
  { key: 'other', title_fa: 'سایر', icon_name: 'Utensils' },
];

const RestaurantDetail: React.FC<Props> = ({ restaurantId, onBack, onPostClick }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [detailedRatings, setDetailedRatings] = useState({
    avg: 0,
    food: 0,
    price: 0,
    parking: 0,
    ambiance: 0,
    count: 0
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasUserReviewed, setHasUserReviewed] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [qFood, setQFood] = useState(5);
  const [qPrice, setQPrice] = useState(5);
  const [qPark, setQPark] = useState(5);
  const [qAmb, setQAmb] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uId = user?.id || null;

      const [restRes, menuRes, postsRes] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
        supabase.from('posts').select('*, profiles(*)').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (menuRes.data) {
        setMenuItems(menuRes.data);
        const firstCat = CATEGORIES.find(c => menuRes.data.some((i: any) => i.category_key === c.key));
        if (firstCat) setSelectedCategory(firstCat.key);
      }
      if (postsRes.data) {
        setPosts(postsRes.data as any);
        const count = postsRes.data.length;
        if (uId) {
          const alreadyReviewed = postsRes.data.some((p: any) => p.user_id === uId);
          setHasUserReviewed(alreadyReviewed);
        }
        if (count > 0) {
          const sum = (key: keyof Post) => postsRes.data.reduce((acc, p) => acc + (Number(p[key]) || 0), 0);
          setDetailedRatings({
            avg: sum('rating') / count,
            food: sum('rating_food') / count,
            price: sum('rating_price') / count,
            parking: sum('rating_parking') / count,
            ambiance: sum('rating_ambiance') / count,
            count
          });
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmitQuickReview = async () => {
    if (!reviewText.trim() || hasUserReviewed) return;
    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('لطفاً وارد شوید');
      const avg = (qFood + qPrice + qPark + qAmb) / 4;
      const { error } = await supabase.from('posts').insert([{
        user_id: user.id,
        restaurant_id: restaurantId,
        caption: reviewText,
        rating: avg,
        rating_food: qFood,
        rating_price: qPrice,
        rating_parking: qPark,
        rating_ambiance: qAmb,
        photo_url: '' 
      }]);
      if (error) throw error;
      setReviewText('');
      setHasUserReviewed(true);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) { alert(e.message); } finally { setSubmittingReview(false); }
  };

  const isOpen = (() => {
    if (!restaurant?.working_hours) return true;
    try {
      const [start, end] = restaurant.working_hours.split('-');
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const startTime = sH * 60 + sM;
      const endTime = eH * 60 + eM;
      if (endTime < startTime) return current >= startTime || current <= endTime;
      return current >= startTime && current <= endTime;
    } catch (e) { return true; }
  })();

  const filteredItems = menuItems.filter(i => i.category_key === selectedCategory);

  const RatingStars = ({ label, val, setVal, icon: Icon }: any) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-[10px] font-black text-gray-500"><Icon size={14} className="text-orange-400" /> {label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} disabled={hasUserReviewed} onClick={() => setVal(n)} className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${val >= n ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-300'} ${hasUserReviewed ? 'opacity-50' : ''}`}>{n}</button>
        ))}
      </div>
    </div>
  );

  if (loading) return <div className="p-20 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

  return (
    <div className="bg-white min-screen pb-24" dir="rtl">
      <div className="h-72 relative">
        {restaurant?.cover_image ? <img src={restaurant.cover_image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-300"><Utensils size={64}/></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
        <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white backdrop-blur-sm"><ArrowRight size={24}/></button>
        <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-xl text-[10px] font-black border backdrop-blur-md shadow-lg flex items-center gap-1.5 ${isOpen ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}><Clock size={12} /> {isOpen ? 'باز است' : 'اتمام ساعت کار'}</div>
        <div className="absolute bottom-6 right-6 left-6 text-white flex justify-between items-end">
          <div><h1 className="text-3xl font-black mb-2">{restaurant?.name}</h1><div className="flex flex-wrap items-center gap-3 text-[11px] font-bold opacity-90"><span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><MapPin size={14} className="text-orange-400" /> {restaurant?.city}</span><span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><Star size={14} className="text-yellow-400 fill-current" /> {detailedRatings.avg.toFixed(1)} ({detailedRatings.count} شکمو)</span></div></div>
          {restaurant?.logo_url && (<div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-2xl border-2 border-white/20"><img src={restaurant.logo_url} className="w-full h-full object-cover rounded-xl" /></div>)}
        </div>
      </div>
      <div className="px-6 -mt-4 relative z-10 space-y-4">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-100 grid grid-cols-2 gap-4">
           {restaurant?.phone && (<a href={`tel:${restaurant.phone}`} className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 group transition-all"><div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm group-active:scale-90 transition-transform"><Phone size={18}/></div><div><p className="text-[8px] font-black text-blue-400 uppercase">تماس</p><p className="text-[10px] font-black text-blue-900" dir="ltr">{restaurant.phone}</p></div></a>)}
           {restaurant?.lat && restaurant?.lng && (<a href={`https://www.google.com/maps?q=${restaurant.lat},${restaurant.lng}`} target="_blank" className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100 group transition-all"><div className="p-2 bg-white rounded-xl text-orange-600 shadow-sm group-active:scale-90 transition-transform"><Map size={18}/></div><div><p className="text-[8px] font-black text-orange-400 uppercase">مسیریابی</p><p className="text-[10px] font-black text-orange-900">روی نقشه</p></div></a>)}
        </div>
      </div>
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 py-6 mt-6 border-b border-gray-100">
        <div className="overflow-x-auto flex gap-6 px-6 no-scrollbar">
          {CATEGORIES.map(cat => {
            const Icon = CATEGORY_MAP[cat.icon_name];
            if (!menuItems.some(i => i.category_key === cat.key)) return null;
            return (
              <button key={cat.key} onClick={() => setSelectedCategory(cat.key)} className={`flex flex-col items-center gap-2 min-w-[60px] transition-all duration-300 ${selectedCategory === cat.key ? 'scale-110' : 'opacity-40 grayscale'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${selectedCategory === cat.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={24} /></div>
                <span className={`text-[10px] font-black ${selectedCategory === cat.key ? 'text-orange-600' : 'text-gray-400'}`}>{cat.title_fa}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6"><h3 className="font-black text-gray-900">{CATEGORIES.find(c => c.key === selectedCategory)?.title_fa || 'لیست غذاها'}</h3><span className="text-[10px] font-black text-gray-400">{filteredItems.length} غذا</span></div>
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => setSelectedMenuItem(item)}
              className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex items-center p-4 gap-4 active:scale-95 transition-transform duration-200 cursor-pointer"
            >
              <div className="w-24 h-24 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 shrink-0 overflow-hidden relative">
                {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <Utensils size={24} />}
              </div>
              <div className="flex-1 flex flex-col h-24 justify-center">
                <h4 className="font-black text-sm text-gray-900 mb-0.5">{item.name}</h4>
                <p className="text-[9px] font-bold text-gray-400 line-clamp-1 mb-2">{item.description || "توضیحی ثبت نشده است."}</p>
                <span className="text-sm font-black text-orange-600">{(item.discount_price || item.price).toLocaleString()} تومان</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ratings and Reviews Section */}
      <div className="p-6 space-y-8 bg-gray-50 dark:bg-dark-bg mt-8">
        <div className="flex justify-between items-center">
           <h3 className="font-black text-xl text-gray-900 dark:text-white">نظرات و امتیازها</h3>
           <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-2xl">
              <Star size={16} className="fill-current" />
              <span className="text-sm font-black">{detailedRatings.avg.toFixed(1)}</span>
           </div>
        </div>

        {/* Detailed Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white dark:bg-dark-card p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col items-center gap-2">
              <Utensils size={20} className="text-orange-500" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">کیفیت طعم</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{detailedRatings.food.toFixed(1)}</span>
           </div>
           <div className="bg-white dark:bg-dark-card p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col items-center gap-2">
              <DollarSign size={20} className="text-orange-500" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">ارزش قیمت</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{detailedRatings.price.toFixed(1)}</span>
           </div>
           <div className="bg-white dark:bg-dark-card p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col items-center gap-2">
              <Car size={20} className="text-orange-500" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">جای پارک</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{detailedRatings.parking.toFixed(1)}</span>
           </div>
           <div className="bg-white dark:bg-dark-card p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col items-center gap-2">
              <Sparkles size={20} className="text-orange-500" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">محیط و فضا</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{detailedRatings.ambiance.toFixed(1)}</span>
           </div>
        </div>

        {/* Submit Review Form */}
        {!hasUserReviewed ? (
          <div className="bg-white dark:bg-dark-card p-6 rounded-[2.5rem] border-2 border-orange-500/20 shadow-xl space-y-6">
             <div className="flex items-center gap-3 text-orange-600">
                <Send size={20} />
                <h4 className="font-black text-sm">تجربه خود را ثبت کنید</h4>
             </div>
             
             <div className="space-y-1 divide-y divide-gray-50 dark:divide-dark-border">
                <RatingStars label="کیفیت طعم و غذا" val={qFood} setVal={setQFood} icon={Utensils} />
                <RatingStars label="تناسب قیمت به حجم" val={qPrice} setVal={setQPrice} icon={DollarSign} />
                <RatingStars label="سهولت در جای پارک" val={qPark} setVal={setQPark} icon={Car} />
                <RatingStars label="محیط، دکور و اتمسفر" val={qAmb} setVal={setQAmb} icon={Sparkles} />
             </div>

             <textarea 
               className="w-full p-4 bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
               placeholder="نظر شکم‌گردی شما در مورد این پاتوق..."
               value={reviewText}
               onChange={(e) => setReviewText(e.target.value)}
             />

             <button 
               onClick={handleSubmitQuickReview}
               disabled={submittingReview || !reviewText.trim()}
               className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-orange-100 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
             >
                {submittingReview ? <Loader2 className="animate-spin" size={20} /> : 'ثبت امتیاز و نظر'}
             </button>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-500/20 p-6 rounded-[2.5rem] text-center space-y-2">
             <CheckCircle2 size={32} className="text-green-500 mx-auto" />
             <h4 className="font-black text-sm text-green-900 dark:text-green-400">شما نظر خود را ثبت کرده‌اید</h4>
             <p className="text-[10px] font-bold text-green-600 opacity-70">ممنون که به بقیه شکموها کمک می‌کنی!</p>
          </div>
        )}

        {/* Success Feedback Overlay */}
        {showSuccess && (
           <div className="fixed inset-x-6 top-20 z-50 bg-green-600 text-white p-4 rounded-2xl text-center font-black text-xs animate-in slide-in-from-top-4 shadow-2xl">
              امتیاز شما با موفقیت ثبت شد!
           </div>
        )}

        {/* Existing Reviews List */}
        <div className="space-y-4 pt-4">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
              <MessageCircle size={14} className="text-orange-500" /> تجربیات دیگر شکموها:
           </p>
           {posts.length === 0 ? (
             <div className="text-center py-10 opacity-20">
                <Utensils size={40} className="mx-auto mb-2" />
                <p className="text-xs font-bold">هنوز تجربه‌ای ثبت نشده است.</p>
             </div>
           ) : (
             <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} onClick={() => onPostClick?.(post.id)} className="bg-white dark:bg-dark-card p-5 rounded-[2rem] border border-gray-100 dark:border-dark-border shadow-sm space-y-3 cursor-pointer active:scale-[0.98] transition-all">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-dark-bg flex items-center justify-center overflow-hidden">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <User className="text-orange-500" size={20} />}
                           </div>
                           <div>
                              <p className="text-[11px] font-black text-gray-900 dark:text-white">@{post.profiles?.username}</p>
                              <p className="text-[8px] font-bold text-gray-400">{new Date(post.created_at).toLocaleDateString('fa-IR')}</p>
                           </div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-xl text-orange-600 flex items-center gap-1">
                           <Star size={12} className="fill-current" />
                           <span className="text-xs font-black">{post.rating.toFixed(1)}</span>
                        </div>
                     </div>
                     <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">
                        {post.caption}
                     </p>
                     {post.photo_url && (
                        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
                           <img src={Array.isArray(post.photo_urls) ? post.photo_urls[0] : post.photo_url} className="w-full h-full object-cover" />
                        </div>
                     )}
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>

      {/* Menu Item Detail Modal */}
      {selectedMenuItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setSelectedMenuItem(null)}>
           <div className="bg-white dark:bg-dark-card rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="relative aspect-square">
                 {selectedMenuItem.image_url ? (
                   <img src={selectedMenuItem.image_url} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-orange-50 dark:bg-dark-bg flex items-center justify-center text-orange-200">
                      <Utensils size={64} />
                   </div>
                 )}
                 <button 
                   onClick={() => setSelectedMenuItem(null)}
                   className="absolute top-4 right-4 p-2 bg-black/30 text-white rounded-full backdrop-blur-md"
                 >
                    <X size={20} />
                 </button>
              </div>
              <div className="p-8 space-y-4">
                 <div className="flex justify-between items-start">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">{selectedMenuItem.name}</h3>
                    <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-2xl border border-orange-100 dark:border-orange-500/20">
                       <span className="text-sm font-black text-orange-600">{(selectedMenuItem.discount_price || selectedMenuItem.price).toLocaleString()} <span className="text-[10px]">تومان</span></span>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Tag size={12} className="text-orange-500" /> توضیحات غذا:
                    </p>
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-dark-bg p-4 rounded-2xl border border-gray-100 dark:border-dark-border">
                       {selectedMenuItem.description || "توضیحی برای این آیتم ثبت نشده است."}
                    </p>
                 </div>
                 <button 
                   onClick={() => setSelectedMenuItem(null)}
                   className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs active:scale-95 transition-all shadow-xl shadow-orange-100 dark:shadow-none"
                 >
                    بستن جزئیات
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDetail;
