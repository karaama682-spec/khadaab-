const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const invoke = (handler, { query = {}, body = {}, user = {} }) => new Promise((resolve, reject) => {
  const req = { query, body, user };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => reject(err || new Error('unexpected next() with no error')));
});

let mongod;
let lookupPhone, cycles, student;
const PHONE = '614047999';

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Guardian = require('../src/models/Guardian');
  const Student = require('../src/models/Student');
  const Class = require('../src/models/Class');
  const Payment = require('../src/models/Payment');
  const { currentCycle, addCycles, cycleRange } = require('../src/utils/billingCycle');
  ({ lookupPhone } = require('../src/controllers/cashbookController'));

  const now = currentCycle();
  cycles = { c3: addCycles(now, -3), c2: addCycles(now, -2), c1: addCycles(now, -1), now };

  const cls = await Class.create({ name: 'Arrears Class' });
  const guardian = await Guardian.create({ fullName: 'Arrears Payer', phone: PHONE, type: 'Responsible' });
  student = await Student.create({
    studentCode: 'ARR-001',
    fullName: 'Arrears Student',
    fatherName: 'Arrears Payer',
    fatherPhone: PHONE,
    guardianId: guardian._id,
    classId: cls._id,
    monthlyFee: 20,
    fee: 20,
    status: 'Active',
    registrationDate: cycleRange(cycles.c3).start
  });

  // c3 fully paid, c2 partly paid (5 of 20), c1 unpaid, current cycle unpaid.
  await Payment.create({ studentId: student._id, amount: 20, billingCycle: cycles.c3, paymentDate: cycleRange(cycles.c3).start });
  await Payment.create({ studentId: student._id, amount: 5, billingCycle: cycles.c2, paymentDate: cycleRange(cycles.c2).start });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('phone lookup reports unpaid balances from previous months alongside the current month', async () => {
  const r = await invoke(lookupPhone, { query: { phone: PHONE, purpose: 'sender' } });
  const info = r.body.payerInfo;

  // Current-month figures are unchanged.
  assert.strictEqual(info.month, cycles.now);
  assert.strictEqual(info.totalBalance, 20);
  assert.strictEqual(info.remainingBalance, 20);

  // Arrears: c2 owes 15, c1 owes 20; the fully paid c3 is not listed.
  assert.strictEqual(info.previousBalance, 35);
  assert.strictEqual(info.totalDue, 55);
  assert.deepStrictEqual(info.arrears.map((a) => [a.month, a.balance]), [[cycles.c2, 15], [cycles.c1, 20]]);
  assert.strictEqual(info.students[0].previousBalance, 35);
  assert.strictEqual(info.students[0].arrears.length, 2);

  // Same source as the Dashboard's "Deyn Hore": with this one payer in the DB the totals match.
  const { computePreviousDebt } = require('../src/controllers/cashbookController');
  assert.strictEqual(await computePreviousDebt(), info.previousBalance);
});

test('arrears only count cycles before the month in focus', async () => {
  const r = await invoke(lookupPhone, { query: { phone: PHONE, purpose: 'sender', month: cycles.c1 } });
  const info = r.body.payerInfo;
  assert.strictEqual(info.previousBalance, 15);
  assert.deepStrictEqual(info.arrears.map((a) => a.month), [cycles.c2]);
});

test('paying arrears starting at oldest unpaid cycle clears historical debt across cycles', async () => {
  const CashbookCategory = require('../src/models/CashbookCategory');
  const Wallet = require('../src/models/Wallet');
  const Payment = require('../src/models/Payment');
  const { createEntry } = require('../src/controllers/cashbookController');

  const wallet = await Wallet.create({ name: 'Cashbook Test Wallet', type: 'Bank', accountNumber: '1234567', balance: 0, status: 'Active' });
  const cat = await CashbookCategory.create({ title: 'Student Fee', type: 'Income' });

  const Guardian = require('../src/models/Guardian');
  const guardian = await Guardian.findOne({ phone: PHONE });

  const r = await invoke(createEntry, {
    body: {
      categoryId: cat._id,
      amount: 35,
      senderPhone: PHONE,
      senderEntityType: 'guardian',
      senderEntityId: guardian._id,
      targetMonth: cycles.c2,
      walletId: wallet._id
    }
  });

  assert.strictEqual(r.statusCode, 201);

  // Payments were created for c2 ($15) and c1 ($20)
  const payments = await Payment.find({ studentId: student._id });
  const c2Payments = payments.filter((p) => p.billingCycle === cycles.c2);
  const c1Payments = payments.filter((p) => p.billingCycle === cycles.c1);
  assert.strictEqual(c2Payments.reduce((s, p) => s + p.amount, 0), 20);
  assert.strictEqual(c1Payments.reduce((s, p) => s + p.amount, 0), 20);

  // Arrears are now fully cleared!
  const lookup = await invoke(lookupPhone, { query: { phone: PHONE, purpose: 'sender' } });
  assert.strictEqual(lookup.body.payerInfo.previousBalance, 0);
  assert.deepStrictEqual(lookup.body.payerInfo.arrears, []);
  assert.strictEqual(lookup.body.payerInfo.totalBalance, 20); // only current month left
  assert.strictEqual(lookup.body.payerInfo.totalDue, 20);
});

