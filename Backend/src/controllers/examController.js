const asyncHandler = require('../middleware/asyncHandler');
const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

// ---- Grading ---------------------------------------------------------------

// Standard percentage → letter grade + grade point.
const gradeFor = (pct) => {
    if (pct >= 90) return { grade: 'A+', point: 4.0 };
    if (pct >= 80) return { grade: 'A', point: 3.7 };
    if (pct >= 70) return { grade: 'B', point: 3.0 };
    if (pct >= 60) return { grade: 'C', point: 2.0 };
    if (pct >= 50) return { grade: 'D', point: 1.0 };
    return { grade: 'F', point: 0.0 };
};

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Merge an exam's subjects, the class students, and any saved marks into a
// ranked result sheet with totals, percentage, grade and pass/fail per student.
const buildResultSheet = (exam, students, resultDocs) => {
    const isMidTerm = exam.examType === 'Mid-Term';
    const isFinal = exam.examType === 'Final';
    const examMax = Number(exam.maxMarks) || 0;

    const getSubjectFullMarks = (sub) => {
        if (examMax > 0) return examMax;
        if (isMidTerm) return Number(sub.nisfiFullMarks || sub.fullMarks || 40);
        if (isFinal) return Number(sub.nihaayiFullMarks || sub.fullMarks || 60);
        return Number(sub.fullMarks || (Number(sub.nisfiFullMarks || 40) + Number(sub.nihaayiFullMarks || 60)));
    };

    const getSubjectPassMarks = (sub) => {
        const full = getSubjectFullMarks(sub);
        const pass = Number(sub.passMarks || 0);
        return (pass > 0 && pass < full) ? pass : Math.round(full * 0.4);
    };

    const byStudent = new Map();
    resultDocs.forEach((r) => byStudent.set(String(r.studentId), r));

    const subjects = exam.subjects || [];
    const totalFull = subjects.reduce((sum, s) => sum + getSubjectFullMarks(s), 0);

    const rows = students.map((s) => {
        const doc = byStudent.get(String(s._id));
        const marksMap = new Map();
        (doc?.marks || []).forEach((m) => marksMap.set(m.subject, m));

        let totalObtained = 0;
        let failedSubjects = 0;
        let enteredCount = 0;
        const subjectResults = subjects.map((sub) => {
            const m = marksMap.get(sub.name);
            const hasRecord = !!m && (
                m.isAbsent ||
                (m.nisfi !== undefined && m.nisfi !== null && m.nisfi !== '') ||
                (m.nihaayi !== undefined && m.nihaayi !== null && m.nihaayi !== '') ||
                (m.marksObtained !== undefined && m.marksObtained !== null && m.marksObtained !== '')
            );

            const isAbsent = !!m?.isAbsent;
            const nisfi = hasRecord ? (isAbsent ? 0 : Number(m?.nisfi || 0)) : null;
            const nihaayi = hasRecord ? (isAbsent ? 0 : Number(m?.nihaayi || 0)) : null;
            const subFull = getSubjectFullMarks(sub);
            const subPass = getSubjectPassMarks(sub);

            let obtained = null;
            if (hasRecord) {
                enteredCount += 1;
                if (!isAbsent) {
                    if (isMidTerm) {
                        obtained = (m?.nisfi !== undefined && m?.nisfi !== null && m?.nisfi !== '') ? nisfi : Number(m?.marksObtained || 0);
                    } else if (isFinal) {
                        obtained = (m?.nihaayi !== undefined && m?.nihaayi !== null && m?.nihaayi !== '') ? nihaayi : Number(m?.marksObtained || 0);
                    } else {
                        obtained = (m?.nisfi !== undefined || m?.nihaayi !== undefined)
                            ? ((nisfi || 0) + (nihaayi || 0))
                            : Number(m?.marksObtained || 0);
                    }
                } else {
                    obtained = 0;
                }
            }

            const passed = hasRecord && !isAbsent && Number(obtained || 0) >= subPass;
            if (hasRecord && !passed) failedSubjects += 1;
            if (hasRecord) totalObtained += Number(obtained || 0);

            const nisfiFull = isMidTerm ? subFull : Number(sub.nisfiFullMarks || 40);
            const nihaayiFull = isFinal ? subFull : Number(sub.nihaayiFullMarks || 60);

            return {
                subject: sub.name,
                nisfiFullMarks: nisfiFull,
                nihaayiFullMarks: nihaayiFull,
                fullMarks: subFull,
                passMarks: subPass,
                nisfi,
                nihaayi,
                marksObtained: obtained,
                isAbsent,
                passed,
                entered: hasRecord
            };
        });

        const entered = enteredCount > 0;
        const percentage = totalFull > 0 ? round1((totalObtained / totalFull) * 100) : 0;
        const average = subjects.length > 0 ? round1(totalObtained / subjects.length) : 0;
        const { grade, point } = gradeFor(percentage);

        return {
            studentId: s._id,
            studentName: s.fullName,
            rollNumber: s.rollNumber || s.studentCode || '',
            entered,
            subjects: subjectResults,
            totalObtained,
            totalFull,
            percentage,
            average,
            grade: entered ? grade : '-',
            point: entered ? point : 0,
            status: entered ? (failedSubjects > 0 ? 'Fail' : 'Pass') : 'Pending',
            failedSubjects,
            remarks: doc?.remarks || ''
        };
    });

    // Rank only students whose marks were entered, by total obtained (desc).
    const ranked = rows
        .filter((r) => r.entered)
        .sort((a, b) => b.totalObtained - a.totalObtained);
    let lastScore = null;
    let lastRank = 0;
    ranked.forEach((r, i) => {
        if (r.totalObtained === lastScore) {
            r.position = lastRank; // tie → same rank
        } else {
            r.position = i + 1;
            lastRank = i + 1;
            lastScore = r.totalObtained;
        }
    });
    rows.forEach((r) => { if (r.position === undefined) r.position = null; });

    // Class summary.
    const gradedRows = rows.filter((r) => r.entered);
    const passed = gradedRows.filter((r) => r.status === 'Pass').length;
    const failed = gradedRows.filter((r) => r.status === 'Fail').length;
    const avgPercentage = gradedRows.length
        ? round1(gradedRows.reduce((sum, r) => sum + r.percentage, 0) / gradedRows.length)
        : 0;
    const topper = ranked[0] || null;

    const summary = {
        totalStudents: rows.length,
        graded: gradedRows.length,
        pending: rows.length - gradedRows.length,
        passed,
        failed,
        passRate: gradedRows.length ? round1((passed / gradedRows.length) * 100) : 0,
        avgPercentage,
        topper: topper ? { studentName: topper.studentName, percentage: topper.percentage } : null,
        totalFull,
        maxMarks: examMax || (isMidTerm ? 40 : isFinal ? 60 : 100)
    };

    return { rows, summary };
};

