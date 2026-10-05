import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowRightLeft, BookOpen,
    DollarSign, Plus, ShieldCheck, UserCheck, Users, Wallet, CalendarCheck, CreditCard, Receipt,
    RefreshCw, X, ExternalLink, Sparkles, Filter, CheckCircle2, History
} from 'lucide-react';
import KPICard from './KPICard';
import api, { clearApiCache } from '../services/api';
import { currentCycle, previousCycle, cycleLabel } from '../utils/billingCycle';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { translateApiMessage } from '../i18n/core.js';

const DashboardOverview = () => {
    const navigate = useNavigate();
    const { t, tv, locale, months } = useLanguage();
    const [dashboardData, setDashboardData] = useState(() => {
        try {
            const cached = sessionStorage.getItem('cachedDashboardData');
            return cached ? JSON.parse(cached) : {
                kpis: {},
                activities: [],
                notifications: [],
                alerts: { lowStock: [], expiry: [], delayed: [] }
            };
        } catch {
            return {
                kpis: {},
                activities: [],
                notifications: [],
                alerts: { lowStock: [], expiry: [], delayed: [] }
            };
        }
    });

    const [loading, setLoading] = useState(() => {
        return !sessionStorage.getItem('cachedDashboardData');
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedCardForModal, setSelectedCardForModal] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async (fresh = false) => {
        try {
            if (fresh) {
                setIsRefreshing(true);
                clearApiCache();
                sessionStorage.removeItem('cachedDashboardData');
            }
            const { data } = await api.get('/dashboard', { skipCache: fresh });
            if (data) {
                setDashboardData(data);
                sessionStorage.setItem('cachedDashboardData', JSON.stringify(data));
                setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-100px)] flex-col items-center justify-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('dashboard.loading')}</span>
            </div>
        );
    }

    const { kpis = {}, activities = [], notifications = [] } = dashboardData;
    const today = new Date();
    const cycle = currentCycle();
    const billingCycleName = cycleLabel(cycle);
    const previousCycleName = cycleLabel(previousCycle(cycle));
    const prevCycleKey = previousCycle(cycle);
    const balance = (kpis.totalIncome || 0) - (kpis.totalExpenses || 0);
    const fmtSignedMoney = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString()}`;

    const money = (n) => `$${(n || 0).toLocaleString()}`;
    const otherIncome = Math.max(0, (kpis.totalIncome || 0) - (kpis.studentFeesCollected || 0));
    const otherExpenses = Math.max(0, (kpis.totalExpenses || 0) - (kpis.totalSalaries || 0));
    // Card texts live under dashboard.cards.<textKey>.* in the locale files.
    const cardText = (textKey, field, vars) => t(`dashboard.cards.${textKey}.${field}`, vars);

    const quickActions = [
        { key: 'addStudent', icon: Plus, path: '/academic/students' },
        { key: 'studentAttendance', icon: CalendarCheck, path: '/attendance/students' },
        { key: 'recordPayment', icon: Receipt, path: '/finance/monthly-payments' },
        { key: 'createClass', icon: BookOpen, path: '/academic/classes' },
    ].map((action) => ({
        ...action,
        title: t(`dashboard.quickActions.${action.key}.title`),
        subtitle: t(`dashboard.quickActions.${action.key}.subtitle`)
    }));

    const cardsConfig = [
        {
            id: 'total-students',
            textKey: 'totalStudents',
            category: 'academic',
            value: (kpis.totalStudents || 0).toLocaleString(),
            rawValue: kpis.totalStudents || 0,
            icon: <Users size={20} />,
            color: 'bg-emerald-500',
            badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
            path: '/academic/students',
            statValue: cardText('totalStudents', 'statValue', { count: kpis.totalClasses || 0 })
        },
        {
            id: 'total-teachers',
            textKey: 'totalTeachers',
            category: 'academic',
            value: (kpis.totalTeachers || 0).toLocaleString(),
            rawValue: kpis.totalTeachers || 0,
            icon: <UserCheck size={20} />,
            color: 'bg-violet-600',
            badgeColor: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
            path: '/academic/teachers',
            statValue: cardText('totalTeachers', 'statValue', { count: kpis.todayTeacherAttendance || 0 })
        },
        {
            id: 'total-classes',
            textKey: 'totalClasses',
            category: 'academic',
            value: (kpis.totalClasses || 0).toLocaleString(),
            rawValue: kpis.totalClasses || 0,
            icon: <BookOpen size={20} />,
            color: 'bg-blue-600',
            badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
            path: '/academic/classes',
            statValue: kpis.totalClasses ? Math.round((kpis.totalStudents || 0) / kpis.totalClasses) : 0
        },
        {
            id: 'total-guardians',
            textKey: 'totalGuardians',
            category: 'academic',
            value: (kpis.totalGuardians || 0).toLocaleString(),
            rawValue: kpis.totalGuardians || 0,
            icon: <Users size={20} />,
            color: 'bg-amber-500',
            badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
            path: '/academic/guardians',
            statValue: cardText('totalGuardians', 'statValue', { count: kpis.totalGuardians || 0 })
        },
        {
            id: 'total-fees-due',
            textKey: 'totalFeesDue',
            category: 'finance',
            value: money(kpis.expectedStudentFees),
            rawValue: kpis.expectedStudentFees || 0,
            icon: <DollarSign size={20} />,
            color: 'bg-blue-600',
            badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
            path: '/finance/monthly-payments',
            description: billingCycleName,
            explanationVars: { cycle: billingCycleName },
            statValue: `${money(kpis.studentFeesCollected)} / ${money(kpis.pendingStudentFees)}`
        },
        {
            id: 'fees-collected',
            textKey: 'feesCollected',
            category: 'finance',
            value: money(kpis.studentFeesCollected),
            rawValue: kpis.studentFeesCollected || 0,
            icon: <Receipt size={20} />,
            color: 'bg-teal-500',
            badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
            path: '/finance/monthly-payments?status=paid',
            description: billingCycleName,
            explanationVars: { cycle: billingCycleName },
            statValue: money(kpis.expectedStudentFees),
            progress: kpis.expectedStudentFees ? ((kpis.studentFeesCollected || 0) / kpis.expectedStudentFees) * 100 : undefined
        },
        {
            id: 'pending-fees',
            textKey: 'pendingFees',
            category: 'finance',
            value: money(kpis.pendingStudentFees),
            rawValue: kpis.pendingStudentFees || 0,
            icon: <CreditCard size={20} />,
            color: 'bg-purple-600',
            badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
            path: '/finance/monthly-payments?status=pending',
            description: billingCycleName,
            statValue: money(kpis.expectedStudentFees)
        },
        {
            id: 'total-income',
            textKey: 'totalIncome',
            category: 'finance',
            value: money(kpis.totalIncome),
            rawValue: kpis.totalIncome || 0,
            icon: <DollarSign size={20} />,
            color: 'bg-emerald-600',
            badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
            path: '/finance/cashbook',
            description: billingCycleName,
            explanationVars: { cycle: billingCycleName, fees: money(kpis.studentFeesCollected), other: money(otherIncome) },
            statValue: money(otherIncome)
        },
        {
            id: 'total-expenses',
            textKey: 'totalExpenses',
            category: 'finance',
            value: money(kpis.totalExpenses),
            rawValue: kpis.totalExpenses || 0,
            icon: <ArrowRightLeft size={20} />,
            color: 'bg-rose-500',
            badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
            path: '/finance/expenses',
            description: billingCycleName,
            explanationVars: { cycle: billingCycleName, salaries: money(kpis.totalSalaries), other: money(otherExpenses) },
            statValue: money(otherExpenses)
        },
        {
            id: 'balance',
            textKey: 'balance',
            category: 'finance',
            value: fmtSignedMoney(balance),
            rawValue: balance,
            icon: <Wallet size={20} />,
            color: balance < 0 ? 'bg-rose-600' : 'bg-emerald-700',
            badge: balance < 0 ? t('dashboard.cards.balance.badgeDeficit') : t('dashboard.cards.balance.badge'),
            badgeColor: balance < 0
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
            path: '/finance/cashbook',
            description: billingCycleName,
            explanationVars: { cycle: billingCycleName, income: money(kpis.totalIncome), expenses: money(kpis.totalExpenses) },
            statValue: `${money(kpis.totalIncome)} / ${money(kpis.totalExpenses)}`
        },
        {
            id: 'previous-debt',
            textKey: 'previousDebt',
            category: 'finance',
            value: money(kpis.previousDebt),
            rawValue: kpis.previousDebt || 0,
            icon: <AlertCircle size={20} />,
            color: 'bg-red-600',
            badgeColor: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
            path: `/finance/monthly-payments?month=${prevCycleKey}&view=previousDebt&status=pending`,
            description: cardText('previousDebt', 'description', { cycle: billingCycleName }),
            explanationVars: { cycle: billingCycleName },
            statValue: previousCycleName
        },
        {
            id: 'historical-cycle-debt',
            textKey: 'historicalCycleDebt',
            category: 'finance',
            value: money(kpis.historicalCycleDebt),
            rawValue: kpis.historicalCycleDebt || 0,
            icon: <History size={20} />,
            color: 'bg-amber-600',
            badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
            path: `/finance/monthly-payments?month=${kpis.historicalCycle || prevCycleKey}&view=snapshot&status=pending`,
            description: cardText('historicalCycleDebt', 'description', { cycle: kpis.historicalCycleLabel || previousCycleName }),
            explanationVars: { cycle: kpis.historicalCycleLabel || previousCycleName },
            statValue: kpis.historicalCycleLabel || previousCycleName
        },
        {
            id: 'today-student-attendance',
            textKey: 'todayStudentAttendance',
            category: 'attendance',
            value: (kpis.todayStudentAttendance || 0).toLocaleString(),
            rawValue: kpis.todayStudentAttendance || 0,
            icon: <CalendarCheck size={20} />,
            color: 'bg-brand-500',
            badgeColor: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300',
            path: '/attendance/students',
            explanationVars: { total: kpis.totalStudents || 0 },
            statValue: kpis.totalStudents ? `${Math.round(((kpis.todayStudentAttendance || 0) / kpis.totalStudents) * 100)}%` : '0%',
            progress: kpis.totalStudents ? ((kpis.todayStudentAttendance || 0) / kpis.totalStudents) * 100 : undefined
        },
        {
            id: 'today-teacher-attendance',
            textKey: 'todayTeacherAttendance',
            category: 'attendance',
            value: (kpis.todayTeacherAttendance || 0).toLocaleString(),
            rawValue: kpis.todayTeacherAttendance || 0,
            icon: <CalendarCheck size={20} />,
            color: 'bg-pink-500',
            badgeColor: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300',
            path: '/attendance/teachers',
            explanationVars: { total: kpis.totalTeachers || 0 },
            statValue: kpis.totalTeachers ? `${Math.round(((kpis.todayTeacherAttendance || 0) / kpis.totalTeachers) * 100)}%` : '0%',
            progress: kpis.totalTeachers ? ((kpis.todayTeacherAttendance || 0) / kpis.totalTeachers) * 100 : undefined
        }
    ].map((card) => ({
        ...card,
        label: cardText(card.textKey, 'label'),
        subtitle: cardText(card.textKey, 'subtitle'),
        badge: card.badge || cardText(card.textKey, 'badge'),
        description: card.description || cardText(card.textKey, 'description'),
        explanation: cardText(card.textKey, 'explanation', card.explanationVars),
        statLabel: cardText(card.textKey, 'statLabel'),
        actionText: cardText(card.textKey, 'actionText')
    }));

    const filteredCards = activeCategory === 'all'
        ? cardsConfig
        : cardsConfig.filter(c => c.category === activeCategory);

    const activityRows = activities.length > 0
        ? activities.slice(0, 6).map((item) => ({
            title: `${tv(item.module) || t('dashboard.activity.system')} - ${item.detail || tv(item.action) || t('dashboard.activity.transaction')}`,
            time: item.date ? new Date(item.date).toLocaleTimeString(locale || [], { hour: '2-digit', minute: '2-digit' }) : t('dashboard.activity.justNow'),
            color: item.action === 'Expense' ? 'bg-rose-500' : item.action === 'Income' ? 'bg-emerald-500' : 'bg-blue-500',
        }))
        : [];

    return (
        <div className="mx-auto max-w-[1800px] space-y-7 p-4 pb-12 md:p-8 animate-in fade-in duration-500">
            {/* Hero Welcome Banner */}
            <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-700 p-7 text-white shadow-2xl shadow-brand-900/25 md:p-10 border border-white/15">
                <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
                
                <div className="relative z-10 grid gap-8 xl:grid-cols-[1.2fr_0.8fr] items-center">
                    <div>
                        <div className="mb-5 inline-flex items-center gap-2.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur-md">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                            </span>
                            <ShieldCheck size={15} /> {t('dashboard.hero.systemActive')}
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl text-white">
                            {t('dashboard.hero.welcome')}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm font-medium text-white/85 md:text-base leading-relaxed">
                            {t('dashboard.hero.intro')}
                        </p>
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{t('dashboard.hero.today')}</p>
                                <p className="text-sm font-extrabold text-white mt-0.5">{locale ? `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}` : today.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                            <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{t('dashboard.hero.financialCycle')}</p>
                                <p className="text-sm font-extrabold text-white mt-0.5">{billingCycleName}</p>
                            </div>
                            <button
                                onClick={() => fetchDashboardData(true)}
                                disabled={isRefreshing}
                                className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
                                title={t('dashboard.hero.refreshTitle')}
                            >
                                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                                <span>{isRefreshing ? t('dashboard.hero.refreshing') : t('dashboard.hero.refresh')}</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {quickActions.map((action) => (
                            <button
                                key={action.title}
                                onClick={() => navigate(action.path)}
                                className="group rounded-3xl bg-white/12 p-4 text-left ring-1 ring-white/20 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/20 hover:shadow-xl active:translate-y-0"
                            >
                                <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-lg shadow-black/10 group-hover:scale-110 group-hover:shadow-brand-900/20 transition-all duration-300">
                                    {React.createElement(action.icon, { size: 20 })}
                                </div>
                                <p className="font-extrabold text-white tracking-tight">{action.title}</p>
                                <p className="text-xs font-medium text-white/75 mt-0.5">{action.subtitle}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* KPI Cards Section with Category Filters */}
            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-2xl">
                                {t('dashboard.cardsTitle')}
                            </h2>
                            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-black text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                                {t('dashboard.cardsCount', { count: filteredCards.length })}
                            </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {t('dashboard.cardsHint')}
                        </p>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-slate-100/90 p-1.5 dark:bg-slate-800/90">
                        {[
                            { id: 'all', label: t('dashboard.filters.all'), count: cardsConfig.length },
                            { id: 'academic', label: t('dashboard.filters.academic'), count: cardsConfig.filter(c => c.category === 'academic').length },
                            { id: 'finance', label: t('dashboard.filters.finance'), count: cardsConfig.filter(c => c.category === 'finance').length },
                            { id: 'attendance', label: t('dashboard.filters.attendance'), count: cardsConfig.filter(c => c.category === 'attendance').length },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveCategory(tab.id)}
                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                    activeCategory === tab.id
                                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeCategory === tab.id ? 'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200' : 'opacity-70'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid of Interactive Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {filteredCards.map((card) => (
                        <KPICard
                            key={card.id}
                            label={card.label}
                            value={card.value}
                            icon={card.icon}
                            color={card.color}
                            badge={card.badge}
                            badgeColor={card.badgeColor}
                            description={card.description}
                            progress={card.progress}
                            onClick={() => navigate(card.path)}
                            onPreview={() => setSelectedCardForModal(card)}
                        />
                    ))}
                </div>
            </section>

            {/* Recent Financial Activities & Notifications */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-[30px] bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white">{t('dashboard.recentTransactions')}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.financialActivity')}</p>
                        </div>
                        <button
                            onClick={() => navigate('/finance/cashbook')}
                            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                        >
                            <span>{t('dashboard.viewAll')}</span>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {activityRows.length > 0 ? (
                            activityRows.map((act, index) => (
                                <div key={index} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${act.color}`} />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{act.title}</p>
                                            <p className="text-xs text-slate-400">{act.time}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-sm font-medium text-slate-400">{t('dashboard.noTransactions')}</div>
                        )}
                    </div>
                </div>

                <div className="rounded-[30px] bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white">{t('dashboard.systemNotifications')}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.alertsReminders')}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {notifications.length > 0 ? (
                            notifications.slice(0, 5).map((note) => (
                                <div key={note._id || note.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{translateApiMessage(note.title)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{translateApiMessage(note.message)}</p>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-sm font-medium text-slate-400">{t('dashboard.noNotifications')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Detail Modal for Selected Card */}
            {selectedCardForModal && (
                <div 
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setSelectedCardForModal(null)}
                >
                    <div
                        className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-8 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedCardForModal(null)}
                            className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X size={18} />
                        </button>

                        {/* Modal Header */}
                        <div className="flex items-center gap-4 mb-5">
                            <div className={`p-4 rounded-2xl ${selectedCardForModal.color} text-white shadow-lg`}>
                                {selectedCardForModal.icon}
                            </div>
                            <div>
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${selectedCardForModal.badgeColor}`}>
                                    {selectedCardForModal.badge}
                                </span>
                                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                                    {selectedCardForModal.label}
                                </h3>
                                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                                    {selectedCardForModal.subtitle}
                                </p>
                            </div>
                        </div>

                        {/* Metric Value Card */}
                        <div className="mb-6 rounded-3xl bg-slate-50 p-5 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                                {t('dashboard.modal.liveValue')}
                            </p>
                            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                                {selectedCardForModal.value}
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                {selectedCardForModal.description}
                            </p>
                        </div>

                        {/* Explanation Content */}
                        <div className="space-y-4 mb-6">
                            <div>
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                                    {t('dashboard.modal.explanation')}
                                </h4>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed bg-brand-50/50 dark:bg-brand-950/20 p-4 rounded-2xl border border-brand-100/60 dark:border-brand-900/30">
                                    {selectedCardForModal.explanation}
                                </p>
                            </div>

                            {/* Sub Statistic */}
                            {selectedCardForModal.statLabel && (
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                        {selectedCardForModal.statLabel}
                                    </span>
                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                        {selectedCardForModal.statValue}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedCardForModal(null)}
                                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                            >
                                {t('dashboard.modal.close')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const path = selectedCardForModal.path;
                                    setSelectedCardForModal(null);
                                    navigate(path);
                                }}
                                className="flex-[1.5] flex items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 active:scale-95 transition-all"
                            >
                                <span>{selectedCardForModal.actionText || t('dashboard.modal.goToPage')}</span>
                                <ExternalLink size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardOverview;
