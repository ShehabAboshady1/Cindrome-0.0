import axios from "axios";
import db from "../config/db.js";
import { formatCard } from "../utils/helpers.js";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Render home landing page with trending, categories, and top community lists
export const renderHome = async (req, res) => {
  try {
    const commonParams = { api_key: TMDB_API_KEY, page: 1 };

    const [
      trendingHeroRes,
      trendingAllRes,
      mustWatchRes,
      topTvRes,
      topAnimeRes,
    ] = await Promise.all([
      axios.get("https://api.themoviedb.org/3/trending/movie/week", {
        params: commonParams,
      }),
      axios.get("https://api.themoviedb.org/3/trending/all/week", {
        params: commonParams,
      }),
      axios.get("https://api.themoviedb.org/3/discover/movie", {
        params: {
          ...commonParams,
          sort_by: "popularity.desc",
          "vote_count.gte": 1000,
          "vote_average.gte": 7.5,
        },
      }),
      axios.get("https://api.themoviedb.org/3/discover/tv", {
        params: {
          ...commonParams,
          without_genres: "16",
          sort_by: "popularity.desc",
          "vote_count.gte": 600,
          "vote_average.gte": 7.5,
        },
      }),
      axios.get("https://api.themoviedb.org/3/discover/tv", {
        params: {
          ...commonParams,
          with_original_language: "ja",
          with_genres: "16",
          sort_by: "popularity.desc",
          "vote_count.gte": 300,
        },
      }),
    ]);

    const heroRaw = trendingHeroRes.data.results[0];
    let heroMovie = null;

    if (heroRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${heroRaw.id}`,
        { params: { api_key: TMDB_API_KEY } },
      );
      const d = heroDetailRes.data;
      const hours = Math.floor((d.runtime || 120) / 60);
      const minutes = (d.runtime || 120) % 60;

      heroMovie = {
        id: d.id,
        mediaType: "movie",
        title: d.title,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-odyssey1.webp",
        duration: `${hours}h ${minutes < 10 ? "0" : ""}${minutes}m`,
        year: d.release_date ? d.release_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Adventure, Drama",
      };
    }

    const filteredTrending = trendingAllRes.data.results.filter(
      (item) => item.vote_count >= 150 && item.vote_average >= 6.0,
    );

    // Fetch top community lists from database
    let topCommunityLists = [];
    try {
      const listsQuery = `
        SELECT 
          l.id, 
          l.title, 
          u.username AS author,
          (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS "itemsCount",
          (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) AS likes,
          (SELECT COUNT(*) FROM list_comments lc WHERE lc.list_id = l.id) AS "commentsCount",
          (
            SELECT array_agg(mc.poster_path) 
            FROM (
              SELECT tmdb_id, media_type 
              FROM list_items 
              WHERE list_id = l.id 
              ORDER BY order_index ASC 
              LIMIT 4
            ) li_sub
            JOIN media_cache mc ON li_sub.tmdb_id = mc.tmdb_id AND li_sub.media_type = mc.media_type
          ) AS posters
        FROM lists l
        JOIN users u ON l.user_id = u.id
        WHERE l.is_private = false
        ORDER BY likes DESC
        LIMIT 8;
      `;
      const listsResult = await db.query(listsQuery);
      topCommunityLists = listsResult.rows.map((row) => {
        let formattedPosters = [];
        if (row.posters && Array.isArray(row.posters)) {
          formattedPosters = row.posters
            .map((p) => {
              if (p) {
                return p.startsWith("http")
                  ? p
                  : `https://image.tmdb.org/t/p/w500${p}`;
              }
              return null;
            })
            .filter((p) => p !== null);
        }
        return {
          ...row,
          posters: formattedPosters,
        };
      });
    } catch (dbErr) {
      console.error("[DB Error fetching community lists]:", dbErr.message);
    }

    res.render("index.ejs", {
      heroMovie,
      trendingNow: filteredTrending
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      mustWatchMovies: mustWatchRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      topTVShows: topTvRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      topAnime: topAnimeRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "ANIME")),
      topCommunityLists,
    });
  } catch (error) {
    console.error("[TMDB Index Error]:", error.message);
    res.render("index.ejs", {
      heroMovie: null,
      trendingNow: [],
      mustWatchMovies: [],
      topTVShows: [],
      topAnime: [],
      topCommunityLists: [],
    });
  }
};

