// utils/helpers.js
import db from "../config/db.js";

export const genreMap = {
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
  10765: "Sci-Fi & Fantasy",
};

const sportsRegex =
  /\b(sport|sports|football|soccer|volleyball|basketball|boxing|boxer|baseball|tennis|skating|swimming|swimmer|table tennis|ping pong|badminton|rugby|judo|karate|wrestling|athlete|athletics|striker)\b/i;

export function formatCommentText(text) {
  if (!text) return "";
  let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  safeText = safeText.replace(/\B@\w+/g, (match) => {
    return `<span class="comment-mention">${match}</span>`;
  });
  return safeText;
}

export const formatCard = (item, defaultType = "MOVIE", forcedGenre = null) => {
  let mediaType = item.media_type || (defaultType === "MOVIE" ? "movie" : "tv");
  let displayType = defaultType;

  if (item.media_type) {
    if (item.media_type === "movie") {
      displayType = "MOVIE";
    } else if (item.original_language === "ja") {
      displayType = "ANIME";
    } else {
      displayType = "SERIES";
    }
  }

  let genres = (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean);

  if (displayType === "ANIME") {
    genres = genres.filter((g) => g !== "Animation");
  }

  const textContent = `${item.title || item.name || ""} ${item.overview || ""}`;
  const isSportsContent =
    forcedGenre === "Sports" || sportsRegex.test(textContent);

  if (isSportsContent) {
    genres = ["Sports", ...genres.filter((g) => g !== "Sports")];
  } else if (forcedGenre) {
    genres = [forcedGenre, ...genres.filter((g) => g !== forcedGenre)];
  }

  let selectedGenres = genres.slice(0, 2);
  if (selectedGenres.join(", ").length > 16) {
    selectedGenres = selectedGenres.slice(0, 1);
  }

  const genreText =
    selectedGenres.join(", ") || (displayType === "MOVIE" ? "Cinema" : "Drama");
  const year = (item.release_date || item.first_air_date || "2026").split(
    "-",
  )[0];

  return {
    id: item.id,
    title: item.title || item.name,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "assets/posters/poster-odyssey.webp",
    score: item.vote_average ? item.vote_average.toFixed(1) : "N/A",
    type: displayType,
    mediaType: mediaType,
    ageBadge: item.adult ? "R" : displayType === "MOVIE" ? "PG-13" : "TV-14",
    meta: year,
    subtitle: `${genreText} • ${year}`,
  };
};

export async function getUserWatchlistIds(userId) {
  if (!userId) return [];
  try {
    const result = await db.query(
      "SELECT tmdb_id FROM watchlist WHERE user_id = $1",
      [userId],
    );
    return result.rows.map((row) => row.tmdb_id.toString());
  } catch (err) {
    console.error("Error fetching watchlist IDs:", err);
    return [];
  }
}

export async function getUserLikedMediaIds(userId) {
  if (!userId) return [];
  try {
    const result = await db.query(
      "SELECT tmdb_id FROM liked_media WHERE user_id = $1",
      [userId],
    );
    return result.rows.map((row) => row.tmdb_id.toString());
  } catch (err) {
    console.error("Error fetching liked media IDs:", err);
    return [];
  }
}
