// Prueba de nivel: bloques A1, A2 y B1 con regla de parada, y una parte oral al final.
import { esc, shuffle } from './ui.js';
import { speak, listen, canListen, similarity, missingWords } from './speech.js';

const PASS = 0.6; // aciertos mínimos para pasar al bloque siguiente
const DONT_KNOW = 'No lo sé';
const SKILLS = ['listening', 'reading', 'vocabulary', 'grammar', 'speaking'];

export const SKILL_NAMES = {
  listening: 'Comprensión auditiva',
  reading: 'Lectura',
  vocabulary: 'Vocabulario',
  grammar: 'Gramática',
  speaking: 'Expresión oral',
};

export async function loadPlacement(language) {
  const res = await fetch(`content/${language}/placement.json`);
  if (!res.ok) throw new Error('No se pudo cargar la prueba.');
  return res.json();
}

export function runPlacement(root, data, profile, onFinish) {
  const voice = { voiceURI: profile.voiceURI, rate: profile.rate, lang: data.speechLang };
  const answers = [];
  let blockIndex = 0;
  let itemIndex = 0;
  let blockItems = data.blocks[0].items;
  const totalItems = data.blocks.reduce((n, b) => n + b.items.length, 0) + data.speaking.length;

  showItem();

  function progress() {
    const done = answers.length;
    return `<div class="progress" aria-label="Progreso de la prueba"><div style="width:${Math.round((done / totalItems) * 100)}%"></div></div>`;
  }

  function showItem() {
    const item = blockItems[itemIndex];
    const options = [...shuffle(item.options), DONT_KNOW];
    root.innerHTML = `
      ${progress()}
      <p class="eyebrow">Parte ${blockIndex + 1} de ${data.blocks.length + 1} · ${esc(SKILL_NAMES[item.skill])}</p>
      ${item.type === 'listen' ? `
        <div class="listen-row">
          <button class="btn btn-play" data-act="play" aria-label="Escuchar">▶ Escuchar</button>
          <button class="btn btn-ghost" data-act="slow">Más despacio</button>
        </div>` : ''}
      ${item.type === 'read' ? `<blockquote class="passage" lang="en">${esc(item.passage)}</blockquote>` : ''}
      <h2 class="question" ${item.type === 'choose' && /_/.test(item.prompt) ? 'lang="en"' : ''}>${esc(item.prompt)}</h2>
      <div class="options">
        ${options.map((o, i) => `<button class="option${o === DONT_KNOW ? ' option-skip' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}
      </div>`;

    if (item.type === 'listen') {
      root.querySelector('[data-act="play"]').onclick = () => speak(item.audio, voice);
      root.querySelector('[data-act="slow"]').onclick = () => speak(item.audio, { ...voice, rate: 0.6 });
      speak(item.audio, voice);
    }
    root.querySelectorAll('.option').forEach((btn) => {
      btn.onclick = () => choose(item, options[Number(btn.dataset.i)]);
    });
  }

  function choose(item, picked) {
    answers.push({
      id: item.id,
      level: data.blocks[blockIndex].level,
      skill: item.skill,
      picked,
      correct: picked === item.answer,
    });
    itemIndex++;
    if (itemIndex < blockItems.length) return showItem();

    const blockAnswers = answers.filter((a) => a.level === data.blocks[blockIndex].level);
    const ratio = blockAnswers.filter((a) => a.correct).length / blockItems.length;
    blockIndex++;
    if (ratio >= PASS && blockIndex < data.blocks.length) {
      blockItems = data.blocks[blockIndex].items;
      itemIndex = 0;
      return showBlockBreak();
    }
    showSpeakingIntro();
  }

  function showBlockBreak() {
    root.innerHTML = `
      ${progress()}
      <div class="center-card">
        <h2>¡Bien! Pasas a la parte ${blockIndex + 1}</h2>
        <p>Las preguntas serán un poco más difíciles. Si no sabes una respuesta, elige «No lo sé»: así el resultado será más fiable.</p>
        <button class="btn btn-primary" data-act="next">Continuar</button>
      </div>`;
    root.querySelector('[data-act="next"]').onclick = showItem;
  }

  // Parte oral
  let spIndex = 0;
  const spoken = [];

  function showSpeakingIntro() {
    root.innerHTML = `
      ${progress()}
      <div class="center-card">
        <p class="eyebrow">Última parte · Expresión oral</p>
        <h2>Ahora vas a hablar</h2>
        <p>Escucha cada frase y repítela en voz alta. ${canListen
          ? 'El navegador te pedirá permiso para usar el micrófono.'
          : 'Tu navegador no reconoce la voz (funciona en Chrome, Edge y Safari), así que tú mismo valorarás cómo te ha salido.'}</p>
        <button class="btn btn-primary" data-act="next">Empezar</button>
        <button class="btn btn-ghost" data-act="skip">Saltar esta parte</button>
      </div>`;
    root.querySelector('[data-act="next"]').onclick = () => showSpeaking();
    root.querySelector('[data-act="skip"]').onclick = () => {
      data.speaking.forEach((s) => spoken.push({ id: s.id, skill: 'speaking', level: s.level, score: 0, skipped: true }));
      finish();
    };
  }

  function showSpeaking(feedback = '') {
    const sp = data.speaking[spIndex];
    root.innerHTML = `
      ${progress()}
      <p class="eyebrow">Frase ${spIndex + 1} de ${data.speaking.length}</p>
      <h2 class="say" lang="en">${esc(sp.text)}</h2>
      <div class="listen-row">
        <button class="btn btn-play" data-act="play">▶ Escuchar</button>
        <button class="btn btn-ghost" data-act="slow">Más despacio</button>
      </div>
      ${canListen ? `
        <button class="btn btn-mic" data-act="mic">🎙 Pulsa y habla</button>
        <p class="hint" data-feedback>${feedback}</p>
        <button class="btn btn-ghost" data-act="skip">No puedo hablar ahora</button>` : `
        <p>Repítela en voz alta y dime cómo te ha salido:</p>
        <div class="options">
          <button class="option" data-self="1">Bien</button>
          <button class="option" data-self="0.5">Regular</button>
          <button class="option" data-self="0">No me ha salido</button>
        </div>`}`;

    root.querySelector('[data-act="play"]').onclick = () => speak(sp.text, voice);
    root.querySelector('[data-act="slow"]').onclick = () => speak(sp.text, { ...voice, rate: 0.6 });

    if (canListen) {
      const mic = root.querySelector('[data-act="mic"]');
      const out = root.querySelector('[data-feedback]');
      mic.onclick = async () => {
        mic.disabled = true;
        mic.textContent = '🎙 Te escucho…';
        try {
          const alts = await listen({ lang: data.speechLang });
          const best = alts.reduce((acc, t) => {
            const s = similarity(sp.text, t);
            return s > acc.score ? { score: s, text: t } : acc;
          }, { score: 0, text: alts[0] || '' });
          recordSpoken(sp, best.score, best.text);
        } catch (err) {
          mic.disabled = false;
          mic.textContent = '🎙 Pulsa y habla';
          out.textContent = err.message === 'not-allowed'
            ? 'No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador o salta esta frase.'
            : 'No te he oído bien. Prueba otra vez, un poco más cerca del micrófono.';
        }
      };
      root.querySelector('[data-act="skip"]').onclick = () => recordSpoken(sp, 0, '', true);
    } else {
      root.querySelectorAll('[data-self]').forEach((btn) => {
        btn.onclick = () => recordSpoken(sp, Number(btn.dataset.self), '', false, true);
      });
    }
  }

  function recordSpoken(sp, score, heard, skipped = false, selfRated = false) {
    spoken.push({ id: sp.id, skill: 'speaking', level: sp.level, score, heard, skipped, selfRated,
      missing: heard ? missingWords(sp.text, heard) : [] });
    if (heard) {
      const pct = Math.round(score * 100);
      root.querySelector('[data-feedback]').innerHTML =
        `He entendido: <em lang="en">«${esc(heard)}»</em> · ${pct} % de coincidencia`;
    }
    spIndex++;
    const next = () => (spIndex < data.speaking.length ? showSpeaking() : finish());
    if (heard) setTimeout(next, 1800);
    else next();
  }

  function finish() {
    onFinish(scoreResult(data, answers, spoken));
  }
}

export function scoreResult(data, answers, spoken) {
  const levelRatio = (level) => {
    const block = data.blocks.find((b) => b.level === level);
    const got = answers.filter((a) => a.level === level && a.correct).length;
    return block ? got / block.items.length : 0;
  };
  const a1 = levelRatio('A1');
  const a2 = levelRatio('A2');
  const b1 = levelRatio('B1');
  let level;
  if (a1 < PASS) level = a1 < 0.3 ? 'Pre-A1' : 'A1 inicial';
  else if (a2 < PASS) level = 'A1';
  else if (b1 < PASS) level = 'A2';
  else level = 'B1 o superior';

  // Porcentaje por destreza sobre el total de la prueba (lo no alcanzado cuenta como 0),
  // para que las pruebas de los días 1, 45 y 90 se puedan comparar.
  const allItems = data.blocks.flatMap((b) => b.items);
  const skills = {};
  for (const skill of SKILLS) {
    if (skill === 'speaking') {
      const total = spoken.reduce((n, s) => n + s.score, 0);
      skills.speaking = data.speaking.length ? Math.round((total / data.speaking.length) * 100) : 0;
      continue;
    }
    const total = allItems.filter((i) => i.skill === skill).length;
    const got = answers.filter((a) => a.skill === skill && a.correct).length;
    skills[skill] = total ? Math.round((got / total) * 100) : 0;
  }

  return {
    date: new Date().toISOString(),
    language: data.language,
    level,
    blocks: { A1: Math.round(a1 * 100), A2: Math.round(a2 * 100), B1: Math.round(b1 * 100) },
    skills,
    answers,
    spoken,
  };
}