// Render anime discovery feed
export const renderAnime = async (req, res) => {
  try {
    const TMDB_URL = "https://api.themoviedb.org/3/discover/tv";
    const commonParams = {
      api_key: TMDB_API_KEY,
      with_original_language: "ja",
      include_adult: false,
      page: 1,
    };

    const [topRatedRes, sportsRes, mysteryRes, trendingRes] = await Promise.all(
      [
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            sort_by: "vote_average.desc",
            "vote_count.gte": 500,
          },
        }),
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            with_keywords: "6075",
            sort_by: "popularity.desc",
            "vote_count.gte": 50,
          },
        }),
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16,9648",
            sort_by: "popularity.desc",
            "vote_count.gte": 50,
          },
        }),
        axios.get(TMDB_URL, {
          params: {
            ...commonParams,
            with_genres: "16",
            sort_by: "popularity.desc",
            "vote_count.gte": 150,
          },
        }),
      ],
    );

    const candidates = trendingRes.data.results || [];
    const featuredRaw =
      candidates.find(
        (item) =>
          item.backdrop_path &&
          item.vote_count >= 200 &&
          item.vote_average >= 7.0,
      ) ||
      candidates.find((item) => item.backdrop_path && item.vote_count >= 100) ||
      candidates[0];

    let heroAnime = null;
    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        { params: { api_key: TMDB_API_KEY } },
      );
      const d = heroDetailRes.data;
      heroAnime = {
        id: d.id,
        mediaType: "anime",
        title: d.name,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-onepiece.webp",
        episodes: d.number_of_episodes
          ? `${d.number_of_episodes} Episodes`
          : "TV Series",
        year: d.first_air_date ? d.first_air_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Fantasy",
      };
    }

    res.render("anime.ejs", {
      heroAnime,
      topRatedAnime: topRatedRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME")),
      actionAnime: sportsRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME", "Sports")),
      mysteryAnime: mysteryRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME")),
    });
  } catch (error) {
    console.error("[TMDB Anime Error]:", error.message);
    res.render("anime.ejs", {
      heroAnime: null,
      topRatedAnime: [],
      actionAnime: [],
      mysteryAnime: [],
    });
  }
};

