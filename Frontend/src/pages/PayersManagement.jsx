import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Phone, ChevronDown, ChevronRight, Printer, FileDown, Wallet, X, Edit2, Save, UserCheck, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PayersManagement = () => {
  const { showAlert } = useAlert();
  const { t, locale } = useLanguage();
  // The API names a payer "Unknown" when none is stored; show that in the selected language.
  const payerName = (name) => (!name || name === 'Unknown' ? t('common.unknown') : name);
  const relationshipLabel = (value) => t(`academic.guardians.relationships.${value}`, { defaultValue: value });
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayer, setEditingPayer] = useState(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phone: '',
    alternatePhone: '',
    relationship: 'Father'
  });
  const [saving, setSaving] = useState(false);

  const fetchPayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/cashbook/payers');
      setPayers(data || []);
    } catch (err) {
      console.error('Failed to load payers', err);
      const msg = err.response?.data?.message || err.message || t('payers.loadFailed');
      setError(msg);
      showAlert({ type: 'danger', title: t('common.error'), message: msg });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (p) => {
    setEditingPayer(p);
    setEditFormData({
      fullName: p.name && p.name !== 'Unknown' ? p.name : '',
      phone: p.phone || '',
      alternatePhone: p.alternatePhone || '',
      relationship: p.relationship || 'Father'
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (saving) return;
    setIsEditModalOpen(false);
    setEditingPayer(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = (editFormData.phone || '').trim();
    if (!cleanPhone) {
      showAlert({ type: 'warning', title: t('common.validationError'), message: t('payers.phoneRequired') });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        fullName: (editFormData.fullName || '').trim() || 'Fee Payer',
        phone: cleanPhone,
        alternatePhone: (editFormData.alternatePhone || '').trim(),
        relationship: editFormData.relationship || 'Father',
        studentIds: editingPayer?.studentIds || []
      };

      if (editingPayer?.guardianId) {
        await api.put(`/guardians/${editingPayer.guardianId}`, payload);
      } else {
        await api.post('/guardians', payload);
      }

      const count = editingPayer?.studentCount || (editingPayer?.students || []).length;
      showAlert({
        type: 'success',
        title: t('common.success'),
        message: t('payers.updated', { count })
      });
      setIsEditModalOpen(false);
      setEditingPayer(null);
      await fetchPayers();
    } catch (err) {
      console.error('Failed to update payer', err);
      showAlert({
        type: 'danger',
        title: t('payers.updateErrorTitle'),
        message: err.response?.data?.message || err.message || t('payers.updateFailed')
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchPayers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter payers by name, primary phone, secondary phone (number 2), or linked student names
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return payers;
    const qDigits = q.replace(/\D/g, '');
    return payers.filter((p) => {
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
  }, [payers, search]);

  // Grand total across every payer in the system, summed from the same
  // server-calculated totalFee the table prints. It follows the payer list, so
  // adding or deleting a payer — or changing a student's fee — is reflected on
  // the next load without anything being entered by hand.
  const grandTotal = useMemo(
    () => payers.reduce((sum, p) => sum + Number(p.totalFee || 0), 0),
    [payers]
  );

  // Shown only while a search is active, so the visible rows still add up.
  const filteredTotal = useMemo(
    () => filtered.reduce((sum, p) => sum + Number(p.totalFee || 0), 0),
    [filtered]
  );

  const handlePrint = () => window.print();

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Header banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(t('payers.pdf.title'), 14, 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${t('payers.pdf.generated')}: ${new Date().toLocaleString(locale)}   |   ${t('payers.pdf.payers')}: ${filtered.length}`, 14, 20);

    const cols = { no: 12, name: 22, number: 78, students: 132, total: 155, paid: 190 };
    let y = 36;

    const drawHeader = () => {
      doc.setFillColor(30, 41, 59);
      doc.rect(10, y - 5, pageW - 20, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('#', cols.no, y);
      doc.text(t('payers.pdf.payerName'), cols.name, y);
      doc.text(t('payers.pdf.number'), cols.number, y);
      doc.text(t('payers.pdf.students'), cols.students, y);
      doc.text(t('payers.pdf.total'), cols.total, y);
      doc.text(t('payers.pdf.paid'), cols.paid, y);
      y += 9;
    };

    drawHeader();

    filtered.forEach((p, i) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 20;
        drawHeader();
      }
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(10, y - 5, pageW - 20, 9, 'F');

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(String(i + 1), cols.no, y);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(payerName(p.name)).slice(0, 28), cols.name, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const numText = p.alternatePhone && p.alternatePhone !== p.phone
        ? `${p.phone || '—'} / ${p.alternatePhone}`
        : String(p.phone || '—');
      doc.text(numText.slice(0, 24), cols.number, y);
      doc.text(String(p.studentCount), cols.students + 3, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`$${fmtMoney(p.totalFee)}`, cols.total, y);

      // Empty box to tick by hand.
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.rect(cols.paid, y - 4, 5, 5);

      y += 9;
    });

    doc.save(`${t('payers.pdf.file')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500 font-bold">{t('payers.loading')}</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-24 print:p-0 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2 print:hidden">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10">
            <Users size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">{t('payers.title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">
              {t('payers.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-6 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95"
          >
            <FileDown size={16} /> {t('exams.results.exportPdf')}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-brand-600/30 active:scale-95"
          >
            <Printer size={16} /> {t('payers.printChecklist')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md print:hidden focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
        <Search size={18} className="text-slate-400 mr-3 shrink-0" />
        <input
          type="text"
          placeholder={t('payers.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-4 w-10 print:hidden"></th>
                <th className="px-5 py-4">{t('payers.colName')}</th>
                <th className="px-5 py-4">{t('payers.colNumbers')}</th>
                <th className="px-5 py-4 text-center">{t('nav.students')}</th>
                <th className="px-5 py-4 text-right">{t('payers.colTotal')}</th>
                <th className="px-5 py-4 text-center">{t('common.paid')}</th>
                <th className="px-5 py-4 text-center print:hidden">{t('common.actions')}</th>
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
                      <td className="px-4 py-4 text-slate-400 print:hidden">
                        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {payerName(p.name)}
                        {p.relationship && (
                          <span className="block text-[10px] text-slate-400 font-semibold uppercase print:hidden">{relationshipLabel(p.relationship)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-1.5">
                          {p.phone ? (
                            <a
                              href={`tel:${p.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/20 w-fit"
                              title={t('academic.guardians.phone1Title')}
                            >
                              <Phone size={11} className="shrink-0 print:hidden text-emerald-500" />
                              <span>{p.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                          {p.alternatePhone && p.alternatePhone !== p.phone && (
                            <a
                              href={`tel:${p.alternatePhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-500/20 w-fit"
                              title={t('academic.guardians.phone2Title')}
                            >
                              <Phone size={11} className="shrink-0 print:hidden text-blue-500" />
                              <span>{p.alternatePhone}</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-3 py-1 text-xs font-black rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {p.studentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-black text-slate-900 dark:text-white">
                        ${fmtMoney(p.totalFee)}
                      </td>
                      {/* Empty box — printed and ticked by hand */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center">
                          <span className="inline-block w-6 h-6 rounded-md border-2 border-slate-900 dark:border-slate-300 print:border-black" />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center print:hidden" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950/50 transition-all active:scale-95 shadow-xs"
                          title={t('payers.editTitle')}
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/20 print:hidden">
                        <td colSpan={7} className="px-6 pb-6 pt-0">
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                  <th className="px-5 py-3">{t('common.student')}</th>
                                  <th className="px-5 py-3">{t('common.class')}</th>
                                  <th className="px-5 py-3 text-right">{t('monthlyPayments.monthlyFee')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {p.students.map((s) => (
                                  <tr key={s.studentId}>
                                    <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">{s.name}</td>
                                    <td className="px-5 py-3 text-slate-500">{s.className || '—'}</td>
                                    <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-200">${fmtMoney(s.monthlyFee)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
                                  <td className="px-5 py-3 uppercase text-[11px] text-slate-500" colSpan={2}>{t('common.total')}</td>
                                  <td className="px-5 py-3 text-right">${fmtMoney(p.totalFee)}</td>
                                </tr>
                              </tfoot>
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
                  <td colSpan={7} className="px-8 py-16 text-center text-slate-400 text-sm font-medium">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500 font-semibold">{t('payers.loadingRows')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center">
                    <div className="max-w-md mx-auto p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-sm flex flex-col items-center gap-3">
                      <p className="font-semibold">{error}</p>
                      <button
                        onClick={fetchPayers}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        {t('monthlyPayments.retry')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-400 text-sm font-medium">
                    {t('payers.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand Total — summed from every payer's server-calculated total fee.
          Positioned below the payer table so the figure closes the list.
          Values and calculations are unchanged. */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-6 flex flex-wrap items-center justify-between gap-4 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 print:hidden">
            <Wallet size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('payers.grandTotal')}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {t('payers.acrossPayers', { count: payers.length })}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
            ${fmtMoney(grandTotal)}
          </p>
          {search.trim() && (
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('payers.matchingSearch', { amount: `$${fmtMoney(filteredTotal)}`, shown: filtered.length, total: payers.length })}
            </p>
          )}
        </div>
      </div>

      {/* Edit Payer Modal */}
      {isEditModalOpen && editingPayer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {t('payers.editPayer')}
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold">
                    {t('payers.editSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={saving}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {/* Linked Students Info Banner */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{t('payers.syncTitle')}</span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {t('payers.syncMessage', { count: editingPayer.studentCount || (editingPayer.students || []).length })}
                </p>
                {editingPayer.students?.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {editingPayer.students.map((s) => (
                      <span
                        key={s.studentId}
                        className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/50 rounded-lg font-bold text-[10px] text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60"
                      >
                        {s.name} {s.className ? `(${s.className})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Payer Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('payers.colName')}
                </label>
                <input
                  type="text"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  placeholder={t('payers.namePlaceholder')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
              </div>

              {/* Phone 1 (Primary) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {t('payers.phone1Label')} <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    {t('payers.updatesStudents')}
                  </span>
                </div>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-3.5 text-emerald-500" />
                  <input
                    type="tel"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder={t('payers.phone1Placeholder')}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Phone 2 (Alternate / Second Number) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {t('payers.phone2Label')}
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {t('common.optional')}
                  </span>
                </div>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-3.5 text-blue-500" />
                  <input
                    type="tel"
                    value={editFormData.alternatePhone}
                    onChange={(e) => setEditFormData({ ...editFormData, alternatePhone: e.target.value })}
                    placeholder={t('payers.phone2Placeholder')}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('academic.guardians.colRelationship')}
                </label>
                <select
                  value={editFormData.relationship}
                  onChange={(e) => setEditFormData({ ...editFormData, relationship: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                >
                  <option value="Father">{relationshipLabel('Father')}</option>
                  <option value="Mother">{relationshipLabel('Mother')}</option>
                  <option value="Guardian">{relationshipLabel('Guardian')}</option>
                  <option value="Sponsor">{relationshipLabel('Sponsor')}</option>
                  <option value="Other">{relationshipLabel('Other')}</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-brand-600/30 active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>{t('common.saveChanges')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayersManagement;
