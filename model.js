// Forja · Lógica pura (sin DOM). Se puede probar con `node --test`.
// Todos los pesos se guardan internamente en KILOGRAMOS y los tiempos en SEGUNDOS.

export const CATEGORIES = {
  fw: 'Pesos libres',
  mach: 'Máquinas',
  cal: 'Calistenia',
  func: 'Bandas y funcional',
  other: 'Movilidad, core y acondicionamiento',
};

export const MUSCLES = {
  pecho: 'Pecho', espalda: 'Espalda (dorsal)', espalda_alta: 'Espalda alta', trapecio: 'Trapecio',
  hombro_ant: 'Hombro anterior', hombro_lat: 'Hombro lateral', hombro_post: 'Hombro posterior',
  biceps: 'Bíceps', triceps: 'Tríceps', antebrazo: 'Antebrazo',
  cuadriceps: 'Cuádriceps', isquios: 'Isquiotibiales', gluteos: 'Glúteos',
  aductores: 'Aductores', abductores: 'Abductores', gemelos: 'Gemelos',
  abdominales: 'Abdominales', oblicuos: 'Oblicuos', lumbares: 'Lumbares',
  cuello: 'Cuello', cuerpo: 'Cuerpo completo', cardio: 'Acondicionamiento', movilidad: 'Movilidad',
};

// Agrupación amplia para estadísticas por grupo muscular
export const MUSCLE_GROUP = {
  pecho: 'Pecho', espalda: 'Espalda', espalda_alta: 'Espalda', trapecio: 'Espalda',
  hombro_ant: 'Hombros', hombro_lat: 'Hombros', hombro_post: 'Hombros',
  biceps: 'Brazos', triceps: 'Brazos', antebrazo: 'Brazos',
  cuadriceps: 'Piernas', isquios: 'Piernas', gluteos: 'Glúteos', aductores: 'Piernas', abductores: 'Glúteos', gemelos: 'Piernas',
  abdominales: 'Core', oblicuos: 'Core', lumbares: 'Core', cuello: 'Otros',
  cuerpo: 'Cuerpo completo', cardio: 'Otros', movilidad: 'Otros',
};

export const EQUIPMENT = {
  barra: 'Barra olímpica', barra_z: 'Barra Z', trap_bar: 'Barra hexagonal', mancuernas: 'Mancuernas', kettlebell: 'Kettlebell',
  disco: 'Disco', banco: 'Banco', landmine: 'Landmine', maquina: 'Máquina (palanca/placas)', polea: 'Polea', smith: 'Multipower (Smith)',
  asistida: 'Máquina de asistencia', peso_corporal: 'Peso corporal', barra_dominadas: 'Barra de dominadas', paralelas: 'Paralelas',
  anillas: 'Anillas', banda: 'Banda elástica', trx: 'TRX / suspensión', balon: 'Balón medicinal', cuerda: 'Cuerda de batida',
  comba: 'Comba', cajon: 'Cajón', rueda: 'Rueda abdominal', fitball: 'Fitball', rodillo: 'Foam roller', lastre: 'Cinturón de lastre',
  paralettes: 'Paralettes', trineo: 'Trineo',
};

export const DIFFICULTY = { 1: 'Principiante', 2: 'Intermedio', 3: 'Avanzado' };

export const SET_TYPES = {
  normal: { label: 'Serie', short: '' },
  warmup: { label: 'Calentamiento', short: 'C' },
  drop: { label: 'Descendente', short: 'D' },
  failure: { label: 'Al fallo', short: 'F' },
};

export const TECHNIQUES = {
  '': 'Sin técnica especial', pause: 'Con pausa', partial: 'Repeticiones parciales', eccentric: 'Excéntrica / negativa',
  tempo: 'Tempo controlado', cluster: 'Rest-pause / cluster', iso: 'Isométrica',
};

export const GROUP_TYPES = {
  superset: 'Superserie', biset: 'Biserie', triset: 'Triserie', circuit: 'Circuito', block: 'Bloque',
};

export const GRIPS = ['', 'Prono', 'Supino', 'Neutro', 'Mixto', 'Ancho', 'Estrecho', 'Falso (false grip)'];
export const BANDS = ['', 'Muy ligera', 'Ligera', 'Media', 'Fuerte', 'Muy fuerte'];

// ---------- utilidades ----------
export function uid(prefix = '') {
  const r = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return prefix + r;
}

