import bcrypt from "bcryptjs";
import { JWT } from "../../utils/jwt.utils.js";
import { clearRateLimit } from "../../middleware/rateLimit.middleware.js";
import prisma from "../../config/prisma.js";
import type { Request, Response } from "express";
import {
  ALL_PERMISSIONS,
  DEFAULT_WITHDRAWAL_APPROVAL_LIMIT,
  effectivePermissions,
  permissionCatalogueForPanel,
  presetFor,
  sanitisePermissions,
} from "../../service/permissions.js";
import { recordAdminAction } from "../../service/audit.js";

// Back-office accounts. An owner (SUPER_ADMIN) manages the team; a sub-admin can
// only ever do what their stored permission list allows, and the owner-only
// permissions cannot be handed out at all.
const BCRYPT_COST = 10;
const MIN_PASSWORD_LENGTH = 8;
const ASSIGNABLE_ROLES = ['SUPER_ADMIN', 'FINANCE', 'SUPPORT', 'ANALYST', 'ADMIN'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicAdmin = (admin: {
  id: string; email: string; name: string | null; role: string; permissions: unknown;
  isActive: boolean; mustChangePassword: boolean; lastLoginAt: Date | null;
  createdAt: Date; createdById: string | null;
}) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  permissions: effectivePermissions(admin.role, admin.permissions),
  isActive: admin.isActive,
  mustChangePassword: admin.mustChangePassword,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
  createdById: admin.createdById,
});

const STRONG_ENOUGH = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH;