const classStudents = (classId) =>
    Student.find({ classId, status: { $nin: ['Graduated', 'Exited'] } })
        .select('fullName rollNumber studentCode classId')
        .sort({ fullName: 1 })
        .lean();

// ---- Exam CRUD -------------------------------------------------------------

const getExams = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.status) filter.status = req.query.status;

    // Teachers only see exams for classes they teach (or classes in their branch)
    if (req.user && req.user.role === 'Teacher') {
        const assignedSubjects = await Subject.find({ teacherId: req.user._id, status: 'Active' }).select('classIds');
        const subjectClassIds = [];
        assignedSubjects.forEach(s => {
            if (Array.isArray(s.classIds)) {
                s.classIds.forEach(id => subjectClassIds.push(String(id)));
            }
        });
        const classTeacherClasses = await Class.find({ teacherId: req.user._id }).select('_id');
        classTeacherClasses.forEach(c => subjectClassIds.push(String(c._id)));

        const allowedClassIds = Array.from(new Set(subjectClassIds));
        if (allowedClassIds.length > 0) {
            if (filter.classId) {
                if (!allowedClassIds.includes(String(filter.classId))) {
                    return res.json([]);
                }
            } else {
                filter.classId = { $in: allowedClassIds };
            }
        } else if (req.user.branchId) {
            const branchClassIds = await Class.find({ branchId: req.user.branchId }).distinct('_id');
            filter.classId = { $in: branchClassIds };
        }
    }

    const exams = await Exam.find(filter)
        .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } })
        .sort({ examDate: -1, createdAt: -1 })
        .lean();

    // Attach a quick "results entered" count per exam.
    const counts = await ExamResult.aggregate([
        { $group: { _id: '$examId', n: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    exams.forEach((e) => { e.resultsCount = countMap.get(String(e._id)) || 0; });

    res.json(exams);
});

const getExamById = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id).populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    res.json(exam);
});

const normalizeSubjects = (subjects, examType = 'Mid-Term') => {
    if (!Array.isArray(subjects)) return [];
    return subjects.map((s) => {
        const nisfiFullMarks = Math.max(0, Number(s.nisfiFullMarks) || 40);
        const nihaayiFullMarks = Math.max(0, Number(s.nihaayiFullMarks) || 60);
        let fullMarks = Number(s.fullMarks) || (nisfiFullMarks + nihaayiFullMarks);

        if (examType === 'Mid-Term') {
            fullMarks = nisfiFullMarks;
        } else if (examType === 'Final') {
            fullMarks = nihaayiFullMarks;
        }

        let passMarks = (s.passMarks !== undefined && s.passMarks !== null && s.passMarks !== '')
            ? Number(s.passMarks)
            : Math.round(fullMarks * 0.4);

        if (isNaN(passMarks) || passMarks <= 0 || passMarks >= fullMarks) {
            passMarks = Math.round(fullMarks * 0.4);
        }

        return {
            name: String(s.name || '').trim(),
            nisfiFullMarks,
            nihaayiFullMarks,
            fullMarks,
            passMarks
        };
    }).filter((s) => s.name);
};

