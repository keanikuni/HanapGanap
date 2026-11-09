import { Router } from "express";
import authRoutes from "./authRoutes.js";
import universityRoutes from "./universityRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import eventRoutes from "./eventRoutes.js";
import registrationRoutes from "./registrationRoutes.js";
import certificateRoutes from "./certificateRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import attendanceRoutes from "./attendanceRoutes.js";
import adminRoutes from "./adminRoutes.js";

const router = Router();

// Routers with their own prefix
router.use("/auth", authRoutes);
router.use("/universities", universityRoutes);
router.use("/categories", categoryRoutes);
router.use("/events", eventRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/admin", adminRoutes);

// Routers that define their full paths (/events/:id/register, /certificates/mine, ...)
router.use("/", registrationRoutes);
router.use("/", certificateRoutes);
router.use("/", notificationRoutes);

export default router;