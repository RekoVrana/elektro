
const APP_VERSION = '3.1.0-vrana', FORMAT = 'elektro-editor', SCHEMA_VERSION = 3;
const JOB_ID = typeof PROJECT.jobId === 'string' ? PROJECT.jobId : null;
const GEOM_FP = typeof PROJECT.geomFp === 'string' ? PROJECT.geomFp : null;
const LEGACY_ALIASES = Array.isArray(PROJECT.legacyAliases) ? PROJECT.legacyAliases.filter(a => typeof a === 'string') : [];

/* ---------- vocabulary ---------- */
const ROOM_CS = {"Bathroom":"Koupelna","Bedroom":"Ložnice","Children Bedroom":"Dětský pokoj","Hallway":"Chodba","Kitchen":"Kuchyň","Toilet":"WC","Balcony":"Balkon","Living Room":"Obývací pokoj","Storage":"Komora","Other":"Ostatní","Dining Room":"Jídelna","Office":"Pracovna","Closet":"Šatna","Laundry":"Prádelna","Půdorys":"Půdorys"};
const roomCs = r => { const m = /^(.*?)( \d+)?$/.exec(r || ''); return (ROOM_CS[m[1]] || m[1]) + (m[2] || ''); };
const fmtM = m => m.toFixed(2).replace('.', ',') + ' m';
const mm = m => Math.round(m * 1000);
const fmtMm = m => String(mm(m)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' mm';
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isStr = v => typeof v === 'string';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* ---------- symbols (local frame: x along wall, y away from wall / up) ---------- */
const R = 4.2;
function arcPts(cx, cy, r, a0, a1, n = 14) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
const socketBase = () => [{ op: 'poly', pts: arcPts(0, 0, R, 0, Math.PI), close: false }, { op: 'line', p: [[-R, 0], [R, 0]] }];
const tick = (x, y, dx, dy, l = 2.6) => ({ op: 'line', p: [[x - dy * l / 2, y + dx * l / 2], [x + dy * l / 2, y - dx * l / 2]] });
function flag(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); return [{ op: 'line', p: [[x1, y1], [x2, y2]] }, tick(x2, y2, dx / L, dy / L)]; }
const SYMBOLS = [
  { cat: 'Zásuvky', id: 'zas1', name: 'Zásuvka 230 V', pref: 'Z', h: 300, ops: () => [...socketBase(), { op: 'line', p: [[0, R], [0, R + 3.2]] }] },
  { cat: 'Zásuvky', id: 'zas2', name: 'Dvojzásuvka 230 V', pref: 'Z', h: 300, ops: () => [...socketBase(), { op: 'line', p: [[-1.4, R - .3], [-1.4, R + 3.2]] }, { op: 'line', p: [[1.4, R - .3], [1.4, R + 3.2]] }] },
  { cat: 'Zásuvky', id: 'zasK', name: 'Zásuvka nad linkou', pref: 'Z', h: 1150, ops: () => [...socketBase(), { op: 'line', p: [[0, R], [0, R + 3.2]] }] },
  { cat: 'Zásuvky', id: 'zasIP', name: 'Zásuvka IP44', pref: 'Z', h: 1150, ops: () => [...socketBase(), { op: 'line', p: [[0, R], [0, R + 3.2]] }, { op: 'text', x: R + 2, y: 2.5, s: 'IP', size: 3.6 }] },
  { cat: 'Zásuvky', id: 'zas400', name: 'Zásuvka 400 V (3f)', pref: 'Z', h: 300, ops: () => [...socketBase(), { op: 'line', p: [[-2.2, R - .6], [-2.2, R + 3]] }, { op: 'line', p: [[0, R], [0, R + 3.4]] }, { op: 'line', p: [[2.2, R - .6], [2.2, R + 3]] }] },
  { cat: 'Spínače', id: 'vyp1', name: 'Vypínač č. 1', pref: 'V', h: 1150, ops: () => [{ op: 'circle', c: [0, 0], r: 1.7, fill: true }, ...flag(0, 0, 3.6, 5.6)] },
  { cat: 'Spínače', id: 'vyp5', name: 'Sériový č. 5', pref: 'V', h: 1150, ops: () => [{ op: 'circle', c: [0, 0], r: 1.7, fill: true }, ...flag(0, 0, 3.6, 5.6), ...flag(0, 0, -3.6, 5.6)] },
  { cat: 'Spínače', id: 'vyp6', name: 'Střídavý č. 6', pref: 'V', h: 1150, ops: () => [{ op: 'circle', c: [0, 0], r: 1.7, fill: true }, ...flag(0, 0, 3.6, 5.6), ...flag(0, 0, -3.6, -5.6)] },
  { cat: 'Spínače', id: 'vyp7', name: 'Křížový č. 7', pref: 'V', h: 1150, ops: () => [{ op: 'circle', c: [0, 0], r: 1.7, fill: true }, ...flag(0, 0, 3.6, 5.6), ...flag(0, 0, -3.6, -5.6), ...flag(0, 0, -3.6, 5.6), ...flag(0, 0, 3.6, -5.6)] },
  { cat: 'Spínače', id: 'stm', name: 'Stmívač', pref: 'V', h: 1150, ops: () => [{ op: 'circle', c: [0, 0], r: 1.7, fill: true }, ...flag(0, 0, 3.6, 5.6), { op: 'poly', pts: [[-5.5, -1.5], [-1.5, -1.5], [-5.5, -5]], close: true, fill: true }] },
  { cat: 'Spínače', id: 'tlac', name: 'Tlačítko', pref: 'V', h: 1150, ops: () => [{ op: 'circle', c: [0, 0], r: 3.4 }, { op: 'circle', c: [0, 0], r: 1.4, fill: true }] },
  { cat: 'Svítidla', id: 'svStrop', name: 'Svítidlo stropní', pref: 'S', h: 2550, ceiling: true, ops: () => [{ op: 'circle', c: [0, 0], r: R }, { op: 'line', p: [[-3, -3], [3, 3]] }, { op: 'line', p: [[-3, 3], [3, -3]] }] },
  { cat: 'Svítidla', id: 'svNast', name: 'Svítidlo nástěnné', pref: 'S', h: 1800, ops: () => [{ op: 'circle', c: [0, 3.2], r: 3.4 }, { op: 'line', p: [[-2.4, .8], [2.4, 5.6]] }, { op: 'line', p: [[-2.4, 5.6], [2.4, .8]] }, { op: 'line', p: [[-4.5, 0], [4.5, 0]] }] },
  { cat: 'Svítidla', id: 'bod', name: 'Bodové svítidlo', pref: 'S', h: 2550, ceiling: true, ops: () => [{ op: 'circle', c: [0, 0], r: 2.6, fill: true }, { op: 'line', p: [[-4.2, -4.2], [4.2, 4.2]] }, { op: 'line', p: [[-4.2, 4.2], [4.2, -4.2]] }] },
  { cat: 'Svítidla', id: 'led', name: 'LED pásek', pref: 'S', h: 2300, ops: () => [{ op: 'poly', pts: [[-8, 0], [8, 0], [8, 3.2], [-8, 3.2]], close: true }, { op: 'line', p: [[-5, 0], [-2, 3.2]] }, { op: 'line', p: [[-1, 0], [2, 3.2]] }, { op: 'line', p: [[3, 0], [6, 3.2]] }] },
  { cat: 'Slaboproud', id: 'rj45', name: 'Datová RJ45', pref: 'D', h: 300, ops: () => [...socketBase(), { op: 'poly', pts: [[-2.2, .8], [2.2, .8], [0, 3.6]], close: true, fill: true }] },
  { cat: 'Slaboproud', id: 'tv', name: 'TV / SAT', pref: 'D', h: 300, ops: () => [...socketBase(), { op: 'text', x: 0, y: 2.4, s: 'TV', size: 3.4, anchor: 'middle' }] },
  { cat: 'Slaboproud', id: 'zvon', name: 'Zvonek / dom. telefon', pref: 'D', h: 1500, ops: () => [{ op: 'poly', pts: [[-4, 0], [4, 0], [4, 5], [-4, 5]], close: true }, { op: 'text', x: 0, y: 3.9, s: 'DT', size: 3.2, anchor: 'middle' }] },
  { cat: 'Slaboproud', id: 'term', name: 'Termostat', pref: 'D', h: 1500, ops: () => [{ op: 'circle', c: [0, 0], r: R }, { op: 'text', x: 0, y: 1.6, s: 't', size: 5, anchor: 'middle' }] },
  { cat: 'Slaboproud', id: 'pir', name: 'Pohybové čidlo', pref: 'D', h: 2300, ops: () => [{ op: 'circle', c: [0, 0], r: R }, { op: 'text', x: 0, y: 1.3, s: 'PIR', size: 2.8, anchor: 'middle' }] },
  { cat: 'Vývody a ostatní', id: 'vyvDig', name: 'Vývod digestoř', pref: 'P', h: 2100, txt: 'DIG' },
  { cat: 'Vývody a ostatní', id: 'vyvVD', name: 'Vývod varná deska', pref: 'P', h: 400, txt: 'VD' },
  { cat: 'Vývody a ostatní', id: 'vyvTr', name: 'Vývod trouba', pref: 'P', h: 400, txt: 'TR' },
  { cat: 'Vývody a ostatní', id: 'vyvMy', name: 'Vývod myčka', pref: 'P', h: 400, txt: 'MY' },
  { cat: 'Vývody a ostatní', id: 'vyvPr', name: 'Vývod pračka', pref: 'P', h: 1150, txt: 'PR' },
  { cat: 'Vývody a ostatní', id: 'vyvBoj', name: 'Vývod bojler', pref: 'P', h: 1800, txt: 'BOJ' },
  { cat: 'Vývody a ostatní', id: 'vyvZeb', name: 'Vývod topný žebřík', pref: 'P', h: 300, txt: 'ŽEB' },
  { cat: 'Vývody a ostatní', id: 'vyv', name: 'Vývod obecný', pref: 'P', h: 300, txt: '' },
  { cat: 'Vývody a ostatní', id: 'vent', name: 'Ventilátor', pref: 'P', h: 2300, ops: () => [{ op: 'circle', c: [0, 0], r: R }, { op: 'text', x: 0, y: 1.5, s: 'M', size: 4.6, anchor: 'middle' }] },
  { cat: 'Vývody a ostatní', id: 'rozv', name: 'Rozvaděč', pref: 'R', h: 1500, ops: () => [{ op: 'poly', pts: [[-7, 0], [7, 0], [7, 5], [-7, 5]], close: true }, { op: 'poly', pts: [[-7, 0], [0, 0], [0, 5], [-7, 5]], close: true, fill: true }] },
  { cat: 'Vývody a ostatní', id: 'krab', name: 'Krabice', pref: 'R', h: 2300, ops: () => [{ op: 'circle', c: [0, 0], r: 2.4, fill: true }] },
];
for (const s of SYMBOLS) { if (s.txt !== undefined) s.tag = s.txt; if (!s.ops) s.ops = () => [{ op: 'poly', pts: [[-3.2, 0], [3.2, 0], [0, 5]], close: true, fill: true }]; }
/* type shorthand written after the mark (Z3 IP, P5 VD, D2 TV) – the symbol shape itself stays unlabeled */
const TAGS = { zasIP: 'IP', tv: 'TV', zvon: 'DT', term: 't', pir: 'PIR', vent: 'M' }; for (const s of SYMBOLS) if (TAGS[s.id]) s.tag = TAGS[s.id];
const labelText = e => ((e.label || '') + ' ' + ((SYM[e.type] && SYM[e.type].tag) || '')).trim();
/* colour carries the circuit: power / control / lighting / low-voltage; shapes differ too, so a black-and-white print still reads */
const EL_COL = { 'Zásuvky': '#C6321B', 'Vývody a ostatní': '#C6321B', 'Spínače': '#1B7A3E', 'Svítidla': '#1F5FBF', 'Slaboproud': '#7A3E9D' };
const ID_COL = { term: '#1B7A3E', pir: '#1B7A3E' };   // control devices listed under low-voltage
const SEL_COL = '#E07B00';
const symColor = t => ID_COL[t] || (SYM[t] && EL_COL[SYM[t].cat]) || '#C6321B';
// dictionaries without a prototype: unknown keys such as 'constructor' or '__proto__' resolve to undefined (validation error), never to inherited members
const dict = entries => { const o = Object.create(null); for (const [k, v] of entries) o[k] = v; return o; };
const SYM = dict(SYMBOLS.map(s => [s.id, s]));

/* ---------- basic geometry ---------- */
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const vlen = a => Math.hypot(a[0], a[1]);
const vnorm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l]; };
const WALLS = dict(PROJECT.walls.map(w => [w.id, w]));
const PLAN = PROJECT.plan;
function wallDir(w) { return vnorm(vsub(w.plan.b, w.plan.a)); }
function planPoint(w, u) { const d = wallDir(w); return [w.plan.a[0] + d[0] * u * PLAN.ppm, w.plan.a[1] + d[1] * u * PLAN.ppm]; }
function toSec(sec, p) { const a = sec.affine; return [a[0] * p[0] + a[1], a[2] * p[1] + a[3]]; }
function fromSec(sec, p) { const a = sec.affine; return [(p[0] - a[1]) / a[0], (p[1] - a[3]) / a[2]]; }
function footOnWall(w, pt) { const d = wallDir(w), L = w.plan.segLen; const rel = vsub(pt, w.plan.a); let t = rel[0] * d[0] + rel[1] * d[1]; t = Math.max(0, Math.min(L, t)); const foot = [w.plan.a[0] + d[0] * t, w.plan.a[1] + d[1] * t]; return { foot, t, dist: vlen(vsub(pt, foot)) }; }
function wallAxis(w) { const a = w.plan.a, b = w.plan.b; return Math.abs(a[0] - b[0]) < 2 ? 0 : (Math.abs(a[1] - b[1]) < 2 ? 1 : -1); }

/* ---------- polygons ---------- */
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
function distPointSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const L2 = dx * dx + dy * dy || 1e-12; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function distToPoly(p, poly) { let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, distPointSeg(p, poly[i], poly[(i + 1) % poly.length])); return d; }
function polyBBox(poly) { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
function polyArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function scanIntervals(poly, y) {
  const xs = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
  xs.sort((p, q) => p - q); const out = []; for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); return out;
}

/* ---------- rooms: ceiling height (report header = source datum, not a site measurement) + polygon ---------- */
const LIM = { maxFreeH: 6, maxCount: 10, maxLabel: 24, maxNote: 2000, maxAuthor: 60, polyTol: 3, maxElements: 2000 };
function deriveRooms() {
  const out = Object.create(null); const byRoom = Object.create(null);
  for (const w of PROJECT.walls) (byRoom[w.room] = byRoom[w.room] || []).push(w);
  const src = Array.isArray(PROJECT.rooms) ? PROJECT.rooms : [];
  for (const name of Object.keys(byRoom)) {
    const r = src.find(x => x && x.name === name) || null; const ws = byRoom[name];
    let ceilingM = r && isNum(r.ceilingM) ? r.ceilingM : null, uncertain = r ? !!r.ceilingUncertain : true, reason = r ? (r.ceilingReason || null) : null, source = r ? (r.ceilingSource || 'header') : 'walls';
    if (!r) { // project.json without rooms (older extraction): derive from measured walls, never by maximum
      const hs = [...new Set(ws.filter(w => !w.synthetic).map(w => Math.round(w.chM * 1000) / 1000))];
      if (hs.length === 1) { ceilingM = hs[0]; uncertain = hs[0] < 1.5; reason = uncertain ? `výška ${hs[0]} m je podezřele nízká` : null; }
      else { ceilingM = null; uncertain = true; reason = hs.length ? 'rozporné výšky stěn: ' + hs.join(', ') + ' m' : 'výška stropu není v datech'; }
    }
    let polygon = r && Array.isArray(r.polygon) && r.polygon.length >= 3 ? r.polygon.map(p => [+p[0], +p[1]]) : null; let polygonSource = polygon ? (r.polygonSource || 'roomPlan') : null;
    if (!polygon) { const pts = ws.filter(w => w.plan).flatMap(w => [w.plan.a, w.plan.b]); if (pts.length) { const bb = polyBBox(pts); polygon = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]]; polygonSource = 'bbox'; } }
    const low = (r && !!r.low) || ws.some(w => w.chM < 1.5);
    const mism = r && Array.isArray(r.wallHeightMismatch) ? r.wallHeightMismatch : ws.filter(w => ceilingM != null && Math.abs(w.chM - ceilingM) > 0.005).map(w => w.id);
    out[name] = { name, ceilingM, ceilingUncertain: uncertain, ceilingReason: reason, ceilingSource: source, polygon, polygonSource, low, wallIds: ws.map(w => w.id), wallHeightMismatch: mism };
  }
  return out;
}
const ROOMS = deriveRooms();
const roomOf = name => ROOMS[name] || null;
function roomAt(pp, opts = {}) {
  const tol = opts.tol ?? LIM.polyTol; const cands = [];
  for (const r of Object.values(ROOMS)) {
    if (!r.polygon) continue; if (opts.room && r.name !== opts.room) continue;   // low rooms (railing height) stay addressable for free elements with a manual height
    const inside = pointInPoly(pp, r.polygon); const d = inside ? 0 : distToPoly(pp, r.polygon);
    if (inside || d <= tol) cands.push({ r, inside, d });
  }
  if (!cands.length) return null;
  const strict = cands.filter(c => c.inside);
  if (strict.length === 1) return strict[0].r.name;
  if (strict.length > 1) { strict.sort((a, b) => Math.abs(polyArea(a.r.polygon)) - Math.abs(polyArea(b.r.polygon))); return strict[0].r.name; }
  // on a boundary (shared wall): the room on whose interior side of the nearest wall the point lies
  let best = null;
  for (const c of cands) for (const wid of c.r.wallIds) {
    const w = WALLS[wid]; if (!w.plan) continue; const f = footOnWall(w, pp); const side = (pp[0] - f.foot[0]) * w.plan.n[0] + (pp[1] - f.foot[1]) * w.plan.n[1];
    const score = f.dist + (side >= -0.5 ? 0 : 1000); if (!best || score < best.score) best = { score, room: c.r.name };
  }
  return best ? best.room : cands.sort((a, b) => a.d - b.d)[0].r.name;
}
function roomCenter(room) { // point farthest from the polygon edges (pole of inaccessibility), always inside – also for L shapes
  const r = ROOMS[room]; if (!r || !r.polygon) return null; const poly = r.polygon; const bb = polyBBox(poly); const N = 48; let best = null;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const p = [bb[0] + (i + 0.5) * (bb[2] - bb[0]) / N, bb[1] + (j + 0.5) * (bb[3] - bb[1]) / N]; if (!pointInPoly(p, poly)) continue; const d = distToPoly(p, poly); if (!best || d > best.d) best = { p, d }; }
  if (!best) return null;
  let step = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / N;
  for (let k = 0; k < 30; k++) { let improved = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const p = [best.p[0] + dx * step, best.p[1] + dy * step]; if (!pointInPoly(p, poly)) continue; const d = distToPoly(p, poly); if (d > best.d + 1e-9) { best = { p, d }; improved = true; } } if (!improved) step /= 2; }
  return [Math.round(best.p[0] * 100) / 100, Math.round(best.p[1] * 100) / 100];
}
function roomGrid(room, rows, cols) { // rows × cols points, each row distributed over the polygon's own x-intervals → always inside (L shapes included)
  const r = ROOMS[room]; if (!r || !r.polygon) return []; const poly = r.polygon; const bb = polyBBox(poly); const pts = [];
  for (let i = 0; i < rows; i++) {
    const y = bb[1] + (i + 0.5) * (bb[3] - bb[1]) / rows; const iv = scanIntervals(poly, y).filter(s => s[1] - s[0] > 1); if (!iv.length) continue;
    const total = iv.reduce((s, x) => s + (x[1] - x[0]), 0); const alloc = iv.map(x => Math.floor(cols * (x[1] - x[0]) / total)); let rem = cols - alloc.reduce((a, b) => a + b, 0);
    const order = iv.map((x, k) => k).sort((a, b) => (iv[b][1] - iv[b][0]) - (iv[a][1] - iv[a][0])); for (let k = 0; rem > 0; k = (k + 1) % order.length, rem--) alloc[order[k]]++;
    iv.forEach((x, k) => { for (let j = 0; j < alloc[k]; j++) pts.push([Math.round((x[0] + (j + 0.5) * (x[1] - x[0]) / alloc[k]) * 100) / 100, Math.round(y * 100) / 100]); });
  }
  return pts.filter(p => pointInPoly(p, poly));
}

/* ---------- sections + wall names (by the drawing: vlevo / vpravo / nahoře / dole – no compass) ---------- */
const orientName = n => (Math.abs(n[0]) > Math.abs(n[1])) ? (n[0] > 0 ? 'vlevo' : 'vpravo') : (n[1] > 0 ? 'nahoře' : 'dole');
const HORIZ = new Set(['nahoře', 'dole']);
const SCHEMA_NOTE = 'schéma (odhad z půdorysu)';
const MERGED_NOTE = 'sloučený pohled (report kreslí stěnu po částech)';
const isMerged = w => !!(w && Array.isArray(w.mergedFrom) && w.mergedFrom.length);
const wallOrigin = w => isMerged(w) ? 'sloučeno' : (w.synthetic ? 'schéma' : 'měřeno');
const wallNote = w => isMerged(w) ? MERGED_NOTE : SCHEMA_NOTE;
const SECTIONS = [];
(function buildSections() {
  const lowRooms = new Set(Object.values(ROOMS).filter(r => r.low).map(r => r.name));
  for (const w of PROJECT.walls) { w.hidden = lowRooms.has(w.room) || w.chM < 1.5; w.origin = wallOrigin(w); w.orient = w.plan ? orientName(w.plan.n) : '?'; }
  PROJECT.pages.forEach((pg, pi) => pg.sections.forEach(sec => {
    if (sec.type === 'plan') {
      if (!sec.affine) return; if (sec.room && lowRooms.has(sec.room)) return;
      let bbox = [30, sec.y0 - 6, 565, sec.y1];
      if (sec.floor && sec.floor.length) { const xs = sec.floor.map(p => p[0]), ys = sec.floor.map(p => p[1]); const m = sec.isMain ? 22 : 46; bbox = [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m]; }
      SECTIONS.push({ id: `P${pi}-${sec.idx}`, kind: 'plan', page: pi, room: sec.isMain ? null : sec.room, isMain: !!sec.isMain, bbox, affine: sec.affine, ppm: sec.isMain ? PLAN.ppm : sec.ppm, name: sec.isMain ? 'Celý byt' : 'Půdorys místnosti' });
    } else if (sec.type === 'elevation') {
      const w = WALLS[sec.wallId]; if (!w || w.hidden) return;
      const f = w.face; const bbox = [f[0] - 34, f[1] - 26, f[2] + 34, f[3] + 22];
      const op = w.openings.map(x => x.kind === 'door' ? 'dveře' : 'okno');
      SECTIONS.push({ id: `E${w.id}`, kind: 'elev', page: pi, room: w.room, wallId: w.id, bbox, ppm: w.ppm, name: `Stěna ${w.orient}`, sub: (op.length ? [...new Set(op)].join(' + ') + ' · ' : '') + fmtM(w.lenM) });
    }
  }));
  for (const w of PROJECT.walls.filter(w => w.synthetic && !w.hidden)) { // rooms without elevations: virtual A4 page
    w.ppm = 60; const fw = w.lenM * w.ppm, fh = w.chM * w.ppm; const x0 = Math.max(40, (595 - fw) / 2), y0 = 140; w.face = [x0, y0, x0 + fw, y0 + fh];
    const op = w.openings.map(x => x.kind === 'door' ? 'dveře' : 'okno');
    SECTIONS.push({ id: `E${w.id}`, kind: 'elev', synthetic: true, page: null, room: w.room, wallId: w.id, bbox: [x0 - 46, y0 - 40, x0 + fw + 34, y0 + fh + 22], ppm: w.ppm, name: `Stěna ${w.orient}`, sub: (op.length ? [...new Set(op)].join(' + ') + ' · ' : '') + fmtM(w.lenM) + ' · ' + wallNote(w) });
  }
  const groups = {};
  for (const sec of SECTIONS) if (sec.kind === 'elev') { const w = WALLS[sec.wallId]; if (!w.plan) continue; const k = w.room + '|' + w.orient; (groups[k] = groups[k] || []).push(sec); }
  for (const k in groups) {
    const g = groups[k]; if (g.length < 2) continue; const horiz = HORIZ.has(k.split('|')[1]);
    g.sort((a, b) => { const A = WALLS[a.wallId].plan, B = WALLS[b.wallId].plan; return (horiz ? A.a[0] + A.b[0] : A.a[1] + A.b[1]) - (horiz ? B.a[0] + B.b[0] : B.a[1] + B.b[1]); });
    const names = g.length === 2 ? (horiz ? ['levá', 'pravá'] : ['horní', 'dolní']) : g.map((_, i) => String(i + 1));
    g.forEach((sec, i) => { sec.name += ' ' + names[i]; });
  }
  for (const sec of SECTIONS) if (sec.kind === 'elev') { const w = WALLS[sec.wallId]; w.name = sec.name; }
  for (const w of PROJECT.walls) { if (!w.name) w.name = `Stěna ${w.orient}`; w.baseName = w.name; w.nameFull = w.name + (isMerged(w) ? ' (sloučeno)' : w.synthetic ? ' (schéma)' : ''); }
  for (const sec of SECTIONS) if (sec.kind === 'elev') sec.baseName = sec.name;
  const roomOrder = []; for (const sec of SECTIONS) if (sec.room && !roomOrder.includes(sec.room)) roomOrder.push(sec.room);
  SECTIONS.sort((a, b) => (a.isMain ? -1 : b.isMain ? 1 : 0) || (roomOrder.indexOf(a.room) - roomOrder.indexOf(b.room)) || ((a.kind === 'plan' ? 0 : 1) - (b.kind === 'plan' ? 0 : 1)));
})();
const SEC = dict(SECTIONS.map(s => [s.id, s]));
/* ---------- světové strany: report je neuvádí, sever se nastavuje jednou v ⚙ ---------- */
const COMPASS = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
const COMPASS_FULL = { S: 'sever', SV: 'severovýchod', V: 'východ', JV: 'jihovýchod', J: 'jih', JZ: 'jihozápad', Z: 'západ', SZ: 'severozápad' };
const northDeg = () => { const v = state.settings && state.settings.north; return Number.isFinite(v) ? ((v % 360) + 360) % 360 : 0; };
function dirCompass(dx, dy) {            // dx,dy ve výkresu (y roste dolů); 0° = nahoru
  const a = ((Math.atan2(dx, -dy) * 180 / Math.PI) - northDeg() + 720) % 360;
  return COMPASS[Math.round(a / 45) % 8];
}
function wallCompass(w) { return w.plan ? dirCompass(-w.plan.n[0], -w.plan.n[1]) : null; }
function applyNorth() {                  // jména stěn = poloha na výkrese + světová strana
  for (const w of PROJECT.walls) { const c = wallCompass(w); w.compass = c; w.name = w.baseName + (c ? ` (${c})` : ''); w.nameFull = w.name + (isMerged(w) ? ' (sloučeno)' : w.synthetic ? ' (schéma)' : ''); }
  for (const sec of SECTIONS) if (sec.kind === 'elev' && sec.baseName) { const w = WALLS[sec.wallId]; sec.name = w ? w.name : sec.baseName; }
}
const secOfWall = wid => SECTIONS.find(s => s.kind === 'elev' && s.wallId === wid);

