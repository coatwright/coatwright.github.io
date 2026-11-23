import sys
T, V = sys.argv[1], sys.argv[2]
s = open(T).read()
head = s[:s.index("  await scene('hook'")]
head = head.replace("vCard('<img src=\"icon.svg\" alt=\"\"><h1>Blueprint takeoff</h1><p>Measure the plans. Price the job. Send the proposal.</p><span class=\"pill\">NEW · COMMERCIAL BETA</span>')",
                    "vCard('<img src=\"icon.svg\" alt=\"\"><h1>Commercial setup</h1><p>Your numbers, once. Every bid priced your way.</p><span class=\"pill\">ABOUT 2 MINUTES</span>')")
head = head.replace("await page.goto(APP + '?v=1#/new/commercial');", "await page.goto(APP + '?v=1#/settings');")
assert "Commercial setup" in head and "#/settings" in head
body = r'''
  const typeInto = async (sel, text) => { await page.locator(sel).first().evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' })); await sleep(450); await clickSel(sel, 500); await page.keyboard.press('Control+A'); await page.keyboard.type(text, { delay: 95 }); await sleep(150); };
  const typeEl = async (handle, text) => { await handle.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' })); await sleep(450); const bb = await handle.boundingBox(); await click(bb.x + bb.width / 2, bb.y + bb.height / 2, 500); await page.keyboard.press('Control+A'); await page.keyboard.type(text, { delay: 95 }); await sleep(150); };
  const scrollToSel = async (sel, block) => { await page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: b || 'center' }), [sel, block]); await sleep(700); };
  await scene('intro', async () => { await sleep(2600); await page.evaluate(() => vCard(null)); });
  await scene('open', async () => {
    await scrollToSel('details.com-card > summary', 'center');
    await clickSel('details.com-card > summary', 700);
    await page.waitForFunction(() => document.querySelector('details.com-card').open, null, { timeout: 3000 });
    await sleep(300);
    await scrollToSel('details.com-card > summary', 'start');
  }, 0.3);
  await scene('quick', async () => {
    await typeInto('[data-com="laborRate"]', '68');
    await typeInto('[data-com="overheadPct"]', '12');
    await typeInto('[data-com="profitPct"]', '18');
    await typeInto('[data-com="wallHeight"]', '9');
    await sleep(300);
    await clickSel('[data-action=com-method][data-v=hours]', 600);
  }, 0.3);
  await scene('optional', async () => {
    const opt = await page.$$('details.com-card > .row3:last-of-type input');
    if (opt[0]) await typeEl(opt[0], '300');
    if (opt[1]) await typeEl(opt[1], '48');
    if (opt[2]) await typeEl(opt[2], '38');
    await page.evaluate(() => document.activeElement.blur());
  }, 0.3);
  await scene('finetune', async () => {
    await scrollToSel('details.com-card details.com-more > summary', 'center');
    await clickSel('details.com-card details.com-more > summary', 600);
    await sleep(250);
    await page.evaluate(() => document.querySelector('details.com-card .com-systems').scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(200);
    await scrollToSel('details.com-card details.com-sys:nth-child(3) > summary', 'center');
    await clickSel('details.com-card details.com-sys:nth-child(3) > summary', 600);
    await sleep(600);
  }, 0.3);
  await scene('newbid', async () => {
    await page.evaluate(() => { location.hash = '#/new/commercial'; });
    await sleep(700);
    await clickSel('[data-action=create-takeoff]', 700);
    await sleep(900);
    await clickSel('.to-ptabs [data-v=bid]', 700);
    await sleep(500);
    await move(...(await center('[data-to="t.overheadPct"]')), 600);
  }, 0.3);
  await scene('perjob', async () => {
    await clickSel('.to-ptabs [data-v=takeoff]', 600);
    await sleep(300);
    await clickSel('.to-syshead:has-text("Doors")', 600);
    await clickSel('[data-action=to-sys-edit]', 600);
    await sleep(300);
    await typeInto('[data-to$=".rate"]', '1.4');
    await page.evaluate(() => document.activeElement.blur());
    await sleep(800);
    await page.evaluate(() => document.querySelector('[data-action=to-sys-save]').scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(700);
    await clickSel('[data-action=to-sys-save]', 700);
  }, 0.3);
  await scene('end', async () => {
    await page.evaluate(() => { vChapter(''); vCard('<img src="icon.svg" alt=""><h1>You\'re set up.</h1><p>Questions? hello@getcoatwright.com</p><span class="pill">COATWRIGHT COMMERCIAL</span>'); });
  }, 1.4);
'''
tail = s[s.index("  const endT = Date.now() / 1000;"):]
open(V + '/record.js', 'w').write(head + body + tail)
print('ok')
