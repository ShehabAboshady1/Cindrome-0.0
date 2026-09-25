import express, { raw } from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const app = express();
const port = 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, "../client")));

// مفتاح TMDB الخاص بك
const TMDB_API_KEY = "ea76631510d3901482064d17498c07b5";

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
const sportsRegex = /\b(sport|sports|football|soccer|volleyball|basketball|boxing|boxer|baseball|tennis|skating|swimming|swimmer|table tennis|ping pong|badminton|rugby|judo|karate|wrestling|athlete|athletics|striker)\b/i;

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
  let genres = (item.genre_ids || [])
    .map((id) => genreMap[id])
    .filter(Boolean);

  // 2. معالجة الأنمي وحذف Animation لتجنب الحشو
  if (displayType === "ANIME") {
    genres = genres.filter((g) => g !== "Animation");
  }

  // 3. الفحص الذكي للرياضة: هل تذكر القصة أو العنوان أي رياضة؟
  const textContent = `${item.title || item.name || ""} ${item.overview || ""}`;
  const isSportsContent = forcedGenre === "Sports" || sportsRegex.test(textContent);

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
    selectedGenres.join(", ") ||
    (displayType === "MOVIE" ? "Cinema" : "Drama");
  const year = (item.release_date || item.first_air_date || "2026").split("-")[0];

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
        }
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
      (item) => item.vote_count >= 150 && item.vote_average >= 6.0
    );

    res.render("index.ejs", {
      heroMovie,
      trendingNow: filteredTrending.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
      mustWatchMovies: mustWatchRes.data.results.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
      topTVShows: topTvRes.data.results.slice(0, 8).map((i) => formatCard(i, "SERIES")),
      topAnime: topAnimeRes.data.results.slice(0, 8).map((i) => formatCard(i, "ANIME")),
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
      page: 1,
    };

    const [topRatedRes, sportsRes, mysteryRes, trendingRes] = await Promise.all([
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
        },
      }),
      axios.get(TMDB_URL, {
        params: {
          ...commonParams,
          with_genres: "16,9648",
          sort_by: "popularity.desc",
        },
      }),
      axios.get(TMDB_URL, {
        params: {
          ...commonParams,
          with_genres: "16",
          sort_by: "popularity.desc",
        },
      }),
    ]);

    const featuredRaw = trendingRes.data.results[0];
    let heroAnime = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        }
      );
      const d = heroDetailRes.data;

      heroAnime = {
        id: d.id,
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
      topRatedAnime: topRatedRes.data.results.slice(0, 10).map((i) => formatCard(i, "ANIME")),
      actionAnime: sportsRes.data.results.slice(0, 10).map((i) => formatCard(i, "ANIME", "Sports")),
      mysteryAnime: mysteryRes.data.results.slice(0, 10).map((i) => formatCard(i, "ANIME")),
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
      page: 1,
    };

    const [trendingRes, latestRes, actionSciFiRes, thrillerRes, horrorRes] =
      await Promise.all([
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            primary_release_year: 2026,
            sort_by: "popularity.desc",
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "28,878",
            sort_by: "popularity.desc",
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "80,9648",
            sort_by: "popularity.desc",
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "27",
            sort_by: "popularity.desc",
          },
        }),
      ]);

    const featuredRaw = trendingRes.data.results[0];
    let heroMovie = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        }
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
      latestMovies: latestRes.data.results.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
      actionSciFiMovies: actionSciFiRes.data.results.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
      thrillerMovies: thrillerRes.data.results.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
      horrorMovies: horrorRes.data.results.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
    });
  } catch (error) {
    console.error("[TMDB Movies Error]:", error.response?.data || error.message);
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
      page: 1,
    };

    const [trendingRes, topRatedRes, actionSciFiRes, crimeRes, mysteryRes] =
      await Promise.all([
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
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

    const featuredRaw = trendingRes.data.results[0];
    let heroSeries = null;

    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        {
          params: { api_key: TMDB_API_KEY },
        }
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
      topRatedSeries: topRatedRes.data.results.slice(0, 8).map((i) => formatCard(i, "SERIES")),
      actionSciFiSeries: actionSciFiRes.data.results.slice(0, 8).map((i) => formatCard(i, "SERIES")),
      crimeSeries: crimeRes.data.results.slice(0, 8).map((i) => formatCard(i, "SERIES")),
      mysterySeries: mysteryRes.data.results.slice(0, 8).map((i) => formatCard(i, "SERIES")),
    });
  } catch (error) {
    console.error("[TMDB Series Error]:", error.response?.data || error.message);
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
          }
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
            c.job === "Director"
        );
        if (animeCreator) {
          creatorLabel =
            animeCreator.job === "Original Creator" ||
            animeCreator.job === "Original Story"
              ? "Original Manga"
              : "Director";
          creatorName = animeCreator.name;
        } else if (d.production_companies && d.production_companies.length > 0) {
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
          (k.name && typeof k.name === "string" && k.name.toLowerCase().includes("sport"))
      );

      const hasSportsInText = sportsRegex.test(`${d.name || d.title || ""} ${d.overview || ""}`);

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
      genres: genreNames.length > 0 ? genreNames.slice(0, 3).join(", ") : "Drama",
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
        .map((rec) => formatCard(rec, mediaType === "movie" ? "MOVIE" : "SERIES")),
    };

    res.render("details.ejs", { media });
  } catch (error) {
    console.error("[TMDB Details Error]:", error.response?.data || error.message);
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
      }
    );
    res.json(response.data.episodes || []);
  } catch (error) {
    console.error("[Season Fetch Error]:", error.message);
    res.status(500).json([]);
  }
});

// المسارات الثابتة
app.get("/diary", (req, res) => res.render("diary.ejs"));
app.get("/discover", (req, res) => res.render("discover.ejs"));
app.get("/drome", (req, res) => res.render("drome.ejs"));
app.get("/lists", (req, res) => res.render("lists.ejs"));
app.get("/profile", (req, res) => res.render("profile.ejs"));
app.get("/settings", (req, res) => res.render("settings.ejs"));
app.get("/sign-in", (req, res) => res.render("sign-in.ejs"));
app.get("/sign-up", (req, res) => res.render("sign-up.ejs"));
app.get("/single-list", (req, res) => res.render("single-list.ejs"));
app.get("/single-review", (req, res) => res.render("single-review.ejs"));
app.get("/watchlist", (req, res) => res.render("watchlist.ejs"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});