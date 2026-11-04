// services/cindromeEngine.js

// 1. قاموس استخراج النوايا الدلالية العامة (NLU) مع دعم قصص الصعود والتحدي
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
  ],
  animation: [
    "animation",
    "animated",
    "cartoon",
    "cartoons",
    "pixar",
    "disney",
    "dreamworks",
    "illumination",
  ],
  family: [
    "family",
    "family movie",
    "family-friendly",
    "cozy family",
    "kids",
    "children",
    "wholesome",
    "all ages",
    "for kids",
  ],
  war: [
    "war",
    "world war",
    "wwii",
    "ww2",
    "wwi",
    "battle",
    "battles",
    "soldier",
    "soldiers",
    "combat",
    "military",
    "army",
    "crusade",
    "trenches",
    "warfare",
    "historical war",
  ],
  history: [
    "history",
    "historical",
    "period piece",
    "ancient",
    "medieval",
    "dynasty",
    "century",
    "empire",
    "gladiator",
    "kingdom",
    "historical epic",
  ],
  documentary: [
    "documentary",
    "docuseries",
    "docu-series",
    "true crime",
    "real mysteries",
    "real mystery",
    "investigative documentary",
    "crime doc",
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
    "dystopia",
    "cyberpunk",
    "robots",
    "robot",
    "android",
    "androids",
    "neon",
    "neon lights",
    "ruined future",
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
    "light",
    "chill",
    "comfort",
    "feel-good",
    "relaxing",
    "easy watch",
    "need a laugh",
    "unwind",
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
    "k-drama",
    "kdrama",
    "inspirational",
    "triumph",
    "perseverance",
  ],
  mystery: [
    "mystery",
    "plot twist",
    "plot twists",
    "twist",
    "twists",
    "cant predict",
    "can't predict",
    "unpredictable",
    "mind blowing",
    "mind-blowing",
    "suspense",
    "puzzle",
    "detective",
    "thriller",
    "psychological thriller",
    "investigation",
    "mind-bending",
  ],
  crime: [
    "crime",
    "heist",
    "bank heist",
    "robbery",
    "bank robbery",
    "plan a robbery",
    "clever heist",
    "organized crime",
    "mafia",
    "gangster",
    "gangsters",
    "mob",
    "mobster",
    "mobsters",
    "criminals",
    "criminal",
    "cartel",
    "syndicate",
    "underworld",
    "money laundering",
  ],
  romance: [
    "romance",
    "love",
    "romantic",
    "relationship",
    "dating",
    "couple",
    "crush",
    "sweet",
    "rom-com",
    "romcom",
    "romantic comedy",
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
    "boxer",
    "tournament",
    "athlete",
    "athletics",
    "championship",
    "champion",
    "coach",
    "baseball",
    "tennis",
    "racing",
    "racer",
    "f1",
    "formula 1",
    "olympics",
    "mma",
    "wrestling",
    "wrestler",
    "swimming",
    "swimmer",
    "underdog athlete",
  ],
};

// 2. معجم الكلمات المفتاحية بالمعرّفات الرسمية في TMDB
export const themeKeywords = {
  // 🌟 معجم قصص الصعود من الصفر والتحدي والنجاح (Underdog / Rags to Riches)
  underdog: {
    id: "9882|10714|1803",
    terms: [
      "starting from zero",
      "start from zero",
      "starting from nothing",
      "start from nothing",
      "from zero",
      "rags to riches",
      "underdog",
      "underdog story",
      "success story",
      "winning against all odds",
      "against all odds",
      "zero to hero",
      "overcoming odds",
      "triumph",
      "rise to the top",
      "self made",
      "self-made",
      "hard work pays off",
    ],
  },
  "plot twist": {
    id: "12565|9715|11160|10714|9882",
    terms: [
      "plot twist",
      "plot twists",
      "twist",
      "twists",
      "cant predict",
      "can't predict",
      "unpredictable",
      "unpredictable twist",
      "unpredictable twists",
      "mind blowing",
      "mind-blowing",
      "mind blowing twists",
      "mind-blowing twists",
      "twist ending",
      "surprise ending",
      "shocking ending",
      "unexpected twist",
      "crazy plot twist",
      "crazy plot twists",
      "twists and turns",
      "mind game",
      "mind games",
      "secret",
      "secrets",
      "truth",
      "deception",
      "betrayal",
      "conspiracy",
    ],
  },
  heist: {
    id: "10051|6492|10292",
    terms: [
      "heist",
      "bank heist",
      "clever heist",
      "robbery",
      "bank robbery",
      "plan a robbery",
      "plan a heist",
      "plan a big robbery",
      "big robbery",
      "big heist",
      "steal money",
      "caper",
      "vault",
      "safecracker",
      "getaway driver",
    ],
  },
  "organized crime": {
    id: "10391|242",
    terms: [
      "organized crime",
      "mafia",
      "mob",
      "mobster",
      "mobsters",
      "gangster",
      "gangsters",
      "crime syndicate",
      "crime family",
      "underworld",
      "godfather",
      "cartel",
    ],
  },
  cyberpunk: {
    id: "12190|4565|2853|156395",
    terms: [
      "cyberpunk",
      "cyber-punk",
      "dark futuristic",
      "dystopian",
      "dystopia",
      "futuristic city",
      "android",
      "androids",
      "cyborg",
      "cyborgs",
      "robot",
      "robots",
      "neon lights",
      "neon light",
      "neon",
      "ruined future",
      "dystopian world",
      "cyberpunk city",
      "high-tech low-life",
      "artificial intelligence",
    ],
  },
  "philosophical sci-fi": {
    id: "10090|310|156395",
    terms: [
      "think about life",
      "philosophical",
      "existential",
      "meaning of life",
      "human condition",
      "human existence",
      "ponder",
      "deep sci-fi",
      "cosmic perspective",
      "space and life",
    ],
  },
  "family animation": {
    id: "16,10751",
    terms: [
      "animated family movie",
      "family animation",
      "animated family",
      "cozy movie night",
      "cozy family",
      "fun animated",
      "family movie",
    ],
  },
  "true crime": {
    id: "10714|9882|10303",
    terms: [
      "true crime",
      "docuseries",
      "docu-series",
      "documentary series",
      "real mysteries",
      "real mystery",
      "unsolved mysteries",
      "crime doc",
      "crime documentary",
      "real life mystery",
      "serial killer documentary",
    ],
  },
  "historical war": {
    id: "11162|233|210103",
    terms: [
      "historical war",
      "war movie",
      "war movies",
      "huge battles",
      "epic battles",
      "historical epic",
      "epic battle",
      "epic war",
      "ancient war",
      "medieval war",
      "world war",
      "medieval battle",
      "crusades",
      "gladiators",
    ],
  },
  "mind bending": {
    id: 9663,
    terms: [
      "mind bending",
      "mind-bending",
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
    ],
  },
  "psychological thriller": {
    id: 10714,
    terms: [
      "psychological thriller",
      "mess with my head",
      "mindfuck",
      "mind game",
      "mind games",
      "psychological",
      "sanity",
      "insanity",
      "paranoia",
      "unreliable narrator",
      "mental breakdown",
    ],
  },
  sitcom: {
    id: 35,
    terms: [
      "sitcom",
      "sit-com",
      "situational comedy",
      "sitcoms",
      "comfort show",
      "comfort series",
      "comfort watch",
      "chill comedy",
      "light comedy",
    ],
  },
  "dark comedy": {
    id: 9716,
    terms: ["dark comedy", "black comedy", "morbid humor"],
  },
  parody: { id: 9717, terms: ["parody", "spoof", "satire", "gag"] },
  "time travel": {
    id: 4379,
    terms: [
      "time travel",
      "time-travel",
      "timeline",
      "timelines",
      "time loop",
      "time-loop",
      "wormhole",
      "temporal",
      "time machine",
      "back in time",
    ],
  },
  dystopia: {
    id: 4565,
    terms: ["dystopia", "dystopian", "post-apocalyptic"],
  },
  superhero: {
    id: 9715,
    terms: [
      "superhero",
      "superheroes",
      "super hero",
      "super heroes",
      "super power",
      "super powers",
      "superhuman",
      "comic book",
      "comic books",
      "marvel",
      "dc",
      "mcu",
      "dceu",
    ],
  },
  racing: {
    id: 830,
    terms: [
      "racing",
      "racer",
      "car race",
      "street racing",
      "motorsport",
      "formula 1",
      "f1",
      "nascar",
      "rally",
      "grand prix",
      "speedway",
      "le mans",
    ],
  },
  boxing: {
    id: 207268,
    terms: [
      "boxing",
      "boxer",
      "heavyweight",
      "sparring",
      "prizefighter",
      "prize fight",
    ],
  },
  football: {
    id: "9937|11100",
    terms: [
      "football",
      "soccer",
      "fifa",
      "premier league",
      "champions league",
      "world cup",
      "nfl",
      "super bowl",
      "quarterback",
      "touchdown",
      "gridiron",
    ],
  },
  basketball: {
    id: 6078,
    terms: ["basketball", "nba", "dunk", "hoops"],
  },
  magic: {
    id: "2343|9799",
    terms: [
      "magic",
      "magical",
      "magic system",
      "sorcery",
      "sorcerer",
      "sorceress",
      "witch",
      "witches",
      "witchcraft",
      "wizard",
      "wizards",
      "mage",
      "mages",
      "spell",
      "spells",
      "alchemy",
      "alchemist",
      "grimoire",
    ],
  },
  "rom-com": {
    id: "9799|158718|3133",
    terms: [
      "romantic comedy",
      "rom-com",
      "romcom",
      "sweet romance",
      "sweet romantic comedy",
      "light romantic comedy",
      "feel-good",
      "feel good",
      "lift my mood",
      "sweet and light",
    ],
  },
};