/* ---------- wall references (corners, opening edges) ---------- */
function nearestWall(pt, maxDist, room) {
  let best = null;
  for (const w of PROJECT.walls) {
    if (!w.plan || w.hidden) continue; if (room && w.room !== room) continue;
    const f = footOnWall(w, pt); const side = (pt[0] - f.foot[0]) * w.plan.n[0] + (pt[1] - f.foot[1]) * w.plan.n[1];
    if (side < -2) continue;                       // wrong side of a shared wall
    if (f.dist < maxDist && (!best || f.dist < best.dist)) best = { w, u: f.t / PLAN.ppm, dist: f.dist };
  }
  return best;
}
function wallRefs(w) {
  const refs = [{ u: 0, what: 'roh' }, { u: w.lenM, what: 'roh' }];
  for (const o of w.openings) { const k = o.kind === 'door' ? 'dveře' : 'okno'; refs.push({ u: o.u0, what: k }); refs.push({ u: o.u1, what: k }); }
  return refs;
}
function refKey(r) { return r.what + ':' + r.u.toFixed(3); }
function refSide(r, w) { if (r.what === 'roh') return r.u < 0.001 ? 'L' : 'R'; const o = w.openings.find(o => Math.abs(o.u0 - r.u) < 1e-3 || Math.abs(o.u1 - r.u) < 1e-3); return o && Math.abs(o.u0 - r.u) < 1e-3 ? 'L' : 'R'; }
function refLabel(r, w) { const s = refSide(r, w); if (r.what === 'roh') return s === 'L' ? 'levý roh' : 'pravý roh'; return `${s === 'L' ? 'levá' : 'pravá'} hrana ${r.what === 'dveře' ? 'dveří' : 'okna'}`; }
function refLabelGen(r, w) { const s = refSide(r, w); if (r.what === 'roh') return s === 'L' ? 'levého rohu' : 'pravého rohu'; return `${s === 'L' ? 'levé' : 'pravé'} hrany ${r.what === 'dveře' ? 'dveří' : 'okna'}`; }
function nearestRef(w, u, e) {
  const refs = wallRefs(w);
  if (e && e.refKey) { const r = refs.find(x => refKey(x) === e.refKey); if (r) return { ...r, d: Math.abs(u - r.u) }; }
  let b = null; for (const r of refs) { const d = Math.abs(u - r.u); if (!b || d < b.d) b = { ...r, d }; } return b;
}
function openingAt(w, u, h) { return w.openings.find(o => u >= o.u0 - 1e-6 && u <= o.u1 + 1e-6 && h >= o.h0 - 1e-6 && h <= o.h1 + 1e-6) || null; }
function elemPlanPos(e) { if (e.wallId) return planPoint(WALLS[e.wallId], e.u); return [e.x, e.y]; }
// dims for free elements: nearest vertical & horizontal wall of the element's room on the interior side (covering the point; else nearest).
// Low walls (railing height, no elevation) remain usable as drawn position references; in low/bbox rooms the side test is relaxed and the dim is flagged as an estimate.
function freeDims(p, e) {
  const out = []; const room = e && e.room; const Rm = room ? ROOMS[room] : null; const estimate = !!(Rm && (Rm.low || Rm.polygonSource === 'bbox'));
  for (const axis of [0, 1]) {
    const chosen = e && (axis === 0 ? e.refX : e.refY) && WALLS[axis === 0 ? e.refX : e.refY];
    if (chosen && chosen.plan) { out.push({ axis, w: chosen, dist: Math.abs(p[axis] - chosen.plan.a[axis]), at: chosen.plan.a[axis], covers: true, estimate }); continue; }
    let best = null, fallback = null;
    for (const w of PROJECT.walls) {
      if (!w.plan) continue; if (room ? w.room !== room : w.hidden) continue; if (wallAxis(w) !== axis) continue;
      const n = w.plan.n; if (!estimate && (p[axis] - w.plan.a[axis]) * n[axis] < 0) continue;
      const dist = Math.abs(p[axis] - w.plan.a[axis]); const o = 1 - axis; const lo = Math.min(w.plan.a[o], w.plan.b[o]), hi = Math.max(w.plan.a[o], w.plan.b[o]);
      if (p[o] >= lo - 1 && p[o] <= hi + 1) { if (!best || dist < best.dist) best = { w, dist, at: w.plan.a[axis], covers: true, estimate }; }
      else if (!fallback || dist < fallback.dist) fallback = { w, dist, at: w.plan.a[axis], covers: false, estimate };
    }
    const pick = best || fallback; if (pick) out.push({ axis, ...pick });
  }
  return out;
}

/* ---------- state, content hash, revision ---------- */
const STATUSES = ['navrh', 'overeno', 'schvaleno']; const STATUS_CS = { navrh: 'návrh', overeno: 'ověřeno', schvaleno: 'schváleno' };
const DIM_STYLES = ['chain', 'chainTag', 'each'];
function freshMeta() { return { rev: 0, revHash: null, status: 'navrh', author: '', updatedAt: null }; }
function freshSettings() { return { heights: {}, dimStyle: 'chain', mainPlanDims: false, north: 0 }; }
let state = { elements: [], settings: freshSettings(), meta: freshMeta() };
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const ELEM_KEYS = ['id', 'type', 'wallId', 'room', 'u', 'h', 'x', 'y', 'count', 'label', 'note', 'refKey', 'refX', 'refY', 'hSource', 'controls'];
const SWITCH_TYPES = SYMBOLS.filter(x => x.cat === 'Spínače').map(x => x.id);   // co může něco ovládat
const isSwitch = t => SWITCH_TYPES.includes(t);
const LIM_LINKS = 16;
const controlsOf = e => Array.isArray(e && e.controls) ? e.controls : [];
const controllersOf = id => state.elements.filter(x => controlsOf(x).includes(id));
function pruneLinks(reason) {          // zahodit napojení na prvky, které už neexistují
  const ids = new Set(state.elements.map(e => e.id)); let n = 0;
  for (const e of state.elements) {
    if (!controlsOf(e).length) continue;
    const keep = controlsOf(e).filter(id => ids.has(id) && id !== e.id);
    if (keep.length !== controlsOf(e).length) { n += controlsOf(e).length - keep.length; if (keep.length) e.controls = keep; else delete e.controls; }
  }
  if (n && reason) toast(`Zrušeno ${n} napojení na smazané prvky`);
  return n;
}
function normElem(e) {
  const o = {};
  for (const k of ELEM_KEYS) { let v = e[k]; if (v === undefined || (v === null && k !== 'wallId')) continue; if (typeof v === 'number') v = Math.round(v * 1e6) / 1e6; o[k] = v; }
  if (o.wallId === undefined) o.wallId = null; if (o.count === undefined) o.count = 1; if (o.note === undefined) o.note = '';
  if (Array.isArray(o.controls)) { const c = [...new Set(o.controls)].sort(); if (c.length) o.controls = c; else delete o.controls; }
  return o;
}
function canonicalContent(st = state) {
  const els = st.elements.map(normElem).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const hs = {}; const src = (st.settings && st.settings.heights) || {}; for (const k of Object.keys(src).sort()) if (isNum(src[k])) hs[k] = src[k];
  return { elements: els, heights: hs, dimStyle: (st.settings && st.settings.dimStyle) || 'chain', mainPlanDims: !!(st.settings && st.settings.mainPlanDims), north: (st.settings && Number.isFinite(st.settings.north)) ? st.settings.north : 0 };
}
function contentHash(st = state) { return cyrb53(JSON.stringify(canonicalContent(st))).toString(16).padStart(14, '0'); }

/* ---------- validation – the single gate for every mutation path (edit, drag, placement, import, restore) ---------- */
const H_SOURCES = ['default', 'room', 'manual'];
function validateElement(raw) {
  const errors = [], warnings = []; const err = (k, m) => errors.push({ path: k, msg: m }); const warn = m => warnings.push(m);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { err('', 'prvek není objekt'); return { errors, warnings, value: null }; }
  const e = {};
  if (!isStr(raw.id) || !/^[A-Za-z0-9_-]{1,40}$/.test(raw.id)) err('id', 'chybí platné id prvku'); else e.id = raw.id;
  if (!isStr(raw.type) || !SYM[raw.type]) err('type', `neznámý typ prvku „${raw.type}“`); else e.type = raw.type;
  const label = isStr(raw.label) ? raw.label.trim() : ''; if (!label) err('label', 'chybí označení'); else if (label.length > LIM.maxLabel) err('label', `označení je delší než ${LIM.maxLabel} znaků`); else e.label = label;
  if (raw.note !== undefined && raw.note !== null && !isStr(raw.note)) err('note', 'poznámka musí být text'); else { e.note = isStr(raw.note) ? raw.note : ''; if (e.note.length > LIM.maxNote) err('note', `poznámka je delší než ${LIM.maxNote} znaků`); }
  const cnt = (raw.count === undefined || raw.count === null) ? 1 : raw.count; if (!Number.isInteger(cnt) || cnt < 1 || cnt > LIM.maxCount) err('count', `počet musí být celé číslo 1–${LIM.maxCount}`); else e.count = cnt;
  if (raw.hSource !== undefined && raw.hSource !== null) { if (!H_SOURCES.includes(raw.hSource)) err('hSource', 'neznámý zdroj výšky'); else e.hSource = raw.hSource; }
  if (raw.controls !== undefined && raw.controls !== null) {
    if (!Array.isArray(raw.controls)) err('controls', 'napojení musí být seznam');
    else if (raw.controls.length > LIM_LINKS) err('controls', `nejvýš ${LIM_LINKS} napojených prvků`);
    else if (raw.controls.some(x => !isStr(x) || !/^[A-Za-z0-9_-]{1,40}$/.test(x))) err('controls', 'napojení obsahuje neplatné id prvku');
    else if (raw.id && raw.controls.includes(raw.id)) err('controls', 'prvek nemůže ovládat sám sebe');
    else if (raw.controls.length && raw.type && !isSwitch(raw.type)) err('controls', 'napojení na prvky může mít jen spínač (vypínač, tlačítko, stmívač)');
    else if (raw.controls.length) e.controls = [...new Set(raw.controls)];
  }
  const room = raw.room; const Rm = isStr(room) ? ROOMS[room] : null; if (!Rm) err('room', `neznámá místnost „${room}“`); else e.room = room;
  if (raw.wallId !== null && raw.wallId !== undefined) {
    const w = isStr(raw.wallId) ? WALLS[raw.wallId] : null;
    if (!w) err('wallId', `stěna „${raw.wallId}“ v tomto projektu neexistuje`);
    else if (w.hidden) err('wallId', `stěna ${w.id} není v editoru dostupná (nízká místnost)`);
    else {
      e.wallId = w.id;
      if (Rm && w.room !== room) err('room', `stěna ${w.id} (${w.nameFull}) patří do místnosti ${roomCs(w.room)}, ne ${roomCs(room)}`);
      if (!isNum(raw.u)) err('u', 'poloha na stěně musí být konečné číslo'); else if (raw.u < -1e-6 || raw.u > w.lenM + 1e-6) err('u', `poloha ${fmtMm(raw.u)} je mimo délku stěny (0–${fmtMm(w.lenM)})`); else e.u = Math.min(w.lenM, Math.max(0, raw.u));
      if (!isNum(raw.h)) err('h', 'výška musí být konečné číslo'); else if (raw.h < -1e-6 || raw.h > w.chM + 1e-6) err('h', `výška ${fmtMm(raw.h)} je mimo výšku stěny (0–${fmtMm(w.chM)})`); else e.h = Math.min(w.chM, Math.max(0, raw.h));
      if (raw.refKey !== undefined && raw.refKey !== null) { if (!isStr(raw.refKey) || !wallRefs(w).some(r => refKey(r) === raw.refKey)) err('refKey', `reference „${raw.refKey}“ na stěně ${w.id} neexistuje`); else e.refKey = raw.refKey; }
      if (e.u !== undefined && e.h !== undefined) { const o = openingAt(w, e.u, e.h); if (o) warn(`prvek leží v otvoru (${o.kind === 'door' ? 'dveře' : 'okno'} ${mm(o.u0)}–${mm(o.u1)} mm)`); }
      if (isMerged(w)) warn('stěna je ' + MERGED_NOTE + ' – rozměry z reportu, kresba schematická'); else if (w.synthetic) warn('stěna je ' + SCHEMA_NOTE + ' – rozměry orientační');
      if (Rm && isNum(Rm.ceilingM) && Rm.wallHeightMismatch.includes(w.id)) warn(`výška stěny ${fmtMm(w.chM)} ≠ výška stropu místnosti ${fmtMm(Rm.ceilingM)} podle reportu`);
    }
  } else {
    e.wallId = null;
    if (!isNum(raw.x) || !isNum(raw.y)) err('x', 'volný prvek musí mít souřadnice x, y (konečná čísla)');
    else if (Rm) {
      if (!Rm.polygon) err('room', `místnost ${roomCs(room)} nemá půdorys`);
      else if (!(pointInPoly([raw.x, raw.y], Rm.polygon) || distToPoly([raw.x, raw.y], Rm.polygon) <= LIM.polyTol)) err('x', `bod leží mimo půdorys místnosti ${roomCs(room)}`);
      else { e.x = raw.x; e.y = raw.y; if (Rm.polygonSource === 'bbox') warn('půdorys místnosti je jen odhad (obdélník kolem stěn)'); }
    }
    if (!isNum(raw.h)) err('h', 'výška musí být konečné číslo');
    else if (raw.h <= 0 || raw.h > LIM.maxFreeH) err('h', `výška ${fmtMm(raw.h)} je mimo technický rozsah (0–${LIM.maxFreeH * 1000} mm)`);
    else {
      e.h = raw.h;
      if (Rm) {
        if (Rm.low) warn('podklad uvádí u místnosti jen nízké stěny (může jít o zábradlí/parapet, fyzicky neověřeno) – pohledy stěn nejsou k dispozici, polohy vůči čarám půdorysu jsou odhad');
        if (!Rm.ceilingUncertain && isNum(Rm.ceilingM) && raw.h > Rm.ceilingM + 0.005) err('h', `výška ${fmtMm(raw.h)} je nad stropem místnosti (${fmtMm(Rm.ceilingM)} podle reportu)`);
        if (Rm.ceilingUncertain) warn('výška stropu místnosti není ověřena' + (Rm.ceilingReason ? ` (${Rm.ceilingReason})` : ''));
        if (raw.hSource === 'manual') warn('výška zadána ručně, neověřeno na stavbě');
      }
    }
    for (const k of ['refX', 'refY']) if (raw[k] !== undefined && raw[k] !== null) {
      const w = isStr(raw[k]) ? WALLS[raw[k]] : null;
      if (!w || !w.plan || w.hidden) err(k, `referenční stěna „${raw[k]}“ neexistuje`);
      else if (w.room !== room) err(k, `referenční stěna ${w.id} není v místnosti ${roomCs(room)}`);
      else if (wallAxis(w) !== (k === 'refX' ? 0 : 1)) err(k, `referenční stěna ${w.id} nemá pro tento směr správnou orientaci`);
      else e[k] = w.id;
    }
  }
  return { errors, warnings, value: errors.length ? null : e };
}
const elemWarnings = e => validateElement(e).warnings;
function validateSettings(raw) {
  const errors = []; const value = freshSettings(); if (raw === undefined || raw === null) return { errors, value };
  if (typeof raw !== 'object' || Array.isArray(raw)) { errors.push({ path: 'settings', msg: 'nastavení musí být objekt' }); return { errors, value }; }
  if (raw.heights !== undefined && raw.heights !== null) {
    if (typeof raw.heights !== 'object' || Array.isArray(raw.heights)) errors.push({ path: 'settings.heights', msg: 'výšky musí být objekt' });
    else for (const [k, v] of Object.entries(raw.heights)) { if (!SYM[k]) errors.push({ path: 'settings.heights.' + k, msg: `neznámý typ prvku „${k}“ v nastavení výšek` }); else if (!isNum(v) || v < 0 || v > 6000) errors.push({ path: 'settings.heights.' + k, msg: `výška pro ${SYM[k].name} musí být číslo 0–6000 mm` }); else value.heights[k] = v; }
  }
  if (raw.dimStyle !== undefined && raw.dimStyle !== null) { if (!DIM_STYLES.includes(raw.dimStyle)) errors.push({ path: 'settings.dimStyle', msg: `neznámý styl kót „${raw.dimStyle}“` }); else value.dimStyle = raw.dimStyle; }
  if (raw.mainPlanDims !== undefined && raw.mainPlanDims !== null) { if (typeof raw.mainPlanDims !== 'boolean') errors.push({ path: 'settings.mainPlanDims', msg: 'mainPlanDims musí být true/false' }); else value.mainPlanDims = raw.mainPlanDims; }
  if (raw.north !== undefined && raw.north !== null) { if (!Number.isFinite(raw.north) || raw.north < 0 || raw.north >= 360) errors.push({ path: 'settings.north', msg: 'sever musí být úhel 0–359°' }); else value.north = Math.round(raw.north); }
  return { errors, value };
}
function validateMeta(raw) {
  const errors = []; const value = freshMeta(); if (raw === undefined || raw === null) return { errors, value };
  if (typeof raw !== 'object' || Array.isArray(raw)) { errors.push({ path: 'meta', msg: 'meta musí být objekt' }); return { errors, value }; }
  if (raw.rev !== undefined) { if (!Number.isInteger(raw.rev) || raw.rev < 0 || raw.rev > 1e6) errors.push({ path: 'meta.rev', msg: 'revize musí být celé nezáporné číslo' }); else value.rev = raw.rev; }
  if (raw.status !== undefined) { if (!STATUSES.includes(raw.status)) errors.push({ path: 'meta.status', msg: `neznámý stav „${raw.status}“` }); else value.status = raw.status; }
  if (raw.author !== undefined && raw.author !== null) { if (!isStr(raw.author) || raw.author.length > LIM.maxAuthor) errors.push({ path: 'meta.author', msg: 'autor musí být text do 60 znaků' }); else value.author = raw.author.trim(); }
  if (raw.updatedAt !== undefined && raw.updatedAt !== null) { if (!isStr(raw.updatedAt)) errors.push({ path: 'meta.updatedAt', msg: 'updatedAt musí být text' }); else value.updatedAt = raw.updatedAt; }
  if (raw.revHash !== undefined && raw.revHash !== null) { if (!isStr(raw.revHash)) errors.push({ path: 'meta.revHash', msg: 'revHash musí být text' }); else value.revHash = raw.revHash; }
  return { errors, value };
}
function validateProjectFile(j, opts = {}) {
  const errors = [], warnings = []; const info = { format: null, legacy: false, projectRef: null };
  const bad = (path, msg) => errors.push({ path, msg });
  if (!j || typeof j !== 'object' || Array.isArray(j)) { bad('', 'soubor neobsahuje objekt projektu'); return { ok: false, errors, warnings, info, value: null }; }
  const hasFormat = j.format !== undefined, hasSchema = j.schemaVersion !== undefined;
  if (hasFormat && j.format !== FORMAT) bad('format', `neznámý formát souboru „${j.format}“`);
  if (hasSchema && !Number.isInteger(j.schemaVersion)) bad('schemaVersion', 'schemaVersion musí být celé číslo');
  const isV3 = j.format === FORMAT && j.schemaVersion === SCHEMA_VERSION;   // new format: exact format AND exact supported schema version
  if (isV3) {
    info.format = 'v3'; const p = j.project;
    if (!p || typeof p !== 'object') bad('project', 'chybí identifikace zakázky (project.jobId, project.geomFp)');
    else {
      info.projectRef = { jobId: p.jobId, geomFp: p.geomFp, title: p.title };
      if (!JOB_ID || !GEOM_FP) bad('project', 'tento editor nemá identitu zakázky (starý build) – import v3 není možný');
      else {
        if (p.jobId !== JOB_ID) bad('project.jobId', `soubor patří jiné zakázce („${p.jobId}“), tento editor je zakázka „${JOB_ID}“`);
        if (p.geomFp !== GEOM_FP) bad('project.geomFp', `geometrie podkladu se liší (soubor ${p.geomFp || '–'}, tento editor ${GEOM_FP}) – polohy prvků by neseděly, import není možný`);
      }
    }
  } else if (!hasFormat && !hasSchema) {   // legacy v2.1 backup: {project: <slug>, elements, settings} – identity only via the explicit historical alias list
    info.format = 'legacy'; info.legacy = true; const slug = j.project; info.projectRef = { slug };
    if (!isStr(slug)) bad('project', 'starší záloha bez označení projektu – nelze ověřit, že patří k této zakázce');
    else if (!LEGACY_ALIASES.includes(slug)) bad('project', `starší záloha projektu „${slug}“ není v seznamu doložených starších názvů této zakázky (${LEGACY_ALIASES.length ? LEGACY_ALIASES.join(', ') : 'žádné'})`);
    if (!opts.legacyConfirmed) bad('confirm', 'starší formát (v2.1) bez otisku geometrie – potvrď zaškrtnutím, že jde o zálohu této zakázky');
  } else {
    info.format = 'unsupported';
    if (Number.isInteger(j.schemaVersion) && j.schemaVersion > SCHEMA_VERSION) bad('schemaVersion', `soubor je z novější verze editoru (schéma ${j.schemaVersion}, tento editor ${SCHEMA_VERSION}) – otevři ho v novější verzi`);
    else bad('format', `nepodporovaná kombinace formátu a verze (format ${hasFormat ? '„' + j.format + '“' : '–'}, schemaVersion ${hasSchema ? j.schemaVersion : '–'}); podporováno: „${FORMAT}“ se schématem ${SCHEMA_VERSION}, nebo starší záloha v2.1 bez těchto polí`);
  }
  if (!Array.isArray(j.elements)) bad('elements', 'chybí seznam prvků (elements)');
  const elements = []; const ids = new Set(), labels = new Set();
  if (Array.isArray(j.elements)) {
    if (j.elements.length > LIM.maxElements) bad('elements', `příliš mnoho prvků (${j.elements.length})`);
    j.elements.forEach((raw, i) => {
      const r = validateElement(raw); const tag = raw && isStr(raw.label) && raw.label ? raw.label : `#${i + 1}`;
      for (const er of r.errors) errors.push({ path: `elements[${i}]${er.path ? '.' + er.path : ''}`, msg: `${tag}: ${er.msg}` });
      for (const wm of r.warnings) warnings.push(`${tag}: ${wm}`);
      if (r.value) {
        if (ids.has(r.value.id)) bad(`elements[${i}].id`, `${tag}: duplicitní id „${r.value.id}“`); ids.add(r.value.id);
        const lk = r.value.label.toLowerCase(); if (labels.has(lk)) bad(`elements[${i}].label`, `duplicitní označení „${r.value.label}“`); labels.add(lk);
        elements.push(r.value);
      }
    });
  }
  const s = validateSettings(j.settings); errors.push(...s.errors);
  const m = validateMeta(isV3 ? j.meta : null); errors.push(...m.errors);
  const ok = errors.length === 0;
  return { ok, errors, warnings, info, value: ok ? { elements, settings: s.value, meta: m.value } : null };
}
function diffAgainstState(next) {
  const cur = new Map(state.elements.map(e => [e.id, JSON.stringify(normElem(e))])); const nxt = new Map(next.elements.map(e => [e.id, JSON.stringify(normElem(e))]));
  const added = [], removed = [], changed = [];
  for (const e of next.elements) { const k = nxt.get(e.id); if (!cur.has(e.id)) added.push(e.label); else if (cur.get(e.id) !== k) changed.push(e.label); }
  for (const e of state.elements) if (!nxt.has(e.id)) removed.push(e.label);
  const settingsChanged = JSON.stringify(canonicalContent({ elements: [], settings: state.settings })) !== JSON.stringify(canonicalContent({ elements: [], settings: next.settings }));
  return { added, removed, changed, settingsChanged, before: state.elements.length, after: next.elements.length };
}

