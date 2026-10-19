import express from "express";
import {
  changeOwnPassword,
  deleteAdmin,
  getAllAdmins,
  getPermissionCatalogue,
  getPolicy,
  loginAdmin,
  logoutAdmin,
  registerAdmin,
  resetAdminPassword,
  revokeAdminSessions,
  updateAdmin,
  updatePolicy,
} from "../controller/admin/admin.js";
import { listAuditLog } from "../controller/admin/audit.js";

// Every rule in this file is enforced by the access policy router mounted at
// /api (src/routes/access.routes.ts): team management and the payout policy are
// owner-only, the team list needs team:read, the audit log needs audit:read.
const router = express.Router({ caseSensitive: true, strict: true });

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/logout", logoutAdmin);

// Any signed-in admin manages their own password.
router.post("/password", changeOwnPassword);

// Team & roles.
router.get("/permissions", getPermissionCatalogue);
router.get("/policy", getPolicy);
router.put("/policy", updatePolicy);
router.get("/audit", listAuditLog);
router.get("/", getAllAdmins);
router.post("/:id/password", resetAdminPassword);
router.post("/:id/revoke", revokeAdminSessions);
router.patch("/:id", updateAdmin);
router.delete("/:id", deleteAdmin);

export default router;