// Render movies catalog
export const renderMovies = async (req, res) => {
  try {
    const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/discover/movie";
    const commonParams = {
      api_key: TMDB_API_KEY,
      include_adult: false,
      page: 1,
    };

    const [trendingRes, latestRes, actionSciFiRes, thrillerRes, horrorRes] =
      await Promise.all([
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 150,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            primary_release_year: 2026,
            sort_by: "popularity.desc",
            "vote_count.gte": 10,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "28,878",
            sort_by: "popularity.desc",
            "vote_count.gte": 100,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "80,9648",
            sort_by: "popularity.desc",
            "vote_count.gte": 100,
          },
        }),
        axios.get(TMDB_MOVIE_URL, {
          params: {
            ...commonParams,
            with_genres: "27",
            sort_by: "popularity.desc",
            "vote_count.gte": 80,
          },
        }),
      ]);

    const candidates = trendingRes.data.results || [];
    const featuredRaw =
      candidates.find(
        (m) => m.backdrop_path && m.vote_count >= 300 && m.vote_average >= 6.8,
      ) || candidates[0];

    let heroMovie = null;
    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${featuredRaw.id}`,
        { params: { api_key: TMDB_API_KEY } },
      );
      const d = heroDetailRes.data;
      const hours = Math.floor((d.runtime || 120) / 60);
      const minutes = (d.runtime || 120) % 60;
      heroMovie = {
        id: d.id,
        title: d.title,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-thedeathofrobinhood.webp",
        duration: `${hours}h ${minutes < 10 ? "0" : ""}${minutes}m`,
        year: d.release_date ? d.release_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Adventure, Drama",
      };
    }

    res.render("movies.ejs", {
      heroMovie,
      latestMovies: latestRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      actionSciFiMovies: actionSciFiRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      thrillerMovies: thrillerRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      horrorMovies: horrorRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
    });
  } catch (error) {
    console.error("[TMDB Movies Error]:", error.message);
    res.render("movies.ejs", {
      heroMovie: null,
      latestMovies: [],
      actionSciFiMovies: [],
      thrillerMovies: [],
      horrorMovies: [],
    });
  }
};

// Render series catalog
export const renderSeries = async (req, res) => {
  try {
    const TMDB_TV_URL = "https://api.themoviedb.org/3/discover/tv";
    const commonParams = {
      api_key: TMDB_API_KEY,
      without_genres: "16",
      include_adult: false,
      page: 1,
    };

    const [trendingRes, topRatedRes, actionSciFiRes, crimeRes, mysteryRes] =
      await Promise.all([
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            sort_by: "vote_average.desc",
            "vote_count.gte": 1000,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_genres: "10759|10765",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_genres: "80",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),
        axios.get(TMDB_TV_URL, {
          params: {
            ...commonParams,
            with_keywords: "9799|6152",
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
            "vote_average.gte": 7.0,
          },
        }),
      ]);

    const candidates = trendingRes.data.results || [];
    const featuredRaw =
      candidates.find(
        (t) => t.backdrop_path && t.vote_count >= 300 && t.vote_average >= 7.0,
      ) || candidates[0];

    let heroSeries = null;
    if (featuredRaw) {
      const heroDetailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${featuredRaw.id}`,
        { params: { api_key: TMDB_API_KEY } },
      );
      const d = heroDetailRes.data;
      const startYear = d.first_air_date
        ? d.first_air_date.split("-")[0]
        : "2026";
      const endYear =
        d.status === "Ended" && d.last_air_date
          ? d.last_air_date.split("-")[0]
          : "Present";

      heroSeries = {
        id: d.id,
        mediaType: "tv",
        title: d.name,
        overview: d.overview || "No synopsis available at this time.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "/assets/backdrops/backdrop-sherlock.webp",
        duration: `${d.number_of_seasons || 1} Seasons • ${d.number_of_episodes || 10} Episodes`,
        year: startYear === endYear ? startYear : `${startYear} – ${endYear}`,
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Crime, Drama, Mystery",
      };
    }

    res.render("series.ejs", {
      heroSeries,
      topRatedSeries: topRatedRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      actionSciFiSeries: actionSciFiRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      crimeSeries: crimeRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      mysterySeries: mysteryRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
    });
  } catch (error) {
    console.error("[TMDB Series Error]:", error.message);
    res.render("series.ejs", {
      heroSeries: null,
      topRatedSeries: [],
      actionSciFiSeries: [],
      crimeSeries: [],
      mysterySeries: [],
    });
  }
};

