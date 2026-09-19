const asyncHandler = require('../middleware/asyncHandler');
const StudentAttendance = require('../models/StudentAttendance');
const Student = require('../models/Student');
const Notification = require('../models/Notification');

// Count late/absent occurrences and trigger warnings if they are multiples of 3
const checkAndTriggerWarnings = async (studentId) => {
    try {
        const student = await Student.findById(studentId).populate('guardianId');
        if (!student) return;

        // Count total Late records
        const lateCount = await StudentAttendance.countDocuments({ studentId, status: 'Late' });
        if (lateCount > 0 && lateCount % 3 === 0) {
            const message = `Attendance Alert: Student ${student.fullName} (Code: ${student.studentCode || ''}) has reached ${lateCount} Late records.`;
            await Notification.create({
                title: 'Late Attendance Warning',
                message,
                receiverType: 'Guardian',
                receiverId: student.guardianId?._id || student._id
            });
        }

        // Count total Absent records
        const absentCount = await StudentAttendance.countDocuments({ studentId, status: 'Absent' });
        if (absentCount > 0 && absentCount % 3 === 0) {
            const message = `Attendance Alert: Student ${student.fullName} (Code: ${student.studentCode || ''}) has reached ${absentCount} Absent records.`;
            await Notification.create({
                title: 'Absent Attendance Warning',
                message,
                receiverType: 'Guardian',
                receiverId: student.guardianId?._id || student._id
            });
        }
    } catch (err) {
        console.error('Failed to process attendance warning', err);
    }
};

const getStudentAttendances = asyncHandler(async (req, res) => {
    const { classId, studentId, date, session, attendanceType, startDate, endDate } = req.query;
    const query = {};
    if (classId) query.classId = classId;
    if (studentId) query.studentId = studentId;
    if (attendanceType) query.attendanceType = attendanceType;
    if (session) query.session = session;
    
    if (date) {
        query.date = date;
    } else if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
    }

    // Load matching records, sorting by date/timestamp to allow finding the latest recorded status
    const data = await StudentAttendance.find(query)
        .populate('studentId')
        .populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } })
        .populate('markedBy', 'fullName email')
        .sort({ date: -1, createdAt: -1 });

    // Deduplicate: Keep the newest record per (studentId + date + attendanceType + session)
    // Daily Attendance (Present/Absent) and Session Attendance (Late/Partial) are separate and independent.
    const latestRecords = [];
    const seen = new Set();
    for (const record of data) {
        const type = record.attendanceType || (record.session ? 'Session' : 'Daily');
        const sess = type === 'Session' ? (record.session || 'Morning') : 'Daily';
        const key = `${record.studentId?._id || record.studentId}:${record.date}:${type}:${sess}`;
        if (!seen.has(key)) {
            seen.add(key);
            latestRecords.push(record);
        }
    }
    res.json(latestRecords);
});

const getStudentAttendanceById = asyncHandler(async (req, res) => {
    const data = await StudentAttendance.findById(req.params.id)
        .populate('studentId')
        .populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } })
        .populate('markedBy', 'fullName email');
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('StudentAttendance not found');
    }
});

