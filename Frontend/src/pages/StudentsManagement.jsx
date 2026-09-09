import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, X, Edit2, Trash2, Users, Search, CheckCircle2, UserPlus, Loader2, 
  DollarSign, IdCard as IdCardIcon, Download, Upload, FileSpreadsheet, AlertCircle,
  LayoutGrid, List, Filter, GraduationCap, Phone, Calendar, BookOpen, Sparkles, User as UserIcon
} from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../components/common/alerts/useAlert';
import IdCard from '../components/IdCard.jsx';
import { classLabel, classSearchText } from '../utils/classLabel';

// The workbook columns mirror the registration form exactly. Student ID is
// exported for reference but never imported — the server issues it (1001, 1002…)
// and ignores any value sent by a client.
const SHEET_COLUMNS = [
  { header: 'Student ID', key: 'studentId', width: 12 },
  { header: 'Full Name', key: 'fullName', width: 26 },
  { header: 'Class', key: 'className', width: 18 },
  { header: 'Gender', key: 'gender', width: 10 },
  { header: 'Monthly Fee', key: 'monthlyFee', width: 13 },
  { header: 'Father Name', key: 'fatherName', width: 22 },
  { header: 'Father Phone', key: 'fatherPhone', width: 16 },
  { header: 'Fee Payer Name', key: 'payerName', width: 22 },
  { header: 'Fee Payer Phone', key: 'payerPhone', width: 18 },
  { header: 'Fee Payer Alt Phone', key: 'payerAltPhone', width: 18 },
  { header: 'Relationship', key: 'relationship', width: 14 },
  { header: 'Status', key: 'status', width: 12 }
];

const SHEET_NAME = 'Students';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ExcelJS is large and only needed when someone actually imports or exports, so
// it is fetched on demand rather than shipped in the main bundle.
const loadExcelJS = async () => (await import('exceljs')).default;

// A cell can come back as a string, a number, or a rich object (formula result,
// hyperlink). Flatten all of those to a plain trimmed string.
const cellText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();
    if (value.richText) return value.richText.map(r => r.text).join('').trim();
    return '';
  }
  return String(value).trim();
};

const downloadWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const styleHeaderRow = (sheet) => {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
};

// Same normalisation the backend uses when matching a payer by phone, so an
// import cannot create a second payer for a number already stored in another
// local format (0615550001 vs 615550001).
const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

