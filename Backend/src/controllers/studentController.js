const asyncHandler = require('../middleware/asyncHandler');
const Student = require('../models/Student');
const { generateStudentCode, withRetry } = require('../utils/generateCode');

const getStudents = asyncHandler(async (req, res) => {
    // Status handling for the Exit/Archive feature:
    //   (no status)      → active workflows: everyone EXCEPT Exited (archived).
    //   ?status=Exited   → only exited students (Exit Students page).
    //   ?status=All      → everyone, exited included.
    //   ?status=<value>  → that exact status.
    const { status } = req.query;
    let filter;
    if (status === 'All') filter = {};
    else if (status) filter = { status };
    else filter = { status: { $ne: 'Exited' } };

    const data = await Student.find(filter)
        .populate('guardianId')
        .populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } })
        .lean();
    res.json(data);
});

const getStudentById = asyncHandler(async (req, res) => {
    const data = await Student.findById(req.params.id).populate('guardianId').populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } });
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
});

const createStudent = asyncHandler(async (req, res) => {
    const payload = { ...req.body };

    // The student ID is issued by the system, never accepted from the client and
    // never derived from the user-typed roll number, so it cannot be set by hand
    // or duplicated. Existing students keep whatever code they were given.
    delete payload.studentCode;
    // Each retry advances the counter, so a run of legacy students already
    // holding plain numbers is stepped over rather than colliding with.
    payload.studentCode = await withRetry(
        generateStudentCode,
        async (code) => Boolean(await Student.exists({ studentCode: code })),
        200
    );

    if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
    }

    if (payload.fee !== undefined && payload.monthlyFee === undefined) {
        payload.monthlyFee = Number(payload.fee) || 0;
    }
    if (payload.monthlyFee !== undefined && payload.fee === undefined) {
        payload.fee = Number(payload.monthlyFee) || 0;
    }

    const data = await Student.create(payload);
    const populated = await Student.findById(data._id).populate('guardianId').populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } });
    res.status(201).json(populated || data);
});

const updateStudent = asyncHandler(async (req, res) => {
    const payload = { ...req.body };

    // The issued student ID stays with the student for life, so an edit can never
    // move or clear it.
    delete payload.studentCode;

    if (payload.fee !== undefined && payload.monthlyFee === undefined) {
        payload.monthlyFee = Number(payload.fee) || 0;
    }
    if (payload.monthlyFee !== undefined && payload.fee === undefined) {
        payload.fee = Number(payload.monthlyFee) || 0;
    }

    const data = await Student.findByIdAndUpdate(req.params.id, payload, { new: true }).populate('guardianId').populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } });
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
});

const deleteStudent = asyncHandler(async (req, res) => {
    const data = await Student.findByIdAndDelete(req.params.id);
    if (data) {
        res.json({ message: 'Student removed' });
    } else {
        res.status(404);
        throw new Error('Student not found');
    }
});

// @desc    Exit / archive a student (Active → Exited). NO data is deleted; the
//          student keeps the same id, fees, payments and history. Exit only flips
//          status and records who/when/why so every active workflow excludes them.
// @route   POST /api/students/:id/exit
const exitStudent = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) {
        res.status(404);
        throw new Error('Student not found');
    }
    if (student.status === 'Exited') {
        res.status(400);
        throw new Error('Student has already exited');
    }

    const reason = (req.body.exitReason ?? req.body.reason ?? req.body.description ?? '').toString().trim();
    student.status = 'Exited';
    student.exitReason = reason;
    student.exitDate = req.body.exitDate ? new Date(req.body.exitDate) : new Date();
    student.exitedBy = req.user?._id || null;
    student.exitedAt = new Date();
    await student.save();

    const populated = await Student.findById(student._id)
        .populate('guardianId')
        .populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } })
        .populate('exitedBy', 'fullName email');
    res.json(populated);
});

// @desc    Full archive/history for one (exited or active) student — read-only.
// @route   GET /api/students/:id/archive
const getStudentArchive = asyncHandler(async (req, res) => {
    const Payment = require('../models/Payment');
    const StudentAttendance = require('../models/StudentAttendance');
    const ExamResult = require('../models/ExamResult');
    const Transaction = require('../models/Transaction');

    const student = await Student.findById(req.params.id)
        .populate('guardianId')
        .populate({ path: 'classId', populate: { path: 'branchId', select: 'name' } })
        .populate('branchId', 'name')
        .populate('exitedBy', 'fullName email');
    if (!student) {
        res.status(404);
        throw new Error('Student not found');
    }

    const payments = await Payment.find({ studentId: student._id })
        .populate('walletId', 'name type')
        .sort({ paymentDate: -1, createdAt: -1 })
        .lean();

    // Financials are computed ONLY from this student's own records — never mixed
    // with any other student.
    const registeredFee = Number(student.monthlyFee ?? student.fee ?? 0);
    const totalPaid = payments
        .filter(p => p.status === 'Completed')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = Math.max(0, registeredFee - totalPaid);

    const paymentIds = payments.map(p => p._id);
    const [attendance, examResults, transactions] = await Promise.all([
        StudentAttendance.find({ studentId: student._id })
            .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } })
            .sort({ date: -1, createdAt: -1 })
            .lean(),
        ExamResult.find({ studentId: student._id })
            .populate('examId', 'name title term date')
            .sort({ createdAt: -1 })
            .lean(),
        paymentIds.length
            ? Transaction.find({ referenceId: { $in: paymentIds } }).populate('walletId', 'name type').sort({ date: -1 }).lean()
            : Promise.resolve([])
    ]);

    res.json({
        student,
        financial: { registeredFee, totalPaid, remaining },
        payments,
        attendance,
        examResults,
        transactions,
        exit: {
            status: student.status,
            exitReason: student.exitReason || '',
            exitDate: student.exitDate,
            exitedBy: student.exitedBy || null,
            exitedAt: student.exitedAt
        }
    });
});

module.exports = {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    exitStudent,
    getStudentArchive
};
