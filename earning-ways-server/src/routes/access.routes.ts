import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { credentialRateLimit } from "../middleware/rateLimit.middleware.js";
import { requirePermission, requireOwner } from "../middleware/permission.middleware.js";
import {
  authenticate, optionalAuthenticate, requireAdmin,
  ownIdentityOr, ownResourceOr,
} from "../middleware/auth.middleware.js";
import { hasPermission } from "../service/permissions.js";

// Mounted before every domain router. This file is the single access policy:
// a matched rule proceeds to the controller, everything else is refused at the
// bottom. An admin reaches an operation only by holding the permission that
// matches it, so a sub-admin's rights live in one auditable place.
//
// Ordering note: literal paths (`/user/all`) must be registered before the
// parameterised ones (`/user/:id`), because Express takes the first match.
const accessRoutes = Router({ caseSensitive: true, strict: true });
const allowed = (_req: Request, _res: Response, next: NextFunction) => next("router");

// ------------------------------------------------------------------- public
accessRoutes.post("/user/create", credentialRateLimit(10, "member-signup"), allowed);
accessRoutes.post("/user/login", credentialRateLimit(10, "member-login"), allowed);
accessRoutes.post("/admin/login", credentialRateLimit(10, "admin-login"), allowed);
// Public and unauthenticated, so it needs its own ceiling against form spam.
accessRoutes.post("/enquiry", credentialRateLimit(20, "enquiry"), allowed);
// The public settings document carries no credentials and drives the landing page.
accessRoutes.get("/setting", allowed);
accessRoutes.get(["/subscription/all", "/subscription/:id"], optionalAuthenticate, allowed);
// Display-only Telegram Stars pricing; the token and webhook secret are never
// part of this response. The webhook authenticates with its secret-token header.
accessRoutes.get("/payment/telegram/config", allowed);
accessRoutes.post("/payment/telegram/webhook", allowed);

accessRoutes.use(authenticate);

// ------------------------------------------- any signed-in identity (member or admin)
accessRoutes.post(["/user/logout", "/admin/logout"], allowed);
// An admin changes their own password; the team page tells them when they must.
accessRoutes.post("/admin/password", allowed);
// Capability names only (no credentials), used to render the team page.
accessRoutes.get("/admin/permissions", allowed);
// A signed-in member uploads their own payout QR image.
accessRoutes.post("/withdraw/qr", allowed);
// Member-facing Stars rail (ownership of the intent is checked in the controller).
accessRoutes.post("/payment/telegram/invoice", allowed);
accessRoutes.get("/payment/telegram/status/:paymentId", allowed);

// ------------------------------------------------------------------- admin: team
accessRoutes.post("/admin/register", requireOwner, allowed);
accessRoutes.get("/admin/policy", requirePermission("team:read"), allowed);
accessRoutes.put("/admin/policy", requireOwner, allowed);
accessRoutes.get("/admin/audit", requirePermission("audit:read"), allowed);
accessRoutes.get("/admin", requirePermission("team:read"), allowed);
accessRoutes.patch("/admin/:id", requireOwner, allowed);
accessRoutes.post("/admin/:id/password", requireOwner, allowed);
accessRoutes.post("/admin/:id/revoke", requireOwner, allowed);
accessRoutes.delete("/admin/:id", requireOwner, allowed);

// ------------------------------------------------- admin: literal list & create paths
accessRoutes.get("/user/all", requirePermission("users:read"), allowed);
accessRoutes.get("/withdraw/all", requirePermission("withdrawals:read"), allowed);
accessRoutes.get("/investment/all", requirePermission("investments:read"), allowed);
accessRoutes.get("/transaction/all", requirePermission("transactions:read"), allowed);
accessRoutes.get("/transfer/all", requirePermission("transfers:read"), allowed);
// `/record/all?userId=` is the query-string twin of `/record/user/:userId`: a
// member reads their own ROI rows, an operator reads them with `roi:read`.
accessRoutes.get("/record/all", ownIdentityOr("query", "userId", "roi:read"), allowed);
accessRoutes.get("/referral/all", requirePermission("referrals:read"), allowed);
accessRoutes.get("/support-tickets", requirePermission("support:read"), allowed);
accessRoutes.get("/notifications/all", requirePermission("notifications:read"), allowed);
accessRoutes.get(["/enquiry", "/enquiry/:id"], requirePermission("enquiries:read"), allowed);
accessRoutes.delete("/enquiry/:id", requirePermission("enquiries:delete"), allowed);
accessRoutes.get("/subscription/:id/investments", requirePermission("plans:read"), allowed);

