import { Router } from 'express';
import { getDashboardData } from '../controller/dashboard.js'; // Adjust the import path as needed

const dashboardRoutes = Router();

// Get dashboard statistics and data
dashboardRoutes.get('/', getDashboardData);

export default dashboardRoutes;