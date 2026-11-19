/* canvas sparks */

export function createSparks({ canvas, field, mark, box, reader, buttons, tree, pen = null, on = {} }) {
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
  const EDGE = 8;                     /* least distance from a side edge */
  const BREATH = .07;                 /* how much the ring radius changes */
  const TURN = .085;                  /* ring speed when all sparks share one */

  const family = getComputedStyle(document.documentElement).getPropertyValue('--serif');
  /* a pen, if there is one, gives its own fonts and draws the words and the dots */
  const LABEL = pen ? pen.label : '400 18.4px ' + family;
  const PEEK = pen ? pen.peek : '400 14px ' + family;

  /* geometry cache */
  const G = { w: 0, h: 0, dpr: 1, mark: null, seed: null, box: null, ink: [], cx: 0, cy: 0, rx: 0, ry: 0, breath: BREATH, even: false };
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
      for (const el of [...page.querySelectorAll('span, a, p, small'), ...reader.querySelectorAll('.pips')]) {
        const c = el.getBoundingClientRect();
        if (!c.width) continue;
        r = Math.max(r, c.right); tp = Math.min(tp, c.top); bt = Math.max(bt, c.bottom);
      }
    }
    return { x: (l + r) / 2 - f.left, y: (tp + bt) / 2 - f.top, w: r - l + pad, h: bt - tp + pad };
  }
  /* the ink of the mark: the box, and the text that shows. a line of text is a block as wide
     as the reader, so the text nodes give the true width */
  function ink() {
    const f = field.getBoundingClientRect();
    const b = box.getBoundingClientRect(), rd = reader.getBoundingClientRect();
    const out = [{ x1: b.left - f.left, y1: b.top - f.top, x2: b.right - f.left, y2: b.bottom - f.top }];
    let l = Infinity, tp = Infinity, r = -Infinity, bt = -Infinity;
    const grow = c => {
      if (!c.width || !c.height) return;
      l = Math.min(l, c.left); r = Math.max(r, c.right);
      tp = Math.min(tp, Math.max(c.top, rd.top)); bt = Math.max(bt, Math.min(c.bottom, rd.bottom));
    };
    const range = document.createRange();
    for (const page of reader.querySelectorAll('.page')) {
      const walk = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        range.selectNodeContents(walk.currentNode);
        for (const c of range.getClientRects()) grow(c);
      }
    }
    for (const el of reader.querySelectorAll('.pips')) grow(el.getBoundingClientRect());
    if (r > l && bt > tp) out.push({ x1: l - f.left, y1: tp - f.top, x2: r - f.left, y2: bt - f.top });
    return out;
  }
  /* ring shape. the center is the middle of the ink, not the middle of the screen: the reader
     keeps empty room at its right. a circle on a wide screen, a tall ellipse on a narrow one */
  function ring() {
    /* the ring keeps its shape while a section is open. it follows the tagline only */
    if (G.rx && reader.classList.contains('reading')) return;
    G.ink = ink();
    const x1 = Math.min(...G.ink.map(r => r.x1)), x2 = Math.max(...G.ink.map(r => r.x2));
    const y1 = Math.min(...G.ink.map(r => r.y1)), y2 = Math.max(...G.ink.map(r => r.y2));
    G.cx = (x1 + x2) / 2; G.cy = (y1 + y2) / 2;
    const half = (x2 - x1) / 2;
    const near = Math.min(G.cx, G.w - G.cx);
    const base = Math.min(G.w, G.h) * .38;
    let breath = BREATH;
    /* the ring stays on the screen at the near side */
    let rx = Math.min(base, (near - 18) / (1 + breath));
    G.even = rx * (1 - breath) < half + 12;
    if (G.even) {
      /* no room for that. the ring goes through the middle of the gap between the mark and
         the screen edge, and its radius changes less. the sparks keep one speed, because
         one spark cannot go past another there */
      const gap = Math.max(0, Math.min(80, near - half));
      rx = half + gap / 2;
      breath = rx ? Math.max(0, Math.min(BREATH, (gap / 2 - EDGE - 1) / rx)) : 0;
    }
    G.rx = rx;
    G.ry = G.w > G.h ? base : Math.min(G.h * .38, rx * 1.8);
    G.breath = breath;
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
    ring();
  }
  const inside = (p, r) => Math.abs(p.x - r.x) < r.w / 2 && Math.abs(p.y - r.y) < r.h / 2;

  /* spark records */
  const sparks = tree.map((node, i) => {
    const s = {
      node, id: i, x: 0, y: 0, vx: 0, vy: 0,
      absorbed: false, flying: false,
      alpha: 0, vis: 1, peek: 0, hover: false, focused: false,
      peekLine: node.children && node.children[0] ? node.children[0].label : '',
      labelW: 0, maxX: 0, side: 0, flip: 0, loop: 0,
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
    if (pen) pen.warm(sparks.map(s => s.node.label), LABEL, INK);
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
    LIGHT.power = .7 + .3 * Math.sin(t * .13 + .6) * Math.sin(t * .05 + 2);
  }
  /* center and half width of the light at a depth below the sill */
  function lightAt(dy) {
    const k = Math.max(0, Math.min(1, dy / LIGHT.reach));
    return { cx: LIGHT.x + LIGHT.shift * k, hw: LIGHT.w / 2 * (1 + (LIGHT.widen - 1) * k), k };
  }
  /* how much window light reaches a point, 0 to 1 */
  function litAt(x, y) {
    const dy = y - LIGHT.y;
    if (dy < 0) return { glow: 0, inside: 0 };
    const { cx, hw, k } = lightAt(dy);
    const across = 1 - Math.min(1, Math.abs(x - cx) / (hw * 1.15));
    const along = 1 - k * .8;
    /* inside: 1 well within the shape, 0 at its edge. glow: how bright the light is there */
    return { glow: LIGHT.power * across * across * along, inside: Math.max(0, Math.min(1, (across - .12) / .3)) };
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
      /* a limit on the tries. a field with no size has no free place */
      let p, tries = 0;
      do {
        p = { x: G.w * .12 + Math.random() * (s.maxX - G.w * .12), y: G.h * (.12 + Math.random() * .76) };
      } while (inside(p, G.seed) && ++tries < 200);
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

  /* label place. side 0 is right of the dot, side 1 is left of it */
  function labelX(s, side) { return side ? s.x - 10 - s.labelW : s.x + 10; }
  /* true if the label has room on that side: on the screen, and clear of the ink */
  function fits(s, side, spare) {
    const x1 = labelX(s, side), x2 = x1 + s.labelW;
    if (x1 < 12 + spare || x2 > G.w - 12 - spare) return false;
    for (const m of G.ink) {
      if (x1 < m.x2 + 8 + spare && x2 > m.x1 - 8 - spare && s.y - 13 < m.y2 + 6 && s.y + 13 > m.y1 - 6) return false;
    }
    return true;
  }

  /* label box */
  function rectFor(s) {
    const shown = s.alpha > .15;
    const w = shown ? 14 + s.labelW : PX, h = shown ? LABEL_H : PX;
    if (shown && s.side) return { x1: s.x - w, x2: s.x + PX, y1: s.y - h / 2, y2: s.y + h / 2 };
    return { x1: s.x - PX, x2: s.x + w, y1: s.y - h / 2, y2: s.y + h / 2 };
  }
  /* push apart overlapping boxes */
  function repel(s, add, scale, solid = true) {
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
    if (!solid) return;
    const m = G.mark;
    push({ x1: m.x - m.w / 2, x2: m.x + m.w / 2, y1: m.y - m.h / 2, y2: m.y + m.h / 2 }, scale * 1.5);
  }

  /* on load, about flickers in like a tube warming up, holds, then goes out */
  function remember(key) {
    try { if (localStorage.getItem(key)) return true; localStorage.setItem(key, '1'); return false; } catch { return true; }
  }
  const about = sparks.find(s => s.node.id === 'about');
  if (about) {
    const flicks = [0, 140, 260, 460, 560, 760, 880, 960, 1200];
    setTimeout(() => {
      flicks.forEach((ms, i) => setTimeout(() => { about.whisper = i % 2 === 0; }, ms));
      setTimeout(() => { about.whisper = true; }, 1300);
      setTimeout(() => { about.whisper = false; }, 4200);
    }, 1200);
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
    const w = G.w, h = G.h, m = G.mark;
    /* the ring is a circle of radius R, made narrower by the wide ratio */
    const R = G.ry || 1, wide = G.rx / R || 1;
    const fade = 1 - Math.exp(-dt * 12);
    /* label fades: in over about a fifth of a second, out over about half a second */
    const fadeIn = 1 - Math.exp(-dt * 6), fadeOut = 1 - Math.exp(-dt * 2.2);
    const left = w * .12, top = h * .12, bottom = h * .88;

    if (night) updateLight();
    whisper(now);
    for (const s of sparks) {
      /* light on this spark. inside the shape the text reads in full */
      let read = 0;
      if (night && !s.absorbed) {
        const L = litAt(s.x, s.y);
        s.lit = Math.min(1, L.glow * 1.6);
        read = L.inside;
      } else s.lit = 0;
      /* in the ring a label goes to the side that has room. the right side is first.
         if no side has room, the label hides */
      let room = 1;
      if (mode === 'gather' && !s.absorbed) {
        if (fits(s, 0, s.side ? 20 : 0)) s.side = 0;
        else if (fits(s, 1, 0)) s.side = 1;
        else room = 0;
      } else if (s.alpha < .02) s.side = 0;
      s.flip += (s.side - s.flip) * fadeIn;
      /* how much of the pen loop around the label is drawn */
      s.loop += (((s.hover || s.focused) && !s.dragging ? 1 : 0) - s.loop) * (1 - Math.exp(-dt * 9));
      const asked = s.hover || s.focused || s.whisper || s.peek > 0;
      const wantLabel = asked ? 1 : mode === 'gather' ? room : read;
      /* labels appear quickly and fade slowly */
      s.alpha += (wantLabel - s.alpha) * (wantLabel > s.alpha ? fadeIn : fadeOut);
      s.vis += ((s.absorbed ? 0 : 1) - s.vis) * fade;
      if (s.absorbed || s.flying || s.focused || s.peek > 0 || s.dragging) continue;

      let ax = 0, ay = 0;
      if (mode === 'gather') {
        /* orbit flow field */
        const ex = (s.x - G.cx) / wide, ey = s.y - G.cy;
        const dist = Math.hypot(ex, ey) || 1;
        const ux = ex / dist, uy = ey / dist;
        const r = R * (1 + G.breath * Math.sin(t * .3 + s.rphase));
        const turn = G.even ? TURN : s.omega;
        const slot = s.orbit + t * turn;
        let err = slot - Math.atan2(ey, ex);
        err = Math.atan2(Math.sin(err), Math.cos(err));
        /* desired velocity: inward or outward to the ring, plus along the ring */
        const vr = Math.max(-90, Math.min(90, (r - dist) * RADIAL));
        const vt = turn * r + Math.max(-60, Math.min(60, err * ANGULAR));
        const dvx = (ux * vr - uy * vt) * wide, dvy = uy * vr + ux * vt;
        const ramp = Math.min(1, (t - s.gatherAt) / 1.4);
        const gain = FOLLOW * (.25 + .75 * ramp * ramp);
        ax += (dvx - s.vx) * gain;
        ay += (dvy - s.vy) * gain;
        /* a little wander stays */
        ax += WANDER * .35 * Math.sin(t * s.f1 + s.p1);
        ay += WANDER * .35 * Math.sin(t * s.f1 * 1.3 + s.p3);
        /* the ring is clear of the mark. only the other sparks push */
        repel(s, (x, y) => { ax += x; ay += y; }, 1, false);
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
      s.x = Math.min(w - EDGE, Math.max(EDGE, s.x));
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

  function word(text, font, x, y) {
    if (pen) pen.word(ctx, text, font, x, y, INK);
    else { ctx.font = font; ctx.fillText(text, x, y); }
  }

  function draw() {
    ctx.clearRect(0, 0, G.w, G.h);
    if (night) { if (pen) pen.light(ctx, LIGHT, lightAt, G.box); else drawLight(); }
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const q = 1 / G.dpr;
    const now = performance.now();
    for (const s of sparks) {
      /* flight trail. a pen draws it as one line */
      if (pen) pen.trail(ctx, s, INK, now);
      else if (s.trail.length) {
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
      if (pen) pen.dot(ctx, s.x, s.y, PX, !!s.node.control, INK, s.id);
      else {
        ctx.fillRect(px, py, PX, PX);
        if (s.node.control) ctx.clearRect(px + q, py + q, PX - 2 * q, PX - 2 * q);
      }
      ctx.globalAlpha = s.vis;
      if (s.alpha < .01) continue;
      /* the label fades from one side to the other */
      const lx = labelX(s, s.side);
      ctx.font = LABEL;
      if (s.flip < .99) { ctx.globalAlpha = s.vis * s.alpha * (1 - s.flip); word(s.node.label, LABEL, labelX(s, 0), s.y); }
      if (s.flip > .01) { ctx.globalAlpha = s.vis * s.alpha * s.flip; word(s.node.label, LABEL, labelX(s, 1), s.y); }
      if (s.peek > .01 && s.peekLine) {
        ctx.globalAlpha = s.vis * s.alpha * s.peek;
        ctx.font = PEEK;
        word(clip(s.peekLine, Math.min(300, G.w - lx - PAD)), PEEK, lx, s.y + 22);
      }
      /* a loop around a label under the pointer */
      ctx.globalAlpha = s.vis;
      if (pen && s.loop > .03) pen.loop(ctx, Math.min(s.x - 4, lx - 2), Math.max(s.x + 4, lx + s.labelW + 2), s.y, s.loop, INK, s.id);
    }
    ctx.globalAlpha = 1;
    if (pen) pen.dust(ctx, INK, now);
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
  /* curve is how much the path bends, as a part of its length. carry is the speed that the
     spark keeps at the end, along the path, so that it goes on into its drift */
  function fly(s, to, ms, easing, done, curve = .35, carry = 0) {
    if (reduce) { s.x = to.x; s.y = to.y; done(); return; }
    const x0 = s.x, y0 = s.y, t0 = performance.now();
    const dx = to.x - x0, dy = to.y - y0, d = Math.hypot(dx, dy) || 1;
    const side = Math.random() < .5 ? -1 : 1;
    const bend = side * Math.min(400 * curve, d * curve) * (.6 + Math.random() * .8);
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
      if (k < 1) { requestAnimationFrame(frame); return; }
      if (carry) {
        const tx = to.x - cx, ty = to.y - cy, tl = Math.hypot(tx, ty) || 1;
        s.vx = tx / tl * carry; s.vy = ty / tl * carry;
      }
      s.flying = false;
      done();
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
      /* chalk dust falls from the box at night */
      if (pen && night) pen.puff(G.box.x, G.box.y + G.box.h / 2);
      on.land && on.land(s);
    });
    return true;
  }

  /* fly out of box. the spark goes to a free place out of the mark, so nothing pushes it when
     it gets there. some directions are tried, and the one with the most room is used */
  const easeOutSoft = k => { const a = k * k * (3 - 2 * k); return 1 - (1 - a) * (1 - a); };
  function emit(s) {
    const bx = G.box.x, by = G.box.y;
    s.x = bx; s.y = by;
    s.absorbed = false;
    const m = G.mark, hw = m.w / 2 + 16, hh = m.h / 2 + 16;
    const x1 = G.w * .12, x2 = Math.max(x1, s.maxX), y1 = G.h * .12, y2 = G.h * .88;
    let to = null, best = -Infinity;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      /* how far the mark goes in this direction, from the box */
      const ex = ux > 0 ? (m.x + hw - bx) / ux : ux < 0 ? (m.x - hw - bx) / ux : Infinity;
      const ey = uy > 0 ? (m.y + hh - by) / uy : uy < 0 ? (m.y - hh - by) / uy : Infinity;
      const r = Math.min(ex, ey) + 24 + Math.random() * 60;
      const p = { x: Math.min(x2, Math.max(x1, bx + ux * r)), y: Math.min(y2, Math.max(y1, by + uy * r)) };
      /* room: the distance out of the mark, and the distance from the other sparks. a short way is better */
      let room = Math.min(40, Math.max(Math.abs(p.x - m.x) - hw, Math.abs(p.y - m.y) - hh));
      for (const o of sparks) if (o !== s && !o.absorbed) room = Math.min(room, Math.hypot(o.x - p.x, o.y - p.y) - 50);
      const score = room - Math.hypot(p.x - bx, p.y - by) * .08;
      if (score > best) { best = score; to = p; }
    }
    const d = Math.hypot(to.x - bx, to.y - by);
    /* a soft start, a long slow end, and a path with little bend */
    fly(s, to, 700 + d * 1.3, easeOutSoft, () => {}, .12, 9);
  }

  /* nearest orbit slots */
  function assignOrbits() {
    const free = sparks.filter(s => !s.absorbed);
    if (!free.length) return;
    const wide = G.rx / (G.ry || 1) || 1;
    const TAU = Math.PI * 2;
    const withAngle = free.map(s => ({ s, a: Math.atan2(s.y - G.cy, (s.x - G.cx) / wide) }))
      .sort((p, q) => p.a - q.a);
    const gap = TAU / withAngle.length;
    /* circular mean offset */
    let sx = 0, sy = 0;
    withAngle.forEach((p, i) => { const d = p.a - i * gap; sx += Math.cos(d); sy += Math.sin(d); });
    const offset = Math.atan2(sy, sx);
    withAngle.forEach((p, i) => {
      /* cancel elapsed time */
      p.s.orbit = offset + i * gap - t * (G.even ? TURN : p.s.omega);
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
      const lx = labelX(s, s.side);
      if (s.alpha > .2 && x >= lx - 4 && x <= lx + s.labelW + 4 && Math.abs(y - s.y) <= 13) {
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
