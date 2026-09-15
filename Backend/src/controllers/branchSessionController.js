const asyncHandler = require('../middleware/asyncHandler');
const BranchSession = require('../models/BranchSession');
const Branch = require('../models/Branch');

const { SESSION_NAMES, DEFAULT_TIMES } = BranchSession;

// Basic 24-hour HH:MM validation (00:00 - 23:59).
const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim());

const sortBySessionOrder = (docs) =>
    [...docs].sort((a, b) => SESSION_NAMES.indexOf(a.name) - SESSION_NAMES.indexOf(b.name));

// Guarantee a branch has exactly the three sessions, creating any that are
// missing at their default time. Safe to call repeatedly: existing rows (and any
// custom times already saved) are left untouched. Used both when a branch is
// created and lazily when its sessions are first read, so branches that existed
// before this feature get their defaults with no manual migration.
const ensureBranchSessions = async (branchId) => {
    const existing = await BranchSession.find({ branchId });
    const haveNames = new Set(existing.map((doc) => doc.name));

    const toCreate = SESSION_NAMES
        .filter((name) => !haveNames.has(name))
        .map((name) => ({ branchId, name, time: DEFAULT_TIMES[name], status: 'Active' }));

    if (toCreate.length) {
        // ordered:false so a concurrent creator racing on the unique index does
        // not abort the whole batch; duplicates are simply skipped.
        await BranchSession.insertMany(toCreate, { ordered: false }).catch((err) => {
            if (err.code !== 11000) throw err;
        });
    }

    return sortBySessionOrder(await BranchSession.find({ branchId }));
};

// @desc    Get the three session times for a branch (auto-seeds defaults)
// @route   GET /api/branch-sessions/:branchId
// @access  Private
const getBranchSessions = asyncHandler(async (req, res) => {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId);
    if (!branch) {
        res.status(404);
        throw new Error('Branch not found');
    }

    const sessions = await ensureBranchSessions(branchId);
    res.json(sessions);
});

// @desc    Update session times for ONE branch only
// @route   PUT /api/branch-sessions/:branchId
// @access  Private
// @body    { Morning: 'HH:MM', Breakfast: 'HH:MM', Evening: 'HH:MM' }
//          (any subset) OR [{ name, time }, ...]
const updateBranchSessions = asyncHandler(async (req, res) => {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId);
    if (!branch) {
        res.status(404);
        throw new Error('Branch not found');
    }

    // Accept either a { name: time } map or an array of { name, time }.
    const body = req.body || {};
    const updates = Array.isArray(body)
        ? body
        : SESSION_NAMES.filter((name) => body[name] !== undefined).map((name) => ({ name, time: body[name] }));

    if (!updates.length) {
        res.status(400);
        throw new Error('No session times provided');
    }

    for (const { name, time } of updates) {
        if (!SESSION_NAMES.includes(name)) {
            res.status(400);
            throw new Error(`Invalid session name: ${name}. Allowed: ${SESSION_NAMES.join(', ')}`);
        }
        if (!isValidTime(time)) {
            res.status(400);
            throw new Error(`Invalid time for ${name}. Expected 24-hour HH:MM.`);
        }
    }

    // Make sure the branch has its full set first (covers pre-existing branches),
    // then apply only this branch's changes. Scoped by branchId, so no other
    // branch is ever touched.
    await ensureBranchSessions(branchId);

    for (const { name, time } of updates) {
        await BranchSession.findOneAndUpdate(
            { branchId, name },
            { $set: { time: String(time).trim() } },
            { new: true }
        );
    }

    const sessions = sortBySessionOrder(await BranchSession.find({ branchId }));
    res.json(sessions);
});

module.exports = {
    getBranchSessions,
    updateBranchSessions,
    ensureBranchSessions
};
