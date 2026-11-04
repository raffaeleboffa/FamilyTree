'use strict';
/* ===== UTILITÀ ===== */
const $ = (s, e = document) => e.querySelector(s);
const uid = () => 'p' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2800) };
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const KEYS = ['nome', 'secondo', 'cognome', 'nick', 'sesso', 'bd', 'bm', 'by', 'luogoN', 'dd', 'dm', 'dy', 'luogoM', 'foto', 'bio', 'prof', 'naz', 'altro'];
const blank = () => Object.fromEntries(KEYS.map(k => [k, '']));
const DEF = { gapX: 30, gapY: 90, cw: 180, ch: 70, av: 44, bg: '#ffffff', bd: '#6b7a99', lk: '#8a94a8', uc: '#d9534f', ac: '#d98c2b', lw: 2, ls: 'solid', rad: 10, font: 'system-ui,sans-serif', fs: 13, dates: true, places: false, photos: true, orient: 'v', genc: false, theme: 'light' };

/* ===== DATI E PERSISTENZA (localStorage, salvataggio automatico) ===== */
const KEY = 'albero_gen_v1';
let S, hist = [], fut = [], sel = null, V = { x: 0, y: 0, k: 1 }, mode = 'all', L = null;
let M, KIDS, PARS, UN, PK; const collapsed = new Set();
const newTree = name => ({ id: uid(), name, people: [], rels: [], ref: null });
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)) } catch (e) { S = null }
  if (!S || !Array.isArray(S.trees) || !S.trees.length) { S = { settings: {}, trees: [newTree('Il mio albero')] }; S.cur = S.trees[0].id }
  S.settings = { ...DEF, ...S.settings };
}
let st; const save = () => { clearTimeout(st); st = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { toast('Archivio pieno: esporta un backup JSON') } }, 250) };
const T = () => S.trees.find(t => t.id === S.cur) || S.trees[0];
/* Cronologia annulla/ripristina: istantanee degli alberi */
const snap = () => { hist.push(JSON.stringify(S.trees)); if (hist.length > 100) hist.shift(); fut = [] };
function undo() { if (!hist.length) return toast('Niente da annullare'); fut.push(JSON.stringify(S.trees)); S.trees = JSON.parse(hist.pop()); fixCur(); commit() }
function redo() { if (!fut.length) return toast('Niente da ripristinare'); hist.push(JSON.stringify(S.trees)); S.trees = JSON.parse(fut.pop()); fixCur(); commit() }
const fixCur = () => { if (!S.trees.find(t => t.id === S.cur)) S.cur = S.trees[0].id };
const commit = () => { save(); render() };

/* ===== RELAZIONI: indici =====
 rels: {t:'pc',p,c,k} genitore->figlio (k: bio/adottiva/custom) ; {t:'un',a,b,k} unione (coniuge/partner/ex/custom) */
function index() {
  const t = T(); M = new Map(t.people.map(p => [p.id, p])); KIDS = new Map(); PARS = new Map(); UN = new Map(); PK = new Map();
  const add = (m, k, v) => { (m.get(k) || m.set(k, []).get(k)).push(v) };
  t.rels = t.rels.filter(r => r.t === 'pc' ? M.has(r.p) && M.has(r.c) && r.p !== r.c : M.has(r.a) && M.has(r.b) && r.a !== r.b);
  for (const r of t.rels) {
    if (r.t === 'pc') { add(KIDS, r.p, r.c); add(PARS, r.c, r.p); PK.set(r.p + '>' + r.c, r.k) }
    else { add(UN, r.a, { o: r.b, r }); add(UN, r.b, { o: r.a, r }) }
  }
}
const fullname = p => [p.nome, p.secondo, p.cognome].filter(Boolean).join(' ') || (p.nick ? '“' + p.nick + '”' : 'Senza nome');
const fmt = (d, m, y) => [d, m && MESI[m - 1], y].filter(Boolean).join(' ');
const dline = p => { const b = fmt(p.bd, p.bm, p.by), d = fmt(p.dd, p.dm, p.dy); return (b ? 'n. ' + b : '') + (d ? (b ? ' · ' : '') + '† ' + d : '') };
function descOf(id) { const o = new Set(), q = [id]; while (q.length) for (const c of KIDS.get(q.shift()) || []) if (!o.has(c)) { o.add(c); q.push(c) } return o }

/* Insieme di persone visibili: tutto, discendenti o antenati (con i rispettivi partner) */
function visSet(m, f) {
  if (m === 'all' || !f || !M.has(f)) return new Set(M.keys());
  const out = new Set([f]), seen = new Set([f]), q = [f];
  while (q.length) {
    const i = q.shift();
    for (const u of UN.get(i) || []) out.add(u.o);
    for (const n of (m === 'desc' ? KIDS : PARS).get(i) || []) { out.add(n); if (!seen.has(n)) { seen.add(n); q.push(n) } }
  }
  return out;
}
/* Generazioni: figlio = max(genitori)+1; i partner sono sempre sulla stessa riga */
function gens(vis, eq = true) {
  const g = Object.create(null), rels = T().rels; vis.forEach(i => g[i] = 0); let ch = 1;
  for (let n = 0; ch && n < Math.min(vis.size + 2, 500); n++) {
    ch = 0;
    for (const r of rels) {
      if (r.t === 'pc') { if (r.p in g && r.c in g && g[r.c] < g[r.p] + 1) { g[r.c] = g[r.p] + 1; ch = 1 } }
      else if (eq && r.a in g && r.b in g && g[r.a] !== g[r.b]) { g[r.a] = g[r.b] = Math.max(g[r.a], g[r.b]); ch = 1 }
    }
    /* i fratelli (figli degli stessi genitori) stanno sempre sulla stessa riga */
    if (eq) for (const [p, ks] of KIDS) if (p in g) { let m = -1; for (const c of ks) if (c in g) m = Math.max(m, g[c]); for (const c of ks) if (c in g && g[c] < m) { g[c] = m; ch = 1 } }
  }
  /* Vincoli contraddittori (es. zio che sposa la nipote): si usano le generazioni naturali, senza allineamenti forzati */
  if (eq && ch) return gens(vis, false);
  /* Nuclei "radice" (nessun membro ha genitori visibili): vanno sulla riga subito sopra al figlio più alto,
     non sempre sulla riga 0. Così i nonni di un ramo acquisito stanno nella loro vera generazione. */
  const seen = new Set();
  for (const id of vis) {
    if (seen.has(id)) continue; const cl = [id]; seen.add(id);
    for (let i = 0; i < cl.length; i++) for (const u of UN.get(cl[i]) || []) if (u.o in g && g[u.o] === g[id] && !seen.has(u.o)) { seen.add(u.o); cl.push(u.o) }
    if (cl.some(i => (PARS.get(i) || []).some(p => p in g))) continue;
    let m = Infinity; for (const i of cl) for (const c of KIDS.get(i) || []) if (c in g) m = Math.min(m, g[c] - 1);
    if (m !== Infinity && m > g[id]) cl.forEach(i => g[i] = m);
  }
  return g;
}

