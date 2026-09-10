/* sounds */

const VOLUME = .08;
const FILES = ['select', 'land', 'page', 'back', 'release', 'gather', 'scatter', 'hover'];

/* synth patches */
const PATCH = {
  select:  { wave: 'square', steps: [[660, .04], [990, .05]] },
  land:    { wave: 'square', steps: [[330, .03], [220, .06]] },
  page:    { wave: 'square', steps: [[1320, .02]] },
  back:    { wave: 'square', steps: [[990, .025]] },
  release: { wave: 'square', steps: [[880, .04], [440, .06]] },
  gather:  { wave: 'square', steps: [[523, .05], [659, .05], [784, .07]] },
  scatter: { wave: 'square', steps: [[784, .05], [659, .05], [523, .07]] },
  hover:   { wave: 'square', steps: [[1760, .012]] }
};

export function createSound({ storageKey = 'tao.sound', hoverSounds = false } = {}) {
  let ctx = null;
  let enabled = read();
  const files = new Map();

  /* probe sfx files */
  for (const name of FILES) {
    for (const ext of ['wav', 'mp3', 'ogg']) {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { if (!files.has(name)) files.set(name, a); }, { once: true });
      a.addEventListener('error', () => {}, { once: true });
      a.src = '/sfx/' + name + '.' + ext;
    }
  }

  function read() {
    try { return localStorage.getItem(storageKey) !== 'off'; } catch { return true; }
  }
  function write() {
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch {}
  }

  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* every play builds its own nodes, so overlapping sounds never share or cut each other.
     each step has a tiny attack and release so it starts and ends without a click */
  function synth(name) {
    const p = PATCH[name];
    if (!p) return;
    const ac = audio();
    const out = ac.createGain();
    out.gain.value = 1;
    out.connect(ac.destination);
    let at = ac.currentTime + .005;
    const edge = .004;
    for (const [hz, len] of p.steps) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = p.wave;
      osc.frequency.value = hz;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(VOLUME, at + edge);
      g.gain.setValueAtTime(VOLUME, at + len - edge);
      g.gain.linearRampToValueAtTime(0, at + len);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + len + .01);
      osc.onended = () => { osc.disconnect(); g.disconnect(); };
      at += len;
    }
    /* the output node lets go once the last step is done */
    setTimeout(() => out.disconnect(), (at - ac.currentTime) * 1000 + 100);
  }

  /* file sounds are kept in a set until they end, so nothing is collected mid play */
  const playing = new Set();

  function play(name) {
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
    try { synth(name); } catch {}
  }

  function toggle(on = !enabled) {
    enabled = on;
    write();
    if (enabled) play('page');
    return enabled;
  }

  return { play, toggle, get enabled() { return enabled; } };
}
