import  type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import { ReferralStatus, type Referral } from '../../generated/prisma/index.js';


export const referralController = {
  // Create a new referral
  async createReferral(req: Request, res: Response) {
    try {
      const { referrerId, referredUserId, level, bonusPercentage, bonusStartDate, bonusEndDate, status } = req.body;

      // Validate required fields
      if (!referrerId || !referredUserId || level === undefined || bonusPercentage === undefined || !bonusStartDate || !bonusEndDate) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'referrerId, referredUserId, level, bonusPercentage, bonusStartDate, and bonusEndDate are required',
        });
      }

      // Validate level (1 to 5)
      if (level < 1 || level > 5) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'level must be between 1 and 5',
        });
      }

      // Validate bonusPercentage
      if (bonusPercentage < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'bonusPercentage must be non-negative',
        });
      }

      // Validate dates
      const startDate = new Date(bonusStartDate);
      const endDate = new Date(bonusEndDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid bonusStartDate or bonusEndDate',
        });
      }
      if (startDate >= endDate) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'bonusStartDate must be before bonusEndDate',
        });
      }

      // Validate referral status if provided
      if (status && !Object.values(ReferralStatus).includes(status)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid referral status',
        });
      }

      // Check if referrer and referred user exist
      const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
      const referredUser = await prisma.user.findUnique({ where: { id: referredUserId } });
      if (!referrer || !referredUser) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Referrer or referred user not found',
        });
      }

      // Prevent self-referral
      if (referrerId === referredUserId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Referrer and referred user cannot be the same',
        });
      }

      // Check if referral already exists
      const existingReferral = await prisma.referral.findFirst({
        where: { referrerId, referredUserId },
      });
      if (existingReferral) {
        return res.status(StatusCodes.CONFLICT).json({
          error: 'Referral already exists for this referrer and referred user',
        });
      }

      // Create referral
      const referral = await prisma.referral.create({
        data: {
          referrerId,
          referredUserId,
          level,
          bonusPercentage,
          bonusStartDate: startDate,
          bonusEndDate: endDate,
          status: status || ReferralStatus.ACTIVE,
        },
        include: {
          referrer: {
            select: { id: true, name: true, email: true },
          },
          referredUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Update referrer's totalReferrals
      await prisma.user.update({
        where: { id: referrerId },
        data: { totalReferrals: { increment: 1 } },
      });

      return res.status(StatusCodes.CREATED).json({
        message: 'Referral created successfully',
        data: referral,
      });
    } catch (error) {
      console.error('Error creating referral:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create referral',
      });
    }
  },

  // Get a referral by ID
  async getReferralById(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const referral = await prisma.referral.findUnique({
        where: { id },
        include: {
          referrer: {
            select: { id: true, name: true, email: true },
          },
          referredUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!referral) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Referral not found',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: referral,
      });
    } catch (error) {
      console.error('Error fetching referral:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch referral',
      });
    }
  },

  // Get all referrals
  async getAllReferrals(req: Request, res: Response) {
    try {
      const referrals = await prisma.referral.findMany({
        include: {
          referrer: {
            select: { id: true, name: true, email: true },
          },
          referredUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: referrals,
      });
    } catch (error) {
      console.error('Error fetching referrals:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch referrals',
      });
    }
  },

  // Update a referral
  async updateReferral(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;
      const { level, bonusPercentage, bonusStartDate, bonusEndDate, status } = req.body;

      // Check if referral exists
      const referral = await prisma.referral.findUnique({ where: { id } });
      if (!referral) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Referral not found',
        });
      }

      // Prepare update data
      const updateData: Partial<Referral> = {};
      if (level !== undefined) {
        if (level < 1 || level > 5) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'level must be between 1 and 5',
          });
        }
        updateData.level = level;
      }
      if (bonusPercentage !== undefined) {
        if (bonusPercentage < 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'bonusPercentage must be non-negative',
          });
        }
        updateData.bonusPercentage = bonusPercentage;
      }
      if (bonusStartDate) {
        const startDate = new Date(bonusStartDate);
        if (isNaN(startDate.getTime())) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid bonusStartDate',
          });
        }
        updateData.bonusStartDate = startDate;
      }
      if (bonusEndDate) {
        const endDate = new Date(bonusEndDate);
        if (isNaN(endDate.getTime())) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid bonusEndDate',
          });
        }
        updateData.bonusEndDate = endDate;
      }
      if (status) {
        if (!Object.values(ReferralStatus).includes(status)) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid referral status',
          });
        }
        updateData.status = status;
      }

      // Validate date consistency if both dates are provided
      if (updateData.bonusStartDate && updateData.bonusEndDate && updateData.bonusStartDate >= updateData.bonusEndDate) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'bonusStartDate must be before bonusEndDate',
        });
      }

      // Update referral
      const updatedReferral = await prisma.referral.update({
        where: { id },
        data: updateData,
        include: {
          referrer: {
            select: { id: true, name: true, email: true },
          },
          referredUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        message: 'Referral updated successfully',
        data: updatedReferral,
      });
    } catch (error) {
      console.error('Error updating referral:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update referral',
      });
    }
  },

  // Delete a referral
  async deleteReferral(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const referral = await prisma.referral.findUnique({ where: { id } });
      if (!referral) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Referral not found',
        });
      }

      await prisma.referral.delete({ where: { id } });

      // Update referrer's totalReferrals
      await prisma.user.update({
        where: { id: referral.referrerId },
        data: { totalReferrals: { decrement: 1 } },
      });

      return res.status(StatusCodes.OK).json({
        message: 'Referral deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting referral:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete referral',
      });
    }
  },

  // Get referrals by referrer ID
  async getReferralsByReferrerId(req: Request, res: Response) {
    try {
      const referrerId  = req.params.referrerId as string;

      const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
      if (!referrer) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Referrer not found',
        });
      }

      const referrals = await prisma.referral.findMany({
        where: { referrerId },
        include: {
          referrer: {
            select: { id: true, name: true, email: true },
          },
          referredUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: referrals,
      });
    } catch (error) {
      console.error('Error fetching referrals by referrer:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch referrals',
      });
    }
  },

  // Get referrals by referred user ID
  async getReferralsByReferredUserId(req: Request, res: Response) {
    try {
      const referredUserId  = req.params.referredUserId as string;

      const referredUser = await prisma.user.findUnique({ where: { id: referredUserId } });
      if (!referredUser) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Referred user not found',
        });
      }

      const referrals = await prisma.referral.findMany({
        where: { referredUserId },
        include: {
          referrer: {
            select: { id: true, name: true, email: true },
          },
          referredUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return res.status(StatusCodes.OK).json({
        data: referrals,
      });
    } catch (error) {
      console.error('Error fetching referrals by referred user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch referrals',
      });
    }
  },
};