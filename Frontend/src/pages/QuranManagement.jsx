import React from 'react';
import { BookOpen, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const QuranManagement = () => {
  const { locale } = useLanguage();

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 rounded-[36px] p-8 lg:p-10 text-white border border-emerald-900/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <BookOpen size={34} strokeWidth={2.2} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-2">
                <Sparkles size={12} />
                <span>{locale === 'ar' ? 'القرآن الكريم' : "Qur'aan Kariim"}</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white">
                {locale === 'so' ? "Qur'aanka & Xifdiga" : locale === 'ar' ? 'تحفيظ القرآن الكريم' : "Quran & Memorization"}
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-1">
                {locale === 'so' ? 'Nidaamka dabagalka xifdiga Quraanka iyo xalaqaadka Machadka Salaaxu-Aldaareyn' : 'Institute Quran Memorization & Halaqah Tracking System'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis & Staging Card (No list created yet, as instructed) */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Clock size={28} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          {locale === 'so' ? 'Falanqaynta & Qaabeynta Nidaamka' : 'System Analysis in Progress'}
        </h2>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
          {locale === 'so'
            ? 'Menu-ga guud ee "Qur\'aan" si guul leh ayaa loo furay. Hadda waxaa lagu guda jiraa falanqaynta iyo isku-dhaffidda nidaamyada kala duwan ee xifdiga iyo suuradaha, si loogu soo kordhiyo qaabka ugu habboon.'
            : 'The main Quran menu has been created. The system is currently analyzing the requirements for Quran and Halaqah tracking.'}
        </p>
        <div className="pt-2 flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} />
          <span>{locale === 'so' ? 'Menu-gu waa diyaar' : 'Menu entry is active'}</span>
        </div>
      </div>
    </div>
  );
};

export default QuranManagement;