/* ---------- undo / labels / helpers ---------- */
let undoStack = [], redoStack = [];
let cur = SECTIONS.find(s => s.isMain) || SECTIONS[0];
let tool = null;          // symbol id being placed
let selId = null;
let view = null;          // {x,y,w,h} viewBox
let showLabels = true, showDims = true, dimStyle = 'chain', navOpen = {};
const uid = () => Math.random().toString(36).slice(2, 9);
const round1 = v => Math.round(v * 10) / 10, round2 = v => Math.round(v * 100) / 100, round3 = v => Math.round(v * 1000) / 1000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const parseNum = s => { if (typeof s === 'number') return s; const t = String(s ?? '').trim().replace(',', '.').replace(/\s+/g, ''); if (!t) return NaN; const v = Number(t); return Number.isFinite(v) ? v : NaN; };
const defH = sid => { const v = +(state.settings.heights || {})[sid]; return Number.isFinite(v) && v >= 0 ? v : SYM[sid].h; };
function snapshot() { undoStack.push(JSON.stringify(state.elements)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(state.elements)); state.elements = JSON.parse(undoStack.pop()); selId = null; commit(); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(state.elements)); state.elements = JSON.parse(redoStack.pop()); selId = null; commit(); }
function nextLabel(sid) {
  const pref = SYM[sid].pref; let n = 0;
  for (const e of state.elements) { const m = /^([A-ZŽ]+)(\d+)$/.exec(e.label || ''); if (m && m[1] === pref) n = Math.max(n, +m[2]); }
  return pref + (n + 1);
}
const labelTaken = (label, exceptId) => state.elements.some(x => x.id !== exceptId && (x.label || '').toLowerCase() === String(label).toLowerCase());

/* ---------- drawing primitives -> SVG ---------- */
const DIM_FONT = 'ui-monospace, Menlo, Consolas, monospace', LBL_FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';
function drawOps(ops, origin, ex, ey, color, sw = 0.75) {
  const T = ([x, y]) => [origin[0] + x * ex[0] + y * ey[0], origin[1] + x * ex[1] + y * ey[1]];
  let s = '';
  for (const o of ops) {
    if (o.op === 'line') { const [a, b] = o.p.map(T); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`; }
    else if (o.op === 'circle') { const c = T(o.c); s += `<circle cx="${c[0]}" cy="${c[1]}" r="${o.r}" fill="${o.fill ? color : 'none'}" stroke="${color}" stroke-width="${sw}"/>`; }
    else if (o.op === 'poly') { const pts = o.pts.map(T).map(p => p.join(',')).join(' '); s += o.close ? `<polygon points="${pts}" fill="${o.fill ? color : 'none'}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>` : `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`; }
    else if (o.op === 'text') { const p = T([o.x, o.y]); s += `<text x="${p[0]}" y="${p[1]}" font-size="${o.size}" font-family="${DIM_FONT}" font-weight="500" fill="${color}" text-anchor="${o.anchor || 'start'}" dominant-baseline="middle">${esc(o.s)}</text>`; }
  }
  return s;
}
function primsSVG(prims, colDim) {
  let s = '';
  for (const p of prims) {
    if (p.kind === 'dim') s += dimSVG(p.a, p.b, p.text, colDim, p.off, T_DIM, p.lift || 0, p.slide || 0);
    else if (p.kind === 'witness') s += `<line x1="${p.a[0]}" y1="${p.a[1]}" x2="${p.b[0]}" y2="${p.b[1]}" stroke="${colDim}" stroke-width="0.3"/>`;
    else if (p.kind === 'level') { const right = p.side === 'R'; s += `<line x1="${p.a[0]}" y1="${p.a[1]}" x2="${p.b[0]}" y2="${p.b[1]}" stroke="${colDim}" stroke-width="0.3" stroke-dasharray="2 1.5" opacity=".8"/><text x="${right ? p.b[0] + 2.5 : p.a[0] - 2.5}" y="${p.a[1]}" font-size="${T_DIM}" font-family="${DIM_FONT}" fill="${colDim}" text-anchor="${right ? 'start' : 'end'}" dominant-baseline="middle">${esc(p.text)}</text>`; }
    else if (p.kind === 'tag') s += `<text x="${p.p[0]}" y="${p.p[1]}" font-size="${T_TAG}" font-family="${DIM_FONT}" fill="${colDim}" dominant-baseline="middle">${esc(p.text)}</text>`;
  }
  return s;
}
function dimSVG(a, b, text, color, offsetDir, size = 5.2, lift = 0, slide = 0) {
  const d = vnorm(vsub(b, a)); const n = [-d[1], d[0]]; const t = 1.8;
  const tickAt = p => `<line x1="${p[0] - (d[0] - n[0]) * t}" y1="${p[1] - (d[1] - n[1]) * t}" x2="${p[0] + (d[0] - n[0]) * t}" y2="${p[1] + (d[1] - n[1]) * t}" stroke="${color}" stroke-width="0.6"/>`;
  const o = 3.2 + lift; const mid = [(a[0] + b[0]) / 2 + offsetDir[0] * o + d[0] * slide, (a[1] + b[1]) / 2 + offsetDir[1] * o + d[1] * slide];
  const rot = Math.abs(d[0]) < 0.01 ? -90 : 0;
  const leader = (lift || slide) ? `<line x1="${(a[0] + b[0]) / 2 + d[0] * slide}" y1="${(a[1] + b[1]) / 2 + d[1] * slide}" x2="${mid[0] - offsetDir[0] * 2.8}" y2="${mid[1] - offsetDir[1] * 2.8}" stroke="${color}" stroke-width="0.3"/>` : '';
  return `<g class="dim"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="0.4"/>${tickAt(a)}${tickAt(b)}${leader}<text x="${mid[0]}" y="${mid[1]}" transform="rotate(${rot} ${mid[0]} ${mid[1]})" font-size="${size}" font-family="${DIM_FONT}" fill="${color}" text-anchor="middle" dominant-baseline="middle">${esc(text)}</text></g>`;
}


/* ---------- keeping the drawing readable on paper (ported from the 2. 9. project) ----------
   Nothing may print on top of anything else: a dimension number steps further out or slides along its line
   until it is clear, every element label takes the first free spot around its symbol (with a thin leader
   when it ends up further away), and elements stacked at one spot on a wall (socket + switch above it)
   are fanned out along the wall in plan. Text widths are estimated (0.62 em per character). */
const T_LBL = 5.4, T_DIM = 5.8, T_TAG = 5.2, T_CNT = 5.4, FAN_STEP = 2 * R + 0.8;
function fanOffsets(sec) {
  const out = {}, byWall = {};
  for (const e of state.elements) {
    const w = e.wallId && WALLS[e.wallId]; if (!w || !w.plan) continue;
    if (sec.room && e.room !== sec.room && w.room !== sec.room) continue;
    (byWall[e.wallId] = byWall[e.wallId] || []).push(e);
  }
  for (const wid in byWall) {
    const w = WALLS[wid], n = w.plan.n, ex = [-n[1], n[0]];
    const list = byWall[wid].map(e => { const q = toSec(sec, planPoint(w, e.u)); return { e, t: q[0] * ex[0] + q[1] * ex[1] }; }).sort((a, b) => (a.t - b.t) || (a.e.h - b.e.h));
    const t = list.map(o => o.t);
    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (let i = 0; i + 1 < t.length; i++) { const gap = t[i + 1] - t[i]; if (gap < FAN_STEP - 0.01) { const push = (FAN_STEP - gap) / 2; t[i] -= push; t[i + 1] += push; moved = true; } }
      if (!moved) break;
    }
    list.forEach((o, i) => { const d = t[i] - o.t; if (Math.abs(d) > 0.01) out[o.e.id] = [ex[0] * d, ex[1] * d]; });
  }
  return out;
}
const CHW = 0.62;
function tbox(x, y, text, size, anchor) { const w = String(text).length * size * CHW + 1.2, h = size * 1.3 + 0.6; return { x: anchor === 'end' ? x - w + 0.6 : anchor === 'middle' ? x - w / 2 : x - 0.6, y: y - size * 0.11 - h / 2, w, h }; }
function freeSpots(x, y) {
  return [[x + R + 1.5, y - R - 1, 'start'], [x - R - 1.5, y - R - 1, 'end'], [x + R + 1.5, y + R + 4, 'start'], [x - R - 1.5, y + R + 4, 'end'],
          [x, y - R - 5.5, 'middle'], [x, y + R + 8, 'middle'], [x + R + 1.5, y - R - 6.5, 'start'], [x - R - 1.5, y - R - 6.5, 'end'],
          [x + R + 9, y, 'start'], [x - R - 9, y, 'end'], [x + R + 1.5, y + R + 10, 'start'], [x - R - 1.5, y + R + 10, 'end'],
          [x, y - R - 11, 'middle'], [x, y + R + 13.5, 'middle'], [x + R + 15, y, 'start'], [x - R - 15, y, 'end']];
}
function layoutOverlay(sec, items, prims) {
  const k = sec.isMain ? 1.3 : 1; const fixed = [];
  for (const it of items) {
    const r = R * k + 0.5; fixed.push({ x: it.origin[0] - r, y: it.origin[1] - r, w: 2 * r, h: 2 * r });
    const ex = [it.ex[0] * k, it.ex[1] * k], ey = [it.ey[0] * k, it.ey[1] * k];
    for (const o of SYM[it.e.type].ops()) if (o.op === 'text') fixed.push(tbox(it.origin[0] + o.x * ex[0] + o.y * ey[0], it.origin[1] + o.x * ex[1] + o.y * ey[1], o.s, o.size, o.anchor || 'start'));
    if (it.e.count > 1) fixed.push(tbox(it.origin[0] + it.ex[0] * (R + 1.5) + it.ey[0] * 1.5, it.origin[1] + it.ex[1] * (R + 1.5) + it.ey[1] * 1.5, '×' + it.e.count, T_CNT, 'start'));
  }
  for (const p of prims) { if (p.kind === 'level') fixed.push(tbox(p.side === 'R' ? p.b[0] + 2.5 : p.a[0] - 2.5, p.a[1], p.text, T_DIM, p.side === 'R' ? 'start' : 'end')); /* štítky výšek řeší sazeč níž jako pohyblivé */ }
  for (const l of ROOM_LABELS) {                              // české názvy místností ve výkrese
    if (sec.page == null || l.page !== sec.page) continue;
    const lw = Math.max(l.x1 - l.x0, l.cs.length * l.size * 0.58) + 4;
    fixed.push({ x: (l.center ? (l.x0 + l.x1) / 2 - lw / 2 : l.x0 - 1) - 2, y: l.top - 5, w: lw + 4, h: (l.bottom - l.top) + 10 });
  }
  for (const b of northBoxes(sec)) fixed.push(b);              // růžice a písmena světových stran
  if (sec.synthetic && sec.kind === 'elev') {                 // vlastní kóty schematického pohledu
    const w = WALLS[sec.wallId], f = w.face;
    fixed.push(tbox((f[0] + f[2]) / 2, f[3] + 14 + 3.2, fmtM(w.lenM), 7, 'middle'));
    fixed.push({ x: f[0] - 30 - 8, y: (f[1] + f[3]) / 2 - 14, w: 16, h: 28 });
    for (const o of w.openings) fixed.push(tbox(f[0] + (o.u0 + o.u1) / 2 * w.ppm, f[1] - 6 - 3.2, fmtM(o.u1 - o.u0), 6, 'middle'));
    fixed.push({ x: f[0] - 2, y: f[1] - 32, w: 340, h: 24 });  // nadpis a poznámka nad pohledem
  }
  const area = (b, list) => { let a = 0; for (const q of list) { const ox = Math.min(b.x + b.w, q.x + q.w) - Math.max(b.x, q.x), oy = Math.min(b.y + b.h, q.y + q.h) - Math.max(b.y, q.y); if (ox > 0 && oy > 0) a += ox * oy; } return a; };
  const jobs = [];
  for (const it of items) {
    const txt = labelText(it.e); if (!txt) continue;
    jobs.push({ cands: (it.spots || [it.label]).map(sp => ({ box: tbox(sp[0], sp[1], txt, T_LBL, sp[2] || 'start'), use: () => { it.label = sp; const dx = sp[0] - it.origin[0], dy = sp[1] - it.origin[1], d = Math.hypot(dx, dy); it.leader = d > R + 11 ? [[it.origin[0] + dx / d * (R + 1.5), it.origin[1] + dy / d * (R + 1.5)], [sp[0] - dx / d * 2.2, sp[1] - dy / d * 2.2]] : null; } })) });
  }
  for (const p of prims.filter(q => q.kind === 'tag')) {
    const zx = p.p[0], zy = p.p[1];
    const kam = [[zx, zy], [zx, zy - 8], [zx, zy + 8], [zx + 10, zy - 4], [zx - (p.text.length * T_TAG * 0.62 + 2 * R + 6), zy], [zx, zy - 15], [zx, zy + 15]];
    jobs.push({ cands: kam.map(([x, y]) => ({ box: tbox(x, y, p.text, T_TAG, 'start'), use: () => { p.p = [x, y]; } })) });
  }
  const ownDims = sec.isMain && !state.settings.mainPlanDims && dimStyle !== 'each' ? [] : items.filter(it => dimStyle === 'each' || !it.e.wallId).flatMap(it => it.dims);
  for (const p of prims.filter(q => q.kind === 'dim').concat(ownDims)) {
    const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]); const dir = len > 0.01 ? [(p.b[0] - p.a[0]) / len, (p.b[1] - p.a[1]) / len] : [1, 0]; const vertical = Math.abs(dir[0]) < 0.01;
    const slides = len > 26 ? [0, len / 4, -len / 4, len / 3, -len / 3] : [0]; const cands = [];
    for (const lift of [0, 5.5, 11, 16.5, 22, 27.5, 33, 38.5]) for (const sl of slides) {
      const o = 3.2 + lift; const m = [(p.a[0] + p.b[0]) / 2 + p.off[0] * o + dir[0] * sl, (p.a[1] + p.b[1]) / 2 + p.off[1] * o + dir[1] * sl];
      let box = tbox(m[0], m[1], p.text, T_DIM, 'middle'); if (vertical) box = { x: m[0] - (T_DIM * 1.3 + 0.6) / 2, y: m[1] - box.w / 2, w: T_DIM * 1.3 + 0.6, h: box.w };
      cands.push({ box, use: () => { p.lift = lift; p.slide = sl; } });
    }
    jobs.push({ cands });
  }
  const chosen = new Array(jobs.length).fill(null);
  const place = i => { const others = []; for (let j = 0; j < chosen.length; j++) if (j !== i && chosen[j]) others.push(chosen[j].box); let best = null; for (const c of jobs[i].cands) { const bad = area(c.box, fixed) + area(c.box, others); if (!best || bad < best.bad) best = { c, bad }; if (!bad) break; } chosen[i] = { box: best.c.box, bad: best.bad }; best.c.use(); };
  for (let i = 0; i < jobs.length; i++) place(i);
  for (let pass = 0; pass < 3; pass++) { let stuck = 0; for (let i = 0; i < jobs.length; i++) if (chosen[i].bad > 0) { place(i); if (chosen[i].bad > 0) stuck++; } if (!stuck) break; }
}

/* ---------- overlay model: drawable items for a section ---------- */
function overlayItems(sec) {
  const items = [];
  if (sec.kind === 'elev') {
    const w = WALLS[sec.wallId]; const f = w.face;
    for (const e of state.elements) {
      if (e.wallId !== w.id) continue;
      const x = f[0] + e.u * w.ppm, y = f[3] - e.h * w.ppm;
      const it = { e, origin: [x, y], ex: [1, 0], ey: [0, -1], dims: [], spots: freeSpots(x, y), label: [x + R + 1.5, y - R - 1] };
      if (Math.min(f[3] - y, 999) > 0.5) it.dims.push({ a: [x - 9, f[3]], b: [x - 9, y], text: String(mm(e.h)), off: [-1, 0] });
      const ref = nearestRef(w, e.u, e);
      if (ref && ref.d > 0.004) { const rx = f[0] + ref.u * w.ppm; it.dims.push({ a: [rx, y + 9], b: [x, y + 9], text: String(mm(ref.d)), off: [0, 1], ref }); }
      items.push(it);
    }
  } else {
    const fan = fanOffsets(sec);
    for (const e of state.elements) {
      if (e.wallId && !WALLS[e.wallId]) continue;
      const p = elemPlanPos(e); if (!p || !isNum(p[0]) || !isNum(p[1])) continue;
      if (sec.room && e.room !== sec.room && !(e.wallId && WALLS[e.wallId].room === sec.room)) continue;
      const sp = toSec(sec, p); let ex, ey, dims = [];
      if (e.wallId) {
        const w = WALLS[e.wallId]; const n = w.plan.n; ey = [n[0], n[1]]; ex = [-n[1], n[0]];
        const ref = nearestRef(w, e.u, e);
        if (ref && ref.d > 0.004) { const rp = toSec(sec, planPoint(w, ref.u)); const off = 11; const a = [rp[0] + n[0] * off, rp[1] + n[1] * off], b = [sp[0] + n[0] * off, sp[1] + n[1] * off]; dims.push({ a, b, text: String(mm(ref.d)), off: [n[0], n[1]], ref }); }
        const vert = Math.abs(n[0]) > 0.5; const fo = fan[e.id] || [0, 0]; const op = [sp[0] + n[0] * 1.2 + fo[0], sp[1] + n[1] * 1.2 + fo[1]];
        const spots = [];   // every spot lies on the room side of the wall, further out or shifted along it
        for (const out of [R + 5.5, R + 12, R + 18.5, R + 25, R + 31.5, R + 39, R + 47]) for (const side of [0, 5.5, -5.5, 11, -11, 16.5, -16.5, 22, -22]) spots.push(vert ? [op[0] + n[0] * out, op[1] + 4.2 + side, n[0] > 0 ? 'start' : 'end'] : [op[0] + 2.2 + side, op[1] + n[1] * out, 'start']);
        if (sec.isMain) {                        // v celkovém přehledu smí popisek jako poslední možnost ven z místnosti (s odkazovou čárkou)
          for (const out of [-(R + 8), -(R + 15)]) for (const side of [0, 7, -7])
            spots.push(vert ? [op[0] + n[0] * out, op[1] + 4.2 + side, n[0] > 0 ? 'end' : 'start']
                            : [op[0] + 2.2 + side, op[1] + n[1] * out, 'start']);
        }
        items.push({ e, origin: op, ex, ey, dims, spots, label: spots[0] });
      } else {
        ex = [1, 0]; ey = [0, -1];
        for (const fd of freeDims(p, e)) { const q = fd.axis === 0 ? [fd.at, p[1]] : [p[0], fd.at]; const a = toSec(sec, q), b = sp; const dist = fd.dist / PLAN.ppm; dims.push({ a, b, text: String(mm(dist)), off: fd.axis === 0 ? [0, -1] : [1, 0] }); }
        items.push({ e, origin: sp, ex, ey, dims, spots: freeSpots(sp[0], sp[1]), label: [sp[0] + R + 1.5, sp[1] - R - 1] });
      }
    }
  }
  return items;
}

/* ---------- section dims: chain + levels ---------- */
function chainSegments(us) { const u = [...us].sort((a, b) => a - b); const uniq = []; for (const x of u) if (!uniq.length || x - uniq[uniq.length - 1] > 0.004) uniq.push(x); return uniq; }
function chainRefs(w, elemUs) { let st = [0, w.lenM]; for (const o of w.openings) for (const u of [o.u0, o.u1]) if (st.every(x => Math.abs(x - u) > 0.12)) st.push(u); return chainSegments([...st, ...elemUs]); }
function sectionDims(sec) {
  const out = []; if (!showDims) return out;
  if (sec.kind === 'elev') {
    const w = WALLS[sec.wallId], f = w.face; const els = state.elements.filter(e => e.wallId === w.id); if (!els.length) return out;
    if (dimStyle !== 'each') {
      const y = f[3] - 6.5; const uniq = chainRefs(w, els.map(e => e.u));
      for (const e of els) { const x = f[0] + e.u * w.ppm, ye = f[3] - e.h * w.ppm; if (ye < y - R - 2) out.push({ kind: 'witness', a: [x, ye + R + 1], b: [x, y + 1.5] }); }
      let lifted = false;
      for (let i = 0; i + 1 < uniq.length; i++) { const a = [f[0] + uniq[i] * w.ppm, y], b = [f[0] + uniq[i + 1] * w.ppm, y]; const text = String(mm(uniq[i + 1] - uniq[i])); const narrow = (b[0] - a[0]) < text.length * 3.1 + 2; const lift = narrow ? (lifted ? 11 : 5.5) : 0; lifted = narrow && !lifted; out.push({ kind: 'dim', a, b, text, off: [0, -1], lift }); }
      if (dimStyle === 'chain') { const hs = chainSegments(els.map(e => e.h)); let prevY = -1e9, side = 'L'; for (const h of hs) { const yy = f[3] - h * w.ppm; side = (Math.abs(yy - prevY) < 7 && side === 'L') ? 'R' : 'L'; out.push({ kind: 'level', a: [f[0], yy], b: [f[2], yy], text: String(mm(h)), side }); prevY = yy; } }
      else { const placed = []; for (const e of [...els].sort((a, b) => a.u - b.u)) { const x = f[0] + e.u * w.ppm, ye = f[3] - e.h * w.ppm; if (placed.some(q => Math.abs(q[1] - ye) < 1 && x - q[0] < 20)) continue; placed.push([x, ye]); out.push({ kind: 'tag', p: [x + R + 1.2, ye + 4.2], text: '+' + mm(e.h) }); } }
    }
  } else {
    if (dimStyle === 'each') return out; if (sec.isMain && !state.settings.mainPlanDims) return out;
    const byWall = {};
    for (const e of state.elements) { if (!e.wallId || !WALLS[e.wallId]) continue; if (sec.room && e.room !== sec.room) continue; (byWall[e.wallId] = byWall[e.wallId] || []).push(e); }
    for (const wid in byWall) {
      const w = WALLS[wid]; if (!w.plan) continue; const n = w.plan.n; const off = sec.isMain ? 14 : 22;
      const P = u => { const p = toSec(sec, planPoint(w, u)); return [p[0] + n[0] * off, p[1] + n[1] * off]; };
      const uniq = chainRefs(w, byWall[wid].map(e => e.u));
      for (const e of byWall[wid]) { const p0 = toSec(sec, planPoint(w, e.u)); out.push({ kind: 'witness', a: [p0[0] + n[0] * (R + 2.5), p0[1] + n[1] * (R + 2.5)], b: [p0[0] + n[0] * (off + 1.5), p0[1] + n[1] * (off + 1.5)] }); }
      let lifted = false;
      for (let i = 0; i + 1 < uniq.length; i++) { const a = P(uniq[i]), b = P(uniq[i + 1]); const text = String(mm(uniq[i + 1] - uniq[i])); const narrow = vlen(vsub(b, a)) < text.length * 3.1 + 2; const lift = narrow ? (lifted ? 11 : 5.5) : 0; lifted = narrow && !lifted; out.push({ kind: 'dim', a, b, text, off: [n[0], n[1]], lift }); }
    }
  }
  return out;
}

/* ---------- Czech room labels over the English words of the report (same names as in the wall list) ---------- */
const ROOM_LABELS = (() => {
  const src = Array.isArray(PROJECT.roomLabels) ? PROJECT.roomLabels : []; const out = [];
  for (const l of src) {
    let room = null; const cx = (l.x0 + l.x1) / 2, cy = (l.top + l.bottom) / 2;
    if (l.page === PLAN.page) { for (const r of Object.values(ROOMS)) if (r.polygon && r.polygonSource !== 'bbox' && pointInPoly([cx, cy], r.polygon)) { room = r.name; break; } if (!room) for (const r of Object.values(ROOMS)) if (r.polygon && pointInPoly([cx, cy], r.polygon)) { room = r.name; break; } }
    else if (l.page === 0) continue;   // title page: the word is a table heading, not a room
    else { const pg = PROJECT.pages[l.page]; const sec = pg && pg.sections.find(s => l.top >= s.y0 - 8 && l.top < s.y1);
      if (sec) { room = sec.type === 'elevation' && WALLS[sec.wallId] ? WALLS[sec.wallId].room : sec.room;
        if (sec.type === 'plan' && !sec.affine) { // plan section without calibration keeps the raw name: take the neighbouring section's room of the same base name
          const seq = []; PROJECT.pages.forEach((pp, pi) => pp.sections.forEach(ss => seq.push({ pi, ss })));
          const k = seq.findIndex(q => q.pi === l.page && q.ss === sec); const base = n => (n || '').replace(/ \d+$/, '');
          for (const j of [k - 1, k + 1, k - 2, k + 2]) { const q = seq[j]; if (!q) continue; const rn = q.ss.type === 'elevation' && WALLS[q.ss.wallId] ? WALLS[q.ss.wallId].room : (q.ss.affine ? q.ss.room : null); if (rn && base(rn) === l.text) { room = rn; break; } }
        } } }
    const base = room && room.replace(/ \d+$/, '') === l.text ? room : l.text;   // keep the raw word when the section does not match
    out.push({ ...l, room, cs: roomCs(base), center: l.page === PLAN.page });
  }
  return out;
})();
const LBL_SANS = 'system-ui, -apple-system, Segoe UI, sans-serif';
function roomLabelsSVG(pageIdx) {
  let s = '';
  for (const l of ROOM_LABELS) {
    if (l.page !== pageIdx) continue; const size = l.size * 0.95; const w = Math.max(l.x1 - l.x0, l.cs.length * size * 0.58) + 4; const h = l.bottom - l.top + 2;
    const x = l.center ? (l.x0 + l.x1) / 2 - w / 2 : l.x0 - 1;
    s += `<rect x="${x}" y="${l.top - 1}" width="${w}" height="${h}" fill="${l.bg || '#FFFFFF'}"/><text x="${l.center ? (l.x0 + l.x1) / 2 : l.x0}" y="${l.bottom - (l.bottom - l.top) * 0.22}" font-size="${size}" font-family="${LBL_SANS}" fill="#1E2126" text-anchor="${l.center ? 'middle' : 'start'}">${esc(l.cs)}</text>`;
  }
  return s;
}

