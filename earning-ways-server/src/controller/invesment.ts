import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  InvestmentStatus,
  TransactionType,
  TransactionStatus,
  Prisma
} from "../../generated/prisma/index.js";
import prisma from "../config/prisma.js";
import { SuccessResponse } from "../utils/response.util.js";
import { PaymentError, paymentAmount } from "../service/amount.js";
import { investmentReference, planInvestmentTerms } from "../service/investmentTerms.js";
import { applyReferralBonus } from "../service/referralBonus.js";
import { inrText, notifyUser } from "../service/notify.js";

export const investmentController = {
  // Create a new investment
  async createInvestment(req: Request, res: Response) {
    try {
      const { userId, planId, amountInvested, transactionId } = req.body ?? {};

      if (typeof userId !== "string" || !userId || typeof planId !== "string" || !planId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "userId and planId are required",
        });
      }
      // Payment reference for the investment (the Telegram Stars charge id for the
      // normal rail; an operations reference when an admin records an offline purchase).
      const reference = investmentReference(transactionId);

      // ROI percentage, start date and end date are derived from the plan on the
      // server; client-supplied terms are ignored so they cannot be inflated.
      const amount = paymentAmount(amountInvested);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
      }

      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        return res.status(StatusCodes.NOT_FOUND).json({ error: "Subscription plan not found" });
      }
      // Plan rules (active flag, limits, duration, ROI) come from the shared helper
      // so the manual and Telegram Stars rails can never drift apart.
      const terms = planInvestmentTerms(plan, amount);

      // A paid investment is live immediately — this admin-assisted path applies
      // exactly the same rule as the Telegram Stars settlement.
      const investment = await prisma.$transaction(async (tx) => {
        const created = await tx.investment.create({
          data: {
            userId,
            planId,
            amountInvested: amount,
            roiPercentage: terms.roiPercentage,
            transactionId: reference,
            startDate: terms.startDate,
            endDate: terms.endDate,
            status: InvestmentStatus.ACTIVE,
            totalReturn: null,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            plan: {
              select: {
                id: true,
                name: true,
                minimumInvestment: true,
                roiPerMonth: true,
              },
            },
          },
        });

        await applyReferralBonus(tx, {
          userId: created.userId,
          investmentId: created.id,
          amountInvested: amount,
          investmentCreatedAt: created.createdAt,
        });

        // Same member notification as the Telegram Stars path, so the two
        // activation routes are indistinguishable to the member.
        await notifyUser(tx, {
          userId: created.userId,
          title: 'Investment activated',
          message: `Your ${inrText(amount)} investment in ${plan.name} is active now.`,
          type: 'SUCCESS',
          meta: { investmentId: created.id, planId: plan.id, amount: amount.toString() },
        });

        return created;
      });

      return res.status(StatusCodes.CREATED).json({
        message: "Investment created successfully",
        data: investment,
      });
    } catch (error) {
      if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
      console.error("Error creating investment:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to create investment",
      });
    }
  },

  // Get an investment by ID
  async getInvestmentById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const investment = await prisma.investment.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          plan: {
            select: {
              id: true,
              name: true,
              minimumInvestment: true,
              roiPerMonth: true,
            },
          },
          roiRecords: true,
          transactions: true,
        },
      });

      if (!investment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Investment not found",
        });
      }

      return res.status(StatusCodes.OK).json({
        data: investment,
      });
    } catch (error) {
      console.error("Error fetching investment:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch investment",
      });
    }
  },

  // Get all investments
  async getAllInvestments(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [investments, total] = await Promise.all([
        prisma.investment.findMany({
          skip,
          take: limit,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            plan: {
              select: {
                id: true,
                name: true,
                minimumInvestment: true,
                roiPerMonth: true,
              },
            },
          },
        }),
        prisma.investment.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return res.status(StatusCodes.OK).json({
        data: investments,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error) {
      console.error("Error fetching investments:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch investments",
      });
    }
  },

  // Update an investment
  async updateInvestment(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const {
        amountInvested,
        roiPercentage,
        startDate,
        endDate,
        status,
        totalReturn,
      } = req.body;

      // Check if investment exists
      const investment = await prisma.investment.findUnique({ where: { id } });
      if (!investment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Investment not found",
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (amountInvested !== undefined) {
        if (amountInvested <= 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "amountInvested must be positive",
          });
        }
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: investment.planId },
        });
        if (plan && amountInvested < Number(plan.minimumInvestment)) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: `Amount invested must be at least ${plan.minimumInvestment}`,
          });
        }
        updateData.amountInvested = new Prisma.Decimal(amountInvested as number);
      }
      if (roiPercentage !== undefined) {
        if (roiPercentage < 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "roiPercentage must be non-negative",
          });
        }
        updateData.roiPercentage = new Prisma.Decimal(roiPercentage as number);
      }
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate !== undefined)
        updateData.endDate = endDate ? new Date(endDate) : null;
      if (status) {
        if (!Object.values(InvestmentStatus).includes(status)) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "Invalid investment status",
          });
        }
        updateData.status = status;
      }
      if (totalReturn !== undefined) updateData.totalReturn = totalReturn;

      // Update investment
      
      let updatedInvestment;

      // Handle Referral Bonus if status is changed to ACTIVE
      if (status === InvestmentStatus.ACTIVE && investment.status !== InvestmentStatus.ACTIVE) {
        updatedInvestment = await prisma.$transaction(async (tx) => {
          // 1. Update investment
          const inv = await tx.investment.update({
            where: { id },
            data: updateData,
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
              plan: {
                select: {
                  id: true,
                  name: true,
                  minimumInvestment: true,
                  roiPerMonth: true,
                },
              },
            },
          });

          // 2. Referrer bonus for this activation. The same shared helper runs in
          // the Telegram Stars settlement, so both activation paths stay identical.
          const activatedAmount = updateData.amountInvested
            ? new Prisma.Decimal(updateData.amountInvested)
            : new Prisma.Decimal(investment.amountInvested);
          await applyReferralBonus(tx, {
            userId: investment.userId,
            investmentId: investment.id,
            amountInvested: activatedAmount,
            investmentCreatedAt: investment.createdAt,
          });

          // 3. Tell the member their plan is live.
          await notifyUser(tx, {
            userId: investment.userId,
            title: 'Investment activated',
            message: `Your ${inrText(activatedAmount)} investment in ${inv.plan?.name ?? 'your plan'} is active now.`,
            type: 'SUCCESS',
            meta: { investmentId: inv.id, planId: investment.planId, amount: activatedAmount.toString() },
          });

          return inv;
        });
      } else {
        // Standard update without bonus
        updatedInvestment = await prisma.investment.update({
            where: { id },
            data: updateData,
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
              plan: {
                select: {
                  id: true,
                  name: true,
                  minimumInvestment: true,
                  roiPerMonth: true,
                },
              },
            },
          });
      }

      return res.status(StatusCodes.OK).json({
        message: "Investment updated successfully",
        data: updatedInvestment,
      });
    } catch (error) {
      console.error("Error updating investment:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to update investment",
      });
    }
  },

  // Delete an investment
  async deleteInvestment(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const investment = await prisma.investment.findUnique({ where: { id } });
      if (!investment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Investment not found",
        });
      }

      await prisma.investment.delete({ where: { id } });

      return res.status(StatusCodes.OK).json({
        message: "Investment deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting investment:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to delete investment",
      });
    }
  },

  // Get ROI records and transactions for an investment
  async getInvestmentDetails(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const investment = await prisma.investment.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          plan: {
            select: {
              id: true,
              name: true,
              minimumInvestment: true,
              roiPerMonth: true,
            },
          },
          roiRecords: {
            select: {
              id: true,
              weekNumber: true,
              roiAmount: true,
              isReferralBonusApplied: true,
              createdAt: true,
            },
          },
          transactions: {
            select: {
              id: true,
              type: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      if (!investment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Investment not found",
        });
      }

      return res.status(StatusCodes.OK).json({
        data: investment,
      });
    } catch (error) {
      console.error("Error fetching investment details:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch investment details",
      });
    }
  },

  
  async accept_reject(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const acceptReject = await prisma.investment.update({
        where: { id },
        data: {
          status: status as InvestmentStatus,
        },
      });

      return SuccessResponse(res, "investment updated successfully", acceptReject);
    } catch (error) {
      console.error("Error fetching investment details:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Failed to fetch investment details",
      });
    }
  },
};