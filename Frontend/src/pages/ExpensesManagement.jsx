import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, ArrowDownRight, Search } from 'lucide-react';
import api from '../services/api';
import { walletNameOf } from '../utils/wallet';
import { useAlert } from '../components/common/alerts/useAlert';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const EXPENSE_CATEGORIES = ['Utilities', 'Maintenance', 'Supplies', 'Rent', 'Transport', 'Events', 'Other'];

const ExpensesManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const { t, tv, locale } = useLanguage();
  const [data, setData] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    amount: 0,
    walletId: '',
    category: 'Other',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resExpenses, resWallets] = await Promise.all([
        api.get('/expenses'),
        api.get('/wallets')
      ]);
      setData(resExpenses.data || []);
      setWallets(resWallets.data || []);
    } catch (error) {
      console.error('Failed to fetch expenses', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleWalletChange = (walletId) => {
    const wallet = wallets.find(w => w._id === walletId);
    let autoMethod = 'Cash';
    if (wallet) {
      const type = (wallet.type || '').toLowerCase();
      if (type.includes('bank')) autoMethod = 'Bank Transfer';
      else if (type.includes('mobile')) autoMethod = 'Mobile Money';
    }
    setFormData(prev => ({
      ...prev,
      walletId,
      paymentMethod: wallet ? autoMethod : prev.paymentMethod
    }));
  };

  const openAddModal = () => {
    setEditingItem(null);
    const initialWallet = wallets[0];
    let initialMethod = 'Cash';
    if (initialWallet) {
      const type = (initialWallet.type || '').toLowerCase();
      if (type.includes('bank')) initialMethod = 'Bank Transfer';
      else if (type.includes('mobile')) initialMethod = 'Mobile Money';
    }

    setFormData({
      title: '',
      amount: 0,
      walletId: initialWallet?._id || '',
      category: 'Other',
      paymentMethod: initialMethod,
      date: new Date().toISOString().split('T')[0],
      description: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      amount: item.amount || 0,
      walletId: item.walletId?._id || item.walletId || wallets[0]?._id || '',
      category: item.category || 'Other',
      paymentMethod: item.paymentMethod || 'Cash',
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: item.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      showAlert({ type: 'warning', title: t('common.validationError'), message: t('finance.expenses.required') });
      return;
    }
    try {
      if (editingItem) {
        const res = await api.put(`/expenses/${editingItem._id}`, formData);
        setData(prev => prev.map(i => i._id === editingItem._id ? (res.data || { ...i, ...formData }) : i));
        showAlert({ type: 'success', title: t('finance.updatedTitle'), message: t('finance.expenses.updated') });
      } else {
        const res = await api.post('/expenses', formData);
        setData(prev => [res.data, ...prev]);
        showAlert({ type: 'success', title: t('common.success'), message: t('finance.expenses.recorded') });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: error.response?.data?.message || t('finance.expenses.saveFailed') });
    }
  };

  const handleDelete = async (item) => {
    const ok = await showConfirm({ type: 'warning', title: t('finance.expenses.deleteTitle'), message: t('finance.expenses.deleteConfirm'), confirmText: t('common.yesDelete'), cancelText: t('common.cancel'), danger: true });
    if (!ok) return;
    try {
      await api.delete(`/expenses/${item._id}`);
      setData(prev => prev.filter(i => i._id !== item._id));
      showAlert({ type: 'success', title: t('common.deleted'), message: t('finance.expenses.deletedMsg') });
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: t('finance.expenses.deleteFailed') });
    }
  };

  const filteredData = data.filter(item =>
    (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center text-slate-500">{t('finance.expenses.loading')}</div>;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10">
            <ArrowDownRight size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">{t('finance.expenses.title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">{t('finance.expenses.subtitle')}</p>
          </div>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-3 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95">
          <Plus size={18} strokeWidth={3} /> {t('finance.expenses.recordNew')}
        </button>
      </div>

      <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md">
        <Search size={18} className="text-slate-400 mr-3" />
        <input type="text" placeholder={t('finance.expenses.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-5">{t('common.date')}</th>
                <th className="px-8 py-5">{t('finance.expenses.colTitle')}</th>
                <th className="px-8 py-5">{t('common.category')}</th>
                <th className="px-8 py-5">{t('common.amount')}</th>
                <th className="px-8 py-5">{t('finance.paidFromWallet')}</th>
                <th className="px-8 py-5">{t('common.method')}</th>
                <th className="px-8 py-5 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-8 py-6 text-sm font-semibold text-slate-500 dark:text-slate-400">{new Date(item.date || item.createdAt).toLocaleDateString(locale)}</td>
                  <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</td>
                  <td className="px-8 py-6"><span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">{t(`finance.expenses.categories.${item.category || 'Other'}`, { defaultValue: item.category })}</span></td>
                  <td className="px-8 py-6 text-sm font-black text-rose-600 dark:text-rose-400">${item.amount}</td>
                  <td className="px-8 py-6 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {walletNameOf(item, wallets)}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-sm font-semibold text-slate-500 dark:text-slate-400">{tv(item.paymentMethod) || '-'}</td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(item)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr><td colSpan="6" className="px-8 py-10 text-center text-slate-400 text-sm font-medium">{t('finance.expenses.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingItem ? t('finance.expenses.editTitle') : t('finance.expenses.recordNew')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.expenses.titleLabel')}</label>
                <input type="text" required placeholder={t('finance.expenses.titlePlaceholder')} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.amountLabel')}</label>
                  <input type="number" min="1" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('common.category')}</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`finance.expenses.categories.${c}`)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.expenses.walletLabel')}</label>
                <select
                  required
                  value={formData.walletId}
                  onChange={(e) => handleWalletChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                >
                  <option value="">{t('finance.selectWallet')}</option>
                  {wallets.map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({tv(w.type)} - {t('common.balance')}: ${w.balance || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('common.date')}</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.paymentMethod')}</label>
                  <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white">
                    <option value="Cash">{tv('Cash')}</option>
                    <option value="Bank Transfer">{tv('Bank Transfer')}</option>
                    <option value="Mobile Money">{t('finance.mobileMoneyEvc')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('common.description')}</label>
                <input type="text" placeholder={t('finance.optionalDescription')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase">{t('common.cancel')}</button>
                <button type="submit" className="px-6 py-3 rounded-xl bg-rose-600 text-white font-bold text-xs uppercase shadow-lg hover:bg-rose-700">
                  {editingItem ? t('common.saveChanges') : t('finance.expenses.record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesManagement;
