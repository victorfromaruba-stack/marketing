// Seven-segment readout, hand-built SVG. Any element with data-seg="07:00" is drawn as lit segments over ghost ones.
// ponytail: digits, ":", ".", "-" and space only; letters are not needed on any screen.
const SEGS = {
  a: 'M3.2 0H16.8L14.4 3.4H5.6Z', b: 'M20 2.4V15.8L18.3 17.3L16.6 15.5V5.5Z', c: 'M20 20.2V33.6L16.6 30.5V20.5L18.3 18.7Z',
  d: 'M5.6 32.6H14.4L16.8 36H3.2Z', e: 'M0 20.2L1.7 18.7L3.4 20.5V30.5L0 33.6Z', f: 'M0 2.4L3.4 5.5V15.5L1.7 17.3L0 15.8Z',
  g: 'M3.6 18L5.4 16.3H14.6L16.4 18L14.6 19.7H5.4Z'
};
const ON = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };

export function seg(text) {
  let x = 0, body = '';
  for (const ch of String(text)) {
    if (ch === ':') { body += `<rect x="${x + 1}" y="9" width="3.4" height="3.4" fill="var(--seg-on)"/><rect x="${x + 1}" y="23.6" width="3.4" height="3.4" fill="var(--seg-on)"/>`; x += 7; continue; }
    if (ch === '.') { body += `<rect x="${x}" y="32.6" width="3.4" height="3.4" fill="var(--seg-on)"/>`; x += 5; continue; }
    const lit = ON[ch] ?? '';
    for (const [k, d] of Object.entries(SEGS)) body += `<path transform="translate(${x} 0) skewX(-6)" d="${d}" fill="var(${lit.includes(k) ? '--seg-on' : '--seg-off'})"/>`;
    x += 25;
  }
  return `<svg viewBox="-2 -1 ${x + 1} 38" aria-hidden="true">${body}</svg>`;
}

export function drawAll(root = document) {
  root.querySelectorAll('[data-seg]').forEach(el => {
    el.innerHTML = seg(el.dataset.seg);
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.seg);
    el.setAttribute('role', 'img');
  });
}
drawAll();
