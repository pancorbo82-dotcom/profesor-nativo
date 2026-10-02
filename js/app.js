import * as store from './store.js';
import { esc, formatDate, toast } from './ui.js';
import { canSpeak, canListen, getVoices, speak, listen } from './speech.js';
import { loadPlacement, runPlacement, SKILL_NAMES } from './placement.js';

const app = document.getElementById('app');

const LANGUAGES = [
  { code: 'en', name: 'Inglés', ready: true },
  { code: 'fr', name: 'Francés', ready: false },
  { code: 'de', name: 'Alemán', ready: false },
  { code: 'it', name: 'Italiano', ready: false },
  { code: 'pt', name: 'Portugués', ready: false },
];

const GOALS = [
  { id: 'rodajes', label: 'Rodajes de cine y series' },
  { id: 'produccion', label: 'Reuniones de producción' },
  { id: 'ejecutivas', label: 'Reuniones ejecutivas y corporativas' },
  { id: 'localizaciones', label: 'Localizaciones' },
  { id: 'viajes', label: 'Viajes' },
  { id: 'diario', label: 'Conversación del día a día' },
];

const VARIANTS = [
  { id: 'us-uk', label: 'Americano, con notas del británico', note: 'Recomendado' },
  { id: 'us', label: 'Solo americano' },
  { id: 'uk', label: 'Solo británico' },
];

const MINUTES = [15, 30, 45, 60];
const TEST_DAYS = { intermedia: 45, final: 90 };

// ---------- Router ----------

const routes = {
  '': home,
  configurar: onboarding,
  prueba: placement,
  resultado: result,
  ajustes: settings,
};

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (!store.getProfile() && name !== 'configurar') {
    location.replace('#/configurar');
    return;
  }
  const view = routes[name] || home;
  window.scrollTo(0, 0);
  view(arg);
  app.focus({ preventScroll: true });
}

window.addEventListener('hashchange', route);

// ---------- Inicio ----------

function home() {
  const profile = store.getProfile();
  const tests = store.getTests();
  const day = store.planDay();
  const lang = LANGUAGES.find((l) => l.code === profile.language);
  const first = tests[0];

  app.innerHTML = `
    <header class="top">
      <h1>Profesor Nativo</h1>
      <a class="icon-link" href="#/ajustes" aria-label="Ajustes">⚙</a>
    </header>
    ${installCard()}
    ${!first ? `
      <section class="card card-accent">
        <p class="eyebrow">Paso 1</p>
        <h2>Haz la prueba de nivel inicial</h2>
        <p>Unos 15 minutos. Es tu punto de partida: la repetirás el día 45 y el día 90 para ver cuánto has avanzado.</p>
        <a class="btn btn-primary" href="#/prueba">Empezar la prueba</a>
      </section>` : `
      <section class="card card-accent">
        <p class="eyebrow">${esc(lang?.name || '')} · ${profile.minutesPerDay} min al día</p>
        <h2>Día ${day} de 90</h2>
        <div class="progress"><div style="width:${Math.round((day / 90) * 100)}%"></div></div>
        <p>Nivel de partida: <strong>${esc(first.level)}</strong> · <a href="#/resultado/0">ver resultado</a></p>
      </section>
      <section class="card">
        <h2>Lección de hoy</h2>
        <p>Las lecciones llegan en la próxima versión de la app. Mientras tanto, tu plan ya ha empezado a contar desde la prueba inicial.</p>
      </section>
      <section class="card">
        <h2>Próximas pruebas</h2>
        <ul class="plain">
          ${Object.entries(TEST_DAYS).map(([type, d]) => {
            const date = new Date(first.date);
            date.setDate(date.getDate() + d - 1);
            const done = tests.some((t) => t.type === type);
            return `<li>Prueba ${type} · día ${d} · ${formatDate(date.toISOString())}${done ? ' · hecha' : ''}</li>`;
          }).join('')}
        </ul>
        ${tests.length > 1 ? `<p><a href="#/resultado/${tests.length - 1}">Ver la última prueba</a></p>` : ''}
      </section>`}
  `;
  wireInstall();
}