export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const LB = 0.45359237;
export function toDisplay(kg, unit) {
  if (kg === null || kg === undefined || kg === '' || isNaN(kg)) return '';
  const v = unit === 'lb' ? kg / LB : Number(kg);
  return round(v, unit === 'lb' ? 1 : 2);
}
export function fromDisplay(v, unit) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseNum(v);
  if (n === null) return null;
  return unit === 'lb' ? round(n * LB, 4) : n;
}
export function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
export function round(n, d = 1) { const f = 10 ** d; return Math.round(n * f) / f; }

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min${s ? ' ' + String(s).padStart(2, '0') + ' s' : ''}`;
  return `${s} s`;
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtTime(sec, timeUnit) {
  if (sec === null || sec === undefined || sec === '') return '';
  if (timeUnit === 'min' && sec >= 60) return fmtClock(sec);
  return `${sec} s`;
}

// ---------- carga, volumen y 1RM ----------
/**
 * Carga efectiva de una serie.
 * - Ejercicios con peso: el peso.
 * - Peso corporal: PC + lastre, o PC − asistencia (la asistencia NUNCA se suma).
 *   Sin peso corporal conocido: solo se cuenta el lastre y se marca como parcial.
 */
export function setLoad(set, ex, bodyweight) {
  const w = parseNum(set.weight) || 0;
  if (ex.load === 'weight') return { total: w, partial: false };
  if (ex.load === 'bodyweight') {
    const bw = parseNum(bodyweight);
    const mode = set.mode || 'bw';
    if (bw && bw > 0) {
      if (mode === 'added') return { total: bw + w, partial: false };
      if (mode === 'assist') return { total: Math.max(0, bw - w), partial: false };
      return { total: bw, partial: false };
    }
    if (mode === 'added') return { total: w, partial: true };
    return { total: 0, partial: true };
  }
  return { total: 0, partial: false };
}

export function isWorking(set) { return !!set.done && set.type !== 'warmup'; }

export function setVolume(set, ex, bodyweight) {
  if (!isWorking(set) || ex.measure === 'time') return 0;
  const reps = parseNum(set.reps) || 0;
  return setLoad(set, ex, bodyweight).total * reps;
}

/** Fórmula de Epley. Solo fiable hasta ~12 repeticiones. */
export function e1rm(weight, reps) {
  const w = parseNum(weight), r = parseNum(reps);
  if (!w || !r || w <= 0 || r <= 0 || r > 12) return null;
  if (r === 1) return w;
  return round(w * (1 + r / 30), 1);
}

export function setE1rm(set, ex, bodyweight) {
  if (!isWorking(set) || ex.measure === 'time') return null;
  if (ex.load === 'bodyweight' && !(parseNum(bodyweight) > 0)) return null;
  if (ex.load !== 'weight' && ex.load !== 'bodyweight') return null;
  return e1rm(setLoad(set, ex, bodyweight).total, set.reps);
}

// ---------- sesiones ----------
export function sessionBodyweight(session, profile) {
  return parseNum(session?.bodyweight) || parseNum(profile?.bodyweight) || null;
}

export function sessionStats(session, profileBw) {
  const bw = parseNum(session.bodyweight) || parseNum(profileBw) || null;
  let sets = 0, reps = 0, volume = 0, seconds = 0, exercises = 0, partialVolume = false;
  for (const ex of session.exercises || []) {
    const done = ex.sets.filter(s => s.done);
    if (done.length) exercises++;
    for (const s of done) {
      if (s.type === 'warmup') continue;
      sets++;
      if (ex.measure === 'time') seconds += parseNum(s.seconds) || 0;
      else reps += parseNum(s.reps) || 0;
      const v = setVolume(s, ex, bw);
      if (ex.load === 'bodyweight' && setLoad(s, ex, bw).partial) partialVolume = true;
      volume += v;
    }
  }
  const end = session.endedAt || Date.now();
  const duration = session.startedAt ? Math.round((end - session.startedAt - (session.pausedMs || 0)) / 1000) : 0;
  return { sets, reps, volume: round(volume, 1), seconds, exercises, duration, partialVolume };
}

/** Resumen por ejercicio dentro de una sesión */
export function entryFromSessionExercise(session, ex, bw) {
  const sets = ex.sets.filter(isWorking);
  if (!sets.length) return null;
  let topWeight = null, bestE1rm = null, maxReps = null, maxSec = null, volume = 0, bestSet = null, bestScore = -1;
  let maxAdded = null, minAssist = null, bwReps = null;
  for (const s of sets) {
    const reps = parseNum(s.reps), sec = parseNum(s.seconds), w = parseNum(s.weight);
    volume += setVolume(s, ex, bw);
    if (ex.measure === 'time') { if (sec !== null && (maxSec === null || sec > maxSec)) maxSec = sec; }
    else if (reps !== null && (maxReps === null || reps > maxReps)) maxReps = reps;
    if (ex.load === 'weight' && w !== null && (topWeight === null || w > topWeight)) topWeight = w;
    if (ex.load === 'bodyweight') {
      const mode = s.mode || 'bw';
      if (mode === 'added' && w !== null && (maxAdded === null || w > maxAdded)) maxAdded = w;
      if (mode === 'assist' && w !== null && (minAssist === null || w < minAssist)) minAssist = w;
      if (mode === 'bw' && reps !== null && (bwReps === null || reps > bwReps)) bwReps = reps;
    }
    const e = setE1rm(s, ex, bw);
    if (e !== null && (bestE1rm === null || e > bestE1rm)) bestE1rm = e;
    // "mejor serie": 1RM estimado si existe; si no, segundos o repeticiones con carga
    const score = e !== null ? e * 1000 : ex.measure === 'time' ? (sec || 0) : (reps || 0) * (1 + (setLoad(s, ex, bw).total || 0) / 100);
    if (score > bestScore) { bestScore = score; bestSet = s; }
  }
  return {
    sessionId: session.id, date: session.startedAt, templateName: session.templateName,
    sets, topWeight, bestE1rm, maxReps, maxSec, maxAdded, minAssist, bwReps, volume: round(volume, 1), bestSet, bw,
  };
}

export function exerciseHistory(sessions, exerciseId, profileBw) {
  const out = [];
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const bw = parseNum(s.bodyweight) || parseNum(profileBw) || null;
    for (const ex of s.exercises || []) {
      if (ex.exerciseId !== exerciseId) continue;
      const e = entryFromSessionExercise(s, ex, bw);
      if (e) out.push({ ...e, ex });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Récords personales separados por tipo */
export function personalRecords(history) {
  const pr = {};
  const better = (key, val, entry, cmp = (a, b) => a > b) => {
    if (val === null || val === undefined) return;
    if (!pr[key] || cmp(val, pr[key].value)) pr[key] = { value: val, date: entry.date, sessionId: entry.sessionId };
  };
  for (const h of history) {
    better('maxWeight', h.topWeight, h);
    better('bestE1rm', h.bestE1rm, h);
    better('maxReps', h.maxReps, h);
    better('maxSec', h.maxSec, h);
    better('maxAdded', h.maxAdded, h);
    better('minAssist', h.minAssist, h, (a, b) => a < b);
    better('bwReps', h.bwReps, h);
    better('sessionVolume', h.volume > 0 ? h.volume : null, h);
    for (const s of h.sets) {
      const v = setVolume(s, h.ex, h.bw);
      better('setVolume', v > 0 ? round(v, 1) : null, h);
    }
  }
  return pr;
}

export const PR_LABELS = {
  maxWeight: { label: 'Peso máximo', kind: 'Fuerza' },
  bestE1rm: { label: '1RM estimado', kind: 'Fuerza' },
  maxAdded: { label: 'Lastre máximo', kind: 'Fuerza' },
  minAssist: { label: 'Menor asistencia', kind: 'Fuerza' },
  maxReps: { label: 'Más repeticiones en una serie', kind: 'Repeticiones' },
  bwReps: { label: 'Repeticiones con peso corporal', kind: 'Repeticiones' },
  maxSec: { label: 'Mayor duración', kind: 'Duración' },
  setVolume: { label: 'Mejor serie (volumen)', kind: 'Volumen' },
  sessionVolume: { label: 'Volumen en una sesión', kind: 'Volumen' },
};

/** Récords nuevos conseguidos en `session` respecto al historial previo */
export function newRecordsInSession(session, prevSessions, profileBw) {
  const out = [];
  const bw = parseNum(session.bodyweight) || parseNum(profileBw) || null;
  const seen = new Set();
  for (const ex of session.exercises || []) {
    if (seen.has(ex.exerciseId)) continue;
    seen.add(ex.exerciseId);
    const prevHist = exerciseHistory(prevSessions.filter(s => s.id !== session.id), ex.exerciseId, profileBw);
    if (!prevHist.length) continue; // sin historial previo no hay récord que batir
    const prev = personalRecords(prevHist);
    const curEntry = entryFromSessionExercise(session, ex, bw);
    if (!curEntry) continue;
    const cur = personalRecords([{ ...curEntry, ex }]);
    for (const k of Object.keys(cur)) {
      if (k === 'sessionVolume') continue;
      const p = prev[k];
      const isBetter = k === 'minAssist' ? (!p || cur[k].value < p.value) : (!p || cur[k].value > p.value);
      if (p && isBetter) out.push({ exerciseId: ex.exerciseId, name: ex.name, key: k, value: cur[k].value, prev: p.value });
    }
  }
  return out;
}

// ---------- semanas y calendario ----------
export function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function weekStart(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}
export function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weeklySummary(sessions, weeks = 12, now = Date.now(), profileBw) {
  const start = weekStart(now);
  const rows = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start); d.setDate(d.getDate() - i * 7);
    rows.push({ weekStart: d.getTime(), sessions: 0, volume: 0, sets: 0, duration: 0 });
  }
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const ws = weekStart(s.startedAt);
    const row = rows.find(r => r.weekStart === ws);
    if (!row) continue;
    const st = sessionStats(s, profileBw);
    row.sessions++; row.volume += st.volume; row.sets += st.sets; row.duration += st.duration;
  }
  rows.forEach(r => { r.volume = round(r.volume, 0); });
  return rows;
}

/** Series por grupo muscular: principal cuenta 1, secundario 0,5 */
export function setsByMuscle(sessions, from, to, { secondaryWeight = 0.5, broad = true } = {}) {
  const acc = {};
  const add = (m, v) => { const k = broad ? (MUSCLE_GROUP[m] || m) : m; acc[k] = (acc[k] || 0) + v; };
  for (const s of sessions) {
    if (!s.endedAt || s.startedAt < from || s.startedAt >= to) continue;
    for (const ex of s.exercises || []) {
      const n = ex.sets.filter(isWorking).length;
      if (!n) continue;
      add(ex.primary, n);
      const secs = broad ? [...new Set((ex.secondary || []).map(m => MUSCLE_GROUP[m] || m))].filter(g => g !== (MUSCLE_GROUP[ex.primary] || ex.primary))
        : (ex.secondary || []);
      for (const m of secs) { const k = m; acc[k] = (acc[k] || 0) + n * secondaryWeight; }
    }
  }
  return acc;
}

export function volumeByMuscle(sessions, from, to, profileBw, broad = true) {
  const acc = {};
  for (const s of sessions) {
    if (!s.endedAt || s.startedAt < from || s.startedAt >= to) continue;
    const bw = parseNum(s.bodyweight) || parseNum(profileBw) || null;
    for (const ex of s.exercises || []) {
      const v = ex.sets.reduce((a, st) => a + setVolume(st, ex, bw), 0);
      if (!v) continue;
      const k = broad ? (MUSCLE_GROUP[ex.primary] || ex.primary) : ex.primary;
      acc[k] = round((acc[k] || 0) + v, 0);
    }
  }
  return acc;
}

// ---------- plantillas → sesión ----------
export function blankSet(ex, type = 'normal') {
  return { id: uid('s'), type, tech: '', reps: '', weight: '', seconds: '', mode: ex && ex.load === 'bodyweight' ? 'bw' : undefined, band: '', rpe: '', rir: '', target: {}, done: false };
}

export function snapshotExercise(def) {
  return {
    exerciseId: def.id, name: def.name, primary: def.primary, secondary: def.secondary || [],
    load: def.load, measure: def.measure, pattern: def.pattern, equipment: def.equipment || [],
  };
}

/** Crea una sesión a partir de una plantilla. La sesión copia (snapshot) los datos,
 *  así que cambiar la plantilla después no altera lo registrado. */
export function sessionFromTemplate(template, exById, prevSessions = [], settings = {}) {
  const session = {
    id: uid('w'), templateId: template ? template.id : null, templateName: template ? template.name : 'Entrenamiento libre',
    startedAt: Date.now(), endedAt: null, notes: '', bodyweight: settings.bodyweight || '', exercises: [], pausedMs: 0,
  };
  if (!template) return session;
  for (const item of template.items || []) {
    const def = exById[item.exerciseId];
    if (!def) continue;
    const group = (template.groups || []).find(g => g.id === item.groupId);
    const ex = {
      uid: uid('x'), ...snapshotExercise(def), groupId: item.groupId || null, groupType: group ? group.type : null,
      notes: item.notes || '', restSec: item.restSec ?? settings.defaultRest ?? 90, grip: item.grip || '',
      progression: item.progression || null, sets: [],
    };
    const prevEntry = settings.lastEntryFor ? settings.lastEntryFor(def.id) : null;
    const sug = settings.suggestions !== false ? suggestProgression(item, prevEntry, def) : null;
    for (const ps of item.sets || []) {
      const s = blankSet(def, ps.type || 'normal');
      s.tech = ps.tech || '';
      s.mode = def.load === 'bodyweight' ? (ps.mode || 'bw') : undefined;
      s.band = ps.band || '';
      s.target = {
        reps: ps.reps ?? '', repsMax: ps.repsMax ?? '', weight: ps.weight ?? '', seconds: ps.seconds ?? '',
        rpe: ps.rpe ?? '', rir: ps.rir ?? '',
      };
      // prellenado: objetivo de la plantilla (el usuario lo confirma al completar)
      s.weight = ps.weight ?? '';
      if (sug && s.type !== 'warmup' && sug.weight !== null && sug.weight !== undefined) { s.target.suggested = sug; }
      ex.sets.push(s);
    }
    if (!ex.sets.length) ex.sets.push(blankSet(def));
    session.exercises.push(ex);
  }
  return session;
}

// ---------- progresión ----------
/**
 * Sugerencia de progresión doble. Devuelve null si no hay datos suficientes.
 * item.progression = { mode:'double', repMin, repMax, increment(kg) }
 * lastEntry = entrada del historial más reciente para el ejercicio.
 */
export function suggestProgression(item, lastEntry, def) {
  const p = item && item.progression;
  if (!p || p.mode !== 'double') return null;
  const repMin = parseNum(p.repMin), repMax = parseNum(p.repMax), inc = parseNum(p.increment);
  if (!repMin || !repMax || repMax < repMin) return null;
  if (!lastEntry || !lastEntry.sets || !lastEntry.sets.length) return null;
  const working = lastEntry.sets.filter(s => s.type === 'normal' || s.type === 'failure');
  if (!working.length) return null;
  const isBw = def && def.load === 'bodyweight';
  const weights = working.map(s => parseNum(s.weight) || 0);
  const w = Math.max(...weights);
  const atTop = working.filter(s => (parseNum(s.weight) || 0) === w);
  const reps = atTop.map(s => parseNum(s.reps) || 0);
  const plannedCount = (item.sets || []).filter(s => s.type !== 'warmup').length || working.length;
  const allMax = atTop.length >= plannedCount && reps.every(r => r >= repMax);
  const rpeHigh = working.some(s => parseNum(s.rpe) >= 10);
  if (allMax && !rpeHigh) {
    if (isBw && (working[0].mode || 'bw') === 'assist') {
      const nw = Math.max(0, w - (inc || 0));
      return { action: 'weight', weight: nw, reps: repMin, mode: nw === 0 ? 'bw' : 'assist', text: `Reduce la asistencia a ${nw} kg y vuelve a ${repMin} reps` };
    }
    if (!inc) return { action: 'reps', weight: w, reps: repMax, text: `Has completado ${repMax} reps en todas las series. Define un incremento para sugerir más peso.` };
    const mode = isBw ? 'added' : undefined;
    return { action: 'weight', weight: round(w + inc, 2), reps: repMin, mode, text: `Sube a ${round(w + inc, 2)} kg y empieza en ${repMin} reps` };
  }
  const minRep = Math.min(...reps);
  const target = Math.min(repMax, Math.max(repMin, minRep + 1));
  return { action: 'reps', weight: w, reps: target, mode: isBw ? (working[0].mode || 'bw') : undefined, text: `Mantén ${w} kg y busca ${target} reps en las series que no llegaron a ${repMax}` };
}

// ---------- búsqueda ----------
export function searchExercises(list, q, f = {}, favorites = new Set()) {
  const nq = normalize(q);
  const terms = nq ? nq.split(' ') : [];
  return list.filter(e => {
    if (f.category && e.category !== f.category) return false;
    if (f.muscle && e.primary !== f.muscle && !(f.includeSecondary && (e.secondary || []).includes(f.muscle))) return false;
    if (f.group && (MUSCLE_GROUP[e.primary] || '') !== f.group) return false;
    if (f.equipment && !(e.equipment || []).includes(f.equipment)) return false;
    if (f.difficulty && String(e.difficulty) !== String(f.difficulty)) return false;
    if (f.type) {
      const t = f.type;
      if (t === 'compound' && e.mechanic !== 'compound') return false;
      if (t === 'isolation' && e.mechanic !== 'isolation') return false;
      if (t === 'unilateral' && e.laterality !== 'unilateral') return false;
      if (t === 'bilateral' && e.laterality !== 'bilateral') return false;
      if (['isometric', 'eccentric', 'plyometric'].includes(t) && !(e.tags || []).includes(t)) return false;
      if (t === 'time' && e.measure !== 'time') return false;
    }
    if (f.favorites && !favorites.has(e.id)) return false;
    if (f.custom && !e.custom) return false;
    if (!terms.length) return true;
    const hay = e._search || (e._search = normalize([e.name, e.nameEn, ...(e.alt || []), MUSCLES[e.primary]].join(' ')));
    return terms.every(t => hay.includes(t));
  });
}

// ---------- programación semanal ----------
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export function weekdayIndex(t) { return (new Date(t).getDay() + 6) % 7; }

/** Próxima rutina programada a partir de hoy (incluido si aún no se ha hecho hoy) */
export function nextScheduled(templates, sessions, now = Date.now()) {
  const today = weekdayIndex(now);
  const doneToday = new Set(sessions.filter(s => s.endedAt && startOfDay(s.startedAt) === startOfDay(now)).map(s => s.templateId));
  for (let i = 0; i <= 7; i++) {
    const wd = (today + i) % 7;
    const t = templates.find(t => !t.archived && (t.days || []).includes(wd) && !(i === 0 && doneToday.has(t.id)));
    if (t) return { template: t, inDays: i, weekday: wd };
  }
  return null;
}

// ---------- exportación ----------
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function sessionsToCSV(sessions, unit = 'kg', profileBw) {
  const head = ['fecha', 'hora_inicio', 'duracion_min', 'rutina', 'ejercicio', 'id_ejercicio', 'grupo_muscular', 'serie', 'tipo', 'tecnica',
    `peso_${unit}`, 'modo_peso_corporal', `carga_total_${unit}`, 'repeticiones', 'segundos', 'banda', 'rpe', 'rir', 'agarre', 'notas_ejercicio', 'notas_sesion'];
  const rows = [head.join(',')];
  const sorted = [...sessions].filter(s => s.endedAt).sort((a, b) => a.startedAt - b.startedAt);
  for (const s of sorted) {
    const d = new Date(s.startedAt);
    const bw = parseNum(s.bodyweight) || parseNum(profileBw) || null;
    const dur = round(sessionStats(s, profileBw).duration / 60, 1);
    for (const ex of s.exercises) {
      ex.sets.filter(x => x.done).forEach((st, i) => {
        const load = setLoad(st, ex, bw);
        const modeLabel = ex.load === 'bodyweight' ? ({ bw: 'peso corporal', added: 'lastre', assist: 'asistencia' }[st.mode || 'bw']) : '';
        rows.push([
          dayKey(s.startedAt), `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, dur, s.templateName,
          ex.name, ex.exerciseId, MUSCLES[ex.primary] || ex.primary, i + 1, SET_TYPES[st.type]?.label || st.type, st.tech ? (TECHNIQUES[st.tech] || st.tech) : '',
          st.weight === '' || st.weight === undefined ? '' : toDisplay(parseNum(st.weight), unit), modeLabel,
          load.total && !load.partial ? toDisplay(load.total, unit) : '', st.reps ?? '', st.seconds ?? '', st.band || '', st.rpe ?? '', st.rir ?? '',
          ex.grip || '', ex.notes || '', s.notes || '',
        ].map(csvCell).join(','));
      });
    }
  }
  return rows.join('\n');
}

