
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Post, Restaurant, MenuItem } from '../types';
import { 
  Star, MapPin, MessageCircle, Heart, ThumbsDown, 
  Utensils, DollarSign, Car, Sparkles, ChevronDown, 
  Search, X, Loader2, Store, ChefHat, Sparkle, AlertCircle, 
  UtensilsCrossed, ArrowUpCircle, Edit3, Trash2, ChevronLeft, ChevronRight,
  AlertTriangle
} from 'lucide-react';

interface FeedProps {
  onRestaurantClick?: (id: string) => void;
  onPostClick?: (id: string) => void;
  onUserClick?: (userId: string) => void;
  onEditPost?: (post: Post) => void;
}

interface GlobalSearchResults {
  restaurants: Restaurant[];
  menuItems: (MenuItem & { restaurants: Restaurant })[];
}

const Feed: React.FC<FeedProps> = ({ onRestaurantClick, onPostClick, onUserClick, onEditPost }) => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRatings, setShowRatings] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string>(
    localStorage.getItem('feed_last_seen') || new Date().toISOString()
  );
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState<GlobalSearchResults>({ restaurants: [], menuItems: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uId = data.user?.id || null;
      setCurrentUserId(uId);
      fetchUnifiedFeed();
    });

    return () => {
      localStorage.setItem('feed_last_seen', new Date().toISOString());
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        handleGlobalSearch(searchQuery.trim());
      } else {
        setGlobalResults({ restaurants: [], menuItems: [] });
        setShowDropdown(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleGlobalSearch = async (query: string) => {
    setIsSearchingGlobal(true);
    setShowDropdown(true);
    try {
      const [restRes, menuRes] = await Promise.all([
        supabase.from('restaurants').select('*').ilike('name', `%${query}%`).limit(5),
        supabase.from('menu_items').select('*, restaurants(*)').ilike('name', `%${query}%`).limit(5)
      ]);

      setGlobalResults({
        restaurants: restRes.data || [],
        menuItems: (menuRes.data as any) || []
      });
    } catch (e) {
      console.error("Global Search Error:", e);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const fetchUnifiedFeed = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data: posts, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (id, username, avatar_url, full_name),
          restaurants (id, name, city, logo_url),
          likes (user_id),
          dislikes (user_id),
          comments (id, content)
        `)
        .order('created_at', { ascending: false });

      if (postError) throw postError;

      if (posts) {
        const processedPosts = posts.map((p: any) => {
          let urls: string[] = [];
          try {
            if (p.photo_url && (p.photo_url.startsWith('[') || p.photo_url.startsWith('{'))) {
              urls = JSON.parse(p.photo_url);
            } else if (p.photo_url) {
              urls = [p.photo_url];
            }
          } catch (e) {
            urls = [p.photo_url];
          }
          return { ...p, photo_urls: Array.isArray(urls) ? urls : [p.photo_url] };
        });
        setAllPosts(processedPosts as any);
      }
    } catch (err: any) { 
      console.error(err);
      setError('خطا در دریافت پاتوق‌ها. لطفاً دوباره تلاش کنید.');
    } finally { 
      setLoading(false); 
      setRefreshing(false);
    }
  };

  const confirmDeletePost = async () => {
    if (!deletingPostId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', deletingPostId);
      if (error) throw error;
      setAllPosts(prev => prev.filter(p => p.id !== deletingPostId));
      setDeletingPostId(null);
    } catch (e) {
      alert('خطا در حذف پست. ممکن است دسترسی لازم را نداشته باشید.');
    } finally {
      setIsDeleting(false);
    }
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
      
      setAllPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        let newLikes = [...(p.likes || [])];
        let newDislikes = [...(p.dislikes || [])];
        if (type === 'like') {
          if (existing) newLikes = newLikes.filter(l => l.user_id !== currentUserId);
          else { newLikes.push({ user_id: currentUserId }); newDislikes = newDislikes.filter(d => d.user_id !== currentUserId); }
        } else {
          if (existing) newDislikes = newDislikes.filter(d => d.user_id !== currentUserId);
          else { newDislikes.push({ user_id: currentUserId }); newLikes = newLikes.filter(l => l.user_id !== currentUserId); }
        }
        return { ...p, likes: newLikes, dislikes: newDislikes };
      }));
    } catch (e) { console.error('Reaction Error:', e); }
  };

  const PostCard: React.FC<{ post: Post }> = ({ post }) => {
    const isLiked = post.likes?.some(l => l.user_id === currentUserId) || false;
    const isDisliked = post.dislikes?.some(d => d.user_id === currentUserId) || false;
    const isNew = new Date(post.created_at).getTime() > new Date(lastSeenTimestamp).getTime();
    const isOwner = post.user_id === currentUserId;
    const [currentImgIdx, setCurrentImgIdx] = useState(0);

    const photos = post.photo_urls && post.photo_urls.length > 0 ? post.photo_urls : (post.photo_url ? [post.photo_url] : []);

    return (
      <div className={`bg-white dark:bg-dark-card border-y border-gray-100 dark:border-dark-border shadow-sm relative transition-all duration-700 ${isNew ? 'border-r-4 border-r-orange-500' : ''}`} dir="rtl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-dark-bg flex items-center justify-center overflow-hidden border border-orange-50 dark:border-dark-border cursor-pointer" onClick={() => onUserClick?.(post.profiles?.id || '')}>
            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-orange-600 font-black text-sm">{post.profiles?.username?.[0]?.toUpperCase() || 'U'}</span>}
          </div>
          <div className="flex-1 text-right">
            <h4 className="font-black text-[13px] text-gray-900 dark:text-gray-100 leading-none mb-1 cursor-pointer hover:text-orange-500" onClick={() => onUserClick?.(post.profiles?.id || '')}>{post.profiles?.full_name} {isOwner && <span className="text-[9px] bg-gray-100 dark:bg-dark-bg px-1.5 py-0.5 rounded-md mr-1">(شما)</span>}</h4>
            <div className="flex items-center gap-1 cursor-pointer" onClick={() => post.restaurants?.id && onRestaurantClick?.(post.restaurants.id)}>
                <MapPin size={10} className="text-gray-300" />
                <span className="text-[10px] text-orange-600 font-bold hover:underline">{post.restaurants?.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwner && (
               <div className="flex gap-1 ml-2">
                 <button onClick={() => onEditPost?.(post)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit3 size={16}/></button>
                 <button onClick={() => setDeletingPostId(post.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16}/></button>
               </div>
            )}
            <button 
              onClick={() => setShowRatings(showRatings === post.id ? null : post.id)}
              className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-xl text-orange-600 border border-orange-100/50 dark:border-orange-500/20"
            >
              <Star size={12} className="fill-current" />
              <span className="text-xs font-black">{post.rating?.toFixed(1) || '0.0'}</span>
              <ChevronDown size={12} className={`transition-transform ${showRatings === post.id ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {showRatings === post.id && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-100 dark:border-dark-border grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><Utensils size={12} className="text-orange-400"/> کیفیت: <span className="mr-auto font-black text-gray-900 dark:text-gray-100">{post.rating_food}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><DollarSign size={12} className="text-orange-400"/> قیمت: <span className="mr-auto font-black text-gray-900 dark:text-gray-100">{post.rating_price}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><Car size={12} className="text-orange-400"/> جای پارک: <span className="mr-auto font-black text-gray-900 dark:text-gray-100">{post.rating_parking}</span></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500"><Sparkles size={12} className="text-orange-400"/> فضا: <span className="mr-auto font-black text-gray-900 dark:text-gray-100">{post.rating_ambiance}</span></div>
            </div>
        )}

        {photos.length > 0 ? (
          <div className="relative group">
            <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar" onScroll={(e: any) => {
              const idx = Math.round(e.target.scrollLeft / e.target.offsetWidth);
              setCurrentImgIdx(Math.abs(idx));
            }}>
              {photos.map((url, i) => (
                <img key={i} src={url} className="w-full aspect-square object-cover snap-center shrink-0 cursor-pointer" onClick={() => onPostClick?.(post.id)} />
              ))}
            </div>
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${currentImgIdx === i ? 'bg-orange-500 w-4' : 'bg-white/50'}`}></div>
                ))}
              </div>
            )}
            {photos.length > 1 && currentImgIdx > 0 && (
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                 <ChevronRight size={20}/>
              </button>
            )}
            {photos.length > 1 && currentImgIdx < photos.length - 1 && (
              <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                 <ChevronLeft size={20}/>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full aspect-video bg-gray-50 dark:bg-dark-bg flex items-center justify-center border-y border-gray-100 dark:border-dark-border italic text-gray-300 text-[10px] font-bold">تجربه متنی</div>
        )}

        <div className="px-4 py-4">
          <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-4">
            <span className="font-black ml-1 text-gray-900 dark:text-white">@{post.profiles?.username}:</span> {post.caption}
          </p>
          <div className="flex items-center gap-5">
            <div className="flex items-center bg-gray-50 dark:bg-dark-bg rounded-2xl p-1 gap-1">
                <button onClick={() => handleToggleReaction(post.id, 'like')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${isLiked ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Heart size={20} className={isLiked ? 'fill-current' : ''} />
                    <span>{post.likes?.length || 0}</span>
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-dark-border"></div>
                <button onClick={() => handleToggleReaction(post.id, 'dislike')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${isDisliked ? 'bg-gray-200 dark:bg-dark-border text-gray-900 dark:text-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>
                    <ThumbsDown size={20} className={isDisliked ? 'fill-current' : ''} />
                    <span>{post.dislikes?.length || 0}</span>
                </button>
            </div>
            <button onClick={() => onPostClick?.(post.id)} className="flex items-center gap-2 text-gray-400 text-xs font-black mr-auto bg-gray-50 dark:bg-dark-bg px-4 py-3 rounded-2xl active:scale-95 transition-all">
                <MessageCircle size={20} /> 
                <span>{post.comments?.length || 0} نظر</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-0 relative">
      <div className="px-4 sticky top-0 z-30 bg-gray-50/80 dark:bg-dark-bg/80 backdrop-blur-md py-4 border-b border-gray-100 dark:border-dark-border" ref={searchRef}>
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            className="w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl py-4 pr-12 pl-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-orange-500/20 outline-none dark:text-white"
            placeholder="جستجوی غذا یا رستوران..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim().length > 1 && setShowDropdown(true)}
          />
          {isSearchingGlobal && <div className="absolute left-12 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-orange-500" /></div>}
          {searchQuery && <button onClick={() => { setSearchQuery(''); setGlobalResults({ restaurants: [], menuItems: [] }); setShowDropdown(false); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={16} /></button>}
        </div>

        {showDropdown && (searchQuery.trim().length > 1) && (
          <div className="absolute top-full left-4 right-4 bg-white dark:bg-dark-card mt-2 rounded-3xl shadow-2xl border border-gray-100 dark:border-dark-border overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
            {globalResults.restaurants.length === 0 && globalResults.menuItems.length === 0 && !isSearchingGlobal ? (
              <div className="p-8 text-center"><p className="text-xs font-bold text-gray-400">نتیجه‌ای یافت نشد.</p></div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto pb-4">
                {globalResults.restaurants.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-2 flex items-center gap-2 text-gray-400"><Store size={14} /><span className="text-[10px] font-black uppercase tracking-widest">رستوران‌ها</span></div>
                    {globalResults.restaurants.map(r => (
                      <button key={r.id} onClick={() => { onRestaurantClick?.(r.id); setShowDropdown(false); setSearchQuery(''); }} className="w-full p-3 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-dark-bg transition-colors text-right rounded-2xl group">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-dark-bg flex items-center justify-center text-orange-600 font-black shrink-0 overflow-hidden">{r.cover_image ? <img src={r.cover_image} className="w-full h-full object-cover" /> : r.name[0]}</div>
                        <div className="flex-1 min-w-0"><p className="text-xs font-black text-gray-900 dark:text-gray-100 group-hover:text-orange-600 transition-colors">{r.name}</p><p className="text-[10px] font-bold text-gray-400">{r.city}</p></div>
                      </button>
                    ))}
                  </div>
                )}
                {globalResults.menuItems.length > 0 && (
                  <div className="p-2 border-t border-gray-50 dark:border-dark-border">
                    <div className="px-3 py-2 flex items-center gap-2 text-gray-400"><UtensilsCrossed size={14} /><span className="text-[10px] font-black uppercase tracking-widest">غذاها</span></div>
                    {globalResults.menuItems.map(m => (
                      <button key={m.id} onClick={() => { onRestaurantClick?.(m.restaurant_id); setShowDropdown(false); setSearchQuery(''); }} className="w-full p-3 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-dark-bg transition-colors text-right rounded-2xl group">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 font-black shrink-0"><ChefHat size={20} /></div>
                        <div className="flex-1 min-w-0"><p className="text-xs font-black text-gray-900 dark:text-gray-100 group-hover:text-orange-600 transition-colors">{m.name}</p><p className="text-[10px] font-bold text-gray-400">در {m.restaurants?.name || 'رستوران'}</p></div>
                        <div className="text-left"><p className="text-[10px] font-black text-orange-600">{m.price.toLocaleString()} تومان</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-0">
        {refreshing && <div className="py-4 flex justify-center bg-white dark:bg-dark-card border-b border-gray-50 dark:border-dark-border"><Loader2 size={20} className="animate-spin text-orange-500" /></div>}
        {allPosts.map(p => <PostCard key={p.id} post={p} />)}
        {allPosts.length === 0 && !loading && <div className="text-center py-40 opacity-20"><Sparkle size={48} className="mx-auto mb-4" /><p className="text-sm font-black italic dark:text-gray-100">هنوز پستی در پاتوق ثبت نشده است.</p></div>}
        {allPosts.length > 0 && <div className="py-20 text-center"><div className="inline-flex flex-col items-center gap-2 text-gray-300 dark:text-gray-600"><ArrowUpCircle size={32} /><p className="text-[10px] font-black uppercase tracking-widest">به انتهای پاتوق رسیدید!</p></div></div>}
      </div>

      {/* Custom Deletion Modal */}
      {deletingPostId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-dark-card rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 shadow-2xl border border-gray-100 dark:border-dark-border animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto">
                 <AlertTriangle className="text-red-500" size={32} />
              </div>
              <div className="text-center space-y-2">
                 <h3 className="text-lg font-black text-gray-900 dark:text-white">حذف این تجربه؟</h3>
                 <p className="text-xs font-bold text-gray-400 leading-relaxed">آیا از حذف این تجربه شکموگردی مطمئن هستید؟ این عمل غیرقابل بازگشت است.</p>
              </div>
              <div className="flex gap-3">
                 <button 
                   onClick={confirmDeletePost}
                   disabled={isDeleting}
                   className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-red-100 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'بله، حذف شود'}
                 </button>
                 <button 
                   onClick={() => setDeletingPostId(null)}
                   disabled={isDeleting}
                   className="flex-1 py-4 bg-gray-100 dark:bg-dark-bg text-gray-500 dark:text-gray-400 rounded-2xl font-black text-xs active:scale-95 transition-all"
                 >
                    انصراف
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Feed;
