
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, Post } from '../types';
import { compressImage } from '../lib/imageUtils';
import { Camera, Star, X, AlertTriangle, CheckCircle2, Utensils, DollarSign, Car, Sparkles, Send, Plus, Trash2, Loader2, Image as ImageIcon, ChevronRight, ChevronLeft } from 'lucide-react';

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
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (editPost) {
        // Correctly handle JSON vs single string for legacy support
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
           // Ensure selectedRestaurant is re-fetched if only ID is available
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
    if (previewIdx >= Math.max(0, photoPreviews.length - 1)) setPreviewIdx(0);
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

      // 1. Keep existing URLs (the ones that start with http)
      const finalUrls = photoPreviews.filter(p => p.startsWith('http'));
      
      // 2. Upload new local files (the ones that start with data: or were added as Files)
      for (const file of imageFiles) {
        const compressedBlob = (await compressImage(file, 150)) as Blob;
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
        
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(fileName);
        finalUrls.push(publicUrl);
      }

      const avgRating = (ratingFood + ratingPrice + ratingParking + ratingAmbiance) / 4;
      
      // Always store as JSON string for consistency in multi-photo system
      const photoPayload = finalUrls.length > 0 ? JSON.stringify(finalUrls) : '';

      const postData: any = {
        user_id: user.id,
        restaurant_id: selectedRestaurant?.id || editPost?.restaurant_id,
        photo_url: photoPayload,
        caption: caption.trim(),
        rating: avgRating,
        rating_food: ratingFood,
        rating_price: ratingPrice,
        rating_parking: ratingParking,
        rating_ambiance: ratingAmbiance
      };

      if (editPost) {
        // UPDATE Existing
        const { error: postError } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', editPost.id);
        
        if (postError) throw postError;
      } else {
        // INSERT New
        const { error: postError } = await supabase
          .from('posts')
          .insert([postData]);
        
        if (postError) throw postError;
      }

      setIsSuccess(true);
      setTimeout(() => onComplete(), 1200);
    } catch (err: any) {
      console.error("Submit Error:", err);
      setError(err.message || 'خطا در ثبت اطلاعات در دیتابیس. از تنظیمات سیاست‌های سوپابیس اطمینان حاصل کنید.');
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
          <p className="text-gray-500 font-bold text-sm">کجا غذا خوردی؟</p>
          <div className="relative">
            <input className="w-full px-5 py-4 bg-gray-50 dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white" placeholder="جستجوی نام رستوران..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="space-y-2 mt-4">
            {restaurants.map(res => (
              <button key={res.id} onClick={() => { setSelectedRestaurant(res); setStep(2); }} className="w-full flex items-center gap-3 p-4 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl text-right hover:border-orange-200 transition-all">
                <div className="w-10 h-10 bg-orange-50 dark:bg-dark-bg rounded-xl flex items-center justify-center text-orange-500 font-black">{res.name?.[0]}</div>
                <div><p className="font-black text-xs text-gray-800 dark:text-gray-100">{res.name}</p><p className="text-[10px] font-bold text-gray-400">{res.city}</p></div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-left-4">
          <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-[2rem] flex justify-between items-center border border-orange-100">
             <div><span className="text-[10px] font-bold text-orange-400">مکان:</span><p className="font-black text-sm text-orange-900 dark:text-orange-300">{selectedRestaurant?.name}</p></div>
             {!editPost && <button onClick={() => setStep(1)} className="text-[10px] text-orange-600 font-black bg-white dark:bg-dark-card px-4 py-2 rounded-xl">تغییر</button>}
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center mr-2">
              <p className="text-[11px] font-black text-gray-400">تصاویر ({photoPreviews.length}):</p>
              <label className="text-[10px] font-black text-orange-600 border border-orange-200 px-4 py-1.5 rounded-full cursor-pointer">
                 افزودن عکس
                 <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden border-2 border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-center shadow-inner">
              {photoPreviews.length === 0 ? (
                <ImageIcon size={40} className="text-gray-200" />
              ) : (
                <div className="relative w-full h-full">
                  <img src={photoPreviews[previewIdx]} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(previewIdx)} className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-xl shadow-lg z-10"><Trash2 size={18}/></button>
                  {photoPreviews.length > 1 && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                       <button onClick={(e) => { e.stopPropagation(); setPreviewIdx(prev => (prev - 1 + photoPreviews.length) % photoPreviews.length); }} className="p-2 bg-black/30 text-white rounded-full pointer-events-auto backdrop-blur-sm"><ChevronRight size={20}/></button>
                       <button onClick={(e) => { e.stopPropagation(); setPreviewIdx(prev => (prev + 1) % photoPreviews.length); }} className="p-2 bg-black/30 text-white rounded-full pointer-events-auto backdrop-blur-sm"><ChevronLeft size={20}/></button>
                    </div>
                  )}
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

          <textarea className="w-full p-5 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-[2rem] min-h-[120px] text-xs font-bold outline-none focus:border-orange-300 dark:text-white" placeholder="توضیحات کوتاه یا نقد شما..." value={caption} onChange={(e) => setCaption(e.target.value)} />
          
          <button onClick={handleSubmit} disabled={loading} className="w-full py-5 bg-orange-600 text-white font-black rounded-[2rem] shadow-xl active:scale-95 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> {editPost ? 'بروزرسانی نهایی تجربه' : 'اشتراک‌گذاری در پاتوق'}</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreatePost;