const createStudentAttendance = asyncHandler(async (req, res) => {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const item of records) {
        const { studentId, classId, date, status, session, attendanceType, arrivalTime, description } = item;
        if (!studentId || !classId || !date) continue;

        // Determine if this record is Daily Attendance (Present/Absent) or Session Attendance (Late/Partial)
        const isSession = attendanceType === 'Session' || Boolean(session && ['Morning', 'Breakfast', 'Evening'].includes(session) && (status === 'Late' || status === 'Partial'));
        const type = isSession ? 'Session' : 'Daily';
        const nextStatus = status || (isSession ? 'Late' : 'Present');

        if (type === 'Daily') {
            // Daily Attendance: No session, once per student + date + attendanceType: 'Daily'
            const fields = {
                classId,
                status: nextStatus,
                attendanceType: 'Daily',
                session: null,
                arrivalTime: '',
                description: nextStatus === 'Present' ? '' : (description || '').trim(),
                markedBy: req.user?._id
            };

            let existing = null;
            if (item._id) {
                existing = await StudentAttendance.findById(item._id);
            }
            if (!existing) {
                existing = await StudentAttendance.findOne({
                    studentId,
                    date,
                    $or: [
                        { attendanceType: 'Daily' },
                        { attendanceType: { $ne: 'Session' }, session: { $in: [null, undefined] } }
                    ]
                });
            }

            let created;
            if (existing) {
                created = await StudentAttendance.findByIdAndUpdate(
                    existing._id,
                    { $set: fields },
                    { new: true }
                );
            } else {
                created = await StudentAttendance.findOneAndUpdate(
                    {
                        studentId,
                        date,
                        attendanceType: 'Daily'
                    },
                    {
                        $set: fields,
                        $setOnInsert: { studentId, date }
                    },
                    { new: true, upsert: true, setDefaultsOnInsert: true }
                );
            }

            if (!existing || existing.status !== nextStatus) {
                await checkAndTriggerWarnings(studentId);
            }
            results.push(created);
        } else {
            // Session Attendance: Morning / Breakfast / Evening, for Late / Partial
            // Daily Absent Lock: If student's Daily Attendance is saved as Absent, lock Session Attendance on this date.
            const dailyAttendance = await StudentAttendance.findOne({
                studentId,
                date,
                $or: [
                    { attendanceType: 'Daily' },
                    { attendanceType: { $ne: 'Session' }, session: { $in: [null, undefined] } }
                ]
            });

            if (dailyAttendance && dailyAttendance.status === 'Absent') {
                res.status(400);
                throw new Error('Student is marked as Absent for Daily Attendance on this date. Session Attendance cannot be recorded unless Daily Attendance is changed to Present.');
            }

            const attendanceSession = session || 'Morning';
            const existing = await StudentAttendance.findOne({
                studentId,
                date,
                session: attendanceSession,
                attendanceType: 'Session'
            });

            const fields = {
                classId,
                status: nextStatus,
                attendanceType: 'Session',
                session: attendanceSession,
                arrivalTime: nextStatus === 'Late' ? (arrivalTime || '08:30') : '',
                description: (description || '').trim(),
                markedBy: req.user?._id
            };

            const created = await StudentAttendance.findOneAndUpdate(
                { studentId, date, session: attendanceSession, attendanceType: 'Session' },
                {
                    $set: fields,
                    $setOnInsert: { studentId, date }
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );

            if (!existing || existing.status !== nextStatus) {
                await checkAndTriggerWarnings(studentId);
            }
            results.push(created);
        }
    }

    res.status(201).json(Array.isArray(req.body) ? results : (results[0] || {}));
});

const getStudentAttendanceHistory = asyncHandler(async (req, res) => {
    const { studentId, startDate, endDate, status } = req.query;
    if (!studentId) {
        res.status(400);
        throw new Error('studentId is required');
    }

    const query = { studentId };

    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
    }

    if (status && status !== 'All') {
        query.status = status;
    }

    const data = await StudentAttendance.find(query)
        .populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } })
        .populate('markedBy', 'fullName')
        .sort({ date: -1, createdAt: -1 });

    res.json(data);
});

const updateStudentAttendance = asyncHandler(async (req, res) => {
    const targetRecord = await StudentAttendance.findById(req.params.id);
    if (!targetRecord) {
        res.status(404);
        throw new Error('StudentAttendance not found');
    }

    // Daily Absent Lock: If updating a Session Attendance record, verify student's Daily Attendance is not Absent
    if (targetRecord.attendanceType === 'Session' || req.body.attendanceType === 'Session') {
        const studentId = targetRecord.studentId;
        const date = targetRecord.date;
        const dailyAttendance = await StudentAttendance.findOne({
            studentId,
            date,
            $or: [
                { attendanceType: 'Daily' },
                { attendanceType: { $ne: 'Session' }, session: { $in: [null, undefined] } }
            ]
        });

        if (dailyAttendance && dailyAttendance.status === 'Absent') {
            res.status(400);
            throw new Error('Student is marked as Absent for Daily Attendance on this date. Session Attendance cannot be updated unless Daily Attendance is changed to Present.');
        }
    }

    const updates = { ...req.body };

    // Same rule as the create path: a reason belongs only to a late or absent
    // record. The report screen edits a status without sending a description, so
    // without this a stale reason would survive a correction back to Present.
    if (updates.status === 'Present') {
        updates.description = '';
    }

    const data = await StudentAttendance.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(data);
});

const deleteStudentAttendance = asyncHandler(async (req, res) => {
    const data = await StudentAttendance.findByIdAndDelete(req.params.id);
    if (data) {
        res.json({ message: 'StudentAttendance removed' });
    } else {
        res.status(404);
        throw new Error('StudentAttendance not found');
    }
});

module.exports = {
    getStudentAttendances,
    getStudentAttendanceById,
    createStudentAttendance,
    getStudentAttendanceHistory,
    updateStudentAttendance,
    deleteStudentAttendance
};
