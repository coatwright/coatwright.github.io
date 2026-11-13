/*
 * Coatwright business numbers: job status, payments, real costs and yearly stats.
 * Pure functions (no DOM) so they can be tested in Node.
 */
(function (global) {
  'use strict';

  var Pricing = typeof module !== 'undefined' && module.exports ? require('./pricing.js') : global.Pricing;

  // The life of a job, in order. "lost" sits outside the main flow.
  var STATUSES = [
    { id: 'draft', label: 'Draft', icon: '📝' },
    { id: 'sent', label: 'Sent', icon: '📨' },
    { id: 'won', label: 'Won', icon: '🤝' },
    { id: 'scheduled', label: 'Scheduled', icon: '📅' },
    { id: 'completed', label: 'Completed', icon: '✅' },
    { id: 'paid', label: 'Paid', icon: '💰' },
    { id: 'lost', label: 'Lost', icon: '✖️' }
  ];
  var WON_STATUSES = ['won', 'scheduled', 'completed', 'paid'];

  var PAYMENT_METHODS = ['Cash', 'Check', 'Card', 'Zelle', 'Venmo', 'Bank transfer', 'Other'];
  var EXPENSE_CATEGORIES = ['Gas & vehicle', 'Equipment & tools', 'Insurance', 'Marketing', 'Phone & software',
    'Licenses & fees', 'Office', 'Other'];

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function has(v) { return v !== '' && v != null && isFinite(parseFloat(v)); }

  /** Local calendar date "YYYY-MM-DD" for a timestamp. */
  function isoDate(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function statusOf(job) { return job.status || 'draft'; }
  function isWon(job) { return WON_STATUSES.indexOf(statusOf(job)) !== -1; }
  function statusInfo(id) {
    return STATUSES.find(function (s) { return s.id === id; }) || STATUSES[0];
  }

  /** Change a job's status and remember when it happened. */
  function setStatus(job, status, now) {
    var ts = now || Date.now();
    job.status = status;
    job.statusDates = job.statusDates || {};
    if (!job.statusDates[status]) job.statusDates[status] = ts;
    // Moving forward fills in skipped steps (e.g. Draft → Paid means it was won and completed too)
    var order = ['sent', 'won', 'completed', 'paid'];
    var idx = order.indexOf(status === 'scheduled' ? 'won' : status);
    for (var i = 0; i < idx; i++) {
      if (!job.statusDates[order[i]]) job.statusDates[order[i]] = ts;
    }
    return job;
  }

  function paidAmount(job) {
    return round2((job.payments || []).reduce(function (a, p) { return a + num(p.amount); }, 0));
  }

  /** Money owed on a won job (never negative). */
  function balance(job, settings) {
    if (!isWon(job)) return 0;
    var total = Pricing.calcJob(job, settings).total;
    return round2(Math.max(0, total - paidAmount(job)));
  }

  /** The date a job counts toward: when it was completed/paid, else its last payment. */
  function doneDate(job) {
    var sd = job.statusDates || {};
    var ts = sd.completed || sd.paid;
    if (ts) return isoDate(ts);
    var dates = (job.payments || []).map(function (p) { return p.date; }).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }

  /**
   * Real numbers for one job. Uses what the painter logged; where nothing was
   * logged yet, falls back to the estimate and says so (`estimated: true`).
   */
  function jobResult(job, settings) {
    var q = Pricing.calcJob(job, settings);
    var a = job.actuals || {};
    var loggedMaterials = has(a.materials), loggedHours = has(a.hours);
    var materials = loggedMaterials ? num(a.materials) : q.internal.materialCost;
    var crew = num(a.crew), other = num(a.other);
    var costs = round2(materials + crew + other);
    var collected = paidAmount(job);
    var hours = loggedHours ? num(a.hours) : q.internal.hours;
    var made = round2(collected - costs);
    return {
      total: q.total,
      collected: collected,
      balance: isWon(job) ? round2(Math.max(0, q.total - collected)) : 0,
      materials: round2(materials), crew: round2(crew), other: round2(other),
      costs: costs,
      made: made,
      hours: round2(hours),
      estimatedHours: q.internal.hours,
      perHour: hours > 0 ? round2(made / hours) : 0,
      estimated: !loggedMaterials || !loggedHours
    };
  }

  function inYear(dateStr, year) { return !!dateStr && +dateStr.slice(0, 4) === +year; }
  function monthOf(dateStr) { return +dateStr.slice(5, 7) - 1; }

  /** Years that have any activity, newest first (always includes this year). */
  function yearsWithData(jobs, expenses, now) {
    var set = {};
    set[new Date(now || Date.now()).getFullYear()] = true;
    (jobs || []).forEach(function (j) {
      set[new Date(j.createdAt || Date.now()).getFullYear()] = true;
      (j.payments || []).forEach(function (p) { if (p.date) set[+p.date.slice(0, 4)] = true; });
    });
    (expenses || []).forEach(function (e) { if (e.date) set[+e.date.slice(0, 4)] = true; });
    return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
  }

  /**
   * The year at a glance. Money is counted when it's actually collected
   * (payment dates); job costs count in the month the job was done; business
   * expenses count on their own dates.
   */
  function yearStats(jobs, expenses, settings, year) {
    var months = [];
    for (var m = 0; m < 12; m++) months.push({ month: m, collected: 0, costs: 0, made: 0 });

    var collected = 0, jobCosts = 0, hours = 0, estHours = 0, loggedEst = 0, loggedActual = 0;
    var completed = [], won = 0, lost = 0, pipeline = 0, pipelineCount = 0, outstanding = 0;
    var upcoming = 0, byType = {}, estimatedJobs = 0;

    (jobs || []).forEach(function (job) {
      var st = statusOf(job);
      var r = jobResult(job, settings);

      (job.payments || []).forEach(function (p) {
        if (!inYear(p.date, year)) return;
        collected += num(p.amount);
        months[monthOf(p.date)].collected += num(p.amount);
        var key = job.jobType === 'commercial' ? 'Commercial' : 'Residential';
        byType[key] = (byType[key] || 0) + num(p.amount);
      });

      var done = doneDate(job);
      if ((st === 'completed' || st === 'paid') && inYear(done, year)) {
        completed.push(r);
        jobCosts += r.costs;
        months[monthOf(done)].costs += r.costs;
        hours += r.hours;
        estHours += r.estimatedHours;
        if (r.estimated) estimatedJobs++;
        var a = job.actuals || {};
        if (has(a.hours)) { loggedActual += num(a.hours); loggedEst += r.estimatedHours; }
      }

      // Win rate counts quotes created this year that got an answer
      if (new Date(job.createdAt || 0).getFullYear() === +year) {
        if (isWon(job)) won++;
        else if (st === 'lost') lost++;
      }
      if (st === 'sent') { pipeline += r.total; pipelineCount++; }
      if (st === 'scheduled' || st === 'won') upcoming++;
      if (st === 'completed' || st === 'scheduled' || st === 'won') outstanding += r.balance;
    });

    var overhead = 0, byCategory = {};
    (expenses || []).forEach(function (e) {
      if (!inYear(e.date, year)) return;
      overhead += num(e.amount);
      months[monthOf(e.date)].costs += num(e.amount);
      var c = e.category || 'Other';
      byCategory[c] = (byCategory[c] || 0) + num(e.amount);
    });

    months.forEach(function (mo) {
      mo.collected = round2(mo.collected);
      mo.costs = round2(mo.costs);
      mo.made = round2(mo.collected - mo.costs);
    });

    var made = round2(collected - jobCosts - overhead);
    var completedValue = completed.reduce(function (a, r) { return a + r.total; }, 0);
    return {
      year: +year,
      collected: round2(collected),
      jobCosts: round2(jobCosts),
      overhead: round2(overhead),
      made: made,
      margin: collected > 0 ? Math.round(made / collected * 100) : 0,
      jobsCompleted: completed.length,
      avgJob: completed.length ? round2(completedValue / completed.length) : 0,
      hours: round2(hours),
      perHour: hours > 0 ? round2(made / hours) : 0,
      winRate: won + lost > 0 ? Math.round(won / (won + lost) * 100) : null,
      won: won, lost: lost,
      pipeline: round2(pipeline), pipelineCount: pipelineCount,
      outstanding: round2(outstanding),
      upcoming: upcoming,
      // >0 means jobs took longer than estimated (as a %), <0 means faster
      hoursAccuracy: loggedEst > 0 ? Math.round((loggedActual - loggedEst) / loggedEst * 100) : null,
      estimatedJobs: estimatedJobs,
      byType: byType,
      byCategory: byCategory,
      months: months
    };
  }

  // ---------- Exports for the accountant ----------
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n';
  }

  function jobsCsv(jobs, settings) {
    var rows = [['Quote #', 'Customer', 'Address', 'Property', 'Status', 'Created', 'Completed',
      'Quoted total', 'Collected', 'Balance', 'Materials', 'Crew/helpers', 'Other costs', 'You made', 'Hours']];
    (jobs || []).forEach(function (j) {
      var r = jobResult(j, settings);
      rows.push([j.number, j.customer && j.customer.name, j.customer && j.customer.address,
        Pricing.propertyLabel(j), statusInfo(statusOf(j)).label, isoDate(j.createdAt || Date.now()),
        doneDate(j) || '', r.total, r.collected, r.balance, r.materials, r.crew, r.other, r.made, r.hours]);
    });
    return toCsv(rows);
  }

  function paymentsCsv(jobs) {
    var rows = [['Date', 'Quote #', 'Customer', 'Amount', 'Method', 'Note']];
    (jobs || []).forEach(function (j) {
      (j.payments || []).forEach(function (p) {
        rows.push([p.date, j.number, j.customer && j.customer.name, num(p.amount), p.method || '', p.note || '']);
      });
    });
    rows = [rows[0]].concat(rows.slice(1).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }));
    return toCsv(rows);
  }

  function expensesCsv(expenses) {
    var rows = [['Date', 'Description', 'Category', 'Amount']];
    (expenses || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .forEach(function (e) { rows.push([e.date, e.label, e.category, num(e.amount)]); });
    return toCsv(rows);
  }

  // ---------- Customers ----------
  /** Same person across jobs: phone digits, else email, else name. */
  function customerKey(c) {
    c = c || {};
    var digits = String(c.phone || '').replace(/\D/g, '');
    if (digits.length >= 7) return 'p' + digits.slice(-10);
    if (c.email && String(c.email).trim()) return 'e' + String(c.email).trim().toLowerCase();
    var name = String(c.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return name ? 'n' + name : '';
  }

  /** Everyone you've quoted, with their jobs and what they've paid you. */
  function customersFrom(jobs, settings) {
    var map = {};
    (jobs || []).forEach(function (j) {
      var key = customerKey(j.customer);
      if (!key) return;
      var c = map[key] || (map[key] = { key: key, name: '', phone: '', email: '', address: '', jobs: [],
        quoted: 0, collected: 0, won: 0, lastDate: 0 });
      // keep the most recent non-empty contact details
      var newer = (j.updatedAt || 0) >= c.lastDate;
      ['name', 'phone', 'email', 'address'].forEach(function (f) {
        var v = j.customer && j.customer[f];
        if (v && (newer || !c[f])) c[f] = v;
      });
      c.jobs.push(j);
      c.quoted += Pricing.calcJob(j, settings).total;
      c.collected += paidAmount(j);
      if (isWon(j)) c.won++;
      c.lastDate = Math.max(c.lastDate, j.updatedAt || j.createdAt || 0);
    });
    return Object.keys(map).map(function (k) {
      var c = map[k];
      c.quoted = round2(c.quoted);
      c.collected = round2(c.collected);
      c.jobs.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      return c;
    }).sort(function (a, b) { return b.lastDate - a.lastDate; });
  }

  // ---------- Schedule ----------
  /** Days on site for one painter: estimated (or logged) hours ÷ 8, rounded up. */
  function jobDays(job, settings) {
    var a = job.actuals || {};
    var h = has(a.hours) ? num(a.hours) : Pricing.calcJob(job, settings).internal.hours;
    return Math.max(1, Math.ceil(h / 8));
  }

  /** Won jobs on the calendar, plus won jobs still waiting for a start date. */
  function schedule(jobs, settings, todayIso) {
    var items = [], unscheduled = [];
    (jobs || []).forEach(function (j) {
      var st = statusOf(j);
      if (st !== 'won' && st !== 'scheduled' && st !== 'completed') return;
      if (!j.startDate) {
        if (st !== 'completed') unscheduled.push(j);
        return;
      }
      if (st === 'completed' && j.startDate < todayIso) return;
      var days = jobDays(j, settings);
      var end = new Date(j.startDate + 'T12:00:00');
      end.setDate(end.getDate() + days - 1);
      items.push({ job: j, start: j.startDate, end: isoDate(end.getTime()), days: days,
        late: st !== 'completed' && isoDate(end.getTime()) < todayIso });
    });
    items.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    return { items: items, unscheduled: unscheduled };
  }

  var api = {
    STATUSES: STATUSES,
    WON_STATUSES: WON_STATUSES,
    PAYMENT_METHODS: PAYMENT_METHODS,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    isoDate: isoDate,
    statusOf: statusOf,
    statusInfo: statusInfo,
    isWon: isWon,
    setStatus: setStatus,
    paidAmount: paidAmount,
    balance: balance,
    doneDate: doneDate,
    jobResult: jobResult,
    yearsWithData: yearsWithData,
    yearStats: yearStats,
    jobsCsv: jobsCsv,
    paymentsCsv: paymentsCsv,
    expensesCsv: expensesCsv,
    customerKey: customerKey,
    customersFrom: customersFrom,
    jobDays: jobDays,
    schedule: schedule
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Stats = api;
})(typeof window !== 'undefined' ? window : this);
