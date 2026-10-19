import { Router } from 'express';
import { withdrawalController } from '../controller/withdraw.js';
import upload from '../middleware/multer.middleware.js';

const withdrawalRoutes = Router();

// Payout QR image upload (multipart field `qrCodeImage`). Returns the stored URL
// only; the member then submits it with the withdrawal request.
withdrawalRoutes.post('/qr', upload.single('qrCodeImage'), withdrawalController.uploadQrCode);

// Create a new withdrawal
withdrawalRoutes.post('/create', withdrawalController.createWithdrawal);

// Get all withdrawals
withdrawalRoutes.get('/all', withdrawalController.getAllWithdrawals);

// Routes for a specific withdrawal by ID
withdrawalRoutes.route('/:id')
  .get(withdrawalController.getWithdrawalById)
  .put(withdrawalController.updateWithdrawal)
  .delete(withdrawalController.deleteWithdrawal);

// Get withdrawals by user ID
withdrawalRoutes.get('/user/:userId', withdrawalController.getWithdrawalsByUserId);

export default withdrawalRoutes;
