// Read-only reproductions: real controller code, isolated model doubles, no database.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../Backend/src');
function controller(name, overrides = {}) {
  const filename = path.join(root, 'controllers', name + 'Controller.js');
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  const mocks = {
    '../middleware/asyncHandler': fn => fn,
    '../utils/auditLogger': { logAudit: async () => {} },
    ...overrides
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console, Date,
    require: key => Object.hasOwn(mocks, key) ? mocks[key] : realRequire(key)
  }, { filename });
  return module.exports;
}
const response = () => ({ status() { return this; }, json(value) { this.body = value; } });
const chain = value => ({ select() { return this; }, populate() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value });
let count = 0;
async function check(name, fn) { await fn(); count++; console.log('CONFIRMED: ' + name); }
(async () => {
  await check('Cashbook delete twice reverses the same income twice', async () => {
    const wallet = { balance: 100, save: async () => {} };
    const entry = { _id: 'entry', amount: 20, walletId: 'wallet', categoryId: 'category', targetMonth: '2026-10', save: async () => {} };
    const c = controller('cashbook', {
      '../models/CashbookEntry': { findById: async () => entry },
      '../models/CashbookCategory': { findById: async () => ({ type: 'Income' }) },
      '../models/Wallet': { findById: async () => wallet },
      '../models/CycleLock': { findOne: async () => null },
      '../models/Transaction': { deleteMany: async () => {} },
      '../models/Payment': { deleteMany: async () => {} },
      '../models/Salary': { deleteMany: async () => {} }
    });
    const req = { params: { id: 'entry' }, user: {} };
    await c.deleteEntry(req, response());
    await c.deleteEntry(req, response());
    assert.equal(wallet.balance, 60);
  });
  await check('Rejected Cashbook edit changes wallet before validation fails', async () => {
    const wallet = { _id: 'wallet', balance: 100, save: async () => {} };
    const c = controller('cashbook', {
      '../models/CashbookEntry': {
        findById: async () => ({ amount: 20, walletId: 'wallet', categoryId: 'category', targetMonth: '2026-10' }),
        findByIdAndUpdate: () => ({ populate: async () => { throw new Error('amount validation failed'); } })
      },
      '../models/CashbookCategory': { findById: async () => ({ type: 'Income' }) },
      '../models/Wallet': { findById: async () => wallet },
      '../models/CycleLock': { findOne: async () => null }
    });
    await assert.rejects(c.updateEntry({ params: { id: 'entry' }, body: { amount: -1 }, user: {} }, response()), /validation/);
    assert.equal(wallet.balance, 80);
  });
  await check('Deleting a Cashbook-linked Payment subtracts wallet credit owned by Cashbook', async () => {
    const wallet = { balance: 100, save: async () => {} };
    const c = controller('payment', {
      '../models/Payment': { findById: async () => ({ _id: 'payment', sourceEntryId: 'entry', amount: 20, walletId: 'wallet', status: 'Completed', deleteOne: async () => {} }) },
      '../models/Wallet': { findById: async () => wallet },
      '../models/Transaction': { deleteMany: async () => {} }
    });
    await c.deletePayment({ params: { id: 'payment' } }, response());
    assert.equal(wallet.balance, 80);
  });
  await check('Payment edit succeeds without a wallet or transaction update', async () => {
    const c = controller('payment', {
      '../models/Payment': { findByIdAndUpdate: async (id, body) => body },
      '../models/Wallet': new Proxy({}, { get() { throw new Error('wallet accessed'); } }),
      '../models/Transaction': new Proxy({}, { get() { throw new Error('ledger accessed'); } })
    });
    const res = response();
    await c.updatePayment({ params: { id: 'payment' }, body: { amount: 999 } }, res);
    assert.equal(res.body.amount, 999);
  });
  await check('Direct Transaction creation succeeds without changing wallet', async () => {
    const c = controller('transaction', {
      '../models/Transaction': { create: async body => body },
      '../models/Wallet': new Proxy({}, { get() { throw new Error('wallet accessed'); } })
    });
    const res = response();
    await c.createTransaction({ body: { amount: 50, type: 'Income' } }, res);
    assert.equal(res.body.amount, 50);
  });
  await check('Wallet deletion succeeds without checking linked financial records', async () => {
    const c = controller('wallet', {
      '../models/Wallet': { findByIdAndDelete: async () => ({ balance: 100 }) }
    });
    const res = response();
    await c.deleteWallet({ params: { id: 'wallet' } }, res);
    assert.equal(res.body.message, 'Wallet removed');
  });
  await check('Dashboard counts advance salary in totalSalaries and filters only cash totals by branch', async () => {
    let salaryMatch, txMatch;
    const zero = { countDocuments: async () => 0 };
    const c = controller('dashboard', {
      '../models/Student': zero, '../models/User': zero, '../models/Class': zero,
      '../models/Guardian': zero, '../models/StudentAttendance': zero, '../models/TeacherAttendance': zero,
      '../models/Payment': { aggregate: async () => [] },
      '../models/Salary': { aggregate: async pipeline => { salaryMatch = pipeline[0].$match; return [{ total: 400 }]; } },
      '../models/Transaction': { aggregate: async pipeline => { txMatch = pipeline[0].$match; return []; }, find: () => chain([]) },
      '../models/Notification': { find: () => chain([]) },
      './cashbookController': { computeFeeTotals: async () => ({ collected: 0, expected: 0, pending: 0 }), computePreviousDebt: async () => 0 },
      '../services/cycleSnapshotService': { getHistoricalDebtKPI: async () => null }
    });
    const res = response();
    await c.getDashboardData({ user: { role: 'Super Admin', branchId: 'branch-a' }, query: { cycle: '2026-10' } }, res);
    const advance = { paymentDate: new Date('2026-10-26'), billingCycle: '2026-11' };
    const acceptsAdvance = salaryMatch.$or.some(clause => clause.paymentDate && advance.paymentDate >= clause.paymentDate.$gte && advance.paymentDate <= clause.paymentDate.$lte);
    assert.equal(acceptsAdvance, true);
    assert.equal(txMatch.branchId, 'branch-a');
    assert.equal(salaryMatch.branchId, undefined);
  });
  await check('Cycle validator accepts impossible month 99', async () => {
    const billing = require('../Backend/src/utils/billingCycle');
    assert.equal(billing.isValidCycleKey('2026-99'), true);
  });
  console.log(`Verified ${count} isolated reproductions. No database connected or application data changed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
