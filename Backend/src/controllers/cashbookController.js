const asyncHandler = require('../middleware/asyncHandler');
const CashbookCategory = require('../models/CashbookCategory');
const CashbookEntry = require('../models/CashbookEntry');
const Guardian = require('../models/Guardian');
const Student = require('../models/Student');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Payment = require('../models/Payment');
const Salary = require('../models/Salary');
const { phoneVariants, isValidSomaliMobile, digitsOnly } = require('../utils/somaliPhone');
const {
    cycleKeyForDate, cycleRange, isValidCycleKey, addCycles,
    currentCycle, nextCycle, cycleMatch
} = require('../utils/billingCycle');

// The wallet is populated alongside the category so reports can name the
// institute side of a transaction: it is the sender on an expense and the
// receiver on an income.
const populateEntry = [
    { path: 'categoryId', select: 'title type description' },
    { path: 'walletId', select: 'name accountNumber type' }
];

// Resolve the wallet an entry should affect: explicit wallet → branch's active wallet → any active wallet.
const resolveWallet = async (walletId, branchId) => {
    let wallet = null;
    if (walletId) wallet = await Wallet.findById(walletId);
    if (!wallet && branchId) wallet = await Wallet.findOne({ branchId, status: 'Active' });
    if (!wallet) wallet = await Wallet.findOne({ status: 'Active' });
    return wallet;
};

// Apply a signed effect to a wallet balance. sign = +1 to apply, -1 to reverse.
// Income raises the balance, Expense lowers it (clamped at 0, mirroring expense/payment flows).
const applyWalletEffect = async (wallet, type, amount, sign = 1) => {
    if (!wallet) return;
    const delta = (type === 'Income' ? 1 : -1) * Number(amount || 0) * sign;
    wallet.balance = Math.max(0, (wallet.balance || 0) + delta);
    await wallet.save();
};

// Keep student fee Payment records in sync with a Cashbook entry.
// When a responsible payer (guardian / student's father) records Income, the
// amount is allocated across their students' outstanding monthly balances and
// stored as Payment records — WITHOUT crediting the wallet again (the Cashbook
// entry already did). This is what makes "Remaining" drop after a partial pay.
const syncFeePayments = async (entry, category, createdBy) => {
    // Always clear any prior fee payments tied to this entry first (idempotent).
    await Payment.deleteMany({ sourceEntryId: entry._id });

    if (!category || category.type !== 'Income') return null;
    if (!['guardian', 'student'].includes(entry.senderEntityType)) return null;

    const variants = phoneVariants(entry.senderPhone);
    const orConds = [];
    if (variants.length) orConds.push({ fatherPhone: { $in: variants } });
    if (entry.senderEntityType === 'guardian' && entry.senderEntityId) {
        orConds.push({ guardianId: entry.senderEntityId });
    }
    if (!orConds.length) return null;

    // Exited (archived) students never receive new fee allocations.
    const students = await Student.find({ $or: orConds, status: { $ne: 'Exited' } })
        .select('fullName monthlyFee fee guardianId branchId');
    if (!students.length) return null;

    // The starting billing cycle: the entry's target cycle if set, else derived
    // from the entry's actual date (25th→24th rule).
    const startCycle = isValidCycleKey(entry.targetMonth) ? entry.targetMonth : cycleKeyForDate(entry.date);

    // Owed in the STARTING cycle (for the ledger snapshot below).
    let totalOwedBefore = 0;
    for (const s of students) {
        const paidDocs = await Payment.find({
            studentId: s._id, status: 'Completed', ...cycleMatch('billingCycle', 'paymentDate', startCycle)
        }).select('amount');
        const paid = paidDocs.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        totalOwedBefore += Math.max(0, Number(s.monthlyFee || s.fee || 0) - paid);
    }

    // Allocate to the starting cycle first, then roll leftover into upcoming
    // billing cycles (pre-payment). Capped at 12 cycles ahead.
    let leftover = Number(entry.amount) || 0;
    const toCreate = [];
    for (let cOffset = 0; cOffset < 12 && leftover > 0; cOffset++) {
        const cycle = addCycles(startCycle, cOffset);
        for (const s of students) {
            if (leftover <= 0) break;
            const paidDocs = await Payment.find({
                studentId: s._id, status: 'Completed', ...cycleMatch('billingCycle', 'paymentDate', cycle)
            }).select('amount');
            const paid = paidDocs.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const monthlyFee = Number(s.monthlyFee || s.fee || 0);
            const remaining = Math.max(0, monthlyFee - paid);
            if (remaining <= 0) continue;
            const alloc = Math.min(remaining, leftover);
            toCreate.push({
                studentId: s._id,
                guardianId: s.guardianId || undefined,
                walletId: entry.walletId,
                amount: alloc,
                month: cycle,
                billingCycle: cycle,
                paymentDate: entry.date || new Date(),
                paymentMethod: ['Bank', 'Mobile Money', 'Card'].includes(entry.method) ? 'Bank Transfer' : 'Cash',
                status: 'Completed',
                description: `Cashbook fee payment (${category.title})${cOffset > 0 ? ` · ${cycle}` : ''}`,
                sourceEntryId: entry._id
            });
            leftover -= alloc;
        }
    }

    if (toCreate.length) {
        // Direct insert only — no wallet credit / Transaction (Cashbook already handled that).
        await Payment.insertMany(toCreate.map((p) => ({ ...p, createdBy })));
    }

    // Remaining still owed for the STARTING cycle after this entry was applied.
    const allocatedThisMonth = toCreate
        .filter((p) => p.billingCycle === startCycle)
        .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, totalOwedBefore - allocatedThisMonth);
};

