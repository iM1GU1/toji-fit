/* gate.js — candado de acceso simple.
   IMPORTANTE: esto NO es seguridad real. El código fuente de esta web es público en GitHub,
   así que cualquiera con conocimientos técnicos podría saltárselo. Es solo un disuasorio
   para que quien tenga el link por casualidad no vea tus datos a la primera. */

const Gate = (() => {
  const SESSION_KEY = "tojifit_unlocked_v1";

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function el(id) { return document.getElementById(id); }

  function resetPassword() {
    localStorage.removeItem("tojifit_auth_v1");
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  function init(onUnlock) {
    const gateEl = el("gate");
    const input = el("gate-input");
    const btn = el("gate-btn");
    const err = el("gate-err");
    const titleEl = gateEl.querySelector("h1");

    const alreadyUnlocked = sessionStorage.getItem(SESSION_KEY) === "1";
    const auth = Store.getAuth();

    if (alreadyUnlocked && auth) {
      gateEl.style.display = "none";
      onUnlock();
      return;
    }

    const isFirstRun = !auth;
    if (isFirstRun) {
      titleEl.textContent = "Crea tu contraseña";
      input.placeholder = "Mínimo 4 caracteres";
      btn.textContent = "Crear y entrar";
    } else {
      titleEl.textContent = "Plan Toji";
      input.placeholder = "Contraseña";
      btn.textContent = "Entrar";
    }

    async function submit() {
      const val = input.value.trim();
      err.textContent = "";
      if (isFirstRun) {
        if (val.length < 4) { err.textContent = "Usa al menos 4 caracteres."; return; }
        const hash = await sha256(val);
        Store.setAuth({ hash });
        sessionStorage.setItem(SESSION_KEY, "1");
        gateEl.style.display = "none";
        onUnlock();
      } else {
        const hash = await sha256(val);
        if (hash === auth.hash) {
          sessionStorage.setItem(SESSION_KEY, "1");
          gateEl.style.display = "none";
          onUnlock();
        } else {
          err.textContent = "Contraseña incorrecta.";
          input.value = "";
          input.focus();
        }
      }
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    input.focus();
  }

  return { init, resetPassword };
})();
