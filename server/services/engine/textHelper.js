// services/engine/textHelper.js
import {
  KNOWN_DIRECTORS,
  KNOWN_ACTORS,
  AMBIGUOUS_PERSON_MAP,
  NON_DIRECTOR_WORDS,
  NON_ACTOR_WORDS,
  REGIONAL_NATIONALITY_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  PRE_MODIFIER_GENRE_MOOD_WORDS,
  ENGINE_LEXICON,
  COMMON_TYPOS_MAP,
  MULTI_WORD_ANCHOR_TYPOS,
  GENRE_DESCRIPTOR_STOPWORDS,
  themeKeywords,
} from "./constants.js";

// Build a quick lookup set of all theme/keyword words so they are never mistaken for actor names
const ALL_THEME_WORDS_SET = new Set();
Object.values(themeKeywords).forEach((entry) => {
  (entry.terms || []).forEach((term) => {
    term
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => ALL_THEME_WORDS_SET.add(w));
  });
});

// Calculate internal string similarity score via Levenshtein Distance
export const getSimilarityScore = (str1, str2) => {
  const s1 = (str1 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = (str2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const track = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(null));

  for (let i = 0; i <= len1; i += 1) track[0][i] = i;
  for (let j = 0; j <= len2; j += 1) track[j][0] = j;

  for (let j = 1; j <= len2; j += 1) {
    for (let i = 1; i <= len1; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator,
      );
    }
  }

  const distance = track[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
};

// Clean and normalize user input, collapsing repeated typing characters while preserving hyphens (e.g., sci-fi) and ampersands (e.g., b&w)
export const normalizeInput = (rawText) => {
  if (!rawText) return "";
  return rawText
    .replace(/[^\w\s':.&!\-+]/g, " ")
    .replace(/([a-zA-Z])\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
};

export const getFranchiseKey = (title) => {
  return (title || "")
    .toLowerCase()
    .replace(/[:\-–—].*$/, "")
    .replace(
      /\b(part|chapter|volume|vol\.?|episode)?\s*(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)\b.*$/i,
      "",
    )
    .replace(
      /\b(reloaded|revolutions|resurrections|returns|forever|rises|awakens|back in action)\b.*$/i,
      "",
    )
    .trim();
};

// Clean anchor query from repeated characters and non-alphanumeric symbols
export const cleanAnchorQuery = (str) => {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/([a-z])\1{2,}/g, "$1")
    .replace(/[^a-z0-9\s]/g, "");
};

export const isValidAmbiguousSingleWordUsage = (word, fullContextStr = "") => {
  const w = (word || "")
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");
  if (!AMBIGUOUS_SINGLE_WORD_TITLES.has(w)) return true;
  if (!fullContextStr || typeof fullContextStr !== "string") return false;

  const normalizedFull = fullContextStr
    .toLowerCase()
    .replace(/[?.,!]/g, "")
    .trim()
    .replace(/^(a|an|the)\s+/, "");

  // Allow standalone single-word title queries (e.g., typing "Dark" or "Her" alone)
  if (normalizedFull === w) {
    return true;
  }

  const escapedW = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const triggerRegex = new RegExp(
    `\\b(?:like|similar\\s+to|such\\s+as|vibes?\\s+of|shows?|series|movies?|films?|after|watch\\s+after|watched|finished|liked|loved|enjoyed)\\s+(?:the\\s+|a\\s+|an\\s+)?${escapedW}\\b(?:\\s+([a-zA-Z\\-]+))?`,
    "i",
  );

  const match = fullContextStr.match(triggerRegex);
  if (!match) return false;

  const nextWord = (match[1] || "").toLowerCase().trim();
  if (nextWord && PRE_MODIFIER_GENRE_MOOD_WORDS.has(nextWord)) {
    return false;
  }

  return true;
};

export const isValidControllerAmbiguousSingleWord =
  isValidAmbiguousSingleWordUsage;

export const resolveFuzzyAnchorTitle = (candidateStr, fullContextStr = "") => {
  if (!candidateStr || typeof candidateStr !== "string") return null;
  const cleanedCandidate = candidateStr
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");
  if (cleanedCandidate.length < 2) return null;

  if (
    AMBIGUOUS_SINGLE_WORD_TITLES.has(cleanedCandidate) &&
    !isValidAmbiguousSingleWordUsage(
      cleanedCandidate,
      fullContextStr || candidateStr,
    )
  ) {
    return null;
  }

  let bestMatch = null;
  let highestSim = 0;

  for (const anchor of KNOWN_ICONIC_ANCHORS) {
    const canonicalTrimmed = anchor.canonical.trim();
    const canonicalClean = canonicalTrimmed
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_SINGLE_WORD_TITLES.has(canonicalClean) &&
      !isValidAmbiguousSingleWordUsage(
        canonicalClean,
        fullContextStr || candidateStr,
      )
    ) {
      continue;
    }

    const simFull = getSimilarityScore(
      candidateStr.toLowerCase(),
      canonicalTrimmed.toLowerCase(),
    );
    const simStripped = getSimilarityScore(cleanedCandidate, canonicalClean);
    const sim = Math.max(simFull, simStripped);

    if (sim >= 0.65 && sim > highestSim) {
      highestSim = sim;
      bestMatch = { ...anchor, canonical: canonicalTrimmed };
    }
  }
  return bestMatch;
};

export const resolveFuzzyDirector = (candidateStr) => {
  if (!candidateStr || typeof candidateStr !== "string") return null;

  const cleaned = candidateStr
    .toLowerCase()
    .trim()
    .replace(
      /\b(movies?|films?|series|shows?|cinema|works?|directed|director|by|of|who|best|top|greatest|favorite|favourite|recommend|suggest|watch|only|just|after|before|between|since|until|from|rated|rating|above|over)\b/gi,
      "",
    )
    .replace(/\b(19\d{2}|20\d{2})s?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3 || NON_DIRECTOR_WORDS.has(cleaned)) return null;
  if (AMBIGUOUS_PERSON_MAP[cleaned]) return null;

  const cleanedTokens = cleaned
    .split(/\s+/)
    .filter(
      (t) => Boolean(t) && !NON_DIRECTOR_WORDS.has(t) && !/^\d+$/.test(t),
    );
  if (cleanedTokens.length === 0) return null;

  const filteredCleaned = cleanedTokens.join(" ");
  if (
    filteredCleaned.length < 3 ||
    NON_DIRECTOR_WORDS.has(filteredCleaned) ||
    AMBIGUOUS_PERSON_MAP[filteredCleaned]
  ) {
    return null;
  }

  let bestDirector = null;
  let bestScore = 0;

  for (const dir of KNOWN_DIRECTORS) {
    const dirLower = dir.toLowerCase();
    const parts = dirLower.split(/\s+/);
    const lastName = parts[parts.length - 1];

    const simFull = getSimilarityScore(filteredCleaned, dirLower);
    let simLast = 0;
    if (cleanedTokens.length === 1 && lastName.length >= 5) {
      const singleSim = getSimilarityScore(cleanedTokens[0], lastName);
      if (singleSim >= 0.85) {
        simLast = singleSim;
      }
    }

    let tokenScore = 0;
    if (cleanedTokens.length > 1) {
      for (const t of cleanedTokens) {
        if (
          t.length >= 5 &&
          lastName.length >= 5 &&
          !NON_DIRECTOR_WORDS.has(t)
        ) {
          const tSim = getSimilarityScore(t, lastName);
          if (tSim >= 0.85) {
            tokenScore = Math.max(tokenScore, tSim);
          }
        }
      }
      for (let i = 0; i < cleanedTokens.length - 1; i += 1) {
        const pair = `${cleanedTokens[i]} ${cleanedTokens[i + 1]}`;
        tokenScore = Math.max(tokenScore, getSimilarityScore(pair, dirLower));
      }
    }

    const score = Math.max(simFull, simLast, tokenScore);

    if (score >= 0.72 && score > bestScore) {
      bestScore = score;
      bestDirector = dir;
    }
  }
  return bestDirector;
};

// Fuzzy matcher for actor names (>= 0.74, with single-word distinct surname support like "statham" or "dicaprio")
export const resolveFuzzyActor = (candidateStr) => {
  if (!candidateStr || typeof candidateStr !== "string") return null;

  const cleaned = candidateStr
    .toLowerCase()
    .trim()
    .replace(
      /\b(movies?|films?|series|shows?|cinema|works?|starring|starred|actor|actors|actress|acting|cast|featuring|featured|played|with|by|of|for|in|who|best|top|greatest|favorite|favourite|recommend|suggest|watch|only|just|after|before|between|since|until|from|rated|rating|above|over)\b/gi,
      "",
    )
    .replace(/[?.,!'"():;]/g, " ")
    .replace(/\b(19\d{2}|20\d{2})s?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 3 || NON_ACTOR_WORDS.has(cleaned)) return null;
  if (AMBIGUOUS_PERSON_MAP[cleaned]) return null;

  // Prevent colliding with a known director name
  if (resolveFuzzyDirector(cleaned)) return null;

  const cleanedTokens = cleaned
    .split(/\s+/)
    .filter((t) => Boolean(t) && !NON_ACTOR_WORDS.has(t) && !/^\d+$/.test(t));
  if (cleanedTokens.length === 0) return null;

  const filteredCleaned = cleanedTokens.join(" ");
  if (
    filteredCleaned.length < 3 ||
    NON_ACTOR_WORDS.has(filteredCleaned) ||
    AMBIGUOUS_PERSON_MAP[filteredCleaned]
  ) {
    return null;
  }

  let bestActor = null;
  let bestScore = 0;

  for (const actor of KNOWN_ACTORS) {
    const actorLower = actor.toLowerCase();
    const parts = actorLower.split(/\s+/);
    const lastName = parts[parts.length - 1].replace(/[^a-z0-9]/g, "");

    const simFull = getSimilarityScore(filteredCleaned, actorLower);
    let simLast = 0;
    if (
      cleanedTokens.length === 1 &&
      lastName.length >= 5 &&
      !NON_ACTOR_WORDS.has(lastName) &&
      !AMBIGUOUS_PERSON_MAP[lastName]
    ) {
      const singleSim = getSimilarityScore(cleanedTokens[0], lastName);
      if (singleSim >= 0.84) {
        simLast = singleSim;
      }
    }

    let tokenScore = 0;
    if (cleanedTokens.length > 1) {
      for (const t of cleanedTokens) {
        if (
          t.length >= 5 &&
          lastName.length >= 5 &&
          !NON_ACTOR_WORDS.has(t) &&
          !AMBIGUOUS_PERSON_MAP[t]
        ) {
          const tSim = getSimilarityScore(t, lastName);
          if (tSim >= 0.86) {
            tokenScore = Math.max(tokenScore, tSim);
          }
        }
      }
      for (let i = 0; i < cleanedTokens.length - 1; i += 1) {
        const pair = `${cleanedTokens[i]} ${cleanedTokens[i + 1]}`;
        tokenScore = Math.max(tokenScore, getSimilarityScore(pair, actorLower));
      }
      if (cleanedTokens.length >= 3) {
        for (let i = 0; i < cleanedTokens.length - 2; i += 1) {
          const triple = `${cleanedTokens[i]} ${cleanedTokens[i + 1]} ${cleanedTokens[i + 2]}`;
          tokenScore = Math.max(
            tokenScore,
            getSimilarityScore(triple, actorLower),
          );
        }
      }
    }

    const score = Math.max(simFull, simLast, tokenScore);

    if (score >= 0.74 && score > bestScore) {
      bestScore = score;
      bestActor = actor;
    }
  }
  return bestActor;
};

// Check whether a candidate phrase after "with" or "movies of" is a descriptive trope rather than a person's name
const isDescriptivePhraseNotPerson = (phraseStr) => {
  if (!phraseStr) return true;
  const lower = phraseStr.toLowerCase().trim();
  if (
    NON_ACTOR_WORDS.has(lower) ||
    GENRE_DESCRIPTOR_STOPWORDS.has(lower) ||
    AMBIGUOUS_PERSON_MAP[lower]
  ) {
    return true;
  }

  // Check if the phrase matches any known theme keyword phrase
  for (const data of Object.values(themeKeywords)) {
    if (data.terms.some((t) => lower.includes(t.toLowerCase()))) {
      return true;
    }
  }

  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  // If ANY word in the candidate is a non-actor word, genre stopword, lexicon command, or theme keyword word, reject it as an unknown actor
  return words.some(
    (w) =>
      NON_ACTOR_WORDS.has(w) ||
      GENRE_DESCRIPTOR_STOPWORDS.has(w) ||
      ENGINE_LEXICON.includes(w) ||
      ALL_THEME_WORDS_SET.has(w) ||
      /^(a|an|the|some|any|no|lots|full|crazy|big|small|old|new|real|true|dark|light|deep|bad|good)$/.test(
        w,
      ),
  );
};

// Extract actor names from user queries with cleanup, dynamic entity extraction, and fuzzy matching
export const extractActors = (rawText, extractedDirector = null) => {
  if (!rawText || typeof rawText !== "string") return [];

  const actorsList = [];
  const addActorCandidate = (candidate) => {
    if (!candidate || actorsList.length >= 3) return;
    const cleaned = candidate
      .replace(/[?.,!'"():;]/g, " ")
      .replace(
        /\b(movies?|films?|series|shows?|cinema|works?|starring|starred|actor|actors|actress|acting|cast|featuring|featured|played|with|by|of|for|in|who|best|top|greatest|favorite|favourite|recommend|suggest|watch)\b/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 3) return;
    if (NON_ACTOR_WORDS.has(cleaned.toLowerCase())) return;
    if (GENRE_DESCRIPTOR_STOPWORDS.has(cleaned.toLowerCase())) return;
    if (AMBIGUOUS_PERSON_MAP[cleaned.toLowerCase()]) return;

    // Avoid mixing up actors with directors or iconic anchor titles
    if (
      extractedDirector &&
      (getSimilarityScore(cleaned, extractedDirector) >= 0.72 ||
        resolveFuzzyDirector(cleaned) === extractedDirector)
    ) {
      return;
    }
    if (resolveFuzzyDirector(cleaned)) return;
    if (resolveFuzzyAnchorTitle(cleaned, rawText)) return;

    const fuzzyActor = resolveFuzzyActor(cleaned);
    if (!fuzzyActor && isDescriptivePhraseNotPerson(cleaned)) {
      return;
    }

    const finalActor = fuzzyActor || cleaned;

    if (
      extractedDirector &&
      finalActor.toLowerCase() === extractedDirector.toLowerCase()
    ) {
      return;
    }

    if (!actorsList.some((a) => a.toLowerCase() === finalActor.toLowerCase())) {
      actorsList.push(finalActor);
    }
  };

  // 1. Explicit patterns for actor extraction in English
  const explicitActorPatterns = [
    /\b(?:starring|starred\s+by|featuring|featured\s+with|acted\s+by|actor|actress|cast\s+includes|played\s+by)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\b(?:movies?|films?|series|shows?|works?)\s+(?:starring|featuring)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\b(?:movies?|films?|series|shows?|works?)\s+(?:of|for|with|by)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\bwith\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){1,2}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\b([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,2}?)\s+(?:movies?|films?|series|shows?|acting|filmography)\b/gi,
  ];

  for (let pIdx = 0; pIdx < explicitActorPatterns.length; pIdx += 1) {
    const pat = explicitActorPatterns[pIdx];
    let match;
    while ((match = pat.exec(rawText)) !== null) {
      const candidateBlock = match[1].trim();
      const splitCandidates = candidateBlock
        .split(/\s+(?:and|or|&)\s+|\s*,\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const part of splitCandidates) {
        const fuzzyMatched = resolveFuzzyActor(part);
        if (fuzzyMatched) {
          addActorCandidate(fuzzyMatched);
        } else if (pIdx <= 2) {
          // Only allow dynamic unknown actor names on strong triggers ("starring X", "actor X", "movies of X") when none of the words are descriptive/theme words
          const words = part.split(/\s+/).filter(Boolean);
          const allValidWords =
            !isDescriptivePhraseNotPerson(part) &&
            words.every(
              (w) => !REGIONAL_NATIONALITY_MAP.some((r) => r.pattern.test(w)),
            );
          if (words.length >= 2 && words.length <= 4 && allValidWords) {
            addActorCandidate(part);
          } else if (
            pIdx === 0 &&
            words.length === 1 &&
            words[0].length >= 5 &&
            allValidWords
          ) {
            addActorCandidate(part);
          }
        }
      }
    }
  }

  // 2. Direct token scan for known actors if none matched via explicit patterns
  if (actorsList.length === 0) {
    const standaloneActor = resolveFuzzyActor(rawText);
    if (standaloneActor) {
      addActorCandidate(standaloneActor);
    } else {
      const rawTokens = rawText
        .replace(/[^\w\s.\-']/g, " ")
        .split(/\s+/)
        .filter(
          (t) =>
            Boolean(t) &&
            !NON_ACTOR_WORDS.has(t.toLowerCase()) &&
            !/^\d+$/.test(t),
        );
      for (let i = 0; i < rawTokens.length; i += 1) {
        if (rawTokens[i].length >= 5) {
          const singleActor = resolveFuzzyActor(rawTokens[i]);
          if (singleActor) {
            addActorCandidate(singleActor);
            break;
          }
        }
        if (i < rawTokens.length - 1) {
          const pairActor = resolveFuzzyActor(
            `${rawTokens[i]} ${rawTokens[i + 1]}`,
          );
          if (pairActor) {
            addActorCandidate(pairActor);
            break;
          }
        }
        if (i < rawTokens.length - 2) {
          const tripleActor = resolveFuzzyActor(
            `${rawTokens[i]} ${rawTokens[i + 1]} ${rawTokens[i + 2]}`,
          );
          if (tripleActor) {
            addActorCandidate(tripleActor);
            break;
          }
        }
      }
    }
  }

  return actorsList;
};

// Pre-processing and spell normalization function (Spell Normalizer / correctTypos)
export const normalizePromptSpelling = (rawPrompt) => {
  if (!rawPrompt || typeof rawPrompt !== "string") return "";

  // Collapse repeated characters caused by fast typing (3+ consecutive identical letters)
  let cleaned = rawPrompt.replace(/([a-zA-Z])\1{2,}/g, "$1$1");

  // Correct multi-word iconic title typos first
  for (const rule of MULTI_WORD_ANCHOR_TYPOS) {
    cleaned = cleaned.replace(rule.pattern, rule.replacement);
  }

  const tokens = cleaned.split(/\s+/);
  const normalizedTokens = tokens.map((rawToken) => {
    const tokenClean = rawToken.toLowerCase().replace(/[^a-z0-9\-']/g, "");
    if (!tokenClean || tokenClean.length < 2) return rawToken;

    // Check direct dictionary for common typos
    if (COMMON_TYPOS_MAP[tokenClean]) {
      return rawToken.replace(
        new RegExp(tokenClean, "i"),
        COMMON_TYPOS_MAP[tokenClean],
      );
    }

    // Keep token as-is if it already matches the lexicon or a year/decade pattern
    if (ENGINE_LEXICON.includes(tokenClean) || /^\d{2,4}s?$/.test(tokenClean)) {
      return rawToken;
    }

    // Check similarity against single-word iconic anchors (>= 0.72, excluding ambiguous single-word descriptors)
    for (const anchor of KNOWN_ICONIC_ANCHORS) {
      const canonicalTrimmed = anchor.canonical.trim();
      if (!canonicalTrimmed.includes(" ")) {
        const canonicalLower = canonicalTrimmed.toLowerCase();
        if (AMBIGUOUS_SINGLE_WORD_TITLES.has(canonicalLower)) continue;
        if (Math.abs(canonicalLower.length - tokenClean.length) <= 2) {
          const simAnchor = getSimilarityScore(tokenClean, canonicalLower);
          if (simAnchor >= 0.72 && tokenClean.length >= 5) {
            return canonicalTrimmed;
          }
        }
      }
    }

    // Check similarity against reference lexicon (>= 0.72)
    let bestMatch = null;
    let bestScore = 0;

    for (const lexWord of ENGINE_LEXICON) {
      if (Math.abs(lexWord.length - tokenClean.length) > 2) continue;
      const sim = getSimilarityScore(tokenClean, lexWord);
      if (sim > bestScore) {
        bestScore = sim;
        bestMatch = lexWord;
      }
    }

    if (bestMatch && bestScore >= 0.72 && tokenClean.length >= 4) {
      return rawToken.replace(new RegExp(tokenClean, "i"), bestMatch);
    }

    return rawToken;
  });

  return normalizedTokens.join(" ");
};

export const correctTypos = normalizePromptSpelling;
