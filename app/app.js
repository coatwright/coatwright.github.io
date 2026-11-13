/* Coatwright UI — plain JavaScript, no build step. */
(function () {
  'use strict';

  var P = window.Pricing;
  var S = window.Stats;
  var app = document.getElementById('app');

  // ---------- Storage ----------
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Could not save — storage is full or blocked'); return false; }
  }

  var settings = Object.assign({}, P.DEFAULT_SETTINGS, load('pq.settings', {}));
  var jobs = load('pq.jobs', []);
  var expenses = load('pq.expenses', []);
  if (!settings.onboarded && (jobs.length || settings.businessName)) { settings.onboarded = true; save('pq.settings', settings); }
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; });
  var homeFilter = 'all', homeSearch = '', customerSearch = '', pendingCustomer = null;

  function saveSettings() { save('pq.settings', settings); }
  function saveJobs() { save('pq.jobs', jobs); }
  function saveExpenses() { save('pq.expenses', expenses); }
  function today() { return S.isoDate(Date.now()); }
  function findJob(id) { return jobs.find(function (j) { return j.id === id; }); }

  // ---------- Helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var v = Number(n) || 0;
    return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function money0(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US');
  }
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // Read/write nested values like "rooms.0.length"
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) { return o[k]; }, obj);
    target[last] = value;
  }

  function newJob(jobType, propertyType) {
    var job = {
      id: uid(),
      number: 'Q-' + settings.nextNumber,
      jobType: jobType,
      propertyType: propertyType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      customer: pendingCustomer || { name: '', phone: '', email: '', address: '' },
      rooms: [],
      quick: P.newQuick((P.findProperty(jobType, propertyType) || {}).height),
      extras: [],
      discount: 0,
      notes: '',
      status: 'draft',
      statusDates: {},
      payments: [],
      actuals: {}
    };
    pendingCustomer = null;
    settings.nextNumber = (Number(settings.nextNumber) || 1000) + 1;
    saveSettings();
    jobs.unshift(job);
    saveJobs();
    return job;
  }

  // ---------- Router ----------
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var view = parts[0] || 'home';
    var id = parts[1];
    var job = id ? findJob(id) : null;
    document.body.dataset.view = view;
    if ((view === 'job' || view === 'quote' || view === 'invoice') && !job) { location.hash = '#/'; return; }
    if (view === 'job') renderJob(job);
    else if (view === 'quote') renderQuote(job);
    else if (view === 'invoice') renderInvoice(job);
    else if (view === 'schedule') renderSchedule();
    else if (view === 'customers') renderCustomers();
    else if (view === 'customer') renderCustomer(decodeURIComponent(id || ''));
    else if (view === 'new') renderNewJob(P.JOB_TYPES[id] ? id : null);
    else if (view === 'settings') renderSettings();
    else if (view === 'stats') renderStats(+id || new Date().getFullYear());
    else if (view === 'welcome' && !id && settings.onboarded) { location.hash = '#/'; return; }
    else if (view === 'welcome') renderWelcome(+id || 0);
    else if (!settings.onboarded) { location.hash = '#/welcome'; return; }
    else renderHome();
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });

  // ---------- First-run onboarding ----------
  var RATE_PRESETS = [
    { id: 'new', icon: '🌱', label: 'Just starting out', desc: 'Competitive prices to win your first jobs', laborRate: 45, markup: 20, minimumJob: 350 },
    { id: 'pro', icon: '🖌️', label: 'Established painter', desc: 'Solid rates for steady, quality work', laborRate: 55, markup: 25, minimumJob: 450 },
    { id: 'premium', icon: '⭐', label: 'Premium / high-end', desc: 'Top-quality work and service', laborRate: 70, markup: 30, minimumJob: 750 }
  ];

  function welcomeSteps(step) {
    return '<div class="wz-dots" aria-label="Step ' + step + ' of 3">' + [1, 2, 3].map(function (n) {
      return '<span class="' + (n <= step ? 'on' : '') + '"></span>';
    }).join('') + '</div>';
  }

  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function isInstalled() { return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }

  function renderWelcome(step) {
    var body;
    if (step === 0) {
      body = '<div class="wz-hero"><img src="icon.svg" alt="" width="84" height="84"><h1>Welcome to Coatwright</h1>' +
        '<p class="muted">Professional paint quotes in minutes, and a clear picture of what you really make.</p></div>' +
        '<ul class="wz-list"><li><b>⚡ Quote any job fast</b><span>Interior, exterior, cabinets, floors and commercial</span></li>' +
        '<li><b>📄 Look professional</b><span>Itemized quotes and invoices with your logo</span></li>' +
        '<li><b>📊 Know your numbers</b><span>Real profit, hourly rate and money owed</span></li></ul>' +
        '<a class="btn btn-primary btn-xl" href="#/welcome/1">Set up my business</a>' +
        '<p class="center-text muted small">Takes about 2 minutes · <button class="link" data-action="wz-skip">Skip for now</button></p>';
    } else if (step === 1) {
      body = welcomeSteps(1) + '<h1 class="ask">Your business</h1><p class="muted">This goes on every quote and invoice.</p>' +
        '<section class="card">' +
        '<div class="logo-row">' + (settings.logo ? '<img src="' + esc(settings.logo) + '" alt="Logo" class="logo">' : '<div class="logo placeholder">Logo</div>') +
        '<label class="btn btn-ghost">' + (settings.logo ? 'Change logo' : 'Add your logo') + '<input type="file" accept="image/*" id="logo-input" hidden></label></div>' +
        setField('businessName', 'Business name', { placeholder: 'Smith Painting LLC' }) +
        setField('ownerName', 'Your name', { placeholder: 'John Smith' }) +
        '<div class="row2">' + setField('phone', 'Phone', { type: 'tel', placeholder: '(555) 555-5555' }) +
        setField('email', 'Email', { type: 'email', placeholder: 'you@email.com' }) + '</div></section>' +
        '<div class="wz-nav"><a class="btn" href="#/welcome/0">Back</a><button class="btn btn-primary" data-action="wz-next" data-v="2">Continue</button></div>';
    } else if (step === 2) {
      var active = RATE_PRESETS.find(function (p) { return p.laborRate === Number(settings.laborRate) && p.markup === Number(settings.markup); });
      body = welcomeSteps(2) + '<h1 class="ask">Your prices</h1><p class="muted">Pick a starting point. Every number can be changed later in Settings.</p>' +
        '<div class="pick-list">' + RATE_PRESETS.map(function (p) {
          return '<button type="button" class="pick' + (active === p ? ' picked' : '') + '" data-action="preset" data-v="' + p.id + '">' +
            '<span class="pick-icon">' + p.icon + '</span><span><strong>' + p.label + '</strong><span class="muted small">' + p.desc +
            ' · $' + p.laborRate + '/hr, ' + p.markup + '% markup</span></span>' + (active === p ? '<span class="chev">✓</span>' : '') + '</button>';
        }).join('') + '</div>' +
        '<section class="card" style="margin-top:14px"><div class="row2">' +
        setField('laborRate', 'Labor rate', { type: 'number', pre: '$', unit: '/hr' }) + setField('markup', 'Markup', { type: 'number', unit: '%' }) + '</div>' +
        '<div class="row2">' + setField('minimumJob', 'Minimum job', { type: 'number', pre: '$' }) + setField('depositPct', 'Deposit', { type: 'number', unit: '%' }) + '</div>' +
        '<p class="muted small" style="margin:0">Paint prices, tax and how fast you work are in Settings too.</p></section>' +
        '<div class="wz-nav"><a class="btn" href="#/welcome/1">Back</a><button class="btn btn-primary" data-action="wz-next" data-v="3">Continue</button></div>';
    } else {
      var install = isInstalled() ? '' : installPrompt
        ? '<button class="btn full" data-action="install">📲 Install Coatwright on this phone</button>'
        : isIOS() ? '<p class="wz-tip">📲 <b>Tip:</b> tap the Share button, then <b>Add to Home Screen</b>, to open Coatwright like an app.</p>'
          : '<p class="wz-tip">📲 <b>Tip:</b> use your browser menu → <b>Install app</b> or <b>Add to Home screen</b> to open Coatwright like an app.</p>';
      body = welcomeSteps(3) + '<div class="wz-hero"><div class="wz-check">✓</div><h1>You\'re all set' + (settings.ownerName ? ', ' + esc(settings.ownerName.split(' ')[0]) : '') + '!</h1>' +
        '<p class="muted">Your business details and prices are saved on this phone.</p></div>' +
        '<button class="btn btn-primary btn-xl" data-action="wz-finish" data-v="quote">＋ Create my first quote</button>' +
        '<button class="btn full" data-action="wz-finish" data-v="sample">👀 Explore with a sample quote</button>' + install +
        '<p class="center-text muted small">Your data stays private on this device. <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a></p>';
    }
    app.innerHTML = '<div class="welcome">' + body + '</div>';
    var input = document.getElementById('logo-input');
    if (input) input.addEventListener('change', onLogo);
  }

  function createSampleJob() {
    pendingCustomer = { name: 'Sample Customer', phone: '', email: '', address: '123 Example St' };
    var job = newJob('residential', 'house');
    job.sample = true;
    [1, 0, 2].forEach(function (k) { job.rooms.push(P.newRoom(P.ROOM_TYPES[k])); });
    job.rooms[0].surfaces.ceiling = true;
    job.notes = 'This is a sample quote. Edit anything, or delete it from the bottom of the job screen.';
    saveJobs();
    return job;
  }

  // ---------- Home: all jobs ----------
  var HOME_FILTERS = [
    ['all', 'All', null],
    ['quotes', 'Quotes', ['draft', 'sent']],
    ['won', 'Won', ['won', 'scheduled']],
    ['completed', 'Done', ['completed']],
    ['paid', 'Paid', ['paid']],
    ['lost', 'Lost', ['lost']]
  ];

  function statusPill(job) {
    var st = S.statusInfo(S.statusOf(job));
    return '<span class="pill st-' + st.id + '">' + st.icon + ' ' + st.label + '</span>';
  }

  function jobCards() {
    var f = HOME_FILTERS.find(function (x) { return x[0] === homeFilter; }) || HOME_FILTERS[0];
    var q = homeSearch.trim().toLowerCase();
    var list = jobs.filter(function (j) {
      if (f[2] && f[2].indexOf(S.statusOf(j)) === -1) return false;
      if (!q) return true;
      return [j.customer.name, j.customer.address, j.customer.phone, j.number].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    if (!list.length) {
      return jobs.length ? '<p class="muted center-text">No jobs match.</p>' : '<div class="empty"><div class="empty-icon">🎨</div><p>No quotes yet.</p>' +
        '<p class="muted small">Tap <b>New Quote</b>, add rooms and send the customer a professional, itemized price in minutes.</p></div>';
    }
    return list.map(function (j) {
      var total = P.calcJob(j, settings).total;
      var owed = S.balance(j, settings);
      var st = S.statusOf(j);
      return '<a class="job-card" href="#/job/' + j.id + '">' +
        '<div class="job-main"><strong>' + esc(j.customer.name || 'New customer') + '</strong>' +
        '<div class="muted small">' + esc(j.customer.address || j.number) + ' · ' + fmtDate(j.updatedAt) + '</div>' +
        '<div class="job-tags">' + (j.sample ? '<span class="pill">🧪 Sample</span>' : '') + statusPill(j) + (P.propertyLabel(j) ? '<span class="tag">' + esc(P.propertyLabel(j)) + '</span>' : '') + '</div></div>' +
        '<div class="job-right"><div class="job-total">' + money0(total) + '</div>' +
        (owed > 0 && (st === 'completed' || S.paidAmount(j) > 0) ? '<div class="owed">' + money0(owed) + ' owed</div>' : '') +
        (st === 'scheduled' && j.startDate ? '<div class="muted small">Starts ' + esc(fmtShort(j.startDate)) + '</div>' : '') +
        '</div></a>';
    }).join('');
  }

  function fmtShort(iso) {
    var d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderHome() {
    var needsSetup = !settings.businessName;
    var y = S.yearStats(jobs, expenses, settings, new Date().getFullYear());
    var counts = {};
    HOME_FILTERS.forEach(function (f) {
      counts[f[0]] = f[2] ? jobs.filter(function (j) { return f[2].indexOf(S.statusOf(j)) !== -1; }).length : jobs.length;
    });

    app.innerHTML =
      (needsSetup ? '<a class="setup-banner" href="#/settings"><span>👋</span><div><strong>Start here: add your business info</strong>' +
        '<div class="small">Your name, logo and rates go on every quote. Takes 1 minute.</div></div><span>›</span></a>' : '') +
      (jobs.length ? '<a class="year-card" href="#/stats"><div><div class="muted small">' + y.year + ' collected</div><div class="year-big">' + money0(y.collected) + '</div></div>' +
        '<div><div class="muted small">You made</div><div class="year-big">' + money0(y.made) + '</div></div>' +
        '<div class="year-more">Stats ›</div></a>' : '') +
      '<button class="btn btn-primary btn-xl" data-action="new-job">＋ New Quote</button>' +
      '<h2 class="section-title">Your jobs</h2>' +
      (jobs.length ? '<input type="search" class="search" data-home-search placeholder="Search name, address, phone…" value="' + esc(homeSearch) + '">' +
        '<div class="filter-tabs" role="tablist">' + HOME_FILTERS.map(function (f) {
          return '<button type="button" role="tab" aria-selected="' + (homeFilter === f[0]) + '" class="' + (homeFilter === f[0] ? 'on' : '') +
            '" data-action="filter" data-v="' + f[0] + '">' + f[1] + (counts[f[0]] ? ' <span>' + counts[f[0]] + '</span>' : '') + '</button>';
        }).join('') + '</div>' : '') +
      '<div id="job-list">' + jobCards() + '</div>';
  }

  // ---------- New quote: pick job type, then property ----------
  function renderNewJob(type) {
    if (!type) {
      app.innerHTML =
        '<div class="page-head"><a href="#/" class="back">‹ Quotes</a><span class="muted small">Step 1 of 2</span></div>' +
        '<h1 class="ask">What kind of job is it?</h1>' +
        '<div class="pick-list">' + Object.keys(P.JOB_TYPES).map(function (k) {
          var t = P.JOB_TYPES[k];
          return '<a class="pick big" href="#/new/' + k + '"><span class="pick-icon">' + t.icon + '</span>' +
            '<span><strong>' + t.label + '</strong><span class="muted small">' + t.desc + '</span></span><span class="chev">›</span></a>';
        }).join('') + '</div>';
      return;
    }
    var t = P.JOB_TYPES[type];
    app.innerHTML =
      '<div class="page-head"><a href="#/new" class="back">‹ Back</a><span class="muted small">Step 2 of 2</span></div>' +
      '<div class="tag">' + t.icon + ' ' + t.label + '</div>' +
      '<h1 class="ask">What type of property?</h1>' +
      '<div class="pick-list' + (t.properties.length > 6 ? ' grid' : '') + '">' + t.properties.map(function (p) {
        return '<button type="button" class="pick" data-action="create-job" data-type="' + type + '" data-prop="' + p.id + '">' +
          '<span class="pick-icon">' + p.icon + '</span><span><strong>' + p.label + '</strong><span class="muted small">' + p.desc + '</span></span>' +
          '<span class="chev">›</span></button>';
      }).join('') + '</div>';
  }

  function propertyPicker(job) {
    var type = P.JOB_TYPES[job.jobType] ? job.jobType : 'residential';
    return '<div class="label">Job type</div>' +
      '<div class="segmented">' + Object.keys(P.JOB_TYPES).map(function (k) {
        return '<button type="button" class="' + (k === job.jobType ? 'on' : '') + '" data-action="jobtype" data-v="' + k + '">' +
          P.JOB_TYPES[k].icon + ' ' + P.JOB_TYPES[k].label + '</button>';
      }).join('') + '</div>' +
      '<div class="chips prop-chips">' + P.JOB_TYPES[type].properties.map(function (p) {
        return '<button type="button" class="chip' + (p.id === job.propertyType ? ' on' : '') + '" data-action="prop" data-v="' + p.id + '">' +
          p.icon + ' ' + p.label + '</button>';
      }).join('') + '</div>';
  }

  // ---------- Job editor ----------
  function sizeChips(room, i) {
    var keys = ['S', 'M', 'L', 'custom'];
    return '<div class="chips" role="group" aria-label="Room size">' + keys.map(function (k) {
      var label = k === 'custom' ? 'Exact' : P.SIZES[k].label;
      var sub = k === 'custom' ? 'measure' : P.SIZES[k].length + '×' + P.SIZES[k].width;
      return '<button type="button" class="chip' + (room.size === k ? ' on' : '') + '" data-action="size" data-i="' + i + '" data-v="' + k + '">' +
        label + '<span>' + sub + '</span></button>';
    }).join('') + '</div>';
  }

  function surfaceChips(room, i) {
    var opts = [['walls', 'Walls'], ['ceiling', 'Ceiling'], ['trim', 'Trim'], ['doors', 'Doors']];
    return '<div class="chips" role="group" aria-label="What to paint">' + opts.map(function (o) {
      var on = room.surfaces[o[0]];
      return '<button type="button" class="chip toggle' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" data-action="surface" data-i="' + i + '" data-v="' + o[0] + '">' +
        (on ? '✓ ' : '') + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function segmented(i, field, current, options) {
    return '<div class="segmented">' + options.map(function (o) {
      return '<button type="button" class="' + (String(current) === String(o[0]) ? 'on' : '') + '" data-action="seg" data-i="' + i +
        '" data-field="' + field + '" data-v="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function stepper(i, field, value, label) {
    return '<div class="stepper"><span class="stepper-label">' + label + '</span>' +
      '<button type="button" data-action="step" data-i="' + i + '" data-field="' + field + '" data-d="-1" aria-label="Fewer ' + label + '">−</button>' +
      '<output data-out="rooms.' + i + '.' + field + '">' + value + '</output>' +
      '<button type="button" data-action="step" data-i="' + i + '" data-field="' + field + '" data-d="1" aria-label="More ' + label + '">＋</button></div>';
  }

  function numField(path, value, label, unit) {
    return '<label class="field num"><span>' + label + '</span><div class="with-unit">' +
      '<input type="number" inputmode="decimal" min="0" step="any" data-field="' + path + '" value="' + esc(value) + '">' +
      (unit ? '<em>' + unit + '</em>' : '') + '</div></label>';
  }

  function roomCard(room, i, calc) {
    var c = calc.rooms[i];
    return '<section class="card room-card" data-room="' + i + '">' +
      '<div class="room-head"><input class="room-name" data-field="rooms.' + i + '.name" value="' + esc(room.name) + '" aria-label="Room name">' +
      '<div class="room-price" data-out="room-price-' + i + '">' + money0(c.price) + '</div></div>' +
      '<div class="label">Size</div>' + sizeChips(room, i) +
      '<div class="dims' + (room.size === 'custom' ? '' : ' compact') + '">' +
      numField('rooms.' + i + '.length', room.length, 'Length', 'ft') +
      numField('rooms.' + i + '.width', room.width, 'Width', 'ft') +
      numField('rooms.' + i + '.height', room.height, 'Ceiling height', 'ft') + '</div>' +
      '<div class="label">What are we painting?</div>' + surfaceChips(room, i) +
      '<div class="row2">' + stepper(i, 'doors', room.doors, 'Doors') + stepper(i, 'windows', room.windows, 'Windows') + '</div>' +
      '<div class="row2"><div><div class="label">Coats</div>' + segmented(i, 'coats', room.coats, [[1, '1'], [2, '2'], [3, '3']]) + '</div>' +
      '<div><div class="label">Wall condition</div>' + segmented(i, 'condition', room.condition, [['good', 'Good'], ['fair', 'Fair'], ['poor', 'Rough']]) + '</div></div>' +
      '<div class="room-foot"><span class="muted small" data-out="room-meta-' + i + '">' + roomMeta(c) + '</span>' +
      '<span><button type="button" class="link" data-action="dup-room" data-i="' + i + '">Copy</button>' +
      '<button type="button" class="link danger" data-action="del-room" data-i="' + i + '">Remove</button></span></div>' +
      '</section>';
  }

  function roomMeta(c) {
    return Math.round(c.wallArea).toLocaleString('en-US') + ' sq ft walls · ' + Math.round(c.hours * 10) / 10 + ' hrs';
  }

  // Quick estimate: whole home/space from total square footage
  function quickCard(job, calc) {
    var q = job.quick, c = calc.rooms[0];
    var commercial = job.jobType === 'commercial';
    var opts = [['walls', 'Walls'], ['ceiling', 'Ceiling'], ['trim', 'Trim'], ['doors', 'Doors']];
    var qseg = function (field, current, options) {
      return '<div class="segmented">' + options.map(function (o) {
        return '<button type="button" class="' + (String(current) === String(o[0]) ? 'on' : '') + '" data-action="q-seg" data-field="' + field +
          '" data-v="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    };
    return '<section class="card room-card">' +
      '<div class="room-head"><strong class="room-name">' + (commercial ? 'Whole space' : 'Whole home') + '</strong>' +
      '<div class="room-price" data-out="room-price-0">' + money0(c.price) + '</div></div>' +
      '<label class="field sqft"><span>Total square footage ' + (commercial ? 'of the space' : 'of the home') + '</span>' +
      '<div class="with-unit"><input type="number" inputmode="numeric" min="0" step="1" data-field="quick.sqft" value="' + esc(q.sqft) +
      '" placeholder="e.g. 2000"><em>sq ft</em></div><small class="muted">Check Zillow, the listing or ask the customer.</small></label>' +
      '<div class="label">Ceiling height' + (commercial ? ' (ft)' : '') + '</div>' + qseg('height', q.height, commercial
        ? [[9, '9'], [10, '10'], [12, '12'], [16, '16'], [20, '20+']]
        : [[8, '8 ft'], [9, '9 ft'], [10, '10 ft'], [12, '12+ ft']]) +
      '<div class="label">What are we painting?</div><div class="chips">' + opts.map(function (o) {
        var on = q.surfaces[o[0]];
        return '<button type="button" class="chip toggle' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" data-action="q-surface" data-v="' + o[0] + '">' +
          (on ? '✓ ' : '') + o[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="row2"><div><div class="label">Coats</div>' + qseg('coats', q.coats, [[1, '1'], [2, '2'], [3, '3']]) + '</div>' +
      '<div><div class="label">Wall condition</div>' + qseg('condition', q.condition, [['good', 'Good'], ['fair', 'Fair'], ['poor', 'Rough']]) + '</div></div>' +
      '<div class="room-foot"><span class="muted small" data-out="room-meta-0">' + roomMeta(c) + '</span></div>' +
      '<p class="hint">💡 Ballpark price. Switch to <b>Room by room</b> after a walkthrough for an exact quote.</p>' +
      '</section>';
  }

  // ---------- Job status, payments & real costs ----------
  function statusCard(job) {
    var st = S.statusOf(job);
    return '<section class="card status-card"><div class="label" style="margin-top:0">Job status</div>' +
      '<div class="status-chips">' + S.STATUSES.map(function (x) {
        return '<button type="button" class="chip st-chip st-' + x.id + (st === x.id ? ' on' : '') + '" aria-pressed="' + (st === x.id) +
          '" data-action="status" data-v="' + x.id + '">' + x.icon + ' ' + x.label + '</button>';
      }).join('') + '</div>' +
      (st === 'won' || st === 'scheduled' || st === 'completed' || st === 'paid'
        ? '<label class="field start-date"><span>Start date</span><input type="date" data-field="startDate" value="' + esc(job.startDate || '') + '"></label>' : '') +
      '</section>';
  }

  function resultBox(job) {
    var r = S.jobResult(job, settings);
    var st = S.statusOf(job);
    var hoursNote = '';
    var a = job.actuals || {};
    if (a.hours !== '' && a.hours != null && r.estimatedHours > 0) {
      var diff = Math.round((r.hours - r.estimatedHours) / r.estimatedHours * 100);
      hoursNote = '<div class="muted small">Estimated ' + Math.round(r.estimatedHours * 10) / 10 + ' hrs · took ' +
        (diff === 0 ? 'exactly that' : Math.abs(diff) + '% ' + (diff > 0 ? 'longer' : 'less')) + '</div>';
    }
    return '<div class="stats mini">' +
      stat('Collected', money0(r.collected)) + stat('Still owed', money0(r.balance)) +
      stat('Job costs', money0(r.costs)) + stat('You made', '<span class="' + (r.made < 0 ? 'neg' : '') + '">' + money0(r.made) + '</span>') +
      stat('Per hour', money0(r.perHour)) + stat('Quoted', money0(r.total)) + '</div>' + hoursNote +
      (r.estimated ? '<div class="muted small">Using estimated ' + (a.materials === '' || a.materials == null ? 'materials' : '') +
        ((a.materials === '' || a.materials == null) && (a.hours === '' || a.hours == null) ? ' and ' : '') +
        (a.hours === '' || a.hours == null ? 'hours' : '') + ' until you enter the real numbers.</div>' : '') +
      (r.balance === 0 && r.collected > 0 && st !== 'paid' ? '<button type="button" class="btn btn-primary full" data-action="status" data-v="paid">💰 Fully paid — mark as Paid</button>' : '');
  }

  function moneyCard(job) {
    if (!S.isWon(job)) return '';
    var a = job.actuals;
    var costField = function (key, label, unit, ph) {
      return '<label class="field"><span>' + label + '</span><div class="with-unit' + (unit === '$' ? ' pre' : '') + '">' +
        (unit === '$' ? '<em>$</em>' : '') + '<input type="number" inputmode="decimal" min="0" step="any" data-field="actuals.' + key +
        '" value="' + esc(a[key] == null ? '' : a[key]) + '" placeholder="' + ph + '">' + (unit !== '$' ? '<em>' + unit + '</em>' : '') + '</div></label>';
    };
    return '<section class="card money-card"><h2 class="card-title"><span class="step">5</span> Payments & real costs</h2>' +
      '<div class="label" style="margin-top:0">Payments received</div>' +
      (job.payments.length ? job.payments.map(function (p, i) {
        return '<div class="pay-row"><input type="date" data-field="payments.' + i + '.date" value="' + esc(p.date) + '" aria-label="Payment date">' +
          '<div class="with-unit pre"><em>$</em><input type="number" inputmode="decimal" min="0" step="any" data-field="payments.' + i + '.amount" value="' + esc(p.amount) + '" aria-label="Amount"></div>' +
          '<select data-field="payments.' + i + '.method" aria-label="Payment method">' + S.PAYMENT_METHODS.map(function (m) {
            return '<option' + (p.method === m ? ' selected' : '') + '>' + m + '</option>';
          }).join('') + '</select>' +
          '<button type="button" class="icon-btn" data-action="del-payment" data-i="' + i + '" aria-label="Remove payment">✕</button></div>';
      }).join('') : '<p class="muted small">No payments yet. Log the deposit and final payment here.</p>') +
      '<button type="button" class="btn btn-ghost" data-action="add-payment">＋ Add payment</button>' +
      '<div class="label">What the job really cost</div>' +
      '<div class="row2">' + costField('hours', 'Hours worked', 'hrs', 'e.g. 24') + costField('materials', 'Paint & materials', '$', 'from receipts') + '</div>' +
      '<div class="row2">' + costField('crew', 'Crew / helper pay', '$', '0') + costField('other', 'Other job costs', '$', '0') + '</div>' +
      '<div data-out="result">' + resultBox(job) + '</div>' +
      '<a class="btn full" href="#/invoice/' + job.id + '">🧾 Create invoice</a></section>';
  }

  // ---------- Outside & floors ----------
  function oSeg(i, field, current, options) {
    return '<div class="segmented">' + options.map(function (o) {
      return '<button type="button" class="' + (String(current) === String(o[0]) ? 'on' : '') + '" data-action="o-seg" data-i="' + i +
        '" data-field="' + field + '" data-v="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function oStep(i, field, value, label) {
    return '<div class="stepper"><span class="stepper-label">' + label + '</span>' +
      '<button type="button" data-action="o-step" data-i="' + i + '" data-field="' + field + '" data-d="-1" aria-label="Fewer ' + label + '">−</button>' +
      '<output>' + (Math.round(Number(value)) || 0) + '</output>' +
      '<button type="button" data-action="o-step" data-i="' + i + '" data-field="' + field + '" data-d="1" aria-label="More ' + label + '">＋</button></div>';
  }
  function oNum(i, field, value, label, unit) {
    return numField('outside.' + i + '.' + field, value, label, unit);
  }
  var COATS_12 = [[1, '1 coat'], [2, '2 coats']];
  var CONDITION_3 = [['good', 'Good'], ['fair', 'Fair'], ['poor', 'Rough']];

  function outsideCard(item, i, c) {
    var body = '';
    switch (item.type) {
      case 'house':
        var su = item.surfaces || {};
        body = '<div class="dims two">' + oNum(i, 'sqft', item.sqft, 'Home size', 'sq ft') + '</div>' +
          '<div class="label">Stories</div>' + oSeg(i, 'stories', item.stories, [[1, '1'], [2, '2'], [3, '3']]) +
          '<div class="label">Siding</div>' + oSeg(i, 'siding', item.siding, Object.keys(P.SIDING).map(function (k) { return [k, P.SIDING[k].label]; })) +
          '<div class="label">What are we painting?</div><div class="chips">' + [['siding', 'Siding'], ['trim', 'Trim'], ['soffits', 'Soffits']].map(function (o) {
            var on = su[o[0]];
            return '<button type="button" class="chip toggle' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" data-action="o-surface" data-i="' + i +
              '" data-v="' + o[0] + '">' + (on ? '✓ ' : '') + o[1] + '</button>';
          }).join('') + '</div>' +
          '<div class="row2">' + oStep(i, 'windows', item.windows, 'Windows') + oStep(i, 'doors', item.doors, 'Doors') + '</div>' +
          '<div class="row2"><div><div class="label">Coats</div>' + oSeg(i, 'coats', item.coats, [[1, '1'], [2, '2']]) + '</div>' +
          '<div><div class="label">Condition</div>' + oSeg(i, 'condition', item.condition, CONDITION_3) + '</div></div>';
        break;
      case 'deck':
        body = '<div class="dims two">' + oNum(i, 'sqft', item.sqft, 'Deck size', 'sq ft') + oNum(i, 'railing', item.railing, 'Railing', 'ft') + '</div>' +
          '<div class="row2"><div><div class="label">Coats</div>' + oSeg(i, 'coats', item.coats, [[1, '1'], [2, '2']]) + '</div>' +
          '<div><div class="label">Condition</div>' + oSeg(i, 'condition', item.condition, CONDITION_3) + '</div></div>';
        break;
      case 'fence':
        body = '<div class="dims two">' + oNum(i, 'length', item.length, 'Fence length', 'ft') + '</div>' +
          '<div class="label">Height</div>' + oSeg(i, 'height', item.height, [[4, '4 ft'], [6, '6 ft'], [8, '8 ft']]) +
          '<div class="label">Sides</div>' + oSeg(i, 'sides', item.sides, [[1, 'One side'], [2, 'Both sides']]) +
          '<div class="row2"><div><div class="label">Coats</div>' + oSeg(i, 'coats', item.coats, [[1, '1'], [2, '2']]) + '</div>' +
          '<div><div class="label">Condition</div>' + oSeg(i, 'condition', item.condition, CONDITION_3) + '</div></div>';
        break;
      case 'door':
      case 'shutters':
        body = oStep(i, 'count', item.count, item.type === 'door' ? 'Doors' : 'Shutters') +
          '<div class="label">Coats</div>' + oSeg(i, 'coats', item.coats, COATS_12);
        break;
      case 'garagedoor':
        body = oStep(i, 'count', item.count, 'Garage doors') +
          '<div class="label">Size</div>' + oSeg(i, 'size', item.size, [['single', 'Single'], ['double', 'Double']]) +
          '<div class="label">Coats</div>' + oSeg(i, 'coats', item.coats, COATS_12);
        break;
      case 'cabinets':
        body = '<div class="row2">' + oStep(i, 'doors', item.doors, 'Doors') + oStep(i, 'drawers', item.drawers, 'Drawers') + '</div>' +
          '<div class="dims two">' + oNum(i, 'boxes', item.boxes, 'Cabinet boxes', 'linear ft') + '</div>' +
          '<div class="label">Method</div>' + oSeg(i, 'method', item.method, [['spray', 'Spray'], ['brush', 'Brush & roll']]) +
          '<div class="label">Paint the insides too?</div>' + oSeg(i, 'insides', item.insides ? 1 : 0, [[0, 'Outside only'], [1, 'Inside & out']]) +
          '<div class="label">Condition</div>' + oSeg(i, 'condition', item.condition, [['good', 'Good'], ['fair', 'Greasy / worn'], ['poor', 'Damaged']]);
        break;
      case 'wallpaper':
        body = '<div class="dims two">' + oNum(i, 'sqft', item.sqft, 'Wallpaper area', 'sq ft') + '</div>' +
          '<p class="muted small">Tip: wall length × height for each papered wall.</p>' +
          '<div class="label">How stubborn?</div>' + oSeg(i, 'condition', item.condition, [['good', 'Peels easily'], ['fair', 'Average'], ['poor', 'Multiple layers']]);
        break;
      case 'popcorn':
        body = '<div class="dims two">' + oNum(i, 'sqft', item.sqft, 'Ceiling area', 'sq ft') + '</div>' +
          '<div class="label">New finish</div>' + oSeg(i, 'retexture', item.retexture, [['smooth', 'Smooth'], ['knockdown', 'Knockdown']]) +
          '<div class="label">Asbestos test</div>' + oSeg(i, 'test', item.test, [[1, 'Include ($75)'], [0, 'Not needed']]) +
          '<p class="muted small">⚠️ Homes built before 1980 should be tested before scraping.</p>';
        break;
      case 'drywall':
        body = oStep(i, 'small', item.small, 'Small (up to 6")') + oStep(i, 'large', item.large, 'Large (over 6")');
        break;
      case 'floor':
        var garage = /garage/i.test(item.name);
        body = (garage ? '<div class="label">Garage size</div><div class="chips">' + Object.keys(P.GARAGE_SIZES).concat('custom').map(function (k) {
            var g = P.GARAGE_SIZES[k];
            return '<button type="button" class="chip' + (item.size === k ? ' on' : '') + '" data-action="o-size" data-i="' + i + '" data-v="' + k + '">' +
              (g ? g.label + '<span>' + g.length + '×' + g.width + '</span>' : 'Exact<span>measure</span>') + '</button>';
          }).join('') + '</div>' : '') +
          '<div class="dims two">' + oNum(i, 'length', item.length, 'Length', 'ft') + oNum(i, 'width', item.width, 'Width', 'ft') + '</div>' +
          '<div class="label">Coating</div>' + oSeg(i, 'system', item.system, Object.keys(P.FLOOR_SYSTEMS).map(function (k) { return [k, P.FLOOR_SYSTEMS[k].label]; })) +
          (item.system === 'paint' ? '<div class="label">Coats</div>' + oSeg(i, 'coats', item.coats, COATS_12) : '') +
          '<div class="label">Concrete condition</div>' + oSeg(i, 'condition', item.condition, [['good', 'Good'], ['poor', 'Cracks / oil stains']]);
        break;
    }
    return '<section class="card room-card out-card">' +
      '<div class="room-head"><input class="room-name" data-field="outside.' + i + '.name" value="' + esc(item.name) + '" aria-label="Item name">' +
      '<div class="room-price" data-out="out-price-' + i + '">' + money0(c.price) + '</div></div>' + body +
      '<div class="room-foot"><span class="muted small" data-out="out-meta-' + i + '">' + outMeta(c) + '</span>' +
      '<span><button type="button" class="link danger" data-action="del-out" data-i="' + i + '">Remove</button></span></div></section>';
  }
  function outMeta(c) { return Math.round(c.hours * 10) / 10 + ' hrs labor'; }

  function renderJob(job) {
    if (!job.quick) job.quick = P.newQuick();
    if (!job.outside) job.outside = [];
    if (!job.payments) job.payments = [];
    if (!job.actuals) job.actuals = {};
    var quick = job.mode === 'quick';
    var calc = P.calcJob(job, settings);
    var cu = job.customer;
    var commercial = job.jobType === 'commercial';
    var roomTypes = P.roomTypesFor(job.jobType, job.propertyType);
    var typeBtn = function (t, k) {
      return '<button type="button" data-action="add-room" data-k="' + k + '"><span>' + t.icon + '</span>' + esc(t.name) + '</button>';
    };
    var moreTypes = roomTypes.map(typeBtn).filter(function (_, k) { return roomTypes[k].more; });
    app.innerHTML =
      '<div class="page-head"><a href="#/" class="back">‹ Jobs</a><span class="muted">' + esc(job.number) + '</span></div>' +
      statusCard(job) +

      '<section class="card"><h2 class="card-title"><span class="step">1</span> Customer</h2>' +
      '<datalist id="cust-names">' + S.customersFrom(jobs, settings).map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('') + '</datalist>' +
      '<label class="field"><span>' + (commercial ? 'Business / contact name' : 'Name') + '</span><input list="cust-names" data-field="customer.name" value="' + esc(cu.name) +
      '" placeholder="' + (commercial ? 'Acme Dental — Dr. Lee' : 'Jane Smith') + '" autocomplete="off"></label>' +
      '<label class="field"><span>Address</span><input data-field="customer.address" value="' + esc(cu.address) + '" placeholder="123 Main St" autocomplete="off"></label>' +
      '<div class="row2"><label class="field"><span>Phone</span><input type="tel" data-field="customer.phone" value="' + esc(cu.phone) + '" placeholder="(555) 555-5555"></label>' +
      '<label class="field"><span>Email</span><input type="email" data-field="customer.email" value="' + esc(cu.email) + '" placeholder="jane@email.com" autocapitalize="off"></label></div>' +
      propertyPicker(job) +
      '</section>' +

      '<h2 class="section-title"><span class="step">2</span> ' + (quick ? 'Inside: size of the job' : 'Inside: rooms') + '</h2>' +
      '<div class="segmented mode-switch">' +
      '<button type="button" class="' + (quick ? 'on' : '') + '" data-action="mode" data-v="quick">⚡ Quick (by sq ft)</button>' +
      '<button type="button" class="' + (quick ? '' : 'on') + '" data-action="mode" data-v="rooms">📐 Room by room</button></div>' +
      (quick ? quickCard(job, calc) :
        job.rooms.map(function (r, i) { return roomCard(r, i, calc); }).join('') +
        '<section class="card add-room"><div class="label">' + (job.rooms.length ? 'Add another room' : 'Tap a room to add it') + '</div>' +
        '<div class="room-types">' + roomTypes.map(typeBtn).filter(function (_, k) { return !roomTypes[k].more; }).join('') + '</div>' +
        (moreTypes.length ? '<details class="more-types"><summary>More area types (' + moreTypes.length + ')</summary>' +
          '<div class="room-types">' + moreTypes.join('') + '</div></details>' : '') +
        '</section>') +

      '<h2 class="section-title"><span class="step">3</span> Exterior, floors & specialty <em class="muted small">(optional)</em></h2>' +
      job.outside.map(function (it, i) { return outsideCard(it, i, calc.outside[i]); }).join('') +
      '<section class="card add-room">' + P.OUTSIDE_GROUPS.map(function (g) {
        return '<div class="label">' + g[1] + '</div><div class="room-types">' + P.OUTSIDE_TYPES.map(function (t, k) {
          if (t.group !== g[0]) return '';
          var nm = (commercial && t.commercialName) || t.name;
          return '<button type="button" data-action="add-out" data-k="' + k + '"><span>' + t.icon + '</span>' + esc(nm) + '</button>';
        }).join('') + '</div>';
      }).join('') + '</section>' +

      '<details class="card"' + (job.extras.length || job.discount || job.notes ? ' open' : '') + '><summary class="card-title"><span class="step">4</span> Extras, discount & notes <em class="muted small">(optional)</em></summary>' +
      job.extras.map(function (e, i) {
        return '<div class="extra-row"><input data-field="extras.' + i + '.label" value="' + esc(e.label) + '" placeholder="e.g. Drywall repair" aria-label="Extra item">' +
          '<div class="with-unit pre"><em>$</em><input type="number" inputmode="decimal" min="0" data-field="extras.' + i + '.price" value="' + esc(e.price) + '" aria-label="Price"></div>' +
          '<button type="button" class="icon-btn" data-action="del-extra" data-i="' + i + '" aria-label="Remove">✕</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost" data-action="add-extra">＋ Add extra item</button>' +
      '<div class="row2"><label class="field"><span>Discount</span><div class="with-unit pre"><em>$</em><input type="number" inputmode="decimal" min="0" data-field="discount" value="' + esc(job.discount || '') + '" placeholder="0"></div></label></div>' +
      '<label class="field"><span>Notes for customer</span><textarea data-field="notes" rows="3" placeholder="Colors, start date, anything special…">' + esc(job.notes) + '</textarea></label>' +
      '</details>' +
      moneyCard(job) +

      '<button type="button" class="link danger center" data-action="del-job">Delete this job</button>' +

      '<div class="totalbar"><div><div class="muted small">Total</div><div class="big" data-out="total">' + money(calc.total) + '</div></div>' +
      '<a class="btn btn-primary" href="#/quote/' + job.id + '">Review & Send ›</a></div>';
  }

  // Update just the numbers (keeps keyboard focus while typing)
  function refreshTotals(job) {
    var calc = P.calcJob(job, settings);
    calc.rooms.forEach(function (c, i) {
      var p = app.querySelector('[data-out="room-price-' + i + '"]');
      if (p) p.textContent = money0(c.price);
      var m = app.querySelector('[data-out="room-meta-' + i + '"]');
      if (m) m.textContent = roomMeta(c);
    });
    (calc.outside || []).forEach(function (c, i) {
      var p = app.querySelector('[data-out="out-price-' + i + '"]');
      if (p) p.textContent = money0(c.price);
      var m = app.querySelector('[data-out="out-meta-' + i + '"]');
      if (m) m.textContent = outMeta(c);
    });
    var t = app.querySelector('[data-out="total"]');
    if (t) t.textContent = money(calc.total);
    var res = app.querySelector('[data-out="result"]');
    if (res) res.innerHTML = resultBox(job);
  }

  function currentJob() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    return parts[0] === 'job' ? findJob(parts[1]) : null;
  }

  function touch(job) { job.updatedAt = Date.now(); saveJobs(); }

  // ---------- Quote view ----------
  var QUICK_NOTE = 'This is a ballpark estimate based on the total square footage. ' +
    'The final price will be confirmed after a walkthrough.';

  function lineRow(label, detail, amount, cls) {
    return '<tr class="' + (cls || '') + '"><td>' + esc(label) + (detail ? '<div class="muted small">' + esc(detail) + '</div>' : '') + '</td>' +
      '<td class="amt">' + amount + '</td></tr>';
  }

  function invoiceNumber(job) { return String(job.number || '').replace(/^Q-/, 'INV-'); }
  function invoiceDue(job) {
    var days = Number(settings.invoiceDueDays) || 0;
    if (!days) return 'Due on receipt';
    var d = new Date((job.invoiceDate || today()) + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return 'Due ' + fmtDate(d.getTime());
  }

  function quoteDocument(job, q, kind) {
    var s = settings, cu = job.customer, inv = kind === 'invoice';
    var valid = new Date(job.updatedAt + (Number(s.validDays) || 30) * 864e5);
    var rows = '';
    q.rooms.concat(q.outside || []).forEach(function (r) {
      if (!r.lines.length) return;
      rows += '<tr class="group"><td colspan="2">' + esc(r.name) + '<span class="muted small"> · ' +
        esc(r.summary) + '</span></td></tr>';
      r.lines.forEach(function (l) { rows += lineRow(l.label, l.detail, money(l.price)); });
    });
    if (q.materials.length) {
      rows += '<tr class="group"><td colspan="2">Paint & materials</td></tr>';
      q.materials.forEach(function (m) { rows += lineRow(m.label, m.detail, money(m.price)); });
    }
    if (q.extras.length) {
      rows += '<tr class="group"><td colspan="2">Additional work</td></tr>';
      q.extras.forEach(function (e) { rows += lineRow(e.label, '', money(e.price)); });
    }

    var totals = lineRow('Subtotal', '', money(q.subtotal), 'sub');
    if (q.discount) totals += lineRow('Discount', '', '−' + money(q.discount), 'sub');
    if (q.minimumAdj) totals += lineRow('Minimum job charge', '', money(q.minimumAdj), 'sub');
    if (q.tax) totals += lineRow('Tax (' + s.taxRate + '%)', '', money(q.tax), 'sub');
    if (inv) {
      totals += lineRow('Total', '', money(q.total), 'sub strong');
      (job.payments || []).forEach(function (p) {
        totals += lineRow('Paid ' + fmtShort(p.date) + (p.method ? ' · ' + p.method : ''), '', '−' + money(p.amount), 'sub');
      });
      totals += lineRow('Balance due', '', money(Math.max(0, q.total - S.paidAmount(job))), 'grand');
    } else {
      totals += lineRow('Total', '', money(q.total), 'grand');
      if (q.deposit) totals += lineRow('Deposit to book (' + s.depositPct + '%)', '', money(q.deposit), 'sub');
    }

    var biz = [s.ownerName, s.phone, s.email, s.website].filter(Boolean).map(esc).join('<br>');

    return '<article class="quote-doc">' +
      '<header class="doc-head"><div class="doc-biz">' +
      (s.logo ? '<img src="' + esc(s.logo) + '" alt="" class="logo">' : '') +
      '<div><div class="doc-bizname">' + esc(s.businessName || 'Your Painting Co.') + '</div><div class="muted small">' + biz + '</div></div></div>' +
      (inv
        ? '<div class="doc-meta"><div class="doc-title">INVOICE</div><div>' + esc(invoiceNumber(job)) + '</div>' +
          '<div class="muted small">' + fmtDate(new Date((job.invoiceDate || today()) + 'T12:00:00').getTime()) + '<br>' + invoiceDue(job) + '</div></div></header>'
        : '<div class="doc-meta"><div class="doc-title">ESTIMATE</div><div>' + esc(job.number) + '</div>' +
          '<div class="muted small">' + fmtDate(job.updatedAt) + '<br>Valid until ' + fmtDate(valid) + '</div></div></header>') +
      '<div class="doc-to"><div><div class="label">' + (inv ? 'Bill to' : 'Prepared for') + '</div><strong>' + esc(cu.name || '—') + '</strong>' +
      '<div class="muted small">' + [cu.address, cu.phone, cu.email].filter(Boolean).map(esc).join('<br>') + '</div></div>' +
      (P.propertyLabel(job) ? '<div><div class="label">Property</div><strong>' + esc(P.propertyLabel(job)) + '</strong></div>' : '') + '</div>' +
      '<table class="lines"><tbody>' + (rows || '<tr><td class="muted">Add rooms to build the estimate.</td><td></td></tr>') + '</tbody>' +
      '<tfoot>' + totals + '</tfoot></table>' +
      (inv
        ? (s.paymentInstructions ? '<div class="doc-notes"><div class="label">How to pay</div>' + esc(s.paymentInstructions).replace(/\n/g, '<br>') + '</div>' : '') +
          '<div class="doc-notes"><b>Thank you for your business!</b></div>' +
          '<div class="doc-made">Invoice made with Coatwright</div>'
        : (q.quick ? '<div class="doc-notes"><b>' + esc(QUICK_NOTE) + '</b></div>' : '') +
          (job.notes ? '<div class="doc-notes"><div class="label">Notes</div>' + esc(job.notes).replace(/\n/g, '<br>') + '</div>' : '') +
          (s.terms ? '<div class="doc-terms">' + esc(s.terms) + '</div>' : '') +
          '<div class="doc-sign"><div>Customer signature</div><div>Date</div></div>' +
          '<div class="doc-made">Estimate made with Coatwright</div>') +
      '</article>';
  }

  function quoteText(job, q, kind) {
    var s = settings, cu = job.customer, out = [], inv = kind === 'invoice';
    var pad = function (label, amt) { return label + ': ' + amt; };
    out.push('Hi ' + (cu.name ? cu.name.split(' ')[0] : 'there') + ',', '');
    out.push(inv ? 'Thank you for choosing us! Here is your invoice (' + invoiceNumber(job) + '). ' + invoiceDue(job) + '.'
      : 'Thank you for the opportunity! Here is your painting estimate (' + job.number + ').');
    if (P.propertyLabel(job)) out.push('Property: ' + P.propertyLabel(job) + (cu.address ? ' — ' + cu.address : ''));
    out.push('');
    q.rooms.concat(q.outside || []).forEach(function (r) {
      if (!r.lines.length) return;
      out.push(r.name.toUpperCase() + ' — ' + money(r.price));
      r.lines.forEach(function (l) { out.push('  • ' + l.label + ' (' + l.detail + '): ' + money(l.price)); });
      out.push('');
    });
    if (q.materials.length) {
      out.push('PAINT & MATERIALS — ' + money(q.materialsTotal));
      q.materials.forEach(function (m) { out.push('  • ' + m.label + ' (' + m.detail + '): ' + money(m.price)); });
      out.push('');
    }
    if (q.extras.length) {
      out.push('ADDITIONAL WORK — ' + money(q.extrasTotal));
      q.extras.forEach(function (e) { out.push('  • ' + e.label + ': ' + money(e.price)); });
      out.push('');
    }
    out.push(pad('Subtotal', money(q.subtotal)));
    if (q.discount) out.push(pad('Discount', '-' + money(q.discount)));
    if (q.minimumAdj) out.push(pad('Minimum job charge', money(q.minimumAdj)));
    if (q.tax) out.push(pad('Tax', money(q.tax)));
    if (inv) {
      out.push(pad('Total', money(q.total)));
      (job.payments || []).forEach(function (p) { out.push(pad('Paid ' + p.date + (p.method ? ' (' + p.method + ')' : ''), '-' + money(p.amount))); });
      out.push(pad('BALANCE DUE', money(Math.max(0, q.total - S.paidAmount(job)))), '');
      if (s.paymentInstructions) out.push('How to pay: ' + s.paymentInstructions, '');
      out.push('Thank you for your business!', '');
    } else {
      out.push(pad('TOTAL', money(q.total)));
      if (q.deposit) out.push(pad('Deposit to book', money(q.deposit)));
      out.push('');
      if (q.quick) out.push(QUICK_NOTE, '');
      if (job.notes) out.push('Notes: ' + job.notes, '');
      if (s.terms) out.push(s.terms, '');
      out.push('Reply to this email to accept or with any questions.', '');
    }
    out.push([s.ownerName, s.businessName, s.phone, s.email].filter(Boolean).join('\n'));
    out.push('', '—', (inv ? 'Invoice' : 'Estimate') + ' made with Coatwright');
    return out.join('\n');
  }

  function renderQuote(job) {
    var q = P.calcJob(job, settings);
    var i = q.internal;
    var g = i.gallons;
    var gal = ['wall', 'ceiling', 'trim', 'primer'].filter(function (k) { return g[k] > 0; })
      .map(function (k) { return k + ' ' + Math.round(g[k] * 10) / 10; }).join(', ') || '—';

    app.innerHTML =
      '<div class="page-head no-print"><a href="#/job/' + job.id + '" class="back">‹ Edit</a><span class="muted">' + esc(job.number) + '</span></div>' +
      '<div class="actions no-print">' +
      '<button class="btn btn-primary" data-action="email">✉️ Email</button>' +
      '<button class="btn" data-action="share">💬 Text / Share</button>' +
      '<button class="btn" data-action="print">📄 Save PDF</button>' +
      '<button class="btn" data-action="copy">📋 Copy</button></div>' +
      quoteDocument(job, q) +
      '<section class="card internal no-print"><h2 class="card-title" style="margin-bottom:2px">🔒 Your numbers</h2>' +
      '<p class="muted small" style="margin:0 0 12px">Only you see this — it\'s never sent to the customer.</p>' +
      '<div class="stats">' +
      stat('Labor hours', i.hours) + stat('Crew days', i.crewDays + ' <small>(1 painter)</small>') +
      stat('Your labor', money0(i.laborCost)) + stat('Materials cost', money0(i.materialCost)) +
      stat('Profit', money0(i.profit)) + stat('Margin', i.margin + '%') +
      '</div><div class="muted small">Exact paint needed (gal): ' + esc(gal) + '</div></section>';
  }
  // ---------- Invoice ----------
  function renderInvoice(job) {
    if (!job.invoiceDate) { job.invoiceDate = today(); saveJobs(); }
    var q = P.calcJob(job, settings);
    var due = Math.max(0, q.total - S.paidAmount(job));
    app.innerHTML =
      '<div class="page-head no-print"><a href="#/job/' + job.id + '" class="back">‹ Job</a><span class="muted">' + esc(invoiceNumber(job)) + '</span></div>' +
      '<div class="actions no-print">' +
      '<button class="btn btn-primary" data-action="email">✉️ Email</button>' +
      '<button class="btn" data-action="share">💬 Text / Share</button>' +
      '<button class="btn" data-action="print">📄 Save PDF</button>' +
      '<button class="btn" data-action="copy">📋 Copy</button></div>' +
      (!settings.paymentInstructions ? '<a class="setup-banner no-print" href="#/settings"><span>💡</span><div><strong>Add how customers can pay you</strong>' +
        '<div class="small">e.g. "Zelle 555-123-4567 or checks to Smith Painting". Shows on every invoice.</div></div><span>›</span></a>' : '') +
      quoteDocument(job, q, 'invoice') +
      (due === 0 ? '<p class="muted center-text no-print">✅ Paid in full</p>' : '');
  }

  // ---------- Schedule ----------
  function fmtRange(a, b) {
    return a === b ? fmtShort(a) : fmtShort(a) + ' – ' + fmtShort(b);
  }
  function renderSchedule() {
    var t = today();
    var sch = S.schedule(jobs, settings, t);
    var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    var weekIso = S.isoDate(weekEnd.getTime());
    var groups = [['Happening now & late', function (x) { return x.start <= t; }],
      ['Next 7 days', function (x) { return x.start > t && x.start <= weekIso; }],
      ['Later', function (x) { return x.start > weekIso; }]];
    var card = function (x) {
      var j = x.job, cu = j.customer;
      return '<a class="job-card sched" href="#/job/' + j.id + '"><div class="sched-date"><b>' + esc(fmtShort(x.start).split(' ')[0]) + '</b>' +
        '<span>' + esc(fmtShort(x.start).split(' ')[1] || '') + '</span></div>' +
        '<div class="job-main"><strong>' + esc(cu.name || 'Customer') + '</strong>' +
        '<div class="muted small">' + esc(fmtRange(x.start, x.end)) + ' · ' + x.days + (x.days === 1 ? ' day' : ' days') + (cu.address ? ' · ' + esc(cu.address) : '') + '</div>' +
        '<div class="job-tags">' + statusPill(j) + (x.late ? '<span class="pill late">⚠️ Past end date</span>' : '') + '</div></div>' +
        '<div class="job-right"><div class="job-total">' + money0(P.calcJob(j, settings).total) + '</div></div></a>';
    };
    var body = groups.map(function (g) {
      var list = sch.items.filter(g[1]);
      return list.length ? '<h2 class="section-title">' + g[0] + '</h2>' + list.map(card).join('') : '';
    }).join('');
    app.innerHTML =
      '<div class="page-head"><a href="#/" class="back">‹ Jobs</a><span class="muted small">Schedule</span></div>' +
      (sch.unscheduled.length ? '<section class="card"><h2 class="card-title">📌 Won jobs without a start date</h2>' +
        sch.unscheduled.map(function (j) {
          return '<div class="unsched"><a href="#/job/' + j.id + '"><strong>' + esc(j.customer.name || j.number) + '</strong>' +
            '<span class="muted small"> · ' + money0(P.calcJob(j, settings).total) + ' · ~' + S.jobDays(j, settings) + ' days</span></a>' +
            '<input type="date" data-schedule="' + j.id + '" aria-label="Start date for ' + esc(j.customer.name || j.number) + '"></div>';
        }).join('') + '<p class="muted small">Pick a date and the job moves onto your schedule.</p></section>' : '') +
      (body || '<div class="empty"><div class="empty-icon">📅</div><p>Nothing scheduled yet.</p>' +
        '<p class="muted small">Mark a job as <b>Won</b> or <b>Scheduled</b> and give it a start date. It shows up here with how many days it takes.</p></div>');
  }

  // ---------- Customers ----------
  function renderCustomers() {
    var all = S.customersFrom(jobs, settings);
    var q = customerSearch.trim().toLowerCase();
    var list = all.filter(function (c) {
      return !q || [c.name, c.phone, c.email, c.address].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var lifetime = all.reduce(function (a, c) { return a + c.collected; }, 0);
    var repeat = all.filter(function (c) { return c.won > 1; }).length;
    app.innerHTML =
      '<div class="page-head"><a href="#/" class="back">‹ Jobs</a><span class="muted small">Customers</span></div>' +
      (all.length ? '<section class="card"><div class="stats">' + stat('Customers', all.length) + stat('Repeat customers', repeat) +
        stat('Collected (all time)', money0(lifetime)) + '</div></section>' +
        '<input type="search" class="search" data-customer-search placeholder="Search customers…" value="' + esc(customerSearch) + '">' : '') +
      '<div id="cust-list">' + (list.length ? list.map(function (c) {
        return '<a class="job-card" href="#/customer/' + encodeURIComponent(c.key) + '"><div class="job-main"><strong>' + esc(c.name || 'Customer') + '</strong>' +
          '<div class="muted small">' + esc(c.address || c.phone || c.email || '') + '</div>' +
          '<div class="job-tags"><span class="tag">' + c.jobs.length + (c.jobs.length === 1 ? ' job' : ' jobs') + '</span>' +
          (c.won > 1 ? '<span class="pill st-paid">⭐ Repeat</span>' : '') + '</div></div>' +
          '<div class="job-right"><div class="job-total">' + money0(c.collected) + '</div><div class="muted small">paid you</div></div></a>';
      }).join('') : '<div class="empty"><div class="empty-icon">👥</div><p>' + (all.length ? 'No customers match.' : 'No customers yet.') + '</p>' +
        (all.length ? '' : '<p class="muted small">Everyone you quote is saved here automatically, with their job history.</p>') + '</div>') + '</div>';
  }

  function renderCustomer(key) {
    var c = S.customersFrom(jobs, settings).find(function (x) { return x.key === key; });
    if (!c) { location.hash = '#/customers'; return; }
    var digits = String(c.phone || '').replace(/[^\d+]/g, '');
    app.innerHTML =
      '<div class="page-head"><a href="#/customers" class="back">‹ Customers</a><span class="muted small">' + c.jobs.length + ' jobs</span></div>' +
      '<section class="card"><h2 class="card-title" style="font-size:22px">' + esc(c.name || 'Customer') + '</h2>' +
      '<div class="muted">' + [c.address, c.phone, c.email].filter(Boolean).map(esc).join('<br>') + '</div>' +
      '<div class="contact-row">' +
      (digits ? '<a class="btn" href="tel:' + esc(digits) + '">📞 Call</a><a class="btn" href="sms:' + esc(digits) + '">💬 Text</a>' : '') +
      (c.email ? '<a class="btn" href="mailto:' + esc(c.email) + '">✉️ Email</a>' : '') +
      (c.address ? '<a class="btn" target="_blank" rel="noopener" href="https://maps.google.com/?q=' + encodeURIComponent(c.address) + '">📍 Map</a>' : '') +
      '</div></section>' +
      '<section class="card"><div class="stats">' + stat('Paid you', money0(c.collected)) + stat('Quoted', money0(c.quoted)) +
      stat('Jobs won', c.won + ' of ' + c.jobs.length) + '</div></section>' +
      '<button class="btn btn-primary btn-xl" data-action="quote-for" data-key="' + esc(c.key) + '">＋ New quote for ' + esc((c.name || 'customer').split(' ')[0]) + '</button>' +
      '<h2 class="section-title">Job history</h2>' +
      c.jobs.map(function (j) {
        return '<a class="job-card" href="#/job/' + j.id + '"><div class="job-main"><strong>' + esc(j.number) + (P.propertyLabel(j) ? ' · ' + esc(P.propertyLabel(j)) : '') + '</strong>' +
          '<div class="muted small">' + fmtDate(j.updatedAt) + '</div><div class="job-tags">' + statusPill(j) + '</div></div>' +
          '<div class="job-right"><div class="job-total">' + money0(P.calcJob(j, settings).total) + '</div></div></a>';
      }).join('');
  }

  function stat(label, value) {
    return '<div class="stat"><div class="muted small">' + label + '</div><div class="stat-v">' + value + '</div></div>';
  }

  // ---------- Business stats ----------
  function niceMax(v) {
    if (v <= 0) return 1000;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= v) return steps[i] * mag;
    return 10 * mag;
  }
  function axisMoney(v) {
    return v >= 10000 ? '$' + Math.round(v / 1000) + 'K' : '$' + v.toLocaleString('en-US');
  }

  // Single-series column chart: money collected each month.
  function monthChart(y) {
    var W = 340, H = 190, L = 44, R = 6, T = 18, B = 24;
    var max = niceMax(Math.max.apply(null, y.months.map(function (m) { return m.collected; })));
    var band = (W - L - R) / 12, bw = Math.min(16, band - 4);
    var yOf = function (v) { return T + (H - T - B) * (1 - v / max); };
    var names = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    var best = y.months.reduce(function (a, m) { return m.collected > a.collected ? m : a; }, y.months[0]);
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Money collected each month in ' + y.year + '">';
    [0, 0.5, 1].forEach(function (f) {
      var v = max * f, yy = yOf(v);
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="grid"/>' +
        '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" class="axis" text-anchor="end">' + axisMoney(v) + '</text>';
    });
    y.months.forEach(function (m, i) {
      var cx = L + band * i + band / 2, x = cx - bw / 2, top = yOf(m.collected), base = yOf(0);
      var h = base - top;
      if (m.collected > 0) {
        var r = Math.min(4, h);
        svg += '<path class="bar" d="M' + x + ' ' + base + 'V' + (top + r) + 'Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top +
          'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + top + ' ' + (x + bw) + ' ' + (top + r) + 'V' + base + 'Z"/>';
      }
      if (m === best && m.collected > 0) {
        svg += '<text x="' + cx + '" y="' + (top - 5) + '" class="cap" text-anchor="middle">' + axisMoney(Math.round(m.collected)) + '</text>';
      }
      svg += '<text x="' + cx + '" y="' + (H - 7) + '" class="axis" text-anchor="middle">' + names[i] + '</text>' +
        '<rect class="hit" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '" data-m="' + i + '"/>';
    });
    return svg + '</svg>';
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function insights(y) {
    var out = [];
    if (y.hoursAccuracy !== null) {
      out.push(y.hoursAccuracy > 5
        ? '⏱️ Jobs are taking <b>' + y.hoursAccuracy + '% longer</b> than estimated. Try lowering your work speeds in Settings so quotes cover your real time.'
        : y.hoursAccuracy < -5
          ? '⚡ You finish <b>' + Math.abs(y.hoursAccuracy) + '% faster</b> than estimated. You could quote more competitively, or enjoy the extra profit.'
          : '🎯 Your time estimates are spot on (within 5%).');
    }
    if (y.winRate !== null) {
      out.push(y.winRate < 30 ? '📉 You win <b>' + y.winRate + '%</b> of quotes. Following up 2–3 days after sending often lifts this.'
        : y.winRate > 70 ? '📈 You win <b>' + y.winRate + '%</b> of quotes. That high a rate can mean your prices have room to go up.'
          : '🤝 You win <b>' + y.winRate + '%</b> of quotes you send.');
    }
    if (y.outstanding > 0) out.push('💸 <b>' + money0(y.outstanding) + '</b> is still owed to you on won jobs.');
    if (y.estimatedJobs > 0) out.push('📝 ' + y.estimatedJobs + ' finished job' + (y.estimatedJobs > 1 ? 's use' : ' uses') +
      ' estimated costs. Enter real hours and materials for exact profit.');
    return out;
  }

  function renderStats(year) {
    var years = S.yearsWithData(jobs, expenses);
    if (years.indexOf(year) === -1) years.push(year), years.sort(function (a, b) { return b - a; });
    var y = S.yearStats(jobs, expenses, settings, year);
    var tips = insights(y);
    var yearExpenses = expenses.filter(function (e) { return e.date && +e.date.slice(0, 4) === year; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var cats = Object.keys(y.byCategory).sort(function (a, b) { return y.byCategory[b] - y.byCategory[a]; });

    app.innerHTML =
      '<div class="page-head"><a href="#/" class="back">‹ Jobs</a><span class="muted small">Business stats</span></div>' +
      '<div class="filter-tabs years">' + years.map(function (yr) {
        return '<a class="' + (yr === year ? 'on' : '') + '" href="#/stats/' + yr + '">' + yr + '</a>';
      }).join('') + '</div>' +

      '<section class="hero card"><div class="muted small">What you made in ' + year + '</div>' +
      '<div class="hero-num' + (y.made < 0 ? ' neg' : '') + '">' + money0(y.made) + '</div>' +
      '<div class="muted small">' + money0(y.collected) + ' collected − ' + money0(y.jobCosts) + ' job costs − ' + money0(y.overhead) + ' business expenses</div></section>' +

      '<section class="card"><div class="stats">' +
      stat('Collected', money0(y.collected)) + stat('Profit margin', y.margin + '%') +
      stat('Jobs done', y.jobsCompleted) + stat('Avg job', money0(y.avgJob)) +
      stat('Per hour', money0(y.perHour)) + stat('Win rate', y.winRate === null ? '—' : y.winRate + '%') +
      stat('Owed to you', money0(y.outstanding)) + stat('Waiting on', y.pipelineCount + ' <small>(' + money0(y.pipeline) + ')</small>') +
      stat('Upcoming jobs', y.upcoming) +
      '</div></section>' +

      '<section class="card"><h2 class="card-title">Money collected by month</h2>' +
      '<div class="chart-wrap">' + monthChart(y) + '<div class="tip" hidden></div></div>' +
      '<details class="table-view"><summary>Show as table</summary><table class="lines"><tbody>' +
      '<tr class="group"><td>Month</td><td class="amt">Collected</td><td class="amt">Costs</td><td class="amt">Made</td></tr>' +
      y.months.map(function (m) {
        return '<tr><td>' + MONTHS[m.month] + '</td><td class="amt">' + money0(m.collected) + '</td><td class="amt">' + money0(m.costs) +
          '</td><td class="amt">' + money0(m.made) + '</td></tr>';
      }).join('') + '</tbody></table></details></section>' +

      (tips.length ? '<section class="card"><h2 class="card-title">Insights</h2><ul class="insights">' +
        tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></section>' : '') +

      (Object.keys(y.byType).length > 1 ? '<section class="card"><h2 class="card-title">Where the money came from</h2>' +
        Object.keys(y.byType).map(function (k) {
          var pct = y.collected ? Math.round(y.byType[k] / y.collected * 100) : 0;
          return '<div class="split"><span>' + k + '</span><div class="split-bar"><i style="width:' + pct + '%"></i></div><span>' + money0(y.byType[k]) + ' · ' + pct + '%</span></div>';
        }).join('') + '</section>' : '') +

      '<section class="card"><h2 class="card-title">Business expenses <em class="muted small">(' + money0(y.overhead) + ')</em></h2>' +
      '<p class="muted small" style="margin-top:0">Costs not tied to one job: gas, tools, insurance, ads… They come off your yearly profit.</p>' +
      '<div class="expense-form"><input type="date" id="ex-date" value="' + (year === new Date().getFullYear() ? today() : year + '-12-31') + '" aria-label="Date">' +
      '<input id="ex-label" placeholder="What was it?" aria-label="Description">' +
      '<select id="ex-cat" aria-label="Category">' + S.EXPENSE_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>' +
      '<div class="with-unit pre"><em>$</em><input id="ex-amount" type="number" inputmode="decimal" min="0" step="any" placeholder="0" aria-label="Amount"></div>' +
      '<button type="button" class="btn btn-primary" data-action="add-expense">Add</button></div>' +
      (cats.length ? '<div class="cat-list">' + cats.map(function (c) { return '<span class="tag">' + esc(c) + ' ' + money0(y.byCategory[c]) + '</span>'; }).join(' ') + '</div>' : '') +
      (yearExpenses.length ? '<table class="lines expenses"><tbody>' + yearExpenses.map(function (e) {
        return '<tr><td>' + esc(e.label || e.category) + '<div class="muted small">' + esc(fmtShort(e.date)) + ' · ' + esc(e.category) + '</div></td>' +
          '<td class="amt">' + money(e.amount) + '<button type="button" class="icon-btn sm" data-action="del-expense" data-id="' + e.id + '" aria-label="Delete expense">✕</button></td></tr>';
      }).join('') + '</tbody></table>' : '') + '</section>' +

      '<section class="card"><h2 class="card-title">Export for your accountant</h2>' +
      '<p class="muted small" style="margin-top:0">Spreadsheets that open in Excel, Google Sheets or Numbers. Handy at tax time.</p>' +
      '<div class="actions"><button class="btn" data-action="export" data-v="jobs">📄 Jobs</button>' +
      '<button class="btn" data-action="export" data-v="payments">💵 Payments</button>' +
      '<button class="btn" data-action="export" data-v="expenses">🧾 Expenses</button>' +
      '<a class="btn" href="#/settings">🔒 Backup</a></div></section>';

    wireChart(y);
  }

  function wireChart(y) {
    var wrap = app.querySelector('.chart-wrap');
    if (!wrap) return;
    var tip = wrap.querySelector('.tip');
    function show(e) {
      var r = e.target.closest('.hit');
      if (!r) return;
      var m = y.months[+r.dataset.m];
      app.querySelectorAll('.hit.on').forEach(function (h) { h.classList.remove('on'); });
      r.classList.add('on');
      tip.innerHTML = '<strong>' + MONTHS[m.month] + '</strong><br>Collected ' + money0(m.collected) +
        '<br>Costs ' + money0(m.costs) + '<br>Made ' + money0(m.made);
      var box = wrap.getBoundingClientRect(), rb = r.getBoundingClientRect();
      tip.hidden = false;
      var left = rb.left - box.left + rb.width / 2 - tip.offsetWidth / 2;
      tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth, left)) + 'px';
    }
    wrap.addEventListener('pointerover', show);
    wrap.addEventListener('click', show);
    wrap.addEventListener('pointerleave', function () {
      tip.hidden = true;
      app.querySelectorAll('.hit.on').forEach(function (h) { h.classList.remove('on'); });
    });
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function backupData() {
    return JSON.stringify({ app: 'Coatwright', version: 1, exportedAt: new Date().toISOString(),
      settings: settings, jobs: jobs, expenses: expenses }, null, 1);
  }

  // ---------- Settings ----------
  function setField(key, label, opts) {
    opts = opts || {};
    var v = settings[key];
    var input = opts.textarea
      ? '<textarea data-setting="' + key + '" rows="4">' + esc(v) + '</textarea>'
      : '<input data-setting="' + key + '" type="' + (opts.type || 'text') + '"' +
        (opts.type === 'number' ? ' inputmode="decimal" min="0" step="any"' : '') +
        (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + ' value="' + esc(v) + '">';
    if (opts.pre || opts.unit) {
      input = '<div class="with-unit' + (opts.pre ? ' pre' : '') + '">' + (opts.pre ? '<em>' + opts.pre + '</em>' : '') + input +
        (opts.unit ? '<em>' + opts.unit + '</em>' : '') + '</div>';
    }
    return '<label class="field"><span>' + label + '</span>' + input + (opts.hint ? '<small class="muted">' + opts.hint + '</small>' : '') + '</label>';
  }

  function renderSettings() {
    app.innerHTML =
      '<div class="page-head"><a href="#/" class="back">‹ Quotes</a><span class="muted small" id="saved">Changes save automatically</span></div>' +
      '<section class="card"><h2 class="card-title">Your business</h2>' +
      '<div class="logo-row">' + (settings.logo ? '<img src="' + esc(settings.logo) + '" alt="Logo" class="logo">' : '<div class="logo placeholder">Logo</div>') +
      '<label class="btn btn-ghost">' + (settings.logo ? 'Change logo' : 'Add logo') + '<input type="file" accept="image/*" id="logo-input" hidden></label>' +
      (settings.logo ? '<button class="link danger" data-action="remove-logo">Remove</button>' : '') + '</div>' +
      setField('businessName', 'Business name', { placeholder: 'Smith Painting LLC' }) +
      setField('ownerName', 'Your name', { placeholder: 'John Smith' }) +
      '<div class="row2">' + setField('phone', 'Phone', { type: 'tel' }) + setField('email', 'Email', { type: 'email' }) + '</div>' +
      setField('website', 'Website (optional)') + '</section>' +

      '<section class="card"><h2 class="card-title">Your prices</h2>' +
      '<div class="row2">' + setField('laborRate', 'Labor rate', { type: 'number', pre: '$', unit: '/hr', hint: 'What an hour of painting is worth' }) +
      setField('markup', 'Markup', { type: 'number', unit: '%', hint: 'Overhead & profit added on top' }) + '</div>' +
      '<div class="row2">' + setField('minimumJob', 'Minimum job', { type: 'number', pre: '$' }) +
      setField('depositPct', 'Deposit', { type: 'number', unit: '%' }) + '</div>' +
      '<div class="row2">' + setField('taxRate', 'Sales tax', { type: 'number', unit: '%' }) +
      setField('validDays', 'Quote valid for', { type: 'number', unit: 'days' }) + '</div></section>' +

      '<section class="card"><h2 class="card-title">Paint cost <em class="muted small">(what you pay per gallon)</em></h2>' +
      '<div class="row2">' + setField('wallPaintPrice', 'Wall paint', { type: 'number', pre: '$' }) +
      setField('ceilingPaintPrice', 'Ceiling paint', { type: 'number', pre: '$' }) + '</div>' +
      '<div class="row2">' + setField('trimPaintPrice', 'Trim paint', { type: 'number', pre: '$' }) +
      setField('primerPrice', 'Primer', { type: 'number', pre: '$' }) + '</div>' +
      setField('suppliesPct', 'Supplies (tape, plastic, caulk…)', { type: 'number', unit: '% of paint' }) + '</section>' +

      '<section class="card"><h2 class="card-title">Exterior & floor products <em class="muted small">(your cost)</em></h2>' +
      '<div class="row2">' + setField('extPaintPrice', 'Exterior paint', { type: 'number', pre: '$', unit: '/gal' }) +
      setField('stainPrice', 'Deck & fence stain', { type: 'number', pre: '$', unit: '/gal' }) + '</div>' +
      '<div class="row2">' + setField('floorPaintPrice', 'Floor paint', { type: 'number', pre: '$', unit: '/gal' }) +
      setField('epoxySqft', 'Epoxy kit', { type: 'number', pre: '$', unit: '/sq ft' }) + '</div>' +
      '<div class="row2">' + setField('flakeSqft', 'Epoxy + flake kit', { type: 'number', pre: '$', unit: '/sq ft' }) +
      setField('cabinetPaintPrice', 'Cabinet enamel', { type: 'number', pre: '$', unit: '/gal' }) + '</div></section>' +

      '<details class="card"><summary class="card-title">How fast you work <em class="muted small">(advanced)</em></summary>' +
      '<p class="muted small">Per coat, for one painter. The defaults suit most painters — adjust once you\'ve timed a few jobs.</p>' +
      '<div class="row2">' + setField('wallRate', 'Walls', { type: 'number', unit: 'sq ft/hr' }) +
      setField('ceilingRate', 'Ceilings', { type: 'number', unit: 'sq ft/hr' }) + '</div>' +
      '<div class="row2">' + setField('trimRate', 'Trim', { type: 'number', unit: 'ft/hr' }) +
      setField('doorHours', 'Each door', { type: 'number', unit: 'hrs' }) + '</div>' +
      '<div class="row2">' + setField('coverage', 'Paint coverage', { type: 'number', unit: 'sq ft/gal' }) +
      setField('setupHours', 'Prep & cleanup', { type: 'number', unit: 'hrs/room' }) + '</div>' +
      '<div class="row2">' + setField('extWallRate', 'Exterior siding', { type: 'number', unit: 'sq ft/hr' }) +
      setField('deckRate', 'Decks', { type: 'number', unit: 'sq ft/hr' }) + '</div>' +
      '<div class="row2">' + setField('fenceRate', 'Fences', { type: 'number', unit: 'sq ft/hr' }) +
      setField('floorRate', 'Floor paint', { type: 'number', unit: 'sq ft/hr' }) + '</div>' +
      '<div class="row2">' + setField('cabinetDoorHours', 'Each cabinet door', { type: 'number', unit: 'hrs' }) + '</div></details>' +

      '<section class="card"><h2 class="card-title">Quote fine print</h2>' +
      setField('terms', 'Terms shown on every quote', { textarea: true }) + '</section>' +
      '<section class="card"><h2 class="card-title">Invoices</h2>' +
      setField('invoiceDueDays', 'Payment due', { type: 'number', unit: 'days', hint: '0 = due on receipt' }) +
      setField('paymentInstructions', 'How customers can pay you', { textarea: true }) + '</section>' +
      '<section class="card"><h2 class="card-title">🔒 Your data</h2>' +
      '<p class="muted small" style="margin-top:0">Your jobs, customers and money stay private on this device. Nothing is sent anywhere. ' +
      'Make a backup now and then (and before switching phones) so your history is never lost.' +
      (settings.lastBackup ? ' Last backup: <b>' + esc(fmtDate(settings.lastBackup)) + '</b>.' : ' <b>No backup yet.</b>') + '</p>' +
      '<div class="actions"><button class="btn btn-primary" data-action="backup">⬇️ Back up now</button>' +
      '<label class="btn">⬆️ Restore<input type="file" accept=".json,application/json" id="restore-input" hidden></label></div>' +
      '<p class="muted small">' + jobs.length + ' jobs · ' + expenses.length + ' expenses saved.</p></section>' +
      '<button class="link danger center" data-action="reset-settings">Reset prices to defaults</button>' +
      '<p class="center-text muted small"><a href="#/welcome/1">Run setup again</a> · <a href="../privacy.html">Privacy Policy</a> · <a href="../terms.html">Terms</a></p>';

    var input = document.getElementById('logo-input');
    if (input) input.addEventListener('change', onLogo);
    var restore = document.getElementById('restore-input');
    if (restore) restore.addEventListener('change', onRestore);
  }

  function onLogo(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 240, scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        settings.logo = canvas.toDataURL('image/png');
        saveSettings();
        route();
        toast('Logo saved');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function onRestore(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { data = null; }
      if (!data || data.app !== 'Coatwright' || !Array.isArray(data.jobs)) {
        toast('That file is not a Coatwright backup');
        return;
      }
      if (!confirm('Restore ' + data.jobs.length + ' jobs from ' + (data.exportedAt || 'this backup').slice(0, 10) +
        '? This replaces what is on this device now.')) return;
      settings = Object.assign({}, P.DEFAULT_SETTINGS, data.settings || {});
      jobs = data.jobs;
      expenses = Array.isArray(data.expenses) ? data.expenses : [];
      saveSettings(); saveJobs(); saveExpenses();
      toast('Backup restored');
      renderSettings();
    };
    reader.readAsText(file);
  }

  // ---------- Events ----------
  app.addEventListener('input', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-home-search')) {
      homeSearch = el.value;
      document.getElementById('job-list').innerHTML = jobCards();
      return;
    }
    if (el.hasAttribute('data-customer-search')) {
      customerSearch = el.value;
      renderCustomers();
      var cs = app.querySelector('[data-customer-search]');
      cs.focus(); cs.setSelectionRange(cs.value.length, cs.value.length);
      return;
    }
    if (el.dataset.schedule) {
      var sj = findJob(el.dataset.schedule);
      if (sj && el.value) {
        sj.startDate = el.value;
        if (S.statusOf(sj) === 'won') S.setStatus(sj, 'scheduled');
        touch(sj);
        renderSchedule();
        toast('Scheduled for ' + fmtShort(el.value));
      }
      return;
    }
    if (el.dataset.setting) {
      var key = el.dataset.setting;
      settings[key] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      saveSettings();
      var s = document.getElementById('saved');
      if (s) s.textContent = 'Saved ✓';
      return;
    }
    var job = currentJob();
    if (!job || !el.dataset.field) return;
    var path = el.dataset.field;
    var val = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    setPath(job, path, val);
    // Picking a past customer's name fills in their details
    if (path === 'customer.name' && val) {
      var match = S.customersFrom(jobs.filter(function (x) { return x !== job; }), settings)
        .find(function (c) { return c.name && c.name.toLowerCase() === String(val).toLowerCase(); });
      if (match) {
        ['phone', 'email', 'address'].forEach(function (f) {
          if (!job.customer[f] && match[f]) {
            job.customer[f] = match[f];
            var inp = app.querySelector('[data-field="customer.' + f + '"]');
            if (inp) inp.value = match[f];
          }
        });
      }
    }
    var om = path.match(/^outside\.(\d+)\.(length|width)$/);
    if (om && job.outside[+om[1]].size && job.outside[+om[1]].size !== 'custom') {
      job.outside[+om[1]].size = 'custom';
      el.closest('.out-card').querySelectorAll('[data-action="o-size"]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === 'custom'); });
    }
    // Typing exact dimensions switches the size to "Exact"
    var m = path.match(/^rooms\.(\d+)\.(length|width)$/);
    if (m) {
      var room = job.rooms[+m[1]];
      if (room.size !== 'custom') {
        room.size = 'custom';
        var card = el.closest('.room-card');
        card.querySelectorAll('[data-action="size"]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === 'custom'); });
      }
    }
    if (path === 'startDate' && val && S.statusOf(job) === 'won') {
      S.setStatus(job, 'scheduled');
      touch(job); renderJob(job);
      toast('Scheduled 📅');
      return;
    }
    touch(job);
    refreshTotals(job);
  });

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;
    var job = currentJob();
    var i = el.dataset.i != null ? +el.dataset.i : null;

    switch (action) {
      case 'wz-skip':
        settings.onboarded = true; saveSettings();
        location.hash = '#/';
        return;
      case 'wz-next':
        if (el.dataset.v === '2' && !String(settings.businessName || '').trim()) {
          toast('Add your business name to continue');
          var bn = app.querySelector('[data-setting="businessName"]'); if (bn) bn.focus();
          return;
        }
        location.hash = '#/welcome/' + el.dataset.v;
        return;
      case 'preset': {
        var pr = RATE_PRESETS.find(function (x) { return x.id === el.dataset.v; });
        if (pr) { settings.laborRate = pr.laborRate; settings.markup = pr.markup; settings.minimumJob = pr.minimumJob; saveSettings(); }
        renderWelcome(2);
        return;
      }
      case 'install':
        if (installPrompt) { installPrompt.prompt(); installPrompt = null; renderWelcome(3); }
        return;
      case 'wz-finish':
        settings.onboarded = true; saveSettings();
        if (el.dataset.v === 'sample') { location.hash = '#/quote/' + createSampleJob().id; toast('Here\'s a sample. Tap ‹ Edit to change it'); }
        else location.hash = '#/new';
        return;
      case 'filter':
        homeFilter = el.dataset.v;
        renderHome();
        return;
      case 'status': {
        var prev = S.statusOf(job);
        S.setStatus(job, el.dataset.v);
        touch(job); renderJob(job);
        if (S.isWon(job) && ['draft', 'sent', 'lost'].indexOf(prev) !== -1) toast('🎉 Won! Log payments and real costs below');
        else toast('Marked as ' + S.statusInfo(job.status).label);
        return;
      }
      case 'add-payment': {
        var owed = S.balance(job, settings);
        job.payments.push({ id: uid(), date: today(), amount: owed || '', method: 'Check' });
        touch(job); renderJob(job);
        var amts = app.querySelectorAll('.pay-row input[type=number]');
        if (amts.length) amts[amts.length - 1].focus();
        return;
      }
      case 'del-payment':
        job.payments.splice(i, 1);
        touch(job); renderJob(job);
        return;
      case 'add-expense': {
        var amt = parseFloat(document.getElementById('ex-amount').value);
        var date = document.getElementById('ex-date').value;
        if (!(amt > 0) || !date) { toast('Enter a date and an amount'); return; }
        expenses.push({ id: uid(), date: date, label: document.getElementById('ex-label').value.trim(),
          category: document.getElementById('ex-cat').value, amount: amt });
        saveExpenses();
        renderStats(+date.slice(0, 4));
        toast('Expense added');
        return;
      }
      case 'del-expense': {
        var ex = expenses.find(function (x) { return x.id === el.dataset.id; });
        if (!ex || !confirm('Delete this expense?')) return;
        expenses = expenses.filter(function (x) { return x !== ex; });
        saveExpenses();
        renderStats(+ex.date.slice(0, 4));
        return;
      }
      case 'export': {
        var kind = el.dataset.v, stamp = today();
        if (kind === 'jobs') download('coatwright-jobs-' + stamp + '.csv', S.jobsCsv(jobs, settings));
        else if (kind === 'payments') download('coatwright-payments-' + stamp + '.csv', S.paymentsCsv(jobs));
        else download('coatwright-expenses-' + stamp + '.csv', S.expensesCsv(expenses));
        toast('Spreadsheet downloaded');
        return;
      }
      case 'backup':
        download('coatwright-backup-' + today() + '.json', backupData(), 'application/json');
        settings.lastBackup = Date.now(); saveSettings();
        renderSettings();
        toast('Backup saved — keep it somewhere safe (email it to yourself)');
        return;
      case 'new-job':
        location.hash = '#/new';
        return;
      case 'quote-for': {
        var cust = S.customersFrom(jobs, settings).find(function (x) { return x.key === el.dataset.key; });
        if (cust) pendingCustomer = { name: cust.name, phone: cust.phone, email: cust.email, address: cust.address };
        location.hash = '#/new';
        return;
      }
      case 'create-job':
        location.hash = '#/job/' + newJob(el.dataset.type, el.dataset.prop).id;
        return;
      case 'jobtype':
        if (job.jobType === el.dataset.v) return;
        job.jobType = el.dataset.v;
        job.propertyType = P.JOB_TYPES[job.jobType].properties[0].id;
        touch(job); renderJob(job);
        return;
      case 'prop':
        if (!job.jobType) job.jobType = 'residential';
        job.propertyType = el.dataset.v;
        touch(job); renderJob(job);
        return;
      case 'mode':
        job.mode = el.dataset.v;
        touch(job); renderJob(job);
        if (job.mode === 'quick') {
          var sq = app.querySelector('[data-field="quick.sqft"]');
          if (sq && !sq.value) sq.focus();
        }
        return;
      case 'q-surface':
        job.quick.surfaces[el.dataset.v] = !job.quick.surfaces[el.dataset.v];
        touch(job); renderJob(job);
        return;
      case 'q-seg': {
        var qf = el.dataset.field;
        job.quick[qf] = qf === 'condition' ? el.dataset.v : +el.dataset.v;
        touch(job); renderJob(job);
        return;
      }
      case 'add-out': {
        var oi = P.newOutside(P.OUTSIDE_TYPES[+el.dataset.k], job);
        job.outside.push(oi);
        touch(job); renderJob(job);
        var oc = app.querySelectorAll('.out-card');
        oc[oc.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast(oi.name + ' added');
        return;
      }
      case 'del-out':
        if (!confirm('Remove ' + job.outside[i].name + '?')) return;
        job.outside.splice(i, 1);
        touch(job); renderJob(job);
        return;
      case 'o-seg': {
        var of = el.dataset.field, ov = el.dataset.v;
        job.outside[i][of] = ['siding', 'system', 'condition', 'size', 'method', 'retexture'].indexOf(of) !== -1 ? ov
          : of === 'insides' ? ov === '1' : +ov;
        touch(job); renderJob(job);
        return;
      }
      case 'o-surface':
        job.outside[i].surfaces[el.dataset.v] = !job.outside[i].surfaces[el.dataset.v];
        touch(job); renderJob(job);
        return;
      case 'o-step': {
        var it2 = job.outside[i], f2 = el.dataset.field;
        it2[f2] = Math.max(0, (Math.round(Number(it2[f2])) || 0) + Number(el.dataset.d));
        el.parentNode.querySelector('output').textContent = it2[f2];
        touch(job); refreshTotals(job);
        return;
      }
      case 'o-size': {
        var it3 = job.outside[i], g = P.GARAGE_SIZES[el.dataset.v];
        it3.size = el.dataset.v;
        if (g) { it3.length = g.length; it3.width = g.width; }
        touch(job); renderJob(job);
        return;
      }
      case 'add-room': {
        var room = P.newRoom(P.roomTypesFor(job.jobType, job.propertyType)[+el.dataset.k]);
        var same = job.rooms.filter(function (r) { return r.name.indexOf(room.name) === 0; }).length;
        if (same) room.name += ' ' + (same + 1);
        job.rooms.push(room);
        touch(job); renderJob(job);
        var cards = app.querySelectorAll('.room-card');
        cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast(room.name + ' added');
        return;
      }
      case 'dup-room': {
        var copy = JSON.parse(JSON.stringify(job.rooms[i]));
        copy.id = uid(); copy.name += ' (copy)';
        job.rooms.splice(i + 1, 0, copy);
        touch(job); renderJob(job);
        return;
      }
      case 'del-room':
        if (!confirm('Remove ' + job.rooms[i].name + '?')) return;
        job.rooms.splice(i, 1);
        touch(job); renderJob(job);
        return;
      case 'size': {
        var r = job.rooms[i], v = el.dataset.v;
        r.size = v;
        if (P.SIZES[v]) { r.length = P.SIZES[v].length; r.width = P.SIZES[v].width; }
        touch(job); renderJob(job);
        return;
      }
      case 'surface':
        job.rooms[i].surfaces[el.dataset.v] = !job.rooms[i].surfaces[el.dataset.v];
        touch(job); renderJob(job);
        return;
      case 'seg': {
        var f = el.dataset.field;
        job.rooms[i][f] = f === 'coats' ? +el.dataset.v : el.dataset.v;
        touch(job); renderJob(job);
        return;
      }
      case 'step': {
        var field = el.dataset.field;
        var n = Math.max(0, (Number(job.rooms[i][field]) || 0) + Number(el.dataset.d));
        job.rooms[i][field] = n;
        var out = app.querySelector('[data-out="rooms.' + i + '.' + field + '"]');
        if (out) out.textContent = n;
        touch(job); refreshTotals(job);
        return;
      }
      case 'add-extra':
        job.extras.push({ label: '', price: '' });
        touch(job); renderJob(job);
        var rows = app.querySelectorAll('.extra-row input');
        if (rows.length) rows[rows.length - 2].focus();
        return;
      case 'del-extra':
        job.extras.splice(i, 1);
        touch(job); renderJob(job);
        return;
      case 'del-job':
        if (!confirm('Delete this quote? This cannot be undone.')) return;
        jobs = jobs.filter(function (j) { return j !== job; });
        saveJobs();
        location.hash = '#/';
        return;
      case 'remove-logo':
        settings.logo = ''; saveSettings(); renderSettings();
        return;
      case 'reset-settings': {
        if (!confirm('Reset all prices and rates to the defaults? Your business info is kept.')) return;
        var keep = ['businessName', 'ownerName', 'phone', 'email', 'website', 'logo', 'nextNumber', 'terms'];
        var fresh = Object.assign({}, P.DEFAULT_SETTINGS);
        keep.forEach(function (k) { fresh[k] = settings[k]; });
        settings = fresh; saveSettings(); renderSettings(); toast('Prices reset');
        return;
      }
    }

    // Quote actions
    var hparts = location.hash.split('/');
    var qjob = findJob(hparts[2]);
    if (!qjob || (hparts[1] !== 'quote' && hparts[1] !== 'invoice')) return;
    var kind = hparts[1] === 'invoice' ? 'invoice' : 'quote';
    var q = P.calcJob(qjob, settings);
    var text = quoteText(qjob, q, kind);
    var subject = (kind === 'invoice' ? 'Invoice ' + invoiceNumber(qjob) : 'Painting estimate ' + qjob.number) +
      (settings.businessName ? ' from ' + settings.businessName : '');
    if (kind === 'quote' && ['email', 'share', 'print', 'copy'].indexOf(action) !== -1 && S.statusOf(qjob) === 'draft') {
      S.setStatus(qjob, 'sent');
      saveJobs();
      setTimeout(function () { toast('Marked as Sent 📨'); }, 2400);
    }
    if (action === 'email') {
      location.href = 'mailto:' + encodeURIComponent(qjob.customer.email || '') +
        '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    } else if (action === 'share') {
      if (navigator.share) navigator.share({ title: subject, text: text }).catch(function () {});
      else copyText(text);
    } else if (action === 'print') {
      toast('Choose "Save as PDF" as the printer');
      setTimeout(function () { window.print(); }, 300);
    } else if (action === 'copy') {
      copyText(text);
    }
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Quote copied — paste it anywhere'); },
        function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Quote copied'); } catch (e) { toast('Copy not supported'); }
    ta.remove();
  }

  route();
})();
