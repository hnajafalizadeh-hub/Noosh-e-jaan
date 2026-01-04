
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, Post, Profile } from '../types';
import { ShieldCheck, Trash2, AlertCircle, CheckCircle2, XCircle, Copy, User, RefreshCw, ExternalLink, Utensils, MapPin, Eye, FileText, CheckCircle, X, Smartphone, Download } from 'lucide-react';

interface FormattedRequest {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
  verification_status: string;
  national_id_url?: string;
  business_license_url?: string;
  phone?: string;
  owner?: {
    full_name: string;
    username: string;
  };
}

const AdminPanel: React.FC = () => {
  const [requests, setRequests] = useState<FormattedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState<FormattedRequest | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: allRestaurants, error: restErr } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (restErr) throw restErr;

      const { data: allOwners } = await supabase.from('restaurant_owners').select('user_id, restaurant_id');
      const userIds = allOwners?.map(o => o.user_id) || [];
      const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, username').in('id', userIds);

      const formatted: FormattedRequest[] = (allRestaurants || []).map(rest => {
        const ownerLink = allOwners?.find(o => o.restaurant_id === rest.id);
        const profile = ownerLink ? allProfiles?.find(p => p.id === ownerLink.user_id) : null;
        return {
          id: rest.id,
          name: rest.name,
          city: rest.city,
          is_active: !!rest.is_active,
          verification_status: rest.verification_status || 'pending',
          national_id_url: rest.national_id_url,
          business_license_url: rest.business_license_url,
          phone: rest.phone,
          owner: profile ? { full_name: profile.full_name, username: profile.username } : undefined
        };
      });
      setRequests(formatted);
    } catch (e: any) {
      console.error("Admin Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('restaurants').update({ 
        verification_status: status,
        is_active: status === 'approved' 
      }).eq('id', id);
      
      if (error) throw error;
      setSelectedDocs(null);
      fetchData();
    } catch (e: any) {
      alert('خطا در بروزرسانی وضعیت: ' + e.message);
    }
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24" dir="rtl">
      <div className="bg-red-600 p-6 rounded-[2.5rem] text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ShieldCheck size={40} className="opacity-80" />
          <h2 className="text-xl font-black text-white">مدیریت تاییدات</h2>
        </div>
        <button onClick={fetchData} className="p-2 bg-white/20 rounded-xl transition-all active:rotate-180"><RefreshCw size={20}/></button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><ShieldCheck className="animate-pulse text-red-600" size={40}/></div>
        ) : requests.length === 0 ? (
          <p className="text-center py-10 text-xs font-bold text-gray-400 italic">هیچ درخواستی ثبت نشده است.</p>
        ) : requests.map(res => (
          <div key={res.id} className="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
             <div className="flex justify-between items-start">
                <div>
                   <h3 className="font-black text-gray-900 text-sm">{res.name}</h3>
                   <p className="text-[10px] font-bold text-gray-400 mt-1 flex items-center gap-1"><User size={10}/> مالک: {res.owner?.full_name || 'ثبت نشده'}</p>
                   <div className="flex items-center gap-1 mt-1 text-gray-500">
                      <Smartphone size={10}/>
                      <span className="text-[9px] font-bold" dir="ltr">{res.phone || 'بدون شماره'}</span>
                   </div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-[9px] font-black ${
                  res.verification_status === 'approved' ? 'bg-green-50 text-green-600' : 
                  res.verification_status === 'submitted' ? 'bg-blue-50 text-blue-600' : 
                  res.verification_status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  {res.verification_status === 'approved' ? 'تایید نهایی' : 
                   res.verification_status === 'submitted' ? 'در انتظار بررسی' : 
                   res.verification_status === 'rejected' ? 'رد شده' : 'تکمیل نشده'}
                </div>
             </div>

             {(res.verification_status === 'submitted' || res.verification_status === 'rejected') && (
                <button onClick={() => setSelectedDocs(res)} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-100">
                   <Eye size={18} /> مشاهده و تایید مدارک
                </button>
             )}

             {res.verification_status === 'approved' && (
                <div className="flex items-center gap-2 text-green-600 text-[10px] font-black bg-green-50 p-4 rounded-2xl border border-green-100">
                   <CheckCircle size={16} /> این پاتوق تایید شده و فعال است.
                </div>
             )}
          </div>
        ))}
      </div>

      {selectedDocs && (
        <div className="fixed inset-0 bg-black/90 z-[200] p-6 flex items-center justify-center overflow-y-auto backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                 <h3 className="font-black text-gray-900 text-lg">بررسی {selectedDocs.name}</h3>
                 <button onClick={() => setSelectedDocs(null)} className="p-2 text-gray-400 hover:text-red-500"><X size={24} /></button>
              </div>

              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scroll">
                 <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-blue-400 mb-1 uppercase">شماره تماس مدیریت:</p>
                      <p className="text-sm font-black text-blue-900" dir="ltr">{selectedDocs.phone || 'ارسال نشده'}</p>
                    </div>
                    <a href={`tel:${selectedDocs.phone}`} className="p-3 bg-white rounded-xl text-blue-600 shadow-sm"><Smartphone size={18}/></a>
                 </div>
                 
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-gray-400 flex items-center gap-2"><FileText size={14}/> تصویر کارت ملی:</p>
                      {selectedDocs.national_id_url && <a href={selectedDocs.national_id_url} target="_blank" className="text-blue-500 text-[10px] font-black">مشاهده اصلی</a>}
                    </div>
                    {selectedDocs.national_id_url ? (
                      <div className="relative group">
                        <img src={selectedDocs.national_id_url} className="w-full rounded-[2rem] border-2 border-gray-100 shadow-sm transition-all group-hover:scale-[1.02]" />
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 flex items-center justify-center text-[10px] text-gray-400 font-bold italic">تصویری ارسال نشده</div>
                    )}
                 </div>

                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-gray-400 flex items-center gap-2"><FileText size={14}/> تصویر جواز کسب:</p>
                      {selectedDocs.business_license_url && <a href={selectedDocs.business_license_url} target="_blank" className="text-blue-500 text-[10px] font-black">مشاهده اصلی</a>}
                    </div>
                    {selectedDocs.business_license_url ? (
                      <div className="relative group">
                        <img src={selectedDocs.business_license_url} className="w-full rounded-[2rem] border-2 border-gray-100 shadow-sm transition-all group-hover:scale-[1.02]" />
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 flex items-center justify-center text-[10px] text-gray-400 font-bold italic">تصویری ارسال نشده</div>
                    )}
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button onClick={() => handleUpdateStatus(selectedDocs.id, 'approved')} className="flex-1 py-5 bg-green-600 text-white rounded-[1.5rem] font-black text-xs shadow-xl shadow-green-100 active:scale-95 transition-all">تایید و فعال‌سازی</button>
                 <button onClick={() => handleUpdateStatus(selectedDocs.id, 'rejected')} className="flex-1 py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black text-xs border border-red-100 active:scale-95 transition-all">رد درخواست</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
