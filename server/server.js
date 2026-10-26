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
// استدعاء مكتبة رفع الملفات
import multer from "multer";
import connectPgSimple from "connect-pg-simple";
const pgSession = connectPgSimple(session);

// إعداد مكان واسم حفظ الصور
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // تحديد الفولدر بناءً على اسم الحقل (avatar ولا backdrop)
    if (file.fieldname === "avatar") {
      cb(null, path.join(__dirname, "../client/assets/avatars"));
    } else if (file.fieldname === "backdrop") {
      cb(null, path.join(__dirname, "../client/assets/backdrops"));
    }
  },
  filename: function (req, file, cb) {
    // إضافة وقت الرفع لاسم الصورة عشان متتكررش
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // الاحتفاظ بامتداد الصورة الأصلي (مثلاً .jpg)
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage: storage });
const app = express();
const port = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// السطر ده ضروري جداً عشان الجلسات تشتغل على السيرفرات السحابية زي Render
app.set("trust proxy", 1);
app.use(express.static(path.join(__dirname, "../client")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    store: new pgSession({
      pool: db,
      tableName: "user_sessions",
      createTableIfMissing: false, // خليناها false لأننا خلاص عملنا الجدول بإيدينا
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
      // تفعيل الأمان لو الموقع شغال على Render (HTTPS)
      secure: process.env.NODE_ENV === "production" ? true : false,
    },
  }),
);

// تهيئة Passport ليعمل مع Express
app.use(passport.initialize());
// ربط Passport بالـ Session لإدارة الجلسات
app.use(passport.session());
// Middleware لتمرير بيانات المستخدم لكل ملفات EJS
app.use(async (req, res, next) => {
  res.locals.user = req.user;

  if (req.user) {
    res.locals.watchlistMap = await getUserWatchlistIds(req.user.id);
    // السطر الجديد اللي ضفناه عشان اللايكات:
    res.locals.likedMediaMap = await getUserLikedMediaIds(req.user.id);
  } else {
    res.locals.watchlistMap = [];
    res.locals.likedMediaMap = [];
  }

  next();
});
// مفتاح TMDB الخاص بك
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// ==============================================================
// 🌟 قاموس التصنيفات العام ودالة تنسيق الكروت الذكية
// ==============================================================
const genreMap = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
};

// فاحص الكلمات الرياضية الذكي: يفحص قصة وعنوان العمل ديناميكياً لأي عمل حالي أو مستقبلي
const sportsRegex =
  /\b(sport|sports|football|soccer|volleyball|basketball|boxing|boxer|baseball|tennis|skating|swimming|swimmer|table tennis|ping pong|badminton|rugby|judo|karate|wrestling|athlete|athletics|striker)\b/i;

