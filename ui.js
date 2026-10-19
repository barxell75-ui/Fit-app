// Forja · utilidades de interfaz: iconos, diálogos, avisos, gráficas, sonido, ordenación por arrastre

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  routines: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/><path d="M8 7h8M8 11h6"/>',
  history: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="12.5" cy="14.5" r="1.2" fill="currentColor"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  starFill: '<path fill="currentColor" d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  dn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  play: '<path fill="currentColor" stroke="none" d="M7 4.5v15l13-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="m5 5 9 7-9 7zM19 5v14"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>',
  note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  unlink: '<path d="M9 15l6-6M5 5l14 14M10 6.5l1-1a4 4 0 0 1 5.7 5.7l-1 1M14 17.5l-1 1a4 4 0 0 1-5.7-5.7l1-1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/>',
  flame: '<path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4s.5 2 2 2.5C10 9 12 3 12 3z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  skipEx: '<path d="M5 12h12M13 6l6 6-6 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  weight: '<path d="M6 8h12l2 12H4z"/><circle cx="12" cy="5" r="2"/>',
  chartLine: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  // glifos de equipamiento para miniaturas
  g_barbell: '<path d="M2 12h20M5 7v10M8 5v14M16 5v14M19 7v10"/>',
  g_dumbbell: '<path d="M8 12h8M5 8v8M8 7v10M16 7v10M19 8v8"/>',
  g_kettlebell: '<path d="M9 8a3 3 0 1 1 6 0"/><path d="M7 10h10l1.5 4a5 5 0 0 1-4.7 6.5h-3.6A5 5 0 0 1 5.5 14z"/>',
  g_machine: '<rect x="4" y="3" width="6" height="18" rx="1"/><path d="M5.5 7h3M5.5 10h3M5.5 13h3M10 5h7l3 3v13"/><circle cx="17" cy="16" r="2"/>',
  g_cable: '<path d="M4 3h16M7 3v4M7 7l6 13M13 20h5"/><circle cx="7" cy="7" r="1.5"/>',
  g_body: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 9.5l5 1.5 5-1.5M9 21l3-7 3 7"/>',
  g_bar: '<path d="M3 5h18M7 5v4M17 5v4"/><circle cx="12" cy="11" r="2"/><path d="M12 13v5M8 11l4-1 4 1M10 22l2-4 2 4"/>',
  g_rings: '<path d="M8 2v9M16 2v9"/><circle cx="8" cy="15" r="3.5"/><circle cx="16" cy="15" r="3.5"/>',
  g_band: '<path d="M3 12c3-6 6 6 9 0s6 6 9 0"/>',
  g_clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  g_mobility: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7c-2 3-6 4-8 4M12 7c1 4 0 7 4 13M8 21l2-7"/>',
};

export function ic(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function glyphFor(ex) {
  if (ex.measure === 'time' && ex.load !== 'weight') return ex.pattern === 'mobility' ? 'g_mobility' : 'g_clock';
  const e = ex.equipment || [];
  if (['mobility', 'warmup', 'rehab'].includes(ex.pattern)) return 'g_mobility';
  if (e.includes('anillas')) return 'g_rings';
  if (e.includes('barra_dominadas') || e.includes('paralelas') || e.includes('asistida')) return 'g_bar';
  if (e.includes('banda') || e.includes('trx')) return 'g_band';
  if (e.includes('polea')) return 'g_cable';
  if (e.includes('maquina') || e.includes('smith') || e.includes('trineo')) return 'g_machine';
  if (e.includes('kettlebell') && !e.includes('mancuernas')) return 'g_kettlebell';
  if (e.includes('mancuernas')) return 'g_dumbbell';
  if (e.includes('barra') || e.includes('barra_z') || e.includes('trap_bar') || e.includes('landmine')) return 'g_barbell';
  return 'g_body';
}

// ---------- avisos y diálogos ----------
let toastTimer;
export function toast(msg, ms = 2200) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

function overlay(inner, onClose) {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${inner}</div>`;
  o.addEventListener('click', e => { if (e.target === o) onClose(); });
  document.body.appendChild(o);
  return o;
}

export function confirmDlg({ title, text = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise(res => {
    const close = v => { o.remove(); res(v); };
    const o = overlay(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="actions"><button class="btn lg ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button>
      <button class="btn lg" data-v="0">${esc(cancel)}</button></div>`, () => close(false));
    o.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => close(b.dataset.v === '1')));
  });
}

