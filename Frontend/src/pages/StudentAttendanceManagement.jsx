import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Building2, Calendar, CalendarCheck, CheckCircle2, Clock, Save, Search, Users } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';

const today = () => new Date().toISOString().split('T')[0];

const STATUSES = ['Present', 'Late', 'Absent'];

// Present is the default for every student, so a teacher only has to touch the
// students who are late or absent.
const defaultRow = () => ({ status: 'Present', arrivalTime: '', description: '' });

// A register already saved for this date and session reopens in the state it was
// saved in; every other student falls back to Present.
const buildRoster = (studentList, savedRecords) => {
  const savedByStudent = new Map();
  savedRecords.forEach(record => {
    savedByStudent.set(String(record.studentId?._id || record.studentId), record);
  });

  const roster = {};
  studentList.forEach(student => {
    const saved = savedByStudent.get(String(student._id));
    roster[student._id] = saved
      ? {
          status: saved.status || 'Present',
          arrivalTime: saved.arrivalTime || '',
          description: saved.description || ''
        }
      : defaultRow();
  });
  return roster;
};

const StudentAttendanceManagement = () => {
  const { showAlert } = useAlert();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [roster, setRoster] = useState({});
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedSession, setSelectedSession] = useState('Morning');
  const [branchSessionTimes, setBranchSessionTimes] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  // Student quick-search (by code or partial name) over the already-loaded
  // student list. Selecting a result jumps to that student's branch + class.
  const [studentSearch, setStudentSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightStudentId, setHighlightStudentId] = useState('');

  // Branches are derived from the classes already loaded (each class is populated
  // with its branch), so no extra request is needed for the branch filter.
  const branches = useMemo(() => {
    const map = new Map();
    classes.forEach(item => {
      const branch = item.branchId;
      if (branch && branch._id) map.set(String(branch._id), branch.name || 'Branch');
    });
    return [...map.entries()].map(([_id, name]) => ({ _id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  // Class dropdown honours the branch filter: "All Branches" shows every class.
  const visibleClasses = useMemo(
    () => selectedBranchId
      ? classes.filter(item => String(item.branchId?._id || item.branchId) === String(selectedBranchId))
      : classes,
    [classes, selectedBranchId]
  );

  // Search the existing students by code or (partial) name — no new data source.
  const searchResults = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter(s =>
        (s.fullName || '').toLowerCase().includes(q) ||
        String(s.studentCode || '').toLowerCase().includes(q) ||
        String(s.rollNumber || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [students, studentSearch]);

  // Selecting a found student jumps the existing form to that student's branch and
  // class (so the roster loads them) and highlights their row. The rest of the
  // attendance flow — Session, Arrived, Status — is unchanged.
  const handleSelectSearchedStudent = (student) => {
    const cls = classes.find(c => String(c._id) === String(student.classId?._id || student.classId));
    const branchId = cls?.branchId?._id || cls?.branchId || student.branchId?._id || student.branchId || '';
    if (branchId) setSelectedBranchId(String(branchId));
    if (student.classId) setSelectedClassId(String(student.classId?._id || student.classId));
    setHighlightStudentId(String(student._id));
    setStudentSearch(`${student.fullName} — ${student.studentCode || student.rollNumber || 'No code'}`);
    setShowSearchResults(false);
  };

  const selectedClass = classes.find(item => String(item._id) === String(selectedClassId));
  // The branch that owns the selected class — this is the branch whose session
  // times attendance for this class must use (requirement: use the student's
  // existing branch, never a global time).
  const currentBranchId = selectedClass?.branchId?._id || selectedClass?.branchId || '';
  const currentBranchName = selectedClass?.branchId?.name || branches.find(b => String(b._id) === String(currentBranchId))?.name || '';
  const currentSessionTime = branchSessionTimes[selectedSession] || '';

  const classStudents = useMemo(
    () => students
      .filter(student => String(student.classId?._id || student.classId) === String(selectedClassId))
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
    [students, selectedClassId]
  );

  const selectedClassName = classLabel(classes.find(item => String(item._id) === String(selectedClassId)), '');

  const summary = useMemo(() => {
    const counts = { Present: 0, Late: 0, Absent: 0 };
    classStudents.forEach(student => {
      const status = roster[student._id]?.status || 'Present';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [classStudents, roster]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [classResponse, studentResponse] = await Promise.all([api.get('/classes'), api.get('/students')]);
        setClasses(classResponse.data || []);
        setStudents(studentResponse.data || []);
      } catch (error) {
        console.error('Failed to load attendance data', error);
        showAlert({ type: 'danger', title: 'Unable to load attendance', message: 'Please refresh the page and try again.' });
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [showAlert]);

  // Selecting a class loads its students and marks them all Present, layering
  // any register already saved for this date and session on top.
  useEffect(() => {
    if (!selectedClassId) {
      setRoster({});
      return undefined;
    }

    let cancelled = false;
    const loadRoster = async () => {
      try {
        setLoadingRoster(true);
        const response = await api.get('/student-attendance', {
          params: { classId: selectedClassId, date: selectedDate, session: selectedSession }
        });
        if (cancelled) return;
        setRoster(buildRoster(classStudents, response.data || []));
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load attendance register', error);
        // The register stays usable after a read failure: everyone defaults to Present.
        setRoster(buildRoster(classStudents, []));
        showAlert({ type: 'danger', title: 'Unable to load saved records', message: 'Starting a fresh register with every student present.' });
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    };
    loadRoster();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedDate, selectedSession, classStudents, showAlert]);

  // If the branch filter changes and the chosen class no longer belongs to it,
  // clear the class selection so the register never shows another branch's class.
  useEffect(() => {
    if (selectedBranchId && selectedClass && String(selectedClass.branchId?._id || selectedClass.branchId) !== String(selectedBranchId)) {
      setSelectedClassId('');
    }
  }, [selectedBranchId, selectedClass]);

  // Load the branch-specific session times for the selected class's branch, so
  // the register shows this branch's configured time (e.g. Branch B Morning
  // 07:15), not a global one. Different branches load their own times.
  useEffect(() => {
    if (!currentBranchId) {
      setBranchSessionTimes({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/branch-sessions/${currentBranchId}`);
        if (cancelled) return;
        const map = {};
        (data || []).forEach(s => { map[s.name] = s.time; });
        setBranchSessionTimes(map);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load branch session times', error);
        setBranchSessionTimes({});
      }
    })();
    return () => { cancelled = true; };
  }, [currentBranchId]);

  const setStatus = useCallback((studentId, status) => {
    setRoster(previous => {
      const current = previous[studentId] || defaultRow();
      return {
        ...previous,
        [studentId]: {
          status,
          // Marking a student Late pre-fills Arrived with the selected branch/
          // session's scheduled time (e.g. Morning 06:30); the user can then edit
          // it to the actual arrival. Returning to Present clears it.
          arrivalTime: status === 'Late' ? (current.arrivalTime || currentSessionTime) : '',
          description: status === 'Present' ? '' : current.description
        }
      };
    });
  }, [currentSessionTime]);

  const setField = useCallback((studentId, field, value) => {
    setRoster(previous => ({
      ...previous,
      [studentId]: { ...(previous[studentId] || defaultRow()), [field]: value }
    }));
  }, []);

  const saveRegister = async () => {
    if (!classStudents.length) return;

    const payload = classStudents.map(student => {
      const row = roster[student._id] || defaultRow();
      return {
        studentId: student._id,
        classId: selectedClassId,
        date: selectedDate,
        session: selectedSession,
        status: row.status,
        arrivalTime: row.status === 'Late' ? (row.arrivalTime || currentSessionTime) : '',
        description: row.status === 'Present' ? '' : (row.description || '').trim()
      };
    });

    try {
      setSaving(true);
      const response = await api.post('/student-attendance', payload);
      setRoster(buildRoster(classStudents, response.data || []));
      showAlert({
        type: 'success',
        title: 'Attendance saved',
        message: `${summary.Present} present, ${summary.Late} late, ${summary.Absent} absent recorded for ${selectedClassName || 'this class'}.`
      });
    } catch (error) {
      console.error('Failed to save attendance register', error);
      showAlert({ type: 'danger', title: 'Could not save attendance', message: error.response?.data?.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const statusStyles = {
    Present: { active: 'bg-emerald-600 text-white shadow-md', idle: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10' },
    Late: { active: 'bg-amber-500 text-white shadow-md', idle: 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10' },
    Absent: { active: 'bg-rose-600 text-white shadow-md', idle: 'text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10' }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Student Attendance...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-24 animate-in fade-in duration-700">
      <div className="flex items-center gap-5 px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-700 bg-slate-900 text-brand-400 shadow-2xl ring-4 ring-brand-400/10 dark:bg-slate-800"><CalendarCheck size={32} strokeWidth={2.5} /></div>
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">Student Attendance</h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Everyone is present by default — change only late or absent</p>
        </div>
      </div>

      {/* Quick student search — find by Student ID/Code or (partial) name, then
          jump straight to that student's branch + class to take attendance. */}
      <section className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><Search size={14} className="text-brand-500" /> Search Student (ID / Code or Name)</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={studentSearch}
            onChange={event => { setStudentSearch(event.target.value); setShowSearchResults(true); setHighlightStudentId(''); }}
            onFocus={() => setShowSearchResults(true)}
            placeholder="e.g. 1001 or Mustaf"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {showSearchResults && searchResults.length > 0 && (
            <div
              onMouseDown={event => event.preventDefault()}
              className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {searchResults.map(student => (
                <button
                  key={student._id}
                  type="button"
                  onClick={() => handleSelectSearchedStudent(student)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{student.fullName}</span>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">Code: {student.studentCode || student.rollNumber || '—'}</span>
                </button>
              ))}
            </div>
          )}
          {showSearchResults && studentSearch.trim() && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-400 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              No student found matching "{studentSearch.trim()}".
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2 xl:grid-cols-4">
        <div><label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><Building2 size={14} className="text-indigo-500" /> Branch</label><select value={selectedBranchId} onChange={event => setSelectedBranchId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">All Branches</option>{branches.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div>
        <div><label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><BookOpen size={14} className="text-brand-500" /> Class</label><select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Select class...</option>{visibleClasses.map(item => <option key={item._id} value={item._id}>{classLabel(item)}</option>)}</select></div>
        <div><label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><Calendar size={14} className="text-emerald-500" /> Date</label><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
        <div><label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><Clock size={14} className="text-amber-500" /> Session</label><select value={selectedSession} onChange={event => setSelectedSession(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="Morning">Morning</option><option value="Breakfast">Breakfast</option><option value="Evening">Evening</option></select></div>
      </section>

      {!selectedClassId && (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Users className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="text-sm font-bold text-slate-500">Select a class to load its students.</p>
        </div>
      )}

      {selectedClassId && (
        <section className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-brand-500" size={20} />
              <div>
                <h2 className="font-black text-slate-900 dark:text-white">Class register{selectedClassName ? ` — ${selectedClassName}` : ''}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{classStudents.length} student{classStudents.length === 1 ? '' : 's'} · {selectedDate} · {selectedSession}{currentSessionTime ? ` @ ${currentSessionTime}` : ''}{currentBranchName ? ` · ${currentBranchName}` : ''}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">{summary.Present} Present</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{summary.Late} Late</span>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black uppercase text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">{summary.Absent} Absent</span>
            </div>
          </div>

          {loadingRoster ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">Loading students...</div>
          ) : !classStudents.length ? (
            <div className="p-12 text-center text-sm font-semibold text-slate-400">No students are assigned to this class.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                    <th className="px-7 py-4">Student</th>
                    <th className="px-7 py-4">Status</th>
                    <th className="px-7 py-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {classStudents.map(student => {
                    const row = roster[student._id] || defaultRow();
                    const needsReason = row.status === 'Late' || row.status === 'Absent';
                    return (
                      <tr key={student._id} className={`align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/20 ${String(student._id) === String(highlightStudentId) ? 'bg-brand-50/70 dark:bg-brand-500/10 ring-2 ring-inset ring-brand-400/40' : ''}`}>
                        <td className="px-7 py-5">
                          <p className="font-bold text-slate-900 dark:text-white">{student.fullName}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">{student.rollNumber || student.studentCode || 'No ID'}</p>
                        </td>
                        <td className="px-7 py-5">
                          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                            {STATUSES.map(status => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setStatus(student._id, status)}
                                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${row.status === status ? statusStyles[status].active : statusStyles[status].idle}`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-7 py-5">
                          {needsReason ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={row.description}
                                onChange={event => setField(student._id, 'description', event.target.value)}
                                placeholder={row.status === 'Late' ? 'Late because...' : 'Reason for absence...'}
                                className="w-full min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                              {row.status === 'Late' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Arrived</span>
                                  <input
                                    type="time"
                                    value={row.arrivalTime || currentSessionTime}
                                    onChange={event => setField(student._id, 'arrivalTime', event.target.value)}
                                    className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 outline-none dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!!classStudents.length && !loadingRoster && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-5 dark:border-slate-800">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Leave present students untouched — only late and absent need a description.
              </p>
              <button
                type="button"
                onClick={saveRegister}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} strokeWidth={3} /> {saving ? 'Saving...' : 'Save attendance'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default StudentAttendanceManagement;
