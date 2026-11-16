const pptxgen = require('pptxgenjs');
const React = require('react');
const RDS = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa');
const fs = require('fs');
const path = require('path');
const { applyTheme } = require(process.env.SKILL + '/scripts/apply_theme.js');

const ROOT = '/home/user/coatwright.github.io';
const OUT = process.argv[2];

const THEME = {
  name: 'Coatwright',
  headFontFace: 'Calibri',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0F1B3D', lt1: 'FFFFFF', dk2: '0B1430', lt2: 'EEF3FF',
    accent1: '1F5EFF', accent2: 'FFC94D', accent3: '16A34A', accent4: '5B6B8C', accent5: 'DCE6FF', accent6: 'F97316',
    hlink: '1F5EFF', folHlink: '5B6B8C'
  }
};

async function icon(name, color, size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { color: '#' + color, size }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
function img64(p) { return 'image/png;base64,' + fs.readFileSync(p).toString('base64'); }

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pres.author = 'Coatwright';
  pres.title = 'Coatwright for Paint Stores';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const logo = await sharp(fs.readFileSync(ROOT + '/app/icon.svg')).resize(256, 256).png().toBuffer();
  const LOGO = 'image/png;base64,' + logo.toString('base64');

  // ---- Layouts ----
  pres.defineSlideMaster({
    title: 'DARK_TITLE',
    background: { color: THEME.colors.dk2 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.1, w: 7.8, h: 1.7, fontSize: 44, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 3.9, w: 7.4, h: 1.2, fontSize: 20, color: C.accent5, valign: 'top', align: 'left', margin: 0 }, text: '' } }
    ]
  });
  pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: THEME.colors.lt1 },
    margin: [0.5, 0.6, 0.5, 0.6],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.85, fontSize: 36, bold: true, color: C.text1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: 'Coatwright · getcoatwright.com', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } }
    ],
    slideNumber: { x: 12.3, y: 7.0, w: 0.4, h: 0.3, fontSize: 10, color: C.accent4, align: 'right' }
  });
  pres.defineSlideMaster({
    title: 'TINT',
    background: { color: THEME.colors.lt2 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.85, fontSize: 36, bold: true, color: C.text1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: 'Coatwright · getcoatwright.com', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } }
    ],
    slideNumber: { x: 12.3, y: 7.0, w: 0.4, h: 0.3, fontSize: 10, color: C.accent4, align: 'right' }
  });

  const card = (s, name, x, y, w, h, fill) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    objectName: name, x, y, w, h, rectRadius: 0.12, fill: { color: fill || C.background1 },
    line: { color: THEME.colors.accent5, width: 1 },
    shadow: { type: 'outer', color: '0F1B3D', opacity: 0.08, blur: 8, offset: 2, angle: 90 }
  });
  const circleIcon = async (s, name, ic, x, y, d, bg, fg) => {
    s.addShape(pres.shapes.OVAL, { objectName: name + ' circle', x, y, w: d, h: d, fill: { color: bg } });
    const pad = d * 0.26;
    s.addImage({ objectName: name + ' icon', data: await icon(ic, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
  };
  const phone = (s, name, file, x, y, h) => {
    const w = h * 1170 / 1992;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: name + ' frame', x: x - 0.09, y: y - 0.09, w: w + 0.18, h: h + 0.18, rectRadius: 0.25,
      fill: { color: '0F1B3D' }, shadow: { type: 'outer', color: '0F1B3D', opacity: 0.25, blur: 14, offset: 4, angle: 90 } });
    s.addImage({ objectName: name, path: file, x, y, w, h, rounding: false, altText: 'Coatwright app screen' });
  };

  // ===== 1. Title =====
  pres.addSection({ title: 'Opening' });
  let s = pres.addSlide({ masterName: 'DARK_TITLE', sectionTitle: 'Opening' });
  s.addImage({ objectName: 'logo', data: LOGO, x: 0.8, y: 1.05, w: 0.8, h: 0.8 });
  s.addText('Coatwright', { isTextBox: true, objectName: 'brand', x: 1.75, y: 1.1, w: 4, h: 0.7, fontSize: 28, bold: true, color: C.background1, margin: 0, valign: 'middle' });
  s.addText('More contractors. Bigger paint orders. Less counter chaos.', { placeholder: 'title' });
  s.addText('A partnership pitch for paint stores', { placeholder: 'body' });
  s.addText([{ text: 'Presented by ', options: { color: C.accent5 } }, { text: '[Your name], Founder & CEO', options: { bold: true, color: C.background1 } }],
    { isTextBox: true, objectName: 'presenter', x: 0.8, y: 6.3, w: 7, h: 0.4, fontSize: 16, margin: 0 });
  phone(s, 'hero phone', ROOT + '/landing/shot-estimate.png', 9.4, 0.9, 5.7);
  s.addNotes('Thank them for the time. One-line intro: "I built Coatwright, an app painting contractors use to quote jobs, invoice and track profit. I think it can send your store more and bigger paint orders, and I would like to show you how in about 10 minutes."');

  // ===== 2. The problem =====
  pres.addSection({ title: 'The opportunity' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'The opportunity' });
  s.addText('Today, paint orders start late and leave easily', { placeholder: 'title' });
  const probs = [
    ['FaFileAlt', 'Quotes on paper', 'Many painters still price jobs by hand at night, so colours and quantities are decided at the last minute.'],
    ['FaClock', 'Orders at the counter', 'Paint is ordered when the painter walks in, which means rush mixing, waiting and phone calls at 7 a.m.'],
    ['FaRandom', 'Easy to switch stores', 'Without a reason to stay, contractors buy wherever is closest that morning.'],
    ['FaEyeSlash', 'No view of upcoming jobs', 'The store finds out about a job the day the paint is needed, not when it is won.']
  ];
  for (let i = 0; i < probs.length; i++) {
    const x = 0.6 + i * 3.08, y = 1.7;
    card(s, 'problem card ' + (i + 1), x, y, 2.85, 4.6);
    await circleIcon(s, 'problem ' + (i + 1), probs[i][0], x + 0.3, y + 0.35, 0.9, THEME.colors.lt2, THEME.colors.accent1);
    s.addText(probs[i][1], { isTextBox: true, objectName: 'problem title ' + (i + 1), x: x + 0.3, y: y + 1.45, w: 2.3, h: 0.8, fontSize: 20, bold: true, color: C.text1, margin: 0, valign: 'top' });
    s.addText(probs[i][2], { isTextBox: true, objectName: 'problem text ' + (i + 1), x: x + 0.3, y: y + 2.3, w: 2.3, h: 2.1, fontSize: 15, color: C.accent4, margin: 0, valign: 'top' });
  }
  s.addNotes('Ask: "Does this sound like your contractor desk?" Let them talk. Every minute they describe their own pain is worth more than any slide.');

  // ===== 3. Meet Coatwright =====
  s = pres.addSlide({ masterName: 'TINT', sectionTitle: 'The opportunity' });
  s.addText('Meet Coatwright: the quoting app built for painters', { placeholder: 'title' });
  phone(s, 'quote phone', ROOT + '/landing/shot-quote.png', 0.9, 1.55, 5.1);
  phone(s, 'stats phone', ROOT + '/landing/shot-stats.png', 4.2, 1.55, 5.1);
  const feats = [
    ['FaBolt', 'Itemized quotes in minutes', 'Interior, exterior, cabinets, floors and commercial, with the painter\'s own rates and logo'],
    ['FaFileInvoiceDollar', 'Invoices and payments', 'Turn a won job into an invoice and track what is owed'],
    ['FaChartLine', 'Real profit per job', 'Painters see what they actually made, so they price better'],
    ['FaMobileAlt', 'Runs on any phone', 'Nothing to install from an app store; works on site']
  ];
  for (let i = 0; i < feats.length; i++) {
    const y = 1.6 + i * 1.3;
    await circleIcon(s, 'feature ' + (i + 1), feats[i][0], 7.6, y, 0.75, THEME.colors.accent1, 'FFFFFF');
    s.addText(feats[i][1], { isTextBox: true, objectName: 'feature title ' + (i + 1), x: 8.6, y: y - 0.05, w: 4.2, h: 0.45, fontSize: 20, bold: true, color: C.text1, margin: 0 });
    s.addText(feats[i][2], { isTextBox: true, objectName: 'feature text ' + (i + 1), x: 8.6, y: y + 0.4, w: 4.2, h: 0.7, fontSize: 14, color: C.accent4, margin: 0, valign: 'top' });
  }
  s.addNotes('Hand them your phone with the demo account open. Build a quick room quote live (Owner account has full access). Keep it under 2 minutes.');

  // ===== 4. How it works with the store =====
  pres.addSection({ title: 'How it works' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'How it works' });
  s.addText('From quote to paint ready for pickup', { placeholder: 'title' });
  const steps = [
    ['FaClipboardList', 'Painter quotes the job', 'Rooms, sizes and coats; Coatwright works out the gallons'],
    ['FaPalette', 'Picks colours per room', 'Colour names and codes from your store\'s lines'],
    ['FaTrophy', 'Wins the job', 'Customer accepts the itemized quote'],
    ['FaPaperPlane', 'Order goes to your store', 'One tap sends products, colours and quantities'],
    ['FaBoxOpen', 'Paint is ready', 'You mix ahead; the painter picks up and goes']
  ];
  for (let i = 0; i < steps.length; i++) {
    const x = 0.6 + i * 2.48;
    await circleIcon(s, 'step ' + (i + 1), steps[i][0], x + 0.55, 1.9, 1.1, i === 3 ? THEME.colors.accent2 : THEME.colors.accent1, i === 3 ? THEME.colors.dk1 : 'FFFFFF');
    if (i < steps.length - 1) s.addShape(pres.shapes.RIGHT_ARROW, { objectName: 'arrow ' + (i + 1), x: x + 1.8, y: 2.3, w: 0.55, h: 0.3, fill: { color: THEME.colors.accent5 } });
    s.addText(String(i + 1), { isTextBox: true, objectName: 'step number ' + (i + 1), x: x, y: 3.25, w: 2.2, h: 0.4, fontSize: 14, bold: true, color: C.accent1, align: 'center', margin: 0 });
    s.addText(steps[i][1], { isTextBox: true, objectName: 'step title ' + (i + 1), x: x, y: 3.65, w: 2.2, h: 0.8, fontSize: 18, bold: true, color: C.text1, align: 'center', margin: 0, valign: 'top' });
    s.addText(steps[i][2], { isTextBox: true, objectName: 'step text ' + (i + 1), x: x + 0.05, y: 4.45, w: 2.1, h: 1.2, fontSize: 14, color: C.accent4, align: 'center', margin: 0, valign: 'top' });
  }
  card(s, 'callout', 0.6, 5.85, 12.1, 0.85, THEME.colors.lt2);
  s.addText([{ text: 'The difference: ', options: { bold: true, color: C.text1 } }, { text: 'your store hears about the job when it is won, not the morning the paint is needed.', options: { color: C.text1 } }],
    { isTextBox: true, objectName: 'callout text', x: 0.9, y: 5.85, w: 11.6, h: 0.85, fontSize: 18, margin: 0, valign: 'middle' });
  s.addNotes('Walk through the five steps slowly. Step 4 is the one that matters to them: the order lands at the counter before the painter does. The colour picker and send-order step are being added for store pilots.');

  // ===== 5. What the store gets =====
  pres.addSection({ title: 'Benefits' });
  s = pres.addSlide({ masterName: 'TINT', sectionTitle: 'Benefits' });
  s.addText('What your store gets', { placeholder: 'title' });
  const gets = [
    ['FaCalendarCheck', 'Orders earlier', 'Plan mixing and stock days ahead instead of at the counter'],
    ['FaFillDrip', 'Bigger, complete orders', 'Quantities come from the measured quote, so nothing is forgotten'],
    ['FaHandshake', 'Loyal contractors', 'Their quoting tool sends orders to your store, every job'],
    ['FaUserPlus', 'New contractors', 'Painters who sign up through your store become your customers'],
    ['FaStopwatch', 'Less counter time', 'Fewer rush orders, phone calls and waiting at opening'],
    ['FaStore', 'Your name on it', 'Coatwright for [Your Store]: your logo and counter details']
  ];
  for (let i = 0; i < gets.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.6 + col * 4.1, y = 1.55 + row * 2.6;
    card(s, 'benefit card ' + (i + 1), x, y, 3.85, 2.35);
    await circleIcon(s, 'benefit ' + (i + 1), gets[i][0], x + 0.3, y + 0.3, 0.75, THEME.colors.accent1, 'FFFFFF');
    s.addText(gets[i][1], { isTextBox: true, objectName: 'benefit title ' + (i + 1), x: x + 1.25, y: y + 0.3, w: 2.4, h: 0.75, fontSize: 19, bold: true, color: C.text1, margin: 0, valign: 'middle' });
    s.addText(gets[i][2], { isTextBox: true, objectName: 'benefit text ' + (i + 1), x: x + 0.3, y: y + 1.25, w: 3.3, h: 0.95, fontSize: 15, color: C.accent4, margin: 0, valign: 'top' });
  }
  s.addNotes('Pause on loyalty and new contractors: those are revenue. Counter time is the quality-of-life win for staff.');

  // ===== 6. What contractors get =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Benefits' });
  s.addText('Why your contractors will actually use it', { placeholder: 'title' });
  phone(s, 'estimate phone', ROOT + '/landing/shot-estimate.png', 9.3, 1.45, 5.3);
  const why = [
    ['FaBolt', 'Quote faster, win more', 'A professional, itemized quote before they leave the driveway'],
    ['FaDollarSign', 'Know their real profit', 'See what each job really made and price the next one better'],
    ['FaPaintRoller', 'Paint is ready when they arrive', 'No waiting at the counter; straight to the job'],
    ['FaGift', 'Included through your store', 'A perk you give your best contractors, not another bill for them']
  ];
  for (let i = 0; i < why.length; i++) {
    const y = 1.55 + i * 1.32;
    await circleIcon(s, 'why ' + (i + 1), why[i][0], 0.6, y, 0.8, THEME.colors.lt2, THEME.colors.accent1);
    s.addText(why[i][1], { isTextBox: true, objectName: 'why title ' + (i + 1), x: 1.65, y: y - 0.02, w: 7, h: 0.45, fontSize: 20, bold: true, color: C.text1, margin: 0 });
    s.addText(why[i][2], { isTextBox: true, objectName: 'why text ' + (i + 1), x: 1.65, y: y + 0.43, w: 7, h: 0.5, fontSize: 15, color: C.accent4, margin: 0 });
  }
  s.addNotes('Stores only win if contractors use it daily. Coatwright saves painters time and makes them money on every quote, which is why they keep coming back to it.');

  // ===== 7. The numbers (illustrative) =====
  s = pres.addSlide({ masterName: 'TINT', sectionTitle: 'Benefits' });
  s.addText('What it could mean for your sales', { placeholder: 'title' });
  const stats = [['20', 'contractors using Coatwright through your store'], ['+1', 'extra job per contractor per month sent to you'], ['15 gal', 'average paint per interior job'], ['$21,000', 'extra paint sales per month']];
  for (let i = 0; i < stats.length; i++) {
    const x = 0.6 + i * 3.08, last = i === 3;
    card(s, 'stat card ' + (i + 1), x, 1.6, 2.85, 2.9, last ? THEME.colors.accent1 : undefined);
    s.addText(stats[i][0], { isTextBox: true, objectName: 'stat value ' + (i + 1), x: x + 0.2, y: 1.85, w: 2.45, h: 1.1, fontSize: last ? 44 : 54, bold: true, color: last ? C.background1 : C.accent1, align: 'center', margin: 0, valign: 'middle' });
    s.addText(stats[i][1], { isTextBox: true, objectName: 'stat label ' + (i + 1), x: x + 0.25, y: 3.05, w: 2.35, h: 1.2, fontSize: 15, color: last ? C.background1 : C.text1, align: 'center', margin: 0, valign: 'top' });
    if (i < 3) s.addText(i < 2 ? '×' : '=', { isTextBox: true, objectName: 'operator ' + (i + 1), x: x + 2.85, y: 2.65, w: 0.23, h: 0.6, fontSize: 24, bold: true, color: C.accent4, align: 'center', margin: 0 });
  }
  s.addText('20 contractors × 1 extra job × 15 gallons × about $70 a gallon ≈ $21,000 a month, or about $250,000 a year.', { isTextBox: true, objectName: 'math', x: 0.6, y: 4.85, w: 12.1, h: 0.5, fontSize: 18, color: C.text1, margin: 0 });
  s.addText('Illustrative example only. Your contractor count, job mix and prices will differ; the pilot measures your real numbers.', { isTextBox: true, objectName: 'disclaimer', x: 0.6, y: 5.45, w: 12.1, h: 0.5, fontSize: 13, italic: true, color: C.accent4, margin: 0 });
  s.addNotes('Ask them to plug in their own numbers: how many active contractors, average gallons per job, average price per gallon. Let them do the maths out loud. Be clear this is an example, not a promise.');

  // ===== 8. Store-branded =====
  pres.addSection({ title: 'The offer' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'The offer' });
  s.addText('Coatwright for [Your Store]', { placeholder: 'title' });
  card(s, 'mock card', 0.6, 1.55, 5.6, 4.9, THEME.colors.lt2);
  s.addImage({ objectName: 'mock logo', data: LOGO, x: 0.95, y: 1.9, w: 0.7, h: 0.7 });
  s.addText('Coatwright', { isTextBox: true, objectName: 'mock brand', x: 1.8, y: 1.9, w: 3.5, h: 0.4, fontSize: 20, bold: true, color: C.text1, margin: 0 });
  s.addText('for [Your Store Name]', { isTextBox: true, objectName: 'mock store', x: 1.8, y: 2.3, w: 4, h: 0.35, fontSize: 15, color: C.accent1, bold: true, margin: 0 });
  const mockRows = ['Your logo on quotes and in the app', 'Orders sent to your counter email', 'Your colour lines and products', 'Your address, hours and phone'];
  for (let i = 0; i < mockRows.length; i++) {
    const y = 3.0 + i * 0.8;
    s.addImage({ objectName: 'mock check ' + (i + 1), data: await icon('FaCheckCircle', THEME.colors.accent3), x: 0.95, y: y + 0.05, w: 0.35, h: 0.35 });
    s.addText(mockRows[i], { isTextBox: true, objectName: 'mock row ' + (i + 1), x: 1.45, y, w: 4.5, h: 0.45, fontSize: 16, color: C.text1, margin: 0, valign: 'middle' });
  }
  const how = [
    ['FaQrcode', 'QR code at the counter', 'Contractors scan, sign up and are linked to your store in a minute'],
    ['FaUsers', 'Your staff recommend it', 'A short script for the contractor desk; we train your team'],
    ['FaEnvelopeOpenText', 'Orders arrive clearly', 'Product, colour, sheen, quantity and pickup date in one message']
  ];
  for (let i = 0; i < how.length; i++) {
    const y = 1.6 + i * 1.6;
    await circleIcon(s, 'how ' + (i + 1), how[i][0], 6.8, y, 0.85, THEME.colors.accent1, 'FFFFFF');
    s.addText(how[i][1], { isTextBox: true, objectName: 'how title ' + (i + 1), x: 7.9, y: y, w: 4.8, h: 0.45, fontSize: 20, bold: true, color: C.text1, margin: 0 });
    s.addText(how[i][2], { isTextBox: true, objectName: 'how text ' + (i + 1), x: 7.9, y: y + 0.45, w: 4.8, h: 0.8, fontSize: 15, color: C.accent4, margin: 0, valign: 'top' });
  }
  s.addNotes('Uses the store\'s own name and logo, which the owner can approve. Brand names (e.g. a manufacturer\'s colour library) only with that manufacturer\'s permission; painters can always type colour names and codes.');

  // ===== 9. Pilot =====
  s = pres.addSlide({ masterName: 'TINT', sectionTitle: 'The offer' });
  s.addText('Start with a free 60-day pilot', { placeholder: 'title' });
  const pilot = [
    ['Week 1', 'Set up', 'Your logo and order email, QR code at the counter, 15-minute staff walkthrough'],
    ['Weeks 2–8', 'Run it', '5–10 of your contractors quote and send orders through Coatwright'],
    ['Week 9', 'Review', 'We look at the numbers together and decide whether to continue']
  ];
  for (let i = 0; i < pilot.length; i++) {
    const x = 0.6 + i * 4.1;
    card(s, 'pilot card ' + (i + 1), x, 1.6, 3.85, 2.8);
    s.addText(pilot[i][0], { isTextBox: true, objectName: 'pilot when ' + (i + 1), x: x + 0.35, y: 1.85, w: 3.2, h: 0.4, fontSize: 15, bold: true, color: C.accent1, margin: 0 });
    s.addText(pilot[i][1], { isTextBox: true, objectName: 'pilot title ' + (i + 1), x: x + 0.35, y: 2.25, w: 3.2, h: 0.55, fontSize: 24, bold: true, color: C.text1, margin: 0 });
    s.addText(pilot[i][2], { isTextBox: true, objectName: 'pilot text ' + (i + 1), x: x + 0.35, y: 2.9, w: 3.2, h: 1.35, fontSize: 15, color: C.accent4, margin: 0, valign: 'top' });
  }
  s.addText('What we measure', { isTextBox: true, objectName: 'measure title', x: 0.6, y: 4.75, w: 6, h: 0.45, fontSize: 20, bold: true, color: C.text1, margin: 0 });
  const measures = ['Orders and gallons sent to your store', 'New contractors who signed up through you', 'How far ahead orders arrived', 'What your staff and contractors say'];
  s.addText(measures.map((m, i) => ({ text: m, options: { bullet: true, breakLine: i < measures.length - 1 } })),
    { isTextBox: true, objectName: 'measures', x: 0.6, y: 5.2, w: 12.1, h: 1.5, fontSize: 16, color: C.text1, margin: 0, paraSpaceAfter: 4, valign: 'top' });
  s.addNotes('No cost, no contract for the pilot. All you need: an email address for orders, a spot for the QR sign at the counter, and 5-10 contractors to invite.');

  // ===== 10. Pricing =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'The offer' });
  s.addText('Simple pricing after the pilot', { placeholder: 'title' });
  const plans = [
    ['Pilot', '$0', '60 days', ['Up to 10 contractors', 'Store branding and order email', 'Setup and staff walkthrough'], false],
    ['Store plan', '$299', 'per store / month', ['Unlimited contractors linked to your store', 'Coatwright included for your contractors', 'Orders to your counter, monthly report'], true],
    ['Per contractor', '$12', 'per contractor / month', ['Pay only for contractors you sponsor', 'Same features as the store plan', 'Good for smaller stores'], false]
  ];
  for (let i = 0; i < plans.length; i++) {
    const x = 0.6 + i * 4.1, featured = plans[i][4];
    card(s, 'plan card ' + (i + 1), x, 1.55, 3.85, 4.85, featured ? THEME.colors.dk2 : undefined);
    s.addText(plans[i][0], { isTextBox: true, objectName: 'plan name ' + (i + 1), x: x + 0.35, y: 1.85, w: 3.2, h: 0.45, fontSize: 20, bold: true, color: featured ? C.accent2 : C.accent1, margin: 0 });
    s.addText(plans[i][1], { isTextBox: true, objectName: 'plan price ' + (i + 1), x: x + 0.35, y: 2.3, w: 3.2, h: 0.95, fontSize: 54, bold: true, color: featured ? C.background1 : C.text1, margin: 0 });
    s.addText(plans[i][2], { isTextBox: true, objectName: 'plan unit ' + (i + 1), x: x + 0.35, y: 3.25, w: 3.2, h: 0.4, fontSize: 15, color: featured ? C.accent5 : C.accent4, margin: 0 });
    s.addText(plans[i][3].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < 2 } })),
      { isTextBox: true, objectName: 'plan features ' + (i + 1), x: x + 0.35, y: 3.85, w: 3.2, h: 2.3, fontSize: 15, color: featured ? C.background1 : C.text1, margin: 0, paraSpaceAfter: 6, valign: 'top' });
  }
  s.addText('Prices in USD. Multi-store and dealer-group pricing available.', { isTextBox: true, objectName: 'pricing note', x: 0.6, y: 6.5, w: 12.1, h: 0.35, fontSize: 13, italic: true, color: C.accent4, margin: 0 });
  s.addNotes('Anchor on value: one contractor sending one extra job a month (about $1,000 in paint) pays for the store plan several times over. Edit these prices before each meeting if needed.');

  // ===== 11. Close =====
  pres.addSection({ title: 'Next steps' });
  s = pres.addSlide({ masterName: 'DARK_TITLE', sectionTitle: 'Next steps' });
  s.addImage({ objectName: 'close logo', data: LOGO, x: 0.8, y: 1.05, w: 0.8, h: 0.8 });
  s.addText('Coatwright', { isTextBox: true, objectName: 'close brand', x: 1.75, y: 1.1, w: 4, h: 0.7, fontSize: 28, bold: true, color: C.background1, margin: 0, valign: 'middle' });
  s.addText('Let\'s start your pilot this month', { placeholder: 'title' });
  s.addText('Three things to begin: an order email, a spot for the counter QR code, and 5–10 contractors to invite.', { placeholder: 'body' });
  card(s, 'contact card', 8.9, 2.3, 3.7, 2.6, '1A2550');
  const contact = [['FaUser', '[Your name], Founder & CEO'], ['FaEnvelope', 'coatwrightapp@gmail.com'], ['FaGlobe', 'getcoatwright.com']];
  for (let i = 0; i < contact.length; i++) {
    const y = 2.65 + i * 0.7;
    s.addImage({ objectName: 'contact icon ' + (i + 1), data: await icon(contact[i][0], THEME.colors.accent2), x: 9.2, y: y + 0.06, w: 0.32, h: 0.32 });
    s.addText(contact[i][1], { isTextBox: true, objectName: 'contact ' + (i + 1), x: 9.7, y, w: 2.8, h: 0.45, fontSize: 15, color: C.background1, margin: 0, valign: 'middle' });
  }
  s.addNotes('Ask for the decision: "Can we start the pilot next week?" If they hesitate, ask what they would need to see. Leave a printed one-pager or send this deck by email the same day.');

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})().catch(e => { console.error(e); process.exit(1); });
