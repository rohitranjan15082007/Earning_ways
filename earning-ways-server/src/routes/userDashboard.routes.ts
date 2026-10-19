import { Router } from "express";
import { getUserDashboard } from "../controller/userDashboard.js";

export const userDashboardRoute = Router();

userDashboardRoute.get("/:id", getUserDashboard)

export default userDashboardRoute;