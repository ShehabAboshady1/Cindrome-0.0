// services/replyHelper.js
import { TMDB_GENRE_IDS } from "./engine/constants.js";
import { getSimilarityScore } from "./engine/textHelper.js";

// Resolve specific Micro-Genre label when active so the response message reflects the exact micro-genre requested
const resolveMicroGenreDisplayLabel = (parsedIntent, fallbackGenreStr) => {
  if (!parsedIntent) return fallbackGenreStr;
  if (parsedIntent.isDarkComedy) return "dark comedy";
  if (parsedIntent.isHauntedHorror) return "haunted house horror";
  if (parsedIntent.isCyberpunk) return "cyberpunk Sci-Fi";
  if (parsedIntent.isPhilosophicalSciFi) return "philosophical Sci-Fi";
  if (parsedIntent.isPsychologicalThriller) return "psychological thriller";
  if (parsedIntent.isTrueCrimeDoc) return "true crime documentary";
  if (parsedIntent.isHeistRobbery) return "heist crime";
  if (parsedIntent.isCrimeFamily) return "organized crime";
  if (parsedIntent.isSwordWarfare) return "ancient sword warfare";
  if (parsedIntent.isSitcom) return "sitcom comedy";
  if (parsedIntent.isCuteAnimeRomCom) return "wholesome rom-com";
  if (parsedIntent.isDarkAnime) return "dark fantasy";
  if (parsedIntent.isRomCom) return "romantic comedy";
  return fallbackGenreStr;
};

