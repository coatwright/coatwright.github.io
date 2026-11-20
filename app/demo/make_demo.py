# Builds the demo blueprint (a made-up office, 1/8" = 1'-0" on a 36"x24" sheet) and its pre-measured takeoff.
import json, math
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black
import os
OUT = os.path.dirname(os.path.abspath(__file__)) + '/'
W, H = 2592, 1728          # 36" x 24" in points
K = 9.0                    # points per foot at 1/8" = 1'-0"
X0, Y0 = 330, 300          # building top-left on the sheet (top-left coords)
def P(fx, fy): return (X0 + fx * K, Y0 + fy * K)          # viewer coords (top-left origin)
def C(fx, fy): x, y = P(fx, fy); return (x, H - y)        # PDF coords

rooms = []  # name, number, x, y, w, h
for i in range(8):
    rooms.append(('OFFICE', str(201 + i), i * 15, 0, 15, 15))
rooms += [('CORRIDOR', '210', 0, 15, 120, 6), ('RECEPTION', '211', 0, 21, 25, 49), ('OPEN OFFICE', '212', 25, 21, 50, 49),
          ('CONFERENCE', '213', 75, 21, 25, 24), ('BREAK ROOM', '214', 75, 45, 25, 25), ("MEN'S", '215', 100, 21, 20, 12),
          ("WOMEN'S", '216', 100, 33, 20, 12), ('STORAGE / IT', '217', 100, 45, 20, 25)]

c = canvas.Canvas(OUT + 'sample-office-plan.pdf', pagesize=(W, H))
c.setTitle('A-101 Level 2 Floor Plan (sample)'); c.setAuthor('Coatwright demo'); c.setSubject('Fictional office plan for the Coatwright takeoff demo')
# sheet border
c.setLineWidth(3); c.rect(36, 36, W - 72, H - 72)
c.setLineWidth(1); c.rect(48, 48, W - 96, H - 96)
# light grid lines + bubbles
c.setStrokeColor(HexColor('#9aa3b5')); c.setDash(18, 6); c.setLineWidth(0.8)
for gx, lab in [(0, '1'), (25, '2'), (50, '3'), (75, '4'), (100, '5'), (120, '6')]:
    x, _ = C(gx, 0); c.line(x, H - (Y0 - 70), x, H - (Y0 + 70 * K + 40))
for gy, lab in [(0, 'A'), (21, 'B'), (45, 'C'), (70, 'D')]:
    _, y = C(0, gy); c.line(X0 - 70, y, X0 + 120 * K + 40, y)
c.setDash(); c.setStrokeColor(black)
c.setFont('Helvetica-Bold', 16)
for gx, lab in [(0, '1'), (25, '2'), (50, '3'), (75, '4'), (100, '5'), (120, '6')]:
    x, _ = C(gx, 0); c.circle(x, H - (Y0 - 92), 18); c.drawCentredString(x, H - (Y0 - 92) - 6, lab)
for gy, lab in [(0, 'A'), (21, 'B'), (45, 'C'), (70, 'D')]:
    _, y = C(0, gy); c.circle(X0 - 92, y, 18); c.drawCentredString(X0 - 92, y - 6, lab)
# walls: interior 5" thick-looking lines, exterior heavier
def rect_walls(x, y, w, h, lw):
    c.setLineWidth(lw); a = C(x, y); c.rect(a[0], a[1] - h * K, w * K, h * K)
c.setFillColor(HexColor('#f4f1ea'))
a = C(0, 0); c.rect(a[0], a[1] - 70 * K, 120 * K, 70 * K, stroke=0, fill=1)
c.setFillColor(black)
for r in rooms: rect_walls(r[2], r[3], r[4], r[5], 3.2)
rect_walls(0, 0, 120, 70, 7)
# doors: openings with swing arcs
doors = []
def door(fx, fy, side, swing=1):
    # side: 'h' door in a horizontal wall at (fx..fx+3, fy); 'v' in a vertical wall at (fx, fy..fy+3)
    c.setLineWidth(1.2)
    if side == 'h':
        x, y = C(fx, fy); c.setStrokeColor(HexColor('#f4f1ea')); c.setLineWidth(5); c.line(x + 1, y, x + 3 * K - 1, y)
        c.setStrokeColor(black); c.setLineWidth(1.2); c.line(x, y, x, y + swing * 3 * K)
        c.arc(x - 3 * K, y - 3 * K, x + 3 * K, y + 3 * K, 0 if swing > 0 else -90, 90)
        doors.append(P(fx + 1.5, fy))
    else:
        x, y = C(fx, fy); c.setStrokeColor(HexColor('#f4f1ea')); c.setLineWidth(5); c.line(x, y - 1, x, y - 3 * K + 1)
        c.setStrokeColor(black); c.setLineWidth(1.2); c.line(x, y, x + swing * 3 * K, y)
        c.arc(x - 3 * K, y - 3 * K, x + 3 * K, y + 3 * K, -90 if swing > 0 else 180, 90)
        doors.append(P(fx, fy + 1.5))
