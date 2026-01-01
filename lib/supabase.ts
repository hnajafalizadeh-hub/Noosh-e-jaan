
import { createClient } from '@supabase/supabase-js';

// آدرس پروژه شما
const supabaseUrl = 'https://skuwdsyeonmnkcoaycvq.supabase.co';

/**
 * مهم: این کلید را حتماً از مسیر زیر در پنل خود جایگزین کنید:
 * Settings (چرخ‌دنده) -> API -> بخش Project API keys -> کپی کردن کلید anon / public
 */
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrdXdkc3llb25tbmtjb2F5Y3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5OTc2NDksImV4cCI6MjA4MjU3MzY0OX0.8-9bnHgAZ-b5gm31MWnOQjlJ_1S4z7DBxUVg04g19Ms';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const checkConnection = async () => {
  try {
    // Fix: PostgrestError does not have a status property, so we destructure it from the response
    const { error, status } = await supabase.from('restaurants').select('id').limit(1);
    
    if (error) {
      // بررسی دقیق خطای احراز هویت API
      // Fix: Use status from the response result
      if (status === 401 || error.message.toLowerCase().includes('api key')) {
        return { ok: false, errorType: 'API_KEY', message: 'کلید امنیتی (API Key) نامعتبر است.' };
      }
      return { ok: false, errorType: 'DATABASE', message: error.message };
    }
    
    return { ok: true };
  } catch (e: any) {
    return { ok: false, errorType: 'NETWORK', message: e.message };
  }
};
