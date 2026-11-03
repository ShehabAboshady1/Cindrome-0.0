// controllers/dromeController.js
import db from "../config/db.js";
import axios from "axios";
import {
  CindromeEngine,
  TMDB_GENRE_IDS,
  TMDB_THEME_IDS,
} from "../services/cindromeEngine.js";
import { formatCard } from "../utils/helpers.js";

const TMDB_ID_TO_NAME = {
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

export const processChat = async (req, res) => {
  try {
    const { prompt, focusType = "mixed" } = req.body;

    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Please enter a message." });
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const cleanPrompt = prompt.trim();

    // 1. توحيد نوع الميديا
    let normalizedFocus = focusType.toLowerCase().trim();
    if (normalizedFocus === "movies") normalizedFocus = "movie";
    if (normalizedFocus === "series") normalizedFocus = "tv";

    // 2. استخراج النية
    const parsedIntent = CindromeEngine.parseQuery(
      cleanPrompt,
      normalizedFocus,
    );

    if (!parsedIntent.isValid) {
      return res.json({
        success: true,
        message: parsedIntent.message,
        results: [],
      });
    }

    if (parsedIntent.isAmbiguous) {
      return res.json({
        success: true,
        message:
          "I couldn't quite catch the specific genre or mood you're looking for. Are you in the mood for Comedy, Action, Sci-Fi, Horror, or Drama? Or you can just name a title you love!",
        results: [],
      });
    }

    // 3. استخراج ريفيوهات المستخدم الحالي حصراً
    let userProfileStats = {};
    let userReviewsCount = 0;

    if (req.user && req.user.id) {
      const currentUserId = req.user.id;

      const countRes = await db.query(
        "SELECT COUNT(*) FROM reviews WHERE user_id = $1",
        [currentUserId],
      );
      userReviewsCount = parseInt(countRes.rows[0].count, 10);

      if (userReviewsCount >= 5) {
        const topUserReviews = await db.query(
          `SELECT tmdb_id, media_type, rating 
                     FROM reviews 
                     WHERE user_id = $1 AND rating >= 7 
                     ORDER BY rating DESC, watch_date DESC 
                     LIMIT 5`,
          [currentUserId],
        );

        if (topUserReviews.rows.length > 0) {
          const detailPromises = topUserReviews.rows.map((rev) => {
            const endpointType =
              rev.media_type === "anime" ? "tv" : rev.media_type;
            return axios
              .get(
                `https://api.themoviedb.org/3/${endpointType}/${rev.tmdb_id}`,
                {
                  params: { api_key: TMDB_API_KEY },
                },
              )
              .catch(() => null);
          });

          const responses = await Promise.all(detailPromises);
          responses.forEach((resp, index) => {
            if (resp && resp.data && resp.data.genres) {
              const personalRating =
                parseFloat(topUserReviews.rows[index].rating) || 8.0;
              resp.data.genres.forEach((g) => {
                const gName = g.name.toLowerCase();
                userProfileStats[gName] = Math.max(
                  userProfileStats[gName] || 0,
                  personalRating,
                );
              });
            }
          });
        }

        const favGenresRes = await db.query(
          "SELECT genre FROM user_favorite_genres WHERE user_id = $1",
          [currentUserId],
        );
        favGenresRes.rows.forEach((row) => {
          const g = row.genre.toLowerCase();
          if (!userProfileStats[g]) userProfileStats[g] = 8.0;
        });
      }
    }

    // 4. فحص العمل المرجعي المباشر
    let anchorTitle = parsedIntent.extractedReferenceTitle;
    let anchorMedia = null;

    const isShortTitleQuery =
      cleanPrompt.split(" ").length <= 4 &&
      !/\b(recommend|suggest|show|give|want|looking|find|movies|anime|series)\b/i.test(
        cleanPrompt,
      );

    if (!anchorTitle && isShortTitleQuery) {
      anchorTitle = cleanPrompt;
    }

    if (anchorTitle) {
      try {
        const searchEndpoint =
          parsedIntent.targetType === "anime" ||
          parsedIntent.targetType === "tv"
            ? "https://api.themoviedb.org/3/search/tv"
            : parsedIntent.targetType === "movie"
              ? "https://api.themoviedb.org/3/search/movie"
              : "https://api.themoviedb.org/3/search/multi";

        const searchRes = await axios.get(searchEndpoint, {
          params: { api_key: TMDB_API_KEY, query: anchorTitle, page: 1 },
        });

        const topMatch = (searchRes.data.results || []).find(
          (r) => (r.vote_count || 0) >= 10 && r.media_type !== "person",
        );
        if (topMatch) {
          anchorMedia = topMatch;
        }
      } catch (err) {
        console.error("Direct title search failed:", err.message);
      }
    }

    if (
      req.user &&
      userReviewsCount < 3 &&
      !anchorMedia &&
      parsedIntent.detectedGenres.length === 0
    ) {
      const coldStartMessage = CindromeEngine.generateResponseText(
        parsedIntent,
        0,
        true,
      );
      return res.json({
        success: true,
        message: coldStartMessage,
        results: [],
      });
    }

    // 5. رصد النوايا الثيماتية الدقيقة
    const iconicSitcomAnchors =
      /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;
    const isSitcomIntent =
      parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
      (anchorTitle && iconicSitcomAnchors.test(anchorTitle)) ||
      /\b(sitcom|chill|comfort|lighthearted|after a long day|easy watch|feel-good)\b/i.test(
        cleanPrompt,
      );

    const wantsSuperhero =
      parsedIntent.detectedKeywords.some((k) => k.name === "superhero") ||
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
        cleanPrompt,
      );

    const specificSportKw = parsedIntent.detectedKeywords.find((k) =>
      ["racing", "boxing", "football", "basketball"].includes(k.name),
    );
    const userWantsSports =
      parsedIntent.detectedGenres.includes("sports") || !!specificSportKw;

    const wantsTimeTravel =
      parsedIntent.detectedKeywords.some((k) => k.name === "time travel") ||
      /\b(time travel|time loop|timeline|wormhole)\b/i.test(cleanPrompt);
    const wantsPlotTwist =
      parsedIntent.detectedKeywords.some((k) => k.name === "plot twist") ||
      /\b(plot twist|twist ending|crazy plot twists?)\b/i.test(cleanPrompt);
    const wantsMindBending =
      parsedIntent.detectedKeywords.some((k) => k.name === "mind bending") ||
      /\b(mind[- ]bending|psychological puzzle)\b/i.test(cleanPrompt);

    const isComplexThemeIntent =
      wantsTimeTravel || wantsPlotTwist || wantsMindBending;

    const wantsMagic =
      parsedIntent.detectedKeywords.some((k) => k.name === "magic") ||
      /\b(magic|magical|sorcery|sorcerer|witch|wizard|mage|alchemy)\b/i.test(
        cleanPrompt,
      );

    // 6. سحب سلة المرشحين الموسعة من TMDB
    let candidates = [];
    const todayStr = new Date().toISOString().split("T")[0];

    if (anchorMedia) {
      const actualMediaType =
        anchorMedia.media_type || (anchorMedia.first_air_date ? "tv" : "movie");
      const recEndpoint = `https://api.themoviedb.org/3/${actualMediaType}/${anchorMedia.id}/recommendations`;

      const recRes = await axios.get(recEndpoint, {
        params: { api_key: TMDB_API_KEY, page: 1 },
      });
      let rawRecs = recRes.data.results || [];

      if (isSitcomIntent) {
        rawRecs = rawRecs.filter((c) => (c.vote_count || 0) >= 400);
      }

      candidates = rawRecs.map((c) => ({
        ...c,
        media_type: c.media_type || actualMediaType,
      }));

      if (parsedIntent.targetType === "anime") {
        candidates = candidates.filter((c) => c.original_language === "ja");
      }
    }

    // جامع روائع السيتكوم الجماهيرية
    if (isSitcomIntent && parsedIntent.targetType !== "anime") {
      try {
        const [popSitcomsRes, topSitcomsRes] = await Promise.all([
          axios.get("https://api.themoviedb.org/3/discover/tv", {
            params: {
              api_key: TMDB_API_KEY,
              with_genres: "35",
              without_genres: "18,16",
              "vote_count.gte": 800,
              sort_by: "popularity.desc",
              page: 1,
              "first_air_date.lte": todayStr,
            },
          }),
          axios.get("https://api.themoviedb.org/3/discover/tv", {
            params: {
              api_key: TMDB_API_KEY,
              with_genres: "35",
              without_genres: "18,16",
              "vote_count.gte": 1500,
              sort_by: "vote_average.desc",
              page: 1,
              "first_air_date.lte": todayStr,
            },
          }),
        ]);

        const popSitcoms = (popSitcomsRes.data.results || []).map((t) => ({
          ...t,
          media_type: "tv",
        }));
        const topSitcoms = (topSitcomsRes.data.results || []).map((t) => ({
          ...t,
          media_type: "tv",
        }));

        candidates = [...candidates, ...popSitcoms, ...topSitcoms];
      } catch (sitcomErr) {
        console.error("Sitcom harvesting error:", sitcomErr.message);
      }
    }

    // استرجاع أعمال الرياضة المتخصصة
    if (
      candidates.length < 5 &&
      userWantsSports &&
      parsedIntent.targetType !== "anime"
    ) {
      let searchQueries = [];
      if (specificSportKw?.name === "football") {
        searchQueries = ["football", "soccer", "fifa", "nfl"];
      } else if (specificSportKw?.name === "racing") {
        searchQueries = ["racing", "race car", "formula 1"];
      } else if (specificSportKw?.name === "boxing") {
        searchQueries = ["boxing", "boxer"];
      } else if (specificSportKw?.name === "basketball") {
        searchQueries = ["basketball", "nba"];
      } else {
        searchQueries = ["sports"];
      }

      const searchPromises = searchQueries.map((q) =>
        axios
          .get("https://api.themoviedb.org/3/search/movie", {
            params: {
              api_key: TMDB_API_KEY,
              query: q,
              page: 1,
              include_adult: false,
            },
          })
          .catch(() => ({ data: { results: [] } })),
      );

      const sportsDiscoverPromise = axios
        .get("https://api.themoviedb.org/3/discover/movie", {
          params: {
            api_key: TMDB_API_KEY,
            with_keywords: "6075",
            sort_by: "vote_count.desc",
            "vote_count.gte": 100,
            without_genres: "16,878,14",
            "primary_release_date.lte": todayStr,
            page: 1,
          },
        })
        .catch(() => ({ data: { results: [] } }));

      const allResponses = await Promise.all([
        ...searchPromises,
        sportsDiscoverPromise,
      ]);

      let sportsHarvest = [];
      allResponses.forEach((res) => {
        if (res.data?.results) {
          sportsHarvest.push(...res.data.results);
        }
      });

      candidates = sportsHarvest
        .filter((m) => (m.vote_count || 0) >= 20)
        .map((m) => ({
          ...m,
          media_type:
            parsedIntent.targetType === "mixed"
              ? "movie"
              : parsedIntent.targetType,
        }));
    }

    // 🌟 استدعاء TMDB Discover مع ضبط الكلمات المفتاحية وسهرات الرعب
    if (candidates.length < 5) {
      const excludeSuperheroParam = wantsSuperhero ? null : "9715";
      const superheroKeywordParam = wantsSuperhero ? "9715" : null;

      let sportsKeywordParam = null;
      if (specificSportKw && TMDB_THEME_IDS[specificSportKw.name]) {
        sportsKeywordParam = String(TMDB_THEME_IDS[specificSportKw.name]);
      } else if (userWantsSports) {
        sportsKeywordParam = String(TMDB_THEME_IDS.sports || 6075);
      }

      let complexKeywordsList = [];
      if (wantsTimeTravel)
        complexKeywordsList.push(String(TMDB_THEME_IDS.timeTravel));
      if (wantsPlotTwist)
        complexKeywordsList.push(String(TMDB_THEME_IDS.plotTwist));
      if (wantsMindBending)
        complexKeywordsList.push(String(TMDB_THEME_IDS.mindBending));
      const complexKeywordParam =
        complexKeywordsList.length > 0 ? complexKeywordsList.join("|") : null;

      const wantsSciFi =
        parsedIntent.detectedGenres.includes("scifi") || wantsTimeTravel;
      const isSciFiOnly =
        wantsSciFi &&
        !parsedIntent.detectedGenres.includes("fantasy") &&
        !wantsMagic;
      const tvFantasyExclude = isSciFiOnly
        ? "2343,33443,9799,12564,4152,12554,9663"
        : null;

      let excludedMovieGenres = [];
      if (!wantsSciFi && userWantsSports) {
        excludedMovieGenres.push("878", "14", "16");
      } else if (parsedIntent.isHorrorNight) {
        excludedMovieGenres.push("35", "16"); // حجب الكوميديا والرسوم المتحركة في سهرات الرعب
      } else if (isSciFiOnly) {
        excludedMovieGenres.push("16", "14");
      } else {
        excludedMovieGenres.push("16");
      }
      const movieWithoutGenres = excludedMovieGenres.join(",");

      let movieGenres = [];
      parsedIntent.detectedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.movie[g]) movieGenres.push(TMDB_GENRE_IDS.movie[g]);
      });

      if (wantsTimeTravel && !movieGenres.includes(878)) {
        movieGenres.push(878);
      }

      let tvGenres = [];
      parsedIntent.detectedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.tv[g]) tvGenres.push(TMDB_GENRE_IDS.tv[g]);
      });
      if (wantsTimeTravel && !tvGenres.includes(10765)) {
        tvGenres.push(10765);
      }

      const primaryMovieGenre = movieGenres.length > 0 ? movieGenres[0] : null;
      const primaryTvGenre = tvGenres.length > 0 ? tvGenres[0] : null;

      // 🌟 اعتماد حد أدنى صارم للأصوات لسهرات الرعب (1000 صوت) لطرد أحدث الإصدارات المغمورة
      const movieMinVotes = wantsSuperhero
        ? 400
        : specificSportKw
          ? 50
          : userWantsSports
            ? 200
            : isComplexThemeIntent
              ? 250
              : parsedIntent.isHorrorNight
                ? 1000
                : 1500;

      const tvMinVotes = wantsSuperhero
        ? 200
        : specificSportKw
          ? 40
          : userWantsSports
            ? 150
            : isComplexThemeIntent
              ? 100
              : 400;

      if (parsedIntent.targetType === "mixed") {
        const movieParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": movieMinVotes,
          sort_by: "vote_count.desc", // الاعتماد الدائم على vote_count.desc للأفلام الجماهيرية
          without_genres: movieWithoutGenres,
          "primary_release_date.lte": todayStr,
        };

        if (parsedIntent.isHorrorNight && !parsedIntent.wantsClassic) {
          movieParams["primary_release_date.gte"] = "2010-01-01"; // الرعب الجماهيري من 2010 وحتى اليوم
        }

        if (primaryMovieGenre) movieParams.with_genres = primaryMovieGenre;

        if (superheroKeywordParam) {
          movieParams.with_keywords = superheroKeywordParam;
        } else if (complexKeywordParam) {
          movieParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          movieParams.with_keywords = sportsKeywordParam;
        } else if (excludeSuperheroParam) {
          movieParams.without_keywords = excludeSuperheroParam;
        }

        const liveTvParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": tvMinVotes,
          sort_by: "vote_count.desc",
          without_genres: "16",
          "first_air_date.lte": todayStr,
        };
        if (primaryTvGenre) liveTvParams.with_genres = primaryTvGenre;

        if (superheroKeywordParam) {
          liveTvParams.with_keywords = superheroKeywordParam;
        } else if (complexKeywordParam) {
          liveTvParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          liveTvParams.with_keywords = sportsKeywordParam;
        }
        if (tvFantasyExclude) liveTvParams.without_keywords = tvFantasyExclude;

        const animeParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": wantsMagic ? 80 : 40,
          sort_by: "vote_count.desc",
          with_original_language: "ja",
          with_genres: wantsMagic
            ? "10765,16"
            : primaryTvGenre
              ? `${primaryTvGenre},16`
              : "16",
          "first_air_date.lte": todayStr,
        };
        if (wantsMagic) animeParams.with_keywords = "2343|9799";
        else if (complexKeywordParam)
          animeParams.with_keywords = complexKeywordParam;
        else if (sportsKeywordParam)
          animeParams.with_keywords = sportsKeywordParam;
        if (tvFantasyExclude && !wantsMagic)
          animeParams.without_keywords = tvFantasyExclude;

        // في سهرات الرعب نسحب صفحتين لجلب 40 مرشحاً من كبار أفلام الرعب في العقد الأخير
        const moviePromises = parsedIntent.isHorrorNight
          ? [
              axios
                .get("https://api.themoviedb.org/3/discover/movie", {
                  params: { ...movieParams, page: 1 },
                })
                .catch(() => ({ data: { results: [] } })),
              axios
                .get("https://api.themoviedb.org/3/discover/movie", {
                  params: { ...movieParams, page: 2 },
                })
                .catch(() => ({ data: { results: [] } })),
            ]
          : [
              axios
                .get("https://api.themoviedb.org/3/discover/movie", {
                  params: movieParams,
                })
                .catch(() => ({ data: { results: [] } })),
            ];

        const [movieResList, liveTvRes, animeRes] = await Promise.all([
          Promise.all(moviePromises),
          axios
            .get("https://api.themoviedb.org/3/discover/tv", {
              params: liveTvParams,
            })
            .catch(() => ({ data: { results: [] } })),
          axios
            .get("https://api.themoviedb.org/3/discover/tv", {
              params: animeParams,
            })
            .catch(() => ({ data: { results: [] } })),
        ]);

        let movies = [];
        movieResList.forEach((r) => {
          if (r.data?.results) {
            movies.push(
              ...r.data.results.map((m) => ({ ...m, media_type: "movie" })),
            );
          }
        });

        const liveTvs = (liveTvRes.data.results || []).map((t) => ({
          ...t,
          media_type: "tv",
        }));
        const animes = (animeRes.data.results || []).map((a) => ({
          ...a,
          media_type: "anime",
        }));

        candidates = [...candidates, ...movies, ...liveTvs, ...animes];
      } else if (parsedIntent.targetType === "anime") {
        const animeParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": wantsMagic ? 80 : 40,
          sort_by: "vote_count.desc",
          with_original_language: "ja",
          with_genres: wantsMagic
            ? "10765,16"
            : primaryTvGenre
              ? `${primaryTvGenre},16`
              : "16",
          "first_air_date.lte": todayStr,
        };
        if (wantsMagic) animeParams.with_keywords = "2343|9799";
        else if (complexKeywordParam)
          animeParams.with_keywords = complexKeywordParam;
        else if (sportsKeywordParam)
          animeParams.with_keywords = sportsKeywordParam;
        if (tvFantasyExclude && !wantsMagic)
          animeParams.without_keywords = tvFantasyExclude;

        const tvRes = await axios.get(
          "https://api.themoviedb.org/3/discover/tv",
          { params: animeParams },
        );
        candidates = (tvRes.data.results || []).map((a) => ({
          ...a,
          media_type: "anime",
        }));
      } else {
        const isTv = parsedIntent.targetType === "tv";
        const endpoint = isTv
          ? "https://api.themoviedb.org/3/discover/tv"
          : "https://api.themoviedb.org/3/discover/movie";

        const singleParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": isTv ? tvMinVotes : movieMinVotes,
          sort_by: "vote_count.desc", // 🌟 الاعتماد الدائم على vote_count.desc
          [isTv ? "first_air_date.lte" : "primary_release_date.lte"]: todayStr,
        };

        // حصر أفلام سهرة الرعب من عام 2010 وحتى اليوم
        if (!isTv && parsedIntent.isHorrorNight && !parsedIntent.wantsClassic) {
          singleParams["primary_release_date.gte"] = "2010-01-01";
        }

        const targetPrimary = isTv ? primaryTvGenre : primaryMovieGenre;
        if (targetPrimary) singleParams.with_genres = targetPrimary;

        if (superheroKeywordParam) {
          singleParams.with_keywords = superheroKeywordParam;
        } else if (complexKeywordParam) {
          singleParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          singleParams.with_keywords = sportsKeywordParam;
        } else if (excludeSuperheroParam && !isTv) {
          singleParams.without_keywords = excludeSuperheroParam;
        }
        if (!isTv) singleParams.without_genres = movieWithoutGenres;
        if (isTv) {
          singleParams.without_genres = "16";
          if (tvFantasyExclude)
            singleParams.without_keywords = tvFantasyExclude;
        }

        // 🌟 سحب صفحتين لأفلام سهرة الرعب لضمان حضور Talk to Me, Scream, Barbarian, Smile, Evil Dead Rise
        if (!isTv && parsedIntent.isHorrorNight) {
          try {
            const [p1Res, p2Res] = await Promise.all([
              axios.get(endpoint, { params: { ...singleParams, page: 1 } }),
              axios.get(endpoint, { params: { ...singleParams, page: 2 } }),
            ]);
            candidates = [
              ...(p1Res.data.results || []),
              ...(p2Res.data.results || []),
            ].map((it) => ({ ...it, media_type: "movie" }));
          } catch (err) {
            const resData = await axios.get(endpoint, { params: singleParams });
            candidates = (resData.data.results || []).map((it) => ({
              ...it,
              media_type: "movie",
            }));
          }
        } else {
          const resData = await axios.get(endpoint, { params: singleParams });
          candidates = (resData.data.results || []).map((it) => ({
            ...it,
            media_type: parsedIntent.targetType,
          }));
        }
      }
    }

    // 7. فلترة الأعمال المستقبلية محلياً
    candidates = candidates.filter((item) => {
      const relDate = item.release_date || item.first_air_date;
      return !relDate || relDate <= todayStr;
    });

    // 8. استبعاد ما شاهده هذا المستخدم حصراً من جدول reviews
    if (req.user && req.user.id && candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id).filter(Boolean);
      const watchedRes = await db.query(
        "SELECT tmdb_id FROM reviews WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
        [req.user.id, candidateIds],
      );
      const watchedIds = new Set(watchedRes.rows.map((r) => r.tmdb_id));
      candidates = candidates.filter((c) => !watchedIds.has(c.id));
    }

    // إزالة التكرارات
    const uniqueCandidatesMap = new Map();
    candidates.forEach((c) => {
      if (!uniqueCandidatesMap.has(c.id)) {
        uniqueCandidatesMap.set(c.id, c);
      }
    });
    candidates = Array.from(uniqueCandidatesMap.values());

    candidates = candidates.map((c) => {
      const textualGenres = (c.genre_ids || [])
        .map((id) => TMDB_ID_TO_NAME[id] || "")
        .filter(Boolean);
      return { ...c, genres: textualGenres };
    });

    // 9. مرحلة الفرز والتقييم المحلي الشامل
    const resolvedAnchorName = anchorMedia
      ? anchorMedia.title || anchorMedia.name
      : null;
    const rankedResults = CindromeEngine.scoreAndRank(
      candidates,
      parsedIntent,
      userProfileStats,
      resolvedAnchorName,
      userReviewsCount,
    );

    // 10. التوزيع واختيار أفضل 4 كروت مؤهلة
    let topResultsRaw = [];
    const eligibleCandidates = rankedResults.filter(
      (item) => item.finalScore > 30,
    );

    if (parsedIntent.targetType === "mixed") {
      const topMovies = eligibleCandidates.filter(
        (item) => item.media_type === "movie",
      );
      const topSeries = eligibleCandidates.filter(
        (item) => item.media_type === "tv",
      );
      const topAnimes = eligibleCandidates.filter(
        (item) => item.media_type === "anime",
      );

      topResultsRaw.push(...topMovies.slice(0, 2));
      topResultsRaw.push(...topSeries.slice(0, 1));
      topResultsRaw.push(...topAnimes.slice(0, 1));

      if (topResultsRaw.length < 4) {
        for (const item of eligibleCandidates) {
          if (topResultsRaw.length >= 4) break;
          if (!topResultsRaw.some((p) => p.id === item.id)) {
            topResultsRaw.push(item);
          }
        }
      }
      topResultsRaw.sort((a, b) => b.finalScore - a.finalScore);
    } else if (parsedIntent.targetType === "movie") {
      // إعفاء سهرات الرعب والسوبرهيرو والرياضة من تقسيم الحقب الإلزامي وأخذ أفضل 4 أعمال حديثة مؤهلة
      if (
        wantsSuperhero ||
        specificSportKw ||
        userWantsSports ||
        isComplexThemeIntent ||
        parsedIntent.isHorrorNight
      ) {
        topResultsRaw = eligibleCandidates.slice(0, 4);
      } else if (!parsedIntent.wantsClassic) {
        const getYear = (it) => {
          const d = it.release_date || it.first_air_date || "";
          return d ? parseInt(d.split("-")[0], 10) : 0;
        };

        const classics = eligibleCandidates.filter((it) => getYear(it) < 2000);
        const moderns = eligibleCandidates.filter((it) => getYear(it) >= 2000);

        topResultsRaw.push(...classics.slice(0, 2));
        topResultsRaw.push(...moderns.slice(0, 2));

        if (topResultsRaw.length < 4) {
          for (const item of eligibleCandidates) {
            if (topResultsRaw.length >= 4) break;
            if (!topResultsRaw.some((p) => p.id === item.id)) {
              topResultsRaw.push(item);
            }
          }
        }
        topResultsRaw.sort((a, b) => b.finalScore - a.finalScore);
      } else {
        topResultsRaw = eligibleCandidates.slice(0, 4);
      }
    } else {
      topResultsRaw = eligibleCandidates.slice(0, 4);
    }

    // فحص حالة الـ Watchlist للأعمال الأربعة للمستخدم الحالي
    let userWatchlistSet = new Set();
    if (req.user && req.user.id && topResultsRaw.length > 0) {
      const topIds = topResultsRaw.map((item) => item.id);
      try {
        const wlRes = await db.query(
          "SELECT tmdb_id FROM watchlist WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
          [req.user.id, topIds],
        );
        userWatchlistSet = new Set(wlRes.rows.map((r) => Number(r.tmdb_id)));
      } catch (wlErr) {
        console.error("Watchlist check error in Drome:", wlErr.message);
      }
    }

    const formattedResults = topResultsRaw.map((item) => {
      let badge = "MOVIE";
      if (
        item.media_type === "anime" ||
        (item.original_language === "ja" && item.genre_ids?.includes(16))
      ) {
        badge = "ANIME";
      } else if (item.media_type === "tv" || item.first_air_date) {
        badge = "SERIES";
      }
      const card = formatCard(item, badge);
      card.inWatchlist = userWatchlistSet.has(Number(item.id));
      return card;
    });

    // 11. صياغة الرد النهائي
    const responseText = CindromeEngine.generateResponseText(
      parsedIntent,
      formattedResults.length,
      false,
      resolvedAnchorName,
    );

    return res.json({
      success: true,
      message: responseText,
      results: formattedResults,
    });
  } catch (error) {
    console.error("Drome Controller Error:", error);
    return res.status(500).json({
      error: "Sorry, I ran into a technical issue. Please try again.",
    });
  }
};

export default processChat;
