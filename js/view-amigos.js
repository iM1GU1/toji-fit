/* view-amigos.js — añadir amigos por email y ver su feed de entrenamientos terminados */

const ViewAmigos = (() => {
  let friends = [];
  let feed = [];

  function root() { return document.getElementById("view-amigos"); }
  function initials(name) { return (name || "?").slice(0, 2).toUpperCase(); }

  function timeAgo(ms) {
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `hace ${d} d`;
    return new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  async function render() {
    const el = root();
    el.innerHTML = `
      <div class="friend-add">
        <input type="email" id="friend-email" placeholder="Email de tu amigo/a" inputmode="email" autocomplete="off">
        <button class="btn primary small" id="btn-add-friend">Añadir</button>
      </div>
      <p class="gate-err" id="friend-msg" style="margin:-10px 0 10px;"></p>
      <div id="friends-list"><p class="muted" style="font-size:0.85rem;">Cargando…</p></div>
      <h3 style="margin:18px 0 10px;">Últimos entrenamientos</h3>
      <div id="friends-feed"><p class="muted" style="font-size:0.85rem;">Cargando…</p></div>
    `;
    el.querySelector("#btn-add-friend").addEventListener("click", onAddFriend);
    el.querySelector("#friend-email").addEventListener("keydown", e => { if (e.key === "Enter") onAddFriend(); });

    friends = await Store.getFriends();
    renderFriendsList();
    feed = await Store.getFriendsFeed(friends.map(f => f.uid));
    renderFeed();
  }

  function renderFriendsList() {
    const listEl = document.getElementById("friends-list");
    if (!listEl) return;
    if (!friends.length) {
      listEl.innerHTML = `<p class="muted" style="font-size:0.85rem;margin-bottom:6px;">Añade a alguien por su email para ver sus entrenamientos aquí.</p>`;
      return;
    }
    listEl.innerHTML = friends.map(f => `
      <div class="friend-row" data-uid="${f.uid}">
        <div class="avatar">${initials(f.displayName)}</div>
        <div style="flex:1;min-width:0;">
          <div class="fr-name">${f.displayName || f.email}</div>
          <div class="fr-sub">${f.email || ""}</div>
        </div>
        <button class="btn small ghost btn-remove-friend">Quitar</button>
      </div>
    `).join("");
    listEl.querySelectorAll(".btn-remove-friend").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid = btn.closest(".friend-row").dataset.uid;
        await Store.removeFriend(uid);
        friends = friends.filter(f => f.uid !== uid);
        feed = feed.filter(item => item.uid !== uid);
        renderFriendsList();
        renderFeed();
        App.toast("Amigo eliminado");
      });
    });
  }

  function renderFeed() {
    const feedEl = document.getElementById("friends-feed");
    if (!feedEl) return;
    if (!feed.length) {
      feedEl.innerHTML = `<div class="empty"><img class="toji-art" src="icons/hero-silhouette.svg" alt="">Cuando tus amigos terminen un entrenamiento, aparecerá aquí.</div>`;
      return;
    }
    feedEl.innerHTML = feed.map(item => `
      <div class="feed-item">
        <div class="avatar">${initials(item.displayName)}</div>
        <div class="fi-body">
          <div class="fi-top">
            <span class="fi-name">${item.displayName || "Alguien"}</span>
            <span class="fi-when">${timeAgo(item.finishedAt)}</span>
          </div>
          <div class="fi-day">${item.dayName || ""}</div>
          <div class="fi-meta">${item.setsDone || 0} series completadas</div>
        </div>
      </div>
    `).join("");
  }

  async function onAddFriend() {
    const input = document.getElementById("friend-email");
    const msgEl = document.getElementById("friend-msg");
    const email = input.value.trim();
    if (!email) return;
    msgEl.textContent = "";
    const btn = document.getElementById("btn-add-friend");
    btn.disabled = true;
    const res = await Store.addFriendByEmail(email);
    btn.disabled = false;
    if (res.ok) {
      input.value = "";
      App.toast("Amigo añadido");
      friends = await Store.getFriends();
      renderFriendsList();
      feed = await Store.getFriendsFeed(friends.map(f => f.uid));
      renderFeed();
    } else {
      msgEl.textContent = res.reason === "self" ? "Ese eres tú :)" : "No hay ninguna cuenta con ese email todavía.";
    }
  }

  return { render };
})();
