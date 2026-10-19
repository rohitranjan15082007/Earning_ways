import { z } from "zod";

// Create Enquiry Validation Schema
export const createEnquirySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(20, "Phone number must not exceed 20 characters"),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200, "Subject must not exceed 200 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(2500, "Message must not exceed 500 words (approximately 2500 characters)"),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

// ID validation
export const enquiryIdSchema = z.object({
  id: z.string().uuid("Invalid enquiry ID"),
});

export type EnquiryIdInput = z.infer<typeof enquiryIdSchema>;

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive("Page must be a positive integer").default(1),
  limit: z.coerce.number().int().positive("Limit must be a positive integer").max(100, "Limit must not exceed 100").default(10),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
