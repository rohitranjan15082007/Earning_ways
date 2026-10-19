import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Prisma, type SubscriptionPlan } from '../../generated/prisma/index.js';
import prisma from '../config/prisma.js';
import { recordAdminAction } from '../service/audit.js';

export const subscriptionPlanController = {
  // Create a new subscription plan
  async createSubscriptionPlan(req: Request, res: Response) {
    try {
      const { name, investmentAmount, minimumInvestment, roiPerMonth, roiPerDay, maximumEarning, durationInMonths, description, isActive } = req.body;

      // A plan has ONE fixed investment amount. `investmentAmount` is what the
      // admin panel sends; `minimumInvestment` is accepted as its alias so older
      // callers keep working. Both columns are stored equal to that amount, which
      // is what makes the member pay exactly that price.
      const amount = investmentAmount !== undefined ? investmentAmount : minimumInvestment;

      // Validate required fields
      if (!name || amount === undefined || durationInMonths === undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'name, investmentAmount and durationInMonths are required',
        });
      }

      // Validate that only one of roiPerMonth or roiPerDay is provided
      if (roiPerMonth !== undefined && roiPerDay !== undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Only one of roiPerMonth or roiPerDay should be provided, not both',
        });
      }

      // Validate at least one of roiPerMonth or roiPerDay is provided
      if (roiPerMonth === undefined && roiPerDay === undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'At least one of roiPerMonth or roiPerDay must be provided',
        });
      }
      // There is no range any more: the single amount just has to be a real price.
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'investmentAmount must be greater than 0',
        });
      }
      if (roiPerMonth !== undefined && roiPerMonth < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'roiPerMonth must be non-negative',
        });
      }
      if (roiPerDay !== undefined && roiPerDay < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'roiPerDay must be non-negative',
        });
      }
      if (durationInMonths <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'durationInMonths must be positive',
        });
      }

      // Create subscription plan
      const subscriptionPlan = await prisma.subscriptionPlan.create({
        data: {
          name,
          // Both columns carry the one fixed price, so nothing that reads a range
          // can ever see two different numbers.
          minimumInvestment: amount,
          maximumInvestment: amount,
          roiPerMonth,
          roiPerDay,
          maximumEarning,
          durationInMonths,
          description,
          isActive: isActive !== undefined ? isActive : true,
        },
        select: {
          id: true,
          name: true,
          minimumInvestment: true,
          maximumInvestment: true,
          roiPerMonth: true,
          roiPerDay: true,
          maximumEarning: true,
          durationInMonths: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Plan pricing is business-critical, so the change is always attributable.
      await recordAdminAction(res.locals.principal, {
        action: 'plans:write',
        entity: 'plan',
        entityId: subscriptionPlan.id,
        summary: `Created plan ${subscriptionPlan.name} at ₹${String(subscriptionPlan.minimumInvestment)} (${subscriptionPlan.durationInMonths} months)`,
        after: {
          name: subscriptionPlan.name,
          amount: String(subscriptionPlan.minimumInvestment),
          durationInMonths: subscriptionPlan.durationInMonths,
          isActive: subscriptionPlan.isActive,
          roiPerMonth: subscriptionPlan.roiPerMonth ? String(subscriptionPlan.roiPerMonth) : null,
          roiPerDay: subscriptionPlan.roiPerDay ? String(subscriptionPlan.roiPerDay) : null,
        },
      }, req);

      return res.status(StatusCodes.CREATED).json({
        message: 'Subscription plan created successfully',
        data: subscriptionPlan,
      });
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create subscription plan',
      });
    }
  },

  // Get a subscription plan by ID
  async getSubscriptionPlanById(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;
      const principal = res.locals.principal;
      const userId = principal?.kind === "user" ? principal.id
        : principal?.kind === "admin" && typeof req.query.id === "string" ? req.query.id : undefined;

      const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
        where: { id },
        include: {
          investments: principal?.kind === "admin" ? {
            select: {
              id: true,
              userId: true,
              amountInvested: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          } : userId ? {
            where: { userId },
            select: {
              id: true,
              userId: true,
              amountInvested: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          } : false,
        },
      });

      if (!subscriptionPlan) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Subscription plan not found',
        });
      }

      // Check if user has purchased this plan only if logged in
      let isSubscribed = false;
      if (userId) {
        const userInvestment = await prisma.investment.findFirst({
          where: {
            userId,
            planId: id,
            status: { in: ['ACTIVE', 'COMPLETED'] }, // Assuming purchased means active or completed
          },
        });
        isSubscribed = !!userInvestment;
      }

      return res.status(StatusCodes.OK).json({
        data: {
          ...subscriptionPlan,
          isSubscribed,
        },
      });
    } catch (error) {
      console.error('Error fetching subscription plan:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch subscription plan',
      });
    }
  },

  // Get all subscription plans
  async getAllSubscriptionPlans(req: Request, res: Response) {
    try {
      const principal = res.locals.principal;
      const userId = principal?.kind === "user" ? principal.id
        : principal?.kind === "admin" && typeof req.query.id === "string" ? req.query.id : undefined;

      const subscriptionPlans = await prisma.subscriptionPlan.findMany({
        select: {
          id: true,
          name: true,
          minimumInvestment: true,
          maximumInvestment: true,
          roiPerMonth: true,
          roiPerDay: true,
          maximumEarning: true,
          durationInMonths: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Fetch global settings for maxiumEarningReturn
      const settings = await prisma.setting.findFirst();
      const maxEarningMultiplier = settings?.maxiumEarningReturn || 0;

      // Check user's investments to see which plans they have purchased only if logged in
      let hasAnySubscriptions = false;
      const userInvestmentsMap = new Map<string, number>();

      if (userId) {
        const userInvestments = await prisma.investment.findMany({
          where: {
            userId,
            status: { in: ['ACTIVE', 'COMPLETED'] }, // Assuming purchased means active or completed
          },
          select: { planId: true, amountInvested: true },
        });

        userInvestments.forEach(inv => {
          const amount = Number(inv.amountInvested);
          const currentTotal = userInvestmentsMap.get(inv.planId) || 0;
          userInvestmentsMap.set(inv.planId, currentTotal + amount);
        });

        hasAnySubscriptions = userInvestments.length > 0;
      }

      const plansWithUserInfo = subscriptionPlans.map(plan => {
        const investedAmount = userInvestmentsMap.get(plan.id);
        const isSubscribed = investedAmount !== undefined;

        // Calculate dynamic maximum earning if subscribed
        // Otherwise, return null to hide it (removing the static plan value)
        let dynamicMaximumEarning = null;
        if (isSubscribed) {
          dynamicMaximumEarning = (investedAmount || 0) * maxEarningMultiplier;
        }

        return {
          ...plan,
          isSubscribed,
          maximumEarning: dynamicMaximumEarning,
        };
      });

      return res.status(StatusCodes.OK).json({
        data: plansWithUserInfo,
        hasAnySubscriptions,
      });
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch subscription plans',
      });
    }
  },

  // Update a subscription plan
  async updateSubscriptionPlan(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;
      const { name, investmentAmount, minimumInvestment, roiPerMonth, roiPerDay, maximumEarning, durationInMonths, description, isActive } = req.body;
      // Same single-fixed-amount rule as creation.
      const amount = investmentAmount !== undefined ? investmentAmount : minimumInvestment;

      // Check if subscription plan exists
      const subscriptionPlan = await prisma.subscriptionPlan.findUnique({ where: { id } });
      if (!subscriptionPlan) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Subscription plan not found',
        });
      }

      // Validate that only one of roiPerMonth or roiPerDay is provided if both are being updated
      if (roiPerMonth !== undefined && roiPerDay !== undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Only one of roiPerMonth or roiPerDay should be provided, not both',
        });
      }

      // Check for active investments if setting isActive to false
      if (isActive === false) {
        const activeInvestments = await prisma.investment.count({
          where: { planId: id, status: 'ACTIVE' },
        });
        if (activeInvestments > 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Cannot deactivate plan with active investments',
          });
        }
      }

      // Prepare update data
      const updateData: Partial<SubscriptionPlan> = {};
      if (name) updateData.name = name;
      if (amount !== undefined) {
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'investmentAmount must be greater than 0',
          });
        }
        updateData.minimumInvestment = new Prisma.Decimal(amount);
        updateData.maximumInvestment = new Prisma.Decimal(amount);
      }
      if (roiPerMonth !== undefined) updateData.roiPerMonth = roiPerMonth;
      if (roiPerDay !== undefined) updateData.roiPerDay = roiPerDay;
      if (durationInMonths !== undefined) updateData.durationInMonths = durationInMonths;
      if (maximumEarning !== undefined) updateData.maximumEarning = maximumEarning;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Validate numeric fields

      if (roiPerMonth !== undefined && roiPerMonth < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'roiPerMonth must be non-negative',
        });
      }
      if (roiPerDay !== undefined && roiPerDay < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'roiPerDay must be non-negative',
        });
      }
      if (durationInMonths !== undefined && durationInMonths <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'durationInMonths must be positive',
        });
      }

      // Update subscription plan
      const updatedSubscriptionPlan = await prisma.subscriptionPlan.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          minimumInvestment: true,
          maximumInvestment: true,
          roiPerMonth: true,
          roiPerDay: true,
          maximumEarning: true,
          durationInMonths: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const priceBefore = Number(subscriptionPlan.minimumInvestment);
      const priceAfter = Number(updatedSubscriptionPlan.minimumInvestment);
      const changed: string[] = [];
      if (priceBefore !== priceAfter) changed.push(`price ₹${priceBefore} → ₹${priceAfter}`);
      if (subscriptionPlan.name !== updatedSubscriptionPlan.name) changed.push(`name ${subscriptionPlan.name} → ${updatedSubscriptionPlan.name}`);
      if (subscriptionPlan.durationInMonths !== updatedSubscriptionPlan.durationInMonths) {
        changed.push(`duration ${subscriptionPlan.durationInMonths} → ${updatedSubscriptionPlan.durationInMonths} months`);
      }
      if (subscriptionPlan.isActive !== updatedSubscriptionPlan.isActive) {
        changed.push(updatedSubscriptionPlan.isActive ? 'activated' : 'deactivated');
      }

      await recordAdminAction(res.locals.principal, {
        action: 'plans:write',
        entity: 'plan',
        entityId: updatedSubscriptionPlan.id,
        summary: `Updated plan ${updatedSubscriptionPlan.name}${changed.length ? `: ${changed.join(', ')}` : ''}`,
        before: {
          name: subscriptionPlan.name,
          amount: String(subscriptionPlan.minimumInvestment),
          durationInMonths: subscriptionPlan.durationInMonths,
          isActive: subscriptionPlan.isActive,
          roiPerMonth: subscriptionPlan.roiPerMonth ? String(subscriptionPlan.roiPerMonth) : null,
          roiPerDay: subscriptionPlan.roiPerDay ? String(subscriptionPlan.roiPerDay) : null,
        },
        after: {
          name: updatedSubscriptionPlan.name,
          amount: String(updatedSubscriptionPlan.minimumInvestment),
          durationInMonths: updatedSubscriptionPlan.durationInMonths,
          isActive: updatedSubscriptionPlan.isActive,
          roiPerMonth: updatedSubscriptionPlan.roiPerMonth ? String(updatedSubscriptionPlan.roiPerMonth) : null,
          roiPerDay: updatedSubscriptionPlan.roiPerDay ? String(updatedSubscriptionPlan.roiPerDay) : null,
        },
      }, req);

      return res.status(StatusCodes.OK).json({
        message: 'Subscription plan updated successfully',
        data: updatedSubscriptionPlan,
      });
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update subscription plan',
      });
    }
  },

  // Delete a subscription plan
  async deleteSubscriptionPlan(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      // Check if subscription plan exists
      const subscriptionPlan = await prisma.subscriptionPlan.findUnique({ where: { id } });
      if (!subscriptionPlan) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Subscription plan not found',
        });
      }

      // Check for existing investments
      const investmentCount = await prisma.investment.count({ where: { planId: id } });
      if (investmentCount > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Cannot delete plan with existing investments',
        });
      }

      await prisma.subscriptionPlan.delete({ where: { id } });

      await recordAdminAction(res.locals.principal, {
        action: 'plans:write',
        entity: 'plan',
        entityId: id,
        summary: `Deleted plan ${subscriptionPlan.name}`,
        before: {
          name: subscriptionPlan.name,
          amount: String(subscriptionPlan.minimumInvestment),
          durationInMonths: subscriptionPlan.durationInMonths,
          isActive: subscriptionPlan.isActive,
        },
      }, req);

      return res.status(StatusCodes.OK).json({
        message: 'Subscription plan deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete subscription plan',
      });
    }
  },

  // Get investments for a subscription plan
  async getSubscriptionPlanInvestments(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          minimumInvestment: true,
          maximumInvestment: true,
          roiPerMonth: true,
          roiPerDay: true,
          maximumEarning: true,
          durationInMonths: true,
          investments: {
            select: {
              id: true,
              userId: true,
              amountInvested: true,
              status: true,
              startDate: true,
              endDate: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!subscriptionPlan) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'Subscription plan not found',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: subscriptionPlan,
      });
    } catch (error) {
      console.error('Error fetching investments for subscription plan:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch investments',
      });
    }
  },
};