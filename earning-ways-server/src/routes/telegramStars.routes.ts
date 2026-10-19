import { Router } from "express";
import telegramStarsController from "../controller/telegramStars.js";

// Mounted at /api/payment/telegram. The webhook has to stay public (Telegram
// calls it) and authenticates itself with the secret token header; every other
// route is policed by the access policy router.
const telegramStarsRoutes = Router({ caseSensitive: true, strict: true });

telegramStarsRoutes.get("/config", telegramStarsController.getStarsConfig);
telegramStarsRoutes.post("/invoice", telegramStarsController.createStarsInvoice);
telegramStarsRoutes.get("/status/:paymentId", telegramStarsController.getStarsPaymentStatus);
telegramStarsRoutes.post("/webhook", telegramStarsController.telegramWebhook);

telegramStarsRoutes.get("/payments", telegramStarsController.listStarsPayments);
telegramStarsRoutes.get("/settings", telegramStarsController.getStarsSettings);
telegramStarsRoutes.put("/settings", telegramStarsController.updateStarsSettings);
telegramStarsRoutes.post("/setup", telegramStarsController.setupStarsBot);

export default telegramStarsRoutes;