// ---------- Instalación ----------

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!location.hash || location.hash === '#/') home();
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function installCard() {
  if (isStandalone()) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `
    <section class="card card-quiet">
      <h2>Instálala en este dispositivo</h2>
      ${deferredPrompt ? '<button class="btn btn-primary" data-act="install">Instalar la app</button>'
        : ios ? '<p>En Safari, pulsa <strong>Compartir</strong> y después <strong>Añadir a pantalla de inicio</strong>.</p>'
        : '<p>En el menú del navegador, elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>'}
    </section>`;
}

function wireInstall() {
  const btn = app.querySelector('[data-act="install"]');
  if (!btn) return;
  btn.onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    home();
  };
}

// ---------- Configuración inicial ----------

function onboarding() {
  const draft = { ...store.DEFAULT_PROFILE, ...store.getProfile() };
  const steps = [stepWelcome, stepLanguage, stepTime, stepGoals, stepVariant, stepVoice];
  let i = 0;
  render();

  function render() {
    app.innerHTML = `
      <div class="steps" aria-hidden="true">${steps.map((_, n) => `<span class="${n <= i ? 'on' : ''}"></span>`).join('')}</div>
      <section class="step">${steps[i]()}</section>
      <nav class="step-nav">
        ${i > 0 ? '<button class="btn btn-ghost" data-act="back">Atrás</button>' : '<span></span>'}
        <button class="btn btn-primary" data-act="next">${i === steps.length - 1 ? 'Guardar y empezar' : 'Siguiente'}</button>
      </nav>`;
    app.querySelector('[data-act="next"]').onclick = next;
    const back = app.querySelector('[data-act="back"]');
    if (back) back.onclick = () => { i--; render(); };
    wireStep();
  }

  function next() {
    collect();
    if (i < steps.length - 1) {
      i++;
      render();
      return;
    }
    if (!store.saveProfile(draft)) toast('No se pudo guardar. Revisa que el navegador permita guardar datos.');
    location.hash = store.getTests().length ? '#/' : '#/prueba';
  }

  function collect() {
    const form = app.querySelector('form');
    if (!form) return;
    const data = new FormData(form);
    if (data.has('language')) draft.language = data.get('language');
    if (data.has('minutes')) draft.minutesPerDay = Number(data.get('minutes'));
    if (data.has('days')) draft.daysPerWeek = Number(data.get('days'));
    if (form.dataset.step === 'goals') draft.goals = data.getAll('goals');
    if (data.has('variant')) draft.variant = data.get('variant');
    if (data.has('voice')) draft.voiceURI = data.get('voice') || null;
    if (data.has('rate')) draft.rate = Number(data.get('rate'));
  }

  function stepWelcome() {
    return `
      <h1>Bienvenido a Profesor Nativo</h1>
      <p class="lead">Tu profesor particular de idiomas, empezando desde cero.</p>
      <p>Primero configuramos tu curso en cinco pasos rápidos. Después harás una prueba de nivel para tener tu punto de partida.</p>
      <p class="hint">Tu progreso se guarda solo en este dispositivo.</p>`;
  }

  function stepLanguage() {
    return `
      <form data-step="language">
        <h2>¿Qué idioma quieres aprender?</h2>
        <div class="choices">
          ${LANGUAGES.map((l) => `
            <label class="choice${l.ready ? '' : ' disabled'}">
              <input type="radio" name="language" value="${l.code}" ${draft.language === l.code ? 'checked' : ''} ${l.ready ? '' : 'disabled'}>
              <span>${esc(l.name)}${l.ready ? '' : ' <small>Próximamente</small>'}</span>
            </label>`).join('')}
        </div>
      </form>`;
  }

  function stepTime() {
    return `
      <form data-step="time">
        <h2>¿Cuánto tiempo puedes dedicarle?</h2>
        <p>Puedes cambiarlo cuando quieras en Ajustes.</p>
        <h3>Minutos al día</h3>
        <div class="choices row">
          ${MINUTES.map((m) => `
            <label class="choice"><input type="radio" name="minutes" value="${m}" ${draft.minutesPerDay === m ? 'checked' : ''}><span>${m} min</span></label>`).join('')}
        </div>
        <h3>Días a la semana</h3>
        <div class="choices row">
          ${[3, 4, 5, 6, 7].map((d) => `
            <label class="choice"><input type="radio" name="days" value="${d}" ${draft.daysPerWeek === d ? 'checked' : ''}><span>${d}</span></label>`).join('')}
        </div>
      </form>`;
  }

  function stepGoals() {
    return `
      <form data-step="goals">
        <h2>¿Para qué lo necesitas?</h2>
        <p>Elige todo lo que te interese. Lo usaremos para elegir el vocabulario y las situaciones de práctica.</p>
        <div class="choices">
          ${GOALS.map((g) => `
            <label class="choice"><input type="checkbox" name="goals" value="${g.id}" ${draft.goals.includes(g.id) ? 'checked' : ''}><span>${esc(g.label)}</span></label>`).join('')}
        </div>
      </form>`;
  }

  function stepVariant() {
    return `
      <form data-step="variant">
        <h2>¿Qué inglés quieres hablar?</h2>
        <div class="choices">
          ${VARIANTS.map((v) => `
            <label class="choice"><input type="radio" name="variant" value="${v.id}" ${draft.variant === v.id ? 'checked' : ''}>
              <span>${esc(v.label)}${v.note ? ` <small>${esc(v.note)}</small>` : ''}</span></label>`).join('')}
        </div>
        <p class="hint">Con la opción recomendada hablarás en americano y aprenderás a entender también el británico.</p>
      </form>`;
  }

  function stepVoice() {
    return `
      <form data-step="voice">
        <h2>Voz y micrófono</h2>
        ${canSpeak ? `
          <label class="field">Voz en inglés
            <select name="voice" data-voices><option value="">Cargando voces…</option></select>
          </label>
          <label class="field">Velocidad
            <input type="range" name="rate" min="0.6" max="1.1" step="0.1" value="${draft.rate}">
          </label>
          <button type="button" class="btn btn-play" data-act="test-voice">▶ Probar voz</button>
          <p class="hint">En iPhone puedes descargar gratis voces de mejor calidad en Ajustes › Accesibilidad › Contenido leído › Voces › Inglés.</p>`
        : '<p>Este navegador no puede leer en voz alta. Prueba con Chrome, Edge o Safari.</p>'}
        <h3>Micrófono</h3>
        ${canListen ? `
          <p>Pulsa el botón y di <strong lang="en">«Hello, how are you?»</strong></p>
          <button type="button" class="btn btn-mic" data-act="test-mic">🎙 Probar micrófono</button>
          <p class="hint" data-mic-out></p>`
        : '<p>Este navegador no reconoce la voz, así que en los ejercicios orales valorarás tú cómo te ha salido. En Chrome, Edge o Safari funciona.</p>'}
      </form>`;
  }

  async function wireStep() {
    const select = app.querySelector('[data-voices]');
    if (select) {
      const voices = await getVoices('en');
      select.innerHTML = voices.length
        ? voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === draft.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')
        : '<option value="">Voz por defecto</option>';
    }
    const testVoice = app.querySelector('[data-act="test-voice"]');
    if (testVoice) {
      testVoice.onclick = () => {
        collect();
        speak('Hello! Welcome to your first English lesson.', { voiceURI: draft.voiceURI, rate: draft.rate });
      };
    }
    const testMic = app.querySelector('[data-act="test-mic"]');
    if (testMic) {
      const out = app.querySelector('[data-mic-out]');
      testMic.onclick = async () => {
        out.textContent = 'Te escucho…';
        try {
          const [heard] = await listen();
          out.innerHTML = `He entendido: <em lang="en">«${esc(heard)}»</em>. ¡Funciona!`;
        } catch (err) {
          out.textContent = err.message === 'not-allowed'
            ? 'No hay permiso para el micrófono. Actívalo en los ajustes del navegador.'
            : 'No te he oído. Prueba otra vez.';
        }
      };
    }
  }
}

