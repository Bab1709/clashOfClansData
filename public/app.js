const form = document.getElementById("search-form");
const input = document.getElementById("tag-input");
const statusBox = document.getElementById("status");
const result = document.getElementById("result");
const recentBox = document.getElementById("recent");

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

const ICONS = {
  trophy: "M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm-1 4v1a2 2 0 0 0 1 1.7V7H6Zm11 0v2.7A2 2 0 0 0 18 8V7h-1Z",
  star: "M12 2l3 6.6 7 .7-5.3 4.8 1.6 7L12 17.5l-6.3 3.6 1.6-7L2 9.3l7-.7L12 2Z",
  sword: "M14.5 3H21v6.5l-9.4 9.4 1.4 1.4-1.4 1.4-2.8-2.8-3.5 3.5-1.4-1.4 3.5-3.5-2.8-2.8 1.4-1.4 1.4 1.4L14.5 3Z",
  shield: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z",
  up: "M11 21V7.8l-5.6 5.6L4 12l8-8 8 8-1.4 1.4L13 7.8V21h-2Z",
  down: "M13 3v13.2l5.6-5.6L20 12l-8 8-8-8 1.4-1.4 5.6 5.6V3h2Z",
  coin: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4 6 6-6 6-6-6 6-6Z",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1v-1Zm17.5 1H23v-1c0-2.4-2.2-4.4-5.3-4.9 1.2 1.3 1.8 2.9 1.8 4.6V21Z",
  fire: "M12 2s6 4.6 6 11a6 6 0 0 1-12 0c0-2.4 1.2-4.2 1.2-4.2S8.5 11.5 10.5 11.5C10.5 6.5 12 2 12 2Z",
  calendar: "M7 2h2v2h6V2h2v2h3v17H4V4h3V2Zm11 7H6v10h12V9Z",
  castle: "M3 21V8h3V5h2v3h2V5h4v3h2V5h2v3h3v13h-7v-5a2 2 0 0 0-4 0v5H3Z",
  lock: "M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10h2Zm2 0h6V7a3 3 0 0 0-6 0v3Z",
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// --- Status & recent searches -------------------------------------------

function showLoading() {
  statusBox.innerHTML = `<span class="spinner"></span> Loading…`;
  statusBox.classList.remove("error");
  statusBox.hidden = false;
}

function showError(message) {
  statusBox.textContent = message;
  statusBox.classList.add("error");
  statusBox.hidden = false;
}

const RECENT_KEY = "clashStats.recent";

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(type, tag, name) {
  const list = [{ type, tag, name }, ...readRecent().filter((r) => !(r.type === type && r.tag === tag))].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable (private mode); recent searches are optional.
  }
  renderRecent();
}

function renderRecent() {
  const list = readRecent();
  recentBox.hidden = list.length === 0;
  recentBox.innerHTML =
    `<span class="recent-label">Recent:</span>` +
    list
      .map((r) => `<a href="#${esc(r.type)}/${esc(r.tag)}">${esc(r.name)}<small>${r.type === "clan" ? "clan" : "player"}</small></a>`)
      .join("");
}

