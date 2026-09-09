/* canvas sparks */

export function createSparks({ canvas, field, mark, box, reader, buttons, tree, on = {} }) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  let INK = '#000';
  let night = false;
  const PX = coarse ? 4 : 3;          /* pixel size */
  const PAD = 24;                     /* edge padding */
  const HIT = coarse ? 26 : 18;       /* tap radius */
  const MAXV = 24;                    /* max drift speed */
  const WANDER = 16;                  /* wander force */
  const WALL = 1.6;                   /* wall force */
  const SEP = 90;                     /* separation distance */
  const DAMP = .5;                    /* damping */
  const RADIAL = 1.4;                 /* pull toward orbit radius */
  const ANGULAR = 40;                 /* drift toward orbit slot */
  const FOLLOW = 2.2;                 /* how fast velocity follows the flow */
  const LABEL_H = 26;                 /* label box height */

  const family = getComputedStyle(document.documentElement).getPropertyValue('--serif');
  const LABEL = '400 18.4px ' + family;
  const PEEK = '400 14px ' + family;

  /* geometry cache */
  const G = { w: 0, h: 0, dpr: 1, mark: null, seed: null, box: null, R: 0 };
  function rectOf(el, pad) {
    const r = el.getBoundingClientRect(), f = field.getBoundingClientRect();
    return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2, w: r.width + pad, h: r.height + pad };
  }
  /* the box and the text now showing, not the whole mark */
  function visibleRect(pad) {
    const f = field.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const page = reader.querySelector('.page');
    let l = b.left, r = b.right, tp = b.top, bt = b.bottom;
    if (page) {
      for (const el of page.querySelectorAll('span, a, p, small, .pips')) {
        const c = el.getBoundingClientRect();
        if (!c.width) continue;
        r = Math.max(r, c.right); tp = Math.min(tp, c.top); bt = Math.max(bt, c.bottom);
      }
    }
    return { x: (l + r) / 2 - f.left, y: (tp + bt) / 2 - f.top, w: r - l + pad, h: bt - tp + pad };
  }
  function measure() {
    G.w = field.clientWidth;
    G.h = field.clientHeight;
    G.dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(G.w * G.dpr);
    canvas.height = Math.round(G.h * G.dpr);
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    G.mark = visibleRect(110);
    G.seed = visibleRect(140);
    G.box = rectOf(box, 0);
    G.R = Math.min(G.w, G.h) * .38;
  }
  const inside = (p, r) => Math.abs(p.x - r.x) < r.w / 2 && Math.abs(p.y - r.y) < r.h / 2;

  /* spark records */
  const sparks = tree.map((node, i) => {
    const s = {
      node, x: 0, y: 0, vx: 0, vy: 0,
      absorbed: false, flying: false,
      alpha: 0, vis: 1, peek: 0, hover: false, focused: false,
      peekLine: node.children && node.children[0] ? node.children[0].label : '',
      labelW: 0, maxX: 0,
      orbit: (i / tree.length) * Math.PI * 2,
      omega: .06 + Math.random() * .05, rphase: Math.random() * 7,
      f1: .09 + Math.random() * .12, f2: .17 + Math.random() * .16,
      p1: Math.random() * 7, p2: Math.random() * 7, p3: Math.random() * 7, p4: Math.random() * 7,
      trail: [], gatherAt: 0, dragging: false, whisper: false, lit: 0
    };
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = node.label;
    b.addEventListener('focus', () => { s.focused = true; });
    b.addEventListener('blur', () => { s.focused = false; });
    b.addEventListener('click', () => pick(s));
    buttons.appendChild(b);
    s.button = b;
    return s;
  });

  /* tap on spark */
  function pick(s) { on.select && on.select(s); }

  /* day or night */
  function setTheme(name) {
    night = name === 'night';
    INK = night ? '#fff' : '#000';
  }

  /* window light. the window's shape thrown on the ground: the box's width at the sill,
     wider and dimmer farther down. sway is a sideways drift of the far edge, like a
     lamp moving in the room. power breathes. */
  const LIGHT = { x: 0, y: 0, w: 0, reach: 1, shift: 0, power: 1, widen: 2.6 };
  function updateLight() {
    LIGHT.x = G.box.x;
    LIGHT.y = G.box.y + G.box.h / 2 - 1;
    LIGHT.w = G.box.w;
    LIGHT.reach = G.h - LIGHT.y + 40;
    LIGHT.shift = LIGHT.reach * (.28 * Math.sin(t * .09) + .08 * Math.sin(t * .23 + 1.7));
    LIGHT.power = .6 + .4 * Math.sin(t * .13 + .6) * Math.sin(t * .05 + 2);
  }
  /* center and half width of the light at a depth below the sill */
  function lightAt(dy) {
    const k = Math.max(0, Math.min(1, dy / LIGHT.reach));
    return { cx: LIGHT.x + LIGHT.shift * k, hw: LIGHT.w / 2 * (1 + (LIGHT.widen - 1) * k), k };
  }
  /* how much window light reaches a point, 0 to 1 */
  function litAt(x, y) {
    const dy = y - LIGHT.y;
    if (dy < 0) return 0;
    const { cx, hw, k } = lightAt(dy);
    const across = 1 - Math.min(1, Math.abs(x - cx) / (hw * 1.15));
    const along = 1 - k * .8;
    return LIGHT.power * across * across * along;
  }

  /* label right bound */
  function bounds() {
    ctx.font = LABEL;
    for (const s of sparks) {
      s.labelW = ctx.measureText(s.node.label).width;
      s.maxX = Math.min(G.w * .88, G.w - PAD - 10 - s.labelW);
    }
  }

  function seed() {
    for (const s of sparks) {
      let p;
      do {
        p = { x: G.w * .12 + Math.random() * (s.maxX - G.w * .12), y: G.h * (.12 + Math.random() * .76) };
      } while (inside(p, G.seed));
      s.x = p.x; s.y = p.y;
      nudge(s);
    }
  }
  function nudge(s, speed) {
    const a = Math.random() * Math.PI * 2;
    const v = speed ?? 8 + Math.random() * 7;
    s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v;
  }

  measure();
  bounds();
  seed();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); bounds(); clipCache.clear(); });

  /* label box */
  function rectFor(s) {
    const shown = s.alpha > .15;
    const w = shown ? 14 + s.labelW : PX, h = shown ? LABEL_H : PX;
    return { x1: s.x - PX, x2: s.x + w, y1: s.y - h / 2, y2: s.y + h / 2 };
  }
  /* push apart overlapping boxes */
  function repel(s, add, scale) {
    const a = rectFor(s);
    const pad = 10;
    const push = (b, k) => {
      const gx = Math.max(a.x1 - b.x2, b.x1 - a.x2) - pad;
      const gy = Math.max(a.y1 - b.y2, b.y1 - a.y2) - pad;
      if (gx >= 0 || gy >= 0) {
        /* near but not touching: a gentle point repulsion */
        const cx = (a.x1 + a.x2 - b.x1 - b.x2) / 2, cy = (a.y1 + a.y2 - b.y1 - b.y2) / 2;
        const d = Math.hypot(cx, cy) || 1;
        if (d < SEP) { const f = (SEP - d) / SEP * 18 * k; add(cx / d * f, cy / d * f); }
        return;
      }
      /* overlapping: move out along the shorter way, mostly up or down */
      const cy = (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2;
      const cx = (a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2;
      const f = 90 * k;
      if (-gy < -gx * .6) add(0, Math.sign(cy || 1) * f);
      else add(Math.sign(cx || 1) * f * .6, Math.sign(cy || 1) * f * .5);
    };
    for (const o of sparks) if (o !== s && !o.absorbed && !o.flying) push(rectFor(o), scale);
    const m = G.mark;
    push({ x1: m.x - m.w / 2, x2: m.x + m.w / 2, y1: m.y - m.h / 2, y2: m.y + m.h / 2 }, scale * 1.5);
  }

  /* first visit. one label blooms once, a few seconds in */
  function remember(key) {
    try { if (localStorage.getItem(key)) return true; localStorage.setItem(key, '1'); return false; } catch { return true; }
  }
  if (!remember('tao.seen')) {
    setTimeout(() => {
      const free = sparks.filter(s => !s.absorbed && !s.flying && !s.node.control);
      if (!free.length) return;
      const s = free[Math.floor(Math.random() * free.length)];
      s.whisper = true;
      setTimeout(() => { s.whisper = false; }, 2200);
    }, 4500);
  }

  /* idle whisper. after a quiet minute one spark shows its label for a moment */
  const IDLE = 60000, WHISPER = 1800;
  let lastTouch = performance.now(), lastWhisper = 0;
  function touched() { lastTouch = performance.now(); }
  addEventListener('pointerdown', touched, { passive: true });
  addEventListener('pointermove', touched, { passive: true });
  addEventListener('keydown', touched);
  function whisper(now) {
    if (now - lastTouch < IDLE || now - lastWhisper < IDLE) return;
    const free = sparks.filter(s => !s.absorbed && !s.flying);
    if (!free.length) return;
    const s = free[Math.floor(Math.random() * free.length)];
    s.whisper = true;
    lastWhisper = now;
    setTimeout(() => { s.whisper = false; }, WHISPER);
  }

  /* motion loop */
  let mode = 'drift';
  let last = performance.now();
  let t = 0;
  function step(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now; t += dt;
    const w = G.w, h = G.h, m = G.mark, R = G.R;
    /* a circle, or a tall ellipse on a narrow screen */
    const wide = 1, tall = w > h ? 1 : 1.25;
    const fade = 1 - Math.exp(-dt * 12);
    const left = w * .12, top = h * .12, bottom = h * .88;

    if (night) updateLight();
    whisper(now);
    for (const s of sparks) {
      /* light on this spark, 0 to 1 */
      s.lit = night && !s.absorbed ? Math.min(1, litAt(s.x, s.y) * 1.6) : 0;
      /* in the light the text reads in full, with a short ramp at the edge */
      const read = Math.max(0, Math.min(1, (s.lit - .1) / .2));
      const wantLabel = (s.hover || s.focused || s.whisper || mode === 'gather' || s.peek > 0) ? 1 : read;
      s.alpha += (wantLabel - s.alpha) * fade;
      s.vis += ((s.absorbed ? 0 : 1) - s.vis) * fade;
      if (s.absorbed || s.flying || s.focused || s.peek > 0 || s.dragging) continue;

      let ax = 0, ay = 0;
      if (mode === 'gather') {
        /* orbit flow field */
        const ex = (s.x - m.x) / wide, ey = (s.y - m.y) / tall;
        const dist = Math.hypot(ex, ey) || 1;
        const ux = ex / dist, uy = ey / dist;
        const r = R * (1 + .07 * Math.sin(t * .3 + s.rphase));
        const slot = s.orbit + t * s.omega;
        let err = slot - Math.atan2(ey, ex);
        err = Math.atan2(Math.sin(err), Math.cos(err));
        /* desired velocity: inward or outward to the ring, plus along the ring */
        const vr = Math.max(-90, Math.min(90, (r - dist) * RADIAL));
        const vt = s.omega * r + Math.max(-60, Math.min(60, err * ANGULAR));
        const dvx = (ux * vr - uy * vt) * wide, dvy = (uy * vr + ux * vt) * tall;
        const ramp = Math.min(1, (t - s.gatherAt) / 1.4);
        const gain = FOLLOW * (.25 + .75 * ramp * ramp);
        ax += (dvx - s.vx) * gain;
        ay += (dvy - s.vy) * gain;
        /* a little wander stays */
        ax += WANDER * .35 * Math.sin(t * s.f1 + s.p1);
        ay += WANDER * .35 * Math.sin(t * s.f1 * 1.3 + s.p3);
        if (s.x > s.maxX) ax -= (s.x - s.maxX) * WALL;
        repel(s, (x, y) => { ax += x; ay += y; }, 1);
      } else {
        if (reduce) continue;
        /* sine wander */
        ax += WANDER * (Math.sin(t * s.f1 + s.p1) + .5 * Math.sin(t * s.f2 + s.p2));
        ay += WANDER * (Math.sin(t * s.f1 * 1.3 + s.p3) + .5 * Math.sin(t * s.f2 * .8 + s.p4));
        /* soft walls */
        if (s.x < left) ax += (left - s.x) * WALL;
        if (s.x > s.maxX) ax -= (s.x - s.maxX) * WALL;
        if (s.y < top) ay += (top - s.y) * WALL;
        if (s.y > bottom) ay -= (s.y - bottom) * WALL;
        /* mark halo */
        const hx = (s.x - m.x) / (m.w / 2 + 40), hy = (s.y - m.y) / (m.h / 2 + 40);
        const hd = Math.hypot(hx, hy);
        if (hd < 1) { const f = (1 - hd) * 60; ax += (hx / (hd || 1)) * f; ay += (hy / (hd || 1)) * f; }
        repel(s, (x, y) => { ax += x; ay += y; }, 1);
        ax -= s.vx * DAMP; ay -= s.vy * DAMP;
      }
      s.vx += ax * dt; s.vy += ay * dt;
      const sp = Math.hypot(s.vx, s.vy);
      const cap = mode === 'gather' ? MAXV * 5 : MAXV;
      if (sp > cap) { s.vx *= cap / sp; s.vy *= cap / sp; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      /* hard clamp */
      s.x = Math.min(w - PAD, Math.max(PAD, s.x));
      s.y = Math.min(h - PAD, Math.max(PAD, s.y));
    }
    draw();
    requestAnimationFrame(step);
  }

  /* the light on the ground */
  function drawLight() {
    const L = LIGHT;
    const far = lightAt(L.reach);
    const g = ctx.createLinearGradient(0, L.y, 0, L.y + L.reach);
    g.addColorStop(0, 'rgba(255,255,255,' + (.22 * L.power) + ')');
    g.addColorStop(.35, 'rgba(255,255,255,' + (.1 * L.power) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    /* soft edges: nested shapes, each a little wider and fainter */
    for (let i = 0; i < 4; i++) {
      const e = 1 + i * .12;
      ctx.globalAlpha = 1 - i * .22;
      ctx.beginPath();
      ctx.moveTo(L.x - L.w / 2 * e, L.y);
      ctx.lineTo(L.x + L.w / 2 * e, L.y);
      ctx.lineTo(far.cx + far.hw * e, L.y + L.reach);
      ctx.lineTo(far.cx - far.hw * e, L.y + L.reach);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, G.w, G.h);
    if (night) drawLight();
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const q = 1 / G.dpr;
    const now = performance.now();
    for (const s of sparks) {
      /* flight trail */
      if (s.trail.length) {
        for (let i = s.trail.length - 1; i >= 0; i--) {
          const p = s.trail[i], age = (now - p.t) / 420;
          if (age >= 1) { s.trail.splice(0, i + 1); break; }
          ctx.globalAlpha = (1 - age) * .9;
          ctx.fillRect(Math.round((p.x - PX / 2) / q) * q, Math.round((p.y - PX / 2) / q) * q, PX, PX);
        }
      }
      if (s.vis < .01) continue;
      let glow = 1;
      if (night) {
        /* firefly glow */
        glow = (.55 + .45 * Math.sin(now / 1000 * (1.5 + s.f2 * 4) + s.p2)) * (.7 + .6 * s.lit);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 12);
        g.addColorStop(0, 'rgba(255,255,255,' + (.45 * glow * s.vis) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(s.x - 12, s.y - 12, 24, 24);
        ctx.fillStyle = INK;
      }
      ctx.globalAlpha = s.vis * (night ? .6 + .4 * glow : 1);
      /* snapped pixel, hollow for a control */
      const px = Math.round((s.x - PX / 2) / q) * q, py = Math.round((s.y - PX / 2) / q) * q;
      ctx.fillRect(px, py, PX, PX);
      if (s.node.control) ctx.clearRect(px + q, py + q, PX - 2 * q, PX - 2 * q);
      ctx.globalAlpha = s.vis;
      if (s.alpha < .01) continue;
      ctx.globalAlpha = s.vis * s.alpha;
      const lx = s.x + 10;
      ctx.font = LABEL;
      ctx.fillText(s.node.label, lx, s.y);
      if (s.peek > .01 && s.peekLine) {
        ctx.globalAlpha = s.vis * s.alpha * s.peek;
        ctx.font = PEEK;
        ctx.fillText(clip(s.peekLine, Math.min(300, G.w - lx - PAD)), lx, s.y + 22);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ellipsis clip */
  const clipCache = new Map();
  function clip(text, max) {
    const key = text + '|' + Math.round(max);
    if (clipCache.has(key)) return clipCache.get(key);
    let out = text;
    if (ctx.measureText(out).width > max) {
      while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1);
      out = out.trimEnd() + '…';
    }
    clipCache.set(key, out);
    return out;
  }

  requestAnimationFrame(step);

  /* curved flight */
  const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  function fly(s, to, ms, easing, done) {
    if (reduce) { s.x = to.x; s.y = to.y; done(); return; }
    const x0 = s.x, y0 = s.y, t0 = performance.now();
    const dx = to.x - x0, dy = to.y - y0, d = Math.hypot(dx, dy) || 1;
    const side = Math.random() < .5 ? -1 : 1;
    const bend = side * Math.min(140, d * .35) * (.6 + Math.random() * .8);
    const cx = x0 + dx * .5 - dy / d * bend, cy = y0 + dy * .5 + dx / d * bend;
    let lastTrail = 0;
    s.flying = true;
    (function frame(now) {
      const k = Math.min(1, (now - t0) / ms);
      const e = easing(k), u = 1 - e;
      const nx = u * u * x0 + 2 * u * e * cx + e * e * to.x;
      const ny = u * u * y0 + 2 * u * e * cy + e * e * to.y;
      if (now - lastTrail > 14) { s.trail.push({ x: s.x, y: s.y, t: now }); lastTrail = now; }
      /* carry velocity */
      s.vx = (nx - s.x) * 60 * .35; s.vy = (ny - s.y) * 60 * .35;
      s.x = nx; s.y = ny;
      if (k < 1) requestAnimationFrame(frame); else { s.flying = false; done(); }
    })(t0);
  }

  /* fly into box */
  function absorb(s) {
    if (s.absorbed || s.flying) return false;
    if (mode === 'gather') gather(false, true);
    s.hover = false; s.peek = 0;
    s.button.blur();
    /* a tap flies as before, a drop slides in */
    const d = Math.hypot(G.box.x - s.x, G.box.y - s.y);
    const dropped = d < 80;
    fly(s, G.box, dropped ? 260 : 680, dropped ? easeOut : easeInOut, () => {
      s.absorbed = true;
      s.vx = 0; s.vy = 0;
      on.land && on.land(s);
    });
    return true;
  }

  /* fly out of box */
  function emit(s) {
    s.x = G.box.x; s.y = G.box.y;
    s.absorbed = false;
    const a = Math.random() * Math.PI * 2;
    const r = 150 + Math.random() * 90;
    const to = {
      x: Math.min(s.maxX, Math.max(G.w * .12, G.box.x + Math.cos(a) * r)),
      y: Math.min(G.h * .88, Math.max(G.h * .12, G.box.y + Math.sin(a) * r))
    };
    fly(s, to, 900, easeOut, () => {});
  }

  /* nearest orbit slots */
  function assignOrbits() {
    const free = sparks.filter(s => !s.absorbed);
    if (!free.length) return;
    const m = G.mark;
    const TAU = Math.PI * 2;
    const withAngle = free.map(s => ({ s, a: Math.atan2((s.y - m.y) / (G.w > G.h ? 1 : 1.25), s.x - m.x) }))
      .sort((p, q) => p.a - q.a);
    const gap = TAU / withAngle.length;
    /* circular mean offset */
    let sx = 0, sy = 0;
    withAngle.forEach((p, i) => { const d = p.a - i * gap; sx += Math.cos(d); sy += Math.sin(d); });
    const offset = Math.atan2(sy, sx);
    withAngle.forEach((p, i) => {
      /* cancel elapsed time */
      p.s.orbit = offset + i * gap - t * p.s.omega;
      p.s.gatherAt = t;
    });
  }

  /* the first gather holds a few seconds so the words can be read */
  let gatherSince = 0, firstGather = true, scatterTimer = null;
  function gather(onOff, quiet) {
    const next = onOff ? 'gather' : 'drift';
    if (next === mode) return;
    if (next === 'drift' && firstGather) {
      const wait = 4000 - (performance.now() - gatherSince);
      if (wait > 0) { clearTimeout(scatterTimer); scatterTimer = setTimeout(() => gather(false, quiet), wait); return; }
      firstGather = false;
    }
    mode = next;
    if (mode === 'gather') { assignOrbits(); gatherSince = performance.now(); if (firstGather && remember('tao.gathered')) firstGather = false; }
    if (mode === 'drift') for (const s of sparks) if (!s.absorbed) nudge(s);
    if (!quiet && on.gather) on.gather(mode === 'gather');
  }

  /* pointer */
  function hit(x, y) {
    let best = null, bd = Infinity;
    for (const s of sparks) {
      if (s.absorbed || s.flying) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < HIT && d < bd) { best = s; bd = d; }
      /* label hit */
      if (s.alpha > .2 && x >= s.x + 6 && x <= s.x + 14 + s.labelW && Math.abs(y - s.y) <= 13) {
        const dl = Math.abs(y - s.y);
        if (dl < bd) { best = s; bd = dl; }
      }
    }
    return best;
  }
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  let pressed = null, pressTimer = null, peeked = false;
  let drag = null, dragFrom = null, dragLast = null;
  const DRAG_START = 7;
  function startDrag(s, p) {
    drag = s; s.dragging = true; s.hover = true; s.peek = 0;
    clearTimeout(pressTimer); peeked = false;
    dragLast = { x: p.x, y: p.y, t: performance.now() };
    s.vx = 0; s.vy = 0;
    canvas.classList.add('drag');
  }
  const nearBox = p => inside(p, { x: G.box.x, y: G.box.y, w: G.box.w + 60, h: G.box.h + 60 });
  function moveDrag(p) {
    const now = performance.now();
    const dt = Math.max(.008, (now - dragLast.t) / 1000);
    drag.vx = drag.vx * .6 + ((p.x - dragLast.x) / dt) * .4;
    drag.vy = drag.vy * .6 + ((p.y - dragLast.y) / dt) * .4;
    let x = Math.min(G.w - PAD, Math.max(PAD, p.x));
    let y = Math.min(G.h - PAD, Math.max(PAD, p.y));
    /* near the box the spark is drawn toward its center */
    const near = nearBox(p);
    if (near) {
      const b = G.box;
      const kx = 1 - Math.min(1, Math.abs(p.x - b.x) / (b.w / 2 + 60));
      const ky = 1 - Math.min(1, Math.abs(p.y - b.y) / (b.h / 2 + 60));
      const k = Math.min(kx, ky) * .8;
      x += (b.x - x) * k; y += (b.y - y) * k;
    }
    box.classList.toggle('ready', near);
    drag.x = x; drag.y = y;
    dragLast = { x: p.x, y: p.y, t: now };
  }
  function endDrag(p) {
    const s = drag; drag = null;
    s.dragging = false;
    canvas.classList.remove('drag');
    box.classList.remove('ready');
    if (coarse) s.hover = false;
    /* dropped into the box */
    if (nearBox(p)) {
      s.vx = 0; s.vy = 0;
      pick(s);
      return;
    }
    /* a throw, capped */
    const sp = Math.hypot(s.vx, s.vy), cap = MAXV * 8;
    if (sp > cap) { s.vx *= cap / sp; s.vy *= cap / sp; }
  }
  const fingers = new Map();
  let pinchStart = null, pinching = false;
  const fingerDist = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  canvas.addEventListener('pointermove', e => {
    const p = pos(e);
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, p);
    if (pinching && fingers.size === 2 && pinchStart !== null) {
      const d = fingerDist() - pinchStart;
      if (d < -50 && mode !== 'gather') { if (on.pinch ? on.pinch(true) !== false : true) gather(true); pinchStart = null; }
      else if (d > 50 && mode === 'gather') { gather(false); pinchStart = null; }
      return;
    }
    if (drag) { moveDrag(p); return; }
    if (pressed && dragFrom && Math.hypot(p.x - dragFrom.x, p.y - dragFrom.y) > DRAG_START && !peeked) {
      startDrag(pressed, p); pressed = null; return;
    }
    const s = hit(p.x, p.y);
    let changed = false;
    for (const q of sparks) { const h = q === s; if (h && !q.hover) changed = true; q.hover = h; }
    if (changed && on.hover) on.hover(s);
    canvas.classList.toggle('hot', !!s);
  });
  canvas.addEventListener('pointerleave', () => { for (const q of sparks) q.hover = false; canvas.classList.remove('hot'); });
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = pos(e);
    if (e.pointerType === 'touch') {
      fingers.set(e.pointerId, p);
      if (fingers.size === 2) {
        if (drag) { drag.dragging = false; drag.hover = false; drag = null; canvas.classList.remove('drag'); }
        pinching = true; pinchStart = fingerDist();
        clearTimeout(pressTimer);
        if (pressed) { pressed.peek = 0; pressed.hover = false; }
        pressed = null;
        return;
      }
    }
    pressed = hit(p.x, p.y);
    dragFrom = p;
    peeked = false;
    clearTimeout(pressTimer);
    if (pressed) { try { canvas.setPointerCapture(e.pointerId); } catch {} }
    if (pressed) {
      pressed.hover = true;
      pressTimer = setTimeout(() => { peeked = true; pressed.peek = 1; }, 420);
    }
  });
  function endPress(e) {
    clearTimeout(pressTimer);
    if (fingers.has(e.pointerId)) fingers.delete(e.pointerId);
    if (drag) { endDrag(pos(e)); pressed = null; return; }
    if (pinching) { if (fingers.size === 0) pinching = false; pressed = null; return; }
    const s = pressed; pressed = null;
    if (!s) {
      if (e.type !== 'pointerup') return;
      const p = pos(e);
      const dx = dragFrom ? p.x - dragFrom.x : 0;
      /* a swipe on the void turns the page, a tap lets go */
      if (Math.abs(dx) > 40) { on.swipe && on.swipe(dx < 0 ? 1 : -1); return; }
      on.empty && on.empty();
      return;
    }
    s.peek = 0;
    if (coarse) s.hover = false;
    if (!peeked && e.type === 'pointerup') pick(s);
    peeked = false;
  }
  canvas.addEventListener('pointerup', endPress);
  canvas.addEventListener('pointercancel', endPress);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  addEventListener('resize', () => {
    measure();
    bounds();
    clipCache.clear();
    for (const s of sparks) { s.x = Math.min(s.maxX, Math.max(G.w * .12, s.x)); s.y = Math.min(G.h * .88, Math.max(G.h * .12, s.y)); }
  });

  return {
    sparks,
    byId: id => sparks.find(s => s.node.id === id) || null,
    absorb, emit, gather, setTheme, measure,
    get gathered() { return mode === 'gather'; }
  };
}
