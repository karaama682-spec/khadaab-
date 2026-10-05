import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, DollarSign, Globe2, Languages, Percent, Save } from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { Link } from 'react-router-dom';

const DEFAULTS = { language: 'en', timezone: 'Africa/Mogadishu', currency: 'USD', defaultTax: 0 };

const SystemPreferences = () => {
  const { language, setLanguage, t } = useLanguage();
  const [preferences, setPreferences] = useState({ ...DEFAULTS, language });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setPreferences({ ...DEFAULTS, ...(data?.localization || {}) }))
      .catch(() => setPreferences((current) => ({ ...current, language })))
      .finally(() => setLoading(false));
  }, []);

  const update = (key, value) => setPreferences((current) => ({ ...current, [key]: value }));
  const savePreferences = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { localization: preferences });
      setLanguage(preferences.language);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm font-bold text-slate-500">{t('settings.preferences.loading')}</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{t('nav.systemPreferences')}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('settings.preferences.subtitle')}</p>
        </div>
        <button type="button" onClick={savePreferences} disabled={saving} className="premium-button premium-button-primary flex items-center justify-center gap-2 disabled:opacity-60"><Save size={17} /> {saving ? t('settings.preferences.saving') : t('nav.saveLanguage')}</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-slate-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Languages size={22} /></span><div><h2 className="font-black text-slate-900 dark:text-white">{t('nav.systemLanguage')}</h2><p className="text-xs text-slate-500">{t('settings.preferences.languageHint')}</p></div></div>
          <label className="block space-y-2"><span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('nav.systemLanguage')}</span><select value={preferences.language} onChange={(event) => update('language', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="en">{t('nav.english')}</option><option value="so">{t('nav.somali')}</option><option value="ar">{t('nav.arabic')}</option></select></label>
        </section>

        <section className="rounded-[28px] border border-slate-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Globe2 size={22} /></span><div><h2 className="font-black text-slate-900 dark:text-white">{t('settings.preferences.regionalDefaults')}</h2><p className="text-xs text-slate-500">{t('settings.preferences.regionalHint')}</p></div></div>
          <div className="space-y-4"><label className="block space-y-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><Clock size={14} /> {t('settings.preferences.timezone')}</span><select value={preferences.timezone} onChange={(event) => update('timezone', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="Africa/Mogadishu">{t('settings.preferences.tzMogadishu')}</option><option value="Africa/Nairobi">{t('settings.preferences.tzNairobi')}</option><option value="UTC">{t('settings.preferences.tzUtc')}</option></select></label><label className="block space-y-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><DollarSign size={14} /> {t('settings.preferences.currency')}</span><select value={preferences.currency} onChange={(event) => update('currency', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="USD">{t('settings.preferences.usd')}</option><option value="SOS">{t('settings.preferences.sos')}</option></select></label><label className="block space-y-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><Percent size={14} /> {t('settings.preferences.defaultTax')}</span><input type="number" min="0" max="100" step="0.01" value={preferences.defaultTax} onChange={(event) => update('defaultTax', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label></div>
        </section>
        <section className="rounded-[28px] border border-slate-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Globe2 size={22} /></span><div><h2 className="font-black text-slate-900 dark:text-white">{t('settings.preferences.identity')}</h2><p className="text-xs text-slate-500">{t('settings.preferences.identityHint')}</p></div></div>
          <Link to="/settings/profile" className="mt-5 inline-flex rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-700">{t('settings.preferences.manageIdentity')}</Link>
        </section>
      </div>
      {saved && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"><CheckCircle2 size={18} /> {t('nav.languageSaved')}</div>}
    </div>
  );
};

export default SystemPreferences;
