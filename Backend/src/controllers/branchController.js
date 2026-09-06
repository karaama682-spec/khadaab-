const asyncHandler = require('../middleware/asyncHandler');
const Branch = require('../models/Branch');
const Class = require('../models/Class');
const Student = require('../models/Student');

// Branch names identify a campus across classes and reports, so they are matched
// case-insensitively on trimmed text: "FR1" and " fr1 " are the same branch, not
// two. Collation does the comparison in the database rather than by building a
// regular expression out of user input.
const findByName = (name) =>
    Branch.findOne({ name }).collation({ locale: 'en', strength: 2 });

const getBranchs = asyncHandler(async (req, res) => {
    // `?status=Active` backs the class form, which must only offer branches that
    // are still open. Without it the behaviour is unchanged: every branch.
    const filter = req.query.status ? { status: req.query.status } : {};
    const data = await Branch.find(filter).sort({ name: 1 });
    res.json(data);
});

const getBranchById = asyncHandler(async (req, res) => {
    const data = await Branch.findById(req.params.id);
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Branch not found');
    }
});

const createBranch = asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();

    if (!name) {
        res.status(400);
        throw new Error('Branch name is required');
    }

    const existing = await findByName(name);
    if (existing) {
        res.status(409);
        throw new Error('A branch with this name already exists');
    }

    const data = await Branch.create({ ...req.body, name });
    res.status(201).json(data);
});

const updateBranch = asyncHandler(async (req, res) => {
    const payload = { ...req.body };

    if (payload.name !== undefined) {
        const name = String(payload.name).trim();
        if (!name) {
            res.status(400);
            throw new Error('Branch name is required');
        }

        const clash = await findByName(name);
        if (clash && String(clash._id) !== String(req.params.id)) {
            res.status(409);
            throw new Error('A branch with this name already exists');
        }

        payload.name = name;
    }

    const data = await Branch.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true
    });

    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Branch not found');
    }
});

// A branch that classes or students already point at is never removed — the
// references would dangle and their records would lose their campus. Deactivating
// it keeps every row intact while taking it out of the new-class picker.
const deleteBranch = asyncHandler(async (req, res) => {
    const [classCount, studentCount] = await Promise.all([
        Class.countDocuments({ branchId: req.params.id }),
        Student.countDocuments({ branchId: req.params.id })
    ]);

    if (classCount > 0 || studentCount > 0) {
        res.status(409);
        throw new Error(
            `This branch is used by ${classCount} class(es) and ${studentCount} student(s). Deactivate it instead of deleting it.`
        );
    }

    const data = await Branch.findByIdAndDelete(req.params.id);
    if (data) {
        res.json({ message: 'Branch removed' });
    } else {
        res.status(404);
        throw new Error('Branch not found');
    }
});

module.exports = {
    getBranchs,
    getBranchById,
    createBranch,
    updateBranch,
    deleteBranch
};
