const API_URL = "https://my-fastapi-g.vercel.app";
const API_KEY = "student-api-key-123";

const FETCH_OPTIONS = {
    headers: {
        "x-api-key": API_KEY
    }
};

const MAX_INVENTORY = 8;

// Card art image URL 
const CHARACTERS = [
    { id: "ezreal",    name: "Ezreal",     image: "https://riftdecks.com/img/cards/riftbound/SFD/sfd-149-221_full.png" },
    { id: "champion2", name: "Champion 2", image: "", locked: true },   // locked: can't be picked yet (remove `locked` to unlock)
    { id: "champion3", name: "Champion 3", image: "", locked: true }    // locked: can't be picked yet (remove `locked` to unlock)
];


const DIFFICULTIES = [
    { id: "easy",   label: "Easy",   count: 5 },
    { id: "medium", label: "Medium", count: 10 },
    { id: "hard",   label: "Hard",   count: 15 }
];
const TIER_PREFIX = ["", "Elite ", "Ancient "];

// Ezreal kit. 
const MANA_REGEN = 12;
const Q_COOLDOWN_MS = 1000;   // Q has a real-time cooldown (shortened by ability haste)

// Economy is based on item prices: "expected price" = average price of the items the next shop is
// likely to sell (it rises as the tier odds shift from basic to legendary).
const REWARD_RATIO = 0.6;          // round reward = 60% of the expected item price
const INTEREST_RATE = 0.08;        // interest = 8% of the gold you hold after the reward...
const INTEREST_CAP_RATIO = 0.5;    // ...capped at 50% of the expected item price

const roundTo = (value, step) => Math.round(value / step) * step;
const ABILITIES = {
    // damage = base + AD * ad + AP * ap, then reduced by the target's armor (physical) or magic resist (magic)
    q: { cost: 30,  cd: 0, base: 20,  ad: 1.6, ap: 0.15 },   // Mystic Shot (physical). A hit lowers other cooldowns by 1
    w: { cost: 40,  cd: 3, base: 50,  ad: 0.2, ap: 0.9  },   // Essence Flux (magic). Mark detonates on your next hit
    e: { cost: 50,  cd: 4, base: 25,  ad: 0.5, ap: 0.7  },   // Arcane Shift (magic bolt) + ignores next incoming hit
    r: { cost: 100, cd: 6, base: 180, ad: 1.0, ap: 1.1  }    // Trueshot Barrage (magic)
};

// Movement speed is now a chance to dodge (capped)
const MAX_DODGE = 60;
function dodgeChance(ms) {
    return Math.min(MAX_DODGE, Math.round((Number(ms) || 0) * 0.3));
}

const ITEM_STAT_MAP = {
    attackDamage: "ad",
    abilityPower: "ap",
    attackSpeed: "attackSpeed",
    health: "maxHp",
    mana: "maxMana",
    armor: "armor",
    magicResist: "magicResist",
    critChance: "critChance",
    abilityHaste: "abilityHaste",
    movementSpeed: "movementSpeed",
    lifeSteal: "lifeSteal",
    armorPenetration: "armorPenetration",
    magicPenetration: "magicPenetration",
    tenacity: "tenacity",
    omnivamp: "omnivamp"
};

const BASE_STATS = {
    maxHp: 500, maxMana: 300, ad: 15, ap: 0, armor: 20, magicResist: 20,
    critChance: 0, movementSpeed: 50, lifeSteal: 0, armorPenetration: 0,
    magicPenetration: 0, attackSpeed: 0, abilityHaste: 0, tenacity: 0, omnivamp: 0
};