/* ---------- růžice a písmena světových stran (v okraji, mimo kresbu) ---------- */
function northLetters(sec) {           // písmena v okraji; uhnou popiskům místností posunem po hraně
  const bb = sec.bbox, m = 9;
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  const prekazky = ROOM_LABELS.filter(l => sec.page != null && l.page === sec.page).map(l => {
    const lw = Math.max(l.x1 - l.x0, l.cs.length * l.size * 0.58) + 4;
    return { x: (l.center ? (l.x0 + l.x1) / 2 - lw / 2 : l.x0 - 1) - 3, y: l.top - 4, w: lw + 6, h: (l.bottom - l.top) + 8 };
  });
  const volno = (x, y) => !prekazky.some(q => x - 6 < q.x + q.w && q.x < x + 6 && y - 5 < q.y + q.h && q.y < y + 5);
  const posuv = [0, 0.16, -0.16, 0.3, -0.3, 0.42, -0.42];
  const sirka = bb[2] - bb[0], vyska = bb[3] - bb[1];
  const najdi = (zx, zy, vodorovne) => {
    for (const k of posuv) { const x = zx + (vodorovne ? k * sirka : 0), y = zy + (vodorovne ? 0 : k * vyska); if (volno(x, y)) return [x, y]; }
    return [zx, zy];
  };
  return [[...najdi(cx, bb[1] + m, true), dirCompass(0, -1), 'middle'],
          [...najdi(cx, bb[3] - m, true), dirCompass(0, 1), 'middle'],
          [...najdi(bb[0] + m, cy, false), dirCompass(-1, 0), 'middle'],
          [...najdi(bb[2] - m, cy, false), dirCompass(1, 0), 'middle']];
}
function northBoxes(sec) {
  if (!sec || sec.kind !== 'plan') return [];
  const out = northLetters(sec).map(([x, y]) => ({ x: x - 6, y: y - 5, w: 12, h: 10 }));
  const bb = sec.bbox, m = 9, r = 7;
  out.push({ x: bb[2] - m * 1.6 - r - 3, y: bb[1] + m * 1.6 - r - 3, w: 2 * (r + 3), h: 2 * (r + 3) });
  return out;
}
function northSVG(sec) {
  if (!sec || sec.kind !== 'plan') return '';
  const bb = sec.bbox, gr = cssVar('--ink3', '#8B9097'), m = 9, f = 7;
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  const letters = northLetters(sec);
  let out = letters.map(([x, y, t, anch]) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${f}" font-family="${LBL_SANS}" font-weight="600" fill="${gr}" text-anchor="${anch}" dominant-baseline="middle" opacity=".75">${t}</text>`).join('');
  const r = 7, a = (northDeg() - 90) * Math.PI / 180, px = bb[2] - m * 1.6, py = bb[1] + m * 1.6;
  const tip = [px + Math.cos(a) * r, py + Math.sin(a) * r], tail = [px - Math.cos(a) * r * .75, py - Math.sin(a) * r * .75];
  const per = [-Math.sin(a) * r * .34, Math.cos(a) * r * .34];
  out += `<g opacity=".8"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r + 2.5).toFixed(1)}" fill="none" stroke="${gr}" stroke-width="0.4"/>`
    + `<polygon points="${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${(tail[0] + per[0]).toFixed(1)},${(tail[1] + per[1]).toFixed(1)} ${(tail[0] - per[0]).toFixed(1)},${(tail[1] - per[1]).toFixed(1)}" fill="${gr}"/>`
    + `<text x="${tip[0].toFixed(1)}" y="${(tip[1] - 3.6).toFixed(1)}" font-size="5.4" font-family="${LBL_SANS}" font-weight="700" fill="${gr}" text-anchor="middle">S</text></g>`;
  return out;
}

/* ---------- render canvas ---------- */
const svg = document.getElementById('svg');
const cssVar = (n, d) => { try { const v = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(n).trim() : ''; return v || d; } catch { return d; } };
const coarse = () => { try { return typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches; } catch { return false; } };
function fitView() { const b = cur.bbox; view = { x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] }; }
let hoverWall = null;
function render() {
  if (!view) fitView();
  const pg = cur.page != null ? PROJECT.pages[cur.page] : null;
  const selc = cssVar('--sel', '#1F5FBF'), dimc = cssVar('--dim', '#3D4A5C');
  let s = pg ? `<image href="${PAGES[pg.img] || ''}" x="0" y="0" width="${pg.w}" height="${pg.h}" image-rendering="optimizeQuality"/>` + roomLabelsSVG(cur.page) : synthBackground(WALLS[cur.wallId]);
  s += northSVG(cur);
  if (cur.kind === 'elev') {
    const w = WALLS[cur.wallId]; const f = w.face;
    s += `<rect class="hit" x="${f[0]}" y="${f[1]}" width="${f[2] - f[0]}" height="${f[3] - f[1]}" fill="rgba(31,95,191,0.03)" stroke="${selc}" stroke-width="0.5" stroke-dasharray="2 2"/>`;
    if (!cur.synthetic && w.miniRed && w.miniRed.length >= 2) for (let i = 0; i + 1 < w.miniRed.length; i += 2) { const a = w.miniRed[i], b = w.miniRed[i + 1]; s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#E0321B" stroke-width="2.2" stroke-linecap="round"/>`; }
    for (const o of w.openings) s += `<rect x="${f[0] + o.u0 * w.ppm}" y="${f[3] - o.h1 * w.ppm}" width="${(o.u1 - o.u0) * w.ppm}" height="${(o.h1 - o.h0) * w.ppm}" fill="none" stroke="${selc}" stroke-width="0.4" stroke-dasharray="1.5 1.5" opacity=".7"/>`;
  } else {
    for (const r of Object.values(ROOMS)) { // room outlines used for room assignment (faint)
      if (r.low || !r.polygon) continue; if (cur.room && r.name !== cur.room) continue;
      s += `<polygon points="${r.polygon.map(p => toSec(cur, p).join(',')).join(' ')}" fill="none" stroke="${selc}" stroke-width="${cur.isMain ? 0.6 : 1}" stroke-dasharray="${r.polygonSource === 'bbox' ? '1 2' : '3 2'}" opacity=".35"/>`;
    }
    for (const w of PROJECT.walls) {
      if (!w.plan || w.hidden) continue; if (cur.room && w.room !== cur.room) continue;
      const a = toSec(cur, w.plan.a), b = toSec(cur, w.plan.b);
      s += `<line class="wallhit" data-wall="${w.id}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${selc}" stroke-width="${cur.isMain ? 5 : 8}" opacity="${w.id === hoverWall ? .35 : .08}" stroke-linecap="butt"/>`;
    }
  }
  const overlay = overlayItems(cur), overlayPrims = sectionDims(cur); layoutOverlay(cur, overlay, overlayPrims);
  s += linksSVG(cur, overlay);
  for (const it of overlay) {
    const e = it.e; const sel = e.id === selId; const col = sel ? SEL_COL : symColor(e.type);
    s += `<g class="el" data-id="${e.id}" style="cursor:move">`;
    if (showDims && (dimStyle === 'each' || !e.wallId) && !(cur.isMain && !state.settings.mainPlanDims && dimStyle !== 'each')) for (const d of it.dims) s += dimSVG(d.a, d.b, d.text, sel ? SEL_COL : dimc, d.off, T_DIM, d.lift || 0, d.slide || 0);
    s += `<circle class="hit" cx="${it.origin[0]}" cy="${it.origin[1]}" r="${coarse() ? 14 : 10}" fill="transparent"/>`;
    if (sel) s += `<circle cx="${it.origin[0]}" cy="${it.origin[1]}" r="8" fill="none" stroke="${SEL_COL}" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>`;
    const k = cur.isMain ? 1.3 : 1; s += drawOps(SYM[e.type].ops(), it.origin, [it.ex[0] * k, it.ex[1] * k], [it.ey[0] * k, it.ey[1] * k], col);
    if (e.count > 1) s += `<text x="${it.origin[0] + it.ex[0] * (R + 1.5) + it.ey[0] * 1.5}" y="${it.origin[1] + it.ex[1] * (R + 1.5) + it.ey[1] * 1.5}" font-size="${T_CNT}" font-family="${DIM_FONT}" font-weight="500" fill="${col}" dominant-baseline="middle">×${e.count}</text>`;
    if (showLabels && it.leader) s += `<line x1="${it.leader[0][0]}" y1="${it.leader[0][1]}" x2="${it.leader[1][0]}" y2="${it.leader[1][1]}" stroke="${col}" stroke-width="0.3"/>`;
    if (showLabels) s += `<text x="${it.label[0]}" y="${it.label[1]}" font-size="${T_LBL}" font-family="${LBL_FONT}" font-weight="600" fill="${col}" text-anchor="${it.label[2] || 'start'}" dominant-baseline="middle">${esc(labelText(e))}</text>`;
    s += `</g>`;
  }
  s += primsSVG(overlayPrims, dimc);
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.innerHTML = s;
  svg.classList.toggle('placing', !!tool);
  renderInset();
  document.getElementById('emptyHint').hidden = !(state.elements.length === 0 && !tool);
}
function synthBackground(w) {
  const f = w.face; const g = '#8B9097';
  let s = `<rect x="0" y="0" width="595" height="842" fill="#FFFFFF"/>`;
  s += `<text x="${f[0]}" y="${f[1] - 26}" font-size="7.5" font-weight="600" font-family="${LBL_FONT}" fill="#1E2126">${esc(roomCs(w.room))} · ${esc(w.name || '')} · SCHÉMA</text>`;
  s += `<text x="${f[0]}" y="${f[1] - 15}" font-size="4.6" font-family="${LBL_FONT}" fill="${g}">${isMerged(w) ? `sloučený pohled – report kreslí tuto stěnu po částech (${w.mergedFrom.join(' + ')}), rozměry jsou z reportu` : `schéma stěny – odhad z půdorysu, report neobsahuje pohled`} · délka ${esc(fmtM(w.lenM))} · výška ${esc(fmtM(w.chM))}</text>`;
  s += `<rect x="${f[0]}" y="${f[1]}" width="${f[2] - f[0]}" height="${f[3] - f[1]}" fill="#F0F0F0" stroke="#3A3F47" stroke-width="0.8"/>`;
  s += `<line x1="${f[0] - 20}" y1="${f[3]}" x2="${f[2] + 20}" y2="${f[3]}" stroke="#3A3F47" stroke-width="1.2"/>`;
  for (const o of w.openings) { const x = f[0] + o.u0 * w.ppm, wd = (o.u1 - o.u0) * w.ppm, y1 = f[3] - o.h1 * w.ppm, y0 = f[3] - o.h0 * w.ppm; s += `<rect x="${x}" y="${y1}" width="${wd}" height="${y0 - y1}" fill="#FFFFFF" stroke="#3A3F47" stroke-width="0.7"/>`; if (o.kind === 'door') s += `<line x1="${x + wd * 0.82}" y1="${y1 + (y0 - y1) * 0.52}" x2="${x + wd * 0.82}" y2="${y1 + (y0 - y1) * 0.58}" stroke="#3A3F47" stroke-width="1.4"/>`; }
  s += dimSVG([f[0], f[3] + 14], [f[2], f[3] + 14], fmtM(w.lenM), g, [0, 1], 7);
  s += dimSVG([f[0] - 30, f[3]], [f[0] - 30, f[1]], fmtM(w.chM), g, [-1, 0], 7);
  for (const o of w.openings) s += dimSVG([f[0] + o.u0 * w.ppm, f[1] - 6], [f[0] + o.u1 * w.ppm, f[1] - 6], fmtM(o.u1 - o.u0), g, [0, -1], 6);
  return s;
}
function roomBBox(room) { const r = ROOMS[room]; if (r && r.polygon) return polyBBox(r.polygon); const ws = PROJECT.walls.filter(w => w.plan && w.room === room); if (!ws.length) return null; return polyBBox(ws.flatMap(w => [w.plan.a, w.plan.b])); }
function renderInset() {
  const box = document.getElementById('inset');
  if (cur.kind !== 'elev') { box.hidden = true; return; }
  const w = WALLS[cur.wallId];
  if (w.synthetic) {
    const pg = PROJECT.pages[PLAN.page]; const bb = roomBBox(w.room); if (!bb) { box.hidden = true; return; }
    const m = 40; const vb = [bb[0] - m, bb[1] - m, bb[2] - bb[0] + 2 * m, bb[3] - bb[1] + 2 * m];
    box.innerHTML = `<svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet"><image href="${PAGES[pg.img] || ''}" x="0" y="0" width="${pg.w}" height="${pg.h}"/>${roomLabelsSVG(PLAN.page)}<line x1="${w.plan.a[0]}" y1="${w.plan.a[1]}" x2="${w.plan.b[0]}" y2="${w.plan.b[1]}" stroke="#E0321B" stroke-width="4" stroke-linecap="round"/></svg>`;
    box.hidden = false; return;
  }
  const pg = PROJECT.pages[cur.page]; const mb = w.miniBox; if (!mb) { box.hidden = true; return; }
  const m = 6; const vb = [mb[0] - m, mb[1] - m, (mb[2] - mb[0]) + 2 * m, (mb[3] - mb[1]) + 2 * m]; let red = '';
  if (w.miniRed) for (let i = 0; i + 1 < w.miniRed.length; i += 2) { const a = w.miniRed[i], b = w.miniRed[i + 1]; red += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#E0321B" stroke-width="2.6" stroke-linecap="round"/>`; }
  box.innerHTML = `<svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet"><image href="${PAGES[pg.img] || ''}" x="0" y="0" width="${pg.w}" height="${pg.h}"/>${red}</svg>`;
  box.hidden = false;
}

/* ---------- mutations: every path goes through validateElement ---------- */
function addElement(e, opts = {}) {
  const v = validateElement(e);
  if (!v.value) { toast('Prvek nelze přidat: ' + v.errors[0].msg); return null; }
  if (labelTaken(v.value.label)) v.value.label = nextLabel(v.value.type);
  if (!opts.noSnapshot) snapshot();
  state.elements.push(v.value); selId = v.value.id;
  if (!opts.noCommit) commit();
  if (v.warnings.length && !opts.quiet) toast('⚠ ' + v.warnings[0]);
  return v.value;
}
function tryUpdate(e, patch, opts = {}) {
  const cand = { ...e, ...patch }; for (const k of Object.keys(patch)) if (patch[k] === undefined) delete cand[k];
  const v = validateElement(cand);
  if (!v.value) { toast('Neplatná hodnota, ponechána původní: ' + v.errors[0].msg); renderProps(); return false; }
  if (patch.label !== undefined && labelTaken(v.value.label, e.id)) { toast(`Označení „${v.value.label}“ už má jiný prvek – ponecháno původní`); renderProps(); return false; }
  snapshot(); for (const k of Object.keys(e)) if (!(k in v.value)) delete e[k]; Object.assign(e, v.value); commit();
  if (v.warnings.length && !opts.quiet) toast('⚠ ' + v.warnings[0]);
  return true;
}
function deleteSel() {
  if (!selId) return; const e = state.elements.find(x => x.id === selId); if (!e) { selId = null; return; }
  pushHistory('before-delete'); snapshot(); state.elements = state.elements.filter(x => x.id !== selId); selId = null; pruneLinks('smazani'); commit(); toast(`Smazáno ${e.label || ''} · Ctrl+Z vrátí zpět`);
}

/* ---------- napojení spínačů na prvky ---------- */
let linkMode = null;
function toggleLink(sw, id) {
  if (!sw || !isSwitch(sw.type) || id === sw.id) return false;
  const cur0 = controlsOf(sw); const next = cur0.includes(id) ? cur0.filter(x => x !== id) : [...cur0, id];
  const v = validateElement({ ...sw, controls: next });
  if (v.errors.length) { toast(v.errors[0].msg); return false; }
  snapshot(); if (next.length) sw.controls = next; else delete sw.controls;
  commit(); renderProps();
  const t = state.elements.find(x => x.id === id);
  toast(cur0.includes(id) ? `Zrušeno: ${labelText(sw)} → ${t ? labelText(t) : id}` : `Napojeno: ${labelText(sw)} → ${t ? labelText(t) : id}`);
  return true;
}
function linksSVG(sec, items) {            // čárkované spojnice spínač → ovládaný prvek (jen v půdorysu)
  if (sec.kind !== 'plan') return '';
  const kde = new Map(items.map(it => [it.e.id, it.origin]));
  let out = '';
  for (const it of items) {
    const e = it.e; if (!isSwitch(e.type)) continue;
    for (const id of controlsOf(e)) {
      const cíl = kde.get(id); if (!cíl) continue;
      const col = e.id === selId || id === selId ? SEL_COL : symColor(e.type);
      out += `<line x1="${it.origin[0].toFixed(1)}" y1="${it.origin[1].toFixed(1)}" x2="${cíl[0].toFixed(1)}" y2="${cíl[1].toFixed(1)}" stroke="${col}" stroke-width="0.45" stroke-dasharray="2.4 1.8" opacity=".85"/>`
        + `<circle cx="${cíl[0].toFixed(1)}" cy="${cíl[1].toFixed(1)}" r="1.1" fill="${col}" opacity=".85"/>`;
    }
  }
  return out;
}

/* ---------- pointer interaction (mouse, pen, touch incl. pinch) ---------- */
function svgPoint(ev) { const pt = new DOMPoint(ev.clientX, ev.clientY); const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; }
let drag = null; const pointers = new Map(); let pinch = null;
const setVB = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
svg.addEventListener('pointerdown', ev => {
  pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  try { svg.setPointerCapture(ev.pointerId); } catch { }
  if (pointers.size === 2) { if (drag && drag.el) { state.elements = JSON.parse(drag.before); render(); } drag = null; const [a, b] = [...pointers.values()]; pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), view0: { ...view }, mid0: svgPoint({ clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 }) }; return; }
  if (ev.button === 1 || (ev.button === 0 && ev.altKey && !tool) || ev.button === 2) { drag = { pan: true }; ev.preventDefault(); return; }
  if (ev.button !== 0) return;
  const p = svgPoint(ev); const g = ev.target.closest('.el');
  if (g && linkMode) { const sw = state.elements.find(x => x.id === linkMode); if (sw && g.dataset.id !== linkMode) { toggleLink(sw, g.dataset.id); ev.preventDefault(); return; } }
  if (g) { selId = g.dataset.id; const e = state.elements.find(x => x.id === selId); drag = { el: e, start: p, moved: false, before: JSON.stringify(state.elements), roomBefore: e && e.room, t0: Date.now() }; render(); renderProps(); return; }
  if (tool) { placeAt(p, ev); return; }
  selId = null; drag = { pan: true, tap: true, start: [ev.clientX, ev.clientY] }; render(); renderProps();
});
svg.addEventListener('pointermove', ev => {
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; const k = pinch.d0 / d;
    view.w = pinch.view0.w * k; view.h = pinch.view0.h * k;
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; const r = svg.getBoundingClientRect(); const sx = Math.min(r.width / view.w, r.height / view.h);
    const ox = (r.width - view.w * sx) / 2, oy = (r.height - view.h * sx) / 2;
    view.x = pinch.mid0[0] - (cx - r.left - ox) / sx; view.y = pinch.mid0[1] - (cy - r.top - oy) / sx; setVB(); return;
  }
  const p = svgPoint(ev); showPos(p);
  if (!drag) { if (cur.kind === 'plan' && tool && ev.pointerType === 'mouse') { const pp = fromSec(cur, p); const nw = nearestWall(pp, 14 / cur.affine[0], cur.room || roomAt(pp) || undefined); const id = nw ? nw.w.id : null; if (id !== hoverWall) { hoverWall = id; render(); } } return; }
  if (drag.pan) { const m = svg.getScreenCTM(); view.x -= (ev.movementX || 0) / m.a; view.y -= (ev.movementY || 0) / m.d; if (drag.tap && Math.hypot(ev.clientX - drag.start[0], ev.clientY - drag.start[1]) > 6) drag.tap = false; setVB(); return; }
  if (drag.el) { drag.moved = true; moveElementTo(drag.el, p, ev); render(); renderProps(); }
});
function endPointer(ev) {
  pointers.delete(ev.pointerId);
  if (pinch && pointers.size < 2) { pinch = null; drag = null; return; }
  if (drag && drag.el && drag.moved) {
    const v = validateElement(drag.el);
    if (!v.value) { state.elements = JSON.parse(drag.before); toast('Přesun zrušen: ' + v.errors[0].msg); render(); renderProps(); }
    else { Object.assign(drag.el, v.value); undoStack.push(drag.before); redoStack = []; if (drag.roomBefore && drag.roomBefore !== drag.el.room) toast(`Přesunuto do místnosti ${roomCs(drag.el.room)}`); commit(); }
  }
  drag = null;
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('lostpointercapture', ev => { if (!pointers.has(ev.pointerId)) return; endPointer(ev); });
svg.addEventListener('contextmenu', ev => { ev.preventDefault(); const g = ev.target.closest('.el'); if (g && ev.pointerType !== 'touch') { selId = g.dataset.id; deleteSel(); } });
window.addEventListener('blur', () => { if (drag && drag.el && drag.moved) { state.elements = JSON.parse(drag.before); toast('Přesun zrušen (okno ztratilo fokus)'); render(); renderProps(); } drag = null; pinch = null; pointers.clear(); });
svg.addEventListener('wheel', ev => { ev.preventDefault(); const p = svgPoint(ev); const k = ev.deltaY > 0 ? 1.12 : 1 / 1.12; view.x = p[0] - (p[0] - view.x) * k; view.y = p[1] - (p[1] - view.y) * k; view.w *= k; view.h *= k; setVB(); }, { passive: false });
function zoomBy(k) { const cx = view.x + view.w / 2, cy = view.y + view.h / 2; view.w *= k; view.h *= k; view.x = cx - view.w / 2; view.y = cy - view.h / 2; setVB(); }
document.getElementById('zoomIn').onclick = () => zoomBy(1 / 1.25);
document.getElementById('modeSelect').onclick = () => setTool(null);
document.getElementById('zoomOut').onclick = () => zoomBy(1.25);
document.getElementById('zoomFit').onclick = () => { fitView(); render(); };

function snapH(sid, hM, ev) { const d = defH(sid) / 1000; if (ev && ev.altKey) return Math.round(hM * 20) / 20; return Math.abs(hM - d) < 0.25 ? d : Math.round(hM * 20) / 20; }
/* ceiling height for free ceiling elements: from the room (report header = source datum). Unverified room → ask before adding. */
function roomCeilingH(room) { const r = ROOMS[room]; return r && !r.ceilingUncertain && isNum(r.ceilingM) ? r.ceilingM : null; }
let heightResolver = null;
function askHeight(room, sym) {
  return new Promise(resolve => {
    const r = ROOMS[room]; const b = document.getElementById('heightBody');
    b.innerHTML = `<p style="margin:0 0 8px">Místnost <b>${esc(roomCs(room))}</b>: výška stropu z reportu <b>není ověřená</b>${r && r.ceilingReason ? ` – ${esc(r.ceilingReason)}` : ''}. Zadej výšku prvku <b>${esc(sym.name)}</b> ručně (mm od čisté podlahy). Hodnota se uloží jako <b>ruční, neověřená</b> a bude tak označena v soupisu, CSV i PDF.</p>
      <div class="field"><label>Výška (mm)</label><input type="number" id="hManual" min="1" max="${LIM.maxFreeH * 1000}" step="10" value=""></div>
      <div class="errbox" id="hErr" hidden></div>
      <div class="btns"><div class="spacer"></div><button id="hCancel">Zrušit (nic se nepřidá)</button><button id="hOk" class="primary">Použít</button></div>`;
    const done = v => { document.getElementById('modalHeight').classList.remove('open'); heightResolver = null; resolve(v); };
    heightResolver = done;
    b.querySelector('#hCancel').onclick = () => done(null);
    b.querySelector('#hOk').onclick = () => { const v = parseNum(b.querySelector('#hManual').value); const errEl = b.querySelector('#hErr'); if (!Number.isFinite(v) || v <= 0 || v > LIM.maxFreeH * 1000) { errEl.textContent = `Zadej konečné kladné číslo do ${LIM.maxFreeH * 1000} mm.`; errEl.hidden = false; return; } done(Math.round(v) / 1000); };
    openModal('modalHeight'); setTimeout(() => { try { b.querySelector('#hManual').focus(); } catch { } }, 0);
  });
}
function placeAt(p, ev) {
  const sym = SYM[tool]; if (!sym) return;
  if (cur.kind === 'elev') {
    const w = WALLS[cur.wallId]; const f = w.face; let u = (p[0] - f[0]) / w.ppm, h = (f[3] - p[1]) / w.ppm;
    if (u < -0.15 || u > w.lenM + 0.15 || h < -0.15 || h > w.chM + 0.15) { toast('Klikni dovnitř plochy stěny (čárkovaný obdélník)'); return; }
    u = clamp(round2(u), 0, w.lenM); h = clamp(snapH(tool, h, ev), 0, w.chM);
    addElement({ id: uid(), type: tool, wallId: w.id, room: w.room, u, h, count: 1, label: nextLabel(tool), note: '' });
    if (isMobile()) showTab('props'); return;
  }
  const pp = fromSec(cur, p); const roomHere = cur.room || roomAt(pp);
  const wantWall = !(sym.ceiling && !(ev && ev.shiftKey));
  if (wantWall) {
    const nw = nearestWall(pp, 14 / cur.affine[0], roomHere || undefined);
    if (!nw) { toast('Klikni blíž ke stěně v půdorysu (nebo použij pohled stěny)'); return; }
    addElement({ id: uid(), type: tool, wallId: nw.w.id, room: nw.w.room, u: round2(nw.u), h: Math.min(nw.w.chM, defH(tool) / 1000), count: 1, label: nextLabel(tool), note: '' });
    if (isMobile()) showTab('props'); return;
  }
  if (!roomHere) { toast('Klikni dovnitř místnosti (volné prvky se kladou do půdorysu místnosti)'); return; }
  const base = { id: uid(), type: tool, wallId: null, room: roomHere, x: round1(pp[0]), y: round1(pp[1]), count: 1, note: '' };
  const hRoom = roomCeilingH(roomHere);
  if (hRoom != null) { addElement({ ...base, label: nextLabel(base.type), h: hRoom, hSource: 'room' }); if (isMobile()) showTab('props'); return; }
  askHeight(roomHere, sym).then(h => { if (h == null) { toast('Prvek nebyl přidán (bez výšky)'); return; } addElement({ ...base, label: nextLabel(base.type), h, hSource: 'manual' }); if (isMobile()) showTab('props'); });   // frozen base.type: the global tool may change while the dialog is open
}
function moveFree(e, pp, roomHint) {
  const r = roomAt(pp, roomHint ? { room: roomHint } : {}); if (!r) return false;   // outside every room polygon: stay where it is
  if (r !== e.room) {
    const R = ROOMS[r];
    if (e.hSource !== 'manual') { const hr = roomCeilingH(r); if (hr == null) return false; e.h = hr; e.hSource = 'room'; }   // unverified room needs a manual height – no silent move
    e.room = r; if (e.refX && WALLS[e.refX] && WALLS[e.refX].room !== r) delete e.refX; if (e.refY && WALLS[e.refY] && WALLS[e.refY].room !== r) delete e.refY;
  }
  e.x = round1(pp[0]); e.y = round1(pp[1]); return true;
}
function moveElementTo(e, p, ev) {
  if (cur.kind === 'elev') { const w = WALLS[cur.wallId]; const f = w.face; e.u = clamp(round2((p[0] - f[0]) / w.ppm), 0, w.lenM); e.h = clamp(snapH(e.type, (f[3] - p[1]) / w.ppm, ev), 0, w.chM); return; }
  const pp = fromSec(cur, p);
  if (e.wallId) { const w = WALLS[e.wallId]; const f = footOnWall(w, pp); e.u = clamp(round2(f.t / PLAN.ppm), 0, w.lenM); }
  else moveFree(e, pp, cur.room || null);
}
function showPos(p) {
  const el = document.getElementById('hintPos');
  if (cur.kind === 'elev') { const w = WALLS[cur.wallId]; const f = w.face; const u = (p[0] - f[0]) / w.ppm, h = (f[3] - p[1]) / w.ppm; el.textContent = (u >= 0 && u <= w.lenM && h >= 0 && h <= w.chM) ? `od levého rohu ${mm(u)} mm · výška ${mm(h)} mm` : ''; }
  else { const pp = fromSec(cur, p); const room = cur.room || roomAt(pp); const nw = nearestWall(pp, 14 / cur.affine[0], room || undefined); el.textContent = nw ? `${roomCs(nw.w.room)} · ${nw.w.nameFull} · ${mm(nw.u)} mm od levého rohu` : (room ? roomCs(room) : ''); }
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { const openM = document.querySelector('.modal.open'); if (openM && openM.classList && openM.classList.contains('open')) { ev.preventDefault(); openM.classList.remove('open'); if (openM.id === 'modalHeight' && heightResolver) heightResolver(null); return; } }   // a dialog closes first; the tool/selection stay untouched
  if (ev.target && ev.target.matches && ev.target.matches('input,textarea,select')) return;
  if (ev.key === 'Escape') { if (linkMode) { linkMode = null; render(); renderProps(); toast('Napojování ukončeno'); } else if (tool) setTool(null); else { selId = null; render(); renderProps(); } }
  else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selId) { deleteSel(); }
  else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
  else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); }
  else if (ev.key.startsWith('Arrow') && selId) {
    const e = state.elements.find(x => x.id === selId); if (!e) return; const step = (ev.shiftKey ? 0.1 : 0.01); ev.preventDefault();
    const dx = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0, dy = ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowDown' ? -1 : 0;
    nudge(e, dx, dy, step);
  }
});
function nudge(e, dx, dy, step) {
  if (e.wallId) { const w = WALLS[e.wallId]; tryUpdate(e, { u: round3(clamp(e.u + dx * step, 0, w.lenM)), h: round3(clamp(e.h + dy * step, 0, w.chM)) }, { quiet: true }); }
  else { const s = step * PLAN.ppm; tryUpdate(e, { x: round2(e.x + dx * s), y: round2(e.y - dy * s) }, { quiet: true }); }
}

