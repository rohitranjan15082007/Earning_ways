import { Router } from "express";

const router = Router();

import {
  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  deleteEnquiry,
} from "../controller/enqiry.js";

// POST /api/enquiries - Create a new enquiry
router.post("/", createEnquiry);

// GET /api/enquiries - Get all enquiries with pagination
router.get("/", getAllEnquiries);

// GET /api/enquiries/:id - Get a single enquiry by ID
router.get("/:id", getEnquiryById);

// DELETE /api/enquiries/:id - Delete an enquiry
router.delete("/:id", deleteEnquiry);

export default router;