const getCategories = asyncHandler(async (req, res) => {
    const data = await CashbookCategory.find().sort({ title: 1 });
    res.json(data);
});

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createCategory = asyncHandler(async (req, res) => {
    const { title, type, description } = req.body;
    if (!title || !type) {
        res.status(400);
        throw new Error('Title and type are required');
    }
    // No duplicate category names (case-insensitive) for the same type.
    const duplicate = await CashbookCategory.findOne({
        title: new RegExp(`^${escapeRegex(title.trim())}$`, 'i'),
        type
    });
    if (duplicate) {
        res.status(400);
        throw new Error(`A "${type}" category named "${title.trim()}" already exists`);
    }
    const data = await CashbookCategory.create({
        title: title.trim(),
        type,
        description: description || '',
        createdBy: req.user?._id
    });
    res.status(201).json(data);
});

const updateCategory = asyncHandler(async (req, res) => {
    // Block renaming into a duplicate (case-insensitive, same type), ignoring self.
    if (req.body.title && req.body.type) {
        const duplicate = await CashbookCategory.findOne({
            _id: { $ne: req.params.id },
            title: new RegExp(`^${escapeRegex(req.body.title.trim())}$`, 'i'),
            type: req.body.type
        });
        if (duplicate) {
            res.status(400);
            throw new Error(`A "${req.body.type}" category named "${req.body.title.trim()}" already exists`);
        }
    }
    const data = await CashbookCategory.findByIdAndUpdate(
        req.params.id,
        {
            title: req.body.title?.trim(),
            type: req.body.type,
            description: req.body.description ?? ''
        },
        { new: true, runValidators: true }
    );
    if (!data) {
        res.status(404);
        throw new Error('Category not found');
    }
    res.json(data);
});

const deleteCategory = asyncHandler(async (req, res) => {
    const inUse = await CashbookEntry.countDocuments({ categoryId: req.params.id });
    if (inUse > 0) {
        res.status(400);
        throw new Error('Category is used by cashbook transactions and cannot be deleted');
    }
    const data = await CashbookCategory.findByIdAndDelete(req.params.id);
    if (!data) {
        res.status(404);
        throw new Error('Category not found');
    }
    res.json({ message: 'Category removed' });
});

const getEntries = asyncHandler(async (req, res) => {
    const data = await CashbookEntry.find()
        .populate(populateEntry)
        .sort({ date: -1, createdAt: -1 });
    res.json(data);
});

const resStatus400 = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
};

const validateMobileFields = (method, senderPhone, receiverPhone) => {
    const needsParties = ['Mobile Money', 'Bank', 'EVC-Plus', 'E-Dahab'].includes(method);
    if (!needsParties) return;

    if (['EVC-Plus', 'E-Dahab'].includes(method)) {
        if (!senderPhone || !receiverPhone) {
            resStatus400('EVC-Plus and E-Dahab require both sender and receiver phone numbers');
        }
    }

    if (['EVC-Plus', 'E-Dahab', 'Mobile Money'].includes(method)) {
        if (senderPhone && !isValidSomaliMobile(senderPhone)) {
            resStatus400('Sender phone must be 9 digits (61/62…) or 10 digits (061/062…)');
        }
        if (receiverPhone && !isValidSomaliMobile(receiverPhone)) {
            resStatus400('Receiver phone must be 9 digits (61/62…) or 10 digits (061/062…)');
        }
    }
};

// Two campuses can each run a class of the same name, so the branch is shown
// alongside it: "Tamhiid 3 (FR1)". The stored class name itself is unchanged.
const classDisplayName = (cls) => {
    const name = cls?.name || cls?.className || '';
    const branch = cls?.branchId?.name || '';
    if (!name) return '';
    return branch ? `${name} (${branch})` : name;
};

const phoneOrQuery = (field, variants) => ({
    [field]: { $in: variants }
});

