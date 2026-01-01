
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Post, Comment } from '../types';
import { ArrowRight, Heart, MessageCircle, Send, User, Loader2, Star, Utensils } from 'lucide-react';

interface Props {
  postId: string;
  onBack: () => void;
}

const PostDetail: React.FC<Props> = ({ postId, onBack }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (username, avatar_url, full_name),
          restaurants (name, city),
          likes (user_id),
          comments (id, content, created_at, profiles (username, avatar_url, full_name))
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('لطفاً ابتدا وارد حساب خود شوید.');
        return;
      }

      // بررسی وجود پروفایل قبل از درج کامنت (پیشگیری از خطای Foreign Key)
      const { data: profileCheck } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (!profileCheck) {
         await supabase.from('profiles').upsert({ 
           id: user.id, 
           username: user.user_metadata?.display_username || 'user_' + user.id.slice(0, 5), 
           full_name: user.user_metadata?.full_name || 'کاربر جدید' 
         }, { onConflict: 'id' });
      }

      const { error } = await supabase.from('comments').insert([{
        post_id: postId,
        user_id: user.id,
        content: commentText
      }]);

      if (error) throw error;
      setCommentText('');
      fetchPost();
    } catch (e: any) {
      console.error("Comment error:", e);
      alert('خطا در ثبت نظر: ' + (e.message || 'لطفاً دوباره تلاش کنید.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;
  if (!post) return <div className="p-10 text-center">پست یافت نشد.</div>;

  return (
    <div className="bg-white min-h-full animate-in slide-in-from-left-4" dir="rtl">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onBack} className="p-2 -mr-2"><ArrowRight size={24} /></button>
        <div className="flex-1">
          <h3 className="text-sm font-black text-gray-900">مشاهده تجربه</h3>
          <p className="text-[10px] font-bold text-orange-600">{post.restaurants?.name}</p>
        </div>
      </div>

      <img src={post.photo_url} className="w-full aspect-square object-cover" />

      <div className="p-4 border-b border-gray-50">
        <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center overflow-hidden">
             {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={20} className="text-orange-500" />}
           </div>
           <div>
             <p className="text-xs font-black text-gray-900">{post.profiles?.full_name}</p>
             <p className="text-[10px] font-bold text-gray-400">@{post.profiles?.username}</p>
           </div>
           <div className="mr-auto bg-orange-50 px-3 py-1.5 rounded-xl text-orange-600 flex items-center gap-1">
             <Star size={12} fill="currentColor" />
             <span className="text-xs font-black">{post.rating.toFixed(1)}</span>
           </div>
        </div>
        <p className="text-sm font-bold text-gray-700 leading-relaxed mb-4">{post.caption}</p>
      </div>

      <div className="p-4 bg-gray-50/50 min-h-[300px] pb-24">
        <h4 className="text-xs font-black text-gray-400 mb-4 flex items-center gap-2">
          <MessageCircle size={14} /> نظرات ({post.comments?.length || 0})
        </h4>
        <div className="space-y-4">
          {post.comments?.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={14} className="text-gray-300" />}
              </div>
              <div className="flex-1 bg-white p-3 rounded-2xl rounded-tr-none shadow-sm">
                <p className="text-[10px] font-black text-gray-900 mb-1">@{comment.profiles?.username}</p>
                <p className="text-[11px] font-bold text-gray-600">{comment.content}</p>
              </div>
            </div>
          ))}
          {!post.comments?.length && <p className="text-[10px] font-bold text-gray-400 text-center py-10 italic">هنوز نظری ثبت نشده است.</p>}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white border-t border-gray-100 flex gap-2 z-20">
        <input 
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-orange-200"
          placeholder="نظرت رو اینجا بنویس..."
        />
        <button 
          onClick={handleSendComment}
          disabled={submitting || !commentText.trim()}
          className="bg-orange-500 text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
};

export default PostDetail;
