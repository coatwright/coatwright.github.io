// Run with: node --test app/tests/account.test.js
const test = require('node:test');
const assert = require('node:assert');
const A = require('../account.js');

test('email normalizing matches the database rule (one trial per person)', () => {
  assert.strictEqual(A.normalizeEmail(' Jo.Hn.Smith+trial@Gmail.com '), 'johnsmith@gmail.com');
  assert.strictEqual(A.normalizeEmail('JOHN@googlemail.com'), 'john@gmail.com');
  assert.strictEqual(A.normalizeEmail('john+x@outlook.com'), 'john@outlook.com');
  assert.strictEqual(A.normalizeEmail('j.ohn@outlook.com'), 'j.ohn@outlook.com', 'dots only ignored for Gmail');
});

test('email validation', () => {
  assert.ok(A.validEmail('painter@shop.com'));
  assert.ok(!A.validEmail('painter@shop'));
  assert.ok(!A.validEmail('no at sign'));
  assert.ok(!A.validEmail(''));
});

test('reads tokens returned after Google sign-in', () => {
  const s = A.parseAuthFragment('#access_token=abc.def&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup');
  assert.strictEqual(s.accessToken, 'abc.def');
  assert.strictEqual(s.refreshToken, 'r1');
  assert.ok(s.expiresAt > Date.now() + 3500 * 1000);
  assert.deepStrictEqual(A.parseAuthFragment('#error=access_denied&error_description=User+cancelled'), { error: 'User cancelled' });
  assert.strictEqual(A.parseAuthFragment('#/job/123'), null, 'normal app links are ignored');
  assert.strictEqual(A.parseAuthFragment(''), null);
});

test('session refresh timing', () => {
  const now = Date.now();
  assert.ok(A.needsRefresh(null, now));
  assert.ok(A.needsRefresh({ accessToken: 'x', expiresAt: now + 60000 }, now));
  assert.ok(!A.needsRefresh({ accessToken: 'x', expiresAt: now + 3600000 }, now));
});

test('token responses keep the user and expiry', () => {
  const s = A.sessionFrom({ access_token: 'a', refresh_token: 'r', expires_at: 2000000000, user: { id: 'u1', email: 'e@x.com', user_metadata: { full_name: 'Ann' } } }, 0);
  assert.strictEqual(s.expiresAt, 2000000000 * 1000);
  assert.deepStrictEqual(s.user, { id: 'u1', email: 'e@x.com', name: 'Ann' });
});
