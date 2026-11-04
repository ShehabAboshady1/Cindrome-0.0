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
  10762: "Kids",
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

    // 🌟 حماية تامة من السقوط في رسالة الـ Onboarding عند التعرف على أي نية محددة
    const hasSpecificUserIntent =
      parsedIntent.detectedGenres.length > 0 ||
      parsedIntent.detectedKeywords.length > 0 ||
      parsedIntent.isKorean ||
      parsedIntent.hasTwistKeywords ||
      parsedIntent.isUnderdog ||
      parsedIntent.isComfortComedy ||
      parsedIntent.isHistoricalWar ||
      parsedIntent.isTrueCrimeDoc ||
      parsedIntent.isFamilyAnimation ||
      parsedIntent.isCyberpunk ||
      parsedIntent.isPhilosophicalSciFi ||
      parsedIntent.isHeistRobbery;

    if (
      req.user &&
      userReviewsCount < 3 &&
      !anchorMedia &&
      !hasSpecificUserIntent
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

    // 5. رصد النوايا الثيماتية وحالات المود
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
      (parsedIntent.detectedGenres.includes("sports") || !!specificSportKw) &&
      !parsedIntent.isUnderdog;

    const wantsTimeTravel =
      parsedIntent.detectedKeywords.some((k) => k.name === "time travel") ||
      /\b(time travel|time loop|timeline|wormhole)\b/i.test(cleanPrompt);

    const wantsPlotTwist =
      parsedIntent.detectedKeywords.some((k) => k.name === "plot twist") ||
      parsedIntent.hasTwistKeywords ||
      /\b(plot twists?|twist ending|crazy plot twists?|can'?t predict|unpredictable|mind[- ]blowing)\b/i.test(
        cleanPrompt,
      );

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

    const wantsPsychological =
      parsedIntent.isPsychologicalThriller ||
      parsedIntent.detectedKeywords.some(
        (k) => k.name === "psychological thriller",
      ) ||
      /\b(psychological thriller|mess with my head|mindfuck|mind game)\b/i.test(
        cleanPrompt,
      );

    const isRomComIntent =
      parsedIntent.isRomCom ||
      parsedIntent.detectedKeywords.some((k) => k.name === "rom-com") ||
      (/\b(sweet|light|lift my mood|feel[- ]good|rom-com|romcom|romantic comedy)\b/i.test(
        cleanPrompt,
      ) &&
        (parsedIntent.detectedGenres.includes("romance") ||
          parsedIntent.detectedGenres.includes("comedy")));

    const isHistoricalWarIntent =
      parsedIntent.isHistoricalWar ||
      parsedIntent.detectedKeywords.some((k) => k.name === "historical war") ||
      /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war)\b/i.test(
        cleanPrompt,
      );

    const isTrueCrimeDocIntent =
      parsedIntent.isTrueCrimeDoc ||
      parsedIntent.detectedKeywords.some((k) => k.name === "true crime") ||
      /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|unsolved mysteries)\b/i.test(
        cleanPrompt,
      );

    const isKoreanIntent =
      parsedIntent.isKorean ||
      /\b(korean|k-drama|kdrama|k drama|south korea)\b/i.test(cleanPrompt);

    const isFamilyAnimationIntent =
      parsedIntent.isFamilyAnimation ||
      (parsedIntent.detectedGenres.includes("animation") &&
        parsedIntent.detectedGenres.includes("family")) ||
      (/\b(animated|animation)\b/i.test(cleanPrompt) &&
        /\b(family|cozy|kids)\b/i.test(cleanPrompt));

    const isCyberpunkIntent =
      parsedIntent.isCyberpunk ||
      parsedIntent.detectedKeywords.some(
        (k) => k.name === "cyberpunk" || k.name === "dystopia",
      ) ||
      /\b(cyberpunk|cyber-punk|dystopian?|dystopia|dark futuristic|futuristic city)\b/i.test(
        cleanPrompt,
      );

    const isPhilosophicalSciFiIntent =
      !isCyberpunkIntent &&
      (parsedIntent.isPhilosophicalSciFi ||
        (/\b(think about life|philosophical|existential|meaning of life|human condition)\b/i.test(
          cleanPrompt,
        ) &&
          /\b(space|universe|cosmos|sci-fi|stars)\b/i.test(cleanPrompt)));

    const isComfortComedyIntent =
      parsedIntent.isComfortComedy ||
      (parsedIntent.isTiredMood &&
        parsedIntent.detectedGenres.includes("comedy"));

    const isHeistRobberyIntent =
      parsedIntent.isHeistRobbery ||
      parsedIntent.detectedKeywords.some((k) => k.name === "heist") ||
      /\b(plan (?:a )?robbery|big robbery|bank robbery|robbery|heist|bank heist|big heist|steal money|caper|vault|safecracker)\b/i.test(
        cleanPrompt,
      );

    const isCrimeHeist =
      !isTrueCrimeDocIntent &&
      (isHeistRobberyIntent ||
        parsedIntent.isCrimeHeist ||
        parsedIntent.detectedGenres.includes("crime") ||
        parsedIntent.detectedKeywords.some(
          (k) => k.name === "organized crime",
        ) ||
        /\b(organized crime|mafia|gangster|mobster|mobsters|crime syndicate|underworld)\b/i.test(
          cleanPrompt,
        ));

    // 🌟 رصد نية الصعود والتحدي والنجاح من الصفر
    const isUnderdogIntent =
      parsedIntent.isUnderdog ||
      parsedIntent.detectedKeywords.some((k) => k.name === "underdog") ||
      /\b(starting from zero|start from zero|starting from nothing|rags to riches|underdog|success story|winning against all odds|zero to hero)\b/i.test(
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

      if (isSitcomIntent || isComfortComedyIntent) {
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

    // جامع روائع الكوميديا والسيتكوم المتوازن
    if (
      (isSitcomIntent || isComfortComedyIntent) &&
      parsedIntent.targetType !== "anime"
    ) {
      try {
        const harvestPromises = [];

        if (
          parsedIntent.targetType === "tv" ||
          parsedIntent.targetType === "mixed"
        ) {
          harvestPromises.push(
            axios
              .get("https://api.themoviedb.org/3/discover/tv", {
                params: {
                  api_key: TMDB_API_KEY,
                  with_genres: "35",
                  without_genres: "18,16,10765,10768,10762",
                  "vote_count.gte": 800,
                  sort_by: "popularity.desc",
                  page: 1,
                  "first_air_date.lte": todayStr,
                },
              })
              .then((res) =>
                (res.data?.results || []).map((t) => ({
                  ...t,
                  media_type: "tv",
                })),
              ),
            axios
              .get("https://api.themoviedb.org/3/discover/tv", {
                params: {
                  api_key: TMDB_API_KEY,
                  with_genres: "35",
                  without_genres: "18,16,10765,10768,10762",
                  "vote_count.gte": 1500,
                  sort_by: "vote_average.desc",
                  page: 1,
                  "first_air_date.lte": todayStr,
                },
              })
              .then((res) =>
                (res.data?.results || []).map((t) => ({
                  ...t,
                  media_type: "tv",
                })),
              ),
          );
        }

        if (
          parsedIntent.targetType === "movie" ||
          parsedIntent.targetType === "mixed"
        ) {
          harvestPromises.push(
            axios
              .get("https://api.themoviedb.org/3/discover/movie", {
                params: {
                  api_key: TMDB_API_KEY,
                  with_genres: "35",
                  without_genres: "18,10752,36,27,99,14,16",
                  without_keywords: "9716",
                  "vote_count.gte": 1000,
                  sort_by: "vote_count.desc",
                  page: 1,
                  "primary_release_date.lte": todayStr,
                },
              })
              .then((res) =>
                (res.data?.results || []).map((m) => ({
                  ...m,
                  media_type: "movie",
                })),
              ),
            axios
              .get("https://api.themoviedb.org/3/discover/movie", {
                params: {
                  api_key: TMDB_API_KEY,
                  with_genres: "35",
                  without_genres: "18,10752,36,27,99,14,16",
                  without_keywords: "9716",
                  "vote_count.gte": 800,
                  sort_by: "popularity.desc",
                  page: 1,
                  "primary_release_date.lte": todayStr,
                },
              })
              .then((res) =>
                (res.data?.results || []).map((m) => ({
                  ...m,
                  media_type: "movie",
                })),
              ),
          );
        }

        const harvestedResults = await Promise.all(harvestPromises);
        harvestedResults.forEach((group) => {
          candidates.push(...group);
        });
      } catch (sitcomErr) {
        console.error("Comfort comedy harvesting error:", sitcomErr.message);
      }
    }

    // جامع مسلسلات الجرائم الحقيقية المباشر
    if (
      candidates.length < 5 &&
      isTrueCrimeDocIntent &&
      parsedIntent.targetType !== "anime"
    ) {
      const docQueries = [
        "true crime",
        "unsolved mysteries",
        "serial killer",
        "murder documentary",
      ];
      const docPromises = docQueries.map((q) =>
        axios
          .get("https://api.themoviedb.org/3/search/tv", {
            params: {
              api_key: TMDB_API_KEY,
              query: q,
              page: 1,
              include_adult: false,
            },
          })
          .catch(() => ({ data: { results: [] } })),
      );

      const docResponses = await Promise.all(docPromises);
      let docHarvest = [];
      docResponses.forEach((res) => {
        if (res.data?.results) {
          docHarvest.push(...res.data.results);
        }
      });

      const harvestedSeries = docHarvest
        .filter((t) => (t.vote_count || 0) >= 30)
        .map((t) => ({ ...t, media_type: "tv" }));

      candidates = [...candidates, ...harvestedSeries];
    }

    // جامع مسلسلات الغموض والتويستات الكورية المباشر
    if (
      candidates.length < 5 &&
      isKoreanIntent &&
      (wantsPlotTwist || parsedIntent.hasTwistKeywords)
    ) {
      const kTwistQueries = [
        "Signal",
        "Flower of Evil",
        "Beyond Evil",
        "Mouse",
        "Stranger",
        "Blind",
      ];
      const kPromises = kTwistQueries.map((q) =>
        axios
          .get("https://api.themoviedb.org/3/search/tv", {
            params: {
              api_key: TMDB_API_KEY,
              query: q,
              page: 1,
              include_adult: false,
            },
          })
          .catch(() => ({ data: { results: [] } })),
      );

      const kResponses = await Promise.all(kPromises);
      let kHarvest = [];
      kResponses.forEach((res) => {
        if (res.data?.results) {
          kHarvest.push(...res.data.results);
        }
      });

      const harvestedKShows = kHarvest
        .filter(
          (t) => t.original_language === "ko" && (t.vote_count || 0) >= 20,
        )
        .map((t) => ({ ...t, media_type: "tv" }));

      candidates = [...candidates, ...harvestedKShows];
    }

    // 🌟 جامع روائع الصعود والتحدي من الصفر (Underdog & Rags to Riches Harvester)
    if (
      candidates.length < 5 &&
      isUnderdogIntent &&
      parsedIntent.targetType !== "anime"
    ) {
      const underdogQueries = [
        { q: "The Pursuit of Happyness", type: "movie" },
        { q: "Whiplash", type: "movie" },
        { q: "Rocky", type: "movie" },
        { q: "Creed", type: "movie" },
        { q: "Ford v Ferrari", type: "movie" },
        { q: "Moneyball", type: "movie" },
        { q: "Cobra Kai", type: "tv" },
        { q: "Slumdog Millionaire", type: "movie" },
      ];

      const uPromises = underdogQueries.map((item) => {
        const endpoint =
          parsedIntent.targetType === "movie"
            ? "https://api.themoviedb.org/3/search/movie"
            : parsedIntent.targetType === "tv"
              ? "https://api.themoviedb.org/3/search/tv"
              : `https://api.themoviedb.org/3/search/${item.type}`;

        return axios
          .get(endpoint, {
            params: {
              api_key: TMDB_API_KEY,
              query: item.q,
              page: 1,
              include_adult: false,
            },
          })
          .catch(() => ({ data: { results: [] } }));
      });

      const uResponses = await Promise.all(uPromises);
      let uHarvest = [];
      uResponses.forEach((res, index) => {
        if (res.data?.results) {
          const expectedType =
            parsedIntent.targetType === "mixed"
              ? underdogQueries[index].type
              : parsedIntent.targetType;
          uHarvest.push(
            ...res.data.results.map((it) => ({
              ...it,
              media_type: it.media_type || expectedType,
            })),
          );
        }
      });

      const harvestedUnderdogs = uHarvest.filter(
        (it) => (it.vote_count || 0) >= 100,
      );
      candidates = [...candidates, ...harvestedUnderdogs];
    }

    // استدعاء TMDB Discover مع ضبط الكلمات المفتاحية
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

      const heistKeywordParam = isHeistRobberyIntent
        ? String(TMDB_THEME_IDS.heist || "10051|6492|10292")
        : null;

      const crimeHeistKeywordParam = isCrimeHeist
        ? String(TMDB_THEME_IDS.crimeHeist || "10051|6492|10292|10391|242")
        : null;

      const psychologicalKeywordParam = wantsPsychological
        ? String(TMDB_THEME_IDS.psychologicalThriller || "10714|12565|9663")
        : null;

      const romcomKeywordParam = isRomComIntent
        ? String(TMDB_THEME_IDS.romcom || "9799|158718|3133")
        : null;

      const historicalWarKeywordParam = isHistoricalWarIntent
        ? String(TMDB_THEME_IDS.historicalWar || "11162|233|210103")
        : null;

      const trueCrimeKeywordParam = isTrueCrimeDocIntent
        ? String(TMDB_THEME_IDS.trueCrime || "10714|9882|10303")
        : null;

      const cyberpunkKeywordParam = isCyberpunkIntent
        ? String(TMDB_THEME_IDS.cyberpunk || "12190|4565|2853|156395")
        : null;

      const philosophicalSciFiKeywordParam = isPhilosophicalSciFiIntent
        ? String(TMDB_THEME_IDS.philosophicalSciFi || "10090|310|156395")
        : null;

      // 🌟 وسوم الصعود والتحدي من الصفر
      const underdogKeywordParam = isUnderdogIntent
        ? String(TMDB_THEME_IDS.underdog || "9882|10714|1803")
        : null;

      const wantsSciFi =
        parsedIntent.detectedGenres.includes("scifi") ||
        wantsTimeTravel ||
        isCyberpunkIntent ||
        isPhilosophicalSciFiIntent;
      const isSciFiOnly =
        wantsSciFi &&
        !parsedIntent.detectedGenres.includes("fantasy") &&
        !wantsMagic;
      const tvFantasyExclude = isSciFiOnly
        ? "2343,33443,9799,12564,4152,12554,9663"
        : null;

      let excludedMovieGenres = [];
      if (!wantsSciFi && (userWantsSports || isHistoricalWarIntent)) {
        excludedMovieGenres.push("878", "14", "16");
      } else if (parsedIntent.isHorrorNight) {
        excludedMovieGenres.push("35", "16");
      } else if (isHeistRobberyIntent) {
        excludedMovieGenres.push("878", "14", "16", "27");
      } else if (isCrimeHeist) {
        if (!wantsSciFi) excludedMovieGenres.push("878");
        excludedMovieGenres.push("16", "14");
      } else if (isRomComIntent) {
        excludedMovieGenres.push("10752", "36", "27", "16");
      } else if (isFamilyAnimationIntent) {
        excludedMovieGenres.push("27", "80", "53");
      } else if (isTrueCrimeDocIntent) {
        excludedMovieGenres.push("16", "878", "14", "35");
      } else if (isCyberpunkIntent) {
        excludedMovieGenres.push("10751", "35");
      } else if (isPhilosophicalSciFiIntent) {
        excludedMovieGenres.push("35", "16");
      } else if (isComfortComedyIntent) {
        excludedMovieGenres.push("18", "10752", "36", "27", "99", "14", "16");
      } else if (isUnderdogIntent) {
        // حجب الرعب والفانتازيا في قصص الصعود والتحدي الواقعية
        excludedMovieGenres.push("27", "14", "16");
      } else if (wantsPsychological) {
        excludedMovieGenres.push("16", "35");
      } else if (isSciFiOnly) {
        excludedMovieGenres.push("16", "14");
      } else {
        excludedMovieGenres.push("16");
      }
      const movieWithoutGenres = excludedMovieGenres.join(",");

      let withoutKeywordsList = [];
      if (excludeSuperheroParam)
        withoutKeywordsList.push(excludeSuperheroParam);
      if (isRomComIntent || isComfortComedyIntent)
        withoutKeywordsList.push("9716");
      if (isFamilyAnimationIntent && !/\banime\b/i.test(cleanPrompt)) {
        withoutKeywordsList.push("210024");
      }
      const withoutKeywordsParam =
        withoutKeywordsList.length > 0 ? withoutKeywordsList.join(",") : null;

      let movieGenres = [];
      parsedIntent.detectedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.movie[g]) movieGenres.push(TMDB_GENRE_IDS.movie[g]);
      });

      if ((isCrimeHeist || isHeistRobberyIntent) && !movieGenres.includes(80)) {
        movieGenres.unshift(80);
      }

      if (
        wantsPsychological &&
        !movieGenres.includes(53) &&
        !movieGenres.includes(9648)
      ) {
        movieGenres.unshift(53);
      }

      if (
        (wantsTimeTravel || isCyberpunkIntent || isPhilosophicalSciFiIntent) &&
        !movieGenres.includes(878)
      ) {
        movieGenres.unshift(878);
      }

      if (isUnderdogIntent && !movieGenres.includes(18)) {
        movieGenres.unshift(18);
      }

      let tvGenres = [];
      parsedIntent.detectedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.tv[g]) tvGenres.push(TMDB_GENRE_IDS.tv[g]);
      });
      if ((isCrimeHeist || isHeistRobberyIntent) && !tvGenres.includes(80)) {
        tvGenres.unshift(80);
      }
      if (wantsPsychological && !tvGenres.includes(9648)) {
        tvGenres.unshift(9648);
      }
      if (
        (wantsTimeTravel || isCyberpunkIntent || isPhilosophicalSciFiIntent) &&
        !tvGenres.includes(10765)
      ) {
        tvGenres.unshift(10765);
      }

      if (isKoreanIntent) {
        if (wantsPlotTwist || parsedIntent.hasTwistKeywords) {
          if (!tvGenres.includes(9648)) tvGenres.push(9648);
          if (!tvGenres.includes(80)) tvGenres.push(80);
          if (!tvGenres.includes(18)) tvGenres.push(18);
        } else {
          if (!tvGenres.includes(9648)) tvGenres.push(9648);
          if (!tvGenres.includes(80)) tvGenres.push(80);
        }
      }

      let primaryMovieGenre = movieGenres.length > 0 ? movieGenres[0] : null;
      let primaryTvGenre = tvGenres.length > 0 ? tvGenres.join("|") : null;

      if (isComfortComedyIntent) {
        primaryMovieGenre = "35";
        primaryTvGenre = "35";
      }

      if (isRomComIntent) {
        primaryMovieGenre = "35,10749";
      }

      if (isHistoricalWarIntent) {
        primaryMovieGenre = "10752|36";
        primaryTvGenre = "10768|36";
      }

      if (isTrueCrimeDocIntent) {
        primaryMovieGenre = "99";
        primaryTvGenre = "99";
      }

      if (isFamilyAnimationIntent) {
        primaryMovieGenre = "16,10751";
        primaryTvGenre = "16,10751";
      }

      if (isUnderdogIntent) {
        primaryMovieGenre = "18";
      }

      const movieMinVotes = wantsSuperhero
        ? 400
        : specificSportKw
          ? 50
          : userWantsSports
            ? 200
            : isComplexThemeIntent
              ? 250
              : isRomComIntent
                ? 500
                : isComfortComedyIntent
                  ? 800
                  : isFamilyAnimationIntent
                    ? 600
                    : isHistoricalWarIntent
                      ? 400
                      : isTrueCrimeDocIntent
                        ? 80
                        : isKoreanIntent
                          ? 60
                          : isHeistRobberyIntent || isUnderdogIntent
                            ? 350
                            : isCyberpunkIntent || isPhilosophicalSciFiIntent
                              ? 400
                              : wantsPsychological
                                ? 400
                                : isCrimeHeist
                                  ? 300
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
              : isTrueCrimeDocIntent
                ? 50
                : isKoreanIntent
                  ? 30
                  : isComfortComedyIntent
                    ? 400
                    : isCrimeHeist
                      ? 200
                      : 400;

      if (parsedIntent.targetType === "mixed") {
        const movieParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": movieMinVotes,
          sort_by: "vote_count.desc",
          without_genres: movieWithoutGenres,
          "primary_release_date.lte": todayStr,
        };

        if (isKoreanIntent) {
          movieParams.with_original_language = "ko";
          movieParams.with_origin_country = "KR";
        }

        if (parsedIntent.isHorrorNight && !parsedIntent.wantsClassic) {
          movieParams["primary_release_date.gte"] = "2010-01-01";
        }

        if (wantsPsychological) {
          movieParams["vote_average.gte"] = 7.0;
        }

        if (primaryMovieGenre) movieParams.with_genres = primaryMovieGenre;

        if (superheroKeywordParam) {
          movieParams.with_keywords = superheroKeywordParam;
        } else if (underdogKeywordParam) {
          movieParams.with_keywords = underdogKeywordParam;
        } else if (heistKeywordParam) {
          movieParams.with_keywords = heistKeywordParam;
        } else if (cyberpunkKeywordParam) {
          movieParams.with_keywords = cyberpunkKeywordParam;
        } else if (philosophicalSciFiKeywordParam) {
          movieParams.with_keywords = philosophicalSciFiKeywordParam;
        } else if (trueCrimeKeywordParam) {
          movieParams.with_keywords = trueCrimeKeywordParam;
        } else if (historicalWarKeywordParam) {
          movieParams.with_keywords = historicalWarKeywordParam;
        } else if (romcomKeywordParam) {
          movieParams.with_keywords = romcomKeywordParam;
        } else if (psychologicalKeywordParam) {
          movieParams.with_keywords = psychologicalKeywordParam;
        } else if (crimeHeistKeywordParam) {
          movieParams.with_keywords = crimeHeistKeywordParam;
        } else if (complexKeywordParam) {
          movieParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          movieParams.with_keywords = sportsKeywordParam;
        }

        if (withoutKeywordsParam) {
          movieParams.without_keywords = withoutKeywordsParam;
        }

        const tvWithoutGenres = isFamilyAnimationIntent
          ? "27,53,80"
          : isComfortComedyIntent
            ? "18,16,10765,10768,10762"
            : "16";

        const liveTvParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": tvMinVotes,
          sort_by: "vote_count.desc",
          without_genres: tvWithoutGenres,
          "first_air_date.lte": todayStr,
        };

        if (isKoreanIntent) {
          liveTvParams.with_original_language = "ko";
          liveTvParams.with_origin_country = "KR";
        }

        if (primaryTvGenre) liveTvParams.with_genres = primaryTvGenre;

        if (superheroKeywordParam) {
          liveTvParams.with_keywords = superheroKeywordParam;
        } else if (underdogKeywordParam) {
          liveTvParams.with_keywords = underdogKeywordParam;
        } else if (heistKeywordParam) {
          liveTvParams.with_keywords = heistKeywordParam;
        } else if (cyberpunkKeywordParam) {
          liveTvParams.with_keywords = cyberpunkKeywordParam;
        } else if (philosophicalSciFiKeywordParam) {
          liveTvParams.with_keywords = philosophicalSciFiKeywordParam;
        } else if (trueCrimeKeywordParam) {
          liveTvParams.with_keywords = trueCrimeKeywordParam;
        } else if (historicalWarKeywordParam) {
          liveTvParams.with_keywords = historicalWarKeywordParam;
        } else if (psychologicalKeywordParam) {
          liveTvParams.with_keywords = psychologicalKeywordParam;
        } else if (crimeHeistKeywordParam) {
          liveTvParams.with_keywords = crimeHeistKeywordParam;
        } else if (complexKeywordParam) {
          liveTvParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          liveTvParams.with_keywords = sportsKeywordParam;
        }
        if (tvFantasyExclude) liveTvParams.without_keywords = tvFantasyExclude;

        const animeParams = {
          api_key: TMDB_API_KEY,
          page: 1,
          "vote_count.gte": wantsMagic ? 80 : 300,
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
        else if (cyberpunkKeywordParam)
          animeParams.with_keywords = cyberpunkKeywordParam;
        else if (complexKeywordParam)
          animeParams.with_keywords = complexKeywordParam;
        else if (sportsKeywordParam)
          animeParams.with_keywords = sportsKeywordParam;
        if (tvFantasyExclude && !wantsMagic)
          animeParams.without_keywords = tvFantasyExclude;

        const moviePromises =
          parsedIntent.isHorrorNight ||
          isCrimeHeist ||
          isHeistRobberyIntent ||
          wantsPsychological ||
          isRomComIntent ||
          isHistoricalWarIntent ||
          isTrueCrimeDocIntent ||
          isFamilyAnimationIntent ||
          isCyberpunkIntent ||
          isComfortComedyIntent ||
          isPhilosophicalSciFiIntent ||
          isUnderdogIntent
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

        const tvPromises =
          isTrueCrimeDocIntent ||
          isKoreanIntent ||
          isCyberpunkIntent ||
          isComfortComedyIntent ||
          wantsPlotTwist ||
          isUnderdogIntent
            ? [
                axios
                  .get("https://api.themoviedb.org/3/discover/tv", {
                    params: { ...liveTvParams, page: 1 },
                  })
                  .catch(() => ({ data: { results: [] } })),
                axios
                  .get("https://api.themoviedb.org/3/discover/tv", {
                    params: { ...liveTvParams, page: 2 },
                  })
                  .catch(() => ({ data: { results: [] } })),
              ]
            : [
                axios
                  .get("https://api.themoviedb.org/3/discover/tv", {
                    params: liveTvParams,
                  })
                  .catch(() => ({ data: { results: [] } })),
              ];

        const animePromise =
          isComfortComedyIntent ||
          (isKoreanIntent && wantsPlotTwist) ||
          isUnderdogIntent
            ? Promise.resolve({ data: { results: [] } })
            : axios
                .get("https://api.themoviedb.org/3/discover/tv", {
                  params: animeParams,
                })
                .catch(() => ({ data: { results: [] } }));

        const [movieResList, tvResList, animeRes] = await Promise.all([
          Promise.all(moviePromises),
          Promise.all(tvPromises),
          animePromise,
        ]);

        let movies = [];
        movieResList.forEach((r) => {
          if (r.data?.results) {
            movies.push(
              ...r.data.results.map((m) => ({ ...m, media_type: "movie" })),
            );
          }
        });

        let liveTvs = [];
        tvResList.forEach((r) => {
          if (r.data?.results) {
            liveTvs.push(
              ...r.data.results.map((t) => ({ ...t, media_type: "tv" })),
            );
          }
        });

        const animes = (animeRes.data?.results || []).map((a) => ({
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
        else if (cyberpunkKeywordParam)
          animeParams.with_keywords = cyberpunkKeywordParam;
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
          sort_by: "vote_count.desc",
          [isTv ? "first_air_date.lte" : "primary_release_date.lte"]: todayStr,
        };

        if (isKoreanIntent) {
          singleParams.with_original_language = "ko";
          singleParams.with_origin_country = "KR";
        }

        if (!isTv && parsedIntent.isHorrorNight && !parsedIntent.wantsClassic) {
          singleParams["primary_release_date.gte"] = "2010-01-01";
        }

        if (!isTv && wantsPsychological) {
          singleParams["vote_average.gte"] = 7.0;
        }

        const targetPrimary = isTv ? primaryTvGenre : primaryMovieGenre;
        if (targetPrimary) singleParams.with_genres = targetPrimary;

        if (superheroKeywordParam) {
          singleParams.with_keywords = superheroKeywordParam;
        } else if (underdogKeywordParam) {
          singleParams.with_keywords = underdogKeywordParam;
        } else if (heistKeywordParam) {
          singleParams.with_keywords = heistKeywordParam;
        } else if (philosophicalSciFiKeywordParam) {
          singleParams.with_keywords = philosophicalSciFiKeywordParam;
        } else if (cyberpunkKeywordParam) {
          singleParams.with_keywords = cyberpunkKeywordParam;
        } else if (trueCrimeKeywordParam) {
          singleParams.with_keywords = trueCrimeKeywordParam;
        } else if (historicalWarKeywordParam) {
          singleParams.with_keywords = historicalWarKeywordParam;
        } else if (romcomKeywordParam) {
          singleParams.with_keywords = romcomKeywordParam;
        } else if (psychologicalKeywordParam) {
          singleParams.with_keywords = psychologicalKeywordParam;
        } else if (crimeHeistKeywordParam) {
          singleParams.with_keywords = crimeHeistKeywordParam;
        } else if (complexKeywordParam) {
          singleParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          singleParams.with_keywords = sportsKeywordParam;
        } else if (excludeSuperheroParam && !isTv) {
          singleParams.without_keywords = excludeSuperheroParam;
        }

        if (withoutKeywordsParam) {
          singleParams.without_keywords = withoutKeywordsParam;
        }

        if (!isTv) singleParams.without_genres = movieWithoutGenres;
        if (isTv) {
          singleParams.without_genres = isFamilyAnimationIntent
            ? "27,53,80"
            : isComfortComedyIntent
              ? "18,16,10765,10768,10762"
              : "16";
          if (tvFantasyExclude)
            singleParams.without_keywords = tvFantasyExclude;
        }

        if (
          parsedIntent.isHorrorNight ||
          isCrimeHeist ||
          isHeistRobberyIntent ||
          wantsPsychological ||
          isRomComIntent ||
          isHistoricalWarIntent ||
          isTrueCrimeDocIntent ||
          isKoreanIntent ||
          isFamilyAnimationIntent ||
          isCyberpunkIntent ||
          isComfortComedyIntent ||
          isPhilosophicalSciFiIntent ||
          wantsPlotTwist ||
          isUnderdogIntent
        ) {
          try {
            const [p1Res, p2Res] = await Promise.all([
              axios.get(endpoint, { params: { ...singleParams, page: 1 } }),
              axios.get(endpoint, { params: { ...singleParams, page: 2 } }),
            ]);
            candidates = [
              ...(p1Res.data.results || []),
              ...(p2Res.data.results || []),
            ].map((it) => ({ ...it, media_type: parsedIntent.targetType }));
          } catch (err) {
            const resData = await axios.get(endpoint, { params: singleParams });
            candidates = (resData.data.results || []).map((it) => ({
              ...it,
              media_type: parsedIntent.targetType,
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

      topResultsRaw.push(...topMovies.slice(0, 2));
      topResultsRaw.push(...topSeries.slice(0, 2));

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
      // 🌟 إعفاء قصص الصعود والتحدي وكافة الفئات التخصصية من تقسيم الحقب الإلزامي
      if (
        wantsSuperhero ||
        specificSportKw ||
        userWantsSports ||
        isComplexThemeIntent ||
        parsedIntent.isHorrorNight ||
        isCrimeHeist ||
        parsedIntent.isHeistRobbery ||
        wantsPsychological ||
        isRomComIntent ||
        isHistoricalWarIntent ||
        isTrueCrimeDocIntent ||
        isKoreanIntent ||
        isFamilyAnimationIntent ||
        isCyberpunkIntent ||
        isComfortComedyIntent ||
        isPhilosophicalSciFiIntent ||
        parsedIntent.isUnderdog
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