accessRoutes.post("/subscription/create", requirePermission("plans:write"), allowed);
accessRoutes.put("/subscription/:id", requirePermission("plans:write"), allowed);
accessRoutes.delete("/subscription/:id", requirePermission("plans:write"), allowed);
accessRoutes.post("/investment/create", requirePermission("investments:write"), allowed);
accessRoutes.put("/investment/:id", requirePermission("investments:write"), allowed);
accessRoutes.delete("/investment/:id", requirePermission("investments:write"), allowed);
accessRoutes.post("/record/create", requirePermission("roi:write"), allowed);
accessRoutes.put("/record/:id", requirePermission("roi:write"), allowed);
accessRoutes.delete("/record/:id", requirePermission("roi:write"), allowed);
accessRoutes.post("/referral/create", requirePermission("referrals:write"), allowed);
accessRoutes.put("/referral/:id", requirePermission("referrals:write"), allowed);
accessRoutes.delete("/referral/:id", requirePermission("referrals:write"), allowed);
accessRoutes.post("/transaction/create", requirePermission("transactions:write"), allowed);
accessRoutes.put("/transaction/:id", requirePermission("transactions:write"), allowed);
accessRoutes.delete("/transaction/:id", requirePermission("transactions:write"), allowed);
accessRoutes.put("/transfer/:id", requirePermission("transfers:write"), allowed);
accessRoutes.delete("/transfer/:id", requirePermission("transfers:write"), allowed);
accessRoutes.post("/support-tickets", ownIdentityOr("body", "userId", "support:write"), allowed);
accessRoutes.put("/support-tickets/:id", requirePermission("support:write"), allowed);
accessRoutes.delete("/support-tickets/:id", requirePermission("support:write"), allowed);
accessRoutes.post("/notifications/create", requirePermission("notifications:send"), allowed);
accessRoutes.post("/transfer/create", ownIdentityOr("body", "senderId", "transfers:write"), allowed);
// Creating a wallet or a payout request for somebody else is a balance action.
accessRoutes.post("/wallet/create", ownIdentityOr("body", "userId", "wallets:adjust"), allowed);
accessRoutes.post("/withdraw/create", ownIdentityOr("body", "userId", "wallets:adjust"), allowed);
accessRoutes.put("/wallet/:userId", requirePermission("wallets:adjust"), allowed);
accessRoutes.delete("/wallet/:userId", requirePermission("wallets:adjust"), allowed);
accessRoutes.post("/setting/update/setting", requirePermission("settings:write"), allowed);

// Approve/reject is decided per status inside the controller (together with the
// approval limit), so reading the payout queue is the route-level gate.
accessRoutes.put("/withdraw/:id", requirePermission("withdrawals:read"), allowed);
accessRoutes.delete("/withdraw/:id", requirePermission("withdrawals:reject"), allowed);

// ------------------------------------------------------------- admin: Stars settings
// The response is masked, but the bot token and the on/off switch live behind
// it, so reading it needs the credentials permission as well.
accessRoutes.get("/payment/telegram/payments", requirePermission("payments:read"), allowed);
accessRoutes.get("/payment/telegram/settings", requirePermission("stars:credentials"), allowed);
accessRoutes.put("/payment/telegram/settings", requirePermission("stars:credentials"), allowed);
accessRoutes.post("/payment/telegram/setup", requirePermission("stars:credentials"), allowed);

