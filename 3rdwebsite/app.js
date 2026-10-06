const API_URL = "https://my-fastapi-g-api.vercel.app";
const API_KEY = "student-api-key-123";

const FETCH_OPTIONS = {
    headers: {
        "x-api-key": API_KEY
    }
};

const HINT_AFTER = 6;      // guesses before the description hint unlocks
const MAX_SUGGESTIONS = 8;
const RECENT_LIMIT = 3;    // how many past mystery items are blocked from being picked again

// Every stat the game knows about. Only the "main" ones start as columns;
// the rest get a column the first time a guessed item has that stat.
const STATS = [
    { key: "attackDamage",     label: "AD",        unit: "", main: true },
    { key: "abilityPower",     label: "AP",        unit: "", main: true },
    { key: "health",           label: "Health",    unit: "", main: true },
    { key: "armor",            label: "Armor",     unit: "", main: true },
    { key: "magicResist",      label: "MR",        unit: "", main: true },
    { key: "mana",             label: "Mana",      unit: "" },
    { key: "attackSpeed",      label: "AS",        unit: "%" },
    { key: "critChance",       label: "Crit",      unit: "%" },
    { key: "abilityHaste",     label: "AH",        unit: "" },
    { key: "movementSpeed",    label: "MS",        unit: "" },
    { key: "lifeSteal",        label: "Lifesteal", unit: "%" },
    { key: "omnivamp",         label: "Omnivamp",  unit: "%" },
    { key: "lethality",        label: "Lethality", unit: "" },
    { key: "armorPenetration", label: "Armor Pen", unit: "%" },
    { key: "magicPenetration", label: "Magic Pen", unit: "" },
    { key: "tenacity",         label: "Tenacity",  unit: "%" }
];

// Item tier dropdown. "match" is checked against the item's tier/category text,
// case-insensitive. If your API uses different words, change them here.
const MODES = [
    { id: "all",       label: "All Items",       match: null },
    { id: "basic",     label: "Basic Items",     match: "basic" },
    { id: "epic",      label: "Epic Items",      match: "epic" },
    { id: "legendary", label: "Legendary Items", match: "legendary" }
];

const FALLBACK_IMG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#081118"/><polygon points="32,12 50,22 50,42 32,52 14,42 14,22" fill="none" stroke="#c8aa6e" stroke-width="2"/></svg>`
    );

// GAME STATE
let allItems = [];
let pool = [];             // items in the selected mode (secret + guesses come from here)
let activeMode = "all";
let secret = null;
let recentSecrets = [];    // ids of the last few mystery items, oldest first
let guesses = [];
let extraStatKeys = [];    // non-main stats that have been revealed by a guess, in order found
let newStatKeys = [];      // columns added by the most recent guess (for the highlight)
let gameOver = false;
let suggestions = [];
let activeSuggestion = -1;

// DOM
const modeSelectEl = document.getElementById("modeSelect");
const inputEl = document.getElementById("guessInput");
const suggestionsEl = document.getElementById("suggestions");
const messageEl = document.getElementById("message");
const rowsEl = document.getElementById("rows");
const boardEl = document.getElementById("board");
const headerRowEl = document.getElementById("headerRow");
const countEl = document.getElementById("guessCount");
const hintBoxEl = document.getElementById("hintBox");
const resultEl = document.getElementById("resultPanel");
const guessBtn = document.getElementById("guessBtn");
const giveUpBtn = document.getElementById("giveUpBtn");

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function norm(value) {
    return String(value ?? "").toLowerCase().trim();
}

function statValue(item, key) {
    return Number(item[key]) || 0;
}

/* ============================================================
   LOADING & GAME SETUP
   ============================================================ */

async function loadItems() {
    setMessage("Loading items...");
    setControlsDisabled(true);
    modeSelectEl.disabled = true;

    try {
        const response = await fetch(`${API_URL}/api/v1/items`, FETCH_OPTIONS);
        const data = await response.json();
        allItems = data.items || [];

        if (allItems.length < 2) {
            setMessage("Not enough items were returned by the API.", true);
            return;
        }

        console.log("Item categories:", [...new Set(allItems.map(i => i.category))]);

        renderModeSelect();
        modeSelectEl.disabled = false;
        startGame();
    } catch (error) {
        console.error(error);
        setMessage("Unable to connect to the API.", true);
    }
}