const ENEMIES = [
    { name: "Training Dummy", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2XcaVzEk7JY1gtr4xkhfs6GUd6b09jw8hyW_sFgq-yg&s=10", maxHp: 150, ad: 10, ap: 0, armor: 0, magicResist: 0, movementSpeed: 10, goldReward: 150 },
    { name: "Rift Scuttler", image: "https://riftdecks.com/img/cards/riftbound/UNL/unl-053-219_full.png", maxHp: 220, ad: 18, ap: 0, armor: 10, magicResist: 10, movementSpeed: 40, goldReward: 220 },
    { name: "Blue Sentinel", image: "https://riftdecks.com/img/cards/riftbound/UNL/unl-087a-219_full.png", maxHp: 320, ad: 0, ap: 30, armor: 15, magicResist: 25, movementSpeed: 30, goldReward: 350 },
    { name: "Siege Minion Elite", image: "", maxHp: 420, ad: 35, ap: 0, armor: 25, magicResist: 10, movementSpeed: 20, goldReward: 450 },
    { name: "Baron Nashor", image: "https://riftdecks.com/img/cards/riftbound/UNL/unl-147-219_full.png", maxHp: 600, ad: 30, ap: 25, armor: 35, magicResist: 35, movementSpeed: 45, goldReward: 690 }
];

let allItems = [];
let equippedItems = [];
let player = null;
let enemy = null;
let roundIndex = 0;
let gold = 1300;
let playerTurn = true;
let combatOver = false;
let shopOpen = false;
let currentOffers = [];
let cooldowns = { q: 0, w: 0, e: 0, r: 0 };
let qLockUntil = 0;
let interestNote = "";
let shopOdds = "";
let soldStack = [];     // every item sold this shop visit, newest last (for Undo)
let rerollCount = 0;
let enemies = [];
let character = CHARACTERS[0];
let difficulty = DIFFICULTIES[0];

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function computePlayerStats() {
    const stats = { ...BASE_STATS };

    equippedItems.forEach(item => {
        if (isPotion(item)) return;
        for (const apiKey in ITEM_STAT_MAP) {
            const statKey = ITEM_STAT_MAP[apiKey];
            stats[statKey] += Number(item[apiKey]) || 0;
        }
    });

    return stats;
}

function logMessage(text) {
    const log = document.getElementById("battleLog");
    const p = document.createElement("p");
    p.textContent = text;

    let cls = "";
    if (/^(You (attack|dodge)|Mystic Shot|Essence Flux|Arcane Shift|Trueshot)/.test(text)) cls = "log-player";
    else if (/^(Bought|Sold|Interest)|defeated/.test(text)) cls = "log-gold";
    else if (enemy && text.startsWith(enemy.name)) cls = "log-enemy";
    else if (/appears/.test(text)) cls = "log-info";
    if (text.includes("CRIT")) cls += " log-crit";
    p.className = cls;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
}

function physicalDamage(attackerAd, attackerArmorPen, attackerCrit, attackerLifesteal, attackerOmnivamp, defenderArmor) {
    const effectiveArmor = Math.max(0, defenderArmor - attackerArmorPen);
    const reduction = effectiveArmor / (effectiveArmor + 100);
    let damage = attackerAd;

    const isCrit = Math.random() * 100 < attackerCrit;
    if (isCrit) damage *= 1.5;

    damage = Math.max(1, Math.round(damage * (1 - reduction)));
    const heal = Math.round(damage * ((attackerLifesteal + attackerOmnivamp) / 100));

    return { damage, isCrit, heal };
}

function magicDamage(attackerAp, attackerMagicPen, attackerOmnivamp, defenderMr) {
    const effectiveMr = Math.max(0, defenderMr - attackerMagicPen);
    const reduction = effectiveMr / (effectiveMr + 100);
    let damage = attackerAp * 0.6;

    damage = Math.max(1, Math.round(damage * (1 - reduction)));
    const heal = Math.round(damage * (attackerOmnivamp / 100));

    return { damage, heal };
}

function flash(id, type = "hit") {
    const el = document.getElementById(id);
    el.classList.remove("hit", "heal");
    void el.offsetWidth;
    el.classList.add(type);
}

// Stats now update live while shopping (HP/mana are kept, capped to the new max)
function refreshPlayerStats() {
    if (!player) return;
    const stats = computePlayerStats();
    player = {
        ...player,
        ...stats,
        hp: Math.min(player.hp, stats.maxHp),
        mana: Math.min(player.mana, stats.maxMana)
    };
}

function startCombat() {
    const stats = computePlayerStats();

    player = {
        ...stats,
        hp: player ? Math.min(player.hp, stats.maxHp) : stats.maxHp,
        mana: stats.maxMana,
        defending: false,
        shielded: false,
        revived: false
    };

    const base = enemies[roundIndex];
    enemy = { ...base, hp: base.maxHp, defending: false, marked: false };

    combatOver = false;
    document.getElementById("shopPanel").classList.add("hidden");
    document.getElementById("gameOverPanel").classList.add("hidden");
    document.getElementById("abilityBar").classList.remove("hidden");

    document.getElementById("battleLog").innerHTML = "";
    logMessage(`A ${enemy.name} appears!`);
    playerTurn = true;
    render();

    if (!playerTurn) {
        setTimeout(enemyAction, 600);
    }
}

// Attack speed: every AS_PER_ATTACK points = one extra attack per Attack action.
// The leftover points are the chance (leftover / AS_PER_ATTACK) of one more.
const AS_PER_ATTACK = 50;

function attackCount() {
    const as = Math.max(0, Number(player.attackSpeed) || 0);
    let count = 1 + Math.floor(as / AS_PER_ATTACK);
    if (Math.random() * AS_PER_ATTACK < as % AS_PER_ATTACK) count++;
    return count;
}

// Ability haste shortens cooldowns: base * 100 / (100 + AH)  (fractions of a turn round up when shown)
function hastedCooldown(base) {
    const ah = Math.max(0, Number(player.abilityHaste) || 0);
    return Math.round((base * 100 / (100 + ah)) * 100) / 100;
}

// raw (unmitigated) ability damage from the ratio table above
function abilityRaw(key) {
    const a = ABILITIES[key];
    return a.base + player.ad * a.ad + player.ap * a.ap;
}

function mitigatePhysical(raw, pen, armor) {
    const eff = Math.max(0, armor - pen);
    return Math.max(1, Math.round(raw * (1 - eff / (eff + 100))));
}

function mitigateMagic(raw, pen, mr) {
    const eff = Math.max(0, mr - pen);
    return Math.max(1, Math.round(raw * (1 - eff / (eff + 100))));
}

function healPlayer(amount) {
    if (amount > 0) player.hp = Math.min(player.maxHp, player.hp + amount);
}

function omnivampHeal(damage) {
    const heal = Math.round(damage * player.omnivamp / 100);
    healPlayer(heal);
    return heal;
}

// the enemy can dodge anything the player throws at it
function enemyDodges(label) {
    if (Math.random() * 100 < dodgeChance(enemy.movementSpeed)) {
        logMessage(`${enemy.name} dodges ${label}!`);
        return true;
    }
    return false;
}

// W mark: the next ability or attack that hits the target detonates it
function detonateMark() {
    if (!enemy.marked) return;
    enemy.marked = false;

    const raw = abilityRaw("w");
    const damage = mitigateMagic(raw, player.magicPenetration, enemy.magicResist);
    enemy.hp = Math.max(0, enemy.hp - damage);
    omnivampHeal(damage);
    logMessage(`Essence Flux detonates for ${damage} magic damage!`);
}

function useAbility(key) {
    if (key === "q" && Date.now() < qLockUntil) return false;

    if (cooldowns[key] > 0) {
        logMessage(`${key.toUpperCase()} is on cooldown.`);
        return false;
    }
    if (player.mana < ABILITIES[key].cost) {
        logMessage("Not enough mana.");
        return false;
    }
    player.mana -= ABILITIES[key].cost;
    cooldowns[key] = hastedCooldown(ABILITIES[key].cd);

    if (key === "q") {
        const ms = hastedCooldown(Q_COOLDOWN_MS);
        qLockUntil = Date.now() + ms;
        setTimeout(() => { if (player) render(); }, ms + 30);
    }
    return true;
}

function playerAction(action) {
    if (!player || !enemy || combatOver || !playerTurn) return;

    player.defending = false;
    const hpBefore = enemy.hp;

    if (action === "attack") {
        const total = attackCount();

        for (let i = 1; i <= total && enemy.hp > 0; i++) {
            const tag = total > 1 ? ` (${i}/${total})` : "";

            if (enemyDodges("your attack" + tag)) continue;

            const result = physicalDamage(player.ad, player.armorPenetration, player.critChance, player.lifeSteal, player.omnivamp, enemy.armor);
            enemy.hp = Math.max(0, enemy.hp - result.damage);
            healPlayer(result.heal);
            logMessage(`You attack${tag} for ${result.damage}${result.isCrit ? " (CRIT!)" : ""}.` + (result.heal ? ` Lifesteal heals ${result.heal}.` : ""));
            detonateMark();
        }

    } else if (action === "q") {
        if (!useAbility("q")) return;
        if (!enemyDodges("Mystic Shot")) {
            const raw = abilityRaw("q");
            const damage = mitigatePhysical(raw, player.armorPenetration, enemy.armor);
            enemy.hp = Math.max(0, enemy.hp - damage);
            const heal = omnivampHeal(damage);
            logMessage(`Mystic Shot hits for ${damage} physical damage.` + (heal ? ` Omnivamp heals ${heal}.` : ""));
            detonateMark();
            ["w", "e", "r"].forEach(k => cooldowns[k] = Math.max(0, cooldowns[k] - 1));
        }

    } else if (action === "w") {
        if (!useAbility("w")) return;
        if (!enemyDodges("Essence Flux")) {
            enemy.marked = true;
            logMessage("Essence Flux marks the target. Your next attack or ability detonates it.");
        }

    } else if (action === "e") {
        if (!useAbility("e")) return;
        player.shielded = true;
        const raw = abilityRaw("e");
        const damage = mitigateMagic(raw, player.magicPenetration, enemy.magicResist);
        enemy.hp = Math.max(0, enemy.hp - damage);
        omnivampHeal(damage);
        logMessage(`Arcane Shift: you blink and fire a bolt for ${damage} magic damage. The next attack or ability against you is ignored.`);
        detonateMark();

    } else if (action === "r") {
        if (!useAbility("r")) return;
        if (!enemyDodges("Trueshot Barrage")) {
            const raw = abilityRaw("r");
            const damage = mitigateMagic(raw, player.magicPenetration, enemy.magicResist);
            enemy.hp = Math.max(0, enemy.hp - damage);
            const heal = omnivampHeal(damage);
            logMessage(`Trueshot Barrage hits for ${damage} magic damage!` + (heal ? ` Omnivamp heals ${heal}.` : ""));
            detonateMark();
        }

    }

    const charmMana = equippedItems.reduce((sum, item) => sum + itemManaPerAction(item), 0);
    if (charmMana > 0) player.mana = Math.min(player.maxMana, player.mana + charmMana);

    render();
    if (enemy.hp < hpBefore) flash("enemyPanel");

    if (enemy.hp <= 0) {
        winCombat();
        return;
    }

    playerTurn = false;
    setTimeout(enemyAction, 600);
}

// Guardian Angel: when your HP hits 0 you revive with 50% HP and full mana.
// It can trigger once per fight (it is ready again at the start of the next round).
const GUARDIAN_RE = /guardian angel/i;
const GUARDIAN_REVIVE_HP = 0.5;

function hasGuardianAngel() {
    return equippedItems.some(item => GUARDIAN_RE.test(String(item.name ?? "")));
}

function tryGuardianRevive() {
    if (player.revived || !hasGuardianAngel()) return false;

    player.revived = true;
    player.hp = Math.max(1, Math.round(player.maxHp * GUARDIAN_REVIVE_HP));
    player.mana = player.maxMana;
    logMessage(`Guardian Angel revives you! Restored ${player.hp} HP and all your mana.`);
    flash("playerPanel", "heal");
    return true;
}

function enemyAction() {
    if (combatOver) return;

    const isPhysical = enemy.ad >= enemy.ap;
    const label = isPhysical ? "attack" : "ability";

    if (player.shielded) {
        player.shielded = false;
        logMessage(`Arcane Shift: you blink away from ${enemy.name}'s ${label}!`);
    } else if (Math.random() * 100 < dodgeChance(player.movementSpeed)) {
        logMessage(`You dodge ${enemy.name}'s ${label}!`);
    } else {
        if (isPhysical) {
            const armor = player.armor + (player.defending ? player.armor * 0.5 : 0);
            const result = physicalDamage(enemy.ad, 0, 0, 0, 0, armor);
            player.hp = Math.max(0, player.hp - result.damage);
            logMessage(`${enemy.name} attacks for ${result.damage}.`);
        } else {
            const mr = player.magicResist + (player.defending ? player.magicResist * 0.5 : 0);
            const result = magicDamage(enemy.ap, 0, 0, mr);
            player.hp = Math.max(0, player.hp - result.damage);
            logMessage(`${enemy.name} casts for ${result.damage} magic damage.`);
        }
        flash("playerPanel");
    }

    if (player.hp <= 0 && !tryGuardianRevive()) {
        render();
        loseCombat();
        return;
    }

    // start of the player's next turn
    Object.keys(cooldowns).forEach(k => cooldowns[k] = Math.max(0, cooldowns[k] - 1));
    player.mana = Math.min(player.maxMana, player.mana + MANA_REGEN);
    playerTurn = true;
    render();
}

async function ensureItems() {
    if (allItems.length > 0) return true;

    try {
        const response = await fetch(`${API_URL}/api/v1/items`, FETCH_OPTIONS);
        const data = await response.json();
        allItems = data.items || [];
    } catch (error) {
        console.error(error);
    }

    return allItems.length > 0;
}

function averagePrice(list) {
    return list.length ? list.reduce((sum, price) => sum + price, 0) / list.length : 0;
}

// average item price the next shop is expected to sell, weighted by the current tier odds
function expectedItemPrice() {
    const byTier = { basic: [], epic: [], legendary: [] };

    allItems
        .filter(item => !isPotion(item) && Number(item.price) > 0)
        .forEach(item => byTier[getItemTier(item)].push(Number(item.price)));

    const overall = averagePrice([].concat(byTier.basic, byTier.epic, byTier.legendary)) || 500;
    const odds = getTierOdds();

    return (
        odds.basic * (averagePrice(byTier.basic) || overall) +
        odds.epic * (averagePrice(byTier.epic) || overall) +
        odds.legendary * (averagePrice(byTier.legendary) || overall)
    ) / 100;
}

async function winCombat() {
    combatOver = true;
    document.getElementById("abilityBar").classList.add("hidden");

    // last enemy: the run is over, so no shop
    if (roundIndex >= enemies.length - 1) {
        logMessage(`${enemy.name} defeated!`);
        render();
        document.getElementById("gameOverTitle").textContent = "You cleared the Rift!";
        document.getElementById("gameOverPanel").classList.remove("hidden");
        return;
    }

    await ensureItems();

    const price = expectedItemPrice();

    const reward = roundTo(price * REWARD_RATIO, 10);
    gold += reward;
    logMessage(`${enemy.name} defeated! +${reward} gold.`);

    const cap = roundTo(price * INTEREST_CAP_RATIO, 5);
    const interest = Math.min(cap, Math.floor(gold * INTEREST_RATE));
    if (interest > 0) {
        gold += interest;
        logMessage(`Interest: +${interest} gold (${Math.round(INTEREST_RATE * 100)}% of gold held, max ${cap}).`);
    }

    interestNote = `Round reward +${reward} gold` + (interest > 0 ? `, interest +${interest} gold (${Math.round(INTEREST_RATE * 100)}% of gold held, max ${cap}).` : ".");

    openShop();
}

function loseCombat() {
    combatOver = true;
    document.getElementById("abilityBar").classList.add("hidden");
    document.getElementById("gameOverPanel").classList.remove("hidden");
    document.getElementById("gameOverTitle").textContent = `Defeated by ${enemy.name}`;
}

/* ============================================================
   SHOP (buy + sell)
   ============================================================ */


const SHOP_SIZE = 6;

const POTION_CHANCE = 0.65;            // chance a Health Potion is added to the shop each time it opens or rerolls
const POTION_HEALS = [50, 100, 200];   // one is picked at random when you use it
const POTION_USES_TURN = false;        // true = using a potion also ends your turn
const FAERIE_MANA_PER_ACTION = 15;     // mana restored after each of your actions per Faerie Charm
const REROLL_BASE = 5;
const REROLL_STEP = 2;

const POTION_RE = /health potion/i;
const FAERIE_RE = /f(?:ae|ee|ai|ei|a|e)?rie charm|fairy charm/i;

function isPotion(item) {
    return POTION_RE.test(String(item.name ?? ""));
}

function itemManaPerAction(item) {
    return FAERIE_RE.test(String(item.name ?? "")) ? FAERIE_MANA_PER_ACTION : 0;
}

// ---- potion stacking: MAX_POTIONS ----
const MAX_POTIONS = 3;

function potionStack() {
    return equippedItems.find(isPotion);
}

// Boots and legendary items are unique: you can only own one copy of each
const BOOTS_RE = /boots|greaves|treads|steelcaps|shoes/i;

function isBoots(item) {
    return BOOTS_RE.test(String(item.name ?? "")) || /boots/i.test(String(item.category ?? item.tier ?? ""));
}

function isUnique(item) {
    return !isPotion(item) && (isBoots(item) || getItemTier(item) === "legendary");
}

function ownsItem(item) {
    return equippedItems.some(owned => owned.id === item.id);
}

function canHold(item) {
    if (isUnique(item) && ownsItem(item)) return false;
    if (isPotion(item)) {
        const stack = potionStack();
        return stack ? stack.count < MAX_POTIONS : equippedItems.length < MAX_INVENTORY;
    }
    return equippedItems.length < MAX_INVENTORY;
}

function addItem(item, index = equippedItems.length) {
    if (isPotion(item)) {
        const stack = potionStack();
        if (stack) { stack.count++; return; }
        equippedItems.splice(Math.min(index, equippedItems.length), 0, { ...item, count: 1 });
        return;
    }
    equippedItems.splice(Math.min(index, equippedItems.length), 0, item);
}

function removeOne(index) {
    const item = equippedItems[index];
    if (isPotion(item) && item.count > 1) item.count--;
    else equippedItems.splice(index, 1);
}

function rerollCost() {
    return REROLL_BASE + REROLL_STEP * rerollCount;
}
const TIER_ODDS = [
    { t: 0,   basic: 100, epic: 0,  legendary: 0  },   // early game: basic only
    { t: 0.5, basic: 25,  epic: 60, legendary: 15 },   // mid game: mostly epic
    { t: 1,   basic: 0,   epic: 25, legendary: 75 }    // end game: mostly legendary
];

function getItemTier(item) {
    const text = String(item.tier ?? item.category ?? "").toLowerCase();
    if (text.includes("legendary")) return "legendary";
    if (text.includes("epic")) return "epic";
    return "basic";   // basic, and anything that isn't epic/legendary
}

function getTierOdds() {
    const lastShop = Math.max(1, enemies.length - 2);   // the shop after the final fight is never used
    const t = Math.min(1, roundIndex / lastShop);

    for (let i = 1; i < TIER_ODDS.length; i++) {
        const a = TIER_ODDS[i - 1];
        const b = TIER_ODDS[i];
        if (t <= b.t) {
            const f = (t - a.t) / (b.t - a.t);
            const mix = key => a[key] + (b[key] - a[key]) * f;
            return { basic: mix("basic"), epic: mix("epic"), legendary: mix("legendary") };
        }
    }

    const last = TIER_ODDS[TIER_ODDS.length - 1];
    return { basic: last.basic, epic: last.epic, legendary: last.legendary };
}

function oddsText() {
    const odds = getTierOdds();
    return `Item odds this round: `
        + `<span class="odds-basic">Basic ${Math.round(odds.basic)}%</span> | `
        + `<span class="odds-epic">Epic ${Math.round(odds.epic)}%</span> | `
        + `<span class="odds-legendary">Legendary ${Math.round(odds.legendary)}%</span>`
        + (allItems.some(isPotion) ? ` | <span class="odds-potion">Health Potion ${Math.round(POTION_CHANCE * 100)}%</span>` : "");
}

function rollOffers() {
    const odds = getTierOdds();
    const buckets = { basic: [], epic: [], legendary: [] };

    allItems
        .filter(item => !isPotion(item) && !(isUnique(item) && ownsItem(item)))
        .forEach(item => buckets[getItemTier(item)].push(item));
    Object.values(buckets).forEach(list => list.sort(() => Math.random() - 0.5));

    const offers = [];

    // Health Potion: its own roll, independent of the tier odds
    const potions = allItems.filter(isPotion);
    if (potions.length > 0 && Math.random() < POTION_CHANCE) {
        offers.push(potions[Math.floor(Math.random() * potions.length)]);
    }

    while (offers.length < SHOP_SIZE) {
        // only tiers that still have items can be rolled
        const available = Object.keys(buckets).filter(tier => buckets[tier].length > 0);
        if (available.length === 0) break;

        let weights = available.map(tier => odds[tier]);
        let total = weights.reduce((sum, w) => sum + w, 0);
        if (total <= 0) {
            weights = available.map(() => 1);
            total = available.length;
        }

        let roll = Math.random() * total;
        let chosen = available[available.length - 1];
        for (let j = 0; j < available.length; j++) {
            roll -= weights[j];
            if (roll < 0) {
                chosen = available[j];
                break;
            }
        }

        offers.push(buckets[chosen].pop());
    }

    return offers.sort(() => Math.random() - 0.5);
}

const SHORT_STATS = {
    attackDamage: "AD", abilityPower: "AP", health: "HP", armor: "Armor", magicResist: "MR",
    mana: "Mana", attackSpeed: "AS%", critChance: "Crit%", lifeSteal: "LS%", omnivamp: "Omni%",
    movementSpeed: "MS", armorPenetration: "ArPen%", magicPenetration: "MPen",
    lethality: "Leth", abilityHaste: "AH", tenacity: "Ten%"
};

function shopStats(item) {
    const lines = isPotion(item) ? ["Heals 50 / 100 / 200"] : itemStatLines(item);
    return `<div class="chips">${lines.map(line => `<span>${escapeHtml(line)}</span>`).join("")}</div>`;
}

// Use the API's sellPrice if the list endpoint returns it, otherwise 70% of the buy price
function getSellPrice(item) {
    if (item.sellPrice !== undefined && item.sellPrice !== null) {
        return Number(item.sellPrice);
    }
    return Math.floor(Number(item.price) * 0.7);
}

async function openShop() {
    if (allItems.length === 0) {
        try {
            const response = await fetch(`${API_URL}/api/v1/items`, FETCH_OPTIONS);
            const data = await response.json();
            allItems = data.items || [];
        } catch (error) {
            console.error(error);
            logMessage("Couldn't reach the shop.");
            return;
        }
    }

    // Pick the offers once per shop visit
    rerollCount = 0;
    currentOffers = rollOffers();
    shopOdds = oddsText();

    document.getElementById("shopPanel").classList.remove("hidden");
    renderShop();
}

function renderShop() {
    refreshPlayerStats();
    document.getElementById("interestNote").textContent = interestNote;
    document.getElementById("oddsNote").innerHTML = shopOdds;

    const rerollBtn = document.getElementById("rerollBtn");
    rerollBtn.textContent = `Reroll (${rerollCost()} gold)`;
    rerollBtn.disabled = gold < rerollCost();

    const undoBtn = document.getElementById("undoBtn");
    const lastSale = soldStack[soldStack.length - 1];
    undoBtn.textContent = soldStack.length ? `Undo (${soldStack.length})` : "Undo";
    undoBtn.disabled = !lastSale || gold < lastSale.price || !canHold(lastSale.item);
    undoBtn.title = lastSale ? `Take back ${lastSale.item.name} for ${lastSale.price} gold` : "Nothing to undo";

    document.getElementById("shopItems").innerHTML = currentOffers.map(item => {
        const full = !canHold(item);
        const label = !full ? "Buy"
            : isPotion(item) ? "Max Potions"
            : (isUnique(item) && ownsItem(item)) ? "Owned"
            : "Inventory Full";
        return `
        <div class="shop-item">
            <img src="${escapeHtml(item.image)}" alt="">
            <h3>${escapeHtml(item.name)}</h3>
            ${shopStats(item)}
            <div class="price">${item.price} Gold</div>
            <button ${gold < item.price || full ? "disabled" : ""} onclick="buyItem(${item.id})">
                ${label}
            </button>
        </div>`;
    }).join("");

    const sellEl = document.getElementById("sellItems");

    if (equippedItems.length === 0) {
        sellEl.innerHTML = `<p class="empty-msg">You have nothing to sell.</p>`;
    } else {
        sellEl.innerHTML = equippedItems.map((item, index) => `
            <div class="shop-item" title="${escapeHtml(itemStatLines(item).join(", ") || "No stats")}">
                <img src="${escapeHtml(item.image)}" alt="">
                <h3>${escapeHtml(item.name)}${item.count > 1 ? ` x${item.count}` : ""}</h3>
            ${shopStats(item)}
                <div class="price">Sells for ${getSellPrice(item)} Gold</div>
                <button class="sell-btn" onclick="sellItem(${index})">Sell</button>
            </div>
        `).join("");
    }

    render();
}

function buyItem(id) {
    const item = allItems.find(i => i.id === id);

    if (!item || gold < item.price || !canHold(item)) return;

    gold -= item.price;
    addItem(item);
    logMessage(`Bought ${item.name}.`);
    renderShop();
}

function rerollShop() {
    const cost = rerollCost();
    if (gold < cost) return;

    gold -= cost;
    rerollCount++;
    currentOffers = rollOffers();
    renderShop();
}

// Takes back the most recent sale: the item returns to its old slot for exactly the gold it paid out
function undoSell() {
    const last = soldStack[soldStack.length - 1];
    if (!last || gold < last.price || !canHold(last.item)) return;

    soldStack.pop();
    gold -= last.price;
    addItem(last.item, last.index);
    logMessage(`Undid the sale of ${last.item.name}.`);
    renderShop();
}

function sellItem(index) {
    const item = equippedItems[index];
    if (!item) return;

    const value = getSellPrice(item);
    gold += value;
    soldStack.push({ item: { ...item, count: 1 }, index, price: value });
    removeOne(index);
    logMessage(`Sold ${item.name} for ${value} gold.`);
    renderShop();
}

function startNextRound() {
    soldStack = [];
    roundIndex++;

    if (roundIndex >= enemies.length) {
        document.getElementById("shopPanel").classList.add("hidden");
        document.getElementById("gameOverPanel").classList.remove("hidden");
        document.getElementById("gameOverTitle").textContent = "You cleared the Rift!";
        return;
    }

    startCombat();
}

/* ============================================================
   RENDER
   ============================================================ */

function buildEnemies(count) {
    return Array.from({ length: count }, (_, i) => {
        const base = ENEMIES[i % ENEMIES.length];
        const loop = Math.floor(i / ENEMIES.length);
        const scale = value => Math.round(value * (1 + loop * 0.75));

        return {
            ...base,
            name: (TIER_PREFIX[loop] || "") + base.name,
            maxHp: scale(base.maxHp),
            ad: scale(base.ad),
            ap: scale(base.ap),
            armor: scale(base.armor),
            magicResist: scale(base.magicResist),
            goldReward: scale(base.goldReward)
        };
    });
}

function resetRun() {
    equippedItems = [];
    gold = 1300;
    roundIndex = 0;
    player = null;
    enemy = null;
    cooldowns = { q: 0, w: 0, e: 0, r: 0 };
    qLockUntil = 0;
    interestNote = "";
    soldStack = [];
    combatOver = true;
    playerTurn = false;

    document.getElementById("battleLog").innerHTML = "";
    document.getElementById("shopPanel").classList.add("hidden");
    document.getElementById("gameOverPanel").classList.add("hidden");
}

function startRun() {
    resetRun();
    enemies = buildEnemies(difficulty.count);
    startCombat();
}

function showCharacterSelect() {
    document.getElementById("difficultyPanel").classList.add("hidden");
    document.getElementById("gameOverPanel").classList.add("hidden");

    document.getElementById("characterChoices").innerHTML = CHARACTERS.map(c => `
        <button class="choice-card ${c.id === character.id ? "selected" : ""}${c.locked ? " locked" : ""}"
                ${c.locked ? "disabled" : ""} onclick="selectCharacter('${c.id}')">
            <img src="${escapeHtml(c.image || placeholderCard(c.name))}" alt="${escapeHtml(c.name)}"
                 referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=placeholderCard(this.alt)">
            <span class="choice-name">${escapeHtml(c.name)}${c.locked ? " (Locked)" : ""}</span>
        </button>
    `).join("");

    document.getElementById("characterPanel").classList.remove("hidden");
}

function selectCharacter(id) {
    const picked = CHARACTERS.find(c => c.id === id);
    if (picked && picked.locked) return;
    character = picked || CHARACTERS[0];
    document.getElementById("characterPanel").classList.add("hidden");
    showDifficultySelect();
}

function showDifficultySelect() {
    document.getElementById("characterPanel").classList.add("hidden");
    document.getElementById("gameOverPanel").classList.add("hidden");
    document.getElementById("difficultySub").textContent = `Playing as ${character.name}`;

    document.getElementById("difficultyChoices").innerHTML = DIFFICULTIES.map(d => `
        <button class="choice-card ${d.id === difficulty.id ? "selected" : ""}" onclick="selectDifficulty('${d.id}')">
            <span class="choice-big">${escapeHtml(d.label)}</span>
            <span class="choice-sub">${d.count} enemies</span>
        </button>
    `).join("");

    document.getElementById("difficultyPanel").classList.remove("hidden");
}

function selectDifficulty(id) {
    difficulty = DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[0];
    document.getElementById("difficultyPanel").classList.add("hidden");
    startRun();
}

function placeholderCard(label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350">
        <rect x="2" y="2" width="246" height="346" rx="14" fill="#0d1920" stroke="#c8aa6e" stroke-width="4"/>
        <polygon points="125,95 175,123 175,180 125,208 75,180 75,123" fill="none" stroke="#c8aa6e" stroke-width="3"/>
        <text x="125" y="272" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#f0e6d2">${escapeHtml(label)}</text>
        <text x="125" y="302" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#6b7c88">Add card image</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// Sets a card image once; falls back to the placeholder if the URL is empty or fails to load
function setCard(id, url, label) {
    const img = document.getElementById(id);
    const fallback = placeholderCard(label);
    const wanted = url || fallback;

    if (img.dataset.wanted === wanted) return;

    img.dataset.wanted = wanted;
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    img.src = wanted;
}

// Stats shown on a fighter card: a small core set for both sides, then any extra stat
// (crit, lifesteal, AH...) is added as soon as the unit has it.
const EXTRA_STATS = [
    ["critChance", "Crit", "%"],
    ["lifeSteal", "Lifesteal", "%"],
    ["omnivamp", "Omnivamp", "%"],
    ["abilityHaste", "AH", ""],
    ["armorPenetration", "Armor Pen", ""],
    ["magicPenetration", "Magic Pen", ""],
    ["tenacity", "Tenacity", "%"]
];

function statGridHtml(unit) {
    const rows = [
        ["AD", unit.ad],
        ["AP", unit.ap],
        ["Armor", unit.armor],
        ["MR", unit.magicResist]
    ];

    EXTRA_STATS.forEach(([key, label, suffix]) => {
        const value = Number(unit[key]) || 0;
        if (value > 0) rows.push([label, value + suffix]);
    });

    const ms = Number(unit.movementSpeed) || 0;
    const as = Math.max(0, Number(unit.attackSpeed) || 0);
    const atkPerTurn = Number((1 + as / AS_PER_ATTACK).toFixed(2));

    const html = rows.map(([label, value]) => `<div>${label}: ${value}</div>`).join("");
    return html
        + `<div class="wide">MS: ${ms} (dodge: ${dodgeChance(ms)}%)</div>`
        + `<div class="wide">AS: ${as} (${atkPerTurn} atk/turn)</div>`;
}

function render() {
    document.getElementById("goldAmount").textContent = gold;
    document.getElementById("shopGold").textContent = gold;
    document.getElementById("roundLabel").textContent = `Round ${Math.min(roundIndex + 1, enemies.length)} / ${enemies.length}`;
    document.getElementById("turnLabel").textContent = combatOver ? "Shop" : (playerTurn ? "Your turn" : "Enemy turn");

    document.getElementById("playerHpFill").style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById("playerHpLabel").textContent = `HP ${player.hp} / ${player.maxHp}`;
    document.getElementById("playerManaFill").style.width = `${(player.mana / player.maxMana) * 100}%`;
    document.getElementById("playerManaLabel").textContent = `Mana ${player.mana} / ${player.maxMana}`;

    document.getElementById("playerStats").innerHTML = statGridHtml(player);

    document.getElementById("enemyName").textContent = enemy.name + (enemy.marked ? " (Marked)" : "");
    document.getElementById("playerName").textContent = character.name + (player.shielded ? " (Shielded)" : "");
    setCard("playerCard", character.image, character.name);
    setCard("enemyCard", enemy.image, enemy.name);
    document.getElementById("enemyHpFill").style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    document.getElementById("enemyHpLabel").textContent = `HP ${enemy.hp} / ${enemy.maxHp}`;
    document.getElementById("enemyStats").innerHTML = statGridHtml(enemy);

    document.getElementById("attackBtn").disabled = !playerTurn || combatOver;
    ["q", "w", "e", "r"].forEach(key => {
        const btn = document.getElementById(key + "Btn");
        const cd = cooldowns[key];
        const timeLeft = key === "q" ? qLockUntil - Date.now() : 0;
        btn.disabled = !playerTurn || combatOver || cd > 0 || timeLeft > 0 || player.mana < ABILITIES[key].cost;
        btn.querySelector(".ability-cd").textContent = cd > 0 ? Math.ceil(cd) : (timeLeft > 0 ? Math.ceil(timeLeft / 1000) : "");
    });

    renderInventory();
}

function itemStatLines(item) {
    if (isPotion(item)) return ["Heals 50 / 100 / 200 HP", "Click to use"];

    const lines = Object.keys(SHORT_STATS)
        .filter(key => Number(item[key]) > 0)
        .map(key => `+${item[key]} ${SHORT_STATS[key]}`);

    const regen = itemManaPerAction(item);
    if (regen > 0) lines.push(`+${regen} Mana per action`);
    if (GUARDIAN_RE.test(String(item.name ?? ""))) lines.push("Revive at 0 HP (50% HP, full mana)");

    return lines;
}

function itemTooltip(item) {
    const lines = itemStatLines(item).map(line => `<div>${escapeHtml(line)}</div>`).join("")
        || `<div class="tip-none">No stats</div>`;

    return `<div class="slot-tip"><strong>${escapeHtml(item.name)}</strong>${lines}<div class="tip-sell">Sells for ${getSellPrice(item)} Gold</div></div>`;
}

// Click a Health Potion in the bag (during your turn) to drink it
function usePotion(index) {
    const item = equippedItems[index];
    if (!item || !isPotion(item)) return;
    if (!player || !enemy || combatOver || !playerTurn) return;

    const heal = POTION_HEALS[Math.floor(Math.random() * POTION_HEALS.length)];
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    removeOne(index);

    logMessage(`Used ${item.name}: restored ${player.hp - before} HP.`);
    flash("playerPanel", "heal");
    render();

    if (POTION_USES_TURN) {
        playerTurn = false;
        setTimeout(enemyAction, 600);
    }
}

function renderInventory() {
    const grid = document.getElementById("inventoryGrid");
    const slots = [];

    for (let i = 0; i < MAX_INVENTORY; i++) {
        const item = equippedItems[i];
        if (item) {
            slots.push(`
                <div class="inventory-slot${isPotion(item) ? " usable" : ""}" ${isPotion(item) ? `onclick="usePotion(${i})"` : ""}>
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
                    <span class="slot-number">${i + 1}</span>
                    ${item.count > 1 ? `<span class="slot-count">x${item.count}</span>` : ""}
                    ${itemTooltip(item)}
                </div>
            `);
        } else {
            slots.push(`<div class="inventory-slot"><span class="slot-number">${i + 1}</span></div>`);
        }
    }

    grid.innerHTML = slots.join("");
}

window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !player || !enemy) return;
    const action = { a: "attack", q: "q", w: "w", e: "e", r: "r" }[event.key.toLowerCase()];
    if (action && !document.getElementById("abilityBar").classList.contains("hidden")) {
        playerAction(action);
    }
});

showCharacterSelect();
