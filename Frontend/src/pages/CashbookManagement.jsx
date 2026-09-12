import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Edit2,
  Trash2,
  Search,
  Tags,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Save,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { digitsOnly } from '../utils/somaliPhone';

const PAYMENT_METHODS = ['Mobile Money', 'Bank'];

const METHODS_WITH_PARTIES = ['Mobile Money', 'Bank'];

// Per-method phone/account hints.
//  • Bank account number: 6–7 digits.
//  • Mobile Money: any number is accepted (e.g. 2526172882, 61…, 061…).
const PHONE_RULES = {
  Bank: { label: 'Bank number must be 6 to 7 digits' },
  'Mobile Money': { label: 'Enter the payer mobile number' }
};

// Returns an error string if the value is present but does not match the
// method's rule; empty string means valid (or nothing to validate).
// Mobile Money accepts any number — only Bank enforces a length.
const phoneError = (method, value) => {
  const d = digitsOnly(value);
  if (!d) return '';
  if (method === 'Bank') {
    return d.length >= 6 && d.length <= 7 ? '' : PHONE_RULES.Bank.label;
  }
  return '';
};

const emptyCategoryForm = () => ({
  title: '',
  type: 'Income',
  description: ''
});

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let i = 0; i <= 6; i++) {
    const d = new Date(Date.UTC(currentY, currentM + i, 1));
    const ym = d.toISOString().slice(0, 7);
    const mName = monthNames[d.getUTCMonth()];
    const yr = d.getUTCFullYear();
    let label = `${mName} ${yr}`;
    if (i === 0) {
      label += ' (Bisha Hadda)';
    } else {
      label += ' (Hormarin / Advance)';
    }
    options.push({ value: ym, label, monthName: mName, year: yr, isAdvance: i > 0 });
  }
  return options;
};

const getPayerMonthLabel = (baseYm, offset = 0) => {
  const [y, m] = (baseYm || new Date().toISOString().slice(0, 7)).split('-').map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + offset, 1));
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return {
    name: monthNames[d.getUTCMonth()],
    year: d.getUTCFullYear(),
    ym: d.toISOString().slice(0, 7)
  };
};

const emptyTransactionForm = () => ({
  type: 'Income',
  categoryId: '',
  amount: '',
  method: 'Mobile Money',
  walletId: '',
  senderPhone: '',
  senderName: '',
  senderEntityType: '',
  senderEntityId: '',
  receiverPhone: '',
  receiverName: '',
  receiverEntityType: '',
  receiverEntityId: '',
  date: new Date().toISOString().split('T')[0],
  targetMonth: new Date().toISOString().slice(0, 7),
  description: ''
});

const CashbookManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const [activePanel, setActivePanel] = useState('category');

  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [payerOptions, setPayerOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm());
  const [editingCategory, setEditingCategory] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');

  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm());
  const [editingEntry, setEditingEntry] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [senderLocked, setSenderLocked] = useState(false);
  const [receiverLocked, setReceiverLocked] = useState(false);
  const [walletDirection, setWalletDirection] = useState('receiver');
  const [payerInfo, setPayerInfo] = useState(null);
  const [monthsToPay, setMonthsToPay] = useState(1);

  // The most a responsible payer may pay: the current month's outstanding balance,
  // or the advance fee for the selected advance month(s).
  const maxPayable = (payerInfo && payerInfo.kind === 'responsible')
    ? (monthsToPay === 1
        ? Number(payerInfo.totalBalance || 0)
        : Number(payerInfo.totalMonthlyFee || 0) * (monthsToPay - 1))
    : null;

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const monthOptions = getMonthOptions();

  // When the number of pre-paid months changes, re-fill the amount with the target month(s) amount.
  useEffect(() => {
    if (payerInfo && payerInfo.kind === 'responsible') {
      const targetAmount = monthsToPay === 1
        ? Number(payerInfo.totalBalance || 0)
        : Number(payerInfo.totalMonthlyFee || 0) * (monthsToPay - 1);
      setTransactionForm((prev) => ({ ...prev, amount: targetAmount }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsToPay]);

  const isInstituteAccount = (phone, list = wallets) =>
    (list || []).some((w) => w.accountNumber && (w.accountNumber === phone || digitsOnly(w.accountNumber) === digitsOnly(phone)));

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [catRes, entryRes, walletRes, guardRes, studRes] = await Promise.all([
        api.get('/cashbook/categories'),
        api.get('/cashbook/entries'),
        api.get('/wallets'),
        api.get('/guardians'),
        api.get('/students')
      ]);
      setCategories(catRes.data || []);
      setEntries(entryRes.data || []);
      const walletList = walletRes.data || [];
      setWallets(walletList);

      // Build the type-and-select payer list (guardians + students' fathers + contacts), unique by number.
      const optMap = new Map();
      (guardRes.data?.guardians || guardRes.data || []).forEach((g) => {
        const ph = digitsOnly(g.phone);
        if (ph && !optMap.has(ph)) optMap.set(ph, g.fullName || g.name || '');
      });
      (studRes.data?.students || studRes.data || []).forEach((s) => {
        const ph = digitsOnly(s.fatherPhone);
        if (ph && !optMap.has(ph)) optMap.set(ph, s.fatherName || '');
      });
      (entryRes.data || []).forEach((e) => {
        const sp = digitsOnly(e.senderPhone);
        if (sp && !optMap.has(sp) && !isInstituteAccount(sp, walletList)) {
          optMap.set(sp, e.senderName || e.payerName || '');
        }
        const rp = digitsOnly(e.receiverPhone);
        if (rp && !optMap.has(rp) && !isInstituteAccount(rp, walletList)) {
          optMap.set(rp, e.receiverName || '');
        }
      });
      setPayerOptions([...optMap.entries()].map(([phone, name]) => ({ phone, name })));
      // Default the form to the first active wallet if none picked yet.
      const firstWallet = walletList.find((w) => w.status !== 'Disabled') || walletList[0];
      if (firstWallet) {
        setTransactionForm((prev) => {
          if (prev.walletId) return prev;
          const isExp = prev.type === 'Expense';
          return {
            ...prev,
            walletId: firstWallet._id,
            senderPhone: isExp ? (firstWallet.accountNumber || '') : prev.senderPhone,
            senderName: isExp ? (firstWallet.name || '') : prev.senderName,
            receiverPhone: !isExp ? (firstWallet.accountNumber || '') : prev.receiverPhone,
            receiverName: !isExp ? (firstWallet.name || '') : prev.receiverName,
            receiverEntityType: !isExp ? 'manual' : prev.receiverEntityType,
            senderEntityType: isExp ? 'manual' : prev.senderEntityType
          };
        });
      }
    } catch (error) {
      console.error('Failed to load cashbook', error);
      showAlert({ type: 'danger', title: 'Error', message: 'Failed to load cashbook data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Synchronize Type and Wallet Direction:
  // Type === 'Expense' <=> Wallet Direction === 'sender'
  // Type === 'Income' <=> Wallet Direction === 'receiver'
  const applyTypeAndDirection = (newType, newDirection, targetWalletId) => {
    const type = newType || (newDirection === 'sender' ? 'Expense' : 'Income');
    const direction = newDirection || (type === 'Expense' ? 'sender' : 'receiver');
    setWalletDirection(direction);

    const wId = targetWalletId !== undefined ? targetWalletId : transactionForm.walletId;
    const selectedWallet = wallets.find((w) => w._id === wId) || wallets.find((w) => w.status !== 'Disabled') || wallets[0];

    setTransactionForm((prev) => {
      const typeChanged = prev.type !== type;
      const nextCategoryId = typeChanged ? '' : prev.categoryId;

      if (direction === 'sender') {
        const clearReceiver = isInstituteAccount(prev.receiverPhone);
        return {
          ...prev,
          type,
          categoryId: nextCategoryId,
          walletId: wId !== undefined ? wId : prev.walletId,
          senderPhone: selectedWallet?.accountNumber || '',
          senderName: selectedWallet?.name || '',
          senderEntityType: 'manual',
          senderEntityId: '',
          receiverPhone: clearReceiver ? '' : prev.receiverPhone,
          receiverName: clearReceiver ? '' : prev.receiverName,
          receiverEntityType: clearReceiver ? '' : prev.receiverEntityType,
          receiverEntityId: clearReceiver ? '' : prev.receiverEntityId
        };
      } else {
        const clearSender = isInstituteAccount(prev.senderPhone);
        return {
          ...prev,
          type,
          categoryId: nextCategoryId,
          walletId: wId !== undefined ? wId : prev.walletId,
          receiverPhone: selectedWallet?.accountNumber || '',
          receiverName: selectedWallet?.name || '',
          receiverEntityType: 'manual',
          receiverEntityId: '',
          senderPhone: clearSender ? '' : prev.senderPhone,
          senderName: clearSender ? '' : prev.senderName,
          senderEntityType: clearSender ? '' : prev.senderEntityType,
          senderEntityId: clearSender ? '' : prev.senderEntityId
        };
      }
    });

    if (direction === 'sender') {
      setSenderLocked(false);
      setPayerInfo(null);
    } else {
      setReceiverLocked(false);
    }
  };

  const handleDirectionChange = (direction) => {
    const targetDirection = direction === 'sender' ? 'sender' : 'receiver';
    const targetType = targetDirection === 'sender' ? 'Expense' : 'Income';
    applyTypeAndDirection(targetType, targetDirection);
  };

  const lookupPhone = useCallback(async (phone, side, overrideMonth = null) => {
    const cleaned = digitsOnly(phone);
    if (cleaned.length < 4) return;

    // Only look up once the number matches the method's digit rule.
    if (phoneError(transactionForm.method, cleaned)) {
      return;
    }

    const monthToUse = overrideMonth || transactionForm.targetMonth || (transactionForm.date || new Date().toISOString().split('T')[0]).slice(0, 7);

    try {
      const res = await api.get('/cashbook/lookup', {
        params: { phone: cleaned, purpose: side, date: transactionForm.date, month: monthToUse }
      });
      const { found, name, entityType, entityId, payerInfo: info } = res.data || {};

      if (side === 'sender') {
        if (found) {
          // Auto-fill the amount with the current remaining balance owed/payable.
          const rem = info?.remainingBalance !== undefined
            ? Number(info.remainingBalance)
            : info?.totalBalance !== undefined
            ? Number(info.totalBalance)
            : null;
          setTransactionForm((prev) => ({
            ...prev,
            senderName: name,
            senderEntityType: entityType === 'teacher' ? 'user' : entityType,
            senderEntityId: entityId || '',
            amount: rem !== null && !isNaN(rem) ? rem : prev.amount
          }));
          setSenderLocked(true);
          setPayerInfo(info || null);
          setMonthsToPay(1);
        } else {
          setSenderLocked(false);
          setPayerInfo(null);
        }
      } else {
        if (found) {
          // Auto-fill the amount with the current remaining balance owed/payable.
          const rem = info?.remainingBalance !== undefined
            ? Number(info.remainingBalance)
            : info?.totalBalance !== undefined
            ? Number(info.totalBalance)
            : null;
          setTransactionForm((prev) => ({
            ...prev,
            receiverName: name,
            receiverEntityType: entityType === 'teacher' ? 'teacher' : entityType === 'user' ? 'user' : entityType,
            receiverEntityId: entityId || '',
            amount: rem !== null && !isNaN(rem) ? rem : prev.amount
          }));
          setReceiverLocked(true);
          setPayerInfo(info || null);
        } else {
          setReceiverLocked(false);
        }
      }
    } catch {
      if (side === 'sender') {
        setSenderLocked(false);
        setPayerInfo(null);
      } else {
        setReceiverLocked(false);
      }
    }
  }, [transactionForm.method, transactionForm.date, transactionForm.targetMonth]);

  const handleTargetMonthChange = (newMonth) => {
    setTransactionForm((prev) => ({ ...prev, targetMonth: newMonth }));
    const activePhone = walletDirection === 'sender' ? transactionForm.receiverPhone : transactionForm.senderPhone;
    const activeSide = walletDirection === 'sender' ? 'receiver' : 'sender';
    if (activePhone) {
      lookupPhone(activePhone, activeSide, newMonth);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (transactionForm.senderPhone && walletDirection !== 'sender') {
        lookupPhone(transactionForm.senderPhone, 'sender');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [transactionForm.senderPhone, lookupPhone, walletDirection]);

  useEffect(() => {
    // Skip lookup when the receiver is assigned from the institute wallet.
    if (walletDirection === 'receiver') return;
    const t = setTimeout(() => {
      if (transactionForm.receiverPhone) lookupPhone(transactionForm.receiverPhone, 'receiver');
    }, 400);
    return () => clearTimeout(t);
  }, [transactionForm.receiverPhone, lookupPhone, walletDirection]);

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm());
    setEditingCategory(null);
  };

  const resetTransactionForm = () => {
    const firstWallet = wallets.find((w) => w.status !== 'Disabled') || wallets[0];
    const initialForm = emptyTransactionForm();
    setEditingEntry(null);
    setSenderLocked(false);
    setReceiverLocked(false);
    setWalletDirection('receiver');
    setPayerInfo(null);
    if (firstWallet) {
      initialForm.walletId = firstWallet._id;
      initialForm.receiverPhone = firstWallet.accountNumber || '';
      initialForm.receiverName = firstWallet.name || '';
      initialForm.receiverEntityType = 'manual';
    }
    setTransactionForm(initialForm);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.title.trim()) {
      showAlert({ type: 'warning', title: 'Validation', message: 'Category title is required.' });
      return;
    }
    try {
      if (editingCategory) {
        const res = await api.put(`/cashbook/categories/${editingCategory._id}`, categoryForm);
        setCategories((prev) => prev.map((c) => (c._id === editingCategory._id ? res.data : c)));
        showAlert({ type: 'success', title: 'Updated', message: 'Category updated.' });
      } else {
        const res = await api.post('/cashbook/categories', categoryForm);
        setCategories((prev) => [...prev, res.data].sort((a, b) => a.title.localeCompare(b.title)));
        showAlert({ type: 'success', title: 'Saved', message: 'Category created.' });
      }
      resetCategoryForm();
    } catch (error) {
      showAlert({
        type: 'danger',
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save category.'
      });
    }
  };

  const handleCategoryEdit = (item) => {
    setEditingCategory(item);
    setCategoryForm({
      title: item.title || '',
      type: item.type || 'Income',
      description: item.description || ''
    });
    setActivePanel('category');
  };

  const handleCategoryDelete = async (item) => {
    const ok = await showConfirm({
      type: 'warning',
      title: 'Delete category?',
      message: 'Categories used by transactions cannot be deleted.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/cashbook/categories/${item._id}`);
      setCategories((prev) => prev.filter((c) => c._id !== item._id));
      showAlert({ type: 'success', title: 'Deleted', message: 'Category removed.' });
    } catch (error) {
      showAlert({
        type: 'danger',
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete category.'
      });
    }
  };

  const validateTransaction = () => {
    if (!transactionForm.categoryId) {
      showAlert({ type: 'warning', title: 'Validation', message: 'Select a category.' });
      return false;
    }
    if (!transactionForm.amount || Number(transactionForm.amount) <= 0) {
      showAlert({ type: 'warning', title: 'Validation', message: 'Enter a valid amount.' });
      return false;
    }
    // A fee payer may never pay more than they owe (current month + any pre-paid months).
    if (maxPayable !== null && Number(transactionForm.amount) > maxPayable + 0.001) {
      showAlert({
        type: 'warning',
        title: 'Amount too high',
        message: maxPayable > 0
          ? `This payer only owes ${fmtMoney(maxPayable)} for ${monthsToPay} month(s). Reduce the amount, or increase the months to pay ahead.`
          : `This payer has no outstanding balance for the current month. Increase the months to pre-pay future fees.`
      });
      return false;
    }
    const senderErr = phoneError(transactionForm.method, transactionForm.senderPhone);
    if (senderErr && walletDirection !== 'sender') {
      showAlert({ type: 'warning', title: 'Sender number', message: senderErr });
      return false;
    }
    // Institute account numbers assigned from the wallet are not held to the
    // mobile digit rules, so only validate when not assigned from wallet.
    if (walletDirection !== 'receiver') {
      const receiverErr = phoneError(transactionForm.method, transactionForm.receiverPhone);
      if (receiverErr) {
        showAlert({ type: 'warning', title: 'Receiver number', message: receiverErr });
        return false;
      }
    }
    return true;
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (!validateTransaction()) return;

    const payload = {
      ...transactionForm,
      amount: Number(transactionForm.amount),
      senderPhone: digitsOnly(transactionForm.senderPhone),
      receiverPhone: digitsOnly(transactionForm.receiverPhone)
    };

    try {
      if (editingEntry) {
        const res = await api.put(`/cashbook/entries/${editingEntry._id}`, payload);
        setEntries((prev) => prev.map((x) => (x._id === editingEntry._id ? res.data : x)));
        showAlert({ type: 'success', title: 'Updated', message: 'Transaction updated.' });
      } else {
        const res = await api.post('/cashbook/entries', payload);
        setEntries((prev) => [res.data, ...prev]);
        showAlert({ type: 'success', title: 'Saved', message: 'Transaction recorded.' });
      }
      resetTransactionForm();
      fetchAll();
    } catch (error) {
      showAlert({
        type: 'danger',
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save transaction.'
      });
    }
  };

  const handleTransactionEdit = (item) => {
    setEditingEntry(item);
    const itemWalletId = item.walletId?._id || item.walletId || '';
    const itemWallet = wallets.find((w) => w._id === itemWalletId);

    const itemType = item.categoryId?.type || item.type || (
      itemWallet?.accountNumber && item.senderPhone === itemWallet.accountNumber ? 'Expense' : 'Income'
    );
    const detectedDirection = itemType === 'Expense' ? 'sender' : 'receiver';
    setWalletDirection(detectedDirection);

    setTransactionForm({
      type: itemType,
      categoryId: item.categoryId?._id || item.categoryId || '',
      amount: item.amount ?? '',
      method: item.method || 'Mobile Money',
      walletId: itemWalletId,
      senderPhone: item.senderPhone || '',
      senderName: item.senderName || '',
      senderEntityType: item.senderEntityType || '',
      senderEntityId: item.senderEntityId || '',
      receiverPhone: item.receiverPhone || '',
      receiverName: item.receiverName || '',
      receiverEntityType: item.receiverEntityType || '',
      receiverEntityId: item.receiverEntityId || '',
      date: item.date || new Date().toISOString().split('T')[0],
      targetMonth: item.targetMonth || (item.date || new Date().toISOString().split('T')[0]).slice(0, 7),
      description: item.description || ''
    });
    setSenderLocked(!!item.senderEntityType && item.senderEntityType !== 'manual' && detectedDirection !== 'sender');
    setReceiverLocked(!!item.receiverEntityType && item.receiverEntityType !== 'manual' && detectedDirection !== 'receiver');
    setActivePanel('transaction');
  };

  const handleTransactionDelete = async (item) => {
    const ok = await showConfirm({
      type: 'warning',
      title: 'Delete transaction?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/cashbook/entries/${item._id}`);
      setEntries((prev) => prev.filter((x) => x._id !== item._id));
      showAlert({ type: 'success', title: 'Deleted', message: 'Transaction removed.' });
    } catch (error) {
      showAlert({ type: 'danger', title: 'Error', message: 'Failed to delete transaction.' });
    }
  };

  const filteredCategories = categories.filter((c) =>
    (c.title || '').toLowerCase().includes(categorySearch.toLowerCase()) ||
    (c.type || '').toLowerCase().includes(categorySearch.toLowerCase())
  );

  const today = new Date().toISOString().split('T')[0];

  const filteredEntries = entries.filter((item) => {
    const cat = item.categoryId;
    const catId = cat?._id || cat;
    if (filterType !== 'All' && cat?.type !== filterType) return false;
    if (filterCategory !== 'All' && String(catId) !== String(filterCategory)) return false;
    const d = item.date || '';
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  // Categories offered in the filter dropdown respect the chosen type filter.
  const filterCategoryOptions = categories.filter((c) => filterType === 'All' || c.type === filterType);

  const showReceiverFields = METHODS_WITH_PARTIES.includes(transactionForm.method);
  const categoriesForType = categories.filter((c) => c.type === transactionForm.type);
  const selectedWallet = wallets.find((w) => w._id === transactionForm.walletId);
  const senderPhoneErr = walletDirection === 'sender' ? '' : phoneError(transactionForm.method, transactionForm.senderPhone);
  const receiverPhoneErr = walletDirection === 'receiver' ? '' : phoneError(transactionForm.method, transactionForm.receiverPhone);
  const phoneHint = PHONE_RULES[transactionForm.method]?.label || '';

  const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading Cashbook...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10">
            <Wallet size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
              Cashbook
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">
              Categories &amp; all money movements
            </p>
          </div>
        </div>

        <div className="flex rounded-[20px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setActivePanel('category')}
            className={`flex items-center gap-2 px-8 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-all ${
              activePanel === 'category'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Tags size={16} /> Category
          </button>
          <button
            type="button"
            onClick={() => setActivePanel('transaction')}
            className={`flex items-center gap-2 px-8 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-all ${
              activePanel === 'transaction'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowLeftRight size={16} /> Transaction
          </button>
        </div>
      </div>

      {activePanel === 'category' && (
        <div className="space-y-8">
          <form
            onSubmit={handleCategorySubmit}
            className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-8 space-y-6"
          >
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-800 dark:text-white">
              {editingCategory ? 'Edit category' : 'New category'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Title</label>
                <input
                  type="text"
                  value={categoryForm.title}
                  onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="e.g. Student fee, Salary, Rent"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Type</label>
                <select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Description</label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-black text-xs uppercase tracking-wider"
              >
                <Save size={16} /> {editingCategory ? 'Update category' : 'Save category'}
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="flex items-center gap-2 px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs uppercase text-slate-600 dark:text-slate-300"
                >
                  <RotateCcw size={16} /> Cancel edit
                </button>
              )}
            </div>
          </form>

          <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md">
            <Search size={18} className="text-slate-400 mr-3" />
            <input
              type="text"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-5">Title</th>
                  <th className="px-8 py-5">Type</th>
                  <th className="px-8 py-5">Description</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCategories.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-white">{item.title}</td>
                    <td className="px-8 py-6">
                      <span
                        className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${
                          item.type === 'Income'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-500">{item.description || '—'}</td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCategoryEdit(item)}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 hover:text-brand-600"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCategoryDelete(item)}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 hover:text-rose-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-10 text-center text-slate-400 text-sm">
                      No categories yet. Add one above (e.g. Student payment, Salary, Expense).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activePanel === 'transaction' && (
        <div className="space-y-8">
          {categories.length === 0 && (
            <p className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-4 text-sm font-medium">
              Create at least one category first (use the Category tab).
            </p>
          )}

          <form
            onSubmit={handleTransactionSubmit}
            className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-8 space-y-6"
          >
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-800 dark:text-white">
              {editingEntry ? 'Edit transaction' : 'New transaction'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Type</label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const newDir = newType === 'Expense' ? 'sender' : 'receiver';
                    applyTypeAndDirection(newType, newDir);
                  }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-black uppercase tracking-wide outline-none ${
                    transactionForm.type === 'Income'
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Category</label>
                <select
                  required
                  value={transactionForm.categoryId}
                  onChange={(e) => setTransactionForm({ ...transactionForm, categoryId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">
                    {categoriesForType.length === 0
                      ? `No ${transactionForm.type} categories yet`
                      : `Select ${transactionForm.type} category`}
                  </option>
                  {categoriesForType.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Method</label>
                <select
                  value={transactionForm.method}
                  onChange={(e) => setTransactionForm({ ...transactionForm, method: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Institute Wallet / Account</label>
                <select
                  value={transactionForm.walletId}
                  onChange={(e) => {
                    const nextWalletId = e.target.value;
                    applyTypeAndDirection(transactionForm.type, walletDirection, nextWalletId);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Auto (active wallet)</option>
                  {wallets.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}{w.accountNumber ? ` · ${w.accountNumber}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Wallet Direction / Role Selector */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ArrowLeftRight size={14} className="text-brand-500" />
                    Doorka Wallet-ka / Transaction Direction
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {transactionForm.type === 'Expense'
                      ? 'Expense: Wallet-ka machadka waa Lacag Dire (Sender).'
                      : 'Income: Wallet-ka machadka waa Lacag Qaate (Receiver).'}
                  </p>
                </div>
                {selectedWallet && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800/50 self-start sm:self-auto">
                    <Wallet size={12} />
                    {selectedWallet.name}{selectedWallet.accountNumber ? ` · ${selectedWallet.accountNumber}` : ''}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Wallet as Sender */}
                <button
                  type="button"
                  onClick={() => handleDirectionChange('sender')}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                    walletDirection === 'sender'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-300 shadow-sm ring-2 ring-rose-500/20'
                      : 'bg-slate-100/70 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
                  }`}
                >
                  <ArrowUpRight size={14} className={walletDirection === 'sender' ? 'text-rose-600' : 'text-slate-400'} />
                  Wallet = Lacag Dire (Sender)
                </button>

                {/* 2. Wallet as Receiver */}
                <button
                  type="button"
                  onClick={() => handleDirectionChange('receiver')}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                    walletDirection === 'receiver'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-slate-100/70 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20'
                  }`}
                >
                  <ArrowDownLeft size={14} className={walletDirection === 'receiver' ? 'text-emerald-600' : 'text-slate-400'} />
                  Wallet = Lacag Qaate (Receiver)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {walletDirection === 'sender' ? 'Sender (Institute Wallet)' : 'Payer / Sender'}
                    </p>
                    {walletDirection === 'sender' ? (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                        Wallet Assigned
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('sender')}
                        className="text-[10px] font-bold text-slate-500 hover:text-brand-600 dark:text-slate-400 hover:underline"
                      >
                        + Set Wallet as Sender (Expense)
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {walletDirection === 'sender' ? 'Institute Account Number' : 'Payer phone'}
                    </label>
                    <input
                      type="text"
                      readOnly={walletDirection === 'sender'}
                      list={walletDirection === 'sender' ? undefined : 'payer-phone-options'}
                      autoComplete="off"
                      value={transactionForm.senderPhone}
                      onChange={(e) => {
                        setSenderLocked(false);
                        setPayerInfo(null);
                        setTransactionForm({
                          ...transactionForm,
                          senderPhone: e.target.value,
                          senderEntityType: '',
                          senderEntityId: ''
                        });
                      }}
                      placeholder={walletDirection === 'sender' ? '' : transactionForm.method === 'Bank' ? 'Select a payer or type a bank number' : 'Select a payer or type a number'}
                      className={`w-full px-4 py-3 rounded-xl border text-slate-900 dark:text-white ${
                        walletDirection === 'sender'
                          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 font-mono'
                          : senderPhoneErr
                          ? 'bg-slate-50 dark:bg-slate-800 border-rose-500 dark:border-rose-500 focus:ring-2 focus:ring-rose-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {walletDirection !== 'sender' && (
                      <datalist id="payer-phone-options">
                        {payerOptions.map((o) => (
                          <option key={o.phone} value={o.phone}>
                            {o.name ? `${o.name} — ${o.phone}` : o.phone}
                          </option>
                        ))}
                      </datalist>
                    )}
                    {walletDirection === 'sender' ? (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-semibold">
                        Wallet-ka machadka ayaa ah lacag diraha (Sender)
                      </p>
                    ) : senderPhoneErr ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">{senderPhoneErr}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">{phoneHint}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {walletDirection === 'sender' ? 'Institute Account Name' : 'Payer name'}
                    </label>
                    <input
                      type="text"
                      readOnly={senderLocked || walletDirection === 'sender'}
                      value={transactionForm.senderName}
                      onChange={(e) =>
                        setTransactionForm({
                          ...transactionForm,
                          senderName: e.target.value,
                          senderEntityType: 'manual',
                          senderEntityId: ''
                        })
                      }
                      placeholder={senderLocked || walletDirection === 'sender' ? '' : 'Type name if not in system'}
                      className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 ${
                        walletDirection === 'sender'
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100'
                          : senderLocked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                      }`}
                    />
                    {senderLocked && walletDirection !== 'sender' && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                        Matched from institute records
                      </p>
                    )}
                  </div>
                </div>

                {showReceiverFields && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {walletDirection === 'receiver' ? 'Receiver (Institute Wallet)' : 'Receiver (teacher / vendor / other)'}
                    </p>
                    {walletDirection === 'receiver' ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        Wallet Assigned
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('receiver')}
                        className="text-[10px] font-bold text-slate-500 hover:text-brand-600 dark:text-slate-400 hover:underline"
                      >
                        + Set Wallet as Receiver (Income)
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {walletDirection === 'receiver' ? 'Institute Account Number' : 'Phone / Account number'}
                    </label>
                    <input
                      type="text"
                      readOnly={walletDirection === 'receiver'}
                      list={walletDirection === 'receiver' ? undefined : 'payer-phone-options'}
                      autoComplete="off"
                      value={transactionForm.receiverPhone}
                      onChange={(e) => {
                        setReceiverLocked(false);
                        setTransactionForm({
                          ...transactionForm,
                          receiverPhone: e.target.value,
                          receiverEntityType: '',
                          receiverEntityId: ''
                        });
                      }}
                      placeholder={walletDirection === 'receiver' ? '' : transactionForm.method === 'Bank' ? 'Bank number (6–7 digits)' : '61…/62… or 061…/062…'}
                      className={`w-full px-4 py-3 rounded-xl border text-slate-900 dark:text-white ${
                        walletDirection === 'receiver'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 font-mono'
                          : receiverPhoneErr
                          ? 'bg-slate-50 dark:bg-slate-800 border-rose-500 dark:border-rose-500 focus:ring-2 focus:ring-rose-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {walletDirection === 'receiver' ? (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                        Wallet-ka machadka ayaa ah lacag qaataha (Receiver)
                      </p>
                    ) : receiverPhoneErr ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">{receiverPhoneErr}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">{phoneHint}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {walletDirection === 'receiver' ? 'Institute Account Name' : 'Name'}
                    </label>
                    <input
                      type="text"
                      readOnly={receiverLocked || walletDirection === 'receiver'}
                      value={transactionForm.receiverName}
                      onChange={(e) =>
                        setTransactionForm({
                          ...transactionForm,
                          receiverName: e.target.value,
                          receiverEntityType: 'manual',
                          receiverEntityId: ''
                        })
                      }
                      placeholder={receiverLocked || walletDirection === 'receiver' ? '' : 'Type name if not in system'}
                      className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 ${
                        walletDirection === 'receiver' || receiverLocked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                      }`}
                    />
                    {receiverLocked && walletDirection !== 'receiver' && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                        Matched from institute records (e.g. teacher)
                      </p>
                    )}
                  </div>
                </div>
                )}
              </div>

            {/* Monthly Pay — sits under the payer. Shows Current Month & Advance Months with clear breakdown. */}
            {payerInfo && payerInfo.kind === 'responsible' && Number(payerInfo.totalMonthlyFee || 0) > 0 && (() => {
              const currentMonthObj = getPayerMonthLabel(payerInfo.month, 0);
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase text-slate-500">
                      Monthly Pay / Bisha &amp; Bilaha Hormarinta (Advance)
                    </label>
                    {monthsToPay > 1 ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        {monthsToPay - 1} Month{monthsToPay > 2 ? 's' : ''} Advance
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {currentMonthObj.name} (Current Month)
                      </span>
                    )}
                  </div>
                  <select
                    value={monthsToPay}
                    onChange={(e) => setMonthsToPay(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6].map((m) => {
                      const targetObj = getPayerMonthLabel(payerInfo.month, m - 1);
                      const amountForM = m === 1
                        ? Number(payerInfo.totalBalance || 0)
                        : Number(payerInfo.totalMonthlyFee || 0) * (m - 1);
                      return (
                        <option key={m} value={m}>
                          {m === 1
                            ? `${currentMonthObj.name} ${currentMonthObj.year} (Current Month) · ${fmtMoney(amountForM)}`
                            : `${targetObj.name} ${targetObj.year} (Advance · ${m - 1} bilood oo hormarin ah) · ${fmtMoney(amountForM)}`}
                        </option>
                      );
                    })}
                  </select>

                  {/* Advance breakdown detail card when monthsToPay > 1 */}
                  {monthsToPay > 1 && (
                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 text-xs space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between font-black text-amber-900 dark:text-amber-200">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Lacagta Hormarinta ah ({monthsToPay - 1} bilood):
                        </span>
                        <span>Wadarta Advance: {fmtMoney(maxPayable)}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {Array.from({ length: monthsToPay - 1 }).map((_, idx) => {
                          const mo = getPayerMonthLabel(payerInfo.month, idx + 1);
                          const moAmount = Number(payerInfo.totalMonthlyFee || 0);
                          return (
                            <div
                              key={idx}
                              className="px-3 py-2 rounded-lg border bg-amber-100/70 dark:bg-amber-900/40 border-amber-300 dark:border-amber-800 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-black text-slate-900 dark:text-white">{mo.name}</span>
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                                  Advance
                                </span>
                              </div>
                              <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">
                                {fmtMoney(moAmount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                        * Bisha/bilaha mustaqbalka (tusaale {getPayerMonthLabel(payerInfo.month, 1).name}) marka la gaaro, system-ku wuxuu si toos ah u ogaanayaa in horay loo hormariyay (Amount = $0).
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Bisha lacagta loo hormarinayo / bixinayo — For Expense / Registered non-payers (Teachers, Staff, Rent, Accounts) */}
            {walletDirection === 'sender' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase text-slate-500">
                    Bisha lacagta loo hormarinayo / bixinayo (Target Month)
                  </label>
                  {(transactionForm.targetMonth || currentMonthStr) > currentMonthStr && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      Hormarin (Advance)
                    </span>
                  )}
                </div>
                <select
                  value={transactionForm.targetMonth || currentMonthStr}
                  onChange={(e) => handleTargetMonthChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Dooro bisha lacagta loo bixinayo ama loo hormarinayo. Marka bisha la doorto, Amount-ku si toos ah ayuu u noqonayaa inta bishaas ku hartay.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                max={maxPayable !== null ? maxPayable : undefined}
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-lg font-black"
              />
              {payerInfo && payerInfo.kind === 'responsible' && maxPayable !== null && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                  Max payable for {monthsToPay} month{monthsToPay > 1 ? 's' : ''}: {fmtMoney(maxPayable)}. The payer cannot pay more than they owe.
                </p>
              )}
            </div>

            {payerInfo && payerInfo.kind === 'staff' && (
              <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/30 p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                    Diiwaanka Qofka · {payerInfo.role || 'Macallin / Shaqaale'}
                  </p>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    (transactionForm.targetMonth || payerInfo.month) > currentMonthStr
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300'
                  }`}>
                    Bisha: {transactionForm.targetMonth || payerInfo.month} {(transactionForm.targetMonth || payerInfo.month) > currentMonthStr ? '· Hormarin' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Mushaharka Bisha</p>
                    <p className="text-xl font-black text-brand-600 dark:text-brand-300">{fmtMoney(payerInfo.salary)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Horay loo bixiyay ({transactionForm.targetMonth || payerInfo.month})</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmtMoney(payerInfo.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Hadda ku hartay (Remaining)</p>
                    <p className={`text-xl font-black ${Number(payerInfo.remainingBalance ?? payerInfo.totalBalance) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {Number(payerInfo.remainingBalance ?? payerInfo.totalBalance) > 0 ? fmtMoney(payerInfo.remainingBalance ?? payerInfo.totalBalance) : 'Fully Paid ($0)'}
                    </p>
                  </div>
                </div>

                {payerInfo.totalBalance === 0 && Number(payerInfo.salary || 0) > 0 && (transactionForm.targetMonth || payerInfo.month) <= currentMonthStr && (
                  <div className="pt-3 border-t border-brand-200/70 dark:border-brand-800/70 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-brand-700 dark:text-brand-300 font-semibold">
                      Bisha hadda waa la wada bixiyay ($0 haraa). Ma rabtaa inaad u hormariso bisha soo socota?
                    </p>
                    {monthOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleTargetMonthChange(monthOptions[1].value)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black tracking-wide shadow-sm"
                      >
                        + Hormari Bisha Soo Socota ({monthOptions[1].monthName} · {fmtMoney(payerInfo.salary)})
                      </button>
                    )}
                  </div>
                )}

                {payerInfo.lastSalary && (
                  <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Mushaharkii ugu dambeeyay:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {fmtMoney(payerInfo.lastSalary.amount)} ({payerInfo.lastSalary.month}) · {payerInfo.lastSalary.status}
                    </span>
                  </div>
                )}
              </div>
            )}

            {payerInfo && (payerInfo.kind === 'account' || payerInfo.kind === 'contact') && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Diiwaanka Account-ka / Kiro · {payerInfo.name}
                  </p>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    (transactionForm.targetMonth || payerInfo.month) > currentMonthStr
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    Bisha: {transactionForm.targetMonth || payerInfo.month} {(transactionForm.targetMonth || payerInfo.month) > currentMonthStr ? '· Hormarin' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Lacagta Guud (Total/Balance)</p>
                    <p className="text-xl font-black text-slate-700 dark:text-slate-200">{fmtMoney(payerInfo.baseBalance ?? payerInfo.totalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Horay loo bixiyay ({transactionForm.targetMonth || payerInfo.month})</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmtMoney(payerInfo.paidThisMonth || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Hadda ku hartay (Remaining)</p>
                    <p className={`text-xl font-black ${Number(payerInfo.remainingBalance ?? payerInfo.totalBalance) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {Number(payerInfo.remainingBalance ?? payerInfo.totalBalance) > 0 ? fmtMoney(payerInfo.remainingBalance ?? payerInfo.totalBalance) : 'Fully Paid ($0)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {payerInfo && payerInfo.kind === 'responsible' && payerInfo.count > 0 && (() => {
              const entered = Number(transactionForm.amount) || 0;
              // What will still be owed after the amount currently in the form is paid.
              const remainingAfter = Math.max(0, payerInfo.totalBalance - entered);
              const isPartial = entered > 0 && entered < payerInfo.totalBalance;
              return (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    {transactionForm.senderName ? `${transactionForm.senderName} · ` : ''}Responsible payer
                  </p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {payerInfo.count} student{payerInfo.count === 1 ? '' : 's'} · {payerInfo.month}
                  </span>
                </div>

                {/* Money summary — total fee, paid, remaining. */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-emerald-100 dark:border-emerald-900/50 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total fee</p>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-100">{fmtMoney(payerInfo.totalMonthlyFee)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-emerald-100 dark:border-emerald-900/50 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paid ({payerInfo.month})</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmtMoney(payerInfo.totalPaid)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-emerald-100 dark:border-emerald-900/50 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Remaining</p>
                    <p className="text-xl font-black text-rose-600 dark:text-rose-400">{fmtMoney(payerInfo.totalBalance)}</p>
                  </div>
                </div>

                {/* Progress bar of paid vs. total fee. */}
                {payerInfo.totalMonthlyFee > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      <span>Collected {fmtMoney(payerInfo.totalPaid)}</span>
                      <span>{Math.round((payerInfo.totalPaid / payerInfo.totalMonthlyFee) * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, (payerInfo.totalPaid / payerInfo.totalMonthlyFee) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Per-student remaining money table. */}
                {Array.isArray(payerInfo.students) && payerInfo.students.length > 0 && (
                  <div className="mt-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 overflow-hidden bg-white/70 dark:bg-slate-900/50">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-emerald-100 dark:border-emerald-900/50">
                          <th className="px-4 py-2">Student</th>
                          <th className="px-4 py-2 text-right">Fee</th>
                          <th className="px-4 py-2 text-right">Paid</th>
                          <th className="px-4 py-2 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50 dark:divide-emerald-900/30">
                        {payerInfo.students.map((s) => (
                          <tr key={s.studentId}>
                            <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-100">{s.name}</td>
                            <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{fmtMoney(s.monthlyFee)}</td>
                            <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{fmtMoney(s.totalPaid)}</td>
                            <td className={`px-4 py-2 text-right font-black ${s.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                              {fmtMoney(s.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-emerald-200 dark:border-emerald-800 font-black text-slate-900 dark:text-white">
                          <td className="px-4 py-2 uppercase text-[10px] text-slate-500">Total</td>
                          <td className="px-4 py-2 text-right">{fmtMoney(payerInfo.totalMonthlyFee)}</td>
                          <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{fmtMoney(payerInfo.totalPaid)}</td>
                          <td className="px-4 py-2 text-right text-rose-600 dark:text-rose-400">{fmtMoney(payerInfo.totalBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {isPartial && (
                  <p className="mt-3 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    Partial payment — {fmtMoney(remainingAfter)} will still be owed and can be paid another day.
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {payerInfo.totalBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setTransactionForm((prev) => ({ ...prev, amount: payerInfo.totalBalance }))}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-wider"
                    >
                      Pay full remaining ({fmtMoney(payerInfo.totalBalance)})
                    </button>
                  )}
                  {payerInfo.totalBalance > 0 && entered > 0 && entered !== payerInfo.totalBalance && (
                    <button
                      type="button"
                      onClick={() => setTransactionForm((prev) => ({ ...prev, amount: '' }))}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-500 text-[11px] font-black uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Clear amount
                    </button>
                  )}
                </div>
              </div>
              );
            })()}

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Description</label>
              <textarea
                rows={2}
                value={transactionForm.description}
                onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="Notes about this payment or expense"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={categories.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider"
              >
                <Save size={16} /> {editingEntry ? 'Update transaction' : 'Save transaction'}
              </button>
              {editingEntry && (
                <button
                  type="button"
                  onClick={resetTransactionForm}
                  className="flex items-center gap-2 px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs uppercase text-slate-600 dark:text-slate-300"
                >
                  <RotateCcw size={16} /> Cancel edit
                </button>
              )}
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search size={16} className="text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter transactions</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setFilterCategory('All');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="All">All types</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="All">All categories</option>
                  {filterCategoryOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title} · {c.type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">From date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">To date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setDateFrom(today);
                  setDateTo(today);
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-black uppercase tracking-wider"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider"
              >
                All dates
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('All');
                  setFilterCategory('All');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider"
              >
                Reset
              </button>
              <span className="ml-auto text-[11px] font-bold text-slate-400">
                {filteredEntries.length} result{filteredEntries.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Category</th>
                    <th className="px-6 py-5">Type</th>
                    <th className="px-6 py-5">Payer</th>
                    <th className="px-6 py-5">Sender</th>
                    <th className="px-6 py-5">Receiver</th>
                    <th className="px-6 py-5">Method</th>
                    <th className="px-6 py-5 text-right">Amount</th>
                    <th className="px-6 py-5 text-right">Remaining</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEntries.map((item) => {
                    const cat = item.categoryId;
                    const isIncome = cat?.type === 'Income';
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="px-6 py-5 text-sm text-slate-500 whitespace-nowrap">
                          {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-slate-900 dark:text-white">
                          {cat?.title || '—'}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {cat?.type || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {item.senderName || '—'}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-500 whitespace-nowrap">{item.senderPhone || '—'}</td>
                        <td className="px-6 py-5 text-sm text-slate-500 whitespace-nowrap">{item.receiverPhone || '—'}</td>
                        <td className="px-6 py-5 text-sm text-slate-500">{item.method}</td>
                        <td
                          className={`px-6 py-5 text-sm font-black text-right whitespace-nowrap ${
                            isIncome ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isIncome ? '+' : '−'}{fmtMoney(item.amount)}
                        </td>
                        <td className="px-6 py-5 text-sm font-black text-right whitespace-nowrap">
                          {item.feeRemaining != null ? (
                            <span className={item.feeRemaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              ${fmtMoney(item.feeRemaining)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleTransactionEdit(item)}
                              className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 hover:text-brand-600"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTransactionDelete(item)}
                              className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 hover:text-rose-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-8 py-10 text-center text-slate-400 text-sm">
                        No transactions yet. Record income, expenses, fees, salaries, and more here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashbookManagement;
