// Repaso del día: tarjetas que tocan hoy y errores pendientes del diario.
import { esc, shuffle } from './ui.js';
import { speak } from './speech.js';
import { renderExercise } from './exercises.js';
import * as store from './store.js';

const MAX_ERRORS = 5;

export function pendingErrors() {
  return store.getErrors().filter((e) => !e.resolved && e.exercise);
}

export function reviewCount() {
  return store.dueCards().length + Math.min(pendingErrors().length, MAX_ERRORS);
}

export function runReview(root, ctx, onDone) {
  const queue = [
    ...shuffle(store.dueCards()).map((card) => ({ kind: 'card', card })),
    ...pendingErrors().slice(0, MAX_ERRORS).map((error) => ({ kind: 'error', error })),
  ];
  const total = queue.length;
  let good = 0;
  let i = 0;
  show();

  function top() {
    return `
      <header class="lesson-top">
        <button class="icon-link" data-act="exit" aria-label="Salir del repaso">✕</button>
        <div class="progress"><div style="width:${Math.round((i / Math.max(total, 1)) * 100)}%"></div></div>
      </header>`;
  }

  function show() {
    if (i >= queue.length) return finish();
    const item = queue[i];
    if (item.kind === 'card') return card(item.card);
    return error(item.error);
  }

  function wireExit() {
    root.querySelector('[data-act="exit"]').onclick = () => onDone();
  }

  function card(c) {
    root.innerHTML = `
      ${top()}
      <p class="eyebrow">Repaso · ${c.kind === 'word' ? 'palabra' : 'frase'}</p>
      <h2 class="say" lang="en">${esc(c.en)}</h2>
      <button class="btn btn-play" data-act="play">▶ Escuchar</button>
      <p class="hint">¿Recuerdas qué significa?</p>
      <div class="answer" hidden>
        <p class="lead">${esc(c.es)}</p>
        ${c.example ? `<p lang="en" class="hint">${esc(c.example)}</p>` : ''}
        <div class="grade">
          <button class="btn btn-ghost" data-grade="again">No me acordaba</button>
          <button class="btn btn-ghost" data-grade="hard">Me ha costado</button>
          <button class="btn btn-primary" data-grade="good">Lo sabía</button>
        </div>
      </div>
      <button class="btn btn-primary" data-act="show">Ver respuesta</button>`;
    wireExit();
    root.querySelector('[data-act="play"]').onclick = () => speak(c.en, ctx.voice);
    speak(c.en, ctx.voice);
    root.querySelector('[data-act="show"]').onclick = (e) => {
      e.target.hidden = true;
      root.querySelector('.answer').hidden = false;
    };
    root.querySelectorAll('[data-grade]').forEach((b) => {
      b.onclick = () => {
        store.gradeCard(c.id, b.dataset.grade);
        if (b.dataset.grade === 'good') good++;
        i++;
        show();
      };
    });
  }

  function error(e) {
    root.innerHTML = `${top()}<p class="eyebrow">Repaso · un error que cometiste</p><div class="exercise"></div>`;
    wireExit();
    renderExercise(root.querySelector('.exercise'), e.exercise, ctx, (r) => {
      store.markErrorPractice(e.key, r.correct);
      if (r.correct) good++;
      i++;
      window.scrollTo(0, 0);
      show();
    });
  }

  function finish() {
    root.innerHTML = `
      <section class="center-card">
        <h1>${total ? 'Repaso terminado' : 'Nada que repasar hoy'}</h1>
        ${total ? `<p class="big-score">${good} de ${total}</p>
        <p>Lo que te ha costado volverá antes; lo que sabías, más adelante.</p>` : '<p>Vuelve mañana: el repaso se prepara solo según lo que vas aprendiendo.</p>'}
        <button class="btn btn-primary" data-act="done">Volver al inicio</button>
      </section>`;
    root.querySelector('[data-act="done"]').onclick = () => onDone();
  }
}
