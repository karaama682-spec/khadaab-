import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Edit2, Trash2, ClipboardList, PenSquare, Award,
  Calendar, Send, Loader2, Search, Building2, Layers, Check,
  AlertCircle, CheckCircle2
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const EXAM_TYPES = [
  { value: 'Mid-Term', labelKey: 'nisfi', fallback: 'Mid-Term (Nisfi)' },
  { value: 'Final', labelKey: 'nihaayi', fallback: 'Final (Nihaayi)' },
  { value: 'Monthly', labelKey: 'Monthly', fallback: 'Monthly (Bille)' },
  { value: 'Weekly', labelKey: 'Weekly', fallback: 'Weekly (Toddobaadle)' },
  { value: 'Quiz', labelKey: 'Quiz', fallback: 'Quiz (Kedis)' },
  { value: 'Combined', labelKey: 'Combined', fallback: 'Combined (Isku-dhafan)' }
];

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const emptyForm = () => ({
  title: '',
  examType: 'Mid-Term',
  classId: '',
  term: 'Term 1',
  academicYear: String(new Date().getFullYear()),
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  maxMarks: 40,
  description: ''
});

const statusStyle = {
  Scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Ongoing: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  Completed: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
};

const ExamsManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const { t, tv, locale } = useLanguage();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resExams, resClasses, resBranches] = await Promise.all([
        api.get('/exams'),
        api.get('/classes'),
        api.get('/branches').catch(() => ({ data: [] }))
      ]);
      const classesData = resClasses.data || [];
      let branchesData = resBranches?.data || [];

      // Fallback: derive unique branches from classes if branches endpoint was empty
      if (!branchesData.length) {
        const branchMap = new Map();
        classesData.forEach(c => {
          if (c.branchId && typeof c.branchId === 'object' && c.branchId._id) {
            branchMap.set(String(c.branchId._id), c.branchId);
          }
        });
        branchesData = Array.from(branchMap.values());
      }

      setExams(resExams.data || []);
      setClasses(classesData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Failed to load exams', error);
      showAlert({ type: 'danger', title: t('common.error'), message: t('exams.loadFailed') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setEditing(null);
    const allBIds = branches.map(b => String(b._id));
    setSelectedBranchIds(allBIds);
    setSelectedClassIds([]);
    setForm({
      title: '',
      examType: 'Mid-Term',
      classId: '',
      term: 'Term 1',
      academicYear: String(new Date().getFullYear()),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      maxMarks: 40,
      description: ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (exam) => {
    setEditing(exam);
    const cId = exam.classId?._id || exam.classId || '';
    const classObj = classes.find(c => String(c._id) === String(cId));
    const bId = classObj?.branchId?._id || classObj?.branchId;
    setSelectedBranchIds(bId ? [String(bId)] : []);
    setSelectedClassIds([cId]);
    setForm({
      title: exam.title || '',
      examType: exam.examType || 'Mid-Term',
      classId: cId,
      term: exam.term || 'Term 1',
      academicYear: exam.academicYear || String(new Date().getFullYear()),
      startDate: exam.startDate ? new Date(exam.startDate).toISOString().slice(0, 10) : (exam.examDate ? new Date(exam.examDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
      endDate: exam.endDate ? new Date(exam.endDate).toISOString().slice(0, 10) : (exam.examDate ? new Date(exam.examDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
      maxMarks: exam.maxMarks || (exam.examType === 'Mid-Term' ? 40 : exam.examType === 'Final' ? 60 : 100),
      description: exam.description || ''
    });
    setIsModalOpen(true);
  };

  const toggleBranch = (bId) => {
    setSelectedBranchIds(prev => {
      const exists = prev.includes(bId);
      return exists ? prev.filter(id => id !== bId) : [...prev, bId];
    });
  };

  const isAllBranchesSelected = branches.length > 0 && branches.every(b => selectedBranchIds.includes(String(b._id)));

  const toggleAllBranches = () => {
    if (isAllBranchesSelected) {
      setSelectedBranchIds([]);
    } else {
      setSelectedBranchIds(branches.map(b => String(b._id)));
    }
  };

  const availableClasses = useMemo(() => {
    if (!selectedBranchIds.length) return [];
    return classes.filter(c => {
      const bId = String(c.branchId?._id || c.branchId || '');
      return selectedBranchIds.includes(bId);
    });
  }, [classes, selectedBranchIds]);

  const toggleClassSelect = (classId) => {
    setSelectedClassIds(prev => {
      return prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId];
    });
  };

  const selectAllAvailableClasses = () => {
    const allAvailableIds = availableClasses.map(c => String(c._id));
    setSelectedClassIds(Array.from(new Set([...selectedClassIds, ...allAvailableIds])));
  };

  const deselectAllAvailableClasses = () => {
    const availableSet = new Set(availableClasses.map(c => String(c._id)));
    setSelectedClassIds(prev => prev.filter(id => !availableSet.has(id)));
  };

  const isDateOrderInvalid = Boolean(form.startDate && form.endDate && form.endDate < form.startDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      return showAlert({ type: 'warning', title: t('exams.manage.validation'), message: t('exams.manage.titleRequired') });
    }

    if (!editing && selectedClassIds.length === 0) {
      return showAlert({
        type: 'warning',
        title: t('exams.manage.validation'),
        message: t('exams.manage.classSelectRequired') || 'Fadlan xulo ugu yaraan hal fasal.'
      });
    }

    if (editing && !form.classId) {
      return showAlert({ type: 'warning', title: t('exams.manage.validation'), message: t('exams.manage.classRequired') });
    }

    const maxMarksNum = Number(form.maxMarks);
    if (!maxMarksNum || isNaN(maxMarksNum) || maxMarksNum <= 0) {
      return showAlert({
        type: 'warning',
        title: t('exams.manage.validation'),
        message: t('exams.manage.maxMarksRequired') || 'Dhibcaha ugu sarreeya waa inay ka weynaadaan 0.'
      });
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return showAlert({
        type: 'warning',
        title: t('exams.manage.validation'),
        message: t('exams.manage.dateOrderError') || 'Taariikhda dhammaadka waa inaysan ka horreyn taariikhda bilowga.'
      });
    }

    const payload = editing ? {
      title: form.title.trim(),
      examType: form.examType,
      classId: form.classId,
      term: form.term,
      academicYear: form.academicYear,
      startDate: form.startDate,
      endDate: form.endDate,
      maxMarks: maxMarksNum,
      description: form.description
    } : {
      title: form.title.trim(),
      examType: form.examType,
      classIds: selectedClassIds,
      term: form.term,
      academicYear: form.academicYear,
      startDate: form.startDate,
      endDate: form.endDate,
      maxMarks: maxMarksNum,
      description: form.description
    };

    try {
      setSaving(true);
      if (editing) {
        await api.put(`/exams/${editing._id}`, payload);
        showAlert({ type: 'success', title: t('exams.manage.updatedTitle'), message: t('exams.manage.updated') });
      } else {
        await api.post('/exams', payload);
        showAlert({ type: 'success', title: t('exams.manage.createdTitle'), message: t('exams.manage.created') });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: error.response?.data?.message || t('exams.manage.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exam) => {
    const ok = await showConfirm({
      type: 'warning', title: t('exams.manage.deleteTitle'),
      message: t('exams.manage.deleteConfirm', { title: exam.title }),
      confirmText: t('common.yesDelete'), cancelText: t('common.cancel'), danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/exams/${exam._id}`);
      setExams(prev => prev.filter(e => e._id !== exam._id));
      showAlert({ type: 'success', title: t('common.deleted'), message: t('exams.manage.removed') });
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: t('exams.manage.deleteFailed') });
    }
  };

  const togglePublish = async (exam) => {
    const publish = exam.status !== 'Published';
    try {
      const { data } = await api.patch(`/exams/${exam._id}/publish`, { status: publish ? 'Published' : 'Completed' });
      setExams(prev => prev.map(e => e._id === exam._id ? { ...e, status: data.status } : e));
      showAlert({
        type: 'success',
        title: publish ? t('exams.manage.publishedTitle') : t('exams.manage.unpublishedTitle'),
        message: publish ? t('exams.manage.published') : t('exams.manage.unpublished')
      });
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: t('exams.manage.statusFailed') });
    }
  };

  const go = (path) => { window.location.hash = path; };

  const filtered = exams.filter(e => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const cls = classLabel(e.classId, '');
    return e.title.toLowerCase().includes(q) || e.examType.toLowerCase().includes(q) || cls.toLowerCase().includes(q);
  });

  if (loading) return <div className="p-10 text-center text-slate-500 font-bold">{t('exams.manage.loading')}</div>;

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('exams.manage.title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">{t('exams.manage.subtitle')}</p>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-brand-600/30 active:scale-95">
          <Plus size={18} /> {t('exams.manage.newExam')}
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md">
        <Search size={18} className="text-slate-400 mr-3" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('exams.manage.searchPlaceholder')} className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">{t('exams.manage.colExam')}</th>
                <th className="px-6 py-4">{t('common.class')}</th>
                <th className="px-6 py-4">{t('common.date')}</th>
                <th className="px-6 py-4">{t('exams.manage.colSubjects')}</th>
                <th className="px-6 py-4 text-center">{t('exams.manage.colMarksEntered')}</th>
                <th className="px-6 py-4">{t('common.status')}</th>
                <th className="px-6 py-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(exam => {
                const dateDisplay = (exam.startDate && exam.endDate)
                  ? `${new Date(exam.startDate).toLocaleDateString(locale)} – ${new Date(exam.endDate).toLocaleDateString(locale)}`
                  : new Date(exam.examDate).toLocaleDateString(locale);

                return (
                  <tr key={exam._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{exam.title}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
                          {tv(exam.examType)} · {exam.term} · {exam.academicYear}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                          Max: {exam.maxMarks || 100}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {classLabel(exam.classId, '—')}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {dateDisplay}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{exam.subjects?.length || 0}</span> · {exam.subjects?.map(s => s.name).join(', ')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 text-xs font-black rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {exam.resultsCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${statusStyle[exam.status] || statusStyle.Scheduled}`}>
                        {tv(exam.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end items-center gap-1.5">
                        <button onClick={() => go(`/exams/schedule?exam=${exam._id}`)} title={t('nav.examSchedule') || 'Exam Timetable'} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-sky-600 transition-all"><Calendar size={16} /></button>
                        <button onClick={() => go(`/exams/marks?exam=${exam._id}`)} title={t('exams.manage.enterMarks')} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-all"><PenSquare size={16} /></button>
                        <button onClick={() => go(`/exams/results?exam=${exam._id}`)} title={t('exams.manage.viewResults')} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-all"><Award size={16} /></button>
                        <button onClick={() => togglePublish(exam)} title={exam.status === 'Published' ? t('exams.manage.unpublish') : t('exams.manage.publish')} className={`p-2.5 rounded-xl transition-all ${exam.status === 'Published' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600'}`}><Send size={16} /></button>
                        <button onClick={() => openEdit(exam)} title={t('common.edit')} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(exam)} title={t('common.delete')} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan="7" className="px-8 py-12 text-center text-slate-400 text-sm font-medium">{t('exams.manage.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      {editing ? t('exams.manage.editTitle') : t('exams.manage.newExam')}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      {editing ? 'Wax ka beddel macluumaadka imtixaanka' : 'Samee imtixaan cusub oo ku dar fasallada'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                  <X size={22} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* 1. Exam Name & Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {t('exams.manage.titleLabel') || 'Magaca Imtixaanka *'}
                    </label>
                    <input
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder={t('exams.manage.titlePlaceholder') || 'tusaale: Imtixaanka Bartamaha (Nisfi) ee Term 1'}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white focus:border-brand-600 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {t('exams.manage.typeLabel') || 'Nooca Imtixaanka'}
                    </label>
                    <select
                      value={form.examType}
                      onChange={e => {
                        const nextType = e.target.value;
                        setForm(prev => ({
                          ...prev,
                          examType: nextType,
                          maxMarks: nextType === 'Mid-Term' ? 40 : nextType === 'Final' ? 60 : prev.maxMarks
                        }));
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold"
                    >
                      {EXAM_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {t(`exams.${type.labelKey}`, { defaultValue: type.fallback })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {t('exams.manage.term') || 'Termiga'}
                    </label>
                    <select
                      value={form.term}
                      onChange={e => setForm({ ...form, term: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold"
                    >
                      {TERMS.map(tOption => (
                        <option key={tOption} value={tOption}>{tOption}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {t('academic.promotion.colYear') || 'Sanad Dugsiyeedka'}
                    </label>
                    <input
                      value={form.academicYear}
                      onChange={e => setForm({ ...form, academicYear: e.target.value })}
                      placeholder="2026-2027"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Maximum Marks */}
                  <div>
                    <label className="block text-xs font-black uppercase text-brand-600 dark:text-brand-400 mb-1 flex items-center justify-between">
                      <span>{t('exams.manage.maxMarks') || 'Dhibcaha Ugu Sarreeya (Max Marks) *'}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.maxMarks}
                      onChange={e => setForm({ ...form, maxMarks: e.target.value })}
                      placeholder={t('exams.manage.maxMarksPlaceholder') || 'tusaale: 40, 50, 60, 100'}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-brand-200 dark:border-brand-800 outline-none text-slate-900 dark:text-white font-black text-base"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Geli dhibcaha buuxa ee loo qoondeeyey imtixaankan (waxay noqon kartaa 40, 45, 50, 55, 60, 100).
                    </p>
                  </div>

                  {/* Dates: Start Date & End Date */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      {t('exams.manage.startDate') || 'Taariikhda Bilowga'}
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={e => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      {t('exams.manage.endDate') || 'Taariikhda Dhammaadka'}
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={e => setForm({ ...form, endDate: e.target.value })}
                      className={`w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border outline-none text-slate-900 dark:text-white ${
                        isDateOrderInvalid ? 'border-rose-500 focus:border-rose-600' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      required
                    />
                    {isDateOrderInvalid && (
                      <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {t('exams.manage.dateOrderError') || 'Taariikhda dhammaadka waa inaysan ka horreyn taariikhda bilowga.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Branch Selection (in create mode) */}
                {!editing && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                        <Building2 size={14} className="text-brand-600" />
                        {t('exams.manage.branchesLabel') || 'Xulo Laamaha (Branch Selection)'}
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllBranches}
                        className={`text-xs font-bold px-3 py-1 rounded-xl transition-all ${
                          isAllBranchesSelected
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {t('exams.manage.allBranches') || 'Dhammaan Laamaha'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {branches.map(b => {
                        const isSelected = selectedBranchIds.includes(String(b._id));
                        return (
                          <button
                            key={b._id}
                            type="button"
                            onClick={() => toggleBranch(String(b._id))}
                            className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 font-bold shadow-sm'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <span className="text-xs truncate">{b.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Class Selection (Multi-select) */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
                  {editing ? (
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                        {t('exams.manage.classLabel') || 'Fasalka *'}
                      </label>
                      <select
                        value={form.classId}
                        onChange={e => setForm({ ...form, classId: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                        required
                      >
                        <option value="">{t('common.selectClass')}</option>
                        {classes.map(c => (
                          <option key={c._id} value={c._id}>{classLabel(c)}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                            <Layers size={14} className="text-brand-600" />
                            {t('exams.manage.classesLabel') || 'Xulo Fasallada (Class Selection) *'}
                          </label>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                            {t('exams.manage.classesSelected', { count: selectedClassIds.length }) || `${selectedClassIds.length} fasal la xushay`}
                          </span>
                        </div>
                        {availableClasses.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={selectAllAvailableClasses}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                            >
                              {t('exams.manage.selectAll') || 'Xulo Dhammaan'}
                            </button>
                            <button
                              type="button"
                              onClick={deselectAllAvailableClasses}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                            >
                              {t('exams.manage.deselectAll') || 'Kala Saar'}
                            </button>
                          </div>
                        )}
                      </div>

                      {availableClasses.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs text-center font-medium">
                          Fadlan xulo ugu yaraan hal laan si aad u aragto fasallada (Please select a branch to view classes).
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-2xl">
                          {availableClasses.map(c => {
                            const isSelected = selectedClassIds.includes(String(c._id));
                            const bName = c.branchId?.name || branches.find(b => String(b._id) === String(c.branchId?._id || c.branchId))?.name || '';
                            return (
                              <button
                                key={c._id}
                                type="button"
                                onClick={() => toggleClassSelect(String(c._id))}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                                  isSelected
                                    ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/50 text-brand-900 dark:text-brand-200 font-bold shadow-sm'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                }`}
                              >
                                <div className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border shrink-0 transition-all ${
                                  isSelected
                                    ? 'bg-brand-600 border-brand-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                }`}>
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{classLabel(c)}</p>
                                  {bName && (
                                    <span className="inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full">
                                      {bName}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Information banner about automated subject linking */}
                <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 flex items-start gap-3 text-xs text-sky-800 dark:text-sky-300">
                  <CheckCircle2 size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Isku xirka Maaddooyinka ee Tooska ah</p>
                    <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80 mt-0.5">
                      Maaddooyinka fasal kasta waxaa si toos ah looga soo qaadayaa maaddooyinka u diiwaangashan fasalka, iyadoo loo qoondeynayo dhibcaha ugu sarreeya ee aad kor ku qortay ({form.maxMarks || 40} dhibcood).
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('common.description')}</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white resize-none"
                    placeholder="Faahfaahin dheeraad ah oo ku saabsan imtixaanka..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase">
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || isDateOrderInvalid}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs uppercase disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editing ? t('exams.manage.updateExam') : t('exams.manage.createExam')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamsManagement;
