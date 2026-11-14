// services/tmdbService.js
import axios from "axios";
import {
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  CONTROLLER_PRE_MODIFIER_WORDS,
  themeKeywords,
  genreMap,
  TMDB_THEME_IDS,
  TMDB_GENRE_IDS,
  TMDB_ID_TO_NAME,
  ECCHI_HAREM_FILTER_REGEX,
  KIDS_MASCOT_FILTER_REGEX,
  MODERN_WARFARE_GUNS_FILTER_REGEX,
  SWORD_WARFARE_THEMES_REGEX,
  EXTREME_VIOLENCE_GORE_FILTER_REGEX,
} from "./engine/constants.js";
import {
  getSimilarityScore,
  cleanAnchorQuery,
  isValidControllerAmbiguousSingleWord,
  resolveFuzzyAnchorTitle,
} from "./engine/textHelper.js";

// =========================================================================
// Day 5: High-Speed In-Memory Caching Layer (User Profiles + TMDB Queries)
// =========================================================================
const USER_PROFILE_CACHE = new Map();
const USER_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

const TMDB_QUERY_CACHE = new Map();
const TMDB_QUERY_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_TMDB_CACHE_ENTRIES = 500;

// Helper to execute and cache any TMDB GET request (excludes api_key from cache key)
const cachedTmdbGet = async (url, config = {}) => {
  const rawParams = config.params || {};
  const sortedParamPairs = Object.keys(rawParams)
    .filter(
      (k) =>
        k !== "api_key" && rawParams[k] !== undefined && rawParams[k] !== null,
    )
    .sort()
    .map((k) => `${k}=${rawParams[k]}`);

  const cacheKey = `${url}?${sortedParamPairs.join("&")}`;

  if (TMDB_QUERY_CACHE.has(cacheKey)) {
    const cached = TMDB_QUERY_CACHE.get(cacheKey);
    if (Date.now() - cached.timestamp < TMDB_QUERY_CACHE_TTL_MS) {
      return { data: cached.data, fromCache: true };
    }
    TMDB_QUERY_CACHE.delete(cacheKey);
  }

  const response = await axios.get(url, config);

  if (response && response.data) {
    if (TMDB_QUERY_CACHE.size >= MAX_TMDB_CACHE_ENTRIES) {
      const oldestKey = TMDB_QUERY_CACHE.keys().next().value;
      if (oldestKey) TMDB_QUERY_CACHE.delete(oldestKey);
    }
    TMDB_QUERY_CACHE.set(cacheKey, {
      timestamp: Date.now(),
      data: response.data,
    });
  }

  return response;
};

// Match query title against the iconic reference anchors list (Fuzzy Anchor Resolution >= 0.65)
export const resolveKnownFuzzyTitle = (queryTitle, fullContextStr = "") => {
  if (!queryTitle) return null;
  const contextToCheck = fullContextStr || queryTitle;
  const cleanCandidate = queryTitle
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");

  if (
    AMBIGUOUS_SINGLE_WORD_TITLES &&
    AMBIGUOUS_SINGLE_WORD_TITLES.has(cleanCandidate) &&
    !isValidControllerAmbiguousSingleWord(cleanCandidate, contextToCheck)
  ) {
    return null;
  }

  const candidateTokens = cleanCandidate.split(/\s+/).filter(Boolean);
  if (
    candidateTokens.length >= 2 &&
    AMBIGUOUS_SINGLE_WORD_TITLES &&
    AMBIGUOUS_SINGLE_WORD_TITLES.has(candidateTokens[0]) &&
    candidateTokens.slice(1).every((w) => CONTROLLER_PRE_MODIFIER_WORDS.has(w))
  ) {
    return null;
  }

  const directEngineMatch = resolveFuzzyAnchorTitle(queryTitle, contextToCheck);
  if (directEngineMatch) {
    const canonLower = directEngineMatch.canonical
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");
    if (
      AMBIGUOUS_SINGLE_WORD_TITLES &&
      AMBIGUOUS_SINGLE_WORD_TITLES.has(canonLower) &&
      !isValidControllerAmbiguousSingleWord(canonLower, contextToCheck)
    ) {
      return null;
    }
    return directEngineMatch;
  }

  const cleanQ = cleanAnchorQuery(queryTitle);
  let bestCandidate = null;
  let highestSim = 0;

  for (const item of KNOWN_ICONIC_ANCHORS) {
    const cleanCanonical = cleanAnchorQuery(item.canonical);
    const canonStripped = item.canonical
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_SINGLE_WORD_TITLES &&
      AMBIGUOUS_SINGLE_WORD_TITLES.has(canonStripped) &&
      !isValidControllerAmbiguousSingleWord(canonStripped, contextToCheck)
    ) {
      continue;
    }

    const sim = getSimilarityScore(cleanQ, cleanCanonical);
    if (sim >= 0.65 && sim > highestSim) {
      highestSim = sim;
      bestCandidate = item;
    }
  }
  return bestCandidate;
};

// Select best anchor match applying a strict vote floor and a 0.65 similarity threshold for iconic titles
export const selectBestAnchorMatch = (
  rawResults,
  queryTitle,
  isKnownIconic = false,
  fullContextStr = "",
) => {
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;

  const cleanQuery = cleanAnchorQuery(queryTitle);
  const queryWordsCount = cleanQuery.split(/\s+/).filter(Boolean).length;
  const knownMeta = isKnownIconic
    ? resolveKnownFuzzyTitle(queryTitle, fullContextStr) || {
        canonical: queryTitle,
      }
    : resolveKnownFuzzyTitle(queryTitle, fullContextStr);

  const validResults = rawResults.filter(
    (r) => r.media_type !== "person" && (r.vote_count || 0) >= 10,
  );

  if (validResults.length === 0) return null;

  const scoredResults = validResults.map((r) => {
    const titleClean = cleanAnchorQuery(r.title || r.name);
    const origTitleClean = cleanAnchorQuery(
      r.original_title || r.original_name,
    );

    const titleWordsCount = titleClean.split(/\s+/).filter(Boolean).length;

    const simTitle = getSimilarityScore(cleanQuery, titleClean);
    const simOrig = getSimilarityScore(cleanQuery, origTitleClean);
    let bestSim = Math.max(simTitle, simOrig);

    if (knownMeta) {
      const canonicalClean = cleanAnchorQuery(knownMeta.canonical);
      const simCanonical = Math.max(
        getSimilarityScore(canonicalClean, titleClean),
        getSimilarityScore(canonicalClean, origTitleClean),
      );
      bestSim = Math.max(bestSim, simCanonical);
    }

    const isExactMatch = bestSim >= 0.95;

    if (queryWordsCount === 1 && titleWordsCount > 1 && !knownMeta) {
      bestSim -= 0.35;
    } else if (titleWordsCount > queryWordsCount && !knownMeta) {
      bestSim -= (titleWordsCount - queryWordsCount) * 0.2;
    }

    const popularityBonus = Math.min(0.25, Math.log10(r.vote_count || 1) / 15);
    const matchScore = bestSim + popularityBonus;

    return {
      ...r,
      similarity: bestSim,
      matchScore,
      isExactMatch,
      voteCount: r.vote_count || 0,
    };
  });

  scoredResults.sort((a, b) => b.matchScore - a.matchScore);
  const bestMatch = scoredResults[0];

  if (!bestMatch) return null;

  const minSimThreshold = knownMeta ? 0.65 : 0.75;
  const passesVoteFloor =
    bestMatch.isExactMatch || Boolean(knownMeta) || bestMatch.voteCount >= 1000;
  const passesSimilarityThreshold = bestMatch.similarity >= minSimThreshold;

  return passesVoteFloor && passesSimilarityThreshold ? bestMatch : null;
};

// Enrich user profile stats from top-rated user reviews via TMDB details & keywords (with instant caching)
export const enrichUserProfileFromTMDB = async (
  topUserReviewRows = [],
  favGenresRows = [],
  tmdbApiKey,
  userId = null,
  userReviewsCount = 0,
) => {
  const cacheKey = userId ? `user_${userId}_rev_${userReviewsCount}` : null;
  if (cacheKey && USER_PROFILE_CACHE.has(cacheKey)) {
    const cachedEntry = USER_PROFILE_CACHE.get(cacheKey);
    if (Date.now() - cachedEntry.timestamp < USER_PROFILE_CACHE_TTL_MS) {
      return cachedEntry.data;
    }
    USER_PROFILE_CACHE.delete(cacheKey);
  }

  const userProfileStats = { genres: {}, keywords: {} };

  if (topUserReviewRows.length > 0) {
    const detailPromises = topUserReviewRows.map((rev) => {
      const endpointType = rev.media_type === "anime" ? "tv" : rev.media_type;
      return cachedTmdbGet(
        `https://api.themoviedb.org/3/${endpointType}/${rev.tmdb_id}`,
        {
          params: {
            api_key: tmdbApiKey,
            append_to_response: "keywords",
          },
        },
      ).catch(() => null);
    });

    const responses = await Promise.all(detailPromises);
    responses.forEach((resp, index) => {
      if (resp && resp.data) {
        const rawRating = parseFloat(topUserReviewRows[index].rating) || 4.5;
        const personalRating = rawRating <= 5 ? rawRating * 2 : rawRating;

        if (resp.data.genres) {
          resp.data.genres.forEach((g) => {
            const gName = g.name.toLowerCase();
            userProfileStats.genres[gName] = Math.max(
              userProfileStats.genres[gName] || 0,
              personalRating,
            );
            userProfileStats[gName] = userProfileStats.genres[gName];
          });
        }

        const combinedDetailsText =
          `${resp.data.title || resp.data.name || ""} ${resp.data.overview || ""}`.toLowerCase();
        const tmdbKeywordsList = (
          resp.data.keywords?.keywords ||
          resp.data.keywords?.results ||
          []
        ).map((k) => (k.name || "").toLowerCase());

        for (const [theme, data] of Object.entries(themeKeywords)) {
          const matchesTheme = data.terms.some(
            (t) =>
              combinedDetailsText.includes(t.toLowerCase()) ||
              tmdbKeywordsList.some((k) => k.includes(t.toLowerCase())),
          );
          if (matchesTheme) {
            userProfileStats.keywords[theme] = Math.max(
              userProfileStats.keywords[theme] || 0,
              personalRating,
            );
          }
        }
      }
    });
  }

  favGenresRows.forEach((row) => {
    const g = row.genre.toLowerCase();
    if (!userProfileStats.genres[g]) {
      userProfileStats.genres[g] = 8.0;
      userProfileStats[g] = 8.0;
    }
  });

  if (cacheKey) {
    USER_PROFILE_CACHE.set(cacheKey, {
      timestamp: Date.now(),
      data: userProfileStats,
    });
  }

  return userProfileStats;
};

// Dynamic Person Fallback Check for short queries (e.g., "Asser Yassin" or "Youssef Chahine")
export const checkDynamicPersonFallback = async (
  candidateName,
  cleanPrompt,
  tmdbApiKey,
) => {
  const knownAnchorCheck = resolveKnownFuzzyTitle(candidateName, cleanPrompt);
  if (
    !knownAnchorCheck &&
    candidateName.split(/\s+/).filter(Boolean).length >= 2 &&
    candidateName.split(/\s+/).filter(Boolean).length <= 4
  ) {
    try {
      const personCheckRes = await cachedTmdbGet(
        "https://api.themoviedb.org/3/search/person",
        {
          params: {
            api_key: tmdbApiKey,
            query: candidateName,
            page: 1,
          },
        },
      );
      const topPerson = personCheckRes.data?.results?.[0];
      if (
        topPerson &&
        getSimilarityScore(topPerson.name || "", candidateName) >= 0.78 &&
        (topPerson.known_for_department === "Acting" ||
          topPerson.known_for_department === "Directing")
      ) {
        return topPerson;
      }
    } catch (_) {
      // Ignore person check errors and proceed with title resolution
    }
  }
  return null;
};