const createEntry = asyncHandler(async (req, res) => {
    const {
        categoryId,
        amount,
        method,
        payerName,
        senderPhone,
        senderName,
        senderEntityType,
        senderEntityId,
        receiverPhone,
        receiverName,
        receiverEntityType,
        receiverEntityId,
        date,
        description
    } = req.body;

    if (!categoryId || amount === undefined || amount === null || amount === '') {
        res.status(400);
        throw new Error('Category and amount are required');
    }

    const category = await CashbookCategory.findById(categoryId);
    if (!category) {
        res.status(400);
        throw new Error('Invalid category');
    }

    try {
        validateMobileFields(method || 'Cash', senderPhone, receiverPhone);
    } catch (e) {
        res.status(e.statusCode || 400);
        throw e;
    }

    const branchId = req.user?.branchId;
    const wallet = await resolveWallet(req.body.walletId, branchId);

    // No wallet in the system → refuse to record money (income or expense).
    if (!wallet) {
        res.status(400);
        throw new Error('No wallet found in the system. Create a wallet before recording income or expenses.');
    }

    const data = await CashbookEntry.create({
        categoryId,
        amount: Number(amount),
        method: method || 'Cash',
        payerName: payerName || '',
        senderPhone: digitsOnly(senderPhone),
        senderName: senderName || '',
        senderEntityType: senderEntityType || '',
        senderEntityId: senderEntityId || undefined,
        receiverPhone: digitsOnly(receiverPhone),
        receiverName: receiverName || '',
        receiverEntityType: receiverEntityType || '',
        receiverEntityId: receiverEntityId || undefined,
        date: date || new Date().toISOString().split('T')[0],
        // targetMonth now holds a BILLING CYCLE key (25th→24th): the client's
        // chosen cycle for an advance, else the cycle of the entry's own date.
        targetMonth: req.body.targetMonth || cycleKeyForDate(date || new Date()),
        description: description || '',
        branchId,
        walletId: wallet?._id,
        createdBy: req.user?._id
    });

    // Reflect the movement on the system wallet and record it in the transaction ledger.
    if (wallet) {
        await applyWalletEffect(wallet, category.type, data.amount, 1);
        await Transaction.create({
            branchId: wallet.branchId || branchId || null,
            walletId: wallet._id,
            type: category.type,
            amount: data.amount,
            referenceId: data._id,
            description: description || `Cashbook: ${category.title} (${category.type})`,
            date: data.date,
            createdBy: req.user?._id
        });
    }

    // Record student fee payments (partial-aware) linked to this entry, and
    // snapshot how much the payer still owes after this payment.
    let feeRemaining = await syncFeePayments(data, category, req.user?._id);

    // If not a student fee payment, snapshot remaining balance for Expense (Teacher / Rent / Account / Contact)
    if (feeRemaining === null || feeRemaining === undefined) {
        if (category.type === 'Expense') {
            // selectedMonth is a BILLING CYCLE key (the entry's targetMonth).
            const selectedMonth = data.targetMonth || cycleKeyForDate(data.date);
            const isAdvance = selectedMonth > currentCycle();

            // If receiver is a Teacher / User with salary:
            if (data.receiverEntityId && ['teacher', 'user'].includes(data.receiverEntityType)) {
                const user = await User.findById(data.receiverEntityId).select('salary');
                const totalSalary = Number(user?.salary || 0);
                if (totalSalary > 0) {
                    try {
                        await Salary.create({
                            teacherId: data.receiverEntityId,
                            walletId: wallet?._id,
                            month: selectedMonth,
                            billingCycle: selectedMonth,
                            amount: data.amount,
                            paymentMethod: data.method || 'Cash',
                            paymentDate: new Date(data.date || Date.now()),
                            status: 'Paid',
                            notes: `Cashbook: ${category.title} (${selectedMonth}${isAdvance ? ' · Hormarin' : ''}) · ref:${data._id}${data.description ? ` · ${data.description}` : ''}`,
                            paidBy: req.user?._id
                        });
                    } catch (e) {
                        console.error('Salary sync note:', e.message);
                    }

                    // Remaining balance for this billing cycle after this payment.
                    const salaryDocs = await Salary.find({
                        teacherId: data.receiverEntityId,
                        status: { $ne: 'Cancelled' },
                        ...cycleMatch('billingCycle', 'paymentDate', selectedMonth)
                    }).select('amount notes');
                    const externalSalaryPaid = salaryDocs
                        .filter((s) => !s.notes || !s.notes.startsWith('Cashbook:'))
                        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

                    const entryDocs = await CashbookEntry.find({
                        _id: { $ne: data._id },
                        $and: [
                            {
                                $or: [
                                    { receiverEntityId: data.receiverEntityId },
                                    phoneOrQuery('receiverPhone', phoneVariants(data.receiverPhone || ''))
                                ]
                            },
                            entryInCycle(selectedMonth)
                        ]
                    }).populate('categoryId');
                    const cashbookPaid = entryDocs
                        .filter((e) => !e.categoryId || e.categoryId.type === 'Expense')
                        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                    const totalPaidForMonth = externalSalaryPaid + cashbookPaid + Number(data.amount || 0);
                    feeRemaining = Math.max(0, totalSalary - totalPaidForMonth);
                }
            } else if (data.receiverPhone) {
                // If receiver is Rent or other contact with previous feeRemaining or Account:
                const Account = require('../models/Account');
                const variants = phoneVariants(data.receiverPhone);
                const acc = await Account.findOne({
                    $or: [
                        phoneOrQuery('accountNo', variants),
                        phoneOrQuery('code', variants)
                    ]
                });

                const prevEntry = await CashbookEntry.findOne({
                    _id: { $ne: data._id },
                    receiverPhone: data.receiverPhone,
                    feeRemaining: { $ne: null },
                    ...entryInCycle(selectedMonth)
                }).sort({ date: -1, createdAt: -1 });

                let remainingBefore = null;
                if (prevEntry && prevEntry.feeRemaining !== null && prevEntry.feeRemaining !== undefined) {
                    remainingBefore = Number(prevEntry.feeRemaining);
                } else if (acc && acc.balance !== undefined && Number(acc.balance) > 0) {
                    remainingBefore = Number(acc.balance);
                }

                if (remainingBefore !== null) {
                    feeRemaining = Math.max(0, remainingBefore - Number(data.amount || 0));
                }
            }

            data.targetMonth = selectedMonth;
        }
    }

    if (feeRemaining !== null && feeRemaining !== undefined) {
        data.feeRemaining = feeRemaining;
        await data.save();
    }

    await data.populate(populateEntry);
    res.status(201).json(data);
});

