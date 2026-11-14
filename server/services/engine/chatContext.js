// services/engine/chatContext.js
import { KNOWN_DIRECTORS, genreMap, TMDB_GENRE_IDS } from "./constants.js";
import { normalizePromptSpelling } from "./textHelper.js";
import { parseQuery } from "./queryParser.js";

// Extract previous user messages from chat history
export const getUserPreviousTexts = (history = []) => {
  return Array.isArray(history)
    ? history
        .filter((msg) => msg.role === "user" && msg.text)
        .map((msg) => msg.text.trim())
    : [];
};

// Extract all media IDs already recommended in the current chat session
export const getSessionSeenIds = (history = []) => {
  const sessionSeenIds = new Set();
  if (Array.isArray(history)) {
    history.forEach((msg) => {
      if (msg.results && Array.isArray(msg.results)) {
        msg.results.forEach((item) => {
          if (item && item.id) sessionSeenIds.add(Number(item.id));
        });
      }
    });
  }
  return sessionSeenIds;
};

// 1. Multi-Turn Context Merging & Pivot / Relaxation Handling
export const mergeContext = (
  parsedIntent,
  userPreviousTexts = [],
  cleanPrompt = "",
  normalizedFocus = "mixed",
) => {
  if (!Array.isArray(userPreviousTexts) || userPreviousTexts.length === 0) {
    return parsedIntent;
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

  const combinedHistoryPrompt =
    `${userPreviousTexts.join(" ")} ${cleanPrompt}`.trim();
  const cumulativeIntent = parseQuery(combinedHistoryPrompt, normalizedFocus);

  const droppedGenresSet = new Set(currentRelaxed.droppedGenres || []);
  const currentExplicitIncludeGenres = new Set(
    parsedIntent.detectedGenres || [],
  );
  const currentExplicitExcludeGenres = new Set(
    parsedIntent.excludedGenres || [],
  );
  const currentExplicitIncludeKeywords = new Set(
    (parsedIntent.detectedKeywords || []).map((k) => k.name.toLowerCase()),
  );
  const currentExplicitExcludeTerms = new Set(
    parsedIntent.excludedTermsFromPrompt || [],
  );

  // Reconstruct historical context turn-by-turn
  const historicalAffirmativeGenres = new Set();
  let historicalTargetType = null;
  let historicalLanguage = null;
  let historicalCountry = null;
  let historicalRegionLabel = null;
  let historicalOrigins = [];
  let historicalStrictFormats = [];
  let historicalDirector = null;
  let historicalActors = [];
  let historicalMinYear = null;
  let historicalMaxYear = null;
  let historicalMinRating = null;
  let historicalNowPlaying = false;
  let historicalWantsAnime = false;
  let historicalExcludeViolence = false;

  for (const prevText of userPreviousTexts) {
    const prevNorm = normalizePromptSpelling(prevText);
    const prevParsed = parseQuery(prevNorm, normalizedFocus);
    const prevRelaxed = prevParsed.relaxedConstraints || {};

    if (prevRelaxed.dropEra) {
      historicalMinYear = null;
      historicalMaxYear = null;
    }
    if (prevRelaxed.dropFormats) {
      historicalStrictFormats = [];
    }
    if (prevRelaxed.dropOrigins) {
      historicalOrigins = [];
      historicalLanguage = null;
      historicalCountry = null;
      historicalRegionLabel = null;
      historicalWantsAnime = false;
    }
    if (Array.isArray(prevRelaxed.droppedGenres)) {
      prevRelaxed.droppedGenres.forEach((dg) =>
        historicalAffirmativeGenres.delete(dg),
      );
    }

    if (prevParsed.replacePrevious || prevParsed.isPivot) {
      if (
        Array.isArray(prevParsed.detectedGenres) &&
        prevParsed.detectedGenres.length > 0
      ) {
        historicalAffirmativeGenres.clear();
      }
      if (Array.isArray(prevParsed.origins) && prevParsed.origins.length > 0) {
        historicalOrigins = [];
        historicalLanguage = null;
        historicalCountry = null;
        historicalRegionLabel = null;
        historicalWantsAnime = false;
      }
    }

    (prevParsed.detectedGenres || []).forEach((g) =>
      historicalAffirmativeGenres.add(g),
    );

    if (prevParsed.minYear !== null && prevParsed.minYear !== undefined) {
      historicalMinYear = prevParsed.minYear;
    }
    if (prevParsed.maxYear !== null && prevParsed.maxYear !== undefined) {
      historicalMaxYear = prevParsed.maxYear;
    }
    if (prevParsed.minRating !== null && prevParsed.minRating !== undefined) {
      historicalMinRating = prevParsed.minRating;
    }
    if (prevParsed.extractedDirector) {
      historicalDirector = prevParsed.extractedDirector;
    }
    if (Array.isArray(prevParsed.actors) && prevParsed.actors.length > 0) {
      historicalActors = Array.from(
        new Set([...historicalActors, ...prevParsed.actors]),
      );
    }
    if (Array.isArray(prevParsed.origins) && prevParsed.origins.length > 0) {
      historicalOrigins = Array.from(
        new Set([...historicalOrigins, ...prevParsed.origins]),
      );
    }
    if (
      Array.isArray(prevParsed.strictFormats) &&
      prevParsed.strictFormats.length > 0
    ) {
      historicalStrictFormats = Array.from(
        new Set([...historicalStrictFormats, ...prevParsed.strictFormats]),
      );
    }
    if (prevParsed.isNowPlaying) {
      historicalNowPlaying = true;
    }
    if (prevParsed.excludeViolence) {
      historicalExcludeViolence = true;
    }

    if (prevParsed.targetType && prevParsed.targetType !== "mixed") {
      historicalTargetType = prevParsed.targetType;
    }
    if (prevParsed.wantsExplicitAnime || prevParsed.targetType === "anime") {
      historicalWantsAnime = true;
      historicalTargetType = "anime";
      historicalLanguage = "ja";
      historicalCountry = "JP";
      historicalRegionLabel = "Japanese";
      historicalAffirmativeGenres.add("animation");
    } else if (prevParsed.detectedLanguage) {
      historicalLanguage = prevParsed.detectedLanguage;
      historicalCountry = prevParsed.detectedCountry;
      historicalRegionLabel = prevParsed.detectedRegionLabel;
    }

    if (prevParsed.hasContradiction) {
      const strippedPrev = prevNorm
        .toLowerCase()
        .replace(
          /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi,
          " ",
        );
      for (const [gKey, kwList] of Object.entries(genreMap)) {
        if (
          kwList.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(strippedPrev))
        ) {
          historicalAffirmativeGenres.add(gKey);
        }
      }
      if (
        /\b(movie|movies|film|films)\b/i.test(strippedPrev) &&
        !historicalWantsAnime
      ) {
        historicalTargetType = historicalTargetType || "movie";
      } else if (
        /\b(series|show|shows|tv|sitcom|k-drama|kdrama)\b/i.test(
          strippedPrev,
        ) &&
        !historicalWantsAnime
      ) {
        historicalTargetType = historicalTargetType || "tv";
      }
    }
  }

  // Remove any genre explicitly dropped in the current turn
  droppedGenresSet.forEach((dg) => historicalAffirmativeGenres.delete(dg));

  let mergedExcludedGenres = Array.from(
    new Set([
      ...(isReplacingPrevious ? [] : cumulativeIntent.excludedGenres || []),
      ...(parsedIntent.excludedGenres || []),
    ]),
  ).filter((g) => !currentExplicitIncludeGenres.has(g));

  let mergedExcludedTerms = Array.from(
    new Set([
      ...(isReplacingPrevious
        ? []
        : cumulativeIntent.excludedTermsFromPrompt || []),
      ...(parsedIntent.excludedTermsFromPrompt || []),
    ]),
  ).filter((term) => {
    if (
      currentExplicitIncludeGenres.has(term) ||
      currentExplicitIncludeKeywords.has(term)
    ) {
      return false;
    }
    for (const incG of currentExplicitIncludeGenres) {
      if (genreMap[incG] && genreMap[incG].includes(term)) {
        return false;
      }
    }
    return true;
  });

  const includedKwIds = new Set(
    (parsedIntent.detectedKeywords || []).map((k) => String(k.id)),
  );
  let mergedExcludedKeywords = Array.from(
    new Set([
      ...(isReplacingPrevious ? [] : cumulativeIntent.excludedKeywords || []),
      ...(parsedIntent.excludedKeywords || []),
    ]),
  ).filter((kwId) => !includedKwIds.has(String(kwId)));

  if (parsedIntent.isSwordWarfare || cumulativeIntent.isSwordWarfare) {
    mergedExcludedGenres = mergedExcludedGenres.filter((g) => g !== "war");
  }

  parsedIntent.excludedGenres = mergedExcludedGenres;
  parsedIntent.excludedKeywords = mergedExcludedKeywords;
  parsedIntent.excludedTermsFromPrompt = mergedExcludedTerms;
  parsedIntent.excludeViolence = Boolean(
    parsedIntent.excludeViolence ||
    (!isReplacingPrevious && historicalExcludeViolence),
  );

  const mergedExcludedGenreIds = [];
  parsedIntent.excludedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.movie[g])
      mergedExcludedGenreIds.push(TMDB_GENRE_IDS.movie[g]);
    if (TMDB_GENRE_IDS.tv[g]) mergedExcludedGenreIds.push(TMDB_GENRE_IDS.tv[g]);
  });
  parsedIntent.excludedGenreIds = Array.from(new Set(mergedExcludedGenreIds));

  // Genre merging: replace old genres when `replacePrevious` is true and new genres are provided; otherwise union non-dropped genres
  if (isReplacingPrevious && parsedIntent.detectedGenres.length > 0) {
    parsedIntent.detectedGenres = parsedIntent.detectedGenres.filter(
      (g) =>
        !parsedIntent.excludedGenres.includes(g) &&
        !droppedGenresSet.has(g) &&
        !currentExplicitExcludeGenres.has(g) &&
        !currentExplicitExcludeTerms.has(g),
    );
  } else if (parsedIntent.detectedGenres.length > 0) {
    const otherCumulativeGenres = Array.from(
      historicalAffirmativeGenres,
    ).filter((g) => !parsedIntent.detectedGenres.includes(g));
    parsedIntent.detectedGenres = [
      ...parsedIntent.detectedGenres,
      ...otherCumulativeGenres,
    ].filter(
      (g) =>
        !parsedIntent.excludedGenres.includes(g) &&
        !droppedGenresSet.has(g) &&
        !currentExplicitExcludeGenres.has(g) &&
        !currentExplicitExcludeTerms.has(g),
    );
  } else {
    parsedIntent.detectedGenres = Array.from(
      historicalAffirmativeGenres,
    ).filter(
      (g) =>
        !parsedIntent.excludedGenres.includes(g) &&
        !droppedGenresSet.has(g) &&
        !currentExplicitExcludeGenres.has(g) &&
        !currentExplicitExcludeTerms.has(g),
    );
  }

  // Era merging: honor `dropEra`; preserve historical era when `preservesAnaphoricEra` ("from that same decade") or when not pivoting to a new era
  if (currentRelaxed.dropEra) {
    parsedIntent.minYear = null;
    parsedIntent.maxYear = null;
    parsedIntent.wantsClassic = false;
  } else if (
    parsedIntent.preservesAnaphoricEra ||
    !isReplacingPrevious ||
    (parsedIntent.minYear === null && parsedIntent.maxYear === null)
  ) {
    if (parsedIntent.minYear === null && historicalMinYear !== null) {
      parsedIntent.minYear = historicalMinYear;
    }
    if (parsedIntent.maxYear === null && historicalMaxYear !== null) {
      parsedIntent.maxYear = historicalMaxYear;
    }
  }

  // Format merging: honor `dropFormats`; clear old strict formats when `replacePrevious` is true unless re-specified
  if (currentRelaxed.dropFormats) {
    parsedIntent.strictFormats = [];
  } else if (
    !isReplacingPrevious &&
    (!parsedIntent.strictFormats || parsedIntent.strictFormats.length === 0) &&
    historicalStrictFormats.length > 0
  ) {
    parsedIntent.strictFormats = [...historicalStrictFormats];
  }

  // Origin & language merging: honor `dropOrigins`; replace old origins when `replacePrevious` is true and new origins are provided
  if (currentRelaxed.dropOrigins) {
    parsedIntent.origins = [];
    parsedIntent.detectedLanguage = null;
    parsedIntent.detectedCountry = null;
    parsedIntent.detectedRegionLabel = null;
    parsedIntent.isKorean = false;
    parsedIntent.wantsExplicitAnime = false;
    if (parsedIntent.targetType === "anime") {
      parsedIntent.targetType = normalizedFocus === "anime" ? "anime" : "mixed";
    }
  } else if (
    isReplacingPrevious &&
    parsedIntent.origins &&
    parsedIntent.origins.length > 0
  ) {
    // Keep only the newly requested origins/language from the current turn
    parsedIntent.isKorean =
      parsedIntent.origins.includes("Korean") ||
      parsedIntent.detectedLanguage === "ko";
    if (
      !parsedIntent.wantsExplicitAnime &&
      !parsedIntent.origins.includes("Japanese") &&
      parsedIntent.targetType === "anime"
    ) {
      parsedIntent.targetType = parsedIntent.hasExplicitTargetType
        ? parsedIntent.targetType
        : "movie";
    }
  } else if (
    !isReplacingPrevious &&
    (!parsedIntent.origins || parsedIntent.origins.length === 0) &&
    historicalOrigins.length > 0
  ) {
    parsedIntent.origins = [...historicalOrigins];
    if (!parsedIntent.detectedLanguage && historicalLanguage) {
      parsedIntent.detectedLanguage = historicalLanguage;
      parsedIntent.detectedCountry = historicalCountry;
      parsedIntent.detectedRegionLabel = historicalRegionLabel;
      parsedIntent.isKorean = historicalLanguage === "ko";
    }
  }

  // Target type merging
  const switchedToNonJapaneseOrigin =
    parsedIntent.origins &&
    parsedIntent.origins.length > 0 &&
    !parsedIntent.origins.includes("Japanese");

  if (
    historicalWantsAnime &&
    !currentRelaxed.dropOrigins &&
    !switchedToNonJapaneseOrigin &&
    !parsedIntent.isLiveAction &&
    !(
      isReplacingPrevious &&
      parsedIntent.hasExplicitTargetType &&
      parsedIntent.targetType !== "anime"
    )
  ) {
    parsedIntent.targetType = "anime";
    parsedIntent.hasExplicitTargetType = true;
    parsedIntent.wantsExplicitAnime = true;
    parsedIntent.detectedLanguage = "ja";
    parsedIntent.detectedCountry = "JP";
    parsedIntent.detectedRegionLabel = "Japanese";
    if (
      !parsedIntent.detectedGenres.includes("animation") &&
      !parsedIntent.excludedGenres.includes("animation") &&
      !droppedGenresSet.has("animation")
    ) {
      parsedIntent.detectedGenres.push("animation");
    }
    if (
      parsedIntent.detectedGenres.includes("romance") &&
      !parsedIntent.excludedGenres.includes("romance")
    ) {
      parsedIntent.isCuteAnimeRomCom = true;
    }
  } else if (
    !parsedIntent.hasExplicitTargetType &&
    !isReplacingPrevious &&
    historicalTargetType &&
    historicalTargetType !== "mixed"
  ) {
    parsedIntent.targetType = historicalTargetType;
  }

  // Person (Director / Actor) merging: preserve across follow-ups or when anaphoric pronouns ("his"/"her") are used
  if (!isReplacingPrevious || parsedIntent.preservesAnaphoricPerson) {
    if (parsedIntent.minRating === null && historicalMinRating !== null) {
      parsedIntent.minRating = historicalMinRating;
    }

    const hasExplicitDirectorTrigger =
      /\b(?:directed\s+by|director|films?\s+by|movies?\s+by|series\s+by|shows?\s+by|works?\s+of|cinema\s+of|who\s+directed)\b/i.test(
        cleanPrompt,
      );
    const hasFullKnownDirectorInCurrentPrompt = KNOWN_DIRECTORS.some((dir) => {
      const escapedDir = dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedDir}\\b`, "i").test(cleanPrompt);
    });

    if (
      historicalDirector &&
      !hasExplicitDirectorTrigger &&
      !hasFullKnownDirectorInCurrentPrompt &&
      !parsedIntent.extractedDirector
    ) {
      parsedIntent.extractedDirector = historicalDirector;
    }

    if (
      (!parsedIntent.actors || parsedIntent.actors.length === 0) &&
      historicalActors.length > 0
    ) {
      parsedIntent.actors = [...historicalActors];
      parsedIntent.extractedActors = [...historicalActors];
      parsedIntent.extractedActor = historicalActors[0] || null;
    }

    if (!parsedIntent.isNowPlaying && historicalNowPlaying) {
      parsedIntent.isNowPlaying = true;
    }
  }

  const isLiveActionOrSitcomPivot =
    (isReplacingPrevious || parsedIntent.isLiveAction) &&
    (parsedIntent.isLiveAction ||
      parsedIntent.isSitcom ||
      parsedIntent.detectedGenres.includes("comedy")) &&
    !historicalWantsAnime &&
    (!parsedIntent.origins || parsedIntent.origins.length === 0) &&
    !/\b(anime|manga)\b/i.test(cleanPrompt);

  if (isLiveActionOrSitcomPivot) {
    parsedIntent.detectedLanguage = null;
    parsedIntent.detectedCountry = null;
    parsedIntent.detectedRegionLabel = null;
    parsedIntent.origins = [];
    parsedIntent.isKorean = false;
    if (!parsedIntent.hasExplicitTargetType) {
      parsedIntent.targetType = "tv";
    }
  }

  const keywordMap = new Map();
  [
    ...(isReplacingPrevious ? [] : cumulativeIntent.detectedKeywords || []),
    ...(parsedIntent.detectedKeywords || []),
  ].forEach((k) => keywordMap.set(k.name, k));

  parsedIntent.detectedKeywords = Array.from(keywordMap.values()).filter(
    (k) =>
      !parsedIntent.excludedKeywords.includes(String(k.id)) &&
      !currentExplicitExcludeTerms.has(k.name.toLowerCase()),
  );

  if (isReplacingPrevious) {
    if (
      parsedIntent.detectedGenres.includes("comedy") ||
      parsedIntent.isLiveAction ||
      (parsedIntent.origins && parsedIntent.origins.length > 0)
    ) {
      parsedIntent.isMindBlowingAction = Boolean(
        parsedIntent.isMindBlowingAction,
      );
      parsedIntent.isDarkAnime = Boolean(parsedIntent.isDarkAnime);
      parsedIntent.isCyberpunk = Boolean(parsedIntent.isCyberpunk);
      parsedIntent.isPhilosophicalSciFi = Boolean(
        parsedIntent.isPhilosophicalSciFi,
      );
      parsedIntent.isSwordWarfare = Boolean(parsedIntent.isSwordWarfare);
      parsedIntent.isHistoricalWar = Boolean(parsedIntent.isHistoricalWar);
    }
  } else {
    parsedIntent.isKorean = parsedIntent.isKorean || cumulativeIntent.isKorean;
    parsedIntent.isSwordWarfare =
      parsedIntent.isSwordWarfare || cumulativeIntent.isSwordWarfare;
    parsedIntent.isTrueCrimeDoc =
      parsedIntent.isTrueCrimeDoc || cumulativeIntent.isTrueCrimeDoc;
    parsedIntent.isCyberpunk =
      parsedIntent.isCyberpunk || cumulativeIntent.isCyberpunk;
    parsedIntent.isPhilosophicalSciFi =
      parsedIntent.isPhilosophicalSciFi ||
      cumulativeIntent.isPhilosophicalSciFi;
    parsedIntent.isCrimeFamily =
      parsedIntent.isCrimeFamily || cumulativeIntent.isCrimeFamily;
    parsedIntent.isHeistRobbery =
      parsedIntent.isHeistRobbery || cumulativeIntent.isHeistRobbery;
    parsedIntent.isUnderdog =
      parsedIntent.isUnderdog || cumulativeIntent.isUnderdog;
    parsedIntent.isHauntedHorror =
      parsedIntent.isHauntedHorror || cumulativeIntent.isHauntedHorror;
    parsedIntent.isMindBlowingAction =
      parsedIntent.isMindBlowingAction || cumulativeIntent.isMindBlowingAction;
    parsedIntent.isDarkAnime =
      parsedIntent.isDarkAnime || cumulativeIntent.isDarkAnime;
    parsedIntent.isCuteAnimeRomCom =
      parsedIntent.isCuteAnimeRomCom || cumulativeIntent.isCuteAnimeRomCom;
    parsedIntent.isSitcom = parsedIntent.isSitcom || cumulativeIntent.isSitcom;
    parsedIntent.isPureComedy =
      parsedIntent.isPureComedy || cumulativeIntent.isPureComedy;
    parsedIntent.isComfortComedy =
      parsedIntent.isComfortComedy || cumulativeIntent.isComfortComedy;
    parsedIntent.hasQualityFloor =
      parsedIntent.hasQualityFloor || cumulativeIntent.hasQualityFloor;
  }

  if (
    parsedIntent.extractedDirector ||
    (parsedIntent.actors && parsedIntent.actors.length > 0) ||
    parsedIntent.isNowPlaying ||
    isReplacingPrevious
  ) {
    if (
      isReplacingPrevious &&
      parsedIntent.extractedReferenceTitles?.length === 0
    ) {
      parsedIntent.extractedReferenceTitles = [];
      parsedIntent.anchorTitles = [];
      parsedIntent.extractedReferenceTitle = null;
    } else if (
      parsedIntent.extractedDirector ||
      (parsedIntent.actors && parsedIntent.actors.length > 0) ||
      parsedIntent.isNowPlaying
    ) {
      parsedIntent.extractedReferenceTitles = [];
      parsedIntent.anchorTitles = [];
      parsedIntent.extractedReferenceTitle = null;
    }
  } else if (
    (!parsedIntent.extractedReferenceTitles ||
      parsedIntent.extractedReferenceTitles.length === 0) &&
    cumulativeIntent.extractedReferenceTitles &&
    cumulativeIntent.extractedReferenceTitles.length > 0
  ) {
    parsedIntent.extractedReferenceTitles =
      cumulativeIntent.extractedReferenceTitles;
    parsedIntent.anchorTitles = [...cumulativeIntent.extractedReferenceTitles];
    parsedIntent.extractedReferenceTitle =
      cumulativeIntent.extractedReferenceTitles[0] || null;
  }

  // Recompute `isHyperSpecific` on the merged intent so normal search runs once strict constraints are dropped or replaced
  const mergedHasPre1970Era = Boolean(
    !currentRelaxed.dropEra &&
    ((parsedIntent.minYear !== null && parsedIntent.minYear < 1970) ||
      (parsedIntent.maxYear !== null && parsedIntent.maxYear < 1970)),
  );
  const mergedHasStrictFormats = Boolean(
    !currentRelaxed.dropFormats &&
    Array.isArray(parsedIntent.strictFormats) &&
    parsedIntent.strictFormats.length > 0,
  );
  const mergedHasMultipleOrigins = Boolean(
    !currentRelaxed.dropOrigins &&
    Array.isArray(parsedIntent.origins) &&
    parsedIntent.origins.length > 1,
  );

  parsedIntent.isHyperSpecific = Boolean(
    mergedHasStrictFormats ||
    mergedHasMultipleOrigins ||
    (mergedHasPre1970Era &&
      (parsedIntent.detectedGenres.length > 0 ||
        (parsedIntent.origins && parsedIntent.origins.length > 0) ||
        parsedIntent.detectedKeywords.length > 0)),
  );

  if (
    parsedIntent.detectedGenres.length > 0 ||
    parsedIntent.excludedGenres.length > 0 ||
    parsedIntent.targetType === "anime" ||
    parsedIntent.extractedDirector ||
    (parsedIntent.actors && parsedIntent.actors.length > 0) ||
    (parsedIntent.origins && parsedIntent.origins.length > 0) ||
    parsedIntent.minYear !== null ||
    parsedIntent.maxYear !== null ||
    parsedIntent.isNowPlaying ||
    parsedIntent.isHyperSpecific
  ) {
    parsedIntent.isAmbiguous = false;
    parsedIntent.isValid = true;
  }

  return parsedIntent;
};

export const mergeHistoryContext = mergeContext;
