const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const invoke = (handler, { query = {}, body = {}, params = {}, user = {} }) => new Promise((resolve, reject) => {
  const req = { query, body, params, user };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => reject(err || new Error('unexpected next() with no error')));
});

let mongod;
let lookupPhone, getPayers, computePreviousDebt, updateStudent, cycles, student;
const PHONE = '615551234';

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Guardian = require('../src/models/Guardian');
  const Student = require('../src/models/Student');
  const Class = require('../src/models/Class');
  const Payment = require('../src/models/Payment');
  const { currentCycle, addCycles, cycleRange } = require('../src/utils/billingCycle');
  ({ lookupPhone, getPayers, computePreviousDebt } = require('../src/controllers/cashbookController'));
  ({ updateStudent } = require('../src/controllers/studentController'));

  const now = currentCycle();
  cycles = { c2: addCycles(now, -2), c1: addCycles(now, -1), now };

  const cls = await Class.create({ name: 'History Class' });
  const guardian = await Guardian.create({ fullName: 'Fee History Payer', phone: PHONE, type: 'Responsible' });
  
  // Student registered in c2 with monthlyFee = 20
  student = await Student.create({
    studentCode: 'HIST-001',
    fullName: 'Fee History Student',
    fatherName: 'Fee History Payer',
    fatherPhone: PHONE,
    guardianId: guardian._id,
    classId: cls._id,
    monthlyFee: 20,
    fee: 20,
    feeHistory: [
      { effectiveCycle: cycles.c2, amount: 20 }
    ],
    status: 'Active',
    registrationDate: cycleRange(cycles.c2).start
  });

  // c2 fully paid (20 of 20) -> owes 0
  await Payment.create({
    studentId: student._id,
    amount: 20,
    billingCycle: cycles.c2,
    paymentDate: cycleRange(cycles.c2).start,
    status: 'Completed'
  });

  // c1 partly paid (10 of 20) -> owes 10
  await Payment.create({
    studentId: student._id,
    amount: 10,
    billingCycle: cycles.c1,
    paymentDate: cycleRange(cycles.c1).start,
    status: 'Completed'
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('increasing student fee in the current cycle updates current and future fees without mutating past cycle debt', async () => {
  // Before fee edit: c1 owes 10, c2 owes 0. Total previous debt = 10.
  const debtBefore = await computePreviousDebt(cycles.now, { studentIds: [student._id] });
  assert.strictEqual(debtBefore, 10);

  // Now, admin updates student's fee from 20 to 30 in the current cycle
  const updateRes = await invoke(updateStudent, {
    params: { id: String(student._id) },
    body: { monthlyFee: 30 }
  });
  assert.strictEqual(updateRes.statusCode, 200);

  const updatedStudent = await mongoose.model('Student').findById(student._id).lean();
  assert.strictEqual(updatedStudent.monthlyFee, 30);
  assert.strictEqual(updatedStudent.feeHistory.length, 2);
  assert.strictEqual(updatedStudent.feeHistory[0].effectiveCycle, cycles.c2);
  assert.strictEqual(updatedStudent.feeHistory[0].amount, 20);
  assert.strictEqual(updatedStudent.feeHistory[1].effectiveCycle, cycles.now);
  assert.strictEqual(updatedStudent.feeHistory[1].amount, 30);

  // CRITICAL TEST: Previous debt must STILL be 10 (c1's 10 unpaid).
  // c2 must NOT suddenly owe (30-20=10), and c1 must NOT suddenly owe (30-10=20)!
  const debtAfter = await computePreviousDebt(cycles.now, { studentIds: [student._id] });
  assert.strictEqual(debtAfter, 10, 'Historical debt must not increase due to current cycle fee modification');

  // getPayers for past month c2 must show original fee (20) and paid = true
  const payersC2 = await invoke(getPayers, { query: { month: cycles.c2 } });
  const payerRowC2 = payersC2.body.find((p) => p.phone === PHONE);
  assert.ok(payerRowC2);
  assert.strictEqual(payerRowC2.totalFee, 20);
  assert.strictEqual(payerRowC2.paidAmount, 20);
  assert.strictEqual(payerRowC2.paid, true);

  // getPayers for current month must show the new fee (30) and remaining = 30
  const payersNow = await invoke(getPayers, { query: { month: cycles.now } });
  const payerRowNow = payersNow.body.find((p) => p.phone === PHONE);
  assert.ok(payerRowNow);
  assert.strictEqual(payerRowNow.totalFee, 30);
  assert.strictEqual(payerRowNow.paidAmount, 0);
  assert.strictEqual(payerRowNow.paid, false);

  // Cashbook lookupPhone reports current fee 30, previous debt 10, totalDue 40
  const lookupRes = await invoke(lookupPhone, { query: { phone: PHONE, purpose: 'sender' } });
  const info = lookupRes.body.payerInfo;
  assert.strictEqual(info.month, cycles.now);
  assert.strictEqual(info.totalMonthlyFee, 30);
  assert.strictEqual(info.totalBalance, 30);
  assert.strictEqual(info.previousBalance, 10);
  assert.strictEqual(info.totalDue, 40);
  assert.deepStrictEqual(info.arrears.map((a) => [a.month, a.balance]), [[cycles.c1, 10]]);
});

test('payer who paid $25 in previous cycle does NOT owe $5 arrears when student fee is changed from 10 to 15 (total $30)', async () => {
  const Guardian = require('../src/models/Guardian');
  const Student = require('../src/models/Student');
  const Class = require('../src/models/Class');
  const Payment = require('../src/models/Payment');
  const { cycleRange } = require('../src/utils/billingCycle');

  const PHONE_FAMILY = '619998877';
  const cls = await Class.findOne({ name: 'History Class' });
  const guardian = await Guardian.create({ fullName: 'Family Payer', phone: PHONE_FAMILY, type: 'Responsible' });

  // Student 1: $10/month (registered in c1)
  const s1 = await Student.create({
    studentCode: 'FAM-001',
    fullName: 'Family Child 1',
    fatherName: 'Family Payer',
    fatherPhone: PHONE_FAMILY,
    guardianId: guardian._id,
    classId: cls._id,
    monthlyFee: 10,
    fee: 10,
    status: 'Active',
    registrationDate: cycleRange(cycles.c1).start
  });

  // Student 2: $15/month (registered in c1)
  const s2 = await Student.create({
    studentCode: 'FAM-002',
    fullName: 'Family Child 2',
    fatherName: 'Family Payer',
    fatherPhone: PHONE_FAMILY,
    guardianId: guardian._id,
    classId: cls._id,
    monthlyFee: 15,
    fee: 15,
    status: 'Active',
    registrationDate: cycleRange(cycles.c1).start
  });

  // Previous cycle c1: Payer paid $25 in full ($10 for s1, $15 for s2)
  await Payment.create({
    studentId: s1._id,
    amount: 10,
    billingCycle: cycles.c1,
    paymentDate: cycleRange(cycles.c1).start,
    status: 'Completed'
  });
  await Payment.create({
    studentId: s2._id,
    amount: 15,
    billingCycle: cycles.c1,
    paymentDate: cycleRange(cycles.c1).start,
    status: 'Completed'
  });

  // Verify previous debt before edit is 0
  const debtBefore = await computePreviousDebt(cycles.now, { studentIds: [s1._id, s2._id] });
  assert.strictEqual(debtBefore, 0, 'Before edit, previous cycle is fully paid');

  // Admin updates Student 1 from $10 to $15 in current cycle
  const updateRes = await invoke(updateStudent, {
    params: { id: String(s1._id) },
    body: { monthlyFee: 15 }
  });
  assert.strictEqual(updateRes.statusCode, 200);

  // CRITICAL: Previous debt must STILL be 0!
  // Student 1 owed $10 in c1 and paid $10. Must NOT owe $5!
  const debtAfter = await computePreviousDebt(cycles.now, { studentIds: [s1._id, s2._id] });
  assert.strictEqual(debtAfter, 0, 'Previous cycle must NOT be recognized as owing $5 arrears!');

  // Monthly Payments for c1 must show totalFee: 25, paid: 25, paid: true
  const payersC1 = await invoke(getPayers, { query: { month: cycles.c1 } });
  const rowC1 = payersC1.body.find((p) => p.phone === PHONE_FAMILY);
  assert.ok(rowC1);
  assert.strictEqual(rowC1.totalFee, 25);
  assert.strictEqual(rowC1.paidAmount, 25);
  assert.strictEqual(rowC1.paid, true);

  // Monthly Payments for current cycle must show totalFee: 30
  const payersNow = await invoke(getPayers, { query: { month: cycles.now } });
  const rowNow = payersNow.body.find((p) => p.phone === PHONE_FAMILY);
  assert.ok(rowNow);
  assert.strictEqual(rowNow.totalFee, 30);
  assert.strictEqual(rowNow.paid, false);

  // Cashbook lookupPhone reports totalDue: 30, previousBalance: 0
  const lookupRes = await invoke(lookupPhone, { query: { phone: PHONE_FAMILY, purpose: 'sender' } });
  const info = lookupRes.body.payerInfo;
  assert.strictEqual(info.previousBalance, 0);
  assert.strictEqual(info.totalMonthlyFee, 30);
  assert.strictEqual(info.totalDue, 30);
  assert.deepStrictEqual(info.arrears, []);
});