const formatCard = (item, defaultType = "MOVIE", forcedGenre = null) => {
  let mediaType = item.media_type || (defaultType === "MOVIE" ? "movie" : "tv");
  let displayType = defaultType;

  if (item.media_type) {
    if (item.media_type === "movie") {
      displayType = "MOVIE";
    } else if (item.original_language === "ja") {
      displayType = "ANIME";
    } else {
      displayType = "SERIES";
    }
  }

  // 1. استخراج أسماء التصنيفات الأساسية
  let genres = (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean);

  // 2. معالجة الأنمي وحذف Animation لتجنب الحشو
  if (displayType === "ANIME") {
    genres = genres.filter((g) => g !== "Animation");
  }

  // 3. الفحص الذكي للرياضة: هل تذكر القصة أو العنوان أي رياضة؟
  const textContent = `${item.title || item.name || ""} ${item.overview || ""}`;
  const isSportsContent =
    forcedGenre === "Sports" || sportsRegex.test(textContent);

  if (isSportsContent) {
    // إضافة Sports في البداية مع حذف أي تكرار
    genres = ["Sports", ...genres.filter((g) => g !== "Sports")];
  } else if (forcedGenre) {
    genres = [forcedGenre, ...genres.filter((g) => g !== forcedGenre)];
  }

  // 4. أخذ تصنيفين كحد أقصى (أو تصنيف واحد لو الاسمان طويلان)
  let selectedGenres = genres.slice(0, 2);
  if (selectedGenres.join(", ").length > 16) {
    selectedGenres = selectedGenres.slice(0, 1);
  }

  const genreText =
    selectedGenres.join(", ") || (displayType === "MOVIE" ? "Cinema" : "Drama");
  const year = (item.release_date || item.first_air_date || "2026").split(
    "-",
  )[0];

  return {
    id: item.id,
    title: item.title || item.name,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "assets/posters/poster-odyssey.webp",
    score: item.vote_average ? item.vote_average.toFixed(1) : "N/A",
    type: displayType,
    mediaType: mediaType,
    ageBadge: item.adult ? "R" : displayType === "MOVIE" ? "PG-13" : "TV-14",
    meta: year,
    subtitle: `${genreText} • ${year}`,
  };
};
// دالة مساعدة لجلب معرفات الـ Watchlist للمستخدم الحالي
async function getUserWatchlistIds(userId) {
  if (!userId) return [];
  try {
    const result = await db.query(
      "SELECT tmdb_id FROM watchlist WHERE user_id = $1",
      [userId],
    );
    // التعديل هنا: إضافة .toString() لضمان توحيد النوع
    return result.rows.map((row) => row.tmdb_id.toString());
  } catch (err) {
    console.error("Error fetching watchlist IDs:", err);
    return [];
  }
}
// دالة مساعدة لجلب معرفات الإعجاب (Likes) للمستخدم الحالي
async function getUserLikedMediaIds(userId) {
  if (!userId) return [];
  try {
    const result = await db.query(
      "SELECT tmdb_id FROM liked_media WHERE user_id = $1",
      [userId],
    );
    return result.rows.map((row) => row.tmdb_id.toString());
  } catch (err) {
    console.error("Error fetching liked media IDs:", err);
    return [];
  }
}
// ==========================================
// 1. Route: Home Page (Index)
// ==========================================
app.get("/", async (req, res) => {
  try {
    const commonParams = {
      api_key: TMDB_API_KEY,
      page: 1,
    };

    const [
      trendingHeroRes,
      trendingAllRes,
      mustWatchRes,
      topTvRes,
      topAnimeRes,
    ] = await Promise.all([
      axios.get("https://api.themoviedb.org/3/trending/movie/week", {
        params: commonParams,
      }),
      axios.get("https://api.themoviedb.org/3/trending/all/week", {
        params: commonParams,
      }),
      axios.get("https://api.themoviedb.org/3/discover/movie", {
        params: {
          ...commonParams,
          sort_by: "popularity.desc",
          "vote_count.gte": 1000,
          "vote_average.gte": 7.5,
        },
      }),
      axios.get("https://api.themoviedb.org/3/discover/tv", {
        params: {
          ...commonParams,
          without_genres: "16",
          sort_by: "popularity.desc",
          "vote_count.gte": 600,
          "vote_average.gte": 7.5,
        },
      }),
      axios.get("https://api.themoviedb.org/3/discover/tv", {
        params: {
          ...commonParams,
          with_original_language: "ja",
          with_genres: "16",
          sort_by: "popularity.desc",
          "vote_count.gte": 300,
        },
      }),
    ]);

    const heroRaw = trendingHeroRes.data.results[0];
    let heroMovie = null;

    if (heroRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${heroRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        },
      );
      const d = heroDetailRes.data;

      const hours = Math.floor((d.runtime || 120) / 60);
      const minutes = (d.runtime || 120) % 60;
      const formattedDuration = `${hours}h ${minutes < 10 ? "0" : ""}${minutes}m`;

      heroMovie = {
        id: d.id,
        mediaType: "movie",
        title: d.title,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-odyssey1.webp",
        duration: formattedDuration,
        year: d.release_date ? d.release_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Adventure, Drama",
      };
    }

    const filteredTrending = trendingAllRes.data.results.filter(
      (item) => item.vote_count >= 150 && item.vote_average >= 6.0,
    );

    res.render("index.ejs", {
      heroMovie,
      trendingNow: filteredTrending
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      mustWatchMovies: mustWatchRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      topTVShows: topTvRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      topAnime: topAnimeRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "ANIME")),
    });
  } catch (error) {
    console.error("[TMDB Index Error]:", error.response?.data || error.message);
    res.render("index.ejs", {
      heroMovie: null,
      trendingNow: [],
      mustWatchMovies: [],
      topTVShows: [],
      topAnime: [],
    });
  }
});

// ==========================================
// 2. Route: Anime Page
// ==========================================
app.get("/anime", async (req, res) => {
  try {
    const TMDB_URL = "https://api.themoviedb.org/3/discover/tv";

    const commonParams = {
      api_key: TMDB_API_KEY,
      with_original_language: "ja",
      include_adult: false,
      page: 1,
    };

    const [topRatedRes, sportsRes, mysteryRes, trendingRes] = await Promise.all(
      [
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            sort_by: "vote_average.desc",
            "vote_count.gte": 500,
          },
        }),
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            with_keywords: "6075",
            sort_by: "popularity.desc",
            "vote_count.gte": 50,
          },
        }),
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16,9648",
            sort_by: "popularity.desc",
            "vote_count.gte": 50,
          },
        }),
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            sort_by: "popularity.desc",
            "vote_count.gte": 150,
          },
        }),
      ],
    );

    const candidates = trendingRes.data.results || [];
    const featuredRaw =
      candidates.find(
        (item) =>
          item.backdrop_path &&
          item.vote_count >= 200 &&
          item.vote_average >= 7.0,
      ) ||
      candidates.find((item) => item.backdrop_path && item.vote_count >= 100) ||
      candidates[0];

    let heroAnime = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        },
      );
      const d = heroDetailRes.data;

      heroAnime = {
        id: d.id,
        mediaType: "anime",
        title: d.name,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-onepiece.webp",
        episodes: d.number_of_episodes
          ? `${d.number_of_episodes} Episodes`
          : "TV Series",
        year: d.first_air_date ? d.first_air_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Fantasy",
      };
    }

    res.render("anime.ejs", {
      heroAnime,
      topRatedAnime: topRatedRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME")),
      actionAnime: sportsRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME", "Sports")),
      mysteryAnime: mysteryRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME")),
    });
  } catch (error) {
    console.error("[TMDB Anime Error]:", error.response?.data || error.message);
    res.render("anime.ejs", {
      heroAnime: null,
      topRatedAnime: [],
      actionAnime: [],
      mysteryAnime: [],
    });
  }
});
// ==========================================
// 3. Route: Movies Page
// ==========================================
app.get("/movies", async (req, res) => {
  try {
    const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/discover/movie";

    const commonParams = {
      api_key: TMDB_API_KEY,
      include_adult: false,
      page: 1,
    };

    const [trendingRes, latestRes, actionSciFiRes, thrillerRes, horrorRes] =
      await Promise.all([
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 150,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            primary_release_year: 2026,
            sort_by: "popularity.desc",
            "vote_count.gte": 10,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "28,878",
            sort_by: "popularity.desc",
            "vote_count.gte": 100,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "80,9648",
            sort_by: "popularity.desc",
            "vote_count.gte": 100,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "27",
            sort_by: "popularity.desc",
            "vote_count.gte": 80,
          },
        }),
      ]);

    const candidates = trendingRes.data.results || [];
    const featuredRaw =
      candidates.find(
        (m) => m.backdrop_path && m.vote_count >= 300 && m.vote_average >= 6.8,
      ) ||
      candidates.find((m) => m.backdrop_path && m.vote_count >= 150) ||
      candidates[0];

    let heroMovie = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        },
      );
      const d = heroDetailRes.data;

      const hours = Math.floor((d.runtime || 120) / 60);
      const minutes = (d.runtime || 120) % 60;
      const formattedDuration = `${hours}h ${minutes < 10 ? "0" : ""}${minutes}m`;

      heroMovie = {
        id: d.id,
        title: d.title,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-thedeathofrobinhood.webp",
        duration: formattedDuration,
        year: d.release_date ? d.release_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Adventure, Drama",
      };
    }

    res.render("movies.ejs", {
      heroMovie,
      latestMovies: latestRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      actionSciFiMovies: actionSciFiRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      thrillerMovies: thrillerRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      horrorMovies: horrorRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
    });
  } catch (error) {
    console.error(
      "[TMDB Movies Error]:",
      error.response?.data || error.message,
    );
    res.render("movies.ejs", {
      heroMovie: null,
      latestMovies: [],
      actionSciFiMovies: [],
      thrillerMovies: [],
      horrorMovies: [],
    });
  }
});

