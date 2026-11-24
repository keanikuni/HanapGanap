// Events listing: build the cards from the data, and sort them
// Needs main.js loaded first (API_URL, toEvent). data.js is optional (sample data).

let allEvents = [];   // renamed from "events" so it can't clash with window.events from data.js

// Use the project's formatDate if another file defines one, otherwise a simple fallback
const fmtDate =
  typeof formatDate === "function"
    ? formatDate
    : (value) => {
        const d = new Date(value);
        return isNaN(d)
          ? ""
          : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
      };

const startOf = (ev) => ev.start_datetime || ev.start_date;

function renderEvents(list) {
  const grid = document.getElementById("events-grid");
  grid.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No events found.";
    grid.appendChild(empty);
    return;
  }

  list.forEach((ev) => {
    const card = document.createElement("a");
    card.className = "event-card";
    card.href = `event.html?id=${encodeURIComponent(ev.event_id)}`;

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (ev.image_path) {
      const img = document.createElement("img");
      img.src = ev.image_path;
      img.alt = "";
      thumb.appendChild(img);
    }

    // textContent, so event titles/venues typed by organizers can't inject HTML
    const title = document.createElement("h2");
    title.textContent = ev.title;

    const details = document.createElement("p");
    details.textContent = `${ev.location || "TBA"} \u00B7 ${fmtDate(startOf(ev))}`;

    card.append(thumb, title, details);
    grid.appendChild(card);
  });
}

function sortEvents(by) {
  // The "Sort by" placeholder has the value "selection": treat it (or anything unknown) as date
  if (!["title", "date", "category"].includes(by)) by = "date";
  const copy = [...allEvents];
  if (by === "title") copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  if (by === "date") copy.sort((a, b) => new Date(startOf(a)) - new Date(startOf(b)));
  if (by === "category") copy.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
  renderEvents(copy);
}

// Fetch events; use the sample data (data.js) only if the backend is unavailable
async function loadEvents() {
  try {
    const res = await fetch(`${API_URL}/events`);
    if (!res.ok) throw new Error("Backend not available");
    const json = await res.json();
    // Accept either a plain array or an object like { events: [...] } / { data: [...] }
    const rawData = Array.isArray(json) ? json : json.events || json.data || [];
    console.log("Events from backend:", rawData);
    allEvents = rawData.map((item) => toEvent(item));
  } catch (err) {
    console.error("Using sample data instead:", err);
    allEvents = window.events || [];
  }
  sortEvents(document.getElementById("sort").value);
}

document.addEventListener("DOMContentLoaded", () => {
  const sortSelect = document.getElementById("sort");
  sortSelect.addEventListener("change", () => sortEvents(sortSelect.value));
  loadEvents();
});