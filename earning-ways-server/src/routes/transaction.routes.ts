import { Router } from "express";
import { transactionController } from "../controller/transecton.js";

const transactionRoutes = Router();

// Create a new transaction
transactionRoutes.post('/create', transactionController.createTransaction);

// Get all transactions
transactionRoutes.get('/all', transactionController.getAllTransactions);

// Routes for a specific transaction by ID
transactionRoutes.route('/:id')
    .get(transactionController.getTransactionById)
    .put(transactionController.updateTransaction)
    .delete(transactionController.deleteTransaction);

// Get transactions by user ID
transactionRoutes.get('/user/:userId', transactionController.getTransactionsByUserId);

// Get transactions by investment ID
transactionRoutes.get('/investment/:investmentId', transactionController.getTransactionsByInvestmentId);

export default transactionRoutes;