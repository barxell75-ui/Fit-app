// Forja · aplicación (vistas y controladores)
import * as M from './model.js';
import { buildLibrary, instructionsFor, PATTERNS, CHAINS, STARTER_TEMPLATES } from './exercises.js';
import * as DB from './store.js';
import { esc, ic, glyphFor, toast, confirmDlg, menu, formDlg, lineChart, barChart, unlockAudio, beep, vibrate, canVibrate, keepAwake, makeSortable, shareOrDownload, pickFile, readText, resizeImage } from './ui.js';

const APP_VERSION = '1.0.0';

const DEFAULT_SETTINGS = {
  unit: 'kg', timeUnit: 's', theme: 'system', defaultRest: 90, sound: true, vibrate: true,
  suggestions: true, showRpe: false, effortKind: 'rpe', keepAwake: true,
};
const DEFAULT_PROFILE = { name: '', age: '', bodyweight: '', goals: [], level: '', daysPerWeek: '', equipment: [], notes: '' };
const GOALS = ['Fuerza', 'Hipertrofia', 'Resistencia muscular', 'Pérdida de grasa', 'Habilidades de calistenia', 'Salud general', 'Rendimiento deportivo', 'Readaptación'];
const LEVELS = ['Principiante', 'Intermedio', 'Avanzado'];
const REST_OPTS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 420, 600];

const S = {
  profile: { ...DEFAULT_PROFILE }, settings: { ...DEFAULT_SETTINGS }, favorites: new Set(), custom: [],
  templates: [], sessions: [], active: null, lib: [], byId: {}, tab: 'home', sheets: [],
  meta: { lastBackup: null }, libQuery: '', libFilters: {}, histFilters: {}, calMonth: null, statsEx: null, statsMetric: 'e1rm',
  storage: { fallback: false, persisted: null },
};

// ======================= utilidades =======================
const U = () => S.settings.unit;
const wv = kg => M.toDisplay(kg, U());
const W = kg => (kg === null || kg === undefined || kg === '') ? '—' : `${M.toDisplay(kg, U())} ${U()}`;
const volFmt = kg => { const v = M.toDisplay(kg, U()); return `${Math.round(v).toLocaleString('es-ES')} ${U()}`; };
function parseTime(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes(':')) { const [m, sec] = s.split(':'); const mm = M.parseNum(m), ss = M.parseNum(sec || '0'); if (mm === null || ss === null) return null; return Math.round(mm * 60 + ss); }
  const n = M.parseNum(s); return n === null ? null : Math.round(n);
}
const tIn = sec => (sec === '' || sec === null || sec === undefined) ? '' : (S.settings.timeUnit === 'min' ? M.fmtClock(sec) : String(sec));
const tFmt = sec => (sec === '' || sec === null || sec === undefined) ? '—' : (S.settings.timeUnit === 'min' ? M.fmtClock(sec) : `${sec} s`);
const restFmt = sec => !sec ? 'Sin descanso' : sec < 60 ? `${sec} s` : M.fmtClock(sec);
const dateFmt = (t, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(t).toLocaleDateString('es-ES', o);
const timeFmt = t => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const exDef = id => S.byId[id];
const bw = () => M.parseNum(S.profile.bodyweight);
const $ = (sel, root = document) => root.querySelector(sel);
const sheet = () => S.sheets[S.sheets.length - 1];

function rebuildIndex() {
  S.byId = {};
  for (const e of S.lib) S.byId[e.id] = e;
  for (const e of S.custom) S.byId[e.id] = e;
}
function allExercises() { return [...S.custom, ...S.lib]; }

/** Última vez que se hizo un ejercicio (sesión finalizada), opcionalmente excluyendo una sesión */
function lastSessionEx(exerciseId, excludeId) {
  let best = null, bestT = -1;
  for (const s of S.sessions) {
    if (!s.endedAt || s.id === excludeId) continue;
    for (const ex of s.exercises) {
      if (ex.exerciseId === exerciseId && ex.sets.some(st => st.done) && s.startedAt > bestT) { best = { session: s, ex }; bestT = s.startedAt; }
    }
  }
  return best;
}
function lastEntryFor(exerciseId) {
  const l = lastSessionEx(exerciseId);
  if (!l) return null;
  return M.entryFromSessionExercise(l.session, l.ex, M.parseNum(l.session.bodyweight) || bw());
}

function setBrief(s, ex) {
  if (!s) return '';
  const w = M.parseNum(s.weight);
  let load = '';
  if (ex.load === 'weight') load = w !== null ? `${wv(w)}` : '';
  else if (ex.load === 'bodyweight') { const m = s.mode || 'bw'; load = m === 'added' ? `+${wv(w || 0)}` : m === 'assist' ? `−${wv(w || 0)}` : 'PC'; }
  else if (ex.load === 'band') load = s.band || '';
  const meas = ex.measure === 'time' ? tFmt(s.seconds) : (s.reps !== '' && s.reps !== undefined ? s.reps : '');
  if (ex.measure === 'time') return load ? `${load} · ${meas}` : meas;
  return load ? `${load} × ${meas}` : `${meas} reps`;
}

function setTypeLabel(s, n) {
  if (s.type === 'warmup') return 'C';
  if (s.type === 'drop') return 'D';
  if (s.type === 'failure') return 'F';
  return String(n);
}
function workingNumbering(sets) {
  let n = 0; return sets.map(s => (s.type === 'normal' || s.type === 'failure') ? ++n : n);
}

// ======================= persistencia =======================
const saveKV = (k, v) => DB.put('kv', k, v).catch(err => { console.error(err); toast('No se pudo guardar. Revisa el espacio del dispositivo.'); });
const saveSettings = () => saveKV('settings', S.settings);
const saveProfile = () => saveKV('profile', S.profile);
const saveFavorites = () => saveKV('favorites', [...S.favorites]);
const saveCustom = () => saveKV('custom', S.custom);
const saveMeta = () => saveKV('meta', S.meta);
async function saveTemplate(t) { t.updatedAt = Date.now(); const i = S.templates.findIndex(x => x.id === t.id); if (i >= 0) S.templates[i] = t; else S.templates.push(t); await DB.put('templates', t.id, t); }
async function deleteTemplate(id) { S.templates = S.templates.filter(t => t.id !== id); await DB.del('templates', id); }
async function saveSession(s) { const i = S.sessions.findIndex(x => x.id === s.id); if (i >= 0) S.sessions[i] = s; else S.sessions.push(s); await DB.put('sessions', s.id, s); }
async function deleteSession(id) { S.sessions = S.sessions.filter(s => s.id !== id); await DB.del('sessions', id); }
let activeSaveT = null;
function saveActive(now = false) {
  clearTimeout(activeSaveT);
  const run = () => (S.active ? saveKV('active', S.active) : DB.del('kv', 'active'));
  if (now) return run();
  activeSaveT = setTimeout(run, 350);
}

async function load() {
  S.storage = await DB.init();
  const [settings, profile, favorites, custom, meta, active, templates, sessions] = await Promise.all([
    DB.get('kv', 'settings'), DB.get('kv', 'profile'), DB.get('kv', 'favorites'), DB.get('kv', 'custom'), DB.get('kv', 'meta'), DB.get('kv', 'active'),
    DB.all('templates'), DB.all('sessions'),
  ]);
  S.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  S.profile = { ...DEFAULT_PROFILE, ...(profile || {}) };
  S.favorites = new Set(favorites || []);
  S.custom = custom || [];
  S.meta = { lastBackup: null, ...(meta || {}) };
  S.active = active || null;
  S.templates = (templates || []).sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
  S.sessions = (sessions || []).sort((a, b) => b.startedAt - a.startedAt);
  S.lib = buildLibrary();
  rebuildIndex();
}

// ======================= tema =======================
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0e1116');
}

// ======================= render principal =======================
const TABS = [
  ['home', 'Inicio', 'home'], ['routines', 'Rutinas', 'routines'], ['library', 'Ejercicios', 'book'],
  ['history', 'Historial', 'history'], ['stats', 'Progreso', 'stats'], ['profile', 'Perfil', 'user'],
];

function render() {
  const main = $('#main');
  const views = { home: viewHome, routines: viewRoutines, library: viewLibrary, history: viewHistory, stats: viewStats, profile: viewProfile };
  main.innerHTML = `<div class="screen">${views[S.tab]()}</div>`;
  $('#tabbar').innerHTML = `<div class="tabbar"><nav>${TABS.map(([k, l, i]) => `<button data-a="tab" data-k="${k}" class="${S.tab === k ? 'on' : ''}" aria-label="${l}">${ic(i)}<span>${l}</span></button>`).join('')}</nav></div>`;
  renderResume();
  if (S.tab === 'library') renderLibList();
  afterRender(main);
}

function renderResume() {
  const showing = S.sheets.some(s => s.type === 'session');
  const el = $('#resume');
  if (S.active && !showing) {
    const done = S.active.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
    el.innerHTML = `<div class="resume-bar"><button data-a="openSession">${ic('timer')}<span style="flex:1">Continuar: ${esc(S.active.templateName)}<br><span class="small" style="opacity:.8"><span data-elapsed>${M.fmtClock((Date.now() - S.active.startedAt) / 1000)}</span> · ${done} series hechas</span></span>${ic('right')}</button></div>`;
  } else el.innerHTML = '';
}

function renderSheets() {
  const box = $('#sheets');
  const top = sheet();
  if (!top) { box.innerHTML = ''; document.body.style.overflow = ''; renderResume(); renderRestbar(); return; }
  const prevScroll = box.firstElementChild && box.firstElementChild.dataset.key === top.key ? box.firstElementChild.scrollTop : (top.scroll || 0);
  const fns = { exDetail: sheetExDetail, picker: sheetPicker, tplEdit: sheetTplEdit, exForm: sheetExForm, session: sheetSession, summary: sheetSummary, sessionDetail: sheetSessionDetail, compare: sheetCompare, filters: sheetFilters };
  box.innerHTML = `<div class="sheet ${top.type === 'session' && top.mode === 'live' ? 'live' : ''}" data-key="${top.key}">${fns[top.type](top)}</div>`;
  document.body.style.overflow = 'hidden';
  const el = box.firstElementChild;
  el.scrollTop = prevScroll;
  renderResume();
  renderRestbar();
  afterRender(el);
  if (top.type === 'picker') renderPickerList();
}

function afterRender(root) {
  root.querySelectorAll('[data-sortable]').forEach(c => makeSortable(c, (from, to) => onSortDrop(c.dataset.sortable, from, to)));
}

let sheetKey = 0;
function pushSheet(type, params = {}) {
  const top = sheet();
  if (top) { const el = $('#sheets .sheet'); if (el) top.scroll = el.scrollTop; }
  S.sheets.push({ type, key: ++sheetKey, ...params });
  renderSheets();
}
function popSheet() { S.sheets.pop(); renderSheets(); if (!S.sheets.length) render(); }
function replaceSheet(type, params = {}) { S.sheets.pop(); pushSheet(type, params); }

function head(title, { left = 'back', right = '' } = {}) {
  const l = left === 'back' ? `<button class="iconbtn" data-a="pop" aria-label="Volver">${ic('back')}</button>` : left === 'close' ? `<button class="iconbtn" data-a="pop" aria-label="Cerrar">${ic('x')}</button>` : left;
  return `<div class="sheet-head"><div class="in">${l}<h2>${esc(title)}</h2>${right || '<span style="width:44px"></span>'}</div></div>`;
}

// ======================= INICIO =======================
function viewHome() {
  const now = Date.now();
  const next = M.nextScheduled(S.templates, S.sessions, now);
  const ws = M.weekStart(now);
  const weekSessions = S.sessions.filter(s => s.endedAt && s.startedAt >= ws);
  const wk = weekSessions.reduce((a, s) => { const st = M.sessionStats(s, bw()); a.vol += st.volume; a.sets += st.sets; a.dur += st.duration; return a; }, { vol: 0, sets: 0, dur: 0 });
  const target = M.parseNum(S.profile.daysPerWeek);
  const last = S.sessions.find(s => s.endedAt);
  const h = new Date().getHours();
  const hello = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const daysSinceBackup = S.meta.lastBackup ? Math.floor((now - S.meta.lastBackup) / 86400000) : null;
  const needBackup = S.sessions.length >= 3 && (daysSinceBackup === null || daysSinceBackup >= 14);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  const nextCard = next ? `<div class="hero-next">
      <div class="eyebrow">${next.inDays === 0 ? 'Hoy toca' : next.inDays === 1 ? 'Mañana' : next.inDays === 7 ? 'El ' + M.WEEKDAYS[next.weekday].toLowerCase() + ' que viene' : 'El ' + M.WEEKDAYS[next.weekday].toLowerCase()}</div>
      <h3>${esc(next.template.name)}</h3>
      <div class="meta">${next.template.items.length} ejercicios · ${next.template.items.reduce((a, i) => a + i.sets.length, 0)} series${next.template.description ? ' · ' + esc(next.template.description) : ''}</div>
      <button class="btn lg primary" data-a="startTpl" data-id="${next.template.id}">${ic('play')} Empezar entrenamiento</button>
    </div>` : `<div class="hero-next">
      <div class="eyebrow">Sin rutina programada</div>
      <h3>${S.templates.length ? 'Elige qué entrenar hoy' : 'Crea tu primera rutina'}</h3>
      <div class="meta">${S.templates.length ? 'Asigna días de la semana a tus rutinas para verlas aquí.' : 'Monta una rutina desde la biblioteca o empieza un entrenamiento libre.'}</div>
      <div class="row wrap"><button class="btn lg primary" data-a="${S.templates.length ? 'tab' : 'newTpl'}" data-k="routines">${S.templates.length ? 'Ver rutinas' : 'Nueva rutina'}</button></div>
    </div>`;

  const strip = M.WEEKDAYS.map((d, i) => {
    const day = new Date(ws); day.setDate(day.getDate() + i);
    const done = S.sessions.some(s => s.endedAt && M.startOfDay(s.startedAt) === day.getTime());
    const plan = S.templates.find(t => (t.days || []).includes(i));
    const today = M.startOfDay(now) === day.getTime();
    return `<div class="d ${today ? 'today' : ''}">${d.slice(0, 1)}<i class="${done ? 'done' : plan ? 'plan' : ''}"></i><span class="lbl">${plan ? esc(plan.name) : '&nbsp;'}</span></div>`;
  }).join('');

  return `
    <div class="topbar"><div style="flex:1"><div class="sub">${esc(dateFmt(now, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h1>${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</h1></div></div>
    ${!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent) ? `<div class="notice" style="margin-bottom:12px">Para usar Forja como app: toca <b>Compartir</b> en Safari y luego <b>Añadir a pantalla de inicio</b>. Así se abre a pantalla completa y tus datos quedan en la app.</div>` : ''}
    ${nextCard}
    <div class="grid2" style="margin-top:10px">
      <button class="btn lg" data-a="startFree">${ic('plus')} Entreno libre</button>
      <button class="btn lg" data-a="tab" data-k="routines">${ic('routines')} Mis rutinas</button>
    </div>
    <h2>Esta semana</h2>
    <div class="weekstrip">${strip}</div>
    <div class="grid4" style="margin-top:10px">
      <div class="stat"><div class="v">${weekSessions.length}${target ? `<span class="muted" style="font-size:15px">/${target}</span>` : ''}</div><div class="k">Sesiones</div></div>
      <div class="stat"><div class="v">${wk.sets}</div><div class="k">Series</div></div>
      <div class="stat"><div class="v">${Math.round(M.toDisplay(wk.vol, U())).toLocaleString('es-ES')}</div><div class="k">Volumen (${U()})</div></div>
      <div class="stat"><div class="v">${Math.round(wk.dur / 60)}</div><div class="k">Minutos</div></div>
    </div>
    ${needBackup ? `<div class="notice warn" style="margin-top:12px"><b>Haz una copia de seguridad.</b> Tus datos solo están en este dispositivo. ${daysSinceBackup === null ? 'Aún no has exportado ninguna copia.' : `Última copia hace ${daysSinceBackup} días.`}<div style="margin-top:8px"><button class="btn sm primary" data-a="exportBackup">Exportar copia</button></div></div>` : ''}
    ${S.templates.length ? `<h2>Empezar rápido</h2><div class="list">${S.templates.slice(0, 5).map(t => `<div class="item" data-a="startTpl" data-id="${t.id}"><div class="thumb">${ic('routines')}</div><div class="grow"><div class="title">${esc(t.name)}</div><div class="meta">${t.items.length} ejercicios${(t.days || []).length ? ' · ' + t.days.map(d => M.WEEKDAYS[d].slice(0, 3)).join(', ') : ''}</div></div>${ic('play', 'muted')}</div>`).join('')}</div>` : ''}
    ${last ? `<h2>Último entrenamiento</h2>${sessionCard(last)}` : `<div class="empty" style="margin-top:16px">${ic('history')}<h3>Aún no hay entrenamientos</h3><p>Cuando completes tu primera sesión verás aquí el resumen y tu progreso.</p></div>`}
  `;
}

function sessionCard(s) {
  const st = M.sessionStats(s, bw());
  const names = s.exercises.filter(e => e.sets.some(x => x.done)).map(e => e.name);
  return `<div class="card tap" data-a="openSessionDetail" data-id="${s.id}">
    <div class="row"><div style="flex:1;min-width:0"><h3>${esc(s.templateName)}</h3><div class="muted small">${esc(dateFmt(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${timeFmt(s.startedAt)}</div></div>${ic('right', 'muted')}</div>
    <div class="row wrap" style="margin-top:8px;gap:6px"><span class="badge">${M.fmtDuration(st.duration)}</span><span class="badge">${st.sets} series</span>${st.volume ? `<span class="badge data">${volFmt(st.volume)}</span>` : ''}${st.reps ? `<span class="badge">${st.reps} reps</span>` : ''}</div>
    <div class="muted small" style="margin-top:8px">${esc(names.slice(0, 4).join(' · '))}${names.length > 4 ? ` y ${names.length - 4} más` : ''}</div>
  </div>`;
}