/** items: [{key, label, icon, danger, sub}] */
export function menu(title, items, sub = '') {
  return new Promise(res => {
    const close = v => { o.remove(); res(v); };
    const o = overlay(`${title ? `<h3>${esc(title)}</h3>` : ''}${sub ? `<p>${esc(sub)}</p>` : ''}<div class="actions">
      ${items.map((it, i) => `<button class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? ic(it.icon) : ''}<span style="flex:1">${esc(it.label)}${it.sub ? `<br><span class="small muted">${esc(it.sub)}</span>` : ''}</span>${it.on ? ic('check') : ''}</button>`).join('')}
      <button class="btn lg" data-i="-1">Cancelar</button></div>`, () => close(null));
    o.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => close(b.dataset.i === '-1' ? null : items[+b.dataset.i].key)));
  });
}

/** Formulario simple: fields [{key,label,type,value,options,inputmode,placeholder}] → objeto o null */
export function formDlg(title, fields, okLabel = 'Guardar', text = '') {
  return new Promise(res => {
    const close = v => { o.remove(); res(v); };
    const html = fields.map((f, i) => {
      const id = `fd_${i}`;
      if (f.type === 'select') return `<label class="field" for="${id}">${esc(f.label)}<select class="input" id="${id}" data-k="${f.key}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
      if (f.type === 'textarea') return `<label class="field" for="${id}">${esc(f.label)}<textarea class="input" id="${id}" data-k="${f.key}">${esc(f.value || '')}</textarea></label>`;
      return `<label class="field" for="${id}">${esc(f.label)}<input class="input" id="${id}" data-k="${f.key}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} placeholder="${esc(f.placeholder || '')}"></label>`;
    }).join('');
    const o = overlay(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<form class="stack">${html}
      <div class="actions"><button class="btn lg primary" type="submit">${esc(okLabel)}</button><button class="btn lg" type="button" data-c>Cancelar</button></div></form>`, () => close(null));
    const form = o.querySelector('form');
    form.addEventListener('submit', e => { e.preventDefault(); const out = {}; form.querySelectorAll('[data-k]').forEach(el => { out[el.dataset.k] = el.value; }); close(out); });
    o.querySelector('[data-c]').addEventListener('click', () => close(null));
    const first = form.querySelector('input,textarea'); if (first) setTimeout(() => first.focus(), 60);
  });
}

// ---------- gráficas SVG ----------
function niceTicks(min, max, n = 4, integer = false) {
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const span = max - min, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  let step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  if (integer) step = Math.max(1, Math.round(step));
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}
const fmtTick = v => Math.abs(v) >= 10000 ? (v / 1000).toFixed(0) + 'k' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(+v.toFixed(1));

/** points: [{x: timestamp, y: number, label?}] */
export function lineChart(points, { height = 190, yFmt = fmtTick, title = '' } = {}) {
  if (!points.length) return '<p class="muted small">Sin datos todavía.</p>';
  const W = 340, H = height, L = 40, R = 12, T = 12, B = 26;
  const ys = points.map(p => p.y);
  const { lo, hi, ticks } = niceTicks(Math.min(...ys), Math.max(...ys));
  const x0 = points[0].x, x1 = points[points.length - 1].x;
  const sx = x => points.length === 1 ? (L + (W - L - R) / 2) : L + (x - x0) / (x1 - x0 || 1) * (W - L - R);
  const sy = y => T + (1 - (y - lo) / (hi - lo || 1)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = points.length > 1 ? `${path}L${sx(x1).toFixed(1)},${H - B}L${sx(x0).toFixed(1)},${H - B}Z` : '';
  const d = t => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const xl = points.length === 1 ? [points[0].x] : [x0, x0 + (x1 - x0) / 2, x1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
    ${ticks.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${L - 6}" y="${sy(t) + 3.5}" text-anchor="end">${esc(yFmt(t))}</text>`).join('')}
    ${area ? `<path class="area" d="${area}"/>` : ''}<path class="line" d="${path}"/>
    ${points.map((p, i) => `<circle class="pt ${i === points.length - 1 ? 'last' : ''}" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${i === points.length - 1 ? 4.5 : 3}"><title>${esc(d(p.x))}: ${esc(yFmt(p.y))}</title></circle>`).join('')}
    ${xl.map((x, i) => `<text x="${sx(x)}" y="${H - 6}" text-anchor="${points.length === 1 ? 'middle' : i === 0 ? 'start' : i === xl.length - 1 ? 'end' : 'middle'}">${esc(d(x))}</text>`).join('')}
  </svg>`;
}

/** bars: [{label, value, cur?}] */
export function barChart(bars, { height = 170, yFmt = fmtTick, title = '', integer = false } = {}) {
  if (!bars.length) return '';
  const W = 340, H = height, L = 40, R = 6, T = 12, B = 24;
  const max = Math.max(...bars.map(b => b.value), 0);
  const { hi, ticks } = niceTicks(0, max || 1, 4, integer);
  const bw = (W - L - R) / bars.length;
  const sy = y => T + (1 - y / (hi || 1)) * (H - T - B);
  const every = Math.ceil(bars.length / 6);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
    ${ticks.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${L - 6}" y="${sy(t) + 3.5}" text-anchor="end">${esc(yFmt(t))}</text>`).join('')}
    ${bars.map((b, i) => { const h = Math.max(0, (H - B) - sy(b.value)); return `<rect class="bar ${b.cur ? 'cur' : ''}" x="${(L + i * bw + bw * 0.18).toFixed(1)}" y="${sy(b.value).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3"><title>${esc(b.label)}: ${esc(yFmt(b.value))}</title></rect>`; }).join('')}
    ${bars.map((b, i) => ((bars.length - 1 - i) % every === 0) ? `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>` : '').join('')}
  </svg>`;
}

// ---------- sonido, vibración y pantalla ----------
let actx = null;
export function unlockAudio() {
  try {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
    if (actx && actx.state === 'suspended') actx.resume();
  } catch { /* sin audio */ }
}
export function beep() {
  try {
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();
    const now = actx.currentTime;
    [0, 0.22, 0.44].forEach((t, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, now + t); g.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);
      o.connect(g).connect(actx.destination); o.start(now + t); o.stop(now + t + 0.2);
    });
  } catch { /* */ }
}
export function vibrate(pattern) {
  try { if (navigator.vibrate) return navigator.vibrate(pattern); } catch { /* */ }
  return false;
}
export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

// ---------- ordenación por arrastre (táctil y ratón) ----------
/** container: elemento con hijos [data-sort]; onDrop(fromIndex, toIndex) */
export function makeSortable(container, onDrop) {
  if (!container || container._sortable) return;
  container._sortable = true;
  container.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.handle');
    if (!handle || !container.contains(handle)) return;
    const item = handle.closest('[data-sort]');
    if (!item) return;
    e.preventDefault();
    const items = [...container.querySelectorAll(':scope > [data-sort]')];
    const from = items.indexOf(item);
    const rects = items.map(el => el.getBoundingClientRect());
    const startY = e.clientY;
    const sc = container.closest('.sheet') || document.scrollingElement;
    const startScroll = sc.scrollTop;
    let to = from;
    item.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const dy = ev.clientY - startY + (sc.scrollTop - startScroll);
      item.style.transform = `translateY(${dy}px)`;
      const center = rects[from].top + rects[from].height / 2 + dy;
      to = from;
      for (let i = 0; i < rects.length; i++) {
        const mid = rects[i].top + rects[i].height / 2;
        if (i < from && center < mid) { to = i; break; }
        if (i > from && center > mid) to = i;
      }
      const h = rects[from].height + 8;
      items.forEach((el, i) => {
        if (el === item) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -h;
        if (from > to && i < from && i >= to) shift = h;
        el.style.transition = 'transform .15s'; el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
      // auto-scroll cerca de los bordes
      if (ev.clientY < 90) sc.scrollTop -= 8; else if (ev.clientY > window.innerHeight - 90) sc.scrollTop += 8;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      items.forEach(el => { el.style.transform = ''; el.style.transition = ''; });
      item.classList.remove('dragging');
      if (to !== from) onDrop(from, to);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

// ---------- archivos ----------
export async function shareOrDownload(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.style.display = 'none';
    i.addEventListener('change', () => { res(i.files && i.files[0] ? i.files[0] : null); i.remove(); });
    document.body.appendChild(i); i.click();
  });
}

export function readText(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
}

/** Reduce una imagen a máx. `max` px y la devuelve como dataURL JPEG */
export function resizeImage(file, max = 640) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(r.error);
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => rej(new Error('No se pudo leer la imagen'));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
