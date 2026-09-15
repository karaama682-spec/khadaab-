const asyncHandler = require('../middleware/asyncHandler');
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const Guardian = require('../models/Guardian');
const Payment = require('../models/Payment');
const Salary = require('../models/Salary');
const Expense = require('../models/Expense');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const StudentAttendance = require('../models/StudentAttendance');
const TeacherAttendance = require('../models/TeacherAttendance');
const Notification = require('../models/Notification');
const { currentCycle, cycleRange } = require('../utils/billingCycle');

// In-memory cache to prevent re-running 13 aggregations on every dashboard visit
const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL = 30 * 1000; // 30 seconds

// @desc    Get complete institute dashboard analytics data
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = asyncHandler(async (req, res) => {
    const branchId = req.user.branchId || req.user.warehouseId;
    const branchKey = String(branchId || 'all');
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

    // Financial "this month" = the current BILLING CYCLE (25th→24th), not the
    // calendar month. startOfMonth/endOfMonth below are the cycle's boundaries.
    const cycle = currentCycle();
    const { start: startOfMonth, end: endOfMonth } = cycleRange(cycle);
    const currentMonth = cycle; // billing-cycle key

    const [
        totalStudents,
        totalTeachers,
        totalClasses,
        totalGuardians,
        monthlyIncomeAgg,
        monthlyExpensesAgg,
        wallets,
        expectedFeesAgg,
        collectedThisMonthAgg,
        todayStudentAttendance,
        todayTeacherAttendance,
        recentTransactions,
        recentNotifications
    ] = await Promise.all([
        Student.countDocuments({ ...branchQuery, status: 'Active' }),
        User.countDocuments({ ...branchQuery, role: 'Teacher' }),
        Class.countDocuments(branchQuery),
        Guardian.countDocuments(branchQuery),
        Payment.aggregate([
            { $match: { ...branchQuery, status: 'Completed', paymentDate: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Expense.aggregate([
            { $match: { ...branchQuery, date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Wallet.find(branchQuery).lean(),
        // Total monthly fee the active students are expected to pay.
        Student.aggregate([
            { $match: { ...branchQuery, status: 'Active' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$monthlyFee', { $ifNull: ['$fee', 0] }] } } } }
        ]),
        // Fees actually collected for the current billing cycle: new payments by
        // their billingCycle key, historical payments by their real paymentDate.
        Payment.aggregate([
            { $match: {
                ...branchQuery,
                status: 'Completed',
                $or: [
                    { billingCycle: cycle },
                    { billingCycle: null, paymentDate: { $gte: startOfMonth, $lte: endOfMonth } }
                ]
            } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        StudentAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfToday, $lte: endOfToday }, status: 'Present' }),
        TeacherAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfToday, $lte: endOfToday }, status: 'Present' }),
        Transaction.find(branchQuery).sort({ date: -1 }).limit(10).lean(),
        Notification.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const walletBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
    const monthlyIncome = monthlyIncomeAgg.length > 0 ? monthlyIncomeAgg[0].total : 0;
    const monthlyExpenses = monthlyExpensesAgg.length > 0 ? monthlyExpensesAgg[0].total : 0;
    const expectedMonthlyFees = expectedFeesAgg.length > 0 ? expectedFeesAgg[0].total : 0;
    const collectedThisMonth = collectedThisMonthAgg.length > 0 ? collectedThisMonthAgg[0].total : 0;
    // Money still owed by students for the current month.
    const pendingStudentFees = Math.max(0, expectedMonthlyFees - collectedThisMonth);

    const responsePayload = {
        kpis: {
            totalStudents,
            totalTeachers,
            totalClasses,
            totalGuardians,
            monthlyIncome,
            monthlyExpenses,
            walletBalance,
            expectedMonthlyFees,
            collectedThisMonth,
            pendingStudentFees,
            todayStudentAttendance,
            todayTeacherAttendance
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