// The panel's own summary cards; any back-office account may load them.
accessRoutes.get("/dashboardRoutes", requireAdmin, allowed);

// ------------------------------------------------- member self-service (per :id)
accessRoutes.get("/user/:id", ownIdentityOr("params", "id", "users:read"), allowed);
accessRoutes.put("/user/:id", ownIdentityOr("params", "id", "users:update"), balanceGuard, allowed);
// Deleting an account is never a self-service action.
accessRoutes.delete("/user/:id", requirePermission("users:delete"), allowed);
accessRoutes.get("/user/referrals/:id", ownIdentityOr("params", "id", "referrals:read"), allowed);
accessRoutes.get("/user/wallet/:id", ownIdentityOr("params", "id", "wallets:read"), allowed);
accessRoutes.get("/user-dashboard/:id", ownIdentityOr("params", "id", "users:read"), allowed);
accessRoutes.get("/wallet/:userId", ownIdentityOr("params", "userId", "wallets:read"), allowed);
accessRoutes.get("/withdraw/user/:userId", ownIdentityOr("params", "userId", "withdrawals:read"), allowed);
accessRoutes.get("/withdraw/:id", ownResourceOr("withdrawal", "withdrawals:read"), allowed);
accessRoutes.get("/investment/details/:id", ownResourceOr("investment", "investments:read"), allowed);
accessRoutes.get("/investment/:id", ownResourceOr("investment", "investments:read"), allowed);
accessRoutes.get("/record/user/:userId", ownIdentityOr("params", "userId", "roi:read"), allowed);
accessRoutes.get("/record/investment/:investmentId", ownResourceOr("investment", "roi:read", "investmentId"), allowed);
accessRoutes.get("/record/:id", ownResourceOr("roi", "roi:read"), allowed);
accessRoutes.get("/transaction/user/:userId", ownIdentityOr("params", "userId", "transactions:read"), allowed);
accessRoutes.get("/transaction/investment/:investmentId", ownResourceOr("investment", "transactions:read", "investmentId"), allowed);
accessRoutes.get("/transaction/:id", ownResourceOr("transaction", "transactions:read"), allowed);
accessRoutes.get("/transfer/sender/:senderId", ownIdentityOr("params", "senderId", "transfers:read"), allowed);
accessRoutes.get("/transfer/receiver/:receiverId", ownIdentityOr("params", "receiverId", "transfers:read"), allowed);
accessRoutes.get("/transfer/:id", ownResourceOr("transfer", "transfers:read"), allowed);
accessRoutes.get("/referral/referrer/:referrerId", ownIdentityOr("params", "referrerId", "referrals:read"), allowed);
accessRoutes.get("/referral/referred/:referredUserId", ownIdentityOr("params", "referredUserId", "referrals:read"), allowed);
accessRoutes.get("/referral/:id", ownResourceOr("referral", "referrals:read"), allowed);
accessRoutes.get("/notifications/:id", ownIdentityOr("params", "id", "users:read"), allowed);
accessRoutes.get("/support-tickets/user/:userId", ownIdentityOr("params", "userId", "support:read"), allowed);
accessRoutes.get("/support-tickets/:id", ownResourceOr("support", "support:read"), allowed);

// Anything not listed above is not part of the member or the admin surface.
accessRoutes.use((_req, res) => {
  res.status(403).json({ error: "This operation is not permitted" });
});

/**
 * `PUT /user/:id` also edits the guarded balance columns. A manager may correct
 * a profile, but moving money by hand stays with the owner.
 */
function balanceGuard(req: Request, res: Response, next: NextFunction) {
  const principal = res.locals.principal;
  if (principal?.kind === "admin" && principal.role !== "SUPER_ADMIN") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const touchesMoney = ["inrBalance", "totalEarnings", "totalReferrals", "currentLevel"]
      .some(key => key in body);
    if (touchesMoney && !hasPermission(principal, "wallets:adjust")) {
      res.status(403).json({ error: "Missing permission: wallets:adjust" });
      return;
    }
  }
  next();
}

export default accessRoutes;
