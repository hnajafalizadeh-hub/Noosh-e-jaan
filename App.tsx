
import React, { useState, useEffect, useRef } from 'react';
import { supabase, checkConnection } from './lib/supabase';
import { Profile, ViewState, RestaurantOwner, Restaurant, Post } from './types';
import Auth from './components/Auth';
import Feed from './components/Feed';
import ProfileView from './components/ProfileView';
import CreatePost from './components/CreatePost';
import NearMe from './components/NearMe';
import RestaurantDashboard from './components/RestaurantDashboard';
import AdminPanel from './components/AdminPanel';
import RestaurantDetail from './components/RestaurantDetail';
import PostDetail from './components/PostDetail';
import { Home, User, PlusCircle, LogOut, Utensils, MapPin, LayoutDashboard, ShieldAlert, Database, Key, X, Pizza, Plus, Edit3 } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<ViewState>('feed');
  const [selectedRestId, setSelectedRestId] = useState<string | null>(null);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [dbError, setDbError] = useState<{type: string, msg: string} | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const channelRef = useRef<any>(null);
  const isInternalNavRef = useRef(false);

  // تابع کمکی برای مدیریت امن تاریخچه مرورگر با بلوک try/catch برای جلوگیری از توقف برنامه در Iframe
  const safeHistoryUpdate = (type: 'push' | 'replace', state: any) => {
    try {
      if (type === 'push') {
        window.history.pushState(state, "", window.location.pathname);
      } else {
        window.history.replaceState(state, "", window.location.pathname);
      }
    } catch (e) {
      console.warn('History API restricted:', e);
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        isInternalNavRef.current = true;
        setView(event.state.view || 'feed');
        setSelectedRestId(event.state.selectedRestId || null);
        setSelectedMenuItemId(event.state.selectedMenuItemId || null);
        setSelectedPostId(event.state.selectedPostId || null);
        setSelectedUserId(event.state.selectedUserId || null);
        setPostToEdit(event.state.postToEdit || null);
        setTimeout(() => { isInternalNavRef.current = false; }, 50);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    if (!window.history.state) {
      safeHistoryUpdate('replace', { view: 'feed' });
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isInternalNavRef.current && session) {
      safeHistoryUpdate('push', { 
        view, 
        selectedRestId, 
        selectedMenuItemId,
        selectedPostId, 
        selectedUserId,
        postToEdit
      });
    }
  }, [view, selectedRestId, selectedPostId, selectedUserId]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownerRecord, setOwnerRecord] = useState<RestaurantOwner | null>(null);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, async (payload: any) => {
        handleRealtimeEvent(payload.new.post_id, payload.new.user_id, userId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload: any) => {
        handleRealtimeEvent(payload.new.post_id, payload.new.user_id, userId);
      })
      .subscribe();
    channelRef.current = channel;
  };

  const handleRealtimeEvent = async (postId: string, actorId: string, currentUserId: string) => {
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
      const phone = user.user_metadata?.phone || '';
      
      const { data, error } = await supabase.from('profiles').upsert({ 
        id: user.id, 
        username: username.toLowerCase(), 
        full_name: fullName, 
        phone: phone,
        email: user.email,
        is_admin: false 
      }, { onConflict: 'id' }).select().single();
      
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

  const navigateBack = () => {
    try {
      // استفاده امن از history.back با چک کردن امکان بازگشت
      if (window.history.state && window.history.length > 1) {
        window.history.back();
      } else {
        setView('feed');
      }
    } catch (e) {
      setView('feed');
    }
  };

  if (!session) return <Auth onAuthSuccess={() => setView('feed')} />;

  return (
    <div className="flex flex-col h-screen w-full md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto bg-gray-50 dark:bg-dark-bg border-x border-gray-200 dark:border-dark-border shadow-xl overflow-hidden relative transition-colors duration-300" dir="rtl">
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
          <div className="bg-white dark:bg-dark-card rounded-3xl w-full max-w-sm p-6 space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-900 dark:text-gray-100">راهنمای رفع خطا</h3>
                <button onClick={() => setShowSqlGuide(false)} className="text-gray-400 p-2"><X size={24}/></button>
             </div>
             <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
               ستون verified در جدول restaurants وجود ندارد. کد اصلاح شد تا دیگر از آن استفاده نشود.
             </p>
             <button 
               onClick={() => setShowSqlGuide(false)}
               className="w-full py-3 bg-gray-900 dark:bg-orange-600 text-white rounded-xl font-black text-xs shadow-xl"
             >
               متوجه شدم
             </button>
          </div>
        </div>
      )}
      
      <header className="bg-white dark:bg-dark-card border-b border-gray-100 dark:border-dark-border px-5 py-4 flex justify-between items-center sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setView('feed')}>
          <div className="bg-orange-500 p-1.5 rounded-xl group-active:scale-90 transition-transform">
             <Pizza className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">چی بُقولم؟</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile?.is_admin && (
            <button onClick={() => setView('admin')} className={`p-2 rounded-xl transition-all ${view === 'admin' ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-red-500'}`}>
              <ShieldAlert size={22} />
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} className="text-gray-400 p-2 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {view === 'feed' && <Feed onRestaurantClick={(id, mid) => { setSelectedRestId(id); setSelectedMenuItemId(mid || null); setView('restaurant_detail'); }} onPostClick={(id) => { setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} onEditPost={(post) => { setPostToEdit(post); setView('edit_post'); }} />}
        {view === 'near_me' && <NearMe onRestaurantClick={(id) => { setSelectedRestId(id); setSelectedMenuItemId(null); setView('restaurant_detail'); }} />}
        {view === 'create' && <CreatePost onComplete={() => navigateBack()} />}
        {view === 'edit_post' && postToEdit && <CreatePost editPost={postToEdit} onComplete={() => { setPostToEdit(null); navigateBack(); }} />}
        {view === 'dashboard' && <RestaurantDashboard ownerRecord={ownerRecord} onRefreshOwnership={() => checkOwnership(session.user.id)} />}
        {view === 'profile' && profile && (
          <ProfileView 
            profile={profile} 
            hasUnread={hasNewActivity} 
            onMarkAsRead={markAsRead} 
            onPostClick={(id) => { setSelectedPostId(id); setView('post_detail'); }} 
            onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} 
            onOpenAdmin={() => setView('admin')}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            onEditPost={(post) => { setPostToEdit(post); setView('edit_post'); }}
          />
        )}
        {view === 'user_profile' && selectedUserId && <ProfileView key={selectedUserId} userId={selectedUserId} onBack={navigateBack} onPostClick={(id) => { setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} onEditPost={(post) => { setPostToEdit(post); setView('edit_post'); }} />}
        {view === 'admin' && profile?.is_admin && <AdminPanel />}
        {view === 'restaurant_detail' && selectedRestId && <RestaurantDetail restaurantId={selectedRestId} highlightMenuItemId={selectedMenuItemId} onBack={navigateBack} onPostClick={(id) => { setSelectedPostId(id); setView('post_detail'); }} />}
        {view === 'post_detail' && selectedPostId && <PostDetail postId={selectedPostId} onBack={navigateBack} onEditPost={(post) => { setPostToEdit(post); setView('edit_post'); }} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto bg-white dark:bg-dark-card border-t border-gray-100 dark:border-dark-border px-2 py-2 flex justify-around items-center z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] transition-colors">
        <button onClick={() => setView('feed')} className={`flex flex-col items-center gap-1 min-w-[64px] ${view === 'feed' ? 'text-orange-500' : 'text-gray-400'}`}>
          <Home size={24} />
          <span className="text-[10px] font-bold">خانه</span>
        </button>
        <button onClick={() => setView('near_me')} className={`flex flex-col items-center gap-1 min-w-[64px] ${view === 'near_me' ? 'text-orange-500' : 'text-gray-400'}`}>
          <MapPin size={24} />
          <span className="text-[10px] font-bold">اطراف من</span>
        </button>
        <button onClick={() => setView('create')} className="relative -top-4 flex flex-col items-center gap-1">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${view === 'create' ? 'bg-orange-500 text-white scale-110' : 'bg-white dark:bg-dark-border text-gray-400 border border-gray-100 dark:border-dark-border'}`}>
            <Plus size={32} />
          </div>
          <span className={`text-[10px] font-bold mt-1 ${view === 'create' ? 'text-orange-500' : 'text-gray-400'}`}>ثبت</span>
        </button>
        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 min-w-[64px] ${view === 'dashboard' ? 'text-orange-500' : 'text-gray-400'}`}>
          <LayoutDashboard size={24} />
          <span className="text-[10px] font-bold">پنل رستوران</span>
        </button>
        <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 min-w-[64px] relative ${view === 'profile' ? 'text-orange-500' : 'text-gray-400'}`}>
          <div className="relative">
            <User size={24} />
            {hasNewActivity && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>}
          </div>
          <span className="text-[10px] font-bold">پروفایل</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