// Clean text: strip non-breaking spaces, collapse whitespace, lowercase, trim
const cleanStr = (val) =>
  String(val ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Get the base name and branch if written as "Class (Branch)"
const extractBaseAndBranch = (val) => {
  const text = String(val ?? '').replace(/\u00A0/g, ' ').trim();
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(text);
  if (!match) return { base: text, branch: '' };
  return { base: match[1].trim(), branch: match[2].trim() };
};

const getClassInfo = (c) => {
  const rawName = String(c?.name || c?.className || '').trim();
  const parsed = extractBaseAndBranch(rawName);
  const branchName = c?.branchId?.name ? String(c.branchId.name).trim() : parsed.branch;
  const fullLabel = classLabel(c, rawName);
  return {
    rawName,
    base: parsed.base,
    branch: branchName,
    fullLabel
  };
};

// Resolves a sheet cell to exactly one class.
// Flexible and forgiving:
// 1. Matches exact label "mustawo 2 part (fr2)" or exact name "mustawo 2 part"
// 2. Supports "Class Name" alone when unique in the institute
// 3. Handles classes stored with "(fr2)" in their name field
// 4. Normalizes all whitespace, Unicode spaces, and case differences
const resolveClassFromCell = (cell, classes = []) => {
  const rawCell = String(cell ?? '').replace(/\u00A0/g, ' ').trim();
  const known = () => classes.map(c => classLabel(c)).filter(Boolean).join(', ') || '(no classes exist yet)';

  if (!rawCell) {
    return { error: 'Class is blank in this row' };
  }

  const cleanCell = cleanStr(rawCell);

  // 1. Direct match: Exact match on fullLabel, name, className, or rawName
  const directMatch = classes.find(c => {
    const info = getClassInfo(c);
    return (
      cleanStr(info.fullLabel) === cleanCell ||
      cleanStr(c.name) === cleanCell ||
      cleanStr(c.className) === cleanCell ||
      cleanStr(info.rawName) === cleanCell
    );
  });
  if (directMatch) {
    return { cls: directMatch };
  }

  // 2. Parse the cell value into base name and branch
  const { base: inputBase, branch: inputBranch } = extractBaseAndBranch(rawCell);
  const cleanInputBase = cleanStr(inputBase);
  const cleanInputBranch = cleanStr(inputBranch);

  // 3. Find candidate classes whose base name or raw name matches inputBase
  const candidates = classes.filter(c => {
    const info = getClassInfo(c);
    return (
      cleanStr(info.base) === cleanInputBase ||
      cleanStr(info.rawName) === cleanInputBase ||
      cleanStr(c.name) === cleanInputBase ||
      cleanStr(c.className) === cleanInputBase ||
      cleanStr(info.fullLabel) === cleanInputBase
    );
  });

  if (candidates.length > 0) {
    // If the input sheet cell specified a branch:
    if (cleanInputBranch) {
      const branchMatch = candidates.filter(c => {
        const info = getClassInfo(c);
        return (
          cleanStr(info.branch) === cleanInputBranch ||
          cleanStr(info.fullLabel).includes(`(${cleanInputBranch})`) ||
          cleanStr(info.rawName).includes(`(${cleanInputBranch})`)
        );
      });
      if (branchMatch.length === 1) return { cls: branchMatch[0] };
      if (branchMatch.length > 1) {
        return { error: `"${rawCell}" matches multiple classes in branch "${inputBranch}".` };
      }
      // If branch didn't strictly match, but only 1 candidate class with that name exists, accept it
      if (candidates.length === 1) {
        return { cls: candidates[0] };
      }
      const options = candidates.map(c => classLabel(c)).join(', ');
      return { error: `No class "${inputBase}" in branch "${inputBranch}". Did you mean: ${options}?` };
    }

    // If no branch was specified in the Excel cell:
    // If only 1 class in the entire system carries this name, safely accept it!
    if (candidates.length === 1) {
      return { cls: candidates[0] };
    }

    // If multiple branches have a class with the same name, ask user to disambiguate:
    const options = candidates.map(c => classLabel(c)).join(', ');
    return {
      error: `Class "${inputBase}" exists in multiple branches: ${options}. Please write it as "Class Name (Branch)", e.g. "${classLabel(candidates[0])}"`
    };
  }

  // 4. Loose match: if the cell contains the class name or class contains the cell
  const looseCandidates = classes.filter(c => {
    const info = getClassInfo(c);
    const cLabel = cleanStr(info.fullLabel);
    const cBase = cleanStr(info.base);
    return (
      (cleanInputBase.length >= 3 && cLabel.includes(cleanInputBase)) ||
      (cBase.length >= 3 && cleanInputBase.includes(cBase))
    );
  });

  if (looseCandidates.length === 1) {
    return { cls: looseCandidates[0] };
  }

  return {
    error: `Class "${rawCell}" does not exist. Available: ${known()}`
  };
};

const phoneVariants = (value) => {
  const d = digitsOnly(value);
  if (!d) return [];
  const set = new Set([d]);
  // Match with and without a leading zero whatever the length. Stored numbers
  // are not always 9 or 10 digits, so keying off length alone would miss an
  // existing payer and create a duplicate for the same person.
  if (d.startsWith('0')) set.add(d.replace(/^0+/, ''));
  else set.add(`0${d}`);
  return [...set].filter(Boolean);
};

const StudentsManagement = () => {
  const { showAlert, showConfirm } = useAlert();
  const [data, setData] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cachedStudentsData');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [classes, setClasses] = useState(() => {
    try {
      const cached = sessionStorage.getItem('cachedClassesData');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(() => !sessionStorage.getItem('cachedStudentsData'));
  const [cardStudent, setCardStudent] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('studentsViewMode') || 'table';
  });

  const [foundGuardian, setFoundGuardian] = useState(null);
  const [isSearchingGuardian, setIsSearchingGuardian] = useState(false);

  // A Date (or ISO string) rendered as the YYYY-MM-DD a date input expects,
  // using local time so the day never shifts across the UTC boundary.
  const toDateInput = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Registration date for display. Read straight from the stored value's own
  // date part rather than through a locale conversion, so the day shown is
  // always the day that was saved and can never shift by a timezone offset.
  const fmtRegDate = (value) => {
    if (!value) return 'N/A';
    const iso = typeof value === 'string' ? value : new Date(value).toISOString();
    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!parts) return 'N/A';
    const [, y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const [formData, setFormData] = useState({
    fullName: '',
    classId: '',
    gender: 'Male',
    monthlyFee: '',
    fee: '',
    fatherName: '',
    fatherPhone: '',
    guardianPhone: '',
    guardianName: '',
    guardianRelationship: 'Father',
    guardianAltPhone: '',
    registrationDate: toDateInput(new Date())
  });

  const fetchData = async () => {
    try {
      if (!data.length) setLoading(true);
      const [resStudents, resClasses, resGuardians] = await Promise.all([
        api.get('/students'),
        api.get('/classes'),
        api.get('/guardians')
      ]);
      const studentsList = resStudents.data || [];
      const classesList = resClasses.data || [];
      setData(studentsList);
      setClasses(classesList);
      setGuardians(resGuardians.data || []);
      sessionStorage.setItem('cachedStudentsData', JSON.stringify(studentsList));
      sessionStorage.setItem('cachedClassesData', JSON.stringify(classesList));
    } catch (error) {
      console.error("Failed to fetch students data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time lookup for Who Pays the Fee by phone number (primary or second number)
  useEffect(() => {
    const phone = (formData.guardianPhone || '').trim();
    const altPhone = (formData.guardianAlternatePhone || '').trim();
    const searchPhone = phone || altPhone;

    if (!searchPhone || searchPhone.length < 3) {
      setFoundGuardian(null);
      setFormData(prev => (prev.guardianId ? { ...prev, guardianId: '' } : prev));
      return;
    }

    // Skip redundant network call if the already found guardian matches either number
    if (
      foundGuardian &&
      (phone === foundGuardian.phone ||
        phone === foundGuardian.alternatePhone ||
        altPhone === foundGuardian.phone ||
        altPhone === foundGuardian.alternatePhone)
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingGuardian(true);
        const res = await api.get(`/guardians?phone=${encodeURIComponent(searchPhone)}`);
        const existing = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;

        if (existing) {
          setFoundGuardian(existing);
          setFormData(prev => ({
            ...prev,
            guardianId: existing._id,
            guardianName: existing.fullName || prev.guardianName,
            guardianRelationship: existing.relationship || prev.guardianRelationship || 'Father',
            guardianPhone: existing.phone || prev.guardianPhone || '',
            guardianAlternatePhone: existing.alternatePhone || prev.guardianAlternatePhone || ''
          }));
        } else {
          setFoundGuardian(null);
          setFormData(prev => (prev.guardianId ? { ...prev, guardianId: '' } : prev));
        }
      } catch (err) {
        console.error('Phone lookup failed:', err);
      } finally {
        setIsSearchingGuardian(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.guardianPhone, formData.guardianAlternatePhone, foundGuardian]);

  // ── Excel template ────────────────────────────────────────────────────────
  // Same columns as the export, so a filled-in template and an exported file are
  // interchangeable as import sources.
  const handleDownloadTemplate = async () => {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.columns = SHEET_COLUMNS;
    styleHeaderRow(sheet);

    sheet.addRow({
      studentId: '(leave blank)',
      fullName: 'Ahmed Ali',
      className: classes[0] ? classLabel(classes[0]) : 'Tamhiid 3 (FR1)',
      gender: 'Male',
      monthlyFee: 20,
      fatherName: 'Ali Hassan',
      fatherPhone: '0615551234',
      payerName: 'Ali Hassan',
      payerPhone: '0615551234',
      payerAltPhone: '',
      relationship: 'Father',
      status: 'Active'
    });
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF94A3B8' } };

    const notes = workbook.addWorksheet('Instructions');
    notes.columns = [{ width: 96 }];
    [
      'HOW TO USE THIS TEMPLATE',
      '',
      'One row = one student. Delete the grey example row before uploading.',
      '',
      'Student ID  — leave blank. The system issues it automatically (1001, 1002, …).',
      '              Any value typed here is ignored.',
      'Full Name   — required.',
      'Class       — required. Write either "Class Name" or "Class Name (Branch)", e.g. Tamhiid 3 or Tamhiid 3 (FR1).',
      '              If multiple branches have a class with the same name, specify the branch.',
      `              Existing classes: ${classes.map(c => classLabel(c)).filter(Boolean).join(', ') || '(none yet)'}`,
      'Gender      — Male, Female or Other. Defaults to Male.',
      'Monthly Fee — number. Defaults to 0.',
      'Father Name / Father Phone — both required.',
      '',
      'Fee Payer Phone — this is how a payer is identified.',
      '  · If the number already exists, the student is linked to that payer.',
      '  · If not, a new payer is created once and reused for later rows.',
      '  · Leaving it blank creates a student with no payer.',
      '',
      'Fee Payer Name / Alt Phone / Relationship — used only when creating a new payer.',
      'An existing payer is never renamed, because that name is shared by all their students.',
      '',
      'Status — Active, Inactive or Graduated. Defaults to Active.'
    ].forEach(line => notes.addRow([line]));
    notes.getRow(1).font = { bold: true, size: 13 };

    await downloadWorkbook(workbook, 'Student_Import_Template.xlsx');
    showAlert({ type: 'success', title: 'Template downloaded', message: 'Fill in one row per student, then use Import Excel.' });
  };

  // ── Export ────────────────────────────────────────────────────────────────
  // One row per student using the registration fields plus the payer resolved
  // through guardianId. The file can be re-imported as-is.
  const handleExport = async () => {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.columns = SHEET_COLUMNS;
    styleHeaderRow(sheet);

    data.forEach((item) => {
      const cls = classes.find(c => String(c._id) === String(item.classId?._id || item.classId));
      const guardian = item.guardianId && typeof item.guardianId === 'object' ? item.guardianId : null;
      sheet.addRow({
        studentId: item.studentCode || '',
        fullName: item.fullName || '',
        className: cls ? classLabel(cls, '') : '',
        gender: item.gender || '',
        monthlyFee: Number(item.monthlyFee ?? item.fee ?? 0),
        fatherName: item.fatherName || '',
        // Phones are written as text so a leading zero is never dropped.
        fatherPhone: item.fatherPhone || '',
        payerName: guardian?.fullName || '',
        payerPhone: guardian?.phone || '',
        payerAltPhone: guardian?.alternatePhone || '',
        relationship: guardian?.relationship || '',
        status: item.status || 'Active'
      });
    });

    ['fatherPhone', 'payerPhone', 'payerAltPhone'].forEach(key => {
      sheet.getColumn(key).numFmt = '@';
    });

    await downloadWorkbook(workbook, `Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showAlert({
      type: 'success',
      title: 'Export complete',
      message: `${data.length} student${data.length === 1 ? '' : 's'} exported to Excel.`
    });
  };

  // ── Import ────────────────────────────────────────────────────────────────
  // Resolve the payer by phone exactly as registration does: find an existing
  // record first, reuse it when found, create one only when needed. An existing
  // payer is never updated — that would rewrite the name for every student
  // already attached to them.
  const resolveGuardian = async (row, cache) => {
    const phone = row.payerPhone;
    if (!phone) return null;

    const variants = phoneVariants(phone);
    const cacheKey = variants.join('|');
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    for (const variant of variants) {
      const { data: found } = await api.get(`/guardians?phone=${encodeURIComponent(variant)}`);
      if (Array.isArray(found) && found.length > 0) {
        cache.set(cacheKey, found[0]._id);
        return found[0]._id;
      }
    }

    const { data: created } = await api.post('/guardians', {
      fullName: row.payerName || row.fatherName || 'Fee Payer',
      phone,
      alternatePhone: row.payerAltPhone || '',
      relationship: row.relationship || 'Father'
    });
    const id = created?._id || created?.id || null;
    if (id) cache.set(cacheKey, id);
    return id;
  };

  // A student is treated as already present when the same name sits in the same
  // class under the same father's phone. There is no unique key on students in
  // the schema, so this is the closest match to a real-world duplicate.
  const studentKey = (name, classId, fatherPhone) =>
    `${String(name).trim().toLowerCase()}|${String(classId)}|${digitsOnly(fatherPhone)}`;

  const importRow = async (row, existingKeys, cache) => {
    if (!row.fullName) throw new Error('Full Name is required');

    // Matched on class name AND branch together, so "Tamhiid 3 (FR1)" and
    // "Tamhiid 3 (FR2)" land on their own class rather than whichever was
    // created first.
    const { cls, error: classError } = resolveClassFromCell(row.className, classes);
    if (classError) throw new Error(classError);

    // Father name and phone are optional here, exactly as on the registration
    // form: each falls back to the fee payer's details before being stored.
    const fatherName = row.fatherName || row.payerName || '';
    const fatherPhone = row.fatherPhone || row.payerPhone || '';

    // Key on the value that actually gets stored, so an exported file re-imports
    // as "already registered" even when the sheet's Father Phone cell was blank.
    const key = studentKey(row.fullName, cls._id, fatherPhone);
    if (existingKeys.has(key)) throw new Error('already registered in this class');

    const guardianId = await resolveGuardian(row, cache);

    // Student ID is deliberately omitted: the server issues it.
    await api.post('/students', {
      fullName: row.fullName,
      classId: cls._id,
      gender: row.gender || 'Male',
      monthlyFee: Number(row.monthlyFee) || 0,
      fee: Number(row.monthlyFee) || 0,
      fatherName,
      fatherPhone,
      guardianId: guardianId || undefined,
      status: row.status || 'Active'
    });

    existingKeys.add(key);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setImporting(true);
    setImportResults(null);

    try {
      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
      if (!sheet) throw new Error('The workbook contains no sheets.');

      // Map by header text so column order does not matter.
      const headerRow = sheet.getRow(1);
      const indexByHeader = {};
      headerRow.eachCell((cell, col) => {
        const match = SHEET_COLUMNS.find(c => c.header.toLowerCase() === cellText(cell.value).toLowerCase());
        if (match) indexByHeader[match.key] = col;
      });

      if (indexByHeader.fullName === undefined) {
        throw new Error('No "Full Name" column found. Use the downloaded template.');
      }

      const rows = [];
      sheet.eachRow((excelRow, rowNumber) => {
        if (rowNumber === 1) return;
        const row = {};
        SHEET_COLUMNS.forEach(({ key }) => {
          const col = indexByHeader[key];
          row[key] = col ? cellText(excelRow.getCell(col).value) : '';
        });
        // Skip the template's grey example row and any blank line.
        if (!row.fullName || row.studentId === '(leave blank)') return;
        rows.push({ ...row, rowNumber });
      });

      if (!rows.length) {
        setImporting(false);
        showAlert({ type: 'warning', title: 'Nothing to import', message: 'No student rows were found in the file.' });
        return;
      }

      const existingKeys = new Set(
        data.map(s => studentKey(s.fullName, s.classId?._id || s.classId, s.fatherPhone))
      );
      const cache = new Map();
      const results = [];

      // Sequential on purpose: rows sharing a payer must reuse the same record
      // rather than racing to create duplicates.
      for (const row of rows) {
        try {
          await importRow(row, existingKeys, cache);
          results.push({ row: row.rowNumber, name: row.fullName, ok: true, message: 'Imported' });
        } catch (error) {
          results.push({
            row: row.rowNumber,
            name: row.fullName || `Row ${row.rowNumber}`,
            ok: false,
            message: error.response?.data?.message || error.message
          });
        }
      }

      await fetchData();
      setImportResults(results);
    } catch (error) {
      showAlert({
        type: 'danger',
        title: 'Could not read the file',
        message: error.message || 'Please upload an .xlsx file created from the template.'
      });
    } finally {
      setImporting(false);
    }
  };


  const openAddModal = () => {
    setEditingItem(null);
    setFoundGuardian(null);
    setFormData({
      fullName: '',
      classId: classes[0]?._id || '',
      gender: 'Male',
      monthlyFee: '',
      fatherName: '',
      fatherPhone: '',
      guardianId: '',
      guardianName: '',
      guardianPhone: '',
      guardianAlternatePhone: '',
      guardianRelationship: 'Father',
      registrationDate: toDateInput()
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const existingG = item.guardianId && typeof item.guardianId === 'object' ? item.guardianId : null;
    setFoundGuardian(existingG);
    setFormData({
      fullName: item.fullName || '',
      classId: item.classId?._id || item.classId || '',
      gender: item.gender || 'Male',
      monthlyFee: item.monthlyFee !== undefined ? item.monthlyFee : (item.fee || ''),
      fatherName: item.fatherName || '',
      fatherPhone: item.fatherPhone || '',
      guardianId: existingG?._id || item.guardianId || '',
      guardianName: existingG?.fullName || '',
      guardianPhone: existingG?.phone || '',
      guardianAlternatePhone: existingG?.alternatePhone || '',
      guardianRelationship: existingG?.relationship || 'Father',
      // Show the date already stored on the record. Only a student that somehow
      // has none falls back to today, so editing never rewrites a saved date.
      registrationDate: item.registrationDate ? toDateInput(item.registrationDate) : toDateInput()
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName) {
      showAlert({ type: 'warning', title: 'Validation Error', message: 'Student full name is required.' });
      return;
    }

    try {
      let guardianId = formData.guardianId;

      // When a fee payer phone is provided, resolve the guardian record:
      // If a guardian with this phone already exists in the system, POST /guardians safely
      // reuses and returns that existing record. If not, it creates a new guardian record.
      // This links the student to the existing guardian without creating duplicates
      // or throwing duplicate phone errors when re-assigning students to existing guardians.
      if (formData.guardianPhone) {
        const guardianPayload = {
          fullName: formData.guardianName || formData.fatherName || 'Fee Payer',
          phone: formData.guardianPhone,
          alternatePhone: formData.guardianAlternatePhone,
          relationship: formData.guardianRelationship || 'Father'
        };

        const guardianRes = await api.post('/guardians', guardianPayload);
        guardianId = guardianRes.data?._id || guardianRes.data?.id || guardianId;
      } else {
        guardianId = undefined;
      }

      const payload = {
        fullName: formData.fullName,
        classId: formData.classId,
        gender: formData.gender,
        monthlyFee: Number(formData.monthlyFee) || 0,
        fee: Number(formData.monthlyFee) || 0,
        fatherName: formData.fatherName || formData.guardianName || '',
        fatherPhone: formData.fatherPhone || formData.guardianPhone || '',
        guardianId: guardianId || undefined,
        // Sent only when the field holds a date, so clearing the input can never
        // blank a registration date already stored against the student.
        ...(formData.registrationDate ? { registrationDate: formData.registrationDate } : {})
      };

      if (editingItem) {
        await api.put(`/students/${editingItem._id}`, payload);
        showAlert({ type: 'success', title: 'Success', message: 'Student updated successfully.' });
      } else {
        await api.post('/students', payload);
        showAlert({ type: 'success', title: 'Success', message: 'New student registered successfully.' });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save student', error);
      showAlert({ type: 'danger', title: 'Error', message: error.response?.data?.message || 'Failed to save student.' });
    }
  };

  const handleDelete = async (item) => {
    const ok = await showConfirm({
      type: 'warning',
      title: 'Delete Student?',
      message: `Are you sure you want to delete "${item.fullName}"? This cannot be undone.`,
      confirmText: 'Yes, delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    try {
      await api.delete(`/students/${item._id}`);
      setData(prev => prev.filter(i => i._id !== item._id));
      showAlert({ type: 'success', title: 'Deleted', message: 'Student deleted successfully.' });
    } catch (error) {
      console.error("Failed to delete student", error);
      showAlert({ type: 'danger', title: 'Error', message: 'Failed to delete student.' });
    }
  };

  const filteredData = data.filter(item => {
    if (selectedClass !== 'ALL') {
      const itemClassId = String(item.classId?._id || item.classId || '');
      if (itemClassId !== String(selectedClass)) {
        return false;
      }
    }

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const gName = item.guardianId?.fullName || '';
    const gPhone = item.guardianId?.phone || '';
    const className = classSearchText(item.classId);
    return (
      (item.fullName || '').toLowerCase().includes(term) ||
      (item.studentCode || '').toLowerCase().includes(term) ||
      (item.fatherName || '').toLowerCase().includes(term) ||
      (item.fatherPhone || '').toLowerCase().includes(term) ||
      gName.toLowerCase().includes(term) ||
      gPhone.toLowerCase().includes(term) ||
      (item.guardianId?.alternatePhone || '').toLowerCase().includes(term) ||
      className.toLowerCase().includes(term)
    );
  });

  // Summary Metrics
  const totalStudentsCount = data.length;
  const filteredStudentsCount = filteredData.length;
  const totalMonthlyFee = filteredData.reduce((acc, curr) => acc + Number(curr.monthlyFee ?? curr.fee ?? 0), 0);

  // Class student counts map for filter
  const classCounts = React.useMemo(() => {
    const map = {};
    data.forEach(s => {
      const cid = String(s.classId?._id || s.classId || '');
      if (cid) {
        map[cid] = (map[cid] || 0) + 1;
      }
    });
    return map;
  }, [data]);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Students...</div>;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1800px] mx-auto animate-in fade-in duration-700 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-[24px] flex items-center justify-center text-emerald-400 shadow-2xl border border-slate-700 ring-4 ring-emerald-400/10">
            <Users size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">Students</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] opacity-80">Student Directory & Fee Management</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <FileSpreadsheet size={16} strokeWidth={3} /> Excel Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing
              ? <><Loader2 size={16} className="animate-spin" /> Importing…</>
              : <><Upload size={16} strokeWidth={3} /> Import Excel</>}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-md hover:bg-slate-800 transition-all active:scale-95"
          >
            <Download size={16} strokeWidth={3} /> Export Excel
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[20px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
          >
            <Plus size={18} strokeWidth={3} /> Add New Student
          </button>
        </div>
      </div>

      {/* Per-row import result */}
      {importResults && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-brand-500" size={20} />
              <div>
                <h3 className="font-black text-slate-900 dark:text-white uppercase text-sm tracking-tight">Import Result</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {importResults.filter(r => r.ok).length} imported ·{' '}
                  {importResults.filter(r => !r.ok).length} skipped · {importResults.length} rows read
                </p>
              </div>
            </div>
            <button
              onClick={() => setImportResults(null)}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Dismiss import result"
            >
              <X size={18} />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {importResults.map((r) => (
              <div key={r.row} className="flex items-start gap-3 px-6 py-3">
                {r.ok
                  ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  : <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Row {r.row} — {r.name}
                  </p>
                  <p className={`text-xs font-semibold ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {r.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar & Class Filter Row - Positioned directly side-by-side matching the user's screenshot */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Bar */}
        <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm flex-1 max-w-md focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          <Search size={18} className="text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search students by name, roll no, fee payer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 border-none p-0 focus:ring-0 font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Class Filter Dropdown directly beside the search bar */}
        <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-800 shadow-sm min-w-[240px] focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          <Filter size={16} className="text-emerald-500 mr-2.5 shrink-0" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer border-none p-0 focus:ring-0"
          >
            <option value="ALL">All Classes / Dhammaan ({data.length})</option>
            {classes.map(c => {
              const count = classCounts[String(c._id)] || 0;
              const label = classLabel(c, c.name || c.className || 'Class');
              return (
                <option key={c._id} value={c._id}>
                  {label} ({count} {count === 1 ? 'student' : 'students'})
                </option>
              );
            })}
          </select>
          {selectedClass !== 'ALL' && (
            <button 
              onClick={() => setSelectedClass('ALL')}
              title="Reset Filter"
              className="ml-2 text-slate-400 hover:text-rose-500 transition-colors p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right side: Count Badge & View Mode Switcher */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:ml-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <span>Showing:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{filteredStudentsCount}</span>
            <span>of</span>
            <span>{totalStudentsCount} Students</span>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <button
              onClick={() => { setViewMode('table'); localStorage.setItem('studentsViewMode', 'table'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List size={15} />
              <span className="hidden md:inline">Table</span>
            </button>
            <button
              onClick={() => { setViewMode('grid'); localStorage.setItem('studentsViewMode', 'grid'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Cards View"
            >
              <LayoutGrid size={15} />
              <span className="hidden md:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Student Directory Content: Table (default) or Cards View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredData.map(item => {
            const guardian = item.guardianId && typeof item.guardianId === 'object' ? item.guardianId : null;
            const cls = item.classId && typeof item.classId === 'object' ? item.classId : classes.find(c => c._id === item.classId);
            const studentFee = item.monthlyFee !== undefined ? item.monthlyFee : (item.fee || 0);

            return (
              <div 
                key={item._id}
                className="group relative bg-white dark:bg-slate-900 rounded-[30px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-card-hover hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Top: Avatar, Name & ID */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="relative w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-base shadow-md shadow-emerald-600/20 ring-2 ring-white dark:ring-slate-800">
                      {(item.fullName || 'A').charAt(0).toUpperCase()}
                      <span className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        item.gender === 'Female' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {item.gender === 'Female' ? 'F' : 'M'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title={item.fullName}>
                        {item.fullName}
                      </h4>
                      <span className="inline-block mt-1 font-mono text-xs font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        {item.studentCode || 'No ID'}
                      </span>
                    </div>
                  </div>

                  {/* Details Badges */}
                  <div className="space-y-2.5 my-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <BookOpen size={14} className="text-emerald-500" /> Class:
                      </span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl truncate max-w-[150px]">
                        {cls?.name || cls?.className || '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <DollarSign size={14} className="text-emerald-500" /> Student Fee:
                      </span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                        ${Number(studentFee).toLocaleString()}
                      </span>
                    </div>

                    {/* Fee Payer Info */}
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <UserIcon size={11} /> Who Pays:
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                          {guardian?.fullName || item.fatherName || 'Not Linked'}
                        </span>
                      </div>
                      {(guardian?.phone || item.fatherPhone) && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                          <span className="text-slate-400 font-medium">Phone:</span>
                          <a 
                            href={`tel:${guardian?.phone || item.fatherPhone}`}
                            className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Phone size={11} />
                            {guardian?.phone || item.fatherPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Calendar size={12} />
                    {item.registrationDate ? fmtRegDate(item.registrationDate) : 'N/A'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setCardStudent(item)} 
                      title="ID Card" 
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-600 dark:text-slate-300 hover:text-emerald-600 rounded-xl transition-colors"
                    >
                      <IdCardIcon size={15} />
                    </button>
                    <button 
                      onClick={() => openEditModal(item)} 
                      title="Edit Student" 
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 rounded-xl transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item)} 
                      title="Delete Student" 
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-600 dark:text-slate-300 hover:text-rose-500 rounded-xl transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table - Fitted cleanly to screen with no horizontal scrolling */
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-4 whitespace-nowrap">Full Name</th>
                  <th className="px-3 py-4 whitespace-nowrap">Student ID</th>
                  <th className="px-3 py-4 whitespace-nowrap">Class</th>
                  <th className="px-3 py-4 whitespace-nowrap">Student Fee ($)</th>
                  <th className="px-4 py-4 whitespace-nowrap">Who Pays the Fee</th>
                  <th className="px-3 py-4 whitespace-nowrap">Registration Date</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.map((item) => {
                  const guardian = item.guardianId && typeof item.guardianId === 'object' ? item.guardianId : null;
                  const cls = item.classId && typeof item.classId === 'object' ? item.classId : classes.find(c => c._id === item.classId);
                  const studentFee = item.monthlyFee !== undefined ? item.monthlyFee : (item.fee || 0);

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm">
                            {(item.fullName || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-slate-900 dark:text-white block truncate max-w-[200px]" title={item.fullName}>
                              {item.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">{item.gender || 'Male'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-xs font-black text-emerald-500 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {item.studentCode || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="truncate block max-w-[140px]" title={cls?.name || cls?.className || '-'}>
                          {cls?.name || cls?.className || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${Number(studentFee).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {guardian ? (
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-[180px]" title={guardian.fullName}>
                              {guardian.fullName}
                            </span>
                            <div className="text-[11px] font-mono truncate max-w-[200px] flex items-center gap-1.5 flex-wrap mt-0.5">
                              {guardian.phone && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{guardian.phone}</span>
                              )}
                              {guardian.alternatePhone && guardian.alternatePhone !== guardian.phone && (
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">• {guardian.alternatePhone}</span>
                              )}
                              {guardian.relationship && (
                                <span className="text-[10px] uppercase font-semibold text-slate-400">({guardian.relationship})</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-[180px]">
                              {item.fatherName || 'Not Linked'}
                            </span>
                            {item.fatherPhone && <span className="text-[11px] text-slate-400 block font-mono">{item.fatherPhone}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {item.registrationDate ? fmtRegDate(item.registrationDate) : <span className="text-slate-400 opacity-60">N/A</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex justify-end items-center gap-1.5">
                          <button onClick={() => setCardStudent(item)} title="ID Card" className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all">
                            <IdCardIcon size={15} />
                          </button>
                          <button onClick={() => openEditModal(item)} title="Edit Student" className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-all">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDelete(item)} title="Delete Student" className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredData.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[36px] border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Arday lama helin</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            {searchTerm || selectedClass !== 'ALL'
              ? 'Wax arday ah kuma jiraan shuruudaha aad dooratay. Isku day inaad fasal kale doorato ama raadinta tirtirto.'
              : 'Wali wax arday ah kuma jiraan nidaamka. Guji "Add New Student" si aad arday cusub u diiwaangeliso.'}
          </p>
          {(searchTerm || selectedClass !== 'ALL') ? (
            <button
              onClick={() => { setSearchTerm(''); setSelectedClass('ALL'); }}
              className="mt-5 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20"
            >
              Nadiifi Shaandheynta (Reset Filters)
            </button>
          ) : (
            <button
              onClick={openAddModal}
              className="mt-5 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20"
            >
              + Diiwaangeli Arday Cusub
            </button>
          )}
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 max-w-xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingItem ? 'Edit Student' : 'Add New Student'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Student Details Section */}
              <div className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 pt-1">
                Student Details
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hassan Ahmed"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Student ID</label>
                  {/* Issued by the server on save and never editable, so this is a
                      display only — there is no input bound to it. */}
                  <div className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-sm font-black text-brand-600 dark:text-brand-400">
                    {editingItem?.studentCode || 'Assigned automatically'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Class</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map(c => (
                      <option key={c._id} value={c._id}>{classLabel(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Registration Date</label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Student Fee ($) *</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={formData.monthlyFee}
                      onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Who Pays the Fee Section */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                  Who Pays the Fee (Fee Payer)
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Fee Payer Phone Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter phone number..."
                        value={formData.guardianPhone}
                        onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                      />
                      {isSearchingGuardian && (
                        <Loader2 className="animate-spin absolute right-3 top-3.5 text-slate-400" size={18} />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Fee Payer Second Phone Number</label>
                    <input
                      type="text"
                      placeholder="Optional second phone number..."
                      value={formData.guardianAlternatePhone}
                      onChange={(e) => setFormData({ ...formData, guardianAlternatePhone: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Who Pays the Fee (Name)</label>
                    <input
                      type="text"
                      placeholder="Fee Payer Full Name"
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Relationship</label>
                  <select
                    value={formData.guardianRelationship}
                    onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Responsible">Responsible</option>
                  </select>
                </div>

                {/* Real-time status indicator banner */}
                {foundGuardian && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className="font-bold">Existing Fee Payer Found:</span> {foundGuardian.fullName} ({foundGuardian.relationship || 'Payer'}). Reusing record & linking student.
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 flex-wrap">
                        {foundGuardian.phone && (
                          <span>Phone 1: <strong className="font-bold underline">{foundGuardian.phone}</strong></span>
                        )}
                        {foundGuardian.alternatePhone && (
                          <span>Phone 2: <strong className="font-bold underline">{foundGuardian.alternatePhone}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!foundGuardian && (formData.guardianPhone || formData.guardianAlternatePhone) && (formData.guardianPhone || formData.guardianAlternatePhone).trim().length >= 3 && !isSearchingGuardian && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center gap-3 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    <UserPlus size={18} className="shrink-0 text-brand-500" />
                    <div>
                      <span className="font-bold">New Fee Payer:</span> No existing fee payer found with this phone number. A new record will be created & linked.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase shadow-lg hover:bg-emerald-700"
                >
                  {editingItem ? 'Save Changes' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IdCard
        open={Boolean(cardStudent)}
        onClose={() => setCardStudent(null)}
        kind="student"
        name={cardStudent?.fullName}
        idNumber={cardStudent?.studentCode}
        rows={[
          { label: 'Class', value: classLabel(cardStudent?.classId, '') },
          { label: 'Guardian', value: cardStudent?.guardianId?.fullName || cardStudent?.fatherName || '' }
        ]}
      />
    </div>
  );
};

export default StudentsManagement;
