import { Router } from 'express';
import { investmentController } from '../controller/invesment.js';

const investmentRoutes = Router();

// Create a new investment
investmentRoutes.post('/create', investmentController.createInvestment);

// Get all investments
  investmentRoutes.get('/all', investmentController.getAllInvestments);

// Routes for a specific investment by ID
investmentRoutes.route('/:id')
  .get(investmentController.getInvestmentById)
  .put(investmentController.updateInvestment)
  .delete(investmentController.deleteInvestment);

// Get detailed ROI records and transactions for a specific investment
investmentRoutes.get('/details/:id', investmentController.getInvestmentDetails);

export default investmentRoutes;
