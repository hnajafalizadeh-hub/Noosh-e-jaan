
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantOwner, MenuItem, MenuCategoryDef } from '../types';
import { compressImage } from '../lib/imageUtils';
import { 
  Settings, Plus, Trash2, X, MapPin, Save, Utensils, 
  Info, DollarSign, AlertCircle, ShieldCheck, 
  CheckCircle2, Camera, Image as ImageIcon,
  Phone, Edit3, Loader2, Clock, MessageCircle, RefreshCw, Upload,
  CookingPot, Soup, Beef, Zap, Pizza, ChefHat, Drumstick, GlassWater, CakeSlice, FileText, CheckCircle, Map, Navigation, Crosshair, LocateFixed, Tag
} from 'lucide-react';

declare var L: any; 

interface Props {
  ownerRecord: RestaurantOwner | null;
  onRefreshOwnership: () => void;
}

const CATEGORY_MAP: Record<string, any> = {
  CookingPot: CookingPot,
  Soup: Soup,
  Beef: Beef,
  Zap: Zap,
  Pizza: Pizza,
  ChefHat: ChefHat,
  Drumstick: Drumstick,
  GlassWater: GlassWater,
  CakeSlice: CakeSlice,
  Utensils: Utensils
};

const CATEGORIES: MenuCategoryDef[] = [
  { key: 'cheloei', title_fa: 'چلویی', icon_name: 'CookingPot' },
  { key: 'khoresht', title_fa: 'خورشت', icon_name: 'Soup' },
  { key: 'khorak', title_fa: 'خوراک', icon_name: 'Beef' },
  { key: 'fastfood', title_fa: 'فست فود', icon_name: 'Zap' },
  { key: 'pizza', title_fa: 'پیتزا', icon_name: 'Pizza' },
  { key: 'burger', title_fa: 'همبرگر', icon_name: 'ChefHat' },
  { key: 'fried', title_fa: 'سوخاری', icon_name: 'Drumstick' },
  { key: 'drink', title_fa: 'نوشیدنی', icon_name: 'GlassWater' },
  { key: 'dessert', title_fa: 'دسر', icon_name: 'CakeSlice' },
  { key: 'other', title_fa: 'سایر', icon_name: 'Utensils' },
];

