/* ===== Data + Storage ===== */
const STORAGE_KEY = "vballGames";
const LEGACY_KEY = "vballStats";

const defaultPlayers = [
  {
    name: "Emma",
    number: 7,
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    errors: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0
  },
  {
    name: "Ava",
    number: 12,
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    errors: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0
  },
  {
    name: "Sophia",
    number: 3,
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    errors: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0
  }
];

let state = loadState();

/* ===== DOM References ===== */
const currentPlayerEl = document.getElementById("currentPlayer");
const currentPlayerSelect = document.getElementById("currentPlayerSelect");
const statsTableBody = document.getElementById("statsTableBody");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const removePlayerBtn = document.getElementById("removePlayerBtn");
const resetGameBtn = document.getElementById("resetGameBtn");
const addGameBtn = document.getElementById("addGameBtn");
const gameSelect = document.getElementById("gameSelect");
const opponentNameInput = document.getElementById("opponentName");
const removeGameBtn = document.getElementById("removeGameBtn");
const nextSetBtn = document.getElementById("nextSetBtn");
const currentSetLabel = document.getElementById("currentSetLabel");
const actionButtonsEl = document.getElementById("actionButtons");
const levelButtonsEl = document.getElementById("levelButtons");
const undoStatBtn = document.getElementById("undoStatBtn");

const playerNameInput = document.getElementById("playerName");
const playerNumberInput = document.getElementById("playerNumber");

const confirmOverlay = document.getElementById("confirmOverlay");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");

let pendingConfirm = null;
let currentAction = "attack";
let showDetails = false;
const actionStack = [];

/* ===== Init ===== */
renderAll();

/* ===== Event Listeners ===== */
addPlayerBtn.addEventListener("click", requestAddPlayerConfirm);
removePlayerBtn.addEventListener("click", requestRemovePlayerConfirm);
resetGameBtn.addEventListener("click", resetGame);
addGameBtn.addEventListener("click", requestAddGameConfirm);
gameSelect.addEventListener("change", () => switchGame(gameSelect.value));
removeGameBtn.addEventListener("click", requestRemoveGameConfirm);
nextSetBtn.addEventListener("click", goToNextSet);
currentPlayerSelect.addEventListener("change", () => {
  const game = getActiveGame();
  if (!game) return;
  game.selectedIndex = parseInt(currentPlayerSelect.value, 10) || 0;
  saveState();
  renderAll();
});
confirmCancelBtn.addEventListener("click", closeConfirm);
confirmOkBtn.addEventListener("click", () => {
  if (typeof pendingConfirm === "function") pendingConfirm();
  closeConfirm();
});
undoStatBtn.addEventListener("click", undoLastStat);

setupActionButtons();

/* ===== Core Functions ===== */
function handleStat(statKey, errorType, sourceButton) {
  applyStat(statKey, errorType, sourceButton);
}

function requestAddPlayerConfirm() {
  const name = playerNameInput.value.trim();
  const number = parseInt(playerNumberInput.value, 10);
  if (!name || Number.isNaN(number)) return;

  openConfirm(
    `Add player ${name} (#${number})?`,
    () => addPlayer(name, number)
  );
}

function addPlayer(name, number) {
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set) return;
  if (!name || Number.isNaN(number)) return;

  const newPlayer = createEmptyPlayer(name, number);
  if (!state.roster) state.roster = [];
  state.roster.push({ name, number });
  state.games.forEach(g => {
    g.sets.forEach(s => {
      s.players.push({ ...newPlayer });
    });
  });

  game.selectedIndex = sPlayersLength(game) - 1;
  playerNameInput.value = "";
  playerNumberInput.value = "";

  saveState();
  renderAll();
}

function requestRemovePlayerConfirm() {
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set || set.players.length === 0) return;

  const p = set.players[game.selectedIndex];
  openConfirm(
    `Remove player ${p.name} (#${p.number})?`,
    removePlayer
  );
}

function removePlayer() {
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set || set.players.length === 0) return;

  if (state.roster) {
    state.roster.splice(game.selectedIndex, 1);
  }
  state.games.forEach(g => {
    g.sets.forEach(s => {
      s.players.splice(game.selectedIndex, 1);
    });
    g.selectedIndex = Math.max(0, Math.min(g.selectedIndex, sPlayersLength(g) - 1));
  });
  game.selectedIndex = Math.max(0, Math.min(game.selectedIndex - 1, sPlayersLength(game) - 1));

  saveState();
  renderAll();
}

