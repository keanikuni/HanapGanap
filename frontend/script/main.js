// Nav toggle (shared by every page)
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".main-nav");

toggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", isOpen);
});
const API_URL = "http://localhost:8000/api";
const FILE_URL = "http://localhost:8000";

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
    image_path: e.images?.length ? FILE_URL + e.images[0].filePath : ""
  };
}
