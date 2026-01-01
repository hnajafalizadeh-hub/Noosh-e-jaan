
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, MenuItem, MenuCategory, Post } from '../types';
import { 
  ArrowRight, MapPin, Phone, Star, Info, 
  Utensils, DollarSign, Car, Sparkles, Share2,
  Clock, ShieldCheck, MessageSquare, TrendingUp,
  Send, CheckCircle2, Loader2, AlertCircle, User
} from 'lucide-react';

interface Props {
  restaurantId: string;
  onBack: () => void;
}

const CATEGORIES: { value: MenuCategory; label: string }[] = [
  { value: 'main', label: 'غذاهای اصلی' },
  { value: 'appetizer', label: 'پیش‌غذا' },
  { value: 'drink', label: 'نوشیدنی' },
  { value: 'dessert', label: 'دسر' },
  { value: 'other', label: 'سایر' },
];

const RestaurantDetail: React.FC<Props> = ({ restaurantId, onBack }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allReviews, setAllReviews] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  
  const [stats, setStats] = useState({ 
    avg: 0, 
    food: 0, 
    price: 0, 
    parking: 0, 
    ambiance: 0, 
    count: 0 
  });

  // Quick Rating State
  const [userRatingFood, setUserRatingFood] = useState(5);
  const [userRatingPrice, setUserRatingPrice] = useState(5);
  const [userRatingParking, setUserRatingParking] = useState(5);
  const [userRatingAmbiance, setUserRatingAmbiance] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const [restRes, menuRes, postsRes] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
        supabase.from('posts').select('*, profiles(username, full_name, avatar_url)').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (menuRes.data) setMenuItems(menuRes.data);
      if (postsRes.data) {
        setAllReviews(postsRes.data);
        
        if (user) {
          setHasReviewed(postsRes.data.some(p => p.user_id === user.id));
        }

        const count = postsRes.data.length;
        if (count > 0) {
          const sums = postsRes.data.reduce((acc, p) => ({
            avg: acc.avg + (p.rating || 0),
            food: acc.food + (p.rating_food || 0),
            price: acc.price + (p.rating_price || 0),
            parking: acc.parking + (p.rating_parking || 0),
            ambiance: acc.ambiance + (p.rating_ambiance || 0),
          }), { avg: 0, food: 0, price: 0, parking: 0, ambiance: 0 });

          setStats({
            avg: sums.avg / count,
            food: sums.food / count,
            price: sums.price / count,
            parking: sums.parking / count,
            ambiance: sums.ambiance / count,
            count: count
          });
        } else {
          setStats({ avg: 0, food: 0, price: 0, parking: 0, ambiance: 0, count: 0 });
        }
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("لطفاً ابتدا وارد حساب خود شوید");

      // اطمینان از وجود پروفایل (Foreign Key Check)
      const { data: profileCheck } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (!profileCheck) {
         const { error: profError } = await supabase.from('profiles').upsert({ 
           id: user.id, 
           username: 'user_' + user.id.slice(0, 5), 
           full_name: user.user_metadata?.full_name || 'کاربر جدید' 
         }, { onConflict: 'id' });
         if (profError) console.error("Emergency Profile Create Failed:", profError);
      }

      const avgRating = (userRatingFood + userRatingPrice + userRatingParking + userRatingAmbiance) / 4;

      // چون دیتابیس Unique Constraint روی ترکیب کاربر و رستوران ندارد، به جای upsert از insert استفاده می‌کنیم
      // تا از خطای 42P10 جلوگیری شود.
      const { error } = await supabase.from('posts').insert([{
        user_id: user.id,
        restaurant_id: restaurantId,
        rating: avgRating,
        rating_food: userRatingFood,
        rating_price: userRatingPrice,
        rating_parking: userRatingParking,
        rating_ambiance: userRatingAmbiance,
        caption: userComment || "تجربه جدید ثبت شد",
        photo_url: restaurant?.cover_image || "https://images.unsplash.com/photo-1517248135467-4c7ed9d42339?q=80&w=500"
      }]);

      if (error) throw error;

      setShowSuccess(true);
      setUserComment('');
      setHasReviewed(true);
      
      // به‌روزرسانی آنی داده‌ها
      await fetchData(); 
      
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      console.error("Submission Error Detail:", e);
      alert("خطا در ثبت: " + (e.message || "لطفاً دوباره تلاش کنید"));
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button 
          key={s} 
          onClick={() => onChange(s)}
          className={`p-1 transition-all ${s <= value ? 'text-orange-500 scale-110' : 'text-gray-200 hover:text-orange-200'}`}
        >
          <Star size={16} fill={s <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );

  const RatingBar = ({ label, value, icon: Icon, color }: any) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] font-black">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Icon size={12} className={color} />
          <span>{label}</span>
        </div>
        <span className="text-gray-900">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${color.replace('text-', 'bg-')}`} 
          style={{ width: `${(value / 5) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  if (loading) return <div className="p-20 text-center flex flex-col items-center gap-4"><TrendingUp className="animate-bounce text-orange-500" size={40} /><p className="text-xs font-black text-gray-400">تحلیل امتیازات و منو...</p></div>;
  if (!restaurant) return <div className="p-20 text-center font-black">رستوران یافت نشد.</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-24 animate-in slide-in-from-left-4" dir="rtl">
      {/* Header Image */}
      <div className="h-64 relative">
        {restaurant.cover_image ? (
          <img src={restaurant.cover_image} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-200">
             <Utensils size={60} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all">
          <ArrowRight size={24} />
        </button>
        
        <div className="absolute bottom-10 right-6 left-6 text-white">
          <div className="flex items-center gap-2 mb-1">
             <h1 className="text-3xl font-black">{restaurant.name}</h1>
             {restaurant.is_active && <ShieldCheck size={20} className="text-blue-400" />}
          </div>
          <p className="text-sm font-bold opacity-90 flex items-center gap-1">
            <MapPin size={14} className="text-orange-400" /> {restaurant.city} {restaurant.full_address ? `- ${restaurant.full_address}` : ''}
          </p>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10 space-y-6">
        {/* Main Stats Card */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-orange-500 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg shadow-orange-200">
                   <span className="text-xl font-black">{stats.avg.toFixed(1)}</span>
                   <span className="text-[8px] font-bold uppercase">امتیاز کل</span>
                </div>
                <div>
                   <h3 className="text-sm font-black text-gray-900">نمای کلی رضایت</h3>
                   <p className="text-[10px] font-bold text-gray-400">بر اساس {stats.count} تجربه ثبت شده</p>
                </div>
             </div>
             <div className="bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
                <span className="text-[10px] font-black text-green-600 flex items-center gap-1">
                   <Clock size={10} /> باز است
                </span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <RatingBar label="کیفیت غذا" value={stats.food} icon={Utensils} color="text-orange-500" />
            <RatingBar label="ارزش قیمت" value={stats.price} icon={DollarSign} color="text-green-500" />
            <RatingBar label="سهولت پارکینگ" value={stats.parking} icon={Car} color="text-blue-500" />
            <RatingBar label="دکوراسیون و فضا" value={stats.ambiance} icon={Sparkles} color="text-purple-500" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
               <Phone size={18} className="text-green-500" />
               <span className="text-xs font-black text-gray-700">تماس</span>
            </a>
          )}
          <button className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
             <Share2 size={18} className="text-orange-500" />
             <span className="text-xs font-black text-gray-700">اشتراک‌گذاری</span>
          </button>
        </div>

        {/* Menu Section */}
        <div className="space-y-6">
           <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                 <Utensils className="text-orange-500" size={20} /> منوی رستوران
              </h3>
              <span className="text-[10px] font-bold text-gray-400">{menuItems.length} آیتم</span>
           </div>

           <div className="grid gap-3">
             {CATEGORIES.map(cat => {
                const items = menuItems.filter(i => (i.category || 'other') === cat.value);
                if (items.length === 0) return null;
                return (
                  <div key={cat.value} className="space-y-3" id={`category-${cat.value}`}>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">{cat.label}</span>
                        <div className="h-px flex-1 bg-gray-100"></div>
                     </div>
                     <div className="grid gap-3">
                        {items.map(item => (
                           <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm hover:border-orange-200 transition-colors group">
                              <div className="flex-1">
                                 <h4 className="text-sm font-black text-gray-900 group-hover:text-orange-600 transition-colors">{item.name}</h4>
                                 {item.description && <p className="text-[10px] font-bold text-gray-400 mt-1">{item.description}</p>}
                              </div>
                              <div className="bg-orange-50 px-3 py-2 rounded-2xl border border-orange-100">
                                 <span className="text-xs font-black text-orange-600">{item.price.toLocaleString()} <span className="text-[8px]">تومان</span></span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                );
             })}
           </div>
           
           {menuItems.length === 0 && (
             <div className="text-center py-16 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
               <Utensils size={40} className="mx-auto text-gray-200 mb-2" />
               <p className="text-xs font-bold text-gray-400 italic">هنوز منویی برای این رستوران ثبت نشده است.</p>
             </div>
           )}
        </div>

        {/* --- Quick Rating Section --- */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-orange-100 shadow-xl space-y-6 relative overflow-hidden">
           <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-100">
                 <Sparkles size={18} />
              </div>
              <h3 className="font-black text-gray-900 text-sm">امتیاز و نظر شما</h3>
           </div>

           {showSuccess ? (
             <div className="py-10 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-green-100">
                   <CheckCircle2 size={32} />
                </div>
                <p className="text-sm font-black text-gray-900">تجربه شما با موفقیت ثبت شد!</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1">آمار کلی رستوران به‌روزرسانی شد.</p>
             </div>
           ) : (
             <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2"><Utensils size={14} className="text-orange-500" /><span className="text-[10px] font-black text-gray-700">کیفیت طعم</span></div>
                      <StarRating value={userRatingFood} onChange={setUserRatingFood} />
                   </div>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2"><DollarSign size={14} className="text-green-500" /><span className="text-[10px] font-black text-gray-700">ارزش قیمت</span></div>
                      <StarRating value={userRatingPrice} onChange={setUserRatingPrice} />
                   </div>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2"><Car size={14} className="text-blue-500" /><span className="text-[10px] font-black text-gray-700">جای پارک</span></div>
                      <StarRating value={userRatingParking} onChange={setUserRatingParking} />
                   </div>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-2"><Sparkles size={14} className="text-purple-500" /><span className="text-[10px] font-black text-gray-700">فضا و محیط</span></div>
                      <StarRating value={userRatingAmbiance} onChange={setUserRatingAmbiance} />
                   </div>
                </div>

                <div className="relative">
                   <textarea 
                     value={userComment}
                     onChange={(e) => setUserComment(e.target.value)}
                     className="w-full p-4 bg-gray-50 rounded-2xl text-[11px] font-bold outline-none border border-transparent focus:border-orange-200 min-h-[100px] transition-all"
                     placeholder="تجربه خود را در چند جمله بنویسید..."
                   />
                </div>

                <button 
                  onClick={handleQuickSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                   {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> ثبت سریع امتیاز</>}
                </button>
             </div>
           )}
        </div>

        {/* --- All Reviews Section --- */}
        <div className="space-y-4">
           <h3 className="text-sm font-black text-gray-900 mr-2 flex items-center gap-2">
              <MessageSquare size={16} className="text-orange-500" /> نظرات کاربران ({allReviews.length})
           </h3>
           <div className="space-y-3">
              {allReviews.map((review) => (
                 <div key={review.id} className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center overflow-hidden">
                             {review.profiles?.avatar_url ? <img src={review.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={16} className="text-orange-500" />}
                          </div>
                          <div>
                             <p className="text-[11px] font-black text-gray-900">{review.profiles?.full_name || 'کاربر مهمان'}</p>
                             <p className="text-[8px] font-bold text-gray-400">@{review.profiles?.username}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg">
                          <Star size={10} className="text-orange-500 fill-current" />
                          <span className="text-[10px] font-black text-orange-600">{review.rating.toFixed(1)}</span>
                       </div>
                    </div>
                    <p className="text-[11px] font-bold text-gray-600 leading-relaxed pr-1">{review.caption}</p>
                 </div>
              ))}
              {allReviews.length === 0 && (
                <div className="text-center py-10 opacity-30">
                   <MessageSquare size={32} className="mx-auto mb-2" />
                   <p className="text-[10px] font-bold italic">اولین کسی باشید که نظر می‌دهد!</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
