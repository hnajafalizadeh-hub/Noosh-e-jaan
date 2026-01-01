
import React, { useState, useEffect, useRef } from 'react';
import { supabase, checkConnection } from './lib/supabase';
import { Profile, ViewState, RestaurantOwner, Restaurant } from './types';
import Auth from './components/Auth';
import Feed from './components/Feed';
import ProfileView from './components/ProfileView';
import CreatePost from './components/CreatePost';
import NearMe from './components/NearMe';
import RestaurantDashboard from './components/RestaurantDashboard';
import AdminPanel from './components/AdminPanel';
import RestaurantDetail from './components/RestaurantDetail';
import PostDetail from './components/PostDetail';
// Added missing 'X' icon to imports
import { Home, User, PlusCircle, LogOut, Utensils, MapPin, LayoutDashboard, ShieldAlert, AlertTriangle, Database, Code, Key, X } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<ViewState>('feed');
  const [prevView, setPrevView] = useState<ViewState>('feed');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownerRecord, setOwnerRecord] = useState<RestaurantOwner | null>(null);
  const [selectedRestId, setSelectedRestId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [dbError, setDbError] = useState<{type: string, msg: string} | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // اصلاح منطق چک کردن اتصال
    checkConnection().then(res => {
      if (!res.ok) {
        setDbError({ type: res.errorType || 'UNKNOWN', msg: res.message || '' });
      } else {
        setDbError(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) handleUserLogin(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        handleUserLogin(session.user);
        if (view === 'auth') setView('feed');
      } else {
        setProfile(null);
        setOwnerRecord(null);
        setView('auth');
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserLogin = async (user: any) => {
    await ensureProfileExists(user);
    checkOwnership(user.id);
    checkInitialNotifications(user.id);
    setupRealtime(user.id);
  };

  const checkInitialNotifications = async (userId: string) => {
    try {
      const lastChecked = localStorage.getItem(`notif_last_seen_${userId}`) || new Date(0).toISOString();
      const { data: userPosts } = await supabase.from('posts').select('id').eq('user_id', userId);
      if (!userPosts || userPosts.length === 0) return;
      const postIds = userPosts.map(p => p.id);

      const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).in('post_id', postIds).neq('user_id', userId).gt('created_at', lastChecked),
        supabase.from('comments').select('*', { count: 'exact', head: true }).in('post_id', postIds).neq('user_id', userId).gt('created_at', lastChecked)
      ]);

      if ((likesCount || 0) > 0 || (commentsCount || 0) > 0) setHasNewActivity(true);
    } catch (e) { console.warn('Notification check failed'); }
  };

  const setupRealtime = (userId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`realtime-notifs-${userId}`)
      // Fix: Add required 'schema' property to the 'postgres_changes' filter
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, async (payload: any) => {
        handleRealtimeEvent(payload.new.post_id, payload.new.user_id, userId, 'لایک جدید دریافت شد');
      })
      // Fix: Add required 'schema' property to the 'postgres_changes' filter
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload: any) => {
        handleRealtimeEvent(payload.new.post_id, payload.new.user_id, userId, 'کامنت جدید برای پست شما');
      })
      .subscribe();
    channelRef.current = channel;
  };

  const handleRealtimeEvent = async (postId: string, actorId: string, currentUserId: string, message: string) => {
    if (actorId === currentUserId) return;
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
    if (post?.user_id === currentUserId) {
      setHasNewActivity(true);
    }
  };

  const ensureProfileExists = async (user: any) => {
    try {
      const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (existingProfile) {
        setProfile(existingProfile);
        return;
      }
      const username = user.user_metadata?.display_username || user.email?.split('@')[0] || 'user_' + user.id.slice(0, 5);
      const fullName = user.user_metadata?.full_name || 'کاربر جدید';
      const { data, error } = await supabase.from('profiles').upsert({ id: user.id, username: username.toLowerCase(), full_name: fullName, is_admin: false }, { onConflict: 'id' }).select().single();
      if (!error) setProfile(data);
    } catch (e) { console.error('Profile creation error:', e); }
  };

  const checkOwnership = async (userId: string) => {
    try {
      const { data } = await supabase.from('restaurant_owners').select('*').eq('user_id', userId).maybeSingle();
      setOwnerRecord(data);
    } catch (e) { setOwnerRecord(null); }
  };

  const markAsRead = () => {
    setHasNewActivity(false);
    if (session?.user?.id) localStorage.setItem(`notif_last_seen_${session.user.id}`, new Date().toISOString());
  };

  if (!session) return <Auth onAuthSuccess={() => setView('feed')} />;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 border-x border-gray-200 shadow-xl overflow-hidden relative" dir="rtl">
      {dbError && (
        <div 
          onClick={() => setShowSqlGuide(true)}
          className="bg-red-600 text-white px-4 py-3 text-[10px] font-black flex flex-col items-center justify-center gap-1 cursor-pointer animate-pulse z-50 shadow-lg"
        >
          <div className="flex items-center gap-2">
            {dbError.type === 'API_KEY' ? <Key size={14} /> : <Database size={14} />}
            <span>{dbError.type === 'API_KEY' ? 'خطای کلید امنیتی: API Key منقضی یا اشتباه است' : 'جداول دیتابیس تنظیم نیستند'}</span>
          </div>
          <span className="opacity-70 text-[8px]">برای راهنمای رفع خطا کلیک کنید</span>
        </div>
      )}

      {showSqlGuide && (
        <div className="fixed inset-0 bg-black/80 z-[100] p-6 flex items-center justify-center overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-900">راهنمای رفع خطا</h3>
                <button onClick={() => setShowSqlGuide(false)} className="text-gray-400 p-2"><X size={24}/></button>
             </div>
             
             {dbError?.type === 'API_KEY' ? (
               <div className="space-y-3">
                 <p className="text-[11px] font-bold text-red-600 leading-relaxed">
                   کلید پروژه شما در Supabase نامعتبر است.
                 </p>
                 <ol className="text-[10px] font-bold text-gray-600 space-y-2 list-decimal pr-4">
                   <li>به پنل مدیریت Supabase بروید.</li>
                   <li>وارد بخش Project Settings (آیکون چرخ‌دنده پایین) شوید.</li>
                   <li>روی منوی API کلیک کنید.</li>
                   <li>در بخش Project API keys، کلید روبروی <b>anon / public</b> را کپی کنید.</li>
                   <li>آن را در فایل <code className="bg-gray-100 px-1">lib/supabase.ts</code> قرار دهید.</li>
                 </ol>
               </div>
             ) : (
               <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
                 خطاهای ۴۰۰ به دلیل نبود جداول در Supabase است. کد SQL که قبلاً فرستادم را در بخش SQL Editor پروژه خود اجرا کنید.
               </p>
             )}

             <button 
               onClick={() => setShowSqlGuide(false)}
               className="w-full py-3 bg-gray-900 text-white rounded-xl font-black text-xs shadow-xl"
             >
               متوجه شدم
             </button>
          </div>
        </div>
      )}
      
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('feed')}>
          <Utensils className="text-orange-500" size={24} />
          <h1 className="text-xl font-black text-gray-800">نوش جان</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile?.is_admin && (
            <button onClick={() => setView('admin')} className={`p-2 rounded-xl transition-all ${view === 'admin' ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-red-500'}`}>
              <ShieldAlert size={22} />
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} className="text-gray-400 p-1 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {view === 'feed' && <Feed onRestaurantClick={(id) => { setPrevView(view); setSelectedRestId(id); setView('restaurant_detail'); }} onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} />}
        {view === 'near_me' && <NearMe onRestaurantClick={(id) => { setPrevView(view); setSelectedRestId(id); setView('restaurant_detail'); }} />}
        {view === 'create' && <CreatePost onComplete={() => setView('feed')} />}
        {view === 'dashboard' && <RestaurantDashboard ownerRecord={ownerRecord} onRefreshOwnership={() => checkOwnership(session.user.id)} />}
        {view === 'profile' && profile && <ProfileView profile={profile} hasUnread={hasNewActivity} onMarkAsRead={markAsRead} onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} onOpenAdmin={() => setView('admin')} />}
        {view === 'user_profile' && selectedUserId && <ProfileView key={selectedUserId} userId={selectedUserId} onBack={() => setView(prevView)} onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} />}
        {view === 'admin' && profile?.is_admin && <AdminPanel />}
        {view === 'restaurant_detail' && selectedRestId && <RestaurantDetail restaurantId={selectedRestId} onBack={() => setView(prevView)} />}
        {view === 'post_detail' && selectedPostId && <PostDetail postId={selectedPostId} onBack={() => setView(prevView)} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 px-2 py-3 flex justify-around items-center z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => setView('feed')} className={`flex flex-col items-center gap-1 ${view === 'feed' ? 'text-orange-500' : 'text-gray-400'}`}><Home size={20} /><span className="text-[9px] font-bold">خانه</span></button>
        <button onClick={() => setView('near_me')} className={`flex flex-col items-center gap-1 ${view === 'near_me' ? 'text-orange-500' : 'text-gray-400'}`}><MapPin size={20} /><span className="text-[9px] font-bold">اطراف من</span></button>
        <button onClick={() => setView('create')} className={`flex flex-col items-center gap-1 ${view === 'create' ? 'text-orange-500' : 'text-gray-400'}`}><div className={`p-2 rounded-full ${view === 'create' ? 'bg-orange-100' : 'bg-gray-50'}`}><PlusCircle size={24} /></div><span className="text-[9px] font-bold">ثبت</span></button>
        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-orange-500' : 'text-gray-400'}`}><LayoutDashboard size={20} /><span className="text-[9px] font-bold">پنل رستوران</span></button>
        <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 relative ${view === 'profile' ? 'text-orange-500' : 'text-gray-400'}`}>
          <div className="relative">
            <User size={20} />
            {hasNewActivity && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>}
          </div>
          <span className="text-[9px] font-bold">پروفایل</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
