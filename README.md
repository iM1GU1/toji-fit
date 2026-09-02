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
       match /usersPublic/{uid} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.uid == uid;
       }
       match /friendships/{pairId} {
         allow read: if request.auth != null && request.auth.uid in resource.data.uids;
         allow create: if request.auth != null && request.auth.uid in request.resource.data.uids
           && request.resource.data.uids.size() == 2
           && pairId == (request.resource.data.uids[0] < request.resource.data.uids[1]
                ? request.resource.data.uids[0] + '_' + request.resource.data.uids[1]
                : request.resource.data.uids[1] + '_' + request.resource.data.uids[0]);
         allow delete: if request.auth != null && request.auth.uid in resource.data.uids;
       }
       match /feed/{postId} {
         allow read: if request.auth != null && (
           request.auth.uid == resource.data.uid ||
           exists(/databases/$(database)/documents/friendships/$(
             request.auth.uid < resource.data.uid
               ? request.auth.uid + '_' + resource.data.uid
               : resource.data.uid + '_' + request.auth.uid
           ))
         );
         allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
         allow update, delete: if false;
       }
     }
   }
   ```
5. Panel del proyecto → icono web `</>` → registrar app → copiar el objeto `firebaseConfig` en `js/firebase-config.js`.

### Si ya tenías la app configurada de antes (añadir amigos)

La pestaña "Amigos" necesita 3 colecciones nuevas (`usersPublic`, `friendships`, `feed`) que no existían en las reglas antiguas. Sin este paso, añadir amigos o ver el feed dará error de permisos:

1. Firebase Console → tu proyecto → Firestore Database → Reglas.
2. Sustituye el contenido completo por el bloque de arriba (ya incluye la regla `users/{userId}` original más las 3 nuevas).
3. Publicar.

## Qué incluye

- **Rutina**: los 6 días del plan Toji, con sustitución de ejercicios (sugerencias inteligentes por grupo muscular y equipo disponible) y edición de series/repeticiones.
- **Entrenar**: modo entrenamiento en vivo — registra reps/kg por serie, temporizador de descanso con sonido + vibración + notificación, y mantiene la pantalla encendida mientras entrenas.
- **Guías**: ficha de cada ejercicio con instrucciones paso a paso y errores comunes, adaptadas de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (base de datos abierta de ejercicios).
- **Comer → Nutrición**: calorías y macros calculados a partir de tu edad/altura/peso (fórmula Mifflin-St Jeor), repartidos en 3 comidas sin desayuno.
- **Comer → Recetas**: recetas guiadas paso a paso para cada comida.
- **Comer → Compra**: lista de la compra generada automáticamente a partir del plan de comidas de la semana.
- **XP y niveles**: cada serie que marcas como hecha da XP (peso × repeticiones; un PR paga el doble), con barra de progreso animada en la cabecera y en la pestaña Yo, y una celebración al subir de nivel.
- **Récords personales (PR)**: la app recuerda tu mejor marca (1RM estimado) de cada ejercicio. En cuanto la superas, aparece un aviso de "¡Nuevo PR!" con confeti, al momento.
- **Amigos**: añade a alguien por su email (debe tener ya cuenta creada) y ve un feed con sus últimos entrenamientos terminados — se publica automáticamente cuando alguien pulsa "Terminar entrenamiento". Solo ves el feed de la gente que has añadido, nadie ve el tuyo sin que lo añadas.
- **Reto semanal**: dentro de Amigos, una clasificación de XP ganada esta semana entre tú y cada amigo/a — se reinicia cada lunes. Usa las mismas colecciones/reglas de Firestore que "Amigos" (no hace falta ningún paso adicional de configuración).
- **Yo**: registro de peso con gráfica, racha de días cumplidos, y consejos automáticos (motor de reglas: si llevas días sin entrenar, si el peso está estancado, etc.).

## Cambiar tu contraseña

Pantalla de acceso → "¿Has olvidado tu contraseña?" (te llega un email de Firebase para restablecerla). Cerrar sesión: Ajustes (engranaje) → "Cerrar sesión".

## Actualizar el contenido

Todo el contenido (ejercicios, rutina, recetas, objetivos de nutrición) vive en archivos JSON dentro de `data/`. Puedes editarlos directamente en GitHub o pedirle a Claude que lo actualice.

## Después de subir un cambio en el código (`.js` / `.css`)

GitHub Pages cachea esos archivos hasta 10 minutos, y el móvil (como PWA instalada) los cachea aparte con el service worker. Para que el cambio se vea al momento en vez de esperar:

1. Sube los archivos `.js`/`.css` modificados como siempre.
2. Sube también `index.html` con el número de versión (`?v=3`, `?v=4`, …) subido en **todas** las etiquetas `<script>`/`<link>` que apunten a `js/` o `css/`.
3. Sube `sw.js` con `CACHE` y las rutas de `ASSETS` actualizadas al mismo número de versión.

Si solo subes el `.js` sin subir `index.html`/`sw.js` con el número de versión nuevo, puede tardar hasta 10 minutos en verse el cambio.

## Desarrollo local

No hay build ni dependencias. Sirve la carpeta con cualquier servidor estático, por ejemplo:

```
python3 -m http.server 8080
```

y abre `http://localhost:8080`.
