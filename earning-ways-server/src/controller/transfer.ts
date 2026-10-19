import  type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import * as money from '../service/money.js';
import { PaymentError } from '../service/amount.js';

export const transferController = {
  // Create a new transfer
  async createTransfer(req: Request, res: Response) {
    try {
      const { senderId, receiverId, amount, status, note } = req.body ?? {};
      if (typeof senderId !== 'string' || !senderId || typeof receiverId !== 'string' || !receiverId) {
        return res.status(400).json({ error: 'senderId, receiverId, and amount are required' });
      }
      if (status !== undefined && status !== 'PENDING') {
        return res.status(res.locals.principal?.kind === 'admin' ? 400 : 403).json({ error: 'Create a pending transfer first, then process it through the approval endpoint' });
      }
      if (note !== undefined && typeof note !== 'string') return res.status(400).json({ error: 'Note must be a string' });
      const transfer = await money.createTransfer(senderId, receiverId, amount, note);
      return res.status(201).json({ message: 'Transfer created successfully', data: transfer });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error('Error creating transfer:', error);
      return res.status(500).json({ error: 'Failed to create transfer' });
    }
  },

  // Get a transfer by ID
  async getTransferById(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const transfer = await prisma.transfer.findUnique({
        where: { id },
        include: {
          sender: {
            select: { id: true, name: true, email: true },
          },
          receiver: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!transfer) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Transfer not found',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: transfer,
      });
    } catch (error) {
      console.error('Error fetching transfer:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transfer',
      });
    }
  },

  // Get all transfers
  async getAllTransfers(req: Request, res: Response) {
    try {
      const transfers = await prisma.transfer.findMany({
        include: {
          sender: {
            select: { id: true, name: true, email: true },
          },
          receiver: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: transfers,
      });
    } catch (error) {
      console.error('Error fetching transfers:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transfers',
      });
    }
  },

  // Update a transfer
  async updateTransfer(req: Request, res: Response) {
    try {
      const updated = await money.updateTransfer(req.params.id as string, req.body ?? {});
      return res.status(200).json({ message: 'Transfer updated successfully', data: updated });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error('Error updating transfer:', error);
      return res.status(500).json({ error: 'Failed to update transfer' });
    }
  },

  async deleteTransfer(req: Request, res: Response) {
    try {
      await money.deleteTransfer(req.params.id as string);
      return res.status(200).json({ message: 'Transfer deleted successfully' });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error('Error deleting transfer:', error);
      return res.status(500).json({ error: 'Failed to delete transfer' });
    }
  },

  // Get transfers by sender ID
  async getTransfersBySenderId(req: Request, res: Response) {
    try {
      const senderId  = req.params.senderId as string;

      const sender = await prisma.user.findUnique({ where: { id: senderId } });
      if (!sender) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Sender not found',
        });
      }

      const transfers = await prisma.transfer.findMany({
        where: { senderId },
        include: {
          sender: {
            select: { id: true, name: true, email: true },
          },
          receiver: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: transfers,
      });
    } catch (error) {
      console.error('Error fetching transfers by sender:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transfers',
      });
    }
  },

  // Get transfers by receiver ID
  async getTransfersByReceiverId(req: Request, res: Response) {
    try {
      const receiverId  = req.params.receiverId as string;

      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      if (!receiver) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Receiver not found',
        });
      }

      const transfers = await prisma.transfer.findMany({
        where: { receiverId },
        include: {
          sender: {
            select: { id: true, name: true, email: true },
          },
          receiver: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: transfers,
      });
     } catch (error) {
      console.error('Error fetching transfers by receiver:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transfers',
      });
    }
  },
};