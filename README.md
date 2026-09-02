# Plan Toji

App web personal de entrenamiento y nutrición para entrenar en casa (cinta, banco, mancuernas) con el objetivo de físico tipo Toji Fushiguro. Funciona como PWA instalable en Android.

## Privacidad

Este repositorio es **público** (GitHub Pages gratuito no permite publicar desde repos privados), así que **el código** de la app es visible para cualquiera. Pero el acceso real es por cuenta: cada persona inicia sesión con su email y contraseña (Firebase Authentication), y su progreso solo lo puede leer/escribir esa cuenta (reglas de Firestore). Eso sí es privacidad real, no un candado de cara.

## Cómo usarla

1. Abre la URL de GitHub Pages en el móvil (Android recomendado, para vibración y notificaciones).
2. Crea tu cuenta la primera vez (email + contraseña) — cada persona la suya.
3. Usa "Añadir a pantalla de inicio" para instalarla como app (icono propio, pantalla completa, funciona offline).
4. Activa las notificaciones cuando te lo pida, para que el temporizador de descanso avise aunque tengas la pantalla apagada un momento.

## Configurar Firebase (una sola vez)

La app necesita un proyecto Firebase gratuito para el login y guardar el progreso en la nube:

1. https://console.firebase.google.com → crear proyecto.
2. Compilación → Authentication → Sign-in method → activar **Correo electrónico/contraseña**.
3. Compilación → Firestore Database → crear base de datos (modo producción).
4. En Firestore → Reglas, pegar:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
5. Panel del proyecto → icono web `</>` → registrar app → copiar el objeto `firebaseConfig` en `js/firebase-config.js`.

## Qué incluye

- **Rutina**: los 6 días del plan Toji, con sustitución de ejercicios (sugerencias inteligentes por grupo muscular y equipo disponible) y edición de series/repeticiones.
- **Entrenar**: modo entrenamiento en vivo — registra reps/kg por serie, temporizador de descanso con sonido + vibración + notificación, y mantiene la pantalla encendida mientras entrenas.
- **Guías**: ficha de cada ejercicio con instrucciones paso a paso y errores comunes, adaptadas de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (base de datos abierta de ejercicios).
- **Comer → Nutrición**: calorías y macros calculados a partir de tu edad/altura/peso (fórmula Mifflin-St Jeor), repartidos en 3 comidas sin desayuno.
- **Comer → Recetas**: recetas guiadas paso a paso para cada comida.
- **Comer → Compra**: lista de la compra generada automáticamente a partir del plan de comidas de la semana.
- **Yo**: registro de peso con gráfica, checklist semanal de hábitos, y consejos automáticos (motor de reglas: si llevas días sin entrenar, si el peso está estancado, etc.).

## Cambiar tu contraseña

Pantalla de acceso → "¿Has olvidado tu contraseña?" (te llega un email de Firebase para restablecerla). Cerrar sesión: Ajustes (engranaje) → "Cerrar sesión".

## Actualizar el contenido

Todo el contenido (ejercicios, rutina, recetas, objetivos de nutrición) vive en archivos JSON dentro de `data/`. Puedes editarlos directamente en GitHub o pedirle a Claude que lo actualice.

## Desarrollo local

No hay build ni dependencias. Sirve la carpeta con cualquier servidor estático, por ejemplo:

```
python3 -m http.server 8080
```

y abre `http://localhost:8080`.
