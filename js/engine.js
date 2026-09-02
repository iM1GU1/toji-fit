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

  return { bmr, tdee, calcTargets, mealTargets, bmi, weightTrendAdvice, homeTips };
})();
