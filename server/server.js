import express, { raw } from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
const app = express();
const port = 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, "../client")));

// ضع مفتاح TMDB الخاص بك هنا
const TMDB_API_KEY = "ea76631510d3901482064d17498c07b5";
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/anime", async (req, res) => {
  try {
    const TMDB_URL = "https://api.themoviedb.org/3/discover/tv";

    const commonParams = {
      api_key: TMDB_API_KEY,
      with_original_language: "ja",
      page: 1,
    };

    // نطلب الكاروسيلات + قائمة التريند للـ Hero في نفس اللحظة
    const [topRatedRes, sportsRes, mysteryRes, trendingRes] = await Promise.all(
      [
        // 1. Top Rated
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            sort_by: "vote_average.desc",
            "vote_count.gte": 500,
          },
        }),

        // 2. Sports
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            with_keywords: "6075",
            sort_by: "popularity.desc",
          },
        }),

        // 3. Mystery
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16,9648",
            sort_by: "popularity.desc",
          },
        }),

        // 4. الأكثر تداولاً حالياً (Trending / Popular للـ Hero)
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            sort_by: "popularity.desc",
          },
        }),
      ],
    );

    // نأخذ الأنمي الأول في التريند ونجلب تفاصيله الكاملة (الحلقات والتصنيفات)
    const featuredRaw = trendingRes.data.results[0];
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
        title: d.name,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        // صورة الـ Backdrop العريضة الخاصة بالهيرو
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
    // دالة توحيد شكل الكروت
    const formatCards = (list) =>
      list.slice(0, 10).map((anime) => ({
        id: anime.id,
        title: anime.name,
        poster: anime.poster_path
          ? `https://image.tmdb.org/t/p/w500${anime.poster_path}`
          : "assets/posters/poster-fmab.webp",
        score: anime.vote_average ? anime.vote_average.toFixed(1) : "N/A",
        type: "ANIME",
        ageBadge: "TV-14",
        meta: anime.first_air_date
          ? anime.first_air_date.split("-")[0]
          : "2026",
      }));

    res.render("anime.ejs", {
      heroAnime,
      topRatedAnime: formatCards(topRatedRes.data.results),
      actionAnime: formatCards(sportsRes.data.results),
      mysteryAnime: formatCards(mysteryRes.data.results),
    });
  } catch (error) {
    console.error("[TMDB Batch Error]:", error.response?.data || error.message);
    res.render("anime.ejs", {
      heroAnime: null,
      topRatedAnime: [],
      actionAnime: [],
      mysteryAnime: [],
    });
  }
});
app.get("/details", (req, res) => {
  res.render("details.ejs");
});
app.get("/diary", (req, res) => {
  res.render("diary.ejs");
});
app.get("/discover", (req, res) => {
  res.render("discover.ejs");
});
app.get("/drome", (req, res) => {
  res.render("drome.ejs");
});
app.get("/lists", (req, res) => {
  res.render("lists.ejs");
});
// Route: Movies Page using TMDB
app.get("/movies", async (req, res) => {
  try {
    const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/discover/movie";

    const commonParams = {
      api_key: TMDB_API_KEY,
      page: 1,
    };

    // إرسال 5 طلبات متزامنة (4 كاروسيلات + قائمة التريند للـ Hero)
    const [trendingRes, latestRes, actionSciFiRes, thrillerRes, horrorRes] =
      await Promise.all([
        // 1. تريند الأفلام للهيرو
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
          },
        }),

        // 2. إصدارات 2026 الحديثة
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            primary_release_year: 2026,
            sort_by: "popularity.desc",
          },
        }),

        // 3. أكشن وخيال علمي (Action: 28, Sci-Fi: 878)
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "28,878",
            sort_by: "popularity.desc",
          },
        }),

        // 4. جريمة وإثارة وغموض (Crime: 80, Mystery: 9648)
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "80,9648",
            sort_by: "popularity.desc",
          },
        }),

        // 5. رعب (Horror: 27)
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "27",
            sort_by: "popularity.desc",
          },
        }),
      ]);

    // تفاصيل الفيلم رقم 1 في التريند للـ Hero
    const featuredRaw = trendingRes.data.results[0];
    let heroMovie = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        },
      );
      const d = heroDetailRes.data;

      // تحويل وقت الفيلم من دقائق (مثل 122) إلى ساعات ودقائق (2h 02m)
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

    // دالة موحدة لتنسيق كروت الأفلام
    const formatMovieCards = (list) =>
      list.slice(0, 8).map((movie) => ({
        id: movie.id,
        title: movie.title,
        poster: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : "assets/posters/poster-odyssey.webp",
        score: movie.vote_average ? movie.vote_average.toFixed(1) : "N/A",
        type: "MOVIE",
        ageBadge: movie.adult ? "R" : "PG-13",
        meta: movie.release_date ? movie.release_date.split("-")[0] : "2026",
      }));

    res.render("movies.ejs", {
      heroMovie,
      latestMovies: formatMovieCards(latestRes.data.results),
      actionSciFiMovies: formatMovieCards(actionSciFiRes.data.results),
      thrillerMovies: formatMovieCards(thrillerRes.data.results),
      horrorMovies: formatMovieCards(horrorRes.data.results),
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
app.get("/profile", (req, res) => {
  res.render("profile.ejs");
});
// Route: TV Series Page using TMDB
app.get("/series", async (req, res) => {
  try {
    const TMDB_TV_URL = "https://api.themoviedb.org/3/discover/tv";

    // الخصائص المشتركة لمسلسلات الدراما الحية (استبعاد الأنمي والكرتون عبر without_genres: 16)
    const commonParams = {
      api_key: TMDB_API_KEY,
      without_genres: "16",
      page: 1,
    };

    // إرسال 5 طلبات متزامنة (التريند للهيرو + 4 كاروسيلات)
    const [trendingRes, topRatedRes, actionSciFiRes, crimeRes, mysteryRes] =
      await Promise.all([
        // 1. الأكثر تداولاً حالياً للـ Hero
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
          },
        }),

        // 2. الأعلى تقييماً تاريخياً (Top Rated) بمصوتين فوق 1000
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "vote_average.desc",
            "vote_count.gte": 1000,
          },
        }),

        // 3. أكشن وفانتازيا وخيال علمي (Action: 10759, Sci-Fi & Fantasy: 10765)
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_genres: "10759|10765",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),

        // 4. جريمة وإثارة (Crime: 80, Drama: 18)
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_genres: "80",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),

        // 5. غموض وظواهر خارقة (Mystery: 9648)
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_keywords: "9799|6152", // Horror (9799) OR Supernatural (6152)
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
            "vote_average.gte": 7.0,
          },
        }),
      ]);

    // جلب التفاصيل الكاملة للمسلسل رقم 1 في التريند للهيرو
    const featuredRaw = trendingRes.data.results[0];
    let heroSeries = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        },
      );
      const d = heroDetailRes.data;

      // تحديد نطاق سنوات العرض (مثال: 2010 – 2017 أو 2024 – Present)
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

    // دالة موحدة لتنسيق كروت المسلسلات
    const formatSeriesCards = (list) =>
      list.slice(0, 8).map((tv) => ({
        id: tv.id,
        title: tv.name,
        poster: tv.poster_path
          ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
          : "/assets/posters/poster-sherlock.webp",
        score: tv.vote_average ? tv.vote_average.toFixed(1) : "N/A",
        type: "SERIES",
        ageBadge: "TV-MA",
        meta: tv.first_air_date ? tv.first_air_date.split("-")[0] : "2026",
      }));

    res.render("series.ejs", {
      heroSeries,
      topRatedSeries: formatSeriesCards(topRatedRes.data.results),
      actionSciFiSeries: formatSeriesCards(actionSciFiRes.data.results),
      crimeSeries: formatSeriesCards(crimeRes.data.results),
      mysterySeries: formatSeriesCards(mysteryRes.data.results),
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
app.get("/settings", (req, res) => {
  res.render("settings.ejs");
});
app.get("/sign-in", (req, res) => {
  res.render("sign-in.ejs");
});
app.get("/sign-up", (req, res) => {
  res.render("sign-up.ejs");
});
app.get("/single-list", (req, res) => {
  res.render("single-list.ejs");
});
app.get("/single-review", (req, res) => {
  res.render("single-review.ejs");
});
app.get("/watchlist", (req, res) => {
  res.render("watchlist.ejs");
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