// ---------- validación ----------
export function validateTemplate(t) {
  const errors = [];
  if (!t || typeof t !== 'object') return ['La rutina no es válida.'];
  if (!String(t.name || '').trim()) errors.push('La rutina necesita un nombre.');
  if (!Array.isArray(t.items)) errors.push('La rutina no tiene lista de ejercicios.');
  else t.items.forEach((it, i) => {
    if (!it.exerciseId) errors.push(`El ejercicio ${i + 1} no tiene identificador.`);
    if (!Array.isArray(it.sets) || !it.sets.length) errors.push(`El ejercicio ${i + 1} necesita al menos una serie.`);
    (it.sets || []).forEach((s, j) => {
      for (const k of ['reps', 'repsMax', 'weight', 'seconds', 'rpe', 'rir']) {
        if (s[k] !== '' && s[k] !== undefined && s[k] !== null && (parseNum(s[k]) === null || parseNum(s[k]) < 0)) errors.push(`Ejercicio ${i + 1}, serie ${j + 1}: "${k}" debe ser un número positivo.`);
      }
      if (s.rpe !== '' && s.rpe !== undefined && s.rpe !== null && parseNum(s.rpe) > 10) errors.push(`Ejercicio ${i + 1}, serie ${j + 1}: el RPE va de 1 a 10.`);
    });
    if (it.restSec !== undefined && it.restSec !== null && it.restSec !== '' && (parseNum(it.restSec) === null || parseNum(it.restSec) < 0 || parseNum(it.restSec) > 3600)) errors.push(`Ejercicio ${i + 1}: el descanso debe estar entre 0 y 3600 s.`);
  });
  return errors;
}

