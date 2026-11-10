import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Calendar, Plus, Edit2, Trash2, Printer, FileDown,
  Building2, Layers, Clock, BookOpen, AlertCircle,
  CheckCircle2, X, Loader2, Sparkles, RotateCcw, ArrowRight,
  ChevronDown, ChevronUp, Check, Coffee, FileSpreadsheet,
  GraduationCap, User, UserCheck, Search, Filter
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const DAYS_SO = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimco', 'Sabti'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const parseLocalDateSafe = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  const s = String(dateVal).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d;
};

const formatDisplayDate = (dateVal) => {
  const d = parseLocalDateSafe(dateVal);
  if (!d) return '—';
  // Format as MM/DD/YYYY to match reference image (e.g. 07/04/2023)
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

const formatDisplayDay = (dateVal, explicitDay = '', currentLocale = 'so') => {
  const d = parseLocalDateSafe(dateVal);
  if (!d) {
    if (!explicitDay) return '—';
    const enIdx = DAYS_EN.findIndex(day => day.toLowerCase() === String(explicitDay).toLowerCase());
    if (enIdx !== -1) {
      if (currentLocale === 'so') return DAYS_SO[enIdx];
      if (currentLocale === 'ar') return DAYS_AR[enIdx];
      return DAYS_EN[enIdx];
    }
    return explicitDay;
  }
  const idx = d.getDay();
  if (currentLocale === 'so') return DAYS_SO[idx] || explicitDay || '—';
  if (currentLocale === 'ar') return DAYS_AR[idx] || explicitDay || '—';
  return DAYS_EN[idx] || explicitDay || '—';
};

const formatDisplayTime = (timeVal) => {
  if (!timeVal) return '—';
  const clean = String(timeVal).trim();
  // If it's already HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) return clean;
  // If it's HH:MM, append :00 to match reference image style (e.g. 11:30:00)
  if (/^\d{1,2}:\d{2}$/.test(clean)) {
    const parts = clean.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}:00`;
  }
  return clean;
};

// Compute End Time from Start Time and Duration (in minutes)
const computeEndTime = (startTime, durationMinutes) => {
  if (!startTime) return '';
  let clean = String(startTime).trim();
  if (clean.startsWith('90:')) clean = '09:' + clean.slice(3);
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  let hours = parseInt(match[1], 10);
  if (hours >= 24 && String(hours).startsWith('90')) hours = 9;
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const dur = parseInt(durationMinutes, 10);
  if (isNaN(dur) || dur <= 0) return '';

  const totalMinutes = hours * 60 + minutes + dur;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;

  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Compute Duration in minutes between Start Time and End Time
const computeDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 60;
  let s1 = String(startTime).trim();
  let s2 = String(endTime).trim();
  if (s1.startsWith('90:')) s1 = '09:' + s1.slice(3);
  if (s2.startsWith('90:')) s2 = '09:' + s2.slice(3);
  const m1 = s1.match(/^(\d{1,2}):(\d{2})/);
  const m2 = s2.match(/^(\d{1,2}):(\d{2})/);
  if (!m1 || !m2) return 60;
  const min1 = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
  const min2 = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  let diff = min2 - min1;
  if (diff < 0) diff += 24 * 60;
  return diff > 0 ? diff : 60;
};

// Add minutes to a time string (HH:MM:SS or HH:MM)
const addMinutesToTime = (time, minutesToAdd) => {
  if (!time) return '';
  const clean = String(time).trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const add = parseInt(minutesToAdd, 10);
  if (isNaN(add)) return time;

  const totalMinutes = hours * 60 + minutes + add;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const DEFAULT_TIMINGS_STORAGE_KEY = 'exam_timetable_default_timings_v2';

const getDefaultTimings = () => {
  try {
    const raw = localStorage.getItem(DEFAULT_TIMINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length >= 3) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse default timetable timings:', e);
  }

  return {
    breakMinutes1: 30,
    breakMinutes2: 30,
    sessions: [
      {
        session: 'Qaybta 1aad',
        startTime: '08:10:00',
        endTime: '09:10:00',
        duration: 60
      },
      {
        session: 'Qaybta 2aad',
        startTime: '09:40:00',
        endTime: '10:40:00',
        duration: 60
      },
      {
        session: 'Qaybta 3aad',
        startTime: '11:10:00',
        endTime: '12:10:00',
        duration: 60
      }
    ]
  };
};

// Group sorted subjects by date for daily timetable rows
const groupSubjectsByDate = (subjectsList = []) => {
  const groups = [];
  const map = new Map();
  subjectsList.forEach(sub => {
    const dKey = sub.date || (sub.examDate ? new Date(sub.examDate).toISOString().slice(0, 10) : '') || '__no_date__';
    if (!map.has(dKey)) {
      const g = { dateKey: dKey, subjects: [] };
      map.set(dKey, g);
      groups.push(g);
    }
    map.get(dKey).subjects.push(sub);
  });
  return groups;
};

const createDefaultSession = (idx, examMaxMarks = 100, customSubject = null, customTimings = null) => {
  const sessionTitles = ['Qaybta 1aad', 'Qaybta 2aad', 'Qaybta 3aad', 'Qaybta 4aad'];
  const sessionConfig = customTimings?.sessions?.[idx];

  const defaultStarts = ['08:10:00', '09:40:00', '11:10:00', '13:00:00'];
  const start = sessionConfig?.startTime || defaultStarts[idx] || '08:10:00';
  const dur = Number(sessionConfig?.duration) || 60;
  const end = sessionConfig?.endTime || computeEndTime(start, dur);

  return {
    name: customSubject?.name || '',
    code: customSubject?.code || '',
    session: sessionConfig?.session || sessionTitles[idx] || `Qaybta ${idx + 1}aad`,
    startTime: formatDisplayTime(start),
    endTime: formatDisplayTime(end),
    duration: dur,
    fullMarks: examMaxMarks || 100,
    room: ''
  };
};

const emptyScheduleForm = (timings = null) => ({
  examId: '',
  date: new Date().toISOString().slice(0, 10),
  day: '',
  sessions: [
    createDefaultSession(0, 100, null, timings),
    createDefaultSession(1, 100, null, timings)
  ]
});

const ExamSchedule = () => {
  const { showAlert, showConfirm } = useAlert();
  const { t, tv, locale } = useLanguage();
  const location = useLocation();

  // Logged-in user information & Teacher role detection
  const currentUser = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('userInfo');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const isTeacher = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    const rs = (currentUser.roles || []).map(x => (typeof x === 'string' ? x : x?.name || '').toLowerCase());
    return r.includes('teacher') || rs.some(x => x.includes('teacher'));
  }, [currentUser]);

  // Teachers list & Admin teacher filter
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(''); // Admin-only: '' means All Teachers / full schedule

  // Active Teacher ID: permanently locked to teacher's own _id if logged in as teacher; or selectedTeacherId if admin
  const activeTeacherId = useMemo(() => {
    if (isTeacher && currentUser?._id) {
      return String(currentUser._id);
    }
    return selectedTeacherId || '';
  }, [isTeacher, currentUser, selectedTeacherId]);

  const activeTeacherObj = useMemo(() => {
    if (!activeTeacherId) return null;
    if (isTeacher && currentUser && String(currentUser._id) === activeTeacherId) {
      return currentUser;
    }
    return teachers.find(t => String(t._id) === activeTeacherId) || null;
  }, [activeTeacherId, isTeacher, currentUser, teachers]);

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(''); // '' means All Exams
  const [registeredSubjects, setRegisteredSubjects] = useState([]);
  const [settings, setSettings] = useState(null);

  // Outer Default Timetable Timings ("banaanka") with Break support
  const [defaultTimings, setDefaultTimings] = useState(getDefaultTimings);
  const [isTimingsModalOpen, setIsTimingsModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // { examId, subject }
  const [form, setForm] = useState(() => emptyScheduleForm(getDefaultTimings()));
  const [saving, setSaving] = useState(false);

  // View mode: 'teacher' (Personal Teacher Schedule), 'branch' (Branch Master Sheet), or 'class' (Single Class)
  const [viewMode, setViewMode] = useState(() => {
    try {
      const raw = sessionStorage.getItem('userInfo');
      const u = raw ? JSON.parse(raw) : null;
      if (u) {
        const r = (u.role || '').toLowerCase();
        const rs = (u.roles || []).map(x => (typeof x === 'string' ? x : x?.name || '').toLowerCase());
        if (r.includes('teacher') || rs.some(x => x.includes('teacher'))) {
          return 'teacher';
        }
      }
    } catch (e) {}
    return localStorage.getItem('exam_schedule_view_mode') || 'class';
  });
  const [branchOnlyClassesWithExams, setBranchOnlyClassesWithExams] = useState(false);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');

  const handleSetViewMode = (mode) => {
    if (isTeacher) return;
    setViewMode(mode);
    try {
      localStorage.setItem('exam_schedule_view_mode', mode);
    } catch (e) {}
  };

  useEffect(() => {
    if (isTeacher && viewMode !== 'teacher') {
      setViewMode('teacher');
    }
  }, [isTeacher, viewMode]);

  // Term & Academic Year filters
  const [termFilter, setTermFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resExams, resClasses, resSubjects, resBranches, resSettings, resUsers] = await Promise.all([
        api.get('/exams'),
        api.get('/classes'),
        api.get('/subjects').catch(() => ({ data: [] })),
        api.get('/branches').catch(() => ({ data: [] })),
        api.get('/settings').catch(() => ({ data: null })),
        api.get('/users', { params: { role: 'Teacher' } }).catch(() => api.get('/users')).catch(() => ({ data: [] }))
      ]);

      const examsData = resExams.data || [];
      const classesData = resClasses.data || [];
      let branchesData = resBranches?.data || [];

      if (!branchesData.length) {
        const branchMap = new Map();
        classesData.forEach(c => {
          if (c.branchId && typeof c.branchId === 'object' && c.branchId._id) {
            branchMap.set(String(c.branchId._id), c.branchId);
          }
        });
        branchesData = Array.from(branchMap.values());
      }

      const usersList = resUsers?.data || [];
      const teacherUsers = usersList.filter(u => {
        const r = (u.role || '').toLowerCase();
        const rs = (u.roles || []).map(x => (typeof x === 'string' ? x : x?.name || '').toLowerCase());
        return r.includes('teacher') || rs.some(x => x.includes('teacher'));
      });
      setTeachers(teacherUsers.length ? teacherUsers : usersList);

      setExams(examsData);
      setClasses(classesData);
      setBranches(branchesData);
      setRegisteredSubjects(resSubjects.data || []);
      if (resSettings?.data) setSettings(resSettings.data);

      if (isTeacher && currentUser) {
        const tBranch = currentUser.branchId?._id || currentUser.branchId;
        if (tBranch) {
          setSelectedBranchId(String(tBranch));
        }
      }

      // Handle query params e.g. /exams/schedule?exam=...
      const paramExam = new URLSearchParams(location.search).get('exam');
      if (paramExam) {
        const match = examsData.find(e => String(e._id) === String(paramExam));
        if (match) {
          const cId = String(match.classId?._id || match.classId || '');
          const classObj = classesData.find(c => String(c._id) === cId);
          const bId = String(classObj?.branchId?._id || classObj?.branchId || '');
          if (bId) setSelectedBranchId(bId);
          setSelectedClassId(cId);
          setSelectedExamId(String(match._id));
          return;
        }
      }

      // Default selection: first class and its exams
      if (classesData.length) {
        const first = classesData[0];
        const bId = String(first.branchId?._id || first.branchId || '');
        if (bId) setSelectedBranchId(bId);
        setSelectedClassId(String(first._id));
      }
    } catch (error) {
      console.error('Failed to load schedule data', error);
      showAlert({ type: 'danger', title: t('common.error'), message: t('exams.loadFailed') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter classes by selected branch
  const filteredClasses = useMemo(() => {
    if (!selectedBranchId) return classes;
    return classes.filter(c => {
      const bId = String(c.branchId?._id || c.branchId || '');
      return bId === selectedBranchId;
    });
  }, [classes, selectedBranchId]);

  // Helper to check if a subject in an exam is taught by active teacher
  const isSubjectForTeacher = useMemo(() => {
    return (sub, classId, teacherId = activeTeacherId) => {
      if (!teacherId) return true; // Full view for admin without teacher filter
      if (!sub) return false;

      const subName = (typeof sub === 'string' ? sub : sub?.name || '').trim().toLowerCase();
      const subCode = (typeof sub === 'object' && sub?.code ? sub.code.trim().toLowerCase() : '');
      const classIdStr = String(classId?._id || classId || '');
      const teacherIdStr = String(teacherId);

      return registeredSubjects.some(s => {
        const stId = String(s.teacherId?._id || s.teacherId || '');
        if (stId !== teacherIdStr) return false;

        const regName = (s.name || '').trim().toLowerCase();
        const regCode = (s.code || '').trim().toLowerCase();
        const nameMatch = regName === subName || (subCode && regCode && regCode === subCode);
        if (!nameMatch) return false;

        const cList = s.classIds || [];
        if (!cList.length) return true; // Applicable school-wide
        if (!classIdStr) return true;
        return cList.some(cid => String(cid?._id || cid) === classIdStr);
      });
    };
  }, [activeTeacherId, registeredSubjects]);

  // Classes accessible to the active teacher (classes where teacher teaches or has scheduled exams)
  const teacherAccessibleClasses = useMemo(() => {
    if (!activeTeacherId) return filteredClasses;
    const tId = String(activeTeacherId);
    const assignedClassIds = new Set();

    registeredSubjects.forEach(s => {
      const stId = String(s.teacherId?._id || s.teacherId || '');
      if (stId === tId) {
        (s.classIds || []).forEach(cid => {
          const id = String(cid?._id || cid || '');
          if (id) assignedClassIds.add(id);
        });
      }
    });

    exams.forEach(e => {
      const cId = String(e.classId?._id || e.classId || '');
      if ((e.subjects || []).some(sub => isSubjectForTeacher(sub, cId, tId))) {
        if (cId) assignedClassIds.add(cId);
      }
    });

    if (assignedClassIds.size === 0) return filteredClasses;
    const matching = filteredClasses.filter(c => assignedClassIds.has(String(c._id)));
    return matching.length ? matching : filteredClasses;
  }, [filteredClasses, activeTeacherId, registeredSubjects, exams, isSubjectForTeacher]);

  // Sync selectedClassId with teacher accessible classes
  useEffect(() => {
    if (activeTeacherId && teacherAccessibleClasses.length > 0) {
      const isValid = teacherAccessibleClasses.some(c => String(c._id) === selectedClassId);
      if (!isValid) {
        setSelectedClassId(String(teacherAccessibleClasses[0]._id));
      }
    }
  }, [activeTeacherId, teacherAccessibleClasses, selectedClassId]);

  // Handle branch switch
  const handleBranchChange = (newBranchId) => {
    setSelectedBranchId(newBranchId);
    const matching = !newBranchId
      ? teacherAccessibleClasses
      : teacherAccessibleClasses.filter(c => String(c.branchId?._id || c.branchId) === newBranchId);

    if (matching.length) {
      const stillValid = matching.some(c => String(c._id) === selectedClassId);
      if (!stillValid) {
        setSelectedClassId(String(matching[0]._id));
      }
    } else {
      setSelectedClassId('');
    }
  };

  // Filter exams for selected class
  const classExams = useMemo(() => {
    if (!selectedClassId) return [];
    return exams.filter(e => {
      const cId = String(e.classId?._id || e.classId || '');
      if (cId !== selectedClassId) return false;
      if (termFilter && e.term !== termFilter) return false;
      if (yearFilter && e.academicYear !== yearFilter) return false;
      if (activeTeacherId) {
        const hasTeacherSub = (e.subjects || []).some(s =>
          Boolean(s.date || s.examDate) && isSubjectForTeacher(s, cId, activeTeacherId)
        );
        if (!hasTeacherSub) return false;
      }
      return true;
    });
  }, [exams, selectedClassId, termFilter, yearFilter, activeTeacherId, isSubjectForTeacher]);

  // Selected exams to display: either all matching classExams or the single selectedExamId
  const displayedExams = useMemo(() => {
    if (!selectedExamId) return classExams;
    return classExams.filter(e => String(e._id) === selectedExamId);
  }, [classExams, selectedExamId]);

  // Dedicated Personal Schedule for the active teacher across all their classes
  const teacherPersonalSchedule = useMemo(() => {
    if (!activeTeacherId) return [];
    const tId = String(activeTeacherId);

    const list = [];
    exams.forEach(exam => {
      const examClassId = String(exam.classId?._id || exam.classId || '');
      const classObj = classes.find(c => String(c._id) === examClassId);
      if (!classObj) return;

      const branchObj = branches.find(b => {
        const bId = classObj.branchId?._id || classObj.branchId;
        return String(bId) === String(b._id);
      });

      if (selectedBranchId) {
        const classBranchId = String(classObj.branchId?._id || classObj.branchId || '');
        if (classBranchId !== selectedBranchId) return;
      }

      if (termFilter && exam.term && exam.term !== termFilter) return;
      if (yearFilter && exam.academicYear && exam.academicYear !== yearFilter) return;

      const scheduledSubs = (exam.subjects || []).filter(s => {
        return Boolean(s.date || s.examDate) && isSubjectForTeacher(s, examClassId, tId);
      });

      scheduledSubs.forEach((sub, idx) => {
        const dKey = sub.date || (sub.examDate ? new Date(sub.examDate).toISOString().slice(0, 10) : '');
        let st = sub.startTime || '';
        let et = sub.endTime || '';
        if (st.startsWith('90:')) {
          st = '09:' + st.slice(3);
          if (et.startsWith('19:') || !et) et = computeEndTime(st, sub.duration || 60);
        }

        list.push({
          id: `${exam._id}_${sub._id || sub.name}_${idx}`,
          examId: exam._id,
          examTitle: exam.title || `${tv(exam.examType)} Examination`,
          examType: exam.examType,
          term: exam.term,
          academicYear: exam.academicYear,
          classObj,
          className: classLabel(classObj, ''),
          branchObj,
          branchName: branchObj?.name || 'Farac La\'aan',
          subjectName: sub.name,
          subjectCode: sub.code || '',
          session: sub.session || `Qaybta ${idx + 1}aad`,
          date: dKey,
          day: sub.day || '',
          startTime: st,
          endTime: et,
          duration: sub.duration || computeDuration(st, et) || 60,
          room: sub.room || '',
          fullMarks: sub.fullMarks || 100
        });
      });
    });

    return list.sort((a, b) => {
      const cmpDate = (a.date || '').localeCompare(b.date || '');
      if (cmpDate !== 0) return cmpDate;
      const cmpTime = (a.startTime || '').localeCompare(b.startTime || '');
      if (cmpTime !== 0) return cmpTime;
      return (a.className || '').localeCompare(b.className || '');
    });
  }, [
    activeTeacherId, exams, classes, branches, selectedBranchId,
    termFilter, yearFilter, isSubjectForTeacher, tv
  ]);

  const filteredTeacherSchedule = useMemo(() => {
    if (!teacherSearchTerm.trim()) return teacherPersonalSchedule;
    const term = teacherSearchTerm.trim().toLowerCase();
    return teacherPersonalSchedule.filter(item => {
      return (
        item.subjectName.toLowerCase().includes(term) ||
        item.subjectCode.toLowerCase().includes(term) ||
        item.className.toLowerCase().includes(term) ||
        item.branchName.toLowerCase().includes(term) ||
        item.date.includes(term) ||
        item.day.toLowerCase().includes(term) ||
        item.room.toLowerCase().includes(term)
      );
    });
  }, [teacherPersonalSchedule, teacherSearchTerm]);

  // Selected Branch Object (null if all branches are selected)
  const currentBranchObj = useMemo(() => {
    if (!selectedBranchId) return null;
    return branches.find(b => String(b._id) === String(selectedBranchId)) || null;
  }, [branches, selectedBranchId]);

  // Active classes belonging to the selected branch (or all branches if none selected)
  const activeBranchClasses = useMemo(() => {
    const targetBranchId = selectedBranchId;
    const filtered = !targetBranchId
      ? classes
      : classes.filter(c => {
          const bId = c.branchId && typeof c.branchId === 'object' ? c.branchId._id : c.branchId;
          return String(bId) === String(targetBranchId);
        });
    return [...filtered].sort((a, b) => {
      const nameA = a.name || a.className || '';
      const nameB = b.name || b.className || '';
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
  }, [classes, selectedBranchId]);

  // Branch master schedule aggregated by date (matching user sketch)
  const branchMasterSchedule = useMemo(() => {
    const targetClassIds = new Set(activeBranchClasses.map(c => String(c._id)));

    const matchingExams = exams.filter(e => {
      const examClassId = e.classId && typeof e.classId === 'object' ? e.classId._id : e.classId;
      if (!targetClassIds.has(String(examClassId))) return false;
      if (termFilter && e.term && e.term !== termFilter) return false;
      if (yearFilter && e.academicYear && e.academicYear !== yearFilter) return false;
      if (selectedExamId && String(e._id) !== String(selectedExamId)) return false;
      return true;
    });

    const dateMap = new Map();

    matchingExams.forEach(exam => {
      const examClassId = String(exam.classId && typeof exam.classId === 'object' ? exam.classId._id : exam.classId);
      const classObj = classes.find(c => String(c._id) === examClassId);
      if (!classObj) return;

      const scheduledSubs = (exam.subjects || []).filter(s => {
        if (!s.date && !s.examDate) return false;
        if (activeTeacherId && !isSubjectForTeacher(s, examClassId, activeTeacherId)) return false;
        return true;
      });
      scheduledSubs.forEach(sub => {
        const dKey = sub.date || (sub.examDate ? new Date(sub.examDate).toISOString().slice(0, 10) : '') || '__no_date__';
        if (dKey === '__no_date__') return;

        if (!dateMap.has(dKey)) {
          dateMap.set(dKey, {
            dateKey: dKey,
            date: dKey,
            day: sub.day || '',
            classRows: new Map()
          });
        }

        const dateEntry = dateMap.get(dKey);
        if (!dateEntry.day && sub.day) dateEntry.day = sub.day;

        if (!dateEntry.classRows.has(examClassId)) {
          dateEntry.classRows.set(examClassId, {
            classObj,
            examObj: exam,
            subjects: []
          });
        }

        dateEntry.classRows.get(examClassId).subjects.push(sub);
      });
    });

    const daysArray = Array.from(dateMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return daysArray.map(dayEntry => {
      const classesToShow = (branchOnlyClassesWithExams || activeTeacherId)
        ? activeBranchClasses.filter(c => dayEntry.classRows.has(String(c._id)))
        : activeBranchClasses;

      const rows = [];

      classesToShow.forEach(classObj => {
        const cId = String(classObj._id);
        const scheduledData = dayEntry.classRows.get(cId);
        const subs = (scheduledData?.subjects || []).slice().sort((a, b) => {
          return (a.startTime || '').localeCompare(b.startTime || '');
        });

        if (activeTeacherId && subs.length === 0) return;

        // Helper to sanitize common user typos like 90:40 -> 09:40
        const sanitizeSub = (sub) => {
          if (!sub) return null;
          let st = sub.startTime || '';
          let et = sub.endTime || '';
          if (st.startsWith('90:')) {
            st = '09:' + st.slice(3);
            if (et.startsWith('19:') || !et) {
              et = computeEndTime(st, sub.duration || 60);
            }
          }
          return { ...sub, startTime: st, endTime: et };
        };

        const rawS1 = subs.find(s => s.session === 'Qaybta 1aad' || s.session === 'Xiisada 1aad') || subs[0] || null;
        const rawS2 = subs.find(s => s.session === 'Qaybta 2aad' || s.session === 'Xiisada 2aad') || (subs[1] !== rawS1 ? subs[1] : null) || null;
        const rawS3 = subs.find(s => s.session === 'Qaybta 3aad' || s.session === 'Xiisada 3aad') || (subs[2] !== rawS1 && subs[2] !== rawS2 ? subs[2] : null) || null;

        const s1 = sanitizeSub(rawS1);
        const s2 = sanitizeSub(rawS2);
        const s3 = sanitizeSub(rawS3);

        let break1 = defaultTimings?.breakMinutes1 || 20;
        if (s1?.endTime && s2?.startTime) {
          const calcB1 = computeDuration(s1.endTime, s2.startTime);
          if (calcB1 > 0 && calcB1 < 180) break1 = calcB1;
        }

        let break2 = defaultTimings?.breakMinutes2 || 20;
        if (s2?.endTime && s3?.startTime) {
          const calcB2 = computeDuration(s2.endTime, s3.startTime);
          if (calcB2 > 0 && calcB2 < 180) break2 = calcB2;
        }

        rows.push({
          classObj,
          examObj: scheduledData?.examObj || null,
          hasExam: Boolean(subs.length),
          session1: s1,
          break1: s1 && s2 ? break1 : null,
          session2: s2,
          break2: s2 && s3 ? break2 : null,
          session3: s3
        });
      });

      return {
        ...dayEntry,
        displayDay: formatDisplayDay(dayEntry.date, dayEntry.day, locale),
        displayDate: formatDisplayDate(dayEntry.date),
        rows
      };
    });
  }, [
    exams, classes, selectedBranchId, currentBranchObj, activeBranchClasses,
    termFilter, yearFilter, selectedExamId, defaultTimings, locale, branchOnlyClassesWithExams,
    activeTeacherId, isSubjectForTeacher
  ]);

  // Registered subjects for current selected class
  const classRegisteredSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    return registeredSubjects.filter(s =>
      !s.classIds?.length || s.classIds.some(c => String(c._id || c) === selectedClassId)
    );
  }, [registeredSubjects, selectedClassId]);

  // Current exam object selected in the modal
  const targetModalExam = useMemo(() => {
    return exams.find(e => String(e._id) === String(form.examId));
  }, [exams, form.examId]);

  // Names of subjects that already have an assigned schedule on this exam
  const scheduledSubjectNames = useMemo(() => {
    if (!targetModalExam) return new Set();
    return new Set(
      (targetModalExam.subjects || [])
        .filter(s => {
          if (editingEntry && (String(s._id) === String(editingEntry.subjectId) || s.name === editingEntry.subjectId)) {
            return false;
          }
          return Boolean(s.date || s.examDate);
        })
        .map(s => s.name.trim().toLowerCase())
    );
  }, [targetModalExam, editingEntry]);

  // Available subjects for a given session index (excludes already-scheduled subjects on this exam AND subjects picked in other sessions of this modal)
  const getAvailableSubjectsForSession = (sessionIdx) => {
    const otherSessionNames = new Set(
      (form.sessions || [])
        .filter((_, i) => i !== sessionIdx)
        .map(s => (s.name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    return classRegisteredSubjects.filter(s => {
      const sName = s.name.trim().toLowerCase();
      if (scheduledSubjectNames.has(sName)) return false;
      if (otherSessionNames.has(sName)) return false;
      return true;
    });
  };

  // Outer timing management handlers ("banaanka")
  const handleUpdateSessionTiming = (sessionIdx, field, value) => {
    setDefaultTimings(prev => {
      const nextSessions = (prev.sessions || []).map((s, i) => {
        if (i !== sessionIdx) return s;
        const nextS = { ...s, [field]: value };
        if (field === 'startTime') {
          nextS.startTime = formatDisplayTime(value);
          nextS.endTime = computeEndTime(nextS.startTime, nextS.duration);
        } else if (field === 'duration') {
          const dur = parseInt(value, 10) || 60;
          nextS.duration = dur;
          nextS.endTime = computeEndTime(nextS.startTime, dur);
        } else if (field === 'endTime') {
          nextS.endTime = formatDisplayTime(value);
          const computedDur = computeDuration(nextS.startTime, nextS.endTime);
          if (computedDur) nextS.duration = computedDur;
        }
        return nextS;
      });

      const next = { ...prev, sessions: nextSessions };
      try {
        localStorage.setItem(DEFAULT_TIMINGS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleUpdateBreak = (breakIdx, minutes) => {
    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    setDefaultTimings(prev => {
      const key = breakIdx === 1 ? 'breakMinutes1' : 'breakMinutes2';
      const targetSessionIdx = breakIdx; // 1 -> Qaybta 2aad, 2 -> Qaybta 3aad
      const prevSessionIdx = targetSessionIdx - 1;

      const nextSessions = [...prev.sessions];
      if (nextSessions[prevSessionIdx] && nextSessions[targetSessionIdx]) {
        const prevEnd = nextSessions[prevSessionIdx].endTime;
        const newStart = addMinutesToTime(prevEnd, mins);
        nextSessions[targetSessionIdx] = {
          ...nextSessions[targetSessionIdx],
          startTime: newStart,
          endTime: computeEndTime(newStart, nextSessions[targetSessionIdx].duration)
        };
      }

      const next = { ...prev, [key]: mins, sessions: nextSessions };
      try {
        localStorage.setItem(DEFAULT_TIMINGS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleRecalculateChain = () => {
    setDefaultTimings(prev => {
      const s0 = prev.sessions[0];
      const end0 = computeEndTime(s0.startTime, s0.duration);
      const start1 = addMinutesToTime(end0, prev.breakMinutes1);
      const end1 = computeEndTime(start1, prev.sessions[1].duration);
      const start2 = addMinutesToTime(end1, prev.breakMinutes2);
      const end2 = computeEndTime(start2, prev.sessions[2].duration);

      const nextSessions = [
        { ...s0, endTime: end0 },
        { ...prev.sessions[1], startTime: start1, endTime: end1 },
        { ...prev.sessions[2], startTime: start2, endTime: end2 }
      ];
      const next = { ...prev, sessions: nextSessions };
      try {
        localStorage.setItem(DEFAULT_TIMINGS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      showAlert({ type: 'success', title: 'Waa La Isku Xiray', message: 'Waqtiyada 3-da qaybood iyo nasashadooda (break) si toos ah ayaa la isugu habeeyey.' });
      return next;
    });
  };

  const handleResetTimings = () => {
    const init = {
      breakMinutes1: 30,
      breakMinutes2: 30,
      sessions: [
        { session: 'Qaybta 1aad', startTime: '08:10:00', endTime: '09:10:00', duration: 60 },
        { session: 'Qaybta 2aad', startTime: '09:40:00', endTime: '10:40:00', duration: 60 },
        { session: 'Qaybta 3aad', startTime: '11:10:00', endTime: '12:10:00', duration: 60 }
      ]
    };
    setDefaultTimings(init);
    try {
      localStorage.setItem(DEFAULT_TIMINGS_STORAGE_KEY, JSON.stringify(init));
    } catch (e) {}
    showAlert({ type: 'success', title: 'Dib ayaa loo celiyey', message: 'Waqtiyada caadiga ah dib ayaa loogu celiyey sidii hore (08:10, 09:40, 11:10).' });
  };

  const handleApplyTimingsToCurrentExam = async (exam) => {
    if (!exam || !exam.subjects?.length) {
      return showAlert({ type: 'warning', title: 'Ma jiraan maaddooyin', message: 'Imtixaankan weli ma laha maaddooyin jadwalka ku jira.' });
    }
    const scheduledSubs = (exam.subjects || []).filter(s => Boolean(s.date || s.examDate));
    if (!scheduledSubs.length) {
      return showAlert({ type: 'warning', title: 'Ma jiraan maaddooyin', message: 'Imtixaankan weli maaddo jadwalka loo dhigay ma jirto.' });
    }

    const ok = await showConfirm({
      type: 'warning',
      title: 'Ku dabaq waqtiyadan imtixaankan?',
      message: `Ma hubtaa inaad waqtiyada caadiga ah ee 3-da qaybood (08:10, 09:40, 11:10) ku dabaqdo dhammaan ${scheduledSubs.length} maaddo ee imtixaanka "${exam.title}"?`,
      confirmText: 'Haa, Ku Dabaq',
      cancelText: 'Iska Daay'
    });
    if (!ok) return;

    try {
      setSaving(true);
      const dayGroups = groupSubjectsByDate(scheduledSubs);
      for (const group of dayGroups) {
        for (let idx = 0; idx < group.subjects.length; idx++) {
          const sub = group.subjects[idx];
          const timingCfg = defaultTimings.sessions[idx] || defaultTimings.sessions[0];
          const payload = {
            name: sub.name,
            code: sub.code || '',
            session: sub.session || timingCfg.session,
            day: sub.day,
            date: sub.date,
            startTime: timingCfg.startTime,
            endTime: timingCfg.endTime,
            duration: timingCfg.duration,
            fullMarks: sub.fullMarks,
            room: sub.room || ''
          };
          await api.put(`/exams/${exam._id}/schedule/${sub._id}`, payload);
        }
      }
      showAlert({ type: 'success', title: 'Waa lagu dabaqay', message: 'Waqtiyada caadiga ah si guul leh ayaa loogu dabaqay dhammaan maaddooyinka.' });
      await fetchData();
    } catch (err) {
      console.error(err);
      showAlert({ type: 'danger', title: 'Cilad', message: 'Laguma dabaqi karin waqtiyada.' });
    } finally {
      setSaving(false);
    }
  };

  // Apply default timings to ALL exams in the selected branch (or all branches) at once
  const handleApplyTimingsToAllBranchExams = async () => {
    const targetClassIds = new Set(activeBranchClasses.map(c => String(c._id)));
    const matchingExams = exams.filter(e => {
      const cId = String(e.classId?._id || e.classId || '');
      return targetClassIds.has(cId);
    });

    let totalSubsCount = 0;
    const examsToUpdate = [];
    matchingExams.forEach(e => {
      const scheduledSubs = (e.subjects || []).filter(s => Boolean(s.date || s.examDate));
      if (scheduledSubs.length) {
        totalSubsCount += scheduledSubs.length;
        examsToUpdate.push({ exam: e, scheduledSubs });
      }
    });

    if (!totalSubsCount) {
      showAlert({
        type: 'warning',
        title: 'Ma jiraan maaddooyin',
        message: 'Lama helin maaddooyin jadwalka ku jira oo waqtiyada lagu dabaqi karo.'
      });
      return;
    }

    const branchName = currentBranchObj?.name || 'Dhammaan Laamaha';
    const s1Info = `${defaultTimings.sessions[0]?.startTime?.slice(0, 5) || '08:10'}-${defaultTimings.sessions[0]?.endTime?.slice(0, 5) || '09:10'}`;
    const s2Info = `${defaultTimings.sessions[1]?.startTime?.slice(0, 5) || '09:30'}-${defaultTimings.sessions[1]?.endTime?.slice(0, 5) || '10:30'}`;
    const b1Info = `${defaultTimings.breakMinutes1 ?? 20} daqiiqo`;

    const ok = await showConfirm({
      type: 'warning',
      title: 'Hal Mar Ku Dabaq Waqtiyada Dhammaan?',
      message: `Ma hubtaa inaad waqtiyadan aad sare ku sameysay (Xiisada 1aad: ${s1Info}, Istiraaxo: ${b1Info}, Xiisada 2aad: ${s2Info}) hal mar ku dabaqdo dhammaan ${totalSubsCount} maaddo ee ku jira ${examsToUpdate.length} imtixaan ee Faraca "${branchName}"? Dhammaan fasallada iyo maaddooyinka waxay yeelan doonaan waqtiyo iyo istiraaxo isku mid ah.`,
      confirmText: 'Haa, Hal Mar Ku Dabaq',
      cancelText: 'Iska Daay'
    });
    if (!ok) return;

    try {
      setSaving(true);
      let updatedCount = 0;

      for (const item of examsToUpdate) {
        const { exam, scheduledSubs } = item;
        const dayGroups = groupSubjectsByDate(scheduledSubs);
        for (const group of dayGroups) {
          for (let idx = 0; idx < group.subjects.length; idx++) {
            const sub = group.subjects[idx];
            const timingCfg = defaultTimings.sessions[idx] || defaultTimings.sessions[0];
            const payload = {
              name: sub.name,
              code: sub.code || '',
              session: timingCfg.session || (idx === 0 ? 'Qaybta 1aad' : idx === 1 ? 'Qaybta 2aad' : 'Qaybta 3aad'),
              day: sub.day,
              date: sub.date,
              startTime: timingCfg.startTime,
              endTime: timingCfg.endTime,
              duration: timingCfg.duration,
              fullMarks: sub.fullMarks,
              room: sub.room || ''
            };
            await api.put(`/exams/${exam._id}/schedule/${sub._id}`, payload);
            updatedCount++;
          }
        }
      }

      showAlert({
        type: 'success',
        title: 'Waa Lagu Dabaqay Dhammaan!',
        message: `Waqtiyada caadiga ah waxaa hal mar si guul leh loogu dabaqay dhammaan ${updatedCount} maaddo ee Faraca "${branchName}". Dhammaan fasalladu hadda waxay leeyihiin waqtiyo iyo istiraaxooyin isku mid ah.`
      });
      setIsTimingsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error applying timings batch', err);
      showAlert({
        type: 'danger',
        title: 'Cilad',
        message: 'Laguma dabaqi karin dhammaan waqtiyada.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Update a single field inside a specific session in Modal
  const updateSessionField = (sessionIdx, field, value) => {
    setForm(prev => {
      const updated = (prev.sessions || []).map((s, i) => {
        if (i !== sessionIdx) return s;
        const nextS = { ...s, [field]: value };
        if (field === 'startTime' || field === 'duration') {
          const dur = field === 'duration' ? value : nextS.duration;
          const st = field === 'startTime' ? value : nextS.startTime;
          const end = computeEndTime(st, dur);
          if (end) nextS.endTime = end;
        } else if (field === 'endTime') {
          const dur = computeDuration(nextS.startTime, value);
          if (dur) nextS.duration = dur;
        }
        return nextS;
      });
      return { ...prev, sessions: updated };
    });
  };

  // Pick a subject from dropdown for a session
  const handlePickSubjectForSession = (sessionIdx, subjectName) => {
    const picked = classRegisteredSubjects.find(s => s.name === subjectName);
    if (picked) {
      setForm(prev => {
        const updated = (prev.sessions || []).map((s, i) => {
          if (i !== sessionIdx) return s;
          return {
            ...s,
            name: picked.name,
            code: picked.code || ''
          };
        });
        return { ...prev, sessions: updated };
      });
    }
  };

  // Add another session for the day (up to 3 or 4)
  const handleAddSession = () => {
    if ((form.sessions || []).length >= 4) return;
    const examObj = exams.find(e => String(e._id) === String(form.examId));
    const maxM = examObj?.maxMarks || 100;
    const newIdx = (form.sessions || []).length;

    const scheduledNames = new Set((examObj?.subjects || [])
      .filter(s => Boolean(s.date || s.examDate))
      .map(s => s.name.trim().toLowerCase())
    );
    const chosenInForm = new Set((form.sessions || []).map(s => (s.name || '').trim().toLowerCase()).filter(Boolean));
    const nextSub = classRegisteredSubjects.find(s => {
      const sn = s.name.trim().toLowerCase();
      return !scheduledNames.has(sn) && !chosenInForm.has(sn);
    });

    setForm(prev => ({
      ...prev,
      sessions: [...(prev.sessions || []), createDefaultSession(newIdx, maxM, nextSub, defaultTimings)]
    }));
  };

  // Remove a session
  const handleRemoveSession = (sessionIdx) => {
    if ((form.sessions || []).length <= 1) return;
    setForm(prev => ({
      ...prev,
      sessions: prev.sessions.filter((_, i) => i !== sessionIdx)
    }));
  };

  // Set exact session count (1, 2, or 3)
  const setSessionCount = (count) => {
    const cur = (form.sessions || []).slice();
    const examObj = exams.find(e => String(e._id) === String(form.examId));
    const maxM = examObj?.maxMarks || 100;

    if (count > cur.length) {
      const scheduledNames = new Set((examObj?.subjects || [])
        .filter(s => Boolean(s.date || s.examDate))
        .map(s => s.name.trim().toLowerCase())
      );
      const chosenInForm = new Set(cur.map(s => (s.name || '').trim().toLowerCase()).filter(Boolean));
      const remaining = classRegisteredSubjects.filter(s => {
        const sn = s.name.trim().toLowerCase();
        return !scheduledNames.has(sn) && !chosenInForm.has(sn);
      });

      let remIdx = 0;
      for (let i = cur.length; i < count; i++) {
        cur.push(createDefaultSession(i, maxM, remaining[remIdx++], defaultTimings));
      }
    } else if (count < cur.length) {
      cur.splice(count);
    }
    setForm(prev => ({ ...prev, sessions: cur }));
  };

  // Open modal to add schedule
  const handleOpenAdd = (targetExamId = null) => {
    setEditingEntry(null);
    const chosenExamId = targetExamId || selectedExamId || classExams[0]?._id || '';
    const examObj = exams.find(e => String(e._id) === String(chosenExamId));
    const initialDate = examObj?.startDate
      ? new Date(examObj.startDate).toISOString().slice(0, 10)
      : (examObj?.examDate ? new Date(examObj.examDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

    // Exclude already scheduled subjects for this exam
    const scheduledNames = new Set((examObj?.subjects || [])
      .filter(s => Boolean(s.date || s.examDate))
      .map(s => s.name.trim().toLowerCase())
    );
    const unaddedSubjects = classRegisteredSubjects.filter(s => !scheduledNames.has(s.name.trim().toLowerCase()));

    // Default to 2 sessions (or 1 if only 1 unscheduled subject remains)
    const initialCount = unaddedSubjects.length === 1 ? 1 : 2;
    const initialSessions = [];
    for (let i = 0; i < initialCount; i++) {
      initialSessions.push(createDefaultSession(i, examObj?.maxMarks || 100, unaddedSubjects[i], defaultTimings));
    }

    setForm({
      examId: chosenExamId,
      date: initialDate,
      day: formatDisplayDay(initialDate, '', locale),
      sessions: initialSessions
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing schedule entry
  const handleOpenEdit = (exam, subject) => {
    setEditingEntry({ examId: exam._id, subjectId: subject._id || subject.name });
    const targetDate = subject.date ? new Date(subject.date).toISOString().slice(0, 10) : (subject.examDate ? new Date(subject.examDate).toISOString().slice(0, 10) : '');
    const startT = formatDisplayTime(subject.startTime || defaultTimings.sessions[0]?.startTime || '08:10:00');
    const durN = Number(subject.duration) || defaultTimings.sessions[0]?.duration || 60;
    const endT = subject.endTime ? formatDisplayTime(subject.endTime) : computeEndTime(startT, durN);

    setForm({
      examId: exam._id,
      date: targetDate,
      day: subject.day || formatDisplayDay(targetDate, '', locale),
      sessions: [
        {
          name: subject.name || '',
          code: subject.code || '',
          session: subject.session || 'Qaybta 1aad',
          startTime: startT,
          endTime: endT,
          duration: durN,
          fullMarks: subject.fullMarks || exam.maxMarks || 100,
          room: subject.room || ''
        }
      ]
    });
    setIsModalOpen(true);
  };

  // Handle deleting a scheduled subject entry
  const handleDeleteSchedule = async (exam, subject) => {
    const subTitle = `${subject.name}${subject.code ? ` (${subject.code})` : ''}`;
    const ok = await showConfirm({
      type: 'warning',
      title: t('exams.timetable.deleteConfirm', { subject: subTitle }),
      message: `Ma hubtaa inaad maaddada "${subTitle}" ka saarto jadwalka imtixaankan?`,
      confirmText: t('common.yesDelete'),
      cancelText: t('common.cancel'),
      danger: true
    });
    if (!ok) return;

    try {
      const subjectIdentifier = subject._id || subject.name;
      await api.delete(`/exams/${exam._id}/schedule/${subjectIdentifier}`);
      showAlert({ type: 'success', title: t('common.deleted'), message: t('exams.timetable.deleted') });
      await fetchData();
    } catch (error) {
      console.error(error);
      showAlert({ type: 'danger', title: t('common.error'), message: error.response?.data?.message || 'Failed to remove schedule entry' });
    }
  };

  // Handle purging unscheduled subjects that were auto-populated without a schedule
  const handleCleanUnscheduled = async (exam) => {
    const unscheduledCount = (exam.subjects || []).filter(s => !s.date && !s.examDate).length;
    if (unscheduledCount === 0) return;

    const ok = await showConfirm({
      type: 'warning',
      title: 'Ka saar maaddooyinka aan jadwalka lahayn?',
      message: `Ma hubtaa inaad imtixaanka "${exam.title}" ka saarto ${unscheduledCount} maaddo oo toos u soo galay oo aan taariikh iyo jadwal loo dejin?`,
      confirmText: 'Haa, Ka Saar',
      cancelText: t('common.cancel'),
      danger: true
    });
    if (!ok) return;

    try {
      await api.delete(`/exams/${exam._id}/schedule/unscheduled`);
      showAlert({ type: 'success', title: t('common.deleted'), message: 'Maaddooyinkii aan jadwalka lahayn waa laga saaray imtixaankan.' });
      await fetchData();
    } catch (error) {
      console.error(error);
      showAlert({ type: 'danger', title: t('common.error'), message: error.response?.data?.message || 'Failed to remove unscheduled subjects' });
    }
  };

  // Submit Schedule Form (Add or Edit)
  const handleSubmitSchedule = async (e) => {
    e.preventDefault();

    if (!form.examId) {
      return showAlert({ type: 'warning', title: t('exams.manage.validation'), message: 'Fadlan dooro imtixaanka.' });
    }

    if (!form.date) {
      return showAlert({ type: 'warning', title: t('exams.manage.validation'), message: t('exams.timetable.dateValidation') });
    }

    if (!form.sessions?.length) {
      return showAlert({ type: 'warning', title: t('exams.manage.validation'), message: 'Fadlan ku dar ugu yaraan hal maaddo.' });
    }

    // Validate each session
    for (let i = 0; i < form.sessions.length; i++) {
      const s = form.sessions[i];
      if (!s.name?.trim()) {
        return showAlert({
          type: 'warning',
          title: t('exams.manage.validation'),
          message: form.sessions.length === 1
            ? 'Fadlan dooro ama qor magaca maaddada.'
            : `Fadlan dooro ama qor magaca maaddada #${i + 1} (${s.session || `Qaybta ${i + 1}aad`}).`
        });
      }

      const dur = Number(s.duration);
      if (isNaN(dur) || dur <= 0) {
        return showAlert({
          type: 'warning',
          title: t('exams.manage.validation'),
          message: `Muddada maaddada "${s.name}" waa inay ka weynaataa 0 daqiiqo.`
        });
      }
    }

    // Check duplicate subjects within the day
    const namesInDay = form.sessions.map(s => s.name.trim().toLowerCase());
    if (new Set(namesInDay).size !== namesInDay.length) {
      return showAlert({
        type: 'warning',
        title: t('exams.manage.validation'),
        message: 'Maaddooyinka isla maalinta la galayo ma noqon karaan isku maaddo.'
      });
    }

    try {
      setSaving(true);

      if (editingEntry) {
        const s = form.sessions[0];
        const cfg = defaultTimings?.sessions?.[0];
        const dur = Number(s.duration) || cfg?.duration || 60;
        const startT = s.startTime?.trim() || cfg?.startTime || '08:10:00';
        const endT = s.endTime ? s.endTime.trim() : computeEndTime(startT, dur);
        const payload = {
          name: s.name.trim(),
          code: (s.code || '').trim(),
          session: s.session || cfg?.session || 'Qaybta 1aad',
          day: form.day || formatDisplayDay(form.date, '', locale),
          date: form.date,
          startTime: startT,
          endTime: endT,
          duration: dur,
          fullMarks: Number(s.fullMarks) || 100,
          room: s.room?.trim() || ''
        };
        await api.put(`/exams/${editingEntry.examId}/schedule/${editingEntry.subjectId}`, payload);
      } else {
        const subjectsPayload = form.sessions.map((s, idx) => {
          const cfg = defaultTimings?.sessions?.[idx];
          const dur = Number(s.duration) || cfg?.duration || 60;
          const startT = s.startTime?.trim() || cfg?.startTime || (idx === 0 ? '08:10:00' : idx === 1 ? '09:40:00' : '11:10:00');
          const endT = s.endTime ? s.endTime.trim() : (cfg?.endTime || computeEndTime(startT, dur));
          return {
            name: s.name.trim(),
            code: (s.code || '').trim(),
            session: s.session || cfg?.session || (idx === 0 ? 'Qaybta 1aad' : idx === 1 ? 'Qaybta 2aad' : 'Qaybta 3aad'),
            day: form.day || formatDisplayDay(form.date, '', locale),
            date: form.date,
            startTime: startT,
            endTime: endT,
            duration: dur,
            fullMarks: Number(s.fullMarks) || 100,
            room: s.room?.trim() || ''
          };
        });

        await api.post(`/exams/${form.examId}/schedule`, { subjects: subjectsPayload });
      }

      showAlert({ type: 'success', title: t('common.saved'), message: t('exams.timetable.saved') });
      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error(error);
      showAlert({
        type: 'danger',
        title: t('common.error'),
        message: error.response?.data?.message || 'Failed to save schedule entry'
      });
    } finally {
      setSaving(false);
    }
  };

  const instituteName = settings?.businessInfo?.name || 'MACHADKA SALAAX ALDAAREYN';
  const currentClassObj = classes.find(c => String(c._id) === selectedClassId);

  // PDF Export matching the attached reference image
  const handleExportPDF = () => {
    if (!displayedExams.length) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Top Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Exam Timetable', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const classTxt = currentClassObj ? `Class: ${classLabel(currentClassObj, '')}` : '';
    const teacherTxt = activeTeacherObj ? `Teacher: ${activeTeacherObj.fullName || activeTeacherObj.name}` : (isTeacher ? `Teacher: ${currentUser?.fullName || currentUser?.name}` : '');
    const instTxt = instituteName.toUpperCase();
    const metaParts = [instTxt, classTxt, teacherTxt].filter(Boolean);
    doc.text(metaParts.join('   |   '), 14, 24);

    let y = 32;
    const x0 = 14;
    const tableW = pageW - 28;
    const colDayW = 22;
    const colDateW = 24;
    const colSessionW = 26;
    const colSubjectW = 44;
    const colTimeW = 22;
    const colEndTimeW = 22;
    const colDurationW = tableW - (colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW);

    displayedExams.forEach((exam) => {
      // Only include subjects that have an actual schedule date
      const subjects = (exam.subjects || [])
        .filter(s => Boolean(s.date || s.examDate))
        .filter(s => !activeTeacherId || isSubjectForTeacher(s, exam.classId, activeTeacherId))
        .slice()
        .sort((a, b) => {
          const dA = a.date || '';
          const dB = b.date || '';
          if (dA !== dB) return dA.localeCompare(dB);
          return (a.startTime || '').localeCompare(b.startTime || '');
        });

      if (!subjects.length) return;

      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Section Header (Light-Gray background bar matching attached image)
      doc.setFillColor(243, 244, 246); // light gray #f3f4f6
      doc.rect(x0, y, tableW, 9, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(x0, y, tableW, 9, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(31, 41, 55);
      const sectionTitle = exam.title || `${exam.examType} Examination`;
      doc.text(sectionTitle, x0 + 4, y + 6);

      y += 9;

      // Table Column Headers
      doc.setFillColor(255, 255, 255);
      doc.rect(x0, y, tableW, 8, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(x0, y, tableW, 8, 'S');

      // Vertical header dividers
      doc.line(x0 + colDayW, y, x0 + colDayW, y + 8);
      doc.line(x0 + colDayW + colDateW, y, x0 + colDayW + colDateW, y + 8);
      doc.line(x0 + colDayW + colDateW + colSessionW, y, x0 + colDayW + colDateW + colSessionW, y + 8);
      doc.line(x0 + colDayW + colDateW + colSessionW + colSubjectW, y, x0 + colDayW + colDateW + colSessionW + colSubjectW, y + 8);
      doc.line(x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW, y, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW, y + 8);
      doc.line(x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW, y, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(75, 85, 99);
      doc.text('DAY', x0 + colDayW / 2, y + 5.5, { align: 'center' });
      doc.text('DATE', x0 + colDayW + colDateW / 2, y + 5.5, { align: 'center' });
      doc.text('SESSION / MAADDO', x0 + colDayW + colDateW + colSessionW / 2, y + 5.5, { align: 'center' });
      doc.text('SUBJECT', x0 + colDayW + colDateW + colSessionW + 3, y + 5.5);
      doc.text('START TIME', x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW / 2, y + 5.5, { align: 'center' });
      doc.text('END TIME', x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW / 2, y + 5.5, { align: 'center' });
      doc.text('DURATION', x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW + colDurationW / 2, y + 5.5, { align: 'center' });

      y += 8;

      if (!subjects.length) {
        doc.rect(x0, y, tableW, 8, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.text('No scheduled subjects yet', x0 + 4, y + 5.5);
        y += 8 + 6;
        return;
      }

      // Group by date for Daily block timetable
      const dayGroups = groupSubjectsByDate(subjects);
      dayGroups.forEach((group) => {
        const blockH = 8 * group.subjects.length;
        if (y + blockH > 270) {
          doc.addPage();
          y = 20;
        }

        // Outer block rect for day
        doc.setFillColor(255, 255, 255);
        doc.rect(x0, y, tableW, blockH, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.rect(x0, y, tableW, blockH, 'S');

        // Spanning dividers for DAY and DATE
        doc.line(x0 + colDayW, y, x0 + colDayW, y + blockH);
        doc.line(x0 + colDayW + colDateW, y, x0 + colDayW + colDateW, y + blockH);

        const firstSub = group.subjects[0];
        const dayStr = formatDisplayDay(firstSub.date || firstSub.examDate, firstSub.day, locale);
        const dateStr = formatDisplayDate(firstSub.date || firstSub.examDate);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(31, 41, 55);
        doc.text(dayStr, x0 + colDayW / 2, y + (blockH / 2) + 2.5, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, x0 + colDayW + colDateW / 2, y + (blockH / 2) + 2.5, { align: 'center' });

        group.subjects.forEach((s, subIdx) => {
          const rowY = y + (subIdx * 8);

          if (subIdx > 0) {
            doc.line(x0 + colDayW + colDateW, rowY, x0 + tableW, rowY);
          }

          doc.line(x0 + colDayW + colDateW + colSessionW, rowY, x0 + colDayW + colDateW + colSessionW, rowY + 8);
          doc.line(x0 + colDayW + colDateW + colSessionW + colSubjectW, rowY, x0 + colDayW + colDateW + colSessionW + colSubjectW, rowY + 8);
          doc.line(x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW, rowY, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW, rowY + 8);
          doc.line(x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW, rowY, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW, rowY + 8);

          const sessionTxt = s.session || (subIdx === 0 ? 'Qaybta 1aad' : 'Qaybta 2aad');
          const subTitle = `${s.name}${s.code ? ` (${s.code})` : ''}`;
          const startT = formatDisplayTime(s.startTime);
          const endT = s.endTime ? formatDisplayTime(s.endTime) : formatDisplayTime(computeEndTime(s.startTime, s.duration));

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(55, 65, 81);
          doc.text(sessionTxt, x0 + colDayW + colDateW + colSessionW / 2, rowY + 5.5, { align: 'center' });
          doc.text(subTitle, x0 + colDayW + colDateW + colSessionW + 3, rowY + 5.5);

          doc.setFont('helvetica', 'normal');
          doc.text(startT, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW / 2, rowY + 5.5, { align: 'center' });
          doc.text(endT, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW / 2, rowY + 5.5, { align: 'center' });
          doc.text(`${s.duration || 90} min`, x0 + colDayW + colDateW + colSessionW + colSubjectW + colTimeW + colEndTimeW + colDurationW / 2, rowY + 5.5, { align: 'center' });
        });

        y += blockH;
      });

      y += 8; // Spacing between sections
    });

    doc.save(`Exam_Timetable_${classLabel(currentClassObj, 'Class').replace(/\s+/g, '_')}.pdf`);
  };

  // PDF Export for Branch Master Timetable Sheet (matching user sketch)
  const handleExportBranchPDF = () => {
    if (!branchMasterSchedule.length) {
      showAlert({
        type: 'warning',
        title: 'Ma jiraan imtixaanno',
        message: 'Faracan weli ma laha maaddooyin ama imtixaanno jadwalkooda la dhigay oo la dhoofin karo.'
      });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(); // 297mm

    const x0 = 12;
    const tableW = pageW - 24; // 273mm

    const branchName = currentBranchObj?.name || 'Dhammaan Laamaha';

    // Header Top
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(instituteName.toUpperCase(), pageW / 2, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`WARAAQDA JADWALKA GUUD EE IMTIXAANKA - FARACA: ${branchName.toUpperCase()}`, pageW / 2, 20, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const metaParts = [];
    if (activeTeacherObj || isTeacher) {
      metaParts.push(`Macallinka: ${(activeTeacherObj || currentUser)?.fullName || (activeTeacherObj || currentUser)?.name}`);
    }
    if (termFilter) metaParts.push(`Termiga: ${termFilter}`);
    if (yearFilter) metaParts.push(`Sanad Dugsiyeedka: ${yearFilter}`);
    metaParts.push(`Taariikhda: ${new Date().toLocaleDateString()}`);
    doc.text(metaParts.join('   |   '), pageW / 2, 25, { align: 'center' });

    let y = 30;

    // Column widths total = 273mm
    const colDayW = 32;
    const colClassW = 40;
    const colSess1W = 52;
    const colBreak1W = 23;
    const colSess2W = 52;
    const colBreak2W = 23;
    const colSess3W = 51;

    const drawHeader = (currY) => {
      // Background
      doc.setFillColor(30, 41, 59); // dark slate
      doc.rect(x0, currY, tableW, 9, 'F');
      doc.setDrawColor(15, 23, 42);
      doc.rect(x0, currY, tableW, 9, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);

      doc.text('MAALINTA / DATE', x0 + colDayW / 2, currY + 6, { align: 'center' });
      doc.text('FASALKA', x0 + colDayW + 3, currY + 6);
      doc.text('XIISADA 1AAD (SESSION 1)', x0 + colDayW + colClassW + colSess1W / 2, currY + 6, { align: 'center' });
      doc.text('ISTIRAAXO', x0 + colDayW + colClassW + colSess1W + colBreak1W / 2, currY + 6, { align: 'center' });
      doc.text('XIISADA 2AAD (SESSION 2)', x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W / 2, currY + 6, { align: 'center' });
      doc.text('ISTIRAAXO', x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W / 2, currY + 6, { align: 'center' });
      doc.text('XIISADA 3AAD (SESSION 3)', x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W + colSess3W / 2, currY + 6, { align: 'center' });
    };

    drawHeader(y);
    y += 9;

    branchMasterSchedule.forEach((dayEntry) => {
      const rows = dayEntry.rows;
      if (!rows.length) return;

      const rowH = 8.5;
      const dayBlockH = rowH * rows.length;

      // Page break check
      if (y + dayBlockH > 195) {
        doc.addPage();
        y = 15;
        drawHeader(y);
        y += 9;
      }

      // Outer bounding box for day
      doc.setFillColor(255, 255, 255);
      doc.rect(x0, y, tableW, dayBlockH, 'F');
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.rect(x0, y, tableW, dayBlockH, 'S');

      // Day / Date column background & spanning rect
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(x0, y, colDayW, dayBlockH, 'F');
      doc.rect(x0, y, colDayW, dayBlockH, 'S');

      // Spanning Day & Date text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(dayEntry.displayDay, x0 + colDayW / 2, y + (dayBlockH / 2) - 1.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(dayEntry.displayDate, x0 + colDayW / 2, y + (dayBlockH / 2) + 3.5, { align: 'center' });

      // Rows for each class
      rows.forEach((row, rIdx) => {
        const rowY = y + (rIdx * rowH);

        // Row bottom line (between classes)
        if (rIdx < rows.length - 1) {
          doc.setDrawColor(203, 213, 225); // slate-300
          doc.line(x0 + colDayW, rowY + rowH, x0 + tableW, rowY + rowH);
        }

        // Vertical dividers
        doc.setDrawColor(203, 213, 225);
        doc.line(x0 + colDayW + colClassW, rowY, x0 + colDayW + colClassW, rowY + rowH);
        doc.line(x0 + colDayW + colClassW + colSess1W, rowY, x0 + colDayW + colClassW + colSess1W, rowY + rowH);
        doc.line(x0 + colDayW + colClassW + colSess1W + colBreak1W, rowY, x0 + colDayW + colClassW + colSess1W + colBreak1W, rowY + rowH);
        doc.line(x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W, rowY, x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W, rowY + rowH);
        doc.line(x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W, rowY, x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W, rowY + rowH);

        // Class Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const cName = row.classObj.name || row.classObj.className || 'Fasal';
        doc.text(cName, x0 + colDayW + 3, rowY + 5.5);

        // Session 1
        if (row.session1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          const s1Txt = row.session1.name;
          const s1Time = `${row.session1.startTime?.slice(0, 5) || ''}-${row.session1.endTime?.slice(0, 5) || ''}`;
          doc.text(`${s1Txt}  ${s1Time}`, x0 + colDayW + colClassW + colSess1W / 2, rowY + 5.5, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(156, 163, 175);
          doc.text('—', x0 + colDayW + colClassW + colSess1W / 2, rowY + 5.5, { align: 'center' });
        }

        // Break 1
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        if (row.break1) {
          doc.setTextColor(180, 83, 9); // amber-700
          doc.text(`${row.break1} min`, x0 + colDayW + colClassW + colSess1W + colBreak1W / 2, rowY + 5.5, { align: 'center' });
        } else {
          doc.setTextColor(156, 163, 175);
          doc.text('—', x0 + colDayW + colClassW + colSess1W + colBreak1W / 2, rowY + 5.5, { align: 'center' });
        }

        // Session 2
        if (row.session2) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          const s2Txt = row.session2.name;
          const s2Time = `${row.session2.startTime?.slice(0, 5) || ''}-${row.session2.endTime?.slice(0, 5) || ''}`;
          doc.text(`${s2Txt}  ${s2Time}`, x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W / 2, rowY + 5.5, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(156, 163, 175);
          doc.text('—', x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W / 2, rowY + 5.5, { align: 'center' });
        }

        // Break 2
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        if (row.break2) {
          doc.setTextColor(180, 83, 9); // amber-700
          doc.text(`${row.break2} min`, x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W / 2, rowY + 5.5, { align: 'center' });
        } else {
          doc.setTextColor(156, 163, 175);
          doc.text('—', x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W / 2, rowY + 5.5, { align: 'center' });
        }

        // Session 3
        if (row.session3) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          const s3Txt = row.session3.name;
          const s3Time = `${row.session3.startTime?.slice(0, 5) || ''}-${row.session3.endTime?.slice(0, 5) || ''}`;
          doc.text(`${s3Txt}  ${s3Time}`, x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W + colSess3W / 2, rowY + 5.5, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(156, 163, 175);
          doc.text('—', x0 + colDayW + colClassW + colSess1W + colBreak1W + colSess2W + colBreak2W + colSess3W / 2, rowY + 5.5, { align: 'center' });
        }
      });

      y += dayBlockH + 2; // small gap between days
    });

    const safeBranch = branchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Waraaqda_Jadwalka_${safeBranch}.pdf`);
  };

  // PDF Export for Teacher Personal Timetable
  const handleExportTeacherPDF = () => {
    if (!teacherPersonalSchedule.length) {
      showAlert({
        type: 'warning',
        title: 'Ma jiraan maaddooyin',
        message: 'Macallinkan weli ma laha maaddooyin ama imtixaanno jadwalkooda la dhigay oo la dhoofin karo.'
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(); // 210mm
    const pageH = doc.internal.pageSize.getHeight(); // 297mm
    const x0 = 12;
    const tableW = pageW - 24; // 186mm

    const teacherName = activeTeacherObj?.fullName || activeTeacherObj?.name || (isTeacher ? (currentUser?.fullName || currentUser?.name) : 'Macallin');
    const branchName = currentBranchObj?.name || 'Dhammaan Laamaha';

    // Header Top
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(instituteName.toUpperCase(), pageW / 2, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('JADWALKA IMTIXAANKA EE MACALLINKA (TEACHER TIMETABLE)', pageW / 2, 20, { align: 'center' });

    // Meta Badge Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x0, 24, tableW, 14, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Macallinka: ${teacherName}`, x0 + 4, 30);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const metaParts = [`Faraca: ${branchName}`];
    if (termFilter) metaParts.push(`Term: ${termFilter}`);
    if (yearFilter) metaParts.push(`Sanad: ${yearFilter}`);
    metaParts.push(`Isugeynta: ${teacherPersonalSchedule.length} Xiisadood`);
    metaParts.push(`La daabacay: ${new Date().toLocaleDateString()}`);
    doc.text(metaParts.join('   |   '), x0 + 4, 35);

    let y = 43;

    // Column widths: 186mm total
    const colIdxW = 8;
    const colDayW = 28;
    const colTimeW = 32;
    const colClassW = 32;
    const colSubW = 46;
    const colRoomW = 20;
    const colDurW = 20;

    const drawHeader = (currY) => {
      doc.setFillColor(30, 41, 59);
      doc.rect(x0, currY, tableW, 8.5, 'F');
      doc.setDrawColor(15, 23, 42);
      doc.rect(x0, currY, tableW, 8.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);

      doc.text('#', x0 + colIdxW / 2, currY + 5.5, { align: 'center' });
      doc.text('MAALINTA & TAARIIKHDA', x0 + colIdxW + 2, currY + 5.5);
      doc.text('WAQTIGA & QAYBTA', x0 + colIdxW + colDayW + 2, currY + 5.5);
      doc.text('FASALKA', x0 + colIdxW + colDayW + colTimeW + 2, currY + 5.5);
      doc.text('MAADDADA', x0 + colIdxW + colDayW + colTimeW + colClassW + 2, currY + 5.5);
      doc.text('QOLKA', x0 + colIdxW + colDayW + colTimeW + colClassW + colSubW + 2, currY + 5.5);
      doc.text('MUDDADA', x0 + colIdxW + colDayW + colTimeW + colClassW + colSubW + colRoomW + colDurW / 2, currY + 5.5, { align: 'center' });
    };

    drawHeader(y);
    y += 8.5;

    teacherPersonalSchedule.forEach((row, i) => {
      const rowH = 8;
      if (y + rowH > pageH - 25) {
        doc.addPage();
        y = 15;
        drawHeader(y);
        y += 8.5;
      }

      // Zebra background
      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(x0, y, tableW, rowH, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.rect(x0, y, tableW, rowH, 'S');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);

      // #
      doc.text(String(i + 1), x0 + colIdxW / 2, y + 5.2, { align: 'center' });

      // Maalinta & Taariikhda
      doc.setFont('helvetica', 'bold');
      const dDay = formatDisplayDay(row.date, row.day, locale);
      const dDate = formatDisplayDate(row.date);
      doc.text(`${dDay}, ${dDate}`, x0 + colIdxW + 2, y + 5.2);

      // Waqtiga & Qaybta
      doc.setFont('helvetica', 'normal');
      const timeStr = `${row.startTime ? row.startTime.slice(0, 5) : '—'} - ${row.endTime ? row.endTime.slice(0, 5) : '—'}`;
      doc.text(`${timeStr} (${row.session})`, x0 + colIdxW + colDayW + 2, y + 5.2);

      // Fasalka
      doc.setFont('helvetica', 'bold');
      doc.text(row.className, x0 + colIdxW + colDayW + colTimeW + 2, y + 5.2);

      // Maaddada
      doc.text(row.subjectName + (row.subjectCode ? ` (${row.subjectCode})` : ''), x0 + colIdxW + colDayW + colTimeW + colClassW + 2, y + 5.2);

      // Qolka
      doc.setFont('helvetica', 'normal');
      doc.text(row.room || '—', x0 + colIdxW + colDayW + colTimeW + colClassW + colSubW + 2, y + 5.2);

      // Muddada
      doc.text(`${row.duration} min`, x0 + colIdxW + colDayW + colTimeW + colClassW + colSubW + colRoomW + colDurW / 2, y + 5.2, { align: 'center' });

      y += rowH;
    });

    // Signature footer
    y += 12;
    if (y + 20 > pageH - 10) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(148, 163, 184);
    doc.line(x0 + 10, y, x0 + 65, y);
    doc.line(pageW - x0 - 65, y, pageW - x0 - 10, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Saxiixa Macallinka', x0 + 37.5, y + 5, { align: 'center' });
    doc.text('Saxiixa & Shaabadda Maamulka', pageW - x0 - 37.5, y + 5, { align: 'center' });

    const safeName = teacherName.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Jadwalka_Imtixaanka_Macallin_${safeName}.pdf`);
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500 font-bold">{t('exams.manage.loading')}</div>;
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('exams.timetable.title') || 'Exam Timetable'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
            {t('exams.timetable.subtitle') || 'Jadwalka Imtixaanka & Maaddooyinka'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap print:hidden">
          {!isTeacher && (
            <button
              type="button"
              onClick={() => setIsTimingsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 active:scale-95"
              title="Deji waqtiyada caadiga ah ee 3-da qaybood iyo nasashada (break)"
            >
              <Clock size={16} />
              <span>Waqtiyada Caadiga ah</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold">
                {defaultTimings.sessions[0]?.startTime?.slice(0, 5) || '08:10'}
              </span>
            </button>
          )}

          {!isTeacher && (
            <button
              onClick={() => handleOpenAdd()}
              disabled={!classExams.length}
              className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-brand-600/30 active:scale-95 disabled:opacity-50"
            >
              <Plus size={16} />
              {t('exams.timetable.addSchedule') || 'Qorshee Maaddo'}
            </button>
          )}

          <button
            onClick={() => window.print()}
            disabled={
              viewMode === 'teacher'
                ? !teacherPersonalSchedule.length
                : viewMode === 'branch'
                ? !branchMasterSchedule.length
                : !displayedExams.length
            }
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
          >
            <Printer size={16} />
            {t('exams.timetable.print') || 'Daabac'}
          </button>

          <button
            onClick={() => {
              if (viewMode === 'teacher') {
                handleExportTeacherPDF();
              } else if (viewMode === 'branch') {
                handleExportBranchPDF();
              } else {
                handleExportPDF();
              }
            }}
            disabled={
              viewMode === 'teacher'
                ? !teacherPersonalSchedule.length
                : viewMode === 'branch'
                ? !branchMasterSchedule.length
                : !displayedExams.length
            }
            className="flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
          >
            <FileDown size={16} />
            PDF
          </button>
        </div>
      </div>

      {/* Teacher Mode Notice Banner */}
      {isTeacher && currentUser && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-brand-50/90 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800 text-xs text-brand-900 dark:text-brand-200 shadow-xs print:hidden">
          <div className="flex items-center gap-2 font-bold">
            <GraduationCap size={16} className="text-brand-600 dark:text-brand-400" />
            <span>{t('teacherMode', 'Xisaabta Macallinka')}:</span>
            <span className="font-black underline text-slate-900 dark:text-white">{currentUser.fullName || currentUser.name}</span>
            <span className="text-slate-500 font-normal">· Jadwalkaaga imtixaanka waxaa ku qoran kaliya maaddooyinka laguu qoray iyo xilliyada fasalladu galayaan.</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-black uppercase tracking-wider">
            Macallin
          </span>
        </div>
      )}

      {/* Landscape print styles when in branch master timetable mode */}
      {viewMode === 'branch' && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: landscape;
              margin: 8mm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        ` }} />
      )}

      {/* Portrait print styles when in teacher schedule mode */}
      {viewMode === 'teacher' && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: portrait;
              margin: 10mm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        ` }} />
      )}

      {/* View Mode Switcher: Single Class vs Branch Master vs Teacher Timetable (Visible only for Admins) */}
      {!isTeacher && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3 print:hidden">
          <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-inner flex-wrap gap-1">
            <button
              type="button"
              onClick={() => handleSetViewMode('teacher')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                viewMode === 'teacher'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <GraduationCap size={15} />
              <span>Jadwalka Macallinka (Teacher)</span>
              {teacherPersonalSchedule.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-[10px] font-black">
                  {teacherPersonalSchedule.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSetViewMode('branch')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                viewMode === 'branch'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>Waraaqda Faraca (Branch Sheet)</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 text-[10px] font-black border border-brand-200 dark:border-brand-800">
                {currentBranchObj ? currentBranchObj.name : 'Dhammaan'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSetViewMode('class')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                viewMode === 'class'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <BookOpen size={15} />
              <span>Jadwalka Fasalka (Single Class)</span>
            </button>
          </div>

          {/* Right Info & Teacher Filter (for Admin) */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <User size={13} className="text-brand-600" />
              <span className="text-[11px] font-black uppercase text-slate-400">Macallin:</span>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="bg-transparent outline-none text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="">Dhammaan Macallimiinta (Guud)</option>
                {teachers.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.fullName || t.name || t.email}
                  </option>
                ))}
              </select>
              {selectedTeacherId && (
                <button
                  type="button"
                  onClick={() => setSelectedTeacherId('')}
                  title="Ka saar shaandhada macallinka"
                  className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
              {viewMode === 'teacher' ? (
                <span className="inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 font-bold">
                  <GraduationCap size={13} />
                  {activeTeacherObj ? (
                    <>Macallinka: <strong className="underline uppercase">{activeTeacherObj.fullName || activeTeacherObj.name}</strong></>
                  ) : (
                    'Jadwalka Imtixaanka ee Macallinka'
                  )}
                </span>
              ) : viewMode === 'branch' ? (
                <span className="inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 font-bold">
                  <Building2 size={13} />
                  Faraca: <strong className="underline uppercase">{currentBranchObj?.name || 'Dhammaan Laamaha'}</strong>
                </span>
              ) : (
                <span className="text-slate-400">Jadwalka imtixaanka ee hal fasal oo gaar ah</span>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'teacher' ? (
        <div className="space-y-6">
          {/* TEACHER PERSONAL TIMETABLE VIEW */}
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-800 rounded-[28px] p-6 text-white shadow-xl shadow-brand-600/20 relative overflow-hidden print:bg-none print:text-slate-900 print:p-2 print:shadow-none print:border print:border-slate-300">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl font-black shadow-inner print:hidden">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-sm print:hidden">
                      {isTeacher ? 'Jadwalkaaga Gaarka ah' : 'Jadwalka Macallinka'}
                    </span>
                    {currentBranchObj && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-sm print:hidden">
                        {currentBranchObj.name}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                    {activeTeacherObj ? (activeTeacherObj.fullName || activeTeacherObj.name) : (isTeacher ? (currentUser?.fullName || currentUser?.name) : 'Dooro Macallin')}
                  </h1>
                  <p className="text-xs text-white/80 mt-0.5 max-w-xl">
                    {isTeacher
                      ? 'Halkan waxaa ku qoran kaliya maaddooyinka laguu qoray, fasallada galaaya, maalmaha, iyo xilliyada saxda ah.'
                      : 'Hoos waxaa ku qoran dhammaan maaddooyinka uu macallinkani xilka ka hayo iyo xilliyada imtixaannada fasallada.'}
                  </p>
                </div>
              </div>

              {/* Quick Summary Stats */}
              <div className="flex items-center gap-3 print:hidden">
                <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                  <div className="text-2xl font-black leading-none">{teacherPersonalSchedule.length}</div>
                  <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">Xiisadood</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                  <div className="text-2xl font-black leading-none">
                    {new Set(teacherPersonalSchedule.map(s => s.className)).size}
                  </div>
                  <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">Fasal</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                  <div className="text-2xl font-black leading-none">
                    {new Set(teacherPersonalSchedule.map(s => s.subjectName)).size}
                  </div>
                  <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">Maaddo</div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar: Search & Branch Filter */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-slate-100 dark:border-slate-800 shadow-sm print:hidden flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={teacherSearchTerm}
                onChange={e => setTeacherSearchTerm(e.target.value)}
                placeholder="Raadi maaddo, fasal, maalin, ama qol..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
              />
              {teacherSearchTerm && (
                <button
                  onClick={() => setTeacherSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {branches.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-black uppercase text-slate-400 mr-1">Faraca:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBranchId('')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      !selectedBranchId
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Dhammaan
                  </button>
                  {branches.map(b => (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => setSelectedBranchId(String(b._id))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        String(selectedBranchId) === String(b._id)
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                disabled={!teacherPersonalSchedule.length}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold text-xs transition shadow-sm disabled:opacity-50"
              >
                <Printer size={14} />
                <span>Daabac</span>
              </button>

              <button
                type="button"
                onClick={handleExportTeacherPDF}
                disabled={!teacherPersonalSchedule.length}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
              >
                <FileDown size={14} />
                <span>PDF (A4)</span>
              </button>
            </div>
          </div>

          {/* Admin Picker Grid (If Admin and no teacher chosen yet) */}
          {!activeTeacherId && !isTeacher && (
            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm text-center">
              <div className="w-16 h-16 rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
                <UserCheck size={32} />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Dooro Macallin si aad jadwalkiisa u aragto</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Guji mid ka mid ah macallimiinta hoose si aad u aragto jadwalka imtixaanka ee maaddooyinka uu dhigo fasal kasta.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
                {teachers.map(tch => (
                  <button
                    key={tch._id}
                    onClick={() => setSelectedTeacherId(String(tch._id))}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 text-left transition-all group flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/60 text-brand-600 dark:text-brand-300 flex items-center justify-center font-black text-sm group-hover:scale-105 transition-transform">
                      {(tch.fullName || tch.name || 'M')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-600">
                        {tch.fullName || tch.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {tch.email || tch.phone || 'Macallin'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Teacher Timetable Table */}
          {activeTeacherId && (
            filteredTeacherSchedule.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <GraduationCap size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">
                  Ma Jiraan Maaddooyin Laguu Qoray Oo Jadwalkooda La Dhigay
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  {isTeacher
                    ? 'Weli laguma darin maaddooyinkaaga jadwalka imtixaanka ee socda, ama maaddooyinka laguu xilsaaray weli waqti looma cayimin. Fadlan la xiriir maamulka dugsiga.'
                    : 'Macallinkan weli ma laha maaddooyin jadwalka imtixaanka ku jira.'}
                </p>
                {!isTeacher && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('branch')}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase transition"
                    >
                      Eeg Waraaqda Faraca
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('class')}
                      className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold uppercase transition shadow-md shadow-brand-600/30"
                    >
                      Eeg Jadwalka Fasalka
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="bg-[#f3f4f6] dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-brand-600" />
                    <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider">
                      Jadwalka Imtixaannada ee Macallinka: {activeTeacherObj?.fullName || activeTeacherObj?.name || (currentUser?.fullName || currentUser?.name)}
                    </h2>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Isugeyn: <strong>{filteredTeacherSchedule.length}</strong> xiisadood oo imtixaan ah
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-3 text-center w-12 border-r border-slate-200 dark:border-slate-700">#</th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center w-36">
                          MAALINTA & TAARIIKHDA
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center w-40">
                          WAQTIGA & QAYBTA
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 w-36">
                          FASALKA (CLASS)
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700">
                          MAADDADA (SUBJECT)
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center w-24">
                          MUDDADA
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center w-24">
                          QOLKA
                        </th>
                        <th className="py-3 px-4 text-left w-44">
                          IMTIXAANKA
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {filteredTeacherSchedule.map((item, idx) => {
                        const dDay = formatDisplayDay(item.date, item.day, locale);
                        const dDate = formatDisplayDate(item.date);
                        const timeStr = `${item.startTime ? item.startTime.slice(0, 5) : '—'} - ${item.endTime ? item.endTime.slice(0, 5) : '—'}`;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-200 dark:border-slate-700/60"
                          >
                            <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center">
                              <div className="font-black text-slate-900 dark:text-white text-xs">{dDay}</div>
                              <div className="text-[11px] font-mono font-bold text-slate-500">{dDate}</div>
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs">
                                <Clock size={11} className="text-slate-400" />
                                {timeStr}
                              </span>
                              <div className="text-[10px] font-black text-brand-600 dark:text-brand-400 mt-0.5">
                                {item.session}
                              </div>
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
                              <div>{item.className}</div>
                              <div className="text-[10px] font-bold text-slate-400">{item.branchName}</div>
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-700">
                              <div className="font-black text-slate-900 dark:text-white text-xs">
                                {item.subjectName}
                              </div>
                              {item.subjectCode && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[10px] font-mono font-bold">
                                  {item.subjectCode}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-slate-700 dark:text-slate-300">
                              {item.duration} min
                            </td>
                            <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-slate-700 dark:text-slate-300">
                              {item.room ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px]">
                                  {item.room}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-left">
                              <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {item.examTitle}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {item.term ? `Term: ${item.term}` : ''} {item.academicYear ? `· ${item.academicYear}` : ''}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signature footer (visible on print only) */}
                <div className="hidden print:grid grid-cols-2 gap-12 p-8 pt-16 mt-8 border-t border-slate-200">
                  <div className="text-center">
                    <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-xs">
                      {activeTeacherObj?.fullName || activeTeacherObj?.name || (currentUser?.fullName || currentUser?.name)}
                    </div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Saxiixa Macallinka</div>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-xs">&nbsp;</div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Saxiixa & Shaabadda Maamulka</div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      ) : viewMode === 'branch' ? (
        <div className="space-y-6">
          {/* Branch Master Controls Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm print:hidden space-y-4">
            {/* Quick Branch Selector Pills */}
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5 mr-1">
                  <Building2 size={14} className="text-brand-600" />
                  Dooro Faraca (Branch):
                </span>
                <button
                  type="button"
                  onClick={() => handleBranchChange('')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    !selectedBranchId
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Dhammaan Laamaha ({branches.length})
                </button>
                {branches.map(b => {
                  const isSelected = String(selectedBranchId) === String(b._id);
                  return (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => handleBranchChange(String(b._id))}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-2 ring-brand-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Building2 size={13} />
                      <span>{b.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Faraca: <span className="text-brand-600 dark:text-brand-400 uppercase font-black">{currentBranchObj?.name || 'Dhammaan Laamaha'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
              {/* Branch Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Building2 size={12} className="text-brand-600" />
                  Faraca (Branch Dropdown)
                </label>
                <select
                  value={selectedBranchId}
                  onChange={e => handleBranchChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="">-- Dhammaan Laamaha --</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Term Filter */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                  {t('exams.manage.term') || 'Termiga'}
                </label>
                <select
                  value={termFilter}
                  onChange={e => setTermFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="">-- Dhammaan Termiyada --</option>
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>

              {/* Academic Year Filter */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                  {t('academic.promotion.colYear') || 'Sanad Dugsiyeedka'}
                </label>
                <input
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Toggle: Only classes with exams */}
              <div className="flex items-center">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full hover:bg-slate-100 dark:hover:bg-slate-750 transition">
                  <input
                    type="checkbox"
                    checked={branchOnlyClassesWithExams}
                    onChange={e => setBranchOnlyClassesWithExams(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 rounded border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Keliya kuwa imtixaan leh
                  </span>
                </label>
              </div>
            </div>

            {/* Quick action bar */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {activeBranchClasses.length} Fasal
                </span>
                <span>•</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {branchMasterSchedule.length} Maalmood oo Imtixaan ah
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!isTeacher && (
                  <button
                    type="button"
                    disabled={saving || !branchMasterSchedule.length}
                    onClick={handleApplyTimingsToAllBranchExams}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider transition shadow-sm shadow-amber-500/25 active:scale-95 disabled:opacity-50"
                    title="Waqtiyada caadiga ah ee kor lagu sameeyey hal mar ku dabaq dhammaan fasallada iyo maaddooyinka faracan"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>Ku Dabaq Waqtiyada Faracan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!branchMasterSchedule.length}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  <Printer size={14} />
                  <span>Daabac Waraaqda</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportBranchPDF}
                  disabled={!branchMasterSchedule.length}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  <FileDown size={14} />
                  <span>PDF (A4 Landscape)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Master Table Sheet matching reference sketch */}
          {branchMasterSchedule.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
                <FileSpreadsheet size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">
                Ma Jiraan Imtixaanno Jadwalkooda La Dhigay {currentBranchObj ? `Faraca "${currentBranchObj.name}"` : 'Laamaha'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                {currentBranchObj ? `Faraca "${currentBranchObj.name}"` : 'Dhammaan laamaha'} weli ma laha maaddooyin ama imtixaanno jadwalkooda la dhigay. Fadlan dooro farac kale ama u gudub "Jadwalka Fasalka" si aad u qorsheyso maaddooyinka.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('class')}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold uppercase transition shadow-md shadow-brand-600/30"
                >
                  U Gudub Jadwalka Fasalka
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden shadow-sm print:border-slate-900 print:shadow-none print:rounded-none">
              {/* Document Sheet Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left print:bg-white print:border-b-2 print:border-slate-900 print:p-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight print:text-base">
                    {instituteName}
                  </h2>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-black uppercase text-brand-600 dark:text-brand-400 print:text-slate-900">
                      WARAAQDA JADWALKA GUUD EE IMTIXAANKA
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 print:text-slate-900">
                      FARACA: <strong className="underline uppercase">{currentBranchObj?.name || 'DHAMMAAN LAAMAHA'}</strong>
                    </span>
                    {termFilter && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="text-xs text-slate-500 font-medium">Termiga: {termFilter}</span>
                      </>
                    )}
                    {yearFilter && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="text-xs text-slate-500 font-medium">Sanad Dugsiyeedka: {yearFilter}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500 text-center sm:text-right print:text-[10px]">
                  <div>Taariikhda: {new Date().toLocaleDateString()}</div>
                  <div className="text-[10px] text-slate-400">Qaabka: 3 Qaybood + 2 Nasasho (Break)</div>
                </div>
              </div>

              {/* Table Matrix matching user sketch */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left print:text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider text-center print:bg-slate-900 print:text-white">
                      <th className="py-3 px-3 border-r border-slate-700 w-36 text-center">
                        Maalinta & Taariikhda
                      </th>
                      <th className="py-3 px-3 border-r border-slate-700 w-44 text-left">
                        Fasalka
                      </th>
                      <th className="py-3 px-3 border-r border-slate-700 text-center">
                        Xiisada 1aad (Session 1)
                      </th>
                      <th className="py-3 px-2 border-r border-slate-700 w-24 bg-slate-800 text-amber-300 text-center">
                        Istiraaxo
                      </th>
                      <th className="py-3 px-3 border-r border-slate-700 text-center">
                        Xiisada 2aad (Session 2)
                      </th>
                      <th className="py-3 px-2 border-r border-slate-700 w-24 bg-slate-800 text-amber-300 text-center">
                        Istiraaxo
                      </th>
                      <th className="py-3 px-3 text-center">
                        Xiisada 3aad (Session 3)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {branchMasterSchedule.map((dayEntry) => {
                      const rows = dayEntry.rows;
                      if (!rows.length) return null;

                      return rows.map((row, rIdx) => {
                        const isFirstRowOfDay = rIdx === 0;
                        const isLastRowOfDay = rIdx === rows.length - 1;

                        // Clearly visible horizontal dividing line between classes, and stronger line at end of day
                        const cellBorderBottom = isLastRowOfDay
                          ? 'border-b-2 border-slate-700 dark:border-slate-400 print:border-b-2 print:border-slate-900'
                          : 'border-b-2 border-slate-300 dark:border-slate-700 print:border-b-2 print:border-slate-400';

                        return (
                          <tr
                            key={`${dayEntry.dateKey}-${row.classObj._id}`}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition print:hover:bg-transparent ${
                              !row.hasExam ? 'opacity-60 bg-slate-50/20' : ''
                            }`}
                          >
                            {/* Day & Date Spanning Cell */}
                            {isFirstRowOfDay && (
                              <td
                                rowSpan={rows.length}
                                className="border-r border-b-2 border-slate-700 dark:border-slate-400 bg-slate-50/90 dark:bg-slate-800/80 p-3 text-center align-middle print:bg-slate-100 print:border-b-2 print:border-slate-900 border-slate-300"
                              >
                                <div className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">
                                  {dayEntry.displayDay}
                                </div>
                                <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 mt-1">
                                  {dayEntry.displayDate}
                                </div>
                                <div className="mt-2">
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold print:hidden">
                                    {rows.length} fasal
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* Class Name */}
                            <td className={`border-r px-3 py-3 font-black text-slate-900 dark:text-white bg-slate-50/40 dark:bg-slate-800/30 print:bg-white border-slate-300 dark:border-slate-700 print:border-slate-400 ${cellBorderBottom}`}>
                              <div className="flex items-center justify-between gap-1.5">
                                <div>
                                  <div className="text-xs font-black">{row.classObj.name || row.classObj.className || 'Fasal'}</div>
                                  {!selectedBranchId && (
                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                      {branches.find(b => String(b._id) === String(row.classObj.branchId?._id || row.classObj.branchId))?.name || ''}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const bId = String(row.classObj.branchId?._id || row.classObj.branchId || '');
                                    if (bId) setSelectedBranchId(bId);
                                    setSelectedClassId(String(row.classObj._id));
                                    handleSetViewMode('class');
                                  }}
                                  className="print:hidden text-[10px] font-bold text-brand-600 hover:text-brand-700 hover:underline px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/60"
                                  title="Eeg jadwalka fasalkan kaligiis"
                                >
                                  Eeg
                                </button>
                              </div>
                            </td>

                            {/* Session 1 */}
                            <td className={`border-r p-2.5 text-center align-middle border-slate-300 dark:border-slate-700 print:border-slate-400 ${cellBorderBottom}`}>
                              {row.session1 ? (
                                <div className="space-y-1">
                                  <div className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-tight">
                                    {row.session1.name}
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300 print:border-none print:p-0">
                                    <Clock size={11} className="print:hidden" />
                                    <span>{row.session1.startTime?.slice(0, 5)} - {row.session1.endTime?.slice(0, 5)}</span>
                                  </div>
                                  {row.session1.room && (
                                    <div className="text-[10px] text-slate-400">
                                      Qolka: {row.session1.room}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                              )}
                            </td>

                            {/* Break 1 */}
                            <td className={`border-r p-2 text-center align-middle bg-amber-50/40 dark:bg-amber-950/20 font-bold text-amber-800 dark:text-amber-300 print:bg-slate-50 border-slate-300 dark:border-slate-700 print:border-slate-400 ${cellBorderBottom}`}>
                              {row.break1 ? (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100/70 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 text-[11px] font-mono font-black text-amber-900 dark:text-amber-200 print:border-none print:p-0">
                                  <Coffee size={11} className="print:hidden text-amber-600" />
                                  <span>{row.break1} min</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                              )}
                            </td>

                            {/* Session 2 */}
                            <td className={`border-r p-2.5 text-center align-middle border-slate-300 dark:border-slate-700 print:border-slate-400 ${cellBorderBottom}`}>
                              {row.session2 ? (
                                <div className="space-y-1">
                                  <div className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-tight">
                                    {row.session2.name}
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300 print:border-none print:p-0">
                                    <Clock size={11} className="print:hidden" />
                                    <span>{row.session2.startTime?.slice(0, 5)} - {row.session2.endTime?.slice(0, 5)}</span>
                                  </div>
                                  {row.session2.room && (
                                    <div className="text-[10px] text-slate-400">
                                      Qolka: {row.session2.room}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                              )}
                            </td>

                            {/* Break 2 */}
                            <td className={`border-r p-2 text-center align-middle bg-amber-50/40 dark:bg-amber-950/20 font-bold text-amber-800 dark:text-amber-300 print:bg-slate-50 border-slate-300 dark:border-slate-700 print:border-slate-400 ${cellBorderBottom}`}>
                              {row.break2 ? (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100/70 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 text-[11px] font-mono font-black text-amber-900 dark:text-amber-200 print:border-none print:p-0">
                                  <Coffee size={11} className="print:hidden text-amber-600" />
                                  <span>{row.break2} min</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                              )}
                            </td>

                            {/* Session 3 */}
                            <td className={`p-2.5 text-center align-middle border-slate-300 dark:border-slate-700 print:border-slate-400 ${cellBorderBottom}`}>
                              {row.session3 ? (
                                <div className="space-y-1">
                                  <div className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-tight">
                                    {row.session3.name}
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300 print:border-none print:p-0">
                                    <Clock size={11} className="print:hidden" />
                                    <span>{row.session3.startTime?.slice(0, 5)} - {row.session3.endTime?.slice(0, 5)}</span>
                                  </div>
                                  {row.session3.room && (
                                    <div className="text-[10px] text-slate-400">
                                      Qolka: {row.session3.room}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filter Toolbar (Branch, Class, Exam, Term, Academic Year) */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Branch Filter */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
              <Building2 size={12} className="text-brand-600" />
              {t('common.branch') || 'Laanta'}
            </label>
            <select
              value={selectedBranchId}
              onChange={e => handleBranchChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
            >
              <option value="">{t('common.allBranches') || 'Dhammaan Laamaha'}</option>
              {branches.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
              <Layers size={12} className="text-brand-600" />
              {t('common.class') || 'Fasalka'}
            </label>
            <select
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
                setSelectedExamId('');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
            >
              {teacherAccessibleClasses.length === 0 ? (
                <option value="">{t('common.selectClass')}</option>
              ) : (
                teacherAccessibleClasses.map(c => (
                  <option key={c._id} value={c._id}>{classLabel(c)}</option>
                ))
              )}
            </select>
          </div>

          {/* Exam Filter */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
              <Calendar size={12} className="text-brand-600" />
              {t('exams.manage.colExam') || 'Imtixaanka'}
            </label>
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
            >
              <option value="">{t('exams.timetable.allExams') || '-- Dhammaan Imtixaannada --'}</option>
              {classExams.map(e => (
                <option key={e._id} value={e._id}>
                  {e.title} ({tv(e.examType)})
                </option>
              ))}
            </select>
          </div>

          {/* Term Filter */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
              {t('exams.manage.term') || 'Termiga'}
            </label>
            <select
              value={termFilter}
              onChange={e => setTermFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
            >
              <option value="">-- Dhammaan Termiyada --</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>

          {/* Academic Year Filter */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
              {t('academic.promotion.colYear') || 'Sanad Dugsiyeedka'}
            </label>
            <input
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Timetable Vertical Sections — Exact Recreation of Reference Image */}
      {displayedExams.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Calendar size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">
            {t('exams.timetable.empty')}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            Fasalkan weli ma leha imtixaanno la sameeyey ama jadwalkooda la dhigay. Marka hore samee imtixaan ama qorshee maaddooyin.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { window.location.hash = '/exams'; }}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold uppercase transition"
            >
              {t('exams.manage.newExam') || 'Samee Imtixaan'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {displayedExams.map((exam) => {
            // Only include subjects that have an actual schedule date
            const subjects = (exam.subjects || [])
              .filter(s => Boolean(s.date || s.examDate))
              .filter(s => !activeTeacherId || isSubjectForTeacher(s, exam.classId, activeTeacherId))
              .slice()
              .sort((a, b) => {
                const dA = a.date || '';
                const dB = b.date || '';
                if (dA !== dB) return dA.localeCompare(dB);
                return (a.startTime || '').localeCompare(b.startTime || '');
              });

            const unscheduledCount = (exam.subjects || []).filter(s => !s.date && !s.examDate).length;

            return (
              <div
                key={exam._id}
                className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
              >
                {/* Light-gray header bar with exam title matching reference image */}
                <div className="bg-[#f3f4f6] dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                      {exam.title || `${exam.examType} Examination`}
                    </h2>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tv(exam.examType)}
                    </span>
                    {exam.term && (
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        · {exam.term}
                      </span>
                    )}
                  </div>

                  {!isTeacher && (
                    <div className="flex items-center gap-2 print:hidden">
                      {unscheduledCount > 0 && (
                        <button
                          onClick={() => handleCleanUnscheduled(exam)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 transition"
                          title="Ka saar maaddooyinka tooska u soo galay ee aan jadwalka lahayn"
                        >
                          <Trash2 size={12} />
                          <span>Ka saar kuwa aan jadwalka lahayn ({unscheduledCount})</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenAdd(exam._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                        title="Ku dar maaddo jadwalkan"
                      >
                        <Plus size={12} />
                        <span>{t('exams.timetable.addSchedule') || 'Ku dar'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Clean Table with thin borders matching reference image */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center w-28">
                          {t('exams.timetable.dayCol') || 'DAY'}
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center w-32">
                          {t('exams.timetable.dateCol') || 'DATE'}
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center w-36">
                          {t('exams.timetable.sessionCol') || 'SESSION / MAADDO'}
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 w-1/4">
                          {t('exams.timetable.subjectCol') || 'SUBJECT'}
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center w-28">
                          {t('exams.timetable.startTimeCol') || 'START TIME'}
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center w-28">
                          {t('exams.timetable.endTimeCol') || 'END TIME'}
                        </th>
                        <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-700 text-center w-28">
                          {t('exams.timetable.durationCol') || 'DURATION'}
                        </th>
                        {!isTeacher && (
                          <th className="py-3 px-3 text-right w-20 print:hidden">
                            {t('exams.timetable.actionsCol') || 'ACTIONS'}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {subjects.length === 0 ? (
                        <tr>
                          <td colSpan={isTeacher ? 7 : 8} className="py-8 px-4 text-center text-slate-400 italic">
                            {activeTeacherId
                              ? 'Ma jiraan maaddooyin laguu qoray oo imtixaankan ku jira.'
                              : 'Weli maaddo looma qorsheyn imtixaankan. Guji badhanka "Ku dar" si aad ugu darto.'}
                          </td>
                        </tr>
                      ) : (
                        groupSubjectsByDate(subjects).map((group, gIdx) => {
                          const firstSub = group.subjects[0];
                          const displayDay = formatDisplayDay(firstSub.date || firstSub.examDate, firstSub.day, locale);
                          const displayDate = formatDisplayDate(firstSub.date || firstSub.examDate);

                          return group.subjects.map((sub, sIdx) => {
                            const subDisplay = `${sub.name}${sub.code ? ` (${sub.code})` : ''}`;
                            const displayStartTime = formatDisplayTime(sub.startTime);
                            const displayEndTime = formatDisplayTime(sub.endTime || computeEndTime(sub.startTime, sub.duration));
                            const sessionTitle = sub.session || (sIdx === 0 ? t('exams.timetable.session1') || 'Qaybta 1aad' : t('exams.timetable.session2') || 'Qaybta 2aad');
                            const isFirstInDay = sIdx === 0;
                            const isLastInDay = sIdx === group.subjects.length - 1;

                            return (
                              <tr
                                key={sub._id || `${sub.name}-${gIdx}-${sIdx}`}
                                className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                                  isLastInDay ? 'border-b-2 border-slate-300 dark:border-slate-600' : 'border-b border-slate-200 dark:border-slate-700/60'
                                }`}
                              >
                                {isFirstInDay && (
                                  <>
                                    <td
                                      rowSpan={group.subjects.length}
                                      className="py-3.5 px-4 border-r border-slate-200 dark:border-slate-700 text-center font-black text-sm text-slate-900 dark:text-white bg-slate-50/60 dark:bg-slate-800/40 align-middle"
                                    >
                                      {displayDay}
                                    </td>
                                    <td
                                      rowSpan={group.subjects.length}
                                      className="py-3.5 px-4 border-r border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50/60 dark:bg-slate-800/40 align-middle"
                                    >
                                      {displayDate}
                                    </td>
                                  </>
                                )}

                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-black text-slate-900 dark:text-slate-100">
                                  {sessionTitle}
                                </td>

                                <td className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                                  {subDisplay}
                                </td>

                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-mono">
                                  <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold font-mono text-xs">
                                    {displayStartTime}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-mono">
                                  <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold font-mono text-xs">
                                    {displayEndTime}
                                  </span>
                                </td>

                                <td className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-slate-700 dark:text-slate-200">
                                  {sub.duration || 90} min
                                </td>

                                {!isTeacher && (
                                  <td className="py-2.5 px-3 text-right print:hidden">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => handleOpenEdit(exam, sub)}
                                        title={t('common.edit')}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSchedule(exam, sub)}
                                        title={t('common.delete')}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Add / Edit Schedule Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmitSchedule} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {editingEntry ? t('exams.timetable.editSchedule') : t('exams.timetable.addSchedule')}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {editingEntry ? 'Wax ka beddel maaddadan iyo waqtigeeda' : 'Qorshee maaddo ama labo maaddo hal maalin gudaheed'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Target Exam & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                      {t('exams.manage.colExam') || 'Imtixaanka *'}
                    </label>
                    <select
                      value={form.examId}
                      onChange={e => setForm({ ...form, examId: e.target.value })}
                      disabled={!!editingEntry}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold disabled:opacity-60"
                      required
                    >
                      <option value="">-- Dooro Imtixaan --</option>
                      {classExams.map(e => (
                        <option key={e._id} value={e._id}>
                          {e.title} ({tv(e.examType)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {t('exams.timetable.dateCol') || 'Taariikhda (Date) *'}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => {
                        const newDate = e.target.value;
                        const autoDay = formatDisplayDay(newDate, '', locale);
                        setForm(prev => ({ ...prev, date: newDate, day: autoDay }));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-medium"
                      required
                    />
                    {form.date && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                        <span className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/70 border border-brand-200 dark:border-brand-800">
                          {t('exams.timetable.dayLabel') || 'Maalinta'}: {formatDisplayDay(form.date, form.day, 'so')} {locale !== 'en' ? `(${formatDisplayDay(form.date, form.day, 'en')})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Session Count Selector (Only in Add mode) */}
                {!editingEntry && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">
                          Tirada Maaddooyinka Maalintan
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          Dooro 1, 2, ama 3 maaddo oo maalintan la galayo
                        </div>
                      </div>
                    </div>

                    <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 self-start sm:self-auto">
                      {[1, 2, 3].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setSessionCount(count)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                            (form.sessions || []).length === count
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {count} {count === 1 ? 'Maaddo' : 'Maaddo'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic Session Cards (Supports 1, 2, or 3+ subjects per day) */}
                {(form.sessions || []).map((sess, idx) => {
                  const availableForThis = getAvailableSubjectsForSession(idx);
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide">
                            Maaddada {idx + 1}aad ({sess.session || `Qaybta ${idx + 1}aad`})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            value={sess.session}
                            onChange={e => updateSessionField(idx, 'session', e.target.value)}
                            placeholder={`Qaybta ${idx + 1}aad`}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 w-28 text-center outline-none"
                          />
                          {!editingEntry && (form.sessions || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSession(idx)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                              title="Ka saar maaddadan maalintan"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subject Picker Dropdown */}
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                          {t('exams.timetable.subjectCol') || `Maaddada ${idx + 1}aad *`}
                        </label>
                        {!editingEntry && availableForThis.length > 0 ? (
                          <select
                            onChange={e => handlePickSubjectForSession(idx, e.target.value)}
                            value={sess.name}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold mb-2"
                          >
                            <option value="">{t('exams.timetable.selectSubject') || '-- Dooro Maaddo Fasal --'}</option>
                            {availableForThis.map(s => (
                              <option key={s._id || s.name} value={s.name}>
                                {s.name} {s.code ? `(${s.code})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : !editingEntry ? (
                          <div className="p-2 mb-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            ✓ Maaddooyin kale oo fasalkan u hadhay ma jiraan (ama qor maaddo cusub hoos).
                          </div>
                        ) : null}

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <input
                              value={sess.name}
                              onChange={e => updateSessionField(idx, 'name', e.target.value)}
                              placeholder={`Magaca Maaddada ${idx + 1}aad (e.g. Mathematics, English)`}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
                              required
                            />
                          </div>
                          <div>
                            <input
                              value={sess.code}
                              onChange={e => updateSessionField(idx, 'code', e.target.value)}
                              placeholder="Code"
                              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-center text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Time Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            {t('exams.timetable.startTimeCol') || 'Start Time *'}
                          </label>
                          <input
                            type="text"
                            value={sess.startTime}
                            onChange={e => updateSessionField(idx, 'startTime', e.target.value)}
                            placeholder={defaultTimings.sessions[idx]?.startTime || '08:10:00'}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            {t('exams.timetable.endTimeCol') || 'End Time'}
                          </label>
                          <input
                            type="text"
                            value={sess.endTime}
                            onChange={e => updateSessionField(idx, 'endTime', e.target.value)}
                            placeholder={defaultTimings.sessions[idx]?.endTime || '09:10:00'}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-mono font-bold text-sky-700 dark:text-sky-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                            {t('exams.timetable.durationCol') || 'Duration (min) *'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={sess.duration}
                            onChange={e => updateSessionField(idx, 'duration', e.target.value)}
                            placeholder={String(defaultTimings.sessions[idx]?.duration || 60)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
                            required
                          />
                        </div>
                      </div>

                      {/* Full Marks & Room */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                            Dhibcaha Buuxa (Max Marks)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={sess.fullMarks}
                            onChange={e => updateSessionField(idx, 'fullMarks', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                            Qolka / Hall
                          </label>
                          <input
                            value={sess.room || ''}
                            onChange={e => updateSessionField(idx, 'room', e.target.value)}
                            placeholder="tusaale: Qolka 3aad"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Button to add 3rd subject if currently fewer than 3 */}
                {!editingEntry && (form.sessions || []).length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="w-full py-2.5 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus size={14} />
                    <span>Ku dar Maaddo {(form.sessions || []).length + 1}aad Maalintan</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2.5 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs uppercase disabled:opacity-50 transition"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingEntry ? t('exams.timetable.updateEntry') : t('exams.timetable.saveEntry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timings Settings Modal (Shaashad Soo Boodo) */}
      {isTimingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm print:hidden animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Waqtiyada Caadiga ah ee 3-da Qaybood & Break-ka
                    </h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                      Otomaatig
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Halkan ka maamul Start Time, End Time iyo Nasashada (Break). Maaddo kasta oo cusub toos ayay u qaadanaysaa.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTimingsModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Xakameynta & Isku Toosinta:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRecalculateChain}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition flex items-center gap-1.5"
                    title="Isku toosi 3-da qaybood iyo nasashadooda"
                  >
                    <Sparkles size={13} />
                    <span>Isku toosi</span>
                  </button>

                  {classExams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetExam = exams.find(e => String(e._id) === selectedExamId) || classExams[0];
                        if (targetExam) handleApplyTimingsToCurrentExam(targetExam);
                      }}
                      disabled={saving}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Ku dabaq waqtiyadan maaddooyinka jadwalka ku jira ee imtixaankan"
                    >
                      <Check size={13} />
                      <span>Ku dabaq Imtixaankan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetTimings}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1.5"
                    title="Dib ugu celi sidii hore"
                  >
                    <RotateCcw size={13} />
                    <span>Dib u celi</span>
                  </button>
                </div>
              </div>

              {/* 3 Session Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Session 1 */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">1</span>
                        Qaybta 1aad (Session 1)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {defaultTimings.sessions[0]?.duration || 60} daqiiqo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Start Time</label>
                        <input
                          type="text"
                          value={defaultTimings.sessions[0]?.startTime || ''}
                          onChange={e => handleUpdateSessionTiming(0, 'startTime', e.target.value)}
                          placeholder="08:10:00"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-500 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">End Time</label>
                        <input
                          type="text"
                          value={defaultTimings.sessions[0]?.endTime || ''}
                          onChange={e => handleUpdateSessionTiming(0, 'endTime', e.target.value)}
                          placeholder="09:10:00"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-sky-600 dark:text-sky-400 outline-none focus:border-brand-500 text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={11} /> Nasasho (Break 1):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={defaultTimings.breakMinutes1 ?? 30}
                        onChange={e => handleUpdateBreak(1, e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-mono text-xs font-black text-center text-amber-800 dark:text-amber-300 outline-none"
                      />
                      <span className="text-[10px] font-bold text-slate-500">daqiiqo</span>
                      <ArrowRight size={12} className="text-amber-500 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Session 2 */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">2</span>
                        Qaybta 2aad (Session 2)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {defaultTimings.sessions[1]?.duration || 60} daqiiqo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Start Time</label>
                        <input
                          type="text"
                          value={defaultTimings.sessions[1]?.startTime || ''}
                          onChange={e => handleUpdateSessionTiming(1, 'startTime', e.target.value)}
                          placeholder="09:40:00"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-500 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">End Time</label>
                        <input
                          type="text"
                          value={defaultTimings.sessions[1]?.endTime || ''}
                          onChange={e => handleUpdateSessionTiming(1, 'endTime', e.target.value)}
                          placeholder="10:40:00"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-sky-600 dark:text-sky-400 outline-none focus:border-brand-500 text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={11} /> Nasasho (Break 2):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={defaultTimings.breakMinutes2 ?? 30}
                        onChange={e => handleUpdateBreak(2, e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-mono text-xs font-black text-center text-amber-800 dark:text-amber-300 outline-none"
                      />
                      <span className="text-[10px] font-bold text-slate-500">daqiiqo</span>
                      <ArrowRight size={12} className="text-amber-500 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Session 3 */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">3</span>
                        Qaybta 3aad (Session 3)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {defaultTimings.sessions[2]?.duration || 60} daqiiqo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Start Time</label>
                        <input
                          type="text"
                          value={defaultTimings.sessions[2]?.startTime || ''}
                          onChange={e => handleUpdateSessionTiming(2, 'startTime', e.target.value)}
                          placeholder="11:10:00"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-500 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">End Time</label>
                        <input
                          type="text"
                          value={defaultTimings.sessions[2]?.endTime || ''}
                          onChange={e => handleUpdateSessionTiming(2, 'endTime', e.target.value)}
                          placeholder="12:10:00"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-sky-600 dark:text-sky-400 outline-none focus:border-brand-500 text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Qaybta ugu dambeysa</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">✓ Diyaar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Waqtiyadan waxay toos ugu dhacayaan maaddada cusub ee la qorsheeyo
              </span>
              <div className="flex items-center gap-2.5 flex-wrap justify-end w-full sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleApplyTimingsToAllBranchExams}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md shadow-amber-500/25 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  title="Waqtiyadan aad sare ku sameysay hal mar ku dabaq dhammaan maaddooyinka imtixaannada faracan"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>Hal Mar Ku Dabaq Dhammaan ({currentBranchObj?.name || 'Dhammaan'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTimingsModalOpen(false);
                    showAlert({ type: 'success', title: 'Waa La Xafiday', message: 'Waqtiyada caadiga ah waa la xafiday.' });
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md shadow-brand-600/30 flex items-center gap-2"
                >
                  <Check size={16} />
                  <span>Keydi & Xir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSchedule;