const updateEntry = asyncHandler(async (req, res) => {
    const existing = await CashbookEntry.findById(req.params.id);
    if (!existing) {
        res.status(404);
        throw new Error('Transaction not found');
    }

    const method = req.body.method ?? existing.method;
    const senderPhone = req.body.senderPhone ?? existing.senderPhone;
    const receiverPhone = req.body.receiverPhone ?? existing.receiverPhone;

    try {
        validateMobileFields(method, senderPhone, receiverPhone);
    } catch (e) {
        res.status(e.statusCode || 400);
        throw e;
    }

    // Old category type is needed to reverse the previous wallet effect.
    const oldCategory = await CashbookCategory.findById(existing.categoryId);
    let newCategory = oldCategory;
    if (req.body.categoryId && String(req.body.categoryId) !== String(existing.categoryId)) {
        newCategory = await CashbookCategory.findById(req.body.categoryId);
        if (!newCategory) {
            res.status(400);
            throw new Error('Invalid category');
        }
    }

    const payload = { ...req.body };
    if (payload.senderPhone !== undefined) payload.senderPhone = digitsOnly(payload.senderPhone);
    if (payload.receiverPhone !== undefined) payload.receiverPhone = digitsOnly(payload.receiverPhone);
    if (payload.amount !== undefined) payload.amount = Number(payload.amount);

    // Empty strings for ObjectId fields must become null, otherwise Mongoose throws a Cast error.
    ['senderEntityId', 'receiverEntityId'].forEach((k) => {
        if (k in payload && !payload[k]) payload[k] = null;
    });

    // Reverse the previous effect only if one was actually applied (entry had a wallet).
    if (existing.walletId && oldCategory) {
        const oldWallet = await Wallet.findById(existing.walletId);
        if (oldWallet) await applyWalletEffect(oldWallet, oldCategory.type, existing.amount, -1);
    }

    // Resolve the wallet for the updated entry and apply the new effect.
    const newWallet = await resolveWallet(payload.walletId ?? existing.walletId, existing.branchId);
    payload.walletId = newWallet?._id;

    const data = await CashbookEntry.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true
    }).populate(populateEntry);

    if (newWallet && newCategory) {
        await applyWalletEffect(newWallet, newCategory.type, data.amount, 1);
    }

    // Keep the transaction ledger in sync with the edited entry.
    await Transaction.updateMany(
        { referenceId: data._id },
        {
            walletId: newWallet?._id,
            type: newCategory?.type,
            amount: data.amount,
            branchId: newWallet?.branchId || existing.branchId || null,
            description: data.description || `Cashbook: ${newCategory?.title} (${newCategory?.type})`,
            date: data.date
        }
    );

    // Re-sync linked fee payments against the updated amount / category / date.
    const feeRemaining = await syncFeePayments(data, newCategory, req.user?._id);
    data.feeRemaining = feeRemaining ?? null;
    await data.save();

    res.json(data);
});

const deleteEntry = asyncHandler(async (req, res) => {
    const existing = await CashbookEntry.findById(req.params.id);
    if (!existing) {
        res.status(404);
        throw new Error('Transaction not found');
    }

    // Reverse the wallet effect (only if one was applied) and remove linked ledger transaction(s).
    if (existing.walletId) {
        const category = await CashbookCategory.findById(existing.categoryId);
        const wallet = await Wallet.findById(existing.walletId);
        if (wallet && category) await applyWalletEffect(wallet, category.type, existing.amount, -1);
    }
    await Transaction.deleteMany({ referenceId: existing._id });
    // Remove any student fee payments or salary disbursements recorded from this entry.
    await Payment.deleteMany({ sourceEntryId: existing._id });
    await Salary.deleteMany({ notes: new RegExp(existing._id) });

    await existing.deleteOne();
    res.json({ message: 'Transaction removed' });
});

const lookupGuardian = async (variants) => {
    const guardian = await Guardian.findOne(phoneOrQuery('phone', variants)).select('fullName phone type');
    if (!guardian) return null;
    return {
        found: true,
        name: guardian.fullName,
        entityType: 'guardian',
        entityId: guardian._id,
        role: guardian.type === 'Responsible' ? 'Responsible' : guardian.type || 'Parent',
        phone: guardian.phone
    };
};

const lookupStudent = async (variants) => {
    const student = await Student.findOne(phoneOrQuery('fatherPhone', variants)).select('fullName fatherPhone fatherName');
    if (!student) return null;
    return {
        found: true,
        name: student.fatherName || student.fullName,
        entityType: 'student',
        entityId: student._id,
        role: 'Responsible',
        phone: student.fatherPhone,
        responsibleName: student.fatherName,
        studentName: student.fullName
    };
};

