// admin-dashboard.js — wires admin-dashboard.html to the HanapGanap admin API.
const API_BASE = "https://localhost:8000/api";
const ADMIN = "/admin";
const PAGE_SIZE = 20;

const TITLES = {
  users: ["Users", "All accounts. Verify or unverify an email."],
  organizers: ["Organizers", "Users with the organizer role."],
  events: ["Events", "Manage all events across organizers and universities."],
};

let current = "users";
const pages = { users: 1, organizers: 1, events: 1 };
let lastTotal = 0;
const $ = (id) => document.getElementById(id);

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
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Not authorized. Log in as an admin.");
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
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
    url: (p) => {
      const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
      const search = $("event-search").value.trim();
      const status = $("event-status").value;
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      return `${ADMIN}/events?${params}`;
    },
    key: "events",
    cols: [
      ["ID", (e) => e.id], ["Title", (e) => e.title], ["Organizer", (e) => e.organizer?.orgName],
      ["University", (e) => e.university?.name], ["Category", (e) => e.category?.name],
      ["Status", (e) => e.status], ["Starts", (e) => date(e.startDatetime)],
      ["Registrations", (e) => e._count?.registrations],
    ],
    actions: (event) => [
      ["Edit", () => openEventEditor(event), "act"],
      ...(!["completed", "cancelled"].includes(event.status)
        ? [["Cancel", () => cancelEvent(event), "act warning"]]
        : []),
      ["Delete", () => deleteEvent(event), "act danger"],
    ],
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
  $("event-filters").hidden = current !== "events";
  setStatus("Loading…");
  try {
    const data = await api(def.url(pages[current]));
    const rows = data[def.key];
    lastTotal = data.total;

    const headRow = el("tr");
    def.cols.forEach(([label]) => headRow.appendChild(el("th", label)));
    if (def.action || def.actions) headRow.appendChild(el("th", "Actions"));
    $("thead").replaceChildren(headRow);

    $("tbody").replaceChildren(...rows.map((row) => {
      const tr = el("tr");
      def.cols.forEach(([, get]) => tr.appendChild(el("td", get(row))));
      const actions = def.actions ? def.actions(row) : def.action ? [def.action(row)] : [];
      if (actions.length) {
        const td = el("td");
        td.className = "actions";
        actions.forEach(([label, handler, className]) => {
          const b = el("button", label);
          b.className = className || "act";
          b.addEventListener("click", handler);
          td.appendChild(b);
        });
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

function dateToLocalInput(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

async function openEventEditor(event) {
  $("edit-event-id").value = event.id;
  $("edit-event-name").value = event.title || "";
  $("edit-event-description").value = event.description || "";
  $("edit-event-venue").value = event.venue || "";
  $("edit-event-start").value = dateToLocalInput(event.startDatetime);
  $("edit-event-end").value = dateToLocalInput(event.endDatetime);
  $("edit-event-deadline").value = dateToLocalInput(event.registrationDeadline);
  $("edit-event-limit").value = event.participantLimit || "";
  $("edit-event-error").hidden = true;

  try {
    const categories = await api("/categories");
    const select = $("edit-event-category");
    select.replaceChildren(el("option", "Choose a category"));
    select.firstElementChild.value = "";
    categories.forEach((category) => {
      const option = el("option", category.name);
      option.value = category.id;
      select.appendChild(option);
    });
    select.value = String(event.categoryId ?? event.category?.id ?? "");
    $("edit-event-modal").hidden = false;
  } catch (err) {
    setStatus(err.message);
  }
}

async function saveEvent(event) {
  event.preventDefault();
  const id = $("edit-event-id").value;
  const dateValue = (selector) => new Date($(selector).value).toISOString();
  const updates = {
    title: $("edit-event-name").value.trim(),
    description: $("edit-event-description").value.trim(),
    venue: $("edit-event-venue").value.trim(),
    categoryId: Number($("edit-event-category").value),
    startDatetime: dateValue("#edit-event-start"),
    endDatetime: dateValue("#edit-event-end"),
    registrationDeadline: dateValue("#edit-event-deadline"),
    participantLimit: Number($("edit-event-limit").value),
  };

  try {
    await api(`/events/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    $("edit-event-modal").hidden = true;
    await Promise.all([render(), loadStats()]);
    setStatus("Event updated.");
  } catch (err) {
    $("edit-event-error").textContent = err.message;
    $("edit-event-error").hidden = false;
  }
}

async function cancelEvent(event) {
  if (!confirm(`Cancel "${event.title}"? Registrations will be retained.`)) return;
  try {
    await api(`/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    });
    await Promise.all([render(), loadStats()]);
    setStatus("Event cancelled.");
  } catch (err) {
    setStatus(err.message);
  }
}

async function deleteEvent(event) {
  const registrations = event._count?.registrations ?? 0;
  const effect = registrations
    ? `This permanently removes the event and its ${registrations} registration(s), attendance records, notifications, and uploaded images.`
    : "This permanently removes the event, notifications, and uploaded images.";
  if (!confirm(`Permanently delete "${event.title}"?\n\n${effect}\n\nThis action cannot be undone.`)) return;

  try {
    const result = await api(`/events/${event.id}`, { method: "DELETE" });
    await Promise.all([render(), loadStats()]);
    setStatus(result?.message || "Event deleted.");
  } catch (err) {
    setStatus(err.message);
  }
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    $(button.dataset.close).hidden = true;
  });
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.hidden = true;
  });
});

$("edit-event-form").addEventListener("submit", saveEvent);

$("event-filters").addEventListener("submit", (event) => {
  event.preventDefault();
  pages.events = 1;
  render();
});

$("event-status").addEventListener("change", () => {
  pages.events = 1;
  render();
});

async function setVerified(id, emailVerified) {
  try {
    await api(`${ADMIN}/users/${id}`, { method: "PATCH", body: JSON.stringify({ emailVerified }) });
    await Promise.all([render(), loadStats()]);
  } catch (err) {
    setStatus(err.message);
  }
}

document.querySelectorAll("#admin-tabs [data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    current = btn.dataset.tab;
    document.querySelectorAll("#admin-tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    render();
  });
});

$("NAVmenuToggle").addEventListener("click", () => {
  const toggle = $("NAVmenuToggle");
  const open = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!open));
  $("NAVMenu").classList.toggle("active", !open);
});

$("admin-logout").addEventListener("click", () => {
  if (!confirm("Are you sure you want to log out?")) return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
});

loadStats().catch((err) => setStatus(err.message));
render();