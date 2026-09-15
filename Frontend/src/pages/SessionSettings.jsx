import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Building2, Save, Sun, Coffee, Sunset } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';

// The three sessions are the same for every branch; only their times differ per
// branch. Names are fixed here to match the backend enum.
const SESSION_ORDER = ['Morning', 'Breakfast', 'Evening'];
const SESSION_ICON = { Morning: Sun, Breakfast: Coffee, Evening: Sunset };

const SessionSettings = () => {
  const { showAlert } = useAlert();
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [times, setTimes] = useState({ Morning: '', Breakfast: '', Evening: '' });
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedBranchName = useMemo(
    () => branches.find(b => String(b._id) === String(selectedBranchId))?.name || '',
    [branches, selectedBranchId]
  );

  // Load branches once. Pre-select the first branch so times appear immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/branches');
        if (cancelled) return;
        const list = data || [];
        setBranches(list);
        if (list.length) setSelectedBranchId(String(list[0]._id));
      } catch (error) {
        console.error('Failed to load branches', error);
        showAlert({ type: 'danger', title: 'Unable to load branches', message: 'Please refresh and try again.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showAlert]);

  // Selecting a branch loads that branch's own session times (backend auto-seeds
  // defaults for a branch that has none yet).
  const loadSessions = useCallback(async (branchId) => {
    if (!branchId) return;
    try {
      setLoadingSessions(true);
      const { data } = await api.get(`/branch-sessions/${branchId}`);
      const next = { Morning: '', Breakfast: '', Evening: '' };
      (data || []).forEach(s => { if (next[s.name] !== undefined) next[s.name] = s.time; });
      setTimes(next);
    } catch (error) {
      console.error('Failed to load session times', error);
      showAlert({ type: 'danger', title: 'Unable to load session times', message: 'Please try selecting the branch again.' });
    } finally {
      setLoadingSessions(false);
    }
  }, [showAlert]);

  useEffect(() => { loadSessions(selectedBranchId); }, [selectedBranchId, loadSessions]);

  const handleSave = async () => {
    if (!selectedBranchId) {
      showAlert({ type: 'warning', title: 'Select a branch', message: 'Choose a branch before saving.' });
      return;
    }
    // These times belong ONLY to the selected branch.
    try {
      setSaving(true);
      await api.put(`/branch-sessions/${selectedBranchId}`, {
        Morning: times.Morning,
        Breakfast: times.Breakfast,
        Evening: times.Evening
      });
      showAlert({
        type: 'success',
        title: 'Session times saved',
        message: `Updated for ${selectedBranchName || 'this branch'}. Other branches are unchanged.`
      });
    } catch (error) {
      console.error('Failed to save session times', error);
      showAlert({
        type: 'danger',
        title: 'Could not save session times',
        message: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Session Settings...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 pb-24 animate-in fade-in duration-700">
      <div className="flex items-center gap-5 px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-700 bg-slate-900 text-brand-400 shadow-2xl ring-4 ring-brand-400/10 dark:bg-slate-800"><Clock size={32} strokeWidth={2.5} /></div>
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">Session Settings</h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Set attendance session times per branch — names are shared, times are branch-specific</p>
        </div>
      </div>

      {!branches.length ? (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Building2 className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="text-sm font-bold text-slate-500">No branches yet. Create a branch first, then set its session times here.</p>
        </div>
      ) : (
        <section className="space-y-6 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><Building2 size={14} className="text-brand-500" /> Branch</label>
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <span>Session</span><span>Time</span>
            </div>
            {loadingSessions ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-400">Loading session times...</div>
            ) : (
              SESSION_ORDER.map(name => {
                const Icon = SESSION_ICON[name];
                return (
                  <div key={name} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 dark:border-slate-800">
                    <span className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><Icon size={16} className="text-amber-500" /> {name}</span>
                    <input
                      type="time"
                      value={times[name] || ''}
                      onChange={e => setTimes(prev => ({ ...prev, [name]: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loadingSessions}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </section>
      )}
    </div>
  );
};

export default SessionSettings;
