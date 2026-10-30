import express from "express";
import { ensureAuthenticated } from "../middleware/auth.js";
import * as userController from "../controllers/userController.js";

const router = express.Router();

router.get("/watchlist", ensureAuthenticated, userController.renderWatchlist);
router.post(
  "/api/watchlist/toggle",
  ensureAuthenticated,
  userController.toggleWatchlist,
);
router.post("/api/like/toggle", ensureAuthenticated, userController.toggleLike);
router.post(
  "/api/follow/toggle",
  ensureAuthenticated,
  userController.toggleFollow,
);
// إضافة لملف routes/userRoutes.js

router.get("/profile/:username", userController.renderProfile);
router.get("/settings", ensureAuthenticated, userController.renderSettings);
router.put(
  "/api/settings/preferences",
  ensureAuthenticated,
  userController.updateSettings,
);
router.put(
  "/api/settings/security",
  ensureAuthenticated,
  userController.updateAccountSecurity,
);
router.delete(
  "/api/settings/account",
  ensureAuthenticated,
  userController.deleteAccount,
);
export default router;