const createExam = asyncHandler(async (req, res) => {
    const payload = { ...req.body, createdBy: req.user?._id };

    // Support classIds array or single classId
    let classIds = [];
    if (Array.isArray(payload.classIds) && payload.classIds.length > 0) {
        classIds = payload.classIds.filter(Boolean);
    } else if (payload.classId) {
        classIds = [payload.classId];
    }

    if (!payload.title || !payload.title.trim()) {
        res.status(400);
        throw new Error('Exam title is required');
    }

    if (classIds.length === 0) {
        res.status(400);
        throw new Error('Please select at least one class');
    }

    const maxMarks = Number(payload.maxMarks);
    if (!maxMarks || isNaN(maxMarks) || maxMarks <= 0) {
        res.status(400);
        throw new Error('Maximum marks must be a valid number greater than 0');
    }

    if (payload.startDate && payload.endDate) {
        const start = new Date(payload.startDate);
        const end = new Date(payload.endDate);
        if (end < start) {
            res.status(400);
            throw new Error('End date cannot be earlier than start date');
        }
    }

    // Prevent duplicate exam creation for any of the selected classes
    const existingDuplicates = await Exam.find({
        classId: { $in: classIds },
        examType: payload.examType || 'Mid-Term',
        term: payload.term || '',
        academicYear: payload.academicYear || String(new Date().getFullYear()),
        title: payload.title.trim()
    }).populate('classId', 'name className');

    if (existingDuplicates.length > 0) {
        const duplicatedClassNames = existingDuplicates
            .map(e => e.classId?.name || e.classId?.className || 'Class')
            .join(', ');
        res.status(400);
        throw new Error(`Exam '${payload.title.trim()}' already exists for: ${duplicatedClassNames}`);
    }

    // Load classes to get branchId
    const classDocs = await Class.find({ _id: { $in: classIds } });
    const classMap = new Map(classDocs.map(c => [String(c._id), c]));

    // Query active subjects for these classes
    const activeSubjects = await Subject.find({
        classIds: { $in: classIds },
        status: 'Active'
    }).lean();

    const createdExams = [];
    const isMidTerm = payload.examType === 'Mid-Term';
    const isFinal = payload.examType === 'Final';

    for (const cId of classIds) {
        const classDoc = classMap.get(String(cId));
        const branchId = classDoc?.branchId || payload.branchId || req.user?.branchId;

        // Auto-assign class's subjects if subjects array not provided in form
        let subjects = [];
        if (Array.isArray(payload.subjects) && payload.subjects.length > 0) {
            subjects = normalizeSubjects(payload.subjects, payload.examType);
        } else {
            const classSubs = activeSubjects.filter(s =>
                s.classIds && s.classIds.some(scId => String(scId) === String(cId))
            );
            subjects = classSubs.map(s => {
                const nisfiFull = isMidTerm ? maxMarks : Number(s.nisfiFullMarks || 40);
                const nihaayiFull = isFinal ? maxMarks : Number(s.nihaayiFullMarks || 60);
                const pass = Math.max(1, Math.round(maxMarks * 0.4));
                return {
                    name: s.name.trim(),
                    nisfiFullMarks: nisfiFull,
                    nihaayiFullMarks: nihaayiFull,
                    fullMarks: maxMarks,
                    passMarks: pass
                };
            });
        }

        const examDoc = await Exam.create({
            title: payload.title.trim(),
            examType: payload.examType || 'Mid-Term',
            classId: cId,
            branchId,
            term: payload.term || '',
            academicYear: payload.academicYear || String(new Date().getFullYear()),
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            examDate: payload.startDate ? new Date(payload.startDate) : (payload.examDate ? new Date(payload.examDate) : new Date()),
            maxMarks,
            subjects,
            description: payload.description || '',
            status: 'Scheduled',
            createdBy: req.user?._id
        });

        createdExams.push(examDoc);
    }

    const populatedList = await Exam.find({ _id: { $in: createdExams.map(e => e._id) } })
        .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });

    res.status(201).json(createdExams.length === 1 ? populatedList[0] : populatedList);
});

const updateExam = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (payload.maxMarks !== undefined) {
        const maxMarks = Number(payload.maxMarks);
        if (isNaN(maxMarks) || maxMarks <= 0) {
            res.status(400);
            throw new Error('Maximum marks must be a valid number greater than 0');
        }
        payload.maxMarks = maxMarks;
    }
    if (payload.startDate && payload.endDate) {
        if (new Date(payload.endDate) < new Date(payload.startDate)) {
            res.status(400);
            throw new Error('End date cannot be earlier than start date');
        }
    }
    if (payload.startDate && !payload.examDate) {
        payload.examDate = new Date(payload.startDate);
    }
    if (payload.subjects) {
        payload.subjects = normalizeSubjects(payload.subjects, payload.examType);
    }
    const exam = await Exam.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
        .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    res.json(exam);
});

const deleteExam = asyncHandler(async (req, res) => {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    // Clean up all results tied to this exam.
    await ExamResult.deleteMany({ examId: exam._id });
    res.json({ message: 'Exam and its results removed' });
});

// ---- Results ---------------------------------------------------------------

// Full ranked result sheet for an exam (all class students + their marks).
const getExamResults = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id).populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    const [students, resultDocs] = await Promise.all([
        classStudents(exam.classId._id || exam.classId),
        ExamResult.find({ examId: exam._id }).lean()
    ]);
    const { rows, summary } = buildResultSheet(exam, students, resultDocs);

    let teacherAssignedSubjects = null;
    if (req.user && req.user.role === 'Teacher') {
        const classId = exam.classId._id || exam.classId;
        const assignedSubjects = await Subject.find({
            teacherId: req.user._id,
            status: 'Active',
            $or: [
                { classIds: classId },
                { classIds: { $size: 0 } },
                { classIds: { $exists: false } }
            ]
        }).select('name');
        teacherAssignedSubjects = assignedSubjects.map(s => s.name);
    }

    res.json({ exam, results: rows, summary, teacherAssignedSubjects });
});

