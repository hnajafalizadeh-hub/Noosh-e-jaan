
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Pizza, Mail, Lock, User as UserIcon, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, Phone, CheckSquare, Square, Smartphone } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState(''); // فیلد مشترک برای ایمیل یا شماره در زمان ورود
  const [email, setEmail] = useState(''); // فقط برای ثبت‌نام
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('remembered_identifier');
    const savedPassword = localStorage.getItem('remembered_password');
    if (savedId) {
      setIdentifier(savedId);
      if (savedPassword) setPassword(savedPassword);
    }
  }, []);

  const validatePassword = (pass: string) => {
    // حداقل ۸ کاراکتر، شامل حروف و اعداد انگلیسی
    const regex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return regex.test(pass);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (!validatePassword(password)) {
      setError('رمز عبور باید حداقل ۸ کاراکتر و ترکیبی از حروف و اعداد انگلیسی باشد.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // ۱. بررسی تکراری نبودن شماره همراه قبل از ثبت‌نام
        const { data: phoneCheck } = await supabase.from('profiles').select('id').eq('phone', phone).maybeSingle();
        if (phoneCheck) throw new Error('این شماره همراه قبلاً توسط شخص دیگری ثبت شده است.');

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              display_username: username.toLowerCase(),
              phone: phone
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        // ایجاد پروفایل دستی برای اطمینان از ذخیره ایمیل و شماره (برای لاگین‌های بعدی)
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username.toLowerCase(),
            full_name: fullName,
            phone: phone,
            email: email, // ذخیره برای لاگین با شماره
            is_admin: false
          });
        }

        if (data.session) {
          onAuthSuccess();
        } else {
          setSuccessMsg('ثبت‌نام انجام شد! لطفاً ایمیل خود را تایید کنید.');
          setIsSignUp(false);
        }
      } else {
        // منطق ورود با ایمیل یا شماره همراه
        let loginEmail = identifier;

        // اگر ورودی شبیه شماره موبایل است (فقط عدد)
        if (/^\d+$/.test(identifier)) {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('email')
            .eq('phone', identifier)
            .maybeSingle();
          
          if (!profile || !profile.email) {
            throw new Error('کاربری با این شماره همراه یافت نشد.');
          }
          loginEmail = profile.email;
        }

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        
        if (signInError) throw signInError;

        if (rememberMe) {
          localStorage.setItem('remembered_identifier', identifier);
          localStorage.setItem('remembered_password', password);
        } else {
          localStorage.removeItem('remembered_identifier');
          localStorage.removeItem('remembered_password');
        }
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'خطایی رخ داد، لطفا دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-10" dir="rtl">
      <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 rounded-3xl mb-4 shadow-xl shadow-orange-200 rotate-3">
            <Pizza className="text-white" size={40} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">چی بُقولم؟</h2>
          <p className="text-xs text-orange-600 mt-2 font-black italic">پایانِ بحرانِ «حالا چی بخوریم؟»</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
            <div className="flex gap-2 text-red-700">
              <AlertCircle size={18} className="shrink-0" />
              <div className="text-[10px] font-bold leading-relaxed">{error}</div>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex gap-2 text-green-700 text-[11px] font-bold">
            <CheckCircle2 size={18} className="shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleAuth}>
          <div className="space-y-3">
            {isSignUp ? (
              <>
                <div className="relative">
                  <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                    placeholder="نام و نام خانوادگی"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    required
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                    dir="ltr"
                    placeholder="شماره همراه (باید یکتا باشد)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">{"@"}</span>
                  <input
                    type="text"
                    required
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                    dir="ltr"
                    placeholder="آیدی شکم‌گردی"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                    dir="ltr"
                    placeholder="ایمیل (باید یکتا باشد)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="relative group">
                <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  required
                  className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                  dir="ltr"
                  placeholder="ایمیل یا شماره همراه"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            )}

            <div className="relative group">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full pr-12 pl-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                dir="ltr"
                placeholder="رمز عبور (ترکیب حروف و عدد)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {!isSignUp && (
              <div className="flex items-center gap-2 px-1 pt-1">
                <button 
                  type="button" 
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 text-gray-500"
                >
                  {rememberMe ? <CheckSquare size={18} className="text-orange-500" /> : <Square size={18} />}
                  <span className="text-[11px] font-bold">مرا به خاطر بسپار</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : (isSignUp ? "بزن بریم برای ثبت‌نام" : "ورود به پاتوق شکموها")}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs font-bold text-gray-400 hover:text-orange-500 transition-all"
          >
            {isSignUp ? "قبلاً عضو شدی؟ بیا تو" : "هنوز عضو پاتوق نشدی؟ سریع بیا!"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
