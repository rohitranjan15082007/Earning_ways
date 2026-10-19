import { Router } from "express";
import { createNotification, getAllNotifications, getNotificationByUserId } from "../controller/admin/notification.js";

const notificationRoutes = Router();

notificationRoutes.post("/create", createNotification);
notificationRoutes.get("/all", getAllNotifications);
notificationRoutes.get("/:id", getNotificationByUserId);

export default notificationRoutes;