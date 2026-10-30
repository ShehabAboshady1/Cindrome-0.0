import express from "express";
import { ensureAuthenticated } from "../middleware/auth.js";
import * as listController from "../controllers/listController.js";

const router = express.Router();

// Public list discovery and view routes
router.get("/lists", listController.renderListsPage);
router.get("/single-list", listController.renderSingleList);
router.get("/api/lists/explore", listController.exploreListsApi);

// Protected list management operations
router.post(
  "/api/lists/create",
  ensureAuthenticated,
  listController.createList,
);
router.put("/api/lists/:id", ensureAuthenticated, listController.updateList);
router.delete("/api/lists/:id", ensureAuthenticated, listController.deleteList);

// List social interactions (likes and comments)
router.post(
  "/api/lists/:id/like",
  ensureAuthenticated,
  listController.toggleListLike,
);
router.post(
  "/api/lists/:id/comment",
  ensureAuthenticated,
  listController.addListComment,
);
router.post(
  "/api/list-comments/:id/like",
  ensureAuthenticated,
  listController.toggleListCommentLike,
);

export default router;
