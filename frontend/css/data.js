const events = [
  { event_id: 1, title: "Tech Fair", description: "A day of demos and talks from student developers.", category: "Technical", org_name: "Maria", university: "Sample University", location: "Main Gym", start_datetime: "2026-12-03 09:00:00", end_datetime: "2026-12-03 17:00:00", status: "upcoming", image_path: "" },
  { event_id: 2, title: "Sports Fest", description: "Inter-department games all day.", category: "Sports", org_name: "Jake", university: "Sample University", location: "Open Field", start_datetime: "2026-11-10 08:00:00", end_datetime: "2026-11-10 18:00:00", status: "ongoing", image_path: "" },
  { event_id: 3, title: "Music Concert", description: "Live performances by campus bands.", category: "Arts", org_name: "Sofia", university: "Sample University", location: "Auditorium", start_datetime: "2026-10-20 18:00:00", end_datetime: "2026-10-20 21:00:00", status: "completed", image_path: "" },
  { event_id: 4, title: "Art Workshop", description: "Hands-on painting session.", category: "Arts", org_name: "Luis", university: "Sample University", location: "Room 204", start_datetime: "2026-11-15 13:00:00", end_datetime: "2026-11-15 16:00:00", status: "cancelled", image_path: "" },
  { event_id: 5, title: "Science Quiz Bee", description: "Teams compete in a science quiz.", category: "Academic", org_name: "Andrea", university: "Sample University", location: "Library", start_datetime: "2026-12-10 13:00:00", end_datetime: "2026-12-10 16:00:00", status: "upcoming", image_path: "" },
  { event_id: 6, title: "Career Day", description: "Meet employers and recruiters.", category: "Career", org_name: "Paolo", university: "Sample University", location: "Covered Court", start_datetime: "2026-12-15 09:00:00", end_datetime: "2026-12-15 15:00:00", status: "upcoming", image_path: "" }
];

function formatDate(datetime) {
  // "2026-12-03 09:00:00" -> "Dec 3, 2026, 9:00 AM"
  return new Date(datetime.replace(" ", "T")).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  });
}