const RestaurantDashboard: React.FC<Props> = ({ ownerRecord, onRefreshOwnership }) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'settings'>('menu');
  
  const [showMapModal, setShowMapModal] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [phone, setPhone] = useState('');
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null);
  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null);

  const [restName, setRestName] = useState('');
  const [restAddress, setRestAddress] = useState('');
  const [restPhone, setRestPhone] = useState('');
  const [restHours, setRestHours] = useState('');
  const [restLat, setRestLat] = useState('');
  const [restLng, setRestLng] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDiscountPrice, setItemDiscountPrice] = useState('');
  const [itemCategory, setItemCategory] = useState<string>('cheloei');
  const [itemDescription, setItemDescription] = useState('');
  const [regName, setRegName] = useState('');

  useEffect(() => {
    if (ownerRecord) fetchData();
    else setLoading(false);
  }, [ownerRecord]);

  useEffect(() => {
    if (showMapModal && mapContainerRef.current) {
      const timer = setTimeout(() => {
        const initialLat = restLat ? parseFloat(restLat) : 35.6892;
        const initialLng = restLng ? parseFloat(restLng) : 51.3890;
        mapInstanceRef.current = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);
        markerInstanceRef.current = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapInstanceRef.current);
        mapInstanceRef.current.on('click', (e: any) => { markerInstanceRef.current.setLatLng(e.latlng); });
      }, 100);
      return () => { clearTimeout(timer); if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }
  }, [showMapModal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: restData } = await supabase.from('restaurants').select('*').eq('id', ownerRecord?.restaurant_id).single();
      const { data: menuData } = await supabase.from('menu_items').select('*').eq('restaurant_id', ownerRecord?.restaurant_id).order('created_at', { ascending: false });
      setRestaurant(restData);
      setMenuItems(menuData || []);
      if (restData) {
        setPhone(restData.phone || '');
        setRestName(restData.name || '');
        setRestAddress(restData.full_address || '');
        setRestPhone(restData.phone || '');
        setRestHours(restData.working_hours || '');
        setRestLat(restData.lat?.toString() || '');
        setRestLng(restData.lng?.toString() || '');
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const showStatus = (text: string, type: 'error' | 'success' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const handleConfirmMapSelection = () => {
    if (markerInstanceRef.current) {
      const { lat, lng } = markerInstanceRef.current.getLatLng();
      setRestLat(lat.toFixed(6));
      setRestLng(lng.toFixed(6));
      setShowMapModal(false);
      showStatus('موقعیت از روی نقشه انتخاب شد', 'success');
    }
  };

  const getCurrentGPS = () => {
    setFetchingGps(true);
    if (!navigator.geolocation) { showStatus('مرورگر شما از GPS پشتیبانی نمی‌کند', 'error'); setFetchingGps(false); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setRestLat(position.coords.latitude.toFixed(6)); setRestLng(position.coords.longitude.toFixed(6)); showStatus('لوکیشن شما با موفقیت دریافت شد', 'success'); setFetchingGps(false); },
      (error) => { showStatus('خطا در دریافت لوکیشن', 'error'); setFetchingGps(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileUpload = async (file: File, prefix: string, bucket: string = 'verification-docs') => {
    const cleanName = `${prefix}-${Date.now()}.jpg`;
    const path = `${ownerRecord?.restaurant_id}/${cleanName}`;
    const compressed = await compressImage(file, 400);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw new Error(`خطا در آپلود: ${uploadError.message}`);
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  const handleUpdateProfileImage = async (file: File, type: 'cover' | 'logo') => {
    setSaving(true);
    try {
      const bucket = type === 'cover' ? 'post-photos' : 'avatars'; 
      const url = await handleFileUpload(file, type, bucket);
      const updateData = type === 'cover' ? { cover_image: url } : { logo_url: url };
      const { error } = await supabase.from('restaurants').update(updateData).eq('id', restaurant?.id);
      if (error) throw error;
      showStatus('تصویر با موفقیت به‌روزرسانی شد');
      fetchData();
    } catch (e: any) { showStatus(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('restaurants').update({
        name: restName,
        full_address: restAddress,
        phone: restPhone,
        working_hours: restHours,
        lat: restLat ? parseFloat(restLat) : null,
        lng: restLng ? parseFloat(restLng) : null
      }).eq('id', restaurant?.id);
      if (error) throw error;
      showStatus('تنظیمات با موفقیت ذخیره شد');
      fetchData();
    } catch (e: any) { showStatus(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleSubmitVerification = async () => {
    if (!phone || !nationalIdFile || !businessLicenseFile) { showStatus('لطفاً تمامی موارد را تکمیل کنید', 'error'); return; }
    setSaving(true);
    try {
      const [natUrl, licUrl] = await Promise.all([ handleFileUpload(nationalIdFile, 'national-id'), handleFileUpload(businessLicenseFile, 'business-license') ]);
      const { error } = await supabase.from('restaurants').update({ phone, national_id_url: natUrl, business_license_url: licUrl, verification_status: 'submitted' }).eq('id', restaurant?.id);
      if (error) throw error;
      showStatus('مدارک ارسال شد. منتظر تایید بمانید.');
      fetchData();
    } catch (e: any) { showStatus(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleUpsertItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !ownerRecord) return;
    setSaving(true);
    try {
      const payload: any = {
        restaurant_id: ownerRecord.restaurant_id,
        name: itemName.trim(),
        price: parseFloat(itemPrice),
        discount_price: (itemDiscountPrice && itemDiscountPrice.trim() !== '') ? parseFloat(itemDiscountPrice) : null,
        category_key: itemCategory,
        description: itemDescription.trim()
      };
      
      const { error } = editItemId 
        ? await supabase.from('menu_items').update(payload).eq('id', editItemId)
        : await supabase.from('menu_items').insert([payload]);
      
      if (error) {
        console.error("Database Error:", error);
        // اگر خطا به دلیل نبود ستون باشد، پیام راهنما می‌دهیم
        if (error.message.includes('discount_price') || error.code === '42703') {
           throw new Error('خطا: ستون تخفیف در دیتابیس یافت نشد. لطفاً اسکریپت SQL را در Supabase اجرا کنید.');
        }
        throw error;
      }
      
      showStatus(editItemId ? 'غذا ویرایش شد' : 'غذا به منو اضافه شد');
      resetForm();
      fetchData();
    } catch (e: any) { 
      showStatus(e.message, 'error'); 
    } finally { 
      setSaving(false); 
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditItemId(null);
    setItemName('');
    setItemPrice('');
    setItemDiscountPrice('');
    setItemCategory('cheloei');
    setItemDescription('');
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

  if (!ownerRecord) {
    return (
      <div className="p-8 space-y-8" dir="rtl">
        <div className="text-center">
          <Utensils className="text-orange-500 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-black">پنل رستوران</h2>
          <p className="text-xs text-gray-400">نام پاتوق خود را ثبت کنید</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-4">
          <input className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold" placeholder="نام رستوران" value={regName} onChange={e => setRegName(e.target.value)} />
          <button onClick={async () => {
            if(!regName) return;
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { data: rest } = await supabase.from('restaurants').insert([{ name: regName, city: 'تهران', verification_status: 'pending' }]).select().single();
            if (rest && user) {
              await supabase.from('restaurant_owners').insert([{ user_id: user.id, restaurant_id: rest.id }]);
              onRefreshOwnership();
            }
            setSaving(false);
          }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black">ثبت رستوران</button>
        </div>
      </div>
    );
  }

  if (restaurant?.verification_status === 'pending' || restaurant?.verification_status === 'rejected' || !restaurant?.verification_status) {
    return (
      <div className="p-6 space-y-6 pb-24" dir="rtl">
        {statusMsg && (
          <div className={`fixed top-4 left-4 right-4 z-[100] p-4 rounded-2xl text-white font-black text-center text-[11px] shadow-2xl animate-in fade-in zoom-in-95 ${statusMsg.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {statusMsg.text}
          </div>
        )}
        <div className="bg-orange-500 p-8 rounded-[2.5rem] text-white shadow-xl">
          <ShieldCheck size={40} className="mb-4 opacity-80" />
          <h2 className="text-xl font-black">احراز هویت مدیریت</h2>
          <p className="text-[10px] opacity-90">برای ثبت منو، ابتدا مدارک زیر را جهت تایید بارگذاری نمایید.</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-6">
          <input className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="شماره تماس" value={phone} onChange={e => setPhone(e.target.value)} />
          <div className="space-y-4">
            <div className="relative">
               <input type="file" id="nat-id" className="hidden" accept="image/*" onChange={e => setNationalIdFile(e.target.files?.[0] || null)} />
               <label htmlFor="nat-id" className={`w-full p-4 border-2 border-dashed rounded-2xl flex items-center justify-between cursor-pointer transition-all ${nationalIdFile ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-orange-300'}`}>
                  <span className="text-[11px] font-bold text-gray-500 truncate">{nationalIdFile ? nationalIdFile.name : 'انتخاب تصویر کارت ملی'}</span>
                  {nationalIdFile ? <CheckCircle className="text-green-500" size={18}/> : <Upload className="text-gray-300" size={18}/>}
               </label>
            </div>
            <div className="relative">
               <input type="file" id="biz-id" className="hidden" accept="image/*" onChange={e => setBusinessLicenseFile(e.target.files?.[0] || null)} />
               <label htmlFor="biz-id" className={`w-full p-4 border-2 border-dashed rounded-2xl flex items-center justify-between cursor-pointer transition-all ${businessLicenseFile ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-orange-300'}`}>
                  <span className="text-[11px] font-bold text-gray-500 truncate">{businessLicenseFile ? businessLicenseFile.name : 'انتخاب تصویر جواز کسب'}</span>
                  {businessLicenseFile ? <CheckCircle className="text-green-500" size={18}/> : <Upload className="text-gray-300" size={18}/>}
               </label>
            </div>
          </div>
          <button onClick={handleSubmitVerification} disabled={saving} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black flex justify-center items-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={20}/> : 'ارسال مدارک'}
          </button>
        </div>
      </div>
    );
  }

  if (restaurant?.verification_status === 'submitted') {
    return <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh]"><Clock size={48} className="text-blue-500 mb-4 animate-pulse" /><h2 className="text-xl font-black">در انتظار تایید ادمین...</h2><p className="text-xs text-gray-400 mt-2 font-bold">مدارک شما در صف بررسی قرار گرفت.</p></div>;
  }

  return (
    <div className="pb-24" dir="rtl">
      {statusMsg && (
        <div className={`fixed top-20 left-4 right-4 z-[100] p-4 rounded-2xl text-white font-black text-center animate-in fade-in slide-in-from-top-2 shadow-2xl ${statusMsg.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {statusMsg.text}
        </div>
      )}

      <div className="h-56 bg-gray-200 relative group overflow-hidden">
        {restaurant?.cover_image ? <img src={restaurant.cover_image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={48}/></div>}
        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
           <Camera size={32} className="text-white" />
           <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpdateProfileImage(e.target.files[0], 'cover')} />
        </label>
        <div className="absolute -bottom-10 right-6 w-24 h-24 rounded-[2rem] bg-white p-1 shadow-xl group/logo">
           <div className="w-full h-full rounded-[1.8rem] bg-orange-50 flex items-center justify-center overflow-hidden border-2 border-white relative">
              {restaurant?.logo_url ? <img src={restaurant.logo_url} className="w-full h-full object-cover" /> : <Utensils className="text-orange-200" size={32} />}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                 <Camera size={16} className="text-white" />
                 <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpdateProfileImage(e.target.files[0], 'logo')} />
              </label>
           </div>
        </div>
      </div>

      <div className="mt-14 px-6">
        <div className="flex bg-white rounded-2xl p-1 mb-8 shadow-sm border border-gray-100">
           <button onClick={() => setActiveTab('menu')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'menu' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-400'}`}>مدیریت منو</button>
           <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'settings' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-400'}`}>تنظیمات پاتوق</button>
        </div>

        {activeTab === 'settings' ? (
          <div className="space-y-6 animate-in slide-in-from-left-4">
             <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 space-y-4 shadow-sm">
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 mr-2 flex items-center gap-1"><Info size={12}/> نام رستوران:</label><input className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" value={restName} onChange={e => setRestName(e.target.value)} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 mr-2 flex items-center gap-1"><MapPin size={12}/> آدرس دقیق:</label><textarea className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" value={restAddress} onChange={e => setRestAddress(e.target.value)} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 mr-2 flex items-center gap-1"><Phone size={12}/> شماره تماس پاتوق:</label><input className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold text-left" dir="ltr" value={restPhone} onChange={e => setRestPhone(e.target.value)} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 mr-2 flex items-center gap-1"><Clock size={12}/> ساعت کاری:</label><input className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold text-left" dir="ltr" placeholder="09:00-23:30" value={restHours} onChange={e => setRestHours(e.target.value)} /></div>
                <div className="space-y-3 pt-2">
                   <div className="flex justify-between items-center mr-2"><label className="text-[10px] font-black text-gray-400 flex items-center gap-1"><Navigation size={12}/> موقعیت جغرافیایی:</label><div className="flex gap-2"><button onClick={getCurrentGPS} disabled={fetchingGps} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-all">{fetchingGps ? <Loader2 className="animate-spin" size={12}/> : <LocateFixed size={12}/>} خودکار</button><button onClick={() => setShowMapModal(true)} className="text-[9px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-all"><Map size={12}/> نقشه</button></div></div>
                   <div className="grid grid-cols-2 gap-4">
                      <input className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold text-center" placeholder="عرض" value={restLat} onChange={e => setRestLat(e.target.value)} />
                      <input className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold text-center" placeholder="طول" value={restLng} onChange={e => setRestLng(e.target.value)} />
                   </div>
                </div>
                <button onClick={handleSaveSettings} disabled={saving} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">{saving ? <Loader2 className="animate-spin" size={20}/> : <><Save size={18}/> ذخیره تنظیمات</>}</button>
             </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900">مدیریت منوی غذا</h3>
              <button onClick={() => { resetForm(); setShowAddForm(true); }} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 shadow-lg active:scale-95"><Plus size={16} /> افزودن غذا</button>
            </div>
            {showAddForm && (
              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-orange-500 space-y-4 shadow-xl animate-in zoom-in-95">
                <div className="flex justify-between items-center"><span className="font-black text-orange-600">اطلاعات غذا</span><button onClick={resetForm}><X size={20}/></button></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 mr-2">نام غذا:</label><input className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" placeholder="نام غذا" value={itemName} onChange={e => setItemName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 mr-2">قیمت اصلی:</label><input className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" placeholder="تومان" type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-orange-500 mr-2 flex items-center gap-1"><Tag size={10}/> قیمت تخفیف (اختیاری):</label><input className="w-full p-4 bg-orange-50 border border-orange-100 rounded-2xl text-xs font-bold text-orange-600" placeholder="تومان" type="number" value={itemDiscountPrice} onChange={e => setItemDiscountPrice(e.target.value)} /></div>
                </div>
                <textarea className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" placeholder="توضیحات کوتاه..." value={itemDescription} onChange={e => setItemDescription(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = CATEGORY_MAP[cat.icon_name];
                    return (<button key={cat.key} onClick={() => setItemCategory(cat.key)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black transition-all ${itemCategory === cat.key ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-50 border-gray-100 text-gray-500'}`}><Icon size={14} /> {cat.title_fa}</button>);
                  })}
                </div>
                <button onClick={handleUpsertItem} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm active:scale-95">ذخیره غذا</button>
              </div>
            )}
            <div className="space-y-6">
              {CATEGORIES.map(cat => {
                const items = menuItems.filter(i => i.category_key === cat.key);
                if (items.length === 0) return null;
                const Icon = CATEGORY_MAP[cat.icon_name];
                return (
                  <div key={cat.key} className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-400"><Icon size={16} className="text-orange-500" /><span className="text-xs font-black">{cat.title_fa}</span></div>
                    <div className="grid gap-3">
                      {items.map(item => (
                        <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm">
                          <div>
                            <p className="text-sm font-black text-gray-900">{item.name}</p>
                            {item.discount_price ? (
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] font-bold text-gray-300 line-through">{item.price.toLocaleString()}</p>
                                <p className="text-[11px] font-black text-orange-600">{item.discount_price.toLocaleString()} تومان</p>
                              </div>
                            ) : (
                              <p className="text-[11px] font-bold text-orange-600">{item.price.toLocaleString()} تومان</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditItemId(item.id); setItemName(item.name); setItemPrice(item.price.toString()); setItemDiscountPrice(item.discount_price?.toString() || ''); setItemCategory(item.category_key); setItemDescription(item.description || ''); setShowAddForm(true); }} className="p-2 bg-blue-50 text-blue-500 rounded-lg active:scale-90"><Edit3 size={16}/></button>
                            <button onClick={async () => { if(confirm('حذف شود؟')) { await supabase.from('menu_items').delete().eq('id', item.id); fetchData(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg active:scale-90"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showMapModal && (
        <div className="fixed inset-0 bg-black/80 z-[200] p-4 flex items-center justify-center backdrop-blur-sm">
           <div className="bg-white w-full h-[80vh] max-w-md rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
              <div className="p-5 flex justify-between items-center border-b border-gray-100">
                 <h3 className="font-black text-gray-900">انتخاب مکان رستوران</h3>
                 <button onClick={() => setShowMapModal(false)} className="p-2 text-gray-400"><X size={24} /></button>
              </div>
              <div className="flex-1 relative"><div ref={mapContainerRef} className="w-full h-full" /></div>
              <div className="p-6 bg-gray-50"><button onClick={handleConfirmMapSelection} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"><CheckCircle2 size={20}/> تایید این موقعیت</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
