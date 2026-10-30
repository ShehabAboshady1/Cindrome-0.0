import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import db from "./config/db.js";
import session from "express-session";
import passport from "./config/passport.js";
import "dotenv/config";
import connectPgSimple from "connect-pg-simple";

// 🌟 استدعاء الـ Routes والمساعدات 🌟
import authRoutes from "./routes/authRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import listRoutes from "./routes/listRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import { getUserWatchlistIds, getUserLikedMediaIds } from "./utils/helpers.js";

const pgSession = connectPgSimple(session);
const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set("trust proxy", 1);
app.use(express.static(path.join(__dirname, "../client")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    store: new pgSession({
      pool: db,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production" ? true : false,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => {
  res.locals.user = req.user;
  if (req.user) {
    res.locals.watchlistMap = await getUserWatchlistIds(req.user.id);
    res.locals.likedMediaMap = await getUserLikedMediaIds(req.user.id);
  } else {
    res.locals.watchlistMap = [];
    res.locals.likedMediaMap = [];
  }
  next();
});

app.use(authRoutes);
app.use(mediaRoutes);
app.use(listRoutes);
app.use(userRoutes);
app.use(reviewRoutes);

app.get("/drome", (req, res) => res.render("drome.ejs"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
