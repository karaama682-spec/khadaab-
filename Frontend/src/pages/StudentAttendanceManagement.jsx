import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Calendar, CalendarCheck, CheckCircle2, Clock, Save, Users } from 'lucide-react';
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
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedSession, setSelectedSession] = useState('Morning');
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const setStatus = useCallback((studentId, status) => {
    setRoster(previous => {
      const current = previous[studentId] || defaultRow();
      return {
        ...previous,
        [studentId]: {
          status,
          // Returning a student to Present drops the reason and the arrival time.
          arrivalTime: status === 'Late' ? (current.arrivalTime || '08:30') : '',
          description: status === 'Present' ? '' : current.description
        }
      };
    });
  }, []);

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
        arrivalTime: row.status === 'Late' ? (row.arrivalTime || '08:30') : '',
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

      <section className="grid grid-cols-1 gap-5 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
        <div><label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500"><BookOpen size={14} className="text-brand-500" /> Class</label><select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Select class...</option>{classes.map(item => <option key={item._id} value={item._id}>{classLabel(item)}</option>)}</select></div>
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
                <p className="mt-1 text-xs font-semibold text-slate-500">{classStudents.length} student{classStudents.length === 1 ? '' : 's'} · {selectedDate} · {selectedSession}</p>
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
                      <tr key={student._id} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
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
                                    value={row.arrivalTime || '08:30'}
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
