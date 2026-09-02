/* view-rutina.js — vista de la rutina semanal, con sustitución y edición de ejercicios */

const ViewRutina = (() => {
  let selectedDay = "d1";
  let openSubFor = null; // idx del ejercicio con el panel de sustitución abierto
  let editingIdx = null;

  function root() { return document.getElementById("view-rutina"); }

  function render() {
    const days = Store.data.routine.dias;
    const day = Store.getResolvedDay(selectedDay);
    const el = root();
    el.innerHTML = `
      <div class="callout accent">
        <strong>Objetivo:</strong> ${Store.data.routine.meta.objetivo}
      </div>
      <div class="day-picker">
        ${days.map(d => `<button data-day="${d.id}" class="${d.id === selectedDay ? "active" : ""}">${d.nombre.replace("Día ", "D")}</button>`).join("")}
      </div>
      <h2 style="margin-bottom:2px;">${day.nombre}</h2>
      <p class="muted" style="margin-bottom:14px;">${day.foco}</p>
      <div id="rutina-list"></div>
      <button class="btn primary block" id="btn-start-workout" style="margin-top:6px;">Empezar a entrenar este día →</button>
    `;
    renderList(day);

    el.querySelectorAll(".day-picker button").forEach(b => {
      b.addEventListener("click", () => { selectedDay = b.dataset.day; openSubFor = null; editingIdx = null; render(); });
    });
    el.querySelector("#btn-start-workout").addEventListener("click", () => {
      Store.startWorkout(selectedDay);
      App.goTo("entrenar");
    });
  }

  function renderList(day) {
    const list = document.getElementById("rutina-list");
    list.innerHTML = day.ejercicios.map(ex => rowHtml(ex)).join("");

    day.ejercicios.forEach(ex => {
      const rowEl = list.querySelector(`[data-row="${ex.idx}"]`);
      rowEl.querySelector(".btn-guide").addEventListener("click", () => {
        App.goTo("guias", { exerciseId: ex.exercise_id });
      });
      rowEl.querySelector(".btn-sub").addEventListener("click", () => {
        openSubFor = openSubFor === ex.idx ? null : ex.idx;
        editingIdx = null;
        renderList(day);
      });
      rowEl.querySelector(".btn-edit").addEventListener("click", () => {
        editingIdx = editingIdx === ex.idx ? null : ex.idx;
        openSubFor = null;
        renderList(day);
      });
      if (ex.isSubstituted) {
        rowEl.querySelector(".btn-revert-sub").addEventListener("click", () => {
          Store.revertSubstitute(selectedDay, ex.idx);
          renderList(Store.getResolvedDay(selectedDay));
        });
      }
      if (openSubFor === ex.idx) {
        const subs = Store.suggestSubstitutes(selectedDay, ex.idx);
        const subListEl = rowEl.querySelector(".sub-list");
        subListEl.innerHTML = subs.length
          ? subs.map(s => `
            <div class="sub-opt">
              <span>${s.exercise.nombre} ${s.equipoDisponible ? "" : "<span class=\"tag\" style=\"margin-left:4px;\">requiere equipo extra</span>"}</span>
              <button data-id="${s.exercise.id}">Usar</button>
            </div>`).join("")
          : `<p class="muted" style="margin:0;">No hay alternativas guardadas para este grupo muscular todavía.</p>`;
        subListEl.querySelectorAll("button[data-id]").forEach(btn => {
          btn.addEventListener("click", () => {
            Store.substitute(selectedDay, ex.idx, btn.dataset.id);
            openSubFor = null;
            renderList(Store.getResolvedDay(selectedDay));
            App.toast("Ejercicio sustituido");
          });
        });
      }
      if (editingIdx === ex.idx) {
        const editEl = rowEl.querySelector(".edit-panel");
        editEl.querySelector(".btn-save-edit").addEventListener("click", () => {
          const series = editEl.querySelector(".in-series").value.trim();
          const reps = editEl.querySelector(".in-reps").value.trim();
          Store.updateExerciseFields(selectedDay, ex.idx, {
            series: series === "" ? ex.series : (isNaN(Number(series)) ? series : Number(series)),
            reps: reps === "" ? ex.reps : reps
          });
          editingIdx = null;
          renderList(Store.getResolvedDay(selectedDay));
          App.toast("Series/reps actualizadas");
        });
      }
      if (ex.isEdited) {
        const revertEditBtn = rowEl.querySelector(".btn-revert-edit");
        if (revertEditBtn) revertEditBtn.addEventListener("click", () => {
          Store.revertEdits(selectedDay, ex.idx);
          renderList(Store.getResolvedDay(selectedDay));
        });
      }
    });
  }

  function rowHtml(ex) {
    const e = ex.exercise;
    return `
    <div class="ex-row" data-row="${ex.idx}">
      <div class="ex-top">
        <div>
          <div class="ex-name">${e ? e.nombre : ex.exercise_id}</div>
          <div class="row wrap" style="gap:6px;margin-top:4px;">
            ${ex.isSubstituted ? `<span class="tag accent">sustituido</span>` : ""}
            ${ex.isEdited ? `<span class="tag accent">editado</span>` : ""}
            ${e ? `<span class="tag">${e.grupo}</span>` : ""}
          </div>
          ${ex.nota ? `<div class="ex-note">${ex.nota}</div>` : ""}
        </div>
        <div class="ex-sr">${ex.series}×${ex.reps}</div>
      </div>
      <div class="ex-actions">
        <button class="btn small btn-guide">Guía</button>
        <button class="btn small btn-sub">Sustituir</button>
        <button class="btn small btn-edit">Editar</button>
        ${ex.isSubstituted ? `<button class="btn small ghost btn-revert-sub">Deshacer</button>` : ""}
        ${ex.isEdited ? `<button class="btn small ghost btn-revert-edit">Restablecer</button>` : ""}
      </div>
      <div class="sub-list" ${openSubFor === ex.idx ? "" : "hidden"}></div>
      <div class="edit-panel" ${editingIdx === ex.idx ? "" : "hidden"} style="margin-top:10px;border-top:1px dashed var(--border);padding-top:10px;">
        <div class="row" style="gap:8px;">
          <input class="in-series" type="text" placeholder="Series (ej. 4)" value="${ex.series}" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);">
          <input class="in-reps" type="text" placeholder="Reps (ej. 10-12)" value="${ex.reps}" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);">
        </div>
        <button class="btn small primary btn-save-edit" style="margin-top:8px;">Guardar</button>
      </div>
    </div>`;
  }

  return { render, get selectedDay() { return selectedDay; }, setDay(id) { selectedDay = id; } };
})();
