import { Router } from 'express';
import { walletController } from '../controller/wallet.js';

const walletRoutes = Router();

// Create a new wallet
walletRoutes.post('/create', walletController.createWallet);

// Wallet routes by userId
walletRoutes.route('/:userId')
    .get(walletController.getWalletByUserId)
    .put(walletController.updateWallet)
    .delete(walletController.deleteWallet);

export default walletRoutes;
