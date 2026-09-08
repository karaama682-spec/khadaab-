import React, { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, GraduationCap, Lock, Mail, ShieldCheck, User, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [canRegister, setCanRegister] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const checkSetupStatus = async () => {
      try {
        const { data } = await api.get('/users/setup-status');
        if (isMounted) {
          const allowed = Boolean(data?.canRegister);
          setCanRegister(allowed);
          if (allowed) {
            setIsRegister(true);
          } else {
            setIsRegister(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setCanRegister(false);
          setIsRegister(false);
        }
      }
    };

    checkSetupStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleModeSwitch = (registerMode) => {
    setIsRegister(registerMode);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    if (isRegister) {
      if (!formData.fullName.trim()) {
        setError('Fadlan geli magacaaga oo buuxa.');
        setIsLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError('Furaha sirta ah waa inuu ugu yaraan ka koobnaadaa 6 xaraf ama lambar.');
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Labada fure sir isma laha. Fadlan hubi.');
        setIsLoading(false);
        return;
      }
    }

    try {
      const endpoint = isRegister ? '/users/register' : '/users/login';
      const payload = isRegister
        ? {
            fullName: formData.fullName.trim(),
            email: formData.email.trim(),
            password: formData.password
          }
        : {
            email: formData.email.trim(),
            password: formData.password
          };

      const { data } = await api.post(endpoint, payload);
      if (isRegister) {
        setCanRegister(false);
        setIsRegister(false);
      }
      sessionStorage.setItem('userInfo', JSON.stringify(data));
      localStorage.removeItem('userInfo');
      if (onLogin) onLogin(data);
      navigate('/', { replace: true });
    } catch (err) {
      const serverMessage = err.response?.data?.message;
      if (serverMessage) {
        setError(serverMessage);
      } else if (isRegister) {
        setError('Diiwaangelintu way fashilantay. Hubi xogta aad gelisay, kadibna isku day mar kale.');
      } else {
        setError('Gelitaanku wuu fashilmay. Hubi iimaylkaaga iyo furaha sirta, kadibna isku day mar kale.');
      }
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <section className="w-full max-w-md rounded-[32px] border border-white/10 bg-white p-8 shadow-2xl shadow-black/30 dark:bg-slate-900 md:p-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Cumar Binu Khadhaab</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Ku soo dhowow nidaamka maamulka machadka</p>
        </div>

        {/* Tab Switcher: Only shown during one-time initial setup when no admin exists */}
        {canRegister && (
          <div className="mb-6 space-y-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
              ⚡ Bilowga Nidaamka: Sameyso akoonka maamulaha guud (Super Admin).
            </div>
            <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => handleModeSwitch(false)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                  !isRegister
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Soo Gal (Sign In)
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch(true)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                  isRegister
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <UserPlus size={14} />
                Sameyso Akoon
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-xs font-bold text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name field only for Register */}
          {isRegister && (
            <div>
              <label className="block space-y-1.5">
                <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Magaca oo buuxa</span>
                <span className="relative block">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Mustaf Maxamed"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:focus:border-brand-500"
                    value={formData.fullName}
                    onChange={handleChange}
                    required={isRegister}
                  />
                </span>
              </label>
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block space-y-1.5">
              <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Cinwaanka iimaylka</span>
              <span className="relative block">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  placeholder="admin@machad.edu"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:focus:border-brand-500"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </span>
            </label>
          </div>

          {/* Password field */}
          <div>
            <label className="block space-y-1.5">
              <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Furaha sirta</span>
              <span className="relative block">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:focus:border-brand-500"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label="Muuji ama qari furaha sirta"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
          </div>

          {/* Confirm Password field only for Register */}
          {isRegister && (
            <div>
              <label className="block space-y-1.5">
                <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Xaqiiji Furaha sirta</span>
                <span className="relative block">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:focus:border-brand-500"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required={isRegister}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label="Muuji ama qari xaqiijinta furaha sirta"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>

              {/* Admin badge */}
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={16} className="shrink-0" />
                <span>Akoonku wuxuu toos u helayaa awoodda <strong>Super Admin</strong></span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="group mt-2 w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-black text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-70"
          >
            {isLoading ? (
              'Fadlan sug…'
            ) : isRegister ? (
              <span className="flex items-center justify-center gap-2">
                Abuur Akoonka oo Soo Gal <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Soo gal <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </button>
        </form>

        {/* Footer switcher prompt: only visible during initial setup */}
        {canRegister && (
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {!isRegister ? (
              <p>
                Ma doonaysaa akoon cusub?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch(true)}
                  className="font-bold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Sameyso halkan
                </button>
              </p>
            ) : (
              <p>
                Horey ma u lahayd akoon?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch(false)}
                  className="font-bold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Halkan ka soo gal
                </button>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default Login;
