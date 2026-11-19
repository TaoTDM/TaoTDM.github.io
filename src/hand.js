/* the hand-drawn look: a handwriting font, a line boil and whiteboard details.
   the fonts are a stand-in for real drawings.
   with ?hand in the address, a small picker shows. it changes the fonts and the boil for that visit */

import './hand.css';

const q = new URLSearchParams(location.search);
const tune = q.has('hand');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* fonts for the mark, the tagline and the spark labels. size is a scale on the default size */
const HAND = {
  gaegu: { name: 'gaegu', family: 'Gaegu', css: 'Gaegu', size: 1.15 },
  caveat: { name: 'caveat', family: 'Caveat', css: 'Caveat:wght@400..700', size: 1.3 },
  nanum: { name: 'nanum pen', family: 'Nanum Pen Script', css: 'Nanum+Pen+Script', size: 1.4 },
  reenie: { name: 'reenie beanie', family: 'Reenie Beanie', css: 'Reenie+Beanie', size: 1.45 },
  architect: { name: 'architects daughter', family: 'Architects Daughter', css: 'Architects+Daughter', size: 1 }
};
/* fonts for the paragraphs */
const TEXT = {
  shantell: { name: 'shantell sans', family: 'Shantell Sans', css: 'Shantell+Sans:wght,BNCE,INFM@300..800,-100..100,0..100', size: .95, weight: 350, axes: '"INFM" 55, "BNCE" 12' },
  playpen: { name: 'playpen sans', family: 'Playpen Sans', css: 'Playpen+Sans:wght@100..800', size: .9, weight: 300 },
  patrick: { name: 'patrick hand', family: 'Patrick Hand', css: 'Patrick+Hand', size: 1.1, weight: 400 },
  kalam: { name: 'kalam', family: 'Kalam', css: 'Kalam:wght@300;400;700', size: 1, weight: 300 },
  same: { name: 'same as hand' },
  newsreader: { name: 'newsreader' }
};
/* boil strength: filter scale for the text, filter scale for the box, pixel shift for the canvas.
   the box moves more than the text. the text stays easy to read, and the box does not look rigid */
const BOIL = [
  { name: 'off', scale: 0, box: 0, amp: 0 },
  { name: 'faint', scale: 3, box: 5.5, amp: 1.1 },
  { name: 'more', scale: 5.5, box: 9, amp: 2 }
];
const FRAMES = 3;
const TICK = 150;                     /* time for one frame */

const hand = HAND[q.get('hand')] || HAND.gaegu;
const textKey = TEXT[q.get('text')] ? q.get('text') : 'shantell';
const text = TEXT[textKey];
const level = Math.max(0, Math.min(BOIL.length - 1, parseInt(q.get('boil') ?? '1', 10) || 0));
const boil = BOIL[level];

let frame = 0;

/* smooth noise, two channels, from a seed. x and y are in cells */
function noise(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const N = 32, g = new Float32Array(N * N * 2);
  for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
  const at = (i, j, c) => g[((j & 31) * N + (i & 31)) * 2 + c];
  return (x, y, c) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const top = at(xi, yi, c) + (at(xi + 1, yi, c) - at(xi, yi, c)) * sx;
    const low = at(xi, yi + 1, c) + (at(xi + 1, yi + 1, c) - at(xi, yi + 1, c)) * sx;
    return top + (low - top) * sy;
  };
}
const fields = Array.from({ length: FRAMES }, (_, i) => noise(7919 * (i + 1)));

/* a number from 0 to 1 that is always the same for the same i */
function hash(i) {
  const v = Math.sin(i * 127.1 + 3.7) * 43758.5453;
  return v - Math.floor(v);
}