export function validateSetInput(set, ex) {
  const errs = [];
  const chk = (k, max) => {
    const v = set[k];
    if (v === '' || v === undefined || v === null) return;
    const n = parseNum(v);
    if (n === null || n < 0) errs.push(`${k} no es un número válido`);
    else if (max && n > max) errs.push(`${k} parece demasiado alto`);
  };
  chk('weight', 1000); chk('reps', 1000); chk('seconds', 36000); chk('rpe', 10); chk('rir', 20);
  if (ex.measure === 'time' && !(parseNum(set.seconds) > 0)) errs.push('Indica los segundos');
  if (ex.measure !== 'time' && !(parseNum(set.reps) > 0)) errs.push('Indica las repeticiones');
  if (ex.load === 'weight' && set.weight !== '' && set.weight !== undefined && !(parseNum(set.weight) >= 0)) errs.push('Peso no válido');
  return errs;
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'El archivo no contiene datos válidos.';
  if (data.app !== 'forja') return 'Este archivo no es una copia de seguridad de Forja.';
  if (!Array.isArray(data.sessions) || !Array.isArray(data.templates)) return 'Faltan sesiones o rutinas en la copia.';
  for (const s of data.sessions) if (!s.id || !Array.isArray(s.exercises)) return 'Hay una sesión dañada en la copia.';
  for (const t of data.templates) { const e = validateTemplate(t); if (e.length) return `Rutina "${t.name || '?'}": ${e[0]}`; }
  return null;
}

