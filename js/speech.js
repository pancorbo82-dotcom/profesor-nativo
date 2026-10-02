// Voz del propio dispositivo: síntesis (escuchar) y reconocimiento (hablar).
// Ambas son gratuitas y funcionan sin servidor.

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const canSpeak = Boolean(synth);
export const canListen = Boolean(Recognition);

// Las voces cargan de forma asíncrona en algunos navegadores.
export function getVoices(lang = 'en') {
  if (!synth) return Promise.resolve([]);
  const pick = () => synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const now = pick();
  if (now.length) return Promise.resolve(sortVoices(now));
  return new Promise((resolve) => {
    const done = () => resolve(sortVoices(pick()));
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

// Primero inglés americano y las voces de mejor calidad.
function sortVoices(voices) {
  const score = (v) => {
    let s = 0;
    if (/en[-_]US/i.test(v.lang)) s += 4;
    else if (/en[-_]GB/i.test(v.lang)) s += 2;
    if (/premium|enhanced|natural|neural|online/i.test(v.name)) s += 3;
    if (/google|samantha|aria|jenny|guy/i.test(v.name)) s += 1;
    return -s;
  };
  return [...voices].sort((a, b) => score(a) - score(b));
}

export async function speak(text, { voiceURI = null, rate = 0.9, lang = 'en-US' } = {}) {
  if (!synth) return;
  synth.cancel();
  const voices = await getVoices(lang.slice(0, 2));
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  const voice = voices.find((v) => v.voiceURI === voiceURI) || voices[0];
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  return new Promise((resolve) => {
    utter.onend = resolve;
    utter.onerror = resolve;
    synth.speak(utter);
  });
}

export function stopSpeaking() {
  synth?.cancel();
}

// Escucha una frase y devuelve las transcripciones posibles.
export function listen({ lang = 'en-US', timeoutMs = 8000 } = {}) {
  if (!Recognition) return Promise.reject(new Error('unsupported'));
  return new Promise((resolve, reject) => {
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { rec.stop(); } catch { /* ya parado */ }
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('timeout')), timeoutMs);
    rec.onresult = (e) => {
      const alts = Array.from(e.results[0] || []).map((a) => a.transcript);
      finish(resolve, alts);
    };
    rec.onerror = (e) => finish(reject, new Error(e.error || 'error'));
    rec.onend = () => finish(reject, new Error('no-speech'));
    rec.start();
  });
}

function words(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Parecido entre lo esperado y lo oído (0 a 1), palabra a palabra.
export function similarity(expected, heard) {
  const a = words(expected);
  const b = words(heard);
  if (!a.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length] / Math.max(a.length, b.length);
}

// Palabras esperadas que no se reconocieron, para dar pistas.
export function missingWords(expected, heard) {
  const heardSet = new Set(words(heard));
  return words(expected).filter((w) => !heardSet.has(w));
}
