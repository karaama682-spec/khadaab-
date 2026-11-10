const asyncHandler = require('../middleware/asyncHandler');
const Subject = require('../models/Subject');

// @desc    Get all subjects (with optional classId, status filters)
// @route   GET /api/subjects
// @access  Private
const getSubjects = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.classId) {
        filter.classIds = req.query.classId;
    }
    if (req.query.status) {
        filter.status = req.query.status;
    }
    if (req.user?.branchId && !req.query.allBranches) {
        // Allow subjects created institute-wide or for this branch
        filter.$or = [{ branchId: req.user.branchId }, { branchId: null }, { branchId: { $exists: false } }];
    }

    const subjects = await Subject.find(filter)
        .populate('classIds', 'name className gradeLevel')
        .populate('teacherId', 'fullName name email phone')
        .sort({ name: 1 })
        .lean();

    res.json(subjects);
});

// @desc    Get single subject by ID
// @route   GET /api/subjects/:id
// @access  Private
const getSubjectById = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id)
        .populate('classIds', 'name className gradeLevel')
        .populate('teacherId', 'fullName name email phone');

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found');
    }

    res.json(subject);
});

// @desc    Create new subject
// @route   POST /api/subjects
// @access  Private
const createSubject = asyncHandler(async (req, res) => {
    const payload = { ...req.body, createdBy: req.user?._id };
    if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
    }

    if (!payload.name || !payload.name.trim()) {
        res.status(400);
        throw new Error('Subject name is required');
    }

    const nisfiFullMarks = Math.max(0, Number(payload.nisfiFullMarks) || 40);
    const nihaayiFullMarks = Math.max(0, Number(payload.nihaayiFullMarks) || 60);
    payload.nisfiFullMarks = nisfiFullMarks;
    payload.nihaayiFullMarks = nihaayiFullMarks;
    payload.fullMarks = Number(payload.fullMarks) || (nisfiFullMarks + nihaayiFullMarks);
    payload.passMarks = Math.max(0, Number(payload.passMarks) || 40);

    const subject = await Subject.create(payload);
    const populated = await Subject.findById(subject._id)
        .populate('classIds', 'name className gradeLevel')
        .populate('teacherId', 'fullName name email phone');

    res.status(201).json(populated);
});

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private
const updateSubject = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (payload.nisfiFullMarks !== undefined || payload.nihaayiFullMarks !== undefined) {
        const nisfiFullMarks = Math.max(0, Number(payload.nisfiFullMarks) || 40);
        const nihaayiFullMarks = Math.max(0, Number(payload.nihaayiFullMarks) || 60);
        payload.nisfiFullMarks = nisfiFullMarks;
        payload.nihaayiFullMarks = nihaayiFullMarks;
        if (!payload.fullMarks) {
            payload.fullMarks = nisfiFullMarks + nihaayiFullMarks;
        }
    }

    const subject = await Subject.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
        .populate('classIds', 'name className gradeLevel')
        .populate('teacherId', 'fullName name email phone');

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found');
    }

    res.json(subject);
});

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
// @access  Private
const deleteSubject = asyncHandler(async (req, res) => {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
        res.status(404);
        throw new Error('Subject not found');
    }
    res.json({ message: 'Subject removed' });
});

module.exports = {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
};