/* ---------- nav ---------- */
function renderNav() {
  const nav = document.getElementById('nav'); let s = '';
  const countIn = sec => sec.kind === 'elev' ? state.elements.filter(e => e.wallId === sec.wallId).length : (sec.isMain ? state.elements.length : state.elements.filter(e => e.room === sec.room).length);
  const main = SECTIONS.find(x => x.isMain); if (main) s += navItem(main, countIn(main), true);
  const rooms = [...new Set(SECTIONS.filter(x => x.room).map(x => x.room))];
  for (const r of rooms) {
    const secs = SECTIONS.filter(x => x.room === r); const open = navOpen[r] ?? (cur.room === r); const n = state.elements.filter(e => e.room === r).length; const R = ROOMS[r];
    const ceil = R && R.ceilingUncertain ? `<span class="tag warn" title="${esc('výška stropu z reportu není ověřená: ' + (R.ceilingReason || ''))}">⚠</span>` : '';   // heights themselves are shown only in the element properties
    s += `<div class="room ${open ? 'open' : ''}" data-room="${esc(r)}"><span class="arr">▶</span>${esc(roomCs(r))}${ceil}${n ? `<span class="cnt">${n}</span>` : ''}</div>`;
    if (open) for (const sec of secs) s += navItem(sec, countIn(sec));
  }
  nav.innerHTML = s;
  nav.querySelectorAll('.item').forEach(el => el.onclick = () => { gotoSection(el.dataset.id); if (isMobile()) showTab('palette'); });
  nav.querySelectorAll('.room').forEach(el => el.onclick = () => { const r = el.dataset.room; navOpen[r] = !(navOpen[r] ?? (cur.room === r)); renderNav(); });
}
function navItem(sec, n, top = false) {
  const icon = sec.kind === 'plan' ? '▦' : '▭'; const tag = sec.synthetic ? `<span class="tag schema" title="${isMerged(WALLS[sec.wallId]) ? 'sloučený pohled – report kreslí stěnu po částech' : 'schéma – odhad z půdorysu, report neobsahuje pohled'}">${isMerged(WALLS[sec.wallId]) ? 'sloučeno' : 'schéma'}</span>` : '';
  return `<div class="item ${sec.id === cur.id ? 'active' : ''}" data-id="${sec.id}" style="${top ? 'padding-left:12px;font-weight:600' : ''}"><span class="n">${icon}</span><span>${esc(sec.name)}${tag}${sec.sub ? `<div class="sub">${esc(sec.sub)}</div>` : ''}</span>${n ? `<span class="cnt">${n}</span>` : ''}</div>`;
}
function gotoSection(id) { const prev = cur; cur = SEC[id] || cur; if (cur.room && prev.room !== cur.room) { navOpen = {}; } view = null; hoverWall = null; render(); renderNav(); renderProps(); }

/* ---------- palette ---------- */
const PRIMARY = ['zas1', 'zas2', 'zas400', 'vyp1', 'vyp5', 'vyp6', 'tlac', 'svStrop', 'svNast', 'bod', 'led', 'rj45', 'tv', 'zvon', 'vyv', 'rozv'];
const PAL_NAME = { zas1: 'Zásuvka', zas2: 'Dvojzásuvka', zas400: 'Zásuvka 400 V', vyp1: 'Vypínač', vyp5: 'Sériový (č. 5)', vyp6: 'Střídavý (č. 6)', tlac: 'Tlačítko', svStrop: 'Svítidlo stropní', svNast: 'Svítidlo nástěnné', bod: 'Bodovka', led: 'LED pásek', rj45: 'Datová zásuvka', tv: 'TV / SAT', zvon: 'Zvonek / dom. telefon', vyv: 'Vývod (spotřebič)', rozv: 'Rozvaděč' };
const VYV_TYPES = ['vyvDig', 'vyvVD', 'vyvTr', 'vyvMy', 'vyvPr', 'vyvBoj', 'vyvZeb', 'vyv'];
let showMore = false;
function symIcon(sid, color = 'currentColor') { return `<svg viewBox="-13 -13 26 24">${drawOps(SYM[sid].ops(), [0, 1], [1, 0], [0, -1], color, 0.9)}</svg>`; }
function palButton(sym) { return `<button class="pal ${tool === sym.id ? 'active' : ''}" data-sym="${sym.id}" title="${esc(sym.name)} · ${sym.ceiling ? 'výška podle stropu místnosti' : defH(sym.id) + ' mm'}">${symIcon(sym.id, symColor(sym.id))}<span>${esc(PAL_NAME[sym.id] || sym.name)}</span></button>`; }
function renderPalette() {
  const pal = document.getElementById('palette'); let s = '<h3>Prvky</h3>';
  for (const c of [...new Set(SYMBOLS.map(x => x.cat))]) { const items = SYMBOLS.filter(x => x.cat === c && PRIMARY.includes(x.id)); if (!items.length) continue; s += `<div class="cat"><div class="catname">${esc(c)}</div><div class="grid">${items.map(palButton).join('')}</div></div>`; }
  const rest = SYMBOLS.filter(x => !PRIMARY.includes(x.id) && !VYV_TYPES.includes(x.id));
  if (showMore) s += `<div class="cat"><div class="catname">Další</div><div class="grid">${rest.map(palButton).join('')}</div></div>`;
  s += `<button class="more" id="palMore">${showMore ? 'Méně prvků ▴' : 'Další prvky ▾ (IP44, nad linkou, křížový, stmívač, termostat, čidlo, ventilátor…)'}</button>`;
  pal.innerHTML = s;
  pal.querySelectorAll('.pal').forEach(b => b.onclick = () => setTool(tool === b.dataset.sym ? null : b.dataset.sym));
  pal.querySelector('#palMore').onclick = () => { showMore = !showMore; renderPalette(); };
}
function setTool(t) {
  tool = t; selId = t ? null : selId; renderPalette(); render(); renderProps();
  document.getElementById('modeSelect').classList.toggle('on', !t);
  const h = document.getElementById('hintTool');
  if (t) { h.className = 'tool'; const sym = SYM[t]; h.textContent = `${PAL_NAME[t] || sym.name}: klikni na ${cur.kind === 'elev' ? 'stěnu – výška se přichytí na ' + defH(t) + ' mm (Alt = přesně)' : (sym.ceiling ? 'místo v půdorysu místnosti (výška = strop místnosti podle reportu)' : 'stěnu v půdorysu')}. Esc = konec.`; }
  else { h.className = ''; h.textContent = state.elements.length ? 'Klikni na prvek a táhni ho, nebo uprav hodnoty vpravo. Nový prvek = vyber v paletě.' : ''; }
}

/* ---------- properties ---------- */
function renderProps() {
  const box = document.getElementById('props'); const e = state.elements.find(x => x.id === selId);
  const here = overlayItems(cur).map(it => it.e);
  const chips = `<h3>Prvky ${cur.kind === 'elev' ? 'na této stěně' : 'v půdorysu'} (${here.length})</h3><div class="chips">${here.length ? here.map(x => `<span class="chip ${x.id === selId ? 'on' : ''}" data-id="${x.id}" title="${esc(SYM[x.type].name)}" style="border-color:${symColor(x.type)}">${esc(labelText(x) || '?')}</span>`).join('') : '<span class="empty">zatím žádné</span>'}</div>`;
  if (!e) { box.innerHTML = chips + `<h3>Vlastnosti</h3><div class="empty">Klikni na prvek ve výkresu nebo na jeho označení výše.</div>`; bindChips(box); return; }
  const w = e.wallId ? WALLS[e.wallId] : null; const ref = w ? nearestRef(w, e.u, e) : null; const Rm = ROOMS[e.room];
  const isVyv = VYV_TYPES.includes(e.type); const isZas = e.type.startsWith('zas'); const warns = elemWarnings(e);
  const typeOpts = [...new Set(SYMBOLS.map(x => x.cat))].map(c => `<optgroup label="${esc(c)}">` + SYMBOLS.filter(x => x.cat === c && (!VYV_TYPES.includes(x.id) || x.id === 'vyv')).map(x => `<option value="${x.id}" ${(x.id === e.type || (x.id === 'vyv' && isVyv)) ? 'selected' : ''}>${esc(x.id === 'vyv' ? 'Vývod (spotřebič)' : x.name)}</option>`).join('') + '</optgroup>').join('');
  const wallOpts = (() => { const rooms = [...new Set(PROJECT.walls.filter(x => x.plan && !x.hidden).map(x => x.room))]; return rooms.map(r => `<optgroup label="${esc(roomCs(r))}">` + PROJECT.walls.filter(x => x.plan && !x.hidden && x.room === r).map(x => `<option value="${x.id}" ${x.id === e.wallId ? 'selected' : ''}>${esc(x.nameFull)} (${fmtM(x.lenM)})</option>`).join('') + '</optgroup>').join(''); })();
  const hLabel = w ? `mm od podlahy (0–${mm(w.chM)})` : (e.hSource === 'manual' ? 'mm · ruční, neověřeno' : (Rm && !Rm.ceilingUncertain && isNum(Rm.ceilingM) ? `mm · strop místnosti ${mm(Rm.ceilingM)} (report)` : 'mm od podlahy'));
  box.innerHTML = chips + `<h3>Vlastnosti · ${esc(e.label || '')}</h3>
    ${warns.length ? `<div class="warnbox">⚠ ${warns.map(esc).join('<br>⚠ ')}</div>` : ''}
    <div class="row"><label>Typ</label><select id="pType">${typeOpts}</select></div>
    ${isVyv ? `<div class="row"><label>Pro co</label><select id="pVyv">${VYV_TYPES.map(t => `<option value="${t}" ${t === e.type ? 'selected' : ''}>${esc(SYM[t].name.replace('Vývod ', '').replace('obecný', 'jiné / obecný'))}</option>`).join('')}</select></div>` : ''}
    <div class="row"><label>Označení</label><input type="text" id="pLabel" value="${esc(e.label || '')}" maxlength="${LIM.maxLabel}"></div>
    <div class="row"><label>Stěna</label>${w ? `<select id="pWall">${wallOpts}</select>` : `<div>${esc(roomCs(e.room || ''))} · volně (strop)</div>`}</div>
    ${w && w.synthetic ? `<div class="row"><label></label><span class="tag schema">${isMerged(w) ? 'sloučený pohled z částí ' + esc(w.mergedFrom.join(' + ')) : 'schéma – odhad z půdorysu'}</span></div>` : ''}
    <div class="row"><label>Výška</label><div class="two"><input type="number" id="pH" value="${mm(e.h)}" step="10" min="0"><span class="unit">${esc(hLabel)}</span></div></div>
    ${w ? `<div class="row"><label>Měřit od</label><select id="pRef">${wallRefs(w).map(r => `<option value="${refKey(r)}" ${(ref && refKey(ref) === refKey(r)) ? 'selected' : ''}>${esc(refLabel(r, w))}</option>`).join('')}</select></div>
    <div class="row"><label>Vzdálenost</label><div class="two"><input type="number" id="pRefD" value="${ref ? mm(ref.d) : 0}" step="10" min="0"><span class="unit">mm k ose prvku${ref && ref.d > 0.0005 ? ' · ' + (e.u > ref.u ? 'vpravo' : 'vlevo') : ''}</span></div></div>` : freeProps(e)}
    <div class="row"><label>Posun</label><div class="nudge">${w ? `<button data-n="-1,0" title="doleva 10 mm (Shift 100)">←</button><button data-n="1,0" title="doprava 10 mm">→</button><button data-n="0,1" title="výš 10 mm">↑</button><button data-n="0,-1" title="níž 10 mm">↓</button>` : `<button data-n="-1,0">←</button><button data-n="1,0">→</button><button data-n="0,1">↑</button><button data-n="0,-1">↓</button>`}</div></div>
    ${isZas ? `<div class="row"><label>Počet</label><div class="two"><select id="pCount">${[1, 2, 3, 4].map(n => `<option value="${n}" ${(e.count || 1) === n ? 'selected' : ''}>${n}×</option>`).join('')}</select><span class="unit">vedle sebe</span></div></div>` : ''}
    <div class="row"><label>Poznámka</label><input type="text" id="pNote" value="${esc(e.note || '')}" placeholder="k čemu slouží, okruh…" maxlength="${LIM.maxNote}"></div>
    ${isSwitch(e.type) ? `<div class="row"><label>Ovládá</label><div class="links" id="pLinks">${controlsOf(e).length
        ? controlsOf(e).map(id => { const t = state.elements.find(x => x.id === id); return `<span class="chip link" data-unlink="${id}" title="${t ? esc(SYM[t.type].name + ' · ' + roomCs(t.room)) : 'prvek už neexistuje'}">${esc(t ? labelText(t) : id)} ✕</span>`; }).join('')
        : '<span class="unit">zatím nic – klikni na Napojit a pak na prvky ve výkresu</span>'}</div></div>
    <div class="row"><label></label><button id="pLinkMode" class="${linkMode === e.id ? 'primary' : ''}">${linkMode === e.id ? 'Hotovo (Esc)' : '＋ Napojit kliknutím'}</button></div>` : ''}
    ${!isSwitch(e.type) && controllersOf(e.id).length ? `<div class="row"><label>Ovládáno z</label><div class="links">${controllersOf(e.id).map(x => `<span class="chip" data-id="${x.id}">${esc(labelText(x))}</span>`).join('')}</div></div>` : ''}
    <div class="actions"><button id="pDel" class="primary">Smazat</button><button id="pDup">Duplikovat</button>${w ? `<button id="pGoto">${cur.kind === 'elev' ? 'Ukázat v půdorysu' : 'Ukázat stěnu'}</button>` : ''}</div>`;
  box.querySelector('#pType').onchange = ev => tryUpdate(e, { type: ev.target.value, count: ev.target.value.startsWith('zas') ? e.count : 1 });
  const pv = box.querySelector('#pVyv'); if (pv) pv.onchange = ev => tryUpdate(e, { type: ev.target.value });
  box.querySelector('#pLabel').onchange = ev => tryUpdate(e, { label: ev.target.value.trim() });
  box.querySelector('#pH').onchange = ev => { const v = parseNum(ev.target.value); if (!Number.isFinite(v)) { toast('Výška musí být číslo v mm – ponechána původní'); renderProps(); return; } tryUpdate(e, { h: v / 1000, hSource: e.wallId ? undefined : 'manual' }); };
  const pc0 = box.querySelector('#pCount'); if (pc0) pc0.onchange = ev => tryUpdate(e, { count: parseInt(ev.target.value, 10) });
  box.querySelector('#pNote').onchange = ev => tryUpdate(e, { note: ev.target.value });
  box.querySelector('#pDup').onclick = () => {
    const c = { ...e, id: uid(), label: nextLabel(e.type) };
    if (c.wallId) c.u = Math.min(WALLS[c.wallId].lenM, c.u + 0.15); else { c.x = round1(c.x + 12); if (!validateElement(c).value) c.x = round1(e.x - 12); }
    const added = addElement(c); if (added) toast(`Duplikováno jako ${added.label}`);
  };
  box.querySelector('#pDel').onclick = deleteSel;
  const lm = box.querySelector('#pLinkMode');
  if (lm) lm.onclick = () => { linkMode = linkMode === e.id ? null : e.id; setTool(null); render(); renderProps(); if (linkMode) toast('Klikni ve výkresu na prvky, které tenhle spínač ovládá. Hotovo klávesou Esc.'); };
  box.querySelectorAll('[data-unlink]').forEach(c => c.onclick = () => { toggleLink(e, c.dataset.unlink); });
  bindChips(box);
  const pr = box.querySelector('#pRef'); if (pr) pr.onchange = ev => tryUpdate(e, { refKey: ev.target.value });
  const prd = box.querySelector('#pRefD'); if (prd) prd.onchange = ev => { const d = parseNum(ev.target.value); if (!Number.isFinite(d) || d < 0) { toast('Vzdálenost musí být nezáporné číslo v mm – ponechána původní'); renderProps(); return; } const r = nearestRef(w, e.u, e); let dir; if (r.what === 'roh') dir = r.u < 0.001 ? 1 : -1; else dir = e.u >= r.u ? 1 : -1; tryUpdate(e, { u: round3(r.u + dir * d / 1000) }); };
  for (const axis of ['X', 'Y']) {
    const sel = box.querySelector('#pRef' + axis), inp = box.querySelector('#pD' + axis);
    if (sel) sel.onchange = ev => tryUpdate(e, { ['ref' + axis]: ev.target.value || undefined });
    if (inp) inp.onchange = ev => { const d = parseNum(ev.target.value); if (!Number.isFinite(d) || d < 0) { toast('Vzdálenost musí být nezáporné číslo v mm – ponechána původní'); renderProps(); return; } const fd = freeDims([e.x, e.y], e).find(f => f.axis === (axis === 'X' ? 0 : 1)); if (!fd) { toast('Pro tento směr není referenční stěna'); return; } const n = fd.w.plan.n; const k = axis === 'X' ? 0 : 1; tryUpdate(e, { [axis === 'X' ? 'x' : 'y']: round2(fd.w.plan.a[k] + Math.sign(n[k] || 1) * d / 1000 * PLAN.ppm) }); };
  }
  const pc = box.querySelector('#pCenter'); if (pc) pc.onclick = () => { const c = roomCenter(e.room); if (!c) { toast('Místnost nemá půdorys'); return; } tryUpdate(e, { x: c[0], y: c[1] }); };
  const pg = box.querySelector('#pGrid'); if (pg) pg.onclick = () => {
    const rows = clamp(parseInt(box.querySelector('#gRows').value, 10) || 1, 1, 8), cols = clamp(parseInt(box.querySelector('#gCols').value, 10) || 1, 1, 8);
    const pts = roomGrid(e.room, rows, cols); if (!pts.length) { toast('Rastr se do půdorysu nevešel'); return; }
    snapshot(); let n = 0;
    pts.forEach((p, i) => { if (i === 0) { const v = validateElement({ ...e, x: p[0], y: p[1] }); if (v.value) { Object.assign(e, v.value); n++; } } else { const c = addElement({ ...e, id: uid(), x: p[0], y: p[1], label: nextLabel(e.type) }, { noSnapshot: true, noCommit: true, quiet: true }); if (c) n++; } });
    selId = e.id; commit(); toast(`Rozmístěno ${n} prvků (${rows}×${cols}) uvnitř půdorysu`);
  };
  const pw = box.querySelector('#pWall'); if (pw) pw.onchange = ev => { const nw = WALLS[ev.target.value]; if (!nw) return; tryUpdate(e, { wallId: nw.id, room: nw.room, u: Math.min(e.u, nw.lenM), h: Math.min(e.h, nw.chM), refKey: undefined }); };
  box.querySelectorAll('.nudge button').forEach(b => b.onclick = ev => { const [dx, dy] = b.dataset.n.split(',').map(Number); nudge(e, dx, dy, ev.shiftKey ? 0.1 : 0.01); });
  const g = box.querySelector('#pGoto'); if (g) g.onclick = () => { if (cur.kind === 'elev') { const pv2 = SECTIONS.find(x => x.kind === 'plan' && x.room === w.room) || SECTIONS.find(x => x.isMain); gotoSection(pv2.id); } else { const es = secOfWall(w.id); if (es) gotoSection(es.id); } };
}
function roomWalls(room, axis) { const low = !!(ROOMS[room] && ROOMS[room].low); return PROJECT.walls.filter(w => w.plan && (low || !w.hidden) && w.room === room && wallAxis(w) === axis); }
function freeProps(e) {
  const fds = freeDims([e.x, e.y], e); const fx = fds.find(f => f.axis === 0), fy = fds.find(f => f.axis === 1);
  const optsFor = (axis, curW) => `<option value="">nejbližší</option>` + roomWalls(e.room, axis).map(w => `<option value="${w.id}" ${curW === w.id ? 'selected' : ''}>${esc(w.nameFull)} (${fmtM(w.lenM)})</option>`).join('');
  return `<div class="row"><label>Od stěny ↔</label><div class="two"><select id="pRefX">${optsFor(0, e.refX)}</select><input type="number" id="pDX" value="${fx ? mm(fx.dist / PLAN.ppm) : ''}" step="10" min="0" title="mm od zvolené svislé stěny"></div></div>
  <div class="row"><label>Od stěny ↕</label><div class="two"><select id="pRefY">${optsFor(1, e.refY)}</select><input type="number" id="pDY" value="${fy ? mm(fy.dist / PLAN.ppm) : ''}" step="10" min="0" title="mm od zvolené vodorovné stěny"></div></div>
  <div class="row"><label></label><span class="unit">${fx ? esc(fx.w.nameFull) + ' · ' : ''}${fy ? esc(fy.w.nameFull) : ''} — mm k ose prvku</span></div>
  <div class="row"><label>Rozmístit</label><div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap"><button id="pCenter" title="bod nejdál od stěn – i u L místností">Na střed</button><input type="number" id="gRows" value="2" min="1" max="8" style="width:48px" title="řady"> × <input type="number" id="gCols" value="2" min="1" max="8" style="width:48px" title="sloupce"><button id="pGrid" title="rovnoměrně uvnitř půdorysu místnosti">Rastr</button></div></div>`;
}
function bindChips(box) { box.querySelectorAll('.chip').forEach(c => c.onclick = () => { selId = c.dataset.id; if (tool) { tool = null; renderPalette(); document.getElementById('modeSelect').classList.add('on'); } render(); renderProps(); if (isMobile()) showTab('props'); }); }

