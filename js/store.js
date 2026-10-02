// Progreso y perfil del alumno, guardados solo en este dispositivo.
const KEY = 'profesor-nativo.v1';

const DEFAULT_STATE = {
  version: 1,
  profile: null,
  tests: [],
  lessons: {}, // id -> { status: 'done' | 'known', score, date, notes }
  cards: {},   // id -> tarjeta de repaso espaciado
  errors: [],  // diario de errores
};

// Días hasta el siguiente repaso según la caja de la tarjeta.
const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

export const DEFAULT_PROFILE = {
  language: 'en',
  minutesPerDay: 30,
  daysPerWeek: 6,
  goals: [],
  variant: 'us-uk',
  voiceURI: null,
  rate: 0.9,
  createdAt: null,
  planStartDate: null,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getProfile() {
  return state.profile;
}

export function saveProfile(profile) {
  state.profile = { ...DEFAULT_PROFILE, ...state.profile, ...profile };
  if (!state.profile.createdAt) state.profile.createdAt = new Date().toISOString();
  return save();
}

export function getTests() {
  return state.tests;
}

export function addTest(result) {
  state.tests.push(result);
  if (state.profile && !state.profile.planStartDate) {
    state.profile.planStartDate = result.date;
  }
  return save();
}

// Día del plan (1 a 90) contado desde la prueba inicial.
export function planDay(today = new Date()) {
  const start = state.profile?.planStartDate;
  if (!start) return 0;
  const ms = startOfDay(today) - startOfDay(new Date(start));
  return Math.min(90, Math.floor(ms / 86400000) + 1);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function exportData() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.tests)) {
    throw new Error('El archivo no es una copia de Profesor Nativo.');
  }
  state = { ...structuredClone(DEFAULT_STATE), ...data };
  delete state.exportedAt;
  return save();
}

export function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  return save();
}

// ---------- Lecciones ----------

export function getLessonState(id) {
  return state.lessons[id] || null;
}

export function completeLesson(id, { score, status = 'done' }) {
  const prev = state.lessons[id] || {};
  state.lessons[id] = { ...prev, status, score: Math.max(score, prev.score ?? 0), date: new Date().toISOString() };
  return save();
}

export function saveLessonNotes(id, notes) {
  state.lessons[id] = { ...(state.lessons[id] || {}), notes };
  return save();
}

export function lessonsDoneToday(today = new Date()) {
  const key = today.toDateString();
  return Object.values(state.lessons).filter((l) => l.date && new Date(l.date).toDateString() === key).length;
}

// ---------- Repaso espaciado ----------

// Añade tarjetas nuevas (las que ya existen no se tocan).
export function addCards(cards, { box = 1 } = {}) {
  const now = new Date();
  for (const c of cards) {
    if (state.cards[c.id]) continue;
    state.cards[c.id] = { ...c, box, due: addDays(now, INTERVALS[box]).toISOString(), created: now.toISOString(), reviews: 0 };
  }
  return save();
}

export function dueCards(today = new Date()) {
  const end = endOfDay(today);
  return Object.values(state.cards).filter((c) => new Date(c.due).getTime() <= end);
}

export function allCards() {
  return Object.values(state.cards);
}

// grade: 'good' sube de caja, 'hard' la mantiene y vuelve mañana, 'again' vuelve a la caja 1.
export function gradeCard(id, grade) {
  const c = state.cards[id];
  if (!c) return false;
  if (grade === 'good') c.box = Math.min(c.box + 1, INTERVALS.length - 1);
  if (grade === 'again') c.box = 1;
  const days = grade === 'hard' ? 1 : INTERVALS[c.box];
  c.due = addDays(new Date(), days).toISOString();
  c.reviews += 1;
  c.last = grade;
  return save();
}

// Palabra dominada: superó tres repasos seguidos (caja 4 o más).
export function masteredCount() {
  return Object.values(state.cards).filter((c) => c.kind === 'word' && c.box >= 4).length;
}

// ---------- Diario de errores ----------

export function logError(entry) {
  const existing = state.errors.find((e) => e.key === entry.key && !e.resolved);
  if (existing) {
    existing.count += 1;
    existing.date = new Date().toISOString();
  } else {
    state.errors.push({ ...entry, count: 1, streak: 0, resolved: false, date: new Date().toISOString() });
  }
  return save();
}

export function getErrors() {
  return state.errors;
}

// Un error se da por superado tras acertarlo dos veces seguidas en los repasos.
export function markErrorPractice(key, correct) {
  const e = state.errors.find((x) => x.key === key && !x.resolved);
  if (!e) return false;
  e.streak = correct ? e.streak + 1 : 0;
  if (e.streak >= 2) e.resolved = true;
  return save();
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}