// Generate core English response text from parsed intent
export const generateResponseText = (
  parsedIntent,
  resultsCount,
  isColdStart = false,
  anchorTitles = null,
) => {
  if (parsedIntent?.isSmallTalk && parsedIntent?.smallTalkMessage) {
    return parsedIntent.smallTalkMessage;
  }

  if (parsedIntent?.needsClarification && parsedIntent?.clarificationMessage) {
    return parsedIntent.clarificationMessage;
  }

  if (parsedIntent?.hasContradiction && parsedIntent?.contradictionMessage) {
    return parsedIntent.contradictionMessage.replace(/\*\*/g, "");
  }

  const formatGenreDisplay = (g) => (g === "scifi" ? "Sci-Fi" : g);

  const normalizedAnchors = (
    Array.isArray(anchorTitles)
      ? anchorTitles
      : anchorTitles
        ? [anchorTitles]
        : parsedIntent?.anchorTitles ||
          parsedIntent?.extractedReferenceTitles ||
          []
  ).filter(Boolean);

  const normalizedActors = (
    Array.isArray(parsedIntent?.actors)
      ? parsedIntent.actors
      : Array.isArray(parsedIntent?.extractedActors)
        ? parsedIntent.extractedActors
        : parsedIntent?.extractedActor
          ? [parsedIntent.extractedActor]
          : []
  ).filter(Boolean);

  const regionPrefix = parsedIntent?.detectedRegionLabel
    ? `${parsedIntent.detectedRegionLabel} `
    : "";

  const formattedGenres =
    parsedIntent?.detectedGenres?.length > 0
      ? parsedIntent.detectedGenres.map(formatGenreDisplay)
      : [];

  const baseGenreStr =
    formattedGenres.length > 0 ? formattedGenres.join(" and ") : "top";
  const genreStr = resolveMicroGenreDisplayLabel(parsedIntent, baseGenreStr);

  const isPlural =
    resultsCount === undefined || resultsCount === null || resultsCount !== 1;
  const rawTarget = parsedIntent?.targetType || "mixed";

  let typeStr = "titles";
  if (rawTarget === "movie") {
    typeStr = isPlural ? "movies" : "movie";
  } else if (rawTarget === "tv") {
    typeStr = "series";
  } else if (rawTarget === "anime") {
    typeStr = "anime";
  } else {
    typeStr = isPlural ? "titles" : "title";
  }

  const singularTypeStr =
    rawTarget === "movie"
      ? "movie"
      : rawTarget === "tv"
        ? "series"
        : rawTarget === "anime"
          ? "anime"
          : "title";

  const ratingSuffix = parsedIntent?.minRating
    ? ` rated ${parsedIntent.minRating}+`
    : "";

  if (isColdStart) {
    const coldPluralType =
      rawTarget === "movie"
        ? "movies"
        : rawTarget === "tv"
          ? "series"
          : rawTarget === "anime"
            ? "anime"
            : "titles";
    return `I see your watch history for ${coldPluralType} is still brand new! To help me tailor my recommendations, what is a specific ${singularTypeStr} that you consider a masterpiece or always love watching?`;
  }

  if (resultsCount === 0) {
    return `I searched my database with those specific constraints, but couldn't find a strong match. Try broadening your request or naming a favorite title!`;
  }

  if (parsedIntent?.isNowPlaying) {
    const movieNoun = isPlural ? "movies" : "movie";
    return `Here ${isPlural ? "are" : "is"} the top ${regionPrefix}${genreStr !== "top" ? genreStr + " " : ""}${movieNoun} currently playing in theaters${ratingSuffix}:`;
  }

  if (parsedIntent?.extractedDirector && normalizedActors.length > 0) {
    const actorNames = normalizedActors.join(" and ");
    return `Here ${isPlural ? "are" : "is"} the highest-rated ${regionPrefix}${genreStr !== "top" ? genreStr + " " : ""}${typeStr} directed by ${parsedIntent.extractedDirector} starring ${actorNames}${ratingSuffix}:`;
  }

  if (parsedIntent?.extractedDirector) {
    return `Here ${isPlural ? "are" : "is"} the highest-rated ${regionPrefix}${genreStr !== "top" ? genreStr + " " : ""}${typeStr} directed by ${parsedIntent.extractedDirector}${ratingSuffix}:`;
  }

  if (normalizedActors.length > 0) {
    const actorNames = normalizedActors.join(" and ");
    return `Here ${isPlural ? "are" : "is"} the highest-rated ${regionPrefix}${genreStr !== "top" ? genreStr + " " : ""}${typeStr} starring ${actorNames}${ratingSuffix}:`;
  }

  if (normalizedAnchors.length > 1) {
    const formattedList = normalizedAnchors.map((t) => `"${t}"`).join(" and ");
    const toneName =
      formattedGenres.length > 0 ? formattedGenres[0] : "cinematic";
    return `Great picks with ${formattedList}! I've blended their ${toneName} tone and pacing while filtering out direct sequels. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"}${ratingSuffix}:`;
  }

  if (normalizedAnchors.length === 1) {
    const toneName =
      formattedGenres.length > 0 ? formattedGenres[0] : "cinematic";
    return `Great pick with "${normalizedAnchors[0]}"! I've filtered out direct sequels and matched its exact ${toneName} tone and pacing. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"} for you${ratingSuffix}:`;
  }

  const descriptor =
    `${regionPrefix}${genreStr} ${typeStr}${ratingSuffix}`.trim();
  const recNoun = isPlural ? "recommendations" : "recommendation";
  const matchNoun = isPlural ? "matches" : "match";

  const successPrompts = [
    `Based on your request for ${descriptor}, and factoring in your preferences, here ${isPlural ? "are" : "is"} the top-rated ${recNoun}:`,
    `Here ${isPlural ? "are some" : "is a"} top-tier ${descriptor} that ${isPlural ? "match" : "matches"} your requested tone and focus:`,
    `I've analyzed titles matching your search for ${descriptor} and ranked ${isPlural ? "these as your best matches" : `this as your best ${matchNoun}`}:`,
  ];
  return successPrompts[Math.floor(Math.random() * successPrompts.length)];
};

