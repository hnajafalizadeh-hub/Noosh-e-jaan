
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, Post, Profile } from '../types';
import { ShieldCheck, Trash2, AlertCircle, CheckCircle2, XCircle, Copy, User, RefreshCw, ExternalLink, Utensils, MapPin } from 'lucide-react';

interface FormattedRequest {
  id: string;
  name: string;
  city: string;
  full_address?: string;
  is_active: boolean;
  verification_code: string;
  phone?: string;
  source: 'owner_registration' | 'user_suggestion';
  owner?: {
    full_name: string;
    username: string;
  };
}

const AdminPanel: React.FC = () => {
  const [tab, setTab] = useState<'restaurants' | 'posts'>('restaurants');
  const [requests, setRequests] = useState<FormattedRequest[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'restaurants') {
        // ۱. دریافت تمامی رستوران‌ها (مستقل از اینکه مالک دارند یا نه)
        const { data: allRestaurants, error: restError } = await supabase
          .from('restaurants')
          .select('*')
          .order('created_at', { ascending: false });

        if (restError) throw restError;

        // ۲. دریافت تمامی مالکین برای اتصال به رستوران‌ها
        const { data: allOwners, error: ownersError } = await supabase
          .from('restaurant_owners')
          .select('user_id, restaurant_id');

        if (ownersError) throw ownersError;

        // ۳. دریافت پروفایل‌ها برای نمایش نام مالکین
        const userIds = allOwners?.map(o => o.user_id) || [];
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        // ۴. ترکیب داده‌ها
        const formatted: FormattedRequest[] = (allRestaurants || []).map(rest => {
          const ownerLink = allOwners?.find(o => o.restaurant_id === rest.id);
          const profile = ownerLink ? allProfiles?.find(p => p.id === ownerLink.user_id) : null;

          return {
            id: rest.id,
            name: rest.name,
            city: rest.city,
            full_address: rest.full_address,
            is_active: !!rest.is_active,
            verification_code: rest.verification_code || '---',
            phone: rest.phone,
            source: ownerLink ? 'owner_registration' : 'user_suggestion',
            owner: profile ? {
              full_name: profile.full_name,
              username: profile.username
            } : undefined
          };
        });

        setRequests(formatted);
      } else {
        const { data: postsRaw, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (postsError) throw postsError;

        if (postsRaw && postsRaw.length > 0) {
          const resIds = postsRaw.map(p => p.restaurant_id);
          const uIds = postsRaw.map(p => p.user_id);

          const [resRes, profRes] = await Promise.all([
            supabase.from('restaurants').select('id, name').in('id', resIds),
            supabase.from('profiles').select('id, username').in('id', uIds)
          ]);

          const enrichedPosts = postsRaw.map(p => ({
            ...p,
            restaurants: resRes.data?.find(r => r.id === p.restaurant_id),
            profiles: profRes.data?.find(u => u.id === p.user_id)
          }));

          setPosts(enrichedPosts);
        } else {
          setPosts([]);
        }
      }
    } catch (e: any) {
      console.error("Admin Fetch Error:", e.message);
      alert("خطا در به‌روزرسانی لیست.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('restaurants').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert("خطا در تغییر وضعیت: " + e.message);
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      setConfirmDeleteId(null);
      fetchData();
    } catch (e: any) {
      alert("خطا در حذف پست.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('کد فعال‌سازی کپی شد.');
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24" dir="rtl">
      <div className="bg-red-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-red-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ShieldCheck size={40} className="opacity-80" />
          <div>
            <h2 className="text-xl font-black">پنل مدیریت کل</h2>
            <p className="text-[10px] font-bold opacity-70 italic">مدیریت تمامی مکان‌ها و محتوا</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
        <button 
          onClick={() => setTab('restaurants')}
          className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${tab === 'restaurants' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
        >
          رستوران‌ها ({requests.length})
        </button>
        <button 
          onClick={() => setTab('posts')}
          className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${tab === 'posts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
        >
          پست‌ها ({posts.length})
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-red-500 rounded-full"></div></div>
      ) : (
        <div className="space-y-4">
          {tab === 'restaurants' ? (
            requests.length > 0 ? (
              requests.map(res => (
                <div key={res.id} className={`bg-white p-5 rounded-3xl border ${res.is_active ? 'border-gray-100' : 'border-orange-200 bg-orange-50/10'} shadow-sm space-y-4 animate-in slide-in-from-bottom-2`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${res.is_active ? 'bg-gray-100 text-gray-400' : 'bg-orange-100 text-orange-600'}`}>
                          <Utensils size={20} />
                       </div>
                       <div>
                         <h3 className="font-black text-gray-900 text-sm">{res.name}</h3>
                         <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
                            <MapPin size={10} />
                            <span>{res.city} {res.full_address ? `- ${res.full_address.slice(0, 30)}...` : ''}</span>
                         </div>
                       </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black ${res.is_active ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                      {res.is_active ? 'فعال/عمومی' : 'در انتظار تایید'}
                    </span>
                  </div>

                  <div className={`flex items-center gap-2 p-3 rounded-2xl border ${res.source === 'owner_registration' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'}`}>
                    <User size={14} className={res.source === 'owner_registration' ? 'text-blue-500' : 'text-purple-500'} />
                    <p className={`text-[10px] font-black ${res.source === 'owner_registration' ? 'text-blue-900' : 'text-purple-900'}`}>
                      {res.source === 'owner_registration' 
                        ? `درخواست پنل توسط: ${res.owner?.full_name || 'نامشخص'} (@${res.owner?.username || '---'})` 
                        : 'پیشنهاد شده توسط کاربر (بدون مالک)'}
                    </p>
                  </div>

                  {res.source === 'owner_registration' && (
                    <div className="bg-gray-50 p-3 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 mb-1">کد فعال‌سازی پنل:</p>
                        <p className="text-sm font-black text-red-600 tracking-widest">{res.verification_code}</p>
                      </div>
                      <button onClick={() => copyToClipboard(res.verification_code)} className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 active:scale-90 transition-transform">
                        <Copy size={16} />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleToggleActive(res.id, res.is_active)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all ${res.is_active ? 'bg-gray-100 text-gray-500' : 'bg-green-500 text-white shadow-lg shadow-green-100'}`}
                    >
                      {res.is_active ? 'غیرفعال سازی' : 'تایید نهایی و نمایش'}
                    </button>
                    {res.phone && (
                      <a href={`tel:${res.phone}`} className="p-3 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem]">
                <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-[10px] font-bold text-gray-400">لیست رستوران‌ها خالی است.</p>
              </div>
            )
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex gap-4 items-center shadow-sm">
                <img src={post.photo_url} className="w-16 h-16 rounded-2xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-gray-900 truncate">@{post.profiles?.username}</p>
                  <p className="text-[10px] font-bold text-gray-400 truncate">{post.restaurants?.name}</p>
                </div>
                {confirmDeleteId === post.id ? (
                  <button onClick={() => handleDeletePost(post.id)} className="px-3 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black">حذف</button>
                ) : (
                  <button onClick={() => setConfirmDeleteId(post.id)} className="p-3 text-red-600"><Trash2 size={18} /></button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