const lookupUser = async (variants, preferTeacher = false) => {
    const baseQuery = phoneOrQuery('phone', variants);
    const user = preferTeacher
        ? await User.findOne({ ...baseQuery, role: 'Teacher' }).select('fullName phone role salary')
        : await User.findOne(baseQuery).select('fullName phone role salary');
    if (!user) return null;
    const entityType = user.role === 'Teacher' ? 'teacher' : 'user';
    return {
        found: true,
        name: user.fullName,
        entityType,
        entityId: user._id,
        role: user.role,
        phone: user.phone
    };
};

const lookupAccount = async (variants) => {
    const Account = require('../models/Account');
    const acc = await Account.findOne({
        $or: [
            phoneOrQuery('accountNo', variants),
            phoneOrQuery('code', variants)
        ]
    }).select('name code accountNo type balance');
    if (!acc) return null;
    return {
        found: true,
        name: acc.name,
        entityType: 'account',
        entityId: acc._id,
        role: acc.type || 'Account',
        phone: acc.accountNo || acc.code,
        balance: Number(acc.balance || 0)
    };
};

const lookupPreviousEntry = async (variants, purpose) => {
    const query = purpose === 'receiver'
        ? phoneOrQuery('receiverPhone', variants)
        : phoneOrQuery('senderPhone', variants);
    const lastEntry = await CashbookEntry.findOne(query).sort({ date: -1, createdAt: -1 });
    if (!lastEntry) return null;
    const name = purpose === 'receiver' ? (lastEntry.receiverName || lastEntry.payerName) : (lastEntry.senderName || lastEntry.payerName);
    const entityType = purpose === 'receiver' ? (lastEntry.receiverEntityType || 'manual') : (lastEntry.senderEntityType || 'manual');
    const entityId = purpose === 'receiver' ? lastEntry.receiverEntityId : lastEntry.senderEntityId;
    return {
        found: true,
        name: name || '',
        entityType: entityType || 'manual',
        entityId: entityId || null,
        role: 'Contact',
        phone: purpose === 'receiver' ? lastEntry.receiverPhone : lastEntry.senderPhone,
        lastEntry
    };
};

// Match CashbookEntry documents belonging to a billing cycle (25th→24th),
// migration-safe for historical rows.
//
// The tricky part is `targetMonth`: NEW entries store a billing-CYCLE key there,
// while HISTORICAL entries stored a CALENDAR month (always equal to their date's
// own "YYYY-MM"). We must attribute historical entries by their REAL DATE, and
// only honour `targetMonth` when it is a deliberate cross-cycle (advance)
// assignment — detected as targetMonth differing from the date's calendar month.
//
//   (a) "plain" entries — no targetMonth, or targetMonth == the date's own
//       calendar month (this is every historical row, and same-cycle new rows) —
//       are matched purely by their real date falling in the cycle range.
//   (b) genuine ADVANCE entries — targetMonth deliberately set to a DIFFERENT
//       cycle than the payment date's month — are matched to that target cycle
//       (and, thanks to (a)'s guard, are NOT double-counted in their pay-date
//       cycle).
//
// `date` is a "YYYY-MM-DD" string, so its month is $substr(date,0,7) and range
// comparisons are lexicographic (correct because that format sorts by time).
const entryInCycle = (cycle) => {
    const { start, end } = cycleRange(cycle);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    const dateMonth = { $substr: [{ $ifNull: ['$date', ''] }, 0, 7] };
    return {
        $or: [
            // (a) plain / historical / same-cycle entries → attribute by real date
            {
                $and: [
                    { date: { $gte: startISO, $lte: endISO } },
                    {
                        $or: [
                            { targetMonth: null },
                            { targetMonth: '' },
                            { targetMonth: { $exists: false } },
                            { $expr: { $eq: ['$targetMonth', dateMonth] } }
                        ]
                    }
                ]
            },
            // (b) genuine advance entries deliberately targeted to THIS cycle
            {
                $and: [
                    { targetMonth: cycle },
                    { $expr: { $ne: ['$targetMonth', dateMonth] } }
                ]
            }
        ]
    };
};

// Summarize the students a responsible person pays for: fees, amount paid in the
// given billing cycle, and the remaining balance still owed for that cycle.
const summarizeStudents = async (students, cycle = currentCycle()) => {
    const list = [];
    let totalMonthlyFee = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    for (const s of students) {
        const paidThisMonthAgg = await Payment.find({
            studentId: s._id,
            status: 'Completed',
            ...cycleMatch('billingCycle', 'paymentDate', cycle)
        }).select('amount');
        const paidThisMonth = paidThisMonthAgg.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const monthlyFee = Number(s.monthlyFee || s.fee || 0);
        const balance = Math.max(0, monthlyFee - paidThisMonth);
        totalMonthlyFee += monthlyFee;
        totalPaid += paidThisMonth;
        totalBalance += balance;
        list.push({
            studentId: s._id,
            name: s.fullName,
            className: classDisplayName(s.classId),
            monthlyFee,
            totalPaid: paidThisMonth,
            balance
        });
    }
    return { students: list, totalMonthlyFee, totalPaid, totalBalance, month: cycle, count: list.length };
};

