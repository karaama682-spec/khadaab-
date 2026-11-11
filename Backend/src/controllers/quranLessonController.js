const QuranLessonRecord = require('../models/QuranLessonRecord');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { QURAN_SURAHS } = require('../data/quranSurahs');

// Day names lookup for Isku-Xir schedule matching
const SOMALI_DAYS = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// @desc    Get all Quran lesson records with optional filtering
// @route   GET /api/quran/lessons
// @access  Private
const getQuranLessonRecords = async (req, res) => {
    try {
        const { search, classId, branchId, status, lessonType, startDate, endDate } = req.query;
        const query = {};

        // If logged-in user is a Teacher, strictly limit records to their assigned classes
        if (req.user && req.user.role === 'Teacher') {
            const teacherClasses = await Class.find({ teacherId: req.user._id });
            const teacherClassIds = teacherClasses.map(c => c._id);
            query.classId = { $in: teacherClassIds };
        } else if (classId) {
            query.classId = classId;
        }

        if (search) {
            query.$or = [
                { studentName: { $regex: search, $options: 'i' } },
                { surahName: { $regex: search, $options: 'i' } },
                { halaqahName: { $regex: search, $options: 'i' } },
                { note: { $regex: search, $options: 'i' } },
                { deviationReason: { $regex: search, $options: 'i' } }
            ];
        }

        if (branchId && branchId !== 'All' && branchId !== 'ALL') {
            query.branchId = branchId;
        }

        if (status) {
            query.status = status;
        }

        if (lessonType) {
            query.lessonType = lessonType;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const records = await QuranLessonRecord.find(query)
            .populate('studentId', 'fullName studentCode rollNumber fatherPhone classId branchId studentType expectedLessonConfig iskuXirConfig')
            .populate('classId', 'name className branchId teacherId')
            .populate('branchId', 'name')
            .populate('teacherId', 'fullName username')
            .sort({ date: -1, createdAt: -1 });

        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching Quran lesson records:', error);
        res.status(500).json({ message: 'Failed to fetch Quran lesson records', error: error.message });
    }
};

// @desc    Create a new Quran lesson record
// @route   POST /api/quran/lessons
// @access  Private
const createQuranLessonRecord = async (req, res) => {
    try {
        const {
            studentId,
            studentName,
            classId,
            branchId,
            halaqahName,
            surahName,
            surahNumber,
            fromVerse,
            toVerse,
            lessonType,
            status,
            repeatCount,
            note,
            date,
            deviationReason,
            isIskuXirDay,
            iskuXirResult
        } = req.body;

        if (!studentId && !studentName) {
            return res.status(400).json({ message: 'Student information is required' });
        }

        if (!surahName || !surahName.trim()) {
            return res.status(400).json({ message: 'Surah name is required' });
        }

        let resolvedName = studentName;
        let resolvedClassId = classId;
        let resolvedHalaqah = halaqahName;
        let resolvedBranchId = branchId;
        let resolvedStudentType = 'LAQDIIN';
        let studentDoc = null;

        if (studentId) {
            studentDoc = await Student.findById(studentId).populate('classId');
            if (studentDoc) {
                resolvedName = studentDoc.fullName || studentName;
                resolvedStudentType = studentDoc.studentType || 'LAQDIIN';
                if (!resolvedClassId && studentDoc.classId) {
                    resolvedClassId = studentDoc.classId._id;
                }
                if (!resolvedHalaqah && studentDoc.classId) {
                    resolvedHalaqah = studentDoc.classId.name || studentDoc.classId.className || '';
                }
                if (!resolvedBranchId) {
                    resolvedBranchId = studentDoc.branchId || (studentDoc.classId && studentDoc.classId.branchId) || undefined;
                }
            }
        }

        const expSurah = Number(studentDoc?.expectedLessonConfig?.surahNumber || studentDoc?.quranProgress?.surahNumber || surahNumber || 1);
        const expFrom = Number(studentDoc?.expectedLessonConfig?.fromVerse || studentDoc?.quranProgress?.fromVerse || fromVerse || 1);
        const expTo = Number(studentDoc?.expectedLessonConfig?.toVerse || toVerse || (expFrom + 4));

        const actSurah = surahNumber ? Number(surahNumber) : expSurah;
        const actFrom = fromVerse ? Number(fromVerse) : expFrom;
        const actTo = toVerse ? Number(toVerse) : expTo;

        const isDeviated = (actSurah !== expSurah) || (actFrom !== expFrom) || (actTo !== expTo);

        if (isDeviated && !deviationReason && req.user?.role === 'Teacher') {
            return res.status(400).json({
                message: 'Macallinka looma ogola inuu beddelo qorshaha Admin-ka isagoo aan sabab bixin (Deviation reason is required).'
            });
        }

        const record = new QuranLessonRecord({
            studentId,
            studentName: resolvedName,
            classId: resolvedClassId,
            branchId: resolvedBranchId,
            halaqahName: resolvedHalaqah || '',
            studentType: resolvedStudentType,
            expectedSurahNumber: expSurah,
            expectedSurahName: studentDoc?.expectedLessonConfig?.surahName || '',
            expectedFromVerse: expFrom,
            expectedToVerse: expTo,
            expectedPageOrLines: studentDoc?.expectedLessonConfig?.pageRange || studentDoc?.expectedLessonConfig?.lineRange || '',
            actualSurahNumber: actSurah,
            actualSurahName: surahName.trim(),
            actualFromVerse: actFrom,
            actualToVerse: actTo,
            isDeviated,
            deviationReason: isDeviated ? (deviationReason || '').trim() : '',
            isIskuXirDay: Boolean(isIskuXirDay),
            iskuXirResult: iskuXirResult || 'none',
            surahName: surahName.trim(),
            surahNumber: actSurah,
            fromVerse: actFrom,
            toVerse: actTo,
            lessonType: lessonType || 'sabaq',
            status: status === 'repeat' ? 'repeat' : (status === 'in_progress' ? 'in_progress' : 'passed'),
            repeatCount: status === 'repeat' ? Math.max(1, Number(repeatCount) || 1) : 1,
            note: note ? note.trim() : '',
            date: date ? new Date(date) : new Date(),
            teacherId: req.user ? req.user._id : undefined,
            recordedBy: req.user ? req.user._id : undefined,
            auditHistory: [{
                action: isDeviated ? 'TEACHER_DEVIATED' : 'CREATED_RECORD',
                performedBy: req.user?._id,
                role: req.user?.role || 'User',
                timestamp: new Date(),
                details: isDeviated ? `Changed from (${expSurah}:${expFrom}-${expTo}) to (${actSurah}:${actFrom}-${actTo}): ${deviationReason}` : 'Standard record'
            }]
        });

        const savedRecord = await record.save();
        const populated = await QuranLessonRecord.findById(savedRecord._id)
            .populate('studentId', 'fullName studentCode rollNumber fatherPhone classId branchId studentType')
            .populate('classId', 'name className branchId')
            .populate('branchId', 'name')
            .populate('teacherId', 'fullName username');

        res.status(201).json(populated);

    } catch (error) {
        console.error('Error creating Quran lesson record:', error);
        res.status(500).json({ message: 'Failed to save Quran lesson record', error: error.message });
    }
};

// Helper to revert student progress when a lesson record is deleted
const revertStudentProgressAfterRecordDelete = async (record) => {
    try {
        if (!record || !record.studentId) return;
        const student = await Student.findById(record.studentId);
        if (!student) return;

        // Find the most recent remaining record for this student
        const prevRecord = await QuranLessonRecord.findOne({
            studentId: student._id,
            _id: { $ne: record._id }
        }).sort({ date: -1, createdAt: -1 });

        if (prevRecord) {
            const pSurah = prevRecord.actualSurahNumber || prevRecord.surahNumber || 1;
            const pSurahObj = QURAN_SURAHS.find(s => s.number === pSurah) || QURAN_SURAHS[0];
            const pFrom = prevRecord.actualFromVerse || prevRecord.fromVerse || 1;
            const pTo = prevRecord.actualToVerse || prevRecord.toVerse || pFrom;
            const maxV = pSurahObj.verses || 100;

            let nextSurah = pSurah;
            let nextFrom = pTo + 1;
            if (prevRecord.status === 'passed') {
                if (nextFrom > maxV) {
                    nextSurah = nextSurah < 114 ? nextSurah + 1 : 1;
                    nextFrom = 1;
                }
            } else {
                nextFrom = pFrom;
            }
            const nSurahObj = QURAN_SURAHS.find(s => s.number === nextSurah) || QURAN_SURAHS[0];
            const pace = student.quranProgress?.dailyPace || student.expectedLessonConfig?.dailyPace || 5;
            const nextTo = Math.min(nSurahObj.verses || 100, nextFrom + (pace - 1));

            student.quranProgress = {
                surahNumber: nextSurah,
                surahName: nSurahObj.nameSo || nSurahObj.nameAr,
                fromVerse: nextFrom,
                dailyPace: pace,
                lastStatus: prevRecord.status,
                lastUpdated: new Date()
            };
            student.expectedLessonConfig = {
                ...(student.expectedLessonConfig ? student.expectedLessonConfig.toObject() : {}),
                surahNumber: nextSurah,
                surahName: nSurahObj.nameSo || nSurahObj.nameAr,
                fromVerse: nextFrom,
                toVerse: nextTo,
                dailyPace: pace,
                lastAssignedAt: new Date()
            };
        } else {
            // No previous record, revert to initial expectation of deleted record
            const rSurah = record.expectedSurahNumber || record.surahNumber || 1;
            const rFrom = record.expectedFromVerse || record.fromVerse || 1;
            const rSurahObj = QURAN_SURAHS.find(s => s.number === rSurah) || QURAN_SURAHS[0];
            const pace = student.expectedLessonConfig?.dailyPace || student.quranProgress?.dailyPace || 5;
            const rTo = Math.min(rSurahObj.verses || 100, rFrom + (pace - 1));

            student.quranProgress = {
                surahNumber: rSurah,
                surahName: rSurahObj.nameSo || rSurahObj.nameAr,
                fromVerse: rFrom,
                dailyPace: pace,
                lastStatus: 'passed',
                lastUpdated: new Date()
            };
            student.expectedLessonConfig = {
                ...(student.expectedLessonConfig ? student.expectedLessonConfig.toObject() : {}),
                surahNumber: rSurah,
                surahName: rSurahObj.nameSo || rSurahObj.nameAr,
                fromVerse: rFrom,
                toVerse: rTo,
                dailyPace: pace,
                lastAssignedAt: new Date()
            };
        }
        await student.save();
    } catch (err) {
        console.error('Error reverting student progress after record deletion:', err);
    }
};

// @desc    Update a Quran lesson record
// @route   PUT /api/quran/lessons/:id
// @access  Private
const updateQuranLessonRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            studentId,
            studentName,
            classId,
            halaqahName,
            surahName,
            surahNumber,
            fromVerse,
            toVerse,
            lessonType,
            status,
            repeatCount,
            note,
            date,
            deviationReason,
            isIskuXirDay,
            iskuXirResult
        } = req.body;

        const record = await QuranLessonRecord.findById(id);
        if (!record) {
            return res.status(404).json({ message: 'Quran lesson record not found' });
        }

        // Teacher check: Allow teachers to edit records belonging to their assigned class
        const isTeacherUser = req.user?.role === 'Teacher';
        if (isTeacherUser) {
            const teacherClasses = await Class.find({ teacherId: req.user._id });
            const teacherClassIds = teacherClasses.map(c => c._id.toString());
            if (record.classId && !teacherClassIds.includes(record.classId.toString())) {
                return res.status(403).json({ message: 'Ma lihid awood aad ku beddesho cashir fasal aadan dhigin.' });
            }
        }

        // Only Admin can change assigned Surah, verses, or date. Teachers can only evaluate (status, note, isku-xir).
        if (!isTeacherUser) {
            if (studentId) record.studentId = studentId;
            if (studentName) record.studentName = studentName;
            if (classId !== undefined) record.classId = classId;
            if (halaqahName !== undefined) record.halaqahName = halaqahName;
            if (surahName) {
                record.surahName = surahName.trim();
                record.actualSurahName = surahName.trim();
            }
            if (surahNumber !== undefined) {
                record.surahNumber = surahNumber ? Number(surahNumber) : undefined;
                record.actualSurahNumber = record.surahNumber;
            }
            if (fromVerse !== undefined) {
                record.fromVerse = Number(fromVerse) || 1;
                record.actualFromVerse = record.fromVerse;
            }
            if (toVerse !== undefined) {
                record.toVerse = toVerse ? Number(toVerse) : undefined;
                record.actualToVerse = record.toVerse;
            }
            if (lessonType) record.lessonType = lessonType;
            if (date) record.date = new Date(date);
            if (deviationReason !== undefined) {
                record.deviationReason = deviationReason.trim();
                record.isDeviated = Boolean(record.deviationReason);
            }
        }

        if (status) record.status = status;
        if (repeatCount !== undefined) {
            record.repeatCount = Math.max(1, Number(repeatCount) || 1);
        } else if (status === 'passed') {
            record.repeatCount = 1;
        }
        if (note !== undefined) record.note = note.trim();
        if (isIskuXirDay !== undefined) record.isIskuXirDay = Boolean(isIskuXirDay);
        if (iskuXirResult !== undefined) record.iskuXirResult = iskuXirResult;

        record.auditHistory.push({
            action: 'UPDATE_RECORD',
            performedBy: req.user?._id,
            role: req.user?.role || 'User',
            timestamp: new Date(),
            details: `Updated by ${req.user?.username || req.user?.role}`
        });

        const updated = await record.save();

        // Sync student progress with updated lesson
        if (record.studentId) {
            const student = await Student.findById(record.studentId);
            if (student) {
                const actSurah = record.actualSurahNumber || record.surahNumber || 1;
                const actSurahObj = QURAN_SURAHS.find(s => s.number === actSurah) || QURAN_SURAHS[0];
                const maxVerses = actSurahObj.verses || 100;
                const actFrom = record.actualFromVerse || record.fromVerse || 1;
                const actTo = record.actualToVerse || record.toVerse || actFrom;
                const pace = student.quranProgress?.dailyPace || (actTo - actFrom + 1) || 5;

                if (record.status === 'passed') {
                    let nextSurahNum = actSurah;
                    let nextFrom = actTo + 1;
                    let nextSurahObj = actSurahObj;

                    if (nextFrom > maxVerses) {
                        nextSurahNum = nextSurahNum < 114 ? nextSurahNum + 1 : 1;
                        nextFrom = 1;
                        nextSurahObj = QURAN_SURAHS.find(s => s.number === nextSurahNum) || QURAN_SURAHS[0];
                    }

                    const nextMaxV = nextSurahObj.verses || 100;
                    const nextTo = Math.min(nextMaxV, nextFrom + (pace - 1));

                    student.quranProgress = {
                        surahNumber: nextSurahNum,
                        surahName: nextSurahObj.nameSo || nextSurahObj.nameAr,
                        fromVerse: nextFrom,
                        dailyPace: pace,
                        lastStatus: 'passed',
                        lastUpdated: new Date()
                    };
                    student.expectedLessonConfig = {
                        ...(student.expectedLessonConfig ? student.expectedLessonConfig.toObject() : {}),
                        surahNumber: nextSurahNum,
                        surahName: nextSurahObj.nameSo || nextSurahObj.nameAr,
                        fromVerse: nextFrom,
                        toVerse: nextTo,
                        dailyPace: pace,
                        lastAssignedAt: new Date()
                    };
                } else {
                    student.quranProgress = {
                        surahNumber: actSurah,
                        surahName: actSurahObj.nameSo || actSurahObj.nameAr,
                        fromVerse: actFrom,
                        dailyPace: pace,
                        lastStatus: 'repeat',
                        lastUpdated: new Date()
                    };
                }
                await student.save();
            }
        }

        const populated = await QuranLessonRecord.findById(updated._id)
            .populate('studentId', 'fullName studentCode rollNumber fatherPhone classId')
            .populate('classId', 'name className')
            .populate('teacherId', 'fullName username');

        res.status(200).json(populated);
    } catch (error) {
        console.error('Error updating Quran lesson record:', error);
        res.status(500).json({ message: 'Failed to update Quran lesson record', error: error.message });
    }
};

