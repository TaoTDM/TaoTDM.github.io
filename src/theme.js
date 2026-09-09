/* day and night */

export function createTheme({ storageKey = 'tao.theme' } = {}) {
  let current = read();
  apply();

  function read() {
    try { return localStorage.getItem(storageKey) === 'night' ? 'night' : 'day'; } catch { return 'day'; }
  }
  function apply() {
    document.documentElement.dataset.theme = current;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = current === 'night' ? '#000000' : '#ffffff';
    try { localStorage.setItem(storageKey, current); } catch {}
  }
  function set(name) { current = name === 'night' ? 'night' : 'day'; apply(); return current; }
  function toggle() { return set(current === 'night' ? 'day' : 'night'); }

  return { set, toggle, get current() { return current; }, get night() { return current === 'night'; } };
}
