// Events listing: build the cards from the data, and sort them
const grid = document.getElementById("events-grid");
const sortSelect = document.getElementById("sort");

function renderEvents(list) {
  grid.innerHTML = "";
  list.forEach((ev) => {
    const card = document.createElement("a");
    card.className = "event-card";
    card.href = `event.html?id=${ev.event_id}`;
    card.innerHTML = `
      <div class="thumb">${ev.image_path ? `<img src="${ev.image_path}" alt="">` : ""}</div>
      <h2>${ev.title}</h2>
      <p>${ev.location} &middot; ${formatDate(ev.start_datetime)}</p>
    `;
    grid.appendChild(card);
  });
}

function sortEvents(by) {
  const copy = [...events];
  if (by === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
  if (by === "date") copy.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  if (by === "category") copy.sort((a, b) => a.category.localeCompare(b.category));
  renderEvents(copy);
}

sortSelect.addEventListener("change", () => sortEvents(sortSelect.value));
sortEvents("date");
