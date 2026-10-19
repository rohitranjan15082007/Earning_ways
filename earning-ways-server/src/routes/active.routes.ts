

// // routes/statsRoutes.js (optional: to mount the controller)
// import express from "express";
// import statsController from "../controller/active.js";
// const routers = express.Router();

// // GET /api/stats - Fetch user statistics
// routers.get('/stats', statsController.getUserStats);


// export default routers


import { Router } from "express";
import updateSetting, { getSettingData } from "../controller/active.js"; // Adjust path as needed

const routers = Router();

routers.post("/update/setting", updateSetting); 
routers.get("/", getSettingData)

export default routers;