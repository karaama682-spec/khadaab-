const asyncHandler = require('../middleware/asyncHandler');
const Guardian = require('../models/Guardian');
const { phoneVariants, digitsOnly } = require('../utils/somaliPhone');

const getGuardians = asyncHandler(async (req, res) => {
    const phone = (req.query.phone || '').trim();
    const query = phone ? { phone } : {};
    const data = await Guardian.find(query);
    res.json(data);
});

const getGuardianById = asyncHandler(async (req, res) => {
    const data = await Guardian.findById(req.params.id);
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Guardian not found');
    }
});

const createGuardian = asyncHandler(async (req, res) => {
    const normalizedPhone = (req.body.phone || '').trim();

    if (!normalizedPhone) {
        res.status(400);
        throw new Error('Guardian phone number is required');
    }

    // A number carries no identity without digits, and an empty phone would fail
    // the schema's required rule further down with a less useful error.
    const phoneDigits = digitsOnly(normalizedPhone);
    if (!phoneDigits) {
        res.status(400);
        throw new Error('Guardian phone number must contain digits');
    }

    // Match on every spelling of the number rather than the exact string typed,
    // so the same parent entered as 0614…, 614… or +252 614… resolves to the one
    // payer record instead of a second being created alongside it. One parent
    // keeps one payer identity across branches and programmes.
    const existingGuardian = await Guardian.findOne({ phone: { $in: phoneVariants(normalizedPhone) } });
    if (existingGuardian) {
        res.status(200).json(existingGuardian);
        return;
    }

    // Stored as digits so the record is found again by any of its spellings,
    // matching how cashbook entries already store phone numbers. Existing rows
    // are left exactly as they are — the variant lookup above still finds them.
    const data = await Guardian.create({ ...req.body, phone: phoneDigits });
    res.status(201).json(data);
});

const updateGuardian = asyncHandler(async (req, res) => {
    const normalizedPhone = (req.body.phone || '').trim();

    if (normalizedPhone) {
        // Compare against every spelling of the number, matching how a guardian
        // is looked up on creation, so an edit cannot land on a number that
        // already belongs to a different payer just by being typed differently.
        // The record being edited is excluded, so saving its own number — in any
        // format — is never reported as a collision.
        const existingGuardian = await Guardian.findOne({
            phone: { $in: phoneVariants(normalizedPhone) },
            _id: { $ne: req.params.id }
        });
        if (existingGuardian) {
            res.status(409);
            throw new Error('A guardian with this phone number already exists');
        }
    }

    // Stored as digits, the same rule createGuardian follows, so a record saved
    // here stays discoverable by every spelling of its number. Leaving the raw
    // text in place would write values such as "0614 047 121" that the variant
    // lookups above could no longer match.
    const data = await Guardian.findByIdAndUpdate(
        req.params.id,
        { ...req.body, phone: digitsOnly(normalizedPhone) || undefined },
        { new: true }
    );
    if (data) {
        res.json(data);
    } else {
        res.status(404);
        throw new Error('Guardian not found');
    }
});

const deleteGuardian = asyncHandler(async (req, res) => {
    const data = await Guardian.findByIdAndDelete(req.params.id);
    if (data) {
        res.json({ message: 'Guardian removed' });
    } else {
        res.status(404);
        throw new Error('Guardian not found');
    }
});

module.exports = {
    getGuardians,
    getGuardianById,
    createGuardian,
    updateGuardian,
    deleteGuardian
};
