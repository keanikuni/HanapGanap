// Shared config: keep these first so they are always defined, even if the code below fails
const API_URL = "https://localhost:8000/api";
const FILE_URL = "https://localhost:8000";

// Nav toggle (shared by every page).
// The navbar is loaded later with fetch() on some pages, so listen on the document
// instead of looking for the button now. This works whether or not the nav exists yet.
document.addEventListener("click", (e) => {
  const toggle = e.target.closest(".nav-toggle");
  if (!toggle) return;
  const nav = document.querySelector(".main-nav");
  if (!nav) return;
  const isOpen = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", isOpen);
});

// Turn a stored file path into a full URL the browser can load
function fileUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.replace(/\\/g, "/");
  return FILE_URL + (clean.startsWith("/") ? "" : "/") + clean;
}

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
    org_name: e.organizer?.orgName,           // tingnan sa browser kung ito ang tamang pangalan
    slots_taken: e._count?.registrations,
    participant_limit: e.participantLimit,
    image_path: e.images?.length ? fileUrl(e.images[0].filePath) : ""
  };
}
