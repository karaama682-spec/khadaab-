import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale, X, TrendingUp, TrendingDown, UserPlus, UserMinus, SlidersHorizontal,
  FileText, CheckCircle2, AlertCircle, Printer, Search, RefreshCw, Calendar, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatPersonName = (str) => {
  if (!str || typeof str !== 'string') return '—';
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const formatDate = (d, locale = 'en') => {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return String(d);
  }
};

const CycleReconciliationModal = ({ isOpen, onClose, cycleKey, tenantInfo }) => {
  const { t, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'exits' | 'edits' | 'memo'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReconciliation = async () => {
    if (!cycleKey) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/cashbook/cycle-reconciliation', {
        params: { cycle: cycleKey }
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load cycle reconciliation:', err);
      setError(err.response?.data?.message || err.message || 'Khalad ayaa dhacay markii la soo qaadayay dhaqdhaqaaqa bisha.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReconciliation();
      setSearchQuery('');
    }
  }, [isOpen, cycleKey]);

  // Tab counts & totals
  const summary = data?.summary || {
    startingDue: 0,
    newEnrollmentsCount: 0,
    newEnrollmentsFee: 0,
    exitedStudentsCount: 0,
    exitedStudentsFee: 0,
    feeIncreasesCount: 0,
    feeIncreasesTotal: 0,
    feeDecreasesCount: 0,
    feeDecreasesTotal: 0,
    netFeeAdjustment: 0,
    calculatedEnding: 0,
    endingDue: 0,
    discrepancy: 0,
    isReconciled: true
  };

  // Filtered lists based on search
  const filteredNewStudents = useMemo(() => {
    const list = data?.newStudents || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.studentCode || '').toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q) ||
      (s.guardianName || '').toLowerCase().includes(q) ||
      (s.guardianPhone || '').includes(q)
    );
  }, [data?.newStudents, searchQuery]);

  const filteredExitedStudents = useMemo(() => {
    const list = data?.exitedStudents || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.studentCode || '').toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q) ||
      (s.guardianName || '').toLowerCase().includes(q) ||
      (s.guardianPhone || '').includes(q) ||
      (s.exitReason || '').toLowerCase().includes(q)
    );
  }, [data?.exitedStudents, searchQuery]);

  const filteredFeeAdjustments = useMemo(() => {
    const list = data?.feeAdjustments || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.studentCode || '').toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q) ||
      (s.guardianName || '').toLowerCase().includes(q) ||
      (s.guardianPhone || '').includes(q)
    );
  }, [data?.feeAdjustments, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      {/* Print-specific stylesheet */}
      <style>{`
        @media print {
          @page {
            margin: 6mm !important;
            size: A4 portrait;
          }
          body * {
            visibility: hidden !important;
          }
          #reconciliation-print-area, #reconciliation-print-area * {
            visibility: visible !important;
          }
          #reconciliation-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 8.5pt !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Scale size={24} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  {locale === 'so' ? 'Dhaqdhaqaaqa Bisha & Xisaab-Xirka Khidmadaha' : 'Tuition Roll-Forward & Reconciliation'}
                </h2>
                {summary.isReconciled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                    {locale === 'so' ? '100% Is-waafaqsan' : '100% Reconciled'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <AlertCircle size={12} strokeWidth={2.5} />
                    {locale === 'so' ? `Farqi: $${fmtMoney(summary.discrepancy)}` : `Variance: $${fmtMoney(summary.discrepancy)}`}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{data?.priorCycleLabel || data?.priorCycle || 'Wareeggii Hore'}</span>
                <ArrowRight size={13} className="text-slate-400" />
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{data?.cycleLabel || data?.cycle || cycleKey}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchReconciliation}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title={locale === 'so' ? 'Dib u cusbooneysii' : 'Refresh'}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{locale === 'so' ? 'Cusbooneysii' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 transition-colors"
              title={locale === 'so' ? 'Daabac Warbixinta' : 'Print Report'}
            >
              <Printer size={14} />
              <span className="hidden sm:inline">{locale === 'so' ? 'Daabac' : 'Print'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={locale === 'so' ? 'Xir' : 'Close'}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <div className="inline-block animate-spin text-indigo-600">
                <RefreshCw size={36} />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                {locale === 'so' ? 'Waxaa la xisaabinayaa dhaqdhaqaaqa iyo xisaab-xirka bisha...' : 'Calculating monthly roll-forward & reconciliation...'}
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-center space-y-2">
              <AlertCircle size={28} className="mx-auto" />
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={fetchReconciliation}
                className="px-4 py-2 text-xs font-black bg-rose-600 text-white rounded-xl shadow hover:bg-rose-700 transition"
              >
                {locale === 'so' ? 'Isku day mar kale' : 'Try Again'}
              </button>
            </div>
          ) : (
            <div id="reconciliation-print-area" className="space-y-6">
              
              {/* Executive Formula Ribbon */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/50">
                <div className="text-[11px] font-black tracking-widest uppercase text-indigo-300 mb-3 flex items-center justify-between">
                  <span>{locale === 'so' ? 'QAAB-DHISMEEDKA XISAAB-XIRKA (RECONCILIATION EQUATION)' : 'MONTHLY TUITION ROLL-FORWARD FORMULA'}</span>
                  <span className="text-white/60 font-semibold">{data?.priorCycle} ➔ {data?.cycle}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-center">
                  {/* Step 1: Starting */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      {locale === 'so' ? 'Khidmaddii Hore' : 'Starting Due'}
                    </span>
                    <span className="block text-lg md:text-xl font-black text-white mt-1 tabular-nums">
                      ${fmtMoney(summary.startingDue)}
                    </span>
                    <span className="block text-[9px] text-slate-400 truncate mt-0.5">
                      {data?.priorCycleLabel?.split('(')[0]?.trim() || data?.priorCycle}
                    </span>
                  </div>

                  {/* Step 2: New Enrollments */}
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="block text-[10px] font-bold uppercase text-emerald-300">
                      + {locale === 'so' ? 'Arday Cusub' : 'New Students'}
                    </span>
                    <span className="block text-lg md:text-xl font-black text-emerald-400 mt-1 tabular-nums">
                      +${fmtMoney(summary.newEnrollmentsFee)}
                    </span>
                    <span className="block text-[9px] text-emerald-300/80 truncate mt-0.5">
                      {summary.newEnrollmentsCount} {locale === 'so' ? 'arday' : 'students'}
                    </span>
                  </div>

                  {/* Step 3: Exits */}
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                    <span className="block text-[10px] font-bold uppercase text-rose-300">
                      - {locale === 'so' ? 'Arday Baxday' : 'Exited Students'}
                    </span>
                    <span className="block text-lg md:text-xl font-black text-rose-400 mt-1 tabular-nums">
                      -${fmtMoney(summary.exitedStudentsFee)}
                    </span>
                    <span className="block text-[9px] text-rose-300/80 truncate mt-0.5">
                      {summary.exitedStudentsCount} {locale === 'so' ? 'arday' : 'students'}
                    </span>
                  </div>

                  {/* Step 4: Net Fee Adjustments */}
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <span className="block text-[10px] font-bold uppercase text-amber-300">
                      ± {locale === 'so' ? 'Beddelka Fee' : 'Fee Adjustments'}
                    </span>
                    <span className="block text-lg md:text-xl font-black text-amber-400 mt-1 tabular-nums">
                      {summary.netFeeAdjustment >= 0 ? '+' : ''}${fmtMoney(summary.netFeeAdjustment)}
                    </span>
                    <span className="block text-[9px] text-amber-300/80 truncate mt-0.5">
                      {summary.feeIncreasesCount > 0 ? `+${fmtMoney(summary.feeIncreasesTotal)}` : ''}
                      {summary.feeDecreasesCount > 0 ? ` -${fmtMoney(summary.feeDecreasesTotal)}` : ''}
                      {summary.feeIncreasesCount === 0 && summary.feeDecreasesCount === 0 ? 'Waxba ma beddelmin' : ''}
                    </span>
                  </div>

                  {/* Step 5: Ending Due */}
                  <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-indigo-500/20 border border-indigo-400/40">
                    <span className="block text-[10px] font-bold uppercase text-indigo-300">
                      = {locale === 'so' ? 'Khidmadda Hadda' : 'Ending Due'}
                    </span>
                    <span className="block text-lg md:text-xl font-black text-indigo-300 mt-1 tabular-nums">
                      ${fmtMoney(summary.endingDue)}
                    </span>
                    <span className="block text-[9px] text-indigo-200/80 truncate mt-0.5">
                      {data?.cycleLabel?.split('(')[0]?.trim() || data?.cycle}
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* New Students Card */}
                <div
                  onClick={() => setActiveTab('new')}
                  className={`p-5 rounded-3xl border cursor-pointer transition-all hover:-translate-y-0.5 ${
                    activeTab === 'new'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {locale === 'so' ? 'Ardayda Cusub (Diiwaangelin)' : 'New Enrollments'}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                      <UserPlus size={18} />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    +${fmtMoney(summary.newEnrollmentsFee)}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {summary.newEnrollmentsCount} {locale === 'so' ? 'arday ayaa kusoo biirtay' : 'students added'}
                  </p>
                </div>

                {/* Exits Card */}
                <div
                  onClick={() => setActiveTab('exits')}
                  className={`p-5 rounded-3xl border cursor-pointer transition-all hover:-translate-y-0.5 ${
                    activeTab === 'exits'
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      {locale === 'so' ? 'Ardayda Baxday (Ka-bax)' : 'Exited Students'}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                      <UserMinus size={18} />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    -${fmtMoney(summary.exitedStudentsFee)}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {summary.exitedStudentsCount} {locale === 'so' ? 'arday ayaa baxday' : 'students exited'}
                  </p>
                </div>

                {/* Fee Edits Card */}
                <div
                  onClick={() => setActiveTab('edits')}
                  className={`p-5 rounded-3xl border cursor-pointer transition-all hover:-translate-y-0.5 ${
                    activeTab === 'edits'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {locale === 'so' ? 'Wax-ka-beddelka Khidmadda' : 'Fee Adjustments'}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                      <SlidersHorizontal size={18} />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    {summary.netFeeAdjustment >= 0 ? '+' : ''}${fmtMoney(summary.netFeeAdjustment)}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {summary.feeIncreasesCount} {locale === 'so' ? 'kordhin' : 'increased'} · {summary.feeDecreasesCount} {locale === 'so' ? 'dhimis' : 'decreased'}
                  </p>
                </div>
              </div>

              {/* Navigation Tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1.5 w-fit">
                  {/* Tab: New Students */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      activeTab === 'new'
                        ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <UserPlus size={14} />
                    <span>{locale === 'so' ? 'Ardayda Cusub' : 'New Students'}</span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                      {data?.newStudents?.length || 0}
                    </span>
                  </button>

                  {/* Tab: Exited Students */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('exits')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      activeTab === 'exits'
                        ? 'bg-white text-rose-700 shadow-sm dark:bg-slate-700 dark:text-rose-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <UserMinus size={14} />
                    <span>{locale === 'so' ? 'Ardayda Baxday' : 'Exited Students'}</span>
                    <span className="rounded-full bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:text-rose-300">
                      {data?.exitedStudents?.length || 0}
                    </span>
                  </button>

                  {/* Tab: Fee Adjustments */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('edits')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      activeTab === 'edits'
                        ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>{locale === 'so' ? 'Isbeddelka Fee' : 'Fee Edits'}</span>
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                      {data?.feeAdjustments?.length || 0}
                    </span>
                  </button>

                  {/* Tab: Management Memo */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('memo')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      activeTab === 'memo'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <FileText size={14} />
                    <span>{locale === 'so' ? 'Warbixinta Maamulka' : 'Executive Memo'}</span>
                  </button>
                </div>

                {/* In-modal Search Input */}
                {activeTab !== 'memo' && (
                  <div className="relative min-w-[240px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={locale === 'so' ? 'Ka raadi magaca, tel, ama fasalka...' : 'Search by name, phone, or class...'}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 1 Content: New Students Table */}
              {activeTab === 'new' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[10px] font-black text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Ardayga' : 'Student Name'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Koodhka' : 'Student ID'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Fasalka' : 'Class'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Waalidka & Tel' : 'Guardian & Phone'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Khidmadda Bisha' : 'Monthly Fee'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Taariikhda' : 'Registration Date'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredNewStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                              {searchQuery
                                ? (locale === 'so' ? 'Lama helin arday waafaqsan raadintaada.' : 'No students match your search criteria.')
                                : (locale === 'so' ? 'Ma jiro arday cusub oo wareeggan lasoo daray.' : 'No new students enrolled during this billing cycle.')}
                            </td>
                          </tr>
                        ) : (
                          filteredNewStudents.map((s, idx) => (
                            <tr key={s.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white capitalize">
                                {formatPersonName(s.name)}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {s.studentCode || '—'}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">
                                {s.className || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatPersonName(s.guardianName)}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {s.guardianPhone || '—'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                +${fmtMoney(s.monthlyFee)}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">
                                {formatDate(s.registeredDate, locale)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredNewStudents.length > 0 && (
                        <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800">
                          <tr>
                            <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-300">
                              {locale === 'so' ? 'Wadarta Khidmadda Ardayda Cusub' : 'Total New Enrollments Fee'}:
                            </td>
                            <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                              +${fmtMoney(summary.newEnrollmentsFee)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2 Content: Exited Students Table */}
              {activeTab === 'exits' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[10px] font-black text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Ardayga' : 'Student Name'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Koodhka' : 'Student ID'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Fasalka' : 'Class'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Waalidka & Tel' : 'Guardian & Phone'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Khidmadda Lumay' : 'Lost Fee'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Sababta' : 'Exit Reason'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Taariikhda & Qofka Saaray' : 'Date & Exited By'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredExitedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                              {searchQuery
                                ? (locale === 'so' ? 'Lama helin arday waafaqsan raadintaada.' : 'No students match your search criteria.')
                                : (locale === 'so' ? 'Ma jiro arday wareeggan baxay.' : 'No students exited during this billing cycle.')}
                            </td>
                          </tr>
                        ) : (
                          filteredExitedStudents.map((s, idx) => (
                            <tr key={s.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white capitalize">
                                {formatPersonName(s.name)}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {s.studentCode || '—'}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">
                                {s.className || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatPersonName(s.guardianName)}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {s.guardianPhone || '—'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                -${fmtMoney(s.monthlyFee)}
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                                  {s.exitReason || 'Exited'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatDate(s.exitDate, locale)}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {s.exitedBy || 'Admin'}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredExitedStudents.length > 0 && (
                        <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800">
                          <tr>
                            <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-300">
                              {locale === 'so' ? 'Wadarta Khidmadda Lumay' : 'Total Fee Lost From Exits'}:
                            </td>
                            <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                              -${fmtMoney(summary.exitedStudentsFee)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3 Content: Fee Adjustments Table */}
              {activeTab === 'edits' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[10px] font-black text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Ardayga' : 'Student Name'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Koodhka' : 'Student ID'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Fasalka' : 'Class'}</th>
                          <th className="py-3 px-4">{locale === 'so' ? 'Waalidka & Tel' : 'Guardian & Phone'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Khidmaddii Hore' : 'Old Fee'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Khidmadda Cusub' : 'New Fee'}</th>
                          <th className="py-3 px-4 text-right">{locale === 'so' ? 'Farqiga (±)' : 'Variance'}</th>
                          <th className="py-3 px-4 text-center">{locale === 'so' ? 'Nooca' : 'Type'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredFeeAdjustments.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                              {searchQuery
                                ? (locale === 'so' ? 'Lama helin arday waafaqsan raadintaada.' : 'No students match your search criteria.')
                                : (locale === 'so' ? 'Wax khidmad ah oo ardayda lagu beddelay wareeggan ma jiraan.' : 'No student fees were adjusted during this billing cycle.')}
                            </td>
                          </tr>
                        ) : (
                          filteredFeeAdjustments.map((s, idx) => (
                            <tr key={s.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white capitalize">
                                {formatPersonName(s.name)}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {s.studentCode || '—'}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">
                                {s.className || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatPersonName(s.guardianName)}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {s.guardianPhone || '—'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                ${fmtMoney(s.oldFee)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                ${fmtMoney(s.newFee)}
                              </td>
                              <td className={`py-3 px-4 text-right font-black tabular-nums ${
                                s.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}>
                                {s.diff > 0 ? '+' : ''}${fmtMoney(s.diff)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {s.type === 'increase' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                                    <TrendingUp size={11} />
                                    {locale === 'so' ? 'Kordhin' : 'Increase'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 uppercase">
                                    <TrendingDown size={11} />
                                    {locale === 'so' ? 'Dhimis' : 'Discount'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredFeeAdjustments.length > 0 && (
                        <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800">
                          <tr>
                            <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-300">
                              {locale === 'so' ? 'Isu-geynta Saamaynta Khidmadaha (Net Fee Variance)' : 'Net Fee Adjustment Variance'}:
                            </td>
                            <td className={`py-3 px-4 text-right text-sm tabular-nums ${
                              summary.netFeeAdjustment >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {summary.netFeeAdjustment >= 0 ? '+' : ''}${fmtMoney(summary.netFeeAdjustment)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4 Content: Executive Board Memo */}
              {activeTab === 'memo' && (
                <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {tenantInfo?.name || 'Machadka'} — {locale === 'so' ? 'Warbixinta Xisaab-Xirka Khidmadaha Bisha' : 'Executive Monthly Fee Reconciliation Memo'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {locale === 'so' ? 'Wareegga La Falanqeeyay' : 'Audit Period'}: <strong className="text-slate-800 dark:text-slate-200">{data?.cycleLabel || data?.cycle}</strong> · {locale === 'so' ? 'Markii la daabacay' : 'Generated'}: {new Date().toLocaleDateString(locale)} {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Summary Breakdown Grid */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {locale === 'so' ? '1. NUXURKA DHISMAHA GUUD EE KHIDMADDA' : '1. EXECUTIVE TUITION ROLL-FORWARD'}
                    </h4>
                    
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/60 font-sans">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {locale === 'so' ? 'Khidmaddii La Filayay Wareeggii Hore (Starting Expected Fee)' : 'Starting Expected Fees (Prior Cycle)'} ({data?.priorCycle}):
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">${fmtMoney(summary.startingDue)}</span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/60 font-sans text-emerald-600 dark:text-emerald-400">
                        <span className="font-bold">
                          (+) {locale === 'so' ? 'Ardayda Cusub ee Diiwaangashay' : 'New Student Enrollments'} ({summary.newEnrollmentsCount} {locale === 'so' ? 'arday' : 'students'}):
                        </span>
                        <span className="font-black">+${fmtMoney(summary.newEnrollmentsFee)}</span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/60 font-sans text-rose-600 dark:text-rose-400">
                        <span className="font-bold">
                          (-) {locale === 'so' ? 'Ardayda Baxday ee Khidmadoodu Lumay' : 'Exited Students Fee Lost'} ({summary.exitedStudentsCount} {locale === 'so' ? 'arday' : 'students'}):
                        </span>
                        <span className="font-black">-${fmtMoney(summary.exitedStudentsFee)}</span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/60 font-sans text-amber-600 dark:text-amber-400">
                        <span className="font-bold">
                          (±) {locale === 'so' ? 'Isu-geynta Wax-ka-beddelka Khidmadaha (Net Fee Edits)' : 'Net Fee Adjustments'} ({summary.feeIncreasesCount} {locale === 'so' ? 'kordhin' : 'inc'}, {summary.feeDecreasesCount} {locale === 'so' ? 'dhimis' : 'dec'}):
                        </span>
                        <span className="font-black">{summary.netFeeAdjustment >= 0 ? '+' : ''}${fmtMoney(summary.netFeeAdjustment)}</span>
                      </div>

                      <div className="flex justify-between pt-2 text-sm font-sans font-black text-indigo-600 dark:text-indigo-400">
                        <span className="uppercase">
                          (=) {locale === 'so' ? 'Khidmadda Dhammaadka ee La Filayo (Ending Expected Fee)' : 'Ending Expected Fees'} ({data?.cycle}):
                        </span>
                        <span>${fmtMoney(summary.endingDue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Written Executive Notes for Management */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {locale === 'so' ? '2. FAALLADA IYO JAWAABAHA MAAMULKA' : '2. MANAGEMENT ANSWERS & HIGHLIGHTS'}
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 font-medium list-disc list-inside bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                      <li>
                        <strong>{locale === 'so' ? 'Yaa baxay?' : 'Who exited?'}:</strong>{' '}
                        {summary.exitedStudentsCount > 0
                          ? (locale === 'so'
                              ? `Waxaa wareeggan baxay ${summary.exitedStudentsCount} arday, iyadoo dugsigu ku waayay lacag dhan $${fmtMoney(summary.exitedStudentsFee)}.`
                              : `${summary.exitedStudentsCount} students exited, representing $${fmtMoney(summary.exitedStudentsFee)} in lost tuition.`)
                          : (locale === 'so' ? 'Ma jiro arday wareeggan baxay.' : 'Zero students exited during this period.')}
                      </li>
                      <li>
                        <strong>{locale === 'so' ? 'Meeqo arday ayaa cusub?' : 'How many new students?'}:</strong>{' '}
                        {summary.newEnrollmentsCount > 0
                          ? (locale === 'so'
                              ? `Waxaa dugsiga kusoo biiray ${summary.newEnrollmentsCount} arday cusub oo dakhliga bishii kusoo kordhiyay $${fmtMoney(summary.newEnrollmentsFee)}.`
                              : `${summary.newEnrollmentsCount} new students enrolled, adding $${fmtMoney(summary.newEnrollmentsFee)} in monthly fees.`)
                          : (locale === 'so' ? 'Ma jiro arday cusub oo wareeggan diiwaangashay.' : 'Zero new students enrolled during this period.')}
                      </li>
                      <li>
                        <strong>{locale === 'so' ? 'Meeqo lacag ayaa edit lagu sameeyay?' : 'How much fee was adjusted?'}:</strong>{' '}
                        {summary.feeIncreasesCount > 0 || summary.feeDecreasesCount > 0
                          ? (locale === 'so'
                              ? `Khidmadaha waxaa lagu sameeyay ${summary.feeIncreasesCount} kordhin (wadarta: +$${fmtMoney(summary.feeIncreasesTotal)}) iyo ${summary.feeDecreasesCount} dhimis/qiimo-dhimis (wadarta: -$${fmtMoney(summary.feeDecreasesTotal)}), taasoo keenaysa saameyn net ah oo dhan ${summary.netFeeAdjustment >= 0 ? '+' : ''}$${fmtMoney(summary.netFeeAdjustment)}.`
                              : `${summary.feeIncreasesCount} increases (+$${fmtMoney(summary.feeIncreasesTotal)}) and ${summary.feeDecreasesCount} discounts (-$${fmtMoney(summary.feeDecreasesTotal)}), creating a net impact of ${summary.netFeeAdjustment >= 0 ? '+' : ''}$${fmtMoney(summary.netFeeAdjustment)}.`)
                          : (locale === 'so' ? 'Wax khidmad arday ah oo wareeggan la beddelay ma jiraan.' : 'No fees were changed during this period.')}
                      </li>
                      <li>
                        <strong>{locale === 'so' ? 'Xaaladda Xisaab-xirka' : 'Reconciliation Status'}:</strong>{' '}
                        {summary.isReconciled ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {locale === 'so' ? 'Xisaabtu 100% way is-leedahay mana jiro wax farqi ah oo aan la garanayn (Discrepancy: $0.00).' : 'Equations reconcile 100% with zero unexplained variance ($0.00).'}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {locale === 'so' ? `Waxaa jira farqi dhan $${fmtMoney(summary.discrepancy)} oo u baahan xaqiijin.` : `Variance of $${fmtMoney(summary.discrepancy)} detected.`}
                          </span>
                        )}
                      </li>
                    </ul>
                  </div>

                  {/* Sign-Off Authorization Section */}
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-6 text-center text-xs">
                    <div className="border-t border-dashed border-slate-400 pt-3">
                      <p className="font-bold text-slate-700 dark:text-slate-300">{locale === 'so' ? 'Diyaariyey' : 'Prepared By'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{locale === 'so' ? 'Khasnajiga / Xisaabiyaha' : 'Cashier / Accountant'}</p>
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-3">
                      <p className="font-bold text-slate-700 dark:text-slate-300">{locale === 'so' ? 'Xaqiijiyey' : 'Audited By'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{locale === 'so' ? 'Agaasimaha Maaliyadda' : 'Finance Director'}</p>
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-3">
                      <p className="font-bold text-slate-700 dark:text-slate-300">{locale === 'so' ? 'Ansixiyey' : 'Approved By'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{locale === 'so' ? 'Maamulaha Guud' : 'General Director'}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            {locale === 'so' ? 'Qaybta Maaliyadda & Xisaab-Xirka Khidmadaha' : 'Tuition Reconciliation & Roll-Forward Module'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition"
          >
            {locale === 'so' ? 'Xir' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CycleReconciliationModal;
