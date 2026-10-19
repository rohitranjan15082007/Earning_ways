import bcrypt from 'bcryptjs'; // For password hashing
import { recordAdminAction } from '../service/audit.js';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid'; // For generating referral codes
import { Prisma, ReferralStatus, type User } from '../../generated/prisma/index.js';
import prisma from '../config/prisma.js';
import { clearRateLimit } from '../middleware/rateLimit.middleware.js';
import { JWT } from '../utils/jwt.utils.js';
import { creditDueRoi } from '../service/roi.service.js';

// Compared against when the email is unknown, so a missing account and a wrong
// password take the same amount of time and cannot be told apart.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-account-password', 10);
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes



// Controller functions
export const userController = {
  // Create a new user
  async createUser(req: Request, res: Response) {
    try {
      const { name, email, password, upiId, referredByCode } = req.body;
  
      // Validate required fields
      if (!email || !password) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Email and password are required',
        });
      }
  
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(StatusCodes.CONFLICT).json({
          error: 'Email already exists',
        });
      }
  
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
  
      // Generate unique referral code
      let referralCode: string;
      let existingReferral: any;
      do {
        referralCode = `EXPO${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        existingReferral = await prisma.user.findUnique({
          where: { referralCode },
        });
      } while (existingReferral);
  
      // Find referredBy user (if provided). The referral code is optional: a
      // missing or blank code is simply a registration without a referrer.
      let referredById: string | null = null;
      const referralCodeInput = typeof referredByCode === 'string' ? referredByCode.trim() : '';
      if (referralCodeInput) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: referralCodeInput },
        });
        if (!referrer) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid referral code',
          });
        }
        referredById = referrer.id;
      }
  
      // Create the new user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          upiId: typeof upiId === 'string' && upiId.trim() ? upiId.trim() : null,
          referralCode,
          referredById,
        },
        select: {
          id: true,
          name: true,
          email: true,
          upiId: true,
          referralCode: true,
          inrBalance: true,
          totalReferrals: true,
          totalEarnings: true,
          currentLevel: true,
          createdAt: true,
          updatedAt: true,
          tokenVersion: true, // used for the token claim, stripped from the response
        },
      });
  
      // If referred by someone, update referrer's stats and create referral record
      if (referredById) {
        await prisma.user.update({
          where: { id: referredById },
          data: { totalReferrals: { increment: 1 } },
        });
  
        await prisma.referral.create({
          data: {
            referrerId: referredById,
            referredUserId: user.id,
            level: 1,
            bonusPercentage: 0.05,
            bonusStartDate: new Date(),
            bonusEndDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
            status: ReferralStatus.ACTIVE,
          },
        });
      }
  
      // Every member gets exactly one INR payout wallet, so a withdrawal can
      // never fail for a missing wallet. The UPI id is optional here and can be
      // set later from the payout details page.
      await prisma.wallet.create({
        data: {
          userId: user.id,
          upiId: typeof upiId === 'string' && upiId.trim() ? upiId.trim() : null,
          currency: 'INR',
          balance: 0,
        },
      });

      const token = JWT.generateToken({ id: user.id, email: user.email, kind: "user", tokenVersion: user.tokenVersion });

      
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }).header("Authorization", `Bearer ${token}`).json({
      message: 'User created successfully',
      data: { ...user, passwordHash: undefined, tokenVersion: undefined },
      token: token,
    });
  
    } catch (error: any) {
      console.error('Error creating user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create user',
      });
    }
  },

  // Login a user
  async loginUser(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Email and password are required',
        });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Burn the same bcrypt work as a real check, then fail with the same
        // status and message as a wrong password (no account enumeration).
        await bcrypt.compare(String(password), DUMMY_PASSWORD_HASH);
        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: 'Invalid email or password',
        });
      }

      const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash);
      if (!isPasswordValid) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: 'Invalid email or password',
        });
      }
      
      clearRateLimit(req);
      const token = JWT.generateToken({ id: user.id, email: user.email, kind: "user", tokenVersion: user.tokenVersion });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }).header("Authorization", `Bearer ${token}`).json({
      message: 'User logged in successfully',
      data: { ...user, passwordHash: undefined, tokenVersion: undefined },
      token: token,
    });
    } catch (error: any) {
      console.error('Error logging in user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to login user',
      });
    }
  },

  // Get a user by ID
 async getUserById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: id as string },
      include: {
        wallet: true,
        referredBy: { select: { id: true, name: true, email: true } },
        investments: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
        },
      },
    });

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'User not found' });
    }

    // ROI accrual is claimed per investment and day inside the service, so a
    // repeated or concurrent profile read can never credit the same day twice.
    await creditDueRoi(user.id);

    // --------------------------------------------------
    // RETURN UPDATED USER
    // --------------------------------------------------

    const updatedUser = await prisma.user.findUnique({
      where: { id: id as string },
      include: {
        wallet: true,
        referredBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Same sanitisation as login/signup: never return the credential hash or
    // the token version to the client.
    return res.status(StatusCodes.OK).json({
      data: updatedUser && { ...updatedUser, passwordHash: undefined, tokenVersion: undefined },
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch user',
    });
  }
},

  // Update a user
  async updateUser(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;
      const principal = res.locals.principal;
      const { name, email, upiId, password, currentPassword } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'User not found',
        });
      }

      // Prepare update data
      const updateData: Prisma.UserUpdateInput = {};
      if (name !== undefined) updateData.name = name;
      if (email) {
        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail && existingEmail.id !== id) {
          return res.status(StatusCodes.CONFLICT).json({
            error: 'Email already in use',
          });
        }
        updateData.email = email;
      }
      if (upiId !== undefined) updateData.upiId = upiId;
      if (password !== undefined) {
        // A password edit is an account-takeover primitive: only the member
        // (with the current password) or the owner may set it. A sub-admin with
        // `users:update` can correct a profile, never take over a login.
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          });
        }
        if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes`,
          });
        }
        if (principal?.kind === 'admin') {
          if (principal.role !== 'SUPER_ADMIN') {
            return res.status(StatusCodes.FORBIDDEN).json({
              error: 'Only the owner can reset a member password',
            });
          }
        } else {
          if (principal?.id !== id) {
            return res.status(StatusCodes.FORBIDDEN).json({
              error: 'You can only change your own password',
            });
          }
          const validCurrent = typeof currentPassword === 'string' && currentPassword.length > 0
            && await bcrypt.compare(currentPassword, user.passwordHash);
          if (!validCurrent) {
            return res.status(StatusCodes.BAD_REQUEST).json({
              error: 'Current password is required to set a new password',
            });
          }
        }
        updateData.passwordHash = await bcrypt.hash(password, 10);
        // Invalidate tokens issued before this password change.
        updateData.tokenVersion = { increment: 1 };
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          upiId: true,
          referralCode: true,
          inrBalance: true,
          totalReferrals: true,
          totalEarnings: true,
          currentLevel: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Keep the payout wallet in step when the member changes their UPI id.
      if (upiId !== undefined && user.upiId !== upiId) {
        await prisma.wallet.upsert({
          where: { userId: id },
          update: { upiId },
          create: {
            userId: id,
            upiId,
            currency: 'INR',
            balance: 0,
          },
        });
      }

      return res.status(StatusCodes.OK).json({
        message: 'User updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update user',
      });
    }
  },

  // Delete a user
  async deleteUser(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'User not found',
        });
      }

      await prisma.user.delete({ where: { id } });

      // Member deletion is irreversible, so it is always attributable.
      await recordAdminAction(res.locals.principal, {
        action: 'users:delete',
        entity: 'user',
        entityId: user.id,
        summary: `Deleted member ${user.email}`,
        before: { id: user.id, email: user.email },
      }, req);

      return res.status(StatusCodes.OK).json({
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete user',
      });
    }
  },
    // Revokes every token issued to the calling member by bumping its version.
  async logout(req: Request, res: Response) {
    try {
      const principal = res.locals.principal;
      if (!principal || principal.kind !== 'user') {
        return res.status(403).json({ error: 'Member session required' });
      }
      await prisma.user.update({ where: { id: principal.id }, data: { tokenVersion: { increment: 1 } } });
      res.clearCookie('token');
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error logging out:', error);
      return res.status(500).json({ error: 'Failed to log out' });
    }
  },

async getAllUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const search = req.query.search as string || '';
      const skip = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {}

      if (search) {
        where.OR = [
          { name: { contains: search} },
          { email: { contains: search } },
          { upiId: { contains: search } },
          { referralCode: { contains: search } },
        ]
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            wallet: {
              select: {
                // id: true,
                upiId: true,
                balance: true,
                currency: true,
              }
            },
            id: true,
            name: true,
            email: true,
            upiId: true,
            referralCode: true,
            inrBalance: true,
            totalReferrals: true,
            totalEarnings: true,
            currentLevel: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return res.status(StatusCodes.OK).json({
        data: {
          users,
          pagination: {
            total,
            totalPages,
            current:page,
            count:users.length
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching all users:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch users',
      });
    }
  },

  // Get user's referrals
  async getUserReferrals(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          referrals: {
            select: {
              id: true,
              name: true,
              email: true,
              referralCode: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: 'User not found',
        });
      }

      return res.status(StatusCodes.OK).json({
        data: {
          totalReferrals: user.totalReferrals,
          referrals: user.referrals,
        },
      });
    } catch (error) {
      console.error('Error fetching referrals:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch referrals',
      });
    }
  },

  // Get user's wallet
  async getUserWallet(req: Request, res: Response) {
    try {
      const id  = req.params.id as string;

      const wallet = await prisma.wallet.findUnique({
        where: { userId: id },
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
};