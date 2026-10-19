import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import type { Wallet } from '../../generated/prisma/index.js';


export const walletController = {
  // Create a new wallet
  async createWallet(req: Request, res: Response) {
    try {
      const { userId, upiId, qrCodeUrl, currency } = req.body;

      // Validate required fields
      if (!userId || !upiId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'userId and upiId are required',
        });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'User not found',
        });
      }

      // Check if wallet already exists for this user
      const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
      if (existingWallet) {
        return res.status(StatusCodes.CONFLICT).json({
          error: 'Wallet already exists for this user',
        });
      }

      // Create wallet
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          upiId,
          qrCodeUrl,
          currency: currency || 'INR',
          balance: 0,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return res.status(StatusCodes.CREATED).json({
        message: 'Wallet created successfully',
        data: wallet,
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create wallet',
      });
    }
  },

  // Get a wallet by userId
  async getWalletByUserId(req: Request, res: Response) {
    try {
      const userId  = req.params.userId as string;

      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!wallet) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Wallet not found for this user',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: wallet,
      });
    } catch (error) {
      console.error('Error fetching wallet:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch wallet',
      });
    }
  },

  // Update a wallet
  async updateWallet(req: Request, res: Response) {
    try {
      const userId  = req.params.userId as string;
      const { upiId, qrCodeUrl, currency, balance } = req.body;

      // Check if wallet exists
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Wallet not found',
        });
      }

      // Prepare update data
      const updateData: Partial<Wallet> = {};
      if (upiId) updateData.upiId = upiId;
      if (qrCodeUrl !== undefined) updateData.qrCodeUrl = qrCodeUrl;
      if (currency) updateData.currency = currency;
      if (balance !== undefined) updateData.balance = balance;

      // Update wallet
      const updatedWallet = await prisma.wallet.update({
        where: { userId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        message: 'Wallet updated successfully',
        data: updatedWallet,
      });
    } catch (error) {
      console.error('Error updating wallet:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update wallet',
      });
    }
  },

  // Delete a wallet
  async deleteWallet(req: Request, res: Response) {
    try {
      const userId  = req.params.userId as string;

      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Wallet not found',
        });
      }

      await prisma.wallet.delete({ where: { userId } });

      return res.status(StatusCodes.OK).json({
        message: 'Wallet deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting wallet:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete wallet',
      });
    }
  },
};