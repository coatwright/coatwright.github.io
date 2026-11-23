/*
 * Coatwright commercial takeoff: measure blueprints (or type totals) by paint system and price the bid.
 * Pure functions (tested in Node). The blueprint viewer lives in plan.js; the screens in app.js.
 *
 * A job in takeoff mode keeps everything in job.takeoff:
 *   systems   paint systems ("Walls, eggshell, 2 coats"), each measured as wall (length × height), area, length or count
 *   zones     floors/areas the bid is split by ("Level 1", "Suite 200")
 *   marks     measurements: typed numbers, or lines/areas/counts drawn on a plan page (in PDF points)
 *   plans     blueprint files (the PDF itself stays on the device; scale per page is saved here)
 *   adds      direct costs such as lift rental or mobilization (marked up like everything else)
 *   alternates  optional add-on prices shown on the proposal, not in the total
 */
(function (global) {
  'use strict';

  var P = typeof module !== 'undefined' && module.exports ? require('./pricing.js') : global.Pricing;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

  var MEASURES = {
    wall: { unit: 'sq ft', label: 'Walls (length × height)', tool: 'line', rateUnit: 'sq ft/hr per coat', coverUnit: 'sq ft/gal per coat' },
    area: { unit: 'sq ft', label: 'Area (ceilings, floors, decks)', tool: 'area', rateUnit: 'sq ft/hr per coat', coverUnit: 'sq ft/gal per coat' },
    length: { unit: 'lin ft', label: 'Length (base, trim, rails)', tool: 'line', rateUnit: 'lin ft/hr per coat', coverUnit: 'lin ft/gal per coat' },
    count: { unit: 'each', label: 'Count (doors, frames)', tool: 'count', rateUnit: 'hours each (all coats)', coverUnit: 'gallons each' }
  };

  var COLORS = ['#1f5eff', '#e8590c', '#2b8a3e', '#c2255c', '#7048e8', '#0c8599', '#f08c00', '#5c940d', '#d6336c', '#1971c2', '#862e9c', '#495057'];

  // Commercial paint systems. Rates are typical commercial production (roll/spray) and are fully editable.
  // priceKey/priceFactor start from the painter's own paint prices in Settings.
  var SYSTEM_PRESETS = [
    { key: 'walls_eggshell', name: 'Walls — eggshell, 2 coats', measure: 'wall', coats: 2, rate: 250, coverage: 350, priceKey: 'wallPaintPrice', sheen: 'Eggshell' },
    { key: 'walls_semigloss', name: 'Walls — semi-gloss (washrooms, corridors)', measure: 'wall', coats: 2, rate: 225, coverage: 350, priceKey: 'wallPaintPrice', priceFactor: 1.1, sheen: 'Semi-gloss' },
    { key: 'walls_new', name: 'New drywall — prime + 2 coats', measure: 'wall', coats: 2, primer: true, rate: 275, coverage: 350, priceKey: 'wallPaintPrice', sheen: 'Eggshell' },
    { key: 'cmu', name: 'CMU block — block filler + 2 coats', measure: 'wall', coats: 2, primer: true, rate: 150, coverage: 250, priceKey: 'wallPaintPrice', sheen: 'Semi-gloss' },
    { key: 'ceilings_flat', name: 'Ceilings — flat (drywall)', measure: 'area', coats: 2, rate: 200, coverage: 350, priceKey: 'ceilingPaintPrice', sheen: 'Flat' },
    { key: 'deck_dryfall', name: 'Exposed deck & joists — dryfall (spray)', measure: 'area', coats: 1, rate: 600, coverage: 200, priceKey: 'ceilingPaintPrice', priceFactor: 1.3, sheen: 'Flat' },
    { key: 'doors', name: 'Doors — both sides', measure: 'count', coats: 2, rate: 1, coverage: 0.3, priceKey: 'trimPaintPrice', sheen: 'Semi-gloss' },
    { key: 'hm_frames', name: 'Hollow metal door frames', measure: 'count', coats: 2, rate: 0.5, coverage: 0.15, priceKey: 'trimPaintPrice', sheen: 'Semi-gloss' },
    { key: 'base_trim', name: 'Baseboard & trim', measure: 'length', coats: 2, rate: 80, coverage: 300, priceKey: 'trimPaintPrice', sheen: 'Semi-gloss' },
    { key: 'handrails', name: 'Handrails & railings', measure: 'length', coats: 2, rate: 25, coverage: 150, priceKey: 'trimPaintPrice', sheen: 'Gloss' },
    { key: 'bollards', name: 'Bollards & pipe guards', measure: 'count', coats: 2, rate: 0.5, coverage: 0.25, priceKey: 'trimPaintPrice', sheen: 'Gloss' },
    { key: 'epoxy', name: 'Floor — 2-part epoxy', measure: 'area', coats: 2, rate: 300, coverage: 250, priceKey: 'floorPaintPrice', priceFactor: 2, sheen: 'Gloss' },
    { key: 'ext_walls', name: 'Exterior walls', measure: 'wall', coats: 2, rate: 175, coverage: 300, priceKey: 'extPaintPrice', sheen: 'Satin' },
    { key: 'custom_wall', name: 'Other — walls', measure: 'wall', coats: 2, rate: 225, coverage: 350, priceKey: 'wallPaintPrice' },
    { key: 'custom_area', name: 'Other — area', measure: 'area', coats: 2, rate: 200, coverage: 350, priceKey: 'ceilingPaintPrice' },
    { key: 'custom_count', name: 'Other — count', measure: 'count', coats: 2, rate: 0.5, coverage: 0.2, priceKey: 'trimPaintPrice' }
  ];

  var ADD_PRESETS = ['Scissor lift rental', 'Boom lift rental', 'Mobilization', 'After-hours / weekend premium', 'Parking & permits', 'Floor protection'];

  // Drawing scales. ftPerPt = real feet per PDF point (1 point = 1/72 inch on the printed sheet).
  var SCALES = [
    ['1/16" = 1\'-0"', 16 / 72], ['3/32" = 1\'-0"', 32 / 3 / 72], ['1/8" = 1\'-0"', 8 / 72], ['3/16" = 1\'-0"', 16 / 3 / 72],
    ['1/4" = 1\'-0"', 4 / 72], ['3/8" = 1\'-0"', 8 / 3 / 72], ['1/2" = 1\'-0"', 2 / 72], ['3/4" = 1\'-0"', 4 / 3 / 72], ['1" = 1\'-0"', 1 / 72],
    ['1" = 10\'', 10 / 72], ['1" = 20\'', 20 / 72], ['1" = 30\'', 30 / 72], ['1" = 40\'', 40 / 72], ['1" = 50\'', 50 / 72],
    ['1:50', 50 / 864], ['1:75', 75 / 864], ['1:100', 100 / 864], ['1:200', 200 / 864]
  ].map(function (s) { return { label: s[0], ftPerPt: s[1] }; });

  var DEFAULT_TEXT = {
    inclusions: 'All labour, paint and materials for the scope above\nSurface preparation: fill nail holes, caulk, spot-sand\n' +
      'Protection of floors, fixtures and finished surfaces\nDaily clean-up of our work areas\nOne touch-up walkthrough at completion',
    exclusions: 'Drywall repairs beyond minor patching\nWallcovering removal\nWork not shown on the drawings provided\n' +
      'After-hours or weekend work unless listed\nPermits, bonds and prevailing wage unless listed',
    clarifications: 'Based on the drawings provided. Up to 3 colours per area, chosen before we start.\n' +
      'Areas must be ready for paint (other trades finished) when we arrive. Price valid for 30 days.'
  };

  var SYSTEM_FIELDS = ['preset', 'name', 'measure', 'coats', 'primer', 'rate', 'coverage', 'price', 'unitPrice', 'color', 'brand', 'product', 'sheen', 'paintColor'];
  var DEFAULT_SYSTEMS = ['walls_eggshell', 'ceilings_flat', 'doors', 'hm_frames'];

  /** The painter's saved commercial defaults (Settings → Commercial), filled in with starting values. */
  function commercialDefaults(settings) {
    var c = (settings && settings.commercial) || {};
    var has = function (k) { return c[k] !== undefined && c[k] !== null; };
    return {
      laborRate: has('laborRate') ? c.laborRate : '', overheadPct: has('overheadPct') ? c.overheadPct : 10, profitPct: has('profitPct') ? c.profitPct : 15,
      wallHeight: has('wallHeight') ? c.wallHeight : 10, method: c.method === 'unit' ? 'unit' : 'hours',
      systems: Array.isArray(c.systems) ? c.systems : null,
      inclusions: has('inclusions') ? c.inclusions : DEFAULT_TEXT.inclusions, exclusions: has('exclusions') ? c.exclusions : DEFAULT_TEXT.exclusions,
      clarifications: has('clarifications') ? c.clarifications : DEFAULT_TEXT.clarifications
    };
  }
  function pickSystem(sys) { var o = {}; SYSTEM_FIELDS.forEach(function (k) { if (sys[k] !== undefined) o[k] = sys[k]; }); return o; }
  /** Starting paint systems for Settings → Commercial (from the painter's paint prices). */
  function defaultLibrary(settings) {
    return DEFAULT_SYSTEMS.map(function (k, i) { return pickSystem(presetSystem(k, settings, i)); });
  }
  /** Add or replace a system in the painter's saved defaults (matched by name). Returns the new settings.commercial. */
  function saveToLibrary(settings, sys) {
    var c = Object.assign({}, commercialDefaults(settings));
    var list = (c.systems || defaultLibrary(settings)).slice(), item = pickSystem(sys);
    var i = list.findIndex(function (x) { return String(x.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase(); });
    if (i === -1) list.push(item); else list[i] = item;
    c.systems = list;
    return c;
  }

  function newSystem(presetKey, settings, index) {
    var lib = (commercialDefaults(settings).systems || []).find(function (x) { return x.preset === presetKey; });
    if (lib) return Object.assign(presetSystem(presetKey, settings, index), pickSystem(lib), { id: uid() });
    return presetSystem(presetKey, settings, index);
  }

  function presetSystem(presetKey, settings, index) {
    var p = SYSTEM_PRESETS.find(function (x) { return x.key === presetKey; }) || SYSTEM_PRESETS[0];
    var s = Object.assign({}, P.DEFAULT_SETTINGS, settings);
    return { id: uid(), preset: p.key, name: p.name, measure: p.measure, coats: p.coats, primer: !!p.primer,
      rate: p.rate, coverage: p.coverage, price: round2(num(s[p.priceKey]) * (p.priceFactor || 1)), unitPrice: '',
      color: COLORS[(index || 0) % COLORS.length], brand: '', product: '', sheen: p.sheen || '', paintColor: '' };
  }

  /** A new takeoff, starting from the painter's commercial defaults (Settings → Commercial). */
  function newTakeoff(settings) {
    var c = commercialDefaults(settings);
    var t = { v: 1, method: c.method, laborRate: c.laborRate, overheadPct: c.overheadPct, profitPct: c.profitPct, wallHeight: c.wallHeight, breakdown: 'system',
      systems: [], zones: [{ id: uid(), name: 'Level 1' }], marks: [], plans: [], adds: [], alternates: [],
      inclusions: c.inclusions, exclusions: c.exclusions, clarifications: c.clarifications };
    if (c.systems && c.systems.length) {
      c.systems.forEach(function (lib, i) { t.systems.push(Object.assign(presetSystem(lib.preset, settings, i), pickSystem(lib), { id: uid() })); });
    } else {
      DEFAULT_SYSTEMS.forEach(function (k, i) { t.systems.push(newSystem(k, settings, i)); });
    }
    return t;
  }

  // ---------- Geometry (PDF points) ----------
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
  function pathLength(pts, closed) {
    var L = 0;
    for (var i = 1; i < (pts || []).length; i++) L += dist(pts[i - 1], pts[i]);
    if (closed && pts.length > 2) L += dist(pts[pts.length - 1], pts[0]);
    return L;
  }
  function polygonArea(pts) {
    var a = 0;
    for (var i = 0, n = (pts || []).length; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  }

  function find(list, id) { return (list || []).find(function (x) { return x.id === id; }); }
  function scaleOf(t, planId, page) {
    var plan = find(t.plans, planId), sc = plan && plan.scales && plan.scales[page];
    return sc && num(sc.ftPerPt) > 0 ? num(sc.ftPerPt) : 0;
  }
  function heightOf(t, mark) { return num(mark.h) || num(t.wallHeight) || 10; }

  /**
   * How much one measurement adds to its system, in the system's unit.
   * Walls and lengths use the run's length (a closed shape counts its perimeter); areas use the enclosed area.
   * Returns { qty, lf, noScale }.
   */
  function markQty(t, mark, sys) {
    var m = sys.measure, out = { qty: 0, lf: 0, noScale: false };
    if (mark.kind === 'typed') {
      if (m === 'wall' && num(mark.h) > 0) { out.lf = num(mark.qty); out.qty = num(mark.qty) * num(mark.h); }
      else out.qty = num(mark.qty);
    } else if (mark.kind === 'count') {
      out.qty = (mark.pts || []).length;
    } else {
      var f = scaleOf(t, mark.planId, mark.page);
      if (!f) { out.noScale = true; return out; }
      var closed = mark.kind === 'area' || mark.closed;
      if (m === 'area') out.qty = closed ? polygonArea(mark.pts) * f * f : 0;
      else {
        out.lf = pathLength(mark.pts, closed) * f;
        out.qty = m === 'wall' ? out.lf * heightOf(t, mark) : m === 'count' ? 0 : out.lf;
      }
    }
    if (mark.deduct) { out.qty = -out.qty; out.lf = -out.lf; }
    return out;
  }

  function markupFactor(t) { return (1 + num(t.overheadPct) / 100) * (1 + num(t.profitPct) / 100); }

  /** Price a takeoff. Everything the bid screen and proposal need. */
  function calc(job, settings) {
    var s = Object.assign({}, P.DEFAULT_SETTINGS, settings);
    var t = job.takeoff || newTakeoff(s);
    var rate = num(t.laborRate) || num(s.laborRate);
    var factor = markupFactor(t), unitMode = t.method === 'unit';
    var zoneIds = (t.zones || []).map(function (z) { return z.id; });
    var systems = (t.systems || []).map(function (sys) {
      var r = { id: sys.id, name: sys.name || 'System', measure: sys.measure, unit: (MEASURES[sys.measure] || MEASURES.wall).unit,
        color: sys.color, qty: 0, lf: 0, marks: 0, byZone: {}, noScale: 0, sys: sys };
      (t.marks || []).forEach(function (mk) {
        if (mk.systemId !== sys.id) return;
        var q = markQty(t, mk, sys);
        if (q.noScale) { r.noScale++; return; }
        r.marks++;
        r.qty += q.qty; r.lf += q.lf;
        var z = zoneIds.indexOf(mk.zoneId) !== -1 ? mk.zoneId : zoneIds[0];
        r.byZone[z] = (r.byZone[z] || 0) + q.qty;
      });
      r.qty = Math.max(0, r.qty);
      var coats = Math.max(1, Math.round(num(sys.coats)) || 1), count = sys.measure === 'count';
      var hrs = count ? r.qty * num(sys.rate) : (num(sys.rate) > 0 ? r.qty * coats / num(sys.rate) : 0);
      var gal = count ? r.qty * num(sys.coverage) : (num(sys.coverage) > 0 ? r.qty * coats / num(sys.coverage) : 0);
      var primerGal = 0;
      if (sys.primer && !count) {
        if (num(sys.rate) > 0) hrs += r.qty / num(sys.rate);
        if (num(sys.coverage) > 0) primerGal = r.qty / num(sys.coverage);
      }
      var buy = P.containers(gal), primerBuy = P.containers(primerGal);
      r.coats = coats;
      r.hours = round2(hrs);
      r.gallons = round2(gal);
      r.primerGallons = round2(primerGal);
      r.buyText = buy.text;
      r.labor = round2(hrs * rate);
      r.paint = round2(P.containerCost(buy, num(sys.price)) + P.containerCost(primerBuy, num(s.primerPrice)));
      r.supplies = round2(r.paint * num(s.suppliesPct) / 100);
      r.cost = round2(r.labor + r.paint + r.supplies);
      r.hoursPrice = round2(r.cost * factor);
      r.unitPrice = num(sys.unitPrice);
      r.price = unitMode && r.unitPrice > 0 ? round2(r.qty * r.unitPrice) : r.hoursPrice;
      r.perUnit = r.qty > 0 ? round2(r.hoursPrice / r.qty) : 0;
      r.qty = round2(r.qty); r.lf = round2(r.lf);
      return r;
    });
    var adds = (t.adds || []).filter(function (a) { return a && (a.label || num(a.cost)); }).map(function (a) {
      return { id: a.id, label: a.label || 'Additional cost', cost: round2(num(a.cost)), price: round2(num(a.cost) * factor) };
    });
    var alternates = (t.alternates || []).filter(function (a) { return a && (a.label || num(a.price)); })
      .map(function (a) { return { id: a.id, label: a.label || 'Alternate', price: round2(num(a.price)) }; });
    var sum = function (arr, k) { return round2(arr.reduce(function (x, y) { return x + y[k]; }, 0)); };
    var totals = {
      hours: sum(systems, 'hours'), labor: sum(systems, 'labor'), paint: sum(systems, 'paint'), supplies: sum(systems, 'supplies'),
      addsCost: sum(adds, 'cost'), systemsPrice: sum(systems, 'price'), addsPrice: sum(adds, 'price')
    };
    totals.materials = round2(totals.paint + totals.supplies);
    totals.cost = round2(totals.labor + totals.materials + totals.addsCost);
    totals.price = round2(totals.systemsPrice + totals.addsPrice);
    totals.crewDays = round2(totals.hours / 8);
    var zones = (t.zones || []).map(function (z) {
      var price = 0;
      systems.forEach(function (r) { if (r.qty > 0 && r.byZone[z.id]) price += r.price * r.byZone[z.id] / r.qty; });
      return { id: z.id, name: z.name || 'Area', price: round2(price) };
    });
    return { systems: systems, adds: adds, alternates: alternates, zones: zones, totals: totals, laborRate: rate, factor: factor, takeoff: t };
  }

  function qtyText(r) {
    return fmt(r.qty) + ' ' + r.unit + (r.measure === 'count' ? '' : ' · ' + r.coats + (r.coats === 1 ? ' coat' : ' coats')) +
      (r.sys.primer && r.measure !== 'count' ? ' + primer' : '');
  }
  function specText(sys) { return [sys.brand, sys.product, sys.sheen, sys.paintColor].filter(Boolean).join(' · '); }

  /** The same shape as Pricing.calcJob, so quotes, invoices, schedule and stats work unchanged. */
  function toQuote(job, settings) {
    var s = Object.assign({}, P.DEFAULT_SETTINGS, settings);
    var c = calc(job, s), t = c.takeoff, lump = t.breakdown === 'lump';
    var active = c.systems.filter(function (r) { return r.qty > 0; });
    var line = function (r, share) {
      return { key: r.id, label: r.name, detail: [share === 1 ? qtyText(r) : fmt(r.qty * share) + ' ' + r.unit, specText(r.sys)].filter(Boolean).join(' · '),
        hours: round2(r.hours * share), laborCost: round2(r.labor * share), price: round2(r.price * share), included: lump };
    };
    var groups;
    if (t.breakdown === 'zone' && (t.zones || []).length > 1) {
      groups = (t.zones || []).map(function (z) {
        var lines = active.filter(function (r) { return r.byZone[z.id] > 0; }).map(function (r) { return line(r, r.byZone[z.id] / r.qty); });
        return { id: z.id, name: z.name || 'Area', summary: lines.length + (lines.length === 1 ? ' item' : ' items'), lines: lines };
      }).filter(function (g) { return g.lines.length; });
    } else {
      groups = [{ id: 'scope', name: 'Scope of work', summary: active.length + (active.length === 1 ? ' paint system' : ' paint systems'),
        lines: active.map(function (r) { return line(r, 1); }) }];
    }
    groups.forEach(function (g) {
      g.price = round2(g.lines.reduce(function (a, l) { return a + l.price; }, 0));
      g.hours = round2(g.lines.reduce(function (a, l) { return a + l.hours; }, 0));
      g.laborCost = round2(g.lines.reduce(function (a, l) { return a + l.laborCost; }, 0));
    });
    var extras = c.adds.map(function (a) { return { label: a.label, price: a.price }; })
      .concat((job.extras || []).filter(function (e) { return e && (e.label || num(e.price)); })
        .map(function (e) { return { label: e.label || 'Additional work', price: round2(num(e.price)) }; }));
    var roomsTotal = c.totals.systemsPrice;
    var extrasTotal = round2(extras.reduce(function (a, e) { return a + e.price; }, 0));
    var subtotal = round2(roomsTotal + extrasTotal);
    var discount = Math.min(round2(num(job.discount)), subtotal);
    var afterDiscount = round2(subtotal - discount);
    var minimumAdj = afterDiscount > 0 && afterDiscount < num(s.minimumJob) ? round2(num(s.minimumJob) - afterDiscount) : 0;
    var taxable = round2(afterDiscount + minimumAdj);
    var tax = round2(taxable * num(s.taxRate) / 100);
    var total = round2(taxable + tax);
    var cost = c.totals.cost;
    var revenue = round2(total - tax);
    var gallons = { wall: 0, ceiling: 0, trim: 0, primer: 0, ext: 0, stain: 0, floor: 0, cabinet: 0 };
    c.systems.forEach(function (r) {
      gallons[r.measure === 'wall' ? 'wall' : r.measure === 'area' ? 'ceiling' : 'trim'] += r.gallons;
      gallons.primer += r.primerGallons;
    });
    return {
      quick: false, takeoff: c, rooms: groups, outside: [], materials: [], extras: extras,
      roomsTotal: roomsTotal, materialsTotal: 0, extrasTotal: extrasTotal, subtotal: subtotal, discount: discount,
      minimumAdj: minimumAdj, tax: tax, total: total, deposit: round2(total * num(s.depositPct) / 100),
      internal: { hours: c.totals.hours, crewDays: c.totals.crewDays, laborCost: c.totals.labor,
        materialCost: round2(c.totals.materials + c.totals.addsCost), cost: cost, profit: round2(revenue - cost),
        margin: revenue > 0 ? round2((revenue - cost) / revenue * 100) : 0, gallons: gallons }
    };
  }

  var api = { MEASURES: MEASURES, COLORS: COLORS, SYSTEM_PRESETS: SYSTEM_PRESETS, ADD_PRESETS: ADD_PRESETS, SCALES: SCALES, DEFAULT_TEXT: DEFAULT_TEXT,
    newSystem: newSystem, newTakeoff: newTakeoff, commercialDefaults: commercialDefaults, defaultLibrary: defaultLibrary, saveToLibrary: saveToLibrary, pickSystem: pickSystem, uid: uid, dist: dist, pathLength: pathLength, polygonArea: polygonArea,
    scaleOf: scaleOf, markQty: markQty, markupFactor: markupFactor, calc: calc, toQuote: toQuote, qtyText: qtyText, specText: specText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Takeoff = api;
})(typeof window !== 'undefined' ? window : this);
