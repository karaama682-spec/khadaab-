const asyncHandler = require('../middleware/asyncHandler');
const Class = require('../models/Class');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const { logAudit } = require('../utils/auditLogger');

const getClasss = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.branchId) filter.branchId = req.query.branchId;
    if (req.query.status) filter.status = req.query.status;

    // Teachers only see the classes they teach (or classes in their assigned branch)
    if (req.user && req.user.role === 'Teacher') {
        const teacherBranch = req.user.branchId || (req.user.branchIds && req.user.branchIds[0]);

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
            filter._id = { $in: allowedClassIds };
        } else if (teacherBranch) {
            filter.branchId = teacherBranch;
        }
    }

    const data = await Class.find(filter)
        .populate('branchId', 'name status')
        .populate('teacherId', 'fullName name phone role branchId branchIds')
        .lean();
    res.json(data);
});

const getClassById = asyncHandler(async (req, res) => {
    const data = await Class.findById(req.params.id)
        .populate('branchId', 'name status')
        .populate('teacherId', 'fullName name phone role branchId branchIds');
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Class not found');
    }
});

const normalizeClassPayload = (req) => {
    const payload = { ...req.body };

    if (payload.name && !payload.className) {
        payload.className = payload.name;
    }

    if (!payload.name && payload.className) {
        payload.name = payload.className;
    }

    if (payload.fee !== undefined && payload.monthlyFee === undefined) {
        payload.monthlyFee = payload.fee;
    }

    if (payload.gradeLevel === undefined) {
        payload.gradeLevel = '';
    }

    if (payload.room === undefined) {
        payload.room = '';
    }

    if (!payload.teacherId || payload.teacherId === '') {
        payload.teacherId = null;
    }

    return payload;
};

// A class is taught at exactly one campus, so the branch it names must exist and
// still be open. Throws with a clear message rather than letting a bad id reach
// the database as a dangling reference.
const assertUsableBranch = async (branchId, res) => {
    const branch = await Branch.findById(branchId).catch(() => null);

    if (!branch) {
        res.status(400);
        throw new Error('Selected branch does not exist');
    }

    if (branch.status !== 'Active') {
        res.status(400);
        throw new Error('Selected branch is inactive and cannot be assigned to a class');
    }
};

const createClass = asyncHandler(async (req, res) => {
    const payload = normalizeClassPayload(req);

    if (!payload.branchId) {
        res.status(400);
        throw new Error('Branch is required');
    }
    await assertUsableBranch(payload.branchId, res);

    const data = await Class.create(payload);
    const populated = await Class.findById(data._id)
        .populate('branchId', 'name status')
        .populate('teacherId', 'fullName name phone role branchId branchIds');
    res.status(201).json(populated);
});

const updateClass = asyncHandler(async (req, res) => {
    const payload = normalizeClassPayload(req);

    // Only validated when the edit actually carries a branch. Classes recorded
    // before branches existed keep their empty branch until someone sets one.
    if (payload.branchId) {
        await assertUsableBranch(payload.branchId, res);
    } else {
        delete payload.branchId;
    }

    const data = await Class.findByIdAndUpdate(req.params.id, payload, { new: true })
        .populate('branchId', 'name status')
        .populate('teacherId', 'fullName name phone role branchId branchIds');
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Class not found');
    }
});

const deleteClass = asyncHandler(async (req, res) => {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
        res.status(404);
        throw new Error('Class not found');
    }
    await logAudit({
        req,
        action: 'DELETE',
        entityType: 'Class',
        entityId: cls._id,
        entityName: cls.name,
        snapshot: cls.toObject ? cls.toObject() : cls
    });
    await cls.deleteOne();
    res.json({ message: 'Class removed and logged to audit trail' });
});

module.exports = {
    getClasss,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};
