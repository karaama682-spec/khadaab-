import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, Wallet, Search } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const WalletsManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const { t, tv, locale } = useLanguage();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    balance: 0,
    currency: 'USD',
    type: 'Bank',
    accountNumber: '',
    description: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/wallets');
      setData(res.data || []);
    } catch (error) {
      console.error('Failed to fetch wallets', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', balance: 0, currency: 'USD', type: 'Bank', accountNumber: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      balance: item.balance || 0,
      currency: item.currency || 'USD',
      type: ['Bank', 'Mobile'].includes(item.type) ? item.type : 'Bank',
      accountNumber: item.accountNumber || '',
      description: item.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showAlert({ type: 'warning', title: t('common.validationError'), message: t('finance.wallets.nameRequired') });
      return;
    }
    try {
      if (editingItem) {
        const res = await api.put(`/wallets/${editingItem._id}`, formData);
        setData(prev => prev.map(i => i._id === editingItem._id ? (res.data || { ...i, ...formData }) : i));
        showAlert({ type: 'success', title: t('finance.updatedTitle'), message: t('finance.wallets.updated') });
      } else {
        const res = await api.post('/wallets', formData);
        setData(prev => [res.data, ...prev]);
        showAlert({ type: 'success', title: t('finance.createdTitle'), message: t('finance.wallets.created') });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: error.response?.data?.message || t('finance.wallets.saveFailed') });
    }
  };

  const handleDelete = async (item) => {
    const ok = await showConfirm({ type: 'warning', title: t('finance.wallets.deleteTitle'), message: t('finance.wallets.deleteConfirm'), confirmText: t('common.yesDelete'), cancelText: t('common.cancel'), danger: true });
    if (!ok) return;
    try {
      await api.delete(`/wallets/${item._id}`);
      setData(prev => prev.filter(i => i._id !== item._id));
      showAlert({ type: 'success', title: t('common.deleted'), message: t('finance.wallets.deletedMsg') });
    } catch (error) {
      showAlert({ type: 'danger', title: t('common.error'), message: t('finance.wallets.deleteFailed') });
    }
  };

  const filteredData = data.filter(item =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center text-slate-500">{t('finance.wallets.loading')}</div>;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10">
            <Wallet size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">{t('finance.wallets.title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">{t('finance.wallets.subtitle')}</p>
          </div>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95">
          <Plus size={18} strokeWidth={3} /> {t('finance.wallets.addNew')}
        </button>
      </div>

      <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md">
        <Search size={18} className="text-slate-400 mr-3" />
        <input type="text" placeholder={t('finance.wallets.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-5">{t('finance.wallets.colName')}</th>
                <th className="px-8 py-5">{t('common.type')}</th>
                <th className="px-8 py-5">{t('finance.wallets.colAccount')}</th>
                <th className="px-8 py-5">{t('common.balance')}</th>
                <th className="px-8 py-5">{t('settings.preferences.currency')}</th>
                <th className="px-8 py-5">{t('common.description')}</th>
                <th className="px-8 py-5 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                  <td className="px-8 py-6"><span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{tv(item.type || 'Cash')}</span></td>
                  <td className="px-8 py-6 text-sm font-semibold text-slate-600 dark:text-slate-300 font-mono">{item.accountNumber || '-'}</td>
                  <td className="px-8 py-6 text-sm font-black text-emerald-600 dark:text-emerald-400">{item.currency || 'USD'} {item.balance?.toLocaleString() || 0}</td>
                  <td className="px-8 py-6 text-sm font-semibold text-slate-500 dark:text-slate-400">{item.currency || 'USD'}</td>
                  <td className="px-8 py-6 text-sm font-semibold text-slate-500 dark:text-slate-400">{item.description || '-'}</td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(item)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr><td colSpan="7" className="px-8 py-10 text-center text-slate-400 text-sm font-medium">{t('finance.wallets.empty')}</td></tr>
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
                {editingItem ? t('finance.wallets.editTitle') : t('finance.wallets.addNew')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.wallets.nameLabel')}</label>
                <input type="text" required placeholder={t('finance.wallets.namePlaceholder')} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.wallets.typeLabel')}</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white">
                    <option value="Bank">{t('finance.wallets.bankAccount')}</option>
                    <option value="Mobile">{tv('Mobile Money')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.wallets.initialBalance')}</label>
                  <input type="number" min="0" value={formData.balance} onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('settings.preferences.currency')}</label>
                <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white">
                  <option value="USD">{t('finance.wallets.usd')}</option>
                  <option value="SOS">{t('finance.wallets.sos')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('finance.wallets.accountNumber')}</label>
                <input type="text" placeholder={t('finance.wallets.accountPlaceholder')} value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-mono" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">{t('common.description')}</label>
                <input type="text" placeholder={t('finance.optionalDescription')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase">{t('common.cancel')}</button>
                <button type="submit" className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase shadow-lg hover:bg-emerald-700">
                  {editingItem ? t('common.saveChanges') : t('finance.wallets.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletsManagement;