// Save / update marks for many students at once (mark entry grid).
const saveExamResults = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    const results = Array.isArray(req.body?.results) ? req.body.results : [];
    if (!results.length) {
        res.status(400);
        throw new Error('No marks provided');
    }

    // Teacher authorization check: teacher only submits marks for their assigned subjects
    if (req.user && req.user.role === 'Teacher') {
        const classId = exam.classId._id || exam.classId;
        const assignedSubjects = await Subject.find({
            teacherId: req.user._id,
            status: 'Active',
            $or: [
                { classIds: classId },
                { classIds: { $size: 0 } },
                { classIds: { $exists: false } }
            ]
        }).select('name');
        const allowedNames = new Set(assignedSubjects.map(s => s.name.trim().toLowerCase()));

        if (allowedNames.size === 0) {
            res.status(403);
            throw new Error('Not authorized: You are not assigned to this class or its subjects.');
        }

        // Verify teacher only submits marks for their assigned subjects
        for (const r of results) {
            for (const m of (r.marks || [])) {
                if (m && !m.isAbsent && (
                    (m.nisfi !== undefined && m.nisfi !== null && m.nisfi !== '') ||
                    (m.nihaayi !== undefined && m.nihaayi !== null && m.nihaayi !== '') ||
                    (m.marksObtained !== undefined && m.marksObtained !== null && m.marksObtained !== '')
                )) {
                    const subName = (m.subject || '').trim().toLowerCase();
                    if (!allowedNames.has(subName)) {
                        res.status(403);
                        throw new Error(`Not authorized to enter marks for subject: ${m.subject}`);
                    }
                }
            }
        }
    }

    const isMidTerm = exam.examType === 'Mid-Term';
    const isFinal = exam.examType === 'Final';
    const examMax = Number(exam.maxMarks) || 100;

    const validSubjects = new Map((exam.subjects || []).map((s) => [s.name, s]));

    // Validation: marks bounds check (0 <= mark <= configured max)
    for (const r of results) {
        if (!r.studentId) continue;
        for (const m of (Array.isArray(r.marks) ? r.marks : [])) {
            if (m.isAbsent) continue;
            const subDef = validSubjects.get(m.subject);
            const subNisfiMax = isMidTerm ? examMax : Number(subDef?.nisfiFullMarks || 40);
            const subNihaayiMax = isFinal ? examMax : Number(subDef?.nihaayiFullMarks || 60);
            const subFullMax = examMax;

            if (m.nisfi !== undefined && m.nisfi !== null && m.nisfi !== '') {
                const n = Number(m.nisfi);
                if (isNaN(n) || n < 0 || n > subNisfiMax) {
                    res.status(400);
                    throw new Error(`Dhibcaha Nisfi ee maaddada '${m.subject}' (${m.nisfi}) waa inay u dhexeeyaan 0 iyo ${subNisfiMax}.`);
                }
            }
            if (m.nihaayi !== undefined && m.nihaayi !== null && m.nihaayi !== '') {
                const f = Number(m.nihaayi);
                if (isNaN(f) || f < 0 || f > subNihaayiMax) {
                    res.status(400);
                    throw new Error(`Dhibcaha Nihaayi ee maaddada '${m.subject}' (${m.nihaayi}) waa inay u dhexeeyaan 0 iyo ${subNihaayiMax}.`);
                }
            }
            if (m.marksObtained !== undefined && m.marksObtained !== null && m.marksObtained !== '') {
                const mo = Number(m.marksObtained);
                if (isNaN(mo) || mo < 0 || mo > (isMidTerm ? subNisfiMax : isFinal ? subNihaayiMax : subFullMax)) {
                    res.status(400);
                    throw new Error(`Wadarta dhibcaha ee '${m.subject}' (${m.marksObtained}) kama badnaan karto ${isMidTerm ? subNisfiMax : isFinal ? subNihaayiMax : subFullMax}.`);
                }
            }
        }
    }

    let saved = 0;
    for (const r of results) {
        if (!r.studentId) continue;

        // Preserve existing marks for other subjects
        const existingDoc = await ExamResult.findOne({ examId: exam._id, studentId: r.studentId });
        const mergedMarksMap = new Map();
        if (existingDoc && Array.isArray(existingDoc.marks)) {
            existingDoc.marks.forEach(em => {
                const item = em.toObject ? em.toObject() : em;
                mergedMarksMap.set(item.subject, item);
            });
        }

        const incomingMarks = Array.isArray(r.marks) ? r.marks : [];
        for (const m of incomingMarks) {
            if (!validSubjects.has(m.subject)) continue;

            const hasExplicitValue = m.isAbsent ||
                (m.nisfi !== undefined && m.nisfi !== null && m.nisfi !== '') ||
                (m.nihaayi !== undefined && m.nihaayi !== null && m.nihaayi !== '') ||
                (m.marksObtained !== undefined && m.marksObtained !== null && m.marksObtained !== '');

            if (hasExplicitValue) {
                const isAbsent = !!m.isAbsent;
                const nisfi = isAbsent ? 0 : Math.max(0, Number(m.nisfi) || 0);
                const nihaayi = isAbsent ? 0 : Math.max(0, Number(m.nihaayi) || 0);

                let marksObtained = 0;
                if (!isAbsent) {
                    if (isMidTerm) {
                        marksObtained = (m.nisfi !== undefined && m.nisfi !== null && m.nisfi !== '') ? nisfi : Math.max(0, Number(m.marksObtained) || 0);
                    } else if (isFinal) {
                        marksObtained = (m.nihaayi !== undefined && m.nihaayi !== null && m.nihaayi !== '') ? nihaayi : Math.max(0, Number(m.marksObtained) || 0);
                    } else {
                        marksObtained = (m.nisfi !== undefined || m.nihaayi !== undefined)
                            ? (nisfi + nihaayi)
                            : Math.max(0, Number(m.marksObtained) || 0);
                    }
                }

                mergedMarksMap.set(m.subject, {
                    subject: m.subject,
                    nisfi,
                    nihaayi,
                    marksObtained,
                    isAbsent
                });
            }
        }

        const marks = Array.from(mergedMarksMap.values());
        await ExamResult.findOneAndUpdate(
            { examId: exam._id, studentId: r.studentId },
            {
                examId: exam._id,
                studentId: r.studentId,
                classId: exam.classId,
                marks,
                remarks: r.remarks || (existingDoc?.remarks || ''),
                createdBy: req.user?._id
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        saved += 1;
    }

    // Once marks exist the exam is at least "Completed" (unless already published).
    if (exam.status === 'Scheduled' || exam.status === 'Ongoing') {
        exam.status = 'Completed';
        await exam.save();
    }

    res.json({ message: `Saved marks for ${saved} student(s)`, saved, status: exam.status });
});

// One student's report card, including their rank in the class.
const getStudentResult = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id).populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    const [students, resultDocs] = await Promise.all([
        classStudents(exam.classId._id || exam.classId),
        ExamResult.find({ examId: exam._id }).lean()
    ]);
    const { rows, summary } = buildResultSheet(exam, students, resultDocs);
    const row = rows.find((r) => String(r.studentId) === String(req.params.studentId));
    if (!row) {
        res.status(404);
        throw new Error('Student is not part of this exam class');
    }
    res.json({ exam, result: row, classSize: summary.graded, summary });
});

const publishExam = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }
    exam.status = req.body?.status === 'Completed' ? 'Completed' : 'Published';
    await exam.save();
    const populated = await Exam.findById(exam._id).populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    res.json(populated);
});

