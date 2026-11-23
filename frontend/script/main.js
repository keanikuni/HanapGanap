// Shared by every page that loads it: where the backend is, small helpers, the nav toggle.

// The backend serves these pages itself (https://localhost:8000/frontend/events.html), so the
// API lives on the same address as the page. That avoids the old http://localhost:8000 mistake:
// the server only speaks HTTPS, so plain http never connected.
//
// Opened straight from disk (file://)? Fall back to the local backend.
// Hosting the pages somewhere else than the backend? Set this BEFORE main.js loads:
//   <script>window.HG_BACKEND = "https://your-backend.example.com";</script>
const BACKEND = (window.HG_BACKEND
  || (location.protocol.startsWith("http") ? location.origin : "https://localhost:8000")
).replace(/\/$/, "");
const API_URL = `${BACKEND}/api`;
const FILE_URL = BACKEND;

// Nav toggle (only on pages that have it)
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".main-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen);
  });
}

// Event times are stored in UTC. Show them in Philippine time for everyone.
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

// Uploaded images are stored as "/uploads/<file>" (served by the backend); the demo data
// uses full https:// links. Accept both.
function imageUrl(path) {
  if (!path) return "";
  return /^https?:\/\//i.test(path) ? path : FILE_URL + path;
}

// Turns one event from the API into the flat shape the pages use
function toEvent(e) {
  return {
    event_id: e.id,
    title: e.title,
    description: e.description,
    location: e.venue,
    start_datetime: e.startDatetime,
    end_datetime: e.endDatetime,
    registration_deadline: e.registrationDeadline,
    status: e.status,
    category: e.category?.name,
    university: e.university?.name,
    org_name: e.organizer?.orgName,
    slots_taken: e._count?.registrations ?? 0,
    participant_limit: e.participantLimit,
    image_path: e.images?.length ? imageUrl(e.images[0].filePath) : "",
  };
}