/* ---------- list / CSV: unambiguous positions (corner side, opening edge, direction, two distances) ---------- */
const GEN = { levá: 'levé', pravá: 'pravé', horní: 'horní', dolní: 'dolní' };
function wallGen(w) { const parts = (w.name || '').replace(/^Stěna\s+/, '').split(' '); const s = parts.map(p => GEN[p] || p).join(' '); return 'stěny ' + s + (w.synthetic ? ' (schéma)' : ''); }
function refLabelLoc(r, w) { const s = refSide(r, w); if (r.what === 'roh') return s === 'L' ? 'levém rohu' : 'pravém rohu'; return `${s === 'L' ? 'levé' : 'pravé'} hraně ${r.what === 'dveře' ? 'dveří' : 'okna'}`; }
function posInfo(e) {
  if (e.wallId) {
    const w = WALLS[e.wallId]; if (!w) return { text: '', ref1: '', d1: '', dir1: '', ref2: '', d2: '' };
    const ref = nearestRef(w, e.u, e); const d = mm(ref.d); const onRef = ref.d < 0.0005; const dir = onRef ? '' : (e.u > ref.u ? 'vpravo' : 'vlevo');
    const text = onRef ? `na ${refLabelLoc(ref, w)}` : `${d} mm ${dir} od ${refLabelGen(ref, w)}`;
    return { text, ref1: refLabel(ref, w), d1: d, dir1: onRef ? 'na referenci' : dir, ref2: '', d2: '' };
  }
  const fds = freeDims([e.x, e.y], e); const fx = fds.find(f => f.axis === 0), fy = fds.find(f => f.axis === 1);
  const part = f => `${mm(f.dist / PLAN.ppm)} mm od ${wallGen(f.w)}${f.covers ? '' : ' (mimo její délku)'}${f.estimate ? ' (odhad vůči čáře půdorysu)' : ''}`;
  const text = [fx, fy].filter(Boolean).map(part).join(' · ') || 'bez referenční stěny';
  return { text, ref1: fx ? fx.w.nameFull : '', d1: fx ? mm(fx.dist / PLAN.ppm) : '', dir1: fx ? 'kolmo' : '', ref2: fy ? fy.w.nameFull : '', d2: fy ? mm(fy.dist / PLAN.ppm) : '' };
}
function hSourceText(e) { if (e.wallId) return 'od podlahy'; if (e.hSource === 'manual') return 'ruční, neověřeno'; if (e.hSource === 'room') return 'strop místnosti (report)'; return 'od podlahy'; }
function listRows() {
  const rows = []; const rooms = [...new Set(state.elements.map(e => e.room))];
  for (const r of rooms) for (const e of state.elements.filter(x => x.room === r).sort((a, b) => (a.label || '').localeCompare(b.label || '', 'cs', { numeric: true }))) {
    const w = e.wallId ? WALLS[e.wallId] : null; const pi = posInfo(e);
    const ovlada = controlsOf(e).map(id => { const t = state.elements.find(x => x.id === id); return t ? (t.label || id) : '?'; }).sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));
    const ovladanZ = controllersOf(e.id).map(x => x.label || x.id).sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));
    rows.push({ ovlada: ovlada.join(', '), ovladanZ: ovladanZ.join(', '), room: roomCs(r), label: e.label || '', type: SYM[e.type] ? SYM[e.type].name : e.type, count: e.count || 1, wall: w ? w.name : 'strop / volně', origin: w ? (isMerged(w) ? MERGED_NOTE : w.synthetic ? SCHEMA_NOTE : 'měřeno (pohled)') : 'půdorys', synthetic: !!(w && w.synthetic), h: mm(e.h), hSource: hSourceText(e), pos: pi.text, ref1: pi.ref1, d1: pi.d1, dir1: pi.dir1, ref2: pi.ref2, d2: pi.d2, warn: elemWarnings(e).join('; '), note: e.note || '' });
  }
  return rows;
}
function renderList() {
  const rows = listRows(); let s = `<table class="list"><thead><tr><th>Ozn.</th><th>Prvek</th><th>ks</th><th>Stěna</th><th>Výška (mm)</th><th>Poloha</th><th>Ovládá / ovládáno</th><th>Upozornění</th><th>Poznámka</th></tr></thead><tbody>`;
  let lastRoom = null;
  for (const r of rows) { if (r.room !== lastRoom) { s += `<tr class="room"><td colspan="9">${esc(r.room)}</td></tr>`; lastRoom = r.room; } s += `<tr><td>${esc(r.label)}</td><td>${esc(r.type)}</td><td class="num">${r.count}</td><td>${esc(r.wall)}${r.synthetic ? '<span class="tag schema">schéma</span>' : ''}</td><td class="num" title="${esc(r.hSource)}">${r.h}${r.hSource === 'ruční, neověřeno' ? ' <span class="tag warn">ruční</span>' : ''}</td><td>${esc(r.pos)}</td><td class="warn">${esc(r.warn)}</td><td>${esc(r.note)}</td></tr>`; }
  s += `</tbody></table>`;
  const tot = {}; for (const e of state.elements) { const n = SYM[e.type] ? SYM[e.type].name : e.type; tot[n] = (tot[n] || 0) + (e.count || 1); }
  s += `<h3 style="margin:16px 0 6px;font-size:12px">Souhrn</h3><table class="list"><tbody>` + Object.entries(tot).sort().map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v} ks</td></tr>`).join('') + `</tbody></table>`;
  s += `<p class="unit" style="margin-top:10px">Poloha: „vpravo/vlevo od“ při pohledu z místnosti na stěnu; u volných prvků dvě kolmé vzdálenosti k osám stěn. Výšky od čisté podlahy ke středu prvku; „strop místnosti (report)“ = CEILING HEIGHT z podkladu magicplan, ne měření na stavbě.</p>`;
  document.getElementById('listBody').innerHTML = rows.length ? s : '<div class="empty">Zatím žádné prvky.</div>';
}
const CSV_HEAD = ['Místnost', 'Označení', 'Prvek', 'ks', 'Stěna', 'Původ stěny', 'Výška mm', 'Zdroj výšky', 'Poloha', 'Ovládá', 'Ovládáno z', 'Reference 1', 'Vzdálenost 1 mm', 'Směr 1', 'Reference 2', 'Vzdálenost 2 mm', 'Upozornění', 'Poznámka'];
function csvText() { const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`; return [CSV_HEAD.join(';'), ...listRows().map(r => [r.room, r.label, r.type, r.count, r.wall, r.origin, r.h, r.hSource, r.pos, r.ovlada, r.ovladanZ, r.ref1, r.d1, r.dir1, r.ref2, r.d2, r.warn, r.note].map(q).join(';'))].join('\n'); }

/* ---------- settings ---------- */
function renderSettings() {
  const b = document.getElementById('settingsBody');
  b.innerHTML = `<h2>Kóty</h2>
  <div class="opt"><label>Styl</label><select id="sDimStyle" style="width:auto"><option value="chain">řetězec + výškové úrovně</option><option value="chainTag">řetězec + výškové štítky</option><option value="each">kóta u každého prvku</option></select></div>
  <div class="opt"><label><input type="checkbox" id="sMainDims" ${state.settings.mainPlanDims ? 'checked' : ''}> kótovat i v celkovém půdorysu (jinak jen v pohledech a půdorysech místností)</label></div>
  <h2>Sever <span class="unit">report magicplan orientaci neobsahuje – nastav ji jednou zde</span></h2>
  <div class="northPick" id="northPick">${[0,45,90,135,180,225,270,315].map(a => `<button data-a="${a}" class="${northDeg() === a ? 'on' : ''}" title="sever ${COMPASS_FULL[COMPASS[(a/45)%8]] || ''}">${['↑','↗','→','↘','↓','↙','←','↖'][a/45]}</button>`).join('')}
    <span class="unit">Sever míří <b>${['nahoru','vpravo nahoru','doprava','vpravo dolů','dolů','vlevo dolů','doleva','vlevo nahoru'][northDeg()/45] || (northDeg()+'°')}</b> · stěny se pojmenují „Stěna dole (J)“, v půdorysu přibude růžice a písmena v okraji.</span></div>
  <h2>Standardní výšky nových prvků <span class="unit">mm od čisté podlahy ke středu</span></h2>
  ${SYMBOLS.map(x => `<div class="row"><span>${esc(x.name)}<span class="unit" style="margin-left:6px">(${x.ceiling ? 'strop' : x.h})</span></span>${x.ceiling ? '<span class="unit">podle místnosti</span>' : `<input type="number" data-sid="${x.id}" value="${defH(x.id)}" step="50" min="0" max="6000">`}</div>`).join('')}
  <p class="unit" style="margin:6px 0 0">Platí pro nově umístěné prvky; už umístěné se nemění. Stropní svítidla a bodovky dostávají výšku stropu místnosti (CEILING HEIGHT z reportu); u místnosti s neověřeným stropem se výška zadává ručně.</p>
  <h2>Záloha a přenos</h2>
  <p style="margin:0;color:var(--ink2)">Použij tlačítka <b>Uložit projekt</b> / <b>Načíst projekt</b> v horní liště (soubor JSON nebo vložený text, s kontrolou a náhledem změn). Historie posledních 10 verzí je v <b>rev …</b> (Projekt).</p>`;
  b.querySelector('#sDimStyle').value = dimStyle;
  b.querySelector('#sDimStyle').onchange = ev => { if (!DIM_STYLES.includes(ev.target.value)) return; dimStyle = ev.target.value; state.settings.dimStyle = dimStyle; commit(); };
  b.querySelector('#sMainDims').onchange = ev => { state.settings.mainPlanDims = !!ev.target.checked; commit(); };
  b.querySelectorAll('#northPick button').forEach(btn => btn.onclick = () => {
    const a = parseInt(btn.dataset.a, 10); const v = validateSettings({ ...state.settings, north: a });
    if (v.errors.length) { toast(v.errors[0].msg); return; }
    state.settings.north = a; applyNorth(); commit(); renderSettings(); renderNav();
    toast('Sever: ' + (COMPASS_FULL[COMPASS[(a / 45) % 8]] || a + '°') + ' – názvy stěn přepočítány');
  });
  b.querySelectorAll('input[data-sid]').forEach(i => i.onchange = () => { const v = parseNum(i.value); if (!Number.isFinite(v) || v < 0 || v > 6000) { toast('Výška musí být číslo 0–6000 mm – ponechána původní'); i.value = defH(i.dataset.sid); return; } state.settings.heights[i.dataset.sid] = v; renderPalette(); commit(); });
}

