/* view-comer.js — nutrición (macros + plan de comidas), recetas guiadas y lista de la compra */

const ViewComer = (() => {
  let sub = "nutricion";
  let selectedDow = todayDow();
  let openRecipeId = null;
  let recipeFilter = "todas";
  let stepState = {}; // { recipeId: { stepIndex: true } } — no persistente, solo mientras cocinas

  function todayDow() { return (new Date().getDay() + 6) % 7; }
  const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  function root() { return document.getElementById("view-comer"); }

  function render() {
    const el = root();
    el.innerHTML = `
      <div class="subtabs">
        <button class="subtab ${sub === "nutricion" ? "active" : ""}" data-s="nutricion">Nutrición</button>
        <button class="subtab ${sub === "recetas" ? "active" : ""}" data-s="recetas">Recetas</button>
        <button class="subtab ${sub === "compra" ? "active" : ""}" data-s="compra">Compra</button>
      </div>
      <div id="comer-body"></div>
    `;
    el.querySelectorAll(".subtab").forEach(b => b.addEventListener("click", () => { sub = b.dataset.s; render(); }));
    if (sub === "nutricion") renderNutricion();
    else if (sub === "recetas") renderRecetas();
    else renderCompra();
  }

  // ---------------- NUTRICIÓN ----------------
  function renderNutricion() {
    const body = document.getElementById("comer-body");
    const profile = Store.getProfile();
    const t = Engine.calcTargets(profile, Store.data.nutrition);
    const meals = Engine.mealTargets(profile, Store.data.nutrition);
    const plan = Store.getMealPlanDay(selectedDow);
    const bmi = Engine.bmi(profile);

    body.innerHTML = `
      <div class="callout">
        <strong>${Store.data.nutrition.preferencias.nota}</strong>
      </div>
      <div class="macro-grid">
        <div class="macro-tile"><span class="v">${t.kcal}</span><span class="k">kcal/día</span></div>
        <div class="macro-tile"><span class="v">${t.proteina_g}g</span><span class="k">proteína</span></div>
        <div class="macro-tile"><span class="v">${t.carbohidrato_g}g</span><span class="k">carbos</span></div>
        <div class="macro-tile"><span class="v">${t.grasa_g}g</span><span class="k">grasa</span></div>
      </div>
      <p class="muted" style="font-size:0.82rem;margin-bottom:16px;">Mantenimiento estimado ${t.gasto} kcal · peso actual ${profile.peso_kg} kg · IMC ${bmi}. Recalculado automáticamente con el peso que registres en "Yo".</p>

      <div class="day-picker">
        ${DOW_LABELS.map((l, i) => `<button data-dow="${i}" class="${i === selectedDow ? "active" : ""}">${l}</button>`).join("")}
      </div>

      <div id="meal-blocks">
        ${meals.map(m => mealBlockHtml(m, plan[m.id])).join("")}
      </div>
    `;

    body.querySelectorAll(".day-picker button").forEach(b => {
      b.addEventListener("click", () => { selectedDow = Number(b.dataset.dow); renderNutricion(); });
    });

    meals.forEach(m => {
      const blockEl = body.querySelector(`[data-meal="${m.id}"]`);
      blockEl.querySelector(".btn-change-meal").addEventListener("click", () => {
        blockEl.querySelector(".meal-select-wrap").hidden = !blockEl.querySelector(".meal-select-wrap").hidden;
      });
      const sel = blockEl.querySelector("select");
      if (sel) sel.addEventListener("change", () => {
        Store.setMealPlanRecipe(selectedDow, m.id, sel.value);
        renderNutricion();
      });
      const viewBtn = blockEl.querySelector(".btn-view-recipe");
      if (viewBtn) viewBtn.addEventListener("click", () => {
        sub = "recetas"; openRecipeId = viewBtn.dataset.id; recipeFilter = "todas"; render();
      });
    });
  }

  function mealBlockHtml(m, recipeId) {
    const recipe = Store.getRecipe(recipeId);
    const options = Store.recipesFor(m.id);
    return `
    <div class="meal-block" data-meal="${m.id}">
      <div class="mb-head">
        <h3>${m.nombre}</h3>
        <span class="mono muted" style="font-size:0.82rem;">objetivo ~${m.kcal} kcal</span>
      </div>
      ${recipe ? `
        <div class="row between">
          <strong>${recipe.nombre}</strong>
          <span class="mono muted" style="font-size:0.8rem;">${recipe.kcal} kcal</span>
        </div>
        <div class="row wrap" style="gap:12px;margin-top:8px;">
          <button class="btn small btn-view-recipe" data-id="${recipe.id}">Ver receta</button>
          <button class="btn small ghost btn-change-meal">Cambiar</button>
        </div>
      ` : `<button class="btn small btn-change-meal">Elegir receta</button>`}
      <div class="meal-select-wrap" hidden style="margin-top:10px;">
        <select style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);">
          <option value="">— elige —</option>
          ${options.map(o => `<option value="${o.id}" ${o.id === recipeId ? "selected" : ""}>${o.nombre} (${o.kcal} kcal)</option>`).join("")}
        </select>
      </div>
    </div>`;
  }

  // ---------------- RECETAS ----------------
  function renderRecetas() {
    const body = document.getElementById("comer-body");
    const filters = [["todas", "Todas"], ["comida", "Comida"], ["merienda", "Merienda"], ["cena", "Cena"]];
    body.innerHTML = `
      <div class="guide-filters">
        ${filters.map(([id, l]) => `<button class="chip ${recipeFilter === id ? "active" : ""}" data-f="${id}">${l}</button>`).join("")}
      </div>
      <div id="recipe-list"></div>
    `;
    body.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => { recipeFilter = c.dataset.f; renderRecetas(); }));
    renderRecipeList();
  }

  function renderRecipeList() {
    const listEl = document.getElementById("recipe-list");
    const items = Store.data.recipes.filter(r => recipeFilter === "todas" || r.comida === recipeFilter);
    listEl.innerHTML = items.map(r => recipeCardHtml(r)).join("");
    items.forEach(r => {
      const cardEl = listEl.querySelector(`[data-rid="${r.id}"]`);
      cardEl.querySelector(".rc-top").addEventListener("click", () => {
        openRecipeId = openRecipeId === r.id ? null : r.id;
        renderRecipeList();
        if (openRecipeId === r.id) setTimeout(() => cardEl.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      });
      if (openRecipeId === r.id) {
        cardEl.querySelectorAll(".recipe-steps .step").forEach((stepEl, si) => {
          stepEl.addEventListener("click", () => {
            stepState[r.id] = stepState[r.id] || {};
            stepState[r.id][si] = !stepState[r.id][si];
            stepEl.classList.toggle("done", !!stepState[r.id][si]);
          });
        });
      }
    });
  }

  function recipeCardHtml(r) {
    const open = openRecipeId === r.id;
    return `
    <div class="recipe-card" data-rid="${r.id}">
      <div class="rc-top" style="cursor:pointer;">
        <div class="row between"><strong>${r.nombre}</strong><span class="tag">${r.comida}</span></div>
        <div class="rc-macros">
          <span>${r.kcal} kcal</span><span>${r.proteina_g}p</span><span>${r.carbohidrato_g}c</span><span>${r.grasa_g}g</span>
          <span>· ${r.tiempo_min} min</span>
        </div>
      </div>
      ${open ? `
        <div class="ing-list">
          <h4 style="font-size:0.76rem;text-transform:uppercase;color:var(--muted);letter-spacing:0.05em;margin:4px 0 2px;">Ingredientes (${r.raciones} ración${r.raciones > 1 ? "es" : ""})</h4>
          ${r.ingredientes.map(i => `<label><input type="checkbox">${i.cantidad} ${i.unidad} — ${i.item}</label>`).join("")}
        </div>
        <div class="recipe-steps">
          <h4 style="font-size:0.76rem;text-transform:uppercase;color:var(--muted);letter-spacing:0.05em;margin:4px 0 2px;">Pasos</h4>
          ${r.pasos.map((p, i) => `<div class="step ${stepState[r.id] && stepState[r.id][i] ? "done" : ""}"><span class="num">${i + 1}</span><span>${p}</span></div>`).join("")}
          ${r.nota_prep ? `<p class="muted" style="font-size:0.82rem;margin-top:8px;">${r.nota_prep}</p>` : ""}
        </div>
      ` : ""}
    </div>`;
  }

  // ---------------- COMPRA ----------------
  function renderCompra() {
    const body = document.getElementById("comer-body");
    const list = Store.getShoppingList();
    const byCat = {};
    list.items.forEach(it => { (byCat[it.categoria] = byCat[it.categoria] || []).push(it); });
    const catLabels = { proteina: "Proteína", carbohidrato: "Carbohidrato", verdura: "Verdura y fruta", fruta: "Fruta", lacteos: "Lácteos", despensa: "Despensa" };

    body.innerHTML = `
      <div class="row between" style="margin-bottom:12px;">
        <button class="btn small" id="btn-regen">↻ Regenerar de la semana</button>
        <button class="btn small ghost" id="btn-clear-checked">Borrar marcados</button>
      </div>
      ${Object.keys(byCat).length ? Object.keys(byCat).map(cat => `
        <div class="shop-cat">
          <h4>${catLabels[cat] || cat}</h4>
          ${byCat[cat].map(it => `
            <label class="shop-item ${it.checked ? "checked" : ""}" data-id="${it.id}">
              <input type="checkbox" ${it.checked ? "checked" : ""}>
              <span>${it.item}${it.unidad ? ` — ${it.cantidad} ${it.unidad}` : ""}</span>
            </label>`).join("")}
        </div>
      `).join("") : `<div class="empty">Lista vacía. Elige recetas en la pestaña Nutrición y pulsa Regenerar.</div>`}
      <div class="add-row">
        <input type="text" id="custom-item" placeholder="Añadir algo suelto…">
        <button class="btn primary small" id="btn-add-item">Añadir</button>
      </div>
    `;

    body.querySelector("#btn-regen").addEventListener("click", () => { Store.generateShoppingList(); renderCompra(); App.toast("Lista regenerada"); });
    body.querySelector("#btn-clear-checked").addEventListener("click", () => { Store.clearCheckedShoppingItems(); renderCompra(); });
    body.querySelectorAll(".shop-item").forEach(row => {
      row.addEventListener("click", e => { e.preventDefault(); Store.toggleShoppingItem(row.dataset.id); renderCompra(); });
    });
    body.querySelector("#btn-add-item").addEventListener("click", () => {
      const input = body.querySelector("#custom-item");
      if (input.value.trim()) { Store.addCustomShoppingItem(input.value.trim()); renderCompra(); }
    });
  }

  return { render };
})();
