import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import * as money from '../service/money.js';
import { PaymentError } from '../service/amount.js';
import { imageExtension, storeImage } from '../service/storage.js';
import { DEFAULT_WITHDRAWAL_APPROVAL_LIMIT, hasPermission } from '../service/permissions.js';
import { recordAdminAction } from '../service/audit.js';

// Payouts leave the platform on the member's own UPI id, and the QR image of
// that UPI id is mandatory: it is snapshotted on the request so operations pays
// exactly what was asked for.
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;
const MAX_QR_BYTES = 5 * 1024 * 1024; // matches the multer limit

/** The owner-set ceiling for a non-owner approval, with a safe fallback. */
async function approvalLimit(): Promise<number> {
  const setting = await prisma.setting.findFirst({ select: { withdrawalApprovalLimit: true } });
  const stored = setting?.withdrawalApprovalLimit;
  return stored === null || stored === undefined ? DEFAULT_WITHDRAWAL_APPROVAL_LIMIT : Number(stored);
}

export const withdrawalController = {
  // Create a new withdrawal (amount in INR + the member's UPI payout details)
  async createWithdrawal(req: Request, res: Response) {
    try {
      const { userId, amount, upiId, qrCodeUrl } = req.body ?? {};
      if (typeof userId !== 'string' || !userId || typeof upiId !== 'string' || !upiId.trim()) {
        return res.status(400).json({ error: 'userId, amount, and upiId are required' });
      }
      const destination = upiId.trim();
      if (!UPI_ID_PATTERN.test(destination)) {
        return res.status(400).json({ error: 'UPI id must look like name@bank' });
      }
      // The payout QR is mandatory: operations pays from the image attached to
      // the request, so a withdrawal without one is refused up front.
      if (typeof qrCodeUrl !== 'string' || !qrCodeUrl.trim()) {
        return res.status(400).json({ error: 'Payout QR code is required' });
      }
      const result = await money.createWithdrawal(userId, amount, destination, qrCodeUrl.trim());
      return res.status(201).json({ message: 'Withdrawal request created successfully', data: result });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error('Error creating withdrawal:', error);
      return res.status(500).json({ error: 'Failed to create withdrawal' });
    }
  },

  /**
   * Uploads the member's payout QR image (multipart field `qrCodeImage`) and
   * returns only the stored URL, which the withdraw form then submits with the
   * request. Cloudinary is used when configured, otherwise the API's disk.
   */
  async uploadQrCode(req: Request, res: Response) {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'qrCodeImage file is required' });
      }
      if (!imageExtension(file.mimetype)) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Only JPEG, PNG, and WEBP images are allowed' });
      }
      if (file.size > MAX_QR_BYTES) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'File size must be less than 5MB' });
      }
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const stored = await storeImage(file, 'payout-qr', baseUrl);
      return res.status(StatusCodes.CREATED).json({
        message: 'Payout QR uploaded successfully',
        data: { qrCodeUrl: stored.url, storage: stored.storage },
      });
    } catch (error) {
      console.error('Error uploading payout QR:', error);
      return res.status(500).json({ error: 'Failed to upload payout QR' });
    }
  },

  // Get a withdrawal by ID
  async getWithdrawalById(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!withdrawal) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Withdrawal not found',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: withdrawal,
      });
    } catch (error) {
      console.error('Error fetching withdrawal:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch withdrawal',
      });
    }
  },

  // Get all withdrawals
  async getAllWithdrawals(req: Request, res: Response) {
    try {
      const withdrawals = await prisma.withdrawal.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: withdrawals,
      });
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch withdrawals',
      });
    }
  },

  // Update a withdrawal (Admin Action: approve or reject)
  async updateWithdrawal(req: Request, res: Response) {
    try {
      const principal = res.locals.principal;
      if (!principal || principal.kind !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { status } = req.body ?? {};
      if (status !== 'APPROVED' && status !== 'REJECTED') {
        return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
      }
      // Approving and rejecting are separate rights, so an account may hold one.
      const needed = status === 'APPROVED' ? 'withdrawals:approve' : 'withdrawals:reject';
      if (!hasPermission(principal, needed)) {
        return res.status(403).json({ error: `Missing permission: ${needed}` });
      }

      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, userId: true, amount: true, upiId: true, status: true },
      });
      if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

      // A non-owner may only release a payout up to the platform's approval limit;
      // anything above it is the owner's call, whatever the permission list says.
      if (status === 'APPROVED' && principal.role !== 'SUPER_ADMIN') {
        const limit = await approvalLimit();
        if (Number(withdrawal.amount.toString()) > limit) {
          return res.status(403).json({
            error: `This payout of ₹${withdrawal.amount} is above the ₹${limit} approval limit. The owner has to approve it.`,
          });
        }
      }

      const updated = await money.processWithdrawal(req.params.id as string, status);
      await recordAdminAction(principal, {
        action: status === 'APPROVED' ? 'withdrawals:approve' : 'withdrawals:reject',
        entity: 'withdrawal',
        entityId: withdrawal.id,
        summary: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} a payout of ₹${withdrawal.amount} to ${withdrawal.upiId}`,
        before: { status: withdrawal.status },
        after: { status },
      }, req);
      return res.status(200).json({ message: `Withdrawal ${status.toLowerCase()} successfully`, data: updated });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error('Error updating withdrawal:', error);
      return res.status(500).json({ error: 'Failed to update withdrawal' });
    }
  },

  // Only pending withdrawals may be cancelled/deleted; retain processed history.
  async deleteWithdrawal(req: Request, res: Response) {
    try {
      const principal = res.locals.principal;
      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, amount: true, upiId: true, status: true },
      });
      if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
      await money.processWithdrawal(req.params.id as string, 'REJECTED', true);
      await recordAdminAction(principal, {
        action: 'withdrawals:delete',
        entity: 'withdrawal',
        entityId: withdrawal.id,
        summary: `Deleted a pending payout of ₹${withdrawal.amount} (amount refunded to the member)`,
        before: { status: withdrawal.status },
      }, req);
      return res.status(200).json({ message: 'Withdrawal deleted successfully' });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error('Error deleting withdrawal:', error);
      return res.status(500).json({ error: 'Failed to delete withdrawal' });
    }
  },

  // Get withdrawals by user ID
  async getWithdrawalsByUserId(req: Request, res: Response) {
    try {
      const userId  = req.params.userId as string;

      const withdrawals = await prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: withdrawals,
      });
    } catch (error) {
      console.error('Error fetching withdrawals by user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch withdrawals',
      });
    }
  },
};
