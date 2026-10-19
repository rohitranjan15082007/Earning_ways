// import { Router } from 'express';
// import { subscriptionPlanController } from '../controller/subscriptoin.js';

// const subscriptionRoutes = Router();

// // ✅ Create a new subscription plan
// subscriptionRoutes.post('/create', subscriptionPlanController.createSubscriptionPlan);

// // ✅ Get all subscription plans
// subscriptionRoutes.get('/all', subscriptionPlanController.getAllSubscriptionPlans);

// // ✅ Get a specific subscription plan by ID
// subscriptionRoutes.route('/:id')
//     .get(subscriptionPlanController.getSubscriptionPlanById)
//     .put(subscriptionPlanController.updateSubscriptionPlan)
//     .delete(subscriptionPlanController.deleteSubscriptionPlan);

// // Get all investments for a specific subscription plan
// subscriptionRoutes.get('/investments/:id', subscriptionPlanController.getSubscriptionPlanInvestments);

// export default subscriptionRoutes;


import { Router } from 'express';
import { subscriptionPlanController } from '../controller/subscriptoin.js'; // Adjust path as needed

const router = Router({ caseSensitive: true, strict: true });

// Create a new subscription plan
router.post('/create', subscriptionPlanController.createSubscriptionPlan);

// Get all subscription plans
router.get('/all', subscriptionPlanController.getAllSubscriptionPlans);

// Get a subscription plan by ID
router.get('/:id', subscriptionPlanController.getSubscriptionPlanById);

// Update a subscription plan
router.put('/:id', subscriptionPlanController.updateSubscriptionPlan);

// Delete a subscription plan
router.delete('/:id', subscriptionPlanController.deleteSubscriptionPlan);

// Get investments for a subscription plan
router.get('/:id/investments', subscriptionPlanController.getSubscriptionPlanInvestments);

export default router;
