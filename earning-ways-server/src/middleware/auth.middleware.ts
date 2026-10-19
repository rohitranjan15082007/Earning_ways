import type { RequestHandler } from "express";
import prisma from "../config/prisma.js";
import { JWT } from "../utils/jwt.utils.js";
import { effectivePermissions, hasPermission, type PermissionKey } from "../service/permissions.js";

export type Principal = {
  id: string;
  kind: "user" | "admin";
  role?: string;
  email?: string;
  /** Effective permissions. Always re-read from the database, never trusted from the token. */
  permissions: PermissionKey[];
};
declare global {
  namespace Express {
    interface Locals { principal?: Principal }
  }
}

export const authenticate: RequestHandler = async (req, res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") || "");
  if (!match) {
    res.status(401).json({ error: "A valid Bearer token is required" });
    return;
  }
  let identity;
  try { identity = JWT.verifyToken(match[1]!); }
  catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  try {
    if (identity.kind === "admin") {
      const account = await prisma.admin.findUnique({
        where: { id: identity.id },
        select: { id: true, email: true, role: true, permissions: true, isActive: true, tokenVersion: true },
      });
      if (!account) {
        res.status(401).json({ error: "Account no longer exists" });
        return;
      }
      if (identity.tokenVersion !== account.tokenVersion) {
        res.status(401).json({ error: "Token has been revoked; please sign in again" });
        return;
      }
      // A deactivated admin loses access on the next call, even with a live token.
      if (account.isActive === false) {
        res.status(401).json({ error: "This admin account has been deactivated" });
        return;
      }
      // Permissions come from the row, so a change applies immediately. The gate
      // resolves the *effective* list, which never contains an owner-only key, so
      // even a hand-edited row cannot hand a sub-admin the owner's rights.
      res.locals.principal = {
        id: account.id,
        kind: "admin",
        email: account.email,
        role: account.role,
        permissions: effectivePermissions(account.role, account.permissions),
      };
      next();
      return;
    }

    const account = await prisma.user.findUnique({ where: { id: identity.id }, select: { id: true, tokenVersion: true } });
    if (!account) {
      res.status(401).json({ error: "Account no longer exists" });
      return;
    }
    // Password changes and logout bump the stored version, revoking old tokens.
    if (identity.tokenVersion !== account.tokenVersion) {
      res.status(401).json({ error: "Token has been revoked; please sign in again" });
      return;
    }
    res.locals.principal = { id: account.id, kind: "user", permissions: [] };
    next();
  } catch (error) { next(error); }
};

// Public catalog requests may omit a token; supplied tokens must still be valid.
export const optionalAuthenticate: RequestHandler = (req, res, next) => {
  if (req.get("Authorization") !== undefined) return authenticate(req, res, next);
  next();
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.principal?.kind !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};

export const requireSuperAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.principal?.kind !== "admin" || res.locals.principal.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
};

export const ownIdentity = (source: "params" | "body" | "query", key: string): RequestHandler =>
  (req, res, next) => {
    const principal = res.locals.principal;
    if (!principal) { res.status(401).json({ error: "Authentication required" }); return; }
    if (principal.kind !== "admin" && req[source]?.[key] !== principal.id) {
      res.status(403).json({ error: "Access to another user's data is forbidden" });
      return;
    }
    next();
  };

/**
 * Member self-service OR an admin holding `permission`.
 *
 * Many read endpoints serve both sides (a member reading their own dashboard,
 * an operator reading the same member from the panel). An admin branch is only
 * taken when the account actually holds the permission, so a sub-admin cannot
 * reach member data through the self-service path.
 */
export const ownIdentityOr = (source: "params" | "body" | "query", key: string, permission: PermissionKey): RequestHandler =>
  (req, res, next) => {
    const principal = res.locals.principal;
    if (!principal) { res.status(401).json({ error: "Authentication required" }); return; }
    if (principal.kind === "admin") {
      if (!hasPermission(principal, permission)) {
        res.status(403).json({ error: `Missing permission: ${permission}` });
        return;
      }
      next();
      return;
    }
    if (req[source]?.[key] !== principal.id) {
      res.status(403).json({ error: "Access to another user's data is forbidden" });
      return;
    }
    next();
  };

export type Resource = "investment" | "withdrawal" | "transaction" | "roi" | "transfer" | "referral" | "support";
/** Member ownership OR an admin holding `permission` (see ownIdentityOr). */
export const ownResourceOr = (resource: Resource, permission: PermissionKey, key = "id"): RequestHandler =>
  ownResourceInternal(resource, permission, key);

export const ownResource = (resource: Resource, key = "id"): RequestHandler =>
  ownResourceInternal(resource, null, key);

const ownResourceInternal = (resource: Resource, permission: PermissionKey | null, key: string): RequestHandler =>
  async (req, res, next) => {
    const principal = res.locals.principal;
    if (!principal) { res.status(401).json({ error: "Authentication required" }); return; }
    // Admins reach individual resources through the panel; the permission that
    // matches the resource is what lets them through.
    if (principal.kind === "admin") {
      if (permission && !hasPermission(principal, permission)) {
        res.status(403).json({ error: `Missing permission: ${permission}` });
        return;
      }
      next();
      return;
    }
    const id = req.params[key];
    if (typeof id !== "string") { res.status(400).json({ error: "Resource ID required" }); return; }
    try {
      const where = { id };
      let owners: string[] | undefined;
      switch (resource) {
        case "investment": { const row = await prisma.investment.findUnique({ where, select: { userId: true } }); owners = row && [row.userId] || undefined; break; }
        case "withdrawal": { const row = await prisma.withdrawal.findUnique({ where, select: { userId: true } }); owners = row && [row.userId] || undefined; break; }
        case "transaction": { const row = await prisma.transaction.findUnique({ where, select: { userId: true } }); owners = row && [row.userId] || undefined; break; }
        case "roi": { const row = await prisma.rOIRecord.findUnique({ where, select: { userId: true } }); owners = row && [row.userId] || undefined; break; }
        case "support": { const row = await prisma.supportTicket.findUnique({ where, select: { userId: true } }); owners = row && [row.userId] || undefined; break; }
        case "transfer": { const row = await prisma.transfer.findUnique({ where, select: { senderId: true, receiverId: true } }); owners = row && [row.senderId, row.receiverId] || undefined; break; }
        case "referral": { const row = await prisma.referral.findUnique({ where, select: { referrerId: true, referredUserId: true } }); owners = row && [row.referrerId, row.referredUserId] || undefined; break; }
      }
      if (!owners?.includes(principal.id)) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }
      next();
    } catch (error) { next(error); }
  };
