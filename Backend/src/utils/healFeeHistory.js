const Student = require('../models/Student');
const Guardian = require('../models/Guardian');
const Payment = require('../models/Payment');
const { currentCycle, addCycles, cycleKeyForDate } = require('./billingCycle');
const { getStudentFeeForCycle } = require('./studentFee');

/**
 * Self-healing routine to fix students whose fee was modified in a way that created
 * artificial/phantom arrears in past cycles where payments were already completed in full.
 *
 * Targets specific reported phones (615296050, 618384848, etc.) and also scans institute-wide
 * for any student where a fee increase retroactively created arrears in previous cycles.
 */
const healFeeHistory = async () => {
    try {
        const current = currentCycle();
        const prev = addCycles(current, -1);

        const TARGET_PHONES = ['615296050', '618384848'];
        const phoneRegex = new RegExp(`(${TARGET_PHONES.join('|')})`);

        // 1. Process target reported payers first
        const targetGuardians = await Guardian.find({
            $or: [
                { phone: phoneRegex },
                { alternatePhone: phoneRegex },
                { fullName: /Hani/i }
            ]
        }).select('_id phone fullName').lean();

        const targetGuardianIds = targetGuardians.map((g) => g._id);

        const targetStudents = await Student.find({
            status: { $nin: ['Inactive', 'Exited'] },
            $or: [
                { fatherPhone: phoneRegex },
                { fatherName: /Hani/i },
                ...(targetGuardianIds.length ? [{ guardianId: { $in: targetGuardianIds } }] : [])
            ]
        });

        for (const s of targetStudents) {
            const prevPayments = await Payment.find({
                studentId: s._id,
                status: 'Completed',
                $or: [
                    { billingCycle: prev },
                    { billingCycle: { $in: [null, ''] }, paymentDate: { $gte: new Date('2026-08-25T00:00:00.000Z'), $lte: new Date('2026-09-24T23:59:59.999Z') } }
                ]
            }).lean();

            const prevPaid = prevPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const currentFee = Number(s.monthlyFee || s.fee || 30);

            // Baseline historical fee: if paid amount in prev cycle > 0 use that (e.g. 10, 15, 25).
            // If prevPaid is 0 but current fee is 30 and initial was 25, fallback to 25.
            const baseAmount = prevPaid > 0 ? prevPaid : (currentFee === 30 ? 25 : currentFee);

            s.feeHistory = [
                { effectiveCycle: '2000-01', amount: baseAmount, changedAt: s.registrationDate || new Date() },
                { effectiveCycle: current, amount: currentFee, changedAt: new Date() }
            ];
            await s.save();
            console.log(`[healFeeHistory] Target healed student ${s.fullName} (${s.studentCode || s._id}): historical=${baseAmount}, current=${currentFee}`);
        }

        // 2. Institute-wide scan: heal ANY student where a fee increase retroactively created arrears
        // in previous cycles where the student had already paid in full.
        const allStudents = await Student.find({ status: { $nin: ['Inactive', 'Exited'] } });

        for (const s of allStudents) {
            // Skip if already in targets
            if (targetStudents.some((ts) => String(ts._id) === String(s._id))) continue;

            const prevPayments = await Payment.find({
                studentId: s._id,
                status: 'Completed',
                $or: [
                    { billingCycle: prev },
                    { billingCycle: { $in: [null, ''] }, paymentDate: { $gte: new Date('2026-08-25T00:00:00.000Z'), $lte: new Date('2026-09-24T23:59:59.999Z') } }
                ]
            }).lean();

            const prevPaid = prevPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const feeCalculated = getStudentFeeForCycle(s, prev);

            // If the student paid in the previous cycle, but the current calculated fee is higher
            // because of an inflated baseline, align the baseline so the previous cycle has 0 debt.
            if (prevPaid > 0 && feeCalculated > prevPaid) {
                const currentFee = Number(s.monthlyFee || s.fee || feeCalculated);
                s.feeHistory = [
                    { effectiveCycle: '2000-01', amount: prevPaid, changedAt: s.registrationDate || new Date() },
                    { effectiveCycle: current, amount: currentFee, changedAt: new Date() }
                ];
                await s.save();
                console.log(`[healFeeHistory] Auto-healed student ${s.fullName} (${s.studentCode || s._id}): historical=${prevPaid}, current=${currentFee}`);
            }
        }
    } catch (err) {
        console.warn('[healFeeHistory] Note:', err.message);
    }
};

module.exports = healFeeHistory;
