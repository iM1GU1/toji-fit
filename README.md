# Plan Toji

App web personal de entrenamiento y nutrición para entrenar en casa (cinta, banco, mancuernas) con el objetivo de físico tipo Toji Fushiguro. Funciona como PWA instalable en Android.

## Aviso de privacidad — léelo

Este repositorio es **público** (GitHub Pages gratuito no permite publicar desde repos privados). Eso significa que **el código de la app** es visible para cualquiera. Sin embargo:

- Tus datos reales — peso, entrenamientos registrados, lista de la compra, etc. — **nunca se suben a este repositorio ni a ningún servidor**. Viven solo en el `localStorage` de tu navegador/móvil.
- La web tiene un candado simple (contraseña) para que quien tenga el link no vea tus datos a la primera. **Esto no es seguridad real**: el código que valida la contraseña es público, así que alguien con conocimientos técnicos podría saltárselo. Sirve como disuasorio, no como protección real.
- No compartas el link de la web públicamente si no quieres que nadie lo intente abrir.

## Cómo usarla

1. Abre la URL de GitHub Pages en tu móvil (Android recomendado, para vibración y notificaciones).
2. La primera vez, crea tu contraseña de acceso.
3. En el navegador, usa "Añadir a pantalla de inicio" para instalarla como app (icono propio, pantalla completa, funciona offline).
4. Activa las notificaciones cuando te lo pida, para que el temporizador de descanso te avise aunque tengas la pantalla apagada un momento.

## Qué incluye

- **Rutina**: los 6 días del plan Toji, con sustitución de ejercicios (sugerencias inteligentes por grupo muscular y equipo disponible) y edición de series/repeticiones.
- **Entrenar**: modo entrenamiento en vivo — registra reps/kg por serie, temporizador de descanso con sonido + vibración + notificación, y mantiene la pantalla encendida mientras entrenas.
- **Guías**: ficha de cada ejercicio con instrucciones paso a paso y errores comunes, adaptadas de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (base de datos abierta de ejercicios).
- **Comer → Nutrición**: calorías y macros calculados a partir de tu edad/altura/peso (fórmula Mifflin-St Jeor), repartidos en 3 comidas sin desayuno.
- **Comer → Recetas**: recetas guiadas paso a paso para cada comida.
- **Comer → Compra**: lista de la compra generada automáticamente a partir del plan de comidas de la semana.
- **Yo**: registro de peso con gráfica, checklist semanal de hábitos, y consejos automáticos (motor de reglas: si llevas días sin entrenar, si el peso está estancado, etc.).

## Cambiar tu contraseña

Ajustes (icono de engranaje, arriba a la derecha) → "Cambiar contraseña de acceso".

## Actualizar el contenido

Todo el contenido (ejercicios, rutina, recetas, objetivos de nutrición) vive en archivos JSON dentro de `data/`. Puedes editarlos directamente en GitHub o pedirle a Claude que lo actualice.

## Desarrollo local

No hay build ni dependencias. Sirve la carpeta con cualquier servidor estático, por ejemplo:

```
python3 -m http.server 8080
```

y abre `http://localhost:8080`.
