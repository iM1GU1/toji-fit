/* store.js — carga de datos + estado persistente en localStorage.
   Todo vive en el navegador del usuario. No hay backend ni se envía nada a ningún servidor. */

const Store = (() => {
  let data = { exercises: [], routine: null, recipes: [], nutrition: null };

  // Fecha local en formato YYYY-MM-DD, SIN pasar por toISOString (que convierte a UTC
  // y desplaza el día en zonas horarias con offset positivo, como España). Esta es la
  // única función que debe usarse para generar o comparar claves de fecha en toda la app.
  function localDateStr(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ---------- sincronización remota (Firestore, una vez autenticado) ----------
  let remoteUid = null;
  let db = null;
  let pushTimer = null;

  function lsKey() { return remoteUid ? `tojifit_state_v1_${remoteUid}` : "tojifit_state_v1_anon"; }

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
      dayLog: {},                 // { 'YYYY-MM-DD': true } — días marcados como cumplidos (racha)
      settings: { restTimerDefault: 90, soundOn: true, vibrateOn: true }
    };
  }

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(lsKey());
      if (raw) state = JSON.parse(raw);
    } catch (e) { console.warn("No se pudo leer el estado guardado", e); }
    if (!state) state = defaultState(data.nutrition);
    // completa campos que puedan faltar tras una actualización de la app
    const d = defaultState(data.nutrition);
    state = { ...d, ...state, profile: { ...d.profile, ...(state.profile || {}) }, settings: { ...d.settings, ...(state.settings || {}) } };
    return state;
  }

  function save() {
    try { localStorage.setItem(lsKey(), JSON.stringify(state)); }
    catch (e) { console.warn("No se pudo guardar el estado", e); }
    schedulePush();
  }

  function schedulePush() {
    if (!remoteUid || !db) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      db.collection("users").doc(remoteUid).set(state).catch(e => console.warn("No se pudo sincronizar con la nube", e));
    }, 1200);
  }

  async function initRemote(uid) {
    remoteUid = uid;
    db = firebase.firestore();
    load(); // copia local primero (rápido, funciona sin conexión)
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) {
        const remote = snap.data();
        const d = defaultState(data.nutrition);
        state = {
          ...d, ...remote,
          profile: { ...d.profile, ...(remote.profile || {}) },
          settings: { ...d.settings, ...(remote.settings || {}) }
        };
        localStorage.setItem(lsKey(), JSON.stringify(state));
      } else {
        await db.collection("users").doc(uid).set(state);
      }
    } catch (e) { console.warn("Firestore no disponible ahora mismo, sigo con la copia local", e); }
    return state;
  }

  function clearRemote() {
    remoteUid = null; db = null;
    clearTimeout(pushTimer);
    state = null;
  }

  // ---------- amigos / feed (colecciones compartidas, fuera de users/{uid}) ----------
  function pairId(a, b) { return a < b ? `${a}_${b}` : `${b}_${a}`; }
  function displayNameFromEmail(email) { return (email || "").split("@")[0]; }

  async function ensurePublicProfile(uid, email) {
    if (!db) return;
    try {
      await db.collection("usersPublic").doc(uid).set({
        email: email || "", displayName: displayNameFromEmail(email), updatedAt: Date.now()
      }, { merge: true });
    } catch (e) { console.warn("No se pudo publicar el perfil público", e); }
  }

  async function searchUserByEmail(email) {
    if (!db) return null;
    email = (email || "").trim().toLowerCase();
    if (!email) return null;
    const snap = await db.collection("usersPublic").where("email", "==", email).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { uid: doc.id, ...doc.data() };
  }

  async function addFriendByEmail(email) {
    const found = await searchUserByEmail(email);
    if (!found) return { ok: false, reason: "not_found" };
    if (found.uid === remoteUid) return { ok: false, reason: "self" };
    const id = pairId(remoteUid, found.uid);
    await db.collection("friendships").doc(id).set({
      uids: [remoteUid, found.uid].sort(), createdAt: Date.now()
    });
    return { ok: true, friend: found };
  }

  async function removeFriend(otherUid) {
    if (!db || !remoteUid) return;
    await db.collection("friendships").doc(pairId(remoteUid, otherUid)).delete();
  }

  async function getFriends() {
    if (!db || !remoteUid) return [];
    const snap = await db.collection("friendships").where("uids", "array-contains", remoteUid).get();
    const otherUids = snap.docs.map(d => d.data().uids.find(u => u !== remoteUid)).filter(Boolean);
    if (!otherUids.length) return [];
    const profiles = await Promise.all(otherUids.map(uid => db.collection("usersPublic").doc(uid).get()));
    return profiles.filter(p => p.exists).map(p => ({ uid: p.id, ...p.data() }));
  }

  async function getFriendsFeed(friendUids) {
    if (!db || !friendUids || !friendUids.length) return [];
    // Firestore "in" admite hasta 10 valores — de sobra para un círculo de amigos pequeño
    const chunks = [];
    for (let i = 0; i < friendUids.length; i += 10) chunks.push(friendUids.slice(i, i + 10));
    const results = await Promise.all(chunks.map(chunk =>
      db.collection("feed").where("uid", "in", chunk).orderBy("finishedAt", "desc").limit(20).get()
    ));
    const items = results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
    items.sort((a, b) => b.finishedAt - a.finishedAt);
    return items.slice(0, 25);
  }

  function postFeedItem(entry) {
    if (!db || !remoteUid) return;
    db.collection("feed").add(entry).catch(e => console.warn("No se pudo publicar en el feed", e));
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
    state.dayLog[localDateStr()] = true;
    save();
    const setsDone = w.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
    postFeedItem({
      uid: remoteUid,
      displayName: displayNameFromEmail((typeof Auth !== "undefined" && Auth.user) ? Auth.user.email : ""),
      dayName: w.nombre,
      setsDone,
      finishedAt: w.finishedAt
    });
  }
  function discardWorkout() { state.activeWorkout = null; save(); }
  function getHistory() { return state.workoutHistory; }

  // ---------- peso corporal ----------
  function addWeight(kg, date) {
    date = date || localDateStr();
    state.weightLog = state.weightLog.filter(w => w.date !== date);
    state.weightLog.push({ date, kg: Number(kg) });
    state.weightLog.sort((a, b) => a.date.localeCompare(b.date));
    if (state.weightLog.length) state.profile.peso_kg = state.weightLog[state.weightLog.length - 1].kg;
    save();
  }
  function getWeightLog() { return state.weightLog; }

  // ---------- racha / días marcados ----------
  function toggleDayDone(date) {
    date = date || localDateStr();
    if (state.dayLog[date]) delete state.dayLog[date];
    else state.dayLog[date] = true;
    save();
  }
  function isDayDone(date) { return !!state.dayLog[date]; }
  function getDayLog() { return state.dayLog; }

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
    return localDateStr(dt);
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
    localDateStr,
    initRemote, clearRemote,
    ensurePublicProfile, searchUserByEmail, addFriendByEmail, removeFriend, getFriends, getFriendsFeed,
    getExercise, exercisesByGroup,
    getDay, getResolvedDay, getAllResolvedDays, suggestSubstitutes, substitute, revertSubstitute, updateExerciseFields, revertEdits,
    getProfile, setProfile,
    startWorkout, getActiveWorkout, updateSet, addSet, finishWorkout, discardWorkout, getHistory,
    addWeight, getWeightLog,
    toggleDayDone, isDayDone, getDayLog,
    getRecipe, recipesFor, getMealPlanDay, setMealPlanRecipe,
    generateShoppingList, getShoppingList, toggleShoppingItem, addCustomShoppingItem, clearCheckedShoppingItems,
    getTodoWeek, toggleTodoDay, toggleTodoHabit,
    getSettings, setSettings,
    save
  };
})();
