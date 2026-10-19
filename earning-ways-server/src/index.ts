import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import errorMiddleware from "./middleware/error.middleware.js";
import investmentRoutes from "./routes/investment.routes.js";
import roiRecordRoutes from "./routes/recore.routes.js";
import referralRoutes from "./routes/refferel.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import support from "./routes/support.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import transferRoutes from "./routes/transfer.routes.js";
import userRoutes from "./routes/user.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import withdrawalRoutes from "./routes/withdraw.routes.js";

import cors from "cors";

import adminRoutes from "./routes/admin.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import telegramStarsRoutes from "./routes/telegramStars.routes.js";

import routers from "./routes/active.routes.js";
import enquiryRoutes from "./routes/enquiry.routes.js";
import userDashboardRoute from "./routes/userDashboard.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

import accessRoutes from "./routes/access.routes.js";
import { JWT } from "./utils/jwt.utils.js";

JWT.assertConfigured();
export const app = express();
app.disable("x-powered-by");
// The API runs behind a single proxy (Vercel / nginx) in production. Without
// this, `req.ip` is the proxy address and every client shares one rate-limit
// bucket; with it, the limiter sees the real client. It is only enabled in
// production, where the API is always behind that proxy, so a forged
// X-Forwarded-For header cannot be used in a direct local deployment.
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.enable("case sensitive routing");
app.enable("strict routing");

// Express otherwise treats case/trailing-slash variants as equivalent, so normalize
// before access checks to prevent a public catalog rule authorizing another handler.
app.use((req, _res, next) => {
  const [path, query] = req.url.split("?");
  req.url = (path!.replace(/\/+$/, "") || "/") + (query !== undefined ? `?${query}` : "");
  next();
});

// Baseline response hardening; no new dependency required.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// Both front-ends, plus the deployed origins when they are configured.
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:8081",
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL1,
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposedHeaders: ["Authorization"]
}));

// Telegram signs nothing; the raw body is kept so the secret-token header and
// the exact bytes can be checked before any parsing.
app.post('/api/payment/telegram/webhook', express.raw({ type: 'application/json', limit: '256kb' }));
app.use(express.json());
app.use(express.static("src/views"));
 
app.get("/", (req, res) => {
  return res.send("Hello World!");
});

// Payout QR images uploaded by members are stored on disk when Cloudinary is not
// configured, and served read-only from here.
const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
mkdirSync(path.join(uploadsDir, 'payout-qr'), { recursive: true });
app.use('/uploads', express.static(uploadsDir, { fallthrough: false, index: false, dotfiles: 'deny' }));

// Apply the access policy to every API route, including future domain endpoints.
app.use('/api', accessRoutes);

// routes
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/withdraw', withdrawalRoutes);
app.use('/api/investment', investmentRoutes);
app.use('/api/record', roiRecordRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/payment/telegram', telegramStarsRoutes);
app.use('/api/support-tickets', support);
app.use("/api/admin", adminRoutes);
app.use('/api/dashboardRoutes',dashboardRoutes);
app.use('/api/setting', routers);

app.use("/api/enquiry", enquiryRoutes);

app.use("/api/user-dashboard", userDashboardRoute)
app.use("/api/notifications", notificationRoutes);

app.use(errorMiddleware);

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