// ==========================================
// 4. Route: TV Series Page
// ==========================================
app.get("/series", async (req, res) => {
  try {
    const TMDB_TV_URL = "https://api.themoviedb.org/3/discover/tv";

    const commonParams = {
      api_key: TMDB_API_KEY,
      without_genres: "16",
      include_adult: false,
      page: 1,
    };

    const [trendingRes, topRatedRes, actionSciFiRes, crimeRes, mysteryRes] =
      await Promise.all([
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "vote_average.desc",
            "vote_count.gte": 1000,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_genres: "10759|10765",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_genres: "80",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_keywords: "9799|6152",
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
            "vote_average.gte": 7.0,
          },
        }),
      ]);

    const candidates = trendingRes.data.results || [];
    const featuredRaw =
      candidates.find(
        (t) => t.backdrop_path && t.vote_count >= 300 && t.vote_average >= 7.0,
      ) ||
      candidates.find((t) => t.backdrop_path && t.vote_count >= 150) ||
      candidates[0];

    let heroSeries = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        },
      );
      const d = heroDetailRes.data;

      const startYear = d.first_air_date
        ? d.first_air_date.split("-")[0]
        : "2026";
      const endYear =
        d.status === "Ended" && d.last_air_date
          ? d.last_air_date.split("-")[0]
          : "Present";
      const yearRange =
        startYear === endYear ? startYear : `${startYear} – ${endYear}`;

      heroSeries = {
        id: d.id,
        mediaType: "tv",
        title: d.name,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "/assets/backdrops/backdrop-sherlock.webp",
        duration: `${d.number_of_seasons || 1} Seasons • ${d.number_of_episodes || 10} Episodes`,
        year: yearRange,
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Crime, Drama, Mystery",
      };
    }

    res.render("series.ejs", {
      heroSeries,
      topRatedSeries: topRatedRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      actionSciFiSeries: actionSciFiRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      crimeSeries: crimeRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      mysterySeries: mysteryRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
    });
  } catch (error) {
    console.error(
      "[TMDB Series Error]:",
      error.response?.data || error.message,
    );
    res.render("series.ejs", {
      heroSeries: null,
      topRatedSeries: [],
      actionSciFiSeries: [],
      crimeSeries: [],
      mysterySeries: [],
    });
  }
});

