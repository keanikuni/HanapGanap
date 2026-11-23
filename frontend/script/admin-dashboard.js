// Admin dashboard: logs in an admin, then shows stats, users, organizers and events
// from /api/admin/*. Loaded after main.js (API_URL, formatDate).
// Wrapped in a function so its names can't clash with main.js.
(() => {
  const TOKEN_KEY = "hg_admin_token";
  const PAGE_SIZE = 20;

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const glance = document.querySelector(".glance");
  const panel = document.querySelector(".panel");
  const thead = $("thead");
  const tbody = $("tbody");
  const nav = $("nav");
  const burger = $("burger");
  const main = document.querySelector("main");

  // ── Session ─────────────────────────────────────────────
  // sessionStorage: the login ends when the tab closes. Wrapped in try/catch because
  // browsers can block storage; the token then just lives in memory.
  let token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* memory only */ }
  const saveToken = (value) => {
    token = value;
    try { sessionStorage.setItem(TOKEN_KEY, value); } catch { /* memory only */ }
  };
  const clearToken = () => {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* nothing to do */ }
  };

  // ── Small helpers ───────────────────────────────────────
  // Builds an element with text only (never innerHTML): names and titles come from users.
  function el(tag, props = {}, ...children) {
    const { dataset, ...rest } = props; // dataset is read-only, so it can't go through Object.assign
    const node = document.createElement(tag);
    Object.assign(node, rest);
    if (dataset) Object.assign(node.dataset, dataset);
    node.append(...children);
    return node;
  }

  function setStatus(text, kind = "") {
    statusEl.hidden = !text;
    statusEl.textContent = text || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  class AuthError extends Error {}
  class NetworkError extends Error {}
  const OFFLINE = "Can't reach the backend. Is it running?";

  // fetch() only rejects when the server can't be reached at all
  const send = (url, options) =>
    fetch(url, options).catch(() => { throw new NetworkError(OFFLINE); });

  async function api(path, options = {}) {
    const res = await send(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    let body = null;
    try { body = await res.json(); } catch { /* some errors have no JSON body */ }

    if (res.status === 401) throw new AuthError("Your session ended. Please log in again.");
    if (res.status === 403) throw new AuthError("This page is for admin accounts only.");
    if (!res.ok) throw new Error(body?.message || `Server answered ${res.status}`);
    return body;
  }

  // ── Login screen ────────────────────────────────────────
  let logoutBtn = null;

  function showLogin(message = "", kind = "error") {
    clearToken();
    glance.hidden = true;
    panel.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
    document.getElementById("login")?.remove();
    setStatus(message, kind);

    const email = el("input", { type: "email", id: "login-email", required: true, autocomplete: "username" });
    const password = el("input", { type: "password", id: "login-password", required: true, autocomplete: "current-password" });
    const submit = el("button", { type: "submit", textContent: "Log in" });

    const form = el("form", { id: "login", className: "login" },
      el("h2", { textContent: "Admin log in" }),
      el("label", { htmlFor: "login-email", textContent: "Email" }), email,
      el("label", { htmlFor: "login-password", textContent: "Password" }), password,
      submit,
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      setStatus("Logging in…");
      try {
        const res = await send(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value, password: password.value }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message || `Server answered ${res.status}`);
        if (body.user.role !== "admin") throw new Error("This page is for admin accounts only.");

        saveToken(body.token);
        form.remove();
        showDashboard();
      } catch (err) {
        setStatus(err.message, "error");
        submit.disabled = false;
      }
    });

    main.insertBefore(form, statusEl.nextSibling);
    email.focus();
  }

  // ── Tables ──────────────────────────────────────────────
  const date = (value) => formatDate(value);

  function verifiedCell(user) {
    const btn = el("button", { type: "button", className: "chip" });
    const paint = () => {
      btn.textContent = user.emailVerified ? "Verified" : "Not verified";
      btn.classList.toggle("on", user.emailVerified);
      btn.title = user.emailVerified ? "Click to mark as not verified" : "Click to mark as verified";
    };
    paint();

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const updated = await api(`/admin/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ emailVerified: !user.emailVerified }),
        });
        user.emailVerified = updated.emailVerified;
        paint();
        setStatus(`${user.fullName} is now ${user.emailVerified ? "verified" : "not verified"}.`, "ok");
        loadStats();
      } catch (err) {
        handleError(err);
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  }

  const userDetail = (u) =>
    u.student ? `${u.student.studentNumber} · ${u.student.university.name}`
    : u.organizer ? `${u.organizer.orgName} · ${u.organizer.university.name}`
    : u.guest ? (u.guest.schoolOrAffiliation || u.guest.contactNumber)
    : "";

  const TABS = {
    users: {
      title: "Users",
      sub: "Everyone with an account. Click the badge to verify or un-verify an email.",
      path: "/admin/users",
      list: "users",
      columns: ["Name", "Email", "Role", "Details", "Email status", "Joined"],
      row: (u) => [u.fullName, u.email, u.role, userDetail(u), verifiedCell(u), date(u.createdAt)],
    },
    organizers: {
      title: "Organizers",
      sub: "Organizations that can post events.",
      path: "/admin/users?role=organizer",
      list: "users",
      columns: ["Organization", "Contact", "Email", "University", "Email status", "Joined"],
      row: (u) => [
        u.organizer?.orgName ?? "", u.fullName, u.email,
        u.organizer?.university.name ?? "", verifiedCell(u), date(u.createdAt),
      ],
    },
    events: {
      title: "Events",
      sub: "All events from every university, newest first.",
      path: "/admin/events",
      list: "events",
      columns: ["Title", "Organizer", "University", "Category", "Starts", "Status", "Registered"],
      row: (e) => [
        e.title, e.organizer?.orgName ?? "", e.university?.name ?? "", e.category?.name ?? "",
        date(e.startDatetime), el("span", { className: `badge ${e.status}`, textContent: e.status }),
        `${e._count.registrations} / ${e.participantLimit}`,
      ],
    },
  };

  let currentTab = "users";
  let page = 1;
  let requestId = 0; // so a slow answer for an old tab can't overwrite the new one

  const pager = el("div", { className: "pager" });
  panel.append(pager);

  function render(tab, data) {
    thead.replaceChildren(el("tr", {}, ...tab.columns.map((c) => el("th", { scope: "col", textContent: c }))));

    const rows = data[tab.list];
    if (rows.length === 0) {
      tbody.replaceChildren(el("tr", {}, el("td", { colSpan: tab.columns.length, className: "empty", textContent: "Nothing here yet." })));
    } else {
      tbody.replaceChildren(...rows.map((item) =>
        el("tr", {}, ...tab.row(item).map((cell, i) =>
          el("td", { dataset: { label: tab.columns[i] } }, cell)))));
    }

    const pages = Math.max(1, Math.ceil(data.total / data.limit));
    const prev = el("button", { type: "button", textContent: "← Previous", disabled: data.page <= 1 });
    const next = el("button", { type: "button", textContent: "Next →", disabled: data.page >= pages });
    prev.addEventListener("click", () => { page--; loadTab(); });
    next.addEventListener("click", () => { page++; loadTab(); });
    pager.replaceChildren(prev, el("span", { textContent: `Page ${data.page} of ${pages} · ${data.total} total` }), next);
  }

  async function loadTab() {
    const tab = TABS[currentTab];
    const mine = ++requestId;
    $("title").textContent = tab.title;
    $("sub").textContent = tab.sub;

    const joiner = tab.path.includes("?") ? "&" : "?";
    try {
      const data = await api(`${tab.path}${joiner}page=${page}&limit=${PAGE_SIZE}`);
      if (mine !== requestId) return;
      render(tab, data);
    } catch (err) {
      if (mine === requestId) handleError(err);
    }
  }

  async function loadStats() {
    try {
      const s = await api("/admin/stats");
      $("s-users").textContent = s.users.total;
      $("s-orgs").textContent = s.users.byRole.organizer;
      $("s-events").textContent = s.events.total;
    } catch (err) {
      handleError(err);
    }
  }

  function handleError(err) {
    if (err instanceof AuthError) return showLogin(err.message);
    console.error(err);
    setStatus(err.message, "error");
  }

  // ── Dashboard ───────────────────────────────────────────
  function showDashboard() {
    setStatus("");
    glance.hidden = false;
    panel.hidden = false;
    if (!logoutBtn) {
      logoutBtn = el("button", { type: "button", className: "logout", textContent: "Log out" });
      logoutBtn.addEventListener("click", () => showLogin("You have been logged out.", "ok"));
      document.querySelector(".bar").append(logoutBtn);
    }
    logoutBtn.hidden = false;
    loadStats();
    loadTab();
  }

  nav.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn) return;
    currentTab = btn.dataset.tab;
    page = 1;
    nav.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    nav.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    setStatus("");
    loadTab();
  });

  burger.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(isOpen));
  });

  if (token) showDashboard();
  else showLogin();
})();
