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
let Guardian, Student, Payment, Class, CycleDebtSnapshot;
let ensureCycleSnapshot, getHistoricalDebtKPI;
let getPayers;
let cycles;

const PHONE = '615296050';

test.before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    Guardian = require('../src/models/Guardian');
    Student = require('../src/models/Student');
    Payment = require('../src/models/Payment');
    Class = require('../src/models/Class');
    CycleDebtSnapshot = require('../src/models/CycleDebtSnapshot');

    const { currentCycle, addCycles, cycleRange } = require('../src/utils/billingCycle');
    ({ ensureCycleSnapshot, getHistoricalDebtKPI } = require('../src/services/cycleSnapshotService'));
    ({ getPayers } = require('../src/controllers/cashbookController'));

    const now = currentCycle();
    cycles = {
        c2: addCycles(now, -2),
        c1: addCycles(now, -1),
        now
    };

    const cls = await Class.create({ name: 'Snapshot Grade 1' });
    const guardian = await Guardian.create({ fullName: 'Hani Muqtaar', phone: PHONE, type: 'Responsible' });

    // Student registered in c1 with monthlyFee = 30
    const student = await Student.create({
        studentCode: 'SNP-001',
        fullName: 'Faadumo Cali',
        fatherName: 'Hani Muqtaar',
        fatherPhone: PHONE,
        guardianId: guardian._id,
        classId: cls._id,
        monthlyFee: 30,
        fee: 30,
        status: 'Active',
        registrationDate: cycleRange(cycles.c1).start
    });

    // Payment of $10 made during c1
    await Payment.create({
        studentId: student._id,
        guardianId: guardian._id,
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

test('Historical Cycle Debt: automatically captures and seals snapshot when cycle is closed', async () => {
    const snapshot = await ensureCycleSnapshot(cycles.c1);
    assert.ok(snapshot, 'Snapshot should be created for closed cycle');
    assert.equal(snapshot.cycle, cycles.c1);
    assert.equal(snapshot.totalDebt, 20, 'Expected $30 fee - $10 paid = $20 debt');
    assert.equal(snapshot.totalExpected, 30);
    assert.equal(snapshot.totalCollected, 10);
    assert.equal(snapshot.payerCount, 1);

    // Payers array in snapshot
    assert.equal(snapshot.payers.length, 1);
    const payer = snapshot.payers[0];
    assert.equal(payer.name, 'Hani Muqtaar');
    assert.equal(payer.phone, PHONE);
    assert.equal(payer.remaining, 20);
    assert.equal(payer.paid, false);
    assert.equal(payer.students.length, 1);
    assert.equal(payer.students[0].name, 'Faadumo Cali');
    assert.equal(payer.students[0].remaining, 20);
});

test('Historical Cycle Debt: remains 100% immutable even if a payment is recorded later', async () => {
    // Record a subsequent payment of $20 after the cycle has closed
    const student = await Student.findOne({ studentCode: 'SNP-001' });
    await Payment.create({
        studentId: student._id,
        amount: 20,
        billingCycle: cycles.now,
        paymentDate: new Date(),
        status: 'Completed'
    });

    // Request snapshot again
    const snapshotAgain = await ensureCycleSnapshot(cycles.c1);
    assert.equal(snapshotAgain.totalDebt, 20, 'Snapshot debt MUST remain $20 (never mutates)');

    // Request via getPayers for the closed cycle
    const { body: payers } = await invoke(getPayers, { query: { month: cycles.c1 } });
    assert.ok(Array.isArray(payers));
    const hani = payers.find((p) => p.phone === PHONE);
    assert.ok(hani, 'Hani must be present in snapshot payers');
    assert.equal(hani.remaining, 20, 'Payer remaining debt in closed cycle must remain $20');
});

test('Dashboard KPI: getHistoricalDebtKPI returns the frozen snapshot of the closed cycle', async () => {
    const kpi = await getHistoricalDebtKPI(cycles.now);
    assert.equal(kpi.historicalCycle, cycles.c1);
    assert.equal(kpi.historicalCycleDebt, 20, 'Dashboard KPI must display the frozen $20 debt');
    assert.equal(kpi.historicalPayerCount, 1);
});

test('Previous Debt view: getPayers with view=previousDebt returns live arrears matching computePreviousDebt', async () => {
    const { computePreviousDebt } = require('../src/controllers/cashbookController');
    const livePreviousDebt = await computePreviousDebt(cycles.now);

    const { body: prevPayers } = await invoke(getPayers, { query: { view: 'previousDebt' } });
    assert.ok(Array.isArray(prevPayers));
    const sumRemaining = prevPayers.reduce((acc, p) => acc + (p.remaining || 0), 0);
    assert.equal(sumRemaining, livePreviousDebt, 'Sum of remaining in view=previousDebt must strictly equal computePreviousDebt');
});