/** Copia profunda de plantilla con ids nuevos (duplicar / importar) */
export function cloneTemplate(t, nameSuffix = ' (copia)') {
  const c = JSON.parse(JSON.stringify(t));
  const gmap = {};
  c.id = uid('t'); c.name = (t.name || 'Rutina') + nameSuffix; c.createdAt = Date.now(); c.updatedAt = Date.now(); c.days = [];
  c.groups = (c.groups || []).map(g => { const n = uid('g'); gmap[g.id] = n; return { ...g, id: n }; });
  c.items = (c.items || []).map(it => ({ ...it, uid: uid('i'), groupId: it.groupId ? gmap[it.groupId] || null : null, sets: (it.sets || []).map(s => ({ ...s, id: uid('p') })) }));
  return c;
}

/** Etiqueta A1, A2… para ejercicios agrupados */
export function groupLabels(items) {
  const labels = {}; let letter = 0; let lastGroup = null; let idx = 0;
  for (const it of items) {
    if (it.groupId) {
      if (it.groupId !== lastGroup) { letter++; idx = 0; lastGroup = it.groupId; }
      idx++; labels[it.uid] = String.fromCharCode(64 + letter) + idx;
    } else { lastGroup = null; }
  }
  return labels;
}

/** ¿Debe saltar el descanso tras esta serie? (ejercicio intermedio de una superserie/circuito) */
export function skipRestInGroup(exercises, index) {
  const ex = exercises[index];
  if (!ex || !ex.groupId) return false;
  const next = exercises[index + 1];
  return !!(next && next.groupId === ex.groupId);
}
