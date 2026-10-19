// Pruebas de la lógica principal. Ejecutar con:  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from './model.js';
import { buildLibrary, CHAINS, STARTER_TEMPLATES } from './exercises.js';

const lib = buildLibrary();
const byId = Object.fromEntries(lib.map(e => [e.id, e]));
const snap = id => ({ uid: M.uid('x'), ...M.snapshotExercise(byId[id]), notes: '', restSec: 90 });
const set = (o) => ({ id: M.uid('s'), type: 'normal', tech: '', reps: '', weight: '', seconds: '', done: true, ...o });
const session = (t, exercises, extra = {}) => ({ id: M.uid('w'), templateId: 't1', templateName: 'Test', startedAt: t, endedAt: t + 3600e3, exercises, bodyweight: '', ...extra });
const DAY = 86400e3;

test('biblioteca: ids únicos, referencias válidas y tamaño amplio', () => {
  assert.ok(lib.length >= 300, `solo ${lib.length} ejercicios`);
  assert.equal(new Set(lib.map(e => e.id)).size, lib.length);
  for (const e of lib) {
    assert.ok(M.MUSCLES[e.primary], `${e.id}: músculo ${e.primary}`);
    e.secondary.forEach(m => assert.ok(M.MUSCLES[m], `${e.id}: secundario ${m}`));
    e.equipment.forEach(q => assert.ok(M.EQUIPMENT[q], `${e.id}: equipo ${q}`));
  }
  CHAINS.flat().forEach(id => assert.ok(byId[id], `cadena con id desconocido ${id}`));
  STARTER_TEMPLATES.forEach(t => t.items.forEach(([id]) => assert.ok(byId[id], `plantilla con id desconocido ${id}`)));
  for (const cat of Object.keys(M.CATEGORIES)) assert.ok(lib.some(e => e.category === cat), `categoría vacía ${cat}`);
});

test('biblioteca: variantes fáciles/difíciles desde las cadenas', () => {
  assert.ok(byId.pullup.easier.includes('negative_pullup'));
  assert.ok(byId.pullup.harder.length > 0);
  assert.ok(byId.tuck_planche.harder.includes('adv_tuck_planche'));
});

test('búsqueda: sin acentos, en inglés y con filtros', () => {
  assert.ok(M.searchExercises(lib, 'press banca').some(e => e.id === 'bench_bb'));
  assert.ok(M.searchExercises(lib, 'BULGARA').some(e => e.id === 'bulgarian_db'));
  assert.ok(M.searchExercises(lib, 'pull-up').some(e => e.id === 'pullup'));
  const mach = M.searchExercises(lib, '', { category: 'mach', muscle: 'cuadriceps' });
  assert.ok(mach.length > 3 && mach.every(e => e.category === 'mach' && e.primary === 'cuadriceps'));
  const iso = M.searchExercises(lib, '', { type: 'isometric' });
  assert.ok(iso.every(e => e.tags.includes('isometric')));
  const fav = M.searchExercises(lib, '', { favorites: true }, new Set(['pullup']));
  assert.deepEqual(fav.map(e => e.id), ['pullup']);
});

test('unidades: kg ↔ lb', () => {
  assert.equal(M.toDisplay(100, 'kg'), 100);
  assert.equal(M.toDisplay(100, 'lb'), 220.5);
  assert.ok(Math.abs(M.fromDisplay('220,5', 'lb') - 100.02) < 0.05);
  assert.equal(M.fromDisplay('', 'kg'), null);
  assert.equal(M.parseNum('abc'), null);
});

test('1RM estimado (Epley) solo hasta 12 reps', () => {
  assert.equal(M.e1rm(100, 1), 100);
  assert.equal(M.e1rm(100, 5), 116.7);
  assert.equal(M.e1rm(100, 13), null);
  assert.equal(M.e1rm(0, 5), null);
});

test('carga en calistenia: lastre suma, asistencia resta y nunca se suma', () => {
  const ex = snap('pullup');
  assert.deepEqual(M.setLoad({ weight: 10, mode: 'added' }, ex, 75), { total: 85, partial: false });
  assert.deepEqual(M.setLoad({ weight: 20, mode: 'assist' }, ex, 75), { total: 55, partial: false });
  assert.deepEqual(M.setLoad({ weight: '', mode: 'bw' }, ex, 75), { total: 75, partial: false });
  // sin peso corporal: la asistencia no cuenta como carga levantada
  assert.equal(M.setLoad({ weight: 20, mode: 'assist' }, ex, null).total, 0);
  assert.equal(M.setLoad({ weight: 10, mode: 'added' }, ex, null).total, 10);
  assert.equal(M.setLoad({ weight: 10, mode: 'added' }, ex, null).partial, true);
});