function resetGame() {
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set) return;

  set.players = set.players.map(p => ({
    ...p,
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    errors: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0
  }));

  saveState();
  renderAll();
}

function requestAddGameConfirm() {
  const name = opponentNameInput.value.trim();
  if (!name) return;
  openConfirm(
    `Create new game vs ${name}?`,
    () => addGame(name)
  );
}

function addGame(name) {
  if (!name) return;

  const newGame = {
    id: cryptoRandomId(),
    name,
    createdAt: Date.now(),
    selectedIndex: 0,
    activeSetIndex: 0,
    sets: [
      {
        id: cryptoRandomId(),
        name: "Set 1",
        players: (state.roster || []).map(r => createEmptyPlayer(r.name, r.number))
      }
    ]
  };

  state.games.push(newGame);
  state.activeGameId = newGame.id;
  opponentNameInput.value = "";
  saveState();
  renderAll();
}

function switchGame(gameId) {
  state.activeGameId = gameId;
  saveState();
  renderAll();
}

function requestRemoveGameConfirm() {
  const game = getActiveGame();
  if (!game) return;
  openConfirm(
    `Remove game vs ${game.name}? This removes all sets and stats.`,
    removeGame
  );
}

function removeGame() {
  if (state.games.length <= 1) return;
  const idx = state.games.findIndex(g => g.id === state.activeGameId);
  if (idx === -1) return;
  state.games.splice(idx, 1);
  state.activeGameId = state.games[0].id;
  saveState();
  renderAll();
}

function goToNextSet() {
  const game = getActiveGame();
  if (!game) return;

  const nextSetNumber = game.sets.length + 1;
  const roster = state.roster || [];
  const newSet = {
    id: cryptoRandomId(),
    name: `Set ${nextSetNumber}`,
    players: roster.map(r => createEmptyPlayer(r.name, r.number))
  };

  game.sets.push(newSet);
  game.activeSetIndex = game.sets.length - 1;
  game.selectedIndex = 0;
  saveState();
  renderAll();
}

/* ===== Render Functions ===== */
function renderAll() {
  renderGameSelect();
  renderSetLabel();
  renderCurrentPlayer();
  renderTable();
}

function renderCurrentPlayer() {
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set || set.players.length === 0) {
    currentPlayerEl.textContent = "None selected";
    currentPlayerSelect.innerHTML = "";
    return;
  }
  currentPlayerSelect.innerHTML = "";
  set.players.forEach((p, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${p.name} #${p.number}`;
    if (idx === game.selectedIndex) opt.selected = true;
    currentPlayerSelect.appendChild(opt);
  });

  const p = set.players[game.selectedIndex] || set.players[0];
  currentPlayerEl.textContent = `${p.name} (#${p.number})`;
}

function renderTable() {
  statsTableBody.innerHTML = "";
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set) return;

  set.players.forEach((p, idx) => {
    const row = document.createElement("tr");
    if (idx === game.selectedIndex) row.classList.add("selected-row");

    const totalErrors = (p.errors || 0);
    row.innerHTML = `
      <td>${p.name} #${p.number}</td>
      <td>${p.kills}</td>
      <td>${p.assists}</td>
      <td>${p.aces}</td>
      <td>${p.blocks}</td>
      <td>${p.digs}</td>
      <td>${totalErrors}</td>
    `;
    statsTableBody.appendChild(row);
  });
}

function renderGameSelect() {
  gameSelect.innerHTML = "";
  state.games.forEach(game => {
    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = game.name;
    if (game.id === state.activeGameId) option.selected = true;
    gameSelect.appendChild(option);
  });
}

function renderSetLabel() {
  const game = getActiveGame();
  if (!game) {
    currentSetLabel.textContent = "Set -";
    return;
  }
  const set = getActiveSet(game);
  currentSetLabel.textContent = set ? set.name : "Set -";
}

function setupActionButtons() {
  renderActionButtons();
  renderLevelButtons();
}

