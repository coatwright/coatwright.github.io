// Records the blueprint-takeoff demo in the real app (desktop, 1600×900), with a visible cursor and chapter labels.
const { chromium } = require('playwright');
const fs = require('fs');
const V = process.argv[2];
const APP = 'http://localhost:8765/app/';
const script = JSON.parse(fs.readFileSync(V + '/script.json'));
const dur = JSON.parse(fs.readFileSync(V + '/durations.json'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync(V + '/frames', { recursive: true, force: true }); fs.mkdirSync(V + '/frames');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'en-US' });
  await ctx.route('https://tbgcxcocnqbnmjnvncic.supabase.co/**', r => r.fulfill({ json: [] }));
  await ctx.route(APP + 'config.js', r => r.fulfill({ body: fs.readFileSync('/home/user/coatwright.github.io/app/config.js', 'utf8').replace('sync: true', 'sync: false'), contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(APP);
  await page.evaluate(() => {
    localStorage.clear(); const now = Date.now();
    localStorage.setItem('pq.session', JSON.stringify({ accessToken: 'x', refreshToken: 'r', expiresAt: now + 864e5 }));
    localStorage.setItem('pq.settings', JSON.stringify({ onboarded: true, businessName: 'Northline Painting Ltd.', ownerName: 'Sam Carter', phone: '(416) 555-0142',
      email: 'sam@northline.example', currency: 'CAD', laborRate: 60, trialStart: now, installHintDismissed: true, account: { id: 'u1', email: 'sam@northline.example' } }));
  });
  await page.goto(APP + '?v=1#/new/commercial');
  await sleep(600);
  // overlays: cursor, click ripple, chapter label, title cards
  await page.addStyleTag({ content: `
    #vcur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:99999;pointer-events:none;transform:translate(800px,450px)}
    .vrip{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid rgba(31,94,255,.9);background:rgba(31,94,255,.18);z-index:99998;pointer-events:none;transition:transform .5s,opacity .5s}
    #vchap{position:fixed;left:24px;bottom:84px;z-index:99990;background:rgba(22,32,58,.92);color:#fff;font:700 22px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 20px;border-radius:14px;opacity:0;transition:opacity .4s;box-shadow:0 6px 20px rgba(0,0,0,.25)}
    #vcard{position:fixed;inset:0;z-index:99995;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#1f5eff,#173fb0);color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;transition:opacity .6s}
    #vcard img{width:120px;height:120px;border-radius:28px;background:#fff;padding:14px}
    #vcard h1{font-size:64px;margin:0;letter-spacing:-1px} #vcard p{font-size:30px;margin:0;opacity:.92} #vcard .pill{font-size:20px;font-weight:800;background:#ffd166;color:#4a3300;padding:6px 14px;border-radius:10px}` });
  await page.evaluate(() => {
    const c = document.createElement('div'); c.id = 'vcur';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.5 16 L12 24 L15.5 22.5 L12 15 L19.5 15 Z" fill="#16203a" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    document.addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    document.addEventListener('mousedown', e => {
      const r = document.createElement('div'); r.className = 'vrip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); requestAnimationFrame(() => { r.style.transform = 'scale(1.7)'; r.style.opacity = '0'; }); setTimeout(() => r.remove(), 600);
    }, true);
    const ch = document.createElement('div'); ch.id = 'vchap'; document.body.appendChild(ch);
    window.vChapter = t => { ch.style.opacity = t ? '1' : '0'; if (t) ch.textContent = t; };
    window.vCard = (html) => { let d = document.getElementById('vcard'); if (!html) { if (d) { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); } return; }
      if (!d) { d = document.createElement('div'); d.id = 'vcard'; document.body.appendChild(d); } d.innerHTML = html; d.style.opacity = '1'; };
  });
  let mx = 800, my = 450;
  const move = async (x, y, ms = 500) => { const steps = Math.max(2, Math.round(ms / 16)); await page.mouse.move(x, y, { steps }); mx = x; my = y; };
  const click = async (x, y, ms) => { await move(x, y, ms); await sleep(120); await page.mouse.down(); await sleep(60); await page.mouse.up(); };
  const center = async sel => { const bb = await page.locator(sel).first().boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const clickSel = async (sel, ms = 600) => { const c = await center(sel); await click(c[0], c[1], ms); };
  const scr = async (x, y) => page.evaluate(([x, y]) => { const s = document.querySelector('.pv-marks'); const r = s.getBoundingClientRect(); const vb = s.viewBox.baseVal; return [r.left + x * r.width / vb.width, r.top + y * r.height / vb.height]; }, [x, y]);
  const F = (fx, fy) => [330 + fx * 9, 300 + fy * 9];
  const clickPlan = async (fx, fy, ms = 380) => { const p = F(fx, fy); const s = await scr(p[0], p[1]); await click(s[0], s[1], ms); };

  const cdp = await ctx.newCDPSession(page);
  const frames = []; let fi = 0;
  cdp.on('Page.screencastFrame', async ev => {
    const name = 'f' + String(fi++).padStart(5, '0') + '.jpg';
    fs.writeFileSync(V + '/frames/' + name, Buffer.from(ev.data, 'base64'));
    frames.push({ name, t: ev.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  await page.evaluate(() => vCard('<img src="icon.svg" alt=""><h1>Blueprint takeoff</h1><p>Measure the plans. Price the job. Send the proposal.</p><span class="pill">NEW · COMMERCIAL BETA</span>'));
  await sleep(300);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1600, maxHeight: 900, everyNthFrame: 1 });
  await sleep(500);
  const scenes = [];
  const meta = Object.fromEntries(script.map(s => [s.id, s]));
  async function scene(id, fn, pad = 0.45) {
    const start = Date.now() / 1000; scenes.push({ id, start, dur: dur[id] });
    await page.evaluate(t => vChapter(t), meta[id].chapter || '');
    await fn();
    const left = start + dur[id] + pad - Date.now() / 1000;
    if (left < 0) console.log('scene', id, 'over by', (-left).toFixed(2));
    else await sleep(left * 1000);
  }
  await scene('hook', async () => {
    await sleep(2600); await page.evaluate(() => vCard(null)); await sleep(900);
    await move(700, 300, 700); await sleep(2200);
    await clickSel('[data-action=create-takeoff]', 900);
  });
  await scene('open', async () => {
    await sleep(500);
    const fc = page.waitForEvent('filechooser');
    await clickSel('[data-action=to-add-plan]', 800);
    (await fc).setFiles(V + '/A-101 Level 2 Floor Plan.pdf');
  });
  await scene('scale', async () => {
    await page.waitForSelector('[data-action=to-scale-found]', { timeout: 8000 });
    await sleep(1200);
    await clickSel('[data-action=to-scale-found]', 900);
    await sleep(2400);
    await move(...(await center('.to-scale')), 700);
  });
  await scene('walls', async () => {
    const c = F(60, 34); let s = await scr(...c);
    await move(s[0], s[1], 600);
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -150); await sleep(120); }
    await sleep(500);
    const st = await page.locator('#to-stage').boundingBox();
    s = await scr(...F(60, 35));
    await move(s[0], s[1], 300); await page.mouse.down();
    await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2, { steps: 25 }); await page.mouse.up();
    await sleep(500);
    await clickPlan(0, 0, 500); await clickPlan(15, 0); await clickPlan(15, 15); await clickPlan(0, 15);
    const f0 = F(0, 0); s = await scr(...f0); await move(s[0] + 3, s[1] + 3, 450); await sleep(500); await click(s[0], s[1], 150);
    await sleep(700);
    await clickPlan(15, 0, 450); await clickPlan(30, 0); await clickPlan(30, 15); await clickPlan(15, 15); await clickPlan(15, 0, 450);
  }, 0.3);
  await scene('ceil', async () => {
    await clickSel('.to-syshead:has-text("Ceilings")', 700);
    await clickPlan(0, 15, 600); await clickPlan(120, 15, 600); await clickPlan(120, 21); await clickPlan(0, 21, 600); await clickPlan(0, 15, 400);
  }, 0.3);
  await scene('count', async () => {
    await clickSel('.to-syshead:has-text("Doors")', 600);
    for (let i = 0; i < 4; i++) await clickPlan(i * 15 + 11.5, 15, 260);
  }, 0.3);
  await scene('typed', async () => {
    await clickSel('.to-syshead:has-text("Walls")', 600);
    await sleep(300);
    await clickSel('[data-action=to-type]', 600);
    await sleep(200);
    await page.keyboard.type('4800', { delay: 110 });
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await page.keyboard.type('Level 3 (from Adobe)', { delay: 45 });
  });
  await scene('bid', async () => {
    await page.evaluate(() => { const bt = document.createElement('button'); bt.dataset.action = 'to-demo'; bt.style.display = 'none'; document.getElementById('app').appendChild(bt); bt.click(); });
    await page.waitForSelector('.to-syshead:has-text("Washroom")', { timeout: 8000 });
    await sleep(1400);
    await clickSel('.to-ptabs [data-v=bid]', 800);
    await sleep(1600);
    await page.evaluate(() => document.querySelector('.to-pbody').scrollTo({ top: 420, behavior: 'smooth' }));
    await sleep(3200);
    await page.evaluate(() => document.querySelector('.to-pbody').scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1300);
    await clickSel('[data-action=to-method][data-v=unit]', 700);
    await sleep(1800);
    await clickSel('[data-action=to-method][data-v=hours]', 600);
  }, 0.3);
  await scene('proposal', async () => {
    await clickSel('.to-proposal', 700);
    await sleep(1200);
    await move(1300, 500, 500);
    for (let y = 0; y < 10; y++) { await page.mouse.wheel(0, 110); await sleep(600); }
  });
  await scene('end', async () => {
    await page.evaluate(() => { vChapter(''); vCard('<img src="icon.svg" alt=""><h1>Blueprint to bid, in minutes.</h1><p>Coatwright Commercial · getcoatwright.com</p><span class="pill">NOW IN BETA</span>'); });
  }, 1.4);
  const endT = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await sleep(300);
  fs.writeFileSync(V + '/timeline.json', JSON.stringify({ frames, scenes, endT }));
  console.log('frames', frames.length, 'errors', errs);
  await b.close();
})();
