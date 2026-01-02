
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Utensils, Mail, Lock, User as UserIcon, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    const savedPassword = localStorage.getItem('remembered_password');
    if (savedEmail) setEmail(savedEmail || '');
    if (savedPassword) setPassword(savedPassword || '');
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              display_username: username.toLowerCase()
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        if (data.session) {
          onAuthSuccess();
        } else {
          setSuccessMsg('ثبت‌نام انجام شد. حالا می‌توانید وارد شوید.');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) throw signInError;

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
          localStorage.setItem('remembered_password', password);
        }
        onAuthSuccess();
      }
    } catch (err: any) {
      if (err.message?.includes('Invalid API key') || err.status === 401) {
        setError('خطای کلید امنیتی (API Key): کلید پروژه در پنل تغییر کرده است.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('ایمیل تایید نشده است. لطفاً ایمیل خود را چک کنید.');
      } else if (err.message.includes('Invalid login credentials')) {
        setError('ایمیل یا رمز عبور اشتباه است.');
      } else {
        setError(err.message || 'خطای غیرمنتظره رخ داد');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-10" dir="rtl">
      <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-200">
            <Utensils className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900">{"نوش جان"}</h2>
          <p className="text-xs text-gray-400 mt-1 font-bold italic">{"ورود به پنل کاربری"}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in shake duration-500">
            <div className="flex gap-2 text-red-700">
              <AlertCircle size={18} className="shrink-0" />
              <div className="text-[10px] font-black leading-relaxed">{error}</div>
            </div>
            {error.includes('API key') && (
              <div className="mt-3 p-2 bg-white rounded-lg border border-red-200 text-[9px] font-bold text-gray-500">
                {"راهنما: در پنل سوپابیس بخش Settings و API کلید anon را کپی کنید."}
              </div>
            )}
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
            {isSignUp && (
              <React.Fragment>
                <div className="relative group">
                  <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                    placeholder={"نام نمایشی"}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="relative group">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">{"@"}</span>
                  <input
                    type="text"
                    required
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                    placeholder={"نام کاربری انگلیسی"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </React.Fragment>
            )}

            <div className="relative group">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                placeholder={"ایمیل"}
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full pr-12 pl-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-left"
                placeholder={"رمز عبور"}
                dir="ltr"
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : (isSignUp ? "ایجاد حساب کاربری" : "ورود به حساب")}
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
            {isSignUp ? "حساب دارید؟ وارد شوید" : "حساب ندارید؟ ثبت‌نام کنید"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