function getTierText(item) {
    return norm(item.tier ?? item.category);
}

function getPool(modeId) {
    const mode = MODES.find(m => m.id === modeId) || MODES[0];
    if (!mode.match) return allItems;
    return allItems.filter(item => getTierText(item).includes(mode.match));
}

function renderModeSelect() {
    modeSelectEl.innerHTML = MODES.map(mode => {
        const count = getPool(mode.id).length;
        const disabled = count < 2;
        return `<option value="${mode.id}" ${disabled ? "disabled" : ""}>${escapeHtml(mode.label)} (${count})</option>`;
    }).join("");

    modeSelectEl.value = activeMode;
}

function setMode(modeId) {
    if (modeId === activeMode) return;
    activeMode = modeId;
    startGame();
}

// Random pick that skips the last RECENT_LIMIT mystery items
function pickSecret() {
    let candidates = pool.filter(item => !recentSecrets.includes(item.id));

    // tiny pool: everything is "recent", so only avoid the very last item
    if (candidates.length === 0) {
        const lastId = recentSecrets[recentSecrets.length - 1];
        candidates = pool.filter(item => item.id !== lastId);
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];

    recentSecrets.push(picked.id);
    if (recentSecrets.length > RECENT_LIMIT) recentSecrets.shift();

    return picked;
}

function startGame() {
    pool = getPool(activeMode);

    if (pool.length < 2) {
        setControlsDisabled(true);
        setMessage("Not enough items in this mode. Try another one.", true);
        return;
    }

    secret = pickSecret();
    guesses = [];
    extraStatKeys = [];
    newStatKeys = [];
    gameOver = false;
    suggestions = [];
    activeSuggestion = -1;

    rowsEl.innerHTML = "";
    headerRowEl.innerHTML = "";
    boardEl.classList.add("hidden");
    hintBoxEl.classList.add("hidden");
    hintBoxEl.innerHTML = "";
    resultEl.classList.add("hidden");
    resultEl.innerHTML = "";
    inputEl.value = "";
    hideSuggestions();

    modeSelectEl.value = activeMode;
    setControlsDisabled(false);
    updateCount();
    setMessage("Type an item name to make your first guess.");
    inputEl.focus();
}

function setControlsDisabled(disabled) {
    inputEl.disabled = disabled;
    guessBtn.disabled = disabled;
    giveUpBtn.disabled = disabled;
}

function setMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.classList.toggle("error", isError);
}

function updateCount() {
    countEl.textContent = `Guesses: ${guesses.length}`;
}

/* ============================================================
   AUTOCOMPLETE
   ============================================================ */

// Which word of the name the query starts at: 0 = first word, 1 = second word, etc.
// Returns -1 if the query doesn't begin at the start of any word.
function matchWordIndex(name, query) {
    const text = norm(name);
    const wordStarts = [0];

    for (let i = 1; i < text.length; i++) {
        if ((text[i - 1] === " " || text[i - 1] === "-") && text[i] !== " ") {
            wordStarts.push(i);
        }
    }

    for (let w = 0; w < wordStarts.length; w++) {
        if (text.startsWith(query, wordStarts[w])) return w;
    }

    return -1;
}

function updateSuggestions() {
    const query = norm(inputEl.value);

    if (!query || gameOver) {
        hideSuggestions();
        return;
    }

    const guessedIds = new Set(guesses.map(g => g.id));

    // Prefix search: names starting with the typed letters come first, then items
    // where a later word starts with them (earlier words rank above later ones).
    suggestions = pool
        .filter(item => !guessedIds.has(item.id))
        .map(item => ({ item, rank: matchWordIndex(item.name, query) }))
        .filter(entry => entry.rank !== -1)
        .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name))
        .slice(0, MAX_SUGGESTIONS)
        .map(entry => entry.item);

    activeSuggestion = suggestions.length > 0 ? 0 : -1;
    renderSuggestions();
}

