/* engine.js — la "IA" de la app: lógica de reglas para calorías/macros,
   recomendaciones de ajuste y mensajes contextuales. Todo corre en el navegador,
   sin llamadas a ningún servicio externo. */

const Engine = (() => {

  function bmr(profile) {
    // Mifflin-St Jeor
    const { peso_kg, altura_cm, edad, sexo } = profile;
    const base = 10 * peso_kg + 6.25 * altura_cm - 5 * edad;
    return sexo === "mujer" ? base - 161 : base + 5;
  }

  function tdee(profile) {
    // 1.55 = moderadamente activo: entrena fuerza 5-6 días/semana + cardio
    return bmr(profile) * 1.55;
  }

  function calcTargets(profile, nutrition) {
    const gasto = tdee(profile);
    const deficit = (nutrition.objetivo && nutrition.objetivo.deficit_kcal_dia) || 600;
    const kcal = Math.max(1500, Math.round(gasto - deficit));
    const pct = nutrition.reparto_macros_pct || { proteina: 0.32, grasa: 0.25, carbohidrato: 0.43 };
    const proteina_g = Math.round((kcal * pct.proteina) / 4);
    const grasa_g = Math.round((kcal * pct.grasa) / 9);
    const carbohidrato_g = Math.round((kcal * pct.carbohidrato) / 4);
    return { gasto: Math.round(gasto), kcal, proteina_g, grasa_g, carbohidrato_g };
  }

  function mealTargets(profile, nutrition) {
    const t = calcTargets(profile, nutrition);
    return nutrition.distribucion_comidas.map(m => ({
      id: m.id, nombre: m.nombre, pct: m.pct,
      kcal: Math.round(t.kcal * m.pct)
    }));
  }

  // Racha: días consecutivos marcados como cumplidos, terminando hoy o ayer
  // (si hoy aún no se ha marcado, no rompe la racha hasta que acabe el día).
  function computeStreak(dayLog) {
    // Fecha local YYYY-MM-DD sin pasar por toISOString (evita el desplazamiento de
    // día que provoca en zonas con offset UTC positivo, p.ej. España).
    const fmt = d => {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const toDate = s => new Date(s + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = fmt(today);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    let current = 0;
    let cursor = dayLog[todayStr] ? today : yesterday;
    while (dayLog[fmt(cursor)]) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const dates = Object.keys(dayLog).filter(d => dayLog[d]).sort();
    let best = 0, run = 0, prev = null;
    dates.forEach(d => {
      if (prev) {
        const diff = (toDate(d) - toDate(prev)) / 86400000;
        run = diff === 1 ? run + 1 : 1;
      } else run = 1;
      best = Math.max(best, run);
      prev = d;
    });
    best = Math.max(best, current);

    return { current, best, doneToday: !!dayLog[todayStr] };
  }

  function bmi(profile) {
    const h = profile.altura_cm / 100;
    return Math.round((profile.peso_kg / (h * h)) * 10) / 10;
  }

  // Sugerencia de ajuste de calorías según la tendencia real de peso (últimas entradas)
  function weightTrendAdvice(weightLog) {
    if (!weightLog || weightLog.length < 2) {
      return { status: "sin_datos", mensaje: "Registra tu peso una vez por semana durante 3-4 semanas para que pueda darte un consejo real de ajuste." };
    }
    const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const cutoff = new Date(last.date); cutoff.setDate(cutoff.getDate() - 28);
    const recent = sorted.filter(w => new Date(w.date) >= cutoff);
    if (recent.length < 2) {
      return { status: "pocos_datos", mensaje: "Aún no hay suficientes semanas de datos recientes. Sigue pesándote cada semana." };
    }
    const first = recent[0];
    const weeks = Math.max(1, (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 7));
    const deltaKg = last.kg - first.kg;
    const perWeek = deltaKg / weeks;
    if (perWeek > -0.15) {
      return { status: "estancado", perWeek, mensaje: `En las últimas ${weeks.toFixed(1)} semanas apenas has perdido peso (${perWeek.toFixed(2)} kg/semana). Baja unas 150-200 kcal/día, por ejemplo reduciendo el carbohidrato de la cena.` };
    }
    if (perWeek < -0.9) {
      return { status: "muy_rapido", perWeek, mensaje: `Estás perdiendo peso muy rápido (${Math.abs(perWeek).toFixed(2)} kg/semana). Con tu punto de partida, a ese ritmo es fácil perder músculo junto con la grasa — sube unas 150-200 kcal/día.` };
    }
    return { status: "bien", perWeek, mensaje: `Ritmo saludable: ${Math.abs(perWeek).toFixed(2)} kg/semana. Sigue igual, no hace falta tocar nada.` };
  }

  function homeTips(store) {
    const tips = [];
    const state = store.state;
    const history = store.getHistory();
    const lastWorkout = history[0];
    if (!lastWorkout) {
      tips.push({ tipo: "info", texto: "Aún no has registrado ningún entrenamiento. Empieza por la sección Entrenar cuando toque tu día de rutina." });
    } else {
      const daysSince = Math.floor((Date.now() - lastWorkout.finishedAt) / (1000 * 60 * 60 * 24));
      if (daysSince >= 3) {
        tips.push({ tipo: "aviso", texto: `Han pasado ${daysSince} días desde tu último entrenamiento registrado. La constancia es lo que más pesa para llegar al físico que buscas — retómalo cuando puedas.` });
      }
    }
    const wt = weightTrendAdvice(store.getWeightLog());
    if (wt.status !== "sin_datos") tips.push({ tipo: wt.status === "bien" ? "bien" : "aviso", texto: wt.mensaje });
    const todo = store.getTodoWeek();
    const pesadoEstaSemana = !!todo.habits.pesarse;
    if (!pesadoEstaSemana) tips.push({ tipo: "info", texto: "No te has pesado esta semana todavía. Hazlo en ayunas, un día fijo, y márcalo en la sección Yo." });
    return tips;
  }

  // ---------- XP y niveles ----------
  // XP por serie: peso(kg) × reps. Sin peso externo (peso corporal), reps×3 como base.
  // Un PR paga el doble. Curva de nivel exponencial: cada nivel cuesta más que el anterior.
  function xpForSet(peso, reps, isPR) {
    peso = Number(peso) || 0;
    reps = Math.max(0, Math.round(Number(reps) || 0));
    if (reps <= 0) return 0;
    const raw = peso > 0 ? peso * reps : reps * 3;
    return Math.max(1, Math.round(raw * (isPR ? 2 : 1)));
  }

  function xpForLevel(level) {
    if (level <= 1) return 0;
    return Math.round(60 * Math.pow(level - 1, 2.05));
  }

  function levelFromXp(totalXp) {
    totalXp = Math.max(0, Number(totalXp) || 0);
    let level = 1;
    while (xpForLevel(level + 1) <= totalXp) level++;
    const curFloor = xpForLevel(level);
    const nextFloor = xpForLevel(level + 1);
    const span = Math.max(1, nextFloor - curFloor);
    const into = totalXp - curFloor;
    return { level, xpInto: into, xpSpan: span, pct: Math.min(1, into / span), xpToNext: Math.max(0, nextFloor - totalXp), totalXp };
  }

  // ---------- rango de hechicero (título de nivel, solo texto de ambientación) ----------
  function rankTitle(level) {
    if (level >= 26) return "Grado especial";
    if (level >= 19) return "Hechicero grado 1";
    if (level >= 13) return "Hechicero grado 2";
    if (level >= 8) return "Hechicero grado 3";
    if (level >= 4) return "Hechicero grado 4";
    return "Aprendiz";
  }

  // ---------- prescripción de peso/reps (plan personalizado, sin que el usuario teclee nada) ----------
  // Incremento práctico por tipo de equipo al redondear el peso calculado.
  const EQUIP_ROUND = {
    mancuernas: 1, barra: 2.5, maquina: 5, polea: 2.5, banda: 0, banco: 0,
    peso_corporal: 0, barra_dominadas: 0, paralelas: 0, cinta: 0, bici: 0
  };

  function roundToIncrement(kg, inc) {
    if (!inc) return 0;
    return Math.max(inc, Math.round(kg / inc) * inc);
  }
  function experienceMult(exp) {
    return exp === "avanzado" ? 1.3 : exp === "principiante" ? 0.75 : 1.0;
  }
  function activityMult(niv) {
    return niv === "alto" ? 1.08 : niv === "moderado" ? 1.0 : niv === "ligero" ? 0.95 : 0.9;
  }
  function sexoMult(sexo) { return sexo === "mujer" ? 0.7 : 1.0; }

  // Peso de partida estimado para un ejercicio, a partir del perfil (peso corporal,
  // experiencia, nivel de actividad, sexo) y el coeficiente propio del ejercicio.
  // Es un punto de partida razonable, no una prescripción médica — se ajusta solo con
  // el progreso real (ver Store.finishWorkout: sube un incremento cada vez que completas
  // todas las series de un ejercicio).
  function baselineWeight(exercise, profile) {
    if (!exercise || !exercise.coef) return 0;
    profile = profile || {};
    const raw = exercise.coef * (profile.peso_kg || 70) *
      experienceMult(profile.experiencia) * activityMult(profile.nivel_actividad) * sexoMult(profile.sexo);
    const equip = (exercise.equipo && exercise.equipo[0]) || "mancuernas";
    const inc = EQUIP_ROUND[equip] !== undefined ? EQUIP_ROUND[equip] : 1;
    return roundToIncrement(raw, inc);
  }

  return {
    bmr, tdee, calcTargets, mealTargets, bmi, weightTrendAdvice, homeTips, computeStreak,
    xpForSet, xpForLevel, levelFromXp, rankTitle, baselineWeight, EQUIP_ROUND
  };
})();
