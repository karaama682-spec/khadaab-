const QuranSurahRecord = require('../models/QuranSurahRecord');
const Student = require('../models/Student');
const Class = require('../models/Class');

// @desc    Get all Quran surah records with optional filtering
// @route   GET /api/quran/surahs
// @access  Private
const getQuranSurahRecords = async (req, res) => {
    try {
        const { search, classId, branchId, status, startDate, endDate } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { studentName: { $regex: search, $options: 'i' } },
                { surahName: { $regex: search, $options: 'i' } },
                { halaqahName: { $regex: search, $options: 'i' } },
                { note: { $regex: search, $options: 'i' } }
            ];
        }

        if (classId) {
            query.classId = classId;
        }

        if (branchId) {
            query.branchId = branchId;
        }

        if (status) {
            query.status = status;
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

        const records = await QuranSurahRecord.find(query)
            .populate('studentId', 'fullName studentCode rollNumber fatherPhone classId branchId')
            .populate('classId', 'name className branchId')
            .populate('branchId', 'name')
            .populate('teacherId', 'fullName username')
            .sort({ date: -1, createdAt: -1 });

        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching Quran surah records:', error);
        res.status(500).json({ message: 'Failed to fetch Quran records', error: error.message });
    }
};

// @desc    Create a new Quran surah record
// @route   POST /api/quran/surahs
// @access  Private
const createQuranSurahRecord = async (req, res) => {
    try {
        const {
            studentId,
            studentName,
            classId,
            branchId,
            halaqahName,
            surahName,
            surahNumber,
            status,
            note,
            date
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

        if (studentId) {
            const student = await Student.findById(studentId).populate('classId');
            if (student) {
                resolvedName = student.fullName || studentName;
                if (!resolvedClassId && student.classId) {
                    resolvedClassId = student.classId._id;
                }
                if (!resolvedHalaqah && student.classId) {
                    resolvedHalaqah = student.classId.name || student.classId.className || '';
                }
                if (!resolvedBranchId) {
                    resolvedBranchId = student.branchId || (student.classId && student.classId.branchId) || undefined;
                }
            }
        }

        const record = new QuranSurahRecord({
            studentId,
            studentName: resolvedName,
            classId: resolvedClassId,
            branchId: resolvedBranchId,
            halaqahName: resolvedHalaqah || '',
            surahName: surahName.trim(),
            surahNumber: surahNumber ? Number(surahNumber) : undefined,
            status: status === 'repeat' ? 'repeat' : 'passed',
            note: note ? note.trim() : '',
            date: date ? new Date(date) : new Date(),
            teacherId: req.user ? req.user._id : undefined
        });

        const savedRecord = await record.save();
        const populated = await QuranSurahRecord.findById(savedRecord._id)
            .populate('studentId', 'fullName studentCode rollNumber fatherPhone classId branchId')
            .populate('classId', 'name className branchId')
            .populate('branchId', 'name')
            .populate('teacherId', 'fullName username');

        res.status(201).json(populated);

    } catch (error) {
        console.error('Error creating Quran surah record:', error);
        res.status(500).json({ message: 'Failed to save Quran record', error: error.message });
    }
};

// @desc    Update a Quran surah record
// @route   PUT /api/quran/surahs/:id
// @access  Private
const updateQuranSurahRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            studentId,
            studentName,
            classId,
            halaqahName,
            surahName,
            surahNumber,
            status,
            note,
            date
        } = req.body;

        const record = await QuranSurahRecord.findById(id);
        if (!record) {
            return res.status(404).json({ message: 'Quran record not found' });
        }

        if (studentId) record.studentId = studentId;
        if (studentName) record.studentName = studentName;
        if (classId !== undefined) record.classId = classId;
        if (halaqahName !== undefined) record.halaqahName = halaqahName;
        if (surahName) record.surahName = surahName.trim();
        if (surahNumber !== undefined) record.surahNumber = surahNumber ? Number(surahNumber) : undefined;
        if (status) record.status = status;
        if (note !== undefined) record.note = note.trim();
        if (date) record.date = new Date(date);

        const updated = await record.save();
        const populated = await QuranSurahRecord.findById(updated._id)
            .populate('studentId', 'fullName studentCode rollNumber fatherPhone classId')
            .populate('classId', 'name className')
            .populate('teacherId', 'fullName username');

        res.status(200).json(populated);
    } catch (error) {
        console.error('Error updating Quran surah record:', error);
        res.status(500).json({ message: 'Failed to update Quran record', error: error.message });
    }
};

// @desc    Delete a Quran surah record
// @route   DELETE /api/quran/surahs/:id
// @access  Private
const deleteQuranSurahRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await QuranSurahRecord.findById(id);
        if (!record) {
            return res.status(404).json({ message: 'Quran record not found' });
        }

        await QuranSurahRecord.findByIdAndDelete(id);
        res.status(200).json({ message: 'Quran record deleted successfully' });
    } catch (error) {
        console.error('Error deleting Quran surah record:', error);
        res.status(500).json({ message: 'Failed to delete Quran record', error: error.message });
    }
};

module.exports = {
    getQuranSurahRecords,
    createQuranSurahRecord,
    updateQuranSurahRecord,
    deleteQuranSurahRecord
};
