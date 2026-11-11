import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BookOpen, ShieldCheck, CheckSquare, GraduationCap, Sliders, Sparkles, Plus, Search, Check, RotateCcw,
  Printer, FileDown, Trash2, Edit3, Filter, Calendar,
  User, CheckCircle2, AlertCircle, X, ChevronDown, Award, RefreshCw, Building2,
  UserCheck, Layers, Settings, ArrowRight, Users
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { QURAN_SURAHS } from '../data/quranSurahs';

const QUICK_NOTES = [
  'حفظ ممتاز',
  'حفظ جيد',
  'ضعيفة الحفظ',
  'تحتاج تثبيت',
  'إتقان التجويد',
  'قراءة طيبة'
];

const REPEAT_CHIPS = [1, 2, 3, 5, 7, 10];

const QuranManagement = () => {
  const { locale } = useLanguage();
  const { showAlert, showConfirm } = useAlert();

  // Data states
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [halaqahName, setHalaqahName] = useState('');
  const [classId, setClassId] = useState('');

  // Surah entry
  const [surahSearchQuery, setSurahSearchQuery] = useState('');
  const [isSurahDropdownOpen, setIsSurahDropdownOpen] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState(null);

  // Remaining test fields (kept blank/ready for teacher input)
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('passed'); // 'passed' (✓) or 'repeat' (•)
  const [repeatCount, setRepeatCount] = useState(3);
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Accountability & Student Quran Blueprint States
  const [studentType, setStudentType] = useState('LAQDIIN'); // 'LAQDIIN' | 'HOREED'
  const [fromVerse, setFromVerse] = useState(1);
  const [toVerse, setToVerse] = useState(5);
  const [pageRange, setPageRange] = useState('');
  const [lineRange, setLineRange] = useState('');
  const [dailyPace, setDailyPace] = useState(5);

  // ISKU-XIR Schedule States (For HOREED students)
  const [isIskuXirActive, setIsIskuXirActive] = useState(false);
  const [iskuXirDays, setIskuXirDays] = useState(['Sabti', 'Talaado']);
  const [iskuXirSurahNum, setIskuXirSurahNum] = useState(1);
  const [iskuXirFromVerse, setIskuXirFromVerse] = useState(1);
  const [iskuXirToVerse, setIskuXirToVerse] = useState(7);
  const [iskuXirNotes, setIskuXirNotes] = useState('');

  // Edit modal state
  const [editingRecord, setEditingRecord] = useState(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [halaqahFilter, setHalaqahFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  const location = useLocation();
  // View Switcher: 'registration' (Diiwaangelinta Qorshaha & Bisinka) | 'examinations' (Diiwaanka Imtixaanaadka & Natiijooyinka)
  const [activeView, setActiveView] = useState(() => {
    if (location.pathname.includes('surahs')) return 'examinations';
    return 'registration';
  });

  useEffect(() => {
    if (location.pathname.includes('plan-registration')) {
      setActiveView('registration');
    } else if (location.pathname.includes('surahs')) {
      setActiveView('examinations');
    }
  }, [location.pathname]);

  // Dedicated Plan Registration States
  const [regClassId, setRegClassId] = useState('');
  const [regStudent, setRegStudent] = useState(null);
  const [regStudentSearchQuery, setRegStudentSearchQuery] = useState('');
  const [isRegStudentDropdownOpen, setIsRegStudentDropdownOpen] = useState(false);
  const [regStudentType, setRegStudentType] = useState('LAQDIIN'); // 'LAQDIIN' | 'HOREED'
  const [regSurah, setRegSurah] = useState(() => QURAN_SURAHS[0]);
  const [regSurahSearchQuery, setRegSurahSearchQuery] = useState('1. الفاتحة (Al-Faatixa)');
  const [isRegSurahDropdownOpen, setIsRegSurahDropdownOpen] = useState(false);
  const [regFromVerse, setRegFromVerse] = useState(1);
  const [regPaceUnit, setRegPaceUnit] = useState('sadar'); // 'sadar' | 'bog'
  const [regPaceCount, setRegPaceCount] = useState(7);
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Registered students overview table filters
  const [regSearchFilter, setRegSearchFilter] = useState('');
  const [regClassFilter, setRegClassFilter] = useState('All');
  const [regTypeFilter, setRegTypeFilter] = useState('All'); // 'All' | 'LAQDIIN' | 'HOREED'

  const regStudentDropdownRef = useRef(null);
  const regSurahDropdownRef = useRef(null);
  const regFormRef = useRef(null);

  // Refs for dropdown blur handling
  const studentDropdownRef = useRef(null);
  const surahDropdownRef = useRef(null);
  const surahInputRef = useRef(null);

  // Load records, students, classes, and branches
  const loadData = async () => {
    try {
      setLoading(true);
      const [recordsRes, studentsRes, classesRes, branchesRes] = await Promise.all([
        api.get('/quran/surahs').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] })),
        api.get('/classes').catch(() => ({ data: [] })),
        api.get('/branches').catch(() => ({ data: [] }))
      ]);

      const branchList = branchesRes.data || [];
      setBranches(branchList);
      setRecords(recordsRes.data || []);
      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);

      // Auto-detect the branch named or containing "dugsi" (case-insensitive)
      const dugsiBranch = branchList.find(b => b.name && b.name.toLowerCase().includes('dugsi'));
      if (dugsiBranch) {
        setSelectedBranchId(dugsiBranch._id);
      } else if (branchList.length > 0) {
        // Fallback to first branch or All if dugsi is not found yet
        setSelectedBranchId(branchList[0]._id);
      }
    } catch (error) {
      console.error('Error loading Quran data:', error);
      showAlert({
        type: 'danger',
        title: 'Khalad',
        message: 'Lama guuleysan in xogta la soo raro. Fadlan dib u tijaabi.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target)) {
        setIsStudentDropdownOpen(false);
      }
      if (surahDropdownRef.current && !surahDropdownRef.current.contains(event.target)) {
        setIsSurahDropdownOpen(false);
      }
      if (regStudentDropdownRef.current && !regStudentDropdownRef.current.contains(event.target)) {
        setIsRegStudentDropdownOpen(false);
      }
      if (regSurahDropdownRef.current && !regSurahDropdownRef.current.contains(event.target)) {
        setIsRegSurahDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students strictly by the active Dugsi branch
  // Selected student's class and assigned teacher
  const selectedStudentClassInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const cId = selectedStudent.classId?._id || selectedStudent.classId;
    const foundClass = classes.find(c => String(c._id) === String(cId));
    const teacherName = foundClass?.teacherId?.fullName || foundClass?.teacherId?.username || foundClass?.teacherId?.name || null;
    return {
      className: foundClass?.name || foundClass?.className || halaqahName || 'Lama garanayo',
      teacherName: teacherName || 'Fasalkan macallin looma xilsaarin'
    };
  }, [selectedStudent, classes, halaqahName]);

  const toggleIskuXirDay = (day) => {
    setIskuXirDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const branchStudents = useMemo(() => {
    if (!selectedBranchId || selectedBranchId === 'All') return students;
    return students.filter(s => {
      const sBranchId = s.branchId?._id || s.branchId;
      const cBranchId = s.classId?.branchId?._id || s.classId?.branchId;
      return sBranchId === selectedBranchId || cBranchId === selectedBranchId;
    });
  }, [students, selectedBranchId]);

  // Filter classes strictly by the active Dugsi branch
  const branchClasses = useMemo(() => {
    if (!selectedBranchId || selectedBranchId === 'All') return classes;
    return classes.filter(c => {
      const cBranchId = c.branchId?._id || c.branchId;
      return cBranchId === selectedBranchId;
    });
  }, [classes, selectedBranchId]);

  // Selected student's class and assigned teacher for Dedicated Registration
  const selectedRegStudentClassInfo = useMemo(() => {
    if (!regStudent) return null;
    const cId = regStudent.classId?._id || regStudent.classId;
    const foundClass = classes.find(c => String(c._id) === String(cId));
    const teacherName = foundClass?.teacherId?.fullName || foundClass?.teacherId?.username || foundClass?.teacherId?.name || null;
    return {
      className: foundClass?.name || foundClass?.className || 'Lama garanayo',
      teacherName: teacherName || 'Fasalkan macallin looma xilsaarin'
    };
  }, [regStudent, classes]);

  // Filter students for registration autocomplete search strictly by selected class/halaqah
  const regFilteredStudents = useMemo(() => {
    if (!regClassId) return [];
    const pool = branchStudents.filter(s => {
      const cId = s.classId?._id || s.classId;
      return String(cId) === String(regClassId);
    });
    if (!regStudentSearchQuery.trim()) return pool;
    const q = regStudentSearchQuery.toLowerCase().trim();
    return pool.filter(s =>
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toString().includes(q))
    );
  }, [branchStudents, regClassId, regStudentSearchQuery]);

  // Filter 114 Surahs for registration dropdown
  const regFilteredSurahs = useMemo(() => {
    if (!regSurahSearchQuery.trim() || (regSurah && regSurahSearchQuery === `${regSurah.number}. ${regSurah.nameAr} (${regSurah.nameSo})`)) {
      return QURAN_SURAHS;
    }
    const q = regSurahSearchQuery.toLowerCase().trim();
    return QURAN_SURAHS.filter(s =>
      s.nameAr.includes(q) ||
      (s.nameSo && s.nameSo.toLowerCase().includes(q)) ||
      String(s.number).includes(q)
    );
  }, [regSurahSearchQuery, regSurah]);

  const handleSelectRegStudent = (student) => {
    const cId = student.classId?._id || student.classId;
    if (cId) setRegClassId(String(cId));
    setRegStudent(student);
    setRegStudentSearchQuery(student.fullName || '');
    setIsRegStudentDropdownOpen(false);

    setRegStudentType(student.studentType || 'LAQDIIN');
    const exp = student.expectedLessonConfig || {};
    const prog = student.quranProgress || {};
    const sNum = exp.surahNumber || prog.surahNumber || 1;
    const sObj = QURAN_SURAHS.find(s => s.number === sNum) || QURAN_SURAHS[0];
    setRegSurah(sObj);
    setRegSurahSearchQuery(`${sObj.number}. ${sObj.nameAr} (${sObj.nameSo})`);
    setRegFromVerse(exp.fromVerse || prog.fromVerse || 1);
    const unit = exp.paceUnit || 'sadar';
    setRegPaceUnit(unit);
    setRegPaceCount(exp.paceCount || exp.dailyPace || (unit === 'bog' ? 1 : 7));
  };

  const handleSelectRegSurah = (surah) => {
    setRegSurah(surah);
    setRegSurahSearchQuery(`${surah.number}. ${surah.nameAr} (${surah.nameSo})`);
    setIsRegSurahDropdownOpen(false);
  };

  const resetRegForm = () => {
    setRegClassId('');
    setRegStudent(null);
    setRegStudentSearchQuery('');
    setRegStudentType('LAQDIIN');
    const sObj = QURAN_SURAHS[0];
    setRegSurah(sObj);
    setRegSurahSearchQuery(`${sObj.number}. ${sObj.nameAr} (${sObj.nameSo})`);
    setRegFromVerse(1);
    setRegPaceUnit('sadar');
    setRegPaceCount(7);
  };

  const handleSaveStudentPlan = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!regClassId) {
      showAlert({
        type: 'warning',
        title: 'Dooro Xalaqadda',
        message: 'Fadlan marka hore dooro Xalaqadda / Fasalka.'
      });
      return;
    }
    if (!regStudent) {
      showAlert({
        type: 'warning',
        title: 'Dooro Ardayga',
        message: 'Fadlan dooro ardayga aad doonayso inaad qorshaha u dejiso.'
      });
      return;
    }
    if (!regSurah) {
      showAlert({
        type: 'warning',
        title: 'Dooro Suuradda',
        message: 'Fadlan dooro suuradda bisinka ah.'
      });
      return;
    }

    try {
      setRegSubmitting(true);
      const sNum = regSurah.number;
      const fVerse = Math.max(1, Number(regFromVerse) || 1);
      const pCount = Math.max(1, Number(regPaceCount) || (regPaceUnit === 'bog' ? 1 : 7));
      const estimatedVerses = regPaceUnit === 'bog' ? Math.max(1, pCount * 15) : Math.max(1, Math.round(pCount / 2));
      const tVerse = Math.min(regSurah.verses, fVerse + estimatedVerses - 1);

      const payload = {
        studentId: regStudent._id,
        classId: regClassId,
        studentType: regStudentType,
        surahNumber: sNum,
        fromVerse: fVerse,
        toVerse: tVerse,
        paceUnit: regPaceUnit,
        paceCount: pCount,
        pageRange: regPaceUnit === 'bog' ? `${pCount} Bog` : '',
        lineRange: regPaceUnit === 'sadar' ? `${pCount} Sadar` : '',
        dailyPace: estimatedVerses
      };

      const res = await api.put('/quran/lessons/admin/assign-expectation', payload);

      setStudents(prev => prev.map(s => {
        if (s._id === regStudent._id) {
          return {
            ...s,
            studentType: regStudentType,
            expectedLessonConfig: res.data.student?.expectedLessonConfig || payload,
            quranProgress: res.data.student?.quranProgress || s.quranProgress
          };
        }
        return s;
      }));

      showAlert({
        type: 'success',
        title: 'Guul!',
        message: `Qorshaha ardayga "${regStudent.fullName}" si guul leh ayaa loo diiwaangeliyey (${regStudentType === 'HOREED' ? 'Horeed (Xifdiye)' : 'Laqdiin'}, Bisinka: ${regSurah.nameSo}, Qiyaasta: ${pCount} ${regPaceUnit === 'bog' ? 'Bog' : 'Sadar'}).`
      });

      resetRegForm();
    } catch (err) {
      console.error('Error saving plan:', err);
      showAlert({
        type: 'danger',
        title: 'Khalad',
        message: err.response?.data?.message || 'Lama guuleysan in qorshaha la keydiyo.'
      });
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleEditStudentPlan = (st) => {
    handleSelectRegStudent(st);
    if (regFormRef.current) {
      regFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Filtered list of registered students for the overview table
  const displayedRegisteredStudents = useMemo(() => {
    return branchStudents.filter(s => {
      if (regClassFilter !== 'All') {
        const cId = s.classId?._id || s.classId;
        if (String(cId) !== String(regClassFilter)) return false;
      }
      if (regTypeFilter !== 'All') {
        const sType = s.studentType || 'LAQDIIN';
        if (sType !== regTypeFilter) return false;
      }
      if (regSearchFilter.trim()) {
        const q = regSearchFilter.toLowerCase().trim();
        const matchesName = s.fullName && s.fullName.toLowerCase().includes(q);
        const matchesCode = s.studentCode && s.studentCode.toLowerCase().includes(q);
        const matchesRoll = s.rollNumber && s.rollNumber.toString().includes(q);
        if (!matchesName && !matchesCode && !matchesRoll) return false;
      }
      return true;
    });
  }, [branchStudents, regClassFilter, regTypeFilter, regSearchFilter]);

  // Filter students based on search query (ONLY within Dugsi students)
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return branchStudents.slice(0, 15);
    const q = studentSearchQuery.toLowerCase().trim();
    return branchStudents.filter(s =>
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toString().includes(q)) ||
      (s.classId?.name && s.classId.name.toLowerCase().includes(q)) ||
      (s.classId?.className && s.classId.className.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [branchStudents, studentSearchQuery]);


  // Filter 114 Surahs based on query (shows all 114 surahs in order)
  const filteredSurahs = useMemo(() => {
    if (!surahSearchQuery.trim() || (selectedSurah && surahSearchQuery === `${selectedSurah.number}. ${selectedSurah.nameAr} (${selectedSurah.nameSo})`)) {
      return QURAN_SURAHS;
    }
    const q = surahSearchQuery.toLowerCase().trim();
    return QURAN_SURAHS.filter(s =>
      s.nameAr.includes(q) ||
      (s.nameSo && s.nameSo.toLowerCase().includes(q)) ||
      String(s.number).includes(q)
    );
  }, [surahSearchQuery, selectedSurah]);

  // Handle selecting a student:
  // AUTO-FILLS: Student Name and Halaqah Name.
  // LEAVES BLANK: Surah, Note, Status (default ✓), Date (default today).
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setStudentSearchQuery(student.fullName || '');

    // Resolve halaqah/class name
    const resolvedHalaqah =
      student.classId?.name ||
      student.classId?.className ||
      (typeof student.classId === 'string'
        ? classes.find(c => c._id === student.classId)?.name || ''
        : '');

    setHalaqahName(resolvedHalaqah);
    setClassId(student.classId?._id || student.classId || '');

    // Close dropdown
    setIsStudentDropdownOpen(false);

    // Auto-populate student type and curriculum blueprint
    setStudentType(student.studentType || 'LAQDIIN');
    const expConfig = student.expectedLessonConfig || {};
    const qProg = student.quranProgress || {};
    const sNum = expConfig.surahNumber || qProg.surahNumber || 1;
    const sObj = QURAN_SURAHS.find(s => s.number === sNum) || QURAN_SURAHS[0];
    setSelectedSurah(sObj);
    setSurahSearchQuery(`${sObj.number}. ${sObj.nameAr} (${sObj.nameSo})`);
    setFromVerse(expConfig.fromVerse || qProg.fromVerse || 1);
    setToVerse(expConfig.toVerse || Math.min(sObj.verses, (expConfig.fromVerse || qProg.fromVerse || 1) + 4));
    setPageRange(expConfig.pageRange || '');
    setLineRange(expConfig.lineRange || '');
    setDailyPace(expConfig.dailyPace || qProg.dailyPace || 5);

    if (student.iskuXirConfig) {
      setIsIskuXirActive(Boolean(student.iskuXirConfig.isActive));
      setIskuXirDays(student.iskuXirConfig.revisionDays || ['Sabti', 'Talaado']);
      setIskuXirSurahNum(student.iskuXirConfig.surahNumber || 1);
      setIskuXirFromVerse(student.iskuXirConfig.fromVerse || 1);
      setIskuXirToVerse(student.iskuXirConfig.toVerse || 7);
      setIskuXirNotes(student.iskuXirConfig.notes || '');
    } else {
      setIsIskuXirActive(false);
      setIskuXirDays(['Sabti', 'Talaado']);
    }

    setNote('');
    setStatus('passed');
    setRepeatCount(3);
    setTimeout(() => {
      if (surahInputRef.current) surahInputRef.current.focus();
    }, 50);
  };

  // Handle selecting a Surah
  const handleSelectSurah = (surah) => {
    setSelectedSurah(surah);
    setSurahSearchQuery(`${surah.number}. ${surah.nameAr} (${surah.nameSo})`);
    setIsSurahDropdownOpen(false);
  };

  // Reset form to blank
  const resetForm = () => {
    setSelectedStudent(null);
    setStudentSearchQuery('');
    setHalaqahName('');
    setClassId('');
    setSelectedSurah(null);
    setSurahSearchQuery('');
    setNote('');
    setStatus('passed');
    setRepeatCount(3);
    setRecordDate(new Date().toISOString().slice(0, 10));
  };

  // Submit new Surah Test Record
  const handleSubmitRecord = async (e) => {
    e.preventDefault();

    if (!studentSearchQuery.trim()) {
      showAlert({
        type: 'warning',
        title: 'Magaca ardayga',
        message: 'Fadlan dooro ama qor magaca ardayga.'
      });
      return;
    }

    if (!surahSearchQuery.trim()) {
      showAlert({
        type: 'warning',
        title: 'Suuradda',
        message: 'Fadlan dooro ama qor suuradda uu ardaygu galay.'
      });
      return;
    }

    try {
      setSubmitting(true);
      const surahNameValue = selectedSurah
        ? selectedSurah.nameAr
        : surahSearchQuery.trim();

      const payload = {
        studentId: selectedStudent?._id,
        studentName: selectedStudent?.fullName || studentSearchQuery.trim(),
        classId: classId || undefined,
        branchId: selectedBranchId !== 'All' ? selectedBranchId : (selectedStudent?.branchId?._id || selectedStudent?.branchId || undefined),
        halaqahName: halaqahName.trim(),
        surahName: surahNameValue,
        surahNumber: selectedSurah?.number || undefined,
        status,
        repeatCount: status === 'repeat' ? Math.max(1, Number(repeatCount) || 1) : 1,
        note: note.trim(),
        date: recordDate,
        studentType,
        fromVerse: Number(fromVerse) || 1,
        toVerse: Number(toVerse) || (Number(fromVerse) || 1) + 4,
        pageRange,
        lineRange,
        dailyPace: Number(dailyPace) || 5,
        iskuXirConfig: studentType === 'HOREED' ? {
          isActive: isIskuXirActive,
          revisionDays: iskuXirDays,
          surahNumber: iskuXirSurahNum,
          fromVerse: Number(iskuXirFromVerse) || 1,
          toVerse: Number(iskuXirToVerse) || 7,
          notes: iskuXirNotes
        } : undefined
      };

      const res = await api.post('/quran/surahs', payload);
      setRecords(prev => [res.data, ...prev]);

      showAlert({
        type: 'success',
        title: 'Guul',
        message: `Natiijada ${payload.studentName} ee ${payload.surahName} si guul leh ayaa loo kaydiyey.`
      });

      // Clear for next entry, maintaining halaqah context if desired
      setSelectedStudent(null);
      setStudentSearchQuery('');
      setSelectedSurah(null);
      setSurahSearchQuery('');
      setNote('');
      setStatus('passed');
    } catch (error) {
      console.error('Error saving record:', error);
      showAlert({
        type: 'danger',
        title: 'Khalad',
        message: error.response?.data?.message || 'Lama kaydin karin diiwaanka.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Update existing record
  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      setSubmitting(true);
      const res = await api.put(`/quran/surahs/${editingRecord._id}`, editingRecord);
      setRecords(prev => prev.map(r => r._id === editingRecord._id ? res.data : r));
      setEditingRecord(null);
      showAlert({
        type: 'success',
        title: 'Guul',
        message: 'Diiwaanka si guul leh ayaa loo cusbooneysiiyey.'
      });
    } catch (error) {
      console.error('Error updating record:', error);
      showAlert({
        type: 'danger',
        title: 'Khalad',
        message: error.response?.data?.message || 'Lama cusbooneysiin karin diiwaanka.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete record
  const handleDeleteRecord = (record) => {
    showConfirm({
      title: 'Tirtir Natiijada',
      message: `Ma hubtaa inaad tirtirto imtixaankii ${record.studentName} ee Suuradda ${record.surahName}?`,
      confirmText: 'Haa, tirtir',
      cancelText: 'Iska daa',
      onConfirm: async () => {
        try {
          await api.delete(`/quran/surahs/${record._id}`);
          setRecords(prev => prev.filter(r => r._id !== record._id));
          showAlert({
            type: 'success',
            title: 'Waa la tirtiray',
            message: 'Diiwaanka si guul leh ayaa loo tirtiray.'
          });
        } catch (error) {
          showAlert({
            type: 'danger',
            title: 'Khalad',
            message: 'Lama tirtiri karin diiwaanka.'
          });
        }
      }
    });
  };

  // Filtered records for table & print (scoped to the selected Dugsi branch)
  const displayedRecords = useMemo(() => {
    return records.filter(r => {
      const matchBranch = !selectedBranchId || selectedBranchId === 'All' ||
        r.branchId?._id === selectedBranchId ||
        r.branchId === selectedBranchId ||
        r.studentId?.branchId === selectedBranchId ||
        r.studentId?.branchId?._id === selectedBranchId ||
        r.classId?.branchId === selectedBranchId ||
        r.classId?.branchId?._id === selectedBranchId;

      const matchSearch = !searchFilter.trim() ||
        (r.studentName && r.studentName.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (r.halaqahName && r.halaqahName.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (r.surahName && r.surahName.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (r.note && r.note.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchHalaqah = halaqahFilter === 'All' || r.halaqahName === halaqahFilter;
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchDate = !dateFilter || (r.date && r.date.slice(0, 10) === dateFilter);

      return matchBranch && matchSearch && matchHalaqah && matchStatus && matchDate;
    });
  }, [records, selectedBranchId, searchFilter, halaqahFilter, statusFilter, dateFilter]);

  // Unique halaqahs for filter
  const uniqueHalaqahs = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      if (r.halaqahName) set.add(r.halaqahName);
    });
    branchClasses.forEach(c => {
      if (c.name) set.add(c.name);
      if (c.className) set.add(c.className);
    });
    return Array.from(set).filter(Boolean);
  }, [records, branchClasses]);


  // KPI statistics
  const stats = useMemo(() => {
    const total = records.length;
    const passed = records.filter(r => r.status === 'passed').length;
    const repeat = records.filter(r => r.status === 'repeat').length;
    const uniqueStudents = new Set(records.map(r => r.studentName)).size;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, repeat, uniqueStudents, passRate };
  }, [records]);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // PDF Export using jsPDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Top English / Somali
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('CULUUMTA SHARECADA & CARABIGA EE SALAAX AL-DAAREYN', pageWidth / 2, 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('ELASHA - SOMALIA', pageWidth / 2, 22, { align: 'center' });

    // Decorative line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(15, 25, pageWidth - 15, 25);

    // Arabic title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(5, 150, 105);
    doc.text('JADWALKA SUURADAHA EE QUR\'AANKA KARIIMKA', pageWidth / 2, 33, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('(Jadwal Al-Suwar Lil-Qur\'an Al-Kareem)', pageWidth / 2, 38, { align: 'center' });

    // Meta row
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Taariikhda Daabacaadda: ${new Date().toLocaleDateString('so-SO')}`, 15, 45);
    doc.text(`Wadarta Diiwaannada: ${displayedRecords.length}`, pageWidth - 15, 45, { align: 'right' });

    // Table Header
    const startY = 49;
    const colX = {
      num: 15,
      name: 25,
      halaqah: 80,
      surah: 120,
      note: 150,
      status: 175,
      date: 195
    };

    doc.setFillColor(241, 245, 249);
    doc.rect(15, startY, pageWidth - 30, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, startY, pageWidth - 30, 8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('#', colX.num + 3, startY + 5.5);
    doc.text('Magaca Ardayga (الاسم)', colX.name, startY + 5.5);
    doc.text('Xalaqadda (الحلقة)', colX.halaqah, startY + 5.5);
    doc.text('Suuradda (السورة)', colX.surah, startY + 5.5);
    doc.text('Mulaaxado (الملاحظة)', colX.note, startY + 5.5);
    doc.text('Tikraar', colX.status, startY + 5.5);

    let curY = startY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    displayedRecords.forEach((r, idx) => {
      if (curY > 265) {
        doc.addPage();
        curY = 20;
      }

      // Alternate row bg
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, curY, pageWidth - 30, 7, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, curY, pageWidth - 30, 7, 'S');

      doc.setTextColor(71, 85, 105);
      doc.text(`${idx + 1}`, colX.num + 3, curY + 5);
      doc.text((r.studentName || '-').slice(0, 28), colX.name, curY + 5);
      doc.text((r.halaqahName || '-').slice(0, 18), colX.halaqah, curY + 5);
      doc.text((r.surahName || '-').slice(0, 15), colX.surah, curY + 5);
      doc.text((r.note || '-').slice(0, 14), colX.note, curY + 5);

      const statusSymbol = r.status === 'passed' ? 'Pass (Gudbay)' : `Tikraar (${r.repeatCount || 1}x)`;
      if (r.status === 'passed') {
        doc.setTextColor(5, 150, 105);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.text(statusSymbol, colX.status, curY + 5);

      curY += 7;
    });

    // Signature Area
    const sigY = Math.min(curY + 18, 270);
    doc.setDrawColor(148, 163, 184);
    doc.line(25, sigY, 85, sigY);
    doc.line(pageWidth - 85, sigY, pageWidth - 25, sigY);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Togiiqa Macallinka Imtixaamay', 55, sigY + 5, { align: 'center' });
    doc.text('Shaabadda & Saxiixa Maamulka', pageWidth - 55, sigY + 5, { align: 'center' });

    doc.save(`Jadwalka_Suuradaha_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-4 sm:p-3.5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-[1700px] mx-auto animate-in fade-in duration-500 pb-28">

      {/* ========================================================================= */}
      {/* 1. TOP HEADER BANNER (SCREEN ONLY) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-[32px] p-6 sm:p-8 lg:p-10 text-white border border-emerald-900/40 shadow-2xl relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <BookOpen size={36} strokeWidth={2.2} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-2">
                <Sparkles size={12} />
                <span>بسم الله الرحمن الرحيم • القرآن الكريم</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>{locale === 'ar' ? 'جدول السور للقرآن الكريم' : "Jadwalka Suuradaha Quraanka"}</span>
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-1">
                CULUUMTA SHARECADA & CARABIGA EE SALAAX AL-DAAREYN • ELASHA - SOMALIA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Branch Indicator & Switcher */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 dark:bg-slate-800/80 border border-emerald-500/30 backdrop-blur-md">
              <Building2 size={16} className="text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300/80">Laanta:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent text-emerald-200 font-black text-xs border-none focus:outline-none cursor-pointer pr-2"
                >
                  {branches.map(b => {
                    const isDugsi = b.name && b.name.toLowerCase().includes('dugsi');
                    return (
                      <option key={b._id} value={b._id} className="bg-slate-900 text-white">
                        {b.name} {isDugsi ? '(Dugsiga)' : ''}
                      </option>
                    );
                  })}
                  <option value="All" className="bg-slate-900 text-white">Dhammaan Laamaha (All)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExportPDF}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700/80 shadow-md active:scale-95"
            >
              <FileDown size={16} />
              <span>PDF Soo Dejiso</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
            >
              <Printer size={16} />
              <span>Daabac Waraaqda</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRINTABLE SHEET HEADER (PRINT ONLY - REPLICATING PHYSICAL SHEET) */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-center space-y-2 mb-6 border-b-2 border-slate-900 pb-4">
        <h2 className="text-base font-black tracking-wider uppercase text-slate-900">
          CULUUMTA SHARECADA & CARABIGA EE SALAAX AL-DAAREYN
        </h2>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
          ELASHA - SOMALIA
        </p>
        <p className="text-sm font-bold text-emerald-800 font-arabic pt-1">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <h1 className="text-xl font-black text-slate-900 tracking-wide font-arabic">
          جدول السور للقرآن الكريم
        </h1>
        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 px-2">
          <span>Taariikhda: {new Date().toLocaleDateString('so-SO')}</span>
          <span>Wadarta Ardayda: {displayedRecords.length}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. VIEW SWITCHER TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setActiveView('registration')}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeView === 'registration'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/20 scale-[1.02]'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
          }`}
        >
          <GraduationCap size={18} />
          <span>📋 Diiwaangelinta Qorshaha & Bisinka (Registration)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('examinations')}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeView === 'examinations'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/20 scale-[1.02]'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
          }`}
        >
          <BookOpen size={18} />
          <span>📝 Diiwaanka Imtixaanaadka & Natiijooyinka (Examinations)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DIIWAANGELINTA QORSHAHA & BISINKA (DEDICATED ADMIN REGISTRATION) */}
      {/* ========================================================================= */}
      {activeView === 'registration' && (
        <div className="space-y-6 print:hidden">
          {/* Registration KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wadarta Ardayda</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{branchStudents.length}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Ardayda Laqdiinka</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                  {branchStudents.filter(s => (s.studentType || 'LAQDIIN') === 'LAQDIIN').length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Award size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Ardayda Horeedka (Xifdiye)</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
                  {branchStudents.filter(s => s.studentType === 'HOREED').length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Qorshe Loo Dejiyey</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {branchStudents.filter(s => !!(s.expectedLessonConfig?.surahNumber || s.quranProgress?.surahNumber)).length}
                </p>
              </div>
            </div>
          </div>

          {/* DEDICATED REGISTRATION FORM */}
          <div ref={regFormRef} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-600/30">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Diiwaangeli Qorshaha & Bisinka
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={resetRegForm}
                className="self-start sm:self-center flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw size={14} />
                <span>Nadiifi Foomka</span>
              </button>
            </div>

            <form onSubmit={handleSaveStudentPlan} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

                {/* Field 1: Xalaqadda / Fasalka */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    1. Xalaqadda / Fasalka *
                  </label>
                  <select
                    required
                    value={regClassId}
                    onChange={(e) => {
                      const newCId = e.target.value;
                      setRegClassId(newCId);
                      setRegStudent(null);
                      setRegStudentSearchQuery('');
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">-- Dooro Xalaqadda --</option>
                    {branchClasses.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name || c.className}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 2: Dooro Ardayga */}
                <div className="relative" ref={regStudentDropdownRef}>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>2. Dooro Ardayga *</span>
                    {regStudent && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <Check size={12} /> Doortay
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={!regClassId}
                      placeholder={regClassId ? "Raadi ardayga..." : "Marka hore xalaqad dooro..."}
                      value={regStudentSearchQuery}
                      onChange={(e) => {
                        setRegStudentSearchQuery(e.target.value);
                        setIsRegStudentDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (regClassId) setIsRegStudentDropdownOpen(true);
                      }}
                      className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900/50 disabled:cursor-not-allowed transition-all"
                    />
                    <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    {regStudentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setRegStudentSearchQuery('');
                          setRegStudent(null);
                        }}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {isRegStudentDropdownOpen && regClassId && (
                    <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {regFilteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-bold">
                          Xalaqaddan arday kuma jirto ama lama helin.
                        </div>
                      ) : (
                        regFilteredStudents.map((s) => (
                          <div
                            key={s._id}
                            onClick={() => handleSelectRegStudent(s)}
                            className="p-3 hover:bg-emerald-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{s.fullName}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                Roll #{s.rollNumber || s.studentCode || 'N/A'}
                              </p>
                            </div>
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg">
                              Dooro
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Field 3: Nooca Ardayga (LAQDIIN vs HOREED) */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    3. Nooca Ardayga *
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setRegStudentType('LAQDIIN')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        regStudentType === 'LAQDIIN'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
                      }`}
                    >
                      <BookOpen size={14} />
                      <span>LAQDIIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegStudentType('HOREED')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        regStudentType === 'HOREED'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'
                      }`}
                    >
                      <Award size={14} />
                      <span>HOREED</span>
                    </button>
                  </div>
                </div>

                {/* Field 4: Bisinka uu marayo (Suuradda) */}
                <div className="relative" ref={regSurahDropdownRef}>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>4. Suuradda Bisinka *</span>
                    {regSurah && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        #{regSurah.number}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Dooro suuradda..."
                      value={regSurahSearchQuery}
                      onChange={(e) => {
                        setRegSurahSearchQuery(e.target.value);
                        setIsRegSurahDropdownOpen(true);
                      }}
                      onFocus={() => setIsRegSurahDropdownOpen(true)}
                      className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-arabic"
                    />
                    <BookOpen size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  </div>

                  {isRegSurahDropdownOpen && regFilteredSurahs.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {regFilteredSurahs.map((surah) => (
                        <div
                          key={surah.number}
                          onClick={() => handleSelectRegSurah(surah)}
                          className="p-3 hover:bg-emerald-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                              {surah.number}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white font-arabic">
                                {surah.nameAr}
                              </p>
                              <p className="text-[11px] text-slate-400">{surah.nameSo} ({surah.verses} aayadood)</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-600">Dooro</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Student Details Banner (Class & Teacher) */}
              {regStudent && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/30">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{regStudent.fullName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          regStudentType === 'HOREED'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        }`}>
                          {regStudentType === 'HOREED' ? 'HOREED' : 'LAQDIIN'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Fasalka: <strong className="text-slate-700 dark:text-slate-200">{selectedRegStudentClassInfo?.className}</strong> • Macallinka: <strong className="text-emerald-600 dark:text-emerald-400">{selectedRegStudentClassInfo?.teacherName}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Qorshaha: Aayadda Bilowga & Qiyaasta Maalinlaha ah (Sadar ama Bog) */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Qiyaasta Maalinta
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Aayadda Bilowga */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Aayadda Bilowga *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={regSurah?.verses || 286}
                      required
                      value={regFromVerse}
                      onChange={(e) => setRegFromVerse(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Pace Unit Switcher (Sadar vs Bog) */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Qiyaasta Maalin kasta *
                      </label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => {
                            setRegPaceUnit('sadar');
                            setRegPaceCount(7);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                            regPaceUnit === 'sadar'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                          }`}
                        >
                          Sadar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRegPaceUnit('bog');
                            setRegPaceCount(1);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                            regPaceUnit === 'bog'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                          }`}
                        >
                          Bog
                        </button>
                      </div>
                    </div>

                    {/* Sadar Mode Chips & Input */}
                    {regPaceUnit === 'sadar' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={regPaceCount}
                            onChange={(e) => setRegPaceCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-black text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-slate-500">Sadar</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[3, 5, 7, 10, 15].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setRegPaceCount(cnt)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                                regPaceCount === cnt
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {cnt} Sadar
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bog Mode Chips & Input */}
                    {regPaceUnit === 'bog' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="20"
                            value={regPaceCount}
                            onChange={(e) => setRegPaceCount(Math.max(0.5, parseFloat(e.target.value) || 1))}
                            className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-black text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-slate-500">Bog</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[0.5, 1, 2, 3].map((bCount) => (
                            <button
                              key={bCount}
                              type="button"
                              onClick={() => setRegPaceCount(bCount)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                                regPaceCount === bCount
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {bCount === 0.5 ? '½ Bog' : `${bCount} Bog`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Submit Bar */}
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
                >
                  {regSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Waa la keydinayaa...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} strokeWidth={3} />
                      <span>Keydi Qorshaha</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* OVERVIEW TABLE: REGISTERED STUDENTS & THEIR PLANS */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen size={18} className="text-emerald-600" />
                    <span>Jadwalka Qorsheyaasha Ardayda ee Diiwaangashan</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                      {displayedRegisteredStudents.length} arday
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Liiska ardayda laanta iyo qorsheyaashooda firfircoon (Bisinka, Sadarka ama Bogga). Guji "Habee" si aad wax uga beddesho.
                  </p>
                </div>
              </div>

              {/* Filters for registered table */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Raadi ardayga, koodhka, ama roll number..."
                    value={regSearchFilter}
                    onChange={(e) => setRegSearchFilter(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  {regSearchFilter && (
                    <button
                      onClick={() => setRegSearchFilter('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={regClassFilter}
                    onChange={(e) => setRegClassFilter(e.target.value)}
                    className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="All">Dhammaan Fasalada</option>
                    {branchClasses.map(c => (
                      <option key={c._id} value={c._id}>{c.name || c.className}</option>
                    ))}
                  </select>

                  <select
                    value={regTypeFilter}
                    onChange={(e) => setRegTypeFilter(e.target.value)}
                    className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="All">Dhammaan Noocyada</option>
                    <option value="LAQDIIN">LAQDIIN</option>
                    <option value="HOREED">HOREED</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Registered Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="py-4 px-5">#</th>
                    <th className="py-4 px-5">Ardayga</th>
                    <th className="py-4 px-5">Fasalka & Macallinka</th>
                    <th className="py-4 px-5">Nooca</th>
                    <th className="py-4 px-5">Bisinka uu Marayo</th>
                    <th className="py-4 px-5">Qiyaasta Maalinlaha</th>
                    <th className="py-4 px-5">Isku-xirka (4 Maalin)</th>
                    <th className="py-4 px-5 text-right">Falka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold">
                  {displayedRegisteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Arday laguma helin xulashadaan.
                      </td>
                    </tr>
                  ) : (
                    displayedRegisteredStudents.map((st, idx) => {
                      const exp = st.expectedLessonConfig || {};
                      const prog = st.quranProgress || {};
                      const sNum = exp.surahNumber || prog.surahNumber || 1;
                      const surahObj = QURAN_SURAHS.find(s => s.number === sNum) || QURAN_SURAHS[0];
                      const fromV = exp.fromVerse || prog.fromVerse || 1;
                      const isHoreed = st.studentType === 'HOREED';
                      const paceUnit = exp.paceUnit || 'sadar';
                      const paceCount = exp.paceCount || exp.dailyPace || (paceUnit === 'bog' ? 1 : 7);

                      const cId = st.classId?._id || st.classId;
                      const foundCls = classes.find(c => String(c._id) === String(cId));
                      const className = foundCls?.name || foundCls?.className || 'Fasal la\'aan';
                      const teacherName = foundCls?.teacherId?.fullName || foundCls?.teacherId?.username || 'Lama xilsaarin';

                      return (
                        <tr key={st._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-4 px-5 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-4 px-5">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{st.fullName}</p>
                            <p className="text-[10px] text-slate-400">Roll #{st.rollNumber || st.studentCode || 'N/A'}</p>
                          </td>
                          <td className="py-4 px-5">
                            <p className="font-bold text-slate-700 dark:text-slate-300">{className}</p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{teacherName}</p>
                          </td>
                          <td className="py-4 px-5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black ${
                              isHoreed
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}>
                              {isHoreed ? 'HOREED' : 'LAQDIIN'}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <p className="font-bold text-slate-900 dark:text-white font-arabic">
                              {surahObj.number}. {surahObj.nameAr} ({surahObj.nameSo})
                            </p>
                            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                              Aayadda: {fromV}
                            </p>
                          </td>
                          <td className="py-4 px-5">
                            <span className="font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                              {paceCount} {paceUnit === 'bog' ? 'Bog' : 'Sadar'}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            {isHoreed ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg">
                                <Sparkles size={12} />
                                <span>Toos (4 Maalmood)</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditStudentPlan(st)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
                            >
                              <Settings size={13} />
                              <span>Habee / Beddel</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DIIWAANKA IMTIXAANAADKA (EXAMINATIONS & HISTORY) */}
      {/* ========================================================================= */}
      {activeView === 'examinations' && (
        <div className="space-y-6">

          {/* 3. KPI STATISTICS CARDS (SCREEN ONLY) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wadarta Imtixaannada</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Gudbay (✓)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.passed}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <RotateCcw size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Tikraar (•)</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{stats.repeat}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Award size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Heerka Baaska</p>
            <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-0.5">{stats.passRate}%</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. FAST ENTRY FORM (AUTO-FILLS STUDENT & HALAQAH, LEAVES REST BLANK) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Diiwaangeli Imtixaanka Suuradda
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="self-start sm:self-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <RefreshCw size={14} />
            <span>Nadiifi Form-ka</span>
          </button>
        </div>

        <form onSubmit={handleSubmitRecord} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Field 1: Magaca Ardayga - Autocomplete Search */}
            <div className="relative" ref={studentDropdownRef}>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>1. Magaca Ardayga *</span>
                {selectedStudent && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check size={12} /> Doortay
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Gali magaca ardayga..."
                  value={studentSearchQuery}
                  onChange={(e) => {
                    setStudentSearchQuery(e.target.value);
                    setIsStudentDropdownOpen(true);
                  }}
                  onFocus={() => setIsStudentDropdownOpen(true)}
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                {studentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearchQuery('');
                      setSelectedStudent(null);
                      setHalaqahName('');
                      setClassId('');
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Student Dropdown List */}
              {isStudentDropdownOpen && filteredStudents.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredStudents.map((s) => {
                    const halName = s.classId?.name || s.classId?.className || 'Halaqah guud';
                    return (
                      <div
                        key={s._id}
                        onClick={() => handleSelectStudent(s)}
                        className="p-3 hover:bg-emerald-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{s.fullName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Roll #{s.rollNumber || s.studentCode || 'N/A'} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">{halName}</span>
                          </p>
                        </div>
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg">
                          Dooro
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* INFO BANNER: Assigned Class & Teacher */}
            {selectedStudent && (
              <div className="md:col-span-2 lg:col-span-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/30">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{selectedStudent.fullName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                        {studentType}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Fasalka: <span className="font-bold text-slate-700 dark:text-slate-200">{selectedStudentClassInfo?.className}</span> • Macallinka: <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedStudentClassInfo?.teacherName}</span>
                    </p>
                  </div>
                </div>

                {/* Student Type Selector */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black uppercase text-slate-400 px-2">Nooca:</span>
                  <button
                    type="button"
                    onClick={() => setStudentType('LAQDIIN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      studentType === 'LAQDIIN'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    LAQDIIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentType('HOREED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      studentType === 'HOREED'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    HOREED (Xifdiye)
                  </button>
                </div>
              </div>
            )}

            {/* Field 2: Xalaqadda (الحلقة) - Auto-filled from Student */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>2. Xalaqadda</span>
              </label>
              <input
                type="text"
                placeholder="Xalaqadda ardayga..."
                value={halaqahName}
                onChange={(e) => setHalaqahName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-800/80 border border-emerald-200 dark:border-slate-700 text-sm font-bold text-emerald-950 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Field 3: Suuradda - Left blank ready for entry */}
            <div className="relative" ref={surahDropdownRef}>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>3. Suuradda *</span>
                {selectedSurah && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    #{selectedSurah.number}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  ref={surahInputRef}
                  type="text"
                  required
                  placeholder="Dooro ama qor suuradda..."
                  value={surahSearchQuery}
                  onChange={(e) => {
                    setSurahSearchQuery(e.target.value);
                    setIsSurahDropdownOpen(true);
                  }}
                  onFocus={() => setIsSurahDropdownOpen(true)}
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-arabic"
                />
                <BookOpen size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                {surahSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSurahSearchQuery('');
                      setSelectedSurah(null);
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Surah Dropdown List */}
              {isSurahDropdownOpen && filteredSurahs.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/60 sticky top-0 z-10 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700">
                    <span>114 Suuradood ({filteredSurahs.length} diyaar ah)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Dooro mid</span>
                  </div>
                  {filteredSurahs.map((surah) => (
                    <div
                      key={surah.number}
                      onClick={() => handleSelectSurah(surah)}
                      className="p-3 hover:bg-emerald-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                          {surah.number}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-arabic">
                            {surah.nameAr}
                          </p>
                          <p className="text-[11px] text-slate-400">{surah.nameSo} ({surah.verses} aayadood)</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">Dooro</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Field 4: Taariikhda */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                4. Taariikhda *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <Calendar size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

          </div>

          {/* QORSHAHA ADMIN-KA: AAYADAHA, BOGGA & XAWAARAHA */}
          <div className="p-5 rounded-3xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Qorshaha Cashirka
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Aayadda Bilowga
                </label>
                <input
                  type="number"
                  min="1"
                  value={fromVerse}
                  onChange={(e) => {
                    const f = Math.max(1, parseInt(e.target.value) || 1);
                    setFromVerse(f);
                    if (toVerse < f) setToVerse(f + 4);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Aayadda Ku Eg
                </label>
                <input
                  type="number"
                  min={fromVerse}
                  value={toVerse}
                  onChange={(e) => setToVerse(Math.max(fromVerse, parseInt(e.target.value) || fromVerse))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Bogga / Safafka (Ikhtiyaari)
                </label>
                <input
                  type="text"
                  placeholder="tusaale: Bogga 45, safafka 1-15"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Xawaaraha (Aayadood Maalinkii)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={dailyPace}
                  onChange={(e) => setDailyPace(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* JADWALKA ISKU-XIR (KALIYA ARDAYDA HOREED) */}
            {studentType === 'HOREED' && (
              <div className="mt-3 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
                    <h4 className="text-xs font-black text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                      Jadwalka ISKU-XIR (Revision Schedule ee HOREED)
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-700 dark:text-purple-300">
                    <input
                      type="checkbox"
                      checked={isIskuXirActive}
                      onChange={(e) => setIsIskuXirActive(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Hawlgeli Isku-xirka</span>
                  </label>
                </div>

                {isIskuXirActive && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-400 mb-1.5">
                        Maalmaha uu ardaygu leeyahay Isku-Xir:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {['Sabti', 'Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce'].map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleIskuXirDay(day)}
                            className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                              iskuXirDays.includes(day)
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-slate-700 border border-purple-200 dark:border-slate-700'
                            }`}
                          >
                            {day} {iskuXirDays.includes(day) ? '✓' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-purple-800 dark:text-purple-300 mb-1">
                          Suuradda Isku-xirka
                        </label>
                        <select
                          value={iskuXirSurahNum}
                          onChange={(e) => setIskuXirSurahNum(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                        >
                          {QURAN_SURAHS.map(s => (
                            <option key={s.number} value={s.number}>
                              {s.number}. {s.nameAr} ({s.nameSo})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-purple-800 dark:text-purple-300 mb-1">
                          Aayadaha Isku-xirka (From - To)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={iskuXirFromVerse}
                            onChange={(e) => setIskuXirFromVerse(Number(e.target.value) || 1)}
                            className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-xs font-bold text-center text-slate-900 dark:text-white"
                          />
                          <span className="text-xs text-slate-400">-</span>
                          <input
                            type="number"
                            min="1"
                            value={iskuXirToVerse}
                            onChange={(e) => setIskuXirToVerse(Number(e.target.value) || 1)}
                            className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-xs font-bold text-center text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-purple-800 dark:text-purple-300 mb-1">
                          Xusuusin Isku-xir
                        </label>
                        <input
                          type="text"
                          placeholder="Faallada dib-u-eegista..."
                          value={iskuXirNotes}
                          onChange={(e) => setIskuXirNotes(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Mulaaxadada (الملاحظة) & Tikraarka (التكرار) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">

            {/* Mulaaxadada (الملاحظة) */}
            <div className="lg:col-span-2 space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                5. Mulaaxadada Macallinka (الملاحظة)
              </label>
              <input
                type="text"
                placeholder="Qor faallada (tusaale: ضعيفة الحفظ, حفظ ممتاز, تحتاج مراجعة)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-arabic"
              />

              {/* Quick Clickable Note Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Degdeg u xulo:</span>
                {QUICK_NOTES.map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setNote(quick)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      note === quick
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>

            {/* Tikraarka / Xaaladda (التكرار: ✓ Gudbay / • Tikraar) */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                6. Tikraarka / Xaaladda (التكرار) *
              </label>
              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={() => setStatus('passed')}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-black text-xs transition-all border ${
                    status === 'passed'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Check size={18} strokeWidth={3} />
                  <span>✓ Gudbay (ناجح)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('repeat')}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-black text-xs transition-all border ${
                    status === 'repeat'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30 ring-2 ring-amber-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl leading-none">•</span>
                  <span>Tikraar (تكرار)</span>
                </button>
              </div>

              {status === 'repeat' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <RotateCcw size={13} className="text-amber-600" />
                      Tirada Tikraarka:
                    </span>
                    <span className="text-[11px] font-black text-amber-800 dark:text-amber-200 bg-amber-200/70 dark:bg-amber-900/70 px-2.5 py-0.5 rounded-full">
                      {repeatCount} jeer
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-sm font-black text-amber-950 dark:text-amber-100 text-center focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {REPEAT_CHIPS.map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setRepeatCount(num)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                            repeatCount === num
                              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/30'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-800 border border-amber-200/60 dark:border-slate-800'
                          }`}
                        >
                          {num}x
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold italic">
                    Ardayga waxaa lagu celinayaa {repeatCount} jeer si uu u soo adkeeyo suuradda.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Waa la kaydinayaa...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>Kaydi Natiijada (حفظ النتيجة)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 5. RECORDS TABLE SECTION (MATCHING PHYSICAL PAPER SHEET) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none">

        {/* Filter bar (Screen only) */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4 print:hidden">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Raadi arday, xalaqad, suurad, ama faallo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Halaqah Filter */}
              <div className="relative">
                <select
                  value={halaqahFilter}
                  onChange={(e) => setHalaqahFilter(e.target.value)}
                  className="appearance-none pl-3.5 pr-8 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">Dhammaan Xalaqaadka</option>
                  {uniqueHalaqahs.map((hal) => (
                    <option key={hal} value={hal}>{hal}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-3.5 pr-8 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">Dhammaan Xaaladaha</option>
                  <option value="passed">Gudbay (✓)</option>
                  <option value="repeat">Tikraar (•)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Date Filter */}
              <div className="relative">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {(searchFilter || halaqahFilter !== 'All' || statusFilter !== 'All' || dateFilter) && (
                <button
                  onClick={() => {
                    setSearchFilter('');
                    setHalaqahFilter('All');
                    setStatusFilter('All');
                    setDateFilter('');
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                >
                  Dib u celi miirayaasha
                </button>
              )}
            </div>
          </div>
        </div>

        {/* The Exact Table from Physical Sheet */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse print:text-xs">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 print:bg-slate-100 print:border-slate-900 print:border-b-2">
                <th className="py-4 px-4 text-center text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-14 print:border print:border-slate-400">
                  الرقم (#)
                </th>
                <th className="py-4 px-5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 print:border print:border-slate-400">
                  الاسم (Magaca Ardayga)
                </th>
                <th className="py-4 px-5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 print:border print:border-slate-400">
                  الحلقة (Xalaqadda)
                </th>
                <th className="py-4 px-5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 print:border print:border-slate-400">
                  السورة (Suuradda)
                </th>
                <th className="py-4 px-5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 print:border print:border-slate-400">
                  الملاحظة (Mulaaxadada)
                </th>
                <th className="py-4 px-4 text-center text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 print:border print:border-slate-400">
                  التكرار (Tikraarka)
                </th>
                <th className="py-4 px-4 text-center text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 print:border print:border-slate-400">
                  التاريخ (Taariikhda)
                </th>
                <th className="py-4 px-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 print:hidden">
                  Ficilada
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-sm font-bold text-slate-400">
                    Xogta waa la soo rarayaa...
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center space-y-2">
                    <p className="text-base font-bold text-slate-600 dark:text-slate-300">
                      Weli wax imtixaan suurad ah lama diiwaangelin.
                    </p>
                    <p className="text-xs text-slate-400">
                      U isticmaal form-ka sare si aad u diiwaangeliso imtixaanka ugu horreeya.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((record, index) => (
                  <tr
                    key={record._id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors print:border print:border-slate-400"
                  >
                    {/* Column 1: # الرقم */}
                    <td className="py-3.5 px-4 text-center font-bold text-xs text-slate-400 print:border print:border-slate-400">
                      {index + 1}
                    </td>

                    {/* Column 2: الاسم */}
                    <td className="py-3.5 px-5 font-bold text-sm text-slate-900 dark:text-white print:border print:border-slate-400">
                      <div className="flex items-center gap-2">
                        <span>{record.studentName}</span>
                        {record.studentId?.rollNumber && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 print:hidden">
                            #{record.studentId.rollNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3: الحلقة */}
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-600 dark:text-slate-300 print:border print:border-slate-400">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold print:bg-transparent print:p-0">
                        {record.halaqahName || '-'}
                      </span>
                    </td>

                    {/* Column 4: السورة */}
                    <td className="py-3.5 px-5 font-bold text-sm text-emerald-700 dark:text-emerald-400 font-arabic print:border print:border-slate-400">
                      <div className="flex items-center gap-2">
                        {record.surahNumber && (
                          <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center print:hidden">
                            {record.surahNumber}
                          </span>
                        )}
                        <span>{record.surahName}</span>
                      </div>
                    </td>

                    {/* Column 5: الملاحظة */}
                    <td className="py-3.5 px-5 text-xs text-slate-600 dark:text-slate-300 font-arabic font-medium print:border print:border-slate-400">
                      {record.note ? (
                        <span className="italic">{record.note}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Column 6: التكرار */}
                    <td className="py-3.5 px-4 text-center print:border print:border-slate-400">
                      {record.status === 'passed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-black print:bg-transparent print:text-slate-900">
                          <Check size={14} strokeWidth={3} className="print:inline" />
                          <span>Gudbay</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-200/80 dark:border-amber-800/60 shadow-sm print:bg-transparent print:text-slate-900">
                          <RotateCcw size={12} className="text-amber-600 shrink-0 print:hidden" />
                          <span>Tikraar ({record.repeatCount || 1} jeer)</span>
                        </span>
                      )}
                    </td>

                    {/* Column 7: التاريخ */}
                    <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 print:border print:border-slate-400">
                      {record.date ? new Date(record.date).toLocaleDateString('so-SO') : '-'}
                    </td>

                    {/* Column 8: Ficilada (Actions) */}
                    <td className="py-3.5 px-4 text-right print:hidden">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingRecord({ ...record, date: record.date ? record.date.slice(0, 10) : '' })}
                          title="Wax ka bedel"
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record)}
                          title="Tirtir"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Signatures Area at the bottom of the table (PRINT ONLY) */}
        <div className="hidden print:grid grid-cols-2 gap-16 pt-16 px-6 pb-6 text-center text-xs font-bold text-slate-800">
          <div>
            <div className="border-b border-slate-700 mb-2 h-10" />
            <p className="font-arabic font-bold text-sm">توقيع الأستاذ المختبر</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">(Saxiixa Macallinka Imtixaamay)</p>
          </div>
          <div>
            <div className="border-b border-slate-700 mb-2 h-10" />
            <p className="font-arabic font-bold text-sm">ختم وتوقيع الإدارة</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">(Shaabadda & Saxiixa Maamulka)</p>
          </div>
        </div>

      </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. EDIT RECORD MODAL */}
      {/* ========================================================================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Wax ka bedel Imtixaanka
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Magaca Ardayga (الاسم)
                </label>
                <input
                  type="text"
                  required
                  value={editingRecord.studentName || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, studentName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Xalaqadda (الحلقة)
                </label>
                <input
                  type="text"
                  value={editingRecord.halaqahName || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, halaqahName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Suuradda (السورة)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.surahName || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, surahName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white font-arabic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Taariikhda (التاريخ)
                  </label>
                  <input
                    type="date"
                    required
                    value={editingRecord.date || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mulaaxadada (الملاحظة)
                </label>
                <input
                  type="text"
                  value={editingRecord.note || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, note: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white font-arabic"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tikraarka / Xaaladda (التكرار)
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingRecord({ ...editingRecord, status: 'passed' })}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                      editingRecord.status === 'passed'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ✓ Gudbay
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRecord({ ...editingRecord, status: 'repeat', repeatCount: editingRecord.repeatCount || 3 })}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                      editingRecord.status === 'repeat'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    • Tikraar
                  </button>
                </div>

                {editingRecord.status === 'repeat' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">
                        Tirada Tikraarka:
                      </label>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                        {editingRecord.repeatCount || 1} jeer
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editingRecord.repeatCount || 1}
                        onChange={(e) => setEditingRecord({
                          ...editingRecord,
                          repeatCount: Math.max(1, parseInt(e.target.value) || 1)
                        })}
                        className="w-20 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-sm font-bold text-center"
                      />
                      <div className="flex flex-wrap gap-1">
                        {REPEAT_CHIPS.map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setEditingRecord({ ...editingRecord, repeatCount: n })}
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              (editingRecord.repeatCount || 1) === n
                                ? 'bg-amber-500 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-amber-200/40'
                            }`}
                          >
                            {n}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Iska daa
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cusbooneysii
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuranManagement;
