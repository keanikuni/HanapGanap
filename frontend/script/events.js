// Events listing: load the events from the API, build the cards, and sort them.
// Needs main.js loaded first (API_URL, toEvent, formatDate).
const grid = document.getElementById("events-grid");
const sortSelect = document.getElementById("sort");
let events = [];

function showMessage(text) {
  grid.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = text;
  grid.appendChild(p);
}

function renderEvents(list) {
  if (list.length === 0) {
    showMessage("No events yet. Check back soon!");
    return;
  }

  grid.innerHTML = "";
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
      img.loading = "lazy";
      thumb.appendChild(img);
    }

    // textContent, not innerHTML: titles and venues are typed in by organizers
    const title = document.createElement("h2");
    title.textContent = ev.title;

    const info = document.createElement("p");
    info.textContent = `${ev.location} · ${formatDate(ev.start_datetime)}`;

    card.append(thumb, title, info);
    grid.appendChild(card);
  });
}

function sortEvents(by) {
  const copy = [...events];
  if (by === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
  if (by === "date") copy.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  if (by === "category") copy.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
  renderEvents(copy);
}

sortSelect.addEventListener("change", () => sortEvents(sortSelect.value));

async function loadEvents() {
  showMessage("Loading events…");
  try {
    const res = await fetch(`${API_URL}/events`);
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    events = (await res.json()).map(toEvent);
  } catch (err) {
    console.error("Could not load events:", err);
    showMessage("Couldn't load events. Make sure the backend is running, then refresh.");
    return;
  }
  sortEvents(sortSelect.value);
}

document.addEventListener("DOMContentLoaded", loadEvents);