// ==========================================
// 5. Route: Unified Dynamic Details Page
// ==========================================
app.get("/details", async (req, res) => {
  try {
    const mediaId = req.query.id || "1396";
    const mediaType = req.query.type || "tv";

    const endpoint =
      mediaType === "movie"
        ? `https://api.themoviedb.org/3/movie/${mediaId}`
        : `https://api.themoviedb.org/3/tv/${mediaId}`;

    const response = await axios.get(endpoint, {
      params: {
        api_key: TMDB_API_KEY,
        append_to_response: "credits,recommendations,keywords",
      },
    });

    const d = response.data;

    let season1Episodes = [];
    if (mediaType === "tv") {
      try {
        const seasonRes = await axios.get(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/1`,
          {
            params: { api_key: TMDB_API_KEY },
          },
        );
        season1Episodes = seasonRes.data.episodes || [];
      } catch (err) {
        season1Episodes = [];
      }
    }

    let durationText = "N/A";
    if (mediaType === "movie") {
      const runtime = d.runtime || 120;
      durationText = `${Math.floor(runtime / 60)}h ${runtime % 60}m`;
    } else {
      durationText = `${d.number_of_seasons || 1} Seasons`;
    }

    let badgeText = "TV Series";
    if (mediaType === "movie") {
      badgeText = "Movie";
    } else if (d.original_language === "ja") {
      badgeText = "Anime";
    }

    // صانع العمل
    let creatorLabel = mediaType === "movie" ? "Director" : "Creators";
    let creatorName = "N/A";

    if (mediaType === "movie") {
      const director = d.credits?.crew?.find((c) => c.job === "Director");
      creatorName = director ? director.name : "N/A";
    } else {
      if (d.created_by && d.created_by.length > 0) {
        creatorName = d.created_by.map((c) => c.name).join(", ");
      } else {
        const animeCreator = d.credits?.crew?.find(
          (c) =>
            c.job === "Original Creator" ||
            c.job === "Original Story" ||
            c.job === "Series Director" ||
            c.job === "Director",
        );
        if (animeCreator) {
          creatorLabel =
            animeCreator.job === "Original Creator" ||
            animeCreator.job === "Original Story"
              ? "Original Manga"
              : "Director";
          creatorName = animeCreator.name;
        } else if (
          d.production_companies &&
          d.production_companies.length > 0
        ) {
          creatorLabel = "Studio";
          creatorName = d.production_companies[0].name;
        }
      }
    }

    // استخراج التصنيفات وفحص الكلمات المفتاحية والقصة للرياضة ديناميكياً
    let genreNames = (d.genres || []).map((g) => g.name);
    if (badgeText === "Anime") {
      genreNames = genreNames.filter((g) => g !== "Animation");

      const kwList = d.keywords?.results || d.keywords?.keywords || [];
      const hasSportsKw = kwList.some(
        (k) =>
          k.id === 6075 ||
          (k.name &&
            typeof k.name === "string" &&
            k.name.toLowerCase().includes("sport")),
      );

      const hasSportsInText = sportsRegex.test(
        `${d.name || d.title || ""} ${d.overview || ""}`,
      );

      if (hasSportsKw || hasSportsInText) {
        genreNames = ["Sports", ...genreNames.filter((g) => g !== "Sports")];
      }
    }

    const media = {
      id: d.id,
      type: mediaType,
      badge: badgeText,
      title: d.title || d.name,
      year: (d.release_date || d.first_air_date || "2026").split("-")[0],
      score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
      duration: durationText,
      genres:
        genreNames.length > 0 ? genreNames.slice(0, 3).join(", ") : "Drama",
      overview: d.overview || "No synopsis available at this time.",
      poster: d.poster_path
        ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
        : "assets/posters/poster-sherlock.webp",
      backdrop: d.backdrop_path
        ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
        : "assets/backdrops/backdrop-sherlock.webp",
      creatorLabel: creatorLabel,
      creator: creatorName,
      status: d.status || "Released",
      cast: (d.credits?.cast || []).slice(0, 10).map((actor) => ({
        name: actor.name,
        character: actor.character || "Cast Member",
        image: actor.profile_path
          ? `https://image.tmdb.org/t/p/w300${actor.profile_path}`
          : "assets/profile-avatar.jpg",
      })),
      episodes: season1Episodes,
      seasonsCount: d.number_of_seasons || 1,
      // تمرير كل كرت مقترح على دالة formatCard الموحدة الذكية
      recommendations: (d.recommendations?.results || [])
        .slice(0, 8)
        .map((rec) =>
          formatCard(rec, mediaType === "movie" ? "MOVIE" : "SERIES"),
        ),
    };
    // === جلب المراجعات الخاصة بهذا العمل من قاعدة البيانات ===
    let dbReviews = [];
    try {
      // 🌟 التعديل هنا: التعامل الذكي مع media_type 🌟
      // لو العمل مسلسل أو أنمي، هندور في الداتابيز على (tv و anime) مع بعض
      let typesToSearch = [mediaType];
      if (mediaType === "tv" || mediaType === "anime") {
        typesToSearch = ["tv", "anime"];
      }

      const reviewsQuery = `
        SELECT 
          r.id as review_id,
          r.rating,
          r.review_text,
          r.has_spoilers,
          r.season_number,
          r.episode_number,
          u.username,
          p.avatar_url
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE r.tmdb_id = $1 AND r.media_type = ANY($2::varchar[])
        ORDER BY r.created_at DESC
        LIMIT 10;
      `;
      // تمرير الـ array الخاص بأنواع العمل كـ $2
      const reviewsResult = await db.query(reviewsQuery, [
        mediaId,
        typesToSearch,
      ]);
      dbReviews = reviewsResult.rows;
    } catch (dbErr) {
      console.error("Error fetching reviews for details page:", dbErr.message);
      // هنكمل عرض الصفحة حتى لو فيه مشكلة في جلب المراجعات
    }

    // إضافة المراجعات للـ media object
    media.reviews = dbReviews;
    res.render("details.ejs", { media });
  } catch (error) {
    console.error(
      "[TMDB Details Error]:",
      error.response?.data || error.message,
    );
    res.redirect("/");
  }
});