/* ===== MOTORE DI LAYOUT =====
 Ogni "cluster" (persona + partner collegati) è un blocco; i figli vengono disposti per primi (ricorsione),
 poi il blocco viene centrato sopra di loro. Un puntatore per generazione (next) impedisce sovrapposizioni. */
function layout(vis, s) {
  /* Rami compressi: i discendenti vengono esclusi dal calcolo */
  const hide = new Set();
  for (const c of collapsed) if (vis.has(c)) for (const src of [c, ...(UN.get(c) || []).map(u => u.o)]) for (const k of KIDS.get(src) || []) if (!hide.has(k)) { hide.add(k); const q = [k]; while (q.length) { const i = q.shift(); for (const u of UN.get(i) || []) hide.add(u.o); for (const n of KIDS.get(i) || []) if (!hide.has(n)) { hide.add(n); q.push(n) } } }
  if (hide.size) vis = new Set([...vis].filter(i => !hide.has(i)));
  const g = gens(vis), v = s.orient === 'v', A = v ? s.cw : s.ch, B = v ? s.ch : s.cw, sa = A + s.gapX, LANE = 14;
  const pos = Object.create(null), next = Object.create(null), done = new Set();
  const cluster = id => { const o = [id], seen = new Set(o); for (let i = 0; i < o.length; i++) for (const u of UN.get(o[i]) || []) if (vis.has(u.o) && g[u.o] === g[id] && !seen.has(u.o)) { seen.add(u.o); o.push(u.o) } return o };
  /* ---- Disposizione a livelli (stile Sugiyama) ----
     1) blocchi = persona + partner collegati (restano uniti);  2) ordine di ogni riga per baricentro dei collegamenti
     (riduce gli incroci e tiene vicini i fratelli);  3) coordinate: minimi quadrati con vincolo di non sovrapposizione
     (regressione isotonica), così genitori e figli si centrano a vicenda e le sovrapposizioni sono impossibili. */
  const ids = [...vis].sort((x, y) => g[x] - g[y]);
  let G = 0; for (const i of ids) G = Math.max(G, g[i]);
  const par = Object.create(null), kid = Object.create(null);
  for (const i of ids) { par[i] = (PARS.get(i) || []).filter(p => vis.has(p)); kid[i] = (KIDS.get(i) || []).filter(c => vis.has(c)) }
  const units = [], uOf = Object.create(null), ixU = Object.create(null);
  for (const id of ids) if (!(id in uOf)) { const m = cluster(id), u = { m, g: g[id], x: 0, k: 0, w: m.length * sa - s.gapX }; units.push(u); m.forEach((i, j) => { uOf[i] = u; ixU[i] = j }) }
  for (const u of units) { u.up = new Set(); u.dn = new Set(); for (const i of u.m) { for (const p of par[i]) if (uOf[p] !== u) u.up.add(uOf[p]); for (const c of kid[i]) if (uOf[c] !== u) u.dn.add(uOf[c]) } }
  const rows = Array.from({ length: G + 1 }, () => []), seenU = new Set();
  const visit = u => { if (seenU.has(u)) return; seenU.add(u); rows[u.g].push(u); for (const i of u.m) for (const c of kid[i]) visit(uOf[c]) };
  units.filter(u => !u.up.size).forEach(visit); units.forEach(visit);
  const setK = () => rows.forEach(r => r.forEach((u, k) => { u.k = (k + .5) / r.length }));
  setK();
  for (let it = 0; it < 10; it++) {
    const down = it % 2 === 0;
    for (const r of down ? rows : [...rows].reverse()) {
      const key = new Map(r.map(u => { const nb = down ? u.up : u.dn; let t = 0; nb.forEach(n => t += n.k); return [u, nb.size ? t / nb.size : u.k] }));
      /* si riordinano solo i blocchi con collegamenti; gli altri restano al loro posto */
      const at = [], mv = []; r.forEach((u, k) => { if ((down ? u.up : u.dn).size) { at.push(k); mv.push(u) } });
      mv.sort((a, b) => key.get(a) - key.get(b) || a.k - b.k); at.forEach((k, j) => r[k] = mv[j]); r.forEach((u, k) => u.k = (k + .5) / r.length);
    }
  }
  const gap = s.gapX * 1.3, cx = i => uOf[i].x + ixU[i] * sa + A / 2;
  const pre = r => { let p = 0; return r.map(u => { const v = p; p += u.w + gap; return v }) };
  const iso = (y, w) => { const B = []; for (let k = 0; k < y.length; k++) { let b = { s: y[k] * w[k], w: w[k], n: 1 }; while (B.length && B[B.length - 1].s / B[B.length - 1].w > b.s / b.w) { const p = B.pop(); b = { s: p.s + b.s, w: p.w + b.w, n: p.n + b.n } } B.push(b) } const o = []; for (const b of B) for (let i = 0; i < b.n; i++) o.push(b.s / b.w); return o };
  rows.forEach(r => { const P = pre(r), tot = r.length ? P[P.length - 1] + r[r.length - 1].w : 0; r.forEach((u, k) => u.x = P[k] - tot / 2) });
  /* Rilassamento: i genitori vanno al centro dei figli; i figli si spostano INSIEME (gruppo rigido) per centrarsi sui genitori.
     Nessun vincolo di centratura è irrealizzabile da solo: ogni conflitto si risolve con la regressione isotonica. */
  const relax = (n, eps, ms) => { const t0 = Date.now(); for (let it = 0, mv = 1; it < n && mv > .05 && Date.now() - t0 < ms; it++) { mv = 0; for (const r of [...rows, ...[...rows].reverse()]) {
    const mc = Object.create(null), mid = p => mc[p] ?? (() => { let lo = 1e12, hi = -1e12; for (const c of kid[p]) { const q = cx(c); lo = Math.min(lo, q); hi = Math.max(hi, q) } return mc[p] = (lo + hi) / 2 })();
    const P = pre(r), y = [], w = [];
    r.forEach((u, k) => {
      let sv = 0, sw = 0;
      u.m.forEach((i, j) => {
        if (par[i].length) { sv += u.x + par[i].reduce((t, p) => t + cx(p), 0) / par[i].length - mid(par[i][0]); sw += 1 }
        if (kid[i].length) { sv += 3 * (mid(i) - j * sa - A / 2); sw += 3 }
      });
      /* compattazione: ogni blocco è attratto dai vicini (chiude gli spazi inutili) */
      if (k) { sv += eps * (r[k - 1].x + r[k - 1].w + gap); sw += eps }
      if (k < r.length - 1) { sv += eps * (r[k + 1].x - u.w - gap); sw += eps }
      y.push((sw ? sv / sw : u.x) - P[k]); w.push(sw || .05);
    });
    const f = iso(y, w); r.forEach((u, k) => { mv = Math.max(mv, Math.abs(f[k] + P[k] - u.x)); u.x = f[k] + P[k] });
  } } };
  /* Dentro un blocco: chi ha genitori va dal lato dei propri genitori; il coniuge senza genitori sta all'esterno */
  const reorder = () => { for (const u of units) {
    if (u.m.length < 2) continue;
    const an = i => par[i].reduce((t, p) => t + cx(p), 0) / par[i].length, wp = u.m.filter(i => par[i].length), np = u.m.filter(i => !par[i].length);
    if (!wp.length || (wp.length === 1 && !np.length)) continue;
    wp.sort((a, b) => an(a) - an(b)); const ax = wp.reduce((t, i) => t + an(i), 0) / wp.length;
    u.m = u.x + u.w / 2 >= ax ? [...wp, ...np] : [...np, ...wp]; u.m.forEach((i, j) => ixU[i] = j);
  } };
  relax(10, .3, 300); reorder(); relax(80, .3, 700); relax(200, .03, 700); relax(800, 0, 1500);
  units.forEach(u => u.m.forEach((i, j) => pos[i] = u.x + j * sa));
  /* Famiglie (coppia di genitori + figli): ciascuna ha una "corsia" per la linea orizzontale dei figli.
     Famiglie con tratti sovrapposti usano corsie diverse; lo spazio tra generazioni cresce solo dove serve. */
  const fm = new Map();
  for (const id of ids) {
    const ps = (PARS.get(id) || []).filter(p => vis.has(p)); if (!ps.length) continue;
    const p1 = ps[0], p2 = ps.find(p => p !== p1 && (UN.get(p1) || []).some(u => u.o === p));
    const add = pp => { pp = pp.sort(); const key = pp.join('&'); let f = fm.get(key); if (!f) fm.set(key, f = { ps: pp, kids: [] }); f.kids.push(id) };
    add(p2 ? [p1, p2] : [p1]); for (const p of ps) if (p !== p1 && p !== p2) add([p]);
  }
  const cA = i => pos[i] + A / 2, fams = [...fm.values()], byGen = {}, extra = {};
  for (const f of fams) { f.a0 = f.ps.reduce((t, p) => t + cA(p), 0) / f.ps.length; const all = [f.a0, ...f.kids.map(cA)]; f.lo = Math.min(...all); f.hi = Math.max(...all); (byGen[g[f.ps[0]]] ||= []).push(f) }
  for (const k in byGen) { const ends = []; byGen[k].sort((x, y) => x.lo - y.lo).forEach(f => { let l = ends.findIndex(e => e < f.lo - 8); if (l < 0) l = ends.length; ends[l] = f.hi; f.lane = l }); byGen[k].forEach(f => f.nl = ends.length); extra[k] = Math.max(0, ends.length - 1) * LANE }
  const Y = [0]; for (let k = 0; k < G; k++) Y[k + 1] = Y[k] + B + s.gapY + (extra[k] || 0);
  for (const f of fams) { const k = g[f.ps[0]]; f.bus = Y[k] + B + (s.gapY + (extra[k] || 0)) / 2 + (f.lane - (f.nl - 1) / 2) * LANE }
  const nodes = [], map = Object.create(null); let x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
  for (const id of ids) {
    const x = v ? pos[id] : Y[g[id]], y = v ? Y[g[id]] : pos[id], n = { id, x, y, g: g[id] }; nodes.push(n); map[id] = n;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + s.cw); y1 = Math.max(y1, y + s.ch);
  }
  return { g, pos, A, B, Y, v, nodes, map, fams, n: nodes.length, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

/* ===== RENDERING SVG (usato anche per il PDF) ===== */
const lum = h => { const m = /^#?(..)(..)(..)$/.exec(h); return m ? (.3 * parseInt(m[1], 16) + .59 * parseInt(m[2], 16) + .11 * parseInt(m[3], 16)) / 255 : .5 };
function colors(gen, s) {
  const dark = s.theme === 'dark'; let bg;
  if (s.genc) bg = `hsl(${(gen * 53 + 200) % 360} 55% ${dark ? 28 : 88}%)`; else bg = dark && s.bg === DEF.bg ? '#1e2738' : s.bg;
  return { bg, fg: (s.genc ? dark : lum(bg) < .5) ? '#f1f4fa' : '#1b2333' };
}
function draw(Lr, s, ex) {
  const { pos, g, A, B, Y, v, nodes, fams } = Lr, rels = T().rels, dash = { solid: '', dashed: '6 4', dotted: '2 4' }[s.ls];
  const pt = (a, b) => v ? `${a} ${b}` : `${b} ${a}`, cA = i => pos[i] + A / 2, bT = i => Y[g[i]];
  const path = (d, c, da) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${s.lw}"${da ? ` stroke-dasharray="${da}"` : ''} stroke-linejoin="round"/>`;
  let o = '';
  for (const r of rels) if (r.t === 'un' && r.a in pos && r.b in pos) { const b = bT(r.a) + B / 2; o += path(`M${pt(cA(r.a), b)}L${pt(cA(r.b), b)}`, s.uc, r.k === 'ex' ? '3 3' : '') }
  for (const f of fams) {
    const p0 = f.ps[0], b0 = f.ps.length > 1 ? bT(p0) + B / 2 : bT(p0) + B;
    for (const c of f.kids) {
      const k = f.ps.map(p => PK.get(p + '>' + c) || 'bio').find(x => x !== 'bio') || 'bio', ca = cA(c);
      o += path(`M${pt(f.a0, b0)}L${pt(f.a0, f.bus)}L${pt(ca, f.bus)}L${pt(ca, bT(c))}`, k === 'bio' ? s.lk : s.ac, k === 'bio' ? dash : '6 4');
    }
  }
  let n = 0; const ref = T().ref;
  for (const { id, x, y, g: gg } of nodes) {
    const p = M.get(id), { bg, fg } = colors(gg, s), pad = 8, off = s.photos ? s.av + pad * 2 : pad * 1.5, isSel = !ex && id === sel;
    const lines = [[fullname(p), 600, s.fs]]; const d = s.dates && dline(p); if (d) lines.push([d, 400, s.fs - 2]);
    const pl = s.places && [p.luogoN, p.luogoM].filter(Boolean).join(' → '); if (pl) lines.push([pl, 400, s.fs - 3]);
    const mx = Math.max(4, Math.floor((s.cw - off - pad) / (s.fs * .55))), lh = s.fs * 1.35, t0 = s.ch / 2 - lines.length * lh / 2 + s.fs * .95;
    o += `<g class="n" data-id="${esc(id)}" transform="translate(${x} ${y})"><title>${esc(fullname(p))}</title>`;
    o += `<rect width="${s.cw}" height="${s.ch}" rx="${s.rad}" fill="${bg}" stroke="${isSel ? '#3b82f6' : s.bd}" stroke-width="${isSel ? 3.5 : 1.5}"/>`;
    if (s.photos) {
      const cx = pad + s.av / 2, cy = s.ch / 2, r = s.av / 2;
      if (p.foto) { n++; o += `<clipPath id="c${n}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="${esc(p.foto)}" x="${pad}" y="${cy - r}" width="${s.av}" height="${s.av}" clip-path="url(#c${n})" preserveAspectRatio="xMidYMid slice"/>` }
      else o += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${{ M: '#7aa7e8', F: '#e88fb0' }[p.sesso] || '#a5adbb'}"/><text x="${cx}" y="${cy + s.av * .17}" text-anchor="middle" font-size="${s.av * .4}" fill="#fff" font-family="${s.font}">${esc((fullname(p)[0] || '?').toUpperCase())}</text>`;
    }
    lines.forEach(([tx, w, fs], i) => { const t = tx.length > mx ? tx.slice(0, mx - 1) + '…' : tx; o += `<text x="${off}" y="${t0 + i * lh}" font-size="${fs}" font-weight="${w}" fill="${fg}" font-family="${s.font}">${esc(t)}</text>` });
    if (id === ref) o += `<text x="${s.cw - 14}" y="14" font-size="12" fill="#e0a800">★</text>`;
    if (collapsed.has(id) && (KIDS.get(id) || []).length) o += `<circle cx="${s.cw / 2}" cy="${s.ch}" r="10" fill="#3b82f6"/><text x="${s.cw / 2}" y="${s.ch + 4}" text-anchor="middle" font-size="11" fill="#fff">+${KIDS.get(id).length}</text>`;
    o += '</g>';
  }
  return o;
}
function render() {
  index(); if (sel && !M.has(sel)) sel = null;
  const s = S.settings; document.documentElement.dataset.theme = s.theme;
  L = layout(visSet(mode, T().ref), s); $('#vp').innerHTML = draw(L, s, false);
  $('#empty').hidden = M.size > 0; $('#tn').textContent = T().name; $('#vm').value = mode; showDet();
}

/* ===== ZOOM / PAN ===== */
const svg = $('#svg'), applyV = () => $('#vp').setAttribute('transform', `translate(${V.x} ${V.y}) scale(${V.k})`);
function zoomAt(cx, cy, f) { const r = svg.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, k = Math.min(4, Math.max(.03, V.k * f)); V.x = x - (x - V.x) * k / V.k; V.y = y - (y - V.y) * k / V.k; V.k = k; applyV() }
function fit() { if (!L || !L.n) return; const r = svg.getBoundingClientRect(), b = L.box, k = Math.min((r.width - 60) / b.w, (r.height - 60) / b.h, 1.2); V.k = k; V.x = (r.width - b.w * k) / 2 - b.x * k; V.y = (r.height - b.h * k) / 2 - b.y * k; applyV() }
function center(id) { const n = L.map[id]; if (!n) return; const r = svg.getBoundingClientRect(); V.x = r.width / 2 - (n.x + S.settings.cw / 2) * V.k; V.y = r.height / 2 - (n.y + S.settings.ch / 2) * V.k; applyV() }
svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12) }, { passive: false });
let drag = null;
svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y, mv: 0, t: e.target.closest('.n') } });
addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.mv = 1; if (drag.mv) { V.x = drag.vx + dx; V.y = drag.vy + dy; applyV() } });
addEventListener('pointerup', () => { if (!drag) return; if (!drag.mv) { sel = drag.t ? drag.t.dataset.id : null; render() } drag = null });
svg.addEventListener('dblclick', e => { const n = e.target.closest('.n'); if (n) { const id = n.dataset.id; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); render() } });

