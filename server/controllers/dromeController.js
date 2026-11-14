import db from "../config/db.js";
import {
  CindromeEngine,
  GENRE_DESCRIPTOR_STOPWORDS,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  TMDB_ID_TO_NAME,
  getFranchiseKey,
  isValidControllerAmbiguousSingleWord,
  extractActors,
  normalizePromptSpelling,
  getUserPreviousTexts,
  getSessionSeenIds,
  mergeContext,
} from "../services/cindromeEngine.js";
import {
  resolveKnownFuzzyTitle,
  selectBestAnchorMatch,
  enrichUserProfileFromTMDB,
  checkDynamicPersonFallback,
  resolveSingleAnchorMedia,
  fetchTMDBCandidates,
} from "../services/tmdbService.js";
import {
  buildPolishedResponseMessage,
  formatRecommendationCards,
  logEngineDiagnostics,
} from "../services/replyHelper.js";

export { getFranchiseKey, resolveKnownFuzzyTitle, selectBestAnchorMatch };

const USER_DB_CONTEXT_CACHE = new Map();
const USER_DB_CONTEXT_TTL_MS = 60 * 1000;

const getCachedUserDbContext = async (userId, tmdbApiKey) => {
  const cached = USER_DB_CONTEXT_CACHE.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_DB_CONTEXT_TTL_MS) {
    return cached.data;
  }

  const [countRes, watchedAllRes, watchlistAllRes] = await Promise.all([
    db.query(
      "SELECT COUNT(*) FROM reviews WHERE user_id = $1 AND rating >= 4.0",
      [userId],
    ),
    db.query("SELECT tmdb_id FROM reviews WHERE user_id = $1", [userId]),
    db.query("SELECT tmdb_id FROM watchlist WHERE user_id = $1", [userId]),
  ]);

  const userReviewsCount = parseInt(countRes.rows[0].count, 10);
  const allWatchedIdsSet = new Set(
    watchedAllRes.rows.map((r) => Number(r.tmdb_id)),
  );
  const allWatchlistIdsSet = new Set(
    watchlistAllRes.rows.map((r) => Number(r.tmdb_id)),
  );

  let userProfileStats = { genres: {}, keywords: {} };

  if (userReviewsCount >= 5) {
    const [topUserReviews, favGenresRes] = await Promise.all([
      db.query(
        `SELECT tmdb_id, media_type, rating 
         FROM reviews 
         WHERE user_id = $1 AND rating >= 4.0 
         ORDER BY rating DESC, watch_date DESC 
         LIMIT 10`,
        [userId],
      ),
      db.query("SELECT genre FROM user_favorite_genres WHERE user_id = $1", [
        userId,
      ]),
    ]);

    userProfileStats = await enrichUserProfileFromTMDB(
      topUserReviews.rows,
      favGenresRes.rows,
      tmdbApiKey,
      userId,
      userReviewsCount,
    );
  }

  const contextData = {
    userReviewsCount,
    userProfileStats,
    allWatchedIdsSet,
    allWatchlistIdsSet,
  };

  USER_DB_CONTEXT_CACHE.set(userId, {
    timestamp: Date.now(),
    data: contextData,
  });

  return contextData;
};

