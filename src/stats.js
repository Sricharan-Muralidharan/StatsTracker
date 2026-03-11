/* ===== Data + Storage ===== */
const STORAGE_KEY = "vballGames";

const summaryCardsEl = document.getElementById("summaryCards");
const tableBodyEl = document.getElementById("detailedTableBody");
const tableFootEl = document.getElementById("detailedTableFoot");
const lastUpdatedEl = document.getElementById("lastUpdated");
const gameFilterListEl = document.getElementById("gameFilterList");
const allGamesToggle = document.getElementById("allGamesToggle");

const state = loadState();
let selectedGameIds = new Set();

initFilters();
renderFromSelection();
renderTimestamp();

/* ===== Render ===== */
function renderSummary(list) {
  const totals = list.reduce((acc, p) => {
    acc.kills += p.kills;
    acc.assists += p.assists;
    acc.aces += p.aces;
    acc.blocks += p.blocks;
    acc.digs += p.digs;
    acc.attackErrors += p.attackErrors;
    acc.setErrors += p.setErrors;
    acc.digErrors += p.digErrors;
    acc.errors += p.errors;
    return acc;
  }, {
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0,
    errors: 0
  });

  summaryCardsEl.innerHTML = `
    <div class="stat-card">
      <div class="label">Kills</div>
      <div class="value">${totals.kills}</div>
    </div>
    <div class="stat-card">
      <div class="label">Assists</div>
      <div class="value">${totals.assists}</div>
    </div>
    <div class="stat-card">
      <div class="label">Digs</div>
      <div class="value">${totals.digs}</div>
    </div>
    <div class="stat-card">
      <div class="label">Aces</div>
      <div class="value">${totals.aces}</div>
    </div>
    <div class="stat-card">
      <div class="label">Blocks</div>
      <div class="value">${totals.blocks}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Errors</div>
      <div class="value">${totals.errors}</div>
    </div>
  `;
}

