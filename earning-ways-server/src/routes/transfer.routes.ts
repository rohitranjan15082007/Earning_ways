import { Router } from "express";
import { transferController } from "../controller/transfer.js";

const transferRoutes = Router();

// Create a new transfer
transferRoutes.post('/create', transferController.createTransfer);

// Get all transfers
transferRoutes.get('/all', transferController.getAllTransfers);

// Routes for a specific transfer by ID
transferRoutes.route('/:id')
    .get(transferController.getTransferById)
    .put(transferController.updateTransfer)
    .delete(transferController.deleteTransfer);

// Get transfers by sender ID
transferRoutes.get('/sender/:senderId', transferController.getTransfersBySenderId);

// Get transfers by receiver ID
transferRoutes.get('/receiver/:receiverId', transferController.getTransfersByReceiverId);

export default transferRoutes;