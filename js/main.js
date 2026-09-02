/* main.js — arranque de la app, navegación entre pestañas, racha y panel de ajustes */

const App = (() => {
  let currentView = "rutina";
  let navReady = false;
  const VIEWS = {
    rutina: ViewRutina, entrenar: ViewEntrenar, comer: ViewComer, guias: ViewGuias, amigos: ViewAmigos, yo: ViewYo
  };
  const VIEW_ORDER = ["rutina", "entrenar", "comer", "guias", "amigos", "yo"];

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function updateStreakPill() {
    if (!Store.state) return;
    const s = Engine.computeStreak(Store.getDayLog());
    document.getElementById("streak-n").textContent = s.current;
  }

  function goTo(viewName, params) {
    currentView = viewName;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-" + viewName).classList.add("active");
    document.querySelectorAll("nav.bottom button").forEach(b => b.classList.toggle("active", b.dataset.view === viewName));
    document.getElementById("bottom-nav").style.setProperty("--nav-i", VIEW_ORDER.indexOf(viewName));
    if (viewName === "guias" && params && params.exerciseId) ViewGuias.openExercise(params.exerciseId);
    else VIEWS[viewName].render();
    updateStreakPill();
    document.getElementById("main").scrollTo({ top: 0 });
  }

  function initNav() {
    if (navReady) return;
    navReady = true;
    document.querySelectorAll("nav.bottom button").forEach(b => {
      b.addEventListener("click", () => goTo(b.dataset.view));
    });
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
        <p class="muted" style="font-size:0.82rem;margin-bottom:16px;">Sesión: ${Auth.user ? Auth.user.email : ""}</p>
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
        <button class="btn ghost block" id="s-logout">Cerrar sesión</button>
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
    panel.querySelector("#s-logout").addEventListener("click", () => {
      Store.clearRemote();
      Auth.logout();
      panel.remove();
    });
  }

  async function onAuthed(user) {
    await Store.initRemote(user.uid);
    Store.ensurePublicProfile(user.uid, user.email);
    initNav();
    document.getElementById("app").classList.add("ready");
    goTo("rutina");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  function onSignedOut() {
    document.getElementById("app").classList.remove("ready");
    currentView = "rutina";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await Store.loadData();
    Auth.init(onAuthed, onSignedOut);
  });

  return { goTo, toast, updateStreakPill };
})();