// Render media details page with credits, seasons, and user reviews
export const renderDetails = async (req, res) => {
  try {
    const mediaId = req.query.id || "1396";
    const mediaType = req.query.type || "tv";
    const endpoint =
      mediaType === "movie"
        ? `https://api.themoviedb.org/3/movie/${mediaId}`
        : `https://api.themoviedb.org/3/tv/${mediaId}`;

    const response = await axios.get(endpoint, {
      params: {
        api_key: TMDB_API_KEY,
        append_to_response: "credits,recommendations,keywords",
      },
    });
    const d = response.data;

    let season1Episodes = [];
    if (mediaType === "tv") {
      try {
        const seasonRes = await axios.get(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/1`,
          { params: { api_key: TMDB_API_KEY } },
        );
        season1Episodes = seasonRes.data.episodes || [];
      } catch (err) {
        season1Episodes = [];
      }
    }

    let durationText =
      mediaType === "movie"
        ? `${Math.floor((d.runtime || 120) / 60)}h ${(d.runtime || 120) % 60}m`
        : `${d.number_of_seasons || 1} Seasons`;
    let badgeText =
      mediaType === "movie"
        ? "Movie"
        : d.original_language === "ja"
          ? "Anime"
          : "TV Series";

    let creatorLabel = mediaType === "movie" ? "Director" : "Creators";
    let creatorName = "N/A";
    if (mediaType === "movie") {
      const director = d.credits?.crew?.find((c) => c.job === "Director");
      creatorName = director ? director.name : "N/A";
    } else {
      if (d.created_by && d.created_by.length > 0)
        creatorName = d.created_by.map((c) => c.name).join(", ");
      else {
        const animeCreator = d.credits?.crew?.find((c) =>
          [
            "Original Creator",
            "Original Story",
            "Series Director",
            "Director",
          ].includes(c.job),
        );
        if (animeCreator) {
          creatorLabel = animeCreator.job.includes("Original")
            ? "Original Manga"
            : "Director";
          creatorName = animeCreator.name;
        } else if (
          d.production_companies &&
          d.production_companies.length > 0
        ) {
          creatorLabel = "Studio";
          creatorName = d.production_companies[0].name;
        }
      }
    }

    let genreNames = (d.genres || []).map((g) => g.name);
    if (badgeText === "Anime") {
      genreNames = genreNames.filter((g) => g !== "Animation");
      const kwList = d.keywords?.results || d.keywords?.keywords || [];
      const hasSportsKw = kwList.some(
        (k) =>
          k.id === 6075 ||
          (typeof k.name === "string" &&
            k.name.toLowerCase().includes("sport")),
      );
      if (hasSportsKw)
        genreNames = ["Sports", ...genreNames.filter((g) => g !== "Sports")];
    }

    const media = {
      id: d.id,
      type: mediaType,
      badge: badgeText,
      title: d.title || d.name,
      year: (d.release_date || d.first_air_date || "2026").split("-")[0],
      score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
      duration: durationText,
      genres:
        genreNames.length > 0 ? genreNames.slice(0, 3).join(", ") : "Drama",
      overview: d.overview || "No synopsis available at this time.",
      poster: d.poster_path
        ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
        : "assets/posters/poster-sherlock.webp",
      backdrop: d.backdrop_path
        ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
        : "assets/backdrops/backdrop-sherlock.webp",
      creatorLabel,
      creator: creatorName,
      status: d.status || "Released",
      cast: (d.credits?.cast || []).slice(0, 10).map((actor) => ({
        name: actor.name,
        character: actor.character || "Cast Member",
        image: actor.profile_path
          ? `https://image.tmdb.org/t/p/w300${actor.profile_path}`
          : "assets/profile-avatar.jpg",
      })),
      episodes: season1Episodes,
      seasonsCount: d.number_of_seasons || 1,
      recommendations: (d.recommendations?.results || [])
        .slice(0, 8)
        .map((rec) =>
          formatCard(rec, mediaType === "movie" ? "MOVIE" : "SERIES"),
        ),
    };

    let dbReviews = [];
    try {
      let typesToSearch =
        mediaType === "tv" || mediaType === "anime"
          ? ["tv", "anime"]
          : [mediaType];
      const reviewsQuery = `
        SELECT r.id as review_id, r.rating, r.review_text, r.has_spoilers, r.season_number, r.episode_number, u.username, p.avatar_url,
          (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) as likes_count,
          (SELECT COUNT(*) FROM review_comments rc WHERE rc.review_id = r.id) as comments_count,
          ${req.user ? `EXISTS (SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
        FROM reviews r JOIN users u ON r.user_id = u.id LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE r.tmdb_id = $1 AND r.media_type = ANY($2::varchar[]) ORDER BY r.created_at DESC LIMIT 10;
      `;
      const reviewsResult = await db.query(reviewsQuery, [
        mediaId,
        typesToSearch,
      ]);
      dbReviews = reviewsResult.rows;
    } catch (dbErr) {
      console.error("Details Reviews Error:", dbErr.message);
    }

    media.reviews = dbReviews;
    res.render("details.ejs", { media });
  } catch (error) {
    console.error("[TMDB Details Error]:", error.message);
    res.redirect("/");
  }
};

// Fetch season episodes from TMDB
export const getSeasonEpisodes = async (req, res) => {
  try {
    const { id, seasonNumber } = req.params;
    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`,
      { params: { api_key: TMDB_API_KEY } },
    );
    res.json(response.data.episodes || []);
  } catch (error) {
    console.error("[Season Fetch Error]:", error.message);
    res.status(500).json([]);
  }
};

export const renderDiscover = (req, res) => res.render("discover.ejs");

