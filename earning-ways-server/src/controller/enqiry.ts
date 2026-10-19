import type { Request, Response } from "express";
import prisma from "../config/prisma.js";
import { createEnquirySchema, enquiryIdSchema, paginationSchema } from "../validation/enquiry.js";
import { zodError } from "../validation/index.js";

// Create a new enquiry
export const createEnquiry = async (req: any, res: any) => {
  try {
    const validation = createEnquirySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: zodError(validation.error),
      });
    }

    const { name, email, phone, subject, message } = validation.data;

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        phone,
        subject,
        message,
      },
    });

    res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      data: enquiry,
    });
  } catch (error: any) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create enquiry",
    });
  }
};

// Get all enquiries with pagination
export const getAllEnquiries = async (req: any, res: any) => {
  try {
    const validation = paginationSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: zodError(validation.error),
      });
    }

    const { page, limit } = validation.data;
    const skip = (page - 1) * limit;

    const [enquiries, total] = await Promise.all([
      prisma.enquiry.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.enquiry.count(),
    ]);

    res.status(200).json({
      success: true,
      message: "Enquiries retrieved successfully",
      data: enquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error("Error fetching enquiries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiries",
    });
  }
};

// Get a single enquiry by ID
export const getEnquiryById = async (req: any, res: any) => {
  try {
    const validation = enquiryIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: zodError(validation.error),
      });
    }

    const { id } = validation.data;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Enquiry retrieved successfully",
      data: enquiry,
    });
  } catch (error: any) {
    console.error("Error fetching enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiry",
    });
  }
};

// Delete an enquiry by ID
export const deleteEnquiry = async (req: any, res: any) => {
  try {
    const validation = enquiryIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: zodError(validation.error),
      });
    }

    const { id } = validation.data;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    await prisma.enquiry.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting enquiry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete enquiry",
    });
  }
};
