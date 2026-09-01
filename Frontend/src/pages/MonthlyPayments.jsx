import React, { useState, useEffect, useMemo } from 'react';
import { CalendarRange, Search, Phone, ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentMonthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/**
 * Monthly payment view.
 *
 * Reads the same /cashbook/payers endpoint the Payers page uses, with a month
 * argument. Students appear here purely because they exist in the database — the
 * endpoint groups every registered student under the person who pays for them, so
 * registering a student is all that is needed for them to show up.
 */
const MonthlyPayments = () => {
  const { showAlert } = useAlert();
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    let cancelled = false;
    const fetchPayers = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/cashbook/payers', { params: { month: monthKey } });
        if (!cancelled) setPayers(data || []);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load monthly payments', error);
        showAlert({ type: 'danger', title: 'Error', message: 'Failed to load monthly payments.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPayers();
    return () => { cancelled = true; };
  }, [monthKey, showAlert]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return payers;
    return payers.filter(
      (p) => (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q)
    );
  }, [payers, search]);

  const totals = useMemo(() => ({
    money: payers.reduce((sum, p) => sum + Number(p.totalFee || 0), 0),
    students: payers.reduce((sum, p) => sum + Number(p.studentCount || 0), 0)
  }), [payers]);

  const years = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  }, []);

  // Every year/month pair the two old controls could reach, flattened into one
  // list for the single combo box. Newest first so the current month is near the
  // top. The value is the same YYYY-MM key the request already uses.
  const monthOptions = useMemo(() => {
    const opts = [];
    for (const y of [...years].sort((a, b) => b - a)) {
      for (let m = 11; m >= 0; m -= 1) {
        opts.push({
          value: `${y}-${String(m + 1).padStart(2, '0')}`,
          label: `${MONTH_NAMES[m]} ${y}`
        });
      }
    }
    return opts;
  }, [years]);

  if (loading) {
    return <div className="p-10 text-center text-slate-500 font-bold">Loading Monthly Payments...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10 print:hidden">
            <CalendarRange size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
              Monthly Payments
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">
              Registered students by month · who pays · total fee
            </p>
          </div>
        </div>
      </div>

      {/* Period selector — a single combo box carrying both month and year. */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm w-full max-w-xs print:hidden">
        <label htmlFor="month-select" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0 leading-tight">
          Month &amp; Year
        </label>
        <select
          id="month-select"
          value={monthKey}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-');
            setYear(Number(y));
            setMonth(Number(m) - 1);
          }}
          className="w-full min-w-0 bg-transparent outline-none text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md print:hidden">
        <Search size={18} className="text-slate-400 mr-3" />
        <input
          type="text"
          placeholder="Search by payer name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
        />
      </div>

      {/* Table — same structure and styling as the Payers page */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-5 w-10 print:hidden"></th>
                <th className="px-4 py-5">Payer Name</th>
                <th className="px-8 py-5">Number</th>
                <th className="px-8 py-5 text-center">Students</th>
                <th className="px-8 py-5 text-right">Total Money</th>
                <th className="px-8 py-5 text-center">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((p) => {
                const isOpen = expandedKey === p.key;
                return (
                  <React.Fragment key={p.key}>
                    <tr
                      onClick={() => setExpandedKey(isOpen ? null : p.key)}
                      className={`cursor-pointer transition-colors ${
                        isOpen ? 'bg-slate-50 dark:bg-slate-800/30' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10'
                      }`}
                    >
                      <td className="px-4 py-6 text-slate-400 print:hidden">
                        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>
                      <td className="px-4 py-6 text-sm font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                      <td className="px-8 py-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <Phone size={13} className="text-slate-400 print:hidden" />
                          {p.phone || '—'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="px-3 py-1 text-xs font-black rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {p.studentCount}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right text-sm font-black text-slate-900 dark:text-white">
                        ${fmtMoney(p.totalFee)}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center">
                          <span className="inline-block w-6 h-6 rounded-md border-2 border-slate-900 dark:border-slate-300 print:border-black" />
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/20 print:hidden">
                        <td colSpan={6} className="px-6 pb-6 pt-0">
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                  <th className="px-5 py-3">Student</th>
                                  <th className="px-5 py-3">Class</th>
                                  <th className="px-5 py-3 text-right">Monthly Fee</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(p.students || []).map((s) => (
                                  <tr key={s.studentId}>
                                    <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-200">{s.name}</td>
                                    <td className="px-5 py-3 text-slate-500">{s.className || '—'}</td>
                                    <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white">
                                      ${fmtMoney(s.monthlyFee)}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50 dark:bg-slate-800/40">
                                  <td className="px-5 py-3 uppercase text-[11px] text-slate-500" colSpan={2}>Total</td>
                                  <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white">
                                    ${fmtMoney(p.totalFee)}
                                  </td>
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

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-slate-400 text-sm font-semibold">
                    No registered students for {MONTH_NAMES[month]} {year}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Month total — closes the monthly list it sums. Values unchanged. */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 print:hidden">
            <Wallet size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {MONTH_NAMES[month]} {year}
            </p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {totals.students} student{totals.students === 1 ? '' : 's'} across {payers.length} payer{payers.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
          ${fmtMoney(totals.money)}
        </p>
      </div>
    </div>
  );
};

export default MonthlyPayments;
