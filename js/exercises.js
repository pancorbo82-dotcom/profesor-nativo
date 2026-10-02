// Ejercicios reutilizables en lecciones, cuestionarios y repasos.
// Cada ejercicio se pinta en un contenedor y avisa con onDone({ correct, picked }).
import { esc, shuffle } from './ui.js';
import { speak, listen, canListen, similarity } from './speech.js';

const DONT_KNOW = 'No lo sé';

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function accepted(ex) {
  return [ex.answer, ...(ex.accept || [])].map(normalize);
}

export function renderExercise(root, ex, ctx, onDone) {
  const voice = ctx.voice;
  const renderers = { choose, fill, order, 'listen-write': listenWrite, speak: speakIt };
  const render = renderers[ex.type];
  if (!render) throw new Error(`Tipo de ejercicio desconocido: ${ex.type}`);
  render();

  function audioRow() {
    return `
      <div class="listen-row">
        <button class="btn btn-play" data-act="play">▶ Escuchar</button>
        <button class="btn btn-ghost" data-act="slow">Más despacio</button>
      </div>`;
  }

  function wireAudio(text) {
    root.querySelector('[data-act="play"]').onclick = () => speak(text, voice);
    root.querySelector('[data-act="slow"]').onclick = () => speak(text, { ...voice, rate: 0.6 });
  }

  function feedback(correct, picked, extra = '') {
    const answerText = ex.type === 'speak' ? ex.text : ex.answer;
    const box = document.createElement('div');
    box.className = `feedback ${correct ? 'ok' : 'ko'}`;
    box.setAttribute('role', 'status');
    box.innerHTML = `
      <p class="feedback-title">${correct ? '¡Correcto!' : 'No del todo'}</p>
      ${!correct && ex.type !== 'speak' ? `<p>Respuesta correcta: <strong lang="en">${esc(answerText)}</strong></p>` : ''}
      ${extra}
      ${ex.explain ? `<p class="hint">${esc(ex.explain)}</p>` : ''}
      <button class="btn btn-primary" data-act="continue">Continuar</button>`;
    root.querySelectorAll('button, input').forEach((el) => {
      if (!el.closest('.listen-row')) el.disabled = true;
    });
    root.append(box);
    if (ex.audio || ex.type === 'speak' || ex.sayAnswer) speak(ex.sayAnswer || ex.audio || ex.text, voice);
    const next = box.querySelector('[data-act="continue"]');
    next.focus();
    next.onclick = () => onDone({ correct, picked });
  }

  function choose() {
    const options = [...shuffle(ex.options), DONT_KNOW];
    root.innerHTML = `
      ${ex.audio ? audioRow() : ''}
      <h2 class="question" ${ex.promptLang === 'en' ? 'lang="en"' : ''}>${esc(ex.prompt)}</h2>
      <div class="options">
        ${options.map((o, i) => `<button class="option${o === DONT_KNOW ? ' option-skip' : ''}" data-i="${i}" ${ex.optionsLang === 'en' ? 'lang="en"' : ''}>${esc(o)}</button>`).join('')}
      </div>`;
    if (ex.audio) {
      wireAudio(ex.audio);
      speak(ex.audio, voice);
    }
    root.querySelectorAll('.option').forEach((btn) => {
      btn.onclick = () => {
        const picked = options[Number(btn.dataset.i)];
        const correct = picked === ex.answer;
        btn.classList.add(correct ? 'is-right' : 'is-wrong');
        if (!correct) {
          root.querySelectorAll('.option').forEach((b) => {
            if (options[Number(b.dataset.i)] === ex.answer) b.classList.add('is-right');
          });
        }
        feedback(correct, picked);
      };
    });
  }

  function textAnswer(promptHtml, audio) {
    root.innerHTML = `
      ${audio ? audioRow() : ''}
      ${promptHtml}
      <form class="answer-form" autocomplete="off">
        <input class="text-answer" name="answer" lang="en" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Tu respuesta">
        <button class="btn btn-primary" type="submit">Comprobar</button>
        <button class="btn btn-ghost" type="button" data-act="dont-know">No lo sé</button>
      </form>`;
    if (audio) {
      wireAudio(audio);
      speak(audio, voice);
    }
    const form = root.querySelector('form');
    const input = form.answer;
    if (!audio) input.focus();
    const check = (value) => {
      const picked = value.trim();
      const correct = picked !== '' && accepted(ex).includes(normalize(picked));
      feedback(correct, picked || DONT_KNOW, picked && !correct ? `<p>Has escrito: <span class="bad" lang="en">${esc(picked)}</span></p>` : '');
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!input.value.trim()) return input.focus();
      check(input.value);
    };
    form.querySelector('[data-act="dont-know"]').onclick = () => check('');
  }

  function fill() {
    const [before, after] = ex.sentence.split('___');
    textAnswer(`
      <p class="eyebrow">Completa la frase</p>
      ${ex.hint ? `<p class="hint">${esc(ex.hint)}</p>` : ''}
      <h2 class="question" lang="en">${esc(before)}<span class="gap">___</span>${esc(after ?? '')}</h2>`, ex.audio);
  }

  function listenWrite() {
    textAnswer(`
      <p class="eyebrow">Escucha y escribe lo que oyes</p>
      ${ex.hint ? `<p class="hint">${esc(ex.hint)}</p>` : ''}`, ex.audio || ex.answer);
  }

  function order() {
    const words = ex.answer.split(' ');
    let pool = shuffle(words.map((w, i) => ({ w, i })));
    if (pool.map((p) => p.w).join(' ') === ex.answer && words.length > 1) pool = pool.reverse();
    const built = [];
    root.innerHTML = `
      <p class="eyebrow">Ordena las palabras</p>
      <h2 class="question">${esc(ex.prompt)}</h2>
      <div class="built" lang="en" aria-live="polite"></div>
      <div class="chips" lang="en"></div>
      <button class="btn btn-primary" data-act="check" disabled>Comprobar</button>
      <button class="btn btn-ghost" data-act="dont-know">No lo sé</button>`;
    const builtEl = root.querySelector('.built');
    const chipsEl = root.querySelector('.chips');
    const checkBtn = root.querySelector('[data-act="check"]');
    const draw = () => {
      builtEl.innerHTML = built.map((p, k) => `<button class="chip on" data-k="${k}">${esc(p.w)}</button>`).join('') || '<span class="hint">Toca las palabras en orden</span>';
      chipsEl.innerHTML = pool.map((p, k) => `<button class="chip" data-k="${k}">${esc(p.w)}</button>`).join('');
      builtEl.querySelectorAll('.chip').forEach((c) => { c.onclick = () => { pool.push(...built.splice(Number(c.dataset.k), 1)); draw(); }; });
      chipsEl.querySelectorAll('.chip').forEach((c) => { c.onclick = () => { built.push(...pool.splice(Number(c.dataset.k), 1)); draw(); }; });
      checkBtn.disabled = pool.length > 0;
    };
    draw();
    checkBtn.onclick = () => {
      const picked = built.map((p) => p.w).join(' ');
      feedback(accepted(ex).includes(normalize(picked)), picked);
    };
    root.querySelector('[data-act="dont-know"]').onclick = () => feedback(false, DONT_KNOW);
  }

  function speakIt() {
    root.innerHTML = `
      <p class="eyebrow">Escucha y repite en voz alta</p>
      ${ex.es ? `<p class="hint">${esc(ex.es)}</p>` : ''}
      <h2 class="say" lang="en">${esc(ex.text)}</h2>
      ${audioRow()}
      ${canListen ? `
        <button class="btn btn-mic" data-act="mic">🎙 Pulsa y habla</button>
        <p class="hint" data-out></p>
        <button class="btn btn-ghost" data-act="skip">No puedo hablar ahora</button>` : `
        <p>Repítela y dime cómo te ha salido:</p>
        <div class="options">
          <button class="option" data-self="1">Bien</button>
          <button class="option" data-self="0">Me ha costado</button>
        </div>`}`;
    wireAudio(ex.text);
    speak(ex.text, voice);
    if (!canListen) {
      root.querySelectorAll('[data-self]').forEach((b) => {
        b.onclick = () => onDone({ correct: b.dataset.self === '1', picked: 'autoevaluación' });
      });
      return;
    }
    const mic = root.querySelector('[data-act="mic"]');
    const out = root.querySelector('[data-out]');
    let tries = 0;
    mic.onclick = async () => {
      mic.disabled = true;
      mic.textContent = '🎙 Te escucho…';
      try {
        const alts = await listen({ lang: ctx.speechLang });
        const best = alts.reduce((acc, t) => {
          const s = similarity(ex.text, t);
          return s > acc.s ? { s, t } : acc;
        }, { s: 0, t: alts[0] || '' });
        tries++;
        const ok = best.s >= 0.8;
        if (!ok && tries < 3) {
          mic.disabled = false;
          mic.textContent = '🎙 Inténtalo otra vez';
          out.innerHTML = `He entendido <em lang="en">«${esc(best.t)}»</em>. Escucha de nuevo y repite.`;
          return;
        }
        feedback(ok, best.t, `<p>He entendido: <em lang="en">«${esc(best.t)}»</em> · ${Math.round(best.s * 100)} %</p>`);
      } catch (err) {
        mic.disabled = false;
        mic.textContent = '🎙 Pulsa y habla';
        out.textContent = err.message === 'not-allowed'
          ? 'No hay permiso para el micrófono. Actívalo en los ajustes del navegador.'
          : 'No te he oído bien. Prueba otra vez.';
      }
    };
    root.querySelector('[data-act="skip"]').onclick = () => onDone({ correct: true, picked: 'saltado', skipped: true });
  }
}
