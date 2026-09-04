/* view-quiz.js — test corto de onboarding: genera el plan personalizado (peso/reps por
   ejercicio) a partir de edad, altura, peso, sexo, nivel de actividad y experiencia.
   El usuario no vuelve a teclear nada de esto en Entrenar — todo sale de aquí. */

const ViewQuiz = (() => {
  const STEPS = ["datos", "actividad", "experiencia"];
  let step = 0;
  let onDone = null;
  let answers = { edad: 23, altura_cm: 170, peso_kg: 75, sexo: "hombre", nivel_actividad: "moderado", experiencia: "principiante" };

  const ACTIVIDAD = [
    ["sedentario", "Sedentario", "Trabajo de oficina, poco movimiento en el día a día."],
    ["ligero", "Ligero", "Caminas bastante o tienes un trabajo activo, pero no entrenas todavía."],
    ["moderado", "Moderado", "Ya entrenas o te mueves con regularidad."],
    ["alto", "Alto", "Mucho movimiento diario o deporte además del gimnasio."]
  ];
  const EXPERIENCIA = [
    ["principiante", "Principiante", "Menos de 6 meses entrenando con pesas."],
    ["intermedio", "Intermedio", "Entre 6 meses y 2 años de experiencia."],
    ["avanzado", "Avanzado", "Más de 2 años entrenando con constancia."]
  ];

  function root() { return document.getElementById("quiz"); }

  function render(cb) {
    onDone = cb;
    step = 0;
    const profile = Store.getProfile();
    answers = {
      edad: profile.edad || 23, altura_cm: profile.altura_cm || 170, peso_kg: profile.peso_kg || 75,
      sexo: profile.sexo || "hombre",
      nivel_actividad: profile.nivel_actividad || "moderado",
      experiencia: profile.experiencia || "principiante"
    };
    root().innerHTML = `
      <div class="quiz-card">
        <img class="quiz-mark" src="icons/icon.svg" alt="">
        <div class="quiz-dots" id="quiz-dots">${STEPS.map(() => `<span class="dot"></span>`).join("")}</div>
        <div id="quiz-step-wrap"><div id="quiz-step"></div></div>
      </div>
    `;
    renderStep();
  }

  function updateDots() {
    root().querySelectorAll(".quiz-dots .dot").forEach((d, i) => d.classList.toggle("active", i <= step));
  }

  function goStep(delta) {
    const wrap = document.getElementById("quiz-step-wrap");
    wrap.classList.add("out");
    setTimeout(() => {
      step += delta;
      renderStep();
      wrap.classList.remove("out");
    }, 180);
  }

  function renderStep() {
    updateDots();
    const el = document.getElementById("quiz-step");
    if (STEPS[step] === "datos") el.innerHTML = datosHtml();
    else if (STEPS[step] === "actividad") el.innerHTML = chipStepHtml("¿Cuánto te mueves normalmente?", "Nos sirve para calcular mejor tu punto de partida.", ACTIVIDAD, answers.nivel_actividad);
    else el.innerHTML = chipStepHtml("¿Cuánta experiencia tienes entrenando con pesas?", "Así calculamos un peso de partida realista para cada ejercicio.", EXPERIENCIA, answers.experiencia, true);
    wireStep();
  }

  function datosHtml() {
    return `
      <h2>Vamos a conocerte</h2>
      <p class="muted" style="margin-bottom:18px;">Con esto generamos tu plan Toji a medida: qué peso y cuántas repeticiones hacer en cada ejercicio, sin que tengas que rellenar nada durante el entrenamiento.</p>
      <div class="quiz-field"><label>Edad</label><input type="number" id="q-edad" value="${answers.edad}" inputmode="numeric"></div>
      <div class="quiz-field"><label>Altura (cm)</label><input type="number" id="q-altura" value="${answers.altura_cm}" inputmode="numeric"></div>
      <div class="quiz-field"><label>Peso actual (kg)</label><input type="number" step="0.1" id="q-peso" value="${answers.peso_kg}" inputmode="decimal"></div>
      <div class="quiz-field">
        <label>Sexo</label>
        <div class="quiz-chip-row" id="q-sexo">
          <button type="button" class="quiz-chip ${answers.sexo === "hombre" ? "active" : ""}" data-v="hombre">Hombre</button>
          <button type="button" class="quiz-chip ${answers.sexo === "mujer" ? "active" : ""}" data-v="mujer">Mujer</button>
        </div>
      </div>
      <button class="btn primary block" id="q-next" style="margin-top:8px;">Siguiente →</button>
    `;
  }

  function chipStepHtml(title, sub, options, current, isLast) {
    return `
      <h2>${title}</h2>
      <p class="muted" style="margin-bottom:18px;">${sub}</p>
      <div class="quiz-option-list" id="q-options">
        ${options.map(([id, label, desc]) => `
          <button type="button" class="quiz-option ${current === id ? "active" : ""}" data-v="${id}">
            <span class="qo-label">${label}</span>
            <span class="qo-desc">${desc}</span>
          </button>
        `).join("")}
      </div>
      <div class="row" style="gap:10px;margin-top:8px;">
        <button class="btn ghost" id="q-back">← Atrás</button>
        <button class="btn primary block" id="q-next">${isLast ? "Generar mi plan Toji →" : "Siguiente →"}</button>
      </div>
    `;
  }

  function wireStep() {
    const el = document.getElementById("quiz-step");
    if (STEPS[step] === "datos") {
      el.querySelectorAll("#q-sexo button").forEach(b => {
        b.addEventListener("click", () => {
          answers.sexo = b.dataset.v;
          el.querySelectorAll("#q-sexo button").forEach(x => x.classList.toggle("active", x === b));
        });
      });
      el.querySelector("#q-next").addEventListener("click", () => {
        answers.edad = Number(el.querySelector("#q-edad").value) || answers.edad;
        answers.altura_cm = Number(el.querySelector("#q-altura").value) || answers.altura_cm;
        answers.peso_kg = Number(el.querySelector("#q-peso").value) || answers.peso_kg;
        goStep(1);
      });
    } else {
      const key = STEPS[step] === "actividad" ? "nivel_actividad" : "experiencia";
      el.querySelectorAll(".quiz-option").forEach(b => {
        b.addEventListener("click", () => {
          answers[key] = b.dataset.v;
          el.querySelectorAll(".quiz-option").forEach(x => x.classList.toggle("active", x === b));
        });
      });
      el.querySelector("#q-back").addEventListener("click", () => goStep(-1));
      el.querySelector("#q-next").addEventListener("click", () => {
        if (STEPS[step] === "experiencia") {
          Store.completeOnboarding(answers);
          if (onDone) onDone();
        } else {
          goStep(1);
        }
      });
    }
  }

  return { render };
})();
