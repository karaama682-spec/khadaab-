const Student = require('../models/Student');
const Guardian = require('../models/Guardian');
const Payment = require('../models/Payment');
const { currentCycle, addCycles, cycleKeyForDate } = require('./billingCycle');

/**
 * Self-healing routine to fix students whose fee was modified in a way that created
 * artificial/phantom arrears in past cycles where payments were already completed in full.
 *
 * Specifically targets Hani Muqtaar (phone 615296050) and any other students with
 * retroactively inflated historical fees.
 */
const healFeeHistory = async () => {
    try {
        const current = currentCycle();
        const prev = addCycles(current, -1);

        // 1. Target Hani Muqtaar's students
        const guardians = await Guardian.find({
            $or: [
                { phone: { $regex: '615296050' } },
                { fullName: { $regex: 'Hani', $options: 'i' } }
            ]
        }).select('_id phone fullName').lean();

        const guardianIds = guardians.map((g) => g._id);

        const students = await Student.find({
            $or: [
                { fatherPhone: { $regex: '615296050' } },
                { fatherName: { $regex: 'Hani', $options: 'i' } },
                ...(guardianIds.length ? [{ guardianId: { $in: guardianIds } }] : [])
            ]
        });

        for (const s of students) {
            // Find payments made for this student in the previous cycle
            const prevPayments = await Payment.find({
                studentId: s._id,
                status: 'Completed',
                $or: [
                    { billingCycle: prev },
                    { billingCycle: { $in: [null, ''] }, paymentDate: { $gte: new Date('2026-08-25T00:00:00.000Z'), $lte: new Date('2026-09-24T23:59:59.999Z') } }
                ]
            }).lean();

            const prevPaid = prevPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // If the student paid in full ($10 or $15) in the previous cycle:
            if (prevPaid > 0) {
                // Ensure their baseline historical fee matches the paid amount ($10 or $15)
                const baseAmount = prevPaid;
                const currentFee = Number(s.monthlyFee || s.fee || baseAmount);

                const newHistory = [
                    { effectiveCycle: '2000-01', amount: baseAmount, changedAt: s.registrationDate || new Date() }
                ];

                if (currentFee !== baseAmount) {
                    newHistory.push({
                        effectiveCycle: current,
                        amount: currentFee,
                        changedAt: new Date()
                    });
                }

                s.feeHistory = newHistory;
                await s.save();
                console.log(`[healFeeHistory] Corrected feeHistory for student ${s.fullName} (${s.studentCode || s._id}): historical=${baseAmount}, current=${currentFee}`);
            }
        }
    } catch (err) {
        console.warn('[healFeeHistory] Note:', err.message);
    }
};

module.exports = healFeeHistory;
