
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantOwner, MenuItem, MenuCategory } from '../types';
import { compressImage } from '../lib/imageUtils';
import { 
  Settings, Plus, Trash2, X, MapPin, Save, Utensils, 
  Info, DollarSign, AlertCircle, ShieldCheck, 
  CheckCircle2, Camera, Image as ImageIcon,
  Phone, Edit3, Loader2, Clock, MessageCircle, RefreshCw, Link2, Navigation, Target
} from 'lucide-react';

interface Props {
  ownerRecord: RestaurantOwner | null;
  onRefreshOwnership: () => void;
}

const CATEGORIES: { value: MenuCategory; label: string }[] = [
  { value: 'main', label: 'غذاهای اصلی' },
  { value: 'appetizer', label: 'پیش‌غذا' },
  { value: 'drink', label: 'نوشیدنی' },
  { value: 'dessert', label: 'دسر' },
  { value: 'other', label: 'سایر' },
];

const RestaurantDashboard: React.FC<Props> = ({ ownerRecord, onRefreshOwnership }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState<MenuCategory>('main');

  const [regName, setRegName] = useState('');
  const [editInfoMode, setEditInfoMode] = useState(false);
  const [editRestData, setEditRestData] = useState<Partial<Restaurant>>({});

  useEffect(() => {
    if (ownerRecord) fetchData();
    else setLoading(false);
  }, [ownerRecord]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [restRes, menuRes] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', ownerRecord?.restaurant_id).single(),
        supabase.from('menu_items').select('*').eq('restaurant_id', ownerRecord?.restaurant_id).order('created_at', { ascending: false })
      ]);
      setRestaurant(restRes.data);
      setEditRestData(restRes.data || {});
      setMenuItems(menuRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (text: string, type: 'error' | 'success' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleRegister = async () => {
    if (!regName) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const mockCode = Math.random().toString(36).substring(7).toUpperCase();
      const { data: rest, error } = await supabase.from('restaurants').insert([{ 
        name: regName, city: 'تهران', verification_code: mockCode, is_active: false
      }]).select().single();
      
      if (error) throw error;
      if (rest) {
        await supabase.from('restaurant_owners').insert([{ user_id: user.id, restaurant_id: rest.id, role: 'owner' }]);
        onRefreshOwnership();
      }
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally { setSaving(false); }
  };

  const getCurrentGPS = () => {
    if (!navigator.geolocation) {
      showStatus('مرورگر شما از مکان‌یابی پشتیبانی نمی‌کند', 'error');
      return;
    }
    showStatus('درحال دریافت موقعیت GPS...', 'success');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditRestData({
          ...editRestData,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        showStatus('موقعیت دقیق با موفقیت دریافت شد');
      },
      (err) => showStatus('خطا در دریافت مکان. لطفاً دسترسی GPS را چک کنید.', 'error'),
      { enableHighAccuracy: true }
    );
  };

  const handleUpsertItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !ownerRecord) return;
    setSaving(true);
    try {
      const payload: any = {
        restaurant_id: ownerRecord.restaurant_id,
        name: itemName,
        price: parseFloat(itemPrice),
        category: itemCategory
      };
      const { error } = editItemId 
        ? await supabase.from('menu_items').update(payload).eq('id', editItemId)
        : await supabase.from('menu_items').insert([payload]);

      if (error) throw error;
      showStatus(editItemId ? 'غذا ویرایش شد' : 'غذا به منو اضافه شد');
      resetForm();
      fetchData();
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditItemId(null);
    setItemName('');
    setItemPrice('');
    setItemCategory('main');
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
      showStatus('آیتم حذف شد');
      setConfirmDeleteId(null);
      fetchData();
    } catch (e: any) {
      showStatus('خطا در حذف آیتم', 'error');
    }
  };

  const handleUpdateRest = async () => {
    if (!restaurant) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('restaurants').update(editRestData).eq('id', restaurant.id);
      if (error) throw error;
      setRestaurant({ ...restaurant, ...editRestData });
      setEditInfoMode(false);
      showStatus('اطلاعات رستوران به‌روز شد');
    } catch (e: any) {
      showStatus('خطا در ذخیره اطلاعات', 'error');
    } finally { setSaving(false); }
  };

  const handleAssetUpload = async (file: File, type: 'cover' | 'logo') => {
    if (!restaurant) return;
    setSaving(true);
    try {
      const compressed = await compressImage(file, type === 'cover' ? 500 : 200);
      const fileName = `${restaurant.id}/${type}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('restaurant-assets')
        .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(fileName);
      const updatePayload = type === 'cover' ? { cover_image: publicUrl } : { logo_url: publicUrl };
      const { error: updateError } = await supabase.from('restaurants').update(updatePayload).eq('id', restaurant.id);
      if (updateError) throw updateError;

      if (type === 'cover') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('profiles').update({ cover_url: publicUrl }).eq('id', user.id);
      }

      setRestaurant({ ...restaurant, ...updatePayload });
      showStatus(type === 'cover' ? 'پس‌زمینه رستوران و پروفایل هماهنگ شد' : 'لوگو تغییر کرد');
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center flex flex-col items-center gap-4"><Loader2 className="animate-spin text-orange-500" size={40} /><span className="text-xs font-bold text-gray-400">درحال بارگذاری...</span></div>;

  if (!ownerRecord) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in">
        <div className="text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
            <Utensils className="text-orange-500" size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900">صاحب رستوران هستید؟</h2>
          <p className="text-xs font-bold text-gray-400 mt-2">رستوران خود را ثبت کنید و مدیریت منو را آغاز کنید.</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
          <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none" placeholder="نام رستوران" value={regName} onChange={e => setRegName(e.target.value)} />
          <button onClick={handleRegister} disabled={saving} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg flex justify-center items-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={20} /> : 'ثبت رستوران من'}
          </button>
        </div>
      </div>
    );
  }

  if (restaurant && restaurant.is_active === false) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95" dir="rtl">
        <div className="relative">
          <div className="w-32 h-32 bg-orange-50 rounded-[3rem] flex items-center justify-center text-orange-500">
            <Clock size={64} className="animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-2xl shadow-xl border border-orange-100"><ShieldCheck size={24} className="text-blue-500" /></div>
        </div>
        <div className="space-y-4 max-w-xs">
          <h2 className="text-2xl font-black text-gray-900">در انتظار تایید</h2>
          <p className="text-sm font-bold text-gray-500 leading-relaxed">لطفاً مدارک خود را جهت تاییدیه به شماره واتس‌اپ زیر ارسال کنید.</p>
        </div>
        <div className="w-full bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6">
           <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">واتس‌اپ جهت تایید</span>
              <span className="text-2xl font-black text-gray-900 tracking-widest" dir="ltr">0933 572 5207</span>
           </div>
           <div className="flex gap-3">
             <a href="https://wa.me/989335725207" target="_blank" rel="noreferrer" className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><MessageCircle size={20} /> ارسال پیام</a>
             <button onClick={fetchData} className="p-4 bg-gray-50 text-gray-400 rounded-2xl border border-gray-100 active:rotate-180 transition-all duration-500"><RefreshCw size={20} /></button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24" dir="rtl">
      {statusMsg && (
        <div className={`fixed top-20 left-4 right-4 z-[100] p-4 rounded-2xl shadow-2xl border-2 animate-in slide-in-from-top-4 ${statusMsg.type === 'success' ? 'bg-green-600 border-green-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
           <p className="text-xs font-black text-center">{statusMsg.text}</p>
        </div>
      )}

      {/* Cover Header */}
      <div className="relative h-60 w-full bg-gray-200 overflow-hidden">
        {restaurant?.cover_image ? (
          <img src={restaurant.cover_image} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-orange-50/50">
             <ImageIcon size={40} className="opacity-20 mb-2" />
             <span className="text-[10px] font-bold">بدون تصویر پس‌زمینه</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30 flex items-center gap-1.5">
           <Link2 size={12} className="text-white" />
           <span className="text-[8px] font-black text-white uppercase">متصل به پروفایل</span>
        </div>
        <label className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-all flex items-center gap-2">
          {saving ? <Loader2 className="animate-spin text-orange-500" size={18} /> : <Camera size={18} className="text-orange-500" />}
          <span className="text-[10px] font-black text-gray-700">تغییر عکس پس‌زمینه</span>
          <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleAssetUpload(e.target.files[0], 'cover')} disabled={saving} />
        </label>
      </div>

      <div className="mt-8 px-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-gray-900">{restaurant?.name}</h2>
            <div className="flex items-center gap-1 mt-1">
               <ShieldCheck size={12} className="text-blue-500" />
               <p className="text-[10px] font-bold text-gray-400">پنل مدیریت تایید شده</p>
            </div>
          </div>
          <button onClick={() => setEditInfoMode(!editInfoMode)} className={`p-3 rounded-2xl border transition-all ${editInfoMode ? 'bg-orange-500 text-white border-orange-500 shadow-lg' : 'bg-white text-gray-400 border-gray-100 hover:text-orange-500'}`}><Settings size={22} /></button>
        </div>

        {editInfoMode && (
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-orange-100 shadow-2xl space-y-5 animate-in zoom-in-95">
            <h4 className="text-xs font-black text-orange-600">ویرایش اطلاعات رستوران</h4>
            <div className="space-y-4">
              <input className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-orange-200" value={editRestData.name} onChange={e => setEditRestData({...editRestData, name: e.target.value})} placeholder="نام رستوران" />
              <textarea className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold min-h-[100px] outline-none border border-transparent focus:border-orange-200" value={editRestData.full_address || ''} onChange={e => setEditRestData({...editRestData, full_address: e.target.value})} placeholder="آدرس دقیق و کامل" />
              
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400">مختصات GPS دقیق</span>
                    <button onClick={getCurrentGPS} className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-[9px] font-black flex items-center gap-1 shadow-md active:scale-95 transition-all">
                       <Target size={12} /> ثبت مکان فعلی من
                    </button>
                 </div>
                 <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-white rounded-xl text-center border border-gray-100">
                       <p className="text-[8px] font-bold text-gray-400 mb-1">عرض جغرافیایی (Lat)</p>
                       <p className="text-[11px] font-black text-gray-800">{editRestData.lat?.toFixed(6) || '---'}</p>
                    </div>
                    <div className="flex-1 p-3 bg-white rounded-xl text-center border border-gray-100">
                       <p className="text-[8px] font-bold text-gray-400 mb-1">طول جغرافیایی (Lng)</p>
                       <p className="text-[11px] font-black text-gray-800">{editRestData.lng?.toFixed(6) || '---'}</p>
                    </div>
                 </div>
              </div>
            </div>
            <button onClick={handleUpdateRest} disabled={saving} className="w-full py-4 bg-orange-500 text-white rounded-2xl text-xs font-black shadow-lg flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : 'ذخیره تمامی تغییرات'}</button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-gray-800 text-sm">لیست غذاها</h4>
            <button onClick={() => { resetForm(); setShowAddForm(true); }} className="bg-orange-600 text-white px-4 py-2.5 rounded-2xl text-[11px] font-black shadow-lg flex items-center gap-2 active:scale-95 transition-all"><Plus size={16} /> افزودن غذا</button>
          </div>

          {showAddForm && (
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-orange-500 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center"><span className="text-sm font-black text-orange-600">{editItemId ? 'ویرایش آیتم' : 'ثبت غذای جدید'}</span><button onClick={resetForm} className="text-gray-300 hover:text-red-500"><X size={20} /></button></div>
              <div className="space-y-3">
                <input required className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-orange-200" placeholder="نام غذا" value={itemName} onChange={e => setItemName(e.target.value)} />
                <div className="relative"><input type="number" className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none pr-12 border border-transparent focus:border-orange-200" placeholder="قیمت" value={itemPrice} onChange={e => setItemPrice(e.target.value)} /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">تومان</span></div>
                <select className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none appearance-none border border-transparent focus:border-orange-200" value={itemCategory} onChange={e => setItemCategory(e.target.value as MenuCategory)}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              </div>
              <button onClick={handleUpsertItem} disabled={saving} className="w-full py-4 bg-orange-600 text-white rounded-2xl text-xs font-black shadow-lg flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : 'تایید و ذخیره در منو'}</button>
            </div>
          )}

          <div className="space-y-6">
            {CATEGORIES.map(cat => {
              const items = menuItems.filter(i => (i.category || 'other') === cat.value);
              if (items.length === 0) return null;
              return (
                <div key={cat.value} className="space-y-3">
                  <div className="flex items-center gap-2 mr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                    <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-wide">{cat.label}</h5>
                  </div>
                  <div className="grid gap-3">
                    {items.map(item => (
                      <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex-1">
                          <p className="text-sm font-black text-gray-800">{item.name}</p>
                          <p className="text-[11px] font-bold text-orange-600 mt-1">{item.price.toLocaleString()} تومان</p>
                        </div>
                        <div className="flex gap-2">
                          {confirmDeleteId === item.id ? (
                            <div className="flex gap-1 animate-in fade-in zoom-in-95"><button onClick={() => handleDeleteItem(item.id)} className="bg-red-600 text-white px-3 py-2 rounded-xl text-[10px] font-black">حذف قطعی</button><button onClick={() => setConfirmDeleteId(null)} className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl text-[10px] font-black">لغو</button></div>
                          ) : (
                            <>
                              <button onClick={() => { setEditItemId(item.id); setItemName(item.name); setItemPrice(item.price.toString()); setItemCategory(item.category || 'main'); setShowAddForm(true); }} className="p-3 text-blue-500 bg-blue-50 rounded-2xl"><Edit3 size={18} /></button>
                              <button onClick={() => setConfirmDeleteId(item.id)} className="p-3 text-red-400 bg-red-50 rounded-2xl"><Trash2 size={18} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantDashboard;