for i in range(8): door(i * 15 + 10, 15, 'h', 1)                 # offices onto corridor
door(10, 21, 'h', -1)                                             # reception
door(60, 21, 'h', -1)                                             # open office
door(85, 21, 'h', -1)                                             # conference
door(75, 55, 'v', 1)                                              # break room from open office
door(100, 26, 'v', 1); door(100, 38, 'v', 1)                      # washrooms
door(100, 56, 'v', 1)                                             # storage
door(10, 70, 'h', 1)                                              # main entry (exterior)
c.setStrokeColor(black)
# room labels
for name, num, x, y, w, h in rooms:
    cx, cy = C(x + w / 2, y + h / 2)
    fs = 15 if w >= 20 else 12
    c.setFont('Helvetica-Bold', fs); c.drawCentredString(cx, cy + 4, name)
    c.setFont('Helvetica', fs - 2); c.drawCentredString(cx, cy - fs + 2, num)
    if name not in ('CORRIDOR',):
        c.setFont('Helvetica', 10); c.drawCentredString(cx, cy - 2 * fs + 4, "%d'-0\" x %d'-0\"" % (w, h))
# casework: break-room counter, washroom fixtures (just to look real)
c.setLineWidth(1)
a = C(77, 67.5); c.rect(a[0], a[1], 21 * K, 2 * K)
for k in range(3):
    a = C(103 + k * 5, 22); c.rect(a[0], a[1] - 4 * K, 3 * K, 4 * K)
    a = C(103 + k * 5, 34); c.rect(a[0], a[1] - 4 * K, 3 * K, 4 * K)
# dimensions
def dim_h(x1, x2, fy, text):
    a = C(x1, fy); b = C(x2, fy); c.setLineWidth(0.8); c.line(a[0], a[1], b[0], b[1])
    for p in (a, b): c.line(p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5)
    c.setFont('Helvetica', 12); c.drawCentredString((a[0] + b[0]) / 2, a[1] + 6, text)
def dim_v(fx, y1, y2, text):
    a = C(fx, y1); b = C(fx, y2); c.setLineWidth(0.8); c.line(a[0], a[1], b[0], b[1])
    for p in (a, b): c.line(p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5)
    c.saveState(); c.translate(a[0] - 8, (a[1] + b[1]) / 2); c.rotate(90); c.setFont('Helvetica', 12); c.drawCentredString(0, 0, text); c.restoreState()
dim_h(0, 120, -12, "120'-0\""); 
for gx1, gx2 in [(0, 25), (25, 75), (75, 100), (100, 120)]: dim_h(gx1, gx2, 76, "%d'-0\"" % (gx2 - gx1))
dim_v(-14, 0, 70, "70'-0\"")
# north arrow
nx, ny = 2300, 1350
c.setLineWidth(1.5); c.circle(nx, ny, 40); p = c.beginPath(); p.moveTo(nx, ny + 38); p.lineTo(nx - 14, ny - 20); p.lineTo(nx, ny - 8); p.lineTo(nx + 14, ny - 20); p.close(); c.drawPath(p, fill=1)
c.setFont('Helvetica-Bold', 18); c.drawCentredString(nx, ny + 50, 'N')
# general notes
c.setFont('Helvetica-Bold', 16); c.drawString(1650, 1500, 'GENERAL NOTES')
c.setFont('Helvetica', 12)
for i, line in enumerate(['1. SAMPLE DRAWING FOR SOFTWARE DEMONSTRATION ONLY.', '2. ALL INTERIOR PARTITIONS: GYPSUM BOARD, PAINT FINISH.',
                          '3. CEILING HEIGHT 9\'-0" A.F.F. UNLESS NOTED.', '4. WASHROOMS: SEMI-GLOSS FINISH.', '5. OPEN OFFICE: EXPOSED DECK, DRYFALL.',
                          '6. HOLLOW METAL FRAMES AT ALL DOORS.']):
    c.drawString(1650, 1470 - i * 20, line)