async function countActiveOwners(exceptId?: string): Promise<number> {
  return prisma.admin.count({
    where: {
      role: 'SUPER_ADMIN',
      isActive: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

// REGISTER ADMIN (owner only — enforced by the access policy router)
export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    const { email, password, role, name, permissions, mustChangePassword } = req.body ?? {};

    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    if (!STRONG_ENOUGH(password)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const wantedRole = role === undefined ? 'SUPPORT' : String(role);
    if (!ASSIGNABLE_ROLES.includes(wantedRole)) {
      return res.status(400).json({ message: `Role must be one of ${ASSIGNABLE_ROLES.join(', ')}` });
    }

    // Handing out ownership is a deliberate act: the owner re-enters their own
    // password, so a hijacked session alone cannot mint another owner.
    if (wantedRole === 'SUPER_ADMIN') {
      const ownerPassword = req.body?.ownerPassword;
      const me = actor ? await prisma.admin.findUnique({ where: { id: actor.id }, select: { password: true } }) : null;
      if (!me || typeof ownerPassword !== 'string' || !(await bcrypt.compare(ownerPassword, me.password))) {
        return res.status(400).json({ message: 'Enter your own password to create another owner' });
      }
    }

    const normalisedEmail = email.trim().toLowerCase();
    const adminExists = await prisma.admin.findUnique({ where: { email: normalisedEmail } });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);
    const granted = wantedRole === 'SUPER_ADMIN'
      ? ALL_PERMISSIONS
      : (Array.isArray(permissions) && permissions.length ? sanitisePermissions(permissions) : presetFor(wantedRole));

    const admin = await prisma.admin.create({
      data: {
        email: normalisedEmail,
        password: hashedPassword,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : null,
        role: wantedRole as never,
        permissions: granted,
        // A brand-new sub-admin must set their own password before doing work.
        mustChangePassword: mustChangePassword === undefined ? true : Boolean(mustChangePassword),
        isActive: true,
        createdById: actor?.id ?? null,
      },
    });

    await recordAdminAction(actor, {
      action: 'team:create',
      entity: 'admin',
      entityId: admin.id,
      summary: `Created ${admin.email} as ${admin.role} with ${granted.length} permission(s)`,
      after: { email: admin.email, role: admin.role, permissions: granted },
    }, req);

    return res.status(201).json({ message: 'Admin registered successfully', admin: publicAdmin(admin) });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// LOGIN ADMIN
export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!admin) {
      return res.status(404).json({ message: 'Invalid Email or Password' });
    }
    if (admin.isActive === false) {
      return res.status(403).json({ message: 'This admin account is deactivated. Ask the owner to re-enable it.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(404).json({ message: 'Invalid Email or Password' });
    }

    clearRateLimit(req);
    const token = JWT.generateToken({
      id: admin.id, email: admin.email, role: admin.role, kind: "admin", tokenVersion: admin.tokenVersion,
    });
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
      .catch(error => console.error('Failed to stamp lastLoginAt:', error));

    return res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: effectivePermissions(admin.role, admin.permissions),
        mustChangePassword: admin.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// LOGOUT ADMIN (revokes every token issued to this administrator)
export const logoutAdmin = async (req: Request, res: Response) => {
  try {
    const principal = res.locals.principal;
    if (!principal || principal.kind !== "admin") {
      return res.status(403).json({ message: "Admin session required" });
    }
    await prisma.admin.update({ where: { id: principal.id }, data: { tokenVersion: { increment: 1 } } });
    res.clearCookie("token");
    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET ALL ADMINS (team list — needs team:read)
export const getAllAdmins = async (_req: Request, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, email: true, name: true, role: true, permissions: true, isActive: true,
        mustChangePassword: true, lastLoginAt: true, createdAt: true, createdById: true,
      },
    });
    return res.json({ data: admins.map(publicAdmin) });
  } catch (error) {
    console.error("Fetch Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// UPDATE AN ADMIN (role, permissions, name, active flag) — owner only
export const updateAdmin = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    const id = req.params.id as string;
    const target = await prisma.admin.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ message: 'Admin not found' });

    const { role, permissions, name, isActive, mustChangePassword } = req.body ?? {};
    const data: Record<string, unknown> = {};
    const changes: string[] = [];

    if (typeof name === 'string') {
      data.name = name.trim() ? name.trim().slice(0, 80) : null;
      changes.push('name');
    }

    const wantsRoleChange = role !== undefined && String(role) !== target.role;
    const wantsPermissionChange = Array.isArray(permissions);

    if (target.id === actor?.id && (wantsRoleChange || wantsPermissionChange || isActive !== undefined)) {
      return res.status(400).json({ message: 'You cannot change your own role, permissions or active state' });
    }

    if (wantsRoleChange) {
      const wantedRole = String(role);
      if (!ASSIGNABLE_ROLES.includes(wantedRole)) {
        return res.status(400).json({ message: `Role must be one of ${ASSIGNABLE_ROLES.join(', ')}` });
      }
      // Never leave the platform without an owner who can sign in.
      if (target.role === 'SUPER_ADMIN' && wantedRole !== 'SUPER_ADMIN' && (await countActiveOwners(target.id)) === 0) {
        return res.status(400).json({ message: 'This is the last owner — promote another admin to owner first' });
      }
      data.role = wantedRole;
      changes.push(`role: ${target.role} → ${wantedRole}`);
      // No explicit list means "use the preset for the new role".
      if (!wantsPermissionChange) {
        data.permissions = wantedRole === 'SUPER_ADMIN' ? ALL_PERMISSIONS : presetFor(wantedRole);
      }
    }

    if (wantsPermissionChange) {
      const wanted = String((data.role as string) ?? target.role);
      data.permissions = wanted === 'SUPER_ADMIN' ? ALL_PERMISSIONS : sanitisePermissions(permissions);
      changes.push(`permissions: ${(data.permissions as string[]).length} key(s)`);
    }

    if (isActive !== undefined) {
      const active = Boolean(isActive);
      if (!active && target.role === 'SUPER_ADMIN' && (await countActiveOwners(target.id)) === 0) {
        return res.status(400).json({ message: 'This is the last active owner — deactivating would lock everyone out' });
      }
      data.isActive = active;
      changes.push(active ? 'activated' : 'deactivated');
    }

    if (mustChangePassword !== undefined) {
      data.mustChangePassword = Boolean(mustChangePassword);
      changes.push(mustChangePassword ? 'must change password' : 'password change cleared');
    }

    if (changes.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    // Role, permission and active-state changes must not survive in an open session.
    if (wantsRoleChange || wantsPermissionChange || isActive !== undefined) {
      data.tokenVersion = { increment: 1 };
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: data as never,
      select: {
        id: true, email: true, name: true, role: true, permissions: true, isActive: true,
        mustChangePassword: true, lastLoginAt: true, createdAt: true, createdById: true,
      },
    });

    await recordAdminAction(actor, {
      action: 'team:update',
      entity: 'admin',
      entityId: id,
      summary: `Updated ${target.email}: ${changes.join(', ')}`,
      before: { role: target.role, permissions: target.permissions, isActive: target.isActive },
      after: { role: updated.role, permissions: updated.permissions, isActive: updated.isActive },
    }, req);

    return res.json({ message: 'Admin updated', admin: publicAdmin(updated) });
  } catch (error) {
    console.error('Update admin error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// RESET ANOTHER ADMIN'S PASSWORD — owner only
export const resetAdminPassword = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    const id = req.params.id as string;
    const { password } = req.body ?? {};
    if (!STRONG_ENOUGH(password)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const target = await prisma.admin.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!target) return res.status(404).json({ message: 'Admin not found' });
    if (target.id === actor?.id) {
      return res.status(400).json({ message: 'Use "Change my password" for your own account' });
    }

    await prisma.admin.update({
      where: { id },
      data: {
        password: await bcrypt.hash(password, BCRYPT_COST),
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });

    await recordAdminAction(actor, {
      action: 'team:reset-password',
      entity: 'admin',
      entityId: id,
      summary: `Reset the password of ${target.email} and signed them out`,
    }, req);

    return res.json({ message: 'Password reset; the admin must change it at next sign-in' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// CHANGE MY OWN PASSWORD (any signed-in admin)
export const changeOwnPassword = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    if (!actor || actor.kind !== 'admin') return res.status(403).json({ message: 'Admin session required' });
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || !STRONG_ENOUGH(newPassword)) {
      return res.status(400).json({ message: `Current password and a new password of at least ${MIN_PASSWORD_LENGTH} characters are required` });
    }
    const me = await prisma.admin.findUnique({ where: { id: actor.id }, select: { email: true, password: true } });
    if (!me || !(await bcrypt.compare(currentPassword, me.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    await prisma.admin.update({
      where: { id: actor.id },
      data: {
        password: await bcrypt.hash(newPassword, BCRYPT_COST),
        mustChangePassword: false,
        // Every other session (and this token) is invalidated on a password change.
        tokenVersion: { increment: 1 },
      },
    });

    await recordAdminAction(actor, {
      action: 'team:change-password',
      entity: 'admin',
      entityId: actor.id,
      summary: `${actor.email} changed their own password`,
    }, req);

    return res.json({ message: 'Password changed — sign in again with the new password' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// FORCE SIGN-OUT of one admin (owner only)
export const revokeAdminSessions = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    const id = req.params.id as string;
    const target = await prisma.admin.findUnique({ where: { id }, select: { email: true } });
    if (!target) return res.status(404).json({ message: 'Admin not found' });

    await prisma.admin.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    await recordAdminAction(actor, {
      action: 'team:revoke-sessions',
      entity: 'admin',
      entityId: id,
      summary: `Signed ${target.email} out of every device`,
    }, req);

    return res.json({ message: 'All sessions for that admin are now revoked' });
  } catch (error) {
    console.error('Revoke sessions error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// DELETE ADMIN (owner only, with lockout guards)
export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    const id = req.params.id as string;
    const target = await prisma.admin.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
    if (!target) return res.status(404).json({ message: 'Admin not found' });
    if (target.id === actor?.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    if (target.role === 'SUPER_ADMIN' && (await countActiveOwners(target.id)) === 0) {
      return res.status(400).json({ message: 'This is the last owner — promote another admin to owner first' });
    }

    await prisma.admin.delete({ where: { id } });
    await recordAdminAction(actor, {
      action: 'team:delete',
      entity: 'admin',
      entityId: id,
      summary: `Deleted ${target.email}`,
      before: { email: target.email, role: target.role },
    }, req);

    return res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error("Delete Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// PERMISSION CATALOGUE for the team page (any admin may read it; it is a list
// of capability names, never credentials).
export const getPermissionCatalogue = async (_req: Request, res: Response) => {
  try {
    const mine = res.locals.principal;
    return res.json({
      data: {
        ...permissionCatalogueForPanel(),
        me: { id: mine?.id, email: mine?.email, role: mine?.role, permissions: mine?.permissions ?? [] },
      },
    });
  } catch (error) {
    console.error('Catalogue error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// PAYOUT APPROVAL LIMIT (owner only)
export const getPolicy = async (_req: Request, res: Response) => {
  try {
    const setting = await prisma.setting.findFirst({ select: { withdrawalApprovalLimit: true } });
    return res.json({
      data: {
        withdrawalApprovalLimit: setting?.withdrawalApprovalLimit
          ? Number(setting.withdrawalApprovalLimit)
          : DEFAULT_WITHDRAWAL_APPROVAL_LIMIT,
        isDefault: !setting?.withdrawalApprovalLimit,
      },
    });
  } catch (error) {
    console.error('Policy read error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updatePolicy = async (req: Request, res: Response) => {
  try {
    const actor = res.locals.principal;
    const raw = req.body?.withdrawalApprovalLimit;
    const limit = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      return res.status(400).json({ message: 'The payout approval limit must be a number of at least 0' });
    }

    const existing = await prisma.setting.findFirst({ select: { id: true } });
    const value = limit === null ? null : limit;
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { withdrawalApprovalLimit: value as never } });
    } else {
      await prisma.setting.create({ data: { withdrawalApprovalLimit: value as never } });
    }

    const effective = value ?? DEFAULT_WITHDRAWAL_APPROVAL_LIMIT;
    await recordAdminAction(actor, {
      action: 'settings:write',
      entity: 'setting',
      entityId: existing?.id ?? null,
      summary: `Payout approval limit set to ₹${effective}`,
      after: { withdrawalApprovalLimit: effective },
    }, req);

    return res.json({ data: { withdrawalApprovalLimit: effective, isDefault: value === null } });
  } catch (error) {
    console.error('Policy write error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
