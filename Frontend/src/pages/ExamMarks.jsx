import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  PenSquare, Save, Loader2, ClipboardList, Users, Printer,
  FileDown, BookOpen, Layers, CheckCircle2, AlertCircle, Sparkles, X, Building2,
  Search, Check, Edit3
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const ExamMarks = () => {
  const { showAlert } = useAlert();
  const { t, tv, locale } = useLanguage();
  const location = useLocation();

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [serverTeacherAssignedSubjects, setServerTeacherAssignedSubjects] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [exam, setExam] = useState(null);
  const [settings, setSettings] = useState(null);

  // Identify logged in teacher
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

  const [rows, setRows] = useState([]); // editable grid state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [editingStudentIds, setEditingStudentIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const initialMarksRef = useRef(new Map());

  // Subject view filter: null means All Subjects, or subject name string
  const [activeSubject, setActiveSubject] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printBlank, setPrintBlank] = useState(false);
  const [showAllParts, setShowAllParts] = useState(false);

  // Handle Escape key and body scroll lock for printable modal
  useEffect(() => {
    if (!printModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPrintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [printModalOpen]);

  // Load initial settings, classes, exams, branches, and subjects
  useEffect(() => {
    (async () => {
      try {
        const [resExams, resClasses, resSettings, resBranches, resSubjects] = await Promise.all([
          api.get('/exams'),
          api.get('/classes'),
          api.get('/settings').catch(() => ({ data: null })),
          api.get('/branches').catch(() => ({ data: [] })),
          api.get('/subjects').catch(() => ({ data: [] }))
        ]);
        const examsData = resExams.data || [];
        const classesData = resClasses.data || [];
        let branchesData = resBranches?.data || [];
        const subjectsData = resSubjects?.data || [];

        // Fallback: derive unique branches from classes if branches endpoint was empty
        if (!branchesData.length) {
          const branchMap = new Map();
          classesData.forEach(c => {
            if (c.branchId && typeof c.branchId === 'object' && c.branchId._id) {
              branchMap.set(String(c.branchId._id), c.branchId);
            }
          });
          branchesData = Array.from(branchMap.values());
        }

        setExams(examsData);
        setClasses(classesData);
        setBranches(branchesData);
        setSubjectsList(subjectsData);
        if (resSettings?.data) setSettings(resSettings.data);

        // Check URL params
        const paramExam = new URLSearchParams(location.search).get('exam');
        if (paramExam) {
          const match = examsData.find(e => e._id === paramExam);
          if (match) {
            const cId = match.classId?._id || match.classId;
            const classObj = classesData.find(c => c._id === cId);
            const bId = classObj?.branchId?._id || classObj?.branchId;
            if (bId) setSelectedBranchId(String(bId));
            setSelectedClassId(cId || '');
            setSelectedExamId(paramExam);
            return;
          }
        }

        // Default selection: if teacher, preselect their branch
        let initialBranchId = '';
        if (isTeacher && currentUser) {
          if (currentUser.branchId) {
            initialBranchId = String(currentUser.branchId?._id || currentUser.branchId);
          } else if (Array.isArray(currentUser.branchIds) && currentUser.branchIds.length > 0) {
            initialBranchId = String(currentUser.branchIds[0]?._id || currentUser.branchIds[0]);
          }
        }

        if (classesData.length) {
          const firstClass = classesData[0];
          const firstClassId = firstClass._id;
          const bId = initialBranchId || firstClass.branchId?._id || firstClass.branchId;
          if (bId) setSelectedBranchId(String(bId));
          setSelectedClassId(firstClassId);
          const firstClassExams = examsData.filter(e => (e.classId?._id || e.classId) === firstClassId);
          if (firstClassExams.length) {
            setSelectedExamId(firstClassExams[0]._id);
          }
        } else if (examsData.length) {
          setSelectedExamId(examsData[0]._id);
        }
      } catch (error) {
        console.error(error);
        showAlert({ type: 'danger', title: t('common.error'), message: t('exams.loadFailed') });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Teacher-scoped branches: if teacher, only show their assigned branches
  const teacherBranchIds = useMemo(() => {
    if (!isTeacher || !currentUser) return null;
    const ids = [];
    if (currentUser.branchId) ids.push(String(currentUser.branchId?._id || currentUser.branchId));
    if (Array.isArray(currentUser.branchIds)) {
      currentUser.branchIds.forEach(b => ids.push(String(b?._id || b)));
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }, [isTeacher, currentUser]);

  const visibleBranches = useMemo(() => {
    if (!isTeacher || !teacherBranchIds || teacherBranchIds.length === 0) {
      return branches;
    }
    const filtered = branches.filter(b => teacherBranchIds.includes(String(b._id)));
    return filtered.length > 0 ? filtered : branches;
  }, [branches, isTeacher, teacherBranchIds]);

  // Teacher-scoped classes: only classes where teacher teaches subjects or is class teacher
  const teacherClassIds = useMemo(() => {
    if (!isTeacher || !currentUser) return null;
    const teacherIdStr = String(currentUser._id);
    const cIds = new Set();

    classes.forEach(c => {
      const ctId = c.teacherId?._id || c.teacherId;
      if (ctId && String(ctId) === teacherIdStr) {
        cIds.add(String(c._id));
      }
    });

    subjectsList.forEach(s => {
      const stId = s.teacherId?._id || s.teacherId;
      if (stId && String(stId) === teacherIdStr) {
        (s.classIds || []).forEach(cid => {
          const idStr = cid?._id || cid;
          if (idStr) cIds.add(String(idStr));
        });
      }
    });

    return cIds;
  }, [isTeacher, currentUser, classes, subjectsList]);

  // Filter classes by selected branch AND teacher assignment
  const filteredClasses = useMemo(() => {
    let list = classes;
    if (isTeacher && teacherClassIds && teacherClassIds.size > 0) {
      list = list.filter(c => teacherClassIds.has(String(c._id)));
    }
    if (!selectedBranchId) return list;
    return list.filter(c => {
      const bId = c.branchId?._id || c.branchId;
      return String(bId) === selectedBranchId;
    });
  }, [classes, selectedBranchId, isTeacher, teacherClassIds]);

  // Handle branch change -> only that branch's classes remain
  const handleBranchChange = (newBranchId) => {
    setSelectedBranchId(newBranchId);
    const matchingClasses = !newBranchId
      ? filteredClasses
      : filteredClasses.filter(c => String(c.branchId?._id || c.branchId) === newBranchId);

    if (matchingClasses.length) {
      const stillValid = matchingClasses.some(c => c._id === selectedClassId);
      if (!stillValid) {
        handleClassChange(matchingClasses[0]._id);
      }
    } else {
      handleClassChange('');
    }
  };

  // Filter exams by selected class
  const filteredExams = useMemo(() => {
    if (!selectedClassId) return exams;
    return exams.filter(e => (e.classId?._id || e.classId) === selectedClassId);
  }, [exams, selectedClassId]);

  // When class changes, adjust selectedExamId
  const handleClassChange = (newClassId) => {
    setSelectedClassId(newClassId);
    if (!newClassId) {
      if (filteredExams.length) setSelectedExamId(filteredExams[0]._id);
      return;
    }
    const matching = exams.filter(e => (e.classId?._id || e.classId) === newClassId);
    if (matching.length) {
      setSelectedExamId(matching[0]._id);
    } else {
      setSelectedExamId('');
      setExam(null);
      setRows([]);
    }
  };

  // Load selected exam's students and marks
  useEffect(() => {
    if (!selectedExamId) {
      setExam(null);
      setRows([]);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/exams/${selectedExamId}/results`);
        setExam(data.exam);
        setServerTeacherAssignedSubjects(data.teacherAssignedSubjects || null);

        const formattedRows = (data.results || []).map(r => {
          const marksObj = {};
          (r.subjects || []).forEach(s => {
            const isSubEntered = Boolean(s.entered);
            marksObj[s.subject] = {
              nisfi: isSubEntered ? (s.nisfi !== undefined && s.nisfi !== null && s.nisfi !== '' ? String(s.nisfi) : '') : '',
              nihaayi: isSubEntered ? (s.nihaayi !== undefined && s.nihaayi !== null && s.nihaayi !== '' ? String(s.nihaayi) : '') : '',
              marksObtained: isSubEntered ? (s.marksObtained !== undefined && s.marksObtained !== null ? Number(s.marksObtained) : null) : null,
              entered: isSubEntered
            };
          });

          return {
            studentId: r.studentId,
            studentName: r.studentName,
            rollNumber: r.rollNumber,
            remarks: r.remarks || '',
            entered: r.entered,
            absent: r.subjects.length > 0 && r.subjects.every(s => s.isAbsent) && r.entered,
            marks: marksObj
          };
        });

        setRows(formattedRows);
        initialMarksRef.current.clear();
        formattedRows.forEach(r => {
          initialMarksRef.current.set(r.studentId, JSON.parse(JSON.stringify(r)));
        });
        setEditingStudentIds(new Set());
      } catch (error) {
        console.error(error);
        showAlert({ type: 'danger', title: t('common.error'), message: t('exams.marks.loadFailed') });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  // Teacher-scoped subjects in this exam:
  // If teacher, only the subjects assigned to this teacher in this class are shown!
  const allExamSubjects = exam?.subjects || [];

  const teacherAllowedSubjectNames = useMemo(() => {
    if (!isTeacher || !currentUser || !exam) return null;
    const teacherIdStr = String(currentUser._id);
    const examClassIdStr = String(exam.classId?._id || exam.classId);

    const allowed = new Set();
    if (Array.isArray(serverTeacherAssignedSubjects)) {
      serverTeacherAssignedSubjects.forEach(name => allowed.add(name.trim().toLowerCase()));
    }

    subjectsList.forEach(s => {
      const stId = s.teacherId?._id || s.teacherId;
      if (stId && String(stId) === teacherIdStr) {
        const classList = s.classIds || [];
        const isForThisClass = classList.length === 0 || classList.some(c => String(c?._id || c) === examClassIdStr);
        if (isForThisClass && s.name) {
          allowed.add(s.name.trim().toLowerCase());
        }
      }
    });

    return allowed;
  }, [isTeacher, currentUser, exam, serverTeacherAssignedSubjects, subjectsList]);

  const visibleSubjects = useMemo(() => {
    if (!allExamSubjects.length) return [];
    if (!isTeacher || !teacherAllowedSubjectNames || teacherAllowedSubjectNames.size === 0) {
      return allExamSubjects;
    }
    const filtered = allExamSubjects.filter(s => teacherAllowedSubjectNames.has(s.name.trim().toLowerCase()));
    return filtered.length > 0 ? filtered : allExamSubjects;
  }, [allExamSubjects, isTeacher, teacherAllowedSubjectNames]);

  // Keep activeSubject in sync with visibleSubjects
  useEffect(() => {
    if (visibleSubjects.length > 0) {
      if (!activeSubject || !visibleSubjects.some(s => s.name === activeSubject)) {
        setActiveSubject(visibleSubjects[0].name);
      }
    }
  }, [visibleSubjects, activeSubject]);

  const subjects = visibleSubjects;
  const isMidTerm = exam?.examType === 'Mid-Term';
  const isFinal = exam?.examType === 'Final';
  const isCombined = exam?.examType === 'Combined';

  const showNisfi = isMidTerm || isCombined || showAllParts || (!isMidTerm && !isFinal);
  const showNihaayi = isFinal || isCombined || showAllParts || (!isMidTerm && !isFinal);

  // Update mark for a specific student and subject (nisfi or nihaayi)
  const setScore = (studentId, subjectName, part, val) => {
    if (val !== '' && Number(val) < 0) return; // Prevent negative values
    setRows(prev => prev.map(r => {
      if (r.studentId !== studentId) return r;
      const prevSub = r.marks[subjectName] || { nisfi: '', nihaayi: '', marksObtained: null, entered: false };
      const nextSub = { ...prevSub, [part]: val };
      const hasNisfi = nextSub.nisfi !== '' && nextSub.nisfi !== undefined && nextSub.nisfi !== null;
      const hasNihaayi = nextSub.nihaayi !== '' && nextSub.nihaayi !== undefined && nextSub.nihaayi !== null;
      const n = Number(nextSub.nisfi) || 0;
      const f = Number(nextSub.nihaayi) || 0;

      if (isMidTerm && !showAllParts) {
        nextSub.marksObtained = hasNisfi ? n : null;
      } else if (isFinal && !showAllParts) {
        nextSub.marksObtained = hasNihaayi ? f : null;
      } else {
        nextSub.marksObtained = (hasNisfi || hasNihaayi) ? (n + f) : null;
      }

      return {
        ...r,
        marks: {
          ...r.marks,
          [subjectName]: nextSub
        }
      };
    }));
  };

  const setRemark = (studentId, value) => {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, remarks: value } : r));
  };

  const toggleAbsent = (studentId) => {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, absent: !r.absent } : r));
  };

  const currentSubjectObj = useMemo(() => {
    return subjects.find(s => s.name === activeSubject) || subjects[0] || null;
  }, [subjects, activeSubject]);

  const examMax = Number(exam?.maxMarks) || 0;

  const currentSubMax = isMidTerm && !showAllParts
    ? (examMax || currentSubjectObj?.nisfiFullMarks || 40)
    : isFinal && !showAllParts
      ? (examMax || currentSubjectObj?.nihaayiFullMarks || 60)
      : (examMax || currentSubjectObj?.fullMarks || 100);

  const currentSubPass = isMidTerm && !showAllParts
    ? Math.min(Number(currentSubjectObj?.passMarks || Math.round(currentSubMax * 0.4)), currentSubMax)
    : isFinal && !showAllParts
      ? Math.min(Number(currentSubjectObj?.passMarks || Math.round(currentSubMax * 0.4)), currentSubMax)
      : Number(currentSubjectObj?.passMarks || Math.round(currentSubMax * 0.4));

  const studentTotalScore = (r) => {
    if (r.absent) return 0;
    return subjects.reduce((sum, s) => {
      const sm = r.marks[s.name];
      return sum + (Number(sm?.marksObtained) || 0);
    }, 0);
  };

  const totalFullMarks = useMemo(() => {
    return subjects.reduce((sum, s) => {
      const full = isMidTerm && !showAllParts
        ? Number(exam?.maxMarks || s.nisfiFullMarks || 40)
        : isFinal && !showAllParts
          ? Number(exam?.maxMarks || s.nihaayiFullMarks || 60)
          : Number(exam?.maxMarks || s.fullMarks || 100);
      return sum + full;
    }, 0);
  }, [subjects, isMidTerm, isFinal, showAllParts, exam?.maxMarks]);

  const hasInput = (r) => {
    if (r.absent || (r.remarks && r.remarks.trim())) return true;
    return subjects.some(s => {
      const sm = r.marks[s.name];
      return sm?.entered ||
             (sm?.nisfi !== '' && sm?.nisfi !== undefined && sm?.nisfi !== null) ||
             (sm?.nihaayi !== '' && sm?.nihaayi !== undefined && sm?.nihaayi !== null);
    });
  };

  // Filtered rows by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase().trim();
    return rows.filter(r =>
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.rollNumber && String(r.rollNumber).toLowerCase().includes(q))
    );
  }, [rows, searchTerm]);

  // Cancel single student edit and revert to cached original
  const handleCancelEdit = (studentId) => {
    const original = initialMarksRef.current.get(studentId);
    if (original) {
      setRows(prev => prev.map(r => r.studentId === studentId ? JSON.parse(JSON.stringify(original)) : r));
    }
    setEditingStudentIds(prev => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  // Save single student's marks immediately
  const handleSaveSingleStudent = async (studentId) => {
    if (!exam || !selectedExamId) return;
    const r = rows.find(x => x.studentId === studentId);
    if (!r) return;

    // Validate marks against upper limits for this student
    if (!r.absent) {
      for (const s of subjects) {
        const sm = r.marks[s.name] || {};
        const nVal = Number(sm.nisfi);
        const fVal = Number(sm.nihaayi);
        const maxNisfi = isMidTerm ? (Number(exam?.maxMarks) || Number(s.nisfiFullMarks) || 40) : Number(s.nisfiFullMarks || 40);
        const maxNihaayi = isFinal ? (Number(exam?.maxMarks) || Number(s.nihaayiFullMarks) || 60) : Number(s.nihaayiFullMarks || 60);

        if (sm.nisfi !== '' && sm.nisfi !== undefined) {
          if (nVal < 0 || nVal > maxNisfi) {
            return showAlert({
              type: 'warning',
              title: t('exams.marks.invalidTitle', 'Dhibco aan sax ahayn'),
              message: `${r.studentName} (${s.name}): Nisfi waa inuu u dhexeeyo 0 iyo ${maxNisfi}.`
            });
          }
        }
        if (sm.nihaayi !== '' && sm.nihaayi !== undefined) {
          if (fVal < 0 || fVal > maxNihaayi) {
            return showAlert({
              type: 'warning',
              title: t('exams.marks.invalidTitle', 'Dhibco aan sax ahayn'),
              message: `${r.studentName} (${s.name}): Nihaayi waa inuu u dhexeeyo 0 iyo ${maxNihaayi}.`
            });
          }
        }
      }
    }

    const payloadRow = {
      studentId: r.studentId,
      remarks: r.remarks || '',
      marks: subjects
        .filter(s => {
          const sm = r.marks[s.name] || {};
          return (
            r.absent ||
            sm.entered ||
            (sm.nisfi !== '' && sm.nisfi !== undefined && sm.nisfi !== null) ||
            (sm.nihaayi !== '' && sm.nihaayi !== undefined && sm.nihaayi !== null)
          );
        })
        .map(s => {
          const sm = r.marks[s.name] || {};
          const hasNisfi = sm.nisfi !== '' && sm.nisfi !== undefined && sm.nisfi !== null;
          const hasNihaayi = sm.nihaayi !== '' && sm.nihaayi !== undefined && sm.nihaayi !== null;
          const nisfi = r.absent ? 0 : (hasNisfi ? Number(sm.nisfi) : null);
          const nihaayi = r.absent ? 0 : (hasNihaayi ? Number(sm.nihaayi) : null);
          let marksObtained = null;
          if (r.absent) {
            marksObtained = 0;
          } else {
            if (isMidTerm && !showAllParts) {
              marksObtained = hasNisfi ? Number(sm.nisfi) : null;
            } else if (isFinal && !showAllParts) {
              marksObtained = hasNihaayi ? Number(sm.nihaayi) : null;
            } else {
              marksObtained = (hasNisfi || hasNihaayi)
                ? ((Number(sm.nisfi) || 0) + (Number(sm.nihaayi) || 0))
                : (sm.marksObtained !== null && sm.marksObtained !== undefined ? Number(sm.marksObtained) : null);
            }
          }
          return {
            subject: s.name,
            nisfi,
            nihaayi,
            marksObtained,
            isAbsent: Boolean(r.absent)
          };
        })
    };

    try {
      setSavingStudentId(studentId);
      await api.post(`/exams/${selectedExamId}/results`, { results: [payloadRow] });

      const currentSubName = currentSubjectObj?.name;
      setRows(prev => prev.map(item => {
        if (item.studentId !== studentId) return item;
        const nextMarks = { ...item.marks };
        if (currentSubName && nextMarks[currentSubName]) {
          nextMarks[currentSubName] = {
            ...nextMarks[currentSubName],
            entered: true
          };
        }
        return { ...item, entered: true, marks: nextMarks };
      }));

      const updatedMarks = {
        ...r.marks,
        ...(currentSubName ? {
          [currentSubName]: {
            ...(r.marks[currentSubName] || {}),
            entered: true
          }
        } : {})
      };
      initialMarksRef.current.set(studentId, JSON.parse(JSON.stringify({ ...r, entered: true, marks: updatedMarks })));
      setEditingStudentIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });

      showAlert({
        type: 'success',
        title: t('exams.marks.savedTitle', 'Waa la kaydiyey'),
        message: t('exams.marks.studentSaved', { name: r.studentName }) || `Dhibcaha ardayga ${r.studentName} si guul leh ayaa loo kaydiyey.`
      });
    } catch (error) {
      console.error(error);
      showAlert({
        type: 'danger',
        title: t('common.error', 'Qalad'),
        message: error.response?.data?.message || t('exams.marks.saveFailed', 'Kaydinta dhibcaha way fashilantay.')
      });
    } finally {
      setSavingStudentId(null);
    }
  };

  // Save handler (Save Guud / Bulk Save)
  const handleSave = async () => {
    if (!exam || !rows.length) return;

    // Validate marks against upper limits
    for (const r of rows) {
      if (r.absent) continue;
      for (const s of subjects) {
        const sm = r.marks[s.name] || {};
        const nVal = Number(sm.nisfi);
        const fVal = Number(sm.nihaayi);
        const maxNisfi = isMidTerm ? (Number(exam?.maxMarks) || Number(s.nisfiFullMarks) || 40) : Number(s.nisfiFullMarks || 40);
        const maxNihaayi = isFinal ? (Number(exam?.maxMarks) || Number(s.nihaayiFullMarks) || 60) : Number(s.nihaayiFullMarks || 60);

        if (sm.nisfi !== '' && sm.nisfi !== undefined) {
          if (nVal < 0 || nVal > maxNisfi) {
            return showAlert({
              type: 'warning',
              title: t('exams.marks.invalidTitle'),
              message: `${r.studentName} (${s.name}): Nisfi waa inuu u dhexeeyo 0 iyo ${maxNisfi}.`
            });
          }
        }
        if (sm.nihaayi !== '' && sm.nihaayi !== undefined) {
          if (fVal < 0 || fVal > maxNihaayi) {
            return showAlert({
              type: 'warning',
              title: t('exams.marks.invalidTitle'),
              message: `${r.studentName} (${s.name}): Nihaayi waa inuu u dhexeeyo 0 iyo ${maxNihaayi}.`
            });
          }
        }
      }
    }

    const payloadRows = rows.filter(hasInput).map(r => ({
      studentId: r.studentId,
      remarks: r.remarks,
      marks: subjects
        .filter(s => {
          const sm = r.marks[s.name] || {};
          return (
            r.absent ||
            sm.entered ||
            (sm.nisfi !== '' && sm.nisfi !== undefined && sm.nisfi !== null) ||
            (sm.nihaayi !== '' && sm.nihaayi !== undefined && sm.nihaayi !== null)
          );
        })
        .map(s => {
          const sm = r.marks[s.name] || {};
          const hasNisfi = sm.nisfi !== '' && sm.nisfi !== undefined && sm.nisfi !== null;
          const hasNihaayi = sm.nihaayi !== '' && sm.nihaayi !== undefined && sm.nihaayi !== null;
          const nisfi = r.absent ? 0 : (hasNisfi ? Number(sm.nisfi) : null);
          const nihaayi = r.absent ? 0 : (hasNihaayi ? Number(sm.nihaayi) : null);
          let marksObtained = null;
          if (r.absent) {
            marksObtained = 0;
          } else {
            if (isMidTerm && !showAllParts) {
              marksObtained = hasNisfi ? Number(sm.nisfi) : null;
            } else if (isFinal && !showAllParts) {
              marksObtained = hasNihaayi ? Number(sm.nihaayi) : null;
            } else {
              marksObtained = (hasNisfi || hasNihaayi)
                ? ((Number(sm.nisfi) || 0) + (Number(sm.nihaayi) || 0))
                : (sm.marksObtained !== null && sm.marksObtained !== undefined ? Number(sm.marksObtained) : null);
            }
          }
          return {
            subject: s.name,
            nisfi,
            nihaayi,
            marksObtained,
            isAbsent: r.absent
          };
        })
    }));

    if (!payloadRows.length) {
      return showAlert({
        type: 'warning',
        title: t('exams.marks.nothingTitle'),
        message: t('exams.marks.nothing')
      });
    }

    try {
      setSaving(true);
      const { data } = await api.post(`/exams/${selectedExamId}/results`, { results: payloadRows });
      showAlert({
        type: 'success',
        title: t('exams.marks.savedTitle'),
        message: data.message || t('exams.marks.saved')
      });

      // Refresh
      const { data: fresh } = await api.get(`/exams/${selectedExamId}/results`);
      const freshRows = (fresh.results || []).map(r => {
        const marksObj = {};
        (r.subjects || []).forEach(s => {
          const isSubEntered = Boolean(s.entered);
          marksObj[s.subject] = {
            nisfi: isSubEntered ? (s.nisfi !== undefined && s.nisfi !== null && s.nisfi !== '' ? String(s.nisfi) : '') : '',
            nihaayi: isSubEntered ? (s.nihaayi !== undefined && s.nihaayi !== null && s.nihaayi !== '' ? String(s.nihaayi) : '') : '',
            marksObtained: isSubEntered ? (s.marksObtained !== undefined && s.marksObtained !== null ? Number(s.marksObtained) : null) : null,
            entered: isSubEntered
          };
        });
        return {
          studentId: r.studentId,
          studentName: r.studentName,
          rollNumber: r.rollNumber,
          remarks: r.remarks || '',
          entered: r.entered,
          absent: r.subjects.length > 0 && r.subjects.every(s => s.isAbsent) && r.entered,
          marks: marksObj
        };
      });
      setRows(freshRows);
      initialMarksRef.current.clear();
      freshRows.forEach(r => {
        initialMarksRef.current.set(r.studentId, JSON.parse(JSON.stringify(r)));
      });
      setEditingStudentIds(new Set());
      freshRows.forEach(r => {
        initialMarksRef.current.set(r.studentId, JSON.parse(JSON.stringify(r)));
      });
      setEditingStudentIds(new Set());
    } catch (error) {
      console.error(error);
      showAlert({
        type: 'danger',
        title: t('common.error'),
        message: error.response?.data?.message || t('exams.marks.saveFailed')
      });
    } finally {
      setSaving(false);
    }
  };

  // Export Teacher's Subject Score Sheet PDF (Matching Image 1 with crisp grid lines / xariiqmo)
  const handleExportTeacherPDF = () => {
    if (!exam || !currentSubjectObj) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    const instituteName = settings?.businessInfo?.name || 'MACHADKA SALAAX ALDAAREYN';
    const subName = currentSubjectObj.name;
    const nisfiMax = currentSubjectObj.nisfiFullMarks || 40;
    const nihaayiMax = currentSubjectObj.nihaayiFullMarks || 60;
    const totalMax = (showNisfi && showNihaayi) || printBlank
      ? ((currentSubjectObj.fullMarks && currentSubjectObj.fullMarks > nisfiMax) ? currentSubjectObj.fullMarks : nisfiMax + nihaayiMax)
      : (currentSubjectObj.fullMarks || (showNisfi ? nisfiMax : nihaayiMax));

    // Layout margins
    const marginX = 12;
    const tableW = pageW - (marginX * 2); // 210 - 24 = 186mm
    const x0 = marginX;

    // Define columns to match Modal preview (Image 1)
    // If printBlank (Waraaq Madhan) or both parts active: 5 columns (ID, NAME, NISFI, NIHAAYI, TOTAL)
    // If single part filled sheet: 4 columns (ID, NAME, MARK, REMARKS)
    const showBothCols = printBlank || (showNisfi && showNihaayi) || (currentSubjectObj.nisfiFullMarks > 0 && currentSubjectObj.nihaayiFullMarks > 0);

    let columns = [];
    if (showBothCols) {
      const idW = 18;
      const nisfiW = 28;
      const nihaayiW = 28;
      const totW = 32;
      const nameW = tableW - (idW + nisfiW + nihaayiW + totW); // 80mm
      columns = [
        { key: 'id', title: 'ID', x: x0, w: idW, align: 'center' },
        { key: 'name', title: 'NAME', x: x0 + idW, w: nameW, align: 'left' },
        { key: 'nisfi', title: `NISFI (${nisfiMax})`, x: x0 + idW + nameW, w: nisfiW, align: 'center' },
        { key: 'nihaayi', title: `NIHAAYI (${nihaayiMax})`, x: x0 + idW + nameW + nisfiW, w: nihaayiW, align: 'center' },
        { key: 'total', title: `TOTAL (${totalMax})`, x: x0 + idW + nameW + nisfiW + nihaayiW, w: totW, align: 'center' },
      ];
    } else if (showNisfi) {
      const idW = 18;
      const markW = 36;
      const remW = 44;
      const nameW = tableW - (idW + markW + remW); // 88mm
      columns = [
        { key: 'id', title: 'ID', x: x0, w: idW, align: 'center' },
        { key: 'name', title: 'NAME', x: x0 + idW, w: nameW, align: 'left' },
        { key: 'nisfi', title: `NISFI (${nisfiMax})`, x: x0 + idW + nameW, w: markW, align: 'center' },
        { key: 'remarks', title: 'REMARKS', x: x0 + idW + nameW + markW, w: remW, align: 'center' },
      ];
    } else {
      const idW = 18;
      const markW = 36;
      const remW = 44;
      const nameW = tableW - (idW + markW + remW); // 88mm
      columns = [
        { key: 'id', title: 'ID', x: x0, w: idW, align: 'center' },
        { key: 'name', title: 'NAME', x: x0 + idW, w: nameW, align: 'left' },
        { key: 'nihaayi', title: `NIHAAYI (${nihaayiMax})`, x: x0 + idW + nameW, w: markW, align: 'center' },
        { key: 'remarks', title: 'REMARKS', x: x0 + idW + nameW + markW, w: remW, align: 'center' },
      ];
    }

    // Header drawing function
    const drawPageHeader = (isFirstPage) => {
      let curY = 12;
      if (isFirstPage) {
        // Main Institute Header (Clean, professional, high-contrast, exactly like Image 1)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(instituteName.toUpperCase(), pageW / 2, curY, { align: 'center' });
        curY += 6.5;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text(
          `FASALKA: ${classLabel(exam.classId, '')}   |   NUUCA IMTIXAANKA: ${exam.title.toUpperCase()} (${tv(exam.examType)})   |   MAADDADA: ${subName.toUpperCase()}`,
          pageW / 2,
          curY,
          { align: 'center' }
        );
        curY += 5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139); // slate-500
        const subTitleText = printBlank
          ? `Waraaqda dhibco-gelinta ardayda ee macallinka maaddada (Waraaq Madhan - ${exam.academicYear || new Date().getFullYear()})`
          : `Waraaqda dhibco-gelinta ardayda ee macallinka maaddada (${exam.academicYear || new Date().getFullYear()})`;
        doc.text(subTitleText, pageW / 2, curY, { align: 'center' });
        curY += 4;

        // Dividing horizontal line under title
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.6);
        doc.line(x0, curY, x0 + tableW, curY);
        curY += 5;
      } else {
        // Continuation Header on Subsequent Pages
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(
          `${instituteName.toUpperCase()} - ${subName.toUpperCase()} - ${classLabel(exam.classId, '')} (Bogga xiga)`,
          pageW / 2,
          curY,
          { align: 'center' }
        );
        curY += 5;
      }

      // Draw Table Header with dark, crisp borders and clean background
      const headerH = 8.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      // Draw each header cell with solid border and fill
      columns.forEach(col => {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(15, 23, 42); // slate-900 border
        doc.setLineWidth(0.35); // solid crisp line
        doc.rect(col.x, curY, col.w, headerH, 'FD'); // Fill + stroke border

        const textX = col.align === 'center' ? col.x + col.w / 2 : col.x + 3;
        doc.text(col.title, textX, curY + 5.5, { align: col.align });
      });

      return curY + headerH;
    };

    let y = drawPageHeader(true);

    // Row height: 8.5mm gives generous physical box height for handwriting
    const rowH = printBlank ? 8.5 : 7.2;

    rows.forEach((r, idx) => {
      // Check if row exceeds printable page boundary
      if (y + rowH > 268) {
        doc.addPage();
        y = drawPageHeader(false);
      }

      // Row background
      if (printBlank) {
        doc.setFillColor(255, 255, 255);
      } else if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(255, 255, 255);
      }

      // Draw cell boxes with dark visible lines (Xariiqmaha)
      doc.setDrawColor(30, 41, 59); // slate-800 / solid dark border
      doc.setLineWidth(0.35); // 0.35mm line - guaranteed sharp and visible!

      columns.forEach(col => {
        // 'FD' draws filled rectangle with stroked border on all 4 sides!
        doc.rect(col.x, y, col.w, rowH, 'FD');
      });

      // Render cell text
      const sm = r.marks[subName] || {};
      const idVal = r.rollNumber || String(idx + 1);
      const nameVal = (r.studentName || '').slice(0, 36);

      // ID
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(idVal), columns[0].x + columns[0].w / 2, y + (rowH / 2) + 1.2, { align: 'center' });

      // Name
      doc.setFont('helvetica', 'bold');
      doc.text(nameVal, columns[1].x + 3, y + (rowH / 2) + 1.2);
      doc.setFont('helvetica', 'normal');

      if (showBothCols) {
        if (!printBlank) {
          const nisfiVal = r.absent ? 'MQ' : (sm.nisfi ?? '');
          const nihaayiVal = r.absent ? 'MQ' : (sm.nihaayi ?? '');
          const totalVal = r.absent ? '0' : (sm.marksObtained ?? '');

          doc.text(String(nisfiVal), columns[2].x + columns[2].w / 2, y + (rowH / 2) + 1.2, { align: 'center' });
          doc.text(String(nihaayiVal), columns[3].x + columns[3].w / 2, y + (rowH / 2) + 1.2, { align: 'center' });
          doc.setFont('helvetica', 'bold');
          doc.text(String(totalVal), columns[4].x + columns[4].w / 2, y + (rowH / 2) + 1.2, { align: 'center' });
          doc.setFont('helvetica', 'normal');
        }
      } else if (showNisfi) {
        if (!printBlank) {
          const nisfiVal = r.absent ? 'MQ' : (sm.nisfi ?? '');
          doc.setFont('helvetica', 'bold');
          doc.text(String(nisfiVal), columns[2].x + columns[2].w / 2, y + (rowH / 2) + 1.2, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.text(r.remarks || '', columns[3].x + 3, y + (rowH / 2) + 1.2);
        }
      } else {
        if (!printBlank) {
          const nihaayiVal = r.absent ? 'MQ' : (sm.nihaayi ?? '');
          doc.setFont('helvetica', 'bold');
          doc.text(String(nihaayiVal), columns[2].x + columns[2].w / 2, y + (rowH / 2) + 1.2, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.text(r.remarks || '', columns[3].x + 3, y + (rowH / 2) + 1.2);
        }
      }

      y += rowH;
    });

    // Signatures footer block
    y += 10;
    if (y + 18 > 280) {
      doc.addPage();
      y = 25;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.35);

    // Left signature: Teacher
    doc.line(x0 + 5, y + 8, x0 + 65, y + 8);
    doc.text('MACALLINKA MAADDADA (MAGACA & SAXIIXA)', x0 + 5, y + 13);

    // Right signature: Principal / Stamp
    doc.line(x0 + tableW - 65, y + 8, x0 + tableW - 5, y + 8);
    doc.text('MAAMULAHA / SHAABADDA & TAARIIXDA', x0 + tableW - 65, y + 13);

    const filePrefix = printBlank ? 'Waraaq_Madhan' : 'Waraaqda_Dhibcaha';
    doc.save(`${filePrefix}_${subName}_${exam.title.replace(/\s+/g, '_')}.pdf`);
  };

  const instituteName = settings?.businessInfo?.name || 'MACHADKA SALAAX ALDAAREYN';

  return (
    <div className={`p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-24 ${printModalOpen ? 'print:hidden' : ''}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20 shrink-0">
            <PenSquare size={22} className="sm:hidden" />
            <PenSquare size={28} className="hidden sm:block" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('exams.marks.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-0.5">
              {t('exams.marks.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {exam && (
            <>
              <button
                type="button"
                onClick={() => { setPrintBlank(false); setPrintModalOpen(true); }}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
              >
                <Printer size={16} /> {t('printTeacherSheet')}
              </button>
              <button
                type="button"
                onClick={handleExportTeacherPDF}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
              >
                <FileDown size={16} /> PDF
              </button>
            </>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !exam || !rows.length}
            className="flex items-center gap-2 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-brand-600/30 active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t('exams.marks.save')}
          </button>
        </div>
      </div>

      {/* Selectors Bar: Branch + Class + Exam (Compact in height & width) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 print:hidden">
        {/* Branch Selector */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 min-w-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 shrink-0 whitespace-nowrap">
            <Building2 size={14} className="text-brand-600" /> {t('common.branch') || 'Laanta'}:
          </span>
          <select
            value={selectedBranchId}
            onChange={e => handleBranchChange(e.target.value)}
            disabled={isTeacher && visibleBranches.length <= 1}
            className="w-full min-w-0 bg-transparent outline-none text-slate-900 dark:text-white font-bold text-xs truncate cursor-pointer disabled:cursor-default"
          >
            {(!isTeacher || visibleBranches.length > 1) && (
              <option value="">{t('common.allBranches') || 'Dhammaan Laamaha'}</option>
            )}
            {visibleBranches.map(b => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Class Selector (Filtered by selected branch and teacher assignment) */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 min-w-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 shrink-0 whitespace-nowrap">
            <BookOpen size={14} className="text-brand-600" /> {t('exams.selectClass') || t('common.selectClass') || 'Fasalka'}:
          </span>
          <select
            value={selectedClassId}
            onChange={e => handleClassChange(e.target.value)}
            className="w-full min-w-0 bg-transparent outline-none text-slate-900 dark:text-white font-bold text-xs truncate cursor-pointer"
          >
            {!isTeacher && (
              <option value="">{t('common.allClasses') || 'Dhammaan Fasallada'}</option>
            )}
            {filteredClasses.map(c => (
              <option key={c._id} value={c._id}>
                {classLabel(c, '')}
              </option>
            ))}
          </select>
        </div>

        {/* Exam Selector */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 min-w-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 shrink-0 whitespace-nowrap">
            <ClipboardList size={14} className="text-amber-500" /> {t('exams.selectExam') || 'Imtixaanka'}:
          </span>
          <select
            value={selectedExamId}
            onChange={e => setSelectedExamId(e.target.value)}
            className="w-full min-w-0 bg-transparent outline-none text-slate-900 dark:text-white font-bold text-xs truncate cursor-pointer"
          >
            <option value="">{t('exams.selectExamOption') || '-- Dooro Imtixaan --'}</option>
            {filteredExams.map(e => (
              <option key={e._id} value={e._id}>
                {e.title} · {classLabel(e.classId, '')} · {tv(e.examType)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Teacher Mode Notice Banner */}
      {isTeacher && currentUser && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/60 text-xs text-brand-900 dark:text-brand-200 shadow-xs print:hidden">
          <span className="font-bold flex items-center gap-2">
            <Users size={15} className="text-brand-600" />
            <span>{t('teacherMode', 'Xisaabta Macallinka')}:</span>
            <span className="font-black underline">{currentUser.fullName}</span>
          </span>
          <span className="text-[11px] font-bold bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 shadow-2xs">
            {visibleSubjects.length} {visibleSubjects.length === 1 ? 'Maaddo ayaa laguu qoray' : 'Maaddood ayaa laguu qoray'}
          </span>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 font-bold flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-brand-600" />
          <span>{t('attendance.student.loadingStudents')}</span>
        </div>
      ) : !exam ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
          {t('exams.marks.selectHint')}
        </div>
      ) : isTeacher && visibleSubjects.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold text-sm">
          Laguma diiwaangelin maaddooyinka fasalkan. Fadlan dooro fasal kale oo laguu qoray ama la xiriir maamulka.
        </div>
      ) : rows.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
          {t('exams.marks.noStudents')}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subject Switcher Tabs (Matching Image 1: Teacher focuses on one subject's Nisfi + Nihaayi) */}
          <div className="flex items-center justify-between flex-wrap gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1 shrink-0">
                <BookOpen size={13} /> {t('exams.marks.subjectFilter', 'Maaddada')}:
              </span>
              {visibleSubjects.map(s => {
                const isActive = activeSubject === s.name;
                const markLabel = isMidTerm
                  ? (s.nisfiFullMarks || exam?.maxMarks || s.fullMarks || 40)
                  : isFinal
                    ? (s.nihaayiFullMarks || exam?.maxMarks || s.fullMarks || 60)
                    : (s.fullMarks || 100);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setActiveSubject(s.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 scale-[1.02]'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="opacity-70 text-[10px] font-semibold">
                      ({markLabel})
                    </span>
                  </button>
                );
              })}
              {!isTeacher && (
                <button
                  type="button"
                  onClick={() => setActiveSubject(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeSubject === null
                      ? 'bg-slate-900 text-white shadow-sm scale-[1.02]'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Layers size={13} /> {t('exams.marks.allSubjectsView', 'Shaxda Guud')}
                </button>
              )}
            </div>

            <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
              <Users size={14} /> {t('exams.marks.summary', { count: rows.length, total: totalFullMarks })}
            </div>
          </div>

          {/* VIEW 1: SINGLE SUBJECT SCORE-SHEET (Exact match to Image 1: Id | Name | Nisfi | Nihaayi | Total) */}
          {activeSubject !== null && currentSubjectObj && (
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Card Header showing Institute, Class, and Subject */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-[11px] font-black uppercase tracking-wider mb-1">
                    <Sparkles size={13} /> {instituteName}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{classLabel(exam.classId, '')}</span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-brand-600">{currentSubjectObj.name}</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    {exam.title} ({tv(exam.examType)}) · Nisfi: {currentSubjectObj.nisfiFullMarks || 40} dhibcood · Nihaayi: {currentSubjectObj.nihaayiFullMarks || 60} dhibcood · Wadarta: {currentSubjectObj.fullMarks || 100}
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {/* Search Input for View 1 */}
                  <div className="relative min-w-[200px] sm:min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder={t('exams.marks.searchPlaceholder', 'Raadi magaca ama ID-ga...')}
                      className="w-full pl-8 pr-7 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 shadow-xs"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Save Guud (Save All) Button */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !exam || !rows.length}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    title="Kaydi dhammaan dhibcaha ardayda"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>{t('exams.marks.saveAll', 'Kaydi Dhammaan')}</span>
                  </button>

                  {(isMidTerm || isFinal) && (
                    <button
                      type="button"
                      onClick={() => setShowAllParts(prev => !prev)}
                      className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-2xs whitespace-nowrap"
                    >
                      {showAllParts ? 'Kaliya Imtixaankan' : 'Muuji Labadaba'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setPrintBlank(true); setPrintModalOpen(true); }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                  >
                    {t('printBlankSheet') === 'printBlankSheet' ? 'Waraaq Madhan' : t('printBlankSheet')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPrintBlank(false); setPrintModalOpen(true); }}
                    className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-600/20 whitespace-nowrap"
                  >
                    {t('printTeacherSheet') === 'printTeacherSheet' ? 'Waraaqda Macallinka' : t('printTeacherSheet')}
                  </button>
                </div>
              </div>

              {/* Table: Id | Name | Nisfi | Nihaayi | Total | Absent | Remarks | Actions */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest border-b border-slate-800">
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-4 py-4 w-28">Id</th>
                      <th className="px-5 py-4">Name</th>
                      {showNisfi && (
                        <th className="px-4 py-4 text-center w-36">
                          {t('nisfiShort') === 'nisfiShort' ? 'Nisfi' : t('nisfiShort')}
                          <span className="block text-[9px] text-brand-300 font-normal">
                            Max: {isMidTerm ? (exam?.maxMarks || currentSubjectObj.nisfiFullMarks || 40) : (currentSubjectObj.nisfiFullMarks || 40)}
                          </span>
                        </th>
                      )}
                      {showNihaayi && (
                        <th className="px-4 py-4 text-center w-36">
                          {t('nihaayiShort') === 'nihaayiShort' ? 'Nihaayi' : t('nihaayiShort')}
                          <span className="block text-[9px] text-brand-300 font-normal">
                            Max: {isFinal ? (exam?.maxMarks || currentSubjectObj.nihaayiFullMarks || 60) : (currentSubjectObj.nihaayiFullMarks || 60)}
                          </span>
                        </th>
                      )}
                      <th className="px-4 py-4 text-center w-32 bg-slate-800/80">
                        {showAllParts || isCombined
                          ? t('common.total')
                          : isMidTerm
                            ? 'Dhibcaha (Nisfi)'
                            : isFinal
                              ? 'Dhibcaha (Nihaayi)'
                              : t('common.total')}
                        <span className="block text-[9px] text-emerald-400 font-normal">
                          Max: {currentSubMax}
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center w-24">{tv('Absent')}</th>
                      <th className="px-4 py-4 w-44">{t('academic.exit.remarks')}</th>
                      <th className="px-4 py-4 text-center w-36 bg-slate-800/90">{t('common.actions', 'Hawlaha')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.map((r, i) => {
                      const sm = r.marks[currentSubjectObj.name] || { nisfi: '', nihaayi: '', marksObtained: null, entered: false };
                      const isSubEntered = Boolean(sm.entered);
                      const isEditing = !isSubEntered || editingStudentIds.has(r.studentId);
                      const maxNisfi = isMidTerm ? (Number(exam?.maxMarks) || currentSubjectObj.nisfiFullMarks || 40) : (currentSubjectObj.nisfiFullMarks || 40);
                      const maxNihaayi = isFinal ? (Number(exam?.maxMarks) || currentSubjectObj.nihaayiFullMarks || 60) : (currentSubjectObj.nihaayiFullMarks || 60);
                      const hasMark = sm.marksObtained !== null && sm.marksObtained !== undefined && sm.marksObtained !== '';
                      const totalSub = r.absent ? 0 : (hasMark ? Number(sm.marksObtained) : null);

                      return (
                        <tr
                          key={r.studentId}
                          className={`transition-colors ${
                            r.absent
                              ? 'bg-rose-50/40 dark:bg-rose-950/20 opacity-75'
                              : isEditing && isSubEntered
                                ? 'bg-brand-50/30 dark:bg-brand-950/20'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/20'
                          }`}
                        >
                          <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{i + 1}</td>
                          <td className="px-4 py-3 text-sm font-mono font-black text-slate-700 dark:text-slate-300">
                            {r.rollNumber || `ID-${i + 1}`}
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-black text-slate-900 dark:text-white capitalize">
                              {r.studentName}
                            </p>
                          </td>
                          {showNisfi && (
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max={maxNisfi}
                                disabled={r.absent || !isEditing}
                                value={sm.nisfi ?? ''}
                                onChange={e => setScore(r.studentId, currentSubjectObj.name, 'nisfi', e.target.value)}
                                placeholder={`0 - ${maxNisfi}`}
                                className={`w-20 sm:w-24 px-2 sm:px-3 py-1.5 text-center rounded-xl outline-none text-sm font-black transition ${
                                  !isEditing
                                    ? 'bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-900 border-2 border-brand-500 shadow-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500'
                                } disabled:opacity-50`}
                              />
                            </td>
                          )}
                          {showNihaayi && (
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max={maxNihaayi}
                                disabled={r.absent || !isEditing}
                                value={sm.nihaayi ?? ''}
                                onChange={e => setScore(r.studentId, currentSubjectObj.name, 'nihaayi', e.target.value)}
                                placeholder={`0 - ${maxNihaayi}`}
                                className={`w-20 sm:w-24 px-2 sm:px-3 py-1.5 text-center rounded-xl outline-none text-sm font-black transition ${
                                  !isEditing
                                    ? 'bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-900 border-2 border-brand-500 shadow-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500'
                                } disabled:opacity-50`}
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-center bg-slate-50/60 dark:bg-slate-800/40">
                            <span
                              className={`inline-block px-3 py-1.5 rounded-xl text-sm font-black ${
                                r.absent
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : totalSub === null
                                    ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                    : totalSub >= currentSubPass
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {r.absent ? 'MQ' : (totalSub !== null ? totalSub : '—')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={r.absent}
                              disabled={!isEditing}
                              onChange={() => toggleAbsent(r.studentId)}
                              className="w-4 h-4 accent-rose-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={r.remarks}
                              disabled={!isEditing}
                              onChange={e => setRemark(r.studentId, e.target.value)}
                              placeholder="—"
                              className={`w-full px-3 py-1.5 rounded-xl outline-none text-xs transition ${
                                !isEditing
                                  ? 'bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 cursor-not-allowed'
                                  : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500'
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={() => setEditingStudentIds(prev => new Set(prev).add(r.studentId))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 active:scale-95"
                                title="Wax ka beddel dhibcaha ardaygan"
                              >
                                <Edit3 size={13} className="text-brand-600" />
                                <span>{t('exams.marks.edit', 'Wax ka beddel')}</span>
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={savingStudentId === r.studentId}
                                  onClick={() => handleSaveSingleStudent(r.studentId)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-xs active:scale-95 disabled:opacity-50"
                                  title="Kaydi ardaygan kaliya"
                                >
                                  {savingStudentId === r.studentId ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  <span>{t('exams.marks.saveSingle', 'Kaydi')}</span>
                                </button>
                                {isSubEntered && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelEdit(r.studentId)}
                                    className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                    title={t('exams.marks.cancelEdit', 'Ka noqo')}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={showNisfi && showNihaayi ? 9 : 8} className="p-10 text-center text-slate-400 font-bold text-xs">
                          <p>{t('exams.marks.noSearchResults', 'Lama helin arday ku habboon raadintaada.')}</p>
                          {searchTerm && (
                            <button
                              type="button"
                              onClick={() => setSearchTerm('')}
                              className="mt-2 text-brand-600 hover:underline text-xs font-bold"
                            >
                              {t('exams.marks.clearSearch', 'Tirtir Raadinta')}
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: ALL SUBJECTS MATRIX (When activeSubject is null) */}
          {activeSubject === null && (
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Card Header for View 2 */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{classLabel(exam.classId, '')}</span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-brand-600">{t('exams.marks.allSubjectsView', 'Shaxda Guud')}</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    {exam.title} ({tv(exam.examType)}) · {subjects.length} Maaddood · {rows.length} Arday
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {/* Search Input for View 2 */}
                  <div className="relative min-w-[200px] sm:min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder={t('exams.marks.searchPlaceholder', 'Raadi magaca ama ID-ga...')}
                      className="w-full pl-8 pr-7 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 shadow-xs"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Save Guud */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !exam || !rows.length}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>{t('exams.marks.saveAll', 'Kaydi Dhammaan')}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                      <th className="px-4 py-4 w-10 sticky left-0 bg-slate-900">#</th>
                      <th className="px-4 py-4 w-24">ID</th>
                      <th className="px-5 py-4">{t('common.student')}</th>
                      {subjects.map(s => (
                        <th key={s.name} className="px-3 py-4 text-center">
                          {s.name}
                          <span className="block text-[9px] text-slate-300 font-normal">
                            /{exam?.maxMarks || s.fullMarks || 100}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-4 text-center bg-slate-800">{t('common.total')}</th>
                      <th className="px-3 py-4 text-center">{tv('Absent')}</th>
                      <th className="px-4 py-4">{t('academic.exit.remarks')}</th>
                      <th className="px-4 py-4 text-center w-36 bg-slate-800/90">{t('common.actions', 'Hawlaha')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.map((r, i) => {
                      const isEditing = !r.entered || editingStudentIds.has(r.studentId);
                      return (
                        <tr
                          key={r.studentId}
                          className={`transition-colors ${
                            r.absent ? 'opacity-50' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10'
                          }`}
                        >
                          <td className="px-4 py-3 text-xs font-bold text-slate-400 sticky left-0 bg-white dark:bg-slate-900">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                            {r.rollNumber || `ID-${i + 1}`}
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {r.studentName}
                            </p>
                          </td>
                          {subjects.map(s => {
                            const sm = r.marks[s.name] || {};
                            const hasVal = sm.marksObtained !== null && sm.marksObtained !== undefined && sm.marksObtained !== '';
                            return (
                              <td key={s.name} className="px-2 py-3 text-center">
                                <span
                                  onClick={() => setActiveSubject(s.name)}
                                  className={`cursor-pointer inline-block px-3 py-1.5 rounded-lg font-black text-xs transition ${
                                    hasVal
                                      ? 'bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 text-slate-900 dark:text-white'
                                      : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 hover:bg-brand-50 hover:text-brand-600'
                                  }`}
                                  title={`Guji si aad u gasho dhibcaha: ${s.name}`}
                                >
                                  {r.absent ? 'MQ' : (hasVal ? sm.marksObtained : '—')}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center text-sm font-black text-brand-600 dark:text-brand-400 bg-slate-50 dark:bg-slate-800/40">
                            {studentTotalScore(r)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={r.absent}
                              disabled={!isEditing}
                              onChange={() => toggleAbsent(r.studentId)}
                              className="w-4 h-4 accent-rose-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={r.remarks}
                              disabled={!isEditing}
                              onChange={e => setRemark(r.studentId, e.target.value)}
                              placeholder="—"
                              className={`w-36 px-2.5 py-1.5 rounded-lg outline-none text-xs transition ${
                                !isEditing
                                  ? 'bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 cursor-not-allowed'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500'
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={() => setEditingStudentIds(prev => new Set(prev).add(r.studentId))}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700"
                                title="Wax ka beddel ardaygan"
                              >
                                <Edit3 size={12} className="text-brand-600" />
                                <span>{t('exams.marks.edit', 'Wax ka beddel')}</span>
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={savingStudentId === r.studentId}
                                  onClick={() => handleSaveSingleStudent(r.studentId)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-xs active:scale-95 disabled:opacity-50"
                                  title="Kaydi ardaygan"
                                >
                                  {savingStudentId === r.studentId ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  <span>{t('exams.marks.saveSingle', 'Kaydi')}</span>
                                </button>
                                {r.entered && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelEdit(r.studentId)}
                                    className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                    title={t('exams.marks.cancelEdit', 'Ka noqo')}
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={subjects.length + 5} className="p-10 text-center text-slate-400 font-bold text-xs">
                          <p>{t('exams.marks.noSearchResults', 'Lama helin arday ku habboon raadintaada.')}</p>
                          {searchTerm && (
                            <button
                              type="button"
                              onClick={() => setSearchTerm('')}
                              className="mt-2 text-brand-600 hover:underline text-xs font-bold"
                            >
                              {t('exams.marks.clearSearch', 'Tirtir Raadinta')}
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRINTABLE PREVIEW MODAL (Fixed, Scrollable, Sticky Top & Bottom Controls) */}
      {printModalOpen && currentSubjectObj && exam && (
        <div
          id="print-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintModalOpen(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start print:static print:inset-auto print:z-auto print:overflow-visible print:bg-white print:p-0 print:block print:w-full print:h-auto print:m-0"
        >
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-4 sm:my-8 flex flex-col border border-slate-200 overflow-hidden print:static print:overflow-visible print:block print:border-none print:shadow-none print:rounded-none print:my-0 print:p-0 print:w-full print:max-w-none">
            {/* Sticky Top Controls Bar: ALWAYS visible at the top */}
            <div className="sticky top-0 z-30 bg-slate-900 px-4 sm:px-6 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 shadow-md print:hidden border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400">
                  <BookOpen size={18} />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider block">
                    {printBlank ? 'Waraaq Madhan (Blank Sheet)' : 'Waraaqda Macallinka (Teacher Sheet)'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {exam.title} · {classLabel(exam.classId, '')} · {currentSubjectObj.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5">
                {/* Toggle Blank / Filled */}
                <button
                  type="button"
                  onClick={() => setPrintBlank(!printBlank)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    printBlank ? 'bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-750 text-slate-200'
                  }`}
                >
                  {printBlank ? 'Waa Madhan tahay' : 'Waa Buuxdaa'}
                </button>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-brand-600/30 active:scale-95"
                >
                  <Printer size={15} /> <span>Print</span>
                </button>

                {/* PDF Export Button */}
                <button
                  type="button"
                  onClick={handleExportTeacherPDF}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-95 border border-slate-700"
                >
                  <FileDown size={15} /> <span>PDF</span>
                </button>

                {/* Cancel / Close Button */}
                <button
                  type="button"
                  onClick={() => setPrintModalOpen(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-md shadow-rose-600/20"
                  title="Xir / Ka noqo (Cancel)"
                >
                  <X size={15} />
                  <span>Xir (Cancel)</span>
                </button>
              </div>
            </div>

            {/* Document Paper Body (Styling like physical A4 sheet) */}
            <div className="p-6 sm:p-12 text-slate-900 space-y-6 bg-white font-sans print:p-0 print:space-y-4 print:w-full">
              {/* Header: Magaca Machadka, Fasalka, Nuuca Imtixaanka, Maaddada */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1.5 print:pb-3">
                <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900">
                  {instituteName}
                </h1>
                <p className="text-sm font-bold tracking-wide uppercase text-slate-700">
                  FASALKA: <span className="underline">{classLabel(exam.classId, '')}</span> &nbsp;|&nbsp;
                  NUUCA IMTIXAANKA: <span className="underline">{exam.title} ({tv(exam.examType)})</span> &nbsp;|&nbsp;
                  MAADDADA: <span className="underline text-brand-700">{currentSubjectObj.name}</span>
                </p>
                <p className="text-[11px] text-slate-500 font-semibold italic">
                  Waraaqda dhibco-gelinta ardayda ee macallinka maaddada ({exam.academicYear || new Date().getFullYear()})
                </p>
              </div>

              {/* Table (Id | Name | Nisfi | Nihaayi | Total) */}
              <div className="overflow-x-auto print:overflow-visible print:w-full">
                <table className="w-full border-collapse border-2 border-slate-900 text-left text-sm print:text-xs print-table-bordered">
                  <thead className="print:table-header-group">
                    <tr className="bg-slate-100 border-b-2 border-slate-900 font-black text-slate-900 text-xs uppercase print:bg-slate-200">
                      <th className="border-2 border-slate-900 px-3 py-2 w-16 text-center print:py-1.5">Id</th>
                      <th className="border-2 border-slate-900 px-4 py-2 print:py-1.5">Name</th>
                      <th className="border-2 border-slate-900 px-3 py-2 w-28 text-center print:py-1.5">
                        Nisfi ({currentSubjectObj.nisfiFullMarks || 40})
                      </th>
                      <th className="border-2 border-slate-900 px-3 py-2 w-28 text-center print:py-1.5">
                        Nihaayi ({currentSubjectObj.nihaayiFullMarks || 60})
                      </th>
                      <th className="border-2 border-slate-900 px-3 py-2 w-28 text-center print:py-1.5">
                        Total ({((currentSubjectObj.fullMarks && currentSubjectObj.fullMarks > (currentSubjectObj.nisfiFullMarks || 40)) ? currentSubjectObj.fullMarks : ((currentSubjectObj.nisfiFullMarks || 40) + (currentSubjectObj.nihaayiFullMarks || 60)))})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const sm = r.marks[currentSubjectObj.name] || {};
                      return (
                        <tr key={r.studentId} className="border-b-2 border-slate-900 print:break-inside-avoid">
                          <td className="border-2 border-slate-900 px-3 py-2 text-center font-bold font-mono print:py-1.5">
                            {r.rollNumber || i + 1}
                          </td>
                          <td className="border-2 border-slate-900 px-4 py-2 font-bold capitalize print:py-1.5">
                            {r.studentName}
                          </td>
                          <td className="border-2 border-slate-900 px-3 py-2 text-center font-semibold print:py-1.5">
                            {printBlank ? '' : (r.absent ? 'MQ' : sm.nisfi ?? '')}
                          </td>
                          <td className="border-2 border-slate-900 px-3 py-2 text-center font-semibold print:py-1.5">
                            {printBlank ? '' : (r.absent ? 'MQ' : sm.nihaayi ?? '')}
                          </td>
                          <td className="border-2 border-slate-900 px-3 py-2 text-center font-black print:py-1.5">
                            {printBlank ? '' : (r.absent ? '0' : (sm.marksObtained ?? ''))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures Footer */}
              <div className="pt-8 flex justify-between items-center text-xs font-bold text-slate-800 print:pt-6 print:break-inside-avoid signatures-footer">
                <div className="space-y-1">
                  <p>Macallinka Maaddada: ___________________________</p>
                  <p className="text-[10px] text-slate-500 font-normal">Magaca iyo Saxiixa</p>
                </div>
                <div className="space-y-1 text-right">
                  <p>Saxiixa Maamulaha: ___________________________</p>
                  <p className="text-[10px] text-slate-500 font-normal">Shaabadda iyo Taariikhda</p>
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar: ALWAYS visible when scrolling down */}
            <div className="sticky bottom-0 z-30 bg-slate-100 dark:bg-slate-850 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 text-xs font-black transition active:scale-95"
              >
                <X size={15} />
                <span>Xir Daaqadda (Cancel)</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-brand-600/30 active:scale-95"
                >
                  <Printer size={15} /> <span>Print Waraaqda</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportTeacherPDF}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-95"
                >
                  <FileDown size={15} /> <span>Soo saar PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamMarks;