// TMDB Genre definitions for discover mapping
const TMDB_GENRES = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
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
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function formatDiscoverItem(item) {
  const isAnime = item.original_language === "ja";
  const isMovie = item.media_type === "movie" || item.title !== undefined;
  let badge = isMovie ? "Movie" : isAnime ? "Anime" : "Series";
  const y =
    (item.release_date || item.first_air_date || "").split("-")[0] || "N/A";
  const score = item.vote_average ? item.vote_average.toFixed(1) : "NR";
  const genres = (item.genre_ids || [])
    .filter((id) => id !== 16)
    .map((id) => TMDB_GENRES[id])
    .filter(Boolean)
    .slice(0, 2);
  const genreDisplay =
    genres.length > 0
      ? genres.join(", ")
      : badge === "Anime"
        ? "Anime"
        : "General";

  return {
    id: item.id,
    title: item.title || item.name,
    mediaType: isMovie ? "movie" : "tv",
    badge,
    year: y,
    genres: genreDisplay,
    score,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='255' viewBox='0 0 170 255'%3E%3Crect fill='%2311201f' width='170' height='255'/%3E%3Ctext fill='%23718096' font-family='sans-serif' font-size='14' dy='130' dx='45'%3ENo Poster%3C/text%3E%3C/svg%3E",
  };
}

