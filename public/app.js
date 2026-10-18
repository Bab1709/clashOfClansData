const form = document.getElementById("search-form");
const input = document.getElementById("tag-input");
const statusBox = document.getElementById("status");
const result = document.getElementById("result");

// Everything from the API is user-controlled (names, descriptions), so escape it.
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : "–");
const cleanTag = (tag) => tag.trim().toUpperCase().replace(/^#/, "");
const ROLE_NAMES = { leader: "Leader", coLeader: "Co-leader", admin: "Elder", member: "Member" };

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
  statusBox.hidden = false;
}

async function lookup(type, tag) {
  showStatus("Loading…");
  result.innerHTML = "";
  try {
    const response = await fetch(`/api/${type}/${encodeURIComponent(tag)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    statusBox.hidden = true;
    result.innerHTML = type === "player" ? renderPlayer(data) : renderClan(data);
    document.title = `${data.name} · Clash Stats`;
  } catch (err) {
    showStatus(err.message, true);
    document.title = "Clash Stats";
  }
}

// --- Rendering ---------------------------------------------------------

function stat(label, value) {
  return `<div class="stat"><span class="stat-value">${esc(value)}</span><span class="stat-label">${esc(label)}</span></div>`;
}

function levelGrid(title, items) {
  if (!items || items.length === 0) return "";
  const cells = items
    .map((item) => {
      const maxed = item.level >= item.maxLevel;
      const pct = Math.round((item.level / item.maxLevel) * 100);
      return `<div class="unit${maxed ? " maxed" : ""}" title="${esc(item.name)}: ${item.level}/${item.maxLevel}">
        <span class="unit-name">${esc(item.name)}</span>
        <span class="unit-level">${item.level}<small>/${item.maxLevel}</small></span>
        <span class="bar"><span style="width:${pct}%"></span></span>
      </div>`;
    })
    .join("");
  return `<div class="panel"><h3>${esc(title)} <small>${items.filter((i) => i.level >= i.maxLevel).length}/${items.length} maxed</small></h3><div class="unit-grid">${cells}</div></div>`;
}

function leagueOf(player) {
  // The API has used both `league` and `leagueTier` for the ranked league.
  const league = player.leagueTier || player.league;
  if (!league) return "";
  const icon = league.iconUrls?.small || league.iconUrls?.tiny;
  return `<span class="league">${icon ? `<img src="${esc(icon)}" alt="">` : ""}${esc(league.name)}</span>`;
}

function renderPlayer(p) {
  const home = (list) => (list || []).filter((u) => u.village === "home");
  const builder = (list) => (list || []).filter((u) => u.village === "builderBase");
  const troops = home(p.troops).filter((t) => !t.name.startsWith("Super "));
  const pets = troops.filter((t) => PETS.has(t.name));
  const siege = troops.filter((t) => SIEGE.has(t.name));
  const army = troops.filter((t) => !PETS.has(t.name) && !SIEGE.has(t.name));

  const clan = p.clan
    ? `<a class="clan-link" href="#clan/${esc(cleanTag(p.clan.tag))}">
         <img src="${esc(p.clan.badgeUrls?.small)}" alt="">
         <span><strong>${esc(p.clan.name)}</strong><br><small>${esc(ROLE_NAMES[p.role] || "")} · Level ${p.clan.clanLevel}</small></span>
       </a>`
    : `<p class="muted">Not in a clan</p>`;

  return `
    <article class="profile">
      <div class="profile-head">
        <div class="th-badge">TH<strong>${p.townHallLevel}</strong></div>
        <div class="profile-title">
          <h2>${esc(p.name)}</h2>
          <p class="tag">${esc(p.tag)} · XP level ${p.expLevel}</p>
          ${leagueOf(p)}
        </div>
        ${clan}
      </div>

      <div class="stats">
        ${stat("Trophies", fmt(p.trophies))}
        ${stat("Best trophies", fmt(p.bestTrophies))}
        ${stat("War stars", fmt(p.warStars))}
        ${stat("Attack wins", fmt(p.attackWins))}
        ${stat("Defense wins", fmt(p.defenseWins))}
        ${stat("Donated", fmt(p.donations))}
        ${stat("Received", fmt(p.donationsReceived))}
        ${stat("Capital gold", fmt(p.clanCapitalContributions))}
      </div>

      ${levelGrid("Heroes", home(p.heroes))}
      ${levelGrid("Hero equipment", p.heroEquipment)}
      ${levelGrid("Pets", pets)}
      ${levelGrid("Troops", army)}
      ${levelGrid("Siege machines", siege)}
      ${levelGrid("Spells", p.spells)}

      ${p.builderHallLevel ? `
        <h2 class="section-title">Builder base</h2>
        <div class="stats">
          ${stat("Builder hall", p.builderHallLevel)}
          ${stat("Trophies", fmt(p.builderBaseTrophies))}
          ${stat("Best trophies", fmt(p.bestBuilderBaseTrophies))}
        </div>
        ${levelGrid("Builder heroes", builder(p.heroes))}
        ${levelGrid("Builder troops", builder(p.troops))}
      ` : ""}
    </article>`;
}

function renderClan(c) {
  const members = [...(c.memberList || [])].sort((a, b) => a.clanRank - b.clanRank);
  const rows = members
    .map((m) => `
      <tr>
        <td class="num">${m.clanRank}</td>
        <td><a href="#player/${esc(cleanTag(m.tag))}">${esc(m.name)}</a><br><small class="muted">${esc(ROLE_NAMES[m.role] || "")}</small></td>
        <td class="num">${m.townHallLevel ?? "–"}</td>
        <td class="num">${fmt(m.trophies)}</td>
        <td class="num hide-sm">${fmt(m.donations)}</td>
        <td class="num hide-sm">${fmt(m.donationsReceived)}</td>
      </tr>`)
    .join("");

  const warTotal = (c.warWins || 0) + (c.warLosses || 0) + (c.warTies || 0);
  const winRate = c.isWarLogPublic && warTotal ? `${Math.round((c.warWins / warTotal) * 100)}%` : "–";

  return `
    <article class="profile">
      <div class="profile-head">
        <img class="clan-badge" src="${esc(c.badgeUrls?.medium)}" alt="">
        <div class="profile-title">
          <h2>${esc(c.name)}</h2>
          <p class="tag">${esc(c.tag)} · Level ${c.clanLevel}${c.location ? ` · ${esc(c.location.name)}` : ""}</p>
          ${c.warLeague ? `<span class="league">${esc(c.warLeague.name)}</span>` : ""}
        </div>
      </div>
      ${c.description ? `<p class="description">${esc(c.description)}</p>` : ""}

      <div class="stats">
        ${stat("Members", `${c.members}/50`)}
        ${stat("Clan points", fmt(c.clanPoints))}
        ${stat("Capital points", fmt(c.clanCapitalPoints))}
        ${stat("Required trophies", fmt(c.requiredTrophies))}
        ${stat("War wins", fmt(c.warWins))}
        ${stat("War win rate", winRate)}
        ${stat("Win streak", fmt(c.warWinStreak))}
        ${stat("Wars", esc(WAR_FREQUENCY[c.warFrequency] || "–"))}
      </div>

      <div class="panel">
        <h3>Members</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th class="num">#</th><th>Name</th><th class="num">TH</th><th class="num">Trophies</th><th class="num hide-sm">Donated</th><th class="num hide-sm">Received</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </article>`;
}

const PETS = new Set([
  "L.A.S.S.I", "Electro Owl", "Mighty Yak", "Unicorn", "Frosty", "Diggy", "Poison Lizard",
  "Phoenix", "Spirit Fox", "Angry Jelly", "Sneezy",
]);
const SIEGE = new Set([
  "Wall Wrecker", "Battle Blimp", "Stone Slammer", "Siege Barracks", "Log Launcher",
  "Flame Flinger", "Battle Drill", "Troop Launcher",
]);
const WAR_FREQUENCY = {
  always: "Always", moreThanOncePerWeek: "Twice a week", oncePerWeek: "Once a week",
  lessThanOncePerWeek: "Rarely", never: "Never", unknown: "Not set",
};

// --- Routing: #player/TAG and #clan/TAG ---------------------------------

function route() {
  const match = location.hash.match(/^#(player|clan)\/([A-Za-z0-9]+)$/);
  if (!match) {
    result.innerHTML = "";
    statusBox.hidden = true;
    return;
  }
  const [, type, tag] = match;
  form.type.value = type;
  input.value = `#${tag}`;
  lookup(type, tag);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const tag = cleanTag(input.value);
  if (!tag) return;
  const hash = `#${form.type.value}/${tag}`;
  if (location.hash === hash) route();
  else location.hash = hash;
});

window.addEventListener("hashchange", route);
route();