// Class Cumulative Broadsheet (Merges Mid-Term + Final dynamically using configured max marks)
const getClassBroadsheet = asyncHandler(async (req, res) => {
    const { classId } = req.params;
    const { term, academicYear } = req.query;

    const classDoc = await Class.findById(classId).populate('branchId', 'name').lean();
    if (!classDoc) {
        res.status(404);
        throw new Error('Class not found');
    }

    const examQuery = { classId };
    if (term) examQuery.term = term;
    if (academicYear) examQuery.academicYear = academicYear;

    const exams = await Exam.find(examQuery).lean();
    const midTermExam = exams.find((e) => e.examType === 'Mid-Term');
    const finalExam = exams.find((e) => e.examType === 'Final');
    const combinedExam = exams.find((e) => e.examType === 'Combined');

    // Dynamic Maximums: Use configured maxMarks or fall back to standard 40/60
    const nisfiMax = Number(midTermExam?.maxMarks || 40);
    const nihaayiMax = Number(finalExam?.maxMarks || 60);
    const combinedMax = nisfiMax + nihaayiMax;

    let baseSubjects = [];
    if (midTermExam?.subjects?.length) {
        baseSubjects = midTermExam.subjects;
    } else if (finalExam?.subjects?.length) {
        baseSubjects = finalExam.subjects;
    } else if (combinedExam?.subjects?.length) {
        baseSubjects = combinedExam.subjects;
    } else {
        const subDocs = await Subject.find({ classIds: classId, status: 'Active' }).lean();
        baseSubjects = subDocs.map((s) => ({
            name: s.name,
            nisfiFullMarks: nisfiMax,
            nihaayiFullMarks: nihaayiMax,
            fullMarks: combinedMax,
            passMarks: Math.round(combinedMax * 0.4)
        }));
    }

    // Normalized subjects with dynamic maximums
    const subjects = baseSubjects.map((s) => {
        const sNisfi = Number(midTermExam?.maxMarks || s.nisfiFullMarks || nisfiMax);
        const sNihaayi = Number(finalExam?.maxMarks || s.nihaayiFullMarks || nihaayiMax);
        const sCombined = sNisfi + sNihaayi;
        const sPass = Math.max(1, Math.round(sCombined * 0.4));
        return {
            name: s.name,
            nisfiFullMarks: sNisfi,
            nihaayiFullMarks: sNihaayi,
            fullMarks: sCombined,
            passMarks: sPass
        };
    });

    const students = await classStudents(classId);
    const examIds = exams.map((e) => e._id);
    const allResults = await ExamResult.find({ examId: { $in: examIds } }).lean();

    const resultsByStudentExam = new Map();
    allResults.forEach((r) => {
        resultsByStudentExam.set(`${r.studentId}_${r.examId}`, r);
    });

    const totalFull = subjects.reduce((sum, s) => sum + Number(s.fullMarks || combinedMax), 0);

    const rows = students.map((s) => {
        let totalObtained = 0;
        let failedSubjects = 0;
        let entered = false;

        const midResult = midTermExam ? resultsByStudentExam.get(`${s._id}_${midTermExam._id}`) : null;
        const finalResult = finalExam ? resultsByStudentExam.get(`${s._id}_${finalExam._id}`) : null;
        const combResult = combinedExam ? resultsByStudentExam.get(`${s._id}_${combinedExam._id}`) : null;

        if (midResult || finalResult || combResult) entered = true;

        const midMap = new Map((midResult?.marks || []).map((m) => [m.subject, m]));
        const finalMap = new Map((finalResult?.marks || []).map((m) => [m.subject, m]));
        const combMap = new Map((combResult?.marks || []).map((m) => [m.subject, m]));

        const subjectResults = subjects.map((sub) => {
            const mM = midMap.get(sub.name);
            const fM = finalMap.get(sub.name);
            const cM = combMap.get(sub.name);

            let nisfi = 0;
            let nihaayi = 0;

            if (mM) nisfi = Number(mM.nisfi ?? mM.marksObtained ?? 0);
            if (fM) nihaayi = Number(fM.nihaayi ?? fM.marksObtained ?? 0);
            if (cM) {
                if (!mM) nisfi = Number(cM.nisfi ?? 0);
                if (!fM) nihaayi = Number(cM.nihaayi ?? 0);
            }

            const obtained = nisfi + nihaayi;
            const full = Number(sub.fullMarks || combinedMax);
            const pass = Number(sub.passMarks || Math.round(full * 0.4));
            const passed = obtained >= pass;
            if (entered && !passed) failedSubjects += 1;
            totalObtained += obtained;

            return {
                subject: sub.name,
                nisfi,
                nihaayi,
                nisfiFullMarks: sub.nisfiFullMarks,
                nihaayiFullMarks: sub.nihaayiFullMarks,
                fullMarks: full,
                passMarks: pass,
                marksObtained: obtained,
                passed
            };
        });

        const percentage = totalFull > 0 ? round1((totalObtained / totalFull) * 100) : 0;
        const average = subjects.length > 0 ? round1(totalObtained / subjects.length) : 0;
        const { grade, point } = gradeFor(percentage);

        return {
            studentId: s._id,
            studentName: s.fullName,
            rollNumber: s.rollNumber || s.studentCode || '',
            entered,
            subjects: subjectResults,
            totalObtained,
            totalFull,
            percentage,
            average,
            grade: entered ? grade : '-',
            point: entered ? point : 0,
            status: entered ? (failedSubjects > 0 ? 'Fail' : 'Pass') : 'Pending'
        };
    });

    const ranked = rows.filter((r) => r.entered).sort((a, b) => b.totalObtained - a.totalObtained);
    let lastScore = null;
    let lastRank = 0;
    ranked.forEach((r, i) => {
        if (r.totalObtained === lastScore) {
            r.position = lastRank;
        } else {
            r.position = i + 1;
            lastRank = i + 1;
            lastScore = r.totalObtained;
        }
    });

    const gradedRows = rows.filter((r) => r.entered);
    const summary = {
        totalStudents: students.length,
        graded: gradedRows.length,
        passed: gradedRows.filter((r) => r.status === 'Pass').length,
        failed: gradedRows.filter((r) => r.status === 'Fail').length,
        avgPercentage: gradedRows.length ? round1(gradedRows.reduce((sum, r) => sum + r.percentage, 0) / gradedRows.length) : 0,
        topper: ranked[0] ? { studentName: ranked[0].studentName, percentage: ranked[0].percentage } : null,
        totalFull,
        nisfiMax,
        nihaayiMax,
        combinedMax
    };

    res.json({
        class: classDoc,
        subjects,
        exams: { midTerm: midTermExam, final: finalExam, combined: combinedExam },
        config: {
            nisfiMax,
            nihaayiMax,
            combinedMax
        },
        results: rows,
        summary
    });
});

