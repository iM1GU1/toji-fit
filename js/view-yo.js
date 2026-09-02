/* view-yo.js — progreso: peso, hábitos semanales y consejos del motor de reglas */

const ViewYo = (() => {
  const DAY_KEYS = [["lun","L"],["mar","M"],["mie","X"],["jue","J"],["vie","V"],["sab","S"],["dom","D"]];
  const HABITS = [["pesarse","Pesarme esta semana"],["compra","Hacer la compra"],["mealprep","Meal prep / cocinar por lotes"]];

  function root() { return document.getElementById("view-yo"); }

  function render() {
    const el = root();
    const tips = Engine.homeTips(Store);
    const weightLog = Store.getWeightLog();
    const todo = Store.getTodoWeek();
    const history = Store.getHistory();

    el.innerHTML = `
      <h2 style="margin-bottom:14px;">Tu progreso</h2>

      ${tips.map(t => `<div class="callout ${t.tipo === "bien" ? "" : "accent"}">${t.texto}</div>`).join("")}

      <div class="card">
        <h3 style="margin-bottom:10px;">Peso corporal</h3>
        <div class="weight-log">
          <input type="number" step="0.1" id="weight-input" placeholder="kg de hoy">
          <button class="btn primary small" id="btn-add-weight">Registrar</button>
        </div>
        ${weightLog.length ? renderWeightChart(weightLog) : `<p class="muted" style="font-size:0.85rem;">Sin registros todavía. Pésate en ayunas, una vez por semana.</p>`}
      </div>

      <div class="card">
        <h3 style="margin-bottom:10px;">Esta semana</h3>
        <div class="todo-grid">
          ${DAY_KEYS.map(([k, l]) => `
            <div class="d">
              <div class="lbl">${l}</div>
              <button data-day="${k}" class="${todo.days[k] ? "done" : ""}">${todo.days[k] ? "✓" : ""}</button>
            </div>`).join("")}
        </div>
        <p class="muted" style="font-size:0.78rem;margin-bottom:10px;">Marca los días que entrenas.</p>
        <div class="stack">
          ${HABITS.map(([k, l]) => `
            <label class="row" style="gap:10px;">
              <input type="checkbox" data-habit="${k}" ${todo.habits[k] ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--accent);">
              <span>${l}</span>
            </label>`).join("")}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:10px;">Historial de entrenamientos</h3>
        ${history.length ? `<p class="muted" style="font-size:0.85rem;">${history.length} entrenamientos registrados en total.</p>` : `<p class="muted" style="font-size:0.85rem;">Todavía ninguno — empieza en la pestaña Entrenar.</p>`}
      </div>
    `;

    el.querySelector("#btn-add-weight").addEventListener("click", () => {
      const v = el.querySelector("#weight-input").value;
      if (v && Number(v) > 0) { Store.addWeight(v); App.toast("Peso registrado"); render(); }
    });
    el.querySelectorAll("[data-day]").forEach(b => b.addEventListener("click", () => { Store.toggleTodoDay(b.dataset.day); render(); }));
    el.querySelectorAll("[data-habit]").forEach(c => c.addEventListener("change", () => { Store.toggleTodoHabit(c.dataset.habit); render(); }));
  }

  function renderWeightChart(log) {
    const last = log.slice(-10);
    const vals = last.map(w => w.kg);
    const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
    const w = 280, h = 70, pad = 6;
    const pts = last.map((p, i) => {
      const x = pad + (i / Math.max(1, last.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.kg - min) / (max - min || 1)) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const current = last[last.length - 1].kg;
    const first = last[0].kg;
    const diff = Math.round((current - first) * 10) / 10;
    return `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:70px;display:block;margin:8px 0 4px;">
        <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <p class="muted" style="font-size:0.8rem;">Último: <strong style="color:var(--text);">${current} kg</strong> · ${diff <= 0 ? diff : "+" + diff} kg desde el ${new Date(last[0].date).toLocaleDateString("es-ES")}</p>
    `;
  }

  return { render };
})();
