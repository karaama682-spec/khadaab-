import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  PenSquare,
  Award,
  Calendar,
  Users,
  BookOpen,
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw,
  Search,
  ArrowRight,
  Sparkles,
  BarChart3,
  Layers,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import api from '../services/api';
import { classLabel } from '../utils/classLabel';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const ExamDashboard = () => {
  const navigate = useNavigate();
  const { t, tv, locale } = useLanguage();

  const [currentUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('userInfo');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const currentRole = currentUser?.role || currentUser?.roles?.[0]?.name?.toUpperCase().replace(/ /g, '_');
  const isTeacher = typeof currentRole === 'string' && currentRole.toLowerCase().includes('teacher');

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');

  const fetchStats = async (fresh = false) => {
    try {
      if (fresh) setIsRefreshing(true);
      else setLoading(true);

      const { data } = await api.get('/exams/dashboard-summary', { skipCache: fresh });
      setDashboardStats(data);
    } catch (err) {
      console.error('Failed to load exam dashboard stats', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const summary = dashboardStats?.summary || {
    totalExams: 0,
    scheduledCount: 0,
    ongoingCount: 0,
    completedCount: 0,
    publishedCount: 0,
    totalClasses: 0,
    totalStudentsAssessed: 0,
    overallCompletionRate: 0,
    overallPassRate: 0,
    averageScore: 0,
    totalMarksEntered: 0,
    totalExpectedMarks: 0,
    typeDistribution: {},
    gradeDistribution: {}
  };

  const recentExams = dashboardStats?.recentExams || [];

  const filteredExams = recentExams.filter(exam => {
    const matchesSearch = (exam.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (classLabel(exam.class, '') || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || exam.examType === filterType;
    return matchesSearch && matchesType;
  });

  const statusBadge = (status) => {
    switch (status) {
      case 'Published':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      case 'Completed':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
      case 'Ongoing':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-120px)] flex-col items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mb-4" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          {t('exams.manage.loading', 'Soo dejinaya Xogta Imtixaannada...')}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-28">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-800 p-5 sm:p-8 md:p-10 text-white shadow-2xl shadow-brand-900/20 border border-white/15">
        <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur-md">
              <Sparkles size={14} className="text-amber-300" />
              <span>{t('examHub', 'Xafiiska Imtixaanaadka & Qiimaynta')}</span>
              {isTeacher && (
                <span className="ml-1 rounded-full bg-brand-500/80 px-2 py-0.5 text-[10px] font-black text-white">
                  {currentUser?.fullName}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {t('examDashboardTitle', 'Dulmarka Imtixaanaadka')}
            </h1>

            <p className="max-w-2xl text-xs sm:text-sm font-medium text-white/85 leading-relaxed">
              {isTeacher
                ? 'Halkan waxaad si toos ah ugala socon kartaa dhibco-gelinta maaddooyinka fasalladaada loo qoray iyo natiijooyinkooda.'
                : 'Maamul guud oo ku saabsan dhammaan imtixaannada machadka, heerka gelinta dhibcaha ardayda, iyo warbixinnada natiijooyinka.'}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="rounded-2xl bg-white/12 px-3.5 py-2 ring-1 ring-white/20 backdrop-blur-md text-xs font-bold">
                <span className="opacity-70 mr-1.5">Sannad-Dugsiyeedka:</span>
                <span className="font-black underline">{new Date().getFullYear()}/{new Date().getFullYear() + 1}</span>
              </div>
              <div className="rounded-2xl bg-white/12 px-3.5 py-2 ring-1 ring-white/20 backdrop-blur-md text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-300" />
                <span>Heerka Gelinta:</span>
                <span className="font-black text-emerald-300">{summary.overallCompletionRate}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-white/25 active:scale-95"
              title="Cusbooneysii xogta"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Cusbooneysiin...' : 'Cusbooneysii'}</span>
            </button>
            <button
              onClick={() => navigate('/exams/marks')}
              className="flex items-center gap-2 rounded-2xl bg-white text-brand-700 px-5 py-3 text-xs font-black uppercase tracking-wider shadow-lg shadow-black/15 transition hover:bg-white/90 active:scale-95"
            >
              <PenSquare size={16} />
              <span>{t('exams.marks.title', 'Gelinta Dhibcaha')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Exams */}
        <div
          onClick={() => navigate('/exams')}
          className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition">
              <ClipboardList size={20} />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Imtixaan
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('totalExams', 'Wadarta Imtixaannada')}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {summary.totalExams}
          </h3>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
            <span>{summary.publishedCount} La Daabacay</span> · <span>{summary.ongoingCount} Socda</span>
          </p>
        </div>

        {/* Card 2: Marks Progress */}
        <div
          onClick={() => navigate('/exams/marks')}
          className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition">
              <PenSquare size={20} />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {summary.overallCompletionRate}%
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('marksCompletionRate', 'Heerka Dhibco-Gelinta')}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {summary.overallCompletionRate}%
          </h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.overallCompletionRate)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Classes Covered */}
        <div
          onClick={() => navigate('/exams')}
          className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition">
              <BookOpen size={20} />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              Fasallo
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('classesCount', 'Fasallada Galaya')}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {summary.totalClasses}
          </h3>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">
            {summary.totalStudentsAssessed} Arday ayaa diiwaangashan
          </p>
        </div>

        {/* Card 4: Pass Rate */}
        <div
          onClick={() => navigate('/exams/results')}
          className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition">
              <Award size={20} />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              Gudubka
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('passRate', 'Heerka Gudubka Guud')}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {summary.overallPassRate}%
          </h3>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">
            Celcelis: {summary.averageScore} dhibcood
          </p>
        </div>
      </section>

      {/* Quick Action Navigation Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Action 1: Mark Entry */}
        <button
          onClick={() => navigate('/exams/marks')}
          className="group rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-left hover:border-brand-500 hover:shadow-lg transition-all duration-300 flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 group-hover:scale-110 transition mb-2">
              <PenSquare size={20} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">
              {t('exams.marks.title', 'Gelinta Dhibcaha')}
            </h4>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Geli dhibcaha Nisfi & Nihaayi
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-1 transition" />
        </button>

        {/* Action 2: Results */}
        <button
          onClick={() => navigate('/exams/results')}
          className="group rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-left hover:border-emerald-500 hover:shadow-lg transition-all duration-300 flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition mb-2">
              <Award size={20} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">
              {t('exams.results.title', 'Natiijooyinka & Shahaadooyinka')}
            </h4>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Daabac kaadhadhka ardayda
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
        </button>

        {/* Action 3: Timetable */}
        <button
          onClick={() => navigate('/exams/schedule')}
          className="group rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-left hover:border-indigo-500 hover:shadow-lg transition-all duration-300 flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition mb-2">
              <Calendar size={20} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">
              {t('exams.schedule.title', 'Jadwalka Imtixaanka')}
            </h4>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Maalmaha & qolalka imtixaanka
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
        </button>

        {/* Action 4: Manage Exams */}
        <button
          onClick={() => navigate('/exams')}
          className="group rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-left hover:border-purple-500 hover:shadow-lg transition-all duration-300 flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition mb-2">
              <ClipboardList size={20} />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">
              {t('exams.manage.newExam', 'Diiwaanka Imtixaannada')}
            </h4>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Abuur & maamul imtixaannada
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition" />
        </button>
      </section>

      {/* Grade Distribution & Status Breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Grade Distribution Pills */}
        <div className="lg:col-span-2 rounded-[28px] p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Qaybsanaanta Darajooyinka (Grade Distribution)
              </h3>
              <p className="text-xs font-medium text-slate-400">
                Heerka dhibcaha ardayda la qiimeeyay guud ahaan
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Wadarta: {summary.totalStudentsAssessed} arday
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 pt-2">
            {[
              { grade: 'A+', range: '90-100%', count: summary.gradeDistribution['A+'] || 0, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
              { grade: 'A', range: '80-89%', count: summary.gradeDistribution['A'] || 0, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200' },
              { grade: 'B', range: '70-79%', count: summary.gradeDistribution['B'] || 0, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
              { grade: 'C', range: '60-69%', count: summary.gradeDistribution['C'] || 0, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
              { grade: 'D', range: '50-59%', count: summary.gradeDistribution['D'] || 0, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200' },
              { grade: 'F', range: '<50%', count: summary.gradeDistribution['F'] || 0, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200' },
            ].map(item => (
              <div key={item.grade} className={`rounded-2xl p-3 border text-center ${item.color}`}>
                <span className="text-lg font-black block">{item.grade}</span>
                <span className="text-[10px] opacity-75 font-bold block">{item.range}</span>
                <span className="text-xs font-black mt-1 block">{item.count} arday</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exam Types Overview */}
        <div className="rounded-[28px] p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-black text-slate-900 dark:text-white text-base">
            Noocyada Imtixaannada
          </h3>
          <div className="space-y-2.5">
            {[
              { type: 'Mid-Term', label: 'Mid-Term (Nisfi)', count: summary.typeDistribution['Mid-Term'] || 0, color: 'bg-brand-500' },
              { type: 'Final', label: 'Final (Nihaayi)', count: summary.typeDistribution['Final'] || 0, color: 'bg-indigo-500' },
              { type: 'Monthly', label: 'Monthly (Bille)', count: summary.typeDistribution['Monthly'] || 0, color: 'bg-emerald-500' },
              { type: 'Quiz', label: 'Quiz (Kedis)', count: summary.typeDistribution['Quiz'] || 0, color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.type} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 shadow-2xs">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Exams & Marks Progress Table */}
      <section className="rounded-[28px] p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg">
              Heerka Dhibco-Gelinta Imtixaannada
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Imtixaannadii ugu dambeeyay iyo heerka ay dhibco-gelintu marayso
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Raadi imtixaan ama fasal..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
              />
            </div>

            {/* Filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="All">Dhammaan Noocyada</option>
              <option value="Mid-Term">Mid-Term (Nisfi)</option>
              <option value="Final">Final (Nihaayi)</option>
              <option value="Monthly">Monthly (Bille)</option>
            </select>
          </div>
        </div>

        {filteredExams.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-bold text-sm bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-250 dark:border-slate-800">
            Wax imtixaan ah lama helin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3.5 px-4 rounded-l-xl">Imtixaanka</th>
                  <th className="py-3.5 px-4">Fasalka</th>
                  <th className="py-3.5 px-4">Nooca</th>
                  <th className="py-3.5 px-4">Xaaladda</th>
                  <th className="py-3.5 px-4">Heerka Gelinta</th>
                  <th className="py-3.5 px-4">Gudubka</th>
                  <th className="py-3.5 px-4 text-center rounded-r-xl">Hawsha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-bold">
                {filteredExams.map(exam => (
                  <tr key={exam._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-black text-slate-900 dark:text-white text-sm">{exam.title}</p>
                      <p className="text-[10px] text-slate-400">{exam.term || 'Term 1'} · Max: {exam.maxMarks}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {classLabel(exam.class, 'Fasal aan la aqoon')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                        {tv(exam.examType)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${statusBadge(exam.status)}`}>
                        {tv(exam.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${exam.completionRate === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                            style={{ width: `${Math.min(100, exam.completionRate)}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{exam.completionRate}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {exam.passRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => navigate('/exams/marks')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-600 dark:hover:text-white text-xs font-black transition shadow-2xs"
                      >
                        <PenSquare size={13} />
                        <span>Geli Dhibco</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExamDashboard;