// Attach financial context to a matched payer/receiver:
// Calculates current remaining balance for:
// - Parent / Waalid (responsible student fees)
// - Teacher / Macallin (salary minus payments this month)
// - Rent / Kiro or other registered accounts / contacts
const buildPayerInfo = async (match, variants, purpose = 'sender', reqDate = null) => {
    if (!match) return null;
    // The billing cycle in focus: an explicit cycle key if provided, else derived
    // from the supplied date (or now) using the 25th→24th rule.
    const currentMonth = isValidCycleKey(reqDate) ? reqDate : cycleKeyForDate(reqDate || new Date());

    // 1. Guardian / responsible / student's father → gather all students under them.
    if (match.entityType === 'guardian' || match.entityType === 'student') {
        const orConds = [{ fatherPhone: { $in: variants } }];
        if (match.entityType === 'guardian') orConds.push({ guardianId: match.entityId });
        // Exited (archived) students are not active payers.
        const students = await Student.find({ $or: orConds, status: { $ne: 'Exited' } })
            .select('fullName classId monthlyFee fee fatherPhone guardianId')
            .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } });

        if (!students.length) return { kind: 'responsible', students: [], totalMonthlyFee: 0, totalPaid: 0, totalBalance: 0, remainingBalance: 0, count: 0 };
        const summary = await summarizeStudents(students, currentMonth);
        return {
            kind: 'responsible',
            ...summary,
            remainingBalance: summary.totalBalance
        };
    }

    // 2. Teacher / staff / user → calculate salary and payments this month.
    if (match.entityType === 'teacher' || match.entityType === 'user') {
        const user = await User.findById(match.entityId).select('fullName role salary');
        const totalSalary = Number(user?.salary || 0);

        // Salary payments for this billing cycle (excluding Cashbook mirrors to
        // prevent double counting). New salaries carry billingCycle; historical
        // ones are attributed by paymentDate.
        const salaryDocs = await Salary.find({
            teacherId: match.entityId,
            status: { $ne: 'Cancelled' },
            ...cycleMatch('billingCycle', 'paymentDate', currentMonth)
        }).select('amount month status notes');
        const externalSalaryPaid = salaryDocs
            .filter((s) => !s.notes || !s.notes.startsWith('Cashbook:'))
            .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

        // Cashbook expense entries to THIS receiver within this billing cycle.
        const entryDocs = await CashbookEntry.find({
            $and: [
                { $or: [
                    { receiverEntityId: match.entityId },
                    phoneOrQuery('receiverPhone', variants)
                ] },
                entryInCycle(currentMonth)
            ]
        }).populate('categoryId');
        const cashbookPaid = entryDocs
            .filter((e) => !e.categoryId || e.categoryId.type === 'Expense')
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const totalPaid = externalSalaryPaid + cashbookPaid;
        const remaining = totalSalary > 0 ? Math.max(0, totalSalary - totalPaid) : 0;
        const lastSalary = salaryDocs.sort((a, b) => (b.month || '').localeCompare(a.month || ''))[0] || null;

        if (totalSalary > 0) {
            return {
                kind: 'staff',
                role: user?.role || match.role,
                salary: totalSalary,
                totalMonthlyFee: totalSalary,
                totalPaid,
                totalBalance: remaining,
                remainingBalance: remaining,
                month: currentMonth,
                isAdvance: currentMonth > currentCycle(),
                lastSalary: lastSalary ? { amount: Number(lastSalary.amount || 0), month: lastSalary.month, status: lastSalary.status } : null
            };
        }

        // If user has no salary, check previous CashbookEntry snapshots
        const lastEntry = await CashbookEntry.findOne({
            $or: [
                { receiverEntityId: match.entityId },
                phoneOrQuery('receiverPhone', variants)
            ]
        }).sort({ date: -1, createdAt: -1 });

        if (lastEntry && lastEntry.feeRemaining !== null && lastEntry.feeRemaining !== undefined) {
            const rem = Math.max(0, Number(lastEntry.feeRemaining));
            return {
                kind: 'staff',
                role: user?.role || match.role,
                salary: 0,
                totalBalance: rem,
                remainingBalance: rem,
                month: currentMonth
            };
        }

        return {
            kind: 'staff',
            role: user?.role || match.role,
            salary: 0,
            totalBalance: 0,
            remainingBalance: 0,
            month: currentMonth
        };
    }

    // 3. Account model match (e.g. Rent, Utilities, or general ledger account)
    if (match.entityType === 'account') {
        const phoneQuery = purpose === 'receiver'
            ? phoneOrQuery('receiverPhone', variants)
            : phoneOrQuery('senderPhone', variants);

        const monthQuery = { $and: [phoneQuery, entryInCycle(currentMonth)] };
        const monthEntries = await CashbookEntry.find(monthQuery).populate('categoryId');
        const paidThisMonth = monthEntries
            .filter((e) => !e.categoryId || (purpose === 'receiver' ? e.categoryId.type === 'Expense' : e.categoryId.type === 'Income'))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const baseBalance = Math.max(0, Number(match.balance || 0));
        let rem = baseBalance;
        if (baseBalance > 0) {
            rem = Math.max(0, baseBalance - paidThisMonth);
        } else {
            const lastEntry = await CashbookEntry.findOne(phoneQuery).sort({ date: -1, createdAt: -1 });
            if (lastEntry && lastEntry.feeRemaining !== null && lastEntry.feeRemaining !== undefined) {
                rem = Math.max(0, Number(lastEntry.feeRemaining) - paidThisMonth);
            }
        }

        return {
            kind: 'account',
            name: match.name,
            totalBalance: rem,
            remainingBalance: rem,
            month: currentMonth,
            baseBalance,
            paidThisMonth
        };
    }

    // 4. Any other registered account or contact (check previous CashbookEntry records for this phone/account)
    const phoneQuery = purpose === 'receiver'
        ? phoneOrQuery('receiverPhone', variants)
        : phoneOrQuery('senderPhone', variants);

    const monthQuery = { $and: [phoneQuery, entryInCycle(currentMonth)] };
    const monthEntries = await CashbookEntry.find(monthQuery).populate('categoryId');
    const paidThisMonth = monthEntries
        .filter((e) => !e.categoryId || (purpose === 'receiver' ? e.categoryId.type === 'Expense' : e.categoryId.type === 'Income'))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const lastEntry = match.lastEntry || await CashbookEntry.findOne(phoneQuery).sort({ date: -1, createdAt: -1 });
    if (lastEntry) {
        let base = 0;
        if (lastEntry.amount && Number(lastEntry.amount) > 0) {
            base = Number(lastEntry.amount);
        }
        if (lastEntry.feeRemaining !== null && lastEntry.feeRemaining !== undefined) {
            base = Number(lastEntry.feeRemaining);
        }
        const rem = Math.max(0, base - paidThisMonth);
        return {
            kind: 'contact',
            name: match.name,
            totalBalance: rem,
            remainingBalance: rem,
            month: currentMonth,
            baseBalance: base,
            paidThisMonth
        };
    }

    return null;
};