export const TMDB_THEME_IDS = {
  sports: 6075,
  racing: 830,
  boxing: 207268,
  football: "9937|11100",
  basketball: 6078,
  superhero: 9715,
  timeTravel: 4379,
  plotTwist: "12565|9715|11160|10714|9882",
  mindBending: 9663,
  psychologicalThriller: "10714|12565|9663",
  magic: "2343|9799",
  romcom: "9799|158718|3133",
  heist: "10051|6492|10292",
  organizedCrime: "10391|242",
  crimeHeist: "10051|6492|10292|10391|242",
  historicalWar: "11162|233|210103",
  trueCrime: "10714|9882|10303",
  documentary: 99,
  familyAnimation: "16,10751",
  animeKeyword: 210024,
  cyberpunk: "12190|4565|2853|156395",
  philosophicalSciFi: "10090|310|156395",
  underdog: "9882|10714|1803",
  survival: 10085,
};

export const TMDB_GENRE_IDS = {
  movie: {
    action: 28,
    war: 10752,
    history: 36,
    documentary: 99,
    animation: 16,
    family: 10751,
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
    war: 10768,
    history: 36,
    documentary: 99,
    animation: 16,
    family: 10751,
    kids: 10762,
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

    const isTiredMood =
      /\b(tired|im tired|i'm tired|exhausted|long day|after a long day|stress|stressed|rough day|bad day|hard day|unwind|burnout|need a laugh|heavy day)\b/i.test(
        lowerText,
      );

    const withoutDrama =
      /\b(without\s+(?:any\s+)?drama|no\s+drama)\b/i.test(lowerText) ||
      isTiredMood;

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
      if (
        data.terms.some((t) => new RegExp(`\\b${t}\\b`, "i").test(lowerText))
      ) {
        detectedKeywords.push({ name: theme, id: data.id });
      }
    }

    const wantsClassic =
      /\b(classic|retro|old|80s|90s|vintage|nostalgic)\b/i.test(lowerText);

    const isHorrorNight =
      /\b(movie night|with friends|party|friends|sleepover|crowd|popcorn)\b/i.test(
        lowerText,
      ) &&
      (detectedGenres.includes("horror") ||
        /\b(horror|scary|spooky)\b/i.test(lowerText));

    const isPsychologicalThriller =
      detectedKeywords.some((k) => k.name === "psychological thriller") ||
      /\b(psychological thriller|mess with my head|mindfuck|mind game|mind games|sanity|paranoia|unreliable narrator)\b/i.test(
        lowerText,
      );

    const isRomCom =
      detectedKeywords.some((k) => k.name === "rom-com") ||
      /\b(rom-com|romcom|romantic comedy|sweet.*romance|light.*romance|lift my mood|feel[- ]good)\b/i.test(
        lowerText,
      ) ||
      (/\b(sweet|light|chill|comfort)\b/i.test(lowerText) &&
        (detectedGenres.includes("romance") ||
          /\b(romance|romantic)\b/i.test(lowerText)));

    if (isRomCom) {
      if (!detectedGenres.includes("comedy")) detectedGenres.push("comedy");
      if (!detectedGenres.includes("romance")) detectedGenres.push("romance");
    }

    const isHistoricalWar =
      detectedKeywords.some((k) => k.name === "historical war") ||
      /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war|ancient war|medieval war|world war|ancient warfare|medieval battle)\b/i.test(
        lowerText,
      ) ||
      (/\b(battle|battles|war|military|army|soldiers?)\b/i.test(lowerText) &&
        /\b(historical|epic|history|ancient|medieval|period)\b/i.test(
          lowerText,
        ));

    if (isHistoricalWar) {
      if (!detectedGenres.includes("war")) detectedGenres.push("war");
      if (!detectedGenres.includes("history")) detectedGenres.push("history");
      detectedGenres = detectedGenres.filter((g) => g !== "action");
    }

    const isTrueCrimeDoc =
      detectedKeywords.some((k) => k.name === "true crime") ||
      /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|crime documentary|unsolved mysteries)\b/i.test(
        lowerText,
      ) ||
      (/\b(documentary|docuseries)\b/i.test(lowerText) &&
        /\b(crime|murder|killer|mystery|mysteries)\b/i.test(lowerText));

    if (isTrueCrimeDoc) {
      if (!detectedGenres.includes("documentary"))
        detectedGenres.push("documentary");
      detectedGenres = detectedGenres.filter((g) => g !== "crime");
    }

    const isKorean =
      /\b(korean|k-drama|kdrama|k drama|south korea|korea)\b/i.test(lowerText);

    const hasTwistKeywords =
      detectedKeywords.some((k) => k.name === "plot twist") ||
      /\b(plot twists?|twists?|can'?t predict|unpredictable|mind[- ]blowing|mind[- ]bending|twist ending)\b/i.test(
        lowerText,
      );

    if (hasTwistKeywords && !detectedGenres.includes("mystery")) {
      detectedGenres.push("mystery");
    }

    // 🌟 رصد نية الصعود من الصفر والتحدي والنجاح (Underdog / Rags to Riches)
    const isUnderdog =
      detectedKeywords.some((k) => k.name === "underdog") ||
      /\b(starting from zero|start from zero|starting from nothing|from zero|rags to riches|underdog(?: story)?|success story|winning against all odds|against all odds|zero to hero|rise to the top|overcoming odds)\b/i.test(
        lowerText,
      );

    if (isUnderdog && !detectedGenres.includes("drama")) {
      detectedGenres.push("drama");
    }

    const isFamilyAnimation =
      detectedKeywords.some((k) => k.name === "family animation") ||
      (detectedGenres.includes("animation") &&
        detectedGenres.includes("family")) ||
      (/\b(animated|animation|cartoon)\b/i.test(lowerText) &&
        /\b(family|kids|children|wholesome|cozy|for the whole family)\b/i.test(
          lowerText,
        ));

    if (isFamilyAnimation) {
      if (!detectedGenres.includes("animation"))
        detectedGenres.push("animation");
      if (!detectedGenres.includes("family")) detectedGenres.push("family");
    }

    const isCyberpunk =
      detectedKeywords.some(
        (k) => k.name === "cyberpunk" || k.name === "dystopia",
      ) ||
      /\b(cyberpunk|cyber-punk|dystopian?|dystopia|dark futuristic|futuristic city|androids?|cyborgs?|robots?|neon lights?|ruined future|dystopian world|cyberpunk city)\b/i.test(
        lowerText,
      );

    if (isCyberpunk) {
      if (!detectedGenres.includes("scifi")) detectedGenres.push("scifi");
    }

    const isPhilosophicalSciFi =
      !isCyberpunk &&
      (detectedKeywords.some((k) => k.name === "philosophical sci-fi") ||
        (/\b(think about life|philosophical|existential|meaning of life|human condition|human existence|ponder|deep sci-fi|cosmic perspective)\b/i.test(
          lowerText,
        ) &&
          (detectedGenres.includes("scifi") ||
            /\b(space|universe|cosmos|sci-fi|stars|astronaut)\b/i.test(
              lowerText,
            ))));

    if (isPhilosophicalSciFi) {
      if (!detectedGenres.includes("scifi")) detectedGenres.push("scifi");
      if (!detectedGenres.includes("drama")) detectedGenres.push("drama");
    }

    const wantsComedy =
      detectedGenres.includes("comedy") ||
      /\b(funny|laugh|comedy|hilarious|humor|chuckle)\b/i.test(lowerText);

    const isComfortComedy =
      (isTiredMood && wantsComedy) ||
      /\b(something funny|just.*funny|comfort comedy|chill comedy|pure comedy)\b/i.test(
        lowerText,
      );

    if (isComfortComedy && !detectedGenres.includes("comedy")) {
      detectedGenres.push("comedy");
    }

    const isHeistRobbery =
      detectedKeywords.some((k) => k.name === "heist") ||
      /\b(plan (?:a )?robbery|big robbery|bank robbery|robbery|heist|bank heist|big heist|steal money|caper|vault|safecracker|steal a fortune|heist movie)\b/i.test(
        lowerText,
      );

    const isCrimeHeist =
      !isTrueCrimeDoc &&
      (isHeistRobbery ||
        detectedGenres.includes("crime") ||
        detectedKeywords.some((k) => k.name === "organized crime") ||
        /\b(organized crime|mafia|gangster|mobster|mobsters|crime syndicate|underworld|cartel)\b/i.test(
          lowerText,
        ));

    if (isHeistRobbery && !detectedGenres.includes("crime")) {
      detectedGenres.push("crime");
    }

    // 🌟 معالجة التعارض بين النص والـ selectedType في القائمة
    const hasExplicitMovie = /\b(movie|movies|film|films)\b/i.test(lowerText);
    const hasExplicitSeries =
      /\b(series|show|shows|tv|sitcom|docuseries|docu-series|k-drama|kdrama)\b/i.test(
        lowerText,
      );

    let targetType = selectedType;
    if (selectedType === "mixed") {
      if (/\b(anime|manga)\b/i.test(lowerText)) targetType = "anime";
      else if (hasExplicitMovie && !hasExplicitSeries) targetType = "movie";
      else if (hasExplicitSeries && !hasExplicitMovie) targetType = "tv";
    } else if (
      selectedType === "tv" &&
      hasExplicitMovie &&
      !hasExplicitSeries
    ) {
      // المستخدم اختار TV لكن البرومبت يطلب صراحة فيلم (a movie about...)
      targetType = "movie";
    } else if (
      selectedType === "movie" &&
      hasExplicitSeries &&
      !hasExplicitMovie
    ) {
      // المستخدم اختار Movie لكن البرومبت يطلب صراحة مسلسل
      targetType = "tv";
    }

    const refPatterns = [
      /\b(?:like|liked|loved|enjoyed|similar to|such as|vibe of)\s+([a-zA-Z0-9'.-]+(?:\s+[a-zA-Z0-9'.-]+){0,3}?)(?=\s+(?:to|for|with|and|or|after|but|because|so|in|on|at|while|chill)\b|$)/i,
      /\b(?:watched|finished)\s+([a-zA-Z0-9\s:.'-]+)\s+(?:and want|recommend)/i,
      /\b(?:like|vibe of)\s+([a-zA-Z0-9\s:.'-]+)/i,
    ];
    let extractedReferenceTitle = null;
    for (const pattern of refPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        extractedReferenceTitle = match[1].trim();
        break;
      }
    }

    // 🌟 حماية تامة من السقوط في Fallback عند التعرف على أي نية محددة
    const hasSpecificIntent =
      detectedGenres.length > 0 ||
      detectedKeywords.length > 0 ||
      isKorean ||
      hasTwistKeywords ||
      isUnderdog ||
      isComfortComedy ||
      isHistoricalWar ||
      isTrueCrimeDoc ||
      isFamilyAnimation ||
      isCyberpunk ||
      isPhilosophicalSciFi ||
      isHeistRobbery;

    const isAmbiguous =
      !hasSpecificIntent &&
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
      isHorrorNight,
      isCrimeHeist,
      isHeistRobbery,
      isPsychologicalThriller,
      isRomCom,
      isHistoricalWar,
      isTrueCrimeDoc,
      isKorean,
      hasTwistKeywords,
      isUnderdog,
      isFamilyAnimation,
      isCyberpunk,
      isTiredMood,
      isComfortComedy,
      isPhilosophicalSciFi,
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
    const sportsRegex =
      /\b(sport|sports|football|soccer|basketball|baseball|tennis|athlete|athletics|coach|champion|championship|tournament|olympic|olympics|stadium|pitch|wrestler|wrestling|boxer|boxing|quarterback|touchdown|nfl|fifa|premier\s*league|world\s*cup|gridiron|super\s*bowl|underdog\s*athlete|nascar|formula\s*1|f1|motorsport|swimming|swimmer|grand\s*prix|le\s*mans|speedway)\b/i;

    const superheroRegex =
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|superpower|superpowers|super\s*human|mutant|mutants|marvel|dc\s*comics|comic\s*book|avengers|batman|superman|iron\s*man|thor|captain\s*america|spider[- ]man|spiderman|x-men|wolverine|deadpool|guardians\s*of\s*the\s*galaxy|justice\s*league|wonder\s*woman|flash|aquaman|black\s*panther|doctor\s*strange|thanos|infinity\s*war|endgame|gotham|dark\s*knight|man\s*of\s*steel|shazam|ant-man|daredevil|punisher|venom|hulk|peacemaker|the\s*boys|invincible|homelander|green\s*lantern|suicide\s*squad)\b/i;

    const timeTravelRegex =
      /\b(time travel|time-travel|time loop|time-loop|timelines?|space-time|wormhole|temporal|time machine|grandfather paradox|butterfly effect|quantum leap|alternate timeline|travel back in time|travel to the past|travel to the future|relativity|time dilation|delorean|marty mcfly|predestination|looper|twelve monkeys|tenet|donnie darko|coherence|primer|about time|butterfly effect|source code)\b/i;

    const twistRegex =
      /\b(plot twists?|twist ending|unexpected twist|shocking twist|crazy plot twists?|twists?|mind-bending|mind bending|secrets?|deception|conspiracy|illusion|simulation|reality|subconscious|hallucination|puzzle|mind game|unreliable narrator|amnesia|identity twist|double life|unpredictable|can'?t predict|mind[- ]blowing)\b/i;

    const explicitMagicRegex =
      /\b(magic|magical|sorcery|sorcerer|sorceress|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|grimoire|alchemist|alchemy|mana|caster|servant|holy grail|homunculus|magic user|black magic|arcane|necromancer|grimoires|magical girl|madoka|fate\/zero|overlord)\b/i;

    const nonMagicTitanOrNotebookRegex =
      /\b(titan|titans|colossal|survey corps|wall maria|eren yeager|death note|shinigami|light yagami|ryuk|notebook)\b/i;

    const crowdHorrorRegex =
      /\b(jump scare|slasher|paranormal|haunted house|demon|possession|curse|ghost|creature|cabin in the woods|killer|masked killer|evil dead|scream|insidious|talk to me|conjuring|quiet place|smile|sinister|it\b|m3gan|lights out|ouija|annabelle|nun|barbarian|terrifier|don't breathe|hereditary|black phone|get out|us\b|saw\b|final destination|cabin)\b/i;

    const iconicCrowdHorrorTitles =
      /\b(the conjuring|talk to me|scream|insidious|evil dead|a quiet place|smile|barbarian|sinister|it\b|don't breathe|the black phone|lights out|hereditary|m3gan|annabelle|the nun|terrifier|get out|us\b)\b/i;

    const explicitHeistRobberyRegex =
      /\b(heist|robbery|bank robbery|bank heist|plan a robbery|big robbery|vault|safe crack|safecracker|caper|getaway driver|steal money|ocean's eleven|ocean's twelve|ocean's thirteen|the town|baby driver|inside man|heat|the italian job|den of thieves|logan lucky|reservoir dogs|point break|now you see me|snatch|lock, stock|tower heist|the score|rififi|dog day afternoon|fast five|inception|money heist|armored)\b/i;

    const revengeOrPureMafiaRegex =
      /\b(equalizer|the equalizer|john wick|taken|revenge|vigilante|death wish|the irishman|goodfellas|casino|godfather|the godfather|mobster life|corleone|hitman|assassin|man on fire|law abiding citizen|sicario|peppermint|wrath of man)\b/i;

    const psychologicalMasterpiecesRegex =
      /\b(shutter island|fight club|prisoners|memento|se7en|seven|black swan|the prestige|zodiac|primal fear|the machinist|enemy|gone girl|the game|split|nightcrawler|the sixth sense|jacob's ladder|cure|identity|triangle|coherence|oldboy|mulholland drive|taxi driver|vertigo|misery|the silence of the lambs)\b/i;

    const psychologicalThemesRegex =
      /\b(psychological thriller|paranoia|delusion|sanity|insanity|hallucination|asylum|mental institution|amnesia|unreliable narrator|mind game|mind games|schizophrenia|obsession|psychosis|investigator|detective|dark secret|manipulation|gaslighting)\b/i;

    const slasherOrCheapHorrorRegex =
      /\b(slasher|masked killer|high school massacre|teen slasher|gorefest|chainsaw|splatter|cannibal|there's someone inside your house)\b/i;

    const feelGoodRomComRegex =
      /\b(romantic comedy|rom-com|romcom|feel-good|feel good|sweet|lighthearted|heartwarming|wedding|dating|fake dating|crush|falling in love|meet cute|matchmaker|vacation romance|love triangle|charming|crazy rich asians|about time|palm springs|set it up|the proposal|10 things i hate about you|clueless|notting hill|when harry met sally|how to lose a guy in 10 days|always be my maybe|50 first dates|hitch|crazy, stupid, love|friends with benefits|she's the man|easy a|to all the boys|pretty woman|mamma mia|legally blonde|love, simon|love simon|love, rosie|love rosie|anyone but you|the holiday|bridget jones|letters to juliet|27 dresses)\b/i;

    const tragicOrDepressingRomanceRegex =
      /\b(concentration camp|holocaust|world war|nazi|fascist|execution|terminal illness|cancer|dying|death|tragedy|tragic ending|bittersweet|melancholy|heartbreaking|depression|suicide|vietnam war|segregation|disability|life is beautiful|forrest gump|la la land|atonement|me before you|the fault in our stars|a walk to remember|brokeback mountain|requiem for a dream|titanic)\b/i;

    const darkOrExperimentalRomanceRegex =
      /\b(dark comedy|black comedy|morbid|surreal|surrealist|bizarre|experimental|arthouse|grotesque|frankenstein|reanimation|corpse|sex experiment|sexual awakening|fetish|prostitution|weird|quirky indie|yorgos lanthimos|wes anderson|poor things|the lobster|the favourite|moonrise kingdom|the grand budapest hotel|dogtooth|killing of a sacred deer|bones and all|beau is afraid)\b/i;

    const historicalWarRegex =
      /\b(war|world war|wwii|ww2|wwi|battle|battles|huge battles|epic battles|soldier|soldiers|army|infantry|combat|trenches|normandy|d-day|vietnam|crusade|crusades|crusaders|gladiator|gladiators|roman empire|medieval|kingdom|samurai|spartan|spartans|ancient warfare|saving private ryan|kingdom of heaven|braveheart|1917|dunkirk|hacksaw ridge|apocalypse now|platoon|full metal jacket|black hawk down|fury|the patriot|troy|300|master and commander|letters from iwo jima|bridge on the river kwai|all quiet on the western front|enemy at the gates|the bridge on the river kwai|paths of glory|the thin red line|midway|we were soldiers)\b/i;

    const trueCrimeDocRegex =
      /\b(documentary|docuseries|docu-series|true crime|investigative|real-life|archival|interviews?|unsolved mysteries|making a murderer|don't f\*\*k with cats|the jinx|night stalker|conversations with a killer|ted bundy|the staircase|wild wild country|keep sweet|tinder swindler|serial killer|homicide|cold case|forensic|fbi file|investigation discovery|murder trial|killer inside|evil genius|i am a killer|worst roommate ever)\b/i;

    const scienceNatureDocRegex =
      /\b(cosmos|astronomy|outer space|universe|planet earth|one strange rock|our planet|blue planet|wildlife|nature|animals?|ocean|oceans|earth|solar system|paleontology|dinosaur|climate|geology|evolution|space exploration|species|safari|national geographic|discovery channel|physics|quantum|biology)\b/i;

    const koreanTwistMasterpiecesRegex =
      /\b(signal|flower of evil|beyond evil|mouse|stranger|blind|tunnel|through the darkness|voice|save me|memorist|365: repeat the year|kairos|the guest|life on mars|nine: nine time travels|reset|the glory|extracurricular|squid game|mask girl)\b/i;

    const koreanThrillerThemesRegex =
      /\b(detective|police|serial killer|murder|investigation|corruption|revenge|conspiracy|crime syndicate|psychopath|unsolved case|prosecutor|courtroom|dark secret|suspense|thriller|mystery|hostage|twisted|plot twist|unpredictable)\b/i;

    const familyAnimationHitsRegex =
      /\b(coco|inside out|encanto|moana|zootopia|paddington|paddington 2|despicable me|toy story|finding nemo|finding dory|shrek|ratatouille|up\b|tangled|the incredibles|monsters, inc\.|monsters inc|how to train your dragon|frozen|sing\b|kung fu panda|madagascar|wall-e|spider-man: into the spider-verse|megamind|the lion king|beauty and the beast|aladdin|luca|soul\b|turning red|big hero 6|onward|tarzan|mulan)\b/i;

    const familyAnimationThemesRegex =
      /\b(family|friendship|heartwarming|wholesome|magical|cozy|adventure|parents|children|kids|journey|disney|pixar|dreamworks|illumination)\b/i;

    const cyberpunkHitsRegex =
      /\b(blade runner|blade runner 2049|ghost in the shell|akira|the matrix|dredd|upgrade|alita|alita: battle angel|cyberpunk|cyberpunk: edgerunners|robocop|total recall|minority report|altered carbon|ex machina|dark city|elysium|chappie|i am mother|i, robot|neuromancer|demolition man|johnny mnemonic|tron|tron: legacy|strange days|a\.i\. artificial intelligence|equilibrium|terminator|automata|district 9)\b/i;

    const cyberpunkThemesRegex =
      /\b(cyberpunk|dystopia|dystopian|cybernetic|cyborg|cyborgs|android|androids|robot|robots|replicants?|futuristic city|neon|neon lights|ruined future|post-apocalyptic|high-tech low-life|megacorporation|virtual reality|simulation|artificial intelligence|ai consciousness|cyber warfare|cyberspace|cyber crime|future noir|neo-tokyo|los angeles 2049|apocalyptic future)\b/i;

    const spaceOrTimeTravelRegex =
      /\b(space exploration|astronaut|astronauts|nasa|deep space|black hole|mars\b|the martian|interstellar|apollo|spacecraft|orbit|jupiter|saturn|alien planet|space station|galaxy|star wars|back to the future|delorean|time machine|time travel|galactic)\b/i;

    const crowdPleaserComedyRegex =
      /\b(brooklyn nine-nine|the office|modern family|parks and recreation|we're the millers|superbad|the hangover|21 jump street|22 jump street|game night|ted lasso|how i met your mother|community|the big bang theory|crazy stupid love|step brothers|bridesmaids|horrible bosses|central intelligence|grown ups|liar liar|dumb and dumber|schitt's creek|superstore|new girl|scrubs|white chicks|rush hour|anchorman|tropic thunder|meet the parents|dodgeball|airplane!|tag\b|borat|spy\b|mean girls|malcolm in the middle|ted\b|bad boys)\b/i;

    const dramedyOrArthouseRegex =
      /\b(la la land|the grand budapest hotel|life is beautiful|forrest gump|birdman|her\b|lost in translation|the banshees of inisherin|parasite|jojo rabbit|wes anderson|bittersweet|melancholy|tragic ending|musical drama|existential|crying|suicide|death|dying|grief|depression)\b/i;

    const teenOrKidsShowRegex =
      /\b(victorious|icarly|hannah montana|zoey 101|big time rush|disney channel|nickelodeon|teen sitcom|tween|high school musical|once\b|saved by the bell|suite life|wizards of waverly place|sam & cat|henry danger|good luck charlie|shake it up|austin & ally|kc undercover|liv and maddie|teen drama|adolescence|high school students?)\b/i;

    const philosophicalSpaceHitsRegex =
      /\b(interstellar|arrival|2001: a space odyssey|2001 a space odyssey|contact|ad astra|first man|solaris|gravity|moon\b|sunshine|the fountain|annihilation|high life)\b/i;

    const philosophicalSpaceThemesRegex =
      /\b(existential|meaning of life|humanity|philosophical|solitude|isolation in space|astronaut|space exploration|first contact|cosmos|relativity|time dilation|human existence|ponder|cosmic perspective|deep space)\b/i;

    const spaceActionOrLightRegex =
      /\b(star wars|guardians of the galaxy|back to the future|space jam|men in black|galaxy quest|thor|space balls|space cowboys|the fifth element|armageddon|independence day|valerian|star trek)\b/i;

    // 🌟 ريجيكس روائع الصعود والتحدي والنجاح من الصفر (Pursuit of Happyness, Whiplash, Rocky, Creed, Ford v Ferrari, Cobra Kai, Moneyball)
    const underdogInspirationalHitsRegex =
      /\b(the pursuit of happyness|pursuit of happyness|whiplash|rocky|creed|ford v ferrari|cobra kai|moneyball|million dollar baby|the fighter|cinderella man|slumdog millionaire|the social network|the wolf of wall street|jerry maguire|rush\b|blind side|coach carter|southpaw|warrior|air\b|good will hunting|rudy|remember the titans|invincible|hustle|king richard)\b/i;

    const underdogThemesRegex =
      /\b(underdog|rags to riches|from nothing|struggle|perseverance|overcome|overcoming|odds|boxing|fighter|champion|ambition|success|hustle|determination|wealth|poverty to|hard work|training|triumph|against all odds|self made|broke)\b/i;

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
        const voteCount = item.vote_count || 0;
        const voteAverage = item.vote_average || 0;
        const originalLang = (item.original_language || "").toLowerCase();

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
            if (genre === "sports") {
              if (sportsRegex.test(itemTitle) || sportsRegex.test(itemOverview))
                return 100;
              if (itemGenres.some((g) => g.includes("sport"))) return 90;
              return 0;
            }

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

        // فحص السفر عبر الزمن والتويستات
        const wantsTimeTravel =
          parsedIntent.detectedKeywords.some((k) => k.name === "time travel") ||
          /\b(time travel|time loop|timeline|wormhole)\b/i.test(
            parsedIntent.originalText,
          );

        const wantsPlotTwist =
          parsedIntent.detectedKeywords.some((k) => k.name === "plot twist") ||
          parsedIntent.hasTwistKeywords ||
          /\b(plot twists?|twist ending|crazy plot twists?|can'?t predict|unpredictable|mind[- ]blowing)\b/i.test(
            parsedIntent.originalText,
          );

        const wantsMindBending =
          parsedIntent.detectedKeywords.some(
            (k) => k.name === "mind bending",
          ) ||
          /\b(mind[- ]bending|psychological puzzle)\b/i.test(
            parsedIntent.originalText,
          );

        const hasTimeTravelSignal =
          itemGenreIds.includes(4379) ||
          timeTravelRegex.test(itemOverview) ||
          timeTravelRegex.test(itemTitle);

        const hasTwistSignal =
          itemGenreIds.includes(12565) ||
          itemGenreIds.includes(9663) ||
          itemGenreIds.includes(10714) ||
          itemGenreIds.includes(9715) ||
          itemGenreIds.includes(11160) ||
          itemGenreIds.includes(9882) ||
          twistRegex.test(itemOverview) ||
          twistRegex.test(itemTitle);

        if (wantsTimeTravel && hasTimeTravelSignal) {
          s_intent = Math.min(100, s_intent + 50);
        }

        if ((wantsPlotTwist || wantsMindBending) && hasTwistSignal) {
          s_intent = Math.min(100, s_intent + 40);
        }

        // 🌟 بونص قصص الصعود والتحدي والنجاح من الصفر (+60)
        if (parsedIntent.isUnderdog) {
          const isUnderdogHit =
            underdogInspirationalHitsRegex.test(itemTitle) ||
            underdogThemesRegex.test(itemOverview) ||
            itemGenreIds.includes(18) ||
            itemGenres.some((g) => g.includes("sport") || g.includes("drama"));

          if (isUnderdogHit) {
            s_intent = Math.min(100, s_intent + 60);
          }
        }

        // بونص مسلسلات الغموض والتويستات الكورية
        if (
          parsedIntent.isKorean &&
          (wantsPlotTwist || parsedIntent.hasTwistKeywords)
        ) {
          if (originalLang === "ko") {
            const isHitKoreanTwist =
              koreanTwistMasterpiecesRegex.test(itemTitle) ||
              (koreanThrillerThemesRegex.test(itemOverview) &&
                (itemGenreIds.includes(9648) || itemGenreIds.includes(80)));

            if (isHitKoreanTwist) {
              s_intent = Math.min(100, s_intent + 60);
            }
          }
        } else if (parsedIntent.isKorean && originalLang === "ko") {
          const isHitKorean =
            koreanTwistMasterpiecesRegex.test(itemTitle) ||
            koreanThrillerThemesRegex.test(itemOverview) ||
            itemGenreIds.includes(9648) ||
            itemGenreIds.includes(80);

          if (isHitKorean) {
            s_intent = Math.min(100, s_intent + 45);
          }
        }

        // فحص الإثارة السيكولوجية
        const wantsPsychological =
          parsedIntent.isPsychologicalThriller ||
          parsedIntent.detectedKeywords.some(
            (k) => k.name === "psychological thriller",
          ) ||
          /\b(psychological thriller|mess with my head|mindfuck|mind game)\b/i.test(
            parsedIntent.originalText,
          );

        const isPsychologicalHit =
          psychologicalMasterpiecesRegex.test(itemTitle) ||
          psychologicalThemesRegex.test(itemOverview) ||
          itemGenreIds.includes(10714) ||
          itemGenreIds.includes(12565) ||
          itemGenreIds.includes(9663);

        if (wantsPsychological && isPsychologicalHit) {
          s_intent = Math.min(100, s_intent + 50);
        }

        // بونص أفلام السرقات والتخطيط المباشر (+60)
        const hasExplicitHeistRobbery =
          explicitHeistRobberyRegex.test(itemTitle) ||
          explicitHeistRobberyRegex.test(itemOverview) ||
          itemGenreIds.includes(10051) ||
          itemGenreIds.includes(6492) ||
          itemGenreIds.includes(10292);

        if (parsedIntent.isHeistRobbery && hasExplicitHeistRobbery) {
          s_intent = Math.min(100, s_intent + 60);
        }

        // فحص وبونص السايبربنك والمستقبل السوداوي والنيون
        const isCyberpunkHit =
          cyberpunkHitsRegex.test(itemTitle) ||
          cyberpunkThemesRegex.test(itemOverview) ||
          itemGenreIds.includes(12190) ||
          itemGenreIds.includes(4565) ||
          itemGenreIds.includes(2853) ||
          itemGenreIds.includes(156395);

        if (parsedIntent.isCyberpunk && isCyberpunkHit) {
          s_intent = Math.min(100, s_intent + 60);
        }

        // بونص سينما الفضاء الفلسفية
        const isDeepSpacePhilosophical =
          philosophicalSpaceHitsRegex.test(itemTitle) ||
          (philosophicalSpaceThemesRegex.test(itemOverview) &&
            (itemGenreIds.includes(878) || itemGenreIds.includes(18)));

        if (parsedIntent.isPhilosophicalSciFi && isDeepSpacePhilosophical) {
          s_intent = Math.min(100, s_intent + 60);
        }

        // بونص الكوميديا الخالصة والمريحة عند التعب والإرهاق (+60)
        if (parsedIntent.isComfortComedy || parsedIntent.isTiredMood) {
          const isPureLaughHit =
            crowdPleaserComedyRegex.test(itemTitle) ||
            (itemGenreIds.includes(35) && !itemGenreIds.includes(18));

          if (isPureLaughHit) {
            s_intent = Math.min(100, s_intent + 60);
          }
        }

        // بونص أفلام الأنيميشن العائلية المبهجة (+50)
        const hasBothAnimationAndFamily =
          (itemGenreIds.includes(16) ||
            itemGenres.some((g) => g.includes("animation"))) &&
          (itemGenreIds.includes(10751) ||
            itemGenres.some((g) => g.includes("family")));

        const isFamilyAnimationHit =
          hasBothAnimationAndFamily ||
          familyAnimationHitsRegex.test(itemTitle) ||
          (itemGenreIds.includes(16) &&
            familyAnimationThemesRegex.test(itemOverview));

        if (parsedIntent.isFamilyAnimation && isFamilyAnimationHit) {
          s_intent = Math.min(100, s_intent + 50);
        }

        // فحص وبونص الكوميديا الرومانسية الخفيفة المبهجة
        const wantsRomCom =
          parsedIntent.isRomCom ||
          parsedIntent.detectedKeywords.some((k) => k.name === "rom-com") ||
          (/\b(sweet|light|lift my mood|feel[- ]good|rom-com|romcom|romantic comedy)\b/i.test(
            parsedIntent.originalText,
          ) &&
            (parsedIntent.detectedGenres.includes("romance") ||
              parsedIntent.detectedGenres.includes("comedy")));

        const hasBothRomanceAndComedy =
          (itemGenreIds.includes(35) ||
            itemGenres.some((g) => g.includes("comedy"))) &&
          (itemGenreIds.includes(10749) ||
            itemGenres.some((g) => g.includes("romance")));

        const isFeelGoodRomCom =
          hasBothRomanceAndComedy ||
          feelGoodRomComRegex.test(itemTitle) ||
          feelGoodRomComRegex.test(itemOverview) ||
          itemGenreIds.includes(9799) ||
          itemGenreIds.includes(158718) ||
          itemGenreIds.includes(3133);

        if (wantsRomCom && isFeelGoodRomCom) {
          s_intent = Math.min(100, s_intent + 50);
        }

        // فحص وبونص الحروب التاريخية والمعارك الملحمية
        const hasWarOrHistoryGenre =
          itemGenreIds.includes(10752) ||
          itemGenreIds.includes(36) ||
          itemGenres.some((g) => g.includes("war") || g.includes("history"));

        const isGenuineHistoricalWar =
          hasWarOrHistoryGenre ||
          historicalWarRegex.test(itemTitle) ||
          historicalWarRegex.test(itemOverview) ||
          itemGenreIds.includes(11162) ||
          itemGenreIds.includes(233) ||
          itemGenreIds.includes(210103);

        if (parsedIntent.isHistoricalWar && isGenuineHistoricalWar) {
          s_intent = Math.min(100, s_intent + 60);
        }

        // فحص وبونص وثائقيات الجرائم الحقيقية
        const isDocContent =
          itemGenreIds.includes(99) ||
          itemGenres.some((g) => g.includes("documentary")) ||
          trueCrimeDocRegex.test(itemTitle) ||
          trueCrimeDocRegex.test(itemOverview);

        const hasExplicitCrimeSignal =
          trueCrimeDocRegex.test(itemTitle) ||
          trueCrimeDocRegex.test(itemOverview) ||
          itemGenreIds.includes(10714) ||
          itemGenreIds.includes(9882) ||
          itemGenreIds.includes(10303);

        if (
          parsedIntent.isTrueCrimeDoc &&
          isDocContent &&
          hasExplicitCrimeSignal
        ) {
          s_intent = Math.min(100, s_intent + 60);
        }

        // بونص السحر الصريح والأجواء السوداوية
        const wantsMagic =
          parsedIntent.detectedKeywords.some((k) => k.name === "magic") ||
          /\b(magic|magical|sorcery|sorcerer|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|alchemy)\b/i.test(
            parsedIntent.originalText,
          );

        const wantsDark =
          /\b(dark|grim|bleak|mature|disturbing|gothic|brutal|suffering)\b/i.test(
            parsedIntent.originalText,
          );

        const hasExplicitMagic =
          itemGenreIds.includes(2343) ||
          itemGenreIds.includes(9799) ||
          explicitMagicRegex.test(itemTitle) ||
          explicitMagicRegex.test(itemOverview);

        if (wantsMagic && hasExplicitMagic) {
          s_intent = Math.min(100, s_intent + 40);
        }

        if (wantsDark) {
          const darkToneRegex =
            /\b(dark|death|tragedy|grim|violent|psychological|gore|brutal|survival|sinister|curse|bloody|dark fantasy|macabre|demon|demons)\b/i;
          if (
            darkToneRegex.test(itemOverview) ||
            darkToneRegex.test(itemTitle) ||
            itemGenreIds.includes(27) ||
            itemGenreIds.includes(53)
          ) {
            s_intent = Math.min(100, s_intent + 25);
          }
        }

        // بونص أفلام سهرة الرعب الجماعية
        if (parsedIntent.isHorrorNight) {
          const isIconicHit = iconicCrowdHorrorTitles.test(itemTitle);
          const isCrowdHorror =
            crowdHorrorRegex.test(itemOverview) ||
            crowdHorrorRegex.test(itemTitle);

          if (isIconicHit && releaseYear >= 2010) {
            s_intent = Math.min(100, s_intent + 50);
          } else if (isCrowdHorror && releaseYear >= 2010) {
            s_intent = Math.min(100, s_intent + 35);
          }
        }

        // بونص سينما الفضاء العامة
        const isSciFiContext =
          (parsedIntent.detectedGenres.includes("scifi") ||
            (anchorTitle &&
              /interstellar|arrival|contact|2001/i.test(anchorTitle))) &&
          !parsedIntent.isCyberpunk;

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

        // بونص السيتكوم الخالص
        const iconicSitcomAnchors =
          /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;
        const isAnchorSitcom =
          anchorTitle && iconicSitcomAnchors.test(anchorTitle);

        const wantsSitcom =
          parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
          isAnchorSitcom ||
          parsedIntent.isComfortComedy ||
          /\b(sitcom|sit-com|sitcoms|chill|comfort|lighthearted|feel[- ]good|relaxing|easy watch|after a long day)\b/i.test(
            parsedIntent.originalText,
          );

        const iconicComfortShows =
          /\b(how i met your mother|brooklyn nine-nine|modern family|parks and recreation|new girl|community|the office|the big bang theory|schitt's creek|scrubs|that '70s show|malcolm in the middle|ted lasso|superstore|it's always sunny in philadelphia|arrested development|silicon valley)\b/i;

        if (wantsSitcom) {
          if (iconicComfortShows.test(itemTitle)) {
            s_intent = Math.min(100, s_intent + 45);
          } else if (
            item.media_type === "tv" &&
            itemGenreIds[0] === 35 &&
            !itemGenreIds.includes(18)
          ) {
            s_intent = Math.min(100, s_intent + 30);
          }

          if (voteCount < 400 && !parsedIntent.isComfortComedy) {
            penalties += 60;
          }
        }

        // 2. حساب تفضيل المستخدم الشخصي
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

        // أ. بوابة النية العامة
        if (parsedIntent.detectedGenres.length > 0 && s_intent === 0) {
          penalties += 120;
        }

        // 🌟 ب. عقوبة استبعاد الأعمال غير المتطابقة مع قصص الصعود والتحدي (طرد الرعب والخيال العلمي والفانتازيا غير المرتبطة بالكفاح)
        if (parsedIntent.isUnderdog) {
          if (
            itemGenreIds.includes(27) ||
            (itemGenreIds.includes(878) && !itemGenreIds.includes(18)) ||
            itemGenreIds.includes(14)
          ) {
            penalties += 65;
          }
        }

        // ج. عقوبة استبعاد الأعمال غير الكورية تماماً عند طلب Korean Thriller / Show
        if (parsedIntent.isKorean) {
          if (originalLang !== "ko") {
            penalties += 120;
          }
        }

        // د. عقوبة استبعاد الأعمال الخالية من التويستات عند طلب Plot Twists
        if (wantsPlotTwist || parsedIntent.hasTwistKeywords) {
          if (
            !hasTwistSignal &&
            !koreanTwistMasterpiecesRegex.test(itemTitle)
          ) {
            penalties += 55;
          }
        }

        // هـ. عقوبة استبعاد أفلام الانتقام الفردي ودراما المافيا البطيئة عند طلب السرقات والتخطيط
        if (parsedIntent.isHeistRobbery) {
          if (
            revengeOrPureMafiaRegex.test(itemTitle) ||
            revengeOrPureMafiaRegex.test(itemOverview)
          ) {
            penalties += 80;
          }

          if (!hasExplicitHeistRobbery) {
            penalties += 70;
          }

          if (
            itemGenreIds.includes(9715) ||
            (itemGenreIds.includes(878) &&
              !/\binception|matrix\b/i.test(itemTitle))
          ) {
            penalties += 60;
          }
        }

        // و. عقوبة استبعاد الفضاء الخارجي والسفر بالزمن عند طلب السايبربنك والروبوتات والنيون
        if (parsedIntent.isCyberpunk) {
          if (
            spaceOrTimeTravelRegex.test(itemTitle) ||
            spaceOrTimeTravelRegex.test(itemOverview)
          ) {
            penalties += 80;
          }

          if (!isCyberpunkHit) {
            penalties += 60;
          }
        }

        // ز. عقوبة استبعاد الأكشن الفضائي الترفيهي والسفر بالزمن الكوميدي عند طلب الفضاء الفلسفي
        if (parsedIntent.isPhilosophicalSciFi) {
          if (
            spaceActionOrLightRegex.test(itemTitle) ||
            spaceActionOrLightRegex.test(itemOverview)
          ) {
            penalties += 80;
          }

          if (itemGenreIds.includes(35)) {
            penalties += 70;
          }

          if (!isDeepSpacePhilosophical) {
            penalties += 50;
          }
        }

        // ح. عقوبة استبعاد الدراما الكوميدية، مسلسلات المراهقين والأنمي القديم عند التعب والكوميديا المريحة
        if (parsedIntent.isComfortComedy || parsedIntent.isTiredMood) {
          if (itemGenreIds.includes(18)) {
            penalties += 80;
          }

          if (
            dramedyOrArthouseRegex.test(itemTitle) ||
            dramedyOrArthouseRegex.test(itemOverview)
          ) {
            penalties += 85;
          }

          if (
            itemGenreIds.includes(10762) ||
            teenOrKidsShowRegex.test(itemTitle) ||
            teenOrKidsShowRegex.test(itemOverview)
          ) {
            penalties += 75;
          }

          const wantsExplicitAnime =
            /\banime|manga\b/i.test(parsedIntent.originalText) ||
            parsedIntent.targetType === "anime";
          if (
            !wantsExplicitAnime &&
            (originalLang === "ja" ||
              item.media_type === "anime" ||
              itemGenreIds.includes(16))
          ) {
            penalties += 100;
          }

          if (
            itemGenreIds.includes(27) ||
            itemGenreIds.includes(10752) ||
            itemGenreIds.includes(9648)
          ) {
            penalties += 70;
          }
        }

        // ط. عقوبة استبعاد الأنمي والإنتاجات غير العائلية في سياق الأنيميشن العائلي العام
        if (parsedIntent.isFamilyAnimation) {
          const wantsExplicitAnime = /\banime\b/i.test(
            parsedIntent.originalText,
          );
          if (
            !wantsExplicitAnime &&
            (originalLang === "ja" || itemGenreIds.includes(210024))
          ) {
            penalties += 85;
          }

          if (
            itemGenreIds.includes(27) ||
            itemGenreIds.includes(53) ||
            itemGenreIds.includes(80)
          ) {
            penalties += 90;
          }

          if (
            !hasBothAnimationAndFamily &&
            !familyAnimationHitsRegex.test(itemTitle)
          ) {
            penalties += 50;
          }
        }

        // ي. عقوبة استبعاد الوثائقيات الطبيعية/العلمية والدراما الخيالية عند طلب True Crime Docuseries
        if (parsedIntent.isTrueCrimeDoc) {
          if (
            scienceNatureDocRegex.test(itemTitle) ||
            scienceNatureDocRegex.test(itemOverview)
          ) {
            penalties += 80;
          }

          if (!isDocContent) {
            penalties += 95;
          } else if (!hasExplicitCrimeSignal) {
            penalties += 60;
          }

          if (itemGenreIds.includes(35) || itemGenreIds.includes(878)) {
            penalties += 40;
          }
        }

        // ك. عقوبة استبعاد الخيال العلمي والأكشن المعاصر عند طلب الحروب التاريخية الملحمية
        if (parsedIntent.isHistoricalWar) {
          if (!isGenuineHistoricalWar) {
            penalties += 80;
          }

          const wantsSciFi = parsedIntent.detectedGenres.includes("scifi");
          if (!wantsSciFi && itemGenreIds.includes(878)) {
            penalties += 85;
          }

          if (
            itemGenreIds.includes(9715) ||
            /\b(superhero|marvel|dc comics|avengers)\b/i.test(itemOverview)
          ) {
            penalties += 90;
          }

          if (itemGenreIds.includes(35) || itemGenreIds.includes(27)) {
            penalties += 60;
          }
        }

        // ل. عقوبة استبعاد التراجيديا والكوميديا السوداوية/التجريبية عند طلب Rom-Com خفيف ومبهج
        if (wantsRomCom) {
          if (
            darkOrExperimentalRomanceRegex.test(itemTitle) ||
            darkOrExperimentalRomanceRegex.test(itemOverview) ||
            itemGenreIds.includes(9716)
          ) {
            penalties += 75;
          }

          if (
            tragicOrDepressingRomanceRegex.test(itemTitle) ||
            tragicOrDepressingRomanceRegex.test(itemOverview) ||
            itemGenreIds.includes(10752) ||
            itemGenreIds.includes(36)
          ) {
            penalties += 90;
          }

          const hasDrama = itemGenreIds.includes(18);
          if (hasDrama && !hasBothRomanceAndComedy) {
            penalties += 60;
          }

          if (!hasBothRomanceAndComedy) {
            penalties += 40;
          }
        }

        // م. عقوبة استبعاد الأعمال الضعيفة والسلاشر عند طلب Psychological Thriller
        if (wantsPsychological) {
          if (voteAverage < 7.0) {
            penalties += 70;
          }

          if (
            slasherOrCheapHorrorRegex.test(itemTitle) ||
            slasherOrCheapHorrorRegex.test(itemOverview)
          ) {
            penalties += 80;
          }

          if (!isPsychologicalHit) {
            penalties += 50;
          }
        }

        // ن. عقوبات سهرة الرعب الجماعية
        if (parsedIntent.isHorrorNight) {
          if (
            !parsedIntent.wantsClassic &&
            releaseYear > 0 &&
            releaseYear < 2010
          ) {
            penalties += 60;
          }

          if (itemGenreIds.includes(35)) {
            penalties += 80;
          }

          if (voteCount < 1000) {
            penalties += 70;
          }

          const isSlowBurnOrArthouse =
            /\b(black and white|surrealist|arthouse|slow burn|psychological study|psycho|the shining|eraserhead|rosemary's baby)\b/i.test(
              itemOverview,
            ) || /\b(psycho|the shining|eraserhead)\b/i.test(itemTitle);

          if (isSlowBurnOrArthouse) {
            penalties += 50;
          }
        }

        // س. فلترة أنميات السحر واستبعاد العمالقة والدفتر الأسود
        if (wantsMagic) {
          if (
            nonMagicTitanOrNotebookRegex.test(itemOverview) ||
            nonMagicTitanOrNotebookRegex.test(itemTitle)
          ) {
            penalties += 50;
          } else if (!hasExplicitMagic) {
            penalties += 35;
          }
        }

        // ع. عقوبة الخصم الحاسم على الخيال العلمي الخالي من السفر عبر الزمن
        if (wantsTimeTravel && !hasTimeTravelSignal) {
          penalties += 70;
        }

        // ف. بوابة الأبطال الخارقين الصارمة
        const wantsSuperhero =
          parsedIntent.detectedKeywords.some((k) => k.name === "superhero") ||
          /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
            parsedIntent.originalText,
          );

        const isSuperhero =
          superheroRegex.test(itemTitle) ||
          superheroRegex.test(itemOverview) ||
          itemGenreIds.includes(9715);

        if (wantsSuperhero) {
          if (isSuperhero) {
            s_intent = Math.min(100, s_intent + 45);
          } else {
            penalties += 120;
          }
        } else {
          if (isSuperhero) {
            penalties += 80;
          }
        }

        // ص. بوابة الحظر التام للرياضة (تُستثنى إذا كان الطلب صعوداً وتحدياً Underdog)
        const detectedSportSubThemes = parsedIntent.detectedKeywords.filter(
          (k) =>
            ["racing", "boxing", "football", "basketball"].includes(k.name),
        );
        const userWantsSports =
          (parsedIntent.detectedGenres.includes("sports") ||
            detectedSportSubThemes.length > 0) &&
          !parsedIntent.isUnderdog;

        if (userWantsSports) {
          const hasSportsSignal =
            sportsRegex.test(itemOverview) ||
            sportsRegex.test(itemTitle) ||
            itemGenres.some((g) => g.includes("sport"));

          if (!hasSportsSignal) {
            penalties += 180;
          }

          const wantsSciFi =
            parsedIntent.detectedGenres.includes("scifi") || wantsTimeTravel;
          const hasSciFiOrTimeTravel =
            itemGenreIds.includes(878) ||
            timeTravelRegex.test(itemOverview) ||
            /\b(back to the future)\b/i.test(itemTitle);

          if (!wantsSciFi && hasSciFiOrTimeTravel) {
            penalties += 150;
          }
        }

        // ق. فلترة الـ TV Movies والحلقات الخاصة (-60)
        const isMovieSearch =
          parsedIntent.targetType === "movie" || item.media_type === "movie";
        const isTvMovieOrSpecial =
          itemGenreIds.includes(10770) ||
          /\b(doctor who|tv special|special episode|christmas special|holiday special|made-for-tv)\b/i.test(
            itemTitle,
          ) ||
          /\b(doctor who|tardis|time lord)\b/i.test(itemOverview);
        if (isMovieSearch && isTvMovieOrSpecial) {
          penalties += 60;
        }

        // ر. تعارض الكوميديا مع الإثارة والرعب والجرائم
        const isDarkOrThriller =
          itemGenreIds.includes(53) ||
          itemGenreIds.includes(80) ||
          itemGenreIds.includes(27) ||
          itemGenreIds.includes(10752);
        const userWantedDark =
          parsedIntent.detectedKeywords.some((k) => k.name === "dark comedy") ||
          parsedIntent.detectedGenres.includes("horror") ||
          parsedIntent.detectedGenres.includes("mystery") ||
          parsedIntent.detectedGenres.includes("crime") ||
          parsedIntent.detectedGenres.includes("war") ||
          wantsDark ||
          parsedIntent.isHorrorNight ||
          parsedIntent.isCrimeHeist ||
          wantsPsychological ||
          parsedIntent.isHistoricalWar ||
          parsedIntent.isTrueCrimeDoc ||
          parsedIntent.isKorean ||
          parsedIntent.hasTwistKeywords ||
          parsedIntent.isCyberpunk ||
          parsedIntent.isPhilosophicalSciFi ||
          parsedIntent.isUnderdog;
        if (
          parsedIntent.detectedGenres.includes("comedy") &&
          isDarkOrThriller &&
          !userWantedDark &&
          !parsedIntent.isFamilyAnimation
        ) {
          penalties += 50;
        }

        // ش. خصم العمل المرجعي وأجزائه المباشرة بدقة
        if (anchorTitle) {
          const cleanAnchor = anchorTitle.toLowerCase().trim();
          const cleanItem = itemTitle.toLowerCase().trim();
          const isExactOrSequel =
            cleanItem === cleanAnchor ||
            cleanItem.startsWith(cleanAnchor + " ") ||
            cleanItem.startsWith(cleanAnchor + ":") ||
            cleanItem.startsWith(cleanAnchor + " -");

          if (isExactOrSequel) {
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

        let popularityBonus = 0;
        if (voteCount >= 4000) {
          popularityBonus = 15;
        } else if (voteCount >= 1500) {
          popularityBonus = 10;
        } else if (voteCount >= 500) {
          popularityBonus = 5;
        }

        let recencyBonus = 0;
        if (!parsedIntent.wantsClassic && releaseYear >= 2010) {
          recencyBonus = 8;
        } else if (!parsedIntent.wantsClassic && releaseYear >= 2000) {
          recencyBonus = 4;
        }

        const finalScore = Math.max(
          0,
          rawScore + popularityBonus + recencyBonus - penalties,
        );

        return {
          ...item,
          breakdown: {
            s_intent,
            s_user,
            s_rating,
            penalties,
            popularityBonus,
            recencyBonus,
          },
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
