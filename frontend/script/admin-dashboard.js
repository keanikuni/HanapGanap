// admin-dashboard.js — wires admin-dashboard.html to the HanapGanap admin API (adminRoutes.js).
// If you mount the router somewhere other than /api/admin, change ADMIN below.
const API_BASE = "http://localhost:8000";
const ADMIN = "/backend/node_modules/router";
const PAGE_SIZE = 20;

const TITLES = {
  users: ["Users", "All accounts. Verify or unverify an email."],
  organizers: ["Organizers", "Users with the organizer role."],
  events: ["Events", "All events across universities (read-only)."],
};

const $ = (id) => document.getElementById(id);
let current = "users";
const pages = { users: 1, organizers: 1, events: 1 };
let lastTotal = 0;

function setStatus(msg) {
  const el = $("status");
  el.textContent = msg || "";
  el.hidden = !msg;
}

async function api(path, options = {}) {
  const token = localStorage.getItem("token"); // JWT saved at login — rename if yours differs
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Not authorized. Log in as an admin.");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// ---- stats ("at a glance") ----
async function loadStats() {
  const s = await api(`${ADMIN}/stats`);
  $("s-users").textContent = s.users.total;
  $("s-orgs").textContent = s.users.byRole.organizer;
  $("s-events").textContent = s.events.total;
}

// ---- table definitions ----
const uni = (u) => u.student?.university?.name ?? u.organizer?.university?.name ?? "";
const yesNo = (v) => (v ? "Yes" : "No");
const date = (d) => (d ? new Date(d).toLocaleString() : "");

const TABLES = {
  users: {
    url: (p) => `${ADMIN}/users?page=${p}&limit=${PAGE_SIZE}`,
    key: "users",
    cols: [
      ["ID", (u) => u.id], ["Name", (u) => u.fullName], ["Email", (u) => u.email],
      ["Role", (u) => u.role], ["Verified", (u) => yesNo(u.emailVerified)], ["University", uni],
    ],
    action: (u) => [u.emailVerified ? "Unverify" : "Verify", () => setVerified(u.id, !u.emailVerified)],
  },
  organizers: {
    url: (p) => `${ADMIN}/users?role=organizer&page=${p}&limit=${PAGE_SIZE}`,
    key: "users",
    cols: [
      ["User ID", (u) => u.id], ["Organization", (u) => u.organizer?.orgName], ["Contact", (u) => u.fullName],
      ["Email", (u) => u.email], ["University", uni], ["Verified", (u) => yesNo(u.emailVerified)],
    ],
    action: (u) => [u.emailVerified ? "Unverify" : "Verify", () => setVerified(u.id, !u.emailVerified)],
  },
  events: {
    url: (p) => `${ADMIN}/events?page=${p}&limit=${PAGE_SIZE}`,
    key: "events",
    cols: [
      ["ID", (e) => e.id], ["Title", (e) => e.title], ["Organizer", (e) => e.organizer?.orgName],
      ["University", (e) => e.university?.name], ["Category", (e) => e.category?.name],
      ["Status", (e) => e.status], ["Starts", (e) => date(e.startDatetime)],
      ["Registrations", (e) => e._count?.registrations],
    ],
    action: null,
  },
};

function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text ?? "";
  return node;
}

async function render() {
  const def = TABLES[current];
  $("title").textContent = TITLES[current][0];
  $("sub").textContent = TITLES[current][1];
  setStatus("Loading…");
  try {
    const data = await api(def.url(pages[current]));
    const rows = data[def.key];
    lastTotal = data.total;

    const headRow = el("tr");
    def.cols.forEach(([label]) => headRow.appendChild(el("th", label)));
    if (def.action) headRow.appendChild(el("th", "Action"));
    $("thead").replaceChildren(headRow);

    $("tbody").replaceChildren(...rows.map((row) => {
      const tr = el("tr");
      def.cols.forEach(([, get]) => tr.appendChild(el("td", get(row))));
      if (def.action) {
        const [label, handler] = def.action(row);
        const td = el("td");
        const b = el("button", label);
        b.addEventListener("click", handler);
        td.appendChild(b);
        tr.appendChild(td);
      }
      return tr;
    }));
    renderPager();
    setStatus(rows.length ? "" : "Nothing here yet.");
  } catch (err) {
    setStatus(err instanceof TypeError ? "Can't reach the server. Is the backend running?" : err.message);
  }
}

function renderPager() {
  let pager = $("pager");
  if (!pager) {
    pager = el("div");
    pager.id = "pager";
    document.querySelector(".panel").appendChild(pager);
  }
  const last = Math.max(1, Math.ceil(lastTotal / PAGE_SIZE));
  const prev = el("button", "Previous");
  const next = el("button", "Next");
  prev.disabled = pages[current] <= 1;
  next.disabled = pages[current] >= last;
  prev.onclick = () => { pages[current]--; render(); };
  next.onclick = () => { pages[current]++; render(); };
  pager.replaceChildren(prev, el("span", ` Page ${pages[current]} of ${last} `), next);
}

async function setVerified(id, emailVerified) {
  try {
    await api(`${ADMIN}/users/${id}`, { method: "PATCH", body: JSON.stringify({ emailVerified }) });
    await Promise.all([render(), loadStats()]);
  } catch (err) {
    setStatus(err.message);
  }
}

document.querySelectorAll("#nav [data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    current = btn.dataset.tab;
    document.querySelectorAll("#nav [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    render();
  });
});

$("burger").addEventListener("click", () => {
  const open = $("burger").getAttribute("aria-expanded") === "true";
  $("burger").setAttribute("aria-expanded", String(!open));
  $("nav").classList.toggle("open", !open);
});

loadStats().catch((err) => setStatus(err.message));
render();