// Media discover endpoint with multi-criteria filtering
export const apiDiscover = async (req, res) => {
  try {
    const {
      q = "",
      type = "all",
      genre = "all",
      rating = "0",
      sort = "popular",
      year = "all",
      page = 1,
    } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const ITEMS_PER_PAGE = 21;

    const movieGenreMap = {
      action: 28,
      scifi: 878,
      drama: 18,
      mystery: 9648,
      fantasy: 14,
      comedy: 35,
    };
    const tvGenreMap = {
      action: 10759,
      scifi: 10765,
      drama: 18,
      mystery: 9648,
      fantasy: 10765,
      comedy: 35,
    };

    async function attachWatchlistStatus(itemsArray) {
      const results = itemsArray.map(formatDiscoverItem);
      if (req.user && results.length > 0) {
        try {
          const tmdbIds = results.map((r) => r.id);
          const wlResult = await db.query(
            "SELECT tmdb_id, media_type FROM watchlist WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
            [req.user.id, tmdbIds],
          );
          const wlMap = {};
          wlResult.rows.forEach(
            (row) => (wlMap[`${row.tmdb_id}-${row.media_type}`] = true),
          );
          results.forEach((item) => {
            const dbType = item.mediaType === "anime" ? "tv" : item.mediaType;
            item.is_watchlisted =
              !!wlMap[`${item.id}-${dbType}`] || !!wlMap[`${item.id}-anime`];
          });
        } catch (dbErr) {
          console.error("Discover Watchlist Error:", dbErr);
        }
      }
      return results;
    }

    if (q.trim() !== "") {
      const searchRes = await axios.get(
        "https://api.themoviedb.org/3/search/multi",
        { params: { api_key: TMDB_API_KEY, query: q.trim(), page: pageNum } },
      );
      let items = (searchRes.data.results || []).filter(
        (it) => it.media_type === "movie" || it.media_type === "tv",
      );
      if (type === "movie")
        items = items.filter((it) => it.media_type === "movie");
      else if (type === "tv")
        items = items.filter(
          (it) => it.media_type === "tv" && it.original_language !== "ja",
        );
      else if (type === "anime")
        items = items.filter((it) => it.original_language === "ja");

      const results = await attachWatchlistStatus(
        items.slice(0, ITEMS_PER_PAGE),
      );
      return res.json({
        results,
        page: pageNum,
        totalPages: Math.min(searchRes.data.total_pages || 1, 500),
      });
    }

    function buildDiscoverParams(mediaType, targetPage) {
      const params = { api_key: TMDB_API_KEY, page: targetPage };
      if (sort === "newest")
        params.sort_by =
          mediaType === "movie"
            ? "primary_release_date.desc"
            : "first_air_date.desc";
      else if (sort === "rating") {
        params.sort_by = "vote_average.desc";
        params["vote_count.gte"] = 100;
      } else params.sort_by = "popularity.desc";

      const minRating = parseFloat(rating);
      if (minRating > 0) {
        params["vote_average.gte"] = minRating;
        if (minRating >= 8.0) params["vote_count.gte"] = 100;
        else if (minRating >= 7.0) params["vote_count.gte"] = 50;
        else params["vote_count.gte"] = 20;
      }
      if (year !== "all") {
        const prefix =
          mediaType === "movie" ? "primary_release_date" : "first_air_date";
        if (year === "2010s") {
          params[`${prefix}.gte`] = "2010-01-01";
          params[`${prefix}.lte`] = "2019-12-31";
        } else if (year === "2000s") {
          params[`${prefix}.gte`] = "2000-01-01";
          params[`${prefix}.lte`] = "2009-12-31";
        } else if (year === "90s") {
          params[`${prefix}.gte`] = "1990-01-01";
          params[`${prefix}.lte`] = "1999-12-31";
        } else if (year === "classics") params[`${prefix}.lte`] = "1989-12-31";
        else if (!isNaN(year)) {
          if (mediaType === "movie")
            params.primary_release_year = parseInt(year, 10);
          else params.first_air_date_year = parseInt(year, 10);
        }
      }
      if (genre !== "all") {
        const gid =
          mediaType === "movie" ? movieGenreMap[genre] : tvGenreMap[genre];
        if (gid) params.with_genres = gid;
      }
      return params;
    }

    let rawItems = [];
    let totalPages = 500;

    if (type === "all") {
      const [mInit, tInit] = await Promise.all([
        axios.get("https://api.themoviedb.org/3/discover/movie", {
          params: buildDiscoverParams("movie", 1),
        }),
        axios.get("https://api.themoviedb.org/3/discover/tv", {
          params: {
            ...buildDiscoverParams("tv", 1),
            without_original_language: "ja",
          },
        }),
      ]);
      const movieTotal = mInit.data.total_results || 0;
      const tvTotal = tInit.data.total_results || 0;
      totalPages = Math.min(
        Math.ceil((movieTotal + tvTotal) / ITEMS_PER_PAGE),
        500,
      );
      let movieIndex = 0;
      let tvIndex = 0;
      let movieStart = 0;
      let movieCount = 0;
      let tvStart = 0;
      let tvCount = 0;

      for (let k = 1; k <= pageNum; k++) {
        const mLeft = Math.max(0, movieTotal - movieIndex);
        const tLeft = Math.max(0, tvTotal - tvIndex);
        let mTake = Math.min(11, mLeft);
        let tTake = Math.min(ITEMS_PER_PAGE - mTake, tLeft);
        if (mTake + tTake < ITEMS_PER_PAGE && tLeft > tTake)
          tTake = Math.min(ITEMS_PER_PAGE - mTake, tLeft);
        if (mTake + tTake < ITEMS_PER_PAGE && mLeft > mTake)
          mTake = Math.min(ITEMS_PER_PAGE - tTake, mLeft);
        if (k === pageNum) {
          movieStart = movieIndex;
          movieCount = mTake;
          tvStart = tvIndex;
          tvCount = tTake;
        }
        movieIndex += mTake;
        tvIndex += tTake;
      }

      async function fetchMediaSlice(mediaType, start, count, initData) {
        if (count <= 0) return [];
        const p1 = Math.floor(start / 20) + 1;
        const p2 = Math.floor((start + count - 1) / 20) + 1;
        const endpoint =
          mediaType === "movie"
            ? "https://api.themoviedb.org/3/discover/movie"
            : "https://api.themoviedb.org/3/discover/tv";
        const baseParams = buildDiscoverParams(mediaType, p1);
        if (mediaType === "tv") baseParams.without_original_language = "ja";
        const p1Promise =
          p1 === 1
            ? Promise.resolve(initData)
            : axios.get(endpoint, { params: baseParams });
        const p2Promise =
          p1 !== p2
            ? p2 === 1
              ? Promise.resolve(initData)
              : axios.get(endpoint, {
                  params: {
                    ...buildDiscoverParams(mediaType, p2),
                    ...(mediaType === "tv"
                      ? { without_original_language: "ja" }
                      : {}),
                  },
                })
            : Promise.resolve({ data: { results: [] } });
        const [r1, r2] = await Promise.all([p1Promise, p2Promise]);
        const list = [
          ...(r1.data.results || []),
          ...(r2.data.results || []),
        ].map((it) => ({ ...it, media_type: mediaType }));
        const offset = start - (p1 - 1) * 20;
        return list.slice(offset, offset + count);
      }
      const [moviesSlice, tvsSlice] = await Promise.all([
        fetchMediaSlice("movie", movieStart, movieCount, mInit),
        fetchMediaSlice("tv", tvStart, tvCount, tInit),
      ]);
      const combined = [];
      const maxL = Math.max(moviesSlice.length, tvsSlice.length);
      for (let i = 0; i < maxL; i++) {
        if (moviesSlice[i]) combined.push(moviesSlice[i]);
        if (tvsSlice[i]) combined.push(tvsSlice[i]);
      }
      rawItems = combined.slice(0, ITEMS_PER_PAGE);
    } else {
      const startIndex = (pageNum - 1) * ITEMS_PER_PAGE;
      const p1 = Math.floor(startIndex / 20) + 1;
      const p2 = Math.floor((startIndex + ITEMS_PER_PAGE - 1) / 20) + 1;
      const p1Params = buildDiscoverParams(
        type === "movie" ? "movie" : "tv",
        p1,
      );
      const p2Params = buildDiscoverParams(
        type === "movie" ? "movie" : "tv",
        p2,
      );
      if (type === "tv") {
        p1Params.without_original_language = "ja";
        p2Params.without_original_language = "ja";
      }
      if (type === "anime") {
        p1Params.with_original_language = "ja";
        p2Params.with_original_language = "ja";
        p1Params.with_genres = p1Params.with_genres
          ? `16,${p1Params.with_genres}`
          : 16;
        p2Params.with_genres = p2Params.with_genres
          ? `16,${p2Params.with_genres}`
          : 16;
      }
      const endpoint =
        type === "movie"
          ? "https://api.themoviedb.org/3/discover/movie"
          : "https://api.themoviedb.org/3/discover/tv";

      const [r1, r2] = await Promise.all([
        axios.get(endpoint, { params: p1Params }),
        p1 !== p2
          ? axios.get(endpoint, { params: p2Params })
          : Promise.resolve({ data: { results: [] } }),
      ]);
      const list = [...(r1.data.results || []), ...(r2.data.results || [])].map(
        (m) => ({ ...m, media_type: type === "movie" ? "movie" : "tv" }),
      );
      const offset = startIndex - (p1 - 1) * 20;
      rawItems = list.slice(offset, offset + ITEMS_PER_PAGE);
      totalPages = Math.min(
        Math.ceil((r1.data.total_results || 500) / ITEMS_PER_PAGE),
        500,
      );
    }

    const results = await attachWatchlistStatus(rawItems);
    res.json({ results, page: pageNum, totalPages });
  } catch (error) {
    console.error("Discover API Error:", error);
    res.status(500).json({ results: [], page: 1, totalPages: 1 });
  }
};

