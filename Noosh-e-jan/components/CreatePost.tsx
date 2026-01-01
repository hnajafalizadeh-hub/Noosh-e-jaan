
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types';
import { compressImage } from '../lib/imageUtils';
import { Camera, MapPin, Star, X, AlertTriangle, CheckCircle2, Utensils, DollarSign, Car, Sparkles, ShieldCheck } from 'lucide-react';

interface CreatePostProps {
  onComplete: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');
  
  const [ratingFood, setRatingFood] = useState(5);
  const [ratingPrice, setRatingPrice] = useState(5);
  const [ratingParking, setRatingParking] = useState(5);
  const [ratingAmbiance, setRatingAmbiance] = useState(5);

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [newRestName, setNewRestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, [searchQuery]);

  const fetchRestaurants = async () => {
    try {
      let query = supabase.from('restaurants').select('*');
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
      const { data } = await query.limit(5);
      setRestaurants(data || []);
    } catch (e) { console.error(e); }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const RatingRow = ({ label, icon: Icon, value, onChange }: any) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-black text-gray-500 mr-1">
        <Icon size={14} className="text-orange-400" />
        <span>{label}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`flex-1 h-10 rounded-xl flex items-center justify-center font-black transition-all ${
              value >= num ? 'bg-orange-500 text-white scale-[1.02]' : 'bg-gray-100 text-gray-300'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );

  const handleSubmit = async () => {
    if (!photo || !selectedRestaurant) {
      setError('لطفاً عکس و مکان را انتخاب کنید.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('وارد حساب خود شوید.');

      // ۱. فشرده‌سازی
      const compressedBlob = await compressImage(photo, 150);

      // ۲. آپلود مستقیم در سوپابیس
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('post-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(fileName);

      const avgRating = (ratingFood + ratingPrice + ratingParking + ratingAmbiance) / 4;

      const { error: postError } = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          restaurant_id: selectedRestaurant.id,
          photo_url: publicUrl,
          caption,
          rating: avgRating,
          rating_food: ratingFood,
          rating_price: ratingPrice,
          rating_parking: ratingParking,
          rating_ambiance: ratingAmbiance
        }]);

      if (postError) throw postError;

      setIsSuccess(true);
      setTimeout(() => onComplete(), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-bounce"><CheckCircle2 size={60} className="text-green-500 mb-4" /><h3 className="text-xl font-black">منتشر شد!</h3></div>;

  return (
    <div className="p-6 min-h-full pb-24" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-900">ثبت تجربه</h2>
        <button onClick={() => step > 1 ? setStep(1) : onComplete()} className="text-gray-400 p-2"><X size={24} /></button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-700 text-[11px] font-bold animate-in fade-in duration-300">
          <AlertTriangle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center">
             <p className="text-gray-500 font-bold text-sm">کجا غذا خوردی؟</p>
             <button onClick={() => setShowAddRestaurant(!showAddRestaurant)} className="text-[10px] font-black text-orange-600 border border-orange-200 px-3 py-1 rounded-full">{showAddRestaurant ? 'بستن' : 'افزودن مکان جدید'}</button>
          </div>
          <input className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm shadow-sm" placeholder="نام رستوران یا کافه..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <div className="space-y-2">
            {restaurants.map(res => (
              <button key={res.id} onClick={() => { setSelectedRestaurant(res); setStep(2); }} className="w-full flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl text-right hover:border-orange-200 transition-all">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 font-black">{res.name[0]}</div>
                <div><p className="font-bold text-sm text-gray-800">{res.name}</p><p className="text-[10px] text-gray-400">{res.city}</p></div>
              </button>
            ))}
          </div>
          {showAddRestaurant && (
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-3">
               <input className="w-full p-4 rounded-xl border-none font-bold text-sm shadow-inner" placeholder="نام رستوران" onChange={(e) => setNewRestName(e.target.value)} />
               <button onClick={async () => {
                 const { data } = await supabase.from('restaurants').insert([{ name: newRestName, city: 'تهران' }]).select().single();
                 if (data) { setSelectedRestaurant(data); setStep(2); }
               }} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-sm shadow-lg shadow-orange-100">تایید و ادامه</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-left-4">
          <div className="bg-orange-50 p-4 rounded-2xl flex justify-between items-center border border-orange-100">
             <span className="font-black text-sm text-orange-900">{selectedRestaurant?.name}</span>
             <button onClick={() => setStep(1)} className="text-xs text-orange-600 font-bold">تغییر</button>
          </div>
          
          <div className="space-y-3">
            <p className="text-[11px] font-black text-gray-400 mr-2">لطفاً تصویر غذا یا منو مد نظرتون رو بارگذاری کنید:</p>
            <label className="block w-full aspect-video border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer overflow-hidden relative bg-white group hover:border-orange-300 transition-all">
                {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : 
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 px-8">
                  <Camera size={36} className="mb-4 text-orange-200" />
                  <p className="text-[12px] font-black text-gray-600 text-center leading-relaxed">
                    انتخاب تصویر غذا یا منو
                  </p>
                </div>}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <RatingRow label="کیفیت و طعم غذا" icon={Utensils} value={ratingFood} onChange={setRatingFood} />
            <RatingRow label="تناسب قیمت" icon={DollarSign} value={ratingPrice} onChange={setRatingPrice} />
            <RatingRow label="جای پارک مناسب" icon={Car} value={ratingParking} onChange={setRatingParking} />
            <RatingRow label="فضای رستوران" icon={Sparkles} value={ratingAmbiance} onChange={setRatingAmbiance} />
          </div>

          <textarea className="w-full p-4 bg-white border border-gray-200 rounded-2xl min-h-[100px] text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" placeholder="نظرت رو بنویس..." value={caption} onChange={(e) => setCaption(e.target.value)} />
          
          <button 
            onClick={handleSubmit} 
            disabled={loading || !photo} 
            className="w-full py-4.5 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-100 active:scale-95 disabled:bg-gray-200 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'در حال انتشار...' : 'اشتراک‌گذاری تجربه'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreatePost;