// ---- Timetable / Schedule --------------------------------------------------

// Get timetable for a class, grouped by exams and sorted by date/startTime
const getClassTimetable = asyncHandler(async (req, res) => {
    const { classId } = req.params;
    const { term, academicYear, branchId } = req.query;

    const classDoc = await Class.findById(classId).populate('branchId', 'name').lean();
    if (!classDoc) {
        res.status(404);
        throw new Error('Class not found');
    }

    const query = { classId };
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (branchId) query.branchId = branchId;

    const exams = await Exam.find(query)
        .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } })
        .sort({ startDate: 1, examDate: 1, createdAt: 1 })
        .lean();

    // Sort subjects within each exam by date and startTime
    exams.forEach(e => {
        if (Array.isArray(e.subjects)) {
            // Only include subjects that have been scheduled with a valid date
            e.subjects = e.subjects.filter(s => Boolean(s.date || s.examDate));
            e.subjects.sort((a, b) => {
                const dateA = a.date || (a.examDate ? new Date(a.examDate).toISOString().slice(0, 10) : '') || '';
                const dateB = b.date || (b.examDate ? new Date(b.examDate).toISOString().slice(0, 10) : '') || '';
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                const timeA = a.startTime || '00:00';
                const timeB = b.startTime || '00:00';
                return timeA.localeCompare(timeB);
            });
        }
    });

    res.json({ class: classDoc, exams });
});

// Helper to derive day name from date string if not explicitly given
const deriveDayName = (dStr, explicitDay) => {
    if (explicitDay && String(explicitDay).trim()) return String(explicitDay).trim();
    if (!dStr) return '';
    try {
        const parts = String(dStr).slice(0, 10).split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts.map(Number);
            const dt = new Date(y, m - 1, d);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[dt.getDay()] || '';
        }
        const dt = new Date(dStr);
        if (!isNaN(dt.getTime())) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[dt.getDay()] || '';
        }
    } catch (e) {
        // ignore
    }
    return '';
};

// Helper to derive end time from start time and duration if not explicitly given
const deriveEndTime = (startTime, durationMinutes, explicitEndTime) => {
    if (explicitEndTime && String(explicitEndTime).trim()) return String(explicitEndTime).trim();
    if (!startTime) return '';
    try {
        const clean = String(startTime).trim();
        const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!match) return '';
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = match[3] ? parseInt(match[3], 10) : 0;
        const dur = parseInt(durationMinutes, 10);
        if (isNaN(dur) || dur <= 0) return '';
        const totalMinutes = hours * 60 + minutes + dur;
        const endH = Math.floor(totalMinutes / 60) % 24;
        const endM = totalMinutes % 60;
        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } catch (e) {
        return '';
    }
};

// Add or schedule a subject on an exam (supports single subject or array of subjects for a day)
const addExamScheduleSubject = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }

    const items = Array.isArray(req.body?.subjects)
        ? req.body.subjects
        : (Array.isArray(req.body) ? req.body : [req.body]);

    if (!items.length) {
        res.status(400);
        throw new Error('No subjects provided to schedule');
    }

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const { name, code, day, session, date, examDate, startTime, endTime, duration, fullMarks, nisfiFullMarks, nihaayiFullMarks, passMarks, room } = item;

        if (!name || !String(name).trim()) {
            res.status(400);
            throw new Error(items.length > 1 ? `Subject name is required for subject #${idx + 1}` : 'Subject name is required');
        }

        const cleanName = String(name).trim();

        // Check if subject already exists on this exam
        const existingIdx = (exam.subjects || []).findIndex(s => s.name.trim().toLowerCase() === cleanName.toLowerCase());
        const existing = existingIdx !== -1 ? exam.subjects[existingIdx] : null;

        // If it already exists AND has a schedule date, prevent duplicate
        if (existing && (existing.date || existing.examDate)) {
            res.status(400);
            throw new Error(`Subject '${cleanName}' is already scheduled for this exam`);
        }

        const dur = Number(duration);
        if (isNaN(dur) || dur <= 0) {
            res.status(400);
            throw new Error('Duration must be a positive number greater than 0');
        }

        const isMidTerm = exam.examType === 'Mid-Term';
        const isFinal = exam.examType === 'Final';
        const maxAllowed = Number(fullMarks) || Number(exam.maxMarks) || 100;
        const nisfi = isMidTerm ? maxAllowed : (Number(nisfiFullMarks) || 40);
        const nihaayi = isFinal ? maxAllowed : (Number(nihaayiFullMarks) || 60);
        const pass = Number(passMarks) || Math.round(maxAllowed * 0.4);

        const parsedExamDate = date ? new Date(date) : (examDate ? new Date(examDate) : (exam.startDate || exam.examDate));
        const targetDateStr = date || (parsedExamDate ? new Date(parsedExamDate).toISOString().slice(0, 10) : '');
        const resolvedDay = deriveDayName(targetDateStr, day);
        const cleanStart = startTime ? String(startTime).trim() : '09:00';
        const resolvedEndTime = deriveEndTime(cleanStart, dur, endTime);
        const resolvedSession = session ? String(session).trim() : (items.length > 1 ? (idx === 0 ? 'Qaybta 1aad' : `Qaybta ${idx + 1}aad`) : 'Qaybta 1aad');

        if (existing) {
            // Update the existing unscheduled entry with schedule details
            existing.code = code ? String(code).trim() : (existing.code || '');
            existing.day = resolvedDay;
            existing.session = resolvedSession;
            existing.date = targetDateStr;
            existing.examDate = parsedExamDate;
            existing.startTime = cleanStart;
            existing.endTime = resolvedEndTime;
            existing.duration = dur;
            existing.fullMarks = maxAllowed;
            existing.nisfiFullMarks = nisfi;
            existing.nihaayiFullMarks = nihaayi;
            existing.passMarks = pass;
            if (room) existing.room = String(room).trim();
        } else {
            exam.subjects.push({
                name: cleanName,
                code: code ? String(code).trim() : '',
                day: resolvedDay,
                session: resolvedSession,
                date: targetDateStr,
                examDate: parsedExamDate,
                startTime: cleanStart,
                endTime: resolvedEndTime,
                duration: dur,
                fullMarks: maxAllowed,
                nisfiFullMarks: nisfi,
                nihaayiFullMarks: nihaayi,
                passMarks: pass,
                room: room ? String(room).trim() : ''
            });
        }
    }

    await exam.save();
    const updated = await Exam.findById(exam._id).populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    res.status(201).json(updated);
});

