const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Invoke an asyncHandler(req, res, next) and resolve with the JSON it responds.
const invoke = (handler, query) => new Promise((resolve, reject) => {
  const req = { query };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => reject(err || new Error('unexpected next() with no error')));
});

let mongod;
let lookupPhone, Guardian, Student, Class;

const PHONE_1 = '615111111';
const PHONE_2 = '615222222';
const PHONE_3 = '615333333';

let payerMaxamed, cls, student1, student2;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Guardian = require('../src/models/Guardian');
  Student = require('../src/models/Student');
  Class = require('../src/models/Class');
  ({ lookupPhone } = require('../src/controllers/cashbookController'));

  cls = await Class.create({ name: 'Fasalka 1aad' });

  // Payer Maxamed Axmed has Phone 1 as primary and Phone 2 / Phone 3 in alternatePhone
  payerMaxamed = await Guardian.create({
    fullName: 'Maxamed Axmed',
    phone: PHONE_1,
    alternatePhone: `${PHONE_2} / ${PHONE_3}`,
    type: 'Responsible'
  });

  // Students belonging to Maxamed Axmed
  student1 = await Student.create({
    studentCode: 'STU-MAX-1',
    fullName: 'Cali Maxamed Axmed',
    fatherName: 'Maxamed Axmed',
    fatherPhone: PHONE_1,
    guardianId: payerMaxamed._id,
    classId: cls._id,
    monthlyFee: 15,
    fee: 15,
    status: 'Active'
  });

  student2 = await Student.create({
    studentCode: 'STU-MAX-2',
    fullName: 'Faadumo Maxamed Axmed',
    fatherName: 'Maxamed Axmed',
    fatherPhone: PHONE_1,
    guardianId: payerMaxamed._id,
    classId: cls._id,
    monthlyFee: 20,
    fee: 20,
    status: 'Active'
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('Phone Number 1 correctly finds payer Maxamed Axmed with student fees and balance', async () => {
  const r = await invoke(lookupPhone, { phone: PHONE_1, purpose: 'sender' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Maxamed Axmed');
  assert.strictEqual(r.body.entityType, 'guardian');
  assert.strictEqual(String(r.body.entityId), String(payerMaxamed._id));

  const info = r.body.payerInfo;
  assert.ok(info, 'payerInfo must be returned');
  assert.strictEqual(info.count, 2, 'Should have 2 students');
  assert.strictEqual(info.totalMonthlyFee, 35, 'Total monthly fee should be 35 (15 + 20)');
  assert.strictEqual(info.totalBalance, 35, 'Total balance should be 35');
  assert.strictEqual(info.remainingBalance, 35, 'Remaining balance should be 35');
});

test('Phone Number 2 (alternate/secondary) finds the EXACT SAME payer Maxamed Axmed record', async () => {
  const r = await invoke(lookupPhone, { phone: PHONE_2, purpose: 'sender' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Maxamed Axmed');
  assert.strictEqual(r.body.entityType, 'guardian');
  assert.strictEqual(String(r.body.entityId), String(payerMaxamed._id));

  const info = r.body.payerInfo;
  assert.ok(info, 'payerInfo must be returned');
  assert.strictEqual(info.count, 2, 'Should have 2 students');
  assert.strictEqual(info.totalMonthlyFee, 35, 'Total monthly fee should be 35');
  assert.strictEqual(info.totalBalance, 35, 'Total balance should be 35');
  assert.strictEqual(info.remainingBalance, 35, 'Remaining balance should be 35');
});

test('Phone Number 2 with leading zero (0615222222) finds the payer record', async () => {
  const r = await invoke(lookupPhone, { phone: `0${PHONE_2}`, purpose: 'sender' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Maxamed Axmed');
  assert.strictEqual(String(r.body.entityId), String(payerMaxamed._id));
  assert.strictEqual(r.body.payerInfo.remainingBalance, 35);
});

test('Phone Number 3 (delimited in alternatePhone) also finds the payer record', async () => {
  const r = await invoke(lookupPhone, { phone: PHONE_3, purpose: 'sender' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Maxamed Axmed');
  assert.strictEqual(String(r.body.entityId), String(payerMaxamed._id));
  assert.strictEqual(r.body.payerInfo.remainingBalance, 35);
});

test('Unknown phone number does NOT find any payer', async () => {
  const r = await invoke(lookupPhone, { phone: '619999999', purpose: 'sender' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.found, false);
  assert.strictEqual(r.body.name, '');
});
