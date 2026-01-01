
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Post, Restaurant, Profile } from '../types';
import { 
  Star, MapPin, MessageCircle, Heart, ThumbsDown, 
  Utensils, DollarSign, Car, Sparkles, ChevronDown, 
  Search, X, Loader2, Store, ChefHat, Sparkle, AlertCircle
} from 'lucide-react';

interface FeedProps {
  onRestaurantClick?: (id: string) => void;
  onPostClick?: (id: string) => void;
  onUserClick?: (userId: string) => void;
}

const Feed: React.FC<FeedProps> = ({ onRestaurantClick, onPostClick, onUserClick }) => {
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRatings, setShowRatings] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uId = data.user?.id || null;
      setCurrentUserId(uId);
      fetchSmartFeed(uId);
    });
  }, []);

  const fetchSmartFeed = async (uId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      let followingIds: string[] = [];
      if (uId) {
        const { data: followData } = await supabase.from('followers').select('following_id').eq('follower_id', uId);
        followingIds = followData?.map(f => f.following_id) || [];
      }

      // کوئری را به بخش‌های کوچکتر تقسیم می‌کنیم تا اگر لایک یا کامنت نبود، کل فید کرش نکند
      const { data: allPosts, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (id, username, avatar_url, full_name),
          restaurants (id, name, city),
          likes (user_id),
          dislikes (user_id),
          comments (id, content)
        `)
        .order('created_at', { ascending: false });

      if (postError) {
        if (postError.code === 'PGRST204' || postError.message.includes('not found')) {
           setError('جداول دیتابیس (مانند likes یا comments) یافت نشدند. لطفاً اسکریپت SQL را اجرا کنید.');
        } else {
           setError('خطا در بارگذاری فید: ' + postError.message);
        }
        return;
      }

      if (allPosts) {
        const fPosts = allPosts.filter(p => followingIds.includes(p.user_id));
        const dPosts = allPosts.filter(p => !followingIds.includes(p.user_id) && p.user_id !== uId);
        setFollowingPosts(fPosts);
        setDiscoverPosts(dPosts);
      }
    } catch (err: any) { 
      console.error(err);
      setError('خطای غیرمنتظره در شبکه رخ داد.');
    } finally { setLoading(false); }
  };

  const handleToggleReaction = async (postId: string, type: 'like' | 'dislike') => {
    if (!currentUserId) return;
    try {
      const table = type === 'like' ? 'likes' : 'dislikes';
      const otherTable = type === 'like' ? 'dislikes' : 'likes';
      const { data: existing } = await supabase.from(table).select('*').eq('post_id', postId).eq('user_id', currentUserId).maybeSingle();
      if (existing) {
        await supabase.from(table).delete().eq('post_id', postId).eq('user_id', currentUserId);
      } else {
        await supabase.from(otherTable).delete().eq('post_id', postId).eq('user_id', currentUserId);
        await supabase.from(table).insert([{ post_id: postId, user_id: currentUserId }]);
      }
      fetchSmartFeed(currentUserId);
    } catch (e) {
      alert('خطا در ثبت واکنش. دیتابیس را چک کنید.');
    }
  };

  const PostCard: React.FC<{ post: Post }> = ({ post }) => {
    const isLiked = post.likes?.some(l => l.user_id === currentUserId) || false;
    const isDisliked = post.dislikes?.some(d => d.user_id === currentUserId) || false;

    return (
      <div className="bg-white border-y border-gray-100 shadow-sm" dir="rtl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center overflow-hidden border border-orange-50 cursor-pointer" onClick={() => onUserClick?.(post.profiles?.id || '')}>
            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-orange-600 font-black text-sm">{post.profiles?.username[0].toUpperCase()}</span>}
          </div>
          <div className="flex-1 text-right">
            <h4 className="font-black text-[13px] text-gray-900 leading-none mb-1 cursor-pointer hover:text-orange-500" onClick={() => onUserClick?.(post.profiles?.id || '')}>{post.profiles?.full_name}</h4>
            <div className="flex items-center gap-1 cursor-pointer" onClick={() => post.restaurants?.id && onRestaurantClick?.(post.restaurants.id)}>
                <MapPin size={10} className="text-gray-300" />
                <span className="text-[10px] text-orange-600 font-bold hover:underline">{post.restaurants?.name}، {post.restaurants?.city}</span>
            </div>
          </div>
          <button 
            onClick={() => setShowRatings(showRatings === post.id ? null : post.id)}
            className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-xl text-orange-600 border border-orange-100/50"
          >
            <Star size={12} className="fill-current" />
            <span className="text-xs font-black">{post.rating?.toFixed(1) || '0.0'}</span>
            <ChevronDown size={12} className={`transition-transform ${showRatings === post.id ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showRatings === post.id && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><Utensils size={12} className="text-orange-400"/> کیفیت: <span className="mr-auto font-black text-gray-900">{post.rating_food}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><DollarSign size={12} className="text-orange-400"/> قیمت: <span className="mr-auto font-black text-gray-900">{post.rating_price}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><Car size={12} className="text-orange-400"/> جای پارک: <span className="mr-auto font-black text-gray-900">{post.rating_parking}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><Sparkles size={12} className="text-orange-400"/> فضا: <span className="mr-auto font-black text-gray-900">{post.rating_ambiance}</span></div>
            </div>
        )}

        <img src={post.photo_url} className="w-full aspect-square object-cover cursor-pointer" onClick={() => onPostClick?.(post.id)} />

        <div className="px-4 py-4">
          <p className="text-gray-800 text-sm leading-relaxed mb-4">
            <span className="font-black ml-1 text-gray-900">@{post.profiles?.username}:</span> {post.caption}
          </p>
          <div className="flex items-center gap-5">
            <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1">
                <button onClick={() => handleToggleReaction(post.id, 'like')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${isLiked ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Heart size={20} className={isLiked ? 'fill-current' : ''} />
                    <span>{post.likes?.length || 0}</span>
                </button>
                <div className="w-px h-6 bg-gray-200"></div>
                <button onClick={() => handleToggleReaction(post.id, 'dislike')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${isDisliked ? 'bg-gray-200 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    <ThumbsDown size={20} className={isDisliked ? 'fill-current' : ''} />
                    <span>{post.dislikes?.length || 0}</span>
                </button>
            </div>
            <button onClick={() => onPostClick?.(post.id)} className="flex items-center gap-2 text-gray-400 text-xs font-black mr-auto bg-gray-50 px-4 py-3 rounded-2xl active:scale-95 transition-all">
                <MessageCircle size={20} /> 
                <span>{post.comments?.length || 0} نظر</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" /></div>;

  if (error) return (
    <div className="p-8 text-center space-y-4">
      <AlertCircle size={48} className="mx-auto text-red-500" />
      <h3 className="font-black text-gray-900">خطا در ارتباط با دیتابیس</h3>
      <p className="text-xs font-bold text-gray-400 leading-relaxed">{error}</p>
      <button onClick={() => fetchSmartFeed(currentUserId)} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-black text-[10px]">تلاش مجدد</button>
    </div>
  );

  return (
    <div className="space-y-6 pt-4 relative">
      <div className="px-4 sticky top-0 z-20 bg-gray-50/80 backdrop-blur-md py-2 -mt-4 border-b border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            className="w-full bg-white border border-gray-200 rounded-2xl py-4 pr-12 pl-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
            placeholder="جستجوی غذا یا رستوران..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {followingPosts.length > 0 && (
        <section className="space-y-4">
           <div className="px-6 flex items-center gap-2">
              <Sparkle size={16} className="text-orange-500 fill-current" />
              <h3 className="text-sm font-black text-gray-900">تجربه‌های دوستان</h3>
           </div>
           <div className="space-y-6">
              {followingPosts.map(p => <PostCard key={p.id} post={p} />)}
           </div>
        </section>
      )}

      <section className="space-y-4">
         <div className="px-6 flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            <h3 className="text-sm font-black text-gray-900">کشف محتوا</h3>
         </div>
         <div className="space-y-6">
            {discoverPosts.map(p => <PostCard key={p.id} post={p} />)}
            {discoverPosts.length === 0 && <div className="text-center py-10 text-xs font-bold text-gray-400 italic">محتوای جدیدی یافت نشد.</div>}
         </div>
      </section>
    </div>
  );
};

export default Feed;
