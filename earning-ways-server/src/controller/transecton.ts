
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import { TransactionType, TransactionStatus, Prisma } from '../../generated/prisma/index.js';


export const transactionController = {
  // Create a new transaction
  async createTransaction(req: Request, res: Response) {
    try {
      const { userId, type, amount, currency, status, description, meta, investmentId } = req.body;

      // Validate required fields
      if (!userId || !type || amount === undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'userId, type, and amount are required',
        });
      }

      // Validate amount
      if (amount <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'amount must be positive',
        });
      }

      // Validate transaction type
      if (!Object.values(TransactionType).includes(type)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid transaction type',
        });
      }

      // Validate transaction status if provided
      if (status && !Object.values(TransactionStatus).includes(status)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid transaction status',
        });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'User not found',
        });
      }

      // Check if investment exists (if provided)
      if (investmentId) {
        const investment = await prisma.investment.findUnique({ where: { id: investmentId } });
        if (!investment) {
          return res.status(StatusCodes.NOT_FOUND).json({
            error: 'Investment not found',
          });
        }
      }

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type,
          amount,
          currency: currency || 'INR',
          status: status || TransactionStatus.PENDING,
          description,
          meta,
          investmentId,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          investment: {
            select: { id: true, amountInvested: true, status: true },
          },
        },
      });

      return res.status(StatusCodes.CREATED).json({
        message: 'Transaction created successfully',
        data: transaction,
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create transaction',
      });
    }
  },

  // Get a transaction by ID
  async getTransactionById(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const transaction = await prisma.transaction.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          investment: {
            select: { id: true, amountInvested: true, status: true },
          },
        },
      });

      if (!transaction) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Transaction not found',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: transaction,
      });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transaction',
      });
    }
  },

  // Get all transactions
  async getAllTransactions(req: Request, res: Response) {
    const { page, limit, type, status, date } = req.query 

    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.TransactionWhereInput = {}

    if(type) {
      where.type = type as TransactionType
    }

    if(status) {
      where.status = status as TransactionStatus
    }

    if(date) {
      const start = new Date(date as string);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      where.createdAt = {
        gte: start,
        lte: end,
      }
    }

    try {
      const transactions = await prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          investment: {
            select: { id: true, amountInvested: true, status: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: {
          transactions,
          total: await prisma.transaction.count({ where }),
          totalPages: Math.ceil(await prisma.transaction.count({ where }) / Number(limit)),
          currentPage: Number(page),
          count: transactions.length
        },
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transactions',
      });
    }
  },

  // Update a transaction
  async updateTransaction(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;
      const { type, amount, currency, status, description, meta, investmentId } = req.body;

      // Check if transaction exists
      const transaction = await prisma.transaction.findUnique({ where: { id } });
      if (!transaction) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Transaction not found',
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (type) {
        if (!Object.values(TransactionType).includes(type)) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid transaction type',
          });
        }
        updateData.type = type;
      }
      if (amount !== undefined) {
        if (amount <= 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'amount must be positive',
          });
        }
        updateData.amount = amount;
      }
      if (currency) updateData.currency = currency;
      if (status) {
        if (!Object.values(TransactionStatus).includes(status)) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid transaction status',
          });
        }
        updateData.status = status;
      }
      if (description !== undefined) updateData.description = description;
      if (meta !== undefined) updateData.meta = meta;
      if (investmentId !== undefined) {
        if (investmentId) {
          const investment = await prisma.investment.findUnique({ where: { id: investmentId } });
          if (!investment) {
            return res.status(StatusCodes.NOT_FOUND).json({
              error: 'Investment not found',
            });
          }
        }
        updateData.investmentId = investmentId;
      }

      // Update transaction
      const updatedTransaction = await prisma.transaction.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          investment: {
            select: { id: true, amountInvested: true, status: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        message: 'Transaction updated successfully',
        data: updatedTransaction,
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update transaction',
      });
    }
  },

  // Delete a transaction
  async deleteTransaction(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const transaction = await prisma.transaction.findUnique({ where: { id } });
      if (!transaction) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Transaction not found',
        });
      }

      await prisma.transaction.delete({ where: { id } });

      return res.status(StatusCodes.OK).json({
        message: 'Transaction deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete transaction',
      });
    }
  },

  // Get transactions by user ID
  async getTransactionsByUserId(req: Request, res: Response) {
    try {
      const userId  = req.params.userId as string;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'User not found',
        });
      }

      const transactions = await prisma.transaction.findMany({
        where: { userId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          investment: {
            select: { id: true, amountInvested: true, status: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: transactions,
      });
    } catch (error) {
      console.error('Error fetching transactions by user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transactions',
      });
    }
  },

  // Get transactions by investment ID
  async getTransactionsByInvestmentId(req: Request, res: Response) {
    try {
      const investmentId  = req.params.investmentId as string;

      const investment = await prisma.investment.findUnique({ where: { id: investmentId } });
      if (!investment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Investment not found',
        });
      }

      const transactions = await prisma.transaction.findMany({
        where: { investmentId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          investment: {
            select: { id: true, amountInvested: true, status: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: transactions,
      });
    } catch (error) {
      console.error('Error fetching transactions by investment:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch transactions',
      });
    }
  },
};