
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types';
import { compressImage } from '../lib/imageUtils';
import { Camera, Star, X, AlertTriangle, CheckCircle2, Utensils, DollarSign, Car, Sparkles, Send, Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';

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
  
  // Photo states
  const [imageFile, setImageFile] = useState<File | null>(null);
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
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!imageFile || !selectedRestaurant) {
      setError('عکس و رستوران را انتخاب نکردید!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('لطفاً ابتدا وارد حساب کاربری شوید');

      // فشرده‌سازی عکس اصلی بدون برش (Resize و Compress تا زیر ۱۵۰ کیلوبایت)
      const compressedBlob = await compressImage(imageFile, 150);

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

  if (isSuccess) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-bounce"><CheckCircle2 size={60} className="text-green-500 mb-4" /><h3 className="text-xl font-black">تجربه شما با موفقیت ثبت شد.</h3></div>;

  return (
    <div className="p-6 min-h-full pb-24 bg-white" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 mt-2">
        <h2 className="text-[22px] font-black text-gray-900">ثبت تجربه</h2>
        <button onClick={() => step > 1 ? setStep(1) : onComplete()} className="text-gray-400 p-2 hover:bg-gray-50 rounded-full transition-colors">
          <X size={28} />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-700 text-[11px] font-bold animate-pulse">
          <AlertTriangle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
               <p className="text-gray-500 font-bold text-sm">کجا غذا خوردی؟</p>
               <button onClick={() => setShowAddRestaurant(!showAddRestaurant)} className="text-[10px] font-black text-orange-600 border border-orange-200 px-4 py-1.5 rounded-full hover:bg-orange-50 transition-colors">
                 {showAddRestaurant ? 'لغو افزودن' : 'افزودن مکان جدید'}
               </button>
            </div>
            <div className="relative">
              <input 
                className="w-full px-5 py-4 bg-white border border-gray-100 rounded-[1rem] outline-none font-bold text-sm shadow-sm border-b-4 border-b-gray-50 focus:border-orange-200 transition-all" 
                placeholder="نام رستوران یا کافه..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {restaurants.map(res => (
              <button key={res.id} onClick={() => { setSelectedRestaurant(res); setStep(2); }} className="w-full flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl text-right hover:border-orange-200 hover:bg-orange-50/30 transition-all group">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 font-black group-hover:scale-110 transition-transform">{res.name[0]}</div>
                <div>
                  <p className="font-black text-sm text-gray-800">{res.name}</p>
                  <p className="text-[10px] font-bold text-gray-400">{res.city}</p>
                </div>
              </button>
            ))}
          </div>

          {showAddRestaurant && (
            <div className="p-5 bg-orange-50 rounded-[2rem] border border-orange-100 space-y-4 animate-in zoom-in-95">
               <input className="w-full p-4 rounded-2xl border-none font-bold text-sm shadow-inner outline-none" placeholder="نام دقیق پاتوق جدید" onChange={(e) => setNewRestName(e.target.value)} />
               <button onClick={async () => { if(!newRestName) return; const { data } = await supabase.from('restaurants').insert([{ name: newRestName, city: 'تهران' }]).select().single(); if (data) { setSelectedRestaurant(data); setStep(2); } }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-200 active:scale-95 transition-all">تایید و ادامه</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-left-4">
          <div className="bg-orange-50 p-5 rounded-[2rem] flex justify-between items-center border border-orange-100">
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-orange-400">مکان انتخاب شده:</span>
               <span className="font-black text-sm text-orange-900">{selectedRestaurant?.name}</span>
             </div>
             <button onClick={() => setStep(1)} className="text-xs text-orange-600 font-black bg-white px-3 py-1.5 rounded-xl shadow-sm">تغییر</button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center mr-2">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">عکس غذا:</p>
              {photoPreview && (
                <button onClick={() => { setPhotoPreview(null); setImageFile(null); }} className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1">حذف و تغییر <Trash2 size={10}/></button>
              )}
            </div>

            <div className="relative w-full rounded-[2rem] overflow-hidden border-2 border-gray-100 shadow-inner group bg-gray-50">
              {!photoPreview ? (
                <label className="flex flex-col items-center justify-center cursor-pointer py-16">
                  <Camera size={40} className="text-orange-300 mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-black text-gray-500">انتخاب عکس از گالری</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              ) : (
                <div className="relative">
                  <img 
                    src={photoPreview}
                    className="w-full h-auto max-h-[400px] object-contain rounded-[2rem]"
                    alt="Preview"
                  />
                  <div className="absolute inset-0 border-[8px] border-white/10 pointer-events-none rounded-[2rem]"></div>
                </div>
              )}
            </div>
            
            {photoPreview && (
              <p className="text-[9px] font-bold text-orange-400 text-center px-4">عکس شما بدون برش و با حفظ کیفیت برای شکموها نمایش داده می‌شود.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <RatingRow label="امتیاز کیفیت طعم" icon={Utensils} value={ratingFood} onChange={setRatingFood} />
            <RatingRow label="امتیاز ارزش قیمت" icon={DollarSign} value={ratingPrice} onChange={setRatingPrice} />
            <RatingRow label="وضعیت جای پارک" icon={Car} value={ratingParking} onChange={setRatingParking} />
            <RatingRow label="محیط و اتمسفر" icon={Sparkles} value={ratingAmbiance} onChange={setRatingAmbiance} />
          </div>

          <textarea className="w-full p-5 bg-white border border-gray-200 rounded-[2rem] min-h-[100px] text-sm font-bold outline-none focus:border-orange-300 transition-all" placeholder="توضیحات کوتاه..." value={caption} onChange={(e) => setCaption(e.target.value)} />
          
          <button onClick={handleSubmit} disabled={loading || !photoPreview} className="w-full py-5 bg-orange-600 text-white font-black rounded-[2rem] shadow-xl shadow-orange-100 active:scale-95 disabled:bg-gray-200 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> اشتراک‌گذاری در پاتوق</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreatePost;
