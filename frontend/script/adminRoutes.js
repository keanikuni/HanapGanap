// adminRoutes.js
router.get("/users", async (req, res) => {
  try {
    res.json(await user_id.findMany());
  } catch (e) {
    res.status(500).json({ error: "Could not load users" });
  }
});

router.get("/organizers", async (req, res) => {
  try {
    res.json(await organizer_id.findMany());
  } catch (e) {
    res.status(500).json({ error: "Could not load organizers" });
  }
});

router.get("/events", async (req, res) => {
  try {
    res.json(await event_id.findMany());
  } catch (e) {
    res.status(500).json({ error: "Could not load events" });
  }
});