// API Route: لجلب حلقات أي موسم يختاره المستخدم عند الضغط
app.get("/api/tv/:id/season/:seasonNumber", async (req, res) => {
  try {
    const { id, seasonNumber } = req.params;
    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`,
      {
        params: { api_key: TMDB_API_KEY },
      },
    );
    res.json(response.data.episodes || []);
  } catch (error) {
    console.error("[Season Fetch Error]:", error.message);
    res.status(500).json([]);
  }
});
app.put("/api/reviews/:id", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const {
      rating,
      review_text,
      is_rewatch,
      has_spoilers,
      liked,
      season_number,
      episode_number,
      watch_date,
    } = req.body;

    await db.query(
      `
            UPDATE reviews 
            SET rating = $1, review_text = $2, is_rewatch = $3, has_spoilers = $4, liked = $5, season_number = $6, episode_number = $7, watch_date = $8
            WHERE id = $9 AND user_id = $10
        `,
      [
        rating,
        review_text,
        is_rewatch,
        has_spoilers,
        liked,
        season_number,
        episode_number,
        watch_date,
        req.params.id,
        req.user.id,
      ],
    );

    res.status(200).json({ message: "Log updated successfully" });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// المسارات الثابتة
// ==========================================
// Route: Diary Page (يوميات المشاهدة)
// ==========================================
app.get("/diary", async (req, res) => {
  // 1. لازم اليوزر يكون مسجل دخول
  if (!req.user) {
    return res.redirect("/sign-in");
  }

  try {
    // 2. هنجيب كل الـ Logs بتاعته ونربطها ببيانات العمل من الكاش
    const query = `
      SELECT 
        r.id AS review_id, r.tmdb_id, r.media_type, r.rating, r.review_text, 
        r.is_rewatch, r.has_spoilers, r.liked, r.watch_date,
        r.season_number, r.episode_number,  /* 👈 السطر ده اللي كان ناقص */
        m.title, m.poster_path, m.is_anime, m.run_time, m.total_episodes,m.total_seasons,
        EXTRACT(YEAR FROM r.watch_date) AS watch_year,
        TO_CHAR(r.watch_date, 'Month') AS watch_month,
        EXTRACT(DAY FROM r.watch_date) AS watch_day
      FROM reviews r
      JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
      WHERE r.user_id = $1
      ORDER BY r.watch_date DESC, r.created_at DESC
    `;

    const result = await db.query(query, [req.user.id]);
    const allLogs = result.rows;

    // 3. حساب عدد الأعمال اللي شافها السنة دي (عشان الـ Subtitle اللي فوق)
    const currentYear = new Date().getFullYear();
    const currentYearCount = allLogs.filter(
      (log) => parseInt(log.watch_year) === currentYear,
    ).length;

    // 4. تجميع الأعمال حسب "الشهر والسنة" (عشان نعرضهم تحت بعض زي التصميم بتاعك)
    const groupedLogs = {};
    allLogs.forEach((log) => {
      const monthYear = `${log.watch_month.trim()} ${log.watch_year}`;
      if (!groupedLogs[monthYear]) {
        groupedLogs[monthYear] = [];
      }
      groupedLogs[monthYear].push(log);
    });

    // 5. نبعت الداتا المترتبة للصفحة
    res.render("diary.ejs", {
      groupedLogs,
      currentYearCount,
      currentYear,
    });
  } catch (error) {
    console.error("Error fetching diary logs:", error);
    res.render("diary.ejs", {
      groupedLogs: {},
      currentYearCount: 0,
      currentYear: new Date().getFullYear(),
    });
  }
});
app.delete("/api/reviews/:id", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Unauthorized" });

  try {
    // بنحذف بشرطين: رقم الريفيو، وإنه يكون بتاع اليوزر نفسه (للحماية)
    await db.query("DELETE FROM reviews WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    res.status(200).json({ message: "Log deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/discover", (req, res) => {
  res.render("discover.ejs");
});
const TMDB_GENRES = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function formatDiscoverItem(item) {
  const isAnime = item.original_language === "ja";
  const isMovie = item.media_type === "movie" || item.title !== undefined;
  let badge = "Series";
  if (isMovie) badge = "Movie";
  else if (isAnime) badge = "Anime";

  const y =
    (item.release_date || item.first_air_date || "").split("-")[0] || "N/A";
  const score = item.vote_average ? item.vote_average.toFixed(1) : "NR";

  const genres = (item.genre_ids || [])
    .filter((id) => id !== 16)
    .map((id) => TMDB_GENRES[id])
    .filter(Boolean)
    .slice(0, 2);

  const genreDisplay =
    genres.length > 0
      ? genres.join(", ")
      : badge === "Anime"
        ? "Anime"
        : "General";

  return {
    id: item.id,
    title: item.title || item.name,
    mediaType: isMovie ? "movie" : "tv",
    badge: badge,
    year: y,
    genres: genreDisplay,
    score: score,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='255' viewBox='0 0 170 255'%3E%3Crect fill='%2311201f' width='170' height='255'/%3E%3Ctext fill='%23718096' font-family='sans-serif' font-size='14' dy='130' dx='45'%3ENo Poster%3C/text%3E%3C/svg%3E",
  };
}

app.get("/api/discover", async (req, res) => {
  try {
    const {
      q = "",
      type = "all",
      genre = "all",
      rating = "0",
      sort = "popular",
      year = "all",
      page = 1,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const ITEMS_PER_PAGE = 21;

    const movieGenreMap = {
      action: 28,
      scifi: 878,
      drama: 18,
      mystery: 9648,
      fantasy: 14,
      comedy: 35,
    };
    const tvGenreMap = {
      action: 10759,
      scifi: 10765,
      drama: 18,
      mystery: 9648,
      fantasy: 10765,
      comedy: 35,
    };

    if (q.trim() !== "") {
      const searchRes = await axios.get(
        "https://api.themoviedb.org/3/search/multi",
        {
          params: { api_key: TMDB_API_KEY, query: q.trim(), page: pageNum },
        },
      );

      let items = (searchRes.data.results || []).filter(
        (it) => it.media_type === "movie" || it.media_type === "tv",
      );

      if (type === "movie")
        items = items.filter((it) => it.media_type === "movie");
      else if (type === "tv")
        items = items.filter(
          (it) => it.media_type === "tv" && it.original_language !== "ja",
        );
      else if (type === "anime")
        items = items.filter((it) => it.original_language === "ja");

      const results = items.slice(0, ITEMS_PER_PAGE).map(formatDiscoverItem);
      return res.json({
        results,
        page: pageNum,
        totalPages: Math.min(searchRes.data.total_pages || 1, 500),
      });
    }

    function buildDiscoverParams(mediaType, targetPage) {
      const params = { api_key: TMDB_API_KEY, page: targetPage };

      if (sort === "newest") {
        params.sort_by =
          mediaType === "movie"
            ? "primary_release_date.desc"
            : "first_air_date.desc";
      } else if (sort === "rating") {
        params.sort_by = "vote_average.desc";
        params["vote_count.gte"] = 100;
      } else {
        params.sort_by = "popularity.desc";
      }

      const minRating = parseFloat(rating);
      if (minRating > 0) {
        params["vote_average.gte"] = minRating;
        if (minRating >= 8.0) params["vote_count.gte"] = 100;
        else if (minRating >= 7.0) params["vote_count.gte"] = 50;
        else params["vote_count.gte"] = 20;
      }

      if (year !== "all") {
        const prefix =
          mediaType === "movie" ? "primary_release_date" : "first_air_date";
        if (year === "2010s") {
          params[`${prefix}.gte`] = "2010-01-01";
          params[`${prefix}.lte`] = "2019-12-31";
        } else if (year === "2000s") {
          params[`${prefix}.gte`] = "2000-01-01";
          params[`${prefix}.lte`] = "2009-12-31";
        } else if (year === "90s") {
          params[`${prefix}.gte`] = "1990-01-01";
          params[`${prefix}.lte`] = "1999-12-31";
        } else if (year === "classics") {
          params[`${prefix}.lte`] = "1989-12-31";
        } else if (!isNaN(year)) {
          if (mediaType === "movie")
            params.primary_release_year = parseInt(year, 10);
          else params.first_air_date_year = parseInt(year, 10);
        }
      }

      if (genre !== "all") {
        const gid =
          mediaType === "movie" ? movieGenreMap[genre] : tvGenreMap[genre];
        if (gid) params.with_genres = gid;
      }

      return params;
    }

    let rawItems = [];
    let totalPages = 500;

    if (type === "all") {
      const [mInit, tInit] = await Promise.all([
        axios.get("https://api.themoviedb.org/3/discover/movie", {
          params: buildDiscoverParams("movie", 1),
        }),
        axios.get("https://api.themoviedb.org/3/discover/tv", {
          params: {
            ...buildDiscoverParams("tv", 1),
            without_original_language: "ja",
          },
        }),
      ]);

      const movieTotal = mInit.data.total_results || 0;
      const tvTotal = tInit.data.total_results || 0;
      const totalResults = movieTotal + tvTotal;
      totalPages = Math.min(Math.ceil(totalResults / ITEMS_PER_PAGE), 500);
      // حساب عدد الكروت المخصصة للأفلام والمسلسلات في هذه الصفحة
      let movieIndex = 0;
      let tvIndex = 0;
      let movieStart = 0;
      let movieCount = 0;
      let tvStart = 0;
      let tvCount = 0;

      for (let k = 1; k <= pageNum; k++) {
        const mLeft = Math.max(0, movieTotal - movieIndex);
        const tLeft = Math.max(0, tvTotal - tvIndex);

        let mTake = Math.min(11, mLeft);
        let tTake = Math.min(ITEMS_PER_PAGE - mTake, tLeft);

        if (mTake + tTake < ITEMS_PER_PAGE && tLeft > tTake) {
          tTake = Math.min(ITEMS_PER_PAGE - mTake, tLeft);
        }
        if (mTake + tTake < ITEMS_PER_PAGE && mLeft > mTake) {
          mTake = Math.min(ITEMS_PER_PAGE - tTake, mLeft);
        }

        if (k === pageNum) {
          movieStart = movieIndex;
          movieCount = mTake;
          tvStart = tvIndex;
          tvCount = tTake;
        }

        movieIndex += mTake;
        tvIndex += tTake;
      }

      // جلب المقاطع المطلوبة بدقة دون تكرار أو تفويت
      async function fetchMediaSlice(mediaType, start, count, initData) {
        if (count <= 0) return [];
        const p1 = Math.floor(start / 20) + 1;
        const p2 = Math.floor((start + count - 1) / 20) + 1;

        const endpoint =
          mediaType === "movie"
            ? "https://api.themoviedb.org/3/discover/movie"
            : "https://api.themoviedb.org/3/discover/tv";

        const baseParams = buildDiscoverParams(mediaType, p1);
        if (mediaType === "tv") baseParams.without_original_language = "ja";

        const p1Promise =
          p1 === 1
            ? Promise.resolve(initData)
            : axios.get(endpoint, { params: baseParams });
        const p2Promise =
          p1 !== p2
            ? p2 === 1
              ? Promise.resolve(initData)
              : axios.get(endpoint, {
                  params: {
                    ...buildDiscoverParams(mediaType, p2),
                    ...(mediaType === "tv"
                      ? { without_original_language: "ja" }
                      : {}),
                  },
                })
            : Promise.resolve({ data: { results: [] } });

        const [r1, r2] = await Promise.all([p1Promise, p2Promise]);
        const list = [
          ...(r1.data.results || []),
          ...(r2.data.results || []),
        ].map((it) => ({
          ...it,
          media_type: mediaType,
        }));

        const offset = start - (p1 - 1) * 20;
        return list.slice(offset, offset + count);
      }

      const [moviesSlice, tvsSlice] = await Promise.all([
        fetchMediaSlice("movie", movieStart, movieCount, mInit),
        fetchMediaSlice("tv", tvStart, tvCount, tInit),
      ]);

      const combined = [];
      const maxL = Math.max(moviesSlice.length, tvsSlice.length);
      for (let i = 0; i < maxL; i++) {
        if (moviesSlice[i]) combined.push(moviesSlice[i]);
        if (tvsSlice[i]) combined.push(tvsSlice[i]);
      }

      rawItems = combined.slice(0, ITEMS_PER_PAGE);
    } else if (type === "movie") {
      const startIndex = (pageNum - 1) * ITEMS_PER_PAGE;
      const p1 = Math.floor(startIndex / 20) + 1;
      const p2 = Math.floor((startIndex + ITEMS_PER_PAGE - 1) / 20) + 1;

      const [r1, r2] = await Promise.all([
        axios.get("https://api.themoviedb.org/3/discover/movie", {
          params: buildDiscoverParams("movie", p1),
        }),
        p1 !== p2
          ? axios.get("https://api.themoviedb.org/3/discover/movie", {
              params: buildDiscoverParams("movie", p2),
            })
          : Promise.resolve({ data: { results: [] } }),
      ]);

      const list = [...(r1.data.results || []), ...(r2.data.results || [])].map(
        (m) => ({ ...m, media_type: "movie" }),
      );
      const offset = startIndex - (p1 - 1) * 20;
      rawItems = list.slice(offset, offset + ITEMS_PER_PAGE);
      totalPages = Math.min(
        Math.ceil((r1.data.total_results || 500) / ITEMS_PER_PAGE),
        500,
      );
    } else if (type === "tv") {
      const startIndex = (pageNum - 1) * ITEMS_PER_PAGE;
      const p1 = Math.floor(startIndex / 20) + 1;
      const p2 = Math.floor((startIndex + ITEMS_PER_PAGE - 1) / 20) + 1;

      const tvP1 = buildDiscoverParams("tv", p1);
      tvP1.without_original_language = "ja";
      const tvP2 = buildDiscoverParams("tv", p2);
      tvP2.without_original_language = "ja";

      const [r1, r2] = await Promise.all([
        axios.get("https://api.themoviedb.org/3/discover/tv", { params: tvP1 }),
        p1 !== p2
          ? axios.get("https://api.themoviedb.org/3/discover/tv", {
              params: tvP2,
            })
          : Promise.resolve({ data: { results: [] } }),
      ]);

      const list = [...(r1.data.results || []), ...(r2.data.results || [])].map(
        (t) => ({ ...t, media_type: "tv" }),
      );
      const offset = startIndex - (p1 - 1) * 20;
      rawItems = list.slice(offset, offset + ITEMS_PER_PAGE);
      totalPages = Math.min(
        Math.ceil((r1.data.total_results || 500) / ITEMS_PER_PAGE),
        500,
      );
    } else if (type === "anime") {
      const startIndex = (pageNum - 1) * ITEMS_PER_PAGE;
      const p1 = Math.floor(startIndex / 20) + 1;
      const p2 = Math.floor((startIndex + ITEMS_PER_PAGE - 1) / 20) + 1;

      const animeP1 = buildDiscoverParams("tv", p1);
      animeP1.with_original_language = "ja";
      animeP1.with_genres = animeP1.with_genres
        ? `16,${animeP1.with_genres}`
        : 16;

      const animeP2 = buildDiscoverParams("tv", p2);
      animeP2.with_original_language = "ja";
      animeP2.with_genres = animeP2.with_genres
        ? `16,${animeP2.with_genres}`
        : 16;

      const [r1, r2] = await Promise.all([
        axios.get("https://api.themoviedb.org/3/discover/tv", {
          params: animeP1,
        }),
        p1 !== p2
          ? axios.get("https://api.themoviedb.org/3/discover/tv", {
              params: animeP2,
            })
          : Promise.resolve({ data: { results: [] } }),
      ]);

      const list = [...(r1.data.results || []), ...(r2.data.results || [])].map(
        (t) => ({ ...t, media_type: "tv" }),
      );
      const offset = startIndex - (p1 - 1) * 20;
      rawItems = list.slice(offset, offset + ITEMS_PER_PAGE);
      totalPages = Math.min(
        Math.ceil((r1.data.total_results || 500) / ITEMS_PER_PAGE),
        500,
      );
    }

    const results = rawItems.map(formatDiscoverItem);

    res.json({
      results,
      page: pageNum,
      totalPages,
    });
  } catch (error) {
    res.status(500).json({ results: [], page: 1, totalPages: 1 });
  }
});
app.get("/drome", (req, res) => res.render("drome.ejs"));
app.get("/lists", (req, res) => res.render("lists.ejs"));
// 🌟 مسار البروفايل الديناميكي 🌟
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
    });
  } catch (err) {
    console.error("Error loading profile:", err);
    next(err);
  }
});
app.get("/settings", (req, res) => res.render("settings.ejs"));
app.get("/sign-in", (req, res) => res.render("sign-in.ejs"));
// ==========================================
// 6. Route: Login (Authentication Engine)
// ==========================================
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    // لو مفيش يوزر (يعني باسورد غلط أو الحساب مش موجود)
    if (!user) {
      return res.redirect("/sign-in?error=1");
    }
    // لو كله تمام
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }

      // 🌟 تفعيل ميزة Remember Me 🌟
      if (req.body.remember === "true") {
        // خلي الجلسة تعيش لمدة 30 يوم (بالملي ثانية)
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        // خلي الجلسة تنتهي بمجرد إغلاق المتصفح (Browser Session)
        req.session.cookie.expires = false;
      }

      return res.redirect("/");
    });
  })(req, res, next);
});
app.get("/sign-up", (req, res) => res.render("sign-up.ejs"));
app.post("/register", async (req, res) => {
  try {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    // 1. فحص الإيميل واليوزر نيم مع بعض في خطوة واحدة
    const checkUser = await db.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username],
    );

    if (checkUser.rows.length > 0) {
      const existingUser = checkUser.rows[0];
      let errorMsg = "Account already exists";

      // بنحدد المشكلة في الإيميل ولا اليوزر نيم
      if (existingUser.email === email) {
        errorMsg = "This Email is already registered!";
      } else if (existingUser.username === username) {
        errorMsg = "This Username is already taken!";
      }

      // 🌟 التعديل هنا: بنعيد عرض الصفحة ونبعتلها رسالة الخطأ 🌟
      return res.render("sign-up.ejs", { errorMessage: errorMsg });
    }

    // 2. تشفير الباسورد
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. الحفظ في الداتابيز للثلاث جداول
    const insertResult = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [username, email, hashedPassword],
    );
    const newUserId = insertResult.rows[0].id;

    await db.query(
      "INSERT INTO user_settings (user_id, is_private) VALUES ($1, $2)",
      [newUserId, false],
    );

    await db.query(
      "INSERT INTO user_profiles (user_id, avatar_url, backdrop_url) VALUES ($1, $2, $3)",
      [
        newUserId,
        "/assets/avatars/default-avatar.jpeg",
        "/assets/backdrops/default-backdrop.png",
      ],
    );

    // 4. تسجيل الدخول أوتوماتيك والتحويل للرئيسية
    const newUser = { id: newUserId, username: username, email: email };
    req.login(newUser, (err) => {
      if (err) {
        console.error(err);
        return res.render("sign-up.ejs", {
          errorMessage: "Registration successful, but login failed.",
        });
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.error(error);
    // لو حصل خطأ سيرفر، بنعرضه جوه الصفحة برضه
    return res.render("sign-up.ejs", {
      errorMessage: "Internal Server Error. Please try again.",
    });
  }
});
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});
// ==========================================
// 🌟 Route: Edit Profile with Image Upload
// ==========================================
app.post(
  "/edit-profile",
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "backdrop", maxCount: 1 },
  ]),
  async (req, res) => {
    if (!req.isAuthenticated()) {
      return res
        .status(401)
        .json({ error: "You must be logged in to edit your profile." });
    }

    const userId = req.user.id;
    // الداتا النصية بتيجي في req.body
    const { displayName, username, bio, genre1, genre2 } = req.body;
    // الصور بتيجي في req.files
    const files = req.files;

    try {
      // 1. تحديث اليوزر نيم
      await db.query("UPDATE users SET username = $1 WHERE id = $2", [
        username,
        userId,
      ]);

      // 2. تحديث الاسم والبايو
      await db.query(
        "UPDATE user_profiles SET display_name = $1, bio = $2 WHERE user_id = $3",
        [displayName, bio, userId],
      );

      let newAvatarUrl = req.user.avatar_url; // هنحتفظ بالقديمة مؤقتاً

      // 3. تحديث مسارات الصور (لو اليوزر رفع صور جديدة)
      if (files && files.avatar) {
        const avatarPath = `/assets/avatars/${files.avatar[0].filename}`;
        await db.query(
          "UPDATE user_profiles SET avatar_url = $1 WHERE user_id = $2",
          [avatarPath, userId],
        );
        newAvatarUrl = avatarPath; // حفظنا المسار الجديد عشان نحدثه في الـ Session
      }

      if (files && files.backdrop) {
        const backdropPath = `/assets/backdrops/${files.backdrop[0].filename}`;
        await db.query(
          "UPDATE user_profiles SET backdrop_url = $1 WHERE user_id = $2",
          [backdropPath, userId],
        );
      }

      // 4. تحديث الـ Genres
      await db.query("DELETE FROM user_favorite_genres WHERE user_id = $1", [
        userId,
      ]);
      if (genre1)
        await db.query(
          "INSERT INTO user_favorite_genres (user_id, genre) VALUES ($1, $2)",
          [userId, genre1],
        );
      if (genre2 && genre2 !== genre1)
        await db.query(
          "INSERT INTO user_favorite_genres (user_id, genre) VALUES ($1, $2)",
          [userId, genre2],
        );

      // 🌟 5. تحديث الـ Session في Passport عشان النافبار تسمع التغيير 🌟
      const updatedUser = {
        ...req.user, // الداتا القديمة (id, email, etc.)
        username: username, // اليوزر نيم الجديد
        avatar_url: newAvatarUrl, // الصورة الجديدة أو القديمة
      };

      // إجبار Passport على حفظ الداتا الجديدة في الجلسة الحالية
      req.login(updatedUser, function (err) {
        if (err) {
          console.error("Session Update Error:", err);
          return res
            .status(500)
            .json({ error: "Profile updated, but session refresh failed." });
        }

        // الرد بنجاح العملية وإرسال اليوزر نيم الجديد للفرونت إند
        return res.status(200).json({
          message: "Profile updated successfully",
          newUsername: username,
        });
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error.code === "23505") {
        return res.status(400).json({ error: "Username is already taken." });
      }
      res.status(500).json({ error: "Internal Server Error." });
    }
  },
);
app.get("/single-list", (req, res) => res.render("single-list.ejs"));
app.get("/single-review", (req, res) => res.render("single-review.ejs"));
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
