// Progreso y perfil del alumno, guardados solo en este dispositivo.
const KEY = 'profesor-nativo.v1';

const DEFAULT_STATE = {
  version: 1,
  profile: null,
  tests: [],
};

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
  state = { ...structuredClone(DEFAULT_STATE), profile: data.profile ?? null, tests: data.tests };
  return save();
}

export function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  return save();
}
