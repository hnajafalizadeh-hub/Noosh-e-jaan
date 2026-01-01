
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, Post, Activity } from '../types';
import { compressImage } from '../lib/imageUtils';
import { Settings, Grid, Camera, Image as ImageIcon, Loader2, Bell, Heart, MessageCircle, User, Search, UserPlus, UserMinus, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';

interface ProfileViewProps {
  profile?: Profile;
  userId?: string;
  onPostClick?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  hasUnread?: boolean;
  onMarkAsRead?: () => void;
  onBack?: () => void;
  onOpenAdmin?: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ profile: initialProfile, userId, onPostClick, onUserClick, hasUnread, onMarkAsRead, onBack, onOpenAdmin }) => {
  const [profile, setProfile] = useState<Profile | null>(initialProfile || null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'activities'>('posts');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
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
      
      setPosts(postsRes.data || []);
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
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
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

  if (loading || !profile) return <div className="p-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></div>;

  const isOwnProfile = currentUserId === profile.id;

  return (
    <div className="bg-gray-50 min-h-full pb-20" dir="rtl">
      {/* Cover */}
      <div className="h-48 w-full bg-orange-100 relative group">
        {onBack && (
          <button onClick={onBack} className="absolute top-4 right-4 z-20 p-2 bg-black/30 backdrop-blur-md rounded-full text-white">
            <ArrowRight size={20} />
          </button>
        )}
        {profile.cover_url ? <img src={profile.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-50/50" />}
        {isOwnProfile && (
          <label className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
             <ImageIcon className="text-white" size={28} />
             <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover')} />
          </label>
        )}
        {updating && <div className="absolute inset-0 bg-white/40 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>}
      </div>

      {/* Info */}
      <div className="px-6 -mt-12 relative z-10">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-[2rem] bg-white p-1 shadow-xl relative group">
            <div className="w-full h-full rounded-[1.8rem] bg-orange-50 flex items-center justify-center overflow-hidden border-2 border-white">
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
              <button 
                onClick={onOpenAdmin}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-black text-[10px] shadow-lg shadow-red-100 flex items-center gap-2 active:scale-95 transition-all"
              >
                <ShieldAlert size={16} /> پنل مدیریت کل
              </button>
            )}
            {!isOwnProfile && (
              <button 
                onClick={handleFollow}
                className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 ${isFollowing ? 'bg-gray-100 text-gray-500' : 'bg-orange-500 text-white shadow-orange-100'}`}
              >
                {isFollowing ? <><UserMinus size={16} /> لغو دنبال کردن</> : <><UserPlus size={16} /> دنبال کردن</>}
              </button>
            )}
            {isOwnProfile && <button className="p-2.5 bg-white rounded-xl shadow-md text-gray-400 border border-gray-100 hover:text-orange-500 transition-colors"><Settings size={18} /></button>}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div>
            <h2 className="text-xl font-black text-gray-900">{profile.full_name}</h2>
            <p className="text-orange-600 font-bold text-xs">@{profile.username}</p>
          </div>
          {profile.is_admin && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black rounded-lg border border-red-100">مدیریت</span>}
        </div>

        <div className="flex gap-4 mt-6 bg-white p-4 rounded-3xl shadow-sm border border-gray-100 text-center">
          <div className="flex-1">
            <p className="text-lg font-black text-gray-900">{posts.length}</p>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">تجربه</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-black text-gray-900">{followerCount}</p>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">دنبال‌کننده</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-black text-gray-900">{followingCount}</p>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">دنبال‌شونده</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {isOwnProfile && (
        <div className="px-6 mt-8">
           <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                className="w-full bg-white border border-gray-100 rounded-2xl py-3 pr-11 pl-4 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="جستجوی کاربران..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 animate-spin" size={14} />}
           </div>

           {searchResults.length > 0 && (
             <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-in slide-in-from-top-2">
                {searchResults.map(res => (
                  <button 
                    key={res.id} 
                    onClick={() => { onUserClick?.(res.id); setSearchQuery(''); }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 text-right"
                  >
                     <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center overflow-hidden shrink-0">
                        {res.avatar_url ? <img src={res.avatar_url} className="w-full h-full object-cover" /> : <User size={14} className="text-orange-500" />}
                     </div>
                     <div className="flex-1">
                        <p className="text-[11px] font-black text-gray-900">{res.full_name}</p>
                        <p className="text-[9px] font-bold text-gray-400">@{res.username}</p>
                     </div>
                  </button>
                ))}
             </div>
           )}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 mt-8 flex gap-6 border-b border-gray-100">
        <button onClick={() => setActiveTab('posts')} className={`pb-3 text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'posts' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-300'}`}>
          <Grid size={14} /> پست‌ها
        </button>
        {isOwnProfile && (
          <button onClick={() => { setActiveTab('activities'); onMarkAsRead?.(); }} className={`pb-3 text-xs font-black transition-all relative flex items-center gap-2 ${activeTab === 'activities' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-300'}`}>
            <Bell size={14} /> اعلان‌ها
            {hasUnread && (
              <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
            )}
          </button>
        )}
      </div>

      <div className="px-4 mt-6">
        {activeTab === 'posts' ? (
          <div className="grid grid-cols-3 gap-2">
            {posts.map(p => (
              <div key={p.id} onClick={() => onPostClick?.(p.id)} className="aspect-square rounded-xl overflow-hidden shadow-sm bg-white border border-gray-100 cursor-pointer group relative">
                <img src={p.photo_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <Heart size={20} className="text-white fill-current" />
                </div>
              </div>
            ))}
            {!posts.length && !loading && <div className="col-span-3 py-16 text-center opacity-30 text-xs font-bold italic">هنوز پستی منتشر نشده است.</div>}
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} onClick={() => { if(act.post_id) onPostClick?.(act.post_id); else if(act.type === 'follow') onUserClick?.((act.user as any).id || ''); }} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm cursor-pointer active:scale-95 transition-all text-right">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center overflow-hidden shrink-0">
                  {act.user.avatar_url ? <img src={act.user.avatar_url} className="w-full h-full object-cover" /> : <User size={20} className="text-orange-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-900 leading-tight">
                    <span className="font-black">@{act.user.username}</span> 
                    {act.type === 'like' && ' پست شما را لایک کرد.'}
                    {act.type === 'comment' && ` گفت: "${act.content?.slice(0, 30)}..."`}
                    {act.type === 'follow' && ' شما را دنبال کرد.'}
                  </p>
                  <p className="text-[7px] font-bold text-gray-400 mt-1">{new Date(act.created_at).toLocaleDateString('fa-IR')}</p>
                </div>
                <div className={`p-1.5 rounded-lg ${act.type === 'like' ? 'bg-red-50 text-red-500' : act.type === 'follow' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                  {act.type === 'like' && <Heart size={14} fill="currentColor" />}
                  {act.type === 'comment' && <MessageCircle size={14} />}
                  {act.type === 'follow' && <UserCheck size={14} />}
                </div>
              </div>
            ))}
            {!activities.length && !loading && <p className="text-center py-10 text-[10px] font-bold text-gray-300 italic">فعالیتی ثبت نشده است.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
