import type { Request, Response } from 'express';
import prisma from '../../config/prisma.js';
import { asyncHandler } from '../../middleware/error.middleware.js';

// Read side of the audit trail. Insertion happens in service/audit.ts so every
// module records its writes the same way.
export const listAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '25'), 10) || 25));
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  const adminId = typeof req.query.adminId === 'string' ? req.query.adminId.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (adminId) where.adminId = adminId;
  if (search) {
    where.OR = [
      { summary: { contains: search } },
      { adminEmail: { contains: search } },
      { entityId: { contains: search } },
    ];
  }
  if (from && !Number.isNaN(from.getTime())) where.createdAt = { ...(where.createdAt as object ?? {}), gte: from };
  if (to && !Number.isNaN(to.getTime())) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { ...(where.createdAt as object ?? {}), lte: end };
  }

  const [rows, total, actions] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { admin: { select: { id: true, email: true, role: true, isActive: true } } },
    }),
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
  ]);

  res.status(200).json({
    data: rows.map(row => ({
      id: row.id,
      adminId: row.adminId,
      adminEmail: row.adminEmail,
      admin: row.admin,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      summary: row.summary,
      before: row.before,
      after: row.after,
      ip: row.ip,
      createdAt: row.createdAt,
    })),
    actions: actions.map(entry => entry.action),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

export default { listAuditLog };