// @desc    Delete a Quran lesson record (Individual delete)
// @route   DELETE /api/quran/lessons/:id
// @access  Private
const deleteQuranLessonRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await QuranLessonRecord.findById(id);
        if (!record) {
            return res.status(404).json({ message: 'Quran lesson record not found' });
        }

        // Allow Teachers if the record belongs to a class assigned to them
        if (req.user?.role === 'Teacher') {
            const teacherClasses = await Class.find({ teacherId: req.user._id });
            const teacherClassIds = teacherClasses.map(c => c._id.toString());
            if (record.classId && !teacherClassIds.includes(record.classId.toString())) {
                return res.status(403).json({ message: 'Ma lihid awood aad ku tirtirto cashir fasal aadan dhigin.' });
            }
        }

        // Revert student progress before deleting record
        await revertStudentProgressAfterRecordDelete(record);

        await QuranLessonRecord.findByIdAndDelete(id);
        res.status(200).json({ message: 'Diiwaanka cashirka ardayga si guul leh ayaa loo tirtiray' });
    } catch (error) {
        console.error('Error deleting Quran lesson record:', error);
        res.status(500).json({ message: 'Failed to delete Quran lesson record', error: error.message });
    }
};

// @desc    Delete all Quran lesson records for a class on a specific date (Delete All Sheet)
// @route   DELETE /api/quran/lessons/class-sheet
// @access  Private
const deleteClassQuranSheet = async (req, res) => {
    try {
        const { classId, date } = req.query;
        if (!classId) {
            return res.status(400).json({ message: 'Fasalka waa qasab (Class ID is required)' });
        }

        // Teacher permission check: Must be assigned to this class
        if (req.user?.role === 'Teacher') {
            const teacherClasses = await Class.find({ teacherId: req.user._id });
            const teacherClassIds = teacherClasses.map(c => c._id.toString());
            if (!teacherClassIds.includes(classId.toString())) {
                return res.status(403).json({ message: 'Ma lihid awood aad ku tirtirto xaashida fasal aadan dhigin.' });
            }
        }

        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const records = await QuranLessonRecord.find({
            classId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (records.length === 0) {
            return res.status(200).json({ message: 'Ma jiraan cashiro la keydiyay taariikhdan.', deletedCount: 0 });
        }

        // Revert progress for each student whose record is being deleted
        for (const rec of records) {
            await revertStudentProgressAfterRecordDelete(rec);
        }

        const deleteResult = await QuranLessonRecord.deleteMany({
            classId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        res.status(200).json({
            message: `Dhammaan cashiradii fasalka ee maalintaas waa la wada tirtiray (${deleteResult.deletedCount} xabbo).`,
            deletedCount: deleteResult.deletedCount
        });
    } catch (error) {
        console.error('Error deleting class Quran sheet:', error);
        res.status(500).json({ message: 'Failed to delete class Quran sheet', error: error.message });
    }
};

// @desc    Get Quran daily sheet for a class with auto-calculated lessons & Teacher Class Isolation
// @route   GET /api/quran/lessons/class-sheet
// @access  Private
const getClassQuranSheet = async (req, res) => {
    try {
        const { classId, date } = req.query;
        let targetClassId = classId;
        const isTeacher = req.user && req.user.role === 'Teacher';

        // TEACHER ISOLATION: A Teacher can ONLY view students of their assigned class(es)!
        if (isTeacher) {
            const teacherClasses = await Class.find({ teacherId: req.user._id }).populate('branchId', 'name');
            const teacherClassIds = teacherClasses.map(c => c._id.toString());

            if (targetClassId) {
                if (!teacherClassIds.includes(targetClassId.toString())) {
                    return res.status(403).json({
                        message: 'Fasalkan adiga kuuma xilsaarna (You are not assigned to this class).'
                    });
                }
            } else {
                if (teacherClasses.length === 0) {
                    return res.status(200).json({
                        classId: null,
                        className: '',
                        students: [],
                        teacherClasses: [],
                        message: 'Macallinka fasal looma xilsaarin weli.'
                    });
                }
                targetClassId = teacherClasses[0]._id;
            }
        }

        if (!targetClassId) {
            return res.status(400).json({ message: 'Class ID is required' });
        }

        const cls = await Class.findById(targetClassId).populate('branchId', 'name').populate('teacherId', 'fullName username email');
        if (!cls) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const students = await Student.find({
            classId: targetClassId,
            status: { $nin: ['Inactive', 'Exited'] }
        }).sort({ rollNumber: 1, fullName: 1 });

        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Day of week in Somali and English
        const somaliDay = SOMALI_DAYS[targetDate.getDay()];
        const englishDay = ENGLISH_DAYS[targetDate.getDay()];

        const todayRecords = await QuranLessonRecord.find({
            classId: targetClassId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        const recordMap = new Map();
        todayRecords.forEach(r => {
            recordMap.set(String(r.studentId), r);
        });

        // Asynchronously process sheet students with dynamic 4-day Isku-Xir for HOREED students
        const sheetStudents = await Promise.all(students.map(async (s) => {
            const studentType = s.studentType || 'LAQDIIN';
            const expConfig = s.expectedLessonConfig || {};
            const progress = s.quranProgress || {
                surahNumber: 1,
                surahName: 'Al-Faatixa',
                fromVerse: 1,
                dailyPace: 5,
                lastStatus: 'passed'
            };

            const sNum = Number(expConfig.surahNumber || progress.surahNumber || 1);
            const surah = QURAN_SURAHS.find(item => item.number === sNum) || QURAN_SURAHS[0];
            const maxV = surah.verses || 100;
            const fromV = Math.max(1, Math.min(Number(expConfig.fromVerse || progress.fromVerse || 1), maxV));
            const paceUnit = expConfig.paceUnit || 'sadar';
            const paceCount = Number(expConfig.paceCount || expConfig.dailyPace || progress.dailyPace || 5);
            const toV = expConfig.toVerse ? Math.min(maxV, Number(expConfig.toVerse)) : Math.min(maxV, fromV + (paceCount - 1));

            // DYNAMIC 4-DAY ISKU-XIR FOR HOREED STUDENTS:
            // Reads from database what the student completed over the last 4 passed days!
            let iskuXirInfo = null;
            if (studentType === 'HOREED') {
                const last4Passed = await QuranLessonRecord.find({
                    studentId: s._id,
                    status: 'passed',
                    date: { $lt: startOfDay }
                }).sort({ date: -1 }).limit(4);

                if (last4Passed.length > 0) {
                    const newest = last4Passed[0];
                    const oldest = last4Passed[last4Passed.length - 1];
                    const daysCount = last4Passed.length;

                    let spanText = '';
                    if (oldest.surahNumber === newest.surahNumber) {
                        spanText = `${newest.surahName} (Aayadaha ${oldest.fromVerse} - ${newest.toVerse})`;
                    } else {
                        spanText = `${oldest.surahName} (Aayad ${oldest.fromVerse}) ilaa ${newest.surahName} (Aayad ${newest.toVerse})`;
                    }

                    iskuXirInfo = {
                        hasIskuXir: true,
                        isToday: true,
                        daysCount,
                        spanText,
                        surahName: spanText,
                        fromSurahNumber: oldest.surahNumber,
                        toSurahNumber: newest.surahNumber,
                        fromVerse: oldest.fromVerse,
                        toVerse: newest.toVerse,
                        records: last4Passed.map(r => ({
                            date: r.date,
                            surahName: r.surahName,
                            fromVerse: r.fromVerse,
                            toVerse: r.toVerse
                        }))
                    };
                } else {
                    iskuXirInfo = {
                        hasIskuXir: false,
                        isToday: false,
                        daysCount: 0,
                        spanText: 'Weli ma dhamaysan 4 cashir oo hore (Bilaabe Horeed)'
                    };
                }
            }

            const existingRecord = recordMap.get(String(s._id));

            return {
                studentId: s._id,
                fullName: s.fullName,
                studentCode: s.studentCode || '',
                rollNumber: s.rollNumber || '',
                studentType,
                paceUnit,
                paceCount,
                expectedLesson: {
                    surahNumber: sNum,
                    surahName: `${surah.number}. ${surah.nameAr} (${surah.nameSo})`,
                    rawSurahName: surah.nameSo || surah.nameAr,
                    fromVerse: fromV,
                    toVerse: toV,
                    maxVerses: maxV,
                    paceUnit,
                    paceCount,
                    pageOrLines: expConfig.pageRange || expConfig.lineRange || (paceUnit === 'bog' ? `${paceCount} Bog` : `${paceCount} Sadar`)
                },
                actualLesson: {
                    surahNumber: existingRecord ? (existingRecord.actualSurahNumber || existingRecord.surahNumber) : sNum,
                    surahName: existingRecord ? (existingRecord.actualSurahName || existingRecord.surahName) : `${surah.number}. ${surah.nameAr} (${surah.nameSo})`,
                    fromVerse: existingRecord ? (existingRecord.actualFromVerse || existingRecord.fromVerse) : fromV,
                    toVerse: existingRecord ? (existingRecord.actualToVerse || existingRecord.toVerse) : toV,
                    maxVerses: maxV
                },
                iskuXir: iskuXirInfo,
                todayRecord: existingRecord ? {
                    _id: existingRecord._id,
                    surahNumber: existingRecord.actualSurahNumber || existingRecord.surahNumber,
                    surahName: existingRecord.actualSurahName || existingRecord.surahName,
                    fromVerse: existingRecord.actualFromVerse || existingRecord.fromVerse,
                    toVerse: existingRecord.actualToVerse || existingRecord.toVerse,
                    actualSurahNumber: existingRecord.actualSurahNumber || existingRecord.surahNumber,
                    actualSurahName: existingRecord.actualSurahName || existingRecord.surahName,
                    actualFromVerse: existingRecord.actualFromVerse || existingRecord.fromVerse,
                    actualToVerse: existingRecord.actualToVerse || existingRecord.toVerse,
                    status: existingRecord.status,
                    isDeviated: existingRecord.isDeviated,
                    deviationReason: existingRecord.deviationReason || '',
                    isIskuXirDay: existingRecord.isIskuXirDay,
                    iskuXirResult: existingRecord.iskuXirResult || 'none',
                    note: existingRecord.note || '',
                    repeatCount: existingRecord.repeatCount || 1
                } : null
            };
        }));

        res.status(200).json({
            classId: cls._id,
            className: cls.name || cls.className,
            teacherId: cls.teacherId?._id || cls.teacherId,
            teacherName: cls.teacherId?.fullName || cls.teacherId?.username || '',
            branchId: cls.branchId?._id || cls.branchId,
            branchName: cls.branchId?.name || '',
            date: targetDate,
            dayName: somaliDay,
            students: sheetStudents
        });
    } catch (error) {
        console.error('Error getting class Quran sheet:', error);
        res.status(500).json({ message: 'Failed to get class Quran sheet', error: error.message });
    }
};

// @desc    Batch record daily Quran lessons with strict RULE 4 validation & deviation auditing
// @route   POST /api/quran/lessons/batch
// @access  Private
const batchRecordQuranLessons = async (req, res) => {
    try {
        const { classId, branchId, date, lessons } = req.body;

        if (!Array.isArray(lessons) || lessons.length === 0) {
            return res.status(400).json({ message: 'No lesson evaluations provided' });
        }

        const cls = classId ? await Class.findById(classId).populate('teacherId', 'fullName') : null;
        const halaqahName = cls?.name || cls?.className || '';
        const lessonDate = date ? new Date(date) : new Date();

        // If Teacher, ensure they only grade their own class
        if (req.user?.role === 'Teacher' && cls?.teacherId && !cls.teacherId._id.equals(req.user._id)) {
            return res.status(403).json({ message: 'Ma lihid awood aad ku qiimeyso fasal aadan adigu dhigin.' });
        }

        // PRE-VALIDATION: Check Rule 4 (Teachers must not silently modify assigned lesson)
        for (const item of lessons) {
            if (!item.studentId) continue;
            const student = await Student.findById(item.studentId);
            if (!student) continue;

            const expConfig = student.expectedLessonConfig || {};
            const expSurah = Number(item.expectedSurahNumber || expConfig.surahNumber || student.quranProgress?.surahNumber || 1);
            const expFrom = Number(item.expectedFromVerse || expConfig.fromVerse || student.quranProgress?.fromVerse || 1);
            const expTo = Number(item.expectedToVerse || expConfig.toVerse || (expFrom + (expConfig.dailyPace || 5) - 1));

            const actSurah = Number(item.surahNumber || expSurah);
            const actFrom = Number(item.fromVerse || expFrom);
            const actTo = Number(item.toVerse || expTo);

            const isDeviated = (actSurah !== expSurah) || (actFrom !== expFrom) || (actTo !== expTo);
            const reason = (item.deviationReason || '').trim();

            if (isDeviated && !reason && req.user?.role === 'Teacher') {
                return res.status(400).json({
                    message: `Macallinka looma ogola inuu aayadaha beddelo isagoo aan sabab bixin (Ardayga: ${student.fullName}). Fadlan geli sababta aad qorshaha Admin-ka u beddeshay.`
                });
            }
        }

        const isTeacherGrading = req.user?.role === 'Teacher';
        const results = [];

        for (const item of lessons) {
            if (!item.studentId) continue;

            const student = await Student.findById(item.studentId);
            if (!student) continue;

            const expConfig = student.expectedLessonConfig || {};
            const expSurah = Number(item.expectedSurahNumber || expConfig.surahNumber || student.quranProgress?.surahNumber || 1);
            const expFrom = Number(item.expectedFromVerse || expConfig.fromVerse || student.quranProgress?.fromVerse || 1);
            const expTo = Number(item.expectedToVerse || expConfig.toVerse || (expFrom + (expConfig.dailyPace || 5) - 1));
            const expSurahObj = QURAN_SURAHS.find(s => s.number === expSurah) || QURAN_SURAHS[0];

            // If teacher is grading, strictly enforce the admin-assigned lesson (teachers cannot modify verses/surahs)
            const actSurah = isTeacherGrading ? expSurah : Number(item.surahNumber || expSurah);
            const actSurahObj = QURAN_SURAHS.find(s => s.number === actSurah) || expSurahObj;
            const maxVerses = actSurahObj.verses || 100;
            const actFrom = isTeacherGrading ? expFrom : (Number(item.fromVerse) || 1);
            const actTo = isTeacherGrading ? expTo : (Number(item.toVerse) || Math.min(maxVerses, actFrom + 4));

            const isDeviated = !isTeacherGrading && ((actSurah !== expSurah) || (actFrom !== expFrom) || (actTo !== expTo));
            const deviationReason = isDeviated ? (item.deviationReason || '').trim() : '';

            const status = item.status === 'repeat' ? 'repeat' : 'passed';
            const pace = Number(item.dailyPace || expConfig.dailyPace || student.quranProgress?.dailyPace || (actTo - actFrom + 1) || 5);

            const isIskuXirDay = Boolean(item.isIskuXirDay);
            const iskuXirResult = item.iskuXirResult || 'none';

            // Upsert today's record
            const startOfDay = new Date(lessonDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(lessonDate);
            endOfDay.setHours(23, 59, 59, 999);

            let record = await QuranLessonRecord.findOne({
                studentId: student._id,
                date: { $gte: startOfDay, $lte: endOfDay }
            });

            if (record) {
                record.expectedSurahNumber = expSurah;
                record.expectedSurahName = `${expSurahObj.number}. ${expSurahObj.nameAr} (${expSurahObj.nameSo})`;
                record.expectedFromVerse = expFrom;
                record.expectedToVerse = expTo;
                record.expectedPageOrLines = expConfig.pageRange || expConfig.lineRange || '';

                record.actualSurahNumber = actSurah;
                record.actualSurahName = item.surahName || `${actSurahObj.number}. ${actSurahObj.nameAr} (${actSurahObj.nameSo})`;
                record.actualFromVerse = actFrom;
                record.actualToVerse = actTo;

                record.surahName = record.actualSurahName;
                record.surahNumber = actSurah;
                record.fromVerse = actFrom;
                record.toVerse = actTo;

                record.studentType = student.studentType || 'LAQDIIN';
                record.isDeviated = isDeviated;
                record.deviationReason = deviationReason;
                record.isIskuXirDay = isIskuXirDay;
                record.iskuXirResult = iskuXirResult;
                record.status = status;
                record.note = item.note || '';
                record.repeatCount = status === 'repeat' ? (record.repeatCount || 1) + 1 : 1;
                record.teacherId = req.user?._id;
                record.recordedBy = req.user?._id;

                record.auditHistory.push({
                    action: isDeviated ? 'TEACHER_DEVIATED_LESSON' : 'TEACHER_RECORDED_LESSON',
                    performedBy: req.user?._id,
                    role: req.user?.role || 'Teacher',
                    timestamp: new Date(),
                    details: isDeviated ? `Deviated: ${deviationReason}` : 'Delivered expected lesson'
                });

                await record.save();
            } else {
                record = await QuranLessonRecord.create({
                    studentId: student._id,
                    studentName: student.fullName,
                    classId: classId || student.classId,
                    halaqahName,
                    branchId: branchId || student.branchId,
                    studentType: student.studentType || 'LAQDIIN',
                    expectedSurahNumber: expSurah,
                    expectedSurahName: `${expSurahObj.number}. ${expSurahObj.nameAr} (${expSurahObj.nameSo})`,
                    expectedFromVerse: expFrom,
                    expectedToVerse: expTo,
                    expectedPageOrLines: expConfig.pageRange || expConfig.lineRange || '',
                    actualSurahNumber: actSurah,
                    actualSurahName: item.surahName || `${actSurahObj.number}. ${actSurahObj.nameAr} (${actSurahObj.nameSo})`,
                    actualFromVerse: actFrom,
                    actualToVerse: actTo,
                    surahName: item.surahName || `${actSurahObj.number}. ${actSurahObj.nameAr} (${actSurahObj.nameSo})`,
                    surahNumber: actSurah,
                    fromVerse: actFrom,
                    toVerse: actTo,
                    lessonType: item.lessonType || 'sabaq',
                    status,
                    isDeviated,
                    deviationReason,
                    isIskuXirDay,
                    iskuXirResult,
                    repeatCount: status === 'repeat' ? 2 : 1,
                    note: item.note || '',
                    date: lessonDate,
                    teacherId: req.user?._id,
                    recordedBy: req.user?._id,
                    auditHistory: [{
                        action: isDeviated ? 'TEACHER_DEVIATED_LESSON' : 'TEACHER_RECORDED_LESSON',
                        performedBy: req.user?._id,
                        role: req.user?.role || 'Teacher',
                        timestamp: new Date(),
                        details: isDeviated ? `Deviated: ${deviationReason}` : 'Delivered expected lesson'
                    }]
                });
            }

            // AUTO-PROGRESSION FOR STUDENT:
            if (status === 'passed') {
                let nextSurahNum = actSurah;
                let nextFrom = actTo + 1;
                let nextSurahObj = actSurahObj;

                if (nextFrom > maxVerses) {
                    nextSurahNum = nextSurahNum < 114 ? nextSurahNum + 1 : 1;
                    nextFrom = 1;
                    nextSurahObj = QURAN_SURAHS.find(s => s.number === nextSurahNum) || QURAN_SURAHS[0];
                }

                const nextMaxV = nextSurahObj.verses || 100;
                const nextTo = Math.min(nextMaxV, nextFrom + (pace - 1));

                // Advance quranProgress
                student.quranProgress = {
                    surahNumber: nextSurahNum,
                    surahName: nextSurahObj.nameSo || nextSurahObj.nameAr,
                    fromVerse: nextFrom,
                    dailyPace: pace,
                    lastStatus: 'passed',
                    lastUpdated: new Date()
                };

                // Advance expectedLessonConfig automatically so Admin's next day expectation steps forward
                student.expectedLessonConfig = {
                    ...(student.expectedLessonConfig ? student.expectedLessonConfig.toObject() : {}),
                    surahNumber: nextSurahNum,
                    surahName: nextSurahObj.nameSo || nextSurahObj.nameAr,
                    fromVerse: nextFrom,
                    toVerse: nextTo,
                    dailyPace: pace,
                    lastAssignedAt: new Date()
                };
            } else {
                // TIKRAAR (Repeat) - Stay on current surah and current starting verse
                student.quranProgress = {
                    surahNumber: actSurah,
                    surahName: actSurahObj.nameSo || actSurahObj.nameAr,
                    fromVerse: actFrom,
                    dailyPace: pace,
                    lastStatus: 'repeat',
                    lastUpdated: new Date()
                };
            }

            await student.save();
            results.push(record);
        }

        res.status(200).json({
            message: `Si guul leh ayaa loo kaydiyey ${results.length} cashir`,
            count: results.length,
            records: results
        });
    } catch (error) {
        console.error('Error batch recording Quran lessons:', error);
        res.status(500).json({ message: 'Failed to batch record Quran lessons', error: error.message });
    }
};

// @desc    Admin: Assign/Update student Quran plan (Type, Surah, Verses, Pages, Isku-Xir)
// @route   PUT /api/quran/lessons/admin/assign-expectation
// @access  Private (Admin / Branch Manager)
const assignStudentQuranPlan = async (req, res) => {
    try {
        const {
            studentId,
            classId,
            studentType, // 'LAQDIIN' | 'HOREED'
            surahNumber,
            fromVerse,
            toVerse,
            paceUnit, // 'sadar' | 'bog' | 'ayah'
            paceCount, // e.g. 7 sadar or 1 bog
            pageRange,
            lineRange,
            dailyPace,
            iskuXirConfig
        } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Ardayga lama helin (Student not found)' });
        }

        if (classId) {
            student.classId = classId;
        }

        const sNum = Number(surahNumber) || 1;
        const surah = QURAN_SURAHS.find(s => s.number === sNum) || QURAN_SURAHS[0];
        const fVerse = Math.max(1, Math.min(Number(fromVerse) || 1, surah.verses));
        const tVerse = Math.min(surah.verses, Math.max(fVerse, Number(toVerse) || (fVerse + 4)));
        const pace = Math.max(1, Number(dailyPace) || (tVerse - fVerse + 1));
        const pUnit = (paceUnit === 'bog' || paceUnit === 'ayah') ? paceUnit : 'sadar';
        const pCount = Math.max(1, Number(paceCount) || Number(dailyPace) || (pUnit === 'bog' ? 1 : 7));

        student.studentType = studentType === 'HOREED' ? 'HOREED' : 'LAQDIIN';

        student.expectedLessonConfig = {
            surahNumber: sNum,
            surahName: surah.nameSo || surah.nameAr,
            fromVerse: fVerse,
            toVerse: tVerse,
            paceUnit: pUnit,
            paceCount: pCount,
            pageRange: pageRange ? String(pageRange).trim() : (pUnit === 'bog' ? `${pCount} Bog` : ''),
            lineRange: lineRange ? String(lineRange).trim() : (pUnit === 'sadar' ? `${pCount} Sadar` : ''),
            dailyPace: pace,
            lastAssignedBy: req.user?._id,
            lastAssignedAt: new Date()
        };

        student.quranProgress = {
            surahNumber: sNum,
            surahName: surah.nameSo || surah.nameAr,
            fromVerse: fVerse,
            dailyPace: pace,
            lastStatus: 'passed',
            lastUpdated: new Date()
        };

        if (student.studentType === 'HOREED' && iskuXirConfig) {
            const iskuSurahNum = Number(iskuXirConfig.surahNumber) || 1;
            const iskuSurah = QURAN_SURAHS.find(s => s.number === iskuSurahNum) || QURAN_SURAHS[0];
            student.iskuXirConfig = {
                isActive: Boolean(iskuXirConfig.isActive),
                revisionDays: Array.isArray(iskuXirConfig.revisionDays) ? iskuXirConfig.revisionDays : [],
                surahNumber: iskuSurahNum,
                surahName: iskuSurah.nameSo || iskuSurah.nameAr,
                fromVerse: Number(iskuXirConfig.fromVerse) || 1,
                toVerse: Number(iskuXirConfig.toVerse) || iskuSurah.verses,
                pageRange: iskuXirConfig.pageRange ? String(iskuXirConfig.pageRange).trim() : '',
                notes: iskuXirConfig.notes ? String(iskuXirConfig.notes).trim() : ''
            };
        } else if (student.studentType === 'LAQDIIN') {
            student.iskuXirConfig = {
                isActive: false,
                revisionDays: [],
                notes: ''
            };
        }

        await student.save();

        res.status(200).json({
            message: `Qorshaha Quraanka ardayga "${student.fullName}" si guul leh ayaa loo dejiyay`,
            student: {
                _id: student._id,
                fullName: student.fullName,
                studentType: student.studentType,
                expectedLessonConfig: student.expectedLessonConfig,
                quranProgress: student.quranProgress,
                iskuXirConfig: student.iskuXirConfig
            }
        });
    } catch (error) {
        console.error('Error assigning student Quran plan:', error);
        res.status(500).json({ message: 'Failed to assign Quran plan', error: error.message });
    }
};

// @desc    Get Accountability & Teacher Performance Report (Admin Expectation vs Teacher Record)
// @route   GET /api/quran/lessons/accountability/report
// @access  Private
const getAccountabilityReport = async (req, res) => {
    try {
        const { date, classId, branchId } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const classQuery = {};
        if (classId) classQuery._id = classId;
        if (branchId && branchId !== 'All' && branchId !== 'ALL') classQuery.branchId = branchId;
        if (req.user?.role === 'Teacher') classQuery.teacherId = req.user._id;

        const classes = await Class.find(classQuery).populate('teacherId', 'fullName username email').populate('branchId', 'name');
        const classIds = classes.map(c => c._id);

        const students = await Student.find({
            classId: { $in: classIds },
            status: { $nin: ['Inactive', 'Exited'] }
        }).populate('classId', 'name className teacherId').sort({ fullName: 1 });

        const records = await QuranLessonRecord.find({
            classId: { $in: classIds },
            date: { $gte: startOfDay, $lte: endOfDay }
        }).populate('teacherId', 'fullName username').populate('studentId', 'fullName studentCode rollNumber');

        const recordMap = new Map();
        records.forEach(r => {
            recordMap.set(String(r.studentId?._id || r.studentId), r);
        });

        // Compute teacher metrics map
        const teacherMap = new Map();
        classes.forEach(c => {
            const tId = c.teacherId ? String(c.teacherId._id) : 'unassigned';
            const tName = c.teacherId?.fullName || c.teacherId?.username || 'Macallin Aan La Xilsaarin';
            if (!teacherMap.has(tId)) {
                teacherMap.set(tId, {
                    teacherId: tId,
                    teacherName: tName,
                    classes: [],
                    totalStudents: 0,
                    evaluatedCount: 0,
                    missingCount: 0,
                    adheredCount: 0,
                    deviatedCount: 0,
                    passedCount: 0,
                    repeatCount: 0
                });
            }
            teacherMap.get(tId).classes.push({ _id: c._id, name: c.name || c.className });
        });

        const detailedComparison = [];
        let totalExpected = students.length;
        let totalEvaluated = 0;
        let totalAdhered = 0;
        let totalDeviated = 0;
        let totalPassed = 0;
        let totalRepeat = 0;

        students.forEach(s => {
            const cls = classes.find(c => String(c._id) === String(s.classId?._id || s.classId));
            const tId = cls?.teacherId ? String(cls.teacherId._id) : 'unassigned';
            const tStats = teacherMap.get(tId);
            if (tStats) tStats.totalStudents += 1;

            const rec = recordMap.get(String(s._id));

            const expConfig = s.expectedLessonConfig || {};
            const qProg = s.quranProgress || {};
            const expSurahNum = expConfig.surahNumber || qProg.surahNumber || 1;
            const expSurahObj = QURAN_SURAHS.find(x => x.number === expSurahNum) || QURAN_SURAHS[0];
            const expFrom = expConfig.fromVerse || qProg.fromVerse || 1;
            const expTo = expConfig.toVerse || (expFrom + (expConfig.dailyPace || qProg.dailyPace || 5) - 1);
            const expPageOrLines = expConfig.pageRange || expConfig.lineRange || '';

            if (rec) {
                totalEvaluated += 1;
                if (tStats) tStats.evaluatedCount += 1;

                if (rec.isDeviated) {
                    totalDeviated += 1;
                    if (tStats) tStats.deviatedCount += 1;
                } else {
                    totalAdhered += 1;
                    if (tStats) tStats.adheredCount += 1;
                }

                if (rec.status === 'passed') {
                    totalPassed += 1;
                    if (tStats) tStats.passedCount += 1;
                } else {
                    totalRepeat += 1;
                    if (tStats) tStats.repeatCount += 1;
                }

                detailedComparison.push({
                    studentId: s._id,
                    studentName: s.fullName,
                    studentCode: s.studentCode || '',
                    studentType: s.studentType || 'LAQDIIN',
                    classId: cls?._id,
                    className: cls?.name || cls?.className || '',
                    teacherName: cls?.teacherId?.fullName || cls?.teacherId?.username || 'Aan La Xilsaarin',
                    hasRecord: true,
                    expected: {
                        surahNumber: rec.expectedSurahNumber || expSurahNum,
                        surahName: rec.expectedSurahName || `${expSurahObj.number}. ${expSurahObj.nameAr} (${expSurahObj.nameSo})`,
                        fromVerse: rec.expectedFromVerse || expFrom,
                        toVerse: rec.expectedToVerse || expTo,
                        pageOrLines: rec.expectedPageOrLines || expPageOrLines
                    },
                    actual: {
                        surahNumber: rec.actualSurahNumber || rec.surahNumber,
                        surahName: rec.actualSurahName || rec.surahName,
                        fromVerse: rec.actualFromVerse || rec.fromVerse,
                        toVerse: rec.actualToVerse || rec.toVerse
                    },
                    status: rec.status,
                    isDeviated: rec.isDeviated,
                    deviationReason: rec.deviationReason || '',
                    isIskuXirDay: rec.isIskuXirDay,
                    iskuXirResult: rec.iskuXirResult || 'none',
                    recordedAt: rec.createdAt,
                    recordedBy: rec.teacherId?.fullName || ''
                });
            } else {
                if (tStats) tStats.missingCount += 1;
                detailedComparison.push({
                    studentId: s._id,
                    studentName: s.fullName,
                    studentCode: s.studentCode || '',
                    studentType: s.studentType || 'LAQDIIN',
                    classId: cls?._id,
                    className: cls?.name || cls?.className || '',
                    teacherName: cls?.teacherId?.fullName || cls?.teacherId?.username || 'Aan La Xilsaarin',
                    hasRecord: false,
                    expected: {
                        surahNumber: expSurahNum,
                        surahName: `${expSurahObj.number}. ${expSurahObj.nameAr} (${expSurahObj.nameSo})`,
                        fromVerse: expFrom,
                        toVerse: expTo,
                        pageOrLines: expPageOrLines
                    },
                    actual: null,
                    status: 'missing',
                    isDeviated: false,
                    deviationReason: 'Cashir lagama qaadin maanta (Missing Record)'
                });
            }
        });

        const teacherPerformance = Array.from(teacherMap.values()).map(t => {
            const adherenceRate = t.evaluatedCount > 0 ? Math.round((t.adheredCount / t.evaluatedCount) * 100) : 100;
            const passRate = t.evaluatedCount > 0 ? Math.round((t.passedCount / t.evaluatedCount) * 100) : 0;
            return {
                ...t,
                adherenceRate,
                passRate
            };
        });

        const overallAdherenceRate = totalEvaluated > 0 ? Math.round((totalAdhered / totalEvaluated) * 100) : 100;
        const overallPassRate = totalEvaluated > 0 ? Math.round((totalPassed / totalEvaluated) * 100) : 0;

        res.status(200).json({
            date: targetDate,
            summary: {
                totalExpected,
                totalEvaluated,
                totalMissing: totalExpected - totalEvaluated,
                totalAdhered,
                totalDeviated,
                adherenceRate: overallAdherenceRate,
                totalPassed,
                totalRepeat,
                passRate: overallPassRate
            },
            teacherPerformance,
            detailedComparison
        });
    } catch (error) {
        console.error('Error getting accountability report:', error);
        res.status(500).json({ message: 'Failed to generate accountability report', error: error.message });
    }
};

// @desc    Update single student's Quran starting point (Bisinka & Aayadda)
// @route   PUT /api/quran/lessons/progress/:studentId
// @access  Private
const updateStudentQuranProgress = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { surahNumber, fromVerse, dailyPace } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const sNum = Number(surahNumber) || 1;
        const surah = QURAN_SURAHS.find(s => s.number === sNum) || QURAN_SURAHS[0];
        const pace = Math.max(1, Number(dailyPace) || 5);
        const fVerse = Math.max(1, Math.min(Number(fromVerse) || 1, surah.verses));
        const tVerse = Math.min(surah.verses, fVerse + (pace - 1));

        student.quranProgress = {
            surahNumber: sNum,
            surahName: surah.nameSo || surah.nameAr,
            fromVerse: fVerse,
            dailyPace: pace,
            lastStatus: 'passed',
            lastUpdated: new Date()
        };

        student.expectedLessonConfig = {
            ...(student.expectedLessonConfig ? student.expectedLessonConfig.toObject() : {}),
            surahNumber: sNum,
            surahName: surah.nameSo || surah.nameAr,
            fromVerse: fVerse,
            toVerse: tVerse,
            dailyPace: pace,
            lastAssignedAt: new Date()
        };

        await student.save();

        res.status(200).json({
            message: 'Student Quran starting point updated',
            quranProgress: student.quranProgress
        });
    } catch (error) {
        console.error('Error updating student Quran progress:', error);
        res.status(500).json({ message: 'Failed to update student Quran progress', error: error.message });
    }
};

module.exports = {
    getQuranLessonRecords,
    createQuranLessonRecord,
    updateQuranLessonRecord,
    deleteQuranLessonRecord,
    deleteClassQuranSheet,
    getClassQuranSheet,
    batchRecordQuranLessons,
    updateStudentQuranProgress,
    assignStudentQuranPlan,
    getAccountabilityReport
};