function renderSuggestions() {
    if (suggestions.length === 0) {
        if (norm(inputEl.value)) {
            suggestionsEl.innerHTML = `<li class="no-match">No matching items</li>`;
            suggestionsEl.classList.remove("hidden");
        } else {
            hideSuggestions();
        }
        return;
    }

    suggestionsEl.innerHTML = suggestions.map((item, index) => `
        <li class="${index === activeSuggestion ? "active" : ""}" data-index="${index}">
            <img src="${escapeHtml(item.image || FALLBACK_IMG)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
            <span>${escapeHtml(item.name)}</span>
        </li>
    `).join("");

    suggestionsEl.classList.remove("hidden");
}

function hideSuggestions() {
    suggestions = [];
    activeSuggestion = -1;
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
}

function moveSuggestion(direction) {
    if (suggestions.length === 0) return;
    activeSuggestion = (activeSuggestion + direction + suggestions.length) % suggestions.length;
    renderSuggestions();
}

/* ============================================================
   GUESSING
   ============================================================ */

function submitGuess() {
    if (gameOver) return;

    let item = null;

    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        item = suggestions[activeSuggestion];
    } else {
        const query = norm(inputEl.value);
        item = pool.find(i => norm(i.name) === query) || null;
    }

    if (!item) {
        setMessage("Pick an item from the list.", true);
        return;
    }

    if (guesses.some(g => g.id === item.id)) {
        setMessage("You already guessed that item.", true);
        return;
    }

    makeGuess(item);
}

function makeGuess(item) {
    guesses.push(item);

    // any non-main stat this item has that isn't a column yet becomes one
    newStatKeys = [];
    STATS.forEach(stat => {
        if (!stat.main && !extraStatKeys.includes(stat.key) && statValue(item, stat.key) > 0) {
            extraStatKeys.push(stat.key);
            newStatKeys.push(stat.key);
        }
    });

    inputEl.value = "";
    hideSuggestions();

    boardEl.classList.remove("hidden");
    renderBoard(true);

    updateCount();
    updateHint();

    if (item.id === secret.id) {
        endGame(true);
    } else if (newStatKeys.length > 0) {
        const names = newStatKeys.map(key => STATS.find(s => s.key === key).label).join(", ");
        setMessage(`New stat column added: ${names}.`);
        inputEl.focus();
    } else {
        setMessage("Not quite. Check the colors and try again.");
        inputEl.focus();
    }
}

