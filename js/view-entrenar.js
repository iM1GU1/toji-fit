/* view-entrenar.js — modo "entrenar ahora": registrar series, temporizador de descanso
   con vibración/sonido/notificación, y bloqueo de pantalla activa mientras entrenas. */

const ViewEntrenar = (() => {
  let wakeLock = null;
  let timerInterval = null;
  let timerEnd = null; // timestamp ms
  let timerTotal = 90;
  let notifAsked = false;

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
    if (Notification && Notification.permission === "granted" && document.hidden) {
      try { new Notification("Descanso terminado", { body: "Toca para volver a la app y la siguiente serie.", tag: "toji-rest" }); }
      catch (e) {}
    }
  }

  async function requestWakeLock() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); }
    catch (e) { /* algunos navegadores lo deniegan si la pestaña no está visible, no pasa nada */ }
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

  function startTimer(seconds) {
    stopTimer();
    timerTotal = seconds;
    timerEnd = Date.now() + seconds * 1000;
    tick();
    timerInterval = setInterval(tick, 250);
  }
  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null; timerEnd = null;
    renderTimerDisplay(0, false);
  }
  function tick() {
    const remainingMs = timerEnd - Date.now();
    if (remainingMs <= 0) {
      stopTimer();
      beep();
      vibrate([200, 100, 200, 100, 300]);
      notifyRestOver();
      App.toast("¡Descanso terminado! Siguiente serie 💪");
      return;
    }
    renderTimerDisplay(Math.ceil(remainingMs / 1000), true);
  }
  function renderTimerDisplay(secs, running) {
    const t = document.getElementById("timer-text");
    const wrap = document.getElementById("timer-wrap");
    if (!t || !wrap) return;
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    t.textContent = running ? `${m}:${s}` : "Listo";
    wrap.classList.toggle("running", running);
  }

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
      <p class="muted" style="margin-bottom:14px;">Elige el día de tu rutina que toca hoy. El temporizador de descanso vibra y avisa entre series.</p>
      <div class="stack" id="picker-days">
        ${days.map(d => `<button class="btn block" data-day="${d.id}" style="justify-content:space-between;text-align:left;">
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

      <div id="timer-wrap" class="card" style="text-align:center;">
        <div class="timer-ring"><span class="t" id="timer-text">Listo</span></div>
        <div class="row" style="justify-content:center;gap:8px;">
          <button class="btn small" id="t-60">60s</button>
          <button class="btn small" id="t-90">90s</button>
          <button class="btn small" id="t-120">120s</button>
          <button class="btn small ghost" id="t-stop">Parar</button>
        </div>
      </div>

      <div id="entries"></div>

      <button class="btn primary block" id="btn-finish" style="margin-top:6px;">Terminar entrenamiento ✓</button>
    `;

    el.querySelector("#btn-discard").addEventListener("click", () => {
      if (confirm("¿Descartar este entrenamiento sin guardar?")) {
        Store.discardWorkout(); stopTimer(); releaseWakeLock(); render();
      }
    });
    el.querySelector("#btn-finish").addEventListener("click", () => {
      Store.finishWorkout(); stopTimer(); releaseWakeLock();
      App.toast("Entrenamiento guardado 🔥");
      render();
    });
    ["60", "90", "120"].forEach(s => el.querySelector(`#t-${s}`).addEventListener("click", () => startTimer(Number(s))));
    el.querySelector("#t-stop").addEventListener("click", stopTimer);

    const entriesEl = el.querySelector("#entries");
    entriesEl.innerHTML = w.entries.map((entry, ei) => `
      <div class="card">
        <div class="card-head">
          <h3>${entry.nombre}</h3>
          <span class="mono muted" style="font-size:0.8rem;">objetivo ${entry.target_series}×${entry.target_reps}</span>
        </div>
        <div class="set-rows" data-entry="${ei}">
          ${entry.sets.map((s, si) => setRowHtml(s, si)).join("")}
        </div>
        <button class="btn small ghost btn-add-set" data-entry="${ei}" style="margin-top:8px;">+ Añadir serie</button>
      </div>
    `).join("");

    entriesEl.querySelectorAll(".btn-add-set").forEach(b => {
      b.addEventListener("click", () => { Store.addSet(Number(b.dataset.entry)); render(); });
    });

    w.entries.forEach((entry, ei) => {
      entry.sets.forEach((s, si) => {
        const rowEl = entriesEl.querySelector(`[data-entry="${ei}"] [data-set="${si}"]`);
        const repsInput = rowEl.querySelector(".in-reps");
        const pesoInput = rowEl.querySelector(".in-peso");
        const checkBtn = rowEl.querySelector(".set-check");
        repsInput.addEventListener("change", () => Store.updateSet(ei, si, { reps: repsInput.value }));
        pesoInput.addEventListener("change", () => Store.updateSet(ei, si, { peso: pesoInput.value }));
        checkBtn.addEventListener("click", () => {
          const nowDone = !s.done;
          Store.updateSet(ei, si, { done: nowDone });
          checkBtn.classList.toggle("done", nowDone);
          checkBtn.textContent = nowDone ? "✓" : "";
          if (nowDone) startTimer(Store.getSettings().restTimerDefault || 90);
        });
      });
    });
  }

  function setRowHtml(s, si) {
    return `
      <div class="set-row" data-set="${si}">
        <span class="set-idx">${si + 1}</span>
        <input class="in-reps" type="text" inputmode="numeric" placeholder="reps" value="${s.reps}">
        <input class="in-peso" type="text" inputmode="decimal" placeholder="kg" value="${s.peso}">
        <button class="set-check ${s.done ? "done" : ""}">${s.done ? "✓" : ""}</button>
      </div>`;
  }

  return { render };
})();