function renderActionButtons() {
  actionButtonsEl.innerHTML = "";
  if (showDetails) return;

  const actions = [
    { id: "attack", label: "Attack" },
    { id: "set", label: "Set" },
    { id: "dig", label: "Dig" },
    { id: "serve", label: "Serve" },
    { id: "block", label: "Block" },
    { id: "error", label: "Error" }
  ];

  actions.forEach(action => {
    const btn = document.createElement("button");
    btn.className = "btn" + (action.id === currentAction ? " active" : "");
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      currentAction = action.id;
      showDetails = true;
      renderActionButtons();
      renderLevelButtons();
    });
    actionButtonsEl.appendChild(btn);
  });
}

function renderLevelButtons() {
  levelButtonsEl.innerHTML = "";
  if (!showDetails) return;
  const config = getLevelConfig(currentAction);
  config.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = item.label;
    btn.addEventListener("click", () => handleStat(item.statKey, item.errorType, btn));
    levelButtonsEl.appendChild(btn);
  });
}

function getLevelConfig(action) {
  switch (action) {
    case "attack":
      return [
        { label: "Kill", statKey: "kills" },
        { label: "Spike", statKey: "kills" },
        { label: "Tip", statKey: "kills" },
        { label: "Attack Error", statKey: "errors", errorType: "attack" }
      ];
    case "set":
      return [
        { label: "Set L1", statKey: "assists" },
        { label: "Set L2", statKey: "assists" },
        { label: "Set L3", statKey: "assists" },
        { label: "Set Error", statKey: "errors", errorType: "set" }
      ];
    case "dig":
      return [
        { label: "Dig L1", statKey: "digs" },
        { label: "Dig L2", statKey: "digs" },
        { label: "Dig L3", statKey: "digs" },
        { label: "Dig Error", statKey: "errors", errorType: "dig" }
      ];
    case "serve":
      return [
        { label: "Ace", statKey: "aces" },
        { label: "Serve Error", statKey: "errors" }
      ];
    case "block":
      return [
        { label: "Block", statKey: "blocks" },
        { label: "Block Error", statKey: "errors" }
      ];
    default:
      return [{ label: "Error", statKey: "errors" }];
  }
}

function applyStat(statKey, errorType = null, sourceButton = null) {
  const game = getActiveGame();
  const set = getActiveSet(game);
  if (!game || !set || set.players.length === 0) return;

  const playerIndex = game.selectedIndex;
  const player = set.players[playerIndex];
  if (!player) return;

  actionStack.push({
    gameId: game.id,
    setId: set.id,
    playerIndex,
    statKey,
    errorType
  });

  if (errorType) {
    const field = `${errorType}Errors`;
    player[field] = (player[field] || 0) + 1;
    player.errors += 1;
  } else {
    player[statKey] += 1;
  }

  saveState();
  renderAll();

  if (sourceButton) {
    pulse(sourceButton);
  }
  highlightRow(playerIndex);

  showDetails = false;
  renderActionButtons();
  renderLevelButtons();
}

function undoLastStat() {
  const action = actionStack.pop();
  if (!action) return;

  const game = state.games.find(g => g.id === action.gameId);
  if (!game) return;
  const set = (game.sets || []).find(s => s.id === action.setId);
  if (!set) return;
  const player = set.players[action.playerIndex];
  if (!player) return;

  if (action.errorType) {
    const field = `${action.errorType}Errors`;
    player[field] = Math.max(0, (player[field] || 0) - 1);
    player.errors = Math.max(0, (player.errors || 0) - 1);
  } else {
    player[action.statKey] = Math.max(0, (player[action.statKey] || 0) - 1);
  }

  saveState();
  renderAll();
}

