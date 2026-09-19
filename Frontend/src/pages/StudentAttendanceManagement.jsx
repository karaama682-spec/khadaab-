import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coffee,
  Lock,
  Pencil,
  Save,
  Search,
  Sun,
  Sunset,
  Trash2,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';

const today = () => new Date().toISOString().split('T')[0];

const SESSIONS = ['Morning', 'Breakfast', 'Evening'];
const SESSION_ICONS = { Morning: Sun, Breakfast: Coffee, Evening: Sunset };

const defaultDailyRow = () => ({ status: 'Present', description: '', isSaved: false, _id: null });
const defaultSessionRow = (defaultTime = '') => ({
  status: 'Late',
  arrivalTime: defaultTime,
  description: '',
  isSaved: false,
  _id: null
});

const StudentAttendanceManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedSession, setSelectedSession] = useState('Morning');
  const [branchSessionTimes, setBranchSessionTimes] = useState({});

  // Daily attendance state: keyed by studentId -> { status: 'Present'|'Absent', description, isSaved, _id }
  const [dailyRoster, setDailyRoster] = useState({});

  // Session attendance state: keyed by `${studentId}:${session}` -> { status: 'Late'|'Partial', arrivalTime, description, isSaved, _id }
  const [sessionRecords, setSessionRecords] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingDailyBatch, setSavingDailyBatch] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [deletingStudentId, setDeletingStudentId] = useState(null);
  const [savedSuccessId, setSavedSuccessId] = useState(null);

  // Search state
  const [studentSearch, setStudentSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchedStudentId, setSelectedSearchedStudentId] = useState('');
  const searchContainerRef = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Branches derived from loaded classes
  const branches = useMemo(() => {
    const map = new Map();
    classes.forEach(item => {
      const branch = item.branchId;
      if (branch && branch._id) map.set(String(branch._id), branch.name || 'Branch');
    });
    return [...map.entries()].map(([_id, name]) => ({ _id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  // Classes filtered by selected branch
  const visibleClasses = useMemo(
    () => selectedBranchId
      ? classes.filter(item => String(item.branchId?._id || item.branchId) === String(selectedBranchId))
      : classes,
    [classes, selectedBranchId]
  );

  const selectedClass = classes.find(item => String(item._id) === String(selectedClassId));
  const selectedClassName = classLabel(selectedClass, '');
  const currentBranchId = selectedClass?.branchId?._id || selectedClass?.branchId || '';
  const currentBranchName = selectedClass?.branchId?.name || branches.find(b => String(b._id) === String(currentBranchId))?.name || '';
  const currentSessionTime = branchSessionTimes[selectedSession] || '';

  // Students belonging to selected class
  const classStudents = useMemo(
    () => students
      .filter(student => String(student.classId?._id || student.classId) === String(selectedClassId))
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
    [students, selectedClassId]
  );

  // Global search over all students for quick jumping
  const searchSuggestions = useMemo(() => {
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

  // Select student from search dropdown
  const handleSelectSearchedStudent = (student) => {
    const cls = classes.find(c => String(c._id) === String(student.classId?._id || student.classId));
    const branchId = cls?.branchId?._id || cls?.branchId || student.branchId?._id || student.branchId || '';
    if (branchId) setSelectedBranchId(String(branchId));
    if (student.classId) setSelectedClassId(String(student.classId?._id || student.classId));
    setSelectedSearchedStudentId(String(student._id));
    setStudentSearch(`${student.fullName} — ${student.studentCode || student.rollNumber || 'No code'}`);
    setShowSearchResults(false);
  };

  const clearStudentSearch = () => {
    setStudentSearch('');
    setSelectedSearchedStudentId('');
    setShowSearchResults(false);
  };

  // Filtered students for display
  const displayedStudents = useMemo(() => {
    if (!selectedClassId) return [];
    if (selectedSearchedStudentId) {
      const matched = classStudents.filter(s => String(s._id) === String(selectedSearchedStudentId));
      if (matched.length) return matched;
    }
    const q = studentSearch.trim().toLowerCase();
    if (q) {
      return classStudents.filter(s =>
        (s.fullName || '').toLowerCase().includes(q) ||
        String(s.studentCode || '').toLowerCase().includes(q) ||
        String(s.rollNumber || '').toLowerCase().includes(q)
      );
    }
    return classStudents;
  }, [classStudents, selectedClassId, selectedSearchedStudentId, studentSearch]);

  // Is an individual student specifically isolated in search view?
  const isIndividualStudentView = useMemo(() => {
    return Boolean(selectedSearchedStudentId) || (Boolean(studentSearch.trim()) && displayedStudents.length === 1);
  }, [selectedSearchedStudentId, studentSearch, displayedStudents.length]);

  const activeIndividualStudent = isIndividualStudentView && displayedStudents.length === 1 ? displayedStudents[0] : null;

  // Daily attendance summary counts for the class
  const dailySummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    classStudents.forEach(student => {
      const row = dailyRoster[student._id] || defaultDailyRow();
      if (row.status === 'Absent') absent += 1;
      else present += 1;
    });
    return { present, absent, total: classStudents.length };
  }, [classStudents, dailyRoster]);

  // Initial load: classes and students
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [classResponse, studentResponse] = await Promise.all([api.get('/classes'), api.get('/students')]);
        setClasses(classResponse.data || []);
        setStudents(studentResponse.data || []);
      } catch (error) {
        console.error('Failed to load attendance data', error);
        showAlert({ type: 'danger', title: 'Unable to load data', message: 'Please refresh the page and try again.' });
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [showAlert]);

  // Load branch session times when class changes
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

  // Load attendance records for the selected class and date
  useEffect(() => {
    if (!selectedClassId) {
      setDailyRoster({});
      setSessionRecords({});
      return undefined;
    }

    let cancelled = false;
    const loadAttendance = async () => {
      try {
        setLoadingRoster(true);
        const response = await api.get('/student-attendance', {
          params: { classId: selectedClassId, date: selectedDate }
        });
        if (cancelled) return;

        const records = response.data || [];
        const nextDaily = {};
        const nextSessions = {};

        // Populate default Daily for all class students (everyone starts Present)
        classStudents.forEach(student => {
          nextDaily[student._id] = defaultDailyRow();
        });

        records.forEach(rec => {
          const sId = String(rec.studentId?._id || rec.studentId);
          const isDaily = rec.attendanceType === 'Daily' || (!rec.session && (rec.status === 'Present' || rec.status === 'Absent'));

          if (isDaily) {
            nextDaily[sId] = {
              _id: rec._id,
              status: rec.status === 'Absent' ? 'Absent' : 'Present',
              description: rec.description || '',
              isSaved: true
            };
          } else {
            const sess = rec.session || 'Morning';
            const key = `${sId}:${sess}`;
            nextSessions[key] = {
              _id: rec._id,
              session: sess,
              status: rec.status === 'Partial' ? 'Partial' : 'Late',
              arrivalTime: rec.arrivalTime || '',
              description: rec.description || '',
              isSaved: true
            };
          }
        });

        setDailyRoster(nextDaily);
        setSessionRecords(nextSessions);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load attendance records', error);
        const fallbackDaily = {};
        classStudents.forEach(student => {
          fallbackDaily[student._id] = defaultDailyRow();
        });
        setDailyRoster(fallbackDaily);
        setSessionRecords({});
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    };

    loadAttendance();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedDate, classStudents]);

  // Daily status setter
  const setDailyStatus = useCallback((studentId, status) => {
    setDailyRoster(prev => {
      const cur = prev[studentId] || defaultDailyRow();
      return {
        ...prev,
        [studentId]: {
          ...cur,
          status,
          description: status === 'Present' ? '' : cur.description
        }
      };
    });
  }, []);

  const setDailyDescription = useCallback((studentId, description) => {
    setDailyRoster(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || defaultDailyRow()),
        description
      }
    }));
  }, []);

  // Session attendance setter for individual student
  const setSessionStatus = useCallback((studentId, session, status) => {
    const key = `${studentId}:${session}`;
    setSessionRecords(prev => {
      const cur = prev[key] || defaultSessionRow(branchSessionTimes[session] || '');
      return {
        ...prev,
        [key]: {
          ...cur,
          session,
          status,
          arrivalTime: status === 'Late' ? (cur.arrivalTime || branchSessionTimes[session] || '08:30') : ''
        }
      };
    });
  }, [branchSessionTimes]);

  const setSessionField = useCallback((studentId, session, field, value) => {
    const key = `${studentId}:${session}`;
    setSessionRecords(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || defaultSessionRow(branchSessionTimes[session] || '')),
        session,
        [field]: value
      }
    }));
  }, [branchSessionTimes]);

  // 1. Save individual student Daily Attendance (Present / Absent)
  const saveDailySingle = async (studentId) => {
    const student = classStudents.find(s => String(s._id) === String(studentId));
    if (!student) return;

    const row = dailyRoster[studentId] || defaultDailyRow();
    const wasSaved = Boolean(row.isSaved);
    const payload = [{
      _id: row._id || undefined,
      studentId: student._id,
      classId: selectedClassId,
      date: selectedDate,
      attendanceType: 'Daily',
      status: row.status,
      description: row.status === 'Present' ? '' : (row.description || '').trim()
    }];

    try {
      setSavingStudentId(`daily-${studentId}`);
      const response = await api.post('/student-attendance', payload);
      const savedRecord = Array.isArray(response.data) ? response.data[0] : response.data;
      if (savedRecord) {
        setDailyRoster(prev => ({
          ...prev,
          [studentId]: {
            _id: savedRecord._id,
            status: savedRecord.status,
            description: savedRecord.description || '',
            isSaved: true
          }
        }));
      }
      setSavedSuccessId(`daily-${studentId}`);
      setTimeout(() => setSavedSuccessId(prev => (prev === `daily-${studentId}` ? null : prev)), 2500);
      showAlert({
        type: 'success',
        title: wasSaved ? 'Daily Attendance updated' : 'Daily Attendance saved',
        message: `${student.fullName}: recorded as ${row.status}.`
      });
    } catch (error) {
      console.error('Failed to save daily attendance', error);
      showAlert({
        type: 'danger',
        title: 'Could not save attendance',
        message: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setSavingStudentId(null);
    }
  };

  // 2. Delete individual student Daily Attendance
  const deleteDailySingle = async (studentId) => {
    const student = classStudents.find(s => String(s._id) === String(studentId));
    if (!student) return;

    const row = dailyRoster[studentId];
    if (!row?._id) return;

    const ok = await showConfirm({
      type: 'warning',
      title: 'Delete Daily Attendance?',
      message: `Are you sure you want to delete the daily attendance record for "${student.fullName}"?`,
      confirmText: 'Yes, delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    try {
      setDeletingStudentId(`daily-${studentId}`);
      await api.delete(`/student-attendance/${row._id}`);
      setDailyRoster(prev => ({
        ...prev,
        [studentId]: defaultDailyRow()
      }));
      showAlert({
        type: 'success',
        title: 'Daily Attendance removed',
        message: `Daily attendance for ${student.fullName} has been reset to unsaved.`
      });
    } catch (error) {
      console.error('Failed to delete daily attendance', error);
      showAlert({
        type: 'danger',
        title: 'Could not delete attendance',
        message: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setDeletingStudentId(null);
    }
  };

  // 3. Save Session Attendance (Late / Partial for Morning, Breakfast, Evening)
  const saveSessionSingle = async (studentId, sessionName) => {
    const student = classStudents.find(s => String(s._id) === String(studentId));
    if (!student) return;

    // Daily Absent Lock: If student's Daily Attendance is saved as Absent, prevent saving Session Attendance
    const dailyRow = dailyRoster[studentId];
    if (dailyRow?.isSaved && dailyRow?.status === 'Absent') {
      showAlert({
        type: 'danger',
        title: 'Session Attendance Locked',
        message: 'Student is marked as Absent for Daily Attendance. To record Session Attendance, change Daily Attendance to Present using Edit Daily.'
      });
      return;
    }

    const key = `${studentId}:${sessionName}`;
    const row = sessionRecords[key] || defaultSessionRow(branchSessionTimes[sessionName] || '');
    const wasSaved = Boolean(row.isSaved);

    const payload = [{
      studentId: student._id,
      classId: selectedClassId,
      date: selectedDate,
      attendanceType: 'Session',
      session: sessionName,
      status: row.status || 'Late',
      arrivalTime: row.status === 'Late' ? (row.arrivalTime || branchSessionTimes[sessionName] || '08:30') : '',
      description: (row.description || '').trim()
    }];

    try {
      setSavingStudentId(`session-${key}`);
      const response = await api.post('/student-attendance', payload);
      const savedRecord = Array.isArray(response.data) ? response.data[0] : response.data;
      if (savedRecord) {
        setSessionRecords(prev => ({
          ...prev,
          [key]: {
            _id: savedRecord._id,
            session: sessionName,
            status: savedRecord.status,
            arrivalTime: savedRecord.arrivalTime || '',
            description: savedRecord.description || '',
            isSaved: true
          }
        }));
      }
      setSavedSuccessId(`session-${key}`);
      setTimeout(() => setSavedSuccessId(prev => (prev === `session-${key}` ? null : prev)), 2500);
      showAlert({
        type: 'success',
        title: wasSaved ? `${sessionName} Attendance updated` : `${sessionName} Attendance saved`,
        message: `${student.fullName}: recorded as ${row.status} in ${sessionName}.`
      });
    } catch (error) {
      console.error('Failed to save session attendance', error);
      showAlert({
        type: 'danger',
        title: 'Could not save session attendance',
        message: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setSavingStudentId(null);
    }
  };

  // 4. Delete Session Attendance
  const deleteSessionSingle = async (studentId, sessionName) => {
    const student = classStudents.find(s => String(s._id) === String(studentId));
    if (!student) return;

    const key = `${studentId}:${sessionName}`;
    const row = sessionRecords[key];
    if (!row?._id) return;

    const ok = await showConfirm({
      type: 'warning',
      title: `Delete ${sessionName} Attendance?`,
      message: `Are you sure you want to delete the ${sessionName} attendance record for "${student.fullName}"? Daily Attendance will remain intact.`,
      confirmText: 'Yes, delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    try {
      setDeletingStudentId(`session-${key}`);
      await api.delete(`/student-attendance/${row._id}`);
      setSessionRecords(prev => ({
        ...prev,
        [key]: defaultSessionRow(branchSessionTimes[sessionName] || '')
      }));
      showAlert({
        type: 'success',
        title: `${sessionName} Attendance removed`,
        message: `${sessionName} record for ${student.fullName} has been deleted.`
      });
    } catch (error) {
      console.error('Failed to delete session attendance', error);
      showAlert({
        type: 'danger',
        title: 'Could not delete session attendance',
        message: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setDeletingStudentId(null);
    }
  };

  // 5. Batch Save Daily Attendance for all students in the class
  const saveBatchDaily = async () => {
    const targetStudents = displayedStudents.length ? displayedStudents : classStudents;
    if (!targetStudents.length) return;

    const payload = targetStudents.map(student => {
      const row = dailyRoster[student._id] || defaultDailyRow();
      return {
        _id: row._id || undefined,
        studentId: student._id,
        classId: selectedClassId,
        date: selectedDate,
        attendanceType: 'Daily',
        status: row.status,
        description: row.status === 'Present' ? '' : (row.description || '').trim()
      };
    });

    try {
      setSavingDailyBatch(true);
      const response = await api.post('/student-attendance', payload);
      const savedList = Array.isArray(response.data) ? response.data : [response.data];

      setDailyRoster(prev => {
        const next = { ...prev };
        savedList.forEach(rec => {
          if (!rec) return;
          const sId = String(rec.studentId?._id || rec.studentId);
          next[sId] = {
            _id: rec._id,
            status: rec.status,
            description: rec.description || '',
            isSaved: true
          };
        });
        return next;
      });

      const presentCount = targetStudents.filter(s => (dailyRoster[s._id]?.status || 'Present') === 'Present').length;
      const absentCount = targetStudents.filter(s => dailyRoster[s._id]?.status === 'Absent').length;
      showAlert({
        type: 'success',
        title: 'Daily Attendance saved',
        message: `${presentCount} present, ${absentCount} absent recorded for ${selectedClassName || 'this class'}.`
      });
    } catch (error) {
      console.error('Failed to save daily register', error);
      showAlert({
        type: 'danger',
        title: 'Could not save attendance',
        message: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setSavingDailyBatch(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm font-semibold text-slate-400">Loading Attendance System...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-24 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex items-center gap-5 px-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-700 bg-slate-900 text-brand-400 shadow-2xl ring-4 ring-brand-400/10 dark:bg-slate-800">
          <CalendarCheck size={32} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">
            Student Attendance
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Daily Attendance (Present | Absent) · Session Attendance (Late | Partial)
          </p>
        </div>
      </div>

      {/* Quick Student Search */}
      <section className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500">
          <Search size={14} className="text-brand-500" /> Search Student (ID / Code or Name)
        </label>
        <div className="relative" ref={searchContainerRef}>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={studentSearch}
            onChange={e => {
              setStudentSearch(e.target.value);
              setShowSearchResults(true);
              setSelectedSearchedStudentId('');
            }}
            onFocus={() => setShowSearchResults(true)}
            onKeyDown={e => {
              if (e.key === 'Escape') setShowSearchResults(false);
              else if (e.key === 'Enter' && searchSuggestions.length > 0) {
                e.preventDefault();
                handleSelectSearchedStudent(searchSuggestions[0]);
              }
            }}
            placeholder="Search by Student Name or Student ID/Code..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-11 text-sm font-bold text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {studentSearch && (
            <button
              type="button"
              onClick={clearStudentSearch}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
              title="Clear search and show all students"
            >
              <X size={16} />
            </button>
          )}
          {showSearchResults && searchSuggestions.length > 0 && (
            <div
              onMouseDown={e => e.preventDefault()}
              className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {searchSuggestions.map(student => (
                <button
                  key={student._id}
                  type="button"
                  onClick={() => handleSelectSearchedStudent(student)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{student.fullName}</span>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Code: {student.studentCode || student.rollNumber || '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {showSearchResults && studentSearch.trim() && searchSuggestions.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-400 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              No student found matching "{studentSearch.trim()}".
            </div>
          )}
        </div>
      </section>

      {/* Main Selectors: Branch, Class, Date */}
      <section className="grid grid-cols-1 gap-5 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500">
            <Building2 size={14} className="text-indigo-500" /> Branch
          </label>
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Branches</option>
            {branches.map(item => (
              <option key={item._id} value={item._id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500">
            <BookOpen size={14} className="text-brand-500" /> Class
          </label>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Select class...</option>
            {visibleClasses.map(item => (
              <option key={item._id} value={item._id}>{classLabel(item)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500">
            <Calendar size={14} className="text-emerald-500" /> Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
          </input>
        </div>
      </section>

      {/* No Class Selected Banner */}
      {!selectedClassId && (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Users className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="text-sm font-bold text-slate-500">Select a class to load its students.</p>
        </div>
      )}

      {/* Main Attendance Container */}
      {selectedClassId && (
        <>
          {/* VIEW 1: INDIVIDUAL SEARCHED STUDENT VIEW */}
          {isIndividualStudentView && activeIndividualStudent ? (
            <div className="space-y-6">
              {/* Filter Notice Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brand-50/70 p-5 border border-brand-200/80 dark:bg-brand-950/20 dark:border-brand-900/60">
                <div className="flex items-center gap-3">
                  <UserCheck className="text-brand-600 dark:text-brand-400" size={24} />
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {activeIndividualStudent.fullName}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      ID/Code: <span className="font-bold text-slate-700 dark:text-slate-300">{activeIndividualStudent.studentCode || activeIndividualStudent.rollNumber || '—'}</span> · Class: <span className="font-bold">{selectedClassName}</span> {currentBranchName && `(${currentBranchName})`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearStudentSearch}
                  className="rounded-2xl border border-brand-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-brand-700 shadow-sm hover:bg-brand-50 dark:border-brand-800 dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-slate-800 transition-all"
                >
                  Show all {classStudents.length} students
                </button>
              </div>

              {/* TWO INDEPENDENT ATTENDANCES CARDS */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 1. DAILY ATTENDANCE CARD (Present | Absent) */}
                {(() => {
                  const sId = activeIndividualStudent._id;
                  const row = dailyRoster[sId] || defaultDailyRow();
                  const isSavingThis = savingStudentId === `daily-${sId}`;
                  const isSavedSuccess = savedSuccessId === `daily-${sId}`;
                  const isDeletingThis = deletingStudentId === `daily-${sId}`;

                  return (
                    <div className="rounded-[32px] border border-slate-100 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                              Daily Attendance
                            </span>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white">
                              Present / Absent
                            </h4>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                            row.isSaved
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {row.isSaved ? 'Daily Saved' : 'Not Saved'}
                          </span>
                        </div>

                        <p className="mt-4 text-xs font-semibold text-slate-500">
                          Daily Attendance applies once per day for the entire day. It operates independently from sessions.
                        </p>

                        {/* Status Toggle Buttons: Present | Absent */}
                        <div className="mt-5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                            Daily Status
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setDailyStatus(sId, 'Present')}
                              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-all ${
                                row.status === 'Present'
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80'
                              }`}
                            >
                              <CheckCircle2 size={16} /> Present
                            </button>

                            <button
                              type="button"
                              onClick={() => setDailyStatus(sId, 'Absent')}
                              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-all ${
                                row.status === 'Absent'
                                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80'
                              }`}
                            >
                              <X size={16} /> Absent
                            </button>
                          </div>
                        </div>

                        {/* Absence Reason (if Absent) */}
                        {row.status === 'Absent' && (
                          <div className="mt-4 animate-in fade-in duration-300">
                            <label className="text-[10px] font-black uppercase tracking-wider text-rose-500 block mb-1.5">
                              Absence Reason
                            </label>
                            <input
                              type="text"
                              value={row.description}
                              onChange={e => setDailyDescription(sId, e.target.value)}
                              placeholder="e.g. Illness, family emergency..."
                              className="w-full rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-xs font-semibold text-slate-900 outline-none focus:border-rose-400 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-white"
                            />
                          </div>
                        )}
                      </div>

                      {/* Daily Actions: Save / Edit / Delete */}
                      <div className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800 flex items-center justify-end gap-2.5">
                        {row.isSaved ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveDailySingle(sId)}
                              disabled={isSavingThis || isDeletingThis}
                              className={`flex items-center gap-1.5 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                                isSavedSuccess
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                              } disabled:opacity-50`}
                            >
                              {isSavedSuccess ? (
                                <>
                                  <CheckCircle2 size={14} /> Updated
                                </>
                              ) : (
                                <>
                                  <Pencil size={14} /> {isSavingThis ? 'Saving...' : 'Edit Daily'}
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteDailySingle(sId)}
                              disabled={isSavingThis || isDeletingThis}
                              className="flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 disabled:opacity-50 transition-all"
                              title="Delete daily attendance record"
                            >
                              <Trash2 size={14} /> {isDeletingThis ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => saveDailySingle(sId)}
                            disabled={isSavingThis || isDeletingThis}
                            className={`flex items-center gap-1.5 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                              isSavedSuccess
                                ? 'bg-emerald-600 text-white'
                                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20'
                            } disabled:opacity-50`}
                          >
                            {isSavedSuccess ? (
                              <>
                                <CheckCircle2 size={14} /> Saved
                              </>
                            ) : (
                              <>
                                <Save size={14} /> {isSavingThis ? 'Saving...' : 'Save Daily'}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. SESSION ATTENDANCE CARD (Late | Partial for Morning/Breakfast/Evening) */}
                {(() => {
                  const sId = activeIndividualStudent._id;
                  const dailyRow = dailyRoster[sId];
                  const isDailyAbsent = Boolean(dailyRow?.isSaved && dailyRow?.status === 'Absent');
                  const currentKey = `${sId}:${selectedSession}`;
                  const row = sessionRecords[currentKey] || defaultSessionRow(branchSessionTimes[selectedSession] || '');
                  const isSavingThis = savingStudentId === `session-${currentKey}`;
                  const isSavedSuccess = savedSuccessId === `session-${currentKey}`;
                  const isDeletingThis = deletingStudentId === `session-${currentKey}`;

                  return (
                    <div className={`rounded-[32px] border bg-white p-7 shadow-sm dark:bg-slate-900 flex flex-col justify-between transition-all ${
                      isDailyAbsent
                        ? 'border-rose-200/80 dark:border-rose-950/60 bg-gradient-to-b from-rose-50/20 to-transparent'
                        : 'border-slate-100 dark:border-slate-800'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                              Session Attendance
                            </span>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white">
                              Late / Partial
                            </h4>
                          </div>
                          {isDailyAbsent ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                              <Lock size={12} strokeWidth={2.5} /> Locked (Daily Absent)
                            </span>
                          ) : (
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              row.isSaved
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {row.isSaved ? `${selectedSession} Saved` : `${selectedSession} Not Saved`}
                            </span>
                          )}
                        </div>

                        {/* Daily Absent Lock Notice */}
                        {isDailyAbsent && (
                          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs dark:border-rose-900/60 dark:bg-rose-950/40 animate-in fade-in duration-300">
                            <AlertCircle size={18} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                            <div>
                              <p className="font-black text-rose-900 dark:text-rose-200 text-xs uppercase tracking-wider">
                                Session Attendance Locked
                              </p>
                              <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                This student is marked as <strong>Absent</strong> for Daily Attendance. To record Morning, Breakfast, or Evening attendance, first change Daily Attendance to <strong>Present</strong> and click <strong>Edit Daily</strong>.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Session Selector (Morning / Breakfast / Evening) */}
                        <div className="mt-4">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                            Select Session
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {SESSIONS.map(sessionName => {
                              const SessionIcon = SESSION_ICONS[sessionName] || Clock;
                              const sessTime = branchSessionTimes[sessionName];
                              const isSelected = selectedSession === sessionName;
                              const sessKey = `${sId}:${sessionName}`;
                              const isSaved = sessionRecords[sessKey]?.isSaved;

                              return (
                                <button
                                  key={sessionName}
                                  type="button"
                                  onClick={() => setSelectedSession(sessionName)}
                                  className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl p-2.5 text-center transition-all ${
                                    isSelected
                                      ? 'bg-slate-900 text-white shadow-md dark:bg-slate-800'
                                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400'
                                  }`}
                                >
                                  {isSaved && (
                                    <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                                  )}
                                  <SessionIcon size={16} />
                                  <span className="text-[11px] font-black uppercase tracking-wider">{sessionName}</span>
                                  {sessTime && (
                                    <span className="text-[9px] opacity-70 font-semibold">{sessTime}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Session Status Options: Late | Partial */}
                        <div className="mt-5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                            {selectedSession} Status
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setSessionStatus(sId, selectedSession, 'Late')}
                              disabled={isDailyAbsent}
                              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                row.status === 'Late'
                                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              <Clock size={16} /> Late
                            </button>

                            <button
                              type="button"
                              onClick={() => setSessionStatus(sId, selectedSession, 'Partial')}
                              disabled={isDailyAbsent}
                              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                row.status === 'Partial'
                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              <AlertCircle size={16} /> Partial
                            </button>
                          </div>
                        </div>

                        {/* Inputs for Late / Partial */}
                        <div className="mt-4 space-y-3 animate-in fade-in duration-300">
                          {row.status === 'Late' && (
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-wider text-amber-600 block mb-1">
                                Actual Arrival Time
                              </label>
                              <input
                                type="time"
                                value={row.arrivalTime || currentSessionTime}
                                onChange={e => setSessionField(sId, selectedSession, 'arrivalTime', e.target.value)}
                                disabled={isDailyAbsent}
                                className="w-full rounded-2xl border border-amber-300 bg-amber-50/50 px-4 py-2.5 text-xs font-bold text-amber-900 outline-none focus:border-amber-500 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                              {row.status === 'Late' ? 'Late Reason (optional)' : 'Reason for Partial Attendance'}
                            </label>
                            <input
                              type="text"
                              value={row.description}
                              onChange={e => setSessionField(sId, selectedSession, 'description', e.target.value)}
                              disabled={isDailyAbsent}
                              placeholder={row.status === 'Late' ? 'e.g. Bus delayed, medical visit...' : 'e.g. Left early at 10:30, attended 1st period only...'}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Session Actions: Save Session / Edit Session / Delete Session */}
                      <div className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800 flex items-center justify-end gap-2.5">
                        {row.isSaved ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveSessionSingle(sId, selectedSession)}
                              disabled={isDailyAbsent || isSavingThis || isDeletingThis}
                              className={`flex items-center gap-1.5 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                                isSavedSuccess
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {isDailyAbsent ? (
                                <>
                                  <Lock size={14} /> Locked
                                </>
                              ) : isSavedSuccess ? (
                                <>
                                  <CheckCircle2 size={14} /> Updated
                                </>
                              ) : (
                                <>
                                  <Pencil size={14} /> {isSavingThis ? 'Saving...' : `Edit ${selectedSession}`}
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteSessionSingle(sId, selectedSession)}
                              disabled={isSavingThis || isDeletingThis}
                              className="flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 disabled:opacity-50 transition-all"
                              title={`Delete ${selectedSession} session record`}
                            >
                              <Trash2 size={14} /> {isDeletingThis ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => saveSessionSingle(sId, selectedSession)}
                            disabled={isDailyAbsent || isSavingThis || isDeletingThis}
                            className={`flex items-center gap-1.5 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                              isSavedSuccess
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isDailyAbsent ? (
                              <>
                                <Lock size={14} /> Locked (Daily Absent)
                              </>
                            ) : isSavedSuccess ? (
                              <>
                                <CheckCircle2 size={14} /> Saved
                              </>
                            ) : (
                              <>
                                <Save size={14} /> {isSavingThis ? 'Saving...' : `Save ${selectedSession} Attendance`}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* VIEW 2: CLASS GENERAL VIEW (ALL STUDENTS - DAILY ATTENDANCE) */
            <section className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-brand-500" size={20} />
                  <div>
                    <h2 className="font-black text-slate-900 dark:text-white">
                      Class Register — {selectedClassName || 'Selected Class'}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Daily Attendance (Present | Absent) · {selectedDate} {currentBranchName && `· ${currentBranchName}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    {dailySummary.present} Present
                  </span>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black uppercase text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                    {dailySummary.absent} Absent
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {dailySummary.total} Total
                  </span>
                </div>
              </div>

              {loadingRoster ? (
                <div className="p-10 text-center text-sm font-semibold text-slate-400">Loading students...</div>
              ) : !classStudents.length ? (
                <div className="p-12 text-center text-sm font-semibold text-slate-400">No students are assigned to this class.</div>
              ) : !displayedStudents.length ? (
                <div className="p-12 text-center text-sm font-semibold text-slate-400">
                  No student in this class matches "{studentSearch.trim()}".
                  <button
                    type="button"
                    onClick={clearStudentSearch}
                    className="ml-2 font-bold text-brand-500 hover:underline"
                  >
                    Show all {classStudents.length} students
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                        <th className="px-7 py-4">Student</th>
                        <th className="px-7 py-4">Daily Status</th>
                        <th className="px-7 py-4">Reason (if absent)</th>
                        <th className="px-7 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayedStudents.map(student => {
                        const row = dailyRoster[student._id] || defaultDailyRow();
                        const isSavingThis = savingStudentId === `daily-${student._id}`;
                        const isSavedSuccess = savedSuccessId === `daily-${student._id}`;
                        const isDeletingThis = deletingStudentId === `daily-${student._id}`;

                        return (
                          <tr key={student._id} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                            <td className="px-7 py-5">
                              <p className="font-bold text-slate-900 dark:text-white">{student.fullName}</p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-400">{student.rollNumber || student.studentCode || 'No ID'}</p>
                            </td>

                            <td className="px-7 py-5 whitespace-nowrap">
                              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setDailyStatus(student._id, 'Present')}
                                  className={`rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                                    row.status === 'Present'
                                      ? 'bg-emerald-600 text-white shadow-md'
                                      : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDailyStatus(student._id, 'Absent')}
                                  className={`rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                                    row.status === 'Absent'
                                      ? 'bg-rose-600 text-white shadow-md'
                                      : 'text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
                                  }`}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>

                            <td className="px-7 py-5">
                              {row.status === 'Absent' ? (
                                <input
                                  type="text"
                                  value={row.description}
                                  onChange={e => setDailyDescription(student._id, e.target.value)}
                                  placeholder="Reason for absence (e.g. sick, travel)..."
                                  className="w-full min-w-[220px] rounded-2xl border border-rose-200 bg-rose-50/40 px-4 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-rose-400 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-white"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            <td className="px-7 py-5 text-right whitespace-nowrap">
                              {row.isSaved ? (
                                <div className="inline-flex items-center gap-2 justify-end">
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => saveDailySingle(student._id)}
                                    disabled={isSavingThis || isDeletingThis || savingDailyBatch}
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${
                                      isSavedSuccess
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                                    } disabled:opacity-50`}
                                    title="Update daily attendance for this student"
                                  >
                                    {isSavedSuccess ? (
                                      <>
                                        <CheckCircle2 size={13} strokeWidth={2.5} /> Updated
                                      </>
                                    ) : (
                                      <>
                                        <Pencil size={13} strokeWidth={2.5} /> {isSavingThis ? 'Saving...' : 'Edit Daily'}
                                      </>
                                    )}
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => deleteDailySingle(student._id)}
                                    disabled={isSavingThis || isDeletingThis || savingDailyBatch}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                                    title="Delete daily attendance record"
                                  >
                                    <Trash2 size={13} strokeWidth={2.5} />
                                    {isDeletingThis ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              ) : (
                                /* Save Daily Button */
                                <button
                                  type="button"
                                  onClick={() => saveDailySingle(student._id)}
                                  disabled={isSavingThis || isDeletingThis || savingDailyBatch}
                                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${
                                    isSavedSuccess
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20'
                                  } disabled:opacity-50`}
                                  title="Save daily attendance for this student only"
                                >
                                  {isSavedSuccess ? (
                                    <>
                                      <CheckCircle2 size={14} strokeWidth={2.5} /> Saved
                                    </>
                                  ) : (
                                    <>
                                      <Save size={14} strokeWidth={2.5} /> {isSavingThis ? 'Saving...' : 'Save Daily'}
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Batch Save */}
              {!!displayedStudents.length && !loadingRoster && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-5 dark:border-slate-800">
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    All students are Present by default — only change those who are Absent.
                  </p>
                  <button
                    type="button"
                    onClick={saveBatchDaily}
                    disabled={savingDailyBatch}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={16} strokeWidth={3} />
                    {savingDailyBatch ? 'Saving...' : `Save Daily Attendance (${displayedStudents.length})`}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default StudentAttendanceManagement;
