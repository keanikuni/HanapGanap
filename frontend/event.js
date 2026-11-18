// Events View: read ?id= from the URL and fill in the page
const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id")) || 1;
const ev = events.find((e) => e.event_id === id);

function setText(elementId, text) {
  document.getElementById(elementId).textContent = text;
}

if (ev) {
  document.title = ev.title;

  setText("event-title", ev.title);
  setText("event-location", ev.location);
  setText("event-date", `${formatDate(ev.start_datetime)} to ${formatDate(ev.end_datetime)}`);
  setText("event-category", `Category: ${ev.category}`);
  setText("event-organizer", `Organizer: ${ev.org_name}`);
  setText("event-university", `University: ${ev.university}`);
  setText("event-status", `Status: ${ev.status}`);
  setText("event-desc", ev.description);

  if (ev.image_path) {
    document.getElementById("event-image").innerHTML =
      `<img src="${ev.image_path}" alt="${ev.title}">`;
  }
} else {
  setText("event-title", "Event not found");
}