test('volumen: excluye calentamientos y series sin completar; tiempo no suma volumen', () => {
  const bench = snap('bench_bb');
  bench.sets = [set({ type: 'warmup', weight: 40, reps: 10 }), set({ weight: 80, reps: 5 }), set({ weight: 80, reps: 5, done: false })];
  const plank = snap('plank'); plank.sets = [set({ seconds: 60 })];
  const s = session(Date.now() - 3600e3, [bench, plank]);
  const st = M.sessionStats(s);
  assert.equal(st.volume, 400);
  assert.equal(st.sets, 2);
  assert.equal(st.reps, 5);
  assert.equal(st.seconds, 60);
  assert.equal(st.exercises, 2);
});

test('récords: fuerza, repeticiones y duración por separado; menor asistencia es mejor', () => {
  const t0 = Date.now() - 10 * DAY;
  const pu1 = snap('pullup'); pu1.sets = [set({ mode: 'assist', weight: 30, reps: 8 })];
  const pu2 = snap('pullup'); pu2.sets = [set({ mode: 'assist', weight: 20, reps: 6 }), set({ mode: 'bw', reps: 3 })];
  const pu3 = snap('pullup'); pu3.sets = [set({ mode: 'added', weight: 5, reps: 4 })];
  const sessions = [session(t0, [pu1]), session(t0 + DAY, [pu2]), session(t0 + 2 * DAY, [pu3])];
  const pr = M.personalRecords(M.exerciseHistory(sessions, 'pullup', null));
  assert.equal(pr.minAssist.value, 20);
  assert.equal(pr.maxAdded.value, 5);
  assert.equal(pr.maxReps.value, 8);
  assert.equal(pr.bwReps.value, 3);
  assert.equal(pr.bestE1rm, undefined, 'sin peso corporal no se estima 1RM');
  const withBw = M.personalRecords(M.exerciseHistory(sessions, 'pullup', 80));
  assert.ok(withBw.bestE1rm.value > 80);
});

test('récords nuevos en una sesión respecto al historial', () => {
  const t0 = Date.now() - 5 * DAY;
  const a = snap('back_squat'); a.sets = [set({ weight: 100, reps: 5 })];
  const b = snap('back_squat'); b.sets = [set({ weight: 105, reps: 5 })];
  const prev = [session(t0, [a])];
  const cur = session(t0 + DAY, [b]);
  const prs = M.newRecordsInSession(cur, prev);
  assert.ok(prs.some(p => p.key === 'maxWeight' && p.value === 105));
  // primera vez: no hay "récord" que batir
  assert.equal(M.newRecordsInSession(cur, []).length, 0);
});

test('una sesión guardada no cambia al modificar la plantilla (snapshot)', () => {
  const tpl = { id: 't1', name: 'Torso', groups: [], items: [{ uid: 'i1', exerciseId: 'bench_bb', sets: [{ type: 'normal', reps: 8, repsMax: 10, weight: 60 }], restSec: 120 }] };
  const s = M.sessionFromTemplate(tpl, byId, [], { suggestions: false });
  assert.equal(s.exercises[0].name, 'Press de banca con barra');
  assert.equal(s.exercises[0].sets[0].target.reps, 8);
  tpl.name = 'Cambiada'; tpl.items[0].sets[0].reps = 3; tpl.items[0].exerciseId = 'squat';
  assert.equal(s.templateName, 'Torso');
  assert.equal(s.exercises[0].exerciseId, 'bench_bb');
  assert.equal(s.exercises[0].sets[0].target.reps, 8);
});

test('progresión doble: sin datos no sugiere; al llegar al máximo sube peso', () => {
  const item = { progression: { mode: 'double', repMin: 8, repMax: 12, increment: 2.5 }, sets: [{ type: 'normal' }, { type: 'normal' }, { type: 'normal' }] };
  const def = byId.bench_db;
  assert.equal(M.suggestProgression(item, null, def), null);
  assert.equal(M.suggestProgression({ ...item, progression: null }, { sets: [set({ weight: 20, reps: 12 })] }, def), null);
  const top = { sets: [set({ weight: 20, reps: 12 }), set({ weight: 20, reps: 12 }), set({ weight: 20, reps: 12 })] };
  const up = M.suggestProgression(item, top, def);
  assert.equal(up.action, 'weight'); assert.equal(up.weight, 22.5); assert.equal(up.reps, 8);
  const mid = { sets: [set({ weight: 20, reps: 12 }), set({ weight: 20, reps: 10 }), set({ weight: 20, reps: 9 })] };
  const keep = M.suggestProgression(item, mid, def);
  assert.equal(keep.action, 'reps'); assert.equal(keep.weight, 20); assert.equal(keep.reps, 10);
  // asistida: reduce la asistencia en lugar de subir peso
  const asst = { sets: [set({ mode: 'assist', weight: 20, reps: 12 }), set({ mode: 'assist', weight: 20, reps: 12 }), set({ mode: 'assist', weight: 20, reps: 12 })] };
  const s2 = M.suggestProgression(item, asst, byId.assisted_pullup_mach);
  assert.equal(s2.weight, 17.5); assert.equal(s2.mode, 'assist');
});

