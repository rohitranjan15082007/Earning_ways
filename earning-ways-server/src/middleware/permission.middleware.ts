import type { RequestHandler } from "express";
import { hasPermission, type PermissionKey } from "../service/permissions.js";

/**
 * Server-side permission gate. The admin row is re-read on every request by
 * `authenticate`, so removing a permission (or deactivating the account) takes
 * effect on the account's very next call — the panel hiding a button is only UX.
 */
export const requirePermission = (key: PermissionKey): RequestHandler =>
  (_req, res, next) => {
    const principal = res.locals.principal;
    if (!principal) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (principal.kind !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    if (!hasPermission(principal, key)) {
      res.status(403).json({ error: `Missing permission: ${key}` });
      return;
    }
    next();
  };

/** Owner-only operations, regardless of what any checkbox says. */
export const requireOwner: RequestHandler = (_req, res, next) => {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (principal.kind !== "admin" || principal.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
};
