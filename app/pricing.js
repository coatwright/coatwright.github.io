/*
 * Coatwright pricing engine.
 * Pure functions only (no DOM) so it can be tested in Node and reused anywhere.
 */
(function (global) {
  'use strict';

  var DEFAULT_SETTINGS = {
    // Business info (shown on the quote)
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    website: '',
    logo: '',

    // Money
    laborRate: 55,        // $ per labor hour
    markup: 25,           // % added on top of labor + materials (overhead & profit)
    minimumJob: 450,      // smallest job you'll take, in $
    taxRate: 0,           // % sales tax applied to the total
    depositPct: 30,       // % deposit requested to book the job

    // Paint prices ($ per gallon, what YOU pay)
    wallPaintPrice: 45,
    ceilingPaintPrice: 35,
    trimPaintPrice: 55,
    primerPrice: 30,
    suppliesPct: 12,      // tape, plastic, caulk, patch: % of paint cost

    // Production rates (how fast you work, per coat)
    coverage: 350,        // sq ft one gallon covers
    wallRate: 175,        // sq ft of wall per hour
    ceilingRate: 140,     // sq ft of ceiling per hour
    trimRate: 50,         // linear ft of trim per hour
    doorHours: 0.75,      // hours per door (both sides, all coats)
    setupHours: 0.5,      // prep, protection & cleanup per room

    // Quote text
    validDays: 30,
    terms: 'Price includes all labor and materials listed. Furniture moving, ' +
      'masking and full cleanup included. Any additional work will be quoted ' +
      'before it starts. Balance due on completion.',
    nextNumber: 1001,
    invoiceDueDays: 7,    // 0 = due on receipt
    paymentInstructions: '',

    // Exterior & floors
    extPaintPrice: 60,    // $ per gallon exterior paint
    stainPrice: 45,       // $ per gallon deck/fence stain
    floorPaintPrice: 55,  // $ per gallon 1-part floor paint
    extWallRate: 125,     // sq ft of siding per hour, per coat
    deckRate: 100,        // sq ft of deck per hour, per coat
    fenceRate: 150,       // sq ft of fence per hour, per coat
    floorRate: 150,       // sq ft of floor paint per hour, per coat
    epoxySqft: 1.0,       // $ per sq ft for a 2-part epoxy kit
    flakeSqft: 2.0,       // $ per sq ft for epoxy + flakes + clear coat

    // Cabinets & specialty
    cabinetPaintPrice: 80, // $ per gallon cabinet enamel/primer
    cabinetDoorHours: 1.5, // hours per cabinet door (prep, prime, 2 coats, both sides)
  };

  var SIZES = {
    S: { label: 'Small', length: 10, width: 10 },
    M: { label: 'Medium', length: 12, width: 14 },
    L: { label: 'Large', length: 16, width: 20 }
  };

  var ROOM_TYPES = [
    { name: 'Bedroom', icon: '🛏️', size: 'M', doors: 2, windows: 2 },
    { name: 'Living Room', icon: '🛋️', size: 'L', doors: 1, windows: 3 },
    { name: 'Kitchen', icon: '🍳', size: 'M', doors: 1, windows: 1 },
    { name: 'Bathroom', icon: '🛁', size: 'S', doors: 1, windows: 1, length: 8, width: 6 },
    { name: 'Dining Room', icon: '🍽️', size: 'M', doors: 1, windows: 2 },
    { name: 'Hallway', icon: '🚪', size: 'custom', doors: 0, windows: 0, length: 15, width: 4 },
    { name: 'Office', icon: '💻', size: 'S', doors: 1, windows: 1 },
    { name: 'Other', icon: '➕', size: 'M', doors: 1, windows: 1 }
  ];

  // Every commercial area a painter might price, small closets to warehouse floors.
  var C = function (id, name, icon, length, width, height, doors, windows) {
    return { id: id, name: name, icon: icon, size: 'custom', length: length, width: width,
      height: height, doors: doors, windows: windows };
  };
  var COMMERCIAL_AREAS = [
    C('office', 'Office', '💼', 10, 12, 9, 1, 1),
    C('conference', 'Conference Room', '👥', 14, 20, 9, 1, 2),
    C('openoffice', 'Open Office', '🗂️', 40, 30, 9, 2, 6),
    C('lobby', 'Lobby / Reception', '🛎️', 20, 16, 10, 2, 2),
    C('waiting', 'Waiting Room', '🪑', 16, 14, 9, 1, 2),
    C('restroom', 'Restroom', '🚻', 10, 8, 9, 1, 0),
    C('breakroom', 'Break Room', '☕', 14, 12, 9, 1, 1),
    C('hallway', 'Hallway / Corridor', '🚪', 30, 6, 9, 0, 0),
    C('stairwell', 'Stairwell', '🪜', 10, 8, 20, 2, 0),
    C('storage', 'Storage / Closet', '📦', 8, 6, 9, 1, 0),
    C('salesfloor', 'Sales Floor', '🛍️', 40, 30, 12, 1, 2),
    C('fitting', 'Fitting Room', '👗', 5, 5, 8, 1, 0),
    C('dining', 'Dining Area', '🍽️', 30, 25, 10, 2, 4),
    C('bar', 'Bar Area', '🍸', 20, 15, 10, 1, 1),
    C('kitchen', 'Commercial Kitchen', '🍳', 20, 15, 10, 2, 0),
    C('exam', 'Exam / Patient Room', '🩺', 10, 10, 9, 1, 1),
    C('treatment', 'Treatment Room', '💆', 10, 10, 9, 1, 0),
    C('salon', 'Salon Floor', '💇', 25, 20, 10, 1, 2),
    C('guestroom', 'Hotel Guest Room', '🛏️', 12, 16, 9, 2, 1),
    C('common', 'Common Area', '🛋️', 20, 15, 9, 2, 1),
    C('laundry', 'Laundry Room', '🧺', 15, 12, 9, 1, 0),
    C('classroom', 'Classroom', '🏫', 30, 25, 10, 1, 4),
    C('teller', 'Teller Area', '🏦', 25, 20, 10, 1, 2),
    C('hall', 'Event / Meeting Hall', '🎤', 60, 40, 16, 3, 6),
    C('sanctuary', 'Sanctuary', '⛪', 60, 40, 20, 3, 8),
    C('gymfloor', 'Workout / Gym Floor', '🏋️', 50, 40, 14, 2, 2),
    C('locker', 'Locker Room', '🚿', 20, 15, 9, 1, 0),
    C('showroom', 'Showroom', '🚗', 50, 40, 16, 2, 6),
    C('servicebay', 'Service Bay / Shop', '🔧', 40, 30, 16, 2, 0),
    C('warehouse', 'Warehouse Floor', '🏭', 100, 60, 20, 2, 0),
    C('other', 'Other Area', '➕', 12, 14, 9, 1, 1)
  ];
  var COMMERCIAL_ROOM_TYPES = COMMERCIAL_AREAS;

  // Step 1: Residential or Commercial. Step 2: the kind of property.
  // For commercial, `areas` lists the most common areas first and `roomSqft`
  // is the typical area size used by the square-footage quick estimate.
  var P_ = function (id, label, icon, desc, areas, roomSqft, height) {
    return { id: id, label: label, icon: icon, desc: desc, areas: areas, roomSqft: roomSqft, height: height };
  };
  var JOB_TYPES = {
    residential: {
      label: 'Residential', icon: '🏡', desc: 'Houses, townhouses & condos',
      properties: [
        { id: 'house', label: 'House', icon: '🏠', desc: 'Single-family home' },
        { id: 'townhouse', label: 'Townhouse', icon: '🏘️', desc: 'Shared walls, usually 2–3 floors' },
        { id: 'condo', label: 'Condo', icon: '🏢', desc: 'Unit inside a building' }
      ]
    },
    commercial: {
      label: 'Commercial', icon: '🏬', desc: 'Any business, big or small',
      properties: [
        P_('office', 'Office', '💼', 'Suites to full floors', ['office', 'conference', 'openoffice', 'lobby', 'breakroom', 'restroom', 'hallway', 'storage', 'stairwell'], 250, 9),
        P_('retail', 'Retail Store', '🛍️', 'Shops & boutiques', ['salesfloor', 'fitting', 'storage', 'office', 'restroom', 'breakroom'], 800, 12),
        P_('restaurant', 'Restaurant / Bar', '🍴', 'Restaurants, cafés, bars', ['dining', 'bar', 'kitchen', 'restroom', 'office', 'storage', 'hallway'], 400, 10),
        P_('medical', 'Medical / Dental', '🩺', 'Clinics & practices', ['waiting', 'exam', 'office', 'lobby', 'restroom', 'hallway', 'breakroom', 'storage'], 200, 9),
        P_('hotel', 'Hotel / Motel', '🏨', 'Rooms, halls & lobbies', ['guestroom', 'hallway', 'lobby', 'stairwell', 'restroom', 'laundry', 'conference', 'dining'], 250, 9),
        P_('apartments', 'Apartments / HOA', '🏢', 'Common areas & units', ['hallway', 'stairwell', 'lobby', 'common', 'laundry', 'gymfloor', 'office'], 400, 9),
        P_('warehouse', 'Warehouse / Industrial', '🏭', 'Warehouses & plants', ['warehouse', 'office', 'breakroom', 'restroom', 'storage', 'stairwell'], 3000, 20),
        P_('school', 'School / Daycare', '🏫', 'Classrooms & halls', ['classroom', 'hallway', 'office', 'restroom', 'hall', 'breakroom', 'kitchen'], 600, 10),
        P_('church', 'Church', '⛪', 'Sanctuaries & halls', ['sanctuary', 'hall', 'classroom', 'office', 'restroom', 'lobby', 'kitchen', 'hallway'], 800, 12),
        P_('gym', 'Gym / Fitness', '🏋️', 'Gyms & studios', ['gymfloor', 'locker', 'lobby', 'office', 'restroom', 'storage'], 1200, 14),
        P_('salon', 'Salon / Spa', '💇', 'Salons, spas, barbers', ['salon', 'treatment', 'waiting', 'restroom', 'storage', 'breakroom'], 300, 10),
        P_('bank', 'Bank', '🏦', 'Branches & offices', ['teller', 'lobby', 'office', 'conference', 'restroom', 'breakroom', 'storage'], 300, 10),
        P_('auto', 'Auto Shop / Dealer', '🚗', 'Showrooms & service bays', ['showroom', 'servicebay', 'office', 'waiting', 'restroom', 'storage'], 1200, 16),
        P_('government', 'Government', '🏛️', 'Public buildings', ['lobby', 'office', 'conference', 'hall', 'hallway', 'restroom', 'stairwell'], 400, 10),
        P_('other', 'Other', '➕', 'Anything else', ['office', 'lobby', 'openoffice', 'hallway', 'restroom', 'storage'], 300, 9)
      ]
    }
  };

  function findProperty(jobType, propertyType) {
    var t = JOB_TYPES[jobType];
    return t ? t.properties.find(function (x) { return x.id === propertyType; }) : null;
  }

  /**
   * Room/area buttons for a job. Commercial: the property's common areas first,
   * then every other area marked `more: true` (shown behind "More area types").
   */
  function roomTypesFor(jobType, propertyType) {
    if (jobType !== 'commercial') return ROOM_TYPES;
    var prop = findProperty(jobType, propertyType);
    var primary = (prop && prop.areas ? prop.areas : ['office', 'lobby', 'openoffice', 'hallway', 'restroom', 'storage']).concat('other');
    var byId = {};
    COMMERCIAL_AREAS.forEach(function (a) { byId[a.id] = a; });
    var first = primary.map(function (id) { return byId[id]; }).filter(Boolean);
    var rest = COMMERCIAL_AREAS.filter(function (a) { return primary.indexOf(a.id) === -1; })
      .map(function (a) { return Object.assign({}, a, { more: true }); });
    return first.concat(rest);
  }

  /** "Residential · House" style label for a job (empty for older quotes without a type). */
  function propertyLabel(job) {
    var t = JOB_TYPES[job && job.jobType];
    if (!t) return '';
    var p = t.properties.find(function (x) { return x.id === job.propertyType; });
    return t.label + (p ? ' · ' + p.label : '');
  }

  var CONDITIONS = {
    good: { label: 'Good', labor: 1 },
    fair: { label: 'Fair', labor: 1.15 },
    poor: { label: 'Needs work', labor: 1.35, primer: true }
  };

  var DOOR_SQFT = 20;
  var WINDOW_SQFT = 15;
  var TRIM_LF_PER_GALLON = 300;
  var GALLONS_PER_DOOR = 0.25;

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) && n >= 0 ? n : (fallback || 0);
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // Taller walls take longer (ladders, then scaffolding or a lift).
  function heightFactor(h) {
    if (h >= 20) return 1.8;
    if (h >= 16) return 1.6;
    if (h >= 12) return 1.3;
    if (h >= 10) return 1.15;
    return 1;
  }

  function newRoom(type) {
    var t = type || ROOM_TYPES[0];
    var size = SIZES[t.size] || {};
    return {
      id: Math.random().toString(36).slice(2, 10),
      name: t.name,
      size: t.size,
      length: t.length || size.length || 12,
      width: t.width || size.width || 12,
      height: t.height || 8,
      doors: t.doors,
      windows: t.windows,
      coats: 2,
      condition: 'good',
      surfaces: { walls: true, ceiling: false, trim: true, doors: false }
    };
  }

  /** Measurements, labor hours and paint needed for one room (costs, no markup). */
  function calcRoom(room, settings) {
    var s = Object.assign({}, DEFAULT_SETTINGS, settings);
    var L = num(room.length), W = num(room.width), H = num(room.height, 8) || 8;
    var doors = Math.round(num(room.doors)), windows = Math.round(num(room.windows));
    var coats = Math.round(num(room.coats, 2)) || 2;
    var cond = CONDITIONS[room.condition] || CONDITIONS.good;
    var hf = heightFactor(H);
    var sf = room.surfaces || {};
    var rate = num(s.laborRate);
    var coverage = num(s.coverage, 350) || 350;

    var perimeter = 2 * (L + W);
    var wallArea = Math.max(0, perimeter * H - doors * DOOR_SQFT - windows * WINDOW_SQFT);
    var ceilingArea = L * W;
    var trimLF = Math.max(0, perimeter - doors * 3);
    var coatTxt = coats + (coats === 1 ? ' coat' : ' coats');

    var lines = [];
    var gallons = { wall: 0, ceiling: 0, trim: 0, primer: 0 };

    function add(key, label, detail, hours) {
      hours = round2(hours);
      lines.push({ key: key, label: label, detail: detail, hours: hours, laborCost: round2(hours * rate) });
    }

    if (sf.walls && wallArea > 0) {
      if (cond.primer) {
        add('primer', 'Patch, sand & prime walls', Math.round(wallArea) + ' sq ft',
          wallArea / (num(s.wallRate, 175) || 175) * hf);
        gallons.primer += wallArea / coverage;
      }
      add('walls', 'Walls', Math.round(wallArea) + ' sq ft · ' + coatTxt,
        wallArea * coats / (num(s.wallRate, 175) || 175) * cond.labor * hf);
      gallons.wall += wallArea * coats / coverage;
    }
    if (sf.ceiling && ceilingArea > 0) {
      add('ceiling', 'Ceiling', Math.round(ceilingArea) + ' sq ft · ' + coatTxt,
        ceilingArea * coats / (num(s.ceilingRate, 140) || 140) * cond.labor * hf);
      gallons.ceiling += ceilingArea * coats / coverage;
    }
    if (sf.trim && trimLF > 0) {
      add('trim', 'Trim & baseboards', Math.round(trimLF) + ' linear ft · ' + coatTxt,
        trimLF * coats / (num(s.trimRate, 50) || 50) * cond.labor);
      gallons.trim += trimLF * coats / TRIM_LF_PER_GALLON;
    }
    if (sf.doors && doors > 0) {
      add('doors', 'Doors & frames', doors + (doors === 1 ? ' door' : ' doors') + ' · both sides',
        doors * num(s.doorHours, 0.75) * cond.labor);
      gallons.trim += doors * GALLONS_PER_DOOR;
    }
    if (lines.length && num(s.setupHours) > 0) {
      add('prep', 'Prep, protection & cleanup', 'Move furniture, mask, drop cloths', num(s.setupHours));
    }

    var hours = 0, laborCost = 0;
    lines.forEach(function (l) { hours += l.hours; laborCost += l.laborCost; });

    return {
      length: L, width: W, height: H,
      wallArea: round2(wallArea), ceilingArea: round2(ceilingArea), trimLF: round2(trimLF),
      lines: lines, gallons: gallons,
      hours: round2(hours), laborCost: round2(laborCost)
    };
  }

  function newQuick(height) {
    return { sqft: '', height: height || 8, coats: 2, condition: 'good',
      surfaces: { walls: true, ceiling: false, trim: true, doors: false } };
  }

  // Typical room used to turn total floor area into walls, trim and doors.
  var QUICK_PROFILE = {
    residential: { roomSqft: 150, doors: 1, windows: 2 },
    commercial: { roomSqft: 300, doors: 1, windows: 1 }
  };

  /**
   * Ballpark for a whole home/space from its total floor area: treat it as
   * N typical rooms, price one with calcRoom and scale up.
   */
  function calcQuick(quick, settings, jobType, propertyType) {
    var q = quick || newQuick();
    var area = num(q.sqft);
    var profile = QUICK_PROFILE[jobType] || QUICK_PROFILE.residential;
    var prop = findProperty(jobType, propertyType);
    if (prop && prop.roomSqft) profile = Object.assign({}, profile, { roomSqft: prop.roomSqft });
    var n = Math.max(1, area / profile.roomSqft);
    var side = area > 0 ? Math.sqrt(area / n) : 0;
    var one = calcRoom({
      length: side, width: side, height: q.height, doors: profile.doors, windows: profile.windows,
      coats: q.coats, condition: q.condition, surfaces: q.surfaces || {}
    }, settings);

    var coats = Math.round(num(q.coats, 2)) || 2;
    var coatTxt = coats + (coats === 1 ? ' coat' : ' coats');
    var wallArea = one.wallArea * n, trimLF = one.trimLF * n, doors = Math.round(n * profile.doors);
    var details = {
      primer: Math.round(wallArea).toLocaleString('en-US') + ' sq ft (est.)',
      walls: Math.round(wallArea).toLocaleString('en-US') + ' sq ft (est.) · ' + coatTxt,
      ceiling: Math.round(area).toLocaleString('en-US') + ' sq ft · ' + coatTxt,
      trim: Math.round(trimLF).toLocaleString('en-US') + ' linear ft (est.) · ' + coatTxt,
      doors: '~' + doors + ' doors · both sides',
      prep: 'Move furniture, mask, drop cloths'
    };
    var lines = one.lines.map(function (l) {
      return Object.assign({}, l, { detail: details[l.key] || l.detail,
        hours: round2(l.hours * n), laborCost: round2(l.laborCost * n) });
    });
    var gallons = {};
    Object.keys(one.gallons).forEach(function (k) { gallons[k] = one.gallons[k] * n; });
    var hours = 0, laborCost = 0;
    lines.forEach(function (l) { hours += l.hours; laborCost += l.laborCost; });

    return {
      length: 0, width: 0, height: one.height, floorArea: area,
      wallArea: round2(wallArea), ceilingArea: round2(area), trimLF: round2(trimLF),
      lines: area > 0 ? lines : [], gallons: area > 0 ? gallons : { wall: 0, ceiling: 0, trim: 0, primer: 0 },
      hours: area > 0 ? round2(hours) : 0, laborCost: area > 0 ? round2(laborCost) : 0
    };
  }

  // ---------- Exterior & floors ----------
  var SIDING = {
    smooth: { label: 'Vinyl / smooth', labor: 1, coverage: 350 },
    wood: { label: 'Wood / lap', labor: 1.15, coverage: 300 },
    masonry: { label: 'Stucco / brick', labor: 1.3, coverage: 200 }
  };
  var STORY_FACTOR = { 1: 1, 2: 1.25, 3: 1.5 };
  var FLOOR_SYSTEMS = {
    paint: { label: 'Floor paint' },
    epoxy: { label: 'Epoxy' },
    flake: { label: 'Epoxy + flakes' }
  };
  var GARAGE_SIZES = {
    '1': { label: '1-car', length: 12, width: 22 },
    '2': { label: '2-car', length: 20, width: 22 },
    '3': { label: '3-car', length: 30, width: 22 }
  };

  var OUTSIDE_TYPES = [
    { type: 'house', group: 'exterior', name: 'Whole House Exterior', commercialName: 'Building Exterior', icon: '🏡' },
    { type: 'deck', group: 'exterior', name: 'Deck', icon: '🪵' },
    { type: 'fence', group: 'exterior', name: 'Fence', icon: '🚧' },
    { type: 'door', group: 'exterior', name: 'Entry Doors', icon: '🚪' },
    { type: 'garagedoor', group: 'exterior', name: 'Garage Door', icon: '🚘' },
    { type: 'shutters', group: 'exterior', name: 'Shutters', icon: '🪟' },
    { type: 'floor', group: 'floor', name: 'Garage Floor', commercialName: 'Shop / Warehouse Floor', icon: '🚗', size: '2', length: 20, width: 22,
      commercialLength: 60, commercialWidth: 40 },
    { type: 'floor', group: 'floor', name: 'Basement Floor', icon: '🧱', size: 'custom', length: 30, width: 25 },
    { type: 'floor', group: 'floor', name: 'Porch / Patio Floor', icon: '🪑', size: 'custom', length: 12, width: 10 },
    { type: 'cabinets', group: 'specialty', name: 'Kitchen Cabinets', icon: '🗄️', doors: 24, drawers: 10, boxes: 20 },
    { type: 'cabinets', group: 'specialty', name: 'Bathroom Vanity', icon: '🚰', doors: 4, drawers: 3, boxes: 5 },
    { type: 'wallpaper', group: 'specialty', name: 'Wallpaper Removal', icon: '🧻' },
    { type: 'popcorn', group: 'specialty', name: 'Popcorn Ceiling Removal', icon: '🍿' },
    { type: 'drywall', group: 'specialty', name: 'Drywall Repair', icon: '🩹' }
  ];
  var OUTSIDE_GROUPS = [
    ['exterior', 'Exterior'],
    ['floor', 'Floors'],
    ['specialty', 'Cabinets & specialty']
  ];

  function newOutside(t, job) {
    var commercial = job && job.jobType === 'commercial';
    var base = { id: Math.random().toString(36).slice(2, 10), type: t.type,
      name: (commercial && t.commercialName) || t.name, coats: 2, condition: 'good' };
    var homeSqft = job && job.quick && num(job.quick.sqft) ? num(job.quick.sqft) : (commercial ? 5000 : 2000);
    switch (t.type) {
      case 'house':
        return Object.assign(base, { sqft: homeSqft, stories: commercial ? 1 : 2, siding: 'smooth',
          windows: Math.round(homeSqft / 120), doors: 2, surfaces: { siding: true, trim: true, soffits: false } });
      case 'deck': return Object.assign(base, { sqft: 300, railing: 40, coats: 1 });
      case 'fence': return Object.assign(base, { length: 150, height: 6, sides: 1, coats: 1 });
      case 'door': return Object.assign(base, { count: 1 });
      case 'garagedoor': return Object.assign(base, { count: 1, size: 'double' });
      case 'shutters': return Object.assign(base, { count: 4 });
      case 'cabinets': return Object.assign(base, { doors: t.doors, drawers: t.drawers, boxes: t.boxes,
        method: 'spray', insides: false });
      case 'wallpaper': return Object.assign(base, { sqft: 400 });
      case 'popcorn': return Object.assign(base, { sqft: homeSqft > 3000 ? 1000 : 400, retexture: 'smooth', test: 1 });
      case 'drywall': return Object.assign(base, { small: 4, large: 1 });
      case 'floor': return Object.assign(base, { system: 'epoxy', coats: 2,
        size: commercial && t.commercialLength ? 'custom' : t.size,
        length: commercial && t.commercialLength ? t.commercialLength : t.length,
        width: commercial && t.commercialWidth ? t.commercialWidth : t.width });
    }
    return base;
  }

  /** Labor, paint and direct materials for one exterior or floor item (costs, no markup). */
  function calcOutside(item, settings) {
    var s = Object.assign({}, DEFAULT_SETTINGS, settings);
    var rate = num(s.laborRate);
    var coats = Math.round(num(item.coats, 2)) || 1;
    var coatTxt = coats + (coats === 1 ? ' coat' : ' coats');
    var cond = CONDITIONS[item.condition] || CONDITIONS.good;
    var lines = [], gallons = { ext: 0, stain: 0, floor: 0, primer: 0 }, direct = [];
    var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
    function add(key, label, detail, hours) {
      hours = round2(hours);
      if (hours > 0) lines.push({ key: key, label: label, detail: detail, hours: hours, laborCost: round2(hours * rate) });
    }
    var summary = '';

    if (item.type === 'house') {
      var stories = Math.min(3, Math.max(1, Math.round(num(item.stories, 1)) || 1));
      var sf = STORY_FACTOR[stories];
      var siding = SIDING[item.siding] || SIDING.smooth;
      var area = num(item.sqft);
      var fp = area / stories;
      var L = Math.sqrt(fp * 1.4), W = L ? fp / L : 0;
      var perim = 2 * (L + W);
      var windows = Math.round(num(item.windows)), doors = Math.round(num(item.doors));
      var wall = Math.max(0, perim * 9 * stories * 1.1 - windows * 15 - doors * 21);
      var su = item.surfaces || {};
      if (area > 0 && (su.siding || su.trim || su.soffits)) {
        add('wash', 'Power wash & prep', fmt(wall) + ' sq ft (est.)', wall / 400 * sf);
        if (cond.primer) {
          add('scrape', 'Scrape, sand & spot-prime', 'Loose paint and bare spots', wall / 250 * sf);
          gallons.primer += wall * 0.3 / siding.coverage;
        }
      }
      if (su.siding && wall > 0) {
        add('siding', 'Siding / walls', fmt(wall) + ' sq ft (est.) · ' + siding.label + ' · ' + coatTxt,
          wall * coats / (num(s.extWallRate) || 125) * siding.labor * cond.labor * sf);
        gallons.ext += wall * coats / siding.coverage;
      }
      if (su.trim && perim > 0) {
        var trimLF = perim + windows * 14 + doors * 17;
        add('trim', 'Trim, fascia & window frames', fmt(trimLF) + ' linear ft (est.) · ' + coatTxt,
          trimLF * coats / (num(s.trimRate) || 50) * cond.labor * sf);
        gallons.ext += trimLF * coats / 300;
      }
      if (su.soffits && perim > 0) {
        var soffit = perim * 1.5;
        add('soffits', 'Soffits & overhangs', fmt(soffit) + ' sq ft (est.) · ' + coatTxt,
          soffit * coats / ((num(s.ceilingRate) || 140) * 0.8) * sf);
        gallons.ext += soffit * coats / 350;
      }
      if (lines.length) add('setup', 'Ladders, masking & cleanup', stories + (stories === 1 ? ' story' : ' stories'), 2 * stories);
      summary = fmt(area) + ' sq ft home, ' + stories + (stories === 1 ? ' story' : ' stories') + ', ' + siding.label.toLowerCase();
    } else if (item.type === 'deck') {
      var deck = num(item.sqft), rail = num(item.railing);
      if (deck > 0) {
        add('wash', 'Wash & prep deck', fmt(deck) + ' sq ft', deck / 300);
        add('deck', 'Deck floor', fmt(deck) + ' sq ft · ' + coatTxt, deck * coats / (num(s.deckRate) || 100) * cond.labor);
        gallons.stain += deck * coats / 200;
      }
      if (rail > 0) {
        add('railing', 'Railings & spindles', fmt(rail) + ' linear ft · ' + coatTxt, rail * coats / 15 * cond.labor);
        gallons.stain += rail * coats / 50;
      }
      summary = fmt(deck) + ' sq ft' + (rail ? ', ' + fmt(rail) + ' ft of railing' : '');
    } else if (item.type === 'fence') {
      var sides = Math.round(num(item.sides, 1)) === 2 ? 2 : 1;
      var farea = num(item.length) * num(item.height, 6) * sides;
      if (farea > 0) {
        add('wash', 'Wash & prep fence', fmt(farea) + ' sq ft', farea / 500);
        add('fence', 'Fence', fmt(num(item.length)) + ' ft long × ' + num(item.height, 6) + ' ft · ' +
          (sides === 2 ? 'both sides' : 'one side') + ' · ' + coatTxt, farea * coats / (num(s.fenceRate) || 150) * cond.labor);
        gallons.stain += farea * coats / 250;
      }
      summary = fmt(num(item.length)) + ' ft, ' + num(item.height, 6) + ' ft tall';
    } else if (item.type === 'door') {
      var dn = Math.round(num(item.count));
      add('doors', 'Entry doors & frames', dn + (dn === 1 ? ' door' : ' doors') + ' · ' + coatTxt, dn * 1.0 * coats * cond.labor);
      gallons.ext += dn * 0.15 * coats;
      summary = dn + (dn === 1 ? ' door' : ' doors');
    } else if (item.type === 'garagedoor') {
      var gn = Math.round(num(item.count)), dbl = item.size !== 'single';
      add('garagedoor', 'Garage door' + (gn === 1 ? '' : 's'), gn + ' × ' + (dbl ? 'double' : 'single') + ' · ' + coatTxt,
        gn * (dbl ? 1.75 : 1.25) * coats * cond.labor);
      gallons.ext += gn * (dbl ? 0.6 : 0.35) * coats;
      summary = gn + ' ' + (dbl ? 'double' : 'single') + (gn === 1 ? ' door' : ' doors');
    } else if (item.type === 'shutters') {
      var sn = Math.round(num(item.count));
      add('shutters', 'Shutters', sn + (sn === 1 ? ' shutter' : ' shutters') + ' · ' + coatTxt, sn * 0.5 * coats * cond.labor);
      gallons.ext += sn * 0.08 * coats;
      summary = sn + ' shutters';
    } else if (item.type === 'floor') {
      var farea2 = num(item.length) * num(item.width);
      var sys = item.system || 'epoxy';
      if (farea2 > 0) {
        if (cond.primer) add('repair', 'Crack & oil-stain repair', fmt(farea2) + ' sq ft', farea2 / 300);
        if (sys === 'paint') {
          add('prep', 'Degrease & etch concrete', fmt(farea2) + ' sq ft', farea2 / 250);
          add('floor', 'Floor paint', fmt(farea2) + ' sq ft · ' + coatTxt, farea2 * coats / (num(s.floorRate) || 150));
          gallons.floor += farea2 * coats / 300;
        } else {
          add('prep', 'Grind / etch concrete', fmt(farea2) + ' sq ft', farea2 / 150);
          add('floor', sys === 'flake' ? 'Epoxy base, flakes & clear coat' : 'Epoxy coating',
            fmt(farea2) + ' sq ft', farea2 / (sys === 'flake' ? 45 : 70));
          direct.push({ key: sys, label: sys === 'flake' ? 'Epoxy flake system (base, flakes, clear coat)' : '2-part epoxy coating',
            sqft: farea2, cost: round2(farea2 * num(sys === 'flake' ? s.flakeSqft : s.epoxySqft)) });
        }
      }
      summary = num(item.length) + '×' + num(item.width) + ' ft, ' + (FLOOR_SYSTEMS[sys] || FLOOR_SYSTEMS.epoxy).label.toLowerCase();
    }

    else if (item.type === 'cabinets') {
      var cd = Math.round(num(item.doors)), cdr = Math.round(num(item.drawers)), cb = num(item.boxes);
      var spray = item.method !== 'brush';
      var mf = (spray ? 0.85 : 1) * cond.labor;
      var ins = item.insides ? 1.35 : 1;
      if (cd + cdr + cb > 0) {
        add('cabprep', 'Remove, label & degrease', 'Doors, drawers, hardware', (cd + cdr) * 0.15 + 1);
        if (cd) add('cabdoors', 'Cabinet doors', cd + ' doors · both sides · prime + 2 coats', cd * num(s.cabinetDoorHours, 1.5) * mf);
        if (cdr) add('cabdrawers', 'Drawer fronts', cdr + ' drawers · prime + 2 coats', cdr * 0.6 * mf);
        if (cb) add('cabboxes', 'Cabinet boxes & face frames', fmt(cb) + ' linear ft' + (item.insides ? ' · inside & out' : ''), cb * 0.75 * mf * ins);
        add('cabreinstall', 'Reinstall & adjust', 'Hinges, hardware, touch-ups', (cd + cdr) * 0.1 + 1);
        gallons.cabinet = (gallons.cabinet || 0) + cd * 0.12 + cdr * 0.05 + cb * 0.06 * ins;
      }
      summary = cd + ' doors, ' + cdr + ' drawers, ' + fmt(cb) + ' ft of boxes · ' + (spray ? 'sprayed' : 'brushed & rolled');
    } else if (item.type === 'wallpaper') {
      var wp = num(item.sqft);
      if (wp > 0) {
        add('wpremove', 'Wallpaper removal', fmt(wp) + ' sq ft · score, steam & strip', wp / 40 * cond.labor);
        add('wpskim', 'Wash glue, patch & prime walls', fmt(wp) + ' sq ft', wp / 150);
        direct.push({ key: 'wpsupplies', label: 'Wallpaper remover & glue wash', sqft: wp, cost: round2(wp * 0.1) });
        gallons.primer += wp / 300;
      }
      summary = fmt(wp) + ' sq ft of wallpaper';
    } else if (item.type === 'popcorn') {
      var pc = num(item.sqft);
      if (pc > 0) {
        add('pcprotect', 'Protect room (plastic floors & walls)', fmt(pc) + ' sq ft', pc / 250 + 1);
        add('pcscrape', 'Wet & scrape popcorn texture', fmt(pc) + ' sq ft', pc / 60);
        add('pcfinish', item.retexture === 'knockdown' ? 'Skim & knockdown texture' : 'Skim coat smooth & sand', fmt(pc) + ' sq ft',
          pc / (item.retexture === 'knockdown' ? 120 : 80));
        direct.push({ key: 'pcsupplies', label: 'Joint compound, plastic & sanding', sqft: pc, cost: round2(pc * 0.25) });
        if (Math.round(num(item.test)) === 1) direct.push({ key: 'asbestos', label: 'Asbestos test (lab)', sqft: 0, cost: 75 });
      }
      summary = fmt(pc) + ' sq ft ceiling, ' + (item.retexture === 'knockdown' ? 'knockdown finish' : 'smooth finish');
    } else if (item.type === 'drywall') {
      var ds = Math.round(num(item.small)), dl = Math.round(num(item.large));
      if (ds) add('dwsmall', 'Small drywall repairs', ds + ' × nail pops, dents, holes up to 6"', ds * 0.5);
      if (dl) add('dwlarge', 'Large drywall patches', dl + ' × holes over 6" · mesh/backer, 3 coats', dl * 1.75);
      if (ds + dl) direct.push({ key: 'drywall', label: 'Drywall patch materials', sqft: 0, cost: ds * 4 + dl * 15 });
      summary = ds + ' small, ' + dl + ' large';
    }

    var hours = 0, laborCost = 0;
    lines.forEach(function (l) { hours += l.hours; laborCost += l.laborCost; });
    return { lines: lines, gallons: gallons, direct: direct, summary: summary,
      hours: round2(hours), laborCost: round2(laborCost) };
  }

  /** Full itemized quote for a job. */
  function calcJob(job, settings) {
    var s = Object.assign({}, DEFAULT_SETTINGS, settings);
    var mk = 1 + num(s.markup) / 100;
    var quickMode = job.mode === 'quick';

    var totalGallons = { wall: 0, ceiling: 0, trim: 0, primer: 0, ext: 0, stain: 0, floor: 0, cabinet: 0 };
    var directTotals = {};
    var source = quickMode
      ? [{ id: 'quick', name: job.jobType === 'commercial' ? 'Whole space' : 'Whole home', quick: true }]
      : (job.rooms || []);
    var rooms = source.map(function (room) {
      var c = room.quick ? calcQuick(job.quick, s, job.jobType, job.propertyType) : calcRoom(room, s);
      c.summary = room.quick
        ? Math.round(c.floorArea).toLocaleString('en-US') + ' sq ft, ' + c.height + ' ft ceilings'
        : c.length + '×' + c.width + ' ft, ' + c.height + ' ft ceilings';
      Object.keys(totalGallons).forEach(function (k) { totalGallons[k] += c.gallons[k] || 0; });
      var lines = c.lines.map(function (l) { return Object.assign({}, l, { price: round2(l.laborCost * mk) }); });
      var price = 0;
      lines.forEach(function (l) { price += l.price; });
      return Object.assign({}, c, { id: room.id, name: room.name || 'Room', lines: lines, price: round2(price) });
    });

    var outside = (job.outside || []).map(function (item) {
      var c = calcOutside(item, s);
      Object.keys(c.gallons).forEach(function (k) { totalGallons[k] += c.gallons[k] || 0; });
      c.direct.forEach(function (d) {
        var t = directTotals[d.key] || (directTotals[d.key] = { key: d.key, label: d.label, sqft: 0, cost: 0 });
        t.sqft += d.sqft; t.cost += d.cost;
      });
      var lines = c.lines.map(function (l) { return Object.assign({}, l, { price: round2(l.laborCost * mk) }); });
      var price = 0;
      lines.forEach(function (l) { price += l.price; });
      return Object.assign({}, c, { id: item.id, name: item.name || 'Exterior', outside: true, lines: lines, price: round2(price) });
    });

    var products = [
      ['wall', 'Wall paint', s.wallPaintPrice],
      ['ceiling', 'Ceiling paint', s.ceilingPaintPrice],
      ['trim', 'Trim & door paint (semi-gloss)', s.trimPaintPrice],
      ['primer', 'Primer', s.primerPrice],
      ['ext', 'Exterior paint', s.extPaintPrice],
      ['stain', 'Deck & fence stain', s.stainPrice],
      ['floor', 'Floor paint', s.floorPaintPrice],
      ['cabinet', 'Cabinet primer & enamel', s.cabinetPaintPrice]
    ];
    var materials = [];
    var paintCost = 0;
    products.forEach(function (p) {
      var g = totalGallons[p[0]];
      if (g <= 0) return;
      var qty = Math.max(1, Math.ceil(g - 0.05)); // tiny overages don't force an extra can
      var cost = round2(qty * num(p[2]));
      paintCost += cost;
      materials.push({ key: p[0], label: p[1], detail: qty + (qty === 1 ? ' gallon' : ' gallons'),
        qty: qty, cost: cost, price: round2(cost * mk) });
    });
    Object.keys(directTotals).forEach(function (k) {
      var d = directTotals[k];
      var dc = round2(d.cost);
      materials.push({ key: k, label: d.label, detail: d.sqft ? Math.round(d.sqft).toLocaleString('en-US') + ' sq ft' : '',
        qty: 1, cost: dc, price: round2(dc * mk) });
    });
    if (paintCost > 0 && num(s.suppliesPct) > 0) {
      var supCost = round2(paintCost * num(s.suppliesPct) / 100);
      materials.push({ key: 'supplies', label: 'Supplies', detail: 'Tape, plastic, caulk, patch, rollers',
        qty: 1, cost: supCost, price: round2(supCost * mk) });
    }

    var extras = (job.extras || []).filter(function (e) { return e && (e.label || num(e.price)); })
      .map(function (e) { return { label: e.label || 'Additional work', price: round2(num(e.price)) }; });

    var sum = function (arr, key) { return round2(arr.reduce(function (a, x) { return a + x[key]; }, 0)); };
    var roomsTotal = round2(sum(rooms, 'price') + sum(outside, 'price'));
    var materialsTotal = sum(materials, 'price');
    var extrasTotal = sum(extras, 'price');
    var subtotal = round2(roomsTotal + materialsTotal + extrasTotal);
    var discount = Math.min(round2(num(job.discount)), subtotal);
    var afterDiscount = round2(subtotal - discount);
    var minimumAdj = 0;
    if (afterDiscount > 0 && afterDiscount < num(s.minimumJob)) {
      minimumAdj = round2(num(s.minimumJob) - afterDiscount);
    }
    var taxable = round2(afterDiscount + minimumAdj);
    var tax = round2(taxable * num(s.taxRate) / 100);
    var total = round2(taxable + tax);
    var deposit = round2(total * num(s.depositPct) / 100);

    var hours = round2(sum(rooms, 'hours') + sum(outside, 'hours'));
    var laborCost = round2(sum(rooms, 'laborCost') + sum(outside, 'laborCost'));
    var materialCost = sum(materials, 'cost');
    var cost = round2(laborCost + materialCost);
    var revenue = round2(total - tax);
    var profit = round2(revenue - cost);

    return {
      quick: quickMode,
      rooms: rooms,
      outside: outside,
      materials: materials,
      extras: extras,
      roomsTotal: roomsTotal,
      materialsTotal: materialsTotal,
      extrasTotal: extrasTotal,
      subtotal: subtotal,
      discount: discount,
      minimumAdj: minimumAdj,
      tax: tax,
      total: total,
      deposit: deposit,
      internal: {
        hours: hours,
        crewDays: round2(hours / 8),
        laborCost: laborCost,
        materialCost: materialCost,
        cost: cost,
        profit: profit,
        margin: revenue > 0 ? round2(profit / revenue * 100) : 0,
        gallons: totalGallons
      }
    };
  }

  var api = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    SIZES: SIZES,
    ROOM_TYPES: ROOM_TYPES,
    COMMERCIAL_ROOM_TYPES: COMMERCIAL_ROOM_TYPES,
    COMMERCIAL_AREAS: COMMERCIAL_AREAS,
    findProperty: findProperty,
    JOB_TYPES: JOB_TYPES,
    roomTypesFor: roomTypesFor,
    propertyLabel: propertyLabel,
    CONDITIONS: CONDITIONS,
    newRoom: newRoom,
    newQuick: newQuick,
    OUTSIDE_TYPES: OUTSIDE_TYPES,
    OUTSIDE_GROUPS: OUTSIDE_GROUPS,
    SIDING: SIDING,
    FLOOR_SYSTEMS: FLOOR_SYSTEMS,
    GARAGE_SIZES: GARAGE_SIZES,
    newOutside: newOutside,
    calcOutside: calcOutside,
    calcRoom: calcRoom,
    calcQuick: calcQuick,
    calcJob: calcJob,
    round2: round2
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Pricing = api;
})(typeof window !== 'undefined' ? window : this);
