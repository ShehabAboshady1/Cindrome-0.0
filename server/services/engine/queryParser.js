// services/engine/queryParser.js
import {
  NON_DIRECTOR_WORDS,
  GREETING_AND_CHITCHAT_STOPWORDS,
  AMBIGUOUS_PERSON_MAP,
  REGIONAL_NATIONALITY_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  PRE_MODIFIER_GENRE_MOOD_WORDS,
  GENRE_DESCRIPTOR_STOPWORDS,
  genreMap,
  themeKeywords,
  TMDB_GENRE_IDS,
} from "./constants.js";
import {
  getSimilarityScore,
  normalizeInput,
  isValidAmbiguousSingleWordUsage,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  resolveFuzzyActor,
  extractActors,
  normalizePromptSpelling,
  correctTypos,
} from "./textHelper.js";

// Detect conversational Small Talk (Greetings, Thanks, Bot Identity) and return a natural response
export const detectSmallTalk = (rawText) => {
  if (!rawText || typeof rawText !== "string") return null;
  const clean = rawText
    .toLowerCase()
    .replace(/[?.,!'"():;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return null;

  // 1. Greetings
  if (
    /^(?:hi+|hello+|hey+|hola|yo|sup|good\s+(?:morning|afternoon|evening)|greetings)(?:\s+(?:there|drome|cindrome|bot|ai|bro|man|friend))?$/i.test(
      clean,
    )
  ) {
    return "Hey there! I'm Drome, your personal cinema & anime recommender. Tell me what mood or genre you're in (like 'dark sci-fi with a plot twist'), or name a movie, actor, or director you love!";
  }

  // 2. How are you / What's up
  if (
    /^(?:how\s+(?:are\s+you|r\s+u|are\s+u|is\s+it\s+going|do\s+you\s+do)|what'?s\s+up|whats\s+up|wassup)(?:\s+(?:today|drome|bro|man))?$/i.test(
      clean,
    )
  ) {
    return "I'm doing great and ready to find your next favorite watch! What are you in the mood for today — a mind-bending thriller, a feel-good comedy, an anime, or movies by a specific actor or director?";
  }

  // 3. Gratitude / Closing
  if (
    /^(?:thanks?(?:\s+a\s+lot|\s+so\s+much|\s+you)?|thank\s+(?:you|u)(?:\s+so\s+much|\s+very\s+much)?|thx|ty|appreciate\s+it|cool\s+thanks|awesome\s+thanks|great\s+thanks)(?:\s+(?:drome|bro|man|mate))?$/i.test(
      clean,
    )
  ) {
    return "You're very welcome! Enjoy your watch, and whenever you need another recommendation or want to switch genres, just let me know!";
  }

  // 4. Farewell
  if (/^(?:bye+|goodbye|see\s+ya|see\s+you|cya|good\s+night)$/i.test(clean)) {
    return "See you later! Enjoy the movies, and come back anytime you need a fresh recommendation.";
  }

  // 5. Bot Identity / Help
  if (
    /^(?:who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|how\s+do\s+you\s+work|help(?:\s+me)?)$/i.test(
      clean,
    )
  ) {
    return "I'm the Cindrome Personalization Engine! I can recommend movies, TV series, and anime based on your exact mood, micro-genres (like 'cyberpunk' or 'dark comedy'), favorite titles ('like Interstellar'), actors ('starring Jason Statham'), directors ('directed by Nolan'), or specific eras. What would you like to watch?";
  }

  return null;
};

// Detect ambiguous first names or overly vague prompts that need smart clarification
export const detectSmartClarification = (rawText) => {
  if (!rawText || typeof rawText !== "string") return null;
  const clean = rawText
    .toLowerCase()
    .replace(/[?.,!'"():;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return null;

  // Strip generic media wrappers around a single name (e.g., "movies of chris", "chris movies", "starring tom")
  const strippedName = clean
    .replace(
      /\b(?:recommend|suggest|show|me|give|want|looking|for|find|movies?|films?|series|shows?|works?|by|of|with|starring|actor|director)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (AMBIGUOUS_PERSON_MAP[strippedName]) {
    return AMBIGUOUS_PERSON_MAP[strippedName];
  }

  // Check overly vague requests ("something good", "recommend a movie", "what should I watch", "anything good")
  if (
    /^(?:recommend\s+(?:me\s+)?(?:something|anything|a\s+movie|a\s+series|a\s+show|an\s+anime)|suggest\s+(?:something|a\s+movie|a\s+show)|(?:something|anything)\s+(?:good|great|nice|interesting|amazing|to\s+watch)|(?:a\s+)?(?:good|great|nice)\s+(?:movie|movies|film|films|series|show|shows|anime)|what\s+(?:should|can)\s+i\s+watch(?:\s+tonight|\s+today)?|i\s+don'?t\s+know\s+what\s+to\s+watch|idk\s+what\s+to\s+watch|surprise\s+me)$/i.test(
      clean,
    )
  ) {
    return "I'd love to help! To give you the best picks, could you tell me a bit more? For example:\n• A mood or genre (e.g., 'mind-bending sci-fi', 'dark comedy', 'cozy family movie')\n• A movie or series you loved (e.g., 'something like Shutter Island')\n• Or a favorite actor or director!";
  }

  return null;
};

// Early logical contradiction detector with actor/director collision protection and positive genre/tone conflict checks
export const detectContradictions = ({
  rawDetectedGenres,
  excludedGenres,
  isRomCom,
  isCuteAnimeRomCom,
  isSitcom,
  isPureComedy,
  isComfortComedy,
  isMindBlowingAction,
  isCyberpunk,
  isPhilosophicalSciFi,
  isTrueCrimeDoc,
  isFamilyAnimation,
  isHauntedHorror = false,
  wantsExplicitLiveAction,
  wantsExplicitAnime,
  isAdaptationMentioned,
  wantsClassic,
  minYear,
  maxYear,
  extractedReferenceTitles,
  extractedDirector = null,
  actors = [],
  fullContextText = "",
}) => {
  const formatGenreLabel = (g) => (g === "scifi" ? "Sci-Fi" : g);

  const normalizedActorsSet = new Set(
    (Array.isArray(actors) ? actors : [])
      .map((a) =>
        String(a || "")
          .toLowerCase()
          .trim(),
      )
      .filter(Boolean),
  );
  const normalizedDirector = String(extractedDirector || "")
    .toLowerCase()
    .trim();

  // 0a. Positive Genre/Tone Contradiction: Horror / Gore / Slasher AND Family / Kids
  const negativeStripRegex =
    /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no|drop|remove|relax|ignore|forget|clear)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi;
  const positiveContextText = String(fullContextText || "")
    .replace(negativeStripRegex, " ")
    .trim();

  const wantsHorrorOrGore =
    (Array.isArray(rawDetectedGenres) &&
      rawDetectedGenres.includes("horror")) ||
    Boolean(isHauntedHorror) ||
    /\b(bloody|gore|gory|slasher|terrifying|demonic)\b/i.test(
      positiveContextText,
    );

  const wantsFamilyOrKids =
    (Array.isArray(rawDetectedGenres) &&
      rawDetectedGenres.includes("family")) ||
    Boolean(isFamilyAnimation) ||
    /\b(for kids|kid-friendly|kid friendly|kids|children|family-friendly|family friendly|all ages)\b/i.test(
      positiveContextText,
    );

  if (wantsHorrorOrGore && wantsFamilyOrKids) {
    return `It looks like there's a contradiction in your request: you asked for bloody/scary horror while also specifying family-friendly or kids content. Would you prefer a horror movie/series for adults, or a light, family-friendly watch instead?`;
  }

  // 0b. Positive Tone Contradiction: Light-hearted / Cheerful / Feel-good AND Depressing / Tragic / Bleak / Soul-crushing
  const wantsLightCheerfulTone =
    /\b(light-hearted|lighthearted|cheerful|feel-good|feel good|uplifting|happy-go-lucky)\b/i.test(
      positiveContextText,
    );
  const wantsBleakDepressingTone =
    /\b(depressing|tragic|bleak|soul-crushing|soul crushing|devastating|heartbreaking|miserable|hopeless)\b/i.test(
      positiveContextText,
    );

  if (wantsLightCheerfulTone && wantsBleakDepressingTone) {
    return `It looks like there's a tone contradiction in your request: you asked for something light-hearted/feel-good while also asking for a depressing/tragic/bleak story. Would you prefer an uplifting, feel-good watch or a heavy, emotional drama?`;
  }

  // 1. Direct contradiction between requested genre and excluded genre
  for (const genre of rawDetectedGenres) {
    if (excludedGenres.includes(genre)) {
      const displayGenre = formatGenreLabel(genre);
      return `It looks like there's a contradiction in your request: you asked for ${displayGenre} while also excluding ${displayGenre}. Could you clarify whether you'd like to include or exclude ${displayGenre}?`;
    }
  }

  // 2. Sub-intent contradictions with excluded genres
  if (
    (isRomCom || isCuteAnimeRomCom) &&
    (excludedGenres.includes("romance") || excludedGenres.includes("comedy"))
  ) {
    const blocked = excludedGenres.includes("romance") ? "romance" : "comedy";
    return `You requested a Romantic Comedy (Rom-Com) while also excluding ${blocked}. Would you prefer a pure ${blocked === "romance" ? "comedy" : "romance"} instead, or should I keep the Rom-Com vibe?`;
  }

  if (
    (isSitcom || isPureComedy || isComfortComedy) &&
    excludedGenres.includes("comedy")
  ) {
    return `You asked for a Sitcom / Comedy while also excluding comedy. Please let me know if you want light comedy recommendations or a different genre entirely!`;
  }

  if (
    (isMindBlowingAction || isCyberpunk || isPhilosophicalSciFi) &&
    excludedGenres.includes("scifi")
  ) {
    return `You requested a Cyberpunk / Sci-Fi concept while also excluding Sci-Fi. Would you like to keep the Sci-Fi theme or switch to a grounded non-Sci-Fi thriller/action?`;
  }

  if (
    isTrueCrimeDoc &&
    (excludedGenres.includes("documentary") || excludedGenres.includes("crime"))
  ) {
    const blocked = excludedGenres.includes("documentary")
      ? "documentaries"
      : "crime";
    return `You asked for a True Crime Documentary while excluding ${blocked}. Would you prefer a fictional crime thriller or a true crime docuseries?`;
  }

  if (
    isFamilyAnimation &&
    (excludedGenres.includes("animation") || excludedGenres.includes("family"))
  ) {
    const blocked = excludedGenres.includes("animation")
      ? "animation"
      : "family";
    return `You requested a Family Animation title while also excluding ${blocked}. Could you clarify which one you'd like to prioritize?`;
  }

  // 3. Format contradiction (Live-Action vs Anime) or timeline conflict
  if (wantsExplicitLiveAction && wantsExplicitAnime && !isAdaptationMentioned) {
    return `You asked for both Live-Action and Anime at the same time. Would you prefer animated Japanese anime or live-action movies/series?`;
  }

  if (wantsClassic && minYear && minYear >= 2010) {
    return `You asked for a classic/retro (80s/90s) title released after ${minYear}. Would you prefer genuine 80s/90s classics, or modern releases from ${minYear} onward?`;
  }

  if (minYear !== null && maxYear !== null && minYear > maxYear) {
    return `The timeline range in your request conflicts (after ${minYear} and before ${maxYear + 1}). Could you double-check the release years you're looking for?`;
  }

  // 4. Reference anchor contradiction with excluded genres (ignoring actor and director names)
  if (
    Array.isArray(extractedReferenceTitles) &&
    extractedReferenceTitles.length > 0
  ) {
    for (const refTitle of extractedReferenceTitles) {
      const refLower = String(refTitle || "")
        .toLowerCase()
        .trim();
      if (!refLower) continue;

      if (
        normalizedActorsSet.has(refLower) ||
        (normalizedDirector && refLower === normalizedDirector) ||
        resolveFuzzyActor(refTitle) ||
        resolveFuzzyDirector(refTitle)
      ) {
        continue;
      }

      const matchedAnchor = resolveFuzzyAnchorTitle(refTitle, fullContextText);
      if (matchedAnchor && excludedGenres.includes(matchedAnchor.genre)) {
        const gLabel = formatGenreLabel(matchedAnchor.genre);
        return `You asked for something like "${matchedAnchor.canonical}" (which is primarily ${gLabel}) while excluding ${gLabel}. Would you like ${gLabel} recommendations similar to "${matchedAnchor.canonical}", or another genre with a similar mood?`;
      }
    }
  }

  return null;
};

// Parse user query after passing text through normalizePromptSpelling
export const parseQuery = (text, selectedType = "mixed") => {
  if (/[\u0600-\u06FF]/.test(text)) {
    return {
      isValid: false,
      message:
        "Currently, Drome AI only supports English prompts. Please describe what you'd like to watch in English (e.g., 'Mind-bending sci-fi with a plot twist').",
      actors: [],
      extractedActors: [],
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: {
        dropEra: false,
        dropFormats: false,
        dropOrigins: false,
        droppedGenres: [],
      },
      replacePrevious: false,
      excludeViolence: false,
    };
  }

  // 0a. Check Small Talk first (hi, how are you, thanks, who are you)
  const smallTalkReply = detectSmallTalk(text);
  if (smallTalkReply) {
    return {
      isValid: true,
      isSmallTalk: true,
      smallTalkMessage: smallTalkReply,
      message: smallTalkReply,
      targetType: selectedType,
      detectedGenres: [],
      detectedKeywords: [],
      actors: [],
      extractedActors: [],
      extractedActor: null,
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: {
        dropEra: false,
        dropFormats: false,
        dropOrigins: false,
        droppedGenres: [],
      },
      replacePrevious: false,
      excludeViolence: false,
      originalText: text,
    };
  }

  // 0b. Check Smart Intent Clarification (e.g., "Chris", "Tom", "something good")
  const clarificationReply = detectSmartClarification(text);
  if (clarificationReply) {
    return {
      isValid: true,
      needsClarification: true,
      clarificationMessage: clarificationReply,
      message: clarificationReply,
      targetType: selectedType,
      detectedGenres: [],
      detectedKeywords: [],
      actors: [],
      extractedActors: [],
      extractedActor: null,
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: {
        dropEra: false,
        dropFormats: false,
        dropOrigins: false,
        droppedGenres: [],
      },
      replacePrevious: false,
      excludeViolence: false,
      originalText: text,
    };
  }

  const spellNormalized = normalizePromptSpelling(text);
  const normalizedRawText = normalizeInput(spellNormalized);
  const lowerText = normalizedRawText.toLowerCase().trim();

  // 1. Multi-Turn Constraint Relaxation & Replacement (`relaxedConstraints` & `replacePrevious`)
  const relaxedConstraints = {
    dropEra: false,
    dropFormats: false,
    dropOrigins: false,
    droppedGenres: [],
  };

  const relaxationClauseRegex =
    /\b(?:drop|remove|relax|ignore|forget|clear|skip|ditch|leave\s+out)\s+(?:the\s+|that\s+|those\s+|any\s+|all\s+)?([^,.;!?\n]+?)(?=\s+\b(?:and\s+(?:just|give|show|recommend|suggest|focus|find|instead)|but|instead|so|just\s+give|just\s+show)\b|[,.;!?\n]|$)/gi;

  let textWithoutRelaxationClauses = lowerText;
  let rawTextWithoutRelaxationClauses = normalizedRawText;

  const parseRelaxedTargetText = (clauseStr) => {
    if (!clauseStr) return;
    if (
      /\b(era|year|years|decade|decades|date|dates|time\s+period|timeline|19\d{2}s?|20\d{2}s?|[0-9]{2}s|old|classic|pre-1970|ancient)\b/i.test(
        clauseStr,
      )
    ) {
      relaxedConstraints.dropEra = true;
    }
    if (
      /\b(silent|black\s+and\s+white|black\s*&\s*white|b&w|monochrome|format|formats|style)\b/i.test(
        clauseStr,
      )
    ) {
      relaxedConstraints.dropFormats = true;
    }
    if (
      /\b(origin|origins|country|countries|nationality|language|regional|region)\b/i.test(
        clauseStr,
      )
    ) {
      relaxedConstraints.dropOrigins = true;
    }
    for (const regionRule of REGIONAL_NATIONALITY_MAP) {
      if (regionRule.pattern.test(clauseStr)) {
        relaxedConstraints.dropOrigins = true;
      }
    }
    for (const [gName, kwList] of Object.entries(genreMap)) {
      if (
        new RegExp(`\\b${gName}\\b`, "i").test(clauseStr) ||
        kwList.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(clauseStr))
      ) {
        if (!relaxedConstraints.droppedGenres.includes(gName)) {
          relaxedConstraints.droppedGenres.push(gName);
        }
      }
    }
    if (
      /\b(all|everything|previous)\s+(?:constraints?|filters?|ones?|rules?|limits?)\b/i.test(
        clauseStr,
      )
    ) {
      relaxedConstraints.dropEra = true;
      relaxedConstraints.dropFormats = true;
      relaxedConstraints.dropOrigins = true;
    }
  };

  let relaxMatch;
  while ((relaxMatch = relaxationClauseRegex.exec(lowerText)) !== null) {
    parseRelaxedTargetText(relaxMatch[1].toLowerCase().trim());
  }

  const withoutConstraintRegex =
    /\bwithout\s+(?:the\s+|that\s+|those\s+)?([^,.;!?\n]+?)\s+(?:constraints?|filters?|limits?|restrictions?|ones?|part)\b/gi;
  let wcMatch;
  while ((wcMatch = withoutConstraintRegex.exec(lowerText)) !== null) {
    parseRelaxedTargetText(wcMatch[1].toLowerCase().trim());
  }

  textWithoutRelaxationClauses = textWithoutRelaxationClauses
    .replace(relaxationClauseRegex, " ")
    .replace(withoutConstraintRegex, " ")
    .replace(/\s+/g, " ")
    .trim();

  rawTextWithoutRelaxationClauses = rawTextWithoutRelaxationClauses
    .replace(relaxationClauseRegex, " ")
    .replace(withoutConstraintRegex, " ")
    .replace(/\s+/g, " ")
    .trim();

  const negativeClauseStripRegex =
    /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi;
  const affirmativeText = textWithoutRelaxationClauses
    .replace(negativeClauseStripRegex, " ")
    .trim();

  // Detect Content Exclusion / Family-Safe Filtering (`excludeViolence`)
  const excludeViolence =
    /\b(without\s+(?:any\s+|heavy\s+|extreme\s+)?violence|no\s+(?:heavy\s+|extreme\s+)?violence|no\s+gore|without\s+(?:any\s+)?gore|non[- ]violent|blood[- ]free|gore[- ]free|family[- ]friendly|kid[- ]friendly|for\s+kids|safe\s+for\s+kids|suitable\s+for\s+kids)\b/i.test(
      lowerText,
    );

  // Strict negative extraction scope for excluded genres, keywords, and terms
  const excludedGenres = [];
  const excludedTermsFromPrompt = [];
  const excludedKeywords = [];

  if (excludeViolence) {
    excludedGenres.push("horror");
    excludedTermsFromPrompt.push("gore", "slasher", "violence");
  }

  const NON_EXCLUDABLE_STOPWORDS = new Set([
    "show",
    "me",
    "want",
    "i",
    "a",
    "an",
    "the",
    "movies",
    "movie",
    "films",
    "film",
    "series",
    "shows",
    "tv",
    "instead",
    "actually",
    "rather",
    "light",
    "pure",
    "give",
    "looking",
    "find",
    "some",
    "any",
    "please",
    "like",
    "with",
    "only",
    "constraint",
    "constraints",
    "filter",
    "filters",
    "limit",
    "limits",
    "restriction",
    "restrictions",
    "one",
    "ones",
    "part",
    "stuff",
    "things",
  ]);

  const negativeClauseRegex =
    /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi;

  let match;
  while (
    (match = negativeClauseRegex.exec(textWithoutRelaxationClauses)) !== null
  ) {
    const clause = match[1].toLowerCase().trim();

    if (/\b(silent|black\s+and\s+white|b&w|monochrome)\b/i.test(clause)) {
      relaxedConstraints.dropFormats = true;
    }
    if (/\b(19\d{2}s?|20\d{2}s?|[0-9]{2}s|decade|era)\b/i.test(clause)) {
      relaxedConstraints.dropEra = true;
    }
    for (const regionRule of REGIONAL_NATIONALITY_MAP) {
      if (regionRule.pattern.test(clause)) {
        relaxedConstraints.dropOrigins = true;
      }
    }

    const tokens = clause.split(/\s+(?:or|and|nor)\s+|\s*,\s*|\s+/);

    tokens.forEach((rawToken) => {
      let token = rawToken.trim();
      if (!token || token.length <= 1 || NON_EXCLUDABLE_STOPWORDS.has(token))
        return;

      if (
        [
          "violence",
          "violent",
          "gore",
          "gory",
          "blood",
          "bloody",
          "slasher",
          "scary",
          "creepy",
          "spooky",
          "terrifying",
        ].includes(token)
      ) {
        if (!excludedGenres.includes("horror")) {
          excludedGenres.push("horror");
        }
        if (!excludedTermsFromPrompt.includes(token)) {
          excludedTermsFromPrompt.push(token);
        }
        return;
      }

      if (
        [
          "ecchi",
          "exhi",
          "exchi",
          "echi",
          "etchi",
          "ecchii",
          "fanservice",
        ].includes(token) ||
        getSimilarityScore(token, "ecchi") >= 0.65
      ) {
        token = "ecchi";
        if (!excludedTermsFromPrompt.includes("ecchi"))
          excludedTermsFromPrompt.push("ecchi");
        ["2858", "190370", "9716"].forEach((kwId) => {
          if (!excludedKeywords.includes(kwId)) excludedKeywords.push(kwId);
        });
        return;
      }

      if (
        ["harem", "harim", "hareem"].includes(token) ||
        (token !== "haram" && getSimilarityScore(token, "harem") >= 0.72)
      ) {
        token = "harem";
        if (!excludedTermsFromPrompt.includes("harem"))
          excludedTermsFromPrompt.push("harem");
        ["2858", "190370", "9716"].forEach((kwId) => {
          if (!excludedKeywords.includes(kwId)) excludedKeywords.push(kwId);
        });
        return;
      }

      if (
        [
          "mecha",
          "robot",
          "robots",
          "mech",
          "mechs",
          "cyborg",
          "cyborgs",
        ].includes(token)
      ) {
        if (!excludedTermsFromPrompt.includes(token))
          excludedTermsFromPrompt.push(token);
        if (!excludedKeywords.includes("209355"))
          excludedKeywords.push("209355");
        if (!excludedKeywords.includes("163077"))
          excludedKeywords.push("163077");
        return;
      }

      if (["superhero", "superheroes", "super"].includes(token)) {
        if (!excludedTermsFromPrompt.includes("superhero"))
          excludedTermsFromPrompt.push("superhero");
        if (!excludedKeywords.includes("9715")) excludedKeywords.push("9715");
        return;
      }

      if (token === "detective") {
        if (!excludedTermsFromPrompt.includes("detective"))
          excludedTermsFromPrompt.push("detective");
        return;
      }

      if (["modern", "guns", "gun", "firearms"].includes(token)) {
        if (!excludedTermsFromPrompt.includes(token))
          excludedTermsFromPrompt.push(token);
        return;
      }

      let isOfficialGenre = false;
      for (const [gName, kwList] of Object.entries(genreMap)) {
        if (gName === token || kwList.includes(token)) {
          if (!excludedGenres.includes(gName)) {
            excludedGenres.push(gName);
          }
          if (!relaxedConstraints.droppedGenres.includes(gName)) {
            relaxedConstraints.droppedGenres.push(gName);
          }
          isOfficialGenre = true;
        }
      }

      if (!isOfficialGenre && !excludedTermsFromPrompt.includes(token)) {
        excludedTermsFromPrompt.push(token);
      }
    });
  }

  if (
    /\b(?:exclude|no|without|except|zero)\s+.*?\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
      lowerText,
    )
  ) {
    if (!excludedKeywords.includes("9715")) excludedKeywords.push("9715");
  }

  // 7. Extract comprehensive temporal filters
  let minYear = null;
  let maxYear = null;

  if (!relaxedConstraints.dropEra) {
    const betweenYearMatch = affirmativeText.match(
      /\bbetween\s+(19\d{2}|20\d{2})\s+(?:and|-|to)\s+(19\d{2}|20\d{2})\b/i,
    );
    if (betweenYearMatch) {
      const y1 = parseInt(betweenYearMatch[1], 10);
      const y2 = parseInt(betweenYearMatch[2], 10);
      minYear = Math.min(y1, y2);
      maxYear = Math.max(y1, y2);
    } else {
      const afterYearMatch = affirmativeText.match(
        /\b(?:after|newer than|from|post|since)\s+(19\d{2}|20\d{2})\b/i,
      );
      if (afterYearMatch) {
        minYear = parseInt(afterYearMatch[1], 10);
      }

      const beforeYearMatch = affirmativeText.match(
        /\b(?:before|older than|prior to|pre|earlier than)\s+(19\d{2}|20\d{2})\b/i,
      );
      const upToYearMatch = affirmativeText.match(
        /\b(?:up to|until|through)\s+(19\d{2}|20\d{2})\b/i,
      );
      if (beforeYearMatch) {
        maxYear = parseInt(beforeYearMatch[1], 10) - 1;
      } else if (upToYearMatch) {
        maxYear = parseInt(upToYearMatch[1], 10);
      }

      const decadeMatch = affirmativeText.match(
        /\b(1900s|1910s|10s|1920s|20s|1930s|30s|1940s|40s|1950s|50s|1960s|60s|1970s|70s|1980s|80s|1990s|90s|2000s|00s|2010s|2020s)\b/i,
      );
      if (decadeMatch) {
        const decToken = decadeMatch[1].toLowerCase();
        const decadeMap = {
          "1900s": [1900, 1909],
          "00s": [1900, 2009],
          "10s": [1910, 1919],
          "1910s": [1910, 1919],
          "20s": [1920, 1929],
          "1920s": [1920, 1929],
          "30s": [1930, 1939],
          "1930s": [1930, 1939],
          "40s": [1940, 1949],
          "1940s": [1940, 1949],
          "50s": [1950, 1959],
          "1950s": [1950, 1959],
          "60s": [1960, 1969],
          "1960s": [1960, 1969],
          "70s": [1970, 1979],
          "1970s": [1970, 1979],
          "80s": [1980, 1989],
          "1980s": [1980, 1989],
          "90s": [1990, 1999],
          "1990s": [1990, 1999],
          "2000s": [2000, 2009],
          "2010s": [2010, 2019],
          "2020s": [2020, 2029],
        };
        if (decadeMap[decToken]) {
          if (decToken === "00s") {
            const isEarly1900sContext =
              /\b(1900s|early\s+00s\s+silent|silent|monochrome|black\s+and\s+white|b&w|vintage|old\s+classic)\b/i.test(
                affirmativeText,
              );
            if (minYear === null) minYear = isEarly1900sContext ? 1900 : 2000;
            if (maxYear === null) maxYear = isEarly1900sContext ? 1909 : 2009;
          } else {
            if (minYear === null) minYear = decadeMap[decToken][0];
            if (maxYear === null) maxYear = decadeMap[decToken][1];
          }
        }
      }

      if (minYear === null && maxYear === null) {
        const exactYearMatch = affirmativeText.match(
          /\b(?:in|from|year|released in|of)?\s*\b(19[0-9]\d|20[0-2]\d)\b/i,
        );
        if (
          exactYearMatch &&
          !affirmativeText.includes("blade runner 2049") &&
          !affirmativeText.includes("2001: a space odyssey") &&
          !affirmativeText.includes("2001 a space odyssey") &&
          !affirmativeText.includes("1917") &&
          !affirmativeText.includes("1922") &&
          !affirmativeText.includes("1984")
        ) {
          const exactY = parseInt(exactYearMatch[1], 10);
          minYear = exactY;
          maxYear = exactY;
        }
      }
    }
  }

  // 10. Extract explicit minimum rating floor (minRating)
  let minRating = null;
  const ratingPatterns = [
    /\b(?:rating|rated|score|imdb|tmdb)\s*(?:above|over|at least|minimum|min|higher than|>=|>|around|like|of)?\s*(\d(?:\.\d)?)\b/i,
    /\b(\d(?:\.\d)?)\s*\+\s*(?:rating|rated|stars?|imdb|tmdb|score)?\b/i,
    /\b(?:above|over|at least|minimum)\s+(\d(?:\.\d)?)\s*(?:rating|rated|stars?|imdb|tmdb|score|out of 10|\/10)\b/i,
  ];
  for (const rPat of ratingPatterns) {
    const rMatch = affirmativeText.match(rPat);
    if (rMatch) {
      const parsedR = parseFloat(rMatch[1]);
      if (!isNaN(parsedR) && parsedR >= 1.0 && parsedR <= 9.5) {
        minRating = parsedR;
        break;
      }
    }
  }

  // 9. Check for movies currently playing in theaters (isNowPlaying)
  const isNowPlaying =
    /\b(in\s+theat(?:er|re)s?|in\s+(?:the\s+)?cinemas?|now\s+playing|currently\s+(?:playing|showing)|playing\s+right\s+now|out\s+in\s+theat(?:er|re)s?|showing\s+in\s+theat(?:er|re)s?)\b/i.test(
      affirmativeText,
    );

  // 6. Extract director name (extractedDirector)
  let extractedDirector = null;
  const explicitDirPatterns = [
    /\b(?:directed\s+by|director|films?\s+by|movies?\s+by|series\s+by|shows?\s+by|works?\s+of|cinema\s+of)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|with|from|in|above|over|rated|rating|and|or)\b|$)/i,
    /\b([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,2}?)\s+(?:movies?|films?|cinema|filmography|directorial)\b/i,
    /\b(?:best|top|greatest|favorite|favourite)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)\s+(?:movies?|films?|series|shows?|cinema|works?)\b/i,
    /\b([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,2}?)\s+(?:sci-fi|scifi|action|horror|thriller|drama|crime|mystery|comedy|war|historical|history|fantasy|animation|animated|romance|musical|western)\s+(?:movies?|films?|series|shows?|cinema|works?)\b/i,
    /\bwho\s+directed\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,5}?)(?=[,.;!?]|$)/i,
  ];

  for (const dPat of explicitDirPatterns) {
    const dMatch = rawTextWithoutRelaxationClauses.match(dPat);
    if (dMatch) {
      const candidateDir = dMatch[1].trim();
      const fuzzyDir = resolveFuzzyDirector(candidateDir);
      if (fuzzyDir) {
        extractedDirector = fuzzyDir;
        break;
      } else if (
        dPat === explicitDirPatterns[0] &&
        candidateDir.split(/\s+/).length >= 2 &&
        !GENRE_DESCRIPTOR_STOPWORDS.has(candidateDir.toLowerCase()) &&
        !NON_DIRECTOR_WORDS.has(candidateDir.toLowerCase()) &&
        !resolveFuzzyActor(candidateDir)
      ) {
        extractedDirector = candidateDir;
        break;
      }
    }
  }

  if (!extractedDirector) {
    const standaloneDir = resolveFuzzyDirector(rawTextWithoutRelaxationClauses);
    if (standaloneDir) {
      extractedDirector = standaloneDir;
    } else {
      const rawTokens = rawTextWithoutRelaxationClauses
        .replace(/[^\w\s.\-']/g, " ")
        .split(/\s+/)
        .filter(
          (t) =>
            Boolean(t) &&
            !NON_DIRECTOR_WORDS.has(t.toLowerCase()) &&
            !/^\d+$/.test(t),
        );
      for (let i = 0; i < rawTokens.length; i += 1) {
        const singleDir = resolveFuzzyDirector(rawTokens[i]);
        if (singleDir) {
          extractedDirector = singleDir;
          break;
        }
        if (i < rawTokens.length - 1) {
          const pairDir = resolveFuzzyDirector(
            `${rawTokens[i]} ${rawTokens[i + 1]}`,
          );
          if (pairDir) {
            extractedDirector = pairDir;
            break;
          }
        }
      }
    }
  }

  // Extract actor names (actors) with cleanup, fuzzy matching, and director collision prevention
  const actors = extractActors(
    rawTextWithoutRelaxationClauses,
    extractedDirector,
  );
  const extractedActor = actors[0] || null;

  // Strip extracted actor names from affirmative text during genre scanning to prevent name-genre collisions
  let genreScanAffirmativeText = affirmativeText;
  for (const actorName of actors) {
    const escapedActor = actorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    genreScanAffirmativeText = genreScanAffirmativeText.replace(
      new RegExp(`\\b${escapedActor}\\b`, "gi"),
      " ",
    );
  }

  // Detect pivot / replacement phrasing (`isPivot` & `replacePrevious`) and anaphoric references
  const isPivot =
    /\b(instead|actually|rather|change of mind|on second thought|how about|what about|switch to|focus only on|only focus on)\b/i.test(
      lowerText,
    );
  const replacePrevious = Boolean(
    isPivot ||
    relaxedConstraints.dropEra ||
    relaxedConstraints.dropFormats ||
    relaxedConstraints.dropOrigins ||
    relaxedConstraints.droppedGenres.length > 0,
  );
  const preservesAnaphoricEra =
    /\b(that\s+same\s+(?:decade|era|year|period)|the\s+same\s+(?:decade|era|year|period)|same\s+(?:decade|era|year)|from\s+that\s+(?:decade|era|year))\b/i.test(
      lowerText,
    );
  const preservesAnaphoricPerson =
    /\b(his|her|their|that\s+(?:actor|actress|director)|same\s+(?:actor|actress|director))\b/i.test(
      lowerText,
    );

  const wantsExplicitLiveAction = /\b(live action|live-action)\b/i.test(
    affirmativeText,
  );
  const isAdaptationMentioned =
    /\b(adaptation|based on|live-action adaptation)\b/i.test(affirmativeText);

  const wantsExplicitAnime =
    /\b(anime|manga)\b/i.test(affirmativeText) &&
    (!wantsExplicitLiveAction || isAdaptationMentioned);

  // 8. Collect ALL matched origins/countries/industries into `origins: []`
  const origins = [];
  const matchedOriginObjects = [];

  if (!relaxedConstraints.dropOrigins) {
    for (const regionRule of REGIONAL_NATIONALITY_MAP) {
      if (regionRule.pattern.test(affirmativeText)) {
        if (!origins.includes(regionRule.label)) {
          origins.push(regionRule.label);
          matchedOriginObjects.push({
            lang: regionRule.lang,
            country: regionRule.country,
            label: regionRule.label,
          });
        }
      }
    }

    if (wantsExplicitAnime && !wantsExplicitLiveAction) {
      if (!origins.includes("Japanese")) {
        origins.push("Japanese");
        matchedOriginObjects.push({
          lang: "ja",
          country: "JP",
          label: "Japanese",
        });
      }
    }
  }

  let detectedLanguage = null;
  let detectedCountry = null;
  let detectedRegionLabel = null;

  if (matchedOriginObjects.length > 0) {
    detectedLanguage = matchedOriginObjects[0].lang;
    detectedCountry = matchedOriginObjects[0].country;
    detectedRegionLabel =
      origins.length > 1 ? origins.join(" / ") : matchedOriginObjects[0].label;
  }

  const isKorean = origins.includes("Korean") || detectedLanguage === "ko";

  // Detect niche stylistic/format constraints: `silent` and `black and white`
  const strictFormats = [];
  if (!relaxedConstraints.dropFormats) {
    if (
      /\b(silent|silent\s+films?|silent\s+movies?|silent\s+era|silent\s+horror|silent\s+comedy|silent\s+cinema)\b/i.test(
        affirmativeText,
      )
    ) {
      strictFormats.push("silent");
    }
    if (
      /\b(black\s+and\s+white|black\s*&\s*white|b&w|b\s*\/\s*w|monochrome)\b/i.test(
        affirmativeText,
      )
    ) {
      strictFormats.push("black and white");
    }
  }

  // Micro-Genre: Dark Comedy / Black Comedy (`isDarkComedy`)
  const isDarkComedy =
    !excludedGenres.includes("comedy") &&
    /\b(dark\s+comed(?:y|ies)|black\s+comed(?:y|ies)|morbid\s+humor|dark\s+humor|darkly\s+comedic|satirical\s+dark\s+comedy)\b/i.test(
      genreScanAffirmativeText,
    );

  const isPureComedy =
    !isDarkComedy &&
    /\b(pure comedy|only comedy|strictly comedy|purely comedy|hard comedy|just comedy|pure funny|hilarious|comedy movies?|funny movies?)\b/i.test(
      genreScanAffirmativeText,
    );

  const isSitcom =
    !isDarkComedy &&
    (/\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(
      genreScanAffirmativeText,
    ) ||
      (/\b(comfort|chill|relaxing|easy watch)\b/i.test(
        genreScanAffirmativeText,
      ) &&
        /\b(series|show|shows|tv)\b/i.test(genreScanAffirmativeText) &&
        /\b(comedy|laugh|funny)\b/i.test(genreScanAffirmativeText)));

  const hasQualityFloor =
    isPureComedy ||
    isDarkComedy ||
    /\b(mind[- ]blowing|mind blowing|masterpiece|masterpieces|epic|best|top[- ]tier|greatest|unbelievable|flawless)\b/i.test(
      genreScanAffirmativeText,
    );

  // Haunted House Horror (`isHauntedHorror`) — NEVER trigger if horror is excluded (e.g., "family house, no horror")
  const isHauntedHorror =
    !excludeViolence &&
    !excludedGenres.includes("horror") &&
    (/\b(cursed house|haunted house|haunted family|cursed family|scary house)\b/i.test(
      genreScanAffirmativeText,
    ) ||
      (/\b(scary|horror|haunted|cursed|creepy|demonic|evil|spooky)\b/i.test(
        genreScanAffirmativeText,
      ) &&
        /\b(house|family|home|manor|mansion|cabin)\b/i.test(
          genreScanAffirmativeText,
        )));

  const isCrimeFamily =
    /\b(crime family|mob family|mafia family|mafia empire|crime empire|gangster empire|building an empire|organized crime|gangster syndicate|drug empire|criminal empire)\b/i.test(
      genreScanAffirmativeText,
    );

  const isTiredMood =
    /\b(tired|im tired|i'm tired|exhausted|long day|after a long day|stress|stressed|rough day|bad day|hard day|unwind|burnout|need a laugh|heavy day)\b/i.test(
      lowerText,
    );

  const withoutDrama =
    excludedGenres.includes("drama") ||
    /\b(without\s+(?:any\s+)?drama|no\s+drama)\b/i.test(lowerText) ||
    isTiredMood ||
    isPureComedy ||
    isSitcom;

  const isPure =
    /\b(pure|strictly|only|just|100%|nothing but)\b/i.test(lowerText) ||
    withoutDrama;

  const isStandaloneAmbiguousTitlePrompt =
    AMBIGUOUS_SINGLE_WORD_TITLES.has(
      lowerText
        .replace(/[?.,!]/g, "")
        .replace(/^(a|an|the)\s+/, "")
        .trim(),
    ) &&
    isValidAmbiguousSingleWordUsage(
      lowerText
        .replace(/[?.,!]/g, "")
        .replace(/^(a|an|the)\s+/, "")
        .trim(),
      normalizedRawText,
    );

  const wantsDark =
    !isStandaloneAmbiguousTitlePrompt &&
    !excludeViolence &&
    !isDarkComedy &&
    /\b(dark|grim|bleak|mature|disturbing|gothic|brutal|suffering)\b/i.test(
      genreScanAffirmativeText,
    );

  let rawDetectedGenres = [];
  for (const [genre, keywords] of Object.entries(genreMap)) {
    if (relaxedConstraints.droppedGenres.includes(genre)) continue;
    if (
      keywords.some((kw) => {
        if (
          isStandaloneAmbiguousTitlePrompt &&
          AMBIGUOUS_SINGLE_WORD_TITLES.has(kw.toLowerCase())
        ) {
          return false;
        }
        if (
          genre === "family" &&
          kw === "family" &&
          (isHauntedHorror || isCrimeFamily) &&
          !/\b(for kids|kid-friendly|kid friendly|kids|children|family-friendly|family friendly|all ages|family movie|cozy family|wholesome)\b/i.test(
            genreScanAffirmativeText,
          )
        ) {
          return false;
        }
        return new RegExp(`\\b${kw}\\b`, "i").test(genreScanAffirmativeText);
      })
    ) {
      if (!rawDetectedGenres.includes(genre)) rawDetectedGenres.push(genre);
    }
  }

  const hasExplicitSciFi =
    !relaxedConstraints.droppedGenres.includes("scifi") &&
    /\b(sci[- ]?fi|scifi|science\s+fiction)\b/i.test(genreScanAffirmativeText);

  if (hasExplicitSciFi && !rawDetectedGenres.includes("scifi")) {
    rawDetectedGenres.push("scifi");
  }

  let detectedKeywords = [];
  const seenKeywordIds = new Set();
  for (const [theme, data] of Object.entries(themeKeywords)) {
    if (theme === "haunted house" && excludedGenres.includes("horror")) {
      continue;
    }
    if (
      data.terms.some((t) =>
        new RegExp(`\\b${t}\\b`, "i").test(genreScanAffirmativeText),
      )
    ) {
      if (!seenKeywordIds.has(data.id)) {
        seenKeywordIds.add(data.id);
        detectedKeywords.push({ name: theme, id: data.id });
      }
    }
  }

  if (excludedKeywords.includes("9715")) {
    detectedKeywords = detectedKeywords.filter((k) => k.name !== "superhero");
  }

  const isSwordWarfare =
    detectedKeywords.some((k) => k.name === "sword warfare") ||
    /\b(swords?|sword fight|sword battles?|ancient sword battles?|swords and armies|ancient warfare|medieval warfare|old historical battles?|medieval armies|ancient battles?|gladiators?|samurai|shields and swords|ancient armies|braveheart)\b/i.test(
      genreScanAffirmativeText,
    ) ||
    (/\b(battle|battles|war|armies|army)\b/i.test(genreScanAffirmativeText) &&
      /\b(sword|swords|ancient|medieval|gladiator|samurai|shields?|old historical)\b/i.test(
        genreScanAffirmativeText,
      ));

  if (isSwordWarfare) {
    const warIdx = excludedGenres.indexOf("war");
    if (warIdx > -1) excludedGenres.splice(warIdx, 1);
    if (!excludedTermsFromPrompt.includes("modern")) {
      excludedTermsFromPrompt.push("modern");
    }
  }

  const wantsClassic =
    !relaxedConstraints.dropEra &&
    /\b(classic|retro|old|1900s|1910s|10s|1920s|20s|1930s|30s|1940s|40s|1950s|50s|1960s|60s|70s|80s|90s|1970s|1980s|1990s|vintage|nostalgic)\b/i.test(
      affirmativeText,
    );

  const isMindBlowingAction =
    detectedKeywords.some((k) => k.name === "mind blowing action") ||
    (/\b(mind[- ]blowing|mind blowing)\b/i.test(genreScanAffirmativeText) &&
      (rawDetectedGenres.includes("action") ||
        /\baction\b/i.test(genreScanAffirmativeText))) ||
    (hasQualityFloor &&
      /\baction\b/i.test(genreScanAffirmativeText) &&
      /\b(mind|reality|concept|twist|sci-fi)\b/i.test(
        genreScanAffirmativeText,
      ));

  const isHorrorNight =
    !excludeViolence &&
    !excludedGenres.includes("horror") &&
    /\b(movie night|with friends|party|friends|sleepover|crowd|popcorn)\b/i.test(
      genreScanAffirmativeText,
    ) &&
    (rawDetectedGenres.includes("horror") ||
      /\b(horror|scary|spooky)\b/i.test(genreScanAffirmativeText));

  const isPsychologicalThriller =
    detectedKeywords.some((k) => k.name === "psychological thriller") ||
    /\b(psychological thriller|mess with my head|mindfuck|mind game|mind games|sanity|paranoia|unreliable narrator)\b/i.test(
      genreScanAffirmativeText,
    );

  const isRomCom =
    !isPureComedy &&
    !isDarkComedy &&
    !isSitcom &&
    (detectedKeywords.some((k) => k.name === "rom-com") ||
      /\b(rom-com|romcom|romantic comedy|sweet.*romance|light.*romance|lift my mood|feel[- ]good)\b/i.test(
        genreScanAffirmativeText,
      ) ||
      (/\b(sweet|light|chill|comfort|wholesome|cute)\b/i.test(
        genreScanAffirmativeText,
      ) &&
        (rawDetectedGenres.includes("romance") ||
          /\b(romance|romantic)\b/i.test(genreScanAffirmativeText))));

  const isLiveActionSitcomPivot =
    (isPivot || wantsExplicitLiveAction) &&
    (isSitcom || rawDetectedGenres.includes("comedy")) &&
    !wantsExplicitAnime;

  const isCuteAnimeRomCom =
    !isLiveActionSitcomPivot &&
    (selectedType === "anime" || wantsExplicitAnime) &&
    (isRomCom ||
      detectedKeywords.some((k) => k.name === "cute romcom anime") ||
      (/\b(cute|wholesome|sweet|adorable|fluffy|chill|rom-com|romcom|romantic comedy)\b/i.test(
        genreScanAffirmativeText,
      ) &&
        (/\b(romance|romantic|love|rom-com|romcom)\b/i.test(
          genreScanAffirmativeText,
        ) ||
          /\b(funny|comedy|humor)\b/i.test(genreScanAffirmativeText))));

  const isDarkAnime =
    !isLiveActionSitcomPivot &&
    !isStandaloneAmbiguousTitlePrompt &&
    !excludeViolence &&
    (selectedType === "anime" || wantsExplicitAnime) &&
    /\b(dark|bleak|grim|disturbing|psychological|gore|brutal|dark fantasy|tragedy)\b/i.test(
      genreScanAffirmativeText,
    );

  const isHistoricalWar =
    !isSwordWarfare &&
    (detectedKeywords.some((k) => k.name === "historical war") ||
      /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war|ancient war|medieval war|world war|ancient warfare|medieval battle)\b/i.test(
        genreScanAffirmativeText,
      ) ||
      (/\b(battle|battles|war|military|army|soldiers?)\b/i.test(
        genreScanAffirmativeText,
      ) &&
        /\b(historical|epic|history|ancient|medieval|period)\b/i.test(
          genreScanAffirmativeText,
        )));

  const isTrueCrimeDoc =
    detectedKeywords.some((k) => k.name === "true crime") ||
    /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|crime documentary|unsolved mysteries|real crime|real crime cases|crime cases)\b/i.test(
      genreScanAffirmativeText,
    ) ||
    (/\b(documentary|docuseries|docu-series)\b/i.test(
      genreScanAffirmativeText,
    ) &&
      /\b(crime|murder|killer|mystery|mysteries|real crime|cases?|investigation)\b/i.test(
        genreScanAffirmativeText,
      ));

  const hasTwistKeywords =
    !isTrueCrimeDoc &&
    (detectedKeywords.some((k) => k.name === "plot twist") ||
      /\b(plot twists?|twists?|can'?t predict|unpredictable|mind[- ]blowing|mind[- ]bending|twist ending)\b/i.test(
        genreScanAffirmativeText,
      ));

  const isUnderdog =
    detectedKeywords.some((k) => k.name === "underdog") ||
    /\b(starting from zero|start from zero|starting from nothing|from zero|rags to riches|underdog(?: story)?|success story|winning against all odds|against all odds|zero to hero|rise to the top|overcoming odds)\b/i.test(
      genreScanAffirmativeText,
    );

  const isFamilyAnimation =
    !isCrimeFamily &&
    !isCuteAnimeRomCom &&
    !isHauntedHorror &&
    !isPureComedy &&
    !isDarkComedy &&
    !isSitcom &&
    (detectedKeywords.some((k) => k.name === "family animation") ||
      (rawDetectedGenres.includes("animation") &&
        rawDetectedGenres.includes("family")) ||
      (/\b(animated|animation|cartoon)\b/i.test(genreScanAffirmativeText) &&
        /\b(family|kids|children|wholesome|cozy|for the whole family|family-friendly|family friendly|kid-friendly|kid friendly)\b/i.test(
          genreScanAffirmativeText,
        )));

  const isCyberpunk =
    detectedKeywords.some(
      (k) => k.name === "cyberpunk" || k.name === "dystopia",
    ) ||
    /\b(cyberpunk|cyber-punk|dystopian?|dystopia|dark futuristic|futuristic city|androids?|cyborgs?|robots?|neon lights?|ruined future|dystopian world|cyberpunk city)\b/i.test(
      genreScanAffirmativeText,
    );

  const isPhilosophicalSciFi =
    !isCyberpunk &&
    (detectedKeywords.some((k) => k.name === "philosophical sci-fi") ||
      (/\b(think about life|philosophical|existential|meaning of life|human condition|human existence|ponder|deep sci-fi|cosmic perspective)\b/i.test(
        genreScanAffirmativeText,
      ) &&
        (rawDetectedGenres.includes("scifi") ||
          /\b(space|universe|cosmos|sci-fi|stars|astronaut)\b/i.test(
            genreScanAffirmativeText,
          ))));

  const wantsComedy =
    rawDetectedGenres.includes("comedy") ||
    isPureComedy ||
    isDarkComedy ||
    isSitcom ||
    /\b(funny|laugh|comedy|hilarious|humor|chuckle)\b/i.test(
      genreScanAffirmativeText,
    );

  const isComfortComedy =
    !isDarkComedy &&
    ((isTiredMood && wantsComedy) ||
      isPureComedy ||
      isSitcom ||
      /\b(something funny|just.*funny|comfort comedy|chill comedy|pure comedy)\b/i.test(
        genreScanAffirmativeText,
      ));

  const isHeistRobbery =
    detectedKeywords.some((k) => k.name === "heist") ||
    /\b(plan (?:a )?robbery|big robbery|bank robbery|robbery|heist|bank heist|big heist|steal money|caper|vault|safecracker|steal a fortune|heist movie)\b/i.test(
      genreScanAffirmativeText,
    );

  const isCrimeHeist =
    !isTrueCrimeDoc &&
    (isCrimeFamily ||
      isHeistRobbery ||
      rawDetectedGenres.includes("crime") ||
      detectedKeywords.some(
        (k) => k.name === "organized crime" || k.name === "crime family",
      ) ||
      /\b(organized crime|mafia|gangster|mobster|mobsters|crime syndicate|underworld|cartel)\b/i.test(
        genreScanAffirmativeText,
      ));

  // 2. Multi-anchor and standalone reference title extraction (up to 3 titles)
  const refPatterns = [
    /\b(?:after|watch after|watched|finished|liked|loved|enjoyed|similar to|in the style of|vibes? of|such as|something like|anything like)\s+(?!\d{4}\b)([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead|and\s+(?:want|without|no|exclude|i\s+want))\b|$)/i,
    /\b(?:based on|inspired by)\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead)\b|$)/i,
    /(?<!feel\s|feels\s|look\s|looks\s|sound\s|sounds\s)\blike\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead|to\s+watch|for\s+a)\b|$)/i,
    /\b(?:shows?|series|movies?|films?|anime)\s+(?:like|similar\s+to|such\s+as)\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead)\b|$)/i,
  ];

  let extractedReferenceTitles = [];

  const addCandidateAnchor = (rawCandidateStr) => {
    if (!rawCandidateStr || extractedReferenceTitles.length >= 3) return;
    const cleaned = rawCandidateStr.trim().replace(/^[,.\s?]+|[,.\s?]+$/g, "");
    if (!cleaned || cleaned.length < 2) return;

    const lowerClean = cleaned.toLowerCase().replace(/^(a|an|the)\s+/, "");
    if (/^\d{2,4}s?$/.test(lowerClean)) return;
    if (
      GENRE_DESCRIPTOR_STOPWORDS.has(lowerClean) ||
      GENRE_DESCRIPTOR_STOPWORDS.has(cleaned.toLowerCase()) ||
      GREETING_AND_CHITCHAT_STOPWORDS.has(lowerClean) ||
      GREETING_AND_CHITCHAT_STOPWORDS.has(cleaned.toLowerCase()) ||
      AMBIGUOUS_PERSON_MAP[lowerClean]
    ) {
      return;
    }

    const candidateWords = lowerClean.split(/\s+/).filter(Boolean);
    if (
      candidateWords.length === 1 &&
      AMBIGUOUS_SINGLE_WORD_TITLES.has(candidateWords[0]) &&
      !isValidAmbiguousSingleWordUsage(candidateWords[0], normalizedRawText)
    ) {
      return;
    }
    if (
      candidateWords.length >= 2 &&
      AMBIGUOUS_SINGLE_WORD_TITLES.has(candidateWords[0]) &&
      candidateWords.slice(1).every((w) => PRE_MODIFIER_GENRE_MOOD_WORDS.has(w))
    ) {
      return;
    }

    if (
      /\b(comedy movies?|funny movies?|pure comedy|dark comedy|black comedy|sitcoms?|sitcom series|sci-fi series|dark sci-fi|dark psychological|psychological anime|dark anime|silent movies?|silent films?|black and white|western movies?|family house)\b/i.test(
        cleaned,
      )
    ) {
      return;
    }
    if (
      extractedDirector &&
      (getSimilarityScore(cleaned, extractedDirector) >= 0.72 ||
        resolveFuzzyDirector(cleaned) === extractedDirector)
    ) {
      return;
    }
    if (
      actors.some(
        (act) =>
          getSimilarityScore(cleaned, act) >= 0.72 ||
          resolveFuzzyActor(cleaned) === act,
      )
    ) {
      return;
    }

    const fuzzyAnchor = resolveFuzzyAnchorTitle(cleaned, normalizedRawText);
    const finalTitle = fuzzyAnchor ? fuzzyAnchor.canonical : cleaned;

    const finalCleanLower = finalTitle
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");
    if (
      AMBIGUOUS_SINGLE_WORD_TITLES.has(finalCleanLower) &&
      !isValidAmbiguousSingleWordUsage(finalCleanLower, normalizedRawText)
    ) {
      return;
    }

    if (
      !extractedReferenceTitles.some(
        (t) => t.toLowerCase() === finalTitle.toLowerCase(),
      )
    ) {
      extractedReferenceTitles.push(finalTitle);
    }
  };

  for (const pattern of refPatterns) {
    const pMatch = rawTextWithoutRelaxationClauses.match(pattern);
    if (pMatch) {
      const rawBlock = pMatch[1].trim();
      const splitParts = rawBlock
        .split(/\s+(?:or|and|&)\s+|\s*,\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const part of splitParts) {
        addCandidateAnchor(part);
      }
      if (extractedReferenceTitles.length > 0) break;
    }
  }

  for (const anchor of KNOWN_ICONIC_ANCHORS) {
    if (extractedReferenceTitles.length >= 3) break;
    const canonicalTrimmed = anchor.canonical.trim();
    const canonicalLower = canonicalTrimmed
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_SINGLE_WORD_TITLES.has(canonicalLower) &&
      !isValidAmbiguousSingleWordUsage(canonicalLower, normalizedRawText)
    ) {
      continue;
    }

    const canonicalRegex = new RegExp(
      `\\b${canonicalTrimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (canonicalRegex.test(rawTextWithoutRelaxationClauses)) {
      if (
        !extractedReferenceTitles.some(
          (t) => t.toLowerCase() === canonicalTrimmed.toLowerCase(),
        )
      ) {
        extractedReferenceTitles.push(canonicalTrimmed);
      }
    }
  }

  // 2. Standalone Title / Single Anchor Detection
  const cleanWordList = textWithoutRelaxationClauses
    .split(/\s+/)
    .filter(Boolean);
  const hasGenericPromptWords =
    /\b(recommend|suggest|show|give|want|looking|find|movie|movies|film|films|series|show|shows|anime|another|option|options|similar|more|live|action|sci-fi|scifi|dark|cute|wholesome|psychological|musical|western|silent|monochrome|drop|remove|relax|ignore|forget|clear|constraint|constraints|filter|filters|egyptian|kuwaiti|saudi|gulf|khaleeji|emirati|lebanese|syrian|arabic|arab|turkish|indian|bollywood|icelandic|swedish|danish|norwegian|finnish|polish|iranian|persian|korean|japanese|spanish|mexican|french|british|american|hollywood|theaters|theatres|cinemas|playing|director|directed|starring|actor|actress|rating|rated)\b/i;

  const rawCandidateStandalone = rawTextWithoutRelaxationClauses
    .replace(/[?.,!]/g, "")
    .replace(/^(?:movie|film|series|show|anime|watch)\s+/i, "")
    .trim();

  const cleanCandidateStandalone = rawCandidateStandalone
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, "")
    .trim();

  const isGreetingOrChitchat =
    GREETING_AND_CHITCHAT_STOPWORDS.has(cleanCandidateStandalone) ||
    GREETING_AND_CHITCHAT_STOPWORDS.has(
      lowerText.replace(/[?.,!]/g, "").trim(),
    );

  const isPureGenreOrStopword =
    GENRE_DESCRIPTOR_STOPWORDS.has(cleanCandidateStandalone) ||
    GENRE_DESCRIPTOR_STOPWORDS.has(rawCandidateStandalone.toLowerCase()) ||
    Object.keys(genreMap).includes(cleanCandidateStandalone) ||
    Boolean(AMBIGUOUS_PERSON_MAP[cleanCandidateStandalone]);

  const standaloneFuzzyAnchor =
    !isGreetingOrChitchat &&
    !isPureGenreOrStopword &&
    !extractedDirector &&
    actors.length === 0 &&
    !isNowPlaying &&
    !replacePrevious &&
    strictFormats.length === 0 &&
    origins.length === 0 &&
    cleanWordList.length <= 6
      ? resolveFuzzyAnchorTitle(rawCandidateStandalone, normalizedRawText)
      : null;

  const hasKnownFilters =
    rawDetectedGenres.length > 0 ||
    detectedKeywords.length > 0 ||
    excludedGenres.length > 0 ||
    minYear !== null ||
    maxYear !== null ||
    minRating !== null ||
    detectedLanguage !== null ||
    origins.length > 0 ||
    strictFormats.length > 0 ||
    replacePrevious ||
    excludeViolence ||
    extractedDirector !== null ||
    actors.length > 0 ||
    isNowPlaying ||
    hasTwistKeywords ||
    hasExplicitSciFi ||
    isDarkComedy;

  if (
    extractedReferenceTitles.length === 0 &&
    !extractedDirector &&
    actors.length === 0 &&
    !isNowPlaying &&
    !isGreetingOrChitchat &&
    !isPureGenreOrStopword &&
    cleanWordList.length <= 6
  ) {
    const isBlockedAmbiguous =
      AMBIGUOUS_SINGLE_WORD_TITLES.has(cleanCandidateStandalone) &&
      !isValidAmbiguousSingleWordUsage(
        cleanCandidateStandalone,
        normalizedRawText,
      );

    if (!isBlockedAmbiguous) {
      if (standaloneFuzzyAnchor) {
        extractedReferenceTitles.push(standaloneFuzzyAnchor.canonical);
      } else if (!hasKnownFilters && cleanWordList.length <= 5) {
        if (
          rawCandidateStandalone.length >= 2 &&
          (!hasGenericPromptWords.test(rawCandidateStandalone) ||
            isStandaloneAmbiguousTitlePrompt)
        ) {
          const typoCorrectedCandidate = correctTypos(rawCandidateStandalone);
          const secondPassFuzzy = resolveFuzzyAnchorTitle(
            typoCorrectedCandidate,
            normalizedRawText,
          );
          extractedReferenceTitles.push(
            secondPassFuzzy
              ? secondPassFuzzy.canonical
              : typoCorrectedCandidate,
          );
        }
      }
    }
  }

  // 1. Run early contradiction detection BEFORE stripping "family" in isHauntedHorror
  const contradictionMsg = detectContradictions({
    rawDetectedGenres,
    excludedGenres: excludedGenres.filter(
      (g) => !(excludeViolence && g === "horror"),
    ),
    isRomCom,
    isCuteAnimeRomCom,
    isSitcom,
    isPureComedy,
    isComfortComedy,
    isMindBlowingAction,
    isCyberpunk,
    isPhilosophicalSciFi,
    isTrueCrimeDoc,
    isFamilyAnimation,
    isHauntedHorror,
    wantsExplicitLiveAction,
    wantsExplicitAnime: /\b(anime|manga)\b/i.test(affirmativeText),
    isAdaptationMentioned,
    wantsClassic,
    minYear,
    maxYear,
    extractedReferenceTitles,
    extractedDirector,
    actors,
    fullContextText: rawTextWithoutRelaxationClauses,
  });

  if (contradictionMsg) {
    return {
      isValid: true,
      hasContradiction: true,
      contradictionMessage: contradictionMsg,
      message: contradictionMsg,
      targetType: selectedType,
      detectedGenres: [],
      detectedKeywords: [],
      actors: [],
      extractedActors: [],
      extractedActor: null,
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints,
      replacePrevious,
      excludeViolence,
      originalText: text,
    };
  }

  // Complete genre filtering and priority rules after verifying no contradictions exist
  let detectedGenres = rawDetectedGenres.filter(
    (g) => !excludedGenres.includes(g),
  );

  const excludedGenreIds = [];
  excludedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.movie[g]) excludedGenreIds.push(TMDB_GENRE_IDS.movie[g]);
    if (TMDB_GENRE_IDS.tv[g]) excludedGenreIds.push(TMDB_GENRE_IDS.tv[g]);
  });

  if (isHauntedHorror || isCrimeFamily || isPureComedy || isSitcom) {
    detectedGenres = detectedGenres.filter(
      (g) => g !== "family" && g !== "sports",
    );
  }

  if (isPureComedy || isSitcom) {
    detectedGenres = ["comedy"];
  }

  if (isDarkComedy) {
    if (!detectedGenres.includes("comedy")) detectedGenres.unshift("comedy");
  }

  if (isHauntedHorror && !detectedGenres.includes("horror")) {
    detectedGenres.push("horror");
  }

  if (isCrimeFamily && !detectedGenres.includes("crime")) {
    detectedGenres.push("crime");
  }

  if (withoutDrama && !isPureComedy && !isSitcom && !isDarkComedy) {
    detectedGenres = detectedGenres.filter((g) => g !== "drama");
  }

  if (isMindBlowingAction && !isPureComedy && !isSitcom) {
    if (
      !detectedGenres.includes("action") &&
      !excludedGenres.includes("action")
    )
      detectedGenres.push("action");
    if (!detectedGenres.includes("scifi") && !excludedGenres.includes("scifi"))
      detectedGenres.push("scifi");
  }

  if (isRomCom) {
    if (
      !detectedGenres.includes("comedy") &&
      !excludedGenres.includes("comedy")
    )
      detectedGenres.push("comedy");
    if (
      !detectedGenres.includes("romance") &&
      !excludedGenres.includes("romance")
    )
      detectedGenres.push("romance");
  }

  if (isDarkAnime) {
    detectedGenres = detectedGenres.filter(
      (g) => g !== "comedy" && g !== "family",
    );
  }

  if (isCuteAnimeRomCom) {
    if (!detectedGenres.includes("romance")) detectedGenres.push("romance");
    if (!detectedGenres.includes("comedy")) detectedGenres.push("comedy");
    detectedGenres = detectedGenres.filter(
      (g) => g !== "sports" && g !== "action" && g !== "family",
    );
  }

  if (isSwordWarfare || isHistoricalWar) {
    if (!detectedGenres.includes("war")) detectedGenres.push("war");
    if (!detectedGenres.includes("history")) detectedGenres.push("history");
    detectedGenres = detectedGenres.filter((g) => g !== "action");
  }

  if (isTrueCrimeDoc) {
    if (!detectedGenres.includes("documentary"))
      detectedGenres.push("documentary");
    detectedGenres = detectedGenres.filter(
      (g) => g !== "crime" && g !== "mystery",
    );
  }

  if (hasTwistKeywords && !detectedGenres.includes("mystery")) {
    detectedGenres.push("mystery");
  }

  if (isUnderdog && !detectedGenres.includes("drama")) {
    detectedGenres.push("drama");
  }

  if (isFamilyAnimation) {
    if (!detectedGenres.includes("animation")) detectedGenres.push("animation");
    if (!detectedGenres.includes("family")) detectedGenres.push("family");
  }

  if (isCyberpunk && !detectedGenres.includes("scifi")) {
    detectedGenres.push("scifi");
  }

  if (isPhilosophicalSciFi) {
    if (!detectedGenres.includes("scifi")) detectedGenres.push("scifi");
    if (!detectedGenres.includes("drama") && !excludedGenres.includes("drama"))
      detectedGenres.push("drama");
  }

  if (hasExplicitSciFi && !detectedGenres.includes("scifi")) {
    detectedGenres.unshift("scifi");
  }

  if (isComfortComedy && !detectedGenres.includes("comedy")) {
    detectedGenres.push("comedy");
  }

  if ((isHeistRobbery || isCrimeFamily) && !detectedGenres.includes("crime")) {
    detectedGenres.push("crime");
  }

  // Keep "family" pure when user asks for family movies without horror
  if (excludedGenres.includes("horror") && detectedGenres.includes("family")) {
    detectedGenres = ["family"];
  }

  if (extractedDirector || actors.length > 0 || isNowPlaying) {
    rawDetectedGenres.forEach((g) => {
      if (!excludedGenres.includes(g) && !detectedGenres.includes(g)) {
        detectedGenres.push(g);
      }
    });
  }

  let finalSwordWarfare = isSwordWarfare;
  let finalDarkAnime = isDarkAnime;
  let finalCuteAnimeRomCom = isCuteAnimeRomCom;
  let finalPhilosophicalSciFi = isPhilosophicalSciFi;
  let finalMindBlowingAction = isMindBlowingAction;
  let finalCyberpunk = isCyberpunk;
  let finalCrimeFamily = isCrimeFamily;
  let finalPsychologicalThriller = isPsychologicalThriller;
  let finalHauntedHorror = isHauntedHorror;
  let finalSitcom = isSitcom;
  let finalPureComedy = isPureComedy;
  let finalHasTwistKeywords = hasTwistKeywords;

  extractedReferenceTitles = extractedReferenceTitles.map((refTitle) => {
    const matchedMeta = resolveFuzzyAnchorTitle(refTitle, normalizedRawText);
    if (matchedMeta) {
      if (
        matchedMeta.genre &&
        !detectedGenres.includes(matchedMeta.genre) &&
        !excludedGenres.includes(matchedMeta.genre)
      ) {
        detectedGenres.push(matchedMeta.genre);
      }
      if (matchedMeta.flag === "isSwordWarfare") finalSwordWarfare = true;
      if (matchedMeta.flag === "isDarkAnime") finalDarkAnime = true;
      if (matchedMeta.flag === "isCuteAnimeRomCom") finalCuteAnimeRomCom = true;
      if (matchedMeta.flag === "isPhilosophicalSciFi")
        finalPhilosophicalSciFi = true;
      if (matchedMeta.flag === "isMindBlowingAction")
        finalMindBlowingAction = true;
      if (matchedMeta.flag === "isCyberpunk") finalCyberpunk = true;
      if (matchedMeta.flag === "isCrimeFamily") finalCrimeFamily = true;
      if (matchedMeta.flag === "isPsychologicalThriller")
        finalPsychologicalThriller = true;
      if (matchedMeta.flag === "isHauntedHorror") finalHauntedHorror = true;
      if (matchedMeta.flag === "isSitcom") finalSitcom = true;
      if (matchedMeta.flag === "isPureComedy") finalPureComedy = true;
      if (matchedMeta.flag === "hasTwistKeywords") finalHasTwistKeywords = true;
      return matchedMeta.canonical;
    }
    return refTitle;
  });

  const anchorTitles = [...extractedReferenceTitles];
  const extractedReferenceTitle = extractedReferenceTitles[0] || null;

  const hasExplicitMovie = /\b(movie|movies|film|films)\b/i.test(
    affirmativeText,
  );
  const hasExplicitSeries =
    /\b(series|show|shows|tv|sitcom|docuseries|docu-series|k-drama|kdrama)\b/i.test(
      affirmativeText,
    );

  let targetType = selectedType;
  let hasExplicitTargetType = false;

  if (isNowPlaying) {
    targetType = "movie";
    hasExplicitTargetType = true;
  } else if (wantsExplicitLiveAction) {
    targetType = hasExplicitMovie ? "movie" : "tv";
    hasExplicitTargetType = true;
  } else if (finalSitcom && !wantsExplicitAnime) {
    targetType = "tv";
    hasExplicitTargetType = true;
  } else if (wantsExplicitAnime) {
    targetType = "anime";
    hasExplicitTargetType = true;
  } else if (hasExplicitMovie && !hasExplicitSeries) {
    targetType = "movie";
    hasExplicitTargetType = true;
  } else if (hasExplicitSeries && !hasExplicitMovie) {
    targetType = "tv";
    hasExplicitTargetType = true;
  }

  if (isPivot && detectedGenres.length > 0) {
    detectedGenres = [...detectedGenres];
  }

  const hasActivePre1970Era =
    !relaxedConstraints.dropEra &&
    ((minYear !== null && minYear < 1970) ||
      (maxYear !== null && maxYear < 1970));

  const isHyperSpecific = Boolean(
    (!relaxedConstraints.dropFormats && strictFormats.length > 0) ||
    (!relaxedConstraints.dropOrigins && origins.length > 1) ||
    hasActivePre1970Era,
  );

  const hasSpecificIntent =
    extractedReferenceTitles.length > 0 ||
    Boolean(extractedDirector) ||
    actors.length > 0 ||
    isNowPlaying ||
    hasExplicitSciFi ||
    wantsDark ||
    isDarkComedy ||
    detectedGenres.length > 0 ||
    detectedKeywords.length > 0 ||
    excludedGenres.length > 0 ||
    excludedKeywords.length > 0 ||
    minYear !== null ||
    maxYear !== null ||
    minRating !== null ||
    Boolean(detectedLanguage) ||
    Boolean(detectedCountry) ||
    origins.length > 0 ||
    strictFormats.length > 0 ||
    isHyperSpecific ||
    replacePrevious ||
    excludeViolence ||
    preservesAnaphoricEra ||
    preservesAnaphoricPerson ||
    wantsExplicitLiveAction ||
    isKorean ||
    finalHasTwistKeywords ||
    isUnderdog ||
    finalSwordWarfare ||
    finalCrimeFamily ||
    finalCuteAnimeRomCom ||
    finalDarkAnime ||
    finalSitcom ||
    finalHauntedHorror ||
    finalMindBlowingAction ||
    hasQualityFloor ||
    finalPureComedy ||
    isComfortComedy ||
    isHistoricalWar ||
    isTrueCrimeDoc ||
    isFamilyAnimation ||
    finalCyberpunk ||
    finalPhilosophicalSciFi ||
    isHeistRobbery;

  const isAmbiguous =
    extractedDirector || actors.length > 0 || isNowPlaying || replacePrevious
      ? false
      : isGreetingOrChitchat ||
        (extractedReferenceTitles.length === 0 &&
          !hasSpecificIntent &&
          cleanWordList.length > 3);

  return {
    isValid: true,
    isSmallTalk: false,
    needsClarification: false,
    hasContradiction: false,
    contradictionMessage: null,
    isAmbiguous,
    isPivot,
    replacePrevious,
    relaxedConstraints,
    preservesAnaphoricEra,
    preservesAnaphoricPerson,
    excludeViolence,
    isLiveAction: wantsExplicitLiveAction,
    wantsExplicitAnime,
    isNowPlaying: Boolean(isNowPlaying),
    extractedDirector,
    actors,
    extractedActors: actors,
    extractedActor,
    targetType,
    hasExplicitTargetType,
    detectedGenres,
    detectedKeywords,
    detectedLanguage,
    detectedCountry,
    detectedRegionLabel,
    origins,
    strictFormats,
    isHyperSpecific,
    excludedGenres,
    excludedGenreIds: Array.from(new Set(excludedGenreIds)),
    excludedKeywords,
    excludedTermsFromPrompt,
    minYear,
    maxYear,
    minRating,
    isPure,
    withoutDrama,
    wantsClassic,
    wantsDark,
    isDarkComedy,
    isHorrorNight,
    isCrimeHeist,
    isCrimeFamily: finalCrimeFamily,
    isHeistRobbery,
    isPsychologicalThriller: finalPsychologicalThriller,
    isRomCom,
    isCuteAnimeRomCom: finalCuteAnimeRomCom,
    isDarkAnime: finalDarkAnime,
    isSitcom: finalSitcom,
    isSwordWarfare: finalSwordWarfare,
    isHistoricalWar,
    isHauntedHorror: finalHauntedHorror,
    isMindBlowingAction: finalMindBlowingAction,
    hasQualityFloor,
    isPureComedy: finalPureComedy,
    isTrueCrimeDoc,
    isKorean,
    hasTwistKeywords: finalHasTwistKeywords,
    isUnderdog,
    isFamilyAnimation,
    isCyberpunk: finalCyberpunk,
    isTiredMood,
    isComfortComedy,
    isPhilosophicalSciFi: finalPhilosophicalSciFi,
    anchorTitles,
    extractedReferenceTitles,
    extractedReferenceTitle,
    originalText: text,
  };
};
