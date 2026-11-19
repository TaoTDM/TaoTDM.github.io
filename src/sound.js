/* sounds */

const VOLUME = .08;
const FILES = ['select', 'land', 'page', 'back', 'release', 'gather', 'scatter', 'hover'];

const LEVEL = .5;       /* loudness of the built-in sounds */

/* built-in sounds, for when a file is not there. each one is one or more strokes on paper: noise through a band filter.
   len is the time of the stroke in seconds. from and to are the pitch of the filter at the
   start and at the end, in hz. a pencil has a high, narrow band. a brush has a low, wide band.
   wait is a pause before the stroke */
const PATCH = {
  select:  [{ len: .09, from: 2600, to: 4400, q: 1.4 }],                          /* a fast pencil line */
  land:    [{ len: .04, from: 1100, to: 600, q: .9, gain: 1.5 }],                 /* the pencil point comes down */
  page:    [{ len: .13, from: 900, to: 2200, q: .6, gain: .8 }],                  /* a brush goes across */
  back:    [{ len: .13, from: 2200, to: 900, q: .6, gain: .8 }],                  /* the brush comes back */
  release: [{ len: .06, from: 3400, to: 2500, q: 1.4 }, { len: .08, from: 2500, to: 3700, q: 1.4, wait: .03 }],  /* two short pencil lines */
  gather:  [{ len: .34, from: 700, to: 2400, q: .5, gain: .9 }],                  /* a long brush stroke, up */
  scatter: [{ len: .34, from: 2400, to: 700, q: .5, gain: .9 }],                  /* a long brush stroke, down */
  hover:   [{ len: .02, from: 5000, to: 5000, q: 2, gain: .6 }]                   /* a pencil point, light */
};

export function createSound({ storageKey = 'tao.sound', hoverSounds = false } = {}) {
  let ctx = null;
  let enabled = read();
  const files = new Map();

  /* sfx files. the build gives the list of the files in public/sfx. they load when the page
     has free time, so that they do not slow the first paint. until a file is in, its
     built-in sound plays. warm loads some files at once, for a sound that is needed early */
  const asked = new Set();
  const load = only => {
    for (const file of __SFX__) {
      const name = file.replace(/\.\w+$/, '');
      if (!FILES.includes(name) || asked.has(file) || (only && !only.includes(name))) continue;
      asked.add(file);
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { if (!files.has(name)) files.set(name, a); }, { once: true });
      a.addEventListener('error', () => {}, { once: true });
      a.src = '/sfx/' + file;
    }
  };
  if (window.requestIdleCallback) requestIdleCallback(() => load(), { timeout: 2000 }); else setTimeout(load, 400);
  const warm = names => load(names);

  function read() {
    try { return localStorage.getItem(storageKey) !== 'off'; } catch { return true; }
  }
  function write() {
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch {}
  }

  /* the context is made at once and woken on the first gesture, so the first sound is not late */
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  audio();
  const wake = () => { audio(); };
  addEventListener('pointerdown', wake, { passive: true });
  addEventListener('keydown', wake);
  addEventListener('touchstart', wake, { passive: true });

  /* the noise of a point on paper: white noise with grain. the grain is a slow, random change of
     the loudness, as the tooth of the paper gives. made one time */
  let paper = null;
  function paperOf(ac) {
    if (paper) return paper;
    const n = ac.sampleRate * 2;
    paper = ac.createBuffer(1, n, ac.sampleRate);
    const d = paper.getChannelData(0);
    const hop = Math.round(ac.sampleRate / 150);
    let g0 = Math.random(), g1 = Math.random();
    for (let i = 0; i < n; i++) {
      const k = i % hop;
      if (!k) { g0 = g1; g1 = Math.random(); }
      d[i] = (Math.random() * 2 - 1) * (.4 + .6 * (g0 + (g1 - g0) * k / hop));
    }
    return paper;
  }

  /* every play builds its own nodes, so overlapping sounds never share or cut each other.
     each stroke comes in fast and goes out slowly, so it starts and ends without a click */
  function synth(name) {
    const p = PATCH[name];
    if (!p) return;
    const ac = audio();
    if (!ac) return;
    /* if the context is still waking, schedule once it runs */
    if (ac.state !== 'running') { ac.resume().then(() => schedule(ac, p)).catch(() => {}); return; }
    schedule(ac, p);
  }
  function schedule(ac, strokes) {
    const out = ac.createGain();
    out.gain.value = 1;
    out.connect(ac.destination);
    let at = ac.currentTime + .005;
    for (const s of strokes) {
      at += s.wait || 0;
      const src = ac.createBufferSource();
      const band = ac.createBiquadFilter();
      const g = ac.createGain();
      src.buffer = paperOf(ac);
      band.type = 'bandpass';
      band.Q.value = s.q;
      band.frequency.setValueAtTime(s.from, at);
      band.frequency.exponentialRampToValueAtTime(s.to, at + s.len);
      const peak = LEVEL * (s.gain || 1);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + Math.min(.012, s.len * .3));
      g.gain.setValueAtTime(peak, at + s.len * .5);
      g.gain.linearRampToValueAtTime(0, at + s.len);
      src.connect(band);
      band.connect(g);
      g.connect(out);
      /* each stroke starts at a different place in the noise, so no two are the same */
      src.start(at, Math.random() * 1.5, s.len + .02);
      src.onended = () => { src.disconnect(); band.disconnect(); g.disconnect(); };
      at += s.len;
    }
    /* the output node lets go once the last stroke is done */
    setTimeout(() => out.disconnect(), (at - ac.currentTime) * 1000 + 100);
  }

  /* file sounds are kept in a set until they end, so nothing is collected mid play */
  const playing = new Set();

  /* fileOnly: play the file or nothing. this is for a sound before the first tap or key.
     the built-in sound cannot play then, and it would wait and play late */
  function play(name, fileOnly = false) {
    if (!enabled) return;
    if (name === 'hover' && !hoverSounds) return;
    const file = files.get(name);
    if (file) {
      const a = file.cloneNode();
      a.volume = Math.min(1, VOLUME * 4);
      playing.add(a);
      a.addEventListener('ended', () => playing.delete(a), { once: true });
      a.play().catch(() => playing.delete(a));
      return;
    }
    if (fileOnly) return;
    try { synth(name); } catch {}
  }

  function toggle(on = !enabled) {
    enabled = on;
    write();
    if (enabled) play('page');
    return enabled;
  }

  return { play, toggle, warm, get enabled() { return enabled; } };
}
