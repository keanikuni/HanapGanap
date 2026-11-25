// Student page: events I registered for, whether I attended, and my certificates.
// Needs script/main.js loaded first (it defines API_URL).
// API used: GET /auth/me, GET /registrations/mine, GET /events/:id/certificate

const token = localStorage.getItem("token");
const byId = (id) => document.getElementById(id);

let registrations = [];
let activeFilter = "all";

// ---------- Helpers ----------

function showMessage(text, linkHref, linkText) {
  const box = byId("message");
  box.textContent = text + " ";
  if (linkHref) {
    const a = document.createElement("a");
    a.href = linkHref;
    a.textContent = linkText;
    box.appendChild(a);
  }
  box.hidden = false;
}

function goToLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "login.html";
}

async function apiGet(path) {
  let res;
  try {
    res = await fetch(API_URL + path, { headers: { Authorization: "Bearer " + token } });
  } catch {
    throw new Error("Can't reach the server. Make sure the backend is running.");
  }
  if (res.status === 401) {
    goToLogin();
    throw new Error("Please log in again.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return res.json();
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

// One word that describes where this registration stands
function statusOf(reg) {
  const ev = reg.event;
  const attended = !!reg.attendance?.isConfirm;
  const ended = ev.status === "completed" || new Date(ev.endDatetime) < new Date();

  if (ev.status === "cancelled") return "cancelled";
  if (attended) return "attended";
  if (ended) return "missed";
  if (ev.status === "ongoing") return "ongoing";
  return "upcoming";
}

const STATUS_LABEL = {
  upcoming: "Upcoming",
  ongoing: "Happening now",
  attended: "Attended",
  missed: "Not attended",
  cancelled: "Cancelled",
};

function attendanceLabel(status) {
  if (status === "attended") return "Attendance: Attended";
  if (status === "missed") return "Attendance: Not attended";
  if (status === "cancelled") return "Attendance: Event cancelled";
  return "Attendance: Not recorded yet";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Rendering ----------

function eventCard(reg) {
  const ev = reg.event;
  const status = statusOf(reg);

  const li = el("li", `card card--${status}`);

  const top = el("div", "card__top");
  const title = el("h3", "card__title");
  const link = el("a", "", ev.title);
  link.href = `event.html?id=${encodeURIComponent(ev.id)}`;
  title.appendChild(link);
  top.appendChild(title);
  top.appendChild(el("span", `badge badge--${status}`, STATUS_LABEL[status]));
  li.appendChild(top);

  li.appendChild(el("p", "card__meta", formatDate(ev.startDatetime)));
  li.appendChild(el("p", "card__meta", [ev.venue, ev.university?.name].filter(Boolean).join(" · ")));
  li.appendChild(el("p", `card__attendance card__attendance--${status}`, attendanceLabel(status)));

  if (reg.attendance?.isConfirm && reg.attendance.inTime) {
    li.appendChild(el("p", "card__meta", "Checked in " + formatDate(reg.attendance.inTime)));
  }
  return li;
}

function renderEvents() {
  const list = byId("eventList");
  list.replaceChildren();

  const shown = registrations.filter((r) => activeFilter === "all" || statusOf(r) === activeFilter);
  shown.forEach((r) => list.appendChild(eventCard(r)));

  const empty = byId("eventsEmpty");
  empty.hidden = shown.length > 0;
  if (shown.length === 0) {
    empty.textContent =
      registrations.length === 0
        ? "You haven't registered for any events yet."
        : "No events match this filter.";
    if (registrations.length === 0) {
      const a = el("a", "", "Browse events");
      a.href = "events.html";
      empty.append(" ", a);
    }
  }
}

function certificateCard(reg) {
  const ev = reg.event;
  const li = el("li", "card card--attended");

  const top = el("div", "card__top");
  top.appendChild(el("h3", "card__title", ev.title));
  top.appendChild(el("span", "badge badge--attended", "Certificate ready"));
  li.appendChild(top);
  li.appendChild(el("p", "card__meta", formatDate(ev.startDatetime) + (ev.university ? " · " + ev.university.name : "")));

  const btn = el("button", "btn", "Download certificate (PDF)");
  btn.type = "button";
  btn.addEventListener("click", () => downloadCertificate(ev, btn));
  li.appendChild(btn);
  return li;
}

function pendingCard(reg) {
  const li = el("li", "card");
  const top = el("div", "card__top");
  top.appendChild(el("h3", "card__title", reg.event.title));
  top.appendChild(el("span", "badge", "After the event"));
  li.appendChild(top);
  li.appendChild(el("p", "card__meta", "You're checked in. Your certificate unlocks once this event ends."));
  return li;
}

function renderCertificates() {
  const ready = registrations.filter((r) => r.certificateAvailable);
  const pending = registrations.filter(
    (r) => !r.certificateAvailable && r.attendance?.isConfirm && r.event.status !== "cancelled"
  );

  const list = byId("certList");
  list.replaceChildren();
  ready.forEach((r) => list.appendChild(certificateCard(r)));

  const empty = byId("certsEmpty");
  empty.hidden = ready.length > 0 || pending.length > 0;
  empty.textContent = "No certificates yet. Attend an event and get checked in to earn one.";

  const pendingList = byId("pendingList");
  pendingList.replaceChildren();
  pending.forEach((r) => pendingList.appendChild(pendingCard(r)));
  byId("pendingHead").hidden = pending.length === 0;

  byId("statCerts").textContent = ready.length;
}

async function downloadCertificate(ev, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing…";
  try {
    const res = await fetch(`${API_URL}/events/${ev.id}/certificate`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (res.status === 401) {
      goToLogin();
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showMessage(data.message || "Could not get the certificate.");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate - ${ev.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    showMessage("Can't reach the server. Make sure the backend is running.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function renderQr(student) {
  if (!student?.qrToken || typeof QRCode === "undefined") {
    byId("qrcode").textContent = "Your QR code isn't available right now.";
    return;
  }
  new QRCode(byId("qrcode"), { text: student.qrToken, width: 220, height: 220 });
}

// ---------- Tabs and filters ----------

function selectTab(name) {
  ["events", "certs", "qr"].forEach((n) => {
    byId("tab-" + n).setAttribute("aria-selected", String(n === name));
    byId("panel-" + n).hidden = n !== name;
  });
}

["events", "certs", "qr"].forEach((n) => {
  byId("tab-" + n).addEventListener("click", () => selectTab(n));
});

byId("filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  activeFilter = chip.dataset.filter;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
  renderEvents();
});

byId("logoutBtn").addEventListener("click", goToLogin);

// ---------- Start ----------

async function init() {
  if (!token) return goToLogin();

  try {
    const me = await apiGet("/auth/me");

    if (me.role !== "student") {
      showMessage("This page is for student accounts.", "events.html", "Go to events");
      return;
    }

    // /auth/me puts the student details under "profile"
    const student = me.profile;
    const firstName = (me.fullName || "").split(" ")[0];
    byId("greeting").textContent = firstName ? `Hi, ${firstName}!` : "My events";
    byId("subline").textContent = [student?.university?.name, student?.courseProgram, student?.yearLevel && "Year " + student.yearLevel]
      .filter(Boolean)
      .join(" · ");

    registrations = await apiGet("/registrations/mine");

    byId("statJoined").textContent = registrations.length;
    byId("statAttended").textContent = registrations.filter((r) => statusOf(r) === "attended").length;
    byId("statMissed").textContent = registrations.filter((r) => statusOf(r) === "missed").length;

    byId("content").hidden = false;
    renderEvents();
    renderCertificates();
    renderQr(student);
  } catch (err) {
    showMessage(err.message);
  }
}

init();
