import { Router } from 'express';
import { referralController } from '../controller/refferel.js';

const referralRoutes = Router();

// Create a new referral
referralRoutes.post('/create', referralController.createReferral);

// Get all referrals
referralRoutes.get('/all', referralController.getAllReferrals);

// Routes for a specific referral by ID
referralRoutes.route('/:id')
  .get(referralController.getReferralById)
  .put(referralController.updateReferral)
  .delete(referralController.deleteReferral);

// Get referrals by referrer ID
referralRoutes.get('/referrer/:referrerId', referralController.getReferralsByReferrerId);

// Get referrals by referred user ID
referralRoutes.get('/referred/:referredUserId', referralController.getReferralsByReferredUserId);

export default referralRoutes;