/* a point, moved by the noise of the frame now. for lines that are drawn on the canvas */
function wob(x, y, amp, cell = 24) {
  const n = fields[frame];
  return [x + n(x / cell, y / cell, 0) * amp, y + n(x / cell, y / cell, 1) * amp];
}
function seg(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}
/* line style. chalk, on the night board, has small breaks */
function marker(ctx, ink, width) {
  const chalk = ink === '#fff';
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = chalk ? 'butt' : 'round';
  ctx.setLineDash(chalk ? [11, 1.6, 6, 1.2] : []);
}

/* a drawing, shifted by the noise of one frame. the result is a small image in one ink.
   white ink is chalk: it has grain */
function boiled(w, h, dpr, paint, f, amp, cell, shift, ink) {
  const W = Math.ceil(w * dpr), H = Math.ceil(h * dpr);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  /* the canvas is in the page while it is painted. a canvas out of the page does not get
     the font smoothing of the site, and its text comes out heavier */
  c.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(c);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.scale(dpr, dpr);
  x.fillStyle = '#000'; x.strokeStyle = '#000';
  paint(x);
  c.remove();
  if (amp > 0) {
    const chalk = ink === '#fff';
    const src = x.getImageData(0, 0, W, H).data;
    const out = x.createImageData(W, H), o = out.data;
    const rgb = chalk ? 255 : 0;
    const A = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 0 : src[(j * W + i) * 4 + 3];
    const n = fields[f];
    const grain = Math.max(1, Math.round(dpr * .6));
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const u = i / dpr / cell + shift, v = j / dpr / cell + shift * .37;
        const px = i + n(u, v, 0) * amp * dpr, py = j + n(u, v, 1) * amp * dpr;
        const xi = Math.floor(px), yi = Math.floor(py), fx = px - xi, fy = py - yi;
        let al = (A(xi, yi) * (1 - fx) + A(xi + 1, yi) * fx) * (1 - fy) + (A(xi, yi + 1) * (1 - fx) + A(xi + 1, yi + 1) * fx) * fy;
        if (chalk && al > 0) {
          const g = hash(Math.floor(i / grain) * 7.13 + Math.floor(j / grain) * 91.7 + shift);
          al *= g < .14 ? .3 : .72 + .28 * g;
        }
        const k = (j * W + i) * 4;
        o[k] = o[k + 1] = o[k + 2] = rgb; o[k + 3] = al;
      }
    }
    x.putImageData(out, 0, 0);
  } else if (ink === '#fff') {
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff';
    x.fillRect(0, 0, w, h);
  }
  return c;
}

/* the pen for the canvas. it draws words and dots as boiled images, one for each frame,
   and it draws the lines: the flight line, the loop, the night light, the dust */
