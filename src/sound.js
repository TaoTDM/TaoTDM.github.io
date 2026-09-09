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

  function synth(name) {
    const p = PATCH[name];
    if (!p) return;
    const ac = audio();
    const gain = ac.createGain();
    gain.gain.value = VOLUME;
    gain.connect(ac.destination);
    let at = ac.currentTime;
    for (const [hz, len] of p.steps) {
      const osc = ac.createOscillator();
      osc.type = p.wave;
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + len);
      at += len;
    }
    /* fade tail */
    gain.gain.setValueAtTime(VOLUME, at - .01);
    gain.gain.linearRampToValueAtTime(0, at + .02);
  }

  function play(name) {
    if (!enabled) return;
    if (name === 'hover' && !hoverSounds) return;
    const file = files.get(name);
    if (file) {
      const a = file.cloneNode();
      a.volume = Math.min(1, VOLUME * 4);
      a.play().catch(() => {});
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
