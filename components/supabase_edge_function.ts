/* 
این فایل باید در پنل Supabase در بخش Edge Functions با نام 'notify' ایجاد شود.
همچنین باید یک Webhook روی جدول likes و comments تنظیم کنید تا این تابع را فراخوانی کند.
*/

// Fix: Declaring Deno global to resolve TypeScript "Cannot find name 'Deno'" errors
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { record, table, type } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // ۱. پیدا کردن صاحب پست یا هدف اعلان
  let targetUserId;
  let messageTitle = "اعلان جدید";
  let messageBody = "اتفاق جدیدی در چی بُقولم افتاد!";
  
  if (table === 'likes') {
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', record.post_id).single();
    targetUserId = post.user_id;
    messageTitle = "لایک جدید ❤️";
    messageBody = "یک نفر پست شما را پسندید.";
  } else if (table === 'comments') {
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', record.post_id).single();
    targetUserId = post.user_id;
    messageTitle = "کامنت جدید 💬";
    messageBody = "یک نفر برای شما نظر گذاشت.";
  } else if (table === 'followers') {
    targetUserId = record.following_id;
    messageTitle = "فالوور جدید 👤";
    messageBody = "یک نفر شما را دنبال کرد.";
  }

  if (!targetUserId) return new Response("No target user", { status: 200 });

  // ۲. دریافت توکن Push کاربر هدف
  const { data: profile } = await supabase.from('profiles').select('push_subscription').eq('id', targetUserId).single();
  
  if (!profile?.push_subscription) return new Response("No subscription found", { status: 200 });

  // ۳. ارسال به سرویس Web Push
  // در دنیای واقعی اینجا باید از یک کتابخانه مثل 'web-push' استفاده کنید 
  // یا به سادگی به FCM (Firebase) یا APNs سیگنال بفرستید.
  
  console.log(`Sending push to ${targetUserId}: ${messageTitle}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