function makePen() {
  const cache = new Map();
  const m = document.createElement('canvas').getContext('2d');
  /* the images have at least two pixels for one point, so that the thin lines stay sharp */
  const dpr = () => Math.max(2, Math.min(3, devicePixelRatio || 1));
  const P = 5;
  let count = 0;
  const ids = new Map();
  const idOf = key => { if (!ids.has(key)) ids.set(key, ++count); return ids.get(key); };
  const amp = boil.amp;

  /* the image of a word in one frame */
  function wordImage(str, font, ink, f) {
    const key = str + '|' + font + '|' + ink + '|' + f;
    let sp = cache.get(key);
    if (!sp) {
      m.font = font;
      const size = parseFloat((font.match(/([\d.]+)px/) || [0, 16])[1]);
      const w = Math.ceil(m.measureText(str).width) + P * 2, h = Math.ceil(size * 1.7) + P * 2;
      const c = boiled(w, h, dpr(), g => {
        g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillText(str, P, h / 2);
      }, f, amp, 13, idOf(str) * 3.1, ink);
      sp = { c, w, h };
      cache.set(key, sp);
    }
    return sp;
  }
  function word(ctx, str, font, x, y, ink) {
    const sp = wordImage(str, font, ink, frame);
    ctx.drawImage(sp.c, x - P, y - sp.h / 2, sp.w, sp.h);
  }

  /* the images of the labels are made before they are needed, while the page has free time.
     without this, the first gather makes them all in one frame */
  const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 60));
  let want = null, queue = [], busy = false;
  function work(deadline) {
    busy = false;
    while (queue.length && deadline.timeRemaining() > 5) {
      const [str, font, ink, f] = queue.shift();
      wordImage(str, font, ink, f);
    }
    if (queue.length) { busy = true; idle(work); }
  }
  function warm(words, font, ink) {
    want = [words, font, ink];
    queue = [];
    for (let f = 0; f < (reduce ? 1 : FRAMES); f++) for (const str of words) queue.push([str, font, ink, f]);
    if (!busy) { busy = true; idle(work); }
  }

  function dot(ctx, x, y, px, hollow, ink, id) {
    const key = 'dot|' + px + '|' + hollow + '|' + ink + '|' + id + '|' + frame;
    let sp = cache.get(key);
    const S = 18;
    if (!sp) {
      const c = boiled(S, S, dpr(), g => {
        g.beginPath();
        if (hollow) { g.lineWidth = 1.2; g.arc(S / 2, S / 2, px * .95, 0, Math.PI * 2); g.stroke(); }
        else { g.arc(S / 2, S / 2, px * .72, 0, Math.PI * 2); g.fill(); }
      }, frame, amp * .8, 4, id * 5.3, ink);
      sp = { c };
      cache.set(key, sp);
    }
    ctx.drawImage(sp.c, x - S / 2, y - S / 2, S, S);
  }

  /* flight line. a marker line along the way of the spark. the old end of the line fades first */
  const LINE_LIFE = 900;
  function trail(ctx, s, ink, now) {
    const tr = s.trail;
    while (tr.length && now - tr[0].t > LINE_LIFE) tr.shift();
    if (!tr.length) return;
    ctx.save();
    marker(ctx, ink, 1.3);
    ctx.setLineDash([]);
    const pts = tr.map(p => wob(p.x, p.y, amp * 1.2, 30));
    if (s.flying) pts.push([s.x, s.y]);
    for (let i = 1; i < pts.length; i++) {
      const age = (now - tr[Math.min(i, tr.length - 1)].t) / LINE_LIFE;
      ctx.globalAlpha = Math.max(0, 1 - age) * .8;
      seg(ctx, pts[i - 1], pts[i]);
    }
    ctx.restore();
  }

  /* a loose circle around a label. k is how much of it is drawn, 0 to 1.
     the end goes a little past the start, and outside it */
  function loop(ctx, x1, x2, y, k, ink, id) {
    const cx = (x1 + x2) / 2, rx = (x2 - x1) / 2 + 10, ry = 15;
    const a0 = -2.5 + (id % 3) * .25, full = Math.PI * 2 + .7, sweep = k * full;
    ctx.save();
    marker(ctx, ink, 1.2);
    ctx.beginPath();
    for (let a = 0, i = 0; a <= sweep; a += .14, i++) {
      const g = 1 + .08 * (a / full);
      const p = wob(cx + Math.cos(a0 + a) * rx * g, y + Math.sin(a0 + a) * ry * g, amp * 1.3, 26);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* night light, as marker shading. one thick line goes from side to side down the light, the
     way a hand fills a shape fast. two lines are its sides, and short rays are around the box.
     the lines are solid and get weaker with the distance. each frame moves the turns a little.
     L and lightAt come from sparks.js */
  function light(ctx, L, lightAt, box) {
    const a = amp * 1.4;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    const fade = ctx.createLinearGradient(0, L.y, 0, L.y + L.reach * .9);
    fade.addColorStop(0, 'rgba(255,255,255,' + (.55 * L.power).toFixed(3) + ')');
    fade.addColorStop(.5, 'rgba(255,255,255,' + (.22 * L.power).toFixed(3) + ')');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = fade;
    /* the shading. the line is thick, and its turns are near to each other at the box, so it
       fills the shape there. the turns are far apart where the light is weak */
    const W = Math.max(8, Math.min(14, L.w * .2));
    ctx.lineWidth = W;
    ctx.beginPath();
    for (let dy = W * .9, i = 0, side = -1; dy < L.reach * .9; i++, side = -side) {
      const { cx, hw } = lightAt(dy);
      const j1 = hash(i * 3.3 + frame * 41.7), j2 = hash(i * 7.1 + frame * 13.3);
      const far = Math.max(2, hw * (.72 + .26 * hash(i)) - W / 2);
      const p = wob(cx + side * far + (j1 - .5) * 7, L.y + dy + (j2 - .5) * 5, a);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      dy += (W * .95 + dy * .06) * (.75 + .5 * hash(i + 20));
    }
    ctx.stroke();
    /* the two sides */
    ctx.lineWidth = 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const dy = L.reach * .88 * i / 10;
        const { cx, hw } = lightAt(dy);
        const p = wob(cx + side * hw, L.y + dy, a * 1.5, 40);
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    /* rays. the right side has short rays, because the tagline is near */
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.6;
    const hw = box.w / 2, hh = box.h / 2;
    let n = 0;
    const ray = (x, y, dx, dy, scale) => {
      const gap = 7 * scale, len = (7 + hash(n + 9) * 8) * scale;
      ctx.globalAlpha = L.power * (.45 + .3 * hash(n + 3));
      seg(ctx, wob(x + dx * gap, y + dy * gap, a), wob(x + dx * (gap + len), y + dy * (gap + len), a));
      n++;
    };
    for (let yy = -hh + 12; yy <= hh - 12; yy += 26) {
      ray(box.x - hw, box.y + yy, -1, 0, 1);
      ray(box.x + hw, box.y + yy, 1, 0, .55);
    }
    for (let xx = -hw + 10; xx <= hw - 10; xx += 18) ray(box.x + xx, box.y - hh, 0, -1, 1);
    ray(box.x - hw, box.y - hh, -.7, -.7, 1);
    ray(box.x + hw, box.y - hh, .7, -.7, .8);
    ctx.restore();
  }

  /* chalk dust. small specks that fall from a point */
  const specks = [];
  function puff(x, y) {
    if (reduce) return;
    const now = performance.now();
    for (let i = 0; i < 14; i++) {
      specks.push({ x: x + (Math.random() - .5) * 40, y, vx: (Math.random() - .5) * 60, vy: -10 - Math.random() * 30, t: now, life: 600 + Math.random() * 500 });
    }
  }
  function dust(ctx, ink, now) {
    if (!specks.length) return;
    ctx.fillStyle = ink;
    for (let i = specks.length - 1; i >= 0; i--) {
      const p = specks[i], ms = now - p.t, a = ms / 1000;
      if (ms > p.life) { specks.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - ms / p.life) * .7;
      ctx.fillRect(p.x + p.vx * a, p.y + p.vy * a + 90 * a * a, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  const px = n => (n * hand.size).toFixed(1) + 'px ';
  return {
    label: '400 ' + px(18.4) + '"' + hand.family + '", cursive',
    peek: '400 ' + px(14) + '"' + hand.family + '", cursive',
    word, dot, trail, loop, light, puff, dust, warm,
    clear: () => { cache.clear(); if (want) warm(...want); }
  };
}

/* the page filters. the turbulence seed is different for each frame.
   the chalk filters, for the night board, also take small pieces out of the lines */
function addFilters() {
  const one = (id, seed, scale, region, grain) =>
    '<filter id="' + id + '" ' + region + ' color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="' + seed + '" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
    (grain ?
      '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="' + (seed + 50) + '" result="g"/>' +
      '<feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ' + grain + '" result="m"/>' +
      '<feComposite in="d" in2="m" operator="in"/>' : '') +
    '</filter>';
  /* the reader region has room for the pips. the box region has room for the note above it */
  const text = 'x="-6%" y="-35%" width="112%" height="170%"';
  const box = 'x="-60%" y="-55%" width="220%" height="175%"';
  let html = '';
  for (let i = 0; i < FRAMES; i++) {
    html += one('boil' + i, 3 + i * 11, boil.scale, text);
    html += one('boilbox' + i, 5 + i * 11, boil.box, box);
    html += one('chalk' + i, 3 + i * 11, boil.scale, text, '1.6 0 0 0 0.1');
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = '<svg width="0" height="0" aria-hidden="true" style="position:absolute">' + html + '</svg>';
  document.body.appendChild(wrap.firstChild);
}

/* the box line. an svg path is in place of the border, so that it can be drawn from start to end */
function addFrame(box) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'hand-frame');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('pathLength', '1');
  svg.appendChild(path);
  box.appendChild(svg);
  const fit = () => {
    const w = box.offsetWidth, h = box.offsetHeight, k = .75;
    if (!w || !h) return;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    path.setAttribute('d', 'M' + k + ' ' + k + 'H' + (w - k) + 'V' + (h - k) + 'H' + k + 'Z');
  };
  fit();
  addEventListener('resize', fit);
  return fit;
}

/* the hint. an arrow and the word tap, above the box, in place of the pulse ring.
   main.js puts the pulse class on the box and takes it off */
function addNote(box) {
  const note = document.createElement('i');
  note.className = 'hand-note';
  note.setAttribute('aria-hidden', 'true');
  note.innerHTML = '<b>tap</b><svg viewBox="0 0 30 34" width="30" height="34">' +
    '<path class="shaft" pathLength="1" d="M23 2C27 12 21 23 8 30"/>' +
    '<path class="head" pathLength="1" d="M9 21L7 31L17 30"/></svg>';
  box.appendChild(note);
  new MutationObserver(() => {
    const want = box.classList.contains('pulse');
    if (want && note.dataset.state !== 'in') note.dataset.state = 'in';
    else if (!want && note.dataset.state === 'in') note.dataset.state = 'out';
  }).observe(box, { attributes: true, attributeFilter: ['class'] });
}

/* the place of the text of a page, from the text nodes. a line of text is a block as wide as
   the reader, so the nodes give the true width. client units, cut to the reader */
function textBox(page, reader) {
  const box = reader.getBoundingClientRect();
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  const range = document.createRange();
  const walk = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    range.selectNodeContents(walk.currentNode);
    for (const c of range.getClientRects()) {
      if (!c.width || !c.height) continue;
      l = Math.min(l, c.left); r = Math.max(r, c.right);
      t = Math.min(t, Math.max(c.top, box.top)); b = Math.max(b, Math.min(c.bottom, box.bottom));
    }
  }
  return r > l && b > t ? { box, l, r, t, b } : null;
}

/* the eraser. when a page goes out, a copy of it stays for a moment and clears from left to
   right with a soft edge. the next page comes in with the same motion, a short time behind,
   so the two look like one pass. hand.css does the motion */
const ERASE_MS = 520;      /* the same time as in hand.css */

function addEraser(reader) {
  const mark = reader.parentElement;
  const PAD = 14;
  let until = 0;

  const wipe = page => {
    const tb = textBox(page, reader);
    if (!tb) return false;
    /* the copy is as wide as the reader, as the next page is. the two edges then go the same way */
    const w = Math.max(reader.offsetWidth, tb.r - tb.box.left);
    const ghost = document.createElement('div');
    ghost.className = 'hand-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.style.cssText = 'left:' + reader.offsetLeft + 'px;top:' + (reader.offsetTop - PAD) + 'px;width:' + w + 'px;height:' + (reader.offsetHeight + PAD * 2) + 'px';
    /* the inner part is in the same place as the reader and has the same boil, so the text
       does not move when the copy comes in place of the page */
    const inner = document.createElement('div');
    inner.className = 'hand-ghost-in';
    inner.style.cssText = 'left:0;top:' + PAD + 'px;width:' + reader.offsetWidth + 'px;height:' + reader.offsetHeight + 'px';
    const copy = page.cloneNode(true);
    copy.classList.remove('out', 'in', 'first');
    delete copy.dataset.wipe;
    delete copy.dataset.reveal;
    inner.appendChild(copy);
    ghost.appendChild(inner);
    mark.appendChild(ghost);
    const from = page.querySelector('.text'), to = copy.querySelector('.text');
    if (from && to) to.scrollTop = from.scrollTop;
    /* a page that comes in soon after this goes behind the eraser */
    until = performance.now() + 400;
    setTimeout(() => ghost.remove(), ERASE_MS + 60);
    return true;
  };

  /* the page comes in behind the eraser. the mark goes to done at the end, and the mask goes off */
  const reveal = page => {
    page.dataset.reveal = '';
    const done = () => { if (page.dataset.reveal === '') page.dataset.reveal = 'done'; };
    page.addEventListener('animationend', e => { if (e.target === page) done(); });
    setTimeout(done, ERASE_MS + 200);
  };

  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'childList') {
        for (const el of m.addedNodes) {
          if (el.nodeType === 1 && el.classList.contains('page') && performance.now() < until) reveal(el);
        }
        continue;
      }
      const el = m.target;
      if (el.classList.contains('page') && el.classList.contains('out') && !el.dataset.wipe) {
        /* the mark says that the copy has the page now. the page itself hides at once */
        el.dataset.wipe = '0';
        let ok = false;
        try { ok = wipe(el); } catch {}
        if (ok) el.dataset.wipe = '1';
      }
    }
  }).observe(reader, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  return reveal;
}

