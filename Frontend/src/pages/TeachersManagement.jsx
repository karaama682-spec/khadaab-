import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Phone,
  DollarSign,
  UserCheck,
  Edit2,
  Trash2,
  X,
  User,
  IdCard as IdCardIcon,
  Printer
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import IdCard from '../components/IdCard.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const TeachersManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const { t: tr, tv, locale } = useLanguage();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardTeacher, setCardTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [tenantInfo, setTenantInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('tenant_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || 'Salaaxu–Aldaareyn',
          subtitle: parsed.systemSubtitle || 'Institute Management'
        };
      }
    } catch (_) {}
    return { name: 'Salaaxu–Aldaareyn', subtitle: 'Institute Management' };
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/settings');
        setTenantInfo({
          name: data?.name || 'Salaaxu–Aldaareyn',
          subtitle: data?.systemSubtitle || 'Institute Management'
        });
      } catch (_) {}
    })();
  }, []);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    gender: 'Male',
    salary: '',
    masuulName: '',
    masuulNumber: ''
  });

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users?role=Teacher');
      setTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
      showAlert({
        type: 'danger',
        title: tr('common.error'),
        message: tr('academic.teachers.loadFailed')
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const stats = useMemo(() => {
    const total = teachers.length;
    const maleCount = teachers.filter(t => t.gender === 'Male').length;
    const femaleCount = teachers.filter(t => t.gender === 'Female').length;
    const totalSalary = teachers.reduce((sum, t) => sum + (Number(t.salary) || 0), 0);
    return { total, maleCount, femaleCount, totalSalary };
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const matchesSearch =
        t.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.phone?.includes(searchTerm);
      const matchesGender =
        genderFilter === 'All' || t.gender === genderFilter;
      return matchesSearch && matchesGender;
    });
  }, [teachers, searchTerm, genderFilter]);

  const filteredTotalSalary = useMemo(() => {
    return filteredTeachers.reduce((sum, t) => sum + (Number(t.salary) || 0), 0);
  }, [filteredTeachers]);

  const handlePrint = () => window.print();

  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setFormData({
      fullName: '',
      phone: '',
      gender: 'Male',
      salary: '',
      masuulName: '',
      masuulNumber: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      fullName: teacher.fullName || teacher.username || '',
      phone: teacher.phone || '',
      gender: teacher.gender || 'Male',
      salary: teacher.salary ? String(teacher.salary) : '',
      masuulName: teacher.masuulName || '',
      masuulNumber: teacher.masuulNumber || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      showAlert({
        type: 'warning',
        title: tr('common.validationError'),
        message: tr('academic.teachers.nameRequired')
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        fullName: formData.fullName.trim(),
        username: formData.fullName.trim(),
        phone: formData.phone.trim(),
        gender: formData.gender,
        role: 'Teacher',
        salary: Number(formData.salary) || 0,
        masuulName: formData.masuulName.trim(),
        masuulNumber: formData.masuulNumber.trim()
      };

      if (editingTeacher) {
        await api.put(`/users/${editingTeacher._id}`, payload);
        showAlert({
          type: 'success',
          title: tr('academic.teachers.updatedTitle'),
          message: tr('academic.teachers.updated')
        });
      } else {
        await api.post('/users', payload);
        showAlert({
          type: 'success',
          title: tr('academic.teachers.registeredTitle'),
          message: tr('academic.teachers.registered')
        });
      }

      setIsModalOpen(false);
      fetchTeachers();
    } catch (error) {
      console.error('Failed to save teacher:', error);
      showAlert({
        type: 'danger',
        title: tr('common.error'),
        message: error.response?.data?.message || tr('academic.teachers.saveFailed')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (teacher) => {
    const ok = await showConfirm({
      type: 'warning',
      title: tr('academic.teachers.deleteTitle'),
      message: tr('academic.teachers.deleteConfirm', { name: teacher.fullName }),
      confirmText: tr('academic.teachers.yesDelete'),
      cancelText: tr('common.cancel'),
      danger: true
    });

    if (!ok) return;

    try {
      await api.delete(`/users/${teacher._id}`);
      showAlert({
        type: 'success',
        title: tr('common.deleted'),
        message: tr('academic.teachers.deletedMsg')
      });
      fetchTeachers();
    } catch (error) {
      console.error('Failed to delete teacher:', error);
      showAlert({
        type: 'danger',
        title: tr('common.error'),
        message: error.response?.data?.message || tr('academic.teachers.deleteFailed')
      });
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500 font-medium animate-pulse">
        {tr('academic.teachers.loading')}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-24 print:p-0 print:m-0 print:space-y-0 print:max-w-none print:pb-0">
      {/* Print CSS Styles - Pure White A4 Paper, Sharp Contrast */}
      <style>{`
        @media print {
          @page {
            margin: 6mm 6mm 6mm 6mm !important;
            size: A4 portrait;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body, html, #root {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 8.5pt !important;
            font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif !important;
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
            background: #ffffff !important;
          }
          .print-header-banner {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 2px 0 8px 0 !important;
            margin-bottom: 8px !important;
            border-bottom: 2px solid #000000 !important;
          }
          .print-header-banner h1,
          .print-header-banner h2,
          .print-header-banner p,
          .print-header-banner span,
          .print-header-banner div {
            color: #000000 !important;
          }
          .print-compact-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 0 !important;
            background-color: #ffffff !important;
          }
          .print-compact-table th {
            padding: 5px 8px !important;
            font-size: 8pt !important;
            background-color: #f8fafc !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
            text-transform: uppercase !important;
          }
          .print-compact-table th * {
            color: #000000 !important;
          }
          .print-compact-table td {
            padding: 5px 8px !important;
            font-size: 8.5pt !important;
            line-height: 1.2 !important;
            border: 0.5px solid #cbd5e1 !important;
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          .print-compact-table td * {
            color: #000000 !important;
          }
          .print-compact-table tr {
            page-break-inside: avoid !important;
            background-color: #ffffff !important;
          }
          .print-summary-row {
            background-color: #f8fafc !important;
            color: #000000 !important;
            font-weight: 900 !important;
          }
          .print-summary-row td {
            color: #000000 !important;
            background-color: #f8fafc !important;
            border-top: 2px solid #000000 !important;
            border-bottom: 2px solid #000000 !important;
            border-left: 0.5px solid #000000 !important;
            border-right: 0.5px solid #000000 !important;
            font-weight: 900 !important;
            font-size: 9pt !important;
          }
          .print-summary-row td * {
            color: #000000 !important;
            font-weight: 900 !important;
          }
        }
      `}</style>

      {/* Printable Header Banner */}
      <div className="hidden print:block print-header-banner">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[11pt] font-black uppercase tracking-tight text-black leading-tight">
              {tenantInfo.name} - {tenantInfo.subtitle && tenantInfo.subtitle !== 'Institute Management' ? tenantInfo.subtitle : tr('nav.instituteManagement')}
            </h1>
            <h2 className="text-[9pt] font-extrabold text-black uppercase mt-0.5 leading-tight">
              {locale === 'so' ? 'LIISKA MACALLIMIINTA IYO MUSHAARAADKA' : 'TEACHERS DIRECTORY & SALARY LIST'}
            </h2>
            <p className="text-[7.5pt] text-black mt-0.5">
              {locale === 'so' ? 'Waqtiga la daabacay' : 'Printed'}: <span className="font-bold text-black">{new Date().toLocaleDateString(locale)} {new Date().toLocaleTimeString(locale || [], { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
          <div className="text-right text-[8pt] leading-tight text-black">
            <p className="font-bold text-black">
              {locale === 'so' ? 'Wadarta Mushaarka' : 'Total Payroll'}: <span className="font-black text-[9.5pt]">${filteredTotalSalary.toLocaleString()}</span>
            </p>
            <p className="text-[7.5pt] text-slate-700">
              {locale === 'so' ? 'Tirada Macallimiinta' : 'Total Teachers'}: <span className="font-bold text-black">{filteredTeachers.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2 print:hidden">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10">
            <GraduationCap size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
              {tr('academic.teachers.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">
              {tr('academic.teachers.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:shadow transition-all active:scale-95"
            title={locale === 'so' ? 'Daabaco Liiska Macallimiinta' : 'Print Teachers List'}
          >
            <Printer size={18} strokeWidth={2.5} />
            <span>{locale === 'so' ? 'Daabaco' : 'Print'}</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-3 px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:shadow-brand-500/25 transition-all active:scale-95"
          >
            <Plus size={18} strokeWidth={3} /> {tr('academic.teachers.registerNew')}
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:hidden">
        <div className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <GraduationCap size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{tr('academic.teachers.total')}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</h3>
          </div>
        </div>

        <div className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{tr('academic.teachers.payroll')}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              ${stats.totalSalary.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={tr('academic.teachers.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {['All', 'Male', 'Female'].map(s => (
            <button
              key={s}
              onClick={() => setGenderFilter(s)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                genderFilter === s
                  ? 'bg-slate-900 text-white dark:bg-brand-500 shadow-md'
                  : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              {s === 'All' ? tr('academic.teachers.allStatus') : tv(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Teachers Directory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse print-compact-table">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="hidden print:table-cell text-center w-12 font-black">#</th>
                <th className="px-8 py-5 print:p-2">{tr('academic.teachers.colName')}</th>
                <th className="px-8 py-5 print:p-2">{tr('academic.teachers.colPhone')}</th>
                <th className="px-8 py-5 print:hidden">{tr('academic.teachers.colMasuul')}</th>
                <th className="px-8 py-5 print:hidden">{tr('academic.teachers.colStatus')}</th>
                <th className="px-8 py-5 print:p-2">{tr('academic.teachers.colSalary')}</th>
                <th className="px-8 py-5 text-right print:hidden">{tr('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-semibold text-sm">
                    {tr('academic.teachers.empty')}
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t, idx) => (
                  <tr
                    key={t._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                  >
                    <td className="hidden print:table-cell text-center font-bold text-slate-800">
                      {idx + 1}
                    </td>

                    <td className="px-8 py-5 print:p-2">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 font-black text-base flex items-center justify-center border border-brand-100 dark:border-brand-900 print:hidden">
                          {t.fullName?.[0]?.toUpperCase() || 'T'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm print:text-black print:text-[8.5pt]">
                            {t.fullName || t.username}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 print:hidden">
                            {tr('academic.teachers.facultyBadge')}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-5 print:p-2">
                      {t.phone ? (
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-xs font-semibold print:text-black print:text-[8.5pt]">
                          <Phone size={13} className="text-slate-400 print:hidden" />
                          <span className="font-mono">{t.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium print:text-black print:text-[8.5pt]">—</span>
                      )}
                    </td>

                    <td className="px-8 py-5 print:hidden">
                      {t.masuulName || t.masuulNumber ? (
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <p>{t.masuulName || '—'}</p>
                          {t.masuulNumber && (
                            <p className="mt-0.5 text-slate-400">{t.masuulNumber}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium">{tr('common.notAvailable')}</span>
                      )}
                    </td>

                    <td className="px-8 py-5 print:hidden">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.gender === 'Female'
                          ? 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400'
                          : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                      }`}>
                        {tv(t.gender || 'Male')}
                      </span>
                    </td>

                    <td className="px-8 py-5 font-black text-slate-900 dark:text-white text-sm print:p-2 print:text-black print:text-[8.5pt] print:font-bold">
                      ${(Number(t.salary) || 0).toLocaleString()}
                    </td>

                    <td className="px-8 py-5 text-right print:hidden">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setCardTeacher(t)}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                          title={tr('academic.teachers.idCard')}
                        >
                          <IdCardIcon size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                          title={tr('academic.teachers.editTitle')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-400 transition-colors"
                          title={tr('academic.teachers.deleteButton')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {filteredTeachers.length > 0 && (
                <tr className="hidden print:table-row print-summary-row">
                  <td className="p-2 text-center font-black">#</td>
                  <td className="p-2 font-black uppercase text-left">{locale === 'so' ? 'WADARTA GUUD' : 'TOTAL'}</td>
                  <td className="p-2 font-bold text-center">{locale === 'so' ? `${filteredTeachers.length} Macallimiin` : `${filteredTeachers.length} Teachers`}</td>
                  <td className="p-2 font-black text-left">${filteredTotalSalary.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 max-w-lg w-full p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {editingTeacher ? tr('academic.teachers.editTitle') : tr('academic.teachers.registerNew')}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400">{tr('academic.teachers.facultyInfo')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{tr('academic.teachers.fullNameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={tr('academic.teachers.fullNamePlaceholder')}
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{tr('academic.teachers.colPhone')}</label>
                <input
                  type="text"
                  placeholder="+1 234 567 890"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{tr('academic.teachers.masuulName')}</label>
                <input
                  type="text"
                  value={formData.masuulName}
                  onChange={e => setFormData({ ...formData, masuulName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{tr('academic.teachers.masuulNumber')}</label>
                <input
                  type="tel"
                  value={formData.masuulNumber}
                  onChange={e => setFormData({ ...formData, masuulNumber: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{tr('academic.teachers.statusLabel')}</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                >
                  <option value="Male">{tv('Male')}</option>
                  <option value="Female">{tv('Female')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{tr('academic.teachers.salaryLabel')}</label>
                <input
                  type="number"
                  placeholder="2500"
                  value={formData.salary}
                  onChange={e => setFormData({ ...formData, salary: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
                >
                  {tr('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
                >
                  {submitting ? tr('common.saving') : editingTeacher ? tr('common.saveChanges') : tr('academic.teachers.register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IdCard
        open={Boolean(cardTeacher)}
        onClose={() => setCardTeacher(null)}
        kind="teacher"
        name={cardTeacher?.fullName}
        idNumber={cardTeacher?.teacherCode}
        rows={[
          { label: tr('academic.idCard.role'), value: tv(cardTeacher?.role) || '' },
          { label: tr('common.phone'), value: cardTeacher?.phone || '' },
          { label: tr('common.email'), value: cardTeacher?.email || '' }
        ]}
      />
    </div>
  );
};

export default TeachersManagement;
