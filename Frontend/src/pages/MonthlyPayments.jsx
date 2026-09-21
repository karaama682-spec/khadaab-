import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarRange, Search, Phone, ChevronDown, ChevronRight, Wallet, X,
  CheckCircle2, Clock, AlertCircle, Users, ArrowUpRight, DollarSign, Filter, Printer
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { cycleShortLabel, cycleLabel, currentCycle } from '../utils/billingCycle';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Monthly payment view.
 *
 * Reads the /cashbook/payers endpoint for a given billing cycle.
 * Supports filtering by payment status:
 *  - 'all': All registered payers
 *  - 'paid': ONLY payers who have actually paid this month (paidAmount > 0)
 *  - 'pending': ONLY payers who have unpaid balance (remaining > 0)
 */
const MonthlyPayments = () => {
  const { showAlert } = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);

  // Status filter: 'all' | 'paid' | 'pending' (from URL or state)
  const initialStatus = searchParams.get('status') || searchParams.get('filter') || 'all';
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Sync with URL query parameter when it changes
  useEffect(() => {
    const s = searchParams.get('status') || searchParams.get('filter') || 'all';
    setStatusFilter(s);
  }, [searchParams]);

  // Open on the CURRENT 25→24 billing cycle
  const [initYear, initMonth] = currentCycle().split('-').map(Number);
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth - 1); // 0-11

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const fetchPayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/cashbook/payers', { params: { month: monthKey } });
      setPayers(data || []);
    } catch (err) {
      console.error('Failed to load monthly payments', err);
      const msg = err.response?.data?.message || err.message || 'Failed to load monthly payments.';
      setError(msg);
      showAlert({ type: 'danger', title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayers();
  }, [monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Status filter logic
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'paid') {
      // ONLY payers who actually paid money for this cycle (paidAmount > 0)
      return payers.filter((p) => Number(p.paidAmount || 0) > 0);
    }
    if (statusFilter === 'pending') {
      // ONLY payers who have an unpaid balance (remaining > 0 or not fully paid)
      return payers.filter((p) => {
        const remaining = Number(p.remaining !== undefined ? p.remaining : (p.totalFee - (p.paidAmount || 0)));
        return remaining > 0 && !p.paid;
      });
    }
    return payers;
  }, [payers, statusFilter]);

  // Search filter applied on top of status filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return statusFiltered;
    const qDigits = q.replace(/\D/g, '');
    return statusFiltered.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const phoneMatch =
        (p.phone || '').toLowerCase().includes(q) ||
        (qDigits && (p.phone || '').replace(/\D/g, '').includes(qDigits));
      const altPhoneMatch =
        (p.alternatePhone || '').toLowerCase().includes(q) ||
        (qDigits && (p.alternatePhone || '').replace(/\D/g, '').includes(qDigits));
      const studentMatch = (p.students || []).some((s) => (s.name || '').toLowerCase().includes(q));
      return nameMatch || phoneMatch || altPhoneMatch || studentMatch;
    });
  }, [statusFiltered, search]);

  // Comprehensive aggregate stats
  const totals = useMemo(() => {
    let expected = 0;
    let collected = 0;
    let pending = 0;
    let paidPayersCount = 0;
    let pendingPayersCount = 0;
    let studentsCount = 0;

    payers.forEach((p) => {
      const fee = Number(p.totalFee || 0);
      const paid = Number(p.paidAmount || 0);
      const rem = Number(p.remaining !== undefined ? p.remaining : Math.max(0, fee - paid));
      expected += fee;
      collected += paid;
      pending += rem;
      studentsCount += Number(p.studentCount || 0);

      if (paid > 0) {
        paidPayersCount += 1;
      }
      if (rem > 0 && !p.paid) {
        pendingPayersCount += 1;
      }
    });

    return {
      expected,
      collected,
      pending,
      paidPayersCount,
      pendingPayersCount,
      studentsCount
    };
  }, [payers]);

  const years = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  }, []);

  const monthOptions = useMemo(() => {
    const opts = [];
    for (const y of [...years].sort((a, b) => b - a)) {
      for (let m = 11; m >= 0; m -= 1) {
        const value = `${y}-${String(m + 1).padStart(2, '0')}`;
        opts.push({
          value,
          label: `${MONTH_NAMES[m]} ${y} cycle (${cycleShortLabel(value)})`
        });
      }
    }
    return opts;
  }, [years]);

  const handleTabChange = (newStatus) => {
    setStatusFilter(newStatus);
    const nextParams = new URLSearchParams(searchParams);
    if (newStatus === 'all') {
      nextParams.delete('status');
      nextParams.delete('filter');
    } else {
      nextParams.set('status', newStatus);
    }
    setSearchParams(nextParams);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-24 print:p-0 print:m-0 print:space-y-0 print:max-w-none print:pb-0">
      {/* Ultra-compact print style to eliminate all wasted whitespace */}
      <style>{`
        @media print {
          @page {
            margin: 4mm 4mm 4mm 4mm !important;
            size: A4 portrait;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body, html, #root {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 8pt !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          aside, nav, header, footer, .print\\:hidden {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .print-header-banner {
            background-color: #020617 !important;
            color: #ffffff !important;
            padding: 6px 8px !important;
            margin-bottom: 4px !important;
            border-radius: 2px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-header-banner h1,
          .print-header-banner h2,
          .print-header-banner p,
          .print-header-banner span,
          .print-header-banner div {
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-header-banner .report-accent {
            color: #86efac !important;
            font-weight: 900 !important;
          }
          .print-compact-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .print-compact-table th {
            padding: 3px 5px !important;
            font-size: 7.5pt !important;
            background-color: #0f172a !important;
            color: #ffffff !important;
            border: 0.5px solid #0f172a !important;
            font-weight: 800 !important;
            line-height: 1.1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-compact-table th * {
            color: #ffffff !important;
          }
          .print-compact-table td {
            padding: 2px 5px !important;
            font-size: 8pt !important;
            line-height: 1.1 !important;
            border: 0.5px solid #cbd5e1 !important;
            color: #0f172a !important;
          }
          .print-compact-table tr {
            page-break-inside: avoid !important;
          }
          .print-summary-row {
            background-color: #0f172a !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-summary-row td {
            color: #ffffff !important;
            background-color: #0f172a !important;
            border: 0.5px solid #0f172a !important;
          }
          .print-summary-row td * {
            color: #ffffff !important;
          }
        }
      `}</style>

      {/* Printable Header Banner (Front of paper - all white text on dark card) */}
      <div className="hidden print:block print-header-banner">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[11pt] font-black uppercase tracking-tight text-white leading-tight">
              CUMAR BINU KHADHAAB - INSTITUTE MANAGEMENT
            </h1>
            <h2 className="text-[8.5pt] font-extrabold text-white report-accent uppercase mt-0.5 leading-tight">
              {statusFilter === 'paid'
                ? 'LIISKA ARDAYDA & WAALIDIINTA LACAGTA BIXIYEY (FEES COLLECTED)'
                : statusFilter === 'pending'
                ? 'LIISKA ARDAYDA & WAALIDIINTA DEYNTA KU DHIMAN TAHAY (PENDING FEES)'
                : 'WARBIXINTA GUUD EE BIXINTA LACAGAHA (TUITION PAYMENTS REPORT)'}
            </h2>
            <p className="text-[7.5pt] text-white mt-0.5">
              Wareegga: <span className="font-bold text-white">{cycleLabel(monthKey)}</span> · Daabacay: <span className="text-white">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
          <div className="text-right text-[7.5pt] leading-tight text-white">
            <p className="font-bold text-white">Wadarta La Bixiyey: <span className="font-black text-white report-accent">${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0))}</span></p>
            <p className="font-bold text-white">Wadarta Guud: <span className="font-black text-white">${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.totalFee || 0), 0))}</span></p>
            <p className="font-bold text-white">Tirada Payer-ka: <span className="font-black text-white">{filtered.length}</span></p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2 print:hidden">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10 print:hidden">
            <CalendarRange size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none md:text-4xl">
              Monthly Payments
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-2 uppercase tracking-wider">
              Xisaabta Bixinta Lacagaha Wareegga (25th → 24th) · {cycleLabel(monthKey)}
            </p>
          </div>
        </div>

        {/* Action Controls: Period selector + Print Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm w-full sm:w-auto print:hidden">
            <label htmlFor="month-select" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0 leading-tight">
              Wareegga
            </label>
            <select
              id="month-select"
              value={monthKey}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                setYear(Number(y));
                setMonth(Number(m) - 1);
              }}
              className="w-full min-w-0 bg-transparent outline-none text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 active:scale-95 print:hidden"
            title="Daabaco warbixinta (Print Report)"
          >
            <Printer size={16} />
            <span>Daabaco / Print</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
        {/* Total Expected */}
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Wadarta La Filayo (Expected)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            ${fmtMoney(totals.expected)}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {totals.studentsCount} arday guud ahaan
          </p>
        </div>

        {/* Collected */}
        <div 
          onClick={() => handleTabChange('paid')}
          className={`cursor-pointer rounded-3xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 ${
            statusFilter === 'paid'
              ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/20'
              : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Lacagta La Bixiyey (Collected)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            ${fmtMoney(totals.collected)}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {totals.paidPayersCount} qof ayaa lacag bixiyey
          </p>
        </div>

        {/* Pending */}
        <div 
          onClick={() => handleTabChange('pending')}
          className={`cursor-pointer rounded-3xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 ${
            statusFilter === 'pending'
              ? 'border-rose-500 bg-rose-50/40 ring-2 ring-rose-500/20 dark:border-rose-500 dark:bg-rose-950/20'
              : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Lacagta Dhiman (Pending)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
            ${fmtMoney(totals.pending)}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {totals.pendingPayersCount} qof ayaa weli lacag ku dhiman tahay
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-slate-100/90 p-1.5 dark:bg-slate-800/90 w-fit">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>Dhammaan (All)</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:bg-slate-600 dark:text-slate-200">
              {payers.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('paid')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              statusFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Lacagta Bixiyey (Paid)</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              statusFilter === 'paid' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {totals.paidPayersCount}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('pending')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              statusFilter === 'pending'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400'
            }`}
          >
            <AlertCircle size={14} />
            <span>Weli Aan Bixin (Pending)</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              statusFilter === 'pending' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
            }`}>
              {totals.pendingPayersCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-4 py-2.5 border border-slate-100 dark:border-slate-800 shadow-sm w-full max-w-md focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
          <Search size={16} className="text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Raadi magaca ama lambarka taleefanka..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden print:rounded-none print:border-0 print:shadow-none print:m-0 print:p-0">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left print-compact-table">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 print:text-[7.5pt] print:bg-slate-900 print:text-white">
                <th className="px-4 py-4 w-10 print:hidden"></th>
                <th className="px-5 py-4 print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Payer Name (Lacag-bixiyaha)</th>
                <th className="px-5 py-4 print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Phone Numbers</th>
                <th className="px-5 py-4 text-center print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Students</th>
                <th className="px-5 py-4 text-right print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Fee (Wadarta)</th>
                <th className="px-5 py-4 text-right print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Paid (La Bixiyey)</th>
                <th className="px-5 py-4 text-right print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Remaining (Dhiman)</th>
                <th className="px-5 py-4 text-center print:px-1.5 print:py-1 print:text-[8pt] print:text-white">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
              {filtered.map((p) => {
                const isOpen = expandedKey === p.key;
                const paidAmt = Number(p.paidAmount || 0);
                const feeAmt = Number(p.totalFee || 0);
                const remAmt = Number(p.remaining !== undefined ? p.remaining : Math.max(0, feeAmt - paidAmt));
                const isFullyPaid = p.paid || (feeAmt > 0 && paidAmt >= feeAmt);
                const isPartial = !isFullyPaid && paidAmt > 0;

                return (
                  <React.Fragment key={p.key}>
                    <tr
                      onClick={() => setExpandedKey(isOpen ? null : p.key)}
                      className={`cursor-pointer transition-colors ${
                        isOpen ? 'bg-slate-50 dark:bg-slate-800/30' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10'
                      } print:border-b print:border-slate-300`}
                    >
                      <td className="px-4 py-4 text-slate-400 print:hidden">
                        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 print:px-1.5 print:py-0.5 print:text-[8pt] print:text-black">
                        {p.name}
                        {p.relationship && (
                          <span className="block text-[10px] text-slate-400 font-semibold uppercase print:text-[7pt] print:text-slate-600 leading-tight">{p.relationship}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 print:px-1.5 print:py-0.5 print:text-[8pt] print:text-black">
                        <div className="flex flex-col gap-1.5 print:gap-0 leading-tight">
                          {p.phone ? (
                            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 print:text-[7.5pt] print:text-black">
                              {p.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs print:text-[7.5pt]">—</span>
                          )}
                          {p.alternatePhone && p.alternatePhone !== p.phone && (
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 print:text-[7.5pt] print:text-slate-700">
                              {p.alternatePhone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center print:px-1.5 print:py-0.5 print:text-[8pt] print:text-black">
                        <span className="px-3 py-1 text-xs font-black rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 print:bg-transparent print:p-0 print:text-black">
                          {p.studentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums print:px-1.5 print:py-0.5 print:text-[8pt] print:text-black">
                        ${fmtMoney(feeAmt)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums print:px-1.5 print:py-0.5 print:text-[8pt] print:text-black">
                        ${fmtMoney(paidAmt)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums print:px-1.5 print:py-0.5 print:text-[8pt] print:text-black">
                        ${fmtMoney(remAmt)}
                      </td>
                      <td className="px-5 py-4 text-center print:px-1.5 print:py-0.5 print:text-[7.5pt]">
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 print:border-emerald-700 print:text-emerald-900 print:px-1.5 print:py-0.2 print:text-[7pt]">
                            <CheckCircle2 size={12} className="print:hidden" />
                            <span>Bixiyey (Paid)</span>
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300 print:border-amber-700 print:text-amber-900 print:px-1.5 print:py-0.2 print:text-[7pt]">
                            <Clock size={12} className="print:hidden" />
                            <span>Qeyb (Partial)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300 print:border-rose-700 print:text-rose-900 print:px-1.5 print:py-0.2 print:text-[7pt]">
                            <AlertCircle size={12} className="print:hidden" />
                            <span>Aan Bixin (Unpaid)</span>
                          </span>
                        )}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/20 print:hidden">
                        <td colSpan={8} className="px-6 pb-6 pt-0">
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 mt-2">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                  <th className="px-5 py-3">Student Name</th>
                                  <th className="px-5 py-3">Class</th>
                                  <th className="px-5 py-3 text-right">Monthly Fee</th>
                                  <th className="px-5 py-3 text-right">Paid</th>
                                  <th className="px-5 py-3 text-right">Remaining</th>
                                  <th className="px-5 py-3 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(p.students || []).map((s) => {
                                  const sPaid = Number(s.paid || 0);
                                  const sFee = Number(s.monthlyFee || 0);
                                  const sRem = Number(s.remaining !== undefined ? s.remaining : Math.max(0, sFee - sPaid));
                                  const sIsPaid = sFee > 0 && sPaid >= sFee;

                                  return (
                                    <tr key={s.studentId}>
                                      <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-200">{s.name}</td>
                                      <td className="px-5 py-3 text-slate-500">{s.className || '—'}</td>
                                      <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                        ${fmtMoney(sFee)}
                                      </td>
                                      <td className="px-5 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        ${fmtMoney(sPaid)}
                                      </td>
                                      <td className="px-5 py-3 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                        ${fmtMoney(sRem)}
                                      </td>
                                      <td className="px-5 py-3 text-center">
                                        {sIsPaid ? (
                                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                            ✓ Bixiyey
                                          </span>
                                        ) : sPaid > 0 ? (
                                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                            Qeyb
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                            Aan Bixin
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="bg-slate-50 dark:bg-slate-800/40 font-black">
                                  <td className="px-5 py-3 uppercase text-[11px] text-slate-500" colSpan={2}>Wadarta Payer-ka</td>
                                  <td className="px-5 py-3 text-right text-slate-900 dark:text-white tabular-nums">
                                    ${fmtMoney(feeAmt)}
                                  </td>
                                  <td className="px-5 py-3 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    ${fmtMoney(paidAmt)}
                                  </td>
                                  <td className="px-5 py-3 text-right text-rose-600 dark:text-rose-400 tabular-nums">
                                    ${fmtMoney(remAmt)}
                                  </td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {loading && (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center text-slate-400 text-sm font-medium">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500 font-semibold">Loading monthly payments...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center">
                    <div className="max-w-md mx-auto p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-sm flex flex-col items-center gap-3">
                      <p className="font-semibold">{error}</p>
                      <button
                        onClick={fetchPayers}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        Retry Loading
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center text-slate-500 text-sm">
                    {statusFilter === 'paid' ? (
                      <div className="max-w-md mx-auto flex flex-col items-center gap-2">
                        <CheckCircle2 size={32} className="text-slate-300 dark:text-slate-600" />
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          Ma jiraan wax lacag ah oo bishan weli la qabtay
                        </p>
                        <p className="text-xs text-slate-400">
                          Dhammaan lacag-bixiyeyaasha bishan ({cycleLabel(monthKey)}) weli lacag ma bixin.
                        </p>
                      </div>
                    ) : statusFilter === 'pending' ? (
                      <div className="max-w-md mx-auto flex flex-col items-center gap-2">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          Dhammaan lacag-bixiyeyaasha waa wada bixiyeen!
                        </p>
                        <p className="text-xs text-slate-400">
                          Wax deyn ah oo ku dhiman wareeggan ma jiraan.
                        </p>
                      </div>
                    ) : (
                      <p className="font-semibold">
                        Lama helin wax xog ah oo ku saabsan wareegga {MONTH_NAMES[month]} {year}.
                      </p>
                    )}
                  </td>
                </tr>
              )}

              {/* Compact Print Summary Row (Only on paper) */}
              <tr className="hidden print:table-row font-black print-summary-row border-t-2 border-slate-950">
                <td colSpan={3} className="px-1.5 py-1 text-right uppercase text-[8pt] text-white">
                  Wadarta Guud ee Liiska:
                </td>
                <td className="px-1.5 py-1 text-center text-[8pt] text-white">
                  {filtered.reduce((sum, p) => sum + Number(p.studentCount || 0), 0)}
                </td>
                <td className="px-1.5 py-1 text-right text-[8pt] text-white">
                  ${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.totalFee || 0), 0))}
                </td>
                <td className="px-1.5 py-1 text-right text-[8pt] text-white">
                  ${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0))}
                </td>
                <td className="px-1.5 py-1 text-right text-[8pt] text-white">
                  ${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.remaining !== undefined ? p.remaining : Math.max(0, p.totalFee - (p.paidAmount || 0))), 0))}
                </td>
                <td className="px-1.5 py-1 text-center text-[7.5pt] text-white">
                  {filtered.length} Payers
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Month total footer (Web only, hidden in print) */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 print:hidden">
            <Wallet size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {MONTH_NAMES[month]} {year} cycle · {cycleLabel(monthKey)}
            </p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Xisaabta shaandheysan: {filtered.length} payer{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">La Bixiyey (Collected)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
              ${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Wadarta (Total)</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              ${fmtMoney(filtered.reduce((sum, p) => sum + Number(p.totalFee || 0), 0))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPayments;