// Response polishing helper for natural, warm, and honest English responses
export const buildPolishedResponseMessage = ({
  rawPrompt,
  parsedIntent,
  resultsCount,
  topResultsRaw = [],
  isColdStart = false,
  resolvedAnchorNames = [],
  rawAnchorInputs = [],
  isStandaloneAnchorSearch = false,
  resolvedActorNames = [],
}) => {
  const formatGenreDisplay = (g) => (g === "scifi" ? "Sci-Fi" : g);

  if (parsedIntent?.isSmallTalk && parsedIntent?.smallTalkMessage) {
    return parsedIntent.smallTalkMessage;
  }

  if (parsedIntent?.needsClarification && parsedIntent?.clarificationMessage) {
    return parsedIntent.clarificationMessage;
  }

  if (parsedIntent?.hasContradiction && parsedIntent?.contradictionMessage) {
    return parsedIntent.contradictionMessage.replace(/\*\*/g, "");
  }

  const isPlural =
    resultsCount === undefined || resultsCount === null || resultsCount !== 1;

  if (isColdStart) {
    return generateResponseText(parsedIntent, 0, true, resolvedAnchorNames);
  }

  const effectiveActors =
    resolvedActorNames.length > 0
      ? resolvedActorNames
      : Array.isArray(parsedIntent?.actors)
        ? parsedIntent.actors
        : [];

  if (resultsCount === 0) {
    const constraintParts = [];

    if (
      Array.isArray(parsedIntent?.strictFormats) &&
      parsedIntent.strictFormats.length > 0
    ) {
      constraintParts.push(parsedIntent.strictFormats.join(" / "));
    }

    if (
      Array.isArray(parsedIntent?.origins) &&
      parsedIntent.origins.length > 0
    ) {
      constraintParts.push(parsedIntent.origins.join(" + "));
    } else if (parsedIntent?.detectedRegionLabel) {
      constraintParts.push(parsedIntent.detectedRegionLabel);
    }

    if (
      Array.isArray(parsedIntent?.detectedGenres) &&
      parsedIntent.detectedGenres.length > 0
    ) {
      constraintParts.push(
        parsedIntent.detectedGenres.map(formatGenreDisplay).join(" / "),
      );
    }

    const rawTarget = parsedIntent?.targetType || "mixed";
    const typeLabel =
      rawTarget === "movie"
        ? "movies"
        : rawTarget === "tv"
          ? "series"
          : rawTarget === "anime"
            ? "anime"
            : "titles";
    constraintParts.push(typeLabel);

    if (parsedIntent?.extractedDirector) {
      constraintParts.push(`directed by ${parsedIntent.extractedDirector}`);
    }

    if (effectiveActors.length > 0) {
      constraintParts.push(`starring ${effectiveActors.join(" and ")}`);
    }

    if (
      parsedIntent?.minYear !== null &&
      parsedIntent?.minYear !== undefined &&
      parsedIntent?.maxYear !== null &&
      parsedIntent?.maxYear !== undefined
    ) {
      if (parsedIntent.minYear === parsedIntent.maxYear) {
        constraintParts.push(`from ${parsedIntent.minYear}`);
      } else {
        constraintParts.push(
          `from ${parsedIntent.minYear}–${parsedIntent.maxYear}`,
        );
      }
    } else if (
      parsedIntent?.minYear !== null &&
      parsedIntent?.minYear !== undefined
    ) {
      constraintParts.push(`released after ${parsedIntent.minYear}`);
    } else if (
      parsedIntent?.maxYear !== null &&
      parsedIntent?.maxYear !== undefined
    ) {
      constraintParts.push(`released before ${parsedIntent.maxYear + 1}`);
    }

    if (parsedIntent?.minRating) {
      constraintParts.push(`rated ${parsedIntent.minRating}+`);
    }

    const summaryStr = constraintParts.join(" ").replace(/\s+/g, " ").trim();

    if (
      parsedIntent?.isHyperSpecific ||
      (parsedIntent?.origins && parsedIntent.origins.length > 1) ||
      (parsedIntent?.strictFormats && parsedIntent.strictFormats.length > 0) ||
      effectiveActors.length > 0 ||
      parsedIntent?.extractedDirector ||
      parsedIntent?.minYear !== null ||
      parsedIntent?.maxYear !== null
    ) {
      return `I searched my database for ${summaryStr}, but no titles matched that exact combination of constraints. Try relaxing the era, origin, format, or genre filters!`;
    }

    return "I searched my database with those exact constraints, but couldn't find a strong match. Try broadening your filters or naming a title you love!";
  }

  const presentGenreIds = new Set();
  if (Array.isArray(topResultsRaw)) {
    topResultsRaw.forEach((item) => {
      (item.genre_ids || []).forEach((id) => presentGenreIds.add(Number(id)));
    });
  }

  const verifiedGenres = (parsedIntent?.detectedGenres || []).filter((g) => {
    if (presentGenreIds.size === 0) return true;
    if (g === "sports") return true;
    const mId = TMDB_GENRE_IDS.movie[g];
    const tId = TMDB_GENRE_IDS.tv[g];
    if (g === "scifi") {
      return presentGenreIds.has(878) || presentGenreIds.has(10765);
    }
    return (
      (mId && presentGenreIds.has(Number(mId))) ||
      (tId && presentGenreIds.has(Number(tId)))
    );
  });

  const formattedGenresEn = verifiedGenres.map(formatGenreDisplay);

  const ratingSuffixEn = parsedIntent?.minRating
    ? ` rated ${parsedIntent.minRating}+`
    : "";

  if (isStandaloneAnchorSearch && resolvedAnchorNames.length === 1) {
    const resolvedTitle = resolvedAnchorNames[0];
    const rawTyped = (rawAnchorInputs[0] || rawPrompt || "")
      .replace(/[?.,!]/g, "")
      .trim();
    const cleanRaw = rawTyped.toLowerCase().replace(/^(a|an|the)\s+/, "");
    const cleanResolved = resolvedTitle
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");
    const wasTypoCorrected =
      cleanRaw.length >= 2 &&
      cleanRaw !== cleanResolved &&
      getSimilarityScore(cleanRaw, cleanResolved) < 0.99;

    const toneEn =
      formattedGenresEn.length > 0 ? formattedGenresEn[0] : "cinematic";

    if (wasTypoCorrected) {
      return `It looks like you meant "${resolvedTitle}"! Assuming you're looking for similar titles, I've matched its ${toneEn} vibe and filtered out direct sequels. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"}${ratingSuffixEn}:`;
    }
    return `Great pick with "${resolvedTitle}"! Assuming you're looking for similar titles, I've matched its exact ${toneEn} tone and pacing while filtering out direct sequels. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"} for you${ratingSuffixEn}:`;
  }

  return generateResponseText(
    {
      ...parsedIntent,
      detectedGenres: verifiedGenres,
      actors: effectiveActors,
      extractedActors: effectiveActors,
    },
    resultsCount,
    isColdStart,
    resolvedAnchorNames,
  );
};

