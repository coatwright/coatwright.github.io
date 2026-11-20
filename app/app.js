/* Coatwright UI — plain JavaScript, no build step. */
(function () {
  'use strict';

  var P = window.Pricing;
  var S = window.Stats;
  var BL = window.Billing, BC = BL.BILLING;
  var AC = window.Account, CFG = window.CW_CONFIG || {};
  var CUR = window.Currency;
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
  // Currency is chosen once and saved, so it never changes when the painter travels. Existing users had dollars.
  if (!settings.currency) {
    var cur0 = (settings.onboarded || jobs.length) ? 'USD' : CUR.detect(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
    settings = CUR.convertSettings(settings, 'USD', cur0); // new painters abroad start from local prices, converted once
    save('pq.settings', settings);
  }
  if (!settings.trialStart) { settings.trialStart = Date.now(); save('pq.settings', settings); }
  var wantsInstall = /[?&]install=1/.test(location.search);
  var session = load('pq.session', null);
  var signin = { step: 'start', email: '', busy: false, error: '' };
  function accountsOn() { return !!(CFG.accounts && AC && CFG.supabaseUrl && CFG.supabaseKey); }
  function signedIn() { return !!(settings.account && settings.account.id && session && session.refreshToken); }
  function appUrl() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }
  function access() { return BL.accessState(settings, Date.now(), BC); }
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; });
  var homeFilter = 'all', homeSearch = '', customerSearch = '', pendingCustomer = null;

  function saveSettings() { save('pq.settings', settings); if (syncReady()) { noteSettings(); changed(); } }
  function saveJobs() { if (syncReady()) stampJobs(); save('pq.jobs', jobs); if (syncReady()) changed(); }
  function saveExpenses() { save('pq.expenses', expenses); if (syncReady()) changed(); }

  // ---------- Cloud backup & sync ----------
  // Jobs, customers, expenses and settings are saved to the painter's account and merged across devices (see sync.js).
  // The device keeps working offline; changes upload when it's back online. Off until CW_CONFIG.sync is true.
  var CS = window.CloudSync;
  var syncMeta = load('pq.sync', null) || {}; // { owner, ownerEmail, settingsAt, settingsHash, deleted, lastSync, declined }
  var sync = { busy: null, timer: null, again: false, off: false, error: '', rev: 0 };
  var jobSigs = {};
  function syncReady() { return !!(CFG.sync && CS); }
  function syncOn() { return syncReady() && accountsOn() && signedIn() && !sync.off && syncMeta.declined !== settings.account.id; }
  function saveMeta() { save('pq.sync', syncMeta); }
  function rememberJobs() { jobSigs = {}; jobs.forEach(function (j) { jobSigs[j.id] = CS.itemHash(j); }); }
  /** Stamp jobs that changed since last time, so the newest copy wins on every device. */
  function stampJobs() {
    var now = Date.now();
    jobs.forEach(function (j) {
      var h = CS.itemHash(j);
      if (jobSigs[j.id] !== h) { if (jobSigs[j.id] !== undefined) j.syncAt = now; jobSigs[j.id] = h; }
    });
  }
  /** Remember when the synced part of settings last changed. */
  function noteSettings() {
    var h = CS.hash(CS.syncedSettings(settings));
    if (syncMeta.settingsHash === h) return;
    if (syncMeta.settingsHash) syncMeta.settingsAt = Date.now();
    syncMeta.settingsHash = h; saveMeta();
  }
  function forget(kind, id) {
    if (!syncReady()) return;
    syncMeta.deleted = syncMeta.deleted || { jobs: {}, expenses: {} };
    syncMeta.deleted[kind] = syncMeta.deleted[kind] || {};
    syncMeta.deleted[kind][id] = Date.now(); saveMeta();
  }
  function changed() { sync.rev++; scheduleSync(); }
  function scheduleSync(delay) {
    if (!syncOn()) return;
    clearTimeout(sync.timer);
    sync.timer = setTimeout(function () { sync.timer = null; runSync(); }, delay == null ? 2500 : delay);
  }
  function editing() {
    var a = document.activeElement;
    return !!(a && app.contains(a) && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' ||
      (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file)$/.test(a.type))));
  }
  function freshSession() {
    return AC.needsRefresh(session) ? AC.refresh(CFG, session).then(function (s) { session = s; save('pq.session', session); }) : Promise.resolve();
  }
  function localOnlySettings() {
    var keep = {};
    CS.LOCAL_ONLY.forEach(function (k) { if (k in settings) keep[k] = settings[k]; });
    return keep;
  }
  /** Pull the account's copy, merge, save back (version-checked), and update this device. Resolves true when in sync. */
  function runSync(manual) {
    if (!syncOn() || navigator.onLine === false) return Promise.resolve(false);
    if (sync.busy) { sync.again = true; return sync.busy; }
    if (!manual && editing()) { scheduleSync(4000); return Promise.resolve(false); } // never swap data under someone typing
    var uid = settings.account.id;
    sync.busy = freshSession().then(function () { return attempt(0); })
      .then(function (ok) { sync.error = ''; return ok; }, function (e) {
        if (e && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01')) sync.off = true; // database not set up yet
        else sync.error = friendlyAuthError(e);
        return false;
      })
      .then(function (ok) {
        sync.busy = null;
        if (sync.again) { sync.again = false; scheduleSync(800); }
        showSyncNote();
        return ok;
      });
    return sync.busy;

    function attempt(n) {
      var rev = sync.rev;
      return AC.getUserData(CFG, session).then(function (row) {
        if (!signedIn() || settings.account.id !== uid) return false;
        var remote = row && row.data && row.data.v ? row.data : null;
        if (syncMeta.owner && syncMeta.owner !== uid && !otherAccount(remote)) return false;
        var firstHere = syncMeta.owner !== uid;
        var local = { settings: settings, settingsAt: firstHere && remote ? -1 : (syncMeta.settingsAt || 0), // first sync on this device: the account's settings win
          jobs: jobs, expenses: expenses, deleted: syncMeta.deleted };
        var m = CS.merge(local, remote);
        m.doc.deleted = CS.pruneTombstones(m.doc.deleted);
        var put = !m.changedRemote ? Promise.resolve(row)
          : row ? AC.updateUserData(CFG, session, m.doc, row.version)
            : AC.insertUserData(CFG, session, m.doc).catch(function (e) { if (e.status === 409) return null; throw e; });
        return put.then(function (saved) {
          if (!saved) { // another device saved first: merge again with its copy
            if (n >= 3) throw new Error('Another device is saving right now. We\'ll try again shortly.');
            return attempt(n + 1);
          }
          if (sync.rev !== rev) { sync.again = true; return true; } // edited while saving: merge again in a moment
          applyMerge(m, uid);
          return true;
        });
      });
    }
  }
  /** This device holds another account's data: ask before replacing it (that account keeps its own cloud copy). */
  function otherAccount(remote) {
    var hasData = jobs.length || expenses.length;
    if (hasData && !confirm('This device has jobs from another Coatwright account' + (syncMeta.ownerEmail ? ' (' + syncMeta.ownerEmail + ')' : '') +
      '.\n\nReplace them with the jobs saved in ' + settings.account.email + '? The other account\'s jobs stay saved in that account.')) {
      syncMeta.declined = settings.account.id; saveMeta(); return false;
    }
    var keep = localOnlySettings();
    settings = Object.assign({}, P.DEFAULT_SETTINGS, remote ? {} : { currency: settings.currency }, keep);
    jobs = []; expenses = [];
    syncMeta = {};
    save('pq.settings', settings); save('pq.jobs', jobs); save('pq.expenses', expenses); saveMeta();
    rememberJobs();
    return true;
  }
  function applyMerge(m, uid) {
    if (m.changedLocal) {
      settings = Object.assign({}, P.DEFAULT_SETTINGS, m.settings, localOnlySettings());
      jobs = m.jobs; expenses = m.expenses;
      save('pq.settings', settings); save('pq.jobs', jobs); save('pq.expenses', expenses);
      rememberJobs();
    }
    syncMeta.owner = uid; syncMeta.ownerEmail = settings.account.email; delete syncMeta.declined;
    syncMeta.settingsAt = m.settingsAt; syncMeta.settingsHash = CS.hash(CS.syncedSettings(settings));
    syncMeta.deleted = m.doc.deleted; syncMeta.lastSync = Date.now(); saveMeta();
    if (m.changedLocal && location.hash.indexOf('#/signin') !== 0 && !editing()) {
      if (settings.onboarded && /^#\/welcome/.test(location.hash)) location.hash = '#/';
      else if (document.body.dataset.view === 'takeoff') { if (findJob(to.jobId)) { toRefresh(true); if (to.viewer) to.viewer.draw(); } else route(); }
      else route();
    }
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    return fmtDate(ts);
  }
  function syncNote() {
    if (sync.off) return 'Cloud backup isn\'t available right now.';
    if (syncMeta.declined && settings.account && syncMeta.declined === settings.account.id) return 'Paused: this device holds another account\'s jobs.';
    if (sync.busy) return 'Saving to your account…';
    if (navigator.onLine === false) return 'Offline. Changes are saved on this device and upload when you\'re back online.';
    if (sync.error) return 'Couldn\'t reach your account: ' + sync.error;
    return syncMeta.lastSync && syncMeta.owner === (settings.account && settings.account.id) ? 'Last saved to your account ' + ago(syncMeta.lastSync) + '.' : 'Not saved to your account yet.';
  }
  function showSyncNote() { var n = document.getElementById('sync-note'); if (n) n.textContent = syncNote(); }
  /** One line on where data lives, for onboarding and plan screens. */
  function dataPromise(short) {
    if (syncReady() && accountsOn()) return short ? 'Your data is backed up privately to your account' : 'Your data is backed up privately to your account and works offline.';
    return short ? 'Your data stays private on your device' : 'Your data stays private on this device.';
  }
  if (syncReady()) {
    rememberJobs();
    if (!syncMeta.settingsHash) { syncMeta.settingsHash = CS.hash(CS.syncedSettings(settings)); saveMeta(); }
    window.addEventListener('online', function () { scheduleSync(500); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') scheduleSync(300);
      else if (sync.timer) { clearTimeout(sync.timer); sync.timer = null; runSync(true); } // leaving the app: save now
    });
  }
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
    return CUR.format(v, settings.currency, 2);
  }
  function money0(n) {
    var v = Math.round(Number(n) || 0);
    return CUR.format(v, settings.currency, 0);
  }
  /** Currency sign for input fields, e.g. '$' or '£'. */
  function sym() { return CUR.symbol(settings.currency); }
  /** Coatwright's own prices are in US dollars; say so to painters who use another currency. */
  function usd(n) { return (settings.currency === 'USD' ? '$' : 'US$') + n; }
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
      actuals: {},
      paintByOrder: true, // paint priced per brand/type/sheen/colour (older jobs keep their original totals)
      paintPrices: {}
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
    if (accountsOn() && !signedIn() && view !== 'signin') { location.hash = '#/signin'; return; }
    if (view === 'signin') { if (!accountsOn() || signedIn()) { location.hash = '#/'; return; } renderSignin(); return; }
    if ((view === 'job' || view === 'quote' || view === 'invoice' || view === 'takeoff') && !job) { location.hash = '#/'; return; }
    if (view === 'takeoff' && (job.mode !== 'takeoff' || !job.takeoff)) { location.hash = '#/job/' + job.id; return; }
    if (view === 'takeoff') renderTakeoff(job);
    else if (view === 'job') renderJob(job);
    else if (view === 'quote') renderQuote(job);
    else if (view === 'invoice' && !job.invoiceDate && !access().canCreate) { location.hash = '#/upgrade'; return; }
    else if (view === 'invoice') renderInvoice(job);
    else if (view === 'schedule') renderSchedule();
    else if (view === 'customers') renderCustomers();
    else if (view === 'customer') renderCustomer(decodeURIComponent(id || ''));
    else if (view === 'upgrade') renderUpgrade();
    else if (view === 'install') renderInstall();
    else if (view === 'new' && !access().canCreate) { location.hash = '#/upgrade'; return; }
    else if (view === 'new') renderNewJob(P.JOB_TYPES[id] ? id : null);
    else if (view === 'settings') renderSettings();
    else if (view === 'stats') renderStats(+id || new Date().getFullYear());
    else if (view === 'welcome' && !id && settings.onboarded) { location.hash = '#/'; return; }
    else if (view === 'welcome') renderWelcome(+id || 0);
    else if (!settings.onboarded) { location.hash = '#/welcome'; return; }
    else if (wantsInstall && !isInstalled()) { wantsInstall = false; location.hash = '#/install'; return; }
    else renderHome();
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });

  // ---------- First-run onboarding ----------
  var RATE_PRESETS = [
    { id: 'new', icon: '🌱', label: 'Just starting out', desc: 'Competitive prices to win your first jobs', laborRate: 45, markup: 20, minimumJob: 350 },
    { id: 'pro', icon: '🖌️', label: 'Established painter', desc: 'Solid rates for steady, quality work', laborRate: 55, markup: 25, minimumJob: 450 },
    { id: 'premium', icon: '⭐', label: 'Premium / high-end', desc: 'Top-quality work and service', laborRate: 70, markup: 30, minimumJob: 750 }
  ];

  /** A starting-price preset in the painter's currency (presets are written in US dollars). */
  function presetVals(p) {
    return { laborRate: CUR.convert(p.laborRate, 'USD', settings.currency), markup: p.markup, minimumJob: CUR.convert(p.minimumJob, 'USD', settings.currency) };
  }

  /** Currency picker with a plain explanation, shown during setup. */
  function currencySelect() {
    return '<select data-setting="currency" aria-label="Currency">' + CUR.LIST.map(function (c) {
      return '<option value="' + c[0] + '"' + (c[0] === settings.currency ? ' selected' : '') + '>' + esc(CUR.symbol(c[0]) + ' · ' + c[1] + ' (' + c[0] + ')') + '</option>';
    }).join('') + '</select>';
  }
  function currencyNote() {
    var name = (CUR.LIST.find(function (c) { return c[0] === settings.currency; }) || ['', 'US dollar'])[1];
    return '<div class="wz-tip cur-note"><label class="field" style="margin:0"><span>Your currency</span>' + currencySelect() + '</label>' +
      '<p class="small" style="margin:8px 0 0">' + (settings.currency === 'USD'
        ? 'Quotes and invoices will be in US dollars. Not in the US? Pick your currency above.'
        : 'We picked <b>' + esc(name) + 's</b> from your phone\'s region. The starting prices below are our US prices converted for you, ' +
          'so set them to what painters really charge where you work. Your prices never change with exchange rates.') + '</p></div>';
  }

  function welcomeSteps(step) {
    return '<div class="wz-dots" aria-label="Step ' + step + ' of 3">' + [1, 2, 3].map(function (n) {
      return '<span class="' + (n <= step ? 'on' : '') + '"></span>';
    }).join('') + '</div>';
  }

  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function isInstalled() { return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }
  function isAndroid() { return /android/i.test(navigator.userAgent); }
  function isMobile() { return isIOS() || isAndroid() || /mobile/i.test(navigator.userAgent); }
  /** Instagram, Facebook, TikTok, Snapchat etc. open links in their own browser, which can't install apps. */
  function inAppBrowser() { return /Instagram|FBAN|FBAV|FB_IAB|BytedanceWebview|musical_ly|TikTok|Snapchat|Line\//i.test(navigator.userAgent); }

  function installSteps() {
    if (isInstalled()) return '<div class="inst-done">✅ Coatwright is installed on this device. Open it from your home screen anytime.</div>';
    if (inAppBrowser()) {
      return '<div class="inst-warn"><b>First, open this page in your phone\'s browser.</b><br>You\'re inside another app\'s browser, which can\'t install apps. ' +
        'Tap the <b>⋯</b> or <b>⋮</b> menu at the top or bottom, then <b>Open in ' + (isIOS() ? 'Safari' : 'Chrome') + '</b> (or "Open in browser").</div>';
    }
    var ios = '<div class="inst-card' + (isIOS() ? ' on' : '') + '"><h3>📱 iPhone &amp; iPad</h3><ol>' +
      '<li>Open <b>getcoatwright.com/app</b> in <b>Safari</b></li>' +
      '<li>Tap the <b>Share</b> button <span class="kbd">⬆︎</span> (bottom of the screen; top-right on iPad)</li>' +
      '<li>Scroll down and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b>. The Coatwright icon appears on your home screen.</li></ol></div>';
    var android = '<div class="inst-card' + (isAndroid() ? ' on' : '') + '"><h3>🤖 Android</h3>' +
      (installPrompt ? '<button class="btn btn-primary full" data-action="install">📲 Install Coatwright</button><p class="muted small">Or use the steps below.</p>' : '') +
      '<ol><li>Open <b>getcoatwright.com/app</b> in <b>Chrome</b></li>' +
      '<li>Tap <b>Install</b> when it pops up, or tap the <b>⋮</b> menu → <b>Install app</b> / <b>Add to Home screen</b></li>' +
      '<li>Tap <b>Install</b>. Coatwright appears with your other apps.</li></ol></div>';
    return isAndroid() ? android + ios : ios + android;
  }

  function renderInstall() {
    app.innerHTML = '<div class="page-head"><a href="#/" class="back">‹ Jobs</a><span class="muted small">Install</span></div>' +
      '<h1 class="ask">Put Coatwright on your phone</h1>' +
      '<p class="muted">No app store needed. It installs in seconds and works like any other app: its own icon, full screen, and it opens even without signal.</p>' +
      installSteps() +
      '<section class="card"><h2 class="card-title">Good to know</h2><ul class="ticks-app" style="margin:0">' +
      '<li>Your jobs and quotes stay on this phone. Back up anytime in ⚙️ Settings</li>' +
      '<li>Updates install automatically. Nothing to download</li>' +
      '<li>Using a computer too? Open getcoatwright.com/app there as well</li></ul></section>' +
      '<p class="center-text"><a href="#/">Continue in the browser</a></p>';
  }

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
      var active = RATE_PRESETS.find(function (p) { return presetVals(p).laborRate === Number(settings.laborRate) && p.markup === Number(settings.markup); });
      body = welcomeSteps(2) + '<h1 class="ask">Your prices</h1><p class="muted">Pick a starting point. Every number can be changed later in Settings.</p>' +
        currencyNote() +
        '<div class="pick-list">' + RATE_PRESETS.map(function (p) {
          return '<button type="button" class="pick' + (active === p ? ' picked' : '') + '" data-action="preset" data-v="' + p.id + '">' +
            '<span class="pick-icon">' + p.icon + '</span><span><strong>' + p.label + '</strong><span class="muted small">' + p.desc +
            ' · ' + money0(presetVals(p).laborRate) + '/hr, ' + p.markup + '% markup</span></span>' + (active === p ? '<span class="chev">✓</span>' : '') + '</button>';
        }).join('') + '</div>' +
        '<section class="card" style="margin-top:14px"><div class="row2">' +
        setField('laborRate', 'Labor rate', { type: 'number', pre: sym(), unit: '/hr' }) + setField('markup', 'Markup', { type: 'number', unit: '%' }) + '</div>' +
        '<div class="row2">' + setField('minimumJob', 'Minimum job', { type: 'number', pre: sym() }) + setField('depositPct', 'Deposit', { type: 'number', unit: '%' }) + '</div>' +
        '<p class="muted small" style="margin:0">Paint prices, tax and how fast you work are in Settings too.</p></section>' +
        '<div class="wz-nav"><a class="btn" href="#/welcome/1">Back</a><button class="btn btn-primary" data-action="wz-next" data-v="3">Continue</button></div>';
    } else {
      var install = isInstalled() ? '' : inAppBrowser() ? '<a class="btn full" href="#/install">📲 How to install Coatwright</a>' : installPrompt
        ? '<button class="btn full" data-action="install">📲 Install Coatwright on this phone</button>'
        : isIOS() ? '<p class="wz-tip">📲 <b>Tip:</b> tap the Share button, then <b>Add to Home Screen</b>, to open Coatwright like an app.</p>'
          : '<p class="wz-tip">📲 <b>Tip:</b> use your browser menu → <b>Install app</b> or <b>Add to Home screen</b> to open Coatwright like an app.</p>';
      body = welcomeSteps(3) + '<div class="wz-hero"><div class="wz-check">✓</div><h1>You\'re all set' + (settings.ownerName ? ', ' + esc(settings.ownerName.split(' ')[0]) : '') + '!</h1>' +
        '<p class="muted">Your business details and prices are saved' + (syncOn() ? ' to your account.' : ' on this phone.') + (access().mode === 'trial' ? ' Your <b>' + BC.trialDays + '-day free trial</b> has started. No card needed.' : '') + '</p></div>' +
        '<button class="btn btn-primary btn-xl" data-action="wz-finish" data-v="quote">＋ Create my first quote</button>' +
        '<button class="btn full" data-action="wz-finish" data-v="sample">👀 Explore with a sample quote</button>' + install +
        '<p class="center-text muted small">' + dataPromise() + ' <a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a></p>';
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

  // ---------- Account / sign-in ----------
  function renderSignin() {
    var st = signin;
    var head = '<div class="wz-hero"><img src="icon.svg" alt="" width="72" height="72"><h1>Start your 14-day free trial</h1>' +
      '<p class="muted">No credit card. Already have an account? Sign in the same way.</p></div>';
    var body;
    if (st.step === 'code') {
      body = '<section class="card"><h2 class="card-title">Check your email</h2>' +
        '<p class="muted small" style="margin-top:0">We sent a 6-digit code to <b>' + esc(st.email) + '</b>. It can take a minute; check spam too.</p>' +
        '<label class="field"><span>Code</span><input id="si-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" class="code-input"></label>' +
        '<button class="btn btn-primary full" data-action="si-verify"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Checking…' : 'Continue') + '</button>' +
        '<div class="si-row"><button class="link" data-action="si-resend">Send a new code</button><button class="link" data-action="si-change">Use a different email</button></div></section>';
    } else {
      body = (CFG.google ? '<button class="btn google-btn full" data-action="si-google"><span class="g-logo" aria-hidden="true">G</span> Continue with Google</button>' +
          '<div class="si-or"><span>or use your email</span></div>' : '') +
        '<section class="card">' +
        '<label class="field"><span>Email</span><input id="si-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="you@email.com" value="' + esc(st.email) + '"></label>' +
        '<button class="btn ' + (CFG.google ? '' : 'btn-primary ') + 'full" data-action="si-send"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Sending…' : 'Email me a code') + '</button>' +
        '<p class="muted small" style="margin-bottom:0">No password needed. We\'ll email you a 6-digit code.</p></section>';
    }
    app.innerHTML = '<div class="welcome">' + head + (st.error ? '<div class="inst-warn">' + esc(st.error) + '</div>' : '') + body +
      '<p class="center-text muted small">By continuing you agree to our <a href="../terms.html">Terms</a> and <a href="../privacy.html">Privacy Policy</a>.<br>' +
      'Questions? <a href="mailto:hello@getcoatwright.com">hello@getcoatwright.com</a></p></div>';
    var focus = app.querySelector('#si-code') || (!st.email && app.querySelector('#si-email'));
    if (focus) focus.focus();
  }

  function friendlyAuthError(e) {
    var m = String((e && e.message) || e || '');
    if (/rate|too many|seconds/i.test(m)) return 'Too many tries. Please wait a minute and try again.';
    if (/expired|invalid|otp|token/i.test(m)) return 'That code didn\'t work or has expired. Check it, or send a new one.';
    if (/failed to fetch|network|load failed/i.test(m)) return 'Can\'t reach Coatwright right now. Check your internet connection.';
    return m || 'Something went wrong. Please try again.';
  }

  /** After any sign-in: load the account and its server trial start, then continue into the app. */
  function finishSignin(sess) {
    session = sess; save('pq.session', session);
    return Promise.all([sess.user ? Promise.resolve(sess.user) : AC.getUser(CFG, sess), AC.getProfile(CFG, sess)])
      .then(function (r) {
        var user = r[0], profile = r[1];
        settings.account = { id: user.id, email: user.email, name: (profile && profile.full_name) || user.name || '',
          trialStartedAt: profile && profile.trial_started_at ? Date.parse(profile.trial_started_at) : null, checkedAt: Date.now() };
        if (settings.account.trialStartedAt) settings.trialStart = settings.account.trialStartedAt;
        if (!settings.ownerName && settings.account.name) settings.ownerName = settings.account.name;
        if (!settings.email && user.email) settings.email = user.email;
        saveSettings();
        signin = { step: 'start', email: '', busy: false, error: '' };
        toast('Signed in as ' + user.email);
        var go = function () { location.hash = settings.onboarded ? '#/' : '#/welcome'; route(); };
        if (!syncOn()) return go();
        app.innerHTML = '<div class="welcome"><div class="wz-hero"><img src="icon.svg" alt="" width="72" height="72"><h1>Loading your jobs…</h1></div></div>';
        var timeout = new Promise(function (res) { setTimeout(res, 12000); });
        return Promise.race([runSync(true), timeout]).then(go, go);
      });
  }

  /** Keep the session fresh and the trial start in sync (quietly; works offline with the saved account). */
  function syncAccount() {
    if (!accountsOn() || !session || !session.refreshToken || navigator.onLine === false) return Promise.resolve();
    var p = AC.needsRefresh(session) ? AC.refresh(CFG, session).then(function (s) { session = s; save('pq.session', session); }) : Promise.resolve();
    return p.then(function () { return AC.getProfile(CFG, session); })
      .then(function (profile) {
        if (profile && profile.trial_started_at && settings.account) {
          settings.account.trialStartedAt = Date.parse(profile.trial_started_at);
          settings.trialStart = settings.account.trialStartedAt;
          settings.account.checkedAt = Date.now(); saveSettings();
        }
        if (!BC.enabled) return;
        var before = JSON.stringify(access());
        return Promise.all([
          AC.getSubscriptions(CFG, session),
          AC.getComp(CFG, session).catch(function (e) { return e && e.status === 404 ? null : Promise.reject(e); })
        ]).then(function (res) {
          settings.sub = BL.subFromRows(res[0], Date.now());
          settings.comp = res[1] ? { note: res[1].note || 'Complimentary', checkedAt: Date.now() } : null;
          saveSettings();
          var v = location.hash.split('/')[1] || '';
          if (JSON.stringify(access()) !== before && (v === '' || v === 'upgrade' || v === 'settings')) route();
        });
      })
      .catch(function (e) {
        if (e && (e.status === 400 || e.status === 401 || e.status === 403) && /refresh|token|jwt|session/i.test(e.message)) {
          session = null; save('pq.session', null); delete settings.account; saveSettings(); route();
        }
      });
  }

  /** Google sends people back with #access_token=… in the address; pick it up before routing. */
  function handleAuthReturn() {
    if (!accountsOn()) return false;
    var r = AC.parseAuthFragment(location.hash);
    if (!r) return false;
    history.replaceState(null, '', location.pathname + location.search);
    if (r.error) { signin.error = 'Google sign-in didn\'t finish: ' + r.error; location.hash = '#/signin'; route(); return true; }
    app.innerHTML = '<div class="welcome"><div class="wz-hero"><img src="icon.svg" alt="" width="72" height="72"><h1>Signing you in…</h1></div></div>';
    finishSignin(r).catch(function (e) { signin.error = friendlyAuthError(e); location.hash = '#/signin'; route(); });
    return true;
  }

  // ---------- Subscription ----------
  function planBanner() {
    var a = access();
    if (a.mode === 'trial') {
      return '<a class="plan-banner' + (a.daysLeft <= 3 ? ' urgent' : '') + '" href="#/upgrade"><span>⏳</span><div><strong>Free trial: ' +
        a.daysLeft + (a.daysLeft === 1 ? ' day' : ' days') + ' left</strong><div class="small">Ends ' + esc(fmtDate(a.ends)) + '. Keep every feature for ' + usd(BC.prices.monthly) + '/mo or ' +
        usd(BC.prices.annual) + '/yr.</div></div><span class="pb-cta">Upgrade</span></a>';
    }
    if (a.mode === 'active' && a.pastDue) {
      return '<a class="plan-banner urgent" href="#/upgrade"><span>💳</span><div><strong>Payment problem</strong><div class="small">Your last payment didn\'t go through. Update your card to keep Coatwright Pro.</div></div><span class="pb-cta">Fix</span></a>';
    }
    if (a.mode === 'expired' || a.mode === 'recheck') {
      return '<a class="plan-banner urgent" href="#/upgrade"><span>🔒</span><div><strong>' +
        (a.mode === 'recheck' ? 'Confirm your subscription' : a.lapsed ? 'Your subscription has ended' : 'Your free trial has ended') + '</strong><div class="small">' +
        (a.mode === 'recheck' ? 'Connect to the internet so Coatwright can check your subscription.' : 'Your jobs are safe. Upgrade to keep quoting and invoicing.') +
        '</div></div><span class="pb-cta">' + (a.mode === 'recheck' ? 'Check' : 'Upgrade') + '</span></a>';
    }
    return '';
  }

  /** One-time reminder card at 7, 3 and 1 days left in the trial. */
  function trialReminderCard() {
    var a = access(), stage = BL.trialReminder(a, settings.trialReminder);
    if (!stage) return '';
    var d = a.daysLeft, when = d === 1 ? 'Your free trial ends tomorrow' : d + ' days left in your free trial';
    return '<div class="trial-remind"><button class="icon-btn sm" data-action="trial-remind-dismiss" data-v="' + stage + '" aria-label="Dismiss">✕</button>' +
      '<strong>⏳ ' + when + '</strong><p class="small">It ends on <b>' + esc(fmtDate(a.ends)) + '</b>. Your jobs and customers stay safe either way. ' +
      'Pick a plan to keep quoting and invoicing' + (BC.founderSpots ? ', and grab a founding price while spots last' : '') + '.</p>' +
      '<a class="btn btn-primary full" href="#/upgrade" data-action="trial-remind-dismiss" data-v="' + stage + '">See plans</a></div>';
  }

  var founderLeft = null; // founding spots left (null = unknown)

  function planCard(id, title, price, unit, note, badge, featured) {
    var url = BL.checkoutUrl(BC, id, settings.account);
    return '<div class="plan-card' + (featured ? ' featured' : '') + '">' + (badge ? '<div class="plan-badge">' + badge + '</div>' : '') +
      '<h3>' + title + '</h3><div class="plan-price">' + usd(price) + '<span>' + unit + '</span></div><p class="muted small">' + note + '</p>' +
      (url ? '<a class="btn ' + (featured ? 'btn-primary' : '') + ' full" href="' + esc(url) + '" rel="noopener">Choose ' + title + '</a>'
        : '<span class="btn full disabled">' + (BC.enabled && !signedIn() ? 'Sign in to subscribe' : 'Available soon') + '</span>') + '</div>';
  }

  /** "Renews Dec 15, 2026 · $24/mo" or "Ends Dec 15, 2026". */
  function renewLine(a) {
    if (a.comp) return 'Complimentary access (' + esc(a.comp) + '), no subscription needed.';
    var pp = BL.planPrice(BC, a.plan);
    if (!a.renews) return '';
    return a.cancelAtEnd ? 'Ends on <b>' + esc(fmtDate(a.renews)) + '</b> (cancelled)'
      : 'Renews on <b>' + esc(fmtDate(a.renews)) + '</b> · ' + usd(pp.amount) + pp.unit;
  }

  function renderUpgrade() {
    var a = access(), deal = BL.annualDeal(BC);
    var thanks = (location.hash.split('/')[2] || '') === 'thanks';
    var portal = BL.portalUrl(BC, settings.account && settings.account.email);
    if (thanks && a.mode !== 'active') {
      app.innerHTML = '<div class="welcome"><div class="wz-hero"><img src="icon.svg" alt="" width="72" height="72"><h1>Finishing up…</h1>' +
        '<p class="muted">Payment received. Unlocking Coatwright Pro, this takes a few seconds.</p></div></div>';
      waitForSubscription(0);
      return;
    }
    var head = a.mode === 'active' ? '<h1 class="ask">' + (thanks ? '🎉 Welcome to Coatwright Pro!' : 'You\'re on Coatwright Pro ✓') + '</h1>' +
        (a.founderNumber ? '<p class="founder-badge">🔥 Founding Member #' + a.founderNumber + ' of 100</p>' : '') +
        '<p class="muted">Plan: <b>' + esc(BL.planName(a.plan)) + '</b>. ' + renewLine(a) + '</p>' +
        (a.pastDue ? '<p class="small" style="color:var(--danger)">Your last payment didn\'t go through. Please update your card so Coatwright keeps working.</p>' : '') +
        '<p class="muted">Thank you for supporting Coatwright!</p>'
      : a.mode === 'expired' ? '<h1 class="ask">' + (a.lapsed ? 'Your subscription has ended' : 'Your free trial has ended') + '</h1><p class="muted">Your jobs, customers and numbers are all still here. Pick a plan to keep quoting and invoicing.</p>'
      : a.mode === 'recheck' ? '<h1 class="ask">Confirm your subscription</h1><p class="muted">Connect to the internet and tap Check below.</p>'
      : a.mode === 'trial' ? '<h1 class="ask">Keep Coatwright after your trial</h1><p class="muted">' + a.daysLeft + (a.daysLeft === 1 ? ' day' : ' days') + ' left in your free trial (ends ' + esc(fmtDate(a.ends)) + '). Every plan includes everything.</p>'
      : '<h1 class="ask">Coatwright Pro</h1><p class="muted">Plans are coming soon. Everything is free while we get ready.</p>';
    var showFounder = BC.checkout.monthly && founderLeft !== 0;
    app.innerHTML =
      '<div class="page-head"><a href="#/" class="back">‹ Jobs</a><span class="muted small">Plans</span></div>' + head +
      (a.mode !== 'active' ? '<div class="plans-app">' +
        (showFounder ? planCard('founder', 'Founding member', BC.prices.founder, '/mo', 'Half price for life, for the first ' + BC.founderSpots + ' paying customers.' +
          (founderLeft != null && founderLeft >= 0 ? ' <b>' + founderLeft + ' of ' + BC.founderSpots + ' spots left.</b>' : ''), '🔥 Limited', false) : '') +
        planCard('annual', 'Yearly', BC.prices.annual, '/yr', 'Just ' + usd(deal.perMonth.toFixed(2)) + '/mo. Save ' + deal.savePct + '% vs monthly.', 'Best value', true) +
        planCard('monthly', 'Monthly', BC.prices.monthly, '/mo', 'Cancel anytime.', '', false) + '</div>' +
        '<ul class="ticks-app"><li>Unlimited quotes and invoices</li><li>Interior, exterior, cabinets, floors and commercial</li>' +
        '<li>Job tracking, schedule, customers and profit stats</li><li>' + dataPromise(true) + '</li></ul>' +
        '<p class="muted small center-text">Secure checkout by Stripe. Prices in US dollars; you\'ll see your local currency and any tax at checkout.</p>' : '') +
      '<section class="card"><h2 class="card-title">' + (a.mode === 'active' ? 'Manage your subscription' : 'Already subscribed?') + '</h2>' +
      (a.mode === 'active' && a.comp
        ? '<p class="muted small" style="margin-top:0">This account has complimentary access, so there\'s nothing to pay or manage.</p>'
        : a.mode === 'active'
        ? '<p class="muted small" style="margin-top:0">Change plan, update your card, download receipts or cancel.</p>' +
          (portal ? '<a class="btn btn-primary full" href="' + esc(portal) + '" target="_blank" rel="noopener">Manage or cancel</a>' : '')
        : '<p class="muted small" style="margin-top:0">Subscribed but still seeing this? Make sure you\'re signed in with the email you paid with' +
          (settings.account ? ' (now: <b>' + esc(settings.account.email) + '</b>)' : '') + ', then check again.</p>' +
          '<button class="btn full" data-action="sub-check"' + (BC.enabled ? '' : ' disabled') + '>🔄 Check my subscription</button>' +
          (portal ? '<a class="btn btn-ghost full" style="margin-top:10px" href="' + esc(portal) + '" target="_blank" rel="noopener">Manage or cancel</a>' : '')) +
      '</section>' +
      '<p class="center-text muted small">Questions? <a href="mailto:hello@getcoatwright.com?subject=Coatwright%20subscription">hello@getcoatwright.com</a></p>';
    if (BC.enabled && BC.checkout.monthly && accountsOn() && founderLeft === null) {
      founderLeft = -1; // asking
      AC.founderSpotsLeft(CFG).then(function (n) { founderLeft = isFinite(n) ? n : null; })
        .catch(function () { founderLeft = null; })
        .then(function () { if ((location.hash.split('/')[1] || '') === 'upgrade' && founderLeft !== -1) renderUpgrade(); });
    }
  }

  /** After Stripe checkout: keep checking for a few seconds until the webhook has recorded the subscription. */
  function waitForSubscription(tries) {
    syncAccount().then(function () {
      if ((location.hash.split('/')[1] || '') !== 'upgrade') return;
      if (access().mode === 'active') { renderUpgrade(); return; }
      if (tries < 20) setTimeout(function () { waitForSubscription(tries + 1); }, 3000);
      else { location.hash = '#/upgrade'; toast('Still confirming your payment. Tap “Check my subscription” in a minute'); }
    });
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

  /** Finished or paid jobs with no payment logged (they'd make "You made" look wrong). */
  function noPayJobs() {
    return jobs.filter(function (j) {
      var st = S.statusOf(j);
      return (st === 'completed' || st === 'paid') && !S.paidAmount(j) && P.calcJob(j, settings).total > 0;
    });
  }

  function jobCards() {
    var f = HOME_FILTERS.find(function (x) { return x[0] === homeFilter; }) || HOME_FILTERS[0];
    var q = homeSearch.trim().toLowerCase();
    var nopay = homeFilter === 'nopay' ? noPayJobs() : null;
    var list = jobs.filter(function (j) {
      if (nopay && nopay.indexOf(j) === -1) return false;
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
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderHome() {
    var needsSetup = !settings.businessName;
    var y = S.yearStats(jobs, expenses, settings, new Date().getFullYear());
    var noPay = noPayJobs();
    if (homeFilter === 'nopay' && !noPay.length) homeFilter = 'all';
    var counts = {};
    HOME_FILTERS.forEach(function (f) {
      counts[f[0]] = f[2] ? jobs.filter(function (j) { return f[2].indexOf(S.statusOf(j)) !== -1; }).length : jobs.length;
    });

    var showInstall = settings.onboarded && !isInstalled() && isMobile() && !settings.installHintDismissed;
    app.innerHTML = (trialReminderCard() || planBanner()) +
      (showInstall ? '<div class="install-banner"><a href="#/install"><span>📲</span><div><strong>Add Coatwright to your home screen</strong>' +
        '<div class="small">Open it like a regular app, even with no signal.</div></div></a>' +
        '<button class="icon-btn sm" data-action="install-dismiss" aria-label="Dismiss">✕</button></div>' : '') +
      (needsSetup ? '<a class="setup-banner" href="#/settings"><span>👋</span><div><strong>Start here: add your business info</strong>' +
        '<div class="small">Your name, logo and rates go on every quote. Takes 1 minute.</div></div><span>›</span></a>' : '') +
      (jobs.length ? '<a class="year-card" href="#/stats"><div><div class="muted small">' + y.year + ' collected</div><div class="year-big">' + money0(y.collected) + '</div></div>' +
        '<div><div class="muted small">You made</div><div class="year-big">' + money0(y.made) + '</div></div>' +
        '<div class="year-more">Stats ›</div></a>' : '') +
      (noPay.length ? '<button type="button" class="nopay-hint" data-action="filter" data-v="nopay">⚠️ <span><b>' + noPay.length +
        (noPay.length === 1 ? ' finished job has' : ' finished jobs have') + ' no payment logged</b>, so ' + (noPay.length === 1 ? 'it counts' : 'they count') + ' as ' + money0(0) +
        ' collected. Tap to see ' + (noPay.length === 1 ? 'it' : 'them') + ' and add the payment.</span></button>' : '') +
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
      (type === 'commercial' && T ? '<button type="button" class="pick big to-pick" data-action="create-takeoff" data-prop="office"><span class="pick-icon">📄</span>' +
        '<span><strong>Price from blueprints <span class="beta">BETA</span></strong><span class="muted small">Open the PDF plans, measure walls, ceilings and doors on screen, get the bid</span></span><span class="chev">›</span></button>' +
        '<button type="button" class="link to-demo-link" data-action="to-demo">👀 See a demo: a sample office plan, already measured</button>' : '') +
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
    var keys = ['S', 'M', 'L'];
    return '<div class="chips size-chips" role="group" aria-label="Room size">' + keys.map(function (k) {
      var label = P.SIZES[k].label;
      var sub = P.SIZES[k].length + '×' + P.SIZES[k].width;
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

  /** Colour, latex/oil and sheen for each surface being painted. `prefix` is the data-field path to the room. */
  function paintSection(holder, prefix, surfaces) {
    var active = { walls: !!surfaces.walls, ceiling: !!surfaces.ceiling, trim: !!(surfaces.trim || surfaces.doors) };
    var rows = P.PAINT_SURFACES.filter(function (sf) { return active[sf[0]]; }).map(function (sf) {
      var k = sf[0], pk = holder.paint[k], f = prefix + '.paint.' + k;
      return '<div class="paint-row"><div class="paint-label">' + sf[1] + '</div>' +
        '<div class="row2"><input data-field="' + f + '.brand" value="' + esc(pk.brand) + '" placeholder="Brand / product" list="paint-brands" aria-label="' + sf[1] + ' brand" autocomplete="off">' +
        '<input data-field="' + f + '.color" value="' + esc(pk.color) + '" placeholder="Colour name / code" aria-label="' + sf[1] + ' colour" autocomplete="off"></div>' +
        '<div class="row2"><select data-field="' + f + '.base" aria-label="' + sf[1] + ' paint type">' + P.PAINT_BASES.map(function (b) {
          return '<option value="' + b[0] + '"' + (pk.base === b[0] ? ' selected' : '') + '>' + b[1] + '</option>';
        }).join('') + '</select>' +
        '<select data-field="' + f + '.sheen" aria-label="' + sf[1] + ' sheen">' + P.SHEENS.map(function (sh) {
          return '<option' + (pk.sheen === sh ? ' selected' : '') + '>' + sh + '</option>';
        }).join('') + '</select></div></div>';
    }).join('');
    if (!rows) return '';
    var picked = P.PAINT_SURFACES.filter(function (sf) { return active[sf[0]] && holder.paint[sf[0]].color; }).length;
    return '<details class="paint-box"><summary>🎨 Paint: brand, colour, type &amp; sheen' +
      (picked ? ' <span class="muted small">(' + picked + ' picked)</span>' : ' <span class="muted small">(optional)</span>') + '</summary>' + rows + '</details>';
  }

  function roomCard(room, i, calc) {
    var c = calc.rooms[i];
    return '<section class="card room-card" data-room="' + i + '">' +
      '<div class="room-head"><input class="room-name" data-field="rooms.' + i + '.name" value="' + esc(room.name) + '" aria-label="Room name">' +
      '<div class="room-price" data-out="room-price-' + i + '">' + money0(c.price) + '</div></div>' +
      '<div class="label">Size</div>' + sizeChips(room, i) +
      '<div class="label dims-label">Or type the exact size <span class="measured" data-out="measured-' + i + '"' + (room.size === 'custom' ? '' : ' hidden') + '>📏 Measured</span></div>' +
      '<div class="dims">' +
      numField('rooms.' + i + '.length', room.length, 'Length', 'ft') +
      numField('rooms.' + i + '.width', room.width, 'Width', 'ft') +
      numField('rooms.' + i + '.height', room.height, 'Ceiling height', 'ft') + '</div>' +
      '<div class="label">What are we painting?</div>' + surfaceChips(room, i) +
      '<div class="row2">' + stepper(i, 'doors', room.doors, 'Doors') + stepper(i, 'windows', room.windows, 'Windows') + '</div>' +
      '<div class="row2"><div><div class="label">Coats</div>' + segmented(i, 'coats', room.coats, [[1, '1'], [2, '2'], [3, '3']]) + '</div>' +
      '<div><div class="label">Wall condition</div>' + segmented(i, 'condition', room.condition, [['good', 'Good'], ['fair', 'Fair'], ['poor', 'Rough']]) + '</div></div>' +
      '<div class="room-paint" data-out="room-paint-' + i + '">' + roomPaintLine(calc.paint, i) + '</div>' +
      paintSection(room, 'rooms.' + i, room.surfaces || {}) +
      '<div class="room-foot"><span class="muted small" data-out="room-meta-' + i + '">' + roomMeta(c) + '</span>' +
      '<span><button type="button" class="link" data-action="dup-room" data-i="' + i + '">Copy</button>' +
      '<button type="button" class="link danger" data-action="del-room" data-i="' + i + '">Remove</button></span></div>' +
      '</section>';
  }

  /** "🪣 Paint for this room: Walls 1 gal + 2 qt · Ceiling 1 gal …" */
  function roomPaintLine(plan, i) {
    var ro = plan && plan.rooms[i];
    if (!ro || !ro.items.length) return '';
    return '<span class="rp-title">🪣 Paint for this room</span>' + ro.items.map(function (x) {
      return '<span class="rp-item"><b>' + esc(x.surface) + '</b> ' + esc(x.buyText) + (x.color ? ' <span class="muted">· ' + esc(x.color) + '</span>' : '') + '</span>';
    }).join('');
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
      '<div class="room-paint" data-out="room-paint-0">' + roomPaintLine(calc.paint, 0) + '</div>' +
      paintSection(q, 'quick', q.surfaces || {}) +
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
        (unit === '$' ? '<em>' + sym() + '</em>' : '') + '<input type="number" inputmode="decimal" min="0" step="any" data-field="actuals.' + key +
        '" value="' + esc(a[key] == null ? '' : a[key]) + '" placeholder="' + ph + '">' + (unit !== '$' ? '<em>' + unit + '</em>' : '') + '</div></label>';
    };
    return '<section class="card money-card"><h2 class="card-title"><span class="step">5</span> Payments & real costs</h2>' +
      '<div class="label" style="margin-top:0">Payments received</div>' +
      (job.payments.length ? job.payments.map(function (p, i) {
        return '<div class="pay-row"><input type="date" data-field="payments.' + i + '.date" value="' + esc(p.date) + '" aria-label="Payment date">' +
          '<div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-field="payments.' + i + '.amount" value="' + esc(p.amount) + '" aria-label="Amount"></div>' +
          '<select data-field="payments.' + i + '.method" aria-label="Payment method">' + S.paymentMethods(settings.currency, p.method).map(function (m) {
            return '<option' + (p.method === m ? ' selected' : '') + '>' + m + '</option>';
          }).join('') + '</select>' +
          '<button type="button" class="icon-btn" data-action="del-payment" data-i="' + i + '" aria-label="Remove payment">✕</button></div>';
      }).join('') : (S.statusOf(job) === 'completed' || S.statusOf(job) === 'paid'
        ? '<p class="nopay-note small"><b>No payments logged yet</b>, so this job counts as ' + money0(0) + ' collected and only its costs show in your stats. ' +
          'Tap <b>Add payment</b> to log what the customer paid.</p>'
        : '<p class="muted small">No payments yet. Log the deposit and final payment here.</p>')) +
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
          '<div class="label">Asbestos test</div>' + oSeg(i, 'test', item.test, [[1, 'Include (' + money0(75 * (Number(settings.costFactor) || 1)) + ')'], [0, 'Not needed']]) +
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

  function paintOrderList(job) {
    var plan = P.paintPlan(job, settings);
    if (!plan.groups.length) return '<p class="muted small">Add rooms (or areas) to see the paint you need.</p>';
    var priced = !!job.paintByOrder;
    return '<div class="label">By room</div><div class="paint-rooms">' + plan.rooms.map(function (ro) {
      return '<div class="pr-room"><strong>' + esc(ro.name) + '</strong>' + ro.items.map(function (x) {
        return '<div class="pr-line"><span>' + esc(x.surface) + ' <span class="muted small">' + esc([P.paintSpec(x), x.color].filter(Boolean).join(' · ')) + '</span></span>' +
          '<span class="muted">' + esc(x.gallons) + ' gal</span></div>';
      }).join('') + '</div>';
    }).join('') + '</div>' +
      '<div class="label">What to buy (whole job)</div><ul class="paint-order">' + plan.groups.map(function (g) {
        var spec = P.paintSpec(g);
        return '<li><div class="po-main"><div><strong>' + esc(g.product) + '</strong>' + (spec ? ' <span class="muted small">' + esc(spec) + '</span>' : '') +
          '<div class="small">' + (g.color ? '🎨 ' + esc(g.color) : '<span class="muted">Colour not picked yet</span>') + '</div>' +
          '<div class="muted small">' + esc(g.where.join(', ')) + '</div></div><div class="buy">' + esc(g.buyText) + '</div></div>' +
          (priced ? '<div class="po-price"><label class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-field="paintPrices.' + g.key +
            '" value="' + esc(g.priceCustom ? g.price : '') + '" placeholder="' + esc(g.price) + '" aria-label="Price per gallon"><em>/gal</em></label>' +
            '<span class="po-cost" data-out="po-cost-' + g.key + '">' + money(g.cost) + '</span></div>' : '') + '</li>';
      }).join('') + '</ul>' +
      (priced ? '<div class="po-total"><span>Paint for this job</span><b data-out="po-total">' + money(plan.cost) + '</b></div>' +
        '<p class="muted small">Prices start from your Settings; type the real price per gallon for each paint. A quart counts as about a third of a gallon\'s price. This is what the quote charges for paint (plus your markup).</p>'
        : '<p class="muted small">This job was created before per-paint pricing, so its quote keeps your original paint prices.</p>');
  }

  /** Plain-text paint order for the store (email / text / copy). No prices: the store sets those. */
  function paintOrderText(job) {
    var plan = P.paintPlan(job, settings);
    var lines = ['PAINT ORDER — ' + (settings.businessName || 'Painting contractor'),
      'Job: ' + job.number + (job.paintPickup ? ' · Pickup: ' + fmtDate(Date.parse(job.paintPickup + 'T12:00:00')) : ''), ''];
    plan.groups.forEach(function (g, n) {
      var spec = P.paintSpec(g);
      lines.push((n + 1) + '. ' + g.product + (spec ? ' (' + spec + ')' : '') + ': ' + g.buyText);
      lines.push('   Colour: ' + (g.color || 'to confirm') + ' · for ' + g.where.join(', '));
    });
    lines.push('', 'From: ' + [settings.ownerName, settings.phone, settings.email].filter(Boolean).join(' · '));
    lines.push('Sent with Coatwright · getcoatwright.com');
    return lines.join('\n');
  }

  function paintOrderCard(job) {
    return '<details class="card paint-card"><summary class="card-title">🧾 Paint tally &amp; order <em class="muted small">(by room, cost, send to store)</em></summary>' +
      '<div data-out="paint-order">' + paintOrderList(job) + '</div>' +
      '<p class="muted small">Exact amounts from your measurements, rounded to what you buy (3 quarts → 1 gallon, 5+ gallons in pails). Same paint in several rooms is combined.</p>' +
      '<div class="row2"><label class="field"><span>Paint store</span><input data-setting="paintStoreName" value="' + esc(settings.paintStoreName || '') + '" placeholder="Store name" autocomplete="off"></label>' +
      '<label class="field"><span>Store email</span><input type="email" data-setting="paintStoreEmail" value="' + esc(settings.paintStoreEmail || '') + '" placeholder="orders@store.com" autocapitalize="off"></label></div>' +
      '<label class="field"><span>Pickup date</span><input type="date" data-field="paintPickup" value="' + esc(job.paintPickup || '') + '"></label>' +
      '<div class="row2"><button type="button" class="btn btn-primary" data-action="paint-email">✉️ Email store</button>' +
      '<button type="button" class="btn" data-action="paint-share">💬 Text / Share</button></div>' +
      '<button type="button" class="btn btn-ghost full" data-action="paint-copy" style="margin-top:8px">📋 Copy order</button></details>';
  }

  function renderJob(job) {
    if (!job.quick) job.quick = P.newQuick();
    if (!job.outside) job.outside = [];
    if (!job.payments) job.payments = [];
    if (!job.actuals) job.actuals = {};
    if (!job.paintPrices) job.paintPrices = {};
    (job.rooms || []).forEach(function (r) { r.paint = P.paintFor(r); });
    job.quick.paint = P.paintFor(job.quick);
    var quick = job.mode === 'quick';
    if (job.mode === 'takeoff' && job.jobType !== 'commercial') job.mode = 'rooms';
    var takeoff = job.mode === 'takeoff' && T;
    if (takeoff) ensureTakeoff(job);
    var calc = P.calcJob(job, settings);
    calc.paint = P.paintPlan(job, settings);
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
      '<datalist id="paint-brands">' + ['Benjamin Moore', 'Sherwin-Williams', 'Behr', 'PPG', 'Dulux', 'Valspar', 'Glidden', 'Farrow & Ball', 'Beauti-Tone', 'Cloverdale', 'General Paint', 'Para']
        .map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist>' +
      '<datalist id="cust-names">' + S.customersFrom(jobs, settings).map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('') + '</datalist>' +
      '<label class="field"><span>' + (commercial ? 'Business / contact name' : 'Name') + '</span><input list="cust-names" data-field="customer.name" value="' + esc(cu.name) +
      '" placeholder="' + (commercial ? 'Acme Dental — Dr. Lee' : 'Jane Smith') + '" autocomplete="off"></label>' +
      '<label class="field"><span>Address</span><input data-field="customer.address" value="' + esc(cu.address) + '" placeholder="123 Main St" autocomplete="off"></label>' +
      '<div class="row2"><label class="field"><span>Phone</span><input type="tel" data-field="customer.phone" value="' + esc(cu.phone) + '" placeholder="(555) 555-5555"></label>' +
      '<label class="field"><span>Email</span><input type="email" data-field="customer.email" value="' + esc(cu.email) + '" placeholder="jane@email.com" autocapitalize="off"></label></div>' +
      propertyPicker(job) +
      '</section>' +

      '<h2 class="section-title"><span class="step">2</span> ' + (takeoff ? 'Measure from blueprints' : quick ? 'Inside: size of the job' : 'Inside: rooms') + '</h2>' +
      '<div class="segmented mode-switch' + (commercial ? ' three' : '') + '">' +
      '<button type="button" class="' + (quick ? 'on' : '') + '" data-action="mode" data-v="quick">⚡ Quick (by sq ft)</button>' +
      '<button type="button" class="' + (!quick && !takeoff ? 'on' : '') + '" data-action="mode" data-v="rooms">📐 Room by room</button>' +
      (commercial && T ? '<button type="button" class="' + (takeoff ? 'on' : '') + '" data-action="mode" data-v="takeoff">📄 Blueprint takeoff</button>' : '') + '</div>' +
      (takeoff ? takeoffCard(job, calc) : quick ? quickCard(job, calc) :
        job.rooms.map(function (r, i) { return roomCard(r, i, calc); }).join('') +
        '<section class="card add-room"><div class="label">' + (job.rooms.length ? 'Add another room' : 'Tap a room to add it') + '</div>' +
        '<div class="room-types">' + roomTypes.map(typeBtn).filter(function (_, k) { return !roomTypes[k].more; }).join('') + '</div>' +
        (moreTypes.length ? '<details class="more-types"><summary>More area types (' + moreTypes.length + ')</summary>' +
          '<div class="room-types">' + moreTypes.join('') + '</div></details>' : '') +
        '</section>') +

      (takeoff ? '' : '<h2 class="section-title"><span class="step">3</span> Exterior, floors & specialty <em class="muted small">(optional)</em></h2>' +
      job.outside.map(function (it, i) { return outsideCard(it, i, calc.outside[i]); }).join('') +
      '<section class="card add-room">' + P.OUTSIDE_GROUPS.map(function (g) {
        return '<div class="label">' + g[1] + '</div><div class="room-types">' + P.OUTSIDE_TYPES.map(function (t, k) {
          if (t.group !== g[0]) return '';
          var nm = (commercial && t.commercialName) || t.name;
          return '<button type="button" data-action="add-out" data-k="' + k + '"><span>' + t.icon + '</span>' + esc(nm) + '</button>';
        }).join('') + '</div>';
      }).join('') + '</section>') +

      '<details class="card"' + (job.extras.length || job.discount || job.notes ? ' open' : '') + '><summary class="card-title"><span class="step">4</span> Extras, discount & notes <em class="muted small">(optional)</em></summary>' +
      job.extras.map(function (e, i) {
        return '<div class="extra-row"><input data-field="extras.' + i + '.label" value="' + esc(e.label) + '" placeholder="e.g. Drywall repair" aria-label="Extra item">' +
          '<div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" data-field="extras.' + i + '.price" value="' + esc(e.price) + '" aria-label="Price"></div>' +
          '<button type="button" class="icon-btn" data-action="del-extra" data-i="' + i + '" aria-label="Remove">✕</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost" data-action="add-extra">＋ Add extra item</button>' +
      '<div class="row2"><label class="field"><span>Discount</span><div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" data-field="discount" value="' + esc(job.discount || '') + '" placeholder="0"></div></label></div>' +
      '<label class="field"><span>Notes for customer</span><textarea data-field="notes" rows="3" placeholder="Colors, start date, anything special…">' + esc(job.notes) + '</textarea></label>' +
      '</details>' +
      (takeoff ? '' : paintOrderCard(job)) +
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
    var plan = P.paintPlan(job, settings);
    app.querySelectorAll('[data-out^="room-paint-"]').forEach(function (el) {
      el.innerHTML = roomPaintLine(plan, +el.getAttribute('data-out').slice(11));
    });
    var po = app.querySelector('[data-out="paint-order"]');
    if (po) {
      if (po.contains(document.activeElement)) { // typing a price: update numbers only, keep the keyboard
        plan.groups.forEach(function (g) {
          var c = po.querySelector('[data-out="po-cost-' + g.key + '"]');
          if (c) c.textContent = money(g.cost);
        });
        var pt = po.querySelector('[data-out="po-total"]');
        if (pt) pt.textContent = money(plan.cost);
      } else po.innerHTML = paintOrderList(job);
    }
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
      r.lines.forEach(function (l) { rows += lineRow(l.label, l.detail, l.included ? 'Included' : money(l.price)); });
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
      if (q.deposit && !q.takeoff) totals += lineRow('Deposit to book (' + s.depositPct + '%)', '', money(q.deposit), 'sub');
    }

    var biz = [s.ownerName, s.phone, s.email, s.website].filter(Boolean).map(esc).join('<br>');

    return '<article class="quote-doc">' +
      '<header class="doc-head"><div class="doc-biz">' +
      (s.logo ? '<img src="' + esc(s.logo) + '" alt="" class="logo">' : '') +
      '<div><div class="doc-bizname">' + esc(s.businessName || 'Your Painting Co.') + '</div><div class="muted small">' + biz + '</div></div></div>' +
      (inv
        ? '<div class="doc-meta"><div class="doc-title">INVOICE</div><div>' + esc(invoiceNumber(job)) + '</div>' +
          '<div class="muted small">' + fmtDate(new Date((job.invoiceDate || today()) + 'T12:00:00').getTime()) + '<br>' + invoiceDue(job) + '</div></div></header>'
        : '<div class="doc-meta"><div class="doc-title">' + (q.takeoff ? 'PROPOSAL' : 'ESTIMATE') + '</div><div>' + esc(job.number) + '</div>' +
          '<div class="muted small">' + fmtDate(job.updatedAt) + '<br>Valid until ' + fmtDate(valid) + '</div></div></header>') +
      '<div class="doc-to"><div><div class="label">' + (inv ? 'Bill to' : 'Prepared for') + '</div><strong>' + esc(cu.name || '—') + '</strong>' +
      '<div class="muted small">' + [cu.address, cu.phone, cu.email].filter(Boolean).map(esc).join('<br>') + '</div></div>' +
      (q.takeoff ? '<div><div class="label">Project</div><strong>' + esc(q.takeoff.takeoff.project || P.propertyLabel(job)) + '</strong>' +
        (q.takeoff.takeoff.plans.length ? '<div class="muted small">Drawings: ' + q.takeoff.takeoff.plans.map(function (pl) { return esc(pl.name.replace(/\.pdf$/i, '')); }).join(', ') + '</div>' : '') + '</div>'
        : P.propertyLabel(job) ? '<div><div class="label">Property</div><strong>' + esc(P.propertyLabel(job)) + '</strong></div>' : '') + '</div>' +
      '<table class="lines"><tbody>' + (rows || '<tr><td class="muted">Add rooms to build the estimate.</td><td></td></tr>') + '</tbody>' +
      '<tfoot>' + totals + '</tfoot></table>' +
      (inv
        ? (s.paymentInstructions ? '<div class="doc-notes"><div class="label">How to pay</div>' + esc(s.paymentInstructions).replace(/\n/g, '<br>') + '</div>' : '') +
          '<div class="doc-notes"><b>Thank you for your business!</b></div>' +
          '<div class="doc-made">Invoice made with Coatwright</div>'
        : (q.quick ? '<div class="doc-notes"><b>' + esc(QUICK_NOTE) + '</b></div>' : '') + (q.takeoff ? proposalExtras(q.takeoff) : '') +
          (job.notes ? '<div class="doc-notes"><div class="label">Notes</div>' + esc(job.notes).replace(/\n/g, '<br>') + '</div>' : '') +
          (s.terms && !q.takeoff ? '<div class="doc-terms">' + esc(s.terms) + '</div>' : '') +
          '<div class="doc-sign"><div>Customer signature</div><div>Date</div></div>' +
          '<div class="doc-made">' + (q.takeoff ? 'Proposal' : 'Estimate') + ' made with Coatwright</div>') +
      '</article>';
  }

  /** Alternates and the scope wording on a commercial proposal. */
  function proposalExtras(c) {
    var t = c.takeoff, list = function (txt) {
      var items = String(txt || '').split('\n').map(function (x) { return x.replace(/^[-•*]\s*/, '').trim(); }).filter(Boolean);
      return items.length ? '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    };
    return (c.alternates.length ? '<div class="doc-notes"><div class="label">Alternates (add to the base bid if accepted)</div><table class="lines alt"><tbody>' +
        c.alternates.map(function (a, i) { return lineRow('Alternate ' + (i + 1) + ': ' + a.label, '', 'Add ' + money(a.price)); }).join('') + '</tbody></table></div>' : '') +
      (list(t.inclusions) ? '<div class="doc-notes"><div class="label">Inclusions</div>' + list(t.inclusions) + '</div>' : '') +
      (list(t.exclusions) ? '<div class="doc-notes"><div class="label">Exclusions</div>' + list(t.exclusions) + '</div>' : '') +
      (list(t.clarifications) ? '<div class="doc-notes"><div class="label">Clarifications</div>' + list(t.clarifications) + '</div>' : '');
  }

  function quoteText(job, q, kind) {
    var s = settings, cu = job.customer, out = [], inv = kind === 'invoice';
    var pad = function (label, amt) { return label + ': ' + amt; };
    out.push('Hi ' + (cu.name ? cu.name.split(' ')[0] : 'there') + ',', '');
    out.push(inv ? 'Thank you for choosing us! Here is your invoice (' + invoiceNumber(job) + '). ' + invoiceDue(job) + '.'
      : 'Thank you for the opportunity! Here is our painting ' + (q.takeoff ? 'proposal' : 'estimate') + ' (' + job.number + ').');
    if (P.propertyLabel(job)) out.push('Property: ' + P.propertyLabel(job) + (cu.address ? ' — ' + cu.address : ''));
    out.push('');
    q.rooms.concat(q.outside || []).forEach(function (r) {
      if (!r.lines.length) return;
      out.push(r.name.toUpperCase() + ' — ' + money(r.price));
      r.lines.forEach(function (l) { out.push('  • ' + l.label + ' (' + l.detail + '): ' + (l.included ? 'included' : money(l.price))); });
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
      if (q.deposit && !q.takeoff) out.push(pad('Deposit to book', money(q.deposit)));
      out.push('');
      if (q.quick) out.push(QUICK_NOTE, '');
      if (q.takeoff) {
        var tk = q.takeoff.takeoff;
        q.takeoff.alternates.forEach(function (a, i) { out.push('Alternate ' + (i + 1) + ' (add): ' + a.label + ': ' + money(a.price)); });
        if (q.takeoff.alternates.length) out.push('');
        [['INCLUSIONS', tk.inclusions], ['EXCLUSIONS', tk.exclusions], ['CLARIFICATIONS', tk.clarifications]].forEach(function (x) {
          var items = String(x[1] || '').split('\n').map(function (y) { return y.trim(); }).filter(Boolean);
          if (items.length) out.push(x[0] + ':', items.map(function (y) { return '  • ' + y.replace(/^[-•*]\s*/, ''); }).join('\n'), '');
        });
      }
      if (job.notes) out.push('Notes: ' + job.notes, '');
      if (s.terms && !q.takeoff) out.push(s.terms, '');
      out.push('Reply to this email to accept or with any questions.', '');
    }
    out.push([s.ownerName, s.businessName, s.phone, s.email].filter(Boolean).join('\n'));
    out.push('', '—', (inv ? 'Invoice' : q.takeoff ? 'Proposal' : 'Estimate') + ' made with Coatwright');
    return out.join('\n');
  }

  function renderQuote(job) {
    var q = P.calcJob(job, settings);
    var i = q.internal;
    var g = i.gallons;
    var gal = ['wall', 'ceiling', 'trim', 'primer'].filter(function (k) { return g[k] > 0; })
      .map(function (k) { return k + ' ' + Math.round(g[k] * 10) / 10; }).join(', ') || '—';

    app.innerHTML =
      '<div class="page-head no-print"><a href="#/' + (q.takeoff ? 'takeoff' : 'job') + '/' + job.id + '" class="back">‹ ' + (q.takeoff ? 'Takeoff' : 'Edit') + '</a><span class="muted">' + esc(job.number) + '</span></div>' +
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
      '</div>' + (q.takeoff ? '<table class="to-bid internal-tbl"><tbody>' + q.takeoff.systems.filter(function (r) { return r.qty > 0; }).map(function (r) {
        return '<tr><td>' + esc(r.name) + '<div class="muted small">' + fmtN(r.qty) + ' ' + r.unit + ' · ' + fmtN(r.hours, 1) + ' hrs · buy ' + esc(r.buyText || '—') +
          (r.primerGallons ? ' + primer ' + fmtN(r.primerGallons, 1) + ' gal' : '') + '</div></td><td class="amt">' + money0(r.price) + '<div class="muted small">cost ' + money0(r.cost) + '</div></td></tr>';
      }).join('') + '</tbody></table><a class="btn full" href="#/takeoff/' + job.id + '">📐 Back to the takeoff</a>'
        : '<div class="muted small">Exact paint needed (gal): ' + esc(gal) + '</div>') + '</section>';
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
        '<div class="small">' + esc(S.paymentExample(settings.currency)) + '. Shows on every invoice.</div></div><span>›</span></a>' : '') +
      quoteDocument(job, q, 'invoice') +
      (due === 0 ? '<p class="muted center-text no-print">✅ Paid in full</p>' : '');
  }

  // ---------- Schedule ----------
  function fmtRange(a, b) {
    return a === b ? fmtShort(a) : fmtShort(a) + ' – ' + fmtShort(b);
  }
  function badgeMonth(iso) {
    var d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short' }).replace('.', '');
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
      return '<a class="job-card sched" href="#/job/' + j.id + '"><div class="sched-date"><b>' + esc(badgeMonth(x.start)) + '</b>' +
        '<span>' + esc(String(new Date(x.start + 'T12:00:00').getDate())) + '</span></div>' +
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
    return v >= 10000 ? sym() + Math.round(v / 1000) + 'K' : money0(v);
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
      '<div class="with-unit pre"><em>' + sym() + '</em><input id="ex-amount" type="number" inputmode="decimal" min="0" step="any" placeholder="0" aria-label="Amount"></div>' +
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
      setField('website', 'Website (optional)') +
      '<label class="field"><span>Currency</span>' + currencySelect() + '<small class="muted">Used on your quotes, invoices and stats. When you switch, you can convert your prices once. They never change with exchange rates after that.</small></label>' + '</section>' +

      '<section class="card"><h2 class="card-title">Your prices</h2>' +
      '<div class="row2">' + setField('laborRate', 'Labor rate', { type: 'number', pre: sym(), unit: '/hr', hint: 'What an hour of painting is worth' }) +
      setField('markup', 'Markup', { type: 'number', unit: '%', hint: 'Overhead & profit added on top' }) + '</div>' +
      '<div class="row2">' + setField('minimumJob', 'Minimum job', { type: 'number', pre: sym() }) +
      setField('depositPct', 'Deposit', { type: 'number', unit: '%' }) + '</div>' +
      '<div class="row2">' + setField('taxRate', 'Sales tax', { type: 'number', unit: '%' }) +
      setField('validDays', 'Quote valid for', { type: 'number', unit: 'days' }) + '</div></section>' +

      '<section class="card"><h2 class="card-title">Paint cost <em class="muted small">(what you pay per gallon)</em></h2>' +
      '<div class="row2">' + setField('wallPaintPrice', 'Wall paint', { type: 'number', pre: sym() }) +
      setField('ceilingPaintPrice', 'Ceiling paint', { type: 'number', pre: sym() }) + '</div>' +
      '<div class="row2">' + setField('trimPaintPrice', 'Trim paint', { type: 'number', pre: sym() }) +
      setField('primerPrice', 'Primer', { type: 'number', pre: sym() }) + '</div>' +
      setField('suppliesPct', 'Supplies (tape, plastic, caulk…)', { type: 'number', unit: '% of paint' }) + '</section>' +

      '<section class="card"><h2 class="card-title">Exterior & floor products <em class="muted small">(your cost)</em></h2>' +
      '<div class="row2">' + setField('extPaintPrice', 'Exterior paint', { type: 'number', pre: sym(), unit: '/gal' }) +
      setField('stainPrice', 'Deck & fence stain', { type: 'number', pre: sym(), unit: '/gal' }) + '</div>' +
      '<div class="row2">' + setField('floorPaintPrice', 'Floor paint', { type: 'number', pre: sym(), unit: '/gal' }) +
      setField('epoxySqft', 'Epoxy kit', { type: 'number', pre: sym(), unit: '/sq ft' }) + '</div>' +
      '<div class="row2">' + setField('flakeSqft', 'Epoxy + flake kit', { type: 'number', pre: sym(), unit: '/sq ft' }) +
      setField('cabinetPaintPrice', 'Cabinet enamel', { type: 'number', pre: sym(), unit: '/gal' }) + '</div></section>' +

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
      (accountsOn() && signedIn() ? '<section class="card"><h2 class="card-title">👤 Account</h2>' +
        '<p class="small" style="margin-top:0">Signed in as <b>' + esc(settings.account.email) + '</b></p>' +
        '<button class="btn full" data-action="si-signout">Sign out</button></section>' : '') +
      (!isInstalled() ? '<section class="card"><h2 class="card-title">📲 Install on your phone</h2>' +
        '<p class="muted small" style="margin-top:0">Add Coatwright to your home screen so it opens like a regular app.</p>' +
        '<a class="btn btn-ghost full" href="#/install">Show me how</a></section>' : '') +
      (BC.enabled ? '<section class="card"><h2 class="card-title">⭐ Subscription</h2>' + (function () {
        var a = access();
        return (a.founderNumber && a.mode === 'active' ? '<p class="founder-badge">🔥 Founding Member #' + a.founderNumber + ' of 100</p>' : '') +
          '<p class="small" style="margin-top:0">' + (a.mode === 'active' ? 'Coatwright Pro · ' + esc(BL.planName(a.plan)) + ' ✓<br>' + renewLine(a)
          : a.mode === 'trial' ? 'Free trial · <b>' + a.daysLeft + (a.daysLeft === 1 ? ' day' : ' days') + ' left</b> · ends ' + esc(fmtDate(a.ends))
            : a.mode === 'recheck' ? 'Pro · needs a quick online check' : (a.lapsed ? 'Subscription ended' : 'Free trial ended') + ' · view and export only') + '</p>';
      })() + '<a class="btn ' + (access().mode === 'active' ? '' : 'btn-primary') + ' full" href="#/upgrade">' + (access().mode === 'active' ? 'View plan' : 'See plans') + '</a></section>' : '') +
      '<section class="card"><h2 class="card-title">🔒 Your data</h2>' +
      (syncReady() && accountsOn() && signedIn() ? '<p class="muted small" style="margin-top:0">☁️ <b>Cloud backup is on.</b> Your jobs, customers, expenses and settings are saved privately to your account and ' +
        'stay in sync on every phone, tablet or computer you sign in on. They\'re private: never sold or shared. It works offline too: changes upload when you\'re back online.</p>' +
        '<p class="small sync-note" id="sync-note">' + esc(syncNote()) + '</p>' +
        (syncMeta.declined === settings.account.id ? '<button class="btn full" data-action="sync-replace">Use this account\'s jobs on this device</button>'
          : '<button class="btn full" data-action="sync-now"' + (sync.off ? ' disabled' : '') + '>🔄 Sync now</button>') +
        '<p class="muted small">You can also download a backup file to keep your own copy.' : '<p class="muted small" style="margin-top:0">Your jobs, customers and money stay private on this device and are never uploaded' + (accountsOn() ? ' (only your account and subscription status are stored online)' : '') + '. ' +
      'Make a backup now and then (and before switching phones) so your history is never lost.') +
      (settings.lastBackup ? ' Last backup: <b>' + esc(fmtDate(settings.lastBackup)) + '</b>.' : ' <b>No backup yet.</b>') + '</p>' +
      '<div class="actions"><button class="btn btn-primary" data-action="backup">⬇️ Back up now</button>' +
      '<label class="btn">⬆️ Restore<input type="file" accept=".json,application/json" id="restore-input" hidden></label></div>' +
      '<p class="muted small">' + jobs.length + ' jobs · ' + expenses.length + ' expenses saved.</p></section>' +
      '<button class="link danger center" data-action="reset-settings">Reset prices to defaults</button>' +
      '<section class="card"><h2 class="card-title">💬 Help & feedback</h2>' +
      '<p class="muted small" style="margin-top:0">Questions, a bug, or a feature you want? We read every message.</p>' +
      '<a class="btn btn-ghost full" href="mailto:hello@getcoatwright.com?subject=Coatwright%20feedback">✉️ Email hello@getcoatwright.com</a></section>' +
      '<p class="center-text muted small"><a href="#/welcome/1">Run setup again</a> · <a href="../privacy.html">Privacy Policy</a> · <a href="../terms.html">Terms</a></p>' +
      '<p class="center-text muted small">© ' + new Date().getFullYear() + ' Coatwright. All rights reserved.</p>';

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
      if (!settings.currency) settings.currency = 'USD';
      jobs = data.jobs;
      expenses = Array.isArray(data.expenses) ? data.expenses : [];
      if (syncReady() && syncMeta.deleted) { // restored items come back even if deleted since the backup
        var now = Date.now();
        [['jobs', jobs], ['expenses', expenses]].forEach(function (p) {
          p[1].forEach(function (x) { if (syncMeta.deleted[p[0]] && syncMeta.deleted[p[0]][x.id]) { delete syncMeta.deleted[p[0]][x.id]; x.syncAt = now; } });
        });
        saveMeta();
      }
      saveSettings(); saveJobs(); saveExpenses();
      toast('Backup restored');
      renderSettings();
    };
    reader.readAsText(file);
  }

  // ---------- Commercial blueprint takeoff ----------
  // Screen: #/takeoff/<jobId>. Plan viewer (plan.js) on the left, takeoff list and bid on the right
  // (on a phone: tabs). Pricing in takeoff.js; quotes, invoices and stats use the same calcJob.
  var T = window.Takeoff;
  var to = { jobId: null, viewer: null, pdf: null, planId: null, page: 1, tool: 'measure', systemId: null, zoneId: null,
    selected: null, panel: 'takeoff', mtab: 'plan', ortho: false, countMark: null, history: [], missing: false, loading: false,
    foundScale: null, editSys: null };

  function toJob() { return findJob(to.jobId); }
  function toSys(t, id) { return (t.systems || []).find(function (s) { return s.id === id; }); }
  function toPlan(t) { return (t.plans || []).find(function (p) { return p.id === to.planId; }); }
  function fmtN(n, d) { return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('en-US'); }
  function feetText(ft) {
    var neg = ft < 0, a = Math.abs(ft), f = Math.floor(a), inch = Math.round((a - f) * 12);
    if (inch === 12) { f++; inch = 0; }
    return (neg ? '−' : '') + f + '′' + (inch ? ' ' + inch + '″' : '');
  }
  /** "12", "12.5", "12'6", "12' 6\"", "12 ft 6 in" → feet */
  function parseFeet(s) {
    var m = String(s || '').trim().replace(/ft|feet/gi, "'").replace(/in(ches)?/gi, '"').match(/^(\d+(?:\.\d+)?)\s*'?\s*(?:-?\s*(\d+(?:\.\d+)?)\s*"?)?$/);
    if (!m) return 0;
    return parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0);
  }
  function ensureTakeoff(job) {
    if (!job.takeoff) job.takeoff = T.newTakeoff(settings);
    var t = job.takeoff;
    ['systems', 'zones', 'marks', 'plans', 'adds', 'alternates'].forEach(function (k) { if (!Array.isArray(t[k])) t[k] = []; });
    if (!t.zones.length) t.zones.push({ id: T.uid(), name: 'Level 1' });
    return t;
  }

  function renderTakeoff(job) {
    var t = ensureTakeoff(job);
    if (to.jobId !== job.id) {
      if (to.viewer) to.viewer.destroy();
      to = Object.assign(to, { jobId: job.id, viewer: null, pdf: null, planId: t.plans[0] ? t.plans[0].id : null, page: 1,
        tool: 'measure', selected: null, countMark: null, history: [], missing: false, foundScale: null, editSys: null, mtab: t.plans.length ? 'plan' : 'takeoff' });
    }
    if (!toSys(t, to.systemId)) to.systemId = t.systems[0] ? t.systems[0].id : null;
    if (!t.zones.some(function (z) { return z.id === to.zoneId; })) to.zoneId = t.zones[0].id;
    var title = job.customer.name || job.number;
    app.innerHTML = '<div class="to" data-mtab="' + to.mtab + '">' +
      '<div class="to-bar"><a class="back" href="#/job/' + job.id + '">‹ Job</a>' +
      '<div class="to-title"><b>' + esc(title) + '</b><span class="muted small">Blueprint takeoff <span class="beta">BETA</span></span></div>' +
      '<div class="to-total"><span class="muted small">Bid total</span><b data-out="to-total"></b></div>' +
      '<a class="btn btn-primary to-proposal" href="#/quote/' + job.id + '">Proposal ›</a></div>' +
      '<div class="to-mtabs" role="tablist">' + [['plan', '📄 Plan'], ['takeoff', '📏 Takeoff'], ['bid', '💲 Bid']].map(function (x) {
        return '<button type="button" role="tab" data-action="to-mtab" data-v="' + x[0] + '" class="' + (to.mtab === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="to-body"><section class="to-planwrap">' +
      '<div class="to-plantools" data-out="to-plantools"></div>' +
      '<div class="to-stage" id="to-stage"></div>' +
      '<div class="to-hint" data-out="to-hint"></div></section>' +
      '<aside class="to-panel" id="to-panel"></aside></div>' +
      '<input type="file" id="to-file" accept="application/pdf,.pdf" hidden></div>';
    sizeTakeoff();
    document.getElementById('to-file').addEventListener('change', onPlanFile);
    toRefresh(true);
    openCurrentPlan();
  }

  function sizeTakeoff() {
    var box = app.querySelector('.to');
    if (!box) return;
    var top = document.querySelector('.topbar');
    box.style.height = Math.max(420, window.innerHeight - (top ? top.offsetHeight : 0)) + 'px';
  }
  window.addEventListener('resize', function () { if (document.body.dataset.view === 'takeoff') sizeTakeoff(); });

  // ----- Plans -----
  function openCurrentPlan() {
    var job = toJob(), t = job && job.takeoff, stage = document.getElementById('to-stage');
    if (!stage) return;
    var plan = t && toPlan(t);
    if (!plan) { stage.innerHTML = emptyStage(); to.viewer = null; toRefresh(); return; }
    stage.innerHTML = '<div class="to-loading">Opening ' + esc(plan.name) + '…</div>';
    to.loading = true;
    PlanStore.get(plan.id).then(function (file) {
      if (!file || !file.data) { to.missing = true; to.loading = false; stage.innerHTML = missingStage(plan); toRefresh(); return; }
      to.missing = false;
      return PlanPdf.open(file.data).then(function (pdf) {
        if (!document.getElementById('to-stage') || to.jobId !== job.id) return;
        to.pdf = pdf;
        if (!plan.pages) { plan.pages = pdf.numPages; touch(job); }
        if (to.page > pdf.numPages) to.page = 1;
        if (!to.viewer || !document.body.contains(to.viewer.c)) { if (to.viewer) to.viewer.destroy(); to.viewer = makeViewer(document.getElementById('to-stage')); }
        return showPlanPage();
      });
    }).catch(function (e) {
      to.loading = false;
      stage.innerHTML = '<div class="to-empty"><p>⚠️ ' + esc(e.message || 'Couldn\'t open this plan.') + '</p></div>';
    });
  }
  function showPlanPage() {
    var job = toJob(), t = job.takeoff;
    to.loading = true; to.countMark = null; to.foundScale = null;
    return to.viewer.showPage(to.pdf, to.page).then(function () {
      to.loading = false;
      applyTool();
      toRefresh();
      var plan = toPlan(t);
      if (plan && !(plan.scales && plan.scales[to.page])) detectScale();
    });
  }
  /** Most drawings print their scale ("SCALE: 1/8" = 1'-0""); offer it so the painter doesn't have to look. */
  function detectScale() {
    var page = to.viewer && to.viewer.page;
    if (!page) return;
    page.getTextContent().then(function (tc) {
      var text = tc.items.map(function (i) { return i.str; }).join(' ').replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'");
      var found = null;
      T.SCALES.forEach(function (s) {
        var esc2 = s.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*').replace(/-/g, '\\s*-?\\s*').replace(/=/g, '\\s*=\\s*');
        if (!found && new RegExp('(^|[^\\d/])' + esc2).test(text)) found = s;
      });
      to.foundScale = found;
      toRefresh();
    }).catch(function () {});
  }
  function emptyStage() {
    return '<div class="to-empty"><div class="to-empty-icon">📄</div><h2>Add your blueprint</h2>' +
      '<p class="muted">Open the PDF drawing set. Measure walls, ceilings and doors right on the plan, and the bid builds itself.</p>' +
      '<button type="button" class="btn btn-primary" data-action="to-add-plan">📂 Choose PDF blueprint</button>' +
      '<p class="muted small">Measured in Adobe or Bluebeam already? Type your totals in the <b>Takeoff</b> list instead.</p>' +
      '<button type="button" class="link" data-action="to-demo">👀 Or try the demo office plan</button></div>';
  }
  function missingStage(plan) {
    return '<div class="to-empty"><div class="to-empty-icon">📄</div><h2>Plan file not on this device</h2>' +
      '<p class="muted">Your measurements are saved. To see <b>' + esc(plan.name) + '</b> here, open the same PDF on this device once.</p>' +
      '<button type="button" class="btn btn-primary" data-action="to-add-plan">📂 Choose ' + esc(plan.name) + '</button></div>';
  }
  function onPlanFile(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast('Please choose a PDF file'); return; }
    var job = toJob(), t = job.takeoff, stage = document.getElementById('to-stage');
    if (stage) stage.innerHTML = '<div class="to-loading">Opening ' + esc(file.name) + '…</div>';
    file.arrayBuffer().then(function (buf) {
      return PlanPdf.open(buf).then(function (pdf) {
        var existing = t.plans.find(function (p) { return p.name === file.name && p.size === file.size; }) ||
          (to.missing && toPlan(t) && confirm('Use "' + file.name + '" for "' + toPlan(t).name + '"?') ? toPlan(t) : null);
        var plan = existing || { id: T.uid(), name: file.name, size: file.size, pages: pdf.numPages, scales: {} };
        if (!existing) t.plans.push(plan);
        return PlanStore.put(plan.id, { name: file.name, size: file.size, data: buf }).then(function () {
          to.planId = plan.id; to.page = 1; to.pdf = null; to.mtab = 'plan';
          touch(job);
          app.querySelector('.to').dataset.mtab = 'plan';
          openCurrentPlan();
          toast(existing ? 'Plan reconnected' : 'Plan added: ' + pdf.numPages + (pdf.numPages === 1 ? ' page' : ' pages'));
        });
      });
    }).catch(function (err) {
      toast('Couldn\'t open that PDF' + (err && err.message ? ': ' + err.message : ''));
      openCurrentPlan();
    });
  }

  function makeViewer(stage) {
    return new PlanViewer(stage, {
      marks: function () {
        var job = toJob(); if (!job) return [];
        var t = job.takeoff;
        return t.marks.filter(function (m) { return m.planId === to.planId && m.page === to.page && m.kind !== 'typed'; }).map(function (m) {
          var s = toSys(t, m.systemId);
          return { id: m.id, kind: m.kind, pts: m.pts, closed: m.closed, color: s ? s.color : '#888', selected: m.id === to.selected };
        });
      },
      onDraft: function () { toRefreshHint(); },
      draftColor: function () { var s = toSys(toJob().takeoff, to.systemId); return s ? s.color : '#1f5eff'; },
      liveLabel: function (kind, pts) {
        var t = toJob().takeoff, f = T.scaleOf(t, to.planId, to.page), s = toSys(t, to.systemId);
        if (kind === 'calibrate') return pts.length > 1 ? 'Tap the other end' : '';
        if (!f) return 'Set the scale first';
        if (kind === 'area') return pts.length > 2 ? fmtN(T.polygonArea(pts) * f * f) + ' sq ft' : feetText(T.pathLength(pts) * f);
        var lf = T.pathLength(pts) * f;
        return feetText(lf) + (s && s.measure === 'wall' ? ' × ' + fmtN(Number(t.wallHeight) || 10, 1) + '′ = ' + fmtN(lf * (Number(t.wallHeight) || 10)) + ' sq ft' : '');
      },
      onMeasure: function (m) {
        var job = toJob(), t = job.takeoff, s = toSys(t, to.systemId);
        if (!s) return;
        if (!T.scaleOf(t, to.planId, to.page)) { toast('Set the drawing scale first (📐 Scale)'); return; }
        var mark = { id: T.uid(), systemId: s.id, zoneId: to.zoneId, kind: m.kind === 'area' ? 'area' : 'line', closed: !!m.closed,
          planId: to.planId, page: to.page, pts: m.pts.map(function (p) { return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]; }) };
        if (s.measure === 'wall') mark.h = Number(t.wallHeight) || 10;
        t.marks.push(mark); to.history.push({ id: mark.id }); to.selected = null;
        touch(job); to.viewer.draw(); toRefresh();
        var q = T.markQty(t, mark, s);
        toast('✓ ' + fmtN(q.qty) + ' ' + T.MEASURES[s.measure].unit + ' added to ' + s.name);
      },
      onCount: function (p) {
        var job = toJob(), t = job.takeoff, s = toSys(t, to.systemId);
        if (!s) return;
        var mk = t.marks.find(function (m) { return m.id === to.countMark; });
        if (!mk || mk.systemId !== s.id || mk.zoneId !== to.zoneId || mk.page !== to.page || mk.planId !== to.planId) {
          mk = { id: T.uid(), systemId: s.id, zoneId: to.zoneId, kind: 'count', planId: to.planId, page: to.page, pts: [] };
          t.marks.push(mk); to.countMark = mk.id;
        }
        mk.pts.push([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
        to.history.push({ id: mk.id, pt: true });
        touch(job); to.viewer.draw(); toRefresh();
      },
      onCalibrate: function (pts) {
        var job = toJob(), t = job.takeoff, plan = toPlan(t);
        var ans = prompt('How long is that line in real life? (e.g. 20 or 12\'6")', '');
        var ftv = parseFeet(ans);
        if (!ftv) { if (ans !== null) toast('Type a length in feet, like 20 or 12\'6"'); return; }
        var d = T.dist(pts[0], pts[1]);
        if (!(d > 0)) return;
        setScale(job, plan, { ftPerPt: ftv / d, label: 'Measured: ' + feetText(ftv) });
      },
      onSelect: function (id) {
        to.selected = id;
        if (id) { var m = toJob().takeoff.marks.find(function (x) { return x.id === id; }); if (m) { to.systemId = m.systemId; to.zoneId = m.zoneId; } }
        to.viewer.draw(); toRefresh(true);
      }
    });
  }
  function setScale(job, plan, sc) {
    plan.scales = plan.scales || {};
    plan.scales[to.page] = sc;
    to.foundScale = null;
    touch(job);
    to.tool = 'measure'; applyTool(); toRefresh(true);
    toast('📐 Scale set: ' + sc.label);
  }
  function applyTool() {
    if (!to.viewer) return;
    var s = toSys(toJob().takeoff, to.systemId);
    var vt = to.tool === 'measure' ? (s ? T.MEASURES[s.measure].tool : 'pan') : to.tool === 'scale' ? 'calibrate' : to.tool;
    to.viewer.ortho = to.ortho;
    if (to.viewer.tool !== vt) to.viewer.setTool(vt);
    to.countMark = null;
  }

  // ----- Panel & toolbar -----
  function toolbarHtml(t) {
    var plan = toPlan(t), pages = plan && plan.pages || 1, sc = plan && plan.scales && plan.scales[to.page];
    var tb = function (tool, icon, label, title) {
      return '<button type="button" class="to-tool' + (to.tool === tool ? ' on' : '') + '" data-action="to-tool" data-v="' + tool + '" title="' + title + '">' +
        '<span>' + icon + '</span>' + label + '</button>';
    };
    return '<div class="to-tb-row">' +
      (t.plans.length ? '<select data-to="plan" aria-label="Plan">' + t.plans.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === to.planId ? ' selected' : '') + '>' + esc(p.name.replace(/\.pdf$/i, '')) + '</option>';
      }).join('') + '</select>' : '') +
      '<button type="button" class="to-tool sm" data-action="to-add-plan" title="Add a PDF plan">＋ Plan</button>' +
      (plan && pages > 1 ? '<div class="to-pages"><button type="button" class="to-tool sm" data-action="to-page" data-v="-1" aria-label="Previous page">‹</button>' +
        '<span>Page ' + to.page + ' / ' + pages + '</span><button type="button" class="to-tool sm" data-action="to-page" data-v="1" aria-label="Next page">›</button></div>' : '') +
      (plan ? '<button type="button" class="to-scale' + (sc ? '' : ' warn') + '" data-action="to-tool" data-v="scale">📐 ' + (sc ? esc(sc.label) : 'Set scale') + '</button>' : '') +
      '</div>' +
      (plan && !to.missing ? '<div class="to-tb-row">' + tb('measure', '✏️', 'Measure', 'Measure with the selected paint system (M)') + tb('select', '👆', 'Select', 'Pick a measurement to edit or delete (V)') +
        tb('pan', '✋', 'Move', 'Drag to move around the plan (H)') +
        '<button type="button" class="to-tool' + (to.ortho ? ' on' : '') + '" data-action="to-ortho" title="Straight lines only (or hold Shift)"><span>📏</span>Straight</button>' +
        '<button type="button" class="to-tool" data-action="to-undo" title="Undo last measurement (Ctrl+Z)"><span>↶</span>Undo</button>' +
        '<span class="to-zoom"><button type="button" class="to-tool sm" data-action="to-zoom" data-v="out" aria-label="Zoom out">−</button>' +
        '<button type="button" class="to-tool sm" data-action="to-zoom" data-v="fit" aria-label="Fit page">⤢</button>' +
        '<button type="button" class="to-tool sm" data-action="to-zoom" data-v="in" aria-label="Zoom in">＋</button></span></div>' : '');
  }

  function hintHtml(t) {
    var plan = toPlan(t), s = toSys(t, to.systemId), v = to.viewer;
    if (!plan || to.missing || !v) return '';
    var sc = plan.scales && plan.scales[to.page];
    if (to.tool === 'scale' || !sc) {
      return '<div class="to-hint-row"><b>📐 Drawing scale for this page</b>' +
        (to.foundScale ? '<button type="button" class="btn btn-primary sm" data-action="to-scale-found">Use ' + esc(to.foundScale.label) + ' (found on sheet)</button>' : '') +
        '<select data-to="scale" aria-label="Drawing scale"><option value="">Pick the scale…</option>' + T.SCALES.map(function (x, i) {
          return '<option value="' + i + '"' + (sc && sc.label === x.label ? ' selected' : '') + '>' + esc(x.label) + '</option>';
        }).join('') + '</select>' +
        '<span class="muted small">or tap both ends of a known dimension on the plan.' + (sc ? '' : ' Plans printed smaller than full size: use a known dimension.') + '</span>' +
        (sc && to.tool === 'scale' ? '<button type="button" class="link" data-action="to-tool" data-v="measure">Done</button>' : '') + '</div>';
    }
    var drawing = v.drawing();
    var how = !s ? 'Add a paint system to start measuring.' : to.tool === 'select' ? 'Tap a measurement on the plan to select it.' : to.tool === 'pan' ? 'Drag to move. Pinch or scroll to zoom.'
      : s.measure === 'count' ? 'Tap each one on the plan to count it. (' + esc(s.name) + ')'
        : s.measure === 'area' ? 'Tap the corners of the area. Tap the first point (or double-click) to finish.'
          : 'Tap along the walls. Tap the first point to close a room, or double-click / Finish to end a run.';
    return '<div class="to-hint-row">' + (s && to.tool === 'measure' ? '<span class="dot" style="background:' + esc(s.color) + '"></span>' : '') +
      '<span>' + how + '</span>' +
      (drawing ? '<button type="button" class="btn btn-primary sm" data-action="to-finish">✓ Finish</button><button type="button" class="btn sm" data-action="to-backpt">⌫ Point</button>' +
        '<button type="button" class="btn sm" data-action="to-cancel">Cancel</button>' : '') +
      (to.selected ? '<button type="button" class="btn sm danger-btn" data-action="to-del-mark" data-id="' + to.selected + '">🗑 Delete selected</button>' : '') + '</div>';
  }

  function markText(t, m, s) {
    var q = T.markQty(t, m, s), u = T.MEASURES[s.measure].unit;
    if (q.noScale) return 'Needs the page scale';
    var plan = (t.plans || []).find(function (p) { return p.id === m.planId; });
    var where = (m.label ? '<b>' + esc(m.label) + '</b> · ' : '') + (plan && (t.plans.length > 1 || plan.pages > 1) ? esc(plan.name.replace(/\.pdf$/i, '')) + (plan.pages > 1 ? ' p.' + m.page : '') + ' · ' : '');
    if (m.kind === 'count') return where + q.qty + ' counted';
    if (s.measure === 'wall') return where + (m.label ? '' : m.closed ? 'Room ' : 'Wall run ') + feetText(q.lf) + ' × ' + fmtN(Number(m.h) || Number(t.wallHeight) || 10, 1) + '′ = <b>' + fmtN(q.qty) + ' ' + u + '</b>';
    return where + (m.label ? '' : m.kind === 'area' ? 'Area ' : m.closed ? 'Perimeter ' : 'Run ') + '<b>' + fmtN(q.qty) + ' ' + u + '</b>';
  }

  function systemEditor(t, s) {
    var meas = T.MEASURES[s.measure], count = s.measure === 'count';
    return '<div class="to-sysedit">' +
      '<label class="field"><span>Name on the proposal</span><input data-to="sys.' + s.id + '.name" value="' + esc(s.name) + '"></label>' +
      '<div class="row2"><label class="field"><span>Measured as</span><select data-to="sys.' + s.id + '.measure">' + Object.keys(T.MEASURES).map(function (k) {
        return '<option value="' + k + '"' + (k === s.measure ? ' selected' : '') + '>' + T.MEASURES[k].label + '</option>';
      }).join('') + '</select></label>' +
      (count ? '' : '<label class="field"><span>Coats</span><input type="number" inputmode="numeric" min="1" data-to="sys.' + s.id + '.coats" value="' + esc(s.coats) + '"></label>') + '</div>' +
      (count ? '' : '<label class="check"><input type="checkbox" data-to="sys.' + s.id + '.primer"' + (s.primer ? ' checked' : '') + '> Add a primer / block filler coat</label>') +
      '<div class="row2"><label class="field"><span>Production</span><div class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" data-to="sys.' + s.id + '.rate" value="' + esc(s.rate) + '"><em>' + (count ? 'hrs each' : meas.unit + '/hr') + '</em></div>' +
      '<small class="muted">' + meas.rateUnit + '</small></label>' +
      '<label class="field"><span>Paint use</span><div class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" data-to="sys.' + s.id + '.coverage" value="' + esc(s.coverage) + '"><em>' + (count ? 'gal each' : meas.unit + '/gal') + '</em></div>' +
      '<small class="muted">' + meas.coverUnit + '</small></label></div>' +
      '<div class="row2"><label class="field"><span>Paint price</span><div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-to="sys.' + s.id + '.price" value="' + esc(s.price) + '"></div><small class="muted">per gallon</small></label>' +
      '<label class="field"><span>Sheen</span><select data-to="sys.' + s.id + '.sheen"><option value=""></option>' + P.SHEENS.map(function (x) {
        return '<option' + (s.sheen === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="row2"><label class="field"><span>Brand</span><input list="paint-brands-to" data-to="sys.' + s.id + '.brand" value="' + esc(s.brand) + '" placeholder="Sherwin-Williams"></label>' +
      '<label class="field"><span>Product</span><input data-to="sys.' + s.id + '.product" value="' + esc(s.product) + '" placeholder="ProMar 200"></label></div>' +
      '<label class="field"><span>Colour(s)</span><input data-to="sys.' + s.id + '.paintColor" value="' + esc(s.paintColor) + '" placeholder="e.g. Agreeable Gray SW 7029"></label>' +
      '<div class="label">Colour on the plan</div><div class="to-swatches">' + T.COLORS.map(function (c) {
        return '<button type="button" class="to-swatch' + (c === s.color ? ' on' : '') + '" style="background:' + c + '" data-action="to-sys-color" data-id="' + s.id + '" data-v="' + c + '" aria-label="Colour"></button>';
      }).join('') + '</div>' +
      '<div class="to-sysedit-foot"><button type="button" class="link danger" data-action="to-sys-del" data-id="' + s.id + '">Delete system</button>' +
      '<button type="button" class="btn sm" data-action="to-sys-edit" data-id="">Done</button></div></div>';
  }

  function takeoffPanel(t, c) {
    var zoneSel = '<select data-to="zone" aria-label="Floor or area">' + t.zones.map(function (z) {
      return '<option value="' + z.id + '"' + (z.id === to.zoneId ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select>';
    var rows = c.systems.map(function (r) {
      var s = r.sys, on = s.id === to.systemId, marks = t.marks.filter(function (m) { return m.systemId === s.id; });
      var body = '';
      if (on) {
        body = '<div class="to-sysbody">' + (to.editSys === s.id ? systemEditor(t, s) : '') +
          (marks.length ? '<ul class="to-marks">' + marks.map(function (m) {
            var z = t.zones.find(function (x) { return x.id === m.zoneId; });
            var zl = '<span class="to-zone">' + esc(z ? z.name : t.zones[0].name) + '</span>';
            if (m.kind === 'typed') {
              return '<li class="typed">' + zl + '<span class="to-typed">' +
                '<input type="number" inputmode="decimal" step="any" data-to="mark.' + m.id + '.qty" value="' + esc(m.qty) + '" aria-label="Quantity" placeholder="0">' +
                (s.measure === 'wall' ? '<em>' + (Number(m.h) > 0 ? 'lin ft ×' : 'sq ft') + '</em><input type="number" inputmode="decimal" step="any" class="h" data-to="mark.' + m.id + '.h" value="' + esc(m.h || '') + '" placeholder="height" aria-label="Wall height (optional)">' +
                  (Number(m.h) > 0 ? '<em>ft</em>' : '') : '<em>' + T.MEASURES[s.measure].unit + '</em>') +
                '<input class="note" data-to="mark.' + m.id + '.note" value="' + esc(m.note || '') + '" placeholder="note (e.g. Suite 200)" aria-label="Note"></span>' +
                '<label class="ded" title="Subtract this amount"><input type="checkbox" data-to="mark.' + m.id + '.deduct"' + (m.deduct ? ' checked' : '') + '> −</label>' +
                '<button type="button" class="icon-btn sm" data-action="to-del-mark" data-id="' + m.id + '" aria-label="Delete">✕</button></li>';
            }
            return '<li class="' + (m.id === to.selected ? 'sel' : '') + '" data-action="to-pick-mark" data-id="' + m.id + '">' + zl + '<span class="to-mtext">' + (m.deduct ? '− ' : '') + markText(t, m, s) + '</span>' +
              '<button type="button" class="icon-btn sm" data-action="to-del-mark" data-id="' + m.id + '" aria-label="Delete">✕</button></li>';
          }).join('') + '</ul>' : '<p class="muted small">Nothing measured yet. ' + (t.plans.length ? 'Measure on the plan, or type a number.' : 'Add a plan, or type the total from Adobe/Bluebeam.') + '</p>') +
          '<div class="to-sysactions"><button type="button" class="btn btn-ghost sm" data-action="to-type">⌨️ Type a number</button>' +
          (to.editSys === s.id ? '' : '<button type="button" class="btn sm" data-action="to-sys-edit" data-id="' + s.id + '">⚙️ Rates & paint</button>') + '</div></div>';
      }
      return '<div class="to-sys' + (on ? ' on' : '') + '"><button type="button" class="to-syshead" data-action="to-sys" data-id="' + s.id + '">' +
        '<span class="dot" style="background:' + esc(s.color) + '"></span><span class="to-sysname">' + esc(s.name) +
        (r.noScale ? '<span class="warn small"> · ' + r.noScale + ' need scale</span>' : '') + '</span>' +
        '<span class="to-sysqty" data-out="to-q-' + s.id + '">' + (r.qty ? fmtN(r.qty) + ' ' + r.unit : '—') + '</span>' +
        '<span class="to-sysprice" data-out="to-p-' + s.id + '">' + (r.price ? money0(r.price) : '') + '</span></button>' + body + '</div>';
    }).join('');
    return '<div class="to-ptop"><label class="to-inline"><span>Floor / area</span>' + zoneSel + '</label>' +
      '<button type="button" class="to-tool sm" data-action="to-zone-add" title="Add a floor or area">＋</button>' +
      '<button type="button" class="to-tool sm" data-action="to-zone-rename" title="Rename">✎</button>' +
      '<label class="to-inline"><span>Wall height</span><div class="with-unit"><input type="number" inputmode="decimal" min="1" step="any" data-to="t.wallHeight" value="' + esc(t.wallHeight) + '"><em>ft</em></div></label></div>' +
      '<div class="to-syslist">' + rows + '</div>' +
      '<div class="to-addsys"><select data-to="add-system" aria-label="Add a paint system"><option value="">＋ Add a paint system…</option>' +
      T.SYSTEM_PRESETS.map(function (p) { return '<option value="' + p.key + '">' + esc(p.name) + '</option>'; }).join('') + '</select></div>';
  }

  function bidPanel(t, c) {
    var unit = t.method === 'unit', tt = c.totals;
    var sysRows = c.systems.filter(function (r) { return r.qty > 0 || unit; }).map(function (r) {
      return '<tr><td><span class="dot" style="background:' + esc(r.color) + '"></span>' + esc(r.name) + '<div class="muted small">' + fmtN(r.qty) + ' ' + r.unit +
        ' · ' + fmtN(r.hours, 1) + ' hrs · ' + (r.gallons ? fmtN(r.gallons + r.primerGallons, 1) + ' gal' : '') + '</div></td>' +
        (unit ? '<td class="amt"><div class="with-unit pre sm"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-to="sys.' + r.id + '.unitPrice" value="' + esc(r.sys.unitPrice) + '" placeholder="' + r.perUnit + '"></div>' +
          '<div class="muted small">per ' + (r.unit === 'each' ? 'each' : r.unit.replace('sq ft', 'sq ft').replace('lin ft', 'lin ft')) + '</div></td>' : '') +
        '<td class="amt" data-out="to-bp-' + r.id + '"><b>' + money0(r.price) + '</b><div class="muted small">cost ' + money0(r.cost) + '</div></td></tr>';
    }).join('');
    return '<div class="label" style="margin-top:0">Price by</div><div class="segmented">' +
      '<button type="button" class="' + (unit ? '' : 'on') + '" data-action="to-method" data-v="hours">⏱ Labour hours</button>' +
      '<button type="button" class="' + (unit ? 'on' : '') + '" data-action="to-method" data-v="unit">📐 Unit prices</button></div>' +
      '<p class="muted small">' + (unit ? 'Your price per sq ft, lin ft or each. The grey number is what your hours, paint and markup work out to.' : 'Hours from your production rates × labour rate, plus paint, supplies, overhead and profit.') + '</p>' +
      '<div class="row3"><label class="field"><span>Labour rate</span><div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-to="t.laborRate" value="' + esc(t.laborRate) + '" placeholder="' + esc(settings.laborRate) + '"></div><small class="muted">per hour</small></label>' +
      '<label class="field"><span>Overhead</span><div class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" data-to="t.overheadPct" value="' + esc(t.overheadPct) + '"><em>%</em></div></label>' +
      '<label class="field"><span>Profit</span><div class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" data-to="t.profitPct" value="' + esc(t.profitPct) + '"><em>%</em></div></label></div>' +
      '<table class="to-bid"><tbody>' + (sysRows || '<tr><td class="muted">Measure something in the Takeoff list first.</td></tr>') + '</tbody></table>' +
      '<div class="label">Extra costs <span class="muted small">(lifts, mobilization… marked up like the rest)</span></div>' +
      t.adds.map(function (a) {
        return '<div class="extra-row"><input data-to="add.' + a.id + '.label" value="' + esc(a.label) + '" placeholder="e.g. Scissor lift rental" aria-label="Cost item">' +
          '<div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-to="add.' + a.id + '.cost" value="' + esc(a.cost) + '" aria-label="Your cost"></div>' +
          '<button type="button" class="icon-btn" data-action="to-del-add" data-id="' + a.id + '" aria-label="Remove">✕</button></div>';
      }).join('') +
      '<select data-to="add-cost" class="to-addsel" aria-label="Add a cost"><option value="">＋ Add a cost…</option>' + T.ADD_PRESETS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '<option value="__other">Other…</option></select>' +
      '<div class="label">Alternates <span class="muted small">(optional add-ons, shown on the proposal, not in the total)</span></div>' +
      t.alternates.map(function (a) {
        return '<div class="extra-row"><input data-to="alt.' + a.id + '.label" value="' + esc(a.label) + '" placeholder="e.g. Paint stairwell B" aria-label="Alternate">' +
          '<div class="with-unit pre"><em>' + sym() + '</em><input type="number" inputmode="decimal" min="0" step="any" data-to="alt.' + a.id + '.price" value="' + esc(a.price) + '" aria-label="Price"></div>' +
          '<button type="button" class="icon-btn" data-action="to-del-alt" data-id="' + a.id + '" aria-label="Remove">✕</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost sm" data-action="to-add-alt">＋ Add alternate</button>' +
      '<div class="to-totals" data-out="to-totals">' + totalsHtml(c) + '</div>' +
      '<div class="label">Proposal shows</div><div class="segmented">' + [['system', 'Each paint system'], ['zone', 'Each floor / area'], ['lump', 'One lump sum']].map(function (x) {
        return '<button type="button" class="' + ((t.breakdown || 'system') === x[0] ? 'on' : '') + '" data-action="to-breakdown" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<details class="to-words"><summary>Inclusions, exclusions & clarifications</summary>' +
      '<label class="field"><span>Project name (optional)</span><input data-to="t.project" value="' + esc(t.project || '') + '" placeholder="e.g. Harbour Point Offices — Level 2 fit-out"></label>' +
      '<label class="field"><span>Inclusions</span><textarea rows="5" data-to="t.inclusions">' + esc(t.inclusions) + '</textarea></label>' +
      '<label class="field"><span>Exclusions</span><textarea rows="5" data-to="t.exclusions">' + esc(t.exclusions) + '</textarea></label>' +
      '<label class="field"><span>Clarifications</span><textarea rows="4" data-to="t.clarifications">' + esc(t.clarifications) + '</textarea></label></details>' +
      '<a class="btn btn-primary full" href="#/quote/' + to.jobId + '">📄 Preview & send proposal ›</a>';
  }
  function totalsHtml(c) {
    var tt = c.totals, job = toJob(), q = P.calcJob(job, settings);
    var row = function (l, v, cls) { return '<div class="' + (cls || '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
    return row('Labour (' + fmtN(tt.hours, 1) + ' hrs · ' + fmtN(tt.crewDays, 1) + ' crew-days)', money0(tt.labor)) +
      row('Paint & supplies', money0(tt.materials)) + (tt.addsCost ? row('Extra costs', money0(tt.addsCost)) : '') +
      row('Your cost', money0(tt.cost), 'sub') + row('Overhead & profit', money0(tt.systemsPrice + tt.addsPrice - tt.cost)) +
      (q.tax ? row('Tax', money0(q.tax)) : '') + row('Bid total', money0(q.total), 'grand') +
      (c.alternates.length ? row('Alternates offered', c.alternates.length + ' · ' + money0(c.alternates.reduce(function (a, x) { return a + x.price; }, 0)), 'sub') : '');
  }

  /** Re-render the panel and toolbar; keeps the field you're typing in (only its numbers update). */
  function toRefresh(full) {
    var job = toJob(), panel = document.getElementById('to-panel');
    if (!job || !panel) return;
    var t = job.takeoff, c = T.calc(job, settings);
    var html = '<div class="to-ptabs" role="tablist">' + [['takeoff', '📏 Takeoff'], ['bid', '💲 Bid']].map(function (x) {
      return '<button type="button" role="tab" data-action="to-panel" data-v="' + x[0] + '" class="' + (to.panel === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="to-pbody">' + (to.panel === 'bid' ? bidPanel(t, c) : takeoffPanel(t, c)) + '</div>' +
      '<datalist id="paint-brands-to">' + ['Sherwin-Williams', 'Benjamin Moore', 'PPG', 'Behr', 'Dulux', 'Cloverdale', 'General Paint', 'Rust-Oleum', 'Tnemec', 'Carboline']
        .map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist>';
    var focusInside = panel.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (full || !focusInside) {
      var st = panel.querySelector('.to-pbody'), keep = st ? st.scrollTop : 0;
      panel.innerHTML = html;
      var nb = panel.querySelector('.to-pbody'); if (nb) nb.scrollTop = keep;
    } else {
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      tmp.querySelectorAll('[data-out]').forEach(function (n) {
        var cur = panel.querySelector('[data-out="' + n.getAttribute('data-out') + '"]');
        if (cur && !cur.contains(document.activeElement)) cur.innerHTML = n.innerHTML;
      });
    }
    var tot = app.querySelector('[data-out="to-total"]'); if (tot) tot.textContent = money0(P.calcJob(job, settings).total);
    var tb = app.querySelector('[data-out="to-plantools"]'); if (tb && !tb.contains(document.activeElement)) tb.innerHTML = toolbarHtml(t);
    var hint = app.querySelector('[data-out="to-hint"]'); if (hint && !hint.contains(document.activeElement)) hint.innerHTML = hintHtml(t);
  }

  function onToInput(el) {
    var job = toJob(); if (!job) return;
    var t = job.takeoff, key = el.dataset.to, v = el.type === 'checkbox' ? el.checked : el.value;
    var parts = key.split('.');
    if (key === 'zone') { to.zoneId = v; to.countMark = null; toRefresh(true); return; }
    if (key === 'plan') { to.planId = v; to.page = 1; to.selected = null; openCurrentPlan(); toRefresh(true); return; }
    if (key === 'scale') { if (v !== '') setScale(job, toPlan(t), T.SCALES[+v]); return; }
    if (key === 'add-system') {
      if (!v) return;
      var s = T.newSystem(v, settings, t.systems.length);
      t.systems.push(s); to.systemId = s.id; to.editSys = null; to.tool = 'measure';
      touch(job); applyTool(); toRefresh(true); toast('Added: ' + s.name);
      return;
    }
    if (key === 'add-cost') {
      if (!v) return;
      t.adds.push({ id: T.uid(), label: v === '__other' ? '' : v, cost: '' });
      touch(job); toRefresh(true);
      var inputs = app.querySelectorAll('[data-to^="add."][data-to$=".cost"]'); if (inputs.length) inputs[inputs.length - 1].focus();
      return;
    }
    var target = null, field = parts[parts.length - 1];
    if (parts[0] === 't') target = t;
    else if (parts[0] === 'sys') target = toSys(t, parts[1]);
    else if (parts[0] === 'mark') target = t.marks.find(function (m) { return m.id === parts[1]; });
    else if (parts[0] === 'add') target = t.adds.find(function (a) { return a.id === parts[1]; });
    else if (parts[0] === 'alt') target = t.alternates.find(function (a) { return a.id === parts[1]; });
    if (!target) return;
    var numeric = el.type === 'number';
    target[field] = numeric ? (v === '' ? '' : Number(v)) : v;
    if (parts[0] === 'sys' && field === 'measure') { to.tool = 'measure'; applyTool(); touch(job); toRefresh(true); return; }
    touch(job);
    if (el.type === 'checkbox' || el.tagName === 'SELECT' || (parts[0] === 'mark' && field === 'h')) toRefresh(true); else toRefresh();
    if (to.viewer && parts[0] === 't' && field === 'wallHeight') to.viewer.draw();
  }

  function toKey(e) {
    if (document.body.dataset.view !== 'takeoff' || !to.viewer) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var v = to.viewer;
    if (e.key === 'Enter' && v.drawing()) { e.preventDefault(); v.finish(); }
    else if (e.key === 'Escape') { if (v.drawing()) v.cancel(); else { to.selected = null; v.draw(); } toRefresh(); }
    else if ((e.key === 'Backspace' || e.key === 'Delete') && v.drawing()) { e.preventDefault(); v.undoPoint(); }
    else if ((e.key === 'Backspace' || e.key === 'Delete') && to.selected) { e.preventDefault(); toClick('to-del-mark', { dataset: { id: to.selected } }); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); toClick('to-undo', { dataset: {} }); }
    else if (e.key === 'Shift') { v.shift = true; }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      var k = e.key.toLowerCase(), map = { m: 'measure', v: 'select', h: 'pan' };
      if (map[k]) { to.tool = map[k]; applyTool(); toRefresh(); }
      else if (k === '+' || k === '=') v.zoomAt(1.25);
      else if (k === '-') v.zoomAt(0.8);
      else if (k === '0') v.fit();
    }
    toRefreshHint();
  }
  function toRefreshHint() { var job = toJob(), h = app.querySelector('[data-out="to-hint"]'); if (job && h) h.innerHTML = hintHtml(job.takeoff); }
  document.addEventListener('keydown', toKey);
  document.addEventListener('keyup', function (e) { if (e.key === 'Shift' && to.viewer) to.viewer.shift = false; });

  /** Returns true if it handled a takeoff action. */
  function toClick(action, el) {
    var job = toJob(); if (!job) return false;
    var t = job.takeoff, v = to.viewer, d = el.dataset || {};
    switch (action) {
      case 'to-mtab':
        to.mtab = d.v; if (d.v !== 'plan') to.panel = d.v;
        app.querySelector('.to').dataset.mtab = d.v;
        app.querySelectorAll('.to-mtabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === d.v); });
        toRefresh(true);
        if (d.v === 'plan' && v) setTimeout(function () { v.fit(); }, 30);
        return true;
      case 'to-panel': to.panel = d.v; toRefresh(true); return true;
      case 'to-add-plan': document.getElementById('to-file').click(); return true;
      case 'to-page': {
        var plan = toPlan(t); if (!plan || !to.pdf) return true;
        var np = Math.max(1, Math.min(to.pdf.numPages, to.page + Number(d.v)));
        if (np !== to.page) { to.page = np; to.selected = null; showPlanPage(); }
        return true;
      }
      case 'to-tool': to.tool = d.v; if (v && v.drawing()) v.cancel(); applyTool(); toRefresh(); return true;
      case 'to-ortho': to.ortho = !to.ortho; applyTool(); toRefresh(); return true;
      case 'to-zoom': if (v) { if (d.v === 'fit') v.fit(); else v.zoomAt(d.v === 'in' ? 1.4 : 1 / 1.4); } return true;
      case 'to-finish': if (v) v.finish(); toRefresh(); return true;
      case 'to-backpt': if (v) v.undoPoint(); toRefresh(); return true;
      case 'to-cancel': if (v) v.cancel(); toRefresh(); return true;
      case 'to-scale-found': if (to.foundScale) setScale(job, toPlan(t), to.foundScale); return true;
      case 'to-undo': {
        var h = to.history.pop();
        if (!h) { toast('Nothing to undo'); return true; }
        var mk = t.marks.find(function (m) { return m.id === h.id; });
        if (mk && h.pt && mk.pts.length > 1) mk.pts.pop();
        else t.marks = t.marks.filter(function (m) { return m.id !== h.id; });
        touch(job); if (v) v.draw(); toRefresh(true);
        return true;
      }
      case 'to-sys':
        to.systemId = d.id; to.editSys = to.editSys === d.id ? d.id : null; to.selected = null; to.tool = 'measure';
        applyTool(); if (v) v.draw(); toRefresh(true);
        return true;
      case 'to-sys-edit': to.editSys = d.id || null; toRefresh(true); return true;
      case 'to-sys-color': { var s1 = toSys(t, d.id); if (s1) { s1.color = d.v; touch(job); if (v) v.draw(); toRefresh(true); } return true; }
      case 'to-sys-del': {
        var s2 = toSys(t, d.id), n = t.marks.filter(function (m) { return m.systemId === d.id; }).length;
        if (!s2 || !confirm('Delete "' + s2.name + '"' + (n ? ' and its ' + n + ' measurement' + (n === 1 ? '' : 's') : '') + '?')) return true;
        t.systems = t.systems.filter(function (s) { return s.id !== d.id; });
        t.marks = t.marks.filter(function (m) { return m.systemId !== d.id; });
        to.systemId = t.systems[0] ? t.systems[0].id : null; to.editSys = null;
        touch(job); applyTool(); if (v) v.draw(); toRefresh(true);
        return true;
      }
      case 'to-type': {
        var s3 = toSys(t, to.systemId); if (!s3) return true;
        var m = { id: T.uid(), systemId: s3.id, zoneId: to.zoneId, kind: 'typed', qty: '' };
        t.marks.push(m); touch(job); toRefresh(true);
        var inp = app.querySelector('[data-to="mark.' + m.id + '.qty"]'); if (inp) inp.focus();
        return true;
      }
      case 'to-pick-mark': {
        var pm = t.marks.find(function (x) { return x.id === d.id; }); if (!pm) return true;
        to.selected = pm.id; to.tool = 'select';
        if (pm.planId && (pm.planId !== to.planId || pm.page !== to.page)) { to.planId = pm.planId; to.page = pm.page; openCurrentPlan(); }
        else { applyTool(); if (v) v.draw(); }
        if (to.mtab !== 'plan' && window.innerWidth < 900) toClick('to-mtab', { dataset: { v: 'plan' } });
        toRefresh(true);
        return true;
      }
      case 'to-del-mark': {
        t.marks = t.marks.filter(function (m) { return m.id !== d.id; });
        if (to.selected === d.id) to.selected = null;
        touch(job); if (v) v.draw(); toRefresh(true);
        return true;
      }
      case 'to-zone-add': {
        var name = prompt('Name of the floor or area (e.g. Level 2, Suite 200, Stairwell A)', 'Level ' + (t.zones.length + 1));
        if (!name || !name.trim()) return true;
        var z = { id: T.uid(), name: name.trim() }; t.zones.push(z); to.zoneId = z.id; to.countMark = null;
        touch(job); toRefresh(true); return true;
      }
      case 'to-zone-rename': {
        var zz = t.zones.find(function (x) { return x.id === to.zoneId; }); if (!zz) return true;
        var nn = prompt('Rename this floor or area', zz.name);
        if (nn && nn.trim()) { zz.name = nn.trim(); touch(job); toRefresh(true); }
        return true;
      }
      case 'to-method': t.method = d.v; touch(job); toRefresh(true); return true;
      case 'to-breakdown': t.breakdown = d.v; touch(job); toRefresh(true); return true;
      case 'to-del-add': t.adds = t.adds.filter(function (a) { return a.id !== d.id; }); touch(job); toRefresh(true); return true;
      case 'to-add-alt': {
        var a = { id: T.uid(), label: '', price: '' }; t.alternates.push(a); touch(job); toRefresh(true);
        var ai = app.querySelector('[data-to="alt.' + a.id + '.label"]'); if (ai) ai.focus();
        return true;
      }
      case 'to-del-alt': t.alternates = t.alternates.filter(function (a) { return a.id !== d.id; }); touch(job); toRefresh(true); return true;
    }
    return false;
  }

  /** The demo: a made-up office floor plan, already measured and priced. */
  function startDemo() {
    if (!access().canCreate) { location.hash = '#/upgrade'; return; }
    toast('Loading the demo…');
    Promise.all([fetch('demo/sample-office-plan.pdf').then(function (r) { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); }),
      fetch('demo/sample-office-takeoff.json').then(function (r) { if (!r.ok) throw new Error('missing'); return r.json(); })])
      .then(function (res) {
        var buf = res[0], demo = res[1];
        pendingCustomer = { name: 'Harbour Point Offices (demo)', phone: '', email: '', address: '100 Demo Way, Suite 200' };
        var job = newJob('commercial', 'office');
        job.sample = true; job.mode = 'takeoff';
        var t = T.newTakeoff(settings);
        t.systems = demo.systems.map(function (s, i) { var ns = T.newSystem(s.preset, settings, i); return Object.assign(ns, { id: s.id, name: s.name || ns.name, color: s.color || ns.color }); });
        t.zones = demo.zones; t.wallHeight = demo.wallHeight; t.project = demo.project;
        t.plans = [{ id: 'demo-office-v1', name: 'A-101 Sample Office Floor Plan.pdf', size: buf.byteLength, pages: 1, scales: demo.scales }];
        t.marks = demo.marks.map(function (m) { return Object.assign({ planId: 'demo-office-v1', page: 1 }, m); });
        t.adds = demo.adds.map(function (a) { return Object.assign({ id: T.uid() }, a); });
        t.alternates = demo.alternates.map(function (a) { return Object.assign({ id: T.uid() }, a); });
        job.takeoff = t;
        job.notes = 'Demo project: a made-up office used to show the blueprint takeoff. Delete it any time.';
        return PlanStore.put('demo-office-v1', { name: t.plans[0].name, size: buf.byteLength, data: buf }).then(function () {
          touch(job);
          to.jobId = null;
          location.hash = '#/takeoff/' + job.id;
        });
      }).catch(function () { toast('Couldn\'t load the demo. Check your connection.'); });
  }

  /** Card on the job screen for takeoff jobs. */
  function takeoffCard(job, calc) {
    var c = calc.takeoff, active = c.systems.filter(function (r) { return r.qty > 0; });
    return '<section class="card to-card"><h2 class="card-title">📄 Blueprint takeoff <span class="beta">BETA</span></h2>' +
      (active.length ? '<ul class="to-sum">' + active.map(function (r) {
        return '<li><span class="dot" style="background:' + esc(r.color) + '"></span><span>' + esc(r.name) + '<span class="muted small"> · ' + fmtN(r.qty) + ' ' + r.unit + '</span></span><b>' + money0(r.price) + '</b></li>';
      }).join('') + '</ul><p class="muted small">' + fmtN(c.totals.hours, 1) + ' labour hours · ' + (job.takeoff.plans.length ? job.takeoff.plans.length + ' plan' + (job.takeoff.plans.length === 1 ? '' : 's') : 'typed totals') + '</p>'
        : '<p class="muted small" style="margin-top:0">Open your PDF blueprint and measure walls, ceilings, doors and frames right on the plan. Or type the totals you measured in Adobe.</p>') +
      '<a class="btn btn-primary full" href="#/takeoff/' + job.id + '">' + (active.length ? 'Open takeoff ›' : '📐 Start the takeoff ›') + '</a></section>';
  }

  // ---------- Events ----------
  app.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.to !== undefined && el.closest('.to')) { onToInput(el); return; }
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
      if (key === 'currency') {
        var from = settings.currency || 'USD', to = el.value, y = window.scrollY;
        var convert = from !== to && confirm('Convert your prices from ' + from + ' to ' + to + '?\n\n' +
          'OK: your labor rate, minimum job and paint prices are converted once at an approximate exchange rate (e.g. ' +
          CUR.format(settings.laborRate, from, 0) + '/hr becomes about ' + CUR.format(CUR.convert(settings.laborRate, from, to), to, 0) + '/hr).\n' +
          'Cancel: keep the same numbers and only change the currency sign.\n\nQuotes you already made are not changed.');
        settings = convert ? CUR.convertSettings(settings, from, to) : Object.assign(settings, { currency: to });
        saveSettings(); route(); window.scrollTo(0, y);
        toast(convert ? 'Prices converted to ' + to + '. Check they match what you charge' : 'Currency: ' + to);
        return;
      }
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
        card.querySelectorAll('[data-action="size"]').forEach(function (b) { b.classList.remove('on'); });
        var ms = card.querySelector('[data-out="measured-' + m[1] + '"]');
        if (ms) ms.hidden = false;
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

  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'si-email') { e.preventDefault(); var b1 = app.querySelector('[data-action=si-send]'); if (b1) b1.click(); }
    if (e.target.id === 'si-code') { e.preventDefault(); var b2 = app.querySelector('[data-action=si-verify]'); if (b2) b2.click(); }
  });

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;
    if (action === 'to-demo') { startDemo(); return; }
    if (action === 'create-takeoff') {
      var tj = newJob('commercial', el.dataset.prop || 'office');
      tj.mode = 'takeoff'; ensureTakeoff(tj); touch(tj);
      location.hash = '#/takeoff/' + tj.id;
      return;
    }
    if (action.indexOf('to-') === 0 && document.body.dataset.view === 'takeoff' && toClick(action, el)) return;
    var job = currentJob();
    var i = el.dataset.i != null ? +el.dataset.i : null;

    switch (action) {
      case 'si-google':
        location.href = AC.googleUrl(CFG, appUrl());
        return;
      case 'si-send': {
        var em = (document.getElementById('si-email').value || '').trim();
        if (!AC.validEmail(em)) { signin.error = 'Please enter a valid email address.'; renderSignin(); return; }
        signin.email = em; signin.busy = true; signin.error = ''; renderSignin();
        AC.sendCode(CFG, em, appUrl())
          .then(function () { signin.step = 'code'; })
          .catch(function (e) { signin.error = friendlyAuthError(e); })
          .then(function () { signin.busy = false; renderSignin(); });
        return;
      }
      case 'si-verify': {
        var code = (document.getElementById('si-code').value || '').replace(/\D/g, '');
        if (code.length < 6) { signin.error = 'Enter the 6-digit code from the email.'; renderSignin(); return; }
        signin.busy = true; signin.error = ''; renderSignin();
        AC.verifyCode(CFG, signin.email, code)
          .then(finishSignin)
          .catch(function (e) { signin.busy = false; signin.error = friendlyAuthError(e); renderSignin(); });
        return;
      }
      case 'si-resend':
        signin.busy = true; signin.error = ''; renderSignin();
        AC.sendCode(CFG, signin.email, appUrl())
          .then(function () { toast('New code sent'); })
          .catch(function (e) { signin.error = friendlyAuthError(e); })
          .then(function () { signin.busy = false; renderSignin(); });
        return;
      case 'si-change':
        signin = { step: 'start', email: '', busy: false, error: '' }; renderSignin();
        return;
      case 'si-signout':
        if (!confirm('Sign out? Your jobs and quotes stay saved on this phone' + (syncOn() ? ' and in your account.' : '.'))) return;
        (syncOn() ? runSync(true) : Promise.resolve()).then(function () {
          AC.signOut(CFG, session);
          session = null; save('pq.session', null); delete settings.account; saveSettings();
          location.hash = '#/signin';
        });
        return;
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
        if (pr) { Object.assign(settings, presetVals(pr)); saveSettings(); }
        renderWelcome(2);
        return;
      }
      case 'install':
        if (installPrompt) {
          installPrompt.prompt();
          installPrompt.userChoice.then(function (c) { if (c && c.outcome === 'accepted') toast('Installed! Find Coatwright on your home screen'); }).catch(function () {});
          installPrompt = null; route();
        }
        return;
      case 'trial-remind-dismiss':
        settings.trialReminder = Number(el.dataset.v) || 0; saveSettings();
        if (el.tagName !== 'A') renderHome();
        return;
      case 'install-dismiss':
        settings.installHintDismissed = true; saveSettings(); renderHome();
        return;
      case 'wz-finish':
        settings.onboarded = true; saveSettings();
        if (el.dataset.v === 'sample' && access().canCreate) { location.hash = '#/quote/' + createSampleJob().id; toast('Here\'s a sample. Tap ‹ Edit to change it'); }
        else location.hash = '#/new';
        return;
      case 'filter':
        homeFilter = el.dataset.v;
        renderHome();
        return;
      case 'status': {
        var prev = S.statusOf(job);
        S.setStatus(job, el.dataset.v);
        var logged = 0;
        if (el.dataset.v === 'paid' && prev !== 'paid') { // Paid means the money came in: offer to log what's still owed
          var due = S.balance(job, settings);
          if (due > 0 && confirm('Record the remaining ' + money(due) + ' as paid today?\n\nTap Cancel if you\'ll log the payments yourself.')) {
            job.payments.push({ id: uid(), date: today(), amount: due, method: S.paymentMethods(settings.currency)[settings.currency === 'CAD' ? 3 : 1] });
            logged = due;
          }
        }
        touch(job); renderJob(job);
        if (logged) toast('💰 Paid! ' + money(logged) + ' logged. Change the method or date below if needed');
        else if (S.isWon(job) && ['draft', 'sent', 'lost'].indexOf(prev) !== -1) toast('🎉 Won! Log payments and real costs below');
        else toast('Marked as ' + S.statusInfo(job.status).label);
        return;
      }
      case 'paint-email': {
        if (!P.paintOrder(job, settings).length) { toast('Add rooms first'); return; }
        var to = settings.paintStoreEmail || '';
        location.href = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') + '?subject=' + encodeURIComponent('Paint order ' + job.number + (settings.businessName ? ' — ' + settings.businessName : '')) +
          '&body=' + encodeURIComponent(paintOrderText(job));
        if (!to) toast('Tip: add your store\'s email above to fill it in automatically');
        return;
      }
      case 'paint-share': {
        if (!P.paintOrder(job, settings).length) { toast('Add rooms first'); return; }
        var ptext = paintOrderText(job);
        if (navigator.share) navigator.share({ title: 'Paint order ' + job.number, text: ptext }).catch(function () {});
        else copyText(ptext, 'Paint order');
        return;
      }
      case 'paint-copy':
        copyText(paintOrderText(job), 'Paint order');
        return;
      case 'add-payment': {
        var owed = S.balance(job, settings);
        job.payments.push({ id: uid(), date: today(), amount: owed || '', method: S.paymentMethods(settings.currency)[settings.currency === 'CAD' ? 3 : 1] });
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
        forget('expenses', ex.id);
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
      case 'sync-now':
        el.disabled = true;
        runSync(true).then(function (ok) { toast(ok ? 'Saved to your account ☁️' : syncNote()); renderSettings(); });
        showSyncNote();
        return;
      case 'sync-replace':
        delete syncMeta.declined; saveMeta();
        runSync(true).then(function () { renderSettings(); });
        return;
      case 'backup':
        download('coatwright-backup-' + today() + '.json', backupData(), 'application/json');
        settings.lastBackup = Date.now(); saveSettings();
        renderSettings();
        toast('Backup saved — keep it somewhere safe (email it to yourself)');
        return;
      case 'new-job':
        location.hash = access().canCreate ? '#/new' : '#/upgrade';
        return;
      case 'sub-check':
        el.disabled = true; el.textContent = 'Checking…';
        syncAccount().then(function () {
          toast(access().mode === 'active' ? '🎉 Subscription confirmed' : 'No active subscription found for ' + ((settings.account && settings.account.email) || 'this account'));
          renderUpgrade();
        });
        return;
      case 'quote-for': {
        if (!access().canCreate) { location.hash = '#/upgrade'; return; }
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
        if (job.jobType !== 'commercial' && job.mode === 'takeoff') job.mode = 'rooms';
        touch(job); renderJob(job);
        return;
      case 'prop':
        if (!job.jobType) job.jobType = 'residential';
        job.propertyType = el.dataset.v;
        touch(job); renderJob(job);
        return;
      case 'mode':
        job.mode = el.dataset.v;
        if (job.mode === 'takeoff') ensureTakeoff(job);
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
        if (job.rooms.length) room.paint = JSON.parse(JSON.stringify(P.paintFor(job.rooms[job.rooms.length - 1])));
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
        forget('jobs', job.id);
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

  function copyText(text, what) {
    what = what || 'Quote';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(what + ' copied — paste it anywhere'); },
        function () { fallbackCopy(text, what); });
    } else fallbackCopy(text, what);
  }
  function fallbackCopy(text, what) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast((what || 'Quote') + ' copied'); } catch (e) { toast('Copy not supported'); }
    ta.remove();
  }

  if (!handleAuthReturn()) route();
  syncAccount().then(function () { scheduleSync(0); });
})();
