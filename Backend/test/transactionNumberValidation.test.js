const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { isValidSomaliMobile, isValidTransactionNumber } = require('../src/utils/somaliPhone');

const invoke = (handler, { query = {}, body = {}, user = {} }) => new Promise((resolve, reject) => {
  const req = { query, body, user };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => reject(err || new Error('unexpected next() with no error')));
});

test('isValidTransactionNumber accepts any valid 9-digit or 10-digit numeric value (0-9)', () => {
  const validExamples = [
    '615319969',    // 9 digits
    '701234567',    // 9 digits
    '123456789',    // 9 digits
    '900000001',    // 9 digits
    '0615319969',   // 10 digits
    '0701234567',   // 10 digits
    '1234567890',   // 10 digits
    615319969,
    701234567
  ];

  for (const val of validExamples) {
    assert.strictEqual(
      isValidTransactionNumber(val),
      true,
      `Expected "${val}" to be valid 9 or 10 digit transaction number`
    );
    assert.strictEqual(
      isValidSomaliMobile(val),
      true,
      `Expected isValidSomaliMobile("${val}") to be true`
    );
  }
});

test('isValidTransactionNumber rejects invalid numbers (wrong length, letters, non-numeric)', () => {
  const invalidExamples = [
    '61531996',     // 8 digits
    '06153199690',  // 11 digits
    '61A319969',    // contains a letter
    '123-456789',   // contains non-numeric hyphen
    ' 61531996 ',   // 8 digits with whitespace
    'abcdefghi',    // 9 letters
    '',             // empty string
    null,           // null
    undefined       // undefined
  ];

  for (const val of invalidExamples) {
    assert.strictEqual(
      isValidTransactionNumber(val),
      false,
      `Expected "${val}" to be rejected as invalid transaction number`
    );
    assert.strictEqual(
      isValidSomaliMobile(val),
      false,
      `Expected isValidSomaliMobile("${val}") to be false`
    );
  }
});

let mongod;
let createEntry, CashbookCategory, Wallet;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  CashbookCategory = require('../src/models/CashbookCategory');
  Wallet = require('../src/models/Wallet');
  ({ createEntry } = require('../src/controllers/cashbookController'));
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('Cashbook createEntry accepts non-61/62 9-digit and 10-digit numbers', async () => {
  const wallet = await Wallet.create({ name: 'Validation Wallet', type: 'Mobile', balance: 0, status: 'Active' });
  const category = await CashbookCategory.create({ title: 'General Income', type: 'Income' });

  const payload = {
    categoryId: category._id,
    walletId: wallet._id,
    amount: 50,
    method: 'Mobile Money',
    senderName: 'Test Sender',
    senderPhone: '701234567', // 9 digits
    receiverName: 'Test Receiver',
    receiverPhone: '0900000001', // 10 digits
    date: new Date().toISOString().slice(0, 10)
  };

  const res = await invoke(createEntry, { body: payload, user: { _id: new mongoose.Types.ObjectId() } });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.senderPhone, '701234567');
  assert.strictEqual(res.body.receiverPhone, '0900000001');
});

test('Cashbook createEntry rejects numbers that are not 9 or 10 digits', async () => {
  const wallet = await Wallet.findOne({ name: 'Validation Wallet' });
  const category = await CashbookCategory.findOne({ title: 'General Income' });

  const payload8Digits = {
    categoryId: category._id,
    walletId: wallet._id,
    amount: 50,
    method: 'Mobile Money',
    senderName: 'Test Sender',
    senderPhone: '61531996', // 8 digits
    date: new Date().toISOString().slice(0, 10)
  };

  await assert.rejects(
    invoke(createEntry, { body: payload8Digits, user: { _id: new mongoose.Types.ObjectId() } }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /9 or 10 digits/i);
      return true;
    }
  );

  const payload11Digits = {
    categoryId: category._id,
    walletId: wallet._id,
    amount: 50,
    method: 'Mobile Money',
    senderName: 'Test Sender',
    senderPhone: '06153199690', // 11 digits
    date: new Date().toISOString().slice(0, 10)
  };

  await assert.rejects(
    invoke(createEntry, { body: payload11Digits, user: { _id: new mongoose.Types.ObjectId() } }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /9 or 10 digits/i);
      return true;
    }
  );
});
