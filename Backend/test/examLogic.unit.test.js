const test = require('node:test');
const assert = require('node:assert/strict');

// Test the result combining formula:
// Nisfi obtained / Nisfi Max (40 / 45) + Nihaayi obtained / Nihaayi Max (50 / 55) = 90 / 100
test('Nisfi + Nihaayi dynamic combined calculation', () => {
  const nisfiMax = 45;
  const nihaayiMax = 55;
  const combinedMax = nisfiMax + nihaayiMax;

  assert.strictEqual(combinedMax, 100);

  const studentMarks = {
    nisfi: 40,
    nihaayi: 50
  };

  const totalObtained = studentMarks.nisfi + studentMarks.nihaayi;
  assert.strictEqual(totalObtained, 90);

  const percentage = (totalObtained / combinedMax) * 100;
  assert.strictEqual(percentage, 90);
});

test('Validates end date is not earlier than start date', () => {
  const validateDates = (startDate, endDate) => {
    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        throw new Error('End date cannot be earlier than start date');
      }
    }
    return true;
  };

  assert.ok(validateDates('2026-11-01', '2026-11-10'));
  assert.ok(validateDates('2026-11-05', '2026-11-05'));
  assert.throws(() => validateDates('2026-11-10', '2026-11-05'), /earlier than start date/);
});

test('Validates maximum marks is numeric and greater than zero', () => {
  const validateMaxMarks = (val) => {
    const num = Number(val);
    if (!num || isNaN(num) || num <= 0) {
      throw new Error('Maximum marks must be a valid number greater than 0');
    }
    return num;
  };

  assert.strictEqual(validateMaxMarks(40), 40);
  assert.strictEqual(validateMaxMarks('45'), 45);
  assert.strictEqual(validateMaxMarks('100'), 100);
  assert.throws(() => validateMaxMarks(0), /greater than 0/);
  assert.throws(() => validateMaxMarks(-10), /greater than 0/);
  assert.throws(() => validateMaxMarks('abc'), /greater than 0/);
  assert.throws(() => validateMaxMarks(''), /greater than 0/);
});

test('Validates marks bounds: prevents negative marks and marks exceeding configured maximum', () => {
  const validateStudentMark = (mark, max) => {
    const n = Number(mark);
    if (isNaN(n) || n < 0 || n > max) {
      throw new Error(`Mark must be between 0 and ${max}`);
    }
    return n;
  };

  assert.strictEqual(validateStudentMark(40, 45), 40);
  assert.strictEqual(validateStudentMark(0, 45), 0);
  assert.strictEqual(validateStudentMark(45, 45), 45);
  assert.throws(() => validateStudentMark(-1, 45), /between 0 and 45/);
  assert.throws(() => validateStudentMark(46, 45), /between 0 and 45/);
  assert.throws(() => validateStudentMark(56, 55), /between 0 and 55/);
});

test('Subject auto-population maps configured maximum marks correctly to exam subjects', () => {
  const classActiveSubjects = [
    { name: 'Xisaab', nisfiFullMarks: 40, nihaayiFullMarks: 60, fullMarks: 100 },
    { name: 'Carabi', nisfiFullMarks: 40, nihaayiFullMarks: 60, fullMarks: 100 }
  ];

  const createExamSubjects = (subjects, examType, maxMarks) => {
    const isMidTerm = examType === 'Mid-Term';
    const isFinal = examType === 'Final';
    return subjects.map(s => ({
      name: s.name,
      nisfiFullMarks: isMidTerm ? maxMarks : Number(s.nisfiFullMarks || 40),
      nihaayiFullMarks: isFinal ? maxMarks : Number(s.nihaayiFullMarks || 60),
      fullMarks: maxMarks,
      passMarks: Math.max(1, Math.round(maxMarks * 0.4))
    }));
  };

  const midTermSubjects = createExamSubjects(classActiveSubjects, 'Mid-Term', 45);
  assert.strictEqual(midTermSubjects.length, 2);
  assert.strictEqual(midTermSubjects[0].nisfiFullMarks, 45);
  assert.strictEqual(midTermSubjects[0].fullMarks, 45);
  assert.strictEqual(midTermSubjects[0].passMarks, 18); // 45 * 0.4 = 18

  const finalSubjects = createExamSubjects(classActiveSubjects, 'Final', 55);
  assert.strictEqual(finalSubjects.length, 2);
  assert.strictEqual(finalSubjects[0].nihaayiFullMarks, 55);
  assert.strictEqual(finalSubjects[0].fullMarks, 55);
  assert.strictEqual(finalSubjects[0].passMarks, 22); // 55 * 0.4 = 22
});
