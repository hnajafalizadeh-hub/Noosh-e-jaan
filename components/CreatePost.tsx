
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, Post } from '../types';
import { compressImage } from '../lib/imageUtils';
import { Camera, Star, X, AlertTriangle, CheckCircle2, Utensils, DollarSign, Car, Sparkles, Send, Plus, Trash2, Loader2, Image as ImageIcon, ChevronRight, ChevronLeft, Search as SearchIcon, MapPin } from 'lucide-react';

interface CreatePostProps {
  onComplete: () => void;
  editPost?: Post;
}

const CreatePost: React.FC<CreatePostProps> = ({ onComplete, editPost }) => {
  const [step, setStep] = useState(editPost ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState(editPost?.caption || '');
  
  const [ratingFood, setRatingFood] = useState(editPost?.rating_food || 5);
  const [ratingPrice, setRatingPrice] = useState(editPost?.rating_price || 5);
  const [ratingParking, setRatingParking] = useState(editPost?.rating_parking || 5);
  const [ratingAmbiance, setRatingAmbiance] = useState(editPost?.rating_ambiance || 5);

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(editPost?.restaurants || null);
  const [isCustomRestaurant, setIsCustomRestaurant] = useState(false);
  const [customRestName, setCustomRestName] = useState('');

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (editPost) {
        let urls: string[] = [];
        try {
            if (editPost.photo_url && (editPost.photo_url.startsWith('[') || editPost.photo_url.startsWith('{'))) {
                urls = JSON.parse(editPost.photo_url);
            } else if (editPost.photo_url) {
                urls = [editPost.photo_url];
            }
        } catch (e) {
            urls = [editPost.photo_url];
        }
        setPhotoPreviews(Array.isArray(urls) ? urls : [editPost.photo_url]);
        
        if (editPost.restaurant_id && !selectedRestaurant) {
           supabase.from('restaurants').select('*').eq('id', editPost.restaurant_id).single().then(({data}) => {
             if(data) setSelectedRestaurant(data);
           });
        }
    } else {
        fetchRestaurants();
    }
  }, [editPost]);

  useEffect(() => {
    if (!editPost && step === 1) fetchRestaurants();
  }, [searchQuery, step]);

  const fetchRestaurants = async () => {
    try {
      let query = supabase.from('restaurants').select('*');
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
      const { data } = await query.limit(5);
      setRestaurants(data || []);
    } catch (e) { console.error(e); }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files) as File[];
      setImageFiles(prev => [...prev, ...newFiles]);
      
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreviews(prev => [...prev, (reader.result as string)]);
        };
        reader.readAsDataURL(file);
      });
      setError(null);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
    if (previewIdx >= Math.max(0, photoPreviews.length - 1)) {
      setPreviewIdx(0);
    }
  };

  const handleSubmit = async () => {
    if (photoPreviews.length === 0 && !caption.trim()) {
      setError('حداقل یک عکس یا متن بنویسید!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('لطفاً ابتدا وارد حساب کاربری شوید');

      let targetRestaurantId = selectedRestaurant?.id || editPost?.restaurant_id;

      // ثبت پاتوق جدید در صورتی که کاربر نام دستی وارد کرده باشد
      if (isCustomRestaurant && customRestName.trim()) {
        const { data: newRest, error: restErr } = await supabase
          .from('restaurants')
          .insert([{ 
            name: customRestName.trim(), 
            city: 'تهران', 
            is_active: false // ستون verified حذف شد چون در دیتابیس وجود ندارد
          }])
          .select()
          .single();
        
        if (restErr) throw restErr;
        targetRestaurantId = newRest.id;
      }

      if (!targetRestaurantId) throw new Error('لطفاً یک پاتوق انتخاب کنید یا نام آن را بنویسید.');

      const finalUrls = photoPreviews.filter(p => p.startsWith('http'));
      
      for (const file of imageFiles) {
        const compressedBlob = (await compressImage(file, 200)) as Blob;
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
        
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(fileName);
        finalUrls.push(publicUrl);
      }

      const avgRating = (ratingFood + ratingPrice + ratingParking + ratingAmbiance) / 4;
      const photoPayload = finalUrls.length > 0 ? JSON.stringify(finalUrls) : '';

      const postData: any = {
        user_id: user.id,
        restaurant_id: targetRestaurantId,
        photo_url: photoPayload,
        caption: caption.trim(),
        rating: avgRating,
        rating_food: ratingFood,
        rating_price: ratingPrice,
        rating_parking: ratingParking,
        rating_ambiance: ratingAmbiance
      };

      if (editPost) {
        const { error: postError } = await supabase.from('posts').update(postData).eq('id', editPost.id);
        if (postError) throw postError;
      } else {
        const { error: postError } = await supabase.from('posts').insert([postData]);
        if (postError) throw postError;
      }

      setIsSuccess(true);
      setTimeout(() => onComplete(), 1200);
    } catch (err: any) {
      console.error("Submit Error:", err);
      setError(err.message || 'خطا در ثبت اطلاعات در دیتابیس.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustom = () => {
    setIsCustomRestaurant(true);
    setCustomRestName(searchQuery);
    setSelectedRestaurant(null);
    setStep(2);
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
              value >= num ? 'bg-orange-500 text-white scale-[1.02]' : 'bg-gray-100 dark:bg-dark-bg text-gray-300'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );

  if (isSuccess) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-bounce"><CheckCircle2 size={60} className="text-green-500 mb-4" /><h3 className="text-xl font-black">{editPost ? 'تغییرات با موفقیت اعمال شد.' : 'تجربه شما با موفقیت ثبت شد.'}</h3></div>;

  return (
    <div className="p-6 min-h-full pb-24 bg-white dark:bg-dark-bg" dir="rtl">
      <div className="flex justify-between items-center mb-8 mt-2">
        <h2 className="text-[22px] font-black text-gray-900 dark:text-white">{editPost ? 'ویرایش تجربه' : 'ثبت تجربه جدید'}</h2>
        <button onClick={() => step > 1 && !editPost ? setStep(1) : onComplete()} className="text-gray-400 p-2 hover:bg-gray-50 dark:hover:bg-dark-card rounded-full transition-colors">
          <X size={28} />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-700 text-[10px] font-bold">
          <AlertTriangle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">کجا غذا خوردی؟ پاتوق رو انتخاب کن:</p>
          <div className="relative">
            <SearchIcon size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pr-12 pl-4 py-4 bg-gray-50 dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white" placeholder="جستجوی نام رستوران..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="space-y-2 mt-4">
            {restaurants.length > 0 ? (
              <>
                {restaurants.map(res => (
                  <button key={res.id} onClick={() => { setSelectedRestaurant(res); setIsCustomRestaurant(false); setStep(2); }} className="w-full flex items-center gap-3 p-4 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl text-right hover:border-orange-200 transition-all active:scale-95">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-dark-bg rounded-xl flex items-center justify-center text-orange-500 font-black shrink-0">{res.name?.[0]}</div>
                    <div className="flex-1 min-w-0"><p className="font-black text-xs text-gray-800 dark:text-gray-100 truncate">{res.name}</p><p className="text-[10px] font-bold text-gray-400 truncate">{res.city}</p></div>
                  </button>
                ))}
                <div className="py-4 border-t border-gray-50 dark:border-dark-border mt-4">
                  <button onClick={handleSelectCustom} className="w-full flex items-center justify-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/10 text-orange-600 rounded-2xl font-black text-xs border border-orange-100 dark:border-orange-500/20">
                    <MapPin size={16} /> ثبت نام جدید: {searchQuery || '...'}
                  </button>
                </div>
              </>
            ) : searchQuery.length > 1 ? (
              <div className="p-8 text-center space-y-4">
                <p className="text-xs font-bold text-gray-400">پاتوقی با این نام پیدا نشد.</p>
                <button onClick={handleSelectCustom} className="w-full flex items-center justify-center gap-2 p-4 bg-orange-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-orange-100">
                   <Plus size={18} /> افزودن "{searchQuery}" به عنوان پاتوق جدید
                </button>
              </div>
            ) : (
              <div className="p-10 text-center opacity-40">
                <Utensils size={32} className="mx-auto mb-2" />
                <p className="text-xs font-bold">نام رستوران را جستجو کنید یا اضافه کنید.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-left-4">
          <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-[2rem] flex justify-between items-center border border-orange-100 dark:border-orange-500/20">
             <div className="flex-1 min-w-0">
               <span className="text-[10px] font-bold text-orange-400">{isCustomRestaurant ? 'پاتوق جدید:' : 'مکان انتخاب شده:'}</span>
               <p className="font-black text-sm text-orange-900 dark:text-orange-300 truncate">{isCustomRestaurant ? customRestName : selectedRestaurant?.name}</p>
             </div>
             {!editPost && <button onClick={() => setStep(1)} className="text-[10px] text-orange-600 font-black bg-white dark:bg-dark-card px-4 py-2 rounded-xl shrink-0 shadow-sm">تغییر پاتوق</button>}
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center mr-2">
              <p className="text-[11px] font-black text-gray-400">تصاویر شکم‌گردی ({photoPreviews.length}):</p>
              <label className="text-[10px] font-black text-orange-600 border border-orange-200 dark:border-orange-500/30 px-4 py-1.5 rounded-full cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors">
                 + افزودن عکس
                 <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden border-2 border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-center shadow-inner group">
              {photoPreviews.length === 0 ? (
                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-2">
                  <Camera size={48} className="text-gray-200" />
                  <span className="text-xs font-black text-gray-300">برای افزودن عکس کلیک کنید</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                </label>
              ) : (
                <div className="relative w-full h-full">
                  <img src={photoPreviews[previewIdx]} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(previewIdx)} className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-xl shadow-lg z-10 active:scale-90 transition-transform"><Trash2 size={18}/></button>
                  {photoPreviews.length > 1 && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                       <button onClick={(e) => { e.stopPropagation(); setPreviewIdx(prev => (prev - 1 + photoPreviews.length) % photoPreviews.length); }} className="p-3 bg-black/40 text-white rounded-full pointer-events-auto backdrop-blur-md active:scale-90"><ChevronRight size={24}/></button>
                       <button onClick={(e) => { e.stopPropagation(); setPreviewIdx(prev => (prev + 1) % photoPreviews.length); }} className="p-3 bg-black/40 text-white rounded-full pointer-events-auto backdrop-blur-md active:scale-90"><ChevronLeft size={24}/></button>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full">
                     {photoPreviews.map((_, i) => (
                       <div key={i} className={`h-1 rounded-full transition-all ${previewIdx === i ? 'bg-orange-500 w-4' : 'bg-white/40 w-1'}`}></div>
                     ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-white dark:bg-dark-card p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-dark-border">
            <RatingRow label="امتیاز کیفیت طعم" icon={Utensils} value={ratingFood} onChange={setRatingFood} />
            <RatingRow label="امتیاز ارزش قیمت" icon={DollarSign} value={ratingPrice} onChange={setRatingPrice} />
            <RatingRow label="وضعیت جای پارک" icon={Car} value={ratingParking} onChange={setRatingParking} />
            <RatingRow label="محیط و اتمسفر" icon={Sparkles} value={ratingAmbiance} onChange={setRatingAmbiance} />
          </div>

          <textarea className="w-full p-5 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-[2rem] min-h-[120px] text-xs font-bold outline-none focus:border-orange-300 dark:text-white transition-colors" placeholder="نقد و بررسی شما (اختیاری)..." value={caption} onChange={(e) => setCaption(e.target.value)} />
          
          <button onClick={handleSubmit} disabled={loading} className="w-full py-5 bg-orange-600 text-white font-black rounded-[2rem] shadow-xl active:scale-95 disabled:bg-gray-300 dark:disabled:bg-dark-border transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> {editPost ? 'بروزرسانی نهایی تجربه' : 'اشتراک‌گذاری در پاتوق'}</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreatePost;