// Update a scheduled subject entry on an exam
const updateExamScheduleSubject = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }

    const { subjectId } = req.params;
    const sub = exam.subjects.id ? exam.subjects.id(subjectId) : exam.subjects.find(s => String(s._id) === String(subjectId));

    if (!sub) {
        res.status(404);
        throw new Error('Scheduled subject not found');
    }

    const { name, code, day, session, date, examDate, startTime, endTime, duration, fullMarks, nisfiFullMarks, nihaayiFullMarks, passMarks, room } = req.body;

    if (name) {
        const cleanName = String(name).trim();
        const duplicate = exam.subjects.some(s => String(s._id) !== String(subjectId) && s.name.trim().toLowerCase() === cleanName.toLowerCase());
        if (duplicate) {
            res.status(400);
            throw new Error(`Another subject named '${cleanName}' already exists on this exam`);
        }
        sub.name = cleanName;
    }

    if (code !== undefined) sub.code = String(code).trim();
    if (session !== undefined) sub.session = String(session).trim();
    if (day !== undefined) {
        sub.day = String(day).trim();
    } else if (date !== undefined) {
        sub.day = deriveDayName(date, sub.day);
    }

    if (date !== undefined) sub.date = String(date).trim();
    if (date) sub.examDate = new Date(date);
    else if (examDate) sub.examDate = new Date(examDate);

    if (startTime !== undefined) sub.startTime = String(startTime).trim();
    if (duration !== undefined) {
        const dur = Number(duration);
        if (isNaN(dur) || dur <= 0) {
            res.status(400);
            throw new Error('Duration must be a positive number greater than 0');
        }
        sub.duration = dur;
    }

    if (endTime !== undefined) {
        sub.endTime = String(endTime).trim();
    } else if (startTime !== undefined || duration !== undefined) {
        sub.endTime = deriveEndTime(sub.startTime, sub.duration, sub.endTime);
    }

    if (fullMarks !== undefined) sub.fullMarks = Math.max(1, Number(fullMarks));
    if (nisfiFullMarks !== undefined) sub.nisfiFullMarks = Math.max(0, Number(nisfiFullMarks));
    if (nihaayiFullMarks !== undefined) sub.nihaayiFullMarks = Math.max(0, Number(nihaayiFullMarks));
    if (passMarks !== undefined) sub.passMarks = Math.max(0, Number(passMarks));
    if (room !== undefined) sub.room = String(room).trim();

    await exam.save();
    const updated = await Exam.findById(exam._id).populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });
    res.json(updated);
});

// Remove a scheduled subject from an exam
const deleteExamScheduleSubject = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
        res.status(404);
        throw new Error('Exam not found');
    }

    const { subjectId } = req.params;

    if (subjectId === 'unscheduled') {
        const initialLen = exam.subjects.length;
        exam.subjects = exam.subjects.filter(s => Boolean(s.date || s.examDate));
        await exam.save();
        return res.json({
            message: 'All unscheduled subjects removed from exam',
            removedCount: initialLen - exam.subjects.length,
            subjects: exam.subjects
        });
    }

    const initialLen = exam.subjects.length;
    exam.subjects = exam.subjects.filter(s => String(s._id) !== String(subjectId) && s.name !== subjectId);

    if (exam.subjects.length === initialLen) {
        res.status(404);
        throw new Error('Subject not found in exam');
    }

    await exam.save();
    res.json({ message: 'Subject removed from schedule', subjects: exam.subjects });
});