/* ===== Helpers ===== */
function pulse(el) {
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

function highlightRow(index) {
  const rows = Array.from(statsTableBody.children);
  const row = rows[index];
  if (!row) return;
  row.classList.add("highlight");
  setTimeout(() => row.classList.remove("highlight"), 350);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.games) && data.games.length > 0) {
        const roster = Array.isArray(data.roster)
          ? data.roster.map(r => ({ name: r.name, number: r.number }))
          : null;
        const normalizedGames = data.games.map(g => normalizeGame(g));
        const fallbackRoster = !roster && normalizedGames[0] && normalizedGames[0].sets[0]
          ? normalizedGames[0].sets[0].players.map(p => ({ name: p.name, number: p.number }))
          : [];
        return {
          games: normalizedGames,
          activeGameId: data.activeGameId || data.games[0].id,
          roster: roster || fallbackRoster
        };
      }
    } catch {
      // fall through to legacy/default
    }
  }

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const legacyPlayers = JSON.parse(legacy);
      if (Array.isArray(legacyPlayers)) {
        const game = {
          id: cryptoRandomId(),
          name: "Game 1",
          createdAt: Date.now(),
          selectedIndex: 0,
          activeSetIndex: 0,
          sets: [
            {
              id: cryptoRandomId(),
              name: "Set 1",
              players: legacyPlayers.map(p => normalizePlayer(p))
            }
          ]
        };
        const nextState = {
          games: [game],
          activeGameId: game.id,
          roster: legacyPlayers.map(p => ({ name: p.name, number: p.number }))
        };
        localStorage.removeItem(LEGACY_KEY);
        return nextState;
      }
    } catch {
      // fall through
    }
  }

  const defaultGame = {
    id: cryptoRandomId(),
    name: "Game 1",
    createdAt: Date.now(),
    selectedIndex: 0,
    activeSetIndex: 0,
    sets: [
      {
        id: cryptoRandomId(),
        name: "Set 1",
        players: defaultPlayers.map(p => normalizePlayer(p))
      }
    ]
  };
  return {
    games: [defaultGame],
    activeGameId: defaultGame.id,
    roster: defaultPlayers.map(p => ({ name: p.name, number: p.number }))
  };
}

function normalizeGame(game) {
  if (Array.isArray(game.sets)) {
    return {
      id: game.id || cryptoRandomId(),
      name: game.name || "Game",
      createdAt: game.createdAt || Date.now(),
      selectedIndex: typeof game.selectedIndex === "number" ? game.selectedIndex : 0,
      activeSetIndex: typeof game.activeSetIndex === "number" ? game.activeSetIndex : 0,
      sets: game.sets.map(s => ({
        id: s.id || cryptoRandomId(),
        name: s.name || "Set",
        players: Array.isArray(s.players) ? s.players.map(p => normalizePlayer(p)) : []
      }))
    };
  }

  const players = Array.isArray(game.players) ? game.players.map(p => normalizePlayer(p)) : [];
  return {
    id: game.id || cryptoRandomId(),
    name: game.name || "Game",
    createdAt: game.createdAt || Date.now(),
    selectedIndex: typeof game.selectedIndex === "number" ? game.selectedIndex : 0,
    activeSetIndex: 0,
    sets: [
      {
        id: cryptoRandomId(),
        name: "Set 1",
        players
      }
    ]
  };
}

function normalizePlayer(p) {
  try {
    return {
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
    };
  } catch {
    return {
      name: "Player",
      number: 0,
      kills: 0,
      assists: 0,
      aces: 0,
      blocks: 0,
      digs: 0,
      errors: 0,
      attackErrors: 0,
      setErrors: 0,
      digErrors: 0
    };
  }
}

function getActiveGame() {
  return state.games.find(g => g.id === state.activeGameId) || state.games[0];
}

function getActiveSet(game) {
  if (!game || !Array.isArray(game.sets) || game.sets.length === 0) return null;
  return game.sets[game.activeSetIndex] || game.sets[0];
}

function createEmptyPlayer(name, number) {
  return {
    name,
    number,
    kills: 0,
    assists: 0,
    aces: 0,
    blocks: 0,
    digs: 0,
    errors: 0,
    attackErrors: 0,
    setErrors: 0,
    digErrors: 0
  };
}

function sPlayersLength(game) {
  const set = getActiveSet(game);
  return set ? set.players.length : 0;
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

function openConfirm(message, onConfirm) {
  pendingConfirm = onConfirm;
  confirmMessage.textContent = message;
  confirmOverlay.classList.add("open");
  confirmOverlay.setAttribute("aria-hidden", "false");
}

function closeConfirm() {
  pendingConfirm = null;
  confirmOverlay.classList.remove("open");
  confirmOverlay.setAttribute("aria-hidden", "true");
}
