import type { Request } from 'express';
import prisma from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';
import type { PermissionKey } from './permissions.js';

/**
 * Back-office audit trail.
 *
 * Every write an admin makes that touches money, members or configuration is
 * recorded with WHO did it and WHAT changed. Writing the entry must never break
 * the operation it describes, so a failure here is logged and swallowed — the
 * money path has already committed.
 */
export type AuditActor = { id?: string | null; email?: string | null; role?: string; permissions?: PermissionKey[] };

export type AuditInput = {
  action: string;
  summary: string;
  entity?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function recordAdminAction(actor: AuditActor | undefined, input: AuditInput, req?: Request): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: actor?.id ?? null,
        adminEmail: actor?.email ?? 'system',
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        before: (input.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (input.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ip: req
          ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || null
          : null,
      },
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}
