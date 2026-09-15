// ============================================================================
// SINGLE SOURCE OF TRUTH (frontend mirror of Backend/src/utils/billingCycle.js).
//
// Billing cycle = 25th of one month → 24th of the next. Keyed by the START
// month as "YYYY-MM":  "2026-09"  ->  Sep 25 → Oct 24 2026.
// A date on the 24th belongs to the PREVIOUS cycle; the 25th starts a new one.
// All math is UTC for a stable boundary. Keep this identical to the backend
// util (same test vector) so frontend labels/pickers match backend queries.
// ============================================================================

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const cycleKeyForDate = (date) => {
  const d = date ? new Date(date) : new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const anchor = new Date(Date.UTC(y, day >= 25 ? m : m - 1, 1));
  return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}`;
};

export const cycleRange = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 25, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 24, 23, 59, 59, 999));
  return { start, end };
};

export const isValidCycleKey = (key) => /^\d{4}-\d{2}$/.test(String(key || ''));

export const addCycles = (key, n) => {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export const currentCycle = () => cycleKeyForDate(new Date());
export const previousCycle = (key) => addCycles(key, -1);
export const nextCycle = (key) => addCycles(key, 1);

// "25 Sep – 24 Oct 2026"
export const cycleLabel = (key) => {
  const { start, end } = cycleRange(key);
  const s = `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
  const e = `${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  return `${s} – ${e}`;
};

// Short label for pickers, e.g. "Sep 25 → Oct 24, 2026"
export const cycleShortLabel = (key) => {
  const { start, end } = cycleRange(key);
  const mon = (d) => MONTHS[d.getUTCMonth()].slice(0, 3);
  return `${mon(start)} 25 → ${mon(end)} 24, ${end.getUTCFullYear()}`;
};

// ISO yyyy-mm-dd for the cycle's start/end (handy for date-range inputs).
export const cycleRangeISO = (key) => {
  const { start, end } = cycleRange(key);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};