export const processChat = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error:
          "Authentication required. Please sign in to use the Cindrome Personalization Engine.",
      });
    }

    const { prompt, focusType = "mixed", history = [] } = req.body;

    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Please enter a message." });
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const rawCleanPrompt = prompt.trim();
    const cleanPrompt = normalizePromptSpelling(rawCleanPrompt);

    let normalizedFocus = focusType.toLowerCase().trim();
    if (normalizedFocus === "movies" || normalizedFocus === "movies only")
      normalizedFocus = "movie";
    if (
      normalizedFocus === "series" ||
      normalizedFocus === "series only" ||
      normalizedFocus === "tv series only"
    )
      normalizedFocus = "tv";
    if (normalizedFocus === "anime only") normalizedFocus = "anime";

    if (/\b(live action|live-action)\b/i.test(cleanPrompt)) {
      normalizedFocus = /\b(movie|movies|film|films)\b/i.test(cleanPrompt)
        ? "movie"
        : "tv";
    } else if (
      /\b(series|show|shows|tv|sitcom|k-drama|kdrama|docuseries|docu-series)\b/i.test(
        cleanPrompt,
      )
    ) {
      normalizedFocus = "tv";
    } else if (/\b(movie|movies|film|films)\b/i.test(cleanPrompt)) {
      normalizedFocus = "movie";
    } else if (/\b(anime|manga)\b/i.test(cleanPrompt)) {
      normalizedFocus = "anime";
    }

    const userPreviousTexts = getUserPreviousTexts(history);

    let parsedIntent = CindromeEngine.parseQuery(
      rawCleanPrompt,
      normalizedFocus,
    );

    if (!parsedIntent.isValid) {
      return res.json({
        success: true,
        message: parsedIntent.message,
        results: [],
      });
    }

    if (parsedIntent.isSmallTalk) {
      return res.json({
        success: true,
        message: parsedIntent.smallTalkMessage || parsedIntent.message,
        results: [],
      });
    }

    if (parsedIntent.needsClarification) {
      return res.json({
        success: true,
        message: parsedIntent.clarificationMessage || parsedIntent.message,
        results: [],
      });
    }

    const directActorsFromRaw = extractActors(
      rawCleanPrompt,
      parsedIntent.extractedDirector,
    );
    if (directActorsFromRaw.length > 0) {
      const mergedAct = Array.from(
        new Set([...(parsedIntent.actors || []), ...directActorsFromRaw]),
      );
      parsedIntent.actors = mergedAct;
      parsedIntent.extractedActors = mergedAct;
      parsedIntent.extractedActor = mergedAct[0] || null;
      parsedIntent.isValid = true;
      parsedIntent.isAmbiguous = false;
    }

    if (parsedIntent.hasContradiction) {
      const polishedContradiction = buildPolishedResponseMessage({
        rawPrompt: rawCleanPrompt,
        parsedIntent,
        resultsCount: 0,
      });
      return res.json({
        success: true,
        message: polishedContradiction,
        results: [],
      });
    }

    const currentRelaxed = parsedIntent.relaxedConstraints || {
      dropEra: false,
      dropFormats: false,
      dropOrigins: false,
      droppedGenres: [],
    };
    const isReplacingPrevious = Boolean(
      parsedIntent.replacePrevious || parsedIntent.isPivot,
    );

    if (
      /\b(sci[- ]?fi|scifi|science\s+fiction)\b/i.test(cleanPrompt) &&
      !parsedIntent.excludedGenres?.includes("scifi") &&
      !currentRelaxed.droppedGenres?.includes("scifi")
    ) {
      if (!parsedIntent.detectedGenres.includes("scifi"))
        parsedIntent.detectedGenres.push("scifi");
      parsedIntent.isAmbiguous = false;
      parsedIntent.isValid = true;
    }

    const hasActorOrDirectorIntent =
      Boolean(parsedIntent.extractedDirector) ||
      (Array.isArray(parsedIntent.actors) && parsedIntent.actors.length > 0);

    const earlyFuzzyCheck = parsedIntent.extractedReferenceTitle
      ? resolveKnownFuzzyTitle(
          parsedIntent.extractedReferenceTitle,
          cleanPrompt,
        )
      : cleanPrompt.split(/\s+/).filter(Boolean).length <= 4 &&
          !parsedIntent.isHyperSpecific &&
          !isReplacingPrevious &&
          (!parsedIntent.strictFormats ||
            parsedIntent.strictFormats.length === 0) &&
          (!parsedIntent.origins || parsedIntent.origins.length === 0)
        ? resolveKnownFuzzyTitle(rawCleanPrompt, cleanPrompt)
        : null;

    if (
      earlyFuzzyCheck &&
      !hasActorOrDirectorIntent &&
      !parsedIntent.isNowPlaying
    ) {
      if (
        !parsedIntent.extractedReferenceTitles ||
        parsedIntent.extractedReferenceTitles.length === 0
      ) {
        parsedIntent.extractedReferenceTitles = [earlyFuzzyCheck.canonical];
      }
      parsedIntent.anchorTitles = [...parsedIntent.extractedReferenceTitles];
      parsedIntent.extractedReferenceTitle =
        parsedIntent.extractedReferenceTitles[0];

      if (
        earlyFuzzyCheck.genre &&
        !parsedIntent.detectedGenres.includes(earlyFuzzyCheck.genre) &&
        !parsedIntent.excludedGenres.includes(earlyFuzzyCheck.genre)
      ) {
        parsedIntent.detectedGenres.push(earlyFuzzyCheck.genre);
      }
      if (earlyFuzzyCheck.flag) {
        parsedIntent[earlyFuzzyCheck.flag] = true;
      }
      parsedIntent.isAmbiguous = false;
      parsedIntent.isValid = true;
    }

    if (userPreviousTexts.length > 0) {
      parsedIntent = mergeContext(
        parsedIntent,
        userPreviousTexts,
        cleanPrompt,
        normalizedFocus,
      );
    }

    if (parsedIntent.isNowPlaying) {
      parsedIntent.targetType = "movie";
      parsedIntent.hasExplicitTargetType = true;
    }

    if (!parsedIntent.isValid) {
      return res.json({
        success: true,
        message: parsedIntent.message,
        results: [],
      });
    }

    if (parsedIntent.hasContradiction && userPreviousTexts.length === 0) {
      const polishedContradiction = buildPolishedResponseMessage({
        rawPrompt: rawCleanPrompt,
        parsedIntent,
        resultsCount: 0,
      });
      return res.json({
        success: true,
        message: polishedContradiction,
        results: [],
      });
    }

    if (
      parsedIntent.isAmbiguous &&
      (!parsedIntent.extractedReferenceTitles ||
        parsedIntent.extractedReferenceTitles.length === 0) &&
      (!parsedIntent.anchorTitles || parsedIntent.anchorTitles.length === 0) &&
      !parsedIntent.extractedDirector &&
      (!parsedIntent.actors || parsedIntent.actors.length === 0) &&
      !parsedIntent.isNowPlaying &&
      !parsedIntent.isHyperSpecific &&
      userPreviousTexts.length === 0
    ) {
      return res.json({
        success: true,
        message:
          "I couldn't quite catch the specific genre or mood you're looking for. Are you in the mood for Comedy, Action, Sci-Fi, Horror, or Drama? You can also name a title, actor, or director you love!",
        results: [],
      });
    }

    const isClassicPre1980Era = Boolean(
      (parsedIntent.minYear !== null && parsedIntent.minYear < 1980) ||
      (parsedIntent.maxYear !== null && parsedIntent.maxYear < 1980),
    );
    const isArabicOrEgyptianQuery = Boolean(
      parsedIntent.detectedLanguage === "ar" ||
      parsedIntent.detectedCountry === "EG" ||
      (Array.isArray(parsedIntent.origins) &&
        parsedIntent.origins.some((o) =>
          [
            "Egyptian",
            "Arabic",
            "Kuwaiti",
            "Gulf/Saudi",
            "Lebanese",
            "Syrian",
            "Moroccan",
            "Tunisian",
            "Jordanian",
            "Iraqi",
            "Emirati",
          ].includes(o),
        )),
    );

    const hasActorInIntent =
      Array.isArray(parsedIntent.actors) && parsedIntent.actors.length > 0;

    const baseRatingFloor =
      isClassicPre1980Era || isArabicOrEgyptianQuery
        ? 5.5
        : hasActorInIntent
          ? 6.0
          : 6.8;
    const effectiveRatingFloor = Math.max(
      baseRatingFloor,
      parsedIntent.minRating || baseRatingFloor,
    );

    const hasMultipleConflictingOrigins =
      Array.isArray(parsedIntent.origins) && parsedIntent.origins.length > 1;
    const hasStrictFormats =
      Array.isArray(parsedIntent.strictFormats) &&
      parsedIntent.strictFormats.length > 0;
    const hasPre1970Era = Boolean(
      (parsedIntent.minYear !== null && parsedIntent.minYear < 1970) ||
      (parsedIntent.maxYear !== null && parsedIntent.maxYear < 1970),
    );
    const isStrictNoFallbackQuery = Boolean(
      parsedIntent.isHyperSpecific ||
      hasMultipleConflictingOrigins ||
      hasStrictFormats ||
      hasPre1970Era,
    );

    if (hasMultipleConflictingOrigins) {
      const zeroMultiOriginMessage = buildPolishedResponseMessage({
        rawPrompt: rawCleanPrompt,
        parsedIntent,
        resultsCount: 0,
        topResultsRaw: [],
      });
      return res.json({
        success: true,
        message: zeroMultiOriginMessage,
        results: [],
      });
    }

    const currentUserId = req.user.id;
    const {
      userReviewsCount,
      userProfileStats,
      allWatchedIdsSet,
      allWatchlistIdsSet,
    } = await getCachedUserDbContext(currentUserId, TMDB_API_KEY);

    const hasExplicitSimilarityKeywords =
      /\b(like|similar\s+to|such\s+as|vibes?\s+of|in\s+the\s+style\s+of|after|watch\s+after|watched|finished|liked|loved|enjoyed|based\s+on|inspired\s+by)\b/i.test(
        rawCleanPrompt,
      );

    let rawReferenceTitles =
      Array.isArray(parsedIntent.anchorTitles) &&
      parsedIntent.anchorTitles.length > 0
        ? [...parsedIntent.anchorTitles]
        : Array.isArray(parsedIntent.extractedReferenceTitles)
          ? [...parsedIntent.extractedReferenceTitles]
          : parsedIntent.extractedReferenceTitle
            ? [parsedIntent.extractedReferenceTitle]
            : [];

    if (
      parsedIntent.extractedDirector ||
      (parsedIntent.actors && parsedIntent.actors.length > 0) ||
      parsedIntent.isNowPlaying ||
      hasStrictFormats
    ) {
      rawReferenceTitles = [];
    }

    rawReferenceTitles = rawReferenceTitles
      .filter((t) => {
        if (!t) return false;
        const cleanCheck = t
          .toLowerCase()
          .trim()
          .replace(/^(a|an|the)\s+/, "");
        if (
          AMBIGUOUS_SINGLE_WORD_TITLES &&
          AMBIGUOUS_SINGLE_WORD_TITLES.has(cleanCheck) &&
          !isValidControllerAmbiguousSingleWord(cleanCheck, cleanPrompt)
        ) {
          return false;
        }
        return (
          !GENRE_DESCRIPTOR_STOPWORDS.has(cleanCheck) &&
          !GENRE_DESCRIPTOR_STOPWORDS.has(t.toLowerCase().trim())
        );
      })
      .slice(0, 3);

    const normalizedShortCandidate = cleanPrompt
      .toLowerCase()
      .replace(/[?.,!]/g, "")
      .trim()
      .replace(/^(a|an|the)\s+/, "");

    const isStandaloneAmbiguousShortQuery =
      AMBIGUOUS_SINGLE_WORD_TITLES &&
      AMBIGUOUS_SINGLE_WORD_TITLES.has(normalizedShortCandidate) &&
      isValidControllerAmbiguousSingleWord(
        normalizedShortCandidate,
        cleanPrompt,
      );

    const isShortTitleQuery =
      cleanPrompt.split(" ").length <= 5 &&
      !parsedIntent.extractedDirector &&
      (!parsedIntent.actors || parsedIntent.actors.length === 0) &&
      !parsedIntent.isNowPlaying &&
      !parsedIntent.isHyperSpecific &&
      !isReplacingPrevious &&
      !hasStrictFormats &&
      !parsedIntent.detectedLanguage &&
      !parsedIntent.detectedCountry &&
      parsedIntent.detectedGenres.length === 0 &&
      parsedIntent.detectedKeywords.length === 0 &&
      (!/\b(recommend|suggest|show|give|want|looking|find|movies|anime|series|dark|psychological|cute|wholesome|musical|western|silent|monochrome|egyptian|kuwaiti|saudi|turkish|korean|japanese|indian|bollywood|icelandic|arabic|french|spanish)\b/i.test(
        cleanPrompt,
      ) ||
        isStandaloneAmbiguousShortQuery);

    if (
      rawReferenceTitles.length === 1 &&
      (!parsedIntent.actors || parsedIntent.actors.length === 0) &&
      !parsedIntent.extractedDirector &&
      !hasExplicitSimilarityKeywords
    ) {
      const candidateName = rawReferenceTitles[0];
      const topPerson = await checkDynamicPersonFallback(
        candidateName,
        cleanPrompt,
        TMDB_API_KEY,
      );
      if (topPerson) {
        if (topPerson.known_for_department === "Directing") {
          parsedIntent.extractedDirector = topPerson.name;
        } else {
          parsedIntent.actors = [topPerson.name];
          parsedIntent.extractedActors = [topPerson.name];
          parsedIntent.extractedActor = topPerson.name;
        }
        rawReferenceTitles = [];
        parsedIntent.extractedReferenceTitles = [];
        parsedIntent.anchorTitles = [];
        parsedIntent.extractedReferenceTitle = null;
      }
    }

    if (
      rawReferenceTitles.length === 0 &&
      isShortTitleQuery &&
      !parsedIntent.extractedDirector &&
      (!parsedIntent.actors || parsedIntent.actors.length === 0)
    ) {
      const cleanShortCheck = cleanPrompt
        .toLowerCase()
        .trim()
        .replace(/^(a|an|the)\s+/, "");
      const isAmbiguousBlocked =
        AMBIGUOUS_SINGLE_WORD_TITLES &&
        AMBIGUOUS_SINGLE_WORD_TITLES.has(cleanShortCheck) &&
        !isValidControllerAmbiguousSingleWord(cleanShortCheck, cleanPrompt);

      if (
        !isAmbiguousBlocked &&
        !GENRE_DESCRIPTOR_STOPWORDS.has(cleanShortCheck) &&
        !GENRE_DESCRIPTOR_STOPWORDS.has(cleanPrompt.toLowerCase().trim())
      ) {
        rawReferenceTitles.push(cleanPrompt);
      }
    }

    const isStandaloneAnchorSearch =
      rawReferenceTitles.length === 1 &&
      !hasExplicitSimilarityKeywords &&
      rawCleanPrompt.split(/\s+/).filter(Boolean).length <= 6;

    const resolvedAnchorsRaw = await Promise.all(
      rawReferenceTitles.map((t) =>
        resolveSingleAnchorMedia(t, parsedIntent, cleanPrompt, TMDB_API_KEY),
      ),
    );
    const resolvedAnchors = resolvedAnchorsRaw.filter(Boolean);

    resolvedAnchors.forEach((anchorObj) => {
      if (
        anchorObj.media?.genre_ids &&
        Array.isArray(anchorObj.media.genre_ids)
      ) {
        const anchorGenres = anchorObj.media.genre_ids
          .map((id) => TMDB_ID_TO_NAME[id]?.toLowerCase())
          .filter(Boolean)
          .filter((g) => !parsedIntent.excludedGenres.includes(g));

        parsedIntent.detectedGenres = Array.from(
          new Set([...(parsedIntent.detectedGenres || []), ...anchorGenres]),
        );

        if (
          (anchorObj.media.genre_ids.includes(878) ||
            anchorObj.media.genre_ids.includes(10765)) &&
          !parsedIntent.detectedGenres.includes("scifi") &&
          !parsedIntent.excludedGenres.includes("scifi")
        ) {
          parsedIntent.detectedGenres.push("scifi");
        }
      }

      if (anchorObj.meta) {
        if (
          anchorObj.meta.genre &&
          !parsedIntent.detectedGenres.includes(anchorObj.meta.genre) &&
          !parsedIntent.excludedGenres.includes(anchorObj.meta.genre)
        ) {
          parsedIntent.detectedGenres.push(anchorObj.meta.genre);
        }
        if (anchorObj.meta.flag) {
          parsedIntent[anchorObj.meta.flag] = true;
        }
      }
    });

    const resolvedAnchorNames = resolvedAnchors.map((a) => a.title);
    const anchorTitle = resolvedAnchorNames[0] || null;
    const anchorMedia =
      resolvedAnchors.find((a) => a.media !== null)?.media || null;

    parsedIntent.extractedReferenceTitles = resolvedAnchorNames;
    parsedIntent.anchorTitles = resolvedAnchorNames;
    parsedIntent.extractedReferenceTitle = anchorTitle;

    const hasQualityFloorIntent =
      parsedIntent.hasQualityFloor ||
      parsedIntent.isMindBlowingAction ||
      parsedIntent.isPureComedy ||
      /\b(mind[- ]blowing|mind blowing|masterpiece|masterpieces|epic|best|top[- ]tier|greatest)\b/i.test(
        cleanPrompt,
      );

    const hasSpecificUserIntent =
      resolvedAnchorNames.length > 0 ||
      Boolean(anchorTitle) ||
      Boolean(anchorMedia) ||
      Boolean(parsedIntent.extractedDirector) ||
      (Array.isArray(parsedIntent.actors) && parsedIntent.actors.length > 0) ||
      Boolean(parsedIntent.isNowPlaying) ||
      Boolean(parsedIntent.isHyperSpecific) ||
      Boolean(parsedIntent.excludeViolence) ||
      hasStrictFormats ||
      parsedIntent.detectedGenres.length > 0 ||
      parsedIntent.detectedKeywords.length > 0 ||
      (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) ||
      (parsedIntent.excludedKeywords &&
        parsedIntent.excludedKeywords.length > 0) ||
      parsedIntent.minYear !== null ||
      parsedIntent.maxYear !== null ||
      parsedIntent.minRating !== null ||
      Boolean(parsedIntent.detectedLanguage) ||
      Boolean(parsedIntent.detectedCountry) ||
      parsedIntent.isKorean ||
      parsedIntent.hasTwistKeywords ||
      parsedIntent.isUnderdog ||
      parsedIntent.isSwordWarfare ||
      parsedIntent.isCrimeFamily ||
      parsedIntent.isCuteAnimeRomCom ||
      parsedIntent.isDarkAnime ||
      parsedIntent.isDarkComedy ||
      parsedIntent.isSitcom ||
      parsedIntent.isHauntedHorror ||
      parsedIntent.isMindBlowingAction ||
      hasQualityFloorIntent ||
      parsedIntent.isPureComedy ||
      parsedIntent.isComfortComedy ||
      parsedIntent.isHistoricalWar ||
      parsedIntent.isTrueCrimeDoc ||
      parsedIntent.isFamilyAnimation ||
      parsedIntent.isCyberpunk ||
      parsedIntent.isPhilosophicalSciFi ||
      parsedIntent.isHeistRobbery;

    if (
      userReviewsCount < 3 &&
      resolvedAnchorNames.length === 0 &&
      !hasSpecificUserIntent &&
      userPreviousTexts.length === 0
    ) {
      const coldStartMessage = buildPolishedResponseMessage({
        rawPrompt: rawCleanPrompt,
        parsedIntent,
        resultsCount: 0,
        isColdStart: true,
      });
      return res.json({
        success: true,
        message: coldStartMessage,
        results: [],
      });
    }

    const sessionSeenIds = getSessionSeenIds(history);
    const getWatchedIdsFn = async () => allWatchedIdsSet;

    const {
      candidates,
      resolvedDirectorId,
      resolvedActorIds,
      resolvedActorNames,
      requestedActorsList,
      hasExplicitActorRequest,
      isSitcomIntent,
    } = await fetchTMDBCandidates({
      parsedIntent,
      cleanPrompt,
      normalizedFocus,
      resolvedAnchors,
      effectiveRatingFloor,
      isClassicPre1980Era,
      isArabicOrEgyptianQuery,
      hasStrictFormats,
      hasPre1970Era,
      isStrictNoFallbackQuery,
      tmdbApiKey: TMDB_API_KEY,
      getWatchedIdsFn,
      sessionSeenIds,
    });

    const finalRatingFloor = hasExplicitActorRequest
      ? Math.max(6.0, parsedIntent.minRating || 6.0)
      : effectiveRatingFloor;

    const rankedResults = CindromeEngine.scoreAndRank(
      candidates,
      parsedIntent,
      userProfileStats,
      resolvedAnchorNames,
      userReviewsCount,
    );

    let eligibleCandidates = rankedResults.filter(
      (item) =>
        item.finalScore >= 40 && (item.vote_average || 0) >= finalRatingFloor,
    );

    if (eligibleCandidates.length < 4) {
      const qualitySafeCandidates = rankedResults.filter(
        (item) =>
          item.finalScore >= 25 && (item.vote_average || 0) >= finalRatingFloor,
      );
      if (qualitySafeCandidates.length >= eligibleCandidates.length) {
        eligibleCandidates = qualitySafeCandidates;
      }
    }

    if (eligibleCandidates.length < 4 && rankedResults.length > 0) {
      const validRemaining = rankedResults.filter(
        (item) =>
          (item.vote_average || 0) >= finalRatingFloor &&
          (item.finalScore >= 15 ||
            item.isActorMatch ||
            isClassicPre1980Era ||
            isArabicOrEgyptianQuery),
      );
      if (validRemaining.length > eligibleCandidates.length) {
        eligibleCandidates = validRemaining;
      }
    }

    let topResultsRaw = [];
    const deduplicatedCandidates = [];
    const seenFranchises = new Set();

    resolvedAnchorNames.forEach((aName) => {
      if (aName) seenFranchises.add(getFranchiseKey(aName));
    });

    for (const item of eligibleCandidates) {
      const fKey = getFranchiseKey(item.title || item.name);
      if (!seenFranchises.has(fKey)) {
        seenFranchises.add(fKey);
        deduplicatedCandidates.push(item);
      }
    }

    if (parsedIntent.targetType === "mixed") {
      const isMovieAnchor =
        anchorMedia &&
        (anchorMedia.media_type === "movie" ||
          (!anchorMedia.first_air_date && anchorMedia.release_date));

      if (
        isMovieAnchor ||
        parsedIntent.extractedDirector ||
        hasExplicitActorRequest ||
        parsedIntent.isNowPlaying ||
        isStrictNoFallbackQuery ||
        isClassicPre1980Era ||
        isArabicOrEgyptianQuery ||
        ((anchorMedia || resolvedAnchorNames.length > 0) && !isSitcomIntent)
      ) {
        topResultsRaw.push(...deduplicatedCandidates.slice(0, 4));
      } else if (isSitcomIntent) {
        const topSeries = deduplicatedCandidates.filter(
          (item) => item.media_type === "tv",
        );
        topResultsRaw.push(...topSeries.slice(0, 4));
        if (topResultsRaw.length < 4) {
          for (const item of deduplicatedCandidates) {
            if (topResultsRaw.length >= 4) break;
            if (!topResultsRaw.some((p) => p.id === item.id)) {
              topResultsRaw.push(item);
            }
          }
        }
      } else {
        const topMovies = deduplicatedCandidates.filter(
          (item) => item.media_type === "movie",
        );
        const topSeries = deduplicatedCandidates.filter(
          (item) => item.media_type === "tv",
        );

        topResultsRaw.push(...topMovies.slice(0, 2));
        topResultsRaw.push(...topSeries.slice(0, 2));

        if (topResultsRaw.length < 4) {
          for (const item of deduplicatedCandidates) {
            if (topResultsRaw.length >= 4) break;
            if (!topResultsRaw.some((p) => p.id === item.id)) {
              topResultsRaw.push(item);
            }
          }
        }
      }
      topResultsRaw.sort((a, b) => b.finalScore - a.finalScore);
    } else if (parsedIntent.targetType === "movie") {
      topResultsRaw = deduplicatedCandidates.slice(0, 4);
    } else {
      topResultsRaw = deduplicatedCandidates.slice(0, 4);
    }

    if (topResultsRaw.length < 4) {
      for (const item of rankedResults) {
        if (topResultsRaw.length >= 4) break;
        if ((item.vote_average || 0) < finalRatingFloor) continue;
        if (
          item.finalScore < 20 &&
          !item.isActorMatch &&
          !isClassicPre1980Era &&
          !isArabicOrEgyptianQuery
        ) {
          continue;
        }

        const fKey = getFranchiseKey(item.title || item.name);
        const alreadyIn = topResultsRaw.some((p) => p.id === item.id);
        const franchiseUsed = seenFranchises.has(fKey);

        if (!alreadyIn && !franchiseUsed) {
          topResultsRaw.push(item);
          seenFranchises.add(fKey);
        }
      }
    }

    topResultsRaw = topResultsRaw.map((item) =>
      item.raw_vote_average !== undefined
        ? { ...item, vote_average: item.raw_vote_average }
        : item,
    );

    logEngineDiagnostics({
      currentUserId,
      userReviewsCount,
      resolvedAnchorNames,
      isStandaloneAnchorSearch,
      parsedIntent,
      resolvedDirectorId,
      resolvedActorNames,
      resolvedActorIds,
      requestedActorsList,
      hasExplicitActorRequest,
      hasStrictFormats,
      effectiveRatingFloor: finalRatingFloor,
      sessionSeenIds,
      userProfileStats,
      topResultsRaw,
    });

    const formattedResults = formatRecommendationCards(
      topResultsRaw,
      allWatchlistIdsSet,
    );

    const responseText = buildPolishedResponseMessage({
      rawPrompt: rawCleanPrompt,
      parsedIntent,
      resultsCount: formattedResults.length,
      topResultsRaw,
      isColdStart: false,
      resolvedAnchorNames,
      rawAnchorInputs: rawReferenceTitles,
      isStandaloneAnchorSearch,
      resolvedActorNames:
        resolvedActorNames.length > 0
          ? resolvedActorNames
          : requestedActorsList,
    });

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