test('series por grupo muscular: principal 1, secundario 0,5, sin calentamiento', () => {
  const now = Date.now();
  const bench = snap('bench_bb'); bench.sets = [set({ weight: 60, reps: 8 }), set({ weight: 60, reps: 8 }), set({ type: 'warmup', weight: 20, reps: 10 })];
  const r = M.setsByMuscle([session(now - 1000, [bench])], now - DAY, now + 1);
  assert.equal(r.Pecho, 2);
  assert.equal(r.Brazos, 1);
  assert.equal(r.Hombros, 1);
});

test('resumen semanal y próxima rutina programada', () => {
  const now = new Date('2026-10-21T10:00:00').getTime(); // miércoles
  const w = M.weeklySummary([session(now - 3600e3, [])], 4, now);
  assert.equal(w.length, 4); assert.equal(w[3].sessions, 1);
  const tpls = [{ id: 'a', name: 'A', days: [0], items: [] }, { id: 'b', name: 'B', days: [4], items: [] }];
  const n = M.nextScheduled(tpls, [], now);
  assert.equal(n.template.id, 'b'); assert.equal(n.inDays, 2);
});

test('validación de plantillas y copias de seguridad', () => {
  assert.ok(M.validateTemplate({ name: '', items: [] }).length);
  assert.ok(M.validateTemplate({ name: 'X', items: [{ exerciseId: 'a', sets: [{ reps: -1 }] }] }).length);
  assert.ok(M.validateTemplate({ name: 'X', items: [{ exerciseId: 'a', sets: [{ rpe: 11 }] }] }).length);
  assert.equal(M.validateTemplate({ name: 'X', items: [{ exerciseId: 'a', sets: [{ reps: 8, weight: '50' }] }] }).length, 0);
  assert.ok(M.validateBackup({ app: 'otra' }));
  assert.equal(M.validateBackup({ app: 'forja', sessions: [], templates: [] }), null);
});

test('validación de serie: reps o segundos obligatorios', () => {
  assert.ok(M.validateSetInput({ reps: '' }, { measure: 'reps', load: 'weight' }).length);
  assert.ok(M.validateSetInput({ seconds: '' }, { measure: 'time', load: 'none' }).length);
  assert.equal(M.validateSetInput({ reps: 8, weight: 50 }, { measure: 'reps', load: 'weight' }).length, 0);
  assert.ok(M.validateSetInput({ reps: 8, rpe: 14 }, { measure: 'reps', load: 'weight' }).length);
});

test('CSV: cabecera, una fila por serie hecha y escapado', () => {
  const ex = snap('bench_bb'); ex.notes = 'nota, con "comillas"'; ex.sets = [set({ weight: 60, reps: 8 }), set({ weight: 60, reps: 8, done: false })];
  const csv = M.sessionsToCSV([session(Date.now(), [ex])], 'kg');
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('fecha,'));
  assert.ok(lines[1].includes('"nota, con ""comillas"""'));
});

test('superseries: etiquetas A1/A2 y descanso solo al final de la vuelta', () => {
  const items = [{ uid: 'a', groupId: 'g' }, { uid: 'b', groupId: 'g' }, { uid: 'c', groupId: null }, { uid: 'd', groupId: 'h' }, { uid: 'e', groupId: 'h' }];
  const l = M.groupLabels(items);
  assert.deepEqual([l.a, l.b, l.d, l.e], ['A1', 'A2', 'B1', 'B2']);
  assert.equal(M.skipRestInGroup(items, 0), true);
  assert.equal(M.skipRestInGroup(items, 1), false);
  assert.equal(M.skipRestInGroup(items, 2), false);
});

test('duplicar plantilla genera ids nuevos y conserva grupos', () => {
  const t = { id: 't', name: 'X', days: [1], groups: [{ id: 'g', type: 'superset' }], items: [{ uid: 'a', exerciseId: 'bench_bb', groupId: 'g', sets: [{ id: 'p' }] }, { uid: 'b', exerciseId: 'row_bb', groupId: 'g', sets: [{ id: 'q' }] }] };
  const c = M.cloneTemplate(t);
  assert.notEqual(c.id, t.id); assert.deepEqual(c.days, []);
  assert.equal(c.items[0].groupId, c.items[1].groupId); assert.notEqual(c.items[0].groupId, 'g');
  assert.equal(c.groups[0].id, c.items[0].groupId);
});
