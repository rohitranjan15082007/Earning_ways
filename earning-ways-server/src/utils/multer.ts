import type { Request } from "express";
import multer from "multer";

// Configure multer for in-memory storage
const storage = multer.memoryStorage();

// File filter to only allow images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

// Configure multer
 const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

// Middleware for handling multiple payment screenshot uploads
export const uploadPaymentScreenshots = upload.fields([
    { name: 'processingFee', maxCount: 1 },
    { name: 'bankTransactionPaperFee', maxCount: 1 },
    { name: 'insuranceFee', maxCount: 1 },
    { name: 'cibilFee', maxCount: 1 },
    { name: 'tdsFee', maxCount: 1 },
    { name: 'nocFee', maxCount: 1 },
]);

export default upload;
