// services/cindromeEngine.js

// 1. قاموس استخراج النوايا الدلالية العامة (NLU)
export const genreMap = {
  action: [
    "action",
    "fast-paced",
    "fight",
    "fighting",
    "explosive",
    "martial arts",
    "superhero",
    "shonen",
    "battles",
  ],
  scifi: [
    "sci-fi",
    "science fiction",
    "space",
    "alien",
    "future",
    "futuristic",
    "time travel",
    "dystopian",
    "cyberpunk",
  ],
  horror: [
    "horror",
    "scary",
    "terrifying",
    "spooky",
    "fear",
    "ghost",
    "demon",
    "slasher",
    "creepy",
    "haunted",
  ],
  comedy: [
    "comedy",
    "funny",
    "laugh",
    "hilarious",
    "humor",
    "sitcom",
    "gag",
    "parody",
    "satire",
    "lighthearted",
  ],
  drama: [
    "drama",
    "emotional",
    "serious",
    "touching",
    "heartbreaking",
    "tragic",
    "sad",
    "slice of life",
    "life",
  ],
  mystery: [
    "mystery",
    "plot twist",
    "suspense",
    "puzzle",
    "detective",
    "thriller",
    "crime",
    "investigation",
    "mind-bending",
  ],
  romance: [
    "romance",
    "love",
    "romantic",
    "relationship",
    "dating",
    "couple",
    "crush",
  ],
  fantasy: [
    "fantasy",
    "magic",
    "mythical",
    "dragons",
    "sword",
    "witch",
    "isekai",
    "supernatural",
  ],
  sports: [
    "sport",
    "sports",
    "football",
    "soccer",
    "volleyball",
    "basketball",
    "boxing",
    "tournament",
  ],
};

// 2. معجم الكلمات المفتاحية بالمعرّفات الرقمية الرسمية في TMDB
export const themeKeywords = {
  "plot twist": {
    id: 12565,
    terms: [
      "plot twist",
      "twist ending",
      "surprise ending",
      "shocking ending",
      "unexpected twist",
      "twist",
      "secret",
      "secrets",
      "truth",
      "deception",
      "betrayal",
      "conspiracy",
    ],
  },
  "mind bending": {
    id: 10683,
    terms: [
      "mind bending",
      "mind-bending",
      "psychological",
      "mind game",
      "puzzle",
      "paradox",
      "dimension",
      "dimensions",
      "reality",
      "simulation",
      "matrix",
      "subconscious",
      "dream",
      "dreams",
      "memory",
      "memories",
      "illusion",
      "quantum",
      "time loop",
      "wormhole",
      "space-time",
      "hallucination",
      "investigation",
    ],
  },
  sitcom: {
    id: 35,
    terms: ["sitcom", "sit-com", "situational comedy", "sitcoms"],
  },
  "dark comedy": {
    id: 9716,
    terms: ["dark comedy", "black comedy", "morbid humor"],
  },
  parody: { id: 9717, terms: ["parody", "spoof", "satire", "gag"] },
  "time travel": {
    id: 4379,
    terms: ["time travel", "timeline", "time loop", "wormhole"],
  },
  dystopia: { id: 4565, terms: ["dystopia", "dystopian", "post-apocalyptic"] },
  superhero: {
    id: 9715,
    terms: [
      "superhero",
      "super power",
      "superheroes",
      "comic book",
      "marvel",
      "dc",
    ],
  },
};

// 3. ربط التصنيفات النصية بأكواد TMDB الرسمية
export const TMDB_GENRE_IDS = {
  movie: {
    action: 28,
    scifi: 878,
    horror: 27,
    comedy: 35,
    drama: 18,
    mystery: 9648,
    romance: 10749,
    fantasy: 14,
    crime: 80,
    thriller: 53,
    tv_movie: 10770,
  },
  tv: {
    action: 10759,
    scifi: 10765,
    horror: 27,
    comedy: 35,
    drama: 18,
    mystery: 9648,
    romance: 35,
    fantasy: 10765,
    crime: 80,
  },
};

