import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowRightLeft, BookOpen,
    DollarSign, Download, Plus, Send, ShieldCheck, UserCheck, Users, Wallet, CalendarCheck, CreditCard, Receipt
} from 'lucide-react';
import KPICard from './KPICard';
import api from '../services/api';

const DashboardOverview = () => {
    const navigate = useNavigate();
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

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const { data } = await api.get('/dashboard');
            if (data) {
                setDashboardData(data);
                sessionStorage.setItem('cachedDashboardData', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-100px)] flex-col items-center justify-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Institute Analytics...</span>
            </div>
        );
    }

    const { kpis, activities = [], notifications = [] } = dashboardData;
    const today = new Date();

    const quickActions = [
        { title: 'Add Student', subtitle: 'Register new student', icon: Plus, path: '/academic/students' },
        { title: 'Student Attendance', subtitle: 'Mark daily attendance', icon: CalendarCheck, path: '/attendance/students' },
        { title: 'Record Payment', subtitle: 'Collect fee payment', icon: Receipt, path: '/finance/payments' },
        { title: 'Create Class', subtitle: 'Add new class', icon: BookOpen, path: '/academic/classes' },
    ];

    const activityRows = activities.length > 0
        ? activities.slice(0, 6).map((item) => ({
            title: `${item.module || 'System'} - ${item.detail || item.action || 'Transaction'}`,
            time: item.date ? new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
            color: item.action === 'Expense' ? 'bg-rose-500' : item.action === 'Income' ? 'bg-emerald-500' : 'bg-blue-500',
        }))
        : [];

    return (
        <div className="mx-auto max-w-[1800px] space-y-7 p-4 pb-12 md:p-8 animate-in fade-in duration-500">
            {/* Hero Welcome Banner */}
            <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-700 p-7 text-white shadow-2xl shadow-brand-900/25 md:p-10 border border-white/15">
                {/* Luminous ambient background lighting */}
                <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
                
                <div className="relative z-10 grid gap-8 xl:grid-cols-[1.2fr_0.8fr] items-center">
                    <div>
                        <div className="mb-5 inline-flex items-center gap-2.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur-md">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                            </span>
                            <ShieldCheck size={15} /> Nidaamka Machadka Waa Firfircoon yahay
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl text-white">
                            Ku soo dhowow, Maamul!
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm font-medium text-white/85 md:text-base leading-relaxed">
                            Halkan waxaad ka arki kartaa xogta guud ee ardayda, fasallada, iyo dhaqdhaqaaqa maaliyadeed ee machadka maanta.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Taariikhda Maanta</p>
                                <p className="text-sm font-extrabold text-white mt-0.5">{today.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                            <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Xaaladda Nidaamka</p>
                                <p className="text-sm font-extrabold text-white mt-0.5 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Fasalladu Waa Diyaar
                                </p>
                            </div>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard label="Total Students" value={kpis.totalStudents || 0} icon={<Users size={20} />} color="bg-emerald-500" />
                <KPICard label="Total Teachers" value={kpis.totalTeachers || 0} icon={<UserCheck size={20} />} color="bg-violet-600" />
                <KPICard label="Total Classes" value={kpis.totalClasses || 0} icon={<BookOpen size={20} />} color="bg-blue-600" />
                <KPICard label="Total Guardians" value={kpis.totalGuardians || 0} icon={<Users size={20} />} color="bg-amber-500" />
                <KPICard label="Monthly Income" value={`$${(kpis.monthlyIncome || 0).toLocaleString()}`} icon={<DollarSign size={20} />} color="bg-teal-500" />
                <KPICard label="Monthly Expenses" value={`$${(kpis.monthlyExpenses || 0).toLocaleString()}`} icon={<ArrowRightLeft size={20} />} color="bg-rose-500" />
                <KPICard label="Wallet Balance" value={`$${(kpis.walletBalance || 0).toLocaleString()}`} icon={<Wallet size={20} />} color="bg-emerald-600" />
                <KPICard label="Pending Student Fees" value={`$${(kpis.pendingStudentFees || 0).toLocaleString()}`} icon={<CreditCard size={20} />} color="bg-purple-600" />
                <KPICard label="Student Attendance Today" value={kpis.todayStudentAttendance || 0} icon={<CalendarCheck size={20} />} color="bg-brand-500" />
                <KPICard label="Teacher Attendance Today" value={kpis.todayTeacherAttendance || 0} icon={<CalendarCheck size={20} />} color="bg-pink-500" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-[30px] bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white">Recent Transactions</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Activity</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {activityRows.length > 0 ? (
                            activityRows.map((act, index) => (
                                <div key={index} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
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
                            <div className="py-8 text-center text-sm font-medium text-slate-400">No recent transactions.</div>
                        )}
                    </div>
                </div>

                <div className="rounded-[30px] bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white">System Notifications</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alerts & Fee Reminders</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {notifications.length > 0 ? (
                            notifications.slice(0, 5).map((note) => (
                                <div key={note._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{note.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{note.message}</p>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-sm font-medium text-slate-400">No notifications found.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
