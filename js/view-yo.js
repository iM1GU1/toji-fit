/* view-yo.js — racha, semana en ticks, peso y consejos. Minimalista, poco texto. */

const ViewYo = (() => {
  const DOW_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

  function root() { return document.getElementById("view-yo"); }
  function fmt(d) { return Store.localDateStr(d); }

  function weekDates() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = lunes
    const monday = new Date(today); monday.setDate(monday.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
  }

  function render() {
    const el = root();
    const dayLog = Store.getDayLog();
    const streak = Engine.computeStreak(dayLog);
    const week = weekDates();
    const todayStr = fmt(new Date());
    const tips = Engine.homeTips(Store);
    const weightLog = Store.getWeightLog();
    const xpInfo = Store.getXpInfo();

    el.innerHTML = `
      <div class="streak-hero">
        <img class="flame-big" src="icons/flame.svg" alt="">
        <div class="num">${streak.current}</div>
        <div class="lbl">${streak.current === 1 ? "día seguido" : "días seguidos"}${streak.best > streak.current ? ` · récord ${streak.best}` : ""}</div>
      </div>

      <div class="xp-card">
        <div class="xp-top">
          <span class="xp-lvl-num">Nivel ${xpInfo.level}</span>
          <span class="mono muted" style="font-size:0.78rem;">${xpInfo.xpInto}/${xpInfo.xpSpan} XP</span>
        </div>
        <div class="xp-bar-big"><div class="fill" style="width:${Math.round(xpInfo.pct * 100)}%"></div></div>
        <p class="muted" style="font-size:0.78rem;margin:8px 0 0;">Ganas XP al completar series: más peso y reps, más XP. Un PR vale el doble.</p>
      </div>

      <div class="week-ticks">
        ${week.map((d, i) => {
          const ds = fmt(d);
          const done = !!dayLog[ds];
          const isToday = ds === todayStr;
          return `<div class="d">
            <div class="lbl">${DOW_LABELS[i]}</div>
            <button class="tick ${done ? "done" : ""} ${isToday ? "today" : ""}" data-date="${ds}">${done ? "✓" : ""}</button>
          </div>`;
        }).join("")}
      </div>

      <button class="btn primary block" id="btn-mark-today" style="margin-bottom:18px;">
        ${dayLog[todayStr] ? "Hoy: cumplido ✓" : "Marcar hoy como cumplido"}
      </button>

      ${tips.map(t => `<div class="callout ${t.tipo === "bien" ? "" : "accent"}">${t.texto}</div>`).join("")}

      <div class="card">
        <div class="row between" style="margin-bottom:2px;">
          <h3>Peso</h3>
          ${weightLog.length ? `<span class="mono" style="color:var(--accent-2);">${weightLog[weightLog.length - 1].kg} kg</span>` : ""}
        </div>
        <div class="weight-log" style="margin-top:10px;">
          <input type="number" step="0.1" id="weight-input" placeholder="kg de hoy">
          <button class="btn primary small" id="btn-add-weight">+</button>
        </div>
        ${weightLog.length ? renderWeightChart(weightLog) : `<p class="muted" style="font-size:0.82rem;">Pésate en ayunas, una vez por semana.</p>`}
      </div>
    `;

    el.querySelectorAll(".week-ticks button").forEach(b => {
      b.addEventListener("click", () => {
        if (b.dataset.date !== todayStr) return; // solo se puede marcar/desmarcar el día de hoy
        Store.toggleDayDone(b.dataset.date);
        App.updateStreakPill();
        render();
      });
    });
    el.querySelector("#btn-mark-today").addEventListener("click", () => {
      Store.toggleDayDone(todayStr);
      App.updateStreakPill();
      render();
    });
    el.querySelector("#btn-add-weight").addEventListener("click", () => {
      const v = el.querySelector("#weight-input").value;
      if (v && Number(v) > 0) { Store.addWeight(v); App.toast("Peso registrado"); render(); }
    });
  }

  function renderWeightChart(log) {
    const last = log.slice(-10);
    const vals = last.map(w => w.kg);
    const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
    const w = 280, h = 60, pad = 6;
    const pts = last.map((p, i) => {
      const x = pad + (i / Math.max(1, last.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.kg - min) / (max - min || 1)) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:60px;display:block;margin-top:6px;">
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  return { render };
})();
