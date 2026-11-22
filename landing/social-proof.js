/*
 * Coatwright website: example quote + customer testimonials.
 * EDIT HERE. Everything in this section of the homepage comes from this file.
 *
 * TESTIMONIALS: only add real quotes from real customers, with their permission.
 * The "What painters say" block stays hidden while the list is empty. To add one, copy this line into the list:
 *   { quote: 'What they said, in their words.', name: 'First Last', business: 'Business name', place: 'City, Province' },
 */
window.CW_SOCIAL_PROOF = {
  testimonials: [
  ],

  // EXAMPLE QUOTE (always shown, clearly labelled as an example). Replace with a real customer's job when you have one.
  example: {
    label: 'Example quote',
    title: '3-bedroom interior repaint',
    minutes: 4,          // how long it took to build in Coatwright
    marginPct: 38,       // the painter's margin on this job
    lines: [
      ['Primary bedroom', 'Walls, ceiling and trim · 2 coats', 1180],
      ['Bedroom 2', 'Walls and trim · 2 coats', 890],
      ['Bedroom 3', 'Walls and trim · 2 coats', 870],
      ['Hallway and stairs', 'Walls and trim · 2 coats', 640],
      ['Paint and materials', 'Walls, ceiling and trim paint, primer, supplies', 1270]
    ],
    note: 'Example for illustration. Your prices come from your own rates, paint costs and markup.'
  }
};

(function () {
  var data = window.CW_SOCIAL_PROOF, box = document.getElementById('proof');
  if (!data || !box) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Number(n).toLocaleString('en-US'); };
  var ex = data.example, total = 0;
  if (ex) {
    ex.lines.forEach(function (l) { total += Number(l[2]) || 0; });
    document.getElementById('proof-example').innerHTML =
      '<div class="pq-head"><span class="pq-label">' + esc(ex.label) + '</span><h4>' + esc(ex.title) + '</h4></div>' +
      '<table class="pq-lines"><tbody>' + ex.lines.map(function (l) {
        return '<tr><td>' + esc(l[0]) + '<small>' + esc(l[1]) + '</small></td><td>' + money(l[2]) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td>Total</td><td>' + money(total) + '</td></tr></tfoot></table>' +
      '<div class="pq-badges"><span>⏱ Built in about ' + esc(ex.minutes) + ' minutes</span><span>📈 ' + esc(ex.marginPct) + '% margin</span></div>' +
      '<p class="pq-note">' + esc(ex.note) + '</p>';
  }
  var list = (data.testimonials || []).filter(function (t) { return t && t.quote; });
  if (list.length) {
    document.getElementById('proof-quotes').innerHTML = list.map(function (t) {
      return '<figure class="tq"><blockquote>“' + esc(t.quote) + '”</blockquote><figcaption><b>' + esc(t.name) + '</b>' +
        [t.business, t.place].filter(Boolean).map(function (x) { return ' · ' + esc(x); }).join('') + '</figcaption></figure>';
    }).join('');
    document.getElementById('proof-say').hidden = false;
  }
})();
