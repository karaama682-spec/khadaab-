import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Award, ClipboardList, Printer, FileDown, Trophy, CheckCircle2,
  XCircle, TrendingUp, Users, X, BookOpen, Sparkles, Building2, Layers
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import { classLabel } from '../utils/classLabel';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const gradeColor = (grade) => {
  if (grade === 'A+' || grade === 'A') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (grade === 'B' || grade === 'C') return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
  if (grade === 'D') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (grade === 'F') return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
};

const ExamResults = () => {
  const { showAlert } = useAlert();
  const { t, tv, locale } = useLanguage();
  const resultLabel = (status) => t(`exams.results.status.${status}`, { defaultValue: status });
  const location = useLocation();

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [settings, setSettings] = useState(null);

  // View Mode: 'single' (individual exam results) or 'broadsheet' (combined 100-marks master sheet)
  const [viewMode, setViewMode] = useState('single');
  const [broadsheetData, setBroadsheetData] = useState(null);
  const [broadsheetLoading, setBroadsheetLoading] = useState(false);

  const [data, setData] = useState(null); // { exam, results, summary }
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState(null); // individual report-card modal

  // Load initial settings, classes, exams, and branches
  useEffect(() => {
    (async () => {
      try {
        const [resExams, resClasses, resSettings, resBranches] = await Promise.all([
          api.get('/exams'),
          api.get('/classes'),
          api.get('/settings').catch(() => ({ data: null })),
          api.get('/branches').catch(() => ({ data: [] }))
        ]);
        const examsData = resExams.data || [];
        const classesData = resClasses.data || [];
        let branchesData = resBranches?.data || [];

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
        if (resSettings?.data) setSettings(resSettings.data);

        const param = new URLSearchParams(location.search).get('exam');
        if (param) {
          const match = examsData.find(e => e._id === param);
          if (match) {
            const cId = match.classId?._id || match.classId;
            const classObj = classesData.find(c => c._id === cId);
            const bId = classObj?.branchId?._id || classObj?.branchId;
            if (bId) setSelectedBranchId(String(bId));
            setSelectedClassId(cId || '');
            setSelectedExamId(param);
            return;
          }
        }

        if (classesData.length) {
          const firstClass = classesData[0];
          const firstClassId = firstClass._id;
          const bId = firstClass.branchId?._id || firstClass.branchId;
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

  // Filter classes by selected branch
  const filteredClasses = useMemo(() => {
    if (!selectedBranchId) return classes;
    return classes.filter(c => {
      const bId = c.branchId?._id || c.branchId;
      return String(bId) === selectedBranchId;
    });
  }, [classes, selectedBranchId]);

  // Handle branch change -> only that branch's classes remain
  const handleBranchChange = (newBranchId) => {
    setSelectedBranchId(newBranchId);
    const matchingClasses = !newBranchId
      ? classes
      : classes.filter(c => String(c.branchId?._id || c.branchId) === newBranchId);

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

  // When class changes, adjust selected exam
  const handleClassChange = (newClassId) => {
    setSelectedClassId(newClassId);
    if (!newClassId) {
      if (exams.length) setSelectedExamId(exams[0]._id);
      setBroadsheetData(null);
      return;
    }
    const matching = exams.filter(e => (e.classId?._id || e.classId) === newClassId);
    if (matching.length) {
      setSelectedExamId(matching[0]._id);
    } else {
      setSelectedExamId('');
      setData(null);
    }
  };

  // Load results for selected exam (Single Exam mode)
  useEffect(() => {
    if (!selectedExamId || viewMode !== 'single') {
      if (viewMode !== 'single') setData(null);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const { data: resData } = await api.get(`/exams/${selectedExamId}/results`);
        setData(resData);
      } catch (error) {
        console.error(error);
        showAlert({ type: 'danger', title: t('common.error'), message: t('exams.results.loadFailed') });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, viewMode]);

  // Load broadsheet for selected class (Broadsheet mode)
  useEffect(() => {
    if (viewMode !== 'broadsheet' || !selectedClassId) {
      if (viewMode !== 'broadsheet') setBroadsheetData(null);
      return;
    }
    (async () => {
      try {
        setBroadsheetLoading(true);
        const { data: bData } = await api.get(`/exams/class/${selectedClassId}/broadsheet`);
        setBroadsheetData(bData);
      } catch (error) {
        console.error(error);
        showAlert({ type: 'danger', title: t('common.error'), message: 'Failed to load class broadsheet' });
      } finally {
        setBroadsheetLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, viewMode]);

  const exam = data?.exam;
  const subjects = exam?.subjects || [];
  const summary = data?.summary;

  const isMidTerm = exam?.examType === 'Mid-Term';
  const isFinal = exam?.examType === 'Final';
  const isCombined = exam?.examType === 'Combined';

  // Single exam rows: Graded students first by rank, pending last
  const rows = useMemo(() => {
    return (data?.results || []).slice().sort((a, b) => {
      if (a.entered !== b.entered) return a.entered ? -1 : 1;
      return (a.position || 999) - (b.position || 999);
    });
  }, [data]);

  // Broadsheet rows
  const broadsheetRows = useMemo(() => {
    return (broadsheetData?.results || []).slice().sort((a, b) => {
      if (a.entered !== b.entered) return a.entered ? -1 : 1;
      return (a.position || 999) - (b.position || 999);
    });
  }, [broadsheetData]);

  const instituteName = settings?.businessInfo?.name || 'MACHADKA SALAAX ALDAAREYN';

  // Export Single Exam PDF (Landscape format)
  const handleExportPDF = () => {
    if (!exam) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Top Brand Bar
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(instituteName.toUpperCase(), pageW / 2, 10, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `WARAAQDA NATIIJADA FASALKA: ${classLabel(exam.classId, '')}   |   IMTIXAANKA: ${exam.title.toUpperCase()} (${tv(exam.examType)})   |   ${exam.term || ''} ${exam.academicYear || ''}`,
      pageW / 2,
      19,
      { align: 'center' }
    );

    let y = 35;
    const x0 = 10;
    const rankW = 12;
    const idW = 18;
    const nameW = 50;
    const rightColsW = 58;
    const availableForSubjects = pageW - 20 - (rankW + idW + nameW + rightColsW);
    const subW = Math.max(16, subjects.length ? availableForSubjects / subjects.length : 20);

    // Header Row
    doc.setFillColor(30, 41, 59);
    doc.rect(x0, y - 5, pageW - 20, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('RK', x0 + 2, y);
    doc.text('ID', x0 + rankW + 2, y);
    doc.text('NAME', x0 + rankW + idW + 2, y);

    subjects.forEach((s, i) => {
      const max = isMidTerm ? (s.nisfiFullMarks || 40) : isFinal ? (s.nihaayiFullMarks || 60) : s.fullMarks;
      doc.text(
        `${s.name.slice(0, 8).toUpperCase()}(${max})`,
        x0 + rankW + idW + nameW + i * subW + subW / 2,
        y,
        { align: 'center' }
      );
    });

    const totX = x0 + rankW + idW + nameW + subjects.length * subW;
    doc.text('TOTAL', totX + 8, y, { align: 'center' });
    doc.text('AVG', totX + 22, y, { align: 'center' });
    doc.text('GRD', totX + 34, y, { align: 'center' });
    doc.text('STATUS', totX + 48, y, { align: 'center' });

    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    rows.forEach((r, idx) => {
      if (y > 185) {
        doc.addPage();
        y = 20;
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(x0, y - 4, pageW - 20, 6.5, 'F');
      }

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(x0, y + 2.5, pageW - 10, y + 2.5);

      doc.setTextColor(100, 116, 139);
      doc.text(r.entered ? String(r.position) : '-', x0 + 2, y);

      doc.setTextColor(51, 65, 85);
      doc.text(String(r.rollNumber || '-'), x0 + rankW + 2, y);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(r.studentName.slice(0, 24), x0 + rankW + idW + 2, y);
      doc.setFont('helvetica', 'normal');

      r.subjects.forEach((sub, i) => {
        const markText = sub.isAbsent ? 'MQ' : (r.entered ? String(sub.marksObtained) : '-');
        if (!sub.passed && r.entered && !sub.isAbsent) {
          doc.setTextColor(225, 29, 72);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(markText, x0 + rankW + idW + nameW + i * subW + subW / 2, y, { align: 'center' });
      });

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(r.entered ? String(r.totalObtained) : '-', totX + 8, y, { align: 'center' });

      const avgText = r.entered ? `${r.average ?? r.percentage}%` : '-';
      doc.text(avgText, totX + 22, y, { align: 'center' });

      doc.text(r.entered ? r.grade : '-', totX + 34, y, { align: 'center' });

      if (r.status === 'Pass') doc.setTextColor(22, 163, 74);
      else if (r.status === 'Fail') doc.setTextColor(225, 29, 72);
      else doc.setTextColor(100, 116, 139);

      doc.text(r.entered ? r.status.toUpperCase() : 'PENDING', totX + 48, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      y += 6.5;
    });

    y += 12;
    if (y > 185) {
      doc.addPage();
      y = 30;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);

    doc.line(x0 + 15, y + 7, x0 + 75, y + 7);
    doc.text('SAXIIXA MACALLINKA FASALKA', x0 + 18, y + 12);

    doc.line(pageW - 85, y + 7, pageW - 25, y + 7);
    doc.text('SAXIIXA MAAMULAHA & SHAABADDA', pageW - 82, y + 12);

    doc.save(`Waraaqda_Fasalka_${exam.title.replace(/\s+/g, '_')}.pdf`);
  };

  // Export Combined Master Broadsheet PDF (100 Marks: Nisfi 40 + Nihaayi 60 = 100)
  const handleExportBroadsheetPDF = () => {
    if (!broadsheetData || !broadsheetData.subjects?.length) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const bClass = broadsheetData.class;
    const bSubjects = broadsheetData.subjects;
    const bRows = broadsheetRows;

    // Top Brand Bar
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(instituteName.toUpperCase(), pageW / 2, 10, { align: 'center' });

    doc.setFontSize(8.5);
    const nisfiMax = broadsheetData.config?.nisfiMax || 40;
    const nihaayiMax = broadsheetData.config?.nihaayiMax || 60;
    const combinedMax = broadsheetData.config?.combinedMax || (nisfiMax + nihaayiMax);

    doc.setFont('helvetica', 'normal');
    doc.text(
      `WARAAQDA NATIIJADA GUUD EE FASALKA (${combinedMax} DHIBCUUD): ${classLabel(bClass, '')}   |   NISFI (${nisfiMax}) + NIHAAYI (${nihaayiMax}) = ${combinedMax}`,
      pageW / 2,
      19,
      { align: 'center' }
    );

    let y = 35;
    const x0 = 10;
    const rankW = 12;
    const idW = 18;
    const nameW = 50;
    const rightColsW = 58;
    const availableForSubjects = pageW - 20 - (rankW + idW + nameW + rightColsW);
    const subW = Math.max(16, bSubjects.length ? availableForSubjects / bSubjects.length : 20);

    // Header Row
    doc.setFillColor(30, 41, 59);
    doc.rect(x0, y - 5, pageW - 20, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('RK', x0 + 2, y);
    doc.text('ID', x0 + rankW + 2, y);
    doc.text('NAME', x0 + rankW + idW + 2, y);

    bSubjects.forEach((s, i) => {
      doc.text(
        `${s.name.slice(0, 8).toUpperCase()}(${s.fullMarks || combinedMax})`,
        x0 + rankW + idW + nameW + i * subW + subW / 2,
        y,
        { align: 'center' }
      );
    });

    const totX = x0 + rankW + idW + nameW + bSubjects.length * subW;
    doc.text('TOTAL', totX + 8, y, { align: 'center' });
    doc.text('AVG', totX + 22, y, { align: 'center' });
    doc.text('GRD', totX + 34, y, { align: 'center' });
    doc.text('STATUS', totX + 48, y, { align: 'center' });

    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    bRows.forEach((r, idx) => {
      if (y > 185) {
        doc.addPage();
        y = 20;
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(x0, y - 4, pageW - 20, 6.5, 'F');
      }

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(x0, y + 2.5, pageW - 10, y + 2.5);

      doc.setTextColor(100, 116, 139);
      doc.text(r.entered ? String(r.position) : '-', x0 + 2, y);

      doc.setTextColor(51, 65, 85);
      doc.text(String(r.rollNumber || '-'), x0 + rankW + 2, y);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(r.studentName.slice(0, 24), x0 + rankW + idW + 2, y);
      doc.setFont('helvetica', 'normal');

      r.subjects.forEach((sub, i) => {
        const markText = sub.isAbsent ? 'MQ' : (r.entered ? String(sub.marksObtained) : '-');
        if (!sub.passed && r.entered && !sub.isAbsent) {
          doc.setTextColor(225, 29, 72);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(markText, x0 + rankW + idW + nameW + i * subW + subW / 2, y, { align: 'center' });
      });

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(r.entered ? String(r.totalObtained) : '-', totX + 8, y, { align: 'center' });

      const avgText = r.entered ? `${r.average ?? r.percentage}%` : '-';
      doc.text(avgText, totX + 22, y, { align: 'center' });

      doc.text(r.entered ? r.grade : '-', totX + 34, y, { align: 'center' });

      if (r.status === 'Pass') doc.setTextColor(22, 163, 74);
      else if (r.status === 'Fail') doc.setTextColor(225, 29, 72);
      else doc.setTextColor(100, 116, 139);

      doc.text(r.entered ? r.status.toUpperCase() : 'PENDING', totX + 48, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      y += 6.5;
    });

    y += 12;
    if (y > 185) {
      doc.addPage();
      y = 30;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);

    doc.line(x0 + 15, y + 7, x0 + 75, y + 7);
    doc.text('SAXIIXA MACALLINKA FASALKA', x0 + 18, y + 12);

    doc.line(pageW - 85, y + 7, pageW - 25, y + 7);
    doc.text('SAXIIXA MAAMULAHA & SHAABADDA', pageW - 82, y + 12);

    doc.save(`Waraaqda_Guud_ee_Fasalka_${classLabel(bClass, '').replace(/\s+/g, '_')}_100.pdf`);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Award size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {viewMode === 'broadsheet' ? `Waraaqda Natiijada Guud (${broadsheetData?.config?.combinedMax || 100} Dhibcood)` : t('exams.results.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
              {viewMode === 'broadsheet' ? `Isku-darka Nisfi (${broadsheetData?.config?.nisfiMax || 40}) + Nihaayi (${broadsheetData?.config?.nihaayiMax || 60}) = ${broadsheetData?.config?.combinedMax || 100}` : t('masterSheet')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'broadsheet' && broadsheetData && (
            <>
              <button
                onClick={handleExportBroadsheetPDF}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                <FileDown size={16} /> Soo Dejiso Waraaqda Guud (PDF)
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-600/30 active:scale-95"
              >
                <Printer size={16} /> Daabac Waraaqda Guud
              </button>
            </>
          )}

          {viewMode === 'single' && exam && (
            <>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                <FileDown size={16} /> {t('exams.results.exportPdf')}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-brand-600/30 active:scale-95"
              >
                <Printer size={16} /> {t('printMasterSheet')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Mode Toggle: Single Exam vs Cumulative Broadsheet */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          onClick={() => setViewMode('single')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-sm ${
            viewMode === 'single'
              ? 'bg-brand-600 text-white shadow-brand-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <ClipboardList size={16} />
          <span>Natiijada Imtixaankan {exam ? `(${tv(exam.examType)})` : ''}</span>
        </button>

        <button
          onClick={() => setViewMode('broadsheet')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-sm ${
            viewMode === 'broadsheet'
              ? 'bg-amber-600 text-white shadow-amber-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Award size={16} />
          <span>Waraaqda Guud ee Fasalka ({broadsheetData?.config?.combinedMax || 100} Dhibcood: Nisfi {broadsheetData?.config?.nisfiMax || 40} + Nihaayi {broadsheetData?.config?.nihaayiMax || 60})</span>
        </button>
      </div>

      {/* Class and Exam Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        {/* Branch Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
            <Building2 size={16} className="text-brand-600" /> {t('common.branch') || 'Laanta'}:
          </span>
          <select
            value={selectedBranchId}
            onChange={e => handleBranchChange(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{t('common.allBranches') || 'Dhammaan Laamaha'}</option>
            {branches.map(b => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Class Filter (Filtered by selected branch) */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
            <BookOpen size={16} className="text-brand-600" /> {t('selectClass') || 'Dooro Fasalka'}:
          </span>
          <select
            value={selectedClassId}
            onChange={e => handleClassChange(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{t('allClasses') || 'Dhammaan Fasallada'}</option>
            {filteredClasses.map(c => (
              <option key={c._id} value={c._id}>
                {classLabel(c, '')}
              </option>
            ))}
          </select>
        </div>

        {/* Exam Filter (Only relevant in Single mode) */}
        {viewMode === 'single' ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
              <ClipboardList size={16} className="text-amber-500" /> {t('exams.selectExam') || 'Dooro Imtixaanka'}:
            </span>
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-brand-500"
            >
              <option value="">{t('exams.selectExamOption') || '-- Dooro Imtixaan --'}</option>
              {filteredExams.map(e => (
                <option key={e._id} value={e._id}>
                  {e.title} · {classLabel(e.classId, '')} · {tv(e.examType)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
            <Award size={16} className="text-amber-600 shrink-0" />
            <span>Natiijada Guud ee Fasalka (Nisfi 40 + Nihaayi 60 = 100)</span>
          </div>
        )}
      </div>

      {/* ===================== VIEW MODE 1: SINGLE EXAM VIEW ===================== */}
      {viewMode === 'single' && (
        <>
          {loading ? (
            <div className="p-16 text-center text-slate-500 font-bold">{t('exams.results.loading')}</div>
          ) : !exam ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              {t('exams.results.selectHint')}
            </div>
          ) : (
            <>
              {/* Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      {t('exams.results.passed')}
                    </span>
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{summary?.passed ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    {t('exams.results.passRate', { rate: summary?.passRate ?? 0 })}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                      {t('exams.results.failed')}
                    </span>
                    <XCircle size={18} className="text-rose-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{summary?.failed ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    {t('exams.results.notGraded', { count: summary?.pending ?? 0 })}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                      {t('exams.results.classAverage')}
                    </span>
                    <TrendingUp size={18} className="text-brand-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{summary?.avgPercentage ?? 0}%</p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    {t('exams.results.graded', { graded: summary?.graded ?? 0, total: summary?.totalStudents ?? 0 })}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                      {t('exams.results.topStudent')}
                    </span>
                    <Trophy size={18} className="text-amber-500" />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white truncate">
                    {summary?.topper?.studentName || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    {summary?.topper ? `${summary.topper.percentage}%` : t('exams.results.noMarks')}
                  </p>
                </div>
              </div>

              {/* Master Broadsheet Card */}
              <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6 print:p-0 print:border-0 print:shadow-none print:overflow-visible">
                <div className="pb-5 border-b-2 border-slate-900 dark:border-slate-700 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                      <Sparkles size={14} /> {instituteName}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    {exam.title}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    FASALKA: <span className="text-slate-900 dark:text-white underline">{classLabel(exam.classId, '')}</span> &nbsp;·&nbsp;
                    NUUCA IMTIXAANKA: <span className="text-slate-900 dark:text-white">{tv(exam.examType)}</span> &nbsp;·&nbsp;
                    {exam.term} {exam.academicYear} &nbsp;·&nbsp; {new Date(exam.examDate).toLocaleDateString(locale)}
                  </p>
                </div>

                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse">
                    <thead className="print:table-header-group">
                      <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                        <th className="px-3 py-3.5 w-12 text-center">{t('exams.results.rank')}</th>
                        <th className="px-3 py-3.5 w-20">Id</th>
                        <th className="px-4 py-3.5 min-w-[150px]">Name</th>
                        {subjects.map(s => {
                          const maxMarks = isMidTerm
                            ? (s.nisfiFullMarks || 40)
                            : isFinal
                            ? (s.nihaayiFullMarks || 60)
                            : s.fullMarks;
                          return (
                            <th key={s.name} className="px-3 py-3.5 text-center whitespace-nowrap">
                              {s.name}
                              <span className="block text-[9px] text-brand-300 font-normal">
                                /{maxMarks}
                              </span>
                            </th>
                          );
                        })}
                        <th className="px-3 py-3.5 text-center bg-slate-800 whitespace-nowrap">{t('common.total')}</th>
                        <th className="px-3 py-3.5 text-center bg-slate-800 whitespace-nowrap">{t('average')}</th>
                        <th className="px-3 py-3.5 text-center">{t('exams.results.grade')}</th>
                        <th className="px-3 py-3.5 text-center">{t('exams.results.result')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rows.map(r => (
                        <tr
                          key={r.studentId}
                          onClick={() => setCard({ ...r, isBroadsheet: false })}
                          className="hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-colors cursor-pointer print:break-inside-avoid"
                          title={t('exams.results.tip')}
                        >
                          <td className="px-3 py-3 text-sm font-black text-slate-400 text-center">
                            {r.entered ? (
                              r.position <= 3 ? (
                                <span className="inline-flex items-center gap-1 text-amber-500 font-black">
                                  <Trophy size={13} /> {r.position}
                                </span>
                              ) : (
                                r.position
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                            {r.rollNumber || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap capitalize">
                              {r.studentName}
                            </p>
                          </td>
                          {r.subjects.map(sub => (
                            <td key={sub.subject} className="px-3 py-3 text-center text-sm font-semibold">
                              {sub.isAbsent ? (
                                <span className="text-rose-500 text-xs font-black">{t('exams.results.absentShort')}</span>
                              ) : (
                                <span
                                  className={
                                    sub.passed
                                      ? 'text-slate-800 dark:text-slate-200 font-bold'
                                      : 'text-rose-600 dark:text-rose-400 font-black'
                                  }
                                >
                                  {r.entered ? sub.marksObtained : '—'}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center text-sm font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40">
                            {r.entered ? `${r.totalObtained}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center text-sm font-black text-brand-600 dark:text-brand-400 bg-slate-50 dark:bg-slate-800/40">
                            {r.entered ? `${r.average ?? r.percentage}%` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${gradeColor(r.grade)}`}>
                              {r.grade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${
                                r.status === 'Pass'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : r.status === 'Fail'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}
                            >
                              {resultLabel(r.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={subjects.length + 7} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                            {t('exams.results.noStudents')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-semibold print:hidden">
                  <span>{t('exams.results.tip')}</span>
                  <span>Wadarta Ardayda: {rows.length}</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ===================== VIEW MODE 2: COMBINED BROADSHEET (100 MARKS) ===================== */}
      {viewMode === 'broadsheet' && (
        <>
          {broadsheetLoading ? (
            <div className="p-16 text-center text-slate-500 font-bold">Soo dejinayaa waraaqda guud ee fasalka...</div>
          ) : !broadsheetData ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              Fadlan dooro fasal si aad u aragto waraaqda natiijada guud ee 100-ka dhibcood.
            </div>
          ) : (
            <>
              {/* Summary Stat Cards for Broadsheet */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      Ardayda Gudubtay
                    </span>
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{broadsheetData.summary?.passed ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Wadarta Ardayda: {broadsheetData.summary?.totalStudents ?? 0}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                      Ardayda Dhacday
                    </span>
                    <XCircle size={18} className="text-rose-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{broadsheetData.summary?.failed ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Kuwa aan gelin: {(broadsheetData.summary?.totalStudents ?? 0) - (broadsheetData.summary?.graded ?? 0)}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                      Celceliska Fasalka
                    </span>
                    <TrendingUp size={18} className="text-amber-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{broadsheetData.summary?.avgPercentage ?? 0}%</p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Wadarta Maaddooyinka: {broadsheetData.subjects?.length ?? 0}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                      Kaalinta 1-aad ee Fasalka
                    </span>
                    <Trophy size={18} className="text-amber-500" />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white truncate">
                    {broadsheetData.summary?.topper?.studentName || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    {broadsheetData.summary?.topper ? `${broadsheetData.summary.topper.percentage}%` : 'Dhibco lama hayo'}
                  </p>
                </div>
              </div>

              {/* Master Broadsheet Card: 100 Marks (Nisfi 40 + Nihaayi 60 = 100) */}
              <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6 print:p-0 print:border-0 print:shadow-none print:overflow-visible">
                <div className="pb-5 border-b-2 border-slate-900 dark:border-slate-700 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Sparkles size={14} /> {instituteName}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    WARAAQDA NATIIJADA GUUD EE FASALKA ({broadsheetData.config?.combinedMax || 100} DHIBCUUD)
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    FASALKA: <span className="text-slate-900 dark:text-white underline">{classLabel(broadsheetData.class, '')}</span> &nbsp;·&nbsp;
                    NISFI ({broadsheetData.config?.nisfiMax || 40}) + NIHAAYI ({broadsheetData.config?.nihaayiMax || 60}) = {broadsheetData.config?.combinedMax || 100} &nbsp;·&nbsp;
                    LAANTA: <span className="text-slate-900 dark:text-white">{broadsheetData.class?.branchId?.name || 'Dhammaan'}</span>
                  </p>
                </div>

                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse">
                    <thead className="print:table-header-group">
                      <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                        <th className="px-3 py-3.5 w-12 text-center">RK</th>
                        <th className="px-3 py-3.5 w-20">ID</th>
                        <th className="px-4 py-3.5 min-w-[150px]">NAME</th>
                        {(broadsheetData.subjects || []).map(s => (
                          <th key={s.name} className="px-3 py-3.5 text-center whitespace-nowrap">
                            {s.name}
                            <span className="block text-[9px] text-amber-300 font-normal">
                              /{s.fullMarks || broadsheetData.config?.combinedMax || 100} ({s.nisfiFullMarks || broadsheetData.config?.nisfiMax || 40}+{s.nihaayiFullMarks || broadsheetData.config?.nihaayiMax || 60})
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-3.5 text-center bg-slate-800 whitespace-nowrap">TOTAL (/{broadsheetData.summary?.totalFull || 700})</th>
                        <th className="px-3 py-3.5 text-center bg-slate-800 whitespace-nowrap">AVG %</th>
                        <th className="px-3 py-3.5 text-center">GRADE</th>
                        <th className="px-3 py-3.5 text-center">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {broadsheetRows.map(r => (
                        <tr
                          key={r.studentId}
                          onClick={() => setCard({ ...r, isBroadsheet: true, classDoc: broadsheetData.class })}
                          className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer print:break-inside-avoid"
                          title="Guji si aad u aragto warbixinta ardaygan (Nisfi + Nihaayi)"
                        >
                          <td className="px-3 py-3 text-sm font-black text-slate-400 text-center">
                            {r.entered ? (
                              r.position <= 3 ? (
                                <span className="inline-flex items-center gap-1 text-amber-500 font-black">
                                  <Trophy size={13} /> {r.position}
                                </span>
                              ) : (
                                r.position
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                            {r.rollNumber || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap capitalize">
                              {r.studentName}
                            </p>
                          </td>
                          {r.subjects.map(sub => (
                            <td key={sub.subject} className="px-3 py-3 text-center text-sm font-semibold">
                              <span
                                className={
                                  sub.passed
                                    ? 'text-slate-800 dark:text-slate-200 font-bold'
                                    : 'text-rose-600 dark:text-rose-400 font-black'
                                }
                              >
                                {r.entered ? sub.marksObtained : '—'}
                              </span>
                              {r.entered && (
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  ({sub.nisfi}+{sub.nihaayi})
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center text-sm font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40">
                            {r.entered ? `${r.totalObtained}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center text-sm font-black text-amber-600 dark:text-amber-400 bg-slate-50 dark:bg-slate-800/40">
                            {r.entered ? `${r.average ?? r.percentage}%` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${gradeColor(r.grade)}`}>
                              {r.grade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${
                                r.status === 'Pass'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : r.status === 'Fail'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}
                            >
                              {r.status === 'Pass' ? 'GUDBAY' : r.status === 'Fail' ? 'DHACAY' : 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {broadsheetRows.length === 0 && (
                        <tr>
                          <td colSpan={(broadsheetData.subjects?.length || 0) + 7} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                            Lama helin arday fasalkan ku jirta oo natiijooyin leeyahay.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-semibold print:hidden">
                  <span>Guji safka ardayga si aad u aragto waraaqdiisa faahfaahsan (Nisfi + Nihaayi)</span>
                  <span>Wadarta Ardayda: {broadsheetRows.length}</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Individual Report Card Modal */}
      {card && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-[#0B1E3F] via-[#1E7A3C] to-[#B8860B] p-6 text-white relative">
              <button
                onClick={() => setCard(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
              >
                <X size={18} />
              </button>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('exams.results.reportCard')}</p>
              <h2 className="text-2xl font-black">{card.studentName}</h2>
              <p className="text-xs font-semibold opacity-90">
                {card.isBroadsheet ? `Waraaqda Guud ee Fasalka (${card.subjects?.[0]?.fullMarks || broadsheetData?.config?.combinedMax || 100} Dhibcood)` : exam?.title} · {classLabel(card.classDoc || exam?.classId, '')}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">{t('exams.results.rank')}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {card.entered ? card.position : '—'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">{t('average')}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {card.average ?? card.percentage}%
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">{t('exams.results.grade')}</p>
                  <p className={`text-2xl font-black ${card.grade === 'F' ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {card.grade}
                  </p>
                </div>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2">{t('exams.results.subject')}</th>
                    {(card.isBroadsheet || (!isMidTerm && !isFinal)) && (
                      <>
                        <th className="py-2 text-center">Nisfi</th>
                        <th className="py-2 text-center">Nihaayi</th>
                        <th className="py-2 text-center">Wadarta ({card.subjects?.[0]?.fullMarks || broadsheetData?.config?.combinedMax || 100})</th>
                      </>
                    )}
                    {!card.isBroadsheet && isMidTerm && (
                      <th className="py-2 text-center">Mid-Term ({card.subjects[0]?.nisfiFullMarks || 40})</th>
                    )}
                    {!card.isBroadsheet && isFinal && (
                      <th className="py-2 text-center">Final ({card.subjects[0]?.nihaayiFullMarks || 60})</th>
                    )}
                    <th className="py-2 text-center">{t('exams.results.result')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {card.subjects.map(s => (
                    <tr key={s.subject}>
                      <td className="py-2 text-sm font-bold text-slate-700 dark:text-slate-200">{s.subject}</td>
                      {(card.isBroadsheet || (!isMidTerm && !isFinal)) && (
                        <>
                          <td className="py-2 text-center text-xs font-semibold text-slate-500">
                            {s.isAbsent ? 'MQ' : `${s.nisfi ?? 0} / ${s.nisfiFullMarks || 40}`}
                          </td>
                          <td className="py-2 text-center text-xs font-semibold text-slate-500">
                            {s.isAbsent ? 'MQ' : `${s.nihaayi ?? 0} / ${s.nihaayiFullMarks || 60}`}
                          </td>
                          <td className="py-2 text-center text-sm font-bold text-slate-900 dark:text-white">
                            {s.isAbsent ? 'MQ' : `${s.marksObtained} / ${s.fullMarks || 100}`}
                          </td>
                        </>
                      )}
                      {!card.isBroadsheet && isMidTerm && (
                        <td className="py-2 text-center text-sm font-bold text-slate-900 dark:text-white">
                          {s.isAbsent ? 'MQ' : `${s.nisfi ?? s.marksObtained} / ${s.nisfiFullMarks || 40}`}
                        </td>
                      )}
                      {!card.isBroadsheet && isFinal && (
                        <td className="py-2 text-center text-sm font-bold text-slate-900 dark:text-white">
                          {s.isAbsent ? 'MQ' : `${s.nihaayi ?? s.marksObtained} / ${s.nihaayiFullMarks || 60}`}
                        </td>
                      )}
                      <td className="py-2 text-center">
                        {s.isAbsent ? (
                          <span className="text-rose-500 text-xs font-black">{t('exams.results.absentShort')}</span>
                        ) : (
                          <span className={`text-xs font-black ${s.passed ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {s.passed ? t('exams.results.passUpper') : t('exams.results.failUpper')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
                    <td colSpan={card.isBroadsheet || (!isMidTerm && !isFinal) ? 3 : 1} className="py-2 uppercase text-xs">{t('common.total')}</td>
                    <td className="py-2 text-center text-sm">{card.totalObtained} / {card.totalFull}</td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-black uppercase ${card.status === 'Pass' ? 'text-emerald-600' : card.status === 'Fail' ? 'text-rose-500' : 'text-slate-400'}`}>
                        {resultLabel(card.status)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>

              {card.remarks && (
                <p className="text-xs text-slate-500">
                  <span className="font-black uppercase">{t('academic.exit.remarks')}:</span> {card.remarks}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamResults;
