
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, Post, Activity } from '../types';
import { compressImage } from '../lib/imageUtils';
import { 
  Settings, Grid, Camera, Image as ImageIcon, Loader2, Bell, Heart, 
  MessageCircle, User, Search, UserPlus, UserMinus, ArrowRight, 
  UserCheck, ShieldAlert, Moon, Sun, X, ChevronLeft, LogOut,
  Edit2, Save, Smartphone, CheckCircle2, AlertCircle, Users
} from 'lucide-react';

interface ProfileViewProps {
  profile?: Profile;
  userId?: string;
  onPostClick?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  onEditPost?: (post: Post) => void;
  hasUnread?: boolean;
  onMarkAsRead?: () => void;
  onBack?: () => void;
  onOpenAdmin?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
  profile: initialProfile, 
  userId, 
  onPostClick, 
  onUserClick, 
  onEditPost,
  hasUnread, 
  onMarkAsRead, 
  onBack, 
  onOpenAdmin,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [profile, setProfile] = useState<Profile | null>(initialProfile || null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'activities'>('posts');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const [followListData, setFollowListData] = useState<Profile[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null;
      setCurrentUserId(uid);
    });
  }, []);

  useEffect(() => {
    if (userId) fetchProfileById(userId);
    else if (profile) fetchUserData(profile.id);
  }, [userId, profile?.id, currentUserId]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length > 1) handleSearch();
      else setSearchResults([]);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const fetchProfileById = async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) {
      setProfile(data);
      fetchUserData(id);
    }
  };

  const fetchUserData = async (pId: string) => {
    setLoading(true);
    try {
      const [postsRes, followersRes, followingRes, checkFollowRes] = await Promise.all([
        supabase.from('posts').select('*, restaurants (name, city)').eq('user_id', pId).order('created_at', { ascending: false }),
        supabase.from('followers').select('*', { count: 'exact' }).eq('following_id', pId),
        supabase.from('followers').select('*', { count: 'exact' }).eq('follower_id', pId),
        currentUserId ? supabase.from('followers').select('*').eq('follower_id', currentUserId).eq('following_id', pId).maybeSingle() : Promise.resolve({ data: null })
      ]);
      
      if (postsRes.data) {
        const processedPosts = postsRes.data.map((p: any) => {
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
          const finalUrls = Array.isArray(urls) ? urls.filter(u => u && u.trim() !== '') : [p.photo_url].filter(u => u && u.trim() !== '');
          return { 
            ...p, 
            photo_urls: finalUrls,
            display_photo: finalUrls[0] || '' 
          };
        })
        // فقط نمایش پست‌هایی که عکس دارند در گرید پروفایل
        .filter(p => p.display_photo !== '');
        
        setPosts(processedPosts as any);
      }

      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
      setIsFollowing(!!checkFollowRes.data);

      if (currentUserId === pId) {
        const postIds = (postsRes.data || []).map(p => p.id);
        let likesData: any[] = [];
        let commentsData: any[] = [];
        
        if (postIds.length > 0) {
          const [lRes, cRes] = await Promise.all([
            supabase.from('likes').select('id, user_id, post_id, created_at, profiles(username, full_name, avatar_url)').in('post_id', postIds).neq('user_id', pId),
            supabase.from('comments').select('id, user_id, post_id, content, created_at, profiles(username, full_name, avatar_url)').in('post_id', postIds).neq('user_id', pId)
          ]);
          likesData = lRes.data || [];
          commentsData = cRes.data || [];
        }

        const { data: followActivities } = await supabase
          .from('followers')
          .select('id, follower_id, created_at, profiles:follower_id(username, full_name, avatar_url)')
          .eq('following_id', pId)
          .order('created_at', { ascending: false });

        const combined: Activity[] = [
          ...likesData.map(l => ({ id: l.id, type: 'like' as const, user: l.profiles as any, post_id: l.post_id, created_at: l.created_at, is_read: false })),
          ...commentsData.map(c => ({ id: c.id, type: 'comment' as const, user: c.profiles as any, post_id: c.post_id, content: c.content, created_at: c.created_at, is_read: false })),
          ...(followActivities || []).map(f => ({ id: f.id, type: 'follow' as const, user: f.profiles as any, created_at: f.created_at, is_read: false }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setActivities(combined);
        setEditFullName(profile?.full_name || '');
        setEditUsername(profile?.username || '');
        setEditPhone(profile?.phone || '');
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchFollowList = async (type: 'followers' | 'following') => {
    if (!profile) return;
    setListLoading(true);
    setShowFollowList(type);
    try {
      if (type === 'followers') {
        const { data } = await supabase
          .from('followers')
          .select('follower_id, profiles:follower_id(*)')
          .eq('following_id', profile.id);
        setFollowListData(data?.map(d => d.profiles as any) || []);
      } else {
        const { data } = await supabase
          .from('followers')
          .select('following_id, profiles:following_id(*)')
          .eq('follower_id', profile.id);
        setFollowListData(data?.map(d => d.profiles as any) || []);
      }
    } catch (e) { console.error(e); } finally { setListLoading(false); }
  };

  const handleFollow = async () => {
    if (!currentUserId || !profile) return;
    try {
      if (isFollowing) {
        await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', profile.id);
        setIsFollowing(false);
        setFollowerCount(prev => prev - 1);
      } else {
        await supabase.from('followers').insert([{ follower_id: currentUserId, following_id: profile.id }]);
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
    } catch (e) { console.error(e); }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    const { data } = await supabase.from('profiles').select('*').ilike('username', `%${searchQuery}%`).neq('id', currentUserId).limit(10);
    setSearchResults(data || []);
    setIsSearching(false);
  };

  const handleUpload = async (file: File, type: 'avatar' | 'cover') => {
    if (!profile) return;
    setUpdating(true);
    try {
      const compressed = await compressImage(file, type === 'avatar' ? 200 : 400);
      const bucket = type === 'avatar' ? 'avatars' : 'covers';
      const fileName = `${profile.id}-${Date.now()}.jpg`;
      await supabase.storage.from(bucket).upload(fileName, compressed, { contentType: 'image/jpeg', upsert: true });
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const updateData = type === 'avatar' ? { avatar_url: publicUrl } : { cover_url: publicUrl };
      await supabase.from('profiles').update(updateData).eq('id', profile.id);
      setProfile({ ...profile, ...updateData });
    } catch (e) { console.error(e); } finally { setUpdating(false); }
  };

  const handleSaveChanges = async () => {
    if (!profile || !currentUserId) return;
    setUpdating(true);
    setEditError(null);
    setEditSuccess(false);

    try {
      if (!editFullName.trim() || !editUsername.trim()) throw new Error('نام و نام کاربری نمی‌توانند خالی باشند.');
      if (editUsername.toLowerCase() !== profile.username.toLowerCase()) {
        const { data: existing } = await supabase.from('profiles').select('id').eq('username', editUsername.toLowerCase()).maybeSingle();
        if (existing) throw new Error('این نام کاربری قبلاً انتخاب شده است.');
      }
      const { error } = await supabase.from('profiles').update({ full_name: editFullName.trim(), username: editUsername.toLowerCase().trim(), phone: editPhone.trim() }).eq('id', currentUserId);
      if (error) throw error;
      setProfile({ ...profile, full_name: editFullName.trim(), username: editUsername.toLowerCase().trim(), phone: editPhone.trim() });
      setEditSuccess(true);
      setTimeout(() => { setShowEditProfile(false); setEditSuccess(false); }, 1500);
    } catch (e: any) { setEditError(e.message || 'خطا در ذخیره‌سازی اطلاعات'); } finally { setUpdating(false); }
  };

  if (loading || !profile) return <div className="p-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></div>;

  const isOwnProfile = currentUserId === profile.id;

  return (
    <div className="bg-gray-50 dark:bg-dark-bg min-h-full pb-20 transition-colors duration-300" dir="rtl">
      <div className="h-48 w-full bg-orange-100 dark:bg-dark-card relative group">
        {onBack && (
          <button onClick={onBack} className="absolute top-4 right-4 z-20 p-2 bg-black/30 backdrop-blur-md rounded-full text-white">
            <ArrowRight size={20} />
          </button>
        )}
        {profile.cover_url ? <img src={profile.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-50/50 dark:bg-black/20" />}
        {isOwnProfile && (
          <label className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
             <ImageIcon className="text-white" size={28} />
             <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover')} />
          </label>
        )}
        {updating && <div className="absolute inset-0 bg-white/40 dark:bg-black/40 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>}
      </div>

      <div className="px-6 -mt-12 relative z-10">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-[2rem] bg-white dark:bg-dark-card p-1 shadow-xl relative group">
            <div className="w-full h-full rounded-[1.8rem] bg-orange-50 dark:bg-dark-bg flex items-center justify-center overflow-hidden border-2 border-white dark:border-dark-border">
              {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <span className="text-3xl font-black text-orange-500">{profile.username?.[0].toUpperCase()}</span>}
            </div>
            {isOwnProfile && (
              <label className="absolute inset-0 bg-black/40 rounded-[1.8rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer m-1">
                 <Camera className="text-white" size={20} />
                 <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'avatar')} />
              </label>
            )}
          </div>
          <div className="flex gap-2 mb-2">
            {isOwnProfile && profile.is_admin && (
              <button onClick={onOpenAdmin} className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-black text-[10px] shadow-lg shadow-red-100 flex items-center gap-2 active:scale-95 transition-all"><ShieldAlert size={16} /> پنل مدیریت کل</button>
            )}
            {!isOwnProfile && (
              <button onClick={handleFollow} className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 ${isFollowing ? 'bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-gray-400' : 'bg-orange-500 text-white shadow-orange-100'}`}>
                {isFollowing ? <><UserMinus size={16} /> لغو دنبال کردن</> : <><UserPlus size={16} /> دنبال کردن</>}
              </button>
            )}
            {isOwnProfile && (
              <button onClick={() => setShowSettings(true)} className="p-2.5 bg-white dark:bg-dark-card rounded-xl shadow-md text-gray-400 dark:text-gray-300 border border-gray-100 dark:border-dark-border hover:text-orange-500 transition-colors"><Settings size={18} /></button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div><h2 className="text-xl font-black text-gray-900 dark:text-white">{profile.full_name}</h2><p className="text-orange-600 font-bold text-xs">@{profile.username}</p></div>
          {profile.is_admin && <span className="px-2 py-0.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[8px] font-black rounded-lg border border-red-100 dark:border-red-500/20">مدیریت</span>}
        </div>

        <div className="flex gap-4 mt-6 bg-white dark:bg-dark-card p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border text-center transition-colors">
          <div className="flex-1"><p className="text-lg font-black text-gray-900 dark:text-white">{posts.length}</p><p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">تجربه</p></div>
          <button onClick={() => fetchFollowList('followers')} className="flex-1 active:scale-95 transition-transform"><p className="text-lg font-black text-gray-900 dark:text-white">{followerCount}</p><p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">دنبال‌کننده</p></button>
          <button onClick={() => fetchFollowList('following')} className="flex-1 active:scale-95 transition-transform"><p className="text-lg font-black text-gray-900 dark:text-white">{followingCount}</p><p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">دنبال‌شونده</p></button>
        </div>
      </div>

      {isOwnProfile && (
        <div className="px-6 mt-8">
           <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" className="w-full bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl py-3 pr-11 pl-4 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white transition-colors" placeholder="جستجوی کاربران..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              {isSearching && <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 animate-spin" size={14} />}
           </div>
           {searchResults.length > 0 && (
             <div className="mt-2 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-xl overflow-hidden animate-in slide-in-from-top-2">
                {searchResults.map(res => (
                  <button key={res.id} onClick={() => { onUserClick?.(res.id); setSearchQuery(''); }} className="w-full p-3 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-dark-bg transition-colors border-b border-gray-50 dark:border-dark-border last:border-0 text-right"><div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-dark-bg flex items-center justify-center overflow-hidden shrink-0">{res.avatar_url ? <img src={res.avatar_url} className="w-full h-full object-cover" /> : <User size={14} className="text-orange-500" />}</div><div className="flex-1"><p className="text-[11px] font-black text-gray-900 dark:text-white">{res.full_name}</p><p className="text-[9px] font-bold text-gray-400 dark:text-gray-500">@{res.username}</p></div></button>
                ))}
             </div>
           )}
        </div>
      )}

      <div className="px-6 mt-8 flex gap-6 border-b border-gray-100 dark:border-dark-border">
        <button onClick={() => setActiveTab('posts')} className={`pb-3 text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'posts' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-300 dark:text-gray-600'}`}><Grid size={14} /> پست‌ها</button>
        {isOwnProfile && (
          <button onClick={() => { setActiveTab('activities'); onMarkAsRead?.(); }} className={`pb-3 text-xs font-black transition-all relative flex items-center gap-2 ${activeTab === 'activities' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-300 dark:text-gray-600'}`}><Bell size={14} /> اعلان‌ها{hasUnread && <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-600 rounded-full animate-ping"></span>}</button>
        )}
      </div>

      <div className="px-4 mt-6">
        {activeTab === 'posts' ? (
          <div className="grid grid-cols-3 gap-2">
            {posts.map(p => (
              <div key={p.id} onClick={() => onPostClick?.(p.id)} className="aspect-square rounded-xl overflow-hidden shadow-sm bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border cursor-pointer group relative">
                <img src={(p as any).display_photo} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Heart size={20} className="text-white fill-current" /></div>
              </div>
            ))}
            {!posts.length && !loading && <div className="col-span-3 py-16 text-center opacity-30 text-xs font-bold italic dark:text-gray-500">هنوز پستی منتشر نشده است.</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {activities.map((act) => (
              <div key={act.id} onClick={() => { if(act.post_id) onPostClick?.(act.post_id); else if(act.type === 'follow') onUserClick?.(act.user?.id || ''); }} className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-gray-100 dark:border-dark-border flex items-center gap-3 shadow-sm cursor-pointer active:scale-95 transition-all text-right"><div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-dark-bg flex items-center justify-center overflow-hidden shrink-0">{act.user?.avatar_url ? <img src={act.user.avatar_url} className="w-full h-full object-cover" /> : <User size={20} className="text-orange-500" />}</div><div className="flex-1 min-w-0"><p className="text-[10px] text-gray-900 dark:text-gray-200 leading-tight"><span className="font-black">@{act.user?.username || 'کاربر حذف شده'}</span> {act.type === 'like' && ' پست شما را لایک کرد.'}{act.type === 'comment' && ` گفت: "${act.content?.slice(0, 30)}..."`}{act.type === 'follow' && ' شما را دنبال کرد.'}</p><p className="text-[7px] font-bold text-gray-400 dark:text-gray-500 mt-1">{new Date(act.created_at).toLocaleDateString('fa-IR')}</p></div><div className={`p-1.5 rounded-lg ${act.type === 'like' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : act.type === 'follow' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'}`}>{act.type === 'like' && <Heart size={14} fill="currentColor" />}{act.type === 'comment' && <MessageCircle size={14} />}{act.type === 'follow' && <UserCheck size={14} />}</div></div>
            ))}
            {!activities.length && !loading && <p className="text-center py-10 text-[10px] font-bold text-gray-300 italic">فعالیتی ثبت نشده است.</p>}
          </div>
        )}
      </div>

      {showFollowList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex flex-col justify-end">
          <div className="bg-white dark:bg-dark-card rounded-t-[3rem] w-full max-w-md mx-auto p-8 space-y-6 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center"><h3 className="font-black text-xl text-gray-900 dark:text-white">{showFollowList === 'followers' ? 'دنبال‌کنندگان' : 'دنبال‌شوندگان'}</h3><button onClick={() => setShowFollowList(null)} className="p-2 bg-gray-50 dark:bg-dark-bg rounded-2xl text-gray-400 dark:text-gray-300 transition-colors"><X size={24} /></button></div>
            <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scroll">
              {listLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div> : followListData.length === 0 ? <div className="py-10 text-center text-xs font-bold text-gray-400 italic">لیست خالی است.</div> : followListData.map(u => (
                  <button key={u.id} onClick={() => { onUserClick?.(u.id); setShowFollowList(null); }} className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-dark-bg rounded-[1.8rem] border border-gray-100 dark:border-dark-border active:scale-95 transition-all text-right group"><div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-dark-card flex items-center justify-center overflow-hidden shrink-0 border border-white dark:border-dark-border">{u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <User size={24} className="text-orange-500" />}</div><div className="flex-1 min-w-0"><p className="text-sm font-black text-gray-900 dark:text-white group-hover:text-orange-500 transition-colors">{u.full_name}</p><p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">@{u.username}</p></div><ChevronLeft size={18} className="text-gray-300" /></button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col justify-end">
           <div className="bg-white dark:bg-dark-card rounded-t-[3rem] w-full max-w-md mx-auto p-8 space-y-6 animate-in slide-in-from-bottom-full duration-300">
              <div className="flex justify-between items-center"><h3 className="font-black text-xl text-gray-900 dark:text-white">تنظیمات پاتوق</h3><button onClick={() => { setShowSettings(false); setShowEditProfile(false); }} className="p-2 bg-gray-50 dark:bg-dark-bg rounded-2xl text-gray-400 dark:text-gray-300 transition-colors"><X size={24} /></button></div>
              {!showEditProfile ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mr-2">عمومی</p>
                  <div onClick={() => setShowEditProfile(true)} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-dark-bg rounded-3xl border border-gray-100 dark:border-dark-border cursor-pointer transition-all active:scale-95"><div className="flex items-center gap-4"><div className="p-3 bg-white dark:bg-dark-card rounded-2xl text-orange-500 shadow-sm"><Edit2 size={22} /></div><div><p className="text-sm font-black text-gray-900 dark:text-white">اصلاح اطلاعات کاربری</p><p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">تغییر نام، نام کاربری و شماره همراه</p></div></div><ChevronLeft size={20} className="text-gray-300" /></div>
                  <div onClick={onToggleDarkMode} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-dark-bg rounded-3xl border border-gray-100 dark:border-dark-border cursor-pointer transition-all active:scale-95"><div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-orange-500 text-white' : 'bg-white dark:bg-dark-card text-orange-500 shadow-sm'}`}>{isDarkMode ? <Moon size={22} /> : <Sun size={22} />}</div><div><p className="text-sm font-black text-gray-900 dark:text-white">حالت شب (Dark Mode)</p><p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">تمامی بخش‌ها تیره می‌شوند</p></div></div><div className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-800'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${isDarkMode ? 'left-1' : 'left-7'}`}></div></div></div>
                  <button onClick={() => { supabase.auth.signOut(); setShowSettings(false); }} className="w-full flex items-center gap-4 p-5 bg-red-50 dark:bg-red-500/10 rounded-3xl text-red-600 transition-all active:scale-95"><div className="p-3 bg-white dark:bg-dark-card rounded-2xl shadow-sm"><LogOut size={22}/></div><span className="text-sm font-black">خروج از حساب کاربری</span></button>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-2 mb-2"><button onClick={() => setShowEditProfile(false)} className="p-2 text-gray-400"><ArrowRight size={20} /></button><p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">ویرایش پروفایل</p></div>
                  {editError && <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-center gap-2 text-red-600 text-[10px] font-bold"><AlertCircle size={16} /> {editError}</div>}
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 mr-2">نام و نام خانوادگی</label><input className="w-full p-4 bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded-2xl text-xs font-bold outline-none dark:text-white" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder="نام شما" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 mr-2">نام کاربری (آیدی)</label><div className="relative"><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-black">@</span><input className="w-full pr-8 pl-4 py-4 bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded-2xl text-xs font-bold outline-none dark:text-white text-left" dir="ltr" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="username" /></div></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 mr-2">شماره همراه</label><div className="relative"><Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input className="w-full pr-12 pl-4 py-4 bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded-2xl text-xs font-bold outline-none dark:text-white text-left" dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="09123456789" /></div></div>
                    <button onClick={handleSaveChanges} disabled={updating} className="w-full py-5 bg-orange-600 text-white rounded-[1.8rem] font-black text-sm shadow-xl shadow-orange-100 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all mt-4">{updating ? <Loader2 className="animate-spin" size={20} /> : (editSuccess ? <CheckCircle2 size={20} /> : <><Save size={18} /> ذخیره تغییرات</>)}</button>
                    {editSuccess && <p className="text-center text-[10px] font-black text-green-500 animate-pulse">تغییرات با موفقیت اعمال شد.</p>}
                  </div>
                </div>
              )}
              <div className="text-center pb-4"><p className="text-[10px] font-bold text-gray-300 dark:text-gray-600">نسخه ۱.۴.۰ - چی بقولم؟</p></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