/* ===== DIALOGHI ===== */
function modal(t, b, f = '') { const d = $('#dlg'); d.innerHTML = `<div class="mh"><h2>${t}</h2><button data-act="close">✕</button></div><div class="mb">${b}</div><div class="mf">${f}</div>`; if (!d.open) d.showModal() }
const kindField = t => [{ n: 'k', l: 'Tipo di relazione', o: t === 'pc' ? [['', 'Biologica'], ['adottiva', 'Adottiva'], ['affidataria', 'Affidataria']] : [['', 'Coniuge'], ['partner', 'Partner'], ['ex', 'Ex coniuge/partner']] }, { n: 'x', l: 'Oppure relazione personalizzata', ph: 'es. convivente, figliastro' }];
const kindOf = f => (f.x || '').trim() || f.k || '';
function ask(title, fields, cb) {
  const h = fields.map(f => `<label>${f.l}` + (f.o ? `<select name="${f.n}">${f.o.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>` : `<input name="${f.n}" placeholder="${esc(f.ph || '')}">`) + '</label>').join('');
  modal(title, `<form id="af" class="grid1">${h}</form>`, `<button data-act="close">Annulla</button><button class="pri" id="ok">Conferma</button>`);
  $('#af').onsubmit = e => { e.preventDefault(); $('#ok').click() };
  $('#ok').onclick = () => { const f = Object.fromEntries(new FormData($('#af'))); $('#dlg').close(); cb(f) };
}

