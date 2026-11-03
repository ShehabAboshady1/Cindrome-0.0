// controllers/dromeController.js
import db from "../config/db.js";
import axios from "axios";
import { CindromeEngine, TMDB_GENRE_IDS } from "../services/cindromeEngine.js";
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

    // 5. سحب سلة المرشحين الموسعة من TMDB
    let candidates = [];
    const todayStr = new Date().toISOString().split("T")[0];

    if (anchorMedia) {
      const actualMediaType =
        anchorMedia.media_type || (anchorMedia.first_air_date ? "tv" : "movie");
      const recEndpoint = `https://api.themoviedb.org/3/${actualMediaType}/${anchorMedia.id}/recommendations`;

      const recRes = await axios.get(recEndpoint, {
        params: { api_key: TMDB_API_KEY, page: 1 },
      });
      candidates = recRes.data.results || [];

      if (parsedIntent.targetType === "anime") {
        candidates = candidates.filter((c) => c.original_language === "ja");
      }
    }

    if (candidates.length < 5) {
      const wantsSuperhero = parsedIntent.detectedKeywords.some(
        (k) => k.name === "superhero",
      );
      const excludeSuperheroParam = wantsSuperhero ? null : "9715";

      const isSciFiOnly =
        parsedIntent.detectedGenres.includes("scifi") &&
        !parsedIntent.detectedGenres.includes("fantasy");
      const tvFantasyExclude = isSciFiOnly
        ? "2343,33443,9799,12564,4152,12554,9663"
        : null;

      let movieGenres = [];
      parsedIntent.detectedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.movie[g]) movieGenres.push(TMDB_GENRE_IDS.movie[g]);
      });

      let tvGenres = [];
      parsedIntent.detectedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.tv[g]) tvGenres.push(TMDB_GENRE_IDS.tv[g]);
      });

      const primaryMovieGenre = movieGenres.length > 0 ? movieGenres[0] : null;
      const primaryTvGenre = tvGenres.length > 0 ? tvGenres[0] : null;

      if (parsedIntent.targetType === "mixed") {
        const movieParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": 1500,
          sort_by: "vote_count.desc",
          without_genres: isSciFiOnly ? "16,14" : "16",
          "primary_release_date.lte": todayStr,
        };
        if (primaryMovieGenre) movieParams.with_genres = primaryMovieGenre;
        if (excludeSuperheroParam)
          movieParams.without_keywords = excludeSuperheroParam;

        const liveTvParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": 400,
          sort_by: "vote_count.desc",
          without_genres: "16",
          "first_air_date.lte": todayStr,
        };
        if (primaryTvGenre) liveTvParams.with_genres = primaryTvGenre;
        if (tvFantasyExclude) liveTvParams.without_keywords = tvFantasyExclude;

        const animeParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": 200,
          sort_by: "vote_count.desc",
          with_original_language: "ja",
          with_genres: primaryTvGenre ? `${primaryTvGenre},16` : "16",
          "first_air_date.lte": todayStr,
        };
        if (tvFantasyExclude) animeParams.without_keywords = tvFantasyExclude;

        const [movieRes, liveTvRes, animeRes] = await Promise.all([
          axios
            .get("https://api.themoviedb.org/3/discover/movie", {
              params: movieParams,
            })
            .catch(() => ({ data: { results: [] } })),
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

        const movies = (movieRes.data.results || []).map((m) => ({
          ...m,
          media_type: "movie",
        }));
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
          "vote_count.gte": 200,
          sort_by: "vote_count.desc",
          with_original_language: "ja",
          with_genres: primaryTvGenre ? `${primaryTvGenre},16` : "16",
          "first_air_date.lte": todayStr,
        };
        if (tvFantasyExclude) animeParams.without_keywords = tvFantasyExclude;

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
          "vote_count.gte": isTv ? 400 : 1500,
          sort_by: "vote_count.desc",
          [isTv ? "first_air_date.lte" : "primary_release_date.lte"]: todayStr,
        };

        const targetPrimary = isTv ? primaryTvGenre : primaryMovieGenre;
        if (targetPrimary) singleParams.with_genres = targetPrimary;
        if (excludeSuperheroParam && !isTv)
          singleParams.without_keywords = excludeSuperheroParam;
        if (!isTv && isSciFiOnly) singleParams.without_genres = "16,14";
        if (isTv) {
          singleParams.without_genres = "16";
          if (tvFantasyExclude)
            singleParams.without_keywords = tvFantasyExclude;
        }

        const resData = await axios.get(endpoint, { params: singleParams });
        candidates = (resData.data.results || []).map((it) => ({
          ...it,
          media_type: parsedIntent.targetType,
        }));
      }
    }

    // 6. فلترة الأعمال المستقبلية محلياً
    candidates = candidates.filter((item) => {
      const relDate = item.release_date || item.first_air_date;
      return !relDate || relDate <= todayStr;
    });

    // 7. استبعاد ما شاهده هذا المستخدم حصراً من جدول reviews
    if (req.user && req.user.id && candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id).filter(Boolean);
      const watchedRes = await db.query(
        "SELECT tmdb_id FROM reviews WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
        [req.user.id, candidateIds],
      );
      const watchedIds = new Set(watchedRes.rows.map((r) => r.tmdb_id));
      candidates = candidates.filter((c) => !watchedIds.has(c.id));
    }

    candidates = candidates.map((c) => {
      const textualGenres = (c.genre_ids || [])
        .map((id) => TMDB_ID_TO_NAME[id] || "")
        .filter(Boolean);
      return { ...c, genres: textualGenres };
    });

    // 8. مرحلة الفرز والتقييم المحلي الشامل
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

    // 9. التوزيع العادل للمقاعد وتطبيق Era Slotting للأفلام
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
      // نظام توازن الحقب الزمنية (Era Slotting): مقعدان كلاسيكيان + مقعدان حديثان
      if (!parsedIntent.wantsClassic) {
        const getYear = (it) => {
          const d = it.release_date || it.first_air_date || "";
          return d ? parseInt(d.split("-")[0], 10) : 0;
        };

        const classics = eligibleCandidates.filter((it) => getYear(it) < 2000);
        const moderns = eligibleCandidates.filter((it) => getYear(it) >= 2000);

        topResultsRaw.push(...classics.slice(0, 2));
        topResultsRaw.push(...moderns.slice(0, 2));

        // تعويض النقص إن لم تتوفر أعمال كافية في إحدى الحقبتين
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
      return formatCard(item, badge);
    });

    // 10. صياغة الرد النهائي
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
