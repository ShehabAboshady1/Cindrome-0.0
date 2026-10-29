// routes/authRoutes.js
import express from "express";
import passport from "passport";
import { upload } from "../config/upload.js";
import { ensureAuthenticated } from "../middleware/auth.js";
import * as authController from "../controllers/authController.js";

const router = express.Router();

router.get("/sign-in", authController.renderSignIn);
router.get("/sign-up", authController.renderSignUp);
router.post("/register", authController.registerUser);
router.get("/logout", authController.logoutUser);

// مسار الدخول مدمج فيه إعدادات الجلسات الخاصة بـ Passport
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect("/sign-in?error=1");

    req.logIn(user, (err) => {
      if (err) return next(err);
      if (req.body.remember === "true") {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.expires = false;
      }
      return res.redirect("/");
    });
  })(req, res, next);
});

// مسار التعديل بنمرره على طبقة الحماية وبعدين رفع الصور وبعدين اللوجيك
router.post(
  "/edit-profile",
  ensureAuthenticated,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "backdrop", maxCount: 1 },
  ]),
  authController.editProfile,
);

export default router;