export class CindromeEngine {
  static parseQuery(text, selectedType = "mixed") {
    const lowerText = text.toLowerCase().trim();

    if (/[\u0600-\u06FF]/.test(text)) {
      return {
        isValid: false,
        message:
          "Currently, Drome AI is optimized for English. Please write your request in English (e.g., 'Mind-bending sci-fi with a plot twist').",
      };
    }

    const withoutDrama = /\b(without\s+(?:any\s+)?drama|no\s+drama)\b/i.test(
      lowerText,
    );
    const isPure =
      /\b(pure|strictly|only|just|100%|nothing but)\b/i.test(lowerText) ||
      withoutDrama;

    let detectedGenres = [];
    for (const [genre, keywords] of Object.entries(genreMap)) {
      if (
        keywords.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lowerText))
      ) {
        if (!detectedGenres.includes(genre)) detectedGenres.push(genre);
      }
    }

    if (withoutDrama) {
      detectedGenres = detectedGenres.filter((g) => g !== "drama");
    }

    let detectedKeywords = [];
    for (const [theme, data] of Object.entries(themeKeywords)) {
      if (data.terms.some((t) => lowerText.includes(t))) {
        detectedKeywords.push({ name: theme, id: data.id });
      }
    }

    const wantsClassic =
      /\b(classic|retro|old|80s|90s|vintage|nostalgic)\b/i.test(lowerText);

    let targetType = selectedType;
    if (selectedType === "mixed") {
      if (/\b(anime|manga)\b/i.test(lowerText)) targetType = "anime";
      else if (/\b(movie|movies|film|films)\b/i.test(lowerText))
        targetType = "movie";
      else if (/\b(series|show|shows|tv|sitcom)\b/i.test(lowerText))
        targetType = "tv";
    }

    const refPatterns = [
      /\b(?:like|liked|loved|enjoyed|similar to|after|such as|vibe of)\s+([a-zA-Z0-9\s:.'-]+)/i,
      /\b(?:watched|finished)\s+([a-zA-Z0-9\s:.'-]+)\s+(?:and want|recommend)/i,
    ];
    let extractedReferenceTitle = null;
    for (const pattern of refPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        extractedReferenceTitle = match[1].trim();
        break;
      }
    }

    const isAmbiguous =
      detectedGenres.length === 0 &&
      detectedKeywords.length === 0 &&
      !extractedReferenceTitle &&
      lowerText.split(" ").length > 3;

    return {
      isValid: true,
      isAmbiguous,
      targetType,
      detectedGenres,
      detectedKeywords,
      isPure,
      withoutDrama,
      wantsClassic,
      extractedReferenceTitle,
      originalText: text,
    };
  }

  static scoreAndRank(
    candidates,
    parsedIntent,
    userProfileStats = {},
    anchorTitle = null,
    userReviewsCount = 0,
  ) {
    return candidates
      .map((item) => {
        let s_intent = 0;
        let s_user = 50;
        let s_rating = (item.vote_average || 0) * 10;
        let penalties = 0;

        const itemTitle = (item.title || item.name || "").toLowerCase();
        const itemOverview = (item.overview || "").toLowerCase();
        const itemGenres = (item.genres || []).map((g) => g.toLowerCase());
        const itemGenreIds = item.genre_ids || [];

        const releaseDate = item.release_date || item.first_air_date || "";
        const releaseYear = releaseDate
          ? parseInt(releaseDate.split("-")[0], 10)
          : 0;

        // 1. حساب S_intent بناءً على تطابق التصنيف
        const lookupType = item.media_type === "movie" ? "movie" : "tv";
        const genreIdLookup =
          TMDB_GENRE_IDS[lookupType] || TMDB_GENRE_IDS.movie;

        if (parsedIntent.detectedGenres.length > 0) {
          const genreScores = parsedIntent.detectedGenres.map((genre) => {
            const expectedId = genreIdLookup[genre];
            if (itemGenreIds.length > 0 && itemGenreIds[0] === expectedId)
              return 100;
            if (
              itemGenreIds.includes(expectedId) ||
              itemGenres.some((g) => g.includes(genre))
            )
              return 70;
            if (itemOverview.includes(genre)) return 30;
            return 0;
          });

          const maxGenreScore = Math.max(...genreScores);
          const additionalMatches = genreScores.filter((s) => s > 0).length - 1;
          s_intent = Math.min(
            100,
            maxGenreScore +
              (additionalMatches > 0 ? additionalMatches * 15 : 0),
          );
        } else {
          s_intent = 60;
        }

        // بونص الكلمات المفتاحية الثيماتية
        const hasComplexThemes = parsedIntent.detectedKeywords.some(
          (k) => k.name === "mind bending" || k.name === "plot twist",
        );
        if (hasComplexThemes) {
          const psychologicalRegex =
            /\b(subconscious|dream|dreams|reality|simulation|matrix|wormhole|time travel|time loop|timeline|paradox|dimension|dimensions|puzzle|secrets|secret|truth|conspiracy|investigation|psychological|illusion|hallucination|quantum|space-time|mind|twist|memory|memories|espionage)\b/i;
          if (
            psychologicalRegex.test(itemOverview) ||
            psychologicalRegex.test(itemTitle)
          ) {
            s_intent = Math.min(100, s_intent + 40);
          }
        }

        // 🌟 بونص سينما الفضاء والخيال العلمي الفلسفي العميق (Arrival, Contact, Gravity, Interstellar)
        const isSciFiContext =
          parsedIntent.detectedGenres.includes("scifi") ||
          (anchorTitle &&
            /interstellar|arrival|contact|2001/i.test(anchorTitle));
        if (isSciFiContext) {
          const deepSpaceRegex =
            /\b(deep space|black hole|wormhole|space exploration|astronaut|astronauts|nasa|extraterrestrial|first contact|relativity|quantum|cosmos|cosmic|spacecraft|orbit|gravity|astrophysics|space mission|space flight)\b/i;
          if (
            deepSpaceRegex.test(itemOverview) ||
            deepSpaceRegex.test(itemTitle)
          ) {
            s_intent = Math.min(100, s_intent + 35);
          }
        }

        // بونص السيتكوم الخالص (+35)
        const wantsSitcom =
          parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
          /\b(sitcom|sit-com|sitcoms)\b/i.test(parsedIntent.originalText);
        const isSitcomContent =
          /\b(sitcom|sit-com|situational comedy)\b/i.test(itemOverview) ||
          /\b(sitcom|sit-com)\b/i.test(itemTitle);

        if (
          wantsSitcom &&
          (isSitcomContent ||
            (item.media_type === "tv" && itemGenreIds[0] === 35))
        ) {
          s_intent = Math.min(100, s_intent + 35);
        }

        // 2. حساب تفضيل المستخدم الشخصي من جدول reviews
        if (
          userReviewsCount >= 5 &&
          userProfileStats &&
          Object.keys(userProfileStats).length > 0
        ) {
          let userTotal = 0;
          let matched = 0;
          itemGenres.forEach((g) => {
            if (userProfileStats[g]) {
              userTotal += (userProfileStats[g] / 10) * 100;
              matched++;
            }
          });
          if (matched > 0) s_user = userTotal / matched;
        }

        // 3. الفلترة الصارمة والخصومات (Penalties System)

        // 🌟 أ. فلترة الـ TV Movies والحلقات الخاصة عند اختيار قسم الأفلام (-60)
        const isMovieSearch =
          parsedIntent.targetType === "movie" || item.media_type === "movie";
        const isTvMovieOrSpecial =
          itemGenreIds.includes(10770) ||
          /\b(doctor who|tv special|special episode|christmas special|holiday special|made-for-tv)\b/i.test(
            itemTitle,
          ) ||
          /\b(doctor who|tardis|time lord)\b/i.test(itemOverview);
        if (isMovieSearch && isTvMovieOrSpecial) {
          penalties += 60; // طرد Doctor Who وأفلام التلفزيون العابرة فوراً
        }

        // ب. استبعاد أفلام ومسلسلات السوبر هيرو (-80) ما لم يطلبها المستخدم صراحة
        const wantsSuperhero =
          parsedIntent.detectedKeywords.some((k) => k.name === "superhero") ||
          /\b(superhero|superheroes|marvel|dc comics|avengers)\b/i.test(
            parsedIntent.originalText,
          );

        const isSuperhero =
          /\b(superhero|superheroes|avengers|marvel|dc comics|batman|superman|iron man|thor|guardians of the galaxy|captain america|spider-man|infinity war|endgame|thanos|infinity stones|justice league)\b/i.test(
            itemOverview,
          ) ||
          /\b(avengers|guardians of the galaxy|batman|superman|iron man|thor|spider-man|captain america|justice league)\b/i.test(
            itemTitle,
          );

        if (!wantsSuperhero && isSuperhero) {
          penalties += 80;
        }

        // ج. الفلترة الصارمة للكوميديا الخالصة (Pure Sitcom & No Drama)
        const wantsNoDrama =
          parsedIntent.withoutDrama ||
          (parsedIntent.detectedGenres.includes("comedy") &&
            parsedIntent.isPure &&
            !parsedIntent.detectedGenres.includes("drama"));
        if (wantsNoDrama && parsedIntent.detectedGenres.includes("comedy")) {
          const hasDrama = itemGenreIds.includes(18);
          const isComedyPrimary =
            itemGenreIds.length > 0 && itemGenreIds[0] === 35;

          if (hasDrama && !isComedyPrimary) {
            penalties += 85;
          }

          const isDysfunctionalOrMelodrama =
            /\b(poverty|addiction|alcoholic|alcoholism|dysfunctional|rehab|drug addict|substance abuse|teen drama|telenovela|melodrama|delinquent|juvenile|cartel|bipolar)\b/i.test(
              itemOverview,
            ) || /\b(shameless|rebelde)\b/i.test(itemTitle);
          if (isDysfunctionalOrMelodrama) {
            penalties += 60;
          }
        } else if (
          parsedIntent.detectedGenres.includes("comedy") &&
          !parsedIntent.detectedGenres.includes("drama")
        ) {
          const hasDrama = itemGenreIds.includes(18);
          const isComedyPrimary =
            itemGenreIds.length > 0 && itemGenreIds[0] === 35;
          if (hasDrama && !isComedyPrimary) {
            penalties += 70;
          }
        }

        // د. خصم مسلسلات المراهقين عند طلب Sitcom صريح
        if (wantsSitcom) {
          const isTeenOrHeavyRomance =
            /\b(high school|teenagers?|sex clinic|sex therapy|adolescence|coming-of-age|teen drama)\b/i.test(
              itemOverview,
            ) || /\b(sex education)\b/i.test(itemTitle);
          if (isTeenOrHeavyRomance) {
            penalties += 45;
          }
        }

        // هـ. تعارض الكوميديا مع الإثارة والرعب والجرائم
        const isDarkOrThriller =
          itemGenreIds.includes(53) ||
          itemGenreIds.includes(80) ||
          itemGenreIds.includes(27);
        const userWantedDark =
          parsedIntent.detectedKeywords.some((k) => k.name === "dark comedy") ||
          parsedIntent.detectedGenres.includes("horror") ||
          parsedIntent.detectedGenres.includes("mystery");
        if (
          parsedIntent.detectedGenres.includes("comedy") &&
          isDarkOrThriller &&
          !userWantedDark
        ) {
          penalties += 50;
        }

        // و. خصم الفانتازيا عند طلب الخيال العلمي فقط
        const isSciFiOnly =
          parsedIntent.detectedGenres.includes("scifi") &&
          !parsedIntent.detectedGenres.includes("fantasy");
        if (isSciFiOnly) {
          if (itemGenreIds.includes(14)) {
            penalties += 80;
          }

          const hasMedievalFantasy =
            /\b(throne|thrones|dragon|dragons|medieval|kingdom|kingdoms|westeros|swords|knights|castle|castles|empire|dynasty|reign)\b/i.test(
              itemOverview,
            ) ||
            /\b(throne|thrones|dragon|dragons|medieval|kingdom|kingdoms)\b/i.test(
              itemTitle,
            );
          if (hasMedievalFantasy) {
            penalties += 50;
            if (item.media_type === "tv" || itemGenreIds.includes(10765)) {
              penalties += 50;
            }
          }

          const hasSupernatural =
            /\b(ghost|ghosts|spirit|spirits|reincarnation|afterlife|magic|magical|wizard|sorcerer|sorcery|witch|witches|witchcraft|vampire|vampires|werewolf|werewolves|demon|demons|curse|cursed)\b/i.test(
              itemOverview,
            ) || /\b(hotel del luna|teen wolf|supernatural)\b/i.test(itemTitle);
          if (hasSupernatural) {
            penalties += 80;
          }
        }

        // ز. استبعاد الكوميديا عند طلب الرعب الخالص (Pure Horror)
        if (
          parsedIntent.detectedGenres.includes("horror") &&
          parsedIntent.isPure
        ) {
          if (itemGenreIds.includes(35)) {
            penalties += 80;
          }
        }

        // ح. خصم الأجزاء المباشرة لنفس السلسلة المرجعية (Franchise Filter)
        if (anchorTitle) {
          const cleanAnchor = anchorTitle
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
          const cleanItem = itemTitle.replace(/[^a-z0-9]/g, "");
          if (
            cleanItem.includes(cleanAnchor) ||
            cleanAnchor.includes(cleanItem)
          ) {
            penalties += 120;
          }
        }

        // 4. تطبيق نظام الأوزان الديناميكي
        let rawScore = 0;
        if (userReviewsCount < 5) {
          rawScore = 0.6 * s_intent + 0.4 * s_rating;
        } else {
          rawScore = 0.4 * s_intent + 0.35 * s_user + 0.25 * s_rating;
        }

        // 5. موازنة الحداثة الخفيفة (+8)
        let recencyBonus = 0;
        if (!parsedIntent.wantsClassic && releaseYear >= 2000) {
          recencyBonus = 8;
        }

        const finalScore = Math.max(0, rawScore + recencyBonus - penalties);

        return {
          ...item,
          breakdown: { s_intent, s_user, s_rating, penalties, recencyBonus },
          finalScore,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  static generateResponseText(
    parsedIntent,
    resultsCount,
    isColdStart = false,
    anchorTitle = null,
  ) {
    const genreStr =
      parsedIntent.detectedGenres.length > 0
        ? parsedIntent.detectedGenres.join(" and ")
        : "top";
    const typeStr =
      parsedIntent.targetType === "mixed"
        ? "titles"
        : parsedIntent.targetType === "tv"
          ? "series"
          : parsedIntent.targetType;

    if (isColdStart) {
      return `I see your watch history for ${typeStr} is still brand new! To help me tailor my recommendations, what is a specific ${typeStr} that you consider a masterpiece or always love watching?`;
    }

    if (resultsCount === 0) {
      return `I searched my database with those specific constraints, but couldn't find a strong match. Try broadening your request or naming a favorite title!`;
    }

    if (anchorTitle) {
      const toneName =
        parsedIntent.detectedGenres.length > 0
          ? parsedIntent.detectedGenres[0]
          : "cinematic";
      return `Great pick with "${anchorTitle}"! I've filtered out direct sequels and matched its exact ${toneName} tone and pacing. Here are my top recommendations for you:`;
    }

    const successPrompts = [
      `Based on your request for ${genreStr} ${typeStr}, and factoring in your preferences, here are the top-rated recommendations:`,
      `Here are some top-tier ${genreStr} ${typeStr} that match your requested tone and focus:`,
      `I've analyzed titles matching your search for ${genreStr} ${typeStr} and ranked these as your best matches:`,
    ];
    return successPrompts[Math.floor(Math.random() * successPrompts.length)];
  }
}

export default CindromeEngine;