// ---------- Prueba de nivel ----------

async function placement() {
  const profile = store.getProfile();
  app.innerHTML = '<p class="loading">Cargando la prueba…</p>';
  let data;
  try {
    data = await loadPlacement(profile.language);
  } catch {
    app.innerHTML = '<section class="card"><h2>No se pudo cargar la prueba</h2><p>Comprueba la conexión y vuelve a intentarlo.</p><a class="btn btn-primary" href="#/">Volver</a></section>';
    return;
  }
  const tests = store.getTests();
  app.innerHTML = `
    <section class="center-card">
      <p class="eyebrow">${esc(data.title)}</p>
      <h1>Antes de empezar</h1>
      <ul class="plain">
        <li>Son tres partes de preguntas y una parte oral, unos 15 minutos.</li>
        <li>Si una parte te resulta muy difícil, la prueba termina antes. Es normal si empiezas desde cero.</li>
        <li>No adivines: si no sabes la respuesta, elige «No lo sé».</li>
        <li>Usa auriculares o sube el volumen para las preguntas de escucha.</li>
      </ul>
      <button class="btn btn-primary" data-act="start">Empezar</button>
      <a class="btn btn-ghost" href="#/">Ahora no</a>
    </section>`;
  app.querySelector('[data-act="start"]').onclick = () => {
    app.innerHTML = '<div class="quiz"></div>';
    runPlacement(app.querySelector('.quiz'), data, profile, (res) => {
      res.type = testType(tests);
      if (!store.addTest(res)) toast('No se pudo guardar el resultado en este dispositivo.');
      location.hash = `#/resultado/${store.getTests().length - 1}`;
    });
  };
}

