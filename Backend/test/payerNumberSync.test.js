const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Changing a Payer's (Guardian's) CURRENT phone must:
//   • update the payer's own number, and
//   • propagate to fatherPhone on every student linked to that payer,
// while leaving ALL finance history (cashbook entries = the historical payer
// number snapshot, payments, transactions) exactly as it was.

const invoke = (handler, { params = {}, body = {} }) => new Promise((resolve, reject) => {
  const req = { params, body };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => reject(err || new Error('unexpected next()')));
});

let mongod, updateGuardian, Guardian, Student, CashbookEntry, Payment, Class;
const OLD = '615998987';
const NEW = '616123456';
let guardian, cls, entry1, entry2, payment, s1, s2, s3;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Guardian = require('../src/models/Guardian');
  Student = require('../src/models/Student');
  CashbookEntry = require('../src/models/CashbookEntry');
  Payment = require('../src/models/Payment');
  Class = require('../src/models/Class');
  ({ updateGuardian } = require('../src/controllers/guardianController'));

  cls = await Class.create({ name: 'PNS Class' });
  guardian = await Guardian.create({ fullName: 'PNS Payer', phone: OLD, type: 'Responsible' });
  s1 = await Student.create({ studentCode: 'PNS-A', fullName: 'PNS A', fatherName: 'PNS Payer', fatherPhone: OLD, classId: cls._id, guardianId: guardian._id, status: 'Active', monthlyFee: 10, fee: 10 });
  s2 = await Student.create({ studentCode: 'PNS-B', fullName: 'PNS B', fatherName: 'PNS Payer', fatherPhone: OLD, classId: cls._id, guardianId: guardian._id, status: 'Active', monthlyFee: 10, fee: 10 });
  s3 = await Student.create({ studentCode: 'PNS-C', fullName: 'PNS C', fatherName: 'PNS Payer', fatherPhone: OLD, classId: cls._id, guardianId: guardian._id, status: 'Active', monthlyFee: 10, fee: 10 });
  // Two historical cashbook "old payments" carrying the OLD payer number snapshot.
  entry1 = await CashbookEntry.create({ categoryId: new mongoose.Types.ObjectId(), amount: 10, method: 'Cash', senderName: 'PNS Payer', senderPhone: OLD, senderEntityType: 'guardian', senderEntityId: guardian._id, date: '2026-08-01', targetMonth: '2026-07' });
  entry2 = await CashbookEntry.create({ categoryId: new mongoose.Types.ObjectId(), amount: 10, method: 'Cash', senderName: 'PNS Payer', senderPhone: OLD, senderEntityType: 'guardian', senderEntityId: guardian._id, date: '2026-09-01', targetMonth: '2026-08' });
  payment = await Payment.create({ studentId: s1._id, guardianId: guardian._id, amount: 10, month: '2026-08', billingCycle: '2026-08', sourceEntryId: entry1._id });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('changing the payer number updates the payer', async () => {
  const r = await invoke(updateGuardian, { params: { id: String(guardian._id) }, body: { phone: NEW } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.phone, NEW);
  const fresh = await Guardian.findById(guardian._id);
  assert.strictEqual(fresh.phone, NEW);
});

test('the new number is synchronized to ALL linked students', async () => {
  for (const s of [s1, s2, s3]) {
    const fresh = await Student.findById(s._id);
    assert.strictEqual(fresh.fatherPhone, NEW, `${s.studentCode} fatherPhone should be the new number`);
  }
});

test('historical cashbook entries STILL show the old payer number', async () => {
  const e1 = await CashbookEntry.findById(entry1._id);
  const e2 = await CashbookEntry.findById(entry2._id);
  assert.strictEqual(e1.senderPhone, OLD, 'old payment 1 must keep 615998987');
  assert.strictEqual(e2.senderPhone, OLD, 'old payment 2 must keep 615998987');
});

test('historical payment record is untouched (no phone rewritten, links intact)', async () => {
  const p = await Payment.findById(payment._id);
  assert.strictEqual(p.amount, 10);
  assert.strictEqual(String(p.guardianId), String(guardian._id));
  assert.strictEqual(String(p.sourceEntryId), String(entry1._id));
  assert.strictEqual(p.phone, undefined, 'Payment has no phone field and none was added');
});

test('no extra guardians/students were created by the update', async () => {
  assert.strictEqual(await Guardian.countDocuments({}), 1);
  assert.strictEqual(await Student.countDocuments({}), 3);
  assert.strictEqual(await CashbookEntry.countDocuments({}), 2);
});

test('updating payer with studentIds links unlinked students and syncs phone and name', async () => {
  const unlinkedStudent = await Student.create({
    studentCode: 'PNS-UNLINKED',
    fullName: 'Unlinked Kid',
    fatherName: 'Old Name',
    fatherPhone: '619999999',
    classId: cls._id,
    status: 'Active',
    monthlyFee: 15
  });

  const r = await invoke(updateGuardian, {
    params: { id: String(guardian._id) },
    body: {
      fullName: 'Updated Payer Name',
      phone: '618888888',
      alternatePhone: '618777777',
      studentIds: [String(unlinkedStudent._id)]
    }
  });

  assert.strictEqual(r.statusCode, 200);
  const updatedStudent = await Student.findById(unlinkedStudent._id);
  assert.strictEqual(String(updatedStudent.guardianId), String(guardian._id));
  assert.strictEqual(updatedStudent.fatherPhone, '618888888');
  assert.strictEqual(updatedStudent.fatherName, 'Updated Payer Name');

  const g = await Guardian.findById(guardian._id);
  assert.strictEqual(g.alternatePhone, '618777777');
});