function endGame(won) {
    gameOver = true;
    setControlsDisabled(true);
    hideSuggestions();

    // wait for the last row's flip animation to finish
    const delay = won ? (3 + getColumns().length) * 90 + 500 : 0;

    setTimeout(() => {
        resultEl.innerHTML = `
            <img src="${escapeHtml(secret.image || FALLBACK_IMG)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
            <div>
                <h2>${won ? "You got it!" : "Better luck next time"}</h2>
                <p>${won
                    ? `The item was <strong>${escapeHtml(secret.name)}</strong>. You found it in ${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"}.`
                    : `The item was <strong>${escapeHtml(secret.name)}</strong>.`}</p>
            </div>
            <button onclick="startGame()">Play Again</button>
        `;
        resultEl.classList.remove("hidden");
        resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, delay);

    setMessage(won ? "Correct!" : "Game over.");
}

function giveUp() {
    if (gameOver) return;
    endGame(false);
}

function updateHint() {
    if (guesses.length < HINT_AFTER || gameOver) return;

    // hide the item's own name inside the description so it isn't a giveaway
    const masked = String(secret.description ?? "")
        .split(new RegExp(secret.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"))
        .join("???");

    hintBoxEl.innerHTML = `<strong>Hint:</strong> ${escapeHtml(masked) || "No description available."}`;
    hintBoxEl.classList.remove("hidden");
}

/* ============================================================
   BOARD
   ============================================================ */

// main stats first (in STATS order), then revealed extras in the order they were found
function getColumns() {
    const main = STATS.filter(s => s.main);
    const extras = extraStatKeys.map(key => STATS.find(s => s.key === key));
    return [...main, ...extras];
}

function renderBoard(animateNewest) {
    const columns = getColumns();

    boardEl.style.setProperty("--stat-count", columns.length);

    headerRowEl.innerHTML = ["Item", "Category", "Price"]
        .map(label => `<div class="head-cell">${escapeHtml(label)}</div>`)
        .concat(columns.map(stat =>
            `<div class="head-cell ${newStatKeys.includes(stat.key) ? "new" : ""}">${escapeHtml(stat.label)}</div>`
        ))
        .join("");

    // rebuild every row so older guesses also get cells for any new column;
    // only the newest row plays the flip animation
    rowsEl.innerHTML = "";
    for (let i = guesses.length - 1; i >= 0; i--) {
        const isNewest = i === guesses.length - 1;
        rowsEl.appendChild(buildRow(guesses[i], columns, animateNewest && isNewest));
    }
}

function cellHtml(state, text, arrow, index) {
    return `
        <div class="cell ${state}" style="animation-delay:${index * 90}ms">
            <span class="val">${escapeHtml(text)}</span>
            ${arrow ? `<span class="arrow">${arrow}</span>` : ""}
        </div>
    `;
}

function buildRow(guess, columns, animate) {
    const row = document.createElement("div");
    row.className = "row" + (animate ? "" : " static");

    let index = 0;
    let html = "";

    // Item
    html += `
        <div class="cell cell-item" style="animation-delay:${index++ * 90}ms">
            <img src="${escapeHtml(guess.image || FALLBACK_IMG)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
            <span class="val">${escapeHtml(guess.name)}</span>
        </div>
    `;

    // Category (exact match only)
    const categoryMatch = guess.category === secret.category;
    html += cellHtml(categoryMatch ? "correct" : "wrong", guess.category || "None", "", index++);

    // Price (arrow shows where the secret item sits)
    const guessPrice = Number(guess.price) || 0;
    const secretPrice = Number(secret.price) || 0;
    if (guessPrice === secretPrice) {
        html += cellHtml("correct", `${guessPrice}g`, "", index++);
    } else {
        html += cellHtml("wrong", `${guessPrice}g`, secretPrice > guessPrice ? "▲" : "▼", index++);
    }

    // Stats
    columns.forEach(stat => {
        const g = statValue(guess, stat.key);
        const s = statValue(secret, stat.key);
        const display = g === 0 ? "\u2014" : `${g}${stat.unit}`;

        if (g === s) {
            html += cellHtml(g === 0 ? "none" : "correct", display, "", index++);
        } else if (g > 0 && s > 0) {
            html += cellHtml("close", display, s > g ? "▲" : "▼", index++);
        } else {
            html += cellHtml("wrong", display, "", index++);
        }
    });

    row.innerHTML = html;
    return row;
}

/* ============================================================
   EVENTS
   ============================================================ */

inputEl.addEventListener("input", () => {
    setMessage(gameOver ? messageEl.textContent : "Type an item name to guess.");
    updateSuggestions();
});

inputEl.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSuggestion(1);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestion(-1);
    } else if (event.key === "Enter") {
        event.preventDefault();
        submitGuess();
    } else if (event.key === "Escape") {
        hideSuggestions();
    }
});

// mousedown (not click) so it fires before the input loses focus
suggestionsEl.addEventListener("mousedown", event => {
    const li = event.target.closest("li[data-index]");
    if (!li) return;

    event.preventDefault();
    const item = suggestions[Number(li.dataset.index)];
    if (item) makeGuess(item);
});

document.addEventListener("click", event => {
    if (!event.target.closest(".guess-field")) hideSuggestions();
});

modeSelectEl.addEventListener("change", () => setMode(modeSelectEl.value));

guessBtn.addEventListener("click", submitGuess);
giveUpBtn.addEventListener("click", giveUp);

loadItems();
