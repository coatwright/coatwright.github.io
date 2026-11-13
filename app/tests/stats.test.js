// Run with: node --test app/tests/stats.test.js
const test = require('node:test');
const assert = require('node:assert');
const P = require('../pricing.js');
const S = require('../stats.js');

const settings = Object.assign({}, P.DEFAULT_SETTINGS, { minimumJob: 0 });

function job(extra) {
  return Object.assign({
    id: Math.random().toString(36), number: 'Q-1', createdAt: new Date('2026-03-01T12:00:00').getTime(),
    jobType: 'residential', propertyType: 'house', customer: { name: 'Test' },
    rooms: [P.newRoom(P.ROOM_TYPES[0])], extras: [], payments: []
  }, extra);
}

test('moving a quote forward records dates and fills skipped steps', () => {
  const j = job();
  S.setStatus(j, 'paid', 1000);
  assert.strictEqual(j.status, 'paid');
  ['sent', 'won', 'completed', 'paid'].forEach(k => assert.strictEqual(j.statusDates[k], 1000));
  S.setStatus(j, 'completed', 2000);
  assert.strictEqual(j.statusDates.completed, 1000, 'keeps the first date');
});

test('payments, balance and what you actually made on a job', () => {
  const j = job({ status: 'completed', statusDates: { completed: new Date('2026-04-10T12:00:00').getTime() } });
  const total = P.calcJob(j, settings).total;
  j.payments = [{ date: '2026-04-01', amount: 200 }, { date: '2026-04-10', amount: 100 }];
  j.actuals = { hours: 10, materials: 80, crew: 50, other: 20 };
  const r = S.jobResult(j, settings);
  assert.strictEqual(r.collected, 300);
  assert.strictEqual(r.balance, Math.round((total - 300) * 100) / 100);
  assert.strictEqual(r.costs, 150);
  assert.strictEqual(r.made, 150);
  assert.strictEqual(r.perHour, 15);
  assert.strictEqual(r.estimated, false);
});

test('jobs without logged costs fall back to the estimate and say so', () => {
  const j = job({ status: 'paid', payments: [{ date: '2026-05-01', amount: 500 }] });
  const r = S.jobResult(j, settings);
  assert.strictEqual(r.estimated, true);
  assert.strictEqual(r.materials, P.calcJob(j, settings).internal.materialCost);
});

test('yearly stats: collected, costs, overhead, made, win rate, owed, monthly', () => {
  const done = new Date('2026-06-15T12:00:00').getTime();
  const jobs = [
    job({ status: 'paid', statusDates: { paid: done }, payments: [{ date: '2026-06-15', amount: 1000 }],
      actuals: { hours: 20, materials: 200, crew: 100 } }),
    job({ status: 'completed', statusDates: { completed: done }, payments: [{ date: '2026-06-01', amount: 100 }],
      actuals: { hours: 5, materials: 50 } }),
    job({ status: 'lost' }),
    job({ status: 'sent' }),
    job({ status: 'paid', payments: [{ date: '2025-12-20', amount: 999 }], createdAt: new Date('2025-12-01').getTime(),
      statusDates: { paid: new Date('2025-12-20T12:00:00').getTime() } })
  ];
  const expenses = [{ date: '2026-02-01', amount: 150, category: 'Insurance' }, { date: '2025-01-01', amount: 999 }];
  const y = S.yearStats(jobs, expenses, settings, 2026);
  assert.strictEqual(y.collected, 1100);
  assert.strictEqual(y.jobCosts, 350);
  assert.strictEqual(y.overhead, 150);
  assert.strictEqual(y.made, 600);
  assert.strictEqual(y.jobsCompleted, 2);
  assert.strictEqual(y.hours, 25);
  assert.strictEqual(y.perHour, 24);
  // 2 won (paid + completed), 1 lost; the sent one is still waiting
  assert.strictEqual(y.winRate, 67);
  assert.strictEqual(y.pipelineCount, 1);
  assert.ok(y.pipeline > 0);
  assert.ok(y.outstanding > 0, 'completed job still owes money');
  assert.strictEqual(y.months[5].collected, 1100);
  assert.strictEqual(y.months[1].costs, 150);
  assert.strictEqual(y.byCategory.Insurance, 150);
  // Last year's money stays in last year
  assert.strictEqual(S.yearStats(jobs, expenses, settings, 2025).collected, 999);
  assert.deepStrictEqual(S.yearsWithData(jobs, expenses, new Date('2026-07-01').getTime()), [2026, 2025]);
});

