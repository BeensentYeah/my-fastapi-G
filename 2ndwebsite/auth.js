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
        report:   `<path d="M14 10a1.5 1.5 0 0 1-1.5 1.5H5.5L2.5 14V3.5A1.5 1.5 0 0 1 4 2h8.5A1.5 1.5 0 0 1 14 3.5z"/><path d="M8 5v3"/><path d="M8 9.6v.01"/>`,
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

        // All three sites are listed, always in the same order, so the buttons
        // never move as you go between them. The one you are already on is a
        // span rather than a link: it is marked as the current page and
        // clicking it does nothing.
        const links = AUTH_CONFIG.sites.map(s => {
            if (s.id === AUTH_CONFIG.currentSite) {
                return `<span class="account-link is-current" aria-current="page">${escape(s.name)}</span>`;
            }
            return `<a class="account-link" href="${linkTo(s)}">${escape(s.name)}</a>`;
        }).join("");

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

        const first = session
            ? `<button type="button" class="account-menu-item" role="menuitem" data-act="stats">
                   ${icon("stats")}<span>Your stats</span>
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
                <button type="button" class="account-menu-item" role="menuitem" data-act="report">
                    ${icon("report")}<span>Send a report</span>
                </button>
                ${last ? `<hr class="account-menu-rule">${last}` : ""}
            </div>`;
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
                closeMenu();

                if (item.dataset.act === "signout")      signOut();
                else if (item.dataset.act === "stats")   openStats();
                else if (item.dataset.act === "report")  openReport();
                else if (item.dataset.act === "signin")  openGate(true);
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
                if (event.key === "Escape") { closeMenu(); closeStats(); closeReport(); }
            });
        }
    }

    function openMenu() {
        const menu = document.getElementById("accountMenu");
        if (!menu) return;
        menu.classList.remove("hidden");
        document.getElementById("accountMenuBtn").setAttribute("aria-expanded", "true");
    }

    function closeMenu() {
        const menu = document.getElementById("accountMenu");
        if (!menu) return;
        menu.classList.add("hidden");
        const btn = document.getElementById("accountMenuBtn");
        if (btn) btn.setAttribute("aria-expanded", "false");
    }

    /* ---------------------------------------------------------------
       The stats panel, opened from "Your stats" in the menu.
       It reads the same three tables the games write to.
       --------------------------------------------------------------- */

    function buildStats() {
        const panel = document.createElement("div");
        panel.id = "accountStats";
        panel.className = "account-stats hidden";
        panel.innerHTML = `
            <div class="account-stats-card" role="dialog" aria-modal="true" aria-labelledby="accountStatsTitle">
                <div class="account-stats-head">
                    <h2 id="accountStatsTitle">Your stats</h2>
                    <button type="button" class="account-stats-close" id="accountStatsClose"
                            aria-label="Close">&#10005;</button>
                </div>
                <div id="accountStatsBody"></div>
            </div>`;
        document.body.appendChild(panel);

        document.getElementById("accountStatsClose").onclick = closeStats;
        panel.onclick = event => { if (event.target === panel) closeStats(); };
    }

    const closeStats = () => {
        const panel = document.getElementById("accountStats");
        if (panel) panel.classList.add("hidden");
    };

    async function openStats() {
        const panel = document.getElementById("accountStats");
        const body = document.getElementById("accountStatsBody");
        if (!panel) return;

        panel.classList.remove("hidden");
        body.innerHTML = `<p class="account-stats-msg">Loading your stats...</p>`;

        try {
            const data = await stats();
            body.innerHTML = data
                ? statsHtml(data)
                : `<p class="account-stats-msg">Sign in to see your stats.</p>`;
        } catch (err) {
            body.innerHTML = `<p class="account-stats-msg">Could not load your stats. ${escape(err?.message || "")}</p>`;
        }
    }

    function tile(label, value) {
        return `<div class="account-stat">
                    <b>${escape(String(value))}</b>
                    <span>${escape(label)}</span>
                </div>`;
    }

    function statsHtml({ profile, itemdle, rift }) {
        const dash = "\u2014";
        const rate = (part, total) => total > 0 ? Math.round(part / total * 100) + "%" : dash;
        const mean = (total, count) => count > 0 ? (total / count).toFixed(1) : dash;

        const i = itemdle || {};
        const r = rift || {};

        let since = "";
        if (profile?.created_at) {
            const d = new Date(profile.created_at);
            if (!isNaN(d)) since = d.toLocaleDateString(undefined,
                { year: "numeric", month: "long", day: "numeric" });
        }

        const champions = Object.entries(r.champions || {})
            .filter(([, runs]) => runs > 0)
            .sort((a, b) => b[1] - a[1]);

        const nothingYet = !(i.games_played > 0) && !(r.runs_played > 0);

        return `
            <div class="account-stats-who">
                <strong>${escape(profile?.username || "player")}</strong>
                ${since ? `<span>Playing since ${escape(since)}</span>` : ""}
            </div>

            ${nothingYet ? `<p class="account-stats-msg">
                No games finished yet. Play a round of Itemdle or a run of Item Rift
                and it will show up here.</p>` : ""}

            <h3 class="account-stats-section">Itemdle</h3>
            <div class="account-stat-grid">
                ${tile("Games", i.games_played || 0)}
                ${tile("Wins", i.wins || 0)}
                ${tile("Win rate", rate(i.wins || 0, i.games_played || 0))}
                ${tile("Current streak", i.current_streak || 0)}
                ${tile("Best streak", i.best_streak || 0)}
                ${tile("Avg guesses", mean(i.total_guesses || 0, i.games_played || 0))}
            </div>

            <h3 class="account-stats-section">Item Rift</h3>
            <div class="account-stat-grid">
                ${tile("Runs", r.runs_played || 0)}
                ${tile("Cleared", r.runs_won || 0)}
                ${tile("Clear rate", rate(r.runs_won || 0, r.runs_played || 0))}
                ${tile("Furthest round", r.best_round || 0)}
                ${tile("Most gold held", r.best_gold || 0)}
            </div>

            ${champions.length ? `
                <p class="account-stats-label">Runs by champion</p>
                <div class="account-champs">
                    ${champions.map(([name, runs]) =>
                        `<span>${escape(name)} <b>${escape(String(runs))}</b></span>`).join("")}
                </div>` : ""}`;
    }

    /* ---------------------------------------------------------------
       Send a report: a bug, an idea, or anything else. Reports are saved
       in the feedback table and belong to the account that sent them, so
       sending one needs an account (see supabase/feedback.sql).
       --------------------------------------------------------------- */

    const REPORT_KINDS = [
        { id: "bug",   label: "Bug" },
        { id: "idea",  label: "Idea" },
        { id: "other", label: "Something else" }
    ];

    const MESSAGE_MIN = 10;
    const MESSAGE_MAX = 1000;

    let reportKind = "bug";

    function buildReport() {
        const panel = document.createElement("div");
        panel.id = "accountReport";
        panel.className = "account-report hidden";
        panel.innerHTML = `
            <div class="account-report-card" role="dialog" aria-modal="true"
                 aria-labelledby="accountReportTitle">
                <div class="account-report-head">
                    <h2 id="accountReportTitle">Send a report</h2>
                    <button type="button" class="account-report-close" id="accountReportClose"
                            aria-label="Close">&#10005;</button>
                </div>
                <div id="accountReportBody"></div>
            </div>`;
        document.body.appendChild(panel);

        document.getElementById("accountReportClose").onclick = closeReport;
        panel.onclick = event => { if (event.target === panel) closeReport(); };
    }

    const closeReport = () => {
        const panel = document.getElementById("accountReport");
        if (panel) panel.classList.add("hidden");
    };

    function openReport() {
        const panel = document.getElementById("accountReport");
        if (!panel) return;
        panel.classList.remove("hidden");
        reportKind = "bug";
        showReportForm();
    }

    // The form, or a prompt to sign in when there is no account to attach to.
    function showReportForm() {
        const body = document.getElementById("accountReportBody");

        if (!session) {
            body.innerHTML = `
                <p class="account-report-intro">
                    A report is saved against your account so we can reply to the right
                    person, so you need to be signed in to send one.
                </p>
                <button type="button" class="account-primary" id="accountReportSignIn">
                    Sign in or create an account
                </button>`;
            document.getElementById("accountReportSignIn").onclick = () => {
                closeReport();
                openGate(true);
            };
            return;
        }

        body.innerHTML = `
            <p class="account-report-intro">
                Found something broken, or thought of something that would make this
                better? Send it over.
            </p>

            <form id="accountReportForm">
                <div class="account-field">
                    <span>What is it about</span>
                    <div class="account-kinds" role="group" aria-label="Type of report">
                        ${REPORT_KINDS.map(k => `
                            <button type="button" class="account-kind${k.id === reportKind ? " is-on" : ""}"
                                    data-kind="${k.id}" aria-pressed="${k.id === reportKind}">
                                ${escape(k.label)}
                            </button>`).join("")}
                    </div>
                </div>

                <label class="account-field">
                    <span>Your message</span>
                    <!-- maxlength is a hard stop while typing. The minimum is checked in
                         submitReport() so the message can explain itself, rather than by the
                         browser's own terse bubble. The database enforces both limits again. -->
                    <textarea id="accountReportMessage" rows="5"
                              maxlength="${MESSAGE_MAX}" aria-describedby="accountReportCount"
                              placeholder="What happened, and what were you doing at the time?"></textarea>
                </label>

                <p class="account-report-count">
                    <span id="accountReportCount">0</span> / ${MESSAGE_MAX}
                </p>

                <p class="account-error" id="accountReportError" hidden></p>

                <button type="submit" class="account-primary" id="accountReportSubmit">Send report</button>
            </form>`;

        // Which kind of report this is.
        body.querySelectorAll(".account-kind").forEach(btn => {
            btn.onclick = () => {
                reportKind = btn.dataset.kind;
                body.querySelectorAll(".account-kind").forEach(b => {
                    const on = b === btn;
                    b.classList.toggle("is-on", on);
                    b.setAttribute("aria-pressed", String(on));
                });
            };
        });

        const field = document.getElementById("accountReportMessage");
        const count = document.getElementById("accountReportCount");
        field.oninput = () => { count.textContent = field.value.length; };

        document.getElementById("accountReportForm").onsubmit = async event => {
            event.preventDefault();
            await submitReport(field.value);
        };

        field.focus();
    }

    async function submitReport(text) {
        const submit = document.getElementById("accountReportSubmit");
        const message = String(text || "").trim();

        // Checked here for a quick, clear message; the database enforces the
        // same limits again, so neither side is trusted on its own.
        if (message.length < MESSAGE_MIN) {
            showReportError(`Please write at least ${MESSAGE_MIN} characters so we can act on it.`);
            return;
        }
        if (message.length > MESSAGE_MAX) {
            showReportError(`That is longer than ${MESSAGE_MAX} characters.`);
            return;
        }

        submit.disabled = true;
        submit.textContent = "Sending...";
        showReportError("");

        try {
            await sendReport({ kind: reportKind, message });
            showReportSent();
        } catch (err) {
            showReportError(friendlyError(err));
            submit.disabled = false;
            submit.textContent = "Send report";
        }
    }

    function showReportError(text) {
        const el = document.getElementById("accountReportError");
        if (!el) return;
        el.textContent = text;
        el.hidden = !text;
    }

    // The confirmation. It replaces the form so the same report cannot be
    // sent twice by hitting the button again.
    function showReportSent() {
        const body = document.getElementById("accountReportBody");
        body.innerHTML = `
            <div class="account-report-done">
                <svg class="account-report-tick" viewBox="0 0 48 48" aria-hidden="true">
                    <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="2.5"/>
                    <path d="M15 24.5l6.5 6.5L33 18" fill="none" stroke="currentColor"
                          stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3>Report sent</h3>
                <p>Thank you. Your report has been saved and we read every one that comes in.</p>
                <div class="account-report-actions">
                    <button type="button" class="account-ghost" id="accountReportAnother">Send another</button>
                    <button type="button" class="account-primary" id="accountReportDone">Close</button>
                </div>
            </div>`;

        document.getElementById("accountReportAnother").onclick = () => {
            reportKind = "bug";
            showReportForm();
        };
        document.getElementById("accountReportDone").onclick = closeReport;
        document.getElementById("accountReportDone").focus();
    }

    // Writes the row. The user id comes from the session rather than the page,
    // and the row level security policy checks it matches, so a report cannot
    // be filed in somebody else's name.
    async function sendReport({ kind, message }) {
        if (!session) throw new Error("Sign in to send a report.");

        const { error } = await getClient().from("feedback").insert({
            user_id: session.user.id,
            site: AUTH_CONFIG.currentSite,
            kind: REPORT_KINDS.some(k => k.id === kind) ? kind : "other",
            message: String(message).trim()
        });

        if (error) throw error;
        return true;
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
        if (/feedback_message_check|check constraint/i.test(text)) return "Your message needs to be between 10 and 1000 characters.";
        if (/row-level security/i.test(text)) return "Your session has expired. Sign in again and resend.";
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
        buildStats();
        buildReport();

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
        recordItemdleGame, recordRiftRun, stats, sendReport
    };
})();
