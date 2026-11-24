/* =====================================================================
   Shared accounts layer for all three websites.
   Identical in every folder — only auth-config.js differs.

   It adds, without touching any of the games' own code:
     * a sign in / sign up screen that covers the page until you choose
     * a "Continue without an account" option
     * a top bar linking the other two sites
     * a profile button on the right that opens an account menu
     * a session handover, so following one of those links signs you in there

   WHY THE HANDOVER EXISTS
   Each site is its own Vercel deployment, so each has its own address, and a
   browser deliberately keeps a login on one address invisible to another. To
   carry the session across, the link includes the session token in the part of
   the URL after "#". The receiving site reads it, signs in, and removes it from
   the address bar immediately. The "#" part is never sent to any server.
   On a single shared domain none of this would be needed.
   ===================================================================== */

const Accounts = (() => {
    "use strict";

    const GUEST_KEY = "lolrift.guest";
    let client = null;
    let session = null;
    let profile = null;
    let outsideClickBound = false;

    /* ---------------------------------------------------------------
       Supabase client
       --------------------------------------------------------------- */

    function configured() {
        return !AUTH_CONFIG.supabaseUrl.includes("YOUR-PROJECT-ID")
            && !AUTH_CONFIG.supabaseKey.includes("REPLACE_ME");
    }

    function getClient() {
        if (!client) {
            client = window.supabase.createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabaseKey);
        }
        return client;
    }

    /* ---------------------------------------------------------------
       Session handover between the three addresses
       --------------------------------------------------------------- */

    // Reads "#sess=..." left by a link from another site, signs in, cleans the URL.
    async function acceptIncomingSession() {
        const match = /[#&]sess=([^&]+)/.exec(window.location.hash);
        if (!match) return false;

        // Strip it from the address bar first, so a copied URL never carries a token.
        history.replaceState(null, "", window.location.pathname + window.location.search);

        try {
            const tokens = JSON.parse(atob(decodeURIComponent(match[1])));
            const { data, error } = await getClient().auth.setSession({
                access_token: tokens.at,
                refresh_token: tokens.rt
            });
            if (error) throw error;
            session = data.session;
            return true;
        } catch (err) {
            console.warn("Could not continue the session from the other site:", err.message);
            return false;
        }
    }

    // Builds a link to another site, carrying the session when there is one.
    function linkTo(site) {
        if (!session) return site.url;
        const tokens = btoa(JSON.stringify({ at: session.access_token, rt: session.refresh_token }));
        return site.url + "#sess=" + encodeURIComponent(tokens);
    }

    /* ---------------------------------------------------------------
       Guest mode (remembered per site, since each has its own storage)
       --------------------------------------------------------------- */

    const isGuest = () => localStorage.getItem(GUEST_KEY) === "1";
    const setGuest = on => on ? localStorage.setItem(GUEST_KEY, "1") : localStorage.removeItem(GUEST_KEY);

    /* ---------------------------------------------------------------
       Artwork. The default profile picture is drawn here rather than
       loaded, so there is no image file to host and nothing to break.
       Swap AVATAR for an <img> once real profile pictures exist.
       --------------------------------------------------------------- */

    const AVATAR = `
        <svg class="account-avatar-art" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="20" fill="#16242c"/>
            <circle cx="20" cy="15.5" r="6.4" fill="#c8aa6e"/>
            <path d="M6.6 36a13.4 13.4 0 0 1 26.8 0z" fill="#c8aa6e"/>
        </svg>`;

    // Small line icons for the menu rows.
    const ICON = {
        stats:    `<path d="M3 13.5V9m4.5 4.5v-9M12 13.5v-6"/>`,
        settings: `<circle cx="8" cy="8" r="2.4"/><path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3"/>`,
        help:     `<circle cx="8" cy="8" r="6.4"/><path d="M6.2 6.2a1.9 1.9 0 1 1 2.5 1.8c-.5.2-.7.6-.7 1.1v.3"/><path d="M8 11.8v.01"/>`,
        signin:   `<path d="M6.5 2.5h5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5"/><path d="M8.5 8h-7m0 0 2.4-2.4M1.5 8l2.4 2.4"/>`,
        logout:   `<path d="M9.5 2.5h-5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h5"/><path d="M14.5 8h-7m7 0-2.4-2.4M14.5 8l-2.4 2.4"/>`
    };

    const icon = name =>
        `<svg class="account-menu-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true">${ICON[name]}</svg>`;

    /* ---------------------------------------------------------------
       Top bar: site links on the left, profile button on the right
       --------------------------------------------------------------- */

    function renderBar() {
        let bar = document.getElementById("accountBar");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "accountBar";
            bar.className = "account-bar";
            document.body.insertBefore(bar, document.body.firstChild);
        }

        const others = AUTH_CONFIG.sites.filter(s => s.id !== AUTH_CONFIG.currentSite);
        const links = others
            .map(s => `<a class="account-link" href="${linkTo(s)}">${escape(s.name)}</a>`)
            .join("");

        bar.innerHTML = `
            <nav class="account-links">${links}</nav>
            <div class="account-side">
                <button type="button" class="account-avatar-btn" id="accountMenuBtn"
                        aria-haspopup="menu" aria-expanded="false"
                        aria-controls="accountMenu" aria-label="Your account">
                    ${AVATAR}
                </button>
                <div class="account-menu hidden" id="accountMenu" role="menu">${menuHtml()}</div>
            </div>`;

        wireMenu();
    }

    // Everything inside the dropdown. The rows marked "Soon" are placeholders:
    // they are in place so the menu is complete, and each one only needs its
    // click handler filling in later.
    function menuHtml() {
        const name = session ? (profile?.username || "player") : "Guest";
        const sub = session ? "Signed in" : "Progress is not being saved";

        const card = `
            <div class="account-menu-card">
                <span class="account-avatar-lg">${AVATAR}</span>
                <span class="account-menu-id">
                    <strong>${escape(name)}</strong>
                    <span>${escape(sub)}</span>
                </span>
            </div>`;

        const soon = `<em class="account-soon">Soon</em>`;

        const first = session
            ? `<button type="button" class="account-menu-item" role="menuitem" data-act="soon">
                   ${icon("stats")}<span>Your stats</span>${soon}
               </button>`
            : `<button type="button" class="account-menu-item" role="menuitem" data-act="signin">
                   ${icon("signin")}<span>Sign in or create an account</span>
               </button>`;

        const last = session
            ? `<button type="button" class="account-menu-item danger" role="menuitem" data-act="signout">
                   ${icon("logout")}<span>Log out</span>
               </button>`
            : "";

        return `
            ${card}
            <div class="account-menu-list">
                ${first}
                <button type="button" class="account-menu-item" role="menuitem" data-act="soon">
                    ${icon("settings")}<span>Settings &amp; privacy</span>${soon}
                </button>
                <button type="button" class="account-menu-item" role="menuitem" data-act="soon">
                    ${icon("help")}<span>Help &amp; support</span>${soon}
                </button>
                ${last ? `<hr class="account-menu-rule">${last}` : ""}
            </div>
            <p class="account-menu-note" id="accountMenuNote" hidden></p>`;
    }

    function wireMenu() {
        const btn = document.getElementById("accountMenuBtn");
        const menu = document.getElementById("accountMenu");

        btn.onclick = event => {
            event.stopPropagation();
            menu.classList.contains("hidden") ? openMenu() : closeMenu();
        };

        menu.querySelectorAll(".account-menu-item").forEach(item => {
            item.onclick = () => {
                const note = document.getElementById("accountMenuNote");

                if (item.dataset.act === "signout") {
                    closeMenu();
                    signOut();
                } else if (item.dataset.act === "signin") {
                    closeMenu();
                    openGate(true);
                } else {
                    // Placeholder row: say so plainly rather than doing nothing.
                    // Read the label only, so the "Soon" badge is left out.
                    const label = item.querySelector("span").textContent.trim();
                    note.textContent = label + " \u2014 not built yet.";
                    note.hidden = false;
                }
            };
        });

        // Bound once, not on every redraw.
        if (!outsideClickBound) {
            outsideClickBound = true;
            document.addEventListener("click", event => {
                const open = document.getElementById("accountMenu");
                if (open && !open.classList.contains("hidden") && !event.target.closest(".account-side")) {
                    closeMenu();
                }
            });
            document.addEventListener("keydown", event => {
                if (event.key === "Escape") closeMenu();
            });
        }
    }

    function openMenu() {
        const menu = document.getElementById("accountMenu");
        if (!menu) return;
        menu.classList.remove("hidden");
        document.getElementById("accountMenuBtn").setAttribute("aria-expanded", "true");
        const note = document.getElementById("accountMenuNote");
        if (note) { note.hidden = true; note.textContent = ""; }
    }

    function closeMenu() {
        const menu = document.getElementById("accountMenu");
        if (!menu) return;
        menu.classList.add("hidden");
        const btn = document.getElementById("accountMenuBtn");
        if (btn) btn.setAttribute("aria-expanded", "false");
    }

    /* ---------------------------------------------------------------
       The sign in / sign up screen
       --------------------------------------------------------------- */

    function buildGate() {
        const gate = document.createElement("div");
        gate.id = "accountGate";
        gate.className = "account-gate hidden";
        gate.innerHTML = `
            <div class="account-card" role="dialog" aria-modal="true" aria-labelledby="accountTitle">
                <h2 id="accountTitle">Welcome</h2>
                <p class="account-sub" id="accountSub">Sign in to save your progress across all three sites.</p>

                <div class="account-tabs">
                    <button type="button" class="account-tab is-on" data-mode="signin">Sign in</button>
                    <button type="button" class="account-tab" data-mode="signup">Create account</button>
                </div>

                <form id="accountForm" autocomplete="on">
                    <label class="account-field" id="usernameField" hidden>
                        <span>Username</span>
                        <input type="text" id="accountUsername" minlength="3" maxlength="20" autocomplete="username">
                    </label>
                    <label class="account-field">
                        <span>Email</span>
                        <input type="email" id="accountEmail" required autocomplete="email">
                    </label>
                    <label class="account-field">
                        <span>Password</span>
                        <input type="password" id="accountPassword" required minlength="6" autocomplete="current-password">
                    </label>

                    <p class="account-error" id="accountError" hidden></p>

                    <button type="submit" class="account-primary" id="accountSubmit">Sign in</button>
                </form>

                <button type="button" class="account-ghost" id="accountGuest">Continue without an account</button>
                <p class="account-note">Without an account your progress is not saved.</p>
            </div>`;
        document.body.appendChild(gate);

        let mode = "signin";

        gate.querySelectorAll(".account-tab").forEach(tab => {
            tab.onclick = () => {
                mode = tab.dataset.mode;
                gate.querySelectorAll(".account-tab").forEach(t => t.classList.toggle("is-on", t === tab));
                const signup = mode === "signup";
                document.getElementById("usernameField").hidden = !signup;
                document.getElementById("accountUsername").required = signup;
                document.getElementById("accountPassword").autocomplete = signup ? "new-password" : "current-password";
                document.getElementById("accountSubmit").textContent = signup ? "Create account" : "Sign in";
                document.getElementById("accountTitle").textContent = signup ? "Create your account" : "Welcome";
                showError("");
            };
        });

        document.getElementById("accountForm").onsubmit = async event => {
            event.preventDefault();
            const email = document.getElementById("accountEmail").value.trim();
            const password = document.getElementById("accountPassword").value;
            const username = document.getElementById("accountUsername").value.trim();
            const submit = document.getElementById("accountSubmit");

            submit.disabled = true;
            showError("");
            try {
                if (mode === "signup") await signUp(email, password, username);
                else await signIn(email, password);
            } catch (err) {
                showError(friendlyError(err));
            } finally {
                submit.disabled = false;
            }
        };

        document.getElementById("accountGuest").onclick = () => {
            setGuest(true);
            closeGate();
            renderBar();
        };
    }

    function showError(message) {
        const el = document.getElementById("accountError");
        el.textContent = message;
        el.hidden = !message;
    }

    // Supabase messages are terse; turn the common ones into plain English.
    function friendlyError(err) {
        const text = String(err?.message || err);
        if (/invalid login credentials/i.test(text)) return "That email and password do not match an account.";
        if (/already registered|already exists/i.test(text)) return "There is already an account with that email.";
        if (/profiles_username_key|duplicate key/i.test(text)) return "That username is taken. Try another.";
        if (/password/i.test(text) && /least/i.test(text)) return "Your password needs at least 6 characters.";
        if (/email/i.test(text) && /confirm/i.test(text)) return "Check your email to confirm the account, then sign in.";
        if (/failed to fetch|network/i.test(text)) return "Could not reach the server. Check your connection.";
        return text;
    }

    const openGate = (manual = false) => {
        document.getElementById("accountGate").classList.remove("hidden");
        document.getElementById("accountSub").textContent = manual
            ? "Sign in to start saving your progress."
            : "Sign in to save your progress across all three sites.";
        document.getElementById("accountEmail").focus();
    };

    const closeGate = () => document.getElementById("accountGate").classList.add("hidden");

    /* ---------------------------------------------------------------
       Sign in / up / out
       --------------------------------------------------------------- */

    async function signIn(email, password) {
        const { data, error } = await getClient().auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data.session;
        setGuest(false);
        await loadProfile();
        closeGate();
        renderBar();
    }

    async function signUp(email, password, username) {
        // The username travels in the sign-up metadata; a database trigger reads
        // it and creates the profile and stats rows.
        const { data, error } = await getClient().auth.signUp({
            email, password, options: { data: { username } }
        });
        if (error) throw error;

        if (!data.session) {                       // email confirmation is switched on
            showError("Account created. Check your email to confirm it, then sign in.");
            return;
        }
        session = data.session;
        setGuest(false);
        await loadProfile();
        closeGate();
        renderBar();
    }

    async function signOut() {
        await getClient().auth.signOut();
        session = null;
        profile = null;
        setGuest(false);
        renderBar();
        openGate();
    }

    async function loadProfile() {
        if (!session) return null;
        const { data, error } = await getClient()
            .from("profiles").select("username, created_at").eq("id", session.user.id).single();
        if (error) {
            console.warn("Could not load the profile:", error.message);
            return null;
        }
        profile = data;
        return profile;
    }

    /* ---------------------------------------------------------------
       Saving game data. These do nothing for guests, so the games can
       call them without checking whether anyone is signed in.
       --------------------------------------------------------------- */

    async function recordItemdleGame({ won, guesses }) {
        if (!session) return;
        const db = getClient();
        const { data: row } = await db.from("itemdle_stats")
            .select("*").eq("user_id", session.user.id).single();
        if (!row) return;

        const streak = won ? row.current_streak + 1 : 0;
        const { error } = await db.from("itemdle_stats").update({
            games_played:   row.games_played + 1,
            wins:           row.wins + (won ? 1 : 0),
            current_streak: streak,
            best_streak:    Math.max(row.best_streak, streak),
            total_guesses:  row.total_guesses + (Number(guesses) || 0),
            updated_at:     new Date().toISOString()
        }).eq("user_id", session.user.id);
        if (error) console.warn("Could not save your Itemdle result:", error.message);
    }

    async function recordRiftRun({ won, round, gold, champion }) {
        if (!session) return;
        const db = getClient();
        const { data: row } = await db.from("rift_progress")
            .select("*").eq("user_id", session.user.id).single();
        if (!row) return;

        const champions = { ...(row.champions || {}) };
        if (champion) champions[champion] = (champions[champion] || 0) + 1;

        const { error } = await db.from("rift_progress").update({
            runs_played: row.runs_played + 1,
            runs_won:    row.runs_won + (won ? 1 : 0),
            best_round:  Math.max(row.best_round, Number(round) || 0),
            best_gold:   Math.max(row.best_gold, Number(gold) || 0),
            champions,
            updated_at:  new Date().toISOString()
        }).eq("user_id", session.user.id);
        if (error) console.warn("Could not save your Item Rift run:", error.message);
    }

    async function stats() {
        if (!session) return null;
        const db = getClient();
        const [itemdle, rift] = await Promise.all([
            db.from("itemdle_stats").select("*").eq("user_id", session.user.id).single(),
            db.from("rift_progress").select("*").eq("user_id", session.user.id).single()
        ]);
        return { profile, itemdle: itemdle.data, rift: rift.data };
    }

    /* ---------------------------------------------------------------
       Start-up
       --------------------------------------------------------------- */

    function escape(value) {
        return String(value ?? "").replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    async function init() {
        if (!configured()) {
            console.warn("auth-config.js still has placeholder values; accounts are switched off.");
            return;
        }

        buildGate();

        // A token in the URL means we arrived from one of the other sites.
        const carried = await acceptIncomingSession();

        if (!carried) {
            const { data } = await getClient().auth.getSession();
            session = data.session;
        }

        if (session) await loadProfile();

        renderBar();
        if (!session && !isGuest()) openGate();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    return {
        signIn, signUp, signOut,
        user: () => session?.user ?? null,
        profile: () => profile,
        isSignedIn: () => Boolean(session),
        recordItemdleGame, recordRiftRun, stats
    };
})();
