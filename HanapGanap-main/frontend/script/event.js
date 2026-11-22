// ✅ Configuration
const API_URL = "https://localhost:8000/api";
const grid = document.getElementById("events-grid");
const sortSelect = document.getElementById("sort");

// ✅ Helper function: Format date
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });
}

// ✅ Render events to the page
function renderEvents(list) {
  grid.innerHTML = "";
  
  if (list.length === 0) {
    grid.innerHTML = `<p class="empty" style="grid-column:1/-1;text-align:center;padding:2rem;">No events yet. Check back soon!</p>`;
    return;
  }
  
  list.forEach((ev) => {
    const card = document.createElement("a");
    card.className = "event-card";
    card.href = `event.html?id=${ev.event_id}`;
    card.innerHTML = `
      <div class="thumb">${ev.image_path ? `<img src="${ev.image_path}" alt="${ev.title}">` : ""}</div>
      <h3>${ev.title}</h3>
      <p>${ev.location} &middot; ${formatDate(ev.start_datetime)}</p>
    `;
    grid.appendChild(card);
  });
}

// ✅ Sort events
function sortEvents(list, by) {
  return [...list].sort((a, b) => {
    if (by === "newest") return new Date(b.start_datetime) - new Date(a.start_datetime);
    if (by === "oldest") return new Date(a.start_datetime) - new Date(b.start_datetime);
    if (by === "title") return a.title.localeCompare(b.title);
    return 0;
  });
}

// ✅ Fetch and display events
async function fetchEvents() {
  try {
    const res = await fetch(`${API_URL}/events`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    
    const data = await res.json();
    renderEvents(data);
    
    // Sort handler
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        const sorted = sortEvents(data, e.target.value);
        renderEvents(sorted);
      });
    }
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    grid.innerHTML = `<p class="empty" style="grid-column:1/-1;text-align:center;padding:2rem;color:red;">Failed to load events. Make sure backend is running at port 8000.</p>`;
  }
}

// ✅ Start
fetchEvents();
