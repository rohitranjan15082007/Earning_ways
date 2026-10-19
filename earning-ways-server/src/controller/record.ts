import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import prisma from "../config/prisma.js";
import type { Prisma, ROIRecord } from "../../generated/prisma/index.js";

export const roiRecordController = {
  // Create a new ROI record
  async createROIRecord(req: Request, res: Response) {
    try {
      const {
        userId,
        investmentId,
        weekNumber,
        roiAmount,
        isReferralBonusApplied,
      } = req.body;

      // Validate required fields
      if (!userId || weekNumber === undefined || roiAmount === undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "userId, weekNumber, and roiAmount are required",
        });
      }

      // Validate numeric fields
      if (weekNumber < 1) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "weekNumber must be positive",
        });
      }
      if (roiAmount < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "roiAmount must be non-negative",
        });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "User not found",
        });
      }

      // Check if investment exists (if provided)
      if (investmentId) {
        const investment = await prisma.investment.findUnique({
          where: { id: investmentId },
        });
        if (!investment) {
          return res.status(StatusCodes.NOT_FOUND).json({
            error: "Investment not found",
          });
        }
        // Ensure investment belongs to the user
        if (investment.userId !== userId) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "Investment does not belong to the specified user",
          });
        }
      }

      // Create ROI record
      const roiRecord = await prisma.rOIRecord.create({
        data: {
          userId,
          investmentId,
          weekNumber,
          roiAmount,
          isReferralBonusApplied: isReferralBonusApplied || false,
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

      // Update user's totalEarnings if ROI is applied
      if (roiAmount > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { totalEarnings: { increment: roiAmount } },
        });
      }

      return res.status(StatusCodes.CREATED).json({
        message: "ROI record created successfully",
        data: roiRecord,
      });
    } catch (error) {
      console.error("Error creating ROI record:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to create ROI record",
      });
    }
  },

  // Get an ROI record by ID
  async getROIRecordById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const roiRecord = await prisma.rOIRecord.findUnique({
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

      if (!roiRecord) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "ROI record not found",
        });
      }

      return res.status(StatusCodes.OK).json({
        data: roiRecord,
      });
    } catch (error) {
      console.error("Error fetching ROI record:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch ROI record",
      });
    }
  },

  // Get all ROI records
  async getAllROIRecords(req: Request, res: Response) {
    const {
      userId,
      page = "1",
      limit = "10",
      planId,
      startDate,
      endDate,
    } = req.query;

    try {
      // Validate userId
      if (!userId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "userId is required",
        });
      }

      // Pagination setup
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.ROIRecordWhereInput = {
        userId: userId as string,
      };

      // Filter by plan (via investment's planId)
      if (planId) {
        where.investment = {
          planId: planId as string,
        };
      }

      // Filter by date range (createdAt)
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate as string);
        }
      }

      // Fetch paginated ROI records
      const [roiRecords, total] = await Promise.all([
        prisma.rOIRecord.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            investment: {
              select: {
                id: true,
                amountInvested: true,
                status: true,
                plan: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" }, // Latest first
        }),
        prisma.rOIRecord.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      return res.status(StatusCodes.OK).json({
        data: roiRecords,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
        },
      });
    } catch (error) {
      console.error("Error fetching ROI records:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch ROI records",
      });
    }
  },

  // Update an ROI record
  async updateROIRecord(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { weekNumber, roiAmount, isReferralBonusApplied, investmentId } =
        req.body;

      // Check if ROI record exists
      const roiRecord = await prisma.rOIRecord.findUnique({ where: { id } });
      if (!roiRecord) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "ROI record not found",
        });
      }

      // Prepare update data
      const updateData: Partial<ROIRecord> = {};
      if (weekNumber !== undefined) {
        if (weekNumber < 1) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "weekNumber must be positive",
          });
        }
        updateData.weekNumber = weekNumber;
      }
      if (roiAmount !== undefined) {
        if (roiAmount < 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "roiAmount must be non-negative",
          });
        }
        updateData.roiAmount = roiAmount;
      }
      if (isReferralBonusApplied !== undefined) {
        updateData.isReferralBonusApplied = isReferralBonusApplied;
      }
      if (investmentId !== undefined) {
        if (investmentId) {
          const investment = await prisma.investment.findUnique({
            where: { id: investmentId },
          });
          if (!investment) {
            return res.status(StatusCodes.NOT_FOUND).json({
              error: "Investment not found",
            });
          }
          if (investment.userId !== roiRecord.userId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
              error: "Investment does not belong to the specified user",
            });
          }
        }
        updateData.investmentId = investmentId;
      }

      // Update user's totalEarnings if roiAmount changes
      if (roiAmount !== undefined && roiAmount !== roiRecord.roiAmount) {
        const difference = Number(roiAmount) - Number(roiRecord.roiAmount);
        await prisma.user.update({
          where: { id: roiRecord.userId },
          data: { totalEarnings: { increment: difference } },
        });
      }

      // Update ROI record
      const updatedROIRecord = await prisma.rOIRecord.update({
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
        message: "ROI record updated successfully",
        data: updatedROIRecord,
      });
    } catch (error) {
      console.error("Error updating ROI record:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to update ROI record",
      });
    }
  },

  // Delete an ROI record
  async deleteROIRecord(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const roiRecord = await prisma.rOIRecord.findUnique({ where: { id } });
      if (!roiRecord) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "ROI record not found",
        });
      }

      // Update user's totalEarnings by subtracting the roiAmount
      if (roiRecord.roiAmount.greaterThan(0)) {
        await prisma.user.update({
          where: { id: roiRecord.userId },
          data: { totalEarnings: { decrement: roiRecord.roiAmount } },
        });
      }

      await prisma.rOIRecord.delete({ where: { id } });

      return res.status(StatusCodes.OK).json({
        message: "ROI record deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting ROI record:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to delete ROI record",
      });
    }
  },

  // Get ROI records by user ID
  async getROIRecordsByUserId(req: Request, res: Response) {
    try {
      const userId = req.params.userId as string;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "User not found",
        });
      }

      const roiRecords = await prisma.rOIRecord.findMany({
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
        data: roiRecords,
      });
    } catch (error) {
      console.error("Error fetching ROI records by user:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch ROI records",
      });
    }
  },

  // Get ROI records by investment ID
  async getROIRecordsByInvestmentId(req: Request, res: Response) {
    try {
      const investmentId = req.params.investmentId as string;

      const investment = await prisma.investment.findUnique({
        where: { id: investmentId },
      });
      if (!investment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Investment not found",
        });
      }

      const roiRecords = await prisma.rOIRecord.findMany({
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
        data: roiRecords,
      });
    } catch (error) {
      console.error("Error fetching ROI records by investment:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch ROI records",
      });
    }
  },
};