/* ===== SCHEDA PERSONA: modifica ===== */
function edit(id) {
  const p = M.get(id); if (!p) return; let foto = p.foto;
  const inp = (k, l) => `<label>${l}<input name="${k}" value="${esc(p[k])}"></label>`;
  const dt = (l, a, b, c) => `<label class="full">${l}<fieldset>${[[a, 'Giorno'], [b, 'Mese'], [c, 'Anno']].map(([k, ph]) => `<input name="${k}" value="${esc(p[k])}" placeholder="${ph}" inputmode="numeric">`).join('')}</fieldset></label>`;
  modal('Scheda persona', `<form id="af" class="grid">${inp('nome', 'Nome')}${inp('cognome', 'Cognome')}${inp('secondo', 'Secondo nome')}${inp('nick', 'Soprannome')}
  <label>Genere<select name="sesso">${[['', 'Non specificato'], ['M', 'Maschio'], ['F', 'Femmina'], ['A', 'Altro']].map(o => `<option value="${o[0]}"${p.sesso === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>${inp('prof', 'Professione')}
  ${dt('Data di nascita (anche parziale)', 'bd', 'bm', 'by')}${inp('luogoN', 'Luogo di nascita')}<span></span>${dt('Data di morte (anche parziale)', 'dd', 'dm', 'dy')}${inp('luogoM', 'Luogo di morte')}${inp('naz', 'Nazionalità')}
  <label class="full">Fotografia<span><input type="file" id="ph" accept="image/*"> <img id="pv" class="pv" ${foto ? `src="${esc(foto)}"` : 'hidden'}> <button type="button" id="rp">Rimuovi foto</button></span></label>
  <label class="full">Biografia e note<textarea name="bio" rows="3">${esc(p.bio)}</textarea></label><label class="full">Altri dettagli<textarea name="altro" rows="2">${esc(p.altro)}</textarea></label></form>`,
    `<button data-act="close">Annulla</button><button class="pri" id="ok">Salva</button>`);
  $('#af').onsubmit = e => e.preventDefault();
  $('#rp').onclick = () => { foto = ''; $('#pv').hidden = true };
  $('#ph').onchange = e => { const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 240 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); foto = c.toDataURL('image/jpeg', .82); $('#pv').src = foto; $('#pv').hidden = false }; im.onerror = () => toast('Immagine non valida'); im.src = r.result }; r.readAsDataURL(fl) };
  $('#ok').onclick = () => {
    const f = new FormData($('#af')); snap(); let bad = 0;
    for (const k of KEYS) {
      if (k === 'foto') continue; let v = String(f.get(k) ?? '').trim();
      const lim = { bd: [1, 31], dd: [1, 31], bm: [1, 12], dm: [1, 12], by: [0, 9999], dy: [0, 9999] }[k];
      if (lim && v && !(/^\d+$/.test(v) && +v >= lim[0] && +v <= lim[1])) { v = ''; bad++ } else if (lim && v) v = String(+v);
      p[k] = v;
    }
    p.foto = foto; $('#dlg').close(); commit(); if (bad) toast('Alcune date non valide sono state ignorate');
  };
}

/* ===== SCHEDA DETTAGLIATA (pannello laterale) ===== */
function showDet() {
  const d = $('#det'); if (!sel) { d.hidden = true; return }
  const p = M.get(sel), t = T(), s = sel; d.hidden = false;
  const rows = (list, label) => list.length ? `<h4>${label}</h4>` + list.map(([id, r]) => `<div class="rr"><a data-go="${esc(id)}">${esc(fullname(M.get(id)))}</a>${r ? `<small>${esc(r.k)}</small><button data-act="rk" data-r="${r.id}" title="Cambia tipo">✎</button><button data-act="unl" data-r="${r.id}" title="Rimuovi relazione">✕</button>` : ''}</div>`).join('') : '';
  const pa = t.rels.filter(r => r.t === 'pc' && r.c === s).map(r => [r.p, r]), ch = t.rels.filter(r => r.t === 'pc' && r.p === s).map(r => [r.c, r]);
  const un = t.rels.filter(r => r.t === 'un' && (r.a === s || r.b === s)).map(r => [r.a === s ? r.b : r.a, r]);
  const sb = new Set(); pa.forEach(([i]) => (KIDS.get(i) || []).forEach(c => c !== s && sb.add(c)));
  const info = [['Nato/a', [fmt(p.bd, p.bm, p.by), p.luogoN].filter(Boolean).join(' – ')], ['Morto/a', [fmt(p.dd, p.dm, p.dy), p.luogoM].filter(Boolean).join(' – ')], ['Professione', p.prof], ['Nazionalità', p.naz], ['Note', p.bio], ['Altro', p.altro]].filter(x => x[1]).map(([a, b]) => `<p><span class="mu">${a}:</span> ${esc(b)}</p>`).join('');
  d.innerHTML = `<button data-act="cls" style="float:right">✕</button>${p.foto ? `<img class="pv" src="${esc(p.foto)}">` : ''}<h3>${esc(fullname(p))}</h3><div class="mu">${esc(dline(p))}</div>${info}
  <div class="bt"><button class="pri" data-act="edit">Modifica</button><button data-act="ar" data-t="parent">+ Genitore</button><button data-act="ar" data-t="child">+ Figlio</button><button data-act="ar" data-t="partner">+ Partner</button><button data-act="ar" data-t="sib">+ Fratello/sorella</button><button data-act="link">Collega esistente</button>
  <button data-act="ctr">Centra</button><button data-act="ref">${t.ref === s ? '★ Riferimento' : 'Imposta riferimento'}</button><button data-act="col">${collapsed.has(s) ? 'Espandi ramo' : 'Comprimi ramo'}</button><button data-act="dup">Duplica</button><button class="dg" data-act="del">Elimina</button></div>
  ${rows(pa, 'Genitori')}${rows(un, 'Partner')}${rows(ch, 'Figli')}${rows([...sb].map(i => [i, null]), 'Fratelli e sorelle')}`;
}
const mk = () => { const p = { ...blank(), id: uid() }; T().people.push(p); return p.id };
const link = (p, c, k) => T().rels.push({ id: uid(), t: 'pc', p, c, k: k || 'bio' });
const union = (a, b, k) => T().rels.push({ id: uid(), t: 'un', a, b, k: k || 'coniuge' });
function addRel(type) {
  const id = sel, fin = n => { sel = n; commit(); center(n); edit(n) };
  if (type === 'parent') { snap(); const n = mk(); link(n, id); fin(n) }
  else if (type === 'child') ask('Nuovo figlio/a', [{ n: 'o', l: 'Altro genitore', o: [['', 'Nessuno / sconosciuto'], ...(UN.get(id) || []).map(u => [u.o, fullname(M.get(u.o))])] }, ...kindField('pc')], f => { snap(); const n = mk(), k = kindOf(f); link(id, n, k); if (f.o) link(f.o, n, k); fin(n) });
  else if (type === 'partner') ask('Nuovo partner', kindField('un'), f => { snap(); const n = mk(); union(id, n, kindOf(f)); fin(n) });
  else { snap(); let ps = PARS.get(id) || []; if (!ps.length) { const g = mk(); link(g, id); ps = [g] } const n = mk(); ps.forEach(q => link(q, n)); fin(n) }
}
function linkExisting() {
  const id = sel, others = T().people.filter(p => p.id !== id).map(p => [p.id, fullname(p) + (p.by ? ' (' + p.by + ')' : '')]); if (!others.length) return toast('Non ci sono altre persone');
  ask('Collega persona esistente', [{ n: 'r', l: 'La persona scelta è…', o: [['parent', 'genitore di questa persona'], ['child', 'figlio/a di questa persona'], ['partner', 'partner di questa persona']] }, { n: 'o', l: 'Persona', o: others }, ...kindField('pc')], f => {
    const o = f.o, k = kindOf(f), rels = T().rels;
    if (f.r === 'partner') { if (rels.some(r => r.t === 'un' && [r.a, r.b].includes(id) && [r.a, r.b].includes(o))) return toast('Relazione già presente'); snap(); union(id, o, k) }
    else { const [p, c] = f.r === 'parent' ? [o, id] : [id, o]; if (rels.some(r => r.t === 'pc' && r.p === p && r.c === c)) return toast('Relazione già presente'); if (descOf(c).has(p)) return toast('Relazione impossibile: creerebbe un ciclo'); snap(); link(p, c, k) }
    commit();
  });
}

/* ===== AZIONI (pulsanti con data-act) ===== */
const ACT = {
  close: () => $('#dlg').close(), cls: () => { sel = null; render() },
  undo, redo, zin: () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25) }, zout: () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, .8) }, fit,
  add: () => { snap(); const n = mk(); sel = n; commit(); center(n); edit(n) }, edit: () => edit(sel), ctr: () => center(sel),
  ar: b => addRel(b.dataset.t), link: linkExisting,
  ref: () => { snap(); T().ref = T().ref === sel ? null : sel; commit() }, col: () => { collapsed.has(sel) ? collapsed.delete(sel) : collapsed.add(sel); render() },
  dup: () => { snap(); const p = { ...M.get(sel), id: uid() }; T().people.push(p); sel = p.id; commit(); toast('Persona duplicata (senza relazioni)') },
  del: () => { if (!confirm('Eliminare “' + fullname(M.get(sel)) + '” e le sue relazioni?')) return; snap(); const t = T(); t.people = t.people.filter(p => p.id !== sel); if (t.ref === sel) t.ref = null; collapsed.delete(sel); sel = null; commit() },
  unl: b => { snap(); T().rels = T().rels.filter(r => r.id !== b.dataset.r); commit() },
  rk: b => { const r = T().rels.find(x => x.id === b.dataset.r); ask('Tipo di relazione', kindField(r.t), f => { snap(); r.k = kindOf(f) || (r.t === 'pc' ? 'bio' : 'coniuge'); commit() }) },
  theme: () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; commit() },
  demo: () => {
    snap(); const t = T(), P = (n, c, s, y) => { const p = { ...blank(), id: uid(), nome: n, cognome: c, sesso: s, by: String(y) }; t.people.push(p); return p.id };
    const a = P('Giuseppe', 'Rossi', 'M', 1920), b = P('Maria', 'Bianchi', 'F', 1924), c = P('Luigi', 'Rossi', 'M', 1948), d = P('Anna', 'Verdi', 'F', 1950), e = P('Paola', 'Rossi', 'F', 1951), f = P('Marco', 'Neri', 'M', 1949), g = P('Elena', 'Gallo', 'F', 1955), h = P('Sara', 'Rossi', 'F', 1975), i = P('Luca', 'Rossi', 'M', 1978), j = P('Giulia', 'Neri', 'F', 1976), k = P('Davide', 'Neri', 'M', 1980);
    union(a, b); link(a, c); link(b, c); link(a, e); link(b, e); union(c, d, 'ex'); union(c, g); link(c, h); link(d, h); link(c, i, 'adottiva'); link(g, i, 'adottiva'); union(e, f); link(e, j); link(f, j); link(e, k); link(f, k); commit(); fit();
  },
  trees: () => {
    modal('Alberi genealogici', `<table>${S.trees.map(t => `<tr><td>${t.id === S.cur ? '● ' : ''}<b>${esc(t.name)}</b> <span class="mu">(${t.people.length})</span></td><td align="right"><button data-act="topen" data-t="${t.id}">Apri</button> <button data-act="tren" data-t="${t.id}">Rinomina</button> <button class="dg" data-act="tdel" data-t="${t.id}">Elimina</button></td></tr>`).join('')}</table>`, `<button class="pri" data-act="tnew">Nuovo albero</button>`);
  },
  topen: b => { S.cur = b.dataset.t; sel = null; collapsed.clear(); mode = 'all'; $('#dlg').close(); commit(); fit() },
  tnew: () => { const n = prompt('Nome del nuovo albero:', 'Nuovo albero'); if (!n) return; const t = newTree(n); S.trees.push(t); S.cur = t.id; sel = null; $('#dlg').close(); commit(); fit() },
  tren: b => { const t = S.trees.find(x => x.id === b.dataset.t), n = prompt('Nuovo nome:', t.name); if (n) { t.name = n; commit(); ACT.trees() } },
  tdel: b => { if (S.trees.length < 2) return toast('Deve esistere almeno un albero'); const t = S.trees.find(x => x.id === b.dataset.t); if (!confirm('Eliminare l’albero “' + t.name + '”?')) return; snap(); S.trees = S.trees.filter(x => x !== t); fixCur(); sel = null; commit(); ACT.trees() },
  stats: () => {
    const all = new Set(M.keys()), g = gens(all), fam = new Set(); T().rels.forEach(r => fam.add(r.t === 'un' ? [r.a, r.b].sort().join() : [...(PARS.get(r.c) || [])].sort().join()));
    const ref = T().ref, n = ref ? descOf(ref).size : null;
    modal('Statistiche', `<table>${[['Persone', M.size], ['Generazioni', M.size ? Math.max(...Object.values(g)) + 1 : 0], ['Famiglie (nuclei)', fam.size], ['Relazioni', T().rels.length], ['Discendenti della persona di riferimento', ref ? n + ' (' + esc(fullname(M.get(ref))) + ')' : 'imposta un riferimento dalla scheda persona']].map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')}</table>`);
  },
  check: () => { const o = issues(); modal('Controllo relazioni', o.length ? '<ul>' + o.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '✅ Nessuna incoerenza trovata.') },
  settings: () => {
    modal('Impostazioni', SC.map(([t, f]) => `<div class="sec">${t}</div>` + f.map(([k, l, ty, a, b]) => `<div class="row"><span>${l}</span>` + (ty === 'r' ? `<input type="range" data-s="${k}" min="${a}" max="${b}" value="${S.settings[k]}">` : ty === 'c' ? `<input type="color" data-s="${k}" value="${S.settings[k]}">` : ty === 'b' ? `<input type="checkbox" data-s="${k}"${S.settings[k] ? ' checked' : ''}>` : `<select data-s="${k}">${a.map(o => `<option value="${esc(o[0])}"${S.settings[k] === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`) + '</div>').join('')).join(''), `<button data-act="reset">Ripristina predefiniti</button><button class="pri" data-act="close">Fatto</button>`);
  },
  reset: () => { S.settings = { ...DEF }; commit(); ACT.settings() },
  io: () => modal('Importa / Esporta', `<p><button class="pri" data-act="expjson">⬇ Esporta albero in JSON</button></p><p>Importa JSON: <input type="file" id="imp" accept=".json,application/json"></p><p class="mu">Il file contiene persone, relazioni e impostazioni grafiche. Prima dell’importazione verrà mostrata un’anteprima.</p>`),
  expjson: () => {
    const t = T(), o = { format: 'albero-genealogico', version: 1, exported: new Date().toISOString(), settings: S.settings, tree: { name: t.name, ref: t.ref, people: t.people, rels: t.rels } };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' })); a.download = t.name.replace(/\W+/g, '_') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  pdf: () => ask('Esporta PDF vettoriale', [{ n: 'scope', l: 'Contenuto', o: [['all', 'Albero completo'], ['desc', 'Solo discendenti (persona selezionata o di riferimento)'], ['anc', 'Solo antenati (persona selezionata o di riferimento)']] }, { n: 'orient', l: 'Formato pagina', o: [['auto', 'Automatico (si adatta alla dimensione dell’albero)'], ['landscape', 'A3 orizzontale'], ['portrait', 'A3 verticale']] }], pdf),
  imgo: b => doImport(b.dataset.m),
};
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b);
  if (!e.target.closest('.sw')) $('#sr').hidden = true;
});
function go(id) { if (!L.map[id]) { mode = 'all'; } sel = id; $('#sr').hidden = true; if ($('#dlg').open) $('#dlg').close(); render(); center(id) }
$('#vm').onchange = e => { if (e.target.value !== 'all' && !(T().ref || sel)) { toast('Imposta prima una persona di riferimento'); e.target.value = 'all'; return } if (!T().ref && sel) T().ref = sel; mode = e.target.value; commit(); fit() };
$('#q').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase(), r = $('#sr'); if (!q) { r.hidden = true; return }
  const res = T().people.filter(p => KEYS.some(k => k !== 'foto' && String(p[k]).toLowerCase().includes(q))).slice(0, 8);
  r.innerHTML = res.map(p => `<a data-go="${esc(p.id)}">${esc(fullname(p))} <small class="mu">${esc(dline(p))}</small></a>`).join('') || '<a class="mu">Nessun risultato</a>'; r.hidden = false;
});
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !/INPUT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'z') { e.preventDefault(); undo() } if (e.key === 'y') { e.preventDefault(); redo() } } });

/* ===== IMPOSTAZIONI: schema e applicazione immediata ===== */
const SC = [['Layout', [['gapX', 'Distanza orizzontale', 'r', 10, 150], ['gapY', 'Distanza tra generazioni', 'r', 30, 250], ['orient', 'Orientamento', 's', [['v', 'Verticale'], ['h', 'Orizzontale']]]]],
['Schede', [['cw', 'Larghezza scheda', 'r', 120, 340], ['ch', 'Altezza scheda', 'r', 46, 160], ['av', 'Dimensione foto', 'r', 24, 90], ['rad', 'Arrotondamento', 'r', 0, 40], ['bg', 'Colore sfondo', 'c'], ['bd', 'Colore bordo', 'c'], ['genc', 'Colori per generazione', 'b'], ['font', 'Font', 's', [['system-ui,sans-serif', 'Sans'], ['Georgia,serif', 'Serif'], ['"Trebuchet MS",sans-serif', 'Trebuchet'], ['"Courier New",monospace', 'Monospazio']]], ['fs', 'Dimensione testo', 'r', 9, 22]]],
['Collegamenti', [['lk', 'Colore discendenza', 'c'], ['uc', 'Colore unioni', 'c'], ['ac', 'Colore adozioni', 'c'], ['lw', 'Spessore linee', 'r', 1, 8], ['ls', 'Stile linee', 's', [['solid', 'Continuo'], ['dashed', 'Tratteggiato'], ['dotted', 'Punteggiato']]]]],
['Visualizzazione', [['dates', 'Mostra date', 'b'], ['places', 'Mostra luoghi', 'b'], ['photos', 'Mostra fotografie', 'b'], ['theme', 'Tema', 's', [['light', 'Chiaro'], ['dark', 'Scuro']]]]]];
document.addEventListener('input', e => {
  const k = e.target.dataset.s; if (!k) return; const t = e.target;
  S.settings[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value; commit();
});

/* ===== CONTROLLO COERENZA ===== */
function issues() {
  const o = [], t = T(), nm = i => fullname(M.get(i)), yr = i => +M.get(i).by || null;
  const indeg = new Map(t.people.map(p => [p.id, 0])); t.rels.filter(r => r.t === 'pc').forEach(r => indeg.set(r.c, indeg.get(r.c) + 1));
  const q = [...indeg].filter(x => !x[1]).map(x => x[0]); let seen = 0;
  while (q.length) { const i = q.pop(); seen++; for (const c of KIDS.get(i) || []) { indeg.set(c, indeg.get(c) - 1); if (!indeg.get(c)) q.push(c) } }
  if (seen < M.size) o.push('Ciclo di parentele: qualcuno risulta antenato di sé stesso.');
  for (const r of t.rels) if (r.t === 'pc') {
    const a = yr(r.p), b = yr(r.c); if (a && b && b <= a) o.push(`${nm(r.c)} è nato/a non dopo il genitore ${nm(r.p)}.`); else if (a && b && b - a < 12) o.push(`${nm(r.p)} ha solo ${b - a} anni più di ${nm(r.c)}.`);
    const dy = +M.get(r.p).dy; if (dy && b && b > dy + 1) o.push(`${nm(r.c)} nato/a dopo la morte del genitore ${nm(r.p)}.`);
  }
  for (const [c, ps] of PARS) if (ps.filter(p => (PK.get(p + '>' + c) || 'bio') === 'bio').length > 2) o.push(`${nm(c)} ha più di 2 genitori biologici.`);
  const keys = new Map(); t.people.forEach(p => { const k = [p.nome, p.cognome, p.by].join('|').toLowerCase(); if (p.nome && p.cognome) keys.set(k, (keys.get(k) || 0) + 1) }); keys.forEach((n, k) => n > 1 && o.push(`Possibile duplicato: ${k.replace(/\|/g, ' ')}.`));
  return o;
}

/* ===== IMPORTAZIONE CON VALIDAZIONE E ANTEPRIMA ===== */
function parseImport(o) {
  const log = [], tr = o && (o.tree || o); if (!tr || !Array.isArray(tr.people)) throw Error('File non valido: elenco persone mancante');
  const ids = new Set(), people = [];
  for (const p of tr.people) {
    if (!p || typeof p !== 'object') { log.push('Voce non valida scartata'); continue }
    let id = typeof p.id === 'string' && p.id ? p.id : null; if (!id) { id = uid(); log.push('Persona senza id: assegnato nuovo id') }
    if (ids.has(id)) { log.push(`Id duplicato "${id}": persona scartata`); continue }
    ids.add(id); const n = { ...blank(), id }; KEYS.forEach(k => { if (p[k] != null) n[k] = String(p[k]) }); people.push(n);
  }
  const rels = [], seen = new Set();
  for (const r of tr.rels || []) {
    const ok = r && ((r.t === 'pc' && ids.has(r.p) && ids.has(r.c) && r.p !== r.c) || (r.t === 'un' && ids.has(r.a) && ids.has(r.b) && r.a !== r.b));
    if (!ok) { log.push('Relazione non valida scartata'); continue }
    const k = r.t === 'pc' ? 'pc' + r.p + '>' + r.c : 'un' + [r.a, r.b].sort(); if (seen.has(k)) { log.push('Relazione duplicata scartata'); continue } seen.add(k);
    rels.push({ id: typeof r.id === 'string' ? r.id : uid(), t: r.t, ...(r.t === 'pc' ? { p: r.p, c: r.c } : { a: r.a, b: r.b }), k: String(r.k || (r.t === 'pc' ? 'bio' : 'coniuge')) });
  }
  return { tree: { name: String(tr.name || 'Importato'), people, rels, ref: ids.has(tr.ref) ? tr.ref : null }, settings: o.settings && typeof o.settings === 'object' ? o.settings : null, log };
}
let PEND = null;
document.addEventListener('change', e => {
  if (e.target.id !== 'imp' || !e.target.files[0]) return; const r = new FileReader();
  r.onload = () => {
    try {
      PEND = parseImport(JSON.parse(r.result)); const cur = new Map(T().people.map(p => [p.id, p]));
      const same = PEND.tree.people.filter(p => cur.has(p.id) && JSON.stringify({ ...cur.get(p.id) }) === JSON.stringify(p)).length, clash = PEND.tree.people.filter(p => cur.has(p.id)).length - same;
      modal('Anteprima importazione', `<p><b>${esc(PEND.tree.name)}</b>: ${PEND.tree.people.length} persone, ${PEND.tree.rels.length} relazioni.</p><p>Impostazioni grafiche: ${PEND.settings ? 'presenti' : 'assenti'}. Persone già presenti identiche: ${same}; stesso id ma dati diversi: ${clash}.</p>${PEND.log.length ? `<p>Problemi rilevati e corretti (${PEND.log.length}):</p><ul>${[...new Set(PEND.log)].slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>✅ Dati integri.</p>'}<label><span><input type="checkbox" id="isett" checked> Importa anche le impostazioni grafiche</span></label>`,
        `<button data-act="close">Annulla</button><button data-act="imgo" data-m="merge">Unisci all’albero attuale</button><button class="pri" data-act="imgo" data-m="replace">Sostituisci albero attuale</button>`);
    } catch (err) { toast('Importazione fallita: ' + err.message) }
  };
  r.readAsText(e.target.files[0]);
});
function doImport(m) {
  if (!PEND) return; snap(); const t = T(), im = PEND.tree;
  if (m === 'replace') { t.people = im.people; t.rels = im.rels; t.ref = im.ref; t.name = im.name }
  else {
    const cur = new Map(t.people.map(p => [p.id, p])), map = {};
    for (const p of im.people) { const c = cur.get(p.id); if (c && JSON.stringify(c) === JSON.stringify(p)) map[p.id] = p.id; else { map[p.id] = c ? uid() : p.id; t.people.push({ ...p, id: map[p.id] }) } }
    const has = new Set(t.rels.map(r => r.t === 'pc' ? 'pc' + r.p + '>' + r.c : 'un' + [r.a, r.b].sort()));
    for (const r of im.rels) { const n = r.t === 'pc' ? { ...r, id: uid(), p: map[r.p], c: map[r.c] } : { ...r, id: uid(), a: map[r.a], b: map[r.b] }; const k = n.t === 'pc' ? 'pc' + n.p + '>' + n.c : 'un' + [n.a, n.b].sort(); if (!has.has(k)) { has.add(k); t.rels.push(n) } }
  }
  if ($('#isett')?.checked && PEND.settings) S.settings = { ...DEF, ...PEND.settings };
  PEND = null; $('#dlg').close(); sel = null; commit(); fit(); toast('Importazione completata');
}

/* ===== ESPORTAZIONE PDF VETTORIALE =====
 Genera un SVG completo (testo e forme vettoriali) in una finestra di anteprima; "Salva come PDF" dal dialogo di stampa. */
function pdf(o) {
  const s = S.settings, f = o.scope === 'all' ? null : (sel || T().ref);
  if (o.scope !== 'all' && !f) return toast('Seleziona prima una persona');
  const Lr = layout(visSet(o.scope, f), s); if (!Lr.n) return toast('Niente da esportare');
  const m = 40, b = Lr.box, W = b.w + 2 * m, H = b.h + 2 * m, bg = s.theme === 'dark' ? '#0f1521' : '#ffffff';
  let size, ar; if (o.orient === 'auto') { const k = Math.min(1, 14400 / Math.max(W, H)); size = `${W * k}px ${H * k}px`; ar = W / H } else { size = 'A3 ' + o.orient; ar = o.orient === 'landscape' ? 420 / 297 : 297 / 420 }
  const sv = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - m} ${b.y - m} ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect x="${b.x - m}" y="${b.y - m}" width="${W}" height="${H}" fill="${bg}"/>${draw(Lr, s, true)}</svg>`;
  const w = window.open('', '_blank'); if (!w) return toast('Consenti i popup per vedere l’anteprima');
  w.document.write(`<!doctype html><html lang="it"><meta charset="utf-8"><title>${esc(T().name)}</title><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:${size};margin:0}body{margin:0;background:#777;font:14px system-ui}#bar{position:fixed;top:0;left:0;right:0;background:#222;color:#fff;padding:10px;display:flex;gap:12px;align-items:center}button{padding:6px 14px}#pg{margin:60px auto 20px;aspect-ratio:${ar};max-width:94vw;max-height:calc(100vh - 80px);background:${bg}}@media print{#bar{display:none}#pg{position:fixed;inset:0;margin:0;max-width:none;max-height:none;aspect-ratio:auto}}</style><div id="bar"><button onclick="print()">🖨 Stampa / Salva come PDF</button><span>Anteprima – nel dialogo di stampa scegli «Salva come PDF» e disattiva intestazioni e piè di pagina.</span></div><div id="pg">${sv}</div>`);
  w.document.close(); $('#dlg').open && $('#dlg').close();
}

/* ===== AVVIO ===== */
load(); render(); fit(); addEventListener('resize', () => { });