test('estimate accuracy compares logged hours to estimated hours', () => {
  const j = job({ status: 'paid', statusDates: { paid: new Date('2026-06-15T12:00:00').getTime() } });
  const est = P.calcJob(j, settings).internal.hours;
  j.actuals = { hours: est * 1.2, materials: 10 };
  assert.strictEqual(S.yearStats([j], [], settings, 2026).hoursAccuracy, 20);
});

test('empty data is safe', () => {
  const y = S.yearStats([], [], settings, 2026);
  assert.strictEqual(y.made, 0);
  assert.strictEqual(y.winRate, null);
  assert.strictEqual(y.months.length, 12);
});

test('CSV exports escape commas and quotes', () => {
  const j = job({ customer: { name: 'Smith, "Bob"', address: '1 Main' }, payments: [{ date: '2026-01-02', amount: 5, method: 'Cash' }] });
  const csv = S.jobsCsv([j], settings);
  assert.ok(csv.includes('"Smith, ""Bob"""'));
  assert.ok(S.paymentsCsv([j]).includes('2026-01-02,Q-1,"Smith, ""Bob""",5,Cash'));
  assert.ok(S.expensesCsv([{ date: '2026-01-01', label: 'Gas', category: 'Gas & vehicle', amount: 40 }]).includes('Gas & vehicle'));
});

test('customers: same person across jobs is grouped by phone, email or name', () => {
  const a = job({ customer: { name: 'Ann Lee', phone: '(555) 123-4567' }, updatedAt: 1, status: 'paid', payments: [{ date: '2026-01-01', amount: 100 }] });
  const b = job({ customer: { name: 'Ann Lee-Smith', phone: '555.123.4567', address: '5 Oak' }, updatedAt: 2, status: 'sent' });
  const c = job({ customer: { name: 'Bob', email: 'BOB@x.com' }, updatedAt: 3 });
  const d = job({ customer: { name: 'bob', email: 'bob@x.com ' }, updatedAt: 0 });
  const e = job({ customer: { name: '' } });
  const list = S.customersFrom([a, b, c, d, e], settings);
  assert.strictEqual(list.length, 2, 'empty customer is skipped');
  assert.strictEqual(list[0].name, 'Bob');
  assert.strictEqual(list[0].jobs.length, 2);
  const ann = list[1];
  assert.strictEqual(ann.jobs.length, 2);
  assert.strictEqual(ann.name, 'Ann Lee-Smith', 'latest name wins');
  assert.strictEqual(ann.address, '5 Oak');
  assert.strictEqual(ann.collected, 100);
  assert.strictEqual(ann.won, 1);
  assert.strictEqual(S.customerKey({ name: '  Jane   DOE ' }), 'njane doe');
});

test('schedule: start/end dates from job length, late and unscheduled jobs', () => {
  const j1 = job({ status: 'scheduled', startDate: '2026-06-10', actuals: { hours: 20 } }); // 3 days
  const j2 = job({ status: 'won' }); // no date yet
  const j3 = job({ status: 'scheduled', startDate: '2026-06-01', actuals: { hours: 4 } }); // ended in the past
  const j4 = job({ status: 'sent', startDate: '2026-06-05' }); // not won: not on the calendar
  const sch = S.schedule([j1, j2, j3, j4], settings, '2026-06-08');
  assert.strictEqual(sch.items.length, 2);
  assert.strictEqual(sch.items[0].job, j3);
  assert.strictEqual(sch.items[0].late, true);
  assert.strictEqual(sch.items[1].end, '2026-06-12');
  assert.strictEqual(sch.items[1].days, 3);
  assert.deepStrictEqual(sch.unscheduled, [j2]);
});
