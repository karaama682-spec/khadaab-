const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Payer autocomplete (GET /api/cashbook/lookup -> lookupPhone) must resolve ONLY
// active records — guardian, student, user/teacher, account — and must NEVER
// surface a name pulled from a historical cashbook entry (a past counterparty).
// These tests spin up an in-memory MongoDB, seed one historical cashbook row plus
// one of each active record on distinct phones, and drive the real exported
// handler directly.

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
let lookupPhone, Guardian, Student, User, Account, CashbookEntry, Class;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Guardian = require('../src/models/Guardian');
  Student = require('../src/models/Student');
  User = require('../src/models/User');
  Account = require('../src/models/Account');
  CashbookEntry = require('../src/models/CashbookEntry');
  Class = require('../src/models/Class');
  ({ lookupPhone } = require('../src/controllers/cashbookController'));

  const cls = await Class.create({ name: 'Test Class' });

  // HISTORICAL cashbook entry: a manual counterparty ("Cusmaan Barre") on a phone
  // that has NO active guardian/student/user/account. This is the exact bug shape.
  await CashbookEntry.create({
    categoryId: new mongoose.Types.ObjectId(), amount: 5, method: 'Cash',
    senderName: 'evc', senderPhone: '613025555', senderEntityType: 'manual',
    receiverName: 'Cusmaan Barre', receiverPhone: '615319969', receiverEntityType: 'manual',
    date: '2026-09-01', targetMonth: '2026-08'
  });

  // Active records, each on its own phone.
  await Guardian.create({ fullName: 'Active Guardian', phone: '639000002', type: 'Responsible' });
  await Student.create({
    studentCode: 'PLK-1', fullName: 'Active Kid', fatherName: 'Active Father',
    fatherPhone: '639000003', classId: cls._id, status: 'Active', monthlyFee: 10, fee: 10
  });
  await User.create({ fullName: 'Active Teacher', email: 'plk-teacher@test.local', phone: '639000004', role: 'Teacher', salary: 100, passwordHash: 'seed' });
  await Account.create({ warehouseId: new mongoose.Types.ObjectId(), name: 'Active Account', code: 'PLK-ACC', type: 'Expense', accountNo: '639000005', balance: 200 });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('historical cashbook name is NOT suggested for an unknown phone (receiver)', async () => {
  const r = await invoke(lookupPhone, { phone: '615319969', purpose: 'receiver' });
  assert.strictEqual(r.body.found, false, 'must report not-found for a historical-only phone');
  assert.strictEqual(r.body.name || '', '', 'must not return any name');
  assert.doesNotMatch(String(r.body.name || ''), /cusmaan/i, 'must never surface the old cashbook counterparty name');
});

test('historical cashbook name is NOT suggested for an unknown phone (sender)', async () => {
  const r = await invoke(lookupPhone, { phone: '615319969', purpose: 'sender' });
  assert.strictEqual(r.body.found, false);
  assert.doesNotMatch(String(r.body.name || ''), /cusmaan/i);
});

test('active guardian still resolves', async () => {
  const r = await invoke(lookupPhone, { phone: '639000002', purpose: 'sender' });
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Active Guardian');
  assert.strictEqual(r.body.entityType, 'guardian');
});

test("active student's responsible (father) still resolves", async () => {
  const r = await invoke(lookupPhone, { phone: '639000003', purpose: 'sender' });
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Active Father');
  assert.strictEqual(r.body.entityType, 'student');
});

test('active teacher/user still resolves', async () => {
  const r = await invoke(lookupPhone, { phone: '639000004', purpose: 'receiver' });
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Active Teacher');
  assert.strictEqual(r.body.entityType, 'teacher');
});

test('active account still resolves', async () => {
  const r = await invoke(lookupPhone, { phone: '639000005', purpose: 'receiver' });
  assert.strictEqual(r.body.found, true);
  assert.strictEqual(r.body.name, 'Active Account');
  assert.strictEqual(r.body.entityType, 'account');
});

test('the historical cashbook entry is left intact (lookup never mutates it)', async () => {
  const e = await CashbookEntry.findOne({ receiverPhone: '615319969' });
  assert.ok(e, 'entry still present');
  assert.strictEqual(e.receiverName, 'Cusmaan Barre', 'name unchanged');
});
