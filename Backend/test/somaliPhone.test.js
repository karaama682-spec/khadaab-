const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalPhone, phoneVariants, digitsOnly } = require('../src/utils/somaliPhone');

// Real formats an operator may type for the same subscriber.
const SAME_NUMBER = [
  '0614047121',
  '  0614047121  ',
  '614047121',
  '+252614047121',
  '252614047121',
  '0614 047 121',
  '+252 614 047 121',
];

test('every spelling of one number reduces to the same canonical form', () => {
  const canonical = SAME_NUMBER.map(canonicalPhone);
  assert.deepStrictEqual(new Set(canonical), new Set(['614047121']));
});

test('variants of any spelling match the number as stored with a leading zero', () => {
  for (const input of SAME_NUMBER) {
    assert.ok(
      phoneVariants(input).includes('0614047121'),
      `"${input}" should match the stored 0614047121`
    );
  }
});

test('variants also match the number stored without a leading zero', () => {
  for (const input of SAME_NUMBER) {
    assert.ok(phoneVariants(input).includes('614047121'), `"${input}" should match 614047121`);
  }
});

// Business rule: these are two different people, confirmed by the institute.
// A rule that assumed a fixed length would fold them together and merge two
// families onto one payer, so it is asserted rather than left to chance.
test('keeps Mustaf (11 digits) and Cumar (10 digits) apart', () => {
  const mustaf = '06140447121';
  const cumar = '0614047121';

  assert.notStrictEqual(canonicalPhone(mustaf), canonicalPhone(cumar));

  const overlap = phoneVariants(mustaf).filter((v) => phoneVariants(cumar).includes(v));
  assert.deepStrictEqual(overlap, [], 'their variant sets must not intersect');
});

test('leaves a number that merely starts with 252 alone when it is too short to be country-coded', () => {
  assert.strictEqual(canonicalPhone('252614047'), '252614047');
});

test('returns nothing for empty or non-numeric input', () => {
  assert.deepStrictEqual(phoneVariants(''), []);
  assert.deepStrictEqual(phoneVariants(null), []);
  assert.deepStrictEqual(phoneVariants('abc'), []);
  assert.strictEqual(canonicalPhone(undefined), '');
});

// Guards the two shapes the previous implementation already handled, so the
// cashbook lookups that depend on it keep working.
test('still covers the cases the previous implementation handled', () => {
  assert.ok(phoneVariants('615298216').includes('0615298216'));
  assert.ok(phoneVariants('0615298216').includes('615298216'));
});

// createGuardian and updateGuardian both persist digitsOnly(phone). A record is
// only useful if it can be found again, so what gets written must always appear
// in the variants of what was typed. Storing the raw text broke this: a saved
// "0614 047 121" was invisible to a later lookup for "0614047121", which
// silently disabled duplicate protection.
test('what is stored is always found by the variants of what was typed', () => {
  const typed = [
    '0614047121',
    '614047121',
    '+252614047121',
    '252614047121',
    '0614 047 121',
    '+252 614 047 121',
    '06140447121',
    '0615-298-216',
  ];

  for (const input of typed) {
    const stored = digitsOnly(input);
    assert.ok(
      phoneVariants(input).includes(stored),
      `storing "${input}" as "${stored}" must be found by its own variants`
    );
  }
});

test('a stored value is found again by any other spelling of the same number', () => {
  const stored = digitsOnly('+252 614 047 121'); // "252614047121"

  for (const laterLookup of ['0614047121', '614047121', '+252614047121']) {
    assert.ok(
      phoneVariants(laterLookup).includes('614047121'),
      `"${laterLookup}" should reach the canonical form of ${stored}`
    );
  }
});
