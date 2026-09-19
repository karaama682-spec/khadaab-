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
let lookupPhone, createEntry, Guardian, Student, Class, CashbookCategory, Wallet, Payment;

const PHONE_PAYER1 = '614047121';
const PHONE_PAYER2 = '615758443';

let payer1, payer2, cls, student1, student2, catIncome, wallet;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Guardian = require('../src/models/Guardian');
  Student = require('../src/models/Student');
  Class = require('../src/models/Class');
  CashbookCategory = require('../src/models/CashbookCategory');
  Wallet = require('../src/models/Wallet');
  Payment = require('../src/models/Payment');
  ({ lookupPhone, createEntry } = require('../src/controllers/cashbookController'));

  cls = await Class.create({ name: 'Class 1' });
  wallet = await Wallet.create({ name: 'Main Cash Wallet', type: 'Mobile', balance: 0, status: 'Active' });
  catIncome = await CashbookCategory.create({ title: 'Student Fees', type: 'Income' });

  // 1. Initially, Payer 1 is registered with PHONE_PAYER1
  payer1 = await Guardian.create({ fullName: 'Payer One', phone: PHONE_PAYER1, type: 'Responsible' });

  // 2. Payer 2 is registered with PHONE_PAYER2
  payer2 = await Guardian.create({ fullName: 'Payer Two', phone: PHONE_PAYER2, type: 'Responsible' });

  // 3. Two students initially created under Payer 1
  student1 = await Student.create({
    studentCode: 'STU-001',
    fullName: 'Student 1',
    fatherName: 'Payer One',
    fatherPhone: PHONE_PAYER1,
    guardianId: payer1._id,
    classId: cls._id,
    monthlyFee: 10,
    fee: 10,
    status: 'Active'
  });

  // Student 2 was originally under Payer 1, but then reassigned to Payer 2 (guardianId changed to payer2._id),
  // while its fatherPhone still retains PHONE_PAYER1 (the exact bug condition).
  student2 = await Student.create({
    studentCode: 'STU-002',
    fullName: 'Student 2',
    fatherName: 'Payer One',
    fatherPhone: PHONE_PAYER1, // stale old phone
    guardianId: payer2._id,    // new current payer
    classId: cls._id,
    monthlyFee: 10,
    fee: 10,
    status: 'Active'
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('Cash Book Data Entry lookup for Payer 1 shows 1 student and $10 (excludes Student 2)', async () => {
  const r = await invoke(lookupPhone, { query: { phone: PHONE_PAYER1, purpose: 'sender' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Payer One');
  assert.strictEqual(r.body.entityType, 'guardian');

  const info = r.body.payerInfo;
  assert.ok(info, 'payerInfo must be present');
  assert.strictEqual(info.count, 1, 'Payer 1 must have exactly 1 student');
  assert.strictEqual(info.totalMonthlyFee, 10, 'Payer 1 total fee must be $10');
  assert.strictEqual(info.totalBalance, 10, 'Payer 1 balance must be $10');
  assert.strictEqual(info.students.length, 1);
  assert.strictEqual(String(info.students[0].studentId), String(student1._id));
});

test('Cash Book Data Entry lookup for Payer 2 shows 1 student and $10 (includes Student 2)', async () => {
  const r = await invoke(lookupPhone, { query: { phone: PHONE_PAYER2, purpose: 'sender' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Payer Two');
  assert.strictEqual(r.body.entityType, 'guardian');

  const info = r.body.payerInfo;
  assert.ok(info, 'payerInfo must be present');
  assert.strictEqual(info.count, 1, 'Payer 2 must have exactly 1 student');
  assert.strictEqual(info.totalMonthlyFee, 10, 'Payer 2 total fee must be $10');
  assert.strictEqual(info.totalBalance, 10, 'Payer 2 balance must be $10');
  assert.strictEqual(info.students.length, 1);
  assert.strictEqual(String(info.students[0].studentId), String(student2._id));
});

test('syncFeePayments for Payer 1 entry only allocates payment to Student 1, not Student 2', async () => {
  const entryPayload = {
    categoryId: catIncome._id,
    walletId: wallet._id,
    amount: 10,
    method: 'Cash',
    senderName: 'Payer One',
    senderPhone: PHONE_PAYER1,
    senderEntityType: 'guardian',
    senderEntityId: String(payer1._id),
    date: new Date().toISOString().slice(0, 10)
  };

  const r = await invoke(createEntry, { body: entryPayload, user: { _id: new mongoose.Types.ObjectId() } });
  assert.strictEqual(r.statusCode, 201);

  // Check payments created
  const payments = await Payment.find({ sourceEntryId: r.body._id });
  assert.strictEqual(payments.length, 1, 'Only one payment must be created');
  assert.strictEqual(String(payments[0].studentId), String(student1._id), 'Payment must be allocated to Student 1 only');
  assert.strictEqual(payments[0].amount, 10);
});
