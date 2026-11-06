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
      </pattern>`;

    svgEl('rect', { x: -20000, y: -20000, width: 40000, height: 40000, fill: 'var(--sea)' }, svg);
    svgEl('rect', { x: -20000, y: -20000, width: 40000, height: 40000, fill: 'url(#sea)', class: 'waves' }, svg);

    ['island', 'outer', 'clouds', 'region', 'pieces', 'roads', 'deco', 'traffic', 'landmarks', 'critters', 'lines', 'movers', 'tiles', 'plates', 'sky', 'districts'].forEach((n) => {
      layers[n] = svgEl('g', { class: `layer-${n}` }, svg);
    });

    // 名牌、地區名稱放在夜色上面的另一層 svg，晚上也一樣清楚
    if (labelsSvg) { labelsSvg.innerHTML = ''; labelsSvg.appendChild(layers.plates); labelsSvg.appendChild(layers.districts); }

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
      for (let r = Math.min(...rows) - 1; r <= Math.max(...rows) + 1; r++) for (let c = Math.min(...cols) - 1; c <= Math.max(...cols) + 1; c++) {
        if (used.has(`${c},${r}`)) continue;
        const p = { x: c * T + R(-14, 14), y: r * T + R(-12, 12) };
        const clear = Math.min(...mapItems.map((i) => Math.hypot(p.x - pos[i.id].x, p.y - pos[i.id].y) - (i.group ? 50 : 0)));
        if (clear > T * 0.9) cands.push({ ...p, clear });
      }
      cands.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
      const taken = [];
      const take = (far = false) => {
        const order = far ? [...cands].reverse() : cands;
        const p = order.find((q) => !taken.some((t) => Math.hypot(q.x - t.x, q.y - t.y) < T * (t.big || far ? 1.25 : 0.95)));
        if (!p) return null;
        cands.splice(cands.indexOf(p), 1); taken.push(p); if (far) p.big = true;
        return p;
      };
      // 湖、公園、廣場 + 城市地標（裝飾用，不能點）
      const SIZE = { lake: 0.5, airport: 0.64, stadium: 0.5, ferris: 0.46, mall: 0.46, museum: 0.46, market: 0.46, park: 0.42, plaza: 0.42 };
      ['lake', 'park', 'market', 'plaza', 'museum', 'park', 'mall', 'ferris', 'plaza', 'stadium', 'park'].forEach((k, i) => {
        const p = take(k === 'airport');
        if (p) extra.push({ id: `__${k}${i}`, kind: k, x: p.x, y: p.y, r: T * SIZE[k] });
      });
    }

    // 地標也算進畫面範圍（一打開、按鳥瞰時都看得到）
    extra.forEach((e) => {
      bounds.x0 = Math.min(bounds.x0, e.x - e.r - 20); bounds.x1 = Math.max(bounds.x1, e.x + e.r + 20);
      bounds.y0 = Math.min(bounds.y0, e.y - e.r - 20); bounds.y1 = Math.max(bounds.y1, e.y + e.r + 30);
    });

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
    // ---- 海上機場：從島的右下方海岸伸出去的填海平台（放大 2 倍）----
    {
      const k = Math.round((0.55 / (Math.PI * 2)) * N) % N; // 右下方
      const coast = islandPts[k];
      const ux = (coast.x - cx0) / Math.hypot(coast.x - cx0, coast.y - cy0), uy = (coast.y - cy0) / Math.hypot(coast.x - cx0, coast.y - cy0);
      const PW = 300, PH = 128; // 平台大小
      const ax = coast.x + ux * 235, ay = coast.y + uy * 150; // 平台中心在海上
      // 橋（從島上接到平台）
      const bx0 = coast.x - ux * 30, by0 = coast.y - uy * 30, bx1 = ax - ux * 90, by1 = ay - uy * 50;
      const bridge = svgEl('g', { class: 'airport-bridge' }, layers.island);
      for (let t = 0.2; t < 0.95; t += 0.18) svgEl('rect', { x: bx0 + (bx1 - bx0) * t - 3, y: by0 + (by1 - by0) * t + 4, width: 6, height: 16, rx: 2, fill: '#b9b2a6', stroke: OUT, 'stroke-width': 1.2 }, bridge);
      svgEl('path', { d: `M${bx0} ${by0} L${bx1} ${by1}`, stroke: OUT, 'stroke-width': 24, 'stroke-linecap': 'round' }, bridge);
      svgEl('path', { d: `M${bx0} ${by0} L${bx1} ${by1}`, stroke: '#c4bfc6', 'stroke-width': 20, 'stroke-linecap': 'round' }, bridge);
      svgEl('path', { d: `M${bx0} ${by0} L${bx1} ${by1}`, stroke: '#fff', 'stroke-width': 1.6, 'stroke-dasharray': '6 7' }, bridge);
      // 平台：陰影 → 側邊 → 表面
      const plat = svgEl('g', { class: 'airport-island' }, layers.island);
      svgEl('rect', { x: ax - PW / 2 + 8, y: ay - PH / 2 + 18, width: PW, height: PH, rx: 36, fill: '#2d4a52', opacity: 0.14 }, plat);
      svgEl('rect', { x: ax - PW / 2 - 14, y: ay - PH / 2 - 14, width: PW + 28, height: PH + 28, rx: 48, fill: 'rgba(255,255,255,.45)' }, plat);
      svgEl('rect', { x: ax - PW / 2, y: ay - PH / 2 + 10, width: PW, height: PH, rx: 34, fill: '#b9b2a6' }, plat);
      svgEl('rect', { x: ax - PW / 2, y: ay - PH / 2, width: PW, height: PH, rx: 34, fill: '#e9e5dc', stroke: '#a8a093', 'stroke-width': 3 }, plat);
      drawLandmark({ kind: 'airport', x: ax + 6, y: ay - 6, scale: 2 });
      bounds.x1 = Math.max(bounds.x1, ax + PW / 2 + 20); bounds.y1 = Math.max(bounds.y1, ay + PH / 2 + 20);
    }

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
      spots.wild = [...seeds].sort((a, b) => Math.hypot(a.x - cx0, a.y - cy0) - Math.hypot(b.x - cx0, b.y - cy0)).slice(0, 6).map((q) => ({ x: q.x, y: q.y, s: T * 0.7, r: T * 0.5 }));
      const far = [...seeds].sort((a, b) => Math.hypot(b.x - cx0, b.y - cy0) - Math.hypot(a.x - cx0, a.y - cy0));
      // 雲：飄在還沒開放的地方
      for (let k = 0; k < 7; k++) {
        const s = far[(k * 3) % far.length];
        if (s) cloud(layers.clouds, s.x + R(-30, 30), s.y + R(-40, 10), R(0.9, 1.5), k);
      }
    }

    // ---- 我的城市：發光 → 陰影 → 木頭厚度 → 外框 ----
    [[70, 0.12], [46, 0.18], [24, 0.28]].forEach(([w, o]) => svgEl('path', { d: regionD, fill: 'none', stroke: '#fff3b0', 'stroke-width': w, 'stroke-linejoin': 'round', opacity: o, class: 'region-glow' }, layers.region));
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
      const color = kind ? (EXTRA_COLOR[kind] || '#f4e7cf') : gid === 'hub' ? '#fbe7a6' : pastel(catById[gid].color);
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

    // ---- 馬路：把建築串起來（最小生成樹 + 幾條捷徑 + 市政府主幹道），不穿過湖 ----
    {
      const ids = mapItems.map((i) => i.id);
      const exById = Object.fromEntries(extra.map((e) => [e.id, e]));
      const pt = (id) => pos[id] || exById[id];
      const dist = (a, b) => Math.hypot(pt(a).x - pt(b).x, pt(a).y - pt(b).y);
      const lake = extra.find((e) => e.kind === 'lake');
      const edges = new Map();
      const add = (a, b, main = false) => {
        const k = [a, b].sort().join('|');
        if (a === b) return;
        if (!edges.has(k)) edges.set(k, { a, b, main }); else if (main) edges.get(k).main = true;
      };
      const inT = new Set([ids[0]]);
      while (inT.size < ids.length) {
        let best = null;
        inT.forEach((a) => ids.forEach((b) => { if (!inT.has(b) && (!best || dist(a, b) < best.d)) best = { a, b, d: dist(a, b) }; }));
        add(best.a, best.b); inT.add(best.b);
      }
      ids.forEach((a) => {
        const nb = ids.filter((b) => b !== a).sort((p, q) => dist(a, p) - dist(a, q));
        if (nb[1] && dist(a, nb[1]) < T * 1.7 && rand() < 0.6) add(a, nb[1]);
      });
      const hub = mapItems.find((i) => i.cat === 'hub');
      if (hub) cats.forEach((c) => {
        const m = mapItems.filter((i) => i.cat === c.id && i.id !== hub.id).sort((p, q) => dist(hub.id, p.id) - dist(hub.id, q.id))[0];
        if (m) add(hub.id, m.id, true);
      });
      const roadG = svgEl('g', { 'clip-path': 'url(#clip-region)' }, layers.roads);
      const layersR = ['road-out', 'road', 'road-dash'].map((cls) => svgEl('g', { class: `${cls}-g` }, roadG));
      edges.forEach((e) => {
        const a = pt(e.a), b = pt(e.b);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const bend = R(-0.18, 0.18) * len;
        const cx = (a.x + b.x) / 2 - ((b.y - a.y) / len) * bend, cy = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bend;
        // 不要穿過湖
        if (lake) for (let t = 0.1; t < 0.95; t += 0.05) {
          const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
          if (Math.hypot(x - lake.x, y - lake.y) < lake.r + 14) return;
        }
        const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
        svgEl('path', { d, class: `road-out${e.main ? ' main' : ''}` }, layersR[0]);
        const el = svgEl('path', { d, class: `road${e.main ? ' main' : ''}` }, layersR[1]);
        svgEl('path', { d, class: 'road-dash' }, layersR[2]);
        roads.push({ el, len: el.getTotalLength(), main: e.main });
      });
    }
    const roadPts = [];
    roads.forEach((rd) => { for (let t = 0; t <= rd.len; t += 10) { const p = rd.el.getPointAtLength(t); roadPts.push({ x: p.x, y: p.y }); } });

    // 空地上的小東西
    extra.forEach((e) => {
      if (e.kind === 'lake') {
        svgEl('path', { d: `M${e.x - 26} ${e.y - 12} q9 -5 18 0 M${e.x + 4} ${e.y + 16} q9 -5 18 0`, stroke: '#fff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, layers.deco);
        spots.lake = { x: e.x, y: e.y, s: e.r, r: e.r };
      } else if (e.kind === 'park') {
        for (let k = 0; k < 3; k++) { const a = rand() * 6.28, d = R(18, e.r * 0.6); flatTree(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, R(7, 10), rand); }
        spots.park.push({ x: e.x, y: e.y, s: e.r * 1.1, r: e.r });
      } else if (LANDMARK[e.kind]) {
        drawLandmark(e);
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
        if (mapItems.some((o) => Math.hypot(q.x - pos[o.id].x, q.y - pos[o.id].y) < (o.group ? 110 : o.cat === 'hub' ? 80 : 52)) || near(q, decos, 22) || near(q, roadPts, 20)) continue;
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

    // ---- 車子、行人 ----
    if (roads.length) {
      const carColors = ['#ef8a7a', '#6fb3d2', '#f4c95d', '#8cc084', '#a99be0', '#f2a65a', '#ffffff'];
      const nCars = Math.min(12, roads.length);
      for (let i = 0; i < nCars; i++) {
        const rd = roads[(i * 3) % roads.length];
        const col = carColors[i % carColors.length];
        const g = svgEl('g', { class: 'car' }, layers.traffic);
        const bus = i % 5 === 4;
        const L = bus ? 26 : 19, W = bus ? 11.5 : 10.5;
        svgEl('rect', { x: -L / 2 + 1.5, y: -W / 2 + 2.5, width: L, height: W, rx: 3.5, fill: 'rgba(0,0,0,.18)' }, g);
        svgEl('rect', { x: -L / 2, y: -W / 2, width: L, height: W, rx: 3.5, fill: col, stroke: OUT, 'stroke-width': 1.4 }, g);
        if (bus) [-8, -2, 4].forEach((x) => svgEl('rect', { x, y: -W / 2 + 2, width: 4, height: W - 4, rx: 1, fill: '#d6eef4', stroke: OUT, 'stroke-width': 0.8 }, g));
        else {
          svgEl('rect', { x: -3, y: -W / 2 + 1.6, width: 9, height: W - 3.2, rx: 2.4, fill: shade(col, 0.45), stroke: OUT, 'stroke-width': 1 }, g);
          svgEl('rect', { x: 3.2, y: -W / 2 + 2.2, width: 2.6, height: W - 4.4, rx: 1, fill: '#d6eef4' }, g);
        }
        svgEl('circle', { cx: L / 2 - 1.2, cy: -W / 2 + 2, r: 1.2, fill: '#fff6c4' }, g);
        svgEl('circle', { cx: L / 2 - 1.2, cy: W / 2 - 2, r: 1.2, fill: '#fff6c4' }, g);
        cars.push({ g, rd, dir: i % 2 ? 1 : -1, d: rand() * rd.len, v: bus ? 22 : 28 + rand() * 22 });
      }
      const shirts = ['#ef8a7a', '#6fb3d2', '#f4c95d', '#8cc084', '#a99be0', '#f2a65a', '#e6a5c0', '#7fc3b0'];
      const skins = ['#f6d3b3', '#eec09a', '#d9a47c', '#f8dcc4'];
      const hairs = ['#4a3a2e', '#2d2a30', '#8a5a3a', '#c9a06a', '#5b4636'];
      const nPeople = Math.min(16, roads.length * 2);
      for (let i = 0; i < nPeople; i++) {
        const rd = roads[(i * 7 + 1) % roads.length];
        const g = svgEl('g', { class: 'walker' }, layers.traffic);
        const sp = svgEl('g', {}, g);
        const shirt = shirts[i % shirts.length], skin = skins[i % skins.length], hair = hairs[(i * 3) % hairs.length];
        svgEl('ellipse', { cx: 0, cy: 0, rx: 4.5, ry: 1.3, fill: 'rgba(0,0,0,.16)' }, sp);
        const legs = svgEl('path', { d: 'M-1.4 -5 L-2 0 M1.4 -5 L2 0', stroke: OUT, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, sp);
        svgEl('rect', { x: -3.6, y: -12, width: 7.2, height: 8, rx: 2.8, fill: shirt, stroke: OUT, 'stroke-width': 1.1 }, sp);
        svgEl('circle', { cx: 0, cy: -15.5, r: 3.6, fill: skin, stroke: OUT, 'stroke-width': 1.1 }, sp);
        svgEl('path', { d: i % 3 ? 'M-3.6 -15.8 a3.6 3.6 0 0 1 7.2 0 Z' : 'M-3.8 -15 a3.8 4 0 0 1 7.6 0 v3 h-1.6 v-2 h-4.4 v2 h-1.6 Z', fill: hair }, sp);
        if (i % 4 === 1) svgEl('path', { d: 'M3 -14 l4 -1 v6', stroke: OUT, 'stroke-width': 1, fill: 'none' }, sp);
        walkers.push({ g, sp, legs, rd, side: i % 2 ? 1 : -1, dir: rand() < 0.5 ? 1 : -1, d: R(0.15, 0.85) * rd.len, v: R(9, 15), ph: rand() * 10, pause: 0 });
      }
    }

    movers.forEach((m) => { m.len = m.path.getTotalLength(); });
    buildLights(pos, extra);
  }

  /* ---------- 夜晚的燈光：窗戶、路燈、燈塔、地標（畫在另一層，不會被夜色蓋暗） ---------- */
  function buildLights(pos, extra) {
    if (!lightsSvg) return;
    lightsSvg.innerHTML = `<defs>
      <radialGradient id="lg-warm"><stop offset="0" stop-color="#ffd98a" stop-opacity=".5"/><stop offset=".5" stop-color="#ffc56b" stop-opacity=".22"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
      <radialGradient id="lg-lamp"><stop offset="0" stop-color="#fff1c2" stop-opacity=".85"/><stop offset=".25" stop-color="#ffd27a" stop-opacity=".35"/><stop offset="1" stop-color="#ffc56b" stop-opacity="0"/></radialGradient>
      <radialGradient id="lg-cool"><stop offset="0" stop-color="#d9f3ff" stop-opacity=".55"/><stop offset="1" stop-color="#9fd8ff" stop-opacity="0"/></radialGradient>
      <linearGradient id="lg-beam-r" x1="0" x2="1"><stop offset="0" stop-color="#fff2b8" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></linearGradient>
      <linearGradient id="lg-beam-l" x1="1" x2="0"><stop offset="0" stop-color="#fff2b8" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></linearGradient>
    </defs>`;
    const glow = (x, y, r, kind = 'warm', cls = '') => svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r, fill: `url(#lg-${kind})`, class: `glow ${cls}` }, lightsSvg);
    // 建築
    mapItems.forEach((it) => {
      const p = pos[it.id];
      const style = buildingStyle(it);
      if (style === 'lighthouse') return;
      const r = style === 'hall' ? 125 : style === 'civic' ? 125 : style === 'chip' ? 62 : 80;
      glow(p.x, p.y + (style === 'chip' ? 30 : 40), r, 'warm', 'flicker');
    });
    // 燈塔：亮燈 + 兩道會掃動的光束
    const lh = mapItems.find((it) => buildingStyle(it) === 'lighthouse');
    if (lh) {
      const { x, y } = pos[lh.id], ly = y - 62;
      const g = svgEl('g', { class: 'lh-beams', transform: `translate(${x},${ly})` }, lightsSvg);
      svgEl('path', { d: 'M4 0 L190 -40 L190 40 Z', fill: 'url(#lg-beam-r)' }, g);
      svgEl('path', { d: 'M-4 0 L-190 -40 L-190 40 Z', fill: 'url(#lg-beam-l)' }, g);
      glow(x, ly, 46, 'warm');
    }
    // 路燈：沿著馬路每隔一段一盞
    roads.forEach((rd) => {
      for (let d = 50; d < rd.len - 40; d += 95) {
        const p = rd.el.getPointAtLength(d);
        glow(p.x, p.y, 22, 'lamp', 'streetlamp');
      }
    });
    // 地標、噴水池
    extra.forEach((e) => {
      if (LANDMARK[e.kind]) glow(e.x, e.y + 24, 78, 'warm', 'flicker');
      else if (e.kind === 'plaza') glow(e.x, e.y, 34, 'cool');
      else if (e.kind === 'lake') glow(e.x, e.y, 60, 'cool');
    });
    // 機場
    const ap = $('.lm-airport', svg);
    if (ap) {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(ap.getAttribute('transform'));
      if (m) {
        const ax = +m[1], ay = +m[2];
        glow(ax - 50, ay - 20, 70, 'warm');
        glow(ax + 36, ay - 90, 30, 'cool');
        for (let k = -6; k <= 6; k++) glow(ax + k * 20, ay + 18, 9, 'lamp', 'runway');
      }
    }
    // 每一棟建築的外框、名牌、地區名稱：晚上也要亮起來，才看得清楚
    const parseTf = (el) => {
      const tf = el.getAttribute('transform') || '';
      const t = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(tf), sc = /scale\(([-\d.]+)/.exec(tf);
      return { x: t ? +t[1] : 0, y: t ? +t[2] : 0, s: sc ? +sc[1] : 1 };
    };
    // 夜色：整片蓋上去（不挖洞，建築一樣在夜色裡，只是自己的燈亮著）
    if (tintSvg) {
      tintSvg.innerHTML = '';
      svgEl('rect', { x: -20000, y: -20000, width: 40000, height: 40000, class: 'tint-fill' }, tintSvg);
    }

    // 開燈：把每棟建築的線條複製到燈光層，輪廓線變成暖黃色的燈、窗戶亮起來
    const neon = svgEl('g', { class: 'neon-lights' }, lightsSvg);
    const isWindow = (el) => el.classList.contains('win') || /^#(bfe0ec|cfe6f2|9fc6da|d6eef4)$/i.test(el.getAttribute('fill') || '');
    $$('.tile', svg).forEach((tile) => {
      const body = $('.tbody', tile);
      if (!body) return;
      const g = svgEl('g', { transform: tile.getAttribute('transform') || '' }, neon);
      const halo = body.cloneNode(true), line = body.cloneNode(true);
      [halo, line].forEach((copy, k) => {
        copy.removeAttribute('class');
        copy.querySelectorAll('.ring, image, text, clipPath').forEach((n) => n.remove());
        copy.querySelectorAll('*').forEach((el) => {
          el.removeAttribute('clip-path');
          if (el.tagName === 'g') return;
          if (isWindow(el)) {
            el.setAttribute('fill', '#ffd979'); el.setAttribute('fill-opacity', k ? '.95' : '.35');
            el.setAttribute('stroke', k ? 'none' : '#ffcf6b'); el.setAttribute('stroke-width', k ? 0 : 6);
            return;
          }
          const sw = parseFloat(el.getAttribute('stroke-width')) || 1.6;
          el.setAttribute('fill', 'none');
          el.setAttribute('stroke', k ? '#ffd98a' : '#ffc860');
          el.setAttribute('stroke-width', k ? Math.max(1.2, sw).toFixed(2) : (sw + 4).toFixed(1));
          el.setAttribute('stroke-linejoin', 'round');
          el.setAttribute('stroke-linecap', 'round');
        });
        copy.setAttribute('class', k ? 'neon-line' : 'neon-halo');
        g.appendChild(copy);
      });
    });

    // 拼圖上的小房子
    $$('.house', svg).forEach((h) => {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(h.getAttribute('transform') || '');
      if (m) glow(+m[1], +m[2] + 4, 20, 'lamp', 'flicker');
    });
  }

  /* ---------- 城市地標（裝飾用、不能點） ---------- */
  const EXTRA_COLOR = { lake: '#a9d8e3', park: '#bfe0a2', plaza: '#f4e7cf', mall: '#e9e0f3', museum: '#ece6dc', airport: '#dde7ec', market: '#fde6cc', ferris: '#fbe2ea', stadium: '#d9ecd0' };
  const LANDMARK = { mall: '商場', museum: '博物館', airport: '機場', market: '市場', ferris: '遊樂園', stadium: '體育場' };

  function drawLandmark(e) {
    const g = svgEl('g', { class: `landmark lm-${e.kind}`, transform: `translate(${e.x.toFixed(1)},${e.y.toFixed(1)}) scale(${e.scale || 1})` }, layers.landmarks);
    const S = { stroke: OUT, 'stroke-width': 1.7, 'stroke-linejoin': 'round' };
    const s1 = { stroke: OUT, 'stroke-width': 1.2 };
    if (e.kind === 'mall') {
      svgEl('ellipse', { cx: 2, cy: 30, rx: 50, ry: 7, class: 'tshadow' }, g);
      svgEl('rect', { x: -46, y: -8, width: 92, height: 36, rx: 3, fill: '#fff8ec', ...S }, g);
      svgEl('rect', { x: -40, y: 2, width: 80, height: 18, rx: 2, fill: '#cfe6f2', ...s1 }, g);
      [-26, -12, 12, 26].forEach((x) => svgEl('path', { d: `M${x} 2 V20`, ...s1 }, g));
      svgEl('rect', { x: -7, y: 8, width: 14, height: 20, rx: 1.5, fill: '#9fc6da', ...s1 }, g);
      const aw = ['#ef8a7a', '#fff', '#f4c95d', '#fff', '#6fb3d2', '#fff', '#8cc084', '#fff'];
      aw.forEach((c, i) => svgEl('rect', { x: -46 + i * 11.5, y: -16, width: 11.5, height: 9, fill: c }, g));
      svgEl('rect', { x: -46, y: -16, width: 92, height: 9, fill: 'none', ...S }, g);
      svgEl('rect', { x: -24, y: -36, width: 48, height: 18, rx: 4, fill: '#a99be0', ...S }, g);
      svgEl('path', { d: 'M-5 -31 h10 l1.5 10 h-13 Z', fill: '#fff', ...s1 }, g);
      svgEl('path', { d: 'M-2.5 -31 v-2 a2.5 2.5 0 0 1 5 0 v2', fill: 'none', ...s1 }, g);
    } else if (e.kind === 'museum') {
      svgEl('ellipse', { cx: 2, cy: 32, rx: 46, ry: 7, class: 'tshadow' }, g);
      svgEl('rect', { x: -44, y: 26, width: 88, height: 6, rx: 1.5, fill: '#e3d9c8', ...S }, g);
      svgEl('rect', { x: -40, y: 20, width: 80, height: 7, rx: 1.5, fill: '#eee6d8', ...S }, g);
      svgEl('rect', { x: -36, y: -8, width: 72, height: 29, fill: '#f7f2ea', ...S }, g);
      [-28, -17, -6, 6, 17, 28].forEach((x) => svgEl('path', { d: `M${x} -5 V19`, stroke: OUT, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, g));
      svgEl('path', { d: 'M-42 -7 L0 -34 L42 -7 Z', fill: '#ddd4c8', ...S }, g);
      svgEl('circle', { cx: 0, cy: -17, r: 5, fill: '#f4c95d', ...s1 }, g);
      svgEl('path', { d: 'M24 -6 h9 v20 l-4.5 -4 l-4.5 4 Z', fill: '#a99be0', ...s1 }, g);
    } else if (e.kind === 'airport') {
      svgEl('rect', { x: -66, y: 8, width: 132, height: 20, rx: 4, fill: '#8d8a94', ...S }, g);
      svgEl('path', { d: 'M-58 18 H58', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '8 7' }, g);
      [-62, 56].forEach((x) => [11, 15, 19, 23].forEach((y) => svgEl('rect', { x, y, width: 6, height: 1.6, fill: '#fff' }, g)));
      svgEl('rect', { x: -52, y: -24, width: 46, height: 24, rx: 3, fill: '#fff8ec', ...S }, g);
      svgEl('rect', { x: -48, y: -17, width: 38, height: 8, rx: 1.5, fill: '#cfe6f2', ...s1 }, g);
      svgEl('path', { d: 'M-52 -24 Q-29 -36 -6 -24', fill: '#6fb3d2', ...S }, g);
      svgEl('rect', { x: 14, y: -38, width: 9, height: 38, fill: '#fff8ec', ...S }, g);
      svgEl('rect', { x: 9, y: -50, width: 19, height: 12, rx: 2, fill: '#cfe6f2', ...S }, g);
      svgEl('path', { d: 'M9 -50 h19 l-3 -5 h-13 Z', fill: '#ef8a7a', ...S }, g);
      const plane = svgEl('g', { class: 'plane' }, g);
      svgEl('path', { d: 'M-16 18 Q-16 15 -10 15 H12 Q18 15 18 18 Q18 21 12 21 H-10 Q-16 21 -16 18 Z', fill: '#fff', ...s1 }, plane);
      svgEl('path', { d: 'M-2 15 L-8 4 H-3 L6 15 Z M-2 21 L-8 32 H-3 L6 21 Z', fill: '#e6eef2', ...s1 }, plane);
      svgEl('path', { d: 'M-14 15 L-17 9 H-13 L-9 15 Z', fill: '#ef8a7a', ...s1 }, plane);
      svgEl('circle', { cx: 13, cy: 18, r: 1.6, fill: '#6fb3d2' }, plane);
    } else if (e.kind === 'market') {
      const aw = [['#ef8a7a', '#fff'], ['#8cc084', '#fff'], ['#f4c95d', '#fff']];
      const fruit = [['#ef5d50', '#f4a340', '#ef5d50'], ['#8cc084', '#f4c95d', '#8cc084'], ['#a65fbd', '#ef5d50', '#f4a340']];
      svgEl('ellipse', { cx: 2, cy: 28, rx: 50, ry: 7, class: 'tshadow' }, g);
      [-32, 0, 32].forEach((x, i) => {
        svgEl('rect', { x: x - 13, y: 4, width: 26, height: 20, rx: 2, fill: '#e8c9a0', ...S }, g);
        fruit[i].forEach((c, k) => svgEl('circle', { cx: x - 7 + k * 7, cy: 4, r: 3.2, fill: c, ...s1, 'stroke-width': 0.9 }, g));
        svgEl('path', { d: `M${x - 11} -14 V4 M${x + 11} -14 V4`, stroke: OUT, 'stroke-width': 1.4 }, g);
        for (let k = 0; k < 4; k++) svgEl('rect', { x: x - 15 + k * 7.5, y: -18, width: 7.5, height: 9, fill: aw[i][k % 2] }, g);
        svgEl('path', { d: `M${x - 15} -18 H${x + 15} V-9 q-3.75 4 -7.5 0 q-3.75 4 -7.5 0 q-3.75 4 -7.5 0 q-3.75 4 -7.5 0 Z`, fill: 'none', ...S }, g);
      });
    } else if (e.kind === 'ferris') {
      svgEl('ellipse', { cx: 2, cy: 30, rx: 34, ry: 6, class: 'tshadow' }, g);
      svgEl('path', { d: 'M0 -14 L-17 26 M0 -14 L17 26', stroke: OUT, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
      svgEl('rect', { x: -24, y: 24, width: 48, height: 6, rx: 2, fill: '#f4c95d', ...S }, g);
      const wheel = svgEl('g', { class: 'ferris-wheel' }, g);
      svgEl('circle', { cx: 0, cy: -14, r: 28, fill: 'rgba(255,255,255,.35)', stroke: OUT, 'stroke-width': 1.8 }, wheel);
      svgEl('circle', { cx: 0, cy: -14, r: 20, fill: 'none', stroke: '#c6a1d6', 'stroke-width': 1.2 }, wheel);
      const cab = ['#ef8a7a', '#6fb3d2', '#f4c95d', '#8cc084', '#a99be0', '#f2a65a', '#e6a5c0', '#7fc3b0'];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, x = Math.cos(a) * 28, y = -14 + Math.sin(a) * 28;
        svgEl('path', { d: `M0 -14 L${x.toFixed(1)} ${y.toFixed(1)}`, stroke: OUT, 'stroke-width': 1 }, wheel);
        svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 4.6, fill: cab[k], ...s1 }, wheel);
      }
      svgEl('circle', { cx: 0, cy: -14, r: 3.5, fill: '#fff', ...s1 }, g);
    } else if (e.kind === 'stadium') {
      svgEl('ellipse', { cx: 3, cy: 6, rx: 52, ry: 32, class: 'tshadow' }, g);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 50, ry: 30, fill: '#efe6d6', ...S }, g);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 50, ry: 30, fill: 'none', stroke: '#c9b8a0', 'stroke-width': 4, 'stroke-dasharray': '3 4' }, g);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 40, ry: 21, fill: '#e88f7f', ...s1 }, g);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 31, ry: 14, fill: '#8cc084', ...s1 }, g);
      svgEl('path', { d: 'M0 -14 V14', stroke: '#fff', 'stroke-width': 1.4 }, g);
      svgEl('circle', { cx: 0, cy: 0, r: 5, fill: 'none', stroke: '#fff', 'stroke-width': 1.4 }, g);
    }
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
    alpaca: ['咩～', '嗯嗯～', '（吐口水）'], pelican: ['嘎！', '（張大嘴）'], kiwi: ['奇異～', '啾啾！'],
    kakapo: ['咚…咚…', '（胖胖走路）'], emu: ['咕嚕嚕', '咚咚咚'], kangaroo: ['蹦！', '蹦蹦～'], elephant: ['叭噗～', '噗嚕嚕'],
  };

  function sprite(kind, color, extra = {}) {
    const g = svgEl('g', { class: `animal a-${kind}`, 'data-kind': kind });
    const sp = svgEl('g', {}, g);       // 左右翻面
    const bob = svgEl('g', {}, sp);     // 走路上下晃
    const parts = { g, sp, bob };
    // 透明的點擊範圍，小動物比較好點
    const hit = { elephant: [-16, 24], emu: [-16, 16], kangaroo: [-14, 16], alpaca: [-14, 15] }[kind] || [-7, 13];
    svgEl('circle', { cx: 0, cy: hit[0], r: hit[1], fill: 'transparent' }, g);
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
    } else if (kind === 'alpaca') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 9, ry: 1.8, fill: 'rgba(0,0,0,.12)' }, bob);
      [-6, -3, 3, 6].forEach((lx) => svgEl('rect', { x: lx - 1, y: -6, width: 2, height: 6, rx: 1, fill: dark }, bob));
      svgEl('ellipse', { cx: 0, cy: -9, rx: 9, ry: 5.5, fill: color }, bob);
      [-5, 0, 5].forEach((cx) => svgEl('circle', { cx, cy: -13, r: 3, fill: shade(color, 0.25) }, bob));
      svgEl('rect', { x: 5, y: -23, width: 5, height: 15, rx: 2.5, fill: color }, bob);
      svgEl('ellipse', { cx: 10, cy: -23.5, rx: 4.6, ry: 3.4, fill: color }, bob);
      svgEl('circle', { cx: 8.5, cy: -27, r: 2.6, fill: shade(color, 0.3) }, bob);
      svgEl('path', { d: 'M6.6 -26 l-0.6 -4 l2 2.4 Z M10 -26.5 l0.6 -4 l1.4 3 Z', fill: dark }, bob);
      svgEl('ellipse', { cx: 14, cy: -22.6, rx: 1.6, ry: 1.3, fill: shade(color, -0.15) }, bob);
      svgEl('circle', { cx: 11.4, cy: -24.4, r: 0.75, fill: '#333' }, bob);
    } else if (kind === 'pelican') {
      if (!extra.float) {
        svgEl('ellipse', { cx: 0, cy: 0, rx: 7, ry: 1.5, fill: 'rgba(0,0,0,.12)' }, bob);
        svgEl('path', { d: 'M-1 -3 v3 M2 -3 v3', stroke: '#f2a65a', 'stroke-width': 1.3 }, bob);
      }
      svgEl('path', { d: 'M-7 -7 l-4 -2 l1 4 Z', fill: '#c9cdd4' }, bob);
      svgEl('ellipse', { cx: 0, cy: -6.5, rx: 8, ry: 4.6, fill: '#f6f4ef' }, bob);
      svgEl('ellipse', { cx: -1.5, cy: -7, rx: 5, ry: 2.6, fill: '#c9cdd4' }, bob);
      svgEl('path', { d: 'M5 -9 q2 -6 1 -9', stroke: '#f6f4ef', 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round' }, bob);
      svgEl('circle', { cx: 6, cy: -18, r: 3, fill: '#f6f4ef' }, bob);
      svgEl('path', { d: 'M8 -19 L21 -16.5 L8 -16 Z', fill: '#f4b942' }, bob);
      svgEl('path', { d: 'M8.5 -16 Q14 -11 20 -16', fill: '#f2d38a' }, bob);
      svgEl('circle', { cx: 6.8, cy: -18.8, r: 0.7, fill: '#333' }, bob);
      if (extra.float) svgEl('ellipse', { cx: 0, cy: -3, rx: 11, ry: 3, fill: '#a9d8e3', stroke: 'rgba(255,255,255,.85)', 'stroke-width': 1.2 }, bob);
    } else if (kind === 'kiwi') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 6, ry: 1.4, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('path', { d: 'M-1.5 -2 v2 M1.5 -2 v2', stroke: '#c9a77a', 'stroke-width': 1.2 }, bob);
      svgEl('ellipse', { cx: 0, cy: -5, rx: 6.5, ry: 4.8, fill: color }, bob);
      [[-3, -6], [-1, -3.5], [1.5, -6.5], [-4, -3.8]].forEach(([dx, dy]) => svgEl('path', { d: `M${dx} ${dy} l1.4 -0.6`, stroke: shade(color, -0.25), 'stroke-width': 0.8 }, bob));
      svgEl('path', { d: 'M5 -6 L14 -2.5', stroke: '#e8d4a6', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, bob);
      svgEl('circle', { cx: 4, cy: -6.5, r: 0.6, fill: '#222' }, bob);
    } else if (kind === 'kakapo') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 7, ry: 1.6, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('path', { d: 'M-2 -2 v2 M2 -2 v2', stroke: '#a3a3a3', 'stroke-width': 1.4 }, bob);
      svgEl('path', { d: 'M-6 -4 l-5 2 l4 1.5 Z', fill: shade(color, -0.2) }, bob);
      svgEl('ellipse', { cx: 0, cy: -6.5, rx: 7.5, ry: 6, fill: color }, bob);
      [[-3, -8], [-1, -5], [1.5, -9], [-4.5, -5.5], [2, -4]].forEach(([dx, dy]) => svgEl('circle', { cx: dx, cy: dy, r: 0.7, fill: shade(color, -0.3) }, bob));
      svgEl('circle', { cx: 5.5, cy: -9.5, r: 3.6, fill: '#d9d98e' }, bob);
      svgEl('path', { d: 'M8.6 -9.5 q1.8 0.6 0.8 2.6 q-1 -0.6 -1.4 -1.2 Z', fill: '#bdb8b0' }, bob);
      svgEl('circle', { cx: 6.2, cy: -10.4, r: 0.7, fill: '#222' }, bob);
    } else if (kind === 'emu') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 8, ry: 1.8, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('path', { d: 'M-2 -11 L-3 0 M2 -11 L3 0', stroke: '#8a8070', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, bob);
      svgEl('ellipse', { cx: -1, cy: -15, rx: 9, ry: 6.5, fill: color }, bob);
      [-6, -2, 2].forEach((dx) => svgEl('path', { d: `M${dx} -10 q1 2 2 0`, stroke: shade(color, -0.25), 'stroke-width': 1, fill: 'none' }, bob));
      svgEl('path', { d: 'M5 -18 Q8 -26 8 -32', stroke: '#8fa3b3', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, bob);
      svgEl('circle', { cx: 8.5, cy: -33, r: 2.8, fill: '#8fa3b3' }, bob);
      svgEl('path', { d: 'M10.6 -33.6 l3 1 l-3 0.8 Z', fill: '#5b4636' }, bob);
      svgEl('circle', { cx: 9.4, cy: -33.8, r: 0.6, fill: '#222' }, bob);
    } else if (kind === 'kangaroo') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 9, ry: 1.8, fill: 'rgba(0,0,0,.12)' }, g);
      svgEl('path', { d: 'M-5 -5 Q-12 -3 -17 0', stroke: color, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, bob);
      svgEl('ellipse', { cx: -1, cy: -4, rx: 6, ry: 3.6, fill: dark }, bob);
      svgEl('path', { d: 'M1 -1 h6', stroke: dark, 'stroke-width': 2, 'stroke-linecap': 'round' }, bob);
      svgEl('ellipse', { cx: 0, cy: -12, rx: 5.5, ry: 8, fill: color, transform: 'rotate(18 0 -12)' }, bob);
      svgEl('ellipse', { cx: 1.5, cy: -10, rx: 3, ry: 4.5, fill: shade(color, 0.35), transform: 'rotate(18 1.5 -10)' }, bob);
      svgEl('path', { d: 'M3 -13 l4 2', stroke: dark, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, bob);
      svgEl('ellipse', { cx: 5, cy: -21, rx: 4, ry: 3, fill: color }, bob);
      svgEl('path', { d: 'M3 -23 l-1 -5 l2.4 3.6 Z M5.4 -23.4 l0.6 -5 l1.2 4 Z', fill: dark }, bob);
      svgEl('circle', { cx: 6.6, cy: -21.6, r: 0.7, fill: '#222' }, bob);
      svgEl('circle', { cx: 8.8, cy: -20.6, r: 0.8, fill: '#333' }, bob);
    } else if (kind === 'elephant') {
      svgEl('ellipse', { cx: 0, cy: 0, rx: 17, ry: 3, fill: 'rgba(0,0,0,.12)' }, bob);
      svgEl('path', { d: 'M-14 -16 q-4 4 -3 9', stroke: dark, 'stroke-width': 1.4, fill: 'none' }, bob);
      [-10, -4, 4, 10].forEach((lx) => svgEl('rect', { x: lx - 2.6, y: -9, width: 5.2, height: 9, rx: 2, fill: lx < 0 ? dark : color }, bob));
      svgEl('ellipse', { cx: 0, cy: -15, rx: 15, ry: 9.5, fill: color }, bob);
      svgEl('circle', { cx: 13, cy: -19, r: 7.5, fill: color }, bob);
      svgEl('path', { d: 'M18 -17 Q22 -10 20 -4 q-1 1.5 -2.6 0.2', stroke: color, 'stroke-width': 3.8, fill: 'none', 'stroke-linecap': 'round' }, bob);
      svgEl('path', { d: 'M17 -14 l3 1.6', stroke: '#fffaf0', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, bob);
      svgEl('ellipse', { cx: 9, cy: -18, rx: 5, ry: 7, fill: shade(color, 0.25) }, bob);
      svgEl('circle', { cx: 15.6, cy: -21, r: 0.9, fill: '#222' }, bob);
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
      addAnimal(k, c, pick([...spots.park, ...spots.plaza], i), { speed: k === 'cat' ? 16 : 26, ...(o || {}) });
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

    // 羊駝、奇異鳥、鴞鸚鵡：在城市的公園裡
    [['alpaca', '#f1e2cc', 0], ['alpaca', '#d9b48c', 1], ['kiwi', '#8a6a4a', 2], ['kiwi', '#7a5c40', 0], ['kakapo', '#8fbf5a', 1]].forEach(([k, c, i]) => {
      addAnimal(k, c, pick(parks, i), { speed: k === 'kiwi' ? 20 : k === 'kakapo' ? 7 : 12, scale: k === 'alpaca' ? 1.1 : 1 });
    });
    // 鵜鶘：浮在湖上（沒有湖就在廣場）
    if (spots.lake) [0, 1].forEach(() => addAnimal('pelican', '#f6f4ef', spots.lake, { float: true, speed: 6, scale: 1.05 }));
    else addAnimal('pelican', '#f6f4ef', pick(plazas, 1), { speed: 8 });
    // 鵝鶓、袋鼠、大象：在城市外面的原野上
    const wild = spots.wild.length ? spots.wild : parks;
    [['emu', '#6b5a4a', 0, 1.15, 26], ['emu', '#75614f', 1, 1.15, 26], ['kangaroo', '#c98b55', 2, 1.15, 30], ['kangaroo', '#b97c49', 3, 1.05, 30],
      ['elephant', '#a9adb8', 4, 1.45, 8], ['elephant', '#b3b7c1', 4, 0.9, 9]].forEach(([k, c, i, sc, sp]) => {
      addAnimal(k, c, pick(wild, i), { speed: sp, scale: sc, hop: k === 'kangaroo' });
    });

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
      if (a.fleeT > 0) a.fleeT -= dt;
      let lift = 0, flap = 1, bobY = 0, headRot = 0;
      if (a.mode === 'sky') { // 鸚鵡：一直飛
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
        if (d < 10) newSkyTarget(a);
        else { const v = a.speed * (a.fleeT > 0 ? 3 : 1); a.x += (dx / d) * v * dt; a.y += (dy / d) * v * dt; a.face = dx >= 0 ? 1 : -1; }
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
            const step = Math.min(d, a.speed * (a.fleeT > 0 ? 4.5 : 1) * dt);
            a.x += (dx / d) * step; a.y += (dy / d) * step;
            if (Math.abs(dx) > 0.5) a.face = dx > 0 ? 1 : -1;
            bobY = a.hop ? -Math.abs(Math.sin(a.ph * 6)) * 9 : -Math.abs(Math.sin(a.ph * (a.headG ? 18 : 11))) * (a.headG ? 1.5 : 1.2);
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

  // 在某個位置冒出一個小泡泡
  function sayAt(x, y, text, cls = '') {
    const g = svgEl('g', { class: `bubble ${cls}`, transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, layers.sky);
    const bg = svgEl('rect', { rx: 8, fill: '#fff', stroke: 'var(--ink)', 'stroke-width': 1.5 }, g);
    const t = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'bubble-text' }, g);
    t.textContent = text;
    const bb = t.getBBox();
    bg.setAttribute('x', bb.x - 6); bg.setAttribute('y', bb.y - 3);
    bg.setAttribute('width', bb.width + 12); bg.setAttribute('height', bb.height + 6);
    setTimeout(() => g.remove(), 1600);
  }

  // 點擊的地方：附近的人和動物嚇得跑開
  const SCARE_R = 175;
  function scare(x, y) {
    const scaredFlocks = new Set();
    animals.forEach((a) => {
      const ay = a.y + (a.mode === 'sky' ? -40 : 0);
      const d = Math.hypot(a.x - x, ay - y);
      if (d > SCARE_R) return;
      const ux = (a.x - x) / (d || 1), uy = (a.y - y) / (d || 1);
      if (a.kind === 'capy') { if (Math.random() < 0.7) sayAt(a.x, a.y - 30, '……（淡定）'); return; }
      const flock = flocks.find((f) => f.birds.includes(a));
      if (flock) {
        if (a.mode === 'ground' && !scaredFlocks.has(flock)) { scaredFlocks.add(flock); flyFlock(flock); sayAt(a.x, a.y - 22, '！'); }
        return;
      }
      if (a.mode === 'sky') { a.tx = a.x + ux * 320; a.ty = a.y + uy * 320; a.fleeT = 2; return; }
      a.tx = a.x + ux * (90 + Math.random() * 60); a.ty = a.y + uy * (90 + Math.random() * 60);
      a.idle = 0; a.fleeT = 1.8;
      sayAt(a.x, a.y - 30, '！');
    });
    walkers.forEach((w) => {
      if (w.x == null || Math.hypot(w.x - x, w.y - y) > SCARE_R) return;
      const p1 = w.rd.el.getPointAtLength(clamp(w.d + 8, 0, w.rd.len)), p0 = w.rd.el.getPointAtLength(clamp(w.d - 8, 0, w.rd.len));
      w.dir = Math.hypot(p1.x - x, p1.y - y) > Math.hypot(p0.x - x, p0.y - y) ? 1 : -1;
      w.pause = 0; w.fleeT = 2;
      sayAt(w.x, w.y - 30, Math.random() < 0.3 ? '哇！' : '！');
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
  const walkers = []; // 路上的行人
  const roads = [];
  const spots = { park: [], plaza: [], lake: null, wild: [] }; // 動物的活動範圍（wild = 城市外的原野）
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
      const plate = $(`.plate[data-id="${id}"]`, labelsSvg || svg);
      if (plate) plate.classList.toggle('dim', g.classList.contains('dim'));
    });
    $$('.district', labelsSvg || svg).forEach((g) => g.classList.toggle('dim', !state.active.has(g.dataset.cat)));
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
    if (labelsSvg) labelsSvg.classList.toggle('no-labels', !state.labels);
  }

  /* =========================================================
   *  平移 / 縮放（只改 viewBox，不碰網址）
   * ========================================================= */
  let vb = { x: -500, y: -400, w: 1000, h: 800 };
  const lightsSvg = document.getElementById('lights'); // 夜晚的燈光（疊在變暗的地圖上面）
  const labelsSvg = document.getElementById('labels'); // 名牌、地區名稱（不受夜色影響）
  const tintSvg = document.getElementById('tint'); // 夜色（建築的位置會挖空，晚上建築仍然清楚）
  const applyVB = () => {
    const v = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
    svg.setAttribute('viewBox', v);
    if (lightsSvg) lightsSvg.setAttribute('viewBox', v);
    if (labelsSvg) labelsSvg.setAttribute('viewBox', v);
    if (tintSvg) tintSvg.setAttribute('viewBox', v);
  };
  const setMapTransform = (tf, wc = '') => [svg, lightsSvg, labelsSvg, tintSvg].forEach((el) => { if (!el) return; el.style.transformOrigin = '0 0'; el.style.transform = tf; el.style.willChange = wc; });
  const rect = () => $('#mapwrap').getBoundingClientRect();
  const toWorld = (cx, cy) => { const r = rect(); return { x: vb.x + ((cx - r.left) / r.width) * vb.w, y: vb.y + ((cy - r.top) / r.height) * vb.h }; };
  const MINW = 280, MAXW = 6000;

  function zoomAt(cx, cy, f, preview = false) {
    const p = toWorld(cx, cy);
    const w2 = clamp(vb.w * f, MINW, MAXW), k = w2 / vb.w;
    vb = { x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w: w2, h: vb.h * k };
    preview ? previewVB() : applyVB();
  }

  // 手勢中：地圖不重畫，只把畫好的圖用 GPU 平移／縮放（手機不會閃）；放手後再重畫一次
  let gesture = null, previewRaf = 0;
  function previewVB() {
    if (!gesture) { gesture = { vb0: { ...vb } }; setMapTransform('', 'transform'); state.gesturing = true; }
    if (previewRaf) return;
    previewRaf = requestAnimationFrame(() => {
      previewRaf = 0;
      if (!gesture) return;
      const r = rect(), v0 = gesture.vb0;
      const sc = v0.w / vb.w;
      const tx = ((v0.x - vb.x) / vb.w) * r.width, ty = ((v0.y - vb.y) / vb.h) * r.height;
      setMapTransform(`translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${sc.toFixed(4)})`, 'transform');
    });
  }
  function commitVB() {
    if (!gesture) return;
    cancelAnimationFrame(previewRaf); previewRaf = 0;
    gesture = null; state.gesturing = false;
    applyVB();
    setMapTransform('');
  }

  let anim = null;
  function animateTo(target, dur = 650) {
    commitVB();
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
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* 某些瀏覽器不支援就算了 */ }
        svg.classList.add('dragging');
      }
      if (!dragged) { pts.set(e.pointerId, cur); return; }
      const r = rect();
      if (pts.size === 1) {
        vb.x -= ((cur.x - prev.x) / r.width) * vb.w;
        vb.y -= ((cur.y - prev.y) / r.height) * vb.h;
        previewVB();
      }
      pts.set(e.pointerId, cur);
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinchD) zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, pinchD / d, true);
        pinchD = d;
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchD = 0;
      if (!pts.size) { svg.classList.remove('dragging'); commitVB(); }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); cancelAnimationFrame(anim); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015)); }, { passive: false });

    svg.addEventListener('click', (e) => {
      if (dragged) return;
      const critter = e.target.closest('.animal');
      if (critter) { pokeAnimal(critter); const p = toWorld(e.clientX, e.clientY); scare(p.x, p.y); return; }
      const tile = e.target.closest('.tile, .plate');
      if (tile && canOpen(itemById[tile.dataset.id])) openItem(tile.dataset.id);
      else {
        const p = toWorld(e.clientX, e.clientY);
        scare(p.x, p.y); // 把附近的人跟動物嚇跑
        if (state.selected) closePanel();
      }
    });
    if (labelsSvg) labelsSvg.addEventListener('click', (e) => {
      const pl = e.target.closest('.plate');
      if (pl && canOpen(itemById[pl.dataset.id])) openItem(pl.dataset.id);
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
    if (!state.paused && !state.gesturing && state.view === 'map') {
      if (state.movers) movers.forEach((m) => {
        if (m.mover.classList.contains('hidden') || !m.len) return;
        m.t = (m.t + dt * m.speed * (300 / Math.max(120, m.len)) ) % 1;
        const p = m.path.getPointAtLength(m.t * m.len);
        m.mover.setAttribute('cx', p.x); m.mover.setAttribute('cy', p.y);
      });
      if (state.animals) updateAnimals(dt);
      walkers.forEach((w) => {
        if (w.pause > 0) { w.pause -= dt; w.legs.setAttribute('d', 'M-1.4 -5 L-1.6 0 M1.4 -5 L1.6 0'); return; }
        const flee = w.fleeT > 0;
        if (flee) w.fleeT -= dt;
        w.ph += dt * (flee ? 1.8 : 1);
        w.d += w.v * (flee ? 5 : 1) * dt * w.dir;
        const lo = w.rd.len * 0.12, hi = w.rd.len * 0.88; // 不要走進建築裡
        if (w.d > hi || w.d < lo) { w.dir *= -1; w.d = clamp(w.d, lo, hi); w.pause = flee ? 0.3 : 0.8 + Math.random() * 2.5; }
        const p = w.rd.el.getPointAtLength(w.d), q = w.rd.el.getPointAtLength(clamp(w.d + 1, 0, w.rd.len));
        const ang = Math.atan2(q.y - p.y, q.x - p.x), off = (w.rd.main ? 15 : 13) * w.side;
        const x = p.x - Math.sin(ang) * off, y = p.y + Math.cos(ang) * off;
        const face = Math.cos(ang) * w.dir >= 0 ? 1 : -1;
        const step = Math.sin(w.ph * 11);
        w.legs.setAttribute('d', `M-1.4 -5 L${(-2 + step * 1.8).toFixed(1)} 0 M1.4 -5 L${(2 - step * 1.8).toFixed(1)} 0`);
        w.x = x; w.y = y;
        w.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
        w.sp.setAttribute('transform', `translate(0,${(-Math.abs(step) * 0.8).toFixed(2)}) scale(${face * 1.35},1.35)`);
      });
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
  // 每個按鈕的說明（手機版點了會跳出小字）
  const TOOL_TIP = {
    labels: ['🏷️ 名牌', '建築下面的名字'],
    lines: ['🔗 協作線', '建築之間的合作關係'],
    animals: ['🐾 動物', '城市裡的小動物'],
    log: ['📜 日誌', '畫面下方的城市日誌'],
  };
  let tipTimer = null;
  function toolTip(btn, html) {
    let tip = $('#tb-tip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'tb-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html;
    const r = btn.getBoundingClientRect();
    tip.style.left = `${clamp(r.left + r.width / 2, 80, window.innerWidth - 80)}px`;
    const below = r.top < 120;
    tip.classList.toggle('below', below);
    tip.style.top = below ? `${r.bottom + 10}px` : `${r.top - 10}px`;
    tip.classList.remove('show'); void tip.offsetWidth; tip.classList.add('show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove('show'), 1600);
  }

  function bindToolbar() {
    const bar = $('#toolbar'), toggle = $('.tb-toggle', bar);
    const setOpen = (open) => {
      bar.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? '收起工具列' : '打開工具列');
      toggle.firstChild.textContent = open ? '✕' : '🧰';
    };
    // 手機：點地圖就把工具列收起來
    svg.addEventListener('pointerdown', () => { if (isMobile()) setOpen(false); });
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b === toggle) { setOpen(!bar.classList.contains('open')); return; }
      if (b.dataset.action === 'fit') {
        if (state.view !== 'map') setView('map');
        fit();
        if (isMobile()) toolTip(b, '🦅 鳥瞰<small>看整座城市</small>');
        return;
      }
      const k = b.dataset.toggle;
      state[k] = !state[k];
      b.setAttribute('aria-pressed', state[k]);
      if (k === 'paused') { b.firstChild.textContent = state.paused ? '▶️' : '⏸️'; b.querySelector('span').textContent = state.paused ? '播放' : '暫停'; document.body.classList.toggle('paused', state.paused); }
      if (k === 'log') $('#log').classList.toggle('hide', !state.log);
      if (k === 'animals') svg.classList.toggle('no-animals', !state.animals);
      refreshMap();
      if (isMobile()) {
        if (k === 'paused') toolTip(b, state.paused ? '⏸️ 已暫停<small>畫面上的動畫都停下來</small>' : '▶️ 播放中<small>動畫繼續動</small>');
        else if (TOOL_TIP[k]) toolTip(b, `${TOOL_TIP[k][0]}：${state[k] ? '開' : '關'}<small>${TOOL_TIP[k][1]}</small>`);
      }
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
   *  日夜光影：依「訪客自己的當地時間」計算日出日落、太陽月亮位置與城市光線
   * ========================================================= */
  const LAT = 25; // 以台灣的緯度估日照長度
  const DAY_MODES = [
    { id: 'auto', label: '現在時間' },
    { id: 'dawn', label: '日出' },
    { id: 'noon', label: '白天' },
    { id: 'dusk', label: '黃昏' },
    { id: 'night', label: '夜晚' },
  ];
  let dayMode = 0;
  let lastPhase = '';

  function sunTimes(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const n = Math.floor((date - start) / 864e5);
    const decl = 23.44 * Math.sin((2 * Math.PI * (284 + n)) / 365) * Math.PI / 180;
    const cosH = -Math.tan(LAT * Math.PI / 180) * Math.tan(decl);
    const H = Math.acos(clamp(cosH, -1, 1)) * 180 / Math.PI;
    const half = H / 15; // 半天的小時數
    const noon = 11.95;
    return { rise: noon - half, set: noon + half };
  }

  // 月相 0 = 新月、0.5 = 滿月
  function moonPhase(date) {
    const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    const d = (date.getTime() - ref) / 864e5;
    return ((d % syn) + syn) % syn / syn;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  // 依太陽高度（-1 ~ 1）決定整座城市蓋上的顏色
  const TINT_KEYS = [
    [-1, [40, 52, 105, 0.74]],
    [-0.28, [40, 52, 105, 0.74]],
    [-0.1, [112, 98, 170, 0.6]],
    [0, [238, 138, 150, 0.52]],
    [0.12, [255, 196, 140, 0.4]],
    [0.32, [255, 236, 205, 0.12]],
    [0.5, [255, 255, 255, 0]],
    [1, [255, 255, 255, 0]],
  ];
  function tintAt(e) {
    for (let i = 0; i < TINT_KEYS.length - 1; i++) {
      const [e0, c0] = TINT_KEYS[i], [e1, c1] = TINT_KEYS[i + 1];
      if (e >= e0 && e <= e1) {
        const t = (e - e0) / (e1 - e0 || 1);
        return c0.map((v, k) => lerp(v, c1[k], t));
      }
    }
    return TINT_KEYS[TINT_KEYS.length - 1][1];
  }

  function applyDaylight() {
    const now = new Date();
    const { rise, set } = sunTimes(now);
    const mode = DAY_MODES[dayMode].id;
    let t = now.getHours() + now.getMinutes() / 60;
    if (mode === 'dawn') t = rise + 0.12;
    else if (mode === 'noon') t = (rise + set) / 2 - 1.5;
    else if (mode === 'dusk') t = set - 0.12;
    else if (mode === 'night') t = 22;

    const dayLen = set - rise;
    let e, sunP = null, moonP = null;
    if (t >= rise && t <= set) { sunP = (t - rise) / dayLen; e = Math.sin(Math.PI * sunP); }
    else { moonP = (((t - set) + 24) % 24) / (24 - dayLen); e = -Math.sin(Math.PI * moonP); }
    // 太陽剛下山／快升起時，天還有點亮
    if (sunP === null) { const edge = Math.min(moonP, 1 - moonP) * (24 - dayLen); if (edge < 0.6) e = -edge / 0.6 * 0.12; }

    const night = clamp((-e - 0.02) / 0.22, 0, 1);
    const root = document.documentElement.style;
    const [r, g, b, a] = tintAt(e);
    root.setProperty('--tint', `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`);
    root.setProperty('--night', night.toFixed(3));
    document.body.classList.toggle('is-night', night > 0.5);

    // 太陽：從右邊（東）升起、劃過上空、從左邊（西）落下；月亮在晚上走同樣的路
    const sun = $('#sun'), moon = $('#moon');
    const place = (el, p, show) => {
      if (!el) return;
      el.style.opacity = show ? 1 : 0;
      if (p == null) return;
      el.style.left = `${(86 - 64 * p).toFixed(2)}%`;
      // 手機上方有索引卡，太陽月亮走低一點才不會被擋住
      const [base, amp] = isMobile() ? [220, 60] : [150, 80];
      el.style.top = `${(base - Math.sin(Math.PI * p) * amp).toFixed(1)}px`;
    };
    place(sun, sunP ?? (moonP < 0.5 ? 1 : 0), e > -0.06);
    place(moon, moonP ?? (sunP < 0.5 ? 1 : 0), e < 0.06);
    if (moon) {
      // 月相：陰影從右邊進來（虧）、往左邊退開（盈）；滿月時完全移開
      const ph = moonPhase(now);
      const off = ph < 0.5 ? -(ph * 2) * 105 : (1 - (ph - 0.5) * 2) * 105;
      moon.style.setProperty('--moonx', `${off.toFixed(1)}%`);
    }

    // 影子：背向太陽，太陽越低影子越長；晚上影子很淡
    const sp = sunP ?? 0.5, low = 1 - Math.max(0, e);
    const mapStyle = svg.style;
    mapStyle.setProperty('--shx', `${((sp - 0.5) * 2 * 14 * low).toFixed(1)}px`);
    mapStyle.setProperty('--shy', `${(3 + low * 6).toFixed(1)}px`);
    mapStyle.setProperty('--shl', (1 + low * 0.45).toFixed(2));
    mapStyle.setProperty('--sho', (sunP === null ? 0.35 : 1).toFixed(2));

    // 時間按鈕
    const btn = $('#time-btn');
    if (btn) {
      const icon = night > 0.5 ? '🌙' : e < 0.15 && sunP !== null ? (sunP < 0.5 ? '🌅' : '🌇') : e < 0 ? '🌆' : '☀️';
      const hh = Math.floor(t) % 24, mm = Math.floor((t % 1) * 60);
      btn.firstChild.textContent = icon;
      $('span', btn).textContent = mode === 'auto' ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : DAY_MODES[dayMode].label;
      btn.classList.toggle('preview', mode !== 'auto');
    }

    // 城市日誌報時
    const phase = night > 0.5 ? 'night' : sunP === null ? 'twilight' : e < 0.15 ? (sunP < 0.5 ? 'dawn' : 'dusk') : 'day';
    if (lastPhase && phase !== lastPhase && mode === 'auto') {
      const msg = { dawn: '🌅 太陽升起來了，城市醒了', day: '☀️ 晴朗的白天', dusk: '🌇 夕陽西下，天空染成橘色', twilight: '🌆 天色慢慢暗下來', night: '🌙 夜深了，城市的燈都亮了' }[phase];
      if (msg && typeof pushLog === 'function') pushLog(msg, null, true);
    }
    lastPhase = phase;
  }

  function bindDaylight() {
    // 星星
    const stars = $('#stars');
    if (stars && !stars.children.length) {
      const rnd = seeded(77);
      for (let i = 0; i < 46; i++) {
        const st = document.createElement('i');
        st.className = 'star';
        st.style.left = `${(rnd() * 100).toFixed(1)}%`;
        st.style.top = `${(rnd() * 70).toFixed(1)}%`;
        st.style.animationDelay = `${(rnd() * 3).toFixed(2)}s`;
        if (rnd() < 0.25) st.classList.add('big');
        stars.appendChild(st);
      }
    }
    const btn = $('#time-btn');
    if (btn) btn.addEventListener('click', () => {
      dayMode = (dayMode + 1) % DAY_MODES.length;
      applyDaylight();
      const m = DAY_MODES[dayMode];
      toolTip(btn, m.id === 'auto' ? '🕒 跟著現在時間<small>城市的光影會隨時間變化</small>' : `👀 預覽：${m.label}<small>再點一下切換，最後回到現在時間</small>`);
    });
    applyDaylight();
    setInterval(applyDaylight, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) applyDaylight(); });
  }

  /* =========================================================
   *  背景音樂：第一次點畫面才開始（瀏覽器不允許自動出聲）；右上角可以開關，會記住
   * ========================================================= */
  function bindMusic() {
    const audio = $('#bgm'), btn = $('#music-btn');
    if (!audio || !btn) return;
    const KEY = 'content-city-music', VOL = 0.35;
    let want = true;
    try { want = localStorage.getItem(KEY) !== 'off'; } catch (_) {}
    let fadeT = 0;
    const ui = (on) => { btn.textContent = on ? '🔊' : '🔇'; btn.setAttribute('aria-pressed', on); btn.classList.toggle('on', on); };
    const fade = (to, done) => {
      clearInterval(fadeT);
      fadeT = setInterval(() => {
        const v = audio.volume + (to > audio.volume ? 0.03 : -0.05);
        if ((to > audio.volume && v >= to) || (to <= audio.volume && v <= to)) { audio.volume = Math.max(0, Math.min(1, to)); clearInterval(fadeT); done && done(); }
        else audio.volume = Math.max(0, Math.min(1, v));
      }, 60);
    };
    const play = () => {
      audio.volume = 0;
      const p = audio.play();
      (p && p.then ? p : Promise.resolve()).then(() => { ui(true); fade(VOL); }).catch(() => ui(false));
    };
    const stop = () => { ui(false); fade(0, () => audio.pause()); };
    btn.addEventListener('click', () => {
      want = audio.paused;
      try { localStorage.setItem(KEY, want ? 'on' : 'off'); } catch (_) {}
      want ? play() : stop();
    });
    // 第一次點畫面（不是點音樂鈕）就開始播
    const first = (e) => {
      if (e.target.closest && e.target.closest('#music-btn')) return;
      document.removeEventListener('pointerdown', first, true);
      if (want && audio.paused) play();
    };
    document.addEventListener('pointerdown', first, true);
    // 切到別的分頁或 App 就暫停，回來再繼續
    let resume = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { resume = !audio.paused; audio.pause(); }
      else if (resume && want) play();
    });
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
    bindMusic();
    bindDaylight();
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