/* ---------- project file (JSON v3) ---------- */
function projectFile() {
  return { format: FORMAT, schemaVersion: SCHEMA_VERSION, app: APP_VERSION, project: { jobId: JOB_ID, geomFp: GEOM_FP, title: PROJECT.title, slug: PROJECT_SLUG }, exported: new Date().toISOString(),
    meta: { ...state.meta, contentHash: contentHash() }, settings: state.settings, elements: state.elements.map(normElem) };
}
function projectFileName(ext) { return `elektro-${JOB_ID || PROJECT_SLUG}-rev${state.meta.rev}-${new Date().toISOString().slice(0, 10)}.${ext}`; }
async function saveProject() { pushHistory('export-json'); await saveFile(projectFileName('json'), JSON.stringify(projectFile(), null, 1)); }
function applyProject(val, opts = {}) {
  const h = contentHash({ elements: val.elements, settings: val.settings });
  if (h === contentHash()) { toast('Obsah je shodný s aktuálním stavem – nic se nemění'); return false; }
  pushHistory('before-' + (opts.reason || 'import')); snapshot();
  const prev = state.meta;
  state.elements = val.elements.map(e => ({ ...e })); state.settings = { ...freshSettings(), ...val.settings, heights: { ...(val.settings.heights || {}) } }; dimStyle = state.settings.dimStyle || 'chain';
  const fm = val.meta || {};
  state.meta = { ...freshMeta(), author: prev.author || fm.author || '', rev: Math.max(prev.rev || 0, fm.rev || 0) + 1, revHash: h, status: 'navrh', updatedAt: new Date().toISOString(),
    importedFrom: { format: opts.format || 'v3', rev: fm.rev ?? null, status: fm.status || null, author: fm.author || null, at: new Date().toISOString(), reason: opts.reason || 'import' } };
  applyNorth(); pruneLinks(); selId = null; undoStack = []; redoStack = []; commit(); return true;
}
/* ---------- import UI: nothing changes until the user confirms the previewed replacement ---------- */
let importPending = null;
function renderImport() {
  const b = document.getElementById('importBody'); importPending = null;
  const legacyLocal = LEGACY_ALIASES.map(a => { try { const raw = localStorage.getItem('elektro:' + a); return raw ? { alias: a, raw } : null; } catch { return null; } }).filter(Boolean);
  b.innerHTML = `<h2>Zdroj</h2>
  <div class="field"><label>Soubor JSON</label><input type="file" id="impFile" accept=".json,application/json"></div>
  <div class="field"><label>nebo vložený text</label><textarea class="json" id="impText" placeholder="sem vlož obsah souboru projektu (JSON)…"></textarea></div>
  ${legacyLocal.length ? `<div class="opt"><button id="impLegacyLocal">Načíst starší uložení tohoto prohlížeče (v2.1: ${esc(legacyLocal.map(x => x.alias).join(', '))})</button></div>` : ''}
  <div class="opt"><label><input type="checkbox" id="impLegacy"> Je to starší záloha (v2.1) této zakázky – rozumím, že nemá otisk geometrie a potvrzuji, že patří k tomuto projektu (${esc(LEGACY_ALIASES.join(', ') || 'žádné známé aliasy')})</label></div>
  <div class="btns"><button id="impCheck" class="primary">Zkontrolovat</button><span class="unit">Nic se nemění, dokud náhradu nepotvrdíš.</span></div>
  <div id="impResult"></div>`;
  const fileIn = b.querySelector('#impFile'), textIn = b.querySelector('#impText');
  fileIn.onchange = () => { const f = fileIn.files && fileIn.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { textIn.value = String(fr.result || ''); runImportCheck(); }; fr.onerror = () => toast('Soubor nejde přečíst'); fr.readAsText(f, 'utf-8'); };
  const ll = b.querySelector('#impLegacyLocal'); if (ll) ll.onclick = () => { const x = legacyLocal[0]; try { const j = JSON.parse(x.raw); textIn.value = JSON.stringify({ project: x.alias, elements: j.elements, settings: j.settings }, null, 1); b.querySelector('#impLegacy').checked = true; runImportCheck(); } catch { toast('Starší uložení nejde přečíst'); } };
  b.querySelector('#impCheck').onclick = runImportCheck;
}
function runImportCheck() {
  const b = document.getElementById('importBody'); const out = b.querySelector('#impResult'); const txt = b.querySelector('#impText').value; const legacyConfirmed = !!b.querySelector('#impLegacy').checked;
  let j; try { j = JSON.parse(txt); } catch (e) { out.innerHTML = `<div class="errbox">Text není platný JSON (${esc(e.message || e)}). Nic se nezměnilo.</div>`; importPending = null; return; }
  const res = validateProjectFile(j, { legacyConfirmed }); importPending = res.ok ? { value: res.value, info: res.info } : null;
  const ident = res.info.format === 'v3' ? `v3 · zakázka ${esc(res.info.projectRef && res.info.projectRef.jobId)} · geometrie ${esc(res.info.projectRef && res.info.projectRef.geomFp)}` : `starší formát v2.1 · projekt „${esc(res.info.projectRef && res.info.projectRef.slug)}“`;
  let s = `<div class="kv"><b>Formát / identita</b><span>${ident}</span><b>Tento editor</b><span>zakázka ${esc(JOB_ID || '–')} · geometrie ${esc(GEOM_FP || '–')}</span>${j.meta ? `<b>Meta v souboru</b><span>rev ${esc(j.meta.rev)} · ${esc(STATUS_CS[j.meta.status] || j.meta.status || '–')} · ${esc(j.meta.author || 'bez autora')}</span>` : ''}${j.exported ? `<b>Exportováno</b><span>${esc(j.exported)}</span>` : ''}</div>`;
  if (res.errors.length) s += `<div class="errbox"><b>Import odmítnut – nic se nezměnilo.</b> Chyby (${res.errors.length}):<ul>${res.errors.slice(0, 40).map(e => `<li><span class="unit">${esc(e.path)}</span> ${esc(e.msg)}</li>`).join('')}${res.errors.length > 40 ? `<li>… a dalších ${res.errors.length - 40}</li>` : ''}</ul></div>`;
  if (res.warnings.length) s += `<div class="warnbox">Upozornění (${res.warnings.length}):<ul>${res.warnings.slice(0, 40).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  if (res.ok) {
    const d = diffAgainstState(res.value);
    s += `<div class="okbox diff"><b>Kontrola prošla.</b> Náhled změn při nahrazení celého projektu: ${d.before} → ${d.after} prvků.
      <ul><li>přidáno ${d.added.length}${d.added.length ? ': ' + esc(d.added.join(', ')) : ''}</li><li>odebráno ${d.removed.length}${d.removed.length ? ': ' + esc(d.removed.join(', ')) : ''}</li><li>změněno ${d.changed.length}${d.changed.length ? ': ' + esc(d.changed.join(', ')) : ''}</li><li>nastavení kót/výšek: ${d.settingsChanged ? 'změní se' : 'beze změny'}</li></ul>
      Po nahrazení vznikne nová revize ve stavu „návrh“; současný stav se uloží do historie verzí.</div>
      <div class="btns"><div class="spacer"></div><button id="impApply" class="primary">Nahradit celý projekt</button></div>`;
  }
  out.innerHTML = s;
  const ap = out.querySelector('#impApply'); if (ap) ap.onclick = () => { if (!importPending) return; const ok = applyProject(importPending.value, { reason: 'import', format: importPending.info.format }); document.getElementById('modalImport').classList.remove('open'); if (ok) toast(`Načteno ${state.elements.length} prvků · rev ${state.meta.rev}`); };
}

/* ---------- persistence: truthful status, local history (10), checkpoints ---------- */
let db = null, downloads = null, saving = false, lastSaved = 0;
const CLIENT = uid();
const LS_KEY = 'elektro:v3:' + (JOB_ID || PROJECT_SLUG); const HIST_KEY = LS_KEY + ':history';
let storageOk = null, storageErr = null, historyErr = null, bannerKey = null;
function setStatus(txt, cls = '') { const s = document.getElementById('status'); s.textContent = txt; s.className = 'status ' + cls; }
function timeS() { return new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); }
function showBanner(html, cls, buttons, key) { const bn = document.getElementById('banner'); bannerKey = key || 'general'; bn.className = 'banner ' + (cls || ''); bn.innerHTML = `<span>${html}</span>` + (buttons || []).map((b, i) => `<button data-i="${i}">${esc(b[0])}</button>`).join('') + `<button data-i="x" title="skrýt">×</button>`; bn.hidden = false; bn.querySelectorAll('button').forEach(btn => btn.onclick = () => { if (btn.dataset.i === 'x') { bn.hidden = true; return; } buttons[+btn.dataset.i][1](); }); }
function hideBanner(key) { if (!key || bannerKey === key) { document.getElementById('banner').hidden = true; bannerKey = null; } }
const clone = x => JSON.parse(JSON.stringify(x));
function persistNow() {
  const body = { format: FORMAT, schemaVersion: SCHEMA_VERSION, project: { jobId: JOB_ID, geomFp: GEOM_FP, slug: PROJECT_SLUG }, savedAt: new Date().toISOString(), elements: state.elements, settings: state.settings, meta: state.meta };
  try { localStorage.setItem(LS_KEY, JSON.stringify(body)); storageOk = true; storageErr = null; }
  catch (e) { storageOk = false; storageErr = (e && (e.name || e.message)) || 'neznámá chyba'; }
  if (db) scheduleSharedSave();
  updateStatus(); return storageOk;
}
function updateStatus() {
  if (storageOk === false) { setStatus(`NEULOŽENO – prohlížeč odmítl zápis (${storageErr})`, 'err'); showBanner(`Změny se <b>neukládají</b> do prohlížeče (${esc(storageErr)}). Před zavřením stáhni projekt tlačítkem Uložit projekt.`, '', [['Uložit projekt', saveProject]], 'storage'); return; }
  if (storageOk === true) { setStatus(`uloženo v prohlížeči ${timeS()} · ${state.elements.length} prvků · rev ${state.meta.rev}${db ? (sharedState === 'ok' ? ' · sdílené OK' : sharedState === 'err' ? ' · SDÍLENÉ SELHALO' : '') : ''}`, db && sharedState === 'err' ? 'err' : 'ok'); hideBanner('storage'); }
}
let history = [], checkpointT = null, lastCheckpointHash = null;
const REASON_CS = { auto: 'automaticky', 'before-delete': 'před smazáním', 'before-import': 'před importem', 'before-restore': 'před obnovou', 'export-json': 'uložení projektu', 'export-pdf': 'export PDF', unload: 'při zavření', manual: 'ručně' };
function loadHistory() { try { const raw = localStorage.getItem(HIST_KEY); const arr = raw ? JSON.parse(raw) : []; history = Array.isArray(arr) ? arr.filter(x => x && Array.isArray(x.elements) && typeof x.hash === 'string').slice(0, 10) : []; } catch { history = []; } if (history.length) lastCheckpointHash = history[0].hash; }
const historyRestorable = h => !!(h && h.format === FORMAT && h.schemaVersion === SCHEMA_VERSION && h.project && h.project.jobId === JOB_ID && h.project.geomFp === GEOM_FP);
function saveHistory() { try { localStorage.setItem(HIST_KEY, JSON.stringify(history)); historyErr = null; } catch (e) { historyErr = (e && (e.name || e.message)) || 'chyba zápisu'; } }
function pushHistory(reason) {
  const h = contentHash();
  if (history.length && history[0].hash === h) { const rs = history[0].reasons || [history[0].reason]; if (!rs.includes(reason)) { history[0].reasons = [...rs, reason]; saveHistory(); } lastCheckpointHash = h; return false; }   // identical content → no duplicate snapshot
  history.unshift({ format: FORMAT, schemaVersion: SCHEMA_VERSION, project: { jobId: JOB_ID, geomFp: GEOM_FP, slug: PROJECT_SLUG }, at: new Date().toISOString(), reason, reasons: [reason], hash: h, rev: state.meta.rev, status: state.meta.status, author: state.meta.author, count: state.elements.length, elements: state.elements.map(normElem), settings: clone(state.settings), meta: clone(state.meta) });
  history = history.slice(0, 10); saveHistory(); lastCheckpointHash = h; return true;
}
function scheduleCheckpoint() { if (checkpointT) return; checkpointT = setTimeout(() => { checkpointT = null; if (contentHash() !== lastCheckpointHash) pushHistory('auto'); }, 60000); }
function restoreHistory(i) {
  const h = history[i]; if (!h) return;
  const res = validateProjectFile(h);   // the snapshot carries its own format/version/identity – validated unchanged (a snapshot from another geometry or without identity is refused, state untouched)
  if (!res.ok) { toast('Verze z historie neprošla kontrolou: ' + res.errors[0].msg); return; }
  if (applyProject(res.value, { reason: 'restore', format: 'history' })) toast(`Obnovena verze z ${new Date(h.at).toLocaleString('cs-CZ')} · ${state.elements.length} prvků · nová rev ${state.meta.rev}`);
  renderProject();
}
function commit() {
  const h = contentHash();
  if (h !== state.meta.revHash) { state.meta.rev = (state.meta.rev || 0) + 1; state.meta.revHash = h; if (state.meta.status !== 'navrh') { state.meta.status = 'navrh'; toast('Obsah se změnil – stav vrácen na „návrh“'); } }
  state.meta.updatedAt = new Date().toISOString();
  render(); renderNav(); renderProps(); renderHeaderMeta(); persistNow(); scheduleCheckpoint();
}
function setMeta(patch) { const m = validateMeta({ ...state.meta, ...patch }); if (m.errors.length) { toast(m.errors[0].msg); return false; } Object.assign(state.meta, patch); renderHeaderMeta(); persistNow(); return true; }
function renderHeaderMeta() { const b = document.getElementById('btnProject'); b.textContent = `rev ${state.meta.rev} · ${STATUS_CS[state.meta.status] || state.meta.status}`; b.title = `Revize ${state.meta.rev} · stav ${STATUS_CS[state.meta.status]}${state.meta.author ? ' · autor ' + state.meta.author : ''} · historie verzí`; }

/* ---------- file download (artifact downloads capability or plain browser download) ---------- */
async function saveFile(name, data) {
  if (downloads) { try { await downloads.save({ filename: name, data }); toast('Uloženo: ' + name); return true; } catch (e) { if (e && e.code !== 'declined') toast('Uložení se nepodařilo: ' + (e.code || e.message)); return false; } }
  if (!window.claude) {
    try { const blob = data instanceof Blob ? data : new Blob([data], { type: name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.json') ? 'application/json' : 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000); toast('Soubor se stahuje: ' + name); return true; } catch (e) { toast('Stažení se nepodařilo'); return false; }
  }
  toast('Stahování tu není dostupné – použij Načíst/Uložit projekt přes text'); return false;
}

/* ---------- project modal: author, status, revision, history ---------- */
function renderProject() {
  const b = document.getElementById('projectBody'); const m = state.meta;
  const hist = history.length ? history.map((h, i) => `<div class="hist"><div>${esc(new Date(h.at).toLocaleString('cs-CZ'))} · rev ${esc(h.rev)} · ${esc(STATUS_CS[h.status] || h.status)} · ${esc(h.count)} prvků<small>${esc((h.reasons || [h.reason]).map(r => REASON_CS[r] || r).join(', '))}${h.author ? ' · ' + esc(h.author) : ''}${h.hash === contentHash() ? ' · = aktuální obsah' : ''}</small></div><button data-i="${i}" ${h.hash === contentHash() || !historyRestorable(h) ? 'disabled' : ''} title="${historyRestorable(h) ? 'nahradit celý projekt touto verzí' : 'snímek bez identity této zakázky/geometrie – nelze obnovit'}">Obnovit${historyRestorable(h) ? '' : ' (jiná geometrie)'}</button></div>`).join('') : '<div class="empty">Zatím žádné uložené verze.</div>';
  b.innerHTML = `<h2>Zakázka</h2><div class="kv"><b>Název</b><span>${esc(PROJECT.title)}${PROJECT.address ? ' · ' + esc(PROJECT.address) : ''}</span><b>Identita (jobId)</b><span>${esc(JOB_ID || 'nemá – starý build')}</span><b>Otisk geometrie</b><span>${esc(GEOM_FP || '–')} <span class="unit">(${PROJECT.walls.length} stěn, ${Object.keys(ROOMS).length} místností)</span></span><b>Verze editoru</b><span>v${APP_VERSION} · schéma ${SCHEMA_VERSION}${PROJECT.buildInfo ? ' · sestaveno ' + esc(PROJECT.buildInfo.builtAt) : ''}</span></div>
  <h2>Revize a stav</h2>
  <div class="field"><label>Autor</label><input type="text" id="pjAuthor" value="${esc(m.author || '')}" maxlength="${LIM.maxAuthor}" placeholder="kdo návrh zpracoval"></div>
  <div class="field"><label>Stav</label><select id="pjStatus">${STATUSES.map(s => `<option value="${s}" ${s === m.status ? 'selected' : ''}>${STATUS_CS[s]}</option>`).join('')}</select></div>
  <div class="kv"><b>Revize</b><span>rev ${m.rev} <span class="unit">(mění se jen se změnou obsahu; export ji nemění)</span></span><b>Poslední změna</b><span>${m.updatedAt ? esc(new Date(m.updatedAt).toLocaleString('cs-CZ')) : '–'}</span>${m.importedFrom ? `<b>Naposledy načteno</b><span>${esc(REASON_CS['before-' + m.importedFrom.reason] ? m.importedFrom.reason : m.importedFrom.reason)} · ${esc(m.importedFrom.format)}${m.importedFrom.rev != null ? ' · původně rev ' + esc(m.importedFrom.rev) + ' (' + esc(STATUS_CS[m.importedFrom.status] || m.importedFrom.status || '–') + ')' : ''} · ${esc(new Date(m.importedFrom.at).toLocaleString('cs-CZ'))}</span>` : ''}</div>
  <p class="unit" style="margin:4px 0 0">Změna obsahu ve stavu „ověřeno“ nebo „schváleno“ vrátí stav na „návrh“. Načtení souboru nebo obnova z historie vytvoří novou revizi ve stavu „návrh“.</p>
  <h2>Ukládání</h2>
  <div class="kv"><b>Prohlížeč</b><span>${storageOk === true ? 'uloženo (localStorage)' : storageOk === false ? '<b style="color:var(--acc)">SELHÁVÁ: ' + esc(storageErr) + '</b>' : 'zatím nic'}</span><b>Historie verzí</b><span>${history.length}/10${historyErr ? ' · <b style="color:var(--acc)">zápis historie selhal: ' + esc(historyErr) + '</b>' : ''}</span><b>Přenos</b><span>soubor JSON přes Uložit / Načíst projekt (žádná automatická synchronizace mezi počítači)</span></div>
  <div class="btns"><button id="pjSnap">Uložit verzi do historie teď</button><button id="pjSave">Uložit projekt (soubor)</button></div>
  <h2>Historie posledních 10 verzí</h2>${hist}`;
  b.querySelector('#pjAuthor').onchange = ev => { if (setMeta({ author: ev.target.value.trim() })) toast('Autor uložen'); };
  b.querySelector('#pjStatus').onchange = ev => { if (setMeta({ status: ev.target.value })) { toast('Stav: ' + STATUS_CS[state.meta.status]); pushHistory('manual'); renderProject(); } };
  b.querySelector('#pjSnap').onclick = () => { toast(pushHistory('manual') ? 'Verze uložena do historie' : 'Tato verze už v historii je'); renderProject(); };
  b.querySelector('#pjSave').onclick = saveProject;
  b.querySelectorAll('.hist button').forEach(btn => btn.onclick = () => restoreHistory(+btn.dataset.i));
}

/* ---------- modals, tabs, help ---------- */
const openModal = id => document.getElementById(id).classList.add('open');
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { const m = b.closest('.modal'); m.classList.remove('open'); if (m.id === 'modalHeight' && heightResolver) heightResolver(null); });
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', ev => { if (ev.target === m) { m.classList.remove('open'); if (m.id === 'modalHeight' && heightResolver) heightResolver(null); } }));
document.getElementById('btnList').onclick = () => { renderList(); openModal('modalList'); };
document.getElementById('btnSettings').onclick = () => { renderSettings(); openModal('modalSettings'); };
document.getElementById('btnProject').onclick = () => { renderProject(); openModal('modalProject'); };
document.getElementById('btnLoad').onclick = () => { renderImport(); openModal('modalImport'); };
document.getElementById('btnSave').onclick = saveProject;
document.getElementById('btnHelp').onclick = () => { document.getElementById('helpBody').innerHTML = HELP_HTML; const lb = document.getElementById('licBtn'); if (lb) lb.onclick = () => { const pre = document.getElementById('licPre'); if (pre.hidden) { const t = document.getElementById('licensesText'); pre.textContent = t ? t.textContent : '(licence nejsou přibaleny)'; } pre.hidden = !pre.hidden; }; openModal('modalHelp'); };
document.getElementById('btnCsv').onclick = () => saveFile(projectFileName('csv'), '﻿' + csvText());
document.getElementById('btnUndo').onclick = undo; document.getElementById('btnRedo').onclick = redo;
document.getElementById('chkDims').onchange = ev => { showDims = ev.target.checked; render(); };
const isMobile = () => { const t = document.querySelector('.tabs'); return !!(t && t.offsetParent !== null); };
function showTab(t) { const side = document.getElementById('side'); side.classList.remove('tab-nav', 'tab-palette', 'tab-props'); side.classList.add('tab-' + t); document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
document.getElementById('navToggle').onclick = () => showTab('nav');
function placeNav() { const nav = document.getElementById('nav'); const side = document.getElementById('side'); const main = document.querySelector('.main'); if (!nav || !side || !main) return; if (isMobile()) { if (nav.parentElement !== side) side.insertBefore(nav, side.querySelector('.palette')); if (!side.classList.contains('tab-nav') && !side.classList.contains('tab-props')) showTab('palette'); } else { if (nav.parentElement !== main) main.insertBefore(nav, main.firstChild); side.classList.remove('tab-nav', 'tab-palette', 'tab-props'); } }
window.addEventListener('resize', placeNav);
const HELP_HTML = `
<h2>Co je co</h2>
<p><b>Vlevo</b> (na tabletu záložka <b>Stěny</b>) je seznam místností; po rozkliknutí vidíš půdorys místnosti a její stěny pojmenované <b>podle výkresu</b> (stěna vlevo / vpravo / nahoře / dole při pohledu na půdorys, u dvojic navíc levá/pravá nebo horní/dolní), s délkou a s tím, jestli je v ní okno nebo dveře. Světové strany se nepoužívají – report je neuvádí spolehlivě. Výška stropu místnosti (z reportu) se ukazuje u stropního prvku ve vlastnostech; ⚠ u místnosti znamená neověřenou hodnotu.<br><b>Uprostřed</b> výkres: kolečkem (na tabletu dvěma prsty) přibližuješ, tažením prázdné plochy posouváš, ⤢ vrátí celou stěnu. Malý půdorys v rohu ukazuje červeně, o kterou stěnu jde.<br><b>Vpravo</b> (záložky <b>Prvky</b> a <b>Vlastnosti</b>) paleta prvků a vlastnosti vybraného prvku.</p>
<h2>Barvy a označení</h2>
<p>Barva značky říká, o jaký okruh jde: <b style="color:#C6321B">červená</b> silnoproud (zásuvky a vývody pro spotřebiče), <b style="color:#1B7A3E">zelená</b> ovládání (vypínače, stmívač, tlačítko, termostat, čidlo), <b style="color:#1F5FBF">modrá</b> světla, <b style="color:#7A3E9D">fialová</b> slaboproud (data, TV, domácí telefon). Značky se liší i tvarem, takže černobílý tisk zůstane čitelný. Vybraný prvek je oranžový. Za označením je zkratka typu: <b>Z3 IP</b> = zásuvka IP44, <b>P5 VD</b> = vývod pro varnou desku, <b>D2 TV</b>, <b>PIR</b>, <b>M</b> ventilátor; vysvětlení je v legendě PDF.</p>
<h2>Světové strany</h2>
<p>Report z magicplanu orientaci neuvádí, proto se <b>sever nastaví jednou</b> v <b>⚙ Nastavení → Sever</b> (osm směrů). Podle něj se pojmenují stěny – <b>Stěna dole (J)</b> je stěna, která je na výkrese dole a míří na jih – a v každém půdorysu přibude v okraji <b>růžice</b> se šipkou k severu a písmena <b>S · J · V · Z</b> u jednotlivých stran. Vše je v okraji, mimo kresbu, aby to nepřekáželo; do exportovaného PDF se to propíše taky. Když sever přenastavíš, názvy stěn v seznamu, v soupisu i v PDF se přepočítají.</p>
<h2>Názvy místností</h2>
<p>Anglické názvy místností z reportu (Kitchen, Bedroom …) jsou ve výkresu i v exportovaném PDF překryté českými názvy stejnými jako v seznamu vlevo (Kuchyň, Ložnice, Ložnice 2 …). Původní report se tím nemění, jde jen o překryv.</p>
<h2>Schémata stěn</h2>
<p>Stěny označené <b>schéma</b> report neobsahuje jako pohled; jsou odhadnuté z půdorysu (délka a výška z reportu, dveře orientačně). Takto jsou označené i v soupisu, CSV a PDF. Rozměry na nich ber jako orientační.</p>
<h2>Zakreslení nového prvku</h2>
<p>Klikni na prvek v paletě a potom do výkresu. <b>V pohledu stěny</b> se prvek umístí tam, kam klikneš, výška se přichytí na standard (zásuvka 300, vypínač 1150 …); s <kbd>Alt</kbd> zůstane přesná výška z kliknutí. <b>V půdorysu</b> klikni k stěně – prvek se přichytí na stěnu té místnosti, do které jsi klikl (u společných stěn rozhoduje strana). Stropní světla a bodovky se kladou volně dovnitř místnosti a dostanou <b>výšku stropu místnosti podle reportu</b>; pokud je výška stropu neověřená (⚠), editor si ji vyžádá ručně a prvek označí jako „ruční, neověřeno“. Pokládání ukončíš klávesou <kbd>Esc</kbd> nebo tlačítkem ↖ Výběr.</p>
<h2>Úprava umístěného prvku</h2>
<p>Klikni na prvek ve výkresu nebo na jeho označení (Z1, V2 …) vpravo. Potom ho můžeš táhnout (drží se v mezích stěny nebo půdorysu místnosti; přetažením volného prvku do jiné místnosti se změní i jeho místnost), posouvat šipkami po 10 mm (<kbd>Shift</kbd> = 100 mm) nebo zadat čísla: <b>Výška</b> v mm od čisté podlahy ke středu prvku, <b>Měřit od</b> + <b>Vzdálenost</b> = přesná poloha od levého/pravého rohu nebo od hrany dveří / okna. <b>Neplatná hodnota</b> (mimo stěnu, text, záporné číslo) se nepřijme a zůstane původní – editor řekne proč. Prvek v otvoru (dveře/okno) dostane upozornění, ale není blokován.</p>
<h2>Světla volně v půdorysu</h2>
<p>Ve vlastnostech zadáš vzdálenost <b>od stěny ↔</b> a <b>od stěny ↕</b> v mm (a ke které stěně místnosti se měří). <b>Na střed</b> najde bod nejdál od stěn (funguje i u místností do L), <b>Rastr</b> rozmístí bodovky rovnoměrně <b>uvnitř skutečného půdorysu</b> (např. 2 × 3).</p>
<h2>Napojení vypínačů</h2>
<p>Vyber vypínač (nebo tlačítko či stmívač), ve vlastnostech klikni na <b>＋ Napojit kliknutím</b> a potom ve výkresu klikej na prvky, které má spínat – každé kliknutí napojení přidá nebo zruší. Hotovo klávesou <kbd>Esc</kbd>. Napojené prvky se vypíšou u vypínače jako štítky (křížkem se odeberou) a u světla se ukáže, <b>ze kterého vypínače</b> se spíná. V půdorysu se mezi nimi kreslí tenká čárkovaná čára, v soupisu, CSV i v PDF je sloupec <b>Ovládá</b> („V1 → S1, S2“ u vypínače, „z V1“ u světla). Spojnice se kreslí jen v půdorysech, kde je vidět obě strany; jeden vypínač jich unese nejvýš 16. Když napojený prvek smažeš, vazba se sama zruší.</p>
<h2>Mazání a zpět</h2>
<p>Vybraný prvek smažeš tlačítkem <b>Smazat</b>, klávesou <kbd>Delete</kbd> nebo pravým tlačítkem myši na prvku. Cokoliv vrátíš přes <b>Zpět</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>); před každým smazáním se navíc uloží verze do historie.</p>
<h2>Kóty</h2>
<p>Kreslí se samy: podél stěny řetězec vzdáleností roh → hrana zárubně → prvek → prvek … v mm, výšky jako čárkované úrovně přes stěnu. Styl kót a kótování celkového půdorysu se nastavuje v <b>⚙</b>; zaškrtávátko „kóty“ nad výkresem je jen dočasně vypne.</p>
<h2>Výstupy</h2>
<p><b>Export PDF</b> zakreslí prvky do původního výkresu, přidá schémata, legendu a soupis; každá strana výsledku má zápatí „list X/Y“ s revizí, stavem a autorem a s odlišením podkladu magicplan (původní číslo strany) od příloh. Volitelně lze exportovat jen dotčené stránky. <b>Soupis</b> je tabulka po místnostech (CSV má oddělené sloupce reference, vzdálenost a směr; u volných prvků dvě vzdálenosti). Dlouhé poznámky se v PDF zalamují, nic se nezkracuje.</p>
<h2>Ukládání, revize, přenos</h2>
<p>Stav nahoře říká pravdu: „uloženo v prohlížeči HH:MM“ jen když zápis skutečně proběhl; při selhání svítí červené <b>NEULOŽENO</b> a pruh s tlačítkem Uložit projekt. Historie posledních 10 verzí (včetně nastavení a revize) je pod tlačítkem <b>rev …</b>, kde se také nastavuje autor a stav (návrh / ověřeno / schváleno). Revize roste jen se změnou obsahu; export ji nemění; změna ověřeného nebo schváleného obsahu vrací stav na návrh. Předání mezi lidmi = <b>Uložit projekt</b> (soubor JSON) a <b>Načíst projekt</b> u příjemce: soubor se nejdřív celý zkontroluje (zakázka, geometrie, prvky, stěny, označení), ukáže se náhled změn a teprve po potvrzení se nahradí celý projekt. Cizí zakázka nebo jiná geometrie se nenačte. Jde o ruční předání souboru, ne o souběžnou synchronizaci – pracuje vždy jeden člověk.</p>
<h2>Offline a licence</h2>
<p>Soubor je samostatný: podklady, knihovny pro PDF (pdf-lib, fontkit) i písmo (DejaVu Sans) jsou vložené, nic se nestahuje z internetu. <button id="licBtn" type="button">Zobrazit licence</button></p><pre class="lic" id="licPre" hidden></pre>
<h2>Zkratky</h2>
<p><kbd>Esc</kbd> konec pokládání / zrušit výběr · <kbd>Delete</kbd> smazat · <kbd>Ctrl</kbd>+<kbd>Z</kbd> zpět · <kbd>Ctrl</kbd>+<kbd>Y</kbd> znovu · šipky posun 10 mm, se <kbd>Shift</kbd> 100 mm · kolečko / dva prsty zoom · <kbd>Alt</kbd>+klik přesná výška · <kbd>Shift</kbd>+klik stropního světla v půdorysu = přichytit na stěnu</p>`;
let toastT; function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
window.addEventListener('error', ev => { setStatus('chyba: ' + (ev.message || 'neznámá'), 'err'); });
window.addEventListener('unhandledrejection', ev => { const r = ev.reason; setStatus('chyba: ' + ((r && (r.message || r.code)) || r), 'err'); });

/* ---------- shared (db) variant – only for builds with SHARED_SAVE; validated, truthful ---------- */
let sharedState = null, sharedT = null;
const sharedRef = () => db.doc('elektro_zakazky/' + (JOB_ID || PROJECT_SLUG) + '/stav/aktualni');
function scheduleSharedSave() { clearTimeout(sharedT); sharedT = setTimeout(sharedSave, 700); }
async function sharedSave() {
  if (!db) return;
  try { saving = true; await sharedRef().set({ format: FORMAT, schemaVersion: SCHEMA_VERSION, project: { jobId: JOB_ID, geomFp: GEOM_FP }, elements: state.elements, settings: state.settings, meta: state.meta, updatedAt: state.meta.updatedAt || new Date().toISOString(), client: CLIENT }); lastSaved = state.meta.rev; sharedState = 'ok'; }
  catch (e) { sharedState = 'err'; showBanner('Sdílené úložiště: uložení selhalo (' + esc((e && (e.code || e.message)) || e) + '). Lokální kopie v prohlížeči ' + (storageOk ? 'je uložená' : 'NENÍ uložená') + ' – stáhni projekt.', '', [['Uložit projekt', saveProject]], 'shared'); }
  finally { saving = false; updateStatus(); }
}
function loadLocalState() {
  let raw = null; try { raw = localStorage.getItem(LS_KEY); } catch { return { loaded: false, reason: 'localStorage nedostupný' }; }
  if (!raw) return { loaded: false };
  let j; try { j = JSON.parse(raw); } catch { return { loaded: false, reason: 'uložený stav nejde přečíst (poškozený JSON)' }; }
  const res = validateProjectFile(j);   // stored as written by persistNow (format, schemaVersion, project identity) – validated unchanged
  if (!res.ok) return { loaded: false, reason: res.errors[0].msg, raw };
  state.elements = res.value.elements; state.settings = res.value.settings; state.meta = { ...freshMeta(), ...res.value.meta, importedFrom: j.meta && j.meta.importedFrom ? j.meta.importedFrom : undefined };
  if (!state.meta.revHash) state.meta.revHash = contentHash();
  return { loaded: true };
}
async function initCaps() {
  loadHistory();
  let r = loadLocalState(); let loaded = r.loaded;
  if (!loaded && r.reason) showBanner('Uložený stav v prohlížeči nebyl načten: ' + esc(r.reason) + '. Historie verzí (rev …) může obsahovat použitelnou verzi.', 'warn', [], 'load');
  if (!loaded && INITIAL && Array.isArray(INITIAL.elements)) {
    const res = validateProjectFile({ format: FORMAT, schemaVersion: SCHEMA_VERSION, project: { jobId: JOB_ID, geomFp: GEOM_FP }, elements: INITIAL.elements, settings: INITIAL.settings });
    if (res.ok) { state.elements = res.value.elements; state.settings = res.value.settings; state.meta = { ...freshMeta(), rev: 1 }; state.meta.revHash = contentHash(); loaded = true; }
    else showBanner('Výchozí návrh vložený do souboru neprošel kontrolou a nebyl načten: ' + esc(res.errors[0].msg), 'warn', [], 'load');
  }
  dimStyle = state.settings.dimStyle || 'chain';
  render(); renderNav(); renderProps(); renderPalette(); renderHeaderMeta();
  if (!SHARED_SAVE) { downloads = window.claude && window.claude.use ? await claude.use('downloads') : null; setStatus(loaded ? `načteno z prohlížeče · ${state.elements.length} prvků · rev ${state.meta.rev}` : 'nový projekt · ukládá se jen v tomto prohlížeči', loaded ? '' : 'dirty'); return; }
  if (!window.VRANA_DB) { setStatus('sdílené úložiště nedostupné – ukládá se jen v prohlížeči', 'err'); return; }
  db = window.VRANA_DB; const ref = sharedRef();
  try {
    const snap = await ref.get(); const remote = snap.exists ? snap.data() : null;
    if (remote) {
      const res = validateProjectFile(remote);   // as stored – no format/identity substitution
      if (!res.ok) showBanner('Sdílený stav neprošel kontrolou a nebyl načten: ' + esc(res.errors[0].msg), 'warn', [], 'shared');
      else if ((remote.updatedAt || '') > (state.meta.updatedAt || '') && contentHash({ elements: res.value.elements, settings: res.value.settings }) !== contentHash()) { pushHistory('before-import'); state.elements = res.value.elements; state.settings = res.value.settings; state.meta = { ...freshMeta(), ...res.value.meta }; if (!state.meta.revHash) state.meta.revHash = contentHash(); dimStyle = state.settings.dimStyle || 'chain'; render(); renderNav(); renderProps(); renderHeaderMeta(); }
    }
    persistNow(); toast(`Načteno · ${state.elements.length} prvků · rev ${state.meta.rev}`);   // status stays with updateStatus (a failed local write must remain visible)
    ref.onSnapshot(s => {
      if (!s.exists || s.metadata.hasPendingWrites || saving) return; const j = s.data(); if (j.client === CLIENT) return;
      if ((j.updatedAt || '') <= (state.meta.updatedAt || '')) return;
      const res = validateProjectFile(j); if (!res.ok) { showBanner('Změna z jiného okna neprošla kontrolou: ' + esc(res.errors[0].msg), 'warn', [], 'shared'); return; }
      if (contentHash({ elements: res.value.elements, settings: res.value.settings }) === contentHash()) return;
      pushHistory('before-import'); state.elements = res.value.elements; state.settings = res.value.settings; state.meta = { ...freshMeta(), ...res.value.meta }; if (!state.meta.revHash) state.meta.revHash = contentHash(); selId = null; render(); renderNav(); renderProps(); renderHeaderMeta(); persistNow(); toast('Aktualizováno z jiného okna · ' + state.elements.length + ' prvků');
    }, e => setStatus('sdílené úložiště: ' + (e && e.code), 'err'));
  } catch (e) { setStatus('sdílené úložiště: chyba načtení (' + (e && (e.code || e.message)) + ')', 'err'); }
}

/* ---------- PDF export: overlays into the original report + schematic walls + wrapped legend/schedule, footer on every page ---------- */
async function bytesFromUrl(url) {
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error('nepodařilo se načíst ' + url + ' (' + r.status + ')');
  return new Uint8Array(await r.arrayBuffer());
}
function b64ToBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
let exporting = false;
async function exportPDF(opts = {}) {
  if (exporting) return null; exporting = true;
  const btn = document.getElementById('btnExport'); btn.disabled = true; btn.textContent = 'Generuji…';
  try {
    if (typeof PDFLib === 'undefined' || typeof fontkit === 'undefined') throw new Error('knihovny pro PDF (pdf-lib, fontkit) nejsou v souboru k dispozici');
    const { PDFDocument, rgb, degrees } = PDFLib;
    const [pdfBytes, fontBytes] = await Promise.all([bytesFromUrl(PDF_URL), bytesFromUrl(FONT_URL)]);
    const doc = await PDFDocument.load(pdfBytes); doc.registerFontkit(fontkit);
    const font = await doc.embedFont(fontBytes, { subset: true });
    const RED = rgb(0.78, 0.2, 0.1), INK = rgb(0.12, 0.13, 0.15), GREY = rgb(0.45, 0.47, 0.5), DIM = rgb(0.24, 0.29, 0.36), WARN = rgb(0.6, 0.42, 0.08);
    const hexRgb = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255); const colOf = t => hexRgb(symColor(t));
    const safePage = p => { if (!p.__safe) { const orig = p.drawText.bind(p); p.drawText = (s, o) => orig(glyphSafe(s), o); p.__safe = true; } return p; };
    const pages = doc.getPages().map(safePage); const origCount = pages.length;
    const addPage = size => safePage(doc.addPage(size));
    const meta = state.meta; const dateS = new Date().toLocaleDateString('cs-CZ');
    const metaLine = `rev. ${meta.rev} · ${STATUS_CS[meta.status] || meta.status}${meta.author ? ' · ' + meta.author : ''} · ${dateS}`;
    const PW = 595.28, PH = 841.89, ML = 40, MR = 40, CONTENT_W = PW - ML - MR;
    let charSet = null; try { charSet = new Set(font.getCharacterSet()); } catch { charSet = null; }
    let replaced = 0; const glyphSafe = s => { s = String(s ?? ''); if (!charSet) return s; let out = ''; for (const ch of s) { const cp = ch.codePointAt(0); if (cp === 10 || cp === 13 || cp === 9 || charSet.has(cp)) out += ch; else { out += '?'; replaced++; } } return out; };
    const rawDrawText = pg => pg.drawText.bind(pg);
    const tw = (s, size) => font.widthOfTextAtSize(glyphSafe(s), size);
    const fit = (s, w, size) => { s = String(s); if (tw(s, size) <= w) return s; let cut = s; while (cut.length > 1 && tw(cut + '...', size) > w) cut = cut.slice(0, -1); return cut + '...'; };
    const wrap = (s, w, size) => { const lines = []; for (const para of String(s ?? '').split(/\r?\n/)) { const words = para.split(/\s+/).filter(Boolean); if (!words.length) { lines.push(''); continue; } let line = ''; for (let word of words) { while (tw(word, size) > w) { let cut = word.length - 1; while (cut > 1 && tw(word.slice(0, cut), size) > w) cut--; if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, cut)); word = word.slice(cut); } const t = line ? line + ' ' + word : word; if (tw(t, size) <= w) line = t; else { if (line) lines.push(line); line = word; } } lines.push(line); } return lines.length ? lines : ['']; };
    const stamp = (pg, txt) => { const { height } = pg.getSize(); pg.drawText(fit(txt, 320, 7), { x: 235, y: height - 30, size: 7, font, color: RED }); };
    stamp(pages[0], 'ELEKTROINSTALACE – KONCOVÉ PRVKY · ' + metaLine);
    // Czech room names over the report's English words (same names as in the wall list)
    for (const l of ROOM_LABELS) {
      const p = pages[l.page]; if (!p) continue; const Hh = p.getSize().height; const size = l.size * 0.95; const twd = tw(l.cs, size); const w = Math.max(l.x1 - l.x0, twd) + 4; const h = l.bottom - l.top + 2;
      const x = l.center ? (l.x0 + l.x1) / 2 - w / 2 : l.x0 - 1;
      p.drawRectangle({ x, y: Hh - (l.top - 1) - h, width: w, height: h, color: l.bg ? hexRgb(l.bg) : rgb(1, 1, 1) });
      p.drawText(l.cs, { x: l.center ? (l.x0 + l.x1) / 2 - twd / 2 : l.x0, y: Hh - (l.bottom - (l.bottom - l.top) * 0.22), size, font, color: INK });
    }
    const touched = new Set(); const added = [];
    for (const sec of SECTIONS) {
      const items = overlayItems(sec); if (!items.length) continue; const prims = sectionDims(sec); layoutOverlay(sec, items, prims);
      let pg; if (sec.synthetic) { pg = addPage([PW, PH]); added.push({ pg, kind: 'schema' }); } else { pg = pages[sec.page]; touched.add(sec.page); }
      const H = pg.getSize().height; const Y = y => H - y;
      if (sec.kind === 'plan') {                     // čárkované spojnice spínač → ovládaný prvek
        const kde = new Map(items.map(it => [it.e.id, it.origin]));
        for (const it of items) { if (!isSwitch(it.e.type)) continue;
          for (const id of controlsOf(it.e)) { const c = kde.get(id); if (!c) continue; const COL = colOf(it.e.type);
            pg.drawLine({ start: { x: it.origin[0], y: Y(it.origin[1]) }, end: { x: c[0], y: Y(c[1]) }, thickness: 0.45, color: COL, dashArray: [2.4, 1.8] });
            pg.drawCircle({ x: c[0], y: Y(c[1]), size: 1.1, color: COL });
          } }
      }
      if (sec.kind === 'plan') {                     // růžice + písmena světových stran do okraje výkresu
        const bb = sec.bbox, m = 9, GN = rgb(0.55, 0.57, 0.6);
        const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
        const put = (x, y, t, size, anch) => { const tw = font.widthOfTextAtSize(t, size); pg.drawText(t, { x: x - (anch === 'middle' ? tw / 2 : anch === 'end' ? tw : 0), y: Y(y) - size * 0.35, size, font, color: GN }); };
        put(cx, bb[1] + m, dirCompass(0, -1), 7, 'middle'); put(cx, bb[3] - m, dirCompass(0, 1), 7, 'middle');
        put(bb[0] + m, cy, dirCompass(-1, 0), 7, 'middle'); put(bb[2] - m, cy, dirCompass(1, 0), 7, 'middle');
        const r = 7, a = (northDeg() - 90) * Math.PI / 180, px = bb[2] - m * 1.6, py = bb[1] + m * 1.6;
        const tip = [px + Math.cos(a) * r, py + Math.sin(a) * r], tail = [px - Math.cos(a) * r * 0.75, py - Math.sin(a) * r * 0.75], per = [-Math.sin(a) * r * 0.34, Math.cos(a) * r * 0.34];
        pg.drawCircle({ x: px, y: Y(py), size: r + 2.5, borderWidth: 0.4, borderColor: GN });
        pg.drawSvgPath(`M ${tip[0]} ${tip[1]} L ${tail[0] + per[0]} ${tail[1] + per[1]} L ${tail[0] - per[0]} ${tail[1] - per[1]} Z`, { x: 0, y: H, color: GN, borderWidth: 0 });
        put(tip[0], tip[1] - 3.6, 'S', 5.4, 'middle');
      }
      if (sec.synthetic) {
        const w = WALLS[sec.wallId]; const f = w.face; const G = rgb(0.55, 0.57, 0.6), K = rgb(0.23, 0.25, 0.28);
        pg.drawText(fit(`${roomCs(w.room)} · ${w.name || ''} · ${isMerged(w) ? 'SLOUČENÝ POHLED' : 'SCHÉMA'}`, CONTENT_W, 11), { x: f[0], y: Y(f[1] - 26), size: 11, font, color: INK });
        pg.drawText(fit(isMerged(w) ? `sloučený pohled – report kreslí tuto stěnu po částech (${w.mergedFrom.join(' + ')}) · délka ${fmtM(w.lenM)} · výška ${fmtM(w.chM)} (z reportu)` : `schéma stěny – odhad z půdorysu, report neobsahuje pohled · délka ${fmtM(w.lenM)} · výška ${fmtM(w.chM)} (z reportu)`, PW - f[0] - MR, 7), { x: f[0], y: Y(f[1] - 13), size: 7, font, color: G });
        pg.drawRectangle({ x: f[0], y: Y(f[3]), width: f[2] - f[0], height: f[3] - f[1], color: rgb(0.94, 0.94, 0.94), borderColor: K, borderWidth: 0.8 });
        pg.drawLine({ start: { x: f[0] - 20, y: Y(f[3]) }, end: { x: f[2] + 20, y: Y(f[3]) }, thickness: 1.2, color: K });
        for (const o of w.openings) { const x = f[0] + o.u0 * w.ppm, wd = (o.u1 - o.u0) * w.ppm, y1 = f[3] - o.h1 * w.ppm, y0 = f[3] - o.h0 * w.ppm; pg.drawRectangle({ x, y: Y(y0), width: wd, height: y0 - y1, color: rgb(1, 1, 1), borderColor: K, borderWidth: 0.7 }); }
        const gd = (a, b, text, off) => { const d = vnorm(vsub(b, a)); const n = [-d[1], d[0]]; const t = 2; pg.drawLine({ start: { x: a[0], y: Y(a[1]) }, end: { x: b[0], y: Y(b[1]) }, thickness: 0.5, color: G }); for (const p of [a, b]) pg.drawLine({ start: { x: p[0] - (d[0] - n[0]) * t, y: Y(p[1] - (d[1] - n[1]) * t) }, end: { x: p[0] + (d[0] - n[0]) * t, y: Y(p[1] + (d[1] - n[1]) * t) }, thickness: 0.6, color: G }); const mid = [(a[0] + b[0]) / 2 + off[0] * 4, (a[1] + b[1]) / 2 + off[1] * 4]; const twd = tw(text, 7); if (Math.abs(d[0]) < 0.01) pg.drawText(text, { x: mid[0] + 2.4, y: Y(mid[1]) - twd / 2, size: 7, font, color: G, rotate: degrees(90) }); else pg.drawText(text, { x: mid[0] - twd / 2, y: Y(mid[1]) - 2.4, size: 7, font, color: G }); };
        gd([f[0], f[3] + 14], [f[2], f[3] + 14], fmtM(w.lenM), [0, 1]); gd([f[0] - 30, f[3]], [f[0] - 30, f[1]], fmtM(w.chM), [-1, 0]);
        for (const o of w.openings) gd([f[0] + o.u0 * w.ppm, f[1] - 6], [f[0] + o.u1 * w.ppm, f[1] - 6], fmtM(o.u1 - o.u0), [0, -1]);
        pg.drawText(fit(PROJECT.title + (PROJECT.address ? ' · ' + PROJECT.address : '') + ' · ' + metaLine, CONTENT_W, 8), { x: ML, y: H - 40, size: 8, font, color: G });
      }
      const line = (a, b, wd = 0.75, c = RED) => pg.drawLine({ start: { x: a[0], y: Y(a[1]) }, end: { x: b[0], y: Y(b[1]) }, thickness: wd, color: c });
      const drawOpsPdf = (ops, origin, ex, ey, COL = RED) => {
        const T = ([x, y]) => [origin[0] + x * ex[0] + y * ey[0], origin[1] + x * ex[1] + y * ey[1]];
        for (const o of ops) {
          if (o.op === 'line') { const [a, b] = o.p.map(T); line(a, b, 0.75, COL); }
          else if (o.op === 'circle') { const c = T(o.c); pg.drawCircle({ x: c[0], y: Y(c[1]), size: o.r, borderWidth: 0.75, borderColor: COL, color: o.fill ? COL : undefined }); }
          else if (o.op === 'poly') { const pts = o.pts.map(T); const d = 'M ' + pts.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') + (o.close ? ' Z' : ''); pg.drawSvgPath(d, { x: 0, y: H, borderWidth: 0.75, borderColor: COL, color: o.fill ? COL : undefined }); }
          else if (o.op === 'text') { const p = T([o.x, o.y]); const twd = tw(o.s, o.size); pg.drawText(o.s, { x: p[0] - (o.anchor === 'middle' ? twd / 2 : 0), y: Y(p[1]) - o.size * 0.35, size: o.size, font, color: COL }); }
        }
      };
      const dimPdf = (a, b, text, off, lift = 0, slide = 0) => {
        const d = vnorm(vsub(b, a)); const n = [-d[1], d[0]]; const t = 1.8;
        line(a, b, 0.4, DIM); for (const p of [a, b]) line([p[0] - (d[0] - n[0]) * t, p[1] - (d[1] - n[1]) * t], [p[0] + (d[0] - n[0]) * t, p[1] + (d[1] - n[1]) * t], 0.6, DIM);
        const o = 3.2 + lift; const mid = [(a[0] + b[0]) / 2 + off[0] * o + d[0] * slide, (a[1] + b[1]) / 2 + off[1] * o + d[1] * slide]; const size = T_DIM; const twd = tw(text, size);
        if (lift || slide) line([(a[0] + b[0]) / 2 + d[0] * slide, (a[1] + b[1]) / 2 + d[1] * slide], [mid[0] - off[0] * 2.8, mid[1] - off[1] * 2.8], 0.3, DIM);
        if (Math.abs(d[0]) < 0.01) pg.drawText(text, { x: mid[0] + size * 0.35, y: Y(mid[1]) - twd / 2, size, font, color: DIM, rotate: degrees(90) });
        else pg.drawText(text, { x: mid[0] - twd / 2, y: Y(mid[1]) - size * 0.35, size, font, color: DIM });
      };
      for (const p of prims) {
        if (p.kind === 'dim') dimPdf(p.a, p.b, p.text, p.off, p.lift, p.slide);
        else if (p.kind === 'witness') line(p.a, p.b, 0.3, DIM);
        else if (p.kind === 'level') { pg.drawLine({ start: { x: p.a[0], y: Y(p.a[1]) }, end: { x: p.b[0], y: Y(p.b[1]) }, thickness: 0.3, color: DIM, dashArray: [2, 1.5] }); const twd = tw(p.text, T_DIM); pg.drawText(p.text, { x: p.side === 'R' ? p.b[0] + 2.5 : p.a[0] - 2.5 - twd, y: Y(p.a[1]) - T_DIM * 0.35, size: T_DIM, font, color: DIM }); }
        else if (p.kind === 'tag') pg.drawText(p.text, { x: p.p[0], y: Y(p.p[1]) - T_TAG * 0.35, size: T_TAG, font, color: DIM });
      }
      for (const it of items) {
        if ((dimStyle === 'each' || !it.e.wallId) && !(sec.isMain && !state.settings.mainPlanDims && dimStyle !== 'each')) for (const dm of it.dims) dimPdf(dm.a, dm.b, dm.text, dm.off, dm.lift || 0, dm.slide || 0);
        const k = sec.isMain ? 1.3 : 1; const COL = colOf(it.e.type);
        drawOpsPdf(SYM[it.e.type].ops(), it.origin, [it.ex[0] * k, it.ex[1] * k], [it.ey[0] * k, it.ey[1] * k], COL);
        if (it.e.count > 1) pg.drawText('×' + it.e.count, { x: it.origin[0] + it.ex[0] * (R + 1.5) + it.ey[0] * 1.5, y: Y(it.origin[1] + it.ex[1] * (R + 1.5) + it.ey[1] * 1.5) - T_CNT * 0.35, size: T_CNT, font, color: COL });
        if (it.leader) line(it.leader[0], it.leader[1], 0.3, COL);
        const txt = labelText(it.e); const lw = tw(txt, T_LBL); const ax = it.label[2] === 'end' ? lw : it.label[2] === 'middle' ? lw / 2 : 0; pg.drawText(txt, { x: it.label[0] - ax, y: Y(it.label[1]) - T_LBL * 0.35, size: T_LBL, font, color: COL });
      }
    }
    for (const pi of touched) stamp(pages[pi], 'ELEKTRO – návrh koncových prvků · ' + metaLine + ' · kóty v mm, výšky od čisté podlahy');
    /* annex: title block, legend, schedule (wrapped cells, page breaks with repeated headers), summary, notes */
    const rows = listRows(); let pg = null, y = 0;
    const BOTTOM = 50;   // content never goes below this (footer band at y 10–17)
    const newPage = cont => { pg = addPage([PW, PH]); added.push({ pg, kind: 'annex' }); y = PH - 40; if (cont) { pg.drawText(fit(`${PROJECT.title} – elektroinstalace, koncové prvky · ${metaLine} · pokračování`, CONTENT_W, 8), { x: ML, y, size: 8, font, color: GREY }); y -= 18; } };
    const text = (s, x, size = 9, color = INK) => pg.drawText(String(s), { x, y, size, font, color });
    newPage(false);
    text(fit(PROJECT.title + ' – elektroinstalace, koncové prvky', CONTENT_W, 14), ML, 14); y -= 15;
    text(fit((PROJECT.address ? PROJECT.address + ' · ' : '') + metaLine, CONTENT_W, 8.5), ML, 8.5, GREY); y -= 12;
    text(fit(`zakázka ${JOB_ID || PROJECT_SLUG} · otisk geometrie ${GEOM_FP || '–'} · editor v${APP_VERSION} · ${state.elements.length} prvků`, CONTENT_W, 7.5), ML, 7.5, GREY); y -= 22;
    text('Legenda značek', ML, 11); y -= 13; text('Barvy: červená silnoproud (zásuvky, vývody) · zelená ovládání (vypínače, termostat, čidlo) · modrá světla · fialová slaboproud (data, TV, domácí telefon). Za označením je zkratka typu (IP = IP44, VD = varná deska …).', ML, 7.5, GREY); y -= 14;
    for (const sid of [...new Set(state.elements.map(e => e.type))]) {
      const ops = SYM[sid].ops(); const ox = 52, oy = PH - y + 2; const LC = colOf(sid);
      for (const o of ops) {
        const P = ([x, yy]) => [ox + x, oy - yy];
        if (o.op === 'line') { const [a, b] = o.p.map(P); pg.drawLine({ start: { x: a[0], y: PH - a[1] }, end: { x: b[0], y: PH - b[1] }, thickness: 0.75, color: LC }); }
        else if (o.op === 'circle') { const c = P(o.c); pg.drawCircle({ x: c[0], y: PH - c[1], size: o.r, borderWidth: 0.75, borderColor: LC, color: o.fill ? LC : undefined }); }
        else if (o.op === 'poly') { const pts = o.pts.map(P); pg.drawSvgPath('M ' + pts.map(p => `${p[0]} ${p[1]}`).join(' L ') + (o.close ? ' Z' : ''), { x: 0, y: PH, borderWidth: 0.75, borderColor: LC, color: o.fill ? LC : undefined }); }
        else if (o.op === 'text') { const p = P([o.x, o.y]); const twd = tw(o.s, o.size); pg.drawText(o.s, { x: p[0] - (o.anchor === 'middle' ? twd / 2 : 0), y: PH - p[1] - o.size * 0.35, size: o.size, font, color: LC }); }
      }
      text(SYM[sid].name + (SYM[sid].tag ? ' (' + SYM[sid].tag + ')' : ''), 72, 9); text(SYM[sid].ceiling ? 'výška = strop místnosti podle reportu (ruční = neověřeno)' : `standardní výška ${defH(sid)} mm`, 260, 8, GREY); y -= 15;
      if (y - 15 < BOTTOM) newPage(true);
    }
    y -= 10; if (y < 120) newPage(true); text('Soupis prvků', ML, 11); y -= 16;
    const cols = [{ k: 'label', x: 40, w: 30, t: 'Ozn.' }, { k: 'type', x: 72, w: 96, t: 'Prvek' }, { k: 'count', x: 170, w: 12, t: 'ks' }, { k: 'wall', x: 184, w: 80, t: 'Stěna' }, { k: 'h', x: 266, w: 32, t: 'Výška' }, { k: 'pos', x: 300, w: 100, t: 'Poloha (mm)' }, { k: 'ovlada', x: 402, w: 44, t: 'Ovládá' }, { k: 'warn', x: 448, w: 48, t: 'Upozornění' }, { k: 'note', x: 498, w: 57, t: 'Poznámka' }];
    const FS = 7.5, LH = 9.2;
    const header = () => { for (const c of cols) text(c.t, c.x, 7, GREY); pg.drawLine({ start: { x: ML, y: y - 3 }, end: { x: PW - MR, y: y - 3 }, thickness: 0.3, color: GREY }); y -= 12; };
    header(); let lastRoom = null;
    // any block is drawn line by line; when the page is full it continues on a new page with header, room and a continuation label – no block can overflow the paper
    const breakPage = contLabel => { newPage(true); header(); if (lastRoom) { y -= 3; text(lastRoom + ' (pokračování)', ML, 9); y -= 13; } if (contLabel) { text(contLabel, ML, 7, GREY); y -= 10; } };
    const drawRowLines = (cellLines, contLabel) => { const n = Math.max(...cellLines.map(l => l.length)); for (let li = 0; li < n; li++) { if (y - LH < BOTTOM) breakPage(li > 0 ? contLabel + ' (pokračování)' : null); cellLines.forEach((lines, ci) => { if (lines[li] !== undefined && lines[li] !== '') pg.drawText(lines[li], { x: cols[ci].x, y, size: FS, font, color: cols[ci].k === 'warn' ? WARN : INK }); }); y -= LH; } y -= 2.5; };
    const drawBlock = (lines, x, size, color, contLabel) => { for (let li = 0; li < lines.length; li++) { if (y - size * 1.25 < BOTTOM) breakPage(li > 0 ? contLabel + ' (pokračování)' : null); if (lines[li]) pg.drawText(lines[li], { x, y, size, font, color }); y -= size * 1.25; } };
    const NOTE_INLINE_LINES = 3;
    for (const r of rows) {
      const noteLines = wrap(r.note, cols[7].w, FS); const longNote = noteLines.length > NOTE_INLINE_LINES;
      const cell = c => c.k === 'ovlada' ? (r.ovlada ? '→ ' + r.ovlada : (r.ovladanZ ? 'z ' + r.ovladanZ : '')) : c.k === 'wall' ? r.wall + (r.synthetic ? ' (schéma)' : '') : c.k === 'h' ? r.h + (r.hSource === 'ruční, neověřeno' ? ' ruč.' : '') : c.k === 'note' ? (longNote ? 'viz poznámka níže' : r.note) : r[c.k];
      const cellLines = cols.map(c => wrap(cell(c), c.w, FS)); const needRoom = r.room !== lastRoom;
      if (y - (needRoom ? 17 : 0) - LH - 4 < BOTTOM) { breakPage(null); }
      if (needRoom) { y -= 4; text(r.room, ML, 9.5); y -= 13; lastRoom = r.room; }
      drawRowLines(cellLines, `${r.label}`);
      if (longNote) { const full = wrap(`Poznámka ${r.label}: ${r.note}`, CONTENT_W - 12, FS); drawBlock(full, ML + 12, FS, INK, `Poznámka ${r.label}`); y -= 3; }
    }
    y -= 10; if (y < 80) newPage(true);
    const tot = {}; for (const e of state.elements) { const n = SYM[e.type].name; tot[n] = (tot[n] || 0) + (e.count || 1); }
    text('Souhrn', ML, 11); y -= 15; for (const [k, v] of Object.entries(tot).sort()) { if (y - 12 < BOTTOM) newPage(true); text(k, ML, 8.5); text(v + ' ks', 220, 8.5); y -= 11.5; }
    y -= 12;
    const notes = [
      'Výšky se měří od čisté podlahy ke středu prvku. Polohy: „vpravo/vlevo od“ při pohledu z místnosti na stěnu, od levého/pravého rohu nebo od hrany otvoru (zárubeň/ostění); u volných prvků dvě kolmé vzdálenosti k osám stěn místnosti.',
      'Výška stropních prvků = CEILING HEIGHT z podkladu magicplan (údaj podkladu, ne měření na stavbě); „ruč.“ = zadáno ručně, neověřeno. Stěny označené „schéma“ nejsou v reportu jako pohled – jde o odhad z půdorysu, rozměry orientační. Zákres dveří a oken je orientační.',
      'Podklad: report magicplan (původní strany označeny v zápatí původním číslem). Přílohy: schémata stěn, legenda a soupis. ' + metaLine + '.'];
    lastRoom = null; for (const n of notes) drawBlock(wrap(n, CONTENT_W, 7.5), ML, 7.5, GREY, 'Poznámky');
    if (replaced) { const ln = wrap(`Upozornění: ${replaced} znak(ů) v textech není v přibaleném písmu a bylo nahrazeno otazníkem (např. emoji).`, CONTENT_W, 7.5); drawBlock(ln, ML, 7.5, WARN, 'Poznámky'); }
    /* partial export: keep the title page, touched original pages and every added page */
    const keep = pages.map((_, i) => !opts.partial || i === 0 || touched.has(i));
    if (opts.partial) for (let i = origCount - 1; i >= 0; i--) if (!keep[i]) doc.removePage(i);
    /* footer on every page of the result: list X/Y · revision/status/author · original page reference or annex */
    const all = doc.getPages(); const total = all.length; const origIdx = []; keep.forEach((k, i) => { if (k) origIdx.push(i); });
    all.forEach((p, k) => {
      const isOrig = k < origIdx.length; const ad = added[k - origIdx.length];
      const kind = isOrig ? `podklad magicplan · původní strana ${origIdx[k] + 1}/${origCount}` : (ad && ad.kind === 'schema' ? 'příloha elektro · schéma stěny (odhad z půdorysu)' : 'příloha elektro · legenda a soupis');
      const right = `list ${k + 1}/${total}`; const rw = tw(right, 6.5); const { width } = p.getSize();
      p.drawText(fit(`${PROJECT.title} · elektroinstalace – koncové prvky · ${metaLine} · ${kind}`, width - ML - MR - rw - 8, 6.5), { x: ML, y: 10, size: 6.5, font, color: GREY });
      p.drawText(right, { x: width - MR - rw, y: 10, size: 6.5, font, color: GREY });
    });
    const bytes = await doc.save();
    pushHistory('export-pdf');
    if (!opts.noSave) await saveFile(`elektro-${JOB_ID || PROJECT_SLUG}-rev${meta.rev}-${new Date().toISOString().slice(0, 10)}${opts.partial ? '-dotcene-strany' : ''}.pdf`, bytes);
    return bytes;
  } catch (e) { console.error(e); toast('Export selhal: ' + (e && e.message || e)); return null; }
  finally { exporting = false; btn.disabled = false; btn.textContent = 'Export PDF'; }
}
function renderExport() {
  const b = document.getElementById('exportBody'); const m = state.meta;
  b.innerHTML = `<div class="kv"><b>Revize / stav</b><span>rev ${m.rev} · ${STATUS_CS[m.status]}</span><b>Autor</b><span>${esc(m.author || '– (nastav v tlačítku „rev …“)')}</span><b>Prvků</b><span>${state.elements.length}</span></div>
  <h2>Rozsah</h2>
  <div class="opt"><label><input type="radio" name="expScope" value="full" checked> Celý report (výchozí) – všechny původní strany + schémata + legenda a soupis</label></div>
  <div class="opt"><label><input type="radio" name="expScope" value="partial"> Jen dotčené stránky – titulní strana, strany s prvky, schémata, legenda a soupis</label></div>
  <p class="unit">Export revizi nemění. Každá strana výsledku má zápatí „list X/Y“ s revizí, stavem a autorem; původní strany magicplan nesou i své původní číslo strany.</p>
  <div class="btns"><div class="spacer"></div><button id="expGo" class="primary">Exportovat PDF</button></div>`;
  b.querySelector('#expGo').onclick = async () => { const partial = b.querySelector('input[name=expScope]:checked').value === 'partial'; document.getElementById('modalExport').classList.remove('open'); await exportPDF({ partial }); };
}
document.getElementById('btnExport').onclick = () => { renderExport(); openModal('modalExport'); };

/* ---------- boot ---------- */
document.getElementById('subtitle').textContent = PROJECT.title + (PROJECT.address ? ' · ' + PROJECT.address : '');
applyNorth();
renderPalette(); renderNav(); render(); renderProps(); renderHeaderMeta(); setTool(null); placeNav();
window.addEventListener('resize', () => { if (view) svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); });
window.addEventListener('pagehide', () => { try { if (contentHash() !== lastCheckpointHash) pushHistory('unload'); } catch { } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { try { if (contentHash() !== lastCheckpointHash) pushHistory('unload'); } catch { } } });
initCaps();
