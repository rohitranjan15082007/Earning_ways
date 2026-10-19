import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middleware/error.middleware.js";
import { ErrorResponse } from "../../utils/response.util.js";

export const createNotification = asyncHandler(async (req, res, next) => {
  const { title, message, type, meta, expiresAt, userIds } = req.body;

  // Validate required fields
  if (!title || !message || !type) {
    return next(new ErrorResponse("title, message, type are required", 400));
  }

  // Validate type enum (optional but good practice)
  const validTypes = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'PROMOTIONAL', 'SYSTEM'];
  if (!validTypes.includes(type)) {
    return next(new ErrorResponse("Invalid notification type", 400));
  }
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        meta: meta ? JSON.parse(meta) : null, // Parse JSON if stringified
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        userNotifications: {
          create: userIds.map((userId: string) => ({
            userId,
          })),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
});

export const getAllNotifications = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
});

// get notification by userId
export const getNotificationByUserId = asyncHandler(async (req, res, next) => {
  const userId = req.params.id!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.userNotification.findMany({
      where: { userId },
      include: { notification: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userNotification.count({
      where: { userId },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    data: notifications,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});