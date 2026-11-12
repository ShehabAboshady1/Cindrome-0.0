// controllers/dromeController.js
import db from "../config/db.js";
import axios from "axios";
import {
  CindromeEngine,
  TMDB_GENRE_IDS,
  TMDB_THEME_IDS,
  GENRE_DESCRIPTOR_STOPWORDS,
  KNOWN_ICONIC_ANCHORS,
  KNOWN_DIRECTORS,
  NON_DIRECTOR_WORDS,
  REGIONAL_NATIONALITY_MAP,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  themeKeywords,
  genreMap,
  getSimilarityScore,
  normalizePromptSpelling,
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

// 🌟 1. تنظيف الـ Query من الأخطاء الإملائية الناتجة عن الحروف المكررة أو الناقصة
const cleanAnchorQuery = (str) => {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/([a-z])\1{2,}/g, "$1")
    .replace(/[^a-z0-9\s]/g, "");
};

const CONTROLLER_PRE_MODIFIER_WORDS = new Set([
  "action",
  "adventure",
  "animation",
  "animated",
  "comedy",
  "comedies",
  "crime",
  "documentary",
  "docuseries",
  "drama",
  "family",
  "fantasy",
  "history",
  "historical",
  "horror",
  "music",
  "musical",
  "mystery",
  "romance",
  "romantic",
  "scifi",
  "sci-fi",
  "science",
  "fiction",
  "thriller",
  "thrillers",
  "war",
  "western",
  "sitcom",
  "sitcoms",
  "anime",
  "psychological",
  "superhero",
  "detective",
  "cyberpunk",
  "underdog",
  "gladiator",
  "heist",
  "dystopia",
  "dystopian",
  "wholesome",
  "cute",
  "dark",
  "ancient",
  "sword",
  "swords",
  "battle",
  "battles",
  "movie",
  "movies",
  "film",
  "films",
  "series",
  "show",
  "shows",
  "vibe",
  "vibes",
  "tone",
  "mood",
  "style",
  "story",
  "stories",
]);

const isValidControllerAmbiguousSingleWord = (word, fullContextStr = "") => {
  const w = (word || "")
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");
  if (!AMBIGUOUS_SINGLE_WORD_TITLES || !AMBIGUOUS_SINGLE_WORD_TITLES.has(w)) {
    return true;
  }
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
  if (nextWord && CONTROLLER_PRE_MODIFIER_WORDS.has(nextWord)) {
    return false;
  }

  return true;
};

// 🌟 2. مطابقة العنوان مع القائمة الأيقونية المرجعية (Fuzzy Anchor Resolution >= 0.65)
const resolveKnownFuzzyTitle = (queryTitle, fullContextStr = "") => {
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

// 🌟 3. دالة اختيار أفضل Anchor مع تطبيق Vote Floor صارم وتخفيض الحد الأدنى للأعمال الأيقونية إلى 0.65
const selectBestAnchorMatch = (
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

    // عقوبة الكلمات الإضافية لو اليوزر كاتب كلمة واحدة
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

// 🌟 4. فلاتر regex مساعدة لتنقية مرشحي الـ Recommendations والـ Discover قبل التقييم
const ECCHI_HAREM_FILTER_REGEX =
  /\b(high school dxd|dxd|ecchi|harem|fanservice|fan service|hentai|erotic|borderline porn|kiss x sis|to love-ru|to love ru|monster musume|prison school|interspecies reviewers|yosuga no sora|shinmai maou|redo of healer|seikon no qwaser|valkyrie drive|queen's blade|shimoneta|testament of sister new devil|sekirei|freezing|heaven's lost property|rosario \+ vampire|ikkitousen|maken-ki|trinity seven|hybrid x heart|hundred\b|infinite stratos|date a live|danmachi|is it wrong to try to pick up girls in a dungeon|arrow of the orion|quintessential quintuplets|gotoubun no hanayome|my next life as a villainess|all routes lead to doom|hamefura|rent-a-girlfriend|kanojo okarishimasu|girlfriend, girlfriend|kanojo mo kanojo|domestic girlfriend|scum's wish|food wars|shokugeki no soma|goblin slayer|mushoku tensei|no game no life|how not to summon a demon lord|arifureta|strike the blood|chivalry of a failed knight|the asterisk war|saekano)\b/i;

const KIDS_MASCOT_FILTER_REGEX =
  /\b(doraemon|beyblade|pokemon|pokémon|digimon|yu-gi-oh|yugioh|duel monsters|bakugan|yo-kai watch|inazuma eleven|crayon shin-chan|shin chan|anpanman|chibi maruko-chan|hamtaro|precure|pretty cure|aikatsu|pripara|sonic x|medabots|duel masters|zatch bell|keroro|astro boy)\b/i;

const MODERN_WARFARE_GUNS_FILTER_REGEX =
  /\b(world war|wwii|ww2|wwi|vietnam|nazi|hitler|pearl harbor|hacksaw ridge|unbroken|bridge on the river kwai|saving private ryan|dunkirk|1917|fury|platoon|full metal jacket|apocalypse now|black hawk down|enemy at the gates|machine gun|rifle|guns?|pistol|bullet|bullets|trench|trenches|normandy|d-day|air force|submarine|torpedo|bomber|tank|tanks|firearms|sniper|grenade|holocaust|all quiet on the western front|john wick|training day|equalizer|sicario|narcotics|lapd|police officer|detective|fbi|cia|swat|cartel|drug lord|mafia|gangster|hitman|assassin|car chase|heist|pirates of the caribbean|jack sparrow)\b/i;

const SWORD_WARFARE_THEMES_REGEX =
  /\b(sword|swords|sword fight|blade|spear|shield|gladiator|gladiators|roman empire|ancient rome|ancient greece|spartan|spartans|crusade|crusades|crusaders|medieval|medieval warfare|knights|samurai|katana|feudal japan|kingdom|castle siege|chariot|arrow|arrows|bow|armor|broadsword|ancient warfare|ancient battles?|medieval armies|braveheart|troy|300|the last samurai|kingdom of heaven|the northman|the king|outlaw king|centurion|the eagle|red cliff|baahubali|alexander|spartacus|vikings|the last kingdom|vinland saga)\b/i;

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

    // 🌟 أولوية النص الصريحة على الـ UI Focus Dropdown
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

    const userPreviousTexts = Array.isArray(history)
      ? history
          .filter((msg) => msg.role === "user" && msg.text)
          .map((msg) => msg.text.trim())
      : [];

    let parsedIntent = CindromeEngine.parseQuery(cleanPrompt, normalizedFocus);

    // 🌟 2. Early Contradiction Guard (فحص التناقض المبكر قبل أي استدعاء لقاعدة البيانات أو TMDB)
    if (parsedIntent.hasContradiction) {
      return res.json({
        success: true,
        message: parsedIntent.contradictionMessage,
        results: [],
      });
    }

    // 🌟 معالجة طلبات الـ Sci-Fi وإلغاء الـ Ambiguous Fallback
    if (
      /\b(sci[- ]?fi|scifi|science\s+fiction)\b/i.test(cleanPrompt) &&
      !parsedIntent.excludedGenres?.includes("scifi")
    ) {
      if (!parsedIntent.detectedGenres.includes("scifi"))
        parsedIntent.detectedGenres.push("scifi");
      parsedIntent.isAmbiguous = false;
      parsedIntent.isValid = true;
    }

    // 🌟 فحص مسبق للـ Fuzzy Anchor لمنع سقوط الاستعلام في Ambiguous Fallback (مع حماية الكلمات الملتبسة مثل Dark)
    const earlyFuzzyCheck = parsedIntent.extractedReferenceTitle
      ? resolveKnownFuzzyTitle(
          parsedIntent.extractedReferenceTitle,
          cleanPrompt,
        )
      : cleanPrompt.split(/\s+/).filter(Boolean).length <= 3
        ? resolveKnownFuzzyTitle(rawCleanPrompt, cleanPrompt)
        : null;

    if (
      earlyFuzzyCheck &&
      !parsedIntent.extractedDirector &&
      !parsedIntent.isNowPlaying
    ) {
      if (
        !parsedIntent.extractedReferenceTitles ||
        parsedIntent.extractedReferenceTitles.length === 0
      ) {
        parsedIntent.extractedReferenceTitles = [earlyFuzzyCheck.canonical];
      }
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
      const combinedHistoryPrompt =
        `${userPreviousTexts.join(" ")} ${cleanPrompt}`.trim();
      const cumulativeIntent = CindromeEngine.parseQuery(
        combinedHistoryPrompt,
        normalizedFocus,
      );

      // 🌟 Fix 2: Contradiction Clarification Follow-Up Resolution (Do NOT abort on cumulativeIntent.hasContradiction when history exists and current turn is clean)
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

      if (
        /\b(sci[- ]?fi|scifi|science\s+fiction)\b/i.test(
          combinedHistoryPrompt,
        ) &&
        !currentExplicitExcludeGenres.has("scifi")
      ) {
        if (
          cumulativeIntent.detectedGenres &&
          !cumulativeIntent.detectedGenres.includes("scifi")
        ) {
          cumulativeIntent.detectedGenres.push("scifi");
        }
        parsedIntent.isAmbiguous = false;
        parsedIntent.isValid = true;
      }

      let mergedExcludedGenres = Array.from(
        new Set([
          ...(cumulativeIntent.excludedGenres || []),
          ...(parsedIntent.excludedGenres || []),
        ]),
      );

      let mergedExcludedTerms = Array.from(
        new Set([
          ...(cumulativeIntent.excludedTermsFromPrompt || []),
          ...(parsedIntent.excludedTermsFromPrompt || []),
        ]),
      );

      let mergedExcludedKeywords = Array.from(
        new Set([
          ...(cumulativeIntent.excludedKeywords || []),
          ...(parsedIntent.excludedKeywords || []),
        ]),
      );

      // If the user's current follow-up explicitly includes a genre or keyword, remove it from exclusions
      if (
        currentExplicitIncludeGenres.size > 0 ||
        currentExplicitIncludeKeywords.size > 0
      ) {
        mergedExcludedGenres = mergedExcludedGenres.filter(
          (g) => !currentExplicitIncludeGenres.has(g),
        );
        mergedExcludedTerms = mergedExcludedTerms.filter((term) => {
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
        mergedExcludedKeywords = mergedExcludedKeywords.filter(
          (kwId) => !includedKwIds.has(String(kwId)),
        );
      }

      // منع استبعاد تصنيف war إذا كان الطلب يخص معارك السيوف القديمة (isSwordWarfare)
      if (parsedIntent.isSwordWarfare || cumulativeIntent.isSwordWarfare) {
        mergedExcludedGenres = mergedExcludedGenres.filter((g) => g !== "war");
      }

      parsedIntent.excludedGenres = mergedExcludedGenres;
      parsedIntent.excludedKeywords = mergedExcludedKeywords;
      parsedIntent.excludedTermsFromPrompt = mergedExcludedTerms;

      const mergedExcludedGenreIds = [];
      parsedIntent.excludedGenres.forEach((g) => {
        if (TMDB_GENRE_IDS.movie[g])
          mergedExcludedGenreIds.push(TMDB_GENRE_IDS.movie[g]);
        if (TMDB_GENRE_IDS.tv[g])
          mergedExcludedGenreIds.push(TMDB_GENRE_IDS.tv[g]);
      });
      parsedIntent.excludedGenreIds = Array.from(
        new Set(mergedExcludedGenreIds),
      );

      // Reconstruct historical positive genres AND format/language/director/now-playing constraints even if cumulativeIntent returned early on contradiction
      const historicalAffirmativeGenres = new Set(
        cumulativeIntent.detectedGenres || [],
      );
      let historicalTargetType =
        cumulativeIntent.targetType && cumulativeIntent.targetType !== "mixed"
          ? cumulativeIntent.targetType
          : null;
      let historicalLanguage = cumulativeIntent.detectedLanguage || null;
      let historicalCountry = cumulativeIntent.detectedCountry || null;
      let historicalRegionLabel = cumulativeIntent.detectedRegionLabel || null;
      let historicalDirector = cumulativeIntent.extractedDirector || null;
      let historicalNowPlaying = Boolean(cumulativeIntent.isNowPlaying);
      let historicalWantsAnime = Boolean(
        cumulativeIntent.wantsExplicitAnime ||
        cumulativeIntent.targetType === "anime" ||
        /\b(anime|manga)\b/i.test(combinedHistoryPrompt),
      );

      for (const prevText of userPreviousTexts) {
        const prevNorm = normalizePromptSpelling(prevText);
        const prevParsed = CindromeEngine.parseQuery(prevNorm, normalizedFocus);

        (prevParsed.detectedGenres || []).forEach((g) =>
          historicalAffirmativeGenres.add(g),
        );

        if (prevParsed.extractedDirector) {
          historicalDirector = prevParsed.extractedDirector;
        }
        if (prevParsed.isNowPlaying) {
          historicalNowPlaying = true;
        }

        if (
          !historicalTargetType &&
          prevParsed.targetType &&
          prevParsed.targetType !== "mixed"
        ) {
          historicalTargetType = prevParsed.targetType;
        }
        if (
          prevParsed.wantsExplicitAnime ||
          prevParsed.targetType === "anime" ||
          /\b(anime|manga)\b/i.test(prevNorm)
        ) {
          historicalWantsAnime = true;
          historicalTargetType = "anime";
          historicalLanguage = "ja";
          historicalCountry = "JP";
          historicalRegionLabel = "Japanese";
          historicalAffirmativeGenres.add("animation");
        } else if (!historicalLanguage && prevParsed.detectedLanguage) {
          historicalLanguage = prevParsed.detectedLanguage;
          historicalCountry = prevParsed.detectedCountry;
          historicalRegionLabel = prevParsed.detectedRegionLabel;
        }

        if (cumulativeIntent.hasContradiction || prevParsed.hasContradiction) {
          const strippedPrev = prevNorm
            .toLowerCase()
            .replace(
              /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi,
              " ",
            );
          for (const [gKey, kwList] of Object.entries(genreMap)) {
            if (
              kwList.some((kw) =>
                new RegExp(`\\b${kw}\\b`, "i").test(strippedPrev),
              )
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

      if (parsedIntent.isPivot && parsedIntent.detectedGenres.length > 0) {
        parsedIntent.detectedGenres = parsedIntent.detectedGenres.filter(
          (g) =>
            !parsedIntent.excludedGenres.includes(g) &&
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
            !currentExplicitExcludeGenres.has(g) &&
            !currentExplicitExcludeTerms.has(g),
        );
      } else {
        parsedIntent.detectedGenres = Array.from(
          historicalAffirmativeGenres,
        ).filter(
          (g) =>
            !parsedIntent.excludedGenres.includes(g) &&
            !currentExplicitExcludeGenres.has(g) &&
            !currentExplicitExcludeTerms.has(g),
        );
      }

      // Preserve anime format lock across contradiction clarification turns unless user explicitly pivoted to live-action
      if (
        historicalWantsAnime &&
        !parsedIntent.isLiveAction &&
        !(
          parsedIntent.isPivot &&
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
          !parsedIntent.excludedGenres.includes("animation")
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
        !parsedIntent.isPivot &&
        historicalTargetType &&
        historicalTargetType !== "mixed"
      ) {
        parsedIntent.targetType = historicalTargetType;
      }

      if (!parsedIntent.isPivot) {
        if (
          parsedIntent.minYear === null &&
          cumulativeIntent.minYear !== null
        ) {
          parsedIntent.minYear = cumulativeIntent.minYear;
        }
        if (
          parsedIntent.maxYear === null &&
          cumulativeIntent.maxYear !== null
        ) {
          parsedIntent.maxYear = cumulativeIntent.maxYear;
        }
        if (
          parsedIntent.minRating === null &&
          cumulativeIntent.minRating !== null
        ) {
          parsedIntent.minRating = cumulativeIntent.minRating;
        }

        // Preserve historicalDirector across follow-ups unless the current prompt explicitly specifies a new director trigger or full director name
        const hasExplicitDirectorTrigger =
          /\b(?:directed\s+by|director|films?\s+by|movies?\s+by|series\s+by|shows?\s+by|works?\s+of|cinema\s+of|who\s+directed)\b/i.test(
            cleanPrompt,
          );
        const hasFullKnownDirectorInCurrentPrompt = KNOWN_DIRECTORS.some(
          (dir) => {
            const escapedDir = dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`\\b${escapedDir}\\b`, "i").test(cleanPrompt);
          },
        );

        const activeHistoricalDirector =
          historicalDirector || cumulativeIntent.extractedDirector || null;

        if (activeHistoricalDirector) {
          if (
            !hasExplicitDirectorTrigger &&
            !hasFullKnownDirectorInCurrentPrompt
          ) {
            parsedIntent.extractedDirector = activeHistoricalDirector;
          } else if (!parsedIntent.extractedDirector) {
            parsedIntent.extractedDirector = activeHistoricalDirector;
          }
        }

        if (
          !parsedIntent.isNowPlaying &&
          (cumulativeIntent.isNowPlaying || historicalNowPlaying)
        ) {
          parsedIntent.isNowPlaying = true;
        }
      }

      if (
        parsedIntent.detectedGenres.length > 0 ||
        parsedIntent.excludedGenres.length > 0 ||
        parsedIntent.targetType === "anime" ||
        parsedIntent.extractedDirector ||
        parsedIntent.isNowPlaying
      ) {
        parsedIntent.isAmbiguous = false;
        parsedIntent.isValid = true;
      }

      const isLiveActionOrSitcomPivot =
        (parsedIntent.isPivot || parsedIntent.isLiveAction) &&
        (parsedIntent.isLiveAction ||
          parsedIntent.isSitcom ||
          parsedIntent.detectedGenres.includes("comedy")) &&
        !historicalWantsAnime &&
        !/\b(anime|manga)\b/i.test(cleanPrompt);

      if (isLiveActionOrSitcomPivot) {
        parsedIntent.detectedLanguage = null;
        parsedIntent.detectedCountry = null;
        parsedIntent.detectedRegionLabel = null;
        parsedIntent.isKorean = false;
        if (!parsedIntent.hasExplicitTargetType) {
          parsedIntent.targetType = "tv";
        }
      } else if (!parsedIntent.detectedLanguage && historicalLanguage) {
        parsedIntent.detectedLanguage = historicalLanguage;
        parsedIntent.detectedCountry = historicalCountry;
        parsedIntent.detectedRegionLabel = historicalRegionLabel;
      }

      const keywordMap = new Map();
      [
        ...(cumulativeIntent.detectedKeywords || []),
        ...(parsedIntent.detectedKeywords || []),
      ].forEach((k) => keywordMap.set(k.name, k));

      parsedIntent.detectedKeywords = Array.from(keywordMap.values()).filter(
        (k) =>
          !parsedIntent.excludedKeywords.includes(String(k.id)) &&
          !currentExplicitExcludeTerms.has(k.name.toLowerCase()),
      );

      if (
        parsedIntent.isPivot &&
        (parsedIntent.detectedGenres.includes("comedy") ||
          parsedIntent.isLiveAction)
      ) {
        parsedIntent.isMindBlowingAction = false;
        parsedIntent.isDarkAnime = false;
        parsedIntent.isCyberpunk = false;
        parsedIntent.isPhilosophicalSciFi = false;
        parsedIntent.isSwordWarfare = false;
        parsedIntent.isHistoricalWar = false;
      } else {
        parsedIntent.isKorean =
          parsedIntent.isKorean || cumulativeIntent.isKorean;
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
          parsedIntent.isMindBlowingAction ||
          cumulativeIntent.isMindBlowingAction;
        parsedIntent.isDarkAnime =
          parsedIntent.isDarkAnime || cumulativeIntent.isDarkAnime;
        parsedIntent.isCuteAnimeRomCom =
          parsedIntent.isCuteAnimeRomCom || cumulativeIntent.isCuteAnimeRomCom;
        parsedIntent.isSitcom =
          parsedIntent.isSitcom || cumulativeIntent.isSitcom;
        parsedIntent.isPureComedy =
          parsedIntent.isPureComedy || cumulativeIntent.isPureComedy;
        parsedIntent.isComfortComedy =
          parsedIntent.isComfortComedy || cumulativeIntent.isComfortComedy;
        parsedIntent.hasQualityFloor =
          parsedIntent.hasQualityFloor || cumulativeIntent.hasQualityFloor;
      }

      if (parsedIntent.extractedDirector || parsedIntent.isNowPlaying) {
        parsedIntent.extractedReferenceTitles = [];
        parsedIntent.extractedReferenceTitle = null;
      } else if (
        (!parsedIntent.extractedReferenceTitles ||
          parsedIntent.extractedReferenceTitles.length === 0) &&
        cumulativeIntent.extractedReferenceTitles &&
        cumulativeIntent.extractedReferenceTitles.length > 0 &&
        !parsedIntent.isPivot
      ) {
        parsedIntent.extractedReferenceTitles =
          cumulativeIntent.extractedReferenceTitles;
        parsedIntent.extractedReferenceTitle =
          cumulativeIntent.extractedReferenceTitles[0] || null;
      }
    }

    // 🌟 Fix 4: When isNowPlaying is active, always force targetType = "movie"
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
      return res.json({
        success: true,
        message: parsedIntent.contradictionMessage,
        results: [],
      });
    }

    if (
      parsedIntent.isAmbiguous &&
      (!parsedIntent.extractedReferenceTitles ||
        parsedIntent.extractedReferenceTitles.length === 0) &&
      !parsedIntent.extractedDirector &&
      !parsedIntent.isNowPlaying &&
      userPreviousTexts.length === 0
    ) {
      return res.json({
        success: true,
        message:
          "I couldn't quite catch the specific genre or mood you're looking for. Are you in the mood for Comedy, Action, Sci-Fi, Horror, or Drama? Or you can just name a title you love!",
        results: [],
      });
    }

    // 🌟 7. حساب عتبة التقييم الديناميكية الشاملة (effectiveRatingFloor)
    const effectiveRatingFloor = Math.max(6.8, parsedIntent.minRating || 6.8);

    let userProfileStats = { genres: {}, keywords: {} };
    let userReviewsCount = 0;

    const currentUserId = req.user.id;

    const countRes = await db.query(
      "SELECT COUNT(*) FROM reviews WHERE user_id = $1 AND rating >= 4.0",
      [currentUserId],
    );
    userReviewsCount = parseInt(countRes.rows[0].count, 10);

    if (userReviewsCount >= 5) {
      const topUserReviews = await db.query(
        `SELECT tmdb_id, media_type, rating 
                   FROM reviews 
                   WHERE user_id = $1 AND rating >= 4.0 
                   ORDER BY rating DESC, watch_date DESC 
                   LIMIT 10`,
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
                params: {
                  api_key: TMDB_API_KEY,
                  append_to_response: "keywords",
                },
              },
            )
            .catch(() => null);
        });

        const responses = await Promise.all(detailPromises);
        responses.forEach((resp, index) => {
          if (resp && resp.data) {
            const rawRating =
              parseFloat(topUserReviews.rows[index].rating) || 4.5;
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

      const favGenresRes = await db.query(
        "SELECT genre FROM user_favorite_genres WHERE user_id = $1",
        [currentUserId],
      );
      favGenresRes.rows.forEach((row) => {
        const g = row.genre.toLowerCase();
        if (!userProfileStats.genres[g]) {
          userProfileStats.genres[g] = 8.0;
          userProfileStats[g] = 8.0;
        }
      });
    }

    // 🌟 3. Multi-Anchor Aggregation (معالجة حتى 3 عناوين مرجعية بالتوازي)
    let rawReferenceTitles = Array.isArray(
      parsedIntent.extractedReferenceTitles,
    )
      ? [...parsedIntent.extractedReferenceTitles]
      : parsedIntent.extractedReferenceTitle
        ? [parsedIntent.extractedReferenceTitle]
        : [];

    if (parsedIntent.extractedDirector || parsedIntent.isNowPlaying) {
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
      cleanPrompt.split(" ").length <= 4 &&
      !parsedIntent.extractedDirector &&
      !parsedIntent.isNowPlaying &&
      !parsedIntent.detectedLanguage &&
      !parsedIntent.detectedCountry &&
      parsedIntent.detectedGenres.length === 0 &&
      parsedIntent.detectedKeywords.length === 0 &&
      (!/\b(recommend|suggest|show|give|want|looking|find|movies|anime|series|dark|psychological|cute|wholesome|egyptian|kuwaiti|saudi|turkish|korean|japanese|indian|arabic|french|spanish)\b/i.test(
        cleanPrompt,
      ) ||
        isStandaloneAmbiguousShortQuery);

    if (rawReferenceTitles.length === 0 && isShortTitleQuery) {
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

    const resolveSingleAnchorMedia = async (rawTitle) => {
      const knownMeta = resolveKnownFuzzyTitle(rawTitle, cleanPrompt);
      const searchTitle = knownMeta ? knownMeta.canonical : rawTitle;

      try {
        const searchEndpoint =
          parsedIntent.targetType === "anime" ||
          parsedIntent.targetType === "tv"
            ? "https://api.themoviedb.org/3/search/tv"
            : parsedIntent.targetType === "movie"
              ? "https://api.themoviedb.org/3/search/movie"
              : "https://api.themoviedb.org/3/search/multi";

        const searchRes = await axios.get(searchEndpoint, {
          params: {
            api_key: TMDB_API_KEY,
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
          const multiRes = await axios
            .get("https://api.themoviedb.org/3/search/multi", {
              params: {
                api_key: TMDB_API_KEY,
                query: searchTitle,
                page: 1,
              },
            })
            .catch(() => ({ data: { results: [] } }));

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
          const retryRes = await axios
            .get("https://api.themoviedb.org/3/search/multi", {
              params: { api_key: TMDB_API_KEY, query: cleanedQuery, page: 1 },
            })
            .catch(() => ({ data: { results: [] } }));

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

            const tokenSearchRes = await axios
              .get("https://api.themoviedb.org/3/search/multi", {
                params: {
                  api_key: TMDB_API_KEY,
                  query: fallbackToken,
                  page: 1,
                },
              })
              .catch(() => ({ data: { results: [] } }));

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
          };
        } else if (knownMeta) {
          return {
            title: knownMeta.canonical,
            media: null,
            meta: knownMeta,
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
          };
        }
        return null;
      }
    };

    const resolvedAnchorsRaw = await Promise.all(
      rawReferenceTitles.map((t) => resolveSingleAnchorMedia(t)),
    );
    const resolvedAnchors = resolvedAnchorsRaw.filter(Boolean);

    // دمج الـ genres والـ flags من كافة الـ Anchors المكتشفة
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
    const knownAnchorMeta =
      resolvedAnchors.find((a) => a.meta !== null)?.meta || null;

    parsedIntent.extractedReferenceTitles = resolvedAnchorNames;
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
      Boolean(parsedIntent.isNowPlaying) ||
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

    const iconicSitcomAnchors =
      /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;

    const isSitcomIntent =
      parsedIntent.isSitcom ||
      parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
      resolvedAnchorNames.some((t) => iconicSitcomAnchors.test(t)) ||
      /\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(cleanPrompt);

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
      !isSitcomIntent &&
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
      parsedIntent.isHauntedHorror ||
      parsedIntent.detectedKeywords.some((k) => k.name === "haunted house") ||
      /\b(cursed house|haunted house|haunted family|cursed family|scary house)\b/i.test(
        cleanPrompt,
      ) ||
      (/\b(scary|horror|haunted|cursed|creepy|demonic|evil|spooky)\b/i.test(
        cleanPrompt,
      ) &&
        /\b(house|family|home|manor|mansion|cabin)\b/i.test(cleanPrompt));

    const isMindBlowingActionIntent =
      parsedIntent.isMindBlowingAction ||
      (/\b(mind[- ]blowing|mind blowing)\b/i.test(cleanPrompt) &&
        /\baction\b/i.test(cleanPrompt));

    const isPureComedyIntent =
      parsedIntent.isPureComedy ||
      /\b(pure comedy|only comedy|strictly comedy|purely comedy|just comedy|hilarious)\b/i.test(
        cleanPrompt,
      );

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
        parsedIntent.detectedKeywords.some(
          (k) => k.name === "historical war",
        ) ||
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
      parsedIntent.isComfortComedy ||
      (parsedIntent.isTiredMood &&
        parsedIntent.detectedGenres.includes("comedy"));

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

    // 🌟 3. جلب ترشيحات كافة الـ Anchors المكتشفة بالتوازي من TMDB /recommendations
    const validAnchorMedias = resolvedAnchors.filter((a) => a.media !== null);
    if (validAnchorMedias.length > 0 && !parsedIntent.extractedDirector) {
      const recPromises = validAnchorMedias.map(async (anchorObj) => {
        const mediaItem = anchorObj.media;
        const actualMediaType =
          mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");
        const recEndpoint = `https://api.themoviedb.org/3/${actualMediaType}/${mediaItem.id}/recommendations`;

        try {
          const recRes = await axios.get(recEndpoint, {
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

    // 🌟 4. Strict Director Search Pipeline (جلب أعمال المخرج حصرياً عبر job === "Director" من Combined Credits دون with_crew)
    let resolvedDirectorId = null;
    if (parsedIntent.extractedDirector) {
      try {
        const personSearchRes = await axios.get(
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

          const creditsRes = await axios
            .get(
              `https://api.themoviedb.org/3/person/${resolvedDirectorId}/combined_credits`,
              {
                params: { api_key: TMDB_API_KEY },
              },
            )
            .catch(() => ({ data: { crew: [] } }));

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

              return (
                (item.vote_average || 0) >= effectiveRatingFloor &&
                (item.vote_count || 0) >= 50
              );
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
              const genreMatchedWorks = directedWorks.filter((item) =>
                (item.genre_ids || []).some((id) =>
                  requestedGenreIdSet.has(Number(id)),
                ),
              );
              if (genreMatchedWorks.length >= 2) {
                directedWorks = genreMatchedWorks;
              }
            }
          }

          candidates = [...directedWorks];
        }
      } catch (dirErr) {
        console.error("Director lookup failed:", dirErr.message);
      }
    }

    // 🌟 6. Now Playing / In Theaters Pipeline (جلب أفلام السينما الحالية مع نافذة 150 يوماً صارمة)
    if (parsedIntent.isNowPlaying) {
      try {
        const regionCode = parsedIntent.detectedCountry || "US";
        const [np1, np2] = await Promise.all([
          axios
            .get("https://api.themoviedb.org/3/movie/now_playing", {
              params: { api_key: TMDB_API_KEY, page: 1, region: regionCode },
            })
            .catch(() => ({ data: { results: [] } })),
          axios
            .get("https://api.themoviedb.org/3/movie/now_playing", {
              params: { api_key: TMDB_API_KEY, page: 2, region: regionCode },
            })
            .catch(() => ({ data: { results: [] } })),
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

    // 🌟 حاصدات مخصصة للمفاهيم الدقيقة لضمان توفر مرشحين ممتازين حتى لو كانت نتائج /recommendations قليلة أو مفلترة
    if (
      isSwordWarfareIntent &&
      parsedIntent.targetType !== "anime" &&
      !resolvedDirectorId &&
      !parsedIntent.isNowPlaying
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
      !parsedIntent.isNowPlaying
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
      !parsedIntent.isNowPlaying
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

    const excludeSuperheroParam =
      isExcludedSuperhero || !wantsSuperhero ? "9715" : null;
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

    const romcomKeywordParam = isRomComIntent
      ? String(TMDB_THEME_IDS.romcom || "9799|158718|3133")
      : null;

    const swordWarfareKeywordParam = isSwordWarfareIntent
      ? String(TMDB_THEME_IDS.swordWarfare || "804|195779|2964")
      : null;

    const historicalWarKeywordParam = isHistoricalWarIntent
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
    if (isRomComIntent || (isComfortComedyIntent && !isPureComedyIntent))
      withoutKeywordsList.push("9716");
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
    if (
      parsedIntent.excludedKeywords &&
      parsedIntent.excludedKeywords.length > 0
    ) {
      withoutKeywordsList.push(...parsedIntent.excludedKeywords);
    }
    withoutKeywordsList = Array.from(new Set(withoutKeywordsList));
    const withoutKeywordsParam =
      withoutKeywordsList.length > 0 ? withoutKeywordsList.join(",") : null;

    // 🌟 حظر صريح للـ Ecchi و Harem في أي استعلام أنمي
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

    if (isPureComedyIntent && !movieGenres.includes(35)) {
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

    let primaryMovieGenre =
      movieGenres.length > 0 ? movieGenres.join(",") : null;
    let primaryTvGenre = tvGenres.length > 0 ? tvGenres.join("|") : null;

    if (wantsSciFi) {
      primaryMovieGenre = isMindBlowingActionIntent ? "28,878" : "878";
      primaryTvGenre = "10765";
    }

    if (isComfortComedyIntent || isPureComedyIntent || isSitcomIntent) {
      primaryMovieGenre = "35";
      primaryTvGenre = "35";
    }

    if (isRomComIntent) {
      primaryMovieGenre = "35,10749";
    }

    if (isSwordWarfareIntent) {
      primaryMovieGenre = "36|10752";
      primaryTvGenre = "10768|36";
    } else if (isHistoricalWarIntent) {
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

    // 🌟 8. ضبط عتبات الأصوات للأعمال الإقليمية والـ Now Playing والـ Tight Constraints
    const isRegionalNonEnglish = Boolean(
      (parsedIntent.detectedLanguage &&
        parsedIntent.detectedLanguage !== "en") ||
      (parsedIntent.detectedCountry &&
        !["US", "GB"].includes(parsedIntent.detectedCountry)),
    );

    const hasTightConstraints = Boolean(
      parsedIntent.minYear !== null ||
      parsedIntent.maxYear !== null ||
      parsedIntent.minRating !== null ||
      Boolean(parsedIntent.extractedDirector) ||
      Boolean(parsedIntent.isNowPlaying) ||
      isRegionalNonEnglish ||
      (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) ||
      isHeistRobberyIntent ||
      isCrimeFamilyIntent ||
      isCrimeHeist ||
      parsedIntent.detectedLanguage ||
      parsedIntent.detectedCountry,
    );

    const movieMinVotes = parsedIntent.isNowPlaying
      ? 25
      : isRegionalNonEnglish
        ? 30
        : hasTightConstraints
          ? 80
          : 300;
    const tvMinVotes = isRegionalNonEnglish
      ? 25
      : hasTightConstraints
        ? 50
        : 200;

    // 🌟 5. ضبط نطاق التواريخ الشامل (minYear & maxYear & Now Playing 150-day window)
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

    // 🌟 Fix 3: Do NOT run /discover/movie or /discover/tv with with_crew when resolvedDirectorId is active (rely exclusively on job === "Director" credits)
    if (!resolvedDirectorId) {
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

        if (superheroKeywordParam) {
          movieParams.with_keywords = superheroKeywordParam;
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
        } else if (complexKeywordParam && !wantsSciFi) {
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
                : ["16"];

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

        if (superheroKeywordParam) {
          liveTvParams.with_keywords = superheroKeywordParam;
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
        } else if (complexKeywordParam && !wantsSciFi) {
          liveTvParams.with_keywords = complexKeywordParam;
        } else if (sportsKeywordParam) {
          liveTvParams.with_keywords = sportsKeywordParam;
        }
        if (tvFantasyExclude) liveTvParams.without_keywords = tvFantasyExclude;

        let animeWithoutList = ["10762"];
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

        if (cuteAnimeKeywordParam)
          animeParams.with_keywords = cuteAnimeKeywordParam;
        else if (darkAnimeKeywordParam)
          animeParams.with_keywords = darkAnimeKeywordParam;
        else if (wantsMagic) animeParams.with_keywords = "2343|9799";
        else if (cyberpunkKeywordParam)
          animeParams.with_keywords = cyberpunkKeywordParam;
        else if (complexKeywordParam && !wantsSciFi)
          animeParams.with_keywords = complexKeywordParam;
        else if (sportsKeywordParam)
          animeParams.with_keywords = sportsKeywordParam;

        if (tvFantasyExclude && !wantsMagic) {
          animeParams.without_keywords = `${animeAntiEcchiKeywords},${tvFantasyExclude}`;
        }

        const moviePromises = [
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
        ];

        const tvPromises = [
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
        ];

        const animePromise =
          isComfortComedyIntent ||
          isHauntedHorrorIntent ||
          isPureComedyIntent ||
          isSitcomIntent ||
          isSwordWarfareIntent ||
          parsedIntent.isLiveAction ||
          (parsedIntent.detectedLanguage &&
            parsedIntent.detectedLanguage !== "ja")
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
      } else if (
        parsedIntent.targetType === "anime" &&
        !parsedIntent.isNowPlaying
      ) {
        let animeWithoutList = ["10762"];
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

        if (cuteAnimeKeywordParam)
          animeParams.with_keywords = cuteAnimeKeywordParam;
        else if (darkAnimeKeywordParam)
          animeParams.with_keywords = darkAnimeKeywordParam;
        else if (wantsMagic) animeParams.with_keywords = "2343|9799";
        else if (cyberpunkKeywordParam)
          animeParams.with_keywords = cyberpunkKeywordParam;
        else if (complexKeywordParam && !wantsSciFi)
          animeParams.with_keywords = complexKeywordParam;
        else if (sportsKeywordParam)
          animeParams.with_keywords = sportsKeywordParam;

        if (tvFantasyExclude && !wantsMagic) {
          animeParams.without_keywords = `${animeAntiEcchiKeywords},${tvFantasyExclude}`;
        }

        const tvRes = await axios.get(
          "https://api.themoviedb.org/3/discover/tv",
          { params: animeParams },
        );
        candidates = [
          ...candidates,
          ...(tvRes.data.results || []).map((a) => ({
            ...a,
            media_type: "anime",
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

        if (minReleaseDateStr) {
          singleParams[
            isTv ? "first_air_date.gte" : "primary_release_date.gte"
          ] = minReleaseDateStr;
        }

        if (parsedIntent.detectedLanguage) {
          singleParams.with_original_language = parsedIntent.detectedLanguage;
        }
        if (parsedIntent.detectedCountry) {
          singleParams.with_origin_country = parsedIntent.detectedCountry;
        }

        const targetPrimary = isTv ? primaryTvGenre : primaryMovieGenre;
        if (targetPrimary) singleParams.with_genres = targetPrimary;

        if (superheroKeywordParam) {
          singleParams.with_keywords = superheroKeywordParam;
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
        } else if (complexKeywordParam && !wantsSciFi) {
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
                    : ["16"];

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
            axios.get(endpoint, { params: { ...singleParams, page: 1 } }),
            axios.get(endpoint, { params: { ...singleParams, page: 2 } }),
          ]);
          candidates = [
            ...candidates,
            ...(p1Res.data.results || []).map((it) => ({
              ...it,
              media_type: isTv ? "tv" : "movie",
            })),
            ...(p2Res.data.results || []).map((it) => ({
              ...it,
              media_type: isTv ? "tv" : "movie",
            })),
          ];
        } catch (err) {
          const resData = await axios.get(endpoint, { params: singleParams });
          candidates = [
            ...candidates,
            ...(resData.data.results || []).map((it) => ({
              ...it,
              media_type: isTv ? "tv" : "movie",
            })),
          ];
        }
      }
    }

    // 🌟 5. تطبيق فلترة النطاق الزمني (minYear & maxYear & Now Playing 150-day window) والأصوات على جميع المرشحين
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

      const minAllowedVotes = parsedIntent.isNowPlaying
        ? 20
        : isRegionalNonEnglish
          ? 20
          : hasTightConstraints
            ? 30
            : parsedIntent.targetType === "anime" ||
                isCuteAnimeRomComIntent ||
                isDarkAnimeIntent ||
                isKoreanIntent ||
                isTrueCrimeDocIntent
              ? 40
              : 200;

      return voteCount >= minAllowedVotes;
    });

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

    let watchedIds = new Set();
    if (candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id).filter(Boolean);
      const watchedRes = await db.query(
        "SELECT tmdb_id FROM reviews WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
        [currentUserId, candidateIds],
      );
      watchedIds = new Set(watchedRes.rows.map((r) => Number(r.tmdb_id)));
    }

    candidates = candidates.filter(
      (c) => !watchedIds.has(Number(c.id)) && !sessionSeenIds.has(Number(c.id)),
    );

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

    const allFetchedCandidates = [...candidates];

    // =========================================================================
    // 🌟 9. Post-Recommendation & Pre-Scoring Strict Filtering
    // يشمل الحظر العالمي للإيتشي/الهاريم في كل الأنمي وعزل معارك السيوف عن الأنمي وحظر الرعب في الـ Sitcoms
    // =========================================================================
    const isSciFiAnchor =
      resolvedAnchors.some(
        (a) =>
          a.media?.genre_ids?.includes(878) ||
          a.media?.genre_ids?.includes(10765) ||
          a.meta?.genre === "scifi",
      ) || parsedIntent.detectedGenres.includes("scifi");

    const excludedGenreIds = new Set(parsedIntent.excludedGenreIds || []);
    const excludedKeywordIds = new Set(parsedIntent.excludedKeywords || []);

    const excludedTerms = [...(parsedIntent.excludedTermsFromPrompt || [])];
    (parsedIntent.excludedGenres || []).forEach((g) => {
      if (isSwordWarfareIntent && g === "war") return;
      if (genreMap[g]) excludedTerms.push(...genreMap[g]);
    });

    const superheroRegex =
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc\s*comics|comic\s*book|avengers|batman|superman|wonder woman|justice society|justice league|flash|aquaman)\b/i;

    const wantsNoSuperhero =
      excludedKeywordIds.has("9715") ||
      /\b(?:no|exclude|without|except|zero)\s+.*?\b(superhero|marvel|dc|superheroes)\b/i.test(
        cleanPrompt,
      );

    candidates = candidates.filter((c) => {
      const itemGenreIds = c.genre_ids || [];
      const titleText = (c.title || c.name || "").toLowerCase();
      const fullText = `${titleText} ${c.overview || ""}`.toLowerCase();
      const rawKw = Array.isArray(c.keywords)
        ? c.keywords
        : c.keywords?.keywords || c.keywords?.results || [];
      const itemKwIds = rawKw
        .map((k) => (typeof k === "object" ? k?.id : Number(k)))
        .filter(Boolean);

      const isAnimeCandidate =
        c.media_type === "anime" ||
        (c.original_language === "ja" && itemGenreIds.includes(16));

      // Strict Anime Lock: When anime intent is active, block all Western live-action sitcoms/movies (e.g., The Office, Brooklyn Nine-Nine)
      if (isAnimeIntent) {
        if (c.original_language !== "ja" || !itemGenreIds.includes(16)) {
          return false;
        }
      }

      // 1. حظر عالمي غير مشروط للـ Ecchi و Harem على كافة مرشحي الأنمي
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

      // 🌟 Fix 4: Sitcom Horror & Crime Exclusion (Prevent shows like Chucky from leaking into sitcoms)
      if (isSitcomIntent) {
        if (
          itemGenreIds.includes(27) ||
          itemGenreIds.includes(80) ||
          itemGenreIds.includes(53)
        ) {
          return false;
        }
      }

      // 2. عزل معارك السيوف الحية (isSwordWarfareIntent) عن الأنمي ما لم يُطلب أنمي صراحة
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

      // 3. إذا كان الاستعلام يطلب Sci-Fi صراحة، يتم استبعاد أي عمل لا يملك Genre ID 878 (فيلم) أو 10765 (مسلسل)
      if (parsedIntent.detectedGenres.includes("scifi")) {
        const hasSciFiGenre =
          itemGenreIds.includes(878) || itemGenreIds.includes(10765);
        if (!hasSciFiGenre) {
          return false;
        }
      }

      // 4. عند رصد Sci-Fi Anchor، يتم استبعاد الرعب البحت (27 بدون 878) والجريمة/الوثائقي البحت (80/99 بدون 878)
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

      // 5. إذا كان الاستعلام يطلب معارك سيوف قديمة (isSwordWarfare)، يتم استبعاد الأسلحة الحديثة والجريمة الحديثة
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
        const hasSuperheroKeyword =
          itemGenreIds.includes(9715) || itemKwIds.includes(9715);
        if (hasSuperheroKeyword || superheroRegex.test(fullText)) {
          return false;
        }
      }

      const strictTerms = excludedTerms.filter(
        (t) => !["detective", "modern", "ecchi", "harem"].includes(t),
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

    // 🌟 Fix 3 & Fix 4: Secondary fallback (NEVER run generic discover fallback for Director queries, and enforce 150-day window for isNowPlaying)
    if (candidates.length < 4 && !resolvedDirectorId) {
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
            fallbackGenre = isTv ? "10768|36" : "36|10752";
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
          "vote_count.gte": parsedIntent.isNowPlaying
            ? 20
            : isRegionalNonEnglish
              ? 20
              : 50,
          "vote_average.gte": effectiveRatingFloor,
          sort_by: "popularity.desc",
          [isTv ? "first_air_date.gte" : "primary_release_date.gte"]:
            parsedIntent.isNowPlaying
              ? oneFiftyDaysAgoStr
              : parsedIntent.minYear
                ? `${parsedIntent.minYear}-01-01`
                : isSwordWarfareIntent || isRegionalNonEnglish
                  ? "1990-01-01"
                  : "2010-01-01",
          [isTv ? "first_air_date.lte" : "primary_release_date.lte"]:
            maxReleaseDateStr,
        };

        if (fallbackGenre) {
          fallbackParams.with_genres = fallbackGenre;
        }

        if (isSitcomIntent && isTv && !isAnimeIntent) {
          fallbackParams.without_genres =
            "18,16,10765,10768,10762,10766,27,80,9648,53";
        } else if (!isTv) {
          fallbackParams.without_genres = movieWithoutGenres;
        }

        if (isAnimeIntent && !parsedIntent.isNowPlaying) {
          fallbackParams.with_original_language = "ja";
          fallbackParams.with_genres = fallbackGenre
            ? Array.from(
                new Set([...String(fallbackGenre).split(/[|,]/), "16"]),
              ).join(",")
            : "16";
          fallbackParams.without_keywords = animeAntiEcchiKeywords;
          fallbackParams.without_genres = "10762";
        } else if (parsedIntent.detectedLanguage) {
          fallbackParams.with_original_language = parsedIntent.detectedLanguage;
        }

        if (parsedIntent.detectedCountry) {
          fallbackParams.with_origin_country = parsedIntent.detectedCountry;
        }

        if (isExcludedSuperhero) {
          fallbackParams.without_keywords = "9715";
        }

        const fallbackRes = await axios.get(fallbackEndpoint, {
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

          const itemGIds = c.genre_ids || [];
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

          const tText = (c.title || c.name || "").toLowerCase();
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

    if (candidates.length < 4) {
      const fallbackCandidates = allFetchedCandidates.filter((c) => {
        const relDate = c.release_date || c.first_air_date;
        if (
          parsedIntent.isNowPlaying &&
          (!relDate || relDate < oneFiftyDaysAgoStr || c.media_type !== "movie")
        ) {
          return false;
        }
        if (
          isAnimeIntent &&
          (c.original_language !== "ja" || !(c.genre_ids || []).includes(16))
        ) {
          return false;
        }
        if (
          isSitcomIntent &&
          ((c.genre_ids || []).includes(27) ||
            (c.genre_ids || []).includes(80) ||
            (c.genre_ids || []).includes(53))
        ) {
          return false;
        }
        return (
          (c.vote_average || 0) >= effectiveRatingFloor &&
          !watchedIds.has(Number(c.id)) &&
          !sessionSeenIds.has(Number(c.id))
        );
      });

      if (fallbackCandidates.length >= 4 || resolvedDirectorId) {
        candidates = fallbackCandidates;
      }
    }

    // 🌟 تمرير مصفوفة العناوين المرجعية كاملة (resolvedAnchorNames) إلى scoreAndRank
    const rankedResults = CindromeEngine.scoreAndRank(
      candidates,
      parsedIntent,
      userProfileStats,
      resolvedAnchorNames,
      userReviewsCount,
    );

    // 🌟 فلترة صارمة بعد التقييم لمنع أي عمل معاقَب بشدة أو أقل من effectiveRatingFloor من الدخول في الـ Top 4
    let eligibleCandidates = rankedResults.filter(
      (item) =>
        item.finalScore >= 45 &&
        (item.vote_average || 0) >= effectiveRatingFloor,
    );

    if (eligibleCandidates.length < 4) {
      const qualitySafeCandidates = rankedResults.filter(
        (item) =>
          item.finalScore >= 35 &&
          (item.vote_average || 0) >= effectiveRatingFloor,
      );
      if (qualitySafeCandidates.length >= 4) {
        eligibleCandidates = qualitySafeCandidates;
      } else if (qualitySafeCandidates.length > 0) {
        eligibleCandidates = qualitySafeCandidates;
      } else {
        eligibleCandidates = rankedResults.slice(0, 4);
      }
    }

    let topResultsRaw = [];
    const deduplicatedCandidates = [];
    const seenFranchises = new Set();

    // تسجيل جميع العناوين المرجعية في seenFranchises لمنع ظهور أي جزء مباشر منها
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

    // 🌟 تعديل التجميع عند وجود Anchor محدد أو مخرج أو Now Playing: إلغاء الفرض الإجباري لتقسيم الكروت
    if (parsedIntent.targetType === "mixed") {
      const isMovieAnchor =
        anchorMedia &&
        (anchorMedia.media_type === "movie" ||
          (!anchorMedia.first_air_date && anchorMedia.release_date));

      if (
        isMovieAnchor ||
        parsedIntent.extractedDirector ||
        parsedIntent.isNowPlaying ||
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

    // استكمال آمن للـ 4 كروت مع احترام جدار الجودة (>= effectiveRatingFloor) وعدم السماح بمرور العناصر المعاقَبة
    if (topResultsRaw.length < 4) {
      for (const item of rankedResults) {
        if (topResultsRaw.length >= 4) break;
        if (
          (item.vote_average || 0) < effectiveRatingFloor ||
          item.finalScore < 35
        )
          continue;

        const fKey = getFranchiseKey(item.title || item.name);
        const alreadyIn = topResultsRaw.some((p) => p.id === item.id);
        const franchiseUsed = seenFranchises.has(fKey);

        if (!alreadyIn && !franchiseUsed) {
          topResultsRaw.push(item);
          seenFranchises.add(fKey);
        }
      }
    }

    let appliedWeightStr = "0%";
    if (userReviewsCount >= 10) appliedWeightStr = "35%";
    else if (userReviewsCount >= 5) appliedWeightStr = "15%";

    const totalUserKwCount = Object.keys(
      userProfileStats.keywords || {},
    ).length;
    const gW = totalUserKwCount > 0 && userReviewsCount >= 5 ? 35 : 60;
    const kwW = totalUserKwCount > 0 && userReviewsCount >= 5 ? 65 : 40;

    // 🌟 10. طباعة شجرية محدثة وشاملة لجميع المعاملات الجديدة
    console.log(`\n┌─ [Cindrome Dynamic Personalization Engine]`);
    console.log(
      `├── User ID: ${currentUserId} | Approved Reviews (>= 4.0): ${userReviewsCount}`,
    );
    if (resolvedAnchorNames.length > 0) {
      console.log(
        `├── Resolved Reference Anchors: ${resolvedAnchorNames.map((n) => `"${n}"`).join(", ")}`,
      );
    }
    if (parsedIntent.extractedDirector) {
      console.log(
        `├── Extracted Director: "${parsedIntent.extractedDirector}" (ID: ${resolvedDirectorId || "N/A"})`,
      );
    }
    if (parsedIntent.isNowPlaying) {
      console.log(`├── Now Playing / Theatrical Mode: ACTIVE`);
    }
    if (parsedIntent.minYear !== null || parsedIntent.maxYear !== null) {
      console.log(
        `├── Year Range Applied: ${parsedIntent.minYear || "Any"} -> ${parsedIntent.maxYear || "Present"}`,
      );
    }
    console.log(`├── Effective Rating Floor: >= ${effectiveRatingFloor}`);
    if (parsedIntent.detectedLanguage || parsedIntent.detectedCountry) {
      console.log(
        `├── Language / Origin Filter Applied: ${parsedIntent.detectedLanguage || "Any"} (${parsedIntent.detectedCountry || "Any Country"}${parsedIntent.detectedRegionLabel ? " - " + parsedIntent.detectedRegionLabel : ""})`,
      );
    }
    if (parsedIntent.excludedGenres && parsedIntent.excludedGenres.length > 0) {
      console.log(
        `├── Excluded Genres: ${parsedIntent.excludedGenres.join(", ")}`,
      );
    }
    if (
      parsedIntent.excludedKeywords &&
      parsedIntent.excludedKeywords.length > 0
    ) {
      console.log(
        `├── Excluded Keywords: ${parsedIntent.excludedKeywords.join(", ")}`,
      );
    }
    if (
      parsedIntent.excludedTermsFromPrompt &&
      parsedIntent.excludedTermsFromPrompt.length > 0
    ) {
      console.log(
        `├── Excluded Specific Terms: ${parsedIntent.excludedTermsFromPrompt.join(", ")}`,
      );
    }
    console.log(
      `├── Session Memory Deduplication: Excluded ${sessionSeenIds.size} previously shown items.`,
    );
    console.log(
      `├── Applied Dynamic Weight: ${appliedWeightStr} (Intent: ${userReviewsCount >= 10 ? "40%" : userReviewsCount >= 5 ? "50%" : "60%"} | User: ${appliedWeightStr} | Rating: ${userReviewsCount >= 10 ? "25%" : userReviewsCount >= 5 ? "35%" : "40%"})`,
    );
    if (totalUserKwCount > 0) {
      console.log(
        `├── Top User Micro-Keywords: ${Object.keys(userProfileStats.keywords).slice(0, 5).join(", ")}`,
      );
    }
    console.log(`└── Top Recommended Payload (${topResultsRaw.length} items):`);
    topResultsRaw.slice(0, 4).forEach((item, idx) => {
      const isLast = idx === Math.min(topResultsRaw.length, 4) - 1;
      const branch = isLast ? "    └──" : "    ├──";
      const title = item.title || item.name || "Unknown";
      const sIntent = (item.breakdown?.s_intent ?? 0).toFixed(1);
      const sUser = (item.breakdown?.s_user ?? 50).toFixed(1);
      const sUserGenre = (item.breakdown?.s_user_genre ?? sUser).toFixed(1);
      const sUserKw = (item.breakdown?.s_user_kw ?? 50).toFixed(1);
      const sRating = (item.breakdown?.s_rating ?? 0).toFixed(1);
      const fScore = (item.finalScore ?? 0).toFixed(1);
      const kwMatches = (item.breakdown?.matched_user_keywords || []).join(
        ", ",
      );
      console.log(
        `${branch} [${idx + 1}] "${title}" -> Final: ${fScore} | S_intent: ${sIntent} | S_user: ${sUser} (${totalUserKwCount > 0 && userReviewsCount >= 5 ? `${gW}% Genre: ${sUserGenre}, ${kwW}% Kw: ${sUserKw}` : `Genre: ${sUserGenre}`}${kwMatches ? " [" + kwMatches + "]" : ""}) | S_rating: ${sRating}`,
      );
    });
    console.log("");

    let userWatchlistSet = new Set();
    if (topResultsRaw.length > 0) {
      const topIds = topResultsRaw.map((item) => item.id);
      try {
        const wlRes = await db.query(
          "SELECT tmdb_id FROM watchlist WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
          [currentUserId, topIds],
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

    const responseText = CindromeEngine.generateResponseText(
      parsedIntent,
      formattedResults.length,
      false,
      resolvedAnchorNames,
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