// Global media search endpoint across movies, series, and anime
export const apiSearch = async (req, res) => {
  try {
    const query = req.query.q;
    const filterType = req.query.type || "all";
    if (!query || query.trim() === "") return res.json([]);

    const response = await axios.get(
      "https://api.themoviedb.org/3/search/multi",
      {
        params: {
          api_key: process.env.TMDB_API_KEY,
          query: query.trim(),
          page: 1,
        },
      },
    );

    let items = (response.data.results || []).filter(
      (item) => item.media_type === "movie" || item.media_type === "tv",
    );

    if (filterType === "movie")
      items = items.filter((item) => item.media_type === "movie");
    else if (filterType === "tv")
      items = items.filter(
        (item) => item.media_type === "tv" && item.original_language !== "ja",
      );
    else if (filterType === "anime")
      items = items.filter((item) => item.original_language === "ja");

    const results = items.slice(0, 20).map((item) => {
      const isAnime = item.original_language === "ja";
      let badge =
        item.media_type === "movie" ? "Movie" : isAnime ? "Anime" : "Series";
      const rawYear = (item.release_date || item.first_air_date || "").split(
        "-",
      )[0];
      const score = item.vote_average
        ? parseFloat(item.vote_average.toFixed(1))
        : 0;

      return {
        id: item.id,
        title: item.title || item.name,
        mediaType: item.media_type,
        badge: badge,
        year: rawYear ? parseInt(rawYear, 10) : "N/A",
        numericYear: rawYear ? parseInt(rawYear, 10) : 0,
        score: score > 0 ? score.toFixed(1) : "NR",
        numericScore: score,
        genres: item.genre_ids || [],
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='255' viewBox='0 0 170 255'%3E%3Crect fill='%2311201f' width='170' height='255'/%3E%3Ctext fill='%23718096' font-family='sans-serif' font-size='14' dy='130' dx='45'%3ENo Poster%3C/text%3E%3C/svg%3E",
      };
    });
    res.json(results);
  } catch (error) {
    res.status(500).json([]);
  }
};
