// routes/mediaRoutes.js
import express from "express";
import * as mediaController from "../controllers/mediaController.js";

const router = express.Router();

router.get("/", mediaController.renderHome);
router.get("/anime", mediaController.renderAnime);
router.get("/movies", mediaController.renderMovies);
router.get("/series", mediaController.renderSeries);
router.get("/details", mediaController.renderDetails);
router.get(
  "/api/tv/:id/season/:seasonNumber",
  mediaController.getSeasonEpisodes,
);
router.get("/discover", mediaController.renderDiscover);
router.get("/api/discover", mediaController.apiDiscover);
router.get("/api/search", mediaController.apiSearch);
export default router;
