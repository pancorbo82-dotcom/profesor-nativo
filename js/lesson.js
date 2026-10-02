// Una lección: presentación, secciones en orden y cuestionario final.
import { esc, toast } from './ui.js';
import { speak } from './speech.js';
import { renderExercise } from './exercises.js';
import * as store from './store.js';

export const MASTERY = 0.8; // aciertos para dar la lección por dominada

export async function loadLesson(language, id) {
  const res = await fetch(`content/${language}/lessons/${id}.json`);
  if (!res.ok) throw new Error('No se pudo cargar la lección.');
  return res.json();
}

export function runLesson(root, lesson, ctx, { onExit, onComplete }) {
  const sections = lesson.sections;
  let index = -1;
  intro();

  function header(label) {
    const pct = index < 0 ? 0 : Math.round(((index + 1) / (sections.length + 1)) * 100);
    return `
      <header class="lesson-top">
        <button class="icon-link" data-act="exit" aria-label="Salir de la lección">✕</button>
        <div class="progress"><div style="width:${pct}%"></div></div>
      </header>
      ${label ? `<p class="eyebrow">${esc(label)}</p>` : ''}`;
  }

  function wireHeader() {
    root.querySelector('[data-act="exit"]').onclick = () => {
      if (confirm('¿Salir de la lección? Tendrás que empezarla de nuevo.')) onExit();
    };
  }

  function intro() {
    const state = store.getLessonState(lesson.id);
    root.innerHTML = `
      ${header()}
      <p class="eyebrow">Lección ${esc(lesson.number)} · unos ${esc(lesson.minutes)} min</p>
      <h1>${esc(lesson.title)}</h1>
      <p class="lead">${esc(lesson.situation)}</p>
      <h3>Al terminar sabrás…</h3>
      <ul class="plain">${lesson.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
      ${state ? `<p class="hint">Ya la completaste (${state.score} %). Puedes repetirla cuando quieras.</p>` : ''}
      <button class="btn btn-primary" data-act="start">Empezar la lección</button>
      <button class="btn btn-ghost" data-act="known">Ya lo sé: hacer el cuestionario</button>`;
    wireHeader();
    root.querySelector('[data-act="start"]').onclick = next;
    root.querySelector('[data-act="known"]').onclick = () => quiz({ shortcut: true });
  }

  function next() {
    index++;
    if (index >= sections.length) return quiz({ shortcut: false });
    const s = sections[index];
    const views = { story, vocab, grammar, pronunciation, practice, conversation, writing };
    window.scrollTo(0, 0);
    views[s.type](s);
  }

  function nextButton(label = 'Siguiente') {
    return `<button class="btn btn-primary next-btn" data-act="next">${esc(label)}</button>`;
  }

  function wireNext() {
    root.querySelector('[data-act="next"]').onclick = next;
  }

  // Escucha primero: el diálogo sin traducción, que se puede mostrar después.
  function story(s) {
    root.innerHTML = `
      ${header('Escucha')}
      <h2>${esc(s.title)}</h2>
      <p class="hint">${esc(s.intro || 'Escucha el diálogo sin leer la traducción. Después ábrela si la necesitas.')}</p>
      <button class="btn btn-play" data-act="all">▶ Escuchar todo</button>
      <ol class="dialogue">
        ${s.lines.map((l, i) => `
          <li>
            <button class="line-play" data-i="${i}" aria-label="Escuchar esta frase">▶</button>
            <div><strong>${esc(l.speaker)}:</strong> <span lang="en">${esc(l.en)}</span>
              <span class="tr" hidden>${esc(l.es)}</span></div>
          </li>`).join('')}
      </ol>
      <button class="btn btn-ghost" data-act="tr">Ver traducción</button>
      ${nextButton()}`;
    wireHeader();
    let stop = false;
    root.querySelector('[data-act="all"]').onclick = async () => {
      stop = false;
      for (const l of s.lines) {
        if (stop) break;
        await speak(l.en, ctx.voice);
      }
    };
    root.querySelectorAll('.line-play').forEach((b) => {
      b.onclick = () => { stop = true; speak(s.lines[Number(b.dataset.i)].en, ctx.voice); };
    });
    root.querySelector('[data-act="tr"]').onclick = (e) => {
      const hidden = root.querySelector('.tr').hidden;
      root.querySelectorAll('.tr').forEach((t) => { t.hidden = !hidden; });
      e.target.textContent = hidden ? 'Ocultar traducción' : 'Ver traducción';
    };
    wireNext();
  }

  function vocab(s) {
    root.innerHTML = `
      ${header('Vocabulario')}
      <h2>${esc(s.title)}</h2>
      ${s.intro ? `<p>${esc(s.intro)}</p>` : ''}
      <ul class="vocab">
        ${s.items.map((v, i) => `
          <li>
            <button class="line-play" data-i="${i}" aria-label="Escuchar ${esc(v.en)}">▶</button>
            <div>
              <p class="vocab-en" lang="en">${esc(v.en)}</p>
              <p class="vocab-es">${esc(v.es)}</p>
              ${v.example ? `<p class="vocab-ex"><span lang="en">${esc(v.example)}</span>${v.exampleEs ? ` · <span class="hint">${esc(v.exampleEs)}</span>` : ''}</p>` : ''}
              ${v.tip ? `<p class="tip">${esc(v.tip)}</p>` : ''}
            </div>
          </li>`).join('')}
      </ul>
      ${s.memory ? `<div class="note"><strong>Truco para recordar:</strong> ${esc(s.memory)}</div>` : ''}
      ${nextButton()}`;
    wireHeader();
    root.querySelectorAll('.line-play').forEach((b) => {
      const v = s.items[Number(b.dataset.i)];
      b.onclick = async () => {
        await speak(v.en, ctx.voice);
        if (v.example) speak(v.example, ctx.voice);
      };
    });
    wireNext();
  }

  // Gramática inductiva: primero los ejemplos, después la regla.
  function grammar(s) {
    root.innerHTML = `
      ${header('Gramática')}
      <h2>${esc(s.title)}</h2>
      <p>Fíjate en estas frases:</p>
      <table class="examples">
        <tbody>${s.examples.map((e, i) => `
          <tr><td><button class="line-play" data-i="${i}" aria-label="Escuchar">▶</button></td>
          <td lang="en">${esc(e.en)}</td><td class="hint">${esc(e.es)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="rule">
        <p class="eyebrow">La regla</p>
        ${s.rule.map((p) => `<p>${esc(p)}</p>`).join('')}
      </div>
      ${s.spanish ? `<div class="note"><strong>Comparado con el español:</strong> ${esc(s.spanish)}</div>` : ''}
      ${nextButton()}`;
    wireHeader();
    root.querySelectorAll('.line-play').forEach((b) => {
      b.onclick = () => speak(s.examples[Number(b.dataset.i)].en, ctx.voice);
    });
    wireNext();
  }

  function pronunciation(s) {
    root.innerHTML = `
      ${header('Pronunciación')}
      <h2>${esc(s.title)}</h2>
      ${s.explain.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${nextButton('Practicar')}`;
    wireHeader();
    root.querySelector('[data-act="next"]').onclick = () =>
      exerciseRun(s.phrases.map((p, i) => ({ id: `${s.id || 'pron'}-${i}`, type: 'speak', text: p.en, es: p.es })), 'Pronunciación', { log: false }, () => next());
  }

  function practice(s) {
    exerciseRun(s.exercises, 'Práctica', { log: true }, () => next());
  }

  function conversation(s) {
    const prompt = conversationPrompt(lesson, s, ctx);
    const notes = store.getLessonState(lesson.id)?.notes || '';
    root.innerHTML = `
      ${header('Conversación')}
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.scenario)}</p>
      <ol class="plain">
        <li>Pulsa <strong>Copiar guion</strong>.</li>
        <li>Abre la app de Claude, pega el guion y activa el modo voz.</li>
        <li>Habla unos 5 minutos. Al final, Claude te dará un resumen de tus errores.</li>
        <li>Pega ese resumen aquí abajo para guardarlo en tu diario.</li>
      </ol>
      <button class="btn btn-primary" data-act="copy">Copiar guion</button>
      <details><summary>Ver el guion</summary><pre class="script">${esc(prompt)}</pre></details>
      <label class="field">Resumen de la conversación (opcional)
        <textarea name="notes" rows="5" placeholder="Pega aquí el resumen de Claude">${esc(notes)}</textarea>
      </label>
      ${nextButton()}`;
    wireHeader();
    root.querySelector('[data-act="copy"]').onclick = async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        toast('Guion copiado. Pégalo en la app de Claude.');
      } catch {
        root.querySelector('details').open = true;
        toast('No se pudo copiar automáticamente: selecciona el texto del guion.');
      }
    };
    root.querySelector('[data-act="next"]').onclick = () => {
      const text = root.querySelector('textarea').value.trim();
      if (text) store.saveLessonNotes(lesson.id, text);
      next();
    };
  }

  function writing(s) {
    root.innerHTML = `
      ${header('Escritura')}
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.prompt)}</p>
      <textarea class="writing" rows="5" lang="en" placeholder="Escribe en inglés"></textarea>
      <button class="btn btn-ghost" data-act="model">Comparar con un ejemplo</button>
      <div class="model" hidden>
        <p class="eyebrow">Ejemplo</p>
        <p lang="en">${esc(s.model)}</p>
        <p class="eyebrow">Revisa que tu texto…</p>
        <ul class="checklist">${s.checklist.map((c) => `<li><label><input type="checkbox"> ${esc(c)}</label></li>`).join('')}</ul>
      </div>
      ${nextButton()}`;
    wireHeader();
    root.querySelector('[data-act="model"]').onclick = () => { root.querySelector('.model').hidden = false; };
    wireNext();
  }

  // Ejercicios uno tras otro. Los fallos van al diario de errores.
  function exerciseRun(exercises, label, { log }, done, results = []) {
    let i = 0;
    show();
    function show() {
      if (i >= exercises.length) return done(results);
      const ex = exercises[i];
      root.innerHTML = `${header(`${label} · ${i + 1} de ${exercises.length}`)}<div class="exercise"></div>`;
      wireHeader();
      renderExercise(root.querySelector('.exercise'), ex, ctx, (r) => {
        results.push({ ex, ...r });
        if (log && !r.correct && !r.skipped) {
          store.logError({ key: `${lesson.id}:${ex.id}`, lessonId: lesson.id, lessonTitle: lesson.title, exercise: ex, picked: r.picked });
        }
        i++;
        window.scrollTo(0, 0);
        show();
      });
    }
  }

  function quiz({ shortcut }) {
    index = sections.length;
    root.innerHTML = `
      ${header('Cuestionario final')}
      <h2>${shortcut ? 'Demuestra que ya lo sabes' : 'Comprueba lo que has aprendido'}</h2>
      <p>Son ${lesson.quiz.length} preguntas. Con un ${Math.round(MASTERY * 100)} % de aciertos la lección queda superada.</p>
      ${nextButton('Empezar')}`;
    wireHeader();
    root.querySelector('[data-act="next"]').onclick = () =>
      exerciseRun(lesson.quiz, 'Cuestionario', { log: true }, (results) => finish(results, shortcut), []);
  }

  function finish(results, shortcut) {
    const counted = results.filter((r) => !r.skipped);
    const score = counted.length ? Math.round((counted.filter((r) => r.correct).length / counted.length) * 100) : 0;
    const passed = score >= MASTERY * 100;
    const wrong = results.filter((r) => !r.correct && !r.skipped);

    if (passed) {
      store.completeLesson(lesson.id, { score, status: shortcut ? 'known' : 'done' });
      store.addCards(lessonCards(lesson), { box: shortcut ? 2 : 1 });
    }

    root.innerHTML = `
      ${header()}
      <section class="center-card">
        <p class="eyebrow">${esc(lesson.title)}</p>
        <h1>${passed ? '¡Lección superada!' : 'Casi lo tienes'}</h1>
        <p class="big-score">${score} %</p>
        <p>${passed
          ? `Has añadido ${lessonCards(lesson).length} palabras y frases a tu repaso. Volverán justo antes de que se te olviden.`
          : shortcut
            ? 'Mejor hagamos la lección completa: así afianzas lo que te falta.'
            : `Necesitas un ${Math.round(MASTERY * 100)} %. Repasa estos puntos y vuelve a intentar el cuestionario.`}</p>
        ${wrong.length ? `
          <ul class="review">${wrong.map((r) => `
            <li><p class="q" lang="en">${esc(r.ex.prompt || r.ex.sentence || r.ex.text || r.ex.answer)}</p>
            <p>Correcta: <span class="good" lang="en">${esc(r.ex.answer || r.ex.text)}</span></p>
            ${r.ex.explain ? `<p class="hint">${esc(r.ex.explain)}</p>` : ''}</li>`).join('')}</ul>` : ''}
        ${passed
          ? '<button class="btn btn-primary" data-act="done">Terminar</button>'
          : shortcut
            ? '<button class="btn btn-primary" data-act="full">Hacer la lección</button>'
            : '<button class="btn btn-primary" data-act="retry">Repetir el cuestionario</button><button class="btn btn-ghost" data-act="again">Repasar la lección</button>'}
      </section>`;
    wireHeader();
    const on = (act, fn) => { const b = root.querySelector(`[data-act="${act}"]`); if (b) b.onclick = fn; };
    on('done', () => onComplete({ score }));
    on('full', () => { index = -1; next(); });
    on('retry', () => quiz({ shortcut: false }));
    on('again', () => { index = -1; next(); });
  }
}

// Tarjetas de repaso: vocabulario y frases clave de la lección.
export function lessonCards(lesson) {
  const words = lesson.sections
    .filter((s) => s.type === 'vocab')
    .flatMap((s) => s.items)
    .map((v) => ({ id: `${lesson.id}:${v.en}`, kind: 'word', en: v.en, es: v.es, example: v.example || '', lessonId: lesson.id }));
  const phrases = (lesson.keyPhrases || [])
    .map((p) => ({ id: `${lesson.id}:${p.en}`, kind: 'phrase', en: p.en, es: p.es, lessonId: lesson.id }));
  return [...words, ...phrases];
}

// Guion para practicar la conversación en el modo voz de la app de Claude.
export function conversationPrompt(lesson, s, ctx) {
  const vocabList = lesson.sections.filter((x) => x.type === 'vocab').flatMap((x) => x.items).map((v) => v.en).join(', ');
  return [
    `Actúa como mi profesor nativo de inglés ${ctx.variantLabel}. Estoy aprendiendo desde cero; mi nivel es ${ctx.level}.`,
    `Situación: ${s.roleplay}`,
    `Vocabulario de hoy: ${vocabList}.`,
    `Estructuras de hoy: ${(s.structures || []).join('; ')}.`,
    'Reglas:',
    `- Habla en inglés con frases cortas y sencillas. Usa el español solo para ayudarme si no entiendo (como máximo un ${ctx.spanishPct} % del tiempo).`,
    '- Haz tú las preguntas y espera mi respuesta. Una pregunta cada vez.',
    '- Corrige cada error que cometa así: 1) lo que dije, 2) por qué no es correcto, en una frase en español, 3) cómo lo diría un nativo. Después continúa la conversación.',
    '- Si no entiendo algo, repítelo más despacio y con otras palabras antes de traducirlo.',
    '- La conversación dura unos 5 minutos.',
    '- Al terminar, dame un resumen en español con mis errores, la forma correcta y 3 frases para repasar.',
    'Empieza tú saludándome.',
  ].join('\n');
}
