const Student = require('../models/Student');
const Payment = require('../models/Payment');
const CycleDebtSnapshot = require('../models/CycleDebtSnapshot');
const {
    cycleRange,
    cycleLabel,
    isValidCycleKey,
    currentCycle,
    previousCycle,
    cycleMatch
} = require('../utils/billingCycle');
const { getStudentFeeForCycle } = require('../utils/studentFee');
const { digitsOnly } = require('../utils/somaliPhone');

const classDisplayName = (cls) => {
    const name = cls?.name || cls?.className || '';
    const branch = cls?.branchId?.name || '';
    if (!name) return '';
    return branch ? `${name} (${branch})` : name;
};

/**
 * Build snapshot payers for a closed cycle.
 * Only payments up to the cycle close (paymentDate <= end) are attributed.
 */
const buildCyclePayers = async (cycleKey) => {
    const { end } = cycleRange(cycleKey);
    const students = await Student.find({
        status: { $nin: ['Inactive', 'Exited'] },
        registrationDate: { $lte: end }
    })
        .select('fullName fatherName fatherPhone guardianId monthlyFee fee classId registrationDate status studentCode feeHistory')
        .populate({ path: 'classId', select: 'name className branchId', populate: { path: 'branchId', select: 'name' } })
        .populate('guardianId', 'fullName phone alternatePhone relationship')
        .lean();

    const studentIds = students.map((s) => s._id);
    const payments = studentIds.length
        ? await Payment.find({
            studentId: { $in: studentIds },
            status: 'Completed',
            paymentDate: { $lte: end },
            ...cycleMatch('billingCycle', 'paymentDate', cycleKey)
        }).select('studentId amount').lean()
        : [];

    const paidByStudent = new Map();
    for (const p of payments) {
        const sId = String(p.studentId);
        paidByStudent.set(sId, (paidByStudent.get(sId) || 0) + (Number(p.amount) || 0));
    }

    const groups = new Map();
    for (const s of students) {
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
        const sFee = getStudentFeeForCycle(s, cycleKey);
        const g = groups.get(key);
        g.students.push(s);
        g.totalFee += sFee;
        if (!g.name && payerName) g.name = payerName;
        if (!g.phone && payerPhone) g.phone = payerPhone;
        if (!g.alternatePhone && payerAltPhone) g.alternatePhone = payerAltPhone;
        if (!g.relationship && guardian?.relationship) g.relationship = guardian.relationship;
    }

    let totalExpected = 0;
    let totalCollected = 0;
    let totalDebt = 0;
    const debtStudentSet = new Set();
    const result = [];

    for (const g of groups.values()) {
        const studentDetails = [];
        let paidAmount = 0;
        for (const s of g.students) {
            const paid = paidByStudent.get(String(s._id)) || 0;
            const fee = getStudentFeeForCycle(s, cycleKey);
            paidAmount += paid;
            const remaining = Math.max(0, fee - paid);
            if (remaining > 0) {
                debtStudentSet.add(String(s._id));
            }
            studentDetails.push({
                studentId: s._id,
                name: s.fullName,
                studentCode: s.studentCode || '',
                className: classDisplayName(s.classId),
                monthlyFee: fee,
                paid,
                remaining,
                isPaid: fee > 0 && paid >= fee
            });
        }
        const remaining = Math.max(0, g.totalFee - paidAmount);
        totalExpected += g.totalFee;
        totalCollected += paidAmount;
        totalDebt += remaining;

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
            remaining,
            paid: g.totalFee > 0 && paidAmount >= g.totalFee,
            month: cycleKey,
            cycle: cycleKey
        });
    }

    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const debtPayers = result.filter((p) => p.remaining > 0);

    return {
        payers: result,
        totalExpected,
        totalCollected,
        totalDebt,
        payerCount: debtPayers.length,
        studentCount: debtStudentSet.size
    };
};

/**
 * Ensures a snapshot exists for a closed cycle.
 * If cycle has already ended, generates & stores CycleDebtSnapshot if not already present.
 */
const ensureCycleSnapshot = async (cycleKey) => {
    if (!isValidCycleKey(cycleKey)) return null;
    const { end } = cycleRange(cycleKey);
    // Can only snapshot closed cycles (end time has passed)
    if (end > new Date()) return null;

    let snapshot = await CycleDebtSnapshot.findOne({ cycle: cycleKey }).lean();
    if (snapshot) return snapshot;

    const data = await buildCyclePayers(cycleKey);
    try {
        snapshot = await CycleDebtSnapshot.create({
            cycle: cycleKey,
            cycleLabel: cycleLabel(cycleKey),
            closedAt: end,
            totalDebt: data.totalDebt,
            totalExpected: data.totalExpected,
            totalCollected: data.totalCollected,
            payerCount: data.payerCount,
            studentCount: data.studentCount,
            payers: data.payers
        });
        return snapshot.toObject ? snapshot.toObject() : snapshot;
    } catch (err) {
        // In case of duplicate key race condition
        return await CycleDebtSnapshot.findOne({ cycle: cycleKey }).lean();
    }
};

/**
 * Returns historical cycle debt KPI info for the dashboard.
 * Takes the previous cycle of currentCycle (or given cycle).
 */
const getHistoricalDebtKPI = async (current = currentCycle()) => {
    const prev = previousCycle(current);
    const { end } = cycleRange(prev);
    if (end <= new Date()) {
        const snapshot = await ensureCycleSnapshot(prev);
        if (snapshot) {
            return {
                historicalCycleDebt: snapshot.totalDebt || 0,
                historicalCycle: prev,
                historicalCycleLabel: snapshot.cycleLabel || cycleLabel(prev),
                historicalPayerCount: snapshot.payerCount || 0
            };
        }
    }
    return {
        historicalCycleDebt: 0,
        historicalCycle: prev,
        historicalCycleLabel: cycleLabel(prev),
        historicalPayerCount: 0
    };
};

module.exports = {
    ensureCycleSnapshot,
    getHistoricalDebtKPI,
    buildCyclePayers
};
