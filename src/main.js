/* wiring */

import { TREE, SETTINGS, EMAIL, NAME, TAGLINE } from './content.js';
import { createSparks } from './sparks.js';
import { createReader } from './reader.js';
import { createSound } from './sound.js';
import { createTheme } from './theme.js';
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
const theme = createTheme();

/* settings pages */
function metaFor(item) {
  if (item.action === 'toggle-theme') return theme.night ? 'night' : 'day';
  if (item.action === 'toggle-sound') return sound.enabled ? 'on' : 'off';
  return null;
}
function doAction(item) {
  if (item.action === 'toggle-theme') { theme.toggle(); sparks.setTheme(theme.current);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(sparks.measure); sound.play('page'); }
  if (item.action === 'toggle-sound') sound.toggle();
}

/* url hash state */
let silent = false;
function writeHash(h, push) {
  if (silent) return;
  const url = h ? '#' + h : location.pathname + location.search;
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
}

let held = null;       /* spark in box */
let pending = null;    /* spark in flight */
let quietUntil = 0;    /* short guard after a landing */
const settled = () => performance.now() > quietUntil;

const reader = createReader({
  el: readerEl, email: EMAIL, onToast: toast, onAction: doAction, metaFor,
  on: {
    read: (node, index) => {
      setTimeout(sparks.measure, 220);
      document.title = node.label + ' · tao';
      if (!pending?.quiet) writeHash(node.id + (index ? '/' + (index + 1) : ''), true);
      pending = null;
    },
    step: (node, index, dir) => { setTimeout(sparks.measure, 220); sound.play(dir < 0 ? 'back' : 'page'); writeHash(node.id + '/' + (index + 1), false); },
    release: () => {
      setTimeout(sparks.measure, 220);
      document.title = 'tao';
      writeHash('', false);
      sound.play('release');
      if (held) { sparks.emit(held); held = null; }
    }
  }
});

const sparks = createSparks({
  canvas, field, mark, box, reader: readerEl, buttons, tree: [...TREE, SETTINGS],
  on: {
    select: s => select(s),
    land: s => {
      /* spark lands */
      quietUntil = performance.now() + 300;
      box.classList.add('hot');
      setTimeout(() => box.classList.remove('hot'), 180);
      sound.play('land');
      const prev = held;
      held = s;
      if (prev && prev !== s) sparks.emit(prev);
      reader.read(s.node, pending ? pending.page : 0);
    },
    empty: () => { if (held && !pending && settled()) reader.release(); },
    swipe: dir => { if (reader.node) dir > 0 ? reader.next() : reader.prev(); },
    gather: on => sound.play(on ? 'gather' : 'scatter'),
    pinch: () => !held,
    hover: s => { if (s) sound.play('hover'); }
  }
});

function select(s, page = 0, quiet = false) {
  /* one flight at a time */
  if (pending) return;
  if (sparks.absorb(s)) { pending = { page, quiet }; sound.play('select'); }
}

sparks.setTheme(theme.current);

/* box tap and hold */
let boxHold = null, boxHeld = false;
box.addEventListener('pointerdown', () => {
  boxHeld = false;
  clearTimeout(boxHold);
  if (reader.node) boxHold = setTimeout(() => { boxHeld = true; reader.release(); }, 550);
});
const endBoxHold = () => clearTimeout(boxHold);
box.addEventListener('pointerup', endBoxHold);
box.addEventListener('pointercancel', endBoxHold);
box.addEventListener('pointerleave', endBoxHold);
box.addEventListener('contextmenu', e => e.preventDefault());
box.addEventListener('click', () => {
  if (boxHeld) { boxHeld = false; return; }
  if (pending || !settled()) return;
  if (reader.node) reader.next(); else sparks.gather(!sparks.gathered);
});

/* trackpad and mouse wheel, sideways */
let wheelSum = 0, wheelCool = 0;
addEventListener('wheel', e => {
  if (!reader.node) return;
  const now = performance.now();
  if (now < wheelCool) return;
  wheelSum += e.deltaX;
  if (Math.abs(wheelSum) > 60) {
    wheelSum > 0 ? reader.next() : reader.prev();
    wheelSum = 0; wheelCool = now + 500;
  }
}, { passive: true });

addEventListener('keydown', e => {
  if (pending) return;
  if (e.key === 'Escape' && reader.node) reader.release();
  if (e.key === 'ArrowRight' && reader.node) reader.next();
  if (e.key === 'ArrowLeft' && reader.node) reader.prev();
  if (e.key === 'm' || e.key === 'M') sound.toggle();
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
if (location.hash) {
  /* arriving on a deep link: put the bare page under it so back closes the section first */
  const h = location.hash;
  history.replaceState(null, '', location.pathname + location.search);
  history.pushState(null, '', h);
  applyHash();
}

buildPaper(document.getElementById('paper'), { name: NAME, tagline: TAGLINE, tree: TREE, email: EMAIL });

/* offline cache, production only */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