const lookupPhone = asyncHandler(async (req, res) => {
    const raw = (req.query.phone || '').trim();
    const purpose = (req.query.purpose || 'sender').toLowerCase();
    const reqDate = req.query.month || req.query.date || null;
    const variants = phoneVariants(raw);

    if (!variants.length) {
        return res.json({ found: false, name: '', entityType: '', entityId: null, role: '' });
    }

    const tryOrder =
        purpose === 'receiver'
            ? [
                  () => lookupUser(variants, true),
                  () => lookupUser(variants, false),
                  () => lookupAccount(variants),
                  () => lookupGuardian(variants),
                  () => lookupStudent(variants),
                  () => lookupPreviousEntry(variants, 'receiver')
              ]
            : [
                  () => lookupGuardian(variants),
                  () => lookupStudent(variants),
                  () => lookupAccount(variants),
                  () => lookupUser(variants, false),
                  () => lookupPreviousEntry(variants, 'sender')
              ];

    for (const lookup of tryOrder) {
        const match = await lookup();
        if (match) {
            const payerInfo = await buildPayerInfo(match, variants, purpose, reqDate);
            return res.json({ ...match, payerInfo });
        }
    }

    res.json({ found: false, name: '', entityType: '', entityId: null, role: '' });
});

// One row per responsible payer (father / guardian): name, number, how many
// students they cover, the total monthly fee, and whether it's fully paid this month.
const getPayers = asyncHandler(async (req, res) => {
    // The `month` param is now a BILLING CYCLE key (25th→24th), not a calendar
    // month. Without it: the current cycle, every active student (Payers page).
    const requestedCycle = isValidCycleKey(req.query.month || '') ? req.query.month : null;
    const cycle = requestedCycle || currentCycle();
    const { end } = cycleRange(cycle);

    const studentQuery = { status: { $nin: ['Inactive', 'Exited'] } };
    if (requestedCycle) {
        // A student is a valid payer for a billing cycle once they have joined by
        // the time that cycle ENDS (its 24th). So the filter is an upper bound on
        // registrationDate — the cycle end — not an exact-cycle window:
        //   • older active students keep appearing in later cycles;
        //   • a newly registered student appears from their registration cycle
        //     onward and never in earlier cycles (e.g. registered Oct 24 → shows
        //     from the September cycle [ends Oct 24]; Oct 25 → from the October
        //     cycle, not September).
        // Inactive/Exited students remain excluded (Exit behaviour preserved).
        studentQuery.registrationDate = { $lte: end };
    }

    const students = await Student.find(studentQuery)
        .select('fullName fatherName fatherPhone guardianId monthlyFee fee classId registrationDate status studentCode')
        .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } })
        .populate('guardianId', 'fullName phone alternatePhone relationship')
        .lean();

    // Payments counted for this cycle: new records by their billingCycle key,
    // historical records (no key) by their real paymentDate falling in the range.
    const studentIds = students.map((s) => s._id);
    const payments = await Payment.find({
        studentId: { $in: studentIds },
        status: 'Completed',
        ...cycleMatch('billingCycle', 'paymentDate', cycle)
    }).select('studentId amount').lean();

    const paidByStudent = new Map();
    for (const p of payments) {
        const sId = String(p.studentId);
        paidByStudent.set(sId, (paidByStudent.get(sId) || 0) + (Number(p.amount) || 0));
    }

    const groups = new Map();
    for (const s of students) {
        // Group by the fee payer (guardian), not the responsible person.
        const guardian = s.guardianId && typeof s.guardianId === 'object' ? s.guardianId : null;
        const payerName = guardian?.fullName || s.fatherName || '';
        const payerPhone = guardian?.phone || s.fatherPhone || '';
        const payerAltPhone = guardian?.alternatePhone || '';
        const phoneKey = digitsOnly(payerPhone);
        const key = (guardian?._id && `g:${guardian._id}`) || phoneKey || `s:${s._id}`;
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                name: payerName,
                phone: payerPhone,
                alternatePhone: payerAltPhone,
                relationship: guardian?.relationship || '',
                guardianId: guardian?._id || null,
                students: [],
                totalFee: 0
            });
        }
        const g = groups.get(key);
        g.students.push(s);
        g.totalFee += Number(s.monthlyFee || s.fee || 0);
        if (!g.name && payerName) g.name = payerName;
        if (!g.phone && payerPhone) g.phone = payerPhone;
        if (!g.alternatePhone && payerAltPhone) g.alternatePhone = payerAltPhone;
        if (!g.relationship && guardian?.relationship) g.relationship = guardian.relationship;
    }

    const result = [];
    for (const g of groups.values()) {
        // Per-student paid / remaining for the month.
        const studentDetails = [];
        let paidAmount = 0;
        for (const s of g.students) {
            const paid = paidByStudent.get(String(s._id)) || 0;
            const fee = Number(s.monthlyFee || s.fee || 0);
            paidAmount += paid;
            studentDetails.push({
                studentId: s._id,
                name: s.fullName,
                className: classDisplayName(s.classId),
                monthlyFee: fee,
                paid,
                remaining: Math.max(0, fee - paid),
                isPaid: fee > 0 && paid >= fee
            });
        }
        result.push({
            key: g.key,
            name: g.name || 'Unknown',
            phone: g.phone,
            alternatePhone: g.alternatePhone || '',
            relationship: g.relationship || '',
            guardianId: g.guardianId,
            studentIds: g.students.map((s) => s._id),
            students: studentDetails,
            studentCount: g.students.length,
            totalFee: g.totalFee,
            paidAmount,
            paid: g.totalFee > 0 && paidAmount >= g.totalFee,
            month: cycle,
            cycle
        });
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    res.json(result);
});

