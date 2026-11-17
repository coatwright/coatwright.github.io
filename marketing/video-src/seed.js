// Builds demo localStorage for the video: settings, jobs, expenses.
const P = require('/home/user/coatwright.github.io/app/pricing.js');
const S = require('/home/user/coatwright.github.io/app/stats.js');
const fs = require('fs');
let n = 1001; const rid = () => Math.random().toString(36).slice(2, 10);
const T = name => P.ROOM_TYPES.find(t => t.name === name) || P.ROOM_TYPES[0];
const ts = d => new Date(d + 'T12:00:00').getTime();
const settings = {
  businessName: 'Rivera Painting Co.', ownerName: 'Luis Rivera', phone: '(555) 410-2290', email: 'luis@riverapainting.com',
  currency: 'USD', onboarded: true, laborRate: 55, markup: 25, minimumJob: 450, depositPct: 30,
  paymentInstructions: 'Zelle (555) 410-2290 or checks to Rivera Painting Co.', paintStoreName: 'Main St Paint & Supply', paintStoreEmail: 'orders@mainstpaint.com',
  account: { id: '11111111-1111-1111-1111-111111111111', email: 'luis@riverapainting.com', name: 'Luis Rivera' }, trialStart: Date.now()
};
function job(cust, rooms, status, dates, payments, extra) {
  const j = Object.assign({ id: rid(), number: 'Q-' + (n++), jobType: 'residential', propertyType: 'house', createdAt: ts(dates.created), updatedAt: ts(dates.created),
    customer: { name: cust[0], address: cust[1], phone: cust[2], email: cust[3] }, rooms: rooms.map(r => { const x = P.newRoom(T(r[0])); if (r[1]) Object.assign(x, r[1]); return x; }),
    quick: P.newQuick(), outside: [], extras: [], discount: 0, notes: '', status: 'draft', statusDates: {}, payments: [], actuals: {}, paintByOrder: true, paintPrices: {} }, extra || {});
  if (status !== 'draft') S.setStatus(j, status, ts(dates.status || dates.created));
  if (dates.start) j.startDate = dates.start;
  const total = P.calcJob(j, settings).total;
  j.payments = payments.map(p => ({ id: rid(), date: p[0], amount: p[1] === 'rest' ? null : (p[1] < 1 ? Math.round(total * p[1]) : p[1]), method: p[2] || 'Zelle' }));
  const paid = j.payments.reduce((a, p) => a + (p.amount || 0), 0);
  j.payments.forEach(p => { if (p.amount === null) p.amount = Math.round((total - paid) * 100) / 100; });
  return j;
}
const jobs = [
  job(['Maria Gomez', '100 Oak St', '(555) 201-3344', 'maria@example.com'], [['Living Room'], ['Kitchen'], ['Bedroom']], 'sent', { created: '2026-11-05' }, []),
  job(['James Carter', '107 Oak St', '(555) 301-2211', 'james@example.com'], [['Living Room'], ['Bedroom'], ['Bedroom'], ['Bathroom']], 'sent', { created: '2026-11-06' }, [], { propertyType: 'townhouse' }),
  job(['Priya Patel', '114 Oak St', '(555) 777-1029', 'priya@example.com'], [['Living Room'], ['Kitchen']], 'scheduled', { created: '2026-10-07', status: '2026-10-09', start: '2026-11-19' }, [['2026-10-09', 0.3]], { propertyType: 'condo' }),
  job(['Tom Nguyen', '121 Oak St', '(555) 812-4400', 'tom@example.com'], [['Bedroom'], ['Bedroom']], 'paid', { created: '2026-09-08', status: '2026-09-20' }, [['2026-09-10', 0.3], ['2026-09-20', 'rest']], { actuals: { hours: 14, materials: 210 } }),
  job(['Sarah Kim', '5 Elm Ave', '(555) 640-1100', 'sarah@example.com'], [['Living Room'], ['Dining Room'], ['Kitchen'], ['Bedroom'], ['Bedroom']], 'paid', { created: '2026-08-02', status: '2026-08-25' }, [['2026-08-05', 0.3], ['2026-08-25', 'rest']], { actuals: { hours: 42, materials: 690, crew: 600 } }),
  job(['Dan Brooks', '22 Pine Rd', '(555) 380-7781', 'dan@example.com'], [['Living Room'], ['Kitchen'], ['Bedroom']], 'paid', { created: '2026-07-03', status: '2026-07-21' }, [['2026-07-06', 0.3], ['2026-07-21', 'rest']], { actuals: { hours: 26, materials: 420 } }),
  job(['Ana Lopez', '9 Birch Ln', '(555) 233-9087', 'ana@example.com'], [['Bedroom'], ['Bathroom']], 'paid', { created: '2026-06-10', status: '2026-06-18' }, [['2026-06-18', 'rest']], { actuals: { hours: 12, materials: 160 } }),
  job(['Mike Ross', '48 Cedar Ct', '(555) 991-2345', 'mike@example.com'], [['Living Room'], ['Bedroom'], ['Bedroom'], ['Kitchen']], 'paid', { created: '2026-05-04', status: '2026-05-28' }, [['2026-05-06', 0.3], ['2026-05-28', 'rest']], { actuals: { hours: 33, materials: 540 } }),
  job(['Grace Liu', '3 Maple Dr', '(555) 455-6620', 'grace@example.com'], [['Living Room'], ['Kitchen'], ['Dining Room'], ['Bedroom'], ['Bedroom'], ['Bathroom']], 'paid', { created: '2026-04-02', status: '2026-04-30' }, [['2026-04-04', 0.3], ['2026-04-30', 'rest']], { actuals: { hours: 52, materials: 860, crew: 900 } }),
  job(['Ben Wright', '77 Ash St', '(555) 118-0042', 'ben@example.com'], [['Bedroom'], ['Bedroom'], ['Bathroom']], 'completed', { created: '2026-10-12', status: '2026-10-30' }, [['2026-10-14', 0.3]], { actuals: { hours: 20, materials: 300 } }),
  job(['Olivia Hart', '15 Spruce Way', '(555) 702-3388', 'olivia@example.com'], [['Living Room'], ['Kitchen']], 'paid', { created: '2026-03-03', status: '2026-03-19' }, [['2026-03-19', 'rest']], { actuals: { hours: 16, materials: 250 } }),
  job(['Chris Evans', '61 Willow Pl', '(555) 330-1199', 'chris@example.com'], [['Living Room'], ['Bedroom']], 'lost', { created: '2026-09-15', status: '2026-09-25' }, []),
  job(['Nina Shah', '8 Poplar St', '(555) 560-7712', 'nina@example.com'], [['Kitchen'], ['Bathroom']], 'paid', { created: '2026-02-10', status: '2026-02-24' }, [['2026-02-24', 'rest']], { actuals: { hours: 13, materials: 190 } })
];
// The job built live in the video: customer filled in, no rooms yet
const demo = job(['Jennifer Moore', '42 Lakeview Dr', '(555) 248-1170', 'jennifer@example.com'], [], 'draft', { created: '2026-11-17' }, []);
demo.id = 'demojob'; demo.number = 'Q-1040';
jobs.unshift(demo);
settings.nextNumber = 1041;
const expenses = [['2026-03-02', 'Ladders & tools', 'Tools', 420], ['2026-05-15', 'Truck insurance', 'Vehicle', 960], ['2026-08-01', 'Sprayer service', 'Tools', 180], ['2026-10-03', 'Gas', 'Vehicle', 820]]
  .map(e => ({ id: rid(), date: e[0], label: e[1], category: e[2], amount: e[3] }));
fs.writeFileSync(process.argv[2], JSON.stringify({ 'pq.settings': settings, 'pq.jobs': jobs, 'pq.expenses': expenses }));
const ys = S.yearStats(jobs, expenses, settings, 2026);
console.log('jobs', jobs.length, 'collected', ys.collected, 'made', ys.made);
