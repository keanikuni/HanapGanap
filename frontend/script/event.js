// Single event page: reads ?id= from the address and loads that event from the API.
// Needs main.js loaded first (API_URL, toEvent, formatDate).
const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id"));

function setText(elementId, text) {
  document.getElementById(elementId).textContent = text;
}

function showError(text) {
  document.title = "Event";
  setText("event-title", text);
}

function renderEvent(ev) {
  document.title = ev.title;

  setText("event-title", ev.title);
  setText("event-location", ev.location);
  setText("event-date", `${formatDate(ev.start_datetime)} to ${formatDate(ev.end_datetime)}`);
  setText("event-deadline", `Register by: ${formatDate(ev.registration_deadline)}`);
  setText("event-slots", `Registered: ${ev.slots_taken} / ${ev.participant_limit}`);
  setText("event-category", `Category: ${ev.category}`);
  setText("event-organizer", `Organizer: ${ev.org_name}`);
  setText("event-university", `University: ${ev.university}`);
  setText("event-status", `Status: ${ev.status}`);
  setText("event-desc", ev.description);

  if (ev.image_path) {
    const img = document.createElement("img");
    img.src = ev.image_path;
    img.alt = ev.title;
    document.getElementById("event-image").replaceChildren(img);
  }
}

async function loadEvent() {
  if (!Number.isInteger(id) || id < 1) return showError("Event not found");

  try {
    const res = await fetch(`${API_URL}/events/${id}`);
    if (res.status === 404 || res.status === 400) return showError("Event not found");
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    renderEvent(toEvent(await res.json()));
  } catch (err) {
    console.error("Could not load the event:", err);
    showError("Couldn't load this event. Make sure the backend is running, then refresh.");
  }
}

document.addEventListener("DOMContentLoaded", loadEvent);
