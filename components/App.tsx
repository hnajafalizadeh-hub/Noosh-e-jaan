
import { GoogleGenAI } from "@google/genai";
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
import { Home, User, PlusCircle, LogOut, Utensils, MapPin, LayoutDashboard, ShieldAlert, Database, Key, X, Pizza, Plus, Bell } from 'lucide-react';

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
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const channelRef = useRef<any>(null);
  const followingIdsRef = useRef<string[]>([]);

  useEffect(() => {
    // ثبت سرویس‌ورکر با استفاده از آدرس داینامیک بر اساس موقعیت فعلی صفحه
    // این کار مشکل Origin Mismatch را در محیط‌های Sandbox که دامنه‌های طولانی دارند حل می‌کند
    if ('serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          // ساخت آدرس کامل فایل sw.js بر اساس URL فعلی مرورگر
          const swUrl = new URL('sw.js', window.location.href).href;
          const registration = await navigator.serviceWorker.register(swUrl, {
            scope: './'
          });
          console.log('سرویس‌ورکر با موفقیت ثبت شد:', registration.scope);
        } catch (err) {
          console.error('خطا در ثبت سرویس‌ورکر:', err);
        }
      };
      
      registerServiceWorker();
    }

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

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('مرورگر شما از سیستم اعلان Push پشتیبانی نمی‌کند.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('لطفاً اجازه دسترسی به اعلان‌ها را صادر کنید.');
        return;
      }

      // کلید عمومی VAPID (نمونه)
      const applicationServerKey = 'BEl62vp9IH186M774N4I_41fYf0l05-vA0S4M67A55_Yf55A5_Yf55A5_Yf55A5_Yf55A5_Yf55A5_Yf55A5_Yf55A';
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      if (session?.user?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ push_subscription: subscription.toJSON() })
          .eq('id', session.user.id);
        
        if (!error) {
          alert('اعلان‌های سیستمی با موفقیت فعال شد! 🎉');
        } else {
          throw error;
        }
      }
    } catch (e: any) {
      console.error('Push Subscription Error:', e);
      alert('خطا در تنظیم اعلان: ' + e.message);
    }
  };

  const handleUserLogin = async (user: any) => {
    await ensureProfileExists(user);
    checkOwnership(user.id);
    checkInitialNotifications(user.id);
    fetchFollowingList(user.id);
  };

  const fetchFollowingList = async (userId: string) => {
    const { data } = await supabase.from('followers').select('following_id').eq('follower_id', userId);
    if (data) followingIdsRef.current = data.map(f => f.following_id);
  };

  const checkInitialNotifications = async (userId: string) => {
    try {
      const lastChecked = localStorage.getItem(`notif_last_seen_${userId}`) || new Date(0).toISOString();
      const { data: userPosts } = await supabase.from('posts').select('id').eq('user_id', userId);
      const postIds = userPosts?.map(p => p.id) || [];

      const [{ count: likesCount }, { count: commentsCount }, { count: followCount }] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).in('post_id', postIds).neq('user_id', userId).gt('created_at', lastChecked),
        supabase.from('comments').select('*', { count: 'exact', head: true }).in('post_id', postIds).neq('user_id', userId).gt('created_at', lastChecked),
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId).gt('created_at', lastChecked)
      ]);

      if ((likesCount || 0) > 0 || (commentsCount || 0) > 0 || (followCount || 0) > 0) setHasNewActivity(true);
    } catch (e) { console.warn('Notification check failed'); }
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

  if (!session) return <Auth onAuthSuccess={() => setView('feed')} />;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 dark:bg-dark-bg border-x border-gray-200 dark:border-dark-border shadow-xl overflow-hidden relative transition-colors duration-300" dir="rtl">
      {dbError && (
        <div 
          onClick={() => setShowSqlGuide(true)}
          className="bg-red-600 text-white px-4 py-3 text-[10px] font-black flex flex-col items-center justify-center gap-1 cursor-pointer animate-pulse z-50 shadow-lg"
        >
          <div className="flex items-center gap-2">
            {dbError.type === 'API_KEY' ? <Key size={14} /> : <Database size={14} />}
            <span>{dbError.type === 'API_KEY' ? 'خطای کلید امنیتی' : 'جداول دیتابیس تنظیم نیستند'}</span>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-dark-card border-b border-gray-100 dark:border-dark-border px-5 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setView('feed')}>
          <div className="bg-orange-500 p-1.5 rounded-xl">
             <Pizza className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">چی بُقولم؟</h1>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-gray-400 p-2"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {view === 'feed' && <Feed onRestaurantClick={(id) => { setPrevView(view); setSelectedRestId(id); setView('restaurant_detail'); }} onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} />}
        {view === 'near_me' && <NearMe onRestaurantClick={(id) => { setPrevView(view); setSelectedRestId(id); setView('restaurant_detail'); }} />}
        {view === 'create' && <CreatePost onComplete={() => setView('feed')} />}
        {view === 'dashboard' && <RestaurantDashboard ownerRecord={ownerRecord} onRefreshOwnership={() => checkOwnership(session.user.id)} />}
        {view === 'profile' && profile && (
          <ProfileView 
            profile={profile} 
            hasUnread={hasNewActivity} 
            onMarkAsRead={() => { markAsRead(); }} 
            onRequestNotification={subscribeToPush}
            onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} 
            onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} 
            onOpenAdmin={() => setView('admin')}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        )}
        {view === 'user_profile' && selectedUserId && <ProfileView key={selectedUserId} userId={selectedUserId} onBack={() => setView(prevView)} onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} onUserClick={(uid) => { setSelectedUserId(uid); setView('user_profile'); }} />}
        {view === 'admin' && profile?.is_admin && <AdminPanel />}
        {view === 'restaurant_detail' && selectedRestId && <RestaurantDetail restaurantId={selectedRestId} onBack={() => setView(prevView)} onPostClick={(id) => { setPrevView(view); setSelectedPostId(id); setView('post_detail'); }} />}
        {view === 'post_detail' && selectedPostId && <PostDetail postId={selectedPostId} onBack={() => setView(prevView)} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-dark-card border-t border-gray-100 dark:border-dark-border px-2 py-2 flex justify-around items-center z-10 shadow-lg">
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
