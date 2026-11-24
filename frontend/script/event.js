// Event detail page: shows the event picked on events.html (event.html?id=3)
// Needs main.js loaded first (API_URL, toEvent). data.js is optional (sample data).

const $el = (id) => document.getElementById(id);

const formatWhen = (value) => {
  const d = new Date(value);
  return isNaN(d)
    ? ""
    : d.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
};

function showMessage(text) {
  $el("event-title").textContent = text;
  ["event-location", "event-date", "event-category", "event-organizer", "event-university", "event-status", "event-desc"]
    .forEach((id) => ($el(id).textContent = ""));
}

function renderEvent(ev) {
  document.title = `${ev.title} | Event`;
  $el("event-title").textContent = ev.title || "Untitled event";
  $el("event-location").textContent = ev.location ? `Location: ${ev.location}` : "";

  const start = formatWhen(ev.start_datetime || ev.start_date);
  const end = formatWhen(ev.end_datetime || ev.end_date);
  $el("event-date").textContent = start ? `When: ${start}${end ? " to " + end : ""}` : "";

  $el("event-category").textContent = ev.category ? `Category: ${ev.category}` : "";
  $el("event-organizer").textContent = ev.org_name ? `Organizer: ${ev.org_name}` : "";
  $el("event-university").textContent = ev.university ? `University: ${ev.university}` : "";
  $el("event-status").textContent = ev.status ? `Status: ${ev.status}` : "";

  // textContent, so text typed by organizers can't inject HTML
  $el("event-desc").textContent = ev.description || "No description provided.";

  const imageBox = $el("event-image");
  imageBox.innerHTML = "";
  if (ev.image_path) {
    const img = document.createElement("img");
    img.src = ev.image_path;
    img.alt = ev.title || "";
    imageBox.appendChild(img);
  }
}

async function loadEvent() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    showMessage("No event selected.");
    return;
  }

  let ev = null;
  try {
    const res = await fetch(`${API_URL}/events/${encodeURIComponent(id)}`);
    if (res.status === 404) {
      showMessage("Event not found.");
      return;
    }
    if (!res.ok) throw new Error("Backend not available");
    const json = await res.json();
    console.log("Event from backend:", json);
    ev = toEvent(json.event || json.data || json);
  } catch (err) {
    console.error("Using sample data instead:", err);
    ev = (window.events || []).find((x) => String(x.event_id) === String(id)) || null;
  }

  if (!ev) {
    showMessage("Event not found.");
    return;
  }
  renderEvent(ev);
}

document.addEventListener("DOMContentLoaded", loadEvent);