// @desc    Get examinations analytics & summary dashboard
// @route   GET /api/exams/dashboard-summary
// @access  Private
const getExamDashboardSummary = asyncHandler(async (req, res) => {
    let examFilter = {};
    const isTeacher = req.user && req.user.role === 'Teacher';

    // If teacher, scope to classes where the teacher is assigned
    if (isTeacher) {
        const assignedSubjects = await Subject.find({ teacherId: req.user._id, status: 'Active' }).select('classIds');
        const subjectClassIds = [];
        assignedSubjects.forEach(s => {
            if (Array.isArray(s.classIds)) {
                s.classIds.forEach(id => subjectClassIds.push(String(id)));
            }
        });
        const classTeacherClasses = await Class.find({ teacherId: req.user._id }).select('_id');
        classTeacherClasses.forEach(c => subjectClassIds.push(String(c._id)));

        const allowedClassIds = Array.from(new Set(subjectClassIds));
        if (allowedClassIds.length > 0) {
            examFilter.classId = { $in: allowedClassIds };
        } else if (req.user.branchId) {
            const branchClassIds = await Class.find({ branchId: req.user.branchId }).select('_id');
            examFilter.classId = { $in: branchClassIds.map(c => c._id) };
        }
    } else if (req.user && req.user.branchId && req.user.role === 'Branch Manager') {
        const branchClassIds = await Class.find({ branchId: req.user.branchId }).select('_id');
        examFilter.classId = { $in: branchClassIds.map(c => c._id) };
    }

    const exams = await Exam.find(examFilter)
        .populate('classId', 'name className grade branchId')
        .sort({ createdAt: -1 })
        .lean();

    const examIds = exams.map(e => e._id);
    const results = await ExamResult.find({ examId: { $in: examIds } })
        .select('examId studentId classId marks remarks')
        .lean();

    // Map results by examId
    const resultsByExam = new Map();
    results.forEach(r => {
        const eid = String(r.examId);
        if (!resultsByExam.has(eid)) resultsByExam.set(eid, []);
        resultsByExam.get(eid).push(r);
    });

    // Counts by status & type
    let scheduledCount = 0;
    let ongoingCount = 0;
    let completedCount = 0;
    let publishedCount = 0;
    const typeDistribution = { 'Mid-Term': 0, 'Final': 0, 'Monthly': 0, 'Weekly': 0, 'Quiz': 0, 'Combined': 0 };

    exams.forEach(e => {
        const s = e.status || 'Scheduled';
        if (s === 'Scheduled') scheduledCount++;
        else if (s === 'Ongoing') ongoingCount++;
        else if (s === 'Completed') completedCount++;
        else if (s === 'Published') publishedCount++;

        const t = e.examType || 'Mid-Term';
        if (typeDistribution[t] !== undefined) typeDistribution[t]++;
        else typeDistribution[t] = 1;
    });

    // Overall Marks Entry Progress & Performance
    let totalExpectedMarks = 0;
    let totalMarksEntered = 0;
    let totalStudentsAssessed = new Set();
    let passingStudentsCount = 0;
    let totalStudentsEvaluated = 0;
    let totalScoresSum = 0;
    let totalMarksScoredCount = 0;

    const gradeDistribution = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

    // Detailed exam cards
    const examProgressList = [];

    for (const exam of exams) {
        const examResults = resultsByExam.get(String(exam._id)) || [];
        const subjectCount = (exam.subjects && exam.subjects.length) || 1;
        const studentCount = examResults.length;

        let examEnteredCount = 0;
        let examTotalPossible = studentCount * subjectCount;
        let examPassCount = 0;

        examResults.forEach(r => {
            totalStudentsAssessed.add(String(r.studentId));
            let studentTotalMarks = 0;
            let studentMaxMarks = 0;
            let studentHasAnyMark = false;

            if (Array.isArray(r.marks)) {
                r.marks.forEach(m => {
                    const hasVal = m.marksObtained !== null && m.marksObtained !== undefined && !m.isAbsent;
                    if (hasVal) {
                        examEnteredCount++;
                        totalMarksEntered++;
                        studentHasAnyMark = true;
                        studentTotalMarks += Number(m.marksObtained) || 0;
                        totalScoresSum += Number(m.marksObtained) || 0;
                        totalMarksScoredCount++;
                    }
                    studentMaxMarks += Number(exam.maxMarks) || 100;
                });
            }

            if (studentHasAnyMark && studentMaxMarks > 0) {
                const pct = Math.round((studentTotalMarks / studentMaxMarks) * 100);
                totalStudentsEvaluated++;
                if (pct >= 50) {
                    passingStudentsCount++;
                    examPassCount++;
                }

                if (pct >= 90) gradeDistribution['A+']++;
                else if (pct >= 80) gradeDistribution['A']++;
                else if (pct >= 70) gradeDistribution['B']++;
                else if (pct >= 60) gradeDistribution['C']++;
                else if (pct >= 50) gradeDistribution['D']++;
                else gradeDistribution['F']++;
            }
        });

        totalExpectedMarks += examTotalPossible;

        const completionPct = examTotalPossible > 0 ? Math.round((examEnteredCount / examTotalPossible) * 100) : 0;
        const passRatePct = studentCount > 0 ? Math.round((examPassCount / studentCount) * 100) : 0;

        examProgressList.push({
            _id: exam._id,
            title: exam.title,
            examType: exam.examType,
            term: exam.term,
            academicYear: exam.academicYear,
            maxMarks: exam.maxMarks,
            status: exam.status || 'Scheduled',
            class: exam.classId,
            subjectsCount: subjectCount,
            studentsCount: studentCount,
            marksEntered: examEnteredCount,
            totalExpectedMarks: examTotalPossible,
            completionRate: completionPct,
            passRate: passRatePct,
            startDate: exam.startDate,
            endDate: exam.endDate
        });
    }

    const overallCompletionRate = totalExpectedMarks > 0
        ? Math.round((totalMarksEntered / totalExpectedMarks) * 100)
        : (exams.length > 0 ? 0 : 100);

    const overallPassRate = totalStudentsEvaluated > 0
        ? Math.round((passingStudentsCount / totalStudentsEvaluated) * 100)
        : 0;

    const averageScore = totalMarksScoredCount > 0
        ? Math.round((totalScoresSum / totalMarksScoredCount) * 10) / 10
        : 0;

    // Distinct classes count
    const distinctClassIds = new Set(exams.map(e => String(e.classId?._id || e.classId)).filter(Boolean));

    res.json({
        summary: {
            totalExams: exams.length,
            scheduledCount,
            ongoingCount,
            completedCount,
            publishedCount,
            totalClasses: distinctClassIds.size,
            totalStudentsAssessed: totalStudentsAssessed.size,
            overallCompletionRate,
            overallPassRate,
            averageScore,
            totalMarksEntered,
            totalExpectedMarks,
            typeDistribution,
            gradeDistribution
        },
        recentExams: examProgressList.slice(0, 10),
        isTeacher
    });
});

module.exports = {
    getExams,
    getExamById,
    createExam,
    updateExam,
    deleteExam,
    getExamResults,
    saveExamResults,
    getStudentResult,
    publishExam,
    getClassBroadsheet,
    getClassTimetable,
    addExamScheduleSubject,
    updateExamScheduleSubject,
    deleteExamScheduleSubject,
    getExamDashboardSummary
};
