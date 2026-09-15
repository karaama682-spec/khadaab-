// ============================================================================
// SINGLE SOURCE OF TRUTH for the institute billing/reporting cycle.
//
// A billing cycle runs from the 25th of one month through the 24th of the next
// month. Each cycle is KEYED by the month it STARTS in, as a "YYYY-MM" string.
//   key "2026-09"  ->  Sep 25 2026 00:00:00.000  →  Oct 24 2026 23:59:59.999
//
// Boundary rule: a date on the 24th belongs to the PREVIOUS cycle; a date on the
// 25th starts a NEW cycle. All math is done in UTC to match how dates are stored
// (Date.prototype.toISOString), so the boundary is stable regardless of server
// timezone. Handles month/year/Jan-Dec transitions and leap years naturally
// (the 24th and 25th always exist in every month).
// ============================================================================

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// The billing cycle a real date belongs to (returns the cycle KEY "YYYY-MM").
const cycleKeyForDate = (date) => {
    const d = date ? new Date(date) : new Date();
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();      // 0-11
    const day = d.getUTCDate();
    // day >= 25 → this month's cycle; day < 25 → previous month's cycle.
    const anchor = new Date(Date.UTC(y, day >= 25 ? m : m - 1, 1));
    return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}`;
};

// Exact date range for a cycle key: [25th of key-month, 24th of next month].
const cycleRange = (key) => {
    const [y, m] = String(key).split('-').map(Number); // m is 1-based
    const start = new Date(Date.UTC(y, m - 1, 25, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 24, 23, 59, 59, 999));
    return { start, end };
};

const isValidCycleKey = (key) => /^\d{4}-\d{2}$/.test(String(key || ''));

// Shift a cycle key by n cycles (n may be negative).
const addCycles = (key, n) => {
    const [y, m] = String(key).split('-').map(Number);
    const d = new Date(Date.UTC(y, (m - 1) + n, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

const currentCycle = () => cycleKeyForDate(new Date());
const previousCycle = (key) => addCycles(key, -1);
const nextCycle = (key) => addCycles(key, 1);

// Human label, e.g. "25 Sep – 24 Oct 2026".
const cycleLabel = (key) => {
    const { start, end } = cycleRange(key);
    const s = `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
    const e = `${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
    return `${s} – ${e}`;
};

// A Mongo filter fragment that matches records belonging to `key`, working for
// BOTH new records (which store the cycle key in `cycleField`) and historical
// records (no cycle key — attributed by their real date in `dateField`).
// Usage: Payment.find({ ...cycleMatch('billingCycle', 'paymentDate', key), status: 'Completed' })
const cycleMatch = (cycleField, dateField, key) => {
    const { start, end } = cycleRange(key);
    return {
        $or: [
            { [cycleField]: key },
            { [cycleField]: null, [dateField]: { $gte: start, $lte: end } }
        ]
    };
};

module.exports = {
    cycleKeyForDate,
    cycleRange,
    isValidCycleKey,
    addCycles,
    currentCycle,
    previousCycle,
    nextCycle,
    cycleLabel,
    cycleMatch
};
