const asyncHandler = require('../middleware/asyncHandler');
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const Guardian = require('../models/Guardian');
const Salary = require('../models/Salary');
const Transaction = require('../models/Transaction');
const StudentAttendance = require('../models/StudentAttendance');
const TeacherAttendance = require('../models/TeacherAttendance');
const Notification = require('../models/Notification');
const { currentCycle, cycleRange, cycleMatch } = require('../utils/billingCycle');
const { computeFeeTotals, computeAdvanceFeeTotal, computeAdvanceSalaryTotal } = require('./cashbookController');

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
        totalIncomeAgg,
        totalExpensesAgg,
        totalSalariesAgg,
        feeTotals,
        advanceStudentFees,
        advanceSalaries,
        todayStudentAttendance,
        todayTeacherAttendance,
        recentTransactions,
        recentNotifications
    ] = await Promise.all([
        Student.countDocuments({ ...branchQuery, status: 'Active' }),
        User.countDocuments({ ...branchQuery, role: 'Teacher' }),
        Class.countDocuments(branchQuery),
        Guardian.countDocuments(branchQuery),
        // FINANCE (institute-wide, no branch filter): the Transaction ledger is the
        // single source of truth for every money movement. Total Income = all
        // Income transactions posted within the current billing cycle. Student fee
        // payments post exactly one Transaction each, so they are counted once here.
        Transaction.aggregate([
            { $match: { type: 'Income', date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        // Total Expenses = all Expense transactions in the cycle (standalone
        // expenses + paid salaries, each of which posts one Expense transaction).
        Transaction.aggregate([
            { $match: { type: 'Expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        // Total Salaries = Paid salaries attributed to the cycle: new rows by their
        // billingCycle key, historical rows by their real paymentDate. Only Paid
        // salaries post an Expense transaction, so this is a subset of Total Expenses.
        Salary.aggregate([
            { $match: { status: 'Paid', ...cycleMatch('billingCycle', 'paymentDate', cycle) } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        // Student Fees Collected + Pending: reuse the exact Monthly-Payments
        // calculation (shared computeFeeTotals) so Dashboard and Finance agree.
        computeFeeTotals(cycle),
        // Advance cards (institute-wide): fees/salaries attributed to a FUTURE
        // billing cycle. Reuse the shared Finance helpers — the same billingCycle
        // "> current cycle" rule the rest of the system uses for advances.
        computeAdvanceFeeTotal(cycle),
        computeAdvanceSalaryTotal(cycle),
        StudentAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfToday, $lte: endOfToday }, status: 'Present' }),
        TeacherAttendance.countDocuments({ ...branchQuery, date: { $gte: startOfToday, $lte: endOfToday }, status: 'Present' }),
        Transaction.find(branchQuery).sort({ date: -1 }).limit(10).lean(),
        Notification.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const totalIncome = totalIncomeAgg.length > 0 ? totalIncomeAgg[0].total : 0;
    const totalExpenses = totalExpensesAgg.length > 0 ? totalExpensesAgg[0].total : 0;
    const totalSalaries = totalSalariesAgg.length > 0 ? totalSalariesAgg[0].total : 0;
    const studentFeesCollected = feeTotals.collected;
    const expectedStudentFees = feeTotals.expected;
    const pendingStudentFees = feeTotals.pending;

    const responsePayload = {
        kpis: {
            totalStudents,
            totalTeachers,
            totalClasses,
            totalGuardians,
            studentFeesCollected,
            totalIncome,
            pendingStudentFees,
            totalExpenses,
            totalSalaries,
            expectedStudentFees,
            advanceStudentFees,
            advanceSalaries,
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
