/* view-guias.js — biblioteca de guías de ejercicio (importada/adaptada de free-exercise-db) */

const ViewGuias = (() => {
  let query = "";
  let groupFilter = "todos";
  let pendingOpenId = null;

  const GROUPS = [
    ["todos", "Todos"], ["pecho", "Pecho"], ["hombro", "Hombro"], ["triceps", "Tríceps"],
    ["espalda", "Espalda"], ["biceps", "Bíceps"], ["pierna", "Pierna"], ["core", "Core"], ["cardio", "Cardio"]
  ];

  function root() { return document.getElementById("view-guias"); }

  function openExercise(id) { pendingOpenId = id; render(); }

  function render() {
    const el = root();
    el.innerHTML = `
      <h2 style="margin-bottom:12px;">Guías de ejercicio</h2>
      <input class="guide-search" id="guide-search" type="search" placeholder="Buscar ejercicio…" value="${query}">
      <div class="guide-filters" id="guide-filters">
        ${GROUPS.map(([id, label]) => `<button class="chip ${groupFilter === id ? "active" : ""}" data-g="${id}">${label}</button>`).join("")}
      </div>
      <div id="guide-list"></div>
      <p class="muted" style="margin-top:14px;font-size:0.8rem;">Ejercicios adaptados y traducidos a partir de <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (base de datos abierta de ejercicios).</p>
    `;
    el.querySelector("#guide-search").addEventListener("input", e => { query = e.target.value; renderList(); });
    el.querySelectorAll("#guide-filters .chip").forEach(c => {
      c.addEventListener("click", () => { groupFilter = c.dataset.g; render(); });
    });
    renderList();
  }

  function renderList() {
    const listEl = document.getElementById("guide-list");
    const q = query.trim().toLowerCase();
    let items = Store.data.exercises.filter(e => groupFilter === "todos" || e.grupo === groupFilter);
    if (q) items = items.filter(e => e.nombre.toLowerCase().includes(q));
    if (!items.length) { listEl.innerHTML = `<div class="empty">No hay ejercicios que coincidan.</div>`; return; }

    listEl.innerHTML = items.map(e => `
      <details class="guide-item" data-id="${e.id}" ${pendingOpenId === e.id ? "open" : ""}>
        <summary>
          <span>${e.nombre}</span>
          <span class="tag">${e.grupo}</span>
        </summary>
        <div class="gi-body">
          ${e.img ? `<img src="https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e.img}" alt="${e.nombre}" loading="lazy" onerror="this.remove()">` : ""}
          <div class="row wrap" style="gap:6px;margin-bottom:10px;">
            <span class="tag accent">${e.equipo.join(", ").replaceAll("_"," ")}</span>
            <span class="tag">nivel: ${e.nivel}</span>
            ${e.musculos_sec && e.musculos_sec.length ? `<span class="tag">también: ${e.musculos_sec.join(", ")}</span>` : ""}
          </div>
          <h4>Cómo hacerlo</h4>
          <ol>${e.instrucciones.map(i => `<li>${i}</li>`).join("")}</ol>
          ${e.errores_comunes && e.errores_comunes.length ? `<h4>Errores comunes</h4><ul>${e.errores_comunes.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
        </div>
      </details>
    `).join("");

    if (pendingOpenId) {
      const target = listEl.querySelector(`[data-id="${pendingOpenId}"]`);
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      pendingOpenId = null;
    }
  }

  return { render, openExercise };
})();
