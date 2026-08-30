const asyncHandler = require('../middleware/asyncHandler');
const Student = require('../models/Student');
const { generateStudentCode, withRetry } = require('../utils/generateCode');

const getStudents = asyncHandler(async (req, res) => {
    const data = await Student.find().populate('guardianId').populate('classId');
    res.json(data);
});

const getStudentById = asyncHandler(async (req, res) => {
    const data = await Student.findById(req.params.id).populate('guardianId').populate('classId');
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
    const populated = await Student.findById(data._id).populate('guardianId').populate('classId');
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

    const data = await Student.findByIdAndUpdate(req.params.id, payload, { new: true }).populate('guardianId').populate('classId');
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

module.exports = {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};
