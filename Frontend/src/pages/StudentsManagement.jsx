import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Edit2, Trash2, Users, Search, CheckCircle2, UserPlus, Loader2, DollarSign, IdCard as IdCardIcon, Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
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
  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardStudent, setCardStudent] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    fatherName: '',
    fatherPhone: '',
    guardianId: '',
    guardianName: '',
    guardianPhone: '',
    guardianAlternatePhone: '',
    guardianRelationship: 'Father',
    registrationDate: toDateInput()
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resStudents, resClasses, resGuardians] = await Promise.all([
        api.get('/students'),
        api.get('/classes'),
        api.get('/guardians')
      ]);
      setData(resStudents.data || []);
      setClasses(resClasses.data || []);
      setGuardians(resGuardians.data || []);
    } catch (error) {
      console.error("Failed to fetch students data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time lookup for Who Pays the Fee by phone number
  useEffect(() => {
    const phone = (formData.guardianPhone || '').trim();
    if (!phone || phone.length < 3) {
      setFoundGuardian(null);
      setFormData(prev => ({ ...prev, guardianId: '' }));
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingGuardian(true);
        const res = await api.get(`/guardians?phone=${encodeURIComponent(phone)}`);
        const existing = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;

        if (existing) {
          setFoundGuardian(existing);
          setFormData(prev => ({
            ...prev,
            guardianId: existing._id,
            guardianName: existing.fullName || prev.guardianName,
            guardianRelationship: existing.relationship || prev.guardianRelationship || 'Father'
          }));
        } else {
          setFoundGuardian(null);
          setFormData(prev => ({ ...prev, guardianId: '' }));
        }
      } catch (err) {
        console.error('Phone lookup failed:', err);
      } finally {
        setIsSearchingGuardian(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.guardianPhone]);

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

      // If no existing fee payer matched but phone is supplied, create or fetch the fee payer
      if (!guardianId && formData.guardianPhone) {
        const guardianPayload = {
          fullName: formData.guardianName || formData.fatherName || 'Fee Payer',
          phone: formData.guardianPhone,
          alternatePhone: formData.guardianAlternatePhone,
          relationship: formData.guardianRelationship || 'Father'
        };

        const guardianRes = await api.post('/guardians', guardianPayload);
        guardianId = guardianRes.data?._id || guardianRes.data?.id;
      } else if (guardianId && formData.guardianPhone) {
        // Keep both fee-payer phone numbers up to date when editing a student.
        await api.put(`/guardians/${guardianId}`, {
          fullName: formData.guardianName || formData.fatherName || 'Fee Payer',
          phone: formData.guardianPhone,
          alternatePhone: formData.guardianAlternatePhone,
          relationship: formData.guardianRelationship || 'Father'
        });
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
    const gName = item.guardianId?.fullName || '';
    const gPhone = item.guardianId?.phone || '';
    const className = classSearchText(item.classId);
    return (
      (item.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.studentCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.fatherName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.fatherPhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      gName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gPhone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.guardianId?.alternatePhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      className.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

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

      {/* Search Bar */}
      <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-800 shadow-sm max-w-md">
        <Search size={18} className="text-slate-400 mr-3" />
        <input
          type="text"
          placeholder="Search students by name, roll no, fee payer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-5">Full Name</th>
                <th className="px-8 py-5">Student ID</th>
                <th className="px-8 py-5">Class</th>
                <th className="px-8 py-5">Student Fee ($)</th>
                <th className="px-8 py-5">Who Pays the Fee</th>
                <th className="px-8 py-5">Registration Date</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.map((item) => {
                const guardian = item.guardianId && typeof item.guardianId === 'object' ? item.guardianId : null;
                const cls = item.classId && typeof item.classId === 'object' ? item.classId : classes.find(c => c._id === item.classId);
                const studentFee = item.monthlyFee !== undefined ? item.monthlyFee : (item.fee || 0);

                return (
                  <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-8 py-6 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.fullName}
                    </td>
                    {/* Issued by the system; shown read-only so it can never be typed over. */}
                    <td className="px-8 py-6 font-mono text-sm font-black text-brand-600 dark:text-brand-400">
                      {item.studentCode || '-'}
                    </td>
                    <td className="px-8 py-6 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {cls?.name || '-'}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ${Number(studentFee).toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {guardian ? (
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{guardian.fullName}</span>
                          <span className="text-xs text-slate-400 block font-mono">{guardian.phone}{guardian.alternatePhone ? ` / ${guardian.alternatePhone}` : ''} ({guardian.relationship || 'Payer'})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 opacity-60">Not Linked</span>
                      )}
                    </td>
                    {/* The date already stored on the record; nothing is generated here. */}
                    <td className="px-8 py-6 text-sm font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {item.registrationDate ? fmtRegDate(item.registrationDate) : <span className="text-slate-400 opacity-60">N/A</span>}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button onClick={() => setCardStudent(item)} title="ID Card" className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-all">
                          <IdCardIcon size={16} />
                        </button>
                        <button onClick={() => openEditModal(item)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-all">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(item)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-8 py-10 text-center text-slate-400 text-sm font-medium">No students found. Click "Add New Student" to register a student.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    <div>
                      <span className="font-bold">Existing Fee Payer Found:</span> {foundGuardian.fullName} ({foundGuardian.relationship || 'Payer'}). Reusing record & linking student.
                    </div>
                  </div>
                )}

                {!foundGuardian && formData.guardianPhone && formData.guardianPhone.trim().length >= 3 && !isSearchingGuardian && (
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