/* a small list of links to change the fonts and the boil */
function addPicker(drawOn, tryErase) {
  const nav = document.createElement('nav');
  nav.className = 'hand-picker';
  const cur = { hand: Object.keys(HAND).find(k => HAND[k] === hand), text: textKey, boil: String(level) };
  const row = (title, param, items) => {
    const p = document.createElement('p');
    p.append(title + ' ');
    items.forEach(([value, name]) => {
      const a = document.createElement('a');
      const next = new URLSearchParams({ ...cur, [param]: value });
      a.href = '?' + next + location.hash;
      a.textContent = name;
      if (cur[param] === value) a.className = 'on';
      p.append(a, ' ');
    });
    nav.appendChild(p);
  };
  row('hand', 'hand', Object.entries(HAND).map(([k, v]) => [k, v.name]));
  row('text', 'text', Object.entries(TEXT).map(([k, v]) => [k, v.name]));
  row('boil', 'boil', BOIL.map((b, i) => [String(i), b.name]));
  const last = document.createElement('p');
  const again = document.createElement('a');
  again.href = location.href;
  again.textContent = 'draw again';
  again.addEventListener('click', e => { e.preventDefault(); drawOn(); });
  const test = document.createElement('a');
  test.href = location.href;
  test.textContent = 'erase again';
  test.addEventListener('click', e => { e.preventDefault(); tryErase(); });
  const off = document.createElement('a');
  off.href = location.pathname + location.hash;
  off.textContent = 'close picker';
  last.append(again, ' ', test, ' ', off);
  nav.appendChild(last);
  document.body.appendChild(nav);
}

