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
      <div id="duel-section"></div>
      <div id="friends-list"><p class="muted" style="font-size:0.85rem;">Cargando…</p></div>
      <h3 style="margin:18px 0 10px;">Últimos entrenamientos</h3>
      <div id="friends-feed"><p class="muted" style="font-size:0.85rem;">Cargando…</p></div>
    `;
    el.querySelector("#btn-add-friend").addEventListener("click", onAddFriend);
    el.querySelector("#friend-email").addEventListener("keydown", e => { if (e.key === "Enter") onAddFriend(); });

    friends = await Store.getFriends();
    renderFriendsList();
    renderDuel();
    feed = await Store.getFriendsFeed(friends.map(f => f.uid));
    renderFeed();
  }

  function daysLeftInWeek() {
    const dow = (new Date().getDay() + 6) % 7; // 0 = lunes
    return 6 - dow;
  }

  function renderDuel() {
    const elWrap = document.getElementById("duel-section");
    if (!elWrap) return;
    if (!friends.length) {
      elWrap.innerHTML = `<div class="callout" style="font-size:0.82rem;">Añade a alguien para competir por XP cada semana.</div>`;
      return;
    }
    const cwk = Store.currentWeekKey();
    const my = Store.getWeeklyXp();
    const myXp = my.weekStart === cwk ? my.xp : 0;
    const rows = [{ me: true, name: "Tú", xp: myXp }];
    friends.forEach(f => {
      const fxp = f.weeklyXpWeekStart === cwk ? (f.weeklyXp || 0) : 0;
      rows.push({ me: false, name: f.displayName || (f.email || "").split("@")[0], xp: fxp });
    });
    rows.sort((a, b) => b.xp - a.xp);
    const max = Math.max(1, ...rows.map(r => r.xp));
    const left = daysLeftInWeek();
    elWrap.innerHTML = `
      <div class="duel-card">
        <div class="row between" style="margin-bottom:8px;">
          <h3 style="margin:0;">Reto semanal</h3>
          <span class="muted" style="font-size:0.76rem;">${left <= 0 ? "último día" : `quedan ${left} días`}</span>
        </div>
        ${rows.map((r, i) => `
          <div class="duel-row ${r.me ? "me" : ""} ${i === 0 && r.xp > 0 ? "lead" : ""}">
            <span class="dr-name"><span class="dr-name-txt">${r.name}</span>${i === 0 && r.xp > 0 ? `<span class="lead-tag">líder</span>` : ""}</span>
            <div class="duel-bar-track"><div class="fill" style="width:${Math.round((r.xp / max) * 100)}%"></div></div>
            <span class="dr-xp">${r.xp}</span>
          </div>
        `).join("")}
      </div>
    `;
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
        renderDuel();
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
      renderDuel();
      feed = await Store.getFriendsFeed(friends.map(f => f.uid));
      renderFeed();
    } else {
      msgEl.textContent = res.reason === "self" ? "Ese eres tú :)" : "No hay ninguna cuenta con ese email todavía.";
    }
  }

  return { render };
})();