// Resolve a single reference anchor title against TMDB search endpoints
export const resolveSingleAnchorMedia = async (
  rawTitle,
  parsedIntent,
  cleanPrompt,
  tmdbApiKey,
) => {
  const knownMeta = resolveKnownFuzzyTitle(rawTitle, cleanPrompt);
  const searchTitle = knownMeta ? knownMeta.canonical : rawTitle;

  try {
    const searchEndpoint =
      parsedIntent.targetType === "anime" || parsedIntent.targetType === "tv"
        ? "https://api.themoviedb.org/3/search/tv"
        : parsedIntent.targetType === "movie"
          ? "https://api.themoviedb.org/3/search/movie"
          : "https://api.themoviedb.org/3/search/multi";

    const searchRes = await cachedTmdbGet(searchEndpoint, {
      params: {
        api_key: tmdbApiKey,
        query: searchTitle,
        page: 1,
      },
    });

    let topMatch = selectBestAnchorMatch(
      searchRes.data?.results || [],
      searchTitle,
      Boolean(knownMeta),
      cleanPrompt,
    );

    if (
      !topMatch &&
      searchEndpoint !== "https://api.themoviedb.org/3/search/multi"
    ) {
      const multiRes = await cachedTmdbGet(
        "https://api.themoviedb.org/3/search/multi",
        {
          params: {
            api_key: tmdbApiKey,
            query: searchTitle,
            page: 1,
          },
        },
      ).catch(() => ({ data: { results: [] } }));

      topMatch = selectBestAnchorMatch(
        multiRes.data?.results || [],
        searchTitle,
        Boolean(knownMeta),
        cleanPrompt,
      );
    }

    const cleanedQuery = cleanAnchorQuery(searchTitle);
    if (
      !topMatch &&
      cleanedQuery &&
      cleanedQuery !== searchTitle.toLowerCase().trim()
    ) {
      const retryRes = await cachedTmdbGet(
        "https://api.themoviedb.org/3/search/multi",
        {
          params: { api_key: tmdbApiKey, query: cleanedQuery, page: 1 },
        },
      ).catch(() => ({ data: { results: [] } }));

      topMatch = selectBestAnchorMatch(
        retryRes.data?.results || [],
        cleanedQuery,
        Boolean(knownMeta),
        cleanPrompt,
      );
    }

    if (!topMatch) {
      const stopWords = new Set([
        "the",
        "a",
        "an",
        "of",
        "and",
        "in",
        "on",
        "part",
        "chapter",
        "volume",
        "movie",
        "series",
      ]);
      const tokens = searchTitle
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^\w]/g, ""))
        .filter((t) => t.length > 2 && !stopWords.has(t));

      if (tokens.length > 0) {
        tokens.sort((a, b) => b.length - a.length);
        const fallbackToken = tokens[0];

        const tokenSearchRes = await cachedTmdbGet(
          "https://api.themoviedb.org/3/search/multi",
          {
            params: {
              api_key: tmdbApiKey,
              query: fallbackToken,
              page: 1,
            },
          },
        ).catch(() => ({ data: { results: [] } }));

        topMatch = selectBestAnchorMatch(
          tokenSearchRes.data?.results || [],
          fallbackToken,
          Boolean(knownMeta),
          cleanPrompt,
        );
      }
    }

    if (topMatch) {
      return {
        title: knownMeta
          ? knownMeta.canonical
          : topMatch.title || topMatch.name,
        media: topMatch,
        meta: knownMeta,
        rawInput: rawTitle,
      };
    } else if (knownMeta) {
      return {
        title: knownMeta.canonical,
        media: null,
        meta: knownMeta,
        rawInput: rawTitle,
      };
    }
    return null;
  } catch (err) {
    console.error(
      `Direct title search failed for "${searchTitle}":`,
      err.message,
    );
    if (knownMeta) {
      return {
        title: knownMeta.canonical,
        media: null,
        meta: knownMeta,
        rawInput: rawTitle,
      };
    }
    return null;
  }
};

