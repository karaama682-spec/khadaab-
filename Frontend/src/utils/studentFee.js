import { currentCycle } from './billingCycle';

/**
 * Returns the effective monthly fee for a student in a specific billing cycle ("YYYY-MM").
 *
 * If the student has a `feeHistory` array, this finds the latest entry where
 * `effectiveCycle <= cycle`.
 * If feeHistory is empty or absent, it falls back to `student.monthlyFee ?? student.fee ?? 0`.
 * If all entries in feeHistory are strictly after `cycle`, it does not back-project.
 *
 * @param {Object} student - Student doc or lean object with monthlyFee, fee, feeHistory
 * @param {string} [cycle] - Billing cycle key "YYYY-MM" (defaults to currentCycle())
 * @returns {number} The effective fee amount
 */
export const getStudentFeeForCycle = (student, cycle = currentCycle()) => {
  if (!student) return 0;
  const history = Array.isArray(student.feeHistory) ? student.feeHistory : [];
  if (history.length > 0 && cycle) {
    const sorted = [...history].sort((a, b) => (a.effectiveCycle || '').localeCompare(b.effectiveCycle || ''));
    let matched = null;
    for (const entry of sorted) {
      if (entry.effectiveCycle <= cycle) {
        matched = entry;
      } else {
        break;
      }
    }
    if (matched && typeof matched.amount === 'number') {
      return Number(matched.amount);
    }
    if (sorted.length > 0 && sorted[0].effectiveCycle > cycle) {
      return 0;
    }
  }
  return Number(student.monthlyFee ?? student.fee ?? 0);
};
