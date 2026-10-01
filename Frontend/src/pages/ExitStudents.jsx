import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, Search, User as UserIcon, DollarSign, CalendarCheck, ClipboardList, Receipt, ArrowLeft, Building2, RotateCcw, Edit2, Trash2, History, X, Save } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';
import { useLanguage, dateLocale } from '../i18n/LanguageContext.jsx';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(dateLocale()) : '—';
const fmtDMY = (iso) => {
  if (!iso || typeof iso !== 'string') return iso ? new Date(iso).toLocaleDateString(dateLocale()) : '—';
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : iso;
};
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const ExitStudents = () => {
  const { showAlert, showConfirm } = useAlert();
  const { t, tv, locale } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [archive, setArchive] = useState(null);
  const [loadingArchive, setLoadingArchive] = useState(false);

  // Edit Exit Reason modal state
  const [editingStudent, setEditingStudent] = useState(null);
  const [editExitReason, setEditExitReason] = useState('');
  const [editExitDate, setEditExitDate] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/students', { params: { status: 'Exited' } });
        if (!cancelled) setStudents(data || []);
      } catch (error) {
        console.error('Failed to load exited students', error);
        showAlert({ type: 'danger', title: t('academic.exit.unableToLoad'), message: t('academic.exit.loadFailed') });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showAlert]);

  const openArchive = async (id) => {
    setSelectedId(id);
    setArchive(null);
    try {
      setLoadingArchive(true);
      const { data } = await api.get(`/students/${id}/archive`);
      setArchive(data);
    } catch (error) {
      console.error('Failed to load student archive', error);
      showAlert({ type: 'danger', title: t('academic.exit.unableToLoad'), message: t('academic.exit.historyFailed') });
      setSelectedId(null);
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleRestoreStudent = async (s) => {
    const ok = await showConfirm({
      type: 'info',
      title: locale === 'so' ? 'Dib ugu celi Nidaamka' : 'Restore Student',
      message: locale === 'so'
        ? `Ma hubtaa inaad ardayga "${s.fullName}" dib ugu celiso nidaamka (Active)? Wuxuu si toos ah ugu laabanayaa ardayda firfircoon.`
        : `Are you sure you want to restore "${s.fullName}" back to active status in the system?`,
      confirmText: locale === 'so' ? 'Haa, Dib ugu celi' : 'Yes, Restore',
      cancelText: locale === 'so' ? 'Ka noqo' : 'Cancel'
    });
    if (!ok) return;

    try {
      await api.post(`/students/${s._id}/restore`);
      setStudents(prev => prev.filter(item => item._id !== s._id));
      if (selectedId === s._id) {
        setSelectedId(null);
        setArchive(null);
      }
      showAlert({
        type: 'success',
        title: locale === 'so' ? 'Dib ayaa loogu celiyay' : 'Restored',
        message: locale === 'so'
          ? `Ardayga "${s.fullName}" si guul leh ayaa loogu soo celiyay nidaamka.`
          : `Student "${s.fullName}" has been restored to active status.`
      });
    } catch (err) {
      console.error('Failed to restore student', err);
      showAlert({
        type: 'danger',
        title: locale === 'so' ? 'Khalad' : 'Error',
        message: err.response?.data?.message || (locale === 'so' ? 'Lama soo celin karo ardayga' : 'Failed to restore student')
      });
    }
  };

  const handleDeleteStudent = async (s) => {
    const ok = await showConfirm({
      type: 'warning',
      title: locale === 'so' ? 'Tirtir Ardayga' : 'Delete Student',
      message: locale === 'so'
        ? `Ma hubtaa inaad gabi ahaanba tirtirto ardayga "${s.fullName}"? Xogtiisa dib looma heli karo.`
        : `Are you sure you want to permanently delete "${s.fullName}"? This action cannot be undone.`,
      confirmText: locale === 'so' ? 'Haa, Tirtir' : 'Yes, Delete',
      cancelText: locale === 'so' ? 'Ka noqo' : 'Cancel',
      danger: true
    });
    if (!ok) return;

    try {
      await api.delete(`/students/${s._id}`);
      setStudents(prev => prev.filter(item => item._id !== s._id));
      if (selectedId === s._id) {
        setSelectedId(null);
        setArchive(null);
      }
      showAlert({
        type: 'success',
        title: locale === 'so' ? 'Waa la tirtiray' : 'Deleted',
        message: locale === 'so'
          ? `Ardayga "${s.fullName}" si guul leh ayaa loo tirtiray.`
          : `Student "${s.fullName}" has been permanently deleted.`
      });
    } catch (err) {
      console.error('Failed to delete student', err);
      showAlert({
        type: 'danger',
        title: locale === 'so' ? 'Khalad' : 'Error',
        message: err.response?.data?.message || (locale === 'so' ? 'Lama tirtiri karo ardayga' : 'Failed to delete student')
      });
    }
  };

  const openEditModal = (s) => {
    setEditingStudent(s);
    setEditExitReason(s.exitReason || '');
    setEditExitDate(s.exitDate ? new Date(s.exitDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      setSavingEdit(true);
      await api.put(`/students/${editingStudent._id}`, {
        exitReason: editExitReason.trim(),
        exitDate: editExitDate ? new Date(editExitDate) : undefined
      });
      setStudents(prev => prev.map(item => item._id === editingStudent._id ? { ...item, exitReason: editExitReason.trim(), exitDate: editExitDate } : item));
      if (archive && (archive.student?._id === editingStudent._id || selectedId === editingStudent._id)) {
        setArchive(prev => ({
          ...prev,
          student: { ...prev.student, exitReason: editExitReason.trim(), exitDate: editExitDate },
          exit: { ...prev.exit, exitReason: editExitReason.trim(), exitDate: editExitDate }
        }));
      }
      showAlert({
        type: 'success',
        title: locale === 'so' ? 'Waa la cusboonaysiiyay' : 'Updated',
        message: locale === 'so'
          ? `Sababta bixitaanka ee "${editingStudent.fullName}" si guul leh ayaa loo keydiyay.`
          : `Exit details for "${editingStudent.fullName}" updated successfully.`
      });
      setIsEditModalOpen(false);
      setEditingStudent(null);
    } catch (err) {
      console.error('Failed to update student exit details', err);
      showAlert({
        type: 'danger',
        title: locale === 'so' ? 'Khalad' : 'Error',
        message: err.response?.data?.message || (locale === 'so' ? 'Lama cusboonaysiin karo' : 'Failed to update')
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.fullName || '').toLowerCase().includes(q) ||
      String(s.studentCode || '').toLowerCase().includes(q) ||
      (s.fatherName || '').toLowerCase().includes(q)
    );
  }, [students, search]);

  if (loading) return <div className="p-10 text-center text-slate-500">{t('academic.exit.loading')}</div>;

  // ---- Detail (archive) view ----
  const renderDetailView = () => {
    const s = archive?.student;
    const fin = archive?.financial || {};
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6 pb-24 animate-in fade-in duration-500">
        <button onClick={() => { setSelectedId(null); setArchive(null); }} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-white">
          <ArrowLeft size={16} /> {t('academic.exit.back')}
        </button>

        {loadingArchive || !archive ? (
          <div className="p-10 text-center text-slate-400">{t('academic.exit.loadingHistory')}</div>
        ) : (
          <>
            {/* Profile + exit info */}
            <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"><UserIcon size={26} /></div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">{s.fullName}</h1>
                    <p className="text-xs font-bold text-slate-400 font-mono">{t('academic.exit.id')}: {s.studentCode || s.rollNumber || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">{tv('Exited')}</span>
                  <button
                    type="button"
                    onClick={() => handleRestoreStudent(s)}
                    title={locale === 'so' ? 'Dib ugu celi Nidaamka' : 'Restore Student'}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-600 shadow-sm hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60 transition-all"
                  >
                    <RotateCcw size={14} /> <span>{locale === 'so' ? 'Back' : 'Back'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(s)}
                    title={locale === 'so' ? 'Wax ka beddel Sababta' : 'Edit Reason'}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-600 shadow-sm hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/60 transition-all"
                  >
                    <Edit2 size={14} /> <span>{locale === 'so' ? 'Edit' : 'Edit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStudent(s)}
                    title={locale === 'so' ? 'Tirtir Ardayga' : 'Delete Student'}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-rose-600 shadow-sm hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 transition-all"
                  >
                    <Trash2 size={14} /> <span>{locale === 'so' ? 'Delete' : 'Delete'}</span>
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                <Info label={t('common.class')} value={classLabel(s.classId, '—')} />
                <Info label={t('common.branch')} value={s.classId?.branchId?.name || s.branchId?.name || '—'} />
                <Info label={t('academic.exit.father')} value={s.fatherName || '—'} />
                <Info label={t('academic.exit.fatherPhone')} value={s.fatherPhone || '—'} />
                <Info label={t('academic.exit.exitDate')} value={fmtDate(archive.exit?.exitDate)} />
                <Info label={t('academic.exit.performedBy')} value={archive.exit?.exitedBy?.fullName || '—'} />
                <Info label={t('academic.exit.exitTimestamp')} value={archive.exit?.exitedAt ? new Date(archive.exit.exitedAt).toLocaleString(locale) : '—'} />
                <Info label={t('academic.exit.registered')} value={fmtDate(s.registrationDate)} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400">{t('academic.exit.reason')}</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{archive.exit?.exitReason || (locale === 'so' ? 'Lama cayimin sababta' : 'No reason specified')}</p>
              </div>
            </section>

            {/* Financials */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat icon={<DollarSign size={18} />} label={t('academic.exit.registeredFee')} value={money(fin.registeredFee)} tone="brand" />
              <Stat icon={<DollarSign size={18} />} label={t('academic.exit.totalPaid')} value={money(fin.totalPaid)} tone="emerald" />
              <Stat icon={<DollarSign size={18} />} label={t('academic.exit.remainingBalance')} value={money(fin.remaining)} tone="rose" />
            </section>

            {/* Payment history */}
            <Panel icon={<Receipt size={18} />} title={t('academic.exit.paymentHistory', { count: archive.payments?.length || 0 })}>
              {archive.payments?.length ? (
                <Table head={[t('common.date'), t('common.month'), t('common.amount'), t('common.method'), t('common.status'), t('common.wallet')]}
                  rows={archive.payments.map(p => [
                    fmtDate(p.paymentDate), p.month || '—', money(p.amount), tv(p.paymentMethod) || '—', tv(p.status) || '—', p.walletId?.name || '—'
                  ])} />
              ) : <Empty text={t('academic.exit.noPayments')} />}
            </Panel>

            {/* Attendance history */}
            <Panel icon={<CalendarCheck size={18} />} title={t('academic.exit.attendanceHistory', { count: archive.attendance?.length || 0 })}>
              {archive.attendance?.length ? (
                <Table head={[t('common.date'), t('academic.exit.session'), t('common.status'), t('academic.exit.arrival'), t('common.class')]}
                  rows={archive.attendance.map(a => [
                    fmtDMY(a.date), tv(a.session) || '—', tv(a.status) || '—', a.arrivalTime || '—', classLabel(a.classId, '—')
                  ])} />
              ) : <Empty text={t('academic.exit.noAttendance')} />}
            </Panel>

            {/* Exam history */}
            <Panel icon={<ClipboardList size={18} />} title={t('academic.exit.examHistory', { count: archive.examResults?.length || 0 })}>
              {archive.examResults?.length ? (
                <Table head={[t('academic.exit.exam'), t('academic.exit.subjects'), t('academic.exit.totalMarks'), t('academic.exit.remarks')]}
                  rows={archive.examResults.map(r => [
                    r.examId?.name || r.examId?.title || '—',
                    (r.marks || []).length,
                    (r.marks || []).reduce((sum, m) => sum + (Number(m.marksObtained) || 0), 0),
                    r.remarks || '—'
                  ])} />
              ) : <Empty text={t('academic.exit.noExams')} />}
            </Panel>

            {/* Transactions */}
            <Panel icon={<Receipt size={18} />} title={t('academic.exit.transactions', { count: archive.transactions?.length || 0 })}>
              {archive.transactions?.length ? (
                <Table head={[t('common.date'), t('common.type'), t('common.amount'), t('common.wallet'), t('common.description')]}
                  rows={archive.transactions.map(tx => [
                    fmtDate(tx.date), tv(tx.type) || '—', money(tx.amount), tx.walletId?.name || '—', tx.description || '—'
                  ])} />
              ) : <Empty text={t('academic.exit.noTransactions')} />}
            </Panel>
          </>
        )}
      </div>
    );
  };

  // ---- List view ----
  const renderListView = () => (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-24 animate-in fade-in duration-500">
      <div className="flex items-center gap-5 px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-700 bg-slate-900 text-amber-400 shadow-2xl ring-4 ring-amber-400/10 dark:bg-slate-800"><LogOut size={30} strokeWidth={2.5} /></div>
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">{t('academic.exit.title')}</h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('academic.exit.subtitle')}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('academic.exit.searchPlaceholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                <th className="px-5 py-4">{t('common.student')}</th>
                <th className="px-4 py-4">{t('common.code')}</th>
                <th className="px-4 py-4">{t('common.class')}</th>
                <th className="px-4 py-4">{t('academic.exit.exitDate')}</th>
                <th className="px-5 py-4">{t('academic.exit.reasonShort')}</th>
                <th className="px-5 py-4 text-right">{locale === 'so' ? 'Ficilada' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(s => (
                <tr key={s._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">{s.fullName}</td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-500 font-mono">{s.studentCode || s.rollNumber || '—'}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{classLabel(s.classId, '—')}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(s.exitDate)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500 max-w-xs truncate" title={s.exitReason || ''}>{s.exitReason || '—'}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openArchive(s._id)}
                        title={locale === 'so' ? 'Fiiri Taariikhda Buuxda' : 'View History / Archive'}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm hover:border-amber-400 hover:text-amber-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-amber-500 dark:hover:text-amber-400 transition-all"
                      >
                        <History size={13} />
                        <span>History</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRestoreStudent(s)}
                        title={locale === 'so' ? 'Dib ugu celi Nidaamka (Back to Active)' : 'Restore Student to System'}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 shadow-sm hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60 transition-all"
                      >
                        <RotateCcw size={13} />
                        <span>Back</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(s)}
                        title={locale === 'so' ? 'Wax ka beddel Sababta Bixitaanka' : 'Edit Exit Reason'}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 shadow-sm hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/60 transition-all"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(s)}
                        title={locale === 'so' ? 'Tirtir Ardayga' : 'Delete Student'}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 shadow-sm hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 transition-all"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                  {students.length === 0 ? t('academic.exit.noneYet') : t('academic.exit.noMatch')}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {selectedId ? renderDetailView() : renderListView()}

      {/* Edit Exit Reason Modal */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white">
                    {locale === 'so' ? 'Wax ka beddel Sababta Bixitaanka' : 'Edit Exit Reason'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400">
                    {editingStudent.fullName} ({editingStudent.studentCode || editingStudent.rollNumber || '—'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsEditModalOpen(false); setEditingStudent(null); }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {locale === 'so' ? 'Taariikhda Bixitaanka' : 'Exit Date'}
                </label>
                <input
                  type="date"
                  value={editExitDate}
                  onChange={e => setEditExitDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-amber-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 dark:focus:bg-slate-900"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {locale === 'so' ? 'Sababta Bixitaanka (Exit Reason)' : 'Exit Reason'}
                </label>
                <textarea
                  rows={4}
                  value={editExitReason}
                  onChange={e => setEditExitReason(e.target.value)}
                  placeholder={locale === 'so' ? 'Geli sababta uu ardaygu uga baxay machadka...' : 'Enter the reason why student exited...'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-amber-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 dark:focus:bg-slate-900"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingStudent(null); }}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {locale === 'so' ? 'Ka noqo' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{savingEdit ? (locale === 'so' ? 'Keydinayaa...' : 'Saving...') : (locale === 'so' ? 'Keydi' : 'Save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const Info = ({ label, value }) => (
  <div>
    <span className="text-[10px] font-black uppercase text-slate-400">{label}</span>
    <p className="font-semibold text-slate-800 dark:text-slate-200">{value}</p>
  </div>
);

const Stat = ({ icon, label, value, tone }) => {
  const tones = {
    brand: 'text-brand-600 bg-brand-50 dark:bg-brand-950/40',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
  };
  return (
    <div className="flex items-center justify-between rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
    </div>
  );
};

const Panel = ({ icon, title, children }) => (
  <section className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-sm font-black text-slate-900 dark:border-slate-800 dark:text-white">
      <span className="text-brand-500">{icon}</span> {title}
    </div>
    <div className="overflow-x-auto">{children}</div>
  </section>
);

const Table = ({ head, rows }) => (
  <table className="w-full text-left text-sm">
    <thead>
      <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800/30">
        {head.map((h, i) => <th key={i} className="px-6 py-3">{h}</th>)}
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((r, i) => (
        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
          {r.map((c, j) => <td key={j} className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300">{c}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
);

const Empty = ({ text }) => <div className="px-6 py-8 text-center text-sm font-semibold text-slate-400">{text}</div>;

export default ExitStudents;