// Tick / untick "paid" for a payer. Ticking records the remaining fee as a
// Payment for each of their students (crediting the wallet); unticking removes
// only the payments this toggle created and reverses the wallet.
const togglePayer = asyncHandler(async (req, res) => {
    const { studentIds, paid } = req.body;
    if (!Array.isArray(studentIds) || !studentIds.length) {
        res.status(400);
        throw new Error('No students provided for this payer');
    }

    // Quick-pay applies to the CURRENT billing cycle (25th→24th).
    const cycle = currentCycle();
    // Exited students are excluded from quick-pay so no new money can be attached
    // to an archived student.
    const students = await Student.find({ _id: { $in: studentIds }, status: { $ne: 'Exited' } })
        .select('fullName monthlyFee fee guardianId branchId');

    if (paid) {
        const wallet = await resolveWallet(req.body.walletId, req.user?.branchId);
        // No wallet → do not catch any money.
        if (!wallet) {
            res.status(400);
            throw new Error('No wallet found in the system. Create a wallet before recording payments.');
        }
        for (const s of students) {
            const existing = await Payment.find({
                studentId: s._id, status: 'Completed', ...cycleMatch('billingCycle', 'paymentDate', cycle)
            }).select('amount');
            const already = existing.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const fee = Number(s.monthlyFee || s.fee || 0);
            const remaining = Math.max(0, fee - already);
            if (remaining <= 0) continue;

            const payment = await Payment.create({
                studentId: s._id,
                guardianId: s.guardianId || undefined,
                walletId: wallet?._id,
                amount: remaining,
                month: cycle,
                billingCycle: cycle,
                paymentDate: new Date(),
                paymentMethod: 'Cash',
                status: 'Completed',
                description: 'Payer table quick-pay',
                viaPayerToggle: true
            });

            if (wallet) {
                await Transaction.create({
                    branchId: wallet.branchId || req.user?.branchId || null,
                    walletId: wallet._id,
                    type: 'Income',
                    amount: remaining,
                    referenceId: payment._id,
                    description: `Payer quick-pay: ${s.fullName}`,
                    date: new Date(),
                    createdBy: req.user?._id
                });
                wallet.balance = (wallet.balance || 0) + remaining;
            }
        }
        if (wallet) await wallet.save();
    } else {
        // Remove only payments this toggle created (this cycle), reversing their wallet effect.
        const pays = await Payment.find({
            studentId: { $in: studentIds }, viaPayerToggle: true,
            ...cycleMatch('billingCycle', 'paymentDate', cycle)
        });
        for (const p of pays) {
            if (p.walletId) {
                const w = await Wallet.findById(p.walletId);
                if (w) {
                    w.balance = Math.max(0, (w.balance || 0) - Number(p.amount || 0));
                    await w.save();
                }
            }
            await Transaction.deleteMany({ referenceId: p._id });
            await p.deleteOne();
        }
    }

    res.json({ message: 'Payer payment updated' });
});

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    lookupPhone,
    getPayers,
    togglePayer
};
