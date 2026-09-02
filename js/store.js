/* store.js — carga de datos + estado persistente en localStorage.
   Todo vive en el navegador del usuario. No hay backend ni se envía nada a ningún servidor. */

const Store = (() => {
  const LS_KEY = "tojifit_state_v1";
  const LS_AUTH = "tojifit_auth_v1";

  let data = { exercises: [], routine: null, recipes: [], nutrition: null };

  function defaultState(nutrition) {
    const perfil = (nutrition && nutrition.perfil_defecto) || { edad: 23, altura_cm: 165, peso_kg: 86, sexo: "hombre" };
    return {
      profile: { ...perfil },
      routineOverrides: {},      // { [dayId]: { [idx]: exercise_id } }
      workoutHistory: [],        // sesiones terminadas
      activeWorkout: null,       // sesión en curso
      weightLog: [],             // [{date, kg}]
      mealPlan: {},              // { [dow]: { [mealId]: recipeId } }
      shoppingList: { items: [], generatedFrom: null },
      todoWeek: { weekStart: null, days: {}, habits: {} },
      settings: { restTimerDefault: 90, soundOn: true, vibrateOn: true }
    };
  }

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) { console.warn("No se pudo leer el estado guardado", e); }
    if (!state) state = defaultState(data.nutrition);
    // completa campos que puedan faltar tras una actualización de la app
    const d = defaultState(data.nutrition);
    state = { ...d, ...state, profile: { ...d.profile, ...(state.profile || {}) }, settings: { ...d.settings, ...(state.settings || {}) } };
    return state;
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("No se pudo guardar el estado", e); }
  }

  async function loadData() {
    const [exercises, routine, recipes, nutrition] = await Promise.all([
      fetch("data/exercises.json").then(r => r.json()),
      fetch("data/routine.json").then(r => r.json()),
      fetch("data/recipes.json").then(r => r.json()),
      fetch("data/nutrition.json").then(r => r.json())
    ]);
    data = { exercises, routine, recipes, nutrition };
    load();
    return data;
  }

  // ---------- auth (candado simple, ver gate.js) ----------
  function getAuth() {
    try { return JSON.parse(localStorage.getItem(LS_AUTH) || "null"); }
    catch (e) { return null; }
  }
  function setAuth(obj) { localStorage.setItem(LS_AUTH, JSON.stringify(obj)); }

  // ---------- exercises ----------
  function getExercise(id) { return data.exercises.find(e => e.id === id); }
  function exercisesByGroup(grupo) { return data.exercises.filter(e => e.grupo === grupo); }

  // ---------- rutina ----------
  function getDay(dayId) { return data.routine.dias.find(d => d.id === dayId); }
  function getResolvedDay(dayId) {
    const day = getDay(dayId);
    if (!day) return null;
    const overrides = state.routineOverrides[dayId] || {};
    const ejercicios = day.ejercicios.map((ex, idx) => {
      const o = overrides[idx] || {};
      const exId = o.exercise_id || ex.exercise_id;
      return {
        idx,
        series: o.series !== undefined ? o.series : ex.series,
        reps: o.reps !== undefined ? o.reps : ex.reps,
        nota: ex.nota,
        exercise_id: exId,
        original_id: ex.exercise_id,
        isSubstituted: !!o.exercise_id,
        isEdited: o.series !== undefined || o.reps !== undefined,
        exercise: getExercise(exId)
      };
    });
    return { ...day, ejercicios };
  }
  function getAllResolvedDays() { return data.routine.dias.map(d => getResolvedDay(d.id)); }

  function suggestSubstitutes(dayId, idx) {
    const day = getDay(dayId);
    const original = day.ejercicios[idx];
    const o = (state.routineOverrides[dayId] || {})[idx] || {};
    const currentId = o.exercise_id || original.exercise_id;
    const current = getExercise(currentId);
    if (!current) return [];
    const ownedEquip = ["mancuernas", "banco", "peso_corporal", "cinta"]; // equipo base que ya tiene el usuario
    const candidates = data.exercises.filter(e => e.id !== currentId && e.grupo === current.grupo);
    // puntuar: mismo equipo que ya posee > comparte tag toji > nivel similar
    return candidates.map(e => {
      let score = 0;
      const equipoDisponible = e.equipo.every(eq => ownedEquip.includes(eq));
      if (equipoDisponible) score += 3;
      const sharedTags = e.tags_toji.filter(t => current.tags_toji.includes(t)).length;
      score += sharedTags;
      if (e.nivel === current.nivel) score += 1;
      return { exercise: e, score, equipoDisponible };
    }).sort((a, b) => b.score - a.score).slice(0, 4);
  }

  function substitute(dayId, idx, newExerciseId) {
    if (!state.routineOverrides[dayId]) state.routineOverrides[dayId] = {};
    if (!state.routineOverrides[dayId][idx]) state.routineOverrides[dayId][idx] = {};
    state.routineOverrides[dayId][idx].exercise_id = newExerciseId;
    save();
  }
  function updateExerciseFields(dayId, idx, patch) {
    if (!state.routineOverrides[dayId]) state.routineOverrides[dayId] = {};
    if (!state.routineOverrides[dayId][idx]) state.routineOverrides[dayId][idx] = {};
    Object.assign(state.routineOverrides[dayId][idx], patch);
    save();
  }
  function revertSubstitute(dayId, idx) {
    if (state.routineOverrides[dayId] && state.routineOverrides[dayId][idx]) {
      delete state.routineOverrides[dayId][idx].exercise_id;
      save();
    }
  }
  function revertEdits(dayId, idx) {
    if (state.routineOverrides[dayId]) {
      delete state.routineOverrides[dayId][idx];
      save();
    }
  }

  // ---------- perfil / nutrición (motor de cálculo, ver engine.js) ----------
  function getProfile() { return state.profile; }
  function setProfile(patch) { state.profile = { ...state.profile, ...patch }; save(); }

  // ---------- entrenamiento en vivo ----------
  function startWorkout(dayId) {
    const day = getResolvedDay(dayId);
    state.activeWorkout = {
      dayId, nombre: day.nombre, startedAt: Date.now(),
      entries: day.ejercicios.map(ex => ({
        exercise_id: ex.exercise_id, nombre: ex.exercise ? ex.exercise.nombre : ex.exercise_id,
        target_series: ex.series, target_reps: ex.reps,
        sets: Array.from({ length: (typeof ex.series === "number" ? ex.series : 3) }, () => ({ reps: "", peso: "", done: false }))
      }))
    };
    save();
    return state.activeWorkout;
  }
  function getActiveWorkout() { return state.activeWorkout; }
  function updateSet(entryIdx, setIdx, patch) {
    const w = state.activeWorkout; if (!w) return;
    Object.assign(w.entries[entryIdx].sets[setIdx], patch);
    save();
  }
  function addSet(entryIdx) {
    const w = state.activeWorkout; if (!w) return;
    w.entries[entryIdx].sets.push({ reps: "", peso: "", done: false });
    save();
  }
  function finishWorkout() {
    const w = state.activeWorkout; if (!w) return;
    w.finishedAt = Date.now();
    state.workoutHistory.unshift(w);
    state.activeWorkout = null;
    save();
  }
  function discardWorkout() { state.activeWorkout = null; save(); }
  function getHistory() { return state.workoutHistory; }

  // ---------- peso corporal ----------
  function addWeight(kg, date) {
    date = date || new Date().toISOString().slice(0, 10);
    state.weightLog = state.weightLog.filter(w => w.date !== date);
    state.weightLog.push({ date, kg: Number(kg) });
    state.weightLog.sort((a, b) => a.date.localeCompare(b.date));
    if (state.weightLog.length) state.profile.peso_kg = state.weightLog[state.weightLog.length - 1].kg;
    save();
  }
  function getWeightLog() { return state.weightLog; }

  // ---------- plan de comidas ----------
  function getRecipe(id) { return data.recipes.find(r => r.id === id); }
  function recipesFor(mealId) { return data.recipes.filter(r => r.comida === mealId); }
  function getMealPlanDay(dow) {
    if (!state.mealPlan[dow]) {
      // reparto por defecto: rota entre las recetas disponibles de cada comida
      const meals = data.nutrition.distribucion_comidas;
      const plan = {};
      meals.forEach(m => {
        const opts = recipesFor(m.id);
        plan[m.id] = opts.length ? opts[dow % opts.length].id : null;
      });
      state.mealPlan[dow] = plan;
      save();
    }
    return state.mealPlan[dow];
  }
  function setMealPlanRecipe(dow, mealId, recipeId) {
    if (!state.mealPlan[dow]) getMealPlanDay(dow);
    state.mealPlan[dow][mealId] = recipeId;
    save();
  }

  // ---------- lista de la compra ----------
  function generateShoppingList(days) {
    days = days || [0, 1, 2, 3, 4, 5, 6];
    const agg = {};
    days.forEach(dow => {
      const plan = getMealPlanDay(dow);
      Object.values(plan).forEach(recipeId => {
        const r = getRecipe(recipeId);
        if (!r) return;
        r.ingredientes.forEach(ing => {
          const key = ing.item + "|" + ing.unidad;
          if (!agg[key]) agg[key] = { item: ing.item, unidad: ing.unidad, categoria: ing.categoria, cantidad: 0 };
          agg[key].cantidad += Number(ing.cantidad) || 0;
        });
      });
    });
    const prevChecked = {};
    (state.shoppingList.items || []).forEach(it => { if (it.checked && !it.custom) prevChecked[it.item + "|" + it.unidad] = true; });
    const customItems = (state.shoppingList.items || []).filter(it => it.custom);
    const items = Object.values(agg).map(it => ({
      id: it.item + "|" + it.unidad,
      item: it.item, unidad: it.unidad, categoria: it.categoria,
      cantidad: Math.round(it.cantidad * 10) / 10,
      checked: !!prevChecked[it.item + "|" + it.unidad],
      custom: false
    }));
    state.shoppingList = { items: [...items, ...customItems], generatedFrom: days };
    save();
    return state.shoppingList;
  }
  function getShoppingList() {
    if (!state.shoppingList.items || !state.shoppingList.items.length) generateShoppingList();
    return state.shoppingList;
  }
  function toggleShoppingItem(id) {
    const it = state.shoppingList.items.find(i => i.id === id);
    if (it) { it.checked = !it.checked; save(); }
  }
  function addCustomShoppingItem(name, categoria) {
    state.shoppingList.items.push({ id: "custom_" + Date.now(), item: name, unidad: "", categoria: categoria || "despensa", checked: false, custom: true });
    save();
  }
  function clearCheckedShoppingItems() {
    state.shoppingList.items = state.shoppingList.items.filter(i => !i.checked);
    save();
  }

  // ---------- todo / hábitos semanales ----------
  function mondayOf(d) {
    const dt = new Date(d);
    const day = (dt.getDay() + 6) % 7; // 0=lunes
    dt.setDate(dt.getDate() - day);
    return dt.toISOString().slice(0, 10);
  }
  function getTodoWeek() {
    const monday = mondayOf(new Date());
    if (state.todoWeek.weekStart !== monday) {
      state.todoWeek = { weekStart: monday, days: {}, habits: {} };
      save();
    }
    return state.todoWeek;
  }
  function toggleTodoDay(key) {
    const w = getTodoWeek();
    w.days[key] = !w.days[key];
    save();
  }
  function toggleTodoHabit(key) {
    const w = getTodoWeek();
    w.habits[key] = !w.habits[key];
    save();
  }

  // ---------- settings ----------
  function getSettings() { return state.settings; }
  function setSettings(patch) { state.settings = { ...state.settings, ...patch }; save(); }

  return {
    loadData, get data() { return data; }, get state() { return state; },
    getAuth, setAuth,
    getExercise, exercisesByGroup,
    getDay, getResolvedDay, getAllResolvedDays, suggestSubstitutes, substitute, revertSubstitute, updateExerciseFields, revertEdits,
    getProfile, setProfile,
    startWorkout, getActiveWorkout, updateSet, addSet, finishWorkout, discardWorkout, getHistory,
    addWeight, getWeightLog,
    getRecipe, recipesFor, getMealPlanDay, setMealPlanRecipe,
    generateShoppingList, getShoppingList, toggleShoppingItem, addCustomShoppingItem, clearCheckedShoppingItems,
    getTodoWeek, toggleTodoDay, toggleTodoHabit,
    getSettings, setSettings,
    save
  };
})();
