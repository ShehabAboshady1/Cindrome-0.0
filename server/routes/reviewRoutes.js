import express from "express";
import { ensureAuthenticated } from "../middleware/auth.js";
import * as reviewController from "../controllers/reviewController.js";

const router = express.Router();

router.get("/diary", ensureAuthenticated, reviewController.renderDiary);
router.get("/review/:id", reviewController.renderSingleReview);

router.post(
  "/api/reviews/log",
  ensureAuthenticated,
  reviewController.logReview,
);
router.put(
  "/api/reviews/:id",
  ensureAuthenticated,
  reviewController.updateReview,
);
router.delete(
  "/api/reviews/:id",
  ensureAuthenticated,
  reviewController.deleteReview,
);

router.post(
  "/api/reviews/:id/like",
  ensureAuthenticated,
  reviewController.toggleReviewLike,
);
router.post(
  "/api/reviews/:id/comment",
  ensureAuthenticated,
  reviewController.addReviewComment,
);
router.post(
  "/api/comments/:id/like",
  ensureAuthenticated,
  reviewController.toggleCommentLike,
);

export default router;