function start() {
  const root = document.documentElement;
  root.dataset.hand = '';
  const stack = '"' + hand.family + '", cursive';
  root.style.setProperty('--hand', stack);
  root.style.setProperty('--hand-size', hand.size);
  /* the paragraph font. the print page keeps the serif */
  const body = textKey === 'same' ? hand : text;
  root.style.setProperty('--text-font', body.family ? '"' + body.family + '", cursive' : 'var(--serif)');
  root.style.setProperty('--text-size', body.size || 1);
  root.style.setProperty('--text-weight', body.weight || 400);
  root.style.setProperty('--text-axes', body.axes || 'normal');

  /* draw-on. the mark stays hidden until the fonts are in, then it is drawn. one time for each visit */
  let seen = true;
  try { seen = !!sessionStorage.getItem('tao.hand.drawn'); } catch {}
  const wantDraw = !reduce && !seen;
  let drawTimer;
  const drawOn = () => {
    if (reduce) return;
    root.removeAttribute('data-draw');
    void root.offsetWidth;
    root.dataset.draw = 'go';
    /* main.js plays the pencil sounds of the draw-on */
    dispatchEvent(new Event('tao:draw'));
    clearTimeout(drawTimer);
    drawTimer = setTimeout(() => root.removeAttribute('data-draw'), 1600);
  };


  const pen = makePen();
  const box = document.getElementById('mark-box');
  const reader = document.getElementById('reader');
  const fit = addFrame(box);
  addNote(box);
  const reveal = reduce ? null : addEraser(reader);
  /* for the picker: the page that shows now is erased and then comes in again, as a page turn does */
  const tryErase = () => {
    const page = reader.querySelector('.page:not(.out)');
    if (!page || !reveal) return;
    page.classList.add('out');
    setTimeout(() => { delete page.dataset.wipe; page.classList.remove('out', 'first'); reveal(page); }, 160);
  };
  /* the first tagline is drawn by the draw-on, so it does not also write itself.
     this waits one turn, because reader.js keeps a copy of the tagline markup first */
  setTimeout(() => { const p = reader.querySelector('.page.idle'); if (p) p.classList.add('first'); }, 0);

  let begun = false;
  const begin = () => {
    if (begun) return;
    begun = true;
    fit();
    pen.clear();
    dispatchEvent(new Event('resize'));
    if (wantDraw) {
      drawOn();
      try { sessionStorage.setItem('tao.hand.drawn', '1'); } catch {}
    }
    /* the mark shows from now on */
    root.dataset.ready = '';
  };
  /* when the fonts are in, the canvas images are made again and the sparks measure again */
  const wait = () => {
    /* the mark has only the hand font, so it does not wait for the paragraph font.
       that font is larger. it loads now, and it is there when a section opens */
    document.fonts.load('18px "' + hand.family + '"').then(begin, begin);
    if (body.family) document.fonts.load((body.weight || 400) + ' 16px "' + body.family + '"').catch(() => {});
  };
  /* style.css has the usual fonts, from public/fonts. a font from the picker comes from here */
  const usual = hand === HAND.gaegu && (textKey === 'shantell' || !body.css);
  if (usual) wait();
  else {
    const families = [hand.css, body.css].filter((f, i, all) => f && all.indexOf(f) === i);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + families.map(f => 'family=' + f).join('&') + '&display=swap';
    link.addEventListener('load', wait);
    document.head.appendChild(link);
  }
  setTimeout(begin, 1800);

  if (tune) addPicker(drawOn, tryErase);
  if (boil.scale) {
    addFilters();
    /* the night board gets the chalk filters */
    const set = () => {
      const kind = root.dataset.theme === 'night' ? 'chalk' : 'boil';
      root.style.setProperty('--boil', 'url(#' + kind + frame + ')');
      /* the box has no grain at night. it is the lamp, and the light from it is solid */
      root.style.setProperty('--boil-box', 'url(#boilbox' + frame + ')');
    };
    set();
    new MutationObserver(set).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    /* the boil stops while the page is hidden */
    let timer = 0;
    const run = () => {
      clearInterval(timer);
      timer = document.hidden ? 0 : setInterval(() => { frame = (frame + 1) % FRAMES; set(); }, TICK);
    };
    if (!reduce) { run(); document.addEventListener('visibilitychange', run); }
  }
  /* true if this load has the draw-on */
  pen.intro = wantDraw;
  return pen;
}

export const pen = start();
