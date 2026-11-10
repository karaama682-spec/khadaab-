const asyncHandler = require('../middleware/asyncHandler');
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const Guardian = require('../models/Guardian');
const Payment = require('../models/Payment');
const Salary = require('../models/Salary');
const Transaction = require('../models/Transaction');
const StudentAttendance = require('../models/StudentAttendance');
const TeacherAttendance = require('../models/TeacherAttendance');
const Notification = require('../models/Notification');
const { currentCycle, cycleRange, cycleMatch, isValidCycleKey, cycleLabel } = require('../utils/billingCycle');
const { computeFeeTotals, computePreviousDebt } = require('./cashbookController');
const { getHistoricalDebtKPI } = require('../services/cycleSnapshotService');

// In-memory cache to prevent re-running 13 aggregations on every dashboard visit
const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL = 30 * 1000; // 30 seconds

// @desc    Get complete institute dashboard analytics data
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = asyncHandler(async (req, res) => {
    // 1. Authorization: users with role Teacher or restricted custom roles without Dashboard permission are blocked
    const hasRestrictedRoles = req.user?.roles && Array.isArray(req.user.roles) && req.user.roles.length > 0;
    const isTeacherRole = req.user?.role === 'Teacher';

    const hasDashboardPerm = !isTeacherRole && (
        !req.user?.role ||
        req.user.role === 'Super Admin' ||
        req.user.role === 'Institute Admin' ||
        req.user.role === 'Branch Manager' ||
        req.user.role === 'Accountant' ||
        (hasRestrictedRoles && req.user.roles.some(r =>
            r.name === 'Super Admin' ||
            r.name === 'Owner' ||
            (r.permissions && (r.permissions['*'] === true || Boolean(r.permissions?.Dashboard)))
        ))
    );

    if (req.user && !hasDashboardPerm) {
        res.status(403);
        throw new Error('Digniin: Ma lihid ogolaansho aad ku aragto dulmarka guud (Dashboard).');
    }

    const hasFinancePerm = !isTeacherRole && (
        !req.user?.role ||
        req.user.role === 'Super Admin' ||
        req.user.role === 'Institute Admin' ||
        req.user.role === 'Accountant' ||
        (hasRestrictedRoles && req.user.roles.some(r =>
            r.name === 'Super Admin' ||
            r.name === 'Owner' ||
            r.name === 'Accountant' ||
            (r.permissions && (r.permissions['*'] === true || Boolean(r.permissions?.Finance)))
        ))
    );

    const branchId = req.user.branchId || req.user.warehouseId;
    const cycle = req.query.cycle && isValidCycleKey(req.query.cycle) ? req.query.cycle : currentCycle();
    const branchKey = `${String(branchId || 'all')}::${cycle}::${hasFinancePerm ? 'fin' : 'nofin'}`;
    const nowTime = Date.now();

    if (dashboardCache.has(branchKey)) {
        const cached = dashboardCache.get(branchKey);
        if (nowTime - cached.time < DASHBOARD_CACHE_TTL) {
            return res.json(cached.data);
        }
    }

    const branchQuery = branchId ? { branchId } : {};

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Financial "this month" = the requested or current BILLING CYCLE (25th→24th)
    const { start: startOfMonth, end: endOfMonth } = cycleRange(cycle);
    const isCurrent = cycle === currentCycle();

    const [
        totalStudents,
        newStudentsInCycle,
        allStudents,
        totalTeachers,
        newTeachersInCycle,
        allTeachers,
        totalClasses,
        totalGuardians,
        allGuardians,
        totalIncomeAgg,
        totalExpensesAgg,
        totalSalariesAgg,
        feeTotals,
        debtFeesCollectedAgg,
        advanceFeesCollectedAgg,
        previousDebt,
        historicalDebtInfo,
        cycleStudentAttendance,
        cycleTeacherAttendance,
        recentTransactions,
        recentNotifications
    ] = await Promise.all([
        // Total Students: waxii isaga ka horeeyey iyo waxii socda inta isaga jiro (registrationDate <= endOfMonth)
        Student.countDocuments({
            ...branchQuery,
            $or: [
                { status: { $nin: ['Inactive', 'Exited'] } },
                { status: 'Exited', exitDate: { $gt: endOfMonth } }
            ],
            $and: [
                {
                    $or: [
                        { registrationDate: { $lte: endOfMonth } },
                { registrationDate: null, createdAt: { $lte: endOfMonth } },
                { registrationDate: { $exists: false }, createdAt: { $lte: endOfMonth } }
                    ]
                }
            ]
        }),
        // New students registered during this cycle (startOfMonth to endOfMonth)
        Student.countDocuments({
            ...branchQuery,
            status: { $nin: ['Inactive', 'Exited'] },
            $or: [
                { registrationDate: { $gte: startOfMonth, $lte: endOfMonth } },
                { registrationDate: null, createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
                { registrationDate: { $exists: false }, createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
            ]
        }),
        // All-time active students
        Student.countDocuments({ ...branchQuery, status: { $nin: ['Inactive', 'Exited'] } }),
        // Total teachers created on or before this cycle end
        User.countDocuments({
            ...branchQuery,
            role: 'Teacher',
            createdAt: { $lte: endOfMonth }
        }),
        // New teachers in this cycle
        User.countDocuments({
            ...branchQuery,
            role: 'Teacher',
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }),
        // All-time teachers
        User.countDocuments({ ...branchQuery, role: 'Teacher' }),
        // Total classes created on or before this cycle end
        Class.countDocuments({
            ...branchQuery,
            $or: [
                { createdAt: { $lte: endOfMonth } },
                { createdAt: { $exists: false } }
            ]
        }),
        // Total guardians created on or before this cycle end
        Guardian.countDocuments({
            ...branchQuery,
            $or: [
                { createdAt: { $lte: endOfMonth } },
                { createdAt: { $exists: false } }
            ]
        }),
        // All guardians
        Guardian.countDocuments(branchQuery),
        // Total Income strictly in this cycle date range
        hasFinancePerm
            ? Transaction.aggregate([
                { $match: { ...branchQuery, type: 'Income', date: { $gte: startOfMonth, $lte: endOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
            : Promise.resolve([]),
        // Total Expenses strictly in this cycle date range
        hasFinancePerm
            ? Transaction.aggregate([
                { $match: { ...branchQuery, type: 'Expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
            : Promise.resolve([]),
        // Salaries paid in this cycle date range
        hasFinancePerm
            ? Salary.aggregate([
                {
                    $match: {
                        status: 'Paid',
                        $or: [
                            { paymentDate: { $gte: startOfMonth, $lte: endOfMonth } },
                            { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
                            { billingCycle: cycle }
                        ]
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
            : Promise.resolve([]),
        hasFinancePerm
            ? computeFeeTotals(cycle)
            : Promise.resolve({ collected: 0, expected: 0, pending: 0 }),
        // Debt fees collected in this cycle's date range paying for an earlier cycle (billingCycle < cycle)
        hasFinancePerm
            ? Payment.aggregate([
                {
                    $match: {
                        status: 'Completed',
                        $or: [
                            { paymentDate: { $gte: startOfMonth, $lte: endOfMonth } },
                            { paymentDate: null, createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
                        ],
                        billingCycle: { $nin: [null, ''], $lt: cycle }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
            : Promise.resolve([]),
        // Advance fees collected in this cycle's date range paying for a future cycle (billingCycle > cycle)
        hasFinancePerm
            ? Payment.aggregate([
                {
                    $match: {
                        status: 'Completed',
                        $or: [
                            { paymentDate: { $gte: startOfMonth, $lte: endOfMonth } },
                            { paymentDate: null, createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
                        ],
                        billingCycle: { $nin: [null, ''], $gt: cycle }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
            : Promise.resolve([]),
        hasFinancePerm
            ? computePreviousDebt(cycle)
            : Promise.resolve(0),
        hasFinancePerm
            ? getHistoricalDebtKPI(cycle)
            : Promise.resolve(null),
        isCurrent
            ? StudentAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfToday, $lte: endOfToday }, status: 'Present' })
            : StudentAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfMonth, $lte: endOfMonth }, status: 'Present' }),
        isCurrent
            ? TeacherAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfToday, $lte: endOfToday }, status: 'Present' })
            : TeacherAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfMonth, $lte: endOfMonth }, status: 'Present' }),
        hasFinancePerm
            ? Transaction.find({ ...branchQuery, date: { $gte: startOfMonth, $lte: endOfMonth } })
                .sort({ date: -1 })
                .limit(10)
                .lean()
            : Promise.resolve([]),
        Notification.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const totalIncome = totalIncomeAgg.length > 0 ? totalIncomeAgg[0].total : 0;
    const totalExpenses = totalExpensesAgg.length > 0 ? totalExpensesAgg[0].total : 0;
    const totalSalaries = totalSalariesAgg.length > 0 ? totalSalariesAgg[0].total : 0;
    // Student fees collected specifically for this month (kiliya lacagta bisha saxda ah ee tooska ah)
    const studentFeesCollected = feeTotals.collected;
    const advanceCarriedIn = feeTotals.advanceCarriedIn || 0;
    const totalSettledFees = (feeTotals.totalSettled != null) ? feeTotals.totalSettled : (studentFeesCollected + advanceCarriedIn);
    const debtFeesCollected = debtFeesCollectedAgg.length > 0 ? debtFeesCollectedAgg[0].total : 0;
    const advanceFeesCollected = advanceFeesCollectedAgg.length > 0 ? advanceFeesCollectedAgg[0].total : 0;
    const totalStudentFeesCollected = studentFeesCollected + debtFeesCollected + advanceFeesCollected;
    const expectedStudentFees = feeTotals.expected;
    const pendingStudentFees = feeTotals.pending;

    const responsePayload = {
        cycle,
        cycleLabel: cycleLabel(cycle),
        cycleRange: {
            start: startOfMonth,
            end: endOfMonth
        },
        kpis: {
            totalStudents,
            newStudentsInCycle,
            allStudents,
            totalTeachers,
            newTeachersInCycle,
            allTeachers,
            totalClasses,
            totalGuardians,
            allGuardians,
            studentFeesCollected,
            advanceCarriedIn,
            totalSettledFees,
            debtFeesCollected,
            advanceFeesCollected,
            totalStudentFeesCollected,
            totalIncome,
            pendingStudentFees,
            totalExpenses,
            totalSalaries,
            expectedStudentFees,
            previousDebt,
            historicalCycleDebt: historicalDebtInfo ? (historicalDebtInfo.historicalCycleDebt || 0) : 0,
            historicalCycle: historicalDebtInfo ? historicalDebtInfo.historicalCycle : null,
            historicalCycleLabel: historicalDebtInfo ? historicalDebtInfo.historicalCycleLabel : '',
            historicalPayerCount: historicalDebtInfo ? (historicalDebtInfo.historicalPayerCount || 0) : 0,
            todayStudentAttendance: cycleStudentAttendance,
            todayTeacherAttendance: cycleTeacherAttendance,
            isCurrentCycle: isCurrent
        },
        activities: recentTransactions.map(t => ({
            id: t._id,
            user: t.performedBy || 'System',
            action: t.type,
            module: t.category || 'Finance',
            detail: `${t.description || ''} (${t.amount})`,
            date: t.date || t.createdAt
        })),
        notifications: recentNotifications,
        alerts: {
            lowStock: [],
            expiry: [],
            delayed: []
        }
    };

    dashboardCache.set(branchKey, {
        time: nowTime,
        data: responsePayload
    });

    res.json(responsePayload);
});

module.exports = {
    getDashboardData
};
