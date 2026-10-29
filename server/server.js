import express, { raw } from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import bcrypt from "bcrypt";
import db from "./config/db.js";
import session from "express-session";
import passport from "passport";
import LocalStrategy from "passport-local";
import "dotenv/config";
import connectPgSimple from "connect-pg-simple";

// 🌟 استدعاء الملفات اللي فصلناها 🌟
import { upload } from "./config/upload.js";
import authRoutes from "./routes/authRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import {
  formatCard,
  formatCommentText,
  getUserWatchlistIds,
  getUserLikedMediaIds,
} from "./utils/helpers.js";
// import { ensureAuthenticated } from "./middleware/auth.js"; // هنفعلها بعدين واحنا بنفصل المسارات

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

const TMDB_API_KEY = process.env.TMDB_API_KEY;
app.get("/drome", (req, res) => res.render("drome.ejs"));
app.get("/lists", async (req, res) => {
  try {
    res.render("lists.ejs");
  } catch (error) {
    console.error("Error loading lists page:", error);
    res.status(500).send("Server Error");
  }
});
app.get("/api/lists/explore", async (req, res) => {
  try {
    const { search = "", filter = "Popular", page = 1 } = req.query;
    const limit = 12; // عدد القوائم في الصفحة
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;
    const currentUserId = req.user ? req.user.id : -1;

    let queryParams = [];
    let whereClauses = ["l.is_private = false"]; // دايماً بنجيب الـ Public بس

    // 1. فلتر البحث
    if (search.trim() !== "") {
      whereClauses.push(`l.title ILIKE $${queryParams.length + 1}`);
      queryParams.push(`%${search.trim()}%`);
    }

    // 2. فلتر הـ Following
    if (filter === "Following" && req.user) {
      whereClauses.push(
        `l.user_id IN (SELECT following_id FROM followers WHERE follower_id = $${queryParams.length + 1})`,
      );
      queryParams.push(req.user.id);
    }

    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 3. الترتيب
    let orderBy = "l.created_at DESC"; // Default: Recent
    if (filter === "Popular") {
      orderBy = "likes_count DESC, l.created_at DESC";
    }

    // الاستعلام الأساسي (مع عداد اللايكات والكومنتات والبوسترات)
    const query = `
            SELECT 
                l.id AS list_id, l.title, l.created_at,
                u.username,
                (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS total_items,
                (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) AS likes_count,
                (SELECT COUNT(*) FROM list_comments lc WHERE lc.list_id = l.id) AS comments_count,
                EXISTS(SELECT 1 FROM list_likes ll WHERE ll.list_id = l.id AND ll.user_id = ${currentUserId}) AS is_liked_by_user,
                COALESCE(
                    (
                        SELECT json_agg(sub.poster_path)
                        FROM (
                            SELECT mc.poster_path
                            FROM list_items li2
                            JOIN media_cache mc ON li2.tmdb_id = mc.tmdb_id AND li2.media_type = mc.media_type
                            WHERE li2.list_id = l.id
                            ORDER BY li2.order_index ASC
                            LIMIT 4
                        ) sub
                    ), '[]'::json
                ) AS preview_posters
            FROM lists l
            JOIN users u ON l.user_id = u.id
            ${whereString}
            ORDER BY ${orderBy}
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

    queryParams.push(limit, offset);
    const result = await db.query(query, queryParams);

    // جلب العدد الإجمالي للصفحات (عشان הـ Pagination)
    const countQuery = `
            SELECT COUNT(*) 
            FROM lists l 
            ${whereString}
        `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalLists = parseInt(countResult.rows[0].count);
    const totalPages = Math.max(1, Math.ceil(totalLists / limit));

    res.json({
      lists: result.rows,
      currentPage: parseInt(page),
      totalPages: totalPages,
    });
  } catch (error) {
    console.error("Explore Lists API Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// 🌟 مسار البروفايل الديناميكي 🌟
app.get("/profile/:username", async (req, res, next) => {
  try {
    const requestedUsername = req.params.username;

    // 1. استعلام بيجيب بيانات اليوزر + الإعدادات + البروفايل في ضربة واحدة
    const query = `
      SELECT 
        u.id, u.username, u.email, 
        s.is_private, s.notify_new_follower, s.notify_review_interaction,
        p.display_name, p.bio, p.avatar_url, p.backdrop_url
      FROM users u
      LEFT JOIN user_settings s ON u.id = s.user_id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.username = $1
    `;
    const result = await db.query(query, [requestedUsername]);

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    const profileUser = result.rows[0];

    // 2. استعلام منفصل عشان نجيب الـ Genres
    const genresResult = await db.query(
      "SELECT genre FROM user_favorite_genres WHERE user_id = $1 LIMIT 2",
      [profileUser.id],
    );
    const favoriteGenres = genresResult.rows.map((row) => row.genre);

    // 3. هل الزائر هو صاحب الحساب؟ وهل هو عامله فولو؟
    let isSelf = false;
    let isFollowing = false; // المتغير الجديد لحالة الفولو

    if (req.user) {
      if (req.user.id === profileUser.id) {
        isSelf = true;
      } else {
        // لو مش صاحب الحساب، نسأل الداتابيز: هل أنا عامله فولو؟
        const followCheck = await db.query(
          "SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = $2",
          [req.user.id, profileUser.id],
        );
        if (followCheck.rows.length > 0) {
          isFollowing = true; // لو لقينا السجل، يبقى هو عامله فولو
        }
      }
    }
    // === جلب الأرقام (Stats) ===
    // 1. عدد المتابعين (اللي بيتابعوا صاحب البروفايل)
    const followersRes = await db.query(
      "SELECT COUNT(*) FROM followers WHERE following_id = $1",
      [profileUser.id],
    );
    const followersCount = followersRes.rows[0].count;

    // 2. عدد الأشخاص اللي صاحب البروفايل بيتابعهم
    const followingRes = await db.query(
      "SELECT COUNT(*) FROM followers WHERE follower_id = $1",
      [profileUser.id],
    );
    const followingCount = followingRes.rows[0].count;

    // (مسحنا كود الاستعلام القديم بتاع الوتش ليست من هنا)

    // === جلب أعمال المفضلة (من جدول liked_media) ===
    const favoritesRes = await db.query(
      `
      SELECT f.tmdb_id, f.media_type, m.title, m.poster_path, m.run_time, m.total_episodes, m.total_seasons
      FROM liked_media f
      JOIN media_cache m ON f.tmdb_id = m.tmdb_id AND f.media_type = m.media_type
      WHERE f.user_id = $1
      ORDER BY f.liked_at DESC
    `,
      [profileUser.id],
    );
    const favoriteMedia = favoritesRes.rows;
    // === جلب قائمة مشاهدة الزائر (عشان نعلم على الزرار بالناقص لو متضاف) ===
    let myWatchlist = [];
    if (req.user) {
      const wlRes = await db.query(
        "SELECT tmdb_id, media_type FROM watchlist WHERE user_id = $1",
        [req.user.id],
      );
      myWatchlist = wlRes.rows;
    }

    // === جلب إحصائيات المشاهدة (Watch Stats) وساعات المشاهدة بدقة (معالجة التقييمات المتعددة) ===
    const statsQuery = `
      SELECT 
        r.tmdb_id,
        r.media_type,
        r.season_number,
        r.episode_number,
        m.run_time,
        m.total_episodes,
        m.total_seasons,
        -- 🌟 السطر السحري: هل اليوزر ده عمره قيّم العمل ده بالكامل قبل كده؟ 🌟
        EXISTS (
          SELECT 1 FROM reviews r2 
          WHERE r2.user_id = $1 
            AND r2.tmdb_id = r.tmdb_id 
            AND r2.media_type = r.media_type
            AND r2.season_number IS NULL
        ) as watched_all
      FROM (
        SELECT DISTINCT ON (tmdb_id, media_type) *
        FROM reviews
        WHERE user_id = $1
        ORDER BY tmdb_id, media_type, watch_date DESC, created_at DESC
      ) r
      JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
    `;
    const statsRes = await db.query(statsQuery, [profileUser.id]);

    let statsMovies = 0;
    let statsSeries = 0;
    let statsAnime = 0;
    let totalWatchMinutes = 0;
    let finalWatchedCount = 0;

    statsRes.rows.forEach((row) => {
      // تحديد وقت الحلقة (لو مش متسجل في TMDB بنفترض 24 دقيقة للأنمي و 45 للمسلسل)
      let runtime = parseInt(row.run_time);
      if (!runtime || runtime === 0) {
        runtime = row.media_type === "anime" ? 24 : 45;
      }

      // 1. حساب الأعمال المكتملة (مستحيل ينقص دلوقتي لو كنت مخلصه قبل كده)
      if (row.media_type === "movie" || row.watched_all) {
        finalWatchedCount++;
        if (row.media_type === "movie") statsMovies++;
        else if (row.media_type === "tv" || row.media_type === "series")
          statsSeries++;
        else if (row.media_type === "anime") statsAnime++;
      }

      // 2. حساب وقت المشاهدة التراكمي
      if (row.media_type === "movie") {
        totalWatchMinutes += runtime;
      } else {
        const totalEps = parseInt(row.total_episodes) || 1;

        if (row.watched_all) {
          // طالما مخلصه في أي وقت، نضرب كل حلقاته الإجمالية في وقت الحلقة
          totalWatchMinutes += totalEps * runtime;
        } else {
          // لو لسه بيتفرج ولم يكمله أبدًا، نجمع اللي شافه
          const totalSeasons = parseInt(row.total_seasons) || 1;
          const currentSeason = parseInt(row.season_number) || 1;
          const currentEp = parseInt(row.episode_number) || 0;

          const avgEpsPerSeason = totalEps / totalSeasons;
          let estimatedEpsWatched =
            (currentSeason - 1) * avgEpsPerSeason + currentEp;

          if (estimatedEpsWatched > totalEps || currentEp > avgEpsPerSeason) {
            estimatedEpsWatched = Math.min(currentEp, totalEps);
          }

          totalWatchMinutes += Math.round(estimatedEpsWatched) * runtime;
        }
      }
    });

    const totalWatchHours = Math.round(totalWatchMinutes / 60);
    // === جلب قائمة Currently Watching ===
    const watchingQuery = `
      SELECT DISTINCT ON (r.tmdb_id) 
        r.tmdb_id,
        r.media_type,
        r.season_number,
        r.episode_number,
        r.watch_date,
        m.title,
        m.poster_path,
        m.total_episodes,
        m.total_seasons,
        m.is_anime
      FROM reviews r
      JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
      WHERE r.user_id = $1 
        AND r.media_type != 'movie' 
        AND r.season_number IS NOT NULL 
        AND r.episode_number IS NOT NULL
      ORDER BY r.tmdb_id, r.watch_date DESC, r.created_at DESC
    `;
    const watchingRes = await db.query(watchingQuery, [profileUser.id]);

    // هنحسب الشريط الأخضر لكل كارت بذكاء
    const currentlyWatching = watchingRes.rows.map((item) => {
      let progressPercentage = 0;
      let progressText = `Season ${item.season_number} • Episode ${item.episode_number}`;

      const totalEps = parseInt(item.total_episodes) || 0;
      const totalSeasons = parseInt(item.total_seasons) || 1;
      const currentSeason = parseInt(item.season_number) || 1;
      const currentEp = parseInt(item.episode_number) || 0;

      if (totalEps > 0) {
        // حساب تقريبي للتقدم
        const avgEpsPerSeason = totalEps / totalSeasons;
        let estimatedEpsWatched =
          (currentSeason - 1) * avgEpsPerSeason + currentEp;

        // 🌟 الذكاء هنا: لو الحسبة عدت الإجمالي أو رقم الحلقة نفسه كبير جداً
        // ده معناه إننا بنتعامل مع ترقيم إجمالي (زي وان بيس) مش ترقيم جوه الموسم
        if (estimatedEpsWatched > totalEps || currentEp > avgEpsPerSeason) {
          estimatedEpsWatched = Math.min(currentEp, totalEps);
        }

        estimatedEpsWatched = Math.round(estimatedEpsWatched);

        progressPercentage = Math.min(
          100,
          Math.round((estimatedEpsWatched / totalEps) * 100),
        );

        // لو أنمي، نعرض النص بشكل أفضل (رقم الحلقة من الإجمالي)
        if (item.is_anime) {
          progressText = `Episode ${estimatedEpsWatched} of ${totalEps}`;
        }
      }

      return {
        ...item,
        progressPercentage,
        progressText,
      };
    });

    // نرتبهم تاني بحيث أحدث حاجة اتشافت تظهر الأول
    currentlyWatching.sort(
      (a, b) => new Date(b.watch_date) - new Date(a.watch_date),
    );

    const reviewsQuery = `
      SELECT 
        r.id AS review_id,
        r.tmdb_id,
        r.media_type,
        r.rating,
        r.review_text,
        r.has_spoilers,
        r.liked,
        r.created_at,
        r.season_number,
        r.episode_number,
        m.is_anime,
        m.title,
        m.poster_path,
        (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) as likes_count,
        (SELECT COUNT(*) FROM review_comments rc WHERE rc.review_id = r.id) as comments_count,
        ${req.user ? `EXISTS (SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
      FROM reviews r
      JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
      WHERE r.user_id = $1 
        AND r.review_text IS NOT NULL 
        AND TRIM(r.review_text) != ''
      ORDER BY r.created_at DESC
    `;
    const reviewsRes = await db.query(reviewsQuery, [profileUser.id]);
    const userReviews = reviewsRes.rows;

    // === جلب القوائم (Lists Tab) ===
    // الاستعلام ده بيجيب كل قائمة، وبيعد الأفلام اللي جواها، وبيجيب أول 4 بوسترات كـ Array
    // === جلب القوائم (Lists Tab) مع مراعاة الخصوصية ===
    const listsQuery = `
      SELECT 
          l.id AS list_id,
          l.title,
          l.is_private,
          l.created_at,
          COUNT(DISTINCT li.id) AS total_items,
          (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) as likes_count,
          (SELECT COUNT(*) FROM list_comments lc WHERE lc.list_id = l.id) as comments_count,
          ${req.user ? `EXISTS (SELECT 1 FROM list_likes ll WHERE ll.list_id = l.id AND ll.user_id = ${req.user.id})` : "false"} as is_liked_by_user,
          COALESCE(
              (
                  SELECT json_agg(sub.poster_path)
                  FROM (
                      SELECT mc.poster_path
                      FROM list_items li2
                      LEFT JOIN media_cache mc ON li2.tmdb_id = mc.tmdb_id AND li2.media_type = mc.media_type
                      WHERE li2.list_id = l.id
                      ORDER BY li2.order_index ASC
                      LIMIT 4
                  ) sub
              ), '[]'::json
          ) AS preview_posters
      FROM lists l
      LEFT JOIN list_items li ON l.id = li.list_id
      WHERE l.user_id = $1 AND (l.is_private = false OR $2 = true)
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `;
    // هنباصي profileUser.id و isSelf
    const listsResult = await db.query(listsQuery, [profileUser.id, isSelf]);
    // 4. إرسال كل الداتا دي لصفحة الـ EJS
    res.render("profile.ejs", {
      currentlyWatching: currentlyWatching,
      profileUser: profileUser,
      favoriteGenres: favoriteGenres,
      isSelf: isSelf,
      isFollowing: isFollowing,
      followersCount: followersCount,
      followingCount: followingCount,
      totalWatchedCount: finalWatchedCount, // 🌟 هنا بعتنا المتغير الجديد بدال القديم
      favoriteMedia: favoriteMedia,
      myWatchlist: myWatchlist,
      statsMovies: statsMovies,
      statsSeries: statsSeries,
      statsAnime: statsAnime,
      totalWatchHours: totalWatchHours,
      userReviews: userReviews,
      userLists: listsResult.rows,
    });
  } catch (err) {
    console.error("Error loading profile:", err);
    next(err);
  }
});
app.get("/settings", (req, res) => res.render("settings.ejs"));
// ==========================================
// Route: Single List Page (Dynamic)
// ==========================================
app.get("/single-list", async (req, res) => {
  try {
    const listId = req.query.id;
    if (!listId) {
      return res.redirect("/"); // لو مفيش رقم قائمة، نرجعه للرئيسية
    }

    // 1. نجيب بيانات القائمة مع عدد اللايكات وحالة اللايك لليوزر الحالي
    const listQuery = `
      SELECT 
        l.id, l.title, l.is_private, l.user_id, l.created_at, l.updated_at,
        u.username,
        p.avatar_url,
        (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) as likes_count,
        ${req.user ? `EXISTS (SELECT 1 FROM list_likes ll WHERE ll.list_id = l.id AND ll.user_id = ${req.user.id})` : "false"} as is_liked_by_user
      FROM lists l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE l.id = $1
    `;
    const listRes = await db.query(listQuery, [listId]);

    if (listRes.rows.length === 0) {
      return res.status(404).send("List not found");
    }
    const list = listRes.rows[0];

    const isOwner = req.user && req.user.id === list.user_id;
    if (list.is_private && !isOwner) {
      return res
        .status(403)
        .send(
          "Sorry, this list is private and can only be viewed by its creator.",
        );
    }

    const currentUserId = req.user ? req.user.id : -1;

    // ... (سيب استعلام itemsQuery و watchedQuery زي ما هما) ...

    const itemsQuery = `
      SELECT 
        li.tmdb_id, li.media_type, li.order_index,
        mc.title, mc.poster_path, mc.rating, mc.is_anime,
        EXISTS(SELECT 1 FROM liked_media lm WHERE lm.user_id = $2 AND lm.tmdb_id = li.tmdb_id AND lm.media_type = li.media_type) as is_liked,
        EXISTS(SELECT 1 FROM watchlist w WHERE w.user_id = $2 AND w.tmdb_id = li.tmdb_id AND w.media_type = li.media_type) as is_watchlisted
      FROM list_items li
      JOIN media_cache mc ON li.tmdb_id = mc.tmdb_id AND li.media_type = mc.media_type
      WHERE li.list_id = $1
      ORDER BY li.order_index ASC
    `;
    const itemsRes = await db.query(itemsQuery, [listId, currentUserId]);
    const listItems = itemsRes.rows;

    let watchedCount = 0;
    if (req.user && listItems.length > 0) {
      const watchedQuery = `
          SELECT COUNT(DISTINCT li.tmdb_id) as count
          FROM list_items li
          JOIN reviews r ON li.tmdb_id = r.tmdb_id AND li.media_type = r.media_type
          WHERE li.list_id = $1 AND r.user_id = $2
      `;
      const watchedRes = await db.query(watchedQuery, [listId, req.user.id]);
      watchedCount = parseInt(watchedRes.rows[0].count) || 0;
    }

    // === الجديد: جلب التعليقات بتاعت القائمة ===
    const commentsQuery = `
      SELECT 
          c.id, c.content, c.created_at, c.parent_comment_id,
          u.username, p.avatar_url,
          (SELECT COUNT(*) FROM list_comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
          ${req.user ? `EXISTS (SELECT 1 FROM list_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
      FROM list_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE c.list_id = $1
      ORDER BY c.created_at ASC
    `;
    const commentsDataRes = await db.query(commentsQuery, [listId]);

    const allComments = commentsDataRes.rows.map((comment) => {
      comment.content = formatCommentText(comment.content);
      return comment;
    });

    const mainComments = [];
    const commentMap = {};

    allComments.forEach((comment) => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    allComments.forEach((comment) => {
      if (comment.parent_comment_id) {
        if (commentMap[comment.parent_comment_id]) {
          commentMap[comment.parent_comment_id].replies.push(comment);
        }
      } else {
        mainComments.push(comment);
      }
    });

    res.render("single-list.ejs", {
      list: list,
      listItems: listItems,
      isOwner: isOwner,
      watchedCount: watchedCount,
      mainComments: mainComments, // تمرير التعليقات
      commentsCount: allComments.length, // إجمالي عدد التعليقات
    });
  } catch (error) {
    console.error("Error loading single list:", error);
    res.status(500).send("Server Error");
  }
});
// ==========================================
// Route: Single Review Page (Dynamic with Likes & Comments)
// ==========================================
app.get("/review/:id", async (req, res) => {
  try {
    const reviewId = req.params.id;

    // 1. جلب بيانات الريفيو الأساسية
    const query = `
      SELECT 
        r.id AS review_id, r.rating, r.review_text, r.watch_date, r.has_spoilers, r.liked,
        r.season_number, r.episode_number,
        u.username,
        p.display_name, p.avatar_url,
        m.tmdb_id, m.media_type, m.title, m.poster_path, m.is_anime,
        EXTRACT(YEAR FROM r.watch_date) AS watch_year
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
      WHERE r.id = $1
    `;
    const result = await db.query(query, [reviewId]);

    if (result.rows.length === 0) {
      return res.status(404).send("Review not found");
    }
    const review = result.rows[0];

    // 2. جلب الـ Backdrop
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${review.media_type === "anime" ? "tv" : review.media_type}/${review.tmdb_id}?api_key=${TMDB_API_KEY}`;
      const tmdbRes = await axios.get(tmdbUrl);
      review.backdrop_path = tmdbRes.data.backdrop_path;
    } catch (err) {
      console.error("Failed to fetch backdrop from TMDB");
    }

    // 3. جلب عدد اللايكات للريفيو
    const likesRes = await db.query(
      "SELECT COUNT(*) FROM review_likes WHERE review_id = $1",
      [reviewId],
    );
    const likesCount = parseInt(likesRes.rows[0].count) || 0;

    // 4. جلب عدد التعليقات للريفيو
    const commentsRes = await db.query(
      "SELECT COUNT(*) FROM review_comments WHERE review_id = $1",
      [reviewId],
    );
    const commentsCount = parseInt(commentsRes.rows[0].count) || 0;

    // 5. هل المستخدم الحالي عامل لايك للريفيو ده؟
    let isLikedByCurrentUser = false;
    if (req.user) {
      const checkLike = await db.query(
        "SELECT 1 FROM review_likes WHERE review_id = $1 AND user_id = $2",
        [reviewId, req.user.id],
      );
      if (checkLike.rows.length > 0) {
        isLikedByCurrentUser = true;
      }
    }

    // 6. جلب التعليقات نفسها مع حساب اللايكات لكل تعليق
    const commentsQuery = `
      SELECT 
          c.id, c.content, c.created_at, c.parent_comment_id,
          u.username, p.avatar_url,
          (SELECT COUNT(*) FROM review_comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
          ${req.user ? `EXISTS (SELECT 1 FROM review_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
      FROM review_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE c.review_id = $1
      ORDER BY c.created_at ASC
    `;
    const commentsDataRes = await db.query(commentsQuery, [reviewId]);
    const allComments = commentsDataRes.rows.map((comment) => {
      // بنعدل الـ content باستخدام الدالة بتاعتنا قبل ما نبعته للـ EJS
      comment.content = formatCommentText(comment.content);
      return comment;
    });

    // 7. تنظيم التعليقات في شجرة (عشان الـ Partial EJS يرسمهم صح)
    const mainComments = [];
    const commentMap = {};

    // أول لفة: نحط كل التعليقات في الـ Map ونعمل Array فاضية للردود بتاعتها
    allComments.forEach((comment) => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    // تاني لفة: نوزع التعليقات (الأساسي يروح mainComments، والرد يروح جوه أبوه)
    allComments.forEach((comment) => {
      if (comment.parent_comment_id) {
        if (commentMap[comment.parent_comment_id]) {
          commentMap[comment.parent_comment_id].replies.push(comment);
        }
      } else {
        mainComments.push(comment);
      }
    });

    res.render("single-review.ejs", {
      review,
      likesCount,
      commentsCount,
      isLikedByCurrentUser,
      mainComments, // هنبعت دي للـ EJS (تحتوي على الأساسي وجواه الردود)
    });
  } catch (error) {
    console.error("Error loading single review:", error);
    res.status(500).send("Server Error");
  }
});
app.get("/watchlist", async (req, res) => {
  if (!req.user) {
    return res.redirect("/sign-in");
  }

  try {
    // استعلام بيجيب الداتا بتاعت الـ Watchlist والـ Liked Media مع بعض!
    const query = `
           SELECT 
    w.status, 
    m.tmdb_id,
    m.media_type,
    m.title, 
    m.poster_path,
    m.run_time,
    m.total_episodes,
    m.total_seasons,
    m.rating,
    m.is_anime,
    CASE WHEN l.id IS NOT NULL THEN true ELSE false END AS is_liked
FROM watchlist w
            JOIN media_cache m 
              ON w.tmdb_id = m.tmdb_id AND w.media_type = m.media_type
            LEFT JOIN liked_media l 
              ON w.user_id = l.user_id AND w.tmdb_id = l.tmdb_id AND w.media_type = l.media_type
            WHERE w.user_id = $1
            ORDER BY w.added_at DESC;
        `;

    const result = await db.query(query, [req.user.id]);
    const watchlistItems = result.rows;

    res.render("watchlist.ejs", { watchlistItems });
  } catch (error) {
    console.error("Error fetching watchlist page:", error);
    res.render("watchlist.ejs", { watchlistItems: [] });
  }
});
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    const filterType = req.query.type || "all";

    if (!query || query.trim() === "") {
      return res.json([]);
    }

    const response = await axios.get(
      "https://api.themoviedb.org/3/search/multi",
      {
        params: {
          api_key: TMDB_API_KEY,
          query: query.trim(),
          page: 1,
        },
      },
    );

    let items = (response.data.results || []).filter(
      (item) => item.media_type === "movie" || item.media_type === "tv",
    );

    if (filterType === "movie") {
      items = items.filter((item) => item.media_type === "movie");
    } else if (filterType === "tv") {
      items = items.filter(
        (item) => item.media_type === "tv" && item.original_language !== "ja",
      );
    } else if (filterType === "anime") {
      items = items.filter((item) => item.original_language === "ja");
    }

    const results = items.slice(0, 20).map((item) => {
      const isAnime = item.original_language === "ja";
      let badge = "Series";
      if (item.media_type === "movie") {
        badge = "Movie";
      } else if (isAnime) {
        badge = "Anime";
      }

      const rawYear = (item.release_date || item.first_air_date || "").split(
        "-",
      )[0];
      const year = rawYear ? parseInt(rawYear, 10) : 0;
      const score = item.vote_average
        ? parseFloat(item.vote_average.toFixed(1))
        : 0;

      return {
        id: item.id,
        title: item.title || item.name,
        mediaType: item.media_type,
        badge: badge,
        year: year || "N/A",
        numericYear: year,
        score: score > 0 ? score.toFixed(1) : "NR",
        numericScore: score,
        genres: item.genre_ids || [],
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='255' viewBox='0 0 170 255'%3E%3Crect fill='%2311201f' width='170' height='255'/%3E%3Ctext fill='%23718096' font-family='sans-serif' font-size='14' dy='130' dx='45'%3ENo Poster%3C/text%3E%3C/svg%3E",
      };
    });

    res.json(results);
  } catch (error) {
    res.status(500).json([]);
  }
});
// =========================================================================
// WATCHLIST API ROUTE (Toggle)
// =========================================================================

app.post("/api/watchlist/toggle", async (req, res) => {
  // 1. التحقق من تسجيل الدخول
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res
      .status(401)
      .json({ error: "You must be logged in to add to watchlist." });
  }

  const { tmdb_id, media_type } = req.body;
  const userId = req.user.id;

  if (!tmdb_id || !media_type) {
    return res.status(400).json({ error: "Missing required media data." });
  }

  try {
    // 2. التحقق من وجود الفيلم في قائمة المشاهدة
    const checkResult = await db.query(
      "SELECT id FROM watchlist WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3",
      [userId, tmdb_id, media_type],
    );

    if (checkResult.rows.length > 0) {
      // الفيلم موجود، نقوم بحذفه
      await db.query("DELETE FROM watchlist WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      return res
        .status(200)
        .json({ status: "removed", message: "Removed from watchlist." });
    } else {
      // الفيلم غير موجود، نقوم بإضافته

      // 3. جلب بيانات الفيلم من TMDB
      let title = "Unknown Title";
      let poster_path = null;
      let run_time = null;
      let total_episodes = null;
      let total_seasons = null;
      let rating = null;
      let is_anime = false;

      try {
        const endpointType = media_type === "anime" ? "tv" : media_type;
        const tmdbUrl = `https://api.themoviedb.org/3/${endpointType}/${tmdb_id}?api_key=${TMDB_API_KEY}`;

        const tmdbRes = await axios.get(tmdbUrl);
        const data = tmdbRes.data;

        title = data.title || data.name;
        poster_path = data.poster_path;
        rating = data.vote_average ? data.vote_average.toFixed(1) : null;

        if (
          data.original_language === "ja" &&
          data.genres &&
          data.genres.some((g) => g.id === 16)
        ) {
          is_anime = true;
        }

        if (media_type === "movie") {
          run_time = data.runtime;
        } else {
          total_episodes = data.number_of_episodes;
          total_seasons = data.number_of_seasons;
          // 🌟 السر هنا: التقاط وقت الحلقة للمسلسلات والأنمي من TMDB 🌟
          if (data.episode_run_time && data.episode_run_time.length > 0) {
            run_time = data.episode_run_time[0];
          } else if (
            data.last_episode_to_air &&
            data.last_episode_to_air.runtime
          ) {
            run_time = data.last_episode_to_air.runtime;
          }
        }
      } catch (apiErr) {
        console.error(`TMDB Fetch Error:`, apiErr.message);
        return res.status(502).json({ error: "Failed to fetch details." });
      }

      // 4. إدخال أو تحديث بيانات الفيلم في media_cache
      await db.query(
        `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, run_time, total_episodes, total_seasons, rating, is_anime)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (tmdb_id, media_type) 
     DO UPDATE SET rating = EXCLUDED.rating, is_anime = EXCLUDED.is_anime WHERE media_cache.rating IS NULL`,
        [
          tmdb_id,
          media_type,
          title,
          poster_path,
          run_time,
          total_episodes,
          total_seasons,
          rating,
          is_anime,
        ],
      );

      // 5. إضافة الفيلم إلى قائمة مشاهدة المستخدم
      await db.query(
        `INSERT INTO watchlist (user_id, tmdb_id, media_type, status)
                 VALUES ($1, $2, $3, 'plan_to_watch')`,
        [userId, tmdb_id, media_type],
      );

      return res
        .status(200)
        .json({ status: "added", message: "Added to watchlist." });
    }
  } catch (error) {
    console.error("Watchlist Toggle Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
// =========================================================================
// LIKE MEDIA API ROUTE (Toggle)
// =========================================================================

app.post("/api/like/toggle", async (req, res) => {
  // التأكد إن اليوزر مسجل دخول
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res
      .status(401)
      .json({ error: "You must be logged in to like media." });
  }

  const { tmdb_id, media_type } = req.body;
  const userId = req.user.id;

  if (!tmdb_id || !media_type) {
    return res.status(400).json({ error: "Missing required media data." });
  }

  try {
    // 1. هل العمل موجود بالفعل في قائمة إعجابات المستخدم؟
    const checkResult = await db.query(
      "SELECT id FROM liked_media WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3",
      [userId, tmdb_id, media_type],
    );

    if (checkResult.rows.length > 0) {
      // موجود -> يبقى نمسحه (Unlike)
      await db.query("DELETE FROM liked_media WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      return res
        .status(200)
        .json({ status: "removed", message: "Like removed." });
    } else {
      // مش موجود -> يبقى نضيفه (Like)
      // 3. جلب بيانات الفيلم من TMDB
      let title = "Unknown Title";
      let poster_path = null;
      let run_time = null;
      let total_episodes = null;
      let total_seasons = null;
      let rating = null;
      let is_anime = false;

      try {
        const endpointType = media_type === "anime" ? "tv" : media_type;
        const tmdbUrl = `https://api.themoviedb.org/3/${endpointType}/${tmdb_id}?api_key=${TMDB_API_KEY}`;

        const tmdbRes = await axios.get(tmdbUrl);
        const data = tmdbRes.data;

        title = data.title || data.name;
        poster_path = data.poster_path;
        rating = data.vote_average ? data.vote_average.toFixed(1) : null;

        if (
          data.original_language === "ja" &&
          data.genres &&
          data.genres.some((g) => g.id === 16)
        ) {
          is_anime = true;
        }

        if (media_type === "movie") {
          run_time = data.runtime;
        } else {
          total_episodes = data.number_of_episodes;
          total_seasons = data.number_of_seasons;
          // 🌟 السر هنا: التقاط وقت الحلقة للمسلسلات والأنمي من TMDB 🌟
          if (data.episode_run_time && data.episode_run_time.length > 0) {
            run_time = data.episode_run_time[0];
          } else if (
            data.last_episode_to_air &&
            data.last_episode_to_air.runtime
          ) {
            run_time = data.last_episode_to_air.runtime;
          }
        }
      } catch (apiErr) {
        console.error(`TMDB Fetch Error:`, apiErr.message);
        return res.status(502).json({ error: "Failed to fetch details." });
      }

      // 4. إدخال أو تحديث بيانات الفيلم في media_cache
      await db.query(
        `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, run_time, total_episodes, total_seasons, rating, is_anime)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (tmdb_id, media_type) 
     DO UPDATE SET rating = EXCLUDED.rating, is_anime = EXCLUDED.is_anime WHERE media_cache.rating IS NULL`,
        [
          tmdb_id,
          media_type,
          title,
          poster_path,
          run_time,
          total_episodes,
          total_seasons,
          rating,
          is_anime,
        ],
      );

      // الإضافة لجدول liked_media
      await db.query(
        `INSERT INTO liked_media (user_id, tmdb_id, media_type)
                 VALUES ($1, $2, $3)`,
        [userId, tmdb_id, media_type],
      );

      return res.status(200).json({ status: "added", message: "Media liked." });
    }
  } catch (error) {
    console.error("Like Toggle Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
// =========================================================================
// LOG & REVIEWS API ROUTE
// =========================================================================

app.post("/api/reviews/log", async (req, res) => {
  // 1. التأكد إن اليوزر مسجل دخول
  if (!req.isAuthenticated()) {
    return res
      .status(401)
      .json({ error: "You must be logged in to log media." });
  }

  // 2. سحب البيانات اللي جاية من الـ Log Modal
  const {
    tmdb_id,
    media_type,
    rating,
    review_text,
    is_rewatch,
    has_spoilers,
    liked,
    season_number,
    episode_number,
    watch_date,
  } = req.body;

  const userId = req.user.id;

  // 3. التحقق من البيانات الأساسية
  if (!tmdb_id || !media_type) {
    return res
      .status(400)
      .json({ error: "Missing required media data (tmdb_id or media_type)." });
  }

  try {
    // 4. خطوة احترازية: حفظ بيانات العمل في الـ media_cache لو مش موجودة
    // (عشان لو اليوزر بيعمل Log لعمل مش موجود أصلاً في الكاش عندنا)
    let title = "Unknown Title";
    let poster_path = null;
    let run_time = null;
    let total_episodes = null;
    let total_seasons = null;

    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${media_type === "anime" ? "tv" : media_type}/${tmdb_id}?api_key=${TMDB_API_KEY}`;
      const tmdbRes = await axios.get(tmdbUrl);
      const data = tmdbRes.data;

      title = data.title || data.name;
      poster_path = data.poster_path;

      if (media_type === "movie") {
        run_time = data.runtime;
      } else {
        total_episodes = data.number_of_episodes;
        total_seasons = data.number_of_seasons;
        // 🌟 السر هنا: التقاط وقت الحلقة للمسلسلات والأنمي من TMDB 🌟
        if (data.episode_run_time && data.episode_run_time.length > 0) {
          run_time = data.episode_run_time[0];
        } else if (
          data.last_episode_to_air &&
          data.last_episode_to_air.runtime
        ) {
          run_time = data.last_episode_to_air.runtime;
        }
      }
    } catch (apiErr) {
      console.error(`Failed to fetch TMDB data in Log Modal:`, apiErr.message);
      // مش هنوقف العملية لو TMDB وقع، هنكمل بالمعلومات القليلة اللي عندنا
    }

    // إدخال أو تحديث الكاش
    // إدخال أو تحديث الكاش (وتحديث وقت العمل لو كان ناقص)
    await db.query(
      `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, run_time, total_episodes, total_seasons)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (tmdb_id, media_type) 
             DO UPDATE SET run_time = EXCLUDED.run_time WHERE media_cache.run_time IS NULL`,
      [
        tmdb_id,
        media_type,
        title,
        poster_path,
        run_time,
        total_episodes,
        total_seasons,
      ],
    );

    // 5. حفظ الـ Log / Review في الجدول الجديد
    const insertQuery = `
            INSERT INTO reviews (
                user_id, tmdb_id, media_type, rating, review_text, 
                is_rewatch, has_spoilers, liked, season_number, episode_number, watch_date
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id;
        `;

    const values = [
      userId,
      tmdb_id,
      media_type,
      rating || null,
      review_text || null,
      is_rewatch || false,
      has_spoilers || false,
      liked || false,
      season_number || null,
      episode_number || null,
      watch_date || new Date().toISOString().split("T")[0], // لو مبعتش تاريخ نستخدم تاريخ اليوم
    ];

    const result = await db.query(insertQuery, values);

    // 6. لو اليوزر داس لايك، نضيف العمل كمان لجدول الـ Favorites (اختياري بس بيحسن الـ UX)
    if (liked) {
      await db.query(
        `INSERT INTO liked_media (user_id, tmdb_id, media_type)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (user_id, tmdb_id, media_type) DO NOTHING`,
        [userId, tmdb_id, media_type],
      );
    }

    return res.status(200).json({
      message: "Log saved successfully!",
      review_id: result.rows[0].id,
    });
  } catch (error) {
    console.error("Error saving log:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
app.post("/api/follow/toggle", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const followerId = req.user.id;
  const { followingId } = req.body;

  if (!followingId || followerId === parseInt(followingId)) {
    return res.status(400).json({ error: "Invalid operation" });
  }

  try {
    const checkResult = await db.query(
      "SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2",
      [followerId, followingId],
    );

    if (checkResult.rows.length > 0) {
      await db.query(
        "DELETE FROM followers WHERE follower_id = $1 AND following_id = $2",
        [followerId, followingId],
      );
      return res.status(200).json({ status: "unfollowed" });
    } else {
      await db.query(
        "INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)",
        [followerId, followingId],
      );
      return res.status(200).json({ status: "followed" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
// =========================================================================
// CREATE LIST API ROUTE
// =========================================================================
app.post("/api/lists/create", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res
      .status(401)
      .json({ error: "You must be logged in to create a list." });
  }

  const { title, is_private, items } = req.body;
  const userId = req.user.id;

  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "List title is required." });
  }

  // هنستخدم Transaction عشان نضمن إن الداتا كلها تتحفظ مع بعض، أو تترفض مع بعض
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. حفظ القائمة الأساسية واسترجاع الـ ID بتاعها
    const listResult = await client.query(
      `INSERT INTO lists (user_id, title, is_private) VALUES ($1, $2, $3) RETURNING id`,
      [userId, title.trim(), is_private],
    );
    const newListId = listResult.rows[0].id;

    // 2. لوب على الأفلام وإضافتها للقائمة
    if (items && items.length > 0) {
      for (const item of items) {
        // خطوة أمان: نتأكد إن العمل ده متكيّش في media_cache عشان البوستر يظهر بره
        await client.query(
          `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, rating)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tmdb_id, media_type) DO UPDATE SET rating = EXCLUDED.rating WHERE media_cache.rating IS NULL`,
          [
            item.tmdb_id,
            item.media_type,
            item.title,
            item.poster_path,
            item.rating,
          ],
        );

        // حفظ العمل جوه القائمة مع ترتيبه
        await client.query(
          `INSERT INTO list_items (list_id, tmdb_id, media_type, order_index)
           VALUES ($1, $2, $3, $4)`,
          [newListId, item.tmdb_id, item.media_type, item.order_index],
        );
      }
    }

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "List created successfully", list_id: newListId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create List Error:", error);
    res.status(500).json({ error: "Internal server error." });
  } finally {
    client.release();
  }
});
// =========================================================================
// DELETE LIST API ROUTE
// =========================================================================
app.delete("/api/lists/:id", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const listId = req.params.id;
    const userId = req.user.id;

    // نجيب الـ username بتاع اليوزر اللي بيمسح عشان نرجعه لصفحته
    const userRes = await db.query("SELECT username FROM users WHERE id = $1", [
      userId,
    ]);
    const username = userRes.rows[0].username;

    // نمسح الأفلام الأول
    await db.query("DELETE FROM list_items WHERE list_id = $1", [listId]);

    // نمسح القائمة
    const delRes = await db.query(
      "DELETE FROM lists WHERE id = $1 AND user_id = $2",
      [listId, userId],
    );

    if (delRes.rowCount > 0) {
      // نبعت الـ username في الـ Response
      res
        .status(200)
        .json({ message: "List deleted successfully", username: username });
    } else {
      res
        .status(403)
        .json({ error: "You don't have permission to delete this list." });
    }
  } catch (error) {
    console.error("Delete List Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// =========================================================================
// UPDATE LIST API ROUTE
// =========================================================================
app.put("/api/lists/:id", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const listId = req.params.id;
  const { title, is_private, items } = req.body;
  const userId = req.user.id;

  try {
    // هنستخدم Transaction عشان لو حصل أي خطأ في النص، يرجع كل حاجة زي ما كانت
    await db.query("BEGIN");

    // 1. تحديث اسم القائمة وحالتها (ونتأكد إن اليوزر هو صاحبها)
    const updateListRes = await db.query(
      "UPDATE lists SET title = $1, is_private = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING id",
      [title, is_private, listId, userId],
    );

    if (updateListRes.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized or list not found" });
    }

    // 2. نمسح الأفلام القديمة من القائمة دي
    await db.query("DELETE FROM list_items WHERE list_id = $1", [listId]);

    // 3. نضيف الأفلام بالترتيب الجديد
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // نحدث الـ Cache بالمرة عشان لو التقييم اتغير
      await db.query(
        `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, rating)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tmdb_id, media_type) DO UPDATE SET rating = EXCLUDED.rating WHERE media_cache.rating IS NULL`,
        [
          item.tmdb_id,
          item.media_type,
          item.title,
          item.poster_path,
          item.rating,
        ],
      );

      // نضيف الفيلم للقائمة
      await db.query(
        "INSERT INTO list_items (list_id, tmdb_id, media_type, order_index) VALUES ($1, $2, $3, $4)",
        [listId, item.tmdb_id, item.media_type, item.order_index],
      );
    }

    await db.query("COMMIT");
    res.status(200).json({ message: "List updated successfully" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Update List Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// =========================================================================
// REVIEW LIKES & COMMENTS API ROUTES
// =========================================================================

// 1. Toggle Review Like
app.post("/api/reviews/:id/like", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const reviewId = req.params.id;
  const userId = req.user.id;

  try {
    const checkResult = await db.query(
      "SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2",
      [reviewId, userId],
    );

    if (checkResult.rows.length > 0) {
      // شيل اللايك
      await db.query("DELETE FROM review_likes WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      // ضيف اللايك
      await db.query(
        "INSERT INTO review_likes (review_id, user_id) VALUES ($1, $2)",
        [reviewId, userId],
      );
      res.json({ status: "added" });
    }
  } catch (error) {
    console.error("Review Like Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Add Review Comment
app.post("/api/reviews/:id/comment", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const reviewId = req.params.id;
  const userId = req.user.id;
  const { content, parent_comment_id } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }

  try {
    const result = await db.query(
      `
            INSERT INTO review_comments (review_id, user_id, content, parent_comment_id) 
            VALUES ($1, $2, $3, $4) RETURNING id, created_at
        `,
      [reviewId, userId, content.trim(), parent_comment_id || null],
    );

    // بنرجع بيانات اليوزر مع التعليق عشان الفرونت يطبعها فوراً
    res.status(200).json({
      message: "Comment added",
      comment_id: result.rows[0].id,
      created_at: result.rows[0].created_at,
      username: req.user.username,
      avatar_url: req.user.avatar_url,
    });
  } catch (error) {
    console.error("Review Comment Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// 3. Toggle Comment Like (Review Comments)
app.post("/api/comments/:id/like", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const commentId = req.params.id;
  const userId = req.user.id;

  try {
    const checkResult = await db.query(
      "SELECT id FROM review_comment_likes WHERE comment_id = $1 AND user_id = $2",
      [commentId, userId],
    );

    if (checkResult.rows.length > 0) {
      // شيل اللايك
      await db.query("DELETE FROM review_comment_likes WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      // ضيف اللايك
      await db.query(
        "INSERT INTO review_comment_likes (comment_id, user_id) VALUES ($1, $2)",
        [commentId, userId],
      );
      res.json({ status: "added" });
    }
  } catch (error) {
    console.error("Comment Like Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// =========================================================================
// LIST LIKES & COMMENTS API ROUTES
// =========================================================================

// 1. Toggle List Like (للإعجاب بالقائمة نفسها)
app.post("/api/lists/:id/like", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const listId = req.params.id;
  const userId = req.user.id;

  try {
    const checkResult = await db.query(
      "SELECT id FROM list_likes WHERE list_id = $1 AND user_id = $2",
      [listId, userId],
    );

    if (checkResult.rows.length > 0) {
      await db.query("DELETE FROM list_likes WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      await db.query(
        "INSERT INTO list_likes (list_id, user_id) VALUES ($1, $2)",
        [listId, userId],
      );
      res.json({ status: "added" });
    }
  } catch (error) {
    console.error("List Like Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Add List Comment (لإضافة تعليق أو رد على القائمة)
app.post("/api/lists/:id/comment", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const listId = req.params.id;
  const userId = req.user.id;
  const { content, parent_comment_id } = req.body;

  if (!content || !content.trim())
    return res.status(400).json({ error: "Comment cannot be empty" });

  try {
    const result = await db.query(
      `INSERT INTO list_comments (list_id, user_id, content, parent_comment_id) 
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [listId, userId, content.trim(), parent_comment_id || null],
    );

    // بنرجع بيانات اليوزر مع التعليق عشان الجافاسكريبت يعرضها فوراً
    res.status(200).json({
      message: "Comment added",
      comment_id: result.rows[0].id,
      created_at: result.rows[0].created_at,
      username: req.user.username,
      avatar_url: req.user.avatar_url,
    });
  } catch (error) {
    console.error("List Comment Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Toggle List Comment Like (للإعجاب بتعليق جوه القائمة)
app.post("/api/list-comments/:id/like", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  const commentId = req.params.id;
  const userId = req.user.id;

  try {
    const checkResult = await db.query(
      "SELECT id FROM list_comment_likes WHERE comment_id = $1 AND user_id = $2",
      [commentId, userId],
    );

    if (checkResult.rows.length > 0) {
      await db.query("DELETE FROM list_comment_likes WHERE id = $1", [
        checkResult.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      await db.query(
        "INSERT INTO list_comment_likes (comment_id, user_id) VALUES ($1, $2)",
        [commentId, userId],
      );
      res.json({ status: "added" });
    }
  } catch (error) {
    console.error("List Comment Like Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
passport.use(
  new LocalStrategy(
    // السطر ده هو اللي هيحل مشكلة missing credentials
    { usernameField: "email", passwordField: "password" },
    async (email, password, cb) => {
      try {
        // البحث عن المستخدم بواسطة الإيميل أو اليوزر نيم
        const result = await db.query(
          "SELECT * FROM users WHERE email = $1 OR username = $1",
          [email], // المتغير email هنا شايل الكلمة اللي اليوزر كتبها في الخانة (سواء كانت إيميل أو يوزر نيم)
        );
        if (result.rows.length === 0) {
          return cb(null, false, { message: "User not found" });
        }
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
          return cb(null, user);
        } else {
          return cb(null, false, { message: "Incorrect password" });
        }
      } catch (err) {
        return cb(err);
      }
    },
  ),
);

// 3. تخزين الـ ID فقط في الـ Session لتوفير مساحة الذاكرة
passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    // 🌟 التعديل هنا: عملنا JOIN عشان نسحب مسار الصورة والاسم الظاهر مع بيانات اليوزر الأساسية 🌟
    const result = await db.query(
      `SELECT u.*, p.avatar_url, p.display_name 
       FROM users u 
       LEFT JOIN user_profiles p ON u.id = p.user_id 
       WHERE u.id = $1`,
      [id],
    );

    if (result.rows.length > 0) {
      // دلوقتي الكائن ده بقى جواه u.username وكمان p.avatar_url
      cb(null, result.rows[0]);
    } else {
      cb(null, false);
    }
  } catch (err) {
    cb(err);
  }
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
