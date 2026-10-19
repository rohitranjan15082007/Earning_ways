import { Router } from "express";
import { userController } from "../controller/user.js";

const userRoutes = Router({ caseSensitive: true, strict: true });

userRoutes.post('/create', userController.createUser);
userRoutes.post('/login', userController.loginUser);
userRoutes.post('/logout', userController.logout);
userRoutes.get('/all', userController.getAllUsers);

userRoutes.route('/:id')
    .get(userController.getUserById)
    .put(userController.updateUser)
    .delete(userController.deleteUser);

userRoutes.route('/referrals/:id')
    .get(userController.getUserReferrals);

userRoutes.route('/wallet/:id')
    .get(userController.getUserWallet);

export default userRoutes;