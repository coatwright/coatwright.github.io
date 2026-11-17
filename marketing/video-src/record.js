// Records the Coatwright explainer: drives the real app inside stage.html and captures frames with timestamps.
const { chromium } = require('playwright');
const fs = require('fs');
const V = process.argv[2];
const BASE = 'http://localhost:8767';
const script = JSON.parse(fs.readFileSync(V + '/script.json'));
const dur = JSON.parse(fs.readFileSync(V + '/durations.json'));
const seed = JSON.parse(fs.readFileSync(V + '/seed.json'));
const PAD = { hook: 0.35, setup: 0.35, quote: 0.35, paint: 0.35, tally: 0.35, send: 0.35, track: 0.35, stats: 0.35, end: 1.6 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let deadline = Infinity;
const late = () => Date.now() / 1000 > deadline;

(async () => {
  fs.rmSync(V + '/frames', { recursive: true, force: true });
  fs.mkdirSync(V + '/frames', { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'en-US' });
  await ctx.route('https://tbgcxcocnqbnmjnvncic.supabase.co/**', r => {
    const u = r.request().url();
    if (u.includes('founder_spots_left')) return r.fulfill({ json: 100 });
    if (u.includes('/rest/v1/profiles')) return r.fulfill({ json: [{ email: 'luis@riverapainting.com', trial_started_at: new Date().toISOString() }] });
    if (u.includes('/rest/v1/')) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, json: {} });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/stage.html');
  const demoJob = seed['pq.jobs'].find(j => j.id === 'demojob');
  seed['pq.jobs'] = seed['pq.jobs'].filter(j => j.id !== 'demojob');
  await page.evaluate(s => {
    localStorage.clear();
    Object.keys(s).forEach(k => localStorage.setItem(k, JSON.stringify(s[k])));
    localStorage.setItem('pq.session', JSON.stringify({ accessToken: 'x', refreshToken: 'r', expiresAt: Date.now() + 864e5 }));
  }, seed);
  const frameEl = await page.$('#app');
  const HIDE = '.paint-card summary em, .paint-card .row2:has([data-setting]), .paint-card label:has([data-field=paintPickup]), .paint-card [data-action^="paint-"], .paint-card .row2:has([data-action^="paint-"]) { display: none !important; }';
  const go = async hash => {
    await page.evaluate(h => { document.getElementById('app').src = 'app/index.html?v=' + Date.now() + h; }, hash);
    await sleep(900);
    const f = await frameEl.contentFrame();
    await f.addStyleTag({ content: HIDE }).catch(() => {});
  };
  const app = () => frameEl.contentFrame();
  const tap = async (sel, opts) => {
    const f = await app();
    const loc = typeof sel === 'string' ? f.locator(sel).first() : sel;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(250);
    const box = await loc.boundingBox();
    if (box) await page.evaluate(([x, y]) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:' + (x - 45) + 'px;top:' + (y - 45) + 'px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.55);border:4px solid #fff;pointer-events:none;transition:transform .45s,opacity .45s;z-index:9';
      document.body.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
      setTimeout(() => d.remove(), 600);
    }, [box.x + box.width / 2, box.y + box.height / 2]);
    await sleep(180);
    await loc.evaluate(el => { if (el.focus) el.focus(); el.click(); });
  };
  const scrollTo = async (sel, block) => {
    const f = await app();
    await f.evaluate(([s, bl]) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ behavior: 'smooth', block: bl || 'start' }); }, [sel, block]);
  };
  const scrollBy = async (y) => { const f = await app(); await f.evaluate(dy => window.scrollBy({ top: dy, behavior: 'smooth' }), y); };

  // Screencast
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  let fi = 0;
  cdp.on('Page.screencastFrame', async ev => {
    const name = 'f' + String(fi++).padStart(5, '0') + '.jpg';
    fs.writeFileSync(V + '/frames/' + name, Buffer.from(ev.data, 'base64'));
    frames.push({ name, t: ev.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });

  await go('#/');
  await page.evaluate(() => setScene('Price any paint job in minutes', '', false, 'hook'));
  await sleep(600);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  await sleep(300);

  const scenes = [];
  const curId = async () => { const f = await app(); return (f.url().match(/#\/(?:job|quote|invoice)\/([^/?]+)/) || [])[1] || 'demojob'; };
  const actions = {
    hook: async () => { await sleep(1200); await scrollBy(300); await sleep(1800); await scrollBy(-300); },
    setup: async () => {
      await go('#/welcome/2'); await sleep(1100);
      await tap('[data-action=preset][data-v=pro]'); await sleep(1200);
      await scrollBy(300); await sleep(900);
      if (!late()) await go('#/welcome/3');
    },
    quote: async () => {
      await go('#/new'); await sleep(350);
      await tap('a[href="#/new/residential"]'); await sleep(550);
      await tap('[data-action=create-job][data-prop=house]'); await sleep(150);
      await page.evaluate(d => { const js = JSON.parse(localStorage.getItem('pq.jobs')); js.unshift(d); localStorage.setItem('pq.jobs', JSON.stringify(js)); }, demoJob);
      await go('#/job/demojob');
      await scrollTo('.mode-switch', 'start'); await sleep(450);
      await tap('[data-action=mode][data-v=quick]'); await sleep(300);
      const f = await app();
      const sq = f.locator('[data-field="quick.sqft"]');
      await sq.type('2200', { delay: 70 }); await sleep(500);
      await tap('[data-action=mode][data-v=rooms]'); await sleep(250);
      await scrollTo('.add-room', 'center'); await sleep(250);
      await tap('[data-action=add-room][data-k="1"]'); await sleep(500);
      await tap('[data-action=add-room][data-k="0"]'); await sleep(450);
      await scrollTo('[data-action=add-out]', 'center'); await sleep(250);
      await tap('[data-action=add-out][data-k="0"]');
    },
    paint: async () => {
      await scrollTo('.room-card .paint-box', 'center'); await sleep(450);
      const f = await app();
      const box = f.locator('.room-card').first().locator('.paint-box');
      await tap(box.locator('summary')); await sleep(250);
      const brand = box.locator('[data-field$="walls.brand"]');
      await tap(brand); await brand.type('Benjamin Moore', { delay: 22 });
      const col = box.locator('[data-field$="walls.color"]');
      await tap(col); await col.type('Chantilly Lace', { delay: 22 });
      await box.locator('[data-field$="walls.sheen"]').selectOption('Matte');
      await f.evaluate(() => document.activeElement && document.activeElement.blur());
      await sleep(200);
      await scrollTo('.room-card .room-paint', 'center');
    },
    tally: async () => {
      await scrollTo('.paint-card', 'start'); await sleep(450);
      await tap('.paint-card summary'); await sleep(700);
      await scrollBy(480); await sleep(1100);
      await scrollTo('.po-total', 'center');
    },
    send: async () => {
      const id = await curId();
      await go('#/quote/' + id); await sleep(1500);
      await scrollBy(420); await sleep(1500);
      await scrollBy(520); await sleep(1500);
      await scrollBy(560);
    },
    track: async () => {
      const id = await curId();
      await go('#/job/' + id); await sleep(250);
      await tap('[data-action=status][data-v=won]'); await sleep(800);
      await scrollTo('.money-card', 'start'); await sleep(500);
      await tap('[data-action=add-payment]'); await sleep(700);
      if (!late()) { await go('#/invoice/' + id); await scrollBy(380); }
    },
    stats: async () => { await go('#/stats'); await sleep(1500); await scrollBy(560); await sleep(1500); await scrollBy(600); },
    end: async () => { await page.evaluate(() => { document.body.className = 'ending'; }); }
  };

  for (const s of script) {
    const D = dur[s.id] + PAD[s.id];
    const start = Date.now() / 1000;
    deadline = start + D - 0.6;
    scenes.push({ id: s.id, start, dur: D });
    if (s.id !== 'end') await page.evaluate(([t, p, n, c]) => setScene(t, p, n, c), [s.title, s.pill, s.pill === 'New', s.id === 'hook' ? 'hook' : '']);
    try { await actions[s.id](); } catch (e) { errs.push(s.id + ': ' + e.message); }
    const left = start + D - Date.now() / 1000;
    if (left > 0) await sleep(left * 1000);
    else errs.push(s.id + ' overran by ' + (-left).toFixed(2) + 's');
  }
  const endT = Date.now() / 1000;
  await sleep(300);
  await cdp.send('Page.stopScreencast');
  fs.writeFileSync(V + '/timeline.json', JSON.stringify({ frames, scenes, endT }));
  console.log('frames', frames.length, 'scenes', scenes.map(s => s.id + ':' + s.dur.toFixed(1)).join(' '));
  console.log('errors', errs);
  await b.close();
})();