# title block
tbx, tby, tbw, tbh = 1650, 60, 880, 320
c.setLineWidth(2); c.rect(tbx, tby, tbw, tbh)
c.line(tbx, tby + 220, tbx + tbw, tby + 220); c.line(tbx, tby + 110, tbx + tbw, tby + 110); c.line(tbx + 600, tby, tbx + 600, tby + 110)
c.setFont('Helvetica-Bold', 26); c.drawString(tbx + 20, tby + 270, 'HARBOUR POINT OFFICES')
c.setFont('Helvetica', 16); c.drawString(tbx + 20, tby + 240, 'LEVEL 2 TENANT FIT-OUT  ·  SAMPLE PROJECT (FICTIONAL)')
c.setFont('Helvetica-Bold', 30); c.drawString(tbx + 20, tby + 150, 'LEVEL 2 FLOOR PLAN')
c.setFont('Helvetica', 16); c.drawString(tbx + 20, tby + 60, 'SCALE: 1/8" = 1\'-0"')
c.drawString(tbx + 20, tby + 30, 'DATE: 2026-11-20      DRAWN: CW')
c.setFont('Helvetica', 12); c.drawString(tbx + 620, tby + 80, 'SHEET')
c.setFont('Helvetica-Bold', 44); c.drawString(tbx + 625, tby + 25, 'A-101')
c.setFont('Helvetica-Bold', 18); c.drawString(X0, H - (Y0 + 70 * K + 150), 'LEVEL 2 FLOOR PLAN')
c.setFont('Helvetica', 14); c.drawString(X0, H - (Y0 + 70 * K + 172), 'SCALE: 1/8" = 1\'-0"')
c.showPage(); c.save()

# ---- the pre-measured takeoff ----
def rect_pts(x, y, w, h): return [list(P(x, y)), list(P(x + w, y)), list(P(x + w, y + h)), list(P(x, y + h))]
def r2(pts): return [[round(a, 2), round(b, 2)] for a, b in pts]
Z = 'zone-l2'
systems = [
    {'id': 'sys-walls', 'preset': 'walls_eggshell', 'name': 'Walls — eggshell, 2 coats'},
    {'id': 'sys-wash', 'preset': 'walls_semigloss', 'name': 'Washroom walls — semi-gloss, 2 coats'},
    {'id': 'sys-ceil', 'preset': 'ceilings_flat', 'name': 'Drywall ceilings — flat'},
    {'id': 'sys-deck', 'preset': 'deck_dryfall', 'name': 'Open office exposed deck — dryfall'},
    {'id': 'sys-doors', 'preset': 'doors', 'name': 'Doors — both sides'},
    {'id': 'sys-frames', 'preset': 'hm_frames', 'name': 'Hollow metal door frames'},
]
marks = []; n = 0
def add(sys, kind, pts, closed=False, h=None, label=None):
    global n; n += 1
    m = {'id': 'demo-%d' % n, 'systemId': sys, 'zoneId': Z, 'kind': kind, 'pts': r2(pts)}
    if label: m['label'] = label
    if closed: m['closed'] = True
    if h: m['h'] = h
    marks.append(m)
for name, num, x, y, w, h in rooms:
    lab = name.title().replace("'S", "'s") + ' ' + num
    if name in ("MEN'S", "WOMEN'S"): add('sys-wash', 'line', rect_pts(x, y, w, h), True, 9, lab)
    elif name == 'OPEN OFFICE': add('sys-walls', 'line', rect_pts(x, y, w, h), True, 12, lab)
    else: add('sys-walls', 'line', rect_pts(x, y, w, h), True, 9, lab)
for name, num, x, y, w, h in rooms:
    lab = name.title().replace("'S", "'s") + ' ' + num
    if name in ('RECEPTION', 'CORRIDOR', "MEN'S", "WOMEN'S"): add('sys-ceil', 'area', rect_pts(x, y, w, h), label=lab)
    if name == 'OPEN OFFICE': add('sys-deck', 'area', rect_pts(x, y, w, h), label=lab)
add('sys-doors', 'count', doors[:-1], label='Interior doors')
add('sys-frames', 'count', doors, label='All door frames')
demo = {'project': 'Harbour Point Offices — Level 2 fit-out (sample)', 'wallHeight': 9, 'zones': [{'id': Z, 'name': 'Level 2'}],
        'scales': {'1': {'ftPerPt': 8 / 72, 'label': '1/8" = 1\'-0"'}}, 'systems': systems, 'marks': marks,
        'adds': [{'label': 'Scissor lift rental (1 week)', 'cost': 450}],
        'alternates': [{'label': 'Paint exit stair B (walls, rails, doors)', 'price': 2400}]}
json.dump(demo, open(OUT + 'sample-office-takeoff.json', 'w'), indent=1)
print('marks', len(marks), 'doors', len(doors))
