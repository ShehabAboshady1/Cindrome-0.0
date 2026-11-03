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
    "light",
    "chill",
    "comfort",
    "feel-good",
    "relaxing",
    "easy watch",
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
  "plot twist": {
    id: 12565,
    terms: [
      "plot twist",
      "twist ending",
      "surprise ending",
      "shocking ending",
      "unexpected twist",
      "crazy plot twist",
      "crazy plot twists",
      "twist",
      "twists",
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
  dystopia: { id: 4565, terms: ["dystopia", "dystopian", "post-apocalyptic"] },
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
};

export const TMDB_THEME_IDS = {
  sports: 6075,
  racing: 830,
  boxing: 207268,
  football: "9937|11100",
  basketball: 6078,
  superhero: 9715,
  timeTravel: 4379,
  plotTwist: 12565,
  mindBending: 10683,
  magic: "2343|9799",
  survival: 10085,
};

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
      if (
        data.terms.some((t) => new RegExp(`\\b${t}\\b`, "i").test(lowerText))
      ) {
        detectedKeywords.push({ name: theme, id: data.id });
      }
    }

    const wantsClassic =
      /\b(classic|retro|old|80s|90s|vintage|nostalgic)\b/i.test(lowerText);

    // رصد سياق سهرة الرعب الجماعية مع الأصدقاء
    const isHorrorNight =
      /\b(movie night|with friends|party|friends|sleepover|crowd|popcorn)\b/i.test(
        lowerText,
      ) &&
      (detectedGenres.includes("horror") ||
        /\b(horror|scary|spooky)\b/i.test(lowerText));

    let targetType = selectedType;
    if (selectedType === "mixed") {
      if (/\b(anime|manga)\b/i.test(lowerText)) targetType = "anime";
      else if (/\b(movie|movies|film|films)\b/i.test(lowerText))
        targetType = "movie";
      else if (/\b(series|show|shows|tv|sitcom)\b/i.test(lowerText))
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
      isHorrorNight,
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
      /\b(plot twist|twist ending|unexpected twist|shocking twist|crazy plot twist|twists?|mind-bending|mind bending|secrets?|deception|conspiracy|illusion|simulation|reality|subconscious|hallucination|puzzle|mind game|unreliable narrator|amnesia|identity twist|double life)\b/i;

    const explicitMagicRegex =
      /\b(magic|magical|sorcery|sorcerer|sorceress|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|grimoire|alchemist|alchemy|mana|caster|servant|holy grail|homunculus|magic user|black magic|arcane|necromancer|grimoires|magical girl|madoka|fate\/zero|overlord)\b/i;

    const nonMagicTitanOrNotebookRegex =
      /\b(titan|titans|colossal|survey corps|wall maria|eren yeager|death note|shinigami|light yagami|ryuk|notebook)\b/i;

    // ريجيكس الرعب الحماسي للسهرات الجماعية
    const crowdHorrorRegex =
      /\b(jump scare|slasher|paranormal|haunted house|demon|possession|curse|ghost|creature|cabin in the woods|killer|masked killer|evil dead|scream|insidious|talk to me|conjuring|quiet place|smile|sinister|it\b|m3gan|lights out|ouija|annabelle|nun|barbarian|terrifier|don't breathe|hereditary|black phone|get out|us\b|saw\b|final destination|cabin)\b/i;

    // عناوين رعب السهرات الجماهيرية الأشهر والأعلى إقبالاً
    const iconicCrowdHorrorTitles =
      /\b(the conjuring|talk to me|scream|insidious|evil dead|a quiet place|smile|barbarian|sinister|it\b|don't breathe|the black phone|lights out|hereditary|m3gan|annabelle|the nun|terrifier|get out|us\b)\b/i;

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
          /\b(plot twist|twist ending|crazy plot twists?)\b/i.test(
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
          itemGenreIds.includes(10683) ||
          twistRegex.test(itemOverview) ||
          twistRegex.test(itemTitle);

        if (wantsTimeTravel && hasTimeTravelSignal) {
          s_intent = Math.min(100, s_intent + 50);
        }

        if ((wantsPlotTwist || wantsMindBending) && hasTwistSignal) {
          s_intent = Math.min(100, s_intent + 40);
        }

        // بونص السحر الصريح والأجواء السوداوية
        const wantsMagic =
          parsedIntent.detectedKeywords.some((k) => k.name === "magic") ||
          /\b(magic|magical|sorcery|sorcerer|witch|witches|witchcraft|wizard|mage|spell|spells|alchemy)\b/i.test(
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

        // 🌟 بونص أفلام سهرة الرعب الجماعية (Horror Movie Night)
        if (parsedIntent.isHorrorNight) {
          const isIconicHit = iconicCrowdHorrorTitles.test(itemTitle);
          const isCrowdHorror =
            crowdHorrorRegex.test(itemOverview) ||
            crowdHorrorRegex.test(itemTitle);

          if (isIconicHit && releaseYear >= 2010) {
            s_intent = Math.min(100, s_intent + 50); // بونص قوي جداً للعناوين الأيقونية الناجحة
          } else if (isCrowdHorror && releaseYear >= 2010) {
            s_intent = Math.min(100, s_intent + 35);
          }
        }

        // بونص سينما الفضاء
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

        // بونص السيتكوم الخالص
        const iconicSitcomAnchors =
          /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;
        const isAnchorSitcom =
          anchorTitle && iconicSitcomAnchors.test(anchorTitle);

        const wantsSitcom =
          parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
          isAnchorSitcom ||
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

          if (voteCount < 400) {
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

        // 🌟 ب. عقوبات سهرة الرعب الجماعية (حظر أفلام ما قبل 2010 والكوميديا والأفلام المغمورة)
        if (parsedIntent.isHorrorNight) {
          // استبعاد أفلام ما قبل 2010 لحصر التجربة في الرعب الحديث
          if (
            !parsedIntent.wantsClassic &&
            releaseYear > 0 &&
            releaseYear < 2010
          ) {
            penalties += 60;
          }

          // استبعاد الكوميديا والبارودي تماماً
          if (itemGenreIds.includes(35)) {
            penalties += 80;
          }

          // استبعاد الأفلام المغمورة أو غير المجرّبة ذات التقييمات القليلة
          if (voteCount < 1000) {
            penalties += 70;
          }

          // استبعاد الرعب البطيء جداً (Slow-burn Arthouse) غير المناسب لسهرات التجمعات
          const isSlowBurnOrArthouse =
            /\b(black and white|surrealist|arthouse|slow burn|psychological study|psycho|the shining|eraserhead|rosemary's baby)\b/i.test(
              itemOverview,
            ) || /\b(psycho|the shining|eraserhead)\b/i.test(itemTitle);

          if (isSlowBurnOrArthouse) {
            penalties += 50;
          }
        }

        // ج. فلترة أنميات السحر واستبعاد العمالقة والدفتر الأسود
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

        // د. عقوبة الخصم الحاسم على الخيال العلمي الخالي من السفر عبر الزمن
        if (wantsTimeTravel && !hasTimeTravelSignal) {
          penalties += 70;
        }

        if (wantsPlotTwist && !hasTwistSignal) {
          penalties += 45;
        }

        // هـ. بوابة الأبطال الخارقين الصارمة
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

        // و. فلترة مسلسلات المراهقين والدراما عند طلب السيتكوم
        if (wantsSitcom) {
          const isTeenOrComingOfAgeDrama =
            /\b(high school|teenagers?|sex clinic|sex therapy|adolescence|coming-of-age|teen drama|hormones|puberty|students|prom)\b/i.test(
              itemOverview,
            ) ||
            /\b(sex education|euphoria|skins|13 reasons why|elite|riverdale|heartstopper|never have i ever|ginny & georgia)\b/i.test(
              itemTitle,
            );

          if (isTeenOrComingOfAgeDrama) {
            penalties += 95;
          }

          const hasDrama = itemGenreIds.includes(18);
          const isComedyPrimary =
            itemGenreIds.length > 0 && itemGenreIds[0] === 35;
          if (hasDrama && !isComedyPrimary) {
            penalties += 80;
          }

          const isDysfunctional =
            /\b(poverty|addiction|alcoholic|alcoholism|dysfunctional|rehab|drug addict|substance abuse|telenovela|melodrama|cartel|bipolar)\b/i.test(
              itemOverview,
            ) || /\b(shameless)\b/i.test(itemTitle);
          if (isDysfunctional) {
            penalties += 70;
          }
        }

        // ز. بوابة الحظر التام للرياضة
        const detectedSportSubThemes = parsedIntent.detectedKeywords.filter(
          (k) =>
            ["racing", "boxing", "football", "basketball"].includes(k.name),
        );
        const userWantsSports =
          parsedIntent.detectedGenres.includes("sports") ||
          detectedSportSubThemes.length > 0;

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

          if (detectedSportSubThemes.length > 0) {
            detectedSportSubThemes.forEach((sub) => {
              let isExactSubMatch = false;

              if (sub.name === "football") {
                const footballTerms =
                  /\b(football|soccer|fifa|premier league|champions league|world cup|nfl|super bowl|quarterback|touchdown|gridiron|striker|goalkeeper|pelé|maradona|messi|ronaldo|varsity blues|any given sunday|remember the titans|gridiron gang|the blind side|mean machine|rudy|draft day|we are marshall|friday night lights|goal!\s*the dream begins)\b/i;
                isExactSubMatch =
                  footballTerms.test(itemTitle) ||
                  footballTerms.test(itemOverview) ||
                  itemGenreIds.includes(9937) ||
                  itemGenreIds.includes(11100);
              } else if (sub.name === "racing") {
                const racingTerms =
                  /\b(racing|car race|auto racing|motorsport|formula 1|f1|nascar|rally|grand prix|speedway|le mans|ferrari|porsche|supercar|race car|street racing|drag race|karting|race driver|racetrack|need for speed|gran turismo|ford v ferrari|days of thunder)\b/i;
                isExactSubMatch =
                  racingTerms.test(itemTitle) ||
                  racingTerms.test(itemOverview) ||
                  itemGenreIds.includes(830);
              } else if (sub.name === "boxing") {
                const boxingTerms =
                  /\b(boxing|boxer|heavyweight|sparring|knockout|creed|rocky|prizefighter|raging bull|million dollar baby|southpaw)\b/i;
                isExactSubMatch =
                  boxingTerms.test(itemTitle) ||
                  boxingTerms.test(itemOverview) ||
                  itemGenreIds.includes(207268);
              } else if (sub.name === "basketball") {
                const basketballTerms =
                  /\b(basketball|nba|court|dunk|hoops|coach carter|space jam|white men can't jump|hustle)\b/i;
                isExactSubMatch =
                  basketballTerms.test(itemTitle) ||
                  basketballTerms.test(itemOverview) ||
                  itemGenreIds.includes(6078);
              }

              if (isExactSubMatch) {
                s_intent = Math.min(100, s_intent + 50);
              } else if (hasSportsSignal) {
                penalties += 15;
              } else {
                penalties += 180;
              }
            });
          }
        }

        // ح. فلترة الـ TV Movies والحلقات الخاصة (-60)
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

        // ط. تعارض الكوميديا مع الإثارة والرعب والجرائم
        const isDarkOrThriller =
          itemGenreIds.includes(53) ||
          itemGenreIds.includes(80) ||
          itemGenreIds.includes(27);
        const userWantedDark =
          parsedIntent.detectedKeywords.some((k) => k.name === "dark comedy") ||
          parsedIntent.detectedGenres.includes("horror") ||
          parsedIntent.detectedGenres.includes("mystery") ||
          wantsDark ||
          parsedIntent.isHorrorNight;
        if (
          parsedIntent.detectedGenres.includes("comedy") &&
          isDarkOrThriller &&
          !userWantedDark
        ) {
          penalties += 50;
        }

        // ي. خصم الفانتازيا عند طلب الخيال العلمي فقط
        const isSciFiOnly =
          parsedIntent.detectedGenres.includes("scifi") &&
          !parsedIntent.detectedGenres.includes("fantasy") &&
          !wantsMagic;
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

        // ك. خصم العمل المرجعي وأجزائه المباشرة بدقة
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
        } else if (voteCount >= 800) {
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
