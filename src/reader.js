/* reader */

export function createReader({ el, email, onToast, onAction, metaFor, on = {} }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IDLE_HTML = el.innerHTML;

  let node = null, pages = [], index = 0, swapping = false;

  /* flatten to pages */
  function pagesOf(section) {
    const out = [];
    for (const item of section.children || []) {
      out.push({ head: section.label, item });
      for (const sub of item.children || []) out.push({ head: item.label, item: sub });
    }
    return out;
  }

  function copyEmail() {
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(() => onToast('copied'), () => onToast(email));
    else onToast(email);
  }

  function idlePage() {
    const d = document.createElement('div');
    d.innerHTML = IDLE_HTML;
    return d.firstElementChild;
  }

  function pageEl(p, i, n) {
    const d = document.createElement('div');
    d.className = 'page';

    const head = document.createElement('p');
    head.className = 'head';
    head.textContent = p.head;
    d.appendChild(head);

    const text = document.createElement('p');
    text.className = 'text';
    let inner;
    if (p.item.href) {
      inner = document.createElement('a');
      inner.href = p.item.href; inner.target = '_blank'; inner.rel = 'noreferrer';
    } else if (p.item.action === 'copy-email') {
      inner = document.createElement('button');
      inner.type = 'button';
      inner.addEventListener('click', e => { e.stopPropagation(); copyEmail(); });
    } else if (p.item.action) {
      /* a setting. click toggles it, the meta shows its state */
      inner = document.createElement('button');
      inner.type = 'button';
      inner.addEventListener('click', e => {
        e.stopPropagation();
        onAction && onAction(p.item);
        const m = text.querySelector('.meta');
        if (m && metaFor) m.textContent = metaFor(p.item);
      });
    } else {
      inner = document.createElement('span');
    }
    inner.textContent = p.item.label;
    text.appendChild(inner);
    const meta = p.item.meta || (p.item.action && metaFor ? metaFor(p.item) : null);
    if (meta) {
      const m = document.createElement('small');
      m.className = 'meta';
      m.textContent = meta;
      text.appendChild(m);
    }
    d.appendChild(text);

    const pips = document.createElement('div');
    pips.className = 'pips';
    pips.setAttribute('aria-label', 'page ' + (i + 1) + ' of ' + n);
    for (let k = 0; k < n; k++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.setAttribute('aria-label', 'page ' + (k + 1));
      if (k === i) pip.className = 'on';
      pip.addEventListener('click', e => { e.stopPropagation(); go(k); });
      pips.appendChild(pip);
    }
    /* one more, faint, that closes the section */
    const end = document.createElement('button');
    end.type = 'button';
    end.className = 'end';
    end.setAttribute('aria-label', 'close');
    end.addEventListener('click', e => { e.stopPropagation(); release(); });
    pips.appendChild(end);
    d.appendChild(pips);
    return d;
  }

  /* swap page */
  function show(next, after) {
    const old = el.querySelector('.page');
    swapping = true;
    const finish = () => {
      old && old.remove();
      next.classList.add('in');
      el.appendChild(next);
      el.classList.toggle('reading', pages.length > 0);
      swapping = false;
      after && after();
    };
    if (old && !reduce) { old.classList.add('out'); setTimeout(finish, 160); } else finish();
  }

  function read(section, startPage = 0) {
    node = section;
    pages = pagesOf(section);
    index = Math.min(Math.max(0, startPage), pages.length - 1);
    show(pageEl(pages[index], index, pages.length));
    on.read && on.read(node, index);
  }

  function go(i) {
    if (!node || swapping || i === index || i < 0 || i >= pages.length) return;
    const dir = i > index ? 1 : -1;
    index = i;
    show(pageEl(pages[index], index, pages.length));
    on.step && on.step(node, index, dir);
  }

  /* release past end */
  function next() {
    if (!node || swapping) return;
    if (index + 1 >= pages.length) { release(); return; }
    go(index + 1);
  }
  function prev() { go(index - 1); }

  function release() {
    if (!node) return;
    const was = node;
    node = null; pages = []; index = 0;
    show(idlePage(), () => on.release && on.release(was));
  }

  /* tap swipe and hold */
  let sx = null, swiped = false, holdTimer = null, heldOut = false;
  const selecting = () => (window.getSelection && String(window.getSelection())).length > 0;
  el.addEventListener('pointerdown', e => {
    sx = e.clientX; swiped = false; heldOut = false;
    clearTimeout(holdTimer);
    /* hold is off over the text so it can be selected */
    if (node && !e.target.closest('.text')) holdTimer = setTimeout(() => { heldOut = true; release(); }, 550);
  });
  const endHold = () => clearTimeout(holdTimer);
  el.addEventListener('pointerup', e => {
    endHold();
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (selecting()) { swiped = true; return; }
    if (!heldOut && Math.abs(dx) > 40) { swiped = true; dx < 0 ? next() : prev(); }
  });
  el.addEventListener('pointercancel', endHold);
  el.addEventListener('pointerleave', endHold);
  el.addEventListener('contextmenu', e => { if (node) e.preventDefault(); });
  el.addEventListener('click', e => {
    if (heldOut) { heldOut = false; return; }
    if (swiped) { swiped = false; return; }
    if (selecting()) return;
    if (node && !e.target.closest('a, button')) next();
  });

  return {
    read, next, prev, go, release,
    get node() { return node; },
    get index() { return index; },
    get length() { return pages.length; }
  };
}
