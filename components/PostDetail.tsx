
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Post, Comment } from '../types';
import { ArrowRight, Heart, MessageCircle, Send, User, Loader2, Star, Utensils, Edit3, Trash2, ChevronLeft, ChevronRight, AlertTriangle, X } from 'lucide-react';

interface Props {
  postId: string;
  onBack: () => void;
  onEditPost?: (post: Post) => void;
}

const PostDetail: React.FC<Props> = ({ postId, onBack, onEditPost }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (id, username, avatar_url, full_name),
          restaurants (id, name, city),
          likes (user_id),
          comments (id, content, created_at, profiles (id, username, avatar_url, full_name))
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      
      let urls: string[] = [];
      try {
        if (data.photo_url && (data.photo_url.startsWith('[') || data.photo_url.startsWith('{'))) {
          urls = JSON.parse(data.photo_url);
        } else if (data.photo_url) {
          urls = [data.photo_url];
        }
      } catch (e) {
        urls = [data.photo_url];
      }
      
      setPost({ ...data, photo_urls: Array.isArray(urls) ? urls : [data.photo_url] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      onBack(); // Go back after successful deletion
    } catch (e: any) {
      console.error("Delete Error:", e);
      alert('خطا در حذف پست: ' + (e.message || 'دسترسی محدود شده است'));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('لطفاً ابتدا وارد حساب خود شوید.');
      const { error } = await supabase.from('comments').insert([{
        post_id: postId,
        user_id: user.id,
        content: commentText
      }]);
      if (error) throw error;
      setCommentText('');
      fetchPost();
    } catch (e: any) {
      alert('خطا در ثبت نظر: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  if (!post) return <div className="p-10 text-center">پست یافت نشد.</div>;

  const isOwner = post.user_id === currentUserId;
  const photos = post.photo_urls || [];

  return (
    <div className="bg-white dark:bg-dark-bg min-h-full" dir="rtl">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-dark-border bg-white dark:bg-dark-card sticky top-0 z-20">
        <button onClick={onBack} className="p-2 -mr-2 text-gray-400 dark:text-gray-100"><ArrowRight size={24} /></button>
        <div className="flex-1">
          <h3 className="text-sm font-black text-gray-900 dark:text-white">مشاهده تجربه</h3>
          <p className="text-[10px] font-bold text-orange-600 truncate">{post.restaurants?.name}</p>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <button onClick={() => onEditPost?.(post)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"><Edit3 size={20}/></button>
            <button onClick={() => setShowDeleteModal(true)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={20}/></button>
          </div>
        )}
      </div>

      <div className="relative group">
        <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar" onScroll={(e: any) => {
          const idx = Math.round(e.target.scrollLeft / e.target.offsetWidth);
          setCurrentImgIdx(Math.abs(idx));
        }}>
          {photos.length > 0 ? photos.map((url, i) => (
            <img key={i} src={url} className="w-full aspect-square object-cover snap-center shrink-0" />
          )) : (
            <div className="w-full aspect-video bg-gray-50 dark:bg-dark-card flex items-center justify-center text-gray-300 italic text-xs font-bold">تجربه متنی</div>
          )}
        </div>
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${currentImgIdx === i ? 'bg-orange-500 w-4' : 'bg-white/50'}`}></div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-gray-50 dark:border-dark-border bg-white dark:bg-dark-card">
        <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-dark-card flex items-center justify-center overflow-hidden">
             {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={20} className="text-orange-500" />}
           </div>
           <div><p className="text-xs font-black text-gray-900 dark:text-white">{post.profiles?.full_name}</p><p className="text-[10px] font-bold text-gray-400">@{post.profiles?.username}</p></div>
           <div className="mr-auto bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-xl text-orange-600 flex items-center gap-1"><Star size={12} fill="currentColor" /><span className="text-xs font-black">{post.rating.toFixed(1)}</span></div>
        </div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{post.caption}</p>
      </div>

      <div className="p-4 bg-gray-50/50 dark:bg-dark-bg min-h-[300px] pb-24">
        <h4 className="text-xs font-black text-gray-400 mb-4 flex items-center gap-2"><MessageCircle size={14} /> نظرات ({post.comments?.length || 0})</h4>
        <div className="space-y-4">
          {post.comments?.map((comment) => (
            <div key={comment.id} className="flex gap-3 animate-in slide-in-from-right-2">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-dark-card shadow-sm flex items-center justify-center shrink-0 overflow-hidden">{comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={14} className="text-gray-300" />}</div>
              <div className="flex-1 bg-white dark:bg-dark-card p-3 rounded-2xl rounded-tr-none shadow-sm border border-gray-100 dark:border-dark-border transition-colors"><p className="text-[10px] font-black text-gray-900 dark:text-white mb-1">@{comment.profiles?.username}</p><p className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{comment.content}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 w-full md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto p-4 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-dark-border flex gap-2 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 px-4 py-3 bg-gray-50 dark:bg-dark-bg rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-orange-200 dark:text-white" placeholder="نظرت رو اینجا بنویس..." />
        <button onClick={handleSendComment} disabled={submitting || !commentText.trim()} className="bg-orange-500 text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50">{submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}</button>
      </div>

      {/* Custom Deletion Modal - Fixes "confirm() is not allowed" error */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-dark-card rounded-[3rem] w-full max-w-sm p-8 space-y-6 shadow-2xl animate-in zoom-in-95 border border-gray-100 dark:border-dark-border">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto">
                 <AlertTriangle className="text-red-500" size={40} />
              </div>
              <div className="text-center space-y-2">
                 <h3 className="text-xl font-black text-gray-900 dark:text-white">حذف نهایی؟</h3>
                 <p className="text-[11px] font-bold text-gray-400 leading-relaxed px-4">آیا از حذف این تجربه شکموگردی مطمئن هستید؟ این عمل غیرقابل بازگشت است.</p>
              </div>
              <div className="flex gap-3 mt-4">
                 <button 
                    onClick={confirmDelete} 
                    disabled={isDeleting} 
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100 dark:shadow-none"
                 >
                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'بله، حذف شود'}
                 </button>
                 <button 
                    onClick={() => setShowDeleteModal(false)} 
                    disabled={isDeleting}
                    className="flex-1 py-4 bg-gray-100 dark:bg-dark-bg text-gray-500 dark:text-gray-400 rounded-2xl font-black text-xs active:scale-95 transition-all"
                 >
                    انصراف
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PostDetail;