function renderTable(list) {
  tableBodyEl.innerHTML = "";

  if (list.length === 0) {
    tableBodyEl.innerHTML = `<tr><td colspan="13">No player data yet.</td></tr>`;
    tableFootEl.innerHTML = "";
    return;
  }

  const totals = {
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0,
    errors: 0
  };

  list.forEach(p => {
    totals.kills += p.kills;
    totals.assists += p.assists;
    totals.aces += p.aces;
    totals.blocks += p.blocks;
    totals.digs += p.digs;
    totals.attackErrors += p.attackErrors;
    totals.setErrors += p.setErrors;
    totals.digErrors += p.digErrors;
    totals.errors += p.errors;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.name} #${p.number}</td>
      <td>${p.kills}</td>
      <td>${p.attackErrors}</td>
      <td>${attackEff(p.kills, p.attackErrors)}</td>
      <td>${p.assists}</td>
      <td>${p.setErrors}</td>
      <td>${assistEff(p.assists, p.setErrors)}</td>
      <td>${p.aces}</td>
      <td>${p.blocks}</td>
      <td>${p.digs}</td>
      <td>${p.digErrors}</td>
      <td>${digEff(p.digs, p.digErrors)}</td>
      <td>${p.errors}</td>
    `;
    tableBodyEl.appendChild(row);
  });

  tableFootEl.innerHTML = `
    <tr>
      <td>Team Total</td>
      <td>${totals.kills}</td>
      <td>${totals.attackErrors}</td>
      <td>${attackEff(totals.kills, totals.attackErrors)}</td>
      <td>${totals.assists}</td>
      <td>${totals.setErrors}</td>
      <td>${assistEff(totals.assists, totals.setErrors)}</td>
      <td>${totals.aces}</td>
      <td>${totals.blocks}</td>
      <td>${totals.digs}</td>
      <td>${totals.digErrors}</td>
      <td>${digEff(totals.digs, totals.digErrors)}</td>
      <td>${totals.errors}</td>
    </tr>
  `;
}

function renderTimestamp() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  lastUpdatedEl.textContent = `Last updated: ${date} ${time}`;
}

function renderFromSelection() {
  const selectedPlayers = getSelectedPlayers();
  renderSummary(selectedPlayers);
  renderTable(selectedPlayers);
  renderTimestamp();
}

function initFilters() {
  if (!state.games.length) {
    allGamesToggle.disabled = true;
    return;
  }

  gameFilterListEl.innerHTML = "";
  state.games.forEach(game => {
    const row = document.createElement("label");
    row.className = "filter-item";
    row.innerHTML = `
      <input type="checkbox" data-game-id="${game.id}" />
      ${game.name}
    `;
    gameFilterListEl.appendChild(row);
  });

  allGamesToggle.addEventListener("change", () => {
    selectedGameIds.clear();
    if (allGamesToggle.checked) {
      gameFilterListEl.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.checked = false;
      });
    }
    renderFromSelection();
  });

  gameFilterListEl.addEventListener("change", (e) => {
    const target = e.target;
    if (target && target.dataset.gameId) {
      if (target.checked) {
        selectedGameIds.add(target.dataset.gameId);
      } else {
        selectedGameIds.delete(target.dataset.gameId);
      }
      allGamesToggle.checked = selectedGameIds.size === 0;
      renderFromSelection();
    }
  });
}

function getSelectedPlayers() {
  if (allGamesToggle.checked || selectedGameIds.size === 0) {
    return aggregatePlayers(state.games);
  }
  return aggregatePlayers(state.games.filter(g => selectedGameIds.has(g.id)));
}

/* ===== Helpers ===== */
function attackEff(kills, errors) {
  const attempts = kills + errors;
  if (attempts === 0) return "-";
  return `${(((kills - errors) / attempts) * 100).toFixed(1)}%`;
}

function assistEff(assists, errors) {
  const attempts = assists + errors;
  if (attempts === 0) return "-";
  return `${((assists / attempts) * 100).toFixed(1)}%`;
}

function digEff(digs, errors) {
  const attempts = digs + errors;
  if (attempts === 0) return "-";
  return `${((digs / attempts) * 100).toFixed(1)}%`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { games: [] };
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.games)) return { games: [] };
    return {
      games: data.games.map(g => ({
        id: g.id,
        name: g.name || "Game",
        sets: Array.isArray(g.sets) ? g.sets.map(s => ({
          id: s.id,
          name: s.name || "Set",
          players: Array.isArray(s.players) ? s.players.map(p => ({
            name: p.name,
            number: p.number,
            kills: p.kills || 0,
            assists: p.assists || 0,
            aces: p.aces || 0,
            blocks: p.blocks || 0,
            digs: p.digs || 0,
            errors: p.errors || 0,
            attackErrors: p.attackErrors || 0,
            setErrors: p.setErrors || 0,
            digErrors: p.digErrors || 0
          })) : []
        })) : []
      }))
    };
  } catch {
    return { games: [] };
  }
}

function aggregatePlayers(games) {
  const map = new Map();
  games.forEach(game => {
    const sets = Array.isArray(game.sets) ? game.sets : [];
    sets.forEach(set => {
      (set.players || []).forEach(p => {
        const key = `${p.name}#${p.number}`;
        if (!map.has(key)) {
          map.set(key, {
            name: p.name,
            number: p.number,
            kills: 0,
            assists: 0,
            aces: 0,
            blocks: 0,
            digs: 0,
            errors: 0,
            attackErrors: 0,
            setErrors: 0,
            digErrors: 0
          });
        }
        const acc = map.get(key);
        acc.kills += p.kills || 0;
        acc.assists += p.assists || 0;
        acc.aces += p.aces || 0;
        acc.blocks += p.blocks || 0;
        acc.digs += p.digs || 0;
        acc.errors += p.errors || 0;
        acc.attackErrors += p.attackErrors || 0;
        acc.setErrors += p.setErrors || 0;
        acc.digErrors += p.digErrors || 0;
      });
    });
  });
  return Array.from(map.values());
}