async function lookup(type, tag) {
  showLoading();
  result.innerHTML = "";
  try {
    const response = await fetch(`/api/${type}/${encodeURIComponent(tag)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    statusBox.hidden = true;
    result.innerHTML = type === "player" ? renderPlayer(data) : renderClan(data);
    document.title = `${data.name} · Clash Stats`;
    saveRecent(type, tag, data.name);
  } catch (err) {
    showError(err.message);
    document.title = "Clash Stats";
  }
}

// --- Rendering ---------------------------------------------------------

function stat(iconName, label, value) {
  return `<div class="stat">
    <span class="stat-icon">${icon(iconName)}</span>
    <span class="stat-text"><span class="stat-value">${esc(value)}</span><span class="stat-label">${esc(label)}</span></span>
  </div>`;
}

function leagueChip(league) {
  if (!league || !league.name) return "";
  const img = league.iconUrls?.small || league.iconUrls?.tiny;
  return `<span class="chip gold">${img ? `<img src="${esc(img)}" alt="">` : ""}${esc(league.name)}</span>`;
}

function labelChips(labels) {
  return (labels || [])
    .map((l) => `<span class="chip">${l.iconUrls?.small ? `<img src="${esc(l.iconUrls.small)}" alt="">` : ""}${esc(l.name)}</span>`)
    .join("");
}

function levelGrid(title, items) {
  if (!items || items.length === 0) return "";
  const done = items.reduce((sum, i) => sum + Math.min(i.level, i.maxLevel), 0);
  const total = items.reduce((sum, i) => sum + i.maxLevel, 0);
  const overall = Math.round((done / total) * 100);
  const maxedCount = items.filter((i) => i.level >= i.maxLevel).length;

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

  return `<div class="panel">
    <div class="panel-head">
      <h3>${esc(title)}</h3>
      <span class="progress">${maxedCount}/${items.length} maxed
        <span class="ring" style="--p:${overall}" title="${overall}% of all levels"><span>${overall}%</span></span>
      </span>
    </div>
    <div class="unit-grid">${cells}</div>
  </div>`;
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
    : `<span class="chip">No clan</span>`;

  return `
    <article class="profile">
      <div class="banner">
        <div class="th-badge"><small>TH</small><strong>${p.townHallLevel}</strong></div>
        <div class="banner-title">
          <h2>${esc(p.name)}</h2>
          <p class="tag">${esc(p.tag)} · XP level ${p.expLevel}</p>
          <div class="chips">${leagueChip(p.leagueTier || p.league)}${labelChips(p.labels)}</div>
        </div>
        ${clan}
      </div>

      <div class="stats">
        ${stat("trophy", "Trophies", fmt(p.trophies))}
        ${stat("trophy", "Best trophies", fmt(p.bestTrophies))}
        ${stat("star", "War stars", fmt(p.warStars))}
        ${stat("sword", "Attack wins", fmt(p.attackWins))}
        ${stat("shield", "Defense wins", fmt(p.defenseWins))}
        ${stat("up", "Donated", fmt(p.donations))}
        ${stat("down", "Received", fmt(p.donationsReceived))}
        ${stat("castle", "Capital gold", fmt(p.clanCapitalContributions))}
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
          ${stat("castle", "Builder hall", p.builderHallLevel)}
          ${stat("trophy", "Trophies", fmt(p.builderBaseTrophies))}
          ${stat("trophy", "Best trophies", fmt(p.bestBuilderBaseTrophies))}
        </div>
        ${levelGrid("Builder heroes", builder(p.heroes))}
        ${levelGrid("Builder troops", builder(p.troops))}
      ` : ""}
    </article>`;
}

function renderClan(c) {
  const members = [...(c.memberList || [])].sort((a, b) => a.clanRank - b.clanRank);
  const rows = members
    .map((m) => {
      const league = m.leagueTier || m.league;
      const leagueImg = league?.iconUrls?.small || league?.iconUrls?.tiny;
      return `
      <tr>
        <td class="num rank">${m.clanRank}</td>
        <td>
          <div class="member">
            ${leagueImg ? `<img src="${esc(leagueImg)}" alt="" title="${esc(league.name)}">` : ""}
            <div><a href="#player/${esc(cleanTag(m.tag))}">${esc(m.name)}</a><br><span class="role role-${esc(m.role)}">${esc(ROLE_NAMES[m.role] || m.role)}</span></div>
          </div>
        </td>
        <td class="num"><span class="th-pill">${m.townHallLevel ?? "–"}</span></td>
        <td class="num trophies">${fmt(m.trophies)}</td>
        <td class="num hide-sm">${fmt(m.donations)}</td>
        <td class="num hide-sm">${fmt(m.donationsReceived)}</td>
      </tr>`;
    })
    .join("");

  const warTotal = (c.warWins || 0) + (c.warLosses || 0) + (c.warTies || 0);
  const winRate = c.isWarLogPublic && warTotal ? `${Math.round((c.warWins / warTotal) * 100)}%` : "Private";

  return `
    <article class="profile">
      <div class="banner">
        <img class="clan-badge" src="${esc(c.badgeUrls?.large || c.badgeUrls?.medium)}" alt="">
        <div class="banner-title">
          <h2>${esc(c.name)}</h2>
          <p class="tag">${esc(c.tag)} · Level ${c.clanLevel}${c.location ? ` · ${esc(c.location.name)}` : ""}</p>
          <div class="chips">
            ${c.warLeague ? `<span class="chip gold">${icon("sword")}${esc(c.warLeague.name)}</span>` : ""}
            ${c.capitalLeague ? `<span class="chip">${esc(c.capitalLeague.name)}</span>` : ""}
            ${c.type ? `<span class="chip">${esc(CLAN_TYPE[c.type] || c.type)}</span>` : ""}
            ${labelChips(c.labels)}
          </div>
        </div>
      </div>
      ${c.description ? `<p class="description">${esc(c.description)}</p>` : ""}

      <div class="stats">
        ${stat("users", "Members", `${c.members}/50`)}
        ${stat("trophy", "Clan points", fmt(c.clanPoints))}
        ${stat("castle", "Capital points", fmt(c.clanCapitalPoints))}
        ${stat("lock", "Required trophies", fmt(c.requiredTrophies))}
        ${stat("star", "War wins", fmt(c.warWins))}
        ${stat("sword", "War win rate", winRate)}
        ${stat("fire", "Win streak", fmt(c.warWinStreak))}
        ${stat("calendar", "Wars", WAR_FREQUENCY[c.warFrequency] || "–")}
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Members</h3><span class="progress">${members.length} players</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th class="num">#</th><th>Player</th><th class="num">TH</th><th class="num">Trophies</th><th class="num hide-sm">Donated</th><th class="num hide-sm">Received</th></tr></thead>
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
const CLAN_TYPE = { open: "Anyone can join", inviteOnly: "Invite only", closed: "Closed" };

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
renderRecent();
route();
