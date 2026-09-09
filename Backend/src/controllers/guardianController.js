const asyncHandler = require('../middleware/asyncHandler');
const Guardian = require('../models/Guardian');
const { phoneVariants, digitsOnly } = require('../utils/somaliPhone');

const getGuardians = asyncHandler(async (req, res) => {
    const phone = (req.query.phone || '').trim();
    let query = {};
    if (phone) {
        const variants = phoneVariants(phone);
        const clean = digitsOnly(phone);
        query = {
            $or: [
                { phone: { $in: variants } },
                { alternatePhone: { $in: variants } },
                { phone },
                { alternatePhone: phone },
                ...(clean ? [
                    { phone: new RegExp(clean, 'i') },
                    { alternatePhone: new RegExp(clean, 'i') }
                ] : [])
            ]
        };
    }
    const data = await Guardian.find(query).lean();
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
    const normalizedAltPhone = (req.body.alternatePhone || '').trim();

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
    // and check both primary phone and alternatePhone so either number resolves to the payer.
    const variants = phoneVariants(normalizedPhone);
    const altVariants = normalizedAltPhone ? phoneVariants(normalizedAltPhone) : [];
    const queryConditions = [
        { phone: { $in: variants } },
        { alternatePhone: { $in: variants } }
    ];
    if (altVariants.length > 0) {
        queryConditions.push(
            { phone: { $in: altVariants } },
            { alternatePhone: { $in: altVariants } }
        );
    }

    const existingGuardian = await Guardian.findOne({ $or: queryConditions });
    if (existingGuardian) {
        // If the existing guardian doesn't have an alternatePhone yet but one is supplied now, save it
        if (!existingGuardian.alternatePhone && normalizedAltPhone) {
            existingGuardian.alternatePhone = digitsOnly(normalizedAltPhone) || normalizedAltPhone;
            await existingGuardian.save();
        }
        res.status(200).json(existingGuardian);
        return;
    }

    // Stored as digits so the record is found again by any of its spellings,
    // matching how cashbook entries already store phone numbers.
    const data = await Guardian.create({
        ...req.body,
        phone: phoneDigits,
        alternatePhone: digitsOnly(normalizedAltPhone) || normalizedAltPhone || ''
    });
    res.status(201).json(data);
});

const updateGuardian = asyncHandler(async (req, res) => {
    const normalizedPhone = (req.body.phone || '').trim();
    const normalizedAltPhone = (req.body.alternatePhone || '').trim();

    if (normalizedPhone) {
        // Compare against every spelling of the number, matching how a guardian
        // is looked up on creation, so an edit cannot land on a number that
        // already belongs to a different payer just by being typed differently.
        const existingGuardian = await Guardian.findOne({
            phone: { $in: phoneVariants(normalizedPhone) },
            _id: { $ne: req.params.id }
        });
        if (existingGuardian) {
            res.status(409);
            throw new Error('A guardian with this phone number already exists');
        }
    }

    const updateData = {
        ...req.body,
        ...(normalizedPhone ? { phone: digitsOnly(normalizedPhone) || normalizedPhone } : {}),
        alternatePhone: digitsOnly(normalizedAltPhone) || normalizedAltPhone || ''
    };

    const data = await Guardian.findByIdAndUpdate(
        req.params.id,
        updateData,
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
