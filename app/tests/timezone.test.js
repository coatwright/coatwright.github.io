// Run with: node --test app/tests/timezone.test.js
// Re-runs the date logic in a fresh Node process for each time zone (TZ is read at process start).
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ZONES = [
  'Pacific/Pago_Pago',   // UTC-11
  'Pacific/Honolulu',    // UTC-10, no DST
  'America/Los_Angeles', // DST (North America)
  'America/New_York',
  'America/Sao_Paulo',   // UTC-3
  'UTC',
  'Europe/London',       // DST (Europe)
  'Europe/Berlin',
  'Asia/Kolkata',        // UTC+5:30 (half-hour offset)
  'Asia/Tokyo',
  'Australia/Sydney',    // DST (southern hemisphere)
  'Pacific/Auckland',    // DST (southern hemisphere), UTC+12/13
  'Pacific/Kiritimati'   // UTC+14
];

// Runs inside each child process. Prints a JSON list of failures (empty = all good).
const CHECK = `
const P = require(${JSON.stringify(path.join(__dirname, '..', 'pricing.js'))});
const S = require(${JSON.stringify(path.join(__dirname, '..', 'stats.js'))});
const B = require(${JSON.stringify(path.join(__dirname, '..', 'billing.js'))});
const fails = [];
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(name + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); };
const DAY = 864e5;

// 1. Local calendar dates: just before and after local midnight
eq('11:59pm stays on its day', S.isoDate(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12-31');
eq('12:01am is the next day', S.isoDate(new Date(2027, 0, 1, 0, 1).getTime()), '2027-01-01');
eq('today matches the local calendar', S.isoDate(Date.now()), (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })());

// 2. Schedule: a 3-day job keeps 3 calendar days across every DST change
const settings = Object.assign({}, P.DEFAULT_SETTINGS);
for (const start of ['2026-03-07', '2026-03-28', '2026-04-04', '2026-09-26', '2026-10-24', '2026-10-31', '2026-12-30']) {
  const job = { id: start, status: 'scheduled', startDate: start, rooms: [], actuals: { hours: 20 } };
  const item = S.schedule([job], settings, '2026-01-01').items[0];
  const d = new Date(start + 'T12:00:00'); d.setDate(d.getDate() + 2);
  const want = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  eq('3-day job starting ' + start + ' ends', item.end, want);
  eq('3-day job starting ' + start + ' length', item.days, 3);
}

// 3. Yearly stats: payments land in the month and year written on them
const mk = (date, amount) => ({ id: date, status: 'paid', createdAt: new Date(date + 'T12:00:00').getTime(), rooms: [], payments: [{ date, amount }],
  statusDates: { paid: new Date(date + 'T12:00:00').getTime() } });
const jobs = [mk('2026-12-31', 100), mk('2027-01-01', 50), mk('2026-03-08', 10), mk('2026-11-01', 7)];
const y26 = S.yearStats(jobs, [], settings, 2026), y27 = S.yearStats(jobs, [], settings, 2027);
eq('Dec 31 payment in 2026', y26.months[11].collected, 100);
eq('Jan 1 payment in 2027', y27.months[0].collected, 50);
eq('DST-day payment in March', y26.months[2].collected, 10);
eq('Nov 1 payment in November', y26.months[10].collected, 7);
eq('2026 total', y26.collected, 117);
eq('years with data', S.yearsWithData(jobs, [], new Date(2026, 5, 1).getTime()), [2027, 2026]);

// 4. Trial: counts down one calendar day at a time, even across DST, and ends after 14 days
const cfg = Object.assign({}, B.BILLING, { enabled: true, startDate: '', trialDays: 14 });
for (const [y, m, d] of [[2026, 2, 1], [2026, 2, 25], [2026, 3, 1], [2026, 8, 20], [2026, 9, 20]]) {
  const start = new Date(y, m, d, 9, 30).getTime();
  for (let k = 0; k <= 13; k++) {
    const at = new Date(y, m, d + k, 18, 0).getTime();
    eq('trial ' + y + '-' + (m + 1) + '-' + d + ' day ' + k, B.accessState({ trialStart: start }, at, cfg).daysLeft, Math.max(1, 14 - k));
  }
  eq('trial ' + y + '-' + (m + 1) + '-' + d + ' last morning', B.accessState({ trialStart: start }, new Date(y, m, d + 14, 9, 0).getTime(), cfg).mode, 'trial');
  eq('trial ' + y + '-' + (m + 1) + '-' + d + ' over', B.accessState({ trialStart: start }, new Date(y, m, d + 14, 10, 0).getTime(), cfg).mode, 'expired');
}
// Billing start date (local midnight) gives everyone a full trial
const s2 = B.accessState({ trialStart: 1 }, new Date(2026, 11, 5, 12).getTime(), Object.assign({}, cfg, { startDate: '2026-12-01' }));
eq('billing start date trial', [s2.mode, s2.daysLeft], ['trial', 10]);

// 5. Exports use local calendar dates
const csv = S.paymentsCsv([{ number: 'Q-1', customer: { name: 'A' }, payments: [{ date: '2026-12-31', amount: 5 }] }]);
eq('CSV keeps the payment date', csv.split('\\n')[1].slice(0, 10), '2026-12-31');

process.stdout.write(JSON.stringify(fails));
`;

for (const tz of ZONES) {
  test('dates work in ' + tz, () => {
    const out = execFileSync(process.execPath, ['-e', CHECK], { env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8' });
    const fails = JSON.parse(out);
    assert.deepStrictEqual(fails, [], tz + ':\n' + fails.join('\n'));
  });
}
