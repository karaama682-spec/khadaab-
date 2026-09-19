import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  User, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  AlertCircle,
  MessageSquare, 
  Filter, 
  History, 
  ArrowRight,
  ShieldAlert,
  Download,
  BookOpen,
  Building2,
  Users,
  Briefcase,
  Layers,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import KPICard from './KPICard';
import { 
  ResponsiveContainer, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar, 
  Legend 
} from 'recharts';
import { jsPDF } from 'jspdf';
import { classLabel } from '../utils/classLabel';

// Current month as 'YYYY-MM' for the Daily View month picker.
const currentMonth = () => new Date().toISOString().slice(0, 7);

// Attendance dates are stored as 'YYYY-MM-DD'. Show them as one dd/mm/yyyy column.
const formatDMY = (iso) => {
  if (!iso || typeof iso !== 'string') return '-';
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : iso;
};

// 'YYYY-MM' -> 'September 2026' for headings.
const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

// Keep multiple sessions on the same date in a natural order.
const SESSION_ORDER = { Morning: 0, Breakfast: 1, Evening: 2 };

const StudentAttendanceReport = () => {
  const { showAlert } = useAlert();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState('class'); // class (Attendance Ledger) | daily | student | dashboard

  // Core Data States
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Dashboard Filters & Data
  const [dashDateFilter, setDashDateFilter] = useState('This Month'); // Today | This Week | This Month | Custom
  const [dashStartDate, setDashStartDate] = useState('');
  const [dashEndDate, setDashEndDate] = useState('');
  const [dashBranchId, setDashBranchId] = useState('');

  // 2. Daily Report State
  // Daily View now works as: Student Code + Month -> all of that student's
  // attendance records for the month (no single-date selection required).
  const [dailyStudentCode, setDailyStudentCode] = useState('');
  const [dailyMonth, setDailyMonth] = useState(currentMonth()); // 'YYYY-MM'
  const [dailyStatusFilter, setDailyStatusFilter] = useState('All'); // All | Present | Late | Absent
  // Kept for the inline quick-edit handlers used elsewhere in this page.
  const [dailyDate] = useState(new Date().toISOString().split('T')[0]);

  // 3. Class Report State
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedLedgerDate, setSelectedLedgerDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchesList, setBranchesList] = useState([]);
  const [selectedKpiFilter, setSelectedKpiFilter] = useState(null); // null | 'present' | 'late' | 'absent' | 'partial'

  // 4. Individual Student Search State
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resClasses, resStudents, resAttendance, resBranches] = await Promise.all([
        api.get('/classes'),
        api.get('/students'),
        api.get('/student-attendance'), // loads all to process locally for dashboard/stats
        api.get('/branches').catch(() => ({ data: [] }))
      ]);
      const loadedClasses = resClasses.data || [];
      setClasses(loadedClasses);
      setStudents(resStudents.data || []);
      setAllAttendance(resAttendance.data || []);
      setBranchesList(resBranches?.data || []);

      if (loadedClasses.length > 0) {
        const firstClass = loadedClasses[0];
        const bId = String(firstClass.branchId?._id || firstClass.branchId || '');
        if (bId) {
          setSelectedBranchId(bId);
        }
        setSelectedClassId('');
      } else if (resBranches?.data?.length > 0) {
        setSelectedBranchId(String(resBranches.data[0]._id));
        setSelectedClassId('');
      }
    } catch (error) {
      console.error('Failed to load reports data', error);
      showAlert({ type: 'danger', title: 'Error', message: 'Failed to load report datasets.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [savingStudentId, setSavingStudentId] = useState(null);

  // Sync / refresh attendance records dynamically when operations happen
  const refreshAttendance = async () => {
    try {
      const { data } = await api.get('/student-attendance');
      setAllAttendance(data || []);
    } catch (err) {
      console.error('Failed to refresh attendance logs', err);
    }
  };

  // Quick update status directly from the Daily Report list
  const handleQuickStatusChange = async (student, newStatus, currentArrivalTime = '') => {
    try {
      setSavingStudentId(student._id);
      const classId = student.classId?._id || student.classId || (classes[0]?._id);
      if (!classId) {
        showAlert({ type: 'warning', title: 'Class Missing', message: 'Student is not assigned to a class.' });
        return;
      }

      const arrivalTime = newStatus === 'Late' ? (currentArrivalTime && currentArrivalTime !== '-' ? currentArrivalTime : '08:30') : '';

      const payload = {
        studentId: student._id,
        classId,
        date: dailyDate,
        status: newStatus,
        session: 'Morning',
        arrivalTime
      };

      await api.post('/student-attendance', payload);
      await refreshAttendance();
      showAlert({
        type: 'success',
        title: 'Status Saved to Database',
        message: `${student.fullName} marked as ${newStatus} for ${dailyDate}.`
      });
    } catch (err) {
      console.error('Failed to save status', err);
      showAlert({
        type: 'danger',
        title: 'Update Error',
        message: err.response?.data?.message || 'Could not record attendance change in database.'
      });
    } finally {
      setSavingStudentId(null);
    }
  };

  // Quick update arrival time for Late status
  const handleArrivalTimeChange = async (student, currentStatus, newArrivalTime) => {
    try {
      setSavingStudentId(student._id);
      const classId = student.classId?._id || student.classId || (classes[0]?._id);
      const payload = {
        studentId: student._id,
        classId,
        date: dailyDate,
        status: currentStatus === 'Unmarked' ? 'Late' : currentStatus,
        session: 'Morning',
        arrivalTime: newArrivalTime
      };
      await api.post('/student-attendance', payload);
      await refreshAttendance();
    } catch (err) {
      console.error('Failed to update arrival time', err);
    } finally {
      setSavingStudentId(null);
    }
  };

  // Update historical record from Student Profile history table
  const handleHistoryStatusUpdate = async (recId, newStatus, newArrivalTime) => {
    try {
      await api.put(`/student-attendance/${recId}`, {
        status: newStatus,
        arrivalTime: newStatus === 'Late' ? (newArrivalTime || '08:30') : ''
      });
      await refreshAttendance();
      showAlert({
        type: 'success',
        title: 'Record Updated',
        message: 'Attendance record updated successfully in database.'
      });
    } catch (err) {
      console.error('Failed to update historical record', err);
      showAlert({ type: 'danger', title: 'Update Error', message: 'Failed to save historical update.' });
    }
  };

  // Helper: Date range resolver
  const resolveDateRange = (filterType, customStart, customEnd) => {
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];

    if (filterType === 'Today') {
      start = end;
    } else if (filterType === 'This Week') {
      const currentDay = today.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay; // Adjust for Sunday
      const monday = new Date(today.setDate(today.getDate() + distanceToMonday));
      start = monday.toISOString().split('T')[0];
    } else if (filterType === 'This Month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (filterType === 'Custom') {
      start = customStart;
      end = customEnd;
    }

    return { start, end };
  };

  // ==========================================
  // 1. DASHBOARD CALCULATIONS
  // ==========================================
  const dashFilteredStudents = useMemo(() => {
    if (!dashBranchId) return students;
    const branchClassIds = new Set(
      classes
        .filter(c => String(c.branchId?._id || c.branchId || '') === String(dashBranchId))
        .map(c => String(c._id))
    );
    return students.filter(s => {
      const sBranch = String(s.branchId?._id || s.branchId || s.classId?.branchId?._id || s.classId?.branchId || '');
      if (sBranch) {
        return sBranch === String(dashBranchId);
      }
      const sClassId = String(s.classId?._id || s.classId || '');
      return branchClassIds.has(sClassId);
    });
  }, [students, classes, dashBranchId]);

  const dashboardStats = useMemo(() => {
    const { start, end } = resolveDateRange(dashDateFilter, dashStartDate, dashEndDate);
    const branchStudentIdSet = dashBranchId ? new Set(dashFilteredStudents.map(s => String(s._id))) : null;

    // Filter records falling in the range and matching branch (if selected)
    const filteredRecs = allAttendance.filter(rec => {
      if (!rec.date) return false;
      if (start && rec.date < start) return false;
      if (end && rec.date > end) return false;
      if (dashBranchId && branchStudentIdSet) {
        const sId = String(rec.studentId?._id || rec.studentId || '');
        if (!branchStudentIdSet.has(sId)) return false;
        const recBranchId = String(rec.classId?.branchId?._id || rec.classId?.branchId || '');
        if (recBranchId && recBranchId !== String(dashBranchId)) return false;
        const recStudentBranchId = String(rec.studentId?.branchId?._id || rec.studentId?.branchId || '');
        if (recStudentBranchId && recStudentBranchId !== String(dashBranchId)) return false;
      }
      return true;
    });

    const stats = {
      totalStudents: dashFilteredStudents.length,
      present: 0,
      late: 0,
      absent: 0,
      partial: 0,
      percentage: 100
    };

    filteredRecs.forEach(r => {
      if (r.status === 'Present') stats.present++;
      else if (r.status === 'Late') stats.late++;
      else if (r.status === 'Absent') stats.absent++;
      else if (r.status === 'Partial') stats.partial++;
    });

    const totalMarked = stats.present + stats.late + stats.absent;
    if (totalMarked > 0) {
      stats.percentage = Math.round((stats.present / totalMarked) * 100);
    }

    return { stats, filteredRecs };
  }, [allAttendance, dashFilteredStudents, dashBranchId, dashDateFilter, dashStartDate, dashEndDate]);

  // Dashboard Chart Trend Data (grouped by date)
  const dashboardChartData = useMemo(() => {
    const dateMap = {};
    
    dashboardStats.filteredRecs.forEach(r => {
      if (!r.date) return;
      if (!dateMap[r.date]) {
        dateMap[r.date] = { date: r.date, Present: 0, Late: 0, Absent: 0, Partial: 0 };
      }
      if (r.status === 'Present') dateMap[r.date].Present++;
      else if (r.status === 'Late') dateMap[r.date].Late++;
      else if (r.status === 'Absent') dateMap[r.date].Absent++;
      else if (r.status === 'Partial') dateMap[r.date].Partial++;
    });

    return Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10); // show last 10 days for cleaner chart presentation
  }, [dashboardStats]);

  // ==========================================
  // 2. DAILY REPORT CALCULATIONS
  // ==========================================
  // Resolve the typed Student ID/Code to a student. Prefer an exact code match,
  // then fall back to a partial match so typing part of a code still finds them.
  const dailyMatchedStudent = useMemo(() => {
    const q = dailyStudentCode.trim().toLowerCase();
    if (!q) return null;
    const codeOf = (s) => String(s.studentCode || s.rollNumber || '').toLowerCase();
    return students.find(s => codeOf(s) === q)
      || students.find(s => codeOf(s).includes(q))
      || null;
  }, [students, dailyStudentCode]);

  // All attendance records for the matched student within the selected month.
  // Dates are stored as 'YYYY-MM-DD', so a 'YYYY-MM' prefix match cleanly covers
  // every month length (28/29/30/31) and leap years. One row per date+session —
  // multiple sessions on the same day appear as separate rows. The records are
  // shown exactly as recorded (no recalculation against current session times).
  const dailyReportData = useMemo(() => {
    if (!dailyMatchedStudent || !dailyMonth) return [];
    const sid = dailyMatchedStudent._id;

    const rows = allAttendance
      .filter(r => {
        const rId = r.studentId?._id || r.studentId;
        return String(rId) === String(sid) && typeof r.date === 'string' && r.date.startsWith(dailyMonth);
      })
      .map(r => ({
        date: r.date,
        student: dailyMatchedStudent,
        code: dailyMatchedStudent.studentCode || dailyMatchedStudent.rollNumber || '-',
        session: r.session || 'Morning',
        status: r.status || '-',
        arrivalTime: r.arrivalTime || '',
        description: r.description || ''
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        ((SESSION_ORDER[a.session] ?? 9) - (SESSION_ORDER[b.session] ?? 9))
      );

    return dailyStatusFilter === 'All' ? rows : rows.filter(r => r.status === dailyStatusFilter);
  }, [dailyMatchedStudent, dailyMonth, allAttendance, dailyStatusFilter]);

  // ==========================================
  // 3. CLASS REPORT CALCULATIONS
  // ==========================================
  // Branches derived from /branches or loaded classes
  const branches = useMemo(() => {
    const map = new Map();
    if (branchesList.length > 0) {
      branchesList.forEach(b => {
        if (b && b._id) map.set(String(b._id), { _id: String(b._id), name: b.name || 'Branch' });
      });
    }
    classes.forEach(item => {
      const branch = item.branchId;
      if (branch && (branch._id || typeof branch === 'string')) {
        const id = String(branch._id || branch);
        const name = branch.name || 'Branch';
        if (!map.has(id)) map.set(id, { _id: id, name });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [branchesList, classes]);

  // Classes filtered by selected branch
  const visibleClasses = useMemo(() => {
    if (!selectedBranchId) return classes;
    return classes.filter(item => {
      const bId = item.branchId?._id || item.branchId;
      return String(bId) === String(selectedBranchId);
    });
  }, [classes, selectedBranchId]);

  // Handle branch filter change
  const handleBranchChange = (branchId) => {
    setSelectedBranchId(branchId);
    setSelectedClassId('');
    setSelectedKpiFilter(null);
  };

  const classReportData = useMemo(() => {
    if (!selectedClassId && !selectedBranchId) {
      return { studentsList: [], stats: { present: 0, late: 0, absent: 0, partial: 0, percentage: 100 } };
    }

    let classStudents = [];
    let targetClass = null;
    let targetBranchId = selectedBranchId || '';

    if (selectedClassId) {
      // User selected a specific Class: strictly isolate to this Branch + Class
      targetClass = classes.find(c => String(c._id) === String(selectedClassId));
      targetBranchId = String(targetClass?.branchId?._id || targetClass?.branchId || selectedBranchId || '');

      classStudents = students.filter(s => {
        const studentClassId = String(s.classId?._id || s.classId || '');
        if (studentClassId !== String(selectedClassId)) return false;

        // Verify branch isolation if branch info exists on student
        if (targetBranchId) {
          const studentBranchId = String(s.branchId?._id || s.branchId || s.classId?.branchId?._id || s.classId?.branchId || '');
          if (studentBranchId && studentBranchId !== targetBranchId) {
            return false;
          }
        }
        return true;
      });
    } else {
      // User selected a Branch and NO specific class: include ALL classes in this Branch
      const branchClasses = classes.filter(c => String(c.branchId?._id || c.branchId || '') === String(selectedBranchId));
      const branchClassIds = new Set(branchClasses.map(c => String(c._id)));

      classStudents = students.filter(s => {
        const studentBranchId = String(s.branchId?._id || s.branchId || s.classId?.branchId?._id || s.classId?.branchId || '');
        if (studentBranchId) {
          return studentBranchId === String(selectedBranchId);
        }
        const studentClassId = String(s.classId?._id || s.classId || '');
        return branchClassIds.has(studentClassId);
      });
    }

    const stats = { present: 0, late: 0, absent: 0, partial: 0, percentage: 100 };

    const studentsList = classStudents.map(student => {
      const studentRecs = allAttendance.filter(r => {
        const sId = r.studentId?._id || r.studentId;
        if (String(sId) !== String(student._id)) return false;
        if (selectedLedgerDate) {
          const recDate = String(r.date || '').slice(0, 10);
          if (recDate !== selectedLedgerDate) return false;
        }
        if (selectedClassId) {
          const rClassId = String(r.classId?._id || r.classId || '');
          if (rClassId && rClassId !== String(selectedClassId)) return false;
        } else if (selectedBranchId) {
          const rBranchId = String(r.classId?.branchId?._id || r.classId?.branchId || '');
          if (rBranchId && rBranchId !== String(selectedBranchId)) return false;
        }
        return true;
      });

      const counts = { present: 0, late: 0, absent: 0, partial: 0 };
      const descriptions = { present: [], late: [], absent: [], partial: [] };
      studentRecs.forEach(r => {
        if (r.status === 'Present') { 
          counts.present++; stats.present++; 
          if (r.description) descriptions.present.push(r.description);
        }
        else if (r.status === 'Late') { 
          counts.late++; stats.late++; 
          if (r.description) descriptions.late.push(r.description);
        }
        else if (r.status === 'Absent') { 
          counts.absent++; stats.absent++; 
          if (r.description) descriptions.absent.push(r.description);
        }
        else if (r.status === 'Partial') { 
          counts.partial++; stats.partial++; 
          if (r.description) descriptions.partial.push(r.description);
        }
      });

      const total = counts.present + counts.late + counts.absent;
      const rate = total > 0 ? Math.round((counts.present / total) * 100) : 0;

      const studentClass = classes.find(c => String(c._id) === String(student.classId?._id || student.classId)) || targetClass;

      return {
        student,
        counts,
        descriptions,
        studentRecs,
        className: classLabel(studentClass || student.classId) || studentClass?.name || 'Class',
        percentage: rate
      };
    });

    const grandTotal = stats.present + stats.late + stats.absent;
    if (grandTotal > 0) {
      stats.percentage = Math.round((stats.present / grandTotal) * 100);
    }

    return { studentsList, stats };
  }, [selectedClassId, selectedBranchId, selectedLedgerDate, classes, students, allAttendance]);

  // Filter students based on clicked KPI card (Present, Late, Absent, Partial)
  const displayedClassStudents = useMemo(() => {
    if (!selectedKpiFilter) return [];
    if (selectedKpiFilter === 'present') {
      return classReportData.studentsList.filter(item => (item.counts.present || 0) > 0);
    }
    if (selectedKpiFilter === 'late') {
      return classReportData.studentsList.filter(item => (item.counts.late || 0) > 0);
    }
    if (selectedKpiFilter === 'absent') {
      return classReportData.studentsList.filter(item => (item.counts.absent || 0) > 0);
    }
    if (selectedKpiFilter === 'partial') {
      return classReportData.studentsList.filter(item => (item.counts.partial || 0) > 0);
    }
    return [];
  }, [classReportData.studentsList, selectedKpiFilter]);

  // ==========================================
  // 4. INDIVIDUAL REPORT CALCULATIONS
  // ==========================================
  const individualSuggestions = useMemo(() => {
    if (!studentSearchQuery.trim()) return [];
    return students.filter(s => 
      s.fullName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      (s.studentCode || '').toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      (s.fatherPhone || '').includes(studentSearchQuery)
    );
  }, [students, studentSearchQuery]);

  const studentReportData = useMemo(() => {
    if (!selectedStudent) return null;

    const history = allAttendance.filter(r => {
      const sId = r.studentId?._id || r.studentId;
      return String(sId) === String(selectedStudent._id);
    }).sort((a, b) => b.date.localeCompare(a.date));

    const stats = { present: 0, late: 0, absent: 0, total: 0, percentage: 100 };
    history.forEach(r => {
      stats.total++;
      if (r.status === 'Present') stats.present++;
      else if (r.status === 'Late') stats.late++;
      else if (r.status === 'Absent') stats.absent++;
    });

    if (stats.total > 0) {
      stats.percentage = Math.round((stats.present / stats.total) * 100);
    }

    // Warnings Logic
    const isLateWarning = stats.late >= 3;
    const isAbsentWarning = stats.absent >= 3;
    const hasWarnings = isLateWarning || isAbsentWarning;

    let warningText = '';
    if (isLateWarning && isAbsentWarning) {
      warningText = `marked Late ${stats.late} times and Absent ${stats.absent} times.`;
    } else if (isLateWarning) {
      warningText = `marked Late ${stats.late} times.`;
    } else if (isAbsentWarning) {
      warningText = `marked Absent ${stats.absent} times.`;
    }

    const parentName = selectedStudent.guardianId?.fullName || selectedStudent.fatherName || 'Parent';
    const parentPhone = selectedStudent.guardianId?.phone || selectedStudent.fatherPhone || '';
    const message = `Hello ${parentName}, this is an official notification that your child ${selectedStudent.fullName} has reached high attendance concerns: ${warningText} Please coordinate with the management.`;
    const waUrl = parentPhone ? `https://wa.me/${parentPhone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}` : '';

    return {
      history,
      stats,
      warnings: {
        hasWarnings,
        warningText,
        waUrl,
        parentPhone,
        parentName
      }
    };
  }, [selectedStudent, allAttendance]);

  // ==========================================
  // REPORT EXPORTS (PDF & CSV)
  // ==========================================
  
  // CSV Export utility
  const handleExportCSV = (headers, rows, filename) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert({ type: 'success', title: 'Export Complete', message: `CSV exported successfully as ${filename}` });
  };

  // jsPDF draws each cell at a fixed offset and never clips, so a value wider than
  // its column silently runs into the next one. Every single-line cell is fitted to
  // its column, falling back to an ellipsis only when the text genuinely cannot fit.
  const fitPdfText = (doc, text, width) => {
    const value = String(text ?? '').trim() || '-';
    if (doc.getTextWidth(value) <= width) return value;

    let truncated = value;
    while (truncated.length > 1 && doc.getTextWidth(`${truncated}...`) > width) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}...`;
  };

  // These PDFs are drawn as plain text rather than with a table engine, so a
  // reason is wrapped to its column width and capped at two lines to keep the row
  // grid readable. The CSV export carries the untruncated text.
  const pdfDescriptionLines = (doc, text, width) => {
    const value = String(text || '').trim();
    if (!value) return ['-'];

    const lines = doc.splitTextToSize(value, width);
    const capped = lines.slice(0, 2);
    if (lines.length > 2) {
      capped[1] = `${capped[1].replace(/\s+\S*$/, '')}...`;
    }
    // A single unbreakable word can still exceed the column, so fit every line.
    return capped.map(line => fitPdfText(doc, line, width));
  };

  // 1. Export Daily CSV (monthly ledger for one student)
  const exportDailyCSV = () => {
    if (!dailyMatchedStudent || dailyReportData.length === 0) {
      showAlert({ type: 'warning', title: 'Nothing to export', message: 'Search a Student ID/Code and month with records first.' });
      return;
    }
    const headers = ['Date', 'Student Name', 'Code', 'Session', 'Status', 'Arrival', 'Description'];
    const rows = dailyReportData.map(item => [
      formatDMY(item.date),
      item.student.fullName,
      item.code,
      item.session,
      item.status,
      item.arrivalTime || '-',
      item.description || '-'
    ]);
    handleExportCSV(headers, rows, `Attendance_${item0Code()}_${dailyMonth}.csv`);
  };

  // Small helper so the export filename carries the student code safely.
  const item0Code = () => String(dailyMatchedStudent?.studentCode || dailyMatchedStudent?.rollNumber || 'student').replace(/\s+/g, '_');

  // 2. Export Class CSV
  const exportClassCSV = () => {
    const targetName = selectedClassId 
      ? (classes.find(c => String(c._id) === String(selectedClassId))?.name || 'Class')
      : (branches.find(b => String(b._id) === String(selectedBranchId))?.name || 'All_Classes');
    const headers = ['Student Name', 'Student Code', 'Class', 'Total Present', 'Total Late', 'Total Absent', 'Total Partial', 'Attendance Rate'];
    const rows = classReportData.studentsList.map(item => [
      item.student.fullName,
      item.student.studentCode || item.student.rollNumber || '-',
      item.className,
      item.counts.present,
      item.counts.late,
      item.counts.absent,
      item.counts.partial,
      `${item.percentage}%`
    ]);
    handleExportCSV(headers, rows, `Attendance_${targetName.replace(/\s+/g, '_')}.csv`);
  };

  // 3. Export Student CSV
  const exportStudentCSV = () => {
    if (!selectedStudent || !studentReportData) return;
    const headers = ['Date', 'Class', 'Session', 'Status', 'Arrival Time', 'Description', 'Recorded By'];
    const rows = studentReportData.history.map(rec => [
      rec.date,
      classLabel(rec.classId),
      rec.session || 'Morning',
      rec.status,
      rec.arrivalTime || '-',
      rec.description || '',
      rec.markedBy?.fullName || 'System Admin'
    ]);
    handleExportCSV(headers, rows, `Student_Attendance_${selectedStudent.fullName.replace(/\s+/g, '_')}.csv`);
  };

  // 1. Export Daily PDF (monthly ledger for one student)
  const exportDailyPDF = () => {
    // PRINT filter: "All" prints every recorded status EXCEPT Present
    // (Present is treated as the normal case and omitted from the printed ledger).
    // A specific status filter prints only that status (dailyReportData already
    // holds just that status in that case).
    const printRows = dailyStatusFilter === 'All'
      ? dailyReportData.filter(r => r.status !== 'Present')
      : dailyReportData;

    if (!dailyMatchedStudent || printRows.length === 0) {
      showAlert({
        type: 'warning',
        title: 'Nothing to print',
        message: dailyStatusFilter === 'All'
          ? 'No Late/Absent records to print for this student and month.'
          : 'No matching records to print for this student and month.'
      });
      return;
    }

    // Class comes from the existing student/class data — no new class system.
    const studentClass = dailyMatchedStudent.classId;
    const studentClassName =
      classes.find(c => String(c._id) === String(studentClass?._id || studentClass))?.name
      || (studentClass && typeof studentClass === 'object' ? classLabel(studentClass, '') : '')
      || '-';

    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('MONTHLY ATTENDANCE LEDGER', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Stacked header: Student / Code / Class / Month / Generated At.
    doc.text(`Student: ${dailyMatchedStudent.fullName}`, 14, 30);
    doc.text(`Code: ${dailyMatchedStudent.studentCode || dailyMatchedStudent.rollNumber || '-'}`, 14, 36);
    doc.text(`Class: ${studentClassName}`, 14, 42);
    doc.text(`Month: ${monthLabel(dailyMonth)}`, 14, 48);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 54);

    doc.line(14, 59, 196, 59);

    let y = 68;
    doc.setFont('helvetica', 'bold');
    // One Date column plus the recorded fields. Session/Status/Arrival hold short
    // fixed values; the reclaimed space funds the description column.
    const col = {
      date: { x: 14, w: 24 },
      name: { x: 38, w: 42 },
      code: { x: 80, w: 18 },
      session: { x: 98, w: 20 },
      status: { x: 118, w: 18 },
      arrival: { x: 136, w: 15 },
      description: { x: 151, w: 45 }
    };

    doc.text('Date', col.date.x, y);
    doc.text('Student Name', col.name.x, y);
    doc.text('Code', col.code.x, y);
    doc.text('Session', col.session.x, y);
    doc.text('Status', col.status.x, y);
    doc.text('Arrival', col.arrival.x, y);
    doc.text('Description', col.description.x, y);

    doc.line(14, y + 3, 196, y + 3);
    doc.setFont('helvetica', 'normal');

    y += 10;
    printRows.forEach(item => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const descriptionLines = pdfDescriptionLines(doc, item.description, col.description.w);
      doc.text(fitPdfText(doc, formatDMY(item.date), col.date.w), col.date.x, y);
      doc.text(fitPdfText(doc, item.student.fullName, col.name.w), col.name.x, y);
      doc.text(fitPdfText(doc, item.code, col.code.w), col.code.x, y);
      doc.text(fitPdfText(doc, item.session, col.session.w), col.session.x, y);
      doc.text(fitPdfText(doc, item.status, col.status.w), col.status.x, y);
      doc.text(fitPdfText(doc, item.arrivalTime || '-', col.arrival.w), col.arrival.x, y);
      doc.text(descriptionLines, col.description.x, y);
      y += Math.max(8, descriptionLines.length * 5);
    });

    doc.save(`Attendance_${item0Code()}_${dailyMonth}.pdf`);
  };

  // 2. Export Class PDF
  const exportClassPDF = () => {
    const doc = new jsPDF();
    const targetName = selectedClassId 
      ? (classes.find(c => String(c._id) === String(selectedClassId))?.name || 'Class')
      : (branches.find(b => String(b._id) === String(selectedBranchId))?.name || 'Branch');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`ATTENDANCE REPORT: ${targetName.toUpperCase()}`, 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Present: ${classReportData.stats.present} | Total Late: ${classReportData.stats.late} | Total Absent: ${classReportData.stats.absent} | Total Partial: ${classReportData.stats.partial}`, 14, 26);
    doc.text(`Overall Attendance Rate: ${classReportData.stats.percentage}%`, 14, 31);
    
    doc.line(14, 35, 196, 35);
    
    let y = 45;
    doc.setFont('helvetica', 'bold');
    doc.text('Student Name', 14, y);
    doc.text('Code', 70, y);
    doc.text('Present', 100, y);
    doc.text('Late', 125, y);
    doc.text('Absent', 150, y);
    doc.text('Rate', 175, y);
    
    doc.line(14, y + 3, 196, y + 3);
    doc.setFont('helvetica', 'normal');
    
    y += 10;
    classReportData.studentsList.forEach(item => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(item.student.fullName, 14, y);
      doc.text(item.student.studentCode || item.student.rollNumber || '-', 70, y);
      doc.text(String(item.counts.present), 100, y);
      doc.text(String(item.counts.late), 125, y);
      doc.text(String(item.counts.absent), 150, y);
      doc.text(`${item.percentage}%`, 175, y);
      y += 8;
    });

    doc.save(`Attendance_${targetName.replace(/\s+/g, '_')}.pdf`);
  };

  // 3. Export Student PDF
  const exportStudentPDF = () => {
    if (!selectedStudent || !studentReportData) return;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`STUDENT ATTENDANCE DOSSIER`, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Student: ${selectedStudent.fullName}`, 14, 28);
    doc.text(`Code: ${selectedStudent.studentCode || selectedStudent.rollNumber || '-'}`, 14, 34);
    doc.text(`Class: ${classes.find(c => String(c._id) === String(selectedStudent.classId?._id || selectedStudent.classId))?.name || '-'}`, 14, 40);
    
    doc.text(`Total Days: ${studentReportData.stats.total}`, 120, 28);
    doc.text(`Present: ${studentReportData.stats.present} | Late: ${studentReportData.stats.late} | Absent: ${studentReportData.stats.absent}`, 120, 34);
    doc.text(`Attendance Rate: ${studentReportData.stats.percentage}%`, 120, 40);

    doc.line(14, 45, 196, 45);
    
    let y = 55;
    doc.setFont('helvetica', 'bold');
    // The class-name column keeps its original 50mm; the reclaimed Session/Status/
    // Arrival space funds the description column.
    const col = {
      date: { x: 14, w: 20 },
      className: { x: 34, w: 50 },
      session: { x: 84, w: 19 },
      status: { x: 103, w: 18 },
      arrival: { x: 121, w: 15 },
      description: { x: 136, w: 60 }
    };

    doc.text('Date', col.date.x, y);
    doc.text('Class Name', col.className.x, y);
    doc.text('Session', col.session.x, y);
    doc.text('Status', col.status.x, y);
    doc.text('Arrival', col.arrival.x, y);
    doc.text('Description', col.description.x, y);

    doc.line(14, y + 3, 196, y + 3);
    doc.setFont('helvetica', 'normal');

    y += 10;
    studentReportData.history.forEach(rec => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const descriptionLines = pdfDescriptionLines(doc, rec.description, col.description.w);
      doc.text(fitPdfText(doc, rec.date, col.date.w), col.date.x, y);
      doc.text(fitPdfText(doc, classLabel(rec.classId, ''), col.className.w), col.className.x, y);
      doc.text(fitPdfText(doc, rec.session || 'Morning', col.session.w), col.session.x, y);
      doc.text(fitPdfText(doc, rec.status, col.status.w), col.status.x, y);
      doc.text(fitPdfText(doc, rec.arrivalTime, col.arrival.w), col.arrival.x, y);
      doc.text(descriptionLines, col.description.x, y);
      y += Math.max(8, descriptionLines.length * 5);
    });

    doc.save(`Student_Attendance_${selectedStudent.fullName.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Attendance System Datasets...</div>;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-brand-400 shadow-2xl border border-slate-700 ring-4 ring-brand-400/10">
            <History size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">Attendance Ledger</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">Reports & Diagnostics Hub</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-[20px] border border-slate-200/40 dark:border-slate-700/60 gap-1">
          {[
            { id: 'class', label: 'Attendance Ledger' },
            { id: 'daily', label: 'Daily View' },
            { id: 'student', label: 'Student View' },
            { id: 'dashboard', label: 'Dashboard' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                refreshAttendance();
              }}
              className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. OVERVIEW DASHBOARD TAB */}
      {/* ========================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Dashboard Controls: Branch & Date Range */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6">
              {/* Filter Branch */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                  <Building2 size={14} className="text-indigo-500" /> Filter Branch
                </label>
                <select
                  value={dashBranchId}
                  onChange={(e) => setDashBranchId(e.target.value)}
                  className="min-w-[180px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-xs"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Reporting Cycle Range */}
              <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 border-l border-slate-200 dark:border-slate-700 pl-6">
                <Filter size={14} className="text-brand-500" /> Reporting Cycle Range
              </div>
            </div>
            
            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {['Today', 'This Week', 'This Month', 'Custom'].map(f => (
                  <button
                    key={f}
                    onClick={() => setDashDateFilter(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      dashDateFilter === f
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Custom Range Inputs */}
              {dashDateFilter === 'Custom' && (
                <div className="flex gap-4 items-center">
                  <input
                    type="date"
                    value={dashStartDate}
                    onChange={(e) => setDashStartDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  />
                  <span className="text-slate-400 font-bold text-xs">to</span>
                  <input
                    type="date"
                    value={dashEndDate}
                    onChange={(e) => setDashEndDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* KPICards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <KPICard label="Total Students" value={dashboardStats.stats.totalStudents} icon={<Users size={20} />} color="bg-brand-600" trend={0} description="Active enrollment roster" />
            <KPICard label="Present Today" value={dashboardStats.stats.present} icon={<CheckCircle size={20} />} color="bg-emerald-500" trend={2} description="Explicitly present logs" />
            <KPICard label="Late Today" value={dashboardStats.stats.late} icon={<Clock size={20} />} color="bg-amber-500" trend={-5} description="Tardiness records" />
            <KPICard label="Absent Today" value={dashboardStats.stats.absent} icon={<AlertTriangle size={20} />} color="bg-rose-500" trend={1} description="Explicit absence logs" />
            <KPICard label="Partial Today" value={dashboardStats.stats.partial} icon={<AlertCircle size={20} />} color="bg-indigo-600" trend={0} description="Partial session logs" />
            <KPICard label="Attendance Rate" value={`${dashboardStats.stats.percentage}%`} icon={<TrendingUp size={20} />} color="bg-teal-500" trend={0} description="Present/Late vs Absent" />
          </div>

          {/* Trend Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm p-10">
            <h3 className="text-lg font-black dark:text-white uppercase tracking-tight mb-8">Daily Attendance Status Trend</h3>
            <div className="h-[400px] w-full">
              {dashboardChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800/50" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.03)' }} contentStyle={{ backgroundColor: '#0f172a', borderRadius: '24px', border: 'none', color: '#fff' }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="Present" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Late" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Absent" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Partial" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 font-semibold">
                  No attendance logged in this range. Change the reporting cycle range above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. DAILY ATTENDANCE REPORT TAB */}
      {/* ========================================== */}
      {activeTab === 'daily' && (
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* Controls: Student ID/Code + Month (no single-date selection needed) */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-end justify-between gap-6">

            <div className="flex flex-wrap items-end gap-6 flex-1">

              {/* Student ID / Code */}
              <div className="min-w-[220px]">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Student ID / Code</label>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. 1001"
                    value={dailyStudentCode}
                    onChange={(e) => setDailyStudentCode(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Month selection */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Month</label>
                <input
                  type="month"
                  value={dailyMonth}
                  onChange={(e) => setDailyMonth(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Optional status filter (defaults to All) */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Status</label>
                <select
                  value={dailyStatusFilter}
                  onChange={(e) => setDailyStatusFilter(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present Only</option>
                  <option value="Late">Late Only</option>
                  <option value="Absent">Absent Only</option>
                </select>
              </div>

            </div>

            {/* Export Buttons (print the monthly ledger for this student) */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={exportDailyCSV}
                className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-all"
              >
                <FileSpreadsheet size={16} /> Export Excel
              </button>
              <button
                onClick={exportDailyPDF}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-850 dark:bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-all"
              >
                <FileText size={16} /> Export PDF
              </button>
            </div>

          </div>

          {/* Student + month summary header (paper ledger style) */}
          {dailyMatchedStudent && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-5 flex flex-wrap items-center gap-x-10 gap-y-2">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Student</span>
                <p className="text-base font-bold text-slate-900 dark:text-white">{dailyMatchedStudent.fullName}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Code</span>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 font-mono">{dailyMatchedStudent.studentCode || dailyMatchedStudent.rollNumber || '-'}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Month</span>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{monthLabel(dailyMonth)}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Records</span>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{dailyReportData.length}</p>
              </div>
            </div>
          )}

          {/* Table — one Date column; shows every session record for the month */}
          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Student Name</th>
                    <th className="px-8 py-5">Code</th>
                    <th className="px-8 py-5">Session</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5">Arrival</th>
                    <th className="px-8 py-5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dailyReportData.map((item, idx) => (
                    <tr key={`${item.date}-${item.session}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {formatDMY(item.date)}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.student.fullName}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400 font-mono">
                        {item.code}
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-slate-500">
                        {item.session}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1.5 rounded-xl font-bold text-[11px] uppercase border ${
                          item.status === 'Present'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                            : item.status === 'Late'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                            : item.status === 'Absent'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-slate-750 dark:text-slate-300 font-mono">
                        {item.arrivalTime ? item.arrivalTime : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-8 py-6 text-sm font-semibold text-slate-700 dark:text-slate-300 max-w-xs">
                        {item.description
                          ? <span className="whitespace-pre-wrap break-words">{item.description}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {dailyReportData.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-8 py-12 text-center text-slate-400 text-sm font-semibold">
                        {!dailyStudentCode.trim()
                          ? 'Enter a Student ID / Code and choose a month to view attendance.'
                          : !dailyMatchedStudent
                          ? `No student found with code "${dailyStudentCode.trim()}".`
                          : `No attendance records for ${dailyMatchedStudent.fullName} in ${monthLabel(dailyMonth)}.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. CLASS ATTENDANCE REPORT TAB */}
      {/* ========================================== */}
      {activeTab === 'class' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Class selector control panel */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <Building2 size={14} className="text-indigo-500" /> Filter Branch
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-sm"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <BookOpen size={14} className="text-brand-500" /> Filter Class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedKpiFilter(null);
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-sm"
                >
                  <option value="">{selectedBranchId ? 'All Classes' : 'Select class to audit...'}</option>
                  {visibleClasses.map(c => (
                    <option key={c._id} value={c._id}>{classLabel(c)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <Calendar size={14} className="text-emerald-500" /> Date
                </label>
                <input
                  type="date"
                  value={selectedLedgerDate}
                  onChange={(e) => {
                    setSelectedLedgerDate(e.target.value);
                    setSelectedKpiFilter(null);
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white font-bold text-sm"
                />
              </div>
            </div>

            {/* Export options */}
            <div className="flex items-center gap-3">
              <button
                onClick={exportClassCSV}
                disabled={!selectedClassId && !selectedBranchId}
                className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
              >
                <FileSpreadsheet size={16} /> Export Excel
              </button>
              <button
                onClick={exportClassPDF}
                disabled={!selectedClassId && !selectedBranchId}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-850 dark:bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
              >
                <FileText size={16} /> Export PDF
              </button>
            </div>
          </div>

          {(selectedClassId || selectedBranchId) && (
            <>
              {/* Class / Branch summary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div 
                  onClick={() => setSelectedKpiFilter(prev => prev === 'present' ? null : 'present')}
                  title="Click to view students with Present attendance"
                  className={`bg-white dark:bg-slate-900 p-6 rounded-[32px] border transition-all cursor-pointer select-none ${
                    selectedKpiFilter === 'present'
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow'
                  } flex items-center justify-between`}
                >
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      {selectedClassId ? 'Class Present Days' : 'Branch Present Days'}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-2">{classReportData.stats.present} Days</h3>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl flex items-center justify-center">
                    <CheckCircle size={18} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedKpiFilter(prev => prev === 'late' ? null : 'late')}
                  title="Click to view students with Late attendance"
                  className={`bg-white dark:bg-slate-900 p-6 rounded-[32px] border transition-all cursor-pointer select-none ${
                    selectedKpiFilter === 'late'
                      ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-md bg-amber-50/20 dark:bg-amber-950/20'
                      : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-amber-300 dark:hover:border-amber-700/50 hover:shadow'
                  } flex items-center justify-between`}
                >
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      {selectedClassId ? 'Class Late Days' : 'Branch Late Days'}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-2">{classReportData.stats.late} Days</h3>
                  </div>
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl flex items-center justify-center">
                    <Clock size={18} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedKpiFilter(prev => prev === 'absent' ? null : 'absent')}
                  title="Click to view students with Absent attendance"
                  className={`bg-white dark:bg-slate-900 p-6 rounded-[32px] border transition-all cursor-pointer select-none ${
                    selectedKpiFilter === 'absent'
                      ? 'border-rose-500 ring-2 ring-rose-500/30 shadow-md bg-rose-50/20 dark:bg-rose-950/20'
                      : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-rose-300 dark:hover:border-rose-700/50 hover:shadow'
                  } flex items-center justify-between`}
                >
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      {selectedClassId ? 'Class Absent Days' : 'Branch Absent Days'}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-2">{classReportData.stats.absent} Days</h3>
                  </div>
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl flex items-center justify-center">
                    <AlertTriangle size={18} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedKpiFilter(prev => prev === 'partial' ? null : 'partial')}
                  title="Click to view students with Partial attendance"
                  className={`bg-white dark:bg-slate-900 p-6 rounded-[32px] border transition-all cursor-pointer select-none ${
                    selectedKpiFilter === 'partial'
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-md bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700/50 hover:shadow'
                  } flex items-center justify-between`}
                >
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      {selectedClassId ? 'Class Partial Days' : 'Branch Partial Days'}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-2">{classReportData.stats.partial || 0} Days</h3>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl flex items-center justify-center">
                    <AlertCircle size={18} />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      {selectedClassId ? 'Class Attendance Rate' : 'Branch Attendance Rate'}
                    </p>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-2">{classReportData.stats.percentage}%</h3>
                  </div>
                  <div className="w-10 h-10 bg-brand-50 dark:bg-brand-950/40 text-brand-600 rounded-xl flex items-center justify-center">
                    <TrendingUp size={18} />
                  </div>
                </div>
              </div>

              {/* Class students list table - displayed ONLY when an Attendance Summary Card is clicked */}
              {selectedKpiFilter && (
                <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
                  <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {selectedClassId ? 'Class' : 'Branch'} <span className="font-extrabold capitalize">{selectedKpiFilter}</span> Students ({displayedClassStudents.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedKpiFilter(null)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Hide List ✕
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                          <th className="px-8 py-5">Student Name</th>
                          <th className="px-8 py-5">Class Name</th>
                          <th className="px-8 py-5">Status</th>
                          <th className="px-8 py-5">Session</th>
                          <th className="px-8 py-5">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayedClassStudents.map((item) => {
                          const matchingRecs = item.studentRecs?.filter(r => r.status?.toLowerCase() === selectedKpiFilter?.toLowerCase()) || [];
                          const statusVal = matchingRecs[0]?.status || (selectedKpiFilter ? selectedKpiFilter.charAt(0).toUpperCase() + selectedKpiFilter.slice(1) : '-');
                          const sessions = Array.from(new Set(matchingRecs.map(r => r.session).filter(Boolean)));
                          const sessionText = sessions.length > 0 
                            ? sessions.join(', ') 
                            : (matchingRecs.some(r => r.attendanceType === 'Daily') ? 'Daily' : '-');
                          
                          const descArr = (item.descriptions?.[selectedKpiFilter] || []).concat(matchingRecs.map(r => r.description).filter(Boolean));
                          const descText = Array.from(new Set(descArr)).filter(Boolean).join(', ');

                          return (
                            <tr key={item.student._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                              <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100">
                                <div>{item.student.fullName}</div>
                                {(item.student.studentCode || item.student.rollNumber) && (
                                  <div className="text-xs font-mono text-slate-400 font-normal mt-0.5">
                                    {item.student.studentCode || item.student.rollNumber}
                                  </div>
                                )}
                              </td>
                              <td className="px-8 py-6 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {item.className}
                              </td>
                              <td className="px-8 py-6 text-sm">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                                  statusVal === 'Present'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                    : statusVal === 'Late'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60'
                                    : statusVal === 'Absent'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60'
                                }`}>
                                  {statusVal}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                {sessionText !== '-' ? (
                                  <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                                    {sessionText}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">-</span>
                                )}
                              </td>
                              <td className="px-8 py-6 text-sm text-slate-600 dark:text-slate-300">
                                {descText ? (
                                  <span className="inline-block px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs">
                                    {descText}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {displayedClassStudents.length === 0 && (
                          <tr>
                            <td colSpan="5" className="px-8 py-12 text-center text-slate-400 text-sm font-semibold">
                              No students found with {selectedKpiFilter} attendance for this date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          {!selectedClassId && !selectedBranchId && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
              Please select a Branch or Class to view attendance ledger records.
            </div>
          )}        </div>
      )}

      {/* ========================================== */}
      {/* 4. INDIVIDUAL STUDENT REPORT TAB */}
      {/* ========================================== */}
      {activeTab === 'student' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Autocomplete Search input */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative">
            <label className="block text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2">
              <User size={14} className="text-brand-500" /> Lookup Student by Name, Code or Phone
            </label>
            <div className="relative">
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 border border-slate-200/60 dark:border-slate-700">
                <Search size={18} className="text-slate-400 mr-3" />
                <input
                  type="text"
                  placeholder="Type student name, student code or guardian phone number..."
                  value={studentSearchQuery}
                  onChange={(e) => {
                    setStudentSearchQuery(e.target.value);
                    setShowStudentSuggestions(true);
                  }}
                  onFocus={() => setShowStudentSuggestions(true)}
                  className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-bold"
                />
              </div>

              {showStudentSuggestions && individualSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {individualSuggestions.map(student => (
                    <button
                      key={student._id}
                      onClick={() => {
                        setSelectedStudent(student);
                        setStudentSearchQuery(`${student.fullName} (${student.studentCode || student.rollNumber || ''})`);
                        setShowStudentSuggestions(false);
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-sm font-bold text-slate-800 dark:text-slate-200 transition-all"
                    >
                      <div>
                        <div>{student.fullName}</div>
                        <div className="text-xs text-slate-400 font-mono">Code: {student.studentCode || student.rollNumber || '-'} | Guardian Phone: {student.guardianId?.phone || student.fatherPhone || '-'}</div>
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedStudent && studentReportData ? (
            <>
              {/* Warnings Banner if active */}
              {studentReportData.warnings.hasWarnings && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/80 rounded-[32px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm animate-in slide-in-from-top duration-500">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight">System Attendance Warning Triggered</h3>
                      <p className="text-sm font-bold text-amber-700/85 dark:text-amber-500/80 mt-1 max-w-2xl">
                        Student has reached {studentReportData.stats.absent} Absences or {studentReportData.stats.late} Late records. Click the WhatsApp button to alert the parent/guardian phone number.
                      </p>
                    </div>
                  </div>
                  {studentReportData.warnings.waUrl && (
                    <a
                      href={studentReportData.warnings.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 text-center shrink-0"
                    >
                      <MessageSquare size={16} /> WhatsApp Guardian
                    </a>
                  )}
                </div>
              )}

              {/* Profile details & summary card grids */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. Basic Information Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-8 space-y-6">
                  <h3 className="text-base font-black dark:text-white uppercase tracking-tight pb-3 border-b border-slate-100 dark:border-slate-800">
                    Basic Profile Info
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Student Name</span>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{selectedStudent.fullName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Student Code / ID</span>
                      <p className="text-sm font-semibold text-slate-650 dark:text-slate-400 font-mono">{selectedStudent.studentCode || selectedStudent.rollNumber || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Current Academic Class</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {classes.find(c => String(c._id) === String(selectedStudent.classId?._id || selectedStudent.classId))?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Guardian/Responsible Name</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{studentReportData.warnings.parentName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Guardian Phone Number</span>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-mono">{studentReportData.warnings.parentPhone || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Stats Summary KPI Card */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-8 space-y-6 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-black dark:text-white uppercase tracking-tight">
                      Attendance Performance Summary
                    </h3>
                    
                    {/* Export */}
                    <div className="flex gap-2">
                      <button
                        onClick={exportStudentCSV}
                        className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all"
                        title="Export CSV"
                      >
                        <FileSpreadsheet size={16} />
                      </button>
                      <button
                        onClick={exportStudentPDF}
                        className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all"
                        title="Export PDF"
                      >
                        <FileText size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 my-auto py-6">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Audited</span>
                      <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{studentReportData.stats.total} Days</h4>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Present</span>
                      <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1">{studentReportData.stats.present} Days</h4>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Late</span>
                      <h4 className="text-2xl font-black text-amber-600 dark:text-amber-450 mt-1">{studentReportData.stats.late} Days</h4>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Absent</span>
                      <h4 className="text-2xl font-black text-rose-600 dark:text-rose-450 mt-1">{studentReportData.stats.absent} Days</h4>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">Total Rate Percentage</span>
                      <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-0.5">{studentReportData.stats.percentage}%</p>
                    </div>
                    
                    <div className="h-2 w-48 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0 hidden sm:block">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 rounded-full" style={{ width: `${studentReportData.stats.percentage}%` }} />
                    </div>
                  </div>

                </div>

              </div>

              {/* Detailed history table */}
              <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-5">Date</th>
                        <th className="px-8 py-5">Class</th>
                        <th className="px-8 py-5">Session</th>
                        <th className="px-8 py-5">Status</th>
                        <th className="px-8 py-5">Arrival Time</th>
                        <th className="px-8 py-5">Description</th>
                        <th className="px-8 py-5">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {studentReportData.history.map((rec) => (
                        <tr key={rec._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                            {rec.date}
                          </td>
                          <td className="px-8 py-6 text-sm font-semibold text-slate-705 dark:text-slate-300">
                            {classLabel(rec.classId, 'Deleted Class')}
                          </td>
                          <td className="px-8 py-6 text-xs font-bold text-slate-500">
                            {rec.session || 'Morning'}
                          </td>
                          <td className="px-8 py-6">
                            <select
                              value={rec.status}
                              onChange={(e) => handleHistoryStatusUpdate(rec._id, e.target.value, rec.arrivalTime)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] uppercase border cursor-pointer outline-none transition-all ${
                                rec.status === 'Present'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                                  : rec.status === 'Late'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
                              }`}
                            >
                              <option value="Present">✓ Present</option>
                              <option value="Late">⏰ Late</option>
                              <option value="Absent">✖ Absent</option>
                            </select>
                          </td>
                          <td className="px-8 py-6 text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {rec.status === 'Late' ? (
                              <input
                                type="text"
                                placeholder="08:30"
                                defaultValue={rec.arrivalTime || '08:30'}
                                onBlur={(e) => handleHistoryStatusUpdate(rec._id, rec.status, e.target.value)}
                                className="w-24 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold outline-none"
                              />
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-sm font-semibold text-slate-700 dark:text-slate-300 max-w-xs">
                            {rec.description
                              ? <span className="whitespace-pre-wrap break-words">{rec.description}</span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-8 py-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {rec.markedBy?.fullName || 'System Admin'}
                          </td>
                        </tr>
                      ))}
                      {studentReportData.history.length === 0 && (
                        <tr>
                          <td colSpan="7" className="px-8 py-12 text-center text-slate-400 text-sm font-semibold">
                            No attendance history found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                <Search size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">No Student Selected</h3>
              <p className="text-slate-400 text-sm font-semibold mt-2 max-w-sm mx-auto">
                Please search for a student to view their detailed attendance report profile and trigger warning notifications.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default StudentAttendanceReport;
