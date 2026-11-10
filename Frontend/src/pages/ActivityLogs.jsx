import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  Smartphone,
  ShieldCheck,
  Download,
  Activity,
  Lock,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Database,
  ArrowRight,
  Info,
  Clock,
  ExternalLink,
  ShieldAlert,
  Zap,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  GraduationCap,
  Users,
  DollarSign,
  Building2,
  X
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import {
  currentCycle,
  cycleLabel,
  cycleKeyForDate,
  cycleShortLabel,
  addCycles,
  cycleRange
} from '../utils/billingCycle';

const ActivityLogs = () => {
  const { t, locale, language } = useLanguage();
  const { showAlert, showConfirm } = useAlert();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalDeleted: 0,
    teachersDeleted: 0,
    studentsDeleted: 0,
    totalRestored: 0,
    totalLogs: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('Deleted');
  const [selectedAction, setSelectedAction] = useState('All');
  const [selectedCycle, setSelectedCycle] = useState('All');

  // Modal for viewing complete snapshot of a deleted record
  const [viewingLog, setViewingLog] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  // Generate recent billing cycle options
  const cycleOptions = useMemo(() => {
    const cur = currentCycle();
    const list = [
      { key: 'All', label: locale === 'so' ? 'Dhammaan Xilliyada (All Cycles)' : 'All Cycles', isCurrent: false }
    ];
    for (let i = 1; i >= -12; i--) {
      const key = addCycles(cur, i);
      list.push({
        key,
        label: `${key} · ${cycleShortLabel(key)}`,
        isCurrent: key === cur
      });
    }
    return list;
  }, [locale]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedEntityType !== 'All') params.entityType = selectedEntityType;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedAction !== 'All') params.action = selectedAction;
      if (selectedCycle !== 'All') params.cycle = selectedCycle;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const [logsRes, statsRes] = await Promise.allSettled([
        api.get('/audit-logs', { params }),
        api.get('/audit-logs/stats', { params: selectedCycle !== 'All' ? { cycle: selectedCycle } : {} })
      ]);

      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value.data)) {
        setLogs(logsRes.value.data);
      } else {
        setLogs([]);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.data) {
        setStats(statsRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      showAlert({
        type: 'danger',
        title: locale === 'so' ? 'Qalad' : 'Error',
        message: locale === 'so' ? 'Waa lagu guuldareystay soo rarista diiwaanka' : 'Failed to load audit logs'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedEntityType, selectedStatus, selectedAction, selectedCycle]);

  // Handle Restore
  const handleRestore = async (log) => {
    const isSomali = locale === 'so';
    const confirmed = await showConfirm({
      type: 'warning',
      title: isSomali ? 'Dib u Soo Celi Xogta?' : 'Restore Record?',
      message: isSomali
        ? `Ma hubtaa inaad rabto inaad dib u soo celiso ${log.entityType}: "${log.entityName || ''}"? Waxay dib ugu noqon doontaa liiska caadiga ah.`
        : `Are you sure you want to restore ${log.entityType} "${log.entityName || ''}" back to active database?`,
      confirmText: isSomali ? 'Haa, Soo Celi' : 'Yes, Restore',
      cancelText: isSomali ? 'Jooji' : 'Cancel'
    });

    if (!confirmed) return;

    try {
      setRestoringId(log._id);
      const res = await api.post(`/audit-logs/${log._id}/restore`);
      showAlert({
        type: 'success',
        title: isSomali ? 'Guul' : 'Restored',
        message: res.data?.message || (isSomali ? 'Xogta si guul leh ayaa loo soo celiyey' : 'Record restored successfully')
      });
      if (viewingLog && viewingLog._id === log._id) {
        setViewingLog(null);
      }
      fetchLogs();
    } catch (err) {
      console.error('Failed to restore record:', err);
      showAlert({
        type: 'danger',
        title: isSomali ? 'Qalad' : 'Error',
        message: err.response?.data?.message || (isSomali ? 'Dib u soo celintu way fashilantay' : 'Failed to restore record')
      });
    } finally {
      setRestoringId(null);
    }
  };

  const getEntityBadge = (type) => {
    switch (type) {
      case 'Teacher':
        return {
          label: locale === 'so' ? 'Macallin' : 'Teacher',
          icon: GraduationCap,
          className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800'
        };
      case 'Student':
        return {
          label: locale === 'so' ? 'Arday' : 'Student',
          icon: Users,
          className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
      case 'CashbookEntry':
        return {
          label: locale === 'so' ? 'Cashbook' : 'Cashbook',
          icon: DollarSign,
          className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        };
      case 'Payment':
        return {
          label: locale === 'so' ? 'Lacag-bixin' : 'Payment',
          icon: DollarSign,
          className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        };
      case 'Class':
        return {
          label: locale === 'so' ? 'Fasal' : 'Class',
          icon: Building2,
          className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
        };
      default:
        return {
          label: type || 'Record',
          icon: Database,
          className: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return {
        date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      };
    } catch (_) {
      return { date: dateString, time: '' };
    }
  };

  const getLogCycle = (log) => {
    return (
      log.snapshot?.billingCycle ||
      log.snapshot?.targetMonth ||
      log.snapshot?.month ||
      (log.snapshot?.date ? cycleKeyForDate(log.snapshot.date) : null) ||
      cycleKeyForDate(log.deletedAt || log.createdAt)
    );
  };

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (selectedCycle !== 'All') {
      list = list.filter((log) => {
        const itemCycle = getLogCycle(log);
        return itemCycle === selectedCycle;
      });
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((log) => {
      return (
        log.entityName?.toLowerCase().includes(term) ||
        log.entityCode?.toLowerCase().includes(term) ||
        log.deletedByName?.toLowerCase().includes(term) ||
        log.deletedByEmail?.toLowerCase().includes(term) ||
        log.deletedByRole?.toLowerCase().includes(term) ||
        log.ipAddress?.toLowerCase().includes(term) ||
        log.entityType?.toLowerCase().includes(term)
      );
    });
  }, [logs, selectedCycle, searchTerm]);

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-28">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Top-Level Navigation Back Button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-[22px] font-black text-xs uppercase tracking-widest shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all active:scale-95 flex items-center gap-2 shrink-0"
            title={locale === 'so' ? 'Dib ugu noqo boggii hore' : 'Back to previous page'}
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
            <span className="hidden sm:inline">{locale === 'so' ? 'Dib' : 'Back'}</span>
          </button>

          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-rose-500 shadow-2xl border border-slate-700 ring-4 ring-rose-500/10 shrink-0">
            <Trash2 size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
              {locale === 'so' ? 'Qashinka & Tirtirista Machadka' : 'Institute Deletions & Trash'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">
              {locale === 'so'
                ? 'Kaliya waxyaabaha laga tirtiray Machadka (Macallimiinta, Ardayda, Fasallada, Lacagaha), qofkii tirtiray iyo dib u soo celinta (Restore)'
                : 'Forensic tracking of deleted records from the institute, user snapshots & 1-click restore'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2.5 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:shadow hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all active:scale-95"
            title={locale === 'so' ? 'Cusbooneysii Diiwaanka' : 'Refresh Audit Ledger'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} strokeWidth={2.5} />
            <span>{locale === 'so' ? 'Cusbooneysii' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* BILLING CYCLE SELECTOR BAR (Cycle oo keliya waxa la tuuray + Back sidii hore) */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200/50">
            <Calendar size={26} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                {locale === 'so' ? 'Wareegga Xisaabeed ee Tirtirista' : 'Deletion Billing Cycle'}
              </span>
              {selectedCycle !== 'All' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-black uppercase border border-rose-200 dark:border-rose-900">
                  {locale === 'so' ? 'Kaliya Wareeggan' : 'Cycle Filter Active'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase">
                  {locale === 'so' ? 'Dhammaan Xilliyada' : 'All Time'}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight mt-1">
              {selectedCycle === 'All'
                ? (locale === 'so' ? 'Dhammaan Waxyaabihii La Tirtiray (All Cycles)' : 'All Deleted Records (Across All Cycles)')
                : `${selectedCycle} · ${cycleLabel(selectedCycle)}`}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Stepper buttons & Select Dropdown */}
          <div className="inline-flex items-center bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
            <button
              type="button"
              onClick={() => {
                if (selectedCycle === 'All') setSelectedCycle(currentCycle());
                else setSelectedCycle((prev) => addCycles(prev, -1));
              }}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95 shadow-none hover:shadow-sm"
              title={locale === 'so' ? 'Wareeggii hore' : 'Previous Cycle'}
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>

            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="bg-transparent px-3 py-1.5 font-black text-xs text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none"
            >
              {cycleOptions.map((c) => (
                <option key={c.key} value={c.key} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold">
                  {c.label} {c.isCurrent ? `★ (${locale === 'so' ? 'Bishan' : 'Current'})` : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (selectedCycle === 'All') setSelectedCycle(currentCycle());
                else setSelectedCycle((prev) => addCycles(prev, 1));
              }}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95 shadow-none hover:shadow-sm"
              title={locale === 'so' ? 'Wareegga xiga' : 'Next Cycle'}
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* BACK / RESET BUTTON: "Hadaan back dhaho sidii hore haku laabtaan" */}
          {selectedCycle !== 'All' && (
            <button
              type="button"
              onClick={() => setSelectedCycle('All')}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
              title={locale === 'so' ? 'Dib ugu laabo sidii hore (Dhammaan)' : 'Back to all deleted records'}
            >
              <RotateCcw size={14} strokeWidth={2.5} />
              <span>{locale === 'so' ? 'Dib u Noqo (Dhammaan)' : 'Back (All Records)'}</span>
            </button>
          )}

          {/* Quick jump to Current Cycle */}
          {selectedCycle !== currentCycle() && (
            <button
              type="button"
              onClick={() => setSelectedCycle(currentCycle())}
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800 font-black text-xs transition-all active:scale-95 shadow-sm"
              title={locale === 'so' ? 'U gudub wareegga bishan hadda jirta' : 'Jump to current cycle'}
            >
              <span>{locale === 'so' ? 'Bishan Hadda' : 'Current Cycle'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid - 4 Interactive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Deletions */}
        <div
          onClick={() => {
            setSelectedEntityType('All');
            setSelectedStatus('Deleted');
          }}
          className={`p-6 rounded-[32px] border shadow-sm flex items-center gap-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-[0.98] ${
            selectedStatus === 'Deleted' && selectedEntityType === 'All'
              ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/25'
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {locale === 'so' ? 'Wadarta La Tirtiray' : 'Total Deleted'}
              </p>
              {selectedCycle !== 'All' && (
                <span className="text-[9px] font-bold text-rose-500 font-mono">({selectedCycle})</span>
              )}
            </div>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
              {stats.totalDeleted}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {locale === 'so' ? 'Waxyaabaha qashinka ku jira' : 'Items in trash ledger'}
            </p>
          </div>
        </div>

        {/* Card 2: Deleted Teachers */}
        <div
          onClick={() => {
            setSelectedEntityType('Teacher');
            setSelectedStatus('All');
          }}
          className={`p-6 rounded-[32px] border shadow-sm flex items-center gap-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-[0.98] ${
            selectedEntityType === 'Teacher'
              ? 'bg-purple-50/50 dark:bg-purple-950/30 border-purple-500 ring-2 ring-purple-500/25'
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <GraduationCap size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {locale === 'so' ? 'Macallimiinta La Tirtiray' : 'Deleted Teachers'}
              </p>
              {selectedCycle !== 'All' && (
                <span className="text-[9px] font-bold text-purple-500 font-mono">({selectedCycle})</span>
              )}
            </div>
            <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
              {stats.teachersDeleted}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {locale === 'so' ? 'Macallimiin la tirtiray' : 'Teachers recorded'}
            </p>
          </div>
        </div>

        {/* Card 3: Deleted Students */}
        <div
          onClick={() => {
            setSelectedEntityType('Student');
            setSelectedStatus('All');
          }}
          className={`p-6 rounded-[32px] border shadow-sm flex items-center gap-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-[0.98] ${
            selectedEntityType === 'Student'
              ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-500 ring-2 ring-blue-500/25'
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {locale === 'so' ? 'Ardayda La Tirtiray' : 'Deleted Students'}
              </p>
              {selectedCycle !== 'All' && (
                <span className="text-[9px] font-bold text-blue-500 font-mono">({selectedCycle})</span>
              )}
            </div>
            <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
              {stats.studentsDeleted}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {locale === 'so' ? 'Arday la tirtiray' : 'Students recorded'}
            </p>
          </div>
        </div>

        {/* Card 4: Restored Records */}
        <div
          onClick={() => {
            setSelectedEntityType('All');
            setSelectedStatus('Restored');
          }}
          className={`p-6 rounded-[32px] border shadow-sm flex items-center gap-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-[0.98] ${
            selectedStatus === 'Restored'
              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/25'
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <RotateCcw size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {locale === 'so' ? 'La Soo Celiyey' : 'Restored'}
              </p>
              {selectedCycle !== 'All' && (
                <span className="text-[9px] font-bold text-emerald-500 font-mono">({selectedCycle})</span>
              )}
            </div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {stats.totalRestored}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {locale === 'so' ? 'Xog dib loogu soo celiyey' : 'Recovered records'}
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filter Matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-[36px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                locale === 'so'
                  ? 'Ku raadi magaca, tixraaca, qofka tirtiray, ama cinwaanka IP...'
                  : 'Search by item name, reference, deleter name, email or IP...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 placeholder-slate-400 shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Entity Type Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400 px-2">
                {locale === 'so' ? 'Nooca' : 'Type'}:
              </span>
              {['All', 'Teacher', 'Student', 'CashbookEntry', 'Payment', 'Class'].map((ent) => {
                const label =
                  ent === 'All'
                    ? (locale === 'so' ? 'Dhammaan' : 'All')
                    : ent === 'Teacher'
                    ? (locale === 'so' ? 'Macallin' : 'Teacher')
                    : ent === 'Student'
                    ? (locale === 'so' ? 'Arday' : 'Student')
                    : ent === 'CashbookEntry'
                    ? 'Cashbook'
                    : ent === 'Payment'
                    ? (locale === 'so' ? 'Lacag' : 'Payment')
                    : (locale === 'so' ? 'Fasal' : 'Class');
                return (
                  <button
                    key={ent}
                    type="button"
                    onClick={() => setSelectedEntityType(ent)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      selectedEntityType === ent
                        ? 'bg-slate-900 text-white dark:bg-brand-500 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400 px-2">
                {locale === 'so' ? 'Xaaladda' : 'Status'}:
              </span>
              {[
                { key: 'All', label: locale === 'so' ? 'Dhammaan' : 'All' },
                { key: 'Deleted', label: locale === 'so' ? 'La Tirtiray' : 'Deleted' },
                { key: 'Restored', label: locale === 'so' ? 'La Soo Celiyey' : 'Restored' }
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSelectedStatus(st.key)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    selectedStatus === st.key
                      ? 'bg-slate-900 text-white dark:bg-brand-500 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {(selectedEntityType !== 'All' || selectedStatus !== 'All' || selectedCycle !== 'All' || searchTerm.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedEntityType('All');
                  setSelectedStatus('All');
                  setSelectedCycle('All');
                  setSearchTerm('');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors"
              >
                {locale === 'so' ? 'Dib u deji' : 'Reset All'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Audit Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 w-12 text-center">#</th>
                <th className="px-6 py-4">{locale === 'so' ? 'Taariikhda & Waqtiga' : 'Date & Time'}</th>
                <th className="px-6 py-4">{locale === 'so' ? 'Wareegga (Cycle)' : 'Cycle'}</th>
                <th className="px-6 py-4">{locale === 'so' ? 'Nooca' : 'Entity Type'}</th>
                <th className="px-6 py-4">{locale === 'so' ? 'Xogta / Magaca' : 'Record Details'}</th>
                <th className="px-6 py-4">{locale === 'so' ? 'Qofka Tirtiray (User)' : 'Deleted By (User)'}</th>
                <th className="px-6 py-4">{locale === 'so' ? 'Cinwaanka IP' : 'IP / Client'}</th>
                <th className="px-6 py-4 text-center">{locale === 'so' ? 'Xaaladda' : 'Status'}</th>
                <th className="px-6 py-4 text-right">{locale === 'so' ? 'Tallaabooyinka' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-8 py-16 text-center text-slate-400 font-semibold text-sm animate-pulse">
                    {locale === 'so' ? 'Waxaa la soo rarayaa diiwaanka...' : 'Loading audit ledger...'}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-8 py-20 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Trash2 size={28} />
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {locale === 'so' ? 'Waxba Laguma Helin Diiwaanka' : 'No Audit Records Found'}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        {selectedCycle !== 'All'
                          ? (locale === 'so'
                              ? `Ma jiro wax la tirtiray oo ku jira wareegga ${selectedCycle}. Guji badhanka hoose si aad dib ugu noqoto dhammaan.`
                              : `No deleted items found in cycle ${selectedCycle}. Click below to view all cycles.`)
                          : (locale === 'so'
                              ? 'Ma jiro xog la tirtiray oo ku habboon shaandhayntan. Dhammaan waxyaabaha mustaqbalka la tirtiro halkaan ayaa lagu qori doonaa.'
                              : 'No deleted items match the selected filter. Every deletion across the system is tracked and logged here.')}
                      </p>
                      {selectedCycle !== 'All' && (
                        <button
                          type="button"
                          onClick={() => setSelectedCycle('All')}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
                        >
                          <RotateCcw size={14} />
                          <span>{locale === 'so' ? 'Dib u Noqo (Dhammaan Xilliyada)' : 'Back to All Cycles'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const badge = getEntityBadge(log.entityType);
                  const BadgeIcon = badge.icon;
                  const dt = formatDate(log.deletedAt || log.createdAt);
                  const itemCycle = getLogCycle(log);

                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                    >
                      <td className="px-6 py-4 text-center text-xs font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Date & Time */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {dt.date}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={11} /> {dt.time}
                          </p>
                        </div>
                      </td>

                      {/* Billing Cycle Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Calendar size={11} className="text-brand-500" />
                          {itemCycle || '—'}
                        </span>
                      </td>

                      {/* Entity Type Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${badge.className}`}>
                          <BadgeIcon size={12} strokeWidth={2.5} />
                          {badge.label}
                        </span>
                      </td>

                      {/* Record Details */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {log.entityName || '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {log.entityCode && (
                              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                {log.entityCode}
                              </span>
                            )}
                            {log.snapshot?.phone && (
                              <span className="text-[10px] font-bold text-slate-400">
                                Tel: {log.snapshot.phone}
                              </span>
                            )}
                            {log.snapshot?.salary !== undefined && log.snapshot?.salary !== null && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                ${Number(log.snapshot.salary).toLocaleString()}
                              </span>
                            )}
                            {log.snapshot?.amount !== undefined && log.snapshot?.amount !== null && (
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                ${Number(log.snapshot.amount).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Deleted By (User) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            <UserIcon size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-xs">
                              {log.deletedByName || 'Administrator'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {log.deletedByRole || 'Admin'}
                              </span>
                              {log.deletedByEmail && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                  {log.deletedByEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP / Signature */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-mono">
                          <Smartphone size={13} className="text-slate-400" />
                          <span>{log.ipAddress || 'Internal'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {log.status === 'Restored' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={12} strokeWidth={2.5} />
                            {locale === 'so' ? 'La Soo Celiyey' : 'Restored'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertCircle size={12} strokeWidth={2.5} />
                            {locale === 'so' ? 'La Tirtiray' : 'Deleted'}
                          </span>
                        )}
                      </td>

                      {/* Actions: View Snapshot & Restore */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingLog(log)}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                            title={locale === 'so' ? 'Arag xogta oo buuxda (Snapshot)' : 'View full snapshot info'}
                          >
                            <Eye size={15} strokeWidth={2.5} />
                          </button>

                          {log.status !== 'Restored' && (
                            <button
                              type="button"
                              onClick={() => handleRestore(log)}
                              disabled={restoringId === log._id}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 disabled:opacity-50"
                              title={locale === 'so' ? 'Dib ugu soo celi nidaamka' : 'Restore back to system'}
                            >
                              <RotateCcw size={13} strokeWidth={2.5} className={restoringId === log._id ? 'animate-spin' : ''} />
                              <span>{locale === 'so' ? 'Soo Celi' : 'Restore'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Information Modal */}
      {viewingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Database size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {locale === 'so' ? 'Xogta Buuxda ee La Tirtiray' : 'Deleted Record Snapshot'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400">
                    {viewingLog.entityType}: {viewingLog.entityName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {/* Audit Metadata Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {locale === 'so' ? 'Macluumaadka Tirtirista' : 'Audit Metadata'}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold">{locale === 'so' ? 'Qofka Tirtiray:' : 'Deleted By:'}</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {viewingLog.deletedByName} ({viewingLog.deletedByRole || 'Admin'})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">{locale === 'so' ? 'Waqtiga La Tirtiray:' : 'Deleted At:'}</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {new Date(viewingLog.deletedAt || viewingLog.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">{locale === 'so' ? 'Wareegga (Cycle):' : 'Cycle:'}</span>
                  <p className="font-mono text-brand-600 dark:text-brand-400 font-bold mt-0.5">
                    {getLogCycle(viewingLog)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">{locale === 'so' ? 'Xaaladda:' : 'Status:'}</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">{viewingLog.status}</p>
                </div>
              </div>
            </div>

            {/* Snapshot Fields */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {locale === 'so' ? 'Xogta Asalka ahayd (Original Data)' : 'Original Snapshot Payload'}
              </h4>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto max-h-72">
                <pre>{JSON.stringify(viewingLog.snapshot, null, 2)}</pre>
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
              >
                {locale === 'so' ? 'Xir' : 'Close'}
              </button>

              {viewingLog.status !== 'Restored' && (
                <button
                  type="button"
                  onClick={() => handleRestore(viewingLog)}
                  disabled={restoringId === viewingLog._id}
                  className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw size={14} className={restoringId === viewingLog._id ? 'animate-spin' : ''} />
                  <span>{locale === 'so' ? 'Dib u Soo Celi Xogtan' : 'Restore This Record'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
