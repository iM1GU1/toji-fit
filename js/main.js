/* main.js — arranque de la app, navegación entre pestañas y panel de ajustes */

const App = (() => {
  let currentView = "rutina";
  const VIEWS = {
    rutina: ViewRutina, entrenar: ViewEntrenar, comer: ViewComer, guias: ViewGuias, yo: ViewYo
  };

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function goTo(viewName, params) {
    currentView = viewName;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-" + viewName).classList.add("active");
    document.querySelectorAll("nav.bottom button").forEach(b => b.classList.toggle("active", b.dataset.view === viewName));
    if (viewName === "guias" && params && params.exerciseId) ViewGuias.openExercise(params.exerciseId);
    else VIEWS[viewName].render();
    document.getElementById("main").scrollTo({ top: 0 });
  }

  function initNav() {
    document.querySelectorAll("nav.bottom button").forEach(b => {
      b.addEventListener("click", () => goTo(b.dataset.view));
    });
  }

  function initSettings() {
    document.getElementById("btn-settings").addEventListener("click", openSettings);
  }

  function openSettings() {
    const profile = Store.getProfile();
    const settings = Store.getSettings();
    const panel = document.createElement("div");
    panel.className = "settings-panel";
    panel.innerHTML = `
      <div class="sheet">
        <h2>Ajustes</h2>
        <div class="field"><label>Edad</label><input type="number" id="s-edad" value="${profile.edad}"></div>
        <div class="field"><label>Altura (cm)</label><input type="number" id="s-altura" value="${profile.altura_cm}"></div>
        <div class="field"><label>Peso actual (kg)</label><input type="number" step="0.1" id="s-peso" value="${profile.peso_kg}"></div>
        <div class="field"><label>Descanso por defecto entre series (segundos)</label><input type="number" id="s-timer" value="${settings.restTimerDefault}"></div>
        <div class="field row" style="gap:10px;">
          <input type="checkbox" id="s-vibrate" ${settings.vibrateOn ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--accent);">
          <label style="margin:0;text-transform:none;">Vibrar al terminar el descanso</label>
        </div>
        <div class="field row" style="gap:10px;">
          <input type="checkbox" id="s-sound" ${settings.soundOn ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--accent);">
          <label style="margin:0;text-transform:none;">Sonido al terminar el descanso</label>
        </div>
        <button class="btn primary block" id="s-save">Guardar</button>
        <button class="btn ghost block" id="s-close" style="margin-top:8px;">Cerrar</button>
        <hr style="border:none;border-top:1px solid var(--border);margin:18px 0;">
        <p class="muted" style="font-size:0.8rem;margin-bottom:10px;">Recuerda: el candado de la web es solo un disuasorio, el código de esta app es público en GitHub.</p>
        <button class="btn ghost block" id="s-reset-pw">Cambiar contraseña de acceso</button>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener("click", e => { if (e.target === panel) panel.remove(); });
    panel.querySelector("#s-close").addEventListener("click", () => panel.remove());
    panel.querySelector("#s-save").addEventListener("click", () => {
      Store.setProfile({
        edad: Number(panel.querySelector("#s-edad").value),
        altura_cm: Number(panel.querySelector("#s-altura").value),
        peso_kg: Number(panel.querySelector("#s-peso").value)
      });
      Store.setSettings({
        restTimerDefault: Number(panel.querySelector("#s-timer").value),
        vibrateOn: panel.querySelector("#s-vibrate").checked,
        soundOn: panel.querySelector("#s-sound").checked
      });
      panel.remove();
      toast("Ajustes guardados");
      VIEWS[currentView].render();
    });
    panel.querySelector("#s-reset-pw").addEventListener("click", () => {
      if (confirm("Vas a tener que crear una contraseña nueva la próxima vez que abras la web. ¿Continuar?")) Gate.resetPassword();
    });
  }

  async function boot() {
    await Store.loadData();
    initNav();
    initSettings();
    document.getElementById("app").classList.add("ready");
    goTo("rutina");
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    Gate.init(boot);
  });

  return { goTo, toast };
})();
