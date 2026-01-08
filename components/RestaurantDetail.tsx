
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, MenuItem, MenuCategoryDef, Post, Profile } from '../types';
import { 
  ArrowRight, MapPin, Phone, Star, 
  Utensils, DollarSign, Car, Sparkles, Share2,
  Clock, ShieldCheck, CookingPot, Soup, Beef, Zap, 
  Pizza, ChefHat, Drumstick, GlassWater, CakeSlice,
  ChevronLeft, ChevronRight, Loader2, Map, Tag,
  MessageCircle, User, Heart, ChevronDown, Send, CheckCircle2, AlertCircle
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
  { key: 'dessert', title_fa: 'دسر', icon_name: 'CakeSlice' },
  { key: 'other', title_fa: 'سایر', icon_name: 'Utensils' },
];

const RestaurantDetail: React.FC<Props> = ({ restaurantId, onBack, onPostClick }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailedRatings, setDetailedRatings] = useState({
    avg: 0,
    food: 0,
    price: 0,
    parking: 0,
    ambiance: 0,
    count: 0
  });

  // User and Review State
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
        
        // Check if current user has already posted a review for this restaurant
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
        photo_url: '' // No photo for quick review
      }]);

      if (error) throw error;
      
      setReviewText('');
      setHasUserReviewed(true);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const isCurrentlyOpen = () => {
    if (!restaurant?.working_hours) return true;
    try {
      const [start, end] = restaurant.working_hours.split('-');
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const startTime = sH * 60 + sM;
      const endTime = eH * 60 + eM;
      if (endTime < startTime) { return current >= startTime || current <= endTime; }
      return current >= startTime && current <= endTime;
    } catch (e) { return true; }
  };

  const isOpen = isCurrentlyOpen();
  const filteredItems = menuItems.filter(i => i.category_key === selectedCategory);

  const RatingStars = ({ label, val, setVal, icon: Icon }: any) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-[10px] font-black text-gray-500">
        <Icon size={14} className="text-orange-400" /> {label}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button 
            key={n} 
            disabled={hasUserReviewed}
            onClick={() => setVal(n)}
            className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${val >= n ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-300'} ${hasUserReviewed ? 'opacity-50' : ''}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return <div className="p-20 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

  return (
    <div className="bg-white min-h-screen pb-24" dir="rtl">
      {/* Header Image & Info */}
      <div className="h-72 relative">
        {restaurant?.cover_image ? <img src={restaurant.cover_image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-300"><Utensils size={64}/></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
        <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white backdrop-blur-sm"><ArrowRight size={24}/></button>
        <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-xl text-[10px] font-black border backdrop-blur-md shadow-lg flex items-center gap-1.5 ${isOpen ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}><Clock size={12} /> {isOpen ? 'باز است' : 'اتمام ساعت کار'}</div>
        <div className="absolute bottom-6 right-6 left-6 text-white flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black mb-2">{restaurant?.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold opacity-90">
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><MapPin size={14} className="text-orange-400" /> {restaurant?.city}</span>
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"><Star size={14} className="text-yellow-400 fill-current" /> {detailedRatings.avg.toFixed(1)} ({detailedRatings.count} شکمو)</span>
            </div>
          </div>
          {restaurant?.logo_url && (<div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-2xl border-2 border-white/20"><img src={restaurant.logo_url} className="w-full h-full object-cover rounded-xl" /></div>)}
        </div>
      </div>

      {/* Action Buttons & Detailed Ratings */}
      <div className="px-6 -mt-4 relative z-10 space-y-4">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-50 grid grid-cols-2 gap-4">
           {restaurant?.phone && (<a href={`tel:${restaurant.phone}`} className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 group transition-all"><div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm group-active:scale-90 transition-transform"><Phone size={18}/></div><div><p className="text-[8px] font-black text-blue-400 uppercase">تماس</p><p className="text-[10px] font-black text-blue-900" dir="ltr">{restaurant.phone}</p></div></a>)}
           {restaurant?.lat && restaurant?.lng && (<a href={`https://www.google.com/maps?q=${restaurant.lat},${restaurant.lng}`} target="_blank" className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100 group transition-all"><div className="p-2 bg-white rounded-xl text-orange-600 shadow-sm group-active:scale-90 transition-transform"><Map size={18}/></div><div><p className="text-[8px] font-black text-orange-400 uppercase">مسیریابی</p><p className="text-[10px] font-black text-orange-900">روی نقشه</p></div></a>)}
           
           {/* Detailed Ratings Breakdown */}
           <div className="col-span-2 bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl text-orange-500 shadow-sm"><Utensils size={14}/></div>
                 <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400">کیفیت غذا</p>
                    <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                       <div className="h-full bg-orange-500" style={{ width: `${(detailedRatings.food / 5) * 100}%` }}></div>
                    </div>
                 </div>
                 <span className="text-[11px] font-black text-gray-700">{detailedRatings.food.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl text-orange-500 shadow-sm"><DollarSign size={14}/></div>
                 <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400">ارزش قیمت</p>
                    <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                       <div className="h-full bg-orange-500" style={{ width: `${(detailedRatings.price / 5) * 100}%` }}></div>
                    </div>
                 </div>
                 <span className="text-[11px] font-black text-gray-700">{detailedRatings.price.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl text-orange-500 shadow-sm"><Car size={14}/></div>
                 <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400">جای پارک</p>
                    <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                       <div className="h-full bg-orange-500" style={{ width: `${(detailedRatings.parking / 5) * 100}%` }}></div>
                    </div>
                 </div>
                 <span className="text-[11px] font-black text-gray-700">{detailedRatings.parking.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl text-orange-500 shadow-sm"><Sparkles size={14}/></div>
                 <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400">اتمسفر و فضا</p>
                    <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                       <div className="h-full bg-orange-500" style={{ width: `${(detailedRatings.ambiance / 5) * 100}%` }}></div>
                    </div>
                 </div>
                 <span className="text-[11px] font-black text-gray-700">{detailedRatings.ambiance.toFixed(1)}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Menu Navigation */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 py-6 mt-6 border-b border-gray-100">
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

      {/* Menu List */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-black text-gray-900">{CATEGORIES.find(c => c.key === selectedCategory)?.title_fa || 'لیست غذاها'}</h3>
           <span className="text-[10px] font-black text-gray-400">{filteredItems.length} غذا</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex items-center p-4 gap-4 active:scale-95 transition-transform duration-200">
              <div className="w-24 h-24 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 shrink-0 overflow-hidden relative">
                {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <Utensils size={24} />}
                {item.discount_price && item.discount_price > 0 && (
                   <div className="absolute top-1 right-1 bg-red-500 text-white px-1.5 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-0.5 shadow-sm">
                      <Tag size={8}/> تخفیف
                   </div>
                )}
              </div>
              <div className="flex-1 flex flex-col h-24 justify-center">
                <h4 className="font-black text-sm text-gray-900 mb-0.5">{item.name}</h4>
                <p className="text-[9px] font-bold text-gray-400 line-clamp-1 mb-2">{item.description || "توضیحی ثبت نشده است."}</p>
                <div className="flex items-center gap-3">
                   {item.discount_price && item.discount_price > 0 ? (
                     <>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-bold text-gray-300 line-through mb-0.5">{item.price.toLocaleString()}</span>
                           <span className="text-sm font-black text-orange-600">{item.discount_price.toLocaleString()} <span className="text-[8px]">تومان</span></span>
                        </div>
                        <div className="bg-orange-50 px-2 py-1 rounded-lg text-orange-600 text-[9px] font-black mr-auto border border-orange-100">
                           {Math.round(((item.price - item.discount_price) / item.price) * 100)}٪ تخفیف
                        </div>
                     </>
                   ) : (
                     <span className="text-sm font-black text-orange-600">{item.price.toLocaleString()} <span className="text-[8px]">تومان</span></span>
                   )}
                </div>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && <div className="w-full py-10 text-center text-gray-400 italic text-xs font-bold">در این دسته غذایی یافت نشد.</div>}
        </div>
      </div>

      {/* Quick Rating Form */}
      <div className="p-6 mt-8">
         <div className="bg-white rounded-[2.5rem] border-2 border-orange-100 p-6 space-y-4 shadow-xl shadow-orange-50/50 relative">
            <h3 className="font-black text-gray-900 flex items-center gap-2">
               <Star size={18} className="text-orange-500 fill-current" /> ثبت تجربه سریع شما
            </h3>
            <p className="text-[10px] font-bold text-gray-400 leading-relaxed">بدون نیاز به عکس، فقط امتیاز و نظر خود را ثبت کنید تا روی امتیاز کلی پاتوق تاثیر بگذارد.</p>
            
            {hasUserReviewed ? (
               <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex flex-col items-center gap-3 text-center animate-in zoom-in-95">
                  <div className="bg-white p-3 rounded-full text-orange-500 shadow-sm">
                     <CheckCircle2 size={32} />
                  </div>
                  <p className="text-xs font-black text-orange-800">شما قبلاً تجربه خود را برای این پاتوق ثبت کرده‌اید.</p>
                  <p className="text-[10px] font-bold text-orange-400">هر کاربر فقط یک بار می‌تواند برای هر رستوران نظر ثبت کند.</p>
               </div>
            ) : (
               <>
                  <div className="bg-gray-50 rounded-2xl p-4 divide-y divide-gray-100">
                     <RatingStars label="طعم و کیفیت" val={qFood} setVal={setQFood} icon={Utensils} />
                     <RatingStars label="ارزش خرید" val={qPrice} setVal={setQPrice} icon={DollarSign} />
                     <RatingStars label="سهولت پارک" val={qPark} setVal={setQPark} icon={Car} />
                     <RatingStars label="اتمسفر پاتوق" val={qAmb} setVal={setQAmb} icon={Sparkles} />
                  </div>

                  <textarea 
                     value={reviewText}
                     onChange={e => setReviewText(e.target.value)}
                     className="w-full p-4 bg-gray-50 border border-transparent focus:border-orange-200 rounded-2xl text-xs font-bold outline-none transition-all min-h-[100px]" 
                     placeholder="تجربه خود را در چند کلمه بنویسید..."
                  />

                  <button 
                     onClick={handleSubmitQuickReview}
                     disabled={submittingReview || !reviewText.trim()}
                     className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-100 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                     {submittingReview ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18}/> ثبت امتیاز و نظر</>}
                  </button>
               </>
            )}
            
            {showSuccess && (
               <div className="flex items-center justify-center gap-2 text-green-600 text-[10px] font-black animate-in zoom-in-95 mt-4">
                  <CheckCircle2 size={14} /> نظر شما با موفقیت ثبت شد!
               </div>
            )}
         </div>
      </div>

      {/* Experiences Section - Who Rated */}
      <div className="p-6 bg-gray-50 mt-8">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-900 flex items-center gap-2">
               <MessageCircle size={18} className="text-orange-500" /> تجربه‌های شکموها
            </h3>
            <span className="text-[10px] font-black text-gray-400">{detailedRatings.count} نظر</span>
         </div>

         <div className="space-y-4">
            {posts.map(post => (
               <div 
                  key={post.id} 
                  onClick={() => onPostClick?.(post.id)}
                  className={`bg-white p-4 rounded-[2rem] border shadow-sm flex gap-4 active:scale-[0.98] transition-all cursor-pointer ${post.user_id === currentUserId ? 'border-orange-200 ring-2 ring-orange-500/5' : 'border-gray-100'}`}
               >
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center overflow-hidden shrink-0 border border-orange-50">
                     {post.profiles?.avatar_url ? (
                        <img src={post.profiles.avatar_url} className="w-full h-full object-cover" />
                     ) : (
                        <User className="text-orange-500" size={24} />
                     )}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-1">
                        <p className="text-[11px] font-black text-gray-900 flex items-center gap-1">
                           @{post.profiles?.username}
                           {post.user_id === currentUserId && <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md">نظر شما</span>}
                        </p>
                        <div className="flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-lg text-orange-600 text-[9px] font-black">
                           <Star size={10} fill="currentColor" /> {post.rating.toFixed(1)}
                        </div>
                     </div>
                     <p className="text-[10px] font-bold text-gray-500 line-clamp-2 leading-relaxed">{post.caption}</p>
                     <div className="flex gap-4 mt-3 opacity-60">
                        <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400">
                           <Heart size={10} /> {post.likes?.length || 0} لایک
                        </div>
                        <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400">
                           <MessageCircle size={10} /> {post.comments?.length || 0} نظر
                        </div>
                     </div>
                  </div>
                  {post.photo_url ? (
                     <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-sm">
                        <img src={post.photo_url} className="w-full h-full object-cover" />
                     </div>
                  ) : (
                     <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-200 shrink-0 border border-gray-100">
                        <Utensils size={14} />
                     </div>
                  )}
               </div>
            ))}

            {posts.length === 0 && (
               <div className="text-center py-10 opacity-20">
                  <Star size={40} className="mx-auto mb-2" />
                  <p className="text-[10px] font-bold italic">هنوز کسی تجربه‌اش را در پاتوق ثبت نکرده است.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