// ======================= RUTINAS =======================
function viewRoutines() {
  const list = S.templates.filter(t => !t.archived);
  const byDay = M.WEEKDAYS.map((d, i) => list.filter(t => (t.days || []).includes(i)));
  return `
    <div class="topbar"><h1>Rutinas</h1><button class="iconbtn" data-a="routinesMenu" aria-label="Más opciones">${ic('more')}</button></div>
    <div class="grid2"><button class="btn lg primary" data-a="newTpl">${ic('plus')} Nueva rutina</button><button class="btn lg" data-a="startFree">${ic('play')} Entreno libre</button></div>
    <h2>Plan semanal</h2>
    <div class="list">${M.WEEKDAYS.map((d, i) => `<div class="item" data-a="assignDay" data-d="${i}"><div style="width:84px;font-weight:650">${d}</div><div class="grow"><div class="meta" style="white-space:normal">${byDay[i].length ? byDay[i].map(t => esc(t.name)).join(', ') : 'Descanso'}</div></div>${ic('right', 'muted')}</div>`).join('')}</div>
    <h2>Mis rutinas <span class="muted small">${list.length}</span></h2>
    ${list.length ? `<div class="stack" data-sortable="templates">${list.map(t => `<div class="card" data-sort>
        <div class="row"><span class="handle" aria-label="Arrastrar para reordenar">${ic('grip')}</span><div style="flex:1;min-width:0" data-a="editTpl" data-id="${t.id}"><h3>${esc(t.name)}</h3><div class="muted small">${t.items.length} ejercicios · ${t.items.reduce((a, i) => a + i.sets.length, 0)} series${(t.days || []).length ? ' · ' + t.days.map(d => M.WEEKDAYS[d].slice(0, 3)).join(', ') : ''}</div></div>
        <button class="iconbtn" data-a="tplMenu" data-id="${t.id}" aria-label="Opciones">${ic('more')}</button></div>
        ${t.description ? `<div class="muted small" style="margin-top:6px">${esc(t.description)}</div>` : ''}
        <div class="muted small" style="margin-top:6px">${esc(t.items.slice(0, 5).map(i => exDef(i.exerciseId)?.name || '¿?').join(' · '))}${t.items.length > 5 ? '…' : ''}</div>
        <button class="btn block primary" style="margin-top:10px" data-a="startTpl" data-id="${t.id}">${ic('play')} Empezar</button>
      </div>`).join('')}</div>` : `<div class="empty">${ic('routines')}<h3>Sin rutinas todavía</h3><p>Crea una rutina desde cero o añade una de las plantillas sugeridas y adáptala.</p><button class="btn primary" data-a="starters">Ver plantillas sugeridas</button></div>`}
  `;
}

// ======================= BIBLIOTECA =======================
const TYPE_FILTERS = { compound: 'Compuesto', isolation: 'Aislamiento', unilateral: 'Unilateral', bilateral: 'Bilateral', isometric: 'Isométrico', eccentric: 'Excéntrico', plyometric: 'Pliométrico', time: 'Por tiempo' };
function viewLibrary() {
  const f = S.libFilters;
  const active = activeFilterChips(f);
  return `
    <div class="topbar"><h1>Ejercicios</h1><button class="iconbtn" data-a="newCustomEx" aria-label="Crear ejercicio">${ic('plus')}</button></div>
    <div class="search"><input class="input" id="libq" type="search" placeholder="Buscar en ${allExercises().length} ejercicios" value="${esc(S.libQuery)}" data-f="libq" autocomplete="off">${ic('search')}</div>
    <div class="chips" style="margin-top:10px">
      <button class="chip ${f.favorites ? 'on' : ''}" data-a="libToggle" data-k="favorites">${ic(f.favorites ? 'starFill' : 'star')} Favoritos</button>
      <button class="chip" data-a="openFilters" data-ctx="lib">${ic('filter')} Filtros${active.length ? ` (${active.length})` : ''}</button>
      ${Object.entries(M.CATEGORIES).map(([k, l]) => `<button class="chip ${f.category === k ? 'on' : ''}" data-a="libCat" data-k="${k}">${esc(l)}</button>`).join('')}
    </div>
    ${active.length ? `<div class="chips" style="margin-top:6px">${active.map(([k, l]) => `<button class="chip on" data-a="libClear" data-k="${k}">${esc(l)} ${ic('x')}</button>`).join('')}</div>` : ''}
    <div id="libList" style="margin-top:12px"></div>`;
}
function activeFilterChips(f) {
  const out = [];
  if (f.muscle) out.push(['muscle', M.MUSCLES[f.muscle]]);
  if (f.group) out.push(['group', f.group]);
  if (f.equipment) out.push(['equipment', M.EQUIPMENT[f.equipment]]);
  if (f.difficulty) out.push(['difficulty', M.DIFFICULTY[f.difficulty]]);
  if (f.type) out.push(['type', TYPE_FILTERS[f.type]]);
  if (f.custom) out.push(['custom', 'Personalizados']);
  if (f.myEquip) out.push(['myEquip', 'Mi equipamiento']);
  return out;
}
function filteredExercises(q, f) {
  let list = M.searchExercises(allExercises(), q, f, S.favorites);
  if (f.myEquip && S.profile.equipment.length) {
    const mine = new Set([...S.profile.equipment, 'peso_corporal']);
    list = list.filter(e => e.equipment.some(x => mine.has(x)));
  }
  return list;
}
function exRow(e, { pick = false, selected = false } = {}) {
  const thumb = e.image ? `<img src="${e.image}" alt="">` : ic(glyphFor(e));
  return `<div class="item" data-a="${pick ? 'pickToggle' : 'openEx'}" data-id="${e.id}">
    <div class="thumb">${thumb}</div>
    <div class="grow"><div class="title">${esc(e.name)}${e.custom ? ' <span class="badge accent">Propio</span>' : ''}</div>
    <div class="meta">${esc(M.MUSCLES[e.primary] || e.primary)} · ${esc(e.equipment.map(x => M.EQUIPMENT[x] || x).join(', '))}</div></div>
    <span class="dots" aria-label="${M.DIFFICULTY[e.difficulty]}">${[1, 2, 3].map(i => `<i class="${i <= e.difficulty ? 'on' : ''}"></i>`).join('')}</span>
    ${pick ? `<span class="check ${selected ? 'on' : ''}" style="width:34px;height:34px">${ic('check')}</span>` : (S.favorites.has(e.id) ? `<span class="star on">${ic('starFill')}</span>` : '')}
  </div>`;
}
function renderLibList() {
  const box = $('#libList'); if (!box) return;
  const list = filteredExercises(S.libQuery, S.libFilters);
  if (!list.length) { box.innerHTML = `<div class="empty">${ic('search')}<h3>No hay resultados</h3><p>Prueba con otro nombre o quita filtros. Si no existe, puedes crearlo.</p><button class="btn primary" data-a="newCustomEx">Crear ejercicio</button></div>`; return; }
  const LIMIT = 150;
  box.innerHTML = `<div class="muted small" style="margin:0 0 6px 4px">${list.length} ejercicios</div><div class="list">${list.slice(0, LIMIT).map(e => exRow(e)).join('')}</div>${list.length > LIMIT ? `<p class="muted small" style="text-align:center">Mostrando ${LIMIT}. Afina la búsqueda para ver el resto.</p>` : ''}`;
}

