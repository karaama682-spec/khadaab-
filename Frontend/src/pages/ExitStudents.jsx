import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, Search, User as UserIcon, DollarSign, CalendarCheck, ClipboardList, Receipt, ArrowLeft, Building2 } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
const fmtDMY = (iso) => {
  if (!iso || typeof iso !== 'string') return iso ? new Date(iso).toLocaleDateString() : '—';
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : iso;
};
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const ExitStudents = () => {
  const { showAlert } = useAlert();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [archive, setArchive] = useState(null);
  const [loadingArchive, setLoadingArchive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/students', { params: { status: 'Exited' } });
        if (!cancelled) setStudents(data || []);
      } catch (error) {
        console.error('Failed to load exited students', error);
        showAlert({ type: 'danger', title: 'Unable to load', message: 'Could not load exited students.' });
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
      showAlert({ type: 'danger', title: 'Unable to load', message: 'Could not load this student’s history.' });
      setSelectedId(null);
    } finally {
      setLoadingArchive(false);
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

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Exit Students...</div>;

  // ---- Detail (archive) view ----
  if (selectedId) {
    const s = archive?.student;
    const fin = archive?.financial || {};
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6 pb-24 animate-in fade-in duration-500">
        <button onClick={() => { setSelectedId(null); setArchive(null); }} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-white">
          <ArrowLeft size={16} /> Back to Exit Students
        </button>

        {loadingArchive || !archive ? (
          <div className="p-10 text-center text-slate-400">Loading history…</div>
        ) : (
          <>
            {/* Profile + exit info */}
            <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"><UserIcon size={26} /></div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">{s.fullName}</h1>
                    <p className="text-xs font-bold text-slate-400 font-mono">ID: {s.studentCode || s.rollNumber || '—'}</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Exited</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                <Info label="Class" value={classLabel(s.classId, '—')} />
                <Info label="Branch" value={s.classId?.branchId?.name || s.branchId?.name || '—'} />
                <Info label="Father" value={s.fatherName || '—'} />
                <Info label="Father Phone" value={s.fatherPhone || '—'} />
                <Info label="Exit Date" value={fmtDate(archive.exit?.exitDate)} />
                <Info label="Performed By" value={archive.exit?.exitedBy?.fullName || '—'} />
                <Info label="Exit Timestamp" value={archive.exit?.exitedAt ? new Date(archive.exit.exitedAt).toLocaleString() : '—'} />
                <Info label="Registered" value={fmtDate(s.registrationDate)} />
              </div>
              {archive.exit?.exitReason ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400">Exit Reason / Description</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{archive.exit.exitReason}</p>
                </div>
              ) : null}
            </section>

            {/* Financials */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat icon={<DollarSign size={18} />} label="Registered Fee" value={money(fin.registeredFee)} tone="brand" />
              <Stat icon={<DollarSign size={18} />} label="Total Paid" value={money(fin.totalPaid)} tone="emerald" />
              <Stat icon={<DollarSign size={18} />} label="Remaining Balance" value={money(fin.remaining)} tone="rose" />
            </section>

            {/* Payment history */}
            <Panel icon={<Receipt size={18} />} title={`Payment History (${archive.payments?.length || 0})`}>
              {archive.payments?.length ? (
                <Table head={['Date', 'Month', 'Amount', 'Method', 'Status', 'Wallet']}
                  rows={archive.payments.map(p => [
                    fmtDate(p.paymentDate), p.month || '—', money(p.amount), p.paymentMethod || '—', p.status || '—', p.walletId?.name || '—'
                  ])} />
              ) : <Empty text="No payments recorded." />}
            </Panel>

            {/* Attendance history */}
            <Panel icon={<CalendarCheck size={18} />} title={`Attendance History (${archive.attendance?.length || 0})`}>
              {archive.attendance?.length ? (
                <Table head={['Date', 'Session', 'Status', 'Arrival', 'Class']}
                  rows={archive.attendance.map(a => [
                    fmtDMY(a.date), a.session || '—', a.status || '—', a.arrivalTime || '—', classLabel(a.classId, '—')
                  ])} />
              ) : <Empty text="No attendance records." />}
            </Panel>

            {/* Exam history */}
            <Panel icon={<ClipboardList size={18} />} title={`Academic / Exam History (${archive.examResults?.length || 0})`}>
              {archive.examResults?.length ? (
                <Table head={['Exam', 'Subjects', 'Total Marks', 'Remarks']}
                  rows={archive.examResults.map(r => [
                    r.examId?.name || r.examId?.title || '—',
                    (r.marks || []).length,
                    (r.marks || []).reduce((sum, m) => sum + (Number(m.marksObtained) || 0), 0),
                    r.remarks || '—'
                  ])} />
              ) : <Empty text="No exam records." />}
            </Panel>

            {/* Transactions */}
            <Panel icon={<Receipt size={18} />} title={`Transactions (${archive.transactions?.length || 0})`}>
              {archive.transactions?.length ? (
                <Table head={['Date', 'Type', 'Amount', 'Wallet', 'Description']}
                  rows={archive.transactions.map(t => [
                    fmtDate(t.date), t.type || '—', money(t.amount), t.walletId?.name || '—', t.description || '—'
                  ])} />
              ) : <Empty text="No linked transactions." />}
            </Panel>
          </>
        )}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-24 animate-in fade-in duration-500">
      <div className="flex items-center gap-5 px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-700 bg-slate-900 text-amber-400 shadow-2xl ring-4 ring-amber-400/10 dark:bg-slate-800"><LogOut size={30} strokeWidth={2.5} /></div>
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">Exit Students</h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Archived students — full history preserved, excluded from active workflows</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exited students by name or code…"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Exit Date</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(s => (
                <tr key={s._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{s.fullName}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-500 font-mono">{s.studentCode || s.rollNumber || '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{classLabel(s.classId, '—')}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{fmtDate(s.exitDate)}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{s.exitReason || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openArchive(s._id)} className="rounded-xl bg-amber-600 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white hover:bg-amber-700">View History</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                  {students.length === 0 ? 'No students have exited yet.' : 'No exited students match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
