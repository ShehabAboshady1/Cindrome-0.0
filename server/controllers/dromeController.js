// controllers/dromeController.js
import db from "../config/db.js";
import axios from "axios";
import {
  CindromeEngine,
  TMDB_GENRE_IDS,
  TMDB_THEME_IDS,
  GENRE_DESCRIPTOR_STOPWORDS,
  themeKeywords,
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

// دالة استخراج جذر السلسلة لمنع تكرار أجزاء السلسلة الواحدة (Franchise/Sequel Deduplication)
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

export const processChat = async (req, res) => {
  try {
    // 🔒 فحص أمان صارم للتحقق من تسجيل الدخول
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error:
          "Authentication required. Please sign in to use the Cindrome Personalization Engine.",
      });
    }

    const { prompt, focusType = "mixed" } = req.body;

    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Please enter a message." });
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const cleanPrompt = prompt.trim();

    // 1. توحيد نوع الميديا
    let normalizedFocus = focusType.toLowerCase().trim();
    if (normalizedFocus === "movies") normalizedFocus = "movie";
    if (normalizedFocus === "series") normalizedFocus = "tv";

    // 2. استخراج النية
    const parsedIntent = CindromeEngine.parseQuery(
      cleanPrompt,
      normalizedFocus,
    );

    if (!parsedIntent.isValid) {
      return res.json({
        success: true,
        message: parsedIntent.message,
        results: [],
      });
    }

    if (parsedIntent.isAmbiguous) {
      return res.json({
        success: true,
        message:
          "I couldn't quite catch the specific genre or mood you're looking for. Are you in the mood for Comedy, Action, Sci-Fi, Horror, or Drama? Or you can just name a title you love!",
        results: [],
      });
    }

    // 🌟 3. استخراج ريفيوهات المستخدم الفعالة (Rating >= 4.0) وحساب الـ Genres والـ Micro-Keywords
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

            // أ) تسجيل تصنيفات الـ Genres
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

            // ب) تسجيل الكلمات المفتاحية والـ Tropes الدقيقة للأعمال المفضلة
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

    // 4. فحص العمل المرجعي المباشر مع استبعاد المصطلحات الوصفية
    let anchorTitle = parsedIntent.extractedReferenceTitle;
    let anchorMedia = null;

    if (anchorTitle) {
      const cleanCheck = anchorTitle
        .toLowerCase()
        .trim()
        .replace(/^(a|an|the)\s+/, "");
      if (
        GENRE_DESCRIPTOR_STOPWORDS.has(cleanCheck) ||
        GENRE_DESCRIPTOR_STOPWORDS.has(anchorTitle.toLowerCase().trim())
      ) {
        anchorTitle = null;
      }
    }

    const isShortTitleQuery =
      cleanPrompt.split(" ").length <= 4 &&
      !/\b(recommend|suggest|show|give|want|looking|find|movies|anime|series)\b/i.test(
        cleanPrompt,
      );

    if (!anchorTitle && isShortTitleQuery) {
      const cleanShortCheck = cleanPrompt
        .toLowerCase()
        .trim()
        .replace(/^(a|an|the)\s+/, "");
      if (
        !GENRE_DESCRIPTOR_STOPWORDS.has(cleanShortCheck) &&
        !GENRE_DESCRIPTOR_STOPWORDS.has(cleanPrompt.toLowerCase().trim())
      ) {
        anchorTitle = cleanPrompt;
      }
    }

    if (anchorTitle) {
      try {
        const searchEndpoint =
          parsedIntent.targetType === "anime" ||
          parsedIntent.targetType === "tv"
            ? "https://api.themoviedb.org/3/search/tv"
            : parsedIntent.targetType === "movie"
              ? "https://api.themoviedb.org/3/search/movie"
              : "https://api.themoviedb.org/3/search/multi";

        const searchRes = await axios.get(searchEndpoint, {
          params: { api_key: TMDB_API_KEY, query: anchorTitle, page: 1 },
        });

        let topMatch = (searchRes.data.results || []).find(
          (r) => (r.vote_count || 0) >= 10 && r.media_type !== "person",
        );

        if (
          !topMatch &&
          searchEndpoint !== "https://api.themoviedb.org/3/search/multi"
        ) {
          const multiRes = await axios
            .get("https://api.themoviedb.org/3/search/multi", {
              params: { api_key: TMDB_API_KEY, query: anchorTitle, page: 1 },
            })
            .catch(() => ({ data: { results: [] } }));
          topMatch = (multiRes.data.results || []).find(
            (r) => (r.vote_count || 0) >= 10 && r.media_type !== "person",
          );
        }

        if (topMatch) {
          anchorMedia = topMatch;
        }
      } catch (err) {
        console.error("Direct title search failed:", err.message);
      }
    }

    const hasSpecificUserIntent =
      Boolean(anchorTitle) ||
      Boolean(anchorMedia) ||
      Boolean(parsedIntent.extractedReferenceTitle) ||
      parsedIntent.detectedGenres.length > 0 ||
      parsedIntent.detectedKeywords.length > 0 ||
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
      hasQualityFloor ||
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
      !anchorMedia &&
      !anchorTitle &&
      !hasSpecificUserIntent
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

    // 5. رصد النوايا الثيماتية وحالات المود
    const iconicSitcomAnchors =
      /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;

    const isSitcomIntent =
      parsedIntent.isSitcom ||
      parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
      (anchorTitle && iconicSitcomAnchors.test(anchorTitle)) ||
      /\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(cleanPrompt);

    const wantsSuperhero =
      parsedIntent.detectedKeywords.some((k) => k.name === "superhero") ||
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
        cleanPrompt,
      );

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
        /\b(cute|wholesome|sweet)\b/i.test(cleanPrompt) &&
        (/\b(romance|romantic|love)\b/i.test(cleanPrompt) ||
          /\b(funny|comedy)\b/i.test(cleanPrompt)));

    const isDarkAnimeIntent =
      parsedIntent.isDarkAnime ||
      ((parsedIntent.targetType === "anime" || normalizedFocus === "anime") &&
        /\b(dark|bleak|grim|psychological|gore|brutal|dark fantasy)\b/i.test(
          cleanPrompt,
        ));

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

    const hasQualityFloorIntent =
      parsedIntent.hasQualityFloor ||
      isMindBlowingActionIntent ||
      isPureComedyIntent ||
      /\b(mind[- ]blowing|mind blowing|masterpiece|masterpieces|epic|best|top[- ]tier|greatest)\b/i.test(
        cleanPrompt,
      );

    const isSwordWarfareIntent =
      parsedIntent.isSwordWarfare ||
      parsedIntent.detectedKeywords.some((k) => k.name === "sword warfare") ||
      /\b(swords?|sword fight|ancient warfare|medieval warfare|old historical battles?|medieval armies|ancient battles?|gladiators?|samurai)\b/i.test(
        cleanPrompt,
      );

    const isHistoricalWarIntent =
      !isSwordWarfareIntent &&
      (parsedIntent.isHistoricalWar ||
        parsedIntent.detectedKeywords.some(
          (k) => k.name === "historical war",
        ) ||
        /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war)\b/i.test(
          cleanPrompt,
        ));

    const isTrueCrimeDocIntent =
      parsedIntent.isTrueCrimeDoc ||
      parsedIntent.detectedKeywords.some((k) => k.name === "true crime") ||
      /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|crime documentary|unsolved mysteries|real crime|real crime cases)\b/i.test(
        cleanPrompt,
      );

    const isKoreanIntent =
      parsedIntent.isKorean ||
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

    // 6. سحب سلة المرشحين الموسعة من TMDB
    let candidates = [];
    const todayStr = new Date().toISOString().split("T")[0];

    // أ) سحب التوصيات في حالة وجود عمل مرجعي مباشر (Anchor Media)
    if (anchorMedia) {
      const actualMediaType =
        anchorMedia.media_type || (anchorMedia.first_air_date ? "tv" : "movie");
      const recEndpoint = `https://api.themoviedb.org/3/${actualMediaType}/${anchorMedia.id}/recommendations`;

      try {
        const recRes = await axios.get(recEndpoint, {
          params: { api_key: TMDB_API_KEY, page: 1 },
        });
        let rawRecs = recRes.data.results || [];

        rawRecs = rawRecs.filter(
          (c) =>
            (c.vote_count || 0) >= 300 &&
            (c.release_date || c.first_air_date) &&
            (c.release_date || c.first_air_date) <= todayStr,
        );

        candidates = rawRecs.map((c) => ({
          ...c,
          media_type: c.media_type || actualMediaType,
        }));

        if (parsedIntent.targetType === "anime") {
          candidates = candidates.filter((c) => c.original_language === "ja");
        }
      } catch (recErr) {
        console.error("Recommendations fetch error:", recErr.message);
      }
    }

    // ب) بناء استدعاءات TMDB Discover الديناميكية بالكامل
    const excludeSuperheroParam = wantsSuperhero ? null : "9715";
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

    const trueCrimeKeywordParam = isTrueCrimeDocIntent
      ? String(TMDB_THEME_IDS.trueCrime || "10714|9882|9715|10303")
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
    if (
      !wantsSciFi &&
      (userWantsSports || isHistoricalWarIntent || isSwordWarfareIntent)
    ) {
      excludedMovieGenres.push("878", "16", "35");
    } else if (isHauntedHorrorIntent) {
      excludedMovieGenres.push("10751", "10762", "35", "16");
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
      excludedMovieGenres.push("18", "10752", "36", "27", "99", "14", "16");
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
    const movieWithoutGenres = excludedMovieGenres.join(",");

    let withoutKeywordsList = [];
    if (excludeSuperheroParam) withoutKeywordsList.push(excludeSuperheroParam);
    if (isRomComIntent || (isComfortComedyIntent && !isPureComedyIntent))
      withoutKeywordsList.push("9716");
    if (isFamilyAnimationIntent && !/\banime\b/i.test(cleanPrompt)) {
      withoutKeywordsList.push("210024");
    }
    if (isCuteAnimeRomComIntent) {
      withoutKeywordsList.push("2858", "190370", "9716");
    }
    if (isSitcomIntent) {
      withoutKeywordsList.push("6075", "9937", "11100");
    }
    const withoutKeywordsParam =
      withoutKeywordsList.length > 0 ? withoutKeywordsList.join(",") : null;

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
        isMindBlowingActionIntent) &&
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
        isMindBlowingActionIntent) &&
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

    if (isComfortComedyIntent || isPureComedyIntent || isSitcomIntent) {
      primaryMovieGenre = "35";
      primaryTvGenre = "35";
    }

    if (isRomComIntent) {
      primaryMovieGenre = "35,10749";
    }

    if (isSwordWarfareIntent) {
      primaryMovieGenre = "36|10752|28";
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
      primaryTvGenre = "35,16";
    }

    if (isHauntedHorrorIntent) {
      primaryMovieGenre = "27";
      primaryTvGenre = "27";
    }

    if (isMindBlowingActionIntent) {
      primaryMovieGenre = "28,878";
      primaryTvGenre = "10759,10765";
    }

    const movieMinVotes = 300;
    const tvMinVotes = 200;

    if (parsedIntent.targetType === "mixed") {
      const movieParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": movieMinVotes,
        sort_by: "popularity.desc",
        without_genres: movieWithoutGenres,
        "primary_release_date.lte": todayStr,
      };

      if (isKoreanIntent) {
        movieParams.with_original_language = "ko";
        movieParams.with_origin_country = "KR";
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
      } else if (historicalWarKeywordParam) {
        movieParams.with_keywords = historicalWarKeywordParam;
      } else if (romcomKeywordParam) {
        movieParams.with_keywords = romcomKeywordParam;
      } else if (psychologicalKeywordParam) {
        movieParams.with_keywords = psychologicalKeywordParam;
      } else if (crimeHeistKeywordParam) {
        movieParams.with_keywords = crimeHeistKeywordParam;
      } else if (complexKeywordParam) {
        movieParams.with_keywords = complexKeywordParam;
      } else if (sportsKeywordParam) {
        movieParams.with_keywords = sportsKeywordParam;
      }

      if (withoutKeywordsParam) {
        movieParams.without_keywords = withoutKeywordsParam;
      }

      const tvWithoutGenres = isFamilyAnimationIntent
        ? "27,53,80"
        : isSitcomIntent
          ? "18,16,10765,10768,10762,10766"
          : isComfortComedyIntent || isPureComedyIntent
            ? "18,16,10765,10768,10762"
            : isCrimeFamilyIntent || isHauntedHorrorIntent
              ? "10751,10762,16"
              : "16";

      const liveTvParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": tvMinVotes,
        sort_by: "popularity.desc",
        without_genres: tvWithoutGenres,
        "first_air_date.lte": todayStr,
      };

      if (isKoreanIntent) {
        liveTvParams.with_original_language = "ko";
        liveTvParams.with_origin_country = "KR";
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
      } else if (complexKeywordParam) {
        liveTvParams.with_keywords = complexKeywordParam;
      } else if (sportsKeywordParam) {
        liveTvParams.with_keywords = sportsKeywordParam;
      }
      if (tvFantasyExclude) liveTvParams.without_keywords = tvFantasyExclude;

      const animeParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": 80,
        sort_by: "popularity.desc",
        with_original_language: "ja",
        with_genres: isCuteAnimeRomComIntent
          ? "35,16"
          : wantsMagic
            ? "10765,16"
            : primaryTvGenre
              ? `${primaryTvGenre},16`
              : "16",
        "first_air_date.lte": todayStr,
      };

      if (cuteAnimeKeywordParam)
        animeParams.with_keywords = cuteAnimeKeywordParam;
      else if (darkAnimeKeywordParam)
        animeParams.with_keywords = darkAnimeKeywordParam;
      else if (wantsMagic) animeParams.with_keywords = "2343|9799";
      else if (cyberpunkKeywordParam)
        animeParams.with_keywords = cyberpunkKeywordParam;
      else if (complexKeywordParam)
        animeParams.with_keywords = complexKeywordParam;
      else if (sportsKeywordParam)
        animeParams.with_keywords = sportsKeywordParam;
      if (withoutKeywordsParam)
        animeParams.without_keywords = withoutKeywordsParam;
      if (tvFantasyExclude && !wantsMagic)
        animeParams.without_keywords = tvFantasyExclude;

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
        isSitcomIntent
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
    } else if (parsedIntent.targetType === "anime") {
      const animeParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": 80,
        sort_by: "popularity.desc",
        with_original_language: "ja",
        with_genres: isCuteAnimeRomComIntent
          ? "35,16"
          : wantsMagic
            ? "10765,16"
            : primaryTvGenre
              ? `${primaryTvGenre},16`
              : "16",
        "first_air_date.lte": todayStr,
      };

      if (cuteAnimeKeywordParam)
        animeParams.with_keywords = cuteAnimeKeywordParam;
      else if (darkAnimeKeywordParam)
        animeParams.with_keywords = darkAnimeKeywordParam;
      else if (wantsMagic) animeParams.with_keywords = "2343|9799";
      else if (cyberpunkKeywordParam)
        animeParams.with_keywords = cyberpunkKeywordParam;
      else if (complexKeywordParam)
        animeParams.with_keywords = complexKeywordParam;
      else if (sportsKeywordParam)
        animeParams.with_keywords = sportsKeywordParam;
      if (withoutKeywordsParam)
        animeParams.without_keywords = withoutKeywordsParam;
      if (tvFantasyExclude && !wantsMagic)
        animeParams.without_keywords = tvFantasyExclude;

      const tvRes = await axios.get(
        "https://api.themoviedb.org/3/discover/tv",
        { params: animeParams },
      );
      candidates = (tvRes.data.results || []).map((a) => ({
        ...a,
        media_type: "anime",
      }));
    } else {
      const isTv = parsedIntent.targetType === "tv";
      const endpoint = isTv
        ? "https://api.themoviedb.org/3/discover/tv"
        : "https://api.themoviedb.org/3/discover/movie";

      const singleParams = {
        api_key: TMDB_API_KEY,
        page: 1,
        "vote_count.gte": isTv ? tvMinVotes : movieMinVotes,
        sort_by: "popularity.desc",
        [isTv ? "first_air_date.lte" : "primary_release_date.lte"]: todayStr,
      };

      if (isKoreanIntent) {
        singleParams.with_original_language = "ko";
        singleParams.with_origin_country = "KR";
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
      } else if (historicalWarKeywordParam) {
        singleParams.with_keywords = historicalWarKeywordParam;
      } else if (romcomKeywordParam) {
        singleParams.with_keywords = romcomKeywordParam;
      } else if (psychologicalKeywordParam) {
        singleParams.with_keywords = psychologicalKeywordParam;
      } else if (crimeHeistKeywordParam) {
        singleParams.with_keywords = crimeHeistKeywordParam;
      } else if (complexKeywordParam) {
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
        singleParams.without_genres = isFamilyAnimationIntent
          ? "27,53,80"
          : isSitcomIntent
            ? "18,16,10765,10768,10762,10766"
            : isComfortComedyIntent || isPureComedyIntent
              ? "18,16,10765,10768,10762"
              : isCrimeFamilyIntent || isHauntedHorrorIntent
                ? "10751,10762,16"
                : "16";
        if (tvFantasyExclude) singleParams.without_keywords = tvFantasyExclude;
      }

      try {
        const [p1Res, p2Res] = await Promise.all([
          axios.get(endpoint, { params: { ...singleParams, page: 1 } }),
          axios.get(endpoint, { params: { ...singleParams, page: 2 } }),
        ]);
        candidates = [
          ...(p1Res.data.results || []),
          ...(p2Res.data.results || []),
        ].map((it) => ({ ...it, media_type: parsedIntent.targetType }));
      } catch (err) {
        const resData = await axios.get(endpoint, { params: singleParams });
        candidates = (resData.data.results || []).map((it) => ({
          ...it,
          media_type: parsedIntent.targetType,
        }));
      }
    }

    // 🌟 7. فلترة الأعمال المستقبلية محلياً مع حظر الأعمال التي ليس لها تاريخ إصدار معلن
    candidates = candidates.filter((item) => {
      const relDate = item.release_date || item.first_air_date;
      const voteCount = item.vote_count || 0;

      if (!relDate || relDate > todayStr) return false;

      const minAllowedVotes =
        parsedIntent.targetType === "anime" ||
        isCuteAnimeRomComIntent ||
        isDarkAnimeIntent ||
        isKoreanIntent ||
        isTrueCrimeDocIntent
          ? 40
          : 200;

      return voteCount >= minAllowedVotes;
    });

    // 8. استبعاد ما شاهده هذا المستخدم حصراً من جدول reviews
    if (candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id).filter(Boolean);
      const watchedRes = await db.query(
        "SELECT tmdb_id FROM reviews WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
        [currentUserId, candidateIds],
      );
      const watchedIds = new Set(watchedRes.rows.map((r) => r.tmdb_id));
      candidates = candidates.filter((c) => !watchedIds.has(c.id));
    }

    // إزالة التكرارات بالمعرف
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

    // 9. مرحلة الفرز والتقييم المحلي الشامل مع تمرير userReviewsCount الفعالة
    const resolvedAnchorName = anchorMedia
      ? anchorMedia.title || anchorMedia.name
      : null;
    const rankedResults = CindromeEngine.scoreAndRank(
      candidates,
      parsedIntent,
      userProfileStats,
      resolvedAnchorName,
      userReviewsCount,
    );

    // 10. التوزيع واختيار أفضل 4 كروت مؤهلة مع منع تكرار أجزاء السلسلة الواحدة (Franchise Deduplication)
    let topResultsRaw = [];
    const eligibleCandidates = rankedResults.filter(
      (item) => item.finalScore > 30,
    );

    const deduplicatedCandidates = [];
    const seenFranchises = new Set();

    for (const item of eligibleCandidates) {
      const fKey = getFranchiseKey(item.title || item.name);
      if (!seenFranchises.has(fKey)) {
        seenFranchises.add(fKey);
        deduplicatedCandidates.push(item);
      }
    }

    if (parsedIntent.targetType === "mixed") {
      const topMovies = deduplicatedCandidates.filter(
        (item) => item.media_type === "movie",
      );
      const topSeries = deduplicatedCandidates.filter(
        (item) => item.media_type === "tv",
      );

      if (isSitcomIntent) {
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

    // 🌟 آلية الاستكمال الإجباري للـ 4 كروت ديناميكياً بدون Hardcoded arrays
    if (topResultsRaw.length < 4) {
      for (const item of rankedResults) {
        if (topResultsRaw.length >= 4) break;
        const fKey = getFranchiseKey(item.title || item.name);
        const alreadyIn = topResultsRaw.some((p) => p.id === item.id);
        const franchiseUsed = seenFranchises.has(fKey);

        if (!alreadyIn && !franchiseUsed) {
          topResultsRaw.push(item);
          seenFranchises.add(fKey);
        }
      }
    }

    // 🌟 طباعة شجرية لبيانات التقييم والـ Dynamic Weighting في Console الـ Backend (ديناميكية بالكامل)
    let appliedWeightStr = "0%";
    if (userReviewsCount >= 10) appliedWeightStr = "35%";
    else if (userReviewsCount >= 5) appliedWeightStr = "15%";

    const totalUserKwCount = Object.keys(
      userProfileStats.keywords || {},
    ).length;
    const gW = totalUserKwCount > 0 && userReviewsCount >= 5 ? 35 : 60;
    const kwW = totalUserKwCount > 0 && userReviewsCount >= 5 ? 65 : 40;

    console.log(`\n┌─ [Cindrome Dynamic Personalization Engine]`);
    console.log(
      `├── User ID: ${currentUserId} | Approved Reviews (>= 4.0): ${userReviewsCount}`,
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

    // فحص حالة الـ Watchlist للأعمال الأربعة للمستخدم الحالي
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

    // 11. صياغة الرد النهائي
    const responseText = CindromeEngine.generateResponseText(
      parsedIntent,
      formattedResults.length,
      false,
      resolvedAnchorName,
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