function testType(tests) {
  if (!tests.length) return 'inicial';
  const day = store.planDay();
  if (day >= TEST_DAYS.final && !tests.some((t) => t.type === 'final')) return 'final';
  if (day >= TEST_DAYS.intermedia && !tests.some((t) => t.type === 'intermedia')) return 'intermedia';
  return 'repaso';
}

// ---------- Resultado ----------

async function result(arg) {
  const tests = store.getTests();
  const res = tests[Number(arg)] ?? tests.at(-1);
  if (!res) {
    location.replace('#/');
    return;
  }
  let data = null;
  try { data = await loadPlacement(res.language); } catch { /* sin revisión detallada */ }
  const items = data ? Object.fromEntries(data.blocks.flatMap((b) => b.items).map((it) => [it.id, it])) : {};
  const wrong = res.answers.filter((a) => !a.correct && items[a.id]);
  const first = tests[0];

  app.innerHTML = `
    <header class="top">
      <a class="icon-link" href="#/" aria-label="Volver al inicio">←</a>
      <h1>Resultado</h1>
      <span></span>
    </header>
    <section class="card card-accent">
      <p class="eyebrow">Prueba ${esc(res.type || 'inicial')} · ${formatDate(res.date)}</p>
      <h2 class="level">${esc(res.level)}</h2>
      <p>${levelMessage(res.level)}</p>
    </section>
    <section class="card">
      <h2>Por destrezas</h2>
      <p class="hint">Porcentaje sobre el total de la prueba${res !== first ? '. Entre paréntesis, tu prueba inicial' : ''}.</p>
      ${Object.entries(res.skills).map(([skill, pct]) => `
        <div class="bar-row">
          <span>${esc(SKILL_NAMES[skill])}</span>
          <div class="bar"><div style="width:${pct}%"></div></div>
          <strong>${pct} %${res !== first ? ` <small>(${first.skills[skill]} %)</small>` : ''}</strong>
        </div>`).join('')}
    </section>
    ${wrong.length ? `
      <section class="card">
        <h2>Repasa tus fallos</h2>
        <ul class="review">
          ${wrong.map((a) => {
            const it = items[a.id];
            return `<li>
              <p class="q" lang="en">${esc(it.audio || it.passage || it.prompt)}</p>
              ${it.audio || it.passage ? `<p class="q-sub">${esc(it.prompt)}</p>` : ''}
              <p>Tu respuesta: <span class="bad">${esc(a.picked)}</span> · Correcta: <span class="good">${esc(it.answer)}</span></p>
              <p class="hint">${esc(it.explain)}</p>
            </li>`;
          }).join('')}
        </ul>
      </section>` : ''}
    ${res.spoken?.some((s) => s.missing?.length) ? `
      <section class="card">
        <h2>Pronunciación</h2>
        <p>Estas palabras no se reconocieron al hablar. Las trabajaremos en las primeras lecciones:</p>
        <p lang="en"><strong>${esc([...new Set(res.spoken.flatMap((s) => s.missing || []))].join(', '))}</strong></p>
      </section>` : ''}
    ${data?.external?.length ? `
      <section class="card card-quiet">
        <h2>Segunda opinión</h2>
        <p>Si quieres contrastar tu nivel, estas pruebas externas son gratuitas:</p>
        <ul class="plain">${data.external.map((e) => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)}</a></li>`).join('')}</ul>
      </section>` : ''}
    <a class="btn btn-primary" href="#/">Ir al inicio</a>`;
}

function levelMessage(level) {
  const messages = {
    'Pre-A1': 'Empiezas desde cero, que es justo para lo que está pensado este curso. En 90 días el objetivo es llegar a un A1 sólido.',
    'A1 inicial': 'Ya reconoces algunas palabras y frases básicas. Empezaremos por los fundamentos para afianzarlos.',
    A1: 'Te manejas con lo más básico. El plan reforzará lo que sabes y te llevará hacia el A2.',
    A2: 'Tienes una buena base. Avanzaremos más rápido por los fundamentos y nos centraremos en hablar.',
    'B1 o superior': 'Tienes un nivel intermedio. El curso se centrará en fluidez, conversación e inglés audiovisual.',
  };
  return messages[level] || '';
}

// ---------- Ajustes ----------

function settings() {
  const p = store.getProfile();
  const tests = store.getTests();
  app.innerHTML = `
    <header class="top">
      <a class="icon-link" href="#/" aria-label="Volver al inicio">←</a>
      <h1>Ajustes</h1>
      <span></span>
    </header>
    <section class="card">
      <h2>Tu curso</h2>
      <dl class="summary">
        <dt>Idioma</dt><dd>${esc(LANGUAGES.find((l) => l.code === p.language)?.name)}</dd>
        <dt>Tiempo</dt><dd>${p.minutesPerDay} min al día, ${p.daysPerWeek} días a la semana</dd>
        <dt>Objetivos</dt><dd>${esc(p.goals.map((g) => GOALS.find((x) => x.id === g)?.label).filter(Boolean).join(', ') || 'Sin elegir')}</dd>
        <dt>Variante</dt><dd>${esc(VARIANTS.find((v) => v.id === p.variant)?.label)}</dd>
      </dl>
      <a class="btn btn-ghost" href="#/configurar">Cambiar configuración</a>
    </section>
    <section class="card">
      <h2>Pruebas de nivel</h2>
      ${tests.length ? `<ul class="plain">${tests.map((t, n) => `<li><a href="#/resultado/${n}">Prueba ${esc(t.type || 'inicial')} · ${formatDate(t.date)} · ${esc(t.level)}</a></li>`).join('')}</ul>` : '<p>Aún no has hecho ninguna.</p>'}
      <a class="btn btn-ghost" href="#/prueba">${tests.length ? 'Repetir la prueba' : 'Hacer la prueba'}</a>
    </section>
    <section class="card">
      <h2>Copia de seguridad</h2>
      <p>Tu progreso solo está en este dispositivo. Descarga una copia para guardarla o para pasarla a otro dispositivo.</p>
      <button class="btn btn-ghost" data-act="export">Descargar copia</button>
      <label class="btn btn-ghost file-btn">Cargar copia<input type="file" accept="application/json,.json" data-act="import" hidden></label>
    </section>
    <section class="card card-danger">
      <h2>Borrar todo</h2>
      <p>Elimina tu configuración y tus resultados de este dispositivo. No se puede deshacer.</p>
      <button class="btn btn-danger" data-act="reset">Borrar mis datos</button>
    </section>`;

  app.querySelector('[data-act="export"]').onclick = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `profesor-nativo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  app.querySelector('[data-act="import"]').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Esto sustituirá los datos de este dispositivo por los de la copia. ¿Continuar?')) return;
    try {
      store.importData(await file.text());
      toast('Copia cargada.');
      settings();
    } catch (err) {
      toast(err.message || 'No se pudo leer la copia.');
    }
  };
  app.querySelector('[data-act="reset"]').onclick = () => {
    if (!confirm('¿Seguro que quieres borrar todos tus datos de este dispositivo?')) return;
    store.resetAll();
    location.hash = '#/configurar';
  };
}

// ---------- Arranque ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona sin él */ });
  });
}

route();
