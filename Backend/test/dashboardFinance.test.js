const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// The Dashboard finance cards must reuse the EXISTING Finance system as the single
// source of truth, institute-wide (no branch filter), on the 25th→24th billing
// cycle. This test seeds a realistic slice of that ledger and asserts the five
// accounting identities the cards must satisfy:
//   1. Student Fees Collected + Pending Student Fees = Expected Student Fees
//   2. Student Fees Collected + Other Income          = Total Income
//   3. Total Salaries        + Other Expenses         = Total Expenses
//   4. Student fee income is counted exactly once in Total Income (guarded by #2)
//   5. Finance is institute-wide: a branch-scoped user still sees the same totals.
//   6. Advance Student Fees / Advance Salaries (payments attributed to a FUTURE
//      billing cycle) are reported on their own cards and are NOT counted in the
//      current-cycle figures (Student Fees Collected, Total Income, Total
//      Salaries, Total Expenses).

const invoke = (handler, user = {}) => new Promise((resolve, reject) => {
  const req = { user, query: {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => reject(err || new Error('unexpected next() with no error')));
});

let mongod;
let getDashboardData, Student, Class, Payment, Transaction, Salary, Wallet, Branch;
let cycle, inCycleDate;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Student = require('../src/models/Student');
  Class = require('../src/models/Class');
  Payment = require('../src/models/Payment');
  Transaction = require('../src/models/Transaction');
  Salary = require('../src/models/Salary');
  Wallet = require('../src/models/Wallet');
  Branch = require('../src/models/Branch');
  ({ getDashboardData } = require('../src/controllers/dashboardController'));
  const { currentCycle, cycleRange, nextCycle } = require('../src/utils/billingCycle');

  cycle = currentCycle();
  const futureCycle = nextCycle(cycle);
  const { start } = cycleRange(cycle);
  inCycleDate = new Date(start.getTime() + 24 * 60 * 60 * 1000); // 1 day into the cycle

  const branch = await Branch.create({ name: 'DFT Branch' });
  const wallet = await Wallet.create({ name: 'DFT Wallet', branchId: branch._id, balance: 0 });
  const cls = await Class.create({ name: 'DFT Class', branchId: branch._id });

  // Two active students, monthly fee 100 each -> Expected = 200.
  const studentA = await Student.create({
    studentCode: 'DFT-A', fullName: 'Paid Kid', fatherName: 'Father A', fatherPhone: '610000001',
    classId: cls._id, status: 'Active', monthlyFee: 100, fee: 100, registrationDate: start
  });
  await Student.create({
    studentCode: 'DFT-B', fullName: 'Owing Kid', fatherName: 'Father B', fatherPhone: '610000002',
    classId: cls._id, status: 'Active', monthlyFee: 100, fee: 100, registrationDate: start
  });

  // Student A pays their full 100 for this cycle. In production a fee payment
  // creates BOTH a Payment (read by computeFeeTotals) AND one Income Transaction
  // (read by Total Income) — so we mirror that exactly. Collected = 100, Pending = 100.
  await Payment.create({
    studentId: studentA._id, amount: 100, status: 'Completed',
    billingCycle: cycle, paymentDate: inCycleDate, walletId: wallet._id
  });
  await Transaction.create({
    walletId: wallet._id, branchId: branch._id, type: 'Income', amount: 100,
    referenceId: studentA._id, description: 'Fee payment', date: inCycleDate
  });

  // A non-fee income (e.g. donation) of 50 -> Other Income = 50.
  await Transaction.create({
    walletId: wallet._id, branchId: branch._id, type: 'Income', amount: 50,
    referenceId: new mongoose.Types.ObjectId(), description: 'Donation', date: inCycleDate
  });

  // A Paid salary of 300 for this cycle -> posts one Expense Transaction of 300.
  const salary = await Salary.create({
    teacherId: new mongoose.Types.ObjectId(), walletId: wallet._id, month: '2000-01',
    billingCycle: cycle, amount: 300, status: 'Paid', paymentDate: inCycleDate
  });
  await Transaction.create({
    walletId: wallet._id, branchId: branch._id, type: 'Expense', amount: 300,
    referenceId: salary._id, description: 'Salary', date: inCycleDate
  });

  // A standalone expense of 70 -> Other Expenses = 70. Total Expenses = 300 + 70.
  await Transaction.create({
    walletId: wallet._id, branchId: branch._id, type: 'Expense', amount: 70,
    referenceId: new mongoose.Types.ObjectId(), description: 'Utilities', date: inCycleDate
  });

  // ADVANCE student fee: a completed payment attributed to a FUTURE cycle (as
  // syncFeePayments creates when leftover rolls forward). 200 paid ahead. It must
  // land in Advance Student Fees only — never in current-cycle collected/income.
  await Payment.create({
    studentId: studentA._id, amount: 200, status: 'Completed',
    billingCycle: futureCycle, paymentDate: inCycleDate, walletId: wallet._id
  });

  // ADVANCE salary: a Paid salary attributed to a FUTURE cycle (isAdvance). 400
  // paid ahead. It must land in Advance Salaries only — never in current Total
  // Salaries / Total Expenses.
  await Salary.create({
    teacherId: new mongoose.Types.ObjectId(), walletId: wallet._id, month: '2000-02',
    billingCycle: futureCycle, amount: 400, status: 'Paid', paymentDate: inCycleDate
  });

  global.__dftBranchId = branch._id;
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('dashboard finance cards satisfy the accounting identities', async () => {
  const { body } = await invoke(getDashboardData, {});
  const k = body.kpis;

  assert.equal(k.expectedStudentFees, 200, 'expected fees = 2 students x 100');
  assert.equal(k.studentFeesCollected, 100, 'collected = student A full fee');
  assert.equal(k.pendingStudentFees, 100, 'pending = student B unpaid fee');
  assert.equal(k.totalIncome, 150, 'total income = 100 fee + 50 donation');
  assert.equal(k.totalExpenses, 370, 'total expenses = 300 salary + 70 utilities');
  assert.equal(k.totalSalaries, 300, 'total salaries = paid salary');

  // Identity 1: Collected + Pending = Expected
  assert.equal(k.studentFeesCollected + k.pendingStudentFees, k.expectedStudentFees);

  // Identity 2: Collected + Other Income = Total Income (also proves the fee is
  // counted ONCE — a double count would make totalIncome 250, not 150).
  const otherIncome = 50;
  assert.equal(k.studentFeesCollected + otherIncome, k.totalIncome);

  // Identity 3: Total Salaries + Other Expenses = Total Expenses
  const otherExpenses = 70;
  assert.equal(k.totalSalaries + otherExpenses, k.totalExpenses);

  // Advance cards report the future-cycle amounts...
  assert.equal(k.advanceStudentFees, 200, 'advance fees = future-cycle payment');
  assert.equal(k.advanceSalaries, 400, 'advance salaries = future-cycle paid salary');

  // ...and those advances are NOT double-counted in any current-cycle figure.
  assert.equal(k.studentFeesCollected, 100, 'advance fee excluded from collected');
  assert.equal(k.totalIncome, 150, 'advance fee excluded from total income');
  assert.equal(k.totalSalaries, 300, 'advance salary excluded from total salaries');
  assert.equal(k.totalExpenses, 370, 'advance salary excluded from total expenses');

  // Removed cards must be gone.
  assert.equal(k.monthlyIncome, undefined);
  assert.equal(k.walletBalance, undefined);
});

test('finance is institute-wide: branch-scoped user sees identical totals', async () => {
  // A user bound to the seeded branch must see the same finance numbers as an
  // unscoped admin (finance queries carry no branch filter).
  const { body } = await invoke(getDashboardData, { branchId: global.__dftBranchId });
  const k = body.kpis;
  assert.equal(k.totalIncome, 150);
  assert.equal(k.totalExpenses, 370);
  assert.equal(k.totalSalaries, 300);
  assert.equal(k.studentFeesCollected, 100);
  assert.equal(k.pendingStudentFees, 100);
  assert.equal(k.advanceStudentFees, 200);
  assert.equal(k.advanceSalaries, 400);
});
