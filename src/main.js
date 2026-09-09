/* wiring */

import { TREE, SOUND_SPARK, EMAIL, NAME, TAGLINE } from './content.js';
import { createSparks } from './sparks.js';
import { createReader } from './reader.js';
import { createSound } from './sound.js';
import { buildPaper } from './paper.js';

const field = document.getElementById('void');
const canvas = document.getElementById('sky');
const mark = document.querySelector('.mark');
const box = document.getElementById('mark-box');
const readerEl = document.getElementById('reader');
const buttons = document.getElementById('sparks');
const toastEl = document.getElementById('toast');

/* toast */
let toastTimer;
function toast(word) {
  toastEl.textContent = word;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

const sound = createSound();

/* url hash state */
let silent = false;
function writeHash(h, push) {
  if (silent) return;
  const url = h ? '#' + h : location.pathname + location.search;
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
}

let held = null;       /* spark in box */
let pending = null;    /* spark in flight */

const reader = createReader({
  el: readerEl, email: EMAIL, onToast: toast,
  on: {
    read: (node, index) => {
      document.title = node.label + ' · tao';
      if (!pending?.quiet) writeHash(node.id + (index ? '/' + (index + 1) : ''), true);
      pending = null;
    },
    step: (node, index) => { sound.play('page'); writeHash(node.id + '/' + (index + 1), false); },
    release: () => {
      document.title = 'tao';
      writeHash('', false);
      sound.play('release');
      if (held) { sparks.emit(held); held = null; }
    }
  }
});

const sparks = createSparks({
  canvas, field, mark, box, buttons, tree: [...TREE, SOUND_SPARK],
  on: {
    select: s => select(s),
    action: s => { if (s.node.action === 'toggle-sound') toggleSound(); },
    land: s => {
      /* spark lands */
      box.classList.add('hot');
      setTimeout(() => box.classList.remove('hot'), 180);
      sound.play('land');
      const prev = held;
      held = s;
      if (prev && prev !== s) sparks.emit(prev);
      reader.read(s.node, pending ? pending.page : 0);
    },
    empty: () => { if (held) reader.release(); },
    gather: on => sound.play(on ? 'gather' : 'scatter'),
    pinch: () => !held,
    hover: s => { if (s) sound.play('hover'); }
  }
});

function select(s, page = 0, quiet = false) {
  if (sparks.absorb(s)) { pending = { page, quiet }; sound.play('select'); }
}

/* sound spark */
const soundSpark = sparks.byId(SOUND_SPARK.id);
sparks.setOff(soundSpark, !sound.enabled);
function toggleSound() {
  sparks.setOff(soundSpark, !sound.toggle());
}

/* box tap */
box.addEventListener('click', () => {
  if (reader.node) reader.next(); else sparks.gather(!sparks.gathered);
});

addEventListener('keydown', e => {
  if (e.key === 'Escape' && reader.node) reader.release();
  if (e.key === 'ArrowRight' && reader.node) reader.next();
  if (e.key === 'ArrowLeft' && reader.node) reader.prev();
  if (e.key === 'm' || e.key === 'M') toggleSound();
});

function applyHash() {
  const [id, n] = location.hash.replace(/^#/, '').split('/');
  const s = sparks.byId(id);
  const page = Math.max(0, (parseInt(n, 10) || 1) - 1);
  silent = true;
  try {
    if (!s) { if (reader.node) reader.release(); return; }
    if (held === s) { reader.go(page); return; }
    select(s, page, true);
  } finally { silent = false; }
}
addEventListener('hashchange', applyHash);
if (location.hash) applyHash();

buildPaper(document.getElementById('paper'), { name: NAME, tagline: TAGLINE, tree: TREE, email: EMAIL });