function sheetFilters(sh) {
  const f = sh.ctx === 'lib' ? S.libFilters : sh.ctx === 'picker' ? (S.sheets.find(s => s.type === 'picker')?.filters || {}) : {};
  const sel = (key, opts, label) => `<label class="field">${label}<select class="input" data-f="filt" data-k="${key}"><option value="">Todos</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(f[key] || '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const groups = [...new Set(Object.values(M.MUSCLE_GROUP))];
  return head('Filtros', { left: 'close', right: `<button class="btn ghost" data-a="clearFilters">Borrar</button>` }) + `<div class="sheet-body stack">
    ${sel('category', Object.entries(M.CATEGORIES), 'Categoría')}
    ${sel('group', groups.map(g => [g, g]), 'Grupo muscular')}
    ${sel('muscle', Object.entries(M.MUSCLES), 'Músculo principal')}
    ${sel('equipment', Object.entries(M.EQUIPMENT), 'Equipamiento')}
    ${sel('difficulty', Object.entries(M.DIFFICULTY), 'Dificultad')}
    ${sel('type', Object.entries(TYPE_FILTERS), 'Tipo de movimiento')}
    <label class="switch"><span>Incluir músculo como secundario</span><input type="checkbox" data-f="filtb" data-k="includeSecondary" ${f.includeSecondary ? 'checked' : ''}></label>
    <label class="switch"><span>Solo personalizados</span><input type="checkbox" data-f="filtb" data-k="custom" ${f.custom ? 'checked' : ''}></label>
    <label class="switch"><span>Solo con mi equipamiento${S.profile.equipment.length ? '' : ' (configúralo en Perfil)'}</span><input type="checkbox" data-f="filtb" data-k="myEquip" ${f.myEquip ? 'checked' : ''}></label>
  </div><div class="sheet-foot"><div class="in"><button class="btn lg primary block" data-a="pop">Ver resultados</button></div></div>`;
}

// ---------- ficha de ejercicio ----------
function sheetExDetail(sh) {
  const e = exDef(sh.id);
  if (!e) return head('Ejercicio') + `<div class="sheet-body"><p>Este ejercicio ya no existe en la biblioteca.</p></div>`;
  const tab = sh.tab || 'info';
  const fav = S.favorites.has(e.id);
  const right = `<button class="iconbtn" data-a="toggleFav" data-id="${e.id}" aria-label="Favorito"><span class="star ${fav ? 'on' : ''}">${ic(fav ? 'starFill' : 'star')}</span></button>`;
  const tabs = `<div class="seg" style="margin:4px 0 14px"><button class="${tab === 'info' ? 'on' : ''}" data-a="exTab" data-k="info">Ficha</button><button class="${tab === 'hist' ? 'on' : ''}" data-a="exTab" data-k="hist">Historial</button><button class="${tab === 'prog' ? 'on' : ''}" data-a="exTab" data-k="prog">Progreso</button></div>`;
  let body = '';
  if (tab === 'info') body = exInfoHTML(e);
  else if (tab === 'hist') body = exHistHTML(e);
  else body = exProgHTML(e);
  return head(e.name, { right }) + `<div class="sheet-body">${tabs}${body}</div>`;
}

function exInfoHTML(e) {
  const ins = instructionsFor(e);
  const loadTxt = { weight: 'Con peso (kg/lb)', bodyweight: 'Peso corporal: sin carga, con lastre o con asistencia', band: 'Banda elástica (resistencia)', none: 'Sin carga' }[e.load];
  const chain = CHAINS.filter(c => c.includes(e.id)).sort((a, b) => b.length - a.length)[0];
  const doneIds = new Set(S.sessions.flatMap(s => s.exercises.filter(x => x.sets.some(st => st.done)).map(x => x.exerciseId)));
  const link = id => exDef(id) ? `<button class="chip" data-a="openEx" data-id="${id}">${esc(exDef(id).name)}</button>` : '';
  return `
    <div class="figure">${e.image ? `<img src="${e.image}" alt="${esc(e.name)}">` : `<div class="ph">${ic(glyphFor(e))}<div class="small">${esc(ins.patternLabel)}</div><div class="small muted">Sin imagen. En tus ejercicios propios puedes añadir una foto.</div></div>`}</div>
    <div style="margin:12px 0 4px"><div class="muted small">${esc(e.nameEn || '')}${e.alt && e.alt.length ? ' · ' + esc(e.alt.join(' · ')) : ''}</div></div>
    <div class="row wrap" style="gap:6px;margin:8px 0 14px">
      <span class="badge accent">${esc(M.CATEGORIES[e.category] || '')}</span>
      <span class="badge">${e.mechanic === 'compound' ? 'Compuesto' : 'Aislamiento'}</span>
      <span class="badge">${e.laterality === 'unilateral' ? 'Unilateral' : 'Bilateral'}</span>
      ${(e.tags || []).map(t => `<span class="badge data">${TYPE_FILTERS[t]}</span>`).join('')}
      ${e.measure === 'time' ? '<span class="badge data">Por tiempo</span>' : ''}
      <span class="badge">${M.DIFFICULTY[e.difficulty]}</span>
    </div>
    <dl class="kv">
      <dt>Principal</dt><dd>${esc(M.MUSCLES[e.primary] || e.primary)}</dd>
      <dt>Secundarios</dt><dd>${e.secondary.length ? esc(e.secondary.map(m => M.MUSCLES[m] || m).join(', ')) : '—'}</dd>
      <dt>Equipamiento</dt><dd>${esc(e.equipment.map(x => M.EQUIPMENT[x] || x).join(', '))}</dd>
      <dt>Registro</dt><dd>${esc(loadTxt)} · ${e.measure === 'time' ? 'segundos' : 'repeticiones'}</dd>
    </dl>
    <h2>Cómo hacerlo</h2><ol class="steps">${ins.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${e.tip ? `<div class="notice" style="margin-top:10px">${esc(e.tip)}</div>` : ''}
    <h2>Errores habituales</h2><ul class="plain">${ins.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    ${(e.easier.length || e.harder.length) ? `<h2>Variantes</h2>
      ${e.easier.length ? `<div class="muted small" style="margin-bottom:6px">Más fáciles</div><div class="row wrap" style="gap:6px">${e.easier.map(link).join('')}</div>` : ''}
      ${e.harder.length ? `<div class="muted small" style="margin:10px 0 6px">Más difíciles</div><div class="row wrap" style="gap:6px">${e.harder.map(link).join('')}</div>` : ''}` : ''}
    ${chain ? `<h2>Progresión</h2><div class="card flat prog">${chain.map(id => exDef(id) ? `<div class="p ${doneIds.has(id) ? 'done' : ''} ${id === e.id ? 'cur' : ''}"><i></i><span style="flex:1">${esc(exDef(id).name)}</span>${doneIds.has(id) ? '<span class="small muted">Conseguido</span>' : ''}</div>` : '').join('')}</div>` : ''}
    ${e.notes ? `<h2>Notas</h2><p>${esc(e.notes)}</p>` : ''}
    <div class="stack" style="margin-top:18px">
      ${S.active ? `<button class="btn lg primary" data-a="addExToActive" data-id="${e.id}">${ic('plus')} Añadir al entrenamiento en curso</button>` : ''}
      ${e.custom ? `<div class="grid2"><button class="btn" data-a="editCustomEx" data-id="${e.id}">${ic('edit')} Editar</button><button class="btn danger" data-a="deleteCustomEx" data-id="${e.id}">${ic('trash')} Eliminar</button></div>` : `<button class="btn" data-a="duplicateEx" data-id="${e.id}">${ic('copy')} Crear variante personalizada</button>`}
    </div>`;
}

function exHistHTML(e) {
  const hist = M.exerciseHistory(S.sessions, e.id, bw()).reverse();
  if (!hist.length) return `<div class="empty">${ic('history')}<h3>Sin registros</h3><p>Cuando hagas este ejercicio verás aquí cada sesión.</p></div>`;
  return `<div class="stack">${hist.map(h => {
    const all = h.ex.sets.filter(s => s.done);
    const nums = workingNumbering(all);
    return `<div class="card tap" data-a="openSessionDetail" data-id="${h.sessionId}">
      <div class="row"><b style="flex:1">${esc(dateFmt(h.date))}</b><span class="muted small">${esc(h.templateName)}</span></div>
      <div class="stack" style="gap:4px;margin-top:8px">${all.map((s, i) => `<div class="row small"><span class="badge" style="min-width:28px;justify-content:center">${setTypeLabel(s, nums[i])}</span><span class="num" style="flex:1">${esc(setBrief(s, h.ex))}${s.rpe ? ` · RPE ${esc(s.rpe)}` : ''}${s.rir !== '' && s.rir !== undefined ? ` · RIR ${esc(s.rir)}` : ''}</span>${M.setE1rm(s, h.ex, h.bw) ? `<span class="muted num">1RM ${wv(M.setE1rm(s, h.ex, h.bw))}</span>` : ''}</div>`).join('')}</div>
      ${h.ex.notes ? `<div class="muted small" style="margin-top:6px">${esc(h.ex.notes)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

const METRICS = {
  e1rm: { label: '1RM est.', get: h => h.bestE1rm, w: true },
  weight: { label: 'Peso máx.', get: h => h.topWeight, w: true },
  added: { label: 'Lastre', get: h => h.maxAdded, w: true },
  assist: { label: 'Asistencia', get: h => h.minAssist, w: true },
  reps: { label: 'Reps máx.', get: h => h.maxReps },
  time: { label: 'Duración', get: h => h.maxSec, t: true },
  volume: { label: 'Volumen', get: h => h.volume || null, w: true },
};
function metricsFor(e, hist) {
  return Object.keys(METRICS).filter(k => hist.some(h => { const v = METRICS[k].get(h); return v !== null && v !== undefined && (k === 'assist' || v > 0); }));
}
function exProgHTML(e, metricKey) {
  const hist = M.exerciseHistory(S.sessions, e.id, bw());
  if (!hist.length) return `<div class="empty">${ic('chartLine')}<h3>Sin datos de progreso</h3><p>Completa este ejercicio al menos una vez.</p></div>`;
  const avail = metricsFor(e, hist);
  const sh = sheet();
  const mk = metricKey || (sh && sh.metric && avail.includes(sh.metric) ? sh.metric : avail[0]);
  const m = METRICS[mk];
  const pts = hist.map(h => ({ x: h.date, y: m.get(h) })).filter(p => p.y !== null && p.y !== undefined).map(p => ({ x: p.x, y: m.w ? M.toDisplay(p.y, U()) : p.y }));
  const pr = M.personalRecords(hist);
  const prRows = Object.entries(M.PR_LABELS).filter(([k]) => pr[k]).map(([k, d]) => {
    const v = pr[k].value;
    const val = ['maxSec'].includes(k) ? tFmt(v) : ['maxReps', 'bwReps'].includes(k) ? `${v} reps` : W(v);
    return `<div class="item" data-a="openSessionDetail" data-id="${pr[k].sessionId}"><div class="grow"><div class="title">${esc(d.label)}</div><div class="meta">${esc(d.kind)} · ${esc(dateFmt(pr[k].date))}</div></div><b class="num">${esc(val)}</b></div>`;
  }).join('');
  const needBw = e.load === 'bodyweight' && !bw();
  return `
    ${avail.length > 1 ? `<div class="chips">${avail.map(k => `<button class="chip ${k === mk ? 'on' : ''}" data-a="exMetric" data-k="${k}">${METRICS[k].label}</button>`).join('')}</div>` : ''}
    <div class="card" style="margin-top:10px">${lineChart(pts, { title: m.label, yFmt: m.t ? (v => M.fmtClock(v)) : undefined })}</div>
    ${needBw ? `<div class="notice" style="margin-top:10px">Indica tu peso corporal en Perfil para calcular la carga total y el 1RM estimado en ejercicios de peso corporal.</div>` : ''}
    <h2>Récords personales</h2><div class="list">${prRows || '<div class="item">Sin récords aún</div>'}</div>
    <p class="muted small">El 1RM se estima con la fórmula de Epley solo con series de hasta 12 repeticiones. Las series de calentamiento no cuentan.</p>`;
}

// ---------- selector de ejercicios ----------
function sheetPicker(sh) {
  const n = sh.selected.size;
  const f = sh.filters || {};
  const active = activeFilterChips(f).length;
  return head(sh.mode === 'replace' ? 'Sustituir ejercicio' : 'Añadir ejercicios', { left: 'close', right: `<button class="iconbtn" data-a="newCustomEx" aria-label="Crear ejercicio">${ic('plus')}</button>` }) + `<div class="sheet-body">
    <div class="search"><input class="input" id="pickq" type="search" placeholder="Buscar ejercicio" value="${esc(sh.q || '')}" data-f="pickq" autocomplete="off">${ic('search')}</div>
    <div class="chips" style="margin-top:10px">
      <button class="chip ${f.favorites ? 'on' : ''}" data-a="pickFilter" data-k="favorites">${ic('star')} Favoritos</button>
      <button class="chip ${f.recent ? 'on' : ''}" data-a="pickFilter" data-k="recent">Recientes</button>
      <button class="chip" data-a="openFilters" data-ctx="picker">${ic('filter')} Filtros${active ? ` (${active})` : ''}</button>
      ${Object.entries(M.CATEGORIES).map(([k, l]) => `<button class="chip ${f.category === k ? 'on' : ''}" data-a="pickCat" data-k="${k}">${esc(l)}</button>`).join('')}
    </div>
    <div id="pickList" style="margin-top:12px"></div>
  </div>
  ${sh.mode !== 'replace' ? `<div class="sheet-foot"><div class="in"><button class="btn lg primary block" data-a="pickConfirm" ${n ? '' : 'disabled'}>${n ? `Añadir ${n} ejercicio${n > 1 ? 's' : ''}` : 'Selecciona ejercicios'}</button></div></div>` : ''}`;
}
function renderPickerList() {
  const sh = sheet(); const box = $('#pickList'); if (!box || !sh || sh.type !== 'picker') return;
  const f = sh.filters || {};
  let list = filteredExercises(sh.q || '', f);
  if (f.recent) {
    const order = []; const seen = new Set();
    for (const s of S.sessions) for (const ex of s.exercises) if (!seen.has(ex.exerciseId)) { seen.add(ex.exerciseId); order.push(ex.exerciseId); }
    const set = new Set(list.map(e => e.id));
    list = order.filter(id => set.has(id)).map(exDef).filter(Boolean);
  }
  const LIMIT = 120;
  box.innerHTML = list.length ? `<div class="list">${list.slice(0, LIMIT).map(e => exRow(e, { pick: true, selected: sh.selected.has(e.id) })).join('')}</div>${list.length > LIMIT ? `<p class="muted small" style="text-align:center">Mostrando ${LIMIT} de ${list.length}. Busca para afinar.</p>` : ''}`
    : `<div class="empty"><h3>Sin resultados</h3><p>¿No está? Créalo con el botón +.</p></div>`;
}

// ======================= EDITOR DE RUTINA =======================
function newTemplate() {
  return { id: M.uid('t'), name: '', description: '', items: [], groups: [], days: [], createdAt: Date.now(), updatedAt: Date.now(), order: Date.now() };
}
function newItem(def) {
  const isTime = def.measure === 'time';
  const sets = [0, 1, 2].map(() => ({ id: M.uid('p'), type: 'normal', tech: '', reps: isTime ? '' : 8, repsMax: isTime ? '' : 12, weight: '', seconds: isTime ? 30 : '', rpe: '', rir: '', mode: def.load === 'bodyweight' ? 'bw' : undefined, band: '' }));
  return { uid: M.uid('i'), exerciseId: def.id, groupId: null, notes: '', restSec: S.settings.defaultRest, grip: '', progression: null, sets };
}

function normalizeGroups(t) {
  const items = t.items;
  const closed = new Set(); let prev = null;
  for (const it of items) {
    if (prev && prev !== it.groupId) closed.add(prev);
    if (it.groupId && closed.has(it.groupId)) it.groupId = null;
    prev = it.groupId;
  }
  const counts = {};
  items.forEach(it => { if (it.groupId) counts[it.groupId] = (counts[it.groupId] || 0) + 1; });
  items.forEach(it => { if (it.groupId && counts[it.groupId] < 2) it.groupId = null; });
  t.groups = (t.groups || []).filter(g => counts[g.id] >= 2);
}

function sheetTplEdit(sh) {
  const t = sh.draft;
  const labels = M.groupLabels(t.items);
  const errs = sh.errors || [];
  const showRpe = S.settings.showRpe;
  let lastGroup = null;
  const itemsHTML = t.items.map((it, xi) => {
    const def = exDef(it.exerciseId);
    if (!def) return `<div class="excard" data-sort><div class="exhead"><span class="handle">${ic('grip')}</span><span class="name">Ejercicio no disponible</span><button class="iconbtn" data-a="tplDelItem" data-x="${xi}">${ic('trash')}</button></div></div>`;
    const g = it.groupId ? t.groups.find(x => x.id === it.groupId) : null;
    let gh = '';
    if (g && g.id !== lastGroup) gh = `<div class="group-head">${ic('link')}<select class="input" data-f="tplGroupType" data-g="${g.id}">${Object.entries(M.GROUP_TYPES).map(([k, l]) => `<option value="${k}" ${g.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="muted small">Sin descanso entre ejercicios del grupo</span></div>`;
    lastGroup = it.groupId;
    const p = it.progression || {};
    const noLoad = def.load === 'none';
    const nums = workingNumbering(it.sets);
    return `<div class="excard ${it.groupId ? 'grouped' : ''}" data-sort>${gh}
      <div class="exhead"><span class="handle" aria-label="Arrastrar">${ic('grip')}</span>${labels[it.uid] ? `<span class="glabel">${labels[it.uid]}</span>` : ''}<button class="name" data-a="openEx" data-id="${def.id}">${esc(def.name)}</button><button class="iconbtn" data-a="tplItemMenu" data-x="${xi}" aria-label="Opciones">${ic('more')}</button></div>
      <div class="row wrap small" style="gap:8px">
        <label class="row" style="gap:6px">${ic('timer', 'muted')}<select class="input" style="min-height:36px;padding:4px 8px;width:auto" data-f="tplRest" data-x="${xi}">${REST_OPTS.map(r => `<option value="${r}" ${Number(it.restSec) === r ? 'selected' : ''}>${restFmt(r)}</option>`).join('')}</select></label>
        ${['v_pull', 'h_row', 'curl', 'dip', 'h_press', 'pushup'].includes(def.pattern) ? `<select class="input" style="min-height:36px;padding:4px 8px;width:auto" data-f="tplGrip" data-x="${xi}">${M.GRIPS.map(g => `<option value="${esc(g)}" ${it.grip === g ? 'selected' : ''}>${g ? 'Agarre: ' + g : 'Agarre…'}</option>`).join('')}</select>` : ''}
        <button class="chip ${p.mode === 'double' ? 'on' : ''}" data-a="tplProg" data-x="${xi}">Progresión${p.mode === 'double' ? ` ${p.repMin}–${p.repMax}` : ''}</button>
      </div>
      <input class="note-in" placeholder="Notas del ejercicio" value="${esc(it.notes)}" data-f="tplNote" data-x="${xi}">
      <div class="sets tpl ${noLoad ? 'no-load' : ''} ${showRpe ? 'has-rpe' : ''}">
        <div class="set-head"><span>Serie</span>${noLoad ? '' : `<span>${def.load === 'bodyweight' ? 'Carga' : def.load === 'band' ? 'Banda' : U()}</span>`}<span>${def.measure === 'time' ? 'Tiempo' : 'Reps'}</span>${showRpe ? `<span>${S.settings.effortKind.toUpperCase()}</span>` : ''}<span></span></div>
        ${it.sets.map((s, si) => `<div class="set-row">
          <button class="set-num ${s.type}" data-a="tplSetMenu" data-x="${xi}" data-s="${si}">${setTypeLabel(s, nums[si])}</button>
          ${noLoad ? '' : loadCellHTML(def, s, `tpl`, xi, si, '')}
          ${def.measure === 'time'
    ? `<input class="cell" inputmode="${S.settings.timeUnit === 'min' ? 'text' : 'numeric'}" placeholder="seg" value="${esc(tIn(s.seconds))}" data-f="tplSec" data-x="${xi}" data-s="${si}" aria-label="Segundos">`
    : `<input class="cell" inputmode="text" placeholder="8-12" value="${esc(s.reps === '' || s.reps === undefined ? '' : (s.repsMax ? `${s.reps}-${s.repsMax}` : s.reps))}" data-f="tplReps" data-x="${xi}" data-s="${si}" aria-label="Repeticiones (rango con guion)">`}
          ${showRpe ? `<input class="cell" inputmode="decimal" placeholder="—" value="${esc(S.settings.effortKind === 'rir' ? (s.rir ?? '') : (s.rpe ?? ''))}" data-f="tplEffort" data-x="${xi}" data-s="${si}" aria-label="Esfuerzo objetivo">` : ''}
          <button class="check" data-a="tplDelSet" data-x="${xi}" data-s="${si}" aria-label="Eliminar serie">${ic('x')}</button>
          ${s.tech ? `<div class="set-tags"><span class="badge data">${esc(M.TECHNIQUES[s.tech])}</span></div>` : ''}
        </div>`).join('')}
      </div>
      <div class="grid2"><button class="btn sm" data-a="tplAddSet" data-x="${xi}">${ic('plus')} Serie</button><button class="btn sm" data-a="tplAddSet" data-x="${xi}" data-t="warmup">${ic('plus')} Calentamiento</button></div>
    </div>`;
  }).join('');

  return head(sh.isNew ? 'Nueva rutina' : 'Editar rutina', { left: `<button class="btn ghost" data-a="tplCancel">Cancelar</button>`, right: `<button class="btn ghost" data-a="tplSave" style="font-weight:700">Guardar</button>` }) + `<div class="sheet-body stack">
    ${errs.length ? `<div class="errors"><b>Revisa estos datos:</b><ul>${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    <label class="field">Nombre<input class="input" id="tpl_name" value="${esc(t.name)}" placeholder="Ej.: Torso A" data-f="tplName" maxlength="80"></label>
    <label class="field">Descripción<textarea class="input" id="tpl_desc" placeholder="Opcional" data-f="tplDesc" maxlength="400">${esc(t.description || '')}</textarea></label>
    <div class="field"><span class="field" style="font-size:14px">Días programados</span><div class="row" style="gap:6px">${M.WEEKDAYS.map((d, i) => `<button class="chip ${(t.days || []).includes(i) ? 'on' : ''}" style="flex:1;justify-content:center;padding:0" data-a="tplDay" data-d="${i}" aria-label="${d}">${d.slice(0, 2)}</button>`).join('')}</div></div>
    <h2 style="margin-bottom:0">Ejercicios <span class="muted small">${t.items.length}</span></h2>
    <p class="muted small" style="margin:0">Arrastra ${ic('grip').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} para reordenar. Escribe un rango de reps con guion (8-12). Toca el número de serie para cambiar su tipo o técnica.</p>
    <div class="stack" data-sortable="tplItems">${itemsHTML}</div>
    <button class="btn lg block" data-a="pickFor" data-target="tpl">${ic('plus')} Añadir ejercicios</button>
    ${!sh.isNew ? `<button class="btn danger block" data-a="tplDelete">${ic('trash')} Eliminar rutina</button><p class="muted small">Eliminar o cambiar una rutina no modifica los entrenamientos ya registrados.</p>` : ''}
  </div>`;
}

function loadCellHTML(def, s, kind, xi, si, placeholder) {
  const fw = kind === 'tpl' ? 'tplW' : 'sw';
  if (def.load === 'band') return `<select class="cell" data-f="${kind === 'tpl' ? 'tplBand' : 'sband'}" data-x="${xi}" data-s="${si}" aria-label="Resistencia de banda">${M.BANDS.map(b => `<option value="${esc(b)}" ${s.band === b ? 'selected' : ''}>${b || '—'}</option>`).join('')}</select>`;
  if (def.load === 'bodyweight') {
    const mode = s.mode || 'bw';
    const sym = mode === 'added' ? '+' : mode === 'assist' ? '−' : 'PC';
    return `<div class="cellwrap"><button class="mode-btn ${mode}" data-a="${kind === 'tpl' ? 'tplMode' : 'sMode'}" data-x="${xi}" data-s="${si}" aria-label="Modo: ${mode === 'added' ? 'lastre' : mode === 'assist' ? 'asistencia' : 'peso corporal'}">${sym}</button>${mode === 'bw' ? '' : `<input class="cell" inputmode="decimal" placeholder="${esc(placeholder || U())}" value="${esc(s.weight === '' || s.weight === undefined || s.weight === null ? '' : wv(s.weight))}" data-f="${fw}" data-x="${xi}" data-s="${si}" aria-label="${mode === 'added' ? 'Lastre' : 'Asistencia'}">`}</div>`;
  }
  return `<input class="cell" inputmode="decimal" placeholder="${esc(placeholder || U())}" value="${esc(s.weight === '' || s.weight === undefined || s.weight === null ? '' : wv(s.weight))}" data-f="${fw}" data-x="${xi}" data-s="${si}" aria-label="Peso">`;
}

// ======================= ENTRENAMIENTO EN CURSO =======================
function startSession(template) {
  if (S.active) { toast('Ya tienes un entrenamiento en curso'); openSession(); return; }
  const sess = M.sessionFromTemplate(template, S.byId, S.sessions, { bodyweight: S.profile.bodyweight, defaultRest: S.settings.defaultRest, suggestions: S.settings.suggestions, lastEntryFor });
  S.active = sess;
  saveActive(true);
  unlockAudio();
  openSession();
}
function openSession() {
  if (!S.active) return;
  S.sheets = S.sheets.filter(s => s.type !== 'session');
  pushSheet('session', { mode: 'live' });
  if (S.settings.keepAwake) keepAwake(true);
}

function currentSess(sh) { return sh.mode === 'edit' ? sh.draft : S.active; }

function sheetSession(sh) {
  const sess = currentSess(sh);
  if (!sess) return head('Entrenamiento') + '<div class="sheet-body"><p>No hay entrenamiento en curso.</p></div>';
  const live = sh.mode === 'live';
  const labels = M.groupLabels(sess.exercises.map(e => ({ uid: e.uid, groupId: e.groupId })));
  const showRpe = S.settings.showRpe;
  const left = live ? `<button class="iconbtn" data-a="minimize" aria-label="Minimizar">${ic('down')}</button>` : `<button class="btn ghost" data-a="pop">Cancelar</button>`;
  const right = live ? `<button class="btn sm primary" data-a="finish">Terminar</button>` : `<button class="btn ghost" data-a="saveEdit" style="font-weight:700">Guardar</button>`;
  let lastGroup = null;
  const exHTML = sess.exercises.map((ex, xi) => {
    const prev = lastSessionEx(ex.exerciseId, sess.id);
    const prevSets = prev ? prev.ex.sets.filter(s => s.done) : [];
    const nums = workingNumbering(ex.sets);
    const noLoad = ex.load === 'none';
    const sug = ex.sets.find(s => s.target && s.target.suggested)?.target.suggested;
    let gh = '';
    if (ex.groupId && ex.groupId !== lastGroup) gh = `<div class="group-head">${ic('link')} ${esc(M.GROUP_TYPES[ex.groupType] || 'Grupo')} · descanso al terminar la vuelta</div>`;
    lastGroup = ex.groupId;
    return `<div class="excard ${ex.groupId ? 'grouped' : ''} ${ex.skipped ? 'skipped' : ''}" data-sort data-ex="${xi}">${gh}
      <div class="exhead"><span class="handle" aria-label="Arrastrar">${ic('grip')}</span>${labels[ex.uid] ? `<span class="glabel">${labels[ex.uid]}</span>` : ''}<button class="name" data-a="openEx" data-id="${ex.exerciseId}">${esc(ex.name)}</button><button class="iconbtn" data-a="sExMenu" data-x="${xi}" aria-label="Opciones del ejercicio">${ic('more')}</button></div>
      ${ex.skipped ? `<div class="row"><span class="muted small" style="flex:1">Ejercicio saltado</span><button class="btn sm" data-a="sUnskip" data-x="${xi}">Recuperar</button></div>` : `
      <div class="row wrap small muted" style="gap:10px">${live ? `<button class="chip" data-a="sRest" data-x="${xi}">${ic('timer')} ${restFmt(ex.restSec)}</button>` : ''}${ex.grip ? `<span class="badge">${esc(ex.grip)}</span>` : ''}<span class="prev-line">${prev ? `Anterior (${esc(dateFmt(prev.session.startedAt, { day: 'numeric', month: 'short' }))}): ${esc(prevSets.slice(0, 4).map(s => setBrief(s, ex)).join(', '))}` : 'Primera vez con este ejercicio'}</span></div>
      ${sug && S.settings.suggestions && live ? `<div class="sug">${ic('chartLine')}<span>${esc(sug.text)}</span><button class="btn sm data" data-a="applySug" data-x="${xi}">Aplicar</button></div>` : ''}
      ${ex.notes || sh.showNotes?.[xi] ? `<input class="note-in" placeholder="Notas" value="${esc(ex.notes || '')}" data-f="sNote" data-x="${xi}">` : ''}
      <div class="sets ${noLoad ? 'no-load' : ''} ${showRpe ? 'has-rpe' : ''}">
        <div class="set-head"><span>Serie</span><span>Anterior</span>${noLoad ? '' : `<span>${ex.load === 'bodyweight' ? 'Carga' : ex.load === 'band' ? 'Banda' : U()}</span>`}<span>${ex.measure === 'time' ? 'Tiempo' : 'Reps'}</span>${showRpe ? `<span>${S.settings.effortKind.toUpperCase()}</span>` : ''}<span>${ic('check').replace('<svg', '<svg style="width:14px;height:14px"')}</span></div>
        ${ex.sets.map((s, si) => sessionSetRow(ex, xi, s, si, nums[si], prevSets[si])).join('')}
      </div>
      <button class="btn sm add-set" data-a="sAddSet" data-x="${xi}">${ic('plus')} Añadir serie</button>`}
    </div>`;
  }).join('');
  const st = M.sessionStats(sess, bw());
  return `<div class="sheet-head session-head"><div class="in">${left}<div style="flex:1;text-align:center;min-width:0"><div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sess.templateName)}</div><div class="clock">${live ? `<span data-elapsed>${M.fmtClock((Date.now() - sess.startedAt) / 1000)}</span> · ` : esc(dateFmt(sess.startedAt)) + ' · '}<span data-livesets>${st.sets}</span> series · <span data-livevol>${volFmt(st.volume)}</span></div></div>${right}</div></div>
  <div class="sheet-body stack">
    ${sess.exercises.length ? '' : `<div class="empty">${ic('routines')}<h3>Entrenamiento vacío</h3><p>Añade ejercicios para empezar a registrar series.</p></div>`}
    <div class="stack" data-sortable="sessEx">${exHTML}</div>
    <button class="btn lg block" data-a="pickFor" data-target="session">${ic('plus')} Añadir ejercicio</button>
    <div class="card flat stack">
      <label class="field">Peso corporal de esta sesión (${U()}) <input class="input" inputmode="decimal" placeholder="Opcional" value="${esc(sess.bodyweight === '' || sess.bodyweight === undefined ? '' : wv(sess.bodyweight))}" data-f="sBw"></label>
      <label class="field">Notas de la sesión<textarea class="input" placeholder="Sensaciones, molestias, sueño…" data-f="sSessNote">${esc(sess.notes || '')}</textarea></label>
    </div>
    ${live ? `<button class="btn danger block" data-a="discard">${ic('trash')} Descartar entrenamiento</button>` : ''}
  </div>`;
}

function sessionSetRow(ex, xi, s, si, num, prevSet) {
  const tgt = s.target || {};
  const sug = tgt.suggested && S.settings.suggestions ? tgt.suggested : null;
  const before = ex.sets.slice(0, si).reverse().find(x => x.weight !== '' && x.weight !== undefined && x.weight !== null && x.type === s.type);
  const phW = sug && sug.weight !== null && sug.weight !== undefined ? wv(sug.weight) : prevSet && prevSet.weight !== '' && prevSet.weight !== undefined && prevSet.weight !== null ? wv(prevSet.weight) : (tgt.weight !== '' && tgt.weight !== undefined ? wv(tgt.weight) : before ? wv(before.weight) : U());
  const phR = tgt.reps !== '' && tgt.reps !== undefined ? (tgt.repsMax ? `${tgt.reps}-${tgt.repsMax}` : String(tgt.reps)) : (prevSet && prevSet.reps ? String(prevSet.reps) : 'reps');
  const phT = tgt.seconds ? tIn(tgt.seconds) : prevSet && prevSet.seconds ? tIn(prevSet.seconds) : 'seg';
  const showRpe = S.settings.showRpe;
  const ek = S.settings.effortKind;
  const effTarget = ek === 'rir' ? tgt.rir : tgt.rpe;
  return `<div class="set-row ${s.done ? 'done' : ''}" data-row="${xi}-${si}">
    <button class="set-num ${s.type}" data-a="sSetMenu" data-x="${xi}" data-s="${si}" aria-label="Opciones de la serie">${setTypeLabel(s, num)}</button>
    <button class="prev-cell" data-a="copyPrev" data-x="${xi}" data-s="${si}" ${prevSet ? '' : 'disabled'} aria-label="Copiar serie anterior">${prevSet ? esc(setBrief(prevSet, ex)) : '—'}</button>
    ${ex.load === 'none' ? '' : loadCellHTML(ex, s, 's', xi, si, phW)}
    ${ex.measure === 'time'
    ? `<input class="cell" inputmode="${S.settings.timeUnit === 'min' ? 'text' : 'numeric'}" placeholder="${esc(phT)}" value="${esc(tIn(s.seconds))}" data-f="ss" data-x="${xi}" data-s="${si}" aria-label="Segundos">`
    : `<input class="cell" inputmode="numeric" pattern="[0-9]*" placeholder="${esc(phR)}" value="${esc(s.reps ?? '')}" data-f="sr" data-x="${xi}" data-s="${si}" aria-label="Repeticiones">`}
    ${showRpe ? `<input class="cell" inputmode="decimal" placeholder="${esc(effTarget || '—')}" value="${esc(ek === 'rir' ? (s.rir ?? '') : (s.rpe ?? ''))}" data-f="sEffort" data-x="${xi}" data-s="${si}" aria-label="${ek.toUpperCase()}">` : ''}
    <button class="check ${s.done ? 'on' : ''}" data-a="sDone" data-x="${xi}" data-s="${si}" aria-label="${s.done ? 'Marcar como no hecha' : 'Completar serie'}">${ic('check')}</button>
    ${(s.tech || (tgt.rpe && !showRpe) || (tgt.rir !== '' && tgt.rir !== undefined && !showRpe)) ? `<div class="set-tags">${s.tech ? `<span class="badge data">${esc(M.TECHNIQUES[s.tech])}</span>` : ''}${tgt.rpe && !showRpe ? `<span class="badge">RPE obj. ${esc(tgt.rpe)}</span>` : ''}${tgt.rir !== '' && tgt.rir !== undefined && !showRpe ? `<span class="badge">RIR obj. ${esc(tgt.rir)}</span>` : ''}</div>` : ''}
  </div>`;
}

function refreshLiveStats(sess) {
  const st = M.sessionStats(sess, bw());
  const a = $('[data-livesets]'); if (a) a.textContent = st.sets;
  const b = $('[data-livevol]'); if (b) b.textContent = volFmt(st.volume);
}

/** Completa una serie: rellena con los valores sugeridos si están vacíos y valida */
function completeSet(sess, xi, si) {
  const ex = sess.exercises[xi]; const s = ex.sets[si];
  if (s.done) { s.done = false; s.doneAt = null; return { ok: true, undone: true }; }
  const prev = lastSessionEx(ex.exerciseId, sess.id);
  const prevSet = prev ? prev.ex.sets.filter(x => x.done)[si] : null;
  const tgt = s.target || {};
  const sug = tgt.suggested && S.settings.suggestions ? tgt.suggested : null;
  if (ex.load === 'weight' && (s.weight === '' || s.weight === null || s.weight === undefined)) {
    if (sug && sug.weight !== null) s.weight = sug.weight;
    else if (prevSet && prevSet.weight !== '' && prevSet.weight !== undefined) s.weight = prevSet.weight;
    else if (tgt.weight !== '' && tgt.weight !== undefined) s.weight = tgt.weight;
    else { const before = ex.sets.slice(0, si).reverse().find(x => x.weight !== '' && x.weight !== undefined && x.weight !== null && x.type === s.type); if (before) s.weight = before.weight; }
  }
  if (ex.load === 'bodyweight' && (s.mode === 'added' || s.mode === 'assist') && (s.weight === '' || s.weight === undefined || s.weight === null)) {
    if (prevSet && prevSet.mode === s.mode && prevSet.weight !== '') s.weight = prevSet.weight;
    else if (tgt.weight !== '' && tgt.weight !== undefined) s.weight = tgt.weight;
  }
  if (ex.measure === 'time') {
    if (s.seconds === '' || s.seconds === undefined || s.seconds === null) s.seconds = tgt.seconds || (prevSet ? prevSet.seconds : '');
  } else if (s.reps === '' || s.reps === undefined || s.reps === null) {
    if (sug && sug.reps) s.reps = sug.reps;
    else if (tgt.reps !== '' && tgt.reps !== undefined) s.reps = tgt.reps;
    else if (prevSet && prevSet.reps) s.reps = prevSet.reps;
    else { const before = ex.sets.slice(0, si).reverse().find(x => x.reps); if (before) s.reps = before.reps; }
  }
  if (ex.load === 'weight' && (s.weight === '' || s.weight === undefined)) s.weight = 0;
  const errs = M.validateSetInput(s, ex);
  if (errs.length) return { ok: false, msg: errs[0] };
  s.done = true; s.doneAt = Date.now();
  return { ok: true };
}

// ---------- temporizador de descanso ----------
let tickT = null;
function startRest(sec, exUid) {
  if (!S.active) return;
  if (!sec || sec <= 0) { S.active.timer = null; renderRestbar(); return; }
  S.active.timer = { endAt: Date.now() + sec * 1000, duration: sec, paused: null, exUid };
  saveActive();
  renderRestbar();
}
function restRemaining(t) { return t.paused !== null && t.paused !== undefined ? t.paused : Math.max(0, (t.endAt - Date.now()) / 1000); }
function renderRestbar() {
  const box = $('#restbar');
  const t = S.active && S.active.timer;
  const inSession = sheet() && sheet().type === 'session' && sheet().mode === 'live';
  if (!t || !inSession) { box.innerHTML = ''; return; }
  const rem = restRemaining(t);
  const paused = t.paused !== null && t.paused !== undefined;
  box.innerHTML = `<div class="restbar" role="timer" aria-live="off"><div class="in">
    <div class="track"><div class="fill" data-rfill style="width:${(100 * (1 - rem / t.duration)).toFixed(1)}%"></div></div>
    <div class="row" style="gap:8px">
      <button class="clock" data-a="restSet" data-rclock style="background:none;border:0;color:inherit;padding:0;text-align:left" aria-label="Cambiar duración">${M.fmtClock(rem)}</button>
      <span class="small" style="opacity:.7">Descanso</span>
      <button class="rb go" data-a="restSkip">Saltar</button>
    </div>
    <div class="ctrl">
      <button class="rb" data-a="restAdj" data-d="-15">−15 s</button>
      <button class="rb" data-a="restAdj" data-d="15">+15 s</button>
      <button class="rb" data-a="restPause" aria-label="${paused ? 'Reanudar' : 'Pausar'}">${ic(paused ? 'play' : 'pause')}</button>
      <button class="rb" data-a="restRestart" aria-label="Reiniciar">${ic('restart')}</button>
    </div></div></div>`;
}
function tick() {
  if (!S.active) return;
  const el = document.querySelectorAll('[data-elapsed]');
  if (el.length) { const txt = M.fmtClock((Date.now() - S.active.startedAt) / 1000); el.forEach(e => { e.textContent = txt; }); }
  const t = S.active.timer;
  if (!t) return;
  const rem = restRemaining(t);
  const c = $('[data-rclock]'); if (c) c.textContent = M.fmtClock(rem);
  const f = $('[data-rfill]'); if (f) f.style.width = `${(100 * (1 - rem / t.duration)).toFixed(1)}%`;
  if (rem <= 0 && (t.paused === null || t.paused === undefined)) restDone(Date.now() - t.endAt > 5000);
}
function restDone(late = false) {
  S.active.timer = null; saveActive();
  // Si la app estaba en segundo plano y el descanso terminó hace rato, no suena de golpe al volver
  if (!late && S.settings.sound) beep();
  if (!late && S.settings.vibrate) vibrate([300, 120, 300]);
  if (late) { renderRestbar(); toast('El descanso terminó mientras la app estaba en segundo plano'); return; }
  const rb = $('#restbar .restbar');
  if (rb) {
    rb.classList.add('flash');
    const clock = $('[data-rclock]'); if (clock) clock.textContent = '¡A por la siguiente!';
    setTimeout(() => renderRestbar(), 2600);
  } else renderRestbar();
}

async function finishSession() {
  const sess = S.active; if (!sess) return;
  const done = sess.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  if (!done) {
    const ok = await confirmDlg({ title: 'No has completado ninguna serie', text: 'Marca las series con ✓ al terminarlas. ¿Quieres descartar este entrenamiento?', ok: 'Descartar', cancel: 'Seguir entrenando', danger: true });
    if (ok) { S.active = null; saveActive(true); keepAwake(false); S.sheets = S.sheets.filter(s => s.type !== 'session'); renderSheets(); render(); }
    return;
  }
  const pending = sess.exercises.filter(e => !e.skipped).reduce((a, e) => a + e.sets.filter(s => !s.done).length, 0);
  const ok = await confirmDlg({ title: '¿Terminar entrenamiento?', text: pending ? `Hay ${pending} series sin completar. No se guardarán.` : 'Se guardará en tu historial.', ok: 'Terminar y guardar' });
  if (!ok) return;
  const final = JSON.parse(JSON.stringify(sess));
  final.endedAt = Date.now();
  final.timer = undefined;
  final.exercises = final.exercises.filter(e => !e.skipped).map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length);
  final.bodyweight = M.parseNum(final.bodyweight) ?? '';
  const prs = M.newRecordsInSession(final, S.sessions, bw());
  final.prs = prs;
  try { await saveSession(final); }
  catch (e) { toast('No se pudo guardar el entrenamiento. Inténtalo de nuevo.'); return; }
  S.sessions.sort((a, b) => b.startedAt - a.startedAt);
  if (M.parseNum(final.bodyweight) && M.parseNum(final.bodyweight) !== M.parseNum(S.profile.bodyweight)) { S.profile.bodyweight = final.bodyweight; saveProfile(); }
  S.active = null; await saveActive(true); keepAwake(false);
  S.sheets = [];
  render();
  pushSheet('summary', { id: final.id });
}

// ======================= RESUMEN / DETALLE / COMPARAR =======================
function prValueFmt(p) {
  if (p.key === 'maxSec') return tFmt(p.value);
  if (['maxReps', 'bwReps'].includes(p.key)) return `${p.value} reps`;
  return W(p.value);
}
function sheetSummary(sh) {
  const s = S.sessions.find(x => x.id === sh.id);
  if (!s) return head('Resumen') + '<div class="sheet-body"><p>Entrenamiento no encontrado.</p></div>';
  const st = M.sessionStats(s, bw());
  const tpl = s.templateId && S.templates.find(t => t.id === s.templateId);
  const count = S.sessions.filter(x => x.endedAt).length;
  return head('Resumen', { left: 'close' }) + `<div class="sheet-body stack">
    <div class="summary-hero"><div class="eyebrow">Entrenamiento nº ${count}</div><div class="big">${esc(s.templateName)}</div><div class="muted">${esc(dateFmt(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long' }))}</div></div>
    <div class="grid2">
      <div class="stat"><div class="v">${M.fmtDuration(st.duration)}</div><div class="k">Duración</div></div>
      <div class="stat"><div class="v">${st.exercises}</div><div class="k">Ejercicios</div></div>
      <div class="stat"><div class="v">${st.sets}</div><div class="k">Series completadas</div></div>
      <div class="stat"><div class="v">${st.reps}${st.seconds ? ` <span class="small muted">+ ${tFmt(st.seconds)}</span>` : ''}</div><div class="k">Repeticiones totales</div></div>
    </div>
    <div class="stat"><div class="v">${volFmt(st.volume)}</div><div class="k">Volumen total (peso × reps, sin calentamiento)${st.partialVolume ? '. Añade tu peso corporal para incluir los ejercicios de peso corporal.' : ''}</div></div>
    ${s.prs && s.prs.length ? `<h2>${ic('flame').replace('<svg', '<svg style="width:20px;height:20px;vertical-align:-3px;color:var(--accent)"')} Récords nuevos</h2><div class="stack">${s.prs.map(p => `<div class="pr"><div><b>${esc(p.name)}</b><div class="small muted">${esc(M.PR_LABELS[p.key]?.label || p.key)}</div></div><span class="v">${esc(prValueFmt(p))}</span></div>`).join('')}</div>` : ''}
    <h2>Ejercicios</h2>${sessionExercisesHTML(s)}
    ${tpl ? `<div class="card flat"><h3>¿Actualizar la rutina?</h3><p class="muted small" style="margin:4px 0 10px">Copia los pesos que has usado hoy como objetivo para la próxima vez en «${esc(tpl.name)}». Las sesiones ya guardadas no cambian.</p><button class="btn block" data-a="updateTplFromSession" data-id="${s.id}">Actualizar pesos de la rutina</button></div>` : ''}
  </div><div class="sheet-foot"><div class="in"><button class="btn lg primary block" data-a="pop">Hecho</button></div></div>`;
}

function sessionExercisesHTML(s) {
  const bwS = M.parseNum(s.bodyweight) || bw();
  return `<div class="stack">${s.exercises.map(ex => {
    const nums = workingNumbering(ex.sets);
    const entry = M.entryFromSessionExercise(s, ex, bwS);
    return `<div class="card"><div class="row"><button class="name" style="flex:1;text-align:left;background:none;border:0;padding:0;font-weight:700;color:var(--data);font-size:16px" data-a="openEx" data-id="${ex.exerciseId}">${esc(ex.name)}</button>${entry && entry.bestE1rm ? `<span class="badge data">1RM ${wv(entry.bestE1rm)}</span>` : ''}</div>
      ${ex.grip ? `<div class="muted small">Agarre: ${esc(ex.grip)}</div>` : ''}
      <div class="stack" style="gap:4px;margin-top:8px">${ex.sets.map((st, i) => `<div class="row small"><span class="badge" style="min-width:28px;justify-content:center">${setTypeLabel(st, nums[i])}</span><span class="num" style="flex:1">${esc(setBrief(st, ex))}${st.tech ? ` · ${esc(M.TECHNIQUES[st.tech])}` : ''}${st.rpe ? ` · RPE ${esc(st.rpe)}` : ''}${st.rir !== '' && st.rir !== undefined ? ` · RIR ${esc(st.rir)}` : ''}</span></div>`).join('')}</div>
      ${ex.notes ? `<div class="muted small" style="margin-top:6px">${esc(ex.notes)}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

function sheetSessionDetail(sh) {
  const s = S.sessions.find(x => x.id === sh.id);
  if (!s) return head('Entrenamiento') + '<div class="sheet-body"><p>Este entrenamiento se ha eliminado.</p></div>';
  const st = M.sessionStats(s, bw());
  return head(s.templateName, { right: `<button class="iconbtn" data-a="sessDetailMenu" data-id="${s.id}" aria-label="Opciones">${ic('more')}</button>` }) + `<div class="sheet-body stack">
    <div class="muted">${esc(dateFmt(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${timeFmt(s.startedAt)}–${timeFmt(s.endedAt)}</div>
    <div class="grid4"><div class="stat"><div class="v">${Math.round(st.duration / 60)}</div><div class="k">min</div></div><div class="stat"><div class="v">${st.sets}</div><div class="k">series</div></div><div class="stat"><div class="v">${st.reps}</div><div class="k">reps</div></div><div class="stat"><div class="v">${Math.round(M.toDisplay(st.volume, U())).toLocaleString('es-ES')}</div><div class="k">${U()} vol.</div></div></div>
    ${s.bodyweight ? `<div class="muted small">Peso corporal: ${W(s.bodyweight)}</div>` : ''}
    ${s.notes ? `<div class="card flat"><div class="eyebrow">Notas</div><p style="margin:6px 0 0">${esc(s.notes)}</p></div>` : ''}
    ${s.prs && s.prs.length ? `<div class="stack">${s.prs.map(p => `<div class="pr"><div><b>${esc(p.name)}</b><div class="small muted">${esc(M.PR_LABELS[p.key]?.label || p.key)}</div></div><span class="v">${esc(prValueFmt(p))}</span></div>`).join('')}</div>` : ''}
    ${sessionExercisesHTML(s)}
    <div class="grid2"><button class="btn" data-a="compareFrom" data-id="${s.id}">${ic('swap')} Comparar</button><button class="btn" data-a="repeatSession" data-id="${s.id}">${ic('restart')} Repetir</button></div>
  </div>`;
}

function sheetCompare(sh) {
  const a = S.sessions.find(x => x.id === sh.a), b = S.sessions.find(x => x.id === sh.b);
  const others = S.sessions.filter(x => x.endedAt && x.id !== sh.a).sort((x, y) => (y.templateId === a?.templateId) - (x.templateId === a?.templateId) || y.startedAt - x.startedAt);
  if (!a) return head('Comparar') + '<div class="sheet-body"><p>Sesión no encontrada.</p></div>';
  let table = '<p class="muted">Elige otra sesión para comparar.</p>';
  if (b) {
    const ids = [...new Set([...a.exercises, ...b.exercises].map(e => e.exerciseId))];
    const bwA = M.parseNum(a.bodyweight) || bw(), bwB = M.parseNum(b.bodyweight) || bw();
    const rows = ids.map(id => {
      const ea = a.exercises.find(e => e.exerciseId === id), eb = b.exercises.find(e => e.exerciseId === id);
      const A = ea ? M.entryFromSessionExercise(a, ea, bwA) : null, B = eb ? M.entryFromSessionExercise(b, eb, bwB) : null;
      const name = (ea || eb).name;
      const best = (E, ex) => E ? setBrief(E.bestSet, ex) : '—';
      const dv = A && B ? (A.volume - B.volume) : null;
      return `<tr><td>${esc(name)}</td><td>${esc(best(A, ea))}</td><td>${esc(best(B, eb))}</td><td>${A ? Math.round(M.toDisplay(A.volume, U())) : '—'}</td><td>${B ? Math.round(M.toDisplay(B.volume, U())) : '—'}</td><td class="${dv > 0 ? 'up' : dv < 0 ? 'down' : ''}">${dv === null ? '—' : (dv > 0 ? '+' : '') + Math.round(M.toDisplay(dv, U()))}</td></tr>`;
    }).join('');
    const sa = M.sessionStats(a, bw()), sb = M.sessionStats(b, bw());
    table = `<div class="grid2"><div class="stat"><div class="v">${volFmt(sa.volume)}</div><div class="k">A · ${esc(dateFmt(a.startedAt))}</div></div><div class="stat"><div class="v">${volFmt(sb.volume)}</div><div class="k">B · ${esc(dateFmt(b.startedAt))}</div></div></div>
      <div class="card table-wrap" style="margin-top:10px"><table class="cmp"><thead><tr><th>Ejercicio</th><th>Mejor A</th><th>Mejor B</th><th>Vol. A</th><th>Vol. B</th><th>Dif.</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">Volumen en ${U()}. «Mejor» es la serie con mayor 1RM estimado o, si no aplica, más repeticiones o tiempo.</p>`;
  }
  return head('Comparar sesiones') + `<div class="sheet-body stack">
    <div class="card flat"><b>A:</b> ${esc(a.templateName)} · ${esc(dateFmt(a.startedAt))}</div>
    <label class="field">Comparar con (B)<select class="input" data-f="cmpB"><option value="">Elige una sesión</option>${others.map(o => `<option value="${o.id}" ${o.id === sh.b ? 'selected' : ''}>${esc(dateFmt(o.startedAt, { day: 'numeric', month: 'short', year: '2-digit' }))} · ${esc(o.templateName)}</option>`).join('')}</select></label>
    ${table}</div>`;
}

// ======================= HISTORIAL =======================
function filteredSessions() {
  const f = S.histFilters;
  return S.sessions.filter(s => {
    if (!s.endedAt) return false;
    if (f.from && s.startedAt < new Date(f.from + 'T00:00').getTime()) return false;
    if (f.to && s.startedAt > new Date(f.to + 'T23:59:59').getTime()) return false;
    if (f.tpl && (s.templateId || '_free') !== f.tpl) return false;
    if (f.ex && !s.exercises.some(e => e.exerciseId === f.ex)) return false;
    if (f.group && !s.exercises.some(e => M.MUSCLE_GROUP[e.primary] === f.group)) return false;
    if (f.day && M.dayKey(s.startedAt) !== f.day) return false;
    return true;
  }).sort((a, b) => b.startedAt - a.startedAt);
}
function viewHistory() {
  const f = S.histFilters;
  const base = S.calMonth || (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); })();
  S.calMonth = base;
  const m = new Date(base);
  const first = (m.getDay() + 6) % 7;
  const daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const has = new Set(S.sessions.filter(s => s.endedAt).map(s => M.dayKey(s.startedAt)));
  const todayK = M.dayKey(Date.now());
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<span class="c out"></span>');
  for (let d = 1; d <= daysIn; d++) {
    const k = M.dayKey(new Date(m.getFullYear(), m.getMonth(), d));
    cells.push(`<button class="c ${has.has(k) ? 'has' : ''} ${k === todayK ? 'today' : ''} ${f.day === k ? 'sel' : ''}" data-a="calDay" data-k="${k}">${d}</button>`);
  }
  const monthCount = S.sessions.filter(s => s.endedAt && new Date(s.startedAt).getMonth() === m.getMonth() && new Date(s.startedAt).getFullYear() === m.getFullYear()).length;
  const list = filteredSessions();
  const tplOpts = [...new Map(S.sessions.map(s => [s.templateId || '_free', s.templateId ? s.templateName : 'Entrenamiento libre'])).entries()];
  const exUsed = [...new Map(S.sessions.flatMap(s => s.exercises.map(e => [e.exerciseId, e.name]))).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const groups = [...new Set(Object.values(M.MUSCLE_GROUP))];
  const anyF = f.from || f.to || f.tpl || f.ex || f.group || f.day;
  return `
    <div class="topbar"><h1>Historial</h1><button class="iconbtn" data-a="exportCSV" aria-label="Exportar CSV">${ic('download')}</button></div>
    <div class="card">
      <div class="row" style="margin-bottom:8px"><button class="iconbtn" data-a="calNav" data-d="-1" aria-label="Mes anterior">${ic('back')}</button><div style="flex:1;text-align:center;font-weight:700">${(s => s.charAt(0).toUpperCase() + s.slice(1))(m.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}<div class="muted small" style="font-weight:500;text-transform:none">${monthCount} entrenamiento${monthCount === 1 ? '' : 's'}</div></div><button class="iconbtn" data-a="calNav" data-d="1" aria-label="Mes siguiente">${ic('right')}</button></div>
      <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span class="h">${d}</span>`).join('')}${cells.join('')}</div>
    </div>
    <details class="card flat" style="margin-top:12px" ${anyF ? 'open' : ''}><summary style="font-weight:650;cursor:pointer">Filtrar${anyF ? ' (activos)' : ''}</summary>
      <div class="stack" style="margin-top:10px">
        <div class="grid2"><label class="field">Desde<input class="input" type="date" value="${esc(f.from || '')}" data-f="hf" data-k="from"></label><label class="field">Hasta<input class="input" type="date" value="${esc(f.to || '')}" data-f="hf" data-k="to"></label></div>
        <label class="field">Rutina<select class="input" data-f="hf" data-k="tpl"><option value="">Todas</option>${tplOpts.map(([v, l]) => `<option value="${esc(v)}" ${f.tpl === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="field">Ejercicio<select class="input" data-f="hf" data-k="ex"><option value="">Todos</option>${exUsed.map(([v, l]) => `<option value="${esc(v)}" ${f.ex === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="field">Grupo muscular<select class="input" data-f="hf" data-k="group"><option value="">Todos</option>${groups.map(g => `<option ${f.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
        ${anyF ? `<button class="btn" data-a="histClear">Quitar filtros</button>` : ''}
      </div></details>
    <h2>${f.day ? esc(dateFmt(new Date(f.day + 'T12:00').getTime(), { weekday: 'long', day: 'numeric', month: 'long' })) : 'Entrenamientos'} <span class="muted small">${list.length}</span></h2>
    ${list.length ? `<div class="stack">${list.slice(0, 200).map(sessionCard).join('')}</div>` : `<div class="empty">${ic('history')}<h3>${anyF ? 'Nada con estos filtros' : 'Sin entrenamientos'}</h3><p>${anyF ? 'Prueba a quitar algún filtro.' : 'Tus sesiones terminadas aparecerán aquí.'}</p></div>`}
  `;
}

// ======================= ESTADÍSTICAS =======================
function viewStats() {
  const done = S.sessions.filter(s => s.endedAt);
  if (!done.length) return `<div class="topbar"><h1>Progreso</h1></div><div class="empty">${ic('stats')}<h3>Aún no hay datos</h3><p>Completa entrenamientos para ver tu volumen semanal, series por grupo muscular, récords y gráficas de evolución.</p></div>`;
  const weeks = M.weeklySummary(S.sessions, 12, Date.now(), bw());
  const wlabel = w => new Date(w.weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' });
  const now = Date.now(), ws = M.weekStart(now);
  const range = S.statsRange || 'week';
  const from = range === 'week' ? ws : range === '4w' ? ws - 21 * 86400000 : ws - 77 * 86400000;
  const divisor = range === 'week' ? 1 : range === '4w' ? 4 : 12;
  const sbm = M.setsByMuscle(S.sessions, from, now + 1);
  const vbm = M.volumeByMuscle(S.sessions, from, now + 1, bw());
  const sbmRows = Object.entries(sbm).sort((a, b) => b[1] - a[1]);
  const maxS = Math.max(1, ...sbmRows.map(r => r[1] / divisor));
  const vbmRows = Object.entries(vbm).sort((a, b) => b[1] - a[1]);
  const maxV = Math.max(1, ...vbmRows.map(r => r[1]));
  const total = done.reduce((a, s) => { const st = M.sessionStats(s, bw()); a.d += st.duration; a.v += st.volume; return a; }, { d: 0, v: 0 });
  const avgFreq = M.round(weeks.slice(-4).reduce((a, w) => a + w.sessions, 0) / 4, 1);

  // ejercicios con historial
  const freq = {};
  done.forEach(s => s.exercises.forEach(e => { freq[e.exerciseId] = (freq[e.exerciseId] || 0) + 1; }));
  const exList = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
  if (!S.statsEx || !freq[S.statsEx]) S.statsEx = exList[0];
  const exName = id => exDef(id)?.name || done.flatMap(s => s.exercises).find(e => e.exerciseId === id)?.name || id;
  const def = exDef(S.statsEx) || done.flatMap(s => s.exercises).find(e => e.exerciseId === S.statsEx);

  // progresiones de calistenia alcanzadas
  const doneIds = new Set(exList);
  const chains = CHAINS.filter(c => c.length >= 3 && c.some(id => doneIds.has(id)));
  const chainHTML = chains.map(c => {
    let reached = -1; c.forEach((id, i) => { if (doneIds.has(id)) reached = i; });
    return `<div class="card flat"><div class="row"><b style="flex:1;font-size:14px">${esc(exDef(c[reached])?.name || '')}</b><span class="muted small">Nivel ${reached + 1} de ${c.length}</span></div><div class="tr" style="height:8px;border-radius:4px;background:var(--surface-2);margin-top:8px;overflow:hidden"><div style="height:100%;width:${((reached + 1) / c.length * 100).toFixed(0)}%;background:var(--accent)"></div></div>${c[reached + 1] && exDef(c[reached + 1]) ? `<div class="muted small" style="margin-top:6px">Siguiente: ${esc(exDef(c[reached + 1]).name)}</div>` : '<div class="muted small" style="margin-top:6px">Última progresión de la cadena</div>'}</div>`;
  }).join('');

  return `
    <div class="topbar"><h1>Progreso</h1></div>
    <div class="grid4">
      <div class="stat"><div class="v">${done.length}</div><div class="k">Entrenamientos</div></div>
      <div class="stat"><div class="v">${avgFreq.toLocaleString('es-ES')}</div><div class="k">Sesiones/semana (últimas 4)</div></div>
      <div class="stat"><div class="v">${M.round(total.d / 3600, 1).toLocaleString('es-ES')} h</div><div class="k">Tiempo entrenado</div></div>
      <div class="stat"><div class="v">${(v => v >= 100000 ? Math.round(v / 1000).toLocaleString('es-ES') + 'k' : Math.round(v).toLocaleString('es-ES'))(M.toDisplay(total.v, U()))}</div><div class="k">Volumen total (${U()})</div></div>
    </div>
    <h2>Volumen semanal</h2>
    <div class="card">${barChart(weeks.map((w, i) => ({ label: wlabel(w), value: Math.round(M.toDisplay(w.volume, U())), cur: i === weeks.length - 1 })), { title: 'Volumen semanal' })}<div class="muted small">Últimas 12 semanas, en ${U()}. La barra naranja es la semana actual.</div></div>
    <h2>Frecuencia semanal</h2>
    <div class="card">${barChart(weeks.map((w, i) => ({ label: wlabel(w), value: w.sessions, cur: i === weeks.length - 1 })), { title: 'Sesiones por semana', yFmt: v => String(Math.round(v)), integer: true })}<div class="muted small">Sesiones por semana · tiempo esta semana: ${M.fmtDuration(weeks[weeks.length - 1].duration)}</div></div>
    <h2>Por grupo muscular</h2>
    <div class="seg" style="margin-bottom:10px">${[['week', 'Esta semana'], ['4w', 'Media 4 sem.'], ['12w', 'Media 12 sem.']].map(([k, l]) => `<button class="${range === k ? 'on' : ''}" data-a="statsRange" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="card stack"><div class="eyebrow">Series efectivas${divisor > 1 ? ' por semana' : ''}</div>
      ${sbmRows.length ? sbmRows.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="tr"><div class="fl" style="width:${(v / divisor / maxS * 100).toFixed(1)}%"></div></div><b class="num">${M.round(v / divisor, 1)}</b></div>`).join('') : '<p class="muted small">Sin series en este periodo.</p>'}
      <div class="muted small">El músculo principal cuenta 1 serie y cada grupo secundario 0,5. Sin calentamientos.</div></div>
    <div class="card stack" style="margin-top:10px"><div class="eyebrow">Volumen (${U()}) en el periodo</div>
      ${vbmRows.length ? vbmRows.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="tr"><div class="fl" style="width:${(v / maxV * 100).toFixed(1)}%;background:var(--accent)"></div></div><b class="num">${Math.round(M.toDisplay(v, U())).toLocaleString('es-ES')}</b></div>`).join('') : '<p class="muted small">Sin volumen con carga en este periodo.</p>'}</div>
    <h2>Evolución por ejercicio</h2>
    <select class="input" data-f="statsEx">${exList.map(id => `<option value="${esc(id)}" ${id === S.statsEx ? 'selected' : ''}>${esc(exName(id))} (${freq[id]})</option>`).join('')}</select>
    <div style="margin-top:10px">${def ? exProgHTMLStats(def) : ''}</div>
    ${chainHTML ? `<h2>Progresiones de calistenia</h2><div class="stack">${chainHTML}</div>` : ''}
  `;
}
function exProgHTMLStats(def) {
  const hist = M.exerciseHistory(S.sessions, def.exerciseId || def.id, bw());
  const avail = metricsFor(def, hist);
  const mk = avail.includes(S.statsMetric) ? S.statsMetric : avail[0];
  if (!mk) return '';
  const m = METRICS[mk];
  const pts = hist.map(h => ({ x: h.date, y: m.get(h) })).filter(p => p.y !== null && p.y !== undefined).map(p => ({ x: p.x, y: m.w ? M.toDisplay(p.y, U()) : p.y }));
  const pr = M.personalRecords(hist);
  return `${avail.length > 1 ? `<div class="chips">${avail.map(k => `<button class="chip ${k === mk ? 'on' : ''}" data-a="statsMetric" data-k="${k}">${METRICS[k].label}</button>`).join('')}</div>` : ''}
    <div class="card" style="margin-top:8px">${lineChart(pts, { title: m.label, yFmt: m.t ? (v => M.fmtClock(v)) : undefined })}</div>
    <div class="row wrap" style="gap:6px;margin-top:8px">${Object.entries(M.PR_LABELS).filter(([k]) => pr[k] && k !== 'sessionVolume').map(([k, d]) => `<span class="badge ${d.kind === 'Fuerza' ? 'accent' : d.kind === 'Duración' ? 'data' : ''}">${esc(d.label)}: ${esc(k === 'maxSec' ? tFmt(pr[k].value) : ['maxReps', 'bwReps'].includes(k) ? pr[k].value + ' reps' : W(pr[k].value))}</span>`).join('')}</div>
    <button class="btn block" style="margin-top:10px" data-a="openEx" data-id="${esc(def.exerciseId || def.id)}">Ver ficha e historial completo</button>`;
}

// ======================= PERFIL Y AJUSTES =======================
function viewProfile() {
  const p = S.profile, st = S.settings;
  const seg = (key, opts, val, f = 'set') => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(val) === String(v) ? 'on' : ''}" data-a="${f}" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  const sw = (key, label, sub = '') => `<label class="switch"><span>${esc(label)}${sub ? `<br><span class="small muted">${esc(sub)}</span>` : ''}</span><input type="checkbox" data-f="setb" data-k="${key}" ${st[key] ? 'checked' : ''}></label>`;
  const equipKeys = Object.keys(M.EQUIPMENT).filter(k => k !== 'peso_corporal');
  const usage = S.storage;
  return `
    <div class="topbar"><h1>Perfil</h1></div>
    <div class="card stack">
      <label class="field">Nombre (opcional)<input class="input" value="${esc(p.name)}" data-f="pf" data-k="name" maxlength="40" autocomplete="given-name"></label>
      <div class="grid2">
        <label class="field">Edad (opcional)<input class="input" inputmode="numeric" value="${esc(p.age)}" data-f="pf" data-k="age" placeholder="—"></label>
        <label class="field">Peso corporal (${U()})<input class="input" inputmode="decimal" value="${esc(p.bodyweight === '' ? '' : wv(p.bodyweight))}" data-f="pfBw" placeholder="Opcional"></label>
      </div>
      <p class="muted small" style="margin:0">El peso corporal se usa para calcular la carga total en dominadas, fondos y demás ejercicios de peso corporal. Puedes cambiarlo en cada sesión.</p>
      <div class="field"><span>Nivel de experiencia</span>${seg('level', LEVELS.map(l => [l, l]), p.level, 'pset')}</div>
      <div class="field"><span>Días de entrenamiento por semana</span>${seg('daysPerWeek', [1, 2, 3, 4, 5, 6, 7].map(n => [n, n]), p.daysPerWeek, 'pset')}</div>
      <div class="field"><span>Objetivos</span><div class="row wrap" style="gap:6px">${GOALS.map(g => `<button class="chip ${p.goals.includes(g) ? 'on' : ''}" data-a="pGoal" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div></div>
      <div class="field"><span>Equipamiento disponible</span><div class="row wrap" style="gap:6px">${equipKeys.map(k => `<button class="chip ${p.equipment.includes(k) ? 'on' : ''}" data-a="pEquip" data-v="${k}">${esc(M.EQUIPMENT[k])}</button>`).join('')}</div></div>
      <label class="field">Preferencias y notas personales<textarea class="input" data-f="pf" data-k="notes" placeholder="Lesiones, preferencias de ejercicios, horarios…">${esc(p.notes)}</textarea></label>
    </div>

    <h2>Ajustes</h2>
    <div class="card stack">
      <div class="field"><span>Unidad de peso</span>${seg('unit', [['kg', 'Kilogramos'], ['lb', 'Libras']], st.unit)}</div>
      <div class="field"><span>Mostrar tiempos en</span>${seg('timeUnit', [['s', 'Segundos'], ['min', 'Minutos:segundos']], st.timeUnit)}</div>
      <div class="field"><span>Tema</span>${seg('theme', [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']], st.theme)}</div>
      <label class="field">Descanso por defecto<select class="input" data-f="setSel" data-k="defaultRest">${REST_OPTS.map(r => `<option value="${r}" ${st.defaultRest === r ? 'selected' : ''}>${restFmt(r)}</option>`).join('')}</select></label>
      ${sw('sound', 'Aviso sonoro al terminar el descanso', 'En iPhone no suena si el interruptor de silencio está activado.')}
      ${sw('vibrate', 'Vibración al terminar el descanso', canVibrate() ? '' : 'Safari en iPhone no permite vibrar desde una web; se usa un destello en pantalla.')}
      ${sw('keepAwake', 'Mantener la pantalla encendida durante el entrenamiento')}
      ${sw('suggestions', 'Sugerencias de progresión', 'Solo aparecen en ejercicios con progresión doble configurada y con historial previo.')}
      ${sw('showRpe', 'Registrar esfuerzo por serie')}
      ${st.showRpe ? `<div class="field"><span>Escala de esfuerzo</span>${seg('effortKind', [['rpe', 'RPE (1–10)'], ['rir', 'RIR (reps en reserva)']], st.effortKind)}</div>` : ''}
    </div>

    <h2>Datos</h2>
    <div class="card stack">
      <div class="muted small">${S.sessions.length} entrenamientos · ${S.templates.length} rutinas · ${S.custom.length} ejercicios propios. Guardado automático en este dispositivo${usage.fallback ? ' (modo reducido)' : ''}${usage.persisted ? ' con almacenamiento persistente' : ''}.${S.meta.lastBackup ? ` Última copia: ${esc(dateFmt(S.meta.lastBackup, { day: 'numeric', month: 'long', year: 'numeric' }))}.` : ' Aún no has hecho ninguna copia.'}</div>
      <button class="btn block primary" data-a="exportBackup">${ic('upload')} Exportar copia de seguridad</button>
      <button class="btn block" data-a="importBackup">${ic('download')} Restaurar copia de seguridad</button>
      <button class="btn block" data-a="exportCSV">${ic('download')} Exportar historial a CSV</button>
      <div class="grid2"><button class="btn" data-a="exportRoutines">Exportar rutinas</button><button class="btn" data-a="importRoutines">Importar rutinas</button></div>
      <button class="btn block danger" data-a="wipe">${ic('trash')} Borrar todos los datos</button>
      <p class="muted small" style="margin:0">Tus datos no salen de este dispositivo: no hay cuentas ni servidores. Guarda la copia en Archivos o iCloud Drive para poder recuperarla o pasarla a otro dispositivo.</p>
    </div>
    <p class="muted small" style="text-align:center;margin-top:18px">Forja ${APP_VERSION} · ${S.lib.length} ejercicios en la biblioteca</p>
  `;
}

// ======================= ejercicios personalizados =======================
function blankCustom() {
  return { id: M.uid('c_'), name: '', nameEn: '', alt: [], category: 'fw', equipment: [], primary: 'pecho', secondary: [], pattern: 'h_press', mechanic: 'compound', laterality: 'bilateral', load: 'weight', measure: 'reps', difficulty: 1, tags: [], easier: [], harder: [], tip: '', notes: '', steps: [], mistakes: [], image: '', custom: true };
}
function sheetExForm(sh) {
  const e = sh.draft;
  const errs = sh.errors || [];
  const opt = (obj, val) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${esc(typeof l === 'string' ? l : l.label)}</option>`).join('');
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(e[key]) === String(v) ? 'on' : ''}" data-a="cxSeg" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return head(sh.isNew ? 'Nuevo ejercicio' : 'Editar ejercicio', { left: `<button class="btn ghost" data-a="pop">Cancelar</button>`, right: `<button class="btn ghost" style="font-weight:700" data-a="cxSave">Guardar</button>` }) + `<div class="sheet-body stack">
    ${errs.length ? `<div class="errors"><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <label class="field">Nombre en español *<input class="input" value="${esc(e.name)}" data-f="cx" data-k="name" maxlength="80"></label>
    <div class="grid2"><label class="field">Nombre en inglés<input class="input" value="${esc(e.nameEn)}" data-f="cx" data-k="nameEn"></label><label class="field">Otros nombres<input class="input" value="${esc(e.alt.join(', '))}" data-f="cxAlt" placeholder="Separados por comas"></label></div>
    <div class="grid2"><label class="field">Categoría<select class="input" data-f="cx" data-k="category">${opt(M.CATEGORIES, e.category)}</select></label><label class="field">Músculo principal<select class="input" data-f="cx" data-k="primary">${opt(M.MUSCLES, e.primary)}</select></label></div>
    <div class="field"><span>Músculos secundarios</span><div class="row wrap" style="gap:6px">${Object.entries(M.MUSCLES).filter(([k]) => k !== e.primary).map(([k, l]) => `<button class="chip ${e.secondary.includes(k) ? 'on' : ''}" data-a="cxMulti" data-k="secondary" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
    <div class="field"><span>Equipamiento</span><div class="row wrap" style="gap:6px">${Object.entries(M.EQUIPMENT).map(([k, l]) => `<button class="chip ${e.equipment.includes(k) ? 'on' : ''}" data-a="cxMulti" data-k="equipment" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
    <div class="field"><span>¿Cómo se registra la carga?</span>${seg('load', [['weight', 'Peso'], ['bodyweight', 'Peso corporal'], ['band', 'Banda'], ['none', 'Sin carga']])}</div>
    <div class="field"><span>Se mide en</span>${seg('measure', [['reps', 'Repeticiones'], ['time', 'Tiempo']])}</div>
    <div class="field"><span>Tipo</span>${seg('mechanic', [['compound', 'Compuesto'], ['isolation', 'Aislamiento']])}</div>
    <div class="field"><span>Lateralidad</span>${seg('laterality', [['bilateral', 'Bilateral'], ['unilateral', 'Unilateral']])}</div>
    <div class="field"><span>Dificultad</span>${seg('difficulty', [[1, 'Principiante'], [2, 'Intermedio'], [3, 'Avanzado']])}</div>
    <div class="field"><span>Etiquetas</span><div class="row wrap" style="gap:6px">${['isometric', 'eccentric', 'plyometric'].map(k => `<button class="chip ${e.tags.includes(k) ? 'on' : ''}" data-a="cxMulti" data-k="tags" data-v="${k}">${TYPE_FILTERS[k]}</button>`).join('')}</div></div>
    <label class="field">Patrón de movimiento (para instrucciones por defecto)<select class="input" data-f="cx" data-k="pattern">${opt(PATTERNS, e.pattern)}</select></label>
    <label class="field">Instrucciones (una por línea)<textarea class="input" data-f="cxLines" data-k="steps" placeholder="Si lo dejas vacío se usan las del patrón">${esc((e.steps || []).join('\n'))}</textarea></label>
    <label class="field">Errores habituales (uno por línea)<textarea class="input" data-f="cxLines" data-k="mistakes">${esc((e.mistakes || []).join('\n'))}</textarea></label>
    <label class="field">Notas<textarea class="input" data-f="cx" data-k="notes">${esc(e.notes || '')}</textarea></label>
    <div class="field"><span>Imagen</span>${e.image ? `<div class="figure"><img src="${e.image}" alt=""></div><button class="btn sm danger" data-a="cxImgDel">Quitar imagen</button>` : ''}<button class="btn" data-a="cxImg">${ic('upload')} ${e.image ? 'Cambiar' : 'Añadir'} imagen</button></div>
  </div>`;
}

// ======================= ACCIONES (clics) =======================
const A = {
  tab(el) { S.tab = el.dataset.k; S.sheets = []; renderSheets(); render(); window.scrollTo(0, 0); },
  pop() { popSheet(); },
  openEx(el) { pushSheet('exDetail', { id: el.dataset.id, tab: 'info' }); },
  exTab(el) { sheet().tab = el.dataset.k; renderSheets(); },
  exMetric(el) { sheet().metric = el.dataset.k; renderSheets(); },
  toggleFav(el) { const id = el.dataset.id; if (S.favorites.has(id)) S.favorites.delete(id); else S.favorites.add(id); saveFavorites(); renderSheets(); },
  libToggle(el) { const k = el.dataset.k; S.libFilters[k] = !S.libFilters[k]; render(); },
  libCat(el) { S.libFilters.category = S.libFilters.category === el.dataset.k ? '' : el.dataset.k; render(); },
  libClear(el) { delete S.libFilters[el.dataset.k]; render(); },
  openFilters(el) { pushSheet('filters', { ctx: el.dataset.ctx }); },
  clearFilters() {
    const sh = sheet();
    if (sh.ctx === 'lib') S.libFilters = {}; else { const p = S.sheets.find(s => s.type === 'picker'); if (p) p.filters = {}; }
    popSheet();
  },
  newCustomEx() { pushSheet('exForm', { draft: blankCustom(), isNew: true }); },
  editCustomEx(el) { pushSheet('exForm', { draft: JSON.parse(JSON.stringify(exDef(el.dataset.id))), isNew: false }); },
  duplicateEx(el) {
    const src = exDef(el.dataset.id);
    const d = { ...blankCustom(), ...JSON.parse(JSON.stringify(src)), id: M.uid('c_'), name: src.name + ' (variante)', custom: true, easier: [], harder: [], steps: instructionsFor(src).steps, mistakes: instructionsFor(src).mistakes };
    delete d._search;
    pushSheet('exForm', { draft: d, isNew: true });
  },
  async deleteCustomEx(el) {
    const id = el.dataset.id;
    const used = S.templates.filter(t => t.items.some(i => i.exerciseId === id));
    if (used.length) { toast(`Se usa en: ${used.map(t => t.name).join(', ')}. Quítalo de esas rutinas primero.`, 3500); return; }
    if (!await confirmDlg({ title: 'Eliminar ejercicio', text: 'Los entrenamientos registrados con él se conservan.', ok: 'Eliminar', danger: true })) return;
    S.custom = S.custom.filter(e => e.id !== id); S.favorites.delete(id); await saveCustom(); saveFavorites(); rebuildIndex(); popSheet(); render();
  },
  cxSeg(el) { const d = sheet().draft; const k = el.dataset.k; d[k] = k === 'difficulty' ? Number(el.dataset.v) : el.dataset.v; renderSheets(); },
  cxMulti(el) { const d = sheet().draft; const k = el.dataset.k, v = el.dataset.v; d[k] = d[k].includes(v) ? d[k].filter(x => x !== v) : [...d[k], v]; renderSheets(); },
  async cxImg() {
    const f = await pickFile('image/*'); if (!f) return;
    try { sheet().draft.image = await resizeImage(f, 640); renderSheets(); } catch { toast('No se pudo cargar la imagen.'); }
  },
  cxImgDel() { sheet().draft.image = ''; renderSheets(); },
  async cxSave() {
    const sh = sheet(); const d = sh.draft;
    const errs = [];
    d.name = (d.name || '').trim();
    if (!d.name) errs.push('El nombre es obligatorio.');
    if (d.name && allExercises().some(e => e.id !== d.id && M.normalize(e.name) === M.normalize(d.name))) errs.push('Ya existe un ejercicio con ese nombre.');
    if (!d.equipment.length) errs.push('Elige al menos un equipamiento (o «Peso corporal»).');
    if (errs.length) { sh.errors = errs; renderSheets(); $('#sheets .sheet').scrollTop = 0; return; }
    delete d._search;
    const i = S.custom.findIndex(e => e.id === d.id);
    if (i >= 0) S.custom[i] = d; else S.custom.unshift(d);
    await saveCustom(); rebuildIndex();
    toast(sh.isNew ? 'Ejercicio creado' : 'Ejercicio guardado');
    popSheet();
    const pk = sheet();
    if (pk && pk.type === 'picker' && sh.isNew) { if (pk.mode === 'replace') { pk.selected = new Set([d.id]); A.pickConfirm(); return; } pk.selected.add(d.id); renderSheets(); }
    else if (!S.sheets.length) render();
  },

  // --- selector ---
  pickFor(el) {
    const target = el.dataset.target;
    pushSheet('picker', { mode: 'add', target, selected: new Set(), filters: {}, q: '' });
  },
  pickToggle(el) {
    const sh = sheet(); const id = el.dataset.id;
    if (sh.mode === 'replace') { sh.selected = new Set([id]); A.pickConfirm(); return; }
    if (sh.selected.has(id)) sh.selected.delete(id); else sh.selected.add(id);
    const row = el.querySelector('.check'); if (row) row.classList.toggle('on', sh.selected.has(id));
    const btn = $('[data-a="pickConfirm"]'); const n = sh.selected.size;
    if (btn) { btn.disabled = !n; btn.textContent = n ? `Añadir ${n} ejercicio${n > 1 ? 's' : ''}` : 'Selecciona ejercicios'; }
  },
  pickFilter(el) { const sh = sheet(); sh.filters[el.dataset.k] = !sh.filters[el.dataset.k]; renderSheets(); },
  pickCat(el) { const sh = sheet(); sh.filters.category = sh.filters.category === el.dataset.k ? '' : el.dataset.k; renderSheets(); },
  pickConfirm() {
    const pk = sheet(); const ids = [...pk.selected];
    S.sheets.pop();
    const parent = sheet();
    if (pk.target === 'tpl' && parent && parent.type === 'tplEdit') {
      const t = parent.draft;
      if (pk.mode === 'replace') { const it = t.items[pk.x]; const def = exDef(ids[0]); it.exerciseId = def.id; if (def.load === 'bodyweight') it.sets.forEach(s => { s.mode = s.mode || 'bw'; }); }
      else ids.forEach(id => t.items.push(newItem(exDef(id))));
    } else if (pk.target === 'session') {
      const sess = parent && parent.type === 'session' ? currentSess(parent) : S.active;
      if (pk.mode === 'replace') {
        const ex = sess.exercises[pk.x]; const def = exDef(ids[0]);
        Object.assign(ex, M.snapshotExercise(def));
        ex.sets = ex.sets.map(s => ({ ...s, done: false, mode: def.load === 'bodyweight' ? (s.mode || 'bw') : undefined, target: { ...(s.target || {}), suggested: undefined } }));
      } else {
        ids.forEach(id => {
          const def = exDef(id);
          sess.exercises.push({ uid: M.uid('x'), ...M.snapshotExercise(def), groupId: null, groupType: null, notes: '', restSec: S.settings.defaultRest, grip: '', sets: [M.blankSet(def), M.blankSet(def), M.blankSet(def)] });
        });
      }
      if (parent && parent.mode === 'live') saveActive();
    }
    renderSheets();
    setTimeout(() => { const el = $('#sheets .sheet'); if (el && pk.mode !== 'replace') el.scrollTop = el.scrollHeight; }, 30);
  },
  addExToActive(el) {
    const def = exDef(el.dataset.id);
    S.active.exercises.push({ uid: M.uid('x'), ...M.snapshotExercise(def), groupId: null, groupType: null, notes: '', restSec: S.settings.defaultRest, grip: '', sets: [M.blankSet(def), M.blankSet(def), M.blankSet(def)] });
    saveActive(); toast('Añadido al entrenamiento'); openSession();
  },

  // --- rutinas ---
  newTpl() { if (S.tab !== 'routines') { S.tab = 'routines'; render(); } pushSheet('tplEdit', { draft: newTemplate(), isNew: true, dirty: false }); },
  editTpl(el) { const t = S.templates.find(x => x.id === el.dataset.id); pushSheet('tplEdit', { draft: JSON.parse(JSON.stringify(t)), isNew: false }); },
  startTpl(el) { const t = S.templates.find(x => x.id === el.dataset.id); if (t) startSession(t); },
  startFree() { startSession(null); },
  async tplMenu(el) {
    const t = S.templates.find(x => x.id === el.dataset.id);
    const k = await menu(t.name, [
      { key: 'start', label: 'Empezar', icon: 'play' }, { key: 'edit', label: 'Editar', icon: 'edit' },
      { key: 'dup', label: 'Duplicar', icon: 'copy' }, { key: 'export', label: 'Exportar esta rutina', icon: 'share' },
      { key: 'del', label: 'Eliminar', icon: 'trash', danger: true },
    ]);
    if (k === 'start') startSession(t);
    if (k === 'edit') A.editTpl(el);
    if (k === 'dup') { const c = M.cloneTemplate(t); c.order = Date.now(); await saveTemplate(c); render(); toast('Rutina duplicada'); }
    if (k === 'export') exportRoutines([t]);
    if (k === 'del') { if (await confirmDlg({ title: `Eliminar «${t.name}»`, text: 'Tu historial de entrenamientos no se borra.', ok: 'Eliminar', danger: true })) { await deleteTemplate(t.id); render(); } }
  },
  async routinesMenu() {
    const k = await menu('Rutinas', [{ key: 'starters', label: 'Plantillas sugeridas', icon: 'book' }, { key: 'imp', label: 'Importar rutinas', icon: 'download' }, { key: 'exp', label: 'Exportar todas las rutinas', icon: 'upload' }]);
    if (k === 'starters') A.starters();
    if (k === 'imp') A.importRoutines();
    if (k === 'exp') A.exportRoutines();
  },
  async starters() {
    const k = await menu('Plantillas sugeridas', STARTER_TEMPLATES.map((t, i) => ({ key: i, label: t.name, sub: t.description })), 'Se añaden a tus rutinas para que las adaptes. No contienen datos tuyos.');
    if (k === null) return;
    const st = STARTER_TEMPLATES[k];
    const t = newTemplate(); t.name = st.name; t.description = st.description;
    for (const [id, n, rMin, rMax, rest, secs] of st.items) {
      const def = exDef(id); if (!def) continue;
      const it = newItem(def); it.restSec = rest;
      it.sets = Array.from({ length: n }, () => ({ id: M.uid('p'), type: 'normal', tech: '', reps: rMin ?? '', repsMax: rMax ?? '', weight: '', seconds: secs ?? '', rpe: '', rir: '', mode: def.load === 'bodyweight' ? 'bw' : undefined, band: '' }));
      if (rMin && rMax) it.progression = { mode: 'double', repMin: rMin, repMax: rMax, increment: def.load === 'bodyweight' ? 2.5 : (def.primary === 'cuadriceps' || def.primary === 'isquios' || def.primary === 'gluteos' ? 5 : 2.5) };
      t.items.push(it);
    }
    await saveTemplate(t); render(); toast(`«${t.name}» añadida`);
  },
  async assignDay(el) {
    const d = Number(el.dataset.d);
    const list = S.templates.filter(t => !t.archived);
    if (!list.length) { toast('Crea una rutina primero'); return; }
    const k = await menu(M.WEEKDAYS[d], list.map(t => ({ key: t.id, label: t.name, on: (t.days || []).includes(d) })), 'Marca o desmarca la rutina de este día');
    if (!k) return;
    const t = S.templates.find(x => x.id === k);
    t.days = (t.days || []).includes(d) ? t.days.filter(x => x !== d) : [...(t.days || []), d].sort();
    await saveTemplate(t); render();
  },
  tplDay(el) { const t = sheet().draft; const d = Number(el.dataset.d); t.days = (t.days || []).includes(d) ? t.days.filter(x => x !== d) : [...(t.days || []), d].sort(); sheet().dirty = true; renderSheets(); },
  tplAddSet(el) {
    const it = sheet().draft.items[+el.dataset.x];
    const def = exDef(it.exerciseId);
    const last = [...it.sets].reverse().find(s => s.type !== 'warmup') || it.sets[it.sets.length - 1];
    const ns = last ? { ...last, id: M.uid('p') } : { id: M.uid('p'), type: 'normal', tech: '', reps: '', repsMax: '', weight: '', seconds: '', rpe: '', rir: '', mode: def?.load === 'bodyweight' ? 'bw' : undefined, band: '' };
    if (el.dataset.t === 'warmup') { ns.type = 'warmup'; ns.tech = ''; it.sets.splice(it.sets.filter(s => s.type === 'warmup').length, 0, ns); }
    else { ns.type = 'normal'; it.sets.push(ns); }
    sheet().dirty = true; renderSheets();
  },
  tplDelSet(el) { const it = sheet().draft.items[+el.dataset.x]; it.sets.splice(+el.dataset.s, 1); sheet().dirty = true; renderSheets(); },
  tplMode(el) { const s = sheet().draft.items[+el.dataset.x].sets[+el.dataset.s]; s.mode = nextMode(s.mode); if (s.mode === 'bw') s.weight = ''; sheet().dirty = true; renderSheets(); },
  async tplSetMenu(el) { const it = sheet().draft.items[+el.dataset.x]; await setMenu(it.sets, +el.dataset.s, exDef(it.exerciseId), true); sheet().dirty = true; renderSheets(); },
  async tplProg(el) {
    const it = sheet().draft.items[+el.dataset.x];
    const p = it.progression || {};
    const def = exDef(it.exerciseId);
    const r = await formDlg('Progresión doble', [
      { key: 'mode', label: 'Método', type: 'select', value: p.mode || 'double', options: [['double', 'Progresión doble (reps → peso)'], ['none', 'Sin progresión automática']] },
      { key: 'repMin', label: 'Repeticiones mínimas', value: p.repMin ?? (it.sets[0]?.reps || 8), inputmode: 'numeric' },
      { key: 'repMax', label: 'Repeticiones máximas', value: p.repMax ?? (it.sets[0]?.repsMax || 12), inputmode: 'numeric' },
      { key: 'increment', label: def?.load === 'bodyweight' ? `Incremento de lastre / reducción de asistencia (${U()})` : `Incremento de peso (${U()})`, value: p.increment !== undefined ? wv(p.increment) : (U() === 'kg' ? 2.5 : 5), inputmode: 'decimal' },
    ], 'Guardar', 'Cuando completes todas las series con las repeticiones máximas, se te sugerirá subir el peso y volver al mínimo. Nunca se aplica sin tu confirmación.');
    if (!r) return;
    if (r.mode === 'none') it.progression = null;
    else {
      const min = M.parseNum(r.repMin), max = M.parseNum(r.repMax), inc = M.fromDisplay(r.increment, U());
      if (!min || !max || min > max) { toast('El rango de repeticiones no es válido'); return; }
      it.progression = { mode: 'double', repMin: min, repMax: max, increment: inc || 0 };
      it.sets.forEach(s => { if (s.type !== 'warmup' && def.measure !== 'time') { s.reps = min; s.repsMax = max; } });
    }
    sheet().dirty = true; renderSheets();
  },
  async tplItemMenu(el) {
    const t = sheet().draft; const xi = +el.dataset.x; const it = t.items[xi];
    const grouped = !!it.groupId;
    const k = await menu(exDef(it.exerciseId)?.name || 'Ejercicio', [
      { key: 'up', label: 'Subir', icon: 'up' }, { key: 'down', label: 'Bajar', icon: 'dn' },
      xi < t.items.length - 1 ? { key: 'group', label: grouped ? 'Añadir el siguiente al grupo' : 'Superserie con el siguiente', icon: 'link' } : null,
      grouped ? { key: 'ungroup', label: 'Sacar del grupo', icon: 'unlink' } : null,
      { key: 'replace', label: 'Sustituir ejercicio', icon: 'swap' }, { key: 'dup', label: 'Duplicar', icon: 'copy' },
      { key: 'del', label: 'Eliminar', icon: 'trash', danger: true },
    ].filter(Boolean));
    if (!k) return;
    if (k === 'up' && xi > 0) [t.items[xi - 1], t.items[xi]] = [t.items[xi], t.items[xi - 1]];
    if (k === 'down' && xi < t.items.length - 1) [t.items[xi + 1], t.items[xi]] = [t.items[xi], t.items[xi + 1]];
    if (k === 'group') {
      const next = t.items[xi + 1];
      let gid = it.groupId;
      if (!gid) { gid = M.uid('g'); t.groups = t.groups || []; t.groups.push({ id: gid, type: 'superset' }); it.groupId = gid; }
      if (next.groupId && next.groupId !== gid) { const old = next.groupId; t.items.forEach(x => { if (x.groupId === old) x.groupId = gid; }); }
      next.groupId = gid;
      const n = t.items.filter(x => x.groupId === gid).length;
      const g = t.groups.find(x => x.id === gid);
      if (g && n === 3 && g.type === 'superset') g.type = 'triset';
      if (g && n >= 4 && (g.type === 'superset' || g.type === 'triset')) g.type = 'circuit';
    }
    if (k === 'ungroup') it.groupId = null;
    if (k === 'replace') { pushSheet('picker', { mode: 'replace', target: 'tpl', x: xi, selected: new Set(), filters: {}, q: '' }); return; }
    if (k === 'dup') t.items.splice(xi + 1, 0, { ...JSON.parse(JSON.stringify(it)), uid: M.uid('i'), groupId: null });
    if (k === 'del') t.items.splice(xi, 1);
    normalizeGroups(t); sheet().dirty = true; renderSheets();
  },
  tplDelItem(el) { sheet().draft.items.splice(+el.dataset.x, 1); renderSheets(); },
  async tplSave() {
    const sh = sheet(); const t = sh.draft;
    t.name = (t.name || '').trim();
    normalizeGroups(t);
    t.items.forEach(i => i.sets.forEach(x => { delete x._auto; }));
    const errs = M.validateTemplate(t);
    if (!t.items.length) errs.push('Añade al menos un ejercicio.');
    if (errs.length) { sh.errors = errs; renderSheets(); $('#sheets .sheet').scrollTop = 0; return; }
    try { await saveTemplate(t); } catch { toast('No se pudo guardar la rutina'); return; }
    toast('Rutina guardada'); popSheet(); render();
  },
  async tplCancel() {
    const sh = sheet();
    if (sh.dirty && !await confirmDlg({ title: '¿Descartar cambios?', ok: 'Descartar', cancel: 'Seguir editando', danger: true })) return;
    popSheet();
  },
  async tplDelete() {
    const t = sheet().draft;
    if (!await confirmDlg({ title: `Eliminar «${t.name}»`, text: 'Tu historial de entrenamientos no se borra.', ok: 'Eliminar', danger: true })) return;
    await deleteTemplate(t.id); popSheet(); render();
  },

  // --- sesión ---
  openSession() { openSession(); },
  minimize() { S.sheets = S.sheets.filter(s => s.type !== 'session'); renderSheets(); render(); },
  async sDone(el) {
    unlockAudio();
    const sh = sheet(); const sess = currentSess(sh);
    const xi = +el.dataset.x, si = +el.dataset.s;
    const r = completeSet(sess, xi, si);
    if (!r.ok) { toast(r.msg); const row = $(`[data-row="${xi}-${si}"] input`); if (row) row.focus(); return; }
    const ex = sess.exercises[xi];
    const rowEl = $(`[data-row="${xi}-${si}"]`);
    if (rowEl) {
      const nums = workingNumbering(ex.sets);
      const prev = lastSessionEx(ex.exerciseId, sess.id);
      const tmp = document.createElement('div');
      tmp.innerHTML = sessionSetRow(ex, xi, ex.sets[si], si, nums[si], prev ? prev.ex.sets.filter(s => s.done)[si] : null);
      rowEl.replaceWith(tmp.firstElementChild);
    }
    refreshLiveStats(sess);
    if (sh.mode === 'live') {
      saveActive();
      if (!r.undone) {
        if (S.settings.vibrate) vibrate(30);
        const nextSet = ex.sets[si + 1];
        const skip = M.skipRestInGroup(sess.exercises, xi) || (nextSet && nextSet.type === 'drop');
        if (!skip) startRest(Number(ex.restSec) || 0, ex.uid);
        else { S.active.timer = null; renderRestbar(); }
      }
    }
  },
  copyPrev(el) {
    const sh = sheet(); const sess = currentSess(sh); const xi = +el.dataset.x, si = +el.dataset.s;
    const ex = sess.exercises[xi]; const prev = lastSessionEx(ex.exerciseId, sess.id);
    const p = prev && prev.ex.sets.filter(s => s.done)[si]; if (!p) return;
    const s = ex.sets[si];
    s.weight = p.weight; s.reps = p.reps; s.seconds = p.seconds; s.mode = p.mode; s.band = p.band;
    if (sh.mode === 'live') saveActive();
    renderSheets();
  },
  sMode(el) {
    const sh = sheet(); const s = currentSess(sh).exercises[+el.dataset.x].sets[+el.dataset.s];
    s.mode = nextMode(s.mode); if (s.mode === 'bw') s.weight = '';
    if (sh.mode === 'live') saveActive();
    renderSheets();
    if (s.mode !== 'bw') setTimeout(() => { const i = $(`[data-row="${el.dataset.x}-${el.dataset.s}"] [data-f="sw"]`); if (i) i.focus(); }, 30);
  },
  sAddSet(el) {
    const sh = sheet(); const ex = currentSess(sh).exercises[+el.dataset.x];
    const last = ex.sets[ex.sets.length - 1];
    const ns = M.blankSet(ex);
    if (last) { ns.weight = last.weight; ns.mode = last.mode; ns.band = last.band; ns.target = { ...(last.target || {}), suggested: undefined }; ns.type = last.type === 'warmup' ? 'normal' : last.type; }
    ex.sets.push(ns);
    if (sh.mode === 'live') saveActive();
    renderSheets();
  },
  async sSetMenu(el) {
    const sh = sheet(); const ex = currentSess(sh).exercises[+el.dataset.x];
    await setMenu(ex.sets, +el.dataset.s, ex, false);
    if (sh.mode === 'live') saveActive();
    renderSheets();
  },
  applySug(el) {
    const sh = sheet(); const ex = currentSess(sh).exercises[+el.dataset.x];
    ex.sets.forEach(s => { const g = s.target && s.target.suggested; if (g && !s.done && s.type !== 'warmup') { s.weight = g.weight; if (g.reps && ex.measure !== 'time') s.reps = g.reps; if (g.mode) s.mode = g.mode; } });
    if (sh.mode === 'live') saveActive();
    toast('Sugerencia aplicada. Puedes cambiar cualquier valor.');
    renderSheets();
  },
  async sRest(el) {
    const ex = S.active.exercises[+el.dataset.x];
    const k = await menu(`Descanso · ${ex.name}`, REST_OPTS.map(r => ({ key: String(r), label: restFmt(r), on: Number(ex.restSec) === r })));
    if (k === null) return;
    ex.restSec = Number(k); saveActive(); renderSheets();
  },
  sUnskip(el) { const sh = sheet(); currentSess(sh).exercises[+el.dataset.x].skipped = false; if (sh.mode === 'live') saveActive(); renderSheets(); },
  async sExMenu(el) {
    const sh = sheet(); const sess = currentSess(sh); const xi = +el.dataset.x; const ex = sess.exercises[xi];
    const showGrip = ['v_pull', 'h_row', 'curl', 'dip', 'h_press', 'pushup'].includes(ex.pattern);
    const k = await menu(ex.name, [
      { key: 'note', label: ex.notes || sh.showNotes?.[xi] ? 'Editar nota' : 'Añadir nota', icon: 'note' },
      showGrip ? { key: 'grip', label: `Agarre${ex.grip ? ': ' + ex.grip : ''}`, icon: 'edit' } : null,
      { key: 'replace', label: 'Sustituir ejercicio', icon: 'swap' },
      { key: 'up', label: 'Mover arriba', icon: 'up' }, { key: 'down', label: 'Mover abajo', icon: 'dn' },
      sh.mode === 'live' ? { key: 'skip', label: ex.skipped ? 'Recuperar ejercicio' : 'Saltar ejercicio', icon: 'skipEx' } : null,
      xi < sess.exercises.length - 1 ? { key: 'group', label: ex.groupId ? 'Añadir el siguiente al grupo' : 'Superserie con el siguiente', icon: 'link' } : null,
      ex.groupId ? { key: 'ungroup', label: 'Sacar del grupo', icon: 'unlink' } : null,
      { key: 'info', label: 'Ver ficha', icon: 'info' },
      { key: 'del', label: 'Eliminar del entrenamiento', icon: 'trash', danger: true },
    ].filter(Boolean));
    if (!k) return;
    if (k === 'note') { sh.showNotes = { ...(sh.showNotes || {}), [xi]: true }; renderSheets(); setTimeout(() => { const i = $(`[data-f="sNote"][data-x="${xi}"]`); if (i) i.focus(); }, 30); return; }
    if (k === 'grip') { const g = await menu('Agarre', M.GRIPS.map(x => ({ key: x || '_', label: x || 'Sin especificar', on: ex.grip === x }))); if (g !== null) ex.grip = g === '_' ? '' : g; }
    if (k === 'replace') { pushSheet('picker', { mode: 'replace', target: 'session', x: xi, selected: new Set(), filters: {}, q: '' }); return; }
    if (k === 'up' && xi > 0) [sess.exercises[xi - 1], sess.exercises[xi]] = [sess.exercises[xi], sess.exercises[xi - 1]];
    if (k === 'down' && xi < sess.exercises.length - 1) [sess.exercises[xi + 1], sess.exercises[xi]] = [sess.exercises[xi], sess.exercises[xi + 1]];
    if (k === 'skip') ex.skipped = !ex.skipped;
    if (k === 'group') {
      const next = sess.exercises[xi + 1]; const gid = ex.groupId || M.uid('g');
      ex.groupId = gid; ex.groupType = ex.groupType || 'superset';
      if (next.groupId && next.groupId !== gid) { const old = next.groupId; sess.exercises.forEach(x => { if (x.groupId === old) { x.groupId = gid; } }); }
      next.groupId = gid;
      const n = sess.exercises.filter(x => x.groupId === gid).length;
      const type = n >= 4 ? 'circuit' : n === 3 ? 'triset' : (ex.groupType || 'superset');
      sess.exercises.forEach(x => { if (x.groupId === gid) x.groupType = type; });
    }
    if (k === 'ungroup') { ex.groupId = null; ex.groupType = null; normalizeSessGroups(sess); }
    if (k === 'info') { pushSheet('exDetail', { id: ex.exerciseId, tab: 'info' }); return; }
    if (k === 'del') {
      if (ex.sets.some(s => s.done) && !await confirmDlg({ title: 'Eliminar ejercicio', text: 'Tiene series completadas que se perderán.', ok: 'Eliminar', danger: true })) return;
      sess.exercises.splice(xi, 1); normalizeSessGroups(sess);
    }
    if (sh.mode === 'live') saveActive();
    renderSheets();
  },
  async finish() { await finishSession(); },
  async discard() {
    if (!await confirmDlg({ title: '¿Descartar entrenamiento?', text: 'Se perderán todas las series de esta sesión.', ok: 'Descartar', danger: true })) return;
    S.active = null; await saveActive(true); keepAwake(false); S.sheets = []; renderSheets(); render(); toast('Entrenamiento descartado');
  },
  restAdj(el) { const t = S.active.timer; if (!t) return; const d = Number(el.dataset.d); if (t.paused !== null && t.paused !== undefined) t.paused = Math.max(0, t.paused + d); else t.endAt += d * 1000; t.duration = Math.max(1, t.duration + d); saveActive(); tick(); },
  restPause() { const t = S.active.timer; if (!t) return; if (t.paused !== null && t.paused !== undefined) { t.endAt = Date.now() + t.paused * 1000; t.paused = null; } else t.paused = restRemaining(t); saveActive(); renderRestbar(); },
  restRestart() { const t = S.active.timer; if (!t) return; t.endAt = Date.now() + t.duration * 1000; t.paused = null; saveActive(); renderRestbar(); },
  restSkip() { S.active.timer = null; saveActive(); renderRestbar(); },
  async restSet() {
    const t = S.active.timer; if (!t) return;
    const k = await menu('Duración del descanso', REST_OPTS.filter(r => r).map(r => ({ key: String(r), label: restFmt(r) })));
    if (k === null) return;
    t.duration = Number(k); t.endAt = Date.now() + t.duration * 1000; t.paused = null;
    const ex = S.active.exercises.find(e => e.uid === t.exUid);
    if (ex && await confirmDlg({ title: `¿Usar ${restFmt(t.duration)} en ${ex.name}?`, text: 'Se aplicará al resto de series de este ejercicio en esta sesión.', ok: 'Sí', cancel: 'Solo esta vez' })) ex.restSec = t.duration;
    saveActive(); renderRestbar(); renderSheets();
  },
  async saveEdit() {
    const sh = sheet(); const d = sh.draft;
    const bad = [];
    d.exercises.forEach(ex => ex.sets.forEach((s, i) => { if (s.done) { const e = M.validateSetInput(s, ex); if (e.length) bad.push(`${ex.name}, serie ${i + 1}: ${e[0]}`); } }));
    if (bad.length) { toast(bad[0], 3500); return; }
    d.exercises = d.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length);
    d.bodyweight = M.parseNum(d.bodyweight) ?? '';
    await saveSession(d); toast('Cambios guardados'); popSheet(); render();
  },

  // --- historial y detalle ---
  openSessionDetail(el) { pushSheet('sessionDetail', { id: el.dataset.id }); },
  async sessDetailMenu(el) {
    const s = S.sessions.find(x => x.id === el.dataset.id);
    const k = await menu(s.templateName, [{ key: 'edit', label: 'Editar entrenamiento', icon: 'edit' }, { key: 'cmp', label: 'Comparar con otra sesión', icon: 'swap' }, { key: 'repeat', label: 'Repetir este entrenamiento', icon: 'restart' }, { key: 'del', label: 'Eliminar del historial', icon: 'trash', danger: true }]);
    if (k === 'edit') pushSheet('session', { mode: 'edit', draft: JSON.parse(JSON.stringify(s)) });
    if (k === 'cmp') A.compareFrom(el);
    if (k === 'repeat') A.repeatSession(el);
    if (k === 'del' && await confirmDlg({ title: 'Eliminar entrenamiento', text: 'Se borrará del historial y de las estadísticas. No se puede deshacer.', ok: 'Eliminar', danger: true })) { await deleteSession(s.id); popSheet(); render(); toast('Entrenamiento eliminado'); }
  },
  compareFrom(el) { const a = S.sessions.find(x => x.id === el.dataset.id); const b = S.sessions.find(x => x.endedAt && x.id !== a.id && x.templateId && x.templateId === a.templateId && x.startedAt < a.startedAt); pushSheet('compare', { a: a.id, b: b ? b.id : '' }); },
  repeatSession(el) {
    const s = S.sessions.find(x => x.id === el.dataset.id);
    const tpl = { id: s.templateId, name: s.templateName, groups: [], items: s.exercises.map(ex => ({ uid: M.uid('i'), exerciseId: ex.exerciseId, groupId: ex.groupId, notes: '', restSec: ex.restSec, grip: ex.grip, sets: ex.sets.map(st => ({ type: st.type, tech: st.tech, reps: st.reps, weight: st.weight, seconds: st.seconds, mode: st.mode, band: st.band })) })) };
    const gids = [...new Set(s.exercises.map(e => e.groupId).filter(Boolean))];
    tpl.groups = gids.map(g => ({ id: g, type: s.exercises.find(e => e.groupId === g).groupType || 'superset' }));
    if (!S.active) { S.sheets = []; renderSheets(); }
    startSession(tpl);
  },
  calNav(el) { const m = new Date(S.calMonth); m.setMonth(m.getMonth() + Number(el.dataset.d)); S.calMonth = m.getTime(); render(); },
  calDay(el) { S.histFilters.day = S.histFilters.day === el.dataset.k ? '' : el.dataset.k; render(); },
  histClear() { S.histFilters = {}; render(); },
  statsRange(el) { S.statsRange = el.dataset.k; render(); },
  statsMetric(el) { S.statsMetric = el.dataset.k; render(); },
  async updateTplFromSession(el) {
    const s = S.sessions.find(x => x.id === el.dataset.id); const t = S.templates.find(x => x.id === s.templateId); if (!t) return;
    const used = new Set();
    let n = 0;
    for (const ex of s.exercises) {
      const it = t.items.find(i => i.exerciseId === ex.exerciseId && !used.has(i.uid)); if (!it) continue; used.add(it.uid);
      ex.sets.forEach((st, i) => { const ps = it.sets[i]; if (!ps || ps.type !== st.type) return; if (ex.load !== 'none' && ex.load !== 'band') { ps.weight = st.weight; if (ex.load === 'bodyweight') ps.mode = st.mode; } if (ex.load === 'band') ps.band = st.band; if (ex.measure === 'time') ps.seconds = st.seconds; n++; });
    }
    await saveTemplate(t); toast(n ? `Rutina actualizada (${n} series)` : 'No había series que actualizar');
  },

  // --- perfil y ajustes ---
  set(el) { S.settings[el.dataset.k] = el.dataset.v; saveSettings(); if (el.dataset.k === 'theme') applyTheme(); render(); },
  pset(el) { S.profile[el.dataset.k] = S.profile[el.dataset.k] === el.dataset.v ? '' : el.dataset.v; saveProfile(); render(); },
  pGoal(el) { const v = el.dataset.v; S.profile.goals = S.profile.goals.includes(v) ? S.profile.goals.filter(x => x !== v) : [...S.profile.goals, v]; saveProfile(); render(); },
  pEquip(el) { const v = el.dataset.v; S.profile.equipment = S.profile.equipment.includes(v) ? S.profile.equipment.filter(x => x !== v) : [...S.profile.equipment, v]; saveProfile(); render(); },
  exportBackup() { exportBackup(); },
  importBackup() { importBackup(); },
  exportCSV() { exportCSV(); },
  exportRoutines() { exportRoutines(S.templates); },
  importRoutines() { importRoutines(); },
  async wipe() {
    if (!await confirmDlg({ title: '¿Borrar todos los datos?', text: 'Se eliminarán rutinas, historial, perfil y ejercicios propios de este dispositivo.', ok: 'Continuar', danger: true })) return;
    if (!await confirmDlg({ title: 'Última confirmación', text: 'Esta acción no se puede deshacer. Si no tienes copia de seguridad, perderás tu historial.', ok: 'Borrar todo', danger: true })) return;
    await DB.clearAll();
    Object.assign(S, { profile: { ...DEFAULT_PROFILE }, settings: { ...DEFAULT_SETTINGS }, favorites: new Set(), custom: [], templates: [], sessions: [], active: null, meta: { lastBackup: null }, sheets: [] });
    rebuildIndex(); applyTheme(); renderSheets(); render(); toast('Datos borrados');
  },
};

function nextMode(m) { return m === 'bw' || !m ? 'added' : m === 'added' ? 'assist' : 'bw'; }

function normalizeSessGroups(sess) {
  const counts = {};
  sess.exercises.forEach(e => { if (e.groupId) counts[e.groupId] = (counts[e.groupId] || 0) + 1; });
  sess.exercises.forEach(e => { if (e.groupId && counts[e.groupId] < 2) { e.groupId = null; e.groupType = null; } });
}

async function setMenu(sets, si, def, isTpl) {
  const s = sets[si];
  const k = await menu(`Serie ${si + 1}`, [
    ...Object.entries(M.SET_TYPES).map(([t, d]) => ({ key: 'type:' + t, label: d.label, on: s.type === t })),
    { key: 'tech', label: `Técnica: ${M.TECHNIQUES[s.tech || '']}`, icon: 'edit' },
    { key: 'effort', label: `Objetivo de esfuerzo${s.target?.rpe || s.rpe ? ` · RPE ${(isTpl ? s.rpe : s.target?.rpe) || ''}` : ''}${(isTpl ? s.rir : s.target?.rir) !== '' && (isTpl ? s.rir : s.target?.rir) !== undefined ? ` · RIR ${isTpl ? s.rir : s.target.rir}` : ''}`, icon: 'chartLine' },
    !isTpl ? { key: 'real', label: 'Esfuerzo real (RPE / RIR)', icon: 'flame' } : null,
    { key: 'dup', label: 'Duplicar serie', icon: 'copy' },
    { key: 'del', label: 'Eliminar serie', icon: 'trash', danger: true },
  ].filter(Boolean));
  if (!k) return;
  if (k.startsWith('type:')) s.type = k.slice(5);
  if (k === 'tech') { const t = await menu('Técnica especial', Object.entries(M.TECHNIQUES).map(([kk, l]) => ({ key: kk || '_', label: l, on: (s.tech || '') === kk }))); if (t !== null) s.tech = t === '_' ? '' : t; }
  if (k === 'effort') {
    const tgt = isTpl ? s : (s.target = s.target || {});
    const r = await formDlg('Objetivo de esfuerzo', [{ key: 'rpe', label: 'RPE objetivo (1–10)', value: tgt.rpe ?? '', inputmode: 'decimal' }, { key: 'rir', label: 'RIR objetivo (repeticiones en reserva)', value: tgt.rir ?? '', inputmode: 'decimal' }]);
    if (r) {
      const rpe = r.rpe === '' ? '' : M.parseNum(r.rpe), rir = r.rir === '' ? '' : M.parseNum(r.rir);
      if ((rpe !== '' && (rpe === null || rpe < 1 || rpe > 10)) || (rir !== '' && (rir === null || rir < 0 || rir > 10))) toast('RPE entre 1 y 10, RIR entre 0 y 10');
      else { tgt.rpe = rpe; tgt.rir = rir; }
    }
  }
  if (k === 'real') {
    const r = await formDlg('Esfuerzo real', [{ key: 'rpe', label: 'RPE (1–10)', value: s.rpe ?? '', inputmode: 'decimal' }, { key: 'rir', label: 'RIR', value: s.rir ?? '', inputmode: 'decimal' }]);
    if (r) { const rpe = r.rpe === '' ? '' : M.parseNum(r.rpe), rir = r.rir === '' ? '' : M.parseNum(r.rir); if ((rpe !== '' && (rpe === null || rpe < 1 || rpe > 10)) || (rir !== '' && (rir === null || rir < 0))) toast('Valor no válido'); else { s.rpe = rpe; s.rir = rir; } }
  }
  if (k === 'dup') sets.splice(si + 1, 0, { ...JSON.parse(JSON.stringify(s)), id: M.uid(isTpl ? 'p' : 's'), done: false, doneAt: null });
  if (k === 'del') {
    if (sets.length === 1) { toast('El ejercicio necesita al menos una serie. Elimina el ejercicio si no lo vas a hacer.'); return; }
    sets.splice(si, 1);
  }
}

// ======================= CAMPOS (input/change) =======================
let libT, pickT;
const F = {
  libq(el) { S.libQuery = el.value; clearTimeout(libT); libT = setTimeout(renderLibList, 120); },
  pickq(el) { sheet().q = el.value; clearTimeout(pickT); pickT = setTimeout(renderPickerList, 120); },
  filt(el) {
    const sh = sheet();
    const target = sh.ctx === 'lib' ? S.libFilters : S.sheets.find(s => s.type === 'picker').filters;
    target[el.dataset.k] = el.value;
  },
  filtb(el) { const sh = sheet(); const target = sh.ctx === 'lib' ? S.libFilters : S.sheets.find(s => s.type === 'picker').filters; target[el.dataset.k] = el.checked; },
  // plantilla
  tplName(el) { sheet().draft.name = el.value; sheet().dirty = true; },
  tplDesc(el) { sheet().draft.description = el.value; sheet().dirty = true; },
  tplNote(el) { sheet().draft.items[+el.dataset.x].notes = el.value; sheet().dirty = true; },
  tplRest(el) { sheet().draft.items[+el.dataset.x].restSec = Number(el.value); sheet().dirty = true; },
  tplGrip(el) { sheet().draft.items[+el.dataset.x].grip = el.value; sheet().dirty = true; },
  tplGroupType(el) { const g = sheet().draft.groups.find(x => x.id === el.dataset.g); if (g) g.type = el.value; sheet().dirty = true; },
  tplW(el) {
    const it = sheet().draft.items[+el.dataset.x]; const si = +el.dataset.s; const s = it.sets[si];
    s.weight = el.value === '' ? '' : (M.fromDisplay(el.value, U()) ?? s.weight); sheet().dirty = true;
    // propaga a las series siguientes del mismo tipo que estén vacías (sin re-renderizar el campo activo)
    it.sets.forEach((o, j) => { if (j > si && o.type === s.type && (o.weight === '' || o.weight === undefined || o._auto) && (o.mode || 'bw') === (s.mode || 'bw')) { o.weight = s.weight; o._auto = true; const inp = document.querySelector(`[data-f="tplW"][data-x="${el.dataset.x}"][data-s="${j}"]`); if (inp) inp.value = s.weight === '' ? '' : wv(s.weight); } });
    delete s._auto;
  },
  tplBand(el) { sheet().draft.items[+el.dataset.x].sets[+el.dataset.s].band = el.value; sheet().dirty = true; },
  tplReps(el) {
    const s = sheet().draft.items[+el.dataset.x].sets[+el.dataset.s];
    const v = el.value.trim();
    const m = v.match(/^(\d+)\s*[-–a]\s*(\d+)$/);
    if (m) { s.reps = Number(m[1]); s.repsMax = Number(m[2]); } else { s.reps = v === '' ? '' : (M.parseNum(v) ?? v); s.repsMax = ''; }
    sheet().dirty = true;
  },
  tplSec(el) { const s = sheet().draft.items[+el.dataset.x].sets[+el.dataset.s]; s.seconds = el.value === '' ? '' : (parseTime(el.value) ?? s.seconds); sheet().dirty = true; },
  tplEffort(el) { const s = sheet().draft.items[+el.dataset.x].sets[+el.dataset.s]; const v = el.value === '' ? '' : M.parseNum(el.value); if (S.settings.effortKind === 'rir') s.rir = v ?? ''; else s.rpe = v ?? ''; sheet().dirty = true; },
  // sesión
  sw(el) { sessField(el, (s) => { s.weight = el.value === '' ? '' : (M.fromDisplay(el.value, U()) ?? s.weight); }); },
  sr(el) { sessField(el, (s) => { s.reps = el.value === '' ? '' : (M.parseNum(el.value) ?? s.reps); }); },
  ss(el) { sessField(el, (s) => { s.seconds = el.value === '' ? '' : (parseTime(el.value) ?? s.seconds); }); },
  sband(el) { sessField(el, (s) => { s.band = el.value; }); },
  sEffort(el) { sessField(el, (s) => { const v = el.value === '' ? '' : M.parseNum(el.value); if (S.settings.effortKind === 'rir') s.rir = v ?? ''; else s.rpe = v ?? ''; }); },
  sNote(el) { const sh = sheet(); currentSess(sh).exercises[+el.dataset.x].notes = el.value; if (sh.mode === 'live') saveActive(); },
  sBw(el) { const sh = sheet(); currentSess(sh).bodyweight = el.value === '' ? '' : (M.fromDisplay(el.value, U()) ?? ''); if (sh.mode === 'live') saveActive(); refreshLiveStats(currentSess(sh)); },
  sSessNote(el) { const sh = sheet(); currentSess(sh).notes = el.value; if (sh.mode === 'live') saveActive(); },
  cmpB(el) { sheet().b = el.value; renderSheets(); },
  // historial / estadísticas
  hf(el) { S.histFilters[el.dataset.k] = el.value; if (el.tagName === 'SELECT' || el.type === 'date') render(); },
  statsEx(el) { S.statsEx = el.value; render(); },
  // perfil
  pf(el) { S.profile[el.dataset.k] = el.value; saveProfile(); },
  pfBw(el) { const v = el.value.trim(); if (v === '') S.profile.bodyweight = ''; else { const n = M.fromDisplay(v, U()); if (n !== null && n > 20 && n < 400) S.profile.bodyweight = n; } saveProfile(); },
  setb(el) { S.settings[el.dataset.k] = el.checked; saveSettings(); if (el.dataset.k === 'showRpe') render(); if (el.dataset.k === 'keepAwake' && !el.checked) keepAwake(false); },
  setSel(el) { S.settings[el.dataset.k] = Number(el.value); saveSettings(); },
  // ejercicio personalizado
  cx(el) { sheet().draft[el.dataset.k] = el.value; if (el.dataset.k === 'primary') renderSheets(); },
  cxAlt(el) { sheet().draft.alt = el.value.split(',').map(s => s.trim()).filter(Boolean); },
  cxLines(el) { sheet().draft[el.dataset.k] = el.value.split('\n').map(s => s.trim()).filter(Boolean); },
};
function sessField(el, fn) {
  const sh = sheet(); const sess = currentSess(sh);
  const s = sess.exercises[+el.dataset.x].sets[+el.dataset.s];
  fn(s);
  if (sh.mode === 'live') saveActive();
  if (s.done) refreshLiveStats(sess);
}

// ======================= ordenación =======================
function onSortDrop(kind, from, to) {
  const move = (arr) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };
  if (kind === 'tplItems') { const t = sheet().draft; move(t.items); normalizeGroups(t); sheet().dirty = true; renderSheets(); }
  if (kind === 'sessEx') { const sh = sheet(); const sess = currentSess(sh); move(sess.exercises); normalizeSessGroups(sess); if (sh.mode === 'live') saveActive(); renderSheets(); }
  if (kind === 'templates') {
    const list = S.templates.filter(t => !t.archived); move(list);
    list.forEach((t, i) => { t.order = i; DB.put('templates', t.id, t); });
    S.templates = list; render();
  }
}

// ======================= exportación / importación =======================
function stamp() { return M.dayKey(Date.now()); }
async function exportBackup() {
  const data = { app: 'forja', kind: 'backup', version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), kv: { settings: S.settings, profile: S.profile, favorites: [...S.favorites], custom: S.custom }, templates: S.templates, sessions: S.sessions };
  const r = await shareOrDownload(`forja-copia-${stamp()}.json`, JSON.stringify(data), 'application/json');
  if (r !== 'cancelled') { S.meta.lastBackup = Date.now(); saveMeta(); toast('Copia de seguridad exportada'); render(); }
}
async function importBackup() {
  const f = await pickFile('application/json,.json'); if (!f) return;
  let data;
  try { data = JSON.parse(await readText(f)); } catch { toast('El archivo no es un JSON válido'); return; }
  const err = M.validateBackup(data);
  if (err) { toast(err, 3500); return; }
  if (!await confirmDlg({ title: 'Restaurar copia', text: `Contiene ${data.sessions.length} entrenamientos y ${data.templates.length} rutinas. Sustituirá TODOS los datos actuales de este dispositivo.`, ok: 'Restaurar', danger: true })) return;
  try {
    const kv = { settings: { ...DEFAULT_SETTINGS, ...(data.kv?.settings || {}) }, profile: { ...DEFAULT_PROFILE, ...(data.kv?.profile || {}) }, favorites: data.kv?.favorites || [], custom: data.kv?.custom || [], meta: { lastBackup: Date.now() } };
    await DB.replaceAll({ kv, templates: data.templates, sessions: data.sessions });
    await load(); applyTheme(); S.sheets = []; renderSheets(); render(); toast('Copia restaurada');
  } catch (e) { console.error(e); toast('Error al restaurar. Tus datos anteriores pueden haberse borrado: vuelve a intentarlo con la copia.', 4000); }
}
async function exportCSV() {
  if (!S.sessions.length) { toast('No hay entrenamientos para exportar'); return; }
  const csv = '﻿' + M.sessionsToCSV(S.sessions, U(), bw());
  await shareOrDownload(`forja-historial-${stamp()}.csv`, csv, 'text/csv');
}
async function exportRoutines(list) {
  list = list || S.templates;
  if (!list.length) { toast('No hay rutinas para exportar'); return; }
  const used = new Set(list.flatMap(t => t.items.map(i => i.exerciseId)));
  const data = { app: 'forja', kind: 'routines', version: 1, exportedAt: new Date().toISOString(), templates: list, exercises: S.custom.filter(e => used.has(e.id)) };
  await shareOrDownload(list.length === 1 ? `forja-rutina-${M.normalize(list[0].name).replace(/ /g, '-') || 'rutina'}.json` : `forja-rutinas-${stamp()}.json`, JSON.stringify(data, null, 1), 'application/json');
}
async function importRoutines() {
  const f = await pickFile('application/json,.json'); if (!f) return;
  let data;
  try { data = JSON.parse(await readText(f)); } catch { toast('El archivo no es un JSON válido'); return; }
  if (!data || data.app !== 'forja' || !Array.isArray(data.templates)) { toast('El archivo no contiene rutinas de Forja'); return; }
  let added = 0, skipped = 0, missing = 0;
  for (const e of data.exercises || []) {
    if (e && e.id && e.name && !S.byId[e.id]) { S.custom.push({ ...blankCustom(), ...e, custom: true }); }
  }
  await saveCustom(); rebuildIndex();
  for (const t of data.templates) {
    const errs = M.validateTemplate(t);
    if (errs.length) { skipped++; continue; }
    const c = M.cloneTemplate(t, '');
    const before = c.items.length;
    c.items = c.items.filter(i => S.byId[i.exerciseId]);
    missing += before - c.items.length;
    if (!c.items.length) { skipped++; continue; }
    normalizeGroups(c);
    c.order = Date.now() + added;
    if (S.templates.some(x => x.name === c.name)) c.name += ' (importada)';
    await saveTemplate(c); added++;
  }
  render();
  toast(`${added} rutina${added === 1 ? '' : 's'} importada${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} omitida${skipped === 1 ? '' : 's'} por errores` : ''}${missing ? ` · ${missing} ejercicio${missing === 1 ? '' : 's'} desconocido${missing === 1 ? '' : 's'} quitado${missing === 1 ? '' : 's'}` : ''}`, 3800);
}

// ======================= arranque =======================
function bindEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve(fn(el, e)).catch(err => { console.error(err); toast('Algo ha fallado. Inténtalo de nuevo.'); });
  });
  const onField = e => {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    const fn = F[el.dataset.f];
    if (!fn) return;
    // select y checkbox en "change", texto en "input"
    const isChange = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date';
    if ((e.type === 'change') !== isChange) return;
    try { fn(el, e); } catch (err) { console.error(err); }
  };
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);
  // Intro en una celda pasa a la siguiente
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.classList.contains('cell')) return;
    e.preventDefault();
    const cells = [...document.querySelectorAll('#sheets .cell')];
    const i = cells.indexOf(e.target);
    if (cells[i + 1]) cells[i + 1].focus(); else e.target.blur();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (S.active) saveActive(true); }
    else { tick(); if (S.active && S.settings.keepAwake && sheet()?.type === 'session') keepAwake(true); }
  });
  window.addEventListener('pagehide', () => { if (S.active) saveActive(true); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  document.addEventListener('pointerdown', unlockAudio, { once: true });
}

async function boot() {
  try {
    await load();
  } catch (e) {
    console.error(e);
    document.getElementById('main').innerHTML = `<div class="screen"><div class="errors"><b>No se pudieron cargar tus datos.</b><p>${esc(e.message || e)}</p><p>Cierra otras pestañas de Forja y vuelve a abrir la app.</p></div></div>`;
    return;
  }
  applyTheme();
  bindEvents();
  render();
  if (S.active) openSession();
  setInterval(tick, 250);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión lista. Se aplicará al reabrir la app.', 3500); });
      });
    }).catch(() => { /* sin modo offline */ });
  }
}

// Exponer para pruebas manuales en consola
window.__forja = { S, M };
boot();
