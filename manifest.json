/* auth.js — login/registro real con Firebase Authentication.
   Sustituye al candado simple: cada persona crea su propia cuenta (email + contraseña)
   y su progreso se guarda ligado a esa cuenta (ver Store.initRemote en store.js). */

const Auth = (() => {
  let mode = "login";
  let ready = false;
  let currentUser = null;

  function el(id) { return document.getElementById(id); }

  function configured() {
    return typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "PENDIENTE";
  }

  function showConfigMissing() {
    const card = document.querySelector("#gate .gate-card");
    card.innerHTML = `
      <img class="gate-mark" src="icons/hero-silhouette.svg" alt="" aria-hidden="true">
      <p class="eyebrow">Sorcerer Killer</p>
      <h1>Falta configurar Firebase</h1>
      <p class="muted" style="font-size:0.85rem;">Añade tu firebaseConfig en <code>js/firebase-config.js</code> para activar el login. Mientras tanto la app no puede continuar.</p>
    `;
  }

  function setMode(m) {
    mode = m;
    el("gate-tabs").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.mode === m));
    el("gate-btn").textContent = m === "login" ? "Entrar" : "Crear cuenta";
    el("gate-password").autocomplete = m === "login" ? "current-password" : "new-password";
    el("gate-err").textContent = "";
    el("gate-ok").textContent = "";
  }

  function friendlyError(code) {
    const map = {
      "auth/invalid-email": "Ese email no parece válido.",
      "auth/missing-password": "Escribe una contraseña.",
      "auth/weak-password": "La contraseña necesita al menos 6 caracteres.",
      "auth/email-already-in-use": "Ya existe una cuenta con ese email — prueba a entrar en vez de crear cuenta.",
      "auth/invalid-credential": "Email o contraseña incorrectos.",
      "auth/wrong-password": "Email o contraseña incorrectos.",
      "auth/user-not-found": "No hay ninguna cuenta con ese email.",
      "auth/too-many-requests": "Demasiados intentos — espera un minuto y prueba otra vez.",
      "auth/network-request-failed": "Sin conexión a internet."
    };
    return map[code] || "Algo ha ido mal. Inténtalo de nuevo.";
  }

  async function submit() {
    const email = el("gate-email").value.trim();
    const password = el("gate-password").value;
    const errEl = el("gate-err"); const okEl = el("gate-ok");
    errEl.textContent = ""; okEl.textContent = "";
    if (!email || !password) { errEl.textContent = "Rellena email y contraseña."; return; }
    const btn = el("gate-btn");
    btn.disabled = true;
    try {
      if (mode === "login") {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } else {
        await firebase.auth().createUserWithEmailAndPassword(email, password);
      }
      // onAuthStateChanged se encarga de continuar
    } catch (e) {
      errEl.textContent = friendlyError(e.code);
    } finally {
      btn.disabled = false;
    }
  }

  async function forgotPassword() {
    const email = el("gate-email").value.trim();
    const errEl = el("gate-err"); const okEl = el("gate-ok");
    errEl.textContent = ""; okEl.textContent = "";
    if (!email) { errEl.textContent = "Escribe tu email arriba primero."; return; }
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      okEl.textContent = "Te hemos enviado un email para restablecer la contraseña.";
    } catch (e) {
      errEl.textContent = friendlyError(e.code);
    }
  }

  function logout() {
    firebase.auth().signOut();
  }

  function wireUI() {
    el("gate-tabs").querySelectorAll("button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    el("gate-btn").addEventListener("click", submit);
    el("gate-forgot").addEventListener("click", forgotPassword);
    [el("gate-email"), el("gate-password")].forEach(inp => {
      inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    });
  }

  function init(onAuthed, onSignedOut) {
    if (!configured()) { showConfigMissing(); return; }
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
      ready = true;
    } catch (e) { console.warn("Firebase init falló", e); showConfigMissing(); return; }

    wireUI();

    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      if (user) {
        document.getElementById("gate").style.display = "none";
        onAuthed(user);
      } else {
        document.getElementById("gate").style.display = "flex";
        document.getElementById("app").classList.remove("ready");
        el("gate-email").value = ""; el("gate-password").value = "";
        if (onSignedOut) onSignedOut();
      }
    });
  }

  return { init, logout, get ready() { return ready; }, get user() { return currentUser; } };
})();
