/*
 * Coatwright blueprint viewer: shows a PDF plan page, zoom/pan with mouse, trackpad or fingers,
 * and lets the painter draw measurements (wall runs, areas, counts) on top.
 *
 * Coordinates are PDF points at scale 1 (what takeoff.js measures in). The PDF file is kept on this
 * device in IndexedDB (PlanStore); only measurements are saved with the job.
 * Uses Mozilla's pdf.js (app/vendor, Apache 2.0), loaded the first time a plan is opened.
 */
(function (global) {
  'use strict';

  // ---------- File storage (this device) ----------
  var DB_NAME = 'coatwright-plans', STORE = 'files';
  function openDb() {
    return new Promise(function (res, rej) {
      if (!global.indexedDB) { rej(new Error('This browser can\'t store plan files')); return; }
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
        t.oncomplete = function () { res(req && req.result); };
        t.onerror = t.onabort = function () { rej(t.error || new Error('Storage error')); };
      });
    });
  }
  var PlanStore = {
    put: function (id, data) { return tx('readwrite', function (s) { return s.put(data, id); }); },
    get: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
    del: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  };

  // ---------- pdf.js ----------
  var pdfjsPromise = null;
  function loadPdfJs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise(function (res, rej) {
        var sc = document.createElement('script');
        sc.src = 'vendor/pdf.min.js';
        sc.onload = function () { global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(global.pdfjsLib); };
        sc.onerror = function () { pdfjsPromise = null; rej(new Error('Couldn\'t load the plan viewer. Check your connection and try again.')); };
        document.head.appendChild(sc);
      });
    }
    return pdfjsPromise;
  }
  function openPdf(data) {
    return loadPdfJs().then(function (lib) { return lib.getDocument({ data: new Uint8Array(data.slice ? data.slice(0) : data) }).promise; });
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }
  function inPoly(p, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if ((pts[i][1] > p[1]) !== (pts[j][1] > p[1]) && p[0] < (pts[j][0] - pts[i][0]) * (p[1] - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c;
    }
    return c;
  }

  /**
   * new PlanViewer(container, {
   *   marks(): [{ id, kind: 'line'|'area'|'count', pts, closed, color, selected }]   (current page)
   *   liveLabel(kind, pts): text shown while drawing
   *   onMeasure({ kind, pts, closed })   a finished line/area
   *   onCount(pt)                        one tap with the count tool
   *   onCalibrate(pts)                   two points for "measure a known length"
   *   onSelect(id|null)                  tap with the select tool
   *   onView()                           zoom/pan changed
   * })
   */
  function PlanViewer(container, opts) {
    this.c = container; this.o = opts || {};
    this.z = 1; this.tx = 0; this.ty = 0; this.W = 0; this.H = 0;
    this.tool = 'pan'; this.draft = []; this.hover = null; this.ortho = false; this.shift = false;
    this.pointers = {}; this.gesture = null;
    this.page = null; this.pdf = null; this.renderTask = null; this.sharpTask = null; this.sharpTimer = null;
    container.classList.add('pv');
    container.innerHTML = '';
    this.base = document.createElement('div'); this.base.className = 'pv-world';
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pv-base';
    this.base.appendChild(this.canvas);
    this.sharp = document.createElement('canvas'); this.sharp.className = 'pv-sharp';
    this.top = document.createElement('div'); this.top.className = 'pv-world';
    this.svg = el('svg', { class: 'pv-marks' }, this.top);
    this.hud = document.createElement('div'); this.hud.className = 'pv-hud'; this.hud.hidden = true;
    [this.base, this.sharp, this.top, this.hud].forEach(function (n) { container.appendChild(n); });
    this._bind();
  }

  PlanViewer.prototype.showPage = function (pdf, pageNo) {
    var self = this;
    this.pdf = pdf;
    this.draft = [];
    return pdf.getPage(pageNo).then(function (page) {
      self.page = page;
      var vp = page.getViewport({ scale: 1 });
      self.W = vp.width; self.H = vp.height;
      [self.base, self.top].forEach(function (w) { w.style.width = self.W + 'px'; w.style.height = self.H + 'px'; });
      self.svg.setAttribute('viewBox', '0 0 ' + self.W + ' ' + self.H);
      self.svg.setAttribute('width', self.W); self.svg.setAttribute('height', self.H);
      // A sharp-enough picture of the whole sheet, within what phones and tablets allow for one canvas.
      var k = Math.min(4096 / Math.max(self.W, self.H), Math.sqrt(16e6 / (self.W * self.H)), 3);
      self.baseK = k;
      var v = page.getViewport({ scale: k });
      self.canvas.width = Math.floor(v.width); self.canvas.height = Math.floor(v.height);
      self.canvas.style.width = self.W + 'px'; self.canvas.style.height = self.H + 'px';
      if (self.renderTask) self.renderTask.cancel();
      var ctx = self.canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, self.canvas.width, self.canvas.height);
      self.fit();
      self.renderTask = page.render({ canvasContext: ctx, viewport: v });
      return self.renderTask.promise.catch(function () {}).then(function () { self._sharpSoon(); });
    });
  };

  PlanViewer.prototype.fit = function () {
    var cw = this.c.clientWidth || 800, ch = this.c.clientHeight || 600;
    if (!this.W) return;
    this.autoFit = true; // keep fitting to the window until the painter zooms or moves
    this.z = Math.min(cw / this.W, ch / this.H) * 0.96;
    this.tx = (cw - this.W * this.z) / 2; this.ty = (ch - this.H * this.z) / 2;
    this._apply();
  };
  PlanViewer.prototype.zoomAt = function (f, sx, sy) {
    this.autoFit = false;
    var cw = this.c.clientWidth, ch = this.c.clientHeight;
    if (sx == null) { sx = cw / 2; sy = ch / 2; }
    var fitZ = Math.min(cw / (this.W || 1), ch / (this.H || 1));
    var z = Math.max(fitZ * 0.5, Math.min(fitZ * 40, this.z * f));
    f = z / this.z;
    this.tx = sx - (sx - this.tx) * f; this.ty = sy - (sy - this.ty) * f; this.z = z;
    this._apply();
  };
  PlanViewer.prototype.toPage = function (sx, sy) { return [(sx - this.tx) / this.z, (sy - this.ty) / this.z]; };
  PlanViewer.prototype.toScreen = function (p) { return [p[0] * this.z + this.tx, p[1] * this.z + this.ty]; };

  PlanViewer.prototype._apply = function () {
    var t = 'translate(' + this.tx + 'px,' + this.ty + 'px) scale(' + this.z + ')';
    this.base.style.transform = t; this.top.style.transform = t;
    this.sharp.style.visibility = 'hidden';
    this.draw();
    this._sharpSoon();
    if (this.o.onView) this.o.onView();
  };

  // When zoomed in further than the base picture, redraw just the visible part at full screen sharpness.
  PlanViewer.prototype._sharpSoon = function () {
    var self = this;
    clearTimeout(this.sharpTimer);
    this.sharpTimer = setTimeout(function () { self._renderSharp(); }, 180);
  };
  PlanViewer.prototype._renderSharp = function () {
    if (!this.page) return;
    var dpr = global.devicePixelRatio || 1, S = this.z * dpr;
    if (S <= this.baseK * 1.05) { this.sharp.style.visibility = 'hidden'; return; }
    var cw = this.c.clientWidth, ch = this.c.clientHeight, self = this;
    if (this.sharpTask) { this.sharpTask.cancel(); this.sharpTask = null; }
    var off = document.createElement('canvas');
    off.width = Math.round(cw * dpr); off.height = Math.round(ch * dpr);
    var ctx = off.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(this.tx * dpr, this.ty * dpr, this.W * S, this.H * S);
    var key = [this.z, this.tx, this.ty].join();
    var task = this.page.render({ canvasContext: ctx, viewport: this.page.getViewport({ scale: S }), transform: [1, 0, 0, 1, this.tx * dpr, this.ty * dpr] });
    this.sharpTask = task;
    task.promise.then(function () {
      if (key !== [self.z, self.tx, self.ty].join()) return;
      self.sharp.width = off.width; self.sharp.height = off.height;
      self.sharp.style.width = cw + 'px'; self.sharp.style.height = ch + 'px';
      self.sharp.getContext('2d').drawImage(off, 0, 0);
      self.sharp.style.visibility = 'visible';
    }).catch(function () {});
  };

  PlanViewer.prototype.setTool = function (tool) {
    this.tool = tool; this.draft = []; this.hud.hidden = true; this._draftChanged();
    this.c.dataset.tool = tool;
    this.draw();
  };
  PlanViewer.prototype.drawing = function () { return this.draft.length > 0; };
  PlanViewer.prototype._draftChanged = function () { if (this.o.onDraft) this.o.onDraft(this.draft.length); };
  PlanViewer.prototype.cancel = function () { this.draft = []; this.hud.hidden = true; this.draw(); this._draftChanged(); };
  PlanViewer.prototype.undoPoint = function () { this.draft.pop(); this.draw(); this._label(); this._draftChanged(); };
  PlanViewer.prototype.finish = function () {
    var kind = this.tool === 'area' ? 'area' : 'line', pts = this.draft.slice();
    if ((kind === 'line' && pts.length >= 2) || (kind === 'area' && pts.length >= 3)) {
      this.draft = []; this.hud.hidden = true;
      if (this.o.onMeasure) this.o.onMeasure({ kind: kind, pts: pts, closed: kind === 'area' });
    }
    this.draw(); this._draftChanged();
  };

  PlanViewer.prototype._snap = function (p) {
    var last = this.draft[this.draft.length - 1];
    if (!last || !(this.ortho || this.shift)) return p;
    return Math.abs(p[0] - last[0]) > Math.abs(p[1] - last[1]) ? [p[0], last[1]] : [last[0], p[1]];
  };

  PlanViewer.prototype._tap = function (sx, sy) {
    var p = this.toPage(sx, sy), t = this.tool;
    if (t === 'count') { if (this.o.onCount) this.o.onCount(p); return; }
    if (t === 'select') { if (this.o.onSelect) this.o.onSelect(this._hit(sx, sy)); return; }
    if (t === 'calibrate') {
      this.draft.push(this._snap(p));
      if (this.draft.length === 2) { var pts = this.draft; this.draft = []; this.draw(); if (this.o.onCalibrate) this.o.onCalibrate(pts); return; }
      this.draw(); return;
    }
    if (t !== 'line' && t !== 'area') return;
    var first = this.draft[0];
    if (first && this.draft.length >= (t === 'area' ? 3 : 2)) {
      var fs = this.toScreen(first);
      if (Math.abs(fs[0] - sx) < 14 && Math.abs(fs[1] - sy) < 14) { // tapped the start point: close the shape
        var pts = this.draft.slice(); this.draft = []; this.hud.hidden = true;
        if (this.o.onMeasure) this.o.onMeasure({ kind: t, pts: pts, closed: true });
        this.draw(); this._draftChanged(); return;
      }
    }
    var q = this._snap(p), last = this.draft[this.draft.length - 1];
    if (last) { var ls = this.toScreen(last); if (Math.abs(ls[0] - sx) < 3 && Math.abs(ls[1] - sy) < 3) return; }
    this.draft.push(q);
    this.draw(); this._label();
    if (this.draft.length <= 2) this._draftChanged(); // show Finish / Cancel
  };

  PlanViewer.prototype._hit = function (sx, sy) {
    var p = this.toPage(sx, sy), tol = 10 / this.z, marks = (this.o.marks && this.o.marks()) || [], best = null;
    for (var i = marks.length - 1; i >= 0 && !best; i--) {
      var m = marks[i], pts = m.pts || [];
      if (m.kind === 'count') { if (pts.some(function (q) { return Math.abs(q[0] - p[0]) < tol * 1.4 && Math.abs(q[1] - p[1]) < tol * 1.4; })) best = m.id; continue; }
      var closed = m.kind === 'area' || m.closed;
      for (var k = 1; k < pts.length + (closed ? 1 : 0); k++) if (segDist(p, pts[k - 1], pts[k % pts.length]) < tol) { best = m.id; break; }
      if (!best && m.kind === 'area' && pts.length > 2 && inPoly(p, pts)) best = m.id;
    }
    return best;
  };

  PlanViewer.prototype._label = function () {
    if (!this.draft.length || !this.o.liveLabel) { this.hud.hidden = true; return; }
    var pts = this.draft.concat(this.hover ? [this._snap(this.hover)] : []);
    var txt = this.o.liveLabel(this.tool === 'area' ? 'area' : this.tool === 'calibrate' ? 'calibrate' : 'line', pts);
    if (!txt) { this.hud.hidden = true; return; }
    var s = this.toScreen(pts[pts.length - 1]);
    this.hud.textContent = txt; this.hud.hidden = false;
    this.hud.style.transform = 'translate(' + Math.round(s[0] + 14) + 'px,' + Math.round(s[1] + 14) + 'px)';
  };

  PlanViewer.prototype.draw = function () {
    var svg = this.svg, z = this.z;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var marks = (this.o.marks && this.o.marks()) || [];
    var dotR = this.c.clientWidth < 600 ? 5 : 7;
    var pstr = function (pts) { return pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' '); };
    var sw = function (w) { return { 'stroke-width': w, 'vector-effect': 'non-scaling-stroke' }; };
    marks.forEach(function (m) {
      var pts = m.pts || [], col = m.color || '#1f5eff', g = el('g', { 'data-id': m.id, class: m.selected ? 'sel' : '' }, svg);
      if (m.kind === 'count') {
        pts.forEach(function (p, i) {
          el('circle', Object.assign({ cx: p[0], cy: p[1], r: dotR / z, fill: col, stroke: '#fff' }, sw(m.selected ? 3 : 2)), g);
          if (m.selected) el('circle', Object.assign({ cx: p[0], cy: p[1], r: 13 / z, fill: 'none', stroke: col }, sw(2)), g);
        });
        return;
      }
      var closed = m.kind === 'area' || m.closed;
      if (m.kind === 'area') el('polygon', Object.assign({ points: pstr(pts), fill: col, 'fill-opacity': m.selected ? 0.32 : 0.18, stroke: col }, sw(m.selected ? 4 : 2.5)), g);
      else {
        if (m.selected) el(closed ? 'polygon' : 'polyline', Object.assign({ points: pstr(pts), fill: 'none', stroke: '#fff', 'stroke-opacity': 0.9 }, sw(9)), g);
        el(closed ? 'polygon' : 'polyline', Object.assign({ points: pstr(pts), fill: 'none', stroke: col, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, sw(m.selected ? 5 : 3.5)), g);
      }
    });
    if (this.draft.length) {
      var col = this.tool === 'calibrate' ? '#e8590c' : (this.o.draftColor && this.o.draftColor()) || '#1f5eff';
      var pts = this.draft.concat(this.hover ? [this._snap(this.hover)] : []);
      if (this.tool === 'area' && pts.length > 2) el('polygon', { points: pstr(pts), fill: col, 'fill-opacity': 0.12, stroke: 'none' }, svg);
      el('polyline', Object.assign({ points: pstr(pts), fill: 'none', stroke: col, 'stroke-dasharray': '6 4', 'stroke-linejoin': 'round' }, sw(3)), svg);
      this.draft.forEach(function (p, i) {
        el('circle', Object.assign({ cx: p[0], cy: p[1], r: (i === 0 ? 7 : 4.5) / z, fill: i === 0 ? '#fff' : col, stroke: col }, sw(2)), svg);
      });
    }
  };

  PlanViewer.prototype._bind = function () {
    var self = this, c = this.c;
    function pos(e) { var r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    c.addEventListener('pointerdown', function (e) {
      if (e.button === 2) return;
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
      self.pointers[e.pointerId] = pos(e);
      var ids = Object.keys(self.pointers);
      if (ids.length === 1) self.gesture = { type: 'maybe', start: pos(e), last: pos(e), button: e.button };
      else if (ids.length === 2) {
        var a = self.pointers[ids[0]], b = self.pointers[ids[1]];
        self.gesture = { type: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      }
    });
    c.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (!self.pointers[e.pointerId]) { // hovering with a mouse: rubber-band line while drawing
        if (self.draft.length) { self.hover = self.toPage(p[0], p[1]); self.draw(); self._label(); }
        return;
      }
      self.pointers[e.pointerId] = p;
      var g = self.gesture;
      if (!g) return;
      if (g.type === 'pinch') {
        var ids = Object.keys(self.pointers);
        if (ids.length < 2) return;
        var a = self.pointers[ids[0]], b = self.pointers[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        self.tx += mid[0] - g.mid[0]; self.ty += mid[1] - g.mid[1];
        if (g.d > 0) self.zoomAt(d / g.d, mid[0], mid[1]); else self._apply();
        g.d = d; g.mid = mid;
        return;
      }
      if (g.type === 'maybe' && Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) > (e.pointerType === 'mouse' ? 4 : 8)) g.type = 'pan';
      if (g.type === 'pan' || g.type === 'pan-after-pinch') { self.autoFit = false; self.tx += p[0] - g.last[0]; self.ty += p[1] - g.last[1]; self._apply(); }
      g.last = p;
      if (self.draft.length && e.pointerType === 'mouse') { self.hover = self.toPage(p[0], p[1]); }
    });
    function up(e) {
      var g = self.gesture, had = self.pointers[e.pointerId];
      delete self.pointers[e.pointerId];
      if (!had) return;
      if (g && g.type === 'maybe' && Object.keys(self.pointers).length === 0 && e.type === 'pointerup') {
        var p = pos(e);
        if (e.pointerType !== 'mouse') self.hover = null;
        self._tap(p[0], p[1]);
      }
      if (Object.keys(self.pointers).length === 0) self.gesture = null;
      else if (g && g.type === 'pinch') self.gesture = { type: 'pan-after-pinch', last: self.pointers[Object.keys(self.pointers)[0]] };
    }
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !self.pointers[e.pointerId]) { self.hover = null; self.draw(); } });
    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pos(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(dy) * 1.5) { self.tx -= e.deltaX; self._apply(); return; } // sideways trackpad scroll pans
      self.zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), p[0], p[1]);
    }, { passive: false });
    c.addEventListener('dblclick', function (e) { e.preventDefault(); if (self.tool === 'line' || self.tool === 'area') self.finish(); });
    c.addEventListener('contextmenu', function (e) { if (self.draft.length) { e.preventDefault(); self.finish(); } });
    if (global.ResizeObserver) {
      this.ro = new ResizeObserver(function () { if (self.W) { if (self.autoFit) self.fit(); else self._apply(); } });
      this.ro.observe(c);
    }
  };

  PlanViewer.prototype.destroy = function () {
    if (this.ro) this.ro.disconnect();
    if (this.renderTask) this.renderTask.cancel();
    if (this.sharpTask) this.sharpTask.cancel();
    clearTimeout(this.sharpTimer);
  };

  global.PlanViewer = PlanViewer;
  global.PlanStore = PlanStore;
  global.PlanPdf = { load: loadPdfJs, open: openPdf };
})(window);