// Fetch candidate titles from TMDB (Recommendations, Director, Actor, Now Playing, Harvesters, Discover & Fallback)
export const fetchTMDBCandidates = async ({
  parsedIntent,
  cleanPrompt,
  normalizedFocus,
  resolvedAnchors = [],
  effectiveRatingFloor,
  isClassicPre1980Era,
  isArabicOrEgyptianQuery,
  hasStrictFormats,
  hasPre1970Era,
  isStrictNoFallbackQuery,
  tmdbApiKey,
  getWatchedIdsFn,
  sessionSeenIds = new Set(),
}) => {
  const TMDB_API_KEY = tmdbApiKey;

  const iconicSitcomAnchors =
    /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;

  const resolvedAnchorNames = resolvedAnchors.map((a) => a.title);

  const isSitcomIntent =
    parsedIntent.isSitcom ||
    parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
    resolvedAnchorNames.some((t) => iconicSitcomAnchors.test(t)) ||
    /\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(cleanPrompt);

  const isDarkComedyIntent =
    parsedIntent.isDarkComedy ||
    parsedIntent.detectedKeywords.some((k) => k.name === "dark comedy") ||
    /\b(dark\s+comed(?:y|ies)|black\s+comed(?:y|ies)|morbid\s+humor|dark\s+humor)\b/i.test(
      cleanPrompt,
    );

  const isExcludedSuperhero =
    parsedIntent.excludedKeywords &&
    parsedIntent.excludedKeywords.includes("9715");

  const wantsSuperhero =
    !isExcludedSuperhero &&
    (parsedIntent.detectedKeywords.some((k) => k.name === "superhero") ||
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
        cleanPrompt,
      ));

  const specificSportKw = parsedIntent.detectedKeywords.find((k) =>
    ["racing", "boxing", "football", "basketball"].includes(k.name),
  );
  const userWantsSports =
    (parsedIntent.detectedGenres.includes("sports") || !!specificSportKw) &&
    !parsedIntent.isUnderdog &&
    !parsedIntent.isCuteAnimeRomCom &&
    !isSitcomIntent;

  const wantsTimeTravel =
    parsedIntent.detectedKeywords.some((k) => k.name === "time travel") ||
    /\b(time travel|time loop|time-loop|timeline|timelines|wormhole)\b/i.test(
      cleanPrompt,
    );

  const wantsPlotTwist =
    parsedIntent.detectedKeywords.some((k) => k.name === "plot twist") ||
    parsedIntent.hasTwistKeywords ||
    /\b(plot twists?|twist ending|crazy plot twists?|can'?t predict|unpredictable|mind[- ]blowing)\b/i.test(
      cleanPrompt,
    );

  const wantsMindBending =
    parsedIntent.detectedKeywords.some((k) => k.name === "mind bending") ||
    /\b(mind[- ]bending|psychological puzzle)\b/i.test(cleanPrompt);

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
    !isSitcomIntent &&
    !isDarkComedyIntent &&
    (parsedIntent.isRomCom ||
      parsedIntent.detectedKeywords.some((k) => k.name === "rom-com") ||
      (/\b(sweet|light|lift my mood|feel[- ]good|rom-com|romcom|romantic comedy)\b/i.test(
        cleanPrompt,
      ) &&
        (parsedIntent.detectedGenres.includes("romance") ||
          parsedIntent.detectedGenres.includes("comedy"))));

  const isCuteAnimeRomComIntent =
    parsedIntent.isCuteAnimeRomCom ||
    ((parsedIntent.targetType === "anime" || normalizedFocus === "anime") &&
      (isRomComIntent ||
        (/\b(cute|wholesome|sweet|rom-com|romcom|romantic comedy)\b/i.test(
          cleanPrompt,
        ) &&
          (/\b(romance|romantic|love|rom-com|romcom)\b/i.test(cleanPrompt) ||
            /\b(funny|comedy)\b/i.test(cleanPrompt)))));

  const isDarkAnimeIntent =
    parsedIntent.isDarkAnime ||
    ((parsedIntent.targetType === "anime" || normalizedFocus === "anime") &&
      /\b(dark|bleak|grim|psychological|gore|brutal|dark fantasy)\b/i.test(
        cleanPrompt,
      ));

  const isAnimeIntent =
    parsedIntent.targetType === "anime" ||
    normalizedFocus === "anime" ||
    Boolean(parsedIntent.wantsExplicitAnime) ||
    isCuteAnimeRomComIntent ||
    isDarkAnimeIntent;

  const isHauntedHorrorIntent =
    !parsedIntent.excludeViolence &&
    !parsedIntent.excludedGenres?.includes("horror") &&
    (parsedIntent.isHauntedHorror ||
      parsedIntent.detectedKeywords.some((k) => k.name === "haunted house") ||
      /\b(cursed house|haunted house|haunted family|cursed family|scary house)\b/i.test(
        cleanPrompt,
      ) ||
      (/\b(scary|horror|haunted|cursed|creepy|demonic|evil|spooky)\b/i.test(
        cleanPrompt,
      ) &&
        /\b(house|family|home|manor|mansion|cabin)\b/i.test(cleanPrompt)));

  const isMindBlowingActionIntent =
    parsedIntent.isMindBlowingAction ||
    (/\b(mind[- ]blowing|mind blowing)\b/i.test(cleanPrompt) &&
      /\baction\b/i.test(cleanPrompt));

  const isPureComedyIntent =
    !isDarkComedyIntent &&
    (parsedIntent.isPureComedy ||
      /\b(pure comedy|only comedy|strictly comedy|purely comedy|just comedy|hilarious)\b/i.test(
        cleanPrompt,
      ));

  const isSwordWarfareIntent =
    parsedIntent.isSwordWarfare ||
    parsedIntent.detectedKeywords.some((k) => k.name === "sword warfare") ||
    /\b(swords?|sword fight|sword battles?|ancient sword battles?|ancient warfare|medieval warfare|old historical battles?|medieval armies|ancient battles?|gladiators?|samurai)\b/i.test(
      cleanPrompt,
    );

  if (isSwordWarfareIntent) {
    parsedIntent.isSwordWarfare = true;
  }

  const isHistoricalWarIntent =
    !isSwordWarfareIntent &&
    (parsedIntent.isHistoricalWar ||
      parsedIntent.detectedKeywords.some((k) => k.name === "historical war") ||
      /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war)\b/i.test(
        cleanPrompt,
      ));

  const trueCrimeKeywordParam = parsedIntent.isTrueCrimeDoc
    ? String(TMDB_THEME_IDS.trueCrime || "10714|9882|9715|10303")
    : null;

  const isTrueCrimeDocIntent =
    parsedIntent.isTrueCrimeDoc ||
    parsedIntent.detectedKeywords.some((k) => k.name === "true crime") ||
    /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|crime documentary|unsolved mysteries|real crime|real crime cases)\b/i.test(
      cleanPrompt,
    );

  const isKoreanIntent =
    parsedIntent.isKorean ||
    parsedIntent.detectedLanguage === "ko" ||
    /\b(korean|k-drama|kdrama|k drama|south korea)\b/i.test(cleanPrompt);

  const isFamilyAnimationIntent =
    !isCuteAnimeRomComIntent &&
    !isHauntedHorrorIntent &&
    !isPureComedyIntent &&
    !isDarkComedyIntent &&
    !isSitcomIntent &&
    (parsedIntent.isFamilyAnimation ||
      (parsedIntent.detectedGenres.includes("animation") &&
        parsedIntent.detectedGenres.includes("family")) ||
      (/\b(animated|animation)\b/i.test(cleanPrompt) &&
        /\b(family|cozy|kids)\b/i.test(cleanPrompt)));

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
    !isDarkComedyIntent &&
    (parsedIntent.isComfortComedy ||
      (parsedIntent.isTiredMood &&
        parsedIntent.detectedGenres.includes("comedy")));

  const isHeistRobberyIntent =
    parsedIntent.isHeistRobbery ||
    parsedIntent.detectedKeywords.some((k) => k.name === "heist") ||
    /\b(plan (?:a )?robbery|big robbery|bank robbery|robbery|heist|bank heist|big heist|steal money|caper|vault|safecracker)\b/i.test(
      cleanPrompt,
    );

  const isCrimeFamilyIntent =
    parsedIntent.isCrimeFamily ||
    parsedIntent.detectedKeywords.some((k) => k.name === "crime family") ||
    /\b(crime family|mob family|mafia family|mafia empire|crime empire|building an empire|gangster empire|organized crime|gangster syndicate|drug empire|criminal empire)\b/i.test(
      cleanPrompt,
    );

  const isCrimeHeist =
    !isTrueCrimeDocIntent &&
    (isCrimeFamilyIntent ||
      isHeistRobberyIntent ||
      parsedIntent.isCrimeHeist ||
      parsedIntent.detectedGenres.includes("crime") ||
      parsedIntent.detectedKeywords.some(
        (k) => k.name === "organized crime" || k.name === "crime family",
      ) ||
      /\b(organized crime|mafia|gangster|mobster|mobsters|crime syndicate|underworld)\b/i.test(
        cleanPrompt,
      ));

  const isUnderdogIntent =
    parsedIntent.isUnderdog ||
    parsedIntent.detectedKeywords.some((k) => k.name === "underdog") ||
    /\b(starting from zero|start from zero|starting from nothing|rags to riches|underdog|success story|winning against all odds|zero to hero)\b/i.test(
      cleanPrompt,
    );

  let candidates = [];
  const todayStr = new Date().toISOString().split("T")[0];
  const oneFiftyDaysAgoStr = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 3. Fetch recommendations in parallel for all resolved anchors from TMDB /recommendations
  const validAnchorMedias = resolvedAnchors.filter((a) => a.media !== null);
  if (
    validAnchorMedias.length > 0 &&
    !parsedIntent.extractedDirector &&
    (!parsedIntent.actors || parsedIntent.actors.length === 0)
  ) {
    const recPromises = validAnchorMedias.map(async (anchorObj) => {
      const mediaItem = anchorObj.media;
      const actualMediaType =
        mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");
      const recEndpoint = `https://api.themoviedb.org/3/${actualMediaType}/${mediaItem.id}/recommendations`;

      try {
        const recRes = await cachedTmdbGet(recEndpoint, {
          params: { api_key: TMDB_API_KEY, page: 1 },
        });
        let rawRecs = recRes.data?.results || [];

        rawRecs = rawRecs.filter(
          (c) =>
            (c.vote_average || 0) >= effectiveRatingFloor &&
            (c.vote_count || 0) >= 200 &&
            (c.release_date || c.first_air_date) &&
            (c.release_date || c.first_air_date) <= todayStr,
        );

        return rawRecs.map((c) => ({
          ...c,
          anchor_source: anchorObj.title,
          media_type:
            parsedIntent.targetType === "anime"
              ? "anime"
              : c.media_type || actualMediaType,
        }));
      } catch (recErr) {
        console.error(
          `Recommendations fetch error for "${anchorObj.title}":`,
          recErr.message,
        );
        return [];
      }
    });

    const recGroups = await Promise.all(recPromises);
    recGroups.forEach((group) => {
      candidates.push(...group);
    });

    if (parsedIntent.targetType === "anime") {
      candidates = candidates.filter((c) => c.original_language === "ja");
    }
  }

  // 4. Strict Director Search Pipeline
  let resolvedDirectorId = null;
  if (parsedIntent.extractedDirector) {
    try {
      const personSearchRes = await cachedTmdbGet(
        "https://api.themoviedb.org/3/search/person",
        {
          params: {
            api_key: TMDB_API_KEY,
            query: parsedIntent.extractedDirector,
            page: 1,
          },
        },
      );
      const personResults = personSearchRes.data?.results || [];
      const directorPerson =
        personResults.find((p) => p.known_for_department === "Directing") ||
        personResults[0];

      if (directorPerson && directorPerson.id) {
        resolvedDirectorId = directorPerson.id;
        parsedIntent.extractedDirector =
          directorPerson.name || parsedIntent.extractedDirector;

        const creditsRes = await cachedTmdbGet(
          `https://api.themoviedb.org/3/person/${resolvedDirectorId}/combined_credits`,
          {
            params: { api_key: TMDB_API_KEY },
          },
        ).catch(() => ({ data: { crew: [] } }));

        const excludedDirectorGenreSet = new Set(
          (parsedIntent.excludedGenreIds || []).map(Number),
        );

        let directedWorks = (creditsRes.data?.crew || [])
          .filter((item) => {
            const isDirectorJob =
              item.job === "Director" &&
              (!item.department || item.department === "Directing");
            if (!isDirectorJob) return false;

            const relDate = item.release_date || item.first_air_date;
            if (!relDate || relDate > todayStr) return false;

            const itemYear = parseInt(relDate.split("-")[0], 10);
            if (parsedIntent.minYear && itemYear < parsedIntent.minYear) {
              return false;
            }
            if (parsedIntent.maxYear && itemYear > parsedIntent.maxYear) {
              return false;
            }

            const itemGIds = item.genre_ids || [];
            if (
              excludedDirectorGenreSet.size > 0 &&
              itemGIds.some((id) => excludedDirectorGenreSet.has(Number(id)))
            ) {
              return false;
            }

            const itemMediaType =
              item.media_type || (item.first_air_date ? "tv" : "movie");
            if (
              parsedIntent.targetType === "movie" &&
              itemMediaType !== "movie"
            ) {
              return false;
            }
            if (parsedIntent.targetType === "tv" && itemMediaType !== "tv") {
              return false;
            }

            const isRegionalOrClassicWork =
              item.original_language === "ar" ||
              isArabicOrEgyptianQuery ||
              isClassicPre1980Era ||
              itemYear < 1980;
            const minDirRating = parsedIntent.minRating
              ? parsedIntent.minRating
              : isRegionalOrClassicWork
                ? 5.0
                : effectiveRatingFloor;

            return (item.vote_average || 0) >= minDirRating;
          })
          .map((item) => {
            const isAnimeWork =
              item.original_language === "ja" &&
              (item.genre_ids || []).includes(16);
            return {
              ...item,
              media_type: isAnimeWork
                ? "anime"
                : item.media_type || (item.first_air_date ? "tv" : "movie"),
            };
          });

        if (
          Array.isArray(parsedIntent.detectedGenres) &&
          parsedIntent.detectedGenres.length > 0
        ) {
          const requestedGenreIdSet = new Set();
          parsedIntent.detectedGenres.forEach((g) => {
            if (TMDB_GENRE_IDS.movie[g]) {
              requestedGenreIdSet.add(Number(TMDB_GENRE_IDS.movie[g]));
            }
            if (TMDB_GENRE_IDS.tv[g]) {
              requestedGenreIdSet.add(Number(TMDB_GENRE_IDS.tv[g]));
            }
          });

          if (requestedGenreIdSet.size > 0) {
            directedWorks = directedWorks.filter((item) =>
              (item.genre_ids || []).some((id) =>
                requestedGenreIdSet.has(Number(id)),
              ),
            );
          }
        }

        directedWorks.sort(
          (a, b) =>
            (b.popularity || 0) * 2 +
            (b.vote_average || 0) * 10 -
            ((a.popularity || 0) * 2 + (a.vote_average || 0) * 10),
        );

        candidates = [...directedWorks];
      }
    } catch (dirErr) {
      console.error("Director lookup failed:", dirErr.message);
    }
  }

  // =========================================================================
  // Strict Actor Search Guard (`/person/{id}/combined_credits` ONLY)
  // =========================================================================
  let resolvedActorIds = [];
  let resolvedActorNames = [];
  const requestedActorsList = Array.isArray(parsedIntent.actors)
    ? parsedIntent.actors
    : Array.isArray(parsedIntent.extractedActors)
      ? parsedIntent.extractedActors
      : [];
  const hasExplicitActorRequest = requestedActorsList.length > 0;

  if (hasExplicitActorRequest) {
    try {
      const actorSearchPromises = requestedActorsList
        .slice(0, 3)
        .map(async (actorQuery) => {
          const pRes = await cachedTmdbGet(
            "https://api.themoviedb.org/3/search/person",
            {
              params: {
                api_key: TMDB_API_KEY,
                query: actorQuery,
                page: 1,
              },
            },
          ).catch(() => ({ data: { results: [] } }));

          const pResults = pRes.data?.results || [];
          const actorPerson =
            pResults.find((p) => p.known_for_department === "Acting") ||
            pResults[0];

          return actorPerson && actorPerson.id
            ? {
                id: actorPerson.id,
                name: actorPerson.name || actorQuery,
              }
            : null;
        });

      const resolvedActorObjs = (await Promise.all(actorSearchPromises)).filter(
        Boolean,
      );

      resolvedActorIds = resolvedActorObjs.map((a) => a.id);
      resolvedActorNames = resolvedActorObjs.map((a) => a.name);

      if (resolvedActorNames.length > 0) {
        parsedIntent.actors = resolvedActorNames;
        parsedIntent.extractedActors = resolvedActorNames;
        parsedIntent.extractedActor = resolvedActorNames[0];
      }

      if (resolvedActorObjs.length > 0) {
        const userExplicitlyWantsDocumentary =
          parsedIntent.detectedGenres.includes("documentary") ||
          isTrueCrimeDocIntent;
        const userExplicitlyWantsAnimation =
          parsedIntent.detectedGenres.includes("animation") || isAnimeIntent;

        const excludedActorGenreSet = new Set([
          ...(parsedIntent.excludedGenreIds || []).map(Number),
          10767, // Talk Shows
          10763, // News
          10764, // Reality
          ...(userExplicitlyWantsDocumentary ? [] : [99]), // Exclude Documentaries by default
        ]);

        const actorCreditsPromises = resolvedActorObjs.map((actorObj) =>
          cachedTmdbGet(
            `https://api.themoviedb.org/3/person/${actorObj.id}/combined_credits`,
            {
              params: { api_key: TMDB_API_KEY },
            },
          )
            .then((res) => ({
              actorObj,
              castCredits: res.data?.cast || [],
            }))
            .catch(() => ({ actorObj, castCredits: [] })),
        );

        const creditsGroups = await Promise.all(actorCreditsPromises);
        let allStarringWorks = [];

        creditsGroups.forEach(({ actorObj, castCredits }) => {
          const validCastItems = castCredits
            .filter((item) => {
              const charLower = (item.character || "").toLowerCase();
              const itemGIds = item.genre_ids || [];

              if (
                /\b(self|himself|herself|guest|host|archive footage|uncredited|narrator|narration)\b/i.test(
                  charLower,
                )
              ) {
                return false;
              }

              if (
                !userExplicitlyWantsAnimation &&
                !itemGIds.includes(16) &&
                /\b(voice)\b/i.test(charLower)
              ) {
                return false;
              }

              if (typeof item.order === "number" && item.order > 18) {
                return false;
              }

              const relDate = item.release_date || item.first_air_date;
              if (!relDate || relDate > todayStr) return false;

              const itemYear = parseInt(relDate.split("-")[0], 10);
              if (parsedIntent.minYear && itemYear < parsedIntent.minYear) {
                return false;
              }
              if (parsedIntent.maxYear && itemYear > parsedIntent.maxYear) {
                return false;
              }

              if (
                itemGIds.some((id) => excludedActorGenreSet.has(Number(id)))
              ) {
                return false;
              }

              const itemMediaType =
                item.media_type || (item.first_air_date ? "tv" : "movie");
              if (
                parsedIntent.targetType === "movie" &&
                itemMediaType !== "movie"
              ) {
                return false;
              }
              if (parsedIntent.targetType === "tv" && itemMediaType !== "tv") {
                return false;
              }

              const actorMinRating = parsedIntent.minRating
                ? parsedIntent.minRating
                : item.original_language === "ar" || itemYear < 1980
                  ? 5.0
                  : 6.0;

              if ((item.vote_average || 0) < actorMinRating) {
                return false;
              }

              if (
                item.original_language === "en" &&
                itemYear >= 1985 &&
                (item.vote_count || 0) < 150
              ) {
                return false;
              }

              return Boolean(item.title || item.name);
            })
            .map((item) => {
              const isAnimeWork =
                item.original_language === "ja" &&
                (item.genre_ids || []).includes(16);

              const normalizedVoteAverage =
                !parsedIntent.minRating &&
                (item.vote_average || 0) < effectiveRatingFloor &&
                (item.vote_average || 0) >= 6.0
                  ? Math.max(item.vote_average || 6.8, effectiveRatingFloor)
                  : item.vote_average || 0;

              return {
                ...item,
                raw_vote_average: item.vote_average || 0,
                vote_average: normalizedVoteAverage,
                media_type: isAnimeWork
                  ? "anime"
                  : item.media_type || (item.first_air_date ? "tv" : "movie"),
                cast: [{ id: actorObj.id, name: actorObj.name }],
                actors: [actorObj.name],
                matched_actor: actorObj.name,
                isActorMatch: true,
              };
            });

          allStarringWorks.push(...validCastItems);
        });

        if (resolvedActorObjs.length > 1) {
          const countByMediaId = new Map();
          allStarringWorks.forEach((w) => {
            const prev = countByMediaId.get(w.id);
            if (prev) {
              prev.cast = [...prev.cast, ...w.cast];
              prev.actors = Array.from(new Set([...prev.actors, ...w.actors]));
              prev.sharedActorCount = (prev.sharedActorCount || 1) + 1;
            } else {
              countByMediaId.set(w.id, { ...w, sharedActorCount: 1 });
            }
          });
          const mergedWorks = Array.from(countByMediaId.values());
          const sharedWorks = mergedWorks.filter(
            (w) => w.sharedActorCount >= resolvedActorObjs.length,
          );
          allStarringWorks = sharedWorks.length > 0 ? sharedWorks : mergedWorks;
        }

        if (
          Array.isArray(parsedIntent.detectedGenres) &&
          parsedIntent.detectedGenres.length > 0
        ) {
          const requestedGenreIdSet = new Set();
          parsedIntent.detectedGenres.forEach((g) => {
            if (TMDB_GENRE_IDS.movie[g]) {
              requestedGenreIdSet.add(Number(TMDB_GENRE_IDS.movie[g]));
            }
            if (TMDB_GENRE_IDS.tv[g]) {
              requestedGenreIdSet.add(Number(TMDB_GENRE_IDS.tv[g]));
            }
          });

          if (requestedGenreIdSet.size > 0) {
            allStarringWorks = allStarringWorks.filter((item) =>
              (item.genre_ids || []).some((id) =>
                requestedGenreIdSet.has(Number(id)),
              ),
            );
          }
        }

        allStarringWorks.sort(
          (a, b) =>
            Math.log10((b.vote_count || 1) + 1) * 25 +
            (b.popularity || 0) * 1.5 +
            (b.raw_vote_average || b.vote_average || 0) * 10 -
            (Math.log10((a.vote_count || 1) + 1) * 25 +
              (a.popularity || 0) * 1.5 +
              (a.raw_vote_average || a.vote_average || 0) * 10),
        );

        if (resolvedDirectorId) {
          const directorWorkIds = new Set(candidates.map((c) => c.id));
          candidates = allStarringWorks.filter((w) =>
            directorWorkIds.has(w.id),
          );
        } else {
          candidates = [...allStarringWorks];
        }
      }
    } catch (actErr) {
      console.error("Actor lookup failed:", actErr.message);
    }
  }

  // 6. Now Playing / In Theaters Pipeline (with a strict 150-day release window)
  if (parsedIntent.isNowPlaying) {
    try {
      const regionCode = parsedIntent.detectedCountry || "US";
      const [np1, np2] = await Promise.all([
        cachedTmdbGet("https://api.themoviedb.org/3/movie/now_playing", {
          params: { api_key: TMDB_API_KEY, page: 1, region: regionCode },
        }).catch(() => ({ data: { results: [] } })),
        cachedTmdbGet("https://api.themoviedb.org/3/movie/now_playing", {
          params: { api_key: TMDB_API_KEY, page: 2, region: regionCode },
        }).catch(() => ({ data: { results: [] } })),
      ]);

      const nowPlayingMovies = [
        ...(np1.data?.results || []),
        ...(np2.data?.results || []),
      ]
        .filter(
          (m) =>
            (m.vote_average || 0) >= effectiveRatingFloor &&
            (m.vote_count || 0) >= 25 &&
            m.release_date &&
            m.release_date >= oneFiftyDaysAgoStr &&
            m.release_date <= todayStr,
        )
        .map((m) => ({ ...m, media_type: "movie" }));

      candidates.push(...nowPlayingMovies);
    } catch (npErr) {
      console.error("Now playing fetch failed:", npErr.message);
    }
  }

  // Dedicated harvesters for specific micro-themes
  if (
    isSwordWarfareIntent &&
    parsedIntent.targetType !== "anime" &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !parsedIntent.isNowPlaying &&
    !parsedIntent.excludeViolence &&
    !isStrictNoFallbackQuery
  ) {
    const swordQueries = [
      "Gladiator",
      "Kingdom of Heaven",
      "Troy",
      "Braveheart",
      "The Last Samurai",
      "300",
      "The Northman",
      "The King",
    ];
    const sPromises = swordQueries.map((q) =>
      cachedTmdbGet("https://api.themoviedb.org/3/search/movie", {
        params: {
          api_key: TMDB_API_KEY,
          query: q,
          page: 1,
          include_adult: false,
        },
      }).catch(() => ({ data: { results: [] } })),
    );
    const sResponses = await Promise.all(sPromises);
    sResponses.forEach((res) => {
      if (res.data?.results?.[0]) {
        const hit = res.data.results[0];
        if (
          (hit.vote_average || 0) >= effectiveRatingFloor &&
          (hit.vote_count || 0) >= 200
        ) {
          candidates.push({ ...hit, media_type: "movie" });
        }
      }
    });
  }

  if (
    isCuteAnimeRomComIntent &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !parsedIntent.isNowPlaying &&
    !isStrictNoFallbackQuery
  ) {
    const cuteAnimeList = [
      "Kaguya-sama: Love Is War",
      "Horimiya",
      "Kimi ni Todoke",
      "Toradora!",
      "The Dangers in My Heart",
      "Komi Can't Communicate",
      "Fruits Basket",
      "Skip and Loafer",
      "My Love Story!!",
      "Tsuki ga Kirei",
    ];
    const aPromises = cuteAnimeList.map((q) =>
      cachedTmdbGet("https://api.themoviedb.org/3/search/tv", {
        params: {
          api_key: TMDB_API_KEY,
          query: q,
          page: 1,
          include_adult: false,
        },
      }).catch(() => ({ data: { results: [] } })),
    );
    const aResponses = await Promise.all(aPromises);
    aResponses.forEach((res) => {
      if (res.data?.results) {
        const validHits = res.data.results
          .filter(
            (it) =>
              it.original_language === "ja" &&
              (it.genre_ids?.includes(16) || it.genre_ids?.includes(35)) &&
              (it.vote_average || 0) >= effectiveRatingFloor,
          )
          .slice(0, 2)
          .map((it) => ({ ...it, media_type: "anime" }));
        candidates.push(...validHits);
      }
    });
  }

  if (
    isDarkAnimeIntent &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !parsedIntent.isNowPlaying &&
    !parsedIntent.excludeViolence &&
    !isStrictNoFallbackQuery
  ) {
    const darkAnimeQueries = [
      "Attack on Titan",
      "Death Note",
      "Monster",
      "Vinland Saga",
      "Psycho-Pass",
      "Parasyte -the maxim-",
      "Chainsaw Man",
      "Tokyo Ghoul",
      "Dororo",
      "Made in Abyss",
    ];
    const daPromises = darkAnimeQueries.map((q) =>
      cachedTmdbGet("https://api.themoviedb.org/3/search/tv", {
        params: {
          api_key: TMDB_API_KEY,
          query: q,
          page: 1,
          include_adult: false,
        },
      }).catch(() => ({ data: { results: [] } })),
    );
    const daResponses = await Promise.all(daPromises);
    daResponses.forEach((res) => {
      if (res.data?.results) {
        const validHits = res.data.results
          .filter(
            (it) =>
              it.original_language === "ja" &&
              (it.genre_ids?.includes(16) || it.genre_ids?.includes(10765)) &&
              !it.genre_ids?.includes(10762) &&
              (it.vote_average || 0) >= effectiveRatingFloor,
          )
          .slice(0, 2)
          .map((it) => ({ ...it, media_type: "anime" }));
        candidates.push(...validHits);
      }
    });
  }

  // Dedicated Harvester for Dark Comedy / Black Comedy masterpieces (avoids stand-up specials)
  if (
    isDarkComedyIntent &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !parsedIntent.isNowPlaying &&
    !isStrictNoFallbackQuery
  ) {
    const darkComedyQueries = [
      "In Bruges",
      "Fargo",
      "The Menu",
      "Parasite",
      "Jojo Rabbit",
      "Three Billboards Outside Ebbing, Missouri",
      "The Banshees of Inisherin",
      "Knives Out",
      "The Death of Stalin",
      "Snatch",
    ];
    const dcPromises = darkComedyQueries.map((q) =>
      cachedTmdbGet("https://api.themoviedb.org/3/search/movie", {
        params: {
          api_key: TMDB_API_KEY,
          query: q,
          page: 1,
          include_adult: false,
        },
      }).catch(() => ({ data: { results: [] } })),
    );
    const dcResponses = await Promise.all(dcPromises);
    dcResponses.forEach((res) => {
      if (res.data?.results?.[0]) {
        const hit = res.data.results[0];
        if ((hit.vote_average || 0) >= effectiveRatingFloor) {
          candidates.push({ ...hit, media_type: "movie" });
        }
      }
    });
  }

  // Dedicated Harvester for Time Loop / Time Travel movies
  if (
    wantsTimeTravel &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !parsedIntent.isNowPlaying &&
    !isStrictNoFallbackQuery
  ) {
    const timeLoopQueries = [
      "Edge of Tomorrow",
      "Source Code",
      "Looper",
      "Predestination",
      "Back to the Future",
      "Twelve Monkeys",
      "Palm Springs",
      "Groundhog Day",
      "Tenet",
    ];
    const tlPromises = timeLoopQueries.map((q) =>
      cachedTmdbGet("https://api.themoviedb.org/3/search/movie", {
        params: {
          api_key: TMDB_API_KEY,
          query: q,
          page: 1,
          include_adult: false,
        },
      }).catch(() => ({ data: { results: [] } })),
    );
    const tlResponses = await Promise.all(tlPromises);
    tlResponses.forEach((res) => {
      if (res.data?.results?.[0]) {
        const hit = res.data.results[0];
        if ((hit.vote_average || 0) >= effectiveRatingFloor) {
          candidates.push({ ...hit, media_type: "movie" });
        }
      }
    });
  }

  const excludeSuperheroParam =
    isExcludedSuperhero || (!wantsSuperhero && resolvedActorIds.length === 0)
      ? "9715"
      : null;
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

  const crimeFamilyKeywordParam = isCrimeFamilyIntent
    ? String(TMDB_THEME_IDS.crimeFamily || "10391|242|10051|9882")
    : null;

  const crimeHeistKeywordParam = isCrimeHeist
    ? String(TMDB_THEME_IDS.crimeHeist || "10051|6492|10292|10391|242")
    : null;

  const psychologicalKeywordParam = wantsPsychological
    ? String(TMDB_THEME_IDS.psychologicalThriller || "10714|12565|9663")
    : null;

  // Use 9716 (dark comedy) only, without 9717 so stand-up comedy specials are not pulled
  const darkComedyKeywordParam = isDarkComedyIntent ? "9716" : null;

  const romcomKeywordParam = isRomComIntent
    ? String(TMDB_THEME_IDS.romcom || "9799|158718|3133")
    : null;

  const swordWarfareKeywordParam =
    isSwordWarfareIntent && !parsedIntent.excludeViolence
      ? String(TMDB_THEME_IDS.swordWarfare || "804|195779|2964")
      : null;

  const historicalWarKeywordParam =
    isHistoricalWarIntent && !parsedIntent.excludeViolence
      ? String(TMDB_THEME_IDS.historicalWar || "11162|233|210103")
      : null;

  const cyberpunkKeywordParam = isCyberpunkIntent
    ? String(TMDB_THEME_IDS.cyberpunk || "12190|4565|2853|156395")
    : null;

  const philosophicalSciFiKeywordParam = isPhilosophicalSciFiIntent
    ? String(TMDB_THEME_IDS.philosophicalSciFi || "10090|310|156395")
    : null;

  const underdogKeywordParam = isUnderdogIntent
    ? String(TMDB_THEME_IDS.underdog || "9882|10714|1803")
    : null;

  const cuteAnimeKeywordParam = isCuteAnimeRomComIntent
    ? String(TMDB_THEME_IDS.cuteAnimeRomCom || "9799|9840|158718")
    : null;

  const darkAnimeKeywordParam = isDarkAnimeIntent
    ? String(TMDB_THEME_IDS.darkAnime || "265|10714|9663|10085|210024")
    : null;

  const hauntedHouseKeywordParam = isHauntedHorrorIntent
    ? String(TMDB_THEME_IDS.hauntedHouse || "3358|10292|9715|9663")
    : null;

  const mindBlowingActionKeywordParam = isMindBlowingActionIntent
    ? String(TMDB_THEME_IDS.mindBlowingAction || "11162|9882|310|9663|12565")
    : null;

  const pureComedyKeywordParam = isPureComedyIntent
    ? String(TMDB_THEME_IDS.pureComedy || "9714|9713|10244|207317")
    : null;

  const strictFormatKeywordList = [];
  if (
    Array.isArray(parsedIntent.strictFormats) &&
    parsedIntent.strictFormats.includes("silent")
  ) {
    strictFormatKeywordList.push("154802");
  }
  if (
    Array.isArray(parsedIntent.strictFormats) &&
    parsedIntent.strictFormats.includes("black and white")
  ) {
    strictFormatKeywordList.push("10183");
  }
  const strictFormatKeywordParam =
    strictFormatKeywordList.length > 0
      ? strictFormatKeywordList.join(",")
      : null;

  const wantsSciFi =
    parsedIntent.detectedGenres.includes("scifi") ||
    wantsTimeTravel ||
    isCyberpunkIntent ||
    isPhilosophicalSciFiIntent ||
    isMindBlowingActionIntent;

  const isSciFiOnly =
    wantsSciFi &&
    !parsedIntent.detectedGenres.includes("fantasy") &&
    !wantsMagic;

  const tvFantasyExclude = isSciFiOnly
    ? "2343,33443,9799,12564,4152,12554,9663"
    : null;

  let excludedMovieGenres = [];
  if (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) {
    parsedIntent.excludedGenres.forEach((exG) => {
      if (isSwordWarfareIntent && exG === "war") return;
      if (TMDB_GENRE_IDS.movie[exG]) {
        excludedMovieGenres.push(String(TMDB_GENRE_IDS.movie[exG]));
      }
    });
  }

  if (parsedIntent.excludeViolence) {
    excludedMovieGenres.push("27");
  }

  if (
    !wantsSciFi &&
    (userWantsSports || isHistoricalWarIntent || isSwordWarfareIntent)
  ) {
    excludedMovieGenres.push("878", "16", "35", "80");
  } else if (isHauntedHorrorIntent) {
    excludedMovieGenres.push("10751", "10762", "35", "16");
  } else if (isSitcomIntent) {
    excludedMovieGenres.push(
      "27",
      "80",
      "9648",
      "53",
      "18",
      "10752",
      "36",
      "99",
      "16",
    );
  } else if (isDarkComedyIntent) {
    excludedMovieGenres.push("10751", "10762", "16", "99", "10402");
  } else if (isPureComedyIntent) {
    excludedMovieGenres.push(
      "28",
      "53",
      "80",
      "10749",
      "18",
      "10751",
      "10762",
      "16",
      "878",
      "14",
      "10752",
      "99",
      "27",
      "9648",
    );
  } else if (isMindBlowingActionIntent) {
    excludedMovieGenres.push("10751", "10762", "35");
  } else if (parsedIntent.isHorrorNight) {
    excludedMovieGenres.push("35", "16");
  } else if (isHeistRobberyIntent) {
    excludedMovieGenres.push("878", "14", "16", "27");
  } else if (isCrimeFamilyIntent) {
    excludedMovieGenres.push("10751", "10762", "16", "878", "14");
  } else if (isCrimeHeist) {
    if (!wantsSciFi) excludedMovieGenres.push("878");
    excludedMovieGenres.push("16", "14");
  } else if (isRomComIntent) {
    excludedMovieGenres.push("10752", "36", "27", "16");
  } else if (isFamilyAnimationIntent) {
    excludedMovieGenres.push("27", "80", "53");
  } else if (parsedIntent.detectedGenres.includes("family")) {
    excludedMovieGenres.push("27", "80", "53", "10752", "36", "99");
  } else if (isTrueCrimeDocIntent) {
    excludedMovieGenres.push("16", "878", "14", "35");
  } else if (isCyberpunkIntent) {
    excludedMovieGenres.push("10751", "35");
  } else if (isPhilosophicalSciFiIntent) {
    excludedMovieGenres.push("35");
  } else if (isComfortComedyIntent) {
    excludedMovieGenres.push(
      "18",
      "10752",
      "36",
      "27",
      "80",
      "9648",
      "53",
      "99",
      "14",
      "16",
    );
  } else if (isUnderdogIntent) {
    excludedMovieGenres.push("27", "14", "16");
  } else if (wantsPsychological) {
    excludedMovieGenres.push("35");
  } else if (isSciFiOnly) {
    excludedMovieGenres.push("14");
  } else if (wantsSciFi) {
    excludedMovieGenres.push("14");
  } else {
    excludedMovieGenres.push("16");
  }

  excludedMovieGenres = Array.from(new Set(excludedMovieGenres));
  const movieWithoutGenres = excludedMovieGenres.join(",");

  let withoutKeywordsList = [];
  if (excludeSuperheroParam) withoutKeywordsList.push(excludeSuperheroParam);
  if (isDarkComedyIntent) {
    withoutKeywordsList.push("9714"); // Exclude stand-up comedy specials
  }
  if (
    !isDarkComedyIntent &&
    (isRomComIntent || (isComfortComedyIntent && !isPureComedyIntent))
  ) {
    withoutKeywordsList.push("9716");
  }
  if (isFamilyAnimationIntent && !/\banime\b/i.test(cleanPrompt)) {
    withoutKeywordsList.push("210024");
  }
  if (
    isCuteAnimeRomComIntent ||
    parsedIntent.targetType === "anime" ||
    normalizedFocus === "anime"
  ) {
    withoutKeywordsList.push("2858", "190370", "9716");
  }
  if (isSitcomIntent) {
    withoutKeywordsList.push("6075", "9937", "11100");
  }
  if (parsedIntent.excludeViolence) {
    withoutKeywordsList.push("10292", "12339", "14760");
  }
  if (
    parsedIntent.excludedKeywords &&
    parsedIntent.excludedKeywords.length > 0
  ) {
    withoutKeywordsList.push(...parsedIntent.excludedKeywords);
  }
  withoutKeywordsList = Array.from(new Set(withoutKeywordsList));
  const withoutKeywordsParam =
    withoutKeywordsList.length > 0 ? withoutKeywordsList.join(",") : null;

  const animeAntiEcchiKeywords = Array.from(
    new Set(["2858", "190370", "9716", ...withoutKeywordsList]),
  ).join(",");

  let movieGenres = [];
  parsedIntent.detectedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.movie[g]) movieGenres.push(TMDB_GENRE_IDS.movie[g]);
  });

  if (
    (isCrimeHeist || isHeistRobberyIntent || isCrimeFamilyIntent) &&
    !movieGenres.includes(80)
  ) {
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
    (wantsTimeTravel ||
      isCyberpunkIntent ||
      isPhilosophicalSciFiIntent ||
      isMindBlowingActionIntent ||
      wantsSciFi) &&
    !movieGenres.includes(878)
  ) {
    movieGenres.unshift(878);
  }

  if (isUnderdogIntent && !movieGenres.includes(18)) {
    movieGenres.unshift(18);
  }

  if (isHauntedHorrorIntent && !movieGenres.includes(27)) {
    movieGenres.unshift(27);
  }

  if (isMindBlowingActionIntent && !movieGenres.includes(28)) {
    movieGenres.unshift(28);
  }

  if ((isPureComedyIntent || isDarkComedyIntent) && !movieGenres.includes(35)) {
    movieGenres.unshift(35);
  }

  let tvGenres = [];
  parsedIntent.detectedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.tv[g]) tvGenres.push(TMDB_GENRE_IDS.tv[g]);
  });
  if (
    (isCrimeHeist || isHeistRobberyIntent || isCrimeFamilyIntent) &&
    !tvGenres.includes(80)
  ) {
    tvGenres.unshift(80);
  }
  if (wantsPsychological && !tvGenres.includes(9648)) {
    tvGenres.unshift(9648);
  }
  if (
    (wantsTimeTravel ||
      isCyberpunkIntent ||
      isPhilosophicalSciFiIntent ||
      isMindBlowingActionIntent ||
      wantsSciFi) &&
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

  const usePipeGenreSeparator = Boolean(
    parsedIntent.excludeViolence ||
    (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) ||
    isClassicPre1980Era ||
    isArabicOrEgyptianQuery ||
    movieGenres.length >= 2,
  );
  let primaryMovieGenre =
    movieGenres.length > 0
      ? movieGenres.join(usePipeGenreSeparator ? "|" : ",")
      : null;
  let primaryTvGenre = tvGenres.length > 0 ? tvGenres.join("|") : null;

  if (wantsSciFi) {
    primaryMovieGenre = isMindBlowingActionIntent ? "28,878" : "878";
    primaryTvGenre = "10765";
  }

  if (
    isComfortComedyIntent ||
    isPureComedyIntent ||
    isSitcomIntent ||
    isDarkComedyIntent
  ) {
    primaryMovieGenre = "35";
    primaryTvGenre = "35";
  }

  if (isRomComIntent) {
    primaryMovieGenre = "35,10749";
  }

  if (isSwordWarfareIntent) {
    primaryMovieGenre = parsedIntent.excludeViolence
      ? "36|12|10751"
      : "36|10752";
    primaryTvGenre = "10768|36";
  } else if (isHistoricalWarIntent) {
    primaryMovieGenre = parsedIntent.excludeViolence ? "36|18" : "10752|36";
    primaryTvGenre = "10768|36";
  }

  if (isTrueCrimeDocIntent) {
    primaryMovieGenre = "99";
    primaryTvGenre = "99";
  }

  if (isFamilyAnimationIntent) {
    primaryMovieGenre = "16,10751";
    primaryTvGenre = "16,10751";
  } else if (parsedIntent.detectedGenres.includes("family")) {
    primaryMovieGenre = "10751";
    primaryTvGenre = "10751";
  }

  if (isUnderdogIntent) {
    primaryMovieGenre = "18";
  }

  if (isCrimeFamilyIntent) {
    primaryMovieGenre = "80";
    primaryTvGenre = "80|18";
  }

  if (isCuteAnimeRomComIntent) {
    primaryTvGenre = "35,10749,16";
  }

  if (isHauntedHorrorIntent) {
    primaryMovieGenre = "27";
    primaryTvGenre = "27";
  }

  if (isMindBlowingActionIntent) {
    primaryMovieGenre = "28,878";
    primaryTvGenre = "10759,10765";
  }

  const isRegionalNonEnglish = Boolean(
    (parsedIntent.detectedLanguage && parsedIntent.detectedLanguage !== "en") ||
    (parsedIntent.detectedCountry &&
      !["US", "GB"].includes(parsedIntent.detectedCountry)),
  );

  const hasTightConstraints = Boolean(
    parsedIntent.minYear !== null ||
    parsedIntent.maxYear !== null ||
    parsedIntent.minRating !== null ||
    Boolean(parsedIntent.extractedDirector) ||
    resolvedActorIds.length > 0 ||
    Boolean(parsedIntent.isNowPlaying) ||
    Boolean(parsedIntent.isHyperSpecific) ||
    Boolean(parsedIntent.excludeViolence) ||
    hasStrictFormats ||
    isRegionalNonEnglish ||
    (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) ||
    isDarkComedyIntent ||
    wantsTimeTravel ||
    isHauntedHorrorIntent ||
    isHeistRobberyIntent ||
    isCrimeFamilyIntent ||
    isCrimeHeist ||
    parsedIntent.detectedLanguage ||
    parsedIntent.detectedCountry,
  );

  const movieMinVotes =
    isClassicPre1980Era || isArabicOrEgyptianQuery
      ? 3
      : parsedIntent.isNowPlaying
        ? 25
        : isRegionalNonEnglish || hasStrictFormats
          ? 20
          : hasTightConstraints
            ? 60
            : 300;
  const tvMinVotes =
    isClassicPre1980Era || isArabicOrEgyptianQuery
      ? 3
      : isRegionalNonEnglish || hasStrictFormats
        ? 20
        : hasTightConstraints
          ? 40
          : 200;

  const minReleaseDateStr = parsedIntent.isNowPlaying
    ? oneFiftyDaysAgoStr
    : parsedIntent.minYear
      ? `${parsedIntent.minYear}-01-01`
      : null;

  const rawMaxReleaseDateStr = parsedIntent.isNowPlaying
    ? todayStr
    : parsedIntent.maxYear
      ? `${parsedIntent.maxYear}-12-31`
      : todayStr;
  const maxReleaseDateStr =
    rawMaxReleaseDateStr < todayStr ? rawMaxReleaseDateStr : todayStr;

  // CRITICAL ACTOR GUARD: NEVER run generic /discover/movie or /discover/tv when an actor or director is requested!
  const shouldRunDiscover = !resolvedDirectorId && !hasExplicitActorRequest;

  if (shouldRunDiscover) {
    if (parsedIntent.targetType === "mixed" && !parsedIntent.isNowPlaying) {
      const movieParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": movieMinVotes,
        "vote_average.gte": effectiveRatingFloor,
        sort_by: "popularity.desc",
        without_genres: movieWithoutGenres,
        "primary_release_date.lte": maxReleaseDateStr,
      };

      if (parsedIntent.excludeViolence && !isRegionalNonEnglish) {
        movieParams.certification_country = "US";
        movieParams["certification.lte"] = "PG-13";
      }

      if (minReleaseDateStr) {
        movieParams["primary_release_date.gte"] = minReleaseDateStr;
      }

      if (parsedIntent.detectedLanguage) {
        movieParams.with_original_language = parsedIntent.detectedLanguage;
      }
      if (parsedIntent.detectedCountry) {
        movieParams.with_origin_country = parsedIntent.detectedCountry;
      }

      if (primaryMovieGenre) movieParams.with_genres = primaryMovieGenre;

      if (strictFormatKeywordParam) {
        movieParams.with_keywords = strictFormatKeywordParam;
      } else if (superheroKeywordParam) {
        movieParams.with_keywords = superheroKeywordParam;
      } else if (darkComedyKeywordParam) {
        movieParams.with_keywords = darkComedyKeywordParam;
      } else if (pureComedyKeywordParam) {
        movieParams.with_keywords = pureComedyKeywordParam;
      } else if (mindBlowingActionKeywordParam) {
        movieParams.with_keywords = mindBlowingActionKeywordParam;
      } else if (hauntedHouseKeywordParam) {
        movieParams.with_keywords = hauntedHouseKeywordParam;
      } else if (crimeFamilyKeywordParam) {
        movieParams.with_keywords = crimeFamilyKeywordParam;
      } else if (trueCrimeKeywordParam) {
        movieParams.with_keywords = trueCrimeKeywordParam;
      } else if (underdogKeywordParam) {
        movieParams.with_keywords = underdogKeywordParam;
      } else if (heistKeywordParam) {
        movieParams.with_keywords = heistKeywordParam;
      } else if (cyberpunkKeywordParam) {
        movieParams.with_keywords = cyberpunkKeywordParam;
      } else if (philosophicalSciFiKeywordParam) {
        movieParams.with_keywords = philosophicalSciFiKeywordParam;
      } else if (swordWarfareKeywordParam) {
        movieParams.with_keywords = swordWarfareKeywordParam;
      } else if (historicalWarKeywordParam) {
        movieParams.with_keywords = historicalWarKeywordParam;
      } else if (romcomKeywordParam) {
        movieParams.with_keywords = romcomKeywordParam;
      } else if (psychologicalKeywordParam) {
        movieParams.with_keywords = psychologicalKeywordParam;
      } else if (crimeHeistKeywordParam) {
        movieParams.with_keywords = crimeHeistKeywordParam;
      } else if (complexKeywordParam && (wantsTimeTravel || !wantsSciFi)) {
        movieParams.with_keywords = complexKeywordParam;
      } else if (sportsKeywordParam) {
        movieParams.with_keywords = sportsKeywordParam;
      }

      if (withoutKeywordsParam) {
        movieParams.without_keywords = withoutKeywordsParam;
      }

      let tvExcludedIds = [];
      if (
        parsedIntent.excludedGenres &&
        parsedIntent.excludedGenres.length > 0
      ) {
        parsedIntent.excludedGenres.forEach((exG) => {
          if (isSwordWarfareIntent && exG === "war") return;
          if (TMDB_GENRE_IDS.tv[exG]) {
            tvExcludedIds.push(String(TMDB_GENRE_IDS.tv[exG]));
          }
        });
      }

      if (parsedIntent.excludeViolence) {
        tvExcludedIds.push("27");
      }

      if (parsedIntent.excludedGenres.includes("comedy")) {
        tvExcludedIds.push("35");
      }

      const defaultTvWithout = isFamilyAnimationIntent
        ? ["27", "53", "80"]
        : isSitcomIntent
          ? [
              "18",
              "16",
              "10765",
              "10768",
              "10762",
              "10766",
              "27",
              "80",
              "9648",
              "53",
            ]
          : isComfortComedyIntent || isPureComedyIntent
            ? ["18", "16", "10765", "10768", "10762", "27", "80", "9648", "53"]
            : isCrimeFamilyIntent || isHauntedHorrorIntent
              ? ["10751", "10762", "16"]
              : ["16", "10767", "10763", "10764"];

      const tvWithoutGenres = Array.from(
        new Set([...defaultTvWithout, ...tvExcludedIds]),
      ).join(",");

      const liveTvParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": tvMinVotes,
        "vote_average.gte": effectiveRatingFloor,
        sort_by: "popularity.desc",
        without_genres: tvWithoutGenres,
        "first_air_date.lte": maxReleaseDateStr,
      };

      if (minReleaseDateStr) {
        liveTvParams["first_air_date.gte"] = minReleaseDateStr;
      }

      if (parsedIntent.detectedLanguage) {
        liveTvParams.with_original_language = parsedIntent.detectedLanguage;
      }
      if (parsedIntent.detectedCountry) {
        liveTvParams.with_origin_country = parsedIntent.detectedCountry;
      }

      if (primaryTvGenre) liveTvParams.with_genres = primaryTvGenre;

      if (strictFormatKeywordParam) {
        liveTvParams.with_keywords = strictFormatKeywordParam;
      } else if (superheroKeywordParam) {
        liveTvParams.with_keywords = superheroKeywordParam;
      } else if (darkComedyKeywordParam) {
        liveTvParams.with_keywords = darkComedyKeywordParam;
      } else if (pureComedyKeywordParam) {
        liveTvParams.with_keywords = pureComedyKeywordParam;
      } else if (mindBlowingActionKeywordParam) {
        liveTvParams.with_keywords = mindBlowingActionKeywordParam;
      } else if (hauntedHouseKeywordParam) {
        liveTvParams.with_keywords = hauntedHouseKeywordParam;
      } else if (crimeFamilyKeywordParam) {
        liveTvParams.with_keywords = crimeFamilyKeywordParam;
      } else if (trueCrimeKeywordParam) {
        liveTvParams.with_keywords = trueCrimeKeywordParam;
      } else if (underdogKeywordParam) {
        liveTvParams.with_keywords = underdogKeywordParam;
      } else if (heistKeywordParam) {
        liveTvParams.with_keywords = heistKeywordParam;
      } else if (cyberpunkKeywordParam) {
        liveTvParams.with_keywords = cyberpunkKeywordParam;
      } else if (philosophicalSciFiKeywordParam) {
        liveTvParams.with_keywords = philosophicalSciFiKeywordParam;
      } else if (historicalWarKeywordParam) {
        liveTvParams.with_keywords = historicalWarKeywordParam;
      } else if (psychologicalKeywordParam) {
        liveTvParams.with_keywords = psychologicalKeywordParam;
      } else if (crimeHeistKeywordParam) {
        liveTvParams.with_keywords = crimeHeistKeywordParam;
      } else if (complexKeywordParam && (wantsTimeTravel || !wantsSciFi)) {
        liveTvParams.with_keywords = complexKeywordParam;
      } else if (sportsKeywordParam) {
        liveTvParams.with_keywords = sportsKeywordParam;
      }
      if (tvFantasyExclude) liveTvParams.without_keywords = tvFantasyExclude;

      let animeWithoutList = ["10762"];
      if (parsedIntent.excludeViolence) {
        animeWithoutList.push("27");
      }
      if (parsedIntent.excludedGenres.includes("comedy")) {
        animeWithoutList.push("35");
      }
      if (parsedIntent.excludedGenres.includes("family")) {
        animeWithoutList.push("10751");
      }
      const animeWithoutGenresParam =
        animeWithoutList.length > 0
          ? Array.from(new Set(animeWithoutList)).join(",")
          : undefined;

      const animeParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": 80,
        "vote_average.gte": effectiveRatingFloor,
        sort_by: "popularity.desc",
        with_original_language: "ja",
        with_genres:
          isCuteAnimeRomComIntent || isRomComIntent
            ? "35,10749,16"
            : wantsMagic
              ? "10765,16"
              : primaryTvGenre
                ? `${primaryTvGenre},16`
                : "16",
        without_keywords: animeAntiEcchiKeywords,
        "first_air_date.lte": maxReleaseDateStr,
      };

      if (animeWithoutGenresParam) {
        animeParams.without_genres = animeWithoutGenresParam;
      }

      if (minReleaseDateStr) {
        animeParams["first_air_date.gte"] = minReleaseDateStr;
      }

      if (strictFormatKeywordParam)
        animeParams.with_keywords = strictFormatKeywordParam;
      else if (cuteAnimeKeywordParam)
        animeParams.with_keywords = cuteAnimeKeywordParam;
      else if (darkAnimeKeywordParam)
        animeParams.with_keywords = darkAnimeKeywordParam;
      else if (wantsMagic) animeParams.with_keywords = "2343|9799";
      else if (cyberpunkKeywordParam)
        animeParams.with_keywords = cyberpunkKeywordParam;
      else if (complexKeywordParam && (wantsTimeTravel || !wantsSciFi))
        animeParams.with_keywords = complexKeywordParam;
      else if (sportsKeywordParam)
        animeParams.with_keywords = sportsKeywordParam;

      if (tvFantasyExclude && !wantsMagic) {
        animeParams.without_keywords = `${animeAntiEcchiKeywords},${tvFantasyExclude}`;
      }

      const moviePromises = [
        cachedTmdbGet("https://api.themoviedb.org/3/discover/movie", {
          params: { ...movieParams, page: 1 },
        }).catch(() => ({ data: { results: [] } })),
        cachedTmdbGet("https://api.themoviedb.org/3/discover/movie", {
          params: { ...movieParams, page: 2 },
        }).catch(() => ({ data: { results: [] } })),
      ];

      const tvPromises = [
        cachedTmdbGet("https://api.themoviedb.org/3/discover/tv", {
          params: { ...liveTvParams, page: 1 },
        }).catch(() => ({ data: { results: [] } })),
        cachedTmdbGet("https://api.themoviedb.org/3/discover/tv", {
          params: { ...liveTvParams, page: 2 },
        }).catch(() => ({ data: { results: [] } })),
      ];

      const animePromise =
        isComfortComedyIntent ||
        isHauntedHorrorIntent ||
        isPureComedyIntent ||
        isDarkComedyIntent ||
        isSitcomIntent ||
        isSwordWarfareIntent ||
        hasStrictFormats ||
        parsedIntent.isLiveAction ||
        (parsedIntent.detectedLanguage &&
          parsedIntent.detectedLanguage !== "ja")
          ? Promise.resolve({ data: { results: [] } })
          : cachedTmdbGet("https://api.themoviedb.org/3/discover/tv", {
              params: animeParams,
            }).catch(() => ({ data: { results: [] } }));

      const [movieResList, tvResList, animeRes] = await Promise.all([
        Promise.all(moviePromises),
        Promise.all(tvPromises),
        animePromise,
      ]);

      let movies = [];
      movieResList.forEach((r) => {
        if (r.data?.results) {
          movies.push(
            ...r.data.results.map((m) => ({
              ...m,
              media_type: "movie",
              matched_strict_format: Boolean(strictFormatKeywordParam),
            })),
          );
        }
      });

      let liveTvs = [];
      tvResList.forEach((r) => {
        if (r.data?.results) {
          liveTvs.push(
            ...r.data.results.map((t) => ({
              ...t,
              media_type: "tv",
              matched_strict_format: Boolean(strictFormatKeywordParam),
            })),
          );
        }
      });

      const animes = (animeRes.data?.results || []).map((a) => ({
        ...a,
        media_type: "anime",
        matched_strict_format: Boolean(strictFormatKeywordParam),
      }));

      candidates = [...candidates, ...movies, ...liveTvs, ...animes];
    } else if (
      parsedIntent.targetType === "anime" &&
      !parsedIntent.isNowPlaying
    ) {
      let animeWithoutList = ["10762"];
      if (parsedIntent.excludeViolence) {
        animeWithoutList.push("27");
      }
      if (parsedIntent.excludedGenres.includes("comedy")) {
        animeWithoutList.push("35");
      }
      if (parsedIntent.excludedGenres.includes("family")) {
        animeWithoutList.push("10751");
      }
      const animeWithoutGenresParam =
        animeWithoutList.length > 0
          ? Array.from(new Set(animeWithoutList)).join(",")
          : undefined;

      const animeParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": 80,
        "vote_average.gte": effectiveRatingFloor,
        sort_by: "popularity.desc",
        with_original_language: "ja",
        with_genres:
          isCuteAnimeRomComIntent || isRomComIntent
            ? "35,10749,16"
            : wantsMagic
              ? "10765,16"
              : primaryTvGenre
                ? `${primaryTvGenre},16`
                : "16",
        without_keywords: animeAntiEcchiKeywords,
        "first_air_date.lte": maxReleaseDateStr,
      };

      if (animeWithoutGenresParam) {
        animeParams.without_genres = animeWithoutGenresParam;
      }

      if (minReleaseDateStr) {
        animeParams["first_air_date.gte"] = minReleaseDateStr;
      }

      if (strictFormatKeywordParam)
        animeParams.with_keywords = strictFormatKeywordParam;
      else if (cuteAnimeKeywordParam)
        animeParams.with_keywords = cuteAnimeKeywordParam;
      else if (darkAnimeKeywordParam)
        animeParams.with_keywords = darkAnimeKeywordParam;
      else if (wantsMagic) animeParams.with_keywords = "2343|9799";
      else if (cyberpunkKeywordParam)
        animeParams.with_keywords = cyberpunkKeywordParam;
      else if (complexKeywordParam && (wantsTimeTravel || !wantsSciFi))
        animeParams.with_keywords = complexKeywordParam;
      else if (sportsKeywordParam)
        animeParams.with_keywords = sportsKeywordParam;

      if (tvFantasyExclude && !wantsMagic) {
        animeParams.without_keywords = `${animeAntiEcchiKeywords},${tvFantasyExclude}`;
      }

      const tvRes = await cachedTmdbGet(
        "https://api.themoviedb.org/3/discover/tv",
        { params: animeParams },
      );
      candidates = [
        ...candidates,
        ...(tvRes.data.results || []).map((a) => ({
          ...a,
          media_type: "anime",
          matched_strict_format: Boolean(strictFormatKeywordParam),
        })),
      ];
    } else {
      const isTv =
        parsedIntent.targetType === "tv" && !parsedIntent.isNowPlaying;
      const endpoint = isTv
        ? "https://api.themoviedb.org/3/discover/tv"
        : "https://api.themoviedb.org/3/discover/movie";

      const singleParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": isTv ? tvMinVotes : movieMinVotes,
        "vote_average.gte": effectiveRatingFloor,
        sort_by: "popularity.desc",
        [isTv ? "first_air_date.lte" : "primary_release_date.lte"]:
          maxReleaseDateStr,
      };

      if (!isTv && parsedIntent.excludeViolence && !isRegionalNonEnglish) {
        singleParams.certification_country = "US";
        singleParams["certification.lte"] = "PG-13";
      }

      if (minReleaseDateStr) {
        singleParams[isTv ? "first_air_date.gte" : "primary_release_date.gte"] =
          minReleaseDateStr;
      }

      if (parsedIntent.detectedLanguage) {
        singleParams.with_original_language = parsedIntent.detectedLanguage;
      }
      if (parsedIntent.detectedCountry) {
        singleParams.with_origin_country = parsedIntent.detectedCountry;
      }

      const targetPrimary = isTv ? primaryTvGenre : primaryMovieGenre;
      if (targetPrimary) singleParams.with_genres = targetPrimary;

      if (strictFormatKeywordParam) {
        singleParams.with_keywords = strictFormatKeywordParam;
      } else if (superheroKeywordParam) {
        singleParams.with_keywords = superheroKeywordParam;
      } else if (darkComedyKeywordParam) {
        singleParams.with_keywords = darkComedyKeywordParam;
      } else if (pureComedyKeywordParam) {
        singleParams.with_keywords = pureComedyKeywordParam;
      } else if (mindBlowingActionKeywordParam) {
        singleParams.with_keywords = mindBlowingActionKeywordParam;
      } else if (hauntedHouseKeywordParam) {
        singleParams.with_keywords = hauntedHouseKeywordParam;
      } else if (cuteAnimeKeywordParam) {
        singleParams.with_keywords = cuteAnimeKeywordParam;
      } else if (darkAnimeKeywordParam) {
        singleParams.with_keywords = darkAnimeKeywordParam;
      } else if (crimeFamilyKeywordParam) {
        singleParams.with_keywords = crimeFamilyKeywordParam;
      } else if (trueCrimeKeywordParam) {
        singleParams.with_keywords = trueCrimeKeywordParam;
      } else if (underdogKeywordParam) {
        singleParams.with_keywords = underdogKeywordParam;
      } else if (heistKeywordParam) {
        singleParams.with_keywords = heistKeywordParam;
      } else if (philosophicalSciFiKeywordParam) {
        singleParams.with_keywords = philosophicalSciFiKeywordParam;
      } else if (cyberpunkKeywordParam) {
        singleParams.with_keywords = cyberpunkKeywordParam;
      } else if (swordWarfareKeywordParam && !isTv) {
        singleParams.with_keywords = swordWarfareKeywordParam;
      } else if (historicalWarKeywordParam) {
        singleParams.with_keywords = historicalWarKeywordParam;
      } else if (romcomKeywordParam) {
        singleParams.with_keywords = romcomKeywordParam;
      } else if (psychologicalKeywordParam) {
        singleParams.with_keywords = psychologicalKeywordParam;
      } else if (crimeHeistKeywordParam) {
        singleParams.with_keywords = crimeHeistKeywordParam;
      } else if (complexKeywordParam && (wantsTimeTravel || !wantsSciFi)) {
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
        let tvExcludedIds = [];
        if (
          parsedIntent.excludedGenres &&
          parsedIntent.excludedGenres.length > 0
        ) {
          parsedIntent.excludedGenres.forEach((exG) => {
            if (isSwordWarfareIntent && exG === "war") return;
            if (TMDB_GENRE_IDS.tv[exG]) {
              tvExcludedIds.push(String(TMDB_GENRE_IDS.tv[exG]));
            }
          });
        }
        if (parsedIntent.excludeViolence) {
          tvExcludedIds.push("27");
        }
        if (parsedIntent.excludedGenres.includes("comedy")) {
          tvExcludedIds.push("35");
        }
        const defaultTvWithout = isFamilyAnimationIntent
          ? ["27", "53", "80"]
          : isSitcomIntent
            ? [
                "18",
                "16",
                "10765",
                "10768",
                "10762",
                "10766",
                "27",
                "80",
                "9648",
                "53",
              ]
            : isComfortComedyIntent || isPureComedyIntent
              ? [
                  "18",
                  "16",
                  "10765",
                  "10768",
                  "10762",
                  "27",
                  "80",
                  "9648",
                  "53",
                ]
              : isCrimeFamilyIntent || isHauntedHorrorIntent
                ? ["10751", "10762", "16"]
                : isCuteAnimeRomComIntent
                  ? ["10762"]
                  : ["16", "10767", "10763", "10764"];

        singleParams.without_genres = Array.from(
          new Set([...defaultTvWithout, ...tvExcludedIds]),
        ).join(",");

        if (isCuteAnimeRomComIntent) {
          singleParams.with_genres = "35,10749,16";
          singleParams.without_keywords = animeAntiEcchiKeywords;
        } else if (tvFantasyExclude) {
          singleParams.without_keywords = tvFantasyExclude;
        }
      }

      try {
        const [p1Res, p2Res] = await Promise.all([
          cachedTmdbGet(endpoint, { params: { ...singleParams, page: 1 } }),
          cachedTmdbGet(endpoint, { params: { ...singleParams, page: 2 } }),
        ]);
        let fetchedSingleList = [
          ...(p1Res.data.results || []),
          ...(p2Res.data.results || []),
        ];

        if (
          fetchedSingleList.length < 4 &&
          (singleParams.with_keywords || singleParams.certification_country)
        ) {
          const relaxedParams = { ...singleParams };
          delete relaxedParams.with_keywords;
          delete relaxedParams.certification_country;
          delete relaxedParams["certification.lte"];
          const suppRes = await cachedTmdbGet(endpoint, {
            params: { ...relaxedParams, page: 1 },
          }).catch(() => ({ data: { results: [] } }));
          fetchedSingleList.push(...(suppRes.data?.results || []));
        }

        candidates = [
          ...candidates,
          ...fetchedSingleList.map((it) => ({
            ...it,
            media_type: isTv ? "tv" : "movie",
            matched_strict_format: Boolean(strictFormatKeywordParam),
          })),
        ];
      } catch (err) {
        const resData = await cachedTmdbGet(endpoint, { params: singleParams });
        candidates = [
          ...candidates,
          ...(resData.data.results || []).map((it) => ({
            ...it,
            media_type: isTv ? "tv" : "movie",
            matched_strict_format: Boolean(strictFormatKeywordParam),
          })),
        ];
      }
    }
  }

  // 5. Apply temporal range filtering and vote count floor across all candidates
  candidates = candidates.filter((item) => {
    const relDate = item.release_date || item.first_air_date;
    const voteCount = item.vote_count || 0;

    if (!relDate || relDate > todayStr) return false;

    if (parsedIntent.isNowPlaying) {
      if (item.media_type && item.media_type !== "movie") return false;
      if (relDate < oneFiftyDaysAgoStr) return false;
    }

    const itemYear = parseInt(relDate.split("-")[0], 10);
    if (parsedIntent.minYear && itemYear < parsedIntent.minYear) return false;
    if (parsedIntent.maxYear && itemYear > parsedIntent.maxYear) return false;

    if (
      item.isActorMatch ||
      hasExplicitActorRequest ||
      isClassicPre1980Era ||
      isArabicOrEgyptianQuery ||
      itemYear < 1980 ||
      item.original_language === "ar"
    ) {
      return true;
    }

    const minAllowedVotes = parsedIntent.isNowPlaying
      ? 20
      : isRegionalNonEnglish || hasStrictFormats || hasPre1970Era
        ? 15
        : hasTightConstraints
          ? 25
          : parsedIntent.targetType === "anime" ||
              isCuteAnimeRomComIntent ||
              isDarkAnimeIntent ||
              isKoreanIntent ||
              isTrueCrimeDocIntent
            ? 40
            : 200;

    return voteCount >= minAllowedVotes;
  });

  const watchedIds =
    typeof getWatchedIdsFn === "function"
      ? await getWatchedIdsFn(candidates)
      : new Set();

  candidates = candidates.filter(
    (c) => !watchedIds.has(Number(c.id)) && !sessionSeenIds.has(Number(c.id)),
  );

  const uniqueCandidatesMap = new Map();
  candidates.forEach((c) => {
    if (!uniqueCandidatesMap.has(c.id)) {
      uniqueCandidatesMap.set(c.id, c);
    } else {
      const existing = uniqueCandidatesMap.get(c.id);
      if (c.isActorMatch && !existing.isActorMatch) {
        uniqueCandidatesMap.set(c.id, { ...existing, ...c });
      }
    }
  });
  candidates = Array.from(uniqueCandidatesMap.values());

  candidates = candidates.map((c) => {
    const textualGenres = (c.genre_ids || [])
      .map((id) => TMDB_ID_TO_NAME[id] || "")
      .filter(Boolean);
    return { ...c, genres: textualGenres };
  });

  // =========================================================================
  // 9. Post-Recommendation & Pre-Scoring Strict Filtering
  // =========================================================================
  const isSciFiAnchor =
    resolvedAnchors.some(
      (a) =>
        a.media?.genre_ids?.includes(878) ||
        a.media?.genre_ids?.includes(10765) ||
        a.meta?.genre === "scifi",
    ) || parsedIntent.detectedGenres.includes("scifi");

  const excludedGenreIds = new Set(parsedIntent.excludedGenreIds || []);
  if (parsedIntent.excludeViolence) {
    excludedGenreIds.add(27);
  }
  const excludedKeywordIds = new Set(parsedIntent.excludedKeywords || []);

  const excludedTerms = [...(parsedIntent.excludedTermsFromPrompt || [])];
  (parsedIntent.excludedGenres || []).forEach((g) => {
    if (isSwordWarfareIntent && g === "war") return;
    if (g === "horror") {
      excludedTerms.push(
        "horror",
        "slasher",
        "demonic",
        "exorcism",
        "terrifying",
      );
      return;
    }
    if (genreMap[g]) excludedTerms.push(...genreMap[g]);
  });

  const superheroRegex =
    /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc\s*comics|comic\s*book|avengers|batman|superman|wonder woman|justice society|justice league|flash|aquaman)\b/i;

  const wantsNoSuperhero =
    excludedKeywordIds.has("9715") ||
    /\b(?:no|exclude|without|except|zero)\s+.*?\b(superhero|marvel|dc|superheroes)\b/i.test(
      cleanPrompt,
    );

  const requiredStrictGenreIdSet = new Set();
  if (
    Array.isArray(parsedIntent.detectedGenres) &&
    parsedIntent.detectedGenres.length > 0
  ) {
    parsedIntent.detectedGenres.forEach((g) => {
      if (TMDB_GENRE_IDS.movie[g]) {
        requiredStrictGenreIdSet.add(Number(TMDB_GENRE_IDS.movie[g]));
      }
      if (TMDB_GENRE_IDS.tv[g]) {
        requiredStrictGenreIdSet.add(Number(TMDB_GENRE_IDS.tv[g]));
      }
    });
  }

  candidates = candidates.filter((c) => {
    const itemGenreIds = c.genre_ids || [];
    const titleText = (c.title || c.name || "").toLowerCase();
    const fullText = `${titleText} ${c.overview || ""}`.toLowerCase();
    const relDate = c.release_date || c.first_air_date || "";
    const itemYear = relDate ? parseInt(relDate.split("-")[0], 10) : 0;

    const rawKw = Array.isArray(c.keywords)
      ? c.keywords
      : c.keywords?.keywords || c.keywords?.results || [];
    const itemKwIds = rawKw
      .map((k) => (typeof k === "object" ? k?.id : Number(k)))
      .filter(Boolean);

    // Filter out stand-up comedy specials when Dark Comedy is requested
    if (isDarkComedyIntent) {
      if (
        itemGenreIds.includes(99) ||
        itemGenreIds.includes(10402) ||
        /\b(stand-up|stand up|comedy special|live at|bo burnham|bill burr|dave chappelle|ricky gervais|louis c\.k\.|kevin hart|chris rock|jim jefferies|george carlin)\b/i.test(
          fullText,
        )
      ) {
        return false;
      }
    }

    if (parsedIntent.excludeViolence) {
      if (
        itemGenreIds.includes(27) ||
        EXTREME_VIOLENCE_GORE_FILTER_REGEX.test(titleText) ||
        EXTREME_VIOLENCE_GORE_FILTER_REGEX.test(fullText)
      ) {
        return false;
      }
    }

    if (hasStrictFormats) {
      if (parsedIntent.strictFormats.includes("silent")) {
        const isVerifiedSilent =
          Boolean(c.matched_strict_format) ||
          itemKwIds.includes(154802) ||
          /\b(silent|silent film|silent movie|silent era|pantomime|intertitles)\b/i.test(
            fullText,
          ) ||
          (itemYear > 0 && itemYear <= 1931);
        if (!isVerifiedSilent) return false;
      }
      if (parsedIntent.strictFormats.includes("black and white")) {
        const isVerifiedBw =
          Boolean(c.matched_strict_format) ||
          itemKwIds.includes(10183) ||
          /\b(black and white|black & white|b&w|monochrome|noir)\b/i.test(
            fullText,
          ) ||
          (itemYear > 0 && itemYear <= 1960);
        if (!isVerifiedBw) return false;
      }
    }

    if (
      requiredStrictGenreIdSet.size > 0 &&
      (hasExplicitActorRequest ||
        Boolean(resolvedDirectorId) ||
        isStrictNoFallbackQuery)
    ) {
      const matchesRequestedGenre = itemGenreIds.some((id) =>
        requiredStrictGenreIdSet.has(Number(id)),
      );
      if (!matchesRequestedGenre) return false;
    }

    const isAnimeCandidate =
      c.media_type === "anime" ||
      (c.original_language === "ja" && itemGenreIds.includes(16));

    if (isAnimeIntent) {
      if (c.original_language !== "ja" || !itemGenreIds.includes(16)) {
        return false;
      }
    }

    if (isAnimeCandidate || isAnimeIntent || isCuteAnimeRomComIntent) {
      const hasEcchiKw = itemKwIds.some((id) =>
        [2858, 190370, 9716].includes(id),
      );
      if (
        hasEcchiKw ||
        ECCHI_HAREM_FILTER_REGEX.test(titleText) ||
        ECCHI_HAREM_FILTER_REGEX.test(fullText)
      ) {
        return false;
      }
      if (
        isCuteAnimeRomComIntent &&
        (itemGenreIds.includes(10762) ||
          KIDS_MASCOT_FILTER_REGEX.test(titleText))
      ) {
        return false;
      }
    }

    if (isSitcomIntent) {
      if (
        itemGenreIds.includes(27) ||
        itemGenreIds.includes(80) ||
        itemGenreIds.includes(53)
      ) {
        return false;
      }
    }

    if (
      isSwordWarfareIntent &&
      parsedIntent.targetType !== "anime" &&
      normalizedFocus !== "anime" &&
      !parsedIntent.wantsExplicitAnime
    ) {
      if (isAnimeCandidate || itemGenreIds.includes(16)) {
        return false;
      }
    }

    if (parsedIntent.detectedGenres.includes("scifi")) {
      const hasSciFiGenre =
        itemGenreIds.includes(878) ||
        itemGenreIds.includes(10765) ||
        (wantsTimeTravel &&
          /\b(time loop|time travel|groundhog day|palm springs|predestination|source code|looper|edge of tomorrow)\b/i.test(
            fullText,
          ));
      if (!hasSciFiGenre) {
        return false;
      }
    }

    if (isSciFiAnchor) {
      const isPureHorror =
        itemGenreIds.includes(27) &&
        !itemGenreIds.includes(878) &&
        !itemGenreIds.includes(10765);
      const isPureCrimeOrTrueCrime =
        (itemGenreIds.includes(80) || itemGenreIds.includes(99)) &&
        !itemGenreIds.includes(878) &&
        !itemGenreIds.includes(10765);
      if (isPureHorror || isPureCrimeOrTrueCrime) {
        return false;
      }
    }

    if (isSwordWarfareIntent) {
      const hasModernGunsOrCrime =
        MODERN_WARFARE_GUNS_FILTER_REGEX.test(titleText) ||
        MODERN_WARFARE_GUNS_FILTER_REGEX.test(fullText) ||
        (itemGenreIds.includes(80) &&
          !SWORD_WARFARE_THEMES_REGEX.test(fullText));
      if (hasModernGunsOrCrime) {
        return false;
      }
    }

    if (
      c.genre_ids &&
      Array.isArray(c.genre_ids) &&
      c.genre_ids.some((id) => excludedGenreIds.has(Number(id)))
    ) {
      return false;
    }

    if (
      parsedIntent.excludedGenres.includes("family") &&
      (itemGenreIds.includes(10751) ||
        itemGenreIds.includes(10762) ||
        KIDS_MASCOT_FILTER_REGEX.test(titleText))
    ) {
      return false;
    }

    if (wantsNoSuperhero) {
      const hasSuperheroKeyword = itemKwIds.includes(9715);
      if (hasSuperheroKeyword || superheroRegex.test(fullText)) {
        return false;
      }
    }

    const strictTerms = excludedTerms.filter(
      (t) =>
        ![
          "detective",
          "modern",
          "ecchi",
          "harem",
          "violence",
          "violent",
          "gore",
          "gory",
          "slasher",
          "scary",
          "creepy",
          "spooky",
          "fear",
        ].includes(t),
    );
    if (strictTerms.length > 0) {
      const hasExcludedTerm = strictTerms.some((term) =>
        new RegExp(`\\b${term}\\b`, "i").test(fullText),
      );
      if (hasExcludedTerm) return false;
    }

    if (parsedIntent.excludedTermsFromPrompt?.includes("detective")) {
      if (/\b(detective|police detective)\b/i.test(titleText)) {
        return false;
      }
    }

    return true;
  });

  // Secondary fallback: NEVER run when `hasExplicitActorRequest`, `resolvedDirectorId`, or `isStrictNoFallbackQuery` is active
  if (
    candidates.length < 4 &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !isStrictNoFallbackQuery
  ) {
    try {
      const isTv =
        !parsedIntent.isNowPlaying &&
        (parsedIntent.targetType === "tv" ||
          parsedIntent.targetType === "anime" ||
          isAnimeIntent);
      const fallbackEndpoint = isTv
        ? "https://api.themoviedb.org/3/discover/tv"
        : "https://api.themoviedb.org/3/discover/movie";

      let fallbackGenre = isTv ? primaryTvGenre : primaryMovieGenre;
      if (!fallbackGenre) {
        if (wantsSciFi) {
          fallbackGenre = isTv ? "10765" : "878";
        } else if (isSwordWarfareIntent) {
          fallbackGenre = isTv
            ? "10768|36"
            : parsedIntent.excludeViolence
              ? "36|12|10751"
              : "36|10752";
        } else if (
          isCrimeHeist ||
          isCrimeFamilyIntent ||
          isHeistRobberyIntent
        ) {
          fallbackGenre = isTv ? "80" : "80,18";
        } else if (
          parsedIntent.detectedLanguage ||
          parsedIntent.detectedCountry ||
          parsedIntent.isNowPlaying
        ) {
          fallbackGenre = undefined;
        } else {
          fallbackGenre = isTv ? "18" : "28,18";
        }
      }

      const fallbackParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte":
          isClassicPre1980Era || isArabicOrEgyptianQuery
            ? 3
            : parsedIntent.isNowPlaying
              ? 20
              : isRegionalNonEnglish
                ? 15
                : 50,
        "vote_average.gte": effectiveRatingFloor,
        sort_by: "popularity.desc",
        [isTv ? "first_air_date.gte" : "primary_release_date.gte"]:
          parsedIntent.isNowPlaying
            ? oneFiftyDaysAgoStr
            : parsedIntent.minYear
              ? `${parsedIntent.minYear}-01-01`
              : isSwordWarfareIntent ||
                  isRegionalNonEnglish ||
                  isClassicPre1980Era
                ? "1950-01-01"
                : "2000-01-01",
        [isTv ? "first_air_date.lte" : "primary_release_date.lte"]:
          maxReleaseDateStr,
      };

      if (!isTv && parsedIntent.excludeViolence && !isRegionalNonEnglish) {
        fallbackParams.certification_country = "US";
        fallbackParams["certification.lte"] = "PG-13";
      }

      if (fallbackGenre) {
        fallbackParams.with_genres = fallbackGenre;
      }

      if (isSitcomIntent && isTv && !isAnimeIntent) {
        fallbackParams.without_genres =
          "18,16,10765,10768,10762,10766,27,80,9648,53";
      } else if (!isTv) {
        fallbackParams.without_genres = movieWithoutGenres;
      } else if (parsedIntent.excludeViolence || excludedGenreIds.has(27)) {
        fallbackParams.without_genres = "27";
      }

      if (isAnimeIntent && !parsedIntent.isNowPlaying) {
        fallbackParams.with_original_language = "ja";
        fallbackParams.with_genres = fallbackGenre
          ? Array.from(
              new Set([...String(fallbackGenre).split(/[|,]/), "16"]),
            ).join(",")
          : "16";
        fallbackParams.without_keywords = animeAntiEcchiKeywords;
        fallbackParams.without_genres = parsedIntent.excludeViolence
          ? "10762,27"
          : "10762";
      } else if (parsedIntent.detectedLanguage) {
        fallbackParams.with_original_language = parsedIntent.detectedLanguage;
      }

      if (parsedIntent.detectedCountry) {
        fallbackParams.with_origin_country = parsedIntent.detectedCountry;
      }

      if (isExcludedSuperhero) {
        fallbackParams.without_keywords = "9715";
      }

      const fallbackRes = await cachedTmdbGet(fallbackEndpoint, {
        params: fallbackParams,
      });
      const rawFallback = (fallbackRes.data?.results || []).map((m) => {
        const textualGenres = (m.genre_ids || [])
          .map((id) => TMDB_ID_TO_NAME[id] || "")
          .filter(Boolean);
        return {
          ...m,
          media_type:
            isAnimeIntent && !parsedIntent.isNowPlaying
              ? "anime"
              : isTv
                ? "tv"
                : "movie",
          genres: textualGenres,
        };
      });

      const freshFallback = rawFallback.filter((c) => {
        const relDate = c.release_date || c.first_air_date;
        if (!relDate || relDate > todayStr) return false;
        if (parsedIntent.isNowPlaying && relDate < oneFiftyDaysAgoStr) {
          return false;
        }

        const itemYear = parseInt(relDate.split("-")[0], 10);
        if (parsedIntent.minYear && itemYear < parsedIntent.minYear) {
          return false;
        }
        if (parsedIntent.maxYear && itemYear > parsedIntent.maxYear) {
          return false;
        }

        const itemGIds = c.genre_ids || [];
        const tText = (c.title || c.name || "").toLowerCase();
        const fullFallbackText = `${tText} ${c.overview || ""}`.toLowerCase();

        if (itemGIds.some((id) => excludedGenreIds.has(Number(id)))) {
          return false;
        }

        if (
          parsedIntent.excludeViolence &&
          (itemGIds.includes(27) ||
            EXTREME_VIOLENCE_GORE_FILTER_REGEX.test(tText) ||
            EXTREME_VIOLENCE_GORE_FILTER_REGEX.test(fullFallbackText))
        ) {
          return false;
        }

        if (
          isAnimeIntent &&
          (c.original_language !== "ja" || !itemGIds.includes(16))
        ) {
          return false;
        }

        if (
          isSitcomIntent &&
          (itemGIds.includes(27) ||
            itemGIds.includes(80) ||
            itemGIds.includes(53))
        ) {
          return false;
        }

        const isAnimeItem =
          c.media_type === "anime" ||
          (c.original_language === "ja" && itemGIds.includes(16));
        if (
          (isCuteAnimeRomComIntent ||
            isAnimeIntent ||
            parsedIntent.targetType === "anime" ||
            isAnimeItem) &&
          ECCHI_HAREM_FILTER_REGEX.test(tText)
        ) {
          return false;
        }
        if (
          isSwordWarfareIntent &&
          (MODERN_WARFARE_GUNS_FILTER_REGEX.test(tText) ||
            (!parsedIntent.wantsExplicitAnime && isAnimeItem))
        ) {
          return false;
        }
        return (
          !watchedIds.has(Number(c.id)) &&
          !sessionSeenIds.has(Number(c.id)) &&
          !candidates.some((existing) => existing.id === c.id)
        );
      });

      candidates = [...candidates, ...freshFallback];
    } catch (fbErr) {
      console.error("Secondary fallback fetch failed:", fbErr.message);
    }
  }

  return {
    candidates,
    resolvedDirectorId,
    resolvedActorIds,
    resolvedActorNames,
    requestedActorsList,
    hasExplicitActorRequest,
    isSitcomIntent,
  };
};
