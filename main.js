/* view-entrenar.js — modo "entrenar ahora": el plan ya viene generado (peso/reps por
   ejercicio, calculados en el test corto), así que aquí no se teclea nada. Cada serie es
   un botón: la tocas cuando la terminas, se tacha, suma XP y arranca el descanso.
   Temporizador de descanso con play/pausa/reset y anillo animado. */

const ViewEntrenar = (() => {
  let wakeLock = null;
  let timerInterval = null;
  let timerState = "idle"; // idle | running | paused
  let timerTotal = 90;
  let timerEnd = null;
  let timerRemainingMs = 0;
  let notifAsked = false;
  let openSubEntry = null;

  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;
  const CHECK_SVG = `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5L8 14.5L16 6" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>`;
  const ICON_RESET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3.2-6.8"/><path d="M3 3.5v5.3h5.3"/></svg>`;

  function root() { return document.getElementById("view-entrenar"); }

  // ---------- audio: tono generado con Web Audio API, sin archivos externos ----------
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = i === 2 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.18);
      });
      setTimeout(() => ctx.close(), 700);
    } catch (e) { /* audio no disponible, seguimos sin sonido */ }
  }
  function vibrate(pattern) {
    if (Store.getSettings().vibrateOn && navigator.vibrate) navigator.vibrate(pattern);
  }
  function notifyRestOver() {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      try { new Notification("Descanso terminado", { body: "Toca para volver a la app y la siguiente serie.", tag: "toji-rest" }); }
      catch (e) {}
    }
  }
  async function requestWakeLock() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); }
    catch (e) {}
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Store.getActiveWorkout()) requestWakeLock();
  });
  function maybeAskNotifPermission() {
    if (notifAsked || !("Notification" in window)) return;
    notifAsked = true;
    if (Notification.permission === "default") Notification.requestPermission();
  }

  // ---------- temporizador de descanso: play / pausa / reset, anillo animado ----------
  function startTimer(seconds) {
    clearInterval(timerInterval);
    timerTotal = seconds;
    timerRemainingMs = seconds * 1000;
    timerEnd = Date.now() + timerRemainingMs;
    timerState = "running";
    timerInterval = setInterval(tick, 100);
    tick();
  }
  function pauseTimer() {
    if (timerState !== "running") return;
    timerRemainingMs = Math.max(0, timerEnd - Date.now());
    clearInterval(timerInterval);
    timerState = "paused";
    renderTimerUI();
  }
  function resumeTimer() {
    if (timerState !== "paused" || timerRemainingMs <= 0) return;
    timerEnd = Date.now() + timerRemainingMs;
    timerState = "running";
    timerInterval = setInterval(tick, 100);
    tick();
  }
  function resetTimer() {
    clearInterval(timerInterval);
    timerState = "idle";
    timerRemainingMs = 0;
    renderTimerUI();
  }
  function adjustTimer(deltaSeconds) {
    if (timerState === "idle") { startTimer(Math.max(5, deltaSeconds)); return; }
    timerRemainingMs = Math.max(0, timerRemainingMs + deltaSeconds * 1000);
    timerTotal = Math.max(timerTotal, Math.ceil(timerRemainingMs / 1000));
    if (timerState === "running") timerEnd = Date.now() + timerRemainingMs;
    renderTimerUI();
  }
  function tick() {
    const remainingMs = timerEnd - Date.now();
    if (remainingMs <= 0) {
      clearInterval(timerInterval);
      timerState = "idle";
      timerRemainingMs = 0;
      beep();
      vibrate([200, 100, 200, 100, 300]);
      notifyRestOver();
      App.toast("¡Descanso terminado! Siguiente serie 💪");
      renderTimerUI();
      return;
    }
    timerRemainingMs = remainingMs;
    renderTimerUI();
  }
  function renderTimerUI() {
    const textEl = document.getElementById("timer-text");
    const subEl = document.getElementById("timer-sublabel");
    const ringEl = document.getElementById("timer-progress");
    const ppBtn = document.getElementById("t-playpause");
    if (!textEl || !ringEl) return;
    const secs = Math.ceil(timerRemainingMs / 1000);
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    textEl.textContent = timerState === "idle" ? "Listo" : `${m}:${s}`;
    subEl.textContent = timerState === "running" ? "descansando…" : timerState === "paused" ? "en pausa" : "toca una serie";
    const pct = timerTotal > 0 ? Math.min(1, timerRemainingMs / (timerTotal * 1000)) : 0;
    ringEl.style.strokeDashoffset = (RING_C * (1 - (timerState === "idle" ? 0 : pct))).toFixed(1);
    document.getElementById("timer-wrap").classList.toggle("running", timerState === "running");
    document.getElementById("timer-wrap").classList.toggle("idle", timerState === "idle");
    if (ppBtn) {
      ppBtn.innerHTML = timerState === "running" ? ICON_PAUSE : ICON_PLAY;
      ppBtn.setAttribute("aria-label", timerState === "running" ? "Pausar descanso" : "Reanudar descanso");
    }
  }

  function timerHtml() {
    return `
      <div id="timer-wrap" class="timer-card idle">
        <div class="timer-ring-wrap">
          <svg viewBox="0 0 120 120" class="timer-svg">
            <circle class="timer-track" cx="60" cy="60" r="${RING_R}"></circle>
            <circle class="timer-progress" id="timer-progress" cx="60" cy="60" r="${RING_R}"
              stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${RING_C.toFixed(1)}"></circle>
          </svg>
          <div class="timer-center">
            <span class="timer-time" id="timer-text">Listo</span>
            <span class="timer-label" id="timer-sublabel">toca una serie</span>
          </div>
        </div>
        <div class="timer-presets">
          <button class="timer-chip" data-t="60">60s</button>
          <button class="timer-chip" data-t="90">90s</button>
          <button class="timer-chip" data-t="120">120s</button>
        </div>
        <div class="timer-main-controls">
          <button class="timer-btn ghost" id="t-reset" type="button" aria-label="Reiniciar">${ICON_RESET}</button>
          <button class="timer-btn primary" id="t-playpause" type="button" aria-label="Reanudar">${ICON_PLAY}</button>
          <button class="timer-btn ghost" id="t-plus15" type="button" aria-label="Añadir 15 segundos">+15s</button>
        </div>
      </div>
    `;
  }

  function wireTimer(el) {
    el.querySelectorAll(".timer-chip").forEach(b => b.addEventListener("click", () => startTimer(Number(b.dataset.t))));
    el.querySelector("#t-playpause").addEventListener("click", () => {
      if (timerState === "running") pauseTimer();
      else if (timerState === "paused") resumeTimer();
      else startTimer(Store.getSettings().restTimerDefault || 90);
    });
    el.querySelector("#t-reset").addEventListener("click", resetTimer);
    el.querySelector("#t-plus15").addEventListener("click", () => adjustTimer(15));
  }

  // ---------- render principal ----------
  function render() {
    maybeAskNotifPermission();
    const el = root();
    const w = Store.getActiveWorkout();
    if (!w) { renderPicker(el); return; }
    renderWorkout(el, w);
  }

  function renderPicker(el) {
    const days = Store.data.routine.dias;
    const history = Store.getHistory().slice(0, 5);
    el.innerHTML = `
      <h2 style="margin-bottom:12px;">Entrenar</h2>
      <p class="muted" style="margin-bottom:14px;">Tu plan ya está calculado a tu medida. Elige el día que toca — solo tendrás que tocar cada serie cuando la termines.</p>
      <div class="stack" id="picker-days">
        ${days.map(d => `<button class="btn block day-pick-btn" data-day="${d.id}">
          <span>${d.nombre}</span><span class="muted mono" style="font-size:0.8rem;">${d.foco}</span>
        </button>`).join("")}
      </div>
      <h3 style="margin:22px 0 10px;">Historial reciente</h3>
      <div id="history-list">
        ${history.length ? history.map(h => `
          <div class="card">
            <div class="row between"><strong>${h.nombre}</strong><span class="muted mono" style="font-size:0.8rem;">${new Date(h.finishedAt).toLocaleDateString("es-ES")}</span></div>
            <p class="muted" style="margin:6px 0 0;font-size:0.85rem;">${h.entries.length} ejercicios · ${h.entries.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} series completadas</p>
          </div>`).join("") : `<div class="empty"><img class="toji-art" src="icons/hero-silhouette.svg" alt="">Todavía no has terminado ningún entrenamiento.</div>`}
      </div>
    `;
    el.querySelectorAll("#picker-days button").forEach(b => {
      b.addEventListener("click", () => {
        Store.startWorkout(b.dataset.day);
        requestWakeLock();
        resetTimer();
        render();
      });
    });
  }

  function renderWorkout(el, w) {
    el.innerHTML = `
      <div class="row between" style="margin-bottom:14px;">
        <h2>${w.nombre}</h2>
        <button class="btn small ghost" id="btn-discard">Descartar</button>
      </div>
      ${timerHtml()}
      <div id="entries"></div>
      <button class="btn primary block" id="btn-finish" style="margin-top:6px;">Terminar entrenamiento ✓</button>
    `;

    el.querySelector("#btn-discard").addEventListener("click", () => {
      if (confirm("¿Descartar este entrenamiento sin guardar?")) {
        Store.discardWorkout(); resetTimer(); releaseWakeLock(); render();
      }
    });
    el.querySelector("#btn-finish").addEventListener("click", () => {
      Store.finishWorkout(); resetTimer(); releaseWakeLock();
      App.toast("Entrenamiento guardado 🔥");
      render();
    });
    wireTimer(el);
    renderTimerUI();

    renderEntries(el.querySelector("#entries"), w);
  }

  function renderEntries(entriesEl, w) {
    entriesEl.innerHTML = w.entries.map((entry, ei) => entryCardHtml(entry, ei)).join("");
    w.entries.forEach((entry, ei) => wireEntry(entriesEl, w, entry, ei));
  }

  function setLabel(entry, s) {
    if (entry.modo === "tiempo") return `${s.reps}s`;
    return s.peso > 0 ? `${s.reps} reps · ${s.peso} kg` : `${s.reps} reps`;
  }

  function entryCardHtml(entry, ei) {
    const doneCount = entry.sets.filter(s => s.done).length;
    const allDone = entry.sets.length > 0 && doneCount === entry.sets.length;
    return `
      <div class="entry-card ${allDone ? "all-done" : ""}" data-entry="${ei}">
        <div class="entry-head">
          <div>
            <h3>${entry.nombre}</h3>
            <span class="entry-progress muted mono">${doneCount}/${entry.sets.length} series</span>
          </div>
          <button class="btn small ghost btn-sub-live" data-entry="${ei}" type="button">Reemplazar</button>
        </div>
        <div class="set-rows" data-entry="${ei}">
          ${entry.sets.map((s, si) => setRowHtml(entry, s, si)).join("")}
        </div>
        <button class="btn small ghost btn-add-set" data-entry="${ei}" type="button" style="margin-top:8px;">+ Añadir serie</button>
        <div class="sub-live-panel" data-entry="${ei}" hidden></div>
      </div>
    `;
  }

  function setRowHtml(entry, s, si) {
    return `
      <button type="button" class="set-tap ${s.done ? "done" : ""}" data-set="${si}">
        <span class="set-idx">${si + 1}</span>
        <span class="set-label">${setLabel(entry, s)}</span>
        <span class="set-check-ico">${s.done ? CHECK_SVG : ""}</span>
      </button>
    `;
  }

  function wireEntry(entriesEl, w, entry, ei) {
    const cardEl = entriesEl.querySelector(`.entry-card[data-entry="${ei}"]`);
    cardEl.querySelectorAll(".set-tap").forEach(btn => {
      btn.addEventListener("click", () => onTapSet(cardEl, w, entry, ei, Number(btn.dataset.set), btn));
    });
    cardEl.querySelector(".btn-add-set").addEventListener("click", () => {
      Store.addSet(ei);
      const freshW = Store.getActiveWorkout();
      renderEntries(entriesEl, freshW);
    });
    cardEl.querySelector(".btn-sub-live").addEventListener("click", () => toggleSubPanel(entriesEl, cardEl, w, ei));
  }

  function onTapSet(cardEl, w, entry, ei, si, btn) {
    const s = entry.sets[si];
    if (s.done) return; // ya está hecha — tocar de nuevo no quita el XP ganado
    Store.updateSet(ei, si, { done: true });
    btn.classList.add("done");
    btn.querySelector(".set-check-ico").innerHTML = CHECK_SVG;

    if (!s.xpAwarded) {
      const result = Store.completeSet(entry.exercise_id, s.peso, s.reps);
      Store.updateSet(ei, si, { xpAwarded: true });
      App.floatXp(btn, result.xpAmount);
      App.updateStreakPill();
      if (result.leveledUp) {
        App.celebrate({ type: "levelup", title: `¡Nivel ${result.after.level}!`, subtitle: Engine.rankTitle(result.after.level) });
      }
      if (result.isPR) {
        App.celebrate({ type: "pr", title: "¡Nuevo PR!", subtitle: entry.nombre });
      }
    }
    startTimer(Store.getSettings().restTimerDefault || 90);

    const doneCount = entry.sets.filter(x => x.done).length;
    cardEl.querySelector(".entry-progress").textContent = `${doneCount}/${entry.sets.length} series`;
    if (doneCount === entry.sets.length) cardEl.classList.add("all-done");
  }

  function toggleSubPanel(entriesEl, cardEl, w, ei) {
    const panel = cardEl.querySelector(".sub-live-panel");
    const wasOpen = !panel.hidden;
    entriesEl.querySelectorAll(".sub-live-panel").forEach(p => { p.hidden = true; p.innerHTML = ""; });
    if (wasOpen) return;
    const subs = Store.suggestSubstitutes(w.dayId, ei);
    panel.innerHTML = subs.length
      ? subs.map(s => `
        <button type="button" class="sub-live-opt" data-id="${s.exercise.id}">
          <span>${s.exercise.nombre}</span>
          <span class="tag">${s.exercise.equipo.join(", ").replaceAll("_", " ")}</span>
        </button>`).join("")
      : `<p class="muted" style="margin:8px 0 0;font-size:0.82rem;">No hay alternativas guardadas para este grupo muscular todavía.</p>`;
    panel.hidden = false;
    panel.querySelectorAll(".sub-live-opt").forEach(b => {
      b.addEventListener("click", () => {
        Store.substituteActiveExerciseSlot(ei, b.dataset.id);
        App.toast("Ejercicio reemplazado");
        renderEntries(entriesEl, Store.getActiveWorkout());
      });
    });
  }

  return { render };
})();
