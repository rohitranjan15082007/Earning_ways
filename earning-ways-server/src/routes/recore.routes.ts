import { Router } from 'express';
import { roiRecordController } from '../controller/record.js';

const roiRecordRoutes = Router();

// Create a new ROI record
roiRecordRoutes.post('/create', roiRecordController.createROIRecord);

// Get all ROI records
roiRecordRoutes.get('/all', roiRecordController.getAllROIRecords);

// Routes for a specific ROI record by ID
roiRecordRoutes.route('/:id')
  .get(roiRecordController.getROIRecordById)
  .put(roiRecordController.updateROIRecord)
  .delete(roiRecordController.deleteROIRecord);

// Get ROI records by user ID
roiRecordRoutes.get('/user/:userId', roiRecordController.getROIRecordsByUserId);

// Get ROI records by investment ID
roiRecordRoutes.get('/investment/:investmentId', roiRecordController.getROIRecordsByInvestmentId);

export default roiRecordRoutes;
