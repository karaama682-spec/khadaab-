const asyncHandler = require('../middleware/asyncHandler');
const Class = require('../models/Class');
const Branch = require('../models/Branch');

const getClasss = asyncHandler(async (req, res) => {
    const data = await Class.find().populate('branchId', 'name status').lean();
    res.json(data);
});

const getClassById = asyncHandler(async (req, res) => {
    const data = await Class.findById(req.params.id).populate('branchId', 'name status');
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
    res.status(201).json(await data.populate('branchId', 'name status'));
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
        .populate('branchId', 'name status');
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Class not found');
    }
});

const deleteClass = asyncHandler(async (req, res) => {
    const data = await Class.findByIdAndDelete(req.params.id);
    if (data) {
        res.json({ message: 'Class removed' });
    } else {
        res.status(404);
        throw new Error('Class not found');
    }
});

module.exports = {
    getClasss,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};
