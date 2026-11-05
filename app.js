/* =========================================================
 *  李曄的內容城市 — 程式
 *  一般擴充內容「不需要」改這個檔案，請改 data.js
 *  網址永遠不變：本程式不使用 hash / pushState，所有切換都在同一頁完成
 * ========================================================= */
(() => {
  'use strict';

  const D = window.ISLAND_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const T = 165; // 一格的間距（世界座標）
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svgEl = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isMobile = () => window.innerWidth <= 720;

  /* ---------- 資料整理 ---------- */
  const cats = D.categories;
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const items = D.items.filter((it) => {
    if (!catById[it.cat]) { console.warn(`[內容城市] ${it.id} 的 cat「${it.cat}」不存在，已略過`); return false; }
    return true;
  });
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));

  const relPairs = [];
  {
    const seen = new Set();
    items.forEach((it) => (it.rel || []).forEach((t) => {
      if (!itemById[t]) { console.warn(`[內容城市] ${it.id} 的 rel「${t}」找不到`); return; }
      const k = [it.id, t].sort().join('|');
      if (seen.has(k) || t === it.id) return;
      seen.add(k);
      relPairs.push([it.id, t]);
    }));
  }
  const neighbors = (id) => relPairs.filter((p) => p.includes(id)).map((p) => (p[0] === id ? p[1] : p[0]));

  /* ---------- 合併成一座大房子的地區（building: 'civic'） ----------
   * 例如職能、服務：地圖上只畫一座大房子，招牌上列出底下每一項
   */
  const groupOf = {};
  const groupItems = cats.filter((c) => c.building === 'civic').map((c) => {
    const members = items.filter((i) => i.cat === c.id);
    if (!members.length) return null;
    members.forEach((m) => { groupOf[m.id] = `grp-${c.id}`; });
    return { id: `grp-${c.id}`, cat: c.id, title: c.name, short: c.name, group: true, members, pos: c.anchor || [0, 0], clickable: false };
  }).filter(Boolean);
  const mapItems = [...items.filter((i) => !groupOf[i.id]), ...groupItems];
  const mapById = Object.fromEntries(mapItems.map((i) => [i.id, i]));
  const mapIdOf = (id) => groupOf[id] || id;

  /* ---------- 自動排版：每個地區從 anchor 螺旋向外找空格 ---------- */
  const grid = {};
  {
    const occ = new Set();
    const key = (c, r) => `${c},${r}`;
    mapItems.forEach((it) => {
      if (Array.isArray(it.pos)) { grid[it.id] = it.pos; occ.add(key(...it.pos)); }
    });
    // 市政府比較大，正上方、正下方先留空
    if (mapItems.some((i) => i.cat === 'hub')) { occ.add(key(0, 1)); occ.add(key(0, -1)); }
    const spiral = function* () {
      yield [0, 0];
      for (let k = 1; k < 40; k++) {
        const ring = [];
        for (let dc = -k; dc <= k; dc++) for (let dr = -k; dr <= k; dr++)
          if (Math.max(Math.abs(dc), Math.abs(dr)) === k) ring.push([dc, dr]);
        ring.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
        yield* ring;
      }
    };
    mapItems.forEach((it) => {
      if (grid[it.id]) return;
      const [ac, ar] = catById[it.cat].anchor || [0, 0];
      for (const [dc, dr] of spiral()) {
        const c = ac + dc, r = ar + dr;
        if (!occ.has(key(c, r))) { grid[it.id] = [c, r]; occ.add(key(c, r)); break; }
      }
    });
  }
  // 每棟建築位置稍微錯開，看起來不像棋盤
  const jit = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 - 0.5; };
  const P = (id) => {
    const fixed = mapById[id]?.cat === 'hub' || Array.isArray(mapById[id]?.pos); // 指定位置的不抖動
    return { x: grid[id][0] * T + (fixed ? 0 : jit(id) * 46), y: grid[id][1] * T + (fixed ? 0 : jit(id + '#') * 34) };
  };

  /* ---------- 建築大小權重（0～1） ----------
   * 預設依內容量自動計算：文字越長、數據 / 連結越多 → 越大
   * 想手動指定，在 data.js 那一格加 weight: 0～1
   */
  const weights = {};
  {
    const textLen = (it) => [it.subtitle, it.summary, ...(it.body || []), ...(it.fields || []).map((f) => f[1])]
      .filter(Boolean).join('').length;
    const score = (it) => Math.sqrt(textLen(it) + (it.stats?.length || 0) * 60 + (it.links?.filter((l) => l.url).length || 0) * 25 + (it.tags?.length || 0) * 8);
    const pool = items.filter((i) => i.cat !== 'hub' && i.weight == null);
    const ss = pool.map(score), lo = Math.min(...ss), hi = Math.max(...ss);
    items.forEach((it) => {
      weights[it.id] = it.weight != null ? clamp(+it.weight, 0, 1) : hi > lo ? (score(it) - lo) / (hi - lo) : 0.5;
    });
  }

  /* ---------- 狀態 ---------- */
  const state = {
    labels: true, lines: false, movers: true, animals: true, paused: false, log: true,
    active: new Set(cats.map((c) => c.id)),
    selected: null,
    view: 'map',
  };

  /* =========================================================
   *  地圖繪製
   * ========================================================= */
  const svg = $('#map');
  const layers = {};

  /* ---------- 積木拼圖風格的配色 ---------- */
  const WOOD = '#d9b58a';       // 木頭底板
  const WOOD_SIDE = '#c49465';  // 木頭側邊（厚度）
  const WOOD_DARK = '#a8794d';  // 拼圖縫
  const OUT = '#5b4636';        // 插圖描邊
  const pastel = (hex) => shade(hex, 0.32);

  function buildMap() {
    const defs = svgEl('defs', {}, svg);
    defs.innerHTML = `
      <pattern id="sea" width="120" height="70" patternUnits="userSpaceOnUse">
        <path d="M8 20 q8 -6 16 0 t16 0" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M68 52 q8 -6 16 0 t16 0" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.2" stroke-linecap="round"/>
      </pattern>
      <pattern id="grain" width="60" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 7 q15 -3 30 0 t30 0" fill="none" stroke="rgba(140,95,50,.12)" stroke-width="1.2"/>
      </pattern>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>`;

    svgEl('rect', { x: -20000, y: -20000, width: 40000, height: 40000, fill: 'var(--sea)' }, svg);
    svgEl('rect', { x: -20000, y: -20000, width: 40000, height: 40000, fill: 'url(#sea)', class: 'waves' }, svg);

    ['island', 'outer', 'clouds', 'region', 'pieces', 'deco', 'critters', 'lines', 'movers', 'tiles', 'plates', 'sky', 'districts'].forEach((n) => {
      layers[n] = svgEl('g', { class: `layer-${n}` }, svg);
    });

    const rand = seeded(20261106);
    const R = (a, b) => a + rand() * (b - a);
    const pos = Object.fromEntries(mapItems.map((i) => [i.id, P(i.id)]));
    const xs = mapItems.map((i) => pos[i.id].x), ys = mapItems.map((i) => pos[i.id].y);
    bounds = { x0: Math.min(...xs) - T, x1: Math.max(...xs) + T, y0: Math.min(...ys) - T, y1: Math.max(...ys) + T };
    const itemPts = mapItems.map((i) => pos[i.id]);
    const near = (p, list, d) => list.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < d);

    // ---- 空地：湖、公園、廣場（各自是一小塊拼圖，也是小動物的家）----
    const extra = [];
    {
      const cols = mapItems.map((i) => grid[i.id][0]), rows = mapItems.map((i) => grid[i.id][1]);
      const used = new Set(mapItems.map((i) => grid[i.id].join(',')));
      const cands = [];
      for (let r = Math.min(...rows); r <= Math.max(...rows); r++) for (let c = Math.min(...cols); c <= Math.max(...cols); c++) {
        if (used.has(`${c},${r}`)) continue;
        const p = { x: c * T + R(-14, 14), y: r * T + R(-12, 12) };
        const clear = Math.min(...mapItems.map((i) => Math.hypot(p.x - pos[i.id].x, p.y - pos[i.id].y) - (i.group ? 50 : 0)));
        if (clear > T * 0.9) cands.push({ ...p, clear });
      }
      cands.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
      const taken = [];
      const take = () => { const i = cands.findIndex((p) => !near(p, taken, T * 0.95)); if (i < 0) return null; const p = cands.splice(i, 1)[0]; taken.push(p); return p; };
      ['lake', 'park', 'plaza', 'park', 'park', 'plaza'].forEach((k, i) => {
        const p = take();
        if (p) extra.push({ id: `__${k}${i}`, kind: k, x: p.x, y: p.y, r: T * (k === 'lake' ? 0.5 : 0.42) });
      });
    }

    // ---- 我的城市：亮起來的那一區，外形是一個圓潤完整的城市輪廓 ----
    const sites = [
      ...mapItems.map((i) => ({ id: i.id, x: pos[i.id].x, y: pos[i.id].y, r: T * (i.cat === 'hub' ? 0.85 : i.group ? 0.95 : 0.62), group: i.cat })),
      ...extra.map((e) => ({ id: e.id, x: e.x, y: e.y, r: e.r * 1.1, group: e.id, kind: e.kind })),
    ];
    const cx0 = sites.reduce((s, p) => s + p.x, 0) / sites.length, cy0 = sites.reduce((s, p) => s + p.y, 0) / sites.length;
    const N = 96;
    const regionR = radialHull(sites, cx0, cy0, N, T * 0.4);
    const smooth = (arr, w) => arr.map((_, i) => { let s = 0; for (let k = -w; k <= w; k++) s += arr[(i + k + arr.length) % arr.length]; return s / (2 * w + 1); });
    let rr = regionR.map((r, i) => Math.max(r, smooth(regionR, 9)[i]));
    rr = smooth(rr, 3).map((r, i) => r * (1 + Math.sin(i * 0.9 + 1.3) * 0.012 + Math.sin(i * 2.3) * 0.008));
    const regionPts = rr.map((r, i) => ({ x: cx0 + Math.cos((i / N) * Math.PI * 2) * r, y: cy0 + Math.sin((i / N) * Math.PI * 2) * r }));
    const regionD = smoothPath(regionPts);

    // ---- 整座大島：比我的城市大很多，海岸線有海灣和半島 ----
    const ph = [R(0, 6.28), R(0, 6.28), R(0, 6.28)];
    const islandPts = rr.map((r, i) => {
      const a = (i / N) * Math.PI * 2;
      const extraR = T * (1.05 + 0.32 * Math.sin(a * 2 + ph[0]) + 0.2 * Math.sin(a * 3 + ph[1]) + 0.1 * Math.sin(a * 7 + ph[2]));
      const r2 = smooth(rr, 12)[i] + extraR;
      return { x: cx0 + Math.cos(a) * r2 * 1.12, y: cy0 + Math.sin(a) * r2 * 0.92 };
    });
    const islandD = smoothPath(islandPts);
    svgEl('path', { d: islandD, fill: 'rgba(255,255,255,.5)', stroke: 'rgba(255,255,255,.45)', 'stroke-width': 70, 'stroke-linejoin': 'round' }, layers.island);
    svgEl('path', { d: islandD, fill: '#2d4a52', opacity: 0.14, transform: 'translate(10,22)' }, layers.island);
    svgEl('path', { d: islandD, fill: '#c9a273', transform: 'translate(0,12)' }, layers.island);
    svgEl('path', { d: islandD, fill: '#f1e3c2', stroke: '#e6d2a8', 'stroke-width': 3 }, layers.island);
    const islandClip = svgEl('clipPath', { id: 'clip-island' }, defs);
    svgEl('path', { d: islandD, transform: 'translate(0,0) scale(1)' }, islandClip);

    // ---- 島上其他區域：還沒開放的灰調拼圖片 ----
    {
      const inside = (p, pts) => { // 用射線法判斷點在多邊形內
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i], b = pts[j];
          if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
        }
        return c;
      };
      const ib = { x0: Math.min(...islandPts.map((p) => p.x)), x1: Math.max(...islandPts.map((p) => p.x)), y0: Math.min(...islandPts.map((p) => p.y)), y1: Math.max(...islandPts.map((p) => p.y)) };
      const seeds = [];
      for (let k = 0; k < 2000 && seeds.length < 34; k++) {
        const p = { x: R(ib.x0, ib.x1), y: R(ib.y0, ib.y1) };
        if (!inside(p, islandPts) || inside(p, regionPts) || near(p, seeds, T * 1.25)) continue;
        seeds.push({ ...p, id: `o${seeds.length}` });
      }
      const tones = ['#e3e1cf', '#e8dccb', '#dbe2d3', '#ebe3d4', '#dde0e3', '#e6dade', '#e0e6d0'];
      const box = { x0: ib.x0 - T, y0: ib.y0 - T, x1: ib.x1 + T, y1: ib.y1 + T };
      const g = svgEl('g', { 'clip-path': 'url(#clip-island)' }, layers.outer);
      const seamG = svgEl('g', { 'clip-path': 'url(#clip-island)' }, layers.outer);
      seeds.forEach((s, i) => {
        let poly = [{ x: box.x0, y: box.y0, e: null }, { x: box.x1, y: box.y0, e: null }, { x: box.x1, y: box.y1, e: null }, { x: box.x0, y: box.y1, e: null }];
        seeds.forEach((o) => { if (o !== s && poly.length) poly = clipHalf(poly, s, o); });
        s.poly = poly;
        svgEl('path', { d: polyPath(poly), fill: tones[i % tones.length] }, g);
        poly.forEach((v, j) => {
          if (!v.e || v.e <= s.id) return;
          const nx = poly[(j + 1) % poly.length];
          const pts = [v, ...edgePts(v, nx, true)];
          svgEl('path', { d: 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L'), class: 'seam seam-outer' }, seamG);
        });
      });
      // 島上的小風景：山、樹
      const scenery = svgEl('g', { class: 'scenery' }, layers.outer);
      seeds.forEach((s, i) => {
        if (i % 3 === 0) flatMountain(scenery, s.x, s.y, R(16, 24));
        else if (i % 3 === 1) for (let k = 0; k < 3; k++) flatTree(s.x + R(-26, 26), s.y + R(-18, 18), R(6, 8), rand, scenery, true);
      });
      const far = [...seeds].sort((a, b) => Math.hypot(b.x - cx0, b.y - cy0) - Math.hypot(a.x - cx0, a.y - cy0));
      // 雲：飄在還沒開放的地方
      for (let k = 0; k < 7; k++) {
        const s = far[(k * 3) % far.length];
        if (s) cloud(layers.clouds, s.x + R(-30, 30), s.y + R(-40, 10), R(0.9, 1.5), k);
      }
    }

    // ---- 我的城市：發光 → 陰影 → 木頭厚度 → 外框 ----
    svgEl('path', { d: regionD, fill: '#fff3b0', filter: 'url(#glow)', opacity: 0.95, class: 'region-glow' }, layers.region);
    svgEl('path', { d: regionD, fill: '#2d3a40', opacity: 0.18, transform: 'translate(8,20)' }, layers.region);
    svgEl('path', { d: regionD, fill: WOOD_SIDE, transform: 'translate(0,11)' }, layers.region);
    svgEl('path', { d: regionD, fill: WOOD, stroke: WOOD_DARK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, layers.region);

    // ---- 切成一片片拼圖：每個點分到離它最近的區域（Voronoi），同一區合成一片 ----
    const box = { x0: bounds.x0 - T * 4, y0: bounds.y0 - T * 4, x1: bounds.x1 + T * 4, y1: bounds.y1 + T * 4 };
    sites.forEach((s) => {
      let poly = [{ x: box.x0, y: box.y0, e: null }, { x: box.x1, y: box.y0, e: null }, { x: box.x1, y: box.y1, e: null }, { x: box.x0, y: box.y1, e: null }];
      sites.forEach((o) => { if (o !== s && poly.length) poly = clipHalf(poly, s, o); });
      s.poly = poly;
    });
    const byId = Object.fromEntries(sites.map((s) => [s.id, s]));
    const regionClip = svgEl('clipPath', { id: 'clip-region' }, defs);
    svgEl('path', { d: regionD }, regionClip);
    const piecesG = svgEl('g', { 'clip-path': 'url(#clip-region)' }, layers.pieces);
    [...new Set(sites.map((s) => s.group))].forEach((gid) => {
      const members = sites.filter((s) => s.group === gid);
      const kind = members[0].kind;
      const color = kind === 'lake' ? '#a9d8e3' : kind === 'park' ? '#bfe0a2' : kind === 'plaza' ? '#f4e7cf' : gid === 'hub' ? '#fbe7a6' : pastel(catById[gid].color);
      const cp = svgEl('clipPath', { id: `clip-piece-${gid}` }, defs);
      members.forEach((s) => svgEl('path', { d: polyPath(s.poly) }, cp));
      const g = svgEl('g', { class: 'piece', ...(catById[gid] ? { 'data-cat': gid } : {}), 'clip-path': `url(#clip-piece-${gid})` }, piecesG);
      svgEl('path', { d: regionD, fill: color }, g);
    });
    // 拼圖縫：只畫在「不同片」之間
    const seams = svgEl('g', { class: 'seams', 'clip-path': 'url(#clip-region)' }, layers.pieces);
    sites.forEach((s) => s.poly.forEach((v, i) => {
      if (!v.e || v.e <= s.id) return;
      const o = byId[v.e];
      if (!o || o.group === s.group) return;
      const nx = s.poly[(i + 1) % s.poly.length];
      const pts = [v, ...edgePts(v, nx, true)];
      svgEl('path', { d: 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L'), class: 'seam' }, seams);
    }));
    svgEl('path', { d: regionD, fill: 'none', stroke: WOOD_DARK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, layers.pieces);
    svgEl('path', { d: regionD, fill: 'none', class: 'region-edge' }, layers.pieces);

    // 空地上的小東西
    extra.forEach((e) => {
      if (e.kind === 'lake') {
        svgEl('path', { d: `M${e.x - 26} ${e.y - 12} q9 -5 18 0 M${e.x + 4} ${e.y + 16} q9 -5 18 0`, stroke: '#fff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, layers.deco);
        spots.lake = { x: e.x, y: e.y, s: e.r, r: e.r };
      } else if (e.kind === 'park') {
        for (let k = 0; k < 3; k++) { const a = rand() * 6.28, d = R(18, e.r * 0.6); flatTree(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, R(7, 10), rand); }
        spots.park.push({ x: e.x, y: e.y, s: e.r * 1.1, r: e.r });
      } else {
        svgEl('circle', { cx: e.x, cy: e.y, r: 16, fill: '#fff', stroke: OUT, 'stroke-width': 1.5 }, layers.deco);
        svgEl('circle', { cx: e.x, cy: e.y, r: 10, fill: '#a9d8e3', stroke: OUT, 'stroke-width': 1.2 }, layers.deco);
        svgEl('path', { d: `M${e.x} ${e.y - 3} v-9 M${e.x - 4} ${e.y - 9} q4 -6 8 0`, stroke: '#7fbccc', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }, layers.deco);
        spots.plaza.push({ x: e.x, y: e.y, s: e.r * 1.1, r: e.r });
      }
    });

    // ---- 拼圖片上的小插圖：樹、房子 ----
    const decos = [];
    mapItems.forEach((it) => {
      if (it.group) return;
      const { x, y } = pos[it.id];
      const n = it.cat === 'hub' ? 3 : 2;
      for (let k = 0, tries = 0; k < n && tries < 24; tries++) {
        const a = rand() * Math.PI * 2, d = R(52, T * 0.62);
        const q = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.85 };
        if (mapItems.some((o) => Math.hypot(q.x - pos[o.id].x, q.y - pos[o.id].y) < (o.group ? 110 : o.cat === 'hub' ? 80 : 52)) || near(q, decos, 22)) continue;
        decos.push(q); k++;
        if (rand() < 0.6) flatTree(q.x, q.y, R(6, 9), rand);
        else flatHouse(q.x, q.y, pastel(catById[it.cat].color), rand);
      }
    });

    // 地區名稱（大房子自己有招牌，就不另外標）
    cats.forEach((c) => {
      if (c.id === 'hub' || c.building === 'civic') return;
      const members = mapItems.filter((i) => i.cat === c.id);
      if (members.length < 2) return; // 只有一格的地區（聯絡、理念）名牌就夠了，不再多一個框
      const pts = members.map((m) => pos[m.id]);
      const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const y = Math.min(...pts.map((p) => p.y)) - T * 0.5;
      const g = svgEl('g', { class: 'district', 'data-cat': c.id, transform: `translate(${x},${y})` }, layers.districts);
      const t = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'district-text' }, g);
      t.textContent = `${c.icon} ${c.name}`;
      const bb = t.getBBox();
      const bg = svgEl('rect', { x: bb.x - 12, y: bb.y - 5, width: bb.width + 24, height: bb.height + 10, rx: 11, fill: '#fffdf7', stroke: shade(c.color, -0.3), class: 'district-bg' }, g);
      g.insertBefore(bg, t);
    });

    // 協作線（職能、服務的線會接到牠們的大房子）
    const seenPair = new Set();
    relPairs.forEach(([a0, b0], i) => {
      const a = mapIdOf(a0), b = mapIdOf(b0);
      const k = [a, b].sort().join('|');
      if (a === b || seenPair.has(k)) return;
      seenPair.add(k);
      const pa = pos[a], pb = pos[b];
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(60, len * 0.18) * (i % 2 ? 1 : -1);
      const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
      const path = svgEl('path', {
        d: `M${pa.x} ${pa.y} Q${cx} ${cy} ${pb.x} ${pb.y}`,
        class: 'rel', stroke: shade(catById[mapById[a].cat].color, -0.1),
        'data-a': a, 'data-b': b,
      }, layers.lines);
      const mover = svgEl('circle', { r: 5, class: 'mover', fill: shade(catById[mapById[b].cat].color, -0.2) }, layers.movers);
      movers.push({ path, mover, len: 0, t: Math.random(), speed: 0.05 + Math.random() * 0.05, a, b });
    });

    // 建築 / 木片：由北往南畫
    [...mapItems].sort((p, q) => pos[p.id].y - pos[q.id].y).forEach((it) => {
      const { x, y } = pos[it.id];
      const c = catById[it.cat];
      const style = buildingStyle(it);
      const open = canOpen(it);
      const scale = style === 'hall' ? 1.1 : ['civic', 'house', 'post', 'lighthouse'].includes(style) ? 1 : 0.86 + 0.3 * (weights[it.id] ?? 0.5);
      const g = svgEl('g', {
        class: `tile b-${style}${style === 'hall' ? ' hub' : ''}${open ? '' : ' static'}`, transform: `translate(${x},${y}) scale(${scale.toFixed(3)})`,
        'data-id': it.id, 'data-cat': it.cat,
        ...(open ? { tabindex: 0, role: 'button', 'aria-label': it.title } : { 'aria-label': it.title }),
      }, layers.tiles);
      const body = style === 'hall' ? drawHall(g, it, c, defs) : style === 'civic' ? drawCivic(g, it, c, defs) : style === 'house' ? drawHouse(g, it, c, defs) : style === 'post' ? drawPost(g, it, c) : style === 'lighthouse' ? drawLighthouse(g, it, c) : drawChip(g, it, c, defs);
      if (body.plateY == null) return; // 大房子自己有招牌
      // 名牌不跟著縮放，字才夠大
      const plate = svgEl('g', { class: `plate${open ? '' : ' static'}`, 'data-id': it.id, transform: `translate(${x},${(y + body.plateY * scale).toFixed(1)})` }, layers.plates);
      const bg = svgEl('rect', { class: 'plate-bg', rx: 10 }, plate);
      const t = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'plate-text' }, plate);
      t.textContent = it.short || it.title;
      const bb = t.getBBox();
      bg.setAttribute('x', bb.x - 9); bg.setAttribute('y', bb.y - 4);
      bg.setAttribute('width', bb.width + 18); bg.setAttribute('height', bb.height + 8);
    });

    movers.forEach((m) => { m.len = m.path.getTotalLength(); });
  }

  // 從中心往外每個角度，找最遠的那個點的邊緣 → 得到一個包住所有點的圓潤輪廓
  function radialHull(sites, cx, cy, N, minR) {
    const out = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      let best = minR;
      sites.forEach((s) => {
        const vx = s.x - cx, vy = s.y - cy;
        const along = vx * ux + vy * uy, perp = Math.abs(vx * uy - vy * ux);
        const r = s.r * 1.15;
        if (perp < r) best = Math.max(best, along + Math.sqrt(r * r - perp * perp));
      });
      out.push(best);
    }
    return out;
  }

  // 一串點 → 圓滑的封閉曲線
  function smoothPath(pts) {
    const n = pts.length, P_ = (i) => pts[(i + n) % n];
    let d = `M${P_(0).x.toFixed(1)} ${P_(0).y.toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = P_(i - 1), p1 = P_(i), p2 = P_(i + 1), p3 = P_(i + 2);
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d + 'Z';
  }

  // Voronoi 區塊 → 路徑（邊加上鋸齒）
  function polyPath(poly) {
    return poly.map((v, i) => {
      const nx = poly[(i + 1) % poly.length];
      return (i ? '' : `M${v.x.toFixed(1)} ${v.y.toFixed(1)}`) + edgePts(v, nx, !!v.e).map((p) => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    }).join('') + 'Z';
  }

  function flatMountain(parent, x, y, h) {
    const g = svgEl('g', { class: 'mountain' }, parent);
    svgEl('path', { d: `M${x - h * 1.3} ${y + h * 0.5} L${x - h * 0.2} ${y - h} L${x + h * 0.9} ${y + h * 0.5} Z`, fill: '#c8d3bd', stroke: '#9aa58f', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
    svgEl('path', { d: `M${x - h * 0.2} ${y + h * 0.5} L${x + h * 0.6} ${y - h * 0.5} L${x + h * 1.5} ${y + h * 0.5} Z`, fill: '#d6decb', stroke: '#9aa58f', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
    svgEl('path', { d: `M${x - h * 0.55} ${y - h * 0.5} L${x - h * 0.2} ${y - h} L${x + h * 0.15} ${y - h * 0.5} Z`, fill: '#fff', opacity: 0.85 }, g);
  }

  function cloud(parent, x, y, s, k) {
    const g = svgEl('g', { class: `cloud cloud-${k % 3}`, transform: `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(2)})` }, parent);
    [[-22, 4, 14], [-6, -6, 18], [14, 0, 15], [28, 6, 10], [0, 8, 16]].forEach(([dx, dy, r]) => svgEl('circle', { cx: dx, cy: dy, r, fill: '#fff' }, g));
  }

  /* ---------- 建築樣式 ----------
   * hall  ：市政府（市中心）— 畫在拼圖上的插圖
   * civic ：行政單位（地區設 building: 'civic'）— 畫在拼圖上的小插圖
   * chip  ：其他可點的內容 — 一塊正方形小木片（像拼圖旁邊的圖卡）
   */
  function buildingStyle(it) {
    if (it.cat === 'hub') return 'hall';
    if (it.group) return 'civic';
    const b = it.building || catById[it.cat].building;
    return ['house', 'post', 'lighthouse'].includes(b) ? b : 'chip';
  }

  function putPicture(body, it, c, defs, cx, cy, r) {
    const pic = imageOf(it);
    if (!pic) { addIcon(body, it, c, cy, r * 1.05); return; }
    const clipId = `clip-${it.id}`;
    const cp = svgEl('clipPath', { id: clipId }, defs);
    svgEl('circle', { cx, cy, r }, cp);
    const ringEl = svgEl('circle', { cx, cy, r: r + 2, fill: '#fff', stroke: OUT, 'stroke-width': 1.4 }, body);
    const img = svgEl('image', { href: pic, x: cx - r, y: cy - r, width: r * 2, height: r * 2, 'clip-path': `url(#${clipId})`, preserveAspectRatio: it.cat === 'hub' ? 'xMidYMin slice' : 'xMidYMid slice' }, body);
    img.addEventListener('error', () => { img.remove(); ringEl.remove(); addIcon(body, it, c, cy, r * 1.05); });
  }

  // 小木片：木頭側邊 + 米色表面 + 頭像
  function drawChip(g, it, c, defs) {
    const S = 64;
    svgEl('rect', { x: -S / 2 + 4, y: -S / 2 + 12, width: S, height: S, rx: 13, class: 'tshadow' }, g);
    const body = svgEl('g', { class: 'tbody' }, g);
    svgEl('rect', { x: -S / 2 - 6, y: -S / 2 - 6, width: S + 12, height: S + 18, rx: 16, class: 'ring' }, body);
    svgEl('rect', { x: -S / 2, y: -S / 2 + 6, width: S, height: S, rx: 13, fill: WOOD_SIDE }, body);
    svgEl('rect', { x: -S / 2, y: -S / 2, width: S, height: S, rx: 13, fill: '#fbf3e3', stroke: WOOD_DARK, 'stroke-width': 1.6 }, body);
    svgEl('rect', { x: -S / 2 + 5, y: -S / 2 + 5, width: S - 10, height: S - 10, rx: 9, fill: pastel(c.color), opacity: 0.55 }, body);
    putPicture(body, it, c, defs, 0, -1, 20);
    return { plateY: 50 };
  }

  // 行政單位：一座大房子，屋頂寫單位名稱，正面招牌列出底下每一項
  // 量一段文字套上某個 class 之後的大小
  function measureText(str, cls) {
    const t = svgEl('text', { x: 0, y: 0, class: cls, visibility: 'hidden' }, svg);
    t.textContent = str;
    const b = t.getBBox();
    t.remove();
    return { width: b.width, height: b.height };
  }

  function drawCivic(g, it, c) {
    const rows = it.members.map((m) => `${m.icon || c.icon}  ${m.short || m.title}`);
    // 實際量字的寬高（手機版字比較大，房子會跟著變寬）
    const itemBox = rows.map((r) => measureText(r, 'civic-item'));
    const titleW = measureText(`${c.icon} ${c.name}`, 'civic-title').width;
    const rowH = Math.max(...itemBox.map((b) => b.height)) * 1.45, boardH = rows.length * rowH + 14;
    const W = Math.max(176, Math.max(...itemBox.map((b) => b.width)) + 64, titleW + 70);
    const fy0 = -boardH / 2 - 10, fy1 = boardH / 2 + 18, roofTop = fy0 - 46;
    const col = pastel(c.color), dark = shade(c.color, -0.25);
    svgEl('ellipse', { cx: 4, cy: fy1 + 12, rx: W / 2 + 8, ry: 11, class: 'tshadow' }, g);
    const body = svgEl('g', { class: 'tbody' }, g);
    svgEl('rect', { x: -W / 2 - 18, y: roofTop - 30, width: W + 36, height: fy1 - roofTop + 50, rx: 18, class: 'ring' }, body);
    // 旗子
    svgEl('path', { d: `M${W / 2 - 22} ${roofTop + 2} V${roofTop - 24}`, stroke: OUT, 'stroke-width': 1.8 }, body);
    svgEl('path', { d: `M${W / 2 - 22} ${roofTop - 24} l15 5 l-15 5 z`, fill: dark, stroke: OUT, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, body);
    // 牆面 + 兩側柱子 + 台階
    svgEl('rect', { x: -W / 2 - 8, y: fy1, width: W + 16, height: 10, rx: 3, fill: '#efe3cc', stroke: OUT, 'stroke-width': 1.6 }, body);
    svgEl('rect', { x: -W / 2, y: fy0, width: W, height: fy1 - fy0, rx: 4, fill: '#fff8ec', stroke: OUT, 'stroke-width': 1.8 }, body);
    [-W / 2 + 10, W / 2 - 10].forEach((x) => svgEl('path', { d: `M${x} ${fy0 + 6} V${fy1 - 4}`, stroke: OUT, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, body));
    // 屋頂 + 名稱
    svgEl('path', { d: `M${-W / 2 - 14} ${fy0 + 4} L${W / 2 + 14} ${fy0 + 4} L${W / 2 - 16} ${roofTop} L${-W / 2 + 16} ${roofTop} Z`, fill: col, stroke: OUT, 'stroke-width': 1.9, 'stroke-linejoin': 'round' }, body);
    const title = svgEl('text', { x: 0, y: (fy0 + roofTop) / 2 + 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'civic-title' }, body);
    title.textContent = `${c.icon} ${c.name}`;
    // 招牌：列出每一項
    svgEl('rect', { x: -W / 2 + 20, y: fy0 + 8, width: W - 40, height: boardH, rx: 8, fill: '#fffdf7', stroke: dark, 'stroke-width': 1.6 }, body);
    rows.forEach((r, i) => {
      const y = fy0 + 8 + 7 + rowH * (i + 0.5);
      if (i) svgEl('path', { d: `M${-W / 2 + 30} ${y - rowH / 2} H${W / 2 - 30}`, stroke: 'rgba(91,70,54,.15)', 'stroke-width': 1 }, body);
      const t = svgEl('text', { x: -W / 2 + 32, y, 'dominant-baseline': 'central', class: 'civic-item' }, body);
      t.textContent = r;
    });
    return { plateY: null };
  }

  // 小建築（聯絡、理念）：斜屋頂上一個圓形招牌，可以點
  function drawHouse(g, it, c, defs) {
    const col = pastel(c.color), dark = shade(c.color, -0.25);
    const S = { stroke: OUT, 'stroke-width': 1.8, 'stroke-linejoin': 'round' };
    svgEl('ellipse', { cx: 2, cy: 34, rx: 46, ry: 8, class: 'tshadow' }, g);
    const body = svgEl('g', { class: 'tbody' }, g);
    svgEl('rect', { x: -54, y: -62, width: 108, height: 104, rx: 16, class: 'ring' }, body);
    svgEl('rect', { x: -44, y: 26, width: 88, height: 8, rx: 2, fill: '#efe3cc', ...S }, body);
    svgEl('rect', { x: -38, y: -12, width: 76, height: 39, rx: 2, fill: '#fff8ec', ...S }, body);
    [-27, 15].forEach((wx) => svgEl('path', { d: `M${wx} 12 V0 a6 6 0 0 1 12 0 V12 Z`, fill: '#bfe0ec', stroke: OUT, 'stroke-width': 1.4 }, body));
    svgEl('path', { d: 'M-7 27 V12 a7 7 0 0 1 14 0 V27', fill: dark, ...S }, body);
    svgEl('path', { d: 'M24 -26 V-46 h9 V-18', fill: col, ...S }, body); // 煙囪
    svgEl('path', { d: 'M-48 -10 L0 -50 L48 -10 Z', fill: col, ...S }, body);
    svgEl('circle', { cx: 0, cy: -25, r: 14, fill: '#fff', stroke: OUT, 'stroke-width': 1.5 }, body);
    putPicture(body, it, c, defs, 0, -25, 11.5);
    return { plateY: 48 };
  }

  // 郵局：招牌上有信封，門口有綠色、紅色郵筒
  function drawPost(g, it, c) {
    const col = pastel(c.color), dark = shade(c.color, -0.25);
    const S = { stroke: OUT, 'stroke-width': 1.8, 'stroke-linejoin': 'round' };
    svgEl('ellipse', { cx: 6, cy: 34, rx: 54, ry: 8, class: 'tshadow' }, g);
    const body = svgEl('g', { class: 'tbody' }, g);
    svgEl('rect', { x: -56, y: -58, width: 120, height: 100, rx: 16, class: 'ring' }, body);
    svgEl('rect', { x: -46, y: 26, width: 86, height: 8, rx: 2, fill: '#efe3cc', ...S }, body);
    svgEl('rect', { x: -40, y: -16, width: 74, height: 43, rx: 2, fill: '#fff8ec', ...S }, body);
    // 屋頂上的半圓山牆 + 招牌帶
    svgEl('path', { d: 'M-18 -30 A21 21 0 0 1 24 -30 Z', fill: col, ...S }, body);
    svgEl('rect', { x: -46, y: -32, width: 86, height: 17, rx: 3, fill: col, ...S }, body);
    svgEl('rect', { x: -9, y: -29.5, width: 20, height: 12, rx: 1.5, fill: '#fff', stroke: OUT, 'stroke-width': 1.3 }, body);
    svgEl('path', { d: 'M-9 -29 L1 -22 L11 -29', fill: 'none', stroke: OUT, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, body);
    svgEl('circle', { cx: 3, cy: -41, r: 4, fill: '#fff', stroke: OUT, 'stroke-width': 1.2 }, body);
    // 窗、雙開門
    [-33, 17].forEach((wx) => { svgEl('rect', { x: wx, y: -7, width: 13, height: 13, rx: 1.5, fill: '#bfe0ec', stroke: OUT, 'stroke-width': 1.4 }, body); svgEl('path', { d: `M${wx + 6.5} -7 V6 M${wx} -0.5 H${wx + 13}`, stroke: OUT, 'stroke-width': 1 }, body); });
    svgEl('rect', { x: -7, y: 6, width: 18, height: 21, rx: 2, fill: dark, ...S }, body);
    svgEl('path', { d: 'M2 6 V27', stroke: OUT, 'stroke-width': 1.2 }, body);
    // 郵筒（綠、紅）
    [['#5fae6e', 42], ['#e8574f', 54]].forEach(([fill, x]) => {
      svgEl('rect', { x: x - 5, y: 8, width: 10, height: 19, rx: 2, fill, ...S, 'stroke-width': 1.4 }, body);
      svgEl('path', { d: `M${x - 5} 10 A5 5 0 0 1 ${x + 5} 10`, fill, stroke: OUT, 'stroke-width': 1.4 }, body);
      svgEl('path', { d: `M${x - 3} 14 H${x + 3}`, stroke: OUT, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, body);
    });
    return { plateY: 50 };
  }

  // 燈塔：紅白條紋塔身，頂端燈室會發光
  function drawLighthouse(g, it, c) {
    const S = { stroke: OUT, 'stroke-width': 1.8, 'stroke-linejoin': 'round' };
    svgEl('ellipse', { cx: 3, cy: 33, rx: 38, ry: 8, class: 'tshadow' }, g);
    const body = svgEl('g', { class: 'tbody' }, g);
    svgEl('rect', { x: -48, y: -96, width: 96, height: 136, rx: 16, class: 'ring' }, body);
    // 光束
    const beam = svgEl('g', { class: 'beam' }, body);
    svgEl('path', { d: 'M-6 -66 L-62 -84 L-62 -50 Z', fill: 'rgba(255,236,150,.55)' }, beam);
    svgEl('path', { d: 'M6 -66 L62 -84 L62 -50 Z', fill: 'rgba(255,236,150,.55)' }, beam);
    // 岩石底座
    svgEl('path', { d: 'M-36 32 Q-34 18 -20 20 Q-12 12 0 18 Q14 10 22 20 Q36 18 36 32 Z', fill: '#cfc6b8', ...S }, body);
    // 塔身條紋
    const yB = 24, yT = -46, hwB = 18, hwT = 11, bands = 5;
    const hw = (y) => hwT + ((y - yT) / (yB - yT)) * (hwB - hwT);
    for (let i = 0; i < bands; i++) {
      const y1 = yT + ((yB - yT) * i) / bands, y2 = yT + ((yB - yT) * (i + 1)) / bands;
      svgEl('path', { d: `M${-hw(y1)} ${y1} L${hw(y1)} ${y1} L${hw(y2)} ${y2} L${-hw(y2)} ${y2} Z`, fill: i % 2 ? '#fff8ec' : '#ef7f72' }, body);
    }
    svgEl('path', { d: `M${-hwT} ${yT} L${hwT} ${yT} L${hwB} ${yB} L${-hwB} ${yB} Z`, fill: 'none', ...S }, body);
    svgEl('path', { d: 'M-5 24 V15 a5 5 0 0 1 10 0 V24', fill: '#7a5a44', stroke: OUT, 'stroke-width': 1.4 }, body);
    svgEl('circle', { cx: 0, cy: -18, r: 3.6, fill: '#bfe0ec', stroke: OUT, 'stroke-width': 1.2 }, body);
    // 走道、燈室、圓頂
    svgEl('rect', { x: -17, y: -51, width: 34, height: 6, rx: 1.5, fill: '#5b4636' }, body);
    svgEl('rect', { x: -10, y: -73, width: 20, height: 22, rx: 2, fill: '#fff3b0', ...S, class: 'lamp' }, body);
    svgEl('path', { d: 'M-3 -73 V-51 M3 -73 V-51', stroke: OUT, 'stroke-width': 1 }, body);
    svgEl('path', { d: 'M-13 -73 Q0 -90 13 -73 Z', fill: '#ef7f72', ...S }, body);
    svgEl('path', { d: 'M0 -84 V-92', stroke: OUT, 'stroke-width': 1.8, 'stroke-linecap': 'round' }, body);
    return { plateY: 46 };
  }

  // 市政府：扁平描邊插圖，頭像在圓頂上
  function drawHall(g, it, c, defs) {
    svgEl('ellipse', { cx: 0, cy: 34, rx: 64, ry: 9, class: 'tshadow' }, g);
    const body = svgEl('g', { class: 'tbody' }, g);
    const gold = '#f4c95d', pink = '#f2b8c6', cream = '#fff8ec';
    const S = { stroke: OUT, 'stroke-width': 1.8, 'stroke-linejoin': 'round' };
    svgEl('rect', { x: -68, y: -100, width: 136, height: 146, rx: 16, class: 'ring' }, body);
    // 旗子 + 圓頂
    svgEl('path', { d: 'M0 -70 V-94', stroke: OUT, 'stroke-width': 1.8 }, body);
    svgEl('path', { d: 'M0 -94 l15 5 l-15 5 z', fill: '#ef8a7a', ...S }, body);
    svgEl('rect', { x: -18, y: -46, width: 36, height: 18, fill: cream, ...S }, body);
    svgEl('path', { d: 'M-24 -45 A24 24 0 0 1 24 -45 Z', fill: gold, ...S }, body);
    svgEl('rect', { x: -3.5, y: -74, width: 7, height: 6, rx: 1.5, fill: gold, ...S }, body);
    putPicture(body, it, c, defs, 0, -52, 12.5);
    // 兩翼
    svgEl('rect', { x: -60, y: -8, width: 120, height: 36, rx: 3, fill: cream, ...S }, body);
    svgEl('rect', { x: -62, y: -16, width: 124, height: 10, rx: 3, fill: pink, ...S }, body);
    [-52, -40, 34, 46].forEach((wx) => svgEl('path', { d: `M${wx} 16 V6 a3 3 0 0 1 6 0 V16 Z`, fill: '#bfe0ec', stroke: OUT, 'stroke-width': 1.3 }, body));
    // 柱廊 + 山牆
    [-20, -10, 0, 10, 20].forEach((cx) => svgEl('path', { d: `M${cx} -4 V26`, stroke: OUT, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, body));
    svgEl('path', { d: 'M-30 -6 L0 -30 L30 -6 Z', fill: pink, ...S }, body);
    svgEl('rect', { x: -42, y: 27, width: 84, height: 7, rx: 2, fill: '#efe3cc', ...S }, body);
    return { plateY: 54 };
  }

  /* ---------- 地圖小元件 ---------- */
  // 固定種子的亂數：每次打開長得一樣
  function seeded(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // 不規則的圓滑形狀
  function blobPath(cx, cy, r, rand, n = 10, amp = 0.2) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = r * (1 + (rand() - 0.5) * 2 * amp);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    const P_ = (i) => pts[(i + n) % n];
    let d = `M${P_(0)[0].toFixed(1)} ${P_(0)[1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const [p0, p1, p2, p3] = [P_(i - 1), P_(i), P_(i + 1), P_(i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }

  // 兩點之間的膠囊形（圓頭長條）
  function capsule(a, b, w) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, r = w / 2;
    const nx = (-dy / L) * r, ny = (dx / L) * r;
    const f = (v) => v.toFixed(1);
    return `M${f(a.x + nx)} ${f(a.y + ny)} L${f(b.x + nx)} ${f(b.y + ny)} A${r} ${r} 0 0 0 ${f(b.x - nx)} ${f(b.y - ny)} L${f(a.x - nx)} ${f(a.y - ny)} A${r} ${r} 0 0 0 ${f(a.x + nx)} ${f(a.y + ny)}Z`;
  }

  // Voronoi：用 a、b 的中垂線切多邊形，留下靠近 a 的那半；新切出來的邊記住鄰居 b
  function clipHalf(poly, a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    const f = (p) => (p.x - mx) * dx + (p.y - my) * dy;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], nxt = poly[(i + 1) % poly.length];
      const fc = f(cur), fn = f(nxt), ci = fc <= 0, ni = fn <= 0;
      if (ci) out.push(cur);
      if (ci !== ni) {
        const t = fc / (fc - fn);
        const I = { x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t };
        out.push(ci ? { ...I, e: b.id } : { ...I, e: cur.e });
      }
    }
    return out;
  }

  // 拼圖縫的鋸齒：同一條邊不論從哪一片畫，抖動都一樣，才會密合
  function edgePts(p, q, noisy) {
    if (!noisy) return [q];
    const k1 = `${p.x.toFixed(0)},${p.y.toFixed(0)}`, k2 = `${q.x.toFixed(0)},${q.y.toFixed(0)}`;
    const fwd = k1 < k2, A = fwd ? p : q, B = fwd ? q : p;
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    if (L < 10) return [q];
    const nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L, amp = Math.min(8, L * 0.08), N = 5;
    const key = fwd ? `${k1}|${k2}` : `${k2}|${k1}`;
    const pts = [];
    for (let i = 1; i < N; i++) {
      const t = i / N, off = jit(`${key}|${i}`) * 2 * amp;
      pts.push({ x: A.x + (B.x - A.x) * t + nx * off, y: A.y + (B.y - A.y) * t + ny * off });
    }
    if (!fwd) pts.reverse();
    pts.push(q);
    return pts;
  }

  // 扁平小樹（棒棒糖樹）
  function flatTree(x, y, r, rand, parent = layers.deco, muted = false) {
    const g = svgEl('g', { class: 'tree' }, parent);
    const line = muted ? '#9aa58f' : OUT;
    svgEl('path', { d: `M${x} ${y + r * 0.6} V${y + r * 1.7}`, stroke: line, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    svgEl('circle', { cx: x, cy: y, r, fill: muted ? '#cbd8bd' : rand() < 0.5 ? '#8cc084' : '#a6d189', stroke: line, 'stroke-width': 1.4 }, g);
    if (!muted) svgEl('path', { d: `M${x - r * 0.45} ${y - r * 0.15} a${r * 0.45} ${r * 0.45} 0 0 1 ${r * 0.45} -${r * 0.45}`, stroke: 'rgba(255,255,255,.6)', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, g);
  }

  // 扁平小房子
  function flatHouse(x, y, roof, rand) {
    const g = svgEl('g', { class: 'house', transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, layers.deco);
    const w = 7 + rand() * 3;
    svgEl('rect', { x: -w, y: -2, width: w * 2, height: 10, rx: 1, fill: '#fff8ec', stroke: OUT, 'stroke-width': 1.3 }, g);
    svgEl('path', { d: `M${-w - 2} -1 L0 ${-w - 2} L${w + 2} -1 Z`, fill: roof, stroke: OUT, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
    svgEl('rect', { x: -1.8, y: 3, width: 3.6, height: 5, fill: shade(roof, -0.3) }, g);
  }

  /* =========================================================
   *  城市動物：貓、狗、水豚、鴿子、斑鳩、鸚鵡
   *  （純裝飾；點牠們會叫一聲）
   * ========================================================= */
  const animals = [];
  const ANIMAL_SIZE = 1.45; // 動物整體大小
  const flocks = [];
  const R = (a, b) => a + Math.random() * (b - a);
  const SOUNDS = {
    cat: ['喵～', '喵嗚', '呼嚕呼嚕'], dog: ['汪！', '汪汪！', '要散步嗎？'], capy: ['咕嚕～', '（泡湯中）', '好舒服～'],
    pigeon: ['咕咕', '咕咕咕'], dove: ['咕咕—咕', '咕—咕咕'], parrot: ['你好！', '哈囉！', '按讚追蹤！'],
  };

  function sprite(kind, color, extra = {}) {
    const g = svgEl('g', { class: `animal a-${kind}`, 'data-kind': kind });
    const sp = svgEl('g', {}, g);       // 左右翻面
    const bob = svgEl('g', {}, sp);     // 走路上下晃
    const parts = { g, sp, bob };
    // 透明的點擊範圍，小動物比較好點
    svgEl('circle', { cx: 0, cy: -7, r: 13, fill: 'transparent' }, g);
    const dark = shade(color, -0.25);
    if (kind === 'cat') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 8, ry: 1.8, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('path', { d: 'M-7 -6 q-7 -1 -6 -10', stroke: color, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, bob);
      [-5, -2, 3, 6].forEach((lx) => svgEl('rect', { x: lx - 0.9, y: -4, width: 1.8, height: 4, rx: 0.9, fill: dark }, bob));
      svgEl('ellipse', { cx: 0, cy: -6, rx: 8, ry: 4.4, fill: color }, bob);
      svgEl('circle', { cx: 8, cy: -10.5, r: 4.4, fill: color }, bob);
      svgEl('path', { d: 'M4.8 -13 l1.2 -4.2 l2.8 2.8 z M9.2 -14.4 l2.4 -3.4 l1.2 4.2 z', fill: color }, bob);
      svgEl('circle', { cx: 10, cy: -11, r: 0.75, fill: '#333' }, bob);
      if (extra.patch) svgEl('ellipse', { cx: -2, cy: -7.5, rx: 3.2, ry: 2.2, fill: extra.patch }, bob);
    } else if (kind === 'dog') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 9, ry: 2, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('circle', { cx: -9, cy: -11, r: 2.8, fill: 'none', stroke: color, 'stroke-width': 2.2 }, bob);
      [-6, -3, 3, 6].forEach((lx) => svgEl('rect', { x: lx - 1, y: -5, width: 2, height: 5, rx: 1, fill: dark }, bob));
      svgEl('ellipse', { cx: 0, cy: -7.5, rx: 9, ry: 5, fill: color }, bob);
      svgEl('ellipse', { cx: 1, cy: -5.5, rx: 6, ry: 2.4, fill: 'rgba(255,250,240,.75)' }, bob);
      svgEl('circle', { cx: 9, cy: -12, r: 5, fill: color }, bob);
      svgEl('ellipse', { cx: 13.2, cy: -10.6, rx: 2.8, ry: 2, fill: shade(color, 0.35) }, bob);
      svgEl('circle', { cx: 15.6, cy: -11, r: 0.9, fill: '#333' }, bob);
      svgEl('path', { d: 'M6 -15.5 l1 -4.5 l3.2 3.4 z', fill: dark }, bob);
      svgEl('circle', { cx: 10.4, cy: -13, r: 0.8, fill: '#333' }, bob);
    } else if (kind === 'capy') {
      svgEl('rect', { x: -12, y: -14, width: 21, height: 12, rx: 6, fill: color }, bob);
      svgEl('rect', { x: 4, y: -17.5, width: 11, height: 9.5, rx: 4, fill: color }, bob);
      svgEl('rect', { x: 11, y: -13.5, width: 4.6, height: 5, rx: 2, fill: dark }, bob);
      svgEl('circle', { cx: 6.8, cy: -17.4, r: 1.6, fill: dark }, bob);
      svgEl('circle', { cx: 10.5, cy: -14.8, r: 0.8, fill: '#333' }, bob);
      if (extra.yuzu) { // 頭上頂一顆柚子
        svgEl('circle', { cx: 8.5, cy: -20.5, r: 2.8, fill: '#f4b942' }, bob);
        svgEl('path', { d: 'M8.5 -23.3 q1.6 -1.8 3.2 -0.8 q-1.6 1.4 -3.2 0.8', fill: '#7fb069' }, bob);
      }
      if (extra.bath) svgEl('ellipse', { cx: 0, cy: -3, rx: 15, ry: 4, fill: '#9fd0dc', stroke: 'rgba(255,255,255,.8)', 'stroke-width': 1.2 }, bob);
      else svgEl('ellipse', { cx: -1, cy: -1, rx: 11, ry: 1.8, fill: 'rgba(0,0,0,.12)' }, g);
    } else if (kind === 'pigeon' || kind === 'dove') {
      const body = kind === 'pigeon' ? '#a3a9b4' : '#d4bfab';
      const head = kind === 'pigeon' ? '#868e9c' : '#c7ada2';
      const wingC = kind === 'pigeon' ? '#8a909c' : '#b89c86';
      svgEl('ellipse', { cx: 0, cy: 0, rx: 5, ry: 1.2, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('path', { d: 'M0 -1 v1 M1.6 -1 v1', stroke: '#d9746a', 'stroke-width': 0.9 }, bob);
      svgEl('path', { d: 'M-4.5 -4.6 l-4.4 -0.6 l1.4 2.6 z', fill: wingC }, bob);
      svgEl('ellipse', { cx: -0.5, cy: -4, rx: 5, ry: 3.3, fill: body }, bob);
      const wing = svgEl('g', {}, bob);
      svgEl('ellipse', { cx: -1.2, cy: -4.6, rx: 3.6, ry: 2, fill: wingC }, wing);
      if (kind === 'dove') [[-2.4, -4.8], [-0.4, -4.2]].forEach(([dx, dy]) => svgEl('circle', { cx: dx, cy: dy, r: 0.6, fill: '#6b5a50' }, wing));
      const hd = svgEl('g', {}, bob);
      svgEl('circle', { cx: 4.4, cy: -7.2, r: 2.4, fill: head }, hd);
      if (kind === 'pigeon') svgEl('path', { d: 'M2.6 -5.6 q1.8 1.2 3.4 -0.2', stroke: '#7fbfa4', 'stroke-width': 1.2, fill: 'none' }, hd);
      else [[3.2, -5.6], [4.2, -5.3], [5.2, -5.6]].forEach(([dx, dy], k) => svgEl('circle', { cx: dx, cy: dy, r: 0.45, fill: k % 2 ? '#fff' : '#3d3a40' }, hd));
      svgEl('path', { d: 'M6.6 -7.6 l1.9 0.5 l-1.9 0.6 z', fill: '#e1a072' }, hd);
      svgEl('circle', { cx: 5.1, cy: -7.7, r: 0.5, fill: '#2d2a30' }, hd);
      parts.headG = hd; parts.wingG = wing;
    } else if (kind === 'parrot') {
      svgEl('path', { d: 'M-5 -1 L-17 1.5 L-16 -1.5 z', fill: extra.tail }, bob);
      svgEl('ellipse', { cx: 0, cy: -1, rx: 6.5, ry: 3.4, fill: color }, bob);
      svgEl('ellipse', { cx: 0.5, cy: 0.4, rx: 4.5, ry: 1.8, fill: extra.belly }, bob);
      svgEl('circle', { cx: 6, cy: -2.6, r: 3.1, fill: extra.head }, bob);
      svgEl('path', { d: 'M8.6 -3.6 q2.6 0.6 1.4 3 q-1 -0.6 -1.8 -1.2 z', fill: '#3d3a40' }, bob);
      svgEl('circle', { cx: 6.6, cy: -3.4, r: 0.75, fill: '#fff' }, bob);
      svgEl('circle', { cx: 6.8, cy: -3.4, r: 0.4, fill: '#222' }, bob);
      const wing = svgEl('g', {}, bob);
      svgEl('path', { d: 'M2 -2 q-3 -10 -10 -11 q2 6 4 11 z', fill: shade(color, -0.15) }, wing);
      svgEl('path', { d: 'M-1 -4 q-4 -6 -7 -6.5', stroke: extra.tail, 'stroke-width': 1.4, fill: 'none' }, wing);
      parts.wingG = wing;
    }
    return parts;
  }

  const inSpot = (s, m = 12) => ({ x: s.x + R(-0.5, 0.5) * (s.s - m * 2), y: s.y + R(-0.5, 0.5) * (s.s - m * 2) });
  const allSpots = () => [...spots.park, ...spots.plaza];

  function addAnimal(kind, color, spot, opts = {}) {
    if (!spot) return null;
    const parts = sprite(kind, color, opts);
    const p = opts.at || inSpot(spot);
    const a = { kind, ...parts, x: p.x, y: p.y, tx: p.x, ty: p.y, spot, face: Math.random() < 0.5 ? 1 : -1, idle: R(0, 3), ph: R(0, 10), mode: 'ground', scale: opts.scale || 1, ...opts };
    (kind === 'parrot' ? layers.sky : layers.critters).appendChild(a.g);
    animals.push(a);
    return a;
  }

  function buildAnimals() {
    const parks = spots.park.length ? spots.park : spots.plaza;
    const plazas = spots.plaza.length ? spots.plaza : spots.park;
    if (!parks.length) return;
    const pick = (arr, i) => arr[i % arr.length];

    // 貓狗：在公園散步
    [['cat', '#f2a65a'], ['cat', '#4a4650'], ['cat', '#c9c3cc'], ['cat', '#f7f1e8', { patch: '#e0a060' }],
      ['dog', '#e0a060'], ['dog', '#8b6b4a'], ['dog', '#f3eee6']].forEach(([k, c, o], i) => {
      addAnimal(k, c, pick(parks, i * 3 + 1), { speed: k === 'cat' ? 16 : 26, ...(o || {}) });
    });

    // 水豚：泡在噴水池，另一隻在公園躺著
    if (spots.lake) { // 水豚：泡在湖裡
      const L = spots.lake;
      [[-14, 4], [16, -6], [2, 18]].forEach(([dx, dy], i) => addAnimal('capy', '#a57c55', L, { at: { x: L.x + dx, y: L.y + dy }, bath: true, yuzu: i === 0, still: true, scale: 0.85 }));
    } else {
      plazas.slice(0, 2).forEach((s, i) => addAnimal('capy', '#a57c55', s, { at: { x: s.x - 2, y: s.y + 6 }, bath: true, yuzu: i === 0, still: true, scale: 0.8 }));
    }
    addAnimal('capy', '#9c7550', pick(parks, 5), { still: true });

    // 鴿子群：在廣場啄食，偶爾一起飛走
    [0, 1].forEach((f) => {
      const home = pick(plazas, f * 4 + 2);
      const flock = { spot: home, timer: R(10, 22), birds: [] };
      for (let i = 0; i < 4; i++) flock.birds.push(addAnimal('pigeon', '#a3a9b4', home, { speed: 14, scale: 1.1 }));
      flocks.push(flock);
    });
    // 斑鳩：在公園草地上
    const doveFlock = { spot: pick(parks, 7), timer: R(16, 30), birds: [] };
    for (let i = 0; i < 3; i++) doveFlock.birds.push(addAnimal('dove', '#d4bfab', doveFlock.spot, { speed: 12, scale: 1.1 }));
    flocks.push(doveFlock);

    // 鸚鵡：在城市上空飛
    [{ color: '#4cb050', head: '#e8453c', belly: '#c9e36b', tail: '#3b7dd8' },
      { color: '#3b8fd8', head: '#3b8fd8', belly: '#f4c95d', tail: '#2c6fb8' }].forEach((o, i) => {
      const s = pick(allSpots(), i * 5);
      const a = addAnimal('parrot', o.color, s, { ...o, scale: 1.3, speed: 70 });
      a.mode = 'sky'; a.alt = 0; newSkyTarget(a);
    });
  }

  function newSkyTarget(a) {
    a.tx = R(bounds.x0, bounds.x1); a.ty = R(bounds.y0, bounds.y1);
  }

  function flyFlock(flock) {
    const opts = allSpots().filter((s) => s !== flock.spot && (flock.birds[0].kind === 'pigeon' ? spots.plaza.includes(s) || !spots.plaza.length : true));
    if (!opts.length) return;
    flock.spot = opts[Math.floor(Math.random() * opts.length)];
    flock.timer = R(14, 28);
    flock.birds.forEach((b) => {
      const p = inSpot(flock.spot);
      b.fx = b.x; b.fy = b.y; b.tx = p.x; b.ty = p.y; b.ft = -R(0, 0.25); b.mode = 'fly';
      b.fdur = Math.max(1.2, Math.hypot(p.x - b.x, p.y - b.y) / 130);
      layers.sky.appendChild(b.g);
    });
  }

  function updateAnimals(dt) {
    flocks.forEach((f) => { f.timer -= dt; if (f.timer <= 0) flyFlock(f); });
    animals.forEach((a) => {
      a.ph += dt;
      let lift = 0, flap = 1, bobY = 0, headRot = 0;
      if (a.mode === 'sky') { // 鸚鵡：一直飛
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
        if (d < 10) newSkyTarget(a);
        else { a.x += (dx / d) * a.speed * dt; a.y += (dy / d) * a.speed * dt; a.face = dx >= 0 ? 1 : -1; }
        lift = -40 + Math.sin(a.ph * 1.6) * 5;
        flap = Math.sin(a.ph * 16);
      } else if (a.mode === 'fly') { // 鴿子 / 斑鳩：飛到別處
        a.ft += dt / a.fdur;
        const t = clamp(a.ft, 0, 1), e = t * t * (3 - 2 * t);
        a.x = a.fx + (a.tx - a.fx) * e; a.y = a.fy + (a.ty - a.fy) * e;
        a.face = a.tx >= a.fx ? 1 : -1;
        lift = -Math.sin(Math.PI * t) * 55;
        flap = a.ft > 0 ? Math.sin(a.ph * 22) : 1;
        if (a.ft >= 1) { a.mode = 'ground'; a.idle = R(0.5, 2); layers.critters.appendChild(a.g); }
      } else if (!a.still) { // 地上走
        if (a.idle > 0) {
          a.idle -= dt;
          if (a.headG) headRot = Math.max(0, Math.sin(a.ph * 7)) * 35; // 啄食
        } else {
          const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
          if (d < 1.5) {
            const isBird = !!a.headG;
            a.idle = isBird ? R(0.6, 2.5) : a.kind === 'cat' ? R(2, 8) : R(1, 4);
            let s = a.spot;
            if (a.kind === 'dog' && Math.random() < 0.3) { // 狗狗偶爾過馬路去隔壁公園
              const near = allSpots().filter((o) => o !== s && Math.hypot(o.x - s.x, o.y - s.y) < T * 2.3);
              if (near.length) s = a.spot = near[Math.floor(Math.random() * near.length)];
            }
            const p = isBird ? { x: clamp(a.x + R(-14, 14), s.x - s.s / 2 + 8, s.x + s.s / 2 - 8), y: clamp(a.y + R(-10, 10), s.y - s.s / 2 + 8, s.y + s.s / 2 - 8) } : inSpot(s);
            a.tx = p.x; a.ty = p.y;
          } else {
            const step = Math.min(d, a.speed * dt);
            a.x += (dx / d) * step; a.y += (dy / d) * step;
            if (Math.abs(dx) > 0.5) a.face = dx > 0 ? 1 : -1;
            bobY = -Math.abs(Math.sin(a.ph * (a.headG ? 18 : 11))) * (a.headG ? 1.5 : 1.2);
          }
        }
      } else { // 水豚：發呆、偶爾轉頭
        bobY = Math.sin(a.ph * 1.2) * 0.6;
        if (Math.random() < dt * 0.08) a.face *= -1;
      }
      a.g.setAttribute('transform', `translate(${a.x.toFixed(1)},${(a.y + lift).toFixed(1)}) scale(${(a.scale * ANIMAL_SIZE).toFixed(2)})`);
      a.sp.setAttribute('transform', `scale(${a.face},1)`);
      a.bob.setAttribute('transform', `translate(0,${bobY.toFixed(2)})`);
      if (a.headG) a.headG.setAttribute('transform', headRot ? `rotate(${headRot.toFixed(1)} 3 -5)` : '');
      if (a.wingG) a.wingG.setAttribute('transform', `translate(0,-4) scale(1,${flap.toFixed(2)}) translate(0,4)`);
    });
  }

  // 點動物：冒出對話泡泡；點鴿子會整群飛走
  function pokeAnimal(el) {
    const a = animals.find((x) => x.g === el);
    if (!a) return;
    const list = SOUNDS[a.kind] || ['！'];
    const text = list[Math.floor(Math.random() * list.length)];
    const lift = a.mode === 'sky' ? -40 : 0;
    const g = svgEl('g', { class: 'bubble', transform: `translate(${a.x},${a.y + lift - 26 * a.scale * ANIMAL_SIZE})` }, layers.sky);
    const bg = svgEl('rect', { rx: 8, fill: '#fff', stroke: 'var(--ink)', 'stroke-width': 1.5 }, g);
    const t = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'bubble-text' }, g);
    t.textContent = text;
    const bb = t.getBBox();
    bg.setAttribute('x', bb.x - 7); bg.setAttribute('y', bb.y - 4);
    bg.setAttribute('width', bb.width + 14); bg.setAttribute('height', bb.height + 8);
    setTimeout(() => g.remove(), 1600);
    if (a.kind === 'cat' || a.kind === 'dog') { a.idle = 0; a.tx = a.x; a.ty = a.y; } // 被點到會換個地方走
    const flock = flocks.find((f) => f.birds.includes(a));
    if (flock && a.mode === 'ground') flyFlock(flock);
  }

  // 頭像：item.image 優先；市中心沒填就用 site.avatar
  function imageOf(it) {
    return it.image || (it.cat === 'hub' ? D.site.avatar : '') || '';
  }

  // 可以點開嗎？地區設 clickable: false，或該格設 clickable: false，就不能點
  function canOpen(it) {
    return !!it && it.clickable !== false && catById[it.cat].clickable !== false;
  }

  function addIcon(body, it, c, cy = -3, size = 28) {
    const ic = svgEl('text', { x: 0, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'ticon', 'font-size': size.toFixed(1) }, body);
    ic.textContent = it.icon || c.icon;
  }

  const movers = [];
  const cars = [];
  const roads = [];
  const spots = { park: [], plaza: [], lake: null }; // 動物的活動範圍
  let bounds = { x0: 0, x1: 0, y0: 0, y1: 0 };

  /* ---------- 選取 / 篩選 的視覺狀態 ---------- */
  function refreshMap() {
    const sel = state.selected;
    const near = sel ? new Set([sel, ...neighbors(sel)].map(mapIdOf)) : null;
    $$('.tile', svg).forEach((g) => {
      const id = g.dataset.id;
      const off = !state.active.has(g.dataset.cat);
      g.classList.toggle('dim', off || (near && !near.has(id)));
      g.classList.toggle('sel', id === sel);
      const plate = $(`.plate[data-id="${id}"]`, svg);
      if (plate) plate.classList.toggle('dim', g.classList.contains('dim'));
    });
    $$('.district', svg).forEach((g) => g.classList.toggle('dim', !state.active.has(g.dataset.cat)));
    $$('.piece[data-cat]', svg).forEach((g) => g.classList.toggle('dim', !state.active.has(g.dataset.cat)));
    movers.forEach(({ path, mover, a, b }) => {
      const catOn = state.active.has(mapById[a].cat) && state.active.has(mapById[b].cat);
      const related = sel && (a === sel || b === sel);
      const show = catOn && (related || (state.lines && !sel));
      path.classList.toggle('hidden', !show);
      path.classList.toggle('hot', !!related);
      mover.classList.toggle('hidden', !show || !state.movers);
    });
    svg.classList.toggle('no-labels', !state.labels);
  }

  /* =========================================================
   *  平移 / 縮放（只改 viewBox，不碰網址）
   * ========================================================= */
  let vb = { x: -500, y: -400, w: 1000, h: 800 };
  const applyVB = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const rect = () => svg.getBoundingClientRect();
  const toWorld = (cx, cy) => { const r = rect(); return { x: vb.x + ((cx - r.left) / r.width) * vb.w, y: vb.y + ((cy - r.top) / r.height) * vb.h }; };
  const MINW = 280, MAXW = 6000;

  function zoomAt(cx, cy, f) {
    const p = toWorld(cx, cy);
    const w2 = clamp(vb.w * f, MINW, MAXW), k = w2 / vb.w;
    vb = { x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w: w2, h: vb.h * k };
    applyVB();
  }

  let anim = null;
  function animateTo(target, dur = 650) {
    cancelAnimationFrame(anim);
    const from = { ...vb }, t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / dur, 0, 1), e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
      vb = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      applyVB();
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function viewFor(cx, cy, w) {
    const r = rect(), a = r.height / r.width;
    return { x: cx - w / 2, y: cy - (w * a) / 2, w, h: w * a };
  }

  function fit(animate = true) {
    const r = rect(), a = r.height / r.width;
    const bw = bounds.x1 - bounds.x0 + T * 0.4, bh = bounds.y1 - bounds.y0 + T * 1.1;
    // 桌機版左上有索引卡，往右多留一點
    const pad = isMobile() ? 0 : 0.18;
    const w = clamp(Math.max(bw * (1 + pad), bh / a), MINW, MAXW);
    const cx = (bounds.x0 + bounds.x1) / 2 - (w * pad) / 2.6, cy = (bounds.y0 + bounds.y1) / 2 + T * 0.15;
    const target = viewFor(cx, cy, w);
    animate ? animateTo(target) : ((vb = target), applyVB());
  }

  // 手機直式畫面：整座城市塞進去建築會太小，改成以市中心為中心、格子夠大能直接點
  function home(animate = true) {
    if (!isMobile()) return fit(animate);
    // 手機：以市政府為中心放大到字看得清楚、建築點得到；其他地方用手指拖曳
    const hub = items.find((i) => i.cat === 'hub');
    const h = hub ? P(hub.id) : { x: 0, y: 0 };
    const w = clamp(Math.min(620, (bounds.x1 - bounds.x0) + T), MINW, MAXW);
    const target = viewFor(h.x, h.y, w);
    target.y = h.y - target.h * 0.45; // 市政府稍微偏上，上面的郵局、燈塔也看得到
    animate ? animateTo(target) : ((vb = target), applyVB());
  }

  function focusOn(id) {
    const { x, y } = P(id);
    const r = rect();
    const w = clamp(Math.min(vb.w, isMobile() ? 520 : 1150), MINW, MAXW);
    let cx = x, cy = y;
    const k = w / r.width; // 螢幕 px → 世界座標
    if (isMobile()) {
      // 面板在下方：把格子放到「頂部列以下、面板以上」那塊可見區域的中間
      const panelH = Math.min($('#panel').offsetHeight || r.height * 0.72, r.height - 120);
      const top = 56, visibleMid = top + (r.height - panelH - top) / 2;
      cy = y + (r.height / 2 - visibleMid) * k;
    } else {
      cx = x + ($('#panel').offsetWidth / 2) * k;
    }
    animateTo(viewFor(cx, cy, w));
  }

  function bindPanZoom() {
    const pts = new Map();
    let dragged = false, startPt = null, pinchD = 0;

    svg.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { dragged = false; startPt = { x: e.clientX, y: e.clientY }; }
      if (pts.size === 2) { const [p1, p2] = [...pts.values()]; pinchD = Math.hypot(p1.x - p2.x, p1.y - p2.y); }
      cancelAnimationFrame(anim);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      const cur = { x: e.clientX, y: e.clientY };
      if (!dragged && Math.hypot(cur.x - startPt.x, cur.y - startPt.y) > 5) {
        dragged = true;
        svg.setPointerCapture(e.pointerId);
        svg.classList.add('dragging');
      }
      if (!dragged) { pts.set(e.pointerId, cur); return; }
      const r = rect();
      if (pts.size === 1) {
        vb.x -= ((cur.x - prev.x) / r.width) * vb.w;
        vb.y -= ((cur.y - prev.y) / r.height) * vb.h;
        applyVB();
      }
      pts.set(e.pointerId, cur);
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinchD) zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, pinchD / d);
        pinchD = d;
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchD = 0;
      if (!pts.size) svg.classList.remove('dragging');
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); cancelAnimationFrame(anim); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015)); }, { passive: false });

    svg.addEventListener('click', (e) => {
      if (dragged) return;
      const critter = e.target.closest('.animal');
      if (critter) { pokeAnimal(critter); return; }
      const tile = e.target.closest('.tile, .plate');
      if (tile && canOpen(itemById[tile.dataset.id])) openItem(tile.dataset.id);
      else if (state.selected) closePanel();
    });
    svg.addEventListener('keydown', (e) => {
      const tile = e.target.closest && e.target.closest('.tile');
      if (tile && canOpen(itemById[tile.dataset.id]) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(tile.dataset.id); }
    });

    let lastSize = rect();
    window.addEventListener('resize', () => {
      const r = rect();
      if (!r.width || !r.height) return;
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      const w = vb.w * (r.width / (lastSize.width || r.width));
      vb = viewFor(cx, cy, clamp(w, MINW, MAXW));
      applyVB();
      lastSize = r;
    });
  }

  /* =========================================================
   *  動畫：搬運小點、車子、動物
   * ========================================================= */
  let lastT = performance.now();
  function tick(now) {
    const dt = clamp((now - lastT) / 1000, 0, 0.05);
    lastT = now;
    if (!state.paused && state.view === 'map') {
      if (state.movers) movers.forEach((m) => {
        if (m.mover.classList.contains('hidden') || !m.len) return;
        m.t = (m.t + dt * m.speed * (300 / Math.max(120, m.len)) ) % 1;
        const p = m.path.getPointAtLength(m.t * m.len);
        m.mover.setAttribute('cx', p.x); m.mover.setAttribute('cy', p.y);
      });
      if (state.animals) updateAnimals(dt);
      cars.forEach((c) => {
        c.d += c.v * dt * c.dir;
        if (c.d > c.rd.len) c.d -= c.rd.len; else if (c.d < 0) c.d += c.rd.len;
        const p = c.rd.el.getPointAtLength(c.d), q = c.rd.el.getPointAtLength(clamp(c.d + c.dir * 2, 0, c.rd.len));
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        const lane = c.rd.main ? 6 : 4.5; // 靠右行駛
        const x = p.x - Math.sin(ang) * lane, y = p.y + Math.cos(ang) * lane;
        c.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(ang * 180 / Math.PI).toFixed(1)})`);
      });
    }
    requestAnimationFrame(tick);
  }

  /* =========================================================
   *  詳細面板
   * ========================================================= */
  const panel = $('#panel');
  function openItem(id, { focus = true } = {}) {
    const it = itemById[id];
    if (!canOpen(it)) return;
    const c = catById[it.cat];
    state.selected = id;
    const rel = neighbors(id).map((n) => itemById[n]);
    const links = (it.links || []).filter((l) => l.url);
    const isExternal = (u) => /^https?:/i.test(u);

    $('#panel-inner').innerHTML = `
      <div class="p-head" style="--c:${c.color}">
        <span class="p-cat">${esc(c.icon)} ${esc(c.name)}・${esc(c.label)}</span>
        <button class="p-close" aria-label="關閉">✕</button>
      </div>
      <div class="p-hero" style="--c:${c.color};--cd:${shade(c.color, -0.28)}">
        ${imageOf(it) ? `<img class="p-avatar${it.cat === 'hub' ? ' me' : ''}" src="${esc(imageOf(it))}" alt="${esc(it.title)}">` : `<div class="p-icon">${esc(it.icon || c.icon)}</div>`}
      </div>
      <h2 class="p-title">${esc(it.title)}</h2>
      ${it.subtitle ? `<p class="p-sub">${esc(it.subtitle)}</p>` : ''}
      ${it.summary ? `<p class="p-sum">${esc(it.summary)}</p>` : ''}
      ${it.stats?.length ? `<div class="p-stats">${it.stats.map((s) => `<div class="p-stat" style="--c:${c.color}"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : ''}
      ${it.stats?.length && it.asOf ? `<p class="p-asof">數據更新於 ${esc(it.asOf)}</p>` : ''}
      ${it.fields?.length ? `<dl class="p-fields">${it.fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      ${it.body?.length ? `<div class="p-body">${it.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
      ${it.tags?.length ? `<div class="p-tags">${it.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
      ${links.length ? `<div class="p-links">${links.map((l) => `<a href="${esc(l.url)}" ${isExternal(l.url) ? 'target="_blank" rel="noopener"' : ''} style="--c:${c.color}">${esc(l.label)} ↗</a>`).join('')}</div>` : ''}
      ${rel.length ? `<div class="p-rel-title">🔗 協作關係 <small>${rel.length}</small></div>
        <div class="p-rel">${rel.map((r) => { const rc = catById[r.cat]; const tag = canOpen(r) ? 'button' : 'div'; return `<${tag} ${canOpen(r) ? `data-go="${esc(r.id)}"` : 'class="static"'} style="--c:${rc.color}"><i>${imageOf(r) ? `<img src="${esc(imageOf(r))}" alt="">` : esc(r.icon || rc.icon)}</i><span>${esc(r.short || r.title)}</span><small>${esc(rc.label)}</small></${tag}>`; }).join('')}</div>` : ''}
    `;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    panel.scrollTop = 0;
    $('#panel-inner').scrollTop = 0;
    $('.p-close', panel).addEventListener('click', closePanel);
    $$('[data-go]', panel).forEach((b) => b.addEventListener('click', () => openItem(b.dataset.go)));
    refreshMap();
    refreshList();
    if (focus && state.view === 'map') focusOn(id);
    pushLog(`正在參觀「${it.short || it.title}」`, null, true);
  }

  // 手機抽屜：拖把手或標題列，往上拉滿、往下滑收起 / 關閉
  function bindSheet() {
    let y0 = 0, dy = 0, active = false, h0 = 0;
    const start = (e) => {
      if (!isMobile() || !panel.classList.contains('open')) return;
      if (e.target.closest('button')) return; // 讓關閉鈕正常點擊
      active = true; y0 = e.clientY; dy = 0; h0 = panel.offsetHeight;
      panel.classList.add('dragging');
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!active) return;
      dy = e.clientY - y0;
      if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
      else panel.style.height = `${Math.min(h0 - dy, window.innerHeight - 40)}px`;
    };
    const end = () => {
      if (!active) return;
      active = false;
      panel.classList.remove('dragging');
      panel.style.transform = ''; panel.style.height = '';
      const full = panel.classList.contains('full');
      if (dy > 90) { full ? panel.classList.remove('full') : closePanel(); }
      else if (dy < -50) panel.classList.add('full');
    };
    // 標題列是動態產生的，所以掛在 panel 上再判斷來源
    panel.addEventListener('pointerdown', (e) => { if (e.target.closest('.p-grab, .p-head')) start(e); });
    panel.addEventListener('pointermove', move);
    panel.addEventListener('pointerup', end);
    panel.addEventListener('pointercancel', end);
  }

  function closePanel() {
    state.selected = null;
    panel.classList.remove('open', 'full');
    panel.setAttribute('aria-hidden', 'true');
    refreshMap();
    refreshList();
  }

  /* =========================================================
   *  清單檢視
   * ========================================================= */
  function buildList() {
    const list = $('#list');
    list.innerHTML = `<div class="list-inner">${cats.map((c) => {
      const members = items.filter((i) => i.cat === c.id);
      if (!members.length) return '';
      return `<section class="list-group" data-cat="${esc(c.id)}" style="--c:${c.color}">
        <h3><span>${esc(c.icon)}</span>${esc(c.name)}<small>${esc(c.label)}・${members.length}</small></h3>
        <div class="list-cards">${members.map((m) => `
          <${canOpen(m) ? 'button' : 'div'} class="list-card${canOpen(m) ? '' : ' static'}" data-id="${esc(m.id)}">
            <i>${imageOf(m) ? `<img src="${esc(imageOf(m))}" alt="">` : esc(m.icon || c.icon)}</i>
            <div><b>${esc(m.title)}</b><span>${esc(m.subtitle || m.summary || '')}</span></div>
          </${canOpen(m) ? 'button' : 'div'}>`).join('')}</div>
      </section>`;
    }).join('')}</div>`;
    $$('button.list-card', list).forEach((b) => b.addEventListener('click', () => openItem(b.dataset.id)));
  }
  function refreshList() {
    $$('.list-group').forEach((g) => { g.hidden = !state.active.has(g.dataset.cat); });
    $$('.list-card').forEach((b) => b.classList.toggle('sel', b.dataset.id === state.selected));
  }

  function setView(v) {
    state.view = v;
    $$('.views button').forEach((b) => { const on = b.dataset.view === v; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('#list').hidden = v !== 'list';
    $('#mapwrap').hidden = v !== 'map';
    document.body.dataset.view = v;
  }

  /* =========================================================
   *  索引卡：計數 + 篩選
   * ========================================================= */
  function buildIndex() {
    const s = D.site;
    $('#brand-name').textContent = s.brand;
    $('#brand-sub').textContent = `_${s.islandName}`;
    $('#ic-title').textContent = `${s.owner}的${s.islandName}`;
    $('#ic-tagline').textContent = s.tagline;
    const av = $('#ic-avatar');
    if (s.avatar) { av.src = s.avatar; av.onerror = () => av.remove(); } else av.remove();

    const nonHub = cats.filter((c) => c.id !== 'hub');
    $('#ic-stats').innerHTML = [
      [nonHub.length, '個地區'],
      [items.length, '棟建築'],
      [relPairs.length, '條協作線'],
    ].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');

    const box = $('#ic-filters');
    box.innerHTML = `<button class="chip all on" data-all>全部</button>` +
      cats.map((c) => `<button class="chip on" data-cat="${esc(c.id)}" style="--c:${c.color}">${esc(c.icon)} ${esc(c.label)}</button>`).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-all')) {
        state.active = new Set(cats.map((c) => c.id));
      } else {
        const id = b.dataset.cat;
        const allOn = state.active.size === cats.length;
        if (allOn) state.active = new Set([id]);           // 全開時點一個 → 只看這個
        else if (state.active.has(id)) state.active.delete(id);
        else state.active.add(id);
        if (!state.active.size) state.active = new Set(cats.map((c) => c.id));
      }
      $$('.chip[data-cat]', box).forEach((c) => c.classList.toggle('on', state.active.has(c.dataset.cat)));
      $('.chip.all', box).classList.toggle('on', state.active.size === cats.length);
      refreshMap(); refreshList();
    });

    $('#ic-toggle').addEventListener('click', () => {
      const card = $('#index-card');
      card.classList.toggle('collapsed');
      $('#ic-toggle').textContent = card.classList.contains('collapsed') ? '+' : '–';
    });
    if (isMobile()) { $('#index-card').classList.add('collapsed'); $('#ic-toggle').textContent = '+'; }
  }

  /* =========================================================
   *  工具列
   * ========================================================= */
  function bindToolbar() {
    $('#toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.action === 'fit') { if (state.view !== 'map') setView('map'); fit(); return; }
      const k = b.dataset.toggle;
      state[k] = !state[k];
      b.setAttribute('aria-pressed', state[k]);
      if (k === 'paused') { b.firstChild.textContent = state.paused ? '▶️' : '⏸️'; b.querySelector('span').textContent = state.paused ? '播放' : '暫停'; document.body.classList.toggle('paused', state.paused); }
      if (k === 'log') $('#log').classList.toggle('hide', !state.log);
      if (k === 'animals') svg.classList.toggle('no-animals', !state.animals);
      refreshMap();
    });
  }

  /* =========================================================
   *  城市日誌
   * ========================================================= */
  let clock = 8 * 60, logIdx = 0;
  const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  function pushLog(text, id, me = false) {
    const ul = $('#log-list');
    const li = document.createElement('li');
    li.innerHTML = `<time>${fmt(clock)}</time><span>${esc(text)}</span>`;
    if (me) li.classList.add('me');
    if (id && canOpen(itemById[id])) { li.classList.add('link'); li.addEventListener('click', () => { if (state.view !== 'map') setView('map'); openItem(id); }); }
    ul.prepend(li);
    while (ul.children.length > 4) ul.lastChild.remove();
  }
  function startLog() {
    $('#log-status').textContent = `•ᴗ• 晴天 · ${D.site.hint}`;
    const logs = D.log || [];
    if (!logs.length) return;
    const step = () => {
      if (!state.paused) {
        clock += 15;
        const l = logs[logIdx++ % logs.length];
        pushLog(l.text, l.id);
      }
    };
    step(); step();
    setInterval(step, 4200);
  }

  // 手機：第一次看地圖時提示可以拖曳（每次開網頁最多一次，碰到地圖就消失）
  let hinted = false;
  function dragHint() {
    if (hinted || !isMobile() || state.view !== 'map') return;
    hinted = true;
    const tip = document.createElement('div');
    tip.className = 'drag-hint';
    tip.innerHTML = '<span class="hand">👆</span> 拖曳地圖探索整座城市<br><small>雙指可以縮放・點建築看介紹</small>';
    document.body.appendChild(tip);
    const bye = () => { tip.classList.add('out'); setTimeout(() => tip.remove(), 400); svg.removeEventListener('pointerdown', bye); };
    svg.addEventListener('pointerdown', bye);
    setTimeout(bye, 4500);
  }

  /* =========================================================
   *  開場導覽
   * ========================================================= */
  function bindIntro(force = false) {
    const slides = D.intro || [];
    const box = $('#intro');
    const KEY = 'content-island-intro-seen';
    if (!slides.length) return;
    if (!force) { try { if (localStorage.getItem(KEY)) { dragHint(); return; } } catch (_) { /* 無痕模式 */ } }
    let i = 0;
    const show = () => {
      const s = slides[i];
      $('#intro-kicker').textContent = s.kicker || '';
      $('#intro-title').textContent = s.title || '';
      $('#intro-text').textContent = s.text || '';
      $('#intro-dots').innerHTML = slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      $('#intro-next').textContent = i === slides.length - 1 ? '開始探索 →' : '下一步 →';
    };
    const close = () => { box.hidden = true; try { localStorage.setItem(KEY, '1'); } catch (_) {} dragHint(); };
    $('#intro-next').onclick = () => { if (++i >= slides.length) close(); else show(); };
    $('#intro-skip').onclick = close;
    show();
    box.hidden = false;
  }

  /* =========================================================
   *  啟動
   * ========================================================= */
  function init() {
    buildIndex();
    buildMap();
    buildAnimals();
    buildList();
    bindPanZoom();
    bindToolbar();
    bindSheet();
    $$('.views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#help-btn').addEventListener('click', () => bindIntro(true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!$('#intro').hidden) $('#intro-skip').click(); else closePanel(); }
    });
    setView('map');
    refreshMap();
    home(false);
    startLog();
    requestAnimationFrame(tick);
    setTimeout(() => {
      $('#loader').classList.add('done');
      bindIntro();
    }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