// Day 6: Lean Payload Formatter — returns ONLY the exact 7 fields required by drome.js cards
export const formatRecommendationCards = (
  topResultsRaw = [],
  userWatchlistSet = new Set(),
) => {
  return topResultsRaw.map((item) => {
    const isAnime =
      item.media_type === "anime" ||
      (item.original_language === "ja" && item.genre_ids?.includes(16));
    const isTv =
      !isAnime && (item.media_type === "tv" || Boolean(item.first_air_date));

    const mediaType = isAnime ? "anime" : isTv ? "tv" : "movie";
    const year =
      (item.release_date || item.first_air_date || "").split("-")[0] || "N/A";

    return {
      id: Number(item.id),
      title: item.title || item.name || "Untitled",
      poster: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "/assets/posters/default-poster.png",
      score:
        typeof item.vote_average === "number" && item.vote_average > 0
          ? item.vote_average.toFixed(1)
          : "NR",
      mediaType,
      meta: year,
      inWatchlist: userWatchlistSet.has(Number(item.id)),
    };
  });
};

// Structured diagnostic console logging (Clean Aligned Table Style)
export const logEngineDiagnostics = ({
  currentUserId,
  userReviewsCount,
  resolvedAnchorNames = [],
  isStandaloneAnchorSearch = false,
  parsedIntent,
  resolvedDirectorId = null,
  resolvedActorNames = [],
  resolvedActorIds = [],
  requestedActorsList = [],
  hasExplicitActorRequest = false,
  hasStrictFormats = false,
  effectiveRatingFloor = 6.8,
  sessionSeenIds = new Set(),
  userProfileStats = { genres: {}, keywords: {} },
  topResultsRaw = [],
}) => {
  const intentW =
    userReviewsCount >= 10 ? "40" : userReviewsCount >= 5 ? "50" : "60";
  const userW =
    userReviewsCount >= 10 ? "35" : userReviewsCount >= 5 ? "15" : "0";
  const ratingW =
    userReviewsCount >= 10 ? "25" : userReviewsCount >= 5 ? "35" : "40";

  const divider = "-".repeat(76);

  console.log(`\n${divider}`);
  console.log(
    ` CINDROME ENGINE  |  User #${currentUserId} (${userReviewsCount} reviews)  |  Weights: ${intentW} / ${userW} / ${ratingW}`,
  );
  console.log(divider);

  if (resolvedAnchorNames.length > 0) {
    console.log(
      ` Anchor   : ${resolvedAnchorNames.map((n) => `"${n}"`).join(", ")}${isStandaloneAnchorSearch ? " (Standalone)" : ""}`,
    );
  }
  if (parsedIntent.extractedDirector) {
    console.log(
      ` Director : "${parsedIntent.extractedDirector}" (ID: ${resolvedDirectorId || "N/A"})`,
    );
  }
  if (resolvedActorNames.length > 0 || hasExplicitActorRequest) {
    const actList =
      resolvedActorNames.length > 0 ? resolvedActorNames : requestedActorsList;
    console.log(
      ` Actors   : ${actList.map((n, i) => `"${n}" (${resolvedActorIds[i] || "N/A"})`).join(", ")}`,
    );
  }

  const filterParts = [
    `Rating >= ${effectiveRatingFloor}`,
    `Seen Excluded: ${sessionSeenIds.size}`,
  ];
  if (parsedIntent.minYear !== null || parsedIntent.maxYear !== null) {
    filterParts.push(
      `Era: ${parsedIntent.minYear || "Any"}-${parsedIntent.maxYear || "Now"}`,
    );
  }
  if (parsedIntent.detectedLanguage || parsedIntent.detectedCountry) {
    filterParts.push(
      `Origin: ${parsedIntent.detectedRegionLabel || parsedIntent.detectedCountry || parsedIntent.detectedLanguage}`,
    );
  }
  if (hasStrictFormats) {
    filterParts.push(`Format: ${parsedIntent.strictFormats.join("/")}`);
  }
  if (parsedIntent.excludeViolence) {
    filterParts.push(`Mode: PG-13 Safe`);
  }
  if (parsedIntent.isNowPlaying) {
    filterParts.push(`Mode: In Theaters`);
  }
  console.log(` Filters  : ${filterParts.join("  |  ")}`);

  if (
    (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) ||
    (parsedIntent.excludedTermsFromPrompt &&
      parsedIntent.excludedTermsFromPrompt.length > 0)
  ) {
    const exList = [
      ...(parsedIntent.excludedGenres || []),
      ...(parsedIntent.excludedTermsFromPrompt || []),
    ];
    console.log(` Excluded : ${exList.join(", ")}`);
  }

  const topKws = Object.keys(userProfileStats.keywords || {}).slice(0, 5);
  if (topKws.length > 0) {
    console.log(` User Kws : ${topKws.join(", ")}`);
  }

  console.log(divider);
  console.log(
    ` #   ${"Title".padEnd(24)} ${"Final".padEnd(8)} ${"Intent".padEnd(8)} ${"User".padEnd(7)} ${"Rating".padEnd(8)} Matched`,
  );
  console.log(divider);

  if (topResultsRaw.length === 0) {
    console.log(`     No matching recommendations found for this query.`);
  } else {
    topResultsRaw.slice(0, 4).forEach((item, idx) => {
      const rawTitle = item.title || item.name || "Unknown";
      const cleanTitle =
        rawTitle.length > 22 ? rawTitle.slice(0, 21) + "…" : rawTitle;
      const titleCol = cleanTitle.padEnd(24);
      const finalCol = (item.finalScore ?? 0).toFixed(1).padEnd(8);
      const intentCol = Math.round(item.breakdown?.s_intent ?? 0)
        .toString()
        .padEnd(8);
      const userCol = Math.round(item.breakdown?.s_user ?? 50)
        .toString()
        .padEnd(7);
      const ratingCol = Math.round(item.breakdown?.s_rating ?? 0)
        .toString()
        .padEnd(8);
      const kwMatches = (item.breakdown?.matched_user_keywords || [])
        .slice(0, 2)
        .join(", ");

      console.log(
        ` ${idx + 1}.  ${titleCol} ${finalCol} ${intentCol} ${userCol} ${ratingCol} ${kwMatches || "-"}`,
      );
    });
  }

  console.log(`${divider}\n`);
};
