// Records the Coatwright explainer: drives the real app inside stage.html and captures frames with timestamps.
const { chromium } = require('playwright');
const fs = require('fs');
const V = process.argv[2];
const BASE = 'http://localhost:8766';
const script = JSON.parse(fs.readFileSync(V + '/script.json'));
const dur = JSON.parse(fs.readFileSync(V + '/durations.json'));
const seed = JSON.parse(fs.readFileSync(V + '/seed.json'));
const PAD = { hook: 1.6, signup: 2.2, setup: 2.6, rooms: 3.2, paint: 3.2, tally: 3.6, outside: 2.8, quote: 2.6, win: 3.2, stats: 3.2, end: 3.4 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  const go = async hash => {
    await page.evaluate(h => { document.getElementById('app').src = 'app/index.html?v=' + Date.now() + h; }, hash);
    await sleep(900);
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
  await page.evaluate(() => setScene('', '', false, 'hook'));
  await sleep(600);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  await sleep(300);

  const scenes = [];
  const actions = {
    hook: async () => { await scrollBy(260); await sleep(1800); await scrollBy(-260); },
    signup: async () => {
      await page.evaluate(() => localStorage.removeItem('pq.session'));
      await go('#/signin');
      await sleep(500);
      const f = await app();
      await tap('#si-email');
      await f.locator('#si-email').type('luis@riverapainting.com', { delay: 45 });
      await page.evaluate(() => localStorage.setItem('pq.session', JSON.stringify({ accessToken: 'x', refreshToken: 'r', expiresAt: Date.now() + 864e5 })));
    },
    setup: async () => { await go('#/welcome/2'); await sleep(1400); await tap('[data-action=preset][data-v=pro]'); await sleep(900); await scrollBy(320); },
    rooms: async () => {
      await page.evaluate(d => { const js = JSON.parse(localStorage.getItem('pq.jobs')); js.unshift(d); localStorage.setItem('pq.jobs', JSON.stringify(js)); }, demoJob);
      await go('#/job/demojob');
      await sleep(300);
      await scrollTo('.add-room', 'center');
      await sleep(900);
      await tap('[data-action=add-room][data-k="1"]'); await sleep(1300);
      await tap('[data-action=add-room][data-k="0"]'); await sleep(1300);
      const f = await app();
      const len = f.locator('.room-card').nth(1).locator('[data-field$=".length"]');
      await tap(len); await len.fill(''); await len.type('13', { delay: 120 });
      await sleep(500);
      await tap('[data-action=add-room][data-k="2"]');
    },
    paint: async () => {
      await scrollTo('.room-card .room-paint', 'center');
      await sleep(1200);
      const f = await app();
      const box = f.locator('.room-card').first().locator('.paint-box');
      await tap(box.locator('summary'));
      await sleep(400);
      await scrollTo('.room-card .paint-box', 'start');
      await sleep(500);
      const brand = box.locator('[data-field$="walls.brand"]');
      await tap(brand); await brand.type('Benjamin Moore Regal', { delay: 40 });
      const col = box.locator('[data-field$="walls.color"]');
      await tap(col); await col.type('Chantilly Lace OC-65', { delay: 40 });
      await box.locator('[data-field$="walls.sheen"]').selectOption('Matte');
      await f.evaluate(() => document.activeElement && document.activeElement.blur());
      await sleep(300);
      await scrollTo('.room-card .room-paint', 'center');
    },
    tally: async () => {
      await scrollTo('.paint-card', 'start');
      await sleep(900);
      await tap('.paint-card summary');
      await sleep(900);
      await scrollBy(520); await sleep(1500);
      await scrollBy(560); await sleep(1500);
      await scrollBy(480);
    },
    outside: async () => {
      await scrollTo('[data-action=add-out]', 'center');
      await sleep(700);
      await tap('[data-action=add-out][data-k="0"]'); await sleep(1300);
      await scrollTo('[data-action=add-out]', 'center'); await sleep(500);
      await tap('[data-action=add-out][data-k="9"]');
    },
    quote: async () => {
      await go('#/quote/demojob');
      await sleep(1100);
      await scrollBy(420); await sleep(1100);
      await scrollBy(520); await sleep(1100);
      await scrollBy(600);
    },
    win: async () => {
      await go('#/job/demojob');
      await sleep(600);
      await tap('[data-action=status][data-v=won]');
      await sleep(900);
      await scrollTo('.money-card', 'start'); await sleep(700);
      await tap('[data-action=add-payment]'); await sleep(900);
      await go('#/invoice/demojob'); await sleep(500); await scrollBy(500);
    },
    stats: async () => {
      await go('#/stats');
      await sleep(1600);
      await scrollBy(560); await sleep(1500);
      await scrollBy(620);
    },
    end: async () => { await page.evaluate(() => { document.body.className = 'ending'; }); }
  };

  for (const s of script) {
    const D = dur[s.id] + PAD[s.id];
    const start = Date.now() / 1000;
    scenes.push({ id: s.id, start, dur: D });
    if (s.id !== 'end') await page.evaluate(([t, p, n, c]) => setScene(t, p, n, c), [s.title, s.pill, s.pill === 'New', s.id === 'hook' ? 'hook' : '']);
    await sleep(300);